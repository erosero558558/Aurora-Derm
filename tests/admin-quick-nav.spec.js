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

test.describe('Admin navigation desktop', () => {
    test('sidebar keeps section and hash in sync', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        const primaryNav = page.locator('#adminPrimaryNav');
        await expect(primaryNav).toBeVisible();

        const availabilityNavItem = primaryNav.locator(
            '.nav-item[data-section="availability"]'
        );
        await availabilityNavItem.click();

        await expect(page.locator('#availability')).toHaveClass(/active/);
        await expect(page).toHaveURL(/#availability$/);
        await expect(availabilityNavItem).toHaveClass(/active/);
        await expect(availabilityNavItem).toHaveAttribute(
            'aria-current',
            'page'
        );
        await expect(page.locator('#pageTitle')).toHaveText('Horarios');
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

    test('quick command se abre con Ctrl+K y ejecuta acciones contextuales', async ({
        page,
    }) => {
        await setupAdminApiMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminCommandPalette')).toHaveClass(
            /is-hidden/
        );
        const commandInput = page.locator('#adminQuickCommand');

        await page.keyboard.press('Control+K');
        await expect(page.locator('#adminCommandPalette')).not.toHaveClass(
            /is-hidden/
        );
        await expect(commandInput).toBeFocused();

        await commandInput.fill('callbacks pendientes');
        await page.keyboard.press('Enter');

        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(
            page.locator(
                '.callback-quick-filter-btn[data-filter-value="pending"]'
            )
        ).toHaveClass(/is-active/);
        await expect(page.locator('#adminContextTitle')).toContainText(
            'Pendientes de contacto'
        );
        await expect(page.locator('#adminRefreshStatus')).toContainText(
            /Datos:/
        );
    });
});
