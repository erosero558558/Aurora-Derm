// @ts-check
const { test, expect } = require('@playwright/test');
const {
    buildOperatorAuthChallenge,
    installLegacyAdminAuthMock,
    installWindowOpenRecorder,
} = require('./helpers/admin-auth-mocks');

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

async function setupOperatorAuthOperatorMocks(
    page,
    {
        statusResponses = null,
        startPayload = null,
        startResponses = null,
        failQueueStateInitially = false,
    } = {}
) {
    let failQueueState = Boolean(failQueueStateInitially);
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
            return json(route, {
                ok: true,
                data: { accepted: true },
            });
        }

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
            if (failQueueState) {
                return json(
                    route,
                    {
                        ok: false,
                        error: 'queue_state_unavailable',
                    },
                    503
                );
            }
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

        return json(route, { ok: true, data: {} });
    });

    return {
        challenge: startResponse.challenge,
        startRequests,
        heartbeatRequests,
        queueCallNextRequests,
    };
}

async function mockOperatorSurface(page, overrides = {}) {
    let failQueueState = Boolean(overrides.failQueueStateInitially);
    const heartbeatPayloads = [];
    const heartbeatRequests = [];
    const queueCallNextRequests = [];
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

    await installLegacyAdminAuthMock(page, {
        csrfToken: 'csrf_operator',
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const request = route.request();
        const resource =
            new URL(request.url()).searchParams.get('resource') || '';

        if (resource === 'queue-surface-heartbeat') {
            let body = {};
            try {
                body = request.postDataJSON() || {};
                heartbeatPayloads.push(body);
            } catch (_error) {
                body = {};
                heartbeatPayloads.push(null);
            }
            heartbeatRequests.push({
                method: request.method(),
                url: request.url(),
                body,
            });
            return json(route, {
                ok: true,
                data: { accepted: true },
            });
        }

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
            if (failQueueState) {
                return json(
                    route,
                    {
                        ok: false,
                        error: 'queue_state_unavailable',
                    },
                    503
                );
            }
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

        return json(route, { ok: true, data: {} });
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
