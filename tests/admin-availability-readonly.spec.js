// @ts-check
const { test, expect } = require('@playwright/test');

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildFunnelPayload() {
    return {
        ok: true,
        data: {
            summary: {
                viewBooking: 0,
                startCheckout: 0,
                bookingConfirmed: 0,
                checkoutAbandon: 0,
                startRatePct: 0,
                confirmedRatePct: 0,
                abandonRatePct: 0,
            },
            checkoutAbandonByStep: [],
            checkoutEntryBreakdown: [],
            paymentMethodBreakdown: [],
            bookingStepBreakdown: [],
            sourceBreakdown: [],
            abandonReasonBreakdown: [],
            errorCodeBreakdown: [],
        },
    };
}

function buildDataPayload(sourceMode) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 3);
    const dateValue = targetDate.toISOString().split('T')[0];

    const source = sourceMode === 'google' ? 'google' : 'store';
    const mode = sourceMode === 'google' ? 'live' : 'live';

    return {
        ok: true,
        data: {
            appointments: [],
            callbacks: [],
            reviews: [],
            availability: {
                [dateValue]: ['10:00', '10:30'],
            },
            availabilityMeta: {
                source,
                mode,
                timezone: 'America/Guayaquil',
                calendarAuth:
                    sourceMode === 'google' ? 'oauth_refresh' : 'none',
                calendarConfigured: true,
                calendarReachable: true,
                calendarLastSuccessAt: new Date().toISOString(),
                calendarLastErrorAt: '',
                calendarLastErrorReason: '',
                doctorCalendars: {
                    rosero: {
                        idMasked: 'rose***1234',
                        openUrl:
                            'https://calendar.google.com/calendar/u/0/r?cid=rosero%40group.calendar.google.com',
                    },
                    narvaez: {
                        idMasked: 'narv***5678',
                        openUrl:
                            'https://calendar.google.com/calendar/u/0/r?cid=narvaez%40group.calendar.google.com',
                    },
                },
                generatedAt: new Date().toISOString(),
            },
        },
    };
}

async function setupAdminApiMocks(page, sourceMode) {
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = url.searchParams.get('action') || '';

        if (action === 'status') {
            return jsonResponse(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_test_token',
            });
        }

        return jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        });
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'data') {
            return jsonResponse(route, buildDataPayload(sourceMode));
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: buildDataPayload(sourceMode).data.availability,
                meta: buildDataPayload(sourceMode).data.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openAvailabilitySection(page) {
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();

    await page.locator('.nav-item[data-section="availability"]').click();
    await expect(page.locator('#availability')).toHaveClass(/active/);
    await expect(page.locator('#availabilityCalendar .calendar-day.has-slots').first()).toBeVisible();
    await page.locator('#availabilityCalendar .calendar-day.has-slots').first().click();
}

test.describe('Admin disponibilidad: modo Google solo lectura', () => {
    test.use({ serviceWorkers: 'block' });

    test('muestra estado Google y bloquea edicion local', async ({ page }) => {
        await setupAdminApiMocks(page, 'google');
        await openAvailabilitySection(page);

        await expect(
            page.locator('#availability .availability-calendar h3')
        ).toContainText('Solo lectura');
        await expect(page.locator('#availabilitySyncStatus')).toContainText(
            'Google Calendar'
        );
        await expect(page.locator('#addSlotForm')).toHaveClass(/is-hidden/);
        await expect(page.locator('#timeSlotsList')).toContainText(
            'Solo lectura'
        );
    });

    test('en fuente local habilita formulario de horarios', async ({ page }) => {
        await setupAdminApiMocks(page, 'store');
        await openAvailabilitySection(page);

        await expect(
            page.locator('#availability .availability-calendar h3')
        ).toContainText('Configurar Horarios Disponibles');
        await expect(page.locator('#addSlotForm')).not.toHaveClass(/is-hidden/);
        await expect(page.locator('#timeSlotsList')).not.toContainText(
            'Solo lectura'
        );
    });
});
