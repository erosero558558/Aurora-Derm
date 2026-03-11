import { toIsoDateKey } from '../../../shared/ui/render.js';

export function normalizeDateKey(value) {
    const raw = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return '';
    const date = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return toIsoDateKey(date) === raw ? raw : '';
}

export function toDateFromKey(dateKey) {
    const normalized = normalizeDateKey(dateKey);
    if (!normalized) return null;
    const parsed = new Date(`${normalized}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateKeyLabel(dateKey) {
    const date = toDateFromKey(dateKey);
    if (!date) return dateKey || '-';
    return new Intl.DateTimeFormat('es-EC', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
    }).format(date);
}

export function normalizeMonthAnchor(value, fallbackDate = '') {
    let date = null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
        date = new Date(value);
    } else {
        const normalized = normalizeDateKey(value);
        if (normalized) {
            date = new Date(`${normalized}T12:00:00`);
        }
    }

    if (!date) {
        const fallback = toDateFromKey(fallbackDate);
        date = fallback ? new Date(fallback) : new Date();
    }

    date.setDate(1);
    date.setHours(12, 0, 0, 0);
    return date;
}

export function resolveSelectedDate(preferredDate, draftMap) {
    const preferred = normalizeDateKey(preferredDate);
    if (preferred) return preferred;

    const firstDate = Object.keys(draftMap || {})[0];
    if (firstDate) {
        const normalized = normalizeDateKey(firstDate);
        if (normalized) return normalized;
    }

    return toIsoDateKey(new Date());
}

export function resolveWeekBounds(dateKey) {
    const selectedDate = toDateFromKey(dateKey);
    if (!selectedDate) return null;
    const mondayOffset = (selectedDate.getDay() + 6) % 7;
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - mondayOffset);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return {
        start: weekStart,
        end: weekEnd,
    };
}
