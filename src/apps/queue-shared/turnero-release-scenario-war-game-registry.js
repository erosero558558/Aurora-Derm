const STORAGE_KEY = 'turnero-release-scenario-war-game-registry:v1';

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
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

export function createTurneroReleaseScenarioWarGameRegistry(scope = 'global') {
    const scopeKey = String(scope || 'global').trim() || 'global';

    return {
        list() {
            const data = readAll();
            return Array.isArray(data[scopeKey]) ? data[scopeKey] : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[scopeKey]) ? data[scopeKey] : [];
            const next = {
                id: entry.id || `wargame-${Date.now()}`,
                title: entry.title || 'Scenario war game',
                owner: entry.owner || 'program',
                mode: entry.mode || 'base',
                strategy: entry.strategy || 'controlled_rollout',
                outcome: entry.outcome || 'pending',
                createdAt: entry.createdAt || new Date().toISOString(),
            };
            data[scopeKey] = [next, ...rows].slice(0, 200);
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            delete data[scopeKey];
            writeAll(data);
        },
    };
}
