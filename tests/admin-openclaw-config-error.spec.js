// @ts-check
const { test, expect } = require('@playwright/test');
const {
    buildOpenClawAdminChallenge,
    installOpenClawAdminAuthMock,
} = require('./helpers/admin-auth-mocks');
const { installBasicAdminApiMocks } = require('./helpers/admin-api-mocks');

test.describe('Admin OpenClaw config error', () => {
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

    test('cierra el challenge previo cuando el backend responde no configurado al iniciar sesion', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            anonymousPayload: {
                status: 'pending',
                challenge: buildOpenClawAdminChallenge(),
            },
            startPayload: {
                status: 'operator_auth_not_configured',
                error:
                    'Configuracion incompleta de OpenClaw/ChatGPT. Falta: PIELARMONIA_OPERATOR_AUTH_MODE, PIELARMONIA_OPERATOR_AUTH_ALLOWLIST.',
                challenge: null,
            },
        });

        await page.goto('/admin.html');

        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeVisible();

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'OpenClaw no configurado'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeHidden();
        await expect
            .poll(() => page.evaluate(() => window.__openClawWindowCalls))
            .toEqual([]);
    });
});
