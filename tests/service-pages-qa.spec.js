// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

const CASES = [
    { route: '/es/servicios/acne-rosacea/', expectedValue: 'acne' },
    { route: '/es/servicios/laser-dermatologico/', expectedValue: 'laser' },
];

test.describe('Service detail conversion QA', () => {
    test('service hero CTA jumps into the booking bridge and keeps the service hint', async ({
        page,
    }) => {
        for (const item of CASES) {
            await gotoPublicRoute(page, item.route);
            await waitForBookingHooks(page, item.expectedValue);
            await page
                .locator(
                    '[data-service-hero] a[data-analytics-event="start_booking_from_service"]'
                )
                .click();
            await expect(page).toHaveURL(/#citas$/);
            await waitForBookingHooks(page, item.expectedValue);
        }
    });
});
