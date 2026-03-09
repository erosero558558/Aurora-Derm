const { expect } = require('@playwright/test');
const {
    getTrackedEvents,
    gotoPublicRoute,
    hideDynamicUi,
    waitForAnalyticsBridge,
    waitForBookingStatus,
} = require('./public-v6');

async function waitForBookingHooks(page, expectedValue) {
    await expect(page.locator('#v5-booking, #citas')).toBeVisible();
    await expect(
        page.locator('#v5-booking-form, #appointmentForm')
    ).toBeVisible({
        timeout: 20000,
    });
    await expect(
        page.locator('#v5-service-select, #serviceSelect')
    ).toBeVisible({
        timeout: 20000,
    });
    if (expectedValue) {
        await expect
            .poll(
                async () =>
                    page.evaluate(() => {
                        const select =
                            document.getElementById('v5-service-select') ||
                            document.getElementById('serviceSelect');
                        return select ? select.value : '';
                    }),
                { timeout: 12000 }
            )
            .toBe(expectedValue);
    }
}

module.exports = {
    getTrackedEvents,
    gotoPublicRoute,
    hideDynamicUi,
    waitForAnalyticsBridge,
    waitForBookingHooks,
    waitForBookingStatus,
};
