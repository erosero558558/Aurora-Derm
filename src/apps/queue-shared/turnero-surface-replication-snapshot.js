import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

export function buildTurneroSurfaceReplicationSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);
    const surfaceKey = toString(input.surfaceKey, 'surface');
    const clinicId = toString(
        input.clinicProfile?.clinicId ||
            input.clinicProfile?.clinic_id ||
            clinicProfile.clinic_id,
        clinicProfile.clinic_id
    );

    return {
        scope: toString(input.scope, clinicId || surfaceKey || 'global'),
        surfaceKey,
        surfaceLabel: toString(input.surfaceLabel, surfaceKey),
        clinicId,
        clinicLabel: toString(
            input.clinicLabel ||
                input.clinicProfile?.label ||
                input.clinicProfile?.name ||
                getTurneroClinicBrandName(clinicProfile) ||
                getTurneroClinicShortName(clinicProfile),
            ''
        ),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: toString(input.truth, 'unknown'),
        templateState: toString(input.templateState, 'draft'),
        assetProfile: toString(input.assetProfile, 'unknown'),
        replicationOwner: toString(input.replicationOwner, ''),
        installTimeBucket: toString(input.installTimeBucket, 'unknown'),
        documentationState: toString(input.documentationState, 'draft'),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}
