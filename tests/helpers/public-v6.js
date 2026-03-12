const { expect } = require('@playwright/test');

async function gotoPublicRoute(page, route) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(400);
}

async function waitForBookingStatus(page, expectedText) {
    const status = page.locator('[data-v6-booking-status]').first();
    await expect(status).toBeVisible({ timeout: 20000 });
    if (expectedText) {
        await expect(status).toContainText(expectedText);
    }
}

async function expectNoLegacyPublicShell(page) {
    const legacySelectors = [
        '[data-public-nav]',
        '[data-stage-carousel]',
        '[data-booking-bridge-band]',
        '#appointmentForm',
        '#serviceSelect',
        '#citas',
        '[data-legal-hero]',
        '[data-service-hero]',
        '[data-telemedicine-hero]',
    ];

    for (const selector of legacySelectors) {
        await expect(
            page.locator(selector),
            `${selector} should not be present on the V6 public surface`
        ).toHaveCount(0);
    }
}

async function waitForHomeV6Runtime(page) {
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const header = document.querySelector('[data-v6-header]');
                    const hero = document.querySelector('[data-v6-hero]');
                    const strip = document.querySelector(
                        '[data-v6-news-strip]'
                    );
                    return {
                        mega: header?.dataset.v6MegaReady || '',
                        drawer: header?.dataset.v6DrawerReady || '',
                        search: header?.dataset.v6SearchReady || '',
                        hero: hero?.dataset.v6HeroReady || '',
                        news: strip?.dataset.v6NewsReady || '',
                    };
                }),
            { timeout: 15000 }
        )
        .toEqual({
            mega: 'true',
            drawer: 'true',
            search: 'true',
            hero: 'true',
            news: 'true',
        });
}

async function waitForShellV6Runtime(page) {
    await expect
        .poll(
            () =>
                page.evaluate(() => {
                    const header = document.querySelector('[data-v6-header]');
                    return {
                        mega: header?.dataset.v6MegaReady || '',
                        drawer: header?.dataset.v6DrawerReady || '',
                        search: header?.dataset.v6SearchReady || '',
                    };
                }),
            { timeout: 15000 }
        )
        .toEqual({
            mega: 'true',
            drawer: 'true',
            search: 'true',
        });
}

async function hideDynamicUi(page) {
    await page.evaluate(() => {
        ['#cookieBanner', '#chatbotWidget', '.quick-dock'].forEach(
            (selector) => {
                document.querySelectorAll(selector).forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.style.display = 'none';
                    }
                });
            }
        );
    });
}

async function getTrackedEvents(page, eventName) {
    return page.evaluate((name) => {
        const dl = Array.isArray(window.dataLayer) ? window.dataLayer : [];
        return dl
            .map((item) => {
                if (
                    item &&
                    typeof item === 'object' &&
                    !Array.isArray(item) &&
                    item.event
                ) {
                    return item;
                }

                if (
                    item &&
                    typeof item === 'object' &&
                    item[0] === 'event' &&
                    typeof item[1] === 'string'
                ) {
                    return Object.assign(
                        { event: item[1] },
                        item[2] && typeof item[2] === 'object' ? item[2] : {}
                    );
                }

                return null;
            })
            .filter((item) => item && item.event === name);
    }, eventName);
}

async function waitForAnalyticsBridge(page) {
    await expect
        .poll(
            async () =>
                page.evaluate(() =>
                    Array.isArray(window.dataLayer)
                        ? window.dataLayer.length
                        : 0
                ),
            { timeout: 15000 }
        )
        .toBeGreaterThan(0);
}

async function findLocaleSwitch(page) {
    const homeSwitch = page
        .locator('[data-v6-news-strip] .v6-news-strip__lang')
        .first();
    if ((await homeSwitch.count()) > 0) {
        return homeSwitch;
    }

    return page
        .locator('[data-v6-page-head] .v6-corp-head__lang-option[href]')
        .first();
}

module.exports = {
    expectNoLegacyPublicShell,
    findLocaleSwitch,
    getTrackedEvents,
    gotoPublicRoute,
    hideDynamicUi,
    waitForAnalyticsBridge,
    waitForBookingStatus,
    waitForHomeV6Runtime,
    waitForShellV6Runtime,
};
