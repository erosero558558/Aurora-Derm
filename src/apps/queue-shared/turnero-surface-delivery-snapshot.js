import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

const SURFACE_KEY_ALIASES = Object.freeze({
    admin: 'admin',
    queue: 'admin',
    'queue-admin': 'admin',
    'admin-queue': 'admin',
    operator: 'operator',
    operador: 'operator',
    'operator-turnos': 'operator',
    'operador-turnos': 'operator',
    kiosk: 'kiosk',
    kiosko: 'kiosk',
    kiosco: 'kiosk',
    'kiosk-turnos': 'kiosk',
    'kiosko-turnos': 'kiosk',
    'kiosco-turnos': 'kiosk',
    display: 'display',
    sala: 'display',
    'sala-turnos': 'display',
    'sala-tv': 'display',
    sala_tv: 'display',
});

const SURFACE_LABELS = Object.freeze({
    operator: 'Turnero Operador',
    kiosk: 'Turnero Kiosco',
    display: 'Turnero Sala TV',
    admin: 'Admin',
});

const DEFAULT_DELIVERY_FIELDS = Object.freeze({
    operator: {
        truth: 'watch',
        targetWindow: '48h',
        dependencyState: 'watch',
        blockerState: 'clear',
        deliveryOwner: 'ops-lead',
        releaseOwner: 'release-lead',
        opsOwner: 'operator-supervisor',
    },
    kiosk: {
        truth: 'watch',
        targetWindow: '72h',
        dependencyState: 'watch',
        blockerState: 'blocked',
        deliveryOwner: 'frontdesk-coordinator',
        releaseOwner: '',
        opsOwner: '',
    },
    display: {
        truth: 'aligned',
        targetWindow: '24h',
        dependencyState: 'ready',
        blockerState: 'clear',
        deliveryOwner: 'ops-display',
        releaseOwner: 'release-lead',
        opsOwner: 'av-ops',
    },
    admin: {
        truth: 'watch',
        targetWindow: 'regional-wave',
        dependencyState: 'watch',
        blockerState: 'clear',
        deliveryOwner: 'ops-lead',
        releaseOwner: 'release-lead',
        opsOwner: '',
    },
});

function normalizeSurfaceKey(value) {
    const normalized = toString(value, 'surface').toLowerCase();
    return SURFACE_KEY_ALIASES[normalized] || normalized || 'surface';
}

function resolveDefaults(surfaceKey) {
    return (
        DEFAULT_DELIVERY_FIELDS[normalizeSurfaceKey(surfaceKey)] ||
        DEFAULT_DELIVERY_FIELDS.admin
    );
}

function resolveClinicId(clinicProfile) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    return toString(
        profile?.clinic_id || profile?.clinicId || profile?.id,
        'default-clinic'
    );
}

function resolveClinicLabel(clinicProfile, clinicId) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    return toString(
        profile?.branding?.name ||
            profile?.branding?.short_name ||
            getTurneroClinicBrandName(profile) ||
            getTurneroClinicShortName(profile) ||
            clinicId,
        clinicId
    );
}

function resolveScope(inputScope, clinicProfile) {
    return toString(
        inputScope ||
            clinicProfile?.region ||
            clinicProfile?.branding?.city ||
            'regional',
        'regional'
    );
}

function resolveSurfaceLabel(surfaceKey, clinicProfile) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const surfaceProfile = clinicProfile?.surfaces?.[normalizedSurfaceKey];

    return toString(
        surfaceProfile?.label ||
            surfaceProfile?.title ||
            SURFACE_LABELS[normalizedSurfaceKey] ||
            normalizedSurfaceKey,
        SURFACE_LABELS[normalizedSurfaceKey] || normalizedSurfaceKey
    );
}

function normalizeTruthState(value, fallback = 'watch') {
    const normalized = toString(value, fallback).toLowerCase();
    if (
        ['aligned', 'ready', 'watch', 'draft', 'degraded', 'blocked'].includes(
            normalized
        )
    ) {
        return normalized;
    }
    return toString(fallback, 'watch').toLowerCase() || 'watch';
}

function normalizePlanningState(value, fallback = 'watch') {
    const normalized = toString(value, fallback)
        .toLowerCase()
        .replace(/[\s_]+/g, '-');

    if (
        ['ready', 'clear', 'watch', 'open', 'draft', 'blocked'].includes(
            normalized
        )
    ) {
        if (normalized === 'open') {
            return 'watch';
        }
        return normalized;
    }

    if (['aligned', 'done', 'resolved', 'closed'].includes(normalized)) {
        return 'ready';
    }

    return toString(fallback, 'watch').toLowerCase() || 'watch';
}

export function buildTurneroSurfaceDeliverySnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);
    const surfaceKey = normalizeSurfaceKey(input.surfaceKey);
    const clinicId = resolveClinicId(clinicProfile);
    const defaults = resolveDefaults(surfaceKey);

    return {
        scope: resolveScope(input.scope, clinicProfile),
        surfaceKey,
        surfaceLabel: resolveSurfaceLabel(surfaceKey, clinicProfile),
        clinicId,
        clinicLabel: resolveClinicLabel(clinicProfile, clinicId),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: normalizeTruthState(input.truth, defaults.truth),
        targetWindow: toString(input.targetWindow, defaults.targetWindow),
        dependencyState: normalizePlanningState(
            input.dependencyState,
            defaults.dependencyState
        ),
        blockerState: normalizePlanningState(
            input.blockerState,
            defaults.blockerState
        ),
        deliveryOwner: toString(input.deliveryOwner, defaults.deliveryOwner),
        releaseOwner: toString(input.releaseOwner, defaults.releaseOwner),
        opsOwner: toString(input.opsOwner, defaults.opsOwner),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}

export {
    normalizeSurfaceKey as normalizeTurneroSurfaceDeliverySurfaceKey,
    resolveClinicId as resolveTurneroSurfaceDeliveryClinicId,
    resolveClinicLabel as resolveTurneroSurfaceDeliveryClinicLabel,
    resolveScope as resolveTurneroSurfaceDeliveryScope,
    resolveSurfaceLabel as resolveTurneroSurfaceDeliverySurfaceLabel,
};
