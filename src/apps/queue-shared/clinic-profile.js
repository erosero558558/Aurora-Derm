const FALLBACK_PROFILE = Object.freeze({
    schema: 'turnero-clinic-profile/v1',
    clinic_id: 'default-clinic',
    branding: {
        name: 'Piel en Armonia',
        short_name: 'Piel en Armonia',
        city: 'Quito',
        base_url: '',
    },
    consultorios: {
        c1: {
            label: 'Consultorio 1',
            short_label: 'C1',
        },
        c2: {
            label: 'Consultorio 2',
            short_label: 'C2',
        },
    },
    surfaces: {
        admin: {
            enabled: true,
            label: 'Admin web',
            route: '/admin.html#queue',
        },
        operator: {
            enabled: true,
            label: 'Operador web',
            route: '/operador-turnos.html',
        },
        kiosk: {
            enabled: true,
            label: 'Kiosco web',
            route: '/kiosco-turnos.html',
        },
        display: {
            enabled: true,
            label: 'Sala web',
            route: '/sala-turnos.html',
        },
    },
    release: {
        mode: 'web_pilot',
        admin_mode_default: 'basic',
        separate_deploy: true,
        native_apps_blocking: false,
        notes: [],
    },
});

let clinicProfilePromise = null;

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function hashClinicProfileSource(input) {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function normalizeTurneroClinicProfile(rawProfile) {
    const source =
        rawProfile && typeof rawProfile === 'object' ? rawProfile : {};
    const branding =
        source.branding && typeof source.branding === 'object'
            ? source.branding
            : {};
    const consultorios =
        source.consultorios && typeof source.consultorios === 'object'
            ? source.consultorios
            : {};
    const surfaces =
        source.surfaces && typeof source.surfaces === 'object'
            ? source.surfaces
            : {};
    const release =
        source.release && typeof source.release === 'object'
            ? source.release
            : {};

    return {
        schema: toString(source.schema, FALLBACK_PROFILE.schema),
        clinic_id: toString(source.clinic_id, FALLBACK_PROFILE.clinic_id),
        branding: {
            name: toString(branding.name, FALLBACK_PROFILE.branding.name),
            short_name: toString(
                branding.short_name,
                toString(branding.name, FALLBACK_PROFILE.branding.short_name)
            ),
            city: toString(branding.city, FALLBACK_PROFILE.branding.city),
            base_url: toString(
                branding.base_url,
                FALLBACK_PROFILE.branding.base_url
            ),
        },
        consultorios: {
            c1: {
                label: toString(
                    consultorios?.c1?.label,
                    FALLBACK_PROFILE.consultorios.c1.label
                ),
                short_label: toString(
                    consultorios?.c1?.short_label,
                    FALLBACK_PROFILE.consultorios.c1.short_label
                ),
            },
            c2: {
                label: toString(
                    consultorios?.c2?.label,
                    FALLBACK_PROFILE.consultorios.c2.label
                ),
                short_label: toString(
                    consultorios?.c2?.short_label,
                    FALLBACK_PROFILE.consultorios.c2.short_label
                ),
            },
        },
        surfaces: {
            admin: {
                enabled:
                    typeof surfaces?.admin?.enabled === 'boolean'
                        ? surfaces.admin.enabled
                        : true,
                label: toString(
                    surfaces?.admin?.label,
                    FALLBACK_PROFILE.surfaces.admin.label
                ),
                route: toString(
                    surfaces?.admin?.route,
                    FALLBACK_PROFILE.surfaces.admin.route
                ),
            },
            operator: {
                enabled:
                    typeof surfaces?.operator?.enabled === 'boolean'
                        ? surfaces.operator.enabled
                        : true,
                label: toString(
                    surfaces?.operator?.label,
                    FALLBACK_PROFILE.surfaces.operator.label
                ),
                route: toString(
                    surfaces?.operator?.route,
                    FALLBACK_PROFILE.surfaces.operator.route
                ),
            },
            kiosk: {
                enabled:
                    typeof surfaces?.kiosk?.enabled === 'boolean'
                        ? surfaces.kiosk.enabled
                        : true,
                label: toString(
                    surfaces?.kiosk?.label,
                    FALLBACK_PROFILE.surfaces.kiosk.label
                ),
                route: toString(
                    surfaces?.kiosk?.route,
                    FALLBACK_PROFILE.surfaces.kiosk.route
                ),
            },
            display: {
                enabled:
                    typeof surfaces?.display?.enabled === 'boolean'
                        ? surfaces.display.enabled
                        : true,
                label: toString(
                    surfaces?.display?.label,
                    FALLBACK_PROFILE.surfaces.display.label
                ),
                route: toString(
                    surfaces?.display?.route,
                    FALLBACK_PROFILE.surfaces.display.route
                ),
            },
        },
        release: {
            mode: toString(release.mode, FALLBACK_PROFILE.release.mode),
            admin_mode_default:
                toString(
                    release.admin_mode_default,
                    FALLBACK_PROFILE.release.admin_mode_default
                ) === 'expert'
                    ? 'expert'
                    : 'basic',
            separate_deploy:
                typeof release.separate_deploy === 'boolean'
                    ? release.separate_deploy
                    : true,
            native_apps_blocking:
                typeof release.native_apps_blocking === 'boolean'
                    ? release.native_apps_blocking
                    : false,
            notes: Array.isArray(release.notes)
                ? release.notes.map((note) => toString(note)).filter(Boolean)
                : [],
        },
    };
}

export function getTurneroClinicBrandName(profile) {
    return toString(profile?.branding?.name, FALLBACK_PROFILE.branding.name);
}

export function getTurneroClinicShortName(profile) {
    return toString(
        profile?.branding?.short_name,
        getTurneroClinicBrandName(profile)
    );
}

export function getTurneroClinicProfileFingerprint(profile) {
    const normalized = normalizeTurneroClinicProfile(profile);
    const source = [
        normalized.clinic_id,
        normalized.branding.base_url,
        normalized.consultorios.c1.label,
        normalized.consultorios.c1.short_label,
        normalized.consultorios.c2.label,
        normalized.consultorios.c2.short_label,
        normalized.surfaces.admin.enabled ? '1' : '0',
        normalized.surfaces.admin.route,
        normalized.surfaces.operator.enabled ? '1' : '0',
        normalized.surfaces.operator.route,
        normalized.surfaces.kiosk.enabled ? '1' : '0',
        normalized.surfaces.kiosk.route,
        normalized.surfaces.display.enabled ? '1' : '0',
        normalized.surfaces.display.route,
        normalized.release.mode,
        normalized.release.admin_mode_default,
        normalized.release.separate_deploy ? '1' : '0',
        normalized.release.native_apps_blocking ? '1' : '0',
    ].join('|');

    return hashClinicProfileSource(source);
}

export function getTurneroClinicProfileRuntimeMeta(profile) {
    const source = String(profile?.runtime_meta?.source || 'remote')
        .trim()
        .toLowerCase();

    return {
        source: source === 'fallback_default' ? 'fallback_default' : 'remote',
        profileFingerprint: String(
            profile?.runtime_meta?.profileFingerprint ||
                getTurneroClinicProfileFingerprint(profile)
        ).trim(),
    };
}

export function getTurneroConsultorioLabel(profile, consultorio, options = {}) {
    const short = Boolean(options.short);
    const key = Number(consultorio || 0) === 2 ? 'c2' : 'c1';
    const fallback = FALLBACK_PROFILE.consultorios[key];
    const source =
        profile?.consultorios && typeof profile.consultorios === 'object'
            ? profile.consultorios[key]
            : null;
    return short
        ? toString(source?.short_label, fallback.short_label)
        : toString(source?.label, fallback.label);
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

function resolveCurrentSurfaceRoute(options = {}) {
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

export function getTurneroSurfaceContract(profile, surface, options = {}) {
    const normalizedProfile = normalizeTurneroClinicProfile(profile);
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(profile);
    const surfaceKey = String(surface || '')
        .trim()
        .toLowerCase();
    const fallbackSurface =
        normalizedProfile.surfaces[surfaceKey] ||
        FALLBACK_PROFILE.surfaces.operator;
    const enabled = fallbackSurface.enabled !== false;
    const expectedRoute = normalizeSurfaceRouteForMatch(fallbackSurface.route);
    const currentRoute = resolveCurrentSurfaceRoute(options);
    const routeMatches =
        expectedRoute === '' || currentRoute === ''
            ? true
            : expectedRoute === currentRoute;

    if (!enabled) {
        return {
            surface: surfaceKey,
            enabled,
            expectedRoute,
            currentRoute,
            routeMatches: false,
            state: 'alert',
            label: fallbackSurface.label,
            detail: `${fallbackSurface.label} está deshabilitada en el perfil de ${getTurneroClinicShortName(
                normalizedProfile
            )}.`,
            reason: 'disabled',
        };
    }

    if (runtimeMeta.source !== 'remote') {
        return {
            surface: surfaceKey,
            enabled,
            expectedRoute,
            currentRoute,
            routeMatches,
            state: 'alert',
            label: fallbackSurface.label,
            detail: 'No se pudo cargar clinic-profile.json; la superficie quedó con perfil de respaldo y no puede operar como piloto.',
            reason: 'profile_missing',
        };
    }

    if (!routeMatches) {
        return {
            surface: surfaceKey,
            enabled,
            expectedRoute,
            currentRoute,
            routeMatches,
            state: 'alert',
            label: fallbackSurface.label,
            detail: `La ruta activa (${currentRoute || 'sin ruta'}) no coincide con la canónica (${expectedRoute || 'sin ruta declarada'}).`,
            reason: 'route_mismatch',
        };
    }

    return {
        surface: surfaceKey,
        enabled,
        expectedRoute,
        currentRoute,
        routeMatches,
        state: 'ready',
        label: fallbackSurface.label,
        detail: `Ruta canónica verificada: ${expectedRoute || currentRoute || 'sin ruta'}.`,
        reason: 'ready',
    };
}

export function loadTurneroClinicProfile() {
    if (clinicProfilePromise) {
        return clinicProfilePromise;
    }

    clinicProfilePromise = fetch('/content/turnero/clinic-profile.json', {
        credentials: 'same-origin',
        headers: {
            Accept: 'application/json',
        },
    })
        .then(async (response) => {
            if (!response.ok) {
                throw new Error(`clinic_profile_http_${response.status}`);
            }
            return response.json();
        })
        .then((payload) => {
            const profile = normalizeTurneroClinicProfile(payload);
            return {
                ...profile,
                runtime_meta: {
                    source: 'remote',
                    profileFingerprint:
                        getTurneroClinicProfileFingerprint(profile),
                },
            };
        })
        .catch(() => {
            const fallbackProfile =
                normalizeTurneroClinicProfile(FALLBACK_PROFILE);
            return {
                ...fallbackProfile,
                runtime_meta: {
                    source: 'fallback_default',
                    profileFingerprint:
                        getTurneroClinicProfileFingerprint(fallbackProfile),
                },
            };
        });

    return clinicProfilePromise;
}
