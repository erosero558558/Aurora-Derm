import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-recovery-checkpoint-journal:v1';

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

export function createTurneroReleaseRecoveryCheckpointJournal(
    scope = 'global'
) {
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
                id: entry.id || `recovery-${Date.now()}`,
                label: entry.label || 'Recovery checkpoint',
                owner: entry.owner || 'unassigned',
                state: entry.state || 'open',
                note: entry.note || '',
                scope: normalizedScope,
                at: entry.at || new Date().toISOString(),
            };
            data[normalizedScope] = [next, ...rows].slice(0, 200);
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
