import { apiRequest } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';
import { escapeHtml, formatDateTime, setHtml, setText } from '../ui/render.js';

const CALLBACK_SORT_STORAGE_KEY = 'admin-callbacks-sort';
const CALLBACK_FILTER_STORAGE_KEY = 'admin-callbacks-filter';
const CALLBACK_URGENT_THRESHOLD_MINUTES = 120;
const CALLBACK_FILTER_OPTIONS = new Set([
    'all',
    'pending',
    'contacted',
    'today',
    'sla_urgent',
]);
const CALLBACK_SORT_OPTIONS = new Set(['recent_desc', 'waiting_desc']);

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

function normalizeFilter(value) {
    const normalized = normalize(value);
    return CALLBACK_FILTER_OPTIONS.has(normalized) ? normalized : 'all';
}

function normalizeSort(value) {
    const normalized = normalize(value);
    return CALLBACK_SORT_OPTIONS.has(normalized) ? normalized : 'recent_desc';
}

function normalizeStatus(status) {
    const value = normalize(status);
    if (
        value === 'contacted' ||
        value === 'contactado' ||
        value === 'completed' ||
        value === 'done' ||
        value === 'resolved' ||
        value === 'called' ||
        value === 'atendido'
    ) {
        return 'contacted';
    }
    if (
        value === 'pending' ||
        value === 'pendiente' ||
        value === 'waiting' ||
        value === 'open' ||
        value === 'new' ||
        value === 'nuevo'
    ) {
        return 'pending';
    }
    return 'pending';
}

function createdAtMs(item) {
    const date = new Date(item?.fecha || item?.createdAt || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function waitingMinutes(item) {
    const stamp = createdAtMs(item);
    if (!stamp) return 0;
    return Math.max(0, Math.round((Date.now() - stamp) / 60000));
}

function phoneLabel(item) {
    return (
        String(item?.telefono || item?.phone || 'Sin teléfono').trim() ||
        'Sin teléfono'
    );
}

function inToday(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

function applyFilter(items, filter) {
    const normalized = normalizeFilter(filter);
    if (normalized === 'pending' || normalized === 'contacted') {
        return items.filter(
            (item) => normalizeStatus(item.status) === normalized
        );
    }
    if (normalized === 'today') {
        return items.filter((item) => inToday(item.fecha || item.createdAt));
    }
    if (normalized === 'sla_urgent') {
        return items.filter((item) => {
            if (normalizeStatus(item.status) !== 'pending') return false;
            return waitingMinutes(item) >= CALLBACK_URGENT_THRESHOLD_MINUTES;
        });
    }
    return items;
}

function applySearch(items, search) {
    const term = normalize(search);
    if (!term) return items;
    return items.filter((item) => {
        const fields = [
            item.telefono,
            item.phone,
            item.preferencia,
            item.status,
        ];
        return fields.some((field) => normalize(field).includes(term));
    });
}

function sortItems(items, sort) {
    const normalized = normalizeSort(sort);
    const list = [...items];

    if (normalized === 'waiting_desc') {
        list.sort((a, b) => createdAtMs(a) - createdAtMs(b));
        return list;
    }

    list.sort((a, b) => createdAtMs(b) - createdAtMs(a));
    return list;
}

function waitBand(minutes) {
    if (minutes >= CALLBACK_URGENT_THRESHOLD_MINUTES) {
        return {
            label: 'Critico SLA',
            tone: 'danger',
            note: 'Escala inmediata',
        };
    }
    if (minutes >= 45) {
        return {
            label: 'En ventana',
            tone: 'warning',
            note: 'Conviene atender pronto',
        };
    }
    return {
        label: 'Reciente',
        tone: 'neutral',
        note: 'Todavia dentro de margen',
    };
}

function callbackCard(item, selected) {
    const status = normalizeStatus(item.status);
    const cardClass =
        status === 'pending'
            ? 'callback-card pendiente'
            : 'callback-card contactado';
    const cardStatus = status === 'pending' ? 'pendiente' : 'contactado';
    const id = Number(item.id || 0);
    const phone = phoneLabel(item);
    const ageMinutes = waitingMinutes(item);
    const band = waitBand(ageMinutes);

    return `
        <article class="${cardClass}${selected ? ' is-selected' : ''}" data-callback-id="${id}" data-callback-status="${cardStatus}">
            <header>
                <div class="callback-card-heading">
                    <span class="callback-status-pill" data-tone="${escapeHtml(status === 'pending' ? band.tone : 'success')}">${status === 'pending' ? 'Pendiente' : 'Contactado'}</span>
                    <h4>${escapeHtml(phone)}</h4>
                </div>
                <span class="callback-card-wait" data-tone="${escapeHtml(band.tone)}">${escapeHtml(band.label)}</span>
            </header>
            <div class="callback-card-grid">
                <p><span>Preferencia</span><strong>${escapeHtml(item.preferencia || '-')}</strong></p>
                <p><span>Fecha</span><strong>${escapeHtml(formatDateTime(item.fecha || item.createdAt || ''))}</strong></p>
                <p><span>Espera</span><strong>${ageMinutes} min</strong></p>
                <p><span>Estado</span><strong>${escapeHtml(status === 'pending' ? 'Pendiente' : 'Contactado')}</strong></p>
            </div>
            <p class="callback-card-note">${escapeHtml(status === 'pending' ? band.note : 'Callback resuelto y fuera de cola operativa.')}</p>
            <div class="callback-actions">
                <button type="button" data-action="mark-contacted" data-callback-id="${id}" data-callback-date="${escapeHtml(item.fecha || '')}">Marcar contactado</button>
            </div>
        </article>
    `;
}

function updateQuickFilterButtons(filter) {
    const normalized = normalize(filter);
    document
        .querySelectorAll('.callback-quick-filter-btn[data-filter-value]')
        .forEach((button) => {
            const active = normalize(button.dataset.filterValue) === normalized;
            button.classList.toggle('is-active', active);
        });
}

function persistPreferences(callbacksState) {
    try {
        localStorage.setItem(
            CALLBACK_FILTER_STORAGE_KEY,
            JSON.stringify(normalizeFilter(callbacksState.filter))
        );
        localStorage.setItem(
            CALLBACK_SORT_STORAGE_KEY,
            JSON.stringify(normalizeSort(callbacksState.sort))
        );
    } catch (_error) {
        // no-op
    }
}

export function hydrateCallbacksPreferences() {
    let filter = 'all';
    let sort = 'recent_desc';
    try {
        filter = JSON.parse(
            localStorage.getItem(CALLBACK_FILTER_STORAGE_KEY) || '"all"'
        );
        sort = JSON.parse(
            localStorage.getItem(CALLBACK_SORT_STORAGE_KEY) || '"recent_desc"'
        );
    } catch (_error) {
        // no-op
    }

    updateState((state) => ({
        ...state,
        callbacks: {
            ...state.callbacks,
            filter: normalizeFilter(filter),
            sort: normalizeSort(sort),
        },
    }));
}

function computeOps(items) {
    const pending = items.filter(
        (item) => normalizeStatus(item.status) === 'pending'
    );
    const urgent = pending.filter((item) => {
        return waitingMinutes(item) >= CALLBACK_URGENT_THRESHOLD_MINUTES;
    });
    const next = pending
        .slice()
        .sort((a, b) => createdAtMs(a) - createdAtMs(b))[0];

    return {
        pendingCount: pending.length,
        urgentCount: urgent.length,
        todayCount: items.filter((item) =>
            inToday(item.fecha || item.createdAt)
        ).length,
        next,
        queueHealth:
            urgent.length > 0
                ? 'Cola: prioridad alta'
                : pending.length > 0
                  ? 'Cola: atención requerida'
                  : 'Cola: estable',
        queueState:
            urgent.length > 0
                ? 'danger'
                : pending.length > 0
                  ? 'warning'
                  : 'success',
    };
}

function renderCallbackDeck(ops, visibleCount, totalCount, selectedCount) {
    setText(
        '#callbacksDeckSummary',
        totalCount > 0
            ? `${ops.pendingCount} pendiente(s), ${ops.urgentCount} fuera de SLA y ${visibleCount} visibles.`
            : 'Sin callbacks pendientes.'
    );
    setText(
        '#callbacksDeckHint',
        ops.urgentCount > 0
            ? 'Escala primero los casos criticos.'
            : ops.pendingCount > 0
              ? 'La cola se puede drenar en esta misma vista.'
              : 'Sin bloqueos'
    );

    const queueChip = document.getElementById('callbacksQueueChip');
    if (queueChip) {
        queueChip.textContent =
            ops.queueState === 'danger'
                ? 'SLA comprometido'
                : ops.queueState === 'warning'
                  ? 'Cola activa'
                  : 'Cola estable';
        queueChip.setAttribute('data-state', ops.queueState);
    }

    const queueHealth = document.getElementById('callbacksOpsQueueHealth');
    if (queueHealth) {
        queueHealth.setAttribute('data-state', ops.queueState);
    }

    const next = ops.next;
    setText('#callbacksOpsNext', next ? phoneLabel(next) : 'Sin teléfono');
    setText(
        '#callbacksNextSummary',
        next
            ? `Prioriza ${phoneLabel(next)} antes de seguir con la cola.`
            : 'La siguiente llamada prioritaria aparecerá aqui.'
    );
    setText('#callbacksNextWait', `${next ? waitingMinutes(next) : 0} min`);
    setText('#callbacksNextPreference', next ? next.preferencia || '-' : '-');
    setText(
        '#callbacksNextState',
        next ? waitBand(waitingMinutes(next)).label : 'Pendiente'
    );

    const selectionChip = document.getElementById('callbacksSelectionChip');
    if (selectionChip) {
        selectionChip.classList.toggle('is-hidden', selectedCount === 0);
    }
    setText('#callbacksSelectedCount', selectedCount);
}

export function renderCallbacksSection() {
    const state = getState();
    const source = Array.isArray(state.data.callbacks)
        ? state.data.callbacks
        : [];

    const filtered = applyFilter(source, state.callbacks.filter);
    const searched = applySearch(filtered, state.callbacks.search);
    const sorted = sortItems(searched, state.callbacks.sort);

    const selectedSet = new Set(
        (state.callbacks.selected || []).map((value) => Number(value || 0))
    );

    setHtml(
        '#callbacksGrid',
        sorted.length
            ? sorted
                  .map((item) =>
                      callbackCard(item, selectedSet.has(Number(item.id || 0)))
                  )
                  .join('')
            : '<p class="callbacks-grid-empty">No hay callbacks para el filtro actual.</p>'
    );

    setText(
        '#callbacksToolbarMeta',
        `Mostrando ${sorted.length} de ${source.length}`
    );

    const stateParts = [];
    if (normalizeFilter(state.callbacks.filter) !== 'all') {
        stateParts.push(
            normalizeFilter(state.callbacks.filter) === 'pending'
                ? 'Pendientes'
                : normalizeFilter(state.callbacks.filter) === 'contacted'
                  ? 'Contactados'
                  : normalizeFilter(state.callbacks.filter) === 'today'
                    ? 'Hoy'
                    : 'Urgentes SLA'
        );
    }
    if (normalize(state.callbacks.search)) {
        stateParts.push(`Busqueda: ${state.callbacks.search}`);
    }
    if (normalizeSort(state.callbacks.sort) === 'waiting_desc') {
        stateParts.push('Orden: Mayor espera (SLA)');
    }

    setText(
        '#callbacksToolbarState',
        stateParts.length ? stateParts.join(' | ') : 'Sin filtros activos'
    );

    const filterSelect = document.getElementById('callbackFilter');
    if (filterSelect instanceof HTMLSelectElement) {
        filterSelect.value = normalizeFilter(state.callbacks.filter);
    }

    const sortSelect = document.getElementById('callbackSort');
    if (sortSelect instanceof HTMLSelectElement) {
        sortSelect.value = normalizeSort(state.callbacks.sort);
    }

    const search = document.getElementById('searchCallbacks');
    if (
        search instanceof HTMLInputElement &&
        search.value !== state.callbacks.search
    ) {
        search.value = state.callbacks.search;
    }

    updateQuickFilterButtons(state.callbacks.filter);

    const ops = computeOps(source);
    setText('#callbacksOpsPendingCount', ops.pendingCount);
    setText('#callbacksOpsUrgentCount', ops.urgentCount);
    setText('#callbacksOpsTodayCount', ops.todayCount);
    setText('#callbacksOpsQueueHealth', ops.queueHealth);

    const selectVisibleBtn = document.getElementById(
        'callbacksBulkSelectVisibleBtn'
    );
    if (selectVisibleBtn instanceof HTMLButtonElement) {
        selectVisibleBtn.disabled = sorted.length === 0;
    }

    const clearSelectionBtn = document.getElementById('callbacksBulkClearBtn');
    if (clearSelectionBtn instanceof HTMLButtonElement) {
        clearSelectionBtn.disabled = selectedSet.size === 0;
    }

    const markSelectedBtn = document.getElementById('callbacksBulkMarkBtn');
    if (markSelectedBtn instanceof HTMLButtonElement) {
        markSelectedBtn.disabled = selectedSet.size === 0;
    }

    renderCallbackDeck(ops, sorted.length, source.length, selectedSet.size);
}

function updateCallbacksState(patch, { persist = true } = {}) {
    updateState((state) => ({
        ...state,
        callbacks: {
            ...state.callbacks,
            ...patch,
        },
    }));
    if (persist) {
        persistPreferences(getState().callbacks);
    }
    renderCallbacksSection();
}

export function setCallbacksFilter(filter) {
    updateCallbacksState({
        filter: normalizeFilter(filter),
        selected: [],
    });
}

export function setCallbacksSort(sort) {
    updateCallbacksState({
        sort: normalizeSort(sort),
        selected: [],
    });
}

export function setCallbacksSearch(search) {
    updateCallbacksState({
        search: String(search || ''),
        selected: [],
    });
}

export function clearCallbacksFilters() {
    updateCallbacksState({
        filter: 'all',
        sort: 'recent_desc',
        search: '',
        selected: [],
    });
}

export function clearCallbacksSelection() {
    updateCallbacksState({ selected: [] }, { persist: false });
}

export function selectVisibleCallbacks() {
    const cards = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    const ids = cards
        .map((card) => Number(card.getAttribute('data-callback-id') || 0))
        .filter((id) => id > 0);
    updateCallbacksState({ selected: ids }, { persist: false });
}

function mutateCallbackStatus(id, status) {
    const targetId = Number(id || 0);
    updateState((state) => {
        const next = (state.data.callbacks || []).map((item) =>
            Number(item.id || 0) === targetId
                ? {
                      ...item,
                      status,
                  }
                : item
        );
        return {
            ...state,
            data: {
                ...state.data,
                callbacks: next,
            },
            callbacks: {
                ...state.callbacks,
                selected: (state.callbacks.selected || []).filter(
                    (value) => Number(value || 0) !== targetId
                ),
            },
        };
    });
    renderCallbacksSection();
}

export async function markCallbackContacted(id, callbackDate = '') {
    const callbackId = Number(id || 0);
    if (callbackId <= 0) return;

    await apiRequest('callbacks', {
        method: 'PATCH',
        body: {
            id: callbackId,
            status: 'contacted',
            fecha: callbackDate,
        },
    });

    mutateCallbackStatus(callbackId, 'contacted');
}

export async function markSelectedCallbacksContacted() {
    const state = getState();
    const selectedIds = (state.callbacks.selected || [])
        .map((value) => Number(value || 0))
        .filter((value) => value > 0);
    for (const id of selectedIds) {
        try {
            await markCallbackContacted(id);
        } catch (_error) {
            // no-op
        }
    }
}

export function focusNextPendingCallback() {
    const next = document.querySelector(
        '#callbacksGrid .callback-card.pendiente button[data-action="mark-contacted"]'
    );
    if (next instanceof HTMLElement) next.focus();
}
