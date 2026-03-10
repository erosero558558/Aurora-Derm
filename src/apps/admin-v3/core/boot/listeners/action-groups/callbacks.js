import {
    clearCallbacksFilters,
    clearCallbacksSelection,
    focusNextPendingCallback,
    markCallbackContacted,
    markSelectedCallbacksContacted,
    selectVisibleCallbacks,
    setCallbacksFilter,
} from '../../../../sections/callbacks.js';
import { createToast } from '../../../../shared/ui/render.js';
import { navigateToSection } from '../../navigation.js';

export async function handleCallbackAction(action, element) {
    switch (action) {
        case 'callback-quick-filter':
            setCallbacksFilter(String(element.dataset.filterValue || 'all'));
            return true;
        case 'clear-callback-filters':
            clearCallbacksFilters();
            return true;
        case 'callbacks-triage-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return true;
        case 'mark-contacted':
            await markCallbackContacted(
                Number(element.dataset.callbackId || 0),
                String(element.dataset.callbackDate || '')
            );
            createToast('Callback actualizado', 'success');
            return true;
        case 'callbacks-bulk-select-visible':
            selectVisibleCallbacks();
            return true;
        case 'callbacks-bulk-clear':
            clearCallbacksSelection();
            return true;
        case 'callbacks-bulk-mark':
            await markSelectedCallbacksContacted();
            return true;
        case 'context-open-callbacks-pending':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            return true;
        case 'context-open-callbacks-next':
            await navigateToSection('callbacks');
            setCallbacksFilter('pending');
            focusNextPendingCallback();
            return true;
        default:
            return false;
    }
}
