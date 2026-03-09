// @ts-check
const { test, expect } = require('@playwright/test');
const {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    gotoPublicRoute,
    waitForBookingStatus,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

test.describe('Staging acceptance gate V6', () => {
    test('home ES and EN keep the V6 shell, locale switch, and booking status', async ({
        page,
    }) => {
        const cases = [
            { route: '/es/', lang: 'es', switchHref: '/en/' },
            { route: '/en/', lang: 'en', switchHref: '/es/' },
        ];

        for (const item of cases) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('html')).toHaveAttribute(
                'lang',
                item.lang
            );
            await waitForHomeV6Runtime(page);
            await expect(page.locator('[data-v6-header]')).toBeVisible();
            await expect(await findLocaleSwitch(page)).toHaveAttribute(
                'href',
                item.switchHref
            );
            await waitForBookingStatus(
                page,
                item.lang === 'es'
                    ? 'Reserva online en mantenimiento'
                    : 'Online booking under maintenance'
            );
            await expectNoLegacyPublicShell(page);
        }
    });

    test('language switch preserves equivalent service route', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/acne-rosacea/');
        const switcher = await findLocaleSwitch(page);
        await expect(switcher).toHaveAttribute(
            'href',
            '/en/services/acne-rosacea/'
        );
        await Promise.all([
            page.waitForURL('**/en/services/acne-rosacea/', { timeout: 12000 }),
            switcher.click(),
        ]);
        await expect(page).toHaveURL(/\/en\/services\/acne-rosacea\/$/);
    });

    test('service detail keeps booking status reachable from the internal rail', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/botox/');
        const bookingLink = page
            .locator('[data-v6-internal-rail] a[href="#v6-booking-status"]')
            .first();
        await expect(bookingLink).toBeVisible();
        await bookingLink.click();
        await expect(page).toHaveURL(/#v6-booking-status$/);
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
    });

    test('telemedicine CTA reaches the booking status section', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');
        await page
            .locator('[data-v6-tele-block] a[href="#v6-booking-status"]')
            .first()
            .click();
        await expect(page).toHaveURL(/#v6-booking-status$/);
        await waitForBookingStatus(page, 'Reserva online en mantenimiento');
    });

    test('mobile keeps key public routes without horizontal overflow', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const routes = [
            '/es/',
            '/en/',
            '/es/telemedicina/',
            '/en/telemedicine/',
        ];
        for (const route of routes) {
            await gotoPublicRoute(page, route);
            const dimensions = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
            }));
            expect(
                dimensions.scrollWidth,
                `horizontal overflow detected on ${route}`
            ).toBeLessThanOrEqual(dimensions.clientWidth + 1);
        }
    });
});
