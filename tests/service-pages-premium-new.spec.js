// @ts-check
const { test, expect } = require('@playwright/test');

const PREMIUM_SERVICE_ROUTES = [
    '/servicios/diagnostico-integral',
    '/servicios/acne-rosacea',
    '/servicios/verrugas',
    '/servicios/granitos-brazos-piernas',
    '/servicios/cicatrices',
    '/servicios/cancer-piel',
    '/servicios/peeling-quimico',
    '/servicios/mesoterapia',
    '/servicios/laser-dermatologico',
    '/servicios/botox',
    '/servicios/bioestimuladores-colageno',
    '/servicios/piel-cabello-unas',
    '/ninos/dermatologia-pediatrica',
];

test.describe('Premium service routes', () => {
    test('all premium routes render content and booking CTA', async ({
        page,
    }) => {
        for (const route of PREMIUM_SERVICE_ROUTES) {
            await page.goto(route, { waitUntil: 'domcontentloaded' });
            await expect(page.locator('.service-hero-card')).toBeVisible();
            await expect(page.locator('.service-hero-card h1')).not.toHaveText(
                ''
            );

            const bookingCta = page
                .locator(
                    '.service-actions a[data-analytics-event="start_booking_from_service"]'
                )
                .first();
            await expect(bookingCta).toBeVisible();
            await expect(bookingCta).toHaveAttribute(
                'href',
                /\/\?service=.+#citas/
            );
        }
    });
});
