import { CALLBACK_URGENT_THRESHOLD_MINUTES } from '../constants.js';

export function createdAtMs(item) {
    const date = new Date(item?.fecha || item?.createdAt || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function waitingMinutes(item) {
    const stamp = createdAtMs(item);
    if (!stamp) return 0;
    return Math.max(0, Math.round((Date.now() - stamp) / 60000));
}

export function waitingLabel(minutes) {
    if (minutes < 60) return `${minutes} min`;
    if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
    return `${Math.round(minutes / 1440)} d`;
}

export function inToday(value) {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    );
}

export function waitBand(minutes) {
    if (minutes >= CALLBACK_URGENT_THRESHOLD_MINUTES) {
        return {
            label: 'Critico SLA',
            tone: 'danger',
            note: 'Escala inmediata',
        };
    }

    if (minutes >= 45) {
        return {
            label: 'En ventana',
            tone: 'warning',
            note: 'Conviene atender pronto',
        };
    }

    return {
        label: 'Reciente',
        tone: 'neutral',
        note: 'Todavia dentro de margen',
    };
}
