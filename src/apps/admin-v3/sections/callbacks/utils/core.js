import {
    CALLBACK_FILTER_OPTIONS,
    CALLBACK_SORT_OPTIONS,
} from '../constants.js';

export function normalize(value) {
    return String(value || '')
        .toLowerCase()
        .trim();
}

export function normalizeFilter(value) {
    const normalized = normalize(value);
    return CALLBACK_FILTER_OPTIONS.has(normalized) ? normalized : 'all';
}

export function normalizeSort(value) {
    const normalized = normalize(value);
    return CALLBACK_SORT_OPTIONS.has(normalized) ? normalized : 'priority_desc';
}

export function normalizeStatus(status) {
    const value = normalize(status);
    return value.includes('contact') ||
        value === 'resolved' ||
        value === 'atendido'
        ? 'contacted'
        : 'pending';
}
