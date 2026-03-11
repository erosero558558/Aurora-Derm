import { getState } from '../../../../shared/core/store.js';
import { normalizeDateKey } from '../../helpers.js';
import { isReadOnlyMode } from '../../selectors.js';
import { writeSlotsForDate } from '../../state.js';
import { normalizeAvailabilityInputTime } from '../shared.js';

export function removeAvailabilitySlot(dateKey, time) {
    if (isReadOnlyMode()) return;
    const normalizedDate = normalizeDateKey(dateKey);
    if (!normalizedDate) return;

    const state = getState();
    const slots = Array.isArray(state.availability.draft[normalizedDate])
        ? state.availability.draft[normalizedDate]
        : [];
    const normalizedTime = normalizeAvailabilityInputTime(time);
    writeSlotsForDate(
        normalizedDate,
        slots.filter(
            (item) => normalizeAvailabilityInputTime(item) !== normalizedTime
        ),
        `Slot ${normalizedTime || '-'} removido en ${normalizedDate}`
    );
}
