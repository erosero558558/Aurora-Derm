import { getState } from '../../../shared/core/store.js';
import { toIsoDateKey } from '../../../shared/ui/render.js';
import {
    cloneAvailability,
    normalizeDateKey,
    normalizeMonthAnchor,
    resolveSelectedDate,
    serializeAvailability,
    sortTimes,
} from '../helpers.js';
import { isReadOnlyMode } from './mode.js';

export function draftIsDirty(draft) {
    const base = cloneAvailability(getState().data.availability || {});
    return serializeAvailability(draft) !== serializeAvailability(base);
}

export function currentDraftMap() {
    const state = getState();
    return cloneAvailability(state.availability.draft || {});
}

export function readSelectedDateOrDefault() {
    const state = getState();
    const selected = normalizeDateKey(state.availability.selectedDate);
    if (selected) return selected;

    const draft = cloneAvailability(state.availability.draft || {});
    const firstDate = Object.keys(draft)[0];
    if (firstDate) return firstDate;

    return toIsoDateKey(new Date());
}

export function resolveAvailabilityViewState() {
    const state = getState();
    const selectedDate = resolveSelectedDate(
        state.availability.selectedDate,
        state.availability.draft || {}
    );
    const monthAnchor = normalizeMonthAnchor(
        state.availability.monthAnchor,
        selectedDate
    );
    return {
        state,
        selectedDate,
        monthAnchor,
        readOnly: isReadOnlyMode(),
    };
}

export function findDateWithSlots(direction = 1) {
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

export function getSelectedDaySlots() {
    const state = getState();
    const selectedDate = readSelectedDateOrDefault();
    const draft = cloneAvailability(state.availability.draft);
    return {
        selectedDate,
        slots: sortTimes(draft[selectedDate] || []),
    };
}
