// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

test.describe('Public V6 internal surfaces', () => {
    test('telemedicine page renders dense internal initiatives and lead route block', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        await expect(page.locator('[data-v6-page-head]').first()).toBeVisible();
        await expect(page.locator('.v6-tele-kpis article')).toHaveCount(3);
        await expect(page.locator('[data-v6-tele-initiative]')).toHaveCount(4);
        await expect(
            page.locator('[data-v6-tele-initiative]').first().locator('img')
        ).toBeVisible();
        await expect(
            page.locator('[data-v6-tele-initiative]').first().locator('h3')
        ).toBeVisible();
        await expect(
            page.locator('[data-v6-tele-initiative]').first().locator('strong')
        ).toBeVisible();

        const leadVsStandardWidth = await page.evaluate(() => {
            const lead = document.querySelector(
                '.v6-tele-grid article.is-lead'
            );
            const regular = document.querySelector(
                '.v6-tele-grid article:not(.is-lead)'
            );
            const leadRect = lead ? lead.getBoundingClientRect() : null;
            const regularRect = regular
                ? regular.getBoundingClientRect()
                : null;
            return {
                leadWidth: leadRect ? leadRect.width : 0,
                regularWidth: regularRect ? regularRect.width : 0,
            };
        });

        expect(leadVsStandardWidth.leadWidth).toBeGreaterThan(
            leadVsStandardWidth.regularWidth * 1.5
        );
    });

    test('legal page exposes policy index cards and section cards', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/legal/terminos/');

        await expect(page.locator('#v6-legal-tabs a')).toHaveCount(4);
        await expect(page.locator('[data-v6-legal-index] a')).toHaveCount(4);
        await expect(
            page.locator('[data-v6-legal-index] a').first().locator('img')
        ).toBeVisible();
        await expect(
            page.locator('[data-v6-legal-index] a').first().locator('h3')
        ).toBeVisible();
        await expect(
            page.locator('[data-v6-legal-index] a').first().locator('strong')
        ).toBeVisible();
        await expect(page.locator('.v6-legal-sections article')).toHaveCount(2);
    });
});
