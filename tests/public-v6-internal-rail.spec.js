// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 internal thesis and rail', () => {
    test('service and tele pages expose sticky internal rails with full anchor maps', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/diagnostico-integral/');

        const serviceRail = page.locator('[data-v6-internal-rail]').first();
        await expect(serviceRail).toBeVisible();
        await expect(serviceRail.locator('a')).toHaveCount(6);

        const serviceRailSticky = await serviceRail.evaluate((node) => {
            const style = window.getComputedStyle(node);
            return {
                position: style.position,
                top: Number.parseFloat(style.top || '0'),
            };
        });
        expect(serviceRailSticky.position).toBe('sticky');
        expect(serviceRailSticky.top).toBeGreaterThanOrEqual(140);
        expect(serviceRailSticky.top).toBeLessThanOrEqual(180);

        await gotoPublicRoute(page, '/es/telemedicina/');
        const teleRail = page.locator('[data-v6-internal-rail]').first();
        await expect(teleRail).toBeVisible();
        await expect(teleRail.locator('a')).toHaveCount(5);
    });

    test('service, tele, and legal pages expose thesis block', async ({
        page,
    }) => {
        for (const route of [
            '/es/servicios/diagnostico-integral/',
            '/es/telemedicina/',
            '/es/legal/terminos/',
        ]) {
            await gotoPublicRoute(page, route);
            const thesis = page.locator('[data-v6-internal-thesis]').first();
            await expect(thesis).toBeVisible();
            await expect(thesis.locator('h2')).toBeVisible();
            await expect(thesis.locator('p')).toHaveCount(2);
        }
    });

    test('internal rail becomes non-sticky on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/servicios/diagnostico-integral/');

        const position = await page
            .locator('[data-v6-internal-rail]')
            .first()
            .evaluate((node) => {
                return window.getComputedStyle(node).position;
        });
        expect(position).toBe('static');
    });

    test('internal rail tracks the active anchor after navigation', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        const rail = page.locator('[data-v6-internal-rail]').first();
        const firstLink = rail.locator('a').first();
        const bookingLink = rail.locator('a[href="#v6-booking-status"]').first();

        await expect(firstLink).toHaveAttribute('aria-current', 'location');
        await bookingLink.click();
        await expect(page).toHaveURL(/#v6-booking-status$/);
        await expect(bookingLink).toHaveAttribute('aria-current', 'location');
        await expect(firstLink).not.toHaveAttribute('aria-current', 'location');
    });
});
