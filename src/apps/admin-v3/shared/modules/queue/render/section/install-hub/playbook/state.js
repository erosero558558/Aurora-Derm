const VALID_MODES = new Set(['opening', 'operations', 'incidents', 'closing']);
let opsPlaybookState = null;

export function createOpsPlaybookState(date) {
    return {
        date,
        modes: {
            opening: {},
            operations: {},
            incidents: {},
            closing: {},
        },
    };
}

export function normalizeOpsPlaybookState(rawState, deps) {
    const { getTodayLocalIsoDate } = deps;
    const today = getTodayLocalIsoDate();
    const source = rawState && typeof rawState === 'object' ? rawState : {};
    const safeModes =
        source.modes && typeof source.modes === 'object' ? source.modes : {};
    return {
        date: String(source.date || '').trim() === today ? today : today,
        modes: {
            opening:
                safeModes.opening && typeof safeModes.opening === 'object'
                    ? { ...safeModes.opening }
                    : {},
            operations:
                safeModes.operations && typeof safeModes.operations === 'object'
                    ? { ...safeModes.operations }
                    : {},
            incidents:
                safeModes.incidents && typeof safeModes.incidents === 'object'
                    ? { ...safeModes.incidents }
                    : {},
            closing:
                safeModes.closing && typeof safeModes.closing === 'object'
                    ? { ...safeModes.closing }
                    : {},
        },
    };
}

export function loadOpsPlaybookState(deps) {
    const { getTodayLocalIsoDate, storageKey } = deps;
    const today = getTodayLocalIsoDate();
    try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) {
            return createOpsPlaybookState(today);
        }
        const parsed = JSON.parse(raw);
        if (String(parsed?.date || '') !== today) {
            return createOpsPlaybookState(today);
        }
        return normalizeOpsPlaybookState(parsed, deps);
    } catch (_error) {
        return createOpsPlaybookState(today);
    }
}

export function persistOpsPlaybookState(nextState, deps) {
    const { storageKey } = deps;
    opsPlaybookState = normalizeOpsPlaybookState(nextState, deps);
    try {
        localStorage.setItem(storageKey, JSON.stringify(opsPlaybookState));
    } catch (_error) {
        // ignore storage write failures
    }
    return opsPlaybookState;
}

export function ensureOpsPlaybookState(deps) {
    const { getTodayLocalIsoDate } = deps;
    const today = getTodayLocalIsoDate();
    if (!opsPlaybookState || opsPlaybookState.date !== today) {
        opsPlaybookState = loadOpsPlaybookState(deps);
    }
    return opsPlaybookState;
}

export function setOpsPlaybookStep(mode, stepId, complete, deps) {
    const current = ensureOpsPlaybookState(deps);
    const safeMode = VALID_MODES.has(mode) ? mode : 'operations';
    return persistOpsPlaybookState(
        {
            ...current,
            modes: {
                ...current.modes,
                [safeMode]: {
                    ...(current.modes[safeMode] || {}),
                    [stepId]: Boolean(complete),
                },
            },
        },
        deps
    );
}

export function resetOpsPlaybookMode(mode, deps) {
    const current = ensureOpsPlaybookState(deps);
    const safeMode = VALID_MODES.has(mode) ? mode : 'operations';
    return persistOpsPlaybookState(
        {
            ...current,
            modes: {
                ...current.modes,
                [safeMode]: {},
            },
        },
        deps
    );
}
