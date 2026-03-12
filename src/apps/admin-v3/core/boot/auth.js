import { getState, updateState } from '../../shared/core/store.js';
import { createToast } from '../../shared/ui/render.js';
import {
    isOperatorAuthMode,
    loginWith2FA,
    loginWithPassword,
    pollOperatorAuthStatus,
    startOperatorAuth,
} from '../../shared/modules/auth.js';
import { syncQueueAutoRefresh } from '../../shared/modules/queue.js';
import {
    focusLoginField,
    hideCommandPalette,
    resetLoginForm,
    setLogin2FAVisibility,
    setLoginFeedback,
    setLoginMode,
    setOperatorAuthLoginState,
    setLoginSubmittingState,
    showDashboardView,
} from '../../ui/frame.js';
import { refreshDataAndRender } from './rendering.js';

let operatorAuthPollPromise = null;

function resolveOperatorAuthFeedback(auth) {
    const status = String(auth?.status || 'anonymous').trim();

    switch (status) {
        case 'pending':
            return {
                tone: 'warning',
                title: 'Esperando confirmacion en OpenClaw',
                message:
                    'Completa el login de ChatGPT/OpenAI en OpenClaw y el panel se autenticara en cuanto reciba la confirmacion.',
            };
        case 'openclaw_no_logueado':
            return {
                tone: 'warning',
                title: 'OpenClaw necesita tu sesion',
                message:
                    auth?.error ||
                    'Inicia sesion en OpenClaw con tu perfil autorizado y vuelve a generar el enlace.',
            };
        case 'helper_no_disponible':
            return {
                tone: 'danger',
                title: 'No se pudo completar el bridge',
                message:
                    auth?.error ||
                    'El helper local de OpenClaw no esta disponible en este equipo.',
            };
        case 'challenge_expirado':
            return {
                tone: 'warning',
                title: 'El enlace expiro',
                message:
                    auth?.error ||
                    'Genera un nuevo challenge y completa el login sin cerrar esta pantalla.',
            };
        case 'email_no_permitido':
            return {
                tone: 'danger',
                title: 'Email no autorizado',
                message:
                    auth?.error ||
                    'El correo autenticado en OpenClaw no esta permitido para operar este panel.',
            };
        case 'operator_auth_not_configured':
            return {
                tone: 'danger',
                title: 'OpenClaw no esta configurado',
                message:
                    auth?.error ||
                    'Falta configuracion del bridge local para completar el acceso.',
            };
        default:
            return {
                tone: 'neutral',
                title: 'Proteccion activa',
                message:
                    'Abre OpenClaw para validar tu sesion sin usar una clave local en este panel.',
            };
    }
}

function syncLoginSurface(auth = getState().auth) {
    if (isOperatorAuthMode(auth)) {
        setLoginMode(auth.mode);
        setLogin2FAVisibility(false);
        resetLoginForm();
        setOperatorAuthLoginState(auth);
        setLoginFeedback(resolveOperatorAuthFeedback(auth));
        return;
    }

    setLoginMode('legacy_password');
    setOperatorAuthLoginState({ status: 'anonymous', challenge: null });
    setLogin2FAVisibility(Boolean(auth.requires2FA));
    setLoginFeedback({
        tone: auth.requires2FA ? 'warning' : 'neutral',
        title: auth.requires2FA ? 'Codigo 2FA requerido' : 'Proteccion activa',
        message: auth.requires2FA
            ? 'El backend ya valido la clave. Falta ingresar el codigo de seis digitos.'
            : 'Usa tu clave de administrador para acceder al centro operativo.',
    });
}

async function finalizeInteractiveLogin(toastMessage = 'Sesion iniciada') {
    setLoginFeedback({
        tone: 'success',
        title: 'Acceso concedido',
        message: 'Sesion autenticada. Cargando centro operativo.',
    });
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

function ensureOperatorAuthPolling() {
    const auth = getState().auth;
    if (
        operatorAuthPollPromise ||
        !isOperatorAuthMode(auth) ||
        auth.authenticated ||
        String(auth.status || '') !== 'pending'
    ) {
        return operatorAuthPollPromise;
    }

    operatorAuthPollPromise = pollOperatorAuthStatus({
        onUpdate: (snapshot) => {
            syncLoginSurface(snapshot);
        },
    })
        .then(async (snapshot) => {
            operatorAuthPollPromise = null;
            syncLoginSurface(snapshot);
            if (snapshot.authenticated) {
                await finalizeInteractiveLogin('Sesion iniciada con OpenClaw');
            }
            return snapshot;
        })
        .catch((error) => {
            operatorAuthPollPromise = null;
            setLoginFeedback({
                tone: 'danger',
                title: 'No se pudo iniciar sesion',
                message:
                    error?.message ||
                    'No se pudo consultar el estado del login OpenClaw.',
            });
            createToast(
                error?.message || 'No se pudo consultar el estado de OpenClaw',
                'error'
            );
            return getState().auth;
        });

    return operatorAuthPollPromise;
}

export function primeLoginSurface(auth = getState().auth) {
    setLoginSubmittingState(false);
    syncLoginSurface(auth);
    if (isOperatorAuthMode(auth) && String(auth.status || '') === 'pending') {
        void ensureOperatorAuthPolling();
    }
}

export function resetTwoFactorStage() {
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            requires2FA: false,
        },
    }));

    setLogin2FAVisibility(false);
    resetLoginForm();
    setLoginFeedback({
        tone: 'neutral',
        title: 'Ingreso protegido',
        message: 'Volviste al paso de clave. Puedes reintentar el acceso.',
    });
    focusLoginField('password');
}

export async function handleLoginSubmit(event) {
    event.preventDefault();

    const state = getState();
    if (isOperatorAuthMode(state.auth)) {
        await startOperatorAuthFlow(false);
        return;
    }

    const passwordInput = document.getElementById('adminPassword');
    const codeInput = document.getElementById('admin2FACode');

    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';

    try {
        setLoginSubmittingState(true);
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
                setLogin2FAVisibility(true);
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

        await finalizeInteractiveLogin('Sesion iniciada');
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
        setLoginSubmittingState(false);
    }
}

export async function startOperatorAuthFlow(forceNew = false) {
    try {
        setLoginSubmittingState(true);
        setLoginFeedback({
            tone: 'neutral',
            title: forceNew ? 'Generando nuevo enlace' : 'Abriendo OpenClaw',
            message:
                'Preparando el challenge local para validar tu sesion de operador.',
        });

        const snapshot = await startOperatorAuth({
            forceNew,
            openHelper: true,
        });
        syncLoginSurface(snapshot);

        if (snapshot.authenticated) {
            await finalizeInteractiveLogin('Sesion iniciada con OpenClaw');
            return snapshot;
        }

        if (String(snapshot.status || '') === 'pending') {
            createToast(
                snapshot.helperUrlOpened
                    ? 'OpenClaw listo para confirmar'
                    : 'Usa el enlace manual de OpenClaw si la ventana no se abrio',
                snapshot.helperUrlOpened ? 'info' : 'warning'
            );
            void ensureOperatorAuthPolling();
            return snapshot;
        }

        createToast(
            snapshot.error || 'No se pudo iniciar el flujo OpenClaw',
            'warning'
        );
        return snapshot;
    } catch (error) {
        setLoginFeedback({
            tone: 'danger',
            title: 'No se pudo iniciar sesion',
            message:
                error?.message ||
                'No se pudo abrir el flujo OpenClaw para este panel.',
        });
        createToast(
            error?.message || 'No se pudo abrir el flujo OpenClaw',
            'error'
        );
        return getState().auth;
    } finally {
        setLoginSubmittingState(false);
    }
}

export async function bootAuthenticatedUi() {
    showDashboardView();
    hideCommandPalette();
    await refreshDataAndRender(false);
}
