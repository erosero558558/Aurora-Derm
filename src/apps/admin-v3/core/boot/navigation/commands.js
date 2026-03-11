import {
    setAppointmentFilter,
    setAppointmentSearch,
} from '../../../sections/appointments.js';
import { setCallbacksFilter } from '../../../sections/callbacks.js';
import {
    callNextForConsultorio,
    setQueueFilter,
} from '../../../shared/modules/queue.js';
import { getState } from '../../../shared/core/store.js';
import { navigateToSection } from './sections.js';

const QUICK_ACTIONS = {
    appointments_overview: async () => {
        await navigateToSection('appointments');
        setAppointmentFilter('all');
        setAppointmentSearch('');
    },
    appointments_pending_transfer: async () => {
        await navigateToSection('appointments');
        setAppointmentFilter('pending_transfer');
        setAppointmentSearch('');
    },
    appointments_all: async () => {
        await navigateToSection('appointments');
        setAppointmentFilter('all');
        setAppointmentSearch('');
    },
    appointments_no_show: async () => {
        await navigateToSection('appointments');
        setAppointmentFilter('no_show');
        setAppointmentSearch('');
    },
    callbacks_pending: async () => {
        await navigateToSection('callbacks');
        setCallbacksFilter('pending');
    },
    callbacks_contacted: async () => {
        await navigateToSection('callbacks');
        setCallbacksFilter('contacted');
    },
    callbacks_sla_urgent: async () => {
        await navigateToSection('callbacks');
        setCallbacksFilter('sla_urgent');
    },
    availability_section: async () => {
        await navigateToSection('availability');
    },
    queue_sla_risk: async () => {
        await navigateToSection('queue');
        setQueueFilter('sla_risk');
    },
    queue_waiting: async () => {
        await navigateToSection('queue');
        setQueueFilter('waiting');
    },
    queue_called: async () => {
        await navigateToSection('queue');
        setQueueFilter('called');
    },
    queue_no_show: async () => {
        await navigateToSection('queue');
        setQueueFilter('no_show');
    },
    queue_all: async () => {
        await navigateToSection('queue');
        setQueueFilter('all');
    },
    queue_call_next: async () => {
        await navigateToSection('queue');
        await callNextForConsultorio(getState().queue.stationConsultorio);
    },
};

export async function runQuickAction(action) {
    const handler = QUICK_ACTIONS[action];
    if (typeof handler === 'function') {
        await handler();
    }
}

export function parseQuickCommand(value) {
    const command = String(value || '')
        .trim()
        .toLowerCase();
    if (!command) return null;
    if (command.includes('callbacks') && command.includes('pend')) {
        return 'callbacks_pending';
    }
    if (
        command.includes('pendient') ||
        (command.includes('llamad') && !command.includes('turnero'))
    ) {
        return 'callbacks_pending';
    }
    if (
        command.includes('callback') &&
        (command.includes('urg') || command.includes('sla'))
    ) {
        return 'callbacks_sla_urgent';
    }
    if (command.includes('agenda') || command.includes('citas')) {
        if (command.includes('transfer')) {
            return 'appointments_pending_transfer';
        }
        return 'appointments_overview';
    }
    if (command.includes('citas') && command.includes('transfer')) {
        return 'appointments_pending_transfer';
    }
    if (
        command.includes('horario') ||
        command.includes('disponibilidad') ||
        command.includes('slots')
    ) {
        return 'availability_section';
    }
    if (
        command.includes('queue') ||
        command.includes('cola') ||
        command.includes('turnero')
    ) {
        return 'queue_sla_risk';
    }
    if (command.includes('no show')) {
        return 'appointments_no_show';
    }
    return null;
}
