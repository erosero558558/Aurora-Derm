import { setHash } from './persistence.js';

const VALID_SECTIONS = new Set([
    'dashboard',
    'appointments',
    'callbacks',
    'reviews',
    'availability',
    'queue',
]);

export function normalizeSection(value, fallback = 'dashboard') {
    const candidate = String(value || '')
        .trim()
        .toLowerCase();
    if (VALID_SECTIONS.has(candidate)) return candidate;
    return fallback;
}

export function readSectionFromHash(fallback = 'dashboard') {
    const section = String(window.location.hash || '').replace(/^#/, '');
    return normalizeSection(section, fallback);
}

export function setSectionHash(section) {
    setHash(normalizeSection(section));
}

export function getSections() {
    return Array.from(VALID_SECTIONS);
}

export function isSection(value) {
    return VALID_SECTIONS.has(
        String(value || '')
            .trim()
            .toLowerCase()
    );
}
