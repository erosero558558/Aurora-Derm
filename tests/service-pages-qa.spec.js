// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');

const CASES = [
    {
        route: '/es/servicios/acne-rosacea/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/en/services/laser-dermatologico/',
        bookingText: 'Online booking under maintenance',
    },
];

test.describe('Service detail conversion QA V6', () => {
    test('service detail routes expose V6 booking status instead of legacy booking hooks', async ({
        page,
    }) => {
        for (const item of CASES) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('[data-v6-page-head]')).toBeVisible();
            await expect(page.locator('[data-v6-internal-hero]')).toBeVisible();
            await expect(page.locator('[data-v6-internal-rail]')).toBeVisible();
            await expect(page.locator('#v6-service-glance')).toBeVisible();
            await expect(page.locator('#v6-service-checkpoints')).toBeVisible();
            await expect(page.locator('#v6-service-process')).toBeVisible();
            await expect(page.locator('#v6-service-faq')).toBeVisible();
            await waitForBookingStatus(page, item.bookingText);
            await expectNoLegacyPublicShell(page);

            await page
                .locator('[data-v6-internal-rail] a[href="#v6-booking-status"]')
                .first()
                .click();
            await expect(page).toHaveURL(/#v6-booking-status$/);
            await waitForBookingStatus(page, item.bookingText);
        }
    });
});
