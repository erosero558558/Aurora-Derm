import { asObject, toArray, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-blocker-settlement-ledger:v1';
const MEMORY_STORAGE = new Map();

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function readAll() {
    const storage = getStorage();
    if (storage) {
        try {
            return JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
        } catch (_error) {
            return {};
        }
    }

    return asObject(MEMORY_STORAGE.get(STORAGE_KEY));
}

function writeAll(data) {
    const storage = getStorage();
    if (storage) {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
        return;
    }

    MEMORY_STORAGE.set(STORAGE_KEY, data);
}

function normalizeScope(value) {
    return toText(value, 'global');
}

function normalizeSettlement(entry = {}, scope = 'global') {
    const item = asObject(entry);
    const createdAt = toText(item.createdAt, new Date().toISOString());
    const updatedAt = toText(item.updatedAt, createdAt);

    return {
        id: toText(item.id, `settlement-${Date.now()}`),
        scope: normalizeScope(item.scope || scope),
        title: toText(item.title, 'Blocker settlement'),
        owner: toText(item.owner, 'program'),
        severity: toText(item.severity, 'medium'),
        state: toText(item.state || item.status, 'open'),
        resolution: toText(item.resolution || item.note, ''),
        note: toText(item.note, ''),
        createdAt,
        updatedAt,
    };
}

function listForScope(scope) {
    const data = readAll();
    return toArray(data[scope]).map((row) => ({ ...row }));
}

export function createTurneroReleaseBlockerSettlementLedger(scope = 'global') {
    const normalizedScope = normalizeScope(scope);

    const api = {
        scope: normalizedScope,
        list() {
            return listForScope(normalizedScope);
        },
        get(id) {
            const targetId = toText(id);
            if (!targetId) {
                return null;
            }

            return (
                listForScope(normalizedScope).find(
                    (row) => row.id === targetId
                ) || null
            );
        },
        add(entry = {}) {
            const data = readAll();
            const next = normalizeSettlement(entry, normalizedScope);
            const rows = listForScope(normalizedScope);
            data[normalizedScope] = [next, ...rows].slice(0, 250);
            writeAll(data);
            return { ...next };
        },
        update(id, patch = {}) {
            const targetId = toText(id);
            if (!targetId) {
                return null;
            }

            const data = readAll();
            const rows = listForScope(normalizedScope);
            let updated = null;
            const nextRows = rows.map((row) => {
                if (row.id !== targetId) {
                    return row;
                }

                updated = normalizeSettlement(
                    {
                        ...row,
                        ...asObject(patch),
                        id: row.id,
                        scope: normalizedScope,
                    },
                    normalizedScope
                );

                return updated;
            });

            if (!updated) {
                return null;
            }

            data[normalizedScope] = nextRows.slice(0, 250);
            writeAll(data);
            return { ...updated };
        },
        remove(id) {
            const targetId = toText(id);
            if (!targetId) {
                return false;
            }

            const data = readAll();
            const rows = listForScope(normalizedScope);
            const nextRows = rows.filter((row) => row.id !== targetId);

            if (nextRows.length === rows.length) {
                return false;
            }

            if (nextRows.length > 0) {
                data[normalizedScope] = nextRows;
            } else {
                delete data[normalizedScope];
            }

            writeAll(data);
            return true;
        },
        clear() {
            const data = readAll();
            delete data[normalizedScope];
            writeAll(data);
        },
    };

    return api;
}

export default createTurneroReleaseBlockerSettlementLedger;
