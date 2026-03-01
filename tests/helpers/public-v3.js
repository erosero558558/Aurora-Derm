const { expect } = require('@playwright/test');

async function gotoPublicRoute(page, route) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(400);
}

async function waitForBookingHooks(page, expectedValue) {
    await expect(page.locator('#citas')).toBeVisible();
    await expect(page.locator('#appointmentForm')).toBeVisible({
        timeout: 20000,
    });
    await expect(page.locator('#serviceSelect')).toBeVisible({
        timeout: 20000,
    });
    if (expectedValue) {
        await expect
            .poll(
                async () =>
                    page.evaluate(() => {
                        const select = document.getElementById('serviceSelect');
                        return select ? select.value : '';
                    }),
                { timeout: 12000 }
            )
            .toBe(expectedValue);
    }
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

module.exports = {
    getTrackedEvents,
    gotoPublicRoute,
    hideDynamicUi,
    waitForAnalyticsBridge,
    waitForBookingHooks,
};
