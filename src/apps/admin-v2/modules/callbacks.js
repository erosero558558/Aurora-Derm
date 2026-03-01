import { apiRequest } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';
import { escapeHtml, formatDateTime, setHtml, setText } from '../ui/render.js';

function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

function normalizeStatus(status) {
    const value = normalize(status);
    if (value === 'contacted') return 'contacted';
    if (value === 'contactado') return 'contacted';
    return value === 'pending' || value === 'pendiente' ? 'pending' : 'pending';
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
    const normalized = normalize(filter);
    if (normalized === 'pending' || normalized === 'contacted') {
        return items.filter(
            (item) => normalizeStatus(item.status) === normalized
        );
    }
    if (normalized === 'today') {
        return items.filter((item) => inToday(item.fecha || item.createdAt));
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

function callbackCard(item, selected) {
    const status = normalizeStatus(item.status);
    const cardClass =
        status === 'pending'
            ? 'callback-card pendiente'
            : 'callback-card contactado';
    const cardStatus = status === 'pending' ? 'pendiente' : 'contactado';
    const id = Number(item.id || 0);
    const phone =
        String(item.telefono || item.phone || 'Sin telefono').trim() ||
        'Sin telefono';
    const ageMinutes = (() => {
        const createdAt = new Date(item.fecha || item.createdAt || '');
        if (Number.isNaN(createdAt.getTime())) return 0;
        return Math.max(
            0,
            Math.round((Date.now() - createdAt.getTime()) / 60000)
        );
    })();

    return `
        <article class="${cardClass}${selected ? ' is-selected' : ''}" data-callback-id="${id}" data-callback-status="${cardStatus}">
            <header>
                <h4>${escapeHtml(phone)}</h4>
                <span>${status === 'pending' ? 'Pendiente' : 'Contactado'}</span>
            </header>
            <p>Preferencia: ${escapeHtml(item.preferencia || '-')}</p>
            <p>Fecha: ${escapeHtml(formatDateTime(item.fecha || item.createdAt || ''))}</p>
            <p>Espera: ${ageMinutes} min</p>
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

function computeOps(items) {
    const pending = items.filter(
        (item) => normalizeStatus(item.status) === 'pending'
    );
    const urgent = pending.filter((item) => {
        const createdAt = new Date(item.fecha || item.createdAt || '');
        if (Number.isNaN(createdAt.getTime())) return false;
        return Date.now() - createdAt.getTime() >= 60 * 60 * 1000;
    });
    const next = pending
        .slice()
        .sort(
            (a, b) =>
                new Date(a.fecha || a.createdAt || 0).getTime() -
                new Date(b.fecha || b.createdAt || 0).getTime()
        )[0];

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
                  ? 'Cola: atencion requerida'
                  : 'Cola: estable',
    };
}

export function renderCallbacksSection() {
    const state = getState();
    const source = Array.isArray(state.data.callbacks)
        ? state.data.callbacks
        : [];

    const filtered = applyFilter(source, state.callbacks.filter);
    const searched = applySearch(filtered, state.callbacks.search);

    const selectedSet = new Set(
        (state.callbacks.selected || []).map((value) => Number(value || 0))
    );

    setHtml(
        '#callbacksGrid',
        searched.length
            ? searched
                  .map((item) =>
                      callbackCard(item, selectedSet.has(Number(item.id || 0)))
                  )
                  .join('')
            : '<p>No hay callbacks para el filtro actual.</p>'
    );

    setText(
        '#callbacksToolbarMeta',
        `Mostrando ${searched.length} de ${source.length}`
    );

    const stateParts = [];
    if (normalize(state.callbacks.filter) !== 'all') {
        stateParts.push(
            normalize(state.callbacks.filter) === 'pending'
                ? 'Pendientes'
                : normalize(state.callbacks.filter) === 'contacted'
                  ? 'Contactados'
                  : 'Hoy'
        );
    }
    if (normalize(state.callbacks.search)) {
        stateParts.push(`Busqueda: ${state.callbacks.search}`);
    }

    setText(
        '#callbacksToolbarState',
        stateParts.length ? stateParts.join(' | ') : 'Sin filtros activos'
    );

    const select = document.getElementById('callbackFilter');
    if (select instanceof HTMLSelectElement) {
        select.value = state.callbacks.filter;
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
    setText(
        '#callbacksOpsNext',
        ops.next
            ? String(ops.next.telefono || ops.next.phone || 'Sin telefono')
            : 'Sin telefono'
    );

    const selectionChip = document.getElementById('callbacksSelectionChip');
    if (selectionChip) {
        selectionChip.classList.toggle('is-hidden', selectedSet.size === 0);
    }
    setText('#callbacksSelectedCount', selectedSet.size);
}

function updateCallbacksState(patch) {
    updateState((state) => ({
        ...state,
        callbacks: {
            ...state.callbacks,
            ...patch,
        },
    }));
    renderCallbacksSection();
}

export function setCallbacksFilter(filter) {
    updateCallbacksState({ filter: normalize(filter) || 'all' });
}

export function setCallbacksSearch(search) {
    updateCallbacksState({ search: String(search || '') });
}

export function clearCallbacksFilters() {
    updateCallbacksState({
        filter: 'all',
        search: '',
        selected: [],
    });
}

export function selectVisibleCallbacks() {
    const cards = Array.from(
        document.querySelectorAll('#callbacksGrid .callback-card')
    );
    const ids = cards
        .map((card) => Number(card.getAttribute('data-callback-id') || 0))
        .filter((id) => id > 0);
    updateCallbacksState({ selected: ids });
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
