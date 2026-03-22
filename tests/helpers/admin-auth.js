// @ts-check
'use strict';

const {
    normalizeEmail,
    operatorAuthSignaturePayload,
    signOperatorAuthPayload,
} = require('../../bin/lib/operator-auth-signature.js');
const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';
const LEGACY_OPERATOR_AUTH_MODE = 'openclaw_chatgpt';

function envCandidates(name) {
    const normalized = String(name || '').trim();
    if (!normalized) {
        return [];
    }

    if (normalized.startsWith('AURORADERM_')) {
        return [
            normalized,
            `PIELARMONIA_${normalized.slice('AURORADERM_'.length)}`,
        ];
    }

    if (normalized.startsWith('PIELARMONIA_')) {
        return [
            `AURORADERM_${normalized.slice('PIELARMONIA_'.length)}`,
            normalized,
        ];
    }

    return [normalized];
}

function getEnv(name, fallback = '') {
    for (const candidate of envCandidates(name)) {
        const value = process.env[candidate];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
    }

    return fallback;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        const normalized = String(value || '').trim();
        if (normalized) {
            return normalized;
        }
    }

    return '';
}

function splitCsv(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

async function safeJson(response) {
    try {
        return await response.json();
    } catch {
        return {};
    }
}

async function getAdminAuthStatus(request) {
    const response = await request.get('/admin-auth.php?action=status');
    const body = await safeJson(response);

    return {
        ok: response.ok(),
        httpStatus: response.status(),
        body,
        mode: typeof body.mode === 'string' ? body.mode : '',
        status: typeof body.status === 'string' ? body.status : '',
        configured: body.configured !== false,
        recommendedMode:
            typeof body.recommendedMode === 'string'
                ? body.recommendedMode
                : '',
    };
}

function getOperatorAuthTestConfig(overrides = {}) {
    const rawAllowlist = firstNonEmpty(
        overrides.allowlist,
        getEnv('TEST_OPERATOR_AUTH_ALLOWLIST'),
        getEnv('PIELARMONIA_OPERATOR_AUTH_ALLOWLIST'),
        getEnv('PIELARMONIA_OPERATOR_AUTH_ALLOWED_EMAILS'),
        getEnv('PIELARMONIA_ADMIN_EMAIL'),
        'operator@example.com'
    );
    const allowlist = splitCsv(rawAllowlist).map(normalizeEmail);
    const email = normalizeEmail(
        firstNonEmpty(
            overrides.email,
            getEnv('TEST_OPERATOR_AUTH_EMAIL'),
            allowlist[0]
        )
    );
    if (email && !allowlist.includes(email)) {
        allowlist.unshift(email);
    }

    const bridgeToken = firstNonEmpty(
        overrides.bridgeToken,
        getEnv('TEST_OPERATOR_AUTH_BRIDGE_TOKEN'),
        getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN'),
        'operator-auth-bridge-test-token'
    );

    return {
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        allowlist,
        email: email || 'operator@example.com',
        profileId: firstNonEmpty(
            overrides.profileId,
            getEnv('TEST_OPERATOR_AUTH_PROFILE_ID'),
            'openai-codex:test-profile'
        ),
        accountId: firstNonEmpty(
            overrides.accountId,
            getEnv('TEST_OPERATOR_AUTH_ACCOUNT_ID'),
            'acct-test-operator'
        ),
        deviceId: firstNonEmpty(
            overrides.deviceId,
            getEnv('TEST_OPERATOR_AUTH_DEVICE_ID'),
            'device-test-operator'
        ),
        bridgeToken,
        bridgeSecret: firstNonEmpty(
            overrides.bridgeSecret,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_SECRET'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET'),
            bridgeToken
        ),
        bridgeHeader: firstNonEmpty(
            overrides.bridgeHeader,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_HEADER'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER'),
            'Authorization'
        ),
        bridgePrefix: firstNonEmpty(
            overrides.bridgePrefix,
            getEnv('TEST_OPERATOR_AUTH_BRIDGE_PREFIX'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX'),
            'Bearer'
        ),
        helperBaseUrl: firstNonEmpty(
            overrides.helperBaseUrl,
            getEnv('TEST_OPERATOR_AUTH_HELPER_BASE_URL'),
            getEnv('PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL'),
            'http://127.0.0.1:4173'
        ),
    };
}

function getOperatorAuthTestEnv(overrides = {}) {
    const config = getOperatorAuthTestConfig(overrides);

    return {
        AURORADERM_INTERNAL_CONSOLE_AUTH_PRIMARY: config.mode,
        AURORADERM_OPERATOR_AUTH_MODE: config.mode,
        AURORADERM_OPERATOR_AUTH_ALLOWLIST: config.allowlist.join(','),
        AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN: config.bridgeToken,
        AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET: config.bridgeSecret,
        AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER: config.bridgeHeader,
        AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX: config.bridgePrefix,
        AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL: config.helperBaseUrl,
        AURORADERM_ADMIN_EMAIL: config.email,
        PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY: config.mode,
        PIELARMONIA_OPERATOR_AUTH_MODE: config.mode,
        PIELARMONIA_OPERATOR_AUTH_ALLOWLIST: config.allowlist.join(','),
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN: config.bridgeToken,
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET: config.bridgeSecret,
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER: config.bridgeHeader,
        PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX: config.bridgePrefix,
        PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL: config.helperBaseUrl,
        PIELARMONIA_ADMIN_EMAIL: config.email,
    };
}

async function requireLegacyPasswordMode(request) {
    const snapshot = await getAdminAuthStatus(request);
    if (!snapshot.ok) {
        return {
            ok: false,
            reason: `No se pudo consultar admin-auth status (HTTP ${snapshot.httpStatus}).`,
        };
    }

    if (snapshot.mode !== 'legacy_password') {
        const preferred =
            snapshot.mode || snapshot.recommendedMode || 'openclaw_chatgpt';
        return {
            ok: false,
            reason: `Este entorno usa ${preferred} como acceso primario. Activa AURORADERM_INTERNAL_CONSOLE_AUTH_PRIMARY=legacy_password para habilitar login por clave. El alias PIELARMONIA_* sigue disponible temporalmente.`,
        };
    }

    if (
        snapshot.status === 'legacy_auth_not_configured' ||
        snapshot.configured === false
    ) {
        return {
            ok: false,
            reason: 'Login legacy no configurado. Define AURORADERM_ADMIN_PASSWORD y el override legacy en este entorno. El alias PIELARMONIA_* sigue disponible temporalmente.',
        };
    }

    return {
        ok: true,
        snapshot,
    };
}

async function requireOpenClawMode(request) {
    const snapshot = await getAdminAuthStatus(request);
    if (!snapshot.ok) {
        return {
            ok: false,
            reason: `No se pudo consultar admin-auth status (HTTP ${snapshot.httpStatus}).`,
        };
    }

    if (
        snapshot.mode !== CANONICAL_OPERATOR_AUTH_MODE &&
        snapshot.mode !== LEGACY_OPERATOR_AUTH_MODE
    ) {
        return {
            ok: false,
            reason: `Este entorno usa ${snapshot.mode || 'legacy_password'} como acceso primario. Activa operator auth para este flujo.`,
        };
    }

    if (
        snapshot.status === 'operator_auth_not_configured' ||
        snapshot.configured === false
    ) {
        return {
            ok: false,
            reason: 'Operator auth no configurado. Define broker OAuth/OIDC, bridge y allowlist para este entorno.',
        };
    }

    return {
        ok: true,
        snapshot,
    };
}

async function adminPasswordLogin(request, password) {
    const preflight = await requireLegacyPasswordMode(request);
    if (!preflight.ok) {
        return preflight;
    }

    if (!String(password || '').trim()) {
        return {
            ok: false,
            reason: 'Password admin requerido para login legacy.',
        };
    }

    const response = await request.post('/admin-auth.php?action=login', {
        data: { password },
    });
    const body = await safeJson(response);

    if (!response.ok() || body.ok === false) {
        return {
            ok: false,
            reason: body.error || `HTTP ${response.status()}`,
        };
    }

    if (body.twoFactorRequired) {
        return {
            ok: false,
            reason: '2FA requerido para panel admin',
        };
    }

    const csrfToken = typeof body.csrfToken === 'string' ? body.csrfToken : '';
    if (!csrfToken) {
        return {
            ok: false,
            reason: 'Login admin sin CSRF token',
        };
    }

    return {
        ok: true,
        csrfToken,
        body,
    };
}

async function startOpenClawChallenge(request) {
    const preflight = await requireOpenClawMode(request);
    if (!preflight.ok) {
        return preflight;
    }

    const csrfToken =
        typeof preflight.snapshot?.body?.csrfToken === 'string'
            ? preflight.snapshot.body.csrfToken
            : '';
    if (!csrfToken) {
        return {
            ok: false,
            reason: 'admin-auth status no devolvio csrfToken para iniciar operator auth.',
        };
    }

    const response = await request.post('/admin-auth.php?action=start', {
        headers: {
            'X-CSRF-Token': csrfToken,
        },
        data: {},
    });
    const body = await safeJson(response);

    if (response.status() !== 202 || body.ok !== true) {
        return {
            ok: false,
            reason:
                body.error ||
                `No se pudo iniciar challenge operator auth (HTTP ${response.status()}).`,
            body,
        };
    }

    const challenge =
        body.challenge && typeof body.challenge === 'object'
            ? body.challenge
            : null;
    if (!challenge) {
        return {
            ok: false,
            reason: 'Challenge operator auth ausente en la respuesta del backend.',
            body,
        };
    }

    return {
        ok: true,
        challenge,
        body,
    };
}

async function completeOpenClawChallenge(request, challenge, overrides = {}) {
    const config = getOperatorAuthTestConfig(overrides);
    const payload = {
        challengeId: String(challenge?.challengeId || '').trim(),
        nonce: String(challenge?.nonce || '').trim(),
        status: 'completed',
        email: config.email,
        profileId: config.profileId,
        accountId: config.accountId,
        deviceId: config.deviceId,
        timestamp: new Date().toISOString(),
    };

    if (!payload.challengeId || !payload.nonce) {
        return {
            ok: false,
            reason: 'Challenge operator auth invalido: faltan challengeId o nonce.',
        };
    }

    payload.signature = signOperatorAuthPayload(payload, config.bridgeSecret);
    const authHeader = config.bridgePrefix
        ? `${config.bridgePrefix} ${config.bridgeToken}`
        : config.bridgeToken;
    const response = await request.post(
        '/api.php?resource=operator-auth-complete',
        {
            headers: {
                [config.bridgeHeader]: authHeader,
            },
            data: payload,
        }
    );
    const body = await safeJson(response);

    if (response.status() !== 202 || body.ok !== true) {
        return {
            ok: false,
            reason:
                body.error ||
                `No se pudo completar challenge operator auth (HTTP ${response.status()}).`,
            body,
            payload,
        };
    }

    return {
        ok: true,
        body,
        payload,
    };
}

async function consumeOpenClawSession(request, { retries = 4 } = {}) {
    for (let attempt = 0; attempt < retries; attempt += 1) {
        const response = await request.get('/admin-auth.php?action=status');
        const body = await safeJson(response);

        if (response.ok() && body.authenticated === true) {
            const csrfToken =
                typeof body.csrfToken === 'string' ? body.csrfToken : '';
            if (!csrfToken) {
                return {
                    ok: false,
                    reason: 'Sesion operator auth autenticada sin CSRF token.',
                    body,
                };
            }

            return {
                ok: true,
                csrfToken,
                body,
            };
        }

        const status = String(body.status || '').trim();
        if (
            status &&
            status !== 'pending' &&
            status !== 'anonymous' &&
            status !== 'operator_auth_not_configured'
        ) {
            return {
                ok: false,
                reason:
                    body.error || `Operator auth devolvio estado terminal ${status}.`,
                body,
            };
        }
    }

    return {
        ok: false,
        reason: 'Operator auth no llego a estado autenticado dentro del polling esperado.',
    };
}

async function adminOpenClawLogin(request, overrides = {}) {
    const start = await startOpenClawChallenge(request);
    if (!start.ok) {
        return start;
    }

    const completion = await completeOpenClawChallenge(
        request,
        start.challenge,
        overrides
    );
    if (!completion.ok) {
        return completion;
    }

    const session = await consumeOpenClawSession(request, overrides);
    if (!session.ok) {
        return session;
    }

    return {
        ok: true,
        csrfToken: session.csrfToken,
        challenge: start.challenge,
        body: session.body,
    };
}

async function adminLogin(request, overrides = {}) {
    const snapshot = await getAdminAuthStatus(request);
    if (!snapshot.ok) {
        return {
            ok: false,
            reason: `No se pudo consultar admin-auth status (HTTP ${snapshot.httpStatus}).`,
        };
    }

    if (
        snapshot.mode === CANONICAL_OPERATOR_AUTH_MODE ||
        snapshot.mode === LEGACY_OPERATOR_AUTH_MODE
    ) {
        return adminOpenClawLogin(request, overrides);
    }

    const password = firstNonEmpty(
        overrides.password,
        getEnv('TEST_ADMIN_PASSWORD'),
        getEnv('AURORADERM_ADMIN_PASSWORD'),
        getEnv('PIELARMONIA_ADMIN_PASSWORD')
    );

    if (!password) {
        return {
            ok: false,
            reason: 'TEST_ADMIN_PASSWORD, AURORADERM_ADMIN_PASSWORD o el alias PIELARMONIA_ADMIN_PASSWORD es requerido para login legacy.',
        };
    }

    return adminPasswordLogin(request, password);
}

module.exports = {
    adminLogin,
    adminOpenClawLogin,
    adminPasswordLogin,
    completeOpenClawChallenge,
    getAdminAuthStatus,
    getEnv,
    getOperatorAuthTestConfig,
    getOperatorAuthTestEnv,
    operatorAuthSignaturePayload,
    requireLegacyPasswordMode,
    requireOpenClawMode,
    safeJson,
    signOperatorAuthPayload,
    startOpenClawChallenge,
};
