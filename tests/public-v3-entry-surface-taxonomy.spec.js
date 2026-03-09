// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
} = require('./helpers/public-v6');

const ROUTES = [
    {
        route: '/es/',
        templateId: 'home_v6',
        selectors: [
            '[data-v6-hero]',
            '[data-v6-news-strip]',
            '[data-v6-editorial]',
            '[data-v6-corporate-matrix]',
            '[data-v6-booking-status]',
        ],
    },
    {
        route: '/es/servicios/',
        templateId: 'hub_v6',
        selectors: [
            '[data-v6-page-head]',
            '[data-v6-hub-featured]',
            '[data-v6-catalog-rail]',
            '[data-v6-service-grid]',
            '[data-v6-booking-status]',
        ],
    },
    {
        route: '/es/servicios/botox/',
        templateId: 'service_detail_v6',
        selectors: [
            '[data-v6-page-head]',
            '[data-v6-internal-hero]',
            '[data-v6-internal-rail]',
            '#v6-service-glance',
            '#v6-booking-status',
        ],
    },
    {
        route: '/es/telemedicina/',
        templateId: 'telemedicine_v6',
        selectors: [
            '[data-v6-page-head]',
            '[data-v6-internal-hero]',
            '[data-v6-internal-rail]',
            '[data-v6-tele-block]',
            '#v6-booking-status',
        ],
    },
    {
        route: '/es/legal/terminos/',
        templateId: 'legal_v6',
        selectors: [
            '[data-v6-page-head]',
            '[data-v6-internal-hero]',
            '.v6-legal-tabs',
            '[data-v6-statement-band]',
            '[data-v6-legal-block]',
        ],
    },
];

test.describe('Public V6 surface taxonomy', () => {
    test('maps each public route to the expected V6 template and required surfaces', async ({
        page,
    }) => {
        for (const item of ROUTES) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('body')).toHaveAttribute(
                'data-public-shell-version',
                'v6'
            );
            await expect(page.locator('body')).toHaveAttribute(
                'data-public-template-id',
                item.templateId
            );
            await expectNoLegacyPublicShell(page);

            for (const selector of item.selectors) {
                await expect(
                    page.locator(selector).first(),
                    `${item.route} should expose ${selector}`
                ).toBeVisible();
            }
        }
    });

    test('template ids stay normalized and V6-scoped', async ({ page }) => {
        const templateIds = [];

        for (const item of ROUTES) {
            await gotoPublicRoute(page, item.route);
            templateIds.push(
                await page
                    .locator('body')
                    .getAttribute('data-public-template-id')
            );
        }

        templateIds.forEach((templateId) => {
            expect(templateId).toBeTruthy();
            expect(templateId.startsWith('v3')).toBeFalsy();
            expect(templateId.startsWith('v5')).toBeFalsy();
            expect(
                templateId.endsWith('_v6') || templateId.includes('_v6')
            ).toBeTruthy();
        });
    });
});
