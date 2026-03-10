import { normalize } from '../utils.js';

export function buildToolbarStateParts(appointmentsState, visibleCount) {
    const stateParts = [];

    if (normalize(appointmentsState.filter) !== 'all') {
        const labels = {
            pending_transfer: 'Transferencias por validar',
            triage_attention: 'Triage accionable',
            upcoming_48h: 'Proximas 48h',
            no_show: 'No show',
        };
        stateParts.push(
            labels[normalize(appointmentsState.filter)] ||
                appointmentsState.filter
        );
    }

    if (normalize(appointmentsState.search)) {
        stateParts.push(`Busqueda: ${appointmentsState.search}`);
    }

    if (normalize(appointmentsState.sort) === 'patient_az') {
        stateParts.push('Paciente (A-Z)');
    } else if (normalize(appointmentsState.sort) === 'datetime_asc') {
        stateParts.push('Fecha ascendente');
    } else {
        stateParts.push('Fecha reciente');
    }

    if (visibleCount === 0) {
        stateParts.push('Resultados: 0');
    }

    return stateParts;
}
