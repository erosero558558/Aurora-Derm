import { qs } from '../../shared/ui/render.js';

function normalizeRecommendedMode(mode = 'legacy_password') {
    return String(mode || '')
        .trim()
        .toLowerCase() === 'openclaw_chatgpt'
        ? 'openclaw_chatgpt'
        : 'legacy_password';
}

function syncContingencyActions({
    mode = 'legacy_password',
    recommendedMode = 'legacy_password',
    fallbackAvailable = false,
} = {}) {
    const fallbackBtn = qs('#loginFallbackToggleBtn');
    const primaryBtn = qs('#loginPrimaryToggleBtn');
    const copy = qs('#adminLoginContingencyCopy');
    const openClawPrimary =
        normalizeRecommendedMode(recommendedMode) === 'openclaw_chatgpt';
    const showFallback =
        openClawPrimary &&
        fallbackAvailable === true &&
        mode !== 'legacy_password';
    const showPrimary =
        openClawPrimary &&
        fallbackAvailable === true &&
        mode === 'legacy_password';

    fallbackBtn?.classList.toggle('is-hidden', !showFallback);
    primaryBtn?.classList.toggle('is-hidden', !showPrimary);
    if (fallbackBtn instanceof HTMLButtonElement) {
        fallbackBtn.disabled = false;
    }
    if (primaryBtn instanceof HTMLButtonElement) {
        primaryBtn.disabled = false;
    }

    copy?.classList.toggle(
        'is-hidden',
        !(openClawPrimary && fallbackAvailable)
    );
    if (copy) {
        copy.textContent =
            mode === 'legacy_password'
                ? 'Clave + 2FA es una contingencia segura para entrar desde cualquier PC. OpenClaw sigue siendo el acceso principal del operador local.'
                : 'OpenClaw es el acceso principal del operador local. Si necesitas entrar desde cualquier PC, usa la contingencia con clave + 2FA.';
    }
}

function formatOpenClawExpiry(expiresAt) {
    const value = String(expiresAt || '').trim();
    if (!value) {
        return '';
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    try {
        return new Intl.DateTimeFormat('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }).format(parsed);
    } catch (_error) {
        return parsed.toLocaleTimeString();
    }
}

export function setLoginMode(mode = 'legacy_password', options = {}) {
    const normalized =
        String(mode || '')
            .trim()
            .toLowerCase() === 'openclaw_chatgpt'
            ? 'openclaw_chatgpt'
            : 'legacy_password';
    const recommendedMode = normalizeRecommendedMode(
        options.recommendedMode || normalized
    );
    const fallbackAvailable = options.fallbackAvailable === true;
    const openClawPrimary = recommendedMode === 'openclaw_chatgpt';
    const legacyStage = qs('#legacyLoginStage');
    const openclawStage = qs('#openclawLoginStage');
    const summary = qs('#adminLoginStepSummary');
    const eyebrow = qs('#adminLoginStepEyebrow');
    const title = qs('#adminLoginStepTitle');
    const support = qs('#adminLoginSupportCopy');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');

    legacyStage?.classList.toggle(
        'is-hidden',
        normalized === 'openclaw_chatgpt'
    );
    openclawStage?.classList.toggle(
        'is-hidden',
        normalized !== 'openclaw_chatgpt'
    );
    form?.classList.remove('is-2fa-stage');
    resetBtn?.classList.add('is-hidden');
    syncContingencyActions({
        mode: normalized,
        recommendedMode,
        fallbackAvailable,
    });

    if (normalized === 'openclaw_chatgpt') {
        if (eyebrow) {
            eyebrow.textContent = openClawPrimary
                ? 'Acceso principal'
                : 'Acceso delegado';
        }
        if (title) title.textContent = 'Entrar con OpenClaw';
        if (summary) {
            summary.textContent = openClawPrimary
                ? 'OpenClaw es el acceso principal del operador local en este laptop.'
                : 'Usa tu sesion local de OpenClaw para abrir el nucleo interno del consultorio.';
        }
        if (support) {
            support.textContent =
                fallbackAvailable && openClawPrimary
                    ? 'El panel abrira el helper local y esperara la confirmacion del operador autorizado. Tambien puedes usar la contingencia web cuando aplique.'
                    : 'El panel abrira el helper local y esperara la confirmacion del operador autorizado.';
        }
        return;
    }

    if (eyebrow) {
        eyebrow.textContent = openClawPrimary
            ? 'Contingencia web'
            : 'Ingreso de respaldo';
    }
    if (title) {
        title.textContent = openClawPrimary
            ? 'Clave + 2FA de contingencia'
            : 'Acceso administrativo';
    }
    if (summary) {
        summary.textContent = openClawPrimary
            ? 'Usa esta ruta solo si necesitas entrar desde cualquier computadora.'
            : 'Usa tu clave solo como respaldo para entrar al centro interno.';
    }
    if (support) {
        support.textContent = openClawPrimary
            ? 'OpenClaw sigue siendo el acceso principal del operador local; este formulario exige clave + 2FA.'
            : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.';
    }
}

export function setLogin2FAVisibility(visible, options = {}) {
    const group = qs('#group2FA');
    const summary = qs('#adminLoginStepSummary');
    const eyebrow = qs('#adminLoginStepEyebrow');
    const title = qs('#adminLoginStepTitle');
    const support = qs('#adminLoginSupportCopy');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');
    const recommendedMode = normalizeRecommendedMode(
        options.recommendedMode || 'legacy_password'
    );
    const fallbackAvailable = options.fallbackAvailable === true;
    const openClawPrimary = recommendedMode === 'openclaw_chatgpt';

    if (!group) return;

    group.classList.toggle('is-hidden', !visible);
    form?.classList.toggle('is-2fa-stage', Boolean(visible));
    resetBtn?.classList.toggle('is-hidden', !visible);
    syncContingencyActions({
        mode: 'legacy_password',
        recommendedMode,
        fallbackAvailable,
    });

    if (eyebrow) {
        eyebrow.textContent = visible
            ? openClawPrimary
                ? 'Contingencia web'
                : 'Verificacion secundaria'
            : openClawPrimary
              ? 'Contingencia web'
              : 'Ingreso de respaldo';
    }
    if (title) {
        title.textContent = visible
            ? openClawPrimary
                ? 'Confirma el 2FA de contingencia'
                : 'Confirma el codigo 2FA'
            : openClawPrimary
              ? 'Clave + 2FA de contingencia'
              : 'Acceso administrativo';
    }
    if (summary) {
        summary.textContent = visible
            ? openClawPrimary
                ? 'Ingresa el codigo de seis digitos para terminar el acceso de contingencia.'
                : 'Ingresa el codigo de seis digitos para terminar la autenticacion.'
            : openClawPrimary
              ? 'Usa esta ruta solo si necesitas entrar desde cualquier computadora.'
              : 'Usa tu clave solo como respaldo para entrar al centro interno.';
    }
    if (support) {
        support.textContent = visible
            ? openClawPrimary
                ? 'La clave de contingencia ya fue validada. OpenClaw sigue siendo el acceso principal del operador local.'
                : 'El backend ya valido la clave. Falta la segunda verificacion.'
            : openClawPrimary
              ? 'OpenClaw sigue siendo el acceso principal del operador local; este formulario exige clave + 2FA.'
              : 'Si el backend solicita un segundo paso, veras el campo 2FA en esta misma tarjeta.';
    }

    setLoginSubmittingState(false);
}

export function setOpenClawChallenge(challenge, options = {}) {
    const challengeCard = qs('#adminOpenClawChallengeCard');
    const manualCode = qs('#adminOpenClawManualCode');
    const meta = qs('#adminOpenClawChallengeMeta');
    const helperLink = qs('#adminOpenClawHelperLink');
    const introTitle = qs('#adminOpenClawIntroTitle');
    const introMessage = qs('#adminOpenClawIntroMessage');
    const status = String(options.status || 'anonymous')
        .trim()
        .toLowerCase();
    const error = String(options.error || '').trim();

    if (!(challengeCard instanceof HTMLElement)) {
        return;
    }

    if (!challenge || typeof challenge !== 'object') {
        challengeCard.classList.add('is-hidden');
        if (manualCode) manualCode.textContent = '-';
        if (meta) {
            meta.textContent =
                'El helper local mostrara aqui el challenge activo cuando inicies el flujo.';
        }
        if (helperLink instanceof HTMLAnchorElement) {
            helperLink.href = '#';
            helperLink.classList.add('is-hidden');
        }
        if (introTitle) introTitle.textContent = 'Sesion local OpenClaw';
        if (introMessage) {
            introMessage.textContent =
                status === 'openclaw_no_logueado'
                    ? 'Completa el inicio de sesion en OpenClaw y vuelve a generar un challenge.'
                    : 'Este panel delega la identidad del operador a OpenClaw en este mismo laptop.';
        }
        return;
    }

    const expiresAt = formatOpenClawExpiry(challenge.expiresAt);
    challengeCard.classList.remove('is-hidden');
    if (manualCode) {
        manualCode.textContent =
            String(challenge.manualCode || '-').trim() || '-';
    }
    if (meta) {
        meta.textContent =
            status === 'pending'
                ? expiresAt
                    ? `Challenge activo. Expira a las ${expiresAt}.`
                    : 'Challenge activo. Resuelvelo desde el helper local.'
                : error ||
                  (expiresAt
                      ? `Ultimo challenge emitido. Expiraba a las ${expiresAt}.`
                      : 'Ultimo challenge emitido para este operador.');
    }
    if (helperLink instanceof HTMLAnchorElement) {
        const href = String(challenge.helperUrl || '').trim();
        helperLink.href = href || '#';
        helperLink.classList.toggle('is-hidden', !href);
    }
    if (introTitle) {
        introTitle.textContent =
            status === 'pending'
                ? 'Esperando confirmacion de OpenClaw'
                : 'Sesion local OpenClaw';
    }
    if (introMessage) {
        introMessage.textContent =
            status === 'pending'
                ? 'Mantente en esta pantalla mientras el helper local termina la validacion.'
                : 'Si ya completaste el login de OpenClaw, puedes generar un nuevo challenge.';
    }
}

export function setLoginFeedback({
    tone = 'neutral',
    title = 'Readiness del consultorio',
    message = 'El panel comprueba acceso OpenClaw y seguridad clinica antes de abrir la operacion.',
} = {}) {
    const card = qs('#adminLoginStatusCard');
    const titleEl = qs('#adminLoginStatusTitle');
    const messageEl = qs('#adminLoginStatusMessage');

    card?.setAttribute('data-state', tone);
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
}

export function setLoginSubmittingState(submitting, options = {}) {
    const button = qs('#loginBtn');
    const resetBtn = qs('#loginReset2FABtn');
    const fallbackBtn = qs('#loginFallbackToggleBtn');
    const primaryBtn = qs('#loginPrimaryToggleBtn');
    const passwordInput = qs('#adminPassword');
    const codeInput = qs('#admin2FACode');
    const group = qs('#group2FA');
    const mode =
        String(options.mode || '')
            .trim()
            .toLowerCase() === 'openclaw_chatgpt'
            ? 'openclaw_chatgpt'
            : 'legacy_password';
    const status = String(options.status || 'anonymous')
        .trim()
        .toLowerCase();
    const shouldRegenerateOpenClawChallenge =
        status === 'pending' ||
        status === 'openclaw_no_logueado' ||
        status === 'email_no_permitido' ||
        status === 'challenge_expirado' ||
        status === 'helper_no_disponible';
    const requires2FA =
        mode === 'legacy_password'
            ? Boolean(group && !group.classList.contains('is-hidden'))
            : false;

    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled =
            mode === 'openclaw_chatgpt' || Boolean(submitting) || requires2FA;
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled =
            mode === 'openclaw_chatgpt' || Boolean(submitting) || !requires2FA;
    }

    if (button instanceof HTMLButtonElement) {
        button.disabled = Boolean(submitting);
        if (mode === 'openclaw_chatgpt') {
            button.textContent = submitting
                ? 'Abriendo OpenClaw...'
                : shouldRegenerateOpenClawChallenge
                  ? 'Generar nuevo codigo'
                  : 'Continuar con OpenClaw';
        } else {
            button.textContent = submitting
                ? requires2FA
                    ? 'Verificando...'
                    : 'Ingresando...'
                : requires2FA
                  ? 'Verificar y entrar'
                  : 'Ingresar';
        }
    }

    if (resetBtn instanceof HTMLButtonElement) {
        resetBtn.disabled = Boolean(submitting);
        resetBtn.classList.toggle(
            'is-hidden',
            mode === 'openclaw_chatgpt' || !requires2FA
        );
    }

    if (fallbackBtn instanceof HTMLButtonElement) {
        fallbackBtn.disabled = Boolean(submitting);
    }
    if (primaryBtn instanceof HTMLButtonElement) {
        primaryBtn.disabled = Boolean(submitting);
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
