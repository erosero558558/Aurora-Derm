import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function toNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
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
    if (normalizedSurfaceKey === 'regional-renewal') {
        return 'Renewal Retention';
    }

    return normalizedSurfaceKey;
}

function normalizeRenewalValueBand(value) {
    const normalized = toString(value, 'medium').toLowerCase();
    if (['high', 'medium', 'low', 'unknown'].includes(normalized)) {
        return normalized;
    }
    return 'medium';
}

function normalizeRetentionSignal(value) {
    const normalized = toString(value, 'stable').toLowerCase();
    if (['expanding', 'stable', 'fragile', 'at-risk'].includes(normalized)) {
        return normalized;
    }
    return 'stable';
}

function normalizeFeedbackState(value) {
    const normalized = toString(value, 'good').toLowerCase();
    if (['good', 'mixed', 'neutral', 'bad'].includes(normalized)) {
        return normalized;
    }
    return 'good';
}

function normalizeActivityState(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['active', 'watch', 'idle', 'stalled'].includes(normalized)) {
        return normalized;
    }
    return 'active';
}

export function buildTurneroSurfaceRenewalSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);
    const surfaceKey = toString(input.surfaceKey, 'surface');
    const clinicId = toString(
        input.clinicProfile?.clinicId ||
            input.clinicProfile?.clinic_id ||
            clinicProfile.clinic_id,
        clinicProfile.clinic_id
    );

    return {
        scope: toString(input.scope, clinicId || surfaceKey || 'regional'),
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
        renewalValueBand: normalizeRenewalValueBand(input.renewalValueBand),
        retentionSignal: normalizeRetentionSignal(input.retentionSignal),
        feedbackState: normalizeFeedbackState(input.feedbackState),
        activityState: normalizeActivityState(input.activityState),
        pendingCorrections: Math.max(0, toNumber(input.pendingCorrections, 0)),
        renewalOwner: toString(input.renewalOwner, ''),
        commercialOwner: toString(input.commercialOwner, ''),
        successOwner: toString(input.successOwner, ''),
        nextRenewalWindow: toString(input.nextRenewalWindow, ''),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}
