// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

test.describe('Public V6 header and mega menu', () => {
    test('desktop header mounts sony-like hierarchy and mega panel', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const header = page.locator('[data-v6-header]').first();
        await expect(header).toBeVisible();
        await expect(
            header.locator('.v6-header__nav .v6-header__link')
        ).toHaveCount(7);

        const trigger = header.locator('[data-v6-mega-trigger]').first();
        const mega = header.locator('[data-v6-mega]').first();
        const tabs = mega.locator('[data-v6-mega-tab]');
        const sections = mega.locator('[data-v6-mega-section]');
        const focusables = mega.locator('[data-v6-mega-focusable]');

        await expect(mega).toBeHidden();
        await trigger.click();
        await expect(mega).toBeVisible();
        await expect(tabs).toHaveCount(3);
        await expect(sections).toHaveCount(3);
        const megaCols = await mega
            .locator('[data-v6-mega-layout]')
            .evaluate(
                (node) => window.getComputedStyle(node).gridTemplateColumns
            );
        expect(
            String(megaCols).trim().split(/\s+/).filter(Boolean).length
        ).toBe(2);
        expect(await focusables.count()).toBeGreaterThan(20);

        await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
        await tabs.nth(1).hover();
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
        const activeDetail = mega
            .locator('[data-v6-mega-detail]:not([hidden])')
            .first();
        await expect(activeDetail).toHaveAttribute(
            'data-v6-column-id',
            'procedures'
        );

        await trigger.press('ArrowDown');
        await expect(tabs.nth(0)).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(tabs.nth(1)).toBeFocused();

        await page.keyboard.press('Escape');
        await expect(mega).toBeHidden();
    });

    test('mobile drawer opens and closes with scroll lock', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await gotoPublicRoute(page, '/es/');

        const header = page.locator('[data-v6-header]').first();
        const openButton = header.locator('[data-v6-drawer-open]').first();
        const drawer = header.locator('[data-v6-drawer]').first();

        await openButton.click();
        await expect(drawer).toBeVisible();
        await expect
            .poll(() => page.evaluate(() => document.body.style.overflow))
            .toBe('hidden');
        await expect(
            drawer.locator('[data-v6-drawer-group-toggle]')
        ).toHaveCount(3);

        const toggles = drawer.locator('[data-v6-drawer-group-toggle]');
        await toggles.nth(1).click();
        await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
        await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
        await expect(drawer.locator('#v6-drawer-group-2')).toBeVisible();

        await drawer.locator('.v6-drawer__panel header button').first().click();
        await expect(drawer).toBeHidden();
    });
});
