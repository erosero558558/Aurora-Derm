import { apiRequest } from './api.js';
import {
    csrfToken,
    currentQueueMeta,
    currentQueueTickets,
    setQueueMeta,
    setQueueTickets,
} from './state.js';
import { escapeHtml, showToast } from './ui.js';

const QUEUE_STATUS_LABELS = {
    waiting: 'En espera',
    called: 'Llamado',
    completed: 'Completado',
    no_show: 'No asistio',
    cancelled: 'Cancelado',
};

const QUEUE_PRIORITY_LABELS = {
    appt_overdue: 'Cita vencida',
    appt_current: 'Cita vigente',
    walk_in: 'Walk-in',
};

const TERMINAL_QUEUE_STATUSES = new Set(['completed', 'no_show', 'cancelled']);
const NON_TERMINAL_QUEUE_STATUSES = new Set(['waiting', 'called']);
const QUEUE_REALTIME_BASE_MS = 2500;
const QUEUE_REALTIME_MAX_MS = 15000;
const QUEUE_STALE_THRESHOLD_MS = 30000;
const QUEUE_SLA_RISK_MINUTES = 20;
const QUEUE_ACTIVITY_LOG_LIMIT = 15;
const QUEUE_BULK_ACTION_ORDER = ['completar', 'no_show', 'cancelar'];
const QUEUE_BULK_ACTION_LABELS = {
    completar: 'Completar',
    no_show: 'No show',
    cancelar: 'Cancelar',
};
const QUEUE_BULK_REPRINT_MAX = 20;
const QUEUE_FILTER_ORDER = [
    'all',
    'waiting',
    'called',
    'sla_risk',
    'appointments',
    'walk_in',
];
const QUEUE_ADMIN_SNAPSHOT_STORAGE_KEY = 'queueAdminLastSnapshot';
const QUEUE_ADMIN_SNAPSHOT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const queueUiState = {
    pendingCallByConsultorio: new Set(),
    realtimeTimerId: 0,
    realtimeEnabled: false,
    realtimeFailureStreak: 0,
    realtimeRequestInFlight: false,
    activeFilter: 'all',
    searchTerm: '',
    triageControlsBound: false,
    bulkActionInFlight: false,
    bulkReprintInFlight: false,
    reprintInFlightIds: new Set(),
    lastViewState: null,
    activityPanelBound: false,
    activityLog: [],
    activitySeq: 0,
    syncState: 'paused',
    syncMessage: '',
    lastRefreshMode: 'idle',
    lastHealthySyncAt: 0,
    snapshotLoaded: false,
    opsActionsBound: false,
};

function emitQueueOpsEvent(eventName, detail = {}) {
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
        // no-op: telemetry is best effort in runtime UI
    }
}

function getQueueSyncStatusEl() {
    return document.getElementById('queueSyncStatus');
}

function setQueueSyncStatus(state, message) {
    const statusEl = getQueueSyncStatusEl();
    const normalizedState = String(state || 'paused').toLowerCase();
    const fallbackMessageByState = {
        live: 'Cola en vivo',
        reconnecting: 'Reintentando sincronizacion',
        offline: 'Sin conexion al backend',
        paused: 'Cola en pausa',
    };
    const normalizedMessage =
        String(message || '').trim() ||
        fallbackMessageByState[normalizedState] ||
        fallbackMessageByState.paused;

    queueUiState.syncState = normalizedState;
    queueUiState.syncMessage = normalizedMessage;

    if (!statusEl) {
        renderQueueActivityPanel();
        return;
    }

    statusEl.dataset.state = normalizedState;
    statusEl.textContent = normalizedMessage;
    renderQueueActivityPanel();
}

function formatElapsedQueueAge(ms) {
    const normalizedMs = Math.max(0, Number(ms || 0));
    const totalSeconds = Math.round(normalizedMs / 1000);
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    }
    const totalMinutes = Math.floor(totalSeconds / 60);
    const remSeconds = totalSeconds % 60;
    if (remSeconds <= 0) {
        return `${totalMinutes}m`;
    }
    return `${totalMinutes}m ${remSeconds}s`;
}

function formatQueueActivityTime(ts) {
    if (!Number.isFinite(ts)) return '--:--:--';
    return new Date(ts).toLocaleTimeString('es-EC', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function normalizeQueueSnapshot(rawSnapshot) {
    if (!rawSnapshot || typeof rawSnapshot !== 'object') return null;

    const savedAtTs = Date.parse(String(rawSnapshot.savedAt || ''));
    if (!Number.isFinite(savedAtTs)) return null;
    if (Date.now() - savedAtTs > QUEUE_ADMIN_SNAPSHOT_MAX_AGE_MS) return null;

    const data =
        rawSnapshot.data && typeof rawSnapshot.data === 'object'
            ? rawSnapshot.data
            : {};
    return {
        savedAt: new Date(savedAtTs).toISOString(),
        data: {
            queueTickets: Array.isArray(data.queueTickets)
                ? data.queueTickets
                : [],
            queueMeta:
                data.queueMeta && typeof data.queueMeta === 'object'
                    ? data.queueMeta
                    : null,
        },
    };
}

function loadQueueSnapshot() {
    try {
        const raw = localStorage.getItem(QUEUE_ADMIN_SNAPSHOT_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return normalizeQueueSnapshot(parsed);
    } catch (_error) {
        return null;
    }
}

function persistQueueSnapshot() {
    try {
        const snapshot = {
            savedAt: new Date().toISOString(),
            data: {
                queueTickets: Array.isArray(currentQueueTickets)
                    ? currentQueueTickets
                    : [],
                queueMeta:
                    currentQueueMeta && typeof currentQueueMeta === 'object'
                        ? currentQueueMeta
                        : null,
            },
        };
        localStorage.setItem(
            QUEUE_ADMIN_SNAPSHOT_STORAGE_KEY,
            JSON.stringify(snapshot)
        );
    } catch (_error) {
        // ignore storage write failures
    }
}

function restoreQueueSnapshot(snapshot, { source = 'fallback' } = {}) {
    const normalized = normalizeQueueSnapshot(snapshot);
    if (!normalized) return false;

    const queueTickets = Array.isArray(normalized.data.queueTickets)
        ? normalized.data.queueTickets
        : [];
    const queueMeta =
        normalized.data.queueMeta &&
        typeof normalized.data.queueMeta === 'object'
            ? normalized.data.queueMeta
            : null;

    setQueueTickets(queueTickets);
    setQueueMeta(queueMeta);
    renderQueueSection();

    const ageMs = Math.max(
        0,
        Date.now() - Date.parse(String(normalized.savedAt || ''))
    );
    const ageLabel = formatElapsedQueueAge(ageMs);
    updateQueueSyncState(
        'reconnecting',
        `Respaldo local activo (${ageLabel})`,
        {
            log: true,
            level: 'warning',
            reason: 'Respaldo local',
        }
    );
    emitQueueOpsEvent('snapshot_restored', {
        source,
        ageMs,
        queueCount: queueTickets.length,
    });
    return true;
}

function ensureQueueActivityPanel() {
    const shell = document.querySelector('#queue .queue-admin-shell');
    if (!(shell instanceof HTMLElement)) {
        return null;
    }

    let panel = document.getElementById('queueActivityPanel');
    if (!(panel instanceof HTMLElement)) {
        panel = document.createElement('section');
        panel.id = 'queueActivityPanel';
        panel.className = 'queue-admin-next';
        panel.innerHTML = `
            <h4>Historial operativo</h4>
            <p id="queueActivitySyncHint" class="queue-triage-summary" role="status" aria-live="polite">Sincronizacion en espera.</p>
            <ol id="queueActivityList" role="log" aria-live="polite" aria-relevant="additions text">
                <li class="empty-message">Sin eventos operativos recientes.</li>
            </ol>
            <p class="queue-triage-summary">
                Atajos estado: Alt+Shift+W (espera), Alt+Shift+C (llamados), Alt+Shift+A (todos), Alt+Shift+I (walk-in)
            </p>
        `;

        const grid = shell.querySelector('.queue-admin-grid');
        if (grid?.parentElement === shell) {
            grid.insertAdjacentElement('afterend', panel);
        } else {
            shell.appendChild(panel);
        }
    }

    return panel;
}

function renderQueueActivityPanel() {
    const panel = ensureQueueActivityPanel();
    if (!(panel instanceof HTMLElement)) {
        return;
    }

    const syncHintEl = panel.querySelector('#queueActivitySyncHint');
    if (syncHintEl instanceof HTMLElement) {
        const syncStateLabel = {
            live: 'en vivo',
            reconnecting: 'reconectando',
            offline: 'sin conexion',
            paused: 'en pausa',
        }[queueUiState.syncState || 'paused'];
        const syncMessage = String(queueUiState.syncMessage || '').trim();
        syncHintEl.textContent = `Sync ${syncStateLabel}: ${syncMessage || 'sin detalle'}`;
    }

    const listEl = panel.querySelector('#queueActivityList');
    if (!(listEl instanceof HTMLElement)) {
        return;
    }

    if (
        !Array.isArray(queueUiState.activityLog) ||
        !queueUiState.activityLog.length
    ) {
        listEl.innerHTML =
            '<li class="empty-message">Sin eventos operativos recientes.</li>';
        return;
    }

    listEl.innerHTML = queueUiState.activityLog
        .map((entry) => {
            const levelLabel = {
                info: 'INFO',
                warning: 'WARN',
                error: 'ERROR',
            }[entry.level || 'info'];
            return `
                <li>
                    <strong>${escapeHtml(formatQueueActivityTime(entry.ts))}</strong>
                    <span>[${escapeHtml(levelLabel)}] ${escapeHtml(entry.message || 'Evento sin detalle')}</span>
                </li>
            `;
        })
        .join('');
}

function pushQueueActivity(message, { level = 'info' } = {}) {
    const text = String(message || '').trim();
    if (!text) return;

    const now = Date.now();
    const normalizedLevel = ['info', 'warning', 'error'].includes(level)
        ? level
        : 'info';
    const previous = queueUiState.activityLog[0] || null;
    if (
        previous &&
        previous.message === text &&
        previous.level === normalizedLevel &&
        now - Number(previous.ts || 0) < 2000
    ) {
        return;
    }

    queueUiState.activitySeq = Number(queueUiState.activitySeq || 0) + 1;
    queueUiState.activityLog.unshift({
        id: queueUiState.activitySeq,
        ts: now,
        level: normalizedLevel,
        message: text,
    });
    queueUiState.activityLog = queueUiState.activityLog.slice(
        0,
        QUEUE_ACTIVITY_LOG_LIMIT
    );
    renderQueueActivityPanel();
}

function updateQueueSyncState(
    state,
    message,
    { log = false, level = 'info', reason = '' } = {}
) {
    const nextState = String(state || 'paused').toLowerCase();
    const nextMessage = String(message || '').trim();
    const changed =
        nextState !== String(queueUiState.syncState || 'paused') ||
        nextMessage !== String(queueUiState.syncMessage || '');

    setQueueSyncStatus(nextState, nextMessage);

    if (changed) {
        emitQueueOpsEvent('sync_state', {
            state: nextState,
            message: nextMessage,
        });
    }

    if (!log || !changed) {
        return changed;
    }

    const reasonPrefix = String(reason || '').trim();
    const activityMessage = reasonPrefix
        ? `${reasonPrefix}: ${nextMessage || nextState}`
        : nextMessage || nextState;
    pushQueueActivity(activityMessage, { level });
    return changed;
}

function evaluateQueueFreshness({ log = false } = {}) {
    if (!isQueueSectionActive()) {
        return { stale: false, ageMs: 0 };
    }
    if (String(queueUiState.syncState || '').toLowerCase() === 'offline') {
        return { stale: false, ageMs: 0 };
    }
    const updatedAtTs = Date.parse(String(currentQueueMeta?.updatedAt || ''));
    if (!Number.isFinite(updatedAtTs)) {
        return { stale: false, ageMs: 0 };
    }
    const ageMs = Math.max(0, Date.now() - updatedAtTs);
    if (ageMs < QUEUE_STALE_THRESHOLD_MS) {
        return { stale: false, ageMs };
    }

    const message = `Watchdog: datos de cola estancados (${formatElapsedQueueAge(ageMs)})`;
    updateQueueSyncState('reconnecting', message, {
        log,
        level: 'warning',
        reason: 'Watchdog de cola',
    });
    return { stale: true, ageMs, message };
}

function getRealtimeDelayMs() {
    const multiplier = Math.max(
        0,
        Number(queueUiState.realtimeFailureStreak || 0)
    );
    const delay = QUEUE_REALTIME_BASE_MS * Math.pow(2, Math.min(multiplier, 3));
    return Math.min(QUEUE_REALTIME_MAX_MS, delay);
}

function clearQueueRealtimeTimer() {
    if (!queueUiState.realtimeTimerId) return;
    window.clearTimeout(queueUiState.realtimeTimerId);
    queueUiState.realtimeTimerId = 0;
}

function scheduleQueueRealtimeTick({ immediate = false } = {}) {
    clearQueueRealtimeTimer();
    if (!queueUiState.realtimeEnabled) return;
    const delayMs = immediate ? 0 : getRealtimeDelayMs();
    queueUiState.realtimeTimerId = window.setTimeout(() => {
        void runQueueRealtimeTick();
    }, delayMs);
}

function formatDateTime(value) {
    const ts =
        typeof value === 'number' && Number.isFinite(value)
            ? value
            : Date.parse(String(value || ''));
    if (!Number.isFinite(ts)) {
        return '--';
    }
    return new Date(ts).toLocaleString('es-EC', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function parseQueueTimestamp(value) {
    const ts = Date.parse(String(value || ''));
    return Number.isFinite(ts) ? ts : null;
}

function isSameLocalDay(ts, nowTs = Date.now()) {
    if (!Number.isFinite(ts)) return false;
    const a = new Date(ts);
    const b = new Date(nowTs);
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function formatQueueMinutesLabel(minutes) {
    if (!Number.isFinite(minutes)) return '--';
    return `${Math.max(0, Math.round(minutes))}m`;
}

function formatQueuePercent(value) {
    if (!Number.isFinite(value)) return '0%';
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) return `${rounded}%`;
    return `${rounded.toFixed(1)}%`;
}

function getQueuePercentile(values, percentile) {
    if (!Array.isArray(values) || values.length === 0) return null;
    const ordered = [...values]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);
    if (!ordered.length) return null;

    const ratio = Math.min(1, Math.max(0, Number(percentile || 0)));
    const index = Math.max(0, Math.ceil(ratio * ordered.length) - 1);
    return ordered[index];
}

function computeQueueOperationalMetrics(tickets) {
    const rows = Array.isArray(tickets) ? tickets : [];
    const nowTs = Date.now();
    const waitMinutesValues = [];
    let ticketsToday = 0;
    let completedToday = 0;
    let noShowToday = 0;
    let slaRiskCount = 0;
    let latestSignalTs = null;

    for (const ticket of rows) {
        const status = String(ticket?.status || '').toLowerCase();
        const createdTs = parseQueueTimestamp(ticket?.createdAt);
        const calledTs = parseQueueTimestamp(ticket?.calledAt);
        const completedTs = parseQueueTimestamp(ticket?.completedAt);
        const eventTs =
            completedTs ??
            calledTs ??
            createdTs ??
            parseQueueTimestamp(ticket?.updatedAt);
        if (Number.isFinite(eventTs)) {
            latestSignalTs =
                latestSignalTs === null
                    ? eventTs
                    : Math.max(latestSignalTs, eventTs);
        }

        if (Number.isFinite(createdTs) && isSameLocalDay(createdTs, nowTs)) {
            ticketsToday += 1;
        }
        const terminalTs = completedTs ?? calledTs ?? createdTs;
        if (
            status === 'completed' &&
            Number.isFinite(terminalTs) &&
            isSameLocalDay(terminalTs, nowTs)
        ) {
            completedToday += 1;
        }
        if (
            status === 'no_show' &&
            Number.isFinite(terminalTs) &&
            isSameLocalDay(terminalTs, nowTs)
        ) {
            noShowToday += 1;
        }

        if (status === 'waiting' && Number.isFinite(createdTs)) {
            const waitingMinutes = Math.max(
                0,
                Math.round((nowTs - createdTs) / 60000)
            );
            if (waitingMinutes >= QUEUE_SLA_RISK_MINUTES) {
                slaRiskCount += 1;
            }
        }

        if (!Number.isFinite(createdTs)) continue;
        let waitEndTs = null;
        if (Number.isFinite(calledTs)) {
            waitEndTs = calledTs;
        } else if (status === 'waiting' || status === 'called') {
            waitEndTs = nowTs;
        } else if (Number.isFinite(completedTs)) {
            waitEndTs = completedTs;
        }
        if (!Number.isFinite(waitEndTs)) continue;
        const waitMinutes = Math.max(
            0,
            Math.round((waitEndTs - createdTs) / 60000)
        );
        waitMinutesValues.push(waitMinutes);
    }

    const avgWaitMinutes =
        waitMinutesValues.length > 0
            ? waitMinutesValues.reduce((sum, value) => sum + value, 0) /
              waitMinutesValues.length
            : null;
    const p95WaitMinutes = getQueuePercentile(waitMinutesValues, 0.95);
    const noShowBase = completedToday + noShowToday;
    const noShowRatePct = noShowBase > 0 ? (noShowToday / noShowBase) * 100 : 0;

    return {
        ticketsToday,
        completedToday,
        noShowToday,
        noShowRatePct,
        avgWaitMinutes,
        p95WaitMinutes,
        slaRiskCount,
        latestSignalTs,
        waitSampleSize: waitMinutesValues.length,
    };
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function downloadQueueTicketsCsv(viewState) {
    const visibleTickets = Array.isArray(viewState?.tickets)
        ? viewState.tickets
        : [];
    if (!visibleTickets.length) {
        showToast('No hay tickets visibles para exportar.', 'info');
        return false;
    }

    const rows = visibleTickets.map((ticket) => {
        const waitMinutes = getTicketWaitMinutes(ticket);
        return [
            ticket?.ticketCode || '',
            ticket?.queueType || '',
            ticket?.priorityClass || '',
            ticket?.status || '',
            ticket?.assignedConsultorio ?? '',
            ticket?.patientInitials || '',
            ticket?.phoneLast4 || '',
            ticket?.createdAt || '',
            ticket?.calledAt || '',
            ticket?.completedAt || '',
            Number.isFinite(waitMinutes) ? Math.round(waitMinutes) : '',
            isSlaRiskTicket(ticket) ? 'yes' : 'no',
        ];
    });

    const header = [
        'ticket_code',
        'queue_type',
        'priority_class',
        'status',
        'assigned_consultorio',
        'patient_initials',
        'phone_last4',
        'created_at',
        'called_at',
        'completed_at',
        'wait_minutes',
        'sla_risk',
    ];
    const csvContent = [
        header.map(csvEscape).join(','),
        ...rows.map((row) => row.map(csvEscape).join(',')),
    ].join('\n');
    const csvWithBom = `\uFEFF${csvContent}`;
    const blob = new Blob([csvWithBom], {
        type: 'text/csv;charset=utf-8',
    });
    const fileStamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/[-:T]/g, '');
    const fileName = `turnero-resumen-${fileStamp}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);

    pushQueueActivity(`CSV exportado: ${rows.length} ticket(s) visibles`, {
        level: 'info',
    });
    showToast(`CSV exportado (${rows.length} tickets).`, 'success');
    emitQueueOpsEvent('queue_export_csv', {
        rows: rows.length,
        filter: normalizeQueueFilter(viewState?.activeFilter || 'all'),
    });
    return true;
}

function bindQueueOperationalActions() {
    if (queueUiState.opsActionsBound) return;
    queueUiState.opsActionsBound = true;
    document.addEventListener('click', (event) => {
        if (!(event.target instanceof Element)) return;
        const trigger = event.target.closest(
            '[data-action="queue-export-csv"]'
        );
        if (!(trigger instanceof HTMLElement)) return;
        const viewState = queueUiState.lastViewState || buildQueueViewState();
        downloadQueueTicketsCsv(viewState);
    });
}

function renderQueueOperationalInsights() {
    bindQueueOperationalActions();
    const tickets = Array.isArray(currentQueueTickets)
        ? currentQueueTickets
        : [];
    const metrics = computeQueueOperationalMetrics(tickets);

    const ticketsTodayEl = document.getElementById('queueOpsTicketsToday');
    const completedTodayEl = document.getElementById('queueOpsCompletedToday');
    const noShowRateEl = document.getElementById('queueOpsNoShowRate');
    const avgWaitEl = document.getElementById('queueOpsAvgWait');
    const p95WaitEl = document.getElementById('queueOpsP95Wait');
    const slaRiskEl = document.getElementById('queueOpsSlaRisk');
    const updatedAtEl = document.getElementById('queueOpsUpdatedAt');

    if (ticketsTodayEl) {
        ticketsTodayEl.textContent = String(metrics.ticketsToday);
    }
    if (completedTodayEl) {
        completedTodayEl.textContent = String(metrics.completedToday);
    }
    if (noShowRateEl) {
        noShowRateEl.textContent = `${formatQueuePercent(metrics.noShowRatePct)} (${metrics.noShowToday})`;
    }
    if (avgWaitEl) {
        avgWaitEl.textContent = formatQueueMinutesLabel(metrics.avgWaitMinutes);
    }
    if (p95WaitEl) {
        p95WaitEl.textContent = formatQueueMinutesLabel(metrics.p95WaitMinutes);
    }
    if (slaRiskEl) {
        slaRiskEl.textContent = String(metrics.slaRiskCount);
    }
    if (updatedAtEl) {
        const updatedLabel =
            Number.isFinite(metrics.latestSignalTs) &&
            metrics.latestSignalTs !== null
                ? formatDateTime(metrics.latestSignalTs)
                : '--';
        updatedAtEl.textContent = `Muestra: ${metrics.waitSampleSize} ticket(s) · ultima señal ${updatedLabel}`;
    }
}

function normalizeQueueMetaFromState(queueState) {
    const callingNowByConsultorio = {
        1: null,
        2: null,
    };

    const callingNow = Array.isArray(queueState?.callingNow)
        ? queueState.callingNow
        : [];
    for (const ticket of callingNow) {
        const consultorio = Number(ticket?.assignedConsultorio || 0);
        if (consultorio === 1 || consultorio === 2) {
            callingNowByConsultorio[String(consultorio)] = ticket;
        }
    }

    return {
        updatedAt: queueState?.updatedAt || new Date().toISOString(),
        waitingCount: Number(queueState?.waitingCount || 0),
        calledCount: Number(queueState?.calledCount || 0),
        counts: queueState?.counts || {},
        callingNowByConsultorio,
        nextTickets: Array.isArray(queueState?.nextTickets)
            ? queueState.nextTickets
            : [],
    };
}

function getTicketStatusRank(status) {
    const rankByStatus = {
        waiting: 0,
        called: 1,
        completed: 2,
        no_show: 3,
        cancelled: 4,
    };
    return rankByStatus[String(status || '').toLowerCase()] ?? 9;
}

function getTicketPriorityRank(priorityClass) {
    const rankByPriority = {
        appt_overdue: 0,
        appt_current: 1,
        walk_in: 2,
    };
    return rankByPriority[String(priorityClass || '').toLowerCase()] ?? 9;
}

function normalizeQueueFilter(filter) {
    const normalized = String(filter || '')
        .trim()
        .toLowerCase();
    return QUEUE_FILTER_ORDER.includes(normalized) ? normalized : 'all';
}

function getTicketWaitMinutes(ticket) {
    const createdTs = Date.parse(String(ticket?.createdAt || ''));
    if (!Number.isFinite(createdTs)) return null;

    const calledTs = Date.parse(String(ticket?.calledAt || ''));
    const status = String(ticket?.status || '').toLowerCase();
    const endTs =
        status === 'called' && Number.isFinite(calledTs)
            ? calledTs
            : Date.now();
    const minutes = Math.round((endTs - createdTs) / 60000);
    return minutes >= 0 ? minutes : 0;
}

function isSlaRiskTicket(ticket) {
    const status = String(ticket?.status || '').toLowerCase();
    if (status !== 'waiting') return false;
    const waitMinutes = getTicketWaitMinutes(ticket);
    return (
        Number.isFinite(waitMinutes) && waitMinutes >= QUEUE_SLA_RISK_MINUTES
    );
}

function matchesQueueFilter(ticket, filter) {
    const normalizedFilter = normalizeQueueFilter(filter);
    const status = String(ticket?.status || '').toLowerCase();
    const queueType = String(ticket?.queueType || '').toLowerCase();
    if (normalizedFilter === 'all') return true;
    if (normalizedFilter === 'waiting') return status === 'waiting';
    if (normalizedFilter === 'called') return status === 'called';
    if (normalizedFilter === 'sla_risk') return isSlaRiskTicket(ticket);
    if (normalizedFilter === 'appointments') return queueType === 'appointment';
    if (normalizedFilter === 'walk_in') return queueType === 'walk_in';
    return true;
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function matchesQueueSearch(ticket, searchTerm) {
    const normalizedTerm = normalizeSearchText(searchTerm);
    if (!normalizedTerm) return true;
    const haystack = [
        ticket?.ticketCode,
        ticket?.patientInitials,
        ticket?.phoneLast4,
        ticket?.queueType,
        ticket?.priorityClass,
        ticket?.status,
    ]
        .map((value) => normalizeSearchText(value))
        .filter(Boolean)
        .join(' ');
    return haystack.includes(normalizedTerm);
}

function getSortedTickets(tickets) {
    return [...tickets].sort((a, b) => {
        const statusDiff =
            getTicketStatusRank(a?.status) - getTicketStatusRank(b?.status);
        if (statusDiff !== 0) return statusDiff;

        const priorityDiff =
            getTicketPriorityRank(a?.priorityClass) -
            getTicketPriorityRank(b?.priorityClass);
        if (priorityDiff !== 0) return priorityDiff;

        const waitA = getTicketWaitMinutes(a);
        const waitB = getTicketWaitMinutes(b);
        if (
            Number.isFinite(waitA) &&
            Number.isFinite(waitB) &&
            waitA !== waitB
        ) {
            return waitB - waitA;
        }

        const aTs = Date.parse(String(a?.createdAt || ''));
        const bTs = Date.parse(String(b?.createdAt || ''));
        if (Number.isFinite(aTs) && Number.isFinite(bTs) && aTs !== bTs) {
            return aTs - bTs;
        }
        return Number(a?.id || 0) - Number(b?.id || 0);
    });
}

function buildQueueViewState() {
    const sourceTickets = Array.isArray(currentQueueTickets)
        ? currentQueueTickets
        : [];
    const sortedTickets = getSortedTickets(sourceTickets);
    const activeFilter = normalizeQueueFilter(queueUiState.activeFilter);
    const searchTerm = String(queueUiState.searchTerm || '');

    const filteredTickets = sortedTickets.filter(
        (ticket) =>
            matchesQueueFilter(ticket, activeFilter) &&
            matchesQueueSearch(ticket, searchTerm)
    );

    const waitingCount = sortedTickets.filter(
        (ticket) => String(ticket?.status || '').toLowerCase() === 'waiting'
    ).length;
    const calledCount = sortedTickets.filter(
        (ticket) => String(ticket?.status || '').toLowerCase() === 'called'
    ).length;
    const riskCount = sortedTickets.filter((ticket) =>
        isSlaRiskTicket(ticket)
    ).length;

    return {
        tickets: filteredTickets,
        totalCount: sortedTickets.length,
        waitingCount,
        calledCount,
        riskCount,
        activeFilter,
        searchTerm,
    };
}

function getBulkActionLabel(action) {
    const key = String(action || '').toLowerCase();
    return QUEUE_BULK_ACTION_LABELS[key] || 'Accion';
}

function isBulkActionAllowedForStatus(action, status) {
    const normalizedAction = String(action || '').toLowerCase();
    const normalizedStatus = String(status || '').toLowerCase();
    if (!NON_TERMINAL_QUEUE_STATUSES.has(normalizedStatus)) {
        return false;
    }
    if (normalizedAction === 'completar') {
        return normalizedStatus === 'called' || normalizedStatus === 'waiting';
    }
    if (normalizedAction === 'no_show') {
        return normalizedStatus === 'called' || normalizedStatus === 'waiting';
    }
    if (normalizedAction === 'cancelar') {
        return normalizedStatus === 'called' || normalizedStatus === 'waiting';
    }
    return false;
}

function getBulkEligibleTickets(action, viewState) {
    const normalizedAction = String(action || '').toLowerCase();
    if (!QUEUE_BULK_ACTION_ORDER.includes(normalizedAction)) {
        return [];
    }
    const tickets = Array.isArray(viewState?.tickets) ? viewState.tickets : [];
    return tickets.filter((ticket) =>
        isBulkActionAllowedForStatus(normalizedAction, ticket?.status)
    );
}

function updateTicketInState(nextTicket) {
    if (!nextTicket || typeof nextTicket !== 'object') return;
    const ticketId = Number(nextTicket.id || 0);
    if (!ticketId) return;

    const tickets = Array.isArray(currentQueueTickets)
        ? [...currentQueueTickets]
        : [];
    const index = tickets.findIndex(
        (ticket) => Number(ticket?.id || 0) === ticketId
    );
    if (index >= 0) {
        tickets[index] = { ...tickets[index], ...nextTicket };
    } else {
        tickets.push(nextTicket);
    }
    setQueueTickets(tickets);
}

function normalizeErrorMessage(error) {
    return String(error?.message || 'Error desconocido');
}

function getPrinterErrorMessage(payload, { fallback = '' } = {}) {
    const errorCode = String(payload?.print?.errorCode || '').toLowerCase();
    const message = String(payload?.print?.message || '').trim();
    const statusCode = Number(payload?.statusCode || 0);

    if (errorCode === 'printer_disabled') {
        return 'Impresora deshabilitada: ticket generado sin impresion';
    }
    if (errorCode === 'printer_host_missing') {
        return 'Impresora sin host configurado';
    }
    if (errorCode === 'printer_connect_failed') {
        return 'No se pudo conectar con la impresora termica';
    }
    if (errorCode === 'printer_write_failed') {
        return 'Conexion con impresora abierta, pero fallo la impresion';
    }

    if (message) return message;
    if (statusCode >= 500) return 'Fallo de impresion termica';
    return String(fallback || 'sin detalle');
}

async function requestQueueReprint(ticketId) {
    const id = Number(ticketId || 0);
    const params = new URLSearchParams();
    params.set('resource', 'queue-reprint');
    params.set('t', String(Date.now()));

    const response = await fetch(`/api.php?${params.toString()}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ id }),
    });

    const raw = await response.text();
    let payload;
    try {
        payload = raw ? JSON.parse(raw) : {};
    } catch (_error) {
        throw new Error('Respuesta invalida del servidor');
    }

    const mergedPayload =
        payload && typeof payload === 'object'
            ? {
                  ...payload,
                  statusCode: response.status,
              }
            : { statusCode: response.status };

    return {
        ok:
            response.ok &&
            mergedPayload.ok !== false &&
            Boolean(mergedPayload.printed),
        responseOk: response.ok,
        payload: mergedPayload,
    };
}

function isConsultorioBusyError(error) {
    const normalized = normalizeErrorMessage(error)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
    return normalized.includes('consultorio') && normalized.includes('ocupado');
}

function queueActionSuccessMessage(action, ticketCode = '') {
    const code = ticketCode ? `${ticketCode} ` : '';
    switch (String(action || '').toLowerCase()) {
        case 're-llamar':
        case 'rellamar':
        case 'recall':
        case 'llamar':
            return `${code}re-llamado correctamente`.trim();
        case 'liberar':
        case 'release':
            return `${code}liberado y regresado a espera`.trim();
        case 'completar':
        case 'complete':
        case 'completed':
            return `${code}marcado como completado`.trim();
        case 'no_show':
        case 'noshow':
            return `${code}marcado como no show`.trim();
        case 'cancelar':
        case 'cancel':
        case 'cancelled':
            return `${code}cancelado`.trim();
        case 'reasignar':
        case 'reassign':
            return `${code}reasignado`.trim();
        default:
            return 'Turno actualizado';
    }
}

function getHeaderCallButton(consultorio) {
    return document.querySelector(
        `[data-action="queue-call-next"][data-queue-consultorio="${consultorio}"]`
    );
}

function ensureHeaderReleaseButton(consultorio) {
    const buttonId = `queueReleaseC${consultorio}`;
    const existing = document.getElementById(buttonId);
    if (existing instanceof HTMLButtonElement) {
        return existing;
    }

    const headerActions = document.querySelector(
        '#queue .queue-admin-header-actions'
    );
    if (!(headerActions instanceof HTMLElement)) {
        return null;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.id = buttonId;
    button.className = 'btn btn-secondary btn-sm';
    button.dataset.action = 'queue-ticket-action';
    button.dataset.queueAction = 'liberar';
    button.dataset.queueConsultorio = String(consultorio);
    button.disabled = true;
    button.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${consultorio}`;

    const callButton = getHeaderCallButton(consultorio);
    if (callButton?.parentElement === headerActions && callButton.nextSibling) {
        headerActions.insertBefore(button, callButton.nextSibling);
    } else {
        headerActions.appendChild(button);
    }
    return button;
}

function syncHeaderConsultorioControls(consultorio, activeTicket) {
    const callButton = getHeaderCallButton(consultorio);
    const releaseButton = ensureHeaderReleaseButton(consultorio);
    const roomLabel = `Consultorio ${consultorio}`;
    const hasActiveTicket = Boolean(activeTicket && activeTicket.id);
    const callPending = queueUiState.pendingCallByConsultorio.has(
        String(consultorio)
    );

    if (callButton instanceof HTMLButtonElement) {
        const disabled = hasActiveTicket || callPending;
        callButton.disabled = disabled;
        if (callPending) {
            callButton.title = `Procesando llamado para ${roomLabel}`;
        } else if (hasActiveTicket) {
            const ticketCode = String(activeTicket?.ticketCode || '--');
            callButton.title = `${roomLabel} ocupado por ${ticketCode}`;
        } else {
            callButton.title = `Llamar siguiente turno en ${roomLabel}`;
        }
    }

    if (!(releaseButton instanceof HTMLButtonElement)) return;

    releaseButton.disabled = !hasActiveTicket;
    if (!hasActiveTicket) {
        delete releaseButton.dataset.queueId;
        releaseButton.title = `Sin turno activo en ${roomLabel}`;
        releaseButton.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${consultorio}`;
        return;
    }

    const ticketCode = String(activeTicket?.ticketCode || '--');
    releaseButton.dataset.queueId = String(activeTicket?.id || '');
    releaseButton.title = `Liberar ${ticketCode} de ${roomLabel}`;
    releaseButton.innerHTML = `<i class="fas fa-rotate-left"></i> Liberar C${consultorio} (${escapeHtml(ticketCode)})`;
}

function getQueueFilterLabel(filter) {
    const labels = {
        all: 'Todos',
        waiting: 'En espera',
        called: 'Llamados',
        sla_risk: `SLA +${QUEUE_SLA_RISK_MINUTES}m`,
        appointments: 'Cita',
        walk_in: 'Walk-in',
    };
    return labels[normalizeQueueFilter(filter)] || labels.all;
}

function ensureQueueTriageControls() {
    const shell = document.querySelector('#queue .queue-admin-shell');
    if (!(shell instanceof HTMLElement)) return;

    let toolbar = document.getElementById('queueTriageToolbar');
    if (!(toolbar instanceof HTMLElement)) {
        toolbar = document.createElement('section');
        toolbar.id = 'queueTriageToolbar';
        toolbar.className = 'queue-triage-toolbar';
        toolbar.innerHTML = `
            <div class="queue-triage-filters" role="group" aria-label="Filtros de turnero">
                ${QUEUE_FILTER_ORDER.map(
                    (filter) => `
                        <button
                            type="button"
                            class="btn btn-secondary btn-sm queue-triage-filter"
                            data-queue-filter="${filter}"
                        >
                            ${escapeHtml(getQueueFilterLabel(filter))}
                        </button>
                    `
                ).join('')}
            </div>
            <div class="queue-triage-search-wrap">
                <input
                    id="queueSearchInput"
                    class="queue-triage-search"
                    type="search"
                    inputmode="search"
                    autocomplete="off"
                    placeholder="Buscar ticket, iniciales o ultimos 4"
                    aria-label="Buscar en cola"
                />
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-action="queue-clear-search"
                >
                    Limpiar
                </button>
            </div>
            <div class="queue-triage-filters" role="group" aria-label="Acciones masivas sobre tickets visibles">
                ${QUEUE_BULK_ACTION_ORDER.map(
                    (action) => `
                        <button
                            type="button"
                            class="btn btn-secondary btn-sm"
                            data-action="queue-bulk-action"
                            data-queue-action="${action}"
                        >
                            ${escapeHtml(getBulkActionLabel(action))}
                        </button>
                    `
                ).join('')}
                <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    data-action="queue-bulk-reprint"
                >
                    Reimprimir visibles
                </button>
            </div>
            <p id="queueTriageSummary" class="queue-triage-summary" role="status" aria-live="polite">Sin datos de cola</p>
            <p class="queue-triage-summary">
                Atajos: Alt+Shift+J (C1), Alt+Shift+K (C2), Alt+Shift+F (buscar), Alt+Shift+L (SLA), Alt+Shift+U (refrescar), Alt+Shift+P (reimprimir visibles), Alt+Shift+W/C/A/I (estado)
            </p>
        `;
        const kpis = shell.querySelector('.queue-admin-kpis');
        if (kpis?.parentElement === shell) {
            shell.insertBefore(toolbar, kpis);
        } else {
            shell.appendChild(toolbar);
        }
    }

    const searchInput = document.getElementById('queueSearchInput');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== String(queueUiState.searchTerm || '')
    ) {
        searchInput.value = String(queueUiState.searchTerm || '');
    }

    if (queueUiState.triageControlsBound) return;
    queueUiState.triageControlsBound = true;

    toolbar.addEventListener('click', (event) => {
        const filterButton = event.target.closest('[data-queue-filter]');
        if (filterButton instanceof HTMLElement) {
            queueUiState.activeFilter = normalizeQueueFilter(
                filterButton.dataset.queueFilter || 'all'
            );
            renderQueueSection();
            return;
        }
        const bulkButton = event.target.closest(
            '[data-action="queue-bulk-action"]'
        );
        if (bulkButton instanceof HTMLElement) {
            const action = bulkButton.dataset.queueAction || '';
            void runQueueBulkAction(action);
            return;
        }
        const bulkReprintButton = event.target.closest(
            '[data-action="queue-bulk-reprint"]'
        );
        if (bulkReprintButton instanceof HTMLElement) {
            void runQueueBulkReprint();
            return;
        }
        const clearButton = event.target.closest(
            '[data-action="queue-clear-search"]'
        );
        if (clearButton instanceof HTMLElement) {
            queueUiState.searchTerm = '';
            renderQueueSection();
        }
    });

    if (searchInput instanceof HTMLInputElement) {
        searchInput.addEventListener('input', () => {
            queueUiState.searchTerm = searchInput.value || '';
            renderQueueSection();
        });
    }
}

function syncQueueTriageControls(viewState) {
    const toolbar = document.getElementById('queueTriageToolbar');
    if (!(toolbar instanceof HTMLElement)) return;

    const activeFilter = normalizeQueueFilter(viewState?.activeFilter || 'all');
    toolbar.querySelectorAll('[data-queue-filter]').forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const isActive =
            normalizeQueueFilter(button.dataset.queueFilter || '') ===
            activeFilter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });

    const searchInput = document.getElementById('queueSearchInput');
    if (
        searchInput instanceof HTMLInputElement &&
        searchInput.value !== String(viewState?.searchTerm || '')
    ) {
        searchInput.value = String(viewState?.searchTerm || '');
    }

    toolbar
        .querySelectorAll('[data-action="queue-bulk-action"]')
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            const action = String(
                button.dataset.queueAction || ''
            ).toLowerCase();
            const eligibleCount = getBulkEligibleTickets(
                action,
                viewState
            ).length;
            const label = getBulkActionLabel(action);
            button.textContent = `${label} visibles (${eligibleCount})`;
            button.disabled =
                queueUiState.bulkActionInFlight || eligibleCount === 0;
            button.setAttribute('aria-disabled', String(button.disabled));
        });

    const bulkReprintButton = toolbar.querySelector(
        '[data-action="queue-bulk-reprint"]'
    );
    if (bulkReprintButton instanceof HTMLButtonElement) {
        const visibleTickets = Array.isArray(viewState?.tickets)
            ? viewState.tickets
            : [];
        const visibleCount = visibleTickets.length;
        bulkReprintButton.textContent = `Reimprimir visibles (${visibleCount})`;
        bulkReprintButton.disabled =
            queueUiState.bulkReprintInFlight ||
            queueUiState.bulkActionInFlight ||
            visibleCount === 0;
        bulkReprintButton.setAttribute(
            'aria-disabled',
            String(bulkReprintButton.disabled)
        );
    }

    const summary = document.getElementById('queueTriageSummary');
    if (summary instanceof HTMLElement) {
        const visibleCount = Number(viewState?.tickets?.length || 0);
        const totalCount = Number(viewState?.totalCount || 0);
        const riskCount = Number(viewState?.riskCount || 0);
        const waitingCount = Number(viewState?.waitingCount || 0);
        let progressText = '';
        if (queueUiState.bulkActionInFlight) {
            progressText = ' · ejecutando accion masiva...';
        } else if (queueUiState.bulkReprintInFlight) {
            progressText = ' · reimprimiendo tickets visibles...';
        }
        summary.textContent = `${visibleCount}/${totalCount} visibles · ${waitingCount} en espera · ${riskCount} en riesgo SLA${progressText}`;
    }
}

function renderQueueOverview() {
    const queueMeta =
        currentQueueMeta && typeof currentQueueMeta === 'object'
            ? currentQueueMeta
            : {
                  waitingCount: 0,
                  calledCount: 0,
                  nextTickets: [],
                  callingNowByConsultorio: { 1: null, 2: null },
                  updatedAt: '',
              };

    const waitingCountEl = document.getElementById('queueWaitingCountAdmin');
    const calledCountEl = document.getElementById('queueCalledCountAdmin');
    const sidebarBadgeEl = document.getElementById('queueBadge');
    const consultorio1El = document.getElementById('queueC1Now');
    const consultorio2El = document.getElementById('queueC2Now');
    const nextListEl = document.getElementById('queueNextAdminList');
    const updatedAtEl = document.getElementById('queueLastUpdate');

    if (waitingCountEl)
        waitingCountEl.textContent = String(queueMeta.waitingCount || 0);
    if (calledCountEl)
        calledCountEl.textContent = String(queueMeta.calledCount || 0);
    if (sidebarBadgeEl)
        sidebarBadgeEl.textContent = String(queueMeta.waitingCount || 0);
    if (updatedAtEl)
        updatedAtEl.textContent = formatDateTime(queueMeta.updatedAt);

    const consultorio1 = queueMeta?.callingNowByConsultorio?.['1'];
    const consultorio2 = queueMeta?.callingNowByConsultorio?.['2'];

    if (consultorio1El) {
        consultorio1El.textContent = consultorio1
            ? `${consultorio1.ticketCode || '--'} · ${consultorio1.patientInitials || '--'}`
            : 'Sin llamado';
    }
    if (consultorio2El) {
        consultorio2El.textContent = consultorio2
            ? `${consultorio2.ticketCode || '--'} · ${consultorio2.patientInitials || '--'}`
            : 'Sin llamado';
    }

    syncHeaderConsultorioControls(1, consultorio1);
    syncHeaderConsultorioControls(2, consultorio2);

    if (nextListEl) {
        const nextTickets = Array.isArray(queueMeta.nextTickets)
            ? queueMeta.nextTickets
            : [];
        if (nextTickets.length === 0) {
            nextListEl.innerHTML =
                '<li class="empty-message">No hay turnos en espera.</li>';
        } else {
            nextListEl.innerHTML = nextTickets
                .map(
                    (ticket) => `
                        <li>
                            <strong>${escapeHtml(ticket.ticketCode || '--')}</strong>
                            <span>${escapeHtml(ticket.patientInitials || '--')}</span>
                            <span>#${escapeHtml(ticket.position || '-')}</span>
                        </li>
                    `
                )
                .join('');
        }
    }
}

function renderQueueTable(viewState) {
    const tableBody = document.getElementById('queueTableBody');
    if (!tableBody) return;

    const tickets = Array.isArray(viewState?.tickets) ? viewState.tickets : [];
    if (tickets.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-message">Sin tickets en cola.</td>
            </tr>
        `;
        return;
    }

    tableBody.innerHTML = tickets
        .map((ticket) => {
            const id = Number(ticket.id || 0);
            const status = String(ticket.status || 'waiting');
            const canCall = status === 'waiting' || status === 'called';
            const canRelease = status === 'called';
            const isTerminal = TERMINAL_QUEUE_STATUSES.has(status);
            const canResolve = !isTerminal;
            const canAssignConsultorio = !isTerminal;
            const reprintBusy = queueUiState.reprintInFlightIds.has(String(id));
            const waitMinutes = getTicketWaitMinutes(ticket);
            const hasSlaRisk = isSlaRiskTicket(ticket);
            const rowClass = hasSlaRisk ? 'queue-row-risk' : '';
            const waitLabel = Number.isFinite(waitMinutes)
                ? `${waitMinutes}m`
                : '--';

            return `
                <tr class="${rowClass}">
                    <td>${escapeHtml(ticket.ticketCode || '--')}</td>
                    <td>${escapeHtml(ticket.queueType || '--')}</td>
                    <td>${escapeHtml(QUEUE_PRIORITY_LABELS[ticket.priorityClass] || ticket.priorityClass || '--')}</td>
                    <td class="queue-status-cell">
                        <span>${escapeHtml(QUEUE_STATUS_LABELS[status] || status)}</span>
                        ${
                            hasSlaRisk
                                ? `<small class="queue-risk-note">SLA > ${QUEUE_SLA_RISK_MINUTES}m</small>`
                                : ''
                        }
                    </td>
                    <td>${escapeHtml(ticket.assignedConsultorio || '-')}</td>
                    <td>
                        <span>${escapeHtml(formatDateTime(ticket.createdAt))}</span>
                        <small class="queue-wait-note">Espera: ${escapeHtml(waitLabel)}</small>
                    </td>
                    <td>${escapeHtml(ticket.patientInitials || '--')}</td>
                    <td>
                        <div class="queue-actions">
                            <button
                                type="button"
                                class="btn btn-secondary btn-sm"
                                data-action="queue-reprint-ticket"
                                data-queue-id="${id}"
                                ${reprintBusy ? 'disabled aria-disabled="true"' : ''}
                            >
                                ${reprintBusy ? 'Reimprimiendo...' : 'Reimprimir'}
                            </button>
                            ${
                                canCall
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="re-llamar" data-queue-id="${id}">
                                Re-llamar
                            </button>`
                                    : ''
                            }
                            ${
                                canRelease
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="liberar" data-queue-id="${id}">
                                Liberar
                            </button>`
                                    : ''
                            }
                            ${
                                canResolve
                                    ? `<button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="completar" data-queue-id="${id}">
                                Completar
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="no_show" data-queue-id="${id}">
                                No show
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="cancelar" data-queue-id="${id}">
                                Cancelar
                            </button>`
                                    : ''
                            }
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="1" data-queue-id="${id}" ${canAssignConsultorio ? '' : 'disabled'}>
                                C1
                            </button>
                            <button type="button" class="btn btn-secondary btn-sm" data-action="queue-ticket-action" data-queue-action="reasignar" data-queue-consultorio="2" data-queue-id="${id}" ${canAssignConsultorio ? '' : 'disabled'}>
                                C2
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        })
        .join('');
}

function renderQueueSection() {
    ensureQueueTriageControls();
    renderQueueActivityPanel();
    const viewState = buildQueueViewState();
    queueUiState.lastViewState = viewState;
    syncQueueTriageControls(viewState);
    renderQueueOverview();
    renderQueueOperationalInsights();
    renderQueueTable(viewState);
    const tableWrap = document.querySelector('#queue .queue-admin-table-wrap');
    if (tableWrap instanceof HTMLElement) {
        tableWrap.setAttribute(
            'aria-busy',
            String(
                queueUiState.bulkActionInFlight ||
                    queueUiState.bulkReprintInFlight
            )
        );
    }
}

async function runQueueRealtimeTick() {
    if (!queueUiState.realtimeEnabled) return;

    if (!isQueueSectionActive()) {
        updateQueueSyncState('paused', 'Cola en pausa');
        clearQueueRealtimeTimer();
        return;
    }

    if (document.hidden) {
        updateQueueSyncState('paused', 'Cola en pausa (pestana oculta)');
        scheduleQueueRealtimeTick();
        return;
    }

    if (navigator.onLine === false) {
        queueUiState.realtimeFailureStreak += 1;
        updateQueueSyncState('offline', 'Sin conexion al backend', {
            log: true,
            level: 'warning',
            reason: 'Realtime',
        });
        scheduleQueueRealtimeTick();
        return;
    }

    if (queueUiState.realtimeRequestInFlight) {
        scheduleQueueRealtimeTick();
        return;
    }

    queueUiState.realtimeRequestInFlight = true;
    const refreshed = await refreshQueueRealtime({
        silent: true,
        fromRealtime: true,
    });
    queueUiState.realtimeRequestInFlight = false;

    if (refreshed && queueUiState.lastRefreshMode === 'live') {
        queueUiState.realtimeFailureStreak = 0;
        updateQueueSyncState('live', 'Cola en vivo', {
            log: true,
            level: 'info',
            reason: 'Realtime',
        });
        evaluateQueueFreshness({ log: true });
    } else if (refreshed && queueUiState.lastRefreshMode === 'snapshot') {
        queueUiState.realtimeFailureStreak += 1;
        const retrySeconds = Math.max(
            1,
            Math.ceil(getRealtimeDelayMs() / 1000)
        );
        updateQueueSyncState(
            'reconnecting',
            `Respaldo local activo · reconectando en ${retrySeconds}s`,
            {
                log: true,
                level: 'warning',
                reason: 'Realtime',
            }
        );
    } else {
        queueUiState.realtimeFailureStreak += 1;
        const retrySeconds = Math.max(
            1,
            Math.ceil(getRealtimeDelayMs() / 1000)
        );
        updateQueueSyncState(
            'reconnecting',
            `Reintentando en ${retrySeconds}s`,
            {
                log: true,
                level: 'warning',
                reason: 'Realtime',
            }
        );
    }

    scheduleQueueRealtimeTick();
}

export function isQueueSectionActive() {
    return (
        document.querySelector('.nav-item.active')?.dataset.section === 'queue'
    );
}

export async function refreshQueueRealtime({
    silent = false,
    fromRealtime = false,
} = {}) {
    try {
        const payload = await apiRequest('data');
        const data = payload.data || {};
        setQueueTickets(
            Array.isArray(data.queue_tickets) ? data.queue_tickets : []
        );
        setQueueMeta(
            data.queueMeta && typeof data.queueMeta === 'object'
                ? data.queueMeta
                : null
        );
        queueUiState.lastRefreshMode = 'live';
        queueUiState.lastHealthySyncAt = Date.now();
        persistQueueSnapshot();
        emitQueueOpsEvent('sync_success', {
            source: fromRealtime ? 'realtime' : 'manual',
            queueCount: Array.isArray(data.queue_tickets)
                ? data.queue_tickets.length
                : 0,
        });
        renderQueueSection();
        const freshness = evaluateQueueFreshness({
            log: !fromRealtime && isQueueSectionActive(),
        });
        if (!fromRealtime && isQueueSectionActive() && !freshness.stale) {
            updateQueueSyncState('live', 'Cola sincronizada', {
                log: true,
                level: 'info',
                reason: 'Sincronizacion manual',
            });
        }
        return true;
    } catch (error) {
        const restoredSnapshot = restoreQueueSnapshot(loadQueueSnapshot(), {
            source: fromRealtime ? 'realtime_error' : 'manual_error',
        });
        queueUiState.lastRefreshMode = restoredSnapshot ? 'snapshot' : 'error';
        if (restoredSnapshot) {
            emitQueueOpsEvent('sync_fallback_snapshot', {
                source: fromRealtime ? 'realtime' : 'manual',
            });
        } else {
            emitQueueOpsEvent('sync_failed', {
                source: fromRealtime ? 'realtime' : 'manual',
                error: normalizeErrorMessage(error),
            });
        }

        if (!fromRealtime && isQueueSectionActive()) {
            updateQueueSyncState(
                navigator.onLine === false ? 'offline' : 'reconnecting',
                restoredSnapshot
                    ? 'Respaldo local activo'
                    : navigator.onLine === false
                      ? 'Sin conexion al backend'
                      : 'No se pudo sincronizar cola',
                {
                    log: true,
                    level: restoredSnapshot
                        ? 'warning'
                        : navigator.onLine === false
                          ? 'warning'
                          : 'error',
                    reason: 'Sincronizacion manual',
                }
            );
        }
        if (!silent && !restoredSnapshot) {
            showToast(
                `No se pudo actualizar turnero: ${error.message}`,
                'warning'
            );
        }
        return restoredSnapshot;
    }
}

export function loadQueueSection() {
    if (!queueUiState.snapshotLoaded) {
        queueUiState.snapshotLoaded = true;
        const snapshot = loadQueueSnapshot();
        if (
            snapshot &&
            (!Array.isArray(currentQueueTickets) ||
                currentQueueTickets.length === 0)
        ) {
            restoreQueueSnapshot(snapshot, { source: 'startup' });
        }
    }

    renderQueueSection();
    updateQueueSyncState('paused', 'Sincronizacion lista');
    if (!queueUiState.activityLog.length) {
        pushQueueActivity('Consola de turnero lista para operacion', {
            level: 'info',
        });
    }
    void refreshQueueRealtime({ silent: true });
}

export function startQueueRealtimeSync({ immediate = true } = {}) {
    queueUiState.realtimeEnabled = true;
    queueUiState.realtimeFailureStreak = 0;
    if (!isQueueSectionActive()) {
        updateQueueSyncState('paused', 'Cola en pausa');
        clearQueueRealtimeTimer();
        return;
    }

    if (immediate) {
        updateQueueSyncState('live', 'Sincronizando cola...');
        clearQueueRealtimeTimer();
        void runQueueRealtimeTick();
        return;
    }

    updateQueueSyncState('live', 'Cola en vivo');
    scheduleQueueRealtimeTick();
}

export function stopQueueRealtimeSync({ reason = 'paused' } = {}) {
    queueUiState.realtimeEnabled = false;
    queueUiState.realtimeFailureStreak = 0;
    queueUiState.realtimeRequestInFlight = false;
    clearQueueRealtimeTimer();

    const reasonText = String(reason || 'paused').toLowerCase();
    if (reasonText === 'offline') {
        updateQueueSyncState('offline', 'Sin conexion al backend');
        return;
    }
    if (reasonText === 'hidden') {
        updateQueueSyncState('paused', 'Cola en pausa (pestana oculta)');
        return;
    }
    updateQueueSyncState('paused', 'Cola en pausa');
}

export async function callNextForConsultorio(consultorio) {
    const room = Number(consultorio || 0);
    if (![1, 2].includes(room)) {
        showToast('Consultorio invalido', 'error');
        return;
    }
    const roomKey = String(room);
    if (queueUiState.pendingCallByConsultorio.has(roomKey)) {
        return;
    }

    queueUiState.pendingCallByConsultorio.add(roomKey);
    renderQueueOverview();

    try {
        const payload = await apiRequest('queue-call-next', {
            method: 'POST',
            body: { consultorio: room },
        });
        const ticket = payload?.data?.ticket || null;
        updateTicketInState(ticket);
        setQueueMeta(
            normalizeQueueMetaFromState(payload?.data?.queueState || {})
        );
        renderQueueSection();
        if (ticket && ticket.ticketCode) {
            pushQueueActivity(
                `Llamado en C${room}: ${ticket.ticketCode} (${ticket.patientInitials || '--'})`,
                { level: 'info' }
            );
            showToast(
                `Llamando ${ticket.ticketCode} en Consultorio ${room}`,
                'success'
            );
            emitQueueOpsEvent('call_next_success', {
                consultorio: room,
                ticketId: Number(ticket.id || 0),
                ticketCode: String(ticket.ticketCode || ''),
            });
        } else {
            pushQueueActivity(`Llamado en C${room} sin ticket asignado`, {
                level: 'warning',
            });
            showToast(`Consultorio ${room} actualizado`, 'success');
            emitQueueOpsEvent('call_next_empty', {
                consultorio: room,
            });
        }
    } catch (error) {
        if (isConsultorioBusyError(error)) {
            await refreshQueueRealtime({ silent: true });
            pushQueueActivity(
                `C${room} ocupado: ${normalizeErrorMessage(error)}`,
                { level: 'warning' }
            );
            showToast(normalizeErrorMessage(error), 'warning');
            emitQueueOpsEvent('call_next_busy', {
                consultorio: room,
                error: normalizeErrorMessage(error),
            });
            return;
        }
        pushQueueActivity(
            `Error llamando siguiente en C${room}: ${normalizeErrorMessage(error)}`,
            { level: 'error' }
        );
        showToast(
            `No se pudo llamar siguiente turno: ${normalizeErrorMessage(error)}`,
            'error'
        );
        emitQueueOpsEvent('call_next_failed', {
            consultorio: room,
            error: normalizeErrorMessage(error),
        });
    } finally {
        queueUiState.pendingCallByConsultorio.delete(roomKey);
        renderQueueOverview();
    }
}

async function requestQueueTicketAction(ticketId, action, consultorio = null) {
    const id = Number(ticketId || 0);
    if (!id || !action) {
        throw new Error('Accion de ticket invalida');
    }

    const body = { id, action };
    const room = Number(consultorio || 0);
    if ([1, 2].includes(room)) {
        body.consultorio = room;
    }

    const payload = await apiRequest('queue-ticket', {
        method: 'PATCH',
        body,
    });
    const ticket = payload?.data?.ticket || null;
    updateTicketInState(ticket);
    setQueueMeta(normalizeQueueMetaFromState(payload?.data?.queueState || {}));
    return ticket;
}

export async function applyQueueTicketAction(
    ticketId,
    action,
    consultorio = null,
    { silent = false, skipRender = false } = {}
) {
    try {
        const ticket = await requestQueueTicketAction(
            ticketId,
            action,
            consultorio
        );
        if (!skipRender) {
            renderQueueSection();
        }
        if (!silent) {
            pushQueueActivity(
                queueActionSuccessMessage(action, ticket?.ticketCode || ''),
                { level: 'info' }
            );
            showToast(
                queueActionSuccessMessage(action, ticket?.ticketCode || ''),
                'success'
            );
        }
        emitQueueOpsEvent('ticket_action_success', {
            action: String(action || ''),
            ticketId: Number(ticketId || 0),
            consultorio: Number(consultorio || 0) || null,
        });
        return true;
    } catch (error) {
        if (isConsultorioBusyError(error)) {
            await refreshQueueRealtime({ silent: true });
            if (!silent) {
                pushQueueActivity(normalizeErrorMessage(error), {
                    level: 'warning',
                });
                showToast(normalizeErrorMessage(error), 'warning');
            }
            emitQueueOpsEvent('ticket_action_busy', {
                action: String(action || ''),
                ticketId: Number(ticketId || 0),
                error: normalizeErrorMessage(error),
            });
            return false;
        }
        if (!silent) {
            pushQueueActivity(
                `Error al actualizar ticket: ${normalizeErrorMessage(error)}`,
                { level: 'error' }
            );
            showToast(
                `No se pudo actualizar ticket: ${normalizeErrorMessage(error)}`,
                'error'
            );
        }
        emitQueueOpsEvent('ticket_action_failed', {
            action: String(action || ''),
            ticketId: Number(ticketId || 0),
            error: normalizeErrorMessage(error),
        });
        return false;
    }
}

export async function runQueueBulkAction(action) {
    const normalizedAction = String(action || '').toLowerCase();
    if (!QUEUE_BULK_ACTION_ORDER.includes(normalizedAction)) {
        showToast('Accion masiva invalida', 'error');
        return { ok: false, success: 0, failed: 0 };
    }
    if (queueUiState.bulkActionInFlight) {
        return { ok: false, success: 0, failed: 0 };
    }

    const viewState = queueUiState.lastViewState || buildQueueViewState();
    const eligibleTickets = getBulkEligibleTickets(normalizedAction, viewState);
    if (eligibleTickets.length === 0) {
        pushQueueActivity(
            `Bulk ${normalizedAction}: sin tickets visibles elegibles`,
            { level: 'info' }
        );
        showToast(
            `No hay tickets visibles para ${getBulkActionLabel(normalizedAction).toLowerCase()}.`,
            'info'
        );
        return { ok: false, success: 0, failed: 0 };
    }

    const confirmed = window.confirm(
        `Se aplicara "${getBulkActionLabel(normalizedAction)}" a ${eligibleTickets.length} ticket(s) visibles. Deseas continuar?`
    );
    if (!confirmed) {
        return { ok: false, success: 0, failed: 0 };
    }

    queueUiState.bulkActionInFlight = true;
    renderQueueSection();
    emitQueueOpsEvent('bulk_action_started', {
        action: normalizedAction,
        requested: eligibleTickets.length,
    });

    let success = 0;
    let failed = 0;
    try {
        for (const ticket of eligibleTickets) {
            const ok = await applyQueueTicketAction(
                Number(ticket?.id || 0),
                normalizedAction,
                null,
                {
                    silent: true,
                    skipRender: true,
                }
            );
            if (ok) {
                success += 1;
            } else {
                failed += 1;
            }
        }
        await refreshQueueRealtime({ silent: true });
    } finally {
        queueUiState.bulkActionInFlight = false;
        renderQueueSection();
    }

    if (success > 0 && failed === 0) {
        pushQueueActivity(
            `Bulk ${normalizedAction}: ${success} ticket(s) procesados`,
            { level: 'info' }
        );
        showToast(
            `${getBulkActionLabel(normalizedAction)} aplicado a ${success} ticket(s).`,
            'success'
        );
        emitQueueOpsEvent('bulk_action_success', {
            action: normalizedAction,
            success,
            failed,
        });
        return { ok: true, success, failed };
    }
    if (success > 0) {
        pushQueueActivity(
            `Bulk ${normalizedAction}: ${success} exitos y ${failed} fallos`,
            { level: 'warning' }
        );
        showToast(
            `${getBulkActionLabel(normalizedAction)} parcial: ${success} exitos, ${failed} fallos.`,
            'warning'
        );
        emitQueueOpsEvent('bulk_action_partial', {
            action: normalizedAction,
            success,
            failed,
        });
        return { ok: true, success, failed };
    }
    pushQueueActivity(`Bulk ${normalizedAction}: fallo total`, {
        level: 'error',
    });
    showToast(
        `No se pudo aplicar ${getBulkActionLabel(normalizedAction).toLowerCase()} en tickets visibles.`,
        'error'
    );
    emitQueueOpsEvent('bulk_action_failed', {
        action: normalizedAction,
        success,
        failed,
    });
    return { ok: false, success, failed };
}

export async function runQueueBulkReprint() {
    if (queueUiState.bulkReprintInFlight) {
        return { ok: false, success: 0, failed: 0 };
    }

    const viewState = queueUiState.lastViewState || buildQueueViewState();
    const visibleTickets = Array.isArray(viewState?.tickets)
        ? viewState.tickets
        : [];
    if (visibleTickets.length <= 0) {
        showToast('No hay tickets visibles para reimprimir.', 'info');
        return { ok: false, success: 0, failed: 0 };
    }

    const targetTickets = visibleTickets.slice(0, QUEUE_BULK_REPRINT_MAX);
    const confirmed = window.confirm(
        `Se reimprimiran ${targetTickets.length} ticket(s) visibles. Deseas continuar?`
    );
    if (!confirmed) {
        return { ok: false, success: 0, failed: 0 };
    }

    queueUiState.bulkReprintInFlight = true;
    renderQueueSection();
    emitQueueOpsEvent('bulk_reprint_started', {
        requested: targetTickets.length,
    });

    let success = 0;
    let failed = 0;
    try {
        for (const ticket of targetTickets) {
            const ticketId = Number(ticket?.id || 0);
            if (!ticketId) {
                failed += 1;
                continue;
            }
            try {
                const response = await requestQueueReprint(ticketId);
                if (response.payload?.printed) {
                    success += 1;
                } else {
                    failed += 1;
                }
            } catch (_error) {
                failed += 1;
            }
        }
    } finally {
        queueUiState.bulkReprintInFlight = false;
        renderQueueSection();
    }

    if (success > 0 && failed === 0) {
        pushQueueActivity(`Bulk reimpresion: ${success} ticket(s) reimpresos`, {
            level: 'info',
        });
        showToast(`Reimpresion completa: ${success} ticket(s).`, 'success');
        emitQueueOpsEvent('bulk_reprint_success', {
            success,
            failed,
        });
        return { ok: true, success, failed };
    }

    if (success > 0) {
        pushQueueActivity(
            `Bulk reimpresion parcial: ${success} exitos y ${failed} fallos`,
            { level: 'warning' }
        );
        showToast(
            `Reimpresion parcial: ${success} exitos, ${failed} fallos.`,
            'warning'
        );
        emitQueueOpsEvent('bulk_reprint_partial', {
            success,
            failed,
        });
        return { ok: true, success, failed };
    }

    pushQueueActivity('Bulk reimpresion: fallo total', { level: 'error' });
    showToast('No se pudo reimprimir tickets visibles.', 'error');
    emitQueueOpsEvent('bulk_reprint_failed', {
        success,
        failed,
    });
    return { ok: false, success, failed };
}

export function setQueueFilter(filter) {
    queueUiState.activeFilter = normalizeQueueFilter(filter);
    renderQueueSection();
}

export function focusQueueSearch() {
    ensureQueueTriageControls();
    const input = document.getElementById('queueSearchInput');
    if (!(input instanceof HTMLInputElement)) return;
    input.focus({ preventScroll: true });
    input.select();
}

export async function reprintQueueTicket(ticketId) {
    const id = Number(ticketId || 0);
    if (!id) {
        showToast('Ticket invalido para reimpresion', 'error');
        return;
    }
    const ticketKey = String(id);
    if (queueUiState.reprintInFlightIds.has(ticketKey)) {
        return;
    }

    queueUiState.reprintInFlightIds.add(ticketKey);
    renderQueueSection();
    emitQueueOpsEvent('reprint_started', { ticketId: id });

    try {
        const response = await requestQueueReprint(id);
        const payload = response.payload || {};
        if (payload?.printed) {
            pushQueueActivity(`Ticket #${id} reimpreso`, { level: 'info' });
            showToast('Ticket reimpreso', 'success');
            emitQueueOpsEvent('reprint_success', { ticketId: id });
        } else {
            const detail = getPrinterErrorMessage(payload, {
                fallback: 'sin detalle',
            });
            pushQueueActivity(
                `Ticket #${id} generado sin impresion (${detail})`,
                { level: 'warning' }
            );
            showToast(`Ticket generado sin impresion: ${detail}`, 'warning');
            emitQueueOpsEvent('reprint_degraded', {
                ticketId: id,
                detail,
                statusCode: Number(payload?.statusCode || 0),
            });
        }
    } catch (error) {
        const normalizedMessage = normalizeErrorMessage(error);
        pushQueueActivity(
            `Error al reimprimir ticket #${id}: ${normalizedMessage}`,
            { level: 'error' }
        );
        showToast(
            `No se pudo reimprimir ticket: ${normalizedMessage}`,
            'error'
        );
        emitQueueOpsEvent('reprint_failed', {
            ticketId: id,
            error: normalizedMessage,
        });
    } finally {
        queueUiState.reprintInFlightIds.delete(ticketKey);
        renderQueueSection();
    }
}
