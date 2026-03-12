import { getState } from '../../../../core/store.js';
import {
    createToast,
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
} from '../../../../ui/render.js';
import {
    getActiveCalledTicketForStation,
    getCalledTicketForConsultorio,
    getQueueTicketById,
    getQueueSource,
    getVisibleTickets,
    getWaitingForConsultorio,
} from '../../selectors.js';

const DEFAULT_APP_DOWNLOADS = Object.freeze({
    operator: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/operador-turnos.html',
        guideUrl: '/app-downloads/?surface=operator',
        targets: {
            win: {
                url: '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/operator/mac/TurneroOperador.dmg',
                label: 'macOS',
            },
        },
    },
    kiosk: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/kiosco-turnos.html',
        guideUrl: '/app-downloads/?surface=kiosk',
        targets: {
            win: {
                url: '/app-downloads/stable/kiosk/win/TurneroKioscoSetup.exe',
                label: 'Windows',
            },
            mac: {
                url: '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg',
                label: 'macOS',
            },
        },
    },
    sala_tv: {
        version: '0.1.0',
        updatedAt: '2026-03-10T00:00:00Z',
        webFallbackUrl: '/sala-turnos.html',
        guideUrl: '/app-downloads/?surface=sala_tv',
        targets: {
            android_tv: {
                url: '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk',
                label: 'Android TV APK',
            },
        },
    },
});

const APP_COPY = Object.freeze({
    operator: {
        eyebrow: 'Recepción + consultorio',
        title: 'Operador',
        description:
            'Superficie diaria para llamar, re-llamar, completar y operar con el Genius Numpad 1000.',
        recommendedFor: 'PC operador',
        notes: [
            'Conecta aquí el receptor USB 2.4 GHz del numpad.',
            'La app desktop ahora puede quedar configurada como C1, C2 o modo libre desde el primer arranque.',
        ],
    },
    kiosk: {
        eyebrow: 'Recepción de pacientes',
        title: 'Kiosco',
        description:
            'Instalador dedicado para check-in, generación de ticket y operación simple en mostrador.',
        recommendedFor: 'PC o mini PC de kiosco',
        notes: [
            'Mantén el equipo en fullscreen y con impresora térmica conectada.',
            'La versión web sigue disponible como respaldo inmediato.',
        ],
    },
    sala_tv: {
        eyebrow: 'Pantalla de sala',
        title: 'Sala TV',
        description:
            'APK para Android TV en la TCL C655 con WebView controlado, reconexión y campanilla.',
        recommendedFor: 'TCL C655 / Google TV',
        notes: [
            'Instala en la TV y prioriza Ethernet sobre Wi-Fi.',
            'Usa el QR desde otra pantalla para simplificar la instalación del APK.',
        ],
    },
});

const SURFACE_TELEMETRY_COPY = Object.freeze({
    operator: {
        title: 'Operador',
        emptySummary:
            'Todavía no hay señal del equipo operador. Abre la app o el fallback web para registrar heartbeat.',
    },
    kiosk: {
        title: 'Kiosco',
        emptySummary:
            'Todavía no hay señal del kiosco. Abre el equipo o el fallback web antes de dejar autoservicio.',
    },
    display: {
        title: 'Sala TV',
        emptySummary:
            'Todavía no hay señal de la TV de sala. Abre la app Android TV o el fallback web para registrar estado.',
    },
});

const QUEUE_INSTALL_PRESET_STORAGE_KEY = 'queueInstallPresetV1';
const QUEUE_OPENING_CHECKLIST_STORAGE_KEY = 'queueOpeningChecklistV1';
const QUEUE_SHIFT_HANDOFF_STORAGE_KEY = 'queueShiftHandoffV1';
const QUEUE_OPS_LOG_STORAGE_KEY = 'queueOpsLogV1';
const QUEUE_OPS_LOG_FILTER_STORAGE_KEY = 'queueOpsLogFilterV1';
const QUEUE_OPS_ALERTS_STORAGE_KEY = 'queueOpsAlertsV1';
const QUEUE_OPS_FOCUS_MODE_STORAGE_KEY = 'queueOpsFocusModeV1';
const QUEUE_OPS_PLAYBOOK_STORAGE_KEY = 'queueOpsPlaybookV1';
const QUEUE_TICKET_LOOKUP_STORAGE_KEY = 'queueTicketLookupV1';
const QUEUE_OPS_LOG_MAX_ITEMS = 24;
const QUEUE_OPS_INTERACTION_HOLD_MS = 900;
const QUEUE_ATTENTION_RECALL_SEC = 2 * 60;
const QUEUE_ATTENTION_ALERT_SEC = 6 * 60;
const OPENING_CHECKLIST_STEP_IDS = Object.freeze([
    'operator_ready',
    'kiosk_ready',
    'sala_ready',
    'smoke_ready',
]);
const SHIFT_HANDOFF_STEP_IDS = Object.freeze([
    'queue_clear',
    'operator_handoff',
    'kiosk_handoff',
    'sala_handoff',
]);

let installPreset = null;
let openingChecklistState = null;
let shiftHandoffState = null;
let opsLogState = null;
let opsLogFilter = null;
let opsAlertsState = null;
let opsFocusMode = null;
let opsPlaybookState = null;
let queueTicketLookupTerm = null;
let queueTicketSimulationContext = null;
let queueOpsInteraction = {
    lastAt: 0,
    timerId: 0,
    settleTimerId: 0,
    pendingManifest: null,
    pendingPlatform: '',
};

function detectPlatform() {
    const platform =
        `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
    if (platform.includes('mac')) return 'mac';
    if (platform.includes('win')) return 'win';
    return 'other';
}

function normalizeQueueTicketLookupTerm(value) {
    return String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 48);
}

function loadStoredQueueTicketLookupTerm() {
    try {
        return normalizeQueueTicketLookupTerm(
            window.localStorage.getItem(QUEUE_TICKET_LOOKUP_STORAGE_KEY) || ''
        );
    } catch (_error) {
        return '';
    }
}

function persistQueueTicketLookupTerm(value) {
    clearQueueTicketSimulationContext();
    queueTicketLookupTerm = normalizeQueueTicketLookupTerm(value);
    try {
        if (queueTicketLookupTerm) {
            window.localStorage.setItem(
                QUEUE_TICKET_LOOKUP_STORAGE_KEY,
                queueTicketLookupTerm
            );
        } else {
            window.localStorage.removeItem(QUEUE_TICKET_LOOKUP_STORAGE_KEY);
        }
    } catch (_error) {
        // localStorage can be unavailable in some browser modes
    }
    return queueTicketLookupTerm;
}

function getQueueTicketLookupTerm() {
    if (typeof queueTicketLookupTerm === 'string') {
        return queueTicketLookupTerm;
    }
    const stateSearch = normalizeQueueTicketLookupTerm(getState().queue.search);
    queueTicketLookupTerm = loadStoredQueueTicketLookupTerm() || stateSearch;
    return queueTicketLookupTerm;
}

function clearQueueTicketSimulationContext() {
    queueTicketSimulationContext = null;
    return null;
}

function cloneQueueTicketSnapshot(ticket) {
    return ticket && typeof ticket === 'object' ? { ...ticket } : null;
}

function persistQueueTicketSimulationContext(value) {
    const lookupTerm = normalizeQueueTicketLookupTerm(value?.lookupTerm || '');
    const targetTicketId = Number(value?.targetTicketId || 0);
    const sourceTicketId = Number(value?.sourceTicketId || 0);
    const tickets = Array.isArray(value?.tickets)
        ? value.tickets.map(cloneQueueTicketSnapshot).filter(Boolean)
        : [];
    if (!lookupTerm || !targetTicketId || !sourceTicketId || !tickets.length) {
        return clearQueueTicketSimulationContext();
    }
    queueTicketSimulationContext = {
        lookupTerm,
        targetTicketId,
        sourceTicketId,
        sourceStatus: String(value?.sourceStatus || '')
            .trim()
            .toLowerCase(),
        sourceConsultorio: Number(value?.sourceConsultorio || 0),
        sourceTicketCode: String(value?.sourceTicketCode || '').trim(),
        actionLabel: String(value?.actionLabel || '').trim(),
        tickets,
    };
    return queueTicketSimulationContext;
}

function getQueueTicketSimulationContext(currentLookupTerm = '') {
    const context = queueTicketSimulationContext;
    if (!context) {
        return null;
    }
    const lookupTerm = normalizeQueueTicketLookupTerm(currentLookupTerm);
    if (!lookupTerm || lookupTerm !== context.lookupTerm) {
        return clearQueueTicketSimulationContext();
    }
    const sourceTicket = getQueueTicketById(context.sourceTicketId);
    const sourceStatus = String(sourceTicket?.status || '')
        .trim()
        .toLowerCase();
    const sourceConsultorio = Number(sourceTicket?.assignedConsultorio || 0);
    if (
        !sourceTicket ||
        sourceStatus !== context.sourceStatus ||
        sourceConsultorio !== context.sourceConsultorio
    ) {
        return clearQueueTicketSimulationContext();
    }
    return context;
}

function getQueueAppsHubRoot() {
    const root = document.getElementById('queueAppsHub');
    return root instanceof HTMLElement ? root : null;
}

function getQueueAppsRefreshShieldChip() {
    const chip = document.getElementById('queueAppsRefreshShieldChip');
    return chip instanceof HTMLElement ? chip : null;
}

function resolveQueueOpsInteractionMeta() {
    if (queueOpsInteraction.pendingManifest) {
        return {
            state: 'deferred',
            label: 'Refresh en espera',
            detail: 'Se mantiene el hub estable hasta que termine la interacción actual.',
        };
    }
    if (hasActiveQueueOpsInteraction()) {
        return {
            state: 'active',
            label: 'Protegiendo interacción',
            detail: 'El hub aplaza repaints breves mientras estás usando sus controles.',
        };
    }
    return {
        state: 'idle',
        label: 'Refresh sin bloqueo',
        detail: 'El hub puede repintarse cuando llegue información nueva.',
    };
}

function syncQueueOpsInteractionIndicator() {
    const meta = resolveQueueOpsInteractionMeta();
    const root = getQueueAppsHubRoot();
    const chip = getQueueAppsRefreshShieldChip();
    if (root) {
        root.dataset.queueInteractionState = meta.state;
    }
    if (chip) {
        chip.dataset.state = meta.state;
        chip.textContent = meta.label;
        chip.title = meta.detail;
        chip.setAttribute('aria-label', meta.detail);
    }
}

function clearQueueOpsInteractionSettleTimer() {
    if (queueOpsInteraction.settleTimerId) {
        window.clearTimeout(queueOpsInteraction.settleTimerId);
        queueOpsInteraction.settleTimerId = 0;
    }
}

function scheduleQueueOpsInteractionSettle() {
    clearQueueOpsInteractionSettleTimer();
    if (queueOpsInteraction.pendingManifest) {
        syncQueueOpsInteractionIndicator();
        return;
    }
    if (!hasActiveQueueOpsInteraction()) {
        syncQueueOpsInteractionIndicator();
        return;
    }
    const waitMs = Math.max(
        80,
        QUEUE_OPS_INTERACTION_HOLD_MS - getQueueOpsInteractionAgeMs()
    );
    queueOpsInteraction.settleTimerId = window.setTimeout(() => {
        queueOpsInteraction.settleTimerId = 0;
        if (queueOpsInteraction.pendingManifest) {
            syncQueueOpsInteractionIndicator();
            return;
        }
        if (hasActiveQueueOpsInteraction()) {
            scheduleQueueOpsInteractionSettle();
            return;
        }
        syncQueueOpsInteractionIndicator();
    }, waitMs);
}

function markQueueOpsInteraction() {
    queueOpsInteraction.lastAt = Date.now();
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}

function getQueueOpsInteractionAgeMs() {
    if (!queueOpsInteraction.lastAt) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Date.now() - queueOpsInteraction.lastAt);
}

function hasActiveQueueOpsInteraction() {
    return getQueueOpsInteractionAgeMs() < QUEUE_OPS_INTERACTION_HOLD_MS;
}

function bindQueueOpsInteraction(root) {
    if (
        !(root instanceof HTMLElement) ||
        root.dataset.queueInteractionBound === 'true'
    ) {
        return;
    }

    const signalInteraction = () => {
        markQueueOpsInteraction();
    };

    root.addEventListener('pointerdown', signalInteraction, true);
    root.addEventListener('keydown', signalInteraction, true);
    root.addEventListener('focusin', signalInteraction, true);
    root.addEventListener('input', signalInteraction, true);
    root.addEventListener('change', signalInteraction, true);
    root.dataset.queueInteractionBound = 'true';
}

function clearDeferredQueueOpsInteraction() {
    if (queueOpsInteraction.timerId) {
        window.clearTimeout(queueOpsInteraction.timerId);
        queueOpsInteraction.timerId = 0;
    }
    queueOpsInteraction.pendingManifest = null;
    queueOpsInteraction.pendingPlatform = '';
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}

function flushDeferredQueueOpsHubRender() {
    const manifest = queueOpsInteraction.pendingManifest;
    const platform = queueOpsInteraction.pendingPlatform;
    queueOpsInteraction.timerId = 0;
    if (!manifest) {
        clearDeferredQueueOpsInteraction();
        return;
    }
    if (hasActiveQueueOpsInteraction()) {
        scheduleDeferredQueueOpsHubRender(manifest, platform);
        return;
    }
    renderQueueInstallHub({
        allowDuringInteraction: true,
        manifestOverride: manifest,
        platformOverride: platform,
    });
}

function scheduleDeferredQueueOpsHubRender(manifest, detectedPlatform) {
    queueOpsInteraction.pendingManifest = manifest;
    queueOpsInteraction.pendingPlatform = detectedPlatform;
    if (queueOpsInteraction.timerId) {
        window.clearTimeout(queueOpsInteraction.timerId);
    }
    clearQueueOpsInteractionSettleTimer();
    syncQueueOpsInteractionIndicator();
    const waitMs = Math.max(
        80,
        QUEUE_OPS_INTERACTION_HOLD_MS - getQueueOpsInteractionAgeMs()
    );
    queueOpsInteraction.timerId = window.setTimeout(() => {
        flushDeferredQueueOpsHubRender();
    }, waitMs);
}

function absoluteUrl(url) {
    try {
        return new URL(String(url || ''), window.location.origin).toString();
    } catch (_error) {
        return String(url || '');
    }
}

function buildQrUrl(url) {
    const encoded = encodeURIComponent(absoluteUrl(url));
    return `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encoded}`;
}

function buildGuideUrl(surfaceKey, preset, appConfig) {
    const base = new URL(
        String(appConfig.guideUrl || `/app-downloads/?surface=${surfaceKey}`),
        `${window.location.origin}/`
    );
    base.searchParams.set('surface', surfaceKey);
    if (surfaceKey === 'sala_tv') {
        base.searchParams.set('platform', 'android_tv');
    } else {
        base.searchParams.set(
            'platform',
            preset.platform === 'mac' ? 'mac' : 'win'
        );
    }
    if (surfaceKey === 'operator') {
        base.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        base.searchParams.set('lock', preset.lock ? '1' : '0');
        base.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    } else {
        base.searchParams.delete('station');
        base.searchParams.delete('lock');
        base.searchParams.delete('one_tap');
    }
    return `${base.pathname}${base.search}`;
}

function mergeManifest() {
    const appDownloads = getState().data.appDownloads;
    if (!appDownloads || typeof appDownloads !== 'object') {
        return DEFAULT_APP_DOWNLOADS;
    }
    return {
        operator: {
            ...DEFAULT_APP_DOWNLOADS.operator,
            ...(appDownloads.operator || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.operator.targets,
                ...((appDownloads.operator && appDownloads.operator.targets) ||
                    {}),
            },
        },
        kiosk: {
            ...DEFAULT_APP_DOWNLOADS.kiosk,
            ...(appDownloads.kiosk || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.kiosk.targets,
                ...((appDownloads.kiosk && appDownloads.kiosk.targets) || {}),
            },
        },
        sala_tv: {
            ...DEFAULT_APP_DOWNLOADS.sala_tv,
            ...(appDownloads.sala_tv || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.sala_tv.targets,
                ...((appDownloads.sala_tv && appDownloads.sala_tv.targets) ||
                    {}),
            },
        },
    };
}

function normalizeInstallPreset(rawPreset, detectedPlatform) {
    const raw = rawPreset && typeof rawPreset === 'object' ? rawPreset : {};
    const platform =
        raw.platform === 'mac'
            ? 'mac'
            : detectedPlatform === 'mac'
              ? 'mac'
              : 'win';

    return {
        surface:
            raw.surface === 'kiosk' || raw.surface === 'sala_tv'
                ? raw.surface
                : 'operator',
        station: raw.station === 'c2' ? 'c2' : 'c1',
        lock: Boolean(raw.lock),
        oneTap: Boolean(raw.oneTap),
        platform,
    };
}

function loadStoredInstallPreset(detectedPlatform) {
    try {
        const rawValue = window.localStorage.getItem(
            QUEUE_INSTALL_PRESET_STORAGE_KEY
        );
        if (!rawValue) {
            return null;
        }
        return normalizeInstallPreset(JSON.parse(rawValue), detectedPlatform);
    } catch (_error) {
        return null;
    }
}

function persistInstallPreset(nextPreset, detectedPlatform) {
    installPreset = normalizeInstallPreset(nextPreset, detectedPlatform);
    try {
        window.localStorage.setItem(
            QUEUE_INSTALL_PRESET_STORAGE_KEY,
            JSON.stringify(installPreset)
        );
    } catch (_error) {
        // localStorage can be unavailable in some browser modes
    }
    return installPreset;
}

function buildDerivedInstallPreset(detectedPlatform) {
    const state = getState();
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(
        operator.details.station || ''
    ).toLowerCase();
    const operatorStationMode = String(operator.details.stationMode || '')
        .trim()
        .toLowerCase();
    const operatorOneTap = operator.details.oneTap;

    return normalizeInstallPreset(
        {
            surface: 'operator',
            station:
                operatorStation === 'c2'
                    ? 'c2'
                    : operatorStation === 'c1'
                      ? 'c1'
                      : Number(
                              state.queue && state.queue.stationConsultorio
                          ) === 2
                        ? 'c2'
                        : 'c1',
            lock:
                operatorStationMode === 'locked'
                    ? true
                    : operatorStationMode === 'free'
                      ? false
                      : Boolean(
                            state.queue && state.queue.stationMode === 'locked'
                        ),
            oneTap:
                typeof operatorOneTap === 'boolean'
                    ? operatorOneTap
                    : Boolean(state.queue && state.queue.oneTap),
            platform:
                detectedPlatform === 'win' || detectedPlatform === 'mac'
                    ? detectedPlatform
                    : 'win',
        },
        detectedPlatform
    );
}

function ensureInstallPreset(detectedPlatform) {
    if (installPreset) {
        return installPreset;
    }

    const storedPreset = loadStoredInstallPreset(detectedPlatform);
    if (storedPreset) {
        installPreset = storedPreset;
        return installPreset;
    }

    installPreset = buildDerivedInstallPreset(detectedPlatform);
    return installPreset;
}

function getInstallPresetLabel(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const modeLabel = preset.lock
        ? `${stationLabel} fijo`
        : `${stationLabel} libre`;
    return `Operador ${modeLabel}${preset.oneTap ? ' · 1 tecla' : ''}`;
}

function buildInstallPresetChoices(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    return [
        {
            id: 'operator_c1_locked',
            label: 'Operador C1',
            state:
                preset.surface === 'operator' &&
                preset.station === 'c1' &&
                preset.lock,
            nextPreset: {
                ...preset,
                surface: 'operator',
                station: 'c1',
                lock: true,
            },
        },
        {
            id: 'operator_c2_locked',
            label: 'Operador C2',
            state:
                preset.surface === 'operator' &&
                preset.station === 'c2' &&
                preset.lock,
            nextPreset: {
                ...preset,
                surface: 'operator',
                station: 'c2',
                lock: true,
            },
        },
        {
            id: 'operator_free',
            label: 'Operador libre',
            state: preset.surface === 'operator' && !preset.lock,
            nextPreset: {
                ...preset,
                surface: 'operator',
                station: preset.station === 'c2' ? 'c2' : 'c1',
                lock: false,
            },
        },
        {
            id: 'kiosk',
            label: 'Kiosco',
            state: preset.surface === 'kiosk',
            nextPreset: {
                ...preset,
                surface: 'kiosk',
            },
        },
        {
            id: 'sala_tv',
            label: 'Sala TV',
            state: preset.surface === 'sala_tv',
            nextPreset: {
                ...preset,
                surface: 'sala_tv',
            },
        },
    ];
}

function getTodayLocalIsoDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatOpeningChecklistDate(isoDate) {
    const value = String(isoDate || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) {
        return value || '--';
    }
    return `${match[3]}/${match[2]}/${match[1]}`;
}

function createOpeningChecklistState(date = getTodayLocalIsoDate()) {
    return {
        date,
        steps: OPENING_CHECKLIST_STEP_IDS.reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {}),
    };
}

function normalizeOpeningChecklistState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const date = String(source.date || '').trim() === today ? today : today;
    return {
        date,
        steps: OPENING_CHECKLIST_STEP_IDS.reduce((acc, key) => {
            acc[key] = Boolean(source.steps && source.steps[key]);
            return acc;
        }, {}),
    };
}

function loadOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPENING_CHECKLIST_STORAGE_KEY);
        if (!raw) {
            return createOpeningChecklistState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpeningChecklistState(today);
        }
        return normalizeOpeningChecklistState(parsed);
    } catch (_error) {
        return createOpeningChecklistState(today);
    }
}

function persistOpeningChecklistState(nextState) {
    openingChecklistState = normalizeOpeningChecklistState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPENING_CHECKLIST_STORAGE_KEY,
            JSON.stringify(openingChecklistState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return openingChecklistState;
}

function ensureOpeningChecklistState() {
    const today = getTodayLocalIsoDate();
    if (!openingChecklistState || openingChecklistState.date !== today) {
        openingChecklistState = loadOpeningChecklistState();
    }
    return openingChecklistState;
}

function setOpeningChecklistStep(stepId, complete) {
    const current = ensureOpeningChecklistState();
    if (!OPENING_CHECKLIST_STEP_IDS.includes(stepId)) {
        return current;
    }
    return persistOpeningChecklistState({
        ...current,
        steps: {
            ...current.steps,
            [stepId]: Boolean(complete),
        },
    });
}

function resetOpeningChecklistState() {
    return persistOpeningChecklistState(
        createOpeningChecklistState(getTodayLocalIsoDate())
    );
}

function applyOpeningChecklistSuggestions(stepIds) {
    const current = ensureOpeningChecklistState();
    const validIds = (Array.isArray(stepIds) ? stepIds : []).filter((stepId) =>
        OPENING_CHECKLIST_STEP_IDS.includes(stepId)
    );
    if (!validIds.length) {
        return current;
    }

    const nextSteps = { ...current.steps };
    validIds.forEach((stepId) => {
        nextSteps[stepId] = true;
    });

    return persistOpeningChecklistState({
        ...current,
        steps: nextSteps,
    });
}

function createShiftHandoffState(date = getTodayLocalIsoDate()) {
    return {
        date,
        steps: SHIFT_HANDOFF_STEP_IDS.reduce((acc, key) => {
            acc[key] = false;
            return acc;
        }, {}),
    };
}

function normalizeShiftHandoffState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        steps: SHIFT_HANDOFF_STEP_IDS.reduce((acc, key) => {
            acc[key] = Boolean(source.steps && source.steps[key]);
            return acc;
        }, {}),
    };
}

function loadShiftHandoffState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_SHIFT_HANDOFF_STORAGE_KEY);
        if (!raw) {
            return createShiftHandoffState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createShiftHandoffState(today);
        }
        return normalizeShiftHandoffState(parsed);
    } catch (_error) {
        return createShiftHandoffState(today);
    }
}

function persistShiftHandoffState(nextState) {
    shiftHandoffState = normalizeShiftHandoffState(nextState);
    try {
        localStorage.setItem(
            QUEUE_SHIFT_HANDOFF_STORAGE_KEY,
            JSON.stringify(shiftHandoffState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return shiftHandoffState;
}

function ensureShiftHandoffState() {
    const today = getTodayLocalIsoDate();
    if (!shiftHandoffState || shiftHandoffState.date !== today) {
        shiftHandoffState = loadShiftHandoffState();
    }
    return shiftHandoffState;
}

function setShiftHandoffStep(stepId, complete) {
    const current = ensureShiftHandoffState();
    if (!SHIFT_HANDOFF_STEP_IDS.includes(stepId)) {
        return current;
    }
    return persistShiftHandoffState({
        ...current,
        steps: {
            ...current.steps,
            [stepId]: Boolean(complete),
        },
    });
}

function resetShiftHandoffState() {
    return persistShiftHandoffState(
        createShiftHandoffState(getTodayLocalIsoDate())
    );
}

function applyShiftHandoffSuggestions(stepIds) {
    const current = ensureShiftHandoffState();
    const validIds = (Array.isArray(stepIds) ? stepIds : []).filter((stepId) =>
        SHIFT_HANDOFF_STEP_IDS.includes(stepId)
    );
    if (!validIds.length) {
        return current;
    }

    const nextSteps = { ...current.steps };
    validIds.forEach((stepId) => {
        nextSteps[stepId] = true;
    });

    return persistShiftHandoffState({
        ...current,
        steps: nextSteps,
    });
}

function createOpsLogState(date = getTodayLocalIsoDate()) {
    return {
        date,
        items: [],
    };
}

function normalizeOpsLogItem(rawItem) {
    const source = rawItem && typeof rawItem === 'object' ? rawItem : {};
    const tone = String(source.tone || 'info')
        .trim()
        .toLowerCase();
    return {
        id: String(
            source.id ||
                `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
        ),
        createdAt: String(source.createdAt || new Date().toISOString()),
        tone:
            tone === 'success' || tone === 'warning' || tone === 'alert'
                ? tone
                : 'info',
        title: String(source.title || 'Evento operativo'),
        summary: String(source.summary || '').trim(),
        source: String(source.source || 'manual').trim() || 'manual',
    };
}

function normalizeOpsLogState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        items: Array.isArray(source.items)
            ? source.items
                  .map((item) => normalizeOpsLogItem(item))
                  .slice(0, QUEUE_OPS_LOG_MAX_ITEMS)
            : [],
    };
}

function loadOpsLogState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPS_LOG_STORAGE_KEY);
        if (!raw) {
            return createOpsLogState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsLogState(today);
        }
        return normalizeOpsLogState(parsed);
    } catch (_error) {
        return createOpsLogState(today);
    }
}

function persistOpsLogState(nextState) {
    opsLogState = normalizeOpsLogState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPS_LOG_STORAGE_KEY,
            JSON.stringify(opsLogState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsLogState;
}

function ensureOpsLogState() {
    const today = getTodayLocalIsoDate();
    if (!opsLogState || opsLogState.date !== today) {
        opsLogState = loadOpsLogState();
    }
    return opsLogState;
}

function appendOpsLogEntry(entry) {
    const current = ensureOpsLogState();
    const nextItem = normalizeOpsLogItem({
        ...entry,
        createdAt: entry?.createdAt || new Date().toISOString(),
    });
    const lastItem = current.items[0];
    if (
        lastItem &&
        lastItem.title === nextItem.title &&
        lastItem.summary === nextItem.summary
    ) {
        const lastMs = Date.parse(lastItem.createdAt);
        const nextMs = Date.parse(nextItem.createdAt);
        if (
            Number.isFinite(lastMs) &&
            Number.isFinite(nextMs) &&
            Math.abs(nextMs - lastMs) < 30000
        ) {
            return current;
        }
    }

    return persistOpsLogState({
        ...current,
        items: [nextItem, ...current.items].slice(0, QUEUE_OPS_LOG_MAX_ITEMS),
    });
}

function clearOpsLogState() {
    return persistOpsLogState(createOpsLogState(getTodayLocalIsoDate()));
}

function normalizeOpsLogFilter(rawValue) {
    const value = String(rawValue || 'all')
        .trim()
        .toLowerCase();
    return value === 'incidents' || value === 'changes' || value === 'status'
        ? value
        : 'all';
}

function loadOpsLogFilter() {
    try {
        return normalizeOpsLogFilter(
            localStorage.getItem(QUEUE_OPS_LOG_FILTER_STORAGE_KEY)
        );
    } catch (_error) {
        return 'all';
    }
}

function ensureOpsLogFilter() {
    if (!opsLogFilter) {
        opsLogFilter = loadOpsLogFilter();
    }
    return opsLogFilter;
}

function persistOpsLogFilter(nextFilter) {
    opsLogFilter = normalizeOpsLogFilter(nextFilter);
    try {
        localStorage.setItem(QUEUE_OPS_LOG_FILTER_STORAGE_KEY, opsLogFilter);
    } catch (_error) {
        // ignore storage write failures
    }
    return opsLogFilter;
}

function createOpsAlertsState(date = getTodayLocalIsoDate()) {
    return {
        date,
        reviewed: {},
    };
}

function normalizeOpsAlertsState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const reviewedSource =
        source.reviewed && typeof source.reviewed === 'object'
            ? source.reviewed
            : {};
    const reviewed = Object.entries(reviewedSource).reduce(
        (acc, [alertId, value]) => {
            if (!alertId) {
                return acc;
            }
            const reviewedAt = String(value?.reviewedAt || '').trim();
            acc[String(alertId)] = {
                reviewedAt: reviewedAt || new Date().toISOString(),
            };
            return acc;
        },
        {}
    );

    return {
        date: String(source.date || '').trim() === today ? today : today,
        reviewed,
    };
}

function loadOpsAlertsState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPS_ALERTS_STORAGE_KEY);
        if (!raw) {
            return createOpsAlertsState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsAlertsState(today);
        }
        return normalizeOpsAlertsState(parsed);
    } catch (_error) {
        return createOpsAlertsState(today);
    }
}

function persistOpsAlertsState(nextState) {
    opsAlertsState = normalizeOpsAlertsState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPS_ALERTS_STORAGE_KEY,
            JSON.stringify(opsAlertsState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsAlertsState;
}

function ensureOpsAlertsState() {
    const today = getTodayLocalIsoDate();
    if (!opsAlertsState || opsAlertsState.date !== today) {
        opsAlertsState = loadOpsAlertsState();
    }
    return opsAlertsState;
}

function setOpsAlertReviewed(alertId, reviewed) {
    const current = ensureOpsAlertsState();
    const nextReviewed = {
        ...current.reviewed,
    };
    if (reviewed) {
        nextReviewed[String(alertId)] = {
            reviewedAt: new Date().toISOString(),
        };
    } else {
        delete nextReviewed[String(alertId)];
    }
    return persistOpsAlertsState({
        ...current,
        reviewed: nextReviewed,
    });
}

function markOpsAlertsReviewed(alertIds) {
    const validIds = Array.isArray(alertIds)
        ? alertIds
              .map((alertId) => String(alertId || '').trim())
              .filter(Boolean)
        : [];
    if (!validIds.length) {
        return ensureOpsAlertsState();
    }

    const current = ensureOpsAlertsState();
    const nextReviewed = { ...current.reviewed };
    const reviewedAt = new Date().toISOString();
    validIds.forEach((alertId) => {
        nextReviewed[alertId] = { reviewedAt };
    });

    return persistOpsAlertsState({
        ...current,
        reviewed: nextReviewed,
    });
}

function normalizeOpsFocusMode(rawValue) {
    const value = String(rawValue || 'auto')
        .trim()
        .toLowerCase();
    return value === 'opening' ||
        value === 'operations' ||
        value === 'incidents' ||
        value === 'closing'
        ? value
        : 'auto';
}

function loadOpsFocusMode() {
    try {
        return normalizeOpsFocusMode(
            localStorage.getItem(QUEUE_OPS_FOCUS_MODE_STORAGE_KEY)
        );
    } catch (_error) {
        return 'auto';
    }
}

function ensureOpsFocusMode() {
    if (!opsFocusMode) {
        opsFocusMode = loadOpsFocusMode();
    }
    return opsFocusMode;
}

function persistOpsFocusMode(nextMode) {
    opsFocusMode = normalizeOpsFocusMode(nextMode);
    try {
        localStorage.setItem(QUEUE_OPS_FOCUS_MODE_STORAGE_KEY, opsFocusMode);
    } catch (_error) {
        // ignore storage write failures
    }
    return opsFocusMode;
}

function buildPlaybookDefinitions(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        opening: [
            {
                id: 'opening_operator',
                title: 'Abrir Operador',
                detail: 'Verifica estación, lock y flujo base del equipo principal.',
                href: operatorUrl,
                actionLabel: 'Abrir Operador',
            },
            {
                id: 'opening_kiosk',
                title: 'Validar Kiosco + térmica',
                detail: 'Confirma ticket térmico, cola viva y contingencia offline limpia.',
                href: kioskUrl,
                actionLabel: 'Abrir Kiosco',
            },
            {
                id: 'opening_sala',
                title: 'Validar Sala TV',
                detail: 'Deja audio, campanilla y visualización listos en la TCL C655.',
                href: salaUrl,
                actionLabel: 'Abrir Sala TV',
            },
        ],
        operations: [
            {
                id: 'operations_monitor',
                title: 'Monitorear equipos vivos',
                detail: 'Revisa heartbeat, cola viva y estado general antes de seguir atendiendo.',
                href: '#queueSurfaceTelemetry',
                actionLabel: 'Ir a equipos',
            },
            {
                id: 'operations_call',
                title: 'Lanzar siguiente llamada',
                detail: 'Usa C1/C2 o el operador actual para mover la cola con el menor roce posible.',
                href: '#queueQuickConsole',
                actionLabel: 'Ir a consola',
            },
            {
                id: 'operations_log',
                title: 'Registrar cambio importante',
                detail: 'Si cambias perfil o detectas desvío, deja rastro en la bitácora operativa.',
                href: '#queueOpsLog',
                actionLabel: 'Ir a bitácora',
            },
        ],
        incidents: [
            {
                id: 'incidents_refresh',
                title: 'Refrescar y confirmar sync',
                detail: 'Atiende primero fallback, retrasos y watchdog antes de tocar hardware.',
                href: '#queueContingencyDeck',
                actionLabel: 'Ir a contingencias',
            },
            {
                id: 'incidents_surface',
                title: 'Abrir el equipo afectado',
                detail: 'Ve directo a Operador, Kiosco o Sala TV según la superficie que cayó.',
                href: '#queueQuickConsole',
                actionLabel: 'Ir a consola',
            },
            {
                id: 'incidents_log',
                title: 'Registrar incidencia',
                detail: 'Deja en la bitácora qué falló, qué se hizo y qué queda pendiente.',
                href: '#queueOpsLog',
                actionLabel: 'Ir a bitácora',
            },
        ],
        closing: [
            {
                id: 'closing_queue',
                title: 'Confirmar cola limpia',
                detail: 'No cierres si todavía hay tickets waiting o called.',
                href: '#queueShiftHandoff',
                actionLabel: 'Ir a relevo',
            },
            {
                id: 'closing_surfaces',
                title: 'Dejar superficies listas',
                detail: 'Operador, Kiosco y Sala TV deben quedar claros para el siguiente turno.',
                href: '#queueSurfaceTelemetry',
                actionLabel: 'Ir a equipos',
            },
            {
                id: 'closing_copy',
                title: 'Copiar y cerrar relevo',
                detail: 'Entrega un resumen textual corto del estado del turno.',
                href: '#queueShiftHandoff',
                actionLabel: 'Ir a resumen',
            },
        ],
    };
}

function createOpsPlaybookState(date = getTodayLocalIsoDate()) {
    return {
        date,
        modes: {
            opening: {},
            operations: {},
            incidents: {},
            closing: {},
        },
    };
}

function normalizeOpsPlaybookState(rawState) {
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const safeModes =
        source.modes && typeof source.modes === 'object' ? source.modes : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        modes: {
            opening:
                safeModes.opening && typeof safeModes.opening === 'object'
                    ? { ...safeModes.opening }
                    : {},
            operations:
                safeModes.operations && typeof safeModes.operations === 'object'
                    ? { ...safeModes.operations }
                    : {},
            incidents:
                safeModes.incidents && typeof safeModes.incidents === 'object'
                    ? { ...safeModes.incidents }
                    : {},
            closing:
                safeModes.closing && typeof safeModes.closing === 'object'
                    ? { ...safeModes.closing }
                    : {},
        },
    };
}

function loadOpsPlaybookState() {
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(QUEUE_OPS_PLAYBOOK_STORAGE_KEY);
        if (!raw) {
            return createOpsPlaybookState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsPlaybookState(today);
        }
        return normalizeOpsPlaybookState(parsed);
    } catch (_error) {
        return createOpsPlaybookState(today);
    }
}

function persistOpsPlaybookState(nextState) {
    opsPlaybookState = normalizeOpsPlaybookState(nextState);
    try {
        localStorage.setItem(
            QUEUE_OPS_PLAYBOOK_STORAGE_KEY,
            JSON.stringify(opsPlaybookState)
        );
    } catch (_error) {
        // ignore storage write failures
    }
    return opsPlaybookState;
}

function ensureOpsPlaybookState() {
    const today = getTodayLocalIsoDate();
    if (!opsPlaybookState || opsPlaybookState.date !== today) {
        opsPlaybookState = loadOpsPlaybookState();
    }
    return opsPlaybookState;
}

function setOpsPlaybookStep(mode, stepId, complete) {
    const current = ensureOpsPlaybookState();
    const safeMode =
        mode === 'opening' ||
        mode === 'operations' ||
        mode === 'incidents' ||
        mode === 'closing'
            ? mode
            : 'operations';
    return persistOpsPlaybookState({
        ...current,
        modes: {
            ...current.modes,
            [safeMode]: {
                ...(current.modes[safeMode] || {}),
                [stepId]: Boolean(complete),
            },
        },
    });
}

function resetOpsPlaybookMode(mode) {
    const current = ensureOpsPlaybookState();
    const safeMode =
        mode === 'opening' ||
        mode === 'operations' ||
        mode === 'incidents' ||
        mode === 'closing'
            ? mode
            : 'operations';
    return persistOpsPlaybookState({
        ...current,
        modes: {
            ...current.modes,
            [safeMode]: {},
        },
    });
}

function getDesktopTarget(appConfig, platform) {
    if (platform === 'mac' && appConfig.targets.mac) {
        return appConfig.targets.mac;
    }
    if (platform === 'win' && appConfig.targets.win) {
        return appConfig.targets.win;
    }
    return appConfig.targets.win || appConfig.targets.mac || null;
}

function buildPreparedSurfaceUrl(surfaceKey, appConfig, preset) {
    const url = new URL(
        String(appConfig.webFallbackUrl || '/'),
        `${window.location.origin}/`
    );

    if (surfaceKey === 'operator') {
        url.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        url.searchParams.set('lock', preset.lock ? '1' : '0');
        url.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    }

    return url.toString();
}

function renderDesktopCard(key, appConfig, platform) {
    const copy = APP_COPY[key];
    const preset = ensureInstallPreset(platform);
    const detectedTarget = getDesktopTarget(appConfig, platform);
    const detectedLabel =
        platform === 'mac'
            ? 'macOS'
            : platform === 'win'
              ? 'Windows'
              : (detectedTarget && detectedTarget.label) || 'este equipo';
    const alternateTargets = Object.entries(appConfig.targets || {})
        .filter(([_targetKey, value]) => value && value.url)
        .map(
            ([targetKey, value]) => `
                <a
                    href="${escapeHtml(value.url)}"
                    class="${targetKey === platform ? 'queue-app-card__recommended' : ''}"
                    download
                >
                    ${escapeHtml(value.label || targetKey)}
                </a>
            `
        )
        .join('');

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                ${
                    detectedTarget && detectedTarget.url
                        ? `<a href="${escapeHtml(
                              detectedTarget.url
                          )}" class="queue-app-card__cta-primary" download>Descargar para ${escapeHtml(
                              detectedLabel
                          )}</a>`
                        : ''
                }
            </div>
            <div class="queue-app-card__targets">${alternateTargets}</div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/')}">Abrir versión web</a>
                <a href="${escapeHtml(buildGuideUrl(key, preset, appConfig))}">Centro de instalación</a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(
                        absoluteUrl(
                            (detectedTarget && detectedTarget.url) || ''
                        )
                    )}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function renderTvCard(appConfig) {
    const copy = APP_COPY.sala_tv;
    const preset = ensureInstallPreset(detectPlatform());
    const target = appConfig.targets.android_tv || {};
    const apkUrl = String(target.url || '');
    const qrUrl = buildQrUrl(apkUrl);

    return `
        <article class="queue-app-card">
            <div>
                <p class="queue-app-card__eyebrow">${escapeHtml(copy.eyebrow)}</p>
                <h5 class="queue-app-card__title">${escapeHtml(copy.title)}</h5>
                <p class="queue-app-card__description">${escapeHtml(copy.description)}</p>
            </div>
            <p class="queue-app-card__meta">
                v${escapeHtml(appConfig.version || '0.1.0')} · ${escapeHtml(
                    formatDateTime(appConfig.updatedAt || '')
                )}
            </p>
            <span class="queue-app-card__tag">Ideal para ${escapeHtml(copy.recommendedFor)}</span>
            <div class="queue-app-card__actions">
                <a
                    href="${escapeHtml(qrUrl)}"
                    class="queue-app-card__cta-primary"
                    target="_blank"
                    rel="noopener"
                >
                    Mostrar QR de instalación
                </a>
                <a href="${escapeHtml(apkUrl)}" download>Descargar APK</a>
            </div>
            <div class="queue-app-card__links">
                <a href="${escapeHtml(appConfig.webFallbackUrl || '/sala-turnos.html')}">
                    Abrir fallback web
                </a>
                <a href="${escapeHtml(buildGuideUrl('sala_tv', preset, appConfig))}">
                    Centro de instalación
                </a>
                <button
                    type="button"
                    data-action="queue-copy-install-link"
                    data-queue-install-url="${escapeHtml(absoluteUrl(apkUrl))}"
                >
                    Copiar enlace
                </button>
            </div>
            <ul class="queue-app-card__notes">
                ${copy.notes
                    .map((note) => `<li>${escapeHtml(note)}</li>`)
                    .join('')}
            </ul>
        </article>
    `;
}

function buildPresetSummaryTitle(preset) {
    if (preset.surface === 'sala_tv') {
        return 'Sala TV lista para TCL C655';
    }
    if (preset.surface === 'kiosk') {
        return 'Kiosco listo para mostrador';
    }

    if (!preset.lock) {
        return 'Operador en modo libre';
    }

    return `Operador ${preset.station === 'c2' ? 'C2' : 'C1'} fijo`;
}

function buildPresetSteps(preset) {
    if (preset.surface === 'sala_tv') {
        return [
            'Abre el QR desde otra pantalla o descarga la APK directamente.',
            'Instala la app en la TCL C655 y prioriza Ethernet sobre Wi-Fi.',
            'Valida audio, reconexión y que la sala refleje llamados reales.',
        ];
    }

    if (preset.surface === 'kiosk') {
        return [
            'Instala la app en el mini PC o PC del kiosco.',
            'Deja la impresora térmica conectada y la app en fullscreen.',
            'Usa la versión web como respaldo inmediato si el equipo se reinicia.',
        ];
    }

    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    return [
        `Instala Turnero Operador en el PC de ${stationLabel} y conecta el receptor USB del Genius Numpad 1000.`,
        `En el primer arranque deja el equipo como ${preset.lock ? `${stationLabel} fijo` : 'modo libre'}${preset.oneTap ? ' con 1 tecla' : ''}.`,
        'Si el numpad no reporta Enter como se espera, calibra la tecla externa dentro de la app.',
    ];
}

function buildOpeningChecklistSteps(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock
        ? `${stationLabel} fijo`
        : 'modo libre';

    return [
        {
            id: 'operator_ready',
            title: 'Operador + Genius Numpad 1000',
            detail: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''} y confirma Numpad Enter, Decimal y Subtract.`,
            hint: 'El receptor USB 2.4 GHz del numpad debe quedar conectado en el PC operador.',
            href: operatorUrl,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_ready',
            title: 'Kiosco + ticket térmico',
            detail: 'Abre el kiosco, genera un ticket de prueba y confirma que el panel muestre "Impresion OK".',
            hint: 'Revisa papel, energía y USB de la térmica antes de dejar autoservicio abierto.',
            href: kioskUrl,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_ready',
            title: 'Sala TV + audio en TCL C655',
            detail: 'Abre la sala, ejecuta "Probar campanilla" y confirma audio activo con la TV conectada por Ethernet.',
            hint: 'La TCL C655 debe quedar con volumen fijo y sin mute antes del primer llamado real.',
            href: salaUrl,
            actionLabel: 'Abrir sala TV',
        },
        {
            id: 'smoke_ready',
            title: 'Smoke final de apertura',
            detail: 'Haz un llamado real o de prueba desde Operador y verifica que recepción, kiosco y sala entiendan el flujo completo.',
            hint: 'Marca este paso solo cuando el llamado salga end-to-end y sea visible en la TV.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
    ];
}

function getLatestSurfaceDetails(surfaceKey) {
    const group = getSurfaceTelemetryState(surfaceKey);
    const latest =
        group.latest && typeof group.latest === 'object' ? group.latest : null;
    const details =
        latest?.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    return { group, latest, details };
}

function hasRecentQueueSmokeSignal(maxAgeSec = 21600) {
    const queueMeta = getQueueSource().queueMeta;
    if (Number(queueMeta?.calledCount || 0) > 0) {
        return true;
    }

    const queueTickets = Array.isArray(getState().data?.queueTickets)
        ? getState().data.queueTickets
        : [];
    if (
        queueTickets.some((ticket) => String(ticket.status || '') === 'called')
    ) {
        return true;
    }

    return (getState().queue?.activity || []).some((entry) => {
        const message = String(entry?.message || '');
        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(message)) {
            return false;
        }
        const entryMs = Date.parse(String(entry?.at || ''));
        if (!Number.isFinite(entryMs)) {
            return true;
        }
        return Date.now() - entryMs <= maxAgeSec * 1000;
    });
}

function buildOpeningChecklistAssist(detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const checklist = ensureOpeningChecklistState();
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');

    const operatorStation = String(
        operator.details.station || ''
    ).toLowerCase();
    const operatorConnection = String(
        operator.details.connection || 'live'
    ).toLowerCase();
    const operatorStationMatches =
        !preset.lock || !operatorStation || operatorStation === expectedStation;
    const operatorSuggested =
        operator.group.status === 'ready' &&
        !operator.group.stale &&
        Boolean(operator.details.numpadSeen) &&
        operatorStationMatches &&
        operatorConnection !== 'fallback';

    const kioskConnection = String(
        kiosk.details.connection || ''
    ).toLowerCase();
    const kioskSuggested =
        kiosk.group.status === 'ready' &&
        !kiosk.group.stale &&
        Boolean(kiosk.details.printerPrinted) &&
        kioskConnection === 'live';

    const displayConnection = String(
        display.details.connection || ''
    ).toLowerCase();
    const displaySuggested =
        display.group.status === 'ready' &&
        !display.group.stale &&
        Boolean(display.details.bellPrimed) &&
        !display.details.bellMuted &&
        displayConnection === 'live';

    const smokeSuggested =
        operatorSuggested && displaySuggested && hasRecentQueueSmokeSignal();

    const suggestions = {
        operator_ready: {
            suggested: operatorSuggested,
            reason: operatorSuggested
                ? `Heartbeat operador listo${preset.lock ? ` en ${expectedStation.toUpperCase()} fijo` : ''} con numpad detectado.`
                : operator.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del operador.'
                  : !operatorStationMatches
                    ? `El operador reporta ${operatorStation.toUpperCase() || 'otra estación'}. Ajusta el perfil antes de confirmar.`
                    : !operator.details.numpadSeen
                      ? 'Falta una pulsación real del Genius Numpad 1000 para validar el equipo.'
                      : 'Confirma el operador manualmente antes de abrir consulta.',
        },
        kiosk_ready: {
            suggested: kioskSuggested,
            reason: kioskSuggested
                ? 'El kiosco ya reportó impresión OK y conexión en vivo.'
                : kiosk.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente del kiosco.'
                  : !kiosk.details.printerPrinted
                    ? 'Falta imprimir un ticket real o de prueba para validar la térmica.'
                    : kioskConnection !== 'live'
                      ? 'El kiosco no está reportando cola en vivo todavía.'
                      : 'Confirma el kiosco manualmente antes de abrir autoservicio.',
        },
        sala_ready: {
            suggested: displaySuggested,
            reason: displaySuggested
                ? 'La Sala TV reporta audio listo, campanilla activa y conexión estable.'
                : display.group.status === 'unknown'
                  ? 'Todavía no hay heartbeat reciente de la Sala TV.'
                  : display.details.bellMuted
                    ? 'La TV sigue en mute o con campanilla apagada.'
                    : !display.details.bellPrimed
                      ? 'Falta ejecutar la prueba de campanilla en la TV.'
                      : displayConnection !== 'live'
                        ? 'La Sala TV no está reportando conexión en vivo todavía.'
                        : 'Confirma la Sala TV manualmente antes del primer llamado.',
        },
        smoke_ready: {
            suggested: smokeSuggested,
            reason: smokeSuggested
                ? 'Ya hubo un llamado reciente con Operador y Sala TV listos.'
                : 'Haz un llamado real o de prueba para validar el flujo end-to-end antes de abrir completamente.',
        },
    };

    const suggestedIds = Object.entries(suggestions)
        .filter(
            ([stepId, signal]) =>
                !checklist.steps[stepId] && Boolean(signal?.suggested)
        )
        .map(([stepId]) => stepId);

    return {
        suggestedIds,
        suggestions,
        suggestedCount: suggestedIds.length,
    };
}

function buildShiftHandoffSteps(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return [
        {
            id: 'queue_clear',
            title: 'Cola sin tickets activos',
            detail: 'Confirma que no quedan pacientes en espera ni llamados activos antes de cerrar el turno.',
            hint: 'No cierres el día si aún hay tickets `waiting` o `called`.',
            href: '/admin.html#queue',
            actionLabel: 'Abrir cola admin',
        },
        {
            id: 'operator_handoff',
            title: 'Operador listo para relevo',
            detail: 'Deja visible el perfil activo, valida el numpad y entrega el equipo sin dejar dudas de estación o modo.',
            hint: 'El PC operador debe quedar identificable para el siguiente turno.',
            href: operatorUrl,
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk_handoff',
            title: 'Kiosco sin pendientes offline',
            detail: 'Verifica que el kiosco no tenga tickets pendientes por sincronizar y que el autoservicio pueda reabrirse limpio.',
            hint: 'Si hay pendientes offline, no cierres sin sincronizar o anotar la contingencia.',
            href: kioskUrl,
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'sala_handoff',
            title: 'Sala TV lista para mañana',
            detail: 'Deja la TCL C655 identificable, con audio visible y sin mute para la siguiente apertura.',
            hint: 'Una TV sin mute o fuera de foreground complica el arranque del siguiente turno.',
            href: salaUrl,
            actionLabel: 'Abrir sala TV',
        },
    ];
}

function buildShiftHandoffAssist(detectedPlatform) {
    const checklist = ensureShiftHandoffState();
    const { queueMeta } = getQueueSource();
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');
    const waitingCount = Number(queueMeta?.waitingCount || 0);
    const calledCount = Number(queueMeta?.calledCount || 0);
    const queueClearSuggested = waitingCount <= 0 && calledCount <= 0;
    const operatorSuggested =
        queueClearSuggested &&
        operator.group.status !== 'unknown' &&
        !operator.group.stale &&
        Boolean(operator.details.numpadSeen);
    const kioskSuggested =
        queueClearSuggested &&
        Number(kiosk.details.pendingOffline || 0) <= 0 &&
        String(kiosk.details.connection || 'live').toLowerCase() !== 'fallback';
    const salaSuggested =
        queueClearSuggested &&
        display.group.status !== 'unknown' &&
        !display.group.stale &&
        !display.details.bellMuted;

    const suggestions = {
        queue_clear: {
            suggested: queueClearSuggested,
            reason: queueClearSuggested
                ? 'La cola ya no reporta tickets en espera ni llamados activos.'
                : `Quedan ${waitingCount} en espera y ${calledCount} llamados activos. Atiende eso antes del cierre.`,
        },
        operator_handoff: {
            suggested: operatorSuggested,
            reason: operatorSuggested
                ? 'El operador sigue reportando numpad detectado y equipo visible para relevo.'
                : 'Abre Operador y deja claro el perfil/estación antes de entregar el puesto.',
        },
        kiosk_handoff: {
            suggested: kioskSuggested,
            reason: kioskSuggested
                ? 'El kiosco no reporta pendientes offline para el siguiente turno.'
                : `El kiosco todavía muestra ${Number(kiosk.details.pendingOffline || 0)} pendiente(s) offline o conexión degradada.`,
        },
        sala_handoff: {
            suggested: salaSuggested,
            reason: salaSuggested
                ? 'La Sala TV sigue visible y sin mute para la siguiente apertura.'
                : 'Valida mute/foreground de la Sala TV antes de cerrar el turno.',
        },
    };

    const suggestedIds = Object.entries(suggestions)
        .filter(
            ([stepId, signal]) =>
                !checklist.steps[stepId] && Boolean(signal?.suggested)
        )
        .map(([stepId]) => stepId);

    return {
        suggestions,
        suggestedIds,
        suggestedCount: suggestedIds.length,
    };
}

function buildShiftHandoffSummary(detectedPlatform) {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const opening = ensureOpeningChecklistState();
    const closing = ensureShiftHandoffState();
    const openingConfirmed = OPENING_CHECKLIST_STEP_IDS.filter(
        (stepId) => opening.steps[stepId]
    ).length;
    const closingConfirmed = SHIFT_HANDOFF_STEP_IDS.filter(
        (stepId) => closing.steps[stepId]
    ).length;
    const operator = getLatestSurfaceDetails('operator');
    const kiosk = getLatestSurfaceDetails('kiosk');
    const display = getLatestSurfaceDetails('display');
    const syncHealth = getQueueSyncHealth();
    const queueLine = `Cola: espera ${Number(queueMeta?.waitingCount || 0)}, llamados ${Number(queueMeta?.calledCount || 0)}, sync ${String(state.queue?.syncMode || 'live')}.`;
    const operatorLine = `Operador: ${String(operator.latest?.deviceLabel || 'sin equipo')} · ${String(operator.group.summary || 'sin resumen')} `;
    const kioskLine = `Kiosco: ${String(kiosk.latest?.deviceLabel || 'sin equipo')} · ${String(kiosk.group.summary || 'sin resumen')} `;
    const salaLine = `Sala TV: ${String(display.latest?.deviceLabel || 'sin equipo')} · ${String(display.group.summary || 'sin resumen')} `;

    return [
        `Relevo Turnero Sala - ${formatDateTime(new Date().toISOString())}`,
        queueLine,
        `Sync operativo: ${syncHealth.title}.`,
        operatorLine.trim(),
        kioskLine.trim(),
        salaLine.trim(),
        `Apertura confirmada: ${openingConfirmed}/${OPENING_CHECKLIST_STEP_IDS.length}.`,
        `Cierre confirmado: ${closingConfirmed}/${SHIFT_HANDOFF_STEP_IDS.length}.`,
        `Perfil actual operador: ${ensureInstallPreset(detectedPlatform).station === 'c2' ? 'C2' : 'C1'}${ensureInstallPreset(detectedPlatform).lock ? ' fijo' : ' libre'}.`,
    ].join('\n');
}

function buildOpsLogStatusEntry(manifest, detectedPlatform) {
    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const opening = ensureOpeningChecklistState();
    const closing = ensureShiftHandoffState();
    const openingConfirmed = OPENING_CHECKLIST_STEP_IDS.filter(
        (stepId) => opening.steps[stepId]
    ).length;
    const closingConfirmed = SHIFT_HANDOFF_STEP_IDS.filter(
        (stepId) => closing.steps[stepId]
    ).length;

    return {
        tone:
            syncHealth.state === 'alert'
                ? 'alert'
                : pilot.issueCount > 0
                  ? 'warning'
                  : 'success',
        source: 'status',
        title: 'Estado actual registrado',
        summary: `${pilot.title}. Apertura ${openingConfirmed}/${OPENING_CHECKLIST_STEP_IDS.length}, cierre ${closingConfirmed}/${SHIFT_HANDOFF_STEP_IDS.length}, equipos listos ${pilot.readyEquipmentCount}/3, sync ${syncHealth.title.toLowerCase()}, perfil ${getInstallPresetLabel(
            detectedPlatform
        )}.`,
    };
}

function buildOpsLogIncidentEntry(manifest, detectedPlatform) {
    const syncHealth = getQueueSyncHealth();
    const telemetryCards = buildSurfaceTelemetryCards(
        manifest,
        detectedPlatform
    );
    const criticalCard = telemetryCards.find((card) => card.state === 'alert');
    const warningCard = telemetryCards.find(
        (card) => card.state === 'warning' || card.state === 'unknown'
    );
    const targetCard = criticalCard || warningCard;

    if (syncHealth.state === 'alert') {
        return {
            tone: 'alert',
            source: 'incident',
            title: `Incidencia: ${syncHealth.title}`,
            summary: syncHealth.summary,
        };
    }

    if (targetCard) {
        return {
            tone: targetCard.state === 'alert' ? 'alert' : 'warning',
            source: 'incident',
            title: `Incidencia: ${targetCard.title}`,
            summary: `${targetCard.summary} ${targetCard.ageLabel}.`,
        };
    }

    return {
        tone: 'success',
        source: 'incident',
        title: 'Sin incidencia crítica visible',
        summary:
            'No hay alertas abiertas en Operador, Kiosco o Sala TV. Se registró estabilidad del sistema para seguimiento.',
    };
}

function getOpsLogSourceLabel(source) {
    const value = String(source || '')
        .trim()
        .toLowerCase();
    if (value === 'incident') {
        return 'Incidencia';
    }
    if (value === 'config') {
        return 'Configuración';
    }
    if (value === 'opening') {
        return 'Apertura';
    }
    if (value === 'handoff') {
        return 'Relevo';
    }
    if (value === 'status') {
        return 'Estado';
    }
    if (value === 'dispatch') {
        return 'Despacho';
    }
    if (value === 'ticket_simulation') {
        return 'Simulación';
    }
    if (value === 'next_turns') {
        return 'Próximos turnos';
    }
    if (value === 'master_sequence') {
        return 'Ronda maestra';
    }
    if (value === 'coverage') {
        return 'Cobertura';
    }
    if (value === 'reserve') {
        return 'Reserva';
    }
    if (value === 'general_guidance') {
        return 'Cola general';
    }
    if (value === 'projection') {
        return 'Proyección';
    }
    if (value === 'new_intake') {
        return 'Ingresos nuevos';
    }
    if (value === 'intake_scenarios') {
        return 'Escenarios';
    }
    if (value === 'reception_script') {
        return 'Guion';
    }
    if (value === 'reception_collision') {
        return 'Recepción simultánea';
    }
    if (value === 'reception_lights') {
        return 'Semáforo';
    }
    if (value === 'blockers') {
        return 'Bloqueos';
    }
    if (value === 'sla_live') {
        return 'SLA vivo';
    }
    return 'Manual';
}

function filterOpsLogItems(items, filter) {
    const list = Array.isArray(items) ? items : [];
    if (filter === 'incidents') {
        return list.filter(
            (item) =>
                item.source === 'incident' ||
                item.tone === 'warning' ||
                item.tone === 'alert'
        );
    }
    if (filter === 'changes') {
        return list.filter((item) =>
            [
                'config',
                'opening',
                'handoff',
                'dispatch',
                'ticket_simulation',
                'next_turns',
                'master_sequence',
                'coverage',
                'reserve',
                'general_guidance',
                'projection',
                'new_intake',
                'intake_scenarios',
                'reception_script',
                'reception_collision',
                'reception_lights',
                'blockers',
                'sla_live',
            ].includes(item.source)
        );
    }
    if (filter === 'status') {
        return list.filter((item) => item.source === 'status');
    }
    return list;
}

function getOpsLogFilterLabel(filter) {
    if (filter === 'incidents') {
        return 'Incidencias';
    }
    if (filter === 'changes') {
        return 'Cambios';
    }
    if (filter === 'status') {
        return 'Estados';
    }
    return 'Todo';
}

function buildOpsLogReport(detectedPlatform) {
    const state = ensureOpsLogState();
    const entries = state.items.length
        ? state.items.map(
              (item) =>
                  `${formatDateTime(item.createdAt)} · ${item.title}\n${item.summary}`
          )
        : ['Sin eventos registrados hoy.'];

    return [
        `Bitácora Turnero Sala - ${formatDateTime(new Date().toISOString())}`,
        `Perfil actual: ${getInstallPresetLabel(detectedPlatform)}.`,
        '',
        ...entries,
    ].join('\n\n');
}

async function copyOpsLogReport(detectedPlatform) {
    try {
        await navigator.clipboard.writeText(
            buildOpsLogReport(detectedPlatform)
        );
        createToast('Bitácora operativa copiada', 'success');
    } catch (_error) {
        createToast('No se pudo copiar la bitácora operativa', 'error');
    }
}

async function copyShiftHandoffSummary(detectedPlatform) {
    try {
        await navigator.clipboard.writeText(
            buildShiftHandoffSummary(detectedPlatform)
        );
        createToast('Resumen de relevo copiado', 'success');
    } catch (_error) {
        createToast('No se pudo copiar el resumen de relevo', 'error');
    }
}

function buildQueueOpsPilot(manifest, detectedPlatform) {
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const telemetry = [
        getSurfaceTelemetryState('operator'),
        getSurfaceTelemetryState('kiosk'),
        getSurfaceTelemetryState('display'),
    ];
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const issueCount =
        telemetry.filter((entry) => entry.status !== 'ready' || entry.stale)
            .length + (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;

    let tone = 'idle';
    let eyebrow = 'Siguiente paso';
    let title = 'Centro de apertura listo';
    let summary =
        'Sigue la siguiente acción sugerida para terminar la apertura sin revisar cada tarjeta por separado.';
    let primaryAction = null;
    let secondaryAction = null;
    let supportCopy = '';

    if (syncHealth.state === 'alert') {
        tone = 'alert';
        title = 'Resuelve la cola antes de abrir';
        summary =
            'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotRefreshBtn',
            action: 'queue-refresh-state',
            label: 'Refrescar cola ahora',
        };
        secondaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        supportCopy =
            'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.';
    } else if (suggestedCount > 0) {
        tone = 'suggested';
        title = `Confirma ${suggestedCount} paso(s) ya validados`;
        summary =
            pendingAfterSuggestions.length > 0
                ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.';
        primaryAction = {
            kind: 'button',
            id: 'queueOpsPilotApplyBtn',
            label: `Confirmar sugeridos (${suggestedCount})`,
        };
        secondaryAction = pendingAfterSuggestions.length
            ? {
                  kind: 'anchor',
                  href: pendingAfterSuggestions[0].href,
                  label: pendingAfterSuggestions[0].actionLabel,
              }
            : {
                  kind: 'anchor',
                  href: '/admin.html#queue',
                  label: 'Volver a la cola',
              };
        supportCopy =
            'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.';
    } else if (pendingAfterSuggestions.length > 0) {
        tone = syncHealth.state === 'warning' ? 'warning' : 'active';
        title = `Siguiente paso: ${pendingAfterSuggestions[0].title}`;
        summary =
            pendingAfterSuggestions.length > 1
                ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                : 'Solo queda una validación manual para dejar la apertura lista.';
        primaryAction = {
            kind: 'anchor',
            href: pendingAfterSuggestions[0].href,
            label: pendingAfterSuggestions[0].actionLabel,
        };
        secondaryAction =
            syncHealth.state === 'warning'
                ? {
                      kind: 'button',
                      id: 'queueOpsPilotRefreshBtn',
                      action: 'queue-refresh-state',
                      label: 'Refrescar cola',
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Abrir cola admin',
                  };
        supportCopy = String(
            assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                pendingAfterSuggestions[0].hint ||
                ''
        );
    } else {
        tone = 'ready';
        eyebrow = 'Operación lista';
        title = 'Apertura completada';
        summary =
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.';
        primaryAction = {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        };
        secondaryAction = {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        };
        supportCopy =
            'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.';
    }

    return {
        tone,
        eyebrow,
        title,
        summary,
        supportCopy,
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        primaryAction,
        secondaryAction,
    };
}

function renderQueueOpsPilotAction(action, variant = 'secondary') {
    if (!action) {
        return '';
    }

    const className =
        variant === 'primary'
            ? 'queue-ops-pilot__action queue-ops-pilot__action--primary'
            : 'queue-ops-pilot__action';

    if (action.kind === 'button') {
        return `
            <button
                ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
                type="button"
                class="${className}"
                ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            >
                ${escapeHtml(action.label || 'Continuar')}
            </button>
        `;
    }

    return `
        <a
            ${action.id ? `id="${escapeHtml(action.id)}"` : ''}
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            target="_blank"
            rel="noopener"
        >
            ${escapeHtml(action.label || 'Continuar')}
        </a>
    `;
}

function renderQueueOpsPilot(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsPilot');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const pilot = buildQueueOpsPilot(manifest, detectedPlatform);
    setHtml(
        '#queueOpsPilot',
        `
            <section class="queue-ops-pilot__shell" data-state="${escapeHtml(pilot.tone)}">
                <div class="queue-ops-pilot__layout">
                    <div class="queue-ops-pilot__copy">
                        <p class="queue-app-card__eyebrow">${escapeHtml(pilot.eyebrow)}</p>
                        <h5 id="queueOpsPilotTitle" class="queue-app-card__title">${escapeHtml(
                            pilot.title
                        )}</h5>
                        <p id="queueOpsPilotSummary" class="queue-ops-pilot__summary">${escapeHtml(
                            pilot.summary
                        )}</p>
                        <p class="queue-ops-pilot__support">${escapeHtml(
                            pilot.supportCopy
                        )}</p>
                        <div class="queue-ops-pilot__actions">
                            ${renderQueueOpsPilotAction(pilot.primaryAction, 'primary')}
                            ${renderQueueOpsPilotAction(pilot.secondaryAction, 'secondary')}
                        </div>
                    </div>
                    <div class="queue-ops-pilot__status">
                        <div class="queue-ops-pilot__progress">
                            <div class="queue-ops-pilot__progress-head">
                                <span>Apertura confirmada</span>
                                <strong id="queueOpsPilotProgressValue">${escapeHtml(
                                    `${pilot.confirmedCount}/${pilot.totalSteps}`
                                )}</strong>
                            </div>
                            <div class="queue-ops-pilot__bar" aria-hidden="true">
                                <span style="width:${escapeHtml(String(pilot.progressPct))}%"></span>
                            </div>
                        </div>
                        <div class="queue-ops-pilot__chips">
                            <span id="queueOpsPilotChipConfirmed" class="queue-ops-pilot__chip">
                                Confirmados ${escapeHtml(String(pilot.confirmedCount))}
                            </span>
                            <span id="queueOpsPilotChipSuggested" class="queue-ops-pilot__chip">
                                Sugeridos ${escapeHtml(String(pilot.suggestedCount))}
                            </span>
                            <span id="queueOpsPilotChipEquipment" class="queue-ops-pilot__chip">
                                Equipos listos ${escapeHtml(String(pilot.readyEquipmentCount))}/3
                            </span>
                            <span id="queueOpsPilotChipIssues" class="queue-ops-pilot__chip">
                                Incidencias ${escapeHtml(String(pilot.issueCount))}
                            </span>
                        </div>
                    </div>
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queueOpsPilotApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `Se confirmaron pasos de apertura ya validados por telemetría. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }
}

function formatHeartbeatAge(ageSec) {
    const safeAge = Number(ageSec);
    if (!Number.isFinite(safeAge) || safeAge < 0) {
        return 'sin señal';
    }
    if (safeAge < 60) {
        return `${safeAge}s`;
    }
    const minutes = Math.floor(safeAge / 60);
    const seconds = safeAge % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remMinutes = minutes % 60;
        return remMinutes > 0 ? `${hours}h ${remMinutes}m` : `${hours}h`;
    }
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function buildSignalAgeLabel(latest, fallback = 'Sin heartbeat reciente') {
    const ageSec = Number(latest?.ageSec);
    if (!Number.isFinite(ageSec)) {
        return fallback;
    }
    return `Heartbeat hace ${formatHeartbeatAge(ageSec)}`;
}

function formatIntervalAge(intervalMs) {
    const safeInterval = Number(intervalMs);
    if (!Number.isFinite(safeInterval) || safeInterval <= 0) {
        return 'cada --';
    }
    const seconds = Math.max(1, Math.round(safeInterval / 1000));
    if (seconds < 60) {
        return `cada ${seconds}s`;
    }
    const minutes = Math.round(seconds / 60);
    return `cada ${minutes}m`;
}

function getSurfaceTelemetryAutoRefreshState() {
    const runtime = getState().ui?.queueAutoRefresh;
    return runtime && typeof runtime === 'object'
        ? runtime
        : {
              state: 'idle',
              reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
              intervalMs: 45000,
              lastAttemptAt: 0,
              lastSuccessAt: 0,
              lastError: '',
              inFlight: false,
          };
}

function buildSurfaceTelemetryAutoRefreshMeta() {
    const runtime = getSurfaceTelemetryAutoRefreshState();
    const state = String(runtime.state || 'idle')
        .trim()
        .toLowerCase();
    const intervalLabel = formatIntervalAge(runtime.intervalMs);
    const lastSuccessLabel = runtime.lastSuccessAt
        ? `ultimo ciclo hace ${formatHeartbeatAge(
              Math.max(
                  0,
                  Math.round(
                      (Date.now() - Number(runtime.lastSuccessAt || 0)) / 1000
                  )
              )
          )}`
        : 'sin ciclo exitoso todavía';

    if (state === 'refreshing' || Boolean(runtime.inFlight)) {
        return {
            state: 'active',
            label: 'Actualizando ahora',
            meta: `${intervalLabel} · sincronizando equipos en vivo`,
        };
    }

    if (state === 'paused') {
        return {
            state: 'paused',
            label: 'Auto-refresh en pausa',
            meta: String(
                runtime.reason || 'Reanuda esta sección para continuar.'
            ),
        };
    }

    if (state === 'warning') {
        return {
            state: 'warning',
            label: 'Auto-refresh degradado',
            meta: String(
                runtime.reason || `Modo degradado · ${lastSuccessLabel}`
            ),
        };
    }

    if (state === 'active') {
        return {
            state: 'active',
            label: 'Auto-refresh activo',
            meta: `${intervalLabel} · ${lastSuccessLabel}`,
        };
    }

    return {
        state: 'idle',
        label: 'Auto-refresh listo',
        meta: String(
            runtime.reason || 'Abre Turnero Sala para empezar el monitoreo.'
        ),
    };
}

function getQueueSurfaceTelemetry() {
    const telemetry = getState().data.queueSurfaceStatus;
    return telemetry && typeof telemetry === 'object' ? telemetry : {};
}

function getSurfaceTelemetryState(surfaceKey) {
    const telemetry = getQueueSurfaceTelemetry();
    const raw = telemetry[surfaceKey];
    return raw && typeof raw === 'object'
        ? raw
        : {
              surface: surfaceKey,
              status: 'unknown',
              stale: true,
              summary: '',
              latest: null,
              instances: [],
          };
}

function buildSurfaceTelemetryChips(surfaceKey, latest) {
    if (!latest || typeof latest !== 'object') {
        return ['Sin señal'];
    }

    const details =
        latest.details && typeof latest.details === 'object'
            ? latest.details
            : {};
    const chips = [];
    const appMode = String(latest.appMode || '').trim();
    if (appMode === 'desktop') {
        chips.push('Desktop');
    } else if (appMode === 'android_tv') {
        chips.push('Android TV');
    } else {
        chips.push('Web');
    }

    if (surfaceKey === 'operator') {
        const station = String(details.station || '').toUpperCase();
        const stationMode = String(details.stationMode || '');
        const oneTap = Boolean(details.oneTap);
        const numpadSeen = Boolean(details.numpadSeen);
        if (station) {
            chips.push(
                stationMode === 'locked'
                    ? `${station} fijo`
                    : `${station} libre`
            );
        }
        chips.push(oneTap ? '1 tecla ON' : '1 tecla OFF');
        chips.push(numpadSeen ? 'Numpad listo' : 'Numpad pendiente');
    } else if (surfaceKey === 'kiosk') {
        chips.push(details.printerPrinted ? 'Térmica OK' : 'Térmica pendiente');
        chips.push(`Offline ${Number(details.pendingOffline || 0)}`);
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Cola en vivo'
                : 'Cola degradada'
        );
    } else if (surfaceKey === 'display') {
        chips.push(details.bellPrimed ? 'Audio listo' : 'Audio pendiente');
        chips.push(details.bellMuted ? 'Campanilla Off' : 'Campanilla On');
        chips.push(
            String(details.connection || '').toLowerCase() === 'live'
                ? 'Sala en vivo'
                : 'Sala degradada'
        );
    }

    return chips.slice(0, 4);
}

function buildSurfaceTelemetryCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const cards = [
        {
            key: 'operator',
            appConfig: manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
            fallbackSurface: 'operator',
            actionLabel: 'Abrir operador',
        },
        {
            key: 'kiosk',
            appConfig: manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk,
            fallbackSurface: 'kiosk',
            actionLabel: 'Abrir kiosco',
        },
        {
            key: 'display',
            appConfig: manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv,
            fallbackSurface: 'sala_tv',
            actionLabel: 'Abrir sala TV',
        },
    ];

    return cards.map((entry) => {
        const group = getSurfaceTelemetryState(entry.key);
        const latest =
            group.latest && typeof group.latest === 'object'
                ? group.latest
                : null;
        const effectiveState = String(group.status || 'unknown');
        const summary =
            String(group.summary || '').trim() ||
            SURFACE_TELEMETRY_COPY[entry.key]?.emptySummary ||
            'Sin señal todavía.';
        const route = buildPreparedSurfaceUrl(
            entry.fallbackSurface,
            entry.appConfig,
            {
                ...preset,
                surface: entry.fallbackSurface,
            }
        );

        return {
            key: entry.key,
            title: SURFACE_TELEMETRY_COPY[entry.key]?.title || entry.key,
            state:
                effectiveState === 'ready' ||
                effectiveState === 'warning' ||
                effectiveState === 'alert'
                    ? effectiveState
                    : 'unknown',
            badge:
                effectiveState === 'ready'
                    ? 'En vivo'
                    : effectiveState === 'alert'
                      ? 'Atender'
                      : effectiveState === 'warning'
                        ? 'Revisar'
                        : 'Sin señal',
            deviceLabel: String(latest?.deviceLabel || 'Sin equipo reportando'),
            summary,
            ageLabel:
                latest && latest.ageSec !== undefined && latest.ageSec !== null
                    ? `Heartbeat hace ${formatHeartbeatAge(latest.ageSec)}`
                    : 'Sin heartbeat todavía',
            chips: buildSurfaceTelemetryChips(entry.key, latest),
            route,
            actionLabel: entry.actionLabel,
        };
    });
}

function renderSurfaceTelemetry(manifest, detectedPlatform) {
    const root = document.getElementById('queueSurfaceTelemetry');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const cards = buildSurfaceTelemetryCards(manifest, detectedPlatform);
    const autoRefresh = buildSurfaceTelemetryAutoRefreshMeta();
    const hasAlert = cards.some((card) => card.state === 'alert');
    const hasWarning = cards.some(
        (card) => card.state === 'warning' || card.state === 'unknown'
    );
    const title = hasAlert
        ? 'Equipos con atención urgente'
        : hasWarning
          ? 'Equipos con señal parcial'
          : 'Equipos en vivo';
    const summary = hasAlert
        ? 'Al menos un equipo reporta una condición crítica. Atiende primero esa tarjeta antes de tocar instalación o configuración.'
        : hasWarning
          ? 'Hay equipos sin heartbeat reciente o con validación pendiente. Usa estas tarjetas para abrir el equipo correcto sin buscar rutas manualmente.'
          : 'Operador, kiosco y sala están enviando heartbeat al admin. Esta vista ya sirve como tablero operativo por equipo.';
    const statusLabel = hasAlert
        ? 'Atender ahora'
        : hasWarning
          ? 'Revisar hoy'
          : 'Todo al día';
    const statusState = hasAlert ? 'alert' : hasWarning ? 'warning' : 'ready';

    setHtml(
        '#queueSurfaceTelemetry',
        `
            <section class="queue-surface-telemetry__shell">
                <div class="queue-surface-telemetry__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Equipos en vivo</p>
                        <h5 id="queueSurfaceTelemetryTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueSurfaceTelemetrySummary" class="queue-surface-telemetry__summary">${escapeHtml(
                            summary
                        )}</p>
                        <div id="queueSurfaceTelemetryAutoMeta" class="queue-surface-telemetry__auto-meta">
                            <span
                                id="queueSurfaceTelemetryAutoState"
                                class="queue-surface-telemetry__auto-state"
                                data-state="${escapeHtml(autoRefresh.state)}"
                            >
                                ${escapeHtml(autoRefresh.label)}
                            </span>
                            <span class="queue-surface-telemetry__auto-copy">${escapeHtml(
                                autoRefresh.meta
                            )}</span>
                        </div>
                    </div>
                    <span
                        id="queueSurfaceTelemetryStatus"
                        class="queue-surface-telemetry__status"
                        data-state="${escapeHtml(statusState)}"
                    >
                        ${escapeHtml(statusLabel)}
                    </span>
                </div>
                <div id="queueSurfaceTelemetryCards" class="queue-surface-telemetry__grid" role="list" aria-label="Estado vivo por equipo">
                    ${cards
                        .map(
                            (card) => `
                                <article
                                    class="queue-surface-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-surface-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-surface-card__meta">${escapeHtml(
                                                card.deviceLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-surface-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-surface-card__summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    <p class="queue-surface-card__age">${escapeHtml(
                                        card.ageLabel
                                    )}</p>
                                    <div class="queue-surface-card__chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-surface-card__chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-surface-card__actions">
                                        <a
                                            href="${escapeHtml(card.route)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-surface-card__action queue-surface-card__action--primary"
                                        >
                                            ${escapeHtml(card.actionLabel)}
                                        </a>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="queue-copy-install-link"
                                            data-queue-install-url="${escapeHtml(card.route)}"
                                        >
                                            Copiar ruta
                                        </button>
                                        <button
                                            type="button"
                                            class="queue-surface-card__action"
                                            data-action="refresh-admin-data"
                                        >
                                            Actualizar estado
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );
}

function getQueueSyncHealth() {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const syncMode = String(state.queue?.syncMode || 'live')
        .trim()
        .toLowerCase();
    const fallbackPartial = Boolean(state.queue?.fallbackPartial);
    const updatedAt = String(queueMeta?.updatedAt || '').trim();
    const updatedAtMs = updatedAt ? Date.parse(updatedAt) : NaN;
    const ageSec = Number.isFinite(updatedAtMs)
        ? Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
        : null;

    if (syncMode === 'fallback' || fallbackPartial) {
        return {
            state: 'alert',
            badge: 'Atender ahora',
            title: 'Cola en fallback',
            summary:
                'El admin ya está usando respaldo parcial. Refresca la cola y mantén Operador, Kiosco y Sala TV en sus rutas web preparadas hasta que vuelva el realtime.',
            steps: [
                'Presiona Refrescar y confirma que el sync vuelva a vivo antes de cerrar la apertura.',
                'Mantén un solo operador activo por estación para evitar confusión mientras dura el respaldo.',
                'Si la TV sigue mostrando llamados, no la cierres; prioriza estabilidad sobre reinstalar.',
            ],
        };
    }

    if (Number.isFinite(ageSec) && ageSec >= 60) {
        return {
            state: 'warning',
            badge: `Watchdog ${ageSec}s`,
            title: 'Realtime lento o en reconexión',
            summary:
                'La cola no parece caída, pero el watchdog ya detecta retraso. Conviene refrescar desde admin antes de que el equipo operador se quede desfasado.',
            steps: [
                'Refresca la cola y confirma que Sync vuelva a "vivo".',
                'Si Operador ya estaba abierto, valida un llamado de prueba antes de seguir atendiendo.',
                'Si el retraso persiste, opera desde las rutas web preparadas mientras revisas red local.',
            ],
        };
    }

    return {
        state: 'ready',
        badge: 'Sin incidentes',
        title: 'Cola sincronizada',
        summary:
            'No hay incidentes visibles de realtime. Usa esta sección como ruta rápida si falla numpad, térmica o audio durante el día.',
        steps: [
            'Mantén este panel abierto como tablero de rescate para operador, kiosco y sala.',
            'Si notas un retraso mayor a un minuto, refresca antes de tocar instalación o hardware.',
            'En una caída puntual, prioriza abrir la ruta preparada del equipo antes de reiniciar dispositivos.',
        ],
    };
}

function buildQueueSyncAlert() {
    const syncHealth = getQueueSyncHealth();
    if (syncHealth.state === 'ready') {
        return null;
    }

    const { queueMeta } = getQueueSource();
    const updatedAtMs = Date.parse(String(queueMeta?.updatedAt || ''));
    const ageLabel = Number.isFinite(updatedAtMs)
        ? `Ultima cola actualizada hace ${formatHeartbeatAge(
              Math.max(0, Math.round((Date.now() - updatedAtMs) / 1000))
          )}`
        : 'Sin marca reciente de cola';

    return {
        id: `queue_sync_${syncHealth.state}`,
        scope: 'Cola admin',
        tone: syncHealth.state === 'alert' ? 'alert' : 'warning',
        title:
            syncHealth.state === 'alert'
                ? 'Realtime degradado o en fallback'
                : 'Realtime lento o en reconexión',
        summary: syncHealth.summary,
        meta: ageLabel,
        href: '/admin.html#queue',
        actionLabel: 'Abrir cola admin',
    };
}

function buildOperatorAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const expectedStation = preset.station === 'c2' ? 'c2' : 'c1';
    const appConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const route = buildPreparedSurfaceUrl('operator', appConfig, {
        ...preset,
        surface: 'operator',
    });
    const { group, latest, details } = getLatestSurfaceDetails('operator');
    const station = String(details.station || '')
        .trim()
        .toLowerCase();
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'operator_signal',
            scope: 'Operador',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Operador sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'Todavía no hay heartbeat suficiente del equipo operador para confiar en el llamado diario.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir operador',
        };
    }

    if (preset.lock && station && station !== expectedStation) {
        return {
            id: 'operator_station_mismatch',
            scope: 'Operador',
            tone: 'alert',
            title: `Operador en ${station.toUpperCase()} y perfil activo en ${expectedStation.toUpperCase()}`,
            summary:
                'La estación reportada no coincide con el preset bloqueado. Corrige el perfil o reabre el operador antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir operador',
        };
    }

    if (!details.numpadSeen) {
        return {
            id: 'operator_numpad_pending',
            scope: 'Operador',
            tone: 'warning',
            title: 'Genius Numpad 1000 sin pulsación reciente',
            summary:
                'Falta una tecla real del numpad para cerrar la validación operativa. Si usas 1 tecla, este chequeo conviene resolverlo primero.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Validar numpad',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'operator_connection',
            scope: 'Operador',
            tone: 'warning',
            title: 'Operador fuera de cola viva',
            summary:
                'El operador sigue arriba, pero no está reportando conexión viva con la cola. Mantén el fallback preparado antes de seguir atendiendo.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar operador',
        };
    }

    return null;
}

function buildKioskAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const route = buildPreparedSurfaceUrl('kiosk', appConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const { group, latest, details } = getLatestSurfaceDetails('kiosk');
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const pendingOffline = Math.max(0, Number(details.pendingOffline || 0));
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'kiosk_signal',
            scope: 'Kiosco',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Kiosco sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'No hay heartbeat reciente del kiosco. Conviene abrir la superficie antes de dejar autoservicio abierto.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir kiosco',
        };
    }

    if (!details.printerPrinted) {
        return {
            id: 'kiosk_printer_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Térmica pendiente en kiosco',
            summary:
                'Todavía no hay impresión OK reportada. Genera un ticket real o de prueba antes de depender del kiosco.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar kiosco',
        };
    }

    if (pendingOffline > 0) {
        return {
            id: 'kiosk_offline_pending',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco con pendientes offline',
            summary: `El kiosco mantiene ${pendingOffline} registro(s) sin sincronizar. Resuélvelo antes de dejar el equipo solo por mucho tiempo.`,
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'kiosk_connection',
            scope: 'Kiosco',
            tone: 'warning',
            title: 'Kiosco sin cola viva',
            summary:
                'El kiosco está arriba, pero la cola no figura como viva. Mantén una ruta web preparada antes de seguir recibiendo pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar kiosco',
        };
    }

    return null;
}

function buildDisplayAlert(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const appConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const route = buildPreparedSurfaceUrl('sala_tv', appConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const { group, latest, details } = getLatestSurfaceDetails('display');
    const connection = String(details.connection || 'live')
        .trim()
        .toLowerCase();
    const ageLabel = buildSignalAgeLabel(latest);

    if (!latest || group.stale || String(group.status || '') === 'unknown') {
        return {
            id: 'display_signal',
            scope: 'Sala TV',
            tone: String(group.status || '') === 'alert' ? 'alert' : 'warning',
            title: 'Sala TV sin señal reciente',
            summary:
                String(group.summary || '').trim() ||
                'La TV no está enviando heartbeat reciente. Conviene abrir la app o el fallback antes del siguiente llamado.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Abrir sala TV',
        };
    }

    if (details.bellMuted) {
        return {
            id: 'display_bell_muted',
            scope: 'Sala TV',
            tone: 'alert',
            title: 'Campanilla o volumen apagados en Sala TV',
            summary:
                'La TV reporta mute o campanilla desactivada. El llamado visual puede salir, pero perderás confirmación sonora para pacientes.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Corregir audio',
        };
    }

    if (!details.bellPrimed) {
        return {
            id: 'display_bell_pending',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV sin prueba de campanilla',
            summary:
                'Falta ejecutar la prueba de audio o campanilla en la TCL C655. Hazlo antes del siguiente llamado real.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Probar sala TV',
        };
    }

    if (connection !== 'live') {
        return {
            id: 'display_connection',
            scope: 'Sala TV',
            tone: 'warning',
            title: 'Sala TV fuera de cola viva',
            summary:
                'La pantalla sigue abierta, pero no está marcando conexión viva. Conviene revisar la app o la red antes de depender de la TV.',
            meta: ageLabel,
            href: route,
            actionLabel: 'Revisar sala TV',
        };
    }

    return null;
}

function buildQueueOpsAlerts(manifest, detectedPlatform) {
    const reviewState = ensureOpsAlertsState();
    const alerts = [
        buildQueueSyncAlert(),
        buildOperatorAlert(manifest, detectedPlatform),
        buildKioskAlert(manifest, detectedPlatform),
        buildDisplayAlert(manifest, detectedPlatform),
    ]
        .filter(Boolean)
        .map((alert) => {
            const reviewedMeta = reviewState.reviewed[String(alert.id)] || null;
            return {
                ...alert,
                reviewed: Boolean(reviewedMeta),
                reviewedAt: reviewedMeta?.reviewedAt || '',
            };
        });

    const criticalCount = alerts.filter(
        (alert) => alert.tone === 'alert'
    ).length;
    const reviewedCount = alerts.filter((alert) => alert.reviewed).length;
    const pendingCount = alerts.length - reviewedCount;
    const tone =
        criticalCount > 0 ? 'alert' : alerts.length > 0 ? 'warning' : 'ready';
    const title =
        alerts.length === 0
            ? 'Sin alertas activas'
            : criticalCount > 0
              ? 'Alertas activas del turno'
              : 'Observaciones activas del turno';
    const summary =
        alerts.length === 0
            ? 'La cola, Operador, Kiosco y Sala TV no muestran incidencias abiertas ahora mismo.'
            : criticalCount > 0
              ? `${criticalCount} alerta(s) crítica(s) y ${Math.max(0, alerts.length - criticalCount)} observación(es) activas. Marca una alerta como revisada cuando ya alguien la atendió, pero seguirá visible hasta resolverse.`
              : `${alerts.length} observación(es) activas. Usa este panel para decidir qué equipo abrir primero sin bajar por toda la pantalla.`;

    return {
        tone,
        title,
        summary,
        alerts,
        criticalCount,
        reviewedCount,
        pendingCount,
    };
}

function renderQueueOpsAlerts(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsAlerts');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const alertState = buildQueueOpsAlerts(manifest, detectedPlatform);
    setHtml(
        '#queueOpsAlerts',
        `
            <section class="queue-ops-alerts__shell" data-state="${escapeHtml(alertState.tone)}">
                <div class="queue-ops-alerts__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Prioridad viva</p>
                        <h5 id="queueOpsAlertsTitle" class="queue-app-card__title">${escapeHtml(
                            alertState.title
                        )}</h5>
                        <p id="queueOpsAlertsSummary" class="queue-ops-alerts__summary">${escapeHtml(
                            alertState.summary
                        )}</p>
                    </div>
                    <div class="queue-ops-alerts__meta">
                        <span id="queueOpsAlertsChipTotal" class="queue-ops-alerts__chip">
                            Alertas ${escapeHtml(String(alertState.alerts.length))}
                        </span>
                        <span id="queueOpsAlertsChipPending" class="queue-ops-alerts__chip">
                            Pendientes ${escapeHtml(String(alertState.pendingCount))}
                        </span>
                        <span id="queueOpsAlertsChipReviewed" class="queue-ops-alerts__chip" data-state="${escapeHtml(
                            alertState.reviewedCount > 0 ? 'reviewed' : 'idle'
                        )}">
                            Revisadas ${escapeHtml(String(alertState.reviewedCount))}
                        </span>
                        <button
                            id="queueOpsAlertsApplyBtn"
                            type="button"
                            class="queue-ops-alerts__action queue-ops-alerts__action--primary"
                            ${alertState.pendingCount > 0 ? '' : 'disabled'}
                        >
                            Marcar visibles revisadas
                        </button>
                    </div>
                </div>
                <div id="queueOpsAlertsItems" class="queue-ops-alerts__list" role="list" aria-label="Alertas activas por equipo">
                    ${
                        alertState.alerts.length > 0
                            ? alertState.alerts
                                  .map(
                                      (alert) => `
                                        <article
                                            id="queueOpsAlert_${escapeHtml(alert.id)}"
                                            class="queue-ops-alerts__item"
                                            data-state="${escapeHtml(alert.tone)}"
                                            data-reviewed="${alert.reviewed ? 'true' : 'false'}"
                                            role="listitem"
                                        >
                                            <div class="queue-ops-alerts__item-head">
                                                <div class="queue-ops-alerts__item-copy">
                                                    <span class="queue-ops-alerts__scope">${escapeHtml(
                                                        alert.scope
                                                    )}</span>
                                                    <strong>${escapeHtml(alert.title)}</strong>
                                                </div>
                                                <div class="queue-ops-alerts__item-meta">
                                                    <span class="queue-ops-alerts__severity">${escapeHtml(
                                                        alert.tone === 'alert'
                                                            ? 'Critica'
                                                            : 'Revisar'
                                                    )}</span>
                                                    ${
                                                        alert.reviewed
                                                            ? `<span class="queue-ops-alerts__reviewed">Revisada ${escapeHtml(
                                                                  formatDateTime(
                                                                      alert.reviewedAt
                                                                  )
                                                              )}</span>`
                                                            : ''
                                                    }
                                                </div>
                                            </div>
                                            <p class="queue-ops-alerts__item-summary">${escapeHtml(
                                                alert.summary
                                            )}</p>
                                            <p class="queue-ops-alerts__item-note">${escapeHtml(
                                                alert.meta
                                            )}</p>
                                            <div class="queue-ops-alerts__actions">
                                                <a
                                                    href="${escapeHtml(alert.href)}"
                                                    class="queue-ops-alerts__action queue-ops-alerts__action--primary"
                                                    target="_blank"
                                                    rel="noopener"
                                                >
                                                    ${escapeHtml(alert.actionLabel)}
                                                </a>
                                                <button
                                                    id="queueOpsAlertReview_${escapeHtml(alert.id)}"
                                                    type="button"
                                                    class="queue-ops-alerts__action"
                                                    data-queue-alert-review="${escapeHtml(alert.id)}"
                                                    data-review-state="${alert.reviewed ? 'clear' : 'review'}"
                                                >
                                                    ${escapeHtml(
                                                        alert.reviewed
                                                            ? 'Marcar pendiente otra vez'
                                                            : 'Marcar revisada'
                                                    )}
                                                </button>
                                            </div>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article class="queue-ops-alerts__empty" role="listitem">
                                    <strong>Sin prioridades abiertas</strong>
                                    <p>La telemetría actual no muestra incidentes ni observaciones activas en cola, operador, kiosco o sala.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queueOpsAlertsApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            const pendingIds = alertState.alerts
                .filter((alert) => !alert.reviewed)
                .map((alert) => alert.id);
            if (!pendingIds.length) {
                return;
            }
            markOpsAlertsReviewed(pendingIds);
            appendOpsLogEntry({
                tone: alertState.criticalCount > 0 ? 'warning' : 'info',
                source: 'incident',
                title: `Alertas revisadas: ${pendingIds.length}`,
                summary: `Se marcaron como revisadas las alertas visibles del turno. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueOpsAlerts(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-alert-review]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const alertId = String(
                button.dataset.queueAlertReview || ''
            ).trim();
            const targetAlert = alertState.alerts.find(
                (alert) => alert.id === alertId
            );
            if (!targetAlert) {
                return;
            }
            const shouldReview = button.dataset.reviewState !== 'clear';
            setOpsAlertReviewed(alertId, shouldReview);
            appendOpsLogEntry({
                tone: shouldReview ? 'info' : 'warning',
                source: 'incident',
                title: `${shouldReview ? 'Alerta revisada' : 'Alerta reabierta'}: ${targetAlert.scope}`,
                summary: shouldReview
                    ? `${targetAlert.title}. Sigue visible hasta que la condición se resuelva.`
                    : `${targetAlert.title}. La alerta vuelve al tablero pendiente del turno.`,
            });
            renderQueueOpsAlerts(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    });
}

function buildQueueFocusMode(manifest, detectedPlatform) {
    const selectedMode = ensureOpsFocusMode();
    const manifestReady = Boolean(manifest && typeof manifest === 'object');
    const syncHealth = getQueueSyncHealth();
    const openingPending =
        OPENING_CHECKLIST_STEP_IDS.length -
        OPENING_CHECKLIST_STEP_IDS.filter(
            (stepId) => ensureOpeningChecklistState().steps[stepId]
        ).length;
    const closingPending =
        SHIFT_HANDOFF_STEP_IDS.length -
        SHIFT_HANDOFF_STEP_IDS.filter(
            (stepId) => ensureShiftHandoffState().steps[stepId]
        ).length;
    const operator = getSurfaceTelemetryState('operator');
    const kiosk = getSurfaceTelemetryState('kiosk');
    const display = getSurfaceTelemetryState('display');
    const hasAlert =
        syncHealth.state === 'alert' ||
        [operator, kiosk, display].some(
            (entry) => String(entry.status || '').toLowerCase() === 'alert'
        );
    const queueClear = Boolean(
        buildShiftHandoffAssist(detectedPlatform).suggestions.queue_clear
            ?.suggested
    );
    const suggestedMode = hasAlert
        ? 'incidents'
        : openingPending > 0
          ? 'opening'
          : queueClear && closingPending > 0
            ? 'closing'
            : 'operations';
    const effectiveMode =
        selectedMode === 'auto' ? suggestedMode : selectedMode;

    if (effectiveMode === 'opening') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Apertura',
            summary:
                openingPending > 0
                    ? `Quedan ${openingPending} validaciones de apertura. Mantén visibles Operador, Telemetría y el checklist hasta dejar lista la mañana.`
                    : 'La apertura ya está confirmada, pero puedes revisar el checklist o ajustar la instalación del equipo.',
            primaryHref: '#queueOpeningChecklist',
            primaryLabel: 'Ir a apertura diaria',
        };
    }

    if (effectiveMode === 'incidents') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Incidencias',
            summary:
                syncHealth.state === 'alert'
                    ? 'La cola está degradada o en fallback. En este modo se priorizan contingencias, equipos vivos y señales críticas.'
                    : 'Mantén a la vista contingencias y equipos con señal parcial para resolver la incidencia sin distraerte con instalación o cierre.',
            primaryHref: '#queueContingencyDeck',
            primaryLabel: 'Ir a contingencias',
        };
    }

    if (effectiveMode === 'closing') {
        return {
            selectedMode,
            suggestedMode,
            effectiveMode,
            title: 'Modo foco: Cierre',
            summary:
                closingPending > 0
                    ? `La cola ya permite relevo y faltan ${closingPending} paso(s) para cerrar el turno con evidencia clara.`
                    : 'El relevo ya quedó completo; usa este foco si necesitas revisar la salida del día o copiar el resumen final.',
            primaryHref: '#queueShiftHandoff',
            primaryLabel: 'Ir a cierre y relevo',
        };
    }

    return {
        selectedMode,
        suggestedMode,
        effectiveMode: 'operations',
        title: 'Modo foco: Operación',
        summary: manifestReady
            ? 'Mantén visibles equipos en vivo, bitácora y contingencias para operar durante el día sin mezclar apertura o cierre.'
            : 'Mantén visibles equipos y bitácora mientras el hub termina de cargar el catálogo operativo.',
        primaryHref: '#queueSurfaceTelemetry',
        primaryLabel: 'Ir a equipos en vivo',
    };
}

function renderQueueFocusMode(manifest, detectedPlatform) {
    const root = document.getElementById('queueFocusMode');
    const hub = document.getElementById('queueAppsHub');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    if (hub instanceof HTMLElement) {
        hub.dataset.queueFocus = focus.effectiveMode;
        hub.dataset.queueFocusSource =
            focus.selectedMode === 'auto' ? 'auto' : 'manual';
    }

    setHtml(
        '#queueFocusMode',
        `
            <section class="queue-focus-mode__shell">
                <div class="queue-focus-mode__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Modo foco</p>
                        <h5 id="queueFocusModeTitle" class="queue-app-card__title">${escapeHtml(
                            focus.title
                        )}</h5>
                        <p id="queueFocusModeSummary" class="queue-focus-mode__summary">${escapeHtml(
                            focus.summary
                        )}</p>
                    </div>
                    <div class="queue-focus-mode__meta">
                        <span
                            id="queueFocusModeChip"
                            class="queue-focus-mode__chip"
                            data-state="${escapeHtml(
                                focus.selectedMode === 'auto'
                                    ? 'auto'
                                    : 'manual'
                            )}"
                        >
                            ${escapeHtml(
                                focus.selectedMode === 'auto'
                                    ? `Auto -> ${focus.suggestedMode}`
                                    : `Manual -> ${focus.effectiveMode}`
                            )}
                        </span>
                        <a
                            id="queueFocusModePrimary"
                            href="${escapeHtml(focus.primaryHref)}"
                            class="queue-focus-mode__primary"
                        >
                            ${escapeHtml(focus.primaryLabel)}
                        </a>
                    </div>
                </div>
                <div class="queue-focus-mode__choices" role="tablist" aria-label="Cambiar foco del hub operativo">
                    <button id="queueFocusModeAuto" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="auto" data-state="${focus.selectedMode === 'auto' ? 'active' : 'idle'}">Auto</button>
                    <button id="queueFocusModeOpening" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="opening" data-state="${focus.selectedMode === 'opening' ? 'active' : 'idle'}">Apertura</button>
                    <button id="queueFocusModeOperations" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="operations" data-state="${focus.selectedMode === 'operations' ? 'active' : 'idle'}">Operación</button>
                    <button id="queueFocusModeIncidents" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="incidents" data-state="${focus.selectedMode === 'incidents' ? 'active' : 'idle'}">Incidencias</button>
                    <button id="queueFocusModeClosing" type="button" class="queue-focus-mode__choice" data-queue-focus-mode="closing" data-state="${focus.selectedMode === 'closing' ? 'active' : 'idle'}">Cierre</button>
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-focus-mode]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistOpsFocusMode(button.dataset.queueFocusMode || 'auto');
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
        };
    });
}

function formatNumpadBindingLabel(binding) {
    if (!binding || typeof binding !== 'object') {
        return 'Enter integrado';
    }
    const rawCode = String(
        binding.code || binding.key || 'tecla externa'
    ).trim();
    return rawCode ? `Externa ${rawCode}` : 'Tecla externa';
}

function getQueuePendingActionCopy(pendingAction, fallbackTicket) {
    const pending =
        pendingAction && typeof pendingAction === 'object'
            ? pendingAction
            : null;
    if (!pending) {
        return '';
    }
    const action = String(pending.action || '')
        .trim()
        .toLowerCase();
    const consultorio = Number(pending.consultorio || 0) === 2 ? 'C2' : 'C1';
    const ticket =
        getQueueTicketById(pending.ticketId) || fallbackTicket || null;
    const ticketCode = ticket?.ticketCode
        ? String(ticket.ticketCode)
        : 'ticket activo';

    if (action === 'completar') {
        return `completar ${ticketCode} en ${consultorio}`;
    }
    if (action === 'no_show') {
        return `marcar no show ${ticketCode} en ${consultorio}`;
    }
    if (action === 'cancelar') {
        return `cancelar ${ticketCode} en ${consultorio}`;
    }
    if (action === 'liberar') {
        return `liberar ${ticketCode} en ${consultorio}`;
    }
    return `${action || 'confirmar acción'} ${ticketCode} en ${consultorio}`;
}

function hideSensitiveDialogVisualOnly() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
        dialog.close();
    }
    if (dialog instanceof HTMLElement) {
        dialog.removeAttribute('open');
        dialog.hidden = true;
    }
}

function buildQueueNumpadGuideKeyCards(state, activeTicket, nextTicket) {
    const station = Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLabel = `C${station}`;
    const pendingAction = state.queue.pendingSensitiveAction;
    const pendingCopy = getQueuePendingActionCopy(pendingAction, activeTicket);

    const enterDetail = pendingCopy
        ? `Confirma ${pendingCopy}.`
        : state.queue.oneTap && activeTicket && nextTicket
          ? `Completa ${activeTicket.ticketCode} y llama ${nextTicket.ticketCode} en ${stationLabel}.`
          : state.queue.oneTap && activeTicket
            ? `Completa ${activeTicket.ticketCode}; después no queda ticket en espera para ${stationLabel}.`
            : nextTicket
              ? `Llama ${nextTicket.ticketCode} en ${stationLabel}.`
              : `Sin ticket en espera para ${stationLabel}.`;

    return [
        {
            id: 'enter',
            keyLabel: 'Enter',
            detail: enterDetail,
            state: pendingCopy
                ? 'alert'
                : nextTicket || activeTicket
                  ? 'ready'
                  : 'idle',
        },
        {
            id: 'decimal',
            keyLabel: '.',
            detail: activeTicket
                ? `Prepara completar ${activeTicket.ticketCode}.`
                : `Sin ticket llamado en ${stationLabel}.`,
            state: activeTicket ? 'ready' : 'idle',
        },
        {
            id: 'subtract',
            keyLabel: '-',
            detail: activeTicket
                ? `Prepara no show para ${activeTicket.ticketCode}.`
                : `Sin ticket llamado en ${stationLabel}.`,
            state: activeTicket ? 'ready' : 'idle',
        },
        {
            id: 'add',
            keyLabel: '+',
            detail: activeTicket
                ? `Re-llama ${activeTicket.ticketCode} sin cambiar estación.`
                : `Sin ticket llamado en ${stationLabel}.`,
            state: activeTicket ? 'ready' : 'idle',
        },
        {
            id: 'station',
            keyLabel: '1 / 2',
            detail:
                state.queue.stationMode === 'locked'
                    ? `Bloqueado en ${stationLabel}; 1/2 no cambian estación ahora.`
                    : `1/2 cambian la estación activa antes del siguiente llamado.`,
            state: state.queue.stationMode === 'locked' ? 'warning' : 'ready',
        },
    ];
}

function buildQueueNumpadGuide(manifest, detectedPlatform) {
    const state = getState();
    const station = Number(state.queue.stationConsultorio || 1) === 2 ? 2 : 1;
    const stationLabel = `C${station}`;
    const adminModeLabel =
        state.queue.stationMode === 'locked' ? 'fijo' : 'libre';
    const activeTicket = getActiveCalledTicketForStation();
    const nextTicket = getWaitingForConsultorio(station);
    const pendingAction = state.queue.pendingSensitiveAction;
    const pendingCopy = getQueuePendingActionCopy(pendingAction, activeTicket);
    const bindingLabel = formatNumpadBindingLabel(state.queue.customCallKey);
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(operator.details.station || '')
        .trim()
        .toUpperCase();
    const operatorModeLabel =
        String(operator.details.stationMode || '')
            .trim()
            .toLowerCase() === 'locked'
            ? 'fijo'
            : 'libre';
    const operatorProfileLabel = operatorStation
        ? `${operatorStation} ${operatorModeLabel}`
        : 'sin señal';
    const operatorMismatch =
        operatorStation &&
        (operatorStation !== stationLabel ||
            (String(operator.details.stationMode || '')
                .trim()
                .toLowerCase() ===
                'locked') !==
                (state.queue.stationMode === 'locked'));
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorUrl = buildPreparedSurfaceUrl(
        'operator',
        manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
        {
            ...preset,
            surface: 'operator',
            station: station === 2 ? 'c2' : 'c1',
            lock: state.queue.stationMode === 'locked',
            oneTap: Boolean(state.queue.oneTap),
        }
    );

    let tone = 'ready';
    let summary = `Admin en ${stationLabel} ${adminModeLabel}.`;
    let supportCopy =
        'Usa este bloque para saber qué hará el siguiente toque del Genius Numpad 1000 antes de pulsarlo.';

    if (state.queue.captureCallKeyMode) {
        tone = 'warning';
        summary =
            'Calibración activa: la próxima tecla externa quedará ligada al llamado del operador.';
        supportCopy =
            'Pulsa ahora la tecla del Genius Numpad 1000 que quieras mapear y evita tocar Enter hasta cerrar la calibración.';
    } else if (pendingCopy) {
        tone = 'alert';
        summary = `Enter confirmará ${pendingCopy}.`;
        supportCopy =
            'La acción sensible ya quedó preparada. Enter confirma y Escape cancela antes de seguir llamando.';
    } else if (operatorMismatch) {
        tone = 'warning';
        summary = `Admin en ${stationLabel} ${adminModeLabel}, pero Operador reporta ${operatorProfileLabel}.`;
        supportCopy =
            'Alinea la estación o el lock antes de llamar desde el numpad para evitar operar sobre el consultorio equivocado.';
    } else if (state.queue.oneTap && activeTicket && nextTicket) {
        tone = 'active';
        summary = `Enter completará ${activeTicket.ticketCode} y llamará ${nextTicket.ticketCode} en ${stationLabel}.`;
        supportCopy =
            'Con 1 tecla activo, una sola pulsación de Enter cierra el ticket actual y avanza la cola del mismo consultorio.';
    } else if (state.queue.oneTap && activeTicket) {
        tone = 'active';
        summary = `Enter completará ${activeTicket.ticketCode}; después no quedará siguiente ticket en espera.`;
        supportCopy =
            '1 tecla sigue activa, pero no hay otro paciente listo para llamar en esta estación.';
    } else if (nextTicket) {
        tone = 'ready';
        summary = `Enter llamará ${nextTicket.ticketCode} en ${stationLabel}.`;
        supportCopy =
            'Usa Decimal o Subtract solo si ya hay un ticket activo en la estación y necesitas una acción sensible.';
    } else {
        summary = `No hay ticket en espera para ${stationLabel}.`;
        supportCopy =
            'El numpad sigue listo, pero ahora mismo Enter no avanzará la cola hasta que llegue otro ticket.';
    }

    return {
        tone,
        title: 'Numpad en vivo',
        summary,
        supportCopy,
        chips: [
            { id: 'station', label: `Admin ${stationLabel} ${adminModeLabel}` },
            { id: 'operator', label: `Operador ${operatorProfileLabel}` },
            {
                id: 'one_tap',
                label: `1 tecla ${state.queue.oneTap ? 'ON' : 'OFF'}`,
            },
            { id: 'binding', label: bindingLabel },
        ],
        actions: {
            operatorUrl,
            oneTapLabel: state.queue.oneTap
                ? 'Desactivar 1 tecla'
                : 'Activar 1 tecla',
        },
        keyCards: buildQueueNumpadGuideKeyCards(
            state,
            activeTicket,
            nextTicket
        ),
    };
}

function renderQueueNumpadGuide(manifest, detectedPlatform) {
    const root = document.getElementById('queueNumpadGuide');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const guide = buildQueueNumpadGuide(manifest, detectedPlatform);
    setHtml(
        '#queueNumpadGuide',
        `
            <section class="queue-numpad-guide__shell" data-state="${escapeHtml(guide.tone)}">
                <div class="queue-numpad-guide__header">
                    <div class="queue-numpad-guide__copy">
                        <p class="queue-app-card__eyebrow">Genius Numpad 1000</p>
                        <h5 id="queueNumpadGuideTitle" class="queue-app-card__title">${escapeHtml(
                            guide.title
                        )}</h5>
                        <p id="queueNumpadGuideSummary" class="queue-numpad-guide__summary">${escapeHtml(
                            guide.summary
                        )}</p>
                        <p class="queue-numpad-guide__support">${escapeHtml(
                            guide.supportCopy
                        )}</p>
                    </div>
                    <div class="queue-numpad-guide__meta">
                        <span id="queueNumpadGuideChipStation" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[0].label)}
                        </span>
                        <span id="queueNumpadGuideChipOperator" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[1].label)}
                        </span>
                        <span id="queueNumpadGuideChipOneTap" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[2].label)}
                        </span>
                        <span id="queueNumpadGuideChipBinding" class="queue-numpad-guide__chip">
                            ${escapeHtml(guide.chips[3].label)}
                        </span>
                    </div>
                </div>
                <div id="queueNumpadGuideActions" class="queue-numpad-guide__actions">
                    <button
                        id="queueNumpadGuideToggleOneTap"
                        type="button"
                        class="queue-numpad-guide__action queue-numpad-guide__action--primary"
                    >
                        ${escapeHtml(guide.actions.oneTapLabel)}
                    </button>
                    <button
                        id="queueNumpadGuideCaptureKey"
                        type="button"
                        class="queue-numpad-guide__action"
                    >
                        Calibrar tecla externa
                    </button>
                    <a
                        id="queueNumpadGuideOpenOperator"
                        href="${escapeHtml(guide.actions.operatorUrl)}"
                        class="queue-numpad-guide__action"
                        target="_blank"
                        rel="noopener"
                    >
                        Abrir operador
                    </a>
                </div>
                <div id="queueNumpadGuideKeys" class="queue-numpad-guide__keys" role="list" aria-label="Acciones vivas del numpad">
                    ${guide.keyCards
                        .map(
                            (card) => `
                                <article
                                    id="queueNumpadGuideKey_${escapeHtml(card.id)}"
                                    class="queue-numpad-guide__key"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <strong>${escapeHtml(card.keyLabel)}</strong>
                                    <p>${escapeHtml(card.detail)}</p>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const toggleOneTapButton = document.getElementById(
        'queueNumpadGuideToggleOneTap'
    );
    if (toggleOneTapButton instanceof HTMLButtonElement) {
        toggleOneTapButton.onclick = () => {
            const stationToggle = document.querySelector(
                '#queueStationControl [data-action="queue-toggle-one-tap"]'
            );
            if (stationToggle instanceof HTMLButtonElement) {
                stationToggle.click();
            }
        };
    }

    const captureKeyButton = document.getElementById(
        'queueNumpadGuideCaptureKey'
    );
    if (captureKeyButton instanceof HTMLButtonElement) {
        captureKeyButton.onclick = () => {
            const stationCapture = document.querySelector(
                '#queueStationControl [data-action="queue-capture-call-key"]'
            );
            if (stationCapture instanceof HTMLButtonElement) {
                stationCapture.click();
            }
        };
    }
}

function formatQueueTicketAgeLabel(ticket, mode) {
    const timestampMs = getQueueTicketTimestampMs(ticket, mode);
    if (!Number.isFinite(timestampMs)) {
        return mode === 'called'
            ? 'sin marca de llamado'
            : 'sin marca de espera';
    }

    const ageSec = Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
    return mode === 'called'
        ? `llamado hace ${formatHeartbeatAge(ageSec)}`
        : `espera hace ${formatHeartbeatAge(ageSec)}`;
}

function getQueueTicketAgeSec(ticket, mode = 'waiting') {
    const timestampMs = getQueueTicketTimestampMs(ticket, mode);
    if (!Number.isFinite(timestampMs)) {
        return null;
    }
    return Math.max(0, Math.round((Date.now() - timestampMs) / 1000));
}

function getQueueTicketTimestampMs(ticket, mode = 'waiting') {
    const rawTimestamp =
        mode === 'called' ? ticket?.calledAt : ticket?.createdAt;
    return Date.parse(String(rawTimestamp || ''));
}

function getSortedWaitingTickets() {
    return getQueueSource()
        .queueTickets.filter((ticket) => ticket.status === 'waiting')
        .sort((left, right) => {
            const leftMs = getQueueTicketTimestampMs(left, 'waiting');
            const rightMs = getQueueTicketTimestampMs(right, 'waiting');
            if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
                return leftMs - rightMs;
            }
            if (Number.isFinite(leftMs)) {
                return -1;
            }
            if (Number.isFinite(rightMs)) {
                return 1;
            }
            return Number(left.id || 0) - Number(right.id || 0);
        });
}

function getSortedWaitingTicketsFromList(tickets) {
    return (Array.isArray(tickets) ? tickets : [])
        .filter(
            (ticket) =>
                String(ticket?.status || '')
                    .trim()
                    .toLowerCase() === 'waiting'
        )
        .sort((left, right) => {
            const leftMs = getQueueTicketTimestampMs(left, 'waiting');
            const rightMs = getQueueTicketTimestampMs(right, 'waiting');
            if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
                return leftMs - rightMs;
            }
            if (Number.isFinite(leftMs)) {
                return -1;
            }
            if (Number.isFinite(rightMs)) {
                return 1;
            }
            return Number(left?.id || 0) - Number(right?.id || 0);
        });
}

function getUnassignedWaitingTickets() {
    return getSortedWaitingTickets().filter(
        (ticket) => !Number(ticket.assignedConsultorio || 0)
    );
}

function getAssignedWaitingTickets(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return getSortedWaitingTickets().filter(
        (ticket) => Number(ticket.assignedConsultorio || 0) === target
    );
}

function getUnassignedWaitingTicketsFromList(tickets) {
    return getSortedWaitingTicketsFromList(tickets).filter(
        (ticket) => !Number(ticket.assignedConsultorio || 0)
    );
}

function getAssignedWaitingTicketsFromList(tickets, consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return getSortedWaitingTicketsFromList(tickets).filter(
        (ticket) => Number(ticket.assignedConsultorio || 0) === target
    );
}

function getCalledTicketForConsultorioFromList(tickets, consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return (
        (Array.isArray(tickets) ? tickets : []).find(
            (ticket) =>
                String(ticket?.status || '')
                    .trim()
                    .toLowerCase() === 'called' &&
                Number(ticket?.assignedConsultorio || 0) === target
        ) || null
    );
}

function getQueueTicketByIdFromList(tickets, ticketId) {
    const target = Number(ticketId || 0);
    if (!target) {
        return null;
    }
    return (
        (Array.isArray(tickets) ? tickets : []).find(
            (ticket) => Number(ticket?.id || 0) === target
        ) || null
    );
}

function formatQueuePriorityTypeLabel(ticket) {
    const priority = String(ticket?.priorityClass || '')
        .trim()
        .toLowerCase();
    const queueType = String(ticket?.queueType || '')
        .trim()
        .toLowerCase();

    if (priority === 'appt_overdue') {
        return 'Cita vencida';
    }
    if (queueType === 'appointment') {
        return 'Cita';
    }
    return 'Walk-in';
}

function getQueuePriorityScore(ticket) {
    const ageSec = getQueueTicketAgeSec(ticket, 'waiting') || 0;
    const priority = String(ticket?.priorityClass || '')
        .trim()
        .toLowerCase();
    const queueType = String(ticket?.queueType || '')
        .trim()
        .toLowerCase();
    let bonus = 0;

    if (priority === 'appt_overdue') {
        bonus += 4 * 60;
    } else if (queueType === 'appointment') {
        bonus += 2 * 60;
    }

    if (Number(ticket?.assignedConsultorio || 0)) {
        bonus += 45;
    }

    return ageSec + bonus;
}

function getPrioritySequenceTickets(limit = 4) {
    return [...getSortedWaitingTickets()]
        .sort((left, right) => {
            const scoreDelta =
                getQueuePriorityScore(right) - getQueuePriorityScore(left);
            if (scoreDelta !== 0) {
                return scoreDelta;
            }
            const leftMs = getQueueTicketTimestampMs(left, 'waiting');
            const rightMs = getQueueTicketTimestampMs(right, 'waiting');
            if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
                return leftMs - rightMs;
            }
            return Number(left.id || 0) - Number(right.id || 0);
        })
        .slice(0, Math.max(1, Number(limit || 4)));
}

function buildConsultorioOperatorContext(
    manifest,
    detectedPlatform,
    consultorio
) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const operator = getLatestSurfaceDetails('operator');
    const operatorStation = String(operator.details.station || '')
        .trim()
        .toLowerCase();
    const operatorLocked =
        String(operator.details.stationMode || '')
            .trim()
            .toLowerCase() === 'locked';
    const operatorAssigned = operatorStation === slotKey;
    const operatorLive =
        Boolean(operator.latest) &&
        !operator.group.stale &&
        String(operator.group.status || '')
            .trim()
            .toLowerCase() !== 'unknown';
    const operatorLabel = operatorAssigned
        ? `Operador ${slotKey.toUpperCase()} ${operatorLocked ? 'fijo' : 'libre'}`
        : operatorLive
          ? `Operador activo en ${String(operatorStation || 'otra estación').toUpperCase()}`
          : `Sin operador dedicado`;
    const operatorUrl = buildPreparedSurfaceUrl(
        'operator',
        manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
        {
            ...ensureInstallPreset(detectedPlatform),
            surface: 'operator',
            station: slotKey,
            lock: true,
        }
    );
    return {
        slot,
        slotKey,
        operator,
        operatorStation,
        operatorLocked,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel: operatorAssigned
            ? `1 tecla ${operator.details.oneTap ? 'ON' : 'OFF'}`
            : '1 tecla sin validar',
        numpadLabel: operatorAssigned
            ? operator.details.numpadSeen
                ? 'Numpad listo'
                : 'Numpad pendiente'
            : 'Numpad sin señal',
        heartbeatLabel: buildSignalAgeLabel(operator.latest, 'Sin heartbeat'),
    };
}

function buildConsultorioBoardCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const {
        slot,
        slotKey,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
    } = operatorContext;
    const currentTicket = getCalledTicketForConsultorio(slot);
    const nextTicket = getWaitingForConsultorio(slot);

    let state = 'idle';
    let badge = 'Sin cola';
    let summary =
        'No hay ticket activo ni en espera para este consultorio en este momento.';
    let primaryLabel = 'Sin ticket listo';
    let primaryAction = 'none';

    if (currentTicket) {
        state = 'active';
        badge = 'Llamado activo';
        summary = `${currentTicket.ticketCode} sigue en atención. Puedes re-llamar o liberar ${slotKey.toUpperCase()} sin salir del hub.`;
        primaryLabel = `Re-llamar ${currentTicket.ticketCode}`;
        primaryAction = 'recall';
    } else if (nextTicket && operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Listo para llamar';
        summary = `${nextTicket.ticketCode} ya puede llamarse desde ${slotKey.toUpperCase()} con el operador correcto arriba y heartbeat vigente.`;
        primaryLabel = `Llamar ${nextTicket.ticketCode}`;
        primaryAction = 'call';
    } else if (nextTicket) {
        state = 'warning';
        badge = 'Falta operador';
        summary = `${nextTicket.ticketCode} está listo, pero ${slotKey.toUpperCase()} todavía no tiene un operador dedicado o señal suficiente para confiar en el llamado rápido.`;
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
    } else if (!operatorAssigned) {
        state = operatorLive ? 'warning' : 'idle';
        badge = operatorLive ? 'Sin operador dedicado' : 'Sin señal';
        summary = operatorLive
            ? `${slotKey.toUpperCase()} no coincide con el operador reportado. Conviene abrir el operador correcto antes del siguiente pico de atención.`
            : `Todavía no hay heartbeat del operador preparado para ${slotKey.toUpperCase()}.`;
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
    } else if (operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Listo hoy';
        summary = `${slotKey.toUpperCase()} ya tiene operador en vivo y puede recibir el siguiente ticket en cuanto entre a la cola.`;
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        operatorUrl,
        operatorLabel,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
        summary,
        currentLabel: currentTicket
            ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  currentTicket,
                  'called'
              )}`
            : 'Sin llamado',
        nextLabel: nextTicket
            ? `${nextTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  nextTicket,
                  'waiting'
              )}`
            : 'Sin ticket en espera',
        primaryLabel,
        primaryAction,
        canRelease: Boolean(currentTicket),
        currentTicketId: Number(currentTicket?.id || 0),
    };
}

function buildConsultorioBoard(manifest, detectedPlatform) {
    const cards = [1, 2].map((consultorio) =>
        buildConsultorioBoardCard(manifest, detectedPlatform, consultorio)
    );
    const activeCount = cards.filter((card) => card.state === 'active').length;
    const readyCount = cards.filter(
        (card) => card.state === 'ready' || card.state === 'active'
    ).length;
    const warningCount = cards.filter(
        (card) => card.state === 'warning' || card.state === 'alert'
    ).length;

    const title =
        warningCount > 0
            ? 'Mesa por consultorio con pendientes'
            : 'Mesa por consultorio lista';
    const summary =
        warningCount > 0
            ? 'Cada tarjeta resume C1 y C2 con ticket actual, siguiente en cola y el operador esperado para resolver el turno sin navegar por toda la tabla.'
            : 'C1 y C2 ya muestran su contexto operativo directo: ticket activo, siguiente en cola y acceso inmediato al operador correcto.';

    return {
        title,
        summary,
        statusLabel:
            warningCount > 0
                ? `${warningCount} pendiente(s)`
                : readyCount > 0
                  ? `${readyCount}/2 listo(s)`
                  : 'Sin cola ahora',
        statusState:
            warningCount > 0 ? 'warning' : readyCount > 0 ? 'ready' : 'idle',
        chips: [
            `Activos ${activeCount}`,
            `Listos ${readyCount}`,
            `Pendientes ${warningCount}`,
        ],
        cards,
    };
}

function renderConsultorioBoard(manifest, detectedPlatform) {
    const root = document.getElementById('queueConsultorioBoard');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const board = buildConsultorioBoard(manifest, detectedPlatform);
    setHtml(
        '#queueConsultorioBoard',
        `
            <section class="queue-consultorio-board__shell" data-state="${escapeHtml(
                board.statusState
            )}">
                <div class="queue-consultorio-board__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Mesa por consultorio</p>
                        <h5 id="queueConsultorioBoardTitle" class="queue-app-card__title">${escapeHtml(
                            board.title
                        )}</h5>
                        <p id="queueConsultorioBoardSummary" class="queue-consultorio-board__summary">${escapeHtml(
                            board.summary
                        )}</p>
                    </div>
                    <div class="queue-consultorio-board__meta">
                        <span
                            id="queueConsultorioBoardStatus"
                            class="queue-consultorio-board__status"
                            data-state="${escapeHtml(board.statusState)}"
                        >
                            ${escapeHtml(board.statusLabel)}
                        </span>
                        <div class="queue-consultorio-board__chips">
                            ${board.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-consultorio-board__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueConsultorioBoardCards" class="queue-consultorio-board__grid" role="list" aria-label="Estado vivo por consultorio">
                    ${board.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueConsultorioCard_${escapeHtml(card.slotKey)}"
                                    class="queue-consultorio-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-consultorio-card__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p class="queue-consultorio-card__operator">${escapeHtml(
                                                card.operatorLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-consultorio-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-consultorio-card__summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    <div class="queue-consultorio-card__facts">
                                        <div class="queue-consultorio-card__fact">
                                            <span>Ahora</span>
                                            <strong id="queueConsultorioCurrent_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.currentLabel)}</strong>
                                        </div>
                                        <div class="queue-consultorio-card__fact">
                                            <span>Siguiente</span>
                                            <strong id="queueConsultorioNext_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.nextLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-consultorio-card__chips">
                                        <span class="queue-consultorio-card__chip">${escapeHtml(
                                            card.oneTapLabel
                                        )}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(
                                            card.numpadLabel
                                        )}</span>
                                        <span class="queue-consultorio-card__chip">${escapeHtml(
                                            card.heartbeatLabel
                                        )}</span>
                                    </div>
                                    <div class="queue-consultorio-card__actions">
                                        <button
                                            id="queueConsultorioPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-consultorio-card__action queue-consultorio-card__action--primary"
                                            data-queue-consultorio-action="${escapeHtml(
                                                card.primaryAction
                                            )}"
                                            data-queue-consultorio="${escapeHtml(
                                                String(card.slot)
                                            )}"
                                            data-queue-ticket-id="${escapeHtml(
                                                String(card.currentTicketId)
                                            )}"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <button
                                            id="queueConsultorioRelease_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-consultorio-card__action"
                                            data-queue-consultorio-release="${escapeHtml(
                                                String(card.slot)
                                            )}"
                                            ${card.canRelease ? '' : 'disabled'}
                                        >
                                            Liberar ${escapeHtml(card.slotKey.toUpperCase())}
                                        </button>
                                        <a
                                            id="queueConsultorioOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-consultorio-card__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(card.slotKey.toUpperCase())}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    board.cards.forEach((card) => {
        const primaryButton = document.getElementById(
            `queueConsultorioPrimary_${card.slotKey}`
        );
        if (primaryButton instanceof HTMLButtonElement) {
            primaryButton.onclick = () => {
                if (card.primaryAction === 'call') {
                    const headerButton = document.querySelector(
                        `#queue .queue-admin-header-actions [data-action="queue-call-next"][data-queue-consultorio="${card.slot}"]`
                    );
                    if (headerButton instanceof HTMLButtonElement) {
                        headerButton.click();
                    }
                    return;
                }

                if (
                    card.primaryAction === 'recall' &&
                    card.currentTicketId > 0
                ) {
                    const recallButton = document.querySelector(
                        `[data-action="queue-ticket-action"][data-queue-id="${card.currentTicketId}"][data-queue-action="re-llamar"]`
                    );
                    if (recallButton instanceof HTMLButtonElement) {
                        recallButton.click();
                        return;
                    }
                }

                if (card.primaryAction === 'open') {
                    window.open(card.operatorUrl, '_blank', 'noopener');
                }
            };
        }

        const releaseButton = document.getElementById(
            `queueConsultorioRelease_${card.slotKey}`
        );
        if (releaseButton instanceof HTMLButtonElement) {
            releaseButton.onclick = () => {
                const targetButton = document.getElementById(
                    card.slot === 2 ? 'queueReleaseC2' : 'queueReleaseC1'
                );
                if (targetButton instanceof HTMLButtonElement) {
                    targetButton.click();
                }
            };
        }
    });
}

function buildQueueAttentionCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const {
        slot,
        slotKey,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
    } = operatorContext;
    const currentTicket = getCalledTicketForConsultorio(slot);
    const nextTicket = getWaitingForConsultorio(slot);
    const queueBehindCount = getAssignedWaitingTickets(slot).length;
    const generalWaitingCount = getUnassignedWaitingTickets().length;
    const calledAgeSec = currentTicket
        ? getQueueTicketAgeSec(currentTicket, 'called') || 0
        : 0;
    const calledAgeLabel = currentTicket
        ? formatQueueTicketAgeLabel(currentTicket, 'called')
        : 'sin llamado activo';

    let state = 'idle';
    let badge = 'Sin atención activa';
    let headline = `${slotKey.toUpperCase()} sin llamado activo`;
    let detail =
        'Este consultorio no tiene un ticket llamado en este momento. Cuando vuelva a haber atención en curso, aquí verás su seguimiento y la presión detrás.';
    let recommendationLabel = 'Sin seguimiento pendiente';
    let primaryAction = 'none';
    let primaryLabel = 'Sin acción';

    if (currentTicket) {
        const nextTicketCode = nextTicket?.ticketCode || '';
        if (calledAgeSec >= QUEUE_ATTENTION_ALERT_SEC && queueBehindCount > 0) {
            state = 'alert';
            badge = 'Cola frenada';
            headline = `${currentTicket.ticketCode} está reteniendo ${slotKey.toUpperCase()}`;
            detail = `${currentTicket.ticketCode} va ${calledAgeLabel} y ${nextTicketCode} ya espera detrás. Re-llama o libera ${slotKey.toUpperCase()} si el paciente no entró para no congelar la cola.`;
            recommendationLabel = `Re-llamar ${currentTicket.ticketCode} o liberar ${slotKey.toUpperCase()}`;
            primaryAction = 'recall';
            primaryLabel = `Re-llamar ${currentTicket.ticketCode}`;
        } else if (calledAgeSec >= QUEUE_ATTENTION_RECALL_SEC) {
            state = 'warning';
            badge = 'Revisar llamado';
            headline = `${currentTicket.ticketCode} pide confirmación`;
            detail = nextTicket
                ? `${currentTicket.ticketCode} va ${calledAgeLabel} y ${nextTicketCode} ya espera detrás. Conviene re-llamar o cerrar la atención para destrabar el siguiente paso.`
                : `${currentTicket.ticketCode} va ${calledAgeLabel}. Revisa si el paciente ya pasó o vuelve a llamarlo antes de perder contexto.`;
            recommendationLabel = `Re-llamar ${currentTicket.ticketCode}`;
            primaryAction = 'recall';
            primaryLabel = `Re-llamar ${currentTicket.ticketCode}`;
        } else {
            state = 'active';
            badge = 'En atención';
            headline = `${currentTicket.ticketCode} sigue en ${slotKey.toUpperCase()}`;
            detail = nextTicket
                ? `${currentTicket.ticketCode} va ${calledAgeLabel}. ${nextTicketCode} ya está en la cola de ${slotKey.toUpperCase()}, así que conviene mantener este consultorio visible para cerrar y seguir sin pausa.`
                : `${currentTicket.ticketCode} va ${calledAgeLabel}. No hay otro ticket asignado detrás por ahora, pero conviene mantener el operador a la vista.`;
            recommendationLabel = nextTicket
                ? `Completa ${currentTicket.ticketCode} cuando salga para llamar ${nextTicketCode}`
                : `Mantén visible ${currentTicket.ticketCode} en Operador ${slotKey.toUpperCase()}`;
            primaryAction = 'open';
            primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        }
    } else if (nextTicket && operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Siguiente listo';
        headline = `${nextTicket.ticketCode} ya espera en ${slotKey.toUpperCase()}`;
        detail = `${nextTicket.ticketCode} está alineado al consultorio y el operador reporta señal estable. Puedes llamarlo desde aquí sin volver a la tabla.`;
        recommendationLabel = `Llamar ${nextTicket.ticketCode}`;
        primaryAction = 'call';
        primaryLabel = `Llamar ${nextTicket.ticketCode}`;
    } else if (nextTicket) {
        state = 'warning';
        badge = 'Falta operador';
        headline = `${nextTicket.ticketCode} espera, pero ${slotKey.toUpperCase()} no está listo`;
        detail = `${nextTicket.ticketCode} ya es el siguiente ticket para ${slotKey.toUpperCase()}, pero todavía falta alinear el operador o recuperar su heartbeat antes del llamado.`;
        recommendationLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
    } else if (operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Operador atento';
        headline = `${slotKey.toUpperCase()} listo para recibir`;
        detail = `${slotKey.toUpperCase()} ya tiene operador en vivo, sin llamado activo y sin cola asignada detrás.`;
        recommendationLabel = `Mantener ${slotKey.toUpperCase()} visible`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        detail,
        recommendationLabel,
        currentLabel: currentTicket
            ? `${currentTicket.ticketCode} · ${calledAgeLabel}`
            : 'Sin llamado activo',
        nextLabel: nextTicket
            ? `${nextTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  nextTicket,
                  'waiting'
              )}`
            : 'Sin ticket detrás',
        pressureLabel: `Detrás ${queueBehindCount} · General ${generalWaitingCount}`,
        operatorUrl,
        operatorLabel,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
        primaryAction,
        primaryLabel,
        currentTicketId: Number(currentTicket?.id || 0),
        canComplete: Boolean(currentTicket),
        canRelease: Boolean(currentTicket),
        hasActiveTicket: Boolean(currentTicket),
        queueBehindCount,
    };
}

function buildQueueAttentionDeck(manifest, detectedPlatform) {
    const cards = [1, 2].map((consultorio) =>
        buildQueueAttentionCard(manifest, detectedPlatform, consultorio)
    );
    const activeCount = cards.filter((card) => card.hasActiveTicket).length;
    const reviewCount = cards.filter((card) =>
        ['warning', 'alert'].includes(card.state)
    ).length;
    const stalledCount = cards.filter((card) => card.state === 'alert').length;
    const queueBehindCount = cards.reduce(
        (total, card) => total + Number(card.queueBehindCount || 0),
        0
    );

    return {
        title:
            stalledCount > 0
                ? 'Seguimiento de atención crítico'
                : reviewCount > 0
                  ? 'Seguimiento de atención por revisar'
                  : activeCount > 0
                    ? 'Seguimiento de atención en curso'
                    : 'Seguimiento de atención despejado',
        summary:
            stalledCount > 0
                ? 'Estos llamados ya están frenando el consultorio y conviene intervenir antes de que la cola detrás siga envejeciendo.'
                : reviewCount > 0
                  ? 'Aquí se vigilan llamados activos, edad de atención y la cola que ya quedó detrás para reaccionar sin bajar a la tabla.'
                  : activeCount > 0
                    ? 'Los consultorios tienen llamados activos, pero aún no muestran señales de atasco; el panel sigue dejando a mano las acciones rápidas.'
                    : 'No hay llamados activos ahora mismo. Cuando vuelva a haber atención en curso, aquí verás el tiempo y la acción sugerida.',
        statusLabel:
            stalledCount > 0
                ? `${stalledCount} llamado(s) críticos`
                : reviewCount > 0
                  ? `${reviewCount} llamado(s) por revisar`
                  : activeCount > 0
                    ? `${activeCount} atención(es) en curso`
                    : 'Sin llamados activos',
        statusState:
            stalledCount > 0
                ? 'alert'
                : reviewCount > 0
                  ? 'warning'
                  : activeCount > 0
                    ? 'ready'
                    : 'idle',
        chips: [
            `Activos ${activeCount}`,
            `Revisar ${reviewCount}`,
            `Detrás ${queueBehindCount}`,
        ],
        cards,
    };
}

function describeQueueAttentionAction(card, actionKind) {
    if (actionKind === 'recall') {
        return {
            title: `Seguimiento ${card.slotKey.toUpperCase()}: re-llamado`,
            summary: `${card.currentLabel.split(' · ')[0]} se re-llamó desde seguimiento de atención.`,
        };
    }
    if (actionKind === 'complete') {
        return {
            title: `Seguimiento ${card.slotKey.toUpperCase()}: ticket completado`,
            summary: `${card.currentLabel.split(' · ')[0]} se cerró desde seguimiento de atención.`,
        };
    }
    if (actionKind === 'release') {
        return {
            title: `Seguimiento ${card.slotKey.toUpperCase()}: consultorio liberado`,
            summary: `${card.currentLabel.split(' · ')[0]} se liberó para devolverlo a la cola.`,
        };
    }
    if (actionKind === 'call') {
        return {
            title: `Seguimiento ${card.slotKey.toUpperCase()}: siguiente llamado`,
            summary: `${card.nextLabel.split(' · ')[0]} se llamó desde seguimiento de atención.`,
        };
    }
    return {
        title: `Seguimiento ${card.slotKey.toUpperCase()}: operador abierto`,
        summary: `Se abrió Operador ${card.slotKey.toUpperCase()} desde seguimiento de atención.`,
    };
}

async function runQueueAttentionAction(
    card,
    actionKind,
    manifest,
    detectedPlatform
) {
    if (!card || !actionKind || actionKind === 'none') {
        return;
    }

    try {
        const { callNextForConsultorio, runQueueTicketAction } =
            await import('../../actions.js');
        if (actionKind === 'recall' && card.currentTicketId > 0) {
            await runQueueTicketAction(
                card.currentTicketId,
                're-llamar',
                card.slot
            );
        } else if (actionKind === 'complete' && card.currentTicketId > 0) {
            await runQueueTicketAction(card.currentTicketId, 'completar');
        } else if (actionKind === 'release' && card.currentTicketId > 0) {
            await runQueueTicketAction(card.currentTicketId, 'liberar');
        } else if (actionKind === 'call') {
            await callNextForConsultorio(card.slot);
        } else if (actionKind === 'open') {
            window.open(card.operatorUrl, '_blank', 'noopener');
        } else {
            return;
        }

        appendOpsLogEntry({
            source: 'attention_deck',
            tone:
                actionKind === 'release'
                    ? 'warning'
                    : actionKind === 'complete'
                      ? 'success'
                      : 'info',
            ...describeQueueAttentionAction(card, actionKind),
        });
    } catch (_error) {
        createToast('No se pudo ejecutar la acción de seguimiento', 'error');
    } finally {
        rerenderQueueOpsHub(manifest, detectedPlatform);
    }
}

function renderQueueAttentionDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueAttentionDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueAttentionDeck(manifest, detectedPlatform);
    setHtml(
        '#queueAttentionDeck',
        `
            <section class="queue-attention-deck__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-attention-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Seguimiento de atención</p>
                        <h5 id="queueAttentionDeckTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueAttentionDeckSummary" class="queue-attention-deck__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <div class="queue-attention-deck__meta">
                        <span
                            id="queueAttentionDeckStatus"
                            class="queue-attention-deck__status"
                            data-state="${escapeHtml(deck.statusState)}"
                        >
                            ${escapeHtml(deck.statusLabel)}
                        </span>
                        <div class="queue-attention-deck__chips">
                            ${deck.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-attention-deck__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueAttentionDeckCards" class="queue-attention-deck__grid" role="list" aria-label="Seguimiento de tickets llamados por consultorio">
                    ${deck.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueAttentionCard_${escapeHtml(card.slotKey)}"
                                    class="queue-attention-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-attention-card__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p class="queue-attention-card__operator">${escapeHtml(
                                                card.operatorLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-attention-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueAttentionHeadline_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-attention-card__headline">${escapeHtml(
                                        card.headline
                                    )}</p>
                                    <p class="queue-attention-card__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <div class="queue-attention-card__facts">
                                        <div class="queue-attention-card__fact">
                                            <span>Ahora</span>
                                            <strong id="queueAttentionCurrent_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.currentLabel)}</strong>
                                        </div>
                                        <div class="queue-attention-card__fact">
                                            <span>Siguiente</span>
                                            <strong id="queueAttentionNext_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.nextLabel)}</strong>
                                        </div>
                                        <div class="queue-attention-card__fact">
                                            <span>Presión</span>
                                            <strong id="queueAttentionPressure_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(
                                                card.pressureLabel
                                            )}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-attention-card__chips">
                                        <span class="queue-attention-card__chip">${escapeHtml(
                                            card.oneTapLabel
                                        )}</span>
                                        <span class="queue-attention-card__chip">${escapeHtml(
                                            card.numpadLabel
                                        )}</span>
                                        <span class="queue-attention-card__chip">${escapeHtml(
                                            card.heartbeatLabel
                                        )}</span>
                                    </div>
                                    <strong id="queueAttentionRecommendation_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-attention-card__recommendation">${escapeHtml(
                                        card.recommendationLabel
                                    )}</strong>
                                    <div class="queue-attention-card__actions">
                                        <button
                                            id="queueAttentionPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-attention-card__action queue-attention-card__action--primary"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <button
                                            id="queueAttentionComplete_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-attention-card__action"
                                            ${card.canComplete ? '' : 'disabled'}
                                        >
                                            Completar
                                        </button>
                                        <button
                                            id="queueAttentionRelease_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-attention-card__action"
                                            ${card.canRelease ? '' : 'disabled'}
                                        >
                                            Liberar
                                        </button>
                                        <a
                                            id="queueAttentionOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-attention-card__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    deck.cards.forEach((card) => {
        const primaryButton = document.getElementById(
            `queueAttentionPrimary_${card.slotKey}`
        );
        if (primaryButton instanceof HTMLButtonElement) {
            primaryButton.onclick = async () => {
                primaryButton.disabled = true;
                await runQueueAttentionAction(
                    card,
                    card.primaryAction,
                    manifest,
                    detectedPlatform
                );
            };
        }

        const completeButton = document.getElementById(
            `queueAttentionComplete_${card.slotKey}`
        );
        if (completeButton instanceof HTMLButtonElement) {
            completeButton.onclick = async () => {
                completeButton.disabled = true;
                await runQueueAttentionAction(
                    card,
                    'complete',
                    manifest,
                    detectedPlatform
                );
            };
        }

        const releaseButton = document.getElementById(
            `queueAttentionRelease_${card.slotKey}`
        );
        if (releaseButton instanceof HTMLButtonElement) {
            releaseButton.onclick = async () => {
                releaseButton.disabled = true;
                await runQueueAttentionAction(
                    card,
                    'release',
                    manifest,
                    detectedPlatform
                );
            };
        }
    });
}

function buildQueueResolutionCard(manifest, detectedPlatform, consultorio) {
    const state = getState();
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const { slot, slotKey, operatorLabel, operatorUrl, heartbeatLabel } =
        operatorContext;
    const currentTicket = getCalledTicketForConsultorio(slot);
    const nextTicket = getWaitingForConsultorio(slot);
    const queueBehindCount = getAssignedWaitingTickets(slot).length;
    const pendingAction = state.queue.pendingSensitiveAction;
    const pendingForCard =
        currentTicket &&
        Number(pendingAction?.ticketId || 0) === Number(currentTicket.id || 0);
    const pendingCopy = pendingForCard
        ? getQueuePendingActionCopy(pendingAction, currentTicket)
        : '';
    const calledAgeLabel = currentTicket
        ? formatQueueTicketAgeLabel(currentTicket, 'called')
        : 'sin llamado activo';
    const currentTicketCode = String(currentTicket?.ticketCode || '');
    const nextTicketCode = String(nextTicket?.ticketCode || '');

    let stateName = 'idle';
    let badge = 'Sin cierre pendiente';
    let headline = `${slotKey.toUpperCase()} sin ticket por cerrar`;
    let summary =
        'No hay un ticket llamado pendiente de resolución en este consultorio.';
    let statusLabel = 'Sin ticket activo';
    let primaryAction = 'none';
    let primaryLabel = 'Sin acción';

    if (pendingForCard) {
        stateName = 'alert';
        badge = 'Confirmación pendiente';
        headline = `${currentTicketCode} espera decisión final`;
        summary = `Quedó pendiente confirmar ${pendingCopy}. Usa confirmar o cancelar antes de seguir operando este consultorio.`;
        statusLabel = `Pendiente: ${pendingCopy}`;
        primaryAction = 'confirm';
        primaryLabel = 'Confirmar pendiente';
    } else if (currentTicket) {
        stateName = queueBehindCount > 0 ? 'warning' : 'ready';
        badge = queueBehindCount > 0 ? 'Cerrar y seguir' : 'Cerrar atención';
        headline = `${currentTicketCode} ya puede resolverse`;
        summary = nextTicket
            ? `Si ${currentTicketCode} ya salió, completar deja listo ${nextTicketCode}. Si no apareció, no show requerirá confirmación; si fue un llamado equivocado, liberar lo devuelve a recepción.`
            : `Completar cierra ${currentTicketCode}. No show requerirá confirmación y liberar lo devuelve a la cola general.`;
        statusLabel = `${calledAgeLabel} · detrás ${queueBehindCount}`;
        primaryAction = 'complete';
        primaryLabel = `Completar ${currentTicketCode}`;
    } else if (nextTicket) {
        stateName = 'ready';
        badge = 'Siguiente listo';
        headline = `${nextTicketCode} espera la siguiente llamada`;
        summary = `No hay cierre pendiente en ${slotKey.toUpperCase()}. El próximo movimiento útil aquí es llamar ${nextTicketCode}.`;
        statusLabel = `Espera ${formatQueueTicketAgeLabel(nextTicket, 'waiting')}`;
        primaryAction = 'call';
        primaryLabel = `Llamar ${nextTicketCode}`;
    }

    return {
        slot,
        slotKey,
        state: stateName,
        badge,
        headline,
        summary,
        statusLabel,
        operatorLabel,
        operatorUrl,
        heartbeatLabel,
        currentLabel: currentTicket
            ? `${currentTicketCode} · ${calledAgeLabel}`
            : 'Sin ticket en cierre',
        completePreview: currentTicket
            ? nextTicket
                ? `Cierra ${currentTicketCode} y deja listo ${nextTicketCode}`
                : `Cierra ${currentTicketCode} y deja ${slotKey.toUpperCase()} libre`
            : 'Sin ticket activo que cerrar',
        noShowPreview: currentTicket
            ? nextTicket
                ? `Marca ausencia y conserva ${nextTicketCode} listo después de confirmar`
                : `Marca ausencia y limpia ${slotKey.toUpperCase()} después de confirmar`
            : 'No show no aplica ahora',
        releasePreview: currentTicket
            ? `Devuelve ${currentTicketCode} a la cola general para revisarlo en recepción`
            : 'Liberar no aplica ahora',
        primaryAction,
        primaryLabel,
        currentTicketId: Number(currentTicket?.id || 0),
        hasCurrentTicket: Boolean(currentTicket),
        hasPendingSensitive: Boolean(pendingForCard),
    };
}

function buildQueueResolutionDeck(manifest, detectedPlatform) {
    const state = getState();
    const cards = [1, 2].map((consultorio) =>
        buildQueueResolutionCard(manifest, detectedPlatform, consultorio)
    );
    const pendingAction = state.queue.pendingSensitiveAction;
    const pendingCopy = getQueuePendingActionCopy(pendingAction, null);
    const pendingTicket = getQueueTicketById(pendingAction?.ticketId);
    const pendingSlot =
        Number(pendingAction?.consultorio || 0) === 2 ? 'C2' : 'C1';
    const activeCount = cards.filter((card) => card.hasCurrentTicket).length;
    const pendingCount = cards.filter(
        (card) => card.hasPendingSensitive
    ).length;
    const readyToCloseCount = cards.filter(
        (card) => card.primaryAction === 'complete'
    ).length;

    return {
        title:
            pendingCount > 0
                ? 'Resolución rápida con confirmación pendiente'
                : readyToCloseCount > 0
                  ? 'Resolución rápida lista'
                  : activeCount > 0
                    ? 'Resolución rápida en seguimiento'
                    : 'Resolución rápida despejada',
        summary:
            pendingCount > 0
                ? 'El hub dejó visible una acción sensible pendiente para que no quede escondida en el diálogo y puedas confirmarla o cancelarla a tiempo.'
                : readyToCloseCount > 0
                  ? 'Este bloque traduce cada ticket llamado a tres salidas claras: completar, no show o liberar, con impacto visible sobre el siguiente turno.'
                  : activeCount > 0
                    ? 'Todavía hay tickets en atención, pero sin una resolución inmediata pendiente.'
                    : 'No hay tickets llamados por resolver en este momento.',
        statusLabel:
            pendingCount > 0
                ? `${pendingCount} confirmación(es) pendiente(s)`
                : readyToCloseCount > 0
                  ? `${readyToCloseCount} cierre(s) listos`
                  : activeCount > 0
                    ? `${activeCount} atención(es) en curso`
                    : 'Sin resolución pendiente',
        statusState:
            pendingCount > 0
                ? 'alert'
                : readyToCloseCount > 0
                  ? 'ready'
                  : activeCount > 0
                    ? 'warning'
                    : 'idle',
        chips: [
            `Activos ${activeCount}`,
            `Listos ${readyToCloseCount}`,
            `Confirmar ${pendingCount}`,
        ],
        pendingAction:
            pendingAction && pendingCopy
                ? {
                      copy: pendingCopy,
                      ticketCode: String(pendingTicket?.ticketCode || 'ticket'),
                      slotLabel: pendingSlot,
                  }
                : null,
        cards,
    };
}

function describeQueueResolutionAction(card, actionKind, pendingCopy = '') {
    if (actionKind === 'complete') {
        return {
            title: `Resolución ${card.slotKey.toUpperCase()}: ticket completado`,
            summary: `${card.currentLabel.split(' · ')[0]} se completó desde resolución rápida.`,
        };
    }
    if (actionKind === 'no_show') {
        return {
            title: `Resolución ${card.slotKey.toUpperCase()}: no show pendiente`,
            summary: pendingCopy
                ? `Quedó pendiente confirmar ${pendingCopy}.`
                : `${card.currentLabel.split(' · ')[0]} se envió a confirmación de no show.`,
        };
    }
    if (actionKind === 'release') {
        return {
            title: `Resolución ${card.slotKey.toUpperCase()}: ticket liberado`,
            summary: `${card.currentLabel.split(' · ')[0]} se liberó desde resolución rápida.`,
        };
    }
    if (actionKind === 'confirm') {
        return {
            title: `Resolución ${card.slotKey.toUpperCase()}: confirmación aplicada`,
            summary:
                pendingCopy ||
                'La acción sensible pendiente se confirmó desde el hub.',
        };
    }
    if (actionKind === 'cancel') {
        return {
            title: `Resolución ${card.slotKey.toUpperCase()}: confirmación cancelada`,
            summary:
                pendingCopy ||
                'La acción sensible pendiente se canceló desde el hub.',
        };
    }
    if (actionKind === 'call') {
        return {
            title: `Resolución ${card.slotKey.toUpperCase()}: siguiente llamado`,
            summary: `${card.primaryLabel.replace('Llamar ', '')} se llamó desde resolución rápida.`,
        };
    }
    return {
        title: `Resolución ${card.slotKey.toUpperCase()}: operador abierto`,
        summary: `Se abrió Operador ${card.slotKey.toUpperCase()} desde resolución rápida.`,
    };
}

async function runQueueResolutionAction(
    card,
    actionKind,
    manifest,
    detectedPlatform
) {
    if (!card || !actionKind || actionKind === 'none') {
        return;
    }

    try {
        const {
            callNextForConsultorio,
            cancelQueueSensitiveAction,
            confirmQueueSensitiveAction,
            runQueueTicketAction,
        } = await import('../../actions.js');
        if (actionKind === 'complete' && card.currentTicketId > 0) {
            await runQueueTicketAction(card.currentTicketId, 'completar');
        } else if (actionKind === 'no_show' && card.currentTicketId > 0) {
            await runQueueTicketAction(
                card.currentTicketId,
                'no_show',
                card.slot
            );
            if (getState().queue.pendingSensitiveAction) {
                hideSensitiveDialogVisualOnly();
            }
        } else if (actionKind === 'release' && card.currentTicketId > 0) {
            await runQueueTicketAction(card.currentTicketId, 'liberar');
        } else if (actionKind === 'confirm') {
            await confirmQueueSensitiveAction();
        } else if (actionKind === 'cancel') {
            cancelQueueSensitiveAction();
        } else if (actionKind === 'call') {
            await callNextForConsultorio(card.slot);
        } else if (actionKind === 'open') {
            window.open(card.operatorUrl, '_blank', 'noopener');
        } else {
            return;
        }

        const pendingCopy =
            actionKind === 'no_show'
                ? getQueuePendingActionCopy(
                      getState().queue.pendingSensitiveAction,
                      getQueueTicketById(card.currentTicketId)
                  )
                : getQueuePendingActionCopy(
                      getState().queue.pendingSensitiveAction
                  );

        appendOpsLogEntry({
            source: 'resolution_deck',
            tone:
                actionKind === 'complete'
                    ? 'success'
                    : actionKind === 'cancel' || actionKind === 'release'
                      ? 'warning'
                      : actionKind === 'no_show'
                        ? 'warning'
                        : 'info',
            ...describeQueueResolutionAction(card, actionKind, pendingCopy),
        });
    } catch (_error) {
        createToast('No se pudo ejecutar la resolución rápida', 'error');
    } finally {
        rerenderQueueOpsHub(manifest, detectedPlatform);
    }
}

function renderQueueResolutionDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueResolutionDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueResolutionDeck(manifest, detectedPlatform);
    setHtml(
        '#queueResolutionDeck',
        `
            <section class="queue-resolution-deck__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-resolution-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Resolución rápida</p>
                        <h5 id="queueResolutionDeckTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueResolutionDeckSummary" class="queue-resolution-deck__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <div class="queue-resolution-deck__meta">
                        <span
                            id="queueResolutionDeckStatus"
                            class="queue-resolution-deck__status"
                            data-state="${escapeHtml(deck.statusState)}"
                        >
                            ${escapeHtml(deck.statusLabel)}
                        </span>
                        <div class="queue-resolution-deck__chips">
                            ${deck.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-resolution-deck__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                ${
                    deck.pendingAction
                        ? `
                            <div id="queueResolutionPending" class="queue-resolution-deck__pending">
                                <div>
                                    <strong>Confirmación pendiente</strong>
                                    <p>${escapeHtml(deck.pendingAction.copy)}</p>
                                </div>
                                <div class="queue-resolution-deck__pending-actions">
                                    <button id="queueResolutionPendingConfirm" type="button" class="queue-resolution-deck__action queue-resolution-deck__action--primary">Confirmar</button>
                                    <button id="queueResolutionPendingCancel" type="button" class="queue-resolution-deck__action">Cancelar</button>
                                </div>
                            </div>
                        `
                        : ''
                }
                <div id="queueResolutionDeckCards" class="queue-resolution-deck__grid" role="list" aria-label="Resolución rápida por consultorio">
                    ${deck.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueResolutionCard_${escapeHtml(card.slotKey)}"
                                    class="queue-resolution-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-resolution-card__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p class="queue-resolution-card__operator">${escapeHtml(
                                                card.operatorLabel
                                            )}</p>
                                        </div>
                                        <span class="queue-resolution-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueResolutionHeadline_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-resolution-card__headline">${escapeHtml(
                                        card.headline
                                    )}</p>
                                    <p class="queue-resolution-card__summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    <div class="queue-resolution-card__facts">
                                        <div class="queue-resolution-card__fact">
                                            <span>Actual</span>
                                            <strong id="queueResolutionCurrent_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.currentLabel)}</strong>
                                        </div>
                                        <div class="queue-resolution-card__fact">
                                            <span>Estado</span>
                                            <strong id="queueResolutionStatusLine_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.statusLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-resolution-card__previews">
                                        <div class="queue-resolution-card__preview">
                                            <span>Completar</span>
                                            <strong id="queueResolutionCompletePreview_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.completePreview)}</strong>
                                        </div>
                                        <div class="queue-resolution-card__preview">
                                            <span>No show</span>
                                            <strong id="queueResolutionNoShowPreview_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.noShowPreview)}</strong>
                                        </div>
                                        <div class="queue-resolution-card__preview">
                                            <span>Liberar</span>
                                            <strong id="queueResolutionReleasePreview_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.releasePreview)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-resolution-card__chips">
                                        <span class="queue-resolution-card__chip">${escapeHtml(
                                            card.heartbeatLabel
                                        )}</span>
                                    </div>
                                    <div class="queue-resolution-card__actions">
                                        <button
                                            id="queueResolutionPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-resolution-deck__action queue-resolution-deck__action--primary"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <button
                                            id="queueResolutionNoShow_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-resolution-deck__action"
                                            ${card.hasCurrentTicket ? '' : 'disabled'}
                                        >
                                            No show
                                        </button>
                                        <button
                                            id="queueResolutionRelease_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-resolution-deck__action"
                                            ${card.hasCurrentTicket ? '' : 'disabled'}
                                        >
                                            Liberar
                                        </button>
                                        <a
                                            id="queueResolutionOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-resolution-deck__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    deck.cards.forEach((card) => {
        const primaryButton = document.getElementById(
            `queueResolutionPrimary_${card.slotKey}`
        );
        if (primaryButton instanceof HTMLButtonElement) {
            primaryButton.onclick = async () => {
                primaryButton.disabled = true;
                await runQueueResolutionAction(
                    card,
                    card.primaryAction,
                    manifest,
                    detectedPlatform
                );
            };
        }

        const noShowButton = document.getElementById(
            `queueResolutionNoShow_${card.slotKey}`
        );
        if (noShowButton instanceof HTMLButtonElement) {
            noShowButton.onclick = async () => {
                noShowButton.disabled = true;
                await runQueueResolutionAction(
                    card,
                    'no_show',
                    manifest,
                    detectedPlatform
                );
            };
        }

        const releaseButton = document.getElementById(
            `queueResolutionRelease_${card.slotKey}`
        );
        if (releaseButton instanceof HTMLButtonElement) {
            releaseButton.onclick = async () => {
                releaseButton.disabled = true;
                await runQueueResolutionAction(
                    card,
                    'release',
                    manifest,
                    detectedPlatform
                );
            };
        }
    });

    const confirmButton = document.getElementById(
        'queueResolutionPendingConfirm'
    );
    if (confirmButton instanceof HTMLButtonElement) {
        confirmButton.onclick = async () => {
            confirmButton.disabled = true;
            const pending = getState().queue.pendingSensitiveAction;
            const slot = Number(pending?.consultorio || 0) === 2 ? 'c2' : 'c1';
            const card =
                deck.cards.find((item) => item.slotKey === slot) ||
                deck.cards[0];
            await runQueueResolutionAction(
                card,
                'confirm',
                manifest,
                detectedPlatform
            );
        };
    }

    const cancelButton = document.getElementById(
        'queueResolutionPendingCancel'
    );
    if (cancelButton instanceof HTMLButtonElement) {
        cancelButton.onclick = async () => {
            cancelButton.disabled = true;
            const pending = getState().queue.pendingSensitiveAction;
            const slot = Number(pending?.consultorio || 0) === 2 ? 'c2' : 'c1';
            const card =
                deck.cards.find((item) => item.slotKey === slot) ||
                deck.cards[0];
            await runQueueResolutionAction(
                card,
                'cancel',
                manifest,
                detectedPlatform
            );
        };
    }
}

function normalizeQueueTicketLookupField(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/\s+/g, '')
        .trim();
}

function getQueueTicketLookupStatusCopy(ticket) {
    const status = String(ticket?.status || '')
        .trim()
        .toLowerCase();
    const consultorio = Number(ticket?.assignedConsultorio || 0);
    if (status === 'called') {
        return consultorio > 0 ? `Llamado C${consultorio}` : 'Llamado';
    }
    if (status === 'waiting') {
        return consultorio > 0
            ? `En espera C${consultorio}`
            : 'En espera general';
    }
    if (status === 'completed') {
        return 'Completado';
    }
    if (status === 'no_show') {
        return 'No asistió';
    }
    if (status === 'cancelled') {
        return 'Cancelado';
    }
    return String(ticket?.status || 'Sin estado');
}

function getQueueTicketLookupScore(ticket, normalizedTerm) {
    if (!normalizedTerm) {
        return Number.POSITIVE_INFINITY;
    }
    const ticketCode = normalizeQueueTicketLookupField(ticket?.ticketCode);
    const initials = normalizeQueueTicketLookupField(ticket?.patientInitials);
    const queueType = normalizeQueueTicketLookupField(ticket?.queueType);
    const status = normalizeQueueTicketLookupField(ticket?.status);
    const phoneLast4 = String(ticket?.phoneLast4 || '')
        .replace(/\s+/g, '')
        .trim();

    if (ticketCode === normalizedTerm) {
        return 0;
    }
    if (ticketCode.startsWith(normalizedTerm)) {
        return 1;
    }
    if (ticketCode.includes(normalizedTerm)) {
        return 2;
    }
    if (initials === normalizedTerm) {
        return 3;
    }
    if (initials.includes(normalizedTerm)) {
        return 4;
    }
    if (phoneLast4 && phoneLast4.includes(normalizedTerm)) {
        return 5;
    }
    if (status.includes(normalizedTerm)) {
        return 6;
    }
    if (queueType.includes(normalizedTerm)) {
        return 7;
    }
    return Number.POSITIVE_INFINITY;
}

function getQueueTicketLookupMatches(term, limit = 4) {
    const normalizedTerm = normalizeQueueTicketLookupField(term);
    if (!normalizedTerm) {
        return [];
    }
    const statusRank = {
        called: 0,
        waiting: 1,
        completed: 2,
        no_show: 3,
        cancelled: 4,
    };
    return [...getQueueSource().queueTickets]
        .map((ticket) => ({
            ticket,
            score: getQueueTicketLookupScore(ticket, normalizedTerm),
        }))
        .filter((entry) => Number.isFinite(entry.score))
        .sort((left, right) => {
            if (left.score !== right.score) {
                return left.score - right.score;
            }
            const leftRank =
                statusRank[String(left.ticket?.status || '').toLowerCase()] ??
                9;
            const rightRank =
                statusRank[String(right.ticket?.status || '').toLowerCase()] ??
                9;
            if (leftRank !== rightRank) {
                return leftRank - rightRank;
            }
            const leftMode =
                left.ticket?.status === 'called' ? 'called' : 'waiting';
            const rightMode =
                right.ticket?.status === 'called' ? 'called' : 'waiting';
            const leftTs = getQueueTicketTimestampMs(left.ticket, leftMode);
            const rightTs = getQueueTicketTimestampMs(right.ticket, rightMode);
            if (Number.isFinite(leftTs) && Number.isFinite(rightTs)) {
                return leftTs - rightTs;
            }
            return Number(left.ticket?.id || 0) - Number(right.ticket?.id || 0);
        })
        .slice(0, limit)
        .map((entry) => entry.ticket);
}

function getQueueTicketLookupSuggestions(limit = 4) {
    const suggestions = [
        getCalledTicketForConsultorio(1),
        getCalledTicketForConsultorio(2),
        getUnassignedWaitingTickets()[0] || null,
        getWaitingForConsultorio(1),
        getWaitingForConsultorio(2),
    ];
    const seen = new Set();
    return suggestions
        .filter((ticket) => {
            const id = Number(ticket?.id || 0);
            if (!id || seen.has(id)) {
                return false;
            }
            seen.add(id);
            return true;
        })
        .slice(0, limit);
}

function pickQueueTicketLookupConsultorio(manifest, detectedPlatform) {
    return [1, 2]
        .map((consultorio) => {
            const context = buildConsultorioOperatorContext(
                manifest,
                detectedPlatform,
                consultorio
            );
            const load =
                getAssignedWaitingTickets(consultorio).length +
                (getCalledTicketForConsultorio(consultorio) ? 1 : 0);
            const readinessScore =
                context.operatorAssigned && context.operatorLive
                    ? 0
                    : context.operatorLive
                      ? 1
                      : 2;
            return {
                slot: consultorio,
                context,
                load,
                readinessScore,
            };
        })
        .sort((left, right) => {
            if (left.readinessScore !== right.readinessScore) {
                return left.readinessScore - right.readinessScore;
            }
            if (left.load !== right.load) {
                return left.load - right.load;
            }
            return left.slot - right.slot;
        })[0];
}

function buildQueueTicketLookupResult(ticket, manifest, detectedPlatform) {
    if (!ticket) {
        return null;
    }

    const consultorio = Number(ticket.assignedConsultorio || 0);
    const slot = consultorio === 2 ? 2 : consultorio === 1 ? 1 : 0;
    const ticketCode = String(ticket.ticketCode || 'ticket');
    const status = String(ticket.status || 'waiting')
        .trim()
        .toLowerCase();
    const statusCopy = getQueueTicketLookupStatusCopy(ticket);
    const ageMode = status === 'called' ? 'called' : 'waiting';
    const ageLabel =
        status === 'waiting' || status === 'called'
            ? formatQueueTicketAgeLabel(ticket, ageMode)
            : `Último estado · ${statusCopy}`;
    const priorityLabel = formatQueuePriorityTypeLabel(ticket);
    const patientLabel = ticket.patientInitials
        ? `Paciente ${String(ticket.patientInitials).trim()}`
        : 'Paciente sin iniciales';
    const pendingAction = getState().queue.pendingSensitiveAction;
    const pendingCopy =
        Number(pendingAction?.ticketId || 0) === Number(ticket.id || 0)
            ? getQueuePendingActionCopy(pendingAction, ticket)
            : '';

    let headline = `${ticketCode} localizado`;
    let detail =
        'El ticket está disponible para seguimiento rápido desde el hub.';
    let recommendation =
        'Usa el botón principal para ejecutar la siguiente jugada útil sin bajar a la tabla.';
    let panelState = 'idle';
    let badge = statusCopy;
    let primaryAction = 'table';
    let primaryLabel = 'Ver en tabla';
    let primaryConsultorio = 0;
    const secondaryActions = [];
    const secondaryKinds = new Set();

    const pushSecondaryAction = (kind, label, extra = {}) => {
        const key = `${kind}:${Number(extra.consultorio || 0)}`;
        if (secondaryKinds.has(key)) {
            return;
        }
        secondaryKinds.add(key);
        secondaryActions.push({
            kind,
            label,
            consultorio: Number(extra.consultorio || 0),
        });
    };

    const operatorUrl =
        slot > 0
            ? buildPreparedSurfaceUrl(
                  'operator',
                  manifest.operator || DEFAULT_APP_DOWNLOADS.operator,
                  {
                      ...ensureInstallPreset(detectedPlatform),
                      surface: 'operator',
                      station: slot === 2 ? 'c2' : 'c1',
                      lock: true,
                  }
              )
            : '';

    if (pendingCopy) {
        panelState = 'alert';
        badge = 'Confirmación pendiente';
        headline = `${ticketCode} espera confirmación sensible`;
        detail = `La acción ${pendingCopy} quedó preparada y visible dentro del hub.`;
        recommendation =
            'Confirma o cancela desde aquí antes de seguir llamando para no perder el contexto de este ticket.';
        primaryAction = 'confirm';
        primaryLabel = 'Confirmar pendiente';
        pushSecondaryAction('cancel', 'Cancelar pendiente');
    } else if (status === 'called') {
        panelState = 'active';
        badge = slot > 0 ? `En atención C${slot}` : 'En atención';
        headline =
            slot > 0
                ? `${ticketCode} está llamado en C${slot}`
                : `${ticketCode} está llamado`;
        detail =
            slot > 0
                ? `${ageLabel}. Puedes completar, marcar no show o liberar ${ticketCode} desde esta misma tarjeta.`
                : `${ageLabel}. Este ticket necesita cierre operativo antes de seguir con el resto de la cola.`;
        recommendation =
            'Completa si ya pasó a consulta; usa no show o liberar solo si necesitas destrabar la cola con una acción sensible.';
        primaryAction = 'complete';
        primaryLabel = `Completar ${ticketCode}`;
        primaryConsultorio = slot;
        if (slot > 0) {
            pushSecondaryAction('recall', 'Re-llamar', {
                consultorio: slot,
            });
            pushSecondaryAction('no_show', 'No show', {
                consultorio: slot,
            });
        }
        pushSecondaryAction('release', 'Liberar', {
            consultorio: slot,
        });
    } else if (status === 'waiting' && slot === 0) {
        const preferred = pickQueueTicketLookupConsultorio(
            manifest,
            detectedPlatform
        );
        panelState = preferred.readinessScore === 0 ? 'ready' : 'warning';
        badge =
            preferred.readinessScore === 0
                ? `Listo para C${preferred.slot}`
                : `Pendiente de C${preferred.slot}`;
        headline = `${ticketCode} sigue en la cola general`;
        detail = `${ageLabel}. Todavía no tiene consultorio; puedes mandarlo directo a C${preferred.slot} desde el hub.`;
        recommendation =
            preferred.readinessScore === 0
                ? `El operador de C${preferred.slot} ya está listo, así que este es el destino más simple para destrabar recepción.`
                : `Conviene reasignarlo a C${preferred.slot}, pero primero valida el operador si quieres llamarlo enseguida.`;
        primaryAction = 'assign';
        primaryLabel = `Asignar a C${preferred.slot}`;
        primaryConsultorio = preferred.slot;
        pushSecondaryAction(
            'assign',
            `Asignar a C${preferred.slot === 2 ? 1 : 2}`,
            {
                consultorio: preferred.slot === 2 ? 1 : 2,
            }
        );
    } else if (status === 'waiting' && slot > 0) {
        const currentTicket = getCalledTicketForConsultorio(slot);
        const nextTicket = getWaitingForConsultorio(slot);
        const isNextTicket =
            Number(nextTicket?.id || 0) === Number(ticket.id || 0);
        panelState = isNextTicket && !currentTicket ? 'ready' : 'warning';
        badge = isNextTicket ? `Siguiente en C${slot}` : `En cola C${slot}`;
        headline = `${ticketCode} ya está asignado a C${slot}`;
        if (isNextTicket && !currentTicket) {
            detail = `${ageLabel}. Es el siguiente ticket listo para llamarse en C${slot}.`;
            recommendation =
                'Puedes llamar desde aquí si el consultorio está libre; si no, abre Operador para mantener la atención alineada.';
            primaryAction = 'call';
            primaryLabel = `Llamar ${ticketCode}`;
            primaryConsultorio = slot;
        } else if (currentTicket) {
            detail = `${ageLabel}. C${slot} todavía atiende ${String(
                currentTicket.ticketCode || 'otro ticket'
            )}, así que conviene abrir el operador o revisar la tabla antes de mover este turno.`;
            recommendation =
                'Este ticket ya está encaminado al consultorio; usa Operador si quieres seguir la secuencia del mismo C.';
            primaryAction = 'open';
            primaryLabel = `Abrir Operador C${slot}`;
        } else {
            detail = `${ageLabel}. Hay otros tickets antes que ${ticketCode} en C${slot}, así que la tabla sigue siendo la mejor vista para ordenar esta cola.`;
            recommendation =
                'Abre la tabla filtrada por este ticket para revisar su posición exacta antes de llamarlo o moverlo.';
        }
        pushSecondaryAction('assign', `Mover a C${slot === 2 ? 1 : 2}`, {
            consultorio: slot === 2 ? 1 : 2,
        });
    } else if (status === 'completed') {
        panelState = 'ready';
        badge = 'Atención cerrada';
        headline = `${ticketCode} ya se completó`;
        detail =
            'El ticket ya cerró su flujo, pero puedes reimprimirlo o abrir la tabla si necesitas verificar el cierre.';
        recommendation =
            'Usa reimpresión solo si el paciente necesita respaldo físico del turno.';
        primaryAction = 'reprint';
        primaryLabel = `Reimprimir ${ticketCode}`;
    } else if (status === 'no_show') {
        panelState = 'warning';
        badge = 'No show registrado';
        headline = `${ticketCode} quedó como no show`;
        detail =
            'La ausencia ya fue registrada. Reimprime o abre la tabla si necesitas revisar el historial inmediato.';
        recommendation =
            'Si fue un error operativo, revisa el flujo desde la tabla antes de volver a tocar este ticket.';
        primaryAction = 'reprint';
        primaryLabel = `Reimprimir ${ticketCode}`;
    } else if (status === 'cancelled') {
        panelState = 'idle';
        badge = 'Cancelado';
        headline = `${ticketCode} quedó cancelado`;
        detail =
            'Este ticket ya salió de la cola. Usa la tabla si necesitas validar el motivo o seguir con otro turno.';
        recommendation =
            'No hay una acción operativa inmediata sobre este ticket desde el hub.';
    }

    if (slot > 0 && primaryAction !== 'open') {
        pushSecondaryAction('open', `Operador C${slot}`, {
            consultorio: slot,
        });
    }
    pushSecondaryAction('table', 'Ver en tabla');

    return {
        ticketId: Number(ticket.id || 0),
        ticketCode,
        panelState,
        badge,
        headline,
        detail,
        recommendation,
        pendingCopy,
        statusCopy,
        ageLabel,
        priorityLabel,
        patientLabel,
        consultorio: slot,
        operatorUrl,
        primaryAction,
        primaryLabel,
        primaryConsultorio,
        secondaryActions,
    };
}

function buildQueueTicketLookup(manifest, detectedPlatform) {
    const term = getQueueTicketLookupTerm();
    const matches = term ? getQueueTicketLookupMatches(term, 4) : [];
    const result = matches[0]
        ? buildQueueTicketLookupResult(matches[0], manifest, detectedPlatform)
        : null;
    const suggestions = (
        term ? matches.slice(1) : getQueueTicketLookupSuggestions(4)
    )
        .map((ticket) => ({
            id: Number(ticket?.id || 0),
            ticketCode: String(ticket?.ticketCode || ''),
            label: getQueueTicketLookupStatusCopy(ticket),
        }))
        .filter((ticket) => ticket.id > 0 && ticket.ticketCode);

    if (!term) {
        return {
            title: 'Atajo por ticket listo',
            summary:
                'Escribe un ticket para encontrarlo aunque no esté en la vista actual y resolverlo desde el hub sin bajar a la tabla.',
            statusLabel: suggestions.length
                ? `${suggestions.length} ticket(s) sugerido(s)`
                : 'Sin sugerencias ahora',
            statusState: suggestions.length ? 'ready' : 'idle',
            term,
            result,
            suggestions,
        };
    }

    if (!result) {
        return {
            title: 'Atajo por ticket sin coincidencias',
            summary:
                'No encontramos ese ticket en la cola actual. Revisa el código o limpia la búsqueda para volver a las sugerencias vivas.',
            statusLabel: 'Sin coincidencias',
            statusState: 'warning',
            term,
            result: null,
            suggestions,
        };
    }

    return {
        title: `${result.ticketCode} localizado`,
        summary:
            result.panelState === 'alert'
                ? 'Este ticket ya tiene una acción sensible pendiente y el hub la deja visible para cerrar rápido.'
                : 'El hub encontró el ticket y te deja su próxima acción útil sin abrir la tabla completa.',
        statusLabel:
            matches.length > 1
                ? `${matches.length} coincidencias · 1 activa`
                : 'Coincidencia directa',
        statusState: result.panelState,
        term,
        result,
        suggestions,
    };
}

function describeQueueTicketLookupAction(result, actionKind, consultorio = 0) {
    const slotLabel =
        Number(consultorio || result?.consultorio || 0) === 2 ? 'C2' : 'C1';
    const ticketCode = String(result?.ticketCode || 'ticket');
    if (actionKind === 'assign') {
        return {
            title: `Atajo por ticket: reasignado a ${slotLabel}`,
            summary: `${ticketCode} se reasignó a ${slotLabel} desde el hub.`,
        };
    }
    if (actionKind === 'call') {
        return {
            title: `Atajo por ticket: llamado rápido`,
            summary: `${ticketCode} se llamó desde el atajo del hub.`,
        };
    }
    if (actionKind === 'complete') {
        return {
            title: `Atajo por ticket: ticket completado`,
            summary: `${ticketCode} se completó desde el hub.`,
        };
    }
    if (actionKind === 'recall') {
        return {
            title: `Atajo por ticket: re-llamado`,
            summary: `${ticketCode} se re-llamó en ${slotLabel} desde el hub.`,
        };
    }
    if (actionKind === 'no_show') {
        return {
            title: `Atajo por ticket: no show pendiente`,
            summary: `${ticketCode} quedó listo para confirmar no show desde el hub.`,
        };
    }
    if (actionKind === 'release') {
        return {
            title: `Atajo por ticket: ticket liberado`,
            summary: `${ticketCode} volvió a la cola general desde el hub.`,
        };
    }
    if (actionKind === 'open') {
        return {
            title: `Atajo por ticket: operador abierto`,
            summary: `Se abrió Operador ${slotLabel} desde el hub.`,
        };
    }
    if (actionKind === 'table') {
        return {
            title: `Atajo por ticket: tabla filtrada`,
            summary: `La tabla quedó enfocada en ${ticketCode}.`,
        };
    }
    if (actionKind === 'reprint') {
        return {
            title: `Atajo por ticket: reimpresión`,
            summary: `${ticketCode} se reimprimió desde el hub.`,
        };
    }
    if (actionKind === 'confirm') {
        return {
            title: `Atajo por ticket: confirmación aplicada`,
            summary: `${ticketCode} confirmó su acción sensible desde el hub.`,
        };
    }
    return {
        title: `Atajo por ticket: confirmación cancelada`,
        summary: `${ticketCode} canceló su acción sensible desde el hub.`,
    };
}

async function runQueueTicketLookupAction(
    result,
    actionKind,
    manifest,
    detectedPlatform,
    options = {}
) {
    if (!result || !actionKind || actionKind === 'none') {
        return;
    }

    const targetConsultorio =
        Number(
            options.consultorio ||
                result.primaryConsultorio ||
                result.consultorio ||
                0
        ) || 0;

    try {
        const {
            callNextForConsultorio,
            cancelQueueSensitiveAction,
            confirmQueueSensitiveAction,
            reprintQueueTicket,
            runQueueTicketAction,
        } = await import('../../actions.js');
        if (
            actionKind === 'assign' &&
            result.ticketId > 0 &&
            targetConsultorio > 0
        ) {
            await runQueueTicketAction(
                result.ticketId,
                'reasignar',
                targetConsultorio
            );
        } else if (actionKind === 'call' && targetConsultorio > 0) {
            await callNextForConsultorio(targetConsultorio);
        } else if (actionKind === 'complete' && result.ticketId > 0) {
            await runQueueTicketAction(result.ticketId, 'completar');
        } else if (
            actionKind === 'recall' &&
            result.ticketId > 0 &&
            targetConsultorio > 0
        ) {
            await runQueueTicketAction(
                result.ticketId,
                're-llamar',
                targetConsultorio
            );
        } else if (
            actionKind === 'no_show' &&
            result.ticketId > 0 &&
            targetConsultorio > 0
        ) {
            await runQueueTicketAction(
                result.ticketId,
                'no_show',
                targetConsultorio
            );
            if (getState().queue.pendingSensitiveAction) {
                hideSensitiveDialogVisualOnly();
            }
        } else if (actionKind === 'release' && result.ticketId > 0) {
            await runQueueTicketAction(result.ticketId, 'liberar');
        } else if (actionKind === 'open' && result.operatorUrl) {
            window.open(result.operatorUrl, '_blank', 'noopener');
        } else if (actionKind === 'table' && result.ticketCode) {
            const { setQueueFilter, setQueueSearch } =
                await import('../../state.js');
            appendOpsLogEntry({
                source: 'ticket_lookup',
                tone: 'info',
                ...describeQueueTicketLookupAction(result, actionKind),
            });
            setQueueFilter('all');
            setQueueSearch(result.ticketCode);
            requestAnimationFrame(() => {
                const input = document.getElementById('queueSearchInput');
                if (input instanceof HTMLInputElement) {
                    input.focus();
                    input.select();
                }
            });
            return;
        } else if (actionKind === 'reprint' && result.ticketId > 0) {
            await reprintQueueTicket(result.ticketId);
        } else if (actionKind === 'confirm') {
            await confirmQueueSensitiveAction();
        } else if (actionKind === 'cancel') {
            cancelQueueSensitiveAction();
        } else {
            return;
        }

        appendOpsLogEntry({
            source: 'ticket_lookup',
            tone:
                actionKind === 'complete'
                    ? 'success'
                    : actionKind === 'cancel' || actionKind === 'release'
                      ? 'warning'
                      : 'info',
            ...describeQueueTicketLookupAction(
                result,
                actionKind,
                targetConsultorio
            ),
        });
    } catch (_error) {
        createToast('No se pudo ejecutar el atajo por ticket', 'error');
    } finally {
        rerenderQueueOpsHub(manifest, detectedPlatform);
    }
}

function renderQueueTicketLookup(manifest, detectedPlatform) {
    const root = document.getElementById('queueTicketLookup');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueTicketLookup(manifest, detectedPlatform);
    setHtml(
        '#queueTicketLookup',
        `
            <section class="queue-ticket-lookup__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-ticket-lookup__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Atajo por ticket</p>
                        <h5 id="queueTicketLookupTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueTicketLookupSummary" class="queue-ticket-lookup__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <span
                        id="queueTicketLookupStatus"
                        class="queue-ticket-lookup__status"
                        data-state="${escapeHtml(deck.statusState)}"
                    >
                        ${escapeHtml(deck.statusLabel)}
                    </span>
                </div>
                <div class="queue-ticket-lookup__controls">
                    <label class="queue-ticket-lookup__field" for="queueTicketLookupInput">
                        <span>Buscar ticket</span>
                        <input
                            id="queueTicketLookupInput"
                            type="search"
                            value="${escapeHtml(deck.term)}"
                            placeholder="Ej. A-1520"
                            autocomplete="off"
                            spellcheck="false"
                        />
                    </label>
                    <div class="queue-ticket-lookup__control-actions">
                        <button
                            id="queueTicketLookupSearchBtn"
                            type="button"
                            class="queue-ticket-lookup__action queue-ticket-lookup__action--primary"
                        >
                            Buscar
                        </button>
                        <button
                            id="queueTicketLookupClearBtn"
                            type="button"
                            class="queue-ticket-lookup__action"
                            ${deck.term ? '' : 'disabled'}
                        >
                            Limpiar
                        </button>
                    </div>
                </div>
                ${
                    deck.suggestions.length
                        ? `
                            <div id="queueTicketLookupSuggestions" class="queue-ticket-lookup__suggestions" role="list" aria-label="Tickets sugeridos">
                                ${deck.suggestions
                                    .map(
                                        (ticket, index) => `
                                            <button
                                                id="queueTicketLookupSuggestion_${escapeHtml(
                                                    String(index)
                                                )}"
                                                type="button"
                                                class="queue-ticket-lookup__suggestion"
                                                data-queue-ticket-lookup-suggestion="${escapeHtml(
                                                    ticket.ticketCode
                                                )}"
                                                role="listitem"
                                            >
                                                <strong>${escapeHtml(
                                                    ticket.ticketCode
                                                )}</strong>
                                                <span>${escapeHtml(
                                                    ticket.label
                                                )}</span>
                                            </button>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : ''
                }
                ${
                    deck.result
                        ? `
                            <article
                                id="queueTicketLookupResult"
                                class="queue-ticket-lookup__result"
                                data-state="${escapeHtml(deck.result.panelState)}"
                            >
                                <div class="queue-ticket-lookup__result-header">
                                    <div>
                                        <p id="queueTicketLookupMatchCode" class="queue-ticket-lookup__match-code">${escapeHtml(
                                            deck.result.ticketCode
                                        )}</p>
                                        <p id="queueTicketLookupHeadline" class="queue-ticket-lookup__headline">${escapeHtml(
                                            deck.result.headline
                                        )}</p>
                                    </div>
                                    <span id="queueTicketLookupBadge" class="queue-ticket-lookup__badge">${escapeHtml(
                                        deck.result.badge
                                    )}</span>
                                </div>
                                ${
                                    deck.result.pendingCopy
                                        ? `
                                            <div id="queueTicketLookupPending" class="queue-ticket-lookup__pending">
                                                <strong>Confirmación pendiente</strong>
                                                <p>${escapeHtml(
                                                    deck.result.pendingCopy
                                                )}</p>
                                            </div>
                                        `
                                        : ''
                                }
                                <p id="queueTicketLookupDetail" class="queue-ticket-lookup__detail">${escapeHtml(
                                    deck.result.detail
                                )}</p>
                                <div class="queue-ticket-lookup__chips">
                                    <span class="queue-ticket-lookup__chip">${escapeHtml(
                                        deck.result.statusCopy
                                    )}</span>
                                    <span class="queue-ticket-lookup__chip">${escapeHtml(
                                        deck.result.ageLabel
                                    )}</span>
                                    <span class="queue-ticket-lookup__chip">${escapeHtml(
                                        deck.result.priorityLabel
                                    )}</span>
                                    <span class="queue-ticket-lookup__chip">${escapeHtml(
                                        deck.result.patientLabel
                                    )}</span>
                                </div>
                                <p id="queueTicketLookupRecommendation" class="queue-ticket-lookup__recommendation">${escapeHtml(
                                    deck.result.recommendation
                                )}</p>
                                <div class="queue-ticket-lookup__actions">
                                    <button
                                        id="queueTicketLookupPrimary"
                                        type="button"
                                        class="queue-ticket-lookup__action queue-ticket-lookup__action--primary"
                                        data-queue-ticket-lookup-action="${escapeHtml(
                                            deck.result.primaryAction
                                        )}"
                                        data-queue-ticket-lookup-consultorio="${escapeHtml(
                                            String(
                                                deck.result
                                                    .primaryConsultorio || 0
                                            )
                                        )}"
                                    >
                                        ${escapeHtml(deck.result.primaryLabel)}
                                    </button>
                                    ${deck.result.secondaryActions
                                        .map(
                                            (action, index) => `
                                                <button
                                                    id="queueTicketLookupSecondary_${escapeHtml(
                                                        String(index)
                                                    )}"
                                                    type="button"
                                                    class="queue-ticket-lookup__action"
                                                    data-queue-ticket-lookup-action="${escapeHtml(
                                                        action.kind
                                                    )}"
                                                    data-queue-ticket-lookup-consultorio="${escapeHtml(
                                                        String(
                                                            action.consultorio ||
                                                                0
                                                        )
                                                    )}"
                                                >
                                                    ${escapeHtml(action.label)}
                                                </button>
                                            `
                                        )
                                        .join('')}
                                </div>
                            </article>
                        `
                        : `
                            <article
                                id="queueTicketLookupEmpty"
                                class="queue-ticket-lookup__empty"
                                data-state="${escapeHtml(deck.statusState)}"
                            >
                                <strong>${escapeHtml(deck.title)}</strong>
                                <p>${escapeHtml(deck.summary)}</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const input = document.getElementById('queueTicketLookupInput');
    const searchButton = document.getElementById('queueTicketLookupSearchBtn');
    const clearButton = document.getElementById('queueTicketLookupClearBtn');
    const submitLookup = () => {
        const nextTerm =
            input instanceof HTMLInputElement ? input.value : deck.term;
        persistQueueTicketLookupTerm(nextTerm);
        rerenderQueueOpsHub(manifest, detectedPlatform);
    };

    if (input instanceof HTMLInputElement) {
        input.onkeydown = (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                submitLookup();
            } else if (event.key === 'Escape' && input.value) {
                event.preventDefault();
                input.value = '';
                persistQueueTicketLookupTerm('');
                rerenderQueueOpsHub(manifest, detectedPlatform);
            }
        };
    }

    if (searchButton instanceof HTMLButtonElement) {
        searchButton.onclick = submitLookup;
    }

    if (clearButton instanceof HTMLButtonElement) {
        clearButton.onclick = () => {
            persistQueueTicketLookupTerm('');
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-ticket-lookup-suggestion]').forEach(
        (button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }
            button.onclick = () => {
                persistQueueTicketLookupTerm(
                    button.dataset.queueTicketLookupSuggestion || ''
                );
                rerenderQueueOpsHub(manifest, detectedPlatform);
            };
        }
    );

    root.querySelectorAll('[data-queue-ticket-lookup-action]').forEach(
        (button) => {
            if (!(button instanceof HTMLButtonElement) || !deck.result) {
                return;
            }
            button.onclick = async () => {
                button.disabled = true;
                await runQueueTicketLookupAction(
                    deck.result,
                    button.dataset.queueTicketLookupAction || '',
                    manifest,
                    detectedPlatform,
                    {
                        consultorio: Number(
                            button.dataset.queueTicketLookupConsultorio || 0
                        ),
                    }
                );
            };
        }
    );
}

function buildQueueTicketRoutePivot(ticket, label, detail = '') {
    const ticketCode = String(ticket?.ticketCode || '').trim();
    const ticketId = Number(ticket?.id || 0);
    if (!ticketId || !ticketCode) {
        return null;
    }
    return {
        ticketId,
        ticketCode,
        label,
        detail,
    };
}

function copyQueueTicketRoute(route) {
    if (!route || !route.result) {
        return Promise.resolve();
    }
    const pivotLines = route.pivots.length
        ? route.pivots.map(
              (pivot, index) => `${index + 1}. ${pivot.label} - ${pivot.detail}`
          )
        : ['Sin pivotes relacionados disponibles.'];
    const report = [
        `${route.title} - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${route.statusLabel}`,
        `Carril: ${route.laneLabel}`,
        `Posición: ${route.positionLabel}`,
        `Presión: ${route.pressureLabel}`,
        `Impacto: ${route.impactLabel}`,
        'Pivotes:',
        ...pivotLines,
    ].join('\n');

    return navigator.clipboard
        .writeText(report)
        .then(() => createToast('Ruta copiada', 'success'))
        .catch(() => createToast('No se pudo copiar la ruta', 'error'));
}

function buildQueueTicketRoute(manifest, detectedPlatform) {
    const lookup = buildQueueTicketLookup(manifest, detectedPlatform);
    const result = lookup.result;
    if (!result) {
        return {
            title: 'Ruta del ticket en espera',
            summary:
                lookup.term && !lookup.result
                    ? 'No hay una coincidencia activa para construir una ruta. Ajusta el ticket o limpia la búsqueda.'
                    : 'Busca un ticket para ver su carril real, la presión alrededor y a qué turno conviene saltar después.',
            statusLabel: lookup.term
                ? 'Sin ruta disponible'
                : 'Sin ticket cargado',
            statusState: lookup.term ? 'warning' : 'idle',
            result: null,
            pivots: [],
            laneLabel: 'Sin ticket seleccionado',
            positionLabel: 'Sin posición visible',
            pressureLabel: 'Sin presión calculada',
            impactLabel:
                'El panel se activa cuando el lookup encuentra un ticket real en la cola.',
        };
    }

    const ticket = getQueueTicketById(result.ticketId);
    if (!ticket) {
        return {
            title: 'Ruta del ticket sin snapshot',
            summary:
                'El ticket ya no está en el estado local. Refresca la cola o vuelve a buscarlo para reconstruir la ruta.',
            statusLabel: 'Snapshot vencido',
            statusState: 'warning',
            result: null,
            pivots: [],
            laneLabel: 'Sin snapshot',
            positionLabel: 'Desconocida',
            pressureLabel: 'Refresca la cola',
            impactLabel: 'No se pudo reconstruir el contexto del ticket.',
        };
    }

    const status = String(ticket.status || '')
        .trim()
        .toLowerCase();
    const consultorio = Number(ticket.assignedConsultorio || 0);
    const slot = consultorio === 2 ? 2 : consultorio === 1 ? 1 : 0;
    const ticketCode = String(ticket.ticketCode || 'ticket');
    const generalWaiting = getUnassignedWaitingTickets();
    const totalWaiting = getSortedWaitingTickets();
    const laneWaiting =
        slot > 0 ? getAssignedWaitingTickets(slot) : generalWaiting;
    const laneIndex = laneWaiting.findIndex(
        (item) => Number(item.id || 0) === Number(ticket.id || 0)
    );
    const previousWaiting = laneIndex > 0 ? laneWaiting[laneIndex - 1] : null;
    const nextWaiting =
        laneIndex >= 0 && laneIndex < laneWaiting.length - 1
            ? laneWaiting[laneIndex + 1]
            : null;
    const currentCalled = slot > 0 ? getCalledTicketForConsultorio(slot) : null;
    const oldestGeneral = generalWaiting[0] || null;
    const pivots = [];

    let title = `Ruta de ${ticketCode}`;
    let summary =
        'Este panel resume el carril real del ticket y los pivotes más útiles alrededor.';
    let statusLabel = 'Ruta preparada';
    let statusState = result.panelState;
    let laneLabel = slot > 0 ? `C${slot}` : 'Cola general';
    let positionLabel = 'Sin posición visible';
    let pressureLabel = `${totalWaiting.length} ticket(s) esperando`;
    let impactLabel = 'Sin impacto inmediato calculado.';

    const pushPivot = (pivot) => {
        if (!pivot) {
            return;
        }
        if (pivots.some((item) => item.ticketId === pivot.ticketId)) {
            return;
        }
        pivots.push(pivot);
    };

    if (status === 'called' && slot > 0) {
        const behindCount = laneWaiting.length;
        laneLabel = `C${slot} · ticket activo`;
        positionLabel = 'Paciente en atención ahora';
        pressureLabel =
            behindCount > 0
                ? `${behindCount} ticket(s) detrás en C${slot}`
                : `Sin espera detrás en C${slot}`;
        impactLabel = nextWaiting
            ? `Si ${ticketCode} cierra ahora, ${nextWaiting.ticketCode} queda listo para llamado en C${slot}.`
            : `Si ${ticketCode} cierra ahora, C${slot} queda libre y la presión vuelve a recepción.`;
        summary =
            behindCount > 0
                ? `${ticketCode} está reteniendo la cola de C${slot}; conviene tener a la vista el siguiente turno y el fallback general.`
                : `${ticketCode} es el único ticket activo en C${slot} y no tiene cola inmediata detrás.`;
        statusLabel =
            behindCount > 0
                ? `${behindCount} ticket(s) esperando detrás`
                : 'Sin cola detrás';
        pushPivot(
            buildQueueTicketRoutePivot(
                nextWaiting,
                `Ver siguiente ${String(nextWaiting?.ticketCode || '')}`,
                `Es el próximo turno listo detrás de ${ticketCode}.`
            )
        );
        pushPivot(
            buildQueueTicketRoutePivot(
                oldestGeneral,
                `Ver general ${String(oldestGeneral?.ticketCode || '')}`,
                'Es el ticket más antiguo que todavía no tiene consultorio.'
            )
        );
    } else if (status === 'waiting' && slot > 0) {
        const blockingSteps = Math.max(0, laneIndex + (currentCalled ? 1 : 0));
        laneLabel = `C${slot} · cola asignada`;
        positionLabel =
            blockingSteps <= 0
                ? 'Listo para llamado'
                : `${blockingSteps} paso(s) por delante`;
        pressureLabel = `${laneWaiting.length} ticket(s) esperando en C${slot}`;
        if (currentCalled && laneIndex <= 0) {
            impactLabel = nextWaiting
                ? `${currentCalled.ticketCode} atiende ahora; cuando cierre, ${ticketCode} queda primero y ${nextWaiting.ticketCode} sigue detrás.`
                : `${currentCalled.ticketCode} atiende ahora; cuando cierre, ${ticketCode} queda primero en C${slot}.`;
            pushPivot(
                buildQueueTicketRoutePivot(
                    currentCalled,
                    `Ver ticket activo ${currentCalled.ticketCode}`,
                    `Es el bloqueo inmediato antes de ${ticketCode}.`
                )
            );
        } else if (currentCalled) {
            impactLabel = `${currentCalled.ticketCode} atiende ahora y ${
                previousWaiting?.ticketCode || 'otro ticket'
            } sigue antes que ${ticketCode} en C${slot}.`;
            pushPivot(
                buildQueueTicketRoutePivot(
                    previousWaiting,
                    `Ver anterior ${String(previousWaiting?.ticketCode || '')}`,
                    `Va antes que ${ticketCode} dentro del carril C${slot}.`
                )
            );
        } else if (previousWaiting) {
            impactLabel = `${previousWaiting.ticketCode} sigue antes en C${slot}; ${ticketCode} no debería llamarse hasta que ese turno avance.`;
            pushPivot(
                buildQueueTicketRoutePivot(
                    previousWaiting,
                    `Ver anterior ${previousWaiting.ticketCode}`,
                    `Va antes que ${ticketCode} en la cola asignada.`
                )
            );
        } else {
            impactLabel = `${ticketCode} ya es el siguiente turno útil de C${slot} y puede llamarse desde el lookup o el operador.`;
        }
        pushPivot(
            buildQueueTicketRoutePivot(
                nextWaiting,
                `Ver siguiente ${String(nextWaiting?.ticketCode || '')}`,
                `Quedará detrás de ${ticketCode} cuando esta misma cola avance.`
            )
        );
        statusLabel =
            blockingSteps <= 0
                ? 'Siguiente listo'
                : `${blockingSteps} paso(s) antes de llamarlo`;
        summary =
            blockingSteps <= 1
                ? `${ticketCode} ya está muy cerca de la cabecera de C${slot}.`
                : `${ticketCode} sigue dentro de una cola asignada y conviene revisar el bloqueo inmediato antes de moverlo.`;
    } else if (status === 'waiting') {
        const generalIndex = generalWaiting.findIndex(
            (item) => Number(item.id || 0) === Number(ticket.id || 0)
        );
        const aheadCount = generalIndex > 0 ? generalIndex : 0;
        const preferred = pickQueueTicketLookupConsultorio(
            manifest,
            detectedPlatform
        );
        laneLabel = 'Cola general · sin consultorio';
        positionLabel =
            aheadCount === 0
                ? 'Primero sin consultorio'
                : `${aheadCount} ticket(s) por delante`;
        pressureLabel = `${generalWaiting.length} ticket(s) en cola general`;
        impactLabel =
            preferred.readinessScore === 0
                ? `Si lo reasignas a C${preferred.slot}, ${ticketCode} sale de recepción y entra a un consultorio con operador vivo.`
                : `El desvío natural es C${preferred.slot}, pero todavía conviene validar ese operador antes del llamado.`;
        statusLabel =
            aheadCount === 0 ? 'Cabecera general' : `${aheadCount} delante`;
        summary =
            aheadCount === 0
                ? `${ticketCode} ya lidera la cola sin consultorio y es buen candidato a despacho inmediato.`
                : `${ticketCode} sigue esperando en recepción y todavía tiene otros turnos generales delante.`;
        pushPivot(
            buildQueueTicketRoutePivot(
                previousWaiting,
                `Ver anterior ${String(previousWaiting?.ticketCode || '')}`,
                `Va antes que ${ticketCode} en la cola general.`
            )
        );
        pushPivot(
            buildQueueTicketRoutePivot(
                nextWaiting,
                `Ver siguiente ${String(nextWaiting?.ticketCode || '')}`,
                `Queda detrás de ${ticketCode} en la cola general.`
            )
        );
        pushPivot(
            buildQueueTicketRoutePivot(
                getCalledTicketForConsultorio(preferred.slot),
                `Ver activo C${preferred.slot}`,
                `Es el ticket que hoy bloquea el consultorio sugerido para ${ticketCode}.`
            )
        );
    } else {
        const laneCurrent =
            slot > 0 ? getCalledTicketForConsultorio(slot) : null;
        const laneNext =
            slot > 0 ? getWaitingForConsultorio(slot) : oldestGeneral;
        laneLabel =
            status === 'completed'
                ? 'Ruta cerrada · completado'
                : status === 'no_show'
                  ? 'Ruta cerrada · no show'
                  : 'Ruta cerrada · cancelado';
        positionLabel = result.statusCopy;
        pressureLabel =
            slot > 0
                ? `C${slot} sigue operando en vivo`
                : 'Recepción sigue operando en vivo';
        impactLabel = laneCurrent
            ? `${ticketCode} ya no afecta la cola; ahora el foco está en ${laneCurrent.ticketCode}.`
            : laneNext
              ? `${ticketCode} ya cerró. El siguiente pivote útil quedó en ${laneNext.ticketCode}.`
              : `${ticketCode} ya cerró y no deja una presión inmediata visible en este carril.`;
        summary =
            'La ruta de este ticket ya terminó; el panel salta al turno vivo más cercano para no perder continuidad operativa.';
        statusLabel = 'Ruta cerrada';
        pushPivot(
            buildQueueTicketRoutePivot(
                laneCurrent,
                `Ver activo ${String(laneCurrent?.ticketCode || '')}`,
                'Es el turno vivo más cercano dentro del mismo carril.'
            )
        );
        pushPivot(
            buildQueueTicketRoutePivot(
                laneNext,
                `Ver siguiente ${String(laneNext?.ticketCode || '')}`,
                'Es el siguiente turno útil relacionado con este carril.'
            )
        );
    }

    return {
        title,
        summary,
        statusLabel,
        statusState,
        result,
        laneLabel,
        positionLabel,
        pressureLabel,
        impactLabel,
        pivots: pivots.slice(0, 2),
    };
}

function renderQueueTicketRoute(manifest, detectedPlatform) {
    const root = document.getElementById('queueTicketRoute');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const route = buildQueueTicketRoute(manifest, detectedPlatform);
    setHtml(
        '#queueTicketRoute',
        `
            <section class="queue-ticket-route__shell" data-state="${escapeHtml(
                route.statusState
            )}">
                <div class="queue-ticket-route__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Ruta del ticket</p>
                        <h5 id="queueTicketRouteTitle" class="queue-app-card__title">${escapeHtml(
                            route.title
                        )}</h5>
                        <p id="queueTicketRouteSummary" class="queue-ticket-route__summary">${escapeHtml(
                            route.summary
                        )}</p>
                    </div>
                    <div class="queue-ticket-route__meta">
                        <span
                            id="queueTicketRouteStatus"
                            class="queue-ticket-route__status"
                            data-state="${escapeHtml(route.statusState)}"
                        >
                            ${escapeHtml(route.statusLabel)}
                        </span>
                        <button
                            id="queueTicketRouteCopyBtn"
                            type="button"
                            class="queue-ticket-route__action"
                            ${route.result ? '' : 'disabled'}
                        >
                            Copiar ruta
                        </button>
                    </div>
                </div>
                ${
                    route.result
                        ? `
                            <div class="queue-ticket-route__grid">
                                <article class="queue-ticket-route__fact">
                                    <span>Carril</span>
                                    <strong id="queueTicketRouteLane">${escapeHtml(
                                        route.laneLabel
                                    )}</strong>
                                </article>
                                <article class="queue-ticket-route__fact">
                                    <span>Posición</span>
                                    <strong id="queueTicketRoutePosition">${escapeHtml(
                                        route.positionLabel
                                    )}</strong>
                                </article>
                                <article class="queue-ticket-route__fact">
                                    <span>Presión</span>
                                    <strong id="queueTicketRoutePressure">${escapeHtml(
                                        route.pressureLabel
                                    )}</strong>
                                </article>
                                <article class="queue-ticket-route__fact queue-ticket-route__fact--wide">
                                    <span>Impacto</span>
                                    <strong id="queueTicketRouteImpact">${escapeHtml(
                                        route.impactLabel
                                    )}</strong>
                                </article>
                            </div>
                            <div class="queue-ticket-route__actions">
                                <button
                                    id="queueTicketRoutePivotPrimary"
                                    type="button"
                                    class="queue-ticket-route__action queue-ticket-route__action--primary"
                                    ${route.pivots[0] ? '' : 'disabled'}
                                >
                                    ${escapeHtml(
                                        route.pivots[0]?.label ||
                                            'Sin pivote principal'
                                    )}
                                </button>
                                <button
                                    id="queueTicketRoutePivotSecondary"
                                    type="button"
                                    class="queue-ticket-route__action"
                                    ${route.pivots[1] ? '' : 'disabled'}
                                >
                                    ${escapeHtml(
                                        route.pivots[1]?.label ||
                                            'Sin pivote secundario'
                                    )}
                                </button>
                            </div>
                            <div class="queue-ticket-route__pivot-notes">
                                <p id="queueTicketRoutePivotDetailPrimary">${escapeHtml(
                                    route.pivots[0]?.detail ||
                                        'No hay otro ticket relacionado por cargar ahora.'
                                )}</p>
                                <p id="queueTicketRoutePivotDetailSecondary">${escapeHtml(
                                    route.pivots[1]?.detail ||
                                        'Cuando aparezca otro pivote útil, quedará disponible aquí.'
                                )}</p>
                            </div>
                        `
                        : `
                            <article
                                id="queueTicketRouteEmpty"
                                class="queue-ticket-route__empty"
                                data-state="${escapeHtml(route.statusState)}"
                            >
                                <strong>${escapeHtml(route.title)}</strong>
                                <p>${escapeHtml(route.summary)}</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueTicketRouteCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueTicketRoute(route);
        };
    }

    const primaryButton = document.getElementById(
        'queueTicketRoutePivotPrimary'
    );
    if (primaryButton instanceof HTMLButtonElement && route.pivots[0]) {
        primaryButton.onclick = () => {
            persistQueueTicketLookupTerm(route.pivots[0].ticketCode);
            appendOpsLogEntry({
                source: 'ticket_route',
                tone: 'info',
                title: `Ruta del ticket: pivote principal`,
                summary: `${route.pivots[0].ticketCode} quedó cargado desde la ruta de ${route.result.ticketCode}.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const secondaryButton = document.getElementById(
        'queueTicketRoutePivotSecondary'
    );
    if (secondaryButton instanceof HTMLButtonElement && route.pivots[1]) {
        secondaryButton.onclick = () => {
            persistQueueTicketLookupTerm(route.pivots[1].ticketCode);
            appendOpsLogEntry({
                source: 'ticket_route',
                tone: 'info',
                title: `Ruta del ticket: pivote secundario`,
                summary: `${route.pivots[1].ticketCode} quedó cargado desde la ruta de ${route.result.ticketCode}.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
}

function sortQueueWaitingLikeLane(tickets) {
    return [...(Array.isArray(tickets) ? tickets : [])].sort((left, right) => {
        const leftMs = getQueueTicketTimestampMs(left, 'waiting');
        const rightMs = getQueueTicketTimestampMs(right, 'waiting');
        if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
            return leftMs - rightMs;
        }
        if (Number.isFinite(leftMs)) {
            return -1;
        }
        if (Number.isFinite(rightMs)) {
            return 1;
        }
        return Number(left?.id || 0) - Number(right?.id || 0);
    });
}

function copyQueueTicketSimulation(simulation) {
    if (!simulation || !simulation.result) {
        return Promise.resolve();
    }
    const lines = [
        `${simulation.title} - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${simulation.statusLabel}`,
        `Antes: ${simulation.beforeLabel}`,
        `Acción: ${simulation.actionLabel}`,
        `Después: ${simulation.afterLabel}`,
        `Riesgo: ${simulation.riskLabel}`,
        `Siguiente foco: ${simulation.focusLabel}`,
        simulation.focusDetail,
    ];
    return navigator.clipboard
        .writeText(lines.join('\n'))
        .then(() => createToast('Simulación copiada', 'success'))
        .catch(() => createToast('No se pudo copiar la simulación', 'error'));
}

function buildQueueTicketSimulation(manifest, detectedPlatform) {
    const lookup = buildQueueTicketLookup(manifest, detectedPlatform);
    const result = lookup.result;
    if (!result) {
        return {
            title: 'Simulación operativa en espera',
            summary:
                lookup.term && !lookup.result
                    ? 'No hay una coincidencia activa para simular. Ajusta el ticket o limpia la búsqueda para volver a intentarlo.'
                    : 'Busca un ticket para proyectar el efecto de su siguiente acción útil antes de tocar la cola real.',
            statusLabel: lookup.term
                ? 'Sin simulación disponible'
                : 'Sin ticket cargado',
            statusState: lookup.term ? 'warning' : 'idle',
            result: null,
            beforeLabel: 'Sin ticket seleccionado',
            actionLabel: 'Sin acción',
            afterLabel: 'Sin proyección',
            riskLabel:
                'La simulación se activa cuando el lookup encuentra un ticket real.',
            focusLabel: 'Sin foco siguiente',
            focusDetail: 'No hay pivote operativo calculado todavía.',
            focusPivot: null,
        };
    }

    const simulationContext = getQueueTicketSimulationContext(
        getQueueTicketLookupTerm()
    );
    const simulationTickets = Array.isArray(simulationContext?.tickets)
        ? simulationContext.tickets
              .map(cloneQueueTicketSnapshot)
              .filter(Boolean)
        : getQueueSource()
              .queueTickets.map(cloneQueueTicketSnapshot)
              .filter(Boolean);
    const baseQueueTickets = simulationTickets
        .map(cloneQueueTicketSnapshot)
        .filter(Boolean);
    const ticket =
        getQueueTicketByIdFromList(simulationTickets, result.ticketId) ||
        getQueueTicketById(result.ticketId);
    if (!ticket) {
        return {
            title: 'Simulación sin snapshot',
            summary:
                'El ticket ya no está en el estado local. Refresca la cola o vuelve a buscarlo antes de proyectar el siguiente paso.',
            statusLabel: 'Snapshot vencido',
            statusState: 'warning',
            result: null,
            beforeLabel: 'Sin snapshot',
            actionLabel: result.primaryLabel,
            afterLabel: 'Sin proyección',
            riskLabel: 'Refresca la cola para reconstruir la simulación.',
            focusLabel: 'Sin foco siguiente',
            focusDetail: 'No se pudo reconstruir el contexto del ticket.',
            focusPivot: null,
        };
    }

    const status = String(ticket.status || '')
        .trim()
        .toLowerCase();
    const statusCopy = getQueueTicketLookupStatusCopy(ticket);
    const ageMode = status === 'called' ? 'called' : 'waiting';
    const ageLabel =
        status === 'waiting' || status === 'called'
            ? formatQueueTicketAgeLabel(ticket, ageMode)
            : `Último estado · ${statusCopy}`;
    const consultorio = Number(ticket.assignedConsultorio || 0);
    const slot = consultorio === 2 ? 2 : consultorio === 1 ? 1 : 0;
    const ticketCode = String(ticket.ticketCode || 'ticket');
    const pendingAction = getState().queue.pendingSensitiveAction;
    const pendingForTicket =
        !simulationContext &&
        Number(pendingAction?.ticketId || 0) === Number(ticket.id || 0)
            ? pendingAction
            : null;
    const generalWaiting =
        getUnassignedWaitingTicketsFromList(simulationTickets);
    const laneWaiting =
        slot > 0
            ? getAssignedWaitingTicketsFromList(simulationTickets, slot)
            : generalWaiting;
    const laneIndex = laneWaiting.findIndex(
        (item) => Number(item.id || 0) === Number(ticket.id || 0)
    );
    const currentCalled =
        slot > 0
            ? getCalledTicketForConsultorioFromList(simulationTickets, slot)
            : null;

    let title = `Simulación de ${ticketCode}`;
    let summary = simulationContext
        ? `Secuencia encadenada desde ${simulationContext.sourceTicketCode || 'la simulación previa'} para ver el siguiente paso sin tocar la cola real todavía.`
        : 'Este bloque proyecta el siguiente efecto útil sobre la cola antes de ejecutar la acción real.';
    let statusLabel = simulationContext
        ? 'Secuencia simulada'
        : 'Simulación lista';
    let statusState = simulationContext ? 'ready' : result.panelState;
    let beforeLabel = `${statusCopy} · ${ageLabel}`;
    let actionLabel = result.primaryLabel;
    let afterLabel = 'Sin proyección calculada';
    let riskLabel = 'Sin riesgo inmediato calculado.';
    let focusLabel = 'Sin siguiente foco';
    let focusDetail = 'No quedó un pivote útil después de esta acción.';
    let focusPivot = null;
    let projectedTickets = null;

    const setFocusPivot = (pivot, fallbackLabel, fallbackDetail) => {
        if (pivot) {
            focusPivot = pivot;
            focusLabel = pivot.label;
            focusDetail = pivot.detail;
            return;
        }
        focusPivot = null;
        focusLabel = fallbackLabel;
        focusDetail = fallbackDetail;
    };

    if (pendingForTicket) {
        const pendingCopy = getQueuePendingActionCopy(pendingForTicket, ticket);
        const pendingSlot =
            Number(pendingForTicket.consultorio || 0) === 2 ? 2 : 1;
        const pendingActionName = String(pendingForTicket.action || '')
            .trim()
            .toLowerCase();
        projectedTickets = baseQueueTickets.map((item) =>
            Number(item.id || 0) === Number(ticket.id || 0)
                ? {
                      ...item,
                      status:
                          pendingActionName === 'no_show'
                              ? 'no_show'
                              : pendingActionName === 'completar'
                                ? 'completed'
                                : String(item.status || 'waiting'),
                      assignedConsultorio:
                          pendingActionName === 'no_show' ||
                          pendingActionName === 'completar'
                              ? null
                              : item.assignedConsultorio,
                      completedAt:
                          pendingActionName === 'no_show' ||
                          pendingActionName === 'completar'
                              ? new Date().toISOString()
                              : item.completedAt,
                  }
                : item
        );
        const nextAssigned =
            getAssignedWaitingTicketsFromList(
                projectedTickets,
                pendingSlot
            )[0] || null;
        title = `Simulación retenida para ${ticketCode}`;
        summary =
            'Ya existe una acción sensible pendiente para este ticket. El siguiente cambio real depende de confirmarla o cancelarla.';
        statusLabel = 'Confirmación pendiente';
        statusState = 'alert';
        beforeLabel = `Pendiente · ${pendingCopy}`;
        actionLabel = `Confirmar ${pendingCopy}`;
        afterLabel =
            String(pendingForTicket.action || '')
                .trim()
                .toLowerCase() === 'no_show' ||
            String(pendingForTicket.action || '')
                .trim()
                .toLowerCase() === 'completar'
                ? nextAssigned
                    ? `${nextAssigned.ticketCode} queda primero en C${pendingSlot} tras confirmar.`
                    : `C${pendingSlot} queda libre tras confirmar.`
                : `${ticketCode} cambia de estado cuando confirmes la acción pendiente.`;
        riskLabel =
            'Mientras la confirmación siga pendiente, Enter y el flujo rápido del hub quedan tomados por esta acción sensible.';
        setFocusPivot(
            buildQueueTicketRoutePivot(
                nextAssigned,
                `Cargar ${String(nextAssigned?.ticketCode || '')}`,
                'Es el turno que quedaría primero después de confirmar la acción pendiente.'
            ),
            'Sin siguiente foco',
            'No hay otro ticket listo detrás de esta confirmación.'
        );
    } else if (status === 'called' && slot > 0) {
        projectedTickets = baseQueueTickets.map((item) =>
            Number(item.id || 0) === Number(ticket.id || 0)
                ? {
                      ...item,
                      status: 'completed',
                      assignedConsultorio: null,
                      completedAt: new Date().toISOString(),
                  }
                : item
        );
        const nextAssigned =
            getAssignedWaitingTicketsFromList(projectedTickets, slot)[0] ||
            null;
        const nextGeneral = generalWaiting[0] || null;
        const behindCount = getAssignedWaitingTicketsFromList(
            simulationTickets,
            slot
        ).length;
        beforeLabel = `${ticketCode} ocupa C${slot} · ${behindCount} detrás`;
        actionLabel = `Completar ${ticketCode}`;
        afterLabel = nextAssigned
            ? `${nextAssigned.ticketCode} queda listo en C${slot} cuando cierres ${ticketCode}.`
            : `C${slot} queda libre en cuanto cierres ${ticketCode}.`;
        riskLabel = nextAssigned
            ? `La cola de C${slot} depende de cerrar ${ticketCode}; detrás ya espera ${nextAssigned.ticketCode}.`
            : `No hay otro ticket asignado detrás, así que cerrar ${ticketCode} devuelve el foco a recepción.`;
        setFocusPivot(
            buildQueueTicketRoutePivot(
                nextAssigned || nextGeneral,
                `Cargar ${String(
                    (nextAssigned || nextGeneral)?.ticketCode || ''
                )}`,
                nextAssigned
                    ? 'Es el siguiente turno que quedará listo al cerrar la atención actual.'
                    : 'Es el ticket general más antiguo si C no recibe otro turno enseguida.'
            ),
            'Sin siguiente foco',
            'No hay otro ticket útil para cargar después de este cierre.'
        );
    } else if (status === 'waiting' && slot === 0) {
        const targetSlot = Number(result.primaryConsultorio || 0);
        projectedTickets =
            targetSlot > 0
                ? baseQueueTickets.map((item) =>
                      Number(item.id || 0) === Number(ticket.id || 0)
                          ? {
                                ...item,
                                assignedConsultorio: targetSlot,
                            }
                          : item
                  )
                : null;
        const targetCalled =
            targetSlot > 0
                ? getCalledTicketForConsultorioFromList(
                      projectedTickets || simulationTickets,
                      targetSlot
                  )
                : null;
        const targetWaiting =
            targetSlot > 0
                ? getAssignedWaitingTicketsFromList(
                      projectedTickets || simulationTickets,
                      targetSlot
                  )
                : [];
        const laneAfterAssign = sortQueueWaitingLikeLane([
            ...targetWaiting,
            ...(projectedTickets
                ? []
                : [
                      {
                          ...ticket,
                          assignedConsultorio: targetSlot,
                      },
                  ]),
        ]);
        const afterIndex = laneAfterAssign.findIndex(
            (item) => Number(item.id || 0) === Number(ticket.id || 0)
        );
        const blocker =
            targetCalled ||
            (afterIndex > 0 ? laneAfterAssign[afterIndex - 1] : null);
        const stepsAhead = afterIndex + (targetCalled ? 1 : 0);
        beforeLabel =
            laneIndex > 0
                ? `Cola general · ${laneIndex} turno(s) delante`
                : 'Cabecera de cola general';
        actionLabel = result.primaryLabel;
        afterLabel =
            targetSlot > 0
                ? stepsAhead <= 0
                    ? `${ticketCode} quedaría listo para llamado en C${targetSlot}.`
                    : `${ticketCode} entraría a C${targetSlot} con ${stepsAhead} paso(s) por delante.`
                : `${ticketCode} seguiría en la cola general.`;
        riskLabel =
            targetSlot > 0
                ? blocker
                    ? `${String(
                          blocker.ticketCode || 'otro turno'
                      )} seguiría delante en C${targetSlot} después de reasignar.`
                    : `No habría bloqueo inmediato en C${targetSlot} después de reasignar.`
                : 'Sin consultorio sugerido disponible para este turno.';
        setFocusPivot(
            buildQueueTicketRoutePivot(
                blocker,
                `Cargar ${String(blocker?.ticketCode || '')}`,
                'Es el bloqueo inmediato que seguiría antes de este ticket tras la reasignación.'
            ),
            stepsAhead <= 0 ? 'Sin bloqueo inmediato' : 'Sin pivote siguiente',
            stepsAhead <= 0
                ? 'Después de reasignarlo, este ticket quedaría listo sin otro bloqueo delante.'
                : 'No se pudo calcular el ticket que quedaría delante.'
        );
    } else if (status === 'waiting' && slot > 0) {
        const waitingSameLane = getAssignedWaitingTicketsFromList(
            simulationTickets,
            slot
        );
        const nextBehind =
            waitingSameLane.find(
                (item) => Number(item.id || 0) !== Number(ticket.id || 0)
            ) || null;
        const previousSameLane =
            laneIndex > 0 ? laneWaiting[laneIndex - 1] : null;
        const laneHead = waitingSameLane[0] || null;
        const canCallNow =
            Number(laneHead?.id || 0) === Number(ticket.id || 0) &&
            !currentCalled;
        if (canCallNow) {
            projectedTickets = baseQueueTickets.map((item) =>
                Number(item.id || 0) === Number(ticket.id || 0)
                    ? {
                          ...item,
                          status: 'called',
                          assignedConsultorio: slot,
                          calledAt: new Date().toISOString(),
                      }
                    : item
            );
            beforeLabel = `Cabecera de C${slot} · listo para llamado`;
            actionLabel = `Llamar ${ticketCode}`;
            afterLabel = nextBehind
                ? `${ticketCode} pasaría a atención y ${nextBehind.ticketCode} quedaría siguiente en C${slot}.`
                : `${ticketCode} pasaría a atención y C${slot} quedaría sin otro ticket asignado detrás.`;
            riskLabel = nextBehind
                ? `El flujo de C${slot} seguiría vivo con ${nextBehind.ticketCode} detrás.`
                : `Sin otro turno detrás, el siguiente cuello vuelve a recepción.`;
            setFocusPivot(
                buildQueueTicketRoutePivot(
                    nextBehind || generalWaiting[0] || null,
                    `Cargar ${String(
                        (nextBehind || generalWaiting[0] || null)?.ticketCode ||
                            ''
                    )}`,
                    nextBehind
                        ? 'Es el turno que quedaría inmediatamente detrás después del llamado.'
                        : 'Es el ticket general más antiguo si quieres ver el siguiente frente de presión.'
                ),
                'Sin siguiente foco',
                'No hay otro turno útil calculado después de este llamado.'
            );
        } else {
            beforeLabel = `C${slot} asignado · ${Math.max(
                laneIndex + (currentCalled ? 1 : 0),
                0
            )} paso(s) delante`;
            actionLabel = result.primaryLabel;
            afterLabel = previousSameLane
                ? `${ticketCode} seguiría esperando detrás de ${previousSameLane.ticketCode} en C${slot}.`
                : currentCalled
                  ? `${ticketCode} seguiría esperando a que ${currentCalled.ticketCode} libere C${slot}.`
                  : `${ticketCode} ya quedó en C${slot}, pero todavía conviene usar el operador o la tabla para moverlo.`;
            riskLabel =
                'Esta acción no cambia de inmediato la cola; sirve para abrir contexto o revisar el bloqueo exacto antes de tocar el ticket.';
            setFocusPivot(
                buildQueueTicketRoutePivot(
                    currentCalled || previousSameLane,
                    `Cargar ${String(
                        (currentCalled || previousSameLane)?.ticketCode || ''
                    )}`,
                    'Es el ticket que todavía bloquea o precede a este turno dentro del consultorio.'
                ),
                'Sin bloqueo directo',
                'No hay otro ticket visible delante dentro del mismo carril.'
            );
        }
    } else {
        const sameLaneCurrent =
            slot > 0
                ? getCalledTicketForConsultorio(slot)
                : generalWaiting[0] || null;
        beforeLabel = `${result.statusCopy} · ruta cerrada`;
        actionLabel =
            result.primaryAction === 'reprint'
                ? result.primaryLabel
                : 'Sin acción operativa directa';
        afterLabel =
            'La cola real ya no depende de este ticket; cualquier decisión ahora pasa por el siguiente turno vivo.';
        riskLabel =
            'El riesgo ya no está en este ticket sino en el siguiente paciente que sostenga el carril.';
        setFocusPivot(
            buildQueueTicketRoutePivot(
                sameLaneCurrent,
                `Cargar ${String(sameLaneCurrent?.ticketCode || '')}`,
                'Es el turno vivo más cercano después del cierre de este ticket.'
            ),
            'Sin siguiente foco',
            'No hay otro turno cercano para tomar como siguiente foco.'
        );
    }

    return {
        title,
        summary,
        statusLabel,
        statusState,
        result,
        beforeLabel,
        actionLabel,
        afterLabel,
        riskLabel,
        focusLabel,
        focusDetail,
        focusPivot,
        projectedTickets,
    };
}

function renderQueueTicketSimulation(manifest, detectedPlatform) {
    const root = document.getElementById('queueTicketSimulation');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const simulation = buildQueueTicketSimulation(manifest, detectedPlatform);
    setHtml(
        '#queueTicketSimulation',
        `
            <section class="queue-ticket-simulation__shell" data-state="${escapeHtml(
                simulation.statusState
            )}">
                <div class="queue-ticket-simulation__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Simulación operativa</p>
                        <h5 id="queueTicketSimulationTitle" class="queue-app-card__title">${escapeHtml(
                            simulation.title
                        )}</h5>
                        <p id="queueTicketSimulationSummary" class="queue-ticket-simulation__summary">${escapeHtml(
                            simulation.summary
                        )}</p>
                    </div>
                    <div class="queue-ticket-simulation__meta">
                        <span
                            id="queueTicketSimulationStatus"
                            class="queue-ticket-simulation__status"
                            data-state="${escapeHtml(simulation.statusState)}"
                        >
                            ${escapeHtml(simulation.statusLabel)}
                        </span>
                        <button
                            id="queueTicketSimulationCopyBtn"
                            type="button"
                            class="queue-ticket-simulation__action"
                            ${simulation.result ? '' : 'disabled'}
                        >
                            Copiar simulación
                        </button>
                    </div>
                </div>
                ${
                    simulation.result
                        ? `
                            <div class="queue-ticket-simulation__grid">
                                <article class="queue-ticket-simulation__fact">
                                    <span>Antes</span>
                                    <strong id="queueTicketSimulationBefore">${escapeHtml(
                                        simulation.beforeLabel
                                    )}</strong>
                                </article>
                                <article class="queue-ticket-simulation__fact">
                                    <span>Acción sugerida</span>
                                    <strong id="queueTicketSimulationAction">${escapeHtml(
                                        simulation.actionLabel
                                    )}</strong>
                                </article>
                                <article class="queue-ticket-simulation__fact">
                                    <span>Después</span>
                                    <strong id="queueTicketSimulationAfter">${escapeHtml(
                                        simulation.afterLabel
                                    )}</strong>
                                </article>
                                <article class="queue-ticket-simulation__fact queue-ticket-simulation__fact--wide">
                                    <span>Riesgo / presión</span>
                                    <strong id="queueTicketSimulationRisk">${escapeHtml(
                                        simulation.riskLabel
                                    )}</strong>
                                </article>
                            </div>
                            <div class="queue-ticket-simulation__actions">
                                <button
                                    id="queueTicketSimulationFocusBtn"
                                    type="button"
                                    class="queue-ticket-simulation__action queue-ticket-simulation__action--primary"
                                    ${simulation.focusPivot ? '' : 'disabled'}
                                >
                                    ${escapeHtml(simulation.focusLabel)}
                                </button>
                            </div>
                            <p id="queueTicketSimulationFocusDetail" class="queue-ticket-simulation__focus-detail">${escapeHtml(
                                simulation.focusDetail
                            )}</p>
                        `
                        : `
                            <article
                                id="queueTicketSimulationEmpty"
                                class="queue-ticket-simulation__empty"
                                data-state="${escapeHtml(simulation.statusState)}"
                            >
                                <strong>${escapeHtml(simulation.title)}</strong>
                                <p>${escapeHtml(simulation.summary)}</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueTicketSimulationCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueTicketSimulation(simulation);
        };
    }

    const focusButton = document.getElementById(
        'queueTicketSimulationFocusBtn'
    );
    if (focusButton instanceof HTMLButtonElement && simulation.focusPivot) {
        focusButton.onclick = () => {
            persistQueueTicketLookupTerm(simulation.focusPivot.ticketCode);
            if (Array.isArray(simulation.projectedTickets)) {
                persistQueueTicketSimulationContext({
                    lookupTerm: simulation.focusPivot.ticketCode,
                    targetTicketId: simulation.focusPivot.ticketId,
                    sourceTicketId: simulation.result.ticketId,
                    sourceStatus: getQueueTicketById(simulation.result.ticketId)
                        ?.status,
                    sourceConsultorio: simulation.result.consultorio,
                    sourceTicketCode: simulation.result.ticketCode,
                    actionLabel: simulation.actionLabel,
                    tickets: simulation.projectedTickets,
                });
            }
            appendOpsLogEntry({
                source: 'ticket_simulation',
                tone: 'info',
                title: 'Simulación operativa: foco siguiente',
                summary: `${simulation.focusPivot.ticketCode} quedó cargado desde la simulación de ${simulation.result.ticketCode}.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
}

function buildQueueNextTurnsTargetSlot(
    manifest,
    detectedPlatform,
    virtualLoads,
    operatorContexts
) {
    return [1, 2]
        .map((slot) => {
            const context =
                operatorContexts[slot] ||
                buildConsultorioOperatorContext(
                    manifest,
                    detectedPlatform,
                    slot
                );
            const operatorReady = Boolean(
                context.operatorAssigned && context.operatorLive
            );
            const currentTicket = getCalledTicketForConsultorio(slot);
            return {
                slot,
                slotKey: `c${slot}`,
                operatorReady,
                context,
                score:
                    Number(virtualLoads[slot] || 0) +
                    (operatorReady ? 0 : 2) +
                    (currentTicket ? 0.5 : 0),
            };
        })
        .sort((left, right) => {
            if (left.score !== right.score) {
                return left.score - right.score;
            }
            if (left.operatorReady !== right.operatorReady) {
                return left.operatorReady ? -1 : 1;
            }
            return left.slot - right.slot;
        })[0];
}

function buildQueueNextTurnsConsultorioCard(
    manifest,
    detectedPlatform,
    consultorio
) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const currentTicket = getCalledTicketForConsultorio(slot);
    const waitingTickets = getAssignedWaitingTickets(slot);
    const generalWaiting = getUnassignedWaitingTickets();
    const dispatchCard = buildQueueDispatchCard(
        manifest,
        detectedPlatform,
        slot
    );
    const steps = [];

    if (currentTicket) {
        const nextAssigned = waitingTickets[0] || null;
        const fallbackGeneral = generalWaiting[0] || null;
        steps.push({
            id: `${slotKey}_0`,
            state: 'active',
            actionLabel: `Completar ${currentTicket.ticketCode}`,
            support: nextAssigned
                ? `Deja ${nextAssigned.ticketCode} listo para ${slotKey.toUpperCase()}.`
                : fallbackGeneral
                  ? `Libera ${slotKey.toUpperCase()} para absorber ${fallbackGeneral.ticketCode} desde cola general.`
                  : `Libera ${slotKey.toUpperCase()} sin otro ticket esperando detrás.`,
            pivot: buildQueueTicketRoutePivot(
                currentTicket,
                `Cargar ${currentTicket.ticketCode}`,
                `Es el ticket que hoy ocupa ${slotKey.toUpperCase()}.`
            ),
        });
    }

    const firstWaiting = waitingTickets[0] || null;
    if (firstWaiting) {
        const secondWaiting = waitingTickets[1] || null;
        const operatorReady = Boolean(
            operatorContext.operatorAssigned && operatorContext.operatorLive
        );
        steps.push({
            id: `${slotKey}_1`,
            state: operatorReady ? 'ready' : 'warning',
            actionLabel: operatorReady
                ? currentTicket
                    ? `Llamar ${firstWaiting.ticketCode} después del cierre`
                    : `Llamar ${firstWaiting.ticketCode}`
                : `Abrir Operador ${slotKey.toUpperCase()} para ${firstWaiting.ticketCode}`,
            support: secondWaiting
                ? `${secondWaiting.ticketCode} quedaría inmediatamente detrás en ${slotKey.toUpperCase()}.`
                : generalWaiting[0]
                  ? `Luego ${slotKey.toUpperCase()} puede absorber ${generalWaiting[0].ticketCode} desde general.`
                  : `Sin otro ticket asignado detrás por ahora.`,
            pivot: buildQueueTicketRoutePivot(
                firstWaiting,
                `Cargar ${firstWaiting.ticketCode}`,
                `Es el siguiente turno que ya espera en ${slotKey.toUpperCase()}.`
            ),
        });
    }

    const secondWaiting = waitingTickets[1] || null;
    if (secondWaiting) {
        steps.push({
            id: `${slotKey}_2`,
            state: 'idle',
            actionLabel: `Preparar ${secondWaiting.ticketCode}`,
            support: `${formatQueueTicketAgeLabel(
                secondWaiting,
                'waiting'
            )}. Quedará detrás del primer llamado del carril.`,
            pivot: buildQueueTicketRoutePivot(
                secondWaiting,
                `Cargar ${secondWaiting.ticketCode}`,
                `Sigue detrás del primer ticket en ${slotKey.toUpperCase()}.`
            ),
        });
    } else if (
        generalWaiting[0] &&
        dispatchCard.targetTicketId === Number(generalWaiting[0].id || 0)
    ) {
        steps.push({
            id: `${slotKey}_2`,
            state:
                dispatchCard.primaryAction === 'assign'
                    ? 'suggested'
                    : dispatchCard.primaryAction === 'open'
                      ? 'warning'
                      : 'idle',
            actionLabel:
                dispatchCard.primaryAction === 'assign'
                    ? `Traer ${generalWaiting[0].ticketCode} desde general`
                    : dispatchCard.primaryLabel,
            support: dispatchCard.detail,
            pivot: buildQueueTicketRoutePivot(
                generalWaiting[0],
                `Cargar ${generalWaiting[0].ticketCode}`,
                `Es el siguiente ticket general candidato para ${slotKey.toUpperCase()}.`
            ),
        });
    }

    const firstStep = steps[0] || null;
    return {
        laneKey: slotKey,
        laneLabel: slotKey.toUpperCase(),
        state: firstStep?.state || 'idle',
        badge: firstStep
            ? firstStep.state === 'active'
                ? 'Atención en curso'
                : firstStep.state === 'ready'
                  ? 'Siguiente listo'
                  : firstStep.state === 'warning'
                    ? 'Preparar operador'
                    : 'Secuencia lista'
            : 'Sin presión',
        headline: firstStep
            ? `${slotKey.toUpperCase()} ya tiene la siguiente ronda trazada`
            : `${slotKey.toUpperCase()} sin pasos inmediatos`,
        summary: firstStep
            ? firstStep.support
            : `No hay ticket en curso ni espera asignada para ${slotKey.toUpperCase()} ahora mismo.`,
        steps,
    };
}

function buildQueueNextTurnsGeneralCard(manifest, detectedPlatform) {
    const generalWaiting = getUnassignedWaitingTickets();
    const operatorContexts = {
        1: buildConsultorioOperatorContext(manifest, detectedPlatform, 1),
        2: buildConsultorioOperatorContext(manifest, detectedPlatform, 2),
    };
    const virtualLoads = {
        1:
            getAssignedWaitingTickets(1).length +
            (getCalledTicketForConsultorio(1) ? 1 : 0),
        2:
            getAssignedWaitingTickets(2).length +
            (getCalledTicketForConsultorio(2) ? 1 : 0),
    };
    const steps = generalWaiting.slice(0, 3).map((ticket, index) => {
        const target = buildQueueNextTurnsTargetSlot(
            manifest,
            detectedPlatform,
            virtualLoads,
            operatorContexts
        );
        const slot = target.slot;
        const stepsAhead = Number(virtualLoads[slot] || 0);
        virtualLoads[slot] = stepsAhead + 1;
        return {
            id: `general_${index}`,
            state: target.operatorReady ? 'suggested' : 'warning',
            actionLabel: target.operatorReady
                ? `Asignar ${ticket.ticketCode} a C${slot}`
                : `Preparar ${ticket.ticketCode} para C${slot}`,
            support: target.operatorReady
                ? stepsAhead <= 0
                    ? `${ticket.ticketCode} quedaría listo para llamado en C${slot}.`
                    : `${ticket.ticketCode} entraría con ${stepsAhead} paso(s) delante en C${slot}.`
                : `Primero deja arriba Operador C${slot}; después ${ticket.ticketCode} entraría con ${stepsAhead} paso(s) delante.`,
            pivot: buildQueueTicketRoutePivot(
                ticket,
                `Cargar ${ticket.ticketCode}`,
                `Es el siguiente ticket general que recepción puede despachar a C${slot}.`
            ),
        };
    });

    const firstStep = steps[0] || null;
    return {
        laneKey: 'general',
        laneLabel: 'General',
        state: firstStep?.state || 'idle',
        badge: firstStep ? 'Recepción en curso' : 'Sin cola general',
        headline: firstStep
            ? `${generalWaiting.length} ticket(s) esperan despacho`
            : 'Cola general al día',
        summary: firstStep
            ? firstStep.support
            : 'No hay tickets sin consultorio esperando en recepción.',
        steps,
    };
}

function copyQueueNextTurnsReport(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Próximos turnos - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.laneLabel} - ${card.badge}`,
            ...(card.steps.length
                ? card.steps.map(
                      (step, index) =>
                          `${index + 1}. ${step.actionLabel} - ${step.support}`
                  )
                : ['Sin pasos inmediatos.']),
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Secuencia copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la secuencia', 'error');
        });
}

function buildQueueNextTurnsPanel(manifest, detectedPlatform) {
    const cards = [
        buildQueueNextTurnsConsultorioCard(manifest, detectedPlatform, 1),
        buildQueueNextTurnsConsultorioCard(manifest, detectedPlatform, 2),
        buildQueueNextTurnsGeneralCard(manifest, detectedPlatform),
    ];
    const mappedSteps = cards.reduce(
        (total, card) => total + Number(card.steps.length || 0),
        0
    );
    const activeCards = cards.filter((card) => card.steps.length > 0);
    const hottestCard =
        cards.find((card) => card.state === 'active') ||
        cards.find((card) => card.state === 'warning') ||
        cards.find((card) => card.state === 'ready') ||
        activeCards[0] ||
        null;

    return {
        title: 'Próximos turnos',
        summary: hottestCard
            ? `${hottestCard.laneLabel} marca el siguiente frente útil. ${hottestCard.summary}`
            : 'No hay movimientos inmediatos pendientes entre consultorios y recepción.',
        statusLabel:
            mappedSteps > 0
                ? `${mappedSteps} movimiento(s) trazados`
                : 'Sin movimientos inmediatos',
        statusState: hottestCard ? hottestCard.state : 'idle',
        cards,
    };
}

function renderQueueNextTurnsPanel(manifest, detectedPlatform) {
    const root = document.getElementById('queueNextTurns');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueNextTurnsPanel(manifest, detectedPlatform);
    setHtml(
        '#queueNextTurns',
        `
            <section class="queue-next-turns__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-next-turns__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Ventana inmediata</p>
                        <h5 id="queueNextTurnsTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueNextTurnsSummary" class="queue-next-turns__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-next-turns__meta">
                        <span
                            id="queueNextTurnsStatus"
                            class="queue-next-turns__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueNextTurnsCopyBtn"
                            type="button"
                            class="queue-next-turns__action"
                            ${panel.cards.some((card) => card.steps.length) ? '' : 'disabled'}
                        >
                            Copiar secuencia
                        </button>
                    </div>
                </div>
                <div id="queueNextTurnsCards" class="queue-next-turns__grid" role="list" aria-label="Próximos turnos por carril">
                    ${panel.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueNextTurnsCard_${escapeHtml(card.laneKey)}"
                                    class="queue-next-turns__card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-next-turns__card-head">
                                        <div>
                                            <p class="queue-next-turns__lane">${escapeHtml(
                                                card.laneLabel
                                            )}</p>
                                            <strong id="queueNextTurnsHeadline_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(card.headline)}</strong>
                                        </div>
                                        <span class="queue-next-turns__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueNextTurnsSummary_${escapeHtml(
                                        card.laneKey
                                    )}" class="queue-next-turns__card-summary">${escapeHtml(
                                        card.summary
                                    )}</p>
                                    ${
                                        card.steps.length
                                            ? `
                                                <div class="queue-next-turns__steps" role="list" aria-label="Secuencia de ${escapeHtml(
                                                    card.laneLabel
                                                )}">
                                                    ${card.steps
                                                        .map(
                                                            (step, index) => `
                                                                <article class="queue-next-turns__step" data-state="${escapeHtml(
                                                                    step.state
                                                                )}" role="listitem">
                                                                    <div class="queue-next-turns__step-copy">
                                                                        <span class="queue-next-turns__step-index">${index + 1}</span>
                                                                        <div>
                                                                            <strong id="queueNextTurnsStep_${escapeHtml(
                                                                                card.laneKey
                                                                            )}_${index}">${escapeHtml(
                                                                                step.actionLabel
                                                                            )}</strong>
                                                                            <p>${escapeHtml(
                                                                                step.support
                                                                            )}</p>
                                                                        </div>
                                                                    </div>
                                                                    <button
                                                                        id="queueNextTurnsLoad_${escapeHtml(
                                                                            card.laneKey
                                                                        )}_${index}"
                                                                        type="button"
                                                                        class="queue-next-turns__load"
                                                                        data-queue-next-turns-ticket="${escapeHtml(
                                                                            step
                                                                                .pivot
                                                                                ?.ticketCode ||
                                                                                ''
                                                                        )}"
                                                                        data-queue-next-turns-action="${escapeHtml(
                                                                            step.actionLabel
                                                                        )}"
                                                                        ${step.pivot ? '' : 'disabled'}
                                                                    >
                                                                        ${escapeHtml(
                                                                            step
                                                                                .pivot
                                                                                ?.label ||
                                                                                'Sin ticket'
                                                                        )}
                                                                    </button>
                                                                </article>
                                                            `
                                                        )
                                                        .join('')}
                                                </div>
                                            `
                                            : `
                                                <article class="queue-next-turns__empty">
                                                    <strong>Sin pasos inmediatos</strong>
                                                    <p>Este carril no necesita intervención ahora mismo.</p>
                                                </article>
                                            `
                                    }
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueNextTurnsCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueNextTurnsReport(panel);
        };
    }

    root.querySelectorAll('[data-queue-next-turns-ticket]').forEach(
        (button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }
            button.onclick = () => {
                const ticketCode = String(
                    button.dataset.queueNextTurnsTicket || ''
                ).trim();
                const actionLabel = String(
                    button.dataset.queueNextTurnsAction || ''
                ).trim();
                if (!ticketCode) {
                    return;
                }
                persistQueueTicketLookupTerm(ticketCode);
                appendOpsLogEntry({
                    source: 'next_turns',
                    tone: 'info',
                    title: 'Próximos turnos: ticket cargado',
                    summary: `${ticketCode} quedó cargado desde la secuencia inmediata (${actionLabel || 'sin acción visible'}).`,
                });
                rerenderQueueOpsHub(manifest, detectedPlatform);
            };
        }
    );
}

function getQueueMasterSequenceActionWeight(actionLabel) {
    const value = String(actionLabel || '')
        .trim()
        .toLowerCase();
    if (value.startsWith('completar')) {
        return 0;
    }
    if (value.startsWith('llamar')) {
        return 1;
    }
    if (value.startsWith('asignar') || value.startsWith('traer')) {
        return 2;
    }
    if (value.startsWith('preparar')) {
        return 3;
    }
    if (value.startsWith('abrir operador')) {
        return 4;
    }
    return 5;
}

function buildQueueMasterSequencePanel(manifest, detectedPlatform) {
    const nextTurns = buildQueueNextTurnsPanel(manifest, detectedPlatform);
    const selectedLookup = getQueueTicketLookupTerm();
    const laneWeight = {
        c1: 0,
        c2: 1,
        general: 2,
    };
    const stateWeight = {
        active: 0,
        ready: 1,
        suggested: 2,
        warning: 3,
        idle: 4,
    };
    const items = nextTurns.cards
        .flatMap((card) =>
            card.steps.map((step, index) => ({
                id: `${card.laneKey}_${index}`,
                laneKey: card.laneKey,
                laneLabel: card.laneLabel,
                cardState: card.state,
                cardBadge: card.badge,
                actionLabel: step.actionLabel,
                support: step.support,
                pivot: step.pivot,
                selected:
                    selectedLookup === String(step.pivot?.ticketCode || ''),
                score:
                    (stateWeight[step.state] ?? 5) * 100 +
                    getQueueMasterSequenceActionWeight(step.actionLabel) * 10 +
                    (laneWeight[card.laneKey] ?? 9) +
                    index,
            }))
        )
        .sort((left, right) => left.score - right.score)
        .slice(0, 5);

    const top = items[0] || null;
    return {
        title: 'Ronda maestra',
        summary: top
            ? `${top.actionLabel} abre la siguiente jugada con más impacto ahora. ${top.support}`
            : 'No hay una secuencia global pendiente; la cola está bajo control inmediato.',
        statusLabel: top
            ? `${items.length} paso(s) priorizados`
            : 'Sin secuencia urgente',
        statusState: top ? top.cardState : 'idle',
        items,
    };
}

function copyQueueMasterSequenceReport(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Ronda maestra - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...(panel.items.length
            ? panel.items.map(
                  (item, index) =>
                      `${index + 1}. [${item.laneLabel}] ${item.actionLabel} - ${item.support}`
              )
            : ['Sin pasos priorizados.']),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Ronda copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la ronda', 'error');
        });
}

function renderQueueMasterSequencePanel(manifest, detectedPlatform) {
    const root = document.getElementById('queueMasterSequence');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueMasterSequencePanel(manifest, detectedPlatform);
    setHtml(
        '#queueMasterSequence',
        `
            <section class="queue-master-sequence__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-master-sequence__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Secuencia global</p>
                        <h5 id="queueMasterSequenceTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueMasterSequenceSummary" class="queue-master-sequence__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-master-sequence__meta">
                        <span
                            id="queueMasterSequenceStatus"
                            class="queue-master-sequence__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueMasterSequenceCopyBtn"
                            type="button"
                            class="queue-master-sequence__action"
                            ${panel.items.length ? '' : 'disabled'}
                        >
                            Copiar ronda
                        </button>
                    </div>
                </div>
                ${
                    panel.items.length
                        ? `
                            <div id="queueMasterSequenceItems" class="queue-master-sequence__list" role="list" aria-label="Ronda maestra del turno">
                                ${panel.items
                                    .map(
                                        (item, index) => `
                                            <article
                                                id="queueMasterSequenceItem_${index}"
                                                class="queue-master-sequence__item"
                                                data-state="${escapeHtml(item.cardState)}"
                                                data-selected="${item.selected ? 'true' : 'false'}"
                                                role="listitem"
                                            >
                                                <div class="queue-master-sequence__item-copy">
                                                    <span class="queue-master-sequence__item-index">${index + 1}</span>
                                                    <div>
                                                        <div class="queue-master-sequence__item-headline">
                                                            <span class="queue-master-sequence__lane">${escapeHtml(
                                                                item.laneLabel
                                                            )}</span>
                                                            <strong id="queueMasterSequenceAction_${index}">${escapeHtml(
                                                                item.actionLabel
                                                            )}</strong>
                                                        </div>
                                                        <p id="queueMasterSequenceSupport_${index}">${escapeHtml(
                                                            item.support
                                                        )}</p>
                                                    </div>
                                                </div>
                                                <div class="queue-master-sequence__item-actions">
                                                    <span class="queue-master-sequence__badge">${escapeHtml(
                                                        item.cardBadge
                                                    )}</span>
                                                    <button
                                                        id="queueMasterSequenceLoad_${index}"
                                                        type="button"
                                                        class="queue-master-sequence__load"
                                                        data-queue-master-ticket="${escapeHtml(
                                                            item.pivot
                                                                ?.ticketCode ||
                                                                ''
                                                        )}"
                                                        data-queue-master-action="${escapeHtml(
                                                            item.actionLabel
                                                        )}"
                                                        ${item.pivot ? '' : 'disabled'}
                                                    >
                                                        ${escapeHtml(
                                                            item.pivot?.label ||
                                                                'Sin ticket'
                                                        )}
                                                    </button>
                                                </div>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : `
                            <article id="queueMasterSequenceEmpty" class="queue-master-sequence__empty">
                                <strong>Sin ronda urgente</strong>
                                <p>Los próximos movimientos ya están despejados y no hay una cadena crítica inmediata.</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueMasterSequenceCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueMasterSequenceReport(panel);
        };
    }

    root.querySelectorAll('[data-queue-master-ticket]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const ticketCode = String(
                button.dataset.queueMasterTicket || ''
            ).trim();
            const actionLabel = String(
                button.dataset.queueMasterAction || ''
            ).trim();
            if (!ticketCode) {
                return;
            }
            persistQueueTicketLookupTerm(ticketCode);
            appendOpsLogEntry({
                source: 'master_sequence',
                tone: 'info',
                title: 'Ronda maestra: ticket cargado',
                summary: `${ticketCode} quedó cargado desde la secuencia global (${actionLabel || 'sin acción visible'}).`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
}

function buildQueueCoverageCard(manifest, detectedPlatform, consultorio) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const otherSlot = slot === 2 ? 1 : 2;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const currentTicket = getCalledTicketForConsultorio(slot);
    const nextAssigned = getAssignedWaitingTickets(slot)[0] || null;
    const generalCandidate = getUnassignedWaitingTickets()[0] || null;
    const rebalanceCandidate =
        !generalCandidate && getAssignedWaitingTickets(otherSlot)[1]
            ? getAssignedWaitingTickets(otherSlot)[1]
            : null;
    const operatorReady = Boolean(
        operatorContext.operatorAssigned && operatorContext.operatorLive
    );

    let state = 'idle';
    let badge = 'Sin hueco próximo';
    let headline = `${slotKey.toUpperCase()} sin hueco operativo inmediato`;
    let currentLabel = currentTicket
        ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
              currentTicket,
              'called'
          )}`
        : 'Sin paciente en atención';
    let nextLabel = nextAssigned
        ? `${nextAssigned.ticketCode} · ${formatQueueTicketAgeLabel(
              nextAssigned,
              'waiting'
          )}`
        : 'Sin paciente cubriendo la siguiente entrada';
    let gapLabel = 'Cobertura estable';
    let recommendationLabel = 'Sin acción inmediata';
    let pivot = null;

    if (currentTicket && nextAssigned) {
        state = 'ready';
        badge = 'Cubierto';
        headline = `${slotKey.toUpperCase()} ya tiene cubierto el siguiente paso`;
        gapLabel = `${nextAssigned.ticketCode} entra cuando cierres ${currentTicket.ticketCode}.`;
        recommendationLabel = `Cargar ${nextAssigned.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            nextAssigned,
            `Cargar ${nextAssigned.ticketCode}`,
            `Es el paciente que ya cubre la siguiente entrada de ${slotKey.toUpperCase()}.`
        );
    } else if (currentTicket && generalCandidate) {
        state = operatorReady ? 'warning' : 'alert';
        badge = operatorReady ? 'Preasigna ahora' : 'Prepara operador';
        headline = `${slotKey.toUpperCase()} quedará sin cobertura tras ${currentTicket.ticketCode}`;
        gapLabel = operatorReady
            ? `${generalCandidate.ticketCode} debería quedar preasignado antes del cierre para evitar hueco.`
            : `${generalCandidate.ticketCode} podría cubrir el hueco, pero primero conviene dejar Operador ${slotKey.toUpperCase()} listo.`;
        recommendationLabel = operatorReady
            ? `Preparar ${generalCandidate.ticketCode} para ${slotKey.toUpperCase()}`
            : `Preparar Operador ${slotKey.toUpperCase()} y luego ${generalCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            generalCandidate,
            `Cargar ${generalCandidate.ticketCode}`,
            `Es el mejor candidato general para cubrir el siguiente ingreso de ${slotKey.toUpperCase()}.`
        );
    } else if (currentTicket && rebalanceCandidate) {
        state = 'warning';
        badge = 'Rebalancea cobertura';
        headline = `${slotKey.toUpperCase()} va a quedar libre y el otro carril tiene excedente`;
        gapLabel = `${rebalanceCandidate.ticketCode} puede moverse desde C${otherSlot} para que ${slotKey.toUpperCase()} no quede vacío.`;
        recommendationLabel = `Cargar ${rebalanceCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            rebalanceCandidate,
            `Cargar ${rebalanceCandidate.ticketCode}`,
            `Es el candidato más claro para cubrir el hueco desde C${otherSlot}.`
        );
    } else if (!currentTicket && nextAssigned) {
        state = 'ready';
        badge = 'Listo para llamar';
        headline = `${slotKey.toUpperCase()} ya tiene siguiente paciente listo`;
        gapLabel = `${nextAssigned.ticketCode} ya espera en ${slotKey.toUpperCase()} sin hueco entre turnos.`;
        recommendationLabel = `Cargar ${nextAssigned.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            nextAssigned,
            `Cargar ${nextAssigned.ticketCode}`,
            `Es el siguiente turno que ya sostiene la cobertura de ${slotKey.toUpperCase()}.`
        );
    } else if (!currentTicket && generalCandidate) {
        state = operatorReady ? 'suggested' : 'warning';
        badge = operatorReady ? 'Puede absorber' : 'Falta operador';
        headline = `${slotKey.toUpperCase()} puede tomar cobertura nueva`;
        gapLabel = operatorReady
            ? `${generalCandidate.ticketCode} puede entrar ahora mismo para evitar hueco futuro.`
            : `${generalCandidate.ticketCode} podría ir a ${slotKey.toUpperCase()}, pero el operador todavía no acompaña.`;
        recommendationLabel = operatorReady
            ? `Cargar ${generalCandidate.ticketCode}`
            : `Preparar ${generalCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            generalCandidate,
            `Cargar ${generalCandidate.ticketCode}`,
            `Es el siguiente candidato para cubrir ${slotKey.toUpperCase()}.`
        );
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        currentLabel,
        nextLabel,
        gapLabel,
        recommendationLabel,
        operatorLabel: operatorContext.operatorLabel,
        pivot,
    };
}

function buildQueueCoverageDeck(manifest, detectedPlatform) {
    const cards = [1, 2].map((slot) =>
        buildQueueCoverageCard(manifest, detectedPlatform, slot)
    );
    const exposed = cards.filter((card) =>
        ['warning', 'alert', 'suggested'].includes(card.state)
    );
    const ready = cards.filter((card) => card.state === 'ready').length;
    const top =
        cards.find((card) => card.state === 'alert') ||
        cards.find((card) => card.state === 'warning') ||
        cards.find((card) => card.state === 'suggested') ||
        cards.find((card) => card.state === 'ready') ||
        null;

    return {
        title: 'Cobertura siguiente',
        summary: top
            ? `${top.headline}. ${top.gapLabel}`
            : 'No hay huecos próximos detectados entre el cierre actual y el siguiente ingreso.',
        statusLabel:
            exposed.length > 0
                ? `${exposed.length} hueco(s) por cubrir`
                : `${ready}/2 consultorio(s) cubiertos`,
        statusState: top ? top.state : 'idle',
        cards,
    };
}

function copyQueueCoverageDeck(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Cobertura siguiente - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.slotKey.toUpperCase()} - ${card.badge}`,
            `Actual: ${card.currentLabel}`,
            `Siguiente: ${card.nextLabel}`,
            `Cobertura: ${card.gapLabel}`,
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Cobertura copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la cobertura', 'error');
        });
}

function renderQueueCoverageDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueCoverageDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueCoverageDeck(manifest, detectedPlatform);
    setHtml(
        '#queueCoverageDeck',
        `
            <section class="queue-coverage-deck__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-coverage-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Cobertura de turno</p>
                        <h5 id="queueCoverageDeckTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueCoverageDeckSummary" class="queue-coverage-deck__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <div class="queue-coverage-deck__meta">
                        <span
                            id="queueCoverageDeckStatus"
                            class="queue-coverage-deck__status"
                            data-state="${escapeHtml(deck.statusState)}"
                        >
                            ${escapeHtml(deck.statusLabel)}
                        </span>
                        <button
                            id="queueCoverageDeckCopyBtn"
                            type="button"
                            class="queue-coverage-deck__action"
                            ${deck.cards.length ? '' : 'disabled'}
                        >
                            Copiar cobertura
                        </button>
                    </div>
                </div>
                <div id="queueCoverageDeckCards" class="queue-coverage-deck__grid" role="list" aria-label="Cobertura siguiente por consultorio">
                    ${deck.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueCoverageCard_${escapeHtml(card.slotKey)}"
                                    class="queue-coverage-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-coverage-card__head">
                                        <div>
                                            <p class="queue-coverage-card__lane">${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</p>
                                            <strong id="queueCoverageHeadline_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.headline)}</strong>
                                        </div>
                                        <span class="queue-coverage-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueCoverageCurrent_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-coverage-card__fact">${escapeHtml(
                                        `Actual: ${card.currentLabel}`
                                    )}</p>
                                    <p id="queueCoverageNext_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-coverage-card__fact">${escapeHtml(
                                        `Siguiente: ${card.nextLabel}`
                                    )}</p>
                                    <p id="queueCoverageGap_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-coverage-card__fact queue-coverage-card__fact--support">${escapeHtml(
                                        card.gapLabel
                                    )}</p>
                                    <div class="queue-coverage-card__actions">
                                        <span class="queue-coverage-card__tag">${escapeHtml(
                                            card.operatorLabel
                                        )}</span>
                                        <button
                                            id="queueCoveragePrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-coverage-card__action"
                                            data-queue-coverage-ticket="${escapeHtml(
                                                card.pivot?.ticketCode || ''
                                            )}"
                                            data-queue-coverage-label="${escapeHtml(
                                                card.recommendationLabel
                                            )}"
                                            ${card.pivot ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(
                                                card.pivot?.label ||
                                                    card.recommendationLabel
                                            )}
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueCoverageDeckCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueCoverageDeck(deck);
        };
    }

    root.querySelectorAll('[data-queue-coverage-ticket]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const ticketCode = String(
                button.dataset.queueCoverageTicket || ''
            ).trim();
            const label = String(
                button.dataset.queueCoverageLabel || ''
            ).trim();
            if (!ticketCode) {
                return;
            }
            persistQueueTicketLookupTerm(ticketCode);
            appendOpsLogEntry({
                source: 'coverage',
                tone: 'info',
                title: 'Cobertura siguiente: ticket cargado',
                summary: `${ticketCode} quedó cargado desde cobertura siguiente (${label || 'sin recomendación visible'}).`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
}

function buildQueueReserveCard(manifest, detectedPlatform, consultorio) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const otherSlot = slot === 2 ? 1 : 2;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const currentTicket = getCalledTicketForConsultorio(slot);
    const assignedTickets = getAssignedWaitingTickets(slot);
    const nextAssigned = assignedTickets[0] || null;
    const reserveAssigned = assignedTickets[1] || null;
    const generalCandidate = getUnassignedWaitingTickets()[0] || null;
    const rebalanceCandidate =
        !generalCandidate && getAssignedWaitingTickets(otherSlot)[1]
            ? getAssignedWaitingTickets(otherSlot)[1]
            : null;
    const operatorReady = Boolean(
        operatorContext.operatorAssigned && operatorContext.operatorLive
    );

    let state = 'idle';
    let badge = 'Sin reserva crítica';
    let headline = `${slotKey.toUpperCase()} no muestra riesgo de agotarse tras el siguiente turno`;
    let currentLabel = currentTicket
        ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
              currentTicket,
              'called'
          )}`
        : 'Sin paciente en atención';
    let nextLabel = nextAssigned
        ? `${nextAssigned.ticketCode} · ${formatQueueTicketAgeLabel(
              nextAssigned,
              'waiting'
          )}`
        : 'Sin siguiente asignado';
    let reserveLabel = reserveAssigned
        ? `${reserveAssigned.ticketCode} · ${formatQueueTicketAgeLabel(
              reserveAssigned,
              'waiting'
          )}`
        : generalCandidate
          ? `${generalCandidate.ticketCode} en cola general`
          : rebalanceCandidate
            ? `${rebalanceCandidate.ticketCode} desde C${otherSlot}`
            : 'Sin segundo paso preparado';
    let bufferLabel = 'La cola del consultorio mantiene un colchón suficiente.';
    let recommendationLabel = 'Sin acción inmediata';
    let pivot = null;

    if (reserveAssigned) {
        state = 'ready';
        badge = '2 pasos cubiertos';
        headline = `${slotKey.toUpperCase()} ya tiene reserva después del siguiente turno`;
        bufferLabel = `${reserveAssigned.ticketCode} sostiene la cola de ${slotKey.toUpperCase()} después de ${nextAssigned?.ticketCode || 'la siguiente llamada'}.`;
        recommendationLabel = `Cargar ${reserveAssigned.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            reserveAssigned,
            `Cargar ${reserveAssigned.ticketCode}`,
            `Es la reserva inmediata que mantiene con vida la cola de ${slotKey.toUpperCase()} tras el siguiente turno.`
        );
    } else if (nextAssigned && generalCandidate) {
        state = operatorReady ? 'suggested' : 'warning';
        badge = operatorReady ? 'Reserva desde general' : 'Reserva frágil';
        headline = `${slotKey.toUpperCase()} depende de cola general después de ${nextAssigned.ticketCode}`;
        bufferLabel = operatorReady
            ? `${generalCandidate.ticketCode} es el mejor respaldo para que ${slotKey.toUpperCase()} no se vacíe tras ${nextAssigned.ticketCode}.`
            : `${generalCandidate.ticketCode} puede ser la reserva, pero conviene validar el operador antes de confiar en ese respaldo.`;
        recommendationLabel = `Cargar ${generalCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            generalCandidate,
            `Cargar ${generalCandidate.ticketCode}`,
            `Es el mejor candidato general para dejar una reserva real en ${slotKey.toUpperCase()}.`
        );
    } else if (nextAssigned && rebalanceCandidate) {
        state = 'warning';
        badge = 'Rebalancea reserva';
        headline = `${slotKey.toUpperCase()} solo tiene un paso cubierto`;
        bufferLabel = `${rebalanceCandidate.ticketCode} es el excedente más claro desde C${otherSlot} para dejar reserva después de ${nextAssigned.ticketCode}.`;
        recommendationLabel = `Cargar ${rebalanceCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            rebalanceCandidate,
            `Cargar ${rebalanceCandidate.ticketCode}`,
            `Es el mejor rebalanceo visible para reconstruir la reserva de ${slotKey.toUpperCase()}.`
        );
    } else if (nextAssigned) {
        state = 'alert';
        badge = 'Sin reserva';
        headline = `${slotKey.toUpperCase()} se vacía después de ${nextAssigned.ticketCode}`;
        bufferLabel = `No hay un segundo turno ya preparado para sostener ${slotKey.toUpperCase()} después del siguiente paciente.`;
        recommendationLabel = `Cargar ${nextAssigned.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            nextAssigned,
            `Cargar ${nextAssigned.ticketCode}`,
            `Es el último turno visible antes de que ${slotKey.toUpperCase()} se quede sin reserva.`
        );
    } else if (generalCandidate) {
        state = operatorReady ? 'warning' : 'alert';
        badge = operatorReady ? 'Arma reserva' : 'Sin armado';
        headline = `${slotKey.toUpperCase()} no tiene cola propia preparada`;
        bufferLabel = operatorReady
            ? `${generalCandidate.ticketCode} es el único respaldo inmediato para volver a poblar ${slotKey.toUpperCase()}.`
            : `${generalCandidate.ticketCode} podría poblar ${slotKey.toUpperCase()}, pero el operador todavía no acompaña ese armado.`;
        recommendationLabel = `Cargar ${generalCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            generalCandidate,
            `Cargar ${generalCandidate.ticketCode}`,
            `Es el primer ticket disponible para reconstruir la reserva de ${slotKey.toUpperCase()}.`
        );
    } else if (rebalanceCandidate) {
        state = 'warning';
        badge = 'Pide rebalanceo';
        headline = `${slotKey.toUpperCase()} no tiene cola propia`;
        bufferLabel = `${rebalanceCandidate.ticketCode} puede convertirse en la reserva mínima desde C${otherSlot}.`;
        recommendationLabel = `Cargar ${rebalanceCandidate.ticketCode}`;
        pivot = buildQueueTicketRoutePivot(
            rebalanceCandidate,
            `Cargar ${rebalanceCandidate.ticketCode}`,
            `Es el rebalanceo más claro para poblar otra vez ${slotKey.toUpperCase()}.`
        );
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        currentLabel,
        nextLabel,
        reserveLabel,
        bufferLabel,
        recommendationLabel,
        operatorLabel: operatorContext.operatorLabel,
        pivot,
    };
}

function buildQueueReserveDeck(manifest, detectedPlatform) {
    const cards = [1, 2].map((slot) =>
        buildQueueReserveCard(manifest, detectedPlatform, slot)
    );
    const exposed = cards.filter((card) =>
        ['warning', 'alert', 'suggested'].includes(card.state)
    );
    const ready = cards.filter((card) => card.state === 'ready').length;
    const top =
        cards.find((card) => card.state === 'alert') ||
        cards.find((card) => card.state === 'warning') ||
        cards.find((card) => card.state === 'suggested') ||
        cards.find((card) => card.state === 'ready') ||
        null;

    return {
        title: 'Reserva inmediata',
        summary: top
            ? `${top.headline}. ${top.bufferLabel}`
            : 'No hay consultorios con reserva frágil después del siguiente turno.',
        statusLabel:
            exposed.length > 0
                ? `${exposed.length} reserva(s) por reforzar`
                : `${ready}/2 consultorio(s) con reserva`,
        statusState: top ? top.state : 'idle',
        cards,
    };
}

function copyQueueReserveDeck(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Reserva inmediata - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.slotKey.toUpperCase()} - ${card.badge}`,
            `Actual: ${card.currentLabel}`,
            `Siguiente: ${card.nextLabel}`,
            `Reserva: ${card.reserveLabel}`,
            `Soporte: ${card.bufferLabel}`,
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Reserva copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la reserva', 'error');
        });
}

function renderQueueReserveDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueReserveDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueReserveDeck(manifest, detectedPlatform);
    setHtml(
        '#queueReserveDeck',
        `
            <section class="queue-reserve-deck__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-reserve-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Respaldo después del siguiente</p>
                        <h5 id="queueReserveDeckTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueReserveDeckSummary" class="queue-reserve-deck__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <div class="queue-reserve-deck__meta">
                        <span
                            id="queueReserveDeckStatus"
                            class="queue-reserve-deck__status"
                            data-state="${escapeHtml(deck.statusState)}"
                        >
                            ${escapeHtml(deck.statusLabel)}
                        </span>
                        <button
                            id="queueReserveDeckCopyBtn"
                            type="button"
                            class="queue-reserve-deck__action"
                            ${deck.cards.length ? '' : 'disabled'}
                        >
                            Copiar reserva
                        </button>
                    </div>
                </div>
                <div id="queueReserveDeckCards" class="queue-reserve-deck__grid" role="list" aria-label="Reserva inmediata por consultorio">
                    ${deck.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueReserveCard_${escapeHtml(card.slotKey)}"
                                    class="queue-reserve-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-reserve-card__head">
                                        <div>
                                            <p class="queue-reserve-card__lane">${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</p>
                                            <strong id="queueReserveHeadline_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.headline)}</strong>
                                        </div>
                                        <span class="queue-reserve-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueReserveCurrent_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reserve-card__fact">${escapeHtml(
                                        `Actual: ${card.currentLabel}`
                                    )}</p>
                                    <p id="queueReserveNext_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reserve-card__fact">${escapeHtml(
                                        `Siguiente: ${card.nextLabel}`
                                    )}</p>
                                    <p id="queueReserveBuffer_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reserve-card__fact">${escapeHtml(
                                        `Reserva: ${card.reserveLabel}`
                                    )}</p>
                                    <p id="queueReserveSupport_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reserve-card__fact queue-reserve-card__fact--support">${escapeHtml(
                                        card.bufferLabel
                                    )}</p>
                                    <div class="queue-reserve-card__actions">
                                        <span class="queue-reserve-card__tag">${escapeHtml(
                                            card.operatorLabel
                                        )}</span>
                                        <button
                                            id="queueReservePrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-reserve-card__action"
                                            data-queue-reserve-ticket="${escapeHtml(
                                                card.pivot?.ticketCode || ''
                                            )}"
                                            data-queue-reserve-label="${escapeHtml(
                                                card.recommendationLabel
                                            )}"
                                            ${card.pivot ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(
                                                card.pivot?.label ||
                                                    card.recommendationLabel
                                            )}
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueReserveDeckCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueReserveDeck(deck);
        };
    }

    root.querySelectorAll('[data-queue-reserve-ticket]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const ticketCode = String(
                button.dataset.queueReserveTicket || ''
            ).trim();
            const label = String(button.dataset.queueReserveLabel || '').trim();
            if (!ticketCode) {
                return;
            }
            persistQueueTicketLookupTerm(ticketCode);
            appendOpsLogEntry({
                source: 'reserve',
                tone: 'info',
                title: 'Reserva inmediata: ticket cargado',
                summary: `${ticketCode} quedó cargado desde reserva inmediata (${label || 'sin recomendación visible'}).`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
}

function buildQueueGeneralGuidanceTarget(
    tickets,
    manifest,
    detectedPlatform,
    consultorio
) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const assignedWaiting = getAssignedWaitingTicketsFromList(tickets, slot);
    const currentTicket = getCalledTicketForConsultorioFromList(tickets, slot);
    const totalLoad = assignedWaiting.length + (currentTicket ? 1 : 0);
    const operatorReady =
        operatorContext.operatorAssigned && operatorContext.operatorLive;

    let score = 10 + totalLoad * 3 + (operatorReady ? 0 : 1);
    let badge = 'Balance';
    let reason = `Balancea la carga visible de ${slotKey.toUpperCase()}.`;

    if (currentTicket && assignedWaiting.length === 0) {
        score = operatorReady ? 0 : 1;
        badge = 'Hueco inmediato';
        reason = `Cubre el hueco que queda cuando cierres ${currentTicket.ticketCode}.`;
    } else if (assignedWaiting.length === 0) {
        score = operatorReady ? 2 : 3;
        badge = 'Rellena cola';
        reason = `Reconstruye la cola propia de ${slotKey.toUpperCase()} sin esperar a la tabla.`;
    } else if (assignedWaiting.length === 1) {
        score = operatorReady ? 4 : 5;
        badge = 'Deja reserva';
        reason = `Deja una reserva detrás de ${assignedWaiting[0].ticketCode} para que ${slotKey.toUpperCase()} no se seque.`;
    }

    return {
        slot,
        slotKey,
        score,
        badge,
        reason,
        operatorLabel: operatorContext.operatorLabel,
        operatorReady,
        loadLabel: `Atención ${currentTicket ? currentTicket.ticketCode : 'Libre'} · Espera ${assignedWaiting.length}`,
    };
}

function buildQueueGeneralGuidance(manifest, detectedPlatform) {
    const sourceTickets = getQueueSource().queueTickets.map((ticket) => ({
        ...ticket,
    }));
    const generalTickets = getUnassignedWaitingTicketsFromList(
        sourceTickets
    ).slice(0, 4);
    const items = [];

    generalTickets.forEach((ticket, index) => {
        const c1Target = buildQueueGeneralGuidanceTarget(
            sourceTickets,
            manifest,
            detectedPlatform,
            1
        );
        const c2Target = buildQueueGeneralGuidanceTarget(
            sourceTickets,
            manifest,
            detectedPlatform,
            2
        );
        const target = c1Target.score <= c2Target.score ? c1Target : c2Target;
        items.push({
            index,
            ticketId: Number(ticket.id || 0),
            ticketCode: String(ticket.ticketCode || ''),
            priorityLabel: formatQueuePriorityTypeLabel(ticket),
            ageLabel: formatQueueTicketAgeLabel(ticket, 'waiting'),
            targetSlot: target.slot,
            targetSlotKey: target.slotKey,
            badge: target.badge,
            reason: target.reason,
            operatorLabel: target.operatorLabel,
            loadLabel: target.loadLabel,
            pivot: buildQueueTicketRoutePivot(
                ticket,
                `Cargar ${String(ticket.ticketCode || '')}`,
                `Es el siguiente ticket general recomendado para ${target.slotKey.toUpperCase()}.`
            ),
        });
        const targetIndex = sourceTickets.findIndex(
            (candidate) => Number(candidate.id || 0) === Number(ticket.id || 0)
        );
        if (targetIndex >= 0) {
            sourceTickets[targetIndex] = {
                ...sourceTickets[targetIndex],
                assignedConsultorio: target.slot,
            };
        }
    });

    const top = items[0] || null;
    return {
        title: 'Cola general guiada',
        summary: top
            ? `${top.ticketCode} conviene enviarlo a ${top.targetSlotKey.toUpperCase()}. ${top.reason}`
            : 'No hay tickets generales esperando una recomendación de consultorio.',
        statusLabel: items.length
            ? `${items.length} ticket(s) general(es) guiado(s)`
            : 'Sin cola general',
        statusState: top ? 'ready' : 'idle',
        items,
        projectedTickets: sourceTickets,
    };
}

function copyQueueGeneralGuidance(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Cola general guiada - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...(panel.items.length
            ? panel.items.map(
                  (item, index) =>
                      `${index + 1}. ${item.ticketCode} -> ${item.targetSlotKey.toUpperCase()} · ${item.badge} · ${item.reason}`
              )
            : ['Sin tickets generales pendientes.']),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Cola general copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la cola general guiada', 'error');
        });
}

function renderQueueGeneralGuidance(manifest, detectedPlatform) {
    const root = document.getElementById('queueGeneralGuidance');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueGeneralGuidance(manifest, detectedPlatform);
    setHtml(
        '#queueGeneralGuidance',
        `
            <section class="queue-general-guidance__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-general-guidance__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Asignación sugerida para general</p>
                        <h5 id="queueGeneralGuidanceTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueGeneralGuidanceSummary" class="queue-general-guidance__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-general-guidance__meta">
                        <span
                            id="queueGeneralGuidanceStatus"
                            class="queue-general-guidance__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueGeneralGuidanceCopyBtn"
                            type="button"
                            class="queue-general-guidance__action"
                            ${panel.items.length ? '' : 'disabled'}
                        >
                            Copiar cola general
                        </button>
                    </div>
                </div>
                ${
                    panel.items.length
                        ? `
                            <div id="queueGeneralGuidanceItems" class="queue-general-guidance__list" role="list" aria-label="Asignación guiada de cola general">
                                ${panel.items
                                    .map(
                                        (item, index) => `
                                            <article
                                                id="queueGeneralGuidanceItem_${index}"
                                                class="queue-general-guidance__item"
                                                role="listitem"
                                            >
                                                <div class="queue-general-guidance__copy">
                                                    <div class="queue-general-guidance__headline">
                                                        <span class="queue-general-guidance__lane">${escapeHtml(
                                                            item.targetSlotKey.toUpperCase()
                                                        )}</span>
                                                        <strong id="queueGeneralGuidanceHeadline_${index}">${escapeHtml(
                                                            `${item.ticketCode} · ${item.badge}`
                                                        )}</strong>
                                                    </div>
                                                    <p id="queueGeneralGuidanceReason_${index}" class="queue-general-guidance__reason">${escapeHtml(
                                                        `${item.priorityLabel} · ${item.ageLabel}. ${item.reason}`
                                                    )}</p>
                                                    <p id="queueGeneralGuidanceTarget_${index}" class="queue-general-guidance__target">${escapeHtml(
                                                        `Enviar a ${item.targetSlotKey.toUpperCase()}. ${item.operatorLabel}. ${item.loadLabel}`
                                                    )}</p>
                                                </div>
                                                <div class="queue-general-guidance__actions">
                                                    <span class="queue-general-guidance__badge">${escapeHtml(
                                                        `Enviar a ${item.targetSlotKey.toUpperCase()}`
                                                    )}</span>
                                                    <button
                                                        id="queueGeneralGuidanceLoad_${index}"
                                                        type="button"
                                                        class="queue-general-guidance__load"
                                                        data-queue-general-guidance-ticket="${escapeHtml(
                                                            item.ticketCode
                                                        )}"
                                                    >
                                                        ${escapeHtml(
                                                            item.pivot?.label ||
                                                                'Cargar ticket'
                                                        )}
                                                    </button>
                                                </div>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : `
                            <article id="queueGeneralGuidanceEmpty" class="queue-general-guidance__empty">
                                <strong>Sin cola general por guiar</strong>
                                <p>Todo lo pendiente ya tiene consultorio o no hay tickets esperando reparto.</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueGeneralGuidanceCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueGeneralGuidance(panel);
        };
    }

    root.querySelectorAll('[data-queue-general-guidance-ticket]').forEach(
        (button) => {
            if (!(button instanceof HTMLButtonElement)) {
                return;
            }
            button.onclick = () => {
                const ticketCode = String(
                    button.dataset.queueGeneralGuidanceTicket || ''
                ).trim();
                if (!ticketCode) {
                    return;
                }
                persistQueueTicketLookupTerm(ticketCode);
                appendOpsLogEntry({
                    source: 'general_guidance',
                    tone: 'info',
                    title: 'Cola general guiada: ticket cargado',
                    summary: `${ticketCode} quedó cargado desde la cola general guiada.`,
                });
                rerenderQueueOpsHub(manifest, detectedPlatform);
            };
        }
    );
}

function buildQueueProjectedLane(
    manifest,
    detectedPlatform,
    guidance,
    consultorio
) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const tickets = Array.isArray(guidance?.projectedTickets)
        ? guidance.projectedTickets
        : getQueueSource().queueTickets;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const currentTicket = getCalledTicketForConsultorioFromList(tickets, slot);
    const waitingTickets = getAssignedWaitingTicketsFromList(
        tickets,
        slot
    ).slice(0, 3);
    const sequenceCodes = waitingTickets.map((ticket) =>
        String(ticket.ticketCode || '')
    );
    const firstProjected = waitingTickets[0] || null;

    let state = 'idle';
    let badge = 'Sin cola proyectada';
    let headline = `${slotKey.toUpperCase()} seguiría vacío`;
    let currentLabel = currentTicket
        ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
              currentTicket,
              'called'
          )}`
        : 'Sin paciente en atención';
    let sequenceLabel = 'Sin pasos proyectados';
    let supportLabel =
        'No hay tickets listos para sostener este carril tras aplicar la guía.';

    if (waitingTickets.length >= 2) {
        state = 'ready';
        badge = `${waitingTickets.length} pasos`;
        headline = `${slotKey.toUpperCase()} quedaría con reserva real`;
        sequenceLabel = sequenceCodes.join(' -> ');
        supportLabel = `${sequenceCodes[0]} sostiene el siguiente turno y ${sequenceCodes[1]} deja respaldo inmediato.`;
    } else if (waitingTickets.length === 1 && currentTicket) {
        state = 'suggested';
        badge = '1 paso';
        headline = `${slotKey.toUpperCase()} queda cubierto, pero sin reserva`;
        sequenceLabel = sequenceCodes[0];
        supportLabel = `${sequenceCodes[0]} entra después de ${currentTicket.ticketCode}, pero todavía faltaría otro turno detrás.`;
    } else if (waitingTickets.length === 1) {
        state = 'warning';
        badge = '1 paso';
        headline = `${slotKey.toUpperCase()} tendría un único paso proyectado`;
        sequenceLabel = sequenceCodes[0];
        supportLabel = `${sequenceCodes[0]} reconstruye ${slotKey.toUpperCase()}, pero aún no deja colchón de reserva.`;
    } else if (currentTicket) {
        state = 'alert';
        badge = 'Sin siguiente';
        headline = `${slotKey.toUpperCase()} seguiría sin cola tras el cierre actual`;
        supportLabel = `No hay tickets proyectados después de ${currentTicket.ticketCode}.`;
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        currentLabel,
        sequenceLabel,
        supportLabel,
        operatorLabel: operatorContext.operatorLabel,
        pivot: firstProjected
            ? buildQueueTicketRoutePivot(
                  firstProjected,
                  `Cargar ${firstProjected.ticketCode}`,
                  `Es el primer turno proyectado para ${slotKey.toUpperCase()} después de aplicar la guía.`
              )
            : null,
    };
}

function buildQueueProjectedDeck(manifest, detectedPlatform) {
    const guidance = buildQueueGeneralGuidance(manifest, detectedPlatform);
    const cards = [1, 2].map((slot) =>
        buildQueueProjectedLane(manifest, detectedPlatform, guidance, slot)
    );
    const top =
        cards.find((card) => card.state === 'alert') ||
        cards.find((card) => card.state === 'warning') ||
        cards.find((card) => card.state === 'suggested') ||
        cards.find((card) => card.state === 'ready') ||
        null;
    const stableCount = cards.filter((card) => card.state === 'ready').length;

    return {
        title: 'Proyección de cola',
        summary: top
            ? `${top.headline}. ${top.supportLabel}`
            : 'No hay carriles con proyección útil ahora mismo.',
        statusLabel: top
            ? `${stableCount}/2 carril(es) con reserva proyectada`
            : 'Sin proyección',
        statusState: top ? top.state : 'idle',
        cards,
    };
}

function copyQueueProjectedDeck(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Proyección de cola - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.slotKey.toUpperCase()} - ${card.badge}`,
            `Actual: ${card.currentLabel}`,
            `Secuencia: ${card.sequenceLabel}`,
            `Lectura: ${card.supportLabel}`,
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Proyección copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la proyección', 'error');
        });
}

function renderQueueProjectedDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueProjectedDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueProjectedDeck(manifest, detectedPlatform);
    setHtml(
        '#queueProjectedDeck',
        `
            <section class="queue-projected-deck__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-projected-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Lectura después de aplicar la guía</p>
                        <h5 id="queueProjectedDeckTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueProjectedDeckSummary" class="queue-projected-deck__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-projected-deck__meta">
                        <span
                            id="queueProjectedDeckStatus"
                            class="queue-projected-deck__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueProjectedDeckCopyBtn"
                            type="button"
                            class="queue-projected-deck__action"
                            ${panel.cards.length ? '' : 'disabled'}
                        >
                            Copiar proyección
                        </button>
                    </div>
                </div>
                <div id="queueProjectedDeckCards" class="queue-projected-deck__grid" role="list" aria-label="Proyección de cola por consultorio">
                    ${panel.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueProjectedCard_${escapeHtml(card.slotKey)}"
                                    class="queue-projected-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-projected-card__head">
                                        <div>
                                            <p class="queue-projected-card__lane">${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</p>
                                            <strong id="queueProjectedHeadline_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.headline)}</strong>
                                        </div>
                                        <span class="queue-projected-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueProjectedCurrent_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-projected-card__fact">${escapeHtml(
                                        `Actual: ${card.currentLabel}`
                                    )}</p>
                                    <p id="queueProjectedSequence_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-projected-card__fact">${escapeHtml(
                                        `Secuencia: ${card.sequenceLabel}`
                                    )}</p>
                                    <p id="queueProjectedSupport_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-projected-card__fact queue-projected-card__fact--support">${escapeHtml(
                                        card.supportLabel
                                    )}</p>
                                    <div class="queue-projected-card__actions">
                                        <span class="queue-projected-card__tag">${escapeHtml(
                                            card.operatorLabel
                                        )}</span>
                                        <button
                                            id="queueProjectedPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-projected-card__action"
                                            data-queue-projected-ticket="${escapeHtml(
                                                card.pivot?.ticketCode || ''
                                            )}"
                                            ${card.pivot ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(
                                                card.pivot?.label ||
                                                    'Sin proyección'
                                            )}
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueProjectedDeckCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueProjectedDeck(panel);
        };
    }

    root.querySelectorAll('[data-queue-projected-ticket]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const ticketCode = String(
                button.dataset.queueProjectedTicket || ''
            ).trim();
            if (!ticketCode) {
                return;
            }
            persistQueueTicketLookupTerm(ticketCode);
            appendOpsLogEntry({
                source: 'projection',
                tone: 'info',
                title: 'Proyección de cola: ticket cargado',
                summary: `${ticketCode} quedó cargado desde la proyección de cola.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
}

function buildQueueIncomingSimulation(manifest, detectedPlatform) {
    const guidance = buildQueueGeneralGuidance(manifest, detectedPlatform);
    const simulationTickets = Array.isArray(guidance?.projectedTickets)
        ? guidance.projectedTickets.map((ticket) => ({ ...ticket }))
        : getQueueSource().queueTickets.map((ticket) => ({ ...ticket }));
    const steps = [];

    for (let index = 0; index < 2; index += 1) {
        const c1Target = buildQueueGeneralGuidanceTarget(
            simulationTickets,
            manifest,
            detectedPlatform,
            1
        );
        const c2Target = buildQueueGeneralGuidanceTarget(
            simulationTickets,
            manifest,
            detectedPlatform,
            2
        );
        const target = c1Target.score <= c2Target.score ? c1Target : c2Target;
        const label = `Ingreso ${index + 1}`;
        steps.push({
            index,
            label,
            slot: target.slot,
            slotKey: target.slotKey,
            badge: target.badge,
            reason: target.reason,
            operatorLabel: target.operatorLabel,
        });
        simulationTickets.push({
            id: -910000 - index,
            ticketCode: `NUEVO-${index + 1}`,
            queueType: 'walk_in',
            patientInitials: 'NV',
            priorityClass: 'walk_in',
            status: 'waiting',
            assignedConsultorio: target.slot,
            createdAt: new Date(Date.now() + index * 1000).toISOString(),
        });
    }

    return {
        guidance,
        steps,
    };
}

function buildQueueIncomingCard(
    manifest,
    detectedPlatform,
    intake,
    consultorio
) {
    const slot = Number(consultorio || 0) === 2 ? 2 : 1;
    const slotKey = `c${slot}`;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const projectedTickets = Array.isArray(intake?.guidance?.projectedTickets)
        ? intake.guidance.projectedTickets
        : getQueueSource().queueTickets;
    const currentTicket = getCalledTicketForConsultorioFromList(
        projectedTickets,
        slot
    );
    const projectedWaiting = getAssignedWaitingTicketsFromList(
        projectedTickets,
        slot
    ).slice(0, 3);
    const projectedCodes = projectedWaiting.map((ticket) =>
        String(ticket.ticketCode || '')
    );
    const incomingSteps = (
        Array.isArray(intake?.steps) ? intake.steps : []
    ).filter((step) => Number(step.slot || 0) === slot);
    const operatorReady =
        operatorContext.operatorAssigned && operatorContext.operatorLive;

    let state = 'idle';
    let badge = 'Sin ingreso sugerido';
    let headline = `${slotKey.toUpperCase()} no sería el próximo destino`;
    let supportLabel =
        'La proyección actual no necesita mandar gente nueva a este carril todavía.';

    if (incomingSteps.length >= 2) {
        state = operatorReady ? 'ready' : 'warning';
        badge = operatorReady ? 'Absorbe 2' : 'Prepara operador';
        headline = `${slotKey.toUpperCase()} absorbería los 2 próximos ingresos`;
        supportLabel = operatorReady
            ? `${incomingSteps[0].label} entraría primero y ${incomingSteps[1].label} volvería a ${slotKey.toUpperCase()} sin romper la reserva visible.`
            : `${incomingSteps[0].label} y ${incomingSteps[1].label} caerían aquí, pero conviene abrir el operador antes de confiar en ese flujo.`;
    } else if (incomingSteps.length === 1) {
        state = operatorReady ? 'suggested' : 'warning';
        badge = operatorReady ? 'Absorbe 1' : 'Abre operador';
        headline = `${slotKey.toUpperCase()} absorbería 1 ingreso nuevo`;
        supportLabel = operatorReady
            ? `${incomingSteps[0].label} caería primero aquí. ${incomingSteps[0].reason}`
            : `${incomingSteps[0].label} caería primero aquí, pero conviene abrir el operador antes de que llegue ese ingreso.`;
    } else if (projectedWaiting.length >= 2) {
        state = 'idle';
        badge = 'Reserva completa';
        headline = `${slotKey.toUpperCase()} ya quedó cubierto por ahora`;
        supportLabel = `${projectedCodes[0]}${projectedCodes[1] ? ` y ${projectedCodes[1]}` : ''} ya sostienen este carril; deja que el otro absorba lo nuevo.`;
    } else if (projectedWaiting.length === 1 || currentTicket) {
        state = 'warning';
        badge = 'Prioriza el otro';
        headline = `${slotKey.toUpperCase()} no sería el siguiente destino`;
        supportLabel =
            'Tras la proyección actual, el otro carril ofrece una ventana más limpia para los próximos ingresos.';
    } else {
        state = 'alert';
        badge = 'Sin base';
        headline = `${slotKey.toUpperCase()} sigue sin base para absorber`;
        supportLabel =
            'Primero reconstruye contexto, cola u operador antes de mandar ingresos nuevos aquí.';
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        currentLabel: currentTicket
            ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  currentTicket,
                  'called'
              )}`
            : 'Sin paciente en atención',
        sequenceLabel: projectedCodes.length
            ? projectedCodes.join(' -> ')
            : 'Sin cola proyectada',
        incomingLabel: incomingSteps.length
            ? incomingSteps.map((step) => step.label).join(' -> ')
            : 'Sin ingreso nuevo sugerido',
        supportLabel,
        operatorLabel: operatorContext.operatorLabel,
        actionLabel: operatorReady
            ? `Revisar operador ${slotKey.toUpperCase()}`
            : `Abrir operador ${slotKey.toUpperCase()}`,
        operatorUrl: operatorContext.operatorUrl,
    };
}

function buildQueueIncomingDeck(manifest, detectedPlatform) {
    const intake = buildQueueIncomingSimulation(manifest, detectedPlatform);
    const cards = [1, 2].map((slot) =>
        buildQueueIncomingCard(manifest, detectedPlatform, intake, slot)
    );
    const steps = Array.isArray(intake.steps) ? intake.steps : [];
    const first = steps[0] || null;
    const second = steps[1] || null;
    const top =
        cards.find((card) => card.state === 'alert') ||
        cards.find((card) => card.state === 'warning') ||
        cards.find((card) => card.state === 'suggested') ||
        cards.find((card) => card.state === 'ready') ||
        null;

    let summary =
        'La proyección de nuevos ingresos no detecta un carril claramente preferido ahora mismo.';
    if (first && second && first.slot === second.slot) {
        summary = `${first.label} y ${second.label} convendrían a ${first.slotKey.toUpperCase()} si entra gente nueva ahora.`;
    } else if (first && second) {
        summary = `${first.label} conviene a ${first.slotKey.toUpperCase()}. ${second.label} volvería a ${second.slotKey.toUpperCase()} si entra otra persona enseguida.`;
    } else if (first) {
        summary = `${first.label} conviene a ${first.slotKey.toUpperCase()} si recepción recibe a alguien nuevo ahora.`;
    }

    return {
        title: 'Ingresos nuevos',
        summary,
        statusLabel: steps.length
            ? `${steps.length} ingreso(s) nuevos guiados`
            : 'Sin simulación de ingresos',
        statusState: top ? top.state : 'idle',
        cards,
    };
}

function copyQueueIncomingDeck(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Ingresos nuevos - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.slotKey.toUpperCase()} - ${card.badge}`,
            `Actual: ${card.currentLabel}`,
            `Base: ${card.sequenceLabel}`,
            `Nuevos: ${card.incomingLabel}`,
            `Lectura: ${card.supportLabel}`,
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Ingresos nuevos copiados', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la guía de ingresos', 'error');
        });
}

function renderQueueIncomingDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueIncomingDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueIncomingDeck(manifest, detectedPlatform);
    setHtml(
        '#queueIncomingDeck',
        `
            <section class="queue-incoming-deck__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-incoming-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Si entra gente nueva ahora</p>
                        <h5 id="queueIncomingDeckTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueIncomingDeckSummary" class="queue-incoming-deck__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-incoming-deck__meta">
                        <span
                            id="queueIncomingDeckStatus"
                            class="queue-incoming-deck__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueIncomingDeckCopyBtn"
                            type="button"
                            class="queue-incoming-deck__action"
                            ${panel.cards.length ? '' : 'disabled'}
                        >
                            Copiar ingresos
                        </button>
                    </div>
                </div>
                <div id="queueIncomingDeckCards" class="queue-incoming-deck__grid" role="list" aria-label="Guía de ingresos nuevos por consultorio">
                    ${panel.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueIncomingCard_${escapeHtml(card.slotKey)}"
                                    class="queue-incoming-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-incoming-card__head">
                                        <div>
                                            <p class="queue-incoming-card__lane">${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</p>
                                            <strong id="queueIncomingHeadline_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.headline)}</strong>
                                        </div>
                                        <span class="queue-incoming-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueIncomingCurrent_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-incoming-card__fact">${escapeHtml(
                                        `Actual: ${card.currentLabel}`
                                    )}</p>
                                    <p id="queueIncomingSequence_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-incoming-card__fact">${escapeHtml(
                                        `Base: ${card.sequenceLabel} · Nuevos: ${card.incomingLabel}`
                                    )}</p>
                                    <p id="queueIncomingSupport_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-incoming-card__fact queue-incoming-card__fact--support">${escapeHtml(
                                        card.supportLabel
                                    )}</p>
                                    <div class="queue-incoming-card__actions">
                                        <span class="queue-incoming-card__tag">${escapeHtml(
                                            card.operatorLabel
                                        )}</span>
                                        <a
                                            id="queueIncomingOpen_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-incoming-card__action"
                                            data-queue-incoming-open="${escapeHtml(
                                                card.slotKey
                                            )}"
                                            data-queue-incoming-label="${escapeHtml(
                                                card.actionLabel
                                            )}"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            ${escapeHtml(card.actionLabel)}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueIncomingDeckCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueIncomingDeck(panel);
        };
    }

    root.querySelectorAll('[data-queue-incoming-open]').forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }
        link.onclick = () => {
            const slotKey = String(link.dataset.queueIncomingOpen || '').trim();
            const actionLabel = String(
                link.dataset.queueIncomingLabel || ''
            ).trim();
            appendOpsLogEntry({
                source: 'new_intake',
                tone: 'info',
                title: `Ingresos nuevos ${slotKey.toUpperCase()}: operador abierto`,
                summary: `${actionLabel || 'Se abrió el operador'} desde la guía de ingresos nuevos.`,
            });
        };
    });
}

function buildQueueScenarioCandidates(
    manifest,
    detectedPlatform,
    tickets,
    queueType
) {
    const scenarioType =
        String(queueType || '')
            .trim()
            .toLowerCase() === 'appointment'
            ? 'appointment'
            : 'walk_in';
    const cards = [1, 2].map((slot) => {
        const slotKey = `c${slot}`;
        const operatorContext = buildConsultorioOperatorContext(
            manifest,
            detectedPlatform,
            slot
        );
        const currentTicket = getCalledTicketForConsultorioFromList(
            tickets,
            slot
        );
        const waitingTickets = getAssignedWaitingTicketsFromList(
            tickets,
            slot
        ).slice(0, 3);
        const waitingCount = waitingTickets.length;
        const reserveDepth = waitingCount;
        let score = 0;
        let reason = '';
        let badge = '';

        if (scenarioType === 'appointment') {
            score =
                waitingCount * 4 +
                (currentTicket ? 0 : 2) +
                (operatorContext.operatorAssigned &&
                operatorContext.operatorLive
                    ? 0
                    : 1);
            badge = 'Con cita';
            if (waitingCount === 0 && currentTicket) {
                reason = `Queda hueco directo cuando cierres ${currentTicket.ticketCode}.`;
            } else if (waitingCount <= 1) {
                reason = `Mantiene la cita en un carril corto sin amontonar la espera.`;
            } else {
                reason = `Absorbe la cita, pero ya cargaría una cola más larga.`;
            }
        } else {
            score =
                (operatorContext.operatorAssigned &&
                operatorContext.operatorLive
                    ? 0
                    : 4) +
                (reserveDepth >= 2 ? 0 : reserveDepth === 1 ? 3 : 6) +
                (currentTicket ? 0 : 2);
            badge = 'Sin cita';
            if (reserveDepth >= 2) {
                reason = `Ya tiene reserva suficiente para absorber un walk-in sin romper el ritmo.`;
            } else if (reserveDepth === 1) {
                reason = `Puede absorber un walk-in, pero te deja un colchón más corto.`;
            } else {
                reason = `Recibir un walk-in aquí abriría un hueco muy rápido.`;
            }
        }

        return {
            slot,
            slotKey,
            score,
            badge,
            reason,
            operatorLabel: operatorContext.operatorLabel,
            operatorUrl: operatorContext.operatorUrl,
            currentLabel: currentTicket
                ? `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                      currentTicket,
                      'called'
                  )}`
                : 'Sin paciente en atención',
            sequenceLabel: waitingTickets.length
                ? waitingTickets
                      .map((ticket) => String(ticket.ticketCode || ''))
                      .join(' -> ')
                : 'Sin cola proyectada',
            operatorReady:
                operatorContext.operatorAssigned &&
                operatorContext.operatorLive,
        };
    });

    return cards.sort((left, right) => {
        if (left.score !== right.score) {
            return left.score - right.score;
        }
        return left.slot - right.slot;
    });
}

function buildQueueScenarioTarget(
    manifest,
    detectedPlatform,
    tickets,
    queueType
) {
    return (
        buildQueueScenarioCandidates(
            manifest,
            detectedPlatform,
            tickets,
            queueType
        )[0] || null
    );
}

function buildQueueScenarioDeck(manifest, detectedPlatform) {
    const guidance = buildQueueGeneralGuidance(manifest, detectedPlatform);
    const projectedTickets = Array.isArray(guidance?.projectedTickets)
        ? guidance.projectedTickets
        : getQueueSource().queueTickets;
    const appointmentScenario = buildQueueScenarioTarget(
        manifest,
        detectedPlatform,
        projectedTickets,
        'appointment'
    );
    const walkInScenario = buildQueueScenarioTarget(
        manifest,
        detectedPlatform,
        projectedTickets,
        'walk_in'
    );
    const cards = [appointmentScenario, walkInScenario];
    const top =
        cards.find((card) => !card.operatorReady) ||
        cards.find((card) => card.badge === 'Con cita') ||
        cards[0] ||
        null;

    return {
        title: 'Escenarios de ingreso',
        summary:
            appointmentScenario && walkInScenario
                ? `Si llega con cita conviene ${appointmentScenario.slotKey.toUpperCase()}. Si llega sin cita conviene ${walkInScenario.slotKey.toUpperCase()}.`
                : 'No hay lectura suficiente para decidir el próximo ingreso.',
        statusLabel: '2 escenarios listos',
        statusState: top && !top.operatorReady ? 'warning' : 'ready',
        cards,
    };
}

function copyQueueScenarioDeck(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Escenarios de ingreso - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.badge} -> ${card.slotKey.toUpperCase()}`,
            `Actual: ${card.currentLabel}`,
            `Base: ${card.sequenceLabel}`,
            `Lectura: ${card.reason}`,
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Escenarios copiados', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar escenarios', 'error');
        });
}

function renderQueueScenarioDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueScenarioDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueScenarioDeck(manifest, detectedPlatform);
    setHtml(
        '#queueScenarioDeck',
        `
            <section class="queue-scenario-deck__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-scenario-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Recepción por tipo</p>
                        <h5 id="queueScenarioDeckTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueScenarioDeckSummary" class="queue-scenario-deck__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-scenario-deck__meta">
                        <span
                            id="queueScenarioDeckStatus"
                            class="queue-scenario-deck__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueScenarioDeckCopyBtn"
                            type="button"
                            class="queue-scenario-deck__action"
                        >
                            Copiar escenarios
                        </button>
                    </div>
                </div>
                <div id="queueScenarioDeckCards" class="queue-scenario-deck__grid" role="list" aria-label="Escenarios de ingreso por tipo">
                    ${panel.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueScenarioCard_${escapeHtml(card.badge === 'Con cita' ? 'appointment' : 'walkin')}"
                                    class="queue-scenario-card"
                                    data-state="${escapeHtml(
                                        card.operatorReady ? 'ready' : 'warning'
                                    )}"
                                    role="listitem"
                                >
                                    <div class="queue-scenario-card__head">
                                        <div>
                                            <p class="queue-scenario-card__lane">${escapeHtml(
                                                card.badge
                                            )}</p>
                                            <strong id="queueScenarioHeadline_${escapeHtml(card.badge === 'Con cita' ? 'appointment' : 'walkin')}">${escapeHtml(
                                                `${card.badge}: ${card.slotKey.toUpperCase()}`
                                            )}</strong>
                                        </div>
                                        <span class="queue-scenario-card__badge">${escapeHtml(
                                            card.operatorReady
                                                ? 'Operable'
                                                : 'Abre operador'
                                        )}</span>
                                    </div>
                                    <p id="queueScenarioCurrent_${escapeHtml(card.badge === 'Con cita' ? 'appointment' : 'walkin')}" class="queue-scenario-card__fact">${escapeHtml(
                                        `Actual: ${card.currentLabel}`
                                    )}</p>
                                    <p id="queueScenarioSequence_${escapeHtml(card.badge === 'Con cita' ? 'appointment' : 'walkin')}" class="queue-scenario-card__fact">${escapeHtml(
                                        `Base: ${card.sequenceLabel}`
                                    )}</p>
                                    <p id="queueScenarioSupport_${escapeHtml(card.badge === 'Con cita' ? 'appointment' : 'walkin')}" class="queue-scenario-card__fact queue-scenario-card__fact--support">${escapeHtml(
                                        card.reason
                                    )}</p>
                                    <div class="queue-scenario-card__actions">
                                        <span class="queue-scenario-card__tag">${escapeHtml(
                                            card.operatorLabel
                                        )}</span>
                                        <a
                                            id="queueScenarioOpen_${escapeHtml(card.badge === 'Con cita' ? 'appointment' : 'walkin')}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-scenario-card__action"
                                            data-queue-scenario-open="${escapeHtml(
                                                card.badge === 'Con cita'
                                                    ? 'appointment'
                                                    : 'walkin'
                                            )}"
                                            data-queue-scenario-label="${escapeHtml(
                                                card.badge
                                            )}"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            ${escapeHtml(
                                                card.operatorReady
                                                    ? `Abrir ${card.slotKey.toUpperCase()}`
                                                    : `Preparar ${card.slotKey.toUpperCase()}`
                                            )}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueScenarioDeckCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueScenarioDeck(panel);
        };
    }

    root.querySelectorAll('[data-queue-scenario-open]').forEach((link) => {
        if (!(link instanceof HTMLAnchorElement)) {
            return;
        }
        link.onclick = () => {
            const label = String(link.dataset.queueScenarioLabel || '').trim();
            appendOpsLogEntry({
                source: 'intake_scenarios',
                tone: 'info',
                title: 'Escenarios de ingreso: operador abierto',
                summary: `${label || 'Escenario'} quedó abierto desde el panel de recepción por tipo.`,
            });
        };
    });
}

function buildQueueReceptionScript(manifest, detectedPlatform) {
    const guidance = buildQueueGeneralGuidance(manifest, detectedPlatform);
    const incoming = buildQueueIncomingDeck(manifest, detectedPlatform);
    const scenarios = buildQueueScenarioDeck(manifest, detectedPlatform);
    const generalLead = Array.isArray(guidance.items)
        ? guidance.items[0]
        : null;
    const appointmentScenario =
        Array.isArray(scenarios.cards) &&
        scenarios.cards.find((card) => card.badge === 'Con cita');
    const walkInScenario =
        Array.isArray(scenarios.cards) &&
        scenarios.cards.find((card) => card.badge === 'Sin cita');
    const incomingLead =
        Array.isArray(incoming.cards) &&
        incoming.cards
            .filter(
                (card) =>
                    String(card.incomingLabel || '') !==
                    'Sin ingreso nuevo sugerido'
            )
            .sort((left, right) => {
                const leftLabel = String(left.incomingLabel || '');
                const rightLabel = String(right.incomingLabel || '');
                return leftLabel.localeCompare(rightLabel);
            })[0];

    const items = [];

    if (generalLead) {
        items.push({
            key: 'general',
            tone: 'ready',
            label: 'Cola general',
            headline: `${generalLead.ticketCode} -> ${generalLead.targetSlotKey.toUpperCase()}`,
            detail: generalLead.reason,
            actionLabel: `Abrir ${generalLead.targetSlotKey.toUpperCase()}`,
            actionUrl: buildConsultorioOperatorContext(
                manifest,
                detectedPlatform,
                generalLead.targetSlot
            ).operatorUrl,
        });
    }

    if (appointmentScenario) {
        items.push({
            key: 'appointment',
            tone: appointmentScenario.operatorReady ? 'ready' : 'warning',
            label: 'Con cita',
            headline: `Enviar a ${appointmentScenario.slotKey.toUpperCase()}`,
            detail: appointmentScenario.reason,
            actionLabel: appointmentScenario.operatorReady
                ? `Abrir ${appointmentScenario.slotKey.toUpperCase()}`
                : `Preparar ${appointmentScenario.slotKey.toUpperCase()}`,
            actionUrl: appointmentScenario.operatorUrl,
        });
    }

    if (walkInScenario) {
        items.push({
            key: 'walkin',
            tone: walkInScenario.operatorReady ? 'ready' : 'warning',
            label: 'Sin cita',
            headline: `Enviar a ${walkInScenario.slotKey.toUpperCase()}`,
            detail: walkInScenario.reason,
            actionLabel: walkInScenario.operatorReady
                ? `Abrir ${walkInScenario.slotKey.toUpperCase()}`
                : `Preparar ${walkInScenario.slotKey.toUpperCase()}`,
            actionUrl: walkInScenario.operatorUrl,
        });
    }

    if (incomingLead) {
        items.push({
            key: 'incoming',
            tone: incomingLead.state === 'warning' ? 'warning' : 'ready',
            label: 'Si entra otro',
            headline: `${incomingLead.incomingLabel} -> ${incomingLead.slotKey.toUpperCase()}`,
            detail: incomingLead.supportLabel,
            actionLabel: incomingLead.actionLabel,
            actionUrl: incomingLead.operatorUrl,
        });
    }

    const top =
        items.find((item) => item.tone === 'warning') || items[0] || null;

    return {
        title: 'Guion de recepción',
        summary: top
            ? `${top.label}: ${top.headline}. ${top.detail}`
            : 'No hay guion corto disponible ahora mismo.',
        statusLabel: items.length
            ? `${items.length} decisiones rápidas`
            : 'Sin guion disponible',
        statusState: top ? top.tone : 'idle',
        items,
    };
}

function copyQueueReceptionScript(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Guion de recepción - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...(panel.items.length
            ? panel.items.map(
                  (item, index) =>
                      `${index + 1}. ${item.label}: ${item.headline}. ${item.detail}`
              )
            : ['Sin guion operativo visible.']),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Guion copiado', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar el guion', 'error');
        });
}

function renderQueueReceptionScript(manifest, detectedPlatform) {
    const root = document.getElementById('queueReceptionScript');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueReceptionScript(manifest, detectedPlatform);
    setHtml(
        '#queueReceptionScript',
        `
            <section class="queue-reception-script__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-reception-script__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Qué hacer en mostrador ahora</p>
                        <h5 id="queueReceptionScriptTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueReceptionScriptSummary" class="queue-reception-script__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-reception-script__meta">
                        <span
                            id="queueReceptionScriptStatus"
                            class="queue-reception-script__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueReceptionScriptCopyBtn"
                            type="button"
                            class="queue-reception-script__action"
                            ${panel.items.length ? '' : 'disabled'}
                        >
                            Copiar guion
                        </button>
                    </div>
                </div>
                ${
                    panel.items.length
                        ? `
                            <div id="queueReceptionScriptItems" class="queue-reception-script__list" role="list" aria-label="Guion operativo de recepción">
                                ${panel.items
                                    .map(
                                        (item, index) => `
                                            <article
                                                id="queueReceptionScriptItem_${index}"
                                                class="queue-reception-script__item"
                                                data-state="${escapeHtml(item.tone)}"
                                                role="listitem"
                                            >
                                                <div class="queue-reception-script__copy">
                                                    <div class="queue-reception-script__headline">
                                                        <span class="queue-reception-script__lane">${escapeHtml(
                                                            item.label
                                                        )}</span>
                                                        <strong id="queueReceptionScriptHeadline_${index}">${escapeHtml(
                                                            item.headline
                                                        )}</strong>
                                                    </div>
                                                    <p id="queueReceptionScriptDetail_${index}" class="queue-reception-script__detail">${escapeHtml(
                                                        item.detail
                                                    )}</p>
                                                </div>
                                                <div class="queue-reception-script__actions">
                                                    <a
                                                        id="queueReceptionScriptOpen_${index}"
                                                        href="${escapeHtml(
                                                            item.actionUrl
                                                        )}"
                                                        class="queue-reception-script__open"
                                                        data-queue-reception-script-label="${escapeHtml(
                                                            item.label
                                                        )}"
                                                        target="_blank"
                                                        rel="noopener"
                                                    >
                                                        ${escapeHtml(
                                                            item.actionLabel
                                                        )}
                                                    </a>
                                                </div>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : `
                            <article id="queueReceptionScriptEmpty" class="queue-reception-script__empty">
                                <strong>Sin guion visible</strong>
                                <p>Abre la cola del turno para reconstruir las decisiones rápidas de recepción.</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueReceptionScriptCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueReceptionScript(panel);
        };
    }

    root.querySelectorAll('[data-queue-reception-script-label]').forEach(
        (link) => {
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }
            link.onclick = () => {
                const label = String(
                    link.dataset.queueReceptionScriptLabel || ''
                ).trim();
                appendOpsLogEntry({
                    source: 'reception_script',
                    tone: 'info',
                    title: 'Guion de recepción: operador abierto',
                    summary: `${label || 'Recepción'} quedó abierto desde el guion operativo.`,
                });
            };
        }
    );
}

function buildQueueReceptionCollisionPlan(manifest, detectedPlatform) {
    const guidance = buildQueueGeneralGuidance(manifest, detectedPlatform);
    const projectedTickets = Array.isArray(guidance?.projectedTickets)
        ? guidance.projectedTickets
        : getQueueSource().queueTickets;
    const appointmentCandidates = buildQueueScenarioCandidates(
        manifest,
        detectedPlatform,
        projectedTickets,
        'appointment'
    );
    const walkInCandidates = buildQueueScenarioCandidates(
        manifest,
        detectedPlatform,
        projectedTickets,
        'walk_in'
    );
    const appointmentLead = appointmentCandidates[0] || null;
    const walkInPreferred = walkInCandidates[0] || null;
    let walkInLead = walkInPreferred;
    let forcedSplit = false;

    if (
        appointmentLead &&
        walkInPreferred &&
        Number(appointmentLead.slot || 0) === Number(walkInPreferred.slot || 0)
    ) {
        const alternateWalkIn =
            walkInCandidates.find(
                (candidate) =>
                    Number(candidate.slot || 0) !==
                    Number(appointmentLead.slot || 0)
            ) || null;
        if (alternateWalkIn) {
            forcedSplit = true;
            walkInLead = {
                ...alternateWalkIn,
                reason: `Con cita toma ${appointmentLead.slotKey.toUpperCase()} primero. Desvía el sin cita a ${alternateWalkIn.slotKey.toUpperCase()} para no chocar en el mismo carril. ${alternateWalkIn.reason}`,
            };
        }
    }

    const items = [];

    if (appointmentLead) {
        items.push({
            key: 'appointment',
            tone: appointmentLead.operatorReady ? 'ready' : 'warning',
            laneLabel: 'Con cita',
            headline: `1. Con cita -> ${appointmentLead.slotKey.toUpperCase()}`,
            detail: appointmentLead.reason,
            support: `Base actual: ${appointmentLead.currentLabel} · ${appointmentLead.sequenceLabel}`,
            actionLabel: appointmentLead.operatorReady
                ? `Abrir ${appointmentLead.slotKey.toUpperCase()}`
                : `Preparar ${appointmentLead.slotKey.toUpperCase()}`,
            actionUrl: appointmentLead.operatorUrl,
        });
    }

    if (walkInLead) {
        items.push({
            key: 'walkin',
            tone: walkInLead.operatorReady
                ? forcedSplit
                    ? 'suggested'
                    : 'ready'
                : 'warning',
            laneLabel: forcedSplit ? 'Sin cita desviado' : 'Sin cita',
            headline: `2. Sin cita -> ${walkInLead.slotKey.toUpperCase()}`,
            detail: walkInLead.reason,
            support: `Base actual: ${walkInLead.currentLabel} · ${walkInLead.sequenceLabel}`,
            actionLabel: walkInLead.operatorReady
                ? `Abrir ${walkInLead.slotKey.toUpperCase()}`
                : `Preparar ${walkInLead.slotKey.toUpperCase()}`,
            actionUrl: walkInLead.operatorUrl,
        });
    }

    const top =
        items.find((item) => item.tone === 'warning') ||
        items.find((item) => item.tone === 'suggested') ||
        items[0] ||
        null;

    let summary = 'No hay lectura suficiente para resolver una llegada doble.';
    if (appointmentLead && walkInLead) {
        summary = forcedSplit
            ? `Si llegan dos personas juntas, con cita entra por ${appointmentLead.slotKey.toUpperCase()} y sin cita se desvía a ${walkInLead.slotKey.toUpperCase()} para no bloquear el mismo carril.`
            : `Si llegan dos personas juntas, con cita conviene ${appointmentLead.slotKey.toUpperCase()} y sin cita conviene ${walkInLead.slotKey.toUpperCase()}.`;
    }

    let statusLabel = 'Sin llegada doble visible';
    if (items.length) {
        statusLabel = forcedSplit
            ? 'Cruce de mostrador resuelto'
            : 'Ingreso doble cubierto';
        if (items.some((item) => item.tone === 'warning')) {
            statusLabel = forcedSplit
                ? 'Cruce resuelto con preparación'
                : 'Ingreso doble con preparación';
        }
    }

    return {
        title: 'Recepción simultánea',
        summary,
        statusLabel,
        statusState: top ? top.tone : 'idle',
        forcedSplit,
        items,
    };
}

function copyQueueReceptionCollision(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Recepción simultánea - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...(panel.items.length
            ? panel.items.map((item) =>
                  `${item.headline}. ${item.detail} ${item.support}`.trim()
              )
            : ['Sin guion para llegada doble.']),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Recepción simultánea copiada', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar la recepción simultánea', 'error');
        });
}

function renderQueueReceptionCollision(manifest, detectedPlatform) {
    const root = document.getElementById('queueReceptionCollision');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueReceptionCollisionPlan(manifest, detectedPlatform);
    setHtml(
        '#queueReceptionCollision',
        `
            <section class="queue-reception-collision__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-reception-collision__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Si llegan dos personas juntas</p>
                        <h5 id="queueReceptionCollisionTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueReceptionCollisionSummary" class="queue-reception-collision__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-reception-collision__meta">
                        <span
                            id="queueReceptionCollisionStatus"
                            class="queue-reception-collision__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueReceptionCollisionCopyBtn"
                            type="button"
                            class="queue-reception-collision__action"
                            ${panel.items.length ? '' : 'disabled'}
                        >
                            Copiar llegada doble
                        </button>
                    </div>
                </div>
                ${
                    panel.items.length
                        ? `
                            <div id="queueReceptionCollisionCards" class="queue-reception-collision__grid" role="list" aria-label="Guía de recepción simultánea">
                                ${panel.items
                                    .map(
                                        (item) => `
                                            <article
                                                id="queueReceptionCollisionCard_${escapeHtml(
                                                    item.key
                                                )}"
                                                class="queue-reception-collision__card"
                                                data-state="${escapeHtml(item.tone)}"
                                                role="listitem"
                                            >
                                                <div class="queue-reception-collision__card-head">
                                                    <div>
                                                        <p class="queue-reception-collision__lane">${escapeHtml(
                                                            item.laneLabel
                                                        )}</p>
                                                        <strong id="queueReceptionCollisionHeadline_${escapeHtml(
                                                            item.key
                                                        )}">${escapeHtml(
                                                            item.headline
                                                        )}</strong>
                                                    </div>
                                                    <span class="queue-reception-collision__badge">${escapeHtml(
                                                        item.tone === 'warning'
                                                            ? 'Preparar'
                                                            : item.tone ===
                                                                'suggested'
                                                              ? 'Desvío'
                                                              : 'Listo'
                                                    )}</span>
                                                </div>
                                                <p id="queueReceptionCollisionDetail_${escapeHtml(
                                                    item.key
                                                )}" class="queue-reception-collision__detail">${escapeHtml(
                                                    item.detail
                                                )}</p>
                                                <p id="queueReceptionCollisionSupport_${escapeHtml(
                                                    item.key
                                                )}" class="queue-reception-collision__support">${escapeHtml(
                                                    item.support
                                                )}</p>
                                                <div class="queue-reception-collision__actions">
                                                    <a
                                                        id="queueReceptionCollisionOpen_${escapeHtml(
                                                            item.key
                                                        )}"
                                                        href="${escapeHtml(
                                                            item.actionUrl
                                                        )}"
                                                        class="queue-reception-collision__open"
                                                        data-queue-reception-collision-label="${escapeHtml(
                                                            item.laneLabel
                                                        )}"
                                                        target="_blank"
                                                        rel="noopener"
                                                    >
                                                        ${escapeHtml(
                                                            item.actionLabel
                                                        )}
                                                    </a>
                                                </div>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : `
                            <article id="queueReceptionCollisionEmpty" class="queue-reception-collision__empty">
                                <strong>Sin llegada doble visible</strong>
                                <p>Hace falta más contexto de cola para repartir dos ingresos a la vez.</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById(
        'queueReceptionCollisionCopyBtn'
    );
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueReceptionCollision(panel);
        };
    }

    root.querySelectorAll('[data-queue-reception-collision-label]').forEach(
        (link) => {
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }
            link.onclick = () => {
                const label = String(
                    link.dataset.queueReceptionCollisionLabel || ''
                ).trim();
                appendOpsLogEntry({
                    source: 'reception_collision',
                    tone: 'info',
                    title: 'Recepción simultánea: operador abierto',
                    summary: `${label || 'Llegada doble'} quedó abierto desde la guía de recepción simultánea.`,
                });
            };
        }
    );
}

function buildQueueReceptionLights(manifest, detectedPlatform) {
    const guidance = buildQueueGeneralGuidance(manifest, detectedPlatform);
    const projectedTickets = Array.isArray(guidance?.projectedTickets)
        ? guidance.projectedTickets
        : getQueueSource().queueTickets;
    const appointmentCandidates = buildQueueScenarioCandidates(
        manifest,
        detectedPlatform,
        projectedTickets,
        'appointment'
    );
    const walkInCandidates = buildQueueScenarioCandidates(
        manifest,
        detectedPlatform,
        projectedTickets,
        'walk_in'
    );
    const coverageDeck = buildQueueCoverageDeck(manifest, detectedPlatform);
    const reserveDeck = buildQueueReserveDeck(manifest, detectedPlatform);
    const coverageBySlot = new Map(
        (coverageDeck.cards || []).map((card) => [card.slot, card])
    );
    const reserveBySlot = new Map(
        (reserveDeck.cards || []).map((card) => [card.slot, card])
    );

    const cards = [1, 2].map((slot) => {
        const slotKey = `c${slot}`;
        const operatorContext = buildConsultorioOperatorContext(
            manifest,
            detectedPlatform,
            slot
        );
        const appointmentRank =
            appointmentCandidates.findIndex(
                (candidate) => Number(candidate.slot || 0) === slot
            ) + 1;
        const walkInRank =
            walkInCandidates.findIndex(
                (candidate) => Number(candidate.slot || 0) === slot
            ) + 1;
        const coverageCard = coverageBySlot.get(slot) || null;
        const reserveCard = reserveBySlot.get(slot) || null;

        let mode = 'hold';
        let tone = 'warning';
        let badge = 'Contener';
        let headline = `${slotKey.toUpperCase()} contener ingresos nuevos`;
        let detail =
            'Evita mandar gente nueva aquí hasta que el otro carril absorba más carga o se recupere la base.';

        if (walkInRank === 1) {
            mode = 'open';
            tone = operatorContext.operatorAssigned ? 'ready' : 'warning';
            badge = 'Abierto';
            headline = `${slotKey.toUpperCase()} abierto para recepción`;
            detail =
                appointmentRank === 1
                    ? 'Es el carril más limpio para recibir tanto citas como sin cita ahora mismo.'
                    : 'Es el carril más limpio para absorber sin cita sin romper el resto del flujo.';
        } else if (appointmentRank === 1) {
            mode = 'appointments';
            tone = operatorContext.operatorAssigned ? 'suggested' : 'warning';
            badge = 'Solo citas';
            headline = `${slotKey.toUpperCase()} reservar para citas`;
            detail =
                'Mantén este carril para quienes llegan con cita y deja que el otro absorba la entrada espontánea.';
        } else if (
            ['ready', 'suggested'].includes(String(reserveCard?.state || '')) ||
            ['ready', 'suggested'].includes(String(coverageCard?.state || ''))
        ) {
            mode = 'buffer';
            tone = 'suggested';
            badge = 'Reserva';
            headline = `${slotKey.toUpperCase()} mantener en reserva`;
            detail =
                'Este carril ya sostiene su propio siguiente paso; úsalo como colchón y no lo cargues primero desde mostrador.';
        }

        return {
            slot,
            slotKey,
            mode,
            tone,
            badge,
            headline,
            detail,
            appointmentLabel:
                appointmentRank === 1
                    ? 'Con cita: preferido'
                    : appointmentRank === 2
                      ? 'Con cita: respaldo'
                      : 'Con cita: sin lectura',
            walkInLabel:
                walkInRank === 1
                    ? 'Sin cita: preferido'
                    : walkInRank === 2
                      ? 'Sin cita: mejor el otro'
                      : 'Sin cita: sin lectura',
            supportLabel: `${operatorContext.operatorLabel}. ${
                reserveCard?.badge || coverageCard?.badge || 'Sin soporte extra'
            }`,
            actionLabel: operatorContext.operatorAssigned
                ? `Abrir ${slotKey.toUpperCase()}`
                : `Preparar ${slotKey.toUpperCase()}`,
            actionUrl: operatorContext.operatorUrl,
        };
    });

    const openCard = cards.find((card) => card.mode === 'open') || null;
    const appointmentCard =
        cards.find((card) => card.mode === 'appointments') || null;
    const bufferCard = cards.find((card) => card.mode === 'buffer') || null;
    const top =
        cards.find((card) => card.tone === 'warning') ||
        cards.find((card) => card.mode === 'open') ||
        cards.find((card) => card.mode === 'appointments') ||
        cards[0] ||
        null;

    let summary =
        'Recepción no tiene un carril claramente abierto ahora mismo.';
    if (openCard && appointmentCard && openCard.slot !== appointmentCard.slot) {
        summary = `${openCard.slotKey.toUpperCase()} queda abierto para sin cita; ${appointmentCard.slotKey.toUpperCase()} conviene reservarlo para citas.`;
    } else if (openCard && bufferCard) {
        summary = `${openCard.slotKey.toUpperCase()} queda abierto y ${bufferCard.slotKey.toUpperCase()} se mantiene como reserva.`;
    } else if (openCard) {
        summary = `${openCard.slotKey.toUpperCase()} es el carril más limpio para recibir ahora.`;
    } else if (appointmentCard) {
        summary = `${appointmentCard.slotKey.toUpperCase()} conserva la mejor ventana para citas; evita cargar el otro carril sin revisar la cola.`;
    }

    const openCount = cards.filter((card) => card.mode === 'open').length;
    const appointmentsCount = cards.filter(
        (card) => card.mode === 'appointments'
    ).length;

    return {
        title: 'Semáforo de recepción',
        summary,
        statusLabel:
            openCount > 0
                ? `${openCount} carril(es) abierto(s) · ${appointmentsCount} reservado(s) para citas`
                : 'Recepción contenida',
        statusState: top ? top.tone : 'idle',
        cards,
    };
}

function copyQueueReceptionLights(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Semáforo de recepción - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...panel.cards.flatMap((card) => [
            `${card.slotKey.toUpperCase()} - ${card.badge}`,
            card.headline,
            card.detail,
            `${card.appointmentLabel} · ${card.walkInLabel}`,
            card.supportLabel,
            '',
        ]),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Semáforo copiado', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar el semáforo', 'error');
        });
}

function renderQueueReceptionLights(manifest, detectedPlatform) {
    const root = document.getElementById('queueReceptionLights');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueReceptionLights(manifest, detectedPlatform);
    setHtml(
        '#queueReceptionLights',
        `
            <section class="queue-reception-lights__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-reception-lights__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Lectura rápida por carril</p>
                        <h5 id="queueReceptionLightsTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueReceptionLightsSummary" class="queue-reception-lights__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-reception-lights__meta">
                        <span
                            id="queueReceptionLightsStatus"
                            class="queue-reception-lights__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueReceptionLightsCopyBtn"
                            type="button"
                            class="queue-reception-lights__action"
                            ${panel.cards.length ? '' : 'disabled'}
                        >
                            Copiar semáforo
                        </button>
                    </div>
                </div>
                <div id="queueReceptionLightsCards" class="queue-reception-lights__grid" role="list" aria-label="Semáforo de recepción por consultorio">
                    ${panel.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueReceptionLightsCard_${escapeHtml(
                                        card.slotKey
                                    )}"
                                    class="queue-reception-lights__card"
                                    data-state="${escapeHtml(card.tone)}"
                                    role="listitem"
                                >
                                    <div class="queue-reception-lights__card-head">
                                        <div>
                                            <p class="queue-reception-lights__lane">${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</p>
                                            <strong id="queueReceptionLightsHeadline_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.headline)}</strong>
                                        </div>
                                        <span id="queueReceptionLightsBadge_${escapeHtml(
                                            card.slotKey
                                        )}" class="queue-reception-lights__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueReceptionLightsDetail_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reception-lights__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <p id="queueReceptionLightsRules_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reception-lights__rules">${escapeHtml(
                                        `${card.appointmentLabel} · ${card.walkInLabel}`
                                    )}</p>
                                    <p id="queueReceptionLightsSupport_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-reception-lights__support">${escapeHtml(
                                        card.supportLabel
                                    )}</p>
                                    <div class="queue-reception-lights__actions">
                                        <a
                                            id="queueReceptionLightsOpen_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.actionUrl)}"
                                            class="queue-reception-lights__open"
                                            data-queue-reception-lights-label="${escapeHtml(
                                                card.slotKey
                                            )}"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            ${escapeHtml(card.actionLabel)}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueReceptionLightsCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueReceptionLights(panel);
        };
    }

    root.querySelectorAll('[data-queue-reception-lights-label]').forEach(
        (link) => {
            if (!(link instanceof HTMLAnchorElement)) {
                return;
            }
            link.onclick = () => {
                const label = String(
                    link.dataset.queueReceptionLightsLabel || ''
                ).trim();
                appendOpsLogEntry({
                    source: 'reception_lights',
                    tone: 'info',
                    title: 'Semáforo de recepción: operador abierto',
                    summary: `${label || 'Carril'} quedó abierto desde el semáforo de recepción.`,
                });
            };
        }
    );
}

function getQueueBlockerWeight(item) {
    const action = String(item?.actionLabel || '')
        .trim()
        .toLowerCase();
    const state = String(item?.state || '')
        .trim()
        .toLowerCase();
    let weight = 90;
    if (action.startsWith('completar')) {
        weight = 0;
    } else if (action.startsWith('confirmar')) {
        weight = 1;
    } else if (action.startsWith('abrir operador')) {
        weight = 2;
    } else if (action.startsWith('preparar')) {
        weight = 3;
    }
    if (state === 'warning') {
        weight += 10;
    } else if (state === 'alert') {
        weight -= 1;
    } else if (state === 'active') {
        weight -= 2;
    }
    return weight;
}

function buildQueueBlockersPanel(manifest, detectedPlatform) {
    const nextTurns = buildQueueNextTurnsPanel(manifest, detectedPlatform);
    const pendingAction = getState().queue.pendingSensitiveAction;
    const items = [];

    if (pendingAction) {
        const pendingTicket = getQueueTicketById(
            Number(pendingAction.ticketId || 0)
        );
        const pendingCopy = getQueuePendingActionCopy(
            pendingAction,
            pendingTicket || null
        );
        if (pendingTicket && pendingCopy) {
            items.push({
                laneLabel: 'Sensible',
                state: 'alert',
                badge: 'Confirma o cancela',
                headline: `${pendingTicket.ticketCode} sostiene una confirmación pendiente`,
                actionLabel: `Confirmar ${pendingCopy}`,
                support:
                    'Mientras esta confirmación siga viva, el flujo rápido del hub y el numpad quedan condicionados por esta acción.',
                pivot: buildQueueTicketRoutePivot(
                    pendingTicket,
                    `Cargar ${pendingTicket.ticketCode}`,
                    'Es el ticket que hoy retiene una acción sensible pendiente.'
                ),
            });
        }
    }

    nextTurns.cards.forEach((card) => {
        const firstStep = card.steps[0] || null;
        if (!firstStep) {
            return;
        }
        const action = String(firstStep.actionLabel || '')
            .trim()
            .toLowerCase();
        let headline = '';
        let badge = '';
        let include = false;

        if (action.startsWith('completar')) {
            include = true;
            badge = 'Consulta bloquea siguiente paso';
            headline = `${card.laneLabel} no avanza hasta cerrar el ticket actual`;
        } else if (action.startsWith('abrir operador')) {
            include = true;
            badge = 'Falta operador';
            headline = `${card.laneLabel} tiene ticket, pero sin operador listo`;
        } else if (action.startsWith('preparar')) {
            include = true;
            badge = 'Preparación pendiente';
            headline = `${card.laneLabel} necesita preparar el siguiente movimiento`;
        }

        if (!include) {
            return;
        }

        items.push({
            laneLabel: card.laneLabel,
            state: firstStep.state,
            badge,
            headline,
            actionLabel: firstStep.actionLabel,
            support: firstStep.support,
            pivot: firstStep.pivot,
        });
    });

    const sortedItems = items
        .sort((left, right) => {
            const weightDelta =
                getQueueBlockerWeight(left) - getQueueBlockerWeight(right);
            if (weightDelta !== 0) {
                return weightDelta;
            }
            return String(left.laneLabel).localeCompare(
                String(right.laneLabel)
            );
        })
        .slice(0, 4);

    const top = sortedItems[0] || null;
    return {
        title: 'Bloqueos vivos',
        summary: top
            ? `${top.headline}. ${top.support}`
            : 'No hay bloqueos críticos ahora mismo; la siguiente ronda puede ejecutarse sin cuellos inmediatos.',
        statusLabel: top
            ? `${sortedItems.length} bloqueo(s) visibles`
            : 'Sin bloqueos críticos',
        statusState: top ? top.state : 'idle',
        items: sortedItems,
    };
}

function copyQueueBlockersReport(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `Bloqueos vivos - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...(panel.items.length
            ? panel.items.map(
                  (item, index) =>
                      `${index + 1}. [${item.laneLabel}] ${item.actionLabel} - ${item.support}`
              )
            : ['Sin bloqueos críticos visibles.']),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('Bloqueos copiados', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar el reporte de bloqueos', 'error');
        });
}

function renderQueueBlockersPanel(manifest, detectedPlatform) {
    const root = document.getElementById('queueBlockers');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueBlockersPanel(manifest, detectedPlatform);
    setHtml(
        '#queueBlockers',
        `
            <section class="queue-blockers__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-blockers__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Cadena de desbloqueo</p>
                        <h5 id="queueBlockersTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueBlockersSummary" class="queue-blockers__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-blockers__meta">
                        <span
                            id="queueBlockersStatus"
                            class="queue-blockers__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueBlockersCopyBtn"
                            type="button"
                            class="queue-blockers__action"
                            ${panel.items.length ? '' : 'disabled'}
                        >
                            Copiar bloqueos
                        </button>
                    </div>
                </div>
                ${
                    panel.items.length
                        ? `
                            <div id="queueBlockersItems" class="queue-blockers__list" role="list" aria-label="Bloqueos vivos del turno">
                                ${panel.items
                                    .map(
                                        (item, index) => `
                                            <article
                                                id="queueBlockersItem_${index}"
                                                class="queue-blockers__item"
                                                data-state="${escapeHtml(item.state)}"
                                                role="listitem"
                                            >
                                                <div class="queue-blockers__copy">
                                                    <div class="queue-blockers__headline">
                                                        <span class="queue-blockers__lane">${escapeHtml(
                                                            item.laneLabel
                                                        )}</span>
                                                        <strong id="queueBlockersHeadline_${index}">${escapeHtml(
                                                            item.headline
                                                        )}</strong>
                                                    </div>
                                                    <p id="queueBlockersAction_${index}" class="queue-blockers__action-copy">${escapeHtml(
                                                        item.actionLabel
                                                    )}</p>
                                                    <p id="queueBlockersSupport_${index}" class="queue-blockers__support">${escapeHtml(
                                                        item.support
                                                    )}</p>
                                                </div>
                                                <div class="queue-blockers__actions">
                                                    <span class="queue-blockers__badge">${escapeHtml(
                                                        item.badge
                                                    )}</span>
                                                    <button
                                                        id="queueBlockersLoad_${index}"
                                                        type="button"
                                                        class="queue-blockers__load"
                                                        data-queue-blocker-ticket="${escapeHtml(
                                                            item.pivot
                                                                ?.ticketCode ||
                                                                ''
                                                        )}"
                                                        data-queue-blocker-action="${escapeHtml(
                                                            item.actionLabel
                                                        )}"
                                                        ${item.pivot ? '' : 'disabled'}
                                                    >
                                                        ${escapeHtml(
                                                            item.pivot?.label ||
                                                                'Sin ticket'
                                                        )}
                                                    </button>
                                                </div>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : `
                            <article id="queueBlockersEmpty" class="queue-blockers__empty">
                                <strong>Sin bloqueos críticos</strong>
                                <p>La siguiente ronda no tiene cuellos urgentes; puedes seguir con la secuencia priorizada.</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueBlockersCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueBlockersReport(panel);
        };
    }

    root.querySelectorAll('[data-queue-blocker-ticket]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const ticketCode = String(
                button.dataset.queueBlockerTicket || ''
            ).trim();
            const actionLabel = String(
                button.dataset.queueBlockerAction || ''
            ).trim();
            if (!ticketCode) {
                return;
            }
            persistQueueTicketLookupTerm(ticketCode);
            appendOpsLogEntry({
                source: 'blockers',
                tone: 'warning',
                title: 'Bloqueos vivos: ticket cargado',
                summary: `${ticketCode} quedó cargado desde la cadena de desbloqueo (${actionLabel || 'sin acción visible'}).`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
}

function getQueueSlaThresholdSec(ticket) {
    const priority = String(ticket?.priorityClass || '')
        .trim()
        .toLowerCase();
    const queueType = String(ticket?.queueType || '')
        .trim()
        .toLowerCase();
    if (priority === 'appt_overdue') {
        return 0;
    }
    if (priority === 'appt_current' || queueType === 'appointment') {
        return 15 * 60;
    }
    return 20 * 60;
}

function getQueueSlaDueSec(ticket) {
    const ageSec = getQueueTicketAgeSec(ticket, 'waiting') || 0;
    return getQueueSlaThresholdSec(ticket) - ageSec;
}

function formatQueueSlaDueLabel(ticket) {
    const priority = String(ticket?.priorityClass || '')
        .trim()
        .toLowerCase();
    const dueSec = getQueueSlaDueSec(ticket);
    if (priority === 'appt_overdue') {
        return 'cita ya vencida';
    }
    if (dueSec <= 0) {
        return `vencido hace ${formatHeartbeatAge(Math.abs(dueSec))}`;
    }
    return `vence en ${formatHeartbeatAge(dueSec)}`;
}

function buildQueueSlaDeck(manifest, detectedPlatform) {
    const items = getSortedWaitingTickets()
        .map((ticket) => {
            const lookup = buildQueueTicketLookupResult(
                ticket,
                manifest,
                detectedPlatform
            );
            const dueSec = getQueueSlaDueSec(ticket);
            const consultorio = Number(ticket.assignedConsultorio || 0);
            const laneLabel =
                consultorio === 1 ? 'C1' : consultorio === 2 ? 'C2' : 'General';
            const priority = String(ticket.priorityClass || '')
                .trim()
                .toLowerCase();
            const state =
                priority === 'appt_overdue' || dueSec <= 0
                    ? 'alert'
                    : dueSec <= 5 * 60
                      ? 'warning'
                      : 'ready';
            const headline =
                priority === 'appt_overdue'
                    ? `${ticket.ticketCode} ya llegó vencido`
                    : dueSec <= 0
                      ? `${ticket.ticketCode} ya cayó en riesgo SLA`
                      : `${ticket.ticketCode} se acerca al límite SLA`;
            return {
                ticketId: Number(ticket.id || 0),
                ticketCode: String(ticket.ticketCode || ''),
                laneLabel,
                state,
                dueSec,
                ageLabel: formatQueueTicketAgeLabel(ticket, 'waiting'),
                dueLabel: formatQueueSlaDueLabel(ticket),
                headline,
                recommendation: lookup?.primaryLabel || 'Ver en tabla',
                support:
                    lookup?.detail ||
                    'Revisa el ticket desde el hub antes de que siga envejeciendo.',
                pivot: buildQueueTicketRoutePivot(
                    ticket,
                    `Cargar ${String(ticket.ticketCode || '')}`,
                    `Es uno de los tickets con presión SLA más alta ahora mismo.`
                ),
            };
        })
        .sort((left, right) => {
            if (left.dueSec !== right.dueSec) {
                return left.dueSec - right.dueSec;
            }
            return Number(left.ticketId || 0) - Number(right.ticketId || 0);
        })
        .slice(0, 4);

    const top = items[0] || null;
    return {
        title: 'SLA vivo',
        summary: top
            ? `${top.headline}. ${top.recommendation} es la siguiente jugada útil para que no se siga degradando.`
            : 'No hay tickets en ventana crítica de SLA ahora mismo.',
        statusLabel: top
            ? `${items.length} ticket(s) vigilados`
            : 'Sin presión SLA',
        statusState: top ? top.state : 'idle',
        items,
    };
}

function copyQueueSlaDeck(panel) {
    if (!panel) {
        return Promise.resolve();
    }
    const report = [
        `SLA vivo - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${panel.statusLabel}`,
        panel.summary,
        '',
        ...(panel.items.length
            ? panel.items.map(
                  (item, index) =>
                      `${index + 1}. [${item.laneLabel}] ${item.ticketCode} - ${item.dueLabel} - ${item.recommendation}`
              )
            : ['Sin tickets en presión SLA.']),
    ];
    return navigator.clipboard
        .writeText(report.join('\n').trim())
        .then(() => {
            createToast('SLA copiado', 'success');
        })
        .catch(() => {
            createToast('No se pudo copiar SLA vivo', 'error');
        });
}

function renderQueueSlaDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueSlaDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const panel = buildQueueSlaDeck(manifest, detectedPlatform);
    setHtml(
        '#queueSlaDeck',
        `
            <section class="queue-sla-deck__shell" data-state="${escapeHtml(
                panel.statusState
            )}">
                <div class="queue-sla-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Presión preventiva</p>
                        <h5 id="queueSlaDeckTitle" class="queue-app-card__title">${escapeHtml(
                            panel.title
                        )}</h5>
                        <p id="queueSlaDeckSummary" class="queue-sla-deck__summary">${escapeHtml(
                            panel.summary
                        )}</p>
                    </div>
                    <div class="queue-sla-deck__meta">
                        <span
                            id="queueSlaDeckStatus"
                            class="queue-sla-deck__status"
                            data-state="${escapeHtml(panel.statusState)}"
                        >
                            ${escapeHtml(panel.statusLabel)}
                        </span>
                        <button
                            id="queueSlaDeckCopyBtn"
                            type="button"
                            class="queue-sla-deck__action"
                            ${panel.items.length ? '' : 'disabled'}
                        >
                            Copiar SLA
                        </button>
                    </div>
                </div>
                ${
                    panel.items.length
                        ? `
                            <div id="queueSlaDeckItems" class="queue-sla-deck__list" role="list" aria-label="Tickets en presión SLA">
                                ${panel.items
                                    .map(
                                        (item, index) => `
                                            <article
                                                id="queueSlaDeckItem_${index}"
                                                class="queue-sla-deck__item"
                                                data-state="${escapeHtml(item.state)}"
                                                role="listitem"
                                            >
                                                <div class="queue-sla-deck__copy">
                                                    <div class="queue-sla-deck__headline">
                                                        <span class="queue-sla-deck__lane">${escapeHtml(
                                                            item.laneLabel
                                                        )}</span>
                                                        <strong id="queueSlaDeckHeadline_${index}">${escapeHtml(
                                                            item.headline
                                                        )}</strong>
                                                    </div>
                                                    <p id="queueSlaDeckDue_${index}" class="queue-sla-deck__due">${escapeHtml(
                                                        `${item.ticketCode} · ${item.dueLabel}`
                                                    )}</p>
                                                    <p id="queueSlaDeckSupport_${index}" class="queue-sla-deck__support">${escapeHtml(
                                                        `${item.ageLabel}. ${item.support}`
                                                    )}</p>
                                                </div>
                                                <div class="queue-sla-deck__actions">
                                                    <span class="queue-sla-deck__badge">${escapeHtml(
                                                        item.recommendation
                                                    )}</span>
                                                    <button
                                                        id="queueSlaDeckLoad_${index}"
                                                        type="button"
                                                        class="queue-sla-deck__load"
                                                        data-queue-sla-ticket="${escapeHtml(
                                                            item.ticketCode
                                                        )}"
                                                        data-queue-sla-action="${escapeHtml(
                                                            item.recommendation
                                                        )}"
                                                    >
                                                        ${escapeHtml(
                                                            item.pivot?.label ||
                                                                'Cargar ticket'
                                                        )}
                                                    </button>
                                                </div>
                                            </article>
                                        `
                                    )
                                    .join('')}
                            </div>
                        `
                        : `
                            <article id="queueSlaDeckEmpty" class="queue-sla-deck__empty">
                                <strong>Sin presión SLA crítica</strong>
                                <p>Los tickets en espera siguen dentro de una ventana operativa aceptable.</p>
                            </article>
                        `
                }
            </section>
        `
    );

    const copyButton = document.getElementById('queueSlaDeckCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueSlaDeck(panel);
        };
    }

    root.querySelectorAll('[data-queue-sla-ticket]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const ticketCode = String(
                button.dataset.queueSlaTicket || ''
            ).trim();
            const actionLabel = String(
                button.dataset.queueSlaAction || ''
            ).trim();
            if (!ticketCode) {
                return;
            }
            persistQueueTicketLookupTerm(ticketCode);
            appendOpsLogEntry({
                source: 'sla_live',
                tone: 'warning',
                title: 'SLA vivo: ticket cargado',
                summary: `${ticketCode} quedó cargado desde la presión SLA (${actionLabel || 'sin acción visible'}).`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });
}

function buildQueueWaitRadarSeverity({ ageSec, backlog, operatorReady }) {
    const safeBacklog = Math.max(0, Number(backlog || 0));
    const safeAgeSec = Number.isFinite(Number(ageSec)) ? Number(ageSec) : null;

    if (safeBacklog <= 0) {
        return {
            state: 'idle',
            badge: 'Sin cola',
            support: 'Sin presión de espera por ahora.',
        };
    }

    if (
        (safeAgeSec !== null && safeAgeSec >= 15 * 60) ||
        safeBacklog >= 4 ||
        (!operatorReady && safeAgeSec !== null && safeAgeSec >= 8 * 60)
    ) {
        return {
            state: 'alert',
            badge: 'Atender ya',
            support:
                safeAgeSec !== null
                    ? `Espera máxima ${formatHeartbeatAge(safeAgeSec)}.`
                    : 'Hay demasiada presión acumulada.',
        };
    }

    if (
        (safeAgeSec !== null && safeAgeSec >= 8 * 60) ||
        safeBacklog >= 2 ||
        !operatorReady
    ) {
        return {
            state: 'warning',
            badge: 'Vigilar',
            support:
                safeAgeSec !== null
                    ? `Espera máxima ${formatHeartbeatAge(safeAgeSec)}.`
                    : 'Hace falta vigilar esta línea.',
        };
    }

    return {
        state: 'ready',
        badge: 'Bajo control',
        support:
            safeAgeSec !== null
                ? `Espera máxima ${formatHeartbeatAge(safeAgeSec)}.`
                : 'Cola controlada.',
    };
}

function buildQueueWaitRadarLaneCard(manifest, detectedPlatform, laneKey) {
    if (laneKey === 'general') {
        const generalWaiting = getUnassignedWaitingTickets();
        const oldestGeneral = generalWaiting[0] || null;
        const c1Dispatch = buildQueueDispatchCard(
            manifest,
            detectedPlatform,
            1
        );
        const c2Dispatch = buildQueueDispatchCard(
            manifest,
            detectedPlatform,
            2
        );
        const assignOptions = [c1Dispatch, c2Dispatch].filter(
            (card) =>
                card.primaryAction === 'assign' &&
                card.targetTicketId === Number(oldestGeneral?.id || 0)
        );
        const preferredAssign =
            assignOptions.sort((left, right) => left.slot - right.slot)[0] ||
            null;
        const fallbackOpen = [c1Dispatch, c2Dispatch].find(
            (card) => card.primaryAction === 'open'
        );
        const severity = buildQueueWaitRadarSeverity({
            ageSec: getQueueTicketAgeSec(oldestGeneral, 'waiting'),
            backlog: generalWaiting.length,
            operatorReady: Boolean(preferredAssign),
        });

        if (!oldestGeneral) {
            return {
                laneKey: 'general',
                laneLabel: 'General',
                state: 'idle',
                badge: 'Sin cola',
                headline: 'Cola general al día',
                detail: 'No hay tickets sin consultorio esperando despacho en este momento.',
                oldestLabel: 'Sin ticket pendiente',
                pressureLabel: 'General 0 · C1 0 · C2 0',
                recommendationLabel: 'Sin movimiento urgente',
                chips: ['Sin consultorio 0', 'Operación estable'],
                primaryLabel: 'Sin acción',
                actionCard: null,
            };
        }

        let detail =
            'Es el ticket más antiguo sin consultorio y merece la próxima revisión del turno.';
        let recommendationLabel = 'Abrir cola admin';
        let actionCard = null;
        const chips = [`Sin consultorio ${generalWaiting.length}`];

        if (preferredAssign) {
            detail = `${preferredAssign.slotKey.toUpperCase()} está en mejor posición para absorber este ticket sin bajar a la tabla completa.`;
            recommendationLabel = `Asignar ${oldestGeneral.ticketCode} a ${preferredAssign.slotKey.toUpperCase()}`;
            actionCard = {
                ...preferredAssign,
                primaryLabel: recommendationLabel,
            };
            chips.push(`Recomendado ${preferredAssign.slotKey.toUpperCase()}`);
        } else if (fallbackOpen) {
            detail = `La cola general ya tiene presión, pero todavía falta dejar listo el operador recomendado antes de reasignar con confianza.`;
            recommendationLabel = `Abrir Operador ${fallbackOpen.slotKey.toUpperCase()}`;
            actionCard = {
                ...fallbackOpen,
                primaryLabel: recommendationLabel,
            };
            chips.push(`Falta ${fallbackOpen.slotKey.toUpperCase()}`);
        } else {
            chips.push('Sin operador listo');
        }

        chips.push(severity.support);

        return {
            laneKey: 'general',
            laneLabel: 'General',
            state: severity.state,
            badge: severity.badge,
            headline: `${oldestGeneral.ticketCode} lidera la cola general`,
            detail,
            oldestLabel: `${oldestGeneral.ticketCode} · ${formatQueueTicketAgeLabel(
                oldestGeneral,
                'waiting'
            )}`,
            pressureLabel: `General ${generalWaiting.length} · C1 ${
                getAssignedWaitingTickets(1).length
            } · C2 ${getAssignedWaitingTickets(2).length}`,
            recommendationLabel,
            chips,
            primaryLabel: actionCard ? actionCard.primaryLabel : 'Sin acción',
            actionCard,
        };
    }

    const slot = laneKey === 'c2' ? 2 : 1;
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        slot
    );
    const dispatchCard = buildQueueDispatchCard(
        manifest,
        detectedPlatform,
        slot
    );
    const ownWaiting = getAssignedWaitingTickets(slot);
    const generalWaiting = getUnassignedWaitingTickets();
    const currentTicket = getCalledTicketForConsultorio(slot);
    const candidateTicket =
        ownWaiting[0] ||
        ((dispatchCard.primaryAction === 'assign' ||
            dispatchCard.primaryAction === 'rebalance') &&
        dispatchCard.targetTicketId > 0
            ? getQueueTicketById(dispatchCard.targetTicketId)
            : null);
    const demandCount = ownWaiting.length
        ? ownWaiting.length
        : dispatchCard.primaryAction === 'assign'
          ? generalWaiting.length
          : dispatchCard.primaryAction === 'rebalance'
            ? getAssignedWaitingTickets(slot === 2 ? 1 : 2).length
            : 0;

    if (!candidateTicket && currentTicket) {
        return {
            laneKey,
            laneLabel: laneKey.toUpperCase(),
            state: 'active',
            badge: 'En atención',
            headline: `${currentTicket.ticketCode} está en consulta`,
            detail: `No hay espera nueva para ${laneKey.toUpperCase()}, pero el consultorio sigue ocupado y listo para retomar el siguiente turno desde el mismo hub.`,
            oldestLabel: `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                currentTicket,
                'called'
            )}`,
            pressureLabel: `Propios ${ownWaiting.length} · General ${generalWaiting.length}`,
            recommendationLabel: dispatchCard.primaryLabel,
            chips: [
                operatorContext.operatorLabel,
                operatorContext.oneTapLabel,
                operatorContext.heartbeatLabel,
            ],
            primaryLabel: dispatchCard.primaryLabel,
            actionCard:
                dispatchCard.primaryAction === 'none' ? null : dispatchCard,
        };
    }

    if (!candidateTicket) {
        return {
            laneKey,
            laneLabel: laneKey.toUpperCase(),
            state:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? 'ready'
                    : 'idle',
            badge:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? 'Listo'
                    : 'Sin cola',
            headline:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? `${laneKey.toUpperCase()} listo para absorber demanda`
                    : `${laneKey.toUpperCase()} sin espera propia`,
            detail:
                operatorContext.operatorAssigned && operatorContext.operatorLive
                    ? `No hay tickets esperando ahora, pero ${laneKey.toUpperCase()} ya tiene operador y heartbeat para responder al siguiente ingreso.`
                    : `No hay presión visible en ${laneKey.toUpperCase()} y todavía no hace falta una acción rápida desde el radar.`,
            oldestLabel: 'Sin ticket pendiente',
            pressureLabel: `Propios ${ownWaiting.length} · General ${generalWaiting.length}`,
            recommendationLabel: dispatchCard.primaryLabel,
            chips: [
                operatorContext.operatorLabel,
                operatorContext.oneTapLabel,
                operatorContext.heartbeatLabel,
            ],
            primaryLabel:
                dispatchCard.primaryAction === 'none'
                    ? 'Sin acción'
                    : dispatchCard.primaryLabel,
            actionCard:
                dispatchCard.primaryAction === 'none' ? null : dispatchCard,
        };
    }

    const severity = buildQueueWaitRadarSeverity({
        ageSec: getQueueTicketAgeSec(candidateTicket, 'waiting'),
        backlog: demandCount,
        operatorReady:
            dispatchCard.primaryAction !== 'open' &&
            dispatchCard.primaryAction !== 'none',
    });
    const badge =
        dispatchCard.primaryAction === 'open'
            ? 'Falta operador'
            : severity.badge;

    return {
        laneKey,
        laneLabel: laneKey.toUpperCase(),
        state:
            dispatchCard.primaryAction === 'open' && severity.state === 'ready'
                ? 'warning'
                : severity.state,
        badge,
        headline: `${candidateTicket.ticketCode} presiona ${laneKey.toUpperCase()}`,
        detail: dispatchCard.detail,
        oldestLabel: `${candidateTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            candidateTicket,
            'waiting'
        )}`,
        pressureLabel: `Propios ${ownWaiting.length} · General ${generalWaiting.length}`,
        recommendationLabel: dispatchCard.primaryLabel,
        chips: [
            operatorContext.operatorLabel,
            operatorContext.oneTapLabel,
            severity.support,
        ],
        primaryLabel: dispatchCard.primaryLabel,
        actionCard: dispatchCard.primaryAction === 'none' ? null : dispatchCard,
    };
}

function buildQueueWaitRadar(manifest, detectedPlatform) {
    const cards = ['general', 'c1', 'c2'].map((laneKey) =>
        buildQueueWaitRadarLaneCard(manifest, detectedPlatform, laneKey)
    );
    const alertCount = cards.filter((card) => card.state === 'alert').length;
    const warningCount = cards.filter(
        (card) => card.state === 'warning'
    ).length;
    const actionableCount = cards.filter((card) => card.actionCard).length;
    const oldestAgeSec = getSortedWaitingTickets().reduce((maxAge, ticket) => {
        const ageSec = getQueueTicketAgeSec(ticket, 'waiting');
        return ageSec !== null ? Math.max(maxAge, ageSec) : maxAge;
    }, 0);

    return {
        title:
            alertCount > 0
                ? 'Radar de espera en rojo'
                : warningCount > 0
                  ? 'Radar de espera con presión'
                  : 'Radar de espera bajo control',
        summary:
            alertCount > 0
                ? 'La cola ya muestra una espera que conviene atender antes de seguir navegando por otras tarjetas del hub.'
                : warningCount > 0
                  ? 'El radar agrupa la línea más vieja por cola general y consultorio para que recepción vea primero dónde está subiendo la presión.'
                  : 'No hay presión visible: la cola general y ambos consultorios están bajo control por ahora.',
        statusLabel:
            alertCount > 0
                ? `${alertCount} en rojo`
                : warningCount > 0
                  ? `${warningCount} por vigilar`
                  : 'Sin espera crítica',
        statusState:
            alertCount > 0 ? 'alert' : warningCount > 0 ? 'warning' : 'ready',
        chips: [
            `Acciones ${actionableCount}`,
            `Alertas ${alertCount}`,
            oldestAgeSec > 0
                ? `Espera máxima ${formatHeartbeatAge(oldestAgeSec)}`
                : 'Espera máxima 0s',
        ],
        cards,
    };
}

async function runQueueWaitRadarAction(card, manifest, detectedPlatform) {
    if (!card?.actionCard) {
        return;
    }
    await runQueueDispatchAction(card.actionCard, manifest, detectedPlatform, {
        source: 'wait_radar',
    });
}

function renderQueueWaitRadar(manifest, detectedPlatform) {
    const root = document.getElementById('queueWaitRadar');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const radar = buildQueueWaitRadar(manifest, detectedPlatform);
    setHtml(
        '#queueWaitRadar',
        `
            <section class="queue-wait-radar__shell" data-state="${escapeHtml(
                radar.statusState
            )}">
                <div class="queue-wait-radar__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Radar de espera</p>
                        <h5 id="queueWaitRadarTitle" class="queue-app-card__title">${escapeHtml(
                            radar.title
                        )}</h5>
                        <p id="queueWaitRadarSummary" class="queue-wait-radar__summary">${escapeHtml(
                            radar.summary
                        )}</p>
                    </div>
                    <div class="queue-wait-radar__meta">
                        <span
                            id="queueWaitRadarStatus"
                            class="queue-wait-radar__status"
                            data-state="${escapeHtml(radar.statusState)}"
                        >
                            ${escapeHtml(radar.statusLabel)}
                        </span>
                        <div class="queue-wait-radar__chips">
                            ${radar.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-wait-radar__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueWaitRadarCards" class="queue-wait-radar__grid" role="list" aria-label="Radar de espera por línea">
                    ${radar.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueWaitRadarCard_${escapeHtml(card.laneKey)}"
                                    class="queue-wait-radar__card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-wait-radar__card-header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.laneLabel
                                            )}</strong>
                                            <p id="queueWaitRadarHeadline_${escapeHtml(
                                                card.laneKey
                                            )}" class="queue-wait-radar__headline">${escapeHtml(
                                                card.headline
                                            )}</p>
                                        </div>
                                        <span class="queue-wait-radar__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-wait-radar__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <div class="queue-wait-radar__facts">
                                        <div class="queue-wait-radar__fact">
                                            <span>Ticket crítico</span>
                                            <strong id="queueWaitRadarOldest_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(card.oldestLabel)}</strong>
                                        </div>
                                        <div class="queue-wait-radar__fact">
                                            <span>Presión</span>
                                            <strong id="queueWaitRadarPressure_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(card.pressureLabel)}</strong>
                                        </div>
                                        <div class="queue-wait-radar__fact">
                                            <span>Siguiente jugada</span>
                                            <strong id="queueWaitRadarRecommendation_${escapeHtml(
                                                card.laneKey
                                            )}">${escapeHtml(
                                                card.recommendationLabel
                                            )}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-wait-radar__lane-chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-wait-radar__lane-chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-wait-radar__actions">
                                        <button
                                            id="queueWaitRadarPrimary_${escapeHtml(
                                                card.laneKey
                                            )}"
                                            type="button"
                                            class="queue-wait-radar__action queue-wait-radar__action--primary"
                                            ${card.actionCard ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    radar.cards.forEach((card) => {
        const button = document.getElementById(
            `queueWaitRadarPrimary_${card.laneKey}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runQueueWaitRadarAction(card, manifest, detectedPlatform);
        };
    });
}

function formatQueueLoadBalanceDelta(loadDelta, otherSlotKey) {
    if (!Number.isFinite(loadDelta) || loadDelta === 0) {
        return `Parejo con ${otherSlotKey.toUpperCase()}`;
    }

    if (loadDelta > 0) {
        return `+${loadDelta} vs ${otherSlotKey.toUpperCase()}`;
    }

    return `${Math.abs(loadDelta)} menos que ${otherSlotKey.toUpperCase()}`;
}

function buildQueueLoadBalanceCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const dispatchCard = buildQueueDispatchCard(
        manifest,
        detectedPlatform,
        consultorio
    );
    const otherSlot = consultorio === 2 ? 1 : 2;
    const otherSlotKey = otherSlot === 2 ? 'c2' : 'c1';
    const otherDispatchCard = buildQueueDispatchCard(
        manifest,
        detectedPlatform,
        otherSlot
    );
    const ownWaiting = getAssignedWaitingTickets(consultorio);
    const otherWaiting = getAssignedWaitingTickets(otherSlot);
    const generalWaiting = getUnassignedWaitingTickets();
    const currentTicket = getCalledTicketForConsultorio(consultorio);
    const otherCurrentTicket = getCalledTicketForConsultorio(otherSlot);
    const ownLoadUnits = ownWaiting.length + (currentTicket ? 1 : 0);
    const otherLoadUnits = otherWaiting.length + (otherCurrentTicket ? 1 : 0);
    const loadDelta = ownLoadUnits - otherLoadUnits;
    const gap = Math.abs(loadDelta);
    const operatorReady =
        operatorContext.operatorAssigned && operatorContext.operatorLive;

    let state =
        operatorReady || ownLoadUnits > 0 || generalWaiting.length > 0
            ? 'ready'
            : 'idle';
    let badge = operatorReady ? 'Parejo' : 'Sin operador';
    let headline = `${operatorContext.slotKey.toUpperCase()} con carga estable`;
    let detail =
        gap === 0 && generalWaiting.length === 0
            ? `La carga visible está pareja entre ${operatorContext.slotKey.toUpperCase()} y ${otherSlotKey.toUpperCase()} y no hay cola general esperando reparto.`
            : `${operatorContext.slotKey.toUpperCase()} mantiene un margen manejable frente a ${otherSlotKey.toUpperCase()}, pero conviene vigilar el siguiente movimiento del turno.`;
    let capacityLabel = operatorReady
        ? 'Listo para absorber'
        : 'Falta operador dedicado';
    let actionCard =
        dispatchCard.primaryAction === 'none' ? null : dispatchCard;
    let primaryLabel = actionCard ? actionCard.primaryLabel : 'Sin acción';

    if (otherDispatchCard.primaryAction === 'rebalance' && loadDelta >= 2) {
        const suggestedMoveLabel = `Mover ${otherDispatchCard.targetTicketCode} a ${otherSlotKey.toUpperCase()}`;
        state = gap >= 3 ? 'alert' : 'warning';
        badge = 'Más cargado';
        headline = `${operatorContext.slotKey.toUpperCase()} está absorbiendo de más`;
        detail = `${operatorContext.slotKey.toUpperCase()} lleva ${ownWaiting.length} en espera frente a ${otherWaiting.length} de ${otherSlotKey.toUpperCase()}. ${otherSlotKey.toUpperCase()} ya puede tomar ${otherDispatchCard.targetTicketCode} para repartir mejor el turno.`;
        capacityLabel = `Ceder ${otherDispatchCard.targetTicketCode} a ${otherSlotKey.toUpperCase()}`;
        actionCard = {
            ...otherDispatchCard,
            primaryLabel: suggestedMoveLabel,
        };
        primaryLabel = suggestedMoveLabel;
    } else if (dispatchCard.primaryAction === 'rebalance') {
        state = 'ready';
        badge = 'Puede absorber';
        headline = `${operatorContext.slotKey.toUpperCase()} puede equilibrar ${otherSlotKey.toUpperCase()}`;
        detail = `${operatorContext.slotKey.toUpperCase()} tiene margen operativo para absorber ${dispatchCard.targetTicketCode} y bajar la presión que ya acumula ${otherSlotKey.toUpperCase()}.`;
        capacityLabel = `Absorber ${dispatchCard.targetTicketCode}`;
        actionCard = dispatchCard;
        primaryLabel = dispatchCard.primaryLabel;
    } else if (dispatchCard.primaryAction === 'assign') {
        state = 'ready';
        badge = 'Capacidad libre';
        headline = `${operatorContext.slotKey.toUpperCase()} puede absorber cola general`;
        detail = `Hay ${generalWaiting.length} ticket(s) sin consultorio. ${operatorContext.slotKey.toUpperCase()} es la mejor salida inmediata para tomar ${dispatchCard.targetTicketCode} y mantener la recepción liviana.`;
        capacityLabel = `Tomar ${dispatchCard.targetTicketCode} de general`;
        actionCard = dispatchCard;
        primaryLabel = dispatchCard.primaryLabel;
    } else if (dispatchCard.primaryAction === 'call') {
        state = 'ready';
        badge = 'Siguiente listo';
        headline = `${operatorContext.slotKey.toUpperCase()} ya tiene siguiente ticket`;
        detail = `${dispatchCard.targetTicketCode} ya está alineado a ${operatorContext.slotKey.toUpperCase()}. Llamarlo ahora evita que el balance vuelva a abrirse al siguiente refresh.`;
        capacityLabel = `Llamar ${dispatchCard.targetTicketCode}`;
        actionCard = dispatchCard;
        primaryLabel = dispatchCard.primaryLabel;
    } else if (
        dispatchCard.primaryAction === 'open' &&
        (ownWaiting.length > 0 || generalWaiting.length > 0 || gap > 0)
    ) {
        state = 'warning';
        badge = 'Falta operador';
        headline = `Prepara ${operatorContext.slotKey.toUpperCase()} para balancear`;
        detail = `${operatorContext.slotKey.toUpperCase()} tiene margen o cola pendiente, pero todavía falta un operador confiable para ejecutar el balance con seguridad.`;
        capacityLabel = `Abrir Operador ${operatorContext.slotKey.toUpperCase()}`;
        actionCard = dispatchCard;
        primaryLabel = dispatchCard.primaryLabel;
    } else if (gap <= 1 && generalWaiting.length === 0) {
        state =
            operatorReady || ownLoadUnits > 0 || otherLoadUnits > 0
                ? 'ready'
                : 'idle';
        badge = operatorReady ? 'Parejo' : 'Sin señal';
        headline = `${operatorContext.slotKey.toUpperCase()} está bajo control`;
        detail = currentTicket
            ? `${currentTicket.ticketCode} sigue en atención y la cola pendiente no abre un desvío material frente a ${otherSlotKey.toUpperCase()}.`
            : `La diferencia con ${otherSlotKey.toUpperCase()} no supera un turno y no hay cola general acumulándose ahora mismo.`;
        capacityLabel =
            gap === 0
                ? `Mismo nivel que ${otherSlotKey.toUpperCase()}`
                : `Diferencia corta frente a ${otherSlotKey.toUpperCase()}`;
    }

    return {
        slot: consultorio,
        slotKey: operatorContext.slotKey,
        state,
        badge,
        headline,
        detail,
        loadLabel: `En cola ${ownWaiting.length} · Atención ${
            currentTicket ? currentTicket.ticketCode : 'Libre'
        }`,
        deltaLabel: formatQueueLoadBalanceDelta(loadDelta, otherSlotKey),
        capacityLabel,
        chips: [
            operatorContext.operatorLabel,
            operatorContext.oneTapLabel,
            `General ${generalWaiting.length}`,
        ],
        operatorUrl: operatorContext.operatorUrl,
        actionCard,
        primaryLabel,
    };
}

function buildQueueLoadBalance(manifest, detectedPlatform) {
    const cards = [1, 2].map((consultorio) =>
        buildQueueLoadBalanceCard(manifest, detectedPlatform, consultorio)
    );
    const c1Load =
        getAssignedWaitingTickets(1).length +
        (getCalledTicketForConsultorio(1) ? 1 : 0);
    const c2Load =
        getAssignedWaitingTickets(2).length +
        (getCalledTicketForConsultorio(2) ? 1 : 0);
    const loadGap = Math.abs(c1Load - c2Load);
    const generalWaitingCount = getUnassignedWaitingTickets().length;
    const alertCount = cards.filter((card) => card.state === 'alert').length;
    const warningCount = cards.filter(
        (card) => card.state === 'warning'
    ).length;
    const adjustmentCount = cards.filter(
        (card) =>
            card.actionCard &&
            ['assign', 'rebalance', 'call'].includes(
                card.actionCard.primaryAction
            )
    ).length;
    const blockedCount = cards.filter(
        (card) =>
            card.actionCard &&
            card.actionCard.primaryAction === 'open' &&
            card.state === 'warning'
    ).length;
    const activeLoadCount = cards.filter(
        (card) => card.state !== 'idle'
    ).length;

    return {
        title:
            alertCount > 0
                ? 'Balance de carga desviado'
                : warningCount > 0
                  ? 'Balance de carga por vigilar'
                  : adjustmentCount > 0
                    ? 'Balance de carga con margen'
                    : 'Balance de carga estable',
        summary:
            alertCount > 0
                ? 'Uno de los consultorios ya está absorbiendo de más y conviene rebalancear antes de que el radar de espera siga escalando.'
                : warningCount > 0
                  ? 'Aquí ves qué consultorio está más liviano, cuál está absorbiendo de más y cuál es el siguiente ajuste para repartir la cola.'
                  : adjustmentCount > 0
                    ? 'La carga está controlada, pero todavía puedes absorber un ticket o dejar un llamado listo sin bajar a la tabla.'
                    : 'C1, C2 y la cola general se ven parejos; no hace falta rebalancear el turno en este momento.',
        statusLabel:
            alertCount > 0
                ? `Gap ${loadGap} con rebalanceo urgente`
                : blockedCount > 0
                  ? `${blockedCount} bloqueo(s) para balancear`
                  : adjustmentCount > 0
                    ? `${adjustmentCount} ajuste(s) sugerido(s)`
                    : activeLoadCount > 0
                      ? `Gap actual ${loadGap}`
                      : 'Sin carga pendiente',
        statusState:
            alertCount > 0
                ? 'alert'
                : warningCount > 0
                  ? 'warning'
                  : activeLoadCount > 0 || adjustmentCount > 0
                    ? 'ready'
                    : 'idle',
        chips: [
            `Gap C1/C2 ${loadGap}`,
            `General ${generalWaitingCount}`,
            `Ajustes ${adjustmentCount}`,
        ],
        cards,
    };
}

async function runQueueLoadBalanceAction(card, manifest, detectedPlatform) {
    if (!card?.actionCard) {
        return;
    }

    await runQueueDispatchAction(card.actionCard, manifest, detectedPlatform, {
        source: 'load_balance',
    });
}

function renderQueueLoadBalance(manifest, detectedPlatform) {
    const root = document.getElementById('queueLoadBalance');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const balance = buildQueueLoadBalance(manifest, detectedPlatform);
    setHtml(
        '#queueLoadBalance',
        `
            <section class="queue-load-balance__shell" data-state="${escapeHtml(
                balance.statusState
            )}">
                <div class="queue-load-balance__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Balance de carga</p>
                        <h5 id="queueLoadBalanceTitle" class="queue-app-card__title">${escapeHtml(
                            balance.title
                        )}</h5>
                        <p id="queueLoadBalanceSummary" class="queue-load-balance__summary">${escapeHtml(
                            balance.summary
                        )}</p>
                    </div>
                    <div class="queue-load-balance__meta">
                        <span
                            id="queueLoadBalanceStatus"
                            class="queue-load-balance__status"
                            data-state="${escapeHtml(balance.statusState)}"
                        >
                            ${escapeHtml(balance.statusLabel)}
                        </span>
                        <div class="queue-load-balance__chips">
                            ${balance.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-load-balance__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueLoadBalanceCards" class="queue-load-balance__grid" role="list" aria-label="Balance de carga por consultorio">
                    ${balance.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueLoadBalanceCard_${escapeHtml(card.slotKey)}"
                                    class="queue-load-balance__card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-load-balance__card-header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p id="queueLoadBalanceHeadline_${escapeHtml(
                                                card.slotKey
                                            )}" class="queue-load-balance__headline">${escapeHtml(
                                                card.headline
                                            )}</p>
                                        </div>
                                        <span class="queue-load-balance__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p class="queue-load-balance__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <div class="queue-load-balance__facts">
                                        <div class="queue-load-balance__fact">
                                            <span>Carga visible</span>
                                            <strong id="queueLoadBalanceLoad_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.loadLabel)}</strong>
                                        </div>
                                        <div class="queue-load-balance__fact">
                                            <span>Delta</span>
                                            <strong id="queueLoadBalanceDelta_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.deltaLabel)}</strong>
                                        </div>
                                        <div class="queue-load-balance__fact">
                                            <span>Capacidad</span>
                                            <strong id="queueLoadBalanceCapacity_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.capacityLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-load-balance__lane-chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-load-balance__lane-chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-load-balance__actions">
                                        <button
                                            id="queueLoadBalancePrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-load-balance__action queue-load-balance__action--primary"
                                            ${card.actionCard ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <a
                                            id="queueLoadBalanceOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-load-balance__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    balance.cards.forEach((card) => {
        const button = document.getElementById(
            `queueLoadBalancePrimary_${card.slotKey}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runQueueLoadBalanceAction(card, manifest, detectedPlatform);
        };
    });
}

function getQueuePriorityLaneLabel(ticket) {
    const consultorio = Number(ticket?.assignedConsultorio || 0);
    if (consultorio === 2) {
        return 'C2';
    }
    if (consultorio === 1) {
        return 'C1';
    }
    return 'General';
}

function buildQueuePriorityActionCard(
    manifest,
    detectedPlatform,
    ticket,
    dispatchCards
) {
    const ticketId = Number(ticket?.id || 0);
    if (ticketId <= 0) {
        return null;
    }

    const consultorio = Number(ticket?.assignedConsultorio || 0);
    if (!consultorio) {
        const assignCard = [dispatchCards[1], dispatchCards[2]]
            .filter(Boolean)
            .find(
                (card) =>
                    card.primaryAction === 'assign' &&
                    card.targetTicketId === ticketId
            );
        if (assignCard) {
            return assignCard;
        }

        const openCard = [dispatchCards[1], dispatchCards[2]]
            .filter(Boolean)
            .find((card) => card.primaryAction === 'open');
        return openCard || null;
    }

    const slot = consultorio === 2 ? 2 : 1;
    const ownWaitingTickets = getAssignedWaitingTickets(slot);
    if (!ownWaitingTickets.length) {
        return null;
    }

    const laneIndex = ownWaitingTickets.findIndex(
        (candidate) => Number(candidate.id || 0) === ticketId
    );
    if (laneIndex !== 0) {
        return null;
    }

    return dispatchCards[slot] || null;
}

function buildQueuePriorityLaneItem(
    manifest,
    detectedPlatform,
    ticket,
    index,
    dispatchCards
) {
    const ageSec = getQueueTicketAgeSec(ticket, 'waiting') || 0;
    const consultorio = Number(ticket?.assignedConsultorio || 0);
    const laneLabel = getQueuePriorityLaneLabel(ticket);
    const queueTypeLabel = formatQueuePriorityTypeLabel(ticket);
    const ownWaitingTickets = consultorio
        ? getAssignedWaitingTickets(consultorio)
        : getUnassignedWaitingTickets();
    const laneIndex = ownWaitingTickets.findIndex(
        (candidate) => Number(candidate.id || 0) === Number(ticket?.id || 0)
    );
    const dispatchCard = buildQueuePriorityActionCard(
        manifest,
        detectedPlatform,
        ticket,
        dispatchCards
    );
    const currentTicket = consultorio
        ? getCalledTicketForConsultorio(consultorio)
        : null;
    const operatorContext =
        consultorio === 1 || consultorio === 2
            ? buildConsultorioOperatorContext(
                  manifest,
                  detectedPlatform,
                  consultorio
              )
            : null;
    const urgencyState =
        ageSec >= 14 * 60 ||
        String(ticket?.priorityClass || '')
            .trim()
            .toLowerCase() === 'appt_overdue'
            ? 'alert'
            : ageSec >= 8 * 60
              ? 'warning'
              : 'ready';

    let state = urgencyState;
    let badge =
        urgencyState === 'alert'
            ? 'Urgente'
            : dispatchCard?.primaryAction &&
                dispatchCard.primaryAction !== 'open' &&
                dispatchCard.primaryAction !== 'none'
              ? 'Acción lista'
              : 'En fila';
    let summary = consultorio
        ? `${ticket.ticketCode} ya está en ${laneLabel} y conviene seguir su próxima jugada sin bajar a la tabla.`
        : `${ticket.ticketCode} sigue en cola general y necesita consultorio antes de seguir envejeciendo.`;
    let recommendationLabel = dispatchCard
        ? dispatchCard.primaryLabel
        : 'Espera su turno en la secuencia';
    let primaryLabel = dispatchCard ? dispatchCard.primaryLabel : 'Sin acción';
    let chips = [
        `#${index + 1} global`,
        laneIndex >= 0
            ? `Posición ${laneIndex + 1} en ${laneLabel}`
            : laneLabel,
        queueTypeLabel,
    ];

    if (!dispatchCard) {
        if (consultorio && laneIndex > 0) {
            const blocker = ownWaitingTickets[laneIndex - 1] || null;
            state = urgencyState === 'alert' ? 'warning' : 'idle';
            badge = blocker ? 'Bloqueado' : 'En cola';
            summary = blocker
                ? `${ticket.ticketCode} todavía va detrás de ${blocker.ticketCode} en ${laneLabel}. No hace falta tocarlo hasta que salga ese turno.`
                : `${ticket.ticketCode} todavía no tiene una jugada inmediata en ${laneLabel}.`;
            recommendationLabel = blocker
                ? `Esperar a ${blocker.ticketCode}`
                : 'Sin acción inmediata';
            chips.push('Aún no es el siguiente');
        } else {
            chips.push('Sin operador listo');
        }
    } else if (dispatchCard.primaryAction === 'assign') {
        const assignLabel = `Asignar ${ticket.ticketCode} a ${dispatchCard.slotKey.toUpperCase()}`;
        summary = `${ticket.ticketCode} es el siguiente ticket que conviene sacar de cola general. ${dispatchCard.slotKey.toUpperCase()} tiene mejor ventana para absorberlo ahora.`;
        recommendationLabel = assignLabel;
        primaryLabel = assignLabel;
    } else if (dispatchCard.primaryAction === 'call') {
        summary = `${ticket.ticketCode} ya es el siguiente de ${laneLabel} y puede llamarse desde el hub sin revisar toda la tabla.`;
    } else if (dispatchCard.primaryAction === 'rebalance') {
        const rebalanceLabel = `Mover ${ticket.ticketCode} a ${dispatchCard.slotKey.toUpperCase()}`;
        summary = `${ticket.ticketCode} conviene moverlo ahora para repartir la carga entre consultorios antes de que siga subiendo la espera.`;
        recommendationLabel = rebalanceLabel;
        primaryLabel = rebalanceLabel;
        chips.push('Rebalanceo sugerido');
    } else if (dispatchCard.primaryAction === 'open') {
        state = 'warning';
        badge = 'Falta operador';
        summary = currentTicket
            ? `${ticket.ticketCode} será el siguiente de ${laneLabel}, pero ${currentTicket.ticketCode} sigue en atención. Deja el operador listo para no perder el ritmo cuando liberes.`
            : `${ticket.ticketCode} ya está listo, pero todavía falta operador confiable en ${laneLabel} para ejecutarlo desde el hub.`;
        chips.push(operatorContext?.heartbeatLabel || 'Operador sin heartbeat');
    }

    return {
        index,
        state,
        badge,
        headline: `${ticket.ticketCode} · ${laneLabel}`,
        summary,
        metaLabel: `${laneLabel} · ${formatQueueTicketAgeLabel(
            ticket,
            'waiting'
        )} · ${queueTypeLabel}`,
        recommendationLabel,
        chips,
        primaryLabel,
        actionCard: dispatchCard,
    };
}

function buildQueuePriorityLane(manifest, detectedPlatform) {
    const dispatchCards = {
        1: buildQueueDispatchCard(manifest, detectedPlatform, 1),
        2: buildQueueDispatchCard(manifest, detectedPlatform, 2),
    };
    const items = getPrioritySequenceTickets(4).map((ticket, index) =>
        buildQueuePriorityLaneItem(
            manifest,
            detectedPlatform,
            ticket,
            index,
            dispatchCards
        )
    );
    const actionableCount = items.filter(
        (item) =>
            item.actionCard &&
            item.actionCard.primaryAction &&
            item.actionCard.primaryAction !== 'none'
    ).length;
    const urgentCount = items.filter((item) => item.state === 'alert').length;
    const blockedCount = items.filter(
        (item) => item.state === 'warning'
    ).length;

    return {
        title:
            urgentCount > 0
                ? 'Fila priorizada con urgencias'
                : actionableCount > 0
                  ? 'Fila priorizada lista'
                  : 'Fila priorizada estable',
        summary:
            urgentCount > 0
                ? 'Esta secuencia resume los siguientes tickets que recepción debería tocar primero, con la jugada inmediata sugerida para cada uno.'
                : actionableCount > 0
                  ? 'Aquí aparece una secuencia corta de tickets críticos para operar uno detrás de otro sin abrir toda la cola.'
                  : 'No hay tickets en espera que exijan una secuencia inmediata ahora mismo.',
        statusLabel:
            urgentCount > 0
                ? `${urgentCount} urgencia(s) en secuencia`
                : actionableCount > 0
                  ? `${actionableCount} paso(s) listos`
                  : 'Sin secuencia urgente',
        statusState:
            urgentCount > 0
                ? 'alert'
                : blockedCount > 0
                  ? 'warning'
                  : actionableCount > 0
                    ? 'ready'
                    : 'idle',
        chips: [
            `Tickets ${items.length}`,
            `Urgencias ${urgentCount}`,
            `Acciones ${actionableCount}`,
        ],
        items,
    };
}

async function runQueuePriorityLaneAction(item, manifest, detectedPlatform) {
    if (!item?.actionCard) {
        return;
    }

    await runQueueDispatchAction(item.actionCard, manifest, detectedPlatform, {
        source: 'priority_lane',
    });
}

function renderQueuePriorityLane(manifest, detectedPlatform) {
    const root = document.getElementById('queuePriorityLane');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const lane = buildQueuePriorityLane(manifest, detectedPlatform);
    setHtml(
        '#queuePriorityLane',
        `
            <section class="queue-priority-lane__shell" data-state="${escapeHtml(
                lane.statusState
            )}">
                <div class="queue-priority-lane__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Fila priorizada</p>
                        <h5 id="queuePriorityLaneTitle" class="queue-app-card__title">${escapeHtml(
                            lane.title
                        )}</h5>
                        <p id="queuePriorityLaneSummary" class="queue-priority-lane__summary">${escapeHtml(
                            lane.summary
                        )}</p>
                    </div>
                    <div class="queue-priority-lane__meta">
                        <span
                            id="queuePriorityLaneStatus"
                            class="queue-priority-lane__status"
                            data-state="${escapeHtml(lane.statusState)}"
                        >
                            ${escapeHtml(lane.statusLabel)}
                        </span>
                        <div class="queue-priority-lane__chips">
                            ${lane.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-priority-lane__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queuePriorityLaneItems" class="queue-priority-lane__list" role="list" aria-label="Secuencia priorizada de tickets">
                    ${
                        lane.items.length
                            ? lane.items
                                  .map(
                                      (item) => `
                                <article
                                    id="queuePriorityLaneItem_${escapeHtml(
                                        String(item.index)
                                    )}"
                                    class="queue-priority-lane__item"
                                    data-state="${escapeHtml(item.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-priority-lane__item-rank">
                                        <span>${escapeHtml(
                                            String(item.index + 1)
                                        )}</span>
                                    </div>
                                    <div class="queue-priority-lane__item-main">
                                        <div class="queue-priority-lane__item-header">
                                            <div>
                                                <p id="queuePriorityLaneHeadline_${escapeHtml(
                                                    String(item.index)
                                                )}" class="queue-priority-lane__headline">${escapeHtml(
                                                    item.headline
                                                )}</p>
                                                <p id="queuePriorityLaneMeta_${escapeHtml(
                                                    String(item.index)
                                                )}" class="queue-priority-lane__meta-line">${escapeHtml(
                                                    item.metaLabel
                                                )}</p>
                                            </div>
                                            <span class="queue-priority-lane__badge">${escapeHtml(
                                                item.badge
                                            )}</span>
                                        </div>
                                        <p class="queue-priority-lane__detail">${escapeHtml(
                                            item.summary
                                        )}</p>
                                        <div class="queue-priority-lane__chips-row">
                                            ${item.chips
                                                .map(
                                                    (chip) =>
                                                        `<span class="queue-priority-lane__lane-chip">${escapeHtml(
                                                            chip
                                                        )}</span>`
                                                )
                                                .join('')}
                                        </div>
                                    </div>
                                    <div class="queue-priority-lane__item-side">
                                        <strong id="queuePriorityLaneRecommendation_${escapeHtml(
                                            String(item.index)
                                        )}" class="queue-priority-lane__recommendation">${escapeHtml(
                                            item.recommendationLabel
                                        )}</strong>
                                        <button
                                            id="queuePriorityLanePrimary_${escapeHtml(
                                                String(item.index)
                                            )}"
                                            type="button"
                                            class="queue-priority-lane__action queue-priority-lane__action--primary"
                                            ${item.actionCard ? '' : 'disabled'}
                                        >
                                            ${escapeHtml(item.primaryLabel)}
                                        </button>
                                    </div>
                                </article>
                            `
                                  )
                                  .join('')
                            : `
                                <article
                                    id="queuePriorityLaneEmpty"
                                    class="queue-priority-lane__empty"
                                    data-state="idle"
                                    role="listitem"
                                >
                                    <strong>Sin tickets por secuenciar</strong>
                                    <p>Cuando vuelva a entrar cola, aquí aparecerán los siguientes tickets críticos en el orden recomendado.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    lane.items.forEach((item) => {
        const button = document.getElementById(
            `queuePriorityLanePrimary_${item.index}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runQueuePriorityLaneAction(item, manifest, detectedPlatform);
        };
    });
}

function buildQueueQuickTrays() {
    const state = getState();
    const currentFilter = String(state.queue?.filter || 'all')
        .trim()
        .toLowerCase();
    const queueTickets = getQueueSource().queueTickets;
    const waitingUnassigned = getUnassignedWaitingTickets();
    const waitingC1 = getAssignedWaitingTickets(1);
    const waitingC2 = getAssignedWaitingTickets(2);
    const calledTickets = queueTickets.filter(
        (ticket) => ticket.status === 'called'
    );
    const riskTickets = queueTickets.filter((ticket) => {
        if (ticket.status !== 'waiting') {
            return false;
        }
        const ageMinutes = Math.max(
            0,
            Math.round(
                (Date.now() - getQueueTicketTimestampMs(ticket, 'waiting')) /
                    60000
            )
        );
        return (
            ageMinutes >= 20 ||
            String(ticket.priorityClass || '')
                .trim()
                .toLowerCase() === 'appt_overdue'
        );
    });

    const trays = [
        {
            filter: 'sla_risk',
            label: 'Urgentes',
            count: riskTickets.length,
            summary:
                riskTickets.length > 0
                    ? `${riskTickets[0].ticketCode} abre la bandeja de riesgo y debería revisarse primero.`
                    : 'No hay tickets vencidos o en riesgo SLA ahora mismo.',
        },
        {
            filter: 'waiting_unassigned',
            label: 'Sin consultorio',
            count: waitingUnassigned.length,
            summary:
                waitingUnassigned.length > 0
                    ? `${waitingUnassigned[0].ticketCode} sigue sin consultorio y conviene despacharlo desde el hub o la tabla.`
                    : 'Toda la cola en espera ya tiene consultorio asignado.',
        },
        {
            filter: 'waiting_c1',
            label: 'C1 en espera',
            count: waitingC1.length,
            summary:
                waitingC1.length > 0
                    ? `${waitingC1[0].ticketCode} es el siguiente ticket visible en C1.`
                    : 'C1 no tiene tickets esperando en la tabla.',
        },
        {
            filter: 'waiting_c2',
            label: 'C2 en espera',
            count: waitingC2.length,
            summary:
                waitingC2.length > 0
                    ? `${waitingC2[0].ticketCode} es el siguiente ticket visible en C2.`
                    : 'C2 no tiene tickets esperando en la tabla.',
        },
        {
            filter: 'called',
            label: 'Llamados activos',
            count: calledTickets.length,
            summary:
                calledTickets.length > 0
                    ? `${calledTickets[0].ticketCode} ya fue llamado y queda en seguimiento activo.`
                    : 'No hay tickets llamados activos en este momento.',
        },
    ].map((tray) => ({
        ...tray,
        active: currentFilter === tray.filter,
        countLabel: tray.count === 1 ? '1 ticket' : `${tray.count} tickets`,
        actionLabel:
            tray.count > 0
                ? tray.active
                    ? 'Bandeja activa'
                    : 'Abrir bandeja'
                : 'Sin tickets',
    }));

    const activeTray = trays.find((tray) => tray.active) || null;
    const nonEmptyCount = trays.filter((tray) => tray.count > 0).length;

    return {
        title:
            nonEmptyCount > 0
                ? 'Bandejas rápidas listas'
                : 'Bandejas rápidas sin carga',
        summary:
            nonEmptyCount > 0
                ? 'Abre la tabla ya filtrada por el frente correcto sin tocar primero el triage manual.'
                : 'Cuando vuelva a entrar cola, aquí aparecerán accesos directos a las vistas más útiles para recepción.',
        statusLabel: activeTray
            ? `Filtro activo: ${activeTray.label}`
            : nonEmptyCount > 0
              ? `${nonEmptyCount} bandeja(s) con tickets`
              : 'Sin bandejas activas',
        statusState: activeTray
            ? 'ready'
            : nonEmptyCount > 0
              ? 'warning'
              : 'idle',
        trays,
    };
}

function openQueueQuickTray(filter, label, count) {
    appendOpsLogEntry({
        tone: count > 0 ? 'info' : 'warning',
        source: 'quick_trays',
        title: `Bandeja rápida: ${label}`,
        summary:
            count > 0
                ? `Se abrió la vista filtrada de ${label.toLowerCase()} desde el hub.`
                : `Se abrió ${label.toLowerCase()}, pero no había tickets visibles para ese filtro.`,
    });

    const triage = document.getElementById('queueTriageToolbar');
    if (triage instanceof HTMLElement) {
        triage.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function renderQueueQuickTrays() {
    const root = document.getElementById('queueQuickTrays');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const trays = buildQueueQuickTrays();
    setHtml(
        '#queueQuickTrays',
        `
            <section class="queue-quick-trays__shell" data-state="${escapeHtml(
                trays.statusState
            )}">
                <div class="queue-quick-trays__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Bandejas rápidas</p>
                        <h5 id="queueQuickTraysTitle" class="queue-app-card__title">${escapeHtml(
                            trays.title
                        )}</h5>
                        <p id="queueQuickTraysSummary" class="queue-quick-trays__summary">${escapeHtml(
                            trays.summary
                        )}</p>
                    </div>
                    <div class="queue-quick-trays__meta">
                        <span
                            id="queueQuickTraysStatus"
                            class="queue-quick-trays__status"
                            data-state="${escapeHtml(trays.statusState)}"
                        >
                            ${escapeHtml(trays.statusLabel)}
                        </span>
                    </div>
                </div>
                <div id="queueQuickTraysCards" class="queue-quick-trays__grid" role="list" aria-label="Bandejas rápidas de la cola">
                    ${trays.trays
                        .map(
                            (tray) => `
                                <article
                                    id="queueQuickTray_${escapeHtml(tray.filter)}"
                                    class="queue-quick-tray"
                                    data-state="${tray.count > 0 ? 'ready' : 'idle'}"
                                    data-active="${tray.active ? 'true' : 'false'}"
                                    role="listitem"
                                >
                                    <div class="queue-quick-tray__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                tray.label
                                            )}</strong>
                                            <p class="queue-quick-tray__summary">${escapeHtml(
                                                tray.summary
                                            )}</p>
                                        </div>
                                        <span
                                            id="queueQuickTrayCount_${escapeHtml(
                                                tray.filter
                                            )}"
                                            class="queue-quick-tray__count"
                                        >
                                            ${escapeHtml(tray.countLabel)}
                                        </span>
                                    </div>
                                    <button
                                        id="queueQuickTrayAction_${escapeHtml(
                                            tray.filter
                                        )}"
                                        type="button"
                                        class="queue-quick-tray__action"
                                        data-action="queue-open-quick-tray"
                                        data-queue-filter-value="${escapeHtml(
                                            tray.filter
                                        )}"
                                        ${tray.active || tray.count === 0 ? 'disabled' : ''}
                                    >
                                        ${escapeHtml(tray.actionLabel)}
                                    </button>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    trays.trays.forEach((tray) => {
        const button = document.getElementById(
            `queueQuickTrayAction_${tray.filter}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            openQueueQuickTray(tray.filter, tray.label, tray.count);
        };
    });
}

function getQueueTrayFilterLabel(filter) {
    const normalized = String(filter || 'all')
        .trim()
        .toLowerCase();
    if (normalized === 'sla_risk') {
        return 'Urgentes';
    }
    if (normalized === 'waiting_unassigned') {
        return 'Sin consultorio';
    }
    if (normalized === 'waiting_c1') {
        return 'C1 en espera';
    }
    if (normalized === 'waiting_c2') {
        return 'C2 en espera';
    }
    if (normalized === 'called') {
        return 'Llamados activos';
    }
    if (normalized === 'waiting') {
        return 'Todos en espera';
    }
    if (normalized === 'no_show') {
        return 'No show';
    }
    return 'Tabla completa';
}

function buildActiveTrayItem(
    manifest,
    detectedPlatform,
    ticket,
    index,
    dispatchCards
) {
    const filter = String(getState().queue?.filter || 'all')
        .trim()
        .toLowerCase();
    const consultorio = Number(ticket?.assignedConsultorio || 0);
    const laneLabel = getQueuePriorityLaneLabel(ticket);
    const typeLabel = formatQueuePriorityTypeLabel(ticket);
    const ageLabel =
        ticket?.status === 'called'
            ? formatQueueTicketAgeLabel(ticket, 'called')
            : formatQueueTicketAgeLabel(ticket, 'waiting');

    let state = ticket?.status === 'called' ? 'active' : 'ready';
    let badge = ticket?.status === 'called' ? 'Llamado' : 'Pendiente';
    let summary = `${ticket.ticketCode} sigue visible en la bandeja actual.`;
    let recommendationLabel = 'Sin acción';
    let primaryLabel = 'Sin acción';
    let actionKind = 'none';
    let actionCard = null;
    let actionPayload = null;

    if (ticket?.status === 'called' && consultorio) {
        state = 'active';
        badge = 'Llamado';
        summary = `${ticket.ticketCode} ya fue llamado en ${laneLabel}. Puedes re-llamarlo desde esta bandeja sin salir del filtro.`;
        recommendationLabel = `Re-llamar ${ticket.ticketCode}`;
        primaryLabel = recommendationLabel;
        actionKind = 'recall';
        actionPayload = {
            ticketId: Number(ticket.id || 0),
            consultorio,
            ticketCode: String(ticket.ticketCode || ''),
        };
    } else {
        const recommendedDispatch = buildQueuePriorityActionCard(
            manifest,
            detectedPlatform,
            ticket,
            dispatchCards
        );
        if (recommendedDispatch) {
            actionKind = 'dispatch';
            actionCard = recommendedDispatch;
            recommendationLabel =
                filter === 'waiting_unassigned' &&
                recommendedDispatch.primaryAction === 'assign'
                    ? `Asignar ${ticket.ticketCode} a ${recommendedDispatch.slotKey.toUpperCase()}`
                    : recommendedDispatch.primaryAction === 'rebalance'
                      ? `Mover ${ticket.ticketCode} a ${recommendedDispatch.slotKey.toUpperCase()}`
                      : recommendedDispatch.primaryLabel;
            primaryLabel = recommendationLabel;
            summary =
                recommendedDispatch.primaryAction === 'assign'
                    ? `${ticket.ticketCode} sigue sin consultorio. ${recommendedDispatch.slotKey.toUpperCase()} es la salida más directa desde esta bandeja.`
                    : recommendedDispatch.primaryAction === 'call'
                      ? `${ticket.ticketCode} ya es el siguiente ticket listo dentro de la bandeja actual.`
                      : recommendedDispatch.primaryAction === 'open'
                        ? `${ticket.ticketCode} necesita dejar listo el operador correcto antes de avanzar desde esta bandeja.`
                        : `${ticket.ticketCode} tiene una siguiente jugada sugerida dentro de la bandeja actual.`;
            badge =
                recommendedDispatch.primaryAction === 'open'
                    ? 'Falta operador'
                    : recommendedDispatch.primaryAction === 'call'
                      ? 'Llamar'
                      : recommendedDispatch.primaryAction === 'assign'
                        ? 'Asignar'
                        : recommendedDispatch.primaryAction === 'rebalance'
                          ? 'Mover'
                          : badge;
            state =
                recommendedDispatch.primaryAction === 'open'
                    ? 'warning'
                    : state;
        } else if (
            (filter === 'waiting_c1' || filter === 'waiting_c2') &&
            consultorio
        ) {
            const ownWaiting = getAssignedWaitingTickets(consultorio);
            const laneIndex = ownWaiting.findIndex(
                (candidate) =>
                    Number(candidate.id || 0) === Number(ticket.id || 0)
            );
            const blocker = laneIndex > 0 ? ownWaiting[laneIndex - 1] : null;
            badge = blocker ? 'En cola' : badge;
            state = blocker ? 'idle' : state;
            summary = blocker
                ? `${ticket.ticketCode} todavía va detrás de ${blocker.ticketCode} en ${laneLabel}.`
                : `${ticket.ticketCode} está visible, pero todavía no requiere una acción rápida adicional desde esta bandeja.`;
            recommendationLabel = blocker
                ? `Esperar a ${blocker.ticketCode}`
                : 'Sin acción inmediata';
            primaryLabel = recommendationLabel;
        } else if (filter === 'sla_risk') {
            badge = 'Vigilar';
            state = 'warning';
            summary = `${ticket.ticketCode} sigue visible por riesgo SLA y conviene mantenerlo a la vista aunque todavía no tenga una acción directa desde esta bandeja.`;
            recommendationLabel = 'Revisar radar y despacho';
            primaryLabel = recommendationLabel;
        }
    }

    return {
        index,
        state,
        badge,
        headline: `${ticket.ticketCode} · ${laneLabel}`,
        metaLabel: `${ageLabel} · ${typeLabel}`,
        summary,
        recommendationLabel,
        primaryLabel,
        actionKind,
        actionCard,
        actionPayload,
    };
}

function buildActiveTrayPanel(manifest, detectedPlatform) {
    const state = getState();
    const filter = String(state.queue?.filter || 'all')
        .trim()
        .toLowerCase();
    const search = String(state.queue?.search || '').trim();
    const visibleTickets = getVisibleTickets();
    const dispatchCards = {
        1: buildQueueDispatchCard(manifest, detectedPlatform, 1),
        2: buildQueueDispatchCard(manifest, detectedPlatform, 2),
    };
    const items = visibleTickets
        .slice(0, 3)
        .map((ticket, index) =>
            buildActiveTrayItem(
                manifest,
                detectedPlatform,
                ticket,
                index,
                dispatchCards
            )
        );
    const activeFilterLabel = getQueueTrayFilterLabel(filter);
    const contextParts = [];
    if (filter !== 'all') {
        contextParts.push(activeFilterLabel);
    }
    if (search) {
        contextParts.push(`búsqueda "${search}"`);
    }
    const hasContext = contextParts.length > 0;

    return {
        title: hasContext
            ? `Bandeja activa: ${contextParts.join(' · ')}`
            : 'Bandeja activa: tabla completa',
        summary: hasContext
            ? 'Este panel resume la bandeja que tienes abierta y te deja ejecutar la siguiente jugada útil sin perder el contexto del filtro.'
            : 'No hay un filtro activo sobre la tabla. Usa una bandeja rápida cuando quieras abrir un frente operativo concreto.',
        statusLabel: hasContext
            ? `${visibleTickets.length} visible(s)`
            : 'Sin filtro activo',
        statusState: items.some((item) => item.state === 'warning')
            ? 'warning'
            : hasContext
              ? 'ready'
              : 'idle',
        hasContext,
        items,
        contextLabel: contextParts.join(' · '),
    };
}

async function runActiveTrayItemAction(item, manifest, detectedPlatform) {
    if (!item || item.actionKind === 'none') {
        return;
    }

    try {
        if (item.actionKind === 'dispatch' && item.actionCard) {
            await runQueueDispatchAction(
                item.actionCard,
                manifest,
                detectedPlatform,
                {
                    source: 'active_tray',
                }
            );
            return;
        }

        if (
            item.actionKind === 'recall' &&
            item.actionPayload?.ticketId > 0 &&
            item.actionPayload?.consultorio > 0
        ) {
            const { runQueueTicketAction } = await import('../../actions.js');
            await runQueueTicketAction(
                item.actionPayload.ticketId,
                're-llamar',
                item.actionPayload.consultorio
            );
            appendOpsLogEntry({
                tone: 'info',
                source: 'active_tray',
                title: `Bandeja activa: re-llamado`,
                summary: `${item.actionPayload.ticketCode} se re-llamó desde la bandeja activa.`,
            });
        }
    } catch (_error) {
        createToast(
            'No se pudo ejecutar la acción de la bandeja activa',
            'error'
        );
    } finally {
        rerenderQueueOpsHub(manifest, detectedPlatform);
    }
}

function renderActiveTrayPanel(manifest, detectedPlatform) {
    const root = document.getElementById('queueActiveTray');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const tray = buildActiveTrayPanel(manifest, detectedPlatform);
    setHtml(
        '#queueActiveTray',
        `
            <section class="queue-active-tray__shell" data-state="${escapeHtml(
                tray.statusState
            )}">
                <div class="queue-active-tray__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Bandeja activa</p>
                        <h5 id="queueActiveTrayTitle" class="queue-app-card__title">${escapeHtml(
                            tray.title
                        )}</h5>
                        <p id="queueActiveTraySummary" class="queue-active-tray__summary">${escapeHtml(
                            tray.summary
                        )}</p>
                    </div>
                    <div class="queue-active-tray__meta">
                        <span
                            id="queueActiveTrayStatus"
                            class="queue-active-tray__status"
                            data-state="${escapeHtml(tray.statusState)}"
                        >
                            ${escapeHtml(tray.statusLabel)}
                        </span>
                        <div class="queue-active-tray__actions">
                            <button
                                id="queueActiveTrayResetBtn"
                                type="button"
                                class="queue-active-tray__action"
                                data-action="queue-reset-tray-context"
                                ${tray.hasContext ? '' : 'disabled'}
                            >
                                Limpiar bandeja
                            </button>
                            <a
                                id="queueActiveTrayOpenTable"
                                href="#queueTriageToolbar"
                                class="queue-active-tray__action"
                            >
                                Ir a tabla
                            </a>
                        </div>
                    </div>
                </div>
                <div id="queueActiveTrayItems" class="queue-active-tray__list" role="list" aria-label="Resumen de la bandeja activa">
                    ${
                        tray.items.length
                            ? tray.items
                                  .map(
                                      (item) => `
                                        <article
                                            id="queueActiveTrayItem_${escapeHtml(
                                                String(item.index)
                                            )}"
                                            class="queue-active-tray__item"
                                            data-state="${escapeHtml(item.state)}"
                                            role="listitem"
                                        >
                                            <div class="queue-active-tray__item-main">
                                                <div class="queue-active-tray__item-header">
                                                    <div>
                                                        <p id="queueActiveTrayHeadline_${escapeHtml(
                                                            String(item.index)
                                                        )}" class="queue-active-tray__headline">${escapeHtml(
                                                            item.headline
                                                        )}</p>
                                                        <p id="queueActiveTrayMeta_${escapeHtml(
                                                            String(item.index)
                                                        )}" class="queue-active-tray__meta-line">${escapeHtml(
                                                            item.metaLabel
                                                        )}</p>
                                                    </div>
                                                    <span class="queue-active-tray__badge">${escapeHtml(
                                                        item.badge
                                                    )}</span>
                                                </div>
                                                <p class="queue-active-tray__detail">${escapeHtml(
                                                    item.summary
                                                )}</p>
                                            </div>
                                            <div class="queue-active-tray__item-side">
                                                <strong id="queueActiveTrayRecommendation_${escapeHtml(
                                                    String(item.index)
                                                )}" class="queue-active-tray__recommendation">${escapeHtml(
                                                    item.recommendationLabel
                                                )}</strong>
                                                <button
                                                    id="queueActiveTrayPrimary_${escapeHtml(
                                                        String(item.index)
                                                    )}"
                                                    type="button"
                                                    class="queue-active-tray__primary"
                                                    ${item.actionKind === 'none' ? 'disabled' : ''}
                                                >
                                                    ${escapeHtml(item.primaryLabel)}
                                                </button>
                                            </div>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article
                                    id="queueActiveTrayEmpty"
                                    class="queue-active-tray__empty"
                                    role="listitem"
                                >
                                    <strong>Sin tickets visibles en esta bandeja</strong>
                                    <p>Prueba otra bandeja rápida o limpia el filtro actual para volver a la tabla completa.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    tray.items.forEach((item) => {
        const button = document.getElementById(
            `queueActiveTrayPrimary_${item.index}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runActiveTrayItemAction(item, manifest, detectedPlatform);
        };
    });
}

function isQueueTrayBurstAutomatableItem(item) {
    if (!item) {
        return false;
    }

    if (item.actionKind === 'recall') {
        return Number(item.actionPayload?.ticketId || 0) > 0;
    }

    return (
        item.actionKind === 'dispatch' &&
        ['assign', 'rebalance', 'call'].includes(
            String(item.actionCard?.primaryAction || '')
        )
    );
}

function buildQueueTrayBurstStepsFromItem(item) {
    if (!isQueueTrayBurstAutomatableItem(item)) {
        return [];
    }

    if (item.actionKind === 'recall') {
        return [
            {
                tone: 'ready',
                kind: 'recall',
                title: item.recommendationLabel,
                detail: item.summary,
                ticketCode: String(item.actionPayload?.ticketCode || ''),
                ticketId: Number(item.actionPayload?.ticketId || 0),
                consultorio: Number(item.actionPayload?.consultorio || 0),
            },
        ];
    }

    const actionCard = item.actionCard;
    if (!actionCard) {
        return [];
    }

    const steps = [
        {
            tone:
                actionCard.primaryAction === 'rebalance' ? 'warning' : 'ready',
            kind: 'dispatch',
            title: item.recommendationLabel,
            detail: item.summary,
            actionCard,
        },
    ];

    if (
        ['assign', 'rebalance'].includes(actionCard.primaryAction) &&
        actionCard.targetTicketId > 0 &&
        actionCard.slot > 0
    ) {
        const slotLabel = actionCard.slotKey.toUpperCase();
        steps.push({
            tone: 'ready',
            kind: 'call',
            title: `Llamar ${actionCard.targetTicketCode} en ${slotLabel}`,
            detail: `${actionCard.targetTicketCode} queda encaminado a ${slotLabel}; la ráfaga completa el llamado sin salir de la bandeja actual.`,
            consultorio: actionCard.slot,
            ticketCode: actionCard.targetTicketCode,
        });
    }

    return steps;
}

function buildQueueTrayBurst(manifest, detectedPlatform) {
    const state = getState();
    const filter = String(state.queue?.filter || 'all')
        .trim()
        .toLowerCase();
    const search = String(state.queue?.search || '').trim();
    const visibleTickets = getVisibleTickets();
    const dispatchCards = {
        1: buildQueueDispatchCard(manifest, detectedPlatform, 1),
        2: buildQueueDispatchCard(manifest, detectedPlatform, 2),
    };
    const items = visibleTickets
        .slice(0, 3)
        .map((ticket, index) =>
            buildActiveTrayItem(
                manifest,
                detectedPlatform,
                ticket,
                index,
                dispatchCards
            )
        );
    const contextParts = [];
    if (filter !== 'all') {
        contextParts.push(getQueueTrayFilterLabel(filter));
    }
    if (search) {
        contextParts.push(`búsqueda "${search}"`);
    }
    const hasContext = contextParts.length > 0;
    const firstAutomatable = items.find((item) =>
        isQueueTrayBurstAutomatableItem(item)
    );
    const steps = firstAutomatable
        ? buildQueueTrayBurstStepsFromItem(firstAutomatable)
        : [];
    const manualCount = items.filter(
        (item) => item !== firstAutomatable && item.actionKind !== 'none'
    ).length;
    const blockedCount = items.filter(
        (item) =>
            item.actionKind === 'dispatch' &&
            String(item.actionCard?.primaryAction || '') === 'open'
    ).length;
    const title = hasContext
        ? `Ráfaga operativa: ${contextParts.join(' · ')}`
        : 'Ráfaga operativa: activa una bandeja';

    let summary =
        'Activa una bandeja rápida o una búsqueda para convertir la cola visible en una secuencia corta y accionable.';
    let statusLabel = 'Sin contexto activo';
    let statusState = 'idle';

    if (hasContext && steps.length > 0) {
        summary =
            steps.length > 1
                ? 'La ráfaga enlaza los pasos mínimos sobre la misma bandeja para reducir clics y dejar el siguiente ticket ya encaminado.'
                : 'La ráfaga ejecuta la jugada más corta que sale de la bandeja actual sin obligarte a bajar a la tabla.';
        if (manualCount > 0 || blockedCount > 0) {
            summary += ` Después quedarán ${
                manualCount + blockedCount
            } frente(s) para revisión manual.`;
        }
        statusLabel = `${steps.length} paso(s) listos`;
        statusState = blockedCount > 0 ? 'warning' : 'ready';
    } else if (hasContext && items.length > 0) {
        summary =
            blockedCount > 0
                ? 'La bandeja ya tiene tickets visibles, pero la secuencia automática se frena porque todavía falta abrir o alinear el operador correcto.'
                : 'La bandeja sigue visible, pero por ahora no hay una secuencia automática segura; revisa las recomendaciones individuales o cambia de bandeja.';
        statusLabel =
            blockedCount > 0
                ? `${blockedCount} bloqueo(s) manual(es)`
                : 'Sin ráfaga automática';
        statusState = blockedCount > 0 ? 'warning' : 'idle';
    } else if (hasContext) {
        summary =
            'La bandeja actual quedó sin tickets visibles. Limpia el contexto o abre otra bandeja rápida para generar una nueva secuencia.';
        statusLabel = 'Bandeja vacía';
    }

    return {
        title,
        summary,
        statusLabel,
        statusState,
        hasContext,
        steps,
        canRun: steps.length > 0,
        primaryLabel:
            steps.length > 0
                ? `Ejecutar ráfaga (${steps.length})`
                : 'Sin ráfaga lista',
        copyLabel: hasContext ? 'Copiar ráfaga' : 'Copiar guía',
        contextLabel: hasContext ? contextParts.join(' · ') : 'tabla completa',
        visibleCount: visibleTickets.length,
        blockedCount,
        manualCount,
    };
}

function buildQueueTrayBurstReport(burst) {
    return [
        `${burst.title} - ${formatDateTime(new Date().toISOString())}`,
        `Estado: ${burst.statusLabel}`,
        `Contexto: ${burst.contextLabel}`,
        `Tickets visibles: ${burst.visibleCount}`,
        ...burst.steps.map(
            (step, index) => `${index + 1}. ${step.title} - ${step.detail}`
        ),
        burst.steps.length
            ? `Pendientes manuales: ${burst.manualCount + burst.blockedCount}`
            : 'Sin secuencia automática lista',
    ].join('\n');
}

async function copyQueueTrayBurst(burst) {
    try {
        await navigator.clipboard.writeText(buildQueueTrayBurstReport(burst));
        createToast('Ráfaga copiada', 'success');
    } catch (_error) {
        createToast('No se pudo copiar la ráfaga', 'error');
    }
}

async function runQueueTrayBurstStep(step, manifest, detectedPlatform) {
    if (!step) {
        return;
    }

    if (step.kind === 'dispatch' && step.actionCard) {
        await runQueueDispatchAction(
            step.actionCard,
            manifest,
            detectedPlatform,
            {
                source: 'tray_burst',
                deferRerender: true,
            }
        );
        return;
    }

    const { callNextForConsultorio, runQueueTicketAction } =
        await import('../../actions.js');
    if (step.kind === 'call' && step.consultorio > 0) {
        await callNextForConsultorio(step.consultorio);
        appendOpsLogEntry({
            tone: 'info',
            source: 'tray_burst',
            title: `Ráfaga: llamado en C${step.consultorio}`,
            summary: `${step.ticketCode} se llamó como parte de la ráfaga operativa.`,
        });
        return;
    }

    if (step.kind === 'recall' && step.ticketId > 0 && step.consultorio > 0) {
        await runQueueTicketAction(
            step.ticketId,
            're-llamar',
            step.consultorio
        );
        appendOpsLogEntry({
            tone: 'info',
            source: 'tray_burst',
            title: `Ráfaga: re-llamado en C${step.consultorio}`,
            summary: `${step.ticketCode} se re-llamó como parte de la ráfaga operativa.`,
        });
    }
}

async function runQueueTrayBurst(manifest, detectedPlatform) {
    const burst = buildQueueTrayBurst(manifest, detectedPlatform);
    if (!burst.steps.length) {
        return;
    }

    try {
        for (const step of burst.steps) {
            await runQueueTrayBurstStep(step, manifest, detectedPlatform);
        }
        appendOpsLogEntry({
            tone: 'success',
            source: 'tray_burst',
            title: `Ráfaga operativa ejecutada`,
            summary: `${burst.steps.length} paso(s) se ejecutaron desde ${burst.contextLabel}.`,
        });
    } catch (_error) {
        createToast('No se pudo completar la ráfaga operativa', 'error');
    } finally {
        rerenderQueueOpsHub(manifest, detectedPlatform);
    }
}

function renderQueueTrayBurst(manifest, detectedPlatform) {
    const root = document.getElementById('queueTrayBurst');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const burst = buildQueueTrayBurst(manifest, detectedPlatform);
    setHtml(
        '#queueTrayBurst',
        `
            <section class="queue-tray-burst__shell" data-state="${escapeHtml(
                burst.statusState
            )}">
                <div class="queue-tray-burst__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Ráfaga operativa</p>
                        <h5 id="queueTrayBurstTitle" class="queue-app-card__title">${escapeHtml(
                            burst.title
                        )}</h5>
                        <p id="queueTrayBurstSummary" class="queue-tray-burst__summary">${escapeHtml(
                            burst.summary
                        )}</p>
                    </div>
                    <div class="queue-tray-burst__meta">
                        <span
                            id="queueTrayBurstStatus"
                            class="queue-tray-burst__status"
                            data-state="${escapeHtml(burst.statusState)}"
                        >
                            ${escapeHtml(burst.statusLabel)}
                        </span>
                        <div class="queue-tray-burst__actions">
                            <button
                                id="queueTrayBurstRunBtn"
                                type="button"
                                class="queue-tray-burst__action queue-tray-burst__action--primary"
                                ${burst.canRun ? '' : 'disabled'}
                            >
                                ${escapeHtml(burst.primaryLabel)}
                            </button>
                            <button
                                id="queueTrayBurstCopyBtn"
                                type="button"
                                class="queue-tray-burst__action"
                                ${burst.hasContext ? '' : 'disabled'}
                            >
                                ${escapeHtml(burst.copyLabel)}
                            </button>
                        </div>
                    </div>
                </div>
                <div id="queueTrayBurstSteps" class="queue-tray-burst__steps" role="list" aria-label="Secuencia de ráfaga operativa">
                    ${
                        burst.steps.length
                            ? burst.steps
                                  .map(
                                      (step, index) => `
                                        <article
                                            id="queueTrayBurstStep_${escapeHtml(
                                                String(index)
                                            )}"
                                            class="queue-tray-burst__step"
                                            data-state="${escapeHtml(step.tone)}"
                                            role="listitem"
                                        >
                                            <span class="queue-tray-burst__step-rank">${
                                                index + 1
                                            }</span>
                                            <div class="queue-tray-burst__step-main">
                                                <p id="queueTrayBurstStepTitle_${escapeHtml(
                                                    String(index)
                                                )}" class="queue-tray-burst__step-title">${escapeHtml(
                                                    step.title
                                                )}</p>
                                                <p id="queueTrayBurstStepDetail_${escapeHtml(
                                                    String(index)
                                                )}" class="queue-tray-burst__step-detail">${escapeHtml(
                                                    step.detail
                                                )}</p>
                                            </div>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article
                                    id="queueTrayBurstEmpty"
                                    class="queue-tray-burst__empty"
                                    role="listitem"
                                >
                                    <strong>Sin secuencia automática disponible</strong>
                                    <p>Activa una bandeja con tickets visibles o deja listo el operador correcto para que la ráfaga pueda encadenar pasos seguros.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    const runButton = document.getElementById('queueTrayBurstRunBtn');
    if (runButton instanceof HTMLButtonElement) {
        runButton.onclick = async () => {
            runButton.disabled = true;
            await runQueueTrayBurst(manifest, detectedPlatform);
        };
    }

    const copyButton = document.getElementById('queueTrayBurstCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueueTrayBurst(burst);
        };
    }
}

function buildQueueDispatchCard(manifest, detectedPlatform, consultorio) {
    const operatorContext = buildConsultorioOperatorContext(
        manifest,
        detectedPlatform,
        consultorio
    );
    const {
        slot,
        slotKey,
        operatorAssigned,
        operatorLive,
        operatorLabel,
        operatorUrl,
        oneTapLabel,
        numpadLabel,
        heartbeatLabel,
    } = operatorContext;
    const otherSlot = slot === 2 ? 1 : 2;
    const currentTicket = getCalledTicketForConsultorio(slot);
    const ownWaitingTickets = getAssignedWaitingTickets(slot);
    const otherWaitingTickets = getAssignedWaitingTickets(otherSlot);
    const generalWaitingTickets = getUnassignedWaitingTickets();
    const nextAssignedTicket = ownWaitingTickets[0] || null;
    const nextGeneralTicket = generalWaitingTickets[0] || null;
    const rebalanceTicket =
        ownWaitingTickets.length === 0 && otherWaitingTickets.length >= 2
            ? otherWaitingTickets[1]
            : null;
    const ownBacklog = ownWaitingTickets.length;
    const otherBacklog = otherWaitingTickets.length;
    const generalBacklog = generalWaitingTickets.length;

    let state = 'idle';
    let badge = 'Sin acción inmediata';
    let headline = `${slotKey.toUpperCase()} sin movimiento urgente`;
    let detail =
        'No hay ticket listo para mover o llamar desde este consultorio en este momento.';
    let primaryAction = 'none';
    let primaryLabel = 'Sin acción';
    let targetTicket = null;
    let targetLabel = 'Sin ticket pendiente';

    if (currentTicket) {
        state = 'active';
        badge = 'En atención';
        headline = `${currentTicket.ticketCode} sigue en atención`;
        detail = `${slotKey.toUpperCase()} está ocupado ahora. Deja visible el operador y prepara el siguiente paso sin cambiar de tarjeta.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        targetTicket = currentTicket;
        targetLabel = `${currentTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            currentTicket,
            'called'
        )}`;
    } else if (nextAssignedTicket && operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Llamar ahora';
        headline = `${nextAssignedTicket.ticketCode} listo para ${slotKey.toUpperCase()}`;
        detail = `El ticket ya está alineado a ${slotKey.toUpperCase()} y el operador correcto está arriba. Puedes llamarlo sin bajar a la tabla.`;
        primaryAction = 'call';
        primaryLabel = `Llamar ${nextAssignedTicket.ticketCode}`;
        targetTicket = nextAssignedTicket;
        targetLabel = `${nextAssignedTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            nextAssignedTicket,
            'waiting'
        )}`;
    } else if (nextGeneralTicket && operatorAssigned && operatorLive) {
        state = 'suggested';
        badge = 'Tomar de cola general';
        headline = `${slotKey.toUpperCase()} puede absorber ${nextGeneralTicket.ticketCode}`;
        detail = `Hay ${generalBacklog} ticket(s) sin consultorio. Reasigna el más antiguo a ${slotKey.toUpperCase()} para destrabar recepción antes del siguiente pico.`;
        primaryAction = 'assign';
        primaryLabel = `Asignar ${nextGeneralTicket.ticketCode}`;
        targetTicket = nextGeneralTicket;
        targetLabel = `${nextGeneralTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            nextGeneralTicket,
            'waiting'
        )}`;
    } else if (rebalanceTicket && operatorAssigned && operatorLive) {
        state = 'warning';
        badge = 'Rebalancear cola';
        headline = `${slotKey.toUpperCase()} puede ayudar a C${otherSlot}`;
        detail = `C${otherSlot} ya acumula ${otherBacklog} en espera. Mueve ${rebalanceTicket.ticketCode} a ${slotKey.toUpperCase()} para repartir mejor la carga.`;
        primaryAction = 'rebalance';
        primaryLabel = `Mover ${rebalanceTicket.ticketCode}`;
        targetTicket = rebalanceTicket;
        targetLabel = `${rebalanceTicket.ticketCode} · ${formatQueueTicketAgeLabel(
            rebalanceTicket,
            'waiting'
        )}`;
    } else if (nextAssignedTicket || nextGeneralTicket || rebalanceTicket) {
        state = 'warning';
        badge = 'Falta operador';
        headline = `Prepara Operador ${slotKey.toUpperCase()}`;
        detail = `Hay ticket pendiente para ${slotKey.toUpperCase()}, pero todavía no coincide el operador reportado. Abre la app correcta antes de despachar desde aquí.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
        targetTicket =
            nextAssignedTicket || nextGeneralTicket || rebalanceTicket;
        targetLabel = targetTicket
            ? `${targetTicket.ticketCode} · ${formatQueueTicketAgeLabel(
                  targetTicket,
                  'waiting'
              )}`
            : 'Sin ticket pendiente';
    } else if (!operatorAssigned && operatorLive) {
        state = 'warning';
        badge = 'Operador en otra estación';
        headline = `${slotKey.toUpperCase()} sin operador dedicado`;
        detail = `El operador vivo no coincide con ${slotKey.toUpperCase()}. Deja abierto el consultorio correcto antes de que vuelva a entrar cola.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
    } else if (operatorAssigned && operatorLive) {
        state = 'ready';
        badge = 'Equipo listo';
        headline = `${slotKey.toUpperCase()} preparado para el próximo ticket`;
        detail = `No hay turno esperando ahora, pero ${slotKey.toUpperCase()} ya tiene operador, numpad y heartbeat listos para absorber el siguiente ingreso.`;
        primaryAction = 'open';
        primaryLabel = `Abrir Operador ${slotKey.toUpperCase()}`;
    }

    return {
        slot,
        slotKey,
        state,
        badge,
        headline,
        detail,
        targetTicketId: Number(targetTicket?.id || 0),
        targetTicketCode: String(targetTicket?.ticketCode || ''),
        targetLabel,
        primaryAction,
        primaryLabel,
        operatorUrl,
        queueMixLabel: `${slotKey.toUpperCase()} ${ownBacklog} · General ${generalBacklog}`,
        backlogLabel: `C${otherSlot} ${otherBacklog} · Heartbeat ${heartbeatLabel}`,
        chips: [operatorLabel, oneTapLabel, numpadLabel],
    };
}

function buildQueueDispatchDeck(manifest, detectedPlatform) {
    const cards = [1, 2].map((consultorio) =>
        buildQueueDispatchCard(manifest, detectedPlatform, consultorio)
    );
    const actionableCount = cards.filter((card) =>
        ['call', 'assign', 'rebalance'].includes(card.primaryAction)
    ).length;
    const blockedCount = cards.filter(
        (card) => card.state === 'warning' && card.primaryAction === 'open'
    ).length;
    const waitingGeneralCount = getUnassignedWaitingTickets().length;

    return {
        title:
            actionableCount > 0
                ? 'Despacho sugerido listo'
                : blockedCount > 0
                  ? 'Despacho sugerido con bloqueos'
                  : 'Despacho sugerido estable',
        summary:
            actionableCount > 0
                ? 'Aquí aparece la siguiente jugada útil por consultorio para llamar o mover tickets sin revisar toda la tabla.'
                : blockedCount > 0
                  ? 'El hub detectó tickets movibles, pero aún falta operador o contexto para despacharlos con confianza.'
                  : 'No hay movimiento urgente: ambos consultorios están balanceados o sin cola pendiente.',
        statusLabel:
            actionableCount > 0
                ? `${actionableCount} acción(es) recomendada(s)`
                : blockedCount > 0
                  ? `${blockedCount} bloqueo(s) operativos`
                  : 'Sin movimiento urgente',
        statusState:
            actionableCount > 0
                ? 'ready'
                : blockedCount > 0
                  ? 'warning'
                  : 'idle',
        chips: [
            `Generales ${waitingGeneralCount}`,
            `Acciones ${actionableCount}`,
            `Bloqueos ${blockedCount}`,
        ],
        cards,
    };
}

function describeDispatchAction(card) {
    if (card.primaryAction === 'call') {
        return {
            title: `Despacho ${card.slotKey.toUpperCase()}: llamado rápido`,
            summary: `${card.targetTicketCode} se llamó desde la tarjeta de despacho sugerido.`,
        };
    }
    if (card.primaryAction === 'assign') {
        return {
            title: `Despacho ${card.slotKey.toUpperCase()}: ticket tomado de cola general`,
            summary: `${card.targetTicketCode} se reasignó a ${card.slotKey.toUpperCase()} desde el hub.`,
        };
    }
    if (card.primaryAction === 'rebalance') {
        return {
            title: `Despacho ${card.slotKey.toUpperCase()}: rebalanceo aplicado`,
            summary: `${card.targetTicketCode} se movió a ${card.slotKey.toUpperCase()} para repartir la carga del turno.`,
        };
    }
    return {
        title: `Despacho ${card.slotKey.toUpperCase()}: operador abierto`,
        summary: `Se abrió la ruta preparada de Operador ${card.slotKey.toUpperCase()} desde el hub.`,
    };
}

async function runQueueDispatchAction(
    card,
    manifest,
    detectedPlatform,
    options = {}
) {
    if (!card || card.primaryAction === 'none') {
        return;
    }

    try {
        const { callNextForConsultorio, runQueueTicketAction } =
            await import('../../actions.js');
        if (card.primaryAction === 'call') {
            await callNextForConsultorio(card.slot);
        } else if (
            (card.primaryAction === 'assign' ||
                card.primaryAction === 'rebalance') &&
            card.targetTicketId > 0
        ) {
            await runQueueTicketAction(
                card.targetTicketId,
                'reasignar',
                card.slot
            );
        } else if (card.primaryAction === 'open') {
            window.open(card.operatorUrl, '_blank', 'noopener');
        }

        appendOpsLogEntry({
            source:
                typeof options.source === 'string' && options.source
                    ? options.source
                    : 'dispatch',
            tone: card.primaryAction === 'rebalance' ? 'warning' : 'info',
            ...describeDispatchAction(card),
        });
    } catch (_error) {
        createToast('No se pudo ejecutar el despacho sugerido', 'error');
    } finally {
        if (!options.deferRerender) {
            rerenderQueueOpsHub(manifest, detectedPlatform);
        }
    }
}

function renderQueueDispatchDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueDispatchDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const deck = buildQueueDispatchDeck(manifest, detectedPlatform);
    setHtml(
        '#queueDispatchDeck',
        `
            <section class="queue-dispatch-deck__shell" data-state="${escapeHtml(
                deck.statusState
            )}">
                <div class="queue-dispatch-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Despacho sugerido</p>
                        <h5 id="queueDispatchDeckTitle" class="queue-app-card__title">${escapeHtml(
                            deck.title
                        )}</h5>
                        <p id="queueDispatchDeckSummary" class="queue-dispatch-deck__summary">${escapeHtml(
                            deck.summary
                        )}</p>
                    </div>
                    <div class="queue-dispatch-deck__meta">
                        <span
                            id="queueDispatchDeckStatus"
                            class="queue-dispatch-deck__status"
                            data-state="${escapeHtml(deck.statusState)}"
                        >
                            ${escapeHtml(deck.statusLabel)}
                        </span>
                        <div class="queue-dispatch-deck__chips">
                            ${deck.chips
                                .map(
                                    (chip) =>
                                        `<span class="queue-dispatch-deck__chip">${escapeHtml(
                                            chip
                                        )}</span>`
                                )
                                .join('')}
                        </div>
                    </div>
                </div>
                <div id="queueDispatchDeckCards" class="queue-dispatch-deck__grid" role="list" aria-label="Despacho sugerido por consultorio">
                    ${deck.cards
                        .map(
                            (card) => `
                                <article
                                    id="queueDispatchCard_${escapeHtml(card.slotKey)}"
                                    class="queue-dispatch-card"
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-dispatch-card__header">
                                        <div>
                                            <strong>${escapeHtml(
                                                card.slotKey.toUpperCase()
                                            )}</strong>
                                            <p id="queueDispatchHeadline_${escapeHtml(
                                                card.slotKey
                                            )}" class="queue-dispatch-card__headline">${escapeHtml(
                                                card.headline
                                            )}</p>
                                        </div>
                                        <span class="queue-dispatch-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <p id="queueDispatchDetail_${escapeHtml(
                                        card.slotKey
                                    )}" class="queue-dispatch-card__detail">${escapeHtml(
                                        card.detail
                                    )}</p>
                                    <div class="queue-dispatch-card__facts">
                                        <div class="queue-dispatch-card__fact">
                                            <span>Ticket objetivo</span>
                                            <strong id="queueDispatchTarget_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.targetLabel)}</strong>
                                        </div>
                                        <div class="queue-dispatch-card__fact">
                                            <span>Mix de cola</span>
                                            <strong id="queueDispatchQueue_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.queueMixLabel)}</strong>
                                        </div>
                                        <div class="queue-dispatch-card__fact">
                                            <span>Contexto</span>
                                            <strong id="queueDispatchBacklog_${escapeHtml(
                                                card.slotKey
                                            )}">${escapeHtml(card.backlogLabel)}</strong>
                                        </div>
                                    </div>
                                    <div class="queue-dispatch-card__chips">
                                        ${card.chips
                                            .map(
                                                (chip) =>
                                                    `<span class="queue-dispatch-card__chip">${escapeHtml(
                                                        chip
                                                    )}</span>`
                                            )
                                            .join('')}
                                    </div>
                                    <div class="queue-dispatch-card__actions">
                                        <button
                                            id="queueDispatchPrimary_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            type="button"
                                            class="queue-dispatch-card__action queue-dispatch-card__action--primary"
                                            data-queue-dispatch-action="${escapeHtml(
                                                card.primaryAction
                                            )}"
                                            data-queue-consultorio="${escapeHtml(
                                                String(card.slot)
                                            )}"
                                            data-queue-ticket-id="${escapeHtml(
                                                String(card.targetTicketId)
                                            )}"
                                            ${card.primaryAction === 'none' ? 'disabled' : ''}
                                        >
                                            ${escapeHtml(card.primaryLabel)}
                                        </button>
                                        <a
                                            id="queueDispatchOpenOperator_${escapeHtml(
                                                card.slotKey
                                            )}"
                                            href="${escapeHtml(card.operatorUrl)}"
                                            class="queue-dispatch-card__action"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            Operador ${escapeHtml(card.slotKey.toUpperCase())}
                                        </a>
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    deck.cards.forEach((card) => {
        const button = document.getElementById(
            `queueDispatchPrimary_${card.slotKey}`
        );
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = async () => {
            button.disabled = true;
            await runQueueDispatchAction(card, manifest, detectedPlatform);
        };
    });
}

function renderQueueQuickConsoleAction(action, index) {
    const safeId = String(action.id || `queueQuickConsoleAction_${index}`);
    const className =
        action.variant === 'primary'
            ? 'queue-quick-console__action queue-quick-console__action--primary'
            : 'queue-quick-console__action';

    if (action.kind === 'anchor') {
        return `
            <a
                id="${escapeHtml(safeId)}"
                href="${escapeHtml(action.href || '#queue')}"
                class="${className}"
                ${action.external ? 'target="_blank" rel="noopener"' : ''}
            >
                ${escapeHtml(action.label || 'Abrir')}
            </a>
        `;
    }

    return `
        <button
            id="${escapeHtml(safeId)}"
            type="button"
            class="${className}"
            ${action.action ? `data-action="${escapeHtml(action.action)}"` : ''}
            ${action.consultorio ? `data-queue-consultorio="${escapeHtml(String(action.consultorio))}"` : ''}
        >
            ${escapeHtml(action.label || 'Continuar')}
        </button>
    `;
}

function buildQueueQuickConsole(manifest, detectedPlatform) {
    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });
    const openingAssist = buildOpeningChecklistAssist(detectedPlatform);
    const handoffAssist = buildShiftHandoffAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const chips = [
        getInstallPresetLabel(detectedPlatform),
        syncHealth.badge,
        focus.effectiveMode === 'closing'
            ? `Relevo ${handoffAssist.suggestedCount}/${SHIFT_HANDOFF_STEP_IDS.length}`
            : `Apertura ${openingAssist.suggestedCount}/${OPENING_CHECKLIST_STEP_IDS.length}`,
    ];

    if (focus.effectiveMode === 'opening') {
        return {
            tone: 'opening',
            title: 'Consola rápida: Apertura',
            summary:
                openingAssist.suggestedCount > 0
                    ? `Confirma pasos sugeridos o abre cada superficie sin bajar al resto del panel. Ideal para dejar listo Operador, Kiosco y Sala TV en menos clics.`
                    : 'Abre cada superficie operativa o vuelve al checklist de apertura para completar las validaciones manuales pendientes.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_opening_apply',
                    kind: 'button',
                    label:
                        openingAssist.suggestedCount > 0
                            ? `Confirmar sugeridos (${openingAssist.suggestedCount})`
                            : 'Sin sugeridos ahora',
                    variant: 'primary',
                },
                {
                    id: 'queueQuickConsoleAction_open_operator',
                    kind: 'anchor',
                    label: 'Abrir Operador',
                    href: operatorUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_kiosk',
                    kind: 'anchor',
                    label: 'Abrir Kiosco',
                    href: kioskUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_sala',
                    kind: 'anchor',
                    label: 'Abrir Sala TV',
                    href: salaUrl,
                    external: true,
                },
            ],
        };
    }

    if (focus.effectiveMode === 'incidents') {
        return {
            tone: 'incidents',
            title: 'Consola rápida: Incidencias',
            summary:
                'Enfoca refresh, contingencia y registro de incidencia sin perder tiempo buscando la acción correcta en todo el hub.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_refresh',
                    kind: 'button',
                    label: 'Refrescar cola',
                    variant: 'primary',
                    action: 'queue-refresh-state',
                },
                {
                    id: 'queueQuickConsoleAction_incident_log',
                    kind: 'button',
                    label: 'Registrar incidencia',
                },
                {
                    id: 'queueQuickConsoleAction_open_contingency',
                    kind: 'anchor',
                    label: 'Ir a contingencias',
                    href: '#queueContingencyDeck',
                },
                {
                    id: 'queueQuickConsoleAction_open_log',
                    kind: 'anchor',
                    label: 'Ir a bitácora',
                    href: '#queueOpsLog',
                },
            ],
        };
    }

    if (focus.effectiveMode === 'closing') {
        return {
            tone: 'closing',
            title: 'Consola rápida: Cierre',
            summary:
                handoffAssist.suggestedCount > 0
                    ? 'Confirma el relevo sugerido, copia el resumen y deja a la vista las superficies críticas del cierre.'
                    : 'Abre operador o sala y remata el cierre del turno sin desplazarte por todos los bloques.',
            chips,
            actions: [
                {
                    id: 'queueQuickConsoleAction_closing_apply',
                    kind: 'button',
                    label:
                        handoffAssist.suggestedCount > 0
                            ? `Confirmar relevo (${handoffAssist.suggestedCount})`
                            : 'Sin relevo sugerido ahora',
                    variant: 'primary',
                },
                {
                    id: 'queueQuickConsoleAction_copy_handoff',
                    kind: 'button',
                    label: 'Copiar resumen de relevo',
                },
                {
                    id: 'queueQuickConsoleAction_open_operator_close',
                    kind: 'anchor',
                    label: 'Abrir Operador',
                    href: operatorUrl,
                    external: true,
                },
                {
                    id: 'queueQuickConsoleAction_open_sala_close',
                    kind: 'anchor',
                    label: 'Abrir Sala TV',
                    href: salaUrl,
                    external: true,
                },
            ],
        };
    }

    return {
        tone: 'operations',
        title: 'Consola rápida: Operación',
        summary:
            'Llama el siguiente turno, refresca la cola o abre la superficie correcta sin saltar entre el header y el resto del hub.',
        chips,
        actions: [
            {
                id: 'queueQuickConsoleAction_call_c1',
                kind: 'button',
                label: 'Llamar C1',
                variant: 'primary',
                action: 'queue-call-next',
                consultorio: 1,
            },
            {
                id: 'queueQuickConsoleAction_call_c2',
                kind: 'button',
                label: 'Llamar C2',
                action: 'queue-call-next',
                consultorio: 2,
            },
            {
                id: 'queueQuickConsoleAction_refresh_ops',
                kind: 'button',
                label: 'Refrescar cola',
                action: 'queue-refresh-state',
            },
            {
                id: 'queueQuickConsoleAction_open_operator_ops',
                kind: 'anchor',
                label: 'Abrir Operador',
                href: operatorUrl,
                external: true,
            },
        ],
    };
}

function renderQueueQuickConsole(manifest, detectedPlatform) {
    const root = document.getElementById('queueQuickConsole');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const consoleData = buildQueueQuickConsole(manifest, detectedPlatform);
    setHtml(
        '#queueQuickConsole',
        `
            <section class="queue-quick-console__shell" data-state="${escapeHtml(
                consoleData.tone
            )}">
                <div class="queue-quick-console__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Consola rápida</p>
                        <h5 id="queueQuickConsoleTitle" class="queue-app-card__title">${escapeHtml(
                            consoleData.title
                        )}</h5>
                        <p id="queueQuickConsoleSummary" class="queue-quick-console__summary">${escapeHtml(
                            consoleData.summary
                        )}</p>
                    </div>
                    <div class="queue-quick-console__chips">
                        ${consoleData.chips
                            .map(
                                (chip, index) => `
                                    <span
                                        ${index === 0 ? 'id="queueQuickConsoleChip"' : ''}
                                        class="queue-quick-console__chip"
                                    >
                                        ${escapeHtml(chip)}
                                    </span>
                                `
                            )
                            .join('')}
                    </div>
                </div>
                <div id="queueQuickConsoleActions" class="queue-quick-console__actions">
                    ${consoleData.actions
                        .map((action, index) =>
                            renderQueueQuickConsoleAction(action, index)
                        )
                        .join('')}
                </div>
            </section>
        `
    );

    const openingApplyButton = document.getElementById(
        'queueQuickConsoleAction_opening_apply'
    );
    if (openingApplyButton instanceof HTMLButtonElement) {
        openingApplyButton.disabled =
            buildOpeningChecklistAssist(detectedPlatform).suggestedCount <= 0;
        openingApplyButton.onclick = () => {
            const assist = buildOpeningChecklistAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `La consola rápida confirmó sugeridos de apertura. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const incidentButton = document.getElementById(
        'queueQuickConsoleAction_incident_log'
    );
    if (incidentButton instanceof HTMLButtonElement) {
        incidentButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogIncidentEntry(manifest, detectedPlatform)
            );
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const closingApplyButton = document.getElementById(
        'queueQuickConsoleAction_closing_apply'
    );
    if (closingApplyButton instanceof HTMLButtonElement) {
        closingApplyButton.disabled =
            buildShiftHandoffAssist(detectedPlatform).suggestedCount <= 0;
        closingApplyButton.onclick = () => {
            const assist = buildShiftHandoffAssist(detectedPlatform);
            if (!assist.suggestedIds.length) {
                return;
            }
            applyShiftHandoffSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'handoff',
                title: `Relevo: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary:
                    'La consola rápida confirmó el relevo sugerido del turno.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyHandoffButton = document.getElementById(
        'queueQuickConsoleAction_copy_handoff'
    );
    if (copyHandoffButton instanceof HTMLButtonElement) {
        copyHandoffButton.onclick = () => {
            void copyShiftHandoffSummary(detectedPlatform);
        };
    }
}

function buildQueuePlaybook(manifest, detectedPlatform) {
    const focus = buildQueueFocusMode(manifest, detectedPlatform);
    const definitions = buildPlaybookDefinitions(manifest, detectedPlatform);
    const mode = focus.effectiveMode;
    const steps = definitions[mode] || [];
    const state = ensureOpsPlaybookState();
    const modeState =
        state.modes && typeof state.modes[mode] === 'object'
            ? state.modes[mode]
            : {};
    const completedCount = steps.filter((step) =>
        Boolean(modeState[step.id])
    ).length;
    const nextStep = steps.find((step) => !modeState[step.id]) || null;
    const summary = nextStep
        ? `Paso actual: ${nextStep.title}. ${nextStep.detail}`
        : 'La secuencia de este modo ya quedó completa. Puedes reiniciarla o pasar al siguiente momento del turno.';

    return {
        mode,
        title: `Playbook activo: ${focus.title.replace('Modo foco: ', '')}`,
        summary,
        steps,
        completedCount,
        totalSteps: steps.length,
        nextStep,
        modeState,
    };
}

function buildQueuePlaybookAssist(manifest, detectedPlatform) {
    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const opening = ensureOpeningChecklistState();
    const shift = ensureShiftHandoffState();
    const openingAssist = buildOpeningChecklistAssist(detectedPlatform);
    const handoffAssist = buildShiftHandoffAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const operator = getSurfaceTelemetryState('operator');
    const kiosk = getSurfaceTelemetryState('kiosk');
    const display = getSurfaceTelemetryState('display');
    const log = ensureOpsLogState();
    const logHasIncident = log.items.some((item) => item.source === 'incident');
    const logHasStatus = log.items.some((item) => item.source === 'status');
    const openingMap = {
        opening_operator: {
            suggested:
                Boolean(opening.steps.operator_ready) ||
                Boolean(openingAssist.suggestions.operator_ready?.suggested),
            reason:
                openingAssist.suggestions.operator_ready?.reason ||
                'Operador todavía necesita validación explícita.',
        },
        opening_kiosk: {
            suggested:
                Boolean(opening.steps.kiosk_ready) ||
                Boolean(openingAssist.suggestions.kiosk_ready?.suggested),
            reason:
                openingAssist.suggestions.kiosk_ready?.reason ||
                'Kiosco todavía necesita validación explícita.',
        },
        opening_sala: {
            suggested:
                Boolean(opening.steps.sala_ready) ||
                Boolean(openingAssist.suggestions.sala_ready?.suggested),
            reason:
                openingAssist.suggestions.sala_ready?.reason ||
                'Sala TV todavía necesita validación explícita.',
        },
    };
    const surfacesHealthy =
        operator.status === 'ready' &&
        kiosk.status !== 'unknown' &&
        display.status === 'ready';
    const incidentOpen =
        syncHealth.state === 'alert' ||
        [operator, kiosk, display].some((item) =>
            ['alert', 'warning', 'unknown'].includes(
                String(item.status || '').toLowerCase()
            )
        );
    const incidentMap = {
        incidents_refresh: {
            suggested: syncHealth.state !== 'alert',
            reason: syncHealth.summary,
        },
        incidents_surface: {
            suggested:
                operator.status !== 'unknown' ||
                kiosk.status !== 'unknown' ||
                display.status !== 'unknown',
            reason: 'Al menos una superficie ya está reportando señal para investigar desde el equipo correcto.',
        },
        incidents_log: {
            suggested: logHasIncident,
            reason: logHasIncident
                ? 'La bitácora ya tiene al menos una incidencia registrada.'
                : 'Todavía no hay incidencia registrada en la bitácora.',
        },
    };
    const closingSurfacesSuggested =
        (Boolean(shift.steps.operator_handoff) ||
            Boolean(handoffAssist.suggestions.operator_handoff?.suggested)) &&
        (Boolean(shift.steps.kiosk_handoff) ||
            Boolean(handoffAssist.suggestions.kiosk_handoff?.suggested)) &&
        (Boolean(shift.steps.sala_handoff) ||
            Boolean(handoffAssist.suggestions.sala_handoff?.suggested));
    const closingMap = {
        closing_queue: {
            suggested:
                Boolean(shift.steps.queue_clear) ||
                Boolean(handoffAssist.suggestions.queue_clear?.suggested),
            reason:
                handoffAssist.suggestions.queue_clear?.reason ||
                'La cola todavía necesita una validación final.',
        },
        closing_surfaces: {
            suggested: closingSurfacesSuggested,
            reason: closingSurfacesSuggested
                ? 'Operador, Kiosco y Sala TV ya aparecen listos para el siguiente turno.'
                : 'Todavía falta dejar una o más superficies listas para mañana.',
        },
        closing_copy: {
            suggested:
                Boolean(shift.steps.queue_clear) ||
                (Boolean(handoffAssist.suggestions.queue_clear?.suggested) &&
                    closingSurfacesSuggested),
            reason: 'Cuando cola y superficies quedan listas, conviene copiar el resumen final del relevo.',
        },
    };
    const operationsMap = {
        operations_monitor: {
            suggested: surfacesHealthy,
            reason: surfacesHealthy
                ? 'Las superficies ya reportan señal suficiente para operar con seguimiento.'
                : 'Falta señal estable en alguna superficie antes de dar por monitoreo resuelto.',
        },
        operations_call: {
            suggested:
                syncHealth.state !== 'alert' &&
                operator.status === 'ready' &&
                !operator.stale,
            reason: 'Llamar siguiente conviene cuando Operador está listo y la cola no está en fallback.',
        },
        operations_log: {
            suggested: logHasStatus,
            reason: logHasStatus
                ? 'La bitácora ya tiene estado operativo o cambios recientes.'
                : 'No hay estado operativo reciente en la bitácora.',
        },
    };

    const suggestionsByMode = {
        opening: openingMap,
        operations: operationsMap,
        incidents: incidentMap,
        closing: closingMap,
    };
    const modeSuggestions = suggestionsByMode[playbook.mode] || {};
    const suggestedIds = playbook.steps
        .filter(
            (step) =>
                !playbook.modeState[step.id] &&
                Boolean(modeSuggestions[step.id]?.suggested)
        )
        .map((step) => step.id);

    return {
        suggestions: modeSuggestions,
        suggestedIds,
        suggestedCount: suggestedIds.length,
        incidentOpen,
    };
}

function buildQueuePlaybookReport(manifest, detectedPlatform) {
    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const assist = buildQueuePlaybookAssist(manifest, detectedPlatform);
    return [
        `${playbook.title} - ${formatDateTime(new Date().toISOString())}`,
        `Progreso: ${playbook.completedCount}/${playbook.totalSteps}`,
        `Sugeridos actuales: ${assist.suggestedCount}`,
        ...playbook.steps.map((step) => {
            const done = Boolean(playbook.modeState[step.id]);
            return `${done ? '[x]' : '[ ]'} ${step.title} - ${step.detail}`;
        }),
    ].join('\n');
}

async function copyQueuePlaybookReport(manifest, detectedPlatform) {
    try {
        await navigator.clipboard.writeText(
            buildQueuePlaybookReport(manifest, detectedPlatform)
        );
        createToast('Playbook copiado', 'success');
    } catch (_error) {
        createToast('No se pudo copiar el playbook', 'error');
    }
}

function renderQueuePlaybook(manifest, detectedPlatform) {
    const root = document.getElementById('queuePlaybook');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const playbook = buildQueuePlaybook(manifest, detectedPlatform);
    const assist = buildQueuePlaybookAssist(manifest, detectedPlatform);
    setHtml(
        '#queuePlaybook',
        `
            <section class="queue-playbook__shell" data-state="${escapeHtml(
                playbook.mode
            )}">
                <div class="queue-playbook__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Playbook activo</p>
                        <h5 id="queuePlaybookTitle" class="queue-app-card__title">${escapeHtml(
                            playbook.title
                        )}</h5>
                        <p id="queuePlaybookSummary" class="queue-playbook__summary">${escapeHtml(
                            playbook.summary
                        )}</p>
                    </div>
                    <div class="queue-playbook__meta">
                        <span
                            id="queuePlaybookChip"
                            class="queue-playbook__chip"
                            data-state="${playbook.completedCount >= playbook.totalSteps ? 'ready' : 'active'}"
                        >
                            ${escapeHtml(
                                playbook.completedCount >= playbook.totalSteps
                                    ? 'Secuencia completa'
                                    : `Paso ${Math.min(playbook.completedCount + 1, playbook.totalSteps)}/${playbook.totalSteps}`
                            )}
                        </span>
                        <span
                            id="queuePlaybookAssistChip"
                            class="queue-playbook__assist"
                            data-state="${assist.suggestedCount > 0 ? 'suggested' : playbook.completedCount >= playbook.totalSteps ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                assist.suggestedCount > 0
                                    ? `Sugeridos ${assist.suggestedCount}`
                                    : playbook.completedCount >=
                                        playbook.totalSteps
                                      ? 'Rutina completa'
                                      : 'Sin sugeridos'
                            )}
                        </span>
                        <button
                            id="queuePlaybookApplyBtn"
                            type="button"
                            class="queue-playbook__action queue-playbook__action--primary"
                            ${playbook.nextStep ? '' : 'disabled'}
                        >
                            ${
                                playbook.nextStep
                                    ? `Marcar: ${playbook.nextStep.title}`
                                    : 'Sin pasos pendientes'
                            }
                        </button>
                        <button
                            id="queuePlaybookAssistBtn"
                            type="button"
                            class="queue-playbook__action"
                            ${assist.suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                assist.suggestedCount > 0
                                    ? `Confirmar sugeridos (${assist.suggestedCount})`
                                    : 'Sin sugeridos ahora'
                            }
                        </button>
                        <button
                            id="queuePlaybookCopyBtn"
                            type="button"
                            class="queue-playbook__action"
                        >
                            Copiar secuencia
                        </button>
                        <button
                            id="queuePlaybookResetBtn"
                            type="button"
                            class="queue-playbook__action"
                        >
                            Reiniciar playbook
                        </button>
                    </div>
                </div>
                <div id="queuePlaybookSteps" class="queue-playbook__steps" role="list" aria-label="Secuencia operativa por foco">
                    ${playbook.steps
                        .map((step) => {
                            const done = Boolean(playbook.modeState[step.id]);
                            const isCurrent =
                                !done &&
                                playbook.nextStep &&
                                playbook.nextStep.id === step.id;
                            const isSuggested =
                                !done &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = done
                                ? 'ready'
                                : isCurrent
                                  ? 'current'
                                  : isSuggested
                                    ? 'suggested'
                                    : 'pending';
                            return `
                                <article class="queue-playbook__step" data-state="${stepState}" role="listitem">
                                    <div class="queue-playbook__step-head">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p>${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-playbook__step-state">${escapeHtml(
                                            done
                                                ? 'Hecho'
                                                : isCurrent
                                                  ? 'Actual'
                                                  : isSuggested
                                                    ? 'Sugerido'
                                                    : 'Pendiente'
                                        )}</span>
                                    </div>
                                    <p class="queue-playbook__step-note">${escapeHtml(
                                        assist.suggestions[step.id]?.reason ||
                                            step.detail
                                    )}</p>
                                    <div class="queue-playbook__step-actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            class="queue-playbook__step-primary"
                                            ${String(step.href || '').startsWith('#') ? '' : 'target="_blank" rel="noopener"'}
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queuePlaybookToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-playbook__step-toggle"
                                            data-queue-playbook-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${done ? 'Marcar pendiente' : 'Marcar hecho'}
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    const applyButton = document.getElementById('queuePlaybookApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!playbook.nextStep) {
                return;
            }
            setOpsPlaybookStep(playbook.mode, playbook.nextStep.id, true);
            appendOpsLogEntry({
                tone: 'info',
                source: 'status',
                title: `Playbook ${playbook.mode}: paso confirmado`,
                summary: `${playbook.nextStep.title} quedó marcado como hecho desde el playbook activo.`,
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const assistButton = document.getElementById('queuePlaybookAssistBtn');
    if (assistButton instanceof HTMLButtonElement) {
        assistButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            assist.suggestedIds.forEach((stepId) => {
                setOpsPlaybookStep(playbook.mode, stepId, true);
            });
            appendOpsLogEntry({
                tone: 'success',
                source: 'status',
                title: `Playbook ${playbook.mode}: sugeridos confirmados`,
                summary: `Se confirmaron ${assist.suggestedIds.length} paso(s) sugeridos por señales del sistema.`,
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyButton = document.getElementById('queuePlaybookCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyQueuePlaybookReport(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById('queuePlaybookResetBtn');
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpsPlaybookMode(playbook.mode);
            appendOpsLogEntry({
                tone: 'warning',
                source: 'status',
                title: `Playbook ${playbook.mode}: reiniciado`,
                summary:
                    'La secuencia del modo activo se reinició para volver a guiar el flujo desde el primer paso.',
            });
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-playbook-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queuePlaybookStep || '');
            const nextValue = !playbook.modeState[stepId];
            setOpsPlaybookStep(playbook.mode, stepId, nextValue);
            renderQueuePlaybook(manifest, detectedPlatform);
        };
    });
}

function buildContingencyCards(manifest, detectedPlatform) {
    const preset = ensureInstallPreset(detectedPlatform);
    const operatorConfig = manifest.operator || DEFAULT_APP_DOWNLOADS.operator;
    const kioskConfig = manifest.kiosk || DEFAULT_APP_DOWNLOADS.kiosk;
    const salaConfig = manifest.sala_tv || DEFAULT_APP_DOWNLOADS.sala_tv;
    const syncHealth = getQueueSyncHealth();
    const stationLabel = preset.station === 'c2' ? 'C2' : 'C1';
    const operatorModeLabel = preset.lock
        ? `${stationLabel} fijo`
        : 'modo libre';
    const operatorUrl = buildPreparedSurfaceUrl('operator', operatorConfig, {
        ...preset,
        surface: 'operator',
    });
    const kioskUrl = buildPreparedSurfaceUrl('kiosk', kioskConfig, {
        ...preset,
        surface: 'kiosk',
    });
    const salaUrl = buildPreparedSurfaceUrl('sala_tv', salaConfig, {
        ...preset,
        surface: 'sala_tv',
    });

    return {
        syncHealth,
        cards: [
            {
                id: 'operator_issue',
                state: 'neutral',
                badge: 'Numpad',
                title: 'Numpad no responde',
                summary: `Abre Operador en ${operatorModeLabel}${preset.oneTap ? ' con 1 tecla' : ''}, recalibra la tecla externa y confirma Enter, Decimal y Subtract del Genius Numpad 1000.`,
                steps: [
                    'Confirma que el receptor USB 2.4 GHz siga conectado en el PC operador.',
                    'Dentro de Operador usa "Calibrar tecla" si el Enter del numpad no dispara llamada.',
                    'Mientras corriges el teclado, puedes seguir operando por clics sin cambiar de equipo.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador',
                        primary: true,
                    },
                    {
                        type: 'copy',
                        url: operatorUrl,
                        label: 'Copiar ruta',
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('operator', preset, operatorConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'kiosk_issue',
                state: 'neutral',
                badge: 'Térmica',
                title: 'Térmica no imprime',
                summary:
                    'Abre Kiosco, genera un ticket de prueba y confirma "Impresion OK" antes de volver al autoservicio.',
                steps: [
                    'Revisa papel, energía y cable USB de la impresora térmica.',
                    'Si el equipo sigue estable, usa el kiosco web preparado mientras validas la app desktop.',
                    'No cierres el flujo de check-in hasta imprimir al menos un ticket de prueba correcto.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: kioskUrl,
                        label: 'Abrir kiosco',
                        primary: true,
                    },
                    {
                        type: 'copy',
                        url: kioskUrl,
                        label: 'Copiar ruta',
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('kiosk', preset, kioskConfig),
                        label: 'Centro de instalación',
                        external: true,
                    },
                ],
            },
            {
                id: 'sala_issue',
                state: 'neutral',
                badge: 'Audio',
                title: 'Sala TV sin campanilla',
                summary:
                    'Abre la Sala TV, ejecuta la prueba de campanilla y deja la TCL C655 con volumen fijo y Ethernet activo.',
                steps: [
                    'Confirma que la TV no esté en mute y que la app siga en foreground.',
                    'Si la APK falla, usa `sala-turnos.html` como respaldo inmediato en el navegador de la TV.',
                    'Solo reinstala la APK si ya probaste campanilla, red y energía de la pantalla.',
                ],
                actions: [
                    {
                        type: 'link',
                        href: salaUrl,
                        label: 'Abrir sala TV',
                        primary: true,
                    },
                    {
                        type: 'link',
                        href: buildGuideUrl('sala_tv', preset, salaConfig),
                        label: 'Instalar APK',
                        external: true,
                    },
                    {
                        type: 'copy',
                        url: salaUrl,
                        label: 'Copiar fallback web',
                    },
                ],
            },
            {
                id: 'sync_issue',
                state: syncHealth.state,
                badge: syncHealth.badge,
                title: syncHealth.title,
                summary: syncHealth.summary,
                steps: syncHealth.steps,
                actions: [
                    {
                        type: 'button',
                        action: 'queue-refresh-state',
                        label: 'Refrescar cola',
                        primary: syncHealth.state !== 'ready',
                    },
                    {
                        type: 'link',
                        href: operatorUrl,
                        label: 'Abrir operador web',
                    },
                    {
                        type: 'copy',
                        url: kioskUrl,
                        label: 'Copiar kiosco web',
                    },
                ],
            },
        ],
    };
}

function renderContingencyAction(cardId, action, index) {
    const label = escapeHtml(action.label || 'Abrir');
    const className = action.primary
        ? 'queue-contingency-card__action queue-contingency-card__action--primary'
        : 'queue-contingency-card__action';

    if (action.type === 'button') {
        return `
            <button
                type="button"
                class="${className}"
                data-action="${escapeHtml(action.action || '')}"
                data-queue-contingency-card="${escapeHtml(cardId)}"
                data-queue-contingency-action-index="${escapeHtml(String(index))}"
            >
                ${label}
            </button>
        `;
    }

    if (action.type === 'copy') {
        return `
            <button
                type="button"
                class="${className}"
                data-action="queue-copy-install-link"
                data-queue-install-url="${escapeHtml(action.url || '')}"
                data-queue-contingency-card="${escapeHtml(cardId)}"
                data-queue-contingency-action-index="${escapeHtml(String(index))}"
            >
                ${label}
            </button>
        `;
    }

    return `
        <a
            href="${escapeHtml(action.href || '/')}"
            class="${className}"
            ${action.external ? 'target="_blank" rel="noopener"' : ''}
        >
            ${label}
        </a>
    `;
}

function renderContingencyDeck(manifest, detectedPlatform) {
    const root = document.getElementById('queueContingencyDeck');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const { syncHealth, cards } = buildContingencyCards(
        manifest,
        detectedPlatform
    );
    const title =
        syncHealth.state === 'alert'
            ? 'Contingencia activa'
            : syncHealth.state === 'warning'
              ? 'Contingencia preventiva'
              : 'Contingencia rápida lista';
    const summary =
        syncHealth.state === 'alert'
            ? 'Resuelve primero la sincronización y luego ataca hardware puntual. Las rutas de abajo ya quedan preparadas para operar sin perder tiempo.'
            : syncHealth.state === 'warning'
              ? 'Hay señal de retraso en la cola. Usa estas rutas directas antes de que el operador quede fuera de contexto.'
              : 'Las tarjetas de abajo sirven como ruta corta cuando algo falla en medio de la jornada, sin mezclar instalación con operación.';

    setHtml(
        '#queueContingencyDeck',
        `
            <section class="queue-contingency-deck__shell">
                <div class="queue-contingency-deck__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Contingencia rápida</p>
                        <h5 id="queueContingencyTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueContingencySummary" class="queue-contingency-deck__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <span
                        id="queueContingencyStatus"
                        class="queue-contingency-deck__status"
                        data-state="${escapeHtml(syncHealth.state)}"
                    >
                        ${escapeHtml(syncHealth.badge)}
                    </span>
                </div>
                <div id="queueContingencyCards" class="queue-contingency-deck__grid" role="list" aria-label="Tarjetas de contingencia rápida">
                    ${cards
                        .map(
                            (card) => `
                                <article
                                    class="queue-contingency-card"
                                    ${card.id === 'sync_issue' ? 'id="queueContingencySyncCard"' : ''}
                                    data-state="${escapeHtml(card.state)}"
                                    role="listitem"
                                >
                                    <div class="queue-contingency-card__header">
                                        <div>
                                            <strong>${escapeHtml(card.title)}</strong>
                                            <p class="queue-contingency-card__summary">${escapeHtml(
                                                card.summary
                                            )}</p>
                                        </div>
                                        <span class="queue-contingency-card__badge">${escapeHtml(
                                            card.badge
                                        )}</span>
                                    </div>
                                    <ul class="queue-contingency-card__steps">
                                        ${card.steps
                                            .map(
                                                (step) =>
                                                    `<li>${escapeHtml(step)}</li>`
                                            )
                                            .join('')}
                                    </ul>
                                    <div class="queue-contingency-card__actions">
                                        ${card.actions
                                            .map((action, index) =>
                                                renderContingencyAction(
                                                    card.id,
                                                    action,
                                                    index
                                                )
                                            )
                                            .join('')}
                                    </div>
                                </article>
                            `
                        )
                        .join('')}
                </div>
            </section>
        `
    );
}

function renderOpeningChecklist(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpeningChecklist');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = steps.filter(
        (step) =>
            !checklist.steps[step.id] &&
            Boolean(assist.suggestions[step.id]?.suggested)
    ).length;
    const pendingCount = steps.length - confirmedCount;
    const title =
        pendingCount <= 0
            ? 'Apertura diaria lista'
            : suggestedCount > 0
              ? 'Apertura diaria asistida'
              : confirmedCount <= 0
                ? 'Apertura diaria pendiente'
                : `Apertura diaria: faltan ${pendingCount} paso(s)`;
    const summary =
        pendingCount <= 0
            ? 'Operador, kiosco y sala TV ya quedaron probados en este navegador admin para hoy.'
            : suggestedCount > 0
              ? `${suggestedCount} paso(s) ya aparecen listos por telemetría o actividad reciente. Confírmalos en bloque y deja solo las validaciones pendientes.`
              : 'Sigue cada paso desde esta vista y marca listo solo después de validar el equipo real. El avance se guarda en este navegador.';

    setHtml(
        '#queueOpeningChecklist',
        `
            <section class="queue-opening-checklist__shell">
                <div class="queue-opening-checklist__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Apertura diaria</p>
                        <h5 id="queueOpeningChecklistTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueOpeningChecklistSummary" class="queue-opening-checklist__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <div class="queue-opening-checklist__meta">
                        <span
                            id="queueOpeningChecklistAssistChip"
                            class="queue-opening-checklist__assist"
                            data-state="${suggestedCount > 0 ? 'suggested' : pendingCount <= 0 ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                suggestedCount > 0
                                    ? `Sugeridos ${suggestedCount}`
                                    : pendingCount <= 0
                                      ? 'Checklist completo'
                                      : `Confirmados ${confirmedCount}/${steps.length}`
                            )}
                        </span>
                        <button
                            id="queueOpeningChecklistApplyBtn"
                            type="button"
                            class="queue-opening-checklist__apply"
                            ${suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                suggestedCount > 0
                                    ? `Confirmar sugeridos (${suggestedCount})`
                                    : 'Sin sugeridos todavía'
                            }
                        </button>
                        <button
                            id="queueOpeningChecklistResetBtn"
                            type="button"
                            class="queue-opening-checklist__reset"
                        >
                            Reiniciar apertura de hoy
                        </button>
                        <span id="queueOpeningChecklistDate" class="queue-opening-checklist__date">
                            ${escapeHtml(formatOpeningChecklistDate(checklist.date))}
                        </span>
                    </div>
                </div>
                <div id="queueOpeningChecklistSteps" class="queue-opening-checklist__steps" role="list" aria-label="Checklist de apertura diaria">
                    ${steps
                        .map((step) => {
                            const isReady = Boolean(checklist.steps[step.id]);
                            const isSuggested =
                                !isReady &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = isReady
                                ? 'ready'
                                : isSuggested
                                  ? 'suggested'
                                  : 'pending';
                            const stateLabel = isReady
                                ? 'Confirmado'
                                : isSuggested
                                  ? 'Sugerido'
                                  : 'Pendiente';
                            const evidence = String(
                                assist.suggestions[step.id]?.reason || step.hint
                            );
                            return `
                                <article
                                    class="queue-opening-step"
                                    data-state="${stepState}"
                                    role="listitem"
                                >
                                    <div class="queue-opening-step__header">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p class="queue-opening-step__detail">${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-opening-step__state">
                                            ${escapeHtml(stateLabel)}
                                        </span>
                                    </div>
                                    <p class="queue-opening-step__hint">${escapeHtml(step.hint)}</p>
                                    <p class="queue-opening-step__evidence">${escapeHtml(evidence)}</p>
                                    <div class="queue-opening-step__actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-opening-step__primary"
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queueOpeningToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-opening-step__toggle"
                                            data-queue-opening-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${
                                                isReady
                                                    ? 'Marcar pendiente'
                                                    : isSuggested
                                                      ? 'Confirmar sugerido'
                                                      : 'Marcar listo'
                                            }
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    root.querySelectorAll('[data-queue-opening-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queueOpeningStep || '');
            const current = ensureOpeningChecklistState();
            const nextValue = !current.steps[stepId];
            setOpeningChecklistStep(stepId, nextValue);
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
        };
    });

    const applyButton = document.getElementById(
        'queueOpeningChecklistApplyBtn'
    );
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            applyOpeningChecklistSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'opening',
                title: `Apertura: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary: `El checklist de apertura quedó actualizado usando telemetría reciente. Perfil activo: ${getInstallPresetLabel(
                    detectedPlatform
                )}.`,
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById(
        'queueOpeningChecklistResetBtn'
    );
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetOpeningChecklistState();
            appendOpsLogEntry({
                tone: 'warning',
                source: 'opening',
                title: 'Apertura reiniciada',
                summary:
                    'Se limpiaron las confirmaciones de apertura del día para volver a validar operador, kiosco, sala y smoke final.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderQueueOpsPilot(manifest, detectedPlatform);
            renderOpeningChecklist(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }
}

function renderShiftHandoff(manifest, detectedPlatform) {
    const root = document.getElementById('queueShiftHandoff');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const checklist = ensureShiftHandoffState();
    const steps = buildShiftHandoffSteps(manifest, detectedPlatform);
    const assist = buildShiftHandoffAssist(detectedPlatform);
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = steps.filter(
        (step) =>
            !checklist.steps[step.id] &&
            Boolean(assist.suggestions[step.id]?.suggested)
    ).length;
    const pendingCount = steps.length - confirmedCount;
    const title =
        pendingCount <= 0
            ? 'Relevo listo'
            : assist.suggestions.queue_clear?.suggested
              ? suggestedCount > 0
                  ? 'Cierre y relevo asistido'
                  : `Cierre: faltan ${pendingCount} paso(s)`
              : 'No cierres todavía';
    const summary =
        pendingCount <= 0
            ? 'El relevo quedó documentado para hoy y la cola ya está sin pendientes visibles.'
            : assist.suggestions.queue_clear?.suggested
              ? suggestedCount > 0
                  ? `${suggestedCount} paso(s) de relevo ya aparecen listos por telemetría. Copia el resumen o confirma sugeridos para cerrar más rápido.`
                  : 'Ya no hay tickets activos. Termina las comprobaciones de equipos para dejar el siguiente turno más claro.'
              : String(
                    assist.suggestions.queue_clear?.reason ||
                        'La cola todavía tiene actividad.'
                );

    setHtml(
        '#queueShiftHandoff',
        `
            <section class="queue-shift-handoff__shell">
                <div class="queue-shift-handoff__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Cierre y relevo</p>
                        <h5 id="queueShiftHandoffTitle" class="queue-app-card__title">${escapeHtml(
                            title
                        )}</h5>
                        <p id="queueShiftHandoffSummary" class="queue-shift-handoff__summary">${escapeHtml(
                            summary
                        )}</p>
                    </div>
                    <div class="queue-shift-handoff__meta">
                        <span
                            id="queueShiftHandoffAssistChip"
                            class="queue-shift-handoff__assist"
                            data-state="${suggestedCount > 0 ? 'suggested' : pendingCount <= 0 ? 'ready' : 'idle'}"
                        >
                            ${escapeHtml(
                                suggestedCount > 0
                                    ? `Sugeridos ${suggestedCount}`
                                    : pendingCount <= 0
                                      ? 'Relevo completo'
                                      : `Confirmados ${confirmedCount}/${steps.length}`
                            )}
                        </span>
                        <button
                            id="queueShiftHandoffCopyBtn"
                            type="button"
                            class="queue-shift-handoff__copy"
                        >
                            Copiar resumen de relevo
                        </button>
                        <button
                            id="queueShiftHandoffApplyBtn"
                            type="button"
                            class="queue-shift-handoff__apply"
                            ${suggestedCount > 0 ? '' : 'disabled'}
                        >
                            ${
                                suggestedCount > 0
                                    ? `Confirmar sugeridos (${suggestedCount})`
                                    : 'Sin sugeridos todavía'
                            }
                        </button>
                        <button
                            id="queueShiftHandoffResetBtn"
                            type="button"
                            class="queue-shift-handoff__reset"
                        >
                            Reiniciar relevo de hoy
                        </button>
                    </div>
                </div>
                <div class="queue-shift-handoff__summary-box">
                    <pre id="queueShiftHandoffPreview" class="queue-shift-handoff__preview">${escapeHtml(
                        buildShiftHandoffSummary(detectedPlatform)
                    )}</pre>
                </div>
                <div id="queueShiftHandoffSteps" class="queue-shift-handoff__steps" role="list" aria-label="Checklist de cierre y relevo">
                    ${steps
                        .map((step) => {
                            const isReady = Boolean(checklist.steps[step.id]);
                            const isSuggested =
                                !isReady &&
                                Boolean(assist.suggestions[step.id]?.suggested);
                            const stepState = isReady
                                ? 'ready'
                                : isSuggested
                                  ? 'suggested'
                                  : 'pending';
                            const stateLabel = isReady
                                ? 'Confirmado'
                                : isSuggested
                                  ? 'Sugerido'
                                  : 'Pendiente';
                            const evidence = String(
                                assist.suggestions[step.id]?.reason || step.hint
                            );
                            return `
                                <article class="queue-shift-step" data-state="${stepState}" role="listitem">
                                    <div class="queue-shift-step__header">
                                        <div>
                                            <strong>${escapeHtml(step.title)}</strong>
                                            <p class="queue-shift-step__detail">${escapeHtml(step.detail)}</p>
                                        </div>
                                        <span class="queue-shift-step__state">${escapeHtml(
                                            stateLabel
                                        )}</span>
                                    </div>
                                    <p class="queue-shift-step__hint">${escapeHtml(step.hint)}</p>
                                    <p class="queue-shift-step__evidence">${escapeHtml(
                                        evidence
                                    )}</p>
                                    <div class="queue-shift-step__actions">
                                        <a
                                            href="${escapeHtml(step.href)}"
                                            target="_blank"
                                            rel="noopener"
                                            class="queue-shift-step__primary"
                                        >
                                            ${escapeHtml(step.actionLabel)}
                                        </a>
                                        <button
                                            id="queueShiftToggle_${escapeHtml(step.id)}"
                                            type="button"
                                            class="queue-shift-step__toggle"
                                            data-queue-shift-step="${escapeHtml(step.id)}"
                                            data-state="${stepState}"
                                        >
                                            ${
                                                isReady
                                                    ? 'Marcar pendiente'
                                                    : isSuggested
                                                      ? 'Confirmar sugerido'
                                                      : 'Marcar listo'
                                            }
                                        </button>
                                    </div>
                                </article>
                            `;
                        })
                        .join('')}
                </div>
            </section>
        `
    );

    const copyButton = document.getElementById('queueShiftHandoffCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyShiftHandoffSummary(detectedPlatform);
        };
    }

    const applyButton = document.getElementById('queueShiftHandoffApplyBtn');
    if (applyButton instanceof HTMLButtonElement) {
        applyButton.onclick = () => {
            if (!assist.suggestedIds.length) {
                return;
            }
            applyShiftHandoffSuggestions(assist.suggestedIds);
            appendOpsLogEntry({
                tone: 'success',
                source: 'handoff',
                title: `Relevo: ${assist.suggestedIds.length} sugerido(s) confirmados`,
                summary:
                    'El cierre del día quedó marcado con pasos validados por telemetría para operador, kiosco y sala.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const resetButton = document.getElementById('queueShiftHandoffResetBtn');
    if (resetButton instanceof HTMLButtonElement) {
        resetButton.onclick = () => {
            resetShiftHandoffState();
            appendOpsLogEntry({
                tone: 'warning',
                source: 'handoff',
                title: 'Relevo reiniciado',
                summary:
                    'Se limpiaron las marcas de cierre del día para rehacer el relevo con estado fresco.',
            });
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-queue-shift-step]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const stepId = String(button.dataset.queueShiftStep || '');
            const current = ensureShiftHandoffState();
            const nextValue = !current.steps[stepId];
            setShiftHandoffStep(stepId, nextValue);
            renderQueueFocusMode(manifest, detectedPlatform);
            renderQueueQuickConsole(manifest, detectedPlatform);
            renderQueuePlaybook(manifest, detectedPlatform);
            renderShiftHandoff(manifest, detectedPlatform);
        };
    });
}

function renderQueueOpsLog(manifest, detectedPlatform) {
    const root = document.getElementById('queueOpsLog');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const logState = ensureOpsLogState();
    const activeFilter = ensureOpsLogFilter();
    const filteredItems = filterOpsLogItems(logState.items, activeFilter);
    const lastEntry = logState.items[0] || null;
    const summary = lastEntry
        ? `${lastEntry.title}. ${lastEntry.summary} Vista actual: ${getOpsLogFilterLabel(
              activeFilter
          )}.`
        : 'Todavía no hay eventos guardados hoy. Registra el estado actual, una incidencia o deja rastro del relevo sin salir del admin.';
    const chipLabel =
        logState.items.length > 0
            ? `${logState.items.length} evento(s) hoy`
            : 'Sin eventos';
    const chipState = lastEntry
        ? lastEntry.tone === 'alert'
            ? 'alert'
            : lastEntry.tone === 'warning'
              ? 'warning'
              : 'ready'
        : 'idle';

    setHtml(
        '#queueOpsLog',
        `
            <section class="queue-ops-log__shell">
                <div class="queue-ops-log__header">
                    <div>
                        <p class="queue-app-card__eyebrow">Bitácora operativa</p>
                        <h5 id="queueOpsLogTitle" class="queue-app-card__title">Bitácora operativa del día</h5>
                        <p id="queueOpsLogSummary" class="queue-ops-log__summary">${escapeHtml(
                            summary
                        )}</p>
                        <div class="queue-ops-log__filters" role="tablist" aria-label="Filtro de bitácora">
                            <button
                                id="queueOpsLogFilterAll"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="all"
                                data-state="${activeFilter === 'all' ? 'active' : 'idle'}"
                            >
                                Todo
                            </button>
                            <button
                                id="queueOpsLogFilterIncidents"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="incidents"
                                data-state="${activeFilter === 'incidents' ? 'active' : 'idle'}"
                            >
                                Incidencias
                            </button>
                            <button
                                id="queueOpsLogFilterChanges"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="changes"
                                data-state="${activeFilter === 'changes' ? 'active' : 'idle'}"
                            >
                                Cambios
                            </button>
                            <button
                                id="queueOpsLogFilterStatus"
                                type="button"
                                class="queue-ops-log__filter"
                                data-filter="status"
                                data-state="${activeFilter === 'status' ? 'active' : 'idle'}"
                            >
                                Estados
                            </button>
                        </div>
                    </div>
                    <div class="queue-ops-log__meta">
                        <span
                            id="queueOpsLogChip"
                            class="queue-ops-log__chip"
                            data-state="${escapeHtml(chipState)}"
                        >
                            ${escapeHtml(chipLabel)}
                        </span>
                        <button
                            id="queueOpsLogStatusBtn"
                            type="button"
                            class="queue-ops-log__action queue-ops-log__action--primary"
                        >
                            Registrar estado actual
                        </button>
                        <button
                            id="queueOpsLogIncidentBtn"
                            type="button"
                            class="queue-ops-log__action"
                        >
                            Registrar incidencia actual
                        </button>
                        <button
                            id="queueOpsLogCopyBtn"
                            type="button"
                            class="queue-ops-log__action"
                        >
                            Copiar bitácora
                        </button>
                        <button
                            id="queueOpsLogClearBtn"
                            type="button"
                            class="queue-ops-log__action"
                        >
                            Limpiar bitácora de hoy
                        </button>
                    </div>
                </div>
                <div id="queueOpsLogItems" class="queue-ops-log__list" role="list" aria-label="Bitácora operativa">
                    ${
                        filteredItems.length > 0
                            ? filteredItems
                                  .map(
                                      (item) => `
                                        <article class="queue-ops-log__item" data-state="${escapeHtml(
                                            item.tone
                                        )}" role="listitem">
                                            <div class="queue-ops-log__item-head">
                                                <div class="queue-ops-log__item-copy">
                                                    <strong>${escapeHtml(item.title)}</strong>
                                                    <span class="queue-ops-log__source">${escapeHtml(
                                                        getOpsLogSourceLabel(
                                                            item.source
                                                        )
                                                    )}</span>
                                                </div>
                                                <span>${escapeHtml(
                                                    formatDateTime(
                                                        item.createdAt
                                                    )
                                                )}</span>
                                            </div>
                                            <p>${escapeHtml(item.summary)}</p>
                                        </article>
                                    `
                                  )
                                  .join('')
                            : `
                                <article class="queue-ops-log__empty" role="listitem">
                                    <strong>Sin eventos para este filtro</strong>
                                    <p>No hay registros en ${escapeHtml(
                                        getOpsLogFilterLabel(
                                            activeFilter
                                        ).toLowerCase()
                                    )} hoy. Cambia el filtro o registra un estado/incidencia nueva.</p>
                                </article>
                            `
                    }
                </div>
            </section>
        `
    );

    const statusButton = document.getElementById('queueOpsLogStatusBtn');
    if (statusButton instanceof HTMLButtonElement) {
        statusButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogStatusEntry(manifest, detectedPlatform)
            );
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const incidentButton = document.getElementById('queueOpsLogIncidentBtn');
    if (incidentButton instanceof HTMLButtonElement) {
        incidentButton.onclick = () => {
            appendOpsLogEntry(
                buildOpsLogIncidentEntry(manifest, detectedPlatform)
            );
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    const copyButton = document.getElementById('queueOpsLogCopyBtn');
    if (copyButton instanceof HTMLButtonElement) {
        copyButton.onclick = () => {
            void copyOpsLogReport(detectedPlatform);
        };
    }

    const clearButton = document.getElementById('queueOpsLogClearBtn');
    if (clearButton instanceof HTMLButtonElement) {
        clearButton.onclick = () => {
            clearOpsLogState();
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    }

    root.querySelectorAll('[data-filter]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            persistOpsLogFilter(button.dataset.filter || 'all');
            renderQueueOpsLog(manifest, detectedPlatform);
        };
    });
}

function rerenderQueueOpsHub(manifest, detectedPlatform) {
    renderQueueFocusMode(manifest, detectedPlatform);
    renderQueueNumpadGuide(manifest, detectedPlatform);
    renderConsultorioBoard(manifest, detectedPlatform);
    renderQueueAttentionDeck(manifest, detectedPlatform);
    renderQueueResolutionDeck(manifest, detectedPlatform);
    renderQueueTicketLookup(manifest, detectedPlatform);
    renderQueueTicketRoute(manifest, detectedPlatform);
    renderQueueTicketSimulation(manifest, detectedPlatform);
    renderQueueNextTurnsPanel(manifest, detectedPlatform);
    renderQueueMasterSequencePanel(manifest, detectedPlatform);
    renderQueueCoverageDeck(manifest, detectedPlatform);
    renderQueueReserveDeck(manifest, detectedPlatform);
    renderQueueGeneralGuidance(manifest, detectedPlatform);
    renderQueueProjectedDeck(manifest, detectedPlatform);
    renderQueueIncomingDeck(manifest, detectedPlatform);
    renderQueueScenarioDeck(manifest, detectedPlatform);
    renderQueueReceptionScript(manifest, detectedPlatform);
    renderQueueReceptionCollision(manifest, detectedPlatform);
    renderQueueReceptionLights(manifest, detectedPlatform);
    renderQueueBlockersPanel(manifest, detectedPlatform);
    renderQueueSlaDeck(manifest, detectedPlatform);
    renderQueueWaitRadar(manifest, detectedPlatform);
    renderQueueLoadBalance(manifest, detectedPlatform);
    renderQueuePriorityLane(manifest, detectedPlatform);
    renderQueueQuickTrays();
    renderActiveTrayPanel(manifest, detectedPlatform);
    renderQueueTrayBurst(manifest, detectedPlatform);
    renderQueueDispatchDeck(manifest, detectedPlatform);
    renderQueueQuickConsole(manifest, detectedPlatform);
    renderQueuePlaybook(manifest, detectedPlatform);
    renderQueueOpsPilot(manifest, detectedPlatform);
    renderSurfaceTelemetry(manifest, detectedPlatform);
    renderQueueOpsAlerts(manifest, detectedPlatform);
    renderContingencyDeck(manifest, detectedPlatform);
    renderOpeningChecklist(manifest, detectedPlatform);
    renderShiftHandoff(manifest, detectedPlatform);
    renderQueueOpsLog(manifest, detectedPlatform);
    renderInstallConfigurator(manifest, detectedPlatform);
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}

function renderInstallConfigurator(manifest, detectedPlatform) {
    const root = document.getElementById('queueInstallConfigurator');
    if (!(root instanceof HTMLElement)) {
        return;
    }

    const preset = ensureInstallPreset(detectedPlatform);
    const surfaceKey =
        preset.surface === 'kiosk' || preset.surface === 'sala_tv'
            ? preset.surface
            : 'operator';
    const appConfig = manifest[surfaceKey];
    if (!appConfig) {
        root.innerHTML = '';
        return;
    }

    const targetKey =
        surfaceKey === 'sala_tv'
            ? 'android_tv'
            : preset.platform === 'mac'
              ? 'mac'
              : 'win';
    const downloadTarget =
        (appConfig.targets && appConfig.targets[targetKey]) ||
        getDesktopTarget(appConfig, detectedPlatform) ||
        null;
    const preparedWebUrl = buildPreparedSurfaceUrl(
        surfaceKey,
        appConfig,
        preset
    );
    const qrUrl =
        surfaceKey === 'sala_tv'
            ? buildQrUrl(
                  (downloadTarget && downloadTarget.url) || preparedWebUrl
              )
            : buildQrUrl(preparedWebUrl);
    const guideUrl = buildGuideUrl(surfaceKey, preset, appConfig);
    const setupSteps = buildPresetSteps(preset)
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join('');
    const presetChoices = buildInstallPresetChoices(detectedPlatform)
        .map(
            (choice) => `
                <button
                    id="queueInstallPreset_${escapeHtml(choice.id)}"
                    type="button"
                    class="queue-install-preset-btn"
                    data-queue-install-preset="${escapeHtml(choice.id)}"
                    data-state="${choice.state ? 'active' : 'idle'}"
                >
                    ${escapeHtml(choice.label)}
                </button>
            `
        )
        .join('');

    setHtml(
        '#queueInstallConfigurator',
        `
            <div class="queue-install-configurator__grid">
                <section class="queue-install-configurator__panel">
                    <div>
                        <p class="queue-app-card__eyebrow">Preparar equipo</p>
                        <h5 class="queue-app-card__title">Asistente de instalación</h5>
                        <p class="queue-app-card__description">
                            Genera el perfil recomendado para cada equipo y copia la ruta exacta antes de instalar.
                        </p>
                    </div>
                    <div class="queue-install-configurator__presets" role="group" aria-label="Perfiles rápidos de instalación">
                        ${presetChoices}
                    </div>
                    <div class="queue-install-configurator__fields">
                        <label class="queue-install-field" for="queueInstallSurfaceSelect">
                            <span>Equipo</span>
                            <select id="queueInstallSurfaceSelect">
                                <option value="operator"${surfaceKey === 'operator' ? ' selected' : ''}>Operador</option>
                                <option value="kiosk"${surfaceKey === 'kiosk' ? ' selected' : ''}>Kiosco</option>
                                <option value="sala_tv"${surfaceKey === 'sala_tv' ? ' selected' : ''}>Sala TV</option>
                            </select>
                        </label>
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-field" for="queueInstallProfileSelect">
                                        <span>Perfil operador</span>
                                        <select id="queueInstallProfileSelect">
                                            <option value="c1_locked"${
                                                preset.lock &&
                                                preset.station === 'c1'
                                                    ? ' selected'
                                                    : ''
                                            }>C1 fijo</option>
                                            <option value="c2_locked"${
                                                preset.lock &&
                                                preset.station === 'c2'
                                                    ? ' selected'
                                                    : ''
                                            }>C2 fijo</option>
                                            <option value="free"${
                                                !preset.lock ? ' selected' : ''
                                            }>Modo libre</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey !== 'sala_tv'
                                ? `
                                    <label class="queue-install-field" for="queueInstallPlatformSelect">
                                        <span>Plataforma</span>
                                        <select id="queueInstallPlatformSelect">
                                            <option value="win"${
                                                preset.platform === 'win'
                                                    ? ' selected'
                                                    : ''
                                            }>Windows</option>
                                            <option value="mac"${
                                                preset.platform === 'mac'
                                                    ? ' selected'
                                                    : ''
                                            }>macOS</option>
                                        </select>
                                    </label>
                                `
                                : ''
                        }
                        ${
                            surfaceKey === 'operator'
                                ? `
                                    <label class="queue-install-toggle">
                                        <input id="queueInstallOneTapInput" type="checkbox"${
                                            preset.oneTap ? ' checked' : ''
                                        } />
                                        <span>Activar 1 tecla para este operador</span>
                                    </label>
                                `
                                : ''
                        }
                    </div>
                </section>
                <section class="queue-install-configurator__panel queue-install-configurator__result">
                    <div>
                        <p class="queue-app-card__eyebrow">Resultado listo</p>
                        <h5 class="queue-app-card__title">${escapeHtml(
                            buildPresetSummaryTitle(preset)
                        )}</h5>
                        <p class="queue-app-card__description">
                            ${
                                surfaceKey === 'sala_tv'
                                    ? 'Usa el APK para la TV y mantén el fallback web como respaldo.'
                                    : 'Descarga la app correcta y usa la ruta preparada como validación o respaldo.'
                            }
                        </p>
                    </div>
                    <div class="queue-install-result__chips">
                        <span class="queue-app-card__tag">
                            ${escapeHtml(
                                downloadTarget && downloadTarget.label
                                    ? downloadTarget.label
                                    : 'Perfil listo'
                            )}
                        </span>
                        ${
                            surfaceKey === 'operator'
                                ? `<span class="queue-app-card__tag">${
                                      preset.lock
                                          ? preset.station === 'c2'
                                              ? 'C2 bloqueado'
                                              : 'C1 bloqueado'
                                          : 'Modo libre'
                                  }</span>`
                                : ''
                        }
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Descarga recomendada</span>
                        <strong>${escapeHtml(
                            (downloadTarget && downloadTarget.url) ||
                                'Sin artefacto'
                        )}</strong>
                    </div>
                    <div class="queue-install-result__meta">
                        <span>Ruta web preparada</span>
                        <strong>${escapeHtml(preparedWebUrl)}</strong>
                    </div>
                    <div class="queue-install-configurator__actions">
                        ${
                            downloadTarget && downloadTarget.url
                                ? `<a href="${escapeHtml(
                                      downloadTarget.url
                                  )}" class="queue-app-card__cta-primary" download>Descargar artefacto</a>`
                                : ''
                        }
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(
                                absoluteUrl(
                                    (downloadTarget && downloadTarget.url) || ''
                                )
                            )}"
                        >
                            Copiar descarga
                        </button>
                        <a href="${escapeHtml(preparedWebUrl)}" target="_blank" rel="noopener">
                            Abrir ruta preparada
                        </a>
                        <button
                            type="button"
                            data-action="queue-copy-install-link"
                            data-queue-install-url="${escapeHtml(preparedWebUrl)}"
                        >
                            Copiar ruta preparada
                        </button>
                        <a href="${escapeHtml(qrUrl)}" target="_blank" rel="noopener">
                            Mostrar QR
                        </a>
                        <a href="${escapeHtml(guideUrl)}" target="_blank" rel="noopener">
                            Abrir centro público
                        </a>
                    </div>
                    <ul class="queue-app-card__notes">${setupSteps}</ul>
                </section>
            </div>
        `
    );

    root.querySelectorAll('[data-queue-install-preset]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }
        button.onclick = () => {
            const choice = buildInstallPresetChoices(detectedPlatform).find(
                (item) => item.id === button.dataset.queueInstallPreset
            );
            if (!choice) {
                return;
            }
            persistInstallPreset(choice.nextPreset, detectedPlatform);
            appendOpsLogEntry({
                tone: 'info',
                source: 'config',
                title: `Preset rápido: ${choice.label}`,
                summary: `${getInstallPresetLabel(
                    detectedPlatform
                )}. El asistente ya quedó listo con este perfil.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    });

    const surfaceSelect = document.getElementById('queueInstallSurfaceSelect');
    if (surfaceSelect instanceof HTMLSelectElement) {
        surfaceSelect.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    surface: surfaceSelect.value,
                },
                detectedPlatform
            );
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const profileSelect = document.getElementById('queueInstallProfileSelect');
    if (profileSelect instanceof HTMLSelectElement) {
        profileSelect.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    station: profileSelect.value === 'c2_locked' ? 'c2' : 'c1',
                    lock: profileSelect.value !== 'free',
                },
                detectedPlatform
            );
            appendOpsLogEntry({
                tone: 'info',
                source: 'config',
                title: 'Perfil operativo ajustado',
                summary: `${getInstallPresetLabel(
                    detectedPlatform
                )}. La ruta preparada ya quedó alineada para descarga y fallback.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const platformSelect = document.getElementById(
        'queueInstallPlatformSelect'
    );
    if (platformSelect instanceof HTMLSelectElement) {
        platformSelect.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    platform: platformSelect.value === 'mac' ? 'mac' : 'win',
                },
                detectedPlatform
            );
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }

    const oneTapInput = document.getElementById('queueInstallOneTapInput');
    if (oneTapInput instanceof HTMLInputElement) {
        oneTapInput.onchange = () => {
            persistInstallPreset(
                {
                    ...preset,
                    oneTap: oneTapInput.checked,
                },
                detectedPlatform
            );
            appendOpsLogEntry({
                tone: oneTapInput.checked ? 'info' : 'warning',
                source: 'config',
                title: oneTapInput.checked
                    ? 'Modo 1 tecla activado'
                    : 'Modo 1 tecla desactivado',
                summary: `${getInstallPresetLabel(
                    detectedPlatform
                )}. Ajuste guardado en el preparador de rutas operativas.`,
            });
            rerenderQueueOpsHub(manifest, detectedPlatform);
        };
    }
}

export function renderQueueInstallHub(options = {}) {
    const {
        allowDuringInteraction = false,
        manifestOverride = null,
        platformOverride = '',
    } = options || {};
    const cardsRoot = document.getElementById('queueAppDownloadsCards');
    if (!(cardsRoot instanceof HTMLElement)) {
        return;
    }
    const hubRoot = getQueueAppsHubRoot();
    if (hubRoot) {
        bindQueueOpsInteraction(hubRoot);
    }

    const platform =
        platformOverride === 'mac' ||
        platformOverride === 'win' ||
        platformOverride === 'other'
            ? platformOverride
            : detectPlatform();
    const platformChip = document.getElementById('queueAppsPlatformChip');
    const platformLabel =
        platform === 'mac'
            ? 'macOS detectado'
            : platform === 'win'
              ? 'Windows detectado'
              : 'Selecciona la plataforma del equipo';
    setText('#queueAppsPlatformChip', platformLabel);
    if (platformChip instanceof HTMLElement) {
        platformChip.setAttribute('data-platform', platform);
    }

    const manifest =
        manifestOverride && typeof manifestOverride === 'object'
            ? manifestOverride
            : mergeManifest();
    if (
        !allowDuringInteraction &&
        hubRoot &&
        hubRoot.dataset.queueHubReady === 'true' &&
        hasActiveQueueOpsInteraction()
    ) {
        scheduleDeferredQueueOpsHubRender(manifest, platform);
        return;
    }

    clearDeferredQueueOpsInteraction();
    setHtml(
        '#queueAppDownloadsCards',
        [
            renderDesktopCard('operator', manifest.operator, platform),
            renderDesktopCard('kiosk', manifest.kiosk, platform),
            renderTvCard(manifest.sala_tv),
        ].join('')
    );
    renderQueueFocusMode(manifest, platform);
    renderQueueNumpadGuide(manifest, platform);
    renderConsultorioBoard(manifest, platform);
    renderQueueAttentionDeck(manifest, platform);
    renderQueueResolutionDeck(manifest, platform);
    renderQueueTicketLookup(manifest, platform);
    renderQueueTicketRoute(manifest, platform);
    renderQueueTicketSimulation(manifest, platform);
    renderQueueNextTurnsPanel(manifest, platform);
    renderQueueMasterSequencePanel(manifest, platform);
    renderQueueCoverageDeck(manifest, platform);
    renderQueueReserveDeck(manifest, platform);
    renderQueueGeneralGuidance(manifest, platform);
    renderQueueProjectedDeck(manifest, platform);
    renderQueueIncomingDeck(manifest, platform);
    renderQueueScenarioDeck(manifest, platform);
    renderQueueReceptionScript(manifest, platform);
    renderQueueReceptionCollision(manifest, platform);
    renderQueueReceptionLights(manifest, platform);
    renderQueueBlockersPanel(manifest, platform);
    renderQueueSlaDeck(manifest, platform);
    renderQueueWaitRadar(manifest, platform);
    renderQueueLoadBalance(manifest, platform);
    renderQueuePriorityLane(manifest, platform);
    renderQueueQuickTrays();
    renderActiveTrayPanel(manifest, platform);
    renderQueueTrayBurst(manifest, platform);
    renderQueueDispatchDeck(manifest, platform);
    renderQueueQuickConsole(manifest, platform);
    renderQueuePlaybook(manifest, platform);
    renderQueueOpsPilot(manifest, platform);
    renderSurfaceTelemetry(manifest, platform);
    renderQueueOpsAlerts(manifest, platform);
    renderContingencyDeck(manifest, platform);
    renderOpeningChecklist(manifest, platform);
    renderShiftHandoff(manifest, platform);
    renderQueueOpsLog(manifest, platform);
    renderInstallConfigurator(manifest, platform);
    if (hubRoot) {
        hubRoot.dataset.queueHubReady = 'true';
    }
    syncQueueOpsInteractionIndicator();
    scheduleQueueOpsInteractionSettle();
}
