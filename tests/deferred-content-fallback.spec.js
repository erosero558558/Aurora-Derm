const { test, expect } = require('@playwright/test');
const { expectNoLegacyPublicShell } = require('./helpers/public-v6');

test.describe('Deferred content fallback', () => {
    test('keeps the statically rendered V6 surface visible if the V6 runtime script fails', async ({
        page,
    }) => {
        await page.route('**/js/public-v6-shell.js*', (route) => route.abort());

        await page.goto('/es/', { waitUntil: 'domcontentloaded' });
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expect(page.locator('[data-v6-hero]')).toBeVisible();
        expect(
            await page.locator('[data-v6-slide]').count()
        ).toBeGreaterThanOrEqual(3);
        await expect(page.locator('[data-v6-news-strip]')).toBeVisible();
        expect(
            await page
                .locator('[data-v6-editorial] .v6-editorial__card')
                .count()
        ).toBeGreaterThanOrEqual(4);
        expect(
            await page
                .locator(
                    '[data-v6-corporate-matrix] .v6-corporate-matrix__card'
                )
                .count()
        ).toBeGreaterThanOrEqual(3);
        await expect(page.locator('[data-v6-booking-status]')).toBeVisible();
        await expectNoLegacyPublicShell(page);
    });
});
