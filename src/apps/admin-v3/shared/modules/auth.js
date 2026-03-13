import { authRequest, setApiCsrfToken } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';

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

function applyAuthPayload(payload, fallbackMode = 'legacy_password') {
    const authenticated = payload?.authenticated === true;
    const mode = normalizeAuthMode(payload, fallbackMode);
    const csrfToken = authenticated ? String(payload?.csrfToken || '') : '';
    const status = String(
        payload?.status || (authenticated ? 'autenticado' : 'anonymous')
    ).trim();
    const challenge = normalizeChallenge(payload?.challenge);
    const operator = normalizeOperator(payload?.operator);
    const configured =
        payload?.configured !== false &&
        status !== 'legacy_auth_not_configured' &&
        status !== 'operator_auth_not_configured';
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
            operator,
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

export async function checkAuthStatus() {
    try {
        const payload = await authRequest('status');
        return applyAuthPayload(
            payload,
            getState().auth.mode || 'legacy_password'
        ).authenticated;
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
            operator: null,
            capabilities: {
                adminAgent: false,
            },
            lastError: '',
        },
    }));
}
