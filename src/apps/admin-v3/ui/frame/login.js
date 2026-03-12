import { qs } from '../../shared/ui/render.js';

const LEGACY_AUTH_MODE = 'legacy_password';

function isOperatorAuthFlowVisible() {
    const flow = qs('#adminOpenClawFlow');
    return Boolean(flow && !flow.classList.contains('is-hidden'));
}

function formatChallengeExpiry(challenge) {
    const expiresAt = String(challenge?.expiresAt || '').trim();
    if (expiresAt === '') {
        return '';
    }

    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function resolveOperatorAuthCopy(auth) {
    const status = String(auth?.status || 'anonymous').trim();
    const helperOpened = auth?.helperUrlOpened === true;
    const expiresAt = formatChallengeExpiry(auth?.challenge);

    switch (status) {
        case 'pending':
            return {
                eyebrow: 'Esperando OpenClaw',
                title: 'Confirma tu sesion en OpenClaw',
                summary:
                    'Completa el login de ChatGPT/OpenAI en la ventana que abrimos y el panel se autenticara automaticamente.',
                support: helperOpened
                    ? 'La ventana del helper ya fue abierta. Si no la ves, usa el enlace manual o vuelve a abrir OpenClaw.'
                    : 'Tu navegador puede haber bloqueado la ventana. Usa el enlace manual o vuelve a abrir OpenClaw.',
                primaryLabel: 'Volver a abrir OpenClaw',
                helperMeta: expiresAt
                    ? `El challenge actual expira a las ${expiresAt}.`
                    : 'El challenge actual seguira valido por unos minutos.',
                showRetry: true,
            };
        case 'openclaw_no_logueado':
            return {
                eyebrow: 'OpenClaw requiere sesion',
                title: 'Inicia sesion en OpenClaw',
                summary:
                    'OpenClaw no encontro un perfil OAuth valido de ChatGPT/OpenAI en este equipo.',
                support:
                    'Abre OpenClaw, autentica tu perfil y luego genera un nuevo enlace.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Despues de autenticarte en OpenClaw, vuelve aqui y genera un nuevo challenge.',
                showRetry: true,
            };
        case 'helper_no_disponible':
            return {
                eyebrow: 'Helper local no disponible',
                title: 'No se pudo completar el bridge',
                summary:
                    'El helper local de OpenClaw no pudo validar la sesion desde este equipo.',
                support:
                    'Verifica que `npm run auth:operator:bridge` siga vivo y vuelve a generar un enlace.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Si el problema persiste, reinicia el helper local y reintenta.',
                showRetry: true,
            };
        case 'challenge_expirado':
            return {
                eyebrow: 'Challenge expirado',
                title: 'El enlace ya no es valido',
                summary:
                    'El challenge de OpenClaw expiro antes de completar la autenticacion.',
                support:
                    'Genera un nuevo enlace y termina el login sin cerrar esta pantalla.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'El siguiente challenge se abrira en una ventana nueva para continuar el acceso.',
                showRetry: true,
            };
        case 'email_no_permitido':
            return {
                eyebrow: 'Acceso denegado',
                title: 'El email no esta autorizado',
                summary:
                    'La cuenta autenticada en OpenClaw no forma parte de la allowlist del panel.',
                support:
                    'Cierra esa sesion en OpenClaw e intenta con un correo autorizado.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'El siguiente intento usara un challenge nuevo para otro perfil.',
                showRetry: true,
            };
        case 'operator_auth_not_configured':
            return {
                eyebrow: 'Configuracion pendiente',
                title: 'OpenClaw no esta listo en este entorno',
                summary:
                    'El backend tiene operator auth activo, pero faltan datos para completar el bridge.',
                support:
                    'Corrige la configuracion del entorno antes de reintentar.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'Cuando la configuracion vuelva a estar disponible, podras generar un nuevo challenge.',
                showRetry: true,
            };
        default:
            return {
                eyebrow: 'Ingreso protegido',
                title: 'Acceso OpenClaw / ChatGPT',
                summary:
                    'Abre OpenClaw para validar tu sesion de operador sin usar una clave local.',
                support:
                    'La misma sesion se compartira con el panel y el turnero operador.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Si el navegador bloquea la ventana, podras usar un enlace manual.',
                showRetry: false,
            };
    }
}

export function setLoginMode(mode = LEGACY_AUTH_MODE) {
    const operatorFlow = qs('#adminOpenClawFlow');
    const legacyForm = qs('#loginForm');
    const operatorMode = String(mode || '') !== LEGACY_AUTH_MODE;

    operatorFlow?.classList.toggle('is-hidden', !operatorMode);
    legacyForm?.classList.toggle('is-hidden', operatorMode);
}

export function setOperatorAuthLoginState(auth = {}) {
    const eyebrow = qs('#adminLoginStepEyebrow');
    const title = qs('#adminLoginStepTitle');
    const summary = qs('#adminLoginStepSummary');
    const support = qs('#adminLoginSupportCopy');
    const openButton = qs('#adminOpenClawBtn');
    const retryButton = qs('#adminOpenClawRetryBtn');
    const helperMeta = qs('#adminOpenClawHelperMeta');
    const helperLink = qs('#adminOpenClawHelperLink');
    const helperLinkRow = qs('#adminOpenClawLinkRow');
    const manualRow = qs('#adminOpenClawManualRow');
    const manualCode = qs('#adminOpenClawManualCode');
    const openClawSummary = qs('#adminOpenClawSummary');
    const copy = resolveOperatorAuthCopy(auth);
    const challenge = auth?.challenge || null;
    const helperUrl = String(challenge?.helperUrl || '').trim();
    const manualValue = String(challenge?.manualCode || '').trim();

    if (eyebrow) eyebrow.textContent = copy.eyebrow;
    if (title) title.textContent = copy.title;
    if (summary) summary.textContent = copy.summary;
    if (support) support.textContent = copy.support;
    if (openClawSummary) openClawSummary.textContent = copy.summary;
    if (helperMeta) helperMeta.textContent = copy.helperMeta;

    if (openButton instanceof HTMLButtonElement) {
        openButton.dataset.idleLabel = copy.primaryLabel;
        openButton.textContent = copy.primaryLabel;
    }

    if (retryButton instanceof HTMLButtonElement) {
        retryButton.classList.toggle('is-hidden', !copy.showRetry);
    }

    if (helperLink instanceof HTMLAnchorElement) {
        helperLink.href = helperUrl || '#';
    }
    helperLinkRow?.classList.toggle('is-hidden', helperUrl === '');

    if (manualCode) {
        manualCode.textContent = manualValue;
    }
    manualRow?.classList.toggle('is-hidden', manualValue === '');
}

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
    const openClawButton = qs('#adminOpenClawBtn');
    const retryClawButton = qs('#adminOpenClawRetryBtn');
    const group = qs('#group2FA');
    const requires2FA = Boolean(
        group && !group.classList.contains('is-hidden')
    );
    const operatorMode = isOperatorAuthFlowVisible();

    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled =
            Boolean(submitting) || requires2FA || operatorMode;
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled =
            Boolean(submitting) || !requires2FA || operatorMode;
    }

    if (button instanceof HTMLButtonElement) {
        const idleLabel = operatorMode
            ? String(button.dataset.idleLabel || 'Abrir OpenClaw')
            : requires2FA
              ? 'Verificar y entrar'
              : 'Ingresar';
        button.disabled = Boolean(submitting);
        button.textContent = submitting
            ? operatorMode
                ? 'Preparando...'
                : requires2FA
                  ? 'Verificando...'
                  : 'Ingresando...'
            : idleLabel;
    }

    if (resetBtn instanceof HTMLButtonElement) {
        resetBtn.disabled = Boolean(submitting);
    }

    if (openClawButton instanceof HTMLButtonElement) {
        const idleLabel = String(
            openClawButton.dataset.idleLabel || 'Abrir OpenClaw'
        );
        openClawButton.disabled = Boolean(submitting);
        openClawButton.textContent = submitting ? 'Preparando...' : idleLabel;
    }

    if (retryClawButton instanceof HTMLButtonElement) {
        retryClawButton.disabled = Boolean(submitting);
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
    const target =
        field === '2fa'
            ? qs('#admin2FACode')
            : field === 'operator_auth'
              ? qs('#adminOpenClawBtn')
              : qs('#adminPassword');
    if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLButtonElement
    ) {
        target.focus();
        target.select?.();
    }
}
