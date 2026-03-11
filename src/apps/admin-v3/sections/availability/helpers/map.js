import { normalizeDateKey } from './date.js';
import { sortTimes } from './time.js';

export function normalizeAvailabilityMap(map) {
    const next = {};
    Object.keys(map || {})
        .sort()
        .forEach((date) => {
            const normalizedDate = normalizeDateKey(date);
            if (!normalizedDate) return;
            const slots = sortTimes(Array.isArray(map[date]) ? map[date] : []);
            if (!slots.length) return;
            next[normalizedDate] = slots;
        });
    return next;
}

export function cloneAvailability(map) {
    return normalizeAvailabilityMap(map || {});
}

export function serializeAvailability(map) {
    return JSON.stringify(normalizeAvailabilityMap(map || {}));
}
