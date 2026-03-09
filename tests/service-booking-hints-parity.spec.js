// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    waitForBookingStatus,
} = require('./helpers/public-v6');

const SERVICE_CASES = [
    {
        route: '/es/servicios/botox/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/es/servicios/cancer-piel/',
        bookingText: 'Reserva online en mantenimiento',
    },
    {
        route: '/en/services/botox/',
        bookingText: 'Online booking under maintenance',
    },
    {
        route: '/en/services/verrugas/',
        bookingText: 'Online booking under maintenance',
    },
];

test.describe('Service booking status parity ES/EN', () => {
    test('service CTAs keep the same V6 booking-status anchor in both locales', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });

        for (const entry of SERVICE_CASES) {
            await gotoPublicRoute(page, entry.route);

            const bookingCta = page
                .locator('[data-v6-internal-rail] a[href="#v6-booking-status"]')
                .first();
            await expect(bookingCta).toBeVisible();
            await expect(bookingCta).toHaveAttribute(
                'href',
                '#v6-booking-status'
            );

            await bookingCta.click();
            await expect(page).toHaveURL(
                new RegExp(
                    `${entry.route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#v6-booking-status$`
                )
            );
            await waitForBookingStatus(page, entry.bookingText);
        }
    });

    test('direct service hash routes resolve the V6 booking status block in both locales', async ({
        page,
    }) => {
        const directCases = [
            {
                route: '/es/servicios/botox/#v6-booking-status',
                bookingText: 'Reserva online en mantenimiento',
            },
            {
                route: '/en/services/cancer-piel/#v6-booking-status',
                bookingText: 'Online booking under maintenance',
            },
        ];

        for (const entry of directCases) {
            await gotoPublicRoute(page, entry.route);
            await expect(page).toHaveURL(/#v6-booking-status$/);
            await waitForBookingStatus(page, entry.bookingText);
        }
    });
});
