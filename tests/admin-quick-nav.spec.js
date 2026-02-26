// @ts-check
const { test, expect } = require('@playwright/test');

test.use({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 900 },
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
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

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

test.describe('Admin quick nav desktop', () => {
    test('quick nav keeps section and hash in sync with sidebar', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        const quickNav = page.locator('[data-qa="admin-quick-nav"]');
        await expect(quickNav).toBeVisible();

        const availabilityQuickItem = quickNav.locator(
            '.admin-quick-nav-item[data-section="availability"]'
        );
        await availabilityQuickItem.click();

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
        await expect(availabilityQuickItem).toHaveClass(/active/);
        await expect(availabilityQuickItem).toHaveAttribute(
            'aria-pressed',
            'true'
        );
        await expect(
            page.locator('.nav-item[data-section="availability"]')
        ).toHaveAttribute('aria-current', 'page');
    });

    test('keyboard shortcuts navigate sections but ignore focused inputs', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await page.keyboard.press('Alt+Shift+Digit2');
        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#appointments$/);

        await page.locator('#searchAppointments').click();
        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#appointments')).toHaveClass(/active/);

        await page.locator('#pageTitle').click();
        await page.keyboard.press('Alt+Shift+Digit5');
        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
    });
});
