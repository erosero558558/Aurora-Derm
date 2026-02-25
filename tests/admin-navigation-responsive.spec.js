// @ts-check
const { test, expect } = require('@playwright/test');

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
});
