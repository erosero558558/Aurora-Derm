// @ts-check
const { test, expect } = require('@playwright/test');
const { installLegacyAdminAuthMock } = require('./helpers/admin-auth-mocks');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 900, height: 900 },
});

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildDataPayload() {
    return {
        ok: true,
        data: {
            appointments: [],
            callbacks: [],
            reviews: [],
            availability: {},
            availabilityMeta: {
                source: 'store',
                mode: 'live',
                timezone: 'America/Guayaquil',
                calendarConfigured: true,
                calendarReachable: true,
                generatedAt: new Date().toISOString(),
            },
        },
    };
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

async function setupAdminApiMocks(page) {
    await installLegacyAdminAuthMock(page);

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'data') {
            return jsonResponse(route, buildDataPayload());
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, buildFunnelPayload());
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: {},
                meta: buildDataPayload().data.availabilityMeta,
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

test.describe('Admin navigation responsive (tablet)', () => {
    test('sidebar compacto mantiene trap de foco y cierra con Escape', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminMenuToggle')).toBeVisible();

        await page.locator('#adminMenuToggle').click();

        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);
        await expect(page.locator('#adminSidebarBackdrop')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminMenuToggle')).toHaveAttribute(
            'aria-expanded',
            'true'
        );
        await expect(
            page.locator('#adminSidebar .nav-item.active')
        ).toBeFocused();

        await page.keyboard.press('Shift+Tab');
        await expect(page.locator('#adminMenuClose')).toBeFocused();

        await page.keyboard.press('Shift+Tab');
        await expect(page.locator('.logout-btn')).toBeFocused();

        await page.keyboard.press('Tab');
        await expect(page.locator('#adminMenuClose')).toBeFocused();

        await page.keyboard.press('Escape');

        await expect(page.locator('#adminSidebar')).not.toHaveClass(/is-open/);
        await expect(page.locator('#adminSidebarBackdrop')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#adminMenuToggle')).toHaveAttribute(
            'aria-expanded',
            'false'
        );
        await expect(page.locator('#adminMenuToggle')).toBeFocused();
    });

    test('navegar desde sidebar compacto actualiza hash y cierra overlay', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('#adminMenuToggle').click();
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        await page
            .locator('#adminSidebar .nav-item[data-section="appointments"]')
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(
            page.locator('#adminSidebar .nav-item[data-section="appointments"]')
        ).toHaveAttribute('aria-current', 'page');
        await expect(page).toHaveURL(/#appointments$/);
        await expect(page.locator('#adminSidebar')).not.toHaveClass(/is-open/);
        await expect(page.locator('#adminMenuToggle')).toHaveAttribute(
            'aria-expanded',
            'false'
        );
    });

    test('bloquea salida de disponibilidad con borrador pendiente hasta confirmar', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await page.locator('#adminMenuToggle').click();
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        await page
            .locator('#adminSidebar .nav-item[data-section="availability"]')
            .click();
        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);

        const anyCalendarDay = page
            .locator('#availabilityCalendar .calendar-day:not(.other-month)')
            .first();
        await expect(anyCalendarDay).toBeVisible();
        await anyCalendarDay.click();
        await page
            .locator(
                '#availabilityQuickSlotPresets .slot-preset-btn[data-time="09:00"]'
            )
            .click();
        await page.locator('[data-action="add-time-slot"]').click();
        await expect(
            page.locator('#timeSlotsList .time-slot-item')
        ).toHaveCount(1);
        await expect(page.locator('#availabilitySaveDraftBtn')).toBeEnabled();
        await expect(page.locator('#availabilityDraftStatus')).toContainText(
            'cambios pendientes'
        );

        await page.locator('#adminMenuToggle').click();
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        let dismissedNavigationPrompt = false;
        page.once('dialog', async (dialog) => {
            dismissedNavigationPrompt = true;
            expect(dialog.message()).toContain('cambios pendientes');
            await dialog.dismiss();
        });

        await page
            .locator('#adminSidebar .nav-item[data-section="appointments"]')
            .click();
        expect(dismissedNavigationPrompt).toBe(true);

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        let acceptedNavigationPrompt = false;
        page.once('dialog', async (dialog) => {
            acceptedNavigationPrompt = true;
            await dialog.accept();
        });

        await page
            .locator('#adminSidebar .nav-item[data-section="appointments"]')
            .click();
        expect(acceptedNavigationPrompt).toBe(true);

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#appointments$/);
        await expect(page.locator('#adminSidebar')).not.toHaveClass(/is-open/);
    });
});
