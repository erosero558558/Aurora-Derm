// @ts-check
const { test, expect } = require('@playwright/test');

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

async function setupVariantBootstrapMocks(page, featureFlagValue) {
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();
        if (action === 'status') {
            return jsonResponse(route, {
                ok: true,
                authenticated: false,
            });
        }
        return jsonResponse(route, { ok: true });
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = String(
            url.searchParams.get('resource') || ''
        ).toLowerCase();

        if (resource === 'features') {
            if (featureFlagValue === null) {
                return jsonResponse(
                    route,
                    { ok: false, error: 'unavailable' },
                    503
                );
            }
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: featureFlagValue === true,
                },
            });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function expectResolvedVariant(page, variant) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ui',
        variant
    );
}

test.describe('Admin UI variant loader', () => {
    test('query=legacy overrides storage and feature flag', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v2');
        });
        await setupVariantBootstrapMocks(page, true);

        await page.goto('/admin.html?admin_ui=legacy');
        await expectResolvedVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('legacy');
    });

    test('query=sony_v2 is blocked when feature kill-switch is off', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'legacy');
        });
        await setupVariantBootstrapMocks(page, false);

        await page.goto('/admin.html?admin_ui=sony_v2');
        await expectResolvedVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('legacy');
    });

    test('stored sony_v2 is forced to legacy when feature kill-switch is off', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v2');
        });
        await setupVariantBootstrapMocks(page, false);

        await page.goto('/admin.html');
        await expectResolvedVariant(page, 'legacy');
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('legacy');
    });

    test('admin_ui_reset=1 clears storage and keeps query override session-only', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v2');
        });
        await setupVariantBootstrapMocks(page, false);

        await page.goto('/admin.html?admin_ui=legacy&admin_ui_reset=1');
        await expectResolvedVariant(page, 'legacy');
        await expect(page).toHaveURL(/\/admin\.html\?admin_ui=legacy$/);
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe(null);
    });

    test('admin_ui_reset=1 clears storage and uses fallback legacy when feature is off', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'sony_v2');
        });
        await setupVariantBootstrapMocks(page, false);

        await page.goto('/admin.html?admin_ui_reset=1');
        await expectResolvedVariant(page, 'legacy');
        await expect(page).toHaveURL(/\/admin\.html$/);
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe(null);
    });

    test('admin_ui_reset=1 still allows canary auto-enable when feature is on', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminUiVariant', 'legacy');
        });
        await setupVariantBootstrapMocks(page, true);

        await page.goto('/admin.html?admin_ui_reset=1');
        await expectResolvedVariant(page, 'sony_v2');
        await expect(page).toHaveURL(/\/admin\.html(?:#dashboard)?$/);
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('sony_v2');
    });

    test('feature flag enables sony_v2 when no query and no storage variant', async ({
        page,
    }) => {
        await setupVariantBootstrapMocks(page, true);

        await page.goto('/admin.html');
        await expectResolvedVariant(page, 'sony_v2');
        await expect(page.locator('body')).toHaveClass(/admin-v2-mode/);
        await expect
            .poll(() =>
                page.evaluate(() => localStorage.getItem('adminUiVariant'))
            )
            .toBe('sony_v2');
    });

    test('loader falls back to legacy when features endpoint is unavailable', async ({
        page,
    }) => {
        await setupVariantBootstrapMocks(page, null);

        await page.goto('/admin.html');
        await expectResolvedVariant(page, 'legacy');
    });
});
