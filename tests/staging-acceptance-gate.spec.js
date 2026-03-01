// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

test.describe('Staging acceptance gate V3', () => {
    test('home ES and EN keep the clean shell, locale switch, and critical hooks', async ({
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
            await expect(page.locator('[data-public-nav]')).toBeVisible();
            await expect(page.locator('.public-nav__lang')).toHaveAttribute(
                'href',
                item.switchHref
            );
            await waitForBookingHooks(page);
            await expect(page.locator('#chatbotWidget')).toHaveCount(1);
        }
    });

    test('language switch preserves equivalent service route', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/acne-rosacea/');
        const switcher = page.locator('.public-nav__lang').first();
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

    test('service detail keeps booking preselection through the bridge', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/botox/');
        await waitForBookingHooks(page, 'rejuvenecimiento');
    });

    test('telemedicine booking bridge reaches the booking section', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');
        await page
            .locator(
                '[data-booking-bridge-band] a[data-analytics-event="open_public_cta"]'
            )
            .click();
        await expect(page).toHaveURL(/#citas$/);
        await waitForBookingHooks(page);
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
