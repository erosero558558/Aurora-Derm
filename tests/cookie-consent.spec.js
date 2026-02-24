// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Consentimiento de cookies', () => {
    test.beforeEach(async ({ page }) => {
        // Limpiar localStorage para que aparezca el banner
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
    });

    test('banner de cookies aparece sin consentimiento previo', async ({
        page,
    }) => {
        const banner = page.locator('#cookieBanner');
        // El banner puede tardar en aparecer si la inicializacion es diferida
        await expect(banner).toBeVisible({ timeout: 10000 });
    });

    test('aceptar cookies oculta el banner', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        const acceptBtn = page.locator('#cookieAcceptBtn');
        await acceptBtn.click({ force: true });

        await expect(banner).toBeHidden();

        // Verificar que se guardó el consentimiento
        const consent = await page.evaluate(() => {
            const raw = localStorage.getItem('pa_cookie_consent_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(consent).not.toBeNull();
        expect(consent.status).toBe('accepted');
    });

    test('rechazar cookies oculta el banner', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        const rejectBtn = page.locator('#cookieRejectBtn');
        await rejectBtn.click({ force: true });

        await expect(banner).toBeHidden();

        const consent = await page.evaluate(() => {
            const raw = localStorage.getItem('pa_cookie_consent_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(consent).not.toBeNull();
        expect(consent.status).toBe('rejected');
    });

    test('banner no aparece si ya se aceptó', async ({ page }) => {
        // Aceptar cookies
        await page.evaluate(() => {
            localStorage.setItem(
                'pa_cookie_consent_v1',
                JSON.stringify({
                    status: 'accepted',
                    at: new Date().toISOString(),
                })
            );
        });
        await page.reload();

        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeHidden();
    });

    test('GA4 no se carga sin consentimiento', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        // Rechazar cookies
        const rejectBtn = page.locator('#cookieRejectBtn');
        await rejectBtn.click({ force: true });
        await page.waitForTimeout(1000);

        const consentState = await page.evaluate(() => {
            const raw = localStorage.getItem('pa_cookie_consent_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(consentState).not.toBeNull();
        expect(consentState.status).toBe('rejected');

        const hasGrantedConsent = await page.evaluate(() => {
            const layer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
            return layer.some((entry) => {
                const args = Array.from(entry || []);
                const isConsentUpdate =
                    args[0] === 'consent' && args[1] === 'update';
                if (!isConsentUpdate || typeof args[2] !== 'object' || !args[2]) {
                    return false;
                }
                return args[2].analytics_storage === 'granted';
            });
        });
        expect(hasGrantedConsent).toBe(false);
    });

    test('GA4 se carga al aceptar cookies', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        const acceptBtn = page.locator('#cookieAcceptBtn');
        await acceptBtn.click({ force: true });
        await page.waitForTimeout(2000);

        const ga4Loaded = await page.evaluate(() => !!window._ga4Loaded);
        expect(ga4Loaded).toBe(true);
    });
});
