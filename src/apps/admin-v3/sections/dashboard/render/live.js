import { setText } from '../../../shared/ui/render.js';
import { buildLiveMeta } from '../markup.js';

export function setLiveStatus(state) {
    const {
        nextAppointment,
        pendingTransfers,
        todayAppointments,
        urgentCallbacks,
    } = state;

    const liveStatus =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'Atencion'
            : todayAppointments > 0
              ? 'Activo'
              : 'Estable';
    const liveTone =
        pendingTransfers > 0 || urgentCallbacks > 0
            ? 'warning'
            : todayAppointments > 0
              ? 'neutral'
              : 'success';

    setText('#dashboardLiveStatus', liveStatus);
    document
        .getElementById('dashboardLiveStatus')
        ?.setAttribute('data-state', liveTone);
    setText(
        '#dashboardLiveMeta',
        buildLiveMeta({
            pendingTransfers,
            urgentCallbacks,
            nextAppointment,
        })
    );
}
