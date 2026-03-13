// @ts-check

function fulfillJson(route, payload, status = 200) {
    return route.fulfill({
        status,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(payload),
    });
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
        source: 'openclaw_chatgpt',
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
        mode: 'openclaw_chatgpt',
        status: authenticated ? 'autenticado' : 'pending',
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
    let statusCalls = 0;

    await page.route(/\/admin-auth\.php(\?.*)?$/i, async (route) => {
        const url = new URL(route.request().url());
        const action = String(
            url.searchParams.get('action') || ''
        ).toLowerCase();

        if (action === 'status') {
            statusCalls += 1;

            if (statusCalls === 1) {
                return fulfillJson(
                    route,
                    buildOpenClawAdminAuthPayload({
                        authenticated: false,
                        status: 'anonymous',
                        ...options.anonymousPayload,
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
                        operator: buildOpenClawAdminOperator(options.operator),
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
                        error: terminalError,
                        challenge,
                        ...options.terminalPayload,
                    })
                );
            }

            return fulfillJson(
                route,
                buildOpenClawAdminAuthPayload({
                    authenticated: false,
                    status: 'pending',
                    challenge,
                    ...options.pendingPayload,
                })
            );
        }

        if (action === 'start') {
            return fulfillJson(
                route,
                buildOpenClawAdminAuthPayload({
                    authenticated: false,
                    status: 'pending',
                    challenge,
                    ...options.startPayload,
                }),
                202
            );
        }

        if (action === 'logout') {
            return fulfillJson(
                route,
                buildOpenClawAdminAuthPayload({
                    authenticated: false,
                    status: 'logout',
                    ...options.logoutPayload,
                })
            );
        }

        return fulfillJson(route, { ok: true, ...options.defaultPayload });
    });

    return {
        challenge,
        getStatusCalls() {
            return statusCalls;
        },
    };
}

module.exports = {
    buildLegacyAdminAuthPayload,
    buildOpenClawAdminAuthPayload,
    buildOpenClawAdminChallenge,
    buildOpenClawAdminOperator,
    installLegacyAdminAuthMock,
    installLegacyAdminLoginFlowMock,
    installOpenClawAdminAuthMock,
};
