// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 hub featured matrix', () => {
    test('hub exposes featured block with 3 cards and complete card fields', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/');

        const block = page.locator('[data-v6-hub-featured]').first();
        await expect(block).toBeVisible();
        await expect(block.locator('[data-v6-hub-featured-card]')).toHaveCount(
            3
        );

        const first = block.locator('[data-v6-hub-featured-card]').first();
        await expect(first.locator('img')).toBeVisible();
        await expect(first.locator('h3')).toBeVisible();
        await expect(first.locator('p')).toHaveCount(2);
        await expect(first.locator('strong')).toBeVisible();
    });

    test('featured grid keeps 3 columns desktop, appears in page menu, and collapses to 1 column mobile', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/services/');

        const desktopCols = await page
            .locator('.v6-hub-featured__grid')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
        expect(desktopCols.trim().split(/\s+/).filter(Boolean).length).toBe(3);

        await page.locator('[data-v6-page-menu]').click();
        const featuredLink = page.locator(
            '[data-v6-page-menu-panel] [data-v6-page-menu-link][href$="#v6-hub-featured"]'
        );
        await expect(featuredLink).toBeVisible();

        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/en/services/');
        const mobileCols = await page
            .locator('.v6-hub-featured__grid')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
        expect(mobileCols.trim().split(/\s+/).filter(Boolean).length).toBe(1);
    });
});
