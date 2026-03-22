import { getQueryParam, setHash } from './persistence.js';

const VALID_SECTIONS = new Set([
    'queue',
    'dashboard',
    'clinical-history',
    'appointments',
    'callbacks',
    'availability',
]);

export function normalizeSection(value, fallback = 'queue') {
    const candidate = String(value || '')
        .trim()
        .toLowerCase();
    if (VALID_SECTIONS.has(candidate)) return candidate;
    return fallback;
}

function readHashSection() {
    return normalizeSection(
        String(window.location.hash || '').replace(/^#/, ''),
        ''
    );
}

function readQuerySection() {
    return normalizeSection(getQueryParam('section'), '');
}

export function readSectionFromHash(fallback = 'queue') {
    return readHashSection() || readQuerySection() || normalizeSection('', fallback);
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
