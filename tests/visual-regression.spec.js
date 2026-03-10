// @ts-check
const { test, expect } = require('@playwright/test');
const {
    gotoPublicRoute,
    hideDynamicUi,
    waitForBookingStatus,
    waitForHomeV6Runtime,
} = require('./helpers/public-v6');

test.use({
    serviceWorkers: 'block',
});

async function prepareStableVisualState(page) {
    await page.addInitScript(() => {
        try {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'accepted',
                    at: '2026-01-01T00:00:00.000Z',
                })
            );
        } catch (_) {
            // Ignore storage failures in locked-down contexts.
        }
    });
}

async function stabilizeDynamicUi(page) {
    await hideDynamicUi(page);
    await page.evaluate(() => {
        document.querySelectorAll('[data-v6-back-top]').forEach((node) => {
            if (node instanceof HTMLElement) {
                node.style.display = 'none';
            }
        });
    });
}

async function openStableHome(page, route = '/es/') {
    await prepareStableVisualState(page);
    await gotoPublicRoute(page, route);
    await waitForHomeV6Runtime(page);
    await waitForBookingStatus(page, 'Reserva online en mantenimiento');
    await stabilizeDynamicUi(page);
}

test.describe('@visual Pruebas de regresion visual', () => {
    test('visual-home-desktop-stable-v2', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 1200 });
        await openStableHome(page, '/es/');

        await expect(page).toHaveScreenshot({
            animations: 'disabled',
            caret: 'hide',
            fullPage: true,
            timeout: 30000,
            maxDiffPixelRatio: 0.12,
        });
    });

    test('visual-home-mobile-stable-v2', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await openStableHome(page, '/es/');

        await expect(page).toHaveScreenshot({
            animations: 'disabled',
            caret: 'hide',
            fullPage: false,
            timeout: 30000,
            maxDiffPixelRatio: 0.12,
        });
    });

    test('visual-booking-section-stable-v2', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 960 });
        await openStableHome(page, '/es/');

        const bookingStatus = page.locator('[data-v6-booking-status]').first();
        await bookingStatus.scrollIntoViewIfNeeded();
        await expect(bookingStatus).toHaveScreenshot({
            animations: 'disabled',
            caret: 'hide',
            timeout: 30000,
            maxDiffPixelRatio: 0.08,
        });
    });

    test('visual-admin-login-stable-v2', async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 960 });
        await prepareStableVisualState(page);
        await page.goto('/admin.html');
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ui',
            'sony_v3'
        );
        await expect(page.locator('html')).toHaveAttribute(
            'data-admin-ready',
            'true'
        );
        await expect(page.locator('#loginForm')).toBeVisible();

        await expect(page).toHaveScreenshot({
            animations: 'disabled',
            caret: 'hide',
            timeout: 30000,
            maxDiffPixelRatio: 0.08,
        });
    });
});
