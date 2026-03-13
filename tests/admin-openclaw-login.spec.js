// @ts-check
const { test, expect } = require('@playwright/test');
const { installOpenClawAdminAuthMock } = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test.describe('Admin OpenClaw login', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => {
            window.__openClawWindowCalls = [];
            window.open = (url) => {
                window.__openClawWindowCalls.push(String(url || ''));
                return {
                    closed: false,
                    close() {},
                    focus() {},
                };
            };
        });
    });

    test('oculta password y 2FA cuando el backend exige OpenClaw y completa el login con polling', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page);

        await page.goto('/admin.html');

        await expect(page.locator('#openclawLoginStage')).toBeVisible();
        await expect(page.locator('#legacyLoginStage')).toBeHidden();
        await expect(page.locator('#adminPassword')).toBeHidden();
        await expect(page.locator('#group2FA')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(
            'Continuar con OpenClaw'
        );

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#adminOpenClawManualCode')).toHaveText(
            '9F38F7-D8D6D4'
        );
        await expect(page.locator('#adminOpenClawHelperLink')).toBeVisible();
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Challenge activo'
        );

        await expect
            .poll(() => page.evaluate(() => window.__openClawWindowCalls))
            .toContain(
                'http://127.0.0.1:4173/resolve?challengeId=9f38f7d8d6d44da7b3d45a1f315dabc1&nonce=4c671989f3f6470db37ac0ecb127aa82'
            );

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            'Sesion activa'
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            'OpenClaw validado'
        );
    });

    test('muestra estado terminal cuando el email autenticado no esta permitido', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            terminalStatus: 'email_no_permitido',
            terminalError:
                'La identidad resuelta por OpenClaw no esta autorizada para operar este panel.',
            pollsBeforeTerminal: 1,
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Email no permitido'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'no esta autorizada'
        );
        await expect(page.locator('#loginBtn')).toHaveText(
            'Generar nuevo codigo'
        );
    });

    test('muestra estado terminal cuando el challenge expira', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            terminalStatus: 'challenge_expirado',
            terminalError:
                'El codigo ya expiro. Genera un nuevo challenge para continuar.',
            pollsBeforeTerminal: 1,
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Challenge expirado'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'expiro'
        );
        await expect(page.locator('#loginBtn')).toHaveText(
            'Generar nuevo codigo'
        );
    });
});
