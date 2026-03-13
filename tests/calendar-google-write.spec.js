// @ts-check
const { test, expect } = require('@playwright/test');
const { adminLogin, getEnv } = require('./helpers/admin-auth');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function requireGoogleCalendar() {
    return getEnv('TEST_REQUIRE_GOOGLE_CALENDAR', 'false') === 'true';
}

function parseSlotToUtcMs(date, time) {
    if (
        typeof date !== 'string' ||
        typeof time !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !/^\d{2}:\d{2}$/.test(time)
    ) {
        return Number.NaN;
    }

    // Agenda operativa en Ecuador (America/Guayaquil, UTC-05:00).
    return Date.parse(`${date}T${time}:00-05:00`);
}

function pickFirstSlot(
    data,
    excludeDate = '',
    excludeTime = '',
    minLeadMinutes = 0
) {
    if (!data || typeof data !== 'object') {
        return null;
    }

    const minLeadMs = Math.max(0, Number(minLeadMinutes) || 0) * 60 * 1000;
    const minAllowedUtcMs = Date.now() + minLeadMs;
    const days = Object.keys(data).sort();
    for (const day of days) {
        const slots = Array.isArray(data[day]) ? [...data[day]].sort() : [];
        for (const slot of slots) {
            if (day === excludeDate && slot === excludeTime) {
                continue;
            }
            const slotUtcMs = parseSlotToUtcMs(day, slot);
            if (Number.isFinite(slotUtcMs) && slotUtcMs < minAllowedUtcMs) {
                continue;
            }
            return { date: day, time: slot };
        }
    }

    return null;
}

test.describe('Google Calendar E2E write flow', () => {
    test('crea cita 60min, reprograma y limpia via admin', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);

        const writeEnabled = getEnv('TEST_ENABLE_CALENDAR_WRITE') === 'true';
        test.skip(
            !writeEnabled,
            'TEST_ENABLE_CALENDAR_WRITE=true es requerido para pruebas con escritura real.'
        );

        const healthResp = await request.get('/api.php?resource=health');
        expect(healthResp.ok()).toBeTruthy();
        const health = await healthResp.json();
        expect(health.ok).toBe(true);

        if (requireGoogleCalendar()) {
            expect(
                String(health.calendarSource),
                'TEST_REQUIRE_GOOGLE_CALENDAR=true pero calendarSource != google'
            ).toBe('google');
            expect(
                health.calendarReachable,
                'TEST_REQUIRE_GOOGLE_CALENDAR=true pero calendarReachable != true'
            ).toBe(true);
        } else {
            test.skip(
                String(health.calendarSource) !== 'google',
                'La agenda activa no es Google.'
            );
            test.skip(
                health.calendarReachable !== true,
                'Google Calendar no esta reachable.'
            );
        }

        const login = await adminLogin(request);
        test.skip(!login.ok, `No se pudo autenticar admin: ${login.reason}`);

        let appointmentId = null;

        try {
            const availabilityBeforeResp = await request.get(
                '/api.php?resource=availability&doctor=indiferente&service=laser&days=14'
            );
            expect(availabilityBeforeResp.ok()).toBeTruthy();
            const availabilityBefore = await availabilityBeforeResp.json();
            expect(availabilityBefore.ok).toBe(true);
            expect(availabilityBefore.meta.source).toBe('google');
            expect(Number(availabilityBefore.meta.durationMin)).toBe(60);

            const firstSlot = pickFirstSlot(
                availabilityBefore.data,
                '',
                '',
                70
            );
            expect(firstSlot).toBeTruthy();

            const stamp = Date.now();
            const createPayload = {
                service: 'laser',
                doctor: 'indiferente',
                date: firstSlot.date,
                time: firstSlot.time,
                name: `Test Calendar Write ${stamp}`,
                email: `calendar-write-${stamp}@example.com`,
                phone: '+593987654321',
                reason: 'Prueba automatizada de agenda real (laser 60 min)',
                privacyConsent: true,
                paymentMethod: 'cash',
            };

            const createResp = await request.post(
                '/api.php?resource=appointments',
                {
                    data: createPayload,
                }
            );
            expect(createResp.status(), await createResp.text()).toBe(201);

            const created = await createResp.json();
            expect(created.ok).toBe(true);
            expect(created.data).toBeTruthy();
            appointmentId = Number(created.data.id);
            expect(Number.isFinite(appointmentId)).toBe(true);
            expect(appointmentId).toBeGreaterThan(0);
            expect(String(created.data.calendarProvider)).toBe('google');
            expect(String(created.data.calendarId || '')).not.toBe('');
            expect(String(created.data.calendarEventId || '')).not.toBe('');
            expect(Number(created.data.slotDurationMin)).toBe(60);

            const assignedDoctor = String(created.data.doctor || '');
            expect(['rosero', 'narvaez']).toContain(assignedDoctor);

            const bookedAfterCreateResp = await request.get(
                `/api.php?resource=booked-slots&date=${encodeURIComponent(firstSlot.date)}&doctor=${encodeURIComponent(assignedDoctor)}&service=laser`
            );
            expect(bookedAfterCreateResp.ok()).toBeTruthy();
            const bookedAfterCreate = await bookedAfterCreateResp.json();
            expect(bookedAfterCreate.ok).toBe(true);
            expect(Array.isArray(bookedAfterCreate.data)).toBe(true);
            expect(bookedAfterCreate.data).toContain(firstSlot.time);

            const token = String(created.data.rescheduleToken || '');
            expect(token.length).toBeGreaterThanOrEqual(16);

            const availabilityForDoctorResp = await request.get(
                `/api.php?resource=availability&doctor=${encodeURIComponent(assignedDoctor)}&service=laser&days=21`
            );
            expect(availabilityForDoctorResp.ok()).toBeTruthy();
            const availabilityForDoctor =
                await availabilityForDoctorResp.json();
            expect(availabilityForDoctor.ok).toBe(true);

            const nextSlot = pickFirstSlot(
                availabilityForDoctor.data,
                firstSlot.date,
                firstSlot.time,
                70
            );
            expect(nextSlot).toBeTruthy();

            const rescheduleResp = await request.patch(
                '/api.php?resource=reschedule',
                {
                    data: {
                        token,
                        date: nextSlot.date,
                        time: nextSlot.time,
                    },
                }
            );
            expect(rescheduleResp.status(), await rescheduleResp.text()).toBe(
                200
            );
            const rescheduled = await rescheduleResp.json();
            expect(rescheduled.ok).toBe(true);
            expect(String(rescheduled.data.date)).toBe(nextSlot.date);
            expect(String(rescheduled.data.time)).toBe(nextSlot.time);
            expect(String(rescheduled.data.doctor)).toBe(assignedDoctor);
            expect(String(rescheduled.data.calendarProvider)).toBe('google');
            expect(String(rescheduled.data.calendarEventId || '')).not.toBe('');
            expect(Number(rescheduled.data.slotDurationMin)).toBe(60);

            const bookedAfterRescheduleResp = await request.get(
                `/api.php?resource=booked-slots&date=${encodeURIComponent(nextSlot.date)}&doctor=${encodeURIComponent(assignedDoctor)}&service=laser`
            );
            expect(bookedAfterRescheduleResp.ok()).toBeTruthy();
            const bookedAfterReschedule =
                await bookedAfterRescheduleResp.json();
            expect(bookedAfterReschedule.ok).toBe(true);
            expect(Array.isArray(bookedAfterReschedule.data)).toBe(true);
            expect(bookedAfterReschedule.data).toContain(nextSlot.time);
        } finally {
            if (appointmentId && Number.isFinite(appointmentId)) {
                const cancelResp = await request.patch(
                    '/api.php?resource=appointments',
                    {
                        headers: {
                            'X-CSRF-Token': login.csrfToken,
                        },
                        data: {
                            id: appointmentId,
                            status: 'cancelled',
                        },
                    }
                );

                expect(cancelResp.status(), await cancelResp.text()).toBe(200);
                const cancelBody = await cancelResp.json();
                expect(cancelBody.ok).toBe(true);
            }

            await request.post('/admin-auth.php?action=logout').catch(() => {});
        }
    });
});
