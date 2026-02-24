// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

test.use({ serviceWorkers: 'block' });

function getEnv(name, fallback = '') {
    const value = process.env[name];
    return typeof value === 'string' ? value.trim() : fallback;
}

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
    testInfo.skip(!googleActive, 'La fuente de agenda no es Google en este entorno.');
}

async function adminLogin(request, password) {
    const response = await request.post('/admin-auth.php?action=login', {
        data: { password },
    });
    const body = await response.json().catch(() => ({}));

    if (!response.ok() || body.ok === false) {
        return {
            ok: false,
            reason: body.error || `HTTP ${response.status()}`,
        };
    }

    if (body.twoFactorRequired) {
        return {
            ok: false,
            reason: '2FA requerido para panel admin',
        };
    }

    const csrfToken = typeof body.csrfToken === 'string' ? body.csrfToken : '';
    if (!csrfToken) {
        return {
            ok: false,
            reason: 'Login admin sin CSRF token',
        };
    }

    return {
        ok: true,
        csrfToken,
    };
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch (_) {
        return {};
    }
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

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const resource = url.searchParams.get('resource') || '';
        const doctor = String(url.searchParams.get('doctor') || 'indiferente');
        const service = String(url.searchParams.get('service') || 'consulta');
        const durationMin = service === 'laser' ? 60 : 30;

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
        expectedSlots: availabilitySlots.filter((slot) => !bookedSlots.includes(slot)),
    };
}

test.describe('Fase 2: consistencia calendario', () => {
    test('concurrencia en mismo slot produce 201 + 409 slot_conflict', async (
        { request },
        testInfo
    ) => {
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

        const login = await adminLogin(request, adminPassword);
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

                if (statusA === 201 && Number.isFinite(Number(bodyA?.data?.id))) {
                    createdAppointmentIds.push(Number(bodyA.data.id));
                }
                if (statusB === 201 && Number.isFinite(Number(bodyB?.data?.id))) {
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

    test('web y chat muestran la misma oferta de slots para misma fecha/servicio', async ({
        page,
    }) => {
        const dateKey = nextDateKey(6);
        const { expectedSlots } = await mockParityApi(page, dateKey);

        await page.addInitScript(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'rejected',
                    at: new Date().toISOString(),
                })
            );
        });

        await page.goto('/');
        await page.waitForFunction(() => window.PielBookingUiReady === true);

        const serviceSelect = page
            .locator('#serviceSelect, [name="service"]')
            .first();
        await expect(serviceSelect).toBeVisible();
        await serviceSelect.selectOption('consulta');

        const doctorSelect = page
            .locator('#doctorSelect, [name="doctor"]')
            .first();
        await expect(doctorSelect).toBeVisible();
        await doctorSelect.selectOption('rosero');

        const dateInput = page
            .locator('#dateInput, [name="date"], input[type="date"]')
            .first();
        await expect(dateInput).toBeVisible();
        await dateInput.fill(dateKey);
        await dateInput.dispatchEvent('change');

        const timeSelect = page.locator('#timeSelect, [name="time"]').first();
        await expect(timeSelect).toBeVisible();
        const sortedExpected = Array.from(new Set(expectedSlots)).sort();
        await expect
            .poll(async () => {
                return await timeSelect.evaluate((select) =>
                    Array.from(
                        new Set(
                            Array.from(select.options)
                                .map((option) => option.value)
                                .filter((value) => /^\d{2}:\d{2}$/.test(value))
                        )
                    ).sort()
                );
            })
            .toEqual(sortedExpected);

        const webSlots = await timeSelect.evaluate((select) =>
            Array.from(select.options)
                .map((option) => option.value)
                .filter((value) => /^\d{2}:\d{2}$/.test(value))
        );

        await page.locator('#chatbotWidget .chatbot-toggle').click();
        await expect(page.locator('#chatbotContainer')).toHaveClass(/active/);
        await page
            .locator(
                '#quickOptions [data-action="quick-message"][data-value="appointment"]'
            )
            .click();

        await page
            .locator(
                '#chatMessages button[data-action="chat-booking"][data-value="consulta"]'
            )
            .last()
            .click();
        await page
            .locator(
                '#chatMessages button[data-action="chat-booking"][data-value="rosero"]'
            )
            .last()
            .click();

        const chatDateInput = page.locator('#chatMessages #chatDateInput').last();
        await expect(chatDateInput).toBeVisible();
        await chatDateInput.evaluate((input, value) => {
            input.value = String(value);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }, dateKey);

        await expect
            .poll(async () => {
                return await page
                    .locator('#chatMessages button[data-action="chat-booking"]')
                    .count();
            })
            .toBeGreaterThan(0);

        const chatSlots = await page.$$eval(
            '#chatMessages button[data-action="chat-booking"]',
            (buttons) =>
                buttons
                    .map((button) => button.getAttribute('data-value') || '')
                    .filter((value) => /^\d{2}:\d{2}$/.test(value))
        );

        const sortedWeb = Array.from(new Set(webSlots)).sort();
        const sortedChat = Array.from(new Set(chatSlots)).sort();
        expect(sortedWeb).toEqual(sortedExpected);
        expect(sortedChat).toEqual(sortedExpected);
        expect(sortedWeb).toEqual(sortedChat);
    });
});
