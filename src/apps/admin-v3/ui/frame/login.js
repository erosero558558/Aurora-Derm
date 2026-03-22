import { qs } from '../../shared/ui/render.js';

const CANONICAL_OPERATOR_AUTH_MODE = 'google_oauth';
const LEGACY_OPERATOR_AUTH_MODE = 'openclaw_chatgpt';

function normalizeRecommendedMode(mode = 'legacy_password') {
    const raw = String(mode || '')
        .trim()
        .toLowerCase();
    return raw === CANONICAL_OPERATOR_AUTH_MODE ||
        raw === LEGACY_OPERATOR_AUTH_MODE
        ? CANONICAL_OPERATOR_AUTH_MODE
        : 'legacy_password';
}

function syncContingencyActions({
    mode = 'legacy_password',
    recommendedMode = 'legacy_password',
    fallbackAvailable = false,
    transport = '',
} = {}) {
    const fallbackBtn = qs('#loginFallbackToggleBtn');
    const primaryBtn = qs('#loginPrimaryToggleBtn');
    const copy = qs('#adminLoginContingencyCopy');
    const openClawPrimary =
        normalizeRecommendedMode(recommendedMode) ===
        CANONICAL_OPERATOR_AUTH_MODE;
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
                : transport === 'web_broker'
                  ? 'OpenClaw en navegador es el acceso principal del operador local. Si necesitas entrar desde cualquier PC, usa la contingencia con clave + 2FA.'
                  : 'OpenClaw con helper local es el acceso principal del operador local. Si necesitas entrar desde cualquier PC, usa la contingencia con clave + 2FA.';
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
    const normalized = normalizeRecommendedMode(mode);
    const recommendedMode = normalizeRecommendedMode(
        options.recommendedMode || normalized
    );
    const fallbackAvailable = options.fallbackAvailable === true;
    const openClawPrimary = recommendedMode === CANONICAL_OPERATOR_AUTH_MODE;
    const transport =
        String(options.transport || '')
            .trim()
            .toLowerCase() === 'web_broker'
            ? 'web_broker'
            : String(options.transport || '')
                    .trim()
                    .toLowerCase() === 'local_helper'
              ? 'local_helper'
              : '';
    const status = String(options.status || 'anonymous')
        .trim()
        .toLowerCase();
    const legacyStage = qs('#legacyLoginStage');
    const openclawStage = qs('#openclawLoginStage');
    const summary = qs('#adminLoginStepSummary');
    const eyebrow = qs('#adminLoginStepEyebrow');
    const title = qs('#adminLoginRouteTitle, #adminLoginStepTitle');
    const support = qs('#adminLoginSupportCopy');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');

    legacyStage?.classList.toggle(
        'is-hidden',
        normalized === CANONICAL_OPERATOR_AUTH_MODE
    );
    openclawStage?.classList.toggle(
        'is-hidden',
        normalized !== CANONICAL_OPERATOR_AUTH_MODE
    );
    form?.classList.remove('is-2fa-stage');
    resetBtn?.classList.add('is-hidden');
    syncContingencyActions({
        mode: normalized,
        recommendedMode,
        fallbackAvailable,
        transport,
    });

    if (normalized === CANONICAL_OPERATOR_AUTH_MODE) {
        if (eyebrow) {
            eyebrow.textContent = openClawPrimary
                ? 'Acceso principal'
                : 'Acceso delegado';
        }
        if (title) {
            title.textContent =
                status === 'transport_misconfigured'
                    ? 'Runtime de OpenClaw desalineado'
                    : transport === 'web_broker'
                      ? 'OpenClaw en navegador'
                      : 'OpenClaw en este equipo';
        }
        if (summary) {
            summary.textContent =
                status === 'transport_misconfigured'
                    ? 'El runtime devolvio una surface OpenClaw invalida para este panel.'
                    : transport === 'web_broker'
                      ? 'OpenClaw continuara en la misma pestana para autenticar al operador.'
                      : openClawPrimary
                        ? 'OpenClaw es el acceso principal del operador local en este laptop.'
                        : 'Usa tu sesion local de OpenClaw para abrir el nucleo interno del consultorio.';
        }
        if (support) {
            if (status === 'transport_misconfigured') {
                support.textContent =
                    'Corrige el runtime para publicar transport=web_broker o local_helper antes de volver a intentar.';
            } else if (transport === 'web_broker') {
                support.textContent =
                    'El flujo seguira en la misma pestana y volvera al panel cuando OpenClaw confirme la identidad del operador.';
            } else {
                support.textContent =
                    fallbackAvailable && openClawPrimary
                        ? 'El panel abrira el helper local y esperara la confirmacion del operador autorizado. Tambien puedes usar la contingencia web cuando aplique.'
                        : 'El panel abrira el helper local y esperara la confirmacion del operador autorizado.';
            }
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
            ? 'Clave + 2FA solo como contingencia'
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
    const title = qs('#adminLoginRouteTitle, #adminLoginStepTitle');
    const support = qs('#adminLoginSupportCopy');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');
    const recommendedMode = normalizeRecommendedMode(
        options.recommendedMode || 'legacy_password'
    );
    const fallbackAvailable = options.fallbackAvailable === true;
    const openClawPrimary = recommendedMode === CANONICAL_OPERATOR_AUTH_MODE;

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
                ? '2FA de contingencia'
                : 'Confirma el codigo 2FA'
            : openClawPrimary
              ? 'Clave + 2FA solo como contingencia'
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
    const transport =
        String(options.transport || '')
            .trim()
            .toLowerCase() === 'web_broker'
            ? 'web_broker'
            : String(options.transport || '')
                    .trim()
                    .toLowerCase() === 'local_helper'
              ? 'local_helper'
              : '';
    const redirectUrl = String(options.redirectUrl || '').trim();

    if (!(challengeCard instanceof HTMLElement)) {
        return;
    }

    if (
        !challenge ||
        typeof challenge !== 'object' ||
        transport === 'web_broker'
    ) {
        challengeCard.classList.add('is-hidden');
        if (manualCode) manualCode.textContent = '-';
        if (meta) {
            meta.textContent =
                transport === 'web_broker'
                    ? status === 'pending' && redirectUrl
                        ? 'El intento web sigue activo y puedes retomarlo sin generar otro inicio.'
                        : 'OpenClaw volvera al panel cuando termine la autenticacion web.'
                    : 'El helper local mostrara aqui el challenge activo cuando inicies el flujo.';
        }
        if (helperLink instanceof HTMLAnchorElement) {
            helperLink.href = '#';
            helperLink.classList.add('is-hidden');
        }
        if (introTitle) {
            introTitle.textContent =
                status === 'transport_misconfigured'
                    ? 'Runtime de OpenClaw desalineado'
                    : transport === 'web_broker'
                      ? status === 'pending'
                          ? 'Acceso web pendiente'
                          : 'OpenClaw en navegador'
                      : 'Sesion local OpenClaw';
        }
        if (introMessage) {
            introMessage.textContent =
                status === 'transport_misconfigured'
                    ? 'Corrige la configuracion del runtime antes de abrir OpenClaw desde este panel.'
                    : transport === 'web_broker'
                      ? status === 'pending' && redirectUrl
                          ? 'El intento web sigue activo. Retoma OpenClaw sin generar un inicio nuevo.'
                          : 'Este panel delega la identidad del operador a OpenClaw en la misma pestana.'
                      : status === 'openclaw_no_logueado'
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
    const mode = normalizeRecommendedMode(options.mode);
    const transport =
        String(options.transport || '')
            .trim()
            .toLowerCase() === 'web_broker'
            ? 'web_broker'
            : String(options.transport || '')
                    .trim()
                    .toLowerCase() === 'local_helper'
              ? 'local_helper'
              : '';
    const status = String(options.status || 'anonymous')
        .trim()
        .toLowerCase();
    const shouldRegenerateOpenClawChallenge =
        status === 'pending' ||
        status === 'openclaw_no_logueado' ||
        status === 'email_no_permitido' ||
        status === 'challenge_expirado' ||
        status === 'helper_no_disponible' ||
        status === 'identity_missing' ||
        status === 'identity_unverified' ||
        status === 'broker_claims_invalid' ||
        status === 'transport_misconfigured';
    const requires2FA =
        mode === 'legacy_password'
            ? Boolean(group && !group.classList.contains('is-hidden'))
            : false;

    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled =
            mode === CANONICAL_OPERATOR_AUTH_MODE ||
            Boolean(submitting) ||
            requires2FA;
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled =
            mode === CANONICAL_OPERATOR_AUTH_MODE ||
            Boolean(submitting) ||
            !requires2FA;
    }

    if (button instanceof HTMLButtonElement) {
        button.disabled = Boolean(submitting);
        if (mode === CANONICAL_OPERATOR_AUTH_MODE) {
            if (submitting) {
                button.textContent = 'Abriendo OpenClaw...';
            } else if (transport === 'web_broker' && status === 'pending') {
                button.textContent = 'Retomar OpenClaw';
            } else if (
                transport === 'web_broker' &&
                shouldRegenerateOpenClawChallenge
            ) {
                button.textContent = 'Reintentar en OpenClaw';
            } else if (shouldRegenerateOpenClawChallenge) {
                button.textContent = 'Generar nuevo codigo';
            } else {
                button.textContent = 'Continuar con OpenClaw';
            }
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
            mode === CANONICAL_OPERATOR_AUTH_MODE || !requires2FA
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
