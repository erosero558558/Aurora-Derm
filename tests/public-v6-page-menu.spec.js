// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v6');

test.describe('Public V6 page-level menu', () => {
    test('hub page menu opens, exposes anchors, and closes after selection', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();
        const links = panel.locator('[data-v6-page-menu-link]');

        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
        await expect(panel).toBeHidden();

        await menuButton.click();
        await expect(panel).toBeVisible();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
        await expect(links).toHaveCount(5);

        await links.first().click();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
        await expect(panel).toBeHidden();
        await expect(page).toHaveURL(/#v6-hub-featured$/);
        await expect(links.first()).toHaveAttribute('aria-current', 'location');
    });

    test('service page menu closes with Escape', async ({ page }) => {
        await gotoPublicRoute(page, '/es/servicios/diagnostico-integral/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();

        await menuButton.click();
        await expect(panel).toBeVisible();

        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    });

    test('page menu supports keyboard open, roving, and focus return', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();
        const links = panel.locator('[data-v6-page-menu-link]');

        await menuButton.focus();
        await page.keyboard.press('ArrowDown');
        await expect(panel).toBeVisible();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'true');
        await expect(menuButton).toHaveClass(/is-open/);
        await expect(links.first()).toBeFocused();

        await page.keyboard.press('ArrowDown');
        await expect(links.nth(1)).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(panel).toBeHidden();
        await expect(menuButton).toHaveAttribute('aria-expanded', 'false');
        await expect(menuButton).toBeFocused();
    });

    test('legal page menu keeps the current anchor in sync with reading position', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/legal/terminos/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        const panel = page.locator('[data-v6-page-menu-panel]').first();
        const links = panel.locator('[data-v6-page-menu-link]');

        await menuButton.click();
        await expect(panel).toBeVisible();
        await expect(links.first()).toHaveAttribute('aria-current', 'location');

        await links.nth(1).click();
        await expect(page).toHaveURL(/#v6-legal-summary$/);
        await expect(links.nth(1)).toHaveAttribute('aria-current', 'location');
    });
});
