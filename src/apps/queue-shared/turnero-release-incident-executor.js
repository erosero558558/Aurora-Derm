const STORAGE_PREFIX = 'turnero.release.incident.executor';
const VALID_STEP_STATES = new Set(['todo', 'doing', 'blocked', 'done']);

function buildStorageKey(clinicId = 'unknown-clinic') {
    return `${STORAGE_PREFIX}.${clinicId}`;
}

function safeNow() {
    return new Date().toISOString();
}

function safeParse(value, fallback) {
    if (value == null || value === '') {
        return fallback;
    }

    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

export function createIncidentExecutorStore({
    clinicId,
    storage = globalThis?.localStorage,
} = {}) {
    const key = buildStorageKey(clinicId);

    function read() {
        if (!storage) return { incidents: {}, updatedAt: null };
        return safeParse(storage.getItem(key), {
            incidents: {},
            updatedAt: null,
        });
    }

    function write(value) {
        if (!storage) return value;
        storage.setItem(key, JSON.stringify(value, null, 2));
        return value;
    }

    function ensureIncident(state, incidentId) {
        const entry = state.incidents[incidentId] || {
            steps: {},
            notes: [],
            updatedAt: null,
        };
        state.incidents[incidentId] = entry;
        return entry;
    }

    return {
        key,
        read,
        write,
        setStepState({ incidentId, lane, index, nextState, note }) {
            if (!VALID_STEP_STATES.has(nextState))
                throw new Error(`Invalid step state: ${nextState}`);
            const snapshot = read();
            const incident = ensureIncident(snapshot, incidentId);
            const stepKey = `${lane}:${index}`;
            incident.steps[stepKey] = {
                state: nextState,
                updatedAt: safeNow(),
                note: typeof note === 'string' ? note.trim() : '',
            };
            incident.updatedAt = safeNow();
            snapshot.updatedAt = safeNow();
            return write(snapshot);
        },
        appendNote({ incidentId, note, author = 'operator' }) {
            const trimmed = typeof note === 'string' ? note.trim() : '';
            if (!trimmed) return read();
            const snapshot = read();
            const incident = ensureIncident(snapshot, incidentId);
            incident.notes.push({
                author,
                note: trimmed,
                createdAt: safeNow(),
            });
            incident.updatedAt = safeNow();
            snapshot.updatedAt = safeNow();
            return write(snapshot);
        },
        resetIncident(incidentId) {
            const snapshot = read();
            delete snapshot.incidents[incidentId];
            snapshot.updatedAt = safeNow();
            return write(snapshot);
        },
        exportPack({ playbooks = [], context = {} } = {}) {
            const snapshot = read();
            return {
                clinicId,
                context,
                executorState: snapshot,
                playbooks,
                exportedAt: safeNow(),
            };
        },
    };
}

export function summarizeIncidentExecution(playbook, incidentState = {}) {
    const stepEntries = Object.entries(incidentState.steps || {});
    const counters = { todo: 0, doing: 0, blocked: 0, done: 0 };

    for (const [, value] of stepEntries) {
        const state = value?.state || 'todo';
        if (Object.prototype.hasOwnProperty.call(counters, state))
            counters[state] += 1;
    }

    return {
        id: playbook.id,
        title: playbook.title,
        owner: playbook.owner,
        severity: playbook.severity,
        counters,
        notes: incidentState.notes || [],
        updatedAt: incidentState.updatedAt || null,
    };
}

export function buildExecutionSummary({
    playbooks = [],
    executorState = {},
} = {}) {
    return playbooks.map((playbook) =>
        summarizeIncidentExecution(
            playbook,
            executorState.incidents?.[playbook.id] || {}
        )
    );
}
