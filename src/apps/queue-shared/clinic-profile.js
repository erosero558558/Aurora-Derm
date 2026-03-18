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
        mode: 'suite_v2',
        admin_mode_default: 'basic',
        separate_deploy: true,
        native_apps_blocking: true,
        notes: [],
    },
});

const SURFACE_ORDER = Object.freeze(['admin', 'operator', 'kiosk', 'display']);
const SURFACE_ALIASES = Object.freeze({
    sala_tv: 'display',
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

function normalizeSurfaceKey(surface) {
    const requested = String(surface || '')
        .trim()
        .toLowerCase();
    return SURFACE_ALIASES[requested] || requested;
}

function normalizeReasonLabel(reason) {
    switch (
        String(reason || '')
            .trim()
            .toLowerCase()
    ) {
        case 'profile_missing':
            return 'perfil_fallback';
        case 'route_mismatch':
            return 'ruta_fuera_canon';
        case 'disabled':
            return 'surface_disabled';
        case 'fingerprint_untrusted':
            return 'firma_no_confiable';
        case 'clinic_id_missing':
            return 'clinic_id_missing';
        default:
            return toString(reason, 'blocked');
    }
}

export function getTurneroPilotSurfaceKeys() {
    return [...SURFACE_ORDER];
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
                    : true,
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

export function getTurneroClinicReleaseMode(profile) {
    return toString(profile?.release?.mode, FALLBACK_PROFILE.release.mode);
}

export function getTurneroReleaseMode(profile) {
    return getTurneroClinicReleaseMode(profile);
}

export function getTurneroClinicAdminModeDefault(profile) {
    return toString(
        profile?.release?.admin_mode_default,
        FALLBACK_PROFILE.release.admin_mode_default
    ) === 'expert'
        ? 'expert'
        : 'basic';
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
    const surfaceKey = normalizeSurfaceKey(surface);
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

function buildProfileWithRuntimeMeta(profile) {
    const normalized = normalizeTurneroClinicProfile(profile);
    return {
        ...normalized,
        runtime_meta: getTurneroClinicProfileRuntimeMeta(profile),
    };
}

export function getTurneroClinicOpeningPackage(profile, options = {}) {
    const profileWithRuntimeMeta = buildProfileWithRuntimeMeta(profile);
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(
        profileWithRuntimeMeta
    );
    const currentRoutes =
        options.currentRoutes && typeof options.currentRoutes === 'object'
            ? options.currentRoutes
            : {};

    const surfaces = SURFACE_ORDER.map((surfaceKey) => {
        const surfaceDefinition =
            profileWithRuntimeMeta.surfaces[surfaceKey] ||
            FALLBACK_PROFILE.surfaces[surfaceKey];
        const hasExplicitCurrentRoute = Object.prototype.hasOwnProperty.call(
            currentRoutes,
            surfaceKey
        );
        const contract = getTurneroSurfaceContract(
            profileWithRuntimeMeta,
            surfaceKey,
            {
                currentRoute: hasExplicitCurrentRoute
                    ? currentRoutes[surfaceKey]
                    : '',
            }
        );

        return {
            id: surfaceKey,
            label: surfaceDefinition.label,
            enabled: surfaceDefinition.enabled !== false,
            route: surfaceDefinition.route,
            contract,
            ready: contract.state === 'ready',
        };
    });

    const enabledSurfaces = surfaces.filter((surface) => surface.enabled);
    const readySurfaces = enabledSurfaces.filter((surface) => surface.ready);
    const blockedSurfaces = enabledSurfaces.filter(
        (surface) => surface.contract.state === 'alert'
    );

    return {
        clinicId: profileWithRuntimeMeta.clinic_id,
        clinicName: getTurneroClinicBrandName(profileWithRuntimeMeta),
        clinicShortName: getTurneroClinicShortName(profileWithRuntimeMeta),
        profileSource: runtimeMeta.source,
        profileFingerprint: runtimeMeta.profileFingerprint,
        releaseMode: getTurneroClinicReleaseMode(profileWithRuntimeMeta),
        adminModeDefault: getTurneroClinicAdminModeDefault(
            profileWithRuntimeMeta
        ),
        separateDeploy: profileWithRuntimeMeta.release.separate_deploy === true,
        nativeAppsBlocking:
            profileWithRuntimeMeta.release.native_apps_blocking === true,
        notes: [...profileWithRuntimeMeta.release.notes],
        surfaceOrder: [...SURFACE_ORDER],
        surfaces,
        enabledSurfaceCount: enabledSurfaces.length,
        readySurfaceCount: readySurfaces.length,
        blockedSurfaceCount: blockedSurfaces.length,
    };
}

export function getTurneroSurfaceReadinessSnapshot(
    profile,
    surface,
    options = {}
) {
    const surfaceKey = normalizeSurfaceKey(surface);
    const openingPackage = getTurneroClinicOpeningPackage(profile, options);
    const surfaceEntry =
        openingPackage.surfaces.find((entry) => entry.id === surfaceKey) ||
        null;

    if (!surfaceEntry) {
        return null;
    }

    return {
        ...surfaceEntry,
        clinicId: openingPackage.clinicId,
        clinicName: openingPackage.clinicName,
        clinicShortName: openingPackage.clinicShortName,
        profileSource: openingPackage.profileSource,
        profileFingerprint: openingPackage.profileFingerprint,
        releaseMode: openingPackage.releaseMode,
        adminModeDefault: openingPackage.adminModeDefault,
        enabledSurfaceCount: openingPackage.enabledSurfaceCount,
        readySurfaceCount: openingPackage.readySurfaceCount,
        blockedSurfaceCount: openingPackage.blockedSurfaceCount,
    };
}

export function getTurneroClinicReadiness(profile, options = {}) {
    const openingPackage = getTurneroClinicOpeningPackage(profile, options);
    const blockers = [];
    const warnings = [];

    openingPackage.surfaces.forEach((surface) => {
        if (!surface.enabled) {
            blockers.push(`${surface.label} deshabilitada en clinic-profile.`);
            return;
        }

        if (surface.contract.state === 'alert') {
            blockers.push(surface.contract.detail);
        }
    });

    if (openingPackage.profileSource !== 'remote') {
        warnings.push(
            'Se está usando perfil de respaldo; el piloto debe operar con clinic-profile.json remoto.'
        );
    }

    openingPackage.notes.forEach((note) => warnings.push(note));

    let state = 'ready';
    if (blockers.length > 0) {
        state = 'alert';
    } else if (warnings.length > 0) {
        state = 'warning';
    }

    const summary =
        state === 'alert'
            ? `${openingPackage.readySurfaceCount}/${openingPackage.enabledSurfaceCount} superficies listas · ${blockers.length} bloqueo(s) activo(s)`
            : state === 'warning'
              ? `${openingPackage.readySurfaceCount}/${openingPackage.enabledSurfaceCount} superficies listas · ${warnings.length} aviso(s)`
              : `${openingPackage.readySurfaceCount}/${openingPackage.enabledSurfaceCount} superficies listas`;

    return {
        ...openingPackage,
        state,
        summary,
        blockers,
        warnings,
    };
}

export function getTurneroPilotSurfaceReadiness(profile, options = {}) {
    const currentSurface = normalizeSurfaceKey(
        options.currentSurface || 'admin'
    );
    const currentRoutes =
        options.routeBySurface && typeof options.routeBySurface === 'object'
            ? options.routeBySurface
            : {};
    const routeBySurface = { ...currentRoutes };

    if (toString(options.currentRoute)) {
        routeBySurface[currentSurface] = options.currentRoute;
    }

    const openingPackage = getTurneroClinicOpeningPackage(profile, {
        currentRoutes: routeBySurface,
    });
    const surfaces = openingPackage.surfaces.map((surface) => ({
        surface: surface.id,
        label: surface.label,
        enabled: surface.enabled,
        state: surface.contract.state,
        reason: surface.contract.reason,
        reasonLabel: normalizeReasonLabel(surface.contract.reason),
        expectedRoute: surface.contract.expectedRoute,
        currentRoute: surface.contract.currentRoute,
        routeMatches: surface.contract.routeMatches,
        detail: surface.contract.detail,
        ready: surface.ready,
    }));
    const blockedSurfaces = surfaces.filter((surface) => !surface.ready);

    return {
        clinicId: openingPackage.clinicId,
        currentSurface,
        surfaces,
        readyCount: openingPackage.readySurfaceCount,
        totalCount: openingPackage.enabledSurfaceCount,
        blockedCount: blockedSurfaces.length,
        blockedSurfaces,
        summaryLabel: `${openingPackage.readySurfaceCount}/${openingPackage.enabledSurfaceCount} superficies listas`,
        allReady: blockedSurfaces.length === 0,
    };
}

export function getTurneroPilotBlockers(profile, options = {}) {
    const normalizedProfile = normalizeTurneroClinicProfile(profile);
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(profile);
    const readiness = getTurneroPilotSurfaceReadiness(profile, options);
    const blockers = [];
    const blockerKeys = new Set();

    function pushBlocker(blocker) {
        const key = String(blocker?.key || '').trim();
        if (!key || blockerKeys.has(key)) {
            return;
        }
        blockerKeys.add(key);
        blockers.push(blocker);
    }

    if (
        !normalizedProfile.clinic_id ||
        normalizedProfile.clinic_id === FALLBACK_PROFILE.clinic_id
    ) {
        pushBlocker({
            key: 'clinic_id_missing',
            scope: 'profile',
            title: 'Clinic ID no confiable',
            detail: 'El perfil no expone un clinic_id operativo distinto del fallback.',
            reason: 'clinic_id_missing',
            reasonLabel: normalizeReasonLabel('clinic_id_missing'),
            severity: 'blocking',
        });
    }

    if (runtimeMeta.source !== 'remote') {
        pushBlocker({
            key: 'profile_missing',
            scope: 'profile',
            title: 'Perfil en fallback',
            detail: 'clinic-profile.json no se cargó en modo remoto; el piloto queda bloqueado hasta recuperar el canon por clínica.',
            reason: 'profile_missing',
            reasonLabel: normalizeReasonLabel('profile_missing'),
            severity: 'blocking',
        });
    }

    const trustedFingerprint = toString(options.trustedProfileFingerprint);
    if (
        trustedFingerprint &&
        trustedFingerprint !== runtimeMeta.profileFingerprint
    ) {
        pushBlocker({
            key: 'fingerprint_untrusted',
            scope: 'profile',
            title: 'Firma de perfil no confiable',
            detail: `La firma activa (${runtimeMeta.profileFingerprint}) no coincide con la esperada (${trustedFingerprint}).`,
            reason: 'fingerprint_untrusted',
            reasonLabel: normalizeReasonLabel('fingerprint_untrusted'),
            severity: 'blocking',
        });
    }

    readiness.blockedSurfaces.forEach((surface) => {
        pushBlocker({
            key: `${surface.surface}:${surface.reason}`,
            scope: surface.surface,
            title:
                surface.reason === 'disabled'
                    ? `${surface.label} deshabilitada`
                    : surface.reason === 'route_mismatch'
                      ? `${surface.label} fuera de canon`
                      : `${surface.label} bloqueada`,
            detail: surface.detail,
            reason: surface.reason,
            reasonLabel: surface.reasonLabel,
            severity: 'blocking',
        });
    });

    return blockers;
}

export function getTurneroPilotOpeningPackage(profile, options = {}) {
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(profile);
    const normalizedProfile = normalizeTurneroClinicProfile(profile);
    const readiness = getTurneroPilotSurfaceReadiness(profile, options);
    const blockers = getTurneroPilotBlockers(profile, {
        ...options,
        trustedProfileFingerprint: options.trustedProfileFingerprint,
    });
    const blocked = blockers.length > 0;
    const finalStatus = blocked
        ? 'blocked'
        : readiness.allReady
          ? 'ready'
          : 'warning';

    return {
        clinicId: normalizedProfile.clinic_id,
        clinicName: getTurneroClinicBrandName(normalizedProfile),
        clinicShortName: getTurneroClinicShortName(normalizedProfile),
        profileFingerprint: runtimeMeta.profileFingerprint,
        runtimeSource: runtimeMeta.source,
        releaseMode: getTurneroReleaseMode(normalizedProfile),
        adminModeDefault: normalizedProfile.release.admin_mode_default,
        readiness,
        blockers,
        blocked,
        finalStatus,
        finalLabel:
            finalStatus === 'blocked'
                ? 'bloqueado'
                : finalStatus === 'warning'
                  ? 'aviso'
                  : 'listo',
        summaryLabel:
            finalStatus === 'blocked'
                ? `${readiness.summaryLabel} · ${blockers.length} bloqueo(s)`
                : finalStatus === 'warning'
                  ? `${readiness.summaryLabel} · revisar advertencias`
                  : `${readiness.summaryLabel} · paquete listo`,
    };
}

export const buildTurneroPilotOpeningPackage = getTurneroClinicOpeningPackage;

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
