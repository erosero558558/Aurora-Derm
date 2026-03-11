import { normalize } from './core.js';

export function leadOps(item) {
    return item?.leadOps && typeof item.leadOps === 'object'
        ? item.leadOps
        : {};
}

export function priorityBand(item) {
    const value = normalize(leadOps(item).priorityBand);
    return value === 'hot' || value === 'warm' ? value : 'cold';
}

export function priorityRank(item) {
    const band = priorityBand(item);
    return band === 'hot' ? 3 : band === 'warm' ? 2 : 1;
}

export function priorityLabel(item) {
    const band = priorityBand(item);
    return band === 'hot' ? 'Hot' : band === 'warm' ? 'Warm' : 'Cold';
}

export function serviceHint(item) {
    const hints = Array.isArray(leadOps(item).serviceHints)
        ? leadOps(item).serviceHints
        : [];
    return String(hints[0] || '').trim() || 'Sin sugerencia';
}

export function nextActionLabel(item) {
    return (
        String(leadOps(item).nextAction || '').trim() ||
        'Mantener visible en la cola'
    );
}

export function outcomeLabel(item) {
    const value = normalize(leadOps(item).outcome);
    if (value === 'cita_cerrada') return 'Cita cerrada';
    if (value === 'sin_respuesta') return 'Sin respuesta';
    if (value === 'descartado') return 'Descartado';
    if (value === 'contactado') return 'Contactado';
    return 'Pendiente';
}

export function aiStatusLabel(item, workerMode = '') {
    const value = normalize(leadOps(item).aiStatus);
    if (value === 'requested') {
        return workerMode === 'online' ? 'IA pendiente' : 'IA no disponible';
    }
    if (value === 'completed') return 'Borrador listo';
    if (value === 'accepted') return 'Borrador usado';
    if (value === 'failed') return 'IA fallida';
    return workerMode === 'disabled' ? 'IA apagada' : 'Sin IA';
}

export function aiDraftText(item) {
    return String(leadOps(item).aiDraft || '').trim();
}

export function heuristicScore(item) {
    const score = Number(leadOps(item).heuristicScore || 0);
    return Number.isFinite(score) ? score : 0;
}
