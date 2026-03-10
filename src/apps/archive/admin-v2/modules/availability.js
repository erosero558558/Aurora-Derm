import { apiRequest } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';
import {
    escapeHtml,
    qs,
    setHtml,
    setText,
    toIsoDateKey,
} from '../ui/render.js';

const AVAILABILITY_SELECTED_DATE_STORAGE_KEY =
    'admin-availability-selected-date';
const AVAILABILITY_MONTH_ANCHOR_STORAGE_KEY = 'admin-availability-month-anchor';

function normalizeTime(value) {
    const match = String(value || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    if (!match) return '';
    return `${match[1]}:${match[2]}`;
}

function sortTimes(times) {
    return [...new Set(times.map(normalizeTime).filter(Boolean))].sort();
}

function normalizeDateKey(value) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return toIsoDateKey(date) === raw ? raw : '';
}

function toDateFromKey(dateKey) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return null;
    const parsed = new Date(`${normalized}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeAvailabilityMap(map) {
    const next = {};
    Object.keys(map || {})
        .sort()
        .forEach((date) => {
            const normalizedDate = normalizeDateKey(date);
            if (!normalizedDate) return;
            const slots = sortTimes(Array.isArray(map[date]) ? map[date] : []);
            if (!slots.length) return;
            next[normalizedDate] = slots;
        });
    return next;
}

function cloneAvailability(map) {
    return normalizeAvailabilityMap(map || {});
}

function serializeAvailability(map) {
    return JSON.stringify(normalizeAvailabilityMap(map || {}));
}

function draftIsDirty(draft) {
    const base = cloneAvailability(getState().data.availability || {});
    return serializeAvailability(draft) !== serializeAvailability(base);
}

function normalizeMonthAnchor(value, fallbackDate = '') {
    let date = null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        date = new Date(value);
    } else {
        const normalized = normalizeDateKey(value);
        if (normalized) {
            date = new Date(`${normalized}T12:00:00`);
        }
    }

    if (!date) {
        const fallback = toDateFromKey(fallbackDate);
        date = fallback ? new Date(fallback) : new Date();
    }

    date.setDate(1);
    date.setHours(12, 0, 0, 0);
    return date;
}

function resolveSelectedDate(preferredDate, draftMap) {
    const preferred = normalizeDateKey(preferredDate);
    if (preferred) return preferred;

    const firstDate = Object.keys(draftMap || {})[0];
    if (firstDate) {
        const normalized = normalizeDateKey(firstDate);
        if (normalized) return normalized;
    }

    return toIsoDateKey(new Date());
}

function persistAvailabilityPreferences() {
    const state = getState();
    const selectedDate = normalizeDateKey(state.availability.selectedDate);
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );

    try {
        if (selectedDate) {
            localStorage.setItem(
                AVAILABILITY_SELECTED_DATE_STORAGE_KEY,
                selectedDate
            );
        } else {
            localStorage.removeItem(AVAILABILITY_SELECTED_DATE_STORAGE_KEY);
        }
        localStorage.setItem(
            AVAILABILITY_MONTH_ANCHOR_STORAGE_KEY,
            toIsoDateKey(monthAnchor)
        );
    } catch (_error) {
        // no-op
    }
}

export function hydrateAvailabilityPreferences() {
    let selectedDate = '';
    let monthAnchor = '';
    try {
        selectedDate = String(
            localStorage.getItem(AVAILABILITY_SELECTED_DATE_STORAGE_KEY) || ''
        );
        monthAnchor = String(
            localStorage.getItem(AVAILABILITY_MONTH_ANCHOR_STORAGE_KEY) || ''
        );
    } catch (_error) {
        // no-op
    }

    const normalizedSelected = normalizeDateKey(selectedDate);
    const normalizedAnchor = normalizeMonthAnchor(
        monthAnchor,
        normalizedSelected
    );

    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            ...(normalizedSelected ? { selectedDate: normalizedSelected } : {}),
            monthAnchor: normalizedAnchor,
        },
    }));
}

function setAvailabilityPatch(patch, { render = false } = {}) {
    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            ...patch,
        },
    }));
    if (render) {
        renderAvailabilitySection();
    } else {
        persistAvailabilityPreferences();
    }
}

function setDraftAndRender(draft, patch = {}) {
    const normalizedDraft = cloneAvailability(draft);
    const selectedDate = resolveSelectedDate(
        patch.selectedDate || getState().availability.selectedDate,
        normalizedDraft
    );
    const monthAnchor = normalizeMonthAnchor(
        patch.monthAnchor || getState().availability.monthAnchor,
        selectedDate
    );

    setAvailabilityPatch(
        {
            draft: normalizedDraft,
            selectedDate,
            monthAnchor,
            draftDirty: draftIsDirty(normalizedDraft),
            ...patch,
        },
        { render: true }
    );
}

function setActionStatus(statusMessage) {
    setAvailabilityPatch(
        {
            lastAction: String(statusMessage || ''),
        },
        { render: true }
    );
}

function writeSlotsForDate(dateKey, slots, lastAction = '') {
    const normalizedDate =
        normalizeDateKey(dateKey) || readSelectedDateOrDefault();
    if (!normalizedDate) return;

    const draft = currentDraftMap();
    const nextSlots = sortTimes(Array.isArray(slots) ? slots : []);
    if (nextSlots.length) {
        draft[normalizedDate] = nextSlots;
    } else {
        delete draft[normalizedDate];
    }

    setDraftAndRender(draft, {
        selectedDate: normalizedDate,
        monthAnchor: normalizedDate,
        lastAction,
    });
}

function getCalendarModeSummary() {
    const meta = getState().data.availabilityMeta || {};
    const readOnly = isReadOnlyMode();
    const sourceText = readOnly ? 'Google Calendar' : 'Local';
    const modeText = readOnly ? 'Solo lectura' : 'Editable';
    const timezone = String(
        meta.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || '-'
    );
    return { sourceText, modeText, timezone };
}

function resolveWeekBounds(dateKey) {
    const selectedDate = toDateFromKey(dateKey);
    if (!selectedDate) return null;
    const mondayOffset = (selectedDate.getDay() + 6) % 7;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
        start: weekStart,
        end: weekEnd,
    };
}

function currentDraftMap() {
    const state = getState();
    return cloneAvailability(state.availability.draft || {});
}

function isReadOnlyMode() {
    const state = getState();
    const meta = state.data.availabilityMeta || {};
    return String(meta.source || '').toLowerCase() === 'google';
}

function monthLabel(date) {
    return new Intl.DateTimeFormat('es-EC', {
        month: 'long',
        year: 'numeric',
    }).format(date);
}

function buildMonthDays(anchorDate) {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const offset = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - offset);

    const days = [];
    for (let i = 0; i < 42; i += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        days.push(date);
    }
    return days;
}

function readSelectedDateOrDefault() {
    const state = getState();
    const selected = normalizeDateKey(state.availability.selectedDate);
    if (selected) return selected;

    const draft = cloneAvailability(state.availability.draft || {});
    const firstDate = Object.keys(draft)[0];
    if (firstDate) return firstDate;

    return toIsoDateKey(new Date());
}

function renderSlotList() {
    const state = getState();
    const selectedDate = readSelectedDateOrDefault();
    const draft = cloneAvailability(state.availability.draft);
    const slots = sortTimes(draft[selectedDate] || []);

    setText('#selectedDate', selectedDate || '-');

    if (!slots.length) {
        setHtml(
            '#timeSlotsList',
            `<p class="empty-message">${
                isReadOnlyMode()
                    ? 'No hay horarios configurados (Solo lectura)'
                    : 'No hay horarios configurados'
            }</p>`
        );
        return;
    }

    setHtml(
        '#timeSlotsList',
        slots
            .map(
                (time) => `
            <div class="time-slot-item">
                <span>${escapeHtml(time)}</span>
                <button type="button" data-action="remove-time-slot" data-date="${encodeURIComponent(selectedDate)}" data-time="${encodeURIComponent(time)}" ${isReadOnlyMode() ? 'disabled' : ''}>Quitar</button>
            </div>
        `
            )
            .join('')
    );
}

function renderCalendar() {
    const state = getState();
    const anchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        state.availability.selectedDate
    );
    const selectedDate = readSelectedDateOrDefault();
    const currentMonth = anchor.getMonth();
    const draft = cloneAvailability(state.availability.draft);
    const today = toIsoDateKey(new Date());

    setText('#calendarMonth', monthLabel(anchor));

    const markup = buildMonthDays(anchor)
        .map((date) => {
            const dateKey = toIsoDateKey(date);
            const hasSlots =
                Array.isArray(draft[dateKey]) && draft[dateKey].length > 0;
            const inMonth = date.getMonth() === currentMonth;
            const classes = [
                'calendar-day',
                inMonth ? '' : 'other-month',
                hasSlots ? 'has-slots' : '',
                dateKey === selectedDate ? 'is-selected' : '',
                dateKey === today ? 'is-today' : '',
            ]
                .filter(Boolean)
                .join(' ');
            return `
                <button type="button" class="${classes}" data-action="select-availability-day" data-date="${dateKey}">
                    <span>${date.getDate()}</span>
                    ${hasSlots ? `<small>${draft[dateKey].length} slots</small>` : ''}
                </button>
            `;
        })
        .join('');

    setHtml('#availabilityCalendar', markup);
}

function refreshAvailabilityHeader() {
    const state = getState();
    const selectedDate = readSelectedDateOrDefault();
    const draft = cloneAvailability(state.availability.draft);
    const slotsCount = Array.isArray(draft[selectedDate])
        ? draft[selectedDate].length
        : 0;
    const readOnly = isReadOnlyMode();
    const { sourceText, modeText, timezone } = getCalendarModeSummary();

    setText(
        '#availabilityHeading',
        readOnly
            ? 'Configurar Horarios Disponibles · Solo lectura'
            : 'Configurar Horarios Disponibles'
    );
    setText('#availabilitySourceBadge', `Fuente: ${sourceText}`);
    setText('#availabilityModeBadge', `Modo: ${modeText}`);
    setText('#availabilityTimezoneBadge', `TZ: ${timezone}`);

    setText(
        '#availabilitySelectionSummary',
        `Fecha: ${selectedDate} | Fuente: ${sourceText} | Modo: ${modeText} | Slots: ${slotsCount}`
    );
    setText(
        '#availabilityDraftStatus',
        state.availability.draftDirty
            ? 'cambios pendientes'
            : 'Sin cambios pendientes'
    );
    setText(
        '#availabilitySyncStatus',
        readOnly ? `Google Calendar | ${timezone}` : `Store local | ${timezone}`
    );

    const addSlotForm = qs('#addSlotForm');
    const presets = qs('#availabilityQuickSlotPresets');
    if (addSlotForm) addSlotForm.classList.toggle('is-hidden', readOnly);
    if (presets) presets.classList.toggle('is-hidden', readOnly);

    const addSlotInput = qs('#newSlotTime');
    if (addSlotInput instanceof HTMLInputElement) {
        addSlotInput.disabled = readOnly;
    }

    const addSlotButton = qs('[data-action="add-time-slot"]');
    if (addSlotButton instanceof HTMLButtonElement) {
        addSlotButton.disabled = readOnly;
    }

    const clipboardSize = Array.isArray(state.availability.clipboard)
        ? state.availability.clipboard.length
        : 0;
    let dayActionStatus = 'Sin acciones pendientes';
    if (readOnly) {
        dayActionStatus = 'Edicion bloqueada por proveedor Google';
    } else if (state.availability.lastAction) {
        dayActionStatus = String(state.availability.lastAction);
    } else if (clipboardSize) {
        dayActionStatus = `Portapapeles: ${clipboardSize} slots`;
    }
    setText('#availabilityDayActionsStatus', dayActionStatus);

    const actionButtons = document.querySelectorAll(
        '#availabilityDayActions [data-action], #availabilitySaveDraftBtn, #availabilityDiscardDraftBtn'
    );
    actionButtons.forEach((button) => {
        if (!(button instanceof HTMLButtonElement)) return;
        if (button.id === 'availabilityDiscardDraftBtn') {
            button.disabled = readOnly || !state.availability.draftDirty;
            return;
        }
        if (button.id === 'availabilitySaveDraftBtn') {
            button.disabled = readOnly || !state.availability.draftDirty;
            return;
        }
        const action = String(button.dataset.action || '');
        if (action === 'paste-availability-day') {
            button.disabled = readOnly || clipboardSize === 0;
            return;
        }
        button.disabled = readOnly;
    });
}

function jumpToAvailabilityDate(dateKey, label) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return;
    setAvailabilityPatch(
        {
            selectedDate: normalized,
            monthAnchor: normalizeMonthAnchor(normalized, normalized),
            lastAction: label || '',
        },
        { render: true }
    );
}

function findDateWithSlots(direction = 1) {
    const draft = currentDraftMap();
    const keys = Object.keys(draft).filter((date) => draft[date]?.length > 0);
    if (!keys.length) return '';

    const reference =
        normalizeDateKey(getState().availability.selectedDate) ||
        toIsoDateKey(new Date());

    const ordered = direction >= 0 ? keys.sort() : keys.sort().reverse();
    return (
        ordered.find((date) =>
            direction >= 0 ? date >= reference : date <= reference
        ) || ''
    );
}

export function syncAvailabilityFromData() {
    const state = getState();
    const baseMap = cloneAvailability(state.data.availability || {});
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        baseMap
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );

    setAvailabilityPatch({
        draft: baseMap,
        selectedDate,
        monthAnchor,
        draftDirty: false,
        lastAction: '',
    });
    renderAvailabilitySection();
}

export function renderAvailabilitySection() {
    renderCalendar();
    renderSlotList();
    refreshAvailabilityHeader();
    persistAvailabilityPreferences();
}

export function hasPendingAvailabilityChanges() {
    return Boolean(getState().availability.draftDirty);
}

export function selectAvailabilityDate(dateKey) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return;
    setAvailabilityPatch(
        {
            selectedDate: normalized,
            monthAnchor: normalizeMonthAnchor(normalized, normalized),
            lastAction: '',
        },
        { render: true }
    );
}

export function changeAvailabilityMonth(delta) {
    const amount = Number(delta || 0);
    if (!Number.isFinite(amount) || amount === 0) return;
    const current = normalizeMonthAnchor(
        getState().availability.monthAnchor,
        getState().availability.selectedDate
    );
    current.setMonth(current.getMonth() + amount);
    setAvailabilityPatch(
        {
            monthAnchor: current,
            lastAction: '',
        },
        { render: true }
    );
}

export function jumpAvailabilityToday() {
    const today = toIsoDateKey(new Date());
    jumpToAvailabilityDate(today, 'Hoy');
}

export function jumpAvailabilityNextWithSlots() {
    const candidate = findDateWithSlots(1);
    if (!candidate) {
        setActionStatus('No hay fechas siguientes con slots');
        return;
    }
    jumpToAvailabilityDate(
        candidate,
        `Siguiente fecha con slots: ${candidate}`
    );
}

export function jumpAvailabilityPrevWithSlots() {
    const candidate = findDateWithSlots(-1);
    if (!candidate) {
        setActionStatus('No hay fechas anteriores con slots');
        return;
    }
    jumpToAvailabilityDate(candidate, `Fecha previa con slots: ${candidate}`);
}

export function prefillAvailabilityTime(time) {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (input instanceof HTMLInputElement) {
        input.value = normalizeTime(time);
        input.focus();
    }
}

export function addAvailabilitySlot() {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;

    const time = normalizeTime(input.value);
    if (!time) return;

    const state = getState();
    const dateKey =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    if (!dateKey) return;

    const current = Array.isArray(state.availability.draft[dateKey])
        ? state.availability.draft[dateKey]
        : [];
    writeSlotsForDate(
        dateKey,
        [...current, time],
        `Slot ${time} agregado en ${dateKey}`
    );
    input.value = '';
}

export function removeAvailabilitySlot(dateKey, time) {
    if (isReadOnlyMode()) return;
    const normalizedDate = normalizeDateKey(dateKey);
    if (!normalizedDate) return;

    const state = getState();
    const slots = Array.isArray(state.availability.draft[normalizedDate])
        ? state.availability.draft[normalizedDate]
        : [];
    const normalizedTime = normalizeTime(time);
    writeSlotsForDate(
        normalizedDate,
        slots.filter((item) => normalizeTime(item) !== normalizedTime),
        `Slot ${normalizedTime || '-'} removido en ${normalizedDate}`
    );
}

export function copyAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const dateKey =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    const slots = Array.isArray(state.availability.draft[dateKey])
        ? sortTimes(state.availability.draft[dateKey])
        : [];

    setAvailabilityPatch(
        {
            clipboard: slots,
            clipboardDate: dateKey,
            lastAction: slots.length
                ? `Portapapeles: ${slots.length} slots (${dateKey})`
                : 'Portapapeles vacio',
        },
        { render: true }
    );
}

export function pasteAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const clipboard = Array.isArray(state.availability.clipboard)
        ? sortTimes(state.availability.clipboard)
        : [];
    if (!clipboard.length) {
        setActionStatus('Portapapeles vacio');
        return;
    }

    const dateKey =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    writeSlotsForDate(
        dateKey,
        clipboard,
        `Pegado ${clipboard.length} slots en ${dateKey}`
    );
}

export function duplicateAvailabilityDay(daysOffset) {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    const slots = Array.isArray(state.availability.draft[selected])
        ? state.availability.draft[selected]
        : [];
    const baseDate = toDateFromKey(selected);
    if (!baseDate) return;

    baseDate.setDate(baseDate.getDate() + Number(daysOffset || 0));
    const targetDate = toIsoDateKey(baseDate);
    writeSlotsForDate(
        targetDate,
        slots,
        `Duplicado ${slots.length} slots en ${targetDate}`
    );
}

export function clearAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    if (!selected) return;

    const confirmed = window.confirm(
        `Se eliminaran los slots del dia ${selected}. ¿Continuar?`
    );
    if (!confirmed) return;

    writeSlotsForDate(selected, [], `Dia ${selected} limpiado`);
}

export function clearAvailabilityWeek() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        normalizeDateKey(state.availability.selectedDate) ||
        readSelectedDateOrDefault();
    if (!selected) return;

    const bounds = resolveWeekBounds(selected);
    if (!bounds) return;
    const startKey = toIsoDateKey(bounds.start);
    const endKey = toIsoDateKey(bounds.end);

    const confirmed = window.confirm(
        `Se eliminaran los slots de la semana ${startKey} a ${endKey}. ¿Continuar?`
    );
    if (!confirmed) return;

    const draft = currentDraftMap();
    for (let i = 0; i < 7; i += 1) {
        const date = new Date(bounds.start);
        date.setDate(bounds.start.getDate() + i);
        delete draft[toIsoDateKey(date)];
    }

    setDraftAndRender(draft, {
        selectedDate: selected,
        lastAction: `Semana limpiada (${startKey} - ${endKey})`,
    });
}

export async function saveAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const draft = currentDraftMap();
    const response = await apiRequest('availability', {
        method: 'POST',
        body: {
            availability: draft,
        },
    });

    const serverDraft =
        response?.data && typeof response.data === 'object'
            ? cloneAvailability(response.data)
            : draft;
    const responseMeta =
        response?.meta && typeof response.meta === 'object'
            ? response.meta
            : null;

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            availability: serverDraft,
            availabilityMeta: responseMeta
                ? {
                      ...state.data.availabilityMeta,
                      ...responseMeta,
                  }
                : state.data.availabilityMeta,
        },
        availability: {
            ...state.availability,
            draft: serverDraft,
            draftDirty: false,
            lastAction: `Cambios guardados ${new Date().toLocaleTimeString(
                'es-EC',
                {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                }
            )}`,
        },
    }));
    renderAvailabilitySection();
}

export function discardAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const state = getState();
    if (state.availability.draftDirty) {
        const confirmed = window.confirm(
            'Se descartaran los cambios pendientes de disponibilidad. ¿Continuar?'
        );
        if (!confirmed) return;
    }

    const base = cloneAvailability(state.data.availability || {});
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        base
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );
    setAvailabilityPatch(
        {
            draft: base,
            selectedDate,
            monthAnchor,
            draftDirty: false,
            lastAction: 'Borrador descartado',
        },
        { render: true }
    );
}
