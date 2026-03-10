import { hasPendingAvailabilityChanges } from '../../../sections/availability.js';

export function attachExitGuards() {
    window.addEventListener('beforeunload', (event) => {
        if (!hasPendingAvailabilityChanges()) return;
        event.preventDefault();
        event.returnValue = '';
    });
}
