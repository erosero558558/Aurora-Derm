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
    operator: 'operator-turnos',
    operador: 'operator-turnos',
    'operator-turnos': 'operator-turnos',
    'operador-turnos': 'operator-turnos',
    kiosk: 'kiosco-turnos',
    kiosko: 'kiosco-turnos',
    kiosco: 'kiosco-turnos',
    'kiosk-turnos': 'kiosco-turnos',
    'kiosko-turnos': 'kiosco-turnos',
    'kiosco-turnos': 'kiosco-turnos',
    display: 'sala-turnos',
    sala: 'sala-turnos',
    'sala-turnos': 'sala-turnos',
    'sala-tv': 'sala-turnos',
    sala_tv: 'sala-turnos',
});

const SURFACE_PROFILE_KEYS = Object.freeze({
    'operator-turnos': 'operator',
    'kiosco-turnos': 'kiosk',
    'sala-turnos': 'display',
});

const SURFACE_LABELS = Object.freeze({
    'operator-turnos': 'Turnero Operador',
    'kiosco-turnos': 'Turnero Kiosco',
    'sala-turnos': 'Turnero Sala TV',
});

const SURFACE_ROUTES = Object.freeze({
    'operator-turnos': '/operador-turnos.html',
    'kiosco-turnos': '/kiosco-turnos.html',
    'sala-turnos': '/sala-turnos.html',
});

const DEFAULT_ROADMAP_BANDS = Object.freeze({
    'operator-turnos': 'core',
    'kiosco-turnos': 'watch',
    'sala-turnos': 'core',
});

const DEFAULT_BACKLOG_STATES = Object.freeze({
    'operator-turnos': 'curated',
    'kiosco-turnos': 'draft',
    'sala-turnos': 'curated',
});

const DEFAULT_NEXT_ACTIONS = Object.freeze({
    'operator-turnos': 'stabilize-operator-lane',
    'kiosco-turnos': 'close-hardware-gaps',
    'sala-turnos': 'analytics-board',
});

const DEFAULT_PRIORITY_BANDS = Object.freeze({
    'operator-turnos': 'p1',
    'kiosco-turnos': 'p2',
    'sala-turnos': 'p1',
});

function normalizeSurfaceKey(value) {
    const normalized = toString(value, 'operator-turnos').toLowerCase();
    return SURFACE_KEY_ALIASES[normalized] || normalized || 'operator-turnos';
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
            'queue-roadmap',
        'queue-roadmap'
    );
}

function resolveSurfaceProfileKey(surfaceKey) {
    return SURFACE_PROFILE_KEYS[normalizeSurfaceKey(surfaceKey)] || '';
}

function resolveSurfaceRegistryEntry(surfaceKey, surfaceRegistry = {}) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const profileKey = resolveSurfaceProfileKey(normalizedSurfaceKey);
    const registry =
        surfaceRegistry && typeof surfaceRegistry === 'object'
            ? surfaceRegistry
            : {};

    return registry[normalizedSurfaceKey] || registry[profileKey] || {};
}

function resolveSurfaceProfile(surfaceKey, clinicProfile) {
    const normalizedProfile = normalizeTurneroClinicProfile(clinicProfile);
    const profileKey = resolveSurfaceProfileKey(surfaceKey);
    return (
        normalizedProfile?.surfaces?.[profileKey] ||
        normalizedProfile?.surfaces?.[normalizeSurfaceKey(surfaceKey)] ||
        {}
    );
}

function resolveSurfaceLabel(
    surfaceKey,
    clinicProfile,
    surfaceRegistry = {}
) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const registryEntry = resolveSurfaceRegistryEntry(
        normalizedSurfaceKey,
        surfaceRegistry
    );
    const surfaceProfile = resolveSurfaceProfile(
        normalizedSurfaceKey,
        clinicProfile
    );

    return toString(
        registryEntry.label ||
            registryEntry.title ||
            surfaceProfile.label ||
            surfaceProfile.title ||
            SURFACE_LABELS[normalizedSurfaceKey] ||
            normalizedSurfaceKey,
        SURFACE_LABELS[normalizedSurfaceKey] || normalizedSurfaceKey
    );
}

function resolveSurfaceRoute(
    surfaceKey,
    inputRoute = '',
    clinicProfile = null,
    surfaceRegistry = {}
) {
    const normalizedSurfaceKey = normalizeSurfaceKey(surfaceKey);
    const registryEntry = resolveSurfaceRegistryEntry(
        normalizedSurfaceKey,
        surfaceRegistry
    );
    const surfaceProfile = resolveSurfaceProfile(
        normalizedSurfaceKey,
        clinicProfile
    );

    return toString(
        inputRoute ||
            registryEntry.route ||
            registryEntry.href ||
            registryEntry.path ||
            surfaceProfile.route ||
            surfaceProfile.href ||
            SURFACE_ROUTES[normalizedSurfaceKey],
        SURFACE_ROUTES[normalizedSurfaceKey] || '/'
    );
}

function resolveRoadmapBand(surfaceKey, inputBand = '') {
    return toString(
        inputBand,
        DEFAULT_ROADMAP_BANDS[normalizeSurfaceKey(surfaceKey)] || 'watch'
    );
}

function resolveBacklogState(surfaceKey, inputState = '') {
    return toString(
        inputState,
        DEFAULT_BACKLOG_STATES[normalizeSurfaceKey(surfaceKey)] || 'draft'
    );
}

function resolveNextAction(surfaceKey, inputAction = '') {
    return toString(
        inputAction,
        DEFAULT_NEXT_ACTIONS[normalizeSurfaceKey(surfaceKey)] || ''
    );
}

function resolvePriorityBand(surfaceKey, inputBand = '') {
    return toString(
        inputBand,
        DEFAULT_PRIORITY_BANDS[normalizeSurfaceKey(surfaceKey)] || 'p3'
    );
}

export function buildTurneroSurfaceRoadmapSnapshot(input = {}) {
    const clinicProfile = normalizeTurneroClinicProfile(input.clinicProfile);
    const surfaceRegistry =
        input.surfaceRegistry && typeof input.surfaceRegistry === 'object'
            ? input.surfaceRegistry
            : {};
    const surfaceKey = normalizeSurfaceKey(input.surfaceKey);
    const clinicId = resolveClinicId(clinicProfile);

    return {
        scope: resolveScope(input.scope, clinicProfile),
        surfaceKey,
        surfaceLabel: toString(
            input.surfaceLabel,
            resolveSurfaceLabel(surfaceKey, clinicProfile, surfaceRegistry)
        ),
        surfaceRoute: resolveSurfaceRoute(
            surfaceKey,
            input.surfaceRoute,
            clinicProfile,
            surfaceRegistry
        ),
        clinicId,
        clinicLabel: resolveClinicLabel(clinicProfile, clinicId),
        runtimeState: toString(input.runtimeState, 'unknown'),
        truth: toString(input.truth, 'unknown'),
        roadmapBand: resolveRoadmapBand(surfaceKey, input.roadmapBand),
        backlogState: resolveBacklogState(surfaceKey, input.backlogState),
        nextAction: resolveNextAction(surfaceKey, input.nextAction),
        priorityBand: resolvePriorityBand(surfaceKey, input.priorityBand),
        roadmapOwner: toString(input.roadmapOwner, ''),
        updatedAt: toString(input.updatedAt, new Date().toISOString()),
    };
}

export {
    normalizeSurfaceKey as normalizeTurneroSurfaceRoadmapSurfaceKey,
    resolveClinicId as resolveTurneroSurfaceRoadmapClinicId,
    resolveClinicLabel as resolveTurneroSurfaceRoadmapClinicLabel,
    resolveScope as resolveTurneroSurfaceRoadmapScope,
    resolveSurfaceLabel as resolveTurneroSurfaceRoadmapSurfaceLabel,
    resolveSurfaceRoute as resolveTurneroSurfaceRoadmapSurfaceRoute,
    resolveSurfaceProfileKey as resolveTurneroSurfaceRoadmapSurfaceProfileKey,
};
