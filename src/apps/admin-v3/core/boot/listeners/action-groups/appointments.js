import { createToast } from '../../../../shared/ui/render.js';
import {
    approveTransfer,
    cancelAppointment,
    clearAppointmentFilters,
    exportAppointmentsCsv,
    markNoShow,
    rejectTransfer,
    setAppointmentDensity,
    setAppointmentFilter,
} from '../../../../sections/appointments.js';

export async function handleAppointmentAction(action, element) {
    switch (action) {
        case 'appointment-quick-filter':
            setAppointmentFilter(String(element.dataset.filterValue || 'all'));
            return true;
        case 'clear-appointment-filters':
            clearAppointmentFilters();
            return true;
        case 'appointment-density':
            setAppointmentDensity(
                String(element.dataset.density || 'comfortable')
            );
            return true;
        case 'approve-transfer':
            await approveTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia aprobada', 'success');
            return true;
        case 'reject-transfer':
            await rejectTransfer(Number(element.dataset.id || 0));
            createToast('Transferencia rechazada', 'warning');
            return true;
        case 'mark-no-show':
            await markNoShow(Number(element.dataset.id || 0));
            createToast('Marcado como no show', 'warning');
            return true;
        case 'cancel-appointment':
            await cancelAppointment(Number(element.dataset.id || 0));
            createToast('Cita cancelada', 'warning');
            return true;
        case 'export-csv':
            exportAppointmentsCsv();
            return true;
        default:
            return false;
    }
}
