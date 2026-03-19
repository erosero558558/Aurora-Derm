import { asObject, toArray, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-action-register:v1';

function nowIso() {
    return new Date().toISOString();
}

function createId(prefix = 'action') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

function normalizeScope(scope) {
    return toText(scope, 'regional');
}

function normalizeStatus(value) {
    const status = toText(value, 'open').toLowerCase();

    if (['done', 'closed', 'complete', 'completed'].includes(status)) {
        return 'done';
    }

    if (['blocked', 'rejected', 'cancelled', 'canceled'].includes(status)) {
        return 'blocked';
    }

    if (['working', 'in-progress', 'progress', 'doing'].includes(status)) {
        return 'working';
    }

    if (['paused', 'hold', 'pending'].includes(status)) {
        return 'paused';
    }

    return 'open';
}

function readEnvelope(storage, memory) {
    if (!storage) {
        return memory.current;
    }

    try {
        const raw = storage.getItem(STORAGE_KEY);
        if (!raw) {
            return {};
        }

        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : {};
    } catch (_error) {
        return {};
    }
}

function writeEnvelope(storage, memory, data) {
    memory.current = data;

    if (!storage) {
        return data;
    }

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (_error) {
        return data;
    }

    return data;
}

function normalizeEntry(input = {}, scope = 'regional') {
    const source = asObject(input);
    const createdAt = toText(source.createdAt || nowIso());
    const updatedAt = toText(source.updatedAt || createdAt);

    return {
        id: toText(source.id || source.actionId || createId()),
        scope: normalizeScope(source.scope || scope),
        title: toText(source.title || source.label || source.name || 'Action'),
        owner: toText(source.owner || source.assignee || 'board'),
        dueDate: toText(source.dueDate || source.dueAt || source.due || ''),
        status: normalizeStatus(source.status || source.state),
        severity: toText(source.severity || 'medium', 'medium'),
        note: toText(source.note || source.summary || source.detail || ''),
        source: toText(source.source || 'manual', 'manual'),
        createdAt,
        updatedAt,
        resolvedAt:
            source.resolvedAt === undefined || source.resolvedAt === null
                ? null
                : toText(source.resolvedAt),
        metadata: asObject(source.metadata),
    };
}

function sortByUpdatedAtDesc(left, right) {
    return String(right.updatedAt || right.createdAt || '').localeCompare(
        String(left.updatedAt || left.createdAt || '')
    );
}

function buildActionMarkdownHeader(scope, entries) {
    const openCount = entries.filter((entry) => entry.status === 'open').length;
    const workingCount = entries.filter(
        (entry) => entry.status === 'working'
    ).length;
    const doneCount = entries.filter((entry) => entry.status === 'done').length;

    return [
        '# Action Register',
        '',
        `- Scope: ${toText(scope, 'regional')}`,
        `- Open: ${openCount}`,
        `- Working: ${workingCount}`,
        `- Done: ${doneCount}`,
        '',
    ];
}

export function createTurneroReleaseActionRegister(
    scope = 'regional',
    options = {}
) {
    const storeScope = normalizeScope(scope);
    const storage =
        options.storage ||
        (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    const memory = { current: {} };

    function list() {
        const envelope = readEnvelope(storage, memory);
        const rows = Array.isArray(envelope[storeScope])
            ? envelope[storeScope]
            : [];
        return rows
            .map((entry) => normalizeEntry(entry, storeScope))
            .sort(sortByUpdatedAtDesc);
    }

    function replace(rows = []) {
        const envelope = readEnvelope(storage, memory);
        envelope[storeScope] = toArray(rows).map((entry) =>
            normalizeEntry(entry, storeScope)
        );
        writeEnvelope(storage, memory, envelope);
        return list();
    }

    function add(entry = {}) {
        const rows = list();
        const next = normalizeEntry(entry, storeScope);
        const envelope = readEnvelope(storage, memory);
        envelope[storeScope] = [
            next,
            ...rows.filter((row) => row.id !== next.id),
        ];
        writeEnvelope(storage, memory, envelope);
        return next;
    }

    function seed(rows = []) {
        const current = list();
        if (current.length > 0) {
            return current;
        }

        return replace(rows);
    }

    function clear() {
        const envelope = readEnvelope(storage, memory);
        delete envelope[storeScope];
        writeEnvelope(storage, memory, envelope);
        return true;
    }

    return {
        scope: storeScope,
        list,
        replace,
        add,
        seed,
        clear,
        count() {
            return list().length;
        },
    };
}

export function buildTurneroReleaseActionRegisterMarkdown(
    entries = [],
    options = {}
) {
    const scope = toText(options.scope || 'regional', 'regional');
    const rows = toArray(entries);

    return [
        ...buildActionMarkdownHeader(scope, rows),
        ...(rows.length
            ? rows.map((entry) => {
                  const status = toText(entry.status || 'open');
                  const severity = toText(entry.severity || 'medium');
                  const note = toText(entry.note || '');
                  return [
                      `- ${toText(entry.title || 'Action')} [${status}]`,
                      `  - Owner: ${toText(entry.owner || 'board')}`,
                      `  - Due: ${toText(entry.dueDate || 'n/a')}`,
                      `  - Severity: ${severity}`,
                      note ? `  - Note: ${note}` : '  - Note: sin note.',
                  ].join('\n');
              })
            : ['- Sin acciones persistidas.']),
        '',
        `Generated at: ${toText(options.generatedAt || new Date().toISOString())}`,
    ].join('\n');
}

export { normalizeEntry as normalizeTurneroReleaseActionRegisterEntry };

export default createTurneroReleaseActionRegister;
