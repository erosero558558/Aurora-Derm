// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 editorial grid', () => {
    test('desktop grid renders mixed cards with atmospheric background', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const section = page.locator('[data-v6-editorial]').first();
        await expect(section).toBeVisible();

        const cards = section.locator('.v6-editorial__card');
        await expect(cards).toHaveCount(6);
        await expect(
            section.locator('.v6-editorial__card.is-video')
        ).toHaveCount(3);

        const bg = await section.evaluate(
            (node) => window.getComputedStyle(node).backgroundImage
        );
        expect(bg).toContain('gradient');
    });

    test('mobile grid collapses to one column', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/en/');

        const template = await page
            .locator('.v6-editorial__grid')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );

        expect(template.trim().split(/\s+/).filter(Boolean).length).toBe(1);
    });
});
