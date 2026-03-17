// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

test.describe('Public V6 news strip', () => {
    test('news strip appears below hero with left-right hierarchy', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForHomeV6Runtime(page);

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

    test('news strip expands detail copy and collapses back into the row', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForHomeV6Runtime(page);

        const strip = page.locator('[data-v6-news-strip]').first();
        const toggle = strip.locator('[data-v6-news-toggle]').first();
        const panel = strip.locator('[data-v6-news-panel]').first();

        await expect(panel).toBeHidden();
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(strip).toHaveAttribute('data-v6-expanded', 'true');
        await expect(panel).toBeVisible();
        await expect(panel).toContainText(
            'La agenda online sigue en mantenimiento'
        );
        await expect(
            panel.locator('a[href="https://wa.me/593982453672"]')
        ).toBeVisible();

        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(strip).toHaveAttribute('data-v6-expanded', 'false');
        await expect(panel).toBeHidden();
    });

    test('language switch is routed for opposite locale', async ({ page }) => {
        await gotoPublicRoute(page, '/en/');
        await waitForHomeV6Runtime(page);

        const link = page
            .locator('[data-v6-news-strip] .v6-news-strip__lang')
            .first();
        await expect(link).toHaveAttribute('href', /\/es\//);
    });
});
