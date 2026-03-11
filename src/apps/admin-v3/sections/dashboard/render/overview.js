import { setText } from '../../../shared/ui/render.js';
import { heroSummary } from '../markup.js';

export function setOverviewMetrics(state) {
    const {
        appointments,
        nextAppointment,
        pendingTasks,
        pendingTransfers,
        todayAppointments,
        availabilityDays,
        calledTickets,
        pendingCallbacks,
        waitingTickets,
    } = state;

    setText(
        '#dashboardHeroSummary',
        heroSummary({
            pendingCallbacks,
            pendingTransfers,
            nextAppointment,
            urgentCallbacks: state.urgentCallbacks,
            noShows: state.noShows,
        })
    );
    setText('#opsTodayCount', todayAppointments);
    setText(
        '#opsTodayMeta',
        nextAppointment?.item
            ? `${nextAppointment.item.name || 'Paciente'} a las ${nextAppointment.item.time || '--:--'}`
            : appointments.length > 0
              ? `${appointments.length} cita(s) registradas`
              : 'Sin citas cargadas'
    );
    setText('#opsPendingCount', pendingTasks);
    setText(
        '#opsPendingMeta',
        pendingTasks > 0
            ? `${pendingTransfers} pago(s) y ${pendingCallbacks} llamada(s)`
            : 'Sin pagos ni llamadas pendientes'
    );
    setText('#opsAvailabilityCount', availabilityDays);
    setText(
        '#opsAvailabilityMeta',
        availabilityDays > 0
            ? `${availabilityDays} dia(s) con horarios activos`
            : 'Aun no hay horarios cargados'
    );
    setText(
        '#opsQueueStatus',
        waitingTickets > 0
            ? `${waitingTickets} en espera`
            : calledTickets > 0
              ? `${calledTickets} en atencion`
              : 'Listo para abrir'
    );
    setText(
        '#opsQueueMeta',
        waitingTickets > 0 || calledTickets > 0
            ? `Turnero listo para atender ${waitingTickets + calledTickets} ticket(s)`
            : 'Abre la app solo cuando vayas a llamar pacientes'
    );
}
