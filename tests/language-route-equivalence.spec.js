const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

const CASES = [
    { from: '/es/', expectedSwitchHref: '/en/', expectedAfterClick: '/en/' },
    { from: '/en/', expectedSwitchHref: '/es/', expectedAfterClick: '/es/' },
    {
        from: '/es/servicios/',
        expectedSwitchHref: '/en/services/',
        expectedAfterClick: '/en/services/',
    },
    {
        from: '/en/services/',
        expectedSwitchHref: '/es/servicios/',
        expectedAfterClick: '/es/servicios/',
    },
    {
        from: '/es/servicios/acne-rosacea/',
        expectedSwitchHref: '/en/services/acne-rosacea/',
        expectedAfterClick: '/en/services/acne-rosacea/',
    },
    {
        from: '/en/services/botox/',
        expectedSwitchHref: '/es/servicios/botox/',
        expectedAfterClick: '/es/servicios/botox/',
    },
    {
        from: '/es/telemedicina/',
        expectedSwitchHref: '/en/telemedicine/',
        expectedAfterClick: '/en/telemedicine/',
    },
    {
        from: '/en/telemedicine/',
        expectedSwitchHref: '/es/telemedicina/',
        expectedAfterClick: '/es/telemedicina/',
    },
    {
        from: '/es/legal/privacidad/',
        expectedSwitchHref: '/en/legal/privacy/',
        expectedAfterClick: '/en/legal/privacy/',
    },
    {
        from: '/en/legal/terms/',
        expectedSwitchHref: '/es/legal/terminos/',
        expectedAfterClick: '/es/legal/terminos/',
    },
];

test.describe('Language route equivalence', () => {
    for (const testCase of CASES) {
        test(`switches ${testCase.from} to the equivalent V3 route`, async ({
            page,
        }) => {
            await gotoPublicRoute(page, testCase.from);

            const switcher = page.locator('.public-nav__lang').first();
            await expect(switcher).toBeVisible();
            await expect(switcher).toHaveAttribute(
                'href',
                testCase.expectedSwitchHref
            );

            await Promise.all([
                page.waitForURL(`**${testCase.expectedAfterClick}`, {
                    timeout: 10000,
                }),
                switcher.click(),
            ]);

            await expect(page).toHaveURL(
                new RegExp(`${testCase.expectedAfterClick}$`)
            );
        });
    }
});
