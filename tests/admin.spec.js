// @ts-check
const { test, expect } = require('@playwright/test');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

function jsonResponse(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildOperatorAuthChallenge(overrides = {}) {
    const challengeId = String(
        overrides.challengeId || 'challenge-admin-openclaw'
    );

    return {
        challengeId,
        helperUrl:
            overrides.helperUrl ||
            `http://127.0.0.1:4173/resolve?challenge=${encodeURIComponent(challengeId)}`,
        manualCode: overrides.manualCode || 'ABC123-DEF456',
        pollAfterMs: Number(overrides.pollAfterMs || 50),
        expiresAt:
            overrides.expiresAt ||
            new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        status: overrides.status || 'pending',
    };
}

function buildWhatsappOpenclawOpsSnapshot(overrides = {}) {
    const baseSnapshot = {
        available: true,
        configured: true,
        configuredMode: 'openclaw_chatgpt',
        bridgeConfigured: true,
        bridgeMode: 'online',
        bridgeStatus: {
            healthy: true,
        },
        pendingOutbox: 0,
        activeConversations: 0,
        aliveHolds: 0,
        bookingsClosed: 0,
        paymentsStarted: 0,
        paymentsCompleted: 0,
        deliveryFailures: 0,
        automationSuccessRate: 100,
        lastInboundAt: '',
        lastOutboundAt: '',
        pendingOutboxItems: [],
        failedOutboxItems: [],
        activeHolds: [],
        pendingCheckouts: [],
        conversations: [],
    };

    return {
        ...baseSnapshot,
        ...overrides,
        bridgeStatus: {
            ...baseSnapshot.bridgeStatus,
            ...(overrides.bridgeStatus || {}),
        },
        pendingOutboxItems: Array.isArray(overrides.pendingOutboxItems)
            ? overrides.pendingOutboxItems
            : baseSnapshot.pendingOutboxItems,
        failedOutboxItems: Array.isArray(overrides.failedOutboxItems)
            ? overrides.failedOutboxItems
            : baseSnapshot.failedOutboxItems,
        activeHolds: Array.isArray(overrides.activeHolds)
            ? overrides.activeHolds
            : baseSnapshot.activeHolds,
        pendingCheckouts: Array.isArray(overrides.pendingCheckouts)
            ? overrides.pendingCheckouts
            : baseSnapshot.pendingCheckouts,
        conversations: Array.isArray(overrides.conversations)
            ? overrides.conversations
            : baseSnapshot.conversations,
    };
}

function applyWhatsappOpenclawOpsAction(snapshot, payload = {}) {
    const action = String(payload.action || '').trim();
    const nextSnapshot = {
        ...snapshot,
        failedOutboxItems: Array.isArray(snapshot.failedOutboxItems)
            ? [...snapshot.failedOutboxItems]
            : [],
        activeHolds: Array.isArray(snapshot.activeHolds)
            ? [...snapshot.activeHolds]
            : [],
        pendingCheckouts: Array.isArray(snapshot.pendingCheckouts)
            ? [...snapshot.pendingCheckouts]
            : [],
    };
    let response = {
        ok: true,
        action,
    };

    if (action === 'requeue_outbox') {
        const failedId = String(payload.id || '').trim();
        nextSnapshot.failedOutboxItems = nextSnapshot.failedOutboxItems.filter(
            (item) => String(item?.id || '') !== failedId
        );
        nextSnapshot.deliveryFailures = Math.max(
            0,
            nextSnapshot.failedOutboxItems.length
        );
        response = {
            ...response,
            requeuedId: failedId,
        };
    } else if (action === 'expire_checkout') {
        const sessionId = String(payload.paymentSessionId || '').trim();
        const holdId = String(payload.holdId || '').trim();
        const expiredCheckouts = nextSnapshot.pendingCheckouts.filter((item) => {
            return (
                sessionId &&
                String(item?.paymentSessionId || '') === sessionId
            );
        });
        nextSnapshot.pendingCheckouts = nextSnapshot.pendingCheckouts.filter(
            (item) => String(item?.paymentSessionId || '') !== sessionId
        );
        if (holdId) {
            nextSnapshot.activeHolds = nextSnapshot.activeHolds.filter(
                (item) => String(item?.id || '') !== holdId
            );
        }
        nextSnapshot.aliveHolds = nextSnapshot.activeHolds.length;
        response = {
            ...response,
            expiredCount: expiredCheckouts.length,
            expiredHolds: holdId ? 1 : 0,
        };
    } else if (action === 'release_hold') {
        const holdId = String(payload.holdId || '').trim();
        nextSnapshot.activeHolds = nextSnapshot.activeHolds.filter(
            (item) => String(item?.id || '') !== holdId
        );
        nextSnapshot.aliveHolds = nextSnapshot.activeHolds.length;
        response = {
            ...response,
            releasedHoldId: holdId,
        };
    } else if (action === 'sweep_stale') {
        const expiredCount = nextSnapshot.pendingCheckouts.length;
        const expiredHolds = nextSnapshot.activeHolds.length;
        nextSnapshot.pendingCheckouts = [];
        nextSnapshot.activeHolds = [];
        nextSnapshot.aliveHolds = 0;
        response = {
            ...response,
            expiredCount,
            expiredHolds,
        };
    }

    return {
        snapshot: buildWhatsappOpenclawOpsSnapshot(nextSnapshot),
        response,
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

async function setupOperatorAuthAdminMocks(
    page,
    { dataOverrides = {}, statusResponses = null, startPayload = null } = {}
) {
    const baseData = {
        appointments: [],
        callbacks: [],
        reviews: [],
        availability: {},
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
    };

    const mergedData = {
        ...baseData,
        ...dataOverrides,
        availabilityMeta: {
            ...baseData.availabilityMeta,
            ...(dataOverrides.availabilityMeta || {}),
        },
    };

    const challenge = buildOperatorAuthChallenge(
        startPayload && startPayload.challenge ? startPayload.challenge : {}
    );
    const resolvedChallenge =
        startPayload && startPayload.challenge
            ? {
                  ...challenge,
                  ...startPayload.challenge,
              }
            : challenge;
    const startResponse = {
        ok: true,
        authenticated: false,
        mode: 'openclaw_chatgpt',
        status: 'pending',
        ...(startPayload || {}),
        challenge: resolvedChallenge,
    };
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

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();

        if (action === 'status') {
            const responses = Array.isArray(statusResponses)
                ? statusResponses
                : defaultStatusResponses;
            const payload =
                responses[
                    Math.min(statusIndex, Math.max(responses.length - 1, 0))
                ] || defaultStatusResponses[defaultStatusResponses.length - 1];
            statusIndex += 1;
            return jsonResponse(route, payload);
        }

        if (action === 'start') {
            return jsonResponse(route, startResponse, 202);
        }

        if (action === 'logout') {
            return jsonResponse(route, { ok: true });
        }

        return jsonResponse(route, { ok: true });
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, { ok: true, data: mergedData });
        }

        if (resource === 'health') {
            return jsonResponse(route, { ok: true, data: {} });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 0,
                        startCheckout: 0,
                        bookingConfirmed: 0,
                        checkoutAbandon: 0,
                        startRatePct: 0,
                        confirmedRatePct: 0,
                        abandonRatePct: 0,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: mergedData.availability,
                meta: mergedData.availabilityMeta,
            });
        }

        if (resource === 'monitoring-config') {
            return jsonResponse(route, { ok: true, data: {} });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return {
        challenge: startResponse.challenge,
    };
}

async function setupAuthenticatedAdminMocks(page, overrides = {}) {
    const {
        whatsappOpenclawOps = {},
        onWhatsappOpenclawOpsAction = null,
        ...dataOverrides
    } = overrides;
    const baseData = {
        appointments: [],
        callbacks: [],
        reviews: [],
        availability: {},
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
    };
    const mergedData = {
        ...baseData,
        ...dataOverrides,
        availabilityMeta: {
            ...baseData.availabilityMeta,
            ...(dataOverrides.availabilityMeta || {}),
        },
    };
    let openclawOpsSnapshot = buildWhatsappOpenclawOpsSnapshot(
        whatsappOpenclawOps
    );
    const whatsappOpsActionRequests = [];

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        jsonResponse(route, {
            ok: true,
            authenticated: true,
            csrfToken: 'csrf_test_token',
        })
    );

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';
        const method = route.request().method().toUpperCase();
        let payload = {};
        if (method === 'PATCH' || method === 'POST' || method === 'PUT') {
            try {
                payload = route.request().postDataJSON() || {};
            } catch (_error) {
                const rawBody = route.request().postData() || '';
                const params = new URLSearchParams(rawBody);
                payload = Object.fromEntries(params.entries());
            }
        }

        const intendedMethod = String(payload._method || method).toUpperCase();

        if (
            resource === 'callbacks' &&
            (method === 'PATCH' ||
                method === 'POST' ||
                intendedMethod === 'PATCH')
        ) {
            const callbackId = Number(payload.id || 0);
            let callback = mergedData.callbacks.find(
                (item) => Number(item.id || 0) === callbackId
            );
            if (callbackId > 0 && callback) {
                callback.status = String(payload.status || callback.status);
            } else {
                mergedData.callbacks.forEach((item) => {
                    if (String(item.status || '').toLowerCase() === 'pending') {
                        item.status = String(payload.status || 'contactado');
                    }
                });
                callback = mergedData.callbacks[0] || null;
            }
            return jsonResponse(route, { ok: true, data: callback || {} });
        }

        if (
            resource === 'appointments' &&
            (method === 'PATCH' ||
                method === 'POST' ||
                intendedMethod === 'PATCH')
        ) {
            const appointmentId = Number(payload.id || 0);
            const appointment = mergedData.appointments.find(
                (item) => Number(item.id || 0) === appointmentId
            );
            if (appointment) {
                Object.assign(appointment, payload);
            }
            return jsonResponse(route, { ok: true, data: appointment || {} });
        }

        if (resource === 'data') {
            return jsonResponse(route, { ok: true, data: mergedData });
        }

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 0,
                        startCheckout: 0,
                        bookingConfirmed: 0,
                        checkoutAbandon: 0,
                        startRatePct: 0,
                        confirmedRatePct: 0,
                        abandonRatePct: 0,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: mergedData.availability,
                meta: mergedData.availabilityMeta,
            });
        }

        if (resource === 'whatsapp-openclaw-ops') {
            if (method === 'GET') {
                return jsonResponse(route, {
                    ok: true,
                    data: openclawOpsSnapshot,
                });
            }

            if (method === 'POST' || intendedMethod === 'POST') {
                whatsappOpsActionRequests.push(payload);
                const actionContext = {
                    payload,
                    snapshot: JSON.parse(
                        JSON.stringify(openclawOpsSnapshot)
                    ),
                };
                const handled =
                    typeof onWhatsappOpenclawOpsAction === 'function'
                        ? await onWhatsappOpenclawOpsAction(actionContext)
                        : null;
                const resolved =
                    handled && typeof handled === 'object'
                        ? {
                              snapshot: handled.snapshot
                                  ? buildWhatsappOpenclawOpsSnapshot(
                                        handled.snapshot
                                    )
                                  : openclawOpsSnapshot,
                              response: handled.response || {
                                  ok: true,
                                  action: String(payload.action || '').trim(),
                              },
                          }
                        : applyWhatsappOpenclawOpsAction(
                              openclawOpsSnapshot,
                              payload
                          );
                openclawOpsSnapshot = resolved.snapshot;
                return jsonResponse(route, {
                    ok: true,
                    data: resolved.response,
                });
            }
        }

        if (resource === 'monitoring-config') {
            return jsonResponse(route, { ok: true, data: {} });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });

    return {
        whatsappOpsActionRequests,
    };
}

async function setupLoginAdminMocks(
    page,
    {
        twoFactorRequired = false,
        dataOverrides = {},
        loginStatus = 200,
        loginPayload = null,
    } = {}
) {
    const baseData = {
        appointments: [],
        callbacks: [],
        reviews: [],
        availability: {},
        availabilityMeta: {
            source: 'store',
            mode: 'live',
            timezone: 'America/Guayaquil',
            calendarConfigured: true,
            calendarReachable: true,
            generatedAt: new Date().toISOString(),
        },
    };

    const mergedData = {
        ...baseData,
        ...dataOverrides,
        availabilityMeta: {
            ...baseData.availabilityMeta,
            ...(dataOverrides.availabilityMeta || {}),
        },
    };

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();

        if (action === 'status') {
            return jsonResponse(route, {
                ok: true,
                authenticated: false,
            });
        }

        if (action === 'login') {
            return jsonResponse(route, {
                ok: loginStatus < 400,
                twoFactorRequired,
                csrfToken: twoFactorRequired ? '' : 'csrf_login_test',
                ...(loginPayload || {}),
            }, loginStatus);
        }

        if (action === 'login-2fa') {
            return jsonResponse(route, {
                ok: true,
                csrfToken: 'csrf_login_test',
            });
        }

        if (action === 'logout') {
            return jsonResponse(route, { ok: true });
        }

        return jsonResponse(route, { ok: true });
    });

    await page.route(/\/api\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const resource = url.searchParams.get('resource') || '';

        if (resource === 'features') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    admin_sony_ui: true,
                },
            });
        }

        if (resource === 'data') {
            return jsonResponse(route, { ok: true, data: mergedData });
        }

        if (resource === 'funnel-metrics') {
            return jsonResponse(route, {
                ok: true,
                data: {
                    summary: {
                        viewBooking: 0,
                        startCheckout: 0,
                        bookingConfirmed: 0,
                        checkoutAbandon: 0,
                        startRatePct: 0,
                        confirmedRatePct: 0,
                        abandonRatePct: 0,
                    },
                    checkoutAbandonByStep: [],
                    checkoutEntryBreakdown: [],
                    paymentMethodBreakdown: [],
                    bookingStepBreakdown: [],
                    sourceBreakdown: [],
                    abandonReasonBreakdown: [],
                    errorCodeBreakdown: [],
                },
            });
        }

        if (resource === 'availability') {
            return jsonResponse(route, {
                ok: true,
                data: mergedData.availability,
                meta: mergedData.availabilityMeta,
            });
        }

        if (resource === 'monitoring-config') {
            return jsonResponse(route, { ok: true, data: {} });
        }

        if (resource === 'health') {
            return jsonResponse(route, { ok: true, data: {} });
        }

        return jsonResponse(route, { ok: true, data: {} });
    });
}

async function waitForAdminReady(page) {
    await expect(page.locator('html')).toHaveAttribute(
        'data-admin-ready',
        'true'
    );
}

async function waitForVisibleAdminLoginSurface(page) {
    await expect
        .poll(() =>
            page.evaluate(() => {
                const ids = ['adminOpenClawFlow', 'loginForm'];
                return ids.some((id) => {
                    const node = document.getElementById(id);
                    return Boolean(
                        node && !node.classList.contains('is-hidden')
                    );
                });
            })
        )
        .toBe(true);
}

test.describe('Panel de administracion', () => {
    test('pagina admin carga correctamente', async ({ page }) => {
        await page.goto('/admin.html');
        await expect(page).toHaveTitle(/Admin|Piel en Armonia/);
    });

    test('formulario de login esta visible', async ({ page }) => {
        await page.goto('/admin.html');
        const loginForm = page
            .locator('#loginForm, form, [class*="login"]')
            .first();
        await expect(loginForm).toBeVisible();
    });

    test('tema claro/oscuro funciona en login y persiste tras recarga', async ({
        page,
    }) => {
        await page.goto('/admin.html');
        await waitForAdminReady(page);

        const darkThemeBtn = page
            .locator(
                '.login-theme-bar .admin-theme-btn[data-theme-mode="dark"]'
            )
            .first();
        await expect(darkThemeBtn).toBeVisible();
        await darkThemeBtn.click();

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }))
            )
            .toEqual({
                mode: 'dark',
                theme: 'dark',
                stored: 'dark',
            });

        await page.reload();
        await waitForVisibleAdminLoginSurface(page);
        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('dark');
    });

    test('login con contrasena vacia no funciona', async ({ page }) => {
        await setupLoginAdminMocks(page);
        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('input[type="password"]').first();
        const loginBtn = page
            .locator('button[type="submit"], .btn-primary')
            .first();
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('');
        await loginBtn.click();

        await expect(passwordInput).toBeVisible();
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login con contrasena incorrecta muestra error', async ({ page }) => {
        await setupLoginAdminMocks(page, {
            loginStatus: 401,
            loginPayload: {
                error: 'Credenciales inválidas',
            },
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);
        const passwordInput = page.locator('input[type="password"]').first();
        const loginBtn = page
            .locator('button[type="submit"], .btn-primary')
            .first();
        await expect(passwordInput).toBeVisible();
        await expect(loginBtn).toBeVisible();

        await passwordInput.fill('contrasena_incorrecta_test');
        await loginBtn.click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /No se pudo iniciar sesion/
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            /Credenciales invalidas|Credenciales inválidas/
        );
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
    });

    test('login con 2FA muestra etapa dedicada y permite volver al paso de clave', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, { twoFactorRequired: true });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page.locator('#adminPassword').fill('clave-test');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#group2FA')).toBeVisible();
        await expect(page.locator('#loginBtn')).toHaveText(
            /Verificar y entrar/
        );
        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /Codigo 2FA requerido/
        );

        await page.locator('#loginReset2FABtn').click();

        await expect(page.locator('#group2FA')).toBeHidden();
        await expect(page.locator('#loginBtn')).toHaveText(/Ingresar/);
        await expect(page.locator('#adminPassword')).toBeEnabled();
    });

    test('login OpenClaw reemplaza la clave local y autentica tras el polling', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page);
        const { challenge } = await setupOperatorAuthAdminMocks(page);

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await expect(page.locator('#adminOpenClawFlow')).toBeVisible();
        await expect(page.locator('#loginForm')).toHaveClass(/is-hidden/);
        await expect(page.locator('#adminOpenClawBtn')).toBeVisible();

        await page.locator('#adminOpenClawBtn').click();

        await expect
            .poll(() =>
                page.evaluate(() => String(window.__openedUrls[0] || ''))
            )
            .toBe(challenge.helperUrl);

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            'OpenClaw / ChatGPT'
        );
    });

    test('login OpenClaw muestra errores terminales del bridge sin volver a clave local', async ({
        page,
    }) => {
        await installWindowOpenRecorder(page);
        await setupOperatorAuthAdminMocks(page, {
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
                    status: 'openclaw_no_logueado',
                    error: 'OpenClaw no encontro un perfil OAuth valido.',
                },
            ],
        });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await expect(page.locator('#adminOpenClawFlow')).toBeVisible();
        await expect(page.locator('#loginForm')).toHaveClass(/is-hidden/);

        await page.locator('#adminOpenClawBtn').click();

        await expect(page.locator('#adminLoginStatusTitle')).toHaveText(
            /OpenClaw necesita tu sesion/
        );
        await expect(page.locator('#adminLoginStatusMessage')).toContainText(
            'perfil OAuth valido'
        );
        await expect(page.locator('#adminOpenClawRetryBtn')).toBeVisible();
        await expect(page.locator('#adminDashboard')).toHaveClass(/is-hidden/);
        await expect(page.locator('#loginForm')).toHaveClass(/is-hidden/);
    });

    test('login exitoso actualiza el estado de sesion en el chrome v2', async ({
        page,
    }) => {
        await setupLoginAdminMocks(page, { twoFactorRequired: false });

        await page.goto('/admin.html');
        await waitForAdminReady(page);

        await page.locator('#adminPassword').fill('clave-test');
        await page.locator('#loginBtn').click();

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#adminSessionState')).toHaveText(
            /Sesion activa/
        );
        await expect(page.locator('#adminSessionMeta')).toContainText(
            /Protegida/
        );
    });

    test('dashboard incluye desgloses de embudo extendidos', async ({
        page,
    }) => {
        await page.goto('/admin.html');
        await expect(page.locator('#funnelAbandonList')).toHaveCount(1);
        await expect(page.locator('#funnelEntryList')).toHaveCount(1);
        await expect(page.locator('#funnelSourceList')).toHaveCount(1);
        await expect(page.locator('#funnelPaymentMethodList')).toHaveCount(1);
        await expect(page.locator('#funnelAbandonReasonList')).toHaveCount(1);
        await expect(page.locator('#funnelStepList')).toHaveCount(1);
        await expect(page.locator('#funnelErrorCodeList')).toHaveCount(1);
    });

    test('inicio operativo simplifica accesos y resuelve tareas en un clic', async ({
        page,
    }) => {
        const today = new Date().toISOString().split('T')[0];
        await setupAuthenticatedAdminMocks(page, {
            appointments: [
                {
                    id: 1,
                    name: 'Paciente Test',
                    email: 'paciente@example.com',
                    phone: '+593999111222',
                    service: 'consulta',
                    doctor: 'rosero',
                    date: today,
                    time: '10:00',
                    status: 'confirmed',
                    paymentStatus: 'pending_transfer_review',
                },
            ],
            callbacks: [
                {
                    id: 9,
                    telefono: '+593988776655',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#pageTitle')).toHaveText('Inicio');
        await expect(page.locator('#opsTodaySummaryCard')).toBeVisible();
        await expect(page.locator('#opsPendingSummaryCard')).toBeVisible();
        await expect(page.locator('#opsAvailabilitySummaryCard')).toBeVisible();
        await expect(page.locator('#openOperatorAppBtn')).toBeVisible();
        await expect(page.locator('#dashboardAdvancedAnalytics')).not.toHaveJSProperty(
            'open',
            true
        );
        await expect(page.locator('#operationPendingReviewCount')).toHaveText(
            '1'
        );
        await expect(
            page.locator('#operationPendingCallbacksCount')
        ).toHaveText('1');

        await page
            .locator(
                '#opsTodaySummaryCard [data-action="context-open-appointments-overview"]'
            )
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page
            .locator(
                '#opsPendingSummaryCard [data-action="context-open-callbacks-pending"]'
            )
            .click();

        await expect(page.locator('#callbacks')).toHaveClass(/active/);

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page
            .locator(
                '#opsAvailabilitySummaryCard [data-action="context-open-availability"]'
            )
            .click();

        await expect(page.locator('#availability')).toHaveClass(/active/);

        await page
            .locator('#adminSidebar .nav-item[data-section="dashboard"]')
            .click();
        await expect(page.locator('#dashboard')).toHaveClass(/active/);

        await page.locator('#openOperatorAppBtn').click();

        await expect(page).toHaveURL(/\/operador-turnos\.html$/);
    });

    test('acciones secundarias del dashboard siguen llevando a triage util', async ({
        page,
    }) => {
        const today = new Date().toISOString().split('T')[0];
        await setupAuthenticatedAdminMocks(page, {
            appointments: [
                {
                    id: 1,
                    name: 'Paciente Test',
                    email: 'paciente@example.com',
                    phone: '+593999111222',
                    service: 'consulta',
                    doctor: 'rosero',
                    date: today,
                    time: '10:00',
                    status: 'confirmed',
                    paymentStatus: 'pending_transfer_review',
                },
            ],
            callbacks: [
                {
                    id: 9,
                    telefono: '+593988776655',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('.dashboard-card-operations')).toBeVisible();
        await expect(
            page.locator('#operationActionList .operations-action-item')
        ).toHaveCount(3);

        await page
            .locator(
                '.dashboard-card-operations [data-action="context-open-appointments-overview"]'
            )
            .first()
            .click();

        await expect(page.locator('#appointments')).toHaveClass(/active/);
        await expect(page.locator('#pageTitle')).toHaveText('Agenda');
    });

    test('dashboard muestra consola OpenClaw con snapshot operativo degradado', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page, {
            whatsappOpenclawOps: {
                bridgeMode: 'degraded',
                pendingOutbox: 2,
                deliveryFailures: 1,
                aliveHolds: 2,
                lastInboundAt: '2026-03-12T15:00:00.000Z',
                lastOutboundAt: '2026-03-12T15:01:00.000Z',
                failedOutboxItems: [
                    {
                        id: 'out_1',
                        phone: '+593999111222',
                        error: 'helper_no_disponible',
                        text: 'Reintentar envio manual',
                    },
                ],
                activeHolds: [
                    {
                        id: 'hold_1',
                        phone: '+593999111222',
                        date: '2026-03-12',
                        time: '11:30',
                        service: 'consulta',
                    },
                    {
                        id: 'hold_2',
                        phone: '+593999333444',
                        date: '2026-03-12',
                        time: '12:00',
                        service: 'control',
                    },
                ],
                pendingCheckouts: [
                    {
                        paymentSessionId: 'sess_1',
                        holdId: 'hold_1',
                        conversationId: 'conv_1',
                        name: 'Paciente WhatsApp',
                        date: '2026-03-12',
                        time: '11:30',
                        paymentStatus: 'checkout_pending',
                    },
                ],
            },
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#dashboardOpenclawOpsPanel')).toBeVisible();
        await expect(page.locator('#openclawBridgeChip')).toHaveText(
            'Degradado'
        );
        await expect(page.locator('#dashboardOpenclawOpsSummary')).toHaveText(
            '1 entrega(s) fallida(s) requieren requeue o revision manual.'
        );
        await expect(page.locator('#openclawOpsOutboxCount')).toHaveText('2');
        await expect(page.locator('#openclawOpsFailCount')).toHaveText('1');
        await expect(page.locator('#openclawOpsHoldCount')).toHaveText('2');
        await expect(page.locator('#openclawOpsCheckoutCount')).toHaveText('1');
        await expect(
            page.locator('#dashboardOpenclawOpsActions .operations-action-item')
        ).toHaveCount(3);
        await expect(page.locator('#dashboardOpenclawOpsActions')).toContainText(
            'Reencolar fallo'
        );
        await expect(page.locator('#dashboardOpenclawOpsActions')).toContainText(
            'Expirar checkout'
        );
        await expect(page.locator('#dashboardOpenclawOpsActions')).toContainText(
            'Barrer stale'
        );
        await expect(
            page.locator('#dashboardOpenclawOpsItems .dashboard-attention-item')
        ).toHaveCount(3);
    });

    test('acciones OpenClaw del dashboard reencolan fallo y refrescan snapshot', async ({
        page,
    }) => {
        const { whatsappOpsActionRequests } = await setupAuthenticatedAdminMocks(
            page,
            {
                whatsappOpenclawOps: {
                    bridgeMode: 'degraded',
                    pendingOutbox: 1,
                    deliveryFailures: 1,
                    failedOutboxItems: [
                        {
                            id: 'out_1',
                            phone: '+593999111222',
                            error: 'helper_no_disponible',
                        },
                    ],
                },
            }
        );

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page.locator('#openclawOpsFailCount')).toHaveText('1');
        await expect(
            page.locator(
                '#dashboardOpenclawOpsActions [data-whatsapp-ops-action="requeue_outbox"]'
            )
        ).toBeVisible();

        await page
            .locator(
                '#dashboardOpenclawOpsActions [data-whatsapp-ops-action="requeue_outbox"]'
            )
            .click();

        await expect
            .poll(() => whatsappOpsActionRequests.length)
            .toBeGreaterThan(0);
        expect(whatsappOpsActionRequests[0]).toEqual({
            action: 'requeue_outbox',
            id: 'out_1',
        });
        await expect(page.locator('#openclawOpsFailCount')).toHaveText('0');
        await expect(page.locator('#dashboardOpenclawOpsSummary')).toHaveText(
            'Bridge estable, sin fallos de entrega ni checkouts atascados en este momento.'
        );
        await expect(
            page.locator('#dashboardOpenclawOpsActions .operations-action-item')
        ).toHaveCount(1);
        await expect(page.locator('#toastContainer')).toContainText(
            'Outbox reencolado para reintento'
        );
    });

    test('callbacks triage prioriza siguiente llamada y enfoca contacto', async ({
        page,
    }) => {
        const oldPendingDate = new Date(
            Date.now() - 3 * 60 * 60 * 1000
        ).toISOString();
        const recentPendingDate = new Date(
            Date.now() - 20 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 101,
                    telefono: '+593988111222',
                    preferencia: 'ahora',
                    fecha: oldPendingDate,
                    status: 'pending',
                    leadOps: {
                        priorityBand: 'hot',
                    },
                },
                {
                    id: 102,
                    telefono: '+593977333444',
                    preferencia: '30min',
                    fecha: recentPendingDate,
                    status: 'pending',
                },
                {
                    id: 103,
                    telefono: '+593966555666',
                    preferencia: '1hora',
                    fecha: new Date().toISOString(),
                    status: 'contacted',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsPendingCount')).toHaveText('2');
        await expect(page.locator('#callbacksOpsUrgentCount')).toHaveText('1');
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: prioridad comercial alta'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            '+593988111222'
        );
        await expect(page.locator('#callbacks')).not.toContainText(/[ÃÂ]/);

        await page.locator('#callbacksOpsNextBtn').click();
        await expect(
            page.locator(
                '.callback-quick-filter-btn[data-filter-value="pending"]'
            )
        ).toHaveClass(/is-active/);
        await expect(
            page.locator(
                '#callbacksGrid .callback-card.pendiente:has-text("+593988111222")'
            )
        ).toBeVisible();
        await expect(page.locator('#callbacksOpsNextBtn')).toBeEnabled();
    });

    test('callbacks triage muestra copy UTF-8 correcto en estado de atencion y fallback de telefono', async ({
        page,
    }) => {
        const mediumPendingDateA = new Date(
            Date.now() - 150 * 60 * 1000
        ).toISOString();
        const mediumPendingDateB = new Date(
            Date.now() - 130 * 60 * 1000
        ).toISOString();

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 201,
                    telefono: '',
                    preferencia: 'ahora',
                    fecha: mediumPendingDateA,
                    status: 'pending',
                },
                {
                    id: 202,
                    telefono: '+593977111222',
                    preferencia: '30min',
                    fecha: mediumPendingDateB,
                    status: 'pending',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('#callbacksOpsQueueHealth')).toHaveText(
            'Cola: atencion requerida'
        );
        await expect(page.locator('#callbacksOpsNext')).toContainText(
            'Sin telefono'
        );
        await expect(page.locator('#callbacks')).not.toContainText(/[ÃÂ]/);
    });

    test('callbacks permite seleccion visible y marcado masivo', async ({
        page,
    }) => {
        const callbackWriteRequests = [];
        page.on('request', (request) => {
            if (
                request.url().includes('/api.php?resource=callbacks') &&
                request.method() !== 'GET'
            ) {
                callbackWriteRequests.push(request.method());
            }
        });

        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 301,
                    telefono: '+593955111222',
                    preferencia: 'ahora',
                    fecha: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
                    status: 'pending',
                },
                {
                    id: 302,
                    telefono: '+593955333444',
                    preferencia: '30min',
                    fecha: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
                    status: 'pending',
                },
                {
                    id: 303,
                    telefono: '+593955555666',
                    preferencia: '1hora',
                    fecha: new Date().toISOString(),
                    status: 'contacted',
                },
            ],
        });

        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.locator('.nav-item[data-section="callbacks"]').click();
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(
            page.locator(
                '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
            )
        ).toHaveCount(2);

        await page.locator('#callbacksBulkSelectVisibleBtn').click();
        await expect(page.locator('#callbacksSelectionChip')).not.toHaveClass(
            /is-hidden/
        );
        await expect(page.locator('#callbacksSelectedCount')).toHaveText('2');

        await page.locator('#callbacksBulkMarkBtn').click();
        await expect
            .poll(() => callbackWriteRequests.length)
            .toBeGreaterThan(0);
        await expect(page.locator('#callbacksSelectionChip')).toHaveClass(
            /is-hidden/
        );
    });

    test('tema tambien funciona en dashboard autenticado', async ({ page }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        const headerDarkBtn = page
            .locator(
                '.admin-theme-switcher-header .admin-theme-btn[data-theme-mode="dark"]'
            )
            .first();
        const headerLightBtn = page
            .locator(
                '.admin-theme-switcher-header .admin-theme-btn[data-theme-mode="light"]'
            )
            .first();

        await expect(headerDarkBtn).toBeVisible();
        await headerDarkBtn.click();

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }))
            )
            .toEqual({ mode: 'dark', theme: 'dark' });

        await page.reload();
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 15000,
        });
        await expect(headerDarkBtn).toHaveClass(/is-active/);
        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    theme: document.documentElement.getAttribute('data-theme'),
                    stored: localStorage.getItem('themeMode'),
                }))
            )
            .toEqual({ theme: 'dark', stored: 'dark' });

        await headerLightBtn.click();
        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('light');
    });

    test('tema en admin se sincroniza via storage event', async ({ page }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.evaluate(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'themeMode',
                    newValue: 'dark',
                })
            );
        });

        await expect
            .poll(async () =>
                page.evaluate(() => ({
                    mode: document.documentElement.getAttribute(
                        'data-theme-mode'
                    ),
                    theme: document.documentElement.getAttribute('data-theme'),
                }))
            )
            .toEqual({
                mode: 'dark',
                theme: 'dark',
            });

        await page.evaluate(() => {
            window.dispatchEvent(
                new StorageEvent('storage', {
                    key: 'themeMode',
                    newValue: 'light',
                })
            );
        });

        await expect
            .poll(async () =>
                page.evaluate(() =>
                    document.documentElement.getAttribute('data-theme')
                )
            )
            .toBe('light');
    });

    test('reanuda ultima seccion y estado de sidebar colapsado en desktop', async ({
        page,
    }) => {
        await page.addInitScript(() => {
            localStorage.setItem('adminLastSection', 'callbacks');
            localStorage.setItem('adminSidebarCollapsed', '1');
        });
        await setupAuthenticatedAdminMocks(page, {
            callbacks: [
                {
                    id: 701,
                    telefono: '+593900000701',
                    preferencia: 'ahora',
                    fecha: new Date().toISOString(),
                    status: 'pending',
                },
            ],
        });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto('/admin.html');

        await expect(page.locator('#adminDashboard')).toBeVisible();
        await expect(page).toHaveURL(/#callbacks$/);
        await expect(page.locator('#callbacks')).toHaveClass(/active/);
        await expect(page.locator('body')).toHaveClass(
            /admin-sidebar-collapsed/
        );
        await expect(page.locator('#adminSidebarCollapse')).toHaveAttribute(
            'aria-pressed',
            'true'
        );

        await page.locator('#adminSidebarCollapse').click();
        await expect(page.locator('body')).not.toHaveClass(
            /admin-sidebar-collapsed/
        );
        await expect(page.locator('#adminSidebarCollapse')).toHaveAttribute(
            'aria-pressed',
            'false'
        );
        await expect
            .poll(() =>
                page.evaluate(() =>
                    localStorage.getItem('adminSidebarCollapsed')
                )
            )
            .toBe('0');
    });

    test('atajo Alt+Shift+M colapsa en desktop y abre menu en viewport compacto', async ({
        page,
    }) => {
        await setupAuthenticatedAdminMocks(page);
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.goto('/admin.html');
        await expect(page.locator('#adminDashboard')).toBeVisible();

        await page.keyboard.press('Alt+Shift+M');
        await expect(page.locator('body')).toHaveClass(
            /admin-sidebar-collapsed/
        );

        await page.setViewportSize({ width: 900, height: 900 });
        await expect(page.locator('#adminMenuToggle')).toBeVisible();
        await expect(page.locator('body')).not.toHaveClass(
            /admin-sidebar-collapsed/
        );

        await page.keyboard.press('Alt+Shift+M');
        await expect(page.locator('#adminSidebar')).toHaveClass(/is-open/);

        await page.keyboard.press('Escape');
        await expect(page.locator('#adminSidebar')).not.toHaveClass(/is-open/);
    });

    test.describe('API de administracion (requiere PHP)', () => {
        test('API health check funciona', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=health');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
            expect(body.status).toBe('ok');
        });

        test('API data sin auth devuelve 401', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=data');
            expect(resp.status()).toBe(401);
        });

        test('API availability devuelve datos', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=availability');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
        });

        test('API reviews devuelve datos', async ({ request }) => {
            await skipIfPhpRuntimeMissing(test, request);
            const resp = await request.get('/api.php?resource=reviews');
            expect(resp.ok()).toBeTruthy();
            const body = await resp.json();
            expect(body.ok).toBe(true);
        });
    });
});
