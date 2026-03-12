'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REGISTRY_PATH = path.resolve(
    __dirname,
    '..',
    'data',
    'turnero-surfaces.json'
);
const DEFAULT_DESKTOP_SURFACE_ID = 'operator';

function normalizeString(value) {
    return String(value || '').trim();
}

function normalizeId(value) {
    return normalizeString(value).toLowerCase();
}

function trimSlashes(value) {
    return normalizeString(value).replace(/^\/+|\/+$/g, '');
}

function ensureRegistryShape(payload, registryPath) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`Registry turnero invalido: ${registryPath}`);
    }

    const surfaces = Array.isArray(payload.surfaces) ? payload.surfaces : [];
    if (surfaces.length === 0) {
        throw new Error(`Registry turnero sin superficies: ${registryPath}`);
    }

    return {
        schema: normalizeString(payload.schema),
        defaults:
            payload.defaults && typeof payload.defaults === 'object'
                ? payload.defaults
                : {},
        surfaces,
    };
}

function readTurneroSurfaceRegistry(registryPath = REGISTRY_PATH) {
    const resolvedPath = path.resolve(registryPath);
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    const registry = ensureRegistryShape(parsed, resolvedPath);

    return {
        path: resolvedPath,
        schema: registry.schema,
        defaults: {
            channel: normalizeString(registry.defaults.channel) || 'stable',
            version: normalizeString(registry.defaults.version) || '0.1.0',
            baseUrl:
                normalizeString(registry.defaults.baseUrl) ||
                'https://pielarmonia.com',
            downloadBasePath:
                normalizeString(registry.defaults.downloadBasePath) ||
                '/app-downloads/',
            updateBasePath:
                normalizeString(registry.defaults.updateBasePath) ||
                '/desktop-updates/',
        },
        surfaces: registry.surfaces.map((surface) =>
            normalizeTurneroSurfaceDefinition(surface)
        ),
    };
}

function normalizeTurneroSurfaceDefinition(surface) {
    const normalizedSurface =
        surface && typeof surface === 'object' ? surface : {};
    const targets =
        normalizedSurface.targets &&
        typeof normalizedSurface.targets === 'object'
            ? normalizedSurface.targets
            : {};
    const ops =
        normalizedSurface.ops && typeof normalizedSurface.ops === 'object'
            ? normalizedSurface.ops
            : {};
    const installHubOps =
        ops.installHub && typeof ops.installHub === 'object'
            ? ops.installHub
            : {};
    const telemetryOps =
        ops.telemetry && typeof ops.telemetry === 'object' ? ops.telemetry : {};

    return {
        ...normalizedSurface,
        id: normalizeId(normalizedSurface.id),
        family: normalizeId(normalizedSurface.family),
        route: normalizeString(normalizedSurface.route),
        productName: normalizeString(normalizedSurface.productName),
        artifactBase: normalizeString(normalizedSurface.artifactBase),
        executableName: normalizeString(normalizedSurface.executableName),
        appId: normalizeString(normalizedSurface.appId),
        webFallbackUrl: normalizeString(normalizedSurface.webFallbackUrl),
        guideUrl: normalizeString(normalizedSurface.guideUrl),
        updateChannel:
            normalizeString(normalizedSurface.updateChannel) || 'stable',
        catalog:
            normalizedSurface.catalog &&
            typeof normalizedSurface.catalog === 'object'
                ? normalizedSurface.catalog
                : {},
        ops: {
            installHub: {
                eyebrow: normalizeString(installHubOps.eyebrow),
                title: normalizeString(installHubOps.title),
                description: normalizeString(installHubOps.description),
                recommendedFor: normalizeString(installHubOps.recommendedFor),
                notes: Array.isArray(installHubOps.notes)
                    ? installHubOps.notes
                          .map((note) => normalizeString(note))
                          .filter(Boolean)
                    : [],
            },
            telemetry: {
                title: normalizeString(telemetryOps.title),
                emptySummary: normalizeString(telemetryOps.emptySummary),
            },
        },
        launchDefaults:
            normalizedSurface.launchDefaults &&
            typeof normalizedSurface.launchDefaults === 'object'
                ? normalizedSurface.launchDefaults
                : {},
        release:
            normalizedSurface.release &&
            typeof normalizedSurface.release === 'object'
                ? normalizedSurface.release
                : {},
        desktop:
            normalizedSurface.desktop &&
            typeof normalizedSurface.desktop === 'object'
                ? normalizedSurface.desktop
                : {},
        android:
            normalizedSurface.android &&
            typeof normalizedSurface.android === 'object'
                ? normalizedSurface.android
                : {},
        targets: Object.fromEntries(
            Object.entries(targets).map(([targetKey, target]) => [
                normalizeId(targetKey),
                {
                    ...(target && typeof target === 'object' ? target : {}),
                    label: normalizeString(target?.label),
                    downloadPath: normalizeString(target?.downloadPath),
                    manualFile: normalizeString(target?.manualFile),
                    updatePath: normalizeString(target?.updatePath),
                    updateFile: normalizeString(target?.updateFile),
                    feedFile: normalizeString(target?.feedFile),
                },
            ])
        ),
    };
}

function getTurneroRegistryDefaults(options = {}) {
    return readTurneroSurfaceRegistry(options.registryPath).defaults;
}

function listTurneroSurfaceDefinitions(options = {}) {
    const registry = readTurneroSurfaceRegistry(options.registryPath);
    const family = normalizeId(options.family);
    return registry.surfaces.filter(
        (surface) => family === '' || surface.family === family
    );
}

function getTurneroSurfaceDefinition(id, options = {}) {
    const requestedId = normalizeId(id);
    return (
        listTurneroSurfaceDefinitions(options).find(
            (surface) => surface.id === requestedId
        ) || null
    );
}

function getTurneroSurfaceMap(options = {}) {
    const surfaces = listTurneroSurfaceDefinitions(options);
    return Object.fromEntries(surfaces.map((surface) => [surface.id, surface]));
}

function normalizeTurneroSurfaceId(id, options = {}) {
    const fallback = normalizeId(
        options.fallback || DEFAULT_DESKTOP_SURFACE_ID
    );
    const family = normalizeId(options.family);
    const requestedId = normalizeId(id);
    const registryOptions = family === '' ? options : { ...options, family };
    const allowedIds = new Set(
        listTurneroSurfaceDefinitions(registryOptions).map(
            (surface) => surface.id
        )
    );

    if (requestedId !== '' && allowedIds.has(requestedId)) {
        return requestedId;
    }
    if (allowedIds.has(fallback)) {
        return fallback;
    }

    return Array.from(allowedIds)[0] || fallback;
}

function listTurneroTargetKeys(surfaceOrId, options = {}) {
    const surface = resolveSurface(surfaceOrId, options);
    return Object.keys(surface.targets || {});
}

function getTurneroDefaultTargetKey(surfaceOrId, options = {}) {
    const surface = resolveSurface(surfaceOrId, options);
    const requestedKey = normalizeId(options.targetKey);
    const targetKeys = listTurneroTargetKeys(surface, options);

    if (requestedKey !== '' && targetKeys.includes(requestedKey)) {
        return requestedKey;
    }
    if (surface.family === 'desktop' && targetKeys.includes('win')) {
        return 'win';
    }
    if (targetKeys.length === 1) {
        return targetKeys[0];
    }
    return targetKeys[0] || '';
}

function getTurneroTargetDefinition(surfaceOrId, targetKey, options = {}) {
    const surface = resolveSurface(surfaceOrId, options);
    const resolvedKey = getTurneroDefaultTargetKey(surface, {
        ...options,
        targetKey,
    });
    return surface.targets[resolvedKey] || null;
}

function resolveTurneroChannel(surfaceOrId, channel, options = {}) {
    const surface = resolveSurface(surfaceOrId, options);
    return normalizeString(channel) || surface.updateChannel || 'stable';
}

function resolveTurneroDownloadRelativePath(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const surface = resolveSurface(surfaceOrId, options);
    const target = getTurneroTargetDefinition(surface, targetKey, options);
    if (!target || target.downloadPath === '' || target.manualFile === '') {
        return '';
    }
    return `${resolveTurneroChannel(surface, options.channel, options)}/${trimSlashes(
        target.downloadPath
    )}/${target.manualFile}`;
}

function resolveTurneroDownloadPublicPath(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const relativePath = resolveTurneroDownloadRelativePath(
        surfaceOrId,
        targetKey,
        options
    );
    if (relativePath === '') {
        return '';
    }
    const defaults = getTurneroRegistryDefaults(options);
    return `/${trimSlashes(defaults.downloadBasePath)}/${relativePath}`;
}

function resolveTurneroUpdateRelativeDirectory(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const surface = resolveSurface(surfaceOrId, options);
    const target = getTurneroTargetDefinition(surface, targetKey, options);
    if (!target || target.updatePath === '') {
        return '';
    }
    return `${resolveTurneroChannel(surface, options.channel, options)}/${trimSlashes(
        target.updatePath
    )}/`;
}

function resolveTurneroUpdateRelativeFeedPath(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const relativeDir = resolveTurneroUpdateRelativeDirectory(
        surfaceOrId,
        targetKey,
        options
    );
    const target = getTurneroTargetDefinition(surfaceOrId, targetKey, options);
    if (relativeDir === '' || !target || target.feedFile === '') {
        return '';
    }
    return `${relativeDir}${target.feedFile}`;
}

function resolveTurneroUpdateRelativePayloadPath(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const relativeDir = resolveTurneroUpdateRelativeDirectory(
        surfaceOrId,
        targetKey,
        options
    );
    const target = getTurneroTargetDefinition(surfaceOrId, targetKey, options);
    if (relativeDir === '' || !target || target.updateFile === '') {
        return '';
    }
    return `${relativeDir}${target.updateFile}`;
}

function resolveTurneroUpdatePublicDirectory(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const relativePath = resolveTurneroUpdateRelativeDirectory(
        surfaceOrId,
        targetKey,
        options
    );
    if (relativePath === '') {
        return '';
    }
    const defaults = getTurneroRegistryDefaults(options);
    return `/${trimSlashes(defaults.updateBasePath)}/${relativePath}`;
}

function resolveTurneroUpdatePublicFeedPath(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const relativePath = resolveTurneroUpdateRelativeFeedPath(
        surfaceOrId,
        targetKey,
        options
    );
    if (relativePath === '') {
        return '';
    }
    const defaults = getTurneroRegistryDefaults(options);
    return `/${trimSlashes(defaults.updateBasePath)}/${relativePath}`;
}

function resolveTurneroUpdatePublicPayloadPath(
    surfaceOrId,
    targetKey,
    options = {}
) {
    const relativePath = resolveTurneroUpdateRelativePayloadPath(
        surfaceOrId,
        targetKey,
        options
    );
    if (relativePath === '') {
        return '';
    }
    const defaults = getTurneroRegistryDefaults(options);
    return `/${trimSlashes(defaults.updateBasePath)}/${relativePath}`;
}

function buildTurneroCatalogDefaults(options = {}) {
    const registry = readTurneroSurfaceRegistry(options.registryPath);
    const version =
        normalizeString(options.version) || registry.defaults.version;
    const channel =
        normalizeString(options.channel) || registry.defaults.channel;
    const catalog = {};

    for (const surface of registry.surfaces) {
        catalog[surface.id] = {
            version,
            updatedAt: '',
            webFallbackUrl: surface.webFallbackUrl,
            guideUrl: surface.guideUrl,
            targets: {},
        };

        for (const targetKey of listTurneroTargetKeys(surface, options)) {
            const target = surface.targets[targetKey];
            catalog[surface.id].targets[targetKey] = {
                url: resolveTurneroDownloadPublicPath(surface, targetKey, {
                    ...options,
                    channel,
                }),
                label: target.label,
            };
        }
    }

    return catalog;
}

function slugifySurfaceId(value) {
    return normalizeId(value).replace(/_/g, '-');
}

function buildTurneroReleaseArtifactName(surfaceOrId, targetKey, options = {}) {
    const surface = resolveSurface(surfaceOrId, options);
    const prefix =
        normalizeString(surface.release?.artifactName) ||
        `turnero-${surface.family}-${slugifySurfaceId(surface.id)}`;
    const resolvedTargetKey = getTurneroDefaultTargetKey(surface, {
        ...options,
        targetKey,
    });

    return `${prefix}-${slugifySurfaceId(resolvedTargetKey)}`;
}

function resolveSurface(surfaceOrId, options = {}) {
    if (surfaceOrId && typeof surfaceOrId === 'object' && surfaceOrId.id) {
        return normalizeTurneroSurfaceDefinition(surfaceOrId);
    }

    const fallbackByFamily =
        normalizeId(options.family) === 'desktop'
            ? DEFAULT_DESKTOP_SURFACE_ID
            : normalizeString(options.fallback);
    const surfaceId = normalizeTurneroSurfaceId(surfaceOrId, {
        ...options,
        fallback: fallbackByFamily,
    });
    const surface = getTurneroSurfaceDefinition(surfaceId, options);
    if (!surface) {
        throw new Error(`Superficie turnero no encontrada: ${surfaceId}`);
    }
    return surface;
}

module.exports = {
    REGISTRY_PATH,
    buildTurneroCatalogDefaults,
    buildTurneroReleaseArtifactName,
    getTurneroDefaultTargetKey,
    getTurneroRegistryDefaults,
    getTurneroSurfaceDefinition,
    getTurneroSurfaceMap,
    getTurneroTargetDefinition,
    listTurneroSurfaceDefinitions,
    listTurneroTargetKeys,
    normalizeTurneroSurfaceDefinition,
    normalizeTurneroSurfaceId,
    readTurneroSurfaceRegistry,
    resolveTurneroChannel,
    resolveTurneroDownloadPublicPath,
    resolveTurneroDownloadRelativePath,
    resolveTurneroUpdatePublicDirectory,
    resolveTurneroUpdatePublicFeedPath,
    resolveTurneroUpdatePublicPayloadPath,
    resolveTurneroUpdateRelativeDirectory,
    resolveTurneroUpdateRelativeFeedPath,
    resolveTurneroUpdateRelativePayloadPath,
    slugifySurfaceId,
};
