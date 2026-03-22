import { getState, updateState } from '../../shared/core/store.js';
import { createToast } from '../../shared/ui/render.js';
import {
    checkAuthStatus,
    getActiveLoginSurfaceMode,
    getReusableOpenClawRedirectUrl,
    getVisibleOpenClawState,
    loginWith2FA,
    loginWithPassword,
    startOpenClawLogin,
    useLegacyFallbackLoginSurface,
    usePrimaryLoginSurface,
} from '../../shared/modules/auth.js';
import {
    applyQueueRuntimeDefaults,
    renderQueueSection,
} from '../../shared/modules/queue.js';
import {
    focusLoginField,
    hideCommandPalette,
    resetLoginForm,
    setLogin2FAVisibility,
    setLoginFeedback,
    setLoginMode,
    setLoginSubmittingState,
    setOpenClawChallenge,
    showDashboardView,
} from '../../ui/frame.js';
import { refreshDataAndRender } from './rendering.js';

const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';

const OPENCLAW_TERMINAL_STATUSES = new Set([
    'anonymous',
    'operator_auth_not_configured',
    'openclaw_no_logueado',
    'email_no_permitido',
    'challenge_expirado',
    'helper_no_disponible',
    'identity_missing',
    'identity_unverified',
    'broker_claims_invalid',
    'transport_misconfigured',
]);

let openClawPollTimer = 0;
let openClawPolling = false;

function syncQueueRuntimeDefaultsAfterBoot() {
    applyQueueRuntimeDefaults();
    if (getState().ui.activeSection === 'queue') {
        renderQueueSection();
    }
}

function normalizeAuthStatus(status) {
    return String(status || 'anonymous')
        .trim()
        .toLowerCase();
}

function clearOpenClawPollTimer() {
    if (openClawPollTimer) {
        window.clearTimeout(openClawPollTimer);
        openClawPollTimer = 0;
    }
}

function openHelperWindow(helperUrl) {
    const url = String(helperUrl || '').trim();
    if (!url) {
        return false;
    }

    try {
        const popup = window.open(url, '_blank', 'noopener,noreferrer');
        return Boolean(popup);
    } catch (_error) {
        return false;
    }
}

function openWebBrokerFlow(redirectUrl) {
    const url = String(redirectUrl || '').trim();
    if (!url) {
        return false;
    }

    try {
        window.location.replace(url);
        return true;
    } catch (_error) {
        return false;
    }
}

function buildOpenClawFeedback(auth) {
    const status = normalizeAuthStatus(auth.status);
    const challenge = auth.challenge || null;
    const transport = String(auth.transport || '')
        .trim()
        .toLowerCase();
    const redirectUrl = String(auth.redirectUrl || '').trim();

    switch (status) {
        case 'pending':
            return {
                tone: 'warning',
                title:
                    transport === 'web_broker'
                        ? 'Acceso web pendiente'
                        : 'Codigo temporal activo',
                message:
                    transport === 'web_broker'
                        ? auth.lastError ||
                          'El intento web sigue activo. Retoma OpenClaw en esta misma pestana para terminar la autenticacion.'
                        : challenge?.manualCode
                          ? `Confirma el codigo ${challenge.manualCode} desde el helper local y deja esta pantalla abierta.`
                          : 'Esperando a que OpenClaw confirme la identidad del operador.',
            };
        case 'autenticado':
        case 'authenticated':
            return {
                tone: 'success',
                title: 'Acceso concedido',
                message: auth.operator?.email
                    ? `Sesion autorizada para ${auth.operator.email}. Cargando centro operativo.`
                    : 'Sesion autorizada por OpenClaw. Cargando centro operativo.',
            };
        case 'openclaw_no_logueado':
            return {
                tone: 'warning',
                title: 'Completa tu sesion en OpenClaw',
                message:
                    auth.lastError ||
                    'El helper local necesita una sesion activa de OpenClaw antes de continuar.',
            };
        case 'email_no_permitido':
            return {
                tone: 'danger',
                title: 'Esta cuenta no tiene permiso',
                message:
                    auth.lastError ||
                    'La identidad resuelta por OpenClaw no esta autorizada para operar este panel.',
            };
        case 'challenge_expirado':
            return {
                tone: 'warning',
                title: 'Codigo vencido',
                message:
                    auth.lastError ||
                    'El codigo ya expiro. Genera un nuevo challenge para continuar.',
            };
        case 'helper_no_disponible':
            return {
                tone: 'danger',
                title: 'No encontramos el helper local',
                message:
                    auth.lastError ||
                    'No se pudo contactar al helper local de OpenClaw en este equipo.',
            };
        case 'identity_missing':
            return {
                tone: 'danger',
                title: 'Identidad incompleta',
                message:
                    auth.lastError ||
                    'OpenClaw no devolvio una identidad utilizable para este panel.',
            };
        case 'identity_unverified':
            return {
                tone: 'danger',
                title: 'Email no verificado',
                message:
                    auth.lastError ||
                    'OpenClaw autentico la cuenta, pero no confirmo un email verificado para este panel.',
            };
        case 'broker_claims_invalid':
            return {
                tone: 'danger',
                title: 'Identidad no confiable',
                message:
                    auth.lastError ||
                    'No pudimos validar los claims firmados que devolvio OpenClaw para este acceso.',
            };
        case 'transport_misconfigured':
            return {
                tone: 'danger',
                title: 'Runtime de OpenClaw desalineado',
                message:
                    auth.lastError ||
                    'El runtime devolvio un estado OpenClaw sin transport valido.',
            };
        case 'operator_auth_not_configured':
            return {
                tone: 'danger',
                title: 'OpenClaw no configurado',
                message:
                    auth.lastError ||
                    'Este entorno aun no tiene configurado el acceso delegado por OpenClaw para el consultorio.',
            };
        default:
            return {
                tone: 'neutral',
                title:
                    transport === 'web_broker' && redirectUrl
                        ? 'Acceso web pendiente'
                        : 'Sesion local OpenClaw',
                message:
                    transport === 'web_broker' && redirectUrl
                        ? 'El intento web sigue activo. Retoma OpenClaw en esta misma pestana para terminar la autenticacion.'
                        : 'Genera un challenge para validar la identidad del operador desde este laptop.',
            };
    }
}

function buildLegacyFeedback(auth) {
    const status = normalizeAuthStatus(auth.status);
    const isContingency =
        String(auth.recommendedMode || '').trim() ===
        CANONICAL_OPERATOR_AUTH_MODE;

    if (auth.requires2FA) {
        return {
            tone: 'warning',
            title: isContingency
                ? '2FA de contingencia requerido'
                : 'Codigo 2FA requerido',
            message: isContingency
                ? 'La clave de contingencia fue validada. Ingresa ahora el codigo de seis digitos.'
                : 'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
        };
    }

    if (status === 'legacy_auth_not_configured') {
        return {
            tone: 'danger',
            title: 'Acceso no configurado',
            message:
                auth.lastError ||
                (isContingency
                    ? 'La contingencia por clave + 2FA no esta configurada en este entorno.'
                    : 'El acceso por clave no esta configurado en este entorno.'),
        };
    }

    return {
        tone: 'neutral',
        title: isContingency ? 'Contingencia web' : 'Acceso de respaldo',
        message: isContingency
            ? 'Usa esta ruta solo como contingencia desde cualquier computadora con clave + 2FA.'
            : 'Usa tu clave solo si necesitas entrar como respaldo al nucleo interno.',
    };
}

function syncLoginSurfaceFromState() {
    const auth = getState().auth;
    const mode = getActiveLoginSurfaceMode(auth);
    const recommendedMode =
        String(auth.recommendedMode || auth.mode || 'legacy_password').trim() ||
        'legacy_password';
    const fallbackAvailable =
        auth.fallbacks?.legacy_password?.available === true;
    const status = normalizeAuthStatus(auth.status);
    const openClawState =
        mode === CANONICAL_OPERATOR_AUTH_MODE
            ? getVisibleOpenClawState(auth)
            : null;

    setLoginMode(mode, {
        recommendedMode,
        fallbackAvailable,
        status: openClawState?.status || status,
        transport: openClawState?.transport || auth.transport,
    });

    if (mode === CANONICAL_OPERATOR_AUTH_MODE) {
        setOpenClawChallenge(openClawState.challenge, {
            status: normalizeAuthStatus(openClawState.status),
            error: openClawState.lastError,
            transport: openClawState.transport,
            redirectUrl: openClawState.redirectUrl,
        });
        setLoginSubmittingState(false, {
            mode,
            status: openClawState.status,
            transport: openClawState.transport,
        });
        setLoginFeedback(
            buildOpenClawFeedback({
                ...auth,
                status: openClawState.status,
                challenge: openClawState.challenge,
                transport: openClawState.transport,
                redirectUrl: openClawState.redirectUrl,
                lastError: openClawState.lastError,
            })
        );
        return;
    }

    setLogin2FAVisibility(Boolean(auth.requires2FA), {
        recommendedMode,
        fallbackAvailable,
    });
    setLoginSubmittingState(false, { mode, status });
    setLoginFeedback(buildLegacyFeedback(auth));
}

function scheduleOpenClawPoll(delayMs = 1200) {
    clearOpenClawPollTimer();
    openClawPollTimer = window.setTimeout(
        () => {
            void pollOpenClawStatus();
        },
        Math.max(600, Number(delayMs || 1200))
    );
}

async function finishAuthenticatedLogin(toastMessage = 'Sesion iniciada') {
    clearOpenClawPollTimer();
    showDashboardView();
    hideCommandPalette();
    setLogin2FAVisibility(false);
    resetLoginForm({ clearPassword: true });
    await refreshDataAndRender(false);
    syncQueueRuntimeDefaultsAfterBoot();
    createToast(toastMessage, 'success');
}

async function pollOpenClawStatus() {
    if (openClawPolling) {
        return;
    }

    openClawPolling = true;
    try {
        await checkAuthStatus();
    } finally {
        openClawPolling = false;
    }

    const auth = getState().auth;
    syncLoginSurfaceFromState();

    if (auth.authenticated) {
        await finishAuthenticatedLogin('Sesion iniciada con OpenClaw');
        return;
    }

    if (String(auth.mode || '') !== CANONICAL_OPERATOR_AUTH_MODE) {
        clearOpenClawPollTimer();
        return;
    }

    const status = normalizeAuthStatus(auth.status);
    if (
        status === 'pending' &&
        (auth.challenge ||
            (String(auth.transport || '')
                .trim()
                .toLowerCase() === 'web_broker' &&
                String(auth.redirectUrl || '').trim()))
    ) {
        scheduleOpenClawPoll(auth.challenge?.pollAfterMs || 1200);
        return;
    }

    if (OPENCLAW_TERMINAL_STATUSES.has(status)) {
        clearOpenClawPollTimer();
    }
}

async function handleOpenClawSubmit() {
    const currentAuth = getState().auth;
    const currentStatus = normalizeAuthStatus(currentAuth.status);
    const currentRedirectUrl = getReusableOpenClawRedirectUrl(currentAuth);
    if (
        String(currentAuth.transport || '')
            .trim()
            .toLowerCase() === 'web_broker' &&
        currentStatus === 'pending' &&
        currentRedirectUrl
    ) {
        openWebBrokerFlow(currentRedirectUrl);
        return;
    }

    clearOpenClawPollTimer();
    setLoginSubmittingState(true, {
        mode: CANONICAL_OPERATOR_AUTH_MODE,
        status: currentAuth.status,
        transport: currentAuth.transport,
    });
    setLoginFeedback({
        tone: 'neutral',
        title:
            String(currentAuth.transport || '')
                .trim()
                .toLowerCase() === 'web_broker'
                ? 'Preparando acceso web'
                : 'Preparando challenge',
        message:
            String(currentAuth.transport || '')
                .trim()
                .toLowerCase() === 'web_broker'
                ? 'Solicitando el acceso delegado y abriendo OpenClaw en esta misma pestana.'
                : 'Solicitando un codigo temporal al backend y abriendo el helper local.',
    });

    try {
        const result = await startOpenClawLogin();
        const auth = getState().auth;
        syncLoginSurfaceFromState();

        if (result.authenticated || auth.authenticated) {
            await finishAuthenticatedLogin('Sesion iniciada con OpenClaw');
            return;
        }

        const resultTransport = String(result.transport || '')
            .trim()
            .toLowerCase();

        if (resultTransport === 'web_broker') {
            if (result.redirectUrl) {
                createToast('Retomando OpenClaw en la misma pestana', 'info');
                openWebBrokerFlow(result.redirectUrl);
                return;
            }
        } else if (resultTransport === 'local_helper') {
            const helperOpened = openHelperWindow(result.challenge?.helperUrl);
            if (!helperOpened && result.challenge?.helperUrl) {
                createToast(
                    'Abre el helper local desde el enlace del challenge.',
                    'warning'
                );
            }
        }

        if (normalizeAuthStatus(result.status) === 'pending') {
            if (result.challenge) {
                scheduleOpenClawPoll(result.challenge.pollAfterMs || 1200);
                createToast('Challenge OpenClaw emitido', 'info');
            } else if (result.redirectUrl) {
                createToast(
                    'Acceso web de OpenClaw listo para retomar',
                    'info'
                );
            }
        }
    } catch (error) {
        updateState((state) => ({
            ...state,
            auth: {
                ...state.auth,
                lastError:
                    error instanceof Error
                        ? error.message
                        : 'No se pudo iniciar el flujo OpenClaw.',
            },
        }));
        syncLoginSurfaceFromState();
        createToast(
            error?.message || 'No se pudo iniciar el flujo OpenClaw',
            'error'
        );
    } finally {
        const auth = getState().auth;
        setLoginSubmittingState(false, {
            mode: auth.mode || CANONICAL_OPERATOR_AUTH_MODE,
            status: auth.status,
            transport: auth.transport,
        });
    }
}

export function primeLoginSurface() {
    if (!getState().auth.requires2FA) {
        resetLoginForm();
    }
    syncLoginSurfaceFromState();
}

export function resetTwoFactorStage() {
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            requires2FA: false,
            status: 'anonymous',
        },
    }));

    setLogin2FAVisibility(false, {
        recommendedMode: getState().auth.recommendedMode,
        fallbackAvailable:
            getState().auth.fallbacks?.legacy_password?.available === true,
    });
    resetLoginForm();
    setLoginFeedback({
        tone: 'neutral',
        title: 'Acceso de respaldo',
        message: 'Volviste al paso de clave. Puedes reintentar el acceso.',
    });
    focusLoginField('password');
}

export async function handleLoginSubmit(event) {
    event.preventDefault();

    const state = getState();
    if (getActiveLoginSurfaceMode(state.auth) === CANONICAL_OPERATOR_AUTH_MODE) {
        await handleOpenClawSubmit();
        return;
    }

    const passwordInput = document.getElementById('adminPassword');
    const codeInput = document.getElementById('admin2FACode');

    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';

    try {
        setLoginSubmittingState(true, {
            mode: 'legacy_password',
            status: state.auth.requires2FA
                ? 'two_factor_required'
                : 'anonymous',
        });
        setLoginFeedback({
            tone: state.auth.requires2FA ? 'warning' : 'neutral',
            title: state.auth.requires2FA
                ? 'Validando segundo factor'
                : 'Validando credenciales',
            message: state.auth.requires2FA
                ? 'Comprobando el codigo 2FA antes de abrir el panel.'
                : 'Comprobando clave y proteccion de sesion.',
        });

        if (state.auth.requires2FA) {
            await loginWith2FA(code);
        } else {
            const result = await loginWithPassword(password);
            if (result.requires2FA) {
                setLogin2FAVisibility(true, {
                    recommendedMode: getState().auth.recommendedMode,
                    fallbackAvailable:
                        getState().auth.fallbacks?.legacy_password
                            ?.available === true,
                });
                setLoginFeedback({
                    tone: 'warning',
                    title: 'Codigo 2FA requerido',
                    message:
                        'El backend valido la clave. Ingresa ahora el codigo de seis digitos.',
                });
                focusLoginField('2fa');
                return;
            }
        }

        setLoginFeedback({
            tone: 'success',
            title: 'Acceso concedido',
            message: 'Sesion autenticada. Cargando centro operativo.',
        });
        await finishAuthenticatedLogin('Sesion iniciada');
    } catch (error) {
        setLoginFeedback({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                error?.message ||
                'Verifica la clave o el codigo e intenta nuevamente.',
        });
        focusLoginField(getState().auth.requires2FA ? '2fa' : 'password');
        createToast(error?.message || 'No se pudo iniciar sesion', 'error');
    } finally {
        setLoginSubmittingState(false, {
            mode: 'legacy_password',
            status: getState().auth.requires2FA
                ? 'two_factor_required'
                : 'anonymous',
        });
    }
}

export async function bootAuthenticatedUi() {
    clearOpenClawPollTimer();
    showDashboardView();
    hideCommandPalette();
    await refreshDataAndRender(false);
    syncQueueRuntimeDefaultsAfterBoot();
}

export function resumeOpenClawPolling() {
    const auth = getState().auth;
    if (
        auth.authenticated ||
        String(auth.mode || '') !== CANONICAL_OPERATOR_AUTH_MODE ||
        normalizeAuthStatus(auth.status) !== 'pending' ||
        (!auth.challenge &&
            !(
                String(auth.transport || '')
                    .trim()
                    .toLowerCase() === 'web_broker' &&
                String(auth.redirectUrl || '').trim()
            ))
    ) {
        return;
    }

    scheduleOpenClawPoll(auth.challenge?.pollAfterMs || 1200);
}

export function stopOpenClawPolling() {
    clearOpenClawPollTimer();
}

export function showLegacyFallbackSurface() {
    clearOpenClawPollTimer();
    if (!useLegacyFallbackLoginSurface()) {
        return false;
    }

    resetLoginForm({ clearPassword: true });
    syncLoginSurfaceFromState();
    focusLoginField('password');
    return true;
}

export function showPrimaryLoginSurface() {
    const nextMode = usePrimaryLoginSurface();
    resetLoginForm({ clearPassword: true });
    syncLoginSurfaceFromState();

    if (nextMode === CANONICAL_OPERATOR_AUTH_MODE) {
        const openClawState = getVisibleOpenClawState(getState().auth);
        if (
            normalizeAuthStatus(openClawState.status) === 'pending' &&
            (openClawState.challenge ||
                (String(openClawState.transport || '')
                    .trim()
                    .toLowerCase() === 'web_broker' &&
                    String(openClawState.redirectUrl || '').trim()))
        ) {
            scheduleOpenClawPoll(openClawState.challenge?.pollAfterMs || 1200);
        }
    }

    return nextMode;
}
