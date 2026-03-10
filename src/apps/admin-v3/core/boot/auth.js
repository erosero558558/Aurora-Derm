import { getState, updateState } from '../../shared/core/store.js';
import { createToast } from '../../shared/ui/render.js';
import { loginWith2FA, loginWithPassword } from '../../shared/modules/auth.js';
import { syncQueueAutoRefresh } from '../../shared/modules/queue.js';
import {
    focusLoginField,
    hideCommandPalette,
    resetLoginForm,
    setLogin2FAVisibility,
    setLoginFeedback,
    setLoginSubmittingState,
    showDashboardView,
} from '../../ui/frame.js';
import { refreshDataAndRender } from './rendering.js';

export function primeLoginSurface() {
    setLogin2FAVisibility(false);
    resetLoginForm();
    setLoginSubmittingState(false);
    setLoginFeedback({
        tone: 'neutral',
        title: 'Proteccion activa',
        message:
            'Usa tu clave de administrador para acceder al centro operativo.',
    });
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

    const passwordInput = document.getElementById('adminPassword');
    const codeInput = document.getElementById('admin2FACode');

    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';

    try {
        setLoginSubmittingState(true);
        const state = getState();

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
        createToast('Sesion iniciada', 'success');
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

export async function bootAuthenticatedUi() {
    showDashboardView();
    hideCommandPalette();
    await refreshDataAndRender(false);
}
