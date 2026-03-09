// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

function countCols(value) {
    return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

test.describe('Public V6 internal geometry', () => {
    test('service internal message and detail geometry are aligned on desktop', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/diagnostico-integral/');

        const message = page.locator('[data-v6-internal-message]').first();
        await expect(message).toBeVisible();

        const geometry = await page.evaluate(() => {
            const msg = document.querySelector('[data-v6-internal-message]');
            const detail = document.querySelector('.v6-service-detail');
            const msgRect = msg ? msg.getBoundingClientRect() : null;
            const detailStyle = detail ? window.getComputedStyle(detail) : null;
            return {
                messageWidth: msgRect ? msgRect.width : 0,
                detailCols: detailStyle ? detailStyle.gridTemplateColumns : '',
                detailGap: detailStyle ? detailStyle.gap : '',
            };
        });

        expect(geometry.messageWidth).toBeGreaterThanOrEqual(900);
        expect(geometry.messageWidth).toBeLessThanOrEqual(1110);
        expect(countCols(geometry.detailCols)).toBe(2);
        expect(Number.parseFloat(geometry.detailGap)).toBeGreaterThanOrEqual(
            24
        );
    });

    test('tele initiatives maintain tall editorial cards', async ({ page }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        const cards = page.locator('[data-v6-tele-initiative]');
        await expect(cards).toHaveCount(4);

        const minHeight = await cards.first().evaluate((node) => {
            return Number.parseFloat(
                window.getComputedStyle(node).minHeight || '0'
            );
        });
        expect(minHeight).toBeGreaterThanOrEqual(340);
    });

    test('legal tabs stay sticky and clauses keep two-digit numbering', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/legal/terminos/');

        const sticky = await page.locator('#v6-legal-tabs').evaluate((node) => {
            const style = window.getComputedStyle(node);
            return {
                position: style.position,
                top: Number.parseFloat(style.top || '0'),
            };
        });
        expect(sticky.position).toBe('sticky');
        expect(sticky.top).toBeGreaterThanOrEqual(68);
        expect(sticky.top).toBeLessThanOrEqual(90);

        const labels = await page
            .locator('.v6-legal-sections li span')
            .allTextContents();
        expect(labels.length).toBeGreaterThan(1);
        expect(labels[0]).toMatch(/^\d{2}$/);
    });

    test('service and legal internal grids collapse to one column on mobile', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/servicios/diagnostico-integral/');

        const serviceCols = await page
            .locator('.v6-service-detail')
            .evaluate((node) => {
                return window.getComputedStyle(node).gridTemplateColumns;
            });
        expect(countCols(serviceCols)).toBe(1);

        await gotoPublicRoute(page, '/es/legal/terminos/');
        const legalCols = await page
            .locator('.v6-legal-sections')
            .evaluate((node) => {
                return window.getComputedStyle(node).gridTemplateColumns;
            });
        expect(countCols(legalCols)).toBe(1);
    });
});
