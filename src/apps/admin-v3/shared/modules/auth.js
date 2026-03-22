import { authRequest, setApiCsrfToken } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';

const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';
const LEGACY_OPERATOR_AUTH_MODE = 'openclaw_chatgpt';

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
    if (
        raw === CANONICAL_OPERATOR_AUTH_MODE ||
        raw === LEGACY_OPERATOR_AUTH_MODE
    ) {
        return CANONICAL_OPERATOR_AUTH_MODE;
    }
    if (raw === 'legacy_password') {
        return 'legacy_password';
    }
    return fallback;
}

function normalizeRecommendedMode(payload, fallback = 'legacy_password') {
    return normalizeAuthMode(
        {
            mode: payload?.recommendedMode,
        },
        fallback
    );
}

const DEFAULT_LEGACY_FALLBACK = Object.freeze({
    enabled: false,
    configured: false,
    requires2FA: true,
    available: false,
    reason: 'fallback_disabled',
});

function normalizeFallbacks(fallbacks, previousFallbacks = null) {
    const previousLegacy =
        previousFallbacks &&
        previousFallbacks.legacy_password &&
        typeof previousFallbacks.legacy_password === 'object'
            ? previousFallbacks.legacy_password
            : DEFAULT_LEGACY_FALLBACK;
    const nextLegacySource =
        fallbacks &&
        fallbacks.legacy_password &&
        typeof fallbacks.legacy_password === 'object'
            ? fallbacks.legacy_password
            : {};

    const legacy = {
        ...DEFAULT_LEGACY_FALLBACK,
        ...previousLegacy,
        ...nextLegacySource,
    };

    legacy.enabled = legacy.enabled === true;
    legacy.configured = legacy.configured === true;
    legacy.requires2FA = legacy.requires2FA !== false;
    legacy.available = legacy.available === true;
    legacy.reason = String(
        legacy.reason ||
            (legacy.available ? 'fallback_available' : 'fallback_disabled')
    ).trim();

    return {
        legacy_password: legacy,
    };
}

function hasLegacyFallbackAvailable(auth = getState().auth) {
    return auth?.fallbacks?.legacy_password?.available === true;
}

function normalizeTransport(value, fallback = '') {
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (raw === 'web_broker') {
        return 'web_broker';
    }
    if (raw === 'local_helper') {
        return 'local_helper';
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

function buildOpenClawSnapshot(
    status,
    challenge,
    lastError,
    transport = '',
    redirectUrl = '',
    expiresAt = ''
) {
    return {
        status: String(status || 'anonymous').trim() || 'anonymous',
        challenge: normalizeChallenge(challenge),
        transport: normalizeTransport(transport),
        redirectUrl: String(redirectUrl || '').trim(),
        expiresAt: String(expiresAt || '').trim(),
        lastError: String(lastError || '').trim(),
    };
}

function getPersistedOpenClawChallenge(auth = getState().auth) {
    return (
        normalizeChallenge(auth?.challenge) ||
        normalizeChallenge(auth?.openClawSnapshot?.challenge)
    );
}

function inferOpenClawTransport(payload = {}, currentAuth = getState().auth) {
    const explicitTransport = normalizeTransport(payload?.transport, '');
    const status = String(payload?.status || '')
        .trim()
        .toLowerCase();
    if (explicitTransport) {
        return explicitTransport;
    }

    if (status === 'transport_misconfigured') {
        return '';
    }

    const persistedChallenge = getPersistedOpenClawChallenge(currentAuth);
    const nextChallenge =
        normalizeChallenge(payload?.challenge) || persistedChallenge;
    const redirectUrl = String(
        payload?.redirectUrl ||
            currentAuth?.redirectUrl ||
            currentAuth?.openClawSnapshot?.redirectUrl ||
            ''
    ).trim();
    const previousTransport = normalizeTransport(
        currentAuth?.transport,
        normalizeTransport(currentAuth?.openClawSnapshot?.transport, '')
    );
    const mode = normalizeAuthMode(
        payload,
        previousTransport || 'legacy_password'
    );
    const recommendedMode = normalizeRecommendedMode(payload, mode);

    if (redirectUrl) {
        return 'web_broker';
    }

    if (nextChallenge) {
        return 'local_helper';
    }

    if (
        mode === CANONICAL_OPERATOR_AUTH_MODE ||
        recommendedMode === CANONICAL_OPERATOR_AUTH_MODE
    ) {
        return previousTransport || 'local_helper';
    }

    return previousTransport;
}

export function getVisibleOpenClawState(auth = getState().auth) {
    if (
        normalizeAuthMode(auth, auth?.recommendedMode || 'legacy_password') ===
        CANONICAL_OPERATOR_AUTH_MODE
    ) {
        return buildOpenClawSnapshot(
            auth.status,
            auth.challenge,
            auth.lastError,
            auth.transport,
            auth.redirectUrl,
            auth.attemptExpiresAt
        );
    }

    return buildOpenClawSnapshot(
        auth?.openClawSnapshot?.status,
        auth?.openClawSnapshot?.challenge,
        auth?.openClawSnapshot?.lastError,
        auth?.openClawSnapshot?.transport,
        auth?.openClawSnapshot?.redirectUrl,
        auth?.openClawSnapshot?.expiresAt
    );
}

function resolveLoginSurfaceMode({
    authenticated,
    requires2FA,
    mode,
    recommendedMode,
    fallbackAvailable,
    preferLegacySurface,
}) {
    if (authenticated) {
        return mode;
    }

    if (requires2FA) {
        return 'legacy_password';
    }

    if (recommendedMode === CANONICAL_OPERATOR_AUTH_MODE) {
        if (fallbackAvailable && preferLegacySurface) {
            return 'legacy_password';
        }

        return CANONICAL_OPERATOR_AUTH_MODE;
    }

    return 'legacy_password';
}

export function getActiveLoginSurfaceMode(auth = getState().auth) {
    const recommendedMode = normalizeAuthMode(
        {
            mode: auth?.recommendedMode,
        },
        auth?.mode || 'legacy_password'
    );
    const mode = normalizeAuthMode(auth, recommendedMode);
    const currentSurface = normalizeAuthMode(
        {
            mode: auth?.loginSurfaceMode,
        },
        recommendedMode
    );

    return resolveLoginSurfaceMode({
        authenticated: auth?.authenticated === true,
        requires2FA: auth?.requires2FA === true,
        mode,
        recommendedMode,
        fallbackAvailable: hasLegacyFallbackAvailable(auth),
        preferLegacySurface:
            currentSurface === 'legacy_password' &&
            normalizeAuthMode(
                {
                    mode: auth?.recommendedMode,
                },
                'legacy_password'
            ) === CANONICAL_OPERATOR_AUTH_MODE,
    });
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
    const recommendedMode = normalizeRecommendedMode(payload, mode);
    const currentAuth = getState().auth;
    const transport =
        mode === CANONICAL_OPERATOR_AUTH_MODE
            ? inferOpenClawTransport(payload, currentAuth)
            : '';
    const csrfToken = authenticated ? String(payload?.csrfToken || '') : '';
    const status = String(
        payload?.status || (authenticated ? 'autenticado' : 'anonymous')
    ).trim();
    const fallbackPayload = normalizeFallbacks(
        payload?.fallbacks,
        currentAuth.fallbacks
    );
    const nextChallenge = normalizeChallenge(payload?.challenge);
    const challenge =
        authenticated ||
        mode !== CANONICAL_OPERATOR_AUTH_MODE ||
        transport !== 'local_helper'
            ? null
            : nextChallenge || getPersistedOpenClawChallenge(currentAuth);
    const redirectUrl =
        authenticated ||
        mode !== CANONICAL_OPERATOR_AUTH_MODE ||
        transport !== 'web_broker'
            ? ''
            : String(
                  payload?.redirectUrl ||
                      currentAuth?.redirectUrl ||
                      currentAuth?.openClawSnapshot?.redirectUrl ||
                      ''
              ).trim();
    const attemptExpiresAt =
        authenticated || mode !== CANONICAL_OPERATOR_AUTH_MODE
            ? ''
            : String(
                  payload?.expiresAt ||
                      challenge?.expiresAt ||
                      currentAuth?.attemptExpiresAt ||
                      currentAuth?.openClawSnapshot?.expiresAt ||
                      ''
              ).trim();
    const payloadError = authenticated
        ? ''
        : String(payload?.error || '').trim();
    const openClawSnapshot =
        mode === CANONICAL_OPERATOR_AUTH_MODE
            ? buildOpenClawSnapshot(
                  status,
                  challenge,
                  payloadError,
                  transport,
                  redirectUrl,
                  attemptExpiresAt
              )
            : buildOpenClawSnapshot(
                  currentAuth.openClawSnapshot?.status,
                  currentAuth.openClawSnapshot?.challenge,
                  currentAuth.openClawSnapshot?.lastError,
                  currentAuth.openClawSnapshot?.transport,
                  currentAuth.openClawSnapshot?.redirectUrl,
                  currentAuth.openClawSnapshot?.expiresAt
              );
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
        ? mode === CANONICAL_OPERATOR_AUTH_MODE
            ? 'openclaw'
            : getState().auth.authMethod || 'session'
        : '';
    const requires2FA =
        !authenticated &&
        mode === 'legacy_password' &&
        status === 'two_factor_required';
    const currentSurface = normalizeAuthMode(
        {
            mode: currentAuth.loginSurfaceMode,
        },
        recommendedMode
    );
    const loginSurfaceMode = resolveLoginSurfaceMode({
        authenticated,
        requires2FA,
        mode,
        recommendedMode,
        fallbackAvailable: fallbackPayload.legacy_password.available === true,
        preferLegacySurface:
            currentSurface === 'legacy_password' &&
            normalizeAuthMode(
                {
                    mode: currentAuth.recommendedMode,
                },
                'legacy_password'
            ) === CANONICAL_OPERATOR_AUTH_MODE,
    });

    setApiCsrfToken(csrfToken);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated,
            csrfToken,
            requires2FA,
            lastAuthAt: authenticated ? Date.now() : 0,
            authMethod,
            mode,
            recommendedMode,
            loginSurfaceMode,
            transport,
            status,
            configured,
            challenge,
            redirectUrl,
            attemptExpiresAt,
            helperUrlOpened:
                authenticated ||
                mode !== CANONICAL_OPERATOR_AUTH_MODE ||
                transport !== 'local_helper'
                    ? false
                    : currentAuth.helperUrlOpened === true,
            operator,
            fallbacks: fallbackPayload,
            openClawSnapshot,
            capabilities,
            lastError: payloadError,
        },
    }));

    return {
        authenticated,
        mode,
        transport,
        status,
        challenge,
        redirectUrl,
        attemptExpiresAt,
    };
}

export function isOperatorAuthMode(auth = getState().auth) {
    return (
        normalizeAuthMode(auth, getState().auth.mode || 'legacy_password') ===
        CANONICAL_OPERATOR_AUTH_MODE
    );
}

export function getReusableOpenClawRedirectUrl(auth = getState().auth) {
    if (
        normalizeTransport(auth?.transport, '') === 'web_broker' &&
        String(auth?.redirectUrl || '').trim()
    ) {
        return String(auth.redirectUrl).trim();
    }

    if (
        normalizeTransport(auth?.openClawSnapshot?.transport, '') ===
        'web_broker'
    ) {
        return String(auth?.openClawSnapshot?.redirectUrl || '').trim();
    }

    return '';
}

export function useLegacyFallbackLoginSurface() {
    if (!hasLegacyFallbackAvailable()) {
        return false;
    }

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            loginSurfaceMode: 'legacy_password',
            requires2FA: false,
        },
    }));

    return true;
}

export function usePrimaryLoginSurface() {
    const auth = getState().auth;
    const recommendedMode = normalizeAuthMode(
        {
            mode: auth.recommendedMode,
        },
        auth.mode || 'legacy_password'
    );

    if (recommendedMode !== CANONICAL_OPERATOR_AUTH_MODE) {
        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                loginSurfaceMode: 'legacy_password',
                requires2FA: false,
            },
        }));
        return recommendedMode;
    }

    const snapshot = getVisibleOpenClawState(auth);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            loginSurfaceMode: CANONICAL_OPERATOR_AUTH_MODE,
            requires2FA: false,
            status: snapshot.status,
            challenge: snapshot.challenge,
            transport: snapshot.transport,
            redirectUrl: snapshot.redirectUrl,
            attemptExpiresAt: snapshot.expiresAt,
            lastError: snapshot.lastError,
        },
    }));

    return recommendedMode;
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

    return applyAuthPayload(payload, CANONICAL_OPERATOR_AUTH_MODE);
}

export async function startOperatorAuth(options = {}) {
    const forceNew = options?.forceNew === true;
    const openHelper = options?.openHelper === true;

    const payload = await authRequest('start', {
        method: 'POST',
        body: forceNew ? { forceNew: true } : {},
    });
    applyAuthPayload(payload, CANONICAL_OPERATOR_AUTH_MODE);

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
    const currentAuth = getState().auth;
    const recommendedMode = normalizeRecommendedMode(
        payload,
        currentAuth.recommendedMode || currentAuth.mode || 'legacy_password'
    );
    const fallbacks = normalizeFallbacks(
        payload?.fallbacks,
        currentAuth.fallbacks
    );
    if (requires2FA) {
        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                requires2FA: true,
                authMethod: 'password',
                mode: 'legacy_password',
                recommendedMode,
                loginSurfaceMode: 'legacy_password',
                transport: '',
                status: 'two_factor_required',
                configured: payload?.configured !== false,
                challenge: null,
                redirectUrl: '',
                attemptExpiresAt: '',
                helperUrlOpened: false,
                operator: null,
                fallbacks,
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
            recommendedMode,
            loginSurfaceMode: 'legacy_password',
            transport: '',
            status: 'authenticated',
            configured: payload?.configured !== false,
            challenge: null,
            redirectUrl: '',
            attemptExpiresAt: '',
            helperUrlOpened: false,
            operator: null,
            fallbacks,
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
    const currentAuth = getState().auth;
    const recommendedMode = normalizeRecommendedMode(
        payload,
        currentAuth.recommendedMode || currentAuth.mode || 'legacy_password'
    );
    const fallbacks = normalizeFallbacks(
        payload?.fallbacks,
        currentAuth.fallbacks
    );

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
            recommendedMode,
            loginSurfaceMode: 'legacy_password',
            transport: '',
            status: 'authenticated',
            configured: payload?.configured !== false,
            challenge: null,
            redirectUrl: '',
            attemptExpiresAt: '',
            helperUrlOpened: false,
            operator: null,
            fallbacks,
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
    if (payload) {
        applyAuthPayload(payload, previousMode);
        const primarySurface = normalizeRecommendedMode(payload, previousMode);
        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                requires2FA: false,
                loginSurfaceMode: primarySurface,
            },
        }));
        return;
    }

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
            mode: normalizeAuthMode(
                {
                    mode: state.auth.recommendedMode,
                },
                previousMode
            ),
            loginSurfaceMode: normalizeAuthMode(
                {
                    mode: state.auth.recommendedMode,
                },
                previousMode
            ),
            transport: '',
            status: 'anonymous',
            configured: false,
            challenge: null,
            redirectUrl: '',
            attemptExpiresAt: '',
            helperUrlOpened: false,
            operator: null,
            capabilities: {
                adminAgent: false,
            },
            lastError: '',
        },
    }));
}
