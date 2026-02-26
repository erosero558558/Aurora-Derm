// @ts-check
const { test, expect } = require('@playwright/test');

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
        } catch (e) {
            // no-op
        }
    });
}

async function stabilizeDynamicUi(page) {
    await page.evaluate(() => {
        const selectors = ['#cookieBanner', '#chatbotWidget', '.quick-dock'];
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((node) => {
                if (node instanceof HTMLElement) {
                    node.style.display = 'none';
                }
            });
        });
    });
}

test.describe('@visual Pruebas de regresion visual', () => {
    test('visual-home-desktop-stable-v2', async ({ page }) => {
        await prepareStableVisualState(page);

        // Navegar a la página de inicio
        await page.goto('/');

        // Esperar a que la carga termine
        await page.waitForLoadState('load');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // Allow layout to settle
        await stabilizeDynamicUi(page);

        // Tomar una captura de pantalla de toda la página
        await expect(page).toHaveScreenshot({
            fullPage: true,
            timeout: 30000,
            maxDiffPixelRatio: 0.12,
        });
    });

    test('visual-home-mobile-stable-v2', async ({ page }) => {
        await prepareStableVisualState(page);

        // Configurar viewport móvil (iPhone SE / Pixel 5 size approx)
        await page.setViewportSize({ width: 375, height: 667 });

        // Navegar a la página de inicio
        await page.goto('/');

        // Esperar a que la carga termine
        await page.waitForLoadState('load');
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000); // Allow layout to settle
        await stabilizeDynamicUi(page);

        // Tomar una captura de pantalla del viewport (más estable que fullPage en móvil)
        await expect(page).toHaveScreenshot({
            fullPage: false,
            timeout: 30000,
            maxDiffPixelRatio: 0.12,
        });
    });

    test('visual-booking-section-stable-v2', async ({ page }) => {
        await prepareStableVisualState(page);
        await page.goto('/');
        await stabilizeDynamicUi(page);

        // Scroll hasta la sección de citas para activar lazy load
        const bookingSection = page.locator('#citas');
        await bookingSection.scrollIntoViewIfNeeded();

        // Esperar a que el formulario sea visible (indica que el JS cargó)
        const bookingForm = page.locator('#appointmentForm');
        await expect(bookingForm).toBeVisible({ timeout: 20000 });

        // Esperar un poco más para asegurar renderizado completo
        await page.waitForTimeout(2000);

        // Tomar screenshot solo de la sección de citas
        await expect(bookingSection).toHaveScreenshot({
            timeout: 30000,
            maxDiffPixelRatio: 0.08,
        });
    });

    test('visual-admin-login-stable-v2', async ({ page }) => {
        await prepareStableVisualState(page);
        await page.goto('/admin.html');

        // Esperar a que el formulario de login sea visible
        const loginForm = page.locator('#loginForm');
        await expect(loginForm).toBeVisible();

        // Tomar screenshot de la página de login
        await expect(page).toHaveScreenshot();
    });
});
