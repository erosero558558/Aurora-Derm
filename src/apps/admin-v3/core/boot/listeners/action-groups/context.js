import {
    clearAppointmentReviewContext,
    setAppointmentFilter,
    setAppointmentSearch,
} from '../../../../sections/appointments.js';
import { openClinicalHistorySession } from '../../../../sections/clinical-history.js';
import { navigateToSection } from '../../navigation.js';

export async function handleContextAction(action, element) {
    switch (action) {
        case 'context-open-appointments-overview':
            await navigateToSection('appointments');
            clearAppointmentReviewContext();
            setAppointmentFilter('all');
            setAppointmentSearch('');
            return true;
        case 'context-open-appointments-transfer':
            await navigateToSection('appointments');
            clearAppointmentReviewContext();
            setAppointmentFilter('pending_transfer');
            return true;
        case 'context-open-availability':
            await navigateToSection('availability');
            return true;
        case 'context-open-dashboard':
            await navigateToSection('dashboard');
            return true;
        case 'context-open-clinical-history':
            await navigateToSection('clinical-history');
            await openClinicalHistorySession(element?.dataset?.sessionId || '');
            return true;
        default:
            return false;
    }
}
