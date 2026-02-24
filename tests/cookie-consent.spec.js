// @ts-check
const { test, expect } = require('@playwright/test');

async function getConsentModeCalls(page) {
    return page.evaluate(() => {
        const dl = Array.isArray(window.dataLayer) ? window.dataLayer : [];
        return dl.flatMap((item) => {
            const tuple =
                Array.isArray(item) ||
                (item &&
                    typeof item === 'object' &&
                    typeof item.length === 'number')
                    ? Array.from(item)
                    : null;

            if (
                !tuple ||
                tuple[0] !== 'consent' ||
                typeof tuple[1] !== 'string' ||
                !tuple[2] ||
                typeof tuple[2] !== 'object'
            ) {
                return [];
            }

            return [
                {
                    mode: tuple[1],
                    ...tuple[2],
                },
            ];
        });
    });
}

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

    test('Consent Mode mantiene analytics_storage denied al rechazar cookies', async ({
        page,
    }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        const rejectBtn = page.locator('#cookieRejectBtn');
        await rejectBtn.click({ force: true });

        // Verify consent mode via dataLayer (set by our cookie-consent code, not GTM).
        // Does not require the external GTM container to load.
        let consentCalls = [];
        await expect
            .poll(async () => {
                consentCalls = await getConsentModeCalls(page);
                return consentCalls.length;
            })
            .toBeGreaterThan(0);

        expect(consentCalls).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    mode: 'default',
                    analytics_storage: 'denied',
                }),
                expect.objectContaining({
                    mode: 'update',
                    analytics_storage: 'denied',
                }),
            ])
        );
    });

    test('GA4 se carga al aceptar cookies', async ({ page }) => {
        const banner = page.locator('#cookieBanner');
        await expect(banner).toBeVisible({ timeout: 10000 });
        const acceptBtn = page.locator('#cookieAcceptBtn');
        await acceptBtn.click({ force: true });

        await expect
            .poll(() => page.evaluate(() => !!window._ga4Loaded))
            .toBe(true);

        let consentCalls = [];
        await expect
            .poll(async () => {
                consentCalls = await getConsentModeCalls(page);
                return consentCalls.filter(
                    (item) =>
                        item.mode === 'update' &&
                        item.analytics_storage === 'granted'
                ).length;
            })
            .toBeGreaterThan(0);
    });
});
