// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');

test.use({ serviceWorkers: 'block' });

function toLocalDateKey(date) {
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
    const dateValue = toLocalDateKey(targetDate);

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
    await installLegacyAdminAuthMock(page);

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

    const slotDay = page
        .locator('#availabilityCalendar .calendar-day.has-slots')
        .first();
    if ((await slotDay.count()) > 0) {
        await expect(slotDay).toBeVisible();
        await slotDay.click();
        return;
    }

    const anyDay = page
        .locator('#availabilityCalendar .calendar-day:not(.other-month)')
        .first();
    await expect(anyDay).toBeVisible();
    await anyDay.click();
}

test.describe('Admin disponibilidad: modo Google solo lectura', () => {
    test('aplica modo de edicion segun fuente de disponibilidad', async ({
        page,
    }) => {
        await setupAdminApiMocks(page, 'google');
        await openAvailabilitySection(page);

        const heading = page
            .locator('#availability .availability-calendar h3')
            .first();
        const syncStatus = page.locator('#availabilitySyncStatus').first();
        const addSlotForm = page.locator('#addSlotForm').first();

        await expect(syncStatus).toBeVisible();
        await expect(syncStatus).toContainText('Google Calendar');
        await expect(heading).toContainText('Solo lectura');
        await expect(addSlotForm).toHaveClass(/is-hidden/);
    });

    test('en fuente local habilita formulario de horarios', async ({
        page,
    }) => {
        await setupAdminApiMocks(page, 'store');
        await openAvailabilitySection(page);

        await expect(
            page.locator('#availability .availability-calendar h3')
        ).toContainText('Calendario de disponibilidad');
        await expect(page.locator('#addSlotForm')).not.toHaveClass(/is-hidden/);
        await expect(page.locator('#timeSlotsList')).not.toContainText(
            'Solo lectura'
        );
    });

    test('muestra el mes actual y evita hardcode de calendario', async ({
        page,
    }) => {
        await setupAdminApiMocks(page, 'google');
        await openAvailabilitySection(page);

        const label = page.locator('#calendarMonth').first();
        await expect(label).toBeVisible();

        const currentMonth = new Intl.DateTimeFormat('es-EC', {
            month: 'long',
        })
            .format(new Date())
            .toLowerCase();
        const currentYear = String(new Date().getFullYear());
        const text = ((await label.textContent()) || '').trim().toLowerCase();

        expect(text).toContain(currentMonth);
        expect(text).toContain(currentYear);
        expect(text).not.toContain('enero 2024');
    });
});
