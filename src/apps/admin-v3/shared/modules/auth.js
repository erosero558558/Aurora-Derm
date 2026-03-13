import { authRequest, setApiCsrfToken } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';

function snapshotAuthState() {
    return {
        ...getState().auth,
    };
}

function openHelperWindow(helperUrl) {
    const url = String(helperUrl || '').trim();
    if (
        !url ||
        typeof window === 'undefined' ||
        typeof window.open !== 'function'
    ) {
        return false;
    }

    try {
        const popup = window.open(url, '_blank', 'noopener,noreferrer');
        return Boolean(popup);
    } catch (_error) {
        return false;
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, Math.max(0, Number(ms || 0)));
    });
}

function normalizeAuthMode(payload, fallback = 'legacy_password') {
    const raw = String(payload?.mode || '')
        .trim()
        .toLowerCase();
    if (raw === 'openclaw_chatgpt') {
        return 'openclaw_chatgpt';
    }
    if (raw === 'legacy_password') {
        return 'legacy_password';
    }
    return fallback;
}

function normalizeChallenge(challenge) {
    if (!challenge || typeof challenge !== 'object') {
        return null;
    }

    const challengeId = String(challenge.challengeId || '').trim();
    if (!challengeId) {
        return null;
    }

    return {
        challengeId,
        nonce: String(challenge.nonce || '').trim(),
        expiresAt: String(challenge.expiresAt || '').trim(),
        status: String(challenge.status || 'pending').trim() || 'pending',
        manualCode: String(challenge.manualCode || '').trim(),
        helperUrl: String(challenge.helperUrl || '').trim(),
        pollAfterMs: Number(challenge.pollAfterMs || 1200) || 1200,
    };
}

function normalizeOperator(operator) {
    if (!operator || typeof operator !== 'object') {
        return null;
    }

    const email = String(operator.email || '').trim();
    if (!email) {
        return null;
    }

    return {
        email,
        profileId: String(operator.profileId || '').trim(),
        accountId: String(operator.accountId || '').trim(),
        source: String(operator.source || '').trim(),
        authenticatedAt: String(operator.authenticatedAt || '').trim(),
        expiresAt: String(operator.expiresAt || '').trim(),
    };
}

function normalizeCapabilities(
    capabilities,
    authenticated,
    fallbackCapabilities = null
) {
    const source =
        capabilities && typeof capabilities === 'object'
            ? capabilities
            : fallbackCapabilities && typeof fallbackCapabilities === 'object'
              ? fallbackCapabilities
              : {};

    return {
        adminAgent:
            authenticated === true &&
            (!Object.prototype.hasOwnProperty.call(source, 'adminAgent') ||
                source.adminAgent === true),
    };
}

function applyAuthPayload(payload, fallbackMode = 'legacy_password') {
    const authenticated = payload?.authenticated === true;
    const mode = normalizeAuthMode(payload, fallbackMode);
    const csrfToken = authenticated ? String(payload?.csrfToken || '') : '';
    const status = String(
        payload?.status || (authenticated ? 'autenticado' : 'anonymous')
    ).trim();
    const currentAuth = getState().auth;
    const nextChallenge = normalizeChallenge(payload?.challenge);
    const challenge =
        nextChallenge ||
        (authenticated || mode !== 'openclaw_chatgpt'
            ? null
            : currentAuth.challenge);
    const operator = normalizeOperator(payload?.operator);
    const configured =
        payload?.configured !== false &&
        status !== 'legacy_auth_not_configured' &&
        status !== 'operator_auth_not_configured';
    const capabilities = normalizeCapabilities(
        payload?.capabilities,
        authenticated,
        getState().auth.capabilities
    );
    const authMethod = authenticated
        ? mode === 'openclaw_chatgpt'
            ? 'openclaw'
            : getState().auth.authMethod || 'session'
        : '';

    setApiCsrfToken(csrfToken);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated,
            csrfToken,
            requires2FA:
                !authenticated &&
                mode === 'legacy_password' &&
                status === 'two_factor_required',
            lastAuthAt: authenticated ? Date.now() : 0,
            authMethod,
            mode,
            status,
            configured,
            challenge,
            helperUrlOpened:
                authenticated || mode !== 'openclaw_chatgpt'
                    ? false
                    : currentAuth.helperUrlOpened === true,
            operator,
            capabilities,
            lastError: authenticated ? '' : String(payload?.error || ''),
        },
    }));

    return {
        authenticated,
        mode,
        status,
        challenge,
    };
}

export function isOperatorAuthMode(auth = getState().auth) {
    return (
        normalizeAuthMode(auth, getState().auth.mode || 'legacy_password') ===
        'openclaw_chatgpt'
    );
}

export async function checkAuthStatus() {
    try {
        const payload = await authRequest('status');
        const snapshot = applyAuthPayload(
            payload,
            getState().auth.mode || 'legacy_password'
        );
        return snapshot.authenticated;
    } catch (_error) {
        return false;
    }
}

export async function startOpenClawLogin() {
    const payload = await authRequest('start', {
        method: 'POST',
        body: {},
    });

    return applyAuthPayload(payload, 'openclaw_chatgpt');
}

export async function startOperatorAuth(options = {}) {
    const forceNew = options?.forceNew === true;
    const openHelper = options?.openHelper === true;

    const payload = await authRequest('start', {
        method: 'POST',
        body: forceNew ? { forceNew: true } : {},
    });
    applyAuthPayload(payload, 'openclaw_chatgpt');

    const helperUrl = String(getState().auth.challenge?.helperUrl || '').trim();
    const helperUrlOpened = openHelper ? openHelperWindow(helperUrl) : false;

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            helperUrlOpened,
        },
    }));

    return snapshotAuthState();
}

export async function pollOperatorAuthStatus(options = {}) {
    const onUpdate =
        typeof options?.onUpdate === 'function' ? options.onUpdate : null;
    const maxAttempts = Math.max(1, Number(options?.maxAttempts || 20) || 20);
    let attempts = 0;

    while (attempts < maxAttempts) {
        attempts += 1;
        await checkAuthStatus();
        const snapshot = snapshotAuthState();
        if (onUpdate) {
            onUpdate(snapshot);
        }

        if (
            snapshot.authenticated ||
            !isOperatorAuthMode(snapshot) ||
            String(snapshot.status || '') !== 'pending'
        ) {
            return snapshot;
        }

        await sleep(snapshot.challenge?.pollAfterMs || 1200);
    }

    return snapshotAuthState();
}

export async function loginWithPassword(password) {
    const safePassword = String(password || '').trim();
    if (!safePassword) {
        throw new Error('Contrasena requerida');
    }

    const payload = await authRequest('login', {
        method: 'POST',
        body: { password: safePassword },
    });

    const requires2FA = payload.twoFactorRequired === true;
    if (requires2FA) {
        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                requires2FA: true,
                authMethod: 'password',
                mode: 'legacy_password',
                status: 'two_factor_required',
                configured: true,
                challenge: null,
                helperUrlOpened: false,
                operator: null,
                capabilities: {
                    adminAgent: false,
                },
                lastError: '',
            },
        }));
        return { authenticated: false, requires2FA: true };
    }

    const csrfToken = String(payload.csrfToken || '');
    setApiCsrfToken(csrfToken);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated: true,
            csrfToken,
            requires2FA: false,
            lastAuthAt: Date.now(),
            authMethod: 'password',
            mode: 'legacy_password',
            status: 'authenticated',
            configured: true,
            challenge: null,
            helperUrlOpened: false,
            operator: null,
            capabilities: normalizeCapabilities(
                payload?.capabilities,
                true,
                state.auth.capabilities
            ),
            lastError: '',
        },
    }));

    return { authenticated: true, requires2FA: false };
}

export async function loginWith2FA(code) {
    const tokenCode = String(code || '').trim();
    if (!tokenCode) {
        throw new Error('Codigo 2FA requerido');
    }

    const payload = await authRequest('login-2fa', {
        method: 'POST',
        body: { code: tokenCode },
    });

    const csrfToken = String(payload.csrfToken || '');
    setApiCsrfToken(csrfToken);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated: true,
            csrfToken,
            requires2FA: false,
            lastAuthAt: Date.now(),
            authMethod: '2fa',
            mode: 'legacy_password',
            status: 'authenticated',
            configured: true,
            challenge: null,
            helperUrlOpened: false,
            operator: null,
            capabilities: normalizeCapabilities(
                payload?.capabilities,
                true,
                state.auth.capabilities
            ),
            lastError: '',
        },
    }));

    return { authenticated: true };
}

export async function logoutSession() {
    const previousMode = getState().auth.mode || 'legacy_password';
    let payload = null;
    try {
        payload = await authRequest('logout', { method: 'POST' });
    } catch (_error) {
        // no-op
    }
    const mode = normalizeAuthMode(payload, previousMode);
    setApiCsrfToken('');
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated: false,
            csrfToken: '',
            requires2FA: false,
            lastAuthAt: 0,
            authMethod: '',
            mode,
            status: 'anonymous',
            configured:
                payload?.configured !== false &&
                String(payload?.status || '') !==
                    'operator_auth_not_configured',
            challenge: null,
            helperUrlOpened: false,
            operator: null,
            capabilities: {
                adminAgent: false,
            },
            lastError: '',
        },
    }));
}
