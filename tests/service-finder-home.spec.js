// @ts-check
const { test, expect } = require('@playwright/test');
const { gotoPublicRoute } = require('./helpers/public-v3');

test.describe('Home editorial catalogue V3', () => {
    test('program family grid links into the catalogue by category', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');

        const cards = page.locator('[data-program-grid] .program-grid__card');
        await expect(cards).toHaveCount(3);
        await expect(
            cards.nth(0).locator('a[data-analytics-event="open_public_cta"]')
        ).toHaveAttribute('href', /\/es\/servicios\/\?category=/);
    });

    test('doctor authority band exposes direct service routes', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/');

        const doctorCards = page.locator(
            '[data-doctor-band] .doctor-band__card'
        );
        await expect(doctorCards).toHaveCount(2);
        await expect(doctorCards.nth(0).locator('a').first()).toHaveAttribute(
            'href',
            /^\/en\/services\//
        );
    });

    test('latest strip keeps the reduced editorial pulse instead of the old finder', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await expect(
            page.locator('[data-latest-news] .latest-strip__item')
        ).toHaveCount(3);
        await expect(page.locator('[data-service-finder]')).toHaveCount(0);
    });
});
