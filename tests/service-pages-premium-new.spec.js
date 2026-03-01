// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

const ES_CASES = [
    {
        route: '/es/servicios/acne-rosacea/',
        slug: 'acne-rosacea',
        expectedValue: 'acne',
    },
    {
        route: '/es/servicios/botox/',
        slug: 'botox',
        expectedValue: 'rejuvenecimiento',
    },
    {
        route: '/es/servicios/cancer-piel/',
        slug: 'cancer-piel',
        expectedValue: 'cancer',
    },
];

const EN_CASES = [
    {
        route: '/en/services/diagnostico-integral/',
        slug: 'diagnostico-integral',
        expectedValue: 'consulta',
    },
    {
        route: '/en/services/botox/',
        slug: 'botox',
        expectedValue: 'rejuvenecimiento',
    },
];

test.describe('Service detail V3', () => {
    test('service routes render the new editorial template in Spanish', async ({
        page,
    }) => {
        for (const item of ES_CASES) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('[data-service-hero]')).toBeVisible();
            await expect(page.locator('[data-service-story]')).toBeVisible();
            await expect(page.locator('[data-service-evidence]')).toBeVisible();
            await expect(
                page.locator(
                    '[data-service-timeline] .service-timeline-v3__steps article'
                )
            ).toHaveCount(4);
            await expect(
                page.locator('[data-related-programs] .service-card-v3')
            ).toHaveCount(3);
            await expect(page.locator('[data-service-hero]')).toHaveAttribute(
                'data-section-tone',
                /^(ink|porcelain|silver)$/
            );
            await expect(page.locator('[data-service-story]')).toHaveAttribute(
                'data-section-tone',
                /^(ink|porcelain|silver)$/
            );
            await expect(
                page.locator('[data-service-evidence]')
            ).toHaveAttribute('data-section-tone', /^(ink|porcelain|silver)$/);
            await expect(
                page.locator('[data-service-timeline]')
            ).toHaveAttribute('data-section-tone', /^(ink|porcelain|silver)$/);
            await expect(
                page.locator('[data-booking-bridge-band]')
            ).toHaveAttribute('data-section-tone', /^(ink|porcelain|silver)$/);
            const cta = page.locator(
                '[data-service-hero] a[data-analytics-event="start_booking_from_service"]'
            );
            await expect(cta).toHaveAttribute('href', '#citas');
            await expect(cta).toHaveAttribute('data-service-slug', item.slug);
            await expect(page.locator('.sony-detail-hero')).toHaveCount(0);
        }
    });

    test('service routes keep booking continuity and service preselection', async ({
        page,
    }) => {
        for (const item of ES_CASES) {
            await gotoPublicRoute(page, item.route);
            await waitForBookingHooks(page, item.expectedValue);
            await page
                .locator(
                    '[data-service-hero] a[data-analytics-event="start_booking_from_service"]'
                )
                .click();
            await expect(page).toHaveURL(
                new RegExp(
                    `${item.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#citas$`
                )
            );
            await waitForBookingHooks(page, item.expectedValue);
        }
    });

    test('english service routes keep the same template and service hint', async ({
        page,
    }) => {
        for (const item of EN_CASES) {
            await gotoPublicRoute(page, item.route);
            await expect(page.locator('html')).toHaveAttribute('lang', 'en');
            await expect(page.locator('[data-service-hero]')).toBeVisible();
            await expect(page.locator('[data-related-programs]')).toBeVisible();
            await waitForBookingHooks(page, item.expectedValue);
        }
    });
});
