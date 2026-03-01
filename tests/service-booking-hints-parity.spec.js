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
            expect(href, `CTA href mismatch for ${entry.route}`).toBe('#citas');

            await bookingCta.click();
            await expect(page).toHaveURL(new RegExp(`${entry.route}#citas$`));
            await waitForBookingHooks(page, entry.expectedHint);
        }
    });

    test('direct home query preselect works for both locales with shared hints', async ({
        page,
    }) => {
        const directCases = [
            {
                route: '/es/?service=rejuvenecimiento#citas',
                expected: 'rejuvenecimiento',
            },
            { route: '/en/?service=cancer#citas', expected: 'cancer' },
        ];

        for (const entry of directCases) {
            await page.goto(entry.route, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('#appointmentForm')).toBeVisible();
            await expect
                .poll(
                    async () =>
                        page.evaluate(() => {
                            const select =
                                document.getElementById('serviceSelect');
                            return select ? select.value : null;
                        }),
                    { timeout: 12000 }
                )
                .toBe(entry.expected);
        }
    });
});
