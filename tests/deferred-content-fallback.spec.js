const { test, expect } = require('@playwright/test');

test.describe('Deferred content fallback', () => {
    test('keeps the Public V3 shell and booking bridge visible if public runtime config API fails', async ({
        page,
    }) => {
        await page.route(
            '**/api.php?resource=public-runtime-config**',
            (route) => route.abort()
        );

        await page.goto('/es/', { waitUntil: 'domcontentloaded' });
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        const stage = page.locator('[data-stage-carousel]');
        await expect(stage).toBeVisible();

        const families = page.locator('[data-program-grid]');
        await expect(families).toBeVisible();
        await expect(families.locator('.program-grid__card')).toHaveCount(3);

        const featuredStories = page.locator('[data-featured-story]');
        await expect(featuredStories).toBeVisible();
        await expect(featuredStories.locator('.featured-story')).toHaveCount(3);

        await expect(page.locator('#appointmentForm')).toBeVisible();
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
    });
});
