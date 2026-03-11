import { createToast } from '../../../shared/ui/render.js';
import { handleAppointmentAction } from './action-groups/appointments.js';
import { handleAvailabilityAction } from './action-groups/availability.js';
import { handleCallbackAction } from './action-groups/callbacks.js';
import { handleContextAction } from './action-groups/context.js';
import {
    dismissQueueSensitiveDialog,
    handleQueueAction,
} from './action-groups/queue.js';
import { handleShellAction } from './action-groups/shell.js';
import {
    closeSidebar,
    isCompactViewport,
    navigateToSection,
} from '../navigation.js';
import { setQueueFilter } from '../../../shared/modules/queue.js';

async function dispatchAction(action, element) {
    const handlers = [
        handleShellAction,
        handleAppointmentAction,
        handleCallbackAction,
        handleAvailabilityAction,
        handleQueueAction,
        handleContextAction,
    ];

    for (const handler of handlers) {
        if (await handler(action, element)) {
            return true;
        }
    }

    return false;
}

function wireCallbacksBulkActions() {
    const callbacksBulkSelect = document.getElementById(
        'callbacksBulkSelectVisibleBtn'
    );
    if (callbacksBulkSelect) {
        callbacksBulkSelect.setAttribute(
            'data-action',
            'callbacks-bulk-select-visible'
        );
    }

    const callbacksBulkClear = document.getElementById('callbacksBulkClearBtn');
    if (callbacksBulkClear) {
        callbacksBulkClear.setAttribute('data-action', 'callbacks-bulk-clear');
    }

    const callbacksBulkMark = document.getElementById('callbacksBulkMarkBtn');
    if (callbacksBulkMark) {
        callbacksBulkMark.setAttribute('data-action', 'callbacks-bulk-mark');
    }
}

export function attachActionListeners() {
    document.addEventListener('click', async (event) => {
        const target =
            event.target instanceof Element
                ? event.target.closest('[data-action]')
                : null;
        if (!target) return;
        const action = String(target.getAttribute('data-action') || '');
        if (!action) return;

        event.preventDefault();

        try {
            await dispatchAction(action, target);
        } catch (error) {
            createToast(error?.message || 'Error ejecutando accion', 'error');
        }
    });

    document.addEventListener('click', async (event) => {
        const nav =
            event.target instanceof Element
                ? event.target.closest('[data-section]')
                : null;
        if (!nav) return;

        event.preventDefault();
        const navigated = await navigateToSection(
            String(nav.getAttribute('data-section') || 'dashboard')
        );

        if (isCompactViewport() && navigated !== false) {
            closeSidebar();
        }
    });

    document.addEventListener('click', (event) => {
        const queueFilterBtn =
            event.target instanceof Element
                ? event.target.closest('[data-queue-filter]')
                : null;
        if (!queueFilterBtn) return;
        event.preventDefault();
        setQueueFilter(
            String(queueFilterBtn.getAttribute('data-queue-filter') || 'all')
        );
    });

    wireCallbacksBulkActions();
}

export { dismissQueueSensitiveDialog };
