import { apiRequest } from '../core/api-client.js';
import {
    getQueryParam,
    getStorageItem,
    setStorageItem,
    setStorageJson,
    getStorageJson,
    removeStorageItem,
} from '../core/persistence.js';
import { getState, updateState } from '../core/store.js';
import {
    escapeHtml,
    formatDateTime,
    setHtml,
    setText,
    createToast,
} from '../ui/render.js';

const QUEUE_STATION_MODE_STORAGE_KEY = 'queueStationMode';
const QUEUE_STATION_CONSULTORIO_STORAGE_KEY = 'queueStationConsultorio';
const QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY = 'queueOneTapAdvance';
const QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY = 'queueCallKeyBindingV1';
const QUEUE_HELP_STORAGE_KEY = 'queueNumpadHelpOpen';
const QUEUE_SNAPSHOT_STORAGE_KEY = 'queueAdminLastSnapshot';
const CALL_NEXT_IN_FLIGHT = new Map([
    [1, false],
    [2, false],
]);
let LAST_WATCHDOG_BUCKET = '';
const SENSITIVE_QUEUE_ACTIONS = new Set(['no_show', 'cancelar']);

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

function normalizeStatus(value) {
    const normalized = normalize(value);
    if (['waiting', 'wait', 'en_espera', 'espera'].includes(normalized))
        return 'waiting';
    if (['called', 'calling', 'llamado'].includes(normalized)) return 'called';
    if (['completed', 'complete', 'completar', 'done'].includes(normalized))
        return 'completed';
    if (
        ['no_show', 'noshow', 'no-show', 'no show', 'no_asistio'].includes(
            normalized
        )
    )
        return 'no_show';
    if (['cancelled', 'canceled', 'cancelar', 'cancelado'].includes(normalized))
        return 'cancelled';
    return normalized || 'waiting';
}

function normalizeQueueAction(value) {
    const normalized = normalize(value);
    if (['complete', 'completed', 'completar'].includes(normalized))
        return 'completar';
    if (['no_show', 'noshow', 'no-show', 'no show'].includes(normalized))
        return 'no_show';
    if (
        ['cancel', 'cancelled', 'canceled', 'cancelar', 'cancelado'].includes(
            normalized
        )
    )
        return 'cancelar';
    if (['reasignar', 'reassign'].includes(normalized)) return 'reasignar';
    if (['re-llamar', 'rellamar', 'recall', 'llamar'].includes(normalized))
        return 're-llamar';
    if (['liberar', 'release'].includes(normalized)) return 'liberar';
    return normalized;
}

function statusLabel(status) {
    switch (normalizeStatus(status)) {
        case 'waiting':
            return 'En espera';
        case 'called':
            return 'Llamado';
        case 'completed':
            return 'Completado';
        case 'no_show':
            return 'No asistio';
        case 'cancelled':
            return 'Cancelado';
        default:
            return String(status || '--');
    }
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function toFiniteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function toMillis(value) {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function coalesceNonEmptyString(...values) {
    for (const value of values) {
        const text = String(value ?? '').trim();
        if (text) return text;
    }
    return '';
}

function appendActivity(message) {
    updateState((state) => {
        const nextActivity = [
            {
                at: new Date().toISOString(),
                message: String(message || ''),
            },
            ...(state.queue.activity || []),
        ].slice(0, 30);

        return {
            ...state,
            queue: {
                ...state.queue,
                activity: nextActivity,
            },
        };
    });

    try {
        renderQueueActivity();
    } catch (_error) {
        // queue UI may not be mounted yet
    }
}

function persistQueueUi(state) {
    setStorageItem(
        QUEUE_STATION_MODE_STORAGE_KEY,
        state.queue.stationMode || 'free'
    );
    setStorageItem(
        QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
        state.queue.stationConsultorio || 1
    );
    setStorageItem(
        QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
        state.queue.oneTap ? '1' : '0'
    );
    setStorageItem(QUEUE_HELP_STORAGE_KEY, state.queue.helpOpen ? '1' : '0');

    if (state.queue.customCallKey) {
        setStorageJson(
            QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
            state.queue.customCallKey
        );
    } else {
        removeStorageItem(QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY);
    }

    setStorageJson(QUEUE_SNAPSHOT_STORAGE_KEY, {
        queueMeta: state.data.queueMeta,
        queueTickets: state.data.queueTickets,
        updatedAt: new Date().toISOString(),
    });
}

function readQueueUiDefaults() {
    const stationMode =
        normalize(getStorageItem(QUEUE_STATION_MODE_STORAGE_KEY, 'free')) ===
        'locked'
            ? 'locked'
            : 'free';
    const stationConsultorio =
        Number(getStorageItem(QUEUE_STATION_CONSULTORIO_STORAGE_KEY, '1')) === 2
            ? 2
            : 1;
    const oneTap =
        getStorageItem(QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY, '0') === '1';
    const helpOpen = getStorageItem(QUEUE_HELP_STORAGE_KEY, '0') === '1';
    const customCallKey = getStorageJson(
        QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
        null
    );

    return {
        stationMode,
        stationConsultorio,
        oneTap,
        helpOpen,
        customCallKey,
    };
}

function normalizeTicket(raw, fallbackIndex = 0) {
    const id = Number(raw?.id || raw?.ticket_id || fallbackIndex + 1);
    return {
        id,
        ticketCode: String(raw?.ticketCode || raw?.ticket_code || `A-${id}`),
        queueType: String(raw?.queueType || raw?.queue_type || 'walk_in'),
        patientInitials: String(
            raw?.patientInitials || raw?.patient_initials || '--'
        ),
        priorityClass: String(
            raw?.priorityClass || raw?.priority_class || 'walk_in'
        ),
        status: normalizeStatus(raw?.status || 'waiting'),
        assignedConsultorio:
            Number(
                raw?.assignedConsultorio || raw?.assigned_consultorio || 0
            ) === 2
                ? 2
                : Number(
                        raw?.assignedConsultorio ||
                            raw?.assigned_consultorio ||
                            0
                    ) === 1
                  ? 1
                  : null,
        createdAt: String(
            raw?.createdAt || raw?.created_at || new Date().toISOString()
        ),
        calledAt: String(raw?.calledAt || raw?.called_at || ''),
        completedAt: String(raw?.completedAt || raw?.completed_at || ''),
    };
}

function normalizeMetaTicket(raw, fallbackIndex = 0, overrides = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const normalized = normalizeTicket(
        {
            ...source,
            ...overrides,
        },
        fallbackIndex
    );

    if (!coalesceNonEmptyString(source.createdAt, source.created_at)) {
        normalized.createdAt = '';
    }
    if (!coalesceNonEmptyString(source.priorityClass, source.priority_class)) {
        normalized.priorityClass = '';
    }
    if (!coalesceNonEmptyString(source.queueType, source.queue_type)) {
        normalized.queueType = '';
    }
    if (
        !coalesceNonEmptyString(source.patientInitials, source.patient_initials)
    ) {
        normalized.patientInitials = '';
    }

    return normalized;
}

function buildQueueMeta(tickets) {
    const waiting = tickets.filter((item) => item.status === 'waiting');
    const called = tickets.filter((item) => item.status === 'called');

    const nowByConsultorio = {
        1: called.find((item) => item.assignedConsultorio === 1) || null,
        2: called.find((item) => item.assignedConsultorio === 2) || null,
    };

    return {
        updatedAt: new Date().toISOString(),
        waitingCount: waiting.length,
        calledCount: called.length,
        counts: {
            waiting: waiting.length,
            called: called.length,
            completed: tickets.filter((item) => item.status === 'completed')
                .length,
            no_show: tickets.filter((item) => item.status === 'no_show').length,
            cancelled: tickets.filter((item) => item.status === 'cancelled')
                .length,
        },
        callingNowByConsultorio: nowByConsultorio,
        nextTickets: waiting.slice(0, 5).map((item, index) => ({
            id: item.id,
            ticketCode: item.ticketCode,
            patientInitials: item.patientInitials,
            position: index + 1,
        })),
    };
}

function normalizeQueueMeta(rawMeta, tickets = []) {
    const meta = rawMeta && typeof rawMeta === 'object' ? rawMeta : {};
    const counts =
        meta.counts && typeof meta.counts === 'object' ? meta.counts : {};
    const callingByConsultorio =
        meta.callingNowByConsultorio &&
        typeof meta.callingNowByConsultorio === 'object'
            ? meta.callingNowByConsultorio
            : meta.calling_now_by_consultorio &&
                typeof meta.calling_now_by_consultorio === 'object'
              ? meta.calling_now_by_consultorio
              : {};
    const callingNowList = asArray(meta.callingNow).concat(
        asArray(meta.calling_now)
    );
    const fromTickets = asArray(tickets).map((ticket, index) =>
        normalizeTicket(ticket, index)
    );

    const c1Raw =
        callingByConsultorio['1'] ||
        callingByConsultorio[1] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === 1
        ) ||
        null;
    const c2Raw =
        callingByConsultorio['2'] ||
        callingByConsultorio[2] ||
        callingNowList.find(
            (item) =>
                Number(
                    item?.assignedConsultorio || item?.assigned_consultorio || 0
                ) === 2
        ) ||
        null;

    const c1 = c1Raw
        ? normalizeMetaTicket(c1Raw, 0, {
              status: 'called',
              assignedConsultorio: 1,
          })
        : null;
    const c2 = c2Raw
        ? normalizeMetaTicket(c2Raw, 1, {
              status: 'called',
              assignedConsultorio: 2,
          })
        : null;

    const nextTickets = asArray(meta.nextTickets)
        .concat(asArray(meta.next_tickets))
        .map((item, index) =>
            normalizeMetaTicket(
                {
                    ...item,
                    status: item?.status || 'waiting',
                    assignedConsultorio: null,
                },
                index
            )
        );

    const waitingFromTickets = fromTickets.filter(
        (ticket) => ticket.status === 'waiting'
    ).length;
    const calledFromTickets = fromTickets.filter(
        (ticket) => ticket.status === 'called'
    ).length;
    const calledCountFallback = Math.max(
        Number(Boolean(c1)) + Number(Boolean(c2)),
        calledFromTickets
    );

    const waitingCount = toFiniteNumber(
        meta.waitingCount ??
            meta.waiting_count ??
            counts.waiting ??
            nextTickets.length ??
            waitingFromTickets,
        0
    );
    const calledCount = toFiniteNumber(
        meta.calledCount ??
            meta.called_count ??
            counts.called ??
            calledCountFallback,
        0
    );
    const completedCount = toFiniteNumber(
        counts.completed ??
            meta.completedCount ??
            meta.completed_count ??
            fromTickets.filter((ticket) => ticket.status === 'completed')
                .length,
        0
    );
    const noShowCount = toFiniteNumber(
        counts.no_show ??
            counts.noShow ??
            meta.noShowCount ??
            meta.no_show_count ??
            fromTickets.filter((ticket) => ticket.status === 'no_show').length,
        0
    );
    const cancelledCount = toFiniteNumber(
        counts.cancelled ??
            counts.canceled ??
            meta.cancelledCount ??
            meta.cancelled_count ??
            fromTickets.filter((ticket) => ticket.status === 'cancelled')
                .length,
        0
    );

    return {
        updatedAt: String(
            meta.updatedAt || meta.updated_at || new Date().toISOString()
        ),
        waitingCount,
        calledCount,
        counts: {
            waiting: waitingCount,
            called: calledCount,
            completed: completedCount,
            no_show: noShowCount,
            cancelled: cancelledCount,
        },
        callingNowByConsultorio: {
            1: c1,
            2: c2,
        },
        nextTickets,
    };
}

function ticketIdentity(ticket) {
    const normalized = normalizeTicket(ticket, 0);
    if (normalized.id > 0) return `id:${normalized.id}`;
    return `code:${normalize(normalized.ticketCode || '')}`;
}

function buildTicketsFromMeta(queueMeta) {
    const meta = normalizeQueueMeta(queueMeta);
    const byIdentity = new Map();

    const addTicket = (ticket) => {
        if (!ticket) return;
        const normalized = normalizeTicket(ticket, byIdentity.size);
        if (!coalesceNonEmptyString(ticket?.createdAt, ticket?.created_at)) {
            normalized.createdAt = '';
        }
        if (
            !coalesceNonEmptyString(
                ticket?.priorityClass,
                ticket?.priority_class
            )
        ) {
            normalized.priorityClass = '';
        }
        if (!coalesceNonEmptyString(ticket?.queueType, ticket?.queue_type)) {
            normalized.queueType = '';
        }
        byIdentity.set(ticketIdentity(normalized), normalized);
    };

    const c1 =
        meta.callingNowByConsultorio?.['1'] ||
        meta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        meta.callingNowByConsultorio?.['2'] ||
        meta.callingNowByConsultorio?.[2] ||
        null;
    if (c1) addTicket({ ...c1, status: 'called', assignedConsultorio: 1 });
    if (c2) addTicket({ ...c2, status: 'called', assignedConsultorio: 2 });

    for (const nextTicket of asArray(meta.nextTickets)) {
        addTicket({
            ...nextTicket,
            status: 'waiting',
            assignedConsultorio: null,
        });
    }

    return Array.from(byIdentity.values());
}

function getQueueSource() {
    const state = getState();
    const queueTickets = Array.isArray(state.data.queueTickets)
        ? state.data.queueTickets.map((item, index) =>
              normalizeTicket(item, index)
          )
        : [];
    const queueMeta =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? normalizeQueueMeta(state.data.queueMeta, queueTickets)
            : buildQueueMeta(queueTickets);
    return { queueTickets, queueMeta };
}

function queueFilter(items, filter) {
    const normalized = normalize(filter);
    if (normalized === 'waiting') {
        return items.filter((item) => item.status === 'waiting');
    }
    if (normalized === 'called') {
        return items.filter((item) => item.status === 'called');
    }
    if (normalized === 'no_show') {
        return items.filter((item) => item.status === 'no_show');
    }
    if (normalized === 'sla_risk') {
        return items.filter((item) => {
            if (item.status !== 'waiting') return false;
            const ageMinutes = Math.max(
                0,
                Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
            );
            return (
                ageMinutes >= 20 ||
                normalize(item.priorityClass) === 'appt_overdue'
            );
        });
    }
    return items;
}

function queueSearch(items, searchTerm) {
    const term = normalize(searchTerm);
    if (!term) return items;
    return items.filter((item) => {
        const fields = [
            item.ticketCode,
            item.patientInitials,
            item.status,
            item.queueType,
        ];
        return fields.some((field) => normalize(field).includes(term));
    });
}

function getVisibleTickets() {
    const state = getState();
    const { queueTickets } = getQueueSource();
    return queueSearch(
        queueFilter(queueTickets, state.queue.filter),
        state.queue.search
    );
}

function normalizeSelectedQueueIds(ids, tickets = null) {
    const sourceTickets = Array.isArray(tickets)
        ? tickets
        : getQueueSource().queueTickets;
    const allowedIds = new Set(
        sourceTickets
            .map((ticket) => Number(ticket.id || 0))
            .filter((id) => id > 0)
    );

    return [...new Set(asArray(ids).map((id) => Number(id || 0)))]
        .filter((id) => id > 0 && allowedIds.has(id))
        .sort((a, b) => a - b);
}

function getSelectedQueueIds() {
    return normalizeSelectedQueueIds(getState().queue.selected || []);
}

function getSelectedQueueTickets() {
    const selectedIds = new Set(getSelectedQueueIds());
    if (!selectedIds.size) return [];
    return getQueueSource().queueTickets.filter((ticket) =>
        selectedIds.has(Number(ticket.id || 0))
    );
}

function getQueueTicketById(ticketId) {
    const targetId = Number(ticketId || 0);
    if (!targetId) return null;
    return (
        getQueueSource().queueTickets.find(
            (ticket) => Number(ticket.id || 0) === targetId
        ) || null
    );
}

function getBulkTargetTickets() {
    const selectedTickets = getSelectedQueueTickets();
    if (selectedTickets.length) return selectedTickets;
    return getVisibleTickets();
}

function setQueueSelection(nextSelected, { render = true } = {}) {
    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            selected: normalizeSelectedQueueIds(
                nextSelected,
                state.data.queueTickets || []
            ),
        },
    }));

    if (render) {
        renderQueueSection();
    }
}

export function toggleQueueTicketSelection(ticketId) {
    const targetId = Number(ticketId || 0);
    if (!targetId) return;
    const selectedIds = getSelectedQueueIds();
    const nextSelected = selectedIds.includes(targetId)
        ? selectedIds.filter((id) => id !== targetId)
        : [...selectedIds, targetId];
    setQueueSelection(nextSelected);
}

export function selectVisibleQueueTickets() {
    const visibleIds = getVisibleTickets().map((ticket) =>
        Number(ticket.id || 0)
    );
    setQueueSelection(visibleIds);
}

export function clearQueueSelection() {
    setQueueSelection([]);
}

function queueRow(ticket) {
    const consultorio = ticket.assignedConsultorio
        ? `C${ticket.assignedConsultorio}`
        : '-';
    const ageMinutes = Math.max(
        0,
        Math.round((Date.now() - toMillis(ticket.createdAt)) / 60000)
    );
    const id = Number(ticket.id || 0);
    const selectedIds = new Set(getSelectedQueueIds());
    const isSelected = selectedIds.has(id);
    const isCalled = ticket.status === 'called';
    const showRelease = isCalled && ticket.assignedConsultorio;
    const showRecall = isCalled;

    return `
        <tr data-queue-id="${id}" class="${isSelected ? 'is-selected' : ''}">
            <td>
                <label class="queue-select-cell">
                    <input type="checkbox" data-action="queue-toggle-ticket-select" data-queue-id="${id}" ${isSelected ? 'checked' : ''} />
                </label>
            </td>
            <td>${escapeHtml(ticket.ticketCode)}</td>
            <td>${escapeHtml(ticket.queueType)}</td>
            <td>${escapeHtml(statusLabel(ticket.status))}</td>
            <td>${consultorio}</td>
            <td>${ageMinutes} min</td>
            <td>
                <div class="table-actions">
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="1">Reasignar C1</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="reasignar" data-queue-consultorio="2">Reasignar C2</button>
                    ${showRecall ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="re-llamar" data-queue-consultorio="${Number(ticket.assignedConsultorio || 1) === 2 ? 2 : 1}">Re-llamar</button>` : ''}
                    ${showRelease ? `<button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="liberar">Liberar</button>` : ''}
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="completar">Completar</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="no_show">No show</button>
                    <button type="button" data-action="queue-ticket-action" data-queue-id="${id}" data-queue-action="cancelar">Cancelar</button>
                    <button type="button" data-action="queue-reprint-ticket" data-queue-id="${id}">Reimprimir</button>
                </div>
            </td>
        </tr>
    `;
}

function showSensitiveConfirm(actionPayload) {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    const message = document.getElementById('queueSensitiveConfirmMessage');
    if (message) {
        message.textContent = `Confirmar accion sensible: ${actionPayload.action}`;
    }

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            pendingSensitiveAction: actionPayload,
        },
    }));

    if (
        dialog instanceof HTMLDialogElement &&
        typeof dialog.showModal === 'function'
    ) {
        dialog.hidden = false;
        dialog.removeAttribute('hidden');
        if (!dialog.open) {
            try {
                dialog.showModal();
            } catch (_error) {
                dialog.setAttribute('open', '');
            }
        }
        return;
    }
    if (dialog instanceof HTMLElement) {
        dialog.setAttribute('open', '');
        dialog.hidden = false;
    }
}

function hideSensitiveConfirm() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    if (dialog instanceof HTMLDialogElement && dialog.open) {
        dialog.close();
    }
    if (dialog instanceof HTMLElement) {
        dialog.removeAttribute('open');
        dialog.hidden = true;
    }

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            pendingSensitiveAction: null,
        },
    }));
}

function setQueueStateWithTickets(tickets, queueMeta = null, options = {}) {
    const normalized = asArray(tickets).map((item, index) =>
        normalizeTicket(item, index)
    );
    const meta = normalizeQueueMeta(
        queueMeta && typeof queueMeta === 'object'
            ? queueMeta
            : buildQueueMeta(normalized),
        normalized
    );
    const waitingVisible = normalized.filter(
        (ticket) => ticket.status === 'waiting'
    ).length;
    const fallbackPartial =
        typeof options.fallbackPartial === 'boolean'
            ? options.fallbackPartial
            : Number(meta.waitingCount || 0) > waitingVisible;
    const syncMode =
        normalize(options.syncMode) === 'fallback'
            ? 'fallback'
            : fallbackPartial
              ? normalize(options.syncMode) === 'live'
                  ? 'live'
                  : 'fallback'
              : 'live';

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            queueTickets: normalized,
            queueMeta: meta,
        },
        queue: {
            ...state.queue,
            selected: normalizeSelectedQueueIds(
                state.queue.selected || [],
                normalized
            ),
            fallbackPartial,
            syncMode,
        },
    }));

    persistQueueUi(getState());
    renderQueueSection();
}

function mutateTicketLocal(ticketId, updater) {
    const targetId = Number(ticketId || 0);
    const nextTickets = (getState().data.queueTickets || []).map(
        (ticket, index) => {
            const normalized = normalizeTicket(ticket, index);
            if (normalized.id !== targetId) return normalized;
            return normalizeTicket(
                typeof updater === 'function'
                    ? updater(normalized)
                    : { ...normalized },
                index
            );
        }
    );
    setQueueStateWithTickets(nextTickets, buildQueueMeta(nextTickets), {
        fallbackPartial: false,
        syncMode: 'live',
    });
}

function updateQueueUi(patch) {
    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            ...patch,
        },
    }));
    persistQueueUi(getState());
    renderQueueSection();
}

function getCalledTicketForConsultorio(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    return (
        getQueueSource().queueTickets.find(
            (ticket) =>
                ticket.status === 'called' &&
                Number(ticket.assignedConsultorio || 0) === target
        ) || null
    );
}

function requiresSensitiveConfirm(action, ticket) {
    const normalizedAction = normalizeQueueAction(action);
    if (normalizedAction === 'cancelar') {
        return true;
    }
    if (normalizedAction !== 'no_show') {
        return false;
    }

    const currentTicket = ticket || null;
    if (!currentTicket) {
        return true;
    }

    return (
        normalizeStatus(currentTicket.status) === 'called' ||
        Number(currentTicket.assignedConsultorio || 0) > 0
    );
}

function setQueueNowMeta(queueMeta) {
    const state = getState();
    const meta = normalizeQueueMeta(queueMeta, state.data.queueTickets || []);
    const c1 =
        meta.callingNowByConsultorio?.['1'] ||
        meta.callingNowByConsultorio?.[1] ||
        null;
    const c2 =
        meta.callingNowByConsultorio?.['2'] ||
        meta.callingNowByConsultorio?.[2] ||
        null;
    const c1Code = c1
        ? String(c1.ticketCode || c1.ticket_code || 'A-000')
        : 'Sin llamado';
    const c2Code = c2
        ? String(c2.ticketCode || c2.ticket_code || 'A-000')
        : 'Sin llamado';

    setText(
        '#queueWaitingCountAdmin',
        Number(meta.waitingCount || meta.counts?.waiting || 0)
    );
    setText(
        '#queueCalledCountAdmin',
        Number(meta.calledCount || meta.counts?.called || 0)
    );
    setText('#queueC1Now', c1Code);
    setText('#queueC2Now', c2Code);

    const releaseC1 = document.getElementById('queueReleaseC1');
    if (releaseC1 instanceof HTMLButtonElement) {
        releaseC1.hidden = !c1;
        releaseC1.textContent = c1 ? `Liberar C1 · ${c1Code}` : 'Release C1';
        if (c1) {
            releaseC1.setAttribute('data-queue-id', String(Number(c1.id || 0)));
        } else {
            releaseC1.removeAttribute('data-queue-id');
        }
    }

    const releaseC2 = document.getElementById('queueReleaseC2');
    if (releaseC2 instanceof HTMLButtonElement) {
        releaseC2.hidden = !c2;
        releaseC2.textContent = c2 ? `Liberar C2 · ${c2Code}` : 'Release C2';
        if (c2) {
            releaseC2.setAttribute('data-queue-id', String(Number(c2.id || 0)));
        } else {
            releaseC2.removeAttribute('data-queue-id');
        }
    }

    const syncNode = document.getElementById('queueSyncStatus');
    if (normalize(state.queue.syncMode) === 'fallback') {
        setText('#queueSyncStatus', 'fallback');
        if (syncNode) syncNode.setAttribute('data-state', 'fallback');
        return;
    }

    const updatedAt = String(meta.updatedAt || '').trim();
    if (!updatedAt) return;

    const ageSec = Math.max(
        0,
        Math.round((Date.now() - toMillis(updatedAt)) / 1000)
    );
    const stale = ageSec >= 60;
    setText('#queueSyncStatus', stale ? `Watchdog (${ageSec}s)` : 'vivo');
    if (syncNode)
        syncNode.setAttribute('data-state', stale ? 'reconnecting' : 'live');

    if (stale) {
        const bucket = `stale-${Math.floor(ageSec / 15)}`;
        if (bucket !== LAST_WATCHDOG_BUCKET) {
            LAST_WATCHDOG_BUCKET = bucket;
            appendActivity('Watchdog de cola: realtime en reconnecting');
        }
        return;
    }

    LAST_WATCHDOG_BUCKET = 'live';
}

function renderQueueActivity() {
    const activity = getState().queue.activity || [];
    setHtml(
        '#queueActivityList',
        activity.length
            ? activity
                  .map(
                      (item) =>
                          `<li><span>${escapeHtml(formatDateTime(item.at))}</span><strong>${escapeHtml(item.message)}</strong></li>`
                  )
                  .join('')
            : '<li><span>-</span><strong>Sin actividad</strong></li>'
    );
}

export function renderQueueSection() {
    const state = getState();
    const { queueMeta } = getQueueSource();
    const visible = getVisibleTickets();
    const selectedIds = getSelectedQueueIds();
    const selectedCount = selectedIds.length;
    const bulkTargets = getBulkTargetTickets();
    const nextTickets = asArray(queueMeta.nextTickets);
    const waitingCount = Number(
        queueMeta.waitingCount || queueMeta.counts?.waiting || 0
    );

    setQueueNowMeta(queueMeta);

    setHtml(
        '#queueTableBody',
        visible.length
            ? visible.map(queueRow).join('')
            : '<tr><td colspan="7">No hay tickets para filtro</td></tr>'
    );

    const nextSummary =
        state.queue.fallbackPartial &&
        nextTickets.length &&
        waitingCount > nextTickets.length
            ? `<li><span>-</span><strong>Mostrando primeros ${nextTickets.length} de ${waitingCount} en espera</strong></li>`
            : '';
    setHtml(
        '#queueNextAdminList',
        nextTickets.length
            ? `${nextSummary}${nextTickets
                  .map(
                      (ticket) =>
                          `<li><span>${escapeHtml(ticket.ticketCode || ticket.ticket_code || '--')}</span><strong>${escapeHtml(
                              ticket.patientInitials ||
                                  ticket.patient_initials ||
                                  '--'
                          )}</strong></li>`
                  )
                  .join('')}`
            : '<li><span>-</span><strong>Sin siguientes</strong></li>'
    );

    const riskCount = visible.filter((item) => {
        if (item.status !== 'waiting') return false;
        const ageMinutes = Math.max(
            0,
            Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
        );
        return (
            ageMinutes >= 20 || normalize(item.priorityClass) === 'appt_overdue'
        );
    }).length;

    const summaryParts = [
        riskCount > 0 ? `riesgo: ${riskCount}` : 'sin riesgo',
    ];
    if (selectedCount > 0) summaryParts.push(`seleccion: ${selectedCount}`);
    if (state.queue.fallbackPartial) summaryParts.push('fallback parcial');
    setText('#queueTriageSummary', summaryParts.join(' | '));
    setText('#queueSelectedCount', selectedCount);

    const selectionChip = document.getElementById('queueSelectionChip');
    if (selectionChip instanceof HTMLElement) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }

    const selectVisibleBtn = document.getElementById('queueSelectVisibleBtn');
    if (selectVisibleBtn instanceof HTMLButtonElement) {
        selectVisibleBtn.disabled = visible.length === 0;
    }

    const clearSelectionBtn = document.getElementById('queueClearSelectionBtn');
    if (clearSelectionBtn instanceof HTMLButtonElement) {
        clearSelectionBtn.disabled = selectedCount === 0;
    }

    document
        .querySelectorAll(
            '[data-action="queue-bulk-action"], [data-action="queue-bulk-reprint"]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            button.disabled = bulkTargets.length === 0;
        });

    setText(
        '#queueStationBadge',
        `Estación C${state.queue.stationConsultorio}`
    );
    setText(
        '#queueStationModeBadge',
        state.queue.stationMode === 'locked' ? 'Bloqueado' : 'Libre'
    );

    const practiceBadge = document.getElementById('queuePracticeModeBadge');
    if (practiceBadge instanceof HTMLElement) {
        practiceBadge.hidden = !state.queue.practiceMode;
    }

    const shortcutPanel = document.getElementById('queueShortcutPanel');
    if (shortcutPanel instanceof HTMLElement) {
        shortcutPanel.hidden = !state.queue.helpOpen;
    }

    const clearKeyBtn = document.querySelector(
        '[data-action="queue-clear-call-key"]'
    );
    if (clearKeyBtn instanceof HTMLElement) {
        clearKeyBtn.hidden = !state.queue.customCallKey;
    }

    const oneTapBtn = document.querySelector(
        '[data-action="queue-toggle-one-tap"]'
    );
    if (oneTapBtn instanceof HTMLElement) {
        oneTapBtn.setAttribute(
            'aria-pressed',
            String(Boolean(state.queue.oneTap))
        );
        oneTapBtn.textContent = state.queue.oneTap
            ? '1 tecla ON'
            : '1 tecla OFF';
    }

    document
        .querySelectorAll(
            '[data-action="queue-call-next"][data-queue-consultorio]'
        )
        .forEach((button) => {
            if (!(button instanceof HTMLButtonElement)) return;
            const target =
                Number(button.dataset.queueConsultorio || 1) === 2 ? 2 : 1;
            button.disabled =
                state.queue.stationMode === 'locked' &&
                target !== Number(state.queue.stationConsultorio || 1);
        });

    const activeStationTicket = getCalledTicketForConsultorio(
        state.queue.stationConsultorio
    );
    const releaseStationButtons = document.querySelectorAll(
        '[data-action="queue-release-station"][data-queue-consultorio]'
    );
    releaseStationButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        const target =
            Number(button.dataset.queueConsultorio || 1) === 2 ? 2 : 1;
        const calledTicket = getCalledTicketForConsultorio(target);
        button.disabled = !calledTicket;
        if (
            state.queue.stationMode === 'locked' &&
            target !== Number(state.queue.stationConsultorio || 1)
        ) {
            button.disabled = true;
        }
    });

    if (activeStationTicket) {
        summaryParts.push(
            `activo: ${activeStationTicket.ticketCode} en C${state.queue.stationConsultorio}`
        );
        setText('#queueTriageSummary', summaryParts.join(' | '));
    }

    renderQueueActivity();
}

function extractTicketsFromPayload(queueState) {
    if (!queueState || typeof queueState !== 'object') return [];
    if (Array.isArray(queueState.queue_tickets))
        return queueState.queue_tickets;
    if (Array.isArray(queueState.queueTickets)) return queueState.queueTickets;
    if (Array.isArray(queueState.tickets)) return queueState.tickets;
    return [];
}

function hasOwnField(record, field) {
    return Object.prototype.hasOwnProperty.call(record || {}, field);
}

function hasExplicitQueueSignals(queueState, fullTickets, payloadTicket) {
    if (fullTickets.length > 0) return true;
    if (
        hasOwnField(queueState, 'queue_tickets') ||
        hasOwnField(queueState, 'queueTickets') ||
        hasOwnField(queueState, 'tickets')
    ) {
        return true;
    }
    if (payloadTicket && typeof payloadTicket === 'object') return true;

    const hasTopLevelCounts =
        hasOwnField(queueState, 'waitingCount') ||
        hasOwnField(queueState, 'waiting_count') ||
        hasOwnField(queueState, 'calledCount') ||
        hasOwnField(queueState, 'called_count') ||
        hasOwnField(queueState, 'completedCount') ||
        hasOwnField(queueState, 'completed_count') ||
        hasOwnField(queueState, 'noShowCount') ||
        hasOwnField(queueState, 'no_show_count') ||
        hasOwnField(queueState, 'cancelledCount') ||
        hasOwnField(queueState, 'cancelled_count');
    if (hasTopLevelCounts) return true;

    const counts =
        queueState?.counts && typeof queueState.counts === 'object'
            ? queueState.counts
            : null;
    if (
        counts &&
        (hasOwnField(counts, 'waiting') ||
            hasOwnField(counts, 'called') ||
            hasOwnField(counts, 'completed') ||
            hasOwnField(counts, 'no_show') ||
            hasOwnField(counts, 'noShow') ||
            hasOwnField(counts, 'cancelled') ||
            hasOwnField(counts, 'canceled'))
    ) {
        return true;
    }

    if (
        hasOwnField(queueState, 'nextTickets') ||
        hasOwnField(queueState, 'next_tickets')
    )
        return true;

    const callingByConsultorio =
        queueState?.callingNowByConsultorio &&
        typeof queueState.callingNowByConsultorio === 'object'
            ? queueState.callingNowByConsultorio
            : queueState?.calling_now_by_consultorio &&
                typeof queueState.calling_now_by_consultorio === 'object'
              ? queueState.calling_now_by_consultorio
              : null;
    if (
        callingByConsultorio &&
        (Boolean(callingByConsultorio[1]) ||
            Boolean(callingByConsultorio[2]) ||
            Boolean(callingByConsultorio['1']) ||
            Boolean(callingByConsultorio['2']))
    ) {
        return true;
    }

    const callingNow = asArray(queueState?.callingNow).concat(
        asArray(queueState?.calling_now)
    );
    return callingNow.some(Boolean);
}

function getQueueStateSignalFlags(queueState) {
    const counts =
        queueState?.counts && typeof queueState.counts === 'object'
            ? queueState.counts
            : null;
    const hasWaitingCount =
        hasOwnField(queueState, 'waitingCount') ||
        hasOwnField(queueState, 'waiting_count') ||
        Boolean(counts && hasOwnField(counts, 'waiting'));
    const hasCalledCount =
        hasOwnField(queueState, 'calledCount') ||
        hasOwnField(queueState, 'called_count') ||
        Boolean(counts && hasOwnField(counts, 'called'));
    const hasNextTickets =
        hasOwnField(queueState, 'nextTickets') ||
        hasOwnField(queueState, 'next_tickets');
    const hasCallingNow =
        hasOwnField(queueState, 'callingNowByConsultorio') ||
        hasOwnField(queueState, 'calling_now_by_consultorio') ||
        hasOwnField(queueState, 'callingNow') ||
        hasOwnField(queueState, 'calling_now');
    return {
        waiting: hasWaitingCount || hasNextTickets,
        called: hasCalledCount || hasCallingNow,
    };
}

function reconcilePartialMetaSignals(byIdentity, normalizedMeta, signalFlags) {
    const nowByConsultorio = normalizedMeta.callingNowByConsultorio || {};
    const calledCount = Number(
        normalizedMeta.calledCount || normalizedMeta.counts?.called || 0
    );
    const waitingCount = Number(
        normalizedMeta.waitingCount || normalizedMeta.counts?.waiting || 0
    );
    const nextTickets = asArray(normalizedMeta.nextTickets);

    const calledIdentities = new Set();
    const c1 = nowByConsultorio['1'] || nowByConsultorio[1] || null;
    const c2 = nowByConsultorio['2'] || nowByConsultorio[2] || null;
    if (c1) calledIdentities.add(ticketIdentity(c1));
    if (c2) calledIdentities.add(ticketIdentity(c2));

    const waitingIdentities = new Set(
        nextTickets.map((ticket) => ticketIdentity(ticket))
    );

    const canReconcileCalled = calledIdentities.size > 0 || calledCount === 0;
    const canReconcileWaiting =
        waitingIdentities.size > 0 || waitingCount === 0;
    const hasPartialWaitingList =
        waitingIdentities.size > 0 && waitingCount > waitingIdentities.size;

    for (const [identity, existingTicket] of byIdentity.entries()) {
        const normalized = normalizeTicket(existingTicket, 0);
        if (
            signalFlags.called &&
            canReconcileCalled &&
            normalized.status === 'called' &&
            !calledIdentities.has(identity)
        ) {
            byIdentity.set(
                identity,
                normalizeTicket(
                    {
                        ...normalized,
                        status: 'completed',
                        assignedConsultorio: null,
                        completedAt:
                            normalized.completedAt || new Date().toISOString(),
                    },
                    0
                )
            );
            continue;
        }

        if (
            !signalFlags.waiting ||
            !canReconcileWaiting ||
            normalized.status !== 'waiting'
        ) {
            continue;
        }
        if (waitingCount <= 0) {
            byIdentity.delete(identity);
            continue;
        }
        if (!hasPartialWaitingList && !waitingIdentities.has(identity)) {
            byIdentity.delete(identity);
        }
    }
}

function applyQueueStateResponse(payload, options = {}) {
    const queueState =
        payload?.data?.queueState ||
        payload?.data?.queue_state ||
        payload?.data?.queueMeta ||
        payload?.data ||
        null;
    if (!queueState || typeof queueState !== 'object') return;
    const fullTickets = extractTicketsFromPayload(queueState);
    const payloadTicket = payload?.data?.ticket || null;
    if (!hasExplicitQueueSignals(queueState, fullTickets, payloadTicket)) {
        return;
    }

    const syncMode =
        normalize(options.syncMode) === 'fallback' ? 'fallback' : 'live';
    const currentTickets = (getState().data.queueTickets || []).map(
        (item, index) => normalizeTicket(item, index)
    );
    const normalizedMeta = normalizeQueueMeta(queueState, currentTickets);
    const signalFlags = getQueueStateSignalFlags(queueState);
    const partialMetaTickets = buildTicketsFromMeta(normalizedMeta);
    const hasPayloadTicket = Boolean(
        payloadTicket && typeof payloadTicket === 'object'
    );
    if (
        !fullTickets.length &&
        !partialMetaTickets.length &&
        !hasPayloadTicket &&
        !signalFlags.waiting &&
        !signalFlags.called
    ) {
        return;
    }
    const fallbackPartial =
        Number(normalizedMeta.waitingCount || 0) >
        partialMetaTickets.filter((item) => item.status === 'waiting').length;
    const byIdentity = new Map(
        currentTickets.map((ticket) => [ticketIdentity(ticket), ticket])
    );

    if (fullTickets.length) {
        setQueueStateWithTickets(fullTickets, normalizedMeta, {
            fallbackPartial: false,
            syncMode,
        });
        return;
    }

    reconcilePartialMetaSignals(byIdentity, normalizedMeta, signalFlags);

    for (const ticket of partialMetaTickets) {
        const identity = ticketIdentity(ticket);
        const existing = byIdentity.get(identity) || null;
        const mergedCreatedAt = coalesceNonEmptyString(
            ticket.createdAt,
            ticket.created_at,
            existing?.createdAt,
            existing?.created_at
        );
        const mergedPriorityClass = coalesceNonEmptyString(
            ticket.priorityClass,
            ticket.priority_class,
            existing?.priorityClass,
            existing?.priority_class,
            'walk_in'
        );
        const mergedQueueType = coalesceNonEmptyString(
            ticket.queueType,
            ticket.queue_type,
            existing?.queueType,
            existing?.queue_type,
            'walk_in'
        );
        const mergedInitials = coalesceNonEmptyString(
            ticket.patientInitials,
            ticket.patient_initials,
            existing?.patientInitials,
            existing?.patient_initials,
            '--'
        );
        byIdentity.set(
            identity,
            normalizeTicket(
                {
                    ...(existing || {}),
                    ...ticket,
                    status: ticket.status,
                    assignedConsultorio: ticket.assignedConsultorio,
                    createdAt: mergedCreatedAt || new Date().toISOString(),
                    priorityClass: mergedPriorityClass,
                    queueType: mergedQueueType,
                    patientInitials: mergedInitials,
                },
                byIdentity.size
            )
        );
    }

    if (hasPayloadTicket) {
        const normalizedPayloadTicket = normalizeTicket(
            payloadTicket,
            byIdentity.size
        );
        const identity = ticketIdentity(normalizedPayloadTicket);
        const existing = byIdentity.get(identity) || null;
        byIdentity.set(
            identity,
            normalizeTicket(
                {
                    ...(existing || {}),
                    ...normalizedPayloadTicket,
                },
                byIdentity.size
            )
        );
    }

    setQueueStateWithTickets(Array.from(byIdentity.values()), normalizedMeta, {
        fallbackPartial,
        syncMode,
    });
}

function getWaitingForConsultorio(consultorio) {
    const tickets = getQueueSource().queueTickets;
    return tickets.find(
        (ticket) =>
            ticket.status === 'waiting' &&
            (!ticket.assignedConsultorio ||
                ticket.assignedConsultorio === consultorio)
    );
}

function setTicketCalledLocal(ticketId, consultorio) {
    mutateTicketLocal(ticketId, (ticket) => ({
        ...ticket,
        status: 'called',
        assignedConsultorio: consultorio,
        calledAt: new Date().toISOString(),
    }));
}

function setTicketStatusLocal(ticketId, status, consultorio = undefined) {
    mutateTicketLocal(ticketId, (ticket) => ({
        ...ticket,
        status,
        assignedConsultorio:
            consultorio === undefined
                ? ticket.assignedConsultorio
                : consultorio,
        calledAt:
            status === 'called'
                ? new Date().toISOString()
                : status === 'waiting'
                  ? ''
                  : ticket.calledAt,
        completedAt:
            status === 'completed' ||
            status === 'no_show' ||
            status === 'cancelled'
                ? new Date().toISOString()
                : '',
    }));
}

export async function refreshQueueState() {
    try {
        const payload = await apiRequest('queue-state');
        applyQueueStateResponse(payload, { syncMode: 'live' });
        appendActivity('Queue refresh realizado');
    } catch (_error) {
        appendActivity('Queue refresh con error');
        const snapshot = getStorageJson(QUEUE_SNAPSHOT_STORAGE_KEY, null);
        if (snapshot?.queueTickets) {
            setQueueStateWithTickets(
                snapshot.queueTickets,
                snapshot.queueMeta || null,
                {
                    fallbackPartial: true,
                    syncMode: 'fallback',
                }
            );
        }
    }
}

export function setQueueFilter(filter) {
    updateQueueUi({ filter: normalize(filter) || 'all', selected: [] });
}

export function setQueueSearch(search) {
    updateQueueUi({ search: String(search || ''), selected: [] });
}

export function clearQueueSearch() {
    updateQueueUi({ search: '', selected: [] });
    const input = document.getElementById('queueSearchInput');
    if (input instanceof HTMLInputElement) input.value = '';
}

export async function callNextForConsultorio(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    const state = getState();
    if (CALL_NEXT_IN_FLIGHT.get(target)) return;

    if (
        state.queue.stationMode === 'locked' &&
        state.queue.stationConsultorio !== target
    ) {
        appendActivity(
            `Llamado bloqueado para C${target} por lock de estacion`
        );
        createToast('Modo bloqueado: consultorio no permitido', 'warning');
        return;
    }

    if (state.queue.practiceMode) {
        const candidate = getWaitingForConsultorio(target);
        if (!candidate) {
            appendActivity('Practica: sin tickets en espera');
            return;
        }
        setTicketCalledLocal(candidate.id, target);
        appendActivity(
            `Practica: llamado ${candidate.ticketCode} en C${target}`
        );
        return;
    }

    CALL_NEXT_IN_FLIGHT.set(target, true);
    try {
        const payload = await apiRequest('queue-call-next', {
            method: 'POST',
            body: {
                consultorio: target,
            },
        });
        applyQueueStateResponse(payload, { syncMode: 'live' });
        appendActivity(`Llamado C${target} ejecutado`);
    } catch (_error) {
        appendActivity(`Error llamando siguiente en C${target}`);
        createToast(`Error llamando siguiente en C${target}`, 'error');
    } finally {
        CALL_NEXT_IN_FLIGHT.set(target, false);
    }
}

async function executeTicketAction({ ticketId, action, consultorio }) {
    const targetId = Number(ticketId || 0);
    const targetAction = normalizeQueueAction(action);
    if (!targetId || !targetAction) return;

    const state = getState();
    if (state.queue.practiceMode) {
        if (targetAction === 'reasignar') {
            setTicketStatusLocal(
                targetId,
                'called',
                Number(consultorio || 1) === 2 ? 2 : 1
            );
        } else if (
            targetAction === 're-llamar' ||
            targetAction === 'rellamar'
        ) {
            setTicketStatusLocal(
                targetId,
                'called',
                Number(consultorio || 1) === 2 ? 2 : 1
            );
        } else if (targetAction === 'liberar') {
            setTicketStatusLocal(targetId, 'waiting', null);
        } else if (targetAction === 'completar') {
            setTicketStatusLocal(targetId, 'completed');
        } else if (targetAction === 'no_show') {
            setTicketStatusLocal(targetId, 'no_show');
        } else if (targetAction === 'cancelar') {
            setTicketStatusLocal(targetId, 'cancelled');
        }
        appendActivity(
            `Practica: accion ${targetAction} en ticket ${targetId}`
        );
        return;
    }

    const payload = await apiRequest('queue-ticket', {
        method: 'PATCH',
        body: {
            id: targetId,
            action: targetAction,
            consultorio: Number(consultorio || 0),
        },
    });

    applyQueueStateResponse(payload, { syncMode: 'live' });
    appendActivity(`Accion ${targetAction} ticket ${targetId}`);
}

export async function runQueueTicketAction(ticketId, action, consultorio = 0) {
    const payload = {
        ticketId: Number(ticketId || 0),
        action: normalizeQueueAction(action),
        consultorio: Number(consultorio || 0),
    };
    const state = getState();
    const currentTicket = getQueueTicketById(payload.ticketId);
    if (
        !state.queue.practiceMode &&
        SENSITIVE_QUEUE_ACTIONS.has(payload.action) &&
        requiresSensitiveConfirm(payload.action, currentTicket)
    ) {
        showSensitiveConfirm(payload);
        appendActivity(`Accion ${payload.action} pendiente de confirmacion`);
        return;
    }
    await executeTicketAction(payload);
}

export async function runQueueReleaseStation(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    const activeTicket = getCalledTicketForConsultorio(target);
    if (!activeTicket) {
        appendActivity(`Sin ticket activo para liberar en C${target}`);
        return;
    }
    await runQueueTicketAction(activeTicket.id, 'liberar', target);
}

export async function confirmQueueSensitiveAction() {
    const state = getState();
    const pending = state.queue.pendingSensitiveAction;
    if (!pending) {
        hideSensitiveConfirm();
        return;
    }
    hideSensitiveConfirm();
    await executeTicketAction(pending);
}

export function cancelQueueSensitiveAction() {
    hideSensitiveConfirm();
    appendActivity('Accion sensible cancelada');
}

export function dismissQueueSensitiveDialog() {
    const dialog = document.getElementById('queueSensitiveConfirmDialog');
    const pending = getState().queue.pendingSensitiveAction;
    const isOpen =
        Boolean(pending) ||
        (dialog instanceof HTMLDialogElement
            ? dialog.open
            : dialog instanceof HTMLElement
              ? !dialog.hidden || dialog.hasAttribute('open')
              : false);
    if (!isOpen) return false;
    cancelQueueSensitiveAction();
    return true;
}

export async function runQueueBulkAction(action) {
    const targets = getBulkTargetTickets();
    const normalizedAction = normalizeQueueAction(action);
    if (!targets.length) return;

    if (SENSITIVE_QUEUE_ACTIONS.has(normalizedAction)) {
        const actionLabel =
            normalizedAction === 'no_show'
                ? 'No show'
                : normalizedAction === 'completar' ||
                    normalizedAction === 'completed'
                  ? 'Completar'
                  : 'Cancelar';
        const confirmed = window.confirm(
            `${actionLabel}: confirmar acción masiva`
        );
        if (!confirmed) return;
    }

    for (const ticket of targets) {
        try {
            await executeTicketAction({
                ticketId: ticket.id,
                action: normalizedAction,
                consultorio:
                    ticket.assignedConsultorio ||
                    getState().queue.stationConsultorio,
            });
        } catch (_error) {
            // continue
        }
    }
    clearQueueSelection();
    appendActivity(`Bulk ${normalizedAction} sobre ${targets.length} tickets`);
}

export async function reprintQueueTicket(ticketId) {
    const id = Number(ticketId || 0);
    if (!id) return;

    if (getState().queue.practiceMode) {
        appendActivity(`Practica: reprint ticket ${id}`);
        return;
    }

    await apiRequest('queue-reprint', {
        method: 'POST',
        body: { id },
    });
    appendActivity(`Reimpresion ticket ${id}`);
}

export async function runQueueBulkReprint() {
    const targets = getBulkTargetTickets();
    for (const ticket of targets) {
        try {
            await reprintQueueTicket(ticket.id);
        } catch (_error) {
            // continue
        }
    }
    clearQueueSelection();
    appendActivity(`Bulk reimpresion ${targets.length}`);
}

export function toggleQueueHelpPanel() {
    updateQueueUi({ helpOpen: !getState().queue.helpOpen });
}

export function toggleQueueOneTap() {
    updateQueueUi({ oneTap: !getState().queue.oneTap });
}

export function setQueuePracticeMode(enabled) {
    const practiceMode = Boolean(enabled);
    hideSensitiveConfirm();
    updateQueueUi({ practiceMode });
    appendActivity(
        practiceMode ? 'Modo practica activo' : 'Modo practica desactivado'
    );
}

export function setQueueStationLock(consultorio) {
    const target = Number(consultorio || 0) === 2 ? 2 : 1;
    updateQueueUi({ stationMode: 'locked', stationConsultorio: target });
    appendActivity(`Estacion bloqueada en C${target}`);
}

export function setQueueStationMode(mode) {
    const normalized = normalize(mode);
    if (normalized === 'free') {
        updateQueueUi({ stationMode: 'free' });
        appendActivity('Estacion en modo libre');
        return;
    }
    updateQueueUi({ stationMode: 'locked' });
}

export function beginQueueCallKeyCapture() {
    updateQueueUi({ captureCallKeyMode: true });
    createToast('Calibración activa: presiona la tecla externa', 'info');
}

export function clearQueueCallKeyBinding() {
    const confirmed = window.confirm('¿Quitar tecla externa calibrada?');
    if (!confirmed) return;
    updateQueueUi({ customCallKey: null, captureCallKeyMode: false });
    createToast('Tecla externa eliminada', 'success');
}

function eventMatchesBinding(eventInfo, binding) {
    if (!binding || typeof binding !== 'object') return false;
    return (
        normalize(binding.code) === normalize(eventInfo.code) &&
        String(binding.key || '') === String(eventInfo.key || '') &&
        Number(binding.location || 0) === Number(eventInfo.location || 0)
    );
}

function getActiveCalledTicketForStation() {
    const state = getState();
    const station = Number(state.queue.stationConsultorio || 1);
    const tickets = getQueueSource().queueTickets;
    return (
        tickets.find(
            (ticket) =>
                ticket.status === 'called' &&
                Number(ticket.assignedConsultorio || 0) === station
        ) || null
    );
}

export async function queueNumpadAction(eventInfo) {
    const state = getState();

    if (state.queue.captureCallKeyMode) {
        const binding = {
            key: String(eventInfo.key || ''),
            code: String(eventInfo.code || ''),
            location: Number(eventInfo.location || 0),
        };
        updateQueueUi({
            customCallKey: binding,
            captureCallKeyMode: false,
        });
        createToast('Tecla externa guardada', 'success');
        appendActivity(`Tecla externa calibrada: ${binding.code}`);
        return;
    }

    if (eventMatchesBinding(eventInfo, state.queue.customCallKey)) {
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const code = normalize(eventInfo.code);
    const key = normalize(eventInfo.key);
    const isEnter =
        code === 'numpadenter' ||
        code === 'kpenter' ||
        (key === 'enter' && Number(eventInfo.location || 0) === 3);

    if (isEnter && state.queue.pendingSensitiveAction) {
        await confirmQueueSensitiveAction();
        return;
    }

    if (code === 'numpad2' || key === '2') {
        if (
            state.queue.stationMode === 'locked' &&
            state.queue.stationConsultorio !== 2
        ) {
            createToast('Cambio bloqueado por modo estación', 'warning');
            appendActivity('Cambio de estación bloqueado por lock');
            return;
        }
        updateQueueUi({ stationConsultorio: 2 });
        appendActivity('Numpad: estacion C2');
        return;
    }

    if (code === 'numpad1' || key === '1') {
        if (
            state.queue.stationMode === 'locked' &&
            state.queue.stationConsultorio !== 1
        ) {
            createToast('Cambio bloqueado por modo estación', 'warning');
            appendActivity('Cambio de estación bloqueado por lock');
            return;
        }
        updateQueueUi({ stationConsultorio: 1 });
        appendActivity('Numpad: estacion C1');
        return;
    }

    if (isEnter) {
        if (state.queue.oneTap) {
            const activeCalled = getActiveCalledTicketForStation();
            if (activeCalled) {
                await executeTicketAction({
                    ticketId: activeCalled.id,
                    action: 'completar',
                    consultorio: state.queue.stationConsultorio,
                });
            }
        }
        await callNextForConsultorio(state.queue.stationConsultorio);
        return;
    }

    const isDecimal =
        code === 'numpaddecimal' ||
        code === 'kpdecimal' ||
        key === 'decimal' ||
        key === ',' ||
        key === '.';
    if (isDecimal) {
        const activeCalled = getActiveCalledTicketForStation();
        if (activeCalled) {
            showSensitiveConfirm({
                ticketId: activeCalled.id,
                action: 'completar',
                consultorio: state.queue.stationConsultorio,
            });
        }
        return;
    }

    const isSubtract =
        code === 'numpadsubtract' || code === 'kpsubtract' || key === '-';
    if (isSubtract) {
        const activeCalled = getActiveCalledTicketForStation();
        if (activeCalled) {
            showSensitiveConfirm({
                ticketId: activeCalled.id,
                action: 'no_show',
                consultorio: state.queue.stationConsultorio,
            });
        }
        return;
    }

    const isAdd = code === 'numpadadd' || code === 'kpadd' || key === '+';
    if (isAdd) {
        const activeCalled = getActiveCalledTicketForStation();
        if (activeCalled) {
            await executeTicketAction({
                ticketId: activeCalled.id,
                action: 're-llamar',
                consultorio: state.queue.stationConsultorio,
            });
            appendActivity(`Re-llamar ${activeCalled.ticketCode}`);
            createToast(`Re-llamar ${activeCalled.ticketCode}`, 'info');
        }
    }
}

export function applyQueueRuntimeDefaults() {
    const defaults = readQueueUiDefaults();

    const stationQuery = normalize(getQueryParam('station'));
    const lockQuery = normalize(getQueryParam('lock'));
    const oneTapQuery = normalize(getQueryParam('one_tap'));

    const fromQueryConsultorio =
        stationQuery === 'c2' || stationQuery === '2'
            ? 2
            : stationQuery === 'c1' || stationQuery === '1'
              ? 1
              : defaults.stationConsultorio;

    const stationMode =
        lockQuery === '1' || lockQuery === 'true'
            ? 'locked'
            : defaults.stationMode;

    const oneTap =
        oneTapQuery === '1' || oneTapQuery === 'true'
            ? true
            : oneTapQuery === '0' || oneTapQuery === 'false'
              ? false
              : defaults.oneTap;

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            stationMode,
            stationConsultorio: fromQueryConsultorio,
            oneTap,
            helpOpen: defaults.helpOpen,
            customCallKey:
                defaults.customCallKey &&
                typeof defaults.customCallKey === 'object'
                    ? defaults.customCallKey
                    : null,
        },
    }));

    persistQueueUi(getState());
}

export function shouldRefreshQueueOnSectionEnter() {
    const state = getState();
    if (
        normalize(state.queue.syncMode) === 'fallback' ||
        Boolean(state.queue.fallbackPartial)
    ) {
        return false;
    }
    return true;
}

export async function hydrateQueueFromData() {
    const state = getState();
    const tickets = Array.isArray(state.data.queueTickets)
        ? state.data.queueTickets.map((item, index) =>
              normalizeTicket(item, index)
          )
        : [];
    const metaFromData =
        state.data.queueMeta && typeof state.data.queueMeta === 'object'
            ? normalizeQueueMeta(state.data.queueMeta, tickets)
            : null;

    if (tickets.length) {
        setQueueStateWithTickets(tickets, metaFromData || null, {
            fallbackPartial: false,
            syncMode: 'live',
        });
        return;
    }

    const derivedFromMeta = metaFromData
        ? buildTicketsFromMeta(metaFromData)
        : [];
    if (derivedFromMeta.length) {
        setQueueStateWithTickets(derivedFromMeta, metaFromData, {
            fallbackPartial: true,
            syncMode: 'fallback',
        });
        appendActivity('Queue fallback parcial desde metadata');
        return;
    }

    await refreshQueueState();
    const refreshed = getState().data.queueTickets || [];
    if (refreshed.length) return;

    const snapshot = getStorageJson(QUEUE_SNAPSHOT_STORAGE_KEY, null);
    if (snapshot?.queueTickets?.length) {
        setQueueStateWithTickets(
            snapshot.queueTickets,
            snapshot.queueMeta || null,
            {
                fallbackPartial: true,
                syncMode: 'fallback',
            }
        );
        appendActivity('Queue fallback desde snapshot local');
        return;
    }

    setQueueStateWithTickets([], null, {
        fallbackPartial: false,
        syncMode: 'live',
    });
}
