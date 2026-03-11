import { getState } from '../../../../shared/core/store.js';
import { isReadOnlyMode } from '../../selectors.js';
import { writeSlotsForDate } from '../../state.js';
import { getSelectedAvailabilityDate, offsetDateKey } from '../shared.js';

export function duplicateAvailabilityDay(daysOffset) {
    if (isReadOnlyMode()) return;
    const state = getState();
    const selected = getSelectedAvailabilityDate();
    if (!selected) return;

    const slots = Array.isArray(state.availability.draft[selected])
        ? state.availability.draft[selected]
        : [];
    const targetDate = offsetDateKey(selected, daysOffset);
    if (!targetDate) return;

    writeSlotsForDate(
        targetDate,
        slots,
        `Duplicado ${slots.length} slots en ${targetDate}`
    );
}
