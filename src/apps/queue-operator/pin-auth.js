import {
    apiRequest,
    authRequest,
    setApiCsrfToken,
} from '../admin-v3/shared/core/api-client.js';
import { getState, updateState } from '../admin-v3/shared/core/store.js';
import {
    checkAuthStatus as checkSharedAuthStatus,
    getReusableOpenClawRedirectUrl as getReusableOpenClawRedirectUrlFromOpenClaw,
    isOperatorAuthMode as isOpenClawOperatorMode,
    loginWith2FA as loginWith2FAFromOpenClaw,
    loginWithPassword as loginWithLegacyPassword,
    logoutSession as logoutOpenClawSession,
} from '../admin-v3/shared/modules/auth.js';

const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';
const LEGACY_OPERATOR_AUTH_MODE = 'openclaw_chatgpt';

const DEFAULT_FALLBACKS = Object.freeze({
    legacy_password: {
        enabled: false,
        configured: false,
        requires2FA: false,
        available: false,
        reason: 'operator_pin_only',
    },
});

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

function currentReturnTo() {
    if (typeof window === 'undefined' || !window.location) {
        return '/operador-turnos.html';
    }

    const path =
        String(window.location.pathname || '').trim() || '/operador-turnos.html';
    const search = String(window.location.search || '').trim();
    return `${path}${search}`;
}

function normalizeMode(mode, fallback = '') {
    const raw = String(mode || '')
        .trim()
        .toLowerCase();
    if (
        raw === CANONICAL_OPERATOR_AUTH_MODE ||
        raw === LEGACY_OPERATOR_AUTH_MODE
    ) {
        return CANONICAL_OPERATOR_AUTH_MODE;
    }
    if (raw === 'operator_pin') {
        return 'operator_pin';
    }
    if (raw === 'legacy_password') {
        return 'legacy_password';
    }
    return fallback;
}

function normalizeOperator(operator) {
    if (!operator || typeof operator !== 'object') {
        return null;
    }

    const clinicId = String(operator.clinicId || '').trim();
    if (clinicId) {
        return {
            clinicId,
            source:
                String(operator.source || 'operator_pin').trim() ||
                'operator_pin',
            authenticatedAt: String(operator.authenticatedAt || '').trim(),
            expiresAt: String(operator.expiresAt || '').trim(),
        };
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

function normalizePinMeta(meta) {
    return meta && typeof meta === 'object' ? meta : null;
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

function sleep(ms) {
    return new Promise((resolve) => {
        if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
            window.setTimeout(resolve, Math.max(0, Number(ms || 0)));
            return;
        }

        setTimeout(resolve, Math.max(0, Number(ms || 0)));
    });
}

function getPersistedOpenClawChallenge(auth) {
    return (
        normalizeChallenge(auth?.challenge) ||
        normalizeChallenge(auth?.openClawSnapshot?.challenge)
    );
}

function inferOpenClawTransport(payload = {}, currentAuth = getState().auth || {}) {
    const explicitTransport = normalizeTransport(payload?.transport, '');
    if (explicitTransport) {
        return explicitTransport;
    }

    const persistedChallenge = getPersistedOpenClawChallenge(currentAuth);
    const nextChallenge = normalizeChallenge(payload?.challenge) || persistedChallenge;
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
    const mode = normalizeMode(payload?.mode);
    const recommendedMode = normalizeMode(payload?.recommendedMode, mode);

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

function buildEmptyOpenClawSnapshot() {
    return {
        status: 'anonymous',
        challenge: null,
        lastError: '',
    };
}

function applyPinPayload(payload = {}) {
    const currentState = getState();
    const currentAuth = currentState.auth || {};
    const authenticated = payload?.authenticated === true;
    const csrfToken = authenticated ? String(payload?.csrfToken || '') : '';
    const operator = normalizeOperator(payload?.operator);
    const pinMeta = normalizePinMeta(payload?.turneroOperatorAccessMeta);
    const configured =
        payload?.configured === true || pinMeta?.configured === true;
    const status = String(
        payload?.status ||
            (authenticated
                ? 'authenticated'
                : configured
                  ? 'operator_pin_required'
                  : 'operator_pin_not_configured')
    ).trim();

    setApiCsrfToken(csrfToken);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated,
            csrfToken,
            requires2FA: false,
            lastAuthAt: authenticated ? Date.now() : 0,
            authMethod: authenticated ? 'operator_pin' : '',
            mode: 'operator_pin',
            recommendedMode: 'operator_pin',
            loginSurfaceMode: 'operator_pin',
            transport: '',
            status,
            configured,
            challenge: null,
            redirectUrl: '',
            attemptExpiresAt: '',
            helperUrlOpened: false,
            operator,
            fallbacks: DEFAULT_FALLBACKS,
            openClawSnapshot:
                state.auth?.openClawSnapshot &&
                typeof state.auth.openClawSnapshot === 'object'
                    ? state.auth.openClawSnapshot
                    : buildEmptyOpenClawSnapshot(),
            capabilities: {
                adminAgent: false,
            },
            lastError: authenticated ? '' : String(payload?.error || '').trim(),
            turneroOperatorAccessMeta: pinMeta,
        },
        data: {
            ...state.data,
            turneroOperatorAccessMeta: pinMeta,
        },
    }));

    return snapshotAuthState();
}

function applyOpenClawPayload(payload = {}) {
    const currentState = getState();
    const currentAuth = currentState.auth || {};
    const authenticated = payload?.authenticated === true;
    const mode = CANONICAL_OPERATOR_AUTH_MODE;
    const transport = inferOpenClawTransport(payload, currentAuth);
    const nextChallenge = normalizeChallenge(payload?.challenge);
    const challenge =
        authenticated || transport !== 'local_helper'
            ? null
            : nextChallenge || getPersistedOpenClawChallenge(currentAuth);
    const redirectUrl =
        authenticated || transport !== 'web_broker'
            ? ''
            : String(
                  payload?.redirectUrl ||
                      currentAuth?.redirectUrl ||
                      currentAuth?.openClawSnapshot?.redirectUrl ||
                      ''
              ).trim();
    const attemptExpiresAt = authenticated
        ? ''
        : String(
              payload?.expiresAt ||
                  challenge?.expiresAt ||
                  currentAuth?.attemptExpiresAt ||
                  currentAuth?.openClawSnapshot?.expiresAt ||
                  ''
          ).trim();
    const csrfToken = String(
        payload?.csrfToken || (authenticated ? '' : currentAuth.csrfToken || '')
    ).trim();
    const operator = normalizeOperator(payload?.operator);
    const status = String(
        payload?.status || (authenticated ? 'autenticado' : 'anonymous')
    ).trim();
    const lastError = authenticated ? '' : String(payload?.error || '').trim();

    setApiCsrfToken(csrfToken);

    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            authenticated,
            csrfToken,
            requires2FA: false,
            lastAuthAt: authenticated ? Date.now() : 0,
            authMethod: authenticated ? 'openclaw' : '',
            mode,
            recommendedMode: mode,
            loginSurfaceMode: mode,
            transport,
            status,
            configured:
                payload?.configured !== false &&
                status !== 'operator_auth_not_configured',
            challenge,
            redirectUrl,
            attemptExpiresAt,
            helperUrlOpened:
                authenticated || transport !== 'local_helper'
                    ? false
                    : currentAuth.helperUrlOpened === true,
            operator,
            fallbacks: DEFAULT_FALLBACKS,
            openClawSnapshot: {
                status,
                challenge,
                transport,
                redirectUrl,
                expiresAt: attemptExpiresAt,
                lastError,
            },
            capabilities: {
                adminAgent: false,
            },
            lastError,
        },
    }));

    return snapshotAuthState();
}

function payloadPrefersPin(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const mode = normalizeMode(payload.mode);
    const recommendedMode = normalizeMode(payload.recommendedMode, mode);
    const pinMeta = normalizePinMeta(payload.turneroOperatorAccessMeta);

    return (
        payload.authenticated === true ||
        payload.configured === true ||
        mode === 'operator_pin' ||
        recommendedMode === 'operator_pin' ||
        pinMeta !== null
    );
}

function hasExplicitPinSignal(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    return (
        Object.prototype.hasOwnProperty.call(payload, 'authenticated') ||
        Object.prototype.hasOwnProperty.call(payload, 'configured') ||
        Object.prototype.hasOwnProperty.call(payload, 'status') ||
        Object.prototype.hasOwnProperty.call(payload, 'mode') ||
        Object.prototype.hasOwnProperty.call(payload, 'recommendedMode') ||
        Object.prototype.hasOwnProperty.call(payload, 'csrfToken') ||
        Object.prototype.hasOwnProperty.call(payload, 'error') ||
        Object.prototype.hasOwnProperty.call(payload, 'operator') ||
        normalizePinMeta(payload.turneroOperatorAccessMeta) !== null
    );
}

function payloadPrefersOpenClaw(payload) {
    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const mode = normalizeMode(payload.mode);
    const recommendedMode = normalizeMode(payload.recommendedMode, mode);
    return (
        mode === CANONICAL_OPERATOR_AUTH_MODE ||
        recommendedMode === CANONICAL_OPERATOR_AUTH_MODE
    );
}

function payloadPrefersLegacy(payload) {
    if (!payload || typeof payload !== 'object' || payloadPrefersOpenClaw(payload)) {
        return false;
    }

    const rawMode = String(payload.mode || '')
        .trim()
        .toLowerCase();
    const rawRecommendedMode = String(payload.recommendedMode || '')
        .trim()
        .toLowerCase();

    return (
        rawMode === 'legacy_password' ||
        rawMode === 'local' ||
        rawRecommendedMode === 'legacy_password' ||
        rawRecommendedMode === 'local' ||
        payload.twoFactorEnabled === true ||
        payload.twoFactorRequired === true ||
        (payload.fallbacks && typeof payload.fallbacks === 'object') ||
        (payload.authenticated === true && rawMode !== 'operator_pin')
    );
}

function normalizeOpenClawStartPayload(payload = {}, fallbackAuth = getState().auth) {
    const inferredTransport = inferOpenClawTransport(payload, fallbackAuth);

    return {
        ...payload,
        transport: inferredTransport,
    };
}

async function readPinStatusPayload() {
    try {
        return await apiRequest('operator-session-status');
    } catch (_error) {
        return null;
    }
}

async function readOpenClawStatusPayload() {
    try {
        return await authRequest('status');
    } catch (_error) {
        return null;
    }
}

async function resolveAuthDriver() {
    const pinPayload = await readPinStatusPayload();
    if (payloadPrefersPin(pinPayload)) {
        return {
            kind: 'pin',
            pinPayload,
        };
    }

    const authPayload = await readOpenClawStatusPayload();
    if (payloadPrefersOpenClaw(authPayload)) {
        return {
            kind: 'openclaw',
            authPayload,
        };
    }

    if (payloadPrefersLegacy(authPayload)) {
        return {
            kind: 'legacy',
            authPayload,
        };
    }

    if (hasExplicitPinSignal(pinPayload)) {
        return {
            kind: 'pin',
            pinPayload,
        };
    }

    return {
        kind: 'none',
        pinPayload: null,
        authPayload,
    };
}

export function isOperatorAuthMode(auth = getState().auth) {
    return isOpenClawOperatorMode(auth);
}

export function getReusableOpenClawRedirectUrl(auth = getState().auth) {
    return getReusableOpenClawRedirectUrlFromOpenClaw(auth);
}

export async function checkAuthStatus() {
    const driver = await resolveAuthDriver();
    if (driver.kind === 'openclaw') {
        const snapshot = applyOpenClawPayload(driver.authPayload);
        return snapshot.authenticated;
    }

    if (driver.kind === 'pin') {
        const snapshot = applyPinPayload(driver.pinPayload);
        return snapshot.authenticated;
    }

    if (driver.kind === 'legacy') {
        await checkSharedAuthStatus();
        return snapshotAuthState().authenticated === true;
    }

    applyPinPayload({
        authenticated: false,
        configured: false,
        status: 'operator_pin_not_configured',
    });
    return false;
}

export async function loginWithPassword(pin) {
    const safePin = String(pin || '').trim();
    if (!safePin) {
        throw new Error('PIN requerido');
    }

    const auth = getState().auth || {};
    const pinMode =
        normalizeMode(auth?.mode) === 'operator_pin' ||
        normalizeMode(auth?.recommendedMode) === 'operator_pin' ||
        normalizeMode(auth?.loginSurfaceMode) === 'operator_pin' ||
        normalizePinMeta(auth?.turneroOperatorAccessMeta) !== null ||
        String(auth?.authMethod || '') === 'operator_pin';

    if (!pinMode) {
        return loginWithLegacyPassword(safePin);
    }

    const payload = await apiRequest('operator-pin-login', {
        method: 'POST',
        body: {
            pin: safePin,
        },
    });
    applyPinPayload(payload);
    return {
        authenticated: true,
        requires2FA: false,
    };
}

export async function loginWith2FA(code) {
    if (isOpenClawOperatorMode(getState().auth) || getState().auth?.requires2FA) {
        return loginWith2FAFromOpenClaw(code);
    }

    throw new Error('2FA no aplica al PIN operativo.');
}

export async function logoutSession() {
    const auth = getState().auth || {};
    const pinMode =
        normalizeMode(auth?.mode) === 'operator_pin' ||
        normalizeMode(auth?.recommendedMode) === 'operator_pin' ||
        normalizeMode(auth?.loginSurfaceMode) === 'operator_pin' ||
        normalizePinMeta(auth?.turneroOperatorAccessMeta) !== null ||
        String(auth?.authMethod || '') === 'operator_pin';

    if (!pinMode) {
        return logoutOpenClawSession();
    }

    try {
        const payload = await apiRequest('operator-pin-logout', {
            method: 'POST',
            body: {},
        });
        applyPinPayload(payload);
        return;
    } catch (_error) {
        setApiCsrfToken('');
        applyPinPayload({
            authenticated: false,
            configured: getState().auth?.configured === true,
            status: 'anonymous',
        });
    }
}

export async function pollOperatorAuthStatus(options = {}) {
    if (!isOpenClawOperatorMode(getState().auth)) {
        await checkAuthStatus();
        return snapshotAuthState();
    }

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
            !isOpenClawOperatorMode(snapshot) ||
            String(snapshot.status || '') !== 'pending' ||
            normalizeTransport(snapshot.transport, '') !== 'local_helper'
        ) {
            return snapshot;
        }

        await sleep(snapshot.challenge?.pollAfterMs || 1200);
    }

    return snapshotAuthState();
}

export async function startOperatorAuth(options = {}) {
    if (isOpenClawOperatorMode(getState().auth)) {
        const payload = await authRequest('start', {
            method: 'POST',
            body: {
                ...(options?.forceNew === true ? { forceNew: true } : {}),
                returnTo: currentReturnTo(),
            },
        });
        const normalizedPayload = normalizeOpenClawStartPayload(payload);
        applyOpenClawPayload(normalizedPayload);

        const helperUrl =
            normalizeTransport(normalizedPayload.transport, '') ===
            'local_helper'
                ? String(normalizedPayload.challenge?.helperUrl || '').trim()
                : '';
        const helperUrlOpened =
            options?.openHelper === true ? openHelperWindow(helperUrl) : false;

        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                helperUrlOpened,
            },
        }));

        return snapshotAuthState();
    }

    const driver = await resolveAuthDriver();
    if (driver.kind === 'openclaw') {
        const payload = await authRequest('start', {
            method: 'POST',
            body: {
                ...(options?.forceNew === true ? { forceNew: true } : {}),
                returnTo: currentReturnTo(),
            },
        });
        const normalizedPayload = normalizeOpenClawStartPayload(payload);
        applyOpenClawPayload(normalizedPayload);

        const helperUrl =
            normalizeTransport(normalizedPayload.transport, '') ===
            'local_helper'
                ? String(normalizedPayload.challenge?.helperUrl || '').trim()
                : '';
        const helperUrlOpened =
            options?.openHelper === true ? openHelperWindow(helperUrl) : false;

        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                helperUrlOpened,
            },
        }));

        return snapshotAuthState();
    }

    if (driver.kind === 'pin') {
        return applyPinPayload(driver.pinPayload);
    }

    if (driver.kind === 'legacy') {
        await checkSharedAuthStatus();
        return snapshotAuthState();
    }

    applyPinPayload({
        authenticated: false,
        configured: false,
        status: 'operator_pin_not_configured',
    });
    return snapshotAuthState();
}
