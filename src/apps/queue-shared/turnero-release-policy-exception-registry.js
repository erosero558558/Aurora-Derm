const STORAGE_KEY = 'turnero-release-policy-exceptions:v1';

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

export function createTurneroReleasePolicyExceptionRegistry(scope = 'global') {
    const key = String(scope || 'global').trim() || 'global';

    return {
        list() {
            const data = readAll();
            return Array.isArray(data[key]) ? data[key] : [];
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[key]) ? data[key] : [];
            const next = {
                id:
                    String(entry.id || `policy-${Date.now()}`).trim() ||
                    `policy-${Date.now()}`,
                title:
                    String(entry.title || 'Policy exception').trim() ||
                    'Policy exception',
                owner:
                    String(entry.owner || 'unassigned').trim() || 'unassigned',
                rationale: String(entry.rationale || '').trim(),
                expiresAt: String(entry.expiresAt || '').trim(),
                status: String(entry.status || 'open').trim() || 'open',
                createdAt:
                    String(
                        entry.createdAt || new Date().toISOString()
                    ).trim() || new Date().toISOString(),
            };

            data[key] = [next, ...rows].slice(0, 100);
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
