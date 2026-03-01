// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Home deferred hydration', () => {
    test('keeps the Public V3 shell visible and boots the legacy runtime bridge on home', async ({
        page,
    }) => {
        await page.goto('/es/');
        await page
            .waitForLoadState('load', { timeout: 20000 })
            .catch(() => null);

        await expect(page.locator('[data-public-nav]')).toBeVisible();
        await expect(page.locator('[data-stage-carousel]')).toBeVisible();
        await expect(page.locator('[data-program-grid]')).toBeVisible();
        await expect(page.locator('[data-booking-bridge-band]')).toBeVisible();

        await expect
            .poll(
                async () =>
                    page.evaluate(
                        () =>
                            document.documentElement.dataset
                                .publicV3RuntimeBooted || ''
                    ),
                { timeout: 15000 }
            )
            .toBe('true');

        const chatbotToggle = page.locator('#chatbotWidget .chatbot-toggle');
        await expect(chatbotToggle).toBeVisible({ timeout: 15000 });
        await expect(page.locator('#appointmentForm')).toBeVisible({
            timeout: 15000,
        });
    });
});
