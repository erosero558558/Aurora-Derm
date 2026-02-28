import { checkAuth, login, login2FA, logout } from './modules/auth.js';
import { refreshData, getLocalData } from './modules/data.js';
import { showToast } from './modules/ui.js';
import {
    setCsrfToken,
    currentAppointments,
    currentCallbacks,
    currentReviews,
    currentAvailability,
    currentQueueTickets,
} from './modules/state.js';
import { apiRequest } from './modules/api.js';
import { loadDashboardData } from './modules/dashboard.js';
import {
    loadCallbacks,
    filterCallbacks,
    applyCallbackQuickFilter,
    searchCallbacks,
    resetCallbackFilters,
    focusCallbackSearch,
    isCallbacksSectionActive,
    markContacted,
    focusNextPendingCallback,
} from './modules/callbacks.js';
import { loadReviews } from './modules/reviews.js';
import { initPushNotifications } from './modules/push.js';
import { initAdminThemeMode, setAdminThemeMode } from './modules/theme.js';
import {
    loadAppointments,
    filterAppointments,
    searchAppointments,
    applyAppointmentQuickFilter,
    focusAppointmentSearch,
    isAppointmentsSectionActive,
    resetAppointmentFilters,
    initAppointmentsToolbarPreferences,
    setAppointmentSort,
    setAppointmentDensity,
    exportAppointmentsCSV,
    approveTransfer,
    rejectTransfer,
    cancelAppointment,
    markNoShow,
} from './modules/appointments.js';
import {
    initAvailabilityCalendar,
    changeMonth,
    jumpAvailabilityToToday,
    jumpAvailabilityToNextWithSlots,
    focusAvailabilityTimeInput,
    isAvailabilitySectionActive,
    hasAvailabilityDraftChanges,
    addTimeSlot,
    prefillTimeSlot,
    removeTimeSlot,
    copyAvailabilityDay,
    pasteAvailabilityDay,
    duplicateAvailabilityDayToNext,
    duplicateAvailabilityDayToNextWeek,
    clearAvailabilityDay,
    clearAvailabilityWeek,
    saveAvailabilityDraft,
    discardAvailabilityDraft,
} from './modules/availability.js';
import {
    loadQueueSection,
    refreshQueueRealtime,
    startQueueRealtimeSync,
    stopQueueRealtimeSync,
    callNextForConsultorio,
    applyQueueTicketAction,
    runQueueBulkAction,
    runQueueBulkReprint,
    setQueueFilter,
    focusQueueSearch,
    isQueueSectionActive,
    reprintQueueTicket,
} from './modules/queue.js';

const ADMIN_NAV_COMPACT_BREAKPOINT = 1024;
const ADMIN_SECTION_SHORTCUTS = new Map([
    ['digit1', 'dashboard'],
    ['digit2', 'appointments'],
    ['digit3', 'callbacks'],
    ['digit4', 'reviews'],
    ['digit5', 'availability'],
    ['digit6', 'queue'],
    ['1', 'dashboard'],
    ['2', 'appointments'],
    ['3', 'callbacks'],
    ['4', 'reviews'],
    ['5', 'availability'],
    ['6', 'queue'],
]);
const SIDEBAR_FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');
const ADMIN_REFRESH_STALE_AFTER_MS = 5 * 60 * 1000;
const ADMIN_REFRESH_STATUS_TICK_MS = 30 * 1000;
const ADMIN_LAST_SECTION_STORAGE_KEY = 'adminLastSection';
const ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY = 'adminSidebarCollapsed';
const QUEUE_STATION_MODE_STORAGE_KEY = 'queueStationMode';
const QUEUE_STATION_CONSULTORIO_STORAGE_KEY = 'queueStationConsultorio';
const QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY = 'queueOneTapAdvance';
const QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY = 'queueCallKeyBindingV1';
const QUEUE_ONBOARDING_SEEN_STORAGE_KEY = 'queueOnboardingSeenV1';
const QUEUE_ONBOARDING_PROGRESS_STORAGE_KEY = 'queueOnboardingProgressV2';
const QUEUE_STATION_MODE_LOCKED = 'locked';
const QUEUE_STATION_MODE_FREE = 'free';
const QUEUE_ONE_TAP_COOLDOWN_MS = 1200;
const NUMPAD_KEY_LOCATION = 3;
const QUEUE_NUMPAD_ENTER_CODES = new Set(['numpadenter', 'kpenter']);
const QUEUE_NUMPAD_ENTER_KEYS = new Set(['enter', 'return']);
const QUEUE_NUMPAD_ADD_CODES = new Set(['numpadadd', 'kpadd']);
const QUEUE_NUMPAD_ADD_KEYS = new Set(['+', 'add', 'plus']);
const QUEUE_NUMPAD_SUBTRACT_CODES = new Set(['numpadsubtract', 'kpsubtract']);
const QUEUE_NUMPAD_SUBTRACT_KEYS = new Set(['-', 'subtract', 'minus']);
const QUEUE_NUMPAD_DECIMAL_CODES = new Set(['numpaddecimal', 'kpdecimal']);
const QUEUE_NUMPAD_DECIMAL_KEYS = new Set([
    '.',
    ',',
    'decimal',
    'separator',
    'delete',
    'del',
]);
const QUEUE_NUMPAD_HELP_TOGGLE_STORAGE_KEY = 'queueNumpadHelpOpen';
const QUEUE_SENSITIVE_ACTIONS = new Set([
    'completar',
    'no_show',
    'cancelar',
    'reasignar',
]);
const QUEUE_PRACTICE_COACH_STYLE_ID = 'queuePracticeCoachInlineStyles';
const QUEUE_PRACTICE_STEPS = Object.freeze([
    Object.freeze({
        id: 'call_next',
        label: 'Llamar siguiente (Numpad Enter)',
    }),
    Object.freeze({
        id: 're_llamar',
        label: 'Re-llamar ticket activo (Numpad +)',
    }),
    Object.freeze({
        id: 'completar',
        label: 'Completar ticket activo (Numpad . / ,)',
    }),
    Object.freeze({
        id: 'no_show',
        label: 'Marcar no_show (Numpad -)',
    }),
]);
const QUEUE_ONBOARDING_STEPS = Object.freeze([
    Object.freeze({
        id: 'station_locked',
        label: 'Bloquear estación en C1 o C2',
    }),
    Object.freeze({
        id: 'shortcuts_opened',
        label: 'Abrir panel de atajos numpad',
    }),
    Object.freeze({
        id: 'practice_completed',
        label: 'Completar práctica guiada (4 acciones)',
    }),
]);
const ADMIN_CONTEXT_ACTIONS = {
    dashboard: {
        title: 'Acciones rápidas: dashboard',
        actions: [
            {
                action: 'refresh-admin-data',
                icon: 'fa-rotate-right',
                label: 'Actualizar datos',
            },
            {
                action: 'context-open-appointments-today',
                icon: 'fa-calendar-day',
                label: 'Citas de hoy',
            },
            {
                action: 'context-open-callbacks-pending',
                icon: 'fa-phone',
                label: 'Callbacks pendientes',
            },
        ],
    },
    appointments: {
        title: 'Acciones rápidas: citas',
        actions: [
            {
                action: 'appointment-quick-filter',
                filterValue: 'today',
                icon: 'fa-calendar-day',
                label: 'Filtrar hoy',
            },
            {
                action: 'appointment-quick-filter',
                filterValue: 'pending_transfer',
                icon: 'fa-money-check-dollar',
                label: 'Por validar',
            },
            {
                action: 'clear-appointment-filters',
                icon: 'fa-filter-circle-xmark',
                label: 'Limpiar filtros',
            },
            {
                action: 'export-csv',
                icon: 'fa-file-csv',
                label: 'Exportar CSV',
            },
        ],
    },
    callbacks: {
        title: 'Acciones rápidas: callbacks',
        actions: [
            {
                action: 'callback-quick-filter',
                filterValue: 'pending',
                icon: 'fa-phone',
                label: 'Pendientes',
            },
            {
                action: 'callback-quick-filter',
                filterValue: 'today',
                icon: 'fa-calendar-day',
                label: 'Hoy',
            },
            {
                action: 'clear-callback-filters',
                icon: 'fa-filter-circle-xmark',
                label: 'Limpiar filtros',
            },
            {
                action: 'context-open-appointments-transfer',
                icon: 'fa-calendar-check',
                label: 'Ver citas por validar',
            },
            {
                action: 'context-open-callbacks-next',
                icon: 'fa-phone-volume',
                label: 'Siguiente llamada',
            },
        ],
    },
    reviews: {
        title: 'Acciones rápidas: reseñas',
        actions: [
            {
                action: 'refresh-admin-data',
                icon: 'fa-rotate-right',
                label: 'Actualizar datos',
            },
            {
                action: 'context-open-dashboard',
                icon: 'fa-chart-line',
                label: 'Volver a dashboard',
            },
            {
                action: 'context-open-callbacks-pending',
                icon: 'fa-headset',
                label: 'Revisar callbacks',
            },
        ],
    },
    availability: {
        title: 'Acciones rápidas: disponibilidad',
        actions: [
            {
                action: 'context-availability-today',
                icon: 'fa-calendar-day',
                label: 'Ir a hoy',
            },
            {
                action: 'context-availability-next',
                icon: 'fa-forward',
                label: 'Siguiente con horarios',
            },
            {
                action: 'context-focus-slot-input',
                icon: 'fa-clock',
                label: 'Agregar horario',
            },
            {
                action: 'context-copy-availability-day',
                icon: 'fa-copy',
                label: 'Copiar día',
            },
        ],
    },
    queue: {
        title: 'Acciones rápidas: turnero sala',
        actions: [
            {
                action: 'queue-call-next',
                queueConsultorio: '1',
                icon: 'fa-bullhorn',
                label: 'Llamar C1',
            },
            {
                action: 'queue-call-next',
                queueConsultorio: '2',
                icon: 'fa-bullhorn',
                label: 'Llamar C2',
            },
            {
                action: 'queue-refresh-state',
                icon: 'fa-rotate-right',
                label: 'Refrescar cola',
            },
            {
                action: 'context-open-dashboard',
                icon: 'fa-chart-line',
                label: 'Volver dashboard',
            },
        ],
    },
};

let adminLastRefreshAt = 0;
let adminRefreshStatusTimerId = 0;
const queueStationState = {
    mode: QUEUE_STATION_MODE_FREE,
    consultorio: 1,
    oneTapAdvance: false,
};
const queueStarUiState = {
    helpOpen: false,
    onboardingVisible: false,
    onboardingProgress: null,
    practiceMode: false,
    practiceTickId: 0,
    practiceState: null,
    oneTapInFlight: false,
    lastOneTapAt: 0,
    customCallKey: null,
    captureCallKeyMode: false,
};

function emitQueueOpsStationEvent(eventName, detail = {}) {
    try {
        window.dispatchEvent(
            new CustomEvent('piel:queue-ops', {
                detail: {
                    surface: 'admin',
                    event: String(eventName || 'unknown'),
                    at: new Date().toISOString(),
                    ...detail,
                },
            })
        );
    } catch (_error) {
        // no-op: operational telemetry is best effort
    }
}

function readLocalFlag(storageKey, fallback = false) {
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw === null) return Boolean(fallback);
        return raw === '1' || raw === 'true';
    } catch (_error) {
        return Boolean(fallback);
    }
}

function writeLocalFlag(storageKey, value) {
    try {
        localStorage.setItem(storageKey, value ? '1' : '0');
    } catch (_error) {
        // no-op
    }
}

function createQueueOnboardingProgressState() {
    const progress = {};
    QUEUE_ONBOARDING_STEPS.forEach((step) => {
        progress[step.id] = false;
    });
    return progress;
}

function normalizeQueueOnboardingProgressState(rawProgress) {
    const fallback = createQueueOnboardingProgressState();
    if (!rawProgress || typeof rawProgress !== 'object') {
        return fallback;
    }
    QUEUE_ONBOARDING_STEPS.forEach((step) => {
        fallback[step.id] = Boolean(rawProgress[step.id]);
    });
    return fallback;
}

function readQueueOnboardingProgressFromStorage() {
    try {
        const raw = localStorage.getItem(QUEUE_ONBOARDING_PROGRESS_STORAGE_KEY);
        if (!raw) return createQueueOnboardingProgressState();
        return normalizeQueueOnboardingProgressState(JSON.parse(raw));
    } catch (_error) {
        return createQueueOnboardingProgressState();
    }
}

function persistQueueOnboardingProgress(progressState) {
    try {
        localStorage.setItem(
            QUEUE_ONBOARDING_PROGRESS_STORAGE_KEY,
            JSON.stringify(normalizeQueueOnboardingProgressState(progressState))
        );
    } catch (_error) {
        // no-op
    }
}

function getQueueOnboardingProgressState() {
    if (!queueStarUiState.onboardingProgress) {
        queueStarUiState.onboardingProgress =
            createQueueOnboardingProgressState();
    }
    return queueStarUiState.onboardingProgress;
}

function getQueueOnboardingProgressCount() {
    const progressState = getQueueOnboardingProgressState();
    return QUEUE_ONBOARDING_STEPS.reduce(
        (acc, step) => (progressState[step.id] ? acc + 1 : acc),
        0
    );
}

function syncQueueOnboardingChecklistUi() {
    const checklist = document.getElementById('queueOnboardingChecklist');
    const progressPill = document.getElementById('queueOnboardingProgressPill');
    const meta = document.getElementById('queueOnboardingMeta');
    const progressState = getQueueOnboardingProgressState();
    const totalSteps = QUEUE_ONBOARDING_STEPS.length;
    const completedCount = getQueueOnboardingProgressCount();

    if (checklist instanceof HTMLElement) {
        checklist.innerHTML = QUEUE_ONBOARDING_STEPS.map((step) => {
            const done = Boolean(progressState[step.id]);
            return `<li class="queue-practice-step${done ? ' is-done' : ''}">${step.label}</li>`;
        }).join('');
    }

    if (progressPill instanceof HTMLElement) {
        progressPill.textContent = `${completedCount}/${totalSteps}`;
    }

    if (meta instanceof HTMLElement) {
        if (completedCount >= totalSteps) {
            meta.textContent =
                'Checklist completado. Puedes cerrar la guía o iniciar práctica cuando quieras.';
        } else {
            meta.textContent = `Paso ${Math.min(
                totalSteps,
                completedCount + 1
            )} de ${totalSteps}. Completa los pasos para dejar esta estación lista.`;
        }
    }
}

function markQueueOnboardingStepCompleted(
    stepId,
    { source = 'manual', announce = false } = {}
) {
    const normalizedStepId = String(stepId || '')
        .trim()
        .toLowerCase();
    if (!normalizedStepId) return false;
    const stepExists = QUEUE_ONBOARDING_STEPS.some(
        (step) => step.id === normalizedStepId
    );
    if (!stepExists) return false;

    const progressState = getQueueOnboardingProgressState();
    if (progressState[normalizedStepId]) return false;

    progressState[normalizedStepId] = true;
    persistQueueOnboardingProgress(progressState);
    syncQueueOnboardingChecklistUi();

    const completedCount = getQueueOnboardingProgressCount();
    const totalSteps = QUEUE_ONBOARDING_STEPS.length;
    emitQueueOpsStationEvent('onboarding_step_completed', {
        source,
        stepId: normalizedStepId,
        completedCount,
        totalSteps,
    });

    if (announce) {
        const toastMessage =
            completedCount >= totalSteps
                ? 'Checklist de guía completado.'
                : `Guía: paso ${completedCount}/${totalSteps} completado.`;
        showToast(
            toastMessage,
            completedCount >= totalSteps ? 'success' : 'info'
        );
    }

    return true;
}

function getQueueHelpPanel() {
    return document.getElementById('queueShortcutPanel');
}

function getQueueOneTapControlButton() {
    return document.querySelector('[data-action="queue-toggle-one-tap"]');
}

function ensureQueueOneTapControlButton() {
    const actionsWrap = document.querySelector(
        '#queue .queue-station-control-actions'
    );
    if (!(actionsWrap instanceof HTMLElement)) return null;

    let button = getQueueOneTapControlButton();
    if (button instanceof HTMLButtonElement) return button;

    button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-secondary btn-sm';
    button.dataset.action = 'queue-toggle-one-tap';
    button.setAttribute('aria-pressed', 'false');
    button.textContent = 'Modo 1 tecla';

    const shortcutsButton = actionsWrap.querySelector(
        '[data-action="queue-toggle-shortcuts"]'
    );
    if (shortcutsButton && shortcutsButton.parentElement === actionsWrap) {
        actionsWrap.insertBefore(button, shortcutsButton);
    } else {
        actionsWrap.appendChild(button);
    }
    return button;
}

function getQueueCallKeyCaptureButton() {
    return document.querySelector('[data-action="queue-capture-call-key"]');
}

function getQueueCallKeyClearButton() {
    return document.querySelector('[data-action="queue-clear-call-key"]');
}

function ensureQueueCallKeyControlButtons() {
    const actionsWrap = document.querySelector(
        '#queue .queue-station-control-actions'
    );
    if (!(actionsWrap instanceof HTMLElement)) {
        return { captureButton: null, clearButton: null };
    }

    let captureButton = getQueueCallKeyCaptureButton();
    if (!(captureButton instanceof HTMLButtonElement)) {
        captureButton = document.createElement('button');
        captureButton.type = 'button';
        captureButton.className = 'btn btn-secondary btn-sm';
        captureButton.dataset.action = 'queue-capture-call-key';
        captureButton.setAttribute('aria-pressed', 'false');
        captureButton.textContent = 'Calibrar tecla externa';
        const shortcutsButton = actionsWrap.querySelector(
            '[data-action="queue-toggle-shortcuts"]'
        );
        if (shortcutsButton && shortcutsButton.parentElement === actionsWrap) {
            actionsWrap.insertBefore(captureButton, shortcutsButton);
        } else {
            actionsWrap.appendChild(captureButton);
        }
    }

    let clearButton = getQueueCallKeyClearButton();
    if (!(clearButton instanceof HTMLButtonElement)) {
        clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.className = 'btn btn-secondary btn-sm';
        clearButton.dataset.action = 'queue-clear-call-key';
        clearButton.textContent = 'Quitar tecla externa';
        clearButton.hidden = true;
        const anchorButton =
            captureButton && captureButton.parentElement === actionsWrap
                ? captureButton.nextSibling
                : null;
        if (anchorButton) {
            actionsWrap.insertBefore(clearButton, anchorButton);
        } else {
            actionsWrap.appendChild(clearButton);
        }
    }

    return { captureButton, clearButton };
}

function describeQueueCallKeyBinding(binding) {
    const normalizedBinding = normalizeQueueCallKeyBinding(binding);
    if (!normalizedBinding) return 'Numpad Enter';

    const { code, key, location } = normalizedBinding;
    if (code === 'numpadenter' || code === 'kpenter') {
        return 'Numpad Enter';
    }
    if (
        (key === 'enter' || key === 'return') &&
        location === NUMPAD_KEY_LOCATION
    ) {
        return 'Enter (numpad)';
    }
    if (key === 'enter' || key === 'return') {
        return 'Enter externo';
    }
    if (key && location === NUMPAD_KEY_LOCATION) {
        return `${key.toUpperCase()} (numpad)`;
    }
    if (key) {
        return key.length === 1 ? key.toUpperCase() : key;
    }
    if (code) {
        return code;
    }
    return 'Tecla externa';
}

function syncQueueOneTapShortcutHint() {
    const panel = getQueueHelpPanel();
    if (!(panel instanceof HTMLElement)) return;
    const list = panel.querySelector('ul');
    if (!(list instanceof HTMLElement)) return;

    let oneTapItem = list.querySelector('[data-queue-one-tap-hint]');
    if (!(oneTapItem instanceof HTMLLIElement)) {
        oneTapItem = document.createElement('li');
        oneTapItem.dataset.queueOneTapHint = '1';
        list.appendChild(oneTapItem);
    }

    const oneTapEnabled = normalizeQueueOneTapAdvance(
        queueStationState.oneTapAdvance,
        false
    );
    oneTapItem.innerHTML = oneTapEnabled
        ? '<strong>Modo 1 tecla:</strong> activo. Numpad Enter completa ticket activo y llama siguiente.'
        : '<strong>Modo 1 tecla:</strong> desactivado. Flujo recomendado: Numpad . y luego Numpad Enter.';
}

function syncQueueCallKeyShortcutHint() {
    const panel = getQueueHelpPanel();
    if (!(panel instanceof HTMLElement)) return;
    const list = panel.querySelector('ul');
    if (!(list instanceof HTMLElement)) return;

    let callKeyItem = list.querySelector('[data-queue-call-key-hint]');
    if (!(callKeyItem instanceof HTMLLIElement)) {
        callKeyItem = document.createElement('li');
        callKeyItem.dataset.queueCallKeyHint = '1';
        list.appendChild(callKeyItem);
    }

    if (queueStarUiState.customCallKey) {
        const bindingLabel = describeQueueCallKeyBinding(
            queueStarUiState.customCallKey
        );
        callKeyItem.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = 'Tecla externa activa:';
        callKeyItem.appendChild(strong);
        callKeyItem.append(` ${bindingLabel} (capturada en esta estación)`);
    } else {
        callKeyItem.innerHTML =
            '<strong>Tecla externa:</strong> opcional. Usa "Calibrar tecla externa" si tu numpad inalámbrico no envía Numpad Enter.';
    }
}

function syncQueueHelpPanel() {
    const panel = getQueueHelpPanel();
    const toggleButton = document.querySelector(
        '[data-action="queue-toggle-shortcuts"]'
    );
    if (panel instanceof HTMLElement) {
        panel.hidden = !queueStarUiState.helpOpen;
        panel.setAttribute('aria-hidden', String(!queueStarUiState.helpOpen));
    }
    if (toggleButton instanceof HTMLButtonElement) {
        toggleButton.setAttribute(
            'aria-pressed',
            String(queueStarUiState.helpOpen)
        );
        toggleButton.textContent = queueStarUiState.helpOpen
            ? 'Ocultar atajos'
            : 'Atajos numpad';
    }
    syncQueueOneTapShortcutHint();
    syncQueueCallKeyShortcutHint();
}

function setQueueHelpPanelOpen(
    isOpen,
    { announce = false, source = 'manual' } = {}
) {
    queueStarUiState.helpOpen = Boolean(isOpen);
    writeLocalFlag(
        QUEUE_NUMPAD_HELP_TOGGLE_STORAGE_KEY,
        queueStarUiState.helpOpen
    );
    syncQueueHelpPanel();
    if (queueStarUiState.helpOpen) {
        markQueueOnboardingStepCompleted('shortcuts_opened', {
            source,
            announce: false,
        });
    }
    emitQueueOpsStationEvent('shortcut_panel_toggled', {
        source,
        open: queueStarUiState.helpOpen,
    });
    if (announce) {
        showToast(
            queueStarUiState.helpOpen
                ? 'Panel de atajos numpad visible'
                : 'Panel de atajos numpad oculto',
            'info'
        );
    }
}

function toggleQueueHelpPanel({ source = 'manual', announce = true } = {}) {
    setQueueHelpPanelOpen(!queueStarUiState.helpOpen, { source, announce });
}

function getQueueOnboardingPanel() {
    return document.getElementById('queueOnboardingPanel');
}

function getQueuePracticeModeBadge() {
    return document.getElementById('queuePracticeModeBadge');
}

function normalizeQueuePracticeAction(action) {
    return String(action || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');
}

function resolveQueuePracticeStepId(action) {
    const normalized = normalizeQueuePracticeAction(action);
    if (!normalized) return '';
    if (normalized === 'call_next' || normalized === 'callnext') {
        return 'call_next';
    }
    if (normalized === 're_llamar' || normalized === 'rellamar') {
        return 're_llamar';
    }
    if (normalized === 'completar' || normalized === 'bulk_completar') {
        return 'completar';
    }
    if (normalized === 'no_show' || normalized === 'bulk_no_show') {
        return 'no_show';
    }
    return '';
}

function createQueuePracticeState() {
    const completed = {};
    QUEUE_PRACTICE_STEPS.forEach((step) => {
        completed[step.id] = false;
    });
    return {
        startedAt: Date.now(),
        lastActionAt: 0,
        actionsCount: 0,
        completed,
        completedAt: 0,
    };
}

function getQueuePracticeCompletionCount() {
    const state = queueStarUiState.practiceState;
    if (!state || !state.completed || typeof state.completed !== 'object') {
        return 0;
    }
    return QUEUE_PRACTICE_STEPS.reduce(
        (acc, step) => (state.completed[step.id] ? acc + 1 : acc),
        0
    );
}

function formatQueuePracticeElapsed() {
    const state = queueStarUiState.practiceState;
    if (!state || !Number.isFinite(state.startedAt) || state.startedAt <= 0) {
        return '00:00';
    }
    const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - Number(state.startedAt || 0)) / 1000)
    );
    const mm = String(Math.floor(elapsedSeconds / 60)).padStart(2, '0');
    const ss = String(elapsedSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
}

function stopQueuePracticeTicker() {
    if (!queueStarUiState.practiceTickId) return;
    window.clearInterval(queueStarUiState.practiceTickId);
    queueStarUiState.practiceTickId = 0;
}

function startQueuePracticeTicker() {
    stopQueuePracticeTicker();
    queueStarUiState.practiceTickId = window.setInterval(() => {
        if (!queueStarUiState.practiceMode) {
            stopQueuePracticeTicker();
            return;
        }
        syncQueuePracticeCoachUi();
    }, 1000);
}

function ensureQueuePracticeCoachStyles() {
    if (document.getElementById(QUEUE_PRACTICE_COACH_STYLE_ID)) return;
    const styleEl = document.createElement('style');
    styleEl.id = QUEUE_PRACTICE_COACH_STYLE_ID;
    styleEl.textContent = `
        #queue .queue-practice-coach {
            margin-top: 0.75rem;
            border: 1px solid var(--admin-border, #d8e1f0);
            border-radius: 16px;
            padding: 0.9rem 1rem;
            background: linear-gradient(160deg, #f6f9ff, #ffffff);
        }
        #queue .queue-practice-coach-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.6rem;
            margin-bottom: 0.48rem;
        }
        #queue .queue-practice-coach-header h4 {
            margin: 0;
            font-size: 1rem;
        }
        #queue .queue-practice-progress {
            font-size: 0.86rem;
            font-weight: 700;
            color: #1f4f9f;
            background: #eaf2ff;
            border-radius: 999px;
            padding: 0.15rem 0.55rem;
        }
        #queue .queue-practice-meta {
            margin: 0 0 0.5rem;
            color: #4f5d73;
            font-size: 0.9rem;
        }
        #queue .queue-practice-steps {
            margin: 0;
            padding-left: 1.1rem;
            display: grid;
            gap: 0.3rem;
        }
        #queue .queue-practice-step.is-done {
            color: #0d7a4a;
            font-weight: 600;
        }
        #queue .queue-practice-step.is-done::marker {
            content: '✓ ';
            color: #0d7a4a;
        }
        #queue .queue-practice-actions {
            margin-top: 0.62rem;
            display: flex;
            justify-content: flex-end;
        }
        #queue .queue-onboarding-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.6rem;
            margin-bottom: 0.35rem;
        }
        #queue .queue-onboarding-panel .queue-practice-meta {
            margin: 0 0 0.5rem;
        }
        #queue .queue-onboarding-panel .queue-practice-steps {
            margin: 0 0 0.55rem;
            padding-left: 1.1rem;
            display: grid;
            gap: 0.3rem;
        }
    `;
    document.head.appendChild(styleEl);
}

function ensureQueuePracticeCoachPanel() {
    let panel = document.getElementById('queuePracticeCoachPanel');
    if (panel instanceof HTMLElement) return panel;

    const queueSection = document.getElementById('queue');
    if (!(queueSection instanceof HTMLElement)) return null;
    const onboardingPanel = getQueueOnboardingPanel();
    if (!(onboardingPanel instanceof HTMLElement)) return null;

    ensureQueuePracticeCoachStyles();
    panel = document.createElement('section');
    panel.id = 'queuePracticeCoachPanel';
    panel.className = 'queue-practice-coach';
    panel.setAttribute('aria-label', 'Práctica guiada turnero');
    panel.hidden = true;
    panel.innerHTML = `
        <div class="queue-practice-coach-header">
            <h4>Práctica guiada</h4>
            <span id="queuePracticeProgressPill" class="queue-practice-progress">0/${QUEUE_PRACTICE_STEPS.length}</span>
        </div>
        <p id="queuePracticeMeta" class="queue-practice-meta">
            Activa práctica para ensayar sin afectar la cola real.
        </p>
        <ol id="queuePracticeStepsList" class="queue-practice-steps"></ol>
        <div class="queue-practice-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-reset-practice">
                Reiniciar práctica
            </button>
        </div>
    `;
    onboardingPanel.insertAdjacentElement('afterend', panel);
    return panel;
}

function renderQueuePracticeSteps() {
    const list = document.getElementById('queuePracticeStepsList');
    if (!(list instanceof HTMLElement)) return;
    const completed = queueStarUiState.practiceState?.completed || {};
    list.innerHTML = QUEUE_PRACTICE_STEPS.map((step) => {
        const done = Boolean(completed[step.id]);
        return `<li class="queue-practice-step${done ? ' is-done' : ''}">${step.label}</li>`;
    }).join('');
}

function syncQueuePracticeCoachUi() {
    const panel = ensureQueuePracticeCoachPanel();
    if (!(panel instanceof HTMLElement)) return;

    const practiceActive = Boolean(queueStarUiState.practiceMode);
    panel.hidden = !practiceActive;
    if (!practiceActive) return;

    const completedCount = getQueuePracticeCompletionCount();
    const totalSteps = QUEUE_PRACTICE_STEPS.length;
    const pill = document.getElementById('queuePracticeProgressPill');
    if (pill instanceof HTMLElement) {
        pill.textContent = `${completedCount}/${totalSteps}`;
    }

    const meta = document.getElementById('queuePracticeMeta');
    if (meta instanceof HTMLElement) {
        const state = queueStarUiState.practiceState;
        const actionCount = Number(state?.actionsCount || 0);
        const elapsed = formatQueuePracticeElapsed();
        if (completedCount >= totalSteps) {
            meta.textContent = `Práctica completada en ${elapsed}. Acciones simuladas: ${actionCount}.`;
        } else {
            meta.textContent = `Paso ${Math.min(totalSteps, completedCount + 1)} de ${totalSteps}. Tiempo: ${elapsed}.`;
        }
    }

    renderQueuePracticeSteps();
}

function registerQueuePracticeAction(
    action,
    { source = 'manual', consultorio = null, ticketId = null } = {}
) {
    if (!queueStarUiState.practiceMode) return;
    if (!queueStarUiState.practiceState) {
        queueStarUiState.practiceState = createQueuePracticeState();
    }

    const state = queueStarUiState.practiceState;
    state.actionsCount = Number(state.actionsCount || 0) + 1;
    state.lastActionAt = Date.now();

    const stepId = resolveQueuePracticeStepId(action);
    let stepCompleted = false;
    if (stepId && !state.completed[stepId]) {
        state.completed[stepId] = true;
        stepCompleted = true;
    }

    const completedCount = getQueuePracticeCompletionCount();
    const totalSteps = QUEUE_PRACTICE_STEPS.length;
    const finished = completedCount >= totalSteps;
    if (finished && !state.completedAt) {
        state.completedAt = Date.now();
    }

    syncQueuePracticeCoachUi();

    if (finished) {
        markQueueOnboardingStepCompleted('practice_completed', {
            source,
            announce: false,
        });
    }

    emitQueueOpsStationEvent('practice_action_simulated', {
        source,
        action,
        stepId: stepId || null,
        stepCompleted,
        completedCount,
        totalSteps,
        consultorio,
        ticketId,
        finished,
    });

    if (stepCompleted) {
        showToast(
            finished
                ? 'Práctica completada. Lista para operación real.'
                : `Práctica: paso ${completedCount}/${totalSteps} completado.`,
            finished ? 'success' : 'info'
        );
    }
}

function resetQueuePracticeProgress({
    source = 'manual',
    announce = false,
} = {}) {
    queueStarUiState.practiceState = createQueuePracticeState();
    syncQueuePracticeCoachUi();
    emitQueueOpsStationEvent('practice_progress_reset', {
        source,
        totalSteps: QUEUE_PRACTICE_STEPS.length,
    });
    if (announce) {
        showToast('Práctica reiniciada desde el paso 1.', 'info');
    }
}

function syncQueuePracticeModeUi() {
    const isActive = Boolean(queueStarUiState.practiceMode);
    const badge = getQueuePracticeModeBadge();
    if (badge instanceof HTMLElement) {
        badge.hidden = !isActive;
    }
    const stopPracticeButton = document.querySelector(
        '[data-action="queue-stop-practice"]'
    );
    if (stopPracticeButton instanceof HTMLButtonElement) {
        stopPracticeButton.hidden = !isActive;
    }
    syncQueuePracticeCoachUi();
}

function setQueuePracticeMode(isActive, { source = 'manual' } = {}) {
    queueStarUiState.practiceMode = Boolean(isActive);
    if (queueStarUiState.practiceMode) {
        resetQueuePracticeProgress({ source, announce: false });
        startQueuePracticeTicker();
    } else {
        stopQueuePracticeTicker();
        queueStarUiState.practiceState = null;
    }
    try {
        window.__PIEL_QUEUE_PRACTICE_MODE = queueStarUiState.practiceMode;
    } catch (_error) {
        // no-op
    }
    syncQueuePracticeModeUi();
    emitQueueOpsStationEvent(
        queueStarUiState.practiceMode
            ? 'practice_mode_enabled'
            : 'practice_mode_disabled',
        {
            source,
            stationMode: queueStationState.mode,
            consultorio: queueStationState.consultorio,
        }
    );
}

function simulateQueuePracticeAction(
    action,
    { source = 'manual', consultorio = null, ticketId = null } = {}
) {
    showToast(
        `Modo práctica: "${action}" simulado${consultorio ? ` en C${consultorio}` : ''}.`,
        'info'
    );
    registerQueuePracticeAction(action, {
        source,
        consultorio,
        ticketId,
    });
}

function setQueueOnboardingVisible(
    isVisible,
    { persist = false, source = 'manual' } = {}
) {
    const panel = getQueueOnboardingPanel();
    const visible = Boolean(isVisible);
    queueStarUiState.onboardingVisible = visible;
    if (panel instanceof HTMLElement) {
        panel.hidden = !visible;
        panel.setAttribute('aria-hidden', String(!visible));
    }
    if (!visible && persist) {
        writeLocalFlag(QUEUE_ONBOARDING_SEEN_STORAGE_KEY, true);
    }
    syncQueueOnboardingChecklistUi();
    syncQueuePracticeCoachUi();
    emitQueueOpsStationEvent(
        visible ? 'onboarding_opened' : 'onboarding_closed',
        {
            source,
        }
    );
}

function maybeShowQueueOnboarding() {
    syncQueueOnboardingChecklistUi();
    const onboardingSeen = readLocalFlag(
        QUEUE_ONBOARDING_SEEN_STORAGE_KEY,
        false
    );
    if (onboardingSeen) {
        setQueueOnboardingVisible(false, { source: 'autoload' });
        return;
    }
    setQueueOnboardingVisible(true, { source: 'autoload' });
}

function getNavItems() {
    return Array.from(
        document.querySelectorAll(
            '.nav-item[data-section], .admin-quick-nav-item[data-section]'
        )
    );
}

function normalizeAdminSection(section, fallback = 'dashboard') {
    const candidate = String(section || '').trim();
    if (!candidate) return fallback;
    const sections = new Set(getNavItems().map((item) => item.dataset.section));
    return sections.has(candidate) ? candidate : fallback;
}

function getSectionFromHash({ fallback = 'dashboard' } = {}) {
    const hashSection = window.location.hash.replace(/^#/, '').trim();
    return normalizeAdminSection(hashSection, fallback);
}

function readStoredAdminSection() {
    try {
        const storedSection = localStorage.getItem(
            ADMIN_LAST_SECTION_STORAGE_KEY
        );
        return normalizeAdminSection(storedSection, 'dashboard');
    } catch (_error) {
        return 'dashboard';
    }
}

function persistAdminSection(section) {
    const normalizedSection = normalizeAdminSection(section, 'dashboard');
    try {
        localStorage.setItem(ADMIN_LAST_SECTION_STORAGE_KEY, normalizedSection);
    } catch (_error) {
        // no-op
    }
}

function resolvePreferredSection() {
    const hashSection = window.location.hash.replace(/^#/, '').trim();
    if (hashSection) {
        return normalizeAdminSection(hashSection, 'dashboard');
    }
    return readStoredAdminSection();
}

function getActiveSection() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section ||
        resolvePreferredSection() ||
        'dashboard'
    );
}

function isCompactAdminViewport() {
    return window.innerWidth <= ADMIN_NAV_COMPACT_BREAKPOINT;
}

function isSidebarOpen() {
    return Boolean(
        document.getElementById('adminSidebar')?.classList.contains('is-open')
    );
}

function isSidebarCollapsed() {
    return Boolean(
        document.body?.classList.contains('admin-sidebar-collapsed')
    );
}

function readSidebarCollapsedPreference() {
    try {
        return (
            localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY) === '1'
        );
    } catch (_error) {
        return false;
    }
}

function persistSidebarCollapsedPreference(isCollapsed) {
    try {
        localStorage.setItem(
            ADMIN_SIDEBAR_COLLAPSED_STORAGE_KEY,
            isCollapsed ? '1' : '0'
        );
    } catch (_error) {
        // no-op
    }
}

function syncSidebarCollapseButtonState(isCollapsed) {
    const collapseBtn = document.getElementById('adminSidebarCollapse');
    if (!(collapseBtn instanceof HTMLButtonElement)) return;
    const nextLabel = isCollapsed
        ? 'Expandir navegación lateral'
        : 'Contraer navegación lateral';
    collapseBtn.setAttribute('aria-pressed', String(isCollapsed));
    collapseBtn.setAttribute('aria-label', nextLabel);
    collapseBtn.setAttribute('title', nextLabel);
}

function setSidebarCollapsed(isCollapsed, { persist = true } = {}) {
    if (!document.body) return false;

    const shouldCollapse = Boolean(!isCompactAdminViewport() && isCollapsed);
    document.body.classList.toggle('admin-sidebar-collapsed', shouldCollapse);
    syncSidebarCollapseButtonState(shouldCollapse);

    if (persist) {
        persistSidebarCollapsedPreference(shouldCollapse);
    }

    return shouldCollapse;
}

function syncSidebarLayoutMode() {
    if (isCompactAdminViewport()) {
        setSidebarCollapsed(false, { persist: false });
        return;
    }
    setSidebarCollapsed(readSidebarCollapsedPreference(), { persist: false });
}

function setNavActive(section) {
    const normalizedSection = normalizeAdminSection(section, 'dashboard');
    getNavItems().forEach((item) => {
        const isActive = item.dataset.section === normalizedSection;
        item.classList.toggle('active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
        if (item instanceof HTMLButtonElement) {
            item.setAttribute('aria-pressed', String(isActive));
        }
    });
    persistAdminSection(normalizedSection);
}

function isTypingContextTarget(target) {
    if (!(target instanceof HTMLElement)) return false;
    if (target.isContentEditable) return true;
    return Boolean(
        target.closest('input, textarea, select, [contenteditable="true"]')
    );
}

function normalizeQueueStationMode(mode, fallback = QUEUE_STATION_MODE_FREE) {
    const normalized = String(mode || '')
        .trim()
        .toLowerCase();
    if (
        normalized === QUEUE_STATION_MODE_LOCKED ||
        normalized === QUEUE_STATION_MODE_FREE
    ) {
        return normalized;
    }
    return fallback;
}

function normalizeQueueStationConsultorio(consultorio, fallback = 1) {
    const normalized = Number(consultorio || 0);
    return normalized === 1 || normalized === 2 ? normalized : fallback;
}

function normalizeQueueOneTapAdvance(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

function normalizeQueueCallKeyBinding(binding, fallback = null) {
    if (!binding || typeof binding !== 'object') {
        return fallback;
    }
    const code = String(binding.code || '')
        .trim()
        .toLowerCase();
    const key = String(binding.key || '')
        .trim()
        .toLowerCase();
    const locationRaw = Number(binding.location);
    const location = Number.isFinite(locationRaw)
        ? Math.max(0, Math.min(3, Math.round(locationRaw)))
        : null;

    if (!code && !key) {
        return fallback;
    }

    return {
        code,
        key,
        location,
    };
}

function readQueueCustomCallKeyFromStorage() {
    try {
        const raw = localStorage.getItem(QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizeQueueCallKeyBinding(parsed, null);
    } catch (_error) {
        return null;
    }
}

function persistQueueCustomCallKey(binding) {
    try {
        const normalized = normalizeQueueCallKeyBinding(binding, null);
        if (!normalized) {
            localStorage.removeItem(QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY);
            return;
        }
        localStorage.setItem(
            QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
            JSON.stringify(normalized)
        );
    } catch (_error) {
        // no-op
    }
}

function readQueueStationConfigFromStorage() {
    try {
        const mode = normalizeQueueStationMode(
            localStorage.getItem(QUEUE_STATION_MODE_STORAGE_KEY),
            QUEUE_STATION_MODE_FREE
        );
        const consultorio = normalizeQueueStationConsultorio(
            localStorage.getItem(QUEUE_STATION_CONSULTORIO_STORAGE_KEY),
            1
        );
        return { mode, consultorio };
    } catch (_error) {
        return {
            mode: QUEUE_STATION_MODE_FREE,
            consultorio: 1,
        };
    }
}

function persistQueueStationConfig(mode, consultorio) {
    try {
        localStorage.setItem(
            QUEUE_STATION_MODE_STORAGE_KEY,
            normalizeQueueStationMode(mode, QUEUE_STATION_MODE_FREE)
        );
        localStorage.setItem(
            QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
            String(normalizeQueueStationConsultorio(consultorio, 1))
        );
    } catch (_error) {
        // no-op
    }
}

function readQueueOneTapAdvanceFromStorage() {
    try {
        return normalizeQueueOneTapAdvance(
            localStorage.getItem(QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY),
            false
        );
    } catch (_error) {
        return false;
    }
}

function persistQueueOneTapAdvance(enabled) {
    try {
        localStorage.setItem(
            QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
            enabled ? '1' : '0'
        );
    } catch (_error) {
        // no-op
    }
}

function readQueueStationProvisioningFromUrl() {
    try {
        const url = new URL(window.location.href);
        const stationRaw = String(url.searchParams.get('station') || '')
            .trim()
            .toLowerCase();
        const lockRaw = String(url.searchParams.get('lock') || '')
            .trim()
            .toLowerCase();
        const oneTapRaw = String(
            url.searchParams.get('onetap') ||
                url.searchParams.get('one_tap') ||
                ''
        )
            .trim()
            .toLowerCase();
        const hasStationParam = stationRaw !== '';
        const hasLockParam = lockRaw !== '';
        const hasOneTapParam = oneTapRaw !== '';

        if (!hasStationParam && !hasLockParam && !hasOneTapParam) {
            return null;
        }

        let consultorio = null;
        if (stationRaw === 'c1' || stationRaw === '1') {
            consultorio = 1;
        } else if (stationRaw === 'c2' || stationRaw === '2') {
            consultorio = 2;
        }

        let mode = null;
        if (['1', 'true', 'locked', 'yes'].includes(lockRaw)) {
            mode = QUEUE_STATION_MODE_LOCKED;
        } else if (['0', 'false', 'free', 'no'].includes(lockRaw)) {
            mode = QUEUE_STATION_MODE_FREE;
        }
        const oneTapAdvance = hasOneTapParam
            ? normalizeQueueOneTapAdvance(oneTapRaw, false)
            : null;

        return {
            consultorio,
            mode,
            oneTapAdvance,
            hadStationParam: hasStationParam,
            hadLockParam: hasLockParam,
            hadOneTapParam: hasOneTapParam,
        };
    } catch (_error) {
        return null;
    }
}

function clearQueueStationProvisioningParams() {
    try {
        const url = new URL(window.location.href);
        const hadStation = url.searchParams.has('station');
        const hadLock = url.searchParams.has('lock');
        const hadOneTap =
            url.searchParams.has('onetap') || url.searchParams.has('one_tap');
        if (!hadStation && !hadLock && !hadOneTap) return;
        url.searchParams.delete('station');
        url.searchParams.delete('lock');
        url.searchParams.delete('onetap');
        url.searchParams.delete('one_tap');
        const nextPath = `${url.pathname}${url.search}${url.hash}`;
        if (
            window.history &&
            typeof window.history.replaceState === 'function'
        ) {
            window.history.replaceState(null, '', nextPath || url.pathname);
        }
    } catch (_error) {
        // no-op
    }
}

function isQueueStationLocked() {
    return queueStationState.mode === QUEUE_STATION_MODE_LOCKED;
}

function isQueueStationCallAllowed(consultorio) {
    const room = normalizeQueueStationConsultorio(consultorio, 0);
    if (![1, 2].includes(room)) return false;
    if (!isQueueStationLocked()) return true;
    return room === queueStationState.consultorio;
}

function syncQueueStationUi() {
    const queueSection = document.getElementById('queue');
    if (!(queueSection instanceof HTMLElement)) return;

    const mode = normalizeQueueStationMode(
        queueStationState.mode,
        QUEUE_STATION_MODE_FREE
    );
    const consultorio = normalizeQueueStationConsultorio(
        queueStationState.consultorio,
        1
    );
    const oneTapAdvance = normalizeQueueOneTapAdvance(
        queueStationState.oneTapAdvance,
        false
    );
    const customCallKey = normalizeQueueCallKeyBinding(
        queueStarUiState.customCallKey,
        null
    );
    const captureCallKeyMode = Boolean(queueStarUiState.captureCallKeyMode);

    queueSection.dataset.stationMode = mode;
    queueSection.dataset.stationConsultorio = String(consultorio);
    queueSection.dataset.oneTapAdvance = oneTapAdvance ? '1' : '0';
    queueSection.dataset.customCallKey = customCallKey ? '1' : '0';
    queueSection.dataset.captureCallKeyMode = captureCallKeyMode ? '1' : '0';

    const stationBadge = document.getElementById('queueStationBadge');
    if (stationBadge instanceof HTMLElement) {
        stationBadge.textContent = `Estación C${consultorio}`;
        stationBadge.dataset.consultorio = String(consultorio);
    }

    const modeBadge = document.getElementById('queueStationModeBadge');
    if (modeBadge instanceof HTMLElement) {
        const locked = mode === QUEUE_STATION_MODE_LOCKED;
        modeBadge.dataset.mode = locked
            ? QUEUE_STATION_MODE_LOCKED
            : QUEUE_STATION_MODE_FREE;
        modeBadge.textContent = locked ? 'Bloqueado' : 'Libre';
    }

    const stationHint = document.getElementById('queueStationHint');
    if (stationHint instanceof HTMLElement) {
        let hintText =
            mode === QUEUE_STATION_MODE_LOCKED
                ? oneTapAdvance
                    ? `Modo 1 tecla activo: Numpad Enter completa ticket activo y llama siguiente en C${consultorio}.`
                    : `Numpad Enter llama en C${consultorio}. Numpad . completa, Numpad - no_show y Numpad + re-llama.`
                : oneTapAdvance
                  ? `Modo libre + 1 tecla: Numpad 1/2 elige consultorio y Numpad Enter completa + llama.`
                  : `Modo libre: Numpad 1/2 selecciona consultorio, Numpad Enter llama y Numpad 0 abre ayuda.`;
        if (customCallKey) {
            hintText += ` Tecla externa activa: ${describeQueueCallKeyBinding(customCallKey)}.`;
        }
        if (captureCallKeyMode) {
            hintText +=
                ' Calibración en curso: presiona la tecla deseada o Esc para cancelar.';
        }
        stationHint.textContent = hintText;
    }

    document
        .querySelectorAll('[data-action="queue-lock-station"]')
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            const targetConsultorio = normalizeQueueStationConsultorio(
                button.dataset.queueConsultorio || 0,
                0
            );
            const isActive =
                mode === QUEUE_STATION_MODE_LOCKED &&
                targetConsultorio === consultorio;
            button.classList.toggle('is-active', isActive);
            button.disabled = mode === QUEUE_STATION_MODE_LOCKED;
            button.setAttribute('aria-pressed', String(isActive));
        });

    const freeModeButton = document.querySelector(
        '[data-action="queue-set-station-mode"][data-queue-mode="free"]'
    );
    if (freeModeButton instanceof HTMLButtonElement) {
        const isFreeMode = mode === QUEUE_STATION_MODE_FREE;
        freeModeButton.classList.toggle('is-active', isFreeMode);
        freeModeButton.disabled = isFreeMode;
        freeModeButton.setAttribute('aria-pressed', String(isFreeMode));
    }

    const reconfigureButton = document.querySelector(
        '[data-action="queue-reconfigure-station"]'
    );
    if (reconfigureButton instanceof HTMLButtonElement) {
        reconfigureButton.disabled = mode !== QUEUE_STATION_MODE_LOCKED;
    }

    const oneTapButton = ensureQueueOneTapControlButton();
    if (oneTapButton instanceof HTMLButtonElement) {
        oneTapButton.classList.toggle('is-active', oneTapAdvance);
        oneTapButton.setAttribute('aria-pressed', String(oneTapAdvance));
        oneTapButton.textContent = oneTapAdvance
            ? 'Modo 1 tecla: ON'
            : 'Modo 1 tecla: OFF';
        oneTapButton.title = oneTapAdvance
            ? 'Desactivar modo 1 tecla (Alt+Shift+E)'
            : 'Activar modo 1 tecla (Alt+Shift+E)';
    }

    const { captureButton, clearButton } = ensureQueueCallKeyControlButtons();
    if (captureButton instanceof HTMLButtonElement) {
        captureButton.classList.toggle('is-active', captureCallKeyMode);
        captureButton.setAttribute('aria-pressed', String(captureCallKeyMode));
        if (captureCallKeyMode) {
            captureButton.textContent = 'Escuchando tecla...';
            captureButton.title =
                'Presiona la tecla externa de llamado (Esc para cancelar)';
        } else if (customCallKey) {
            captureButton.textContent = 'Recalibrar tecla externa';
            captureButton.title = `Tecla actual: ${describeQueueCallKeyBinding(customCallKey)}`;
        } else {
            captureButton.textContent = 'Calibrar tecla externa';
            captureButton.title =
                'Asigna una tecla externa para llamar siguiente';
        }
    }
    if (clearButton instanceof HTMLButtonElement) {
        clearButton.hidden = !customCallKey;
        clearButton.disabled = captureCallKeyMode;
        clearButton.setAttribute('aria-hidden', String(!customCallKey));
        if (customCallKey) {
            clearButton.title = `Quitar tecla externa (${describeQueueCallKeyBinding(customCallKey)})`;
        } else {
            clearButton.removeAttribute('title');
        }
    }

    document
        .querySelectorAll(
            '[data-action="queue-call-next"][data-queue-consultorio]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLElement)) return;
            if (!button.dataset.stationDefaultTitle) {
                button.dataset.stationDefaultTitle = String(
                    button.getAttribute('title') || ''
                ).trim();
            }
            const room = normalizeQueueStationConsultorio(
                button.dataset.queueConsultorio || 0,
                0
            );
            const blocked =
                mode === QUEUE_STATION_MODE_LOCKED && room !== consultorio;
            button.classList.toggle('is-station-blocked', blocked);
            if (button instanceof HTMLButtonElement) {
                button.setAttribute('aria-disabled', String(button.disabled));
            }
            if (blocked) {
                button.setAttribute(
                    'title',
                    `Estación bloqueada en C${consultorio}. Click para llamado manual en C${room}.`
                );
            } else {
                const defaultTitle = String(
                    button.dataset.stationDefaultTitle || ''
                ).trim();
                if (defaultTitle) {
                    button.setAttribute('title', defaultTitle);
                } else {
                    button.removeAttribute('title');
                }
            }
        });

    syncQueueHelpPanel();
}

function setQueueOneTapAdvanceEnabled(
    enabled,
    { persist = true, announce = false, source = 'manual' } = {}
) {
    const nextEnabled = normalizeQueueOneTapAdvance(enabled, false);
    const changed = nextEnabled !== queueStationState.oneTapAdvance;
    queueStationState.oneTapAdvance = nextEnabled;

    if (persist) {
        persistQueueOneTapAdvance(nextEnabled);
    }

    syncQueueStationUi();

    if (announce && changed) {
        showToast(
            nextEnabled
                ? 'Modo 1 tecla activado: Numpad Enter completa y llama siguiente.'
                : 'Modo 1 tecla desactivado: vuelve flujo completar + llamar.',
            nextEnabled ? 'success' : 'info'
        );
    }

    if (changed) {
        emitQueueOpsStationEvent('one_tap_mode_toggled', {
            source,
            enabled: nextEnabled,
            stationMode: queueStationState.mode,
            consultorio: queueStationState.consultorio,
        });
    }
}

function setQueueCustomCallKeyBinding(
    binding,
    { persist = true, announce = true, source = 'manual' } = {}
) {
    const normalized = normalizeQueueCallKeyBinding(binding, null);
    queueStarUiState.customCallKey = normalized;
    if (persist) {
        persistQueueCustomCallKey(normalized);
    }
    syncQueueStationUi();

    if (normalized) {
        emitQueueOpsStationEvent('call_key_binding_saved', {
            source,
            binding: normalized,
            stationMode: queueStationState.mode,
            consultorio: queueStationState.consultorio,
        });
        if (announce) {
            showToast(
                `Tecla externa guardada: ${describeQueueCallKeyBinding(normalized)}.`,
                'success'
            );
        }
        return;
    }

    emitQueueOpsStationEvent('call_key_binding_cleared', {
        source,
        stationMode: queueStationState.mode,
        consultorio: queueStationState.consultorio,
    });
    if (announce) {
        showToast(
            'Tecla externa eliminada. Se usa Numpad Enter estándar.',
            'info'
        );
    }
}

function setQueueCallKeyCaptureMode(
    enabled,
    { source = 'manual', announce = true } = {}
) {
    const nextMode = Boolean(enabled);
    if (nextMode === queueStarUiState.captureCallKeyMode) return;
    queueStarUiState.captureCallKeyMode = nextMode;
    syncQueueStationUi();

    emitQueueOpsStationEvent(
        nextMode ? 'call_key_capture_started' : 'call_key_capture_stopped',
        {
            source,
            stationMode: queueStationState.mode,
            consultorio: queueStationState.consultorio,
        }
    );

    if (!announce) return;
    showToast(
        nextMode
            ? 'Calibración activa: presiona la tecla externa para llamar siguiente.'
            : 'Calibración detenida.',
        nextMode ? 'info' : 'warning'
    );
}

function isQueueCallKeyCaptureSkippableEvent(event) {
    const key = getQueueKeyboardKey(event);
    const code = getQueueKeyboardCode(event);
    if (!key && !code) return true;
    const skippableKeys = new Set([
        'shift',
        'control',
        'alt',
        'meta',
        'altgraph',
        'capslock',
        'numlock',
        'scrolllock',
    ]);
    const skippableCodes = new Set([
        'shiftleft',
        'shiftright',
        'controlleft',
        'controlright',
        'altleft',
        'altright',
        'metaleft',
        'metaright',
    ]);
    return skippableKeys.has(key) || skippableCodes.has(code);
}

function captureQueueCallKeyFromEvent(event, { source = 'capture' } = {}) {
    if (!queueStarUiState.captureCallKeyMode) return false;

    const key = getQueueKeyboardKey(event);
    if (key === 'escape') {
        setQueueCallKeyCaptureMode(false, {
            source: `${source}_escape`,
            announce: true,
        });
        return true;
    }
    if (event.repeat) return true;
    if (event.ctrlKey || event.metaKey || event.altKey) return true;
    if (isQueueCallKeyCaptureSkippableEvent(event)) return true;

    const signature = getQueueKeyboardSignature(event);
    if (!signature) return true;

    setQueueCustomCallKeyBinding(signature, {
        persist: true,
        announce: true,
        source,
    });
    setQueueCallKeyCaptureMode(false, {
        source: `${source}_saved`,
        announce: false,
    });
    return true;
}

function setQueueStationConfig(
    {
        mode = queueStationState.mode,
        consultorio = queueStationState.consultorio,
    },
    { persist = true, announce = false, source = 'manual' } = {}
) {
    const nextMode = normalizeQueueStationMode(mode, queueStationState.mode);
    const nextConsultorio = normalizeQueueStationConsultorio(
        consultorio,
        queueStationState.consultorio
    );
    const changedMode = nextMode !== queueStationState.mode;
    const changedConsultorio =
        nextConsultorio !== queueStationState.consultorio;

    queueStationState.mode = nextMode;
    queueStationState.consultorio = nextConsultorio;

    if (persist) {
        persistQueueStationConfig(nextMode, nextConsultorio);
    }

    syncQueueStationUi();

    if (nextMode === QUEUE_STATION_MODE_LOCKED) {
        markQueueOnboardingStepCompleted('station_locked', {
            source,
            announce: false,
        });
    }

    if (announce && (changedMode || changedConsultorio)) {
        if (nextMode === QUEUE_STATION_MODE_LOCKED) {
            showToast(`Estación bloqueada en C${nextConsultorio}`, 'success');
        } else {
            showToast(`Estación en modo libre (C${nextConsultorio})`, 'info');
        }
    }

    if (changedMode || changedConsultorio) {
        emitQueueOpsStationEvent('station_config_updated', {
            source,
            mode: nextMode,
            consultorio: nextConsultorio,
            changedMode,
            changedConsultorio,
        });
    }
}

function bootstrapQueueStationConfig() {
    stopQueuePracticeTicker();
    const storedConfig = readQueueStationConfigFromStorage();
    queueStationState.mode = storedConfig.mode;
    queueStationState.consultorio = storedConfig.consultorio;
    queueStationState.oneTapAdvance = readQueueOneTapAdvanceFromStorage();
    queueStarUiState.customCallKey = readQueueCustomCallKeyFromStorage();
    queueStarUiState.onboardingProgress =
        readQueueOnboardingProgressFromStorage();
    queueStarUiState.helpOpen = readLocalFlag(
        QUEUE_NUMPAD_HELP_TOGGLE_STORAGE_KEY,
        false
    );
    queueStarUiState.onboardingVisible = false;
    queueStarUiState.practiceMode = false;
    queueStarUiState.practiceState = null;
    queueStarUiState.practiceTickId = 0;
    queueStarUiState.oneTapInFlight = false;
    queueStarUiState.lastOneTapAt = 0;
    queueStarUiState.captureCallKeyMode = false;
    try {
        window.__PIEL_QUEUE_PRACTICE_MODE = false;
    } catch (_error) {
        // no-op
    }

    const provisioningConfig = readQueueStationProvisioningFromUrl();
    if (provisioningConfig) {
        queueStationState.mode = normalizeQueueStationMode(
            provisioningConfig.mode,
            queueStationState.mode
        );
        queueStationState.consultorio = normalizeQueueStationConsultorio(
            provisioningConfig.consultorio,
            queueStationState.consultorio
        );
        if (provisioningConfig.oneTapAdvance !== null) {
            queueStationState.oneTapAdvance = normalizeQueueOneTapAdvance(
                provisioningConfig.oneTapAdvance,
                queueStationState.oneTapAdvance
            );
            persistQueueOneTapAdvance(queueStationState.oneTapAdvance);
        }
        persistQueueStationConfig(
            queueStationState.mode,
            queueStationState.consultorio
        );
        emitQueueOpsStationEvent('station_bootstrap', {
            source: 'query',
            mode: queueStationState.mode,
            consultorio: queueStationState.consultorio,
            oneTapAdvance: queueStationState.oneTapAdvance,
        });
        clearQueueStationProvisioningParams();
    } else {
        emitQueueOpsStationEvent('station_bootstrap', {
            source: 'storage',
            mode: queueStationState.mode,
            consultorio: queueStationState.consultorio,
            oneTapAdvance: queueStationState.oneTapAdvance,
        });
    }

    syncQueueStationUi();
    syncQueueHelpPanel();
    if (queueStationState.mode === QUEUE_STATION_MODE_LOCKED) {
        markQueueOnboardingStepCompleted('station_locked', {
            source: 'bootstrap',
            announce: false,
        });
    }
    if (queueStarUiState.helpOpen) {
        markQueueOnboardingStepCompleted('shortcuts_opened', {
            source: 'bootstrap',
            announce: false,
        });
    }
    syncQueueOnboardingChecklistUi();
    syncQueuePracticeModeUi();
    setQueueOnboardingVisible(false, { source: 'bootstrap' });
}

function isQueueNumpadEnterEvent(event) {
    if (isQueueCustomCallKeyEvent(event)) return true;
    const code = getQueueKeyboardCode(event);
    if (QUEUE_NUMPAD_ENTER_CODES.has(code)) return true;
    return matchesQueueNumpadKeyByLocation(event, QUEUE_NUMPAD_ENTER_KEYS);
}

function getQueueKeyboardLocation(event) {
    const rawLocation = Number(event?.location);
    return Number.isFinite(rawLocation)
        ? Math.max(0, Math.min(3, Math.round(rawLocation)))
        : 0;
}

function getQueueKeyboardSignature(event) {
    return normalizeQueueCallKeyBinding(
        {
            code: getQueueKeyboardCode(event),
            key: getQueueKeyboardKey(event),
            location: getQueueKeyboardLocation(event),
        },
        null
    );
}

function isQueueCustomCallKeyEvent(event) {
    const customBinding = normalizeQueueCallKeyBinding(
        queueStarUiState.customCallKey,
        null
    );
    if (!customBinding) return false;

    const eventBinding = getQueueKeyboardSignature(event);
    if (!eventBinding) return false;

    const codeMatches = customBinding.code
        ? customBinding.code === eventBinding.code
        : true;
    const keyMatches = customBinding.key
        ? customBinding.key === eventBinding.key
        : true;
    const locationMatches =
        typeof customBinding.location === 'number'
            ? customBinding.location === eventBinding.location
            : true;
    return codeMatches && keyMatches && locationMatches;
}

function isQueueNumpadDigitEvent(event, digit) {
    const expectedDigit = String(digit || '');
    if (!expectedDigit) return false;
    const code = getQueueKeyboardCode(event);
    if (code === `numpad${expectedDigit}`) return true;
    const key = String(event.key || '').trim();
    return isQueueNumpadLocation(event) && key === expectedDigit;
}

function isQueueNumpadAddEvent(event) {
    const code = getQueueKeyboardCode(event);
    if (QUEUE_NUMPAD_ADD_CODES.has(code)) return true;
    return matchesQueueNumpadKeyByLocation(event, QUEUE_NUMPAD_ADD_KEYS);
}

function isQueueNumpadSubtractEvent(event) {
    const code = getQueueKeyboardCode(event);
    if (QUEUE_NUMPAD_SUBTRACT_CODES.has(code)) return true;
    return matchesQueueNumpadKeyByLocation(event, QUEUE_NUMPAD_SUBTRACT_KEYS);
}

function isQueueNumpadDecimalEvent(event) {
    const code = getQueueKeyboardCode(event);
    if (QUEUE_NUMPAD_DECIMAL_CODES.has(code)) return true;
    return matchesQueueNumpadKeyByLocation(event, QUEUE_NUMPAD_DECIMAL_KEYS);
}

function isQueueNumpadZeroEvent(event) {
    return isQueueNumpadDigitEvent(event, 0);
}

function getQueueKeyboardCode(event) {
    return String(event?.code || '')
        .trim()
        .toLowerCase();
}

function getQueueKeyboardKey(event) {
    return String(event?.key || '')
        .trim()
        .toLowerCase();
}

function isQueueNumpadLocation(event) {
    return Number(event?.location || 0) === NUMPAD_KEY_LOCATION;
}

function matchesQueueNumpadKeyByLocation(event, keysSet) {
    return (
        isQueueNumpadLocation(event) && keysSet.has(getQueueKeyboardKey(event))
    );
}

function getQueueActiveTicketIdForConsultorio(consultorio) {
    const room = normalizeQueueStationConsultorio(consultorio, 0);
    if (![1, 2].includes(room)) return 0;
    const releaseButton = document.getElementById(`queueReleaseC${room}`);
    const ticketId = Number(releaseButton?.dataset?.queueId || 0);
    return Number.isFinite(ticketId) ? ticketId : 0;
}

function getQueueActiveTicketLabelForConsultorio(consultorio) {
    const room = normalizeQueueStationConsultorio(consultorio, 0);
    if (![1, 2].includes(room)) return '--';
    const releaseButton = document.getElementById(`queueReleaseC${room}`);
    const text = String(releaseButton?.textContent || '').trim();
    const match = text.match(/\(([^)]+)\)\s*$/);
    if (match && match[1]) return match[1].trim();
    return '--';
}

function requiresQueueSensitiveConfirmation(action) {
    return QUEUE_SENSITIVE_ACTIONS.has(String(action || '').toLowerCase());
}

function confirmQueueSensitiveAction({
    action,
    consultorio,
    source = 'manual',
} = {}) {
    const normalizedAction = String(action || '').toLowerCase();
    const room = normalizeQueueStationConsultorio(consultorio, 0);
    const ticketLabel = getQueueActiveTicketLabelForConsultorio(room);
    const firstConfirm = window.confirm(
        `Acción sensible: ${normalizedAction} ${ticketLabel !== '--' ? `(${ticketLabel})` : ''} en C${room}. ¿Deseas continuar?`
    );
    if (!firstConfirm) {
        emitQueueOpsStationEvent('action_cancelled', {
            source,
            action: normalizedAction,
            consultorio: room || null,
            reason: 'first_confirm_declined',
        });
        return false;
    }

    const secondConfirm = window.confirm(
        'Confirmación final: esta acción afectará la cola actual. ¿Confirmas ejecutar ahora?'
    );
    if (!secondConfirm) {
        emitQueueOpsStationEvent('action_cancelled', {
            source,
            action: normalizedAction,
            consultorio: room || null,
            reason: 'second_confirm_declined',
        });
        return false;
    }
    emitQueueOpsStationEvent('action_confirmed', {
        source,
        action: normalizedAction,
        consultorio: room || null,
    });
    return true;
}

async function runQueueStationTicketAction(action, { source = 'numpad' } = {}) {
    const normalizedAction = String(action || '').toLowerCase();
    const room = normalizeQueueStationConsultorio(
        queueStationState.consultorio,
        0
    );
    if (![1, 2].includes(room)) {
        showToast('Consultorio de estación inválido', 'error');
        return false;
    }

    const ticketId = getQueueActiveTicketIdForConsultorio(room);
    if (!ticketId) {
        showToast(`No hay ticket activo en C${room}`, 'warning');
        return false;
    }

    if (requiresQueueSensitiveConfirmation(normalizedAction)) {
        const confirmed = confirmQueueSensitiveAction({
            action: normalizedAction,
            consultorio: room,
            source,
        });
        if (!confirmed) return false;
    }

    if (queueStarUiState.practiceMode) {
        showToast(
            `Modo práctica: acción "${normalizedAction}" simulada en C${room}.`,
            'info'
        );
        registerQueuePracticeAction(normalizedAction, {
            source,
            consultorio: room,
            ticketId,
        });
        return true;
    }

    const success = await applyQueueTicketAction(
        ticketId,
        normalizedAction,
        room
    );
    if (success) {
        emitQueueOpsStationEvent('station_ticket_action', {
            source,
            action: normalizedAction,
            consultorio: room,
            ticketId,
        });
    }
    return success;
}

function handleQueueEscapeKey(event) {
    if (!isQueueSectionActive()) return false;
    if (queueStarUiState.onboardingVisible) {
        event.preventDefault();
        setQueueOnboardingVisible(false, {
            persist: true,
            source: 'keyboard_escape',
        });
        return true;
    }
    if (queueStarUiState.helpOpen) {
        event.preventDefault();
        setQueueHelpPanelOpen(false, {
            source: 'keyboard_escape',
            announce: false,
        });
        return true;
    }
    return false;
}

function blockQueueStationChange(
    attemptedConsultorio,
    { source = 'manual' } = {}
) {
    const attempted = normalizeQueueStationConsultorio(attemptedConsultorio, 0);
    showToast(
        `Cambio bloqueado por modo estación (C${queueStationState.consultorio}). Usa "Reconfigurar estación" para cambiar.`,
        'warning'
    );
    emitQueueOpsStationEvent('station_change_blocked', {
        source,
        attemptedConsultorio: attempted || null,
        stationConsultorio: queueStationState.consultorio,
        stationMode: queueStationState.mode,
    });
    syncQueueStationUi();
}

function selectQueueStationConsultorioViaNumpad(
    consultorio,
    { source = 'numpad' } = {}
) {
    const room = normalizeQueueStationConsultorio(consultorio, 0);
    if (![1, 2].includes(room)) return;
    if (isQueueStationLocked()) {
        blockQueueStationChange(room, { source });
        return;
    }
    setQueueStationConfig(
        {
            mode: QUEUE_STATION_MODE_FREE,
            consultorio: room,
        },
        {
            persist: true,
            announce: false,
            source,
        }
    );
    showToast(`Consultorio objetivo C${room}`, 'info');
}

async function runQueueCallNext(consultorio, { source = 'manual' } = {}) {
    const room = normalizeQueueStationConsultorio(consultorio, 0);
    if (![1, 2].includes(room)) {
        showToast('Consultorio invalido', 'error');
        return false;
    }

    const normalizedSource = String(source || 'manual').toLowerCase();
    const isNumpadSource = normalizedSource.startsWith('numpad');
    const enforceLock =
        isNumpadSource ||
        normalizedSource === 'shortcut' ||
        normalizedSource === 'command';

    if (!isQueueStationCallAllowed(room) && enforceLock) {
        blockQueueStationChange(room, { source });
        return false;
    }

    if (queueStarUiState.practiceMode) {
        showToast(`Modo práctica: llamada simulada en C${room}.`, 'info');
        registerQueuePracticeAction('call_next', {
            source,
            consultorio: room,
        });
        return true;
    }

    if (!isQueueStationCallAllowed(room) && isQueueStationLocked()) {
        showToast(
            `Estación bloqueada en C${queueStationState.consultorio}. Llamando manualmente C${room}.`,
            'warning'
        );
        emitQueueOpsStationEvent('station_manual_override', {
            source,
            consultorio: room,
            stationConsultorio: queueStationState.consultorio,
        });
    }

    if (isQueueStationLocked()) {
        emitQueueOpsStationEvent('station_locked_call', {
            source,
            consultorio: room,
        });
    }

    if (source === 'numpad') {
        showToast(`Llamando siguiente en C${room}`, 'info');
    }

    await callNextForConsultorio(room);
    window.requestAnimationFrame(() => {
        syncQueueStationUi();
    });
    return true;
}

async function runQueueOneTapAdvanceForStation({
    source = 'numpad_one_tap',
} = {}) {
    const room = normalizeQueueStationConsultorio(
        queueStationState.consultorio,
        0
    );
    if (![1, 2].includes(room)) {
        showToast('Consultorio de estación inválido', 'error');
        return false;
    }

    const now = Date.now();
    if (queueStarUiState.oneTapInFlight) {
        showToast('Flujo 1 tecla en proceso. Espera un momento.', 'warning');
        emitQueueOpsStationEvent('one_tap_blocked', {
            source,
            consultorio: room,
            reason: 'in_flight',
        });
        return false;
    }
    if (
        queueStarUiState.lastOneTapAt > 0 &&
        now - queueStarUiState.lastOneTapAt < QUEUE_ONE_TAP_COOLDOWN_MS
    ) {
        showToast(
            'Espera un segundo antes de volver a usar Numpad Enter.',
            'warning'
        );
        emitQueueOpsStationEvent('one_tap_blocked', {
            source,
            consultorio: room,
            reason: 'cooldown',
            cooldownMs: QUEUE_ONE_TAP_COOLDOWN_MS,
        });
        return false;
    }

    queueStarUiState.oneTapInFlight = true;
    try {
        const activeTicketId = getQueueActiveTicketIdForConsultorio(room);
        let completedInThisFlow = false;
        if (activeTicketId) {
            if (queueStarUiState.practiceMode) {
                emitQueueOpsStationEvent('practice_one_tap_simulated', {
                    source,
                    consultorio: room,
                    ticketId: activeTicketId,
                });
                registerQueuePracticeAction('completar', {
                    source,
                    consultorio: room,
                    ticketId: activeTicketId,
                });
            } else {
                const completed = await applyQueueTicketAction(
                    activeTicketId,
                    'completar',
                    room
                );
                if (!completed) return false;
                completedInThisFlow = true;
            }
        }

        const called = await runQueueCallNext(room, { source });
        if (called) {
            showToast(
                queueStarUiState.practiceMode
                    ? `Modo práctica 1 tecla en C${room}: completar + llamar simulado.`
                    : activeTicketId
                      ? `Flujo 1 tecla en C${room}: atención cerrada y siguiente llamado.`
                      : `Flujo 1 tecla en C${room}: llamando siguiente.`,
                queueStarUiState.practiceMode ? 'info' : 'success'
            );
            emitQueueOpsStationEvent('station_one_tap_executed', {
                source,
                consultorio: room,
                hadActiveTicket: Boolean(activeTicketId),
                completedInThisFlow,
                practiceMode: queueStarUiState.practiceMode,
            });
            queueStarUiState.lastOneTapAt = Date.now();
        }
        return called;
    } finally {
        queueStarUiState.oneTapInFlight = false;
    }
}

function syncHash(section) {
    const nextHash = `#${section}`;
    if (window.location.hash === nextHash) return;
    if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', nextHash);
        return;
    }
    window.location.hash = nextHash;
}

function normalizeCommandText(value) {
    return String(value || '')
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function formatRefreshAge(nowTimestamp) {
    if (!adminLastRefreshAt) return 'sin actualizar';
    const elapsedMs = Math.max(0, nowTimestamp - adminLastRefreshAt);
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    if (elapsedMinutes <= 0) return 'hace menos de 1 min';
    if (elapsedMinutes === 1) return 'hace 1 min';
    return `hace ${elapsedMinutes} min`;
}

function updateAdminRefreshStatus() {
    const statusEl = document.getElementById('adminRefreshStatus');
    if (!statusEl) return;

    statusEl.classList.remove('status-pill-live', 'status-pill-stale');

    if (!adminLastRefreshAt) {
        statusEl.classList.add('status-pill-muted');
        statusEl.textContent = 'Datos: sin actualizar';
        return;
    }

    const now = Date.now();
    const elapsedMs = Math.max(0, now - adminLastRefreshAt);
    const refreshAge = formatRefreshAge(now);
    const isStale = elapsedMs >= ADMIN_REFRESH_STALE_AFTER_MS;
    statusEl.classList.remove('status-pill-muted');
    statusEl.classList.add(isStale ? 'status-pill-stale' : 'status-pill-live');
    statusEl.textContent = `Datos: ${refreshAge}`;
}

function markAdminDataRefreshed() {
    adminLastRefreshAt = Date.now();
    updateAdminRefreshStatus();
}

function ensureAdminRefreshStatusTicker() {
    if (adminRefreshStatusTimerId) return;
    adminRefreshStatusTimerId = window.setInterval(() => {
        updateAdminRefreshStatus();
    }, ADMIN_REFRESH_STATUS_TICK_MS);
}

function focusAdminQuickCommand({ select = true } = {}) {
    const commandInput = document.getElementById('adminQuickCommand');
    if (!(commandInput instanceof HTMLInputElement)) {
        return false;
    }
    commandInput.focus({ preventScroll: true });
    if (select) {
        commandInput.select();
    }
    return true;
}

function createContextActionButton(actionDef) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'admin-context-action-btn';
    button.dataset.action = actionDef.action;
    if (actionDef.filterValue) {
        button.dataset.filterValue = actionDef.filterValue;
    }
    if (actionDef.targetSection) {
        button.dataset.targetSection = actionDef.targetSection;
    }
    if (actionDef.queueConsultorio) {
        button.dataset.queueConsultorio = actionDef.queueConsultorio;
    }
    button.title = actionDef.hint || actionDef.label;
    button.innerHTML = `<i class="fas ${actionDef.icon}" aria-hidden="true"></i><span>${actionDef.label}</span>`;
    return button;
}

function renderAdminContextActions(section) {
    const contextTitle = document.getElementById('adminContextTitle');
    const contextActions = document.getElementById('adminContextActions');
    if (!contextTitle || !contextActions) return;

    const normalizedSection =
        section && ADMIN_CONTEXT_ACTIONS[section] ? section : 'dashboard';
    const config = ADMIN_CONTEXT_ACTIONS[normalizedSection];
    contextTitle.textContent = config.title;
    contextActions.innerHTML = '';
    config.actions.forEach((actionDef) => {
        contextActions.appendChild(createContextActionButton(actionDef));
    });
    syncQueueStationUi();
}

function getSidebarShellElements() {
    return {
        sidebar: document.getElementById('adminSidebar'),
        backdrop: document.getElementById('adminSidebarBackdrop'),
        toggleBtn: document.getElementById('adminMenuToggle'),
    };
}

function getSidebarFocusableElements() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return [];

    return Array.from(
        sidebar.querySelectorAll(SIDEBAR_FOCUSABLE_SELECTOR)
    ).filter((element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (element.hasAttribute('disabled')) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;
        if (element.closest('.is-hidden')) return false;
        if (element.getClientRects().length === 0) return false;
        if (element.offsetWidth === 0 && element.offsetHeight === 0) {
            return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        return true;
    });
}

function syncSidebarOverlayA11yState(isOpen) {
    const sidebar = document.getElementById('adminSidebar');
    const mainContent = document.getElementById('adminMainContent');
    const compactViewport = isCompactAdminViewport();
    const overlayOpen = Boolean(compactViewport && isOpen);

    if (sidebar) {
        sidebar.setAttribute(
            'aria-hidden',
            String(!overlayOpen && compactViewport)
        );
    }

    if (mainContent) {
        if (overlayOpen) {
            mainContent.setAttribute('aria-hidden', 'true');
        } else {
            mainContent.removeAttribute('aria-hidden');
        }
    }
}

function focusSidebarPrimaryTarget() {
    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const activeNavItem = sidebar.querySelector('.nav-item.active');
    if (activeNavItem instanceof HTMLElement) {
        activeNavItem.scrollIntoView({ block: 'nearest' });
        activeNavItem.focus();
        return;
    }

    const focusableElements = getSidebarFocusableElements();
    if (focusableElements[0] instanceof HTMLElement) {
        focusableElements[0].focus();
        return;
    }

    sidebar.focus();
}

function trapSidebarFocus(event) {
    if (event.key !== 'Tab') return;
    if (!isCompactAdminViewport() || !isSidebarOpen()) return;

    const sidebar = document.getElementById('adminSidebar');
    if (!sidebar) return;

    const focusableElements = getSidebarFocusableElements();
    if (focusableElements.length === 0) {
        event.preventDefault();
        sidebar.focus();
        return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    const isFocusInsideSidebar =
        activeElement instanceof HTMLElement && sidebar.contains(activeElement);

    if (!isFocusInsideSidebar) {
        event.preventDefault();
        (event.shiftKey ? lastElement : firstElement).focus();
        return;
    }

    if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
    }

    if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function setSidebarOpen(isOpen) {
    const { sidebar, backdrop, toggleBtn } = getSidebarShellElements();
    if (!sidebar || !backdrop || !toggleBtn) return;

    const shouldOpen = Boolean(isOpen && isCompactAdminViewport());
    sidebar.classList.toggle('is-open', shouldOpen);
    backdrop.classList.toggle('is-hidden', !shouldOpen);
    backdrop.setAttribute('aria-hidden', String(!shouldOpen));
    document.body.classList.toggle('admin-sidebar-open', shouldOpen);
    toggleBtn.setAttribute('aria-expanded', String(shouldOpen));
    syncSidebarOverlayA11yState(shouldOpen);

    if (shouldOpen) {
        focusSidebarPrimaryTarget();
    }
}

function closeSidebar({ restoreFocus = false } = {}) {
    const { toggleBtn } = getSidebarShellElements();
    const wasOpen = document
        .getElementById('adminSidebar')
        ?.classList.contains('is-open');
    setSidebarOpen(false);
    if (restoreFocus && wasOpen && toggleBtn) {
        toggleBtn.focus();
    }
}

function handleAdminKeyboardShortcuts(event) {
    const dashboard = document.getElementById('adminDashboard');
    if (!dashboard || dashboard.classList.contains('is-hidden')) return;
    const isTyping = isTypingContextTarget(event.target);
    const key = String(event.key || '').toLowerCase();
    const code = String(event.code || '').toLowerCase();

    if (
        (event.ctrlKey || event.metaKey) &&
        key === 'k' &&
        !event.altKey &&
        !event.shiftKey
    ) {
        event.preventDefault();
        focusAdminQuickCommand();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isAppointmentsSectionActive() &&
        !isTyping
    ) {
        event.preventDefault();
        focusAppointmentSearch();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isCallbacksSectionActive() &&
        !isTyping
    ) {
        event.preventDefault();
        focusCallbackSearch();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        isAvailabilitySectionActive() &&
        !isTyping
    ) {
        event.preventDefault();
        focusAvailabilityTimeInput();
        return;
    }

    if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !isTyping
    ) {
        event.preventDefault();
        focusAdminQuickCommand();
        return;
    }

    if (
        isQueueSectionActive() &&
        !isTyping &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
    ) {
        if (queueStarUiState.captureCallKeyMode) {
            event.preventDefault();
            captureQueueCallKeyFromEvent(event, {
                source: 'capture_keyboard',
            });
            return;
        }
        if (event.repeat) return;

        if (isQueueNumpadZeroEvent(event)) {
            event.preventDefault();
            toggleQueueHelpPanel({ source: 'numpad', announce: true });
            return;
        }
        if (isQueueNumpadAddEvent(event)) {
            event.preventDefault();
            void runQueueStationTicketAction('re-llamar', {
                source: 'numpad_add',
            });
            return;
        }
        if (isQueueNumpadDecimalEvent(event)) {
            event.preventDefault();
            void runQueueStationTicketAction('completar', {
                source: 'numpad_decimal',
            });
            return;
        }
        if (isQueueNumpadSubtractEvent(event)) {
            event.preventDefault();
            void runQueueStationTicketAction('no_show', {
                source: 'numpad_subtract',
            });
            return;
        }
        if (isQueueNumpadDigitEvent(event, 1)) {
            event.preventDefault();
            selectQueueStationConsultorioViaNumpad(1, { source: 'numpad' });
            return;
        }
        if (isQueueNumpadDigitEvent(event, 2)) {
            event.preventDefault();
            selectQueueStationConsultorioViaNumpad(2, { source: 'numpad' });
            return;
        }
        if (isQueueNumpadEnterEvent(event)) {
            event.preventDefault();
            if (queueStationState.oneTapAdvance) {
                void runQueueOneTapAdvanceForStation({
                    source: 'numpad_one_tap',
                });
            } else {
                void runQueueCallNext(queueStationState.consultorio, {
                    source: 'numpad',
                });
            }
            return;
        }
    }

    if (!event.altKey || !event.shiftKey) return;
    if (isTyping) return;

    if (code === 'keyr') {
        event.preventDefault();
        void refreshAdminDataAndRender({ showSuccessToast: true });
        return;
    }

    if (key === 'm' || code === 'keym') {
        event.preventDefault();
        if (isCompactAdminViewport()) {
            setSidebarOpen(!isSidebarOpen());
            return;
        }
        setSidebarCollapsed(!isSidebarCollapsed());
        return;
    }

    if (isAvailabilitySectionActive()) {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            changeMonth(-1);
            return;
        }
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            changeMonth(1);
            return;
        }
        if (code === 'keyy') {
            event.preventDefault();
            jumpAvailabilityToToday();
            return;
        }
        if (code === 'keys') {
            event.preventDefault();
            jumpAvailabilityToNextWithSlots();
            return;
        }
        if (code === 'keyd') {
            event.preventDefault();
            void duplicateAvailabilityDayToNext();
            return;
        }
        if (code === 'keyw') {
            event.preventDefault();
            void duplicateAvailabilityDayToNextWeek();
            return;
        }
        if (code === 'keyv') {
            event.preventDefault();
            void pasteAvailabilityDay();
            return;
        }
        if (code === 'keyx') {
            event.preventDefault();
            void clearAvailabilityDay();
            return;
        }
        if (code === 'keyq') {
            event.preventDefault();
            void clearAvailabilityWeek();
            return;
        }
        if (code === 'keyg') {
            event.preventDefault();
            void saveAvailabilityDraft();
            return;
        }
        if (code === 'keyz') {
            event.preventDefault();
            discardAvailabilityDraft();
            return;
        }
    }

    if (isQueueSectionActive()) {
        if (code === 'digit0' || code === 'numpad0') {
            event.preventDefault();
            toggleQueueHelpPanel({ source: 'shortcut', announce: false });
            return;
        }
        if (code === 'keyj') {
            event.preventDefault();
            void runQueueCallNext(1, { source: 'shortcut' });
            return;
        }
        if (code === 'keyk') {
            event.preventDefault();
            void runQueueCallNext(2, { source: 'shortcut' });
            return;
        }
        if (code === 'keyu') {
            event.preventDefault();
            void refreshQueueRealtime({ silent: false });
            return;
        }
        if (code === 'keye') {
            event.preventDefault();
            setQueueOneTapAdvanceEnabled(!queueStationState.oneTapAdvance, {
                persist: true,
                announce: true,
                source: 'shortcut',
            });
            return;
        }
        if (code === 'keyf') {
            event.preventDefault();
            focusQueueSearch();
            return;
        }
        if (code === 'keyl') {
            event.preventDefault();
            setQueueFilter('sla_risk');
            return;
        }
        if (code === 'keyw') {
            event.preventDefault();
            setQueueFilter('waiting');
            return;
        }
        if (code === 'keyc') {
            event.preventDefault();
            setQueueFilter('called');
            return;
        }
        if (code === 'keya') {
            event.preventDefault();
            setQueueFilter('all');
            return;
        }
        if (code === 'keyi') {
            event.preventDefault();
            setQueueFilter('walk_in');
            return;
        }
        if (code === 'keyo') {
            event.preventDefault();
            setQueueFilter('all');
            return;
        }
        if (code === 'keyg') {
            event.preventDefault();
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_completar', {
                    source: 'shortcut',
                });
                return;
            }
            void runQueueBulkAction('completar');
            return;
        }
        if (code === 'keyh') {
            event.preventDefault();
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_no_show', {
                    source: 'shortcut',
                });
                return;
            }
            void runQueueBulkAction('no_show');
            return;
        }
        if (code === 'keyb') {
            event.preventDefault();
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_cancelar', {
                    source: 'shortcut',
                });
                return;
            }
            void runQueueBulkAction('cancelar');
            return;
        }
        if (code === 'keyp') {
            event.preventDefault();
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_reprint', {
                    source: 'shortcut',
                });
                return;
            }
            void runQueueBulkReprint();
            return;
        }
    }

    const appointmentShortcutFilters = {
        keya: 'all',
        keyh: 'today',
        keyt: 'pending_transfer',
        keyn: 'no_show',
    };
    const quickFilter = appointmentShortcutFilters[code] || null;
    if (quickFilter) {
        event.preventDefault();
        void navigateToAppointmentsWithQuickFilter(quickFilter);
        return;
    }

    const callbackShortcutFilters = {
        keyp: 'pending',
        keyc: 'contacted',
    };
    const callbackQuickFilter = callbackShortcutFilters[code] || null;
    if (callbackQuickFilter) {
        event.preventDefault();
        void navigateToCallbacksWithQuickFilter(callbackQuickFilter);
        return;
    }

    const targetSection =
        ADMIN_SECTION_SHORTCUTS.get(code) || ADMIN_SECTION_SHORTCUTS.get(key);
    if (!targetSection) return;

    event.preventDefault();
    void navigateToSection(targetSection);
}

function focusSection(section, { preventScroll = true } = {}) {
    const sectionEl = document.getElementById(section);
    if (!sectionEl) return;
    if (!sectionEl.hasAttribute('tabindex')) {
        sectionEl.setAttribute('tabindex', '-1');
    }
    window.requestAnimationFrame(() => {
        if (typeof sectionEl.focus === 'function') {
            sectionEl.focus({ preventScroll });
        }
    });
}

async function navigateToSection(section, options = {}) {
    const {
        refresh = true,
        updateHash = true,
        focus = true,
        closeMobileNav = true,
    } = options;
    const currentSection = normalizeAdminSection(
        getActiveSection(),
        'dashboard'
    );
    const targetSection = normalizeAdminSection(section, 'dashboard');

    if (
        currentSection === 'availability' &&
        targetSection !== 'availability' &&
        hasAvailabilityDraftChanges()
    ) {
        const shouldDiscardPendingChanges = confirm(
            'Tienes cambios pendientes en disponibilidad sin guardar. Si continuas se mantendran como borrador. Deseas salir de esta seccion?'
        );
        if (!shouldDiscardPendingChanges) {
            setNavActive(currentSection);
            if (!updateHash) {
                syncHash(currentSection);
            }
            if (focus) {
                focusSection(currentSection);
            }
            return false;
        }
    }

    setNavActive(targetSection);

    if (closeMobileNav) {
        closeSidebar();
    }

    if (refresh) {
        try {
            await refreshData();
            markAdminDataRefreshed();
        } catch (error) {
            showToast(
                `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
                'warning'
            );
        }
    }

    await renderSection(targetSection);

    if (updateHash) {
        syncHash(targetSection);
    }

    if (focus) {
        focusSection(targetSection);
    }

    return true;
}

async function navigateToAppointmentsWithQuickFilter(filter) {
    await navigateToSection('appointments', { focus: false });
    applyAppointmentQuickFilter(filter, { preserveSearch: false });
    focusSection('appointments');
}

async function navigateToCallbacksWithQuickFilter(filter) {
    await navigateToSection('callbacks', { focus: false });
    applyCallbackQuickFilter(filter, { preserveSearch: false });
    focusSection('callbacks');
}

async function refreshAdminDataAndRender({
    showSuccessToast = false,
    showErrorToast = true,
} = {}) {
    try {
        await refreshData();
        markAdminDataRefreshed();
        await renderSection(getActiveSection());
        if (showSuccessToast) {
            showToast('Datos actualizados', 'success');
        }
        return true;
    } catch (error) {
        if (showErrorToast) {
            showToast(
                `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
                'warning'
            );
        }
        return false;
    }
}

async function runAdminQuickCommand(rawCommand) {
    const commandInput = document.getElementById('adminQuickCommand');
    const command = normalizeCommandText(rawCommand);
    if (!command) {
        showToast(
            'Escribe un comando. Ejemplo: "citas hoy" o "callbacks pendientes".',
            'info'
        );
        focusAdminQuickCommand();
        return false;
    }

    if (command === 'help' || command === 'ayuda') {
        showToast(
            'Comandos: citas hoy, citas por validar, callbacks pendientes, turnero c1/c2, turnero 1 tecla, turnero sla, disponibilidad hoy, exportar csv.',
            'info'
        );
        return true;
    }

    if (command.includes('exportar') && command.includes('csv')) {
        await navigateToSection('appointments', { focus: false });
        exportAppointmentsCSV();
        focusSection('appointments');
        return true;
    }

    if (command.includes('dashboard') || command.includes('inicio')) {
        await navigateToSection('dashboard');
        return true;
    }

    if (
        command.includes('turnero') ||
        command.includes('cola') ||
        command.includes('consultorio')
    ) {
        await navigateToSection('queue', { focus: false });
        if (
            command.includes('1 tecla on') ||
            command.includes('modo 1 tecla on') ||
            command.includes('one tap on')
        ) {
            setQueueOneTapAdvanceEnabled(true, {
                persist: true,
                announce: true,
                source: 'command',
            });
        } else if (
            command.includes('1 tecla off') ||
            command.includes('modo 1 tecla off') ||
            command.includes('one tap off')
        ) {
            setQueueOneTapAdvanceEnabled(false, {
                persist: true,
                announce: true,
                source: 'command',
            });
        } else if (
            command.includes('1 tecla') ||
            command.includes('one tap') ||
            command.includes('modo express')
        ) {
            setQueueOneTapAdvanceEnabled(!queueStationState.oneTapAdvance, {
                persist: true,
                announce: true,
                source: 'command',
            });
        } else if (
            command.includes('c1') ||
            command.includes('consultorio 1')
        ) {
            await runQueueCallNext(1, { source: 'command' });
        } else if (
            command.includes('completar visibles') ||
            command.includes('bulk completar')
        ) {
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_completar', {
                    source: 'command',
                });
            } else {
                await runQueueBulkAction('completar');
            }
        } else if (
            command.includes('no show visibles') ||
            command.includes('bulk no show')
        ) {
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_no_show', {
                    source: 'command',
                });
            } else {
                await runQueueBulkAction('no_show');
            }
        } else if (
            command.includes('cancelar visibles') ||
            command.includes('bulk cancelar')
        ) {
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_cancelar', {
                    source: 'command',
                });
            } else {
                await runQueueBulkAction('cancelar');
            }
        } else if (
            command.includes('reimprimir visibles') ||
            command.includes('bulk reprint')
        ) {
            if (queueStarUiState.practiceMode) {
                simulateQueuePracticeAction('bulk_reprint', {
                    source: 'command',
                });
            } else {
                await runQueueBulkReprint();
            }
        } else if (command.includes('sla')) {
            setQueueFilter('sla_risk');
            focusQueueSearch();
        } else if (command.includes('buscar')) {
            focusQueueSearch();
        } else if (
            command.includes('c2') ||
            command.includes('consultorio 2')
        ) {
            await runQueueCallNext(2, { source: 'command' });
        } else {
            await refreshQueueRealtime({ silent: true });
        }
        focusSection('queue');
        return true;
    }

    if (command.includes('resena') || command.includes('review')) {
        await navigateToSection('reviews');
        return true;
    }

    if (command.includes('callback')) {
        await navigateToCallbacksWithQuickFilter(
            command.includes('hoy')
                ? 'today'
                : command.includes('contactado')
                  ? 'contacted'
                  : 'pending'
        );
        return true;
    }

    if (command.includes('cita') || command.includes('agenda')) {
        const quickFilter = command.includes('hoy')
            ? 'today'
            : command.includes('validar') ||
                command.includes('transferencia') ||
                command.includes('por validar')
              ? 'pending_transfer'
              : command.includes('no show') || command.includes('no asistio')
                ? 'no_show'
                : 'all';
        await navigateToAppointmentsWithQuickFilter(quickFilter);
        if (command.includes('limpiar')) {
            resetAppointmentFilters();
        }
        return true;
    }

    if (
        command.includes('disponibilidad') ||
        command.includes('horario') ||
        command.includes('calendario')
    ) {
        await navigateToSection('availability', { focus: false });
        if (command.includes('hoy')) {
            jumpAvailabilityToToday();
        } else if (command.includes('siguiente')) {
            jumpAvailabilityToNextWithSlots();
        } else if (
            command.includes('agregar') ||
            command.includes('nuevo horario')
        ) {
            focusAvailabilityTimeInput();
        }
        focusSection('availability');
        return true;
    }

    if (
        command.includes('actualizar') ||
        command.includes('refrescar') ||
        command === 'refresh'
    ) {
        await refreshAdminDataAndRender({ showSuccessToast: true });
        return true;
    }

    showToast(
        'Comando no reconocido. Usa "ayuda" para ver ejemplos disponibles.',
        'warning'
    );
    if (commandInput instanceof HTMLInputElement) {
        commandInput.focus({ preventScroll: true });
        commandInput.select();
    }
    return false;
}

/**
 * Renders the specified section of the admin dashboard.
 * Loads the necessary data and updates the UI.
 *
 * @param {string} section - The section ID to render (e.g., 'dashboard', 'appointments').
 */
async function renderSection(section) {
    const titles = {
        dashboard: 'Dashboard',
        appointments: 'Citas',
        callbacks: 'Callbacks',
        reviews: 'Resenas',
        availability: 'Disponibilidad',
        queue: 'Turnero Sala',
    };
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = titles[section] || 'Dashboard';
    renderAdminContextActions(section);

    document
        .querySelectorAll('.admin-section')
        .forEach((s) => s.classList.remove('active'));
    const sectionEl = document.getElementById(section);
    if (sectionEl) sectionEl.classList.add('active');

    if (section !== 'queue') {
        stopQueueRealtimeSync({ reason: 'paused' });
        setQueueCallKeyCaptureMode(false, {
            source: 'section_change',
            announce: false,
        });
    }

    switch (section) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'appointments': {
            loadAppointments();
            break;
        }
        case 'callbacks':
            loadCallbacks();
            break;
        case 'reviews':
            loadReviews();
            break;
        case 'availability': {
            await initAvailabilityCalendar();
            break;
        }
        case 'queue': {
            loadQueueSection();
            startQueueRealtimeSync({ immediate: true });
            syncQueueStationUi();
            syncQueueHelpPanel();
            maybeShowQueueOnboarding();
            break;
        }
        default:
            loadDashboardData();
            break;
    }
}

/**
 * Shows the login screen and hides the dashboard.
 */
function showLogin() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    stopQueueRealtimeSync({ reason: 'paused' });
    setQueueCallKeyCaptureMode(false, { source: 'logout', announce: false });
    stopQueuePracticeTicker();
    queueStarUiState.practiceMode = false;
    queueStarUiState.practiceState = null;
    syncQueuePracticeModeUi();
    closeSidebar();
    if (loginScreen) loginScreen.classList.remove('is-hidden');
    if (dashboard) dashboard.classList.add('is-hidden');
}

/**
 * Shows the dashboard and hides the login screen.
 * Initializes data loading and push notifications.
 */
async function showDashboard() {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('adminDashboard');
    if (loginScreen) loginScreen.classList.add('is-hidden');
    if (dashboard) dashboard.classList.remove('is-hidden');
    const preferredSection = resolvePreferredSection();
    setNavActive(preferredSection);
    syncHash(preferredSection);
    syncSidebarLayoutMode();
    closeSidebar();
    await updateDate();
    await initPushNotifications();
}

/**
 * Handles the login form submission.
 * Supports standard password login and 2FA.
 *
 * @param {Event} event - The form submission event.
 */
async function handleLogin(event) {
    event.preventDefault();

    const group2FA = document.getElementById('group2FA');
    const is2FAMode = group2FA && !group2FA.classList.contains('is-hidden');

    if (is2FAMode) {
        const code = document.getElementById('admin2FACode')?.value || '';
        try {
            const result = await login2FA(code);
            if (result.csrfToken) setCsrfToken(result.csrfToken);
            showToast('Bienvenido al panel de administración', 'success');
            await showDashboard();
        } catch {
            showToast('Código incorrecto o sesión expirada', 'error');
        }
        return;
    }

    const password = document.getElementById('adminPassword')?.value || '';
    try {
        const loginResult = await login(password);

        if (loginResult.twoFactorRequired) {
            document
                .getElementById('passwordGroup')
                ?.classList.add('is-hidden');
            group2FA?.classList.remove('is-hidden');
            document.getElementById('admin2FACode')?.focus();
            const btn = document.getElementById('loginBtn');
            if (btn) btn.innerHTML = '<i class="fas fa-check"></i> Verificar';
            showToast('Ingresa tu código 2FA', 'info');
            return;
        }

        if (loginResult.csrfToken) setCsrfToken(loginResult.csrfToken);
        showToast('Bienvenido al panel de administración', 'success');
        await showDashboard();
    } catch {
        showToast('Contraseña incorrecta', 'error');
    }
}

/**
 * Checks authentication status on boot.
 * If authenticated, shows the dashboard; otherwise, shows the login screen.
 * Handles offline mode by loading local data.
 */
async function checkAuthAndBoot() {
    if (!navigator.onLine && getLocalData('appointments', null)) {
        showToast('Modo offline: mostrando datos locales', 'info');
        await showDashboard();
        return;
    }

    const authenticated = await checkAuth();
    if (authenticated) {
        await showDashboard();
        return;
    }
    showLogin();
}

/**
 * Updates the current date display and refreshes the data.
 */
async function updateDate() {
    const dateEl = document.getElementById('currentDate');
    if (dateEl) {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        };
        dateEl.textContent = new Date().toLocaleDateString('es-EC', options);
    }

    try {
        await refreshData();
        markAdminDataRefreshed();
    } catch (error) {
        showToast(
            `No se pudo actualizar datos en vivo: ${error?.message || 'error desconocido'}`,
            'warning'
        );
    }
    const section = getActiveSection();
    await renderSection(section);
}

/**
 * Exports the current application data (appointments, callbacks, reviews, availability) to a JSON file.
 */
function exportData() {
    const payload = {
        appointments: currentAppointments,
        callbacks: currentCallbacks,
        reviews: currentReviews,
        queue_tickets: currentQueueTickets,
        availability: currentAvailability,
        exportDate: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `piel-en-armonia-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Datos exportados correctamente', 'success');
}

/**
 * Imports application data from a JSON file.
 * Replaces existing data with the imported data.
 *
 * @param {HTMLInputElement} input - The file input element containing the JSON file.
 */
async function importData(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    input.value = '';

    if (
        !confirm(
            'Esto reemplazara TODOS los datos actuales con los del archivo seleccionado.\n\nDeseas continuar?'
        )
    ) {
        return;
    }

    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data || typeof data !== 'object') {
            throw new Error('El archivo no contiene datos validos');
        }

        const payload = {
            appointments: Array.isArray(data.appointments)
                ? data.appointments
                : [],
            callbacks: Array.isArray(data.callbacks) ? data.callbacks : [],
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            queue_tickets: Array.isArray(data.queue_tickets)
                ? data.queue_tickets
                : [],
            availability:
                data.availability && typeof data.availability === 'object'
                    ? data.availability
                    : {},
        };

        await apiRequest('import', {
            method: 'POST',
            body: payload,
        });

        await refreshData();
        markAdminDataRefreshed();
        const activeItem = document.querySelector('.nav-item.active');
        await renderSection(activeItem?.dataset.section || 'dashboard');
        showToast(
            `Datos importados: ${payload.appointments.length} citas`,
            'success'
        );
    } catch (error) {
        showToast(`Error al importar: ${error.message}`, 'error');
    }
}

function attachGlobalListeners() {
    document.addEventListener('click', async (event) => {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.dataset.action;

        if (action === 'close-toast') {
            actionEl.closest('.toast')?.remove();
            return;
        }

        if (action === 'logout') {
            event.preventDefault();
            await logout();
            return;
        }

        if (action === 'export-data') {
            event.preventDefault();
            exportData();
            return;
        }

        if (action === 'open-import-file') {
            event.preventDefault();
            document.getElementById('importFileInput')?.click();
            return;
        }

        if (action === 'set-admin-theme') {
            event.preventDefault();
            setAdminThemeMode(actionEl.dataset.themeMode || 'system');
            return;
        }

        if (action === 'toggle-sidebar-collapse') {
            event.preventDefault();
            if (isCompactAdminViewport()) {
                setSidebarOpen(!isSidebarOpen());
                return;
            }
            setSidebarCollapsed(!isSidebarCollapsed());
            return;
        }

        if (action === 'run-admin-command') {
            event.preventDefault();
            const commandInput = document.getElementById('adminQuickCommand');
            await runAdminQuickCommand(
                commandInput instanceof HTMLInputElement
                    ? commandInput.value
                    : ''
            );
            return;
        }

        if (action === 'refresh-admin-data') {
            event.preventDefault();
            await refreshAdminDataAndRender({ showSuccessToast: true });
            return;
        }

        if (action === 'context-open-dashboard') {
            event.preventDefault();
            await navigateToSection('dashboard');
            return;
        }

        if (action === 'context-open-appointments-today') {
            event.preventDefault();
            await navigateToAppointmentsWithQuickFilter('today');
            return;
        }

        if (action === 'context-open-appointments-transfer') {
            event.preventDefault();
            await navigateToAppointmentsWithQuickFilter('pending_transfer');
            return;
        }

        if (action === 'context-open-callbacks-pending') {
            event.preventDefault();
            await navigateToCallbacksWithQuickFilter('pending');
            return;
        }

        if (action === 'context-open-callbacks-next') {
            event.preventDefault();
            await navigateToCallbacksWithQuickFilter('pending');
            focusNextPendingCallback();
            return;
        }

        if (action === 'queue-refresh-state') {
            event.preventDefault();
            await refreshQueueRealtime({ silent: false });
            syncQueueStationUi();
            return;
        }

        if (action === 'queue-lock-station') {
            event.preventDefault();
            const targetConsultorio = normalizeQueueStationConsultorio(
                actionEl.dataset.queueConsultorio || 0,
                0
            );
            if (![1, 2].includes(targetConsultorio)) return;
            setQueueStationConfig(
                {
                    mode: QUEUE_STATION_MODE_LOCKED,
                    consultorio: targetConsultorio,
                },
                { persist: true, announce: true, source: 'station_panel' }
            );
            return;
        }

        if (action === 'queue-set-station-mode') {
            event.preventDefault();
            const targetMode = normalizeQueueStationMode(
                actionEl.dataset.queueMode || QUEUE_STATION_MODE_FREE,
                QUEUE_STATION_MODE_FREE
            );
            setQueueStationConfig(
                {
                    mode: targetMode,
                    consultorio: queueStationState.consultorio,
                },
                { persist: true, announce: true, source: 'station_panel' }
            );
            return;
        }

        if (action === 'queue-reconfigure-station') {
            event.preventDefault();
            const confirmPrimary = confirm(
                'Reconfigurar estación desbloqueará el consultorio fijo. ¿Deseas continuar?'
            );
            if (!confirmPrimary) return;
            const confirmSecondary = confirm(
                'Confirmación final: la estación pasará a modo libre.'
            );
            if (!confirmSecondary) return;
            setQueueStationConfig(
                {
                    mode: QUEUE_STATION_MODE_FREE,
                    consultorio: queueStationState.consultorio,
                },
                {
                    persist: true,
                    announce: true,
                    source: 'station_reconfigure',
                }
            );
            showToast(
                'Modo libre activo. Usa Numpad 1/2 y luego bloquea la estación.',
                'warning'
            );
            return;
        }

        if (action === 'queue-toggle-shortcuts') {
            event.preventDefault();
            toggleQueueHelpPanel({ source: 'button', announce: false });
            return;
        }

        if (action === 'queue-open-onboarding') {
            event.preventDefault();
            setQueueOnboardingVisible(true, {
                persist: false,
                source: 'station_panel_button',
            });
            return;
        }

        if (action === 'queue-toggle-one-tap') {
            event.preventDefault();
            setQueueOneTapAdvanceEnabled(!queueStationState.oneTapAdvance, {
                persist: true,
                announce: true,
                source: 'station_panel_button',
            });
            return;
        }

        if (action === 'queue-capture-call-key') {
            event.preventDefault();
            setQueueCallKeyCaptureMode(!queueStarUiState.captureCallKeyMode, {
                source: 'station_panel_button',
                announce: true,
            });
            return;
        }

        if (action === 'queue-clear-call-key') {
            event.preventDefault();
            if (!queueStarUiState.customCallKey) return;
            const confirmClear = window.confirm(
                `Se eliminará la tecla externa (${describeQueueCallKeyBinding(
                    queueStarUiState.customCallKey
                )}). ¿Deseas continuar?`
            );
            if (!confirmClear) return;
            setQueueCustomCallKeyBinding(null, {
                persist: true,
                announce: true,
                source: 'station_panel_button',
            });
            setQueueCallKeyCaptureMode(false, {
                source: 'station_panel_button_clear',
                announce: false,
            });
            return;
        }

        if (action === 'queue-start-practice') {
            event.preventDefault();
            setQueueOnboardingVisible(false, {
                persist: false,
                source: 'practice_start',
            });
            setQueuePracticeMode(true, { source: 'practice_start' });
            setQueueHelpPanelOpen(true, {
                source: 'practice_start',
                announce: false,
            });
            showToast(
                'Modo práctica activo: simulación local, no se enviarán cambios a la cola real.',
                'info'
            );
            emitQueueOpsStationEvent('onboarding_practice_started', {
                stationMode: queueStationState.mode,
                consultorio: queueStationState.consultorio,
            });
            return;
        }

        if (action === 'queue-reset-practice') {
            event.preventDefault();
            if (!queueStarUiState.practiceMode) {
                showToast(
                    'Activa modo práctica para reiniciar el entrenamiento.',
                    'warning'
                );
                return;
            }
            resetQueuePracticeProgress({
                source: 'practice_reset_button',
                announce: true,
            });
            return;
        }

        if (action === 'queue-stop-practice') {
            event.preventDefault();
            setQueuePracticeMode(false, { source: 'practice_stop_button' });
            showToast(
                'Modo práctica desactivado. Operación real reanudada.',
                'success'
            );
            return;
        }

        if (action === 'queue-dismiss-onboarding') {
            event.preventDefault();
            const completedCount = getQueueOnboardingProgressCount();
            const totalSteps = QUEUE_ONBOARDING_STEPS.length;
            if (completedCount < totalSteps) {
                const confirmDismiss = window.confirm(
                    `La guía aún no está completa (${completedCount}/${totalSteps}). ¿Deseas cerrarla de todos modos?`
                );
                if (!confirmDismiss) return;
            }
            setQueueOnboardingVisible(false, {
                persist: true,
                source: 'onboarding_button',
            });
            showToast('Guía inicial completada', 'success');
            return;
        }

        if (action === 'queue-call-next') {
            event.preventDefault();
            await runQueueCallNext(
                Number(actionEl.dataset.queueConsultorio || 0),
                { source: 'button' }
            );
            return;
        }

        if (action === 'context-focus-slot-input') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            focusAvailabilityTimeInput();
            return;
        }

        if (action === 'context-availability-today') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            jumpAvailabilityToToday();
            return;
        }

        if (action === 'context-availability-next') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            jumpAvailabilityToNextWithSlots();
            return;
        }

        if (action === 'context-copy-availability-day') {
            event.preventDefault();
            await navigateToSection('availability', { focus: false });
            copyAvailabilityDay();
            return;
        }

        try {
            if (action === 'export-csv') {
                event.preventDefault();
                exportAppointmentsCSV();
                return;
            }
            if (action === 'appointment-quick-filter') {
                event.preventDefault();
                applyAppointmentQuickFilter(
                    actionEl.dataset.filterValue || 'all'
                );
                return;
            }
            if (action === 'callback-quick-filter') {
                event.preventDefault();
                applyCallbackQuickFilter(actionEl.dataset.filterValue || 'all');
                return;
            }
            if (action === 'callbacks-triage-next') {
                event.preventDefault();
                await navigateToCallbacksWithQuickFilter('pending');
                focusNextPendingCallback();
                return;
            }
            if (action === 'clear-appointment-filters') {
                event.preventDefault();
                resetAppointmentFilters();
                return;
            }
            if (action === 'clear-callback-filters') {
                event.preventDefault();
                resetCallbackFilters();
                return;
            }
            if (action === 'appointment-density') {
                event.preventDefault();
                setAppointmentDensity(
                    actionEl.dataset.density || 'comfortable'
                );
                return;
            }
            if (action === 'change-month') {
                event.preventDefault();
                changeMonth(Number(actionEl.dataset.delta || 0));
                return;
            }
            if (action === 'availability-today') {
                event.preventDefault();
                jumpAvailabilityToToday();
                return;
            }
            if (action === 'availability-next-with-slots') {
                event.preventDefault();
                jumpAvailabilityToNextWithSlots();
                return;
            }
            if (action === 'prefill-time-slot') {
                event.preventDefault();
                prefillTimeSlot(actionEl.dataset.time || '');
                return;
            }
            if (action === 'copy-availability-day') {
                event.preventDefault();
                copyAvailabilityDay();
                return;
            }
            if (action === 'paste-availability-day') {
                event.preventDefault();
                await pasteAvailabilityDay();
                return;
            }
            if (action === 'duplicate-availability-day-next') {
                event.preventDefault();
                await duplicateAvailabilityDayToNext();
                return;
            }
            if (action === 'duplicate-availability-next-week') {
                event.preventDefault();
                await duplicateAvailabilityDayToNextWeek();
                return;
            }
            if (action === 'clear-availability-day') {
                event.preventDefault();
                await clearAvailabilityDay();
                return;
            }
            if (action === 'clear-availability-week') {
                event.preventDefault();
                await clearAvailabilityWeek();
                return;
            }
            if (action === 'save-availability-draft') {
                event.preventDefault();
                await saveAvailabilityDraft();
                return;
            }
            if (action === 'discard-availability-draft') {
                event.preventDefault();
                discardAvailabilityDraft();
                return;
            }
            if (action === 'add-time-slot') {
                event.preventDefault();
                await addTimeSlot();
                return;
            }
            if (action === 'remove-time-slot') {
                event.preventDefault();
                await removeTimeSlot(
                    decodeURIComponent(actionEl.dataset.date || ''),
                    decodeURIComponent(actionEl.dataset.time || '')
                );
                return;
            }
            if (action === 'approve-transfer') {
                event.preventDefault();
                await approveTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'reject-transfer') {
                event.preventDefault();
                await rejectTransfer(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'cancel-appointment') {
                event.preventDefault();
                await cancelAppointment(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-no-show') {
                event.preventDefault();
                await markNoShow(Number(actionEl.dataset.id || 0));
                return;
            }
            if (action === 'mark-contacted') {
                event.preventDefault();
                await markContacted(
                    Number(actionEl.dataset.callbackId || 0),
                    actionEl.dataset.callbackDate || ''
                );
                return;
            }
            if (action === 'queue-ticket-action') {
                event.preventDefault();
                if (queueStarUiState.practiceMode) {
                    simulateQueuePracticeAction(
                        String(actionEl.dataset.queueAction || 'ticket_action'),
                        {
                            source: 'button',
                            consultorio:
                                Number(
                                    actionEl.dataset.queueConsultorio || 0
                                ) || null,
                            ticketId:
                                Number(actionEl.dataset.queueId || 0) || null,
                        }
                    );
                    return;
                }
                await applyQueueTicketAction(
                    Number(actionEl.dataset.queueId || 0),
                    actionEl.dataset.queueAction || '',
                    Number(actionEl.dataset.queueConsultorio || 0)
                );
                return;
            }
            if (action === 'queue-reprint-ticket') {
                event.preventDefault();
                if (queueStarUiState.practiceMode) {
                    simulateQueuePracticeAction('reprint_ticket', {
                        source: 'button',
                        ticketId: Number(actionEl.dataset.queueId || 0) || null,
                    });
                    return;
                }
                await reprintQueueTicket(Number(actionEl.dataset.queueId || 0));
                return;
            }
        } catch (error) {
            showToast(`Error ejecutando accion: ${error.message}`, 'error');
        }
    });

    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter) {
        appointmentFilter.addEventListener('change', () => {
            filterAppointments();
        });
    }

    const searchInput = document.getElementById('searchAppointments');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            searchAppointments();
        });
    }

    const appointmentSort = document.getElementById('appointmentSort');
    if (appointmentSort) {
        appointmentSort.addEventListener('change', () => {
            setAppointmentSort(appointmentSort.value || 'datetime_desc');
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter) {
        callbackFilter.addEventListener('change', filterCallbacks);
    }

    const callbackSearchInput = document.getElementById('searchCallbacks');
    if (callbackSearchInput) {
        callbackSearchInput.addEventListener('input', searchCallbacks);
    }

    const quickCommandInput = document.getElementById('adminQuickCommand');
    if (quickCommandInput instanceof HTMLInputElement) {
        quickCommandInput.addEventListener('keydown', async (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            await runAdminQuickCommand(quickCommandInput.value);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    initAdminThemeMode();
    bootstrapQueueStationConfig();
    attachGlobalListeners();
    initAppointmentsToolbarPreferences();
    ensureAdminRefreshStatusTicker();
    updateAdminRefreshStatus();
    renderAdminContextActions(resolvePreferredSection());
    syncSidebarLayoutMode();

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const navItems = getNavItems();
    navItems.forEach((item) => {
        item.addEventListener('click', async (event) => {
            event.preventDefault();
            await navigateToSection(item.dataset.section || 'dashboard');
        });
    });

    document
        .getElementById('adminMenuToggle')
        ?.addEventListener('click', () => {
            if (isCompactAdminViewport()) {
                setSidebarOpen(!isSidebarOpen());
                return;
            }
            setSidebarCollapsed(!isSidebarCollapsed());
        });
    document
        .getElementById('adminMenuClose')
        ?.addEventListener('click', () => closeSidebar({ restoreFocus: true }));
    document
        .getElementById('adminSidebarBackdrop')
        ?.addEventListener('click', () => closeSidebar({ restoreFocus: true }));

    window.addEventListener('keydown', (event) => {
        trapSidebarFocus(event);

        if (event.key === 'Escape') {
            if (handleQueueEscapeKey(event)) {
                return;
            }
            closeSidebar({ restoreFocus: true });
            return;
        }

        handleAdminKeyboardShortcuts(event);
    });
    window.addEventListener('resize', () => {
        if (!isCompactAdminViewport()) {
            closeSidebar();
        }
        syncSidebarLayoutMode();
        syncSidebarOverlayA11yState(isSidebarOpen());
    });
    window.addEventListener('hashchange', async () => {
        const dashboard = document.getElementById('adminDashboard');
        if (!dashboard || dashboard.classList.contains('is-hidden')) return;
        await navigateToSection(getSectionFromHash({ fallback: 'dashboard' }), {
            refresh: false,
            updateHash: false,
            focus: false,
            closeMobileNav: false,
        });
    });

    const importFileInput = document.getElementById('importFileInput');
    if (importFileInput) {
        importFileInput.addEventListener('change', () =>
            importData(importFileInput)
        );
    }

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopQueueRealtimeSync({ reason: 'hidden' });
            return;
        }
        if (getActiveSection() === 'queue') {
            startQueueRealtimeSync({ immediate: true });
        }
    });

    window.addEventListener('online', async () => {
        const refreshed = await refreshAdminDataAndRender({
            showSuccessToast: false,
            showErrorToast: false,
        });
        if (getActiveSection() === 'queue') {
            startQueueRealtimeSync({ immediate: true });
        }
        if (refreshed) {
            showToast('Conexion restaurada. Datos actualizados.', 'success');
            return;
        }
        showToast(
            'Conexion restaurada, pero no se pudieron refrescar datos.',
            'warning'
        );
    });

    window.addEventListener('offline', () => {
        if (getActiveSection() === 'queue') {
            stopQueueRealtimeSync({ reason: 'offline' });
        }
    });

    window.addEventListener('piel:queue-ops', () => {
        window.requestAnimationFrame(() => {
            syncQueueStationUi();
        });
    });

    syncSidebarOverlayA11yState(false);
    syncSidebarCollapseButtonState(isSidebarCollapsed());
    await checkAuthAndBoot();
    syncQueueStationUi();
});
