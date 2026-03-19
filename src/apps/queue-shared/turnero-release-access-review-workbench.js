import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-access-review-workbench:v1';

function safeStorage() {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
            return globalThis.localStorage;
        }
    } catch (_error) {
        // ignore
    }

    try {
        if (typeof localStorage !== 'undefined') {
            return localStorage;
        }
    } catch (_error) {
        // ignore
    }

    return null;
}

function readAll() {
    const storage = safeStorage();
    if (!storage) {
        return {};
    }

    try {
        return JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function writeAll(data) {
    const storage = safeStorage();
    if (!storage) {
        return;
    }

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_error) {
        // ignore non-persistent modes
    }
}

function normalizeScope(value) {
    return toText(value, 'global');
}

function normalizeEntry(scope, entry = {}, index = 0) {
    return {
        id:
            toText(entry.id, `access-${Date.now()}-${index + 1}`) ||
            `access-${Date.now()}-${index + 1}`,
        scope,
        clinicId: toText(entry.clinicId || scope || 'regional', scope),
        subject: toText(entry.subject || entry.title || 'Access review'),
        owner: toText(entry.owner || 'security', 'security'),
        role: toText(entry.role || 'operator', 'operator'),
        status: toText(entry.status || 'pending', 'pending').toLowerCase(),
        note: toText(entry.note || ''),
        reviewedAt: toText(entry.reviewedAt || ''),
        createdAt: toText(entry.createdAt || new Date().toISOString()),
        updatedAt: toText(
            entry.updatedAt || entry.createdAt || new Date().toISOString()
        ),
    };
}

export function createTurneroReleaseAccessReviewWorkbench(scope = 'global') {
    const key = normalizeScope(scope);

    return {
        list() {
            const data = readAll();
            return Array.isArray(data[key])
                ? data[key].map((row) => ({ ...row }))
                : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[key]) ? data[key] : [];
            const next = normalizeEntry(key, entry, rows.length);

            data[key] = [next, ...rows].slice(0, 200);
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                delete data[key];
                writeAll(data);
            }
        },
    };
}
