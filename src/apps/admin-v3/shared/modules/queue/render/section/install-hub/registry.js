function isObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeId(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeList(value) {
    return Array.isArray(value)
        ? value.map((item) => normalizeText(item)).filter(Boolean)
        : [];
}

function trimSlashes(value) {
    return normalizeText(value).replace(/^\/+|\/+$/g, '');
}

const FALLBACK_INSTALL_HUB_REGISTRY = Object.freeze({
    defaults: {
        channel: 'stable',
        version: '0.1.0',
        downloadBasePath: '/app-downloads/',
    },
    surfaces: [
        {
            id: 'operator',
            family: 'desktop',
            productName: 'Turnero Operador',
            webFallbackUrl: '/operador-turnos.html',
            guideUrl: '/app-downloads/?surface=operator',
            targets: {
                win: {
                    label: 'Windows',
                    downloadPath: 'operator/win',
                    manualFile: 'TurneroOperadorSetup.exe',
                },
                mac: {
                    label: 'macOS',
                    downloadPath: 'operator/mac',
                    manualFile: 'TurneroOperador.dmg',
                },
            },
        },
        {
            id: 'kiosk',
            family: 'desktop',
            productName: 'Turnero Kiosco',
            webFallbackUrl: '/kiosco-turnos.html',
            guideUrl: '/app-downloads/?surface=kiosk',
            targets: {
                win: {
                    label: 'Windows',
                    downloadPath: 'kiosk/win',
                    manualFile: 'TurneroKioscoSetup.exe',
                },
                mac: {
                    label: 'macOS',
                    downloadPath: 'kiosk/mac',
                    manualFile: 'TurneroKiosco.dmg',
                },
            },
        },
        {
            id: 'sala_tv',
            family: 'android',
            productName: 'Turnero Sala TV',
            webFallbackUrl: '/sala-turnos.html',
            guideUrl: '/app-downloads/?surface=sala_tv',
            targets: {
                android_tv: {
                    label: 'Android TV APK',
                    downloadPath: 'sala-tv/android',
                    manualFile: 'TurneroSalaTV.apk',
                },
            },
        },
    ],
});

function buildDownloadUrl(defaults, channel, target) {
    const downloadPath = normalizeText(target.downloadPath);
    const manualFile = normalizeText(target.manualFile);
    if (downloadPath === '' || manualFile === '') {
        return '';
    }

    return `/${trimSlashes(defaults.downloadBasePath)}/${normalizeText(
        channel
    )}/${trimSlashes(downloadPath)}/${manualFile}`;
}

function normalizeRegistry(payload) {
    const source = isObject(payload) ? payload : {};
    const defaults = isObject(source.defaults) ? source.defaults : {};
    const surfaces = Array.isArray(source.surfaces) ? source.surfaces : [];
    const normalizedDefaults = {
        channel: normalizeText(defaults.channel) || 'stable',
        version: normalizeText(defaults.version) || '0.1.0',
        downloadBasePath:
            normalizeText(defaults.downloadBasePath) || '/app-downloads/',
    };
    const surfaceOrder = [];
    const surfaceMap = {};
    const appDownloads = {};

    surfaces.forEach((surface) => {
        const normalizedSurface = isObject(surface) ? surface : {};
        const surfaceId = normalizeId(normalizedSurface.id);
        if (surfaceId === '') {
            return;
        }

        const family = normalizeId(normalizedSurface.family);
        const catalog = isObject(normalizedSurface.catalog)
            ? normalizedSurface.catalog
            : {};
        const ops = isObject(normalizedSurface.ops)
            ? normalizedSurface.ops
            : {};
        const installHub = isObject(ops.installHub) ? ops.installHub : {};
        const telemetry = isObject(ops.telemetry) ? ops.telemetry : {};
        const targets = isObject(normalizedSurface.targets)
            ? normalizedSurface.targets
            : {};
        const targetOrder = Object.keys(targets);
        const channel =
            normalizeText(normalizedSurface.updateChannel) ||
            normalizedDefaults.channel;
        const downloadTargets = {};

        targetOrder.forEach((targetKey) => {
            const target = isObject(targets[targetKey])
                ? targets[targetKey]
                : {};
            downloadTargets[targetKey] = {
                label: normalizeText(target.label) || targetKey,
                url: buildDownloadUrl(normalizedDefaults, channel, target),
            };
        });

        const productName =
            normalizeText(normalizedSurface.productName) || surfaceId;
        surfaceOrder.push(surfaceId);
        surfaceMap[surfaceId] = {
            id: surfaceId,
            family,
            targetOrder,
            telemetryKey: surfaceId === 'sala_tv' ? 'display' : surfaceId,
            webFallbackUrl:
                normalizeText(normalizedSurface.webFallbackUrl) || '/',
            guideUrl:
                normalizeText(normalizedSurface.guideUrl) ||
                `/app-downloads/?surface=${surfaceId}`,
            cardCopy: {
                eyebrow:
                    normalizeText(installHub.eyebrow) ||
                    normalizeText(catalog.eyebrow) ||
                    productName,
                title:
                    normalizeText(installHub.title) ||
                    normalizeText(catalog.title) ||
                    productName,
                description:
                    normalizeText(installHub.description) ||
                    normalizeText(catalog.description),
                recommendedFor:
                    normalizeText(installHub.recommendedFor) ||
                    (family === 'android'
                        ? 'Pantalla dedicada'
                        : 'Equipo dedicado'),
                notes:
                    normalizeList(installHub.notes).length > 0
                        ? normalizeList(installHub.notes)
                        : normalizeList(catalog.notes),
            },
            telemetryCopy: {
                title:
                    normalizeText(telemetry.title) ||
                    normalizeText(installHub.title) ||
                    normalizeText(catalog.title) ||
                    productName,
                emptySummary:
                    normalizeText(telemetry.emptySummary) ||
                    'Sin senal todavia.',
            },
        };
        appDownloads[surfaceId] = {
            version: normalizedDefaults.version,
            updatedAt: '',
            webFallbackUrl: surfaceMap[surfaceId].webFallbackUrl,
            guideUrl: surfaceMap[surfaceId].guideUrl,
            targets: downloadTargets,
        };
    });

    return {
        defaults: normalizedDefaults,
        surfaceOrder,
        surfaces: surfaceMap,
        appDownloads,
    };
}

function normalizeRuntimePayload(payload) {
    const source = isObject(payload) ? payload : {};
    const surfaces = isObject(source.surfaces) ? source.surfaces : {};
    const catalogSource = isObject(source.catalog) ? source.catalog : source;
    const surfaceOrder = Object.keys(surfaces).map((surfaceId) =>
        normalizeId(surfaceId)
    );

    if (surfaceOrder.length === 0) {
        return null;
    }

    const snapshot = {
        defaults: {
            channel: 'stable',
            version: '0.1.0',
            downloadBasePath: '/app-downloads/',
        },
        surfaceOrder: [],
        surfaces: {},
        appDownloads: {},
    };

    surfaceOrder.forEach((surfaceId) => {
        const surface = isObject(surfaces[surfaceId])
            ? surfaces[surfaceId]
            : {};
        const catalog = isObject(surface.catalog) ? surface.catalog : {};
        const ops = isObject(surface.ops) ? surface.ops : {};
        const installHub = isObject(ops.installHub) ? ops.installHub : {};
        const telemetry = isObject(ops.telemetry) ? ops.telemetry : {};
        const appConfig = isObject(catalogSource[surfaceId])
            ? catalogSource[surfaceId]
            : {};
        const targets = isObject(appConfig.targets) ? appConfig.targets : {};
        const requestedTargetOrder = Array.isArray(surface.targetOrder)
            ? surface.targetOrder.map((targetKey) => normalizeId(targetKey))
            : [];
        const targetOrder =
            requestedTargetOrder.length > 0
                ? requestedTargetOrder.filter((targetKey) =>
                      Boolean(targets[targetKey])
                  )
                : Object.keys(targets).map((targetKey) =>
                      normalizeId(targetKey)
                  );
        const productName =
            normalizeText(catalog.title) ||
            normalizeText(surface.id) ||
            surfaceId;

        snapshot.surfaceOrder.push(surfaceId);
        snapshot.surfaces[surfaceId] = {
            id: surfaceId,
            family: normalizeId(surface.family),
            targetOrder,
            telemetryKey: surfaceId === 'sala_tv' ? 'display' : surfaceId,
            webFallbackUrl:
                normalizeText(surface.webFallbackUrl) ||
                normalizeText(appConfig.webFallbackUrl) ||
                '/',
            guideUrl:
                normalizeText(surface.guideUrl) ||
                normalizeText(appConfig.guideUrl) ||
                `/app-downloads/?surface=${surfaceId}`,
            cardCopy: {
                eyebrow:
                    normalizeText(installHub.eyebrow) ||
                    normalizeText(catalog.eyebrow) ||
                    productName,
                title:
                    normalizeText(installHub.title) ||
                    normalizeText(catalog.title) ||
                    productName,
                description:
                    normalizeText(installHub.description) ||
                    normalizeText(catalog.description),
                recommendedFor:
                    normalizeText(installHub.recommendedFor) ||
                    (normalizeId(surface.family) === 'android'
                        ? 'Pantalla dedicada'
                        : 'Equipo dedicado'),
                notes:
                    normalizeList(installHub.notes).length > 0
                        ? normalizeList(installHub.notes)
                        : normalizeList(catalog.notes),
            },
            telemetryCopy: {
                title:
                    normalizeText(telemetry.title) ||
                    normalizeText(installHub.title) ||
                    normalizeText(catalog.title) ||
                    productName,
                emptySummary:
                    normalizeText(telemetry.emptySummary) ||
                    'Sin senal todavia.',
            },
        };
        snapshot.appDownloads[surfaceId] = {
            version:
                normalizeText(appConfig.version) || snapshot.defaults.version,
            updatedAt: normalizeText(appConfig.updatedAt),
            webFallbackUrl: snapshot.surfaces[surfaceId].webFallbackUrl,
            guideUrl: snapshot.surfaces[surfaceId].guideUrl,
            targets,
        };
    });

    return snapshot;
}

const fallbackRegistrySnapshot = normalizeRegistry(
    FALLBACK_INSTALL_HUB_REGISTRY
);
let activeRegistrySnapshot = fallbackRegistrySnapshot;
let registryLoadPromise = null;
let registryLoadedFromNetwork = false;
let registryLoadSettled = false;

function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}

export function getInstallHubFallbackSnapshot() {
    return cloneValue(fallbackRegistrySnapshot);
}

export function getInstallHubSurfaceOrder() {
    return [...activeRegistrySnapshot.surfaceOrder];
}

export function getInstallHubSurfaceDefinition(surfaceKey) {
    return activeRegistrySnapshot.surfaces[normalizeId(surfaceKey)] || null;
}

export function resolveInstallHubSurfaceIdByTelemetryKey(surfaceKey) {
    const requestedKey = normalizeId(surfaceKey);
    if (requestedKey === '') {
        return '';
    }

    return (
        Object.values(activeRegistrySnapshot.surfaces).find(
            (surface) => surface.telemetryKey === requestedKey
        )?.id || ''
    );
}

export function getInstallHubSurfaceCardCopy(surfaceKey) {
    return (
        getInstallHubSurfaceDefinition(surfaceKey)?.cardCopy || {
            eyebrow: normalizeText(surfaceKey),
            title: normalizeText(surfaceKey),
            description: '',
            recommendedFor: 'Equipo dedicado',
            notes: [],
        }
    );
}

export function getInstallHubSurfaceTelemetryCopy(surfaceKey) {
    const directMatch = getInstallHubSurfaceDefinition(surfaceKey);
    if (directMatch) {
        return directMatch.telemetryCopy;
    }

    const resolvedSurfaceId =
        resolveInstallHubSurfaceIdByTelemetryKey(surfaceKey);
    return (
        getInstallHubSurfaceDefinition(resolvedSurfaceId)?.telemetryCopy || {
            title: normalizeText(surfaceKey),
            emptySummary: 'Sin senal todavia.',
        }
    );
}

export function getInstallHubDefaultAppDownloads() {
    return activeRegistrySnapshot.appDownloads;
}

export function syncInstallHubRuntimePayload(payload) {
    const snapshot = normalizeRuntimePayload(payload);
    if (!snapshot) {
        return false;
    }

    activeRegistrySnapshot = snapshot;
    registryLoadSettled = true;
    return true;
}

export function ensureInstallHubRegistryLoaded(onLoaded) {
    if (registryLoadSettled) {
        return Promise.resolve(activeRegistrySnapshot);
    }

    if (registryLoadPromise !== null) {
        return registryLoadPromise;
    }

    if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
        return Promise.resolve(activeRegistrySnapshot);
    }

    registryLoadPromise = window
        .fetch('/data/turnero-surfaces.json', {
            cache: 'no-store',
            credentials: 'same-origin',
        })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`registry_http_${response.status}`);
            }
            return response.json();
        })
        .then((payload) => {
            activeRegistrySnapshot = normalizeRegistry(payload);
            registryLoadedFromNetwork = true;
            registryLoadSettled = true;
            if (typeof onLoaded === 'function') {
                onLoaded();
            }
            return activeRegistrySnapshot;
        })
        .catch(() => {
            registryLoadSettled = true;
            return activeRegistrySnapshot;
        })
        .finally(() => {
            registryLoadPromise = null;
        });

    return registryLoadPromise;
}
