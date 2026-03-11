import {
    setAppointmentFilter,
    setAppointmentSearch,
} from '../../../../sections/appointments.js';
import { navigateToSection } from '../../navigation.js';

export async function handleContextAction(action) {
    switch (action) {
        case 'context-open-appointments-overview':
            await navigateToSection('appointments');
            setAppointmentFilter('all');
            setAppointmentSearch('');
            return true;
        case 'context-open-appointments-transfer':
            await navigateToSection('appointments');
            setAppointmentFilter('pending_transfer');
            return true;
        case 'context-open-availability':
            await navigateToSection('availability');
            return true;
        case 'context-open-dashboard':
            await navigateToSection('dashboard');
            return true;
        default:
            return false;
    }
}
