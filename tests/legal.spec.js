// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
} = require('./helpers/public-v6');

const LEGAL_CASES = [
    {
        route: '/es/legal/terminos/',
        heading: /Terminos y condiciones/i,
        switchHref: '/en/legal/terms/',
    },
    {
        route: '/es/legal/privacidad/',
        heading: /Politica de privacidad/i,
        switchHref: '/en/legal/privacy/',
    },
    {
        route: '/en/legal/terms/',
        heading: /Terms and conditions/i,
        switchHref: '/es/legal/terminos/',
    },
    {
        route: '/en/legal/privacy/',
        heading: /Privacy policy/i,
        switchHref: '/es/legal/privacidad/',
    },
];

test.describe('Legal V6', () => {
    for (const legalCase of LEGAL_CASES) {
        test(`renders ${legalCase.route} with the V6 legal shell`, async ({
            page,
        }) => {
            await gotoPublicRoute(page, legalCase.route);

            await expect(page.locator('[data-v6-page-head] h1')).toHaveText(
                legalCase.heading
            );
            await expect(page.locator('[data-v6-internal-hero]')).toBeVisible();
            await expect(page.locator('.v6-legal-tabs a')).toHaveCount(4);
            await expect(page.locator('.v6-legal-tabs .is-active')).toHaveCount(
                1
            );
            await expect(
                page.locator('.v6-legal-tabs a[aria-current="page"]')
            ).toHaveCount(1);
            await expect(
                page.locator('[data-v6-statement-band]')
            ).toBeVisible();
            await expect(
                page.locator('[data-v6-internal-thesis]')
            ).toBeVisible();
            await expect(page.locator('[data-v6-legal-index] a')).toHaveCount(
                4
            );
            expect(
                await page.locator('[data-v6-legal-block]').count()
            ).toBeGreaterThan(0);
            const switcher = await findLocaleSwitch(page);
            await expect(switcher).toHaveAttribute(
                'href',
                legalCase.switchHref
            );
            await expectNoLegacyPublicShell(page);
        });
    }
});
