import { normalize, toMillis } from '../../helpers.js';
import { setText } from '../../../../ui/render.js';

function getRiskCount(visible) {
    return visible.filter((item) => {
        if (item.status !== 'waiting') return false;
        const ageMinutes = Math.max(
            0,
            Math.round((Date.now() - toMillis(item.createdAt)) / 60000)
        );
        return (
            ageMinutes >= 20 || normalize(item.priorityClass) === 'appt_overdue'
        );
    }).length;
}

export function updateQueueTriageSummary({
    state,
    visible,
    selectedCount,
    activeStationTicket,
}) {
    const riskCount = getRiskCount(visible);
    const summaryParts = [
        riskCount > 0 ? `riesgo: ${riskCount}` : 'sin riesgo',
    ];

    if (selectedCount > 0) summaryParts.push(`seleccion: ${selectedCount}`);
    if (state.queue.fallbackPartial) summaryParts.push('fallback parcial');

    if (activeStationTicket) {
        summaryParts.push(
            `activo: ${activeStationTicket.ticketCode} en C${state.queue.stationConsultorio}`
        );
    }

    setText('#queueTriageSummary', summaryParts.join(' | '));
}
