import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
} from './clinic-profile.js';

const SURFACE_DEFAULTS = Object.freeze({
    'operator-turnos': {
        surfaceLabel: 'Turnero Operador',
        surfaceRoute: '/operador-turnos.html',
        runtimeState: 'ready',
        truth: 'watch',
        kickoffState: 'ready',
        dataIntakeState: 'ready',
        accessState: 'watch',
        onboardingOwner: 'ops-lead',
        trainingWindow: 'martes 09:00',
    },
    'kiosco-turnos': {
        surfaceLabel: 'Turnero Kiosco',
        surfaceRoute: '/kiosco-turnos.html',
        runtimeState: 'ready',
        truth: 'watch',
        kickoffState: 'watch',
        dataIntakeState: 'pending',
        accessState: 'pending',
        onboardingOwner: '',
        trainingWindow: '',
    },
    'sala-turnos': {
        surfaceLabel: 'Turnero Sala TV',
        surfaceRoute: '/sala-turnos.html',
        runtimeState: 'ready',
        truth: 'aligned',
        kickoffState: 'ready',
        dataIntakeState: 'ready',
        accessState: 'ready',
        onboardingOwner: 'ops-display',
        trainingWindow: 'miercoles 08:00',
    },
});

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function normalizeState(value, fallback = 'unknown') {
    return toString(value, fallback).toLowerCase();
}

function normalizeSurfaceKey(value) {
    const normalized = toString(value, 'surface')
        .toLowerCase()
        .replace(/\\/g, '/')
        .replace(/\?.*$/, '')
        .replace(/#.*$/, '')
        .replace(/\/+$/, '');

    if (
        normalized === 'operator' ||
        normalized.includes('operator-turnos') ||
        normalized.endsWith('/operador-turnos') ||
        normalized.endsWith('/operador-turnos.html')
    ) {
        return 'operator-turnos';
    }
    if (
        normalized === 'kiosk' ||
        normalized === 'kiosco' ||
        normalized.includes('kiosco-turnos') ||
        normalized.includes('kiosk-turnos') ||
        normalized.endsWith('/kiosco-turnos') ||
        normalized.endsWith('/kiosco-turnos.html')
    ) {
        return 'kiosco-turnos';
    }
    if (
        normalized === 'display' ||
        normalized === 'sala' ||
        normalized.includes('sala-turnos') ||
        normalized.endsWith('/sala-turnos') ||
        normalized.endsWith('/sala-turnos.html')
    ) {
        return 'sala-turnos';
    }
    return normalized;
}

function getClinicLabel(clinicProfile = {}) {
    return toString(
        getTurneroClinicBrandName(clinicProfile) ||
            getTurneroClinicShortName(clinicProfile) ||
            clinicProfile?.branding?.name ||
            clinicProfile?.branding?.short_name ||
            clinicProfile?.label ||
            clinicProfile?.name,
        ''
    );
}

function getSurfaceConfig(surfaceKey, clinicProfile = {}) {
    if (surfaceKey === 'operator-turnos') {
        return clinicProfile?.surfaces?.operator || {};
    }
    if (surfaceKey === 'kiosco-turnos') {
        return clinicProfile?.surfaces?.kiosk || {};
    }
    if (surfaceKey === 'sala-turnos') {
        return clinicProfile?.surfaces?.display || {};
    }
    return clinicProfile?.surfaces?.[surfaceKey] || {};
}

export function resolveTurneroSurfaceOnboardingDefaults(
    surfaceKey,
    clinicProfile = {}
) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const defaults = SURFACE_DEFAULTS[normalizedSurfaceKey] || {};
    const surfaceConfig = getSurfaceConfig(normalizedSurfaceKey, clinicProfile);

    return {
        surfaceKey: normalizedSurfaceKey,
        scope: toString(
            clinicProfile?.region || clinicProfile?.branding?.city,
            'regional'
        ),
        surfaceLabel: toString(
            surfaceConfig?.label || defaults.surfaceLabel,
            normalizedSurfaceKey || 'surface'
        ),
        surfaceRoute: toString(
            surfaceConfig?.route || defaults.surfaceRoute,
            ''
        ),
        runtimeState: normalizeState(defaults.runtimeState, 'ready'),
        truth: normalizeState(defaults.truth, 'watch'),
        kickoffState: normalizeState(defaults.kickoffState, 'pending'),
        dataIntakeState: normalizeState(defaults.dataIntakeState, 'pending'),
        accessState: normalizeState(defaults.accessState, 'pending'),
        onboardingOwner: toString(defaults.onboardingOwner, ''),
        trainingWindow: toString(defaults.trainingWindow, ''),
    };
}

export function buildTurneroSurfaceOnboardingSnapshot(input = {}) {
    const clinicProfile =
        input.clinicProfile && typeof input.clinicProfile === 'object'
            ? input.clinicProfile
            : {};
    const surfaceKey = normalizeSurfaceKey(
        input.surfaceKey || input.surfaceRoute
    );
    const defaults = resolveTurneroSurfaceOnboardingDefaults(
        surfaceKey,
        clinicProfile
    );
    const clinicId = toString(
        input.clinicId ||
            clinicProfile?.clinic_id ||
            clinicProfile?.clinicId ||
            clinicProfile?.id,
        ''
    );

    return {
        scope: toString(
            input.scope,
            defaults.scope || clinicId || 'regional'
        ),
        surfaceKey,
        surfaceLabel: toString(
            input.surfaceLabel,
            defaults.surfaceLabel || surfaceKey
        ),
        surfaceRoute: toString(
            input.surfaceRoute,
            defaults.surfaceRoute || ''
        ),
        clinicId,
        clinicLabel: toString(
            input.clinicLabel || getClinicLabel(clinicProfile) || clinicId,
            ''
        ),
        runtimeState: normalizeState(
            input.runtimeState,
            defaults.runtimeState || 'ready'
        ),
        truth: normalizeState(input.truth, defaults.truth || 'watch'),
        kickoffState: normalizeState(
            input.kickoffState,
            defaults.kickoffState || 'pending'
        ),
        dataIntakeState: normalizeState(
            input.dataIntakeState,
            defaults.dataIntakeState || 'pending'
        ),
        accessState: normalizeState(
            input.accessState,
            defaults.accessState || 'pending'
        ),
        onboardingOwner: toString(
            input.onboardingOwner,
            defaults.onboardingOwner || ''
        ),
        trainingWindow: toString(
            input.trainingWindow,
            defaults.trainingWindow || ''
        ),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}
