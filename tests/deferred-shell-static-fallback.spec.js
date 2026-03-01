const { test, expect } = require('@playwright/test');

test.describe('Deferred shell static fallback', () => {
    test('home keeps the Public V3 shell and booking bridge visible when legacy runtime fails to load', async ({
        page,
    }) => {
        await page.route('**/script.js**', (route) => route.abort());

        await page.goto('/es/', { waitUntil: 'domcontentloaded' });
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        await expect(page.locator('[data-public-nav]')).toBeVisible();
        await expect(page.locator('[data-stage-carousel]')).toBeVisible();

        const families = page.locator('[data-program-grid]');
        await expect(families).toBeVisible();
        await expect(families.locator('.program-grid__card')).toHaveCount(3);

        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
        await expect(page.locator('#appointmentForm')).toBeVisible();
    });
});
