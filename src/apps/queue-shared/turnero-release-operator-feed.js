const STORAGE_KEY = 'turnero-release-operator-feed:v1';
const DEFAULT_SCOPE = 'global';
const FALLBACK_REGISTRY = new Map();

function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function safeJsonParse(value, fallback = {}) {
    if (!value) {
        return fallback;
    }

    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : fallback;
    } catch (_error) {
        return fallback;
    }
}

function safeJsonStringify(value) {
    const seen = new WeakSet();
    try {
        return JSON.stringify(
            value,
            (_key, entry) => {
                if (typeof entry === 'function') {
                    return undefined;
                }

                if (entry && typeof entry === 'object') {
                    if (seen.has(entry)) {
                        return '[Circular]';
                    }
                    seen.add(entry);
                }

                return entry;
            },
            2
        );
    } catch (_error) {
        return JSON.stringify({ error: 'json_stringify_failed' }, null, 2);
    }
}

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function normalizeScope(scope) {
    return toText(scope, DEFAULT_SCOPE);
}

function cloneRows(rows) {
    return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function readRegistry() {
    const storage = getStorage();
    if (storage) {
        try {
            return safeJsonParse(storage.getItem(STORAGE_KEY) || '', {});
        } catch (_error) {
            return safeJsonParse(
                safeJsonStringify(FALLBACK_REGISTRY.get(STORAGE_KEY) || {}),
                {}
            );
        }
    }

    return safeJsonParse(
        safeJsonStringify(FALLBACK_REGISTRY.get(STORAGE_KEY) || {}),
        {}
    );
}

function writeRegistry(data) {
    const payload = safeJsonStringify(data);
    const storage = getStorage();

    if (storage) {
        try {
            storage.setItem(STORAGE_KEY, payload);
        } catch (_error) {
            // Fall back to in-memory persistence.
        }
    }

    FALLBACK_REGISTRY.set(STORAGE_KEY, safeJsonParse(payload, {}));
}

function getScopedRows(scope) {
    const data = readRegistry();
    const normalizedScope = normalizeScope(scope);
    return cloneRows(
        Array.isArray(data[normalizedScope]) ? data[normalizedScope] : []
    );
}

function setScopedRows(scope, rows) {
    const data = readRegistry();
    data[normalizeScope(scope)] = cloneRows(rows);
    writeRegistry(data);
}

function deleteScopedRows(scope) {
    const data = readRegistry();
    const normalizedScope = normalizeScope(scope);
    if (Object.prototype.hasOwnProperty.call(data, normalizedScope)) {
        delete data[normalizedScope];
        writeRegistry(data);
    }
}

function normalizeFeedState(value, lane) {
    const state = toText(value, '').toLowerCase();
    if (
        [
            'closed',
            'done',
            'resolved',
            'complete',
            'completed',
            'ready',
        ].includes(state)
    ) {
        return 'closed';
    }
    if (state) {
        return state;
    }
    return ['immediate', 'priority'].includes(lane) ? 'open' : 'open';
}

function normalizeFeedSeverity(value, lane) {
    const severity = toText(value, '').toLowerCase();
    if (['critical', 'high', 'medium', 'low'].includes(severity)) {
        return severity;
    }
    if (lane === 'immediate') {
        return 'critical';
    }
    if (lane === 'priority') {
        return 'high';
    }
    if (lane === 'scheduled') {
        return 'medium';
    }
    return 'low';
}

function normalizeFeedEntry(entry = {}) {
    const lane = toText(entry.lane || entry.route || 'scheduled', 'scheduled');
    const state = normalizeFeedState(entry.state || entry.status, lane);
    return {
        id: toText(entry.id, `feed-${Date.now()}`),
        title: toText(
            entry.title || entry.label || entry.name,
            'Operator event'
        ),
        owner: toText(entry.owner, 'ops'),
        lane,
        note: toText(entry.note || entry.summary || entry.detail, ''),
        kind: toText(entry.kind || entry.type || 'signal', 'signal'),
        severity: normalizeFeedSeverity(entry.severity, lane),
        state,
        createdAt: toText(entry.createdAt, new Date().toISOString()),
    };
}

export function createTurneroReleaseOperatorFeed(scope = DEFAULT_SCOPE) {
    const normalizedScope = normalizeScope(scope);

    return {
        list() {
            return getScopedRows(normalizedScope);
        },
        add(entry = {}) {
            const rows = getScopedRows(normalizedScope);
            const next = normalizeFeedEntry(entry);
            setScopedRows(normalizedScope, [next, ...rows].slice(0, 300));
            return { ...next };
        },
        clear() {
            deleteScopedRows(normalizedScope);
        },
    };
}
