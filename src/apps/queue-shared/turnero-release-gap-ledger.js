import { toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-gap-ledger:v1';

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
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch (_error) {
        return {};
    }
}

function writeAll(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createTurneroReleaseGapLedger(scope = 'global') {
    const normalizedScope = normalizeScope(scope);

    return {
        scope: normalizedScope,
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
                id: toText(entry.id || `gap-${Date.now()}`),
                title: toText(entry.title || 'Gap'),
                domain: toText(entry.domain || 'general'),
                owner: toText(entry.owner || 'ops'),
                surface: toText(entry.surface || 'admin-queue'),
                severity: toText(entry.severity || 'medium'),
                status: toText(entry.status || 'open'),
                note: toText(entry.note || ''),
                createdAt: toText(entry.createdAt || new Date().toISOString()),
            };
            data[normalizedScope] = [next, ...rows].slice(0, 300);
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
