// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

test.describe('Public V6 mega menu two-panel behavior', () => {
    test('desktop mega uses category rail + active detail panel', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const trigger = page.locator('[data-v6-mega-trigger]').first();
        const mega = page.locator('[data-v6-mega]').first();
        const tabs = mega.locator('[data-v6-mega-tab]');

        await trigger.click();
        await expect(mega).toBeVisible();
        await expect(tabs).toHaveCount(3);

        const activeAtStart = mega
            .locator('[data-v6-mega-detail]:not([hidden])')
            .first();
        await expect(activeAtStart).toHaveAttribute(
            'data-v6-column-id',
            'entry-routes'
        );
        await expect(
            activeAtStart.locator('.v6-mega__context h3')
        ).toBeVisible();
        await expect(
            activeAtStart.locator('.v6-mega__items > li > a')
        ).toHaveCount(3);

        await tabs.nth(2).click();
        await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
        const activeAfter = mega
            .locator('[data-v6-mega-detail]:not([hidden])')
            .first();
        await expect(activeAfter).toHaveAttribute(
            'data-v6-column-id',
            'extended-care'
        );
    });

    test('tab keyboard arrows switch active detail panel', async ({ page }) => {
        await gotoPublicRoute(page, '/en/');

        const trigger = page.locator('[data-v6-mega-trigger]').first();
        const mega = page.locator('[data-v6-mega]').first();
        const tabs = mega.locator('[data-v6-mega-tab]');

        await trigger.click();
        await tabs.nth(0).focus();
        await page.keyboard.press('ArrowDown');
        await expect(tabs.nth(1)).toBeFocused();
        await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');

        const activeAfterArrow = mega
            .locator('[data-v6-mega-detail]:not([hidden])')
            .first();
        await expect(activeAfterArrow).toHaveAttribute(
            'data-v6-column-id',
            'procedures'
        );

        await page.keyboard.press('Enter');
        const firstLink = activeAfterArrow
            .locator('[data-v6-mega-focusable]')
            .first();
        await expect(firstLink).toBeFocused();
    });
});
