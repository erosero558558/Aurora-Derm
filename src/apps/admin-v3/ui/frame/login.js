import { qs } from '../../shared/ui/render.js';

function normalizeRecommendedMode(mode = 'legacy_password') {
    return String(mode || '')
        .trim()
        .toLowerCase() === 'openclaw_chatgpt'
        ? 'openclaw_chatgpt'
        : 'legacy_password';
}

function normalizeTransport(transport = '') {
    const raw = String(transport || '')
        .trim()
        .toLowerCase();
    if (raw === 'web_broker') {
        return 'web_broker';
    }
    if (raw === 'local_helper') {
        return 'local_helper';
    }
    return '';
}

function syncContingencyActions({
    mode = 'legacy_password',
    recommendedMode = 'legacy_password',
    transport = '',
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
                ? 'Esta pantalla esta en contingencia. Cuando OpenClaw vuelva a estar disponible, regrese a la via principal.'
                : normalizeTransport(transport) === 'web_broker'
                  ? 'Si la redireccion web falla y el backend mantiene la contingencia activa, podra entrar con clave + 2FA.'
                  : normalizeTransport(transport) === 'local_helper'
                    ? 'Si este equipo no logra abrir el helper local y el backend mantiene la contingencia activa, podra entrar con clave + 2FA.'
                    : 'El runtime debe exponer un transport valido antes de habilitar OpenClaw o la contingencia.';
    }
}

function setLoginRouteCard({
    eyebrow = 'Via activa',
    title = 'OpenClaw en este equipo',
    message = 'El operador entra desde este laptop y confirma la identidad con OpenClaw.',
} = {}) {
    const eyebrowEl = qs('#adminLoginRouteEyebrow');
    const titleEl = qs('#adminLoginRouteTitle');
    const messageEl = qs('#adminLoginRouteMessage');

    if (eyebrowEl) eyebrowEl.textContent = eyebrow;
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
}

function setLoginNextStep(
    message = 'Use la via recomendada para abrir el admin.'
) {
    const support = qs('#adminLoginSupportCopy');
    if (support) {
        support.textContent = message;
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
    const transport = normalizeTransport(options.transport || '');
    const fallbackAvailable = options.fallbackAvailable === true;
    const openClawPrimary = recommendedMode === 'openclaw_chatgpt';
    const legacyStage = qs('#legacyLoginStage');
    const openclawStage = qs('#openclawLoginStage');
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
        transport,
        fallbackAvailable,
    });

    if (normalized === 'openclaw_chatgpt') {
        if (transport === 'web_broker') {
            setLoginRouteCard({
                eyebrow: 'Via activa',
                title: 'OpenClaw en navegador',
                message:
                    'El operador continua en esta misma pestana. No hace falta helper local ni codigo manual.',
            });
            setLoginNextStep(
                'Presione el boton principal para continuar con OpenClaw en esta misma pestana. Si el intento ya estaba abierto, puede retomarlo sin empezar de cero.'
            );
        } else if (transport === 'local_helper') {
            setLoginRouteCard({
                eyebrow: 'Via activa',
                title: 'OpenClaw en este equipo',
                message:
                    'El operador entra desde este laptop. Al continuar, OpenClaw abre el helper local y confirma la identidad con un codigo temporal.',
            });
            setLoginNextStep(
                'Presione el boton principal para abrir OpenClaw en este equipo. Cuando aparezca el codigo temporal, confirmelo en el helper local y vuelva a esta pantalla.'
            );
        } else {
            setLoginRouteCard({
                eyebrow: 'Diagnostico',
                title: 'Runtime de OpenClaw desalineado',
                message:
                    'Este entorno no publico un transport valido para OpenClaw. Bloqueamos el helper local para evitar abrir localhost por error.',
            });
            setLoginNextStep(
                'Vuelva a desplegar el runtime o corrija la configuracion de auth hasta que el backend publique transport=web_broker o transport=local_helper.'
            );
        }
        return;
    }

    if (openClawPrimary) {
        setLoginRouteCard({
            eyebrow: 'Via excepcional',
            title: 'Clave + 2FA solo como contingencia',
            message:
                'Use esta ruta solo si OpenClaw no esta disponible y el backend ya habilito la contingencia para este entorno.',
        });
        setLoginNextStep(
            'Ingrese la clave de contingencia. Si el backend la valida, el codigo 2FA aparecera aqui mismo para terminar el acceso.'
        );
        return;
    }

    setLoginRouteCard({
        eyebrow: 'Via activa',
        title: 'Clave de acceso',
        message:
            'Este entorno entra con clave y, si aplica, con 2FA en esta misma tarjeta.',
    });
    setLoginNextStep(
        'Ingrese la clave para abrir el admin. Si el backend pide un segundo factor, lo vera en esta misma pantalla.'
    );
}

export function setLogin2FAVisibility(visible, options = {}) {
    const group = qs('#group2FA');
    const resetBtn = qs('#loginReset2FABtn');
    const form = qs('#loginForm');
    const recommendedMode = normalizeRecommendedMode(
        options.recommendedMode || 'legacy_password'
    );
    const transport = normalizeTransport(options.transport || '');
    const fallbackAvailable = options.fallbackAvailable === true;
    const openClawPrimary = recommendedMode === 'openclaw_chatgpt';

    if (!group) return;

    group.classList.toggle('is-hidden', !visible);
    form?.classList.toggle('is-2fa-stage', Boolean(visible));
    resetBtn?.classList.toggle('is-hidden', !visible);
    syncContingencyActions({
        mode: 'legacy_password',
        recommendedMode,
        transport,
        fallbackAvailable,
    });

    if (visible) {
        if (openClawPrimary) {
            setLoginRouteCard({
                eyebrow: 'Via excepcional',
                title: '2FA de contingencia',
                message:
                    'La clave de contingencia ya fue validada. Falta confirmar el codigo de seis digitos para cerrar el acceso.',
            });
            setLoginNextStep(
                'Ingrese el codigo 2FA de seis digitos para terminar la contingencia. Cuando OpenClaw vuelva, regrese a la via principal.'
            );
        } else {
            setLoginRouteCard({
                eyebrow: 'Paso actual',
                title: 'Confirmacion 2FA',
                message:
                    'La clave ya fue validada. Falta el codigo de seis digitos para terminar el acceso.',
            });
            setLoginNextStep(
                'Ingrese el codigo 2FA para completar el acceso al admin.'
            );
        }
    } else if (openClawPrimary) {
        setLoginRouteCard({
            eyebrow: 'Via excepcional',
            title: 'Clave + 2FA solo como contingencia',
            message:
                'Use esta ruta solo si OpenClaw no esta disponible y el backend ya habilito la contingencia para este entorno.',
        });
        setLoginNextStep(
            'Ingrese la clave de contingencia. Si el backend la valida, el codigo 2FA aparecera aqui mismo para terminar el acceso.'
        );
    } else {
        setLoginRouteCard({
            eyebrow: 'Via activa',
            title: 'Clave de acceso',
            message:
                'Este entorno entra con clave y, si aplica, con 2FA en esta misma tarjeta.',
        });
        setLoginNextStep(
            'Ingrese la clave para abrir el admin. Si el backend pide un segundo factor, lo vera en esta misma pantalla.'
        );
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
    const transport = normalizeTransport(options.transport || '');
    const status = String(options.status || 'anonymous')
        .trim()
        .toLowerCase();
    const error = String(options.error || '').trim();

    if (!(challengeCard instanceof HTMLElement)) {
        return;
    }

    if (
        transport === 'web_broker' ||
        !challenge ||
        typeof challenge !== 'object'
    ) {
        challengeCard.classList.add('is-hidden');
        if (manualCode) manualCode.textContent = '-';
        if (meta) {
            meta.textContent =
                transport === 'web_broker'
                    ? status === 'pending'
                        ? 'El intento web sigue activo. Puede retomarlo desde esta misma pantalla.'
                        : 'La redireccion a OpenClaw se abre en esta misma pestana cuando inicie el flujo.'
                    : status === 'openclaw_no_logueado'
                      ? 'Primero abra su sesion de OpenClaw en este equipo y luego genere el codigo temporal.'
                      : 'Cuando inicie el flujo, el codigo temporal aparecera aqui.';
        }
        if (helperLink instanceof HTMLAnchorElement) {
            helperLink.href = '#';
            helperLink.classList.add('is-hidden');
        }
        if (introTitle) {
            introTitle.textContent =
                transport === 'web_broker'
                    ? 'Entrada por navegador'
                    : transport === 'local_helper'
                      ? 'Entrada en este equipo'
                      : 'Runtime sin transporte valido';
        }
        if (introMessage) {
            introMessage.textContent =
                transport === 'web_broker'
                    ? status === 'pending'
                        ? 'OpenClaw dejo este intento pendiente. Puede retomarlo desde el boton principal sin generar otro inicio.'
                        : 'Esta ruta redirige en la misma pestana y no usa helper local ni codigo manual.'
                    : transport === 'local_helper'
                      ? status === 'openclaw_no_logueado'
                          ? 'Abra su sesion de OpenClaw en este equipo y vuelva a intentar el acceso.'
                          : 'Esta ruta usa el helper local de este equipo para confirmar la identidad del operador.'
                      : 'El backend no devolvio un transport valido para OpenClaw. Corrija el runtime antes de reintentar.';
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
                    ? `Codigo temporal activo. Expira a las ${expiresAt}.`
                    : 'Codigo temporal activo. Confirmelo desde el helper local.'
                : error ||
                  (expiresAt
                      ? `Ultimo codigo emitido. Expiraba a las ${expiresAt}.`
                      : 'Ultimo codigo emitido para este equipo.');
    }
    if (helperLink instanceof HTMLAnchorElement) {
        const href = String(challenge.helperUrl || '').trim();
        helperLink.href = href || '#';
        helperLink.classList.toggle('is-hidden', !href);
    }
    if (introTitle) {
        introTitle.textContent =
            status === 'pending'
                ? 'Codigo listo para confirmar'
                : 'Entrada en este equipo';
    }
    if (introMessage) {
        introMessage.textContent =
            status === 'pending'
                ? 'Confirme el codigo en el helper local y deje esta pantalla abierta hasta terminar el acceso.'
                : 'Si el intento anterior no sirvio, puede generar otro codigo temporal desde el boton principal.';
    }
}

export function setLoginFeedback({
    tone = 'neutral',
    title = 'Estado del acceso',
    message = 'Todavia no hay un intento en curso. Use la via recomendada para abrir el admin.',
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
    const transport = normalizeTransport(options.transport || '');
    const status = String(options.status || 'anonymous')
        .trim()
        .toLowerCase();
    const shouldRetryOpenClaw =
        transport === 'web_broker'
            ? status === 'openclaw_no_logueado' ||
              status === 'email_no_permitido' ||
              status === 'cancelled' ||
              status === 'invalid_state' ||
              status === 'broker_unavailable' ||
              status === 'code_exchange_failed' ||
              status === 'identity_missing' ||
              status === 'identity_unverified' ||
              status === 'broker_claims_invalid' ||
              status === 'transport_misconfigured'
            : status === 'openclaw_no_logueado' ||
              status === 'email_no_permitido' ||
              status === 'challenge_expirado' ||
              status === 'helper_no_disponible' ||
              status === 'cancelled' ||
              status === 'invalid_state' ||
              status === 'broker_unavailable' ||
              status === 'code_exchange_failed' ||
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
            mode === 'openclaw_chatgpt' || Boolean(submitting) || requires2FA;
    }

    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled =
            mode === 'openclaw_chatgpt' || Boolean(submitting) || !requires2FA;
    }

    if (button instanceof HTMLButtonElement) {
        button.disabled = Boolean(submitting);
        if (mode === 'openclaw_chatgpt') {
            button.textContent =
                transport === 'web_broker'
                    ? submitting
                        ? 'Redirigiendo...'
                        : status === 'pending'
                          ? 'Retomar OpenClaw'
                          : shouldRetryOpenClaw
                            ? 'Reintentar en OpenClaw'
                            : 'Continuar con OpenClaw'
                    : transport === 'local_helper'
                      ? submitting
                          ? 'Abriendo helper...'
                          : status === 'pending'
                            ? 'Abrir helper otra vez'
                            : shouldRetryOpenClaw
                              ? 'Generar nuevo codigo'
                              : 'Continuar con OpenClaw'
                      : shouldRetryOpenClaw
                        ? 'Revisar runtime'
                        : 'OpenClaw no disponible';
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
