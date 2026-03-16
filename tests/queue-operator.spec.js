// @ts-check
const { test, expect } = require('@playwright/test');
const {
    buildOperatorAuthChallenge,
    buildOpenClawBrokerRedirect,
    buildOperatorQueueState,
    buildOperatorQueueTicket,
    installLegacyAdminAuthMock,
    installOperatorOpenClawAuthMock,
    installWindowOpenRecorder,
} = require('./helpers/admin-auth-mocks');
const {
    installTurneroClinicProfileFailure,
    installTurneroClinicProfileMock,
    installTurneroQueueStateMock,
} = require('./helpers/turnero-surface-mocks');

function json(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function operatorUrl(query = '') {
    const params = new URLSearchParams(String(query || ''));
    const search = params.toString();
    return `/operador-turnos.html${search ? `?${search}` : ''}`;
}

async function installOperatorApiMock(
    page,
    {
        failQueueState = () => false,
        getQueueTickets = () => [],
        setQueueTickets = () => {},
        getQueueState = () => ({}),
        setQueueState = () => {},
        heartbeatRequests = null,
        heartbeatPayloads = null,
        queueCallNextRequests = null,
    } = {}
) {
    await installTurneroQueueStateMock(page, {
        queueStateResponse() {
            if (failQueueState()) {
                return {
                    ok: false,
                    error: 'queue_state_unavailable',
                };
            }

            return {
                ok: true,
                data: getQueueState(),
            };
        },
        queueStateStatus() {
            return failQueueState() ? 503 : 200;
        },
        async handleApiRoute({ resource, request, route }) {
            if (resource === 'queue-surface-heartbeat') {
                let body;
                let parsedBody = true;
                try {
                    body = request.postDataJSON() || {};
                } catch (_error) {
                    body = {};
                    parsedBody = false;
                }

                if (Array.isArray(heartbeatPayloads)) {
                    heartbeatPayloads.push(parsedBody ? body : null);
                }

                if (Array.isArray(heartbeatRequests)) {
                    heartbeatRequests.push({
                        method: request.method(),
                        url: request.url(),
                        body,
                    });
                }

                await json(route, {
                    ok: true,
                    data: { accepted: true },
                });
                return true;
            }

            if (resource === 'data') {
                await json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {},
                        queue_tickets: getQueueTickets(),
                        queueMeta: getQueueState(),
                    },
                });
                return true;
            }

            if (resource === 'queue-call-next') {
                if (Array.isArray(queueCallNextRequests)) {
                    queueCallNextRequests.push({
                        method: request.method(),
                        url: request.url(),
                    });
                }

                const currentQueueTickets = getQueueTickets();
                const calledTicket = {
                    ...currentQueueTickets[0],
                    status: 'called',
                    assignedConsultorio: 2,
                    calledAt: new Date().toISOString(),
                };
                const nextQueueTickets = [calledTicket];
                const nextQueueState = buildOperatorQueueState(
                    nextQueueTickets,
                    {
                        nextTickets: [],
                    }
                );

                setQueueTickets(nextQueueTickets);
                setQueueState(nextQueueState);

                await json(route, {
                    ok: true,
                    data: {
                        ticket: calledTicket,
                        queueState: nextQueueState,
                    },
                });
                return true;
            }

            if (resource === 'queue-ticket') {
                await json(route, {
                    ok: true,
                    data: {
                        ticket: getQueueTickets()[0],
                        queueState: getQueueState(),
                    },
                });
                return true;
            }

            if (resource === 'health' || resource === 'funnel-metrics') {
                await json(route, { ok: true, data: {} });
                return true;
            }

            return false;
        },
    });
}

async function setupOperatorAuthOperatorMocks(
    page,
    {
        statusResponses = null,
        startPayload = null,
        startResponses = null,
        failQueueStateInitially = false,
        transport = 'local_helper',
        webBrokerRedirectUrl = '',
    } = {}
) {
    let failQueueState = Boolean(failQueueStateInitially);
    let queueTickets = [buildOperatorQueueTicket()];
    let queueState = buildOperatorQueueState(queueTickets);

    function buildStartResponse(payload = {}) {
        const resolvedTransport =
            String(payload.transport || transport).trim().toLowerCase() ===
            'web_broker'
                ? 'web_broker'
                : 'local_helper';
        if (resolvedTransport === 'web_broker') {
            return {
                ok: true,
                authenticated: false,
                mode: 'openclaw_chatgpt',
                status: 'pending',
                ...(payload || {}),
                ...buildOpenClawBrokerRedirect({
                    redirectUrl:
                        payload.redirectUrl ||
                        webBrokerRedirectUrl ||
                        'https://broker.example.test/authorize?state=queue-operator-web-broker',
                    expiresAt: payload.expiresAt,
                }),
            };
        }

        const challenge = buildOperatorAuthChallenge(
            payload && payload.challenge ? payload.challenge : {}
        );
        const resolvedChallenge =
            payload && payload.challenge
                ? {
                      ...challenge,
                      ...payload.challenge,
                  }
                : challenge;

        return {
            ok: true,
            authenticated: false,
            mode: 'openclaw_chatgpt',
            status: 'pending',
            ...(payload || {}),
            challenge: resolvedChallenge,
        };
    }

    const preparedStartResponses =
        Array.isArray(startResponses) && startResponses.length > 0
            ? startResponses.map((entry) => buildStartResponse(entry || {}))
            : [buildStartResponse(startPayload || {})];
    const startResponse =
        preparedStartResponses[0] || buildStartResponse(startPayload || {});
    const defaultStatusResponses = [
        {
            ok: true,
            authenticated: false,
            mode: 'openclaw_chatgpt',
            status: 'anonymous',
            transport,
        },
        {
            ok: true,
            authenticated: false,
            mode: 'openclaw_chatgpt',
            status: 'pending',
            transport,
            ...(transport === 'web_broker'
                ? {
                      redirectUrl: startResponse.redirectUrl,
                      expiresAt: startResponse.expiresAt,
                  }
                : {
                      challenge: startResponse.challenge,
                  }),
        },
        {
            ok: true,
            authenticated: true,
            mode: 'openclaw_chatgpt',
            status: 'autenticado',
            transport,
            csrfToken: 'csrf_operator_auth',
            operator: {
                email: 'operator@example.com',
                source: 'openclaw_chatgpt',
            },
        },
    ];

    const heartbeatRequests = [];
    const queueCallNextRequests = [];
    const authSession = await installOperatorOpenClawAuthMock(page, {
        transport,
        statusResponses: Array.isArray(statusResponses)
            ? statusResponses
            : defaultStatusResponses,
        startResponses: preparedStartResponses,
    });
    await installOperatorApiMock(page, {
        failQueueState: () => failQueueState,
        getQueueTickets: () => queueTickets,
        setQueueTickets(nextQueueTickets) {
            queueTickets = nextQueueTickets;
        },
        getQueueState: () => queueState,
        setQueueState(nextQueueState) {
            queueState = nextQueueState;
        },
        heartbeatRequests,
        queueCallNextRequests,
    });

    if (transport === 'web_broker') {
        let brokerVisits = 0;
        await page.route('https://broker.example.test/**', async (route) => {
            brokerVisits += 1;
            const targetPath =
                brokerVisits === 1
                    ? operatorUrl(
                          'station=c2&lock=1&one_tap=1&resume=web_broker_pending'
                      )
                    : operatorUrl(
                          'station=c2&lock=1&one_tap=1&callback=web_broker_success'
                      );
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
    }

    return {
        challenge: startResponse.challenge,
        startRequests: authSession.startRequests,
        heartbeatRequests,
        queueCallNextRequests,
    };
}

async function mockOperatorSurface(page, overrides = {}) {
    let failQueueState = Boolean(overrides.failQueueStateInitially);
    const heartbeatPayloads = [];
    const heartbeatRequests = [];
    const queueCallNextRequests = [];
    let queueTickets = [buildOperatorQueueTicket()];
    let queueState = buildOperatorQueueState(queueTickets);

    await installLegacyAdminAuthMock(page, {
        csrfToken: 'csrf_operator',
    });
    await installOperatorApiMock(page, {
        failQueueState: () => failQueueState,
        getQueueTickets: () => queueTickets,
        setQueueTickets(nextQueueTickets) {
            queueTickets = nextQueueTickets;
        },
        getQueueState: () => queueState,
        setQueueState(nextQueueState) {
            queueState = nextQueueState;
        },
        heartbeatRequests,
        heartbeatPayloads,
        queueCallNextRequests,
    });

    if (overrides.desktopSnapshot) {
        await page.addInitScript((snapshot) => {
            window.__turneroDesktopOpenSettingsCount = 0;
            window.__turneroDesktopSnapshot = snapshot;
            window.turneroDesktop = {
                onBootStatus: (callback) => {
                    window.__turneroDesktopBootStatusCallback = callback;
                    return () => {
                        window.__turneroDesktopBootStatusCallback = null;
                    };
                },
                getRuntimeSnapshot: () =>
                    Promise.resolve(window.__turneroDesktopSnapshot),
                saveRuntimeConfig: () =>
                    Promise.resolve(window.__turneroDesktopSnapshot),
                runPreflight: () => Promise.resolve({ ok: true }),
                retryLoad: () => Promise.resolve(true),
                openSurface: () => Promise.resolve(true),
                openSettings: () => {
                    window.__turneroDesktopOpenSettingsCount += 1;
                    return Promise.resolve(true);
                },
            };
        }, overrides.desktopSnapshot);
    }

    return {
        setQueueStateFailure(next) {
            failQueueState = Boolean(next);
        },
        getHeartbeatPayloads() {
            return [...heartbeatPayloads];
        },
        getLastHeartbeatPayload() {
            return heartbeatPayloads[heartbeatPayloads.length - 1] || null;
        },
        getHeartbeatRequests() {
            return [...heartbeatRequests];
        },
        getQueueCallNextRequests() {
            return [...queueCallNextRequests];
        },
    };
}

test.describe('Turnero Operador', () => {
    test('aplica branding del perfil clinico en la vista de acceso', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
                city: 'Quito',
            },
            consultorios: {
                c1: { label: 'Dermatología 1', short_label: 'D1' },
                c2: { label: 'Dermatología 2', short_label: 'D2' },
            },
            surfaces: {
                operator: {
                    enabled: true,
                    route: '/operador-turnos.html',
                },
            },
        });

        await installLegacyAdminAuthMock(page, {
            authenticated: false,
            mode: 'local',
            status: 'anonymous',
        });

        await page.goto(operatorUrl());

        await expect(page).toHaveTitle(/Clinica Norte/i);
        await expect(
            page.locator('.queue-operator-kicker').first()
        ).toContainText('Norte · Operador');
        await expect(page.locator('#operatorClinicMeta')).toContainText(
            'clinica-norte-demo'
        );
        await expect(
            page.locator('.queue-operator-profile-status').first()
        ).toContainText('Perfil remoto verificado');
        await expect(page.locator('#operatorSurfaceMeta')).toContainText(
            '/operador-turnos.html · D1 / D2'
        );
    });

    test('degrada operador si la ruta del perfil no coincide con la superficie activa', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            consultorios: {
                c1: { label: 'Dermatología 1', short_label: 'D1' },
                c2: { label: 'Dermatología 2', short_label: 'D2' },
            },
            surfaces: {
                operator: {
                    enabled: true,
                    route: '/operador-alt.html',
                },
            },
        });

        const { queueCallNextRequests } =
            await setupOperatorAuthOperatorMocks(page);
        await installWindowOpenRecorder(page);
        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await page.locator('#operatorOpenClawBtn').click();

        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Ruta del piloto incorrecta'
        );
        await expect(
            page.locator('.queue-operator-profile-status').last()
        ).toContainText('Bloqueado · ruta fuera de canon');
        await expect(page.locator('#operatorReadyRoute')).toContainText(
            '/operador-alt.html'
        );
        await page
            .locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
            .click();
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar este equipo'
        );
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Operación bloqueada por ruta'
        );
        expect(queueCallNextRequests).toHaveLength(0);
    });

    test('degrada operador si clinic-profile.json no carga y queda en perfil de respaldo', async ({
        page,
    }) => {
        await installTurneroClinicProfileFailure(page);

        const { queueCallNextRequests } =
            await setupOperatorAuthOperatorMocks(page);
        await installWindowOpenRecorder(page);
        await page.goto(operatorUrl('station=c1&lock=1'));
        await page.locator('#operatorOpenClawBtn').click();

        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Perfil de clínica no cargado'
        );
        await expect(
            page.locator('.queue-operator-profile-status').last()
        ).toContainText('Bloqueado · perfil de respaldo');
        await expect(page.locator('#operatorReadyRoute')).toContainText(
            'perfil de respaldo'
        );
        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#toastContainer')).toContainText(
            'No se puede operar este equipo'
        );
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Operación bloqueada por perfil'
        );
        expect(queueCallNextRequests).toHaveLength(0);
    });

    test('incluye clinicId del perfil clinico en el heartbeat del operador', async ({
        page,
    }) => {
        await installTurneroClinicProfileMock(page, {
            clinic_id: 'clinica-norte-demo',
            branding: {
                name: 'Clinica Norte',
                short_name: 'Norte',
            },
            consultorios: {
                c1: { label: 'Dermatología 1', short_label: 'D1' },
                c2: { label: 'Dermatología 2', short_label: 'D2' },
            },
            surfaces: {
                operator: {
                    enabled: true,
                    route: '/operador-turnos.html',
                },
            },
        });

        const { challenge, heartbeatRequests } =
            await setupOperatorAuthOperatorMocks(page);
        await installWindowOpenRecorder(page);
        await page.goto(operatorUrl('station=c1&lock=1'));

        await page.locator('#operatorOpenClawBtn').click();
        await expect(page.locator('#operatorApp')).toBeVisible();

        await expect.poll(() => heartbeatRequests.length).toBeGreaterThan(0);

        const latestHeartbeat =
            heartbeatRequests[heartbeatRequests.length - 1]?.body || {};
        const details =
            latestHeartbeat.details &&
            typeof latestHeartbeat.details === 'object'
                ? latestHeartbeat.details
                : {};

        expect(challenge.challengeId).toBeTruthy();
        expect(details.clinicId).toBe('clinica-norte-demo');
        expect(details.clinicName).toBe('Clinica Norte');
        expect(details.profileSource).toBe('remote');
        expect(details.profileFingerprint).toMatch(/^[0-9a-f]{8}$/);
        expect(details.surfaceRouteExpected).toBe('/operador-turnos.html');
    });

    test('usa OpenClaw en modo operador y autentica sin pedir clave local', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page);
        const { challenge } = await setupOperatorAuthOperatorMocks(page);

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorLegacyLoginFields')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#operatorOpenClawBtn')).toBeVisible();

        await page.locator('#operatorOpenClawBtn').click();

        await expect
            .poll(() =>
                page.evaluate(() => String(window.__openedUrls[0] || ''))
            )
            .toBe(challenge.helperUrl);

        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Siguiente: B-2201'
        );
    });

    test('web broker del operador oculta helper manual y retoma el intento sin crear otro start', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page);
        const { startRequests } = await setupOperatorAuthOperatorMocks(page, {
            transport: 'web_broker',
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorOpenClawLinkRow')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#operatorOpenClawManualRow')).toHaveClass(
            /is-hidden/
        );

        await page.locator('#operatorOpenClawBtn').click();

        await expect.poll(() => startRequests.length).toBe(1);
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorLoginStatusTitle')).toHaveText(
            'Continua con OpenClaw'
        );
        await expect(page.locator('#operatorOpenClawBtn')).toHaveText(
            'Continuar con OpenClaw'
        );
        await expect(page.locator('#operatorOpenClawLinkRow')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#operatorOpenClawManualRow')).toHaveClass(
            /is-hidden/
        );
        await expect
            .poll(() => page.evaluate(() => window.__openedUrls.length))
            .toBe(0);

        await page.locator('#operatorOpenClawBtn').click();

        await expect.poll(() => startRequests.length).toBe(1);
        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorLoginView')).toHaveClass(
            /is-hidden/
        );
    });

    const operatorWebBrokerTerminalCases = [
        {
            name: 'web broker del operador muestra identidad incompleta sin helper manual',
            terminalStatus: 'identity_missing',
            terminalError:
                'OpenClaw no devolvio una identidad utilizable para este turnero.',
            expectedTitle: 'Identidad incompleta',
            expectedMessage: 'no devolvio una identidad',
            expectedSummary: 'cuenta que publique email valido',
            expectedHelperMeta: 'pedira otra vez la identidad',
            expectedPrimaryLabel: 'Reintentar',
        },
        {
            name: 'web broker del operador muestra email no verificado sin helper manual',
            terminalStatus: 'identity_unverified',
            terminalError:
                'OpenClaw autentico la cuenta, pero no confirmo un email verificado para este turnero.',
            expectedTitle: 'Email no verificado',
            expectedMessage: 'email verificado',
            expectedSummary: 'cuenta con email verificado',
            expectedHelperMeta: 'validacion fuerte del broker web',
            expectedPrimaryLabel: 'Reintentar',
        },
        {
            name: 'web broker del operador muestra claims invalidos sin helper manual',
            terminalStatus: 'broker_claims_invalid',
            terminalError:
                'No se pudieron validar los claims firmados que OpenClaw devolvio para este acceso.',
            expectedTitle: 'Identidad no confiable',
            expectedMessage: 'claims firmados',
            expectedSummary: 'configuracion OIDC del broker',
            expectedHelperMeta: 'id_token firmado',
            expectedPrimaryLabel: 'Reintentar',
        },
        {
            name: 'web broker del operador muestra cuando el login se cancela antes de volver',
            terminalStatus: 'cancelled',
            terminalError:
                'Cancelaste el login web de OpenClaw antes de volver al turnero.',
            expectedTitle: 'Login cancelado',
            expectedMessage: 'antes de volver al turnero',
            expectedSummary: 'intento nuevo en esta misma pantalla',
            expectedHelperMeta: 'otra vez el broker web',
            expectedPrimaryLabel: 'Continuar con OpenClaw',
        },
        {
            name: 'web broker del operador muestra cuando el intento ya no es valido',
            terminalStatus: 'invalid_state',
            terminalError:
                'El intento web ya no es valido. Genera uno nuevo para seguir.',
            expectedTitle: 'Intento expirado',
            expectedMessage: 'ya no es valido',
            expectedSummary: 'no pudo retomar la sesion previa',
            expectedHelperMeta: 'redireccion nueva para este equipo',
            expectedPrimaryLabel: 'Reintentar',
        },
        {
            name: 'web broker del operador muestra cuando OpenClaw no responde',
            terminalStatus: 'broker_unavailable',
            terminalError:
                'OpenClaw no respondio a tiempo durante el login web.',
            expectedTitle: 'Broker no disponible',
            expectedMessage: 'no respondio a tiempo',
            expectedSummary: 'vuelve a intentarlo desde esta misma pantalla',
            expectedHelperMeta: 'No hace falta helper local',
            expectedPrimaryLabel: 'Reintentar',
        },
        {
            name: 'web broker del operador muestra cuando falla el intercambio del codigo',
            terminalStatus: 'code_exchange_failed',
            terminalError:
                'No se pudo intercambiar el codigo devuelto por OpenClaw.',
            expectedTitle: 'Codigo no validado',
            expectedMessage: 'codigo devuelto por OpenClaw',
            expectedSummary: 'emita otro codigo',
            expectedHelperMeta: 'nueva redireccion al broker web',
            expectedPrimaryLabel: 'Reintentar',
        },
    ];

    for (const scenario of operatorWebBrokerTerminalCases) {
        test(scenario.name, async ({ page }) => {
            await installWindowOpenRecorder(page);
            const redirectUrl = `https://broker.example.test/authorize?state=queue-operator-${scenario.terminalStatus}`;
            const { startRequests } = await setupOperatorAuthOperatorMocks(page, {
                transport: 'web_broker',
                statusResponses: [
                    {
                        ok: true,
                        authenticated: false,
                        mode: 'openclaw_chatgpt',
                        status: 'anonymous',
                        transport: 'web_broker',
                    },
                    {
                        ok: true,
                        authenticated: false,
                        mode: 'openclaw_chatgpt',
                        status: 'pending',
                        transport: 'web_broker',
                        ...buildOpenClawBrokerRedirect({
                            redirectUrl,
                        }),
                    },
                    {
                        ok: true,
                        authenticated: false,
                        mode: 'openclaw_chatgpt',
                        status: scenario.terminalStatus,
                        transport: 'web_broker',
                        error: scenario.terminalError,
                    },
                ],
                startPayload: {
                    transport: 'web_broker',
                    redirectUrl,
                },
            });

            await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

            await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
            await expect(page.locator('#operatorOpenClawLinkRow')).toHaveClass(
                /is-hidden/
            );
            await expect(page.locator('#operatorOpenClawManualRow')).toHaveClass(
                /is-hidden/
            );

            await page.locator('#operatorOpenClawBtn').click();

            await expect.poll(() => startRequests.length).toBe(1);
            await expect(page.locator('#operatorLoginStatusTitle')).toHaveText(
                'Continua con OpenClaw'
            );
            await expect(page.locator('#operatorOpenClawBtn')).toHaveText(
                'Continuar con OpenClaw'
            );

            await page.locator('#operatorOpenClawBtn').click();

            await expect.poll(() => startRequests.length).toBe(1);
            await expect(page.locator('#operatorLoginView')).toBeVisible();
            await expect(page.locator('#operatorApp')).toHaveClass(/is-hidden/);
            await expect(page.locator('#operatorLoginStatusTitle')).toHaveText(
                scenario.expectedTitle
            );
            await expect(page.locator('#operatorLoginStatusMessage')).toContainText(
                scenario.expectedMessage
            );
            await expect(page.locator('#operatorOpenClawSummary')).toContainText(
                scenario.expectedSummary
            );
            await expect(page.locator('#operatorOpenClawHelperMeta')).toContainText(
                scenario.expectedHelperMeta
            );
            await expect(page.locator('#operatorOpenClawBtn')).toHaveText(
                scenario.expectedPrimaryLabel
            );
            await expect(page.locator('#operatorOpenClawRetryBtn')).toBeVisible();
            await expect(page.locator('#operatorOpenClawLinkRow')).toHaveClass(
                /is-hidden/
            );
            await expect(page.locator('#operatorOpenClawManualRow')).toHaveClass(
                /is-hidden/
            );
            await expect(
                page.locator('#operatorOpenClawHelperLink')
            ).toHaveAttribute('href', '#');
            await expect
                .poll(() => page.evaluate(() => window.__openedUrls.length))
                .toBe(0);
        });
    }

    test('reutiliza la sesion OpenClaw y tras logout mantiene el mismo modo de acceso', async ({
        page,
    }) => {
        await setupOperatorAuthOperatorMocks(page, {
            statusResponses: [
                {
                    ok: true,
                    authenticated: true,
                    mode: 'openclaw_chatgpt',
                    status: 'autenticado',
                    csrfToken: 'csrf_operator_auth',
                    operator: {
                        email: 'operator@example.com',
                        source: 'openclaw_chatgpt',
                    },
                },
            ],
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorLoginView')).toHaveClass(
            /is-hidden/
        );

        await page.locator('#operatorLogoutBtn').click();

        await expect(page.locator('#operatorLoginView')).toBeVisible();
        await expect(page.locator('#operatorApp')).toHaveClass(/is-hidden/);
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorLegacyLoginFields')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#operatorLoginStatusTitle')).toContainText(
            'PIN operativo'
        );
    });

    test('muestra fallback manual cuando el popup de OpenClaw es bloqueado', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page, { blocked: true });
        const { challenge } = await setupOperatorAuthOperatorMocks(page, {
            statusResponses: [
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'anonymous',
                },
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'pending',
                },
            ],
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await page.locator('#operatorOpenClawBtn').click();

        await expect
            .poll(() =>
                page.evaluate(() => String(window.__openedUrls[0] || ''))
            )
            .toBe(challenge.helperUrl);
        await expect(page.locator('#operatorLoginStatusTitle')).toHaveText(
            /Esperando confirmaci.n en OpenClaw/
        );
        await expect(page.locator('#operatorOpenClawRetryBtn')).toBeVisible();
        await expect(
            page.locator('#operatorOpenClawHelperLink')
        ).toHaveAttribute('href', challenge.helperUrl);
        await expect(page.locator('#operatorOpenClawManualRow')).toBeVisible();
        await expect(page.locator('#operatorOpenClawManualCode')).toHaveText(
            challenge.manualCode
        );
        await expect(page.locator('#toastContainer')).toContainText(
            'Usa el enlace manual de OpenClaw si la ventana no se abrió'
        );
        await expect(page.locator('#operatorApp')).toHaveClass(/is-hidden/);
    });

    test('muestra error terminal del bridge sin volver al login legacy', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page);
        const { challenge } = await setupOperatorAuthOperatorMocks(page, {
            statusResponses: [
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'anonymous',
                },
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'helper_no_disponible',
                    error: 'El helper local de OpenClaw no respondió desde este equipo.',
                },
            ],
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await page.locator('#operatorOpenClawBtn').click();

        await expect(page.locator('#operatorLoginStatusTitle')).toHaveText(
            'No se pudo completar el bridge'
        );
        await expect(page.locator('#operatorLoginStatusMessage')).toContainText(
            'helper local de OpenClaw'
        );
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await expect(page.locator('#operatorLegacyLoginFields')).toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#operatorOpenClawRetryBtn')).toBeVisible();
        await expect(
            page.locator('#operatorOpenClawHelperLink')
        ).toHaveAttribute('href', challenge.helperUrl);
        await expect(page.locator('#operatorOpenClawManualCode')).toHaveText(
            challenge.manualCode
        );
        await expect(page.locator('#operatorApp')).toHaveClass(/is-hidden/);
    });

    test('retry genera un challenge nuevo y actualiza el fallback manual del operador', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page, { blocked: true });
        const { startRequests } = await setupOperatorAuthOperatorMocks(page, {
            startResponses: [
                {
                    challenge: {
                        challengeId: 'challenge-operator-1',
                        helperUrl:
                            'http://127.0.0.1:4173/resolve?challenge=challenge-operator-1',
                        manualCode: 'OPR-ONE-111',
                        pollAfterMs: 50,
                    },
                },
                {
                    challenge: {
                        challengeId: 'challenge-operator-2',
                        helperUrl:
                            'http://127.0.0.1:4173/resolve?challenge=challenge-operator-2',
                        manualCode: 'OPR-TWO-222',
                        pollAfterMs: 50,
                    },
                },
            ],
            statusResponses: [
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'anonymous',
                },
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'helper_no_disponible',
                    error: 'Bridge sin respuesta.',
                },
                {
                    ok: true,
                    authenticated: false,
                    mode: 'openclaw_chatgpt',
                    status: 'helper_no_disponible',
                    error: 'Bridge sin respuesta.',
                },
            ],
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorOpenClawFlow')).toBeVisible();
        await page.locator('#operatorOpenClawBtn').click();

        await expect(page.locator('#operatorOpenClawManualCode')).toHaveText(
            'OPR-ONE-111'
        );
        await expect(
            page.locator('#operatorOpenClawHelperLink')
        ).toHaveAttribute(
            'href',
            'http://127.0.0.1:4173/resolve?challenge=challenge-operator-1'
        );

        await page.locator('#operatorOpenClawRetryBtn').click();

        await expect.poll(() => startRequests.length).toBe(2);
        await expect(page.locator('#operatorOpenClawManualCode')).toHaveText(
            'OPR-TWO-222'
        );
        await expect(
            page.locator('#operatorOpenClawHelperLink')
        ).toHaveAttribute(
            'href',
            'http://127.0.0.1:4173/resolve?challenge=challenge-operator-2'
        );
        await expect
            .poll(() => page.evaluate(() => window.__openedUrls.length))
            .toBe(2);
        await expect(page.locator('#operatorLoginStatusTitle')).toHaveText(
            'No se pudo completar el bridge'
        );
    });

    test('carga estación bloqueada y permite llamar con NumpadEnter', async ({
        page,
    }) => {
        let queueTickets = [
            {
                id: 1201,
                ticketCode: 'A-1201',
                queueType: 'appointment',
                patientInitials: 'ER',
                priorityClass: 'appt_overdue',
                status: 'waiting',
                assignedConsultorio: null,
                createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            },
        ];

        let queueState = {
            updatedAt: new Date().toISOString(),
            waitingCount: 1,
            calledCount: 0,
            counts: {
                waiting: 1,
                called: 0,
                completed: 0,
                no_show: 0,
                cancelled: 0,
            },
            callingNow: [],
            nextTickets: [
                {
                    id: 1201,
                    ticketCode: 'A-1201',
                    patientInitials: 'ER',
                    position: 1,
                },
            ],
        };

        await installLegacyAdminAuthMock(page, {
            authenticated: true,
            csrfToken: 'csrf_operator',
        });
        await installOperatorApiMock(page, {
            getQueueTickets: () => queueTickets,
            setQueueTickets(nextQueueTickets) {
                queueTickets = nextQueueTickets;
            },
            getQueueState: () => queueState,
            setQueueState(nextQueueState) {
                queueState = nextQueueState;
            },
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorApp')).toBeVisible();
        await expect(page.locator('#operatorStationSummary')).toContainText(
            'C2 bloqueado'
        );
        await expect(page.locator('#operatorOneTapSummary')).toContainText(
            '1 tecla ON'
        );
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Siguiente: A-1201'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Falta validar el numpad'
        );
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '0/4 teclas operativas listas'
        );
        await expect(page.locator('#queueTableBody')).toContainText('A-1201');
        await expect(page.locator('#queueTableBody')).not.toContainText(
            'Cancelar'
        );

        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#operatorActionTitle')).toContainText(
            'Ticket A-1201 en curso'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Faltan validar 3 tecla(s)'
        );
        await expect(page.locator('#operatorReadyNumpad')).toContainText(
            '1/4 teclas operativas listas'
        );
        await expect(page.locator('#queueC2Now')).toContainText('A-1201');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('0');
        await expect(page.locator('#queueCalledCountAdmin')).toHaveText('1');
    });

    test('muestra metadata del shell desktop Windows cuando existe el bridge', async ({
        page,
    }) => {
        await mockOperatorSurface(page, {
            desktopSnapshot: {
                config: {
                    surface: 'operator',
                    baseUrl: 'https://pielarmonia.com',
                    launchMode: 'fullscreen',
                    stationMode: 'locked',
                    stationConsultorio: 1,
                    oneTap: false,
                    autoStart: true,
                    updateChannel: 'pilot',
                    updateBaseUrl: 'https://pielarmonia.com/desktop-updates/',
                },
                status: {
                    phase: 'ready',
                    message: 'Operador listo',
                },
                surfaceUrl:
                    'https://pielarmonia.com/operador-turnos.html?station=c1&lock=1&one_tap=0',
                packaged: true,
                platform: 'win32',
                arch: 'x64',
                version: '0.1.0',
                name: 'Turnero Operador',
                configPath:
                    'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                updateFeedUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/',
                updateMetadataUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                installGuideUrl:
                    'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c1&lock=1&one_tap=0',
                firstRun: false,
                settingsMode: false,
                appMode: 'packaged',
            },
        });

        await page.goto(operatorUrl('station=c1&lock=1'));
        await expect(page.locator('#operatorReadyShell')).toContainText(
            'Turnero Operador v0.1.0'
        );
        await expect(page.locator('#operatorReadyShell')).toContainText(
            'Windows'
        );
        await expect(page.locator('#operatorReadyShell')).toContainText(
            'canal pilot'
        );
        await expect(page.locator('#operatorShellModeSummary')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'Autoarranque ON'
        );
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'Fullscreen'
        );
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'F10'
        );
        await expect(
            page.locator('#operatorShellSupportSummary')
        ).toContainText('latest.yml');
        await expect(
            page.locator('#operatorShellSupportSummary')
        ).toContainText('/app-downloads/?surface=operator');
        await expect(
            page.locator('#operatorShellSupportSummary')
        ).toContainText('turnero-desktop.json');
        await expect(page.locator('#operatorNetworkSummary')).toContainText(
            'Red en línea'
        );
        await expect(page.locator('#operatorOneTapSummary')).toContainText(
            'Desktop instalada'
        );
        await expect(page.locator('#operatorAppSettingsBtn')).toBeVisible();
        await expect(page.locator('#operatorAppSettingsBtn')).toContainText(
            'Configurar Windows app'
        );
        await page.locator('#operatorAppSettingsBtn').click();
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroDesktopOpenSettingsCount)
            )
            .toBe(1);
    });

    test('heartbeat operador replica launchMode y autoarranque del shell desktop', async ({
        page,
    }) => {
        const surface = await mockOperatorSurface(page, {
            desktopSnapshot: {
                config: {
                    surface: 'operator',
                    baseUrl: 'https://pielarmonia.com',
                    launchMode: 'windowed',
                    stationMode: 'locked',
                    stationConsultorio: 2,
                    oneTap: true,
                    autoStart: false,
                    updateChannel: 'pilot',
                    updateBaseUrl: 'https://pielarmonia.com/desktop-updates/',
                },
                status: {
                    phase: 'ready',
                    message: 'Operador listo',
                },
                surfaceUrl:
                    'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
                packaged: true,
                platform: 'win32',
                arch: 'x64',
                version: '0.1.0',
                name: 'Turnero Operador',
                configPath:
                    'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                updateFeedUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/',
                updateMetadataUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                installGuideUrl:
                    'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
                firstRun: false,
                settingsMode: false,
                appMode: 'packaged',
            },
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));

        await expect
            .poll(() => surface.getHeartbeatPayloads().length >= 1)
            .toBe(true);
        await expect
            .poll(
                () =>
                    surface.getLastHeartbeatPayload()?.details?.shellLaunchMode
            )
            .toBe('windowed');
        await expect
            .poll(
                () => surface.getLastHeartbeatPayload()?.details?.shellAutoStart
            )
            .toBe(false);

        const heartbeatPayload = surface.getLastHeartbeatPayload();
        expect(heartbeatPayload.details.shellPackaged).toBe(true);
        expect(heartbeatPayload.details.shellUpdateChannel).toBe('pilot');
        expect(heartbeatPayload.details.shellUpdateMetadataUrl).toBe(
            'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml'
        );
        expect(heartbeatPayload.details.shellInstallGuideUrl).toBe(
            'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1'
        );
        expect(heartbeatPayload.details.shellConfigPath).toContain(
            'turnero-desktop.json'
        );
        expect(heartbeatPayload.details.station).toBe('c2');
    });

    test('refleja progreso y disponibilidad del auto-update del shell desktop en la consola operativa', async ({
        page,
    }) => {
        const surface = await mockOperatorSurface(page, {
            desktopSnapshot: {
                config: {
                    surface: 'operator',
                    baseUrl: 'https://pielarmonia.com',
                    launchMode: 'fullscreen',
                    stationMode: 'locked',
                    stationConsultorio: 1,
                    oneTap: false,
                    autoStart: true,
                    updateChannel: 'pilot',
                    updateBaseUrl: 'https://pielarmonia.com/desktop-updates/',
                },
                status: {
                    phase: 'ready',
                    level: 'info',
                    message: 'Operador listo',
                },
                surfaceUrl:
                    'https://pielarmonia.com/operador-turnos.html?station=c1&lock=1&one_tap=0',
                packaged: true,
                platform: 'win32',
                arch: 'x64',
                version: '0.1.0',
                name: 'Turnero Operador',
                configPath:
                    'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                updateFeedUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/',
                updateMetadataUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                installGuideUrl:
                    'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c1&lock=1&one_tap=0',
                firstRun: false,
                settingsMode: false,
                appMode: 'packaged',
            },
        });

        await page.goto(operatorUrl('station=c1&lock=1'));
        await expect(page.locator('#operatorShellModeSummary')).toContainText(
            'Desktop instalada'
        );

        await page.evaluate(() => {
            window.__turneroDesktopSnapshot = {
                ...window.__turneroDesktopSnapshot,
                status: {
                    phase: 'download',
                    level: 'info',
                    message: 'Descargando update 42%',
                    percent: 42,
                    version: '0.2.0',
                },
            };
            window.__turneroDesktopBootStatusCallback?.(
                window.__turneroDesktopSnapshot.status
            );
        });

        await expect(page.locator('#operatorShellModeSummary')).toContainText(
            'Update 42%'
        );
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'Descargando update 42%'
        );
        await expect(page.locator('#operatorShellCard')).toHaveAttribute(
            'data-state',
            'warning'
        );
        await expect
            .poll(
                () =>
                    surface.getLastHeartbeatPayload()?.details?.shellStatusPhase
            )
            .toBe('download');
        await expect
            .poll(
                () =>
                    surface.getLastHeartbeatPayload()?.details
                        ?.shellStatusPercent
            )
            .toBe(42);
        await expect
            .poll(
                () =>
                    surface.getLastHeartbeatPayload()?.details
                        ?.shellStatusVersion
            )
            .toBe('0.2.0');

        await page.evaluate(() => {
            window.__turneroDesktopSnapshot = {
                ...window.__turneroDesktopSnapshot,
                status: {
                    phase: 'ready',
                    level: 'info',
                    message: 'Actualizacion lista 0.2.0',
                    version: '0.2.0',
                },
            };
            window.__turneroDesktopBootStatusCallback?.(
                window.__turneroDesktopSnapshot.status
            );
        });

        await expect(page.locator('#operatorShellModeSummary')).toContainText(
            'Update lista'
        );
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'Se instalará al cerrar la app'
        );
    });

    test('abre configuracion local con F10 y Ctrl+coma y refleja red offline', async ({
        page,
    }) => {
        await mockOperatorSurface(page, {
            desktopSnapshot: {
                config: {
                    surface: 'operator',
                    baseUrl: 'https://pielarmonia.com',
                    launchMode: 'windowed',
                    stationMode: 'locked',
                    stationConsultorio: 2,
                    oneTap: true,
                    autoStart: false,
                    updateChannel: 'pilot',
                    updateBaseUrl: 'https://pielarmonia.com/desktop-updates/',
                },
                status: {
                    phase: 'ready',
                    message: 'Operador listo',
                },
                surfaceUrl:
                    'https://pielarmonia.com/operador-turnos.html?station=c2&lock=1&one_tap=1',
                packaged: true,
                platform: 'win32',
                arch: 'x64',
                version: '0.1.0',
                name: 'Turnero Operador',
                configPath:
                    'C:\\Users\\Operador\\AppData\\Roaming\\TurneroOperador\\turnero-desktop.json',
                updateFeedUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/',
                updateMetadataUrl:
                    'https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
                installGuideUrl:
                    'https://pielarmonia.com/app-downloads/?surface=operator&platform=win&station=c2&lock=1&one_tap=1',
                firstRun: false,
                settingsMode: false,
                appMode: 'packaged',
            },
        });

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'Ventana'
        );
        await expect(page.locator('#operatorShellMetaSummary')).toContainText(
            'Autoarranque OFF'
        );

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'F10',
                    code: 'F10',
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroDesktopOpenSettingsCount)
            )
            .toBe(1);

        await page.evaluate(() => {
            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ',',
                    code: 'Comma',
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true,
                })
            );
        });
        await expect
            .poll(() =>
                page.evaluate(() => window.__turneroDesktopOpenSettingsCount)
            )
            .toBe(2);

        await page.evaluate(() => {
            window.dispatchEvent(new Event('offline'));
        });
        await expect(page.locator('#operatorNetworkSummary')).toContainText(
            'Sin red local'
        );
        await expect(page.locator('#operatorNetworkMetaSummary')).toContainText(
            'La conectividad local cayó'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Modo seguro'
        );
    });

    test('bloquea acciones mutantes en contingencia offline pero mantiene ayudas locales', async ({
        page,
    }) => {
        await mockOperatorSurface(page);

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        await expect(
            page.locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
        ).toBeEnabled();
        await expect(page.locator('#queueShortcutPanel')).toBeHidden();

        await page.evaluate(() => {
            window.dispatchEvent(new Event('offline'));
        });

        await expect(page.locator('#operatorGuardTitle')).toContainText(
            'Modo seguro'
        );
        await expect(page.locator('#operatorGuardSummary')).toContainText(
            'no llamar ni cerrar tickets'
        );
        await expect(page.locator('#operatorNetworkSummary')).toContainText(
            'Sin red local'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Modo seguro'
        );
        await expect(
            page.locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator('[data-action="queue-toggle-shortcuts"]')
        ).toBeEnabled();

        await page.locator('[data-action="queue-toggle-shortcuts"]').click();
        await expect(page.locator('#queueShortcutPanel')).toBeVisible();

        await page.keyboard.press('NumpadEnter');
        await expect(page.locator('#queueWaitingCountAdmin')).toHaveText('1');
        await expect(page.locator('#queueCalledCountAdmin')).toHaveText('0');
        await expect(page.locator('#queueC2Now')).not.toContainText('A-1201');
    });

    test('marca fallback local como contingencia aunque la red siga arriba', async ({
        page,
    }) => {
        const surface = await mockOperatorSurface(page);

        await page.goto(operatorUrl('station=c2&lock=1&one_tap=1'));
        surface.setQueueStateFailure(true);
        await page.locator('[data-action="queue-refresh-state"]').click();

        await expect(page.locator('#operatorGuardTitle')).toContainText(
            'Cola en fallback local'
        );
        await expect(page.locator('#operatorReadinessTitle')).toContainText(
            'Sincronización pendiente'
        );
        await expect(page.locator('#operatorReadyNetwork')).toContainText(
            'fallback local'
        );
        await expect(page.locator('#operatorNetworkSummary')).toContainText(
            'Sync degradado'
        );
        await expect(page.locator('#operatorNetworkMetaSummary')).toContainText(
            'fallback local'
        );
        await expect(
            page.locator(
                '[data-action="queue-call-next"][data-queue-consultorio="2"]'
            )
        ).toBeDisabled();
        await expect(
            page.locator('[data-action="queue-refresh-state"]')
        ).toBeEnabled();
    });
});
