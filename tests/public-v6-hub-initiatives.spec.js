// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 hub initiatives matrix', () => {
    test('hub renders initiatives matrix with dense editorial cards', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/');

        const block = page.locator('[data-v6-hub-initiatives]').first();
        await expect(block).toBeVisible();
        await expect(
            block.locator('[data-v6-hub-initiative-card]')
        ).toHaveCount(8);
        await expect(
            block
                .locator('[data-v6-hub-initiative-card]')
                .first()
                .locator('img')
        ).toBeVisible();
        await expect(
            block.locator('[data-v6-hub-initiative-card]').first().locator('h3')
        ).toBeVisible();
        await expect(
            block
                .locator('[data-v6-hub-initiative-card]')
                .first()
                .locator('strong')
        ).toBeVisible();
    });

    test('initiatives grid keeps 4 cols desktop and 1 col mobile', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/services/');

        const desktopCols = await page
            .locator('.v6-hub-initiatives__grid')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
        expect(desktopCols.trim().split(/\s+/).filter(Boolean).length).toBe(4);

        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/en/services/');
        const mobileCols = await page
            .locator('.v6-hub-initiatives__grid')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
        expect(mobileCols.trim().split(/\s+/).filter(Boolean).length).toBe(1);
    });
});
