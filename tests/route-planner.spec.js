// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

test.describe('Hero stage V3', () => {
    test('editorial triggers switch the active story on home', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const triggers = page.locator('[data-stage-trigger]');
        await expect(triggers).toHaveCount(3);
        await triggers.nth(2).click();
        await expect(triggers.nth(2)).toHaveClass(/is-active/);
        await expect(page.locator('[data-stage-slide].is-active')).toHaveCount(
            1
        );
    });

    test('stage primary CTA can move directly into booking hooks', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await page
            .locator(
                '[data-stage-slide].is-active a[data-cta-target="booking"]'
            )
            .click();
        await expect(page).toHaveURL(/#citas$/);
        await waitForBookingHooks(page);
    });
});
