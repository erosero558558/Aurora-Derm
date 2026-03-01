import { apiRequest } from '../core/api-client.js';
import { getState, updateState } from '../core/store.js';
import {
    escapeHtml,
    qs,
    setHtml,
    setText,
    toIsoDateKey,
} from '../ui/render.js';

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

function cloneAvailability(map) {
    const next = {};
    Object.entries(map || {}).forEach(([date, times]) => {
        next[date] = sortTimes(Array.isArray(times) ? times : []);
    });
    return next;
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
    if (state.availability.selectedDate) return state.availability.selectedDate;

    const draft = state.availability.draft || {};
    const firstDate = Object.keys(draft).sort()[0];
    if (firstDate) return firstDate;

    return toIsoDateKey(new Date());
}

function updateDraftState(patch) {
    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            ...patch,
        },
    }));
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
            '<p class="empty-message">No hay horarios configurados</p>'
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
    const anchor = new Date(state.availability.monthAnchor || new Date());
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

    const sourceText = readOnly ? 'Google Calendar' : 'Local';
    const modeText = readOnly ? 'Solo lectura' : 'Editable';

    setText(
        '#availabilitySelectionSummary',
        `Fuente: ${sourceText} | Modo: ${modeText} | Slots: ${slotsCount}`
    );
    setText(
        '#availabilityDraftStatus',
        state.availability.draftDirty
            ? 'cambios pendientes'
            : 'Sin cambios pendientes'
    );
    setText(
        '#availabilitySyncStatus',
        readOnly ? 'Google Calendar' : 'Store local'
    );
    setText(
        '#availabilityDayActionsStatus',
        readOnly
            ? 'Edicion bloqueada por proveedor Google'
            : state.availability.clipboard.length
              ? `Portapapeles: ${state.availability.clipboard.length} slots`
              : 'Sin acciones pendientes'
    );

    const addSlotForm = qs('#addSlotForm');
    const presets = qs('#availabilityQuickSlotPresets');
    if (addSlotForm) addSlotForm.classList.toggle('is-hidden', readOnly);
    if (presets) presets.classList.toggle('is-hidden', readOnly);

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
        button.disabled = readOnly;
    });
}

export function syncAvailabilityFromData() {
    const state = getState();
    const baseMap = cloneAvailability(state.data.availability || {});
    const selectedDate = readSelectedDateOrDefault();

    updateDraftState({
        draft: baseMap,
        selectedDate,
        monthAnchor: new Date(selectedDate || new Date()),
        draftDirty: false,
    });
    renderAvailabilitySection();
}

export function renderAvailabilitySection() {
    renderCalendar();
    renderSlotList();
    refreshAvailabilityHeader();
}

export function hasPendingAvailabilityChanges() {
    return Boolean(getState().availability.draftDirty);
}

export function selectAvailabilityDate(dateKey) {
    const normalized = String(dateKey || '').trim();
    if (!normalized) return;
    updateDraftState({ selectedDate: normalized });
    renderAvailabilitySection();
}

export function changeAvailabilityMonth(delta) {
    const amount = Number(delta || 0);
    if (!Number.isFinite(amount) || amount === 0) return;
    updateState((state) => {
        const nextDate = new Date(state.availability.monthAnchor || new Date());
        nextDate.setMonth(nextDate.getMonth() + amount);
        return {
            ...state,
            availability: {
                ...state.availability,
                monthAnchor: nextDate,
            },
        };
    });
    renderAvailabilitySection();
}

export function jumpAvailabilityToday() {
    const today = new Date();
    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            selectedDate: toIsoDateKey(today),
            monthAnchor: new Date(today),
        },
    }));
    renderAvailabilitySection();
}

export function jumpAvailabilityNextWithSlots() {
    const draft = currentDraftMap();
    const today = toIsoDateKey(new Date());
    const candidate = Object.keys(draft)
        .filter(
            (date) =>
                date >= today &&
                Array.isArray(draft[date]) &&
                draft[date].length > 0
        )
        .sort()[0];

    if (!candidate) return;
    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            selectedDate: candidate,
            monthAnchor: new Date(candidate),
        },
    }));
    renderAvailabilitySection();
}

export function prefillAvailabilityTime(time) {
    const input = qs('#newSlotTime');
    if (input instanceof HTMLInputElement) {
        input.value = normalizeTime(time);
        input.focus();
    }
}

function writeSlotsForDate(dateKey, slots) {
    const draft = currentDraftMap();
    const normalizedDate = String(dateKey || '').trim();
    if (!normalizedDate) return;
    draft[normalizedDate] = sortTimes(slots);

    updateDraftState({
        draft,
        selectedDate: normalizedDate,
        draftDirty: true,
    });
    renderAvailabilitySection();
}

export function addAvailabilitySlot() {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;

    const time = normalizeTime(input.value);
    if (!time) return;

    const state = getState();
    const dateKey =
        state.availability.selectedDate || readSelectedDateOrDefault();
    const current = Array.isArray(state.availability.draft[dateKey])
        ? state.availability.draft[dateKey]
        : [];
    writeSlotsForDate(dateKey, [...current, time]);
    input.value = '';
}

export function removeAvailabilitySlot(dateKey, time) {
    if (isReadOnlyMode()) return;
    const state = getState();
    const slots = Array.isArray(state.availability.draft[dateKey])
        ? state.availability.draft[dateKey]
        : [];
    writeSlotsForDate(
        dateKey,
        slots.filter((item) => normalizeTime(item) !== normalizeTime(time))
    );
}

export function copyAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const dateKey =
        state.availability.selectedDate || readSelectedDateOrDefault();
    const slots = Array.isArray(state.availability.draft[dateKey])
        ? state.availability.draft[dateKey]
        : [];
    updateDraftState({ clipboard: sortTimes(slots) });
    renderAvailabilitySection();
}

export function pasteAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const dateKey =
        state.availability.selectedDate || readSelectedDateOrDefault();
    writeSlotsForDate(dateKey, state.availability.clipboard || []);
}

export function duplicateAvailabilityDay(daysOffset) {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        state.availability.selectedDate || readSelectedDateOrDefault();
    const slots = Array.isArray(state.availability.draft[selected])
        ? state.availability.draft[selected]
        : [];
    const baseDate = new Date(selected);
    if (Number.isNaN(baseDate.getTime())) return;

    baseDate.setDate(baseDate.getDate() + Number(daysOffset || 0));
    const targetDate = toIsoDateKey(baseDate);

    const draft = currentDraftMap();
    draft[targetDate] = sortTimes(slots);

    updateDraftState({
        draft,
        selectedDate: targetDate,
        draftDirty: true,
        monthAnchor: new Date(baseDate),
    });
    renderAvailabilitySection();
}

export function clearAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        state.availability.selectedDate || readSelectedDateOrDefault();
    writeSlotsForDate(selected, []);
}

export function clearAvailabilityWeek() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected =
        state.availability.selectedDate || readSelectedDateOrDefault();
    const start = new Date(selected);
    if (Number.isNaN(start.getTime())) return;

    const draft = currentDraftMap();
    for (let i = 0; i < 7; i += 1) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        draft[toIsoDateKey(date)] = [];
    }

    updateDraftState({ draft, draftDirty: true });
    renderAvailabilitySection();
}

export async function saveAvailabilityDraft() {
    if (isReadOnlyMode()) return;
    const draft = currentDraftMap();
    await apiRequest('availability', {
        method: 'POST',
        body: {
            availability: draft,
        },
    });

    updateState((state) => ({
        ...state,
        data: {
            ...state.data,
            availability: draft,
        },
        availability: {
            ...state.availability,
            draft,
            draftDirty: false,
        },
    }));
    renderAvailabilitySection();
}

export function discardAvailabilityDraft() {
    const base = cloneAvailability(getState().data.availability || {});
    updateState((state) => ({
        ...state,
        availability: {
            ...state.availability,
            draft: base,
            draftDirty: false,
        },
    }));
    renderAvailabilitySection();
}
