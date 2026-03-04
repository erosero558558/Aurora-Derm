// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

function countCols(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

test.describe('Public V6 internal statement band', () => {
    test('service, tele, and legal surfaces expose statement band with media and narrative fields', async ({
        page,
    }) => {
        const routes = [
            '/es/servicios/diagnostico-integral/',
            '/es/telemedicina/',
            '/es/legal/terminos/',
        ];

        for (const route of routes) {
            await gotoPublicRoute(page, route);

            const band = page.locator('[data-v6-statement-band]').first();
            await expect(band).toBeVisible();
            await expect(band.locator('img')).toBeVisible();
            await expect(band.locator('p').first()).toBeVisible();
            await expect(band.locator('h2')).toBeVisible();
            await expect(band.locator('p').nth(1)).toBeVisible();
            await expect(band.locator('strong')).toBeVisible();

            const desktopCols = await band.evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
            expect(countCols(desktopCols)).toBe(2);
        }
    });

    test('statement band collapses to one column on mobile', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/servicios/diagnostico-integral/');

        const mobileCols = await page
            .locator('[data-v6-statement-band]')
            .first()
            .evaluate((node) => {
                return window.getComputedStyle(node).gridTemplateColumns;
            });
        expect(countCols(mobileCols)).toBe(1);
    });
});
