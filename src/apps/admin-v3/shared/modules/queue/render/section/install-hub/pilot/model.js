function formatShortCommit(value) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.slice(0, 8) : '';
}

function buildCanonicalSurfaceUrl(baseUrl, route) {
    const normalizedBase = String(baseUrl || '').trim();
    const normalizedRoute = String(route || '').trim();
    if (!normalizedRoute) {
        return '';
    }
    if (!normalizedBase) {
        return normalizedRoute;
    }
    try {
        return new URL(normalizedRoute, normalizedBase).toString();
    } catch (_error) {
        return normalizedRoute;
    }
}

function normalizePilotRoute(route) {
    const normalized = String(route || '').trim();
    if (!normalized) {
        return '';
    }

    try {
        const url = new URL(normalized, 'https://pilot.invalid');
        return `${url.pathname}${url.hash || ''}`;
    } catch (_error) {
        return normalized;
    }
}

function getCurrentPilotRoute() {
    if (
        typeof window === 'undefined' ||
        !window.location ||
        typeof window.location !== 'object'
    ) {
        return '';
    }

    return normalizePilotRoute(
        `${window.location.pathname || ''}${window.location.hash || ''}`
    );
}

function getSurfaceTelemetryDetails(telemetryEntry) {
    const details =
        telemetryEntry?.latest?.details &&
        typeof telemetryEntry.latest.details === 'object'
            ? telemetryEntry.latest.details
            : {};
    return details && typeof details === 'object' ? details : {};
}

function getSurfaceTelemetryContractState(telemetryEntry) {
    return String(
        getSurfaceTelemetryDetails(telemetryEntry).surfaceContractState || ''
    )
        .trim()
        .toLowerCase();
}

function getSurfaceTelemetryContractRoute(telemetryEntry, detailKey) {
    return normalizePilotRoute(
        getSurfaceTelemetryDetails(telemetryEntry)[detailKey] || ''
    );
}

function getSurfaceTelemetryClinicId(telemetryEntry) {
    return String(getSurfaceTelemetryDetails(telemetryEntry).clinicId || '')
        .trim()
        .toLowerCase();
}

function getSurfaceTelemetryProfileFingerprint(telemetryEntry) {
    return String(
        getSurfaceTelemetryDetails(telemetryEntry).profileFingerprint || ''
    ).trim();
}

function getSurfaceTelemetryAlertDetail(telemetryEntry, fallbackText = '') {
    const summary = String(telemetryEntry?.summary || '').trim();
    if (summary) {
        const currentRoute = getSurfaceTelemetryContractRoute(
            telemetryEntry,
            'surfaceRouteCurrent'
        );
        const expectedRoute = getSurfaceTelemetryContractRoute(
            telemetryEntry,
            'surfaceRouteExpected'
        );

        if (
            currentRoute &&
            expectedRoute &&
            currentRoute !== expectedRoute &&
            !summary.includes(currentRoute) &&
            !summary.includes(expectedRoute)
        ) {
            return `${summary} Ruta reportada ${currentRoute}; canon ${expectedRoute}.`;
        }

        return summary;
    }

    return String(fallbackText || '').trim();
}

function buildGoLiveIssue({
    id,
    label,
    state,
    detail,
    href = '',
    actionLabel = '',
}) {
    return {
        id,
        label,
        state: state === 'alert' ? 'alert' : state === 'ready' ? 'ready' : 'warning',
        detail: String(detail || '').trim(),
        href: String(href || '').trim(),
        actionLabel: String(actionLabel || '').trim(),
    };
}

function buildPublicationReadinessDetail(publicSync, clinicName, release) {
    if (release?.separate_deploy !== true) {
        return 'Este release no exige deploy separado por clínica.';
    }

    if (!publicSync || publicSync.available !== true) {
        return 'El admin no recibió señal de `/health`; falta confirmar el estado público del host antes de abrir.';
    }

    if (publicSync.configured !== true) {
        return 'El host todavía no expone `public_main_sync`; la clínica puede quedar lista localmente, pero no publicada de forma verificable.';
    }

    if (publicSync.healthy !== true) {
        const reason = publicSync.failureReason
            ? ` (${publicSync.failureReason})`
            : '';
        return `public_main_sync sigue ${publicSync.state || 'desconocido'}${reason}. Falta estabilizar la publicación antes de abrir ${clinicName}.`;
    }

    if (publicSync.headDrift === true) {
        const commit = formatShortCommit(publicSync.deployedCommit);
        return commit
            ? `El host reporta commit ${commit}, pero todavía hay drift frente al remoto.`
            : 'El host sigue con drift frente al remoto y no conviene abrir la clínica todavía.';
    }

    if (!publicSync.deployedCommit) {
        return 'La publicación no reporta `deployedCommit`; falta una referencia verificable del release activo.';
    }

    return `public_main_sync sano y commit ${formatShortCommit(publicSync.deployedCommit)} ya coincide con la publicación activa de ${clinicName}.`;
}

function buildSmokeStepState(
    surfaceReady,
    telemetryEntry,
    expectedClinicId = '',
    expectedProfileFingerprint = ''
) {
    if (!surfaceReady) {
        return 'alert';
    }
    if (getSurfaceTelemetryContractState(telemetryEntry) === 'alert') {
        return 'alert';
    }
    if (
        expectedClinicId &&
        getSurfaceTelemetryClinicId(telemetryEntry) &&
        getSurfaceTelemetryClinicId(telemetryEntry) !==
            String(expectedClinicId).trim().toLowerCase()
    ) {
        return 'alert';
    }
    if (
        expectedProfileFingerprint &&
        getSurfaceTelemetryProfileFingerprint(telemetryEntry) &&
        getSurfaceTelemetryProfileFingerprint(telemetryEntry) !==
            String(expectedProfileFingerprint).trim()
    ) {
        return 'alert';
    }
    if (
        telemetryEntry &&
        telemetryEntry.status === 'ready' &&
        telemetryEntry.stale !== true
    ) {
        return 'ready';
    }
    return 'warning';
}

export function buildQueueOpsPilotModel(manifest, detectedPlatform, deps) {
    const {
        ensureOpeningChecklistState,
        buildOpeningChecklistSteps,
        buildOpeningChecklistAssist,
        getQueueSyncHealth,
        getSurfaceTelemetryState,
        getTurneroClinicProfile,
        getTurneroClinicProfileMeta,
        getTurneroClinicBrandName,
        getTurneroPublicSyncStatus,
        hasRecentQueueSmokeSignal,
        buildPreparedSurfaceUrl,
        defaultAppDownloads,
        ensureInstallPreset,
    } = deps;
    const checklist = ensureOpeningChecklistState();
    const steps = buildOpeningChecklistSteps(manifest, detectedPlatform);
    const assist = buildOpeningChecklistAssist(detectedPlatform);
    const syncHealth = getQueueSyncHealth();
    const telemetry = [
        getSurfaceTelemetryState('operator'),
        getSurfaceTelemetryState('kiosk'),
        getSurfaceTelemetryState('display'),
    ];
    const telemetryMap = {
        operator: telemetry[0],
        kiosk: telemetry[1],
        display: telemetry[2],
    };
    const confirmedCount = steps.filter(
        (step) => checklist.steps[step.id]
    ).length;
    const suggestedCount = assist.suggestedCount;
    const pendingSteps = steps.filter((step) => !checklist.steps[step.id]);
    const pendingAfterSuggestions = pendingSteps.filter(
        (step) => !assist.suggestions[step.id]?.suggested
    );
    const readyEquipmentCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const issueCount =
        telemetry.filter((entry) => entry.status !== 'ready' || entry.stale)
            .length + (syncHealth.state === 'ready' ? 0 : 1);
    const progressPct =
        steps.length > 0
            ? Math.max(
                  0,
                  Math.min(
                      100,
                      Math.round((confirmedCount / steps.length) * 100)
                  )
              )
            : 0;
    const profile = getTurneroClinicProfile?.() || null;
    const profileMeta = getTurneroClinicProfileMeta?.() || null;
    const profileSource = String(profileMeta?.source || '').trim().toLowerCase();
    const profileFingerprint = String(
        profileMeta?.profileFingerprint || ''
    ).trim();
    const release =
        profile?.release && typeof profile.release === 'object'
            ? profile.release
            : {};
    const profileSurfaces =
        profile?.surfaces && typeof profile.surfaces === 'object'
            ? profile.surfaces
            : {};
    const clinicBaseUrl = String(profile?.branding?.base_url || '').trim();
    const clinicName =
        typeof getTurneroClinicBrandName === 'function'
            ? getTurneroClinicBrandName()
            : String(profile?.branding?.name || 'la clínica').trim();
    const clinicId = String(profile?.clinic_id || '').trim() || 'sin-clinic-id';
    const publicSync =
        typeof getTurneroPublicSyncStatus === 'function'
            ? getTurneroPublicSyncStatus()
            : null;
    const requiredSurfaceKeys = ['admin', 'operator', 'kiosk', 'display'];
    const enabledSurfaceKeys = requiredSurfaceKeys.filter(
        (surfaceKey) =>
            Boolean(profileSurfaces[surfaceKey]?.enabled) &&
            String(profileSurfaces[surfaceKey]?.route || '').trim() !== ''
    );
    const telemetryReadyCount = telemetry.filter(
        (entry) => entry.status === 'ready' && !entry.stale
    ).length;
    const smokeReady =
        Boolean(checklist.steps.smoke_ready) ||
        Boolean(hasRecentQueueSmokeSignal?.());
    const publicationReady =
        release?.separate_deploy === true
            ? Boolean(
                  publicSync?.configured &&
                  publicSync?.healthy &&
                  publicSync?.headDrift !== true &&
                  String(publicSync?.deployedCommit || '').trim() !== ''
              )
            : true;
    const canonicalSurfaces = requiredSurfaceKeys.map((surfaceKey) => {
        const surface = profileSurfaces[surfaceKey];
        const route = String(surface?.route || '').trim();
        const normalizedRoute = normalizePilotRoute(route);
        const fallbackLabel =
            surfaceKey === 'admin'
                ? 'Admin web'
                : surfaceKey === 'operator'
                  ? 'Operador web'
                  : surfaceKey === 'kiosk'
                    ? 'Kiosco web'
                    : 'Sala web';

        const enabled = Boolean(surface?.enabled) && route !== '';
        const telemetryEntry =
            surfaceKey === 'admin' ? null : telemetryMap[surfaceKey];
        const contractState = getSurfaceTelemetryContractState(telemetryEntry);
        const telemetryClinicId = getSurfaceTelemetryClinicId(telemetryEntry);
        const telemetryProfileFingerprint =
            getSurfaceTelemetryProfileFingerprint(telemetryEntry);
        const expectedRoute =
            getSurfaceTelemetryContractRoute(
                telemetryEntry,
                'surfaceRouteExpected'
            ) || normalizedRoute;
        const currentRoute =
            surfaceKey === 'admin'
                ? getCurrentPilotRoute()
                : getSurfaceTelemetryContractRoute(
                      telemetryEntry,
                      'surfaceRouteCurrent'
                  );
        let state = enabled ? 'ready' : 'warning';
        let badge = enabled ? 'Declarada' : 'Pendiente';
        let detail = enabled
            ? `Ruta canónica declarada: ${normalizedRoute || route}.`
            : 'Falta declarar esta superficie en el perfil de la clínica.';

        if (enabled && surfaceKey === 'admin') {
            if (
                normalizedRoute &&
                currentRoute &&
                normalizedRoute !== currentRoute
            ) {
                state = 'alert';
                badge = 'Bloquea';
                detail = `Admin abierto en ${currentRoute}, pero el perfil exige ${normalizedRoute}.`;
            } else {
                badge = 'Verificada';
                detail = `Admin abierto en la ruta canónica ${normalizedRoute || currentRoute}.`;
            }
        } else if (enabled && contractState === 'alert') {
            state = 'alert';
            badge = 'Bloquea';
            detail = getSurfaceTelemetryAlertDetail(
                telemetryEntry,
                currentRoute
                    ? `Heartbeat reporta ${currentRoute}, pero el perfil exige ${expectedRoute}.`
                    : `Heartbeat reporta contrato inválido para esta superficie. El perfil exige ${expectedRoute}.`
            );
        } else if (
            enabled &&
            telemetryClinicId &&
            telemetryClinicId !== clinicId.toLowerCase()
        ) {
            state = 'alert';
            badge = 'Bloquea';
            detail = `Heartbeat reporta clinic_id ${telemetryClinicId}, pero el piloto activo exige ${clinicId}.`;
        } else if (
            enabled &&
            profileFingerprint &&
            telemetryProfileFingerprint &&
            telemetryProfileFingerprint !== profileFingerprint
        ) {
            state = 'alert';
            badge = 'Bloquea';
            detail = `Heartbeat reporta firma ${telemetryProfileFingerprint}, pero el perfil activo usa ${profileFingerprint}.`;
        } else if (enabled && contractState === 'ready') {
            badge = 'Verificada';
            detail =
                telemetryClinicId && telemetryProfileFingerprint
                    ? `Heartbeat verificó ${telemetryClinicId} con firma ${telemetryProfileFingerprint} en la ruta canónica ${currentRoute || expectedRoute}.`
                    : telemetryClinicId
                      ? `Heartbeat verificó ${telemetryClinicId} en la ruta canónica ${currentRoute || expectedRoute}.`
                      : `Heartbeat verificó la ruta canónica ${currentRoute || expectedRoute}.`;
        } else if (enabled && telemetryEntry?.status === 'ready') {
            if (telemetryClinicId && telemetryProfileFingerprint) {
                badge = 'Verificada';
                detail = `Heartbeat activo sobre ${telemetryClinicId} con firma ${telemetryProfileFingerprint} en la ruta canónica ${expectedRoute || normalizedRoute}.`;
            } else if (telemetryClinicId) {
                badge = 'Verificada';
                detail = `Heartbeat activo sobre ${telemetryClinicId} en la ruta canónica ${expectedRoute || normalizedRoute}.`;
            } else {
                detail = `Heartbeat activo. Falta confirmar clinic_id o firma para verificar completamente ${expectedRoute || normalizedRoute}.`;
            }
        }

        return {
            id: surfaceKey,
            label: String(surface?.label || fallbackLabel).trim() || fallbackLabel,
            route: route || 'Sin ruta declarada',
            url: buildCanonicalSurfaceUrl(clinicBaseUrl, route),
            ready: enabled,
            state,
            badge,
            detail,
            expectedRoute,
            currentRoute,
        };
    });
    const canonicalSurfaceMap = Object.fromEntries(
        canonicalSurfaces.map((surface) => [surface.id, surface])
    );
    const canonicalSurfaceAlertCount = canonicalSurfaces.filter(
        (surface) => surface.state === 'alert'
    ).length;
    const canonicalSurfaceVerifiedCount = canonicalSurfaces.filter(
        (surface) => surface.badge === 'Verificada'
    ).length;
    const canonicalSupport =
        canonicalSurfaceAlertCount > 0
            ? `${canonicalSurfaceAlertCount} superficie(s) del piloto están fuera de su ruta canónica y bloquean la apertura.`
            : canonicalSurfaceVerifiedCount === canonicalSurfaces.length
              ? 'Todas las superficies activas ya verificaron su ruta canónica en esta clínica.'
              : `${canonicalSurfaceVerifiedCount}/${canonicalSurfaces.length} superficies ya verificaron su ruta; las demás siguen declaradas a la espera del heartbeat vivo.`;
    const readinessItems = [
        {
            id: 'profile',
            ready:
                Boolean(profile) &&
                profileSource === 'remote' &&
                String(profile?.clinic_id || '').trim() !== '' &&
                String(release?.mode || '').trim() === 'web_pilot' &&
                release?.separate_deploy === true &&
                String(release?.admin_mode_default || '').trim() === 'basic',
            label: 'Perfil por clínica',
            detail:
                Boolean(profile) &&
                profileSource !== 'remote'
                    ? 'El admin sigue usando un perfil cacheado localmente. Recupera `/data` o vuelve a publicar antes de abrir esta clínica.'
                    : Boolean(profile) &&
                String(profile?.clinic_id || '').trim() !== '' &&
                String(release?.mode || '').trim() === 'web_pilot' &&
                release?.separate_deploy === true &&
                String(release?.admin_mode_default || '').trim() === 'basic'
                    ? `${clinicName} ya quedó perfilada como piloto web separado.`
                    : 'Falta cerrar `clinic_id`, release web o `basic` por defecto antes de abrir otra clínica.',
            blocker: true,
        },
        {
            id: 'surfaces',
            ready:
                enabledSurfaceKeys.length === requiredSurfaceKeys.length &&
                canonicalSurfaceAlertCount === 0,
            label: 'Superficies web canónicas',
            detail:
                enabledSurfaceKeys.length !== requiredSurfaceKeys.length
                    ? `Solo ${enabledSurfaceKeys.length}/${requiredSurfaceKeys.length} superficies del piloto quedaron habilitadas en el perfil.`
                    : canonicalSurfaceAlertCount > 0
                      ? `${canonicalSurfaceAlertCount} superficie(s) están vivas fuera de la ruta canónica del perfil.`
                      : 'Admin, operador, kiosco y sala web ya están declarados como superficies activas del piloto.',
            blocker: true,
        },
        {
            id: 'publish',
            ready: publicationReady,
            label: 'Publicación del release',
            detail: buildPublicationReadinessDetail(
                publicSync,
                clinicName,
                release
            ),
            blocker: true,
        },
        {
            id: 'health',
            ready:
                syncHealth.state === 'ready' &&
                telemetryReadyCount === telemetry.length,
            label: 'Señal viva + heartbeats',
            detail:
                syncHealth.state === 'ready' &&
                telemetryReadyCount === telemetry.length
                    ? 'Operador, kiosco y sala reportan señal estable para operar la clínica real.'
                    : `Hay ${Math.max(0, telemetry.length - telemetryReadyCount)} superficie(s) sin estado listo o la cola sigue degradada.`,
            blocker: false,
        },
        {
            id: 'smoke',
            ready: smokeReady,
            label: 'Smoke final del turno',
            detail: smokeReady
                ? 'Ya existe evidencia reciente de llamado end-to-end o el smoke quedó confirmado en apertura.'
                : 'Todavía falta un llamado real o de prueba que cierre el flujo completo antes de producción.',
            blocker: false,
        },
    ];
    const readinessBlockingCount = readinessItems.filter(
        (item) => !item.ready
    ).length;
    const readinessCriticalCount = readinessItems.filter(
        (item) => !item.ready && item.blocker
    ).length;
    const readinessState =
        readinessBlockingCount === 0
            ? 'ready'
            : readinessCriticalCount > 0
              ? 'alert'
              : 'warning';
    const readinessTitle =
        readinessState === 'ready'
            ? 'Piloto web listo para abrir'
            : readinessState === 'alert'
              ? 'Piloto web bloqueado'
              : 'Piloto web casi listo';
    const readinessSummary =
        readinessState === 'ready'
            ? `${clinicName} ya cumple el corte web del piloto: perfil separado, superficies activas, publicación verificada, señal estable y smoke confirmado.`
            : readinessState === 'alert'
              ? `Faltan ${readinessBlockingCount} bloqueo(s) para abrir ${clinicName} en piloto web. Resuelve primero perfil, superficies o publicación antes del smoke final.`
              : `Faltan ${readinessBlockingCount} cierre(s) operativos para abrir ${clinicName} en piloto web sin depender del modo expert.`;
    const nativeAppsSupport =
        release?.native_apps_blocking === false
            ? 'Los instaladores quedan fuera del bloqueo de go-live en este corte web.'
            : 'La política de release todavía marca apps nativas como bloqueantes.';
    const readinessSupport = publicationReady
        ? `La clínica ya quedó publicada con commit verificable. ${nativeAppsSupport}`
        : `Este gate ahora separa "lista localmente" de "publicada". ${nativeAppsSupport}`;
    const smokeSteps = [
        {
            id: 'admin',
            label: 'Abrir admin basic',
            state:
                canonicalSurfaceMap.admin?.ready &&
                String(release?.admin_mode_default || '').trim() === 'basic'
                    ? 'ready'
                    : 'alert',
            detail:
                canonicalSurfaceMap.admin?.ready &&
                String(release?.admin_mode_default || '').trim() === 'basic'
                    ? 'Verifica que la cola abra en `basic` y muestre el sello de la clínica piloto.'
                    : 'Falta una ruta canónica de admin o el piloto no arranca en `basic` por defecto.',
            href: canonicalSurfaceMap.admin?.url || '/admin.html#queue',
            actionLabel: 'Abrir admin',
        },
        {
            id: 'operator',
            label: 'Operador web',
            state: buildSmokeStepState(
                canonicalSurfaceMap.operator?.ready,
                telemetryMap.operator,
                clinicId,
                profileFingerprint
            ),
            detail:
                canonicalSurfaceMap.operator?.ready &&
                getSurfaceTelemetryContractState(telemetryMap.operator) ===
                    'alert'
                    ? getSurfaceTelemetryAlertDetail(
                          telemetryMap.operator,
                          'Operador fuera del canon del piloto.'
                      )
                :
                canonicalSurfaceMap.operator?.ready &&
                getSurfaceTelemetryClinicId(telemetryMap.operator) &&
                getSurfaceTelemetryClinicId(telemetryMap.operator) !==
                    clinicId.toLowerCase()
                    ? `Operador reporta clinic_id ${getSurfaceTelemetryClinicId(
                          telemetryMap.operator
                      )}; corrige el equipo antes del llamado.`
                : canonicalSurfaceMap.operator?.ready &&
                  getSurfaceTelemetryProfileFingerprint(telemetryMap.operator) &&
                  getSurfaceTelemetryProfileFingerprint(telemetryMap.operator) !==
                      profileFingerprint
                    ? `Operador reporta firma ${getSurfaceTelemetryProfileFingerprint(
                          telemetryMap.operator
                      )}; actualiza el perfil antes del llamado.`
                :
                canonicalSurfaceMap.operator?.ready &&
                telemetryMap.operator?.status === 'ready' &&
                telemetryMap.operator?.stale !== true
                    ? `Operador listo: ${telemetryMap.operator.summary || 'heartbeat activo para llamado y cierre.'}`
                    : canonicalSurfaceMap.operator?.ready
                      ? `Falta dejar el operador en verde antes del llamado: ${telemetryMap.operator?.summary || 'sin heartbeat listo.'}`
                      : 'Falta declarar la ruta canónica del operador en el perfil de la clínica.',
            href: canonicalSurfaceMap.operator?.url || '',
            actionLabel: 'Abrir operador',
        },
        {
            id: 'kiosk',
            label: 'Kiosco web',
            state: buildSmokeStepState(
                canonicalSurfaceMap.kiosk?.ready,
                telemetryMap.kiosk,
                clinicId,
                profileFingerprint
            ),
            detail:
                canonicalSurfaceMap.kiosk?.ready &&
                getSurfaceTelemetryContractState(telemetryMap.kiosk) ===
                    'alert'
                    ? getSurfaceTelemetryAlertDetail(
                          telemetryMap.kiosk,
                          'Kiosco fuera del canon del piloto.'
                      )
                :
                canonicalSurfaceMap.kiosk?.ready &&
                getSurfaceTelemetryClinicId(telemetryMap.kiosk) &&
                getSurfaceTelemetryClinicId(telemetryMap.kiosk) !==
                    clinicId.toLowerCase()
                    ? `Kiosco reporta clinic_id ${getSurfaceTelemetryClinicId(
                          telemetryMap.kiosk
                      )}; corrige la superficie antes del check-in.`
                : canonicalSurfaceMap.kiosk?.ready &&
                  getSurfaceTelemetryProfileFingerprint(telemetryMap.kiosk) &&
                  getSurfaceTelemetryProfileFingerprint(telemetryMap.kiosk) !==
                      profileFingerprint
                    ? `Kiosco reporta firma ${getSurfaceTelemetryProfileFingerprint(
                          telemetryMap.kiosk
                      )}; actualiza el perfil antes del check-in.`
                :
                canonicalSurfaceMap.kiosk?.ready &&
                telemetryMap.kiosk?.status === 'ready' &&
                telemetryMap.kiosk?.stale !== true
                    ? 'Kiosco listo para probar check-in con cita o sin cita desde la ruta canónica.'
                    : canonicalSurfaceMap.kiosk?.ready
                      ? `Falta cerrar el smoke de check-in en kiosco: ${telemetryMap.kiosk?.summary || 'heartbeat no listo.'}`
                      : 'Falta declarar la ruta canónica del kiosco dentro del perfil del piloto.',
            href: canonicalSurfaceMap.kiosk?.url || '',
            actionLabel: 'Abrir kiosco',
        },
        {
            id: 'display',
            label: 'Sala web / TV',
            state: buildSmokeStepState(
                canonicalSurfaceMap.display?.ready,
                telemetryMap.display,
                clinicId,
                profileFingerprint
            ),
            detail:
                canonicalSurfaceMap.display?.ready &&
                getSurfaceTelemetryContractState(telemetryMap.display) ===
                    'alert'
                    ? getSurfaceTelemetryAlertDetail(
                          telemetryMap.display,
                          'Sala fuera del canon del piloto.'
                      )
                :
                canonicalSurfaceMap.display?.ready &&
                getSurfaceTelemetryClinicId(telemetryMap.display) &&
                getSurfaceTelemetryClinicId(telemetryMap.display) !==
                    clinicId.toLowerCase()
                    ? `Sala reporta clinic_id ${getSurfaceTelemetryClinicId(
                          telemetryMap.display
                      )}; corrige la TV antes del go-live.`
                : canonicalSurfaceMap.display?.ready &&
                  getSurfaceTelemetryProfileFingerprint(telemetryMap.display) &&
                  getSurfaceTelemetryProfileFingerprint(telemetryMap.display) !==
                      profileFingerprint
                    ? `Sala reporta firma ${getSurfaceTelemetryProfileFingerprint(
                          telemetryMap.display
                      )}; actualiza el perfil antes del go-live.`
                :
                canonicalSurfaceMap.display?.ready &&
                telemetryMap.display?.status === 'ready' &&
                telemetryMap.display?.stale !== true
                    ? `Sala lista: ${telemetryMap.display.summary || 'refleja llamado y audio activo.'}`
                    : canonicalSurfaceMap.display?.ready
                      ? `Falta validar la sala antes de abrir: ${telemetryMap.display?.summary || 'heartbeat no listo.'}`
                      : 'Falta declarar la ruta canónica de sala dentro del perfil del piloto.',
            href: canonicalSurfaceMap.display?.url || '',
            actionLabel: 'Abrir sala',
        },
        {
            id: 'end_to_end',
            label: 'Llamado final',
            state: smokeReady ? 'ready' : 'warning',
            detail: smokeReady
                ? 'Ya existe un llamado end-to-end reciente para cerrar el piloto web de la clínica.'
                : 'Cierra la secuencia con un llamado real o de prueba desde la cola antes de abrir la clínica.',
            href: canonicalSurfaceMap.admin?.url || '/admin.html#queue',
            actionLabel: 'Cerrar smoke',
        },
    ].map((step) => ({
        ...step,
        ready: step.state === 'ready',
    }));
    const smokeReadyCount = smokeSteps.filter((step) => step.ready).length;
    const smokeState = smokeSteps.every((step) => step.ready)
        ? 'ready'
        : smokeSteps.some((step) => step.state === 'alert')
          ? 'alert'
          : 'warning';
    const smokeSummary =
        smokeState === 'ready'
            ? `${clinicName} ya tiene una secuencia repetible de smoke web por clínica.`
            : smokeState === 'alert'
              ? 'La secuencia de smoke tiene bloqueos de perfil o rutas canónicas antes del go-live.'
              : 'La secuencia ya está armada; solo faltan validar superficies pendientes y cerrar el llamado final.';
    const smokeSupport =
        'Usa esta secuencia como checklist corto de apertura por clínica: admin, operador, kiosco, sala y llamado final.';
    const goLiveIssues = [];
    const addGoLiveIssue = (issue) => {
        if (!issue || !issue.id) {
            return;
        }
        if (goLiveIssues.some((entry) => entry.id === issue.id)) {
            return;
        }
        goLiveIssues.push(issue);
    };
    const readinessItemsById = Object.fromEntries(
        readinessItems.map((item) => [item.id, item])
    );

    if (!readinessItemsById.profile?.ready) {
        addGoLiveIssue(
            buildGoLiveIssue({
                id: 'profile',
                label: 'Perfil por clínica',
                state: 'alert',
                detail: readinessItemsById.profile?.detail,
                href: canonicalSurfaceMap.admin?.url || '/admin.html#queue',
                actionLabel: 'Abrir admin',
            })
        );
    }

    if (!readinessItemsById.publish?.ready) {
        addGoLiveIssue(
            buildGoLiveIssue({
                id: 'publish',
                label: 'Publicación verificable',
                state: readinessItemsById.publish?.blocker ? 'alert' : 'warning',
                detail: readinessItemsById.publish?.detail,
                href: '/api.php?resource=health',
                actionLabel: 'Ver health',
            })
        );
    }

    if (!readinessItemsById.health?.ready) {
        addGoLiveIssue(
            buildGoLiveIssue({
                id: 'health',
                label: 'Señal viva / heartbeats',
                state: readinessItemsById.health?.blocker ? 'alert' : 'warning',
                detail: readinessItemsById.health?.detail,
                href: canonicalSurfaceMap.admin?.url || '/admin.html#queue',
                actionLabel: 'Abrir cola',
            })
        );
    }

    if (!readinessItemsById.surfaces?.ready && canonicalSurfaceAlertCount === 0) {
        addGoLiveIssue(
            buildGoLiveIssue({
                id: 'surfaces',
                label: 'Superficies web canónicas',
                state: readinessItemsById.surfaces?.blocker ? 'alert' : 'warning',
                detail: readinessItemsById.surfaces?.detail,
                href: canonicalSurfaceMap.admin?.url || '/admin.html#queue',
                actionLabel: 'Revisar canon',
            })
        );
    }

    canonicalSurfaces
        .filter((surface) => surface.state === 'alert')
        .forEach((surface) => {
            addGoLiveIssue(
                buildGoLiveIssue({
                    id: `surface_${surface.id}`,
                    label: surface.label,
                    state: 'alert',
                    detail: surface.detail,
                    href: surface.url || canonicalSurfaceMap.admin?.url || '/admin.html#queue',
                    actionLabel: surface.url ? 'Abrir superficie' : 'Abrir admin',
                })
            );
        });

    if (!readinessItemsById.smoke?.ready) {
        const firstPendingSmokeStep = smokeSteps.find(
            (step) => !step.ready && step.href
        );
        addGoLiveIssue(
            buildGoLiveIssue({
                id: 'smoke',
                label: 'Smoke repetible',
                state: readinessItemsById.smoke?.blocker ? 'alert' : 'warning',
                detail: readinessItemsById.smoke?.detail,
                href:
                    firstPendingSmokeStep?.href ||
                    canonicalSurfaceMap.admin?.url ||
                    '/admin.html#queue',
                actionLabel:
                    firstPendingSmokeStep?.actionLabel || 'Cerrar smoke',
            })
        );
    }

    const goLiveBlockingCount = goLiveIssues.filter(
        (issue) => issue.state === 'alert'
    ).length;
    const goLiveIssueState =
        goLiveIssues.length === 0
            ? 'ready'
            : goLiveBlockingCount > 0
              ? 'alert'
              : 'warning';
    const goLiveSummary =
        goLiveIssues.length === 0
            ? `${clinicName} ya no tiene bloqueos de salida para el piloto web.`
            : goLiveBlockingCount > 0
              ? `${goLiveBlockingCount} bloqueo(s) siguen frenando el go-live de ${clinicName}.`
              : `${goLiveIssues.length} pendiente(s) menores todavía requieren cierre antes del go-live.`;
    const goLiveSupport =
        goLiveIssues.length === 0
            ? 'Usa este panel como semáforo corto antes de abrir otra clínica.'
            : 'Resuelve estos puntos en orden; el primer bloqueo debería salir antes de volver al smoke final.';
    const deployedCommit = formatShortCommit(publicSync?.deployedCommit || '');
    const profileSourceLabel =
        profileSource === 'remote'
            ? 'remoto verificado'
            : profile
              ? 'fallback local'
              : 'sin perfil';
    const firstGoLiveIssue =
        goLiveIssues.find((issue) => issue.id.startsWith('surface_')) ||
        goLiveIssues.find((issue) => issue.state === 'alert') ||
        goLiveIssues[0] ||
        null;
    const handoffItems = [
        {
            id: 'clinic',
            label: 'Clínica',
            value: `${clinicName} · ${clinicId}`,
        },
        {
            id: 'profile_source',
            label: 'Perfil',
            value: profileSourceLabel,
        },
        {
            id: 'release',
            label: 'Release',
            value: `web_pilot · basic · ${release?.separate_deploy === true ? 'deploy separado' : 'deploy sin aislar'}`,
        },
        {
            id: 'publish',
            label: 'Publicación',
            value: deployedCommit
                ? `${publicSync?.healthy ? 'commit' : 'estado'} ${deployedCommit}`
                : 'sin commit verificable',
        },
        {
            id: 'canon',
            label: 'Canon',
            value:
                canonicalSurfaceAlertCount > 0
                    ? `${canonicalSurfaceAlertCount} bloqueo(s) de ruta`
                    : `${canonicalSurfaceVerifiedCount}/${canonicalSurfaces.length} rutas verificadas`,
        },
        {
            id: 'blockers',
            label: 'Bloqueo activo',
            value: firstGoLiveIssue
                ? `${firstGoLiveIssue.label}: ${firstGoLiveIssue.detail}`
                : 'sin bloqueos activos',
        },
        {
            id: 'smoke',
            label: 'Smoke',
            value: `${smokeReadyCount}/${smokeSteps.length} pasos listos`,
        },
    ];
    const handoffSummary =
        readinessState === 'ready'
            ? `Paquete listo para compartir con ${clinicName}: el piloto ya tiene gate en verde, publicación verificable y secuencia repetible.`
            : `Paquete listo para handoff interno: comparte este resumen antes de abrir ${clinicName} para que todos usen el mismo estado del piloto.`;
    const handoffSupport =
        readinessState === 'ready'
            ? 'Usa “Copiar paquete” para pasar el estado del go-live con las rutas web activas de la clínica.'
            : 'Aunque el gate siga en warning o alert, este paquete resume exactamente qué falta antes del go-live.';
    const sharedPilotPayload = {
        progressPct,
        confirmedCount,
        suggestedCount,
        totalSteps: steps.length,
        readyEquipmentCount,
        issueCount,
        readinessState,
        readinessTitle,
        readinessSummary,
        readinessSupport,
        readinessBlockingCount,
        readinessItems,
        canonicalSurfaces,
        canonicalSupport,
        smokeState,
        smokeSummary,
        smokeSupport,
        smokeSteps,
        smokeReadyCount,
        handoffItems,
        handoffSummary,
        handoffSupport,
        goLiveIssueState,
        goLiveIssues,
        goLiveBlockingCount,
        goLiveSummary,
        goLiveSupport,
    };

    if (syncHealth.state === 'alert') {
        return {
            ...sharedPilotPayload,
            tone: 'alert',
            eyebrow: 'Siguiente paso',
            title: 'Resuelve la cola antes de abrir',
            summary:
                'Hay fallback o sincronización degradada. Prioriza el refresh de cola antes de validar hardware o instalación.',
            supportCopy:
                'Cuando el sync vuelva a vivo, el panel te devolverá el siguiente paso operativo.',
            primaryAction: {
                kind: 'button',
                id: 'queueOpsPilotRefreshBtn',
                action: 'queue-refresh-state',
                label: 'Refrescar cola ahora',
            },
            secondaryAction: {
                kind: 'anchor',
                href: '/admin.html#queue',
                label: 'Abrir cola admin',
            },
        };
    }

    if (suggestedCount > 0) {
        return {
            ...sharedPilotPayload,
            tone: 'suggested',
            eyebrow: 'Siguiente paso',
            title: `Confirma ${suggestedCount} paso(s) ya validados`,
            summary:
                pendingAfterSuggestions.length > 0
                    ? `${suggestedCount} paso(s) ya aparecen listos por heartbeat. Después te quedará ${pendingAfterSuggestions[0].title}.`
                    : 'El sistema ya detectó los pasos pendientes como listos. Confírmalos para cerrar la apertura.',
            supportCopy:
                'Usa este botón cuando ya confías en la telemetría y solo quieres avanzar sin recorrer el checklist uno por uno.',
            primaryAction: {
                kind: 'button',
                id: 'queueOpsPilotApplyBtn',
                label: `Confirmar sugeridos (${suggestedCount})`,
            },
            secondaryAction: pendingAfterSuggestions.length
                ? {
                      kind: 'anchor',
                      href: pendingAfterSuggestions[0].href,
                      label: pendingAfterSuggestions[0].actionLabel,
                  }
                : {
                      kind: 'anchor',
                      href: '/admin.html#queue',
                      label: 'Volver a la cola',
                  },
        };
    }

    if (pendingAfterSuggestions.length > 0) {
        return {
            ...sharedPilotPayload,
            tone: syncHealth.state === 'warning' ? 'warning' : 'active',
            eyebrow: 'Siguiente paso',
            title: `Siguiente paso: ${pendingAfterSuggestions[0].title}`,
            summary:
                pendingAfterSuggestions.length > 1
                    ? `Quedan ${pendingAfterSuggestions.length} validaciones manuales. Empieza por esta para mantener el flujo simple.`
                    : 'Solo queda una validación manual para dejar la apertura lista.',
            supportCopy: String(
                assist.suggestions[pendingAfterSuggestions[0].id]?.reason ||
                    pendingAfterSuggestions[0].hint ||
                    ''
            ),
            primaryAction: {
                kind: 'anchor',
                href: pendingAfterSuggestions[0].href,
                label: pendingAfterSuggestions[0].actionLabel,
            },
            secondaryAction:
                syncHealth.state === 'warning'
                    ? {
                          kind: 'button',
                          id: 'queueOpsPilotRefreshBtn',
                          action: 'queue-refresh-state',
                          label: 'Refrescar cola',
                      }
                    : {
                          kind: 'anchor',
                          href: '/admin.html#queue',
                          label: 'Abrir cola admin',
                      },
        };
    }

    return {
        ...sharedPilotPayload,
        tone: 'ready',
        eyebrow: 'Operación lista',
        title: 'Apertura completada',
        summary:
            'Operador, kiosco y sala ya están confirmados. Puedes seguir atendiendo o hacer un llamado de prueba final desde la cola.',
        supportCopy:
            'Si cambia un equipo a warning o alert, este panel volverá a priorizar la acción correcta.',
        primaryAction: {
            kind: 'anchor',
            href: '/admin.html#queue',
            label: 'Abrir cola admin',
        },
        secondaryAction: {
            kind: 'anchor',
            href: buildPreparedSurfaceUrl(
                'operator',
                manifest.operator || defaultAppDownloads.operator,
                {
                    ...ensureInstallPreset(detectedPlatform),
                    surface: 'operator',
                }
            ),
            label: 'Abrir operador',
        },
    };
}
