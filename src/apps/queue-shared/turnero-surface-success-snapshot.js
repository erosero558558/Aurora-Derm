import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function resolveSurfaceLabel(surfaceKey, clinicProfile = null) {
    const normalizedSurfaceKey = toString(surfaceKey, 'surface');
    const surfaces =
        clinicProfile?.surfaces && typeof clinicProfile.surfaces === 'object'
            ? clinicProfile.surfaces
            : {};

    if (normalizedSurfaceKey === 'operator-turnos') {
        return toString(
            surfaces.operator?.label || 'Turnero Operador',
            'Turnero Operador'
        );
    }
    if (normalizedSurfaceKey === 'kiosco-turnos') {
        return toString(
            surfaces.kiosk?.label || 'Turnero Kiosco',
            'Turnero Kiosco'
        );
    }
    if (normalizedSurfaceKey === 'sala-turnos') {
        return toString(
            surfaces.display?.label || 'Turnero Sala TV',
            'Turnero Sala TV'
        );
    }

    return normalizedSurfaceKey;
}

function normalizeAdoptionState(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (
        ['ready', 'watch', 'draft', 'degraded', 'blocked', 'pending'].includes(
            normalized
        )
    ) {
        return normalized;
    }
    return 'watch';
}

function normalizeIncidentRateBand(value) {
    const normalized = toString(value, 'low').toLowerCase();
    if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
        return normalized;
    }
    return 'low';
}

function normalizeFeedbackState(value) {
    const normalized = toString(value, 'good').toLowerCase();
    if (['good', 'mixed', 'bad', 'neutral'].includes(normalized)) {
        return normalized;
    }
    return 'good';
}

export function buildTurneroSurfaceSuccessSnapshot(input = {}) {
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
        surfaceLabel: toString(
            input.surfaceLabel,
            resolveSurfaceLabel(surfaceKey, input.clinicProfile || clinicProfile)
        ),
        clinicId,
        clinicLabel: toString(
            input.clinicProfile?.label ||
                input.clinicProfile?.name ||
                getTurneroClinicBrandName(clinicProfile) ||
                getTurneroClinicShortName(clinicProfile),
            ''
        ),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: toString(input.truth, 'unknown'),
        adoptionState: normalizeAdoptionState(input.adoptionState),
        incidentRateBand: normalizeIncidentRateBand(input.incidentRateBand),
        feedbackState: normalizeFeedbackState(input.feedbackState),
        successOwner: toString(input.successOwner, ''),
        followupWindow: toString(input.followupWindow, ''),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}
