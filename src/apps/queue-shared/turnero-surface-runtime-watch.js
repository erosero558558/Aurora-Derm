import {
    getTurneroClinicProfileFingerprint,
    getTurneroSurfaceContract,
} from './turnero-runtime-contract.mjs';

const DEFAULT_SURFACE = 'operator';
const STALE_HEARTBEAT_SECONDS = 45;
const SURFACE_LABELS = Object.freeze({
    operator: 'Operador',
    kiosk: 'Kiosco',
    display: 'Sala TV',
});

function normalizeText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeSurface(surface) {
    const requested = normalizeText(surface, DEFAULT_SURFACE).toLowerCase();
    if (requested === 'sala_tv') {
        return 'display';
    }
    return requested || DEFAULT_SURFACE;
}

function normalizeStatus(value) {
    const normalized = normalizeText(value, 'unknown').toLowerCase();
    if (['ready', 'ok', 'healthy', 'success'].includes(normalized)) {
        return 'ready';
    }
    if (['warning', 'warn', 'watch'].includes(normalized)) {
        return 'warning';
    }
    if (
        ['alert', 'danger', 'error', 'critical', 'blocked'].includes(normalized)
    ) {
        return 'alert';
    }
    return normalized || 'unknown';
}

function normalizeRoute(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return '';
    }

    try {
        const parsed = new URL(normalized, 'https://turnero.invalid');
        return `${parsed.pathname}${parsed.hash || ''}`;
    } catch (_error) {
        return normalized;
    }
}

function normalizeBoolean(value) {
    return value === true;
}

function toIsoString(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return '';
    }
    const timestamp = Date.parse(normalized);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : '';
}

function toTimestamp(value) {
    const normalized = normalizeText(value);
    if (!normalized) {
        return 0;
    }
    const timestamp = Date.parse(normalized);
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function resolveTelemetryDetails(telemetryEntry = {}) {
    const latest = telemetryEntry?.latest;
    const details =
        latest && typeof latest === 'object' && latest.details
            ? latest.details
            : {};
    return details && typeof details === 'object' ? details : {};
}

function resolveTelemetryAgeSeconds(telemetryEntry = {}, nowMs = Date.now()) {
    const latest =
        telemetryEntry?.latest && typeof telemetryEntry.latest === 'object'
            ? telemetryEntry.latest
            : {};
    const directAge = Number(latest.ageSec ?? telemetryEntry.ageSec);
    if (Number.isFinite(directAge) && directAge >= 0) {
        return Math.max(0, directAge);
    }

    const timestampCandidates = [
        latest.lastEventAt,
        latest.reportedAt,
        latest.receivedAt,
        latest.updatedAt,
        latest.at,
        telemetryEntry.lastEventAt,
        telemetryEntry.updatedAt,
    ]
        .map(toTimestamp)
        .filter((value) => value > 0);

    if (!timestampCandidates.length) {
        return null;
    }

    return Math.max(
        0,
        Math.round((nowMs - Math.max(...timestampCandidates)) / 1000)
    );
}

function resolveExpectedClinicId(clinicProfile) {
    return normalizeText(clinicProfile?.clinic_id).toLowerCase();
}

function resolveExpectedFingerprint(clinicProfile) {
    return normalizeText(getTurneroClinicProfileFingerprint(clinicProfile));
}

function resolveSurfaceLabel(surface, telemetryEntry = {}) {
    return normalizeText(
        telemetryEntry?.label || telemetryEntry?.title,
        SURFACE_LABELS[normalizeSurface(surface)] || normalizeSurface(surface)
    );
}

function buildIssueList({
    stale = false,
    safeMode = false,
    routeMatch = true,
    clinicMatch = true,
    profileMatch = true,
    contractState = '',
    status = '',
    summary = '',
} = {}) {
    const issues = [];
    if (stale) {
        issues.push('heartbeat_stale');
    }
    if (safeMode) {
        issues.push('safe_mode');
    }
    if (routeMatch === false) {
        issues.push('route_mismatch');
    }
    if (clinicMatch === false) {
        issues.push('clinic_mismatch');
    }
    if (profileMatch === false) {
        issues.push('fingerprint_mismatch');
    }
    if (normalizeStatus(contractState) === 'alert') {
        issues.push('contract_alert');
    }
    if (normalizeStatus(status) === 'alert') {
        issues.push('runtime_alert');
    }
    if (!issues.length && normalizeText(summary)) {
        issues.push('summary_present');
    }
    return issues;
}

export function buildTurneroSurfaceRuntimeWatch({
    surface,
    telemetryEntry,
    clinicProfile,
    safeMode = false,
    now = Date.now(),
} = {}) {
    const normalizedSurface = normalizeSurface(surface);
    const entry =
        telemetryEntry && typeof telemetryEntry === 'object'
            ? telemetryEntry
            : {};
    const details = resolveTelemetryDetails(entry);
    const surfaceContract = getTurneroSurfaceContract(
        clinicProfile,
        normalizedSurface
    );
    const status = normalizeStatus(entry.status);
    const contractState = normalizeStatus(
        details.surfaceContractState ||
            entry.surfaceContractState ||
            surfaceContract.state
    );
    const reportedClinicId = normalizeText(
        details.clinicId || entry.clinicId
    ).toLowerCase();
    const expectedClinicId = resolveExpectedClinicId(clinicProfile);
    const reportedFingerprint = normalizeText(
        details.profileFingerprint || entry.profileFingerprint
    );
    const expectedFingerprint = resolveExpectedFingerprint(clinicProfile);
    const expectedRoute = normalizeRoute(
        details.surfaceRouteExpected ||
            entry.surfaceRouteExpected ||
            surfaceContract.expectedRoute
    );
    const currentRoute = normalizeRoute(
        details.surfaceRouteCurrent ||
            entry.surfaceRouteCurrent ||
            surfaceContract.currentRoute
    );
    const ageSeconds = resolveTelemetryAgeSeconds(
        entry,
        Number(now) || Date.now()
    );
    const stale =
        normalizeBoolean(entry.stale) ||
        (Number.isFinite(ageSeconds) && ageSeconds >= STALE_HEARTBEAT_SECONDS);
    const routeMatch =
        expectedRoute && currentRoute ? expectedRoute === currentRoute : true;
    const clinicMatch =
        expectedClinicId && reportedClinicId
            ? expectedClinicId === reportedClinicId
            : true;
    const profileMatch =
        expectedFingerprint && reportedFingerprint
            ? expectedFingerprint === reportedFingerprint
            : true;
    const safeModeActive = safeMode === true;
    const summary = normalizeText(
        entry.summary,
        contractState === 'alert' ? surfaceContract.detail : ''
    );
    const hasTelemetry =
        Boolean(entry.latest) ||
        Boolean(normalizeText(entry.summary)) ||
        normalizeText(entry.status) !== '';
    let state = 'unknown';

    if (hasTelemetry || safeModeActive) {
        if (
            stale ||
            safeModeActive ||
            status === 'alert' ||
            contractState === 'alert' ||
            routeMatch === false ||
            clinicMatch === false ||
            profileMatch === false
        ) {
            state = 'fallback';
        } else if (
            status === 'warning' ||
            contractState === 'warning' ||
            status === 'unknown'
        ) {
            state = 'watch';
        } else {
            state = 'healthy';
        }
    }

    const issues = buildIssueList({
        stale,
        safeMode: safeModeActive,
        routeMatch,
        clinicMatch,
        profileMatch,
        contractState,
        status,
        summary,
    });

    return {
        surface: normalizedSurface,
        label: resolveSurfaceLabel(normalizedSurface, entry),
        state,
        status,
        summary,
        stale,
        safeMode: safeModeActive,
        safeModeDetail: normalizeText(
            typeof safeMode === 'string' ? safeMode : '',
            safeModeActive ? 'safe_mode' : ''
        ),
        ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : null,
        heartbeatState: stale
            ? 'stale'
            : Number.isFinite(ageSeconds) && ageSeconds > 20
              ? 'watch'
              : hasTelemetry
                ? 'healthy'
                : 'unknown',
        contractState,
        routeMatch,
        clinicMatch,
        profileMatch,
        expectedRoute,
        currentRoute,
        expectedClinicId,
        reportedClinicId,
        expectedFingerprint,
        reportedFingerprint,
        lastEventAt: toIsoString(
            entry?.latest?.lastEventAt || entry.lastEventAt || ''
        ),
        emptySummary: normalizeText(entry.emptySummary),
        issues,
    };
}
