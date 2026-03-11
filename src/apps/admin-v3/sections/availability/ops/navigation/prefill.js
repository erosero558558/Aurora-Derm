import { qs } from '../../../../shared/ui/render.js';
import { isReadOnlyMode } from '../../selectors.js';
import { normalizeAvailabilityInputTime } from '../shared.js';

export function prefillAvailabilityTime(time) {
    if (isReadOnlyMode()) return;
    const input = qs('#newSlotTime');
    if (input instanceof HTMLInputElement) {
        input.value = normalizeAvailabilityInputTime(time);
        input.focus();
    }
}
