const listeners = new Set();

const initialState = {
    auth: {
        authenticated: false,
        csrfToken: '',
        requires2FA: false,
        lastAuthAt: 0,
        authMethod: '',
        mode: 'legacy_password',
        recommendedMode: 'legacy_password',
        loginSurfaceMode: 'legacy_password',
        status: 'anonymous',
        configured: false,
        challenge: null,
        helperUrlOpened: false,
        operator: null,
        fallbacks: {
            legacy_password: {
                enabled: false,
                configured: false,
                requires2FA: true,
                available: false,
                reason: 'fallback_disabled',
            },
        },
        openClawSnapshot: {
            status: 'anonymous',
            challenge: null,
            lastError: '',
        },
        capabilities: {
            adminAgent: false,
        },
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
        patientFlowMeta: null,
        queueSurfaceStatus: null,
        appDownloads: null,
        turneroClinicProfile: null,
        turneroClinicProfileMeta: null,
        turneroClinicProfileCatalogStatus: null,
        turneroOperatorAccessMeta: null,
        turneroV2Readiness: null,
        clinicalHistoryMeta: null,
        mediaFlowMeta: null,
        telemedicineMeta: null,
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
    clinicalHistory: {
        selectedSessionId: '',
        activeWorkspace: 'review',
        queueFilter: 'all',
        loading: false,
        saving: false,
        error: '',
        dirty: false,
        lastLoadedAt: 0,
        current: null,
        draftForm: null,
        followUpQuestion: '',
    },
    caseMediaFlow: {
        selectedCaseId: '',
        loading: false,
        generating: false,
        saving: false,
        linkedCaseMissing: false,
        error: '',
        current: null,
        lastLoadedAt: 0,
    },
    agent: {
        open: false,
        bootstrapped: false,
        starting: false,
        submitting: false,
        syncing: false,
        syncState: 'idle',
        lastSyncAt: 0,
        session: null,
        context: null,
        messages: [],
        turns: [],
        toolCalls: [],
        approvals: [],
        events: [],
        outbox: [],
        health: null,
        tools: [],
        lastError: '',
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
