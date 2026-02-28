// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v2');

const LEGAL_CASES = [
    { route: '/es/legal/terminos/', heading: /Terminos y condiciones/i, switchHref: '/en/legal/terms/' },
    { route: '/es/legal/privacidad/', heading: /Politica de privacidad/i, switchHref: '/en/legal/privacy/' },
    { route: '/en/legal/terms/', heading: /Terms and conditions/i, switchHref: '/es/legal/terminos/' },
    { route: '/en/legal/privacy/', heading: /Privacy policy/i, switchHref: '/es/legal/privacidad/' },
];

test.describe('Legal V2', () => {
    for (const legalCase of LEGAL_CASES) {
        test(`renders ${legalCase.route} with clean legal shell`, async ({ page }) => {
            await gotoPublicRoute(page, legalCase.route);

            await expect(page.locator('[data-legal-hero]')).toBeVisible();
            await expect(page.locator('[data-legal-hero] h1')).toHaveText(legalCase.heading);
            await expect(page.locator('[data-legal-tabs] .legal-tabs-v2__link')).toHaveCount(4);
            await expect(page.locator('[data-legal-tabs] [aria-current="page"]')).toHaveCount(1);
            await expect(page.locator('[data-legal-article] .legal-article-v2__highlights article')).toHaveCount(2);
            await expect(page.locator('[data-support-band]')).toBeVisible();
            await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
            await expect(page.locator('.public-nav__lang')).toHaveAttribute('href', legalCase.switchHref);
            await expect(page.locator('.sony-legal-card')).toHaveCount(0);
        });
    }

    test('legal pages keep booking hooks available through the bridge', async ({ page }) => {
        await gotoPublicRoute(page, '/es/legal/terminos/');
        await waitForBookingHooks(page, 'consulta');
    });
});
