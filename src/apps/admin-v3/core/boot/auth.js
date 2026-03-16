import { getState, updateState } from '../../shared/core/store.js';
import { createToast } from '../../shared/ui/render.js';
import {
    checkAuthStatus,
    getReusableOpenClawRedirectUrl,
    getActiveLoginSurfaceMode,
    getVisibleOpenClawState,
    loginWith2FA,
    loginWithPassword,
    startOpenClawLogin,
    useLegacyFallbackLoginSurface,
    usePrimaryLoginSurface,
} from '../../shared/modules/auth.js';
import { syncQueueAutoRefresh } from '../../shared/modules/queue.js';
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

const OPENCLAW_TERMINAL_STATUSES = new Set([
    'anonymous',
    'operator_auth_not_configured',
    'transport_misconfigured',
    'openclaw_no_logueado',
    'email_no_permitido',
    'challenge_expirado',
    'helper_no_disponible',
    'cancelled',
    'invalid_state',
    'broker_unavailable',
    'code_exchange_failed',
    'identity_missing',
    'identity_unverified',
    'broker_claims_invalid',
]);

let openClawPollTimer = 0;
let openClawPolling = false;

function normalizeAuthStatus(status) {
    return String(status || 'anonymous')
        .trim()
        .toLowerCase();
}

function normalizeOpenClawTransport(transport) {
    const normalized = String(transport || '')
        .trim()
        .toLowerCase();
    if (normalized === 'web_broker' || normalized === 'local_helper') {
        return normalized;
    }
    return '';
}

function getFailClosedOpenClawState(auth = getState().auth) {
    const openClawState = getVisibleOpenClawState(auth);
    const recommendedMode = String(
        auth?.recommendedMode || auth?.mode || 'legacy_password'
    )
        .trim()
        .toLowerCase();

    if (recommendedMode !== 'openclaw_chatgpt' || auth?.authenticated) {
        return openClawState;
    }

    const authTransport = normalizeOpenClawTransport(auth?.transport);
    const visibleTransport = normalizeOpenClawTransport(openClawState.transport);
    const authStatus = normalizeAuthStatus(auth?.status);
    const visibleStatus = normalizeAuthStatus(openClawState.status);
    const lastError = String(
        auth?.lastError || openClawState.lastError || ''
    ).trim();

    const transportDrift =
        visibleTransport === '' &&
        (visibleStatus === 'transport_misconfigured' ||
            authStatus === 'transport_misconfigured' ||
            authTransport !== '' ||
            lastError !== '');

    if (!transportDrift) {
        return openClawState;
    }

    return {
        ...openClawState,
        status: 'transport_misconfigured',
        challenge: null,
        transport: '',
        redirectUrl: '',
        expiresAt: '',
        lastError:
            lastError ||
            'El backend respondio sin un transport valido para OpenClaw. Bloqueamos el helper local para evitar abrir localhost por error.',
    };
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

function buildOpenClawFeedback(auth) {
    const status = normalizeAuthStatus(auth.status);
    const challenge = auth.challenge || null;
    const transport =
        String(auth.transport || challenge?.transport || '')
            .trim()
            .toLowerCase();

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
                        ? 'Su intento web sigue activo. Puede retomarlo desde esta misma pantalla sin usar helper local ni codigo manual.'
                        : challenge?.manualCode
                          ? `Confirme el codigo ${challenge.manualCode} en el helper local y deje esta pantalla abierta.`
                          : 'Estamos esperando que OpenClaw confirme la identidad del operador en este equipo.',
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
                title: 'Abra su sesion de OpenClaw',
                message:
                    auth.lastError ||
                    (transport === 'web_broker'
                        ? 'Abra OpenClaw en el navegador y vuelva a esta pantalla para continuar.'
                        : 'Abra OpenClaw en este equipo antes de generar un codigo temporal.'),
            };
        case 'email_no_permitido':
            return {
                tone: 'danger',
                title: 'Esta cuenta no tiene permiso',
                message:
                    auth.lastError ||
                    'La identidad que devolvio OpenClaw no esta autorizada para operar este panel.',
            };
        case 'challenge_expirado':
            return {
                tone: 'warning',
                title: 'Codigo vencido',
                message:
                    auth.lastError ||
                    'El codigo temporal ya vencio. Genere uno nuevo para continuar.',
            };
        case 'helper_no_disponible':
            return {
                tone: 'danger',
                title: 'No encontramos el helper local',
                message:
                    auth.lastError ||
                    'No se pudo abrir el helper local de OpenClaw en este equipo.',
            };
        case 'operator_auth_not_configured':
            return {
                tone: 'danger',
                title: 'OpenClaw no configurado',
                message:
                    auth.lastError ||
                    'Este entorno aun no tiene configurado el acceso delegado por OpenClaw para el consultorio.',
            };
        case 'transport_misconfigured':
            return {
                tone: 'danger',
                title: 'Runtime de OpenClaw desalineado',
                message:
                    auth.lastError ||
                    'El backend respondio sin un transport valido para OpenClaw. Bloqueamos el helper local para evitar abrir localhost por error.',
            };
        case 'cancelled':
            return {
                tone: 'warning',
                title: 'Ingreso cancelado',
                message:
                    auth.lastError ||
                    'Se cerro el flujo de OpenClaw antes de terminar el acceso.',
            };
        case 'invalid_state':
            return {
                tone: 'warning',
                title: 'Intento vencido',
                message:
                    auth.lastError ||
                    'El intento que estaba pendiente ya no es valido. Inicie uno nuevo para continuar.',
            };
        case 'broker_unavailable':
            return {
                tone: 'danger',
                title: 'OpenClaw web no respondio',
                message:
                    auth.lastError ||
                    'La redireccion web no pudo completarse. Reintente cuando OpenClaw vuelva a responder.',
            };
        case 'code_exchange_failed':
            return {
                tone: 'danger',
                title: 'No pudimos confirmar el retorno',
                message:
                    auth.lastError ||
                    'OpenClaw regreso, pero no pudimos validar el retorno del acceso.',
            };
        case 'identity_missing':
            return {
                tone: 'danger',
                title: 'Identidad incompleta',
                message:
                    auth.lastError ||
                    'OpenClaw devolvio una identidad incompleta para este panel.',
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
        default:
            return {
                tone: 'neutral',
                title:
                    transport === 'web_broker'
                        ? 'Listo para entrar con OpenClaw web'
                        : 'Listo para entrar con OpenClaw',
                message:
                    transport === 'web_broker'
                        ? 'Use el boton principal para abrir la redireccion web en esta misma pestana.'
                        : 'Use el boton principal para generar un codigo temporal y validar la identidad desde este equipo.',
            };
    }
}

function buildLegacyFeedback(auth) {
    const status = normalizeAuthStatus(auth.status);
    const isContingency =
        String(auth.recommendedMode || '').trim() === 'openclaw_chatgpt';

    if (auth.requires2FA) {
        return {
            tone: 'warning',
            title: isContingency
                ? 'Falta el 2FA de contingencia'
                : 'Falta el codigo 2FA',
            message: isContingency
                ? 'La clave de contingencia ya fue validada. Ingrese ahora el codigo de seis digitos.'
                : 'La clave ya fue validada. Ingrese ahora el codigo de seis digitos.',
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
        title: isContingency ? 'Contingencia habilitada' : 'Acceso con clave',
        message: isContingency
            ? 'Use esta ruta solo cuando OpenClaw no este disponible y el backend mantenga activa la contingencia.'
            : 'Ingrese la clave para abrir el admin. Si el backend lo pide, el 2FA aparecera en esta misma tarjeta.',
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
    const openClawState = getFailClosedOpenClawState(auth);
    const surfaceTransport =
        mode === 'openclaw_chatgpt' ? openClawState.transport : auth.transport;

    setLoginMode(mode, {
        recommendedMode,
        fallbackAvailable,
        transport: surfaceTransport,
    });

    if (mode === 'openclaw_chatgpt') {
        setOpenClawChallenge(openClawState.challenge, {
            status: normalizeAuthStatus(openClawState.status),
            error: openClawState.lastError,
            transport: openClawState.transport,
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
                lastError: openClawState.lastError,
            })
        );
        return;
    }

    setLogin2FAVisibility(Boolean(auth.requires2FA), {
        recommendedMode,
        transport: auth.transport,
        fallbackAvailable,
    });
    setLoginSubmittingState(false, {
        mode,
        status,
        transport: auth.transport,
    });
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
    setLogin2FAVisibility(false, {
        recommendedMode: getState().auth.recommendedMode,
        transport: getState().auth.transport,
        fallbackAvailable:
            getState().auth.fallbacks?.legacy_password?.available === true,
    });
    resetLoginForm({ clearPassword: true });
    await refreshDataAndRender(false);
    syncQueueAutoRefresh({
        immediate: getState().ui.activeSection === 'queue',
        reason: 'login',
    });
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

    if (String(auth.mode || '') !== 'openclaw_chatgpt') {
        clearOpenClawPollTimer();
        return;
    }

    const status = normalizeAuthStatus(auth.status);
    if (
        status === 'pending' &&
        auth.challenge &&
        String(auth.transport || '').trim().toLowerCase() === 'local_helper'
    ) {
        scheduleOpenClawPoll(auth.challenge.pollAfterMs || 1200);
        return;
    }

    if (OPENCLAW_TERMINAL_STATUSES.has(status)) {
        clearOpenClawPollTimer();
    }
}

async function handleOpenClawSubmit() {
    const auth = getState().auth;
    const openClawState = getFailClosedOpenClawState(auth);
    const openClawStatus = normalizeAuthStatus(openClawState.status);
    const localHelperUrl = String(
        openClawState.challenge?.helperUrl || ''
    ).trim();
    const localPending =
        openClawStatus === 'pending' &&
        String(openClawState.transport || auth.transport || '')
            .trim()
            .toLowerCase() === 'local_helper';

    if (openClawStatus === 'transport_misconfigured') {
        syncLoginSurfaceFromState();
        createToast(
            openClawState.lastError ||
                'El runtime de OpenClaw no publico un transport valido.',
            'error'
        );
        return;
    }

    if (localPending && localHelperUrl) {
        setLoginSubmittingState(true, {
            mode: 'openclaw_chatgpt',
            status: openClawState.status,
            transport: openClawState.transport || auth.transport,
        });
        setLoginFeedback({
            tone: 'neutral',
            title: 'Reabriendo helper local',
            message:
                'Volvemos a abrir el helper local para terminar el codigo temporal que ya estaba pendiente.',
        });

        const helperOpened = openHelperWindow(localHelperUrl);
        if (!helperOpened) {
            createToast(
                'Abra el helper local desde el enlace del codigo temporal.',
                'warning'
            );
        }

        if (openClawState.challenge) {
            scheduleOpenClawPoll(openClawState.challenge.pollAfterMs || 1200);
        }

        setLoginSubmittingState(false, {
            mode: 'openclaw_chatgpt',
            status: openClawState.status,
            transport: openClawState.transport || auth.transport,
        });
        return;
    }

    const reusableRedirectUrl = getReusableOpenClawRedirectUrl({
        ...auth,
        transport: openClawState.transport,
        status: openClawState.status,
        redirectUrl: openClawState.redirectUrl,
        attemptExpiresAt: openClawState.expiresAt,
    });
    if (reusableRedirectUrl) {
        setLoginSubmittingState(true, {
            mode: 'openclaw_chatgpt',
            status: auth.status,
            transport: auth.transport,
        });
        setLoginFeedback({
            tone: 'neutral',
            title: 'Retomando OpenClaw web',
            message:
                'Volviendo a la redireccion segura de OpenClaw en esta misma pestana para completar el acceso pendiente.',
        });
        window.location.assign(reusableRedirectUrl);
        return;
    }

    clearOpenClawPollTimer();
    const webBroker =
        normalizeOpenClawTransport(openClawState.transport) === 'web_broker';
    setLoginSubmittingState(true, {
        mode: 'openclaw_chatgpt',
        status: getState().auth.status,
        transport: getState().auth.transport,
    });
    setLoginFeedback({
        tone: 'neutral',
        title: webBroker
            ? 'Abriendo OpenClaw web'
            : 'Generando codigo temporal',
        message: webBroker
            ? 'Preparando la redireccion segura en esta misma pestana.'
            : 'Solicitando el codigo temporal a OpenClaw y abriendo el helper local de este equipo.',
    });

    try {
        const result = await startOpenClawLogin();
        const auth = getState().auth;
        syncLoginSurfaceFromState();

        if (result.authenticated || auth.authenticated) {
            await finishAuthenticatedLogin('Sesion iniciada con OpenClaw');
            return;
        }

        if (result.transport === 'web_broker') {
            if (!result.redirectUrl) {
                throw new Error(
                    'OpenClaw no devolvio una URL valida para continuar el login web.'
                );
            }

            window.location.assign(result.redirectUrl);
            return;
        }

        const helperOpened = openHelperWindow(result.challenge?.helperUrl);
        if (!helperOpened && result.challenge?.helperUrl) {
            createToast(
                'Abre el helper local desde el enlace del challenge.',
                'warning'
            );
        }

        if (
            normalizeAuthStatus(result.status) === 'pending' &&
            result.challenge
        ) {
            scheduleOpenClawPoll(result.challenge.pollAfterMs || 1200);
            createToast('Codigo temporal emitido', 'info');
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
            mode: auth.mode || 'openclaw_chatgpt',
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
    const auth = getState().auth;
    const contingencyMode =
        String(auth.recommendedMode || '').trim() === 'openclaw_chatgpt';

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
        transport: getState().auth.transport,
        fallbackAvailable:
            getState().auth.fallbacks?.legacy_password?.available === true,
    });
    resetLoginForm();
    setLoginFeedback({
        tone: 'neutral',
        title: contingencyMode
            ? 'Contingencia reiniciada'
            : 'Volvio al paso de clave',
        message: contingencyMode
            ? 'Volvio al paso de clave de contingencia. Puede intentarlo otra vez o regresar a OpenClaw.'
            : 'Volvio al paso de clave. Puede intentarlo otra vez.',
    });
    focusLoginField('password');
}

export async function handleLoginSubmit(event) {
    event.preventDefault();

    const state = getState();
    if (getActiveLoginSurfaceMode(state.auth) === 'openclaw_chatgpt') {
        await handleOpenClawSubmit();
        return;
    }

    const passwordInput = document.getElementById('adminPassword');
    const codeInput = document.getElementById('admin2FACode');

    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';

    try {
        const contingencyMode =
            String(state.auth.recommendedMode || '').trim() ===
            'openclaw_chatgpt';
        setLoginSubmittingState(true, {
            mode: 'legacy_password',
            status: state.auth.requires2FA
                ? 'two_factor_required'
                : 'anonymous',
            transport: state.auth.transport,
        });
        setLoginFeedback({
            tone: state.auth.requires2FA ? 'warning' : 'neutral',
            title: state.auth.requires2FA
                ? contingencyMode
                    ? 'Validando 2FA de contingencia'
                    : 'Validando codigo 2FA'
                : contingencyMode
                  ? 'Validando clave de contingencia'
                  : 'Validando clave',
            message: state.auth.requires2FA
                ? contingencyMode
                    ? 'Comprobando el codigo 2FA antes de cerrar la contingencia.'
                    : 'Comprobando el codigo 2FA antes de abrir el panel.'
                : contingencyMode
                  ? 'Comprobando la clave excepcional antes de pedir el 2FA.'
                  : 'Comprobando la clave antes de abrir el panel.',
        });

        if (state.auth.requires2FA) {
            await loginWith2FA(code);
        } else {
            const result = await loginWithPassword(password);
            if (result.requires2FA) {
                setLogin2FAVisibility(true, {
                    recommendedMode: getState().auth.recommendedMode,
                    transport: getState().auth.transport,
                    fallbackAvailable:
                        getState().auth.fallbacks?.legacy_password
                            ?.available === true,
                });
                setLoginFeedback({
                    tone: 'warning',
                    title: contingencyMode
                        ? 'Falta el 2FA de contingencia'
                        : 'Codigo 2FA requerido',
                    message: contingencyMode
                        ? 'La clave de contingencia ya fue validada. Ingrese ahora el codigo de seis digitos.'
                        : 'La clave ya fue validada. Ingrese ahora el codigo de seis digitos.',
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
            transport: getState().auth.transport,
        });
    }
}

export async function bootAuthenticatedUi() {
    clearOpenClawPollTimer();
    showDashboardView();
    hideCommandPalette();
    await refreshDataAndRender(false);
}

export function resumeOpenClawPolling() {
    const auth = getState().auth;
    if (
        auth.authenticated ||
        String(auth.mode || '') !== 'openclaw_chatgpt' ||
        normalizeAuthStatus(auth.status) !== 'pending' ||
        !auth.challenge ||
        String(auth.transport || '').trim().toLowerCase() !== 'local_helper'
    ) {
        return;
    }

    scheduleOpenClawPoll(auth.challenge.pollAfterMs || 1200);
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

    if (nextMode === 'openclaw_chatgpt') {
        const openClawState = getFailClosedOpenClawState(getState().auth);
        if (
            normalizeAuthStatus(openClawState.status) === 'pending' &&
            openClawState.challenge &&
            String(openClawState.transport || '')
                .trim()
                .toLowerCase() === 'local_helper'
        ) {
            scheduleOpenClawPoll(openClawState.challenge.pollAfterMs || 1200);
        }
    }

    return nextMode;
}
