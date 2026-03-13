// @ts-check
const { test, expect } = require('@playwright/test');

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

function buildOperatorAuthChallenge(overrides = {}) {
    const challengeId = String(
        overrides.challengeId || 'challenge-operator-openclaw'
    );

    return {
        challengeId,
        helperUrl:
            overrides.helperUrl ||
            `http://127.0.0.1:4173/resolve?challenge=${encodeURIComponent(challengeId)}`,
        manualCode: overrides.manualCode || 'OPR123-456XYZ',
        pollAfterMs: Number(overrides.pollAfterMs || 50),
        expiresAt:
            overrides.expiresAt ||
            new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        status: overrides.status || 'pending',
    };
}

async function installWindowOpenRecorder(page, { blocked = false } = {}) {
    await page.addInitScript(
        ({ popupBlocked }) => {
            window.__openedUrls = [];
            window.open = (url) => {
                window.__openedUrls.push(String(url || ''));
                if (popupBlocked) {
                    return null;
                }
                return {
                    focus() {},
                };
            };
        },
        { popupBlocked: blocked }
    );
}

async function setupOperatorAuthOperatorMocks(
    page,
    { statusResponses = null, startPayload = null, startResponses = null } = {}
) {
    let queueTickets = [
        {
            id: 2201,
            ticketCode: 'B-2201',
            queueType: 'appointment',
            patientInitials: 'OC',
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
                id: 2201,
                ticketCode: 'B-2201',
                patientInitials: 'OC',
                position: 1,
            },
        ],
    };

    function buildStartResponse(payload = {}) {
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

    const preparedStartResponses = Array.isArray(startResponses) &&
        startResponses.length > 0
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
        },
        {
            ok: true,
            authenticated: false,
            mode: 'openclaw_chatgpt',
            status: 'pending',
            challenge: startResponse.challenge,
        },
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
    ];

    let statusIndex = 0;
    let startIndex = 0;
    const startRequests = [];
    const heartbeatRequests = [];
    const queueCallNextRequests = [];

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const action =
            new URL(route.request().url()).searchParams.get('action') || '';

        if (action === 'status') {
            const responses = Array.isArray(statusResponses)
                ? statusResponses
                : defaultStatusResponses;
            const payload =
                responses[
                    Math.min(statusIndex, Math.max(responses.length - 1, 0))
                ] || defaultStatusResponses[defaultStatusResponses.length - 1];
            statusIndex += 1;
            return json(route, payload);
        }

        if (action === 'start') {
            startRequests.push({
                method: route.request().method(),
                url: route.request().url(),
            });
            const payload =
                preparedStartResponses[
                    Math.min(
                        startIndex,
                        Math.max(preparedStartResponses.length - 1, 0)
                    )
                ] || startResponse;
            startIndex += 1;
            return json(route, payload, 202);
        }

        if (action === 'logout') {
            return json(route, { ok: true });
        }

        return json(route, { ok: true });
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const resource =
            new URL(request.url()).searchParams.get('resource') || '';

        if (resource === 'data') {
            return json(route, {
                ok: true,
                data: {
                    appointments: [],
                    callbacks: [],
                    reviews: [],
                    availability: {},
                    availabilityMeta: {},
                    queue_tickets: queueTickets,
                    queueMeta: queueState,
                },
            });
        }

        if (resource === 'queue-state') {
            return json(route, {
                ok: true,
                data: queueState,
            });
        }

        if (resource === 'queue-call-next') {
            queueCallNextRequests.push({
                method: request.method(),
                url: request.url(),
            });
            const calledTicket = {
                ...queueTickets[0],
                status: 'called',
                assignedConsultorio: 2,
                calledAt: new Date().toISOString(),
            };
            queueTickets = [calledTicket];
            queueState = {
                updatedAt: new Date().toISOString(),
                waitingCount: 0,
                calledCount: 1,
                counts: {
                    waiting: 0,
                    called: 1,
                    completed: 0,
                    no_show: 0,
                    cancelled: 0,
                },
                callingNow: [calledTicket],
                nextTickets: [],
            };
            return json(route, {
                ok: true,
                data: {
                    ticket: calledTicket,
                    queueState,
                },
            });
        }

        if (resource === 'queue-ticket') {
            return json(route, {
                ok: true,
                data: {
                    ticket: queueTickets[0],
                    queueState,
                },
            });
        }

        if (
            resource === 'health' ||
            resource === 'funnel-metrics'
        ) {
            return json(route, { ok: true, data: {} });
        }

        if (resource === 'queue-surface-heartbeat') {
            let body = {};
            try {
                body = request.postDataJSON() || {};
            } catch (_error) {
                body = {};
            }
            heartbeatRequests.push({
                method: request.method(),
                url: request.url(),
                body,
            });
            return json(route, { ok: true, data: {} });
        }

        return json(route, { ok: true, data: {} });
    });

    return {
        challenge: startResponse.challenge,
        startRequests,
        heartbeatRequests,
        queueCallNextRequests,
    };
}

test.describe('Turnero Operador', () => {
    test('aplica branding del perfil clinico en la vista de acceso', async ({
        page,
    }) => {
        await page.route(
            /\/content\/turnero\/clinic-profile\.json(\?.*)?$/i,
            async (route) =>
                json(route, {
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
                })
        );

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
            json(route, {
                ok: true,
                authenticated: false,
                mode: 'local',
                status: 'anonymous',
            })
        );

        await page.goto(operatorUrl());

        await expect(page).toHaveTitle(/Clinica Norte/i);
        await expect(page.locator('.queue-operator-kicker').first()).toContainText(
            'Norte · Operador'
        );
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
        await page.route(
            /\/content\/turnero\/clinic-profile\.json(\?.*)?$/i,
            async (route) =>
                json(route, {
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
                })
        );

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
            .locator('[data-action="queue-call-next"][data-queue-consultorio="2"]')
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
        await page.route(
            /\/content\/turnero\/clinic-profile\.json(\?.*)?$/i,
            async (route) =>
                route.fulfill({
                    status: 404,
                    contentType: 'application/json; charset=utf-8',
                    body: JSON.stringify({ ok: false }),
                })
        );

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
        await page.route(
            /\/content\/turnero\/clinic-profile\.json(\?.*)?$/i,
            async (route) =>
                json(route, {
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
                })
        );

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
            latestHeartbeat.details && typeof latestHeartbeat.details === 'object'
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
            'Acceso protegido'
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
        await expect(page.locator('#operatorOpenClawHelperLink')).toHaveAttribute(
            'href',
            challenge.helperUrl
        );
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
        await expect(page.locator('#operatorOpenClawHelperLink')).toHaveAttribute(
            'href',
            challenge.helperUrl
        );
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
                        helperUrl: 'http://127.0.0.1:4173/resolve?challenge=challenge-operator-1',
                        manualCode: 'OPR-ONE-111',
                        pollAfterMs: 50,
                    },
                },
                {
                    challenge: {
                        challengeId: 'challenge-operator-2',
                        helperUrl: 'http://127.0.0.1:4173/resolve?challenge=challenge-operator-2',
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
        await expect(page.locator('#operatorOpenClawHelperLink')).toHaveAttribute(
            'href',
            'http://127.0.0.1:4173/resolve?challenge=challenge-operator-1'
        );

        await page.locator('#operatorOpenClawRetryBtn').click();

        await expect.poll(() => startRequests.length).toBe(2);
        await expect(page.locator('#operatorOpenClawManualCode')).toHaveText(
            'OPR-TWO-222'
        );
        await expect(page.locator('#operatorOpenClawHelperLink')).toHaveAttribute(
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

        await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
            const action =
                new URL(route.request().url()).searchParams.get('action') || '';
            if (action === 'status') {
                return json(route, {
                    ok: true,
                    authenticated: true,
                    csrfToken: 'csrf_operator',
                });
            }
            return json(route, {
                ok: true,
                authenticated: true,
                csrfToken: 'csrf_operator',
            });
        });

        await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
            const request = route.request();
            const resource =
                new URL(request.url()).searchParams.get('resource') || '';

            if (resource === 'data') {
                return json(route, {
                    ok: true,
                    data: {
                        appointments: [],
                        callbacks: [],
                        reviews: [],
                        availability: {},
                        availabilityMeta: {},
                        queue_tickets: queueTickets,
                        queueMeta: queueState,
                    },
                });
            }

            if (resource === 'queue-state') {
                return json(route, {
                    ok: true,
                    data: queueState,
                });
            }

            if (resource === 'queue-call-next') {
                const calledTicket = {
                    ...queueTickets[0],
                    status: 'called',
                    assignedConsultorio: 2,
                    calledAt: new Date().toISOString(),
                };
                queueTickets = [calledTicket];
                queueState = {
                    updatedAt: new Date().toISOString(),
                    waitingCount: 0,
                    calledCount: 1,
                    counts: {
                        waiting: 0,
                        called: 1,
                        completed: 0,
                        no_show: 0,
                        cancelled: 0,
                    },
                    callingNow: [calledTicket],
                    nextTickets: [],
                };
                return json(route, {
                    ok: true,
                    data: {
                        ticket: calledTicket,
                        queueState,
                    },
                });
            }

            if (resource === 'queue-ticket') {
                return json(route, {
                    ok: true,
                    data: {
                        ticket: queueTickets[0],
                        queueState,
                    },
                });
            }

            if (resource === 'health' || resource === 'funnel-metrics') {
                return json(route, { ok: true, data: {} });
            }

            return json(route, { ok: true, data: {} });
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
});
