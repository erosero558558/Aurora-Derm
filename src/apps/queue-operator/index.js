import { getState, subscribe, updateState } from '../admin-v3/shared/core/store.js';
import { hasFocusedInput, setText, createToast } from '../admin-v3/shared/ui/render.js';
import { createSurfaceHeartbeatClient } from '../queue-shared/surface-heartbeat.js';
import {
    checkAuthStatus,
    isOperatorAuthMode,
    loginWith2FA,
    loginWithPassword,
    logoutSession,
    pollOperatorAuthStatus,
    startOperatorAuth,
} from '../admin-v3/shared/modules/auth.js';
import { refreshAdminData, refreshStatusLabel } from '../admin-v3/shared/modules/data.js';
import {
    applyQueueRuntimeDefaults,
    hydrateQueueFromData,
    queueNumpadAction,
    renderQueueSection,
    refreshQueueState,
    setQueueFilter,
    setQueueSearch,
} from '../admin-v3/shared/modules/queue.js';
import {
    getActiveCalledTicketForStation,
    getWaitingForConsultorio,
} from '../admin-v3/shared/modules/queue/selectors.js';
import {
    dismissQueueSensitiveDialog,
    handleQueueAction,
} from '../admin-v3/core/boot/listeners/action-groups/queue.js';

const QUEUE_REFRESH_MS = 8000;
const OPERATOR_HEARTBEAT_MS = 15000;

let refreshIntervalId = 0;
let operatorHeartbeat = null;
let operatorAuthPollPromise = null;
const operatorRuntime = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    numpadSeen: false,
    lastNumpadCode: '',
    lastNumpadAt: '',
};

function getById(id) {
    return document.getElementById(id);
}

function resolveOperatorAppMode() {
    return typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null &&
        typeof window.turneroDesktop.openSettings === 'function'
        ? 'desktop'
        : 'web';
}

function resolveOperatorInstance() {
    const state = getState();
    if (state.queue.stationMode === 'locked') {
        return Number(state.queue.stationConsultorio || 1) === 2 ? 'c2' : 'c1';
    }
    return 'free';
}

function buildOperatorHeartbeatPayload() {
    const state = getState();
    const stationNumber = Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationKey = `c${stationNumber}`;
    const locked = state.queue.stationMode === 'locked';
    const stationLabel = locked ? `Operador C${stationNumber} fijo` : 'Operador modo libre';
    const readyForLiveUse = operatorRuntime.online && operatorRuntime.numpadSeen;
    const status = !operatorRuntime.online
        ? 'alert'
        : readyForLiveUse
          ? 'ready'
          : 'warning';
    const summary = !operatorRuntime.online
        ? 'Equipo sin red; recupera conectividad antes de operar.'
        : readyForLiveUse
          ? `Equipo listo para operar en ${locked ? `C${stationNumber} fijo` : 'modo libre'}.`
          : 'Falta validar el numpad antes del primer llamado.';

    return {
        instance: resolveOperatorInstance(),
        deviceLabel: stationLabel,
        appMode: resolveOperatorAppMode(),
        status,
        summary,
        networkOnline: operatorRuntime.online,
        lastEvent: operatorRuntime.numpadSeen ? 'numpad_detected' : 'heartbeat',
        lastEventAt: operatorRuntime.lastNumpadAt || new Date().toISOString(),
        details: {
            station: stationKey,
            stationMode: locked ? 'locked' : 'free',
            oneTap: Boolean(state.queue.oneTap),
            numpadSeen: Boolean(operatorRuntime.numpadSeen),
            lastNumpadCode: String(operatorRuntime.lastNumpadCode || ''),
            shellMode: resolveOperatorAppMode(),
        },
    };
}

function ensureOperatorHeartbeat() {
    if (operatorHeartbeat) {
        return operatorHeartbeat;
    }

    operatorHeartbeat = createSurfaceHeartbeatClient({
        surface: 'operator',
        intervalMs: OPERATOR_HEARTBEAT_MS,
        getPayload: buildOperatorHeartbeatPayload,
    });
    return operatorHeartbeat;
}

function syncOperatorHeartbeat(reason = 'state_change') {
    if (!getState().auth.authenticated) {
        operatorHeartbeat?.stop();
        return;
    }
    const heartbeat = ensureOperatorHeartbeat();
    heartbeat.notify(reason);
}

function setLoginStatus(state, title, message) {
    const card = getById('operatorLoginStatus');
    const titleNode = getById('operatorLoginStatusTitle');
    const messageNode = getById('operatorLoginStatusMessage');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', state);
    }
    if (titleNode) titleNode.textContent = title;
    if (messageNode) messageNode.textContent = message;
}

function setOperatorLoginMode(operatorMode) {
    const operatorFlow = getById('operatorOpenClawFlow');
    const legacyFields = getById('operatorLegacyLoginFields');

    if (operatorFlow instanceof HTMLElement) {
        operatorFlow.classList.toggle('is-hidden', !operatorMode);
    }
    if (legacyFields instanceof HTMLElement) {
        legacyFields.classList.toggle('is-hidden', operatorMode);
    }
}

function formatOperatorChallengeExpiry(challenge) {
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
    const expiresAt = formatOperatorChallengeExpiry(auth?.challenge);

    switch (status) {
        case 'pending':
            return {
                tone: 'warning',
                title: 'Esperando confirmación en OpenClaw',
                message:
                    'Completa el login de ChatGPT/OpenAI en la ventana abierta y el turnero se autenticará automáticamente.',
                summary:
                    'La misma sesión quedará disponible para operar el turnero sin usar clave local.',
                primaryLabel: 'Volver a abrir OpenClaw',
                helperMeta: expiresAt
                    ? `El challenge actual expira a las ${expiresAt}.`
                    : 'El challenge actual seguirá activo por unos minutos.',
                showRetry: true,
                showLinkHint: !helperOpened,
            };
        case 'openclaw_no_logueado':
            return {
                tone: 'warning',
                title: 'OpenClaw necesita tu sesión',
                message:
                    auth?.error ||
                    'OpenClaw no encontró un perfil OAuth válido en este equipo.',
                summary:
                    'Inicia sesión en OpenClaw con tu perfil autorizado y luego genera un nuevo enlace.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Cuando OpenClaw tenga sesión activa, el siguiente challenge debería autenticarse sin pedir clave.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'helper_no_disponible':
            return {
                tone: 'danger',
                title: 'No se pudo completar el bridge',
                message:
                    auth?.error ||
                    'El helper local de OpenClaw no respondió desde este equipo.',
                summary:
                    'Verifica que el bridge local siga vivo antes de volver a generar el challenge.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Si el helper fue reiniciado, genera un challenge nuevo.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'challenge_expirado':
            return {
                tone: 'warning',
                title: 'El enlace expiró',
                message:
                    auth?.error ||
                    'El challenge de OpenClaw expiró antes de completar la autenticación.',
                summary:
                    'Genera un nuevo enlace y termina el login sin cerrar esta pantalla.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'El nuevo challenge se abrirá en una ventana aparte para completar el acceso.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'email_no_permitido':
            return {
                tone: 'danger',
                title: 'Email no autorizado',
                message:
                    auth?.error ||
                    'La cuenta autenticada en OpenClaw no está autorizada para operar este turnero.',
                summary:
                    'Cierra esa sesión en OpenClaw y vuelve a intentar con un correo permitido.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'El próximo intento usará un challenge nuevo para otro perfil.',
                showRetry: true,
                showLinkHint: true,
            };
        case 'operator_auth_not_configured':
            return {
                tone: 'danger',
                title: 'OpenClaw no está configurado',
                message:
                    auth?.error ||
                    'Falta configuración del bridge local para completar el acceso.',
                summary:
                    'Corrige la configuración antes de volver a generar un enlace.',
                primaryLabel: 'Reintentar',
                helperMeta:
                    'Cuando la configuración vuelva a estar disponible, podrás crear un challenge nuevo.',
                showRetry: true,
                showLinkHint: false,
            };
        default:
            return {
                tone: 'neutral',
                title: 'Acceso protegido',
                message:
                    'Abre OpenClaw para validar la sesión del turnero sin usar una clave local.',
                summary:
                    'La sesión quedará compartida con el panel administrativo.',
                primaryLabel: 'Abrir OpenClaw',
                helperMeta:
                    'Si el navegador bloquea la ventana, podrás usar el enlace manual.',
                showRetry: false,
                showLinkHint: true,
            };
    }
}

function syncOperatorLoginSurface(auth = getState().auth) {
    const operatorMode = isOperatorAuthMode(auth);
    const openButton = getById('operatorOpenClawBtn');
    const retryButton = getById('operatorOpenClawRetryBtn');
    const summaryNode = getById('operatorOpenClawSummary');
    const helperMeta = getById('operatorOpenClawHelperMeta');
    const helperLink = getById('operatorOpenClawHelperLink');
    const helperLinkRow = getById('operatorOpenClawLinkRow');
    const manualRow = getById('operatorOpenClawManualRow');
    const manualCode = getById('operatorOpenClawManualCode');

    setOperatorLoginMode(operatorMode);

    if (!operatorMode) {
        setLoginStatus(
            auth.requires2FA ? 'warning' : 'neutral',
            auth.requires2FA ? 'Código 2FA requerido' : 'Acceso protegido',
            auth.requires2FA
                ? 'La contraseña fue validada. Ingresa ahora el código de seis dígitos.'
                : 'Inicia sesión para abrir la consola operativa del turnero.'
        );
        return;
    }

    show2FA(false);
    resetLoginForm();

    const copy = resolveOperatorAuthCopy(auth);
    const challenge = auth?.challenge || null;
    const helperUrl = String(challenge?.helperUrl || '').trim();
    const manualValue = String(challenge?.manualCode || '').trim();

    setLoginStatus(copy.tone, copy.title, copy.message);

    if (summaryNode) {
        summaryNode.textContent = copy.summary;
    }
    if (helperMeta) {
        helperMeta.textContent = copy.helperMeta;
    }
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
    if (helperLinkRow instanceof HTMLElement) {
        helperLinkRow.classList.toggle(
            'is-hidden',
            helperUrl === '' && !copy.showLinkHint
        );
        if (helperUrl === '' && copy.showLinkHint) {
            helperLinkRow.classList.remove('is-hidden');
        }
    }
    if (manualCode) {
        manualCode.textContent = manualValue;
    }
    if (manualRow instanceof HTMLElement) {
        manualRow.classList.toggle('is-hidden', manualValue === '');
    }
}

function setSubmitting(submitting) {
    const loginButton = getById('operatorLoginBtn');
    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    const openClawButton = getById('operatorOpenClawBtn');
    const retryClawButton = getById('operatorOpenClawRetryBtn');
    const operatorMode = isOperatorAuthMode(getState().auth);

    if (loginButton instanceof HTMLButtonElement) {
        loginButton.disabled = submitting;
        loginButton.textContent = submitting ? 'Validando...' : 'Ingresar';
    }
    if (passwordInput instanceof HTMLInputElement) {
        passwordInput.disabled = submitting || operatorMode;
    }
    if (codeInput instanceof HTMLInputElement) {
        codeInput.disabled = submitting || operatorMode;
    }
    if (openClawButton instanceof HTMLButtonElement) {
        const idleLabel = String(
            openClawButton.dataset.idleLabel || 'Abrir OpenClaw'
        );
        openClawButton.disabled = submitting;
        openClawButton.textContent = submitting ? 'Preparando...' : idleLabel;
    }
    if (retryClawButton instanceof HTMLButtonElement) {
        retryClawButton.disabled = submitting;
    }
}

function show2FA(required) {
    const group = getById('operator2FAGroup');
    const resetButton = getById('operatorReset2FABtn');
    if (group instanceof HTMLElement) {
        group.classList.toggle('is-hidden', !required);
    }
    if (resetButton instanceof HTMLElement) {
        resetButton.classList.toggle('is-hidden', !required);
    }
}

function resetLoginForm({ clearPassword = false } = {}) {
    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    if (passwordInput instanceof HTMLInputElement && clearPassword) {
        passwordInput.value = '';
    }
    if (codeInput instanceof HTMLInputElement) {
        codeInput.value = '';
    }
}

function focusLoginField(target = 'password') {
    const id =
        target === '2fa'
            ? 'operator2FACode'
            : target === 'operator_auth'
              ? 'operatorOpenClawBtn'
              : 'operatorPassword';
    const input = getById(id);
    if (
        input instanceof HTMLInputElement ||
        input instanceof HTMLButtonElement
    ) {
        window.setTimeout(() => input.focus(), 20);
    }
}

function humanizeCallKeyLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return 'Numpad Enter';
    }
    return raw
        .replace(/^NumpadEnter$/i, 'Numpad Enter')
        .replace(/^NumpadDecimal$/i, 'Numpad Decimal')
        .replace(/^NumpadSubtract$/i, 'Numpad Subtract');
}

function setReadinessCheck(id, state, detail) {
    const node = getById(id);
    if (!(node instanceof HTMLElement)) {
        return;
    }

    const card = node.closest('.queue-operator-readiness-check');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', state);
    }
    node.textContent = detail;
}

function updateOperatorReadiness() {
    const state = getState();
    const stationLabel = `C${Number(state.queue.stationConsultorio || 1)} ${
        state.queue.stationMode === 'locked' ? 'fijo' : 'libre'
    }`;
    const routeSummary = `${stationLabel} · ${
        state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF'
    }`;
    const networkSummary = operatorRuntime.online
        ? 'Sesión activa y red en línea'
        : 'Equipo sin red; no conviene operar así';
    const shellSummary =
        typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null &&
        typeof window.turneroDesktop.openSettings === 'function'
            ? 'App desktop instalada'
            : 'Fallback web activo';
    const numpadSummary = operatorRuntime.numpadSeen
        ? `Detectado ${humanizeCallKeyLabel(operatorRuntime.lastNumpadCode)}`
        : 'Presiona una tecla del bloque numérico';

    setReadinessCheck('operatorReadyRoute', 'ready', routeSummary);
    setReadinessCheck(
        'operatorReadyNetwork',
        operatorRuntime.online ? 'ready' : 'danger',
        networkSummary
    );
    setReadinessCheck(
        'operatorReadyShell',
        typeof window.turneroDesktop === 'object' &&
            window.turneroDesktop !== null &&
            typeof window.turneroDesktop.openSettings === 'function'
            ? 'ready'
            : 'warning',
        shellSummary
    );
    setReadinessCheck(
        'operatorReadyNumpad',
        operatorRuntime.numpadSeen ? 'ready' : 'warning',
        numpadSummary
    );

    const readinessTitle = getById('operatorReadinessTitle');
    const readinessSummary = getById('operatorReadinessSummary');
    const hasDanger = !operatorRuntime.online;
    const readyForLiveUse = operatorRuntime.online && operatorRuntime.numpadSeen;

    if (readinessTitle) {
        readinessTitle.textContent = hasDanger
            ? 'Conexión pendiente'
            : readyForLiveUse
              ? 'Equipo listo para operar'
              : 'Falta probar el numpad';
    }

    if (readinessSummary) {
        readinessSummary.textContent = hasDanger
            ? 'Recupera la conexión antes de llamar o completar tickets.'
            : readyForLiveUse
              ? 'La ruta, la sesión y el numpad ya respondieron. Puedes pasar al primer llamado real.'
              : 'Presiona una tecla del Genius Numpad 1000 para validar el receptor USB antes del primer llamado real.';
    }
}

function noteNumpadActivity(event) {
    const code = String(event?.code || '').trim();
    if (!code.startsWith('Numpad')) {
        return;
    }

    operatorRuntime.numpadSeen = true;
    operatorRuntime.lastNumpadCode = code;
    operatorRuntime.lastNumpadAt = new Date().toISOString();
    syncOperatorHeartbeat('numpad');
}

function updateOperatorActionGuide() {
    const state = getState();
    const activeTicket = getActiveCalledTicketForStation();
    const waitingTicket = getWaitingForConsultorio(
        Number(state.queue.stationConsultorio || 1)
    );
    const pendingAction = state.queue.pendingSensitiveAction;

    let title = 'Listo para llamar';
    let summary =
        'Pulsa Numpad Enter para llamar el siguiente ticket del consultorio activo.';

    if (pendingAction && pendingAction.action) {
        const actionLabel =
            pendingAction.action === 'completed'
                ? 'completar'
                : pendingAction.action === 'no_show'
                  ? 'marcar no show'
                  : pendingAction.action;
        title = `Confirmar ${actionLabel}`;
        summary =
            'Revisa el diálogo sensible y confirma o cancela antes de seguir con otro ticket.';
    } else if (activeTicket && activeTicket.ticketCode) {
        title = `Ticket ${activeTicket.ticketCode} en curso`;
        summary =
            'Usa + para re-llamar, . para preparar completar y - para preparar no show.';
    } else if (waitingTicket && waitingTicket.ticketCode) {
        title = `Siguiente: ${waitingTicket.ticketCode}`;
        summary = `Pulsa Numpad Enter para llamar ${waitingTicket.ticketCode} en C${Number(
            state.queue.stationConsultorio || 1
        )}.`;
    } else {
        title = 'Sin tickets en espera';
        summary =
            'Mantén el equipo listo y usa Refrescar si esperas nuevos turnos o check-ins.';
    }

    setText('#operatorActionTitle', title);
    setText('#operatorActionSummary', summary);
}

function syncShellSettingsButton() {
    const button = getById('operatorAppSettingsBtn');
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    const canOpenSettings =
        typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null &&
        typeof window.turneroDesktop.openSettings === 'function';

    button.classList.toggle('is-hidden', !canOpenSettings);
}

function updateOperatorChrome() {
    const state = getState();
    const stationLabel = `C${Number(state.queue.stationConsultorio || 1)} ${
        state.queue.stationMode === 'locked' ? 'bloqueado' : 'libre'
    }`;
    const oneTapLabel = state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF';
    const callKey = state.queue.customCallKey
        ? String(state.queue.customCallKey.code || state.queue.customCallKey.key || 'tecla externa')
        : 'Numpad Enter';

    setText('#operatorStationSummary', stationLabel);
    setText('#operatorOneTapSummary', `${oneTapLabel} · ${refreshStatusLabel()}`);
    setText('#operatorCallKeySummary', humanizeCallKeyLabel(callKey));
    renderQueueSection();
    updateOperatorActionGuide();
    updateOperatorReadiness();
    syncOperatorHeartbeat('render');
}

function mountAuthenticatedView() {
    getById('operatorLoginView')?.classList.add('is-hidden');
    getById('operatorApp')?.classList.remove('is-hidden');
}

function mountLoggedOutView() {
    getById('operatorApp')?.classList.add('is-hidden');
    getById('operatorLoginView')?.classList.remove('is-hidden');
}

function stopRefreshLoop() {
    if (refreshIntervalId) {
        window.clearInterval(refreshIntervalId);
        refreshIntervalId = 0;
    }
}

function startRefreshLoop() {
    stopRefreshLoop();
    refreshIntervalId = window.setInterval(() => {
        void refreshQueueState();
    }, QUEUE_REFRESH_MS);
}

async function bootAuthenticatedSurface(showToast = false) {
    mountAuthenticatedView();
    const ok = await refreshAdminData();
    await hydrateQueueFromData();
    ensureOperatorHeartbeat().start({ immediate: false });
    updateOperatorChrome();
    startRefreshLoop();
    if (showToast) {
        createToast(ok ? 'Operador conectado' : 'Operador cargado con respaldo local', ok ? 'success' : 'warning');
    }
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
            syncOperatorLoginSurface(snapshot);
        },
    })
        .then(async (snapshot) => {
            operatorAuthPollPromise = null;
            syncOperatorLoginSurface(snapshot);
            if (snapshot.authenticated) {
                await bootAuthenticatedSurface(true);
            }
            return snapshot;
        })
        .catch((error) => {
            operatorAuthPollPromise = null;
            setLoginStatus(
                'danger',
                'No se pudo iniciar sesión',
                error?.message ||
                    'No se pudo consultar el estado del login OpenClaw.'
            );
            createToast(
                error?.message ||
                    'No se pudo consultar el estado de OpenClaw',
                'error'
            );
            return getState().auth;
        });

    return operatorAuthPollPromise;
}

async function startOperatorAuthFlow(forceNew = false) {
    try {
        setSubmitting(true);
        setLoginStatus(
            'neutral',
            forceNew ? 'Generando nuevo enlace' : 'Abriendo OpenClaw',
            'Preparando el challenge local para validar la sesión del turnero.'
        );

        const snapshot = await startOperatorAuth({
            forceNew,
            openHelper: true,
        });
        syncOperatorLoginSurface(snapshot);

        if (snapshot.authenticated) {
            await bootAuthenticatedSurface(true);
            return snapshot;
        }

        if (String(snapshot.status || '') === 'pending') {
            createToast(
                snapshot.helperUrlOpened
                    ? 'OpenClaw listo para confirmar'
                    : 'Usa el enlace manual de OpenClaw si la ventana no se abrió',
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
        setLoginStatus(
            'danger',
            'No se pudo iniciar sesión',
            error?.message ||
                'No se pudo abrir el flujo OpenClaw para este turnero.'
        );
        createToast(
            error?.message || 'No se pudo abrir el flujo OpenClaw',
            'error'
        );
        return getState().auth;
    } finally {
        setSubmitting(false);
    }
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    if (isOperatorAuthMode(getState().auth)) {
        await startOperatorAuthFlow(false);
        return;
    }

    const passwordInput = getById('operatorPassword');
    const codeInput = getById('operator2FACode');
    const password =
        passwordInput instanceof HTMLInputElement ? passwordInput.value : '';
    const code = codeInput instanceof HTMLInputElement ? codeInput.value : '';
    const state = getState();

    try {
        setSubmitting(true);
        setLoginStatus(
            state.auth.requires2FA ? 'warning' : 'neutral',
            state.auth.requires2FA ? 'Validando segundo factor' : 'Validando credenciales',
            state.auth.requires2FA
                ? 'Comprobando el código 2FA antes de abrir la consola operativa.'
                : 'Comprobando tu sesión de operador.'
        );

        if (state.auth.requires2FA) {
            await loginWith2FA(code);
        } else {
            const result = await loginWithPassword(password);
            if (result.requires2FA) {
                show2FA(true);
                setLoginStatus(
                    'warning',
                    'Código 2FA requerido',
                    'La contraseña fue validada. Ingresa ahora el código de seis dígitos.'
                );
                focusLoginField('2fa');
                return;
            }
        }

        show2FA(false);
        resetLoginForm({ clearPassword: true });
        setLoginStatus(
            'success',
            'Acceso concedido',
            'Sesión autenticada. Cargando la operación diaria.'
        );
        await bootAuthenticatedSurface(true);
    } catch (error) {
        setLoginStatus(
            'danger',
            'No se pudo iniciar sesión',
            error?.message || 'Verifica la clave o el código 2FA.'
        );
        focusLoginField(getState().auth.requires2FA ? '2fa' : 'password');
        createToast(error?.message || 'No se pudo iniciar sesión', 'error');
    } finally {
        setSubmitting(false);
    }
}

function resetTwoFactorStage() {
    show2FA(false);
    resetLoginForm();
    updateState((state) => ({
        ...state,
        auth: {
            ...state.auth,
            requires2FA: false,
        },
    }));
    setLoginStatus(
        'neutral',
        'Acceso protegido',
        'Volviste al paso de contraseña.'
    );
    focusLoginField('password');
}

async function handleDocumentClick(event) {
    const actionNode =
        event.target instanceof Element
            ? event.target.closest(
                  '[data-action], #operatorLogoutBtn, #operatorReset2FABtn, #operatorAppSettingsBtn, #operatorOpenClawBtn, #operatorOpenClawRetryBtn'
              )
            : null;

    if (!actionNode) {
        return;
    }

    if (actionNode.id === 'operatorLogoutBtn') {
        event.preventDefault();
        stopRefreshLoop();
        operatorHeartbeat?.stop();
        await logoutSession();
        mountLoggedOutView();
        resetLoginForm({ clearPassword: true });
        show2FA(false);
        syncOperatorLoginSurface(getState().auth);
        createToast('Sesión cerrada', 'info');
        focusLoginField(
            isOperatorAuthMode(getState().auth) ? 'operator_auth' : 'password'
        );
        return;
    }

    if (actionNode.id === 'operatorAppSettingsBtn') {
        event.preventDefault();
        if (
            typeof window.turneroDesktop === 'object' &&
            window.turneroDesktop !== null &&
            typeof window.turneroDesktop.openSettings === 'function'
        ) {
            await window.turneroDesktop.openSettings();
        }
        return;
    }

    if (actionNode.id === 'operatorReset2FABtn') {
        event.preventDefault();
        resetTwoFactorStage();
        return;
    }

    if (actionNode.id === 'operatorOpenClawBtn') {
        event.preventDefault();
        await startOperatorAuthFlow(false);
        return;
    }

    if (actionNode.id === 'operatorOpenClawRetryBtn') {
        event.preventDefault();
        await startOperatorAuthFlow(true);
        return;
    }

    const action = String(actionNode.getAttribute('data-action') || '');
    if (!action) {
        return;
    }

    event.preventDefault();

    if (action === 'close-toast') {
        actionNode.closest('.toast')?.remove();
        return;
    }

    await handleQueueAction(action, actionNode);
    updateOperatorChrome();
}

function handleDocumentInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
        return;
    }

    if (target.id === 'queueSearchInput') {
        setQueueSearch(target.value);
        updateOperatorChrome();
    }
}

function handleFilterClick(event) {
    const button =
        event.target instanceof Element
            ? event.target.closest('[data-queue-filter]')
            : null;
    if (!(button instanceof HTMLElement)) {
        return;
    }

    event.preventDefault();
    const filter = String(button.getAttribute('data-queue-filter') || 'all');
    setQueueFilter(filter);
    updateOperatorChrome();
}

function attachKeyboardBridge() {
    document.addEventListener('keydown', async (event) => {
        if (!getState().auth.authenticated) {
            return;
        }

        if (event.key === 'Escape' && dismissQueueSensitiveDialog()) {
            event.preventDefault();
            updateOperatorChrome();
            return;
        }

        if (hasFocusedInput()) {
            return;
        }

        noteNumpadActivity(event);
        await queueNumpadAction({
            key: event.key,
            code: event.code,
            location: event.location,
        });
        updateOperatorChrome();
    });
}

function attachVisibilityRefresh() {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && getState().auth.authenticated) {
            void refreshQueueState().then(() => updateOperatorChrome());
        }
    });

    window.addEventListener('online', () => {
        operatorRuntime.online = true;
        if (getState().auth.authenticated) {
            void refreshQueueState().then(() => updateOperatorChrome());
        }
    });

    window.addEventListener('offline', () => {
        operatorRuntime.online = false;
        if (getState().auth.authenticated) {
            updateOperatorChrome();
        }
    });
}

async function boot() {
    applyQueueRuntimeDefaults();
    syncShellSettingsButton();
    subscribe(() => {
        if (getState().auth.authenticated) {
            updateOperatorChrome();
        }
    });

    document.addEventListener('click', (event) => {
        void handleDocumentClick(event);
    });
    document.addEventListener('click', handleFilterClick);
    document.addEventListener('input', handleDocumentInput);
    attachKeyboardBridge();
    attachVisibilityRefresh();

    const loginForm = getById('operatorLoginForm');
    if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener('submit', (event) => {
            void handleLoginSubmit(event);
        });
    }

    const auth = await checkAuthStatus();
    if (auth.authenticated) {
        await bootAuthenticatedSurface();
        return;
    }

    mountLoggedOutView();
    syncOperatorLoginSurface(auth);
    focusLoginField(isOperatorAuthMode(auth) ? 'operator_auth' : 'password');
    if (isOperatorAuthMode(auth) && String(auth.status || '') === 'pending') {
        void ensureOperatorAuthPolling();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void boot();
    });
} else {
    void boot();
}
