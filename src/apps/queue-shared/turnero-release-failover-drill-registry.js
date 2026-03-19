import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-failover-drill-registry:v1';

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

export function createTurneroReleaseFailoverDrillRegistry(scope = 'global') {
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
                id: entry.id || `drill-${Date.now()}`,
                title: entry.title || 'Failover drill',
                mode: entry.mode || 'fallback',
                owner: entry.owner || 'ops',
                result: entry.result || 'planned',
                notes: entry.notes || '',
                scope: normalizedScope,
                at: entry.at || new Date().toISOString(),
            };
            data[normalizedScope] = [next, ...rows].slice(0, 120);
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
