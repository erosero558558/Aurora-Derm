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
        await expect(page.locator('#loginFallbackToggleBtn')).toBeHidden();
        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            'OpenClaw en este equipo'
        );
        await expect(page.locator('#adminLoginStepSummary')).not.toContainText(
            'readiness'
        );
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
            'Codigo temporal activo'
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
            'Esta cuenta no tiene permiso'
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
            'Codigo vencido'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'expiro'
        );
        await expect(page.locator('#loginBtn')).toHaveText(
            'Generar nuevo codigo'
        );
    });

    test('conserva el challenge y permite alternar a contingencia cuando expira el codigo', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            fallbackAvailable: true,
            terminalStatus: 'challenge_expirado',
            terminalError:
                'El codigo ya expiro. Genera un nuevo challenge para continuar.',
            pollsBeforeTerminal: 1,
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Codigo vencido'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#adminOpenClawManualCode')).toHaveText(
            '9F38F7-D8D6D4'
        );
        await expect(page.locator('#adminOpenClawHelperLink')).toBeVisible();
        await expect(page.locator('#loginFallbackToggleBtn')).toBeVisible();

        await page.locator('#loginFallbackToggleBtn').click();

        await expect(page.locator('#legacyLoginStage')).toBeVisible();
        await expect(page.locator('#openclawLoginStage')).toBeHidden();
        await expect(page.locator('#loginPrimaryToggleBtn')).toBeVisible();
        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            'Clave + 2FA solo como contingencia'
        );

        await page.locator('#loginPrimaryToggleBtn').click();

        await expect(page.locator('#openclawLoginStage')).toBeVisible();
        await expect(page.locator('#legacyLoginStage')).toBeHidden();
        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            'OpenClaw en este equipo'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#adminOpenClawManualCode')).toHaveText(
            '9F38F7-D8D6D4'
        );
    });

    test('muestra la contingencia web solo cuando el backend la anuncia y permite entrar con clave + 2FA', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            fallbackAvailable: true,
            terminalStatus: 'helper_no_disponible',
            terminalError:
                'No se pudo contactar al helper local de OpenClaw en este equipo.',
            pollsBeforeTerminal: 1,
        });

        await page.goto('/admin.html');

        await expect(page.locator('#loginFallbackToggleBtn')).toBeVisible();
        await expect(page.locator('#adminLoginContingencyCopy')).toContainText(
            'helper local'
        );

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'No encontramos el helper local'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeVisible();
        await expect(page.locator('#loginFallbackToggleBtn')).toBeVisible();

        await page.locator('#loginFallbackToggleBtn').click();

        await expect(page.locator('#legacyLoginStage')).toBeVisible();
        await expect(page.locator('#openclawLoginStage')).toBeHidden();
        await expect(page.locator('#loginPrimaryToggleBtn')).toBeVisible();
        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            'Clave + 2FA solo como contingencia'
        );

        await page.locator('#adminPassword').fill('contingencia-segura');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#group2FA')).toBeVisible();
        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            '2FA de contingencia'
        );

        await page.locator('#admin2FACode').fill('123456');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            'Sesion activa'
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            '2FA validado'
        );
    });

    test('web broker redirige en la misma pestana y vuelve autenticado sin helper local', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            transport: 'web_broker',
            webBroker: {
                redirectUrl:
                    'https://broker.example.test/authorize?state=admin-web-broker',
            },
        });
        await page.route('https://broker.example.test/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: `<!doctype html><meta charset="utf-8"><script>
const referrer = String(document.referrer || '');
const base = referrer ? new URL(referrer).origin : window.location.origin;
window.location.replace(new URL('/admin.html?callback=web_broker_success', base).toString());
</script>`,
            });
        });

        await page.goto('/admin.html');

        await expect(page.locator('#openclawLoginStage')).toBeVisible();
        await expect(page.locator('#legacyLoginStage')).toBeHidden();
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeHidden();
        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            'OpenClaw en navegador'
        );
        await expect(page.locator('#adminLoginSupportCopy')).toContainText(
            'misma pestana'
        );
        await expect(page.locator('#adminLoginStepSummary')).not.toContainText(
            'readiness'
        );

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            'Sesion activa'
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            'OpenClaw validado'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeHidden();
        await expect(page.locator('#adminOpenClawManualCode')).toHaveText('-');
    });

    test('web broker conserva el intento pendiente al volver o recargar y lo retoma sin crear otro start', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        const authMock = await installOpenClawAdminAuthMock(page, {
            transport: 'web_broker',
            pendingStatusCallsAfterStart: 2,
            webBroker: {
                redirectUrl:
                    'https://broker.example.test/authorize?state=admin-web-broker-resume',
            },
        });
        let brokerVisits = 0;
        await page.route('https://broker.example.test/**', async (route) => {
            brokerVisits += 1;
            const targetPath =
                brokerVisits === 1
                    ? '/admin.html?resume=web_broker_pending'
                    : '/admin.html?callback=web_broker_success';
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: `<!doctype html><meta charset="utf-8"><script>
const referrer = String(document.referrer || '');
const base = referrer ? new URL(referrer).origin : window.location.origin;
window.location.replace(new URL(${JSON.stringify(targetPath)}, base).toString());
</script>`,
            });
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Acceso web pendiente'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'intento web sigue activo'
        );
        await expect(page.locator('#loginBtn')).toHaveText('Retomar OpenClaw');
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeHidden();
        await expect.poll(() => authMock.getStartCount()).toBe(1);

        await page.reload();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Acceso web pendiente'
        );
        await expect(page.locator('#loginBtn')).toHaveText('Retomar OpenClaw');

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            'Sesion activa'
        );
        await expect.poll(() => authMock.getStartCount()).toBe(1);
        await expect.poll(() => brokerVisits).toBe(2);
    });

    test('web broker muestra error de callback sin helper local ni polling', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            transport: 'web_broker',
            terminalStatus: 'identity_missing',
            terminalError:
                'OpenClaw no devolvio una identidad utilizable para este panel.',
            webBroker: {
                redirectUrl:
                    'https://broker.example.test/authorize?state=admin-web-broker-error',
            },
        });
        await page.route('https://broker.example.test/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: `<!doctype html><meta charset="utf-8"><script>
const referrer = String(document.referrer || '');
const base = referrer ? new URL(referrer).origin : window.location.origin;
window.location.replace(new URL('/admin.html?callback=web_broker_error', base).toString());
</script>`,
            });
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Identidad incompleta'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'no devolvio una identidad'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(
            'Reintentar en OpenClaw'
        );
    });

    test('web broker muestra cuando el broker no confirma email verificado', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            transport: 'web_broker',
            terminalStatus: 'identity_unverified',
            terminalError:
                'OpenClaw autentico la cuenta, pero no confirmo un email verificado para este panel.',
            webBroker: {
                redirectUrl:
                    'https://broker.example.test/authorize?state=admin-web-broker-unverified',
            },
        });
        await page.route('https://broker.example.test/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: `<!doctype html><meta charset="utf-8"><script>
const referrer = String(document.referrer || '');
const base = referrer ? new URL(referrer).origin : window.location.origin;
window.location.replace(new URL('/admin.html?callback=web_broker_unverified', base).toString());
</script>`,
            });
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Email no verificado'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'email verificado'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
    });

    test('web broker muestra cuando los claims firmados no pasan validacion', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            transport: 'web_broker',
            terminalStatus: 'broker_claims_invalid',
            terminalError:
                'No pudimos validar los claims firmados que devolvio OpenClaw para este acceso.',
            webBroker: {
                redirectUrl:
                    'https://broker.example.test/authorize?state=admin-web-broker-claims',
            },
        });
        await page.route('https://broker.example.test/**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html; charset=utf-8',
                body: `<!doctype html><meta charset="utf-8"><script>
const referrer = String(document.referrer || '');
const base = referrer ? new URL(referrer).origin : window.location.origin;
window.location.replace(new URL('/admin.html?callback=web_broker_claims', base).toString());
</script>`,
            });
        });

        await page.goto('/admin.html');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Identidad no confiable'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'claims firmados'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
    });

    test('bloquea localhost cuando OpenClaw responde sin transport y muestra runtime desalineado', async ({
        page,
    }) => {
        await installBasicAdminApiMocks(page, {
            healthPayload: {
                status: 'ok',
            },
        });
        await installOpenClawAdminAuthMock(page, {
            anonymousPayload: {
                transport: '',
                status: 'transport_misconfigured',
                configured: false,
                error: 'El runtime devolvio un estado OpenClaw sin transport valido.',
            },
            startPayload: {
                transport: '',
                status: 'transport_misconfigured',
                configured: false,
                error: 'El runtime devolvio un estado OpenClaw sin transport valido.',
            },
        });

        await page.goto('/admin.html');

        await expect(page.locator('#adminLoginRouteTitle')).toHaveText(
            'Runtime de OpenClaw desalineado'
        );
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Runtime de OpenClaw desalineado'
        );
        await expect(page.locator('#adminOpenClawChallengeCard')).toBeHidden();
        await expect(page.locator('#adminOpenClawHelperLink')).toBeHidden();
        await expect(page.locator('#adminLoginSupportCopy')).toContainText(
            'transport=web_broker'
        );

        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            'Runtime de OpenClaw desalineado'
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'sin transport valido'
        );
        await expect
            .poll(() => page.evaluate(() => window.__openClawWindowCalls))
            .toEqual([]);
    });
});
