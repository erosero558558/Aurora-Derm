import { setText } from '../../../shared/ui/render.js';
import { buildLiveMeta } from '../markup.js';

export function setLiveStatus(state) {
    const {
        calledTickets,
        nextAppointment,
        pendingTransfers,
        pendingTasks,
        todayAppointments,
        urgentCallbacks,
        waitingTickets,
    } = state;

    const liveStatus =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'Atencion'
            : waitingTickets > 0 || calledTickets > 0 || todayAppointments > 0
              ? 'Activo'
              : 'Estable';
    const liveTone =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'warning'
            : waitingTickets > 0 || calledTickets > 0 || todayAppointments > 0
              ? 'neutral'
              : 'success';

    setText('#dashboardLiveStatus', liveStatus);
    document
        .getElementById('dashboardLiveStatus')
        ?.setAttribute('data-state', liveTone);
    setText(
        '#dashboardLiveMeta',
        buildLiveMeta({
            calledTickets,
            pendingTransfers,
            urgentCallbacks,
            nextAppointment,
            waitingTickets,
        })
    );
    setText(
        '#operationRefreshSignal',
        pendingTasks > 0
            ? 'Tareas claras para recepcion/admin'
            : 'Operacion simple y sin frentes urgentes'
    );
}
