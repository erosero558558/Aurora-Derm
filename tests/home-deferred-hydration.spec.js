// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

test.describe('Home deferred hydration', () => {
    test('keeps the V6 shell visible and boots the V6 runtime helpers on home', async ({
        page,
    }) => {
        await page.goto('/es/');
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expect(page.locator('[data-v6-hero]')).toBeVisible();
        await expect(page.locator('[data-v6-editorial]')).toBeVisible();
        await expect(page.locator('[data-v6-corporate-matrix]')).toBeVisible();
        await expect(page.locator('[data-v6-booking-status]')).toBeVisible();
        await expectNoLegacyPublicShell(page);
        await waitForHomeV6Runtime(page);

        await expect
            .poll(
                async () =>
                    page.evaluate(
                        () =>
                            document
                                .querySelector('[data-v6-hero]')
                                ?.getAttribute('data-v6-state') || ''
                    ),
                { timeout: 15000 }
            )
            .toMatch(/^(playing|paused)$/);
    });
});
