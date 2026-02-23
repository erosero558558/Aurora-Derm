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

        await expect(banner).not.toBeVisible();

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

        await expect(banner).not.toBeVisible();

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
        await expect(banner).not.toBeVisible();
    });

    test('GA4 no se carga sin consentimiento', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        // Rechazar cookies
        const rejectBtn = page.locator('#cookieRejectBtn');
        await rejectBtn.click({ force: true });
        await page.waitForTimeout(1000);

        const ga4Loaded = await page.evaluate(() => !!window._ga4Loaded);
        expect(ga4Loaded).toBe(false);
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

    test('Boton de preferencias reabre el banner', async ({ page }) => {
        // Aceptar primero
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        await page.locator('#cookieAcceptBtn').click({ force: true });
        await expect(banner).not.toBeVisible();

        // Clic en preferencias
        const prefsBtn = page.locator('#cookiePrefsBtn');
        await expect(prefsBtn).toBeVisible();
        await prefsBtn.click();

        await expect(banner).toBeVisible();
    });

    test('Revocar consentimiento actualiza estado a denied', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });

        // Aceptar
        await page.locator('#cookieAcceptBtn').click({ force: true });
        await expect(banner).not.toBeVisible();

        // Verificar signals de aceptacion en dataLayer
        const grantCalls = await page.evaluate(() => {
            return window.dataLayer.filter(args =>
                args[0] === 'consent' && args[1] === 'update' && args[2].analytics_storage === 'granted'
            );
        });
        expect(grantCalls.length).toBeGreaterThan(0);

        // Reabrir y Rechazar
        await page.locator('#cookiePrefsBtn').click();
        await expect(banner).toBeVisible();
        await page.locator('#cookieRejectBtn').click({ force: true });
        await expect(banner).not.toBeVisible();

        // Verificar signals de rechazo (denied)
        const denyCalls = await page.evaluate(() => {
            return window.dataLayer.filter(args =>
                args[0] === 'consent' && args[1] === 'update' && args[2].analytics_storage === 'denied'
            );
        });
        expect(denyCalls.length).toBeGreaterThan(0);

        // Verificar persistencia
        const consent = await page.evaluate(() => {
            const raw = localStorage.getItem('pa_cookie_consent_v1');
            return raw ? JSON.parse(raw) : null;
        });
        expect(consent.status).toBe('rejected');
    });
});
