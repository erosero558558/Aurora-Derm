import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileRuntimeMeta,
    getTurneroClinicReadiness,
    getTurneroClinicReleaseMode,
    getTurneroClinicShortName,
    getTurneroSurfaceContract,
} from './turnero-runtime-contract.mjs';
import {
    asObject,
    normalizePathToken,
    toArray,
    toString,
} from './turnero-surface-helpers.js';

const SURFACE_KEY_ALIASES = Object.freeze({
    admin: 'admin',
    queue: 'admin',
    'admin-queue': 'admin',
    'queue-admin': 'admin',
    operator: 'operator',
    operador: 'operator',
    'operador-turnos': 'operator',
    'operator-turnos': 'operator',
    kiosk: 'kiosk',
    kiosco: 'kiosk',
    kiosko: 'kiosk',
    'kiosco-turnos': 'kiosk',
    'kiosko-turnos': 'kiosk',
    'kiosk-turnos': 'kiosk',
    display: 'display',
    sala: 'display',
    'sala-turnos': 'display',
    sala_tv: 'display',
    'sala-tv': 'display',
});

const RUNTIME_STATE_ALIASES = Object.freeze({
    ready: 'ready',
    live: 'ready',
    ok: 'ready',
    watch: 'watch',
    warning: 'watch',
    pending: 'watch',
    degraded: 'degraded',
    fallback: 'degraded',
    safe: 'watch',
    offline: 'degraded',
    blocked: 'blocked',
    alert: 'blocked',
    danger: 'blocked',
});

const HEARTBEAT_STATE_ALIASES = Object.freeze({
    ready: 'ready',
    live: 'ready',
    ok: 'ready',
    watch: 'watch',
    warning: 'watch',
    pending: 'watch',
    degraded: 'degraded',
    offline: 'degraded',
    alert: 'degraded',
    danger: 'degraded',
    blocked: 'blocked',
    critical: 'blocked',
});

function normalizeStateAlias(value, aliases, fallback = 'unknown') {
    const normalized = toString(value).toLowerCase();
    if (!normalized) {
        return fallback;
    }

    return aliases[normalized] || normalized || fallback;
}

function normalizeSurfaceToken(value) {
    const explicit = toString(value)
        .toLowerCase()
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
    const pathToken = normalizePathToken(value);
    return (
        SURFACE_KEY_ALIASES[explicit] ||
        SURFACE_KEY_ALIASES[pathToken] ||
        explicit ||
        pathToken ||
        'operator'
    );
}

function normalizeCurrentRoute(value) {
    const raw = toString(value);
    if (raw) {
        return raw;
    }

    if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string'
    ) {
        return `${window.location.pathname || ''}${window.location.hash || ''}`;
    }

    return '';
}

function normalizeSurfaceActions(actions, surfaceKey) {
    return toArray(actions)
        .map((action) => {
            const source = asObject(action);
            const normalizedSurfaceKey = normalizeSurfaceToken(
                source.surfaceKey || source.surface || surfaceKey
            );
            const createdAt = toString(
                source.createdAt || source.created_at || source.updatedAt
            );
            const updatedAt = toString(
                source.updatedAt || source.updated_at || createdAt
            );
            const state = normalizeStateAlias(
                source.state || source.status || 'open',
                {
                    open: 'open',
                    tracking: 'tracking',
                    watch: 'watch',
                    resolved: 'resolved',
                    closed: 'closed',
                    dismissed: 'dismissed',
                },
                'open'
            );
            const severity = normalizeStateAlias(
                source.severity || source.tone || 'low',
                {
                    low: 'low',
                    medium: 'medium',
                    high: 'high',
                },
                'low'
            );

            return {
                id: toString(
                    source.id || `${normalizedSurfaceKey}-${createdAt}`
                ),
                surfaceKey: normalizedSurfaceKey,
                title: toString(
                    source.title || source.label || 'Recovery action'
                ),
                detail: toString(source.detail || source.note || ''),
                state,
                severity,
                source: toString(source.source || 'manual'),
                owner: toString(source.owner || source.assignee || ''),
                reason: toString(source.reason || ''),
                createdAt: createdAt || new Date().toISOString(),
                updatedAt: updatedAt || createdAt || new Date().toISOString(),
                closedAt: toString(source.closedAt || source.closed_at || ''),
                resolvedAt: toString(
                    source.resolvedAt || source.resolved_at || ''
                ),
                meta:
                    source.meta && typeof source.meta === 'object'
                        ? { ...source.meta }
                        : {},
            };
        })
        .filter((action) => Boolean(action.id));
}

function isClosedAction(action) {
    const state = toString(action?.state).toLowerCase();
    return ['closed', 'resolved', 'dismissed'].includes(state);
}

function resolveRuntimeState(source = {}) {
    const explicitState = normalizeStateAlias(
        source.state || source.status || source.mode || source.connectionState,
        RUNTIME_STATE_ALIASES,
        ''
    );
    if (explicitState && explicitState !== 'unknown') {
        return explicitState;
    }

    if (source.online === false || source.connectivity === 'offline') {
        return 'degraded';
    }
    if (source.mode === 'offline' || source.mode === 'safe') {
        return 'watch';
    }
    if (
        Number(source.reconciliationSize || 0) > 0 ||
        Number(source.pendingCount || 0) > 0 ||
        Number(source.offlinePending || source.offlineOutboxSize || 0) > 0 ||
        Number(source.outboxSize || 0) > 0
    ) {
        return 'watch';
    }
    if (source.printerReady === false || source.bellPrimed === false) {
        return 'watch';
    }

    return 'ready';
}

function resolveHeartbeatState(source = {}) {
    const explicitState = normalizeStateAlias(
        source.state || source.status || source.effectiveStatus,
        HEARTBEAT_STATE_ALIASES,
        ''
    );
    if (explicitState && explicitState !== 'unknown') {
        return explicitState;
    }

    if (source.networkOnline === false || source.online === false) {
        return 'degraded';
    }

    return 'ready';
}

function resolveStorageState(source = {}, openActionCount = 0) {
    if (source.available === false) {
        return 'degraded';
    }

    const explicitState = normalizeStateAlias(
        source.state || source.status,
        {
            ready: 'ready',
            watch: 'watch',
            degraded: 'degraded',
            blocked: 'blocked',
            alert: 'blocked',
        },
        ''
    );
    if (explicitState && explicitState !== 'unknown') {
        return explicitState;
    }

    return openActionCount > 0 ? 'watch' : 'ready';
}

function buildProfileSnapshot(profile, surfaceKey, contract, readiness) {
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(profile);

    return {
        clinicId: toString(profile?.clinic_id || 'default-clinic'),
        clinicName: getTurneroClinicBrandName(profile),
        clinicShortName: getTurneroClinicShortName(profile),
        source: runtimeMeta.source,
        fingerprint: runtimeMeta.profileFingerprint,
        releaseMode: getTurneroClinicReleaseMode(profile),
        surfaceKey,
        surfaceLabel: toString(contract?.label || ''),
        expectedRoute: toString(contract?.expectedRoute || ''),
        currentRoute: toString(contract?.currentRoute || ''),
        routeMatches: Boolean(contract?.routeMatches),
        contractState: toString(contract?.state || 'ready'),
        contractReason: toString(contract?.reason || 'ready'),
        contractDetail: toString(contract?.detail || ''),
        readinessState: toString(readiness?.state || 'ready'),
        readinessSummary: toString(readiness?.summary || ''),
        readinessBlockers: toArray(readiness?.blockers),
        readinessWarnings: toArray(readiness?.warnings),
    };
}

function buildRuntimeSnapshot(input = {}, contract, readiness) {
    const source = asObject(input);
    const state = resolveRuntimeState(source);
    const summary = toString(
        source.summary,
        state === 'ready'
            ? 'Runtime listo.'
            : state === 'watch'
              ? 'Runtime en observacion.'
              : state === 'degraded'
                ? 'Runtime degradado.'
                : 'Runtime bloqueado.'
    );

    return {
        state,
        summary,
        online:
            typeof source.online === 'boolean'
                ? source.online
                : source.connectivity !== 'offline',
        connectivity: toString(
            source.connectivity,
            source.online === false ? 'offline' : 'online'
        ),
        mode: toString(source.mode, 'live'),
        reason: toString(source.reason, ''),
        authenticated:
            typeof source.authenticated === 'boolean'
                ? source.authenticated
                : undefined,
        pendingCount: Number(source.pendingCount || 0) || 0,
        outboxSize: Number(source.outboxSize || 0) || 0,
        reconciliationSize: Number(source.reconciliationSize || 0) || 0,
        printerReady:
            typeof source.printerReady === 'boolean'
                ? source.printerReady
                : undefined,
        bellPrimed:
            typeof source.bellPrimed === 'boolean'
                ? source.bellPrimed
                : undefined,
        updateChannel: toString(source.updateChannel, 'stable'),
        details: {
            ...source,
        },
        contractState: toString(contract?.state || ''),
        readinessState: toString(readiness?.state || ''),
    };
}

function buildHeartbeatSnapshot(input = {}) {
    const source = asObject(input);
    const state = resolveHeartbeatState(source);
    const lastEventAt = toString(
        source.lastEventAt || source.lastBeatAt || source.at || ''
    );
    const summary = toString(
        source.summary,
        state === 'ready'
            ? 'Heartbeat alineado.'
            : state === 'watch'
              ? 'Heartbeat bajo observacion.'
              : state === 'degraded'
                ? 'Heartbeat degradado.'
                : 'Heartbeat bloqueado.'
    );

    return {
        state,
        summary,
        channel: toString(source.channel, 'unknown'),
        lastBeatAt: toString(source.lastBeatAt || lastEventAt || ''),
        lastEvent: toString(source.lastEvent || source.event || ''),
        lastEventAt,
        online:
            typeof source.networkOnline === 'boolean'
                ? source.networkOnline
                : typeof source.online === 'boolean'
                  ? source.online
                  : state !== 'degraded',
        details:
            source.details && typeof source.details === 'object'
                ? { ...source.details }
                : {},
    };
}

function buildStorageSnapshot(input = {}, actions = []) {
    const source = asObject(input);
    const openActionCount = actions.filter(
        (action) => !isClosedAction(action)
    ).length;
    const closedActionCount = Math.max(actions.length - openActionCount, 0);
    const state = resolveStorageState(source, openActionCount);
    const summary = toString(
        source.summary,
        source.available === false
            ? 'Storage local no disponible.'
            : openActionCount > 0
              ? `${openActionCount} accion(es) abiertas.`
              : 'Sin acciones persistidas.'
    );

    return {
        key: toString(source.key, 'turneroSurfaceRecoveryActionsV1'),
        available: source.available !== false,
        state,
        summary,
        openActionCount,
        closedActionCount,
        actionCount: Number(source.actionCount || actions.length || 0) || 0,
        surfaceCount: Number(source.surfaceCount || 0) || 0,
        surfacesTracked: Number(source.surfacesTracked || 0) || 0,
        updatedAt: toString(source.updatedAt || source.persistedAt || ''),
        persistedAt: toString(source.persistedAt || source.updatedAt || ''),
        source: toString(source.source || 'recovery-action-store'),
        details: {
            ...source,
        },
    };
}

export function buildTurneroSurfaceContractSnapshot(input = {}) {
    const profile = asObject(input.clinicProfile || input.profile);
    const surfaceKey = normalizeSurfaceToken(
        input.surfaceKey || input.surface || 'operator'
    );
    const surfaceToken = toString(
        input.surfaceToken || input.surface || input.surfaceKey,
        surfaceKey
    );
    const currentRoute = normalizeCurrentRoute(
        input.currentRoute || input.route
    );
    const contract = getTurneroSurfaceContract(profile, surfaceKey, {
        currentRoute,
    });
    const readiness = getTurneroClinicReadiness(profile, {
        currentRoutes: {
            [surfaceKey]: currentRoute,
        },
    });
    const actions = normalizeSurfaceActions(input.actions, surfaceKey);
    const storage = buildStorageSnapshot(input.storageInfo, actions);
    const runtime = buildRuntimeSnapshot(
        input.runtimeState,
        contract,
        readiness
    );
    const heartbeat = buildHeartbeatSnapshot(input.heartbeat);
    const profileSnapshot = buildProfileSnapshot(
        profile,
        surfaceKey,
        contract,
        readiness
    );

    return {
        surfaceKey,
        surfaceToken,
        surfaceLabel: profileSnapshot.surfaceLabel || contract.label,
        profile: profileSnapshot,
        contract: {
            state: toString(contract.state || 'ready'),
            reason: toString(contract.reason || 'ready'),
            detail: toString(contract.detail || ''),
            expectedRoute: toString(contract.expectedRoute || ''),
            currentRoute: toString(contract.currentRoute || currentRoute),
            routeMatches:
                typeof contract.routeMatches === 'boolean'
                    ? contract.routeMatches
                    : true,
            enabled:
                typeof contract.enabled === 'boolean' ? contract.enabled : true,
            label: toString(contract.label || profileSnapshot.surfaceLabel),
        },
        readiness: {
            state: toString(readiness.state || 'ready'),
            summary: toString(readiness.summary || ''),
            blockers: toArray(readiness.blockers),
            warnings: toArray(readiness.warnings),
            readySurfaceCount: Number(readiness.readySurfaceCount || 0) || 0,
            enabledSurfaceCount:
                Number(readiness.enabledSurfaceCount || 0) || 0,
            blockedSurfaceCount:
                Number(readiness.blockedSurfaceCount || 0) || 0,
        },
        storage,
        runtime,
        heartbeat,
        actions,
        actionCount: actions.length,
        openActionCount: actions.filter((action) => !isClosedAction(action))
            .length,
        closedActionCount: actions.filter((action) => isClosedAction(action))
            .length,
        generatedAt: new Date().toISOString(),
    };
}

export const buildTurneroSurfaceRecoverySnapshot =
    buildTurneroSurfaceContractSnapshot;

export { normalizeSurfaceToken as normalizeTurneroSurfaceRecoveryKey };
export { resolveRuntimeState as normalizeTurneroSurfaceRecoveryRuntimeState };
export { resolveHeartbeatState as normalizeTurneroSurfaceRecoveryHeartbeatState };
export { resolveStorageState as normalizeTurneroSurfaceRecoveryStorageState };
