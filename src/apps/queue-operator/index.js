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

const QUEUE_REFRESH_MS = 8000;
const OPERATOR_HEARTBEAT_MS = 15000;

let refreshIntervalId = 0;
let operatorHeartbeat = null;
let operatorAuthPollPromise = null;

function createEmptyShellState() {
    return {
        available: false,
        packaged: false,
        appMode: 'web',
        version: '',
        name: '',
        platform: '',
        arch: '',
        updateChannel: 'stable',
        configPath: '',
        updateFeedUrl: '',
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
};
let operatorClinicProfile = null;

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
        [
            'Piloto web por clínica',
            clinicId,
            clinicCity || clinicShortName,
        ]
            .filter(Boolean)
            .join(' · ')
    );
    setText(
        '#operatorSurfaceMeta',
        `Ruta ${operatorRoute} · ${consultorioSummary}`
    );
}

function getDesktopBridge() {
    return typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null
        ? window.turneroDesktop
        : null;
}

function formatShellPlatformLabel(platform) {
    const normalized = String(platform || '')
        .trim()
        .toLowerCase();
    if (normalized === 'win32') {
        return 'Windows';
    }
    if (normalized === 'darwin') {
        return 'macOS';
    }
    if (normalized === 'linux') {
        return 'Linux';
    }
    return normalized || 'Web';
}

function getShellModeLabel() {
    if (!operatorRuntime.shell.available) {
        return 'Fallback web';
    }

    return operatorRuntime.shell.packaged
        ? 'Desktop instalada'
        : 'Desktop en desarrollo';
}

function getShellReadiness() {
    if (!operatorRuntime.shell.available) {
        return {
            state: 'warning',
            detail: 'Fallback web activo · instala el shell para autostart y updates.',
        };
    }

    const shellName = String(
        operatorRuntime.shell.name || 'Turnero Operador'
    ).trim();
    const platformLabel = formatShellPlatformLabel(
        operatorRuntime.shell.platform
    );
    const version = operatorRuntime.shell.version
        ? ` v${operatorRuntime.shell.version}`
        : '';
    const updateChannel = String(
        operatorRuntime.shell.updateChannel || 'stable'
    ).trim();
    const channelSuffix = updateChannel ? ` · canal ${updateChannel}` : '';
    const shellIdentity = `${shellName}${version} · ${platformLabel}${channelSuffix}`;

    if (operatorRuntime.shell.packaged) {
        return {
            state: 'ready',
            detail: `Desktop instalada · ${shellIdentity} · F10 reabre configuracion.`,
        };
    }

    return {
        state: 'warning',
        detail: `Desktop en desarrollo · ${shellIdentity} · valida el instalador antes del piloto.`,
    };
}

async function refreshDesktopSnapshot() {
    const bridge = getDesktopBridge();
    if (!bridge || typeof bridge.getRuntimeSnapshot !== 'function') {
        operatorRuntime.shell = createEmptyShellState();
        syncShellSettingsButton();
        return operatorRuntime.shell;
    }

    try {
        const snapshot = await bridge.getRuntimeSnapshot();
        operatorRuntime.shell = {
            available: true,
            packaged: Boolean(snapshot?.packaged),
            appMode: String(
                snapshot?.appMode ||
                    (snapshot?.packaged ? 'packaged' : 'development')
            ),
            version: String(snapshot?.version || ''),
            name: String(snapshot?.name || 'Turnero Operador'),
            platform: String(snapshot?.platform || ''),
            arch: String(snapshot?.arch || ''),
            updateChannel: String(snapshot?.config?.updateChannel || 'stable'),
            configPath: String(snapshot?.configPath || ''),
            updateFeedUrl: String(snapshot?.updateFeedUrl || ''),
        };
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

function resolveOperatorInstance() {
    const state = getState();
    if (state.queue.stationMode === 'locked') {
        return Number(state.queue.stationConsultorio || 1) === 2 ? 'c2' : 'c1';
    }
    return 'free';
}

function buildOperatorHeartbeatPayload() {
    const state = getState();
    const stationNumber =
        Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationKey = `c${stationNumber}`;
    const locked = state.queue.stationMode === 'locked';
    const stationShortLabel = getOperatorConsultorioShortLabel(stationNumber);
    const stationLabel = locked
        ? `Operador ${stationShortLabel} fijo`
        : 'Operador modo libre';
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
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(operatorClinicProfile, 'operator');
    const readyForLiveUse = operatorRuntime.online && numpadStatus.ready;
    const status = surfaceContract.state === 'alert'
        ? 'alert'
        : !operatorRuntime.online
        ? 'alert'
        : readyForLiveUse
          ? 'ready'
          : 'warning';
    const summary = surfaceContract.state === 'alert'
        ? surfaceContract.detail
        : !operatorRuntime.online
        ? 'Equipo sin red; recupera conectividad antes de operar.'
        : readyForLiveUse
          ? `Equipo listo para operar en ${locked ? `C${stationNumber} fijo` : 'modo libre'}.`
          : `${numpadStatus.label}. Falta validar ${formatOperatorLabelList(
                numpadStatus.pendingLabels
            )} antes del primer llamado.`;

    return {
        instance: resolveOperatorInstance(),
        deviceLabel: stationLabel,
        appMode: resolveOperatorAppMode(),
        status,
        summary,
        networkOnline: operatorRuntime.online,
        lastEvent: numpadStatus.seen ? 'numpad_detected' : 'heartbeat',
        lastEventAt: numpadStatus.lastAt || new Date().toISOString(),
        details: {
            station: stationKey,
            stationMode: locked ? 'locked' : 'free',
            oneTap: Boolean(state.queue.oneTap),
            callKeyLabel: numpadStatus.callKeyLabel,
            numpadSeen: Boolean(numpadStatus.seen),
            numpadReady: Boolean(numpadStatus.ready),
            numpadProgress: numpadStatus.validatedCount,
            numpadRequired: numpadStatus.requiredCount,
            numpadLabel: numpadStatus.label,
            numpadSummary: numpadStatus.summary,
            lastNumpadCode: String(numpadStatus.lastCode || ''),
            shellMode: resolveOperatorAppMode(),
            shellName: String(operatorRuntime.shell.name || ''),
            shellVersion: String(operatorRuntime.shell.version || ''),
            shellPlatform: String(operatorRuntime.shell.platform || ''),
            shellPackaged: Boolean(operatorRuntime.shell.packaged),
            shellUpdateChannel: String(
                operatorRuntime.shell.updateChannel || ''
            ),
            shellUpdateFeedUrl: String(
                operatorRuntime.shell.updateFeedUrl || ''
            ),
            clinicId,
            clinicName,
            profileSource,
            profileFingerprint,
            surfaceContractState: String(surfaceContract.state || ''),
            surfaceRouteExpected: String(surfaceContract.expectedRoute || ''),
            surfaceRouteCurrent: String(surfaceContract.currentRoute || ''),
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

function updateOperatorReadiness() {
    const state = getState();
    const numpadStatus = buildOperatorNumpadStatus(state.queue);
    const surfaceContract =
        operatorRuntime.surfaceContract ||
        getTurneroSurfaceContract(operatorClinicProfile, 'operator');
    const stationLabel = `${getOperatorConsultorioShortLabel(
        Number(state.queue.stationConsultorio || 1)
    )} ${
        state.queue.stationMode === 'locked' ? 'fijo' : 'libre'
    }`;
    const routeSummary = `${stationLabel} · ${
        state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF'
    }`;
    const networkSummary = operatorRuntime.online
        ? 'Sesión activa y red en línea'
        : 'Equipo sin red; no conviene operar así';
    const shellSummary = getShellReadiness();

    setReadinessCheck(
        'operatorReadyRoute',
        surfaceContract.state === 'alert' ? 'danger' : 'ready',
        surfaceContract.state === 'alert'
            ? surfaceContract.detail
            : routeSummary
    );
    setReadinessCheck(
        'operatorReadyNetwork',
        operatorRuntime.online ? 'ready' : 'danger',
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
    const hasDanger =
        !operatorRuntime.online || surfaceContract.state === 'alert';
    const readyForLiveUse =
        operatorRuntime.online &&
        numpadStatus.ready &&
        surfaceContract.state !== 'alert';
    const pendingCount = numpadStatus.pendingLabels.length;

    if (readinessTitle) {
        readinessTitle.textContent = hasDanger
            ? surfaceContract.state === 'alert'
                ? surfaceContract.reason === 'profile_missing'
                    ? 'Perfil de clínica no cargado'
                    : 'Ruta del piloto incorrecta'
                : 'Conexión pendiente'
            : readyForLiveUse
              ? 'Equipo listo para operar'
              : pendingCount === numpadStatus.requiredCount
                ? 'Falta validar el numpad'
                : `Faltan validar ${pendingCount} tecla(s)`;
    }

    if (readinessSummary) {
        readinessSummary.textContent = hasDanger
            ? surfaceContract.state === 'alert'
                ? surfaceContract.detail
                : 'Recupera la conexión antes de llamar o completar tickets.'
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
    const activeTicket = getActiveCalledTicketForStation();
    const waitingTicket = getWaitingForConsultorio(
        Number(state.queue.stationConsultorio || 1)
    );
    const pendingAction = state.queue.pendingSensitiveAction;

    let title;
    let summary;

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

function syncShellSettingsButton() {
    const button = getById('operatorAppSettingsBtn');
    if (!(button instanceof HTMLButtonElement)) {
        return;
    }

    const bridge = getDesktopBridge();
    const canOpenSettings = bridge && typeof bridge.openSettings === 'function';

    button.classList.toggle('is-hidden', !canOpenSettings);
    if (canOpenSettings) {
        const shellName = String(
            operatorRuntime.shell.name || 'Turnero Desktop'
        ).trim();
        const platformLabel = formatShellPlatformLabel(
            operatorRuntime.shell.platform
        );
        button.textContent =
            operatorRuntime.shell.packaged &&
            operatorRuntime.shell.platform === 'win32'
                ? 'Configurar Windows app (F10)'
                : 'Configurar app (F10)';
        button.title = operatorRuntime.shell.available
            ? `Reabre la configuracion local de ${shellName} (${platformLabel}).`
            : 'Reabre la configuracion local del shell desktop.';
    }
}

function updateOperatorChrome() {
    const state = getState();
    const stationLabel = `${getOperatorConsultorioShortLabel(
        Number(state.queue.stationConsultorio || 1)
    )} ${
        state.queue.stationMode === 'locked' ? 'bloqueado' : 'libre'
    }`;
    const oneTapLabel = state.queue.oneTap ? '1 tecla ON' : '1 tecla OFF';
    const callKey = state.queue.customCallKey
        ? String(
              state.queue.customCallKey.code ||
                  state.queue.customCallKey.key ||
                  'tecla externa'
          )
        : 'Numpad Enter';
    const shellModeLabel = getShellModeLabel();

    setText('#operatorStationSummary', stationLabel);
    setText(
        '#operatorOneTapSummary',
        `${oneTapLabel} · ${refreshStatusLabel()} · ${shellModeLabel}`
    );
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
    await refreshDesktopSnapshot();
    ensureOperatorHeartbeat().start({ immediate: false });
    updateOperatorChrome();
    startRefreshLoop();
    if (showToast) {
        createToast(
            ok ? 'Operador conectado' : 'Operador cargado con respaldo local',
            ok ? 'success' : 'warning'
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
        const bridge = getDesktopBridge();
        if (bridge && typeof bridge.openSettings === 'function') {
            await bridge.openSettings();
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
        desktopBridge.onBootStatus(() => {
            void refreshDesktopSnapshot().then(() => {
                if (getState().auth.authenticated) {
                    updateOperatorChrome();
                }
            });
        });
    }

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
