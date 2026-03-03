// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute, waitForBookingHooks } = require('./helpers/public-v3');

const SERVICE_CASES = [
    {
        route: '/es/servicios/botox/',
        expectedHint: 'rejuvenecimiento',
    },
    {
        route: '/es/servicios/cancer-piel/',
        expectedHint: 'cancer',
    },
    {
        route: '/en/services/botox/',
        expectedHint: 'rejuvenecimiento',
    },
    {
        route: '/en/services/verrugas/',
        expectedHint: 'consulta',
    },
];

test.describe('Service booking hints parity ES/EN', () => {
    test('service CTAs keep the embedded booking bridge hint in both locales', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        for (const entry of SERVICE_CASES) {
            await gotoPublicRoute(page, entry.route);

            const bookingCta = page
                .locator('a[data-analytics-event="start_booking_from_service"]')
                .first();
            await expect(bookingCta).toBeVisible();

            const href = String((await bookingCta.getAttribute('href')) || '');
            expect(href, `CTA href mismatch for ${entry.route}`).toBe(
                '#v5-booking'
            );

            await bookingCta.click();
            await expect(page).toHaveURL(
                new RegExp(`${entry.route.replace(/\//g, '\\/')}#v5-booking$`)
            );
            await waitForBookingHooks(page, entry.expectedHint);
        }
    });

    test('direct service query preselect works for both locales with shared hints', async ({
        page,
    }) => {
        const directCases = [
            {
                route: '/es/servicios/botox/?service=rejuvenecimiento#v5-booking',
                expected: 'rejuvenecimiento',
            },
            {
                route: '/en/services/cancer-piel/?service=cancer#v5-booking',
                expected: 'cancer',
            },
        ];

        for (const entry of directCases) {
            await gotoPublicRoute(page, entry.route);
            await waitForBookingHooks(page, entry.expected);
        }
    });
});
