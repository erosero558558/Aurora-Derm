import { currentCallbacks } from './state.js';
import { apiRequest } from './api.js';
import { refreshData } from './data.js';
import { loadDashboardData } from './dashboard.js';
import {
    escapeHtml,
    showToast,
    normalizeCallbackStatus,
    getPreferenceText,
} from './ui.js';

const DEFAULT_CALLBACK_FILTER = 'all';
const CALLBACK_FILTER_OPTIONS = new Set([
    'all',
    'pending',
    'contacted',
    'today',
]);

const callbackCriteriaState = {
    filter: DEFAULT_CALLBACK_FILTER,
    search: '',
};

const CALLBACK_FILTER_LABELS = {
    all: 'Todos',
    pending: 'Pendientes',
    contacted: 'Contactados',
    today: 'Hoy',
};

function getCallbacksControls() {
    return {
        filterSelect: document.getElementById('callbackFilter'),
        searchInput: document.getElementById('searchCallbacks'),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="callback-quick-filter"][data-filter-value]'
            )
        ),
        toolbarMeta: document.getElementById('callbacksToolbarMeta'),
        toolbarState: document.getElementById('callbacksToolbarState'),
        clearFiltersBtn: document.getElementById('clearCallbacksFiltersBtn'),
    };
}

function normalizeCallbackFilter(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return CALLBACK_FILTER_OPTIONS.has(normalized)
        ? normalized
        : DEFAULT_CALLBACK_FILTER;
}

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseCallbackDateTime(value) {
    if (!value) return null;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed;
    }
    return null;
}

function getSortedCallbacks(list) {
    return [...list].sort((a, b) => {
        const dateA = parseCallbackDateTime(a.fecha);
        const dateB = parseCallbackDateTime(b.fecha);
        const timestampA = dateA ? dateA.getTime() : 0;
        const timestampB = dateB ? dateB.getTime() : 0;
        return timestampB - timestampA;
    });
}

function getCallbackFilterResult(criteria) {
    const nextCriteria = {
        filter: normalizeCallbackFilter(criteria.filter),
        search: String(criteria.search || '')
            .trim()
            .toLowerCase(),
    };

    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const sorted = getSortedCallbacks(currentCallbacks);
    const filtered = sorted.filter((callback) => {
        const normalizedStatus = normalizeCallbackStatus(callback.status);
        const callbackDate = parseCallbackDateTime(callback.fecha);
        const callbackDateKey = callbackDate
            ? toLocalDateKey(callbackDate)
            : '';

        if (
            nextCriteria.filter === 'pending' &&
            normalizedStatus !== 'pendiente'
        ) {
            return false;
        }

        if (
            nextCriteria.filter === 'contacted' &&
            normalizedStatus !== 'contactado'
        ) {
            return false;
        }

        if (nextCriteria.filter === 'today' && callbackDateKey !== todayKey) {
            return false;
        }

        if (nextCriteria.search === '') {
            return true;
        }

        const searchTarget = [
            callback.telefono,
            callback.preferencia,
            callback.fecha,
            normalizedStatus,
        ]
            .map((value) => String(value || '').toLowerCase())
            .join(' ');

        return searchTarget.includes(nextCriteria.search);
    });

    return { filtered, criteria: nextCriteria };
}

function setCallbackQuickFilterButtonState(buttons, currentFilter) {
    buttons.forEach((btn) => {
        const isActive = btn.dataset.filterValue === currentFilter;
        btn.classList.toggle('is-active', isActive);
        btn.setAttribute('aria-pressed', String(isActive));
    });
}

function updateCallbacksToolbar(filteredCallbacks, allCallbacks, criteria) {
    const controls = getCallbacksControls();
    const {
        toolbarMeta,
        toolbarState,
        clearFiltersBtn,
        quickFilterButtons,
        filterSelect,
        searchInput,
    } = controls;

    const visibleCount = filteredCallbacks.length;
    const allCount = allCallbacks.length;
    const pendingVisible = filteredCallbacks.filter(
        (callback) => normalizeCallbackStatus(callback.status) === 'pendiente'
    ).length;
    const contactedVisible = filteredCallbacks.filter(
        (callback) => normalizeCallbackStatus(callback.status) === 'contactado'
    ).length;

    if (toolbarMeta) {
        toolbarMeta.innerHTML = [
            `<span class="toolbar-chip is-accent">Mostrando ${escapeHtml(String(visibleCount))}${allCount !== visibleCount ? ` de ${escapeHtml(String(allCount))}` : ''}</span>`,
            `<span class="toolbar-chip">Pendientes: ${escapeHtml(String(pendingVisible))}</span>`,
            `<span class="toolbar-chip">Contactados: ${escapeHtml(String(contactedVisible))}</span>`,
        ].join('');
    }

    const hasFilter = criteria.filter !== DEFAULT_CALLBACK_FILTER;
    const hasSearch = criteria.search !== '';

    if (toolbarState) {
        if (!hasFilter && !hasSearch) {
            toolbarState.innerHTML =
                '<span class="toolbar-state-empty">Sin filtros activos</span>';
        } else {
            const stateTokens = [
                '<span class="toolbar-state-label">Criterios activos:</span>',
            ];

            if (hasFilter) {
                stateTokens.push(
                    `<span class="toolbar-state-value">${escapeHtml(
                        CALLBACK_FILTER_LABELS[criteria.filter] ||
                            criteria.filter
                    )}</span>`
                );
            }

            if (hasSearch) {
                stateTokens.push(
                    `<span class="toolbar-state-value is-search">Busqueda: ${escapeHtml(criteria.search)}</span>`
                );
            }

            stateTokens.push(
                `<span class="toolbar-state-value">Resultados: ${escapeHtml(String(visibleCount))}</span>`
            );

            toolbarState.innerHTML = stateTokens.join('');
        }
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.classList.toggle('is-hidden', !hasFilter && !hasSearch);
    }

    if (filterSelect) {
        filterSelect.value = criteria.filter;
    }
    if (searchInput) {
        searchInput.value = criteria.search;
    }
    setCallbackQuickFilterButtonState(quickFilterButtons, criteria.filter);
}

export function renderCallbacks(callbacks) {
    const grid = document.getElementById('callbacksGrid');
    if (!grid) return;

    if (callbacks.length === 0) {
        grid.innerHTML = `
            <div class="card-empty-state">
                <i class="fas fa-phone-slash" aria-hidden="true"></i>
                <strong>No hay callbacks registrados</strong>
                <p>Las solicitudes de llamada apareceran aqui para seguimiento rapido.</p>
                </div>
        `;
        return;
    }

    grid.innerHTML = callbacks
        .map((c) => {
            const status = normalizeCallbackStatus(c.status);
            const callbackId = Number(c.id) || 0;
            const callbackDateKey = encodeURIComponent(String(c.fecha || ''));
            return `
            <div class="callback-card ${status}">
                <div class="callback-header">
                    <span class="callback-phone">${escapeHtml(c.telefono)}</span>
                    <span class="status-badge status-${status}">
                        ${status === 'pendiente' ? 'Pendiente' : 'Contactado'}
                    </span>
                </div>
                <span class="callback-preference">
                    <i class="fas fa-clock"></i>
                    ${escapeHtml(getPreferenceText(c.preferencia))}
                </span>
                <p class="callback-time">
                    <i class="fas fa-calendar"></i>
                    ${escapeHtml(new Date(c.fecha).toLocaleString('es-EC'))}
                </p>
                <div class="callback-actions">
                    <a href="tel:${escapeHtml(c.telefono)}" class="btn btn-phone btn-sm" aria-label="Llamar al callback ${escapeHtml(c.telefono)}">
                        <i class="fas fa-phone"></i>
                        Llamar
                    </a>
                    ${
                        status === 'pendiente'
                            ? `
                        <button type="button" class="btn btn-primary btn-sm" data-action="mark-contacted" data-callback-id="${callbackId}" data-callback-date="${callbackDateKey}">
                            <i class="fas fa-check"></i>
                            Marcar contactado
                        </button>
                    `
                            : ''
                    }
                </div>
            </div>
        `;
        })
        .join('');
}

export function loadCallbacks() {
    applyCallbackFilterCriteria({
        filter:
            getCallbacksControls().filterSelect?.value ||
            callbackCriteriaState.filter,
        search:
            getCallbacksControls().searchInput?.value ||
            callbackCriteriaState.search,
    });
}

export function filterCallbacks() {
    applyCallbackFilterCriteria({
        filter:
            getCallbacksControls().filterSelect?.value ||
            DEFAULT_CALLBACK_FILTER,
    });
}

function applyCallbackFilterCriteria(criteria, { preserveSearch = true } = {}) {
    const controls = getCallbacksControls();
    const currentSearch =
        controls.searchInput?.value ?? callbackCriteriaState.search;
    const nextSearch = preserveSearch
        ? (criteria.search ?? currentSearch)
        : (criteria.search ?? '');

    const nextCriteria = {
        filter:
            criteria.filter ??
            controls.filterSelect?.value ??
            callbackCriteriaState.filter,
        search: nextSearch,
    };

    const result = getCallbackFilterResult(nextCriteria);
    callbackCriteriaState.filter = result.criteria.filter;
    callbackCriteriaState.search = result.criteria.search;

    renderCallbacks(result.filtered);
    updateCallbacksToolbar(result.filtered, currentCallbacks, result.criteria);
}

export function applyCallbackQuickFilter(
    value,
    { preserveSearch = true } = {}
) {
    applyCallbackFilterCriteria(
        {
            filter: value,
        },
        { preserveSearch }
    );
}

export function searchCallbacks() {
    applyCallbackFilterCriteria({
        search: getCallbacksControls().searchInput?.value || '',
    });
}

export function resetCallbackFilters() {
    applyCallbackFilterCriteria(
        {
            filter: DEFAULT_CALLBACK_FILTER,
            search: '',
        },
        { preserveSearch: false }
    );
}

export function focusCallbackSearch() {
    const searchInput = getCallbacksControls().searchInput;
    if (!(searchInput instanceof HTMLInputElement)) return;
    searchInput.focus({ preventScroll: true });
    searchInput.select();
}

export function isCallbacksSectionActive() {
    return (
        document.getElementById('callbacks')?.classList.contains('active') ||
        false
    );
}

export async function markContacted(callbackId, callbackDate = '') {
    let callback = null;
    const normalizedId = Number(callbackId);
    if (normalizedId > 0) {
        callback = currentCallbacks.find((c) => Number(c.id) === normalizedId);
    }

    const decodedDate = callbackDate ? decodeURIComponent(callbackDate) : '';
    if (!callback && decodedDate) {
        callback = currentCallbacks.find((c) => c.fecha === decodedDate);
    }

    if (!callback) {
        showToast('Callback no encontrado', 'error');
        return;
    }

    try {
        const callbackId = callback.id || Date.now();
        if (!callback.id) {
            callback.id = callbackId;
        }
        await apiRequest('callbacks', {
            method: 'PATCH',
            body: { id: Number(callbackId), status: 'contactado' },
        });
        await refreshData();
        applyCallbackFilterCriteria({
            filter: callbackCriteriaState.filter,
            search: callbackCriteriaState.search,
        });
        loadDashboardData();
        showToast('Marcado como contactado', 'success');
    } catch (error) {
        showToast(`No se pudo actualizar callback: ${error.message}`, 'error');
    }
}
