import { getState } from '../../../../shared/core/store.js';
import { qs } from '../../../../shared/ui/render.js';
import { writeSlotsForDate } from '../../state.js';
import {
    getSelectedAvailabilityDate,
    normalizeAvailabilityInputTime,
} from '../shared.js';
import { isReadOnlyMode } from '../../selectors.js';

export function addAvailabilitySlot() {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (!(input instanceof HTMLInputElement)) return;

    const time = normalizeAvailabilityInputTime(input.value);
    if (!time) return;

    const state = getState();
    const dateKey = getSelectedAvailabilityDate();
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
