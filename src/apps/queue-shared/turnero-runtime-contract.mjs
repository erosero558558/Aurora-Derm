import { asObject, toString } from './turnero-surface-helpers.js';
import {
    getTurneroClinicAdminModeDefault,
    getTurneroClinicBrandName,
    getTurneroClinicOpeningPackage,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicProfileRuntimeMeta,
    getTurneroClinicReadiness,
    getTurneroClinicReleaseMode,
    getTurneroClinicShortName,
    getTurneroConsultorioLabel,
    getTurneroPilotBlockers,
    getTurneroPilotOpeningPackage,
    getTurneroPilotSurfaceKeys,
    getTurneroPilotSurfaceReadiness,
    getTurneroReleaseMode,
    getTurneroSurfaceContract,
    getTurneroSurfaceReadinessSnapshot,
    loadTurneroClinicProfile,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

const DEFAULT_LAUNCH_MODE = 'fullscreen';
const DEFAULT_STATION_MODE = 'free';
const DEFAULT_STATION_CONSULTORIO = 1;
const DEFAULT_UPDATE_CHANNEL = 'stable';

const SURFACE_ROUTE_FALLBACKS = Object.freeze({
    admin: '/admin.html#queue',
    operator: '/operador-turnos.html',
    kiosk: '/kiosco-turnos.html',
    display: '/sala-turnos.html',
});

const SURFACE_ALIASES = Object.freeze({
    sala_tv: 'display',
});

function normalizeSurfaceKey(surface) {
    const requested = String(surface || '')
        .trim()
        .toLowerCase();
    return SURFACE_ALIASES[requested] || requested || 'operator';
}

function normalizeSurfaceRouteForMatch(value) {
    const normalized = toString(value);
    if (!normalized) {
        return '';
    }

    try {
        const parsed = new URL(normalized, 'https://turnero.local');
        return `${parsed.pathname}${parsed.hash || ''}` || '/';
    } catch (_error) {
        return normalized;
    }
}

function resolveCurrentRoute(options = {}) {
    if (toString(options.currentRoute)) {
        return normalizeSurfaceRouteForMatch(options.currentRoute);
    }

    if (
        typeof window !== 'undefined' &&
        window.location &&
        typeof window.location.pathname === 'string'
    ) {
        return normalizeSurfaceRouteForMatch(
            `${window.location.pathname || ''}${window.location.hash || ''}`
        );
    }

    return '';
}

function resolveCurrentRoutesForSurface(surfaceKey, options = {}) {
    const currentRoutes =
        options.currentRoutes && typeof options.currentRoutes === 'object'
            ? options.currentRoutes
            : {};
    const routeBySurface = { ...currentRoutes };
    const currentRoute = resolveCurrentRoute(options);

    if (currentRoute) {
        routeBySurface[surfaceKey] = currentRoute;
    }

    return routeBySurface;
}

function normalizeClinicId(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function matchesClinic(entryClinicId, activeClinicId) {
    const normalizedActiveClinicId = normalizeClinicId(activeClinicId);
    if (!normalizedActiveClinicId) {
        return false;
    }

    return normalizeClinicId(entryClinicId) === normalizedActiveClinicId;
}

function looksLikeClinicProfile(value) {
    const source = asObject(value);
    return Boolean(
        Object.prototype.hasOwnProperty.call(source, 'clinic_id') ||
            Object.prototype.hasOwnProperty.call(source, 'branding') ||
            Object.prototype.hasOwnProperty.call(source, 'consultorios') ||
            Object.prototype.hasOwnProperty.call(source, 'surfaces') ||
            Object.prototype.hasOwnProperty.call(source, 'release') ||
            Object.prototype.hasOwnProperty.call(source, 'runtime_meta')
    );
}

function resolveClinicProfileCandidate(source = {}) {
    const state = asObject(source);
    const data = asObject(state.data);

    if (
        Object.prototype.hasOwnProperty.call(data, 'turneroClinicProfile') &&
        data.turneroClinicProfile &&
        typeof data.turneroClinicProfile === 'object'
    ) {
        return data.turneroClinicProfile;
    }

    if (looksLikeClinicProfile(state)) {
        return state;
    }

    return null;
}

function isFallbackClinicProfile(profile) {
    return normalizeClinicId(profile?.clinic_id) === 'default-clinic';
}

function getExplicitRuntimeMeta(source = {}) {
    const state = asObject(source);
    const data = asObject(state.data);
    const dataMeta =
        data.turneroClinicProfileMeta &&
        typeof data.turneroClinicProfileMeta === 'object'
            ? data.turneroClinicProfileMeta
            : {};
    const candidate = resolveClinicProfileCandidate(source);
    const runtimeMeta =
        candidate?.runtime_meta && typeof candidate.runtime_meta === 'object'
            ? candidate.runtime_meta
            : {};

    return {
        dataMeta,
        runtimeMeta,
    };
}

function buildSurfaceStatusText(surfaceContract, readiness, releaseMode) {
    const canonicalRoute =
        surfaceContract.expectedRoute ||
        SURFACE_ROUTE_FALLBACKS[surfaceContract.surface] ||
        '';
    const readinessSummary = toString(
        readiness?.summary,
        `${Number(readiness?.readySurfaceCount || 0)}/${Number(
            readiness?.enabledSurfaceCount || 0
        )} superficies listas`
    );

    if (surfaceContract.state === 'alert') {
        if (surfaceContract.reason === 'profile_missing') {
            return `Bloqueado · perfil de respaldo · clinic-profile.json remoto ausente · releaseMode ${releaseMode} · ${readinessSummary}`;
        }

        if (surfaceContract.reason === 'route_mismatch') {
            return `Bloqueado · ruta fuera de canon · se esperaba ${canonicalRoute} · releaseMode ${releaseMode} · ${readinessSummary}`;
        }

        return `Bloqueado · ${surfaceContract.detail || 'superficie fuera de canon'} · releaseMode ${releaseMode} · ${readinessSummary}`;
    }

    return `${
        readiness?.state === 'warning'
            ? 'Con avisos'
            : readiness?.state === 'alert'
              ? 'Readiness bloqueada'
              : 'Perfil remoto verificado'
    } · firma ${surfaceContract.profileFingerprint || 'sin-firma'} · releaseMode ${releaseMode} · ${readinessSummary} · canon ${canonicalRoute}`;
}

function buildSurfaceUiState(surfaceContract, readiness) {
    if (surfaceContract.state === 'alert' || readiness?.state === 'alert') {
        return 'alert';
    }

    if (readiness?.state === 'warning') {
        return 'warning';
    }

    if (surfaceContract.state === 'ready') {
        return 'ready';
    }

    return 'warning';
}

export function normalizeLaunchMode(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'windowed'
        ? 'windowed'
        : DEFAULT_LAUNCH_MODE;
}

export function normalizeStationMode(value, fallback = DEFAULT_STATION_MODE) {
    return String(value || fallback)
        .trim()
        .toLowerCase() === 'locked'
        ? 'locked'
        : 'free';
}

export function normalizeStationConsultorio(
    value,
    fallback = DEFAULT_STATION_CONSULTORIO
) {
    return Number(value || fallback) === 2 ? 2 : 1;
}

export function normalizeAutoStart(value, fallback = true) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

export function normalizeUpdateChannel(
    value,
    fallback = DEFAULT_UPDATE_CHANNEL
) {
    const preferred = String(value || '')
        .trim()
        .toLowerCase();
    if (preferred === 'pilot' || preferred === 'stable') {
        return preferred;
    }

    const fallbackChannel = String(fallback || DEFAULT_UPDATE_CHANNEL)
        .trim()
        .toLowerCase();
    return fallbackChannel === 'pilot' ? 'pilot' : DEFAULT_UPDATE_CHANNEL;
}

export function normalizeOneTap(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

export function buildOperatorSurfaceState(value = {}) {
    const stationConsultorio = normalizeStationConsultorio(
        value.stationConsultorio,
        DEFAULT_STATION_CONSULTORIO
    );
    const stationMode = normalizeStationMode(
        value.stationMode,
        DEFAULT_STATION_MODE
    );
    const oneTap = normalizeOneTap(value.oneTap, false);
    const locked = stationMode === 'locked';
    const stationKey = `c${stationConsultorio}`;

    return {
        stationConsultorio,
        stationMode,
        oneTap,
        locked,
        stationKey,
        instance: locked ? stationKey : 'free',
    };
}

export function applyOperatorSurfaceSearchParams(searchParams, value = {}) {
    const params =
        searchParams instanceof URLSearchParams
            ? searchParams
            : new URLSearchParams(searchParams);
    const surfaceState = buildOperatorSurfaceState(value);

    params.set('station', surfaceState.stationKey);
    params.set('lock', surfaceState.locked ? '1' : '0');
    params.set('one_tap', surfaceState.oneTap ? '1' : '0');

    return params;
}

export function getTurneroActiveClinicProfile(source = {}) {
    const candidate = resolveClinicProfileCandidate(source);
    const profile = normalizeTurneroClinicProfile(candidate);
    return {
        ...profile,
        runtime_meta: getTurneroActiveClinicProfileMeta(source, profile),
    };
}

export function getTurneroActiveClinicProfileMeta(source = {}, profile = null) {
    const { dataMeta, runtimeMeta } = getExplicitRuntimeMeta(source);
    const candidate =
        profile && typeof profile === 'object'
            ? profile
            : resolveClinicProfileCandidate(source);
    const normalizedProfile = normalizeTurneroClinicProfile(candidate);
    const explicitSource = String(
        dataMeta.source || runtimeMeta.source || ''
    )
        .trim()
        .toLowerCase();
    const sourceValue = candidate
        ? explicitSource === 'remote'
            ? 'remote'
            : explicitSource === 'fallback_default'
              ? 'fallback_default'
              : isFallbackClinicProfile(normalizedProfile)
                ? 'fallback_default'
                : 'remote'
        : 'fallback_default';
    const profileFingerprint = String(
        dataMeta.profileFingerprint ||
            runtimeMeta.profileFingerprint ||
            getTurneroClinicProfileFingerprint(normalizedProfile)
    ).trim();

    return {
        source: sourceValue,
        profileFingerprint,
    };
}

export function getTurneroActiveClinicProfileCatalogStatus(source = {}) {
    const state = asObject(source);
    const data = asObject(state.data);
    const catalogStatus =
        data.turneroClinicProfileCatalogStatus &&
        typeof data.turneroClinicProfileCatalogStatus === 'object'
            ? data.turneroClinicProfileCatalogStatus
            : null;

    return catalogStatus && Object.keys(catalogStatus).length > 0
        ? catalogStatus
        : null;
}

export function getTurneroActiveClinicId(source = {}) {
    return getTurneroActiveClinicProfile(source)?.clinic_id || 'default-clinic';
}

export function buildTurneroSurfaceRuntimeStatus(
    profileOrState,
    surface,
    options = {}
) {
    const activeProfile = getTurneroActiveClinicProfile(profileOrState);
    const surfaceKey = normalizeSurfaceKey(surface);
    const currentRoute = resolveCurrentRoute(options);
    const readiness = getTurneroClinicReadiness(activeProfile, {
        ...options,
        currentRoutes: resolveCurrentRoutesForSurface(surfaceKey, {
            ...options,
            currentRoute,
        }),
    });
    const surfaceContract = getTurneroSurfaceContract(activeProfile, surfaceKey, {
        currentRoute,
    });
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(activeProfile);
    const releaseMode = getTurneroClinicReleaseMode(activeProfile);
    const profileFingerprint = String(
        runtimeMeta.profileFingerprint ||
            getTurneroClinicProfileFingerprint(activeProfile)
    ).trim();
    const canonicalRoute =
        surfaceContract.expectedRoute ||
        SURFACE_ROUTE_FALLBACKS[surfaceKey] ||
        '';
    const uiState = buildSurfaceUiState(surfaceContract, readiness);
    const text = buildSurfaceStatusText(
        {
            ...surfaceContract,
            profileFingerprint,
        },
        readiness,
        releaseMode
    );

    return {
        surface: surfaceKey,
        profile: activeProfile,
        clinicId: activeProfile.clinic_id,
        clinicName: getTurneroClinicBrandName(activeProfile),
        clinicShortName: getTurneroClinicShortName(activeProfile),
        profileSource: runtimeMeta.source,
        profileFingerprint,
        releaseMode,
        canonicalRoute,
        currentRoute: surfaceContract.currentRoute || currentRoute,
        surfaceContract: {
            ...surfaceContract,
            profileFingerprint,
        },
        readiness,
        uiState,
        state: surfaceContract.state,
        blocked: uiState === 'alert',
        ready: uiState === 'ready',
        routeMatches: surfaceContract.routeMatches,
        reason: surfaceContract.reason,
        summary: readiness.summary,
        text,
        detail: text,
        label: surfaceContract.label,
    };
}

export function hasRecentQueueSmokeSignalForState(
    state,
    activeClinicId,
    maxAgeSec = 21600
) {
    const safeState = state && typeof state === 'object' ? state : {};
    const queueMeta = safeState?.data?.queueMeta;
    if (Number(queueMeta?.calledCount || 0) > 0) {
        return true;
    }

    const queueTickets = Array.isArray(safeState?.data?.queueTickets)
        ? safeState.data.queueTickets
        : [];
    if (
        queueTickets.some((ticket) => String(ticket.status || '') === 'called')
    ) {
        return true;
    }

    return (Array.isArray(safeState?.queue?.activity)
        ? safeState.queue.activity
        : []
    ).some((entry) => {
        const message = String(entry?.message || '');
        if (!/(Llamado C\d ejecutado|Re-llamar)/i.test(message)) {
            return false;
        }

        if (!matchesClinic(entry?.clinicId, activeClinicId)) {
            return false;
        }

        const entryMs = Date.parse(String(entry?.at || ''));
        if (!Number.isFinite(entryMs)) {
            return true;
        }
        return Date.now() - entryMs <= maxAgeSec * 1000;
    });
}

export const buildTurneroPilotOpeningPackage = getTurneroPilotOpeningPackage;

export {
    getTurneroClinicAdminModeDefault,
    getTurneroClinicBrandName,
    getTurneroClinicOpeningPackage,
    getTurneroClinicProfileFingerprint,
    getTurneroClinicProfileRuntimeMeta,
    getTurneroClinicReadiness,
    getTurneroClinicReleaseMode,
    getTurneroClinicShortName,
    getTurneroConsultorioLabel,
    getTurneroPilotBlockers,
    getTurneroPilotOpeningPackage,
    getTurneroPilotSurfaceKeys,
    getTurneroPilotSurfaceReadiness,
    getTurneroReleaseMode,
    getTurneroSurfaceContract,
    getTurneroSurfaceReadinessSnapshot,
    loadTurneroClinicProfile,
    normalizeTurneroClinicProfile,
};
