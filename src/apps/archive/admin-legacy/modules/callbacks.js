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
const DEFAULT_CALLBACK_SORT = 'recent_desc';
const CALLBACK_FILTER_OPTIONS = new Set([
    'all',
    'pending',
    'contacted',
    'today',
    'sla_urgent',
]);
const CALLBACK_SORT_OPTIONS = new Set(['recent_desc', 'waiting_desc']);
const CALLBACK_URGENT_THRESHOLD_MINUTES = 120;
const CALLBACK_ATTENTION_THRESHOLD_MINUTES = 45;

const callbackCriteriaState = {
    filter: DEFAULT_CALLBACK_FILTER,
    search: '',
    sort: DEFAULT_CALLBACK_SORT,
};

const CALLBACK_FILTER_LABELS = {
    all: 'Todos',
    pending: 'Pendientes',
    contacted: 'Contactados',
    today: 'Hoy',
    sla_urgent: 'Urgentes SLA',
};

const CALLBACK_SORT_LABELS = {
    recent_desc: 'Más recientes',
    waiting_desc: 'Mayor espera (SLA)',
};

let lastFilteredCallbacks = [];
const selectedCallbackKeys = new Set();
let callbacksEnhancementsBootstrapped = false;
let callbacksBindingsAttached = false;

function getCallbacksControls() {
    return {
        filterSelect: document.getElementById('callbackFilter'),
        sortSelect: document.getElementById('callbackSort'),
        searchInput: document.getElementById('searchCallbacks'),
        quickFilterButtons: Array.from(
            document.querySelectorAll(
                '[data-action="callback-quick-filter"][data-filter-value]'
            )
        ),
        toolbarMeta: document.getElementById('callbacksToolbarMeta'),
        toolbarState: document.getElementById('callbacksToolbarState'),
        clearFiltersBtn: document.getElementById('clearCallbacksFiltersBtn'),
        selectVisibleBtn: document.getElementById(
            'callbacksBulkSelectVisibleBtn'
        ),
        clearSelectionBtn: document.getElementById('callbacksBulkClearBtn'),
        markSelectedBtn: document.getElementById('callbacksBulkMarkBtn'),
        selectedCountEl: document.getElementById('callbacksSelectedCount'),
        selectionChipEl: document.getElementById('callbacksSelectionChip'),
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

function normalizeCallbackSort(value) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    return CALLBACK_SORT_OPTIONS.has(normalized)
        ? normalized
        : DEFAULT_CALLBACK_SORT;
}

function getCallbackSelectionKey(callback) {
    const callbackId = Number(callback?.id || 0);
    if (callbackId > 0) return `id:${callbackId}`;
    const dateKey = String(callback?.fecha || '').trim();
    const phoneKey = String(callback?.telefono || '').trim();
    const prefKey = String(callback?.preferencia || '').trim();
    return `fallback:${dateKey}|${phoneKey}|${prefKey}`;
}

function decodeSelectionKey(value) {
    if (!value) return '';
    try {
        return decodeURIComponent(String(value));
    } catch (_error) {
        return String(value);
    }
}

function isCallbackPending(callback) {
    return normalizeCallbackStatus(callback?.status) === 'pendiente';
}

function ensureCallbacksToolbarEnhancements() {
    const callbacksSection = document.getElementById('callbacks');
    if (!callbacksSection) return false;

    const toolbar = callbacksSection.querySelector(
        '.section-toolbar-callbacks'
    );
    if (!toolbar) return false;

    const callbackFilterSelect = document.getElementById('callbackFilter');
    if (
        callbackFilterSelect instanceof HTMLSelectElement &&
        !callbackFilterSelect.querySelector('option[value="sla_urgent"]')
    ) {
        const urgentOption = document.createElement('option');
        urgentOption.value = 'sla_urgent';
        urgentOption.textContent = 'Urgentes SLA';
        callbackFilterSelect.appendChild(urgentOption);
    }

    let sortSelect = document.getElementById('callbackSort');
    if (!(sortSelect instanceof HTMLSelectElement)) {
        const sortGroup = document.createElement('div');
        sortGroup.className = 'filter-group callbacks-sort-group';

        const sortLabel = document.createElement('label');
        sortLabel.className = 'sr-only';
        sortLabel.htmlFor = 'callbackSort';
        sortLabel.textContent = 'Orden de callbacks';

        sortSelect = document.createElement('select');
        sortSelect.id = 'callbackSort';
        Object.entries(CALLBACK_SORT_LABELS).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            sortSelect.appendChild(option);
        });
        sortSelect.value = callbackCriteriaState.sort;

        sortGroup.appendChild(sortLabel);
        sortGroup.appendChild(sortSelect);

        const quickFiltersNode = toolbar.querySelector(
            '.callbacks-quick-filters'
        );
        if (quickFiltersNode) {
            toolbar.insertBefore(sortGroup, quickFiltersNode);
        } else {
            toolbar.appendChild(sortGroup);
        }
    } else if (sortSelect.options.length === 0) {
        Object.entries(CALLBACK_SORT_LABELS).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            sortSelect.appendChild(option);
        });
    }

    const quickFiltersGroup = toolbar.querySelector('.callbacks-quick-filters');
    if (
        quickFiltersGroup &&
        !quickFiltersGroup.querySelector('[data-filter-value="sla_urgent"]')
    ) {
        const urgentButton = document.createElement('button');
        urgentButton.type = 'button';
        urgentButton.className = 'callback-quick-filter-btn';
        urgentButton.dataset.action = 'callback-quick-filter';
        urgentButton.dataset.filterValue = 'sla_urgent';
        urgentButton.setAttribute('aria-pressed', 'false');
        urgentButton.title = 'Pendientes con espera mayor a 2 horas';
        urgentButton.textContent = 'Urgentes SLA';
        quickFiltersGroup.appendChild(urgentButton);
    }

    const opsActions = callbacksSection.querySelector('.callbacks-ops-actions');
    if (opsActions) {
        if (!document.getElementById('callbacksBulkSelectVisibleBtn')) {
            const selectVisibleButton = document.createElement('button');
            selectVisibleButton.type = 'button';
            selectVisibleButton.className = 'btn btn-secondary btn-sm';
            selectVisibleButton.id = 'callbacksBulkSelectVisibleBtn';
            selectVisibleButton.innerHTML =
                '<i class="fas fa-list-check"></i> Seleccionar visibles';
            opsActions.appendChild(selectVisibleButton);
        }

        if (!document.getElementById('callbacksBulkClearBtn')) {
            const clearSelectionButton = document.createElement('button');
            clearSelectionButton.type = 'button';
            clearSelectionButton.className = 'btn btn-secondary btn-sm';
            clearSelectionButton.id = 'callbacksBulkClearBtn';
            clearSelectionButton.innerHTML =
                '<i class="fas fa-eraser"></i> Limpiar selección';
            opsActions.appendChild(clearSelectionButton);
        }

        if (!document.getElementById('callbacksBulkMarkBtn')) {
            const markSelectionButton = document.createElement('button');
            markSelectionButton.type = 'button';
            markSelectionButton.className = 'btn btn-primary btn-sm';
            markSelectionButton.id = 'callbacksBulkMarkBtn';
            markSelectionButton.innerHTML =
                '<i class="fas fa-check-double"></i> Marcar seleccionados';
            opsActions.appendChild(markSelectionButton);
        }
    }

    return true;
}

function ensureCallbacksEnhancements() {
    if (callbacksEnhancementsBootstrapped) return true;
    callbacksEnhancementsBootstrapped = ensureCallbacksToolbarEnhancements();
    return callbacksEnhancementsBootstrapped;
}

function getCallbackKeySetFromList(list) {
    return new Set(
        list
            .filter((callback) => isCallbackPending(callback))
            .map((callback) => getCallbackSelectionKey(callback))
    );
}

function reconcileCallbackSelection(filteredCallbacks) {
    const visiblePendingKeys = getCallbackKeySetFromList(filteredCallbacks);
    Array.from(selectedCallbackKeys).forEach((key) => {
        if (!visiblePendingKeys.has(key)) {
            selectedCallbackKeys.delete(key);
        }
    });
}

function getSelectedPendingCallbacks() {
    if (selectedCallbackKeys.size === 0) return [];
    return currentCallbacks.filter(
        (callback) =>
            isCallbackPending(callback) &&
            selectedCallbackKeys.has(getCallbackSelectionKey(callback))
    );
}

function updateCallbackSelectionUi(filteredCallbacks) {
    const controls = getCallbacksControls();
    const pendingVisibleCount = filteredCallbacks.filter((callback) =>
        isCallbackPending(callback)
    ).length;
    const selectedVisibleCount = filteredCallbacks.filter(
        (callback) =>
            isCallbackPending(callback) &&
            selectedCallbackKeys.has(getCallbackSelectionKey(callback))
    ).length;
    const hasSelection = selectedVisibleCount > 0;

    if (controls.selectedCountEl) {
        controls.selectedCountEl.textContent = String(selectedVisibleCount);
    }
    if (controls.selectionChipEl) {
        controls.selectionChipEl.classList.toggle('is-hidden', !hasSelection);
    }
    if (controls.selectVisibleBtn instanceof HTMLButtonElement) {
        controls.selectVisibleBtn.disabled = pendingVisibleCount === 0;
    }
    if (controls.clearSelectionBtn instanceof HTMLButtonElement) {
        controls.clearSelectionBtn.disabled = !hasSelection;
    }
    if (controls.markSelectedBtn instanceof HTMLButtonElement) {
        controls.markSelectedBtn.disabled = !hasSelection;
    }
}

function clearCallbackSelection() {
    selectedCallbackKeys.clear();
    updateCallbackSelectionUi(lastFilteredCallbacks);
}

function selectVisiblePendingCallbacks() {
    const pendingVisible = lastFilteredCallbacks.filter((callback) =>
        isCallbackPending(callback)
    );
    if (pendingVisible.length === 0) {
        showToast(
            'No hay callbacks pendientes visibles para seleccionar.',
            'info'
        );
        return;
    }
    pendingVisible.forEach((callback) => {
        selectedCallbackKeys.add(getCallbackSelectionKey(callback));
    });
    applyCallbackFilterCriteria({
        filter: callbackCriteriaState.filter,
        search: callbackCriteriaState.search,
        sort: callbackCriteriaState.sort,
    });
}

function toggleCallbackSelectionByKey(encodedKey, checked) {
    const decodedKey = decodeSelectionKey(encodedKey);
    if (!decodedKey) return;
    if (checked) {
        selectedCallbackKeys.add(decodedKey);
    } else {
        selectedCallbackKeys.delete(decodedKey);
    }
    updateCallbackSelectionUi(lastFilteredCallbacks);
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
    if (!Number.isFinite(normalized) || normalized <= 0) return 'recién';
    if (normalized < 60) return `${normalized} min`;
    const hours = Math.floor(normalized / 60);
    const rest = normalized % 60;
    if (rest === 0) return `${hours} h`;
    return `${hours} h ${rest} min`;
}

function getSortedCallbacks(list, sortValue = DEFAULT_CALLBACK_SORT) {
    const sort = normalizeCallbackSort(sortValue);
    const sortable = [...list];

    if (sort === 'waiting_desc') {
        return sortable.sort((a, b) => {
            const pendingA = isCallbackPending(a);
            const pendingB = isCallbackPending(b);
            if (pendingA !== pendingB) {
                return pendingA ? -1 : 1;
            }

            const waitingA = pendingA ? getCallbackMinutesSince(a.fecha) : 0;
            const waitingB = pendingB ? getCallbackMinutesSince(b.fecha) : 0;
            if (waitingB !== waitingA) {
                return waitingB - waitingA;
            }

            const dateA = parseCallbackDateTime(a.fecha);
            const dateB = parseCallbackDateTime(b.fecha);
            const timestampA = dateA ? dateA.getTime() : 0;
            const timestampB = dateB ? dateB.getTime() : 0;
            return timestampA - timestampB;
        });
    }

    return sortable.sort((a, b) => {
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
        sort: normalizeCallbackSort(criteria.sort),
    };

    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const filtered = currentCallbacks.filter((callback) => {
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

        if (
            nextCriteria.filter === 'sla_urgent' &&
            (!isCallbackPending(callback) ||
                getCallbackMinutesSince(callback.fecha) <
                    CALLBACK_URGENT_THRESHOLD_MINUTES)
        ) {
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

    return {
        filtered: getSortedCallbacks(filtered, nextCriteria.sort),
        criteria: nextCriteria,
    };
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
        sortSelect,
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
            '<span class="toolbar-chip is-hidden" id="callbacksSelectionChip">Seleccionados: <strong id="callbacksSelectedCount">0</strong></span>',
        ].join('');
    }

    const hasFilter = criteria.filter !== DEFAULT_CALLBACK_FILTER;
    const hasSearch = criteria.search !== '';
    const hasSort = criteria.sort !== DEFAULT_CALLBACK_SORT;

    if (toolbarState) {
        if (!hasFilter && !hasSearch && !hasSort) {
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

            if (hasSort) {
                stateTokens.push(
                    `<span class="toolbar-state-value is-sort">Orden: ${escapeHtml(
                        CALLBACK_SORT_LABELS[criteria.sort] || criteria.sort
                    )}</span>`
                );
            }

            stateTokens.push(
                `<span class="toolbar-state-value">Resultados: ${escapeHtml(String(visibleCount))}</span>`
            );

            toolbarState.innerHTML = stateTokens.join('');
        }
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.classList.toggle(
            'is-hidden',
            !hasFilter && !hasSearch && !hasSort
        );
    }

    if (filterSelect) {
        filterSelect.value = criteria.filter;
    }
    if (sortSelect) {
        sortSelect.value = criteria.sort;
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
        queueHealthEl.textContent = 'Cola: atención requerida';
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
            <strong class="callbacks-ops-next-phone">${escapeHtml(nextEntry.callback.telefono || 'Sin teléfono')}</strong>
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

function ensureCallbacksBindings() {
    if (callbacksBindingsAttached) return;
    const callbacksGrid = document.getElementById('callbacksGrid');
    if (!callbacksGrid) return;

    const controls = getCallbacksControls();
    if (controls.sortSelect instanceof HTMLSelectElement) {
        controls.sortSelect.addEventListener('change', () => {
            applyCallbackFilterCriteria({
                filter: callbackCriteriaState.filter,
                search: callbackCriteriaState.search,
                sort: controls.sortSelect.value || DEFAULT_CALLBACK_SORT,
            });
        });
    }

    if (controls.selectVisibleBtn instanceof HTMLButtonElement) {
        controls.selectVisibleBtn.addEventListener('click', () => {
            selectVisiblePendingCallbacks();
        });
    }

    if (controls.clearSelectionBtn instanceof HTMLButtonElement) {
        controls.clearSelectionBtn.addEventListener('click', () => {
            clearCallbackSelection();
            applyCallbackFilterCriteria({
                filter: callbackCriteriaState.filter,
                search: callbackCriteriaState.search,
                sort: callbackCriteriaState.sort,
            });
        });
    }

    if (controls.markSelectedBtn instanceof HTMLButtonElement) {
        controls.markSelectedBtn.addEventListener('click', () => {
            void markSelectedCallbacksAsContacted();
        });
    }

    callbacksGrid.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches('input[data-callback-select-key]')) return;
        toggleCallbackSelectionByKey(
            target.dataset.callbackSelectKey || '',
            target.checked
        );
    });

    callbacksBindingsAttached = true;
}

export function renderCallbacks(callbacks) {
    ensureCallbacksEnhancements();
    ensureCallbacksBindings();

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
            const callbackSelectionKey = getCallbackSelectionKey(c);
            const callbackSelectionEncoded =
                encodeURIComponent(callbackSelectionKey);
            const callbackTimestamp =
                parseCallbackDateTime(callbackDateValue)?.getTime() || 0;
            const minutesWaiting = getCallbackMinutesSince(callbackDateValue);
            const isPending = status === 'pendiente';
            const isSelected =
                isPending && selectedCallbackKeys.has(callbackSelectionKey);
            const waitingTone =
                minutesWaiting >= CALLBACK_URGENT_THRESHOLD_MINUTES
                    ? 'is-warning'
                    : minutesWaiting >= CALLBACK_ATTENTION_THRESHOLD_MINUTES
                      ? 'is-accent'
                      : 'is-muted';
            return `
            <div class="callback-card ${status}${isSelected ? ' is-selected' : ''}" data-callback-status="${status}" data-callback-id="${callbackId}" data-callback-key="${escapeHtml(
                callbackSelectionEncoded
            )}" data-callback-date="${escapeHtml(
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
                ${
                    isPending
                        ? `<label class="toolbar-chip callback-select-chip"><input type="checkbox" data-callback-select-key="${escapeHtml(
                              callbackSelectionEncoded
                          )}" ${isSelected ? 'checked' : ''} /> Seleccionar</label>`
                        : ''
                }
                <p class="callback-time">
                    <i class="fas fa-calendar"></i>
                    ${escapeHtml(new Date(c.fecha).toLocaleString('es-EC'))}
                </p>
                ${
                    isPending
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
                        isPending
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
    ensureCallbacksEnhancements();
    ensureCallbacksBindings();

    applyCallbackFilterCriteria({
        filter:
            getCallbacksControls().filterSelect?.value ||
            callbackCriteriaState.filter,
        sort:
            getCallbacksControls().sortSelect?.value ||
            callbackCriteriaState.sort,
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
        sort:
            getCallbacksControls().sortSelect?.value ||
            callbackCriteriaState.sort,
    });
}

function applyCallbackFilterCriteria(criteria, { preserveSearch = true } = {}) {
    ensureCallbacksEnhancements();
    ensureCallbacksBindings();

    const controls = getCallbacksControls();
    const currentSearch =
        controls.searchInput?.value ?? callbackCriteriaState.search;
    const currentSort =
        controls.sortSelect?.value ?? callbackCriteriaState.sort;
    const nextSearch = preserveSearch
        ? (criteria.search ?? currentSearch)
        : (criteria.search ?? '');

    const nextCriteria = {
        filter:
            criteria.filter ??
            controls.filterSelect?.value ??
            callbackCriteriaState.filter,
        sort: criteria.sort ?? currentSort,
        search: nextSearch,
    };

    const result = getCallbackFilterResult(nextCriteria);
    callbackCriteriaState.filter = result.criteria.filter;
    callbackCriteriaState.sort = result.criteria.sort;
    callbackCriteriaState.search = result.criteria.search;
    lastFilteredCallbacks = result.filtered;
    reconcileCallbackSelection(result.filtered);

    renderCallbacks(result.filtered);
    updateCallbacksToolbar(result.filtered, currentCallbacks, result.criteria);
    updateCallbackSelectionUi(result.filtered);
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
            sort: DEFAULT_CALLBACK_SORT,
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

async function markSelectedCallbacksAsContacted() {
    const selectedCallbacks = getSelectedPendingCallbacks();
    if (selectedCallbacks.length === 0) {
        showToast('No hay callbacks seleccionados para actualizar.', 'info');
        return;
    }

    let updatedCount = 0;
    let failedCount = 0;

    for (const callback of selectedCallbacks) {
        try {
            let callbackId = Number(callback.id || 0);
            if (callbackId <= 0) {
                callbackId = Date.now() + updatedCount;
                callback.id = callbackId;
            }
            await apiRequest('callbacks', {
                method: 'PATCH',
                body: { id: Number(callbackId), status: 'contactado' },
            });
            updatedCount += 1;
        } catch (_error) {
            failedCount += 1;
        }
    }

    if (updatedCount <= 0) {
        showToast(
            'No se pudieron actualizar los callbacks seleccionados.',
            'error'
        );
        return;
    }

    await refreshData();
    selectedCallbackKeys.clear();
    applyCallbackFilterCriteria({
        filter: callbackCriteriaState.filter,
        sort: callbackCriteriaState.sort,
        search: callbackCriteriaState.search,
    });
    loadDashboardData();

    if (failedCount > 0) {
        showToast(
            `Actualizados ${updatedCount}; con error ${failedCount}.`,
            'info'
        );
        return;
    }

    showToast(
        `Marcados ${updatedCount} callbacks como contactados.`,
        'success'
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
        selectedCallbackKeys.delete(getCallbackSelectionKey(callback));
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
            sort: callbackCriteriaState.sort,
            search: callbackCriteriaState.search,
        });
        loadDashboardData();
        showToast('Marcado como contactado', 'success');
    } catch (error) {
        showToast(`No se pudo actualizar callback: ${error.message}`, 'error');
    }
}
