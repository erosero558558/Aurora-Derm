import {
    authRequest,
    authRequestRaw,
    setApiCsrfToken,
} from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';

const LEGACY_AUTH_MODE = 'legacy_password';
const OPERATOR_AUTH_MODE = 'openclaw_chatgpt';
const PENDING_OPERATOR_STATUS = 'pending';
const TERMINAL_OPERATOR_STATUSES = new Set([
    'challenge_expirado',
    'email_no_permitido',
    'helper_no_disponible',
    'openclaw_no_logueado',
    'operator_auth_not_configured',
]);

let operatorAuthPollToken = 0;

function getCurrentAuthState() {
    const state = getState();
    return state && state.auth && typeof state.auth === 'object'
        ? state.auth
        : {};
}

function normalizeMode(rawMode) {
    return String(rawMode || '').trim().toLowerCase() === OPERATOR_AUTH_MODE
        ? OPERATOR_AUTH_MODE
        : LEGACY_AUTH_MODE;
}

function normalizeChallenge(rawChallenge, fallbackChallenge = null) {
    const source =
        rawChallenge && typeof rawChallenge === 'object'
            ? rawChallenge
            : fallbackChallenge && typeof fallbackChallenge === 'object'
              ? fallbackChallenge
              : null;

    if (!source) {
        return null;
    }

    const challengeId = String(source.challengeId || '').trim();
    const helperUrl = String(source.helperUrl || '').trim();
    const manualCode = String(source.manualCode || '').trim();
    const expiresAt = String(source.expiresAt || '').trim();
    const status = String(source.status || '').trim();
    const pollAfterMs = Number(source.pollAfterMs || 0);

    if (
        challengeId === '' &&
        helperUrl === '' &&
        manualCode === '' &&
        expiresAt === '' &&
        status === ''
    ) {
        return null;
    }

    return {
        challengeId,
        helperUrl,
        manualCode,
        expiresAt,
        status: status || PENDING_OPERATOR_STATUS,
        pollAfterMs:
            Number.isFinite(pollAfterMs) && pollAfterMs > 0 ? pollAfterMs : 1200,
    };
}

function resolveAuthenticatedMethod(mode, payload) {
    if (mode === OPERATOR_AUTH_MODE) {
        return 'operator_auth';
    }

    if (
        payload &&
        payload.operator &&
        String(payload.operator.source || '').trim() === OPERATOR_AUTH_MODE
    ) {
        return 'operator_auth';
    }

    return 'session';
}

function buildAuthSnapshot(payload = {}, responseStatus = 200, overrides = {}) {
    const current = getCurrentAuthState();
    const mode = normalizeMode(
        overrides.mode || payload.mode || current.mode || LEGACY_AUTH_MODE
    );
    const authenticated = payload.authenticated === true;
    const status = String(
        payload.status ||
            (authenticated ? 'autenticado' : current.status || 'anonymous')
    ).trim();
    const challenge = normalizeChallenge(
        payload.challenge,
        mode === OPERATOR_AUTH_MODE ? current.challenge : null
    );
    const helperUrlOpened = Boolean(
        overrides.helperUrlOpened ?? current.helperUrlOpened
    );
    const lastAuthAt = authenticated
        ? current.authenticated
            ? Number(current.lastAuthAt || Date.now())
            : Date.now()
        : 0;
    const requires2FA =
        mode === LEGACY_AUTH_MODE
            ? payload.twoFactorRequired === true ||
              (Boolean(current.requires2FA) &&
                  !authenticated &&
                  status !== 'anonymous')
            : false;

    return {
        authenticated,
        csrfToken: authenticated ? String(payload.csrfToken || '') : '',
        requires2FA,
        lastAuthAt,
        authMethod: authenticated
            ? resolveAuthenticatedMethod(mode, payload)
            : requires2FA
              ? 'password'
              : '',
        mode,
        status:
            status ||
            (authenticated ? 'autenticado' : mode === OPERATOR_AUTH_MODE
                ? 'anonymous'
                : 'anonymous'),
        challenge: authenticated ? null : challenge,
        error: authenticated ? '' : String(payload.error || '').trim(),
        helperUrlOpened: authenticated ? false : helperUrlOpened,
        responseStatus: Number(responseStatus || 0),
    };
}

function applyAuthSnapshot(snapshot) {
    const normalized = {
        authenticated: snapshot.authenticated === true,
        csrfToken: String(snapshot.csrfToken || ''),
        requires2FA: snapshot.requires2FA === true,
        lastAuthAt: Number(snapshot.lastAuthAt || 0),
        authMethod: String(snapshot.authMethod || ''),
        mode: normalizeMode(snapshot.mode),
        status: String(snapshot.status || 'anonymous'),
        challenge: normalizeChallenge(snapshot.challenge, null),
        error: String(snapshot.error || '').trim(),
        helperUrlOpened: snapshot.helperUrlOpened === true,
    };

    setApiCsrfToken(normalized.csrfToken);
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            ...normalized,
        },
    }));

    return getCurrentAuthState();
}

function openHelperWindow(helperUrl) {
    const url = String(helperUrl || '').trim();
    if (
        url === '' ||
        typeof window !== 'object' ||
        window === null ||
        typeof window.open !== 'function'
    ) {
        return false;
    }

    try {
        const opened = window.open(url, '_blank', 'noopener,noreferrer');
        if (opened && typeof opened.focus === 'function') {
            opened.focus();
        }
        return Boolean(opened);
    } catch (_error) {
        return false;
    }
}

function delay(ms) {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

export function getAuthSnapshot() {
    return getCurrentAuthState();
}

export function isOperatorAuthMode(snapshot = getCurrentAuthState()) {
    return normalizeMode(snapshot && snapshot.mode) === OPERATOR_AUTH_MODE;
}

export function stopOperatorAuthPolling() {
    operatorAuthPollToken += 1;
}

export async function checkAuthStatus() {
    const result = await authRequestRaw('status');
    return applyAuthSnapshot(buildAuthSnapshot(result.payload, result.status));
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
        applyAuthSnapshot({
            ...getCurrentAuthState(),
            authenticated: false,
            csrfToken: '',
            requires2FA: true,
            lastAuthAt: 0,
            authMethod: 'password',
            mode: LEGACY_AUTH_MODE,
            status: 'requires_2fa',
            challenge: null,
            error: '',
            helperUrlOpened: false,
        });
        return { authenticated: false, requires2FA: true };
    }

    const csrfToken = String(payload.csrfToken || '');
    applyAuthSnapshot({
        authenticated: true,
        csrfToken,
        requires2FA: false,
        lastAuthAt: Date.now(),
        authMethod: 'password',
        mode: LEGACY_AUTH_MODE,
        status: 'autenticado',
        challenge: null,
        error: '',
        helperUrlOpened: false,
    });

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
    applyAuthSnapshot({
        authenticated: true,
        csrfToken,
        requires2FA: false,
        lastAuthAt: Date.now(),
        authMethod: '2fa',
        mode: LEGACY_AUTH_MODE,
        status: 'autenticado',
        challenge: null,
        error: '',
        helperUrlOpened: false,
    });

    return { authenticated: true };
}

export async function startOperatorAuth(options = {}) {
    const { forceNew = false, openHelper = true } = options;
    const current = getCurrentAuthState();

    stopOperatorAuthPolling();

    if (
        !forceNew &&
        isOperatorAuthMode(current) &&
        String(current.status || '') === PENDING_OPERATOR_STATUS &&
        current.challenge &&
        String(current.challenge.helperUrl || '').trim() !== ''
    ) {
        const helperUrlOpened = openHelper
            ? openHelperWindow(current.challenge.helperUrl) ||
              current.helperUrlOpened === true
            : current.helperUrlOpened === true;
        return applyAuthSnapshot({
            ...current,
            error: '',
            helperUrlOpened,
        });
    }

    const result = await authRequestRaw('start', {
        method: 'POST',
        body: {},
    });
    const helperUrl =
        result &&
        result.payload &&
        result.payload.challenge &&
        result.payload.challenge.helperUrl
            ? result.payload.challenge.helperUrl
            : '';
    const helperUrlOpened =
        openHelper && helperUrl ? openHelperWindow(helperUrl) : false;

    return applyAuthSnapshot(
        buildAuthSnapshot(result.payload, result.status, {
            mode: OPERATOR_AUTH_MODE,
            helperUrlOpened,
        })
    );
}

export async function pollOperatorAuthStatus(options = {}) {
    const { onUpdate = null, timeoutMs = 300000 } = options;
    const pollToken = ++operatorAuthPollToken;
    const startedAt = Date.now();

    while (pollToken === operatorAuthPollToken) {
        let snapshot;
        try {
            snapshot = await checkAuthStatus();
        } catch (error) {
            const current = getCurrentAuthState();
            if (!isOperatorAuthMode(current)) {
                throw error;
            }
            snapshot = applyAuthSnapshot({
                ...current,
                error: String(error?.message || 'No se pudo consultar el estado'),
            });
        }

        if (typeof onUpdate === 'function') {
            onUpdate(snapshot);
        }

        if (!isOperatorAuthMode(snapshot) || snapshot.authenticated) {
            return snapshot;
        }

        if (
            String(snapshot.status || '') !== PENDING_OPERATOR_STATUS ||
            TERMINAL_OPERATOR_STATUSES.has(String(snapshot.status || ''))
        ) {
            return snapshot;
        }

        if (Date.now() - startedAt >= timeoutMs) {
            return snapshot;
        }

        const waitMs = Math.max(
            500,
            Number(snapshot.challenge && snapshot.challenge.pollAfterMs) || 1200
        );
        await delay(waitMs);
    }

    return getCurrentAuthState();
}

export async function logoutSession() {
    const current = getCurrentAuthState();
    stopOperatorAuthPolling();

    try {
        await authRequest('logout', { method: 'POST' });
    } catch (_error) {
        // no-op
    }

    applyAuthSnapshot({
        authenticated: false,
        csrfToken: '',
        requires2FA: false,
        lastAuthAt: 0,
        authMethod: '',
        mode: isOperatorAuthMode(current) ? OPERATOR_AUTH_MODE : LEGACY_AUTH_MODE,
        status: 'anonymous',
        challenge: null,
        error: '',
        helperUrlOpened: false,
    });
}
