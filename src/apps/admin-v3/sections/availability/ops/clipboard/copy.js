import { getState } from '../../../../shared/core/store.js';
import { sortTimes, isReadOnlyMode } from '../../selectors.js';
import { setAvailabilityPatch } from '../../state.js';
import { getSelectedAvailabilityDate } from '../shared.js';

export function copyAvailabilityDay() {
    if (isReadOnlyMode()) return;
    const state = getState();
    const dateKey = getSelectedAvailabilityDate();
    if (!dateKey) return;

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
