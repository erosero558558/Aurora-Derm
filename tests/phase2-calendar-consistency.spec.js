// @ts-check
const { test, expect } = require('@playwright/test');
const {
    adminLogin,
    getEnv,
    safeJson,
} = require('./helpers/admin-auth');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

test.use({ serviceWorkers: 'block' });

function requireGoogleCalendar() {
    return getEnv('TEST_REQUIRE_GOOGLE_CALENDAR', 'false') === 'true';
}

async function getHealthPayload(request) {
    const response = await request.get('/api.php?resource=health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.ok).toBe(true);
    return body;
}

function enforceOrSkipGoogleMode(testInfo, health) {
    const googleActive = String(health.calendarSource) === 'google';
    if (requireGoogleCalendar()) {
        expect(
            googleActive,
            'TEST_REQUIRE_GOOGLE_CALENDAR=true pero health.calendarSource != google'
        ).toBe(true);
        return;
    }
    testInfo.skip(
        !googleActive,
        'La fuente de agenda no es Google en este entorno.'
    );
}

async function findFreeSlot(request, doctor, service, days = 21) {
    const availabilityResponse = await request.get(
        `/api.php?resource=availability&doctor=${encodeURIComponent(doctor)}&service=${encodeURIComponent(service)}&days=${encodeURIComponent(String(days))}`
    );
    expect(availabilityResponse.ok()).toBeTruthy();
    const availabilityBody = await availabilityResponse.json();
    expect(availabilityBody.ok).toBe(true);
    expect(availabilityBody.meta?.source).toBe('google');

    const calendarByDate =
        availabilityBody.data && typeof availabilityBody.data === 'object'
            ? availabilityBody.data
            : {};
    const dates = Object.keys(calendarByDate).sort();
    for (const date of dates) {
        const slots = Array.isArray(calendarByDate[date])
            ? [...calendarByDate[date]].sort()
            : [];
        if (slots.length === 0) {
            continue;
        }

        const bookedResponse = await request.get(
            `/api.php?resource=booked-slots&date=${encodeURIComponent(date)}&doctor=${encodeURIComponent(doctor)}&service=${encodeURIComponent(service)}`
        );
        expect(bookedResponse.ok()).toBeTruthy();
        const bookedBody = await bookedResponse.json();
        const booked = new Set(
            Array.isArray(bookedBody.data) ? bookedBody.data.map(String) : []
        );

        const free = slots.filter((slot) => !booked.has(String(slot)));
        if (free.length > 0) {
            return {
                date,
                time: String(free[0]),
            };
        }
    }

    return null;
}

function nextDateKey(daysAhead = 6) {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

async function mockParityApi(page, dateKey) {
    const availabilitySlots = ['11:30', '10:00', '10:30', '09:00'];
    const bookedSlots = ['10:30'];
    const hits = [];

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';
        const doctor = String(url.searchParams.get('doctor') || 'indiferente');
        const service = String(url.searchParams.get('service') || 'consulta');
        const durationMin = service === 'laser' ? 60 : 30;

        hits.push({
            method: request.method(),
            resource,
        });

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    [dateKey]: availabilitySlots,
                },
                meta: {
                    source: 'google',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    doctor,
                    service,
                    durationMin,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        if (resource === 'booked-slots') {
            return jsonResponse(route, {
                ok: true,
                data: bookedSlots,
                meta: {
                    source: 'google',
                    mode: 'live',
                    timezone: 'America/Guayaquil',
                    doctor,
                    service,
                    durationMin,
                    generatedAt: new Date().toISOString(),
                },
            });
        }

        if (resource === 'reviews') {
            return jsonResponse(route, { ok: true, data: [] });
        }

        if (resource === 'health') {
            return jsonResponse(route, {
                ok: true,
                status: 'ok',
                calendarSource: 'google',
                calendarAuth: 'oauth_refresh',
                calendarMode: 'live',
                calendarReachable: true,
                calendarRequired: true,
                calendarRequirementMet: true,
            });
        }

        if (resource === 'appointments' && request.method() === 'POST') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    id: 99901,
                },
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return {
        expectedSlots: availabilitySlots.filter(
            (slot) => !bookedSlots.includes(slot)
        ),
        hits,
    };
}

test.describe('Fase 2: consistencia calendario', () => {
    test('concurrencia en mismo slot produce 201 + 409 slot_conflict', async ({
        request,
    }, testInfo) => {
        await skipIfPhpRuntimeMissing(test, request);

        const writeEnabled = getEnv('TEST_ENABLE_CALENDAR_WRITE') === 'true';
        test.skip(
            !writeEnabled,
            'TEST_ENABLE_CALENDAR_WRITE=true es requerido para prueba de concurrencia real.'
        );

        const adminPassword =
            getEnv('TEST_ADMIN_PASSWORD') ||
            getEnv('PIELARMONIA_ADMIN_PASSWORD');
        test.skip(
            !adminPassword,
            'TEST_ADMIN_PASSWORD o PIELARMONIA_ADMIN_PASSWORD es requerido para cleanup seguro.'
        );

        const health = await getHealthPayload(request);
        enforceOrSkipGoogleMode(testInfo, health);

        const login = await adminLogin(request, { password: adminPassword });
        test.skip(!login.ok, `No se pudo autenticar admin: ${login.reason}`);

        const createdAppointmentIds = [];

        try {
            let assertionPassed = false;
            const maxAttempts = 3;

            for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                const slot = await findFreeSlot(
                    request,
                    'rosero',
                    'consulta',
                    21
                );

                if (!slot) {
                    break;
                }

                const stamp = Date.now() + attempt;
                const basePayload = {
                    service: 'consulta',
                    doctor: 'rosero',
                    date: slot.date,
                    time: slot.time,
                    privacyConsent: true,
                    paymentMethod: 'cash',
                };

                const payloadA = {
                    ...basePayload,
                    name: `Race A ${stamp}`,
                    email: `race-a-${stamp}@example.com`,
                    phone: '+593900000101',
                    reason: 'Fase2 concurrencia A',
                };
                const payloadB = {
                    ...basePayload,
                    name: `Race B ${stamp}`,
                    email: `race-b-${stamp}@example.com`,
                    phone: '+593900000102',
                    reason: 'Fase2 concurrencia B',
                };

                const [responseA, responseB] = await Promise.all([
                    request.post('/api.php?resource=appointments', {
                        data: payloadA,
                    }),
                    request.post('/api.php?resource=appointments', {
                        data: payloadB,
                    }),
                ]);

                const statusA = responseA.status();
                const statusB = responseB.status();
                const bodyA = await safeJson(responseA);
                const bodyB = await safeJson(responseB);

                if (
                    statusA === 201 &&
                    Number.isFinite(Number(bodyA?.data?.id))
                ) {
                    createdAppointmentIds.push(Number(bodyA.data.id));
                }
                if (
                    statusB === 201 &&
                    Number.isFinite(Number(bodyB?.data?.id))
                ) {
                    createdAppointmentIds.push(Number(bodyB.data.id));
                }

                const sortedStatuses = [statusA, statusB].sort((a, b) => a - b);
                if (sortedStatuses[0] !== 201 || sortedStatuses[1] !== 409) {
                    continue;
                }

                const conflictBody = statusA === 409 ? bodyA : bodyB;
                if (String(conflictBody?.code || '') !== 'slot_conflict') {
                    continue;
                }

                assertionPassed = true;
                break;
            }

            expect(
                assertionPassed,
                'No se obtuvo el patron esperado (201 + 409 slot_conflict) en los intentos de concurrencia'
            ).toBe(true);
        } finally {
            const uniqueIds = Array.from(
                new Set(
                    createdAppointmentIds.filter((id) =>
                        Number.isFinite(Number(id))
                    )
                )
            );

            for (const id of uniqueIds) {
                await request.patch('/api.php?resource=appointments', {
                    headers: {
                        'X-CSRF-Token': login.csrfToken,
                    },
                    data: {
                        id,
                        status: 'cancelled',
                    },
                });
            }

            await request.post('/admin-auth.php?action=logout').catch(() => {});
        }
    });

    test('las rutas V6 mantienen booking desactivado sin pedir slots ni crear citas', async ({
        page,
    }) => {
        const dateKey = nextDateKey(6);
        const { hits } = await mockParityApi(page, dateKey);

        await page.addInitScript(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'rejected',
                    at: new Date().toISOString(),
                })
            );
        });

        for (const route of ['/es/', '/es/servicios/acne-rosacea/']) {
            await gotoPublicRoute(page, route);
            await waitForBookingStatus(page, 'Reserva online en mantenimiento');
            await expectNoLegacyPublicShell(page);
        }

        const runtimeResources = hits
            .filter((hit) =>
                ['availability', 'booked-slots', 'appointments'].includes(
                    String(hit.resource)
                )
            )
            .map((hit) => `${hit.method}:${hit.resource}`);

        expect(
            runtimeResources,
            `La superficie V6 no deberia consultar slots ni crear citas cuando booking esta desactivado (dateKey=${dateKey})`
        ).toEqual([]);
    });
});
