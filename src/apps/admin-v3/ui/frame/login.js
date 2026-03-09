import { qs } from '../../shared/ui/render.js';

export function setLogin2FAVisibility(visible) {
    const group = qs('#group2FA');
    const summary = qs('#adminLoginStepSummary');
    const eyebrow = qs('#adminLoginStepEyebrow');
    const title = qs('#adminLoginStepTitle');
    const support = qs('#adminLoginSupportCopy');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');

    if (!group) return;

    group.classList.toggle('is-hidden', !visible);
    form?.classList.toggle('is-2fa-stage', Boolean(visible));
    resetBtn?.classList.toggle('is-hidden', !visible);

    if (eyebrow) {
        eyebrow.textContent = visible
            ? 'Verificacion secundaria'
            : 'Ingreso protegido';
    }
    if (title) {
        title.textContent = visible
            ? 'Confirma el codigo 2FA'
            : 'Acceso de administrador';
    }
    if (summary) {
        summary.textContent = visible
            ? 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
            : 'Usa tu clave para entrar al centro operativo.';
    }
    if (support) {
        support.textContent = visible
            ? 'El backend ya valido la clave. Falta la segunda verificacion.'
            : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.';
    }

    setLoginSubmittingState(false);
}

export function setLoginFeedback({
    tone = 'neutral',
    title = 'Proteccion activa',
    message = 'El panel usa autenticacion endurecida y activos self-hosted.',
} = {}) {
    const card = qs('#adminLoginStatusCard');
    const titleEl = qs('#adminLoginStatusTitle');
    const messageEl = qs('#adminLoginStatusMessage');

    card?.setAttribute('data-state', tone);
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
}

export function setLoginSubmittingState(submitting) {
    const button = qs('#loginBtn');
    const resetBtn = qs('#loginReset2FABtn');
    const passwordInput = qs('#adminPassword');
    const codeInput = qs('#admin2FACode');
    const group = qs('#group2FA');
    const requires2FA = Boolean(
        group && !group.classList.contains('is-hidden')
    );

    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled = Boolean(submitting) || requires2FA;
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled = Boolean(submitting) || !requires2FA;
    }

    if (button instanceof HTMLButtonElement) {
        button.disabled = Boolean(submitting);
        button.textContent = submitting
            ? requires2FA
                ? 'Verificando...'
                : 'Ingresando...'
            : requires2FA
              ? 'Verificar y entrar'
              : 'Ingresar';
    }

    if (resetBtn instanceof HTMLButtonElement) {
        resetBtn.disabled = Boolean(submitting);
    }
}

export function resetLoginForm({ clearPassword = false } = {}) {
    const passwordInput = qs('#adminPassword');
    const codeInput = qs('#admin2FACode');

    if (passwordInput instanceof HTMLInputElement && clearPassword) {
        passwordInput.value = '';
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.value = '';
    }
}

export function focusLoginField(field = 'password') {
    const target = field === '2fa' ? qs('#admin2FACode') : qs('#adminPassword');
    if (target instanceof HTMLInputElement) {
        target.focus();
        target.select?.();
    }
}
