import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-postmortem-workspace:v1';

function getStorage() {
    return typeof localStorage === 'undefined' ? null : localStorage;
}

function readAll() {
    const storage = getStorage();
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
    const storage = getStorage();
    if (!storage) {
        return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createTurneroReleasePostmortemWorkspace(scope = 'global') {
    const normalizedScope = toText(scope, 'global') || 'global';

    return {
        list() {
            const data = readAll();
            return Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : [];
            const next = {
                id: entry.id || `postmortem-${Date.now()}`,
                incidentTitle: entry.incidentTitle || 'Incident review',
                rootCause: entry.rootCause || '',
                correctiveAction: entry.correctiveAction || '',
                owner: entry.owner || 'unassigned',
                status: entry.status || 'open',
                scope: normalizedScope,
                createdAt: entry.createdAt || new Date().toISOString(),
            };
            data[normalizedScope] = [next, ...rows].slice(0, 100);
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
