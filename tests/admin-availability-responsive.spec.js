// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 960, height: 900 },
});

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
                source: sourceMode === 'google' ? 'google' : 'store',
                mode: 'live',
                timezone: 'America/Guayaquil',
                calendarConfigured: true,
                calendarReachable: true,
                calendarAuth:
                    sourceMode === 'google' ? 'oauth_refresh' : 'none',
                generatedAt: new Date().toISOString(),
                calendarLastSuccessAt: new Date().toISOString(),
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
            },
        },
    };
}

async function setupAdminApiMocks(page, sourceMode) {
    const dataPayload = buildDataPayload(sourceMode);
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
        if (resource === 'data') return jsonResponse(route, dataPayload);
        if (resource === 'funnel-metrics')
            return jsonResponse(route, buildFunnelPayload());
        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: dataPayload.data.availability,
                meta: dataPayload.data.availabilityMeta,
            });
        }
        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function openAvailabilitySection(page, sourceMode = 'store') {
    await setupAdminApiMocks(page, sourceMode);
    await page.goto('/admin.html');
    await expect(page.locator('#adminDashboard')).toBeVisible();

    const menuToggle = page.locator('#adminMenuToggle');
    if (await menuToggle.isVisible()) {
        await menuToggle.click();
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);
    }

    await page.locator('.nav-item[data-section="availability"]').click();
    await expect(page.locator('#availability')).toHaveClass(/active/);

    const slotDay = page
        .locator('#availabilityCalendar .calendar-day.has-slots')
        .first();
    await expect(slotDay).toBeVisible();
    await slotDay.click();
}

test.describe('Admin availability responsive tablet layout', () => {
    test('muestra layout tablet de detalle y helpers de edicion en fuente local', async ({
        page,
    }) => {
        await openAvailabilitySection(page, 'store');

        const outerGridColumns = await page
            .locator('#availability .availability-container')
            .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        const detailGridColumns = await page
            .locator('#availabilityDetailGrid')
            .evaluate((el) => getComputedStyle(el).gridTemplateColumns);

        expect(
            outerGridColumns.trim().split(/\s+/).filter(Boolean).length
        ).toBe(1);
        expect(
            detailGridColumns.trim().split(/\s+/).filter(Boolean).length
        ).toBeGreaterThan(1);

        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Fuente: Local');
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Modo: Editable');
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Slots: 2');

        await expect(
            page.locator('#availabilityQuickSlotPresets')
        ).toBeVisible();
        await page
            .locator(
                '#availabilityQuickSlotPresets .slot-preset-btn[data-time="16:30"]'
            )
            .click();
        await expect(page.locator('#newSlotTime')).toHaveValue('16:30');

        await page
            .locator(
                '#availability .calendar-header [data-action="change-month"][data-delta="1"]'
            )
            .click();
        await page
            .locator(
                '#availability .calendar-header [data-action="availability-today"]'
            )
            .click();

        const currentMonth = new Intl.DateTimeFormat('es-EC', {
            month: 'long',
        })
            .format(new Date())
            .toLowerCase();
        const currentYear = String(new Date().getFullYear());
        const monthLabel = (
            (await page.locator('#calendarMonth').textContent()) || ''
        )
            .trim()
            .toLowerCase();

        expect(monthLabel).toContain(currentMonth);
        expect(monthLabel).toContain(currentYear);
    });

    test('mantiene resumen claro y oculta presets en modo solo lectura google', async ({
        page,
    }) => {
        await openAvailabilitySection(page, 'google');

        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Fuente: Google Calendar');
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText('Modo: Solo lectura');
        await expect(page.locator('#addSlotForm')).toHaveClass(/is-hidden/);
        await expect(page.locator('#availabilityQuickSlotPresets')).toHaveClass(
            /is-hidden/
        );
    });
});
