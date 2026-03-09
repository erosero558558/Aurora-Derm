// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');

const ES_CASES = [
    {
        route: '/es/servicios/acne-rosacea/',
        switchHref: '/en/services/acne-rosacea/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/es/servicios/botox/',
        switchHref: '/en/services/botox/',
        bookingText: 'Reserva online en mantenimiento',
    },
];

const EN_CASES = [
    {
        route: '/en/services/diagnostico-integral/',
        switchHref: '/es/servicios/diagnostico-integral/',
        bookingText: 'Online booking under maintenance',
    },
    {
        route: '/en/services/botox/',
        switchHref: '/es/servicios/botox/',
        bookingText: 'Online booking under maintenance',
    },
];

test.describe('Service detail premium V6', () => {
    test('service routes render the V6 premium detail shell in Spanish', async ({
        page,
    }) => {
        for (const item of ES_CASES) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('[data-v6-page-head] h1')).toBeVisible();
            await expect(
                page.locator('[data-v6-statement-band]')
            ).toBeVisible();
            await expect(
                page.locator('.v6-service-checklist li').first()
            ).toBeVisible();
            await expect(
                page.locator('.v6-service-process li').first()
            ).toBeVisible();
            await expect(
                page.locator('.v6-service-faq-grid article')
            ).toHaveCount(3);
            const switcher = await findLocaleSwitch(page);
            await expect(switcher).toHaveAttribute('href', item.switchHref);
            await waitForBookingStatus(page, item.bookingText);
            await expectNoLegacyPublicShell(page);
        }
    });

    test('service page menu exposes booking and related anchors on V6 detail pages', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/cancer-piel/');

        const menuButton = page.locator('[data-v6-page-menu]').first();
        await menuButton.click();

        const links = page.locator('[data-v6-page-menu-link]');
        await expect(links).toHaveCount(6);
        await expect(links.last()).toHaveAttribute(
            'href',
            '#v6-booking-status'
        );
        await expect(page.locator('[data-v6-page-menu-panel]')).toContainText(
            /Reserva online en mantenimiento|Online booking under maintenance|Agenda/i
        );
    });

    test('english service routes keep the same V6 template and booking status', async ({
        page,
    }) => {
        for (const item of EN_CASES) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('html')).toHaveAttribute('lang', 'en');
            await expect(page.locator('[data-v6-page-head] h1')).toBeVisible();
            await expect(
                page.locator('[data-v6-statement-band]')
            ).toBeVisible();
            const switcher = await findLocaleSwitch(page);
            await expect(switcher).toHaveAttribute('href', item.switchHref);
            await waitForBookingStatus(page, item.bookingText);
        }
    });
});
