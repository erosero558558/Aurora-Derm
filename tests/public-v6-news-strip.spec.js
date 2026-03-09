// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 news strip', () => {
    test('news strip appears below hero with left-right hierarchy', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const hero = page.locator('[data-v6-hero]').first();
        const strip = page.locator('[data-v6-news-strip]').first();

        await expect(strip).toBeVisible();
        await expect(strip.locator('.v6-news-strip__left')).toBeVisible();
        await expect(strip.locator('.v6-news-strip__right')).toBeVisible();
        await expect(strip.locator('.v6-news-strip__lang')).toBeVisible();

        const heroBox = await hero.boundingBox();
        const stripBox = await strip.boundingBox();
        expect(heroBox).not.toBeNull();
        expect(stripBox).not.toBeNull();
        expect(stripBox.y).toBeGreaterThan(heroBox.y);
    });

    test('language switch is routed for opposite locale', async ({ page }) => {
        await gotoPublicRoute(page, '/en/');

        const link = page
            .locator('[data-v6-news-strip] .v6-news-strip__lang')
            .first();
        await expect(link).toHaveAttribute('href', /\/es\//);
    });
});
