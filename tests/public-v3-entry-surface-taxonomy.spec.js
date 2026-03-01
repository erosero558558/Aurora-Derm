// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

const ROUTES = [
    '/es/',
    '/es/servicios/',
    '/es/servicios/botox/',
    '/es/telemedicina/',
    '/es/legal/terminos/',
];

const REQUIRED_SURFACES = [
    'nav_primary_booking',
    'footer_booking',
    'booking_bridge_primary',
    'booking_bridge_mount',
    'support_band_booking',
    'support_band_telemedicine',
];

test.describe('Public V3 entry surface taxonomy', () => {
    test('uses a normalized snake_case taxonomy without legacy prefixes', async ({
        page,
    }) => {
        const surfaces = new Set();

        for (const route of ROUTES) {
            await gotoPublicRoute(page, route);
            const routeSurfaces = await page.evaluate(() =>
                Array.from(document.querySelectorAll('[data-entry-surface]'))
                    .map(
                        (element) =>
                            element.getAttribute('data-entry-surface') || ''
                    )
                    .filter(Boolean)
            );
            routeSurfaces.forEach((surface) => surfaces.add(surface));
        }

        const values = Array.from(surfaces.values()).sort();
        expect(values.length).toBeGreaterThan(0);

        values.forEach((surface) => {
            expect(surface.startsWith('v2_')).toBeFalsy();
            expect(surface.startsWith('v3_')).toBeFalsy();
            expect(/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(surface)).toBeTruthy();
        });

        REQUIRED_SURFACES.forEach((surface) => {
            expect(values).toContain(surface);
        });
    });
});
