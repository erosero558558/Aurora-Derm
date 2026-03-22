import {
    getTurneroClinicBrandName,
    getTurneroClinicProfileRuntimeMeta,
    getTurneroClinicReadiness,
    getTurneroClinicShortName,
    getTurneroPilotOpeningPackage,
    getTurneroReleaseMode,
    normalizeTurneroClinicProfile,
} from './turnero-runtime-contract.mjs';

const ADMIN_QUEUE_STORAGE_PREFIX = 'adminQueueClinicScopedV1';
const ADMIN_QUEUE_LEGACY_STORAGE_KEYS = Object.freeze([
    ['adminQueueStationMode', 'stationMode'],
    ['adminQueuePracticeMode', 'practiceMode'],
    ['adminQueueFilter', 'filter'],
]);

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function escapeHtml(value) {
    return String(value || '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function getCurrentRoute() {
    if (
        typeof window === 'undefined' ||
        !window.location ||
        typeof window.location !== 'object'
    ) {
        return '';
    }

    return `${window.location.pathname || ''}${window.location.hash || ''}`;
}

function getDefaultStorage(storage) {
    if (storage && typeof storage.getItem === 'function') {
        return storage;
    }
    if (
        typeof window !== 'undefined' &&
        window.localStorage &&
        typeof window.localStorage.getItem === 'function'
    ) {
        return window.localStorage;
    }
    return null;
}

export function buildAdminQueueClinicScopedStorageKey(profile, key) {
    const normalizedProfile = normalizeTurneroClinicProfile(profile);
    const clinicId = toString(normalizedProfile.clinic_id, 'default-clinic');
    const safeKey = toString(key, 'state');
    return `${ADMIN_QUEUE_STORAGE_PREFIX}:${clinicId}:${safeKey}`;
}

export function readAdminQueueClinicScopedStorage(
    profile,
    key,
    storage = null
) {
    const activeStorage = getDefaultStorage(storage);
    if (!activeStorage) {
        return null;
    }

    try {
        return activeStorage.getItem(
            buildAdminQueueClinicScopedStorageKey(profile, key)
        );
    } catch (_error) {
        return null;
    }
}

export function writeAdminQueueClinicScopedStorage(
    profile,
    key,
    value,
    storage = null
) {
    const activeStorage = getDefaultStorage(storage);
    if (!activeStorage) {
        return false;
    }

    try {
        activeStorage.setItem(
            buildAdminQueueClinicScopedStorageKey(profile, key),
            String(value ?? '')
        );
        return true;
    } catch (_error) {
        return false;
    }
}

export function migrateAdminQueueStorageKey(
    profile,
    legacyKey,
    nextKey,
    storage = null
) {
    const activeStorage = getDefaultStorage(storage);
    const scopedKey = buildAdminQueueClinicScopedStorageKey(profile, nextKey);
    if (!activeStorage) {
        return { migrated: false, scopedKey, reason: 'storage_unavailable' };
    }

    try {
        const existingScoped = activeStorage.getItem(scopedKey);
        if (existingScoped) {
            return { migrated: false, scopedKey, reason: 'scoped_exists' };
        }

        const legacyValue = activeStorage.getItem(String(legacyKey || ''));
        if (!legacyValue) {
            return { migrated: false, scopedKey, reason: 'legacy_missing' };
        }

        activeStorage.setItem(scopedKey, legacyValue);
        return { migrated: true, scopedKey, reason: 'ok' };
    } catch (_error) {
        return { migrated: false, scopedKey, reason: 'storage_error' };
    }
}

export function migrateAdminQueueClinicScopedStorage(profile, storage = null) {
    const activeStorage = getDefaultStorage(storage);
    if (!activeStorage) {
        return [];
    }

    return ADMIN_QUEUE_LEGACY_STORAGE_KEYS.map(([legacyKey, nextKey]) =>
        migrateAdminQueueStorageKey(profile, legacyKey, nextKey, activeStorage)
    );
}

function buildSurfaceTag(surface) {
    const reason = String(
        surface?.reason || surface?.contract?.reason || ''
    ).trim();
    const stateLabel = surface.ready
        ? 'Lista'
        : reason === 'route_mismatch'
          ? 'Ruta'
          : reason === 'profile_missing'
            ? 'Perfil'
            : reason === 'disabled'
              ? 'Off'
              : 'Bloquea';

    return {
        state: surface.ready
            ? 'ready'
            : reason === 'route_mismatch'
              ? 'warning'
              : 'alert',
        label: `${surface.label} · ${stateLabel}`,
    };
}

function buildCurrentRoutes(options = {}) {
    const currentSurface = toString(options.currentSurface, 'admin') || 'admin';
    const currentRoute = toString(options.currentRoute, '');
    const routeBySurface =
        options.routeBySurface && typeof options.routeBySurface === 'object'
            ? { ...options.routeBySurface }
            : {};

    if (currentRoute) {
        routeBySurface[currentSurface] = currentRoute;
    }

    return routeBySurface;
}

export function createAdminQueuePilotReadinessViewModel(profile, options = {}) {
    const normalizedProfile = normalizeTurneroClinicProfile(profile);
    const currentRoute = toString(options.currentRoute, getCurrentRoute());
    const routeBySurface = buildCurrentRoutes({
        currentSurface: 'admin',
        currentRoute,
        routeBySurface: options.routeBySurface,
    });
    const openingPackage = getTurneroPilotOpeningPackage(profile, {
        currentRoutes: routeBySurface,
        trustedProfileFingerprint: options.trustedProfileFingerprint,
    });
    const readiness = getTurneroClinicReadiness(profile, {
        currentRoutes: routeBySurface,
        trustedProfileFingerprint: options.trustedProfileFingerprint,
    });
    const runtimeMeta = getTurneroClinicProfileRuntimeMeta(profile);
    const finalStatus = openingPackage.blocked
        ? 'blocked'
        : readiness.state === 'warning'
          ? 'warning'
          : 'ready';
    const readinessState =
        finalStatus === 'blocked' ? 'alert' : readiness.state;
    const surfaces = Array.isArray(readiness.surfaces)
        ? readiness.surfaces.map((surface) => ({
              ...surface,
              badge: buildSurfaceTag(surface),
          }))
        : [];

    return {
        clinicId: openingPackage.clinicId,
        clinicName:
            openingPackage.clinicName ||
            getTurneroClinicBrandName(normalizedProfile),
        clinicShortName:
            openingPackage.clinicShortName ||
            getTurneroClinicShortName(normalizedProfile),
        profileSource: openingPackage.runtimeSource || runtimeMeta.source,
        profileFingerprint:
            openingPackage.profileFingerprint || runtimeMeta.profileFingerprint,
        releaseMode:
            openingPackage.releaseMode ||
            getTurneroReleaseMode(normalizedProfile),
        adminModeDefault: openingPackage.adminModeDefault,
        runtimeSource: runtimeMeta.source,
        readinessState,
        finalStatus,
        finalLabel:
            finalStatus === 'blocked'
                ? 'bloqueado'
                : finalStatus === 'warning'
                  ? 'aviso'
                  : 'listo',
        blockers: Array.isArray(openingPackage.blockers)
            ? openingPackage.blockers
            : Array.isArray(readiness.blockers)
              ? readiness.blockers
              : [],
        warnings: Array.isArray(readiness.warnings) ? readiness.warnings : [],
        readiness,
        openingPackage,
        summary:
            finalStatus === 'blocked'
                ? `${readiness.summary} · ${openingPackage.blockers.length} bloqueo(s)`
                : readiness.summary,
        metaLine: [
            openingPackage.clinicName ||
                getTurneroClinicBrandName(normalizedProfile),
            openingPackage.clinicId,
            openingPackage.runtimeSource || runtimeMeta.source,
            `release ${openingPackage.releaseMode || getTurneroReleaseMode(normalizedProfile)}`,
        ]
            .filter(Boolean)
            .join(' · '),
        surfaces,
    };
}

export function renderAdminQueuePilotReadinessCard(profile, options = {}) {
    const vm = createAdminQueuePilotReadinessViewModel(profile, options);
    const stateToken = vm.readinessState || 'ready';
    const summaryTone =
        stateToken === 'alert'
            ? 'alert'
            : stateToken === 'warning'
              ? 'warning'
              : 'ready';
    const statusTag = `finalStatus: ${vm.finalStatus}`;
    const surfaceTags = vm.surfaces
        .map(
            (surface) =>
                `<span class="queue-app-card__tag" data-state="${escapeHtml(
                    surface.badge.state
                )}">${escapeHtml(surface.badge.label)}</span>`
        )
        .join('');
    const statusNotes = [
        ['clinic_id', vm.clinicId],
        ['profileFingerprint', vm.profileFingerprint],
        ['releaseMode', vm.releaseMode],
        ['runtime', vm.runtimeSource],
        [
            'superficies',
            `${vm.readiness.readyCount}/${vm.readiness.totalCount} listas`,
        ],
        ['finalStatus', vm.finalStatus],
    ]
        .map(
            ([label, value]) =>
                `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(
                    value
                )}</li>`
        )
        .join('');
    const blockerItems = vm.blockers
        .map(
            (blocker) =>
                `<li><strong>${escapeHtml(blocker.title)}</strong><br><span>${escapeHtml(
                    blocker.detail
                )}</span></li>`
        )
        .join('');
    const warningItems = vm.warnings
        .map((warning) => `<li>${escapeHtml(warning)}</li>`)
        .join('');
    const detailBlock =
        vm.blockers.length > 0
            ? `<ul class="queue-app-card__notes">${blockerItems}</ul>`
            : vm.warnings.length > 0
              ? `<ul class="queue-app-card__notes">${warningItems}</ul>`
              : `<p class="queue-app-card__meta">Paquete de apertura listo para operar.</p>`;

    return `
        <article class="queue-app-card admin-queue-pilot-readiness" data-state="${escapeHtml(
            summaryTone
        )}" data-final-status="${escapeHtml(vm.finalStatus)}">
            <div>
                <p class="queue-app-card__eyebrow">Turnero web por clínica</p>
                <h5 class="queue-app-card__title">Admin queue · ${escapeHtml(
                    vm.clinicShortName
                )}</h5>
                <p class="queue-app-card__description">${escapeHtml(
                    vm.summary
                )}</p>
            </div>
            <span class="queue-app-card__tag" data-state="${escapeHtml(
                vm.finalStatus
            )}">${escapeHtml(statusTag)}</span>
            <p class="queue-app-card__meta">${escapeHtml(vm.metaLine)}</p>
            <ul class="queue-app-card__notes">${statusNotes}</ul>
            <div class="queue-app-card__targets">${surfaceTags}</div>
            ${detailBlock}
            <div class="queue-app-card__links">
                <a href="#queueOpeningChecklist">Abrir checklist</a>
                <a href="#queueOpsPilot">Ver queueOpsPilot</a>
            </div>
        </article>
    `.trim();
}

export function upsertAdminQueuePilotReadinessCard(
    target,
    profile,
    options = {}
) {
    const activeStorage = getDefaultStorage(options.storage);
    migrateAdminQueueClinicScopedStorage(profile, activeStorage);

    if (
        typeof HTMLElement === 'undefined' ||
        !(target instanceof HTMLElement)
    ) {
        return null;
    }

    target.innerHTML = renderAdminQueuePilotReadinessCard(profile, {
        ...options,
        storage: activeStorage,
    });
    return target.querySelector('.admin-queue-pilot-readiness');
}

export function mountAdminQueuePilotReadinessCard(profile, options = {}) {
    if (typeof document === 'undefined') {
        return null;
    }

    const host =
        document.querySelector('[data-turnero-pilot-readiness]') ||
        document.getElementById('queuePilotReadinessCard') ||
        document.getElementById('turneroPilotReadinessCard');

    if (typeof HTMLElement === 'undefined' || !(host instanceof HTMLElement)) {
        return null;
    }

    return upsertAdminQueuePilotReadinessCard(host, profile, options);
}
