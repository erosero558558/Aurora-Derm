const listeners = new Set();

const initialState = {
    auth: {
        authenticated: false,
        csrfToken: '',
        requires2FA: false,
        lastAuthAt: 0,
        authMethod: '',
        mode: 'openclaw_chatgpt',
        status: 'anonymous',
        configured: false,
        challenge: null,
        operator: null,
        lastError: '',
    },
    ui: {
        activeSection: 'dashboard',
        sidebarCollapsed: false,
        sidebarOpen: false,
        themeMode: 'system',
        theme: 'light',
        lastRefreshAt: 0,
        queueAutoRefresh: {
            state: 'idle',
            reason: 'Abre Turnero Sala para activar el monitoreo continuo.',
            intervalMs: 45000,
            lastAttemptAt: 0,
            lastSuccessAt: 0,
            lastError: '',
            inFlight: false,
        },
    },
    data: {
        appointments: [],
        callbacks: [],
        reviews: [],
        availability: {},
        availabilityMeta: {},
        queueTickets: [],
        queueMeta: null,
        leadOpsMeta: null,
        queueSurfaceStatus: null,
        appDownloads: null,
        internalConsoleMeta: null,
        funnelMetrics: null,
        health: null,
    },
    appointments: {
        filter: 'all',
        search: '',
        sort: 'datetime_desc',
        density: 'comfortable',
        reviewContext: null,
    },
    callbacks: {
        filter: 'all',
        sort: 'priority_desc',
        search: '',
        selected: [],
    },
    availability: {
        monthAnchor: new Date(),
        selectedDate: '',
        draft: {},
        draftDirty: false,
        clipboard: [],
        clipboardDate: '',
        lastAction: '',
    },
    queue: {
        filter: 'all',
        search: '',
        helpOpen: false,
        oneTap: false,
        practiceMode: false,
        customCallKey: null,
        captureCallKeyMode: false,
        stationMode: 'free',
        stationConsultorio: 1,
        runtimeRevision: 0,
        lastRuntimeMutationAt: 0,
        selected: [],
        fallbackPartial: false,
        syncMode: 'live',
        pendingSensitiveAction: null,
        activity: [],
    },
};

let state = structuredClone(initialState);

export function getState() {
    return state;
}

export function resetState() {
    state = structuredClone(initialState);
    emit();
}

export function patchState(patch) {
    state = {
        ...state,
        ...patch,
    };
    emit();
}

export function setState(nextState) {
    state = nextState;
    emit();
}

export function updateState(producer) {
    const next = producer(state);
    if (next) {
        state = next;
        emit();
    }
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function emit() {
    listeners.forEach((listener) => {
        try {
            listener(state);
        } catch (_error) {
            // no-op
        }
    });
}
