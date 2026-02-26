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
const CALLBACK_URGENT_THRESHOLD_MINUTES = 120;
const CALLBACK_ATTENTION_THRESHOLD_MINUTES = 45;

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

function getCallbackMinutesSince(dateValue) {
    const parsedDate = parseCallbackDateTime(dateValue);
    if (!parsedDate) return 0;
    const diffMs = Date.now() - parsedDate.getTime();
    if (!Number.isFinite(diffMs)) return 0;
    return Math.max(0, Math.round(diffMs / 60000));
}

function getPendingCallbacksSortedByUrgency(list) {
    const items = Array.isArray(list) ? list : [];
    return items
        .filter(
            (callback) =>
                normalizeCallbackStatus(callback.status) === 'pendiente'
        )
        .map((callback) => ({
            callback,
            minutesWaiting: getCallbackMinutesSince(callback.fecha),
        }))
        .sort((a, b) => {
            if (b.minutesWaiting !== a.minutesWaiting) {
                return b.minutesWaiting - a.minutesWaiting;
            }
            const dateA = parseCallbackDateTime(a.callback.fecha);
            const dateB = parseCallbackDateTime(b.callback.fecha);
            const timeA = dateA ? dateA.getTime() : 0;
            const timeB = dateB ? dateB.getTime() : 0;
            return timeA - timeB;
        });
}

function formatMinutesWaiting(minutes) {
    const normalized = Number(minutes);
    if (!Number.isFinite(normalized) || normalized <= 0) return 'reciÃ©n';
    if (normalized < 60) return `${normalized} min`;
    const hours = Math.floor(normalized / 60);
    const rest = normalized % 60;
    if (rest === 0) return `${hours} h`;
    return `${hours} h ${rest} min`;
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

function renderCallbacksOpsPanel(allCallbacks) {
    const queueHealthEl = document.getElementById('callbacksOpsQueueHealth');
    const pendingCountEl = document.getElementById('callbacksOpsPendingCount');
    const urgentCountEl = document.getElementById('callbacksOpsUrgentCount');
    const todayCountEl = document.getElementById('callbacksOpsTodayCount');
    const nextTargetEl = document.getElementById('callbacksOpsNext');
    const nextButtonEl = document.getElementById('callbacksOpsNextBtn');

    if (
        !queueHealthEl ||
        !pendingCountEl ||
        !urgentCountEl ||
        !todayCountEl ||
        !nextTargetEl
    ) {
        return;
    }

    const pendingWithMeta = getPendingCallbacksSortedByUrgency(allCallbacks);
    const pendingCount = pendingWithMeta.length;
    const urgentCount = pendingWithMeta.filter(
        (item) => item.minutesWaiting >= CALLBACK_URGENT_THRESHOLD_MINUTES
    ).length;
    const attentionCount = pendingWithMeta.filter(
        (item) => item.minutesWaiting >= CALLBACK_ATTENTION_THRESHOLD_MINUTES
    ).length;
    const todayKey = toLocalDateKey(new Date());
    const todayCount = pendingWithMeta.filter((item) => {
        const callbackDate = parseCallbackDateTime(item.callback.fecha);
        return callbackDate ? toLocalDateKey(callbackDate) === todayKey : false;
    }).length;

    pendingCountEl.textContent = escapeHtml(String(pendingCount));
    urgentCountEl.textContent = escapeHtml(String(urgentCount));
    todayCountEl.textContent = escapeHtml(String(todayCount));

    queueHealthEl.className = 'toolbar-chip';
    if (urgentCount > 0 || pendingCount >= 8) {
        queueHealthEl.classList.add('is-warning');
        queueHealthEl.textContent = 'Cola: prioridad alta';
    } else if (attentionCount >= 2 || pendingCount >= 3) {
        queueHealthEl.classList.add('is-accent');
        queueHealthEl.textContent = 'Cola: atenciÃ³n requerida';
    } else {
        queueHealthEl.classList.add('is-muted');
        queueHealthEl.textContent = 'Cola: estable';
    }

    const nextEntry = pendingWithMeta[0] || null;
    if (!nextEntry) {
        nextTargetEl.innerHTML =
            '<span class="toolbar-state-empty">Sin callbacks pendientes en cola.</span>';
        if (nextButtonEl instanceof HTMLButtonElement) {
            nextButtonEl.disabled = true;
        }
        return;
    }

    const nextDate = parseCallbackDateTime(nextEntry.callback.fecha);
    const nextDateLabel = nextDate
        ? nextDate.toLocaleString('es-EC')
        : 'Fecha no disponible';

    nextTargetEl.innerHTML = `
        <div class="callbacks-ops-next-card">
            <span class="callbacks-ops-next-title">Siguiente contacto sugerido</span>
            <strong class="callbacks-ops-next-phone">${escapeHtml(nextEntry.callback.telefono || 'Sin telÃ©fono')}</strong>
            <span class="callbacks-ops-next-meta">Espera: ${escapeHtml(formatMinutesWaiting(nextEntry.minutesWaiting))} | Preferencia: ${escapeHtml(
                getPreferenceText(nextEntry.callback.preferencia)
            )}</span>
            <span class="callbacks-ops-next-meta">Registrado: ${escapeHtml(nextDateLabel)}</span>
        </div>
    `;

    if (nextButtonEl instanceof HTMLButtonElement) {
        nextButtonEl.disabled = false;
    }
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
            const callbackDateValue = String(c.fecha || '');
            const callbackTimestamp =
                parseCallbackDateTime(callbackDateValue)?.getTime() || 0;
            const minutesWaiting = getCallbackMinutesSince(callbackDateValue);
            const waitingTone =
                minutesWaiting >= CALLBACK_URGENT_THRESHOLD_MINUTES
                    ? 'is-warning'
                    : minutesWaiting >= CALLBACK_ATTENTION_THRESHOLD_MINUTES
                      ? 'is-accent'
                      : 'is-muted';
            return `
            <div class="callback-card ${status}" data-callback-status="${status}" data-callback-id="${callbackId}" data-callback-date="${escapeHtml(
                callbackDateKey
            )}" data-callback-ts="${escapeHtml(String(callbackTimestamp))}">
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
                ${
                    status === 'pendiente'
                        ? `<span class="toolbar-chip callback-wait-chip ${waitingTone}">En cola: ${escapeHtml(
                              formatMinutesWaiting(minutesWaiting)
                          )}</span>`
                        : ''
                }
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
    renderCallbacksOpsPanel(currentCallbacks);
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

export function focusNextPendingCallback() {
    const cards = Array.from(
        document.querySelectorAll(
            '#callbacksGrid .callback-card[data-callback-status="pendiente"]'
        )
    );
    if (cards.length === 0) {
        showToast('No hay callbacks pendientes para priorizar.', 'info');
        return false;
    }

    const sortedCards = cards.sort((a, b) => {
        const timeA = Number(a.getAttribute('data-callback-ts') || 0);
        const timeB = Number(b.getAttribute('data-callback-ts') || 0);
        if (
            Number.isFinite(timeA) &&
            Number.isFinite(timeB) &&
            timeA !== timeB
        ) {
            return timeA - timeB;
        }
        return 0;
    });
    const targetCard = sortedCards[0];
    const callButton = targetCard.querySelector('a[href^="tel:"]');
    if (callButton instanceof HTMLElement) {
        targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        callButton.focus({ preventScroll: true });
        return true;
    }

    targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetCard.focus?.();
    return true;
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
