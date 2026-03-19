const STORAGE_KEY = 'turnero-release-audit-trail:v1';

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

export function createTurneroReleaseAuditTrailStore(scope = 'global') {
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
                    String(entry.id || `audit-${Date.now()}`).trim() ||
                    `audit-${Date.now()}`,
                action: String(entry.action || 'review').trim() || 'review',
                actor: String(entry.actor || 'system').trim() || 'system',
                note: String(entry.note || '').trim(),
                status: String(entry.status || 'recorded').trim() || 'recorded',
                at:
                    String(entry.at || new Date().toISOString()).trim() ||
                    new Date().toISOString(),
            };

            data[key] = [next, ...rows].slice(0, 300);
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
