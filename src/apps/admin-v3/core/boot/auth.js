import { getState, updateState } from '../../shared/core/store.js';
import { createToast } from '../../shared/ui/render.js';
import {
    checkAuthStatus,
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
    'openclaw_no_logueado',
    'email_no_permitido',
    'challenge_expirado',
    'helper_no_disponible',
]);

let openClawPollTimer = 0;
let openClawPolling = false;

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

function buildOpenClawFeedback(auth) {
    const status = normalizeAuthStatus(auth.status);
    const challenge = auth.challenge || null;

    switch (status) {
        case 'pending':
            return {
                tone: 'warning',
                title: 'Challenge activo',
                message: challenge?.manualCode
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
                title: 'Email no permitido',
                message:
                    auth.lastError ||
                    'La identidad resuelta por OpenClaw no esta autorizada para operar este panel.',
            };
        case 'challenge_expirado':
            return {
                tone: 'warning',
                title: 'Challenge expirado',
                message:
                    auth.lastError ||
                    'El codigo ya expiro. Genera un nuevo challenge para continuar.',
            };
        case 'helper_no_disponible':
            return {
                tone: 'danger',
                title: 'Helper local no disponible',
                message:
                    auth.lastError ||
                    'No se pudo contactar al helper local de OpenClaw en este equipo.',
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
                title: 'Sesion local OpenClaw',
                message:
                    'Genera un challenge para validar la identidad del operador desde este laptop.',
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

    setLoginMode(mode, {
        recommendedMode,
        fallbackAvailable,
    });

    if (mode === 'openclaw_chatgpt') {
        const openClawState = getVisibleOpenClawState(auth);
        setOpenClawChallenge(openClawState.challenge, {
            status: normalizeAuthStatus(openClawState.status),
            error: openClawState.lastError,
        });
        setLoginSubmittingState(false, {
            mode,
            status: openClawState.status,
        });
        setLoginFeedback(
            buildOpenClawFeedback({
                ...auth,
                status: openClawState.status,
                challenge: openClawState.challenge,
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
    if (status === 'pending' && auth.challenge) {
        scheduleOpenClawPoll(auth.challenge.pollAfterMs || 1200);
        return;
    }

    if (OPENCLAW_TERMINAL_STATUSES.has(status)) {
        clearOpenClawPollTimer();
    }
}

async function handleOpenClawSubmit() {
    clearOpenClawPollTimer();
    setLoginSubmittingState(true, {
        mode: 'openclaw_chatgpt',
        status: getState().auth.status,
    });
    setLoginFeedback({
        tone: 'neutral',
        title: 'Preparando challenge',
        message:
            'Solicitando un codigo temporal al backend y abriendo el helper local.',
    });

    try {
        const result = await startOpenClawLogin();
        const auth = getState().auth;
        syncLoginSurfaceFromState();

        if (result.authenticated || auth.authenticated) {
            await finishAuthenticatedLogin('Sesion iniciada con OpenClaw');
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
            createToast('Challenge OpenClaw emitido', 'info');
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
}

export function resumeOpenClawPolling() {
    const auth = getState().auth;
    if (
        auth.authenticated ||
        String(auth.mode || '') !== 'openclaw_chatgpt' ||
        normalizeAuthStatus(auth.status) !== 'pending' ||
        !auth.challenge
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
        const openClawState = getVisibleOpenClawState(getState().auth);
        if (
            normalizeAuthStatus(openClawState.status) === 'pending' &&
            openClawState.challenge
        ) {
            scheduleOpenClawPoll(openClawState.challenge.pollAfterMs || 1200);
        }
    }

    return nextMode;
}
