import {
    clearAppointmentReviewContext,
    setAppointmentFilter,
    setAppointmentSearch,
} from '../../../sections/appointments.js';
import { setCallbacksFilter } from '../../../sections/callbacks.js';
import { openClinicalHistorySession } from '../../../sections/clinical-history.js';
import {
    clearQueueSearch,
    setQueueFilter,
} from '../../../shared/modules/queue.js';
import { navigateToSection } from './sections.js';

async function openQueueWithFilter(filter = 'all') {
    const navigated = await navigateToSection('queue');
    if (navigated === false) {
        return;
    }
    clearQueueSearch();
    setQueueFilter(filter);
}

const QUICK_ACTIONS = {
    appointments_overview: async () => {
        await navigateToSection('appointments');
        clearAppointmentReviewContext();
        setAppointmentFilter('all');
        setAppointmentSearch('');
    },
    appointments_pending_transfer: async () => {
        await navigateToSection('appointments');
        clearAppointmentReviewContext();
        setAppointmentFilter('pending_transfer');
        setAppointmentSearch('');
    },
    appointments_all: async () => {
        await navigateToSection('appointments');
        clearAppointmentReviewContext();
        setAppointmentFilter('all');
        setAppointmentSearch('');
    },
    appointments_no_show: async () => {
        await navigateToSection('appointments');
        clearAppointmentReviewContext();
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
    agent_panel: async () => {
        const trigger = document.querySelector(
            '[data-action="open-agent-panel"]'
        );
        if (trigger instanceof HTMLElement) {
            trigger.click();
        }
    },
    clinical_history_section: async () => {
        await navigateToSection('clinical-history');
        await openClinicalHistorySession();
    },
    availability_section: async () => {
        await navigateToSection('availability');
    },
    queue_filter_all: async () => {
        await openQueueWithFilter('all');
    },
    queue_filter_waiting: async () => {
        await openQueueWithFilter('waiting');
    },
    queue_filter_called: async () => {
        await openQueueWithFilter('called');
    },
    queue_sla_risk: async () => {
        await openQueueWithFilter('sla_risk');
    },
    queue_filter_sla_risk: async () => {
        await openQueueWithFilter('sla_risk');
    },
    queue_section: async () => {
        await openQueueWithFilter('all');
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
    if (
        command.includes('openclaw') ||
        command.includes('copiloto') ||
        command.includes('copilot') ||
        command.includes('agente ia') ||
        command === 'agente'
    ) {
        return 'agent_panel';
    }
    if (
        command.includes('historia') ||
        command.includes('clinica') ||
        command.includes('clínica') ||
        command.includes('telemedicina') ||
        command.includes('intake') ||
        command.includes('paciente') ||
        command.includes('caso')
    ) {
        return 'clinical_history_section';
    }
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
        command.includes('turnero') ||
        command.includes('cola') ||
        command === 'queue'
    ) {
        return 'queue_section';
    }
    if (command.includes('no show')) {
        return 'appointments_no_show';
    }
    return null;
}
