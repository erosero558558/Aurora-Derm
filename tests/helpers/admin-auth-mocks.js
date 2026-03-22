// @ts-check
const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';

function fulfillJson(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
}

function buildLegacyFallbackPayload(overrides = {}) {
    const legacyOverrides =
        overrides && typeof overrides.legacy_password === 'object'
            ? overrides.legacy_password
            : {};

    return {
        legacy_password: {
            enabled: false,
            configured: false,
            requires2FA: true,
            available: false,
            reason: 'fallback_disabled',
            ...legacyOverrides,
        },
    };
}

function resolveMockTransport(value, fallback = '') {
    const raw = String(value ?? fallback ?? '')
        .trim()
        .toLowerCase();
    if (raw === 'web_broker') {
        return 'web_broker';
    }
    if (raw === 'local_helper') {
        return 'local_helper';
    }
    return '';
}

function buildOperatorAuthChallenge(overrides = {}, defaults = {}) {
    const challengeId = String(
        overrides.challengeId ||
            defaults.challengeId ||
            'challenge-operator-openclaw'
    );

    return {
        challengeId,
        helperUrl:
            overrides.helperUrl ||
            defaults.helperUrl ||
            `http://127.0.0.1:4173/resolve?challenge=${encodeURIComponent(challengeId)}`,
        manualCode:
            overrides.manualCode || defaults.manualCode || 'OPR123-456XYZ',
        pollAfterMs: Number(
            overrides.pollAfterMs || defaults.pollAfterMs || 50
        ),
        expiresAt:
            overrides.expiresAt ||
            defaults.expiresAt ||
            new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        status: overrides.status || defaults.status || 'pending',
    };
}

function buildOpenClawBrokerRedirect(overrides = {}) {
    return {
        transport: 'web_broker',
        redirectUrl:
            overrides.redirectUrl ||
            'https://broker.example.test/authorize?state=test-state-web-broker',
        expiresAt:
            overrides.expiresAt ||
            new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
}

function buildOperatorQueueTicket(overrides = {}) {
    return {
        id: 2201,
        ticketCode: 'B-2201',
        queueType: 'appointment',
        patientInitials: 'OC',
        priorityClass: 'appt_overdue',
        status: 'waiting',
        assignedConsultorio: null,
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        ...overrides,
    };
}

function buildOperatorQueueState(ticketOrTickets, overrides = {}) {
    const tickets = Array.isArray(ticketOrTickets)
        ? ticketOrTickets
        : [ticketOrTickets || buildOperatorQueueTicket()];
    const waitingTickets = tickets.filter(
        (ticket) => String(ticket?.status || 'waiting') === 'waiting'
    );
    const calledTickets = tickets.filter(
        (ticket) => String(ticket?.status || '') === 'called'
    );

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waitingTickets.length,
        calledCount: calledTickets.length,
        counts: {
            waiting: waitingTickets.length,
            called: calledTickets.length,
            completed: 0,
            no_show: 0,
            cancelled: 0,
        },
        callingNow: calledTickets,
        nextTickets: waitingTickets.map((ticket, index) => ({
            id: ticket.id,
            ticketCode: ticket.ticketCode,
            patientInitials: ticket.patientInitials,
            position: index + 1,
        })),
        ...overrides,
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

function buildLegacyAdminAuthPayload(overrides = {}) {
    const authenticated = Boolean(
        overrides.authenticated === undefined ? true : overrides.authenticated
    );

    return {
        ok: true,
        authenticated,
        status: authenticated ? 'authenticated' : 'anonymous',
        mode: 'legacy_password',
        configured: true,
        recommendedMode: 'legacy_password',
        twoFactorEnabled: false,
        csrfToken: authenticated ? 'csrf_test_token' : '',
        fallbacks: buildLegacyFallbackPayload(overrides.fallbacks),
        ...overrides,
    };
}

function buildOperatorOpenClawAnonymousPayload(overrides = {}) {
    return {
        ok: true,
        authenticated: false,
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        transport: Object.prototype.hasOwnProperty.call(overrides, 'transport')
            ? resolveMockTransport(overrides.transport)
            : 'local_helper',
        status: 'anonymous',
        recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
        csrfToken: 'csrf_operator_auth',
        fallbacks: buildLegacyFallbackPayload(overrides.fallbacks),
        ...overrides,
    };
}

function buildOperatorOpenClawPendingPayload(challenge, overrides = {}) {
    const payload = {
        ok: true,
        authenticated: false,
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        transport: Object.prototype.hasOwnProperty.call(overrides, 'transport')
            ? resolveMockTransport(overrides.transport)
            : 'local_helper',
        status: 'pending',
        recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
        csrfToken: 'csrf_operator_auth',
        fallbacks: buildLegacyFallbackPayload(overrides.fallbacks),
        ...overrides,
    };

    if (challenge && typeof challenge === 'object') {
        payload.challenge = challenge;
    }

    return payload;
}

function buildOperatorOpenClawAuthenticatedPayload(overrides = {}) {
    return {
        ok: true,
        authenticated: true,
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        transport: Object.prototype.hasOwnProperty.call(overrides, 'transport')
            ? resolveMockTransport(overrides.transport)
            : 'local_helper',
        status: 'autenticado',
        recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
        csrfToken: 'csrf_operator_auth',
        operator: {
            email: 'operator@example.com',
            source: CANONICAL_OPERATOR_AUTH_MODE,
        },
        fallbacks: buildLegacyFallbackPayload(overrides.fallbacks),
        ...overrides,
    };
}

async function installLegacyAdminAuthMock(page, overrides = {}) {
    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) =>
        fulfillJson(route, buildLegacyAdminAuthPayload(overrides))
    );
}

async function installLegacyAdminLoginFlowMock(page, options = {}) {
    const twoFactorRequired = Boolean(options.twoFactorRequired);
    const loginError =
        typeof options.loginError === 'string' ? options.loginError : '';
    const loginCsrfToken =
        typeof options.csrfToken === 'string' && options.csrfToken.trim()
            ? options.csrfToken.trim()
            : 'csrf_login_test';
    let authenticated = Boolean(options.authenticated);

    const buildLoginPayload = (overrides = {}) => {
        const nextAuthenticated =
            overrides.authenticated === undefined
                ? authenticated
                : Boolean(overrides.authenticated);

        return buildLegacyAdminAuthPayload({
            authenticated: nextAuthenticated,
            csrfToken: nextAuthenticated ? loginCsrfToken : '',
            twoFactorEnabled: twoFactorRequired,
            ...overrides,
        });
    };

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();

        if (action === 'status') {
            return fulfillJson(
                route,
                buildLoginPayload({
                    authenticated,
                    ...options.statusPayload,
                })
            );
        }

        if (action === 'login') {
            if (loginError) {
                return fulfillJson(
                    route,
                    buildLoginPayload({
                        authenticated: false,
                        ok: false,
                        error: loginError,
                        csrfToken: '',
                        ...options.loginErrorPayload,
                    }),
                    401
                );
            }

            authenticated = !twoFactorRequired;
            return fulfillJson(
                route,
                buildLoginPayload({
                    authenticated,
                    twoFactorRequired,
                    csrfToken: twoFactorRequired ? '' : loginCsrfToken,
                    ...options.loginPayload,
                })
            );
        }

        if (action === 'login-2fa') {
            authenticated = true;
            return fulfillJson(
                route,
                buildLoginPayload({
                    authenticated: true,
                    csrfToken: loginCsrfToken,
                    ...options.login2faPayload,
                })
            );
        }

        if (action === 'logout') {
            authenticated = false;
            return fulfillJson(
                route,
                buildLoginPayload({
                    authenticated: false,
                    csrfToken: '',
                    ...options.logoutPayload,
                })
            );
        }

        return fulfillJson(route, { ok: true, ...options.defaultPayload });
    });

    return {
        getAuthenticated() {
            return authenticated;
        },
        setAuthenticated(next) {
            authenticated = Boolean(next);
        },
    };
}

async function installOperatorOpenClawAuthMock(target, options = {}) {
    const startStatusCode = Number.isFinite(options.startStatusCode)
        ? Math.trunc(options.startStatusCode)
        : 202;
    const autoAuthenticateOnPendingStatus =
        options.autoAuthenticateOnPendingStatus === true;
    const providedStatusResponses = Array.isArray(options.statusResponses)
        ? options.statusResponses
        : null;
    const providedStartResponses =
        Array.isArray(options.startResponses) &&
        options.startResponses.length > 0
            ? options.startResponses
            : null;
    const startResponseFactory =
        typeof options.startResponseFactory === 'function'
            ? options.startResponseFactory
            : null;
    const initialTransport = resolveMockTransport(
        Object.prototype.hasOwnProperty.call(options, 'transport')
            ? options.transport
            : options.anonymousPayload?.transport ??
                  options.pendingPayload?.transport ??
                  'local_helper'
    );

    let statusIndex = 0;
    let startIndex = 0;
    let startCount = 0;
    let statusCalls = 0;
    let lastIssuedChallenge = null;
    const startRequests = [];

    let authState = {
        authenticated: false,
        status: 'anonymous',
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        transport: initialTransport,
        csrfToken: '',
        operator: null,
        challenge: null,
        redirectUrl: '',
        attemptExpiresAt: '',
    };

    function adoptAuthPayload(payload = {}) {
        const authenticated = payload?.authenticated === true;
        const challenge = payload?.challenge || null;
        authState = {
            authenticated,
            status: String(
                payload?.status ||
                    (authenticated
                        ? 'autenticado'
                        : challenge
                          ? 'pending'
                          : 'anonymous')
            ).trim(),
            mode:
                String(payload?.mode || CANONICAL_OPERATOR_AUTH_MODE).trim() ||
                CANONICAL_OPERATOR_AUTH_MODE,
            transport: resolveMockTransport(payload?.transport),
            csrfToken: authenticated ? String(payload?.csrfToken || '') : '',
            operator: authenticated ? payload?.operator || null : null,
            challenge,
            redirectUrl: String(payload?.redirectUrl || '').trim(),
            attemptExpiresAt: String(payload?.expiresAt || '').trim(),
        };
        if (challenge) {
            lastIssuedChallenge = challenge;
        } else if (authState.transport === 'web_broker') {
            lastIssuedChallenge = {
                transport: 'web_broker',
                redirectUrl: authState.redirectUrl,
                expiresAt: authState.attemptExpiresAt,
            };
        }
        return payload;
    }

    function buildStartPayload(nextStartCount, requestMeta = null) {
        if (startResponseFactory) {
            return adoptAuthPayload(
                startResponseFactory(nextStartCount, requestMeta) || {}
            );
        }

        if (providedStartResponses) {
            const payload =
                providedStartResponses[
                    Math.min(
                        startIndex,
                        Math.max(providedStartResponses.length - 1, 0)
                    )
                ] || providedStartResponses[providedStartResponses.length - 1];
            return adoptAuthPayload(payload || {});
        }

        const challenge = buildOperatorAuthChallenge(options.challenge || {});
        return adoptAuthPayload(
            buildOperatorOpenClawPendingPayload(
                challenge,
                options.startPayload || {}
            )
        );
    }

    function buildDynamicStatusPayload() {
        if (
            autoAuthenticateOnPendingStatus &&
            authState.authenticated !== true &&
            String(authState.status || '') === 'pending' &&
            (authState.challenge || authState.transport === 'web_broker')
        ) {
            return adoptAuthPayload(
                buildOperatorOpenClawAuthenticatedPayload({
                    transport: authState.transport,
                    ...(options.authenticatedPayload || {}),
                })
            );
        }

        if (authState.authenticated) {
            return adoptAuthPayload(
                buildOperatorOpenClawAuthenticatedPayload({
                    csrfToken:
                        authState.csrfToken ||
                        options.authenticatedPayload?.csrfToken,
                    operator:
                        authState.operator ||
                        options.authenticatedPayload?.operator,
                    ...(options.authenticatedPayload || {}),
                })
            );
        }

        if (
            String(authState.status || '') === 'pending' &&
            (authState.challenge || authState.transport === 'web_broker')
        ) {
            return adoptAuthPayload(
                buildOperatorOpenClawPendingPayload(authState.challenge, {
                    ...(options.pendingPayload || {}),
                    transport: authState.transport,
                    redirectUrl: authState.redirectUrl,
                    expiresAt: authState.attemptExpiresAt,
                })
            );
        }

        return adoptAuthPayload(
            buildOperatorOpenClawAnonymousPayload({
                ...(options.anonymousPayload || {}),
                transport: authState.transport,
            })
        );
    }

    await target.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();

        if (action === 'status') {
            statusCalls += 1;
            if (providedStatusResponses) {
                const payload =
                    providedStatusResponses[
                        Math.min(
                            statusIndex,
                            Math.max(providedStatusResponses.length - 1, 0)
                        )
                    ] ||
                    providedStatusResponses[providedStatusResponses.length - 1];
                statusIndex += 1;
                return fulfillJson(route, adoptAuthPayload(payload || {}));
            }
            return fulfillJson(route, buildDynamicStatusPayload());
        }

        if (action === 'start') {
            startCount += 1;
            let requestBody = null;
            try {
                requestBody = route.request().postDataJSON();
            } catch (_error) {
                requestBody = null;
            }
            startRequests.push({
                method: route.request().method(),
                url: route.request().url(),
                body: requestBody,
            });
            const payload = buildStartPayload(startCount, {
                method: route.request().method(),
                url: route.request().url(),
                body: requestBody,
            });
            startIndex += 1;
            return fulfillJson(route, payload, startStatusCode);
        }

        if (action === 'logout') {
            lastIssuedChallenge = null;
            return fulfillJson(
                route,
                adoptAuthPayload(
                    buildOperatorOpenClawAnonymousPayload(
                        options.logoutPayload || {}
                    )
                )
            );
        }

        return fulfillJson(route, {
            ok: true,
            ...(options.defaultPayload || {}),
        });
    });

    return {
        startRequests,
        getStatusCalls() {
            return statusCalls;
        },
        getStartCount() {
            return startCount;
        },
        getLastIssuedChallenge() {
            return lastIssuedChallenge;
        },
        snapshotAuthState() {
            return {
                ...authState,
            };
        },
    };
}

function buildOpenClawAdminChallenge(overrides = {}) {
    return {
        challengeId: '9f38f7d8d6d44da7b3d45a1f315dabc1',
        nonce: '4c671989f3f6470db37ac0ecb127aa82',
        status: 'pending',
        manualCode: '9F38F7-D8D6D4',
        helperUrl:
            'http://127.0.0.1:4173/resolve?challengeId=9f38f7d8d6d44da7b3d45a1f315dabc1&nonce=4c671989f3f6470db37ac0ecb127aa82',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        pollAfterMs: 40,
        ...overrides,
    };
}

function buildOpenClawAdminOperator(overrides = {}) {
    return {
        email: 'operator@example.com',
        profileId: 'profile-test',
        accountId: 'acct-test',
        source: CANONICAL_OPERATOR_AUTH_MODE,
        ...overrides,
    };
}

function buildOpenClawAdminAuthPayload(overrides = {}) {
    const authenticated = Boolean(
        overrides.authenticated === undefined ? false : overrides.authenticated
    );

    const payload = {
        ok: true,
        authenticated,
        configured: true,
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        transport: Object.prototype.hasOwnProperty.call(overrides, 'transport')
            ? resolveMockTransport(overrides.transport)
            : 'local_helper',
        recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
        status: authenticated ? 'autenticado' : 'pending',
        fallbacks: buildLegacyFallbackPayload(overrides.fallbacks),
        ...overrides,
    };

    if (payload.authenticated) {
        if (!payload.csrfToken) {
            payload.csrfToken = 'csrf-openclaw-test';
        }
        if (!payload.operator) {
            payload.operator = buildOpenClawAdminOperator();
        }
    } else {
        if (overrides.csrfToken === undefined) {
            delete payload.csrfToken;
        }
        if (overrides.operator === undefined) {
            delete payload.operator;
        }
    }

    return payload;
}

async function installOpenClawAdminAuthMock(page, options = {}) {
    const transport = Object.prototype.hasOwnProperty.call(options, 'transport')
        ? resolveMockTransport(options.transport)
        : resolveMockTransport(
              options.anonymousPayload?.transport ??
                  options.startPayload?.transport ??
                  options.pendingPayload?.transport ??
                  options.authenticatedPayload?.transport ??
                  options.terminalPayload?.transport ??
                  options.logoutPayload?.transport,
              'local_helper'
          );
    const terminalStatus =
        typeof options.terminalStatus === 'string' &&
        options.terminalStatus.trim()
            ? options.terminalStatus.trim()
            : 'autenticado';
    const terminalError =
        typeof options.terminalError === 'string' ? options.terminalError : '';
    const pollsBeforeTerminal = Number.isFinite(options.pollsBeforeTerminal)
        ? Math.max(0, Math.trunc(options.pollsBeforeTerminal))
        : 2;
    const challenge = buildOpenClawAdminChallenge(options.challenge);
    const webBroker = buildOpenClawBrokerRedirect(options.webBroker || {});
    const keepPendingAfterStart = options.keepPendingAfterStart === true;
    const pendingStatusCallsAfterStart = Number.isFinite(
        options.pendingStatusCallsAfterStart
    )
        ? Math.max(0, Math.trunc(options.pendingStatusCallsAfterStart))
        : keepPendingAfterStart
          ? Number.MAX_SAFE_INTEGER
          : 0;
    let statusCalls = 0;
    let startCalls = 0;
    let startTriggered = false;
    let webBrokerStatusCallsAfterStart = 0;
    let legacyFallbackAuthenticated = false;
    let legacyFallbackPending2FA = false;
    const fallbackEnabled = options.fallbackAvailable === true;
    const fallbackTwoFactorRequired =
        options.fallbackTwoFactorRequired !== false;
    const fallbackPayload = buildLegacyFallbackPayload(
        fallbackEnabled
            ? {
                  legacy_password: {
                      enabled: true,
                      configured: true,
                      available: true,
                      reason: 'fallback_available',
                  },
              }
            : {}
    );

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();

        if (action === 'status') {
            statusCalls += 1;

            if (legacyFallbackAuthenticated) {
                return fulfillJson(
                    route,
                    buildLegacyAdminAuthPayload({
                        authenticated: true,
                        recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
                        twoFactorEnabled: true,
                        fallbacks: fallbackPayload,
                        ...options.fallbackAuthenticatedPayload,
                    })
                );
            }

            if (legacyFallbackPending2FA) {
                return fulfillJson(
                    route,
                    buildLegacyAdminAuthPayload({
                        authenticated: false,
                        status: 'two_factor_required',
                        recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
                        twoFactorEnabled: true,
                        fallbacks: fallbackPayload,
                    })
                );
            }

            if (statusCalls === 1) {
                return fulfillJson(
                    route,
                    buildOpenClawAdminAuthPayload({
                        authenticated: false,
                        status: 'anonymous',
                        transport,
                        fallbacks: fallbackPayload,
                        ...options.anonymousPayload,
                    })
                );
            }

            if (transport === 'web_broker' && startTriggered) {
                webBrokerStatusCallsAfterStart += 1;
                if (
                    webBrokerStatusCallsAfterStart <=
                    pendingStatusCallsAfterStart
                ) {
                    return fulfillJson(
                        route,
                        buildOpenClawAdminAuthPayload({
                            authenticated: false,
                            status: 'pending',
                            transport,
                            ...webBroker,
                            fallbacks: fallbackPayload,
                            ...options.pendingPayload,
                        })
                    );
                }

                if (terminalStatus === 'autenticado') {
                    return fulfillJson(
                        route,
                        buildOpenClawAdminAuthPayload({
                            authenticated: true,
                            status: 'autenticado',
                            transport,
                            operator: buildOpenClawAdminOperator(
                                options.operator
                            ),
                            fallbacks: fallbackPayload,
                            ...options.authenticatedPayload,
                        })
                    );
                }

                return fulfillJson(
                    route,
                    buildOpenClawAdminAuthPayload({
                        authenticated: false,
                        status: terminalStatus,
                        transport,
                        error: terminalError,
                        fallbacks: fallbackPayload,
                        ...options.terminalPayload,
                    })
                );
            }

            if (
                terminalStatus === 'autenticado' &&
                statusCalls > 1 + pollsBeforeTerminal
            ) {
                return fulfillJson(
                    route,
                    buildOpenClawAdminAuthPayload({
                        authenticated: true,
                        status: 'autenticado',
                        transport,
                        operator: buildOpenClawAdminOperator(options.operator),
                        fallbacks: fallbackPayload,
                        ...options.authenticatedPayload,
                    })
                );
            }

            if (statusCalls > 1 + pollsBeforeTerminal) {
                return fulfillJson(
                    route,
                    buildOpenClawAdminAuthPayload({
                        authenticated: false,
                        status: terminalStatus,
                        transport,
                        error: terminalError,
                        challenge,
                        fallbacks: fallbackPayload,
                        ...options.terminalPayload,
                    })
                );
            }

            return fulfillJson(
                route,
                buildOpenClawAdminAuthPayload({
                    authenticated: false,
                    status: 'pending',
                    transport,
                    ...(transport === 'web_broker' ? webBroker : { challenge }),
                    fallbacks: fallbackPayload,
                    ...options.pendingPayload,
                })
            );
        }

        if (action === 'start') {
            startTriggered = true;
            startCalls += 1;
            return fulfillJson(
                route,
                buildOpenClawAdminAuthPayload({
                    authenticated: false,
                    status: 'pending',
                    transport,
                    ...(transport === 'web_broker' ? webBroker : { challenge }),
                    fallbacks: fallbackPayload,
                    ...options.startPayload,
                }),
                202
            );
        }

        if (action === 'login') {
            if (!fallbackEnabled) {
                return fulfillJson(
                    route,
                    {
                        ok: false,
                        code: 'legacy_auth_disabled',
                        error: 'El acceso por clave de contingencia no esta disponible en este entorno.',
                        fallbacks: fallbackPayload,
                    },
                    401
                );
            }

            legacyFallbackPending2FA = fallbackTwoFactorRequired;
            legacyFallbackAuthenticated = !fallbackTwoFactorRequired;
            return fulfillJson(
                route,
                buildLegacyAdminAuthPayload({
                    authenticated: !fallbackTwoFactorRequired,
                    status: fallbackTwoFactorRequired
                        ? 'two_factor_required'
                        : 'authenticated',
                    recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
                    twoFactorEnabled: true,
                    twoFactorRequired: fallbackTwoFactorRequired,
                    csrfToken: fallbackTwoFactorRequired
                        ? ''
                        : 'csrf-openclaw-fallback',
                    fallbacks: fallbackPayload,
                    ...options.fallbackLoginPayload,
                })
            );
        }

        if (action === 'login-2fa') {
            legacyFallbackPending2FA = false;
            legacyFallbackAuthenticated = true;
            return fulfillJson(
                route,
                buildLegacyAdminAuthPayload({
                    authenticated: true,
                    recommendedMode: CANONICAL_OPERATOR_AUTH_MODE,
                    twoFactorEnabled: true,
                    csrfToken: 'csrf-openclaw-fallback',
                    fallbacks: fallbackPayload,
                    ...options.fallback2faPayload,
                })
            );
        }

        if (action === 'logout') {
            legacyFallbackAuthenticated = false;
            legacyFallbackPending2FA = false;
            return fulfillJson(
                route,
                buildOpenClawAdminAuthPayload({
                    authenticated: false,
                    status: 'logout',
                    transport,
                    fallbacks: fallbackPayload,
                    ...options.logoutPayload,
                })
            );
        }

        return fulfillJson(route, { ok: true, ...options.defaultPayload });
    });

    return {
        challenge: transport === 'web_broker' ? webBroker : challenge,
        getStatusCalls() {
            return statusCalls;
        },
        getStartCount() {
            return startCalls;
        },
        isLegacyFallbackPending2FA() {
            return legacyFallbackPending2FA;
        },
    };
}

module.exports = {
    buildOperatorAuthChallenge,
    buildOperatorQueueState,
    buildOperatorQueueTicket,
    buildLegacyAdminAuthPayload,
    buildOpenClawAdminAuthPayload,
    buildOpenClawBrokerRedirect,
    buildOpenClawAdminChallenge,
    buildOpenClawAdminOperator,
    installLegacyAdminAuthMock,
    installLegacyAdminLoginFlowMock,
    installOperatorOpenClawAuthMock,
    installOpenClawAdminAuthMock,
    installWindowOpenRecorder,
};
