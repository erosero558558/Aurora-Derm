import { asObject, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-terminal-adjudication-session:v1';
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

function normalizeSession(entry = {}, scope = 'global') {
    const item = asObject(entry);
    const createdAt = toText(item.createdAt, new Date().toISOString());
    const updatedAt = toText(item.updatedAt, createdAt);

    return {
        id: toText(item.id, `terminal-session-${Date.now()}`),
        scope: normalizeScope(item.scope || scope),
        status: toText(item.status, 'unprepared'),
        moderator: toText(item.moderator, 'program'),
        note: toText(item.note, ''),
        decision: toText(item.decision, ''),
        createdAt,
        updatedAt,
    };
}

export function createTurneroReleaseTerminalAdjudicationSession(
    scope = 'global'
) {
    const normalizedScope = normalizeScope(scope);

    const api = {
        scope: normalizedScope,
        get() {
            const data = readAll();
            const session = asObject(data[normalizedScope]);
            return Object.keys(session).length > 0 ? { ...session } : null;
        },
        set(entry = {}) {
            const data = readAll();
            const next = normalizeSession(
                { ...asObject(entry), scope: normalizedScope },
                normalizedScope
            );
            data[normalizedScope] = next;
            writeAll(data);
            return { ...next };
        },
        update(patch = {}) {
            const current =
                api.get() ||
                normalizeSession({
                    scope: normalizedScope,
                    status: 'unprepared',
                });
            return api.set({ ...current, ...asObject(patch) });
        },
        clear() {
            const data = readAll();
            delete data[normalizedScope];
            writeAll(data);
        },
    };

    return api;
}

export default createTurneroReleaseTerminalAdjudicationSession;
