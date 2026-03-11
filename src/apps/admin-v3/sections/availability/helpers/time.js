export function normalizeTime(value) {
    const match = String(value || '')
        .trim()
        .match(/^(\d{2}):(\d{2})$/);
    if (!match) return '';
    return `${match[1]}:${match[2]}`;
}

export function sortTimes(times) {
    return [...new Set(times.map(normalizeTime).filter(Boolean))].sort();
}
