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
    if ((await slotDay.count()) > 0) {
        await expect(slotDay).toBeVisible();
        await slotDay.click();
        return { usedSlotDay: true };
    }

    const anyDay = page
        .locator('#availabilityCalendar .calendar-day:not(.other-month)')
        .first();
    await expect(anyDay).toBeVisible();
    await anyDay.click();
    return { usedSlotDay: false };
}

async function ensureAtLeastOneSelectedSlot(page) {
    const slotItems = page.locator('#timeSlotsList .time-slot-item');
    const currentCount = await slotItems.count();
    if (currentCount > 0) {
        return currentCount;
    }

    await page
        .locator(
            '#availabilityQuickSlotPresets .slot-preset-btn[data-time="09:00"]'
        )
        .click();
    await page.locator('[data-action="add-time-slot"]').click();
    await expect(slotItems).toHaveCount(1);
    return 1;
}

function acceptNextDialog(page) {
    page.once('dialog', async (dialog) => {
        await dialog.accept();
    });
}

function getExpectedSlotsSummaryText(usedSlotDay) {
    return usedSlotDay ? 'Slots: 2' : 'Slots:';
}

test.describe('Admin availability responsive tablet layout', () => {
    test('muestra layout tablet de detalle y helpers de edicion en fuente local', async ({
        page,
    }) => {
        const { usedSlotDay } = await openAvailabilitySection(page, 'store');

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
        ).toContainText('Slots:');
        await expect(
            page.locator('#availabilitySelectionSummary')
        ).toContainText(getExpectedSlotsSummaryText(usedSlotDay));

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
        await expect(page.locator('#availabilityDayActions')).toBeVisible();
        await expect(
            page.locator('#availabilityDayActionsStatus')
        ).toContainText('Edicion bloqueada');
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="paste-availability-day"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="duplicate-availability-day-next"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="duplicate-availability-next-week"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="clear-availability-day"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator(
                '#availabilityDayActions [data-action="clear-availability-week"]'
            )
        ).toBeDisabled();
        await expect(page.locator('#availabilitySaveDraftBtn')).toBeDisabled();
        await expect(
            page.locator('#availabilityDiscardDraftBtn')
        ).toBeDisabled();
    });

    test('permite copiar y gestionar borrador con guardar/descartar en disponibilidad', async ({
        page,
    }) => {
        await openAvailabilitySection(page, 'store');

        const slotItems = page.locator('#timeSlotsList .time-slot-item');
        const initialSelectedDateText = await page
            .locator('#selectedDate')
            .textContent();
        await expect(page.locator('#availabilityDraftStatus')).toBeVisible();
        const initialCount = await ensureAtLeastOneSelectedSlot(page);
        expect(initialCount).toBeGreaterThan(0);

        await page
            .locator(
                '#availabilityDayActions [data-action="copy-availability-day"]'
            )
            .click();
        await expect(
            page.locator('#availabilityDayActionsStatus')
        ).toContainText('Portapapeles:');

        await page
            .locator(
                '#availabilityDayActions [data-action="duplicate-availability-day-next"]'
            )
            .click();
        await expect(page.locator('#selectedDate')).not.toHaveText(
            initialSelectedDateText || ''
        );
        await expect(slotItems).toHaveCount(initialCount);
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );
        await expect(page.locator('#availabilitySaveDraftBtn')).toBeEnabled();

        await page.locator('#availabilitySaveDraftBtn').click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'Sin cambios pendientes'
        );
        await expect(page.locator('#availabilitySaveDraftBtn')).toBeDisabled();

        acceptNextDialog(page);
        await page
            .locator(
                '#availabilityDayActions [data-action="clear-availability-day"]'
            )
            .click();
        await expect(slotItems).toHaveCount(0);
        await expect(page.locator('#timeSlotsList')).toContainText(
            'No hay horarios configurados'
        );
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );

        acceptNextDialog(page);
        await page.locator('#availabilityDiscardDraftBtn').click();
        await expect(slotItems).toHaveCount(initialCount);
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'Sin cambios pendientes'
        );
    });

    test('habilita acciones de bloque de 7 dias y las persiste al guardar', async ({
        page,
    }) => {
        await openAvailabilitySection(page, 'store');
        const slotItems = page.locator('#timeSlotsList .time-slot-item');
        const initialCount = await ensureAtLeastOneSelectedSlot(page);
        expect(initialCount).toBeGreaterThan(0);

        await page
            .locator(
                '#availabilityDayActions [data-action="duplicate-availability-next-week"]'
            )
            .click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );
        await expect(
            page.locator('#availabilityDiscardDraftBtn')
        ).toBeEnabled();

        await page.locator('#availabilitySaveDraftBtn').click();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'Sin cambios pendientes'
        );

        acceptNextDialog(page);
        await page
            .locator(
                '#availabilityDayActions [data-action="clear-availability-week"]'
            )
            .click();
        await expect(slotItems).toHaveCount(0);
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );
    });
});
