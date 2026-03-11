import { getState } from '../../../../shared/core/store.js';
import { sortTimes, isReadOnlyMode } from '../../selectors.js';
import { setActionStatus, writeSlotsForDate } from '../../state.js';
import { getSelectedAvailabilityDate } from '../shared.js';

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

    const dateKey = getSelectedAvailabilityDate();
    if (!dateKey) return;

    writeSlotsForDate(
        dateKey,
        clipboard,
        `Pegado ${clipboard.length} slots en ${dateKey}`
    );
}
