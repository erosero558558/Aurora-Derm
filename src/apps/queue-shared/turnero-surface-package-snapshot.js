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

const DEFAULT_PACKAGE_TIER = Object.freeze({
    operator: 'pilot-plus',
    kiosk: 'pilot',
    display: 'pilot-plus',
    admin: 'pilot',
});

function normalizeSurfaceKey(value) {
    const normalized = toString(value, 'surface').toLowerCase();
    return SURFACE_KEY_ALIASES[normalized] || normalized || 'surface';
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

function resolvePackageTier(surfaceKey, packageTier) {
    const normalizedTier = toString(packageTier);
    if (normalizedTier) {
        return normalizedTier;
    }

    return DEFAULT_PACKAGE_TIER[normalizeSurfaceKey(surfaceKey)] || 'pilot';
}

export function buildTurneroSurfacePackageSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);
    const surfaceKey = normalizeSurfaceKey(input.surfaceKey);
    const clinicId = resolveClinicId(clinicProfile);

    return {
        scope: resolveScope(input.scope, clinicProfile),
        surfaceKey,
        surfaceLabel: resolveSurfaceLabel(surfaceKey, clinicProfile),
        clinicId,
        clinicLabel: resolveClinicLabel(clinicProfile, clinicId),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: toString(input.truth, 'unknown'),
        packageTier: resolvePackageTier(surfaceKey, input.packageTier),
        packageOwner: toString(input.packageOwner, ''),
        bundleState: toString(input.bundleState, 'draft'),
        provisioningState: toString(input.provisioningState, 'draft'),
        onboardingKitState: toString(input.onboardingKitState, 'draft'),
        slaBand: toString(input.slaBand, 'watch'),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}

export {
    normalizeSurfaceKey as normalizeTurneroSurfacePackageSurfaceKey,
    resolveClinicId as resolveTurneroSurfacePackageClinicId,
    resolveClinicLabel as resolveTurneroSurfacePackageClinicLabel,
    resolveScope as resolveTurneroSurfacePackageScope,
    resolveSurfaceLabel as resolveTurneroSurfacePackageSurfaceLabel,
};
