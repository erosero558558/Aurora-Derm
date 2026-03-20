import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-branch-delta-ledger:v1';
const MEMORY_LEDGER = Object.create(null);
let memoryFallbackActive = false;

function cloneLedgerData(data) {
    const normalized = {};
    const source = data && typeof data === 'object' ? data : {};

    for (const [key, value] of Object.entries(source)) {
        if (Array.isArray(value)) {
            normalized[key] = value.map((entry) => {
                if (!entry || typeof entry !== 'object') {
                    return entry;
                }

                return { ...entry };
            });
            continue;
        }

        if (value && typeof value === 'object') {
            normalized[key] = { ...value };
            continue;
        }

        normalized[key] = value;
    }

    return normalized;
}

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

function normalizeScope(scope = 'global') {
    if (scope && typeof scope === 'object') {
        return toText(
            scope.clinicId || scope.clinic_id || scope.region || scope.scope,
            'global'
        );
    }

    return toText(scope, 'global');
}

function readAll() {
    if (!memoryFallbackActive) {
        const storage = safeStorage();
        if (storage) {
            try {
                return JSON.parse(storage.getItem(STORAGE_KEY) || '{}');
            } catch (_error) {
                memoryFallbackActive = true;
            }
        } else {
            memoryFallbackActive = true;
        }
    }

    return MEMORY_LEDGER;
}

function writeAll(data) {
    const normalized = cloneLedgerData(data);
    if (!memoryFallbackActive) {
        const storage = safeStorage();
        if (storage) {
            try {
                storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
                return;
            } catch (_error) {
                memoryFallbackActive = true;
            }
        } else {
            memoryFallbackActive = true;
        }
    }

    for (const key of Object.keys(MEMORY_LEDGER)) {
        delete MEMORY_LEDGER[key];
    }

    Object.assign(MEMORY_LEDGER, normalized);
}

function normalizeDeltaRow(entry = {}, fallbackIndex = 0) {
    const item = entry && typeof entry === 'object' ? entry : {};
    const createdAt =
        toText(item.createdAt || item.at || '', '') || new Date().toISOString();
    const status = toText(
        item.status ||
            item.state ||
            (item.closed === true ? 'closed' : '') ||
            'open',
        'open'
    ).toLowerCase();

    return {
        id:
            toText(item.id || item.key || '', '') ||
            `delta-${Date.now()}-${fallbackIndex + 1}`,
        title: toText(item.title || item.label || 'Branch delta'),
        owner: toText(item.owner || 'program'),
        area: toText(item.area || item.domain || 'general'),
        severity: toText(item.severity || 'medium').toLowerCase(),
        status,
        note: toText(item.note || ''),
        createdAt,
        updatedAt: toText(item.updatedAt || createdAt, createdAt),
    };
}

export function createTurneroReleaseBranchDeltaLedger(scope = 'global') {
    const normalizedScope = normalizeScope(scope);

    return {
        scope: normalizedScope,
        list() {
            const data = readAll();
            const rows = Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : [];

            return rows.map((entry, index) => normalizeDeltaRow(entry, index));
        },
        add(entry = {}) {
            const data = readAll();
            const rows = Array.isArray(data[normalizedScope])
                ? data[normalizedScope]
                : [];
            const next = normalizeDeltaRow(
                {
                    id: entry.id || `delta-${Date.now()}`,
                    title: entry.title || 'Branch delta',
                    owner: entry.owner || 'program',
                    area: entry.area || 'general',
                    severity: entry.severity || 'medium',
                    status: entry.status || 'open',
                    note: entry.note || '',
                    createdAt: entry.createdAt || new Date().toISOString(),
                    updatedAt:
                        entry.updatedAt ||
                        entry.createdAt ||
                        new Date().toISOString(),
                },
                rows.length
            );

            data[normalizedScope] = [next, ...rows].slice(0, 250);
            writeAll(data);
            return next;
        },
        clear() {
            const data = readAll();
            if (Object.prototype.hasOwnProperty.call(data, normalizedScope)) {
                delete data[normalizedScope];
                writeAll(data);
            }
        },
    };
}
