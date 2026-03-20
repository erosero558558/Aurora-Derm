import { asObject, toArray, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-review-panel-signoff-store:v1';
const MEMORY_STORAGE = new Map();

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function normalizeScope(value, fallback = 'global') {
    return toText(value, fallback);
}

function normalizeVerdict(value, fallback = 'review') {
    const normalized = toText(value, fallback).toLowerCase();

    if (['approve', 'approved', 'pass', 'ready', 'ok'].includes(normalized)) {
        return 'approve';
    }

    if (
        [
            'reject',
            'rejected',
            'deny',
            'denied',
            'block',
            'blocked',
            'fail',
        ].includes(normalized)
    ) {
        return 'reject';
    }

    if (['hold', 'pending', 'waiting', 'review', 'warn'].includes(normalized)) {
        return 'review';
    }

    return fallback;
}

function normalizeSignoffEntry(entry = {}, fallbackIndex = 1) {
    const row = asObject(entry);
    const id = toText(row.id, `panel-signoff-${Date.now()}-${fallbackIndex}`);

    return {
        id,
        reviewer: toText(row.reviewer, 'reviewer'),
        verdict: normalizeVerdict(row.verdict, 'review'),
        note: toText(row.note, ''),
        createdAt: toText(row.createdAt, new Date().toISOString()),
    };
}

function cloneRows(rows) {
    return rows.map((row) => ({
        ...row,
    }));
}

function readAll() {
    const storage = getStorage();
    if (storage) {
        try {
            const raw = storage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                return parsed && typeof parsed === 'object' ? parsed : {};
            }
            return {};
        } catch (_error) {
            // Fall through to the in-memory cache.
        }
    }

    const cached = MEMORY_STORAGE.get(STORAGE_KEY);
    return cached && typeof cached === 'object' ? cached : {};
}

function writeAll(data) {
    const payload = data && typeof data === 'object' ? data : {};
    const storage = getStorage();
    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(payload));
            return true;
        } catch (_error) {
            // Fall through to the in-memory cache.
        }
    }

    MEMORY_STORAGE.set(STORAGE_KEY, JSON.parse(JSON.stringify(payload)));
    return true;
}

export function createTurneroReleaseReviewPanelSignoffStore(
    scope = 'global',
    seedRows = []
) {
    const normalizedScope = normalizeScope(scope);
    const normalizedSeedRows = toArray(seedRows).map((row, index) =>
        normalizeSignoffEntry(row, index + 1)
    );

    return {
        list() {
            const data = readAll();
            const storedRows = Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : [];
            const rows =
                storedRows.length > 0 ? storedRows : normalizedSeedRows;

            return cloneRows(
                rows.map((row, index) => normalizeSignoffEntry(row, index + 1))
            );
        },
        add(entry = {}) {
            const data = readAll();
            const storedRows = Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : normalizedSeedRows.slice();
            const next = normalizeSignoffEntry(entry, storedRows.length + 1);
            data[normalizedScope] = [next, ...storedRows]
                .slice(0, 100)
                .map((row, index) => normalizeSignoffEntry(row, index + 1));
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            delete data[normalizedScope];
            writeAll(data);
        },
    };
}

export default createTurneroReleaseReviewPanelSignoffStore;
