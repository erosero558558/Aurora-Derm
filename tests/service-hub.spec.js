// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

test.describe('Service hub V3', () => {
    test('spanish hub renders the new catalogue architecture', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/servicios/');

        await expect(page.locator('[data-hub-hero]')).toBeVisible();
        await expect(
            page.locator('[data-family-tabs] [data-family-tab]')
        ).toHaveCount(3);
        await expect(
            page.locator('[data-featured-family-story] .featured-story')
        ).toHaveCount(2);
        await expect(page.locator('[data-services-grid]')).toBeVisible();
        await expect(
            page.locator(
                '[data-services-grid] .services-editorial-grid__family'
            )
        ).toHaveCount(3);
        await expect(
            page.locator('[data-services-grid] .service-card-v3').first()
        ).toBeVisible();
        await expect(page.locator('[data-telemedicine-band]')).toBeVisible();
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
        await expect(page.locator('[data-service-hub]')).toHaveCount(0);
    });

    test('english hub keeps localized routes and service cards', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/services/');

        await expect(page.locator('.public-nav__lang')).toHaveAttribute(
            'href',
            '/es/servicios/'
        );
        await expect(
            page.locator('[data-family-tabs] [data-family-tab]')
        ).toHaveCount(3);
        await expect(
            page.locator('[data-services-grid] .service-card-v3 a').first()
        ).toHaveAttribute('href', /^\/en\/services\//);
    });

    test('hub booking bridge hydrates existing hooks', async ({ page }) => {
        await gotoPublicRoute(page, '/es/servicios/');
        await waitForBookingHooks(page);
    });
});
