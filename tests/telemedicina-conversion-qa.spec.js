// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');

test.describe('Telemedicine V6', () => {
    test('telemedicine pages render the V6 internal structure in Spanish', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        await expect(page.locator('[data-v6-page-head]')).toBeVisible();
        await expect(page.locator('[data-v6-internal-hero]')).toBeVisible();
        await expect(page.locator('[data-v6-internal-message]')).toBeVisible();
        await expect(page.locator('[data-v6-internal-thesis]')).toBeVisible();
        await expect(page.locator('[data-v6-internal-rail]')).toBeVisible();
        await expect(page.locator('[data-v6-tele-block]')).toHaveCount(3);
        await expect(page.locator('[data-v6-tele-initiative]')).toHaveCount(4);
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
        await expectNoLegacyPublicShell(page);
    });

    test('telemedicine booking CTA jumps to the V6 booking status block', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        await page
            .locator('[data-v6-internal-rail] a[href="#v6-booking-status"]')
            .first()
            .click();

        await expect(page).toHaveURL(/#v6-booking-status$/);
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
    });

    test('english telemedicine keeps the same V6 shell and locale switch', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/telemedicine/');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        const switcher = await findLocaleSwitch(page);
        await expect(switcher).toHaveAttribute('href', '/es/telemedicina/');
        await waitForBookingStatus(page, 'Online booking under maintenance');
    });
});
