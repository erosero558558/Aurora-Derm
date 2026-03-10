import {
    setAppointmentFilter,
    setAppointmentSearch,
    setAppointmentSort,
} from '../../../sections/appointments.js';
import {
    setCallbacksFilter,
    setCallbacksSearch,
    setCallbacksSort,
} from '../../../sections/callbacks.js';
import { setQueueSearch } from '../../../shared/modules/queue.js';
import { parseQuickCommand, runQuickAction } from '../navigation.js';

function attachQuickCommandInput(input) {
    input.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const action = parseQuickCommand(input.value);
        if (action) {
            await runQuickAction(action);
        }
    });
}

export function attachInputListeners() {
    const appointmentFilter = document.getElementById('appointmentFilter');
    if (appointmentFilter instanceof HTMLSelectElement) {
        appointmentFilter.addEventListener('change', () => {
            setAppointmentFilter(appointmentFilter.value);
        });
    }

    const appointmentSort = document.getElementById('appointmentSort');
    if (appointmentSort instanceof HTMLSelectElement) {
        appointmentSort.addEventListener('change', () => {
            setAppointmentSort(appointmentSort.value);
        });
    }

    const searchAppointments = document.getElementById('searchAppointments');
    if (searchAppointments instanceof HTMLInputElement) {
        searchAppointments.addEventListener('input', () => {
            setAppointmentSearch(searchAppointments.value);
        });
    }

    const callbackFilter = document.getElementById('callbackFilter');
    if (callbackFilter instanceof HTMLSelectElement) {
        callbackFilter.addEventListener('change', () => {
            setCallbacksFilter(callbackFilter.value);
        });
    }

    const callbackSort = document.getElementById('callbackSort');
    if (callbackSort instanceof HTMLSelectElement) {
        callbackSort.addEventListener('change', () => {
            setCallbacksSort(callbackSort.value);
        });
    }

    const searchCallbacks = document.getElementById('searchCallbacks');
    if (searchCallbacks instanceof HTMLInputElement) {
        searchCallbacks.addEventListener('input', () => {
            setCallbacksSearch(searchCallbacks.value);
        });
    }

    const searchQueue = document.getElementById('queueSearchInput');
    if (searchQueue instanceof HTMLInputElement) {
        searchQueue.addEventListener('input', () => {
            setQueueSearch(searchQueue.value);
        });
    }

    const quickCommand = document.getElementById('adminQuickCommand');
    if (quickCommand instanceof HTMLInputElement) {
        attachQuickCommandInput(quickCommand);
    }
}
