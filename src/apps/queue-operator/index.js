import {
    getState,
    subscribe,
    updateState,
} from '../admin-v3/shared/core/store.js';
import {
    hasFocusedInput,
    setText,
    createToast,
} from '../admin-v3/shared/ui/render.js';
import { createSurfaceHeartbeatClient } from '../queue-shared/surface-heartbeat.js';
import { buildOperatorSurfaceState } from '../queue-shared/turnero-runtime-contract.mjs';
import {
    createEmptyOperatorShellState as createEmptyShellState,
    getOperatorShellMetaLabel as getShellMetaLabel,
    getOperatorShellModeLabel as getShellModeLabel,
    getOperatorShellReadiness as getShellReadiness,
    getOperatorShellSettingsButtonCopy,
    getOperatorShellSupportLabel as getShellSupportLabel,
    hydrateOperatorShellState,
} from './shell-state.mjs';
import { buildOperatorHeartbeatPayload as buildHeartbeatPayload } from './heartbeat-payload.mjs';
import {
    checkAuthStatus,
    isOperatorAuthMode,
    loginWith2FA,
    loginWithPassword,
    logoutSession,
    pollOperatorAuthStatus,
    startOperatorAuth,
} from '../admin-v3/shared/modules/auth.js';
import {
    refreshAdminData,
    refreshStatusLabel,
} from '../admin-v3/shared/modules/data.js';
import {
    applyQueueRuntimeDefaults,
    clearQueueCommandAdapter,
    hydrateQueueFromData,
    queueNumpadAction,
    renderQueueSection,
    refreshQueueState,
    setQueueCommandAdapter,
    setQueueFilter,
    setQueueSearch,
} from '../admin-v3/shared/modules/queue.js';
import { normalizeQueueAction } from '../admin-v3/shared/modules/queue/helpers.js';
import {
    getActiveCalledTicketForStation,
    getWaitingForConsultorio,
} from '../admin-v3/shared/modules/queue/selectors.js';
import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicShortName,
    getTurneroConsultorioLabel,
    getTurneroSurfaceContract,
    loadTurneroClinicProfile,
} from '../queue-shared/clinic-profile.js';
import {
    dismissQueueSensitiveDialog,
    handleQueueAction,
} from '../admin-v3/core/boot/listeners/action-groups/queue.js';
import {
    eventMatchesBinding,
    isNumpadAddEvent,
    isNumpadDecimalEvent,
    isNumpadEnterEvent,
    isNumpadSubtractEvent,
} from '../admin-v3/shared/modules/queue/runtime/numpad/index.js';
import { resolveOperatorQueueAdapter } from './queue-adapters.js';

const QUEUE_REFRESH_MS = 8000;
const OPERATOR_HEARTBEAT_MS = 15000;
const OPERATOR_PILOT_BLOCK_TOAST_COOLDOWN_MS = 2500;

let refreshIntervalId = 0;
let operatorHeartbeat = null;
let operatorAuthPollPromise = null;
let lastOperatorGuardToastAt = 0;
let lastOperatorGuardToastKey = '';

function initOperatorOpsTheme() {
    if (
        window.PielOpsTheme &&
        typeof window.PielOpsTheme.initAutoOpsTheme === 'function'
    ) {
        return window.PielOpsTheme.initAutoOpsTheme({
            surface: 'operator',
            family: 'command',
            mode: 'system',
        });
    }

    const tone = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
        ? 'dark'
        : 'light';
    document.documentElement.setAttribute('data-theme-mode', 'system');
    document.documentElement.setAttribute('data-theme', tone);
    document.documentElement.setAttribute('data-ops-tone', tone);
    document.documentElement.setAttribute('data-ops-family', 'command');
    if (document.body instanceof HTMLElement) {
        document.body.setAttribute('data-ops-tone', tone);
        document.body.setAttribute('data-ops-family', 'command');
    }

    return {
        surface: 'operator',
        family: 'command',
        mode: 'system',
        tone,
    };
}

function createEmptyNumpadValidationState() {
    return {
        bindingFingerprint: '',
        validatedActions: {
            call: false,
            recall: false,
            complete: false,
            noShow: false,
        },
        lastAction: '',
        lastCode: '',
        lastAt: '',
    };
}
const operatorRuntime = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    numpad: createEmptyNumpadValidationState(),
    shell: createEmptyShellState(),
    surfaceContract: null,
    pilotBlockToastAt: 0,
    shellRuntime: createEmptyShellRuntimeState(),
    shellRuntimeSnapshot: createEmptyShellRuntimeSnapshot(),
    queueAdapter: null,
    releaseBootStatusListener: null,
    releaseShellStatusListener: null,
};
let operatorClinicProfile = null;

function createEmptyShellRuntimeState() {
    return {
        connectivity: 'online',
        mode: 'live',
        offlineEnabled: false,
        snapshotAgeSec: null,
        outboxSize: 0,
        reconciliationSize: 0,
        lastSuccessfulSyncAt: '',
        updateChannel: 'stable',
        reason: 'connected',
    };
}

function createEmptyShellRuntimeSnapshot() {
    return {
        snapshot: null,
        outbox: [],
        reconciliation: [],
        hasAuthenticatedSession: false,
        lastAuthenticatedAt: '',
    };
}

function normalizeOperatorShellRuntime(status = {}) {
    const fallback = createEmptyShellRuntimeState();
    const mode = String(status?.mode || fallback.mode)
        .trim()
        .toLowerCase();
    const connectivity = String(status?.connectivity || fallback.connectivity)
        .trim()
        .toLowerCase();

    return {
        connectivity: connectivity === 'offline' ? 'offline' : 'online',
        mode: mode === 'offline' || mode === 'safe' ? mode : fallback.mode,
        offlineEnabled: status?.offlineEnabled === true,
        snapshotAgeSec: Number.isFinite(Number(status?.snapshotAgeSec))
            ? Number(status.snapshotAgeSec)
            : null,
        outboxSize: Math.max(0, Number(status?.outboxSize || 0) || 0),
        reconciliationSize: Math.max(
            0,
            Number(status?.reconciliationSize || 0) || 0
        ),
        lastSuccessfulSyncAt: String(status?.lastSuccessfulSyncAt || ''),
        updateChannel:
            String(status?.updateChannel || '')
                .trim()
                .toLowerCase() === 'pilot'
                ? 'pilot'
                : 'stable',
        reason: String(status?.reason || fallback.reason),
    };
}

function normalizeOperatorShellRuntimeSnapshot(snapshot = {}) {
    const fallback = createEmptyShellRuntimeSnapshot();
    return {
        snapshot:
            snapshot?.snapshot && typeof snapshot.snapshot === 'object'
                ? snapshot.snapshot
                : null,
        outbox: Array.isArray(snapshot?.outbox)
            ? snapshot.outbox
            : fallback.outbox,
        reconciliation: Array.isArray(snapshot?.reconciliation)
            ? snapshot.reconciliation
            : fallback.reconciliation,
        hasAuthenticatedSession: snapshot?.hasAuthenticatedSession === true,
        lastAuthenticatedAt: String(snapshot?.lastAuthenticatedAt || ''),
    };
}

function syncOperatorShellRuntime(status, snapshot = {}) {
    operatorRuntime.shellRuntime = normalizeOperatorShellRuntime(status);
    operatorRuntime.shellRuntimeSnapshot =
        normalizeOperatorShellRuntimeSnapshot(snapshot);
}

function getById(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getOperatorConsultorioShortLabel(consultorio) {
    return getTurneroConsultorioLabel(operatorClinicProfile, consultorio, {
        short: true,
    });
}

function renderOperatorProfileStatus(profile) {
    const surfaceContract = getOperatorSurfaceContract(profile);
    const profileFingerprint = getTurneroClinicProfileFingerprint(
        profile
    ).slice(0, 8);
    const state =
        surfaceContract.state === 'alert'
            ? 'danger'
            : surfaceContract.state === 'ready'
              ? 'success'
              : 'warning';
    const text =
        surfaceContract.state === 'alert'
            ? surfaceContract.reason === 'profile_missing'
                ? 'Bloqueado · perfil de respaldo · clinic-profile.json remoto ausente'
                : `Bloqueado · ruta fuera de canon · se esperaba ${surfaceContract.expectedRoute || '/operador-turnos.html'}`
            : `Perfil remoto verificado · firma ${profileFingerprint} · canon ${surfaceContract.expectedRoute || '/operador-turnos.html'}`;

    document
        .querySelectorAll('.queue-operator-profile-status')
        .forEach((node) => {
            if (!(node instanceof HTMLElement)) {
                return;
            }
            node.dataset.state = state;
            node.textContent = text;
        });
}

function getOperatorSurfaceContract(profile = operatorClinicProfile) {
    return (
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(profile, 'operator')
    );
}

function getOperatorPilotBlockDetail() {
    const surfaceContract = getOperatorSurfaceContract();
    if (surfaceContract.state !== 'alert') {
        return '';
    }

    if (surfaceContract.reason === 'profile_missing') {
        return 'No se puede operar este equipo: clinic-profile.json remoto ausente. Corrige el perfil y recarga la página antes de llamar tickets.';
    }

    return `No se puede operar este equipo: la ruta no coincide con el canon del piloto (${surfaceContract.expectedRoute || '/operador-turnos.html'}). Corrige el acceso antes de operar la cola.`;
}

function isOperatorPilotBlocked() {
    return getOperatorSurfaceContract().state === 'alert';
}

function notifyOperatorPilotBlocked() {
    const detail = getOperatorPilotBlockDetail();
    if (!detail) {
        return;
    }

    const now = Date.now();
    if (
        now - Number(operatorRuntime.pilotBlockToastAt || 0) <
        OPERATOR_PILOT_BLOCK_TOAST_COOLDOWN_MS
    ) {
        return;
    }

    operatorRuntime.pilotBlockToastAt = now;
    createToast(detail, 'error');
}

function applyOperatorClinicProfile(profile) {
    operatorClinicProfile = profile;
    operatorRuntime.surfaceContract = getTurneroSurfaceContract(
        profile,
        'operator'
    );
    const clinicName = getTurneroClinicBrandName(profile);
    const clinicShortName = getTurneroClinicShortName(profile);
    const clinicId = String(profile?.clinic_id || '').trim() || 'sin-clinic-id';
    const clinicCity = String(profile?.branding?.city || '').trim();
    const consultorioSummary = [
        getTurneroConsultorioLabel(profile, 1, { short: true }),
        getTurneroConsultorioLabel(profile, 2, { short: true }),
    ].join(' / ');
    const operatorRoute = String(
        profile?.surfaces?.operator?.route || '/operador-turnos.html'
    ).trim();

    document.title = `Turnero Operador - ${clinicName}`;
    document.querySelectorAll('.queue-operator-kicker').forEach((node) => {
        if (node instanceof HTMLElement) {
            node.textContent = `${clinicShortName} · Operador`;
        }
    });
    setText(
        '#operatorClinicMeta',
        ['Piloto web por clínica', clinicId, clinicCity || clinicShortName]
            .filter(Boolean)
            .join(' · ')
    );
    setText(
        '#operatorSurfaceMeta',
        `Ruta ${operatorRoute} · ${consultorioSummary}`
    );
    renderOperatorProfileStatus(profile);
}

function getDesktopBridge() {
    return typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null
        ? window.turneroDesktop
        : null;
}

function getQueueSyncHealth(state = getState()) {
    const syncMode = String(state?.queue?.syncMode || 'live')
        .trim()
        .toLowerCase();
    const fallbackPartial = Boolean(state?.queue?.fallbackPartial);
    const degraded = syncMode === 'fallback' || fallbackPartial;

    return {
        syncMode,
        fallbackPartial,
        degraded,
    };
}

function getOperatorMutationBlocker(state = getState()) {
    if (!state?.auth?.authenticated) {
        return null;
    }

    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return null;
    }

    if (
        !operatorRuntime.online ||
        operatorRuntime.shellRuntime.connectivity === 'offline'
    ) {
        const safeReason = operatorRuntime.shellRuntime.reason;
        return {
            key: 'offline_safe',
            tone: 'danger',
            title: 'Modo seguro',
            summary:
                safeReason === 'snapshot_expired'
                    ? 'El último snapshot válido ya venció. Mantén la vista solo como referencia y espera red antes de volver a operar.'
                    : safeReason === 'no_authenticated_session'
                      ? 'No hay una sesión previa válida y el login offline no está disponible. Mantén la pantalla en solo lectura.'
                      : safeReason === 'reconciliation_pending'
                        ? 'Hay acciones en conciliación. Mantén la cola en línea o solo lectura hasta limpiarlas.'
                        : 'La consola quedó en modo seguro. Puedes revisar la cola o hardware, pero no llamar ni cerrar tickets hasta recuperar red.',
            toast: 'Modo seguro activo. Las acciones sobre tickets quedan bloqueadas hasta recuperar conexión.',
        };
    }

    if (getQueueSyncHealth(state).degraded) {
        return {
            key: 'fallback',
            tone: 'warning',
            title: 'Cola en fallback local',
            summary:
                'La superficie está mostrando cache local. Puedes revisar contexto y preparar hardware, pero evita llamar, reasignar o cerrar tickets hasta volver a sincronizar.',
            toast: 'Cola en fallback local. Refresca y espera sincronización antes de operar tickets.',
        };
    }

    return null;
}

async function refreshDesktopSnapshot() {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.getRuntimeSnapshot !== 'function') {
        operatorRuntime.shell = createEmptyShellState();
        syncOperatorShellRuntime(createEmptyShellRuntimeState());
        syncShellSettingsButton();
        return operatorRuntime.shell;
    }

    try {
        const snapshot = await bridge.getRuntimeSnapshot();
        operatorRuntime.shell = hydrateOperatorShellState(snapshot);
        syncOperatorShellRuntime(
            snapshot?.shellStatus || operatorRuntime.shellRuntime,
            operatorRuntime.shellRuntimeSnapshot
        );
    } catch (_error) {
        operatorRuntime.shell = createEmptyShellState();
    }

    syncShellSettingsButton();
    return operatorRuntime.shell;
}

function resolveOperatorAppMode() {
    const bridge = getDesktopBridge();
    return operatorRuntime.shell.available ||
        (bridge && typeof bridge.openSettings === 'function')
        ? 'desktop'
        : 'web';
}

function buildOperatorHeartbeatPayload() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const syncHealth = getQueueSyncHealth(state);
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(operatorClinicProfile, 'operator');
    const clinicId = String(operatorClinicProfile?.clinic_id || '').trim();
    const clinicName = String(
        operatorClinicProfile?.branding?.name ||
            operatorClinicProfile?.branding?.short_name ||
            ''
    ).trim();
    const profileFingerprint = getTurneroClinicProfileFingerprint(
        operatorClinicProfile
    );
    const profileSource = String(
        operatorClinicProfile?.runtime_meta?.source || 'remote'
    ).trim();
    const payload = buildHeartbeatPayload({
        queueState: state.queue,
        online: operatorRuntime.online,
        shell: operatorRuntime.shell,
        shellRuntime: operatorRuntime.shellRuntime,
        appMode: resolveOperatorAppMode(),
        numpadStatus,
        syncHealth,
    });
    if (surfaceContract.state === 'alert') {
        payload.status = 'alert';
        payload.summary = surfaceContract.detail;
    }
    payload.details = {
        ...(payload.details && typeof payload.details === 'object'
            ? payload.details
            : {}),
        clinicId,
        clinicName,
        profileSource,
        profileFingerprint,
        surfaceContractState: String(surfaceContract.state || ''),
        surfaceRouteExpected: String(surfaceContract.expectedRoute || ''),
        surfaceRouteCurrent: String(surfaceContract.currentRoute || ''),
    };
    return payload;
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

function syncOperatorHeartbeat(
    reason = 'state_change',
    { force = false } = {}
) {
    if (!getState().auth.authenticated) {
        operatorHeartbeat?.stop();
        return;
    }
    const heartbeat = ensureOperatorHeartbeat();
    if (force) {
        void heartbeat.beatNow(reason);
        return;
    }
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
        .replace(/^NumpadAdd$/i, 'Numpad Add')
        .replace(/^NumpadDecimal$/i, 'Numpad Decimal')
        .replace(/^NumpadSubtract$/i, 'Numpad Subtract');
}

function formatOperatorLabelList(labels) {
    if (!Array.isArray(labels) || labels.length === 0) {
        return '';
    }

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} y ${labels[1]}`;
    }

    return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

function getOperatorCallKeyBinding(queueState = getState().queue) {
    const customBinding =
        queueState?.customCallKey &&
        typeof queueState.customCallKey === 'object'
            ? queueState.customCallKey
            : null;

    return {
        binding: customBinding,
        fingerprint: customBinding
            ? `${String(customBinding.code || '')}|${String(customBinding.key || '')}|${Number(customBinding.location || 0)}`
            : 'default:numpadenter',
        label: humanizeCallKeyLabel(
            customBinding
                ? customBinding.code || customBinding.key || 'tecla externa'
                : 'NumpadEnter'
        ),
    };
}

function syncOperatorNumpadBinding(queueState = getState().queue) {
    const binding = getOperatorCallKeyBinding(queueState);
    if (operatorRuntime.numpad.bindingFingerprint === binding.fingerprint) {
        return binding;
    }

    operatorRuntime.numpad.bindingFingerprint = binding.fingerprint;
    operatorRuntime.numpad.validatedActions.call = false;

    if (!Object.values(operatorRuntime.numpad.validatedActions).some(Boolean)) {
        operatorRuntime.numpad.lastAction = '';
        operatorRuntime.numpad.lastCode = '';
        operatorRuntime.numpad.lastAt = '';
    }

    return binding;
}

function buildOperatorNumpadStatus(queueState = getState().queue) {
    const callKeyBinding = syncOperatorNumpadBinding(queueState);
    const checks = [
        {
            id: 'call',
            label: callKeyBinding.label,
            validated: Boolean(operatorRuntime.numpad.validatedActions.call),
        },
        {
            id: 'recall',
            label: '+',
            validated: Boolean(operatorRuntime.numpad.validatedActions.recall),
        },
        {
            id: 'complete',
            label: '.',
            validated: Boolean(
                operatorRuntime.numpad.validatedActions.complete
            ),
        },
        {
            id: 'noShow',
            label: '-',
            validated: Boolean(operatorRuntime.numpad.validatedActions.noShow),
        },
    ];
    const validatedCount = checks.filter((check) => check.validated).length;
    const requiredCount = checks.length;
    const ready = validatedCount === requiredCount;
    const pendingLabels = checks
        .filter((check) => !check.validated)
        .map((check) => check.label);
    const label = ready
        ? 'Numpad listo'
        : `Numpad ${validatedCount}/${requiredCount}`;
    const summary = ready
        ? `${label} · ${checks.map((check) => check.label).join(', ')}`
        : `${label} · faltan ${formatOperatorLabelList(pendingLabels)}`;

    return {
        callKeyLabel: callKeyBinding.label,
        ready,
        seen: validatedCount > 0,
        validatedCount,
        requiredCount,
        pendingLabels,
        label,
        summary,
        headline: `${validatedCount}/${requiredCount} teclas operativas listas`,
        checks,
        lastAction: operatorRuntime.numpad.lastAction,
        lastCode: operatorRuntime.numpad.lastCode,
        lastAt: operatorRuntime.numpad.lastAt,
    };
}

function renderOperatorNumpadMatrix(queueState = getState().queue) {
    const root = getById('operatorNumpadMatrix');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const status = buildOperatorNumpadStatus(queueState);
    root.innerHTML = status.checks
        .map(
            (check) => `
                <span
                    id="operatorNumpadCheck_${escapeHtml(check.id)}"
                    class="queue-operator-numpad-chip"
                    data-state="${check.validated ? 'ready' : 'warning'}"
                >
                    <span class="queue-operator-numpad-chip__label">${escapeHtml(
                        check.label
                    )}</span>
                    <strong class="queue-operator-numpad-chip__state">${check.validated ? 'OK' : 'Pendiente'}</strong>
                </span>
            `
        )
        .join('');
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

function formatOperatorRuntimeAge(seconds) {
    const ageSec = Number(seconds);
    if (!Number.isFinite(ageSec) || ageSec < 0) {
        return 'sin sync válido';
    }
    if (ageSec < 60) {
        return `${Math.round(ageSec)}s`;
    }
    if (ageSec < 3600) {
        return `${Math.round(ageSec / 60)}m`;
    }
    return `${Math.round(ageSec / 3600)}h`;
}

function formatOperatorRuntimeTimestamp(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) {
        return 'sin registro';
    }
    return date.toLocaleString('es-EC', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getOperatorRuntimeModeLabel() {
    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return 'Offline operativo';
    }
    if (operatorRuntime.shellRuntime.mode === 'safe') {
        return 'Modo seguro';
    }
    if (operatorRuntime.shellRuntime.reconciliationSize > 0) {
        return 'Live con conciliación';
    }
    return 'Live';
}

function getOperatorRuntimeTone(syncHealth = getQueueSyncHealth()) {
    if (operatorRuntime.shellRuntime.mode === 'safe') {
        return 'danger';
    }
    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return 'warning';
    }
    return operatorRuntime.shellRuntime.reconciliationSize > 0 ||
        operatorRuntime.shellRuntime.outboxSize > 0 ||
        syncHealth.degraded
        ? 'warning'
        : 'ready';
}

function getOperatorRuntimeSummary(syncHealth = getQueueSyncHealth()) {
    if (operatorRuntime.shellRuntime.mode === 'offline') {
        return 'Puedes llamar, re-llamar, completar y no show. Todo quedará pendiente de replay hasta recuperar red.';
    }
    if (operatorRuntime.shellRuntime.mode === 'safe') {
        if (
            operatorRuntime.shellRuntime.reason === 'no_authenticated_session'
        ) {
            return 'Solo lectura: no hay sesión previa válida y el login offline no está disponible.';
        }
        if (operatorRuntime.shellRuntime.reason === 'snapshot_expired') {
            return 'Solo lectura: el snapshot local venció y no conviene operar así.';
        }
        if (operatorRuntime.shellRuntime.reason === 'reconciliation_pending') {
            return 'Solo lectura: hay acciones en conciliación pendientes antes de volver a contingencia.';
        }
        return 'Solo lectura hasta recuperar red y un snapshot sano.';
    }
    if (operatorRuntime.shellRuntime.reconciliationSize > 0) {
        return 'La app sigue en línea, pero hay acciones en conciliación y no debe volver a contingencia todavía.';
    }
    if (syncHealth.degraded) {
        return 'La cola quedó en fallback local; refresca y espera sincronización antes de operar tickets.';
    }
    return 'Shell y cola en vivo para la operación diaria.';
}

function getOperatorRuntimeMeta() {
    return [
        `Sync ${formatOperatorRuntimeTimestamp(
            operatorRuntime.shellRuntime.lastSuccessfulSyncAt
        )}`,
        `edad ${formatOperatorRuntimeAge(
            operatorRuntime.shellRuntime.snapshotAgeSec
        )}`,
        `outbox ${operatorRuntime.shellRuntime.outboxSize}`,
        `conciliación ${operatorRuntime.shellRuntime.reconciliationSize}`,
        `canal ${operatorRuntime.shellRuntime.updateChannel}`,
    ].join(' · ');
}

function updateOperatorRuntimeCard(syncHealth = getQueueSyncHealth()) {
    const card = getById('operatorShellRuntimeCard');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', getOperatorRuntimeTone(syncHealth));
    }

    setText('#operatorShellRuntimeMode', getOperatorRuntimeModeLabel());
    setText(
        '#operatorShellRuntimeSummary',
        getOperatorRuntimeSummary(syncHealth)
    );
    setText('#operatorShellRuntimeMeta', getOperatorRuntimeMeta());

    const recoveryButton = getById('operatorShellRecoveryBtn');
    if (!(recoveryButton instanceof HTMLButtonElement)) {
        return;
    }

    const bridge = getDesktopBridge();
    const canOpenSettings = bridge && typeof bridge.openSettings === 'function';
    const prefersSettings =
        operatorRuntime.shellRuntime.mode === 'safe' && canOpenSettings;

    recoveryButton.hidden = false;
    recoveryButton.textContent = prefersSettings
        ? 'Abrir ajustes'
        : 'Reintentar sync';
    recoveryButton.title = prefersSettings
        ? 'Revisar la configuración local del equipo'
        : 'Intentar sincronizar la cola ahora';
}

function updateOperatorReadiness() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(operatorClinicProfile, 'operator');
    const syncHealth = getQueueSyncHealth(state);
    const blocker = getOperatorMutationBlocker(state);
    const stationNumber =
        Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLabel = `${getOperatorConsultorioShortLabel(stationNumber)} ${
        state.queue.stationMode === 'locked' ? 'fijo' : 'libre'
    }`;
    const routeSummary = `${stationLabel} · ${
        state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF'
    }`;
    const runtimeMode = operatorRuntime.shellRuntime.mode;
    const networkSummary =
        runtimeMode === 'offline'
            ? 'Offline operativo con snapshot fresco y replay pendiente'
            : blocker?.key === 'offline_safe'
              ? 'Equipo sin red segura para operar'
              : syncHealth.degraded
                ? 'Red en línea, pero la cola quedó en fallback local'
                : 'Sesión activa y red en línea';
    const shellSummary = getShellReadiness(operatorRuntime.shell);

    setReadinessCheck(
        'operatorReadyRoute',
        surfaceContract.state === 'alert' ? 'danger' : 'ready',
        surfaceContract.state === 'alert'
            ? surfaceContract.detail
            : routeSummary
    );
    setReadinessCheck(
        'operatorReadyNetwork',
        runtimeMode === 'offline'
            ? 'warning'
            : blocker?.key === 'offline_safe'
              ? 'danger'
              : syncHealth.degraded
                ? 'warning'
                : 'ready',
        networkSummary
    );
    setReadinessCheck(
        'operatorReadyShell',
        shellSummary.state,
        shellSummary.detail
    );
    setReadinessCheck(
        'operatorReadyNumpad',
        numpadStatus.ready ? 'ready' : 'warning',
        numpadStatus.headline
    );
    renderOperatorNumpadMatrix(state.queue);

    const readinessTitle = getById('operatorReadinessTitle');
    const readinessSummary = getById('operatorReadinessSummary');
    const readyForLiveUse =
        runtimeMode === 'live' &&
        operatorRuntime.online &&
        surfaceContract.state !== 'alert' &&
        !syncHealth.degraded &&
        numpadStatus.ready;
    const readyForOfflineUse =
        runtimeMode === 'offline' &&
        surfaceContract.state !== 'alert' &&
        numpadStatus.ready;
    const pendingCount = numpadStatus.pendingLabels.length;

    if (readinessTitle) {
        readinessTitle.textContent =
            surfaceContract.state === 'alert'
                ? surfaceContract.reason === 'profile_missing'
                    ? 'Perfil de clínica no cargado'
                    : 'Ruta del piloto incorrecta'
                : blocker?.key === 'offline_safe'
                  ? 'Modo seguro'
                  : blocker?.key === 'fallback'
                    ? 'Sincronización pendiente'
                    : readyForOfflineUse
                      ? 'Offline operativo'
                      : readyForLiveUse
                        ? 'Equipo listo para operar'
                        : pendingCount === numpadStatus.requiredCount
                          ? 'Falta validar el numpad'
                          : `Faltan validar ${pendingCount} tecla(s)`;
    }

    if (readinessSummary) {
        readinessSummary.textContent =
            surfaceContract.state === 'alert'
                ? surfaceContract.detail
                : blocker?.key === 'offline_safe'
                  ? 'Mantén la pantalla solo como referencia hasta recuperar red o una sesión válida.'
                  : blocker?.key === 'fallback'
                    ? 'La cola está en fallback local. Mantén la vista como referencia y refresca antes de reanudar llamados o cierres.'
                    : readyForOfflineUse
                      ? 'La contingencia offline está habilitada. Puedes operar con las cuatro teclas del numpad y el replay se hará al reconectar.'
                      : readyForLiveUse
                        ? 'La ruta, la sesión y las cuatro teclas operativas ya respondieron. Puedes pasar al primer llamado real.'
                        : `Valida ${formatOperatorLabelList(
                              numpadStatus.pendingLabels
                          )} en el Genius Numpad 1000 antes del primer llamado real.`;
    }
}

function noteNumpadActivity(event) {
    const state = getState();
    const callKeyBinding = syncOperatorNumpadBinding(state.queue);
    const code = String(event?.code || '').trim();
    const key = String(event?.key || '').trim();
    const codeNormalized = code.toLowerCase();
    const keyNormalized = key.toLowerCase();

    let action = '';
    if (
        callKeyBinding.binding
            ? eventMatchesBinding(event, callKeyBinding.binding)
            : isNumpadEnterEvent(event, codeNormalized, keyNormalized)
    ) {
        operatorRuntime.numpad.validatedActions.call = true;
        action = 'call';
    } else if (isNumpadAddEvent(codeNormalized, keyNormalized)) {
        operatorRuntime.numpad.validatedActions.recall = true;
        action = 'recall';
    } else if (isNumpadDecimalEvent(codeNormalized, keyNormalized)) {
        operatorRuntime.numpad.validatedActions.complete = true;
        action = 'complete';
    } else if (isNumpadSubtractEvent(codeNormalized, keyNormalized)) {
        operatorRuntime.numpad.validatedActions.noShow = true;
        action = 'noShow';
    }

    if (!action) {
        return;
    }

    operatorRuntime.numpad.lastAction = action;
    operatorRuntime.numpad.lastCode = code || key || action;
    operatorRuntime.numpad.lastAt = new Date().toISOString();
    syncOperatorHeartbeat('numpad');
}

function updateOperatorActionGuide() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const surfaceContract = getOperatorSurfaceContract();
    const activeTicket = getActiveCalledTicketForStation();
    const waitingTicket = getWaitingForConsultorio(
        Number(state.queue.stationConsultorio || 1)
    );
    const pendingAction = state.queue.pendingSensitiveAction;

    let title;
    let summary;

    if (surfaceContract.state === 'alert') {
        title =
            surfaceContract.reason === 'profile_missing'
                ? 'Operación bloqueada por perfil'
                : 'Operación bloqueada por ruta';
        summary = getOperatorPilotBlockDetail();
    } else if (pendingAction && pendingAction.action) {
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
        summary = `Pulsa ${numpadStatus.callKeyLabel} para llamar ${waitingTicket.ticketCode} en ${getOperatorConsultorioShortLabel(
            Number(state.queue.stationConsultorio || 1)
        )}.`;
    } else {
        title = 'Sin tickets en espera';
        summary =
            'Mantén el equipo listo y usa Refrescar si esperas nuevos turnos o check-ins.';
    }

    setText('#operatorActionTitle', title);
    setText('#operatorActionSummary', summary);
}

function updateOperatorGuardState() {
    const state = getState();
    const blocker = getOperatorMutationBlocker(state);
    let title = 'Operación habilitada';
    let summary =
        'La cola sigue en vivo. Puedes llamar, re-llamar y cerrar tickets desde esta superficie.';
    let tone = 'success';

    if (operatorRuntime.shellRuntime.mode === 'offline') {
        title = 'Offline operativo';
        summary =
            'Puedes llamar, re-llamar, completar y no show. Los cambios quedarán en cola hasta recuperar red.';
        tone = 'warning';
    } else if (blocker) {
        title = blocker.title;
        summary = blocker.summary;
        tone = blocker.tone;
    } else if (operatorRuntime.shellRuntime.reconciliationSize > 0) {
        title = 'Operación online con conciliación';
        summary =
            'El equipo puede seguir trabajando en línea, pero no debe volver a contingencia hasta limpiar la conciliación.';
        tone = 'warning';
    }

    const card = getById('operatorGuardCard');
    if (card instanceof HTMLElement) {
        card.setAttribute('data-state', tone);
    }
    setText('#operatorGuardTitle', title);
    setText('#operatorGuardSummary', summary);
}

function isSafeOperatorAction(action) {
    return [
        'queue-refresh-state',
        'queue-toggle-shortcuts',
        'queue-toggle-one-tap',
        'queue-lock-station',
        'queue-set-station-mode',
        'queue-capture-call-key',
        'queue-clear-call-key',
        'queue-clear-search',
        'queue-sensitive-cancel',
        'queue-toggle-ticket-select',
    ].includes(String(action || '').trim());
}

function isMutatingOperatorAction(action) {
    return [
        'queue-call-next',
        'queue-ticket-action',
        'queue-sensitive-confirm',
        'queue-reprint-ticket',
        'queue-bulk-action',
        'queue-bulk-reprint',
        'queue-release-station',
    ].includes(String(action || '').trim());
}

function isOperatorActionAllowedDuringOffline(
    action,
    element,
    state = getState()
) {
    const actionName = String(action || '').trim();
    if (!isMutatingOperatorAction(actionName)) {
        return true;
    }

    if (actionName === 'queue-call-next') {
        return true;
    }

    if (actionName === 'queue-ticket-action') {
        const ticketAction = normalizeQueueAction(
            element?.dataset?.queueAction
        );
        return ['re-llamar', 'completar', 'no_show'].includes(ticketAction);
    }

    if (actionName === 'queue-sensitive-confirm') {
        const pendingAction = normalizeQueueAction(
            state.queue.pendingSensitiveAction?.action
        );
        return ['re-llamar', 'completar', 'no_show'].includes(pendingAction);
    }

    return false;
}

function getOperatorActionGuard(action, element, state = getState()) {
    if (!state?.auth?.authenticated) {
        return null;
    }

    if (isMutatingOperatorAction(action) && isOperatorPilotBlocked()) {
        const surfaceContract = getOperatorSurfaceContract();
        const detail = getOperatorPilotBlockDetail();
        return {
            key:
                surfaceContract.reason === 'profile_missing'
                    ? 'pilot_profile'
                    : 'pilot_route',
            tone: 'danger',
            title:
                surfaceContract.reason === 'profile_missing'
                    ? 'Operación bloqueada por perfil'
                    : 'Operación bloqueada por ruta',
            summary: detail,
            toast: detail,
        };
    }

    const blocker = getOperatorMutationBlocker(state);
    if (blocker && isMutatingOperatorAction(action)) {
        return blocker;
    }

    if (
        operatorRuntime.shellRuntime.mode === 'offline' &&
        !isOperatorActionAllowedDuringOffline(action, element, state)
    ) {
        return {
            key: 'offline_scope',
            tone: 'warning',
            title: 'Offline operativo limitado',
            summary:
                'En contingencia solo están permitidos llamar, re-llamar, completar y no show. El resto queda bloqueado hasta recuperar red.',
            toast: 'Acción fuera de scope offline. Recupera red para reasignar, liberar, reimprimir o usar acciones masivas.',
        };
    }

    return null;
}

function syncOperatorActionAvailability() {
    document.querySelectorAll('[data-action]').forEach((node) => {
        const action = String(node.getAttribute('data-action') || '').trim();
        const blocker = getOperatorActionGuard(action, node);
        const allowInteractionThroughGuard =
            blocker?.key === 'pilot_profile' || blocker?.key === 'pilot_route';
        const disabled = Boolean(blocker) && !allowInteractionThroughGuard;
        const guardDisabledState = node.getAttribute(
            'data-operator-guard-disabled'
        );
        const guardTitle = node.getAttribute('data-operator-guard-title');
        if (
            node instanceof HTMLButtonElement ||
            node instanceof HTMLInputElement
        ) {
            if (disabled) {
                if (!guardDisabledState) {
                    node.setAttribute(
                        'data-operator-guard-disabled',
                        node.disabled ? 'preserved' : 'forced'
                    );
                }
                node.disabled = true;
            } else if (guardDisabledState === 'forced') {
                node.disabled = false;
            }
        }
        if (disabled) {
            node.setAttribute('aria-disabled', 'true');
            node.setAttribute(
                'data-operator-guard-title',
                blocker?.summary || ''
            );
            node.setAttribute('title', blocker?.summary || '');
        } else {
            node.removeAttribute('data-operator-guard-disabled');
            node.removeAttribute('aria-disabled');
            if (guardTitle && node.getAttribute('title') === guardTitle) {
                node.removeAttribute('title');
            }
            node.removeAttribute('data-operator-guard-title');
        }
    });
}

function notifyOperatorMutationBlocked(blocker) {
    if (!blocker) {
        return;
    }

    const now = Date.now();
    if (
        blocker.key === lastOperatorGuardToastKey &&
        now - lastOperatorGuardToastAt < 3000
    ) {
        return;
    }

    lastOperatorGuardToastKey = blocker.key;
    lastOperatorGuardToastAt = now;
    createToast(blocker.toast, blocker.tone === 'danger' ? 'error' : 'warning');
}

async function openOperatorSettings() {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.openSettings !== 'function') {
        return false;
    }

    try {
        await bridge.openSettings();
        return true;
    } catch (error) {
        createToast(
            error?.message || 'No se pudo abrir la configuración local',
            'error'
        );
        return false;
    }
}

async function handleOperatorRecoveryAction() {
    if (
        operatorRuntime.shellRuntime.mode === 'safe' &&
        (await openOperatorSettings())
    ) {
        return true;
    }

    await Promise.all([refreshQueueState(), refreshDesktopSnapshot()]);
    updateOperatorChrome({
        heartbeatReason: 'manual_recovery',
        forceHeartbeat: true,
    });
    return true;
}

function isOpenSettingsShortcut(event) {
    const key = String(event?.key || '')
        .trim()
        .toLowerCase();
    const code = String(event?.code || '')
        .trim()
        .toLowerCase();

    return (
        key === 'f10' ||
        (Boolean(event?.ctrlKey || event?.metaKey) &&
            (key === ',' || code === 'comma'))
    );
}

function syncShellSettingsButton() {
    const button = getById('operatorAppSettingsBtn');
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    const bridge = getDesktopBridge();
    const canOpenSettings = bridge && typeof bridge.openSettings === 'function';

    button.classList.toggle('is-hidden', !canOpenSettings);
    if (canOpenSettings) {
        const buttonCopy = getOperatorShellSettingsButtonCopy(
            operatorRuntime.shell
        );
        button.textContent = buttonCopy.text;
        button.title = buttonCopy.title;
    }
}

function syncLoggedOutAccessState() {
    const state = getState();
    if (isOperatorAuthMode(state.auth)) {
        return;
    }

    if (state.auth.authenticated || state.auth.requires2FA) {
        return;
    }

    if (
        !operatorRuntime.online ||
        operatorRuntime.shellRuntime.connectivity === 'offline'
    ) {
        setLoginStatus(
            'warning',
            'Sin login offline',
            'El ingreso offline no está habilitado. Recupera conexión para iniciar sesión.'
        );
        return;
    }

    setLoginStatus(
        'neutral',
        'Acceso protegido',
        'Inicia sesión para abrir la consola operativa del turnero.'
    );
}

function updateOperatorChrome({
    heartbeatReason = 'render',
    forceHeartbeat = false,
} = {}) {
    const state = getState();
    const surfaceState = buildOperatorSurfaceState(state.queue);
    const stationLabel = `C${surfaceState.stationConsultorio} ${
        surfaceState.locked ? 'bloqueado' : 'libre'
    }`;
    const oneTapLabel = surfaceState.oneTap ? '1 tecla ON' : '1 tecla OFF';
    const callKey = state.queue.customCallKey
        ? String(
              state.queue.customCallKey.code ||
                  state.queue.customCallKey.key ||
                  'tecla externa'
          )
        : 'Numpad Enter';
    const shellModeLabel = getShellModeLabel(operatorRuntime.shell);
    const shellReadiness = getShellReadiness(operatorRuntime.shell);
    const networkOnline = operatorRuntime.online;
    const syncHealth = getQueueSyncHealth(state);
    const networkSummary = !networkOnline
        ? 'Sin red local'
        : operatorRuntime.shellRuntime.mode === 'offline'
          ? 'Servidor sin respuesta'
          : syncHealth.degraded
            ? 'Sync degradado'
            : 'Red en línea';
    const networkMeta = !networkOnline
        ? 'La conectividad local cayó. La app solo debe operar si el runtime quedó en offline operativo.'
        : operatorRuntime.shellRuntime.mode === 'offline'
          ? 'La red local sigue arriba, pero el backend no respondió y la consola pasó a contingencia.'
          : syncHealth.degraded
            ? `${refreshStatusLabel()} · cola en fallback local; refresca antes de operar.`
            : `${refreshStatusLabel()} · heartbeat operador listo para admin y shell.`;

    setText('#operatorStationSummary', stationLabel);
    setText(
        '#operatorOneTapSummary',
        `${oneTapLabel} · ${refreshStatusLabel()} · ${shellModeLabel}`
    );
    setText('#operatorCallKeySummary', humanizeCallKeyLabel(callKey));
    setText('#operatorShellModeSummary', shellModeLabel);
    setText(
        '#operatorShellMetaSummary',
        getShellMetaLabel(operatorRuntime.shell)
    );
    setText(
        '#operatorShellSupportSummary',
        getShellSupportLabel(operatorRuntime.shell)
    );
    setText('#operatorShellRuntimeMode', getOperatorRuntimeModeLabel());
    setText(
        '#operatorShellRuntimeSummary',
        getOperatorRuntimeSummary(syncHealth)
    );
    setText('#operatorShellRuntimeMeta', getOperatorRuntimeMeta());
    setText('#operatorNetworkSummary', networkSummary);
    setText('#operatorNetworkMetaSummary', networkMeta);
    getById('operatorShellCard')?.setAttribute(
        'data-state',
        shellReadiness.state
    );
    const shellSupportNode = getById('operatorShellSupportSummary');
    if (shellSupportNode instanceof HTMLElement) {
        shellSupportNode.setAttribute(
            'title',
            getShellSupportLabel(operatorRuntime.shell)
        );
    }
    getById('operatorNetworkCard')?.setAttribute(
        'data-state',
        !networkOnline
            ? 'danger'
            : operatorRuntime.shellRuntime.mode === 'offline' ||
                syncHealth.degraded
              ? 'warning'
              : 'ready'
    );
    updateOperatorRuntimeCard(syncHealth);
    renderQueueSection();
    updateOperatorActionGuide();
    updateOperatorReadiness();
    updateOperatorGuardState();
    syncOperatorActionAvailability();
    syncOperatorHeartbeat(heartbeatReason, { force: forceHeartbeat });
}

function mountAuthenticatedView() {
    getById('operatorLoginView')?.classList.add('is-hidden');
    getById('operatorApp')?.classList.remove('is-hidden');
}

function mountLoggedOutView() {
    getById('operatorApp')?.classList.add('is-hidden');
    getById('operatorLoginView')?.classList.remove('is-hidden');
    syncLoggedOutAccessState();
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
    const refreshResult = await refreshAdminData();
    await hydrateQueueFromData();
    await refreshDesktopSnapshot();
    await operatorRuntime.queueAdapter?.markSessionAuthenticated?.(true);
    await operatorRuntime.queueAdapter?.syncStateSnapshot?.({
        healthy: Boolean(refreshResult?.ok),
    });
    await refreshQueueState();
    ensureOperatorHeartbeat().start({ immediate: false });
    updateOperatorChrome();
    startRefreshLoop();
    if (showToast) {
        createToast(
            refreshResult?.ok
                ? 'Operador conectado'
                : 'Operador cargado con respaldo local',
            refreshResult?.ok ? 'success' : 'warning'
        );
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
                error?.message || 'No se pudo consultar el estado de OpenClaw',
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

    if (
        !operatorRuntime.online &&
        !getState().auth.authenticated &&
        !getState().auth.requires2FA
    ) {
        syncLoggedOutAccessState();
        createToast(
            'El ingreso offline no está habilitado. Recupera conexión para iniciar sesión.',
            'warning'
        );
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
            state.auth.requires2FA
                ? 'Validando segundo factor'
                : 'Validando credenciales',
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
                  '[data-action], #operatorLogoutBtn, #operatorReset2FABtn, #operatorAppSettingsBtn, #operatorOpenClawBtn, #operatorOpenClawRetryBtn, #operatorShellRecoveryBtn'
              )
            : null;

    if (!actionNode) {
        return;
    }

    if (actionNode.id === 'operatorLogoutBtn') {
        event.preventDefault();
        stopRefreshLoop();
        operatorHeartbeat?.stop();
        await operatorRuntime.queueAdapter?.markSessionAuthenticated?.(false);
        await logoutSession();
        mountLoggedOutView();
        resetLoginForm({ clearPassword: true });
        show2FA(false);
        syncOperatorLoginSurface(getState().auth);
        syncLoggedOutAccessState();
        createToast('Sesión cerrada', 'info');
        focusLoginField(
            isOperatorAuthMode(getState().auth) ? 'operator_auth' : 'password'
        );
        return;
    }

    if (actionNode.id === 'operatorAppSettingsBtn') {
        event.preventDefault();
        await openOperatorSettings();
        return;
    }

    if (actionNode.id === 'operatorShellRecoveryBtn') {
        event.preventDefault();
        await handleOperatorRecoveryAction();
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

    const blocker = getOperatorActionGuard(action, actionNode);
    if (blocker) {
        notifyOperatorMutationBlocked(blocker);
        updateOperatorChrome();
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
        if (isOpenSettingsShortcut(event)) {
            const opened = await openOperatorSettings();
            if (opened) {
                event.preventDefault();
                return;
            }
        }

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

        const state = getState();
        const callKeyBinding = syncOperatorNumpadBinding(state.queue);
        const codeNormalized = String(event.code || '')
            .trim()
            .toLowerCase();
        const keyNormalized = String(event.key || '')
            .trim()
            .toLowerCase();
        const mutatingNumpadAction =
            (callKeyBinding.binding
                ? eventMatchesBinding(event, callKeyBinding.binding)
                : isNumpadEnterEvent(event, codeNormalized, keyNormalized)) ||
            isNumpadAddEvent(codeNormalized, keyNormalized) ||
            isNumpadDecimalEvent(codeNormalized, keyNormalized) ||
            isNumpadSubtractEvent(codeNormalized, keyNormalized);

        if (isOperatorPilotBlocked() && mutatingNumpadAction) {
            event.preventDefault();
            noteNumpadActivity(event);
            notifyOperatorPilotBlocked();
            updateOperatorChrome();
            return;
        }

        const blocker = getOperatorMutationBlocker(state);
        if (blocker && mutatingNumpadAction) {
            event.preventDefault();
            noteNumpadActivity(event);
            notifyOperatorMutationBlocked(blocker);
            updateOperatorChrome();
            return;
        }

        try {
            await queueNumpadAction({
                key: event.key,
                code: event.code,
                location: event.location,
            });
        } finally {
            noteNumpadActivity(event);
            updateOperatorChrome();
        }
    });
}

function attachVisibilityRefresh() {
    document.addEventListener('visibilitychange', () => {
        if (
            document.visibilityState === 'visible' &&
            getState().auth.authenticated
        ) {
            void Promise.all([
                refreshQueueState(),
                refreshDesktopSnapshot(),
            ]).then(() => updateOperatorChrome());
        }
    });

    window.addEventListener('online', () => {
        operatorRuntime.online = true;
        if (getState().auth.authenticated) {
            void operatorRuntime.queueAdapter
                ?.reportConnectivity?.('online')
                ?.finally(() => {
                    void refreshQueueState().then(() => updateOperatorChrome());
                });
            return;
        }

        syncLoggedOutAccessState();
    });

    window.addEventListener('offline', () => {
        operatorRuntime.online = false;
        void operatorRuntime.queueAdapter?.reportConnectivity?.('offline');
        if (getState().auth.authenticated) {
            updateOperatorChrome();
            return;
        }

        syncLoggedOutAccessState();
    });
}

async function boot() {
    initOperatorOpsTheme();
    applyQueueRuntimeDefaults();
    operatorRuntime.queueAdapter = resolveOperatorQueueAdapter(
        getDesktopBridge(),
        {
            onShellState(status, snapshot) {
                syncOperatorShellRuntime(status, snapshot);
                if (getState().auth.authenticated) {
                    updateOperatorChrome({
                        heartbeatReason: 'shell_runtime',
                        forceHeartbeat: true,
                    });
                    return;
                }

                syncLoggedOutAccessState();
            },
        }
    );
    setQueueCommandAdapter(operatorRuntime.queueAdapter);
    await operatorRuntime.queueAdapter.init?.();
    applyOperatorClinicProfile(await loadTurneroClinicProfile());
    await refreshDesktopSnapshot();
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

    const desktopBridge = getDesktopBridge();
    if (desktopBridge && typeof desktopBridge.onBootStatus === 'function') {
        operatorRuntime.releaseBootStatusListener = desktopBridge.onBootStatus(
            () => {
                void refreshDesktopSnapshot().then(() => {
                    if (getState().auth.authenticated) {
                        updateOperatorChrome({
                            heartbeatReason: 'desktop_status',
                            forceHeartbeat: true,
                        });
                        return;
                    }

                    syncLoggedOutAccessState();
                });
            }
        );
    }

    if (desktopBridge && typeof desktopBridge.onShellEvent === 'function') {
        operatorRuntime.releaseShellStatusListener = desktopBridge.onShellEvent(
            (payload) => {
                operatorRuntime.queueAdapter?.handleShellEvent?.(payload);
            }
        );
    }

    window.addEventListener('beforeunload', () => {
        operatorRuntime.releaseBootStatusListener?.();
        operatorRuntime.releaseShellStatusListener?.();
        clearQueueCommandAdapter();
    });

    const loginForm = getById('operatorLoginForm');
    if (loginForm instanceof HTMLFormElement) {
        loginForm.addEventListener('submit', (event) => {
            void handleLoginSubmit(event);
        });
    }

    await checkAuthStatus();
    const auth = getState().auth;
    if (auth.authenticated) {
        await operatorRuntime.queueAdapter?.markSessionAuthenticated?.(true);
        await bootAuthenticatedSurface();
        return;
    }

    mountLoggedOutView();
    syncOperatorLoginSurface(auth);
    show2FA(false);
    syncLoggedOutAccessState();
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
