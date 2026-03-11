import { setText } from '../../../shared/ui/render.js';
import { relativeWindow } from '../time.js';

export function setFlowMetrics(state) {
    const {
        availabilityDays,
        calledTickets,
        nextAppointment,
        pendingCallbacks,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
        waitingTickets,
    } = state;

    setText(
        '#dashboardQueueHealth',
        waitingTickets > 0 || calledTickets > 0
            ? 'El turnero esta activo en una app separada'
            : 'El turnero avanzado sigue disponible en Mas herramientas'
    );
    setText(
        '#dashboardFlowStatus',
        nextAppointment?.item
            ? `${relativeWindow(nextAppointment.stamp)} | ${nextAppointment.item.name || 'Paciente'}`
            : availabilityDays > 0
              ? `${availabilityDays} dia(s) con horarios publicados`
              : 'Sin citas inmediatas ni cola activa'
    );

    setText('#operationPendingReviewCount', pendingTransfers);
    setText('#operationPendingCallbacksCount', pendingCallbacks);
    setText('#operationTodayLoadCount', todayAppointments);
    setText(
        '#operationDeckMeta',
        pendingTransfers > 0 || urgentCallbacks > 0 || pendingCallbacks > 0
            ? 'Estas son las acciones utiles del dia'
            : nextAppointment?.item
              ? 'La siguiente accion ya esta clara'
              : 'Operacion sin frentes urgentes'
    );
    setText(
        '#operationQueueHealth',
        pendingTransfers > 0
            ? `${pendingTransfers} pago(s) requieren revision antes de cerrar el dia`
            : nextAppointment?.item
              ? `Siguiente paciente: ${nextAppointment.item.name || 'Paciente'} ${relativeWindow(nextAppointment.stamp).toLowerCase()}`
              : 'Sin citas inmediatas en cola'
    );
}
