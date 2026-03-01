// @ts-check
const { test, expect } = require('@playwright/test');
const {
    getTrackedEvents,
    gotoPublicRoute,
    waitForAnalyticsBridge,
} = require('./helpers/public-v3');

test.describe('Public V3 analytics bridge', () => {
    test('home nav and stage CTAs emit contextual public events', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/');
        await waitForAnalyticsBridge(page);

        await page.evaluate(() => {
            [
                '.public-nav__cta',
                '[data-stage-slide].is-active a[data-cta-target="booking"]',
            ].forEach((selector) => {
                const link = document.querySelector(selector);
                if (link) {
                    link.addEventListener(
                        'click',
                        (event) => event.preventDefault(),
                        { once: true, capture: true }
                    );
                }
            });
        });

        await page.locator('.public-nav__cta').click();
        await page
            .locator(
                '[data-stage-slide].is-active a[data-cta-target="booking"]'
            )
            .click();

        await expect
            .poll(
                async () =>
                    (await getTrackedEvents(page, 'open_public_cta')).length
            )
            .toBeGreaterThanOrEqual(2);

        const events = await getTrackedEvents(page, 'open_public_cta');
        expect(
            events.some(
                (item) =>
                    item.source === 'home' &&
                    item.entry_point === 'nav_primary_booking' &&
                    item.cta_target === 'booking'
            )
        ).toBeTruthy();
        expect(
            events.some(
                (item) =>
                    item.source === 'home' &&
                    String(item.entry_point || '').startsWith('stage_') &&
                    item.cta_target === 'booking'
            )
        ).toBeTruthy();
    });

    test('service detail CTA keeps service metadata in the analytics bridge', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/en/services/botox/');
        await waitForAnalyticsBridge(page);

        await page.evaluate(() => {
            const link = document.querySelector(
                '[data-service-hero] a[data-analytics-event="start_booking_from_service"]'
            );
            if (link) {
                link.addEventListener(
                    'click',
                    (event) => event.preventDefault(),
                    { once: true, capture: true }
                );
            }
        });

        await page
            .locator(
                '[data-service-hero] a[data-analytics-event="start_booking_from_service"]'
            )
            .click();

        await expect
            .poll(
                async () =>
                    (await getTrackedEvents(page, 'start_booking_from_service'))
                        .length
            )
            .toBeGreaterThanOrEqual(1);

        const events = await getTrackedEvents(
            page,
            'start_booking_from_service'
        );
        expect(
            events.some(
                (item) =>
                    item.source === 'service_page' &&
                    item.service_slug === 'botox' &&
                    item.service_category === 'aesthetic' &&
                    item.service_intent === 'rejuvenation'
            )
        ).toBeTruthy();
    });

    test('legal support band CTAs emit legal-surface events', async ({
        page,
    }) => {
        await gotoPublicRoute(page, '/es/legal/terminos/');
        await waitForAnalyticsBridge(page);

        await page.evaluate(() => {
            [
                '[data-support-band] a[data-entry-surface="support_band_booking"]',
                '[data-support-band] a[data-entry-surface="support_band_telemedicine"]',
            ].forEach((selector) => {
                const link = document.querySelector(selector);
                if (link) {
                    link.addEventListener(
                        'click',
                        (event) => event.preventDefault(),
                        { once: true, capture: true }
                    );
                }
            });
        });

        await page
            .locator(
                '[data-support-band] a[data-entry-surface="support_band_booking"]'
            )
            .click();
        await page
            .locator(
                '[data-support-band] a[data-entry-surface="support_band_telemedicine"]'
            )
            .click();

        await expect
            .poll(
                async () =>
                    (await getTrackedEvents(page, 'open_public_cta')).length
            )
            .toBeGreaterThanOrEqual(2);

        const events = await getTrackedEvents(page, 'open_public_cta');
        expect(
            events.some(
                (item) =>
                    item.source === 'legal' &&
                    item.entry_point === 'support_band_booking' &&
                    item.cta_target === 'booking'
            )
        ).toBeTruthy();
        expect(
            events.some(
                (item) =>
                    item.source === 'legal' &&
                    item.entry_point === 'support_band_telemedicine' &&
                    item.cta_target === 'telemedicine'
            )
        ).toBeTruthy();
    });
});
