import { createSurfaceHeartbeatClient } from '../queue-shared/surface-heartbeat.js';
import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicShortName,
    getTurneroConsultorioLabel,
    getTurneroSurfaceContract,
    loadTurneroClinicProfile,
} from '../queue-shared/clinic-profile.js';
import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
} from '../queue-shared/clinic-storage.js';

const API_ENDPOINT = '/api.php';
const CHAT_ENDPOINT = '/figo-chat.php';
const QUEUE_POLL_MS = 2500;
const QUEUE_POLL_MAX_MS = 15000;
const QUEUE_STALE_THRESHOLD_MS = 30000;
const THEME_STORAGE_KEY = 'kioskThemeMode';
const KIOSK_SENIOR_MODE_STORAGE_KEY = 'queueKioskSeniorMode';
const KIOSK_IDLE_RESET_DEFAULT_MS = 90000;
const KIOSK_IDLE_RESET_MIN_MS = 5000;
const KIOSK_IDLE_RESET_MAX_MS = 15 * 60 * 1000;
const KIOSK_IDLE_WARNING_MS = 20000;
const KIOSK_IDLE_POSTPONE_MS = 15000;
const KIOSK_IDLE_TICK_MS = 1000;
const ASSISTANT_WELCOME_TEXT =
    'Hola. Soy el asistente de sala. Puedo ayudarte con check-in, turnos y ubicacion de consultorios.';
const KIOSK_OFFLINE_OUTBOX_STORAGE_KEY = 'queueKioskOfflineOutbox';
const KIOSK_OFFLINE_OUTBOX_MAX_ITEMS = 25;
const KIOSK_OFFLINE_OUTBOX_FLUSH_BATCH = 4;
const KIOSK_OFFLINE_OUTBOX_RENDER_LIMIT = 6;
const KIOSK_OFFLINE_OUTBOX_DEDUPE_MS = 90 * 1000;
const KIOSK_PRINTER_STATE_STORAGE_KEY = 'queueKioskPrinterState';
const KIOSK_STAR_STYLE_ID = 'kioskStarInlineStyles';
const KIOSK_WELCOME_HIDE_MS = 1800;
const KIOSK_WELCOME_REMOVE_MS = 2600;
const KIOSK_VOICE_GUIDE_LANG = 'es-EC';
const KIOSK_HEARTBEAT_MS = 15000;

const state = {
    queueState: null,
    chatHistory: [],
    assistantBusy: false,
    assistantSessionId: '',
    assistantMetrics: {
        intents: {},
        resolvedWithoutHuman: 0,
        escalated: 0,
        clinicalBlocked: 0,
        fallback: 0,
        errors: 0,
        actioned: 0,
        lastIntent: '',
        lastLatencyMs: 0,
    },
    queueTimerId: 0,
    queuePollingEnabled: false,
    queueFailureStreak: 0,
    queueRefreshBusy: false,
    queueManualRefreshBusy: false,
    queueLastHealthySyncAt: 0,
    themeMode: 'system',
    mediaQuery: null,
    idleTimerId: 0,
    idleTickId: 0,
    idleDeadlineTs: 0,
    idleResetMs: KIOSK_IDLE_RESET_DEFAULT_MS,
    offlineOutbox: [],
    offlineOutboxFlushBusy: false,
    lastConnectionState: '',
    lastConnectionMessage: '',
    printerState: null,
    quickHelpOpen: false,
    selectedFlow: 'checkin',
    welcomeDismissed: false,
    lastIssuedTicket: null,
    lastHelpRequest: null,
    seniorMode: false,
    voiceGuideSupported: false,
    voiceGuideBusy: false,
    voiceGuideUtterance: null,
    clinicProfile: null,
};

let kioskHeartbeat = null;

function parseStructuredStorageValue(rawValue) {
    if (!rawValue) return null;
    if (typeof rawValue === 'object') {
        return rawValue;
    }
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return null;
    }
    try {
        const parsed = JSON.parse(rawValue);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error) {
        return null;
    }
}

function normalizeStoredBoolean(rawValue, fallbackValue = false) {
    if (
        rawValue === true ||
        rawValue === 1 ||
        rawValue === '1' ||
        rawValue === 'true'
    ) {
        return true;
    }
    if (
        rawValue === false ||
        rawValue === 0 ||
        rawValue === '0' ||
        rawValue === 'false'
    ) {
        return false;
    }
    return Boolean(fallbackValue);
}

function normalizePrinterStateStorage(rawValue) {
    const parsed = parseStructuredStorageValue(rawValue);
    if (!parsed || Array.isArray(parsed)) {
        return null;
    }

    return {
        ok: Boolean(parsed.ok),
        printed: Boolean(parsed.printed),
        errorCode: String(parsed.errorCode || ''),
        message: String(parsed.message || ''),
        at: String(parsed.at || new Date().toISOString()),
    };
}

function normalizeOfflineOutboxStorage(rawValue) {
    let parsed = rawValue;
    if (typeof rawValue === 'string') {
        try {
            parsed = JSON.parse(rawValue);
        } catch (_error) {
            parsed = null;
        }
    }
    if (!Array.isArray(parsed)) {
        return [];
    }

    return parsed
        .map((item) => ({
            id: String(item?.id || ''),
            resource: String(item?.resource || ''),
            body:
                item && typeof item.body === 'object' && item.body
                    ? item.body
                    : {},
            originLabel: String(item?.originLabel || 'Solicitud offline'),
            patientInitials: String(item?.patientInitials || '--'),
            queueType: String(item?.queueType || '--'),
            renderMode:
                String(item?.renderMode || 'ticket').toLowerCase() ===
                'support'
                    ? 'support'
                    : 'ticket',
            queuedAt: String(item?.queuedAt || new Date().toISOString()),
            attempts: Number(item?.attempts || 0),
            lastError: String(item?.lastError || ''),
            fingerprint: String(item?.fingerprint || ''),
        }))
        .filter(
            (item) =>
                item.id &&
                (item.resource === 'queue-ticket' ||
                    item.resource === 'queue-checkin' ||
                    item.resource === 'queue-help-request')
        )
        .map((item) => ({
            ...item,
            fingerprint:
                item.fingerprint ||
                buildOutboxFingerprint(item.resource, item.body),
        }))
        .slice(0, KIOSK_OFFLINE_OUTBOX_MAX_ITEMS);
}

function createRuntimeId(prefix = 'runtime') {
    const safePrefix = String(prefix || 'runtime').trim() || 'runtime';
    try {
        if (
            typeof window !== 'undefined' &&
            window.crypto &&
            typeof window.crypto.randomUUID === 'function'
        ) {
            return `${safePrefix}_${window.crypto.randomUUID()}`;
        }
    } catch (_error) {
        // no-op
    }

    return `${safePrefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function emitQueueOpsEvent(eventName, detail = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'kiosk',
                    event: String(eventName || 'unknown'),
                    at: new Date().toISOString(),
                    ...detail,
                },
            })
        );
    } catch (_error) {
        // no-op
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getById(id) {
    return document.getElementById(id);
}

function getKioskConsultorioLabel(consultorio) {
    return getTurneroConsultorioLabel(state.clinicProfile, consultorio);
}

function renderKioskProfileStatus(profile) {
    const surfaceContract = getKioskSurfaceContract(profile);
    const profileFingerprint = getTurneroClinicProfileFingerprint(profile).slice(
        0,
        8
    );
    const el = getById('kioskProfileStatus');
    if (!(el instanceof HTMLElement)) {
        return;
    }

    el.dataset.state =
        surfaceContract.state === 'alert'
            ? 'alert'
            : surfaceContract.state === 'ready'
              ? 'ready'
              : 'warning';
    el.textContent =
        surfaceContract.state === 'alert'
            ? surfaceContract.reason === 'profile_missing'
                ? 'Bloqueado · perfil de respaldo · clinic-profile.json remoto ausente'
                : `Bloqueado · ruta fuera de canon · se esperaba ${surfaceContract.expectedRoute || '/kiosco-turnos.html'}`
            : `Perfil remoto verificado · firma ${profileFingerprint} · canon ${surfaceContract.expectedRoute || '/kiosco-turnos.html'}`;
}

function getKioskSurfaceContract(profile = state.clinicProfile) {
    return getTurneroSurfaceContract(profile, 'kiosk');
}

function getKioskPilotBlockMessage() {
    const surfaceContract = getKioskSurfaceContract();
    if (surfaceContract.state !== 'alert') {
        return '';
    }

    if (surfaceContract.reason === 'profile_missing') {
        return 'No se puede operar este kiosco: clinic-profile.json remoto ausente. Corrige el perfil y recarga la página antes de recibir pacientes.';
    }

    return `No se puede operar este kiosco: la ruta no coincide con el canon del piloto (${surfaceContract.expectedRoute || '/kiosco-turnos.html'}). Abre la ruta correcta antes de registrar turnos.`;
}

function isKioskPilotBlocked() {
    return getKioskSurfaceContract().state === 'alert';
}

function applyKioskPilotBlockFeedback() {
    const message = getKioskPilotBlockMessage();
    if (!message) {
        return false;
    }

    setKioskStatus(message, 'error');
    setKioskProgressHint(
        'Este equipo queda bloqueado hasta cargar el perfil remoto correcto y la ruta canónica del piloto.',
        'warn'
    );
    return true;
}

function applyKioskClinicProfile(profile) {
    state.clinicProfile = profile;
    const clinicName = getTurneroClinicBrandName(profile);
    const clinicShortName = getTurneroClinicShortName(profile);
    const clinicId = String(profile?.clinic_id || '').trim() || 'sin-clinic-id';
    const clinicCity = String(profile?.branding?.city || '').trim();
    const kioskRoute = String(
        profile?.surfaces?.kiosk?.route || '/kiosco-turnos.html'
    ).trim();
    const consultorioSummary = [
        getKioskConsultorioLabel(1),
        getKioskConsultorioLabel(2),
    ].join(' · ');
    document.title = `Kiosco de Turnos | ${clinicName}`;

    const welcomeBrand = document.querySelector('#kioskWelcomeScreen strong');
    if (welcomeBrand instanceof HTMLElement) {
        welcomeBrand.textContent = `Bienvenida a ${clinicName}`;
    }

    const headerBrand = document.querySelector('.kiosk-brand strong');
    if (headerBrand instanceof HTMLElement) {
        headerBrand.textContent = clinicName;
    }

    const clinicMeta = getById('kioskClinicMeta');
    if (clinicMeta instanceof HTMLElement) {
        clinicMeta.textContent = [clinicId, clinicCity || clinicShortName]
            .filter(Boolean)
            .join(' · ');
    }

    const clinicContext = getById('kioskClinicContext');
    if (clinicContext instanceof HTMLElement) {
        clinicContext.textContent = `${clinicShortName} · ${kioskRoute} · ${consultorioSummary}`;
    }
    renderKioskProfileStatus(profile);

    const headerNote = document.querySelector('.kiosk-header-note');
    if (headerNote instanceof HTMLElement) {
        headerNote.textContent = `Piloto web por clínica · ${clinicCity || clinicShortName}`;
    }
}

function resolveKioskAppMode() {
    return typeof window.turneroDesktop === 'object' &&
        window.turneroDesktop !== null &&
        typeof window.turneroDesktop.openSettings === 'function'
        ? 'desktop'
        : 'web';
}

function buildKioskHeartbeatPayload() {
    const connectionState = String(state.lastConnectionState || 'paused');
    const pendingCount = Number(state.offlineOutbox.length || 0);
    const printer = state.printerState;
    const printerPrinted = Boolean(printer?.printed);
    const printerErrorCode = String(printer?.errorCode || '');
    const healthySync = Boolean(state.queueLastHealthySyncAt);
    const surfaceContract = getKioskSurfaceContract();
    const clinicId = String(state.clinicProfile?.clinic_id || '').trim();
    const clinicName = String(
        state.clinicProfile?.branding?.name ||
            state.clinicProfile?.branding?.short_name ||
            ''
    ).trim();
    const profileFingerprint = getTurneroClinicProfileFingerprint(
        state.clinicProfile
    );
    const profileSource = String(
        state.clinicProfile?.runtime_meta?.source || 'remote'
    ).trim();

    let status = 'warning';
    let summary = 'Kiosco pendiente de validación.';
    if (surfaceContract.state === 'alert') {
        status = 'alert';
        summary = surfaceContract.detail;
    } else if (connectionState === 'offline') {
        status = 'alert';
        summary =
            'Kiosco sin conexión; usa contingencia local y deriva si crece la fila.';
    } else if (pendingCount > 0) {
        status = 'warning';
        summary = `Kiosco con ${pendingCount} pendiente(s) offline por sincronizar.`;
    } else if (printer && !printerPrinted) {
        status = 'alert';
        summary = `La última impresión falló${printerErrorCode ? ` (${printerErrorCode})` : ''}.`;
    } else if (printerPrinted && healthySync && connectionState === 'live') {
        status = 'ready';
        summary =
            'Kiosco listo: cola en vivo, térmica validada y sin pendientes offline.';
    } else if (!printerPrinted) {
        status = 'warning';
        summary = 'Falta probar ticket térmico antes de abrir autoservicio.';
    }

    return {
        instance: 'main',
        deviceLabel: 'Kiosco principal',
        appMode: resolveKioskAppMode(),
        status,
        summary,
        networkOnline: navigator.onLine !== false,
        lastEvent: printerPrinted ? 'printer_ok' : 'heartbeat',
        lastEventAt: printer?.at || new Date().toISOString(),
        details: {
            connection: connectionState,
            pendingOffline: pendingCount,
            printerPrinted,
            printerErrorCode,
            healthySync,
            flow: String(state.selectedFlow || 'checkin'),
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

function ensureKioskHeartbeat() {
    if (kioskHeartbeat) {
        return kioskHeartbeat;
    }

    kioskHeartbeat = createSurfaceHeartbeatClient({
        surface: 'kiosk',
        intervalMs: KIOSK_HEARTBEAT_MS,
        getPayload: buildKioskHeartbeatPayload,
    });
    return kioskHeartbeat;
}

function notifyKioskHeartbeat(reason = 'state_change') {
    ensureKioskHeartbeat().notify(reason);
}

function ensureKioskStarStyles() {
    if (document.getElementById(KIOSK_STAR_STYLE_ID)) {
        return;
    }

    const styleEl = document.createElement('style');
    styleEl.id = KIOSK_STAR_STYLE_ID;
    styleEl.textContent = `
        body[data-kiosk-mode='star'] .kiosk-header {
            border-bottom-color: color-mix(in srgb, var(--primary) 18%, var(--border));
            box-shadow: 0 10px 28px rgb(15 31 54 / 10%);
        }
        .kiosk-header-tools {
            display: grid;
            gap: 0.35rem;
            justify-items: end;
        }
        .kiosk-header-controls {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.45rem;
            width: 100%;
            max-width: 620px;
        }
        .kiosk-header-help-btn {
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 0.34rem 0.72rem;
            background: var(--surface-soft);
            color: var(--text);
            font-size: 0.86rem;
            font-weight: 600;
            cursor: pointer;
            min-height: 44px;
        }
        .kiosk-header-help-btn[data-variant='warning'] {
            border-color: color-mix(in srgb, #b45309 32%, #fff 68%);
            background: color-mix(in srgb, #fef3c7 88%, #fff 12%);
            color: #92400e;
        }
        .kiosk-header-help-btn[data-open='true'] {
            border-color: color-mix(in srgb, var(--primary) 38%, #fff 62%);
            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);
            color: var(--primary-strong);
        }
        .kiosk-header-help-btn[data-active='true'] {
            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);
            background: color-mix(in srgb, var(--surface-strong) 84%, #fff 16%);
            color: var(--primary-strong);
            box-shadow: 0 10px 24px rgb(15 107 220 / 15%);
        }
        .kiosk-header-help-btn[disabled] {
            opacity: 0.65;
            cursor: not-allowed;
            box-shadow: none;
        }
        .kiosk-quick-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.65rem;
            margin: 0.45rem 0 0.6rem;
        }
        .kiosk-quick-action {
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 0.8rem 0.92rem;
            background: var(--surface-soft);
            color: var(--text);
            font-size: 1rem;
            font-weight: 700;
            letter-spacing: 0.01em;
            cursor: pointer;
            min-height: 64px;
            text-align: left;
        }
        .kiosk-quick-action[data-active='true'] {
            border-color: color-mix(in srgb, var(--primary) 42%, #fff 58%);
            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);
            color: var(--primary-strong);
            box-shadow: 0 12px 26px rgb(15 107 220 / 14%);
        }
        .kiosk-progress-hint {
            margin: 0 0 0.72rem;
            color: var(--muted);
            font-size: 0.95rem;
            font-weight: 600;
        }
        .kiosk-progress-hint[data-tone='success'] {
            color: var(--success);
        }
        .kiosk-progress-hint[data-tone='warn'] {
            color: #9a6700;
        }
        .kiosk-quick-help-panel {
            margin: 0 0 0.9rem;
            border: 1px solid color-mix(in srgb, var(--primary) 24%, #fff 76%);
            border-radius: 16px;
            padding: 0.88rem 0.95rem;
            background: color-mix(in srgb, var(--surface-strong) 86%, #fff 14%);
        }
        .kiosk-quick-help-panel h2 {
            margin: 0 0 0.46rem;
            font-size: 1.08rem;
        }
        .kiosk-quick-help-panel ol {
            margin: 0 0 0.56rem;
            padding-left: 1.12rem;
            color: var(--text);
            line-height: 1.45;
        }
        .kiosk-quick-help-panel p {
            margin: 0 0 0.6rem;
            color: var(--muted);
            font-size: 0.9rem;
        }
        .kiosk-quick-help-panel button {
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 0.46rem 0.74rem;
            background: #fff;
            color: var(--text);
            font-weight: 600;
            cursor: pointer;
            min-height: 44px;
        }
        .kiosk-form.is-flow-active {
            border-color: color-mix(in srgb, var(--primary) 32%, var(--border) 68%);
            box-shadow: 0 14px 28px rgb(15 107 220 / 11%);
        }
        body[data-kiosk-senior='on'] {
            font-size: 18px;
        }
        body[data-kiosk-senior='on'] .kiosk-layout {
            gap: 1.2rem;
        }
        body[data-kiosk-senior='on'] h1 {
            font-size: clamp(2rem, 3vw, 2.55rem);
            line-height: 1.15;
        }
        body[data-kiosk-senior='on'] .kiosk-form label,
        body[data-kiosk-senior='on'] .kiosk-progress-hint,
        body[data-kiosk-senior='on'] .kiosk-status {
            font-size: 1.08rem;
        }
        body[data-kiosk-senior='on'] .kiosk-form input,
        body[data-kiosk-senior='on'] .assistant-form input {
            min-height: 64px;
            font-size: 1.18rem;
        }
        body[data-kiosk-senior='on'] .kiosk-form button,
        body[data-kiosk-senior='on'] .assistant-form button {
            min-height: 68px;
            font-size: 1.16rem;
        }
        body[data-kiosk-senior='on'] .kiosk-quick-action {
            min-height: 76px;
            font-size: 1.13rem;
        }
        body[data-kiosk-senior='on'] .kiosk-header-help-btn {
            min-height: 52px;
            font-size: 0.97rem;
            padding: 0.45rem 0.84rem;
        }
        body[data-kiosk-senior='on'] .queue-kpi-row article strong {
            font-size: 2.3rem;
        }
        body[data-kiosk-senior='on'] .ticket-result-main strong {
            font-size: 2.6rem;
        }
        body[data-kiosk-senior='on'] #kioskSeniorHint {
            color: color-mix(in srgb, var(--primary) 72%, #1f2937 28%);
        }
        .kiosk-quick-action:focus-visible,
        .kiosk-header-help-btn:focus-visible,
        .kiosk-quick-help-panel button:focus-visible {
            outline: 3px solid color-mix(in srgb, var(--primary) 62%, #fff 38%);
            outline-offset: 2px;
        }
        @media (max-width: 760px) {
            .kiosk-header-tools {
                justify-items: start;
            }
            .kiosk-header-controls {
                grid-template-columns: 1fr;
            }
            .kiosk-quick-actions {
                grid-template-columns: 1fr;
            }
        }
        @media (prefers-reduced-motion: reduce) {
            .kiosk-quick-action,
            .kiosk-header-help-btn,
            .kiosk-form {
                transition: none !important;
            }
        }
    `;
    document.head.appendChild(styleEl);
}

function setKioskProgressHint(message, tone = 'info') {
    const hintEl = getById('kioskProgressHint');
    if (!(hintEl instanceof HTMLElement)) return;
    const normalizedTone = ['info', 'warn', 'success'].includes(
        String(tone || '').toLowerCase()
    )
        ? String(tone || '').toLowerCase()
        : 'info';
    const nextText =
        String(message || '').trim() ||
        'Paso 1 de 2: selecciona una opcion para comenzar.';
    hintEl.dataset.tone = normalizedTone;
    hintEl.textContent = nextText;
}

function setKioskSeniorHint(message, tone = 'info') {
    const hintEl = getById('kioskSeniorHint');
    if (!(hintEl instanceof HTMLElement)) return;
    const normalizedTone = ['info', 'warn', 'success'].includes(
        String(tone || '').toLowerCase()
    )
        ? String(tone || '').toLowerCase()
        : 'info';
    hintEl.dataset.tone = normalizedTone;
    hintEl.textContent =
        String(message || '').trim() ||
        'Si necesitas letra mas grande, usa "Modo lectura grande".';
}

function readSeniorModePreference() {
    return readClinicScopedStorageValue(
        KIOSK_SENIOR_MODE_STORAGE_KEY,
        state.clinicProfile,
        {
            fallbackValue: false,
            normalizeValue: normalizeStoredBoolean,
        }
    );
}

function persistSeniorModePreference(enabled) {
    persistClinicScopedStorageValue(
        KIOSK_SENIOR_MODE_STORAGE_KEY,
        state.clinicProfile,
        enabled ? '1' : '0'
    );
}

function syncSeniorModeButton() {
    const seniorToggle = getById('kioskSeniorToggle');
    if (!(seniorToggle instanceof HTMLButtonElement)) return;
    const enabled = Boolean(state.seniorMode);
    seniorToggle.dataset.active = enabled ? 'true' : 'false';
    seniorToggle.setAttribute('aria-pressed', String(enabled));
    seniorToggle.textContent = `Modo lectura grande: ${enabled ? 'On' : 'Off'}`;
}

function setSeniorModeEnabled(
    nextEnabled,
    { persist = true, source = 'ui' } = {}
) {
    const enabled = Boolean(nextEnabled);
    state.seniorMode = enabled;
    document.body.dataset.kioskSenior = enabled ? 'on' : 'off';
    syncSeniorModeButton();
    if (persist) {
        persistSeniorModePreference(enabled);
    }
    setKioskSeniorHint(
        enabled
            ? 'Modo lectura grande activo. Botones y textos ampliados.'
            : 'Modo lectura grande desactivado.',
        enabled ? 'success' : 'info'
    );
    emitQueueOpsEvent('senior_mode_changed', {
        enabled,
        source,
    });
}

function toggleSeniorMode({ source = 'ui' } = {}) {
    setSeniorModeEnabled(!state.seniorMode, { persist: true, source });
}

function supportsVoiceGuide() {
    return (
        typeof window !== 'undefined' &&
        'speechSynthesis' in window &&
        typeof window.speechSynthesis?.speak === 'function' &&
        typeof window.SpeechSynthesisUtterance === 'function'
    );
}

function syncVoiceGuideButton() {
    const voiceBtn = getById('kioskVoiceGuideBtn');
    if (!(voiceBtn instanceof HTMLButtonElement)) return;

    const supported = Boolean(state.voiceGuideSupported);
    const busy = Boolean(state.voiceGuideBusy);
    voiceBtn.disabled = !supported && !busy;
    voiceBtn.textContent = !supported
        ? 'Voz guia no disponible'
        : busy
          ? 'Leyendo instrucciones...'
          : 'Leer instrucciones';
}

function stopVoiceGuide({ source = 'manual' } = {}) {
    if (!supportsVoiceGuide()) {
        state.voiceGuideBusy = false;
        state.voiceGuideUtterance = null;
        syncVoiceGuideButton();
        return;
    }
    try {
        window.speechSynthesis.cancel();
    } catch (_error) {
        // ignore platform errors
    }
    state.voiceGuideBusy = false;
    state.voiceGuideUtterance = null;
    syncVoiceGuideButton();
    emitQueueOpsEvent('voice_guide_stopped', { source });
}

function buildVoiceGuideText() {
    const flowHint =
        state.selectedFlow === 'walkin'
            ? 'Si no tienes cita, escribe iniciales y pulsa Generar turno.'
            : 'Si tienes cita, escribe telefono, fecha y hora y pulsa Confirmar check in.';
    const clinicName = getTurneroClinicBrandName(state.clinicProfile);
    return `Bienvenida al kiosco de turnos de ${clinicName}. ${flowHint} Si necesitas ayuda, pulsa Necesito apoyo y recepcion te asistira. Conserva tu ticket y espera el llamado en la pantalla de sala.`;
}

function runVoiceGuide({ source = 'button' } = {}) {
    if (!state.voiceGuideSupported) {
        setKioskStatus(
            'Guia por voz no disponible en este navegador. Usa ayuda rapida en pantalla.',
            'info'
        );
        setKioskSeniorHint(
            'Sin voz guia en este equipo. Usa ayuda rapida o pide apoyo.',
            'warn'
        );
        emitQueueOpsEvent('voice_guide_unavailable', { source });
        return;
    }

    stopVoiceGuide({ source: 'restart' });
    const text = buildVoiceGuideText();
    let utterance;
    try {
        utterance = new window.SpeechSynthesisUtterance(text);
    } catch (_error) {
        setKioskStatus(
            'No se pudo iniciar guia por voz en este equipo.',
            'error'
        );
        emitQueueOpsEvent('voice_guide_error', {
            source,
            reason: 'utterance_create_failed',
        });
        return;
    }

    utterance.lang = KIOSK_VOICE_GUIDE_LANG;
    utterance.rate = 0.92;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
        state.voiceGuideBusy = true;
        syncVoiceGuideButton();
    };
    utterance.onend = () => {
        state.voiceGuideBusy = false;
        state.voiceGuideUtterance = null;
        syncVoiceGuideButton();
        emitQueueOpsEvent('voice_guide_finished', { source });
    };
    utterance.onerror = () => {
        state.voiceGuideBusy = false;
        state.voiceGuideUtterance = null;
        syncVoiceGuideButton();
        setKioskStatus(
            'La guia por voz se interrumpio. Puedes intentar nuevamente.',
            'error'
        );
        emitQueueOpsEvent('voice_guide_error', {
            source,
            reason: 'speech_error',
        });
    };

    try {
        state.voiceGuideUtterance = utterance;
        state.voiceGuideBusy = true;
        syncVoiceGuideButton();
        window.speechSynthesis.speak(utterance);
        setKioskStatus('Guia por voz iniciada.', 'info');
        setKioskSeniorHint(
            'Escuchando guia por voz. Puedes seguir los pasos en pantalla.',
            'success'
        );
        emitQueueOpsEvent('voice_guide_started', { source });
    } catch (_error) {
        state.voiceGuideBusy = false;
        state.voiceGuideUtterance = null;
        syncVoiceGuideButton();
        setKioskStatus('No se pudo reproducir guia por voz.', 'error');
        emitQueueOpsEvent('voice_guide_error', {
            source,
            reason: 'speech_start_failed',
        });
    }
}

function supportReasonMessage(reason) {
    const normalized = String(reason || 'general').toLowerCase();
    if (normalized === 'clinical_redirect') {
        return 'Recepcion fue alertada para derivarte con el personal adecuado.';
    }
    if (normalized === 'printer_issue' || normalized === 'reprint_requested') {
        return 'Recepcion revisara la impresion o reimpresion de tu ticket enseguida.';
    }
    if (normalized === 'appointment_not_found') {
        return 'Recepcion revisara tu cita y te ayudara a continuar.';
    }
    if (normalized === 'special_priority') {
        return 'Recepcion fue alertada para darte apoyo prioritario.';
    }
    if (normalized === 'accessibility') {
        return 'Recepcion te brindara apoyo para completar el proceso.';
    }
    return 'Recepcion te ayudara enseguida. Mantente frente al kiosco o acude al mostrador.';
}

async function requestReceptionSupport({
    source = 'button',
    reason = 'general',
    message = '',
    intent = '',
    announceInAssistant = true,
} = {}) {
    const body = buildHelpRequestBody(reason, message, source, intent);
    const supportMessage = supportReasonMessage(reason);

    try {
        const payload = await apiRequest('queue-help-request', {
            method: 'POST',
            body,
        });
        const helpRequest =
            payload?.data?.helpRequest &&
            typeof payload.data.helpRequest === 'object'
                ? payload.data.helpRequest
                : null;
        state.lastHelpRequest = helpRequest;
        applyQueueStatePayload(payload);

        setKioskStatus(supportMessage, 'info');
        setKioskProgressHint(
            'Apoyo solicitado: recepcion te asistira para completar el turno.',
            'warn'
        );
        if (announceInAssistant) {
            appendAssistantMessage('bot', supportMessage);
        }
        emitQueueOpsEvent('reception_support_requested', {
            source,
            reason,
            requestId: helpRequest?.id || 0,
        });
        return {
            ok: true,
            queued: false,
            message: supportMessage,
            helpRequest,
        };
    } catch (error) {
        if (!isRecoverableTransportError(error)) {
            const errorMessage = `No se pudo solicitar apoyo: ${error.message}`;
            setKioskStatus(errorMessage, 'error');
            emitQueueOpsEvent('reception_support_error', {
                source,
                reason,
                error: String(error?.message || ''),
            });
            return {
                ok: false,
                queued: false,
                message: errorMessage,
                helpRequest: null,
            };
        }

        const queuedRequest = queueOfflineRequest({
            resource: 'queue-help-request',
            body,
            originLabel: 'Apoyo a recepcion',
            patientInitials: body.patientInitials,
            queueType: 'support',
            renderMode: 'support',
        });
        state.lastHelpRequest = queuedRequest;
        setKioskStatus(
            'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.',
            'info'
        );
        setKioskProgressHint(
            'Apoyo pendiente de sincronizacion: si es urgente, acude al mostrador.',
            'warn'
        );
        if (announceInAssistant) {
            appendAssistantMessage(
                'bot',
                'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.'
            );
        }
        emitQueueOpsEvent('reception_support_queued', {
            source,
            reason,
            pendingAfter: state.offlineOutbox.length,
        });
        return {
            ok: true,
            queued: true,
            message:
                'Apoyo guardado offline. Se notificara a recepcion al recuperar conexion.',
            helpRequest: queuedRequest,
        };
    }
}

function setKioskHelpPanelOpen(nextOpen, { source = 'ui' } = {}) {
    const panel = getById('kioskQuickHelpPanel');
    const toggle = getById('kioskHelpToggle');
    if (
        !(panel instanceof HTMLElement) ||
        !(toggle instanceof HTMLButtonElement)
    ) {
        return;
    }

    const open = Boolean(nextOpen);
    state.quickHelpOpen = open;
    panel.hidden = !open;
    toggle.dataset.open = open ? 'true' : 'false';
    toggle.setAttribute('aria-expanded', String(open));
    emitQueueOpsEvent('quick_help_toggled', {
        open,
        source,
    });
    if (open) {
        setKioskProgressHint(
            'Guia abierta: elige opcion, completa datos y confirma ticket.',
            'info'
        );
    } else {
        setKioskProgressHint(
            'Paso 1 de 2: selecciona una opcion para comenzar.',
            'info'
        );
    }
}

function focusFlowTarget(target, { announce = true } = {}) {
    const normalized =
        String(target || '').toLowerCase() === 'walkin' ? 'walkin' : 'checkin';
    state.selectedFlow = normalized;

    const checkinForm = getById('checkinForm');
    const walkinForm = getById('walkinForm');
    if (checkinForm instanceof HTMLElement) {
        checkinForm.classList.toggle(
            'is-flow-active',
            normalized === 'checkin'
        );
    }
    if (walkinForm instanceof HTMLElement) {
        walkinForm.classList.toggle('is-flow-active', normalized === 'walkin');
    }

    const quickCheckin = getById('kioskQuickCheckin');
    const quickWalkin = getById('kioskQuickWalkin');
    if (quickCheckin instanceof HTMLButtonElement) {
        const active = normalized === 'checkin';
        quickCheckin.dataset.active = active ? 'true' : 'false';
        quickCheckin.setAttribute('aria-pressed', String(active));
    }
    if (quickWalkin instanceof HTMLButtonElement) {
        const active = normalized === 'walkin';
        quickWalkin.dataset.active = active ? 'true' : 'false';
        quickWalkin.setAttribute('aria-pressed', String(active));
    }

    const targetInputId =
        normalized === 'walkin' ? 'walkinInitials' : 'checkinPhone';
    const targetInput = getById(targetInputId);
    if (targetInput instanceof HTMLInputElement) {
        targetInput.focus({ preventScroll: false });
    }

    if (announce) {
        setKioskProgressHint(
            normalized === 'walkin'
                ? 'Paso 2: escribe iniciales y pulsa "Generar turno".'
                : 'Paso 2: escribe telefono, fecha y hora para check-in.',
            'info'
        );
    }
    emitQueueOpsEvent('flow_focus', {
        target: normalized,
    });
}

function getQueueStateArray(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return [];
    }
    for (const key of keys) {
        if (!key) continue;
        if (Array.isArray(source[key])) {
            return source[key];
        }
    }
    return [];
}

function getQueueStateObject(source, keys) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return null;
    }
    for (const key of keys) {
        if (!key) continue;
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
    }
    return null;
}

function getQueueStateNumber(source, keys, fallback = 0) {
    if (!source || typeof source !== 'object' || !Array.isArray(keys)) {
        return Number(fallback || 0);
    }
    for (const key of keys) {
        if (!key) continue;
        const value = Number(source[key]);
        if (Number.isFinite(value)) {
            return value;
        }
    }
    return Number(fallback || 0);
}

function normalizeQueueStatePayload(rawState) {
    const state = rawState && typeof rawState === 'object' ? rawState : {};
    const counts = getQueueStateObject(state, ['counts']) || {};
    const waitingCountRaw = getQueueStateNumber(
        state,
        ['waitingCount', 'waiting_count'],
        Number.NaN
    );
    const calledCountRaw = getQueueStateNumber(
        state,
        ['calledCount', 'called_count'],
        Number.NaN
    );

    let callingNow = getQueueStateArray(state, [
        'callingNow',
        'calling_now',
        'calledTickets',
        'called_tickets',
    ]);
    if (callingNow.length === 0) {
        const byConsultorio = getQueueStateObject(state, [
            'callingNowByConsultorio',
            'calling_now_by_consultorio',
        ]);
        if (byConsultorio) {
            callingNow = Object.values(byConsultorio).filter(Boolean);
        }
    }

    const nextTickets = getQueueStateArray(state, [
        'nextTickets',
        'next_tickets',
        'waitingTickets',
        'waiting_tickets',
    ]);
    const activeHelpRequests = getQueueStateArray(state, [
        'activeHelpRequests',
        'active_help_requests',
    ]);

    const waitingCount = Number.isFinite(waitingCountRaw)
        ? waitingCountRaw
        : getQueueStateNumber(
              counts,
              ['waiting', 'waiting_count'],
              nextTickets.length
          );
    const calledCount = Number.isFinite(calledCountRaw)
        ? calledCountRaw
        : getQueueStateNumber(
              counts,
              ['called', 'called_count'],
              callingNow.length
          );
    const estimatedWaitMin = Math.max(
        0,
        getQueueStateNumber(
            state,
            ['estimatedWaitMin', 'estimated_wait_min'],
            waitingCount * 8
        )
    );
    const assistancePendingCount = Math.max(
        0,
        getQueueStateNumber(
            state,
            ['assistancePendingCount', 'assistance_pending_count'],
            activeHelpRequests.length
        )
    );

    return {
        updatedAt:
            String(state.updatedAt || state.updated_at || '').trim() ||
            new Date().toISOString(),
        waitingCount: Math.max(0, Number(waitingCount || 0)),
        calledCount: Math.max(0, Number(calledCount || 0)),
        estimatedWaitMin,
        delayReason: String(
            state.delayReason || state.delay_reason || ''
        ).trim(),
        assistancePendingCount,
        callingNow: Array.isArray(callingNow)
            ? callingNow.map((ticket) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: String(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: String(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  assignedConsultorio:
                      Number(
                          ticket?.assignedConsultorio ??
                              ticket?.assigned_consultorio ??
                              0
                      ) || null,
                  calledAt: String(ticket?.calledAt || ticket?.called_at || ''),
              }))
            : [],
        nextTickets: Array.isArray(nextTickets)
            ? nextTickets.map((ticket, index) => ({
                  ...ticket,
                  id: Number(ticket?.id || ticket?.ticket_id || 0) || 0,
                  ticketCode: String(
                      ticket?.ticketCode || ticket?.ticket_code || '--'
                  ),
                  patientInitials: String(
                      ticket?.patientInitials ||
                          ticket?.patient_initials ||
                          '--'
                  ),
                  queueType: String(
                      ticket?.queueType || ticket?.queue_type || 'walk_in'
                  ),
                  priorityClass: String(
                      ticket?.priorityClass ||
                          ticket?.priority_class ||
                          'walk_in'
                  ),
                  needsAssistance: Boolean(
                      ticket?.needsAssistance ?? ticket?.needs_assistance
                  ),
                  assistanceRequestStatus: String(
                      ticket?.assistanceRequestStatus ||
                          ticket?.assistance_request_status ||
                          ''
                  ),
                  activeHelpRequestId:
                      Number(
                          ticket?.activeHelpRequestId ??
                              ticket?.active_help_request_id ??
                              0
                      ) || null,
                  specialPriority: Boolean(
                      ticket?.specialPriority ?? ticket?.special_priority
                  ),
                  lateArrival: Boolean(
                      ticket?.lateArrival ?? ticket?.late_arrival
                  ),
                  reprintRequestedAt: String(
                      ticket?.reprintRequestedAt ||
                          ticket?.reprint_requested_at ||
                          ''
                  ),
                  estimatedWaitMin: Math.max(
                      0,
                      Number(
                          ticket?.estimatedWaitMin ??
                              ticket?.estimated_wait_min ??
                              (index + 1) * 8
                      ) || 0
                  ),
                  position:
                      Number(ticket?.position || 0) > 0
                          ? Number(ticket.position)
                          : index + 1,
              }))
            : [],
        activeHelpRequests: Array.isArray(activeHelpRequests)
            ? activeHelpRequests.map((item) => ({
                  ...item,
                  id: Number(item?.id || 0) || 0,
                  ticketId: Number(item?.ticketId || item?.ticket_id || 0) || 0,
                  ticketCode: String(
                      item?.ticketCode || item?.ticket_code || ''
                  ),
                  patientInitials: String(
                      item?.patientInitials || item?.patient_initials || '--'
                  ),
                  reason: String(item?.reason || 'general'),
                  reasonLabel: String(
                      item?.reasonLabel || item?.reason_label || 'Apoyo general'
                  ),
                  status: String(item?.status || 'pending'),
                  source: String(item?.source || 'kiosk'),
                  createdAt: String(item?.createdAt || item?.created_at || ''),
                  updatedAt: String(item?.updatedAt || item?.updated_at || ''),
              }))
            : [],
    };
}

function applyQueueStatePayload(payload) {
    const queueStateCandidate =
        payload?.data?.queueState ||
        payload?.queueState ||
        payload?.data ||
        payload;
    if (!queueStateCandidate || typeof queueStateCandidate !== 'object') {
        return null;
    }

    const normalized = normalizeQueueStatePayload(queueStateCandidate);
    state.queueState = normalized;
    renderQueuePanel(normalized);
    renderQueueUpdatedAt(normalized.updatedAt);
    return normalized;
}

async function apiRequest(resource, { method = 'GET', body } = {}) {
    const params = new URLSearchParams();
    params.set('resource', resource);
    params.set('t', String(Date.now()));
    const response = await fetch(`${API_ENDPOINT}?${params.toString()}`, {
        method,
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            ...(body !== undefined
                ? { 'Content-Type': 'application/json' }
                : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const responseText = await response.text();
    let payload;
    try {
        payload = responseText ? JSON.parse(responseText) : {};
    } catch (_error) {
        throw new Error('Respuesta invalida del servidor');
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return payload;
}

function deriveInitials(rawName) {
    const name = String(rawName || '').trim();
    if (!name) return '';

    const words = name
        .toUpperCase()
        .split(/\s+/)
        .map((word) => word.replace(/[^A-Z]/g, ''))
        .filter(Boolean);

    if (words.length === 0) return '';

    let initials = '';
    for (const word of words) {
        initials += word.slice(0, 1);
        if (initials.length >= 3) break;
    }
    return initials.slice(0, 4);
}

function ensureAssistantSessionId() {
    if (!state.assistantSessionId) {
        state.assistantSessionId = createRuntimeId('assistant');
    }
    return state.assistantSessionId;
}

function recordAssistantMetric(intent, outcome, startedAt, detail = {}) {
    const safeIntent = String(intent || 'unknown').trim() || 'unknown';
    const safeOutcome = String(outcome || 'unknown').trim() || 'unknown';
    const latencyMs = Math.max(
        0,
        Math.round(performance.now() - Number(startedAt || performance.now()))
    );
    const metrics = state.assistantMetrics || {
        intents: {},
        resolvedWithoutHuman: 0,
        escalated: 0,
        clinicalBlocked: 0,
        fallback: 0,
        errors: 0,
        actioned: 0,
        lastIntent: '',
        lastLatencyMs: 0,
    };

    metrics.intents = metrics.intents || {};
    metrics.intents[safeIntent] = (metrics.intents[safeIntent] || 0) + 1;
    metrics.lastIntent = safeIntent;
    metrics.lastLatencyMs = latencyMs;
    metrics.actioned += 1;
    if (safeOutcome === 'resolved') {
        metrics.resolvedWithoutHuman += 1;
    } else if (safeOutcome === 'handoff') {
        metrics.escalated += 1;
    } else if (safeOutcome === 'clinical_blocked') {
        metrics.clinicalBlocked += 1;
    } else if (safeOutcome === 'fallback') {
        metrics.fallback += 1;
    } else if (safeOutcome === 'error') {
        metrics.errors += 1;
    }
    state.assistantMetrics = metrics;

    emitQueueOpsEvent('assistant_metric', {
        intent: safeIntent,
        outcome: safeOutcome,
        latencyMs,
        ...detail,
    });
}

function resolveAssistantPatientInitials() {
    if (state.lastIssuedTicket?.patientInitials) {
        return String(state.lastIssuedTicket.patientInitials || '--');
    }

    const walkinInitials = getById('walkinInitials');
    if (
        walkinInitials instanceof HTMLInputElement &&
        String(walkinInitials.value || '').trim()
    ) {
        return String(walkinInitials.value || '')
            .trim()
            .slice(0, 4)
            .toUpperCase();
    }

    const checkinInitials = getById('checkinInitials');
    if (
        checkinInitials instanceof HTMLInputElement &&
        String(checkinInitials.value || '').trim()
    ) {
        return String(checkinInitials.value || '')
            .trim()
            .slice(0, 4)
            .toUpperCase();
    }

    const checkinPhone = getById('checkinPhone');
    if (checkinPhone instanceof HTMLInputElement) {
        const digits = String(checkinPhone.value || '').replace(/\D/g, '');
        if (digits) {
            return digits.slice(-2).padStart(2, '0');
        }
    }

    return '--';
}

function buildHelpRequestBody(reason, message, source, intent = '') {
    const ticket = state.lastIssuedTicket;
    return {
        source: String(source || 'kiosk'),
        reason: String(reason || 'general'),
        message: String(message || '').trim(),
        intent: String(intent || '').trim(),
        sessionId: ensureAssistantSessionId(),
        ticketId: Number(ticket?.id || 0) || undefined,
        ticketCode: String(ticket?.ticketCode || ''),
        patientInitials: resolveAssistantPatientInitials(),
        context: {
            selectedFlow: String(state.selectedFlow || 'checkin'),
            waitingCount: Number(state.queueState?.waitingCount || 0),
            estimatedWaitMin: Number(state.queueState?.estimatedWaitMin || 0),
            offlinePending: Number(state.offlineOutbox.length || 0),
        },
    };
}

function setKioskStatus(message, type = 'info') {
    const el = getById('kioskStatus');
    if (!el) return;
    const nextMessage = String(message || '').trim() || 'Estado operativo';
    const nextType = String(type || 'info').toLowerCase();
    const changed =
        nextMessage !== String(el.textContent || '').trim() ||
        nextType !== String(el.dataset.status || '').toLowerCase();
    el.textContent = nextMessage;
    el.dataset.status = nextType;
    if (changed) {
        emitQueueOpsEvent('kiosk_status', {
            status: nextType,
            message: nextMessage,
        });
    }
}

function setQueueConnectionStatus(stateLabel, message) {
    const el = getById('queueConnectionState');
    if (!el) return;

    const normalized = String(stateLabel || 'live').toLowerCase();
    const fallbackByState = {
        live: 'Cola conectada',
        reconnecting: 'Reintentando conexion',
        offline: 'Sin conexion al backend',
        paused: 'Cola en pausa',
    };

    const normalizedMessage =
        String(message || '').trim() ||
        fallbackByState[normalized] ||
        fallbackByState.live;

    const changed =
        normalized !== state.lastConnectionState ||
        normalizedMessage !== state.lastConnectionMessage;

    state.lastConnectionState = normalized;
    state.lastConnectionMessage = normalizedMessage;

    el.dataset.state = normalized;
    el.textContent = normalizedMessage;

    if (changed) {
        emitQueueOpsEvent('connection_state', {
            state: normalized,
            message: normalizedMessage,
        });
    }
    renderKioskSetupStatus();
}

function resolveIdleResetMs() {
    const overrideMs = Number(window.__PIEL_QUEUE_KIOSK_IDLE_RESET_MS);
    const rawMs = Number.isFinite(overrideMs)
        ? overrideMs
        : KIOSK_IDLE_RESET_DEFAULT_MS;
    return Math.min(
        KIOSK_IDLE_RESET_MAX_MS,
        Math.max(KIOSK_IDLE_RESET_MIN_MS, Math.round(rawMs))
    );
}

function formatCountdownMs(ms) {
    const safeMs = Math.max(0, Number(ms || 0));
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const paddedSeconds = String(seconds).padStart(2, '0');
    return `${minutes}:${paddedSeconds}`;
}

function ensureSessionGuard() {
    let guard = getById('kioskSessionGuard');
    if (guard instanceof HTMLElement) {
        return guard;
    }

    const statusEl = getById('kioskStatus');
    if (!(statusEl instanceof HTMLElement)) return null;

    guard = document.createElement('div');
    guard.id = 'kioskSessionGuard';
    guard.className = 'kiosk-session-guard';

    const countdown = document.createElement('span');
    countdown.id = 'kioskSessionCountdown';
    countdown.className = 'kiosk-session-countdown';
    countdown.textContent = 'Privacidad auto: --:--';

    const resetButton = document.createElement('button');
    resetButton.id = 'kioskSessionResetBtn';
    resetButton.type = 'button';
    resetButton.className = 'kiosk-session-reset';
    resetButton.textContent = 'Nueva persona / limpiar pantalla';

    guard.appendChild(countdown);
    guard.appendChild(resetButton);
    statusEl.insertAdjacentElement('afterend', guard);
    return guard;
}

function renderIdleCountdown() {
    const countdown = getById('kioskSessionCountdown');
    if (!(countdown instanceof HTMLElement)) return;

    if (!state.idleDeadlineTs) {
        countdown.textContent = 'Privacidad auto: --:--';
        countdown.dataset.state = 'normal';
        return;
    }

    const remainingMs = Math.max(0, state.idleDeadlineTs - Date.now());
    countdown.textContent = `Privacidad auto: ${formatCountdownMs(remainingMs)}`;
    const warning = remainingMs <= KIOSK_IDLE_WARNING_MS;
    countdown.dataset.state = warning ? 'warning' : 'normal';
}

function clearIdleTimers() {
    if (state.idleTimerId) {
        window.clearTimeout(state.idleTimerId);
        state.idleTimerId = 0;
    }
    if (state.idleTickId) {
        window.clearInterval(state.idleTickId);
        state.idleTickId = 0;
    }
}

function renderTicketEmptyState() {
    const container = getById('ticketResult');
    if (!container) return;
    state.lastIssuedTicket = null;
    container.innerHTML =
        '<p class="ticket-empty">Todavia no se ha generado ningun ticket.</p>';
}

function resetAssistantConversation() {
    const assistantMessages = getById('assistantMessages');
    if (assistantMessages) {
        assistantMessages.innerHTML = '';
    }
    state.chatHistory = [];
    state.lastHelpRequest = null;
    state.assistantSessionId = createRuntimeId('assistant');
    state.assistantMetrics = {
        intents: {},
        resolvedWithoutHuman: 0,
        escalated: 0,
        clinicalBlocked: 0,
        fallback: 0,
        errors: 0,
        actioned: 0,
        lastIntent: '',
        lastLatencyMs: 0,
    };
    appendAssistantMessage('bot', ASSISTANT_WELCOME_TEXT);

    const assistantInput = getById('assistantInput');
    if (assistantInput instanceof HTMLInputElement) {
        assistantInput.value = '';
    }
}

function resetKioskForms() {
    const checkinForm = getById('checkinForm');
    const walkinForm = getById('walkinForm');
    if (checkinForm instanceof HTMLFormElement) {
        checkinForm.reset();
    }
    if (walkinForm instanceof HTMLFormElement) {
        walkinForm.reset();
    }
    initDefaultDate();
}

function beginIdleSessionGuard({ durationMs = null } = {}) {
    const resolvedDuration = Math.min(
        KIOSK_IDLE_RESET_MAX_MS,
        Math.max(
            KIOSK_IDLE_RESET_MIN_MS,
            Math.round(
                Number.isFinite(Number(durationMs))
                    ? Number(durationMs)
                    : state.idleResetMs
            )
        )
    );

    clearIdleTimers();
    state.idleDeadlineTs = Date.now() + resolvedDuration;
    renderIdleCountdown();

    state.idleTickId = window.setInterval(() => {
        renderIdleCountdown();
    }, KIOSK_IDLE_TICK_MS);

    state.idleTimerId = window.setTimeout(() => {
        const busyNow = state.assistantBusy || state.queueManualRefreshBusy;
        if (busyNow) {
            setKioskStatus(
                'Sesion activa. Reprogramando limpieza automatica.',
                'info'
            );
            beginIdleSessionGuard({ durationMs: KIOSK_IDLE_POSTPONE_MS });
            return;
        }
        resetKioskSession({ reason: 'idle_timeout' });
    }, resolvedDuration);
}

function registerKioskActivity() {
    dismissWelcomeScreen({ reason: 'activity' });
    beginIdleSessionGuard();
}

function resetKioskSession({ reason = 'manual' } = {}) {
    stopVoiceGuide({ source: 'session_reset' });
    resetKioskForms();
    resetAssistantConversation();
    renderTicketEmptyState();
    setKioskHelpPanelOpen(false, { source: 'session_reset' });
    focusFlowTarget('checkin', { announce: false });

    const reasonText =
        reason === 'idle_timeout'
            ? 'Sesion reiniciada por inactividad para proteger privacidad.'
            : 'Pantalla limpiada. Lista para el siguiente paciente.';
    setKioskStatus(reasonText, 'info');
    setKioskProgressHint(
        'Paso 1 de 2: selecciona una opcion para comenzar.',
        'info'
    );
    renderOfflineOutboxHint();
    beginIdleSessionGuard();
}

function ensureQueueOpsHintEl() {
    let el = getById('queueOpsHint');
    if (el) return el;

    const queueCard = document.querySelector('.kiosk-side .kiosk-card');
    const queueUpdatedAt = getById('queueUpdatedAt');
    if (!queueCard || !queueUpdatedAt) return null;

    el = document.createElement('p');
    el.id = 'queueOpsHint';
    el.className = 'queue-updated-at';
    el.textContent = 'Estado operativo: inicializando...';
    queueUpdatedAt.insertAdjacentElement('afterend', el);
    return el;
}

function setQueueOpsHint(message) {
    const el = ensureQueueOpsHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Estado operativo';
}

function renderKioskSetupStatus() {
    const titleEl = getById('kioskSetupTitle');
    const summaryEl = getById('kioskSetupSummary');
    const checksEl = getById('kioskSetupChecks');
    if (
        !(titleEl instanceof HTMLElement) ||
        !(summaryEl instanceof HTMLElement) ||
        !(checksEl instanceof HTMLElement)
    ) {
        return;
    }

    const connectionState = String(state.lastConnectionState || 'paused');
    const connectionMessage = String(
        state.lastConnectionMessage || 'Sincronizacion pendiente'
    );
    const pendingCount = Number(state.offlineOutbox.length || 0);
    const printer = state.printerState;
    const printerReady = Boolean(printer?.printed);
    const printerBlocked = Boolean(printer && !printer.printed);
    const hasHealthySync = Boolean(state.queueLastHealthySyncAt);
    const surfaceContract = getKioskSurfaceContract();
    const oldestQueuedAt = Date.parse(
        String(state.offlineOutbox[0]?.queuedAt || '')
    );
    const oldestPendingAge = Number.isFinite(oldestQueuedAt)
        ? formatElapsedAge(Date.now() - oldestQueuedAt)
        : '';

    const checks = [
        {
            label: 'Perfil de clínica',
            state: surfaceContract.state === 'alert' ? 'danger' : 'ready',
            detail: surfaceContract.detail,
        },
        {
            label: 'Conexion con cola',
            state:
                connectionState === 'live'
                    ? hasHealthySync
                        ? 'ready'
                        : 'warning'
                    : connectionState === 'offline'
                      ? 'danger'
                      : 'warning',
            detail:
                connectionState === 'live'
                    ? hasHealthySync
                        ? `Backend en vivo (${formatLastHealthySyncAge()}).`
                        : 'Conectado, pero esperando la primera sincronizacion saludable.'
                    : connectionMessage,
        },
        {
            label: 'Impresora termica',
            state: !printer ? 'warning' : printerReady ? 'ready' : 'danger',
            detail: !printer
                ? 'Sin ticket de prueba todavia. Genera uno para validar papel y USB.'
                : printerReady
                  ? `Impresion OK · ${formatIsoDateTime(printer.at)}`
                  : `Sin impresion (${printer.errorCode || printer.message || 'sin detalle'}) · ${formatIsoDateTime(printer.at)}`,
        },
        {
            label: 'Pendientes offline',
            state:
                pendingCount <= 0
                    ? 'ready'
                    : connectionState === 'offline'
                      ? 'danger'
                      : 'warning',
            detail:
                pendingCount <= 0
                    ? 'Sin pendientes locales.'
                    : `Hay ${pendingCount} pendiente(s) por subir${oldestPendingAge ? ` · mas antiguo ${oldestPendingAge}` : ''}.`,
        },
        {
            label: 'Operacion guiada',
            state: hasHealthySync ? 'ready' : 'warning',
            detail: hasHealthySync
                ? 'La cola ya respondio en este arranque. Puedes abrir el kiosco al publico.'
                : 'Mantiene el flujo abierto, pero falta una sincronizacion completa desde este arranque.',
        },
    ];

    let title = 'Finaliza la puesta en marcha';
    let summary =
        'Revisa backend, termica y pendientes antes de dejar el kiosco en autoservicio.';
    if (surfaceContract.state === 'alert') {
        title =
            surfaceContract.reason === 'profile_missing'
                ? 'Perfil de clínica no cargado'
                : 'Ruta del piloto incorrecta';
        summary = surfaceContract.detail;
    } else if (connectionState === 'offline') {
        title = 'Kiosco en contingencia';
        summary =
            'El kiosco puede seguir capturando datos, pero el backend no responde. Si la fila crece, deriva a recepcion.';
    } else if (pendingCount > 0) {
        title = 'Kiosco con pendientes por sincronizar';
        summary =
            'Hay solicitudes guardadas offline. Manten el equipo abierto hasta que el outbox vuelva a cero.';
    } else if (printerBlocked) {
        title = 'Revisa la impresora termica';
        summary =
            'El ultimo ticket no confirmo impresion. Verifica energia, papel y cable USB, y repite una prueba.';
    } else if (!printerReady) {
        title = 'Falta probar ticket termico';
        summary =
            'Genera un turno de prueba y confirma "Impresion OK" antes de operar con pacientes.';
    } else if (connectionState === 'live' && hasHealthySync) {
        title = 'Kiosco listo para operar';
        summary =
            'La cola esta en vivo, no hay pendientes offline y la termica ya respondio correctamente.';
    }

    titleEl.textContent = title;
    summaryEl.textContent = summary;
    checksEl.innerHTML = checks
        .map(
            (check) => `
                <article class="kiosk-setup-check" data-state="${escapeHtml(check.state)}" role="listitem">
                    <strong>${escapeHtml(check.label)}</strong>
                    <span>${escapeHtml(check.detail)}</span>
                </article>
            `
        )
        .join('');
    notifyKioskHeartbeat('setup_status');
}

function ensureQueueOutboxHintEl() {
    let el = getById('queueOutboxHint');
    if (el) return el;

    const queueOpsHint = ensureQueueOpsHintEl();
    if (!queueOpsHint?.parentElement) return null;

    el = document.createElement('p');
    el.id = 'queueOutboxHint';
    el.className = 'queue-updated-at';
    el.textContent = 'Pendientes offline: 0';
    queueOpsHint.insertAdjacentElement('afterend', el);
    return el;
}

function setQueueOutboxHint(message) {
    const el = ensureQueueOutboxHintEl();
    if (!el) return;
    el.textContent = String(message || '').trim() || 'Pendientes offline: 0';
}

function ensureQueuePrinterHintEl() {
    let el = getById('queuePrinterHint');
    if (el) return el;

    const outboxHint = ensureQueueOutboxHintEl();
    if (!outboxHint?.parentElement) return null;

    el = document.createElement('p');
    el.id = 'queuePrinterHint';
    el.className = 'queue-updated-at';
    el.textContent = 'Impresora: estado pendiente.';
    outboxHint.insertAdjacentElement('afterend', el);
    return el;
}

function savePrinterState() {
    persistClinicScopedStorageValue(
        KIOSK_PRINTER_STATE_STORAGE_KEY,
        state.clinicProfile,
        state.printerState
    );
}

function loadPrinterState() {
    state.printerState = readClinicScopedStorageValue(
        KIOSK_PRINTER_STATE_STORAGE_KEY,
        state.clinicProfile,
        {
            fallbackValue: null,
            normalizeValue: normalizePrinterStateStorage,
        }
    );
}

function renderPrinterHint() {
    const el = ensureQueuePrinterHintEl();
    if (!el) return;

    const current = state.printerState;
    if (!current) {
        el.textContent = 'Impresora: estado pendiente.';
        renderKioskSetupStatus();
        return;
    }

    const statusLabel = current.printed
        ? 'impresion OK'
        : current.errorCode || 'sin impresion';
    const message = current.message ? ` (${current.message})` : '';
    const atLabel = formatIsoDateTime(current.at);
    el.textContent = `Impresora: ${statusLabel}${message} · ${atLabel}`;
    renderKioskSetupStatus();
}

function updatePrinterStateFromPayload(payload, { origin = 'ticket' } = {}) {
    const print = payload?.print || {};
    state.printerState = {
        ok: Boolean(print.ok),
        printed: Boolean(payload?.printed),
        errorCode: String(print.errorCode || ''),
        message: String(print.message || ''),
        at: new Date().toISOString(),
    };
    savePrinterState();
    renderPrinterHint();
    emitQueueOpsEvent('printer_result', {
        origin,
        ok: state.printerState.ok,
        printed: state.printerState.printed,
        errorCode: state.printerState.errorCode,
    });
}

function ensureQueueOutboxConsoleEl() {
    let panel = getById('queueOutboxConsole');
    if (panel instanceof HTMLElement) {
        return panel;
    }

    const outboxHint = ensureQueueOutboxHintEl();
    if (!outboxHint?.parentElement) return null;

    panel = document.createElement('section');
    panel.id = 'queueOutboxConsole';
    panel.className = 'queue-outbox-console';
    panel.innerHTML = `
        <p id="queueOutboxSummary" class="queue-updated-at">Outbox: 0 pendientes</p>
        <div class="queue-outbox-actions">
            <button id="queueOutboxRetryBtn" type="button" class="queue-outbox-btn">Sincronizar pendientes</button>
            <button id="queueOutboxDropOldestBtn" type="button" class="queue-outbox-btn">Descartar mas antiguo</button>
            <button id="queueOutboxClearBtn" type="button" class="queue-outbox-btn">Limpiar pendientes</button>
        </div>
        <ol id="queueOutboxList" class="queue-outbox-list">
            <li class="queue-empty">Sin pendientes offline.</li>
        </ol>
        <p class="queue-updated-at queue-outbox-shortcuts">Atajos: Alt+Shift+Y sincroniza pendientes, Alt+Shift+K limpia pendientes.</p>
    `;
    outboxHint.insertAdjacentElement('afterend', panel);
    return panel;
}

function setQueueOutboxActionLoading(isLoading) {
    const retryBtn = getById('queueOutboxRetryBtn');
    const clearBtn = getById('queueOutboxClearBtn');
    const dropOldestBtn = getById('queueOutboxDropOldestBtn');

    if (retryBtn instanceof HTMLButtonElement) {
        retryBtn.disabled = Boolean(isLoading) || !state.offlineOutbox.length;
        retryBtn.textContent = isLoading
            ? 'Sincronizando...'
            : 'Sincronizar pendientes';
    }
    if (clearBtn instanceof HTMLButtonElement) {
        clearBtn.disabled = Boolean(isLoading) || !state.offlineOutbox.length;
    }
    if (dropOldestBtn instanceof HTMLButtonElement) {
        dropOldestBtn.disabled =
            Boolean(isLoading) || state.offlineOutbox.length <= 0;
    }
}

function renderOutboxConsole() {
    ensureQueueOutboxConsoleEl();
    const summary = getById('queueOutboxSummary');
    const list = getById('queueOutboxList');
    const pendingCount = state.offlineOutbox.length;

    if (summary instanceof HTMLElement) {
        summary.textContent =
            pendingCount <= 0
                ? 'Outbox: 0 pendientes'
                : `Outbox: ${pendingCount} pendiente(s)`;
    }

    if (list instanceof HTMLElement) {
        if (pendingCount <= 0) {
            list.innerHTML =
                '<li class="queue-empty">Sin pendientes offline.</li>';
        } else {
            list.innerHTML = state.offlineOutbox
                .slice(0, KIOSK_OFFLINE_OUTBOX_RENDER_LIMIT)
                .map((item, index) => {
                    const queuedAt = formatIsoDateTime(item.queuedAt);
                    const attempts = Number(item.attempts || 0);
                    return `<li><strong>${escapeHtml(item.originLabel)}</strong> · ${escapeHtml(item.patientInitials || '--')} · ${escapeHtml(item.queueType || '--')} · ${escapeHtml(queuedAt)} · intento ${index + 1}/${Math.max(1, attempts + 1)}</li>`;
                })
                .join('');
        }
    }

    setQueueOutboxActionLoading(false);
}

function clearOfflineOutbox({ reason = 'manual' } = {}) {
    state.offlineOutbox = [];
    saveOfflineOutbox();
    renderOfflineOutboxHint();
    renderOutboxConsole();
    if (reason === 'manual') {
        setKioskStatus('Pendientes offline limpiados manualmente.', 'info');
    }
}

function discardOldestOutboxItem() {
    if (!state.offlineOutbox.length) return;
    const oldest = state.offlineOutbox[state.offlineOutbox.length - 1];
    state.offlineOutbox.pop();
    saveOfflineOutbox();
    renderOfflineOutboxHint();
    renderOutboxConsole();
    setKioskStatus(
        `Descartado pendiente antiguo (${oldest?.originLabel || 'sin detalle'}).`,
        'info'
    );
}

function saveOfflineOutbox() {
    persistClinicScopedStorageValue(
        KIOSK_OFFLINE_OUTBOX_STORAGE_KEY,
        state.clinicProfile,
        state.offlineOutbox
    );
}

function loadOfflineOutbox() {
    state.offlineOutbox = readClinicScopedStorageValue(
        KIOSK_OFFLINE_OUTBOX_STORAGE_KEY,
        state.clinicProfile,
        {
            fallbackValue: [],
            normalizeValue: normalizeOfflineOutboxStorage,
        }
    );
}

function renderOfflineOutboxHint() {
    const pendingCount = state.offlineOutbox.length;
    if (pendingCount <= 0) {
        setQueueOutboxHint('Pendientes offline: 0 (sin pendientes).');
        renderOutboxConsole();
        renderKioskSetupStatus();
        return;
    }

    const firstQueuedAt = Date.parse(
        String(state.offlineOutbox[0]?.queuedAt || '')
    );
    const ageLabel = Number.isFinite(firstQueuedAt)
        ? ` - mas antiguo ${formatElapsedAge(Date.now() - firstQueuedAt)}`
        : '';
    setQueueOutboxHint(
        `Pendientes offline: ${pendingCount} - sincronizacion automatica al reconectar${ageLabel}`
    );
    renderOutboxConsole();
    renderKioskSetupStatus();
}

function buildPendingLocalCode() {
    return `PEND-${String(state.offlineOutbox.length).padStart(2, '0')}`;
}

function ensureQueueManualRefreshButton() {
    let button = getById('queueManualRefreshBtn');
    if (button instanceof HTMLButtonElement) {
        return button;
    }

    const queueUpdatedAt = getById('queueUpdatedAt');
    if (!queueUpdatedAt?.parentElement) return null;

    button = document.createElement('button');
    button.id = 'queueManualRefreshBtn';
    button.type = 'button';
    button.className = 'queue-manual-refresh-btn';
    button.textContent = 'Reintentar sincronizacion';
    queueUpdatedAt.insertAdjacentElement('afterend', button);
    return button;
}

function setQueueManualRefreshLoading(isLoading) {
    const button = ensureQueueManualRefreshButton();
    if (!(button instanceof HTMLButtonElement)) return;
    button.disabled = Boolean(isLoading);
    button.textContent = isLoading
        ? 'Actualizando cola...'
        : 'Reintentar sincronizacion';
}

function formatElapsedAge(ms) {
    const safeMs = Math.max(0, Number(ms || 0));
    const seconds = Math.round(safeMs / 1000);
    if (seconds < 60) {
        return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remSeconds = seconds % 60;
    if (remSeconds <= 0) {
        return `${minutes}m`;
    }
    return `${minutes}m ${remSeconds}s`;
}

function formatLastHealthySyncAge() {
    if (!state.queueLastHealthySyncAt) {
        return 'sin sincronizacion confirmada';
    }
    return `hace ${formatElapsedAge(Date.now() - state.queueLastHealthySyncAt)}`;
}

function evaluateQueueFreshness(queueState) {
    const normalizedState = normalizeQueueStatePayload(queueState);
    const updatedAtTs = Date.parse(String(normalizedState.updatedAt || ''));
    if (!Number.isFinite(updatedAtTs)) {
        return {
            stale: false,
            missingTimestamp: true,
            ageMs: null,
        };
    }

    const ageMs = Math.max(0, Date.now() - updatedAtTs);
    return {
        stale: ageMs >= QUEUE_STALE_THRESHOLD_MS,
        missingTimestamp: false,
        ageMs,
    };
}

function renderQueueUpdatedAt(updatedAt) {
    const el = getById('queueUpdatedAt');
    if (!el) return;
    const normalizedState = normalizeQueueStatePayload({ updatedAt });
    const ts = Date.parse(String(normalizedState.updatedAt || ''));
    if (!Number.isFinite(ts)) {
        el.textContent = 'Actualizacion pendiente';
        return;
    }
    el.textContent = `Actualizado ${new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    })}`;
}

function getQueuePollDelayMs() {
    const attempts = Math.max(0, Number(state.queueFailureStreak || 0));
    const delay = QUEUE_POLL_MS * Math.pow(2, Math.min(attempts, 3));
    return Math.min(QUEUE_POLL_MAX_MS, delay);
}

function clearQueuePollTimer() {
    if (!state.queueTimerId) return;
    window.clearTimeout(state.queueTimerId);
    state.queueTimerId = 0;
}

function formatIsoDateTime(iso) {
    const ts = Date.parse(String(iso || ''));
    if (!Number.isFinite(ts)) {
        return '--';
    }
    return new Date(ts).toLocaleString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
    });
}

function renderQueuePanel(queueState) {
    const normalizedState = normalizeQueueStatePayload(queueState);
    const waitingCountEl = getById('queueWaitingCount');
    const calledCountEl = getById('queueCalledCount');
    const callingNowEl = getById('queueCallingNow');
    const nextListEl = getById('queueNextList');

    if (waitingCountEl) {
        waitingCountEl.textContent = String(normalizedState.waitingCount || 0);
    }
    if (calledCountEl) {
        calledCountEl.textContent = String(normalizedState.calledCount || 0);
    }

    if (callingNowEl) {
        const callingNow = Array.isArray(normalizedState.callingNow)
            ? normalizedState.callingNow
            : [];
        if (callingNow.length === 0) {
            callingNowEl.innerHTML =
                '<p class="queue-empty">Sin llamados activos.</p>';
        } else {
            callingNowEl.innerHTML = callingNow
                .map(
                    (ticket) => `
                        <article class="queue-called-card">
                            <header>${escapeHtml(
                                getKioskConsultorioLabel(
                                    ticket.assignedConsultorio
                                )
                            )}</header>
                            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
                        </article>
                    `
                )
                .join('');
        }
    }

    if (nextListEl) {
        const nextTickets = Array.isArray(normalizedState.nextTickets)
            ? normalizedState.nextTickets
            : [];
        if (nextTickets.length === 0) {
            nextListEl.innerHTML =
                '<li class="queue-empty">No hay turnos en espera.</li>';
        } else {
            nextListEl.innerHTML = nextTickets
                .map(
                    (ticket) => `
                        <li>
                            <span class="ticket-code">${escapeHtml(ticket.ticketCode || '--')}</span>
                            <span class="ticket-meta">${escapeHtml(ticket.patientInitials || '--')}</span>
                            <span class="ticket-position">#${escapeHtml(ticket.position || '-')}</span>
                        </li>
                    `
                )
                .join('');
        }
    }
}

async function refreshQueueState() {
    if (state.queueRefreshBusy) {
        return { ok: false, stale: false, reason: 'busy' };
    }
    state.queueRefreshBusy = true;
    try {
        const payload = await apiRequest('queue-state');
        applyQueueStatePayload(payload);
        const freshness = evaluateQueueFreshness(state.queueState);
        return {
            ok: true,
            stale: Boolean(freshness.stale),
            missingTimestamp: Boolean(freshness.missingTimestamp),
            ageMs: freshness.ageMs,
        };
    } catch (error) {
        return {
            ok: false,
            stale: false,
            reason: 'fetch_error',
            errorMessage: error.message,
        };
    } finally {
        state.queueRefreshBusy = false;
    }
}

function renderTicketResult(payload, originLabel) {
    const container = getById('ticketResult');
    if (!container) return;

    const rawTicket = payload?.data || {};
    const ticket = {
        ...rawTicket,
        id: Number(rawTicket?.id || rawTicket?.ticket_id || 0) || 0,
        ticketCode: String(
            rawTicket?.ticketCode || rawTicket?.ticket_code || '--'
        ),
        patientInitials: String(
            rawTicket?.patientInitials || rawTicket?.patient_initials || '--'
        ),
        queueType: String(
            rawTicket?.queueType || rawTicket?.queue_type || 'walk_in'
        ),
        createdAt: String(
            rawTicket?.createdAt ||
                rawTicket?.created_at ||
                new Date().toISOString()
        ),
    };
    state.lastIssuedTicket = ticket;
    const print = payload?.print || {};
    updatePrinterStateFromPayload(payload, { origin: originLabel });
    const nextTickets = Array.isArray(state.queueState?.nextTickets)
        ? state.queueState.nextTickets
        : [];
    const currentPosition =
        nextTickets.find((item) => Number(item.id) === Number(ticket.id))
            ?.position || '-';

    const printState = payload?.printed
        ? 'Impresion enviada a termica'
        : `Ticket generado sin impresion (${escapeHtml(print.message || 'sin detalle')})`;

    container.innerHTML = `
        <article class="ticket-result-card">
            <h3>Turno generado</h3>
            <p class="ticket-result-origin">${escapeHtml(originLabel)}</p>
            <div class="ticket-result-main">
                <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                <span>${escapeHtml(ticket.patientInitials || '--')}</span>
            </div>
            <dl>
                <div><dt>Posicion</dt><dd>#${escapeHtml(currentPosition)}</dd></div>
                <div><dt>Tipo</dt><dd>${escapeHtml(ticket.queueType || '--')}</dd></div>
                <div><dt>Creado</dt><dd>${escapeHtml(formatIsoDateTime(ticket.createdAt))}</dd></div>
            </dl>
            <p class="ticket-result-print">${printState}</p>
        </article>
    `;
}

function renderPendingTicketResult({
    originLabel,
    patientInitials,
    queueType,
    queuedAt,
}) {
    const container = getById('ticketResult');
    if (!container) return;

    container.innerHTML = `
        <article class="ticket-result-card">
            <h3>Solicitud guardada offline</h3>
            <p class="ticket-result-origin">${escapeHtml(originLabel)}</p>
            <div class="ticket-result-main">
                <strong>${escapeHtml(buildPendingLocalCode())}</strong>
                <span>${escapeHtml(patientInitials || '--')}</span>
            </div>
            <dl>
                <div><dt>Posicion</dt><dd>Pendiente sync</dd></div>
                <div><dt>Tipo</dt><dd>${escapeHtml(queueType || '--')}</dd></div>
                <div><dt>Guardado</dt><dd>${escapeHtml(formatIsoDateTime(queuedAt))}</dd></div>
            </dl>
            <p class="ticket-result-print">Se sincronizara automaticamente al recuperar conexion.</p>
        </article>
    `;
}

function isRecoverableTransportError(error) {
    if (navigator.onLine === false) {
        return true;
    }
    const message = String(error?.message || '').toLowerCase();
    if (!message) return false;
    return (
        message.includes('failed to fetch') ||
        message.includes('networkerror') ||
        message.includes('network request failed') ||
        message.includes('load failed') ||
        message.includes('network')
    );
}

function normalizeOutboxBody(body) {
    const source = body && typeof body === 'object' ? body : {};
    return Object.keys(source)
        .sort()
        .reduce((acc, key) => {
            acc[key] = source[key];
            return acc;
        }, {});
}

function buildOutboxFingerprint(resource, body) {
    const normalizedResource = String(resource || '').toLowerCase();
    const normalizedBody = normalizeOutboxBody(body);
    return `${normalizedResource}:${JSON.stringify(normalizedBody)}`;
}

function queueOfflineRequest({
    resource,
    body,
    originLabel,
    patientInitials,
    queueType,
    renderMode = 'ticket',
}) {
    const safeResource = String(resource || '');
    if (
        safeResource !== 'queue-ticket' &&
        safeResource !== 'queue-checkin' &&
        safeResource !== 'queue-help-request'
    ) {
        return null;
    }

    const fingerprint = buildOutboxFingerprint(safeResource, body);
    const nowTs = Date.now();
    const duplicate = state.offlineOutbox.find((item) => {
        const sameFingerprint = String(item?.fingerprint || '') === fingerprint;
        if (!sameFingerprint) return false;
        const queuedAtTs = Date.parse(String(item?.queuedAt || ''));
        if (!Number.isFinite(queuedAtTs)) return false;
        return nowTs - queuedAtTs <= KIOSK_OFFLINE_OUTBOX_DEDUPE_MS;
    });
    if (duplicate) {
        emitQueueOpsEvent('offline_queued_duplicate', {
            resource: safeResource,
            fingerprint,
        });
        return { ...duplicate, deduped: true };
    }

    const item = {
        id: `offline_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
        resource: safeResource,
        body: body && typeof body === 'object' ? body : {},
        originLabel: String(originLabel || 'Solicitud offline'),
        patientInitials: String(patientInitials || '--'),
        queueType: String(queueType || '--'),
        renderMode:
            String(renderMode || 'ticket').toLowerCase() === 'support'
                ? 'support'
                : 'ticket',
        queuedAt: new Date().toISOString(),
        attempts: 0,
        lastError: '',
        fingerprint,
    };

    state.offlineOutbox = [item, ...state.offlineOutbox].slice(
        0,
        KIOSK_OFFLINE_OUTBOX_MAX_ITEMS
    );
    saveOfflineOutbox();
    renderOfflineOutboxHint();
    emitQueueOpsEvent('offline_queued', {
        resource: safeResource,
        queueSize: state.offlineOutbox.length,
    });
    return item;
}

async function flushOfflineOutbox({
    source = 'auto',
    force = false,
    maxItems = KIOSK_OFFLINE_OUTBOX_FLUSH_BATCH,
} = {}) {
    if (state.offlineOutboxFlushBusy) return;
    if (!state.offlineOutbox.length) return;
    if (!force && navigator.onLine === false) return;

    state.offlineOutboxFlushBusy = true;
    setQueueOutboxActionLoading(true);
    let processed = 0;
    try {
        while (
            state.offlineOutbox.length &&
            processed < Math.max(1, Number(maxItems || 1))
        ) {
            const item = state.offlineOutbox[0];
            try {
                const payload = await apiRequest(item.resource, {
                    method: 'POST',
                    body: item.body,
                });

                state.offlineOutbox.shift();
                saveOfflineOutbox();
                renderOfflineOutboxHint();

                applyQueueStatePayload(payload);
                if (String(item.renderMode || 'ticket') === 'support') {
                    const syncedHelpRequest =
                        payload?.data?.helpRequest &&
                        typeof payload.data.helpRequest === 'object'
                            ? payload.data.helpRequest
                            : null;
                    state.lastHelpRequest = syncedHelpRequest;
                    setKioskStatus(
                        `Apoyo sincronizado (${item.originLabel})`,
                        'success'
                    );
                    setKioskProgressHint(
                        'Apoyo enviado a recepcion correctamente.',
                        'success'
                    );
                } else {
                    renderTicketResult(
                        payload,
                        `${item.originLabel} (sincronizado)`
                    );
                    setKioskStatus(
                        `Pendiente sincronizado (${item.originLabel})`,
                        'success'
                    );
                }
                emitQueueOpsEvent('offline_synced_item', {
                    resource: item.resource,
                    originLabel: item.originLabel,
                    pendingAfter: state.offlineOutbox.length,
                });
                processed += 1;
            } catch (error) {
                item.attempts = Number(item.attempts || 0) + 1;
                item.lastError = String(error?.message || '').slice(0, 180);
                item.lastAttemptAt = new Date().toISOString();
                saveOfflineOutbox();
                renderOfflineOutboxHint();

                const retryingOffline = isRecoverableTransportError(error);
                setKioskStatus(
                    retryingOffline
                        ? 'Sincronizacion offline pendiente: esperando reconexion.'
                        : `Pendiente con error: ${error.message}`,
                    retryingOffline ? 'info' : 'error'
                );
                emitQueueOpsEvent('offline_sync_error', {
                    resource: item.resource,
                    retryingOffline,
                    error: String(error?.message || ''),
                });
                break;
            }
        }

        if (processed > 0) {
            state.queueFailureStreak = 0;
            const refreshResult = await refreshQueueState();
            if (refreshResult.ok) {
                state.queueLastHealthySyncAt = Date.now();
                setQueueConnectionStatus('live', 'Cola conectada');
                setQueueOpsHint(
                    `Outbox sincronizado desde ${source}. (${formatLastHealthySyncAge()})`
                );
                emitQueueOpsEvent('offline_synced_batch', {
                    source,
                    processed,
                    pendingAfter: state.offlineOutbox.length,
                });
            }
        }
    } finally {
        state.offlineOutboxFlushBusy = false;
        renderOutboxConsole();
    }
}

async function submitCheckin(event) {
    event.preventDefault();
    registerKioskActivity();
    dismissWelcomeScreen({ reason: 'form_submit' });
    if (applyKioskPilotBlockFeedback()) {
        return;
    }
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;

    const phoneInput = getById('checkinPhone');
    const timeInput = getById('checkinTime');
    const dateInput = getById('checkinDate');
    const initialsInput = getById('checkinInitials');
    const submitBtn = getById('checkinSubmit');

    const phone =
        phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';
    const time =
        timeInput instanceof HTMLInputElement ? timeInput.value.trim() : '';
    const date =
        dateInput instanceof HTMLInputElement ? dateInput.value.trim() : '';
    const patientInitials =
        initialsInput instanceof HTMLInputElement
            ? initialsInput.value.trim()
            : '';

    if (!phone || !time || !date) {
        setKioskStatus(
            'Telefono, fecha y hora son obligatorios para check-in',
            'error'
        );
        setKioskProgressHint(
            'Completa telefono, fecha y hora para continuar.',
            'warn'
        );
        return;
    }

    if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
    }

    try {
        const body = {
            telefono: phone,
            hora: time,
            fecha: date,
            patientInitials,
        };
        const payload = await apiRequest('queue-checkin', {
            method: 'POST',
            body,
        });
        setKioskStatus('Check-in registrado correctamente', 'success');
        setKioskProgressHint(
            'Check-in completado. Conserva tu ticket y espera llamado.',
            'success'
        );
        renderTicketResult(
            payload,
            payload.replay ? 'Check-in ya existente' : 'Check-in de cita'
        );
        state.queueFailureStreak = 0;
        const refreshResult = await refreshQueueState();
        if (!refreshResult.ok) {
            setQueueConnectionStatus(
                'reconnecting',
                'Check-in registrado; pendiente sincronizar cola'
            );
        }
    } catch (error) {
        if (isRecoverableTransportError(error)) {
            const queued = queueOfflineRequest({
                resource: 'queue-checkin',
                body: {
                    telefono: phone,
                    hora: time,
                    fecha: date,
                    patientInitials,
                },
                originLabel: 'Check-in de cita',
                patientInitials: patientInitials || phone.slice(-2),
                queueType: 'appointment',
            });
            if (queued) {
                setQueueConnectionStatus('offline', 'Sin conexion al backend');
                setQueueOpsHint(
                    'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                );
                renderPendingTicketResult({
                    originLabel: queued.originLabel,
                    patientInitials: queued.patientInitials,
                    queueType: queued.queueType,
                    queuedAt: queued.queuedAt,
                });
                setKioskStatus(
                    queued.deduped
                        ? 'Check-in ya pendiente offline. Se sincronizara automaticamente.'
                        : 'Check-in guardado offline. Se sincronizara automaticamente.',
                    'info'
                );
                setKioskProgressHint(
                    'Check-in guardado offline. Recepcion confirmara al reconectar.',
                    'warn'
                );
                return;
            }
        }
        setKioskStatus(
            `No se pudo registrar el check-in: ${error.message}`,
            'error'
        );
        setKioskProgressHint(
            'No se pudo confirmar check-in. Intenta de nuevo o pide apoyo.',
            'warn'
        );
    } finally {
        if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
        }
    }
}

async function submitWalkIn(event) {
    event.preventDefault();
    registerKioskActivity();
    dismissWelcomeScreen({ reason: 'form_submit' });
    if (applyKioskPilotBlockFeedback()) {
        return;
    }
    const nameInput = getById('walkinName');
    const initialsInput = getById('walkinInitials');
    const phoneInput = getById('walkinPhone');
    const submitBtn = getById('walkinSubmit');

    const name =
        nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
    const initialsRaw =
        initialsInput instanceof HTMLInputElement
            ? initialsInput.value.trim()
            : '';
    const patientInitials = initialsRaw || deriveInitials(name);
    const phone =
        phoneInput instanceof HTMLInputElement ? phoneInput.value.trim() : '';

    if (!patientInitials) {
        setKioskStatus(
            'Ingresa iniciales o nombre para generar el turno',
            'error'
        );
        setKioskProgressHint(
            'Escribe iniciales para generar tu turno.',
            'warn'
        );
        return;
    }

    if (submitBtn instanceof HTMLButtonElement) {
        submitBtn.disabled = true;
    }

    try {
        const body = {
            patientInitials,
            name,
            phone,
        };
        const payload = await apiRequest('queue-ticket', {
            method: 'POST',
            body,
        });
        setKioskStatus('Turno walk-in registrado correctamente', 'success');
        setKioskProgressHint(
            'Turno generado. Conserva tu ticket y espera llamado.',
            'success'
        );
        renderTicketResult(payload, 'Turno sin cita');
        state.queueFailureStreak = 0;
        const refreshResult = await refreshQueueState();
        if (!refreshResult.ok) {
            setQueueConnectionStatus(
                'reconnecting',
                'Turno creado; pendiente sincronizar cola'
            );
        }
    } catch (error) {
        if (isRecoverableTransportError(error)) {
            const queued = queueOfflineRequest({
                resource: 'queue-ticket',
                body: {
                    patientInitials,
                    name,
                    phone,
                },
                originLabel: 'Turno sin cita',
                patientInitials,
                queueType: 'walk_in',
            });
            if (queued) {
                setQueueConnectionStatus('offline', 'Sin conexion al backend');
                setQueueOpsHint(
                    'Modo offline: check-ins/turnos se guardan localmente hasta reconectar.'
                );
                renderPendingTicketResult({
                    originLabel: queued.originLabel,
                    patientInitials: queued.patientInitials,
                    queueType: queued.queueType,
                    queuedAt: queued.queuedAt,
                });
                setKioskStatus(
                    queued.deduped
                        ? 'Turno ya pendiente offline. Se sincronizara automaticamente.'
                        : 'Turno guardado offline. Se sincronizara automaticamente.',
                    'info'
                );
                setKioskProgressHint(
                    'Turno guardado offline. Recepcion lo sincronizara al reconectar.',
                    'warn'
                );
                return;
            }
        }
        setKioskStatus(`No se pudo crear el turno: ${error.message}`, 'error');
        setKioskProgressHint(
            'No se pudo generar turno. Intenta de nuevo o pide apoyo.',
            'warn'
        );
    } finally {
        if (submitBtn instanceof HTMLButtonElement) {
            submitBtn.disabled = false;
        }
    }
}

function normalizeAssistantText(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function classifyAssistantIntent(text) {
    const normalized = normalizeAssistantText(text);
    if (!normalized) {
        return { intent: 'empty', normalized };
    }

    if (
        /(diagnost|medicacion|tratamiento|receta|dosis|enfermedad|medicamento|que tomo|que crema|que me pongo)/.test(
            normalized
        )
    ) {
        return { intent: 'clinical_blocked', normalized };
    }
    if (
        /(perdi mi ticket|perdi el ticket|no encuentro mi ticket|extravie mi ticket)/.test(
            normalized
        )
    ) {
        return { intent: 'lost_ticket', normalized };
    }
    if (
        /(impresora|no imprimio|no salio el ticket|ticket no salio|no imprime|problema de impresion|reimprimir)/.test(
            normalized
        )
    ) {
        return { intent: 'printer_issue', normalized };
    }
    if (
        /(no encuentro mi cita|mi cita no aparece|no sale mi cita|no encuentro la cita)/.test(
            normalized
        )
    ) {
        return { intent: 'appointment_not_found', normalized };
    }
    if (
        /(embarazada|adulto mayor|discapacidad|movilidad reducida|prioridad especial|necesito prioridad)/.test(
            normalized
        )
    ) {
        return { intent: 'special_priority', normalized };
    }
    if (/(acompanante|soy acompanante|vengo con alguien)/.test(normalized)) {
        return { intent: 'companion', normalized };
    }
    if (
        /(no veo bien|no puedo leer|letra grande|accesibilidad|dificultad visual)/.test(
            normalized
        )
    ) {
        return { intent: 'accessibility', normalized };
    }
    if (
        /(necesito ayuda humana|necesito ayuda|quiero hablar con recepcion|llama a recepcion|apoyo humano)/.test(
            normalized
        )
    ) {
        return { intent: 'human_help', normalized };
    }
    if (
        /(no tengo cita|sin cita|quiero turno|sacar turno|turno sin cita|walk in)/.test(
            normalized
        )
    ) {
        return { intent: 'walk_in', normalized };
    }
    if (/(tengo cita|check in|checkin|vengo con cita)/.test(normalized)) {
        return { intent: 'have_appointment', normalized };
    }
    if (/(donde espero|donde me siento|donde aguardo)/.test(normalized)) {
        return { intent: 'where_wait', normalized };
    }
    if (
        /(que sigue|que hago ahora|siguiente paso|ahora que hago)/.test(
            normalized
        )
    ) {
        return { intent: 'next_step', normalized };
    }
    if (
        /(cuanto falta|cuanto demora|cuanto tiempo|cuanto tarda|tiempo de espera)/.test(
            normalized
        )
    ) {
        return { intent: 'wait_time', normalized };
    }

    return null;
}

function buildAssistantWaitMessage() {
    const queueState = state.queueState || {};
    const waitingCount = Math.max(0, Number(queueState.waitingCount || 0));
    const estimatedWaitMin = Math.max(
        0,
        Number(queueState.estimatedWaitMin || waitingCount * 8 || 0)
    );
    const delayReason = String(queueState.delayReason || '').trim();
    return delayReason
        ? `Ahora hay ${waitingCount} persona(s) en espera. El tiempo estimado es ${estimatedWaitMin} min. Motivo de demora: ${delayReason}.`
        : `Ahora hay ${waitingCount} persona(s) en espera. El tiempo estimado es ${estimatedWaitMin} min.`;
}

function buildAssistantNextStepMessage() {
    const ticket = state.lastIssuedTicket;
    if (ticket?.ticketCode) {
        return `Tu ticket ${ticket.ticketCode} ya esta generado. Espera mirando la pantalla de sala hasta que te llamen al consultorio indicado.`;
    }
    if (state.selectedFlow === 'walkin') {
        return 'Completa tus iniciales y pulsa "Generar turno". Luego espera el llamado en la pantalla de sala.';
    }
    return 'Completa telefono, fecha y hora y pulsa "Confirmar check-in". Luego espera el llamado en la pantalla de sala.';
}

async function resolveAssistantIntent(route, rawText, startedAt) {
    const intent = String(route?.intent || 'fallback');

    switch (intent) {
        case 'have_appointment':
            focusFlowTarget('checkin');
            recordAssistantMetric(intent, 'resolved', startedAt, {
                action: 'focus_checkin',
            });
            return 'Te llevo a Tengo cita. Escribe telefono, fecha y hora y pulsa "Confirmar check-in".';
        case 'walk_in':
            focusFlowTarget('walkin');
            recordAssistantMetric(intent, 'resolved', startedAt, {
                action: 'focus_walkin',
            });
            return 'Te llevo a No tengo cita. Escribe tus iniciales y pulsa "Generar turno".';
        case 'where_wait':
            recordAssistantMetric(intent, 'resolved', startedAt, {
                action: 'waiting_room_guidance',
            });
            return state.lastIssuedTicket?.ticketCode
                ? `Espera en la sala mirando la pantalla. Cuando aparezca ${state.lastIssuedTicket.ticketCode}, acude al consultorio indicado.`
                : 'Espera en la sala mirando la pantalla de turnos. Cuando llamen tu codigo, acude al consultorio indicado.';
        case 'next_step':
            recordAssistantMetric(intent, 'resolved', startedAt, {
                action: 'next_step_guidance',
            });
            return buildAssistantNextStepMessage();
        case 'wait_time':
            recordAssistantMetric(intent, 'resolved', startedAt, {
                action: 'wait_time_guidance',
            });
            return buildAssistantWaitMessage();
        case 'companion':
            recordAssistantMetric(intent, 'resolved', startedAt, {
                action: 'companion_guidance',
            });
            return 'Tu acompanante puede esperar contigo en la sala. Si recepcion debe validar algo adicional, te ayudaran en el mostrador.';
        case 'human_help': {
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'human_help',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'handoff', startedAt, {
                queued: support.queued,
            });
            return support.message;
        }
        case 'lost_ticket': {
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'lost_ticket',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'handoff', startedAt, {
                queued: support.queued,
            });
            return state.lastIssuedTicket?.ticketCode
                ? `${support.message} Tu ultimo ticket registrado fue ${state.lastIssuedTicket.ticketCode}.`
                : support.message;
        }
        case 'printer_issue': {
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'printer_issue',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'handoff', startedAt, {
                queued: support.queued,
            });
            return support.message;
        }
        case 'appointment_not_found': {
            focusFlowTarget('checkin');
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'appointment_not_found',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'handoff', startedAt, {
                queued: support.queued,
            });
            return `${support.message} Mientras tanto, revisa telefono, fecha y hora en Tengo cita.`;
        }
        case 'special_priority': {
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'special_priority',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'handoff', startedAt, {
                queued: support.queued,
            });
            return support.message;
        }
        case 'accessibility': {
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'accessibility',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'handoff', startedAt, {
                queued: support.queued,
            });
            return support.message;
        }
        case 'clinical_blocked': {
            const support = await requestReceptionSupport({
                source: 'assistant',
                reason: 'clinical_redirect',
                message: rawText,
                intent,
                announceInAssistant: false,
            });
            recordAssistantMetric(intent, 'clinical_blocked', startedAt, {
                queued: support.queued,
            });
            return 'En este kiosco no doy orientacion medica. Recepcion ya fue alertada para derivarte con el personal adecuado.';
        }
        default:
            return '';
    }
}

function assistantGuard(text) {
    const normalized = String(text || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

    if (
        /(diagnost|medicacion|tratamiento medico|receta|dosis|enfermedad)/.test(
            normalized
        )
    ) {
        return 'En este kiosco solo puedo ayudarte con turnos y orientacion de sala. Para consulta medica, acude a recepcion.';
    }

    const trimmed = String(text || '').trim();
    if (!trimmed) {
        return 'Puedo ayudarte con turnos, check-in y ubicacion de consultorios.';
    }

    return trimmed;
}

function appendAssistantMessage(role, content) {
    const list = getById('assistantMessages');
    if (!list) return;
    const item = document.createElement('article');
    item.className = `assistant-message assistant-message-${role}`;
    item.innerHTML = `<p>${escapeHtml(content)}</p>`;
    list.appendChild(item);
    list.scrollTop = list.scrollHeight;
}

async function submitAssistant(event) {
    event.preventDefault();
    registerKioskActivity();
    if (applyKioskPilotBlockFeedback()) {
        return;
    }
    if (state.assistantBusy) return;

    const input = getById('assistantInput');
    const sendBtn = getById('assistantSend');
    if (!(input instanceof HTMLInputElement)) return;

    const text = input.value.trim();
    if (!text) return;

    appendAssistantMessage('user', text);
    input.value = '';
    state.assistantBusy = true;
    if (sendBtn instanceof HTMLButtonElement) {
        sendBtn.disabled = true;
    }

    const startedAt = performance.now();
    try {
        const routedIntent = classifyAssistantIntent(text);
        if (routedIntent && routedIntent.intent !== 'empty') {
            const routedAnswer = await resolveAssistantIntent(
                routedIntent,
                text,
                startedAt
            );
            appendAssistantMessage('bot', routedAnswer);
            state.chatHistory = [
                ...state.chatHistory,
                { role: 'user', content: text },
                { role: 'assistant', content: routedAnswer },
            ].slice(-8);
            return;
        }

        const messages = [
            {
                role: 'system',
                content:
                    'Modo kiosco de sala de espera. Solo orientar sobre turnos, check-in, consultorios y recepcion. No dar consejo clinico.',
            },
            ...state.chatHistory.slice(-6),
            { role: 'user', content: text },
        ];

        const response = await fetch(`${CHAT_ENDPOINT}?t=${Date.now()}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({
                model: 'figo-assistant',
                source: 'kiosk_waiting_room',
                messages,
                max_tokens: 180,
                temperature: 0.2,
            }),
        });

        const payload = await response.json();
        const aiText = String(
            payload?.choices?.[0]?.message?.content || ''
        ).trim();
        const answer = assistantGuard(aiText);
        recordAssistantMetric('fallback_ai', 'fallback', startedAt, {
            aiSource: 'figo',
        });
        appendAssistantMessage('bot', answer);

        state.chatHistory = [
            ...state.chatHistory,
            { role: 'user', content: text },
            { role: 'assistant', content: answer },
        ].slice(-8);
    } catch (error) {
        recordAssistantMetric('fallback_ai', 'error', startedAt, {
            error: String(error?.message || ''),
        });
        appendAssistantMessage(
            'bot',
            'No pude conectar con el asistente. Te ayudo en recepcion para continuar con tu turno.'
        );
    } finally {
        state.assistantBusy = false;
        if (sendBtn instanceof HTMLButtonElement) {
            sendBtn.disabled = false;
        }
    }
}

function bindKioskActivitySignals() {
    const activityEvents = ['pointerdown', 'keydown', 'input', 'touchstart'];
    activityEvents.forEach((eventName) => {
        document.addEventListener(
            eventName,
            () => {
                registerKioskActivity();
            },
            true
        );
    });
}

function applyTheme(mode) {
    state.themeMode = mode;
    const root = document.documentElement;
    const activeMode = 'light';
    root.dataset.theme = activeMode;

    document.querySelectorAll('[data-theme-mode]').forEach((button) => {
        const buttonMode = button.getAttribute('data-theme-mode');
        button.classList.toggle('is-active', buttonMode === mode);
        button.setAttribute('aria-pressed', String(buttonMode === mode));
    });
}

function setTheme(_mode) {
    const normalized = 'light';
    localStorage.setItem(THEME_STORAGE_KEY, normalized);
    applyTheme(normalized);
}

function initTheme() {
    setTheme('light');
}

function dismissWelcomeScreen({ reason = 'auto' } = {}) {
    if (state.welcomeDismissed) return;
    state.welcomeDismissed = true;
    const welcomeScreen = getById('kioskWelcomeScreen');
    if (!(welcomeScreen instanceof HTMLElement)) return;
    welcomeScreen.classList.add('is-hidden');
    window.setTimeout(() => {
        if (welcomeScreen.parentElement) {
            welcomeScreen.remove();
        }
    }, 700);
    emitQueueOpsEvent('welcome_dismissed', { reason });
}

function runWelcomeSequence() {
    const welcomeScreen = getById('kioskWelcomeScreen');
    if (!(welcomeScreen instanceof HTMLElement)) return;

    welcomeScreen.classList.add('is-visible');
    setKioskProgressHint(
        'Bienvenida: en segundos podras elegir tu tipo de atencion.',
        'info'
    );
    window.setTimeout(() => {
        dismissWelcomeScreen({ reason: 'auto' });
    }, KIOSK_WELCOME_HIDE_MS);
    window.setTimeout(() => {
        dismissWelcomeScreen({ reason: 'safety_timeout' });
    }, KIOSK_WELCOME_REMOVE_MS);
}

function bindKioskStarControls() {
    const quickCheckin = getById('kioskQuickCheckin');
    const quickWalkin = getById('kioskQuickWalkin');
    const helpToggle = getById('kioskHelpToggle');
    const helpClose = getById('kioskHelpClose');
    const seniorToggle = getById('kioskSeniorToggle');
    const voiceGuideBtn = getById('kioskVoiceGuideBtn');
    const receptionHelpBtn = getById('kioskReceptionHelpBtn');

    if (quickCheckin instanceof HTMLButtonElement) {
        quickCheckin.addEventListener('click', () => {
            registerKioskActivity();
            focusFlowTarget('checkin');
        });
    }
    if (quickWalkin instanceof HTMLButtonElement) {
        quickWalkin.addEventListener('click', () => {
            registerKioskActivity();
            focusFlowTarget('walkin');
        });
    }
    if (helpToggle instanceof HTMLButtonElement) {
        helpToggle.addEventListener('click', () => {
            registerKioskActivity();
            setKioskHelpPanelOpen(!state.quickHelpOpen, { source: 'toggle' });
        });
    }
    if (helpClose instanceof HTMLButtonElement) {
        helpClose.addEventListener('click', () => {
            registerKioskActivity();
            setKioskHelpPanelOpen(false, { source: 'close_button' });
        });
    }
    if (seniorToggle instanceof HTMLButtonElement) {
        seniorToggle.addEventListener('click', () => {
            registerKioskActivity();
            toggleSeniorMode({ source: 'button' });
        });
    }
    if (voiceGuideBtn instanceof HTMLButtonElement) {
        voiceGuideBtn.addEventListener('click', () => {
            registerKioskActivity();
            runVoiceGuide({ source: 'button' });
        });
    }
    if (receptionHelpBtn instanceof HTMLButtonElement) {
        receptionHelpBtn.dataset.variant = 'warning';
        receptionHelpBtn.addEventListener('click', () => {
            registerKioskActivity();
            requestReceptionSupport({ source: 'button' });
        });
    }
}

function initDefaultDate() {
    const dateInput = getById('checkinDate');
    if (dateInput instanceof HTMLInputElement && !dateInput.value) {
        dateInput.value = new Date().toISOString().slice(0, 10);
    }
}

function scheduleQueuePolling({ immediate = false } = {}) {
    clearQueuePollTimer();
    if (!state.queuePollingEnabled) return;
    const delay = immediate ? 0 : getQueuePollDelayMs();
    state.queueTimerId = window.setTimeout(() => {
        void runQueuePollingTick();
    }, delay);
}

async function runQueuePollingTick() {
    if (!state.queuePollingEnabled) return;

    if (document.hidden) {
        setQueueConnectionStatus('paused', 'Cola en pausa (pestana oculta)');
        setQueueOpsHint('Pestana oculta. Turnero en pausa temporal.');
        scheduleQueuePolling();
        return;
    }

    if (navigator.onLine === false) {
        state.queueFailureStreak += 1;
        setQueueConnectionStatus('offline', 'Sin conexion al backend');
        setQueueOpsHint(
            'Sin internet. Deriva check-in/turnos a recepcion mientras se recupera conexion.'
        );
        renderOfflineOutboxHint();
        scheduleQueuePolling();
        return;
    }

    await flushOfflineOutbox({ source: 'poll' });

    const refreshResult = await refreshQueueState();
    if (refreshResult.ok && !refreshResult.stale) {
        state.queueFailureStreak = 0;
        state.queueLastHealthySyncAt = Date.now();
        setQueueConnectionStatus('live', 'Cola conectada');
        setQueueOpsHint(
            `Operacion estable (${formatLastHealthySyncAge()}). Kiosco disponible para turnos.`
        );
    } else if (refreshResult.ok && refreshResult.stale) {
        state.queueFailureStreak += 1;
        const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
        setQueueConnectionStatus(
            'reconnecting',
            `Watchdog: cola estancada ${staleAge}`
        );
        setQueueOpsHint(
            `Cola degradada: sin cambios en ${staleAge}. Usa "Reintentar sincronizacion" o apoyo de recepcion.`
        );
    } else {
        state.queueFailureStreak += 1;
        const retrySeconds = Math.max(
            1,
            Math.ceil(getQueuePollDelayMs() / 1000)
        );
        setQueueConnectionStatus(
            'reconnecting',
            `Reintentando en ${retrySeconds}s`
        );
        setQueueOpsHint(
            `Conexion inestable. Reintento automatico en ${retrySeconds}s.`
        );
    }
    renderOfflineOutboxHint();
    scheduleQueuePolling();
}

async function runQueueManualRefresh() {
    if (state.queueManualRefreshBusy) return;
    registerKioskActivity();
    state.queueManualRefreshBusy = true;
    setQueueManualRefreshLoading(true);
    setQueueConnectionStatus('reconnecting', 'Refrescando manualmente...');

    try {
        await flushOfflineOutbox({ source: 'manual' });
        const refreshResult = await refreshQueueState();
        if (refreshResult.ok && !refreshResult.stale) {
            state.queueFailureStreak = 0;
            state.queueLastHealthySyncAt = Date.now();
            setQueueConnectionStatus('live', 'Cola conectada');
            setQueueOpsHint(
                `Sincronizacion manual exitosa (${formatLastHealthySyncAge()}).`
            );
            return;
        }
        if (refreshResult.ok && refreshResult.stale) {
            const staleAge = formatElapsedAge(refreshResult.ageMs || 0);
            setQueueConnectionStatus(
                'reconnecting',
                `Watchdog: cola estancada ${staleAge}`
            );
            setQueueOpsHint(
                `Persisten datos estancados (${staleAge}). Verifica backend o recepcion.`
            );
            return;
        }
        const retrySeconds = Math.max(
            1,
            Math.ceil(getQueuePollDelayMs() / 1000)
        );
        setQueueConnectionStatus(
            navigator.onLine === false ? 'offline' : 'reconnecting',
            navigator.onLine === false
                ? 'Sin conexion al backend'
                : `Reintentando en ${retrySeconds}s`
        );
        setQueueOpsHint(
            navigator.onLine === false
                ? 'Sin internet. Opera manualmente en recepcion.'
                : `Refresh manual sin exito. Reintento automatico en ${retrySeconds}s.`
        );
    } finally {
        renderOfflineOutboxHint();
        state.queueManualRefreshBusy = false;
        setQueueManualRefreshLoading(false);
    }
}

function startQueuePolling({ immediate = true } = {}) {
    state.queuePollingEnabled = true;
    if (immediate) {
        setQueueConnectionStatus('live', 'Sincronizando cola...');
        void runQueuePollingTick();
        return;
    }
    scheduleQueuePolling();
}

function stopQueuePolling({ reason = 'paused' } = {}) {
    state.queuePollingEnabled = false;
    state.queueFailureStreak = 0;
    clearQueuePollTimer();

    const normalizedReason = String(reason || 'paused').toLowerCase();
    if (normalizedReason === 'offline') {
        setQueueConnectionStatus('offline', 'Sin conexion al backend');
        setQueueOpsHint(
            'Sin conexion. Esperando reconexion para reanudar cola.'
        );
        renderOfflineOutboxHint();
        return;
    }
    if (normalizedReason === 'hidden') {
        setQueueConnectionStatus('paused', 'Cola en pausa (pestana oculta)');
        setQueueOpsHint('Pestana oculta. Reanudando al volver a primer plano.');
        return;
    }
    setQueueConnectionStatus('paused', 'Cola en pausa');
    setQueueOpsHint('Sincronizacion pausada por navegacion.');
    renderOfflineOutboxHint();
}

function initKiosk() {
    void loadTurneroClinicProfile().then((profile) => {
        applyKioskClinicProfile(profile);
        setSeniorModeEnabled(readSeniorModePreference(), {
            persist: false,
            source: 'clinic_profile',
        });
        loadOfflineOutbox();
        loadPrinterState();
        renderPrinterHint();
        renderOfflineOutboxHint();
        setQueueConnectionStatus('paused', 'Sincronizacion lista');
        setQueueOpsHint('Esperando primera sincronizacion de cola...');
        renderQueueUpdatedAt('');
        if (navigator.onLine !== false) {
            void flushOfflineOutbox({ source: 'startup', force: true });
        }
        ensureKioskHeartbeat().start({ immediate: false });
        startQueuePolling({ immediate: true });
    });
    document.body.dataset.kioskMode = 'star';
    ensureKioskStarStyles();
    state.idleResetMs = resolveIdleResetMs();
    state.voiceGuideSupported = supportsVoiceGuide();
    initTheme();
    setSeniorModeEnabled(false, {
        persist: false,
        source: 'init',
    });
    syncVoiceGuideButton();
    runWelcomeSequence();
    initDefaultDate();

    const checkinForm = getById('checkinForm');
    const walkinForm = getById('walkinForm');
    const assistantForm = getById('assistantForm');

    if (checkinForm instanceof HTMLFormElement) {
        checkinForm.addEventListener('submit', submitCheckin);
    }
    if (walkinForm instanceof HTMLFormElement) {
        walkinForm.addEventListener('submit', submitWalkIn);
    }
    if (assistantForm instanceof HTMLFormElement) {
        assistantForm.addEventListener('submit', submitAssistant);
    }
    bindKioskStarControls();
    setKioskHelpPanelOpen(false, { source: 'init' });

    ensureSessionGuard();
    const resetSessionBtn = getById('kioskSessionResetBtn');
    if (resetSessionBtn instanceof HTMLButtonElement) {
        resetSessionBtn.addEventListener('click', () => {
            resetKioskSession({ reason: 'manual' });
        });
    }

    resetAssistantConversation();
    renderTicketEmptyState();
    focusFlowTarget('checkin', { announce: false });
    setKioskProgressHint(
        'Paso 1 de 2: selecciona una opcion para comenzar.',
        'info'
    );
    bindKioskActivitySignals();
    beginIdleSessionGuard();

    ensureQueueOpsHintEl();
    ensureQueueOutboxHintEl();
    ensureQueuePrinterHintEl();
    ensureQueueOutboxConsoleEl();
    renderPrinterHint();
    renderOfflineOutboxHint();
    const manualRefreshButton = ensureQueueManualRefreshButton();
    if (manualRefreshButton instanceof HTMLButtonElement) {
        manualRefreshButton.addEventListener('click', () => {
            void runQueueManualRefresh();
        });
    }
    const outboxRetryButton = getById('queueOutboxRetryBtn');
    if (outboxRetryButton instanceof HTMLButtonElement) {
        outboxRetryButton.addEventListener('click', () => {
            void flushOfflineOutbox({
                source: 'operator',
                force: true,
                maxItems: KIOSK_OFFLINE_OUTBOX_MAX_ITEMS,
            });
        });
    }
    const outboxDropOldestButton = getById('queueOutboxDropOldestBtn');
    if (outboxDropOldestButton instanceof HTMLButtonElement) {
        outboxDropOldestButton.addEventListener('click', () => {
            discardOldestOutboxItem();
        });
    }
    const outboxClearButton = getById('queueOutboxClearBtn');
    if (outboxClearButton instanceof HTMLButtonElement) {
        outboxClearButton.addEventListener('click', () => {
            clearOfflineOutbox({ reason: 'manual' });
        });
    }
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopQueuePolling({ reason: 'hidden' });
            return;
        }
        if (!state.clinicProfile) {
            return;
        }
        startQueuePolling({ immediate: true });
    });

    window.addEventListener('online', () => {
        if (!state.clinicProfile) {
            return;
        }
        void flushOfflineOutbox({ source: 'online', force: true });
        startQueuePolling({ immediate: true });
    });

    window.addEventListener('offline', () => {
        stopQueuePolling({ reason: 'offline' });
        renderOfflineOutboxHint();
    });

    window.addEventListener('beforeunload', () => {
        stopVoiceGuide({ source: 'beforeunload' });
        stopQueuePolling({ reason: 'paused' });
        kioskHeartbeat?.stop();
    });

    window.addEventListener('keydown', (event) => {
        if (!event.altKey || !event.shiftKey) return;
        const keyCode = String(event.code || '').toLowerCase();
        if (keyCode === 'keyr') {
            event.preventDefault();
            void runQueueManualRefresh();
            return;
        }
        if (keyCode === 'keyh') {
            event.preventDefault();
            setKioskHelpPanelOpen(!state.quickHelpOpen, {
                source: 'shortcut',
            });
            return;
        }
        if (keyCode === 'digit1') {
            event.preventDefault();
            focusFlowTarget('checkin');
            return;
        }
        if (keyCode === 'digit2') {
            event.preventDefault();
            focusFlowTarget('walkin');
            return;
        }
        if (keyCode === 'keys') {
            event.preventDefault();
            toggleSeniorMode({ source: 'shortcut' });
            return;
        }
        if (keyCode === 'keyv') {
            event.preventDefault();
            runVoiceGuide({ source: 'shortcut' });
            return;
        }
        if (keyCode === 'keya') {
            event.preventDefault();
            requestReceptionSupport({ source: 'shortcut' });
            return;
        }
        if (keyCode === 'keyl') {
            event.preventDefault();
            resetKioskSession({ reason: 'manual' });
            return;
        }
        if (keyCode === 'keyy') {
            event.preventDefault();
            void flushOfflineOutbox({
                source: 'shortcut',
                force: true,
                maxItems: KIOSK_OFFLINE_OUTBOX_MAX_ITEMS,
            });
            return;
        }
        if (keyCode === 'keyk') {
            event.preventDefault();
            clearOfflineOutbox({ reason: 'manual' });
        }
    });
}

document.addEventListener('DOMContentLoaded', initKiosk);
