// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

test.describe('Telemedicine V3', () => {
    test('telemedicine pages render the new editorial structure in Spanish', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/telemedicina/');

        await expect(page.locator('[data-telemedicine-hero]')).toBeVisible();
        await expect(page.locator('[data-how-it-works]')).toBeVisible();
        await expect(page.locator('[data-who-it-fits]')).toBeVisible();
        await expect(
            page.locator(
                '[data-escalation-model] .service-timeline-v3__steps article'
            )
        ).toHaveCount(3);
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
        await expect(page.locator('[data-telemedicine-hero]')).toHaveAttribute(
            'data-section-tone',
            /^(ink|porcelain|silver)$/
        );
        await expect(page.locator('[data-how-it-works]')).toHaveAttribute(
            'data-section-tone',
            /^(ink|porcelain|silver)$/
        );
        await expect(page.locator('[data-who-it-fits]')).toHaveAttribute(
            'data-section-tone',
            /^(ink|porcelain|silver)$/
        );
        await expect(page.locator('[data-escalation-model]')).toHaveAttribute(
            'data-section-tone',
            /^(ink|porcelain|silver)$/
        );
        await expect(
            page.locator('[data-booking-bridge-band]')
        ).toHaveAttribute('data-section-tone', /^(ink|porcelain|silver)$/);
        await expect(page.locator('.sony-detail-hero')).toHaveCount(0);
    });

    test('telemedicine booking bridge opens the existing hooks', async ({
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

    test('english telemedicine keeps the same shell and locale switch', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/telemedicine/');

        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('.public-nav__lang')).toHaveAttribute(
            'href',
            '/es/telemedicina/'
        );
        await expect(page.locator('[data-telemedicine-hero]')).toBeVisible();
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();
    });
});
