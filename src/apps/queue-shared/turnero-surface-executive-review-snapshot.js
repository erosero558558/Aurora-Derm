import {
    getTurneroClinicBrandName,
    getTurneroClinicShortName,
    normalizeTurneroClinicProfile,
} from './clinic-profile.js';
import { normalizePathToken } from './turnero-surface-helpers.js';

const SURFACE_ALIASES = Object.freeze({
    admin: 'admin',
    'admin-queue': 'admin',
    queue: 'admin',
    'queue-admin': 'admin',
    operator: 'operator',
    operador: 'operator',
    'operator-turnos': 'operator',
    'operador-turnos': 'operator',
    kiosk: 'kiosk',
    kiosco: 'kiosk',
    kiosko: 'kiosk',
    'kiosk-turnos': 'kiosk',
    'kiosco-turnos': 'kiosk',
    'kiosko-turnos': 'kiosk',
    display: 'display',
    sala: 'display',
    'sala-tv': 'display',
    sala_tv: 'display',
    'sala-turnos': 'display',
});

const SURFACE_PRESETS = Object.freeze({
    operator: Object.freeze({
        label: 'Operador web',
        route: '/operador-turnos.html',
        runtimeState: 'ready',
        truth: 'watch',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'watch',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-lead',
        checklist: Object.freeze({ all: 4, pass: 3, fail: 1 }),
    }),
    kiosk: Object.freeze({
        label: 'Kiosco web',
        route: '/kiosco-turnos.html',
        runtimeState: 'ready',
        truth: 'watch',
        portfolioBand: 'watch',
        priorityBand: 'p2',
        decisionState: 'pending',
        reviewWindow: '',
        reviewOwner: '',
        checklist: Object.freeze({ all: 4, pass: 2, fail: 2 }),
    }),
    display: Object.freeze({
        label: 'Sala web',
        route: '/sala-turnos.html',
        runtimeState: 'ready',
        truth: 'aligned',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'approved',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-display',
        checklist: Object.freeze({ all: 4, pass: 3, fail: 1 }),
    }),
    admin: Object.freeze({
        label: 'Admin queue',
        route: '/admin.html#queue',
        runtimeState: 'ready',
        truth: 'aligned',
        portfolioBand: 'core',
        priorityBand: 'p1',
        decisionState: 'approved',
        reviewWindow: 'mensual',
        reviewOwner: 'ops-admin',
        checklist: Object.freeze({ all: 4, pass: 4, fail: 0 }),
    }),
    default: Object.freeze({
        label: 'Surface executive review',
        route: '',
        runtimeState: 'unknown',
        truth: 'unknown',
        portfolioBand: 'unknown',
        priorityBand: 'unknown',
        decisionState: 'pending',
        reviewWindow: '',
        reviewOwner: '',
        checklist: Object.freeze({ all: 4, pass: 2, fail: 2 }),
    }),
});

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function normalizeChecklistSummary(input = {}) {
    const source = asObject(input.summary || input);
    let all = Number(source.all ?? source.total ?? source.count ?? 0);
    let pass = Number(source.pass ?? source.passed ?? source.ok ?? 0);
    let fail = Number(source.fail ?? source.failed ?? source.blocked ?? 0);

    all = Number.isFinite(all) ? Math.max(0, Math.round(all)) : 0;
    pass = Number.isFinite(pass) ? Math.max(0, Math.round(pass)) : 0;
    fail = Number.isFinite(fail) ? Math.max(0, Math.round(fail)) : 0;

    if (all <= 0) {
        all = pass + fail;
    }

    if (pass > all) {
        pass = all;
    }

    if (fail > all) {
        fail = all;
    }

    if (pass + fail > all) {
        fail = Math.max(0, all - pass);
    }

    return {
        summary: {
            all,
            pass,
            fail,
        },
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeSurfaceKey(value) {
    const normalized = normalizePathToken(value) || toString(value, 'surface');
    return String(normalized || 'surface')
        .trim()
        .toLowerCase();
}

function resolveSurfaceProfileKey(surfaceKey) {
    const normalized = normalizeSurfaceKey(surfaceKey);
    return SURFACE_ALIASES[normalized] || normalized;
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

function resolveScope(scope) {
    return toString(scope, 'regional').toLowerCase();
}

function resolvePreset(surfaceKey) {
    const profileKey = resolveSurfaceProfileKey(surfaceKey);
    return {
        ...(SURFACE_PRESETS[profileKey] || SURFACE_PRESETS.default),
    };
}

function resolveSurfaceLabel(surfaceKey, clinicProfile, preset) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    const profileKey = resolveSurfaceProfileKey(surfaceKey);
    return toString(
        profile?.surfaces?.[profileKey]?.label ||
            profile?.surfaces?.[profileKey]?.title ||
            preset?.label ||
            profileKey,
        preset?.label || profileKey
    );
}

function resolveSurfaceRoute(surfaceKey, clinicProfile, preset) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    const profileKey = resolveSurfaceProfileKey(surfaceKey);
    return toString(
        profile?.surfaces?.[profileKey]?.route ||
            profile?.surfaces?.[profileKey]?.path ||
            preset?.route ||
            ''
    );
}

export function buildTurneroSurfaceExecutiveReviewSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(
        input.clinicProfile || input.profile
    );
    const surfaceKey = normalizeSurfaceKey(
        input.surfaceKey || input.surface || 'surface'
    );
    const preset = resolvePreset(surfaceKey);
    const checklist = normalizeChecklistSummary(
        input.checklist || preset.checklist
    );
    const clinicId = resolveClinicId(clinicProfile);
    const route = resolveSurfaceRoute(surfaceKey, clinicProfile, preset);

    return {
        scope: resolveScope(input.scope),
        surfaceKey,
        surfaceProfileKey: resolveSurfaceProfileKey(surfaceKey),
        surfaceLabel: resolveSurfaceLabel(surfaceKey, clinicProfile, preset),
        route,
        clinicId,
        clinicLabel: resolveClinicLabel(clinicProfile, clinicId),
        runtimeState: toString(input.runtimeState, preset.runtimeState),
        truth: toString(input.truth, preset.truth),
        portfolioBand: toString(input.portfolioBand, preset.portfolioBand),
        priorityBand: toString(input.priorityBand, preset.priorityBand),
        decisionState: toString(input.decisionState, preset.decisionState),
        reviewWindow: toString(input.reviewWindow, preset.reviewWindow),
        reviewOwner: toString(input.reviewOwner, preset.reviewOwner),
        checklist,
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}

export function normalizeTurneroSurfaceExecutiveReviewSurfaceKey(value) {
    return normalizeSurfaceKey(value);
}

export function resolveTurneroSurfaceExecutiveReviewSurfaceProfileKey(value) {
    return resolveSurfaceProfileKey(value);
}

export function resolveTurneroSurfaceExecutiveReviewClinicId(clinicProfile) {
    return resolveClinicId(clinicProfile);
}

export function resolveTurneroSurfaceExecutiveReviewClinicLabel(
    clinicProfile,
    clinicId
) {
    return resolveClinicLabel(clinicProfile, clinicId);
}

export function resolveTurneroSurfaceExecutiveReviewScope(scope) {
    return resolveScope(scope);
}

export function resolveTurneroSurfaceExecutiveReviewPreset(surfaceKey) {
    return resolvePreset(surfaceKey);
}

export function normalizeTurneroSurfaceExecutiveReviewChecklist(input = {}) {
    return normalizeChecklistSummary(input);
}

export default buildTurneroSurfaceExecutiveReviewSnapshot;
