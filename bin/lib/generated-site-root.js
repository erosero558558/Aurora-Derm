'use strict';

const { relative, resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..', '..');
const GENERATED_SITE_ROOT_RELATIVE = '.generated/site-root';
const GENERATED_SITE_ROOT = resolve(REPO_ROOT, GENERATED_SITE_ROOT_RELATIVE);

const GENERATED_PUBLIC_ENTRIES = ['es', 'en', '_astro'];
const GENERATED_RUNTIME_DIRECTORIES = [
    'js/chunks',
    'js/engines',
    'js/admin-chunks',
];
const GENERATED_RUNTIME_FILES = [
    'script.js',
    'admin.js',
    'js/queue-operator.js',
    'js/booking-calendar.js',
    'js/queue-kiosk.js',
    'js/queue-display.js',
];
const PUBLISHED_ROOT_RUNTIME_DIRECTORIES = ['js/admin-chunks'];
const PUBLISHED_ROOT_RUNTIME_FILES = [
    'admin.js',
    'js/queue-operator.js',
    'js/queue-kiosk.js',
    'js/queue-display.js',
];
const LEGACY_GENERATED_ROOT_DIRECTORIES = [
    ...GENERATED_PUBLIC_ENTRIES,
    'js/chunks',
    'js/engines',
];
const LEGACY_GENERATED_ROOT_FILES = ['script.js', 'js/booking-calendar.js'];
const LEGACY_GENERATED_ROOT_IGNORE_PATTERNS = [
    ...[
        ...LEGACY_GENERATED_ROOT_DIRECTORIES,
        ...PUBLISHED_ROOT_RUNTIME_DIRECTORIES,
    ].map((relativePath) =>
        `${normalizeRelativePath(relativePath)}/`
    ),
    ...[
        ...LEGACY_GENERATED_ROOT_FILES,
        ...PUBLISHED_ROOT_RUNTIME_FILES,
    ].map((relativePath) =>
        normalizeRelativePath(relativePath)
    ),
];

function normalizeRelativePath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .replace(/^\/+/, '');
}

function toRepoRelativePath(filePath, rootPath = REPO_ROOT) {
    return normalizeRelativePath(relative(rootPath, filePath));
}

function resolveGeneratedSiteRootPath(...segments) {
    return resolve(GENERATED_SITE_ROOT, ...segments);
}

function toGeneratedSiteRelativePath(filePath) {
    return toRepoRelativePath(filePath, GENERATED_SITE_ROOT);
}

function isGeneratedSiteRootPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    if (!normalized) {
        return false;
    }

    const prefix = `${GENERATED_SITE_ROOT_RELATIVE}/`.toLowerCase();
    if (normalized === GENERATED_SITE_ROOT_RELATIVE.toLowerCase()) {
        return true;
    }

    return normalized.startsWith(prefix);
}

function isLegacyGeneratedRootPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    if (!normalized) {
        return false;
    }

    for (const relativePath of LEGACY_GENERATED_ROOT_DIRECTORIES) {
        const target = normalizeRelativePath(relativePath).toLowerCase();
        if (!target) continue;
        if (normalized === target || normalized.startsWith(`${target}/`)) {
            return true;
        }
    }

    return LEGACY_GENERATED_ROOT_FILES.some(
        (relativePath) =>
            normalizeRelativePath(relativePath).toLowerCase() === normalized
    );
}

module.exports = {
    REPO_ROOT,
    GENERATED_SITE_ROOT,
    GENERATED_SITE_ROOT_RELATIVE,
    GENERATED_PUBLIC_ENTRIES,
    GENERATED_RUNTIME_DIRECTORIES,
    GENERATED_RUNTIME_FILES,
    PUBLISHED_ROOT_RUNTIME_DIRECTORIES,
    PUBLISHED_ROOT_RUNTIME_FILES,
    LEGACY_GENERATED_ROOT_DIRECTORIES,
    LEGACY_GENERATED_ROOT_FILES,
    LEGACY_GENERATED_ROOT_IGNORE_PATTERNS,
    isGeneratedSiteRootPath,
    isLegacyGeneratedRootPath,
    normalizeRelativePath,
    resolveGeneratedSiteRootPath,
    toGeneratedSiteRelativePath,
    toRepoRelativePath,
};
