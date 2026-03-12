import registryModule from '../../../../../lib/turnero-surface-registry.js';

const {
    getTurneroDefaultTargetKey,
    getTurneroRegistryDefaults,
    getTurneroSurfaceDefinition,
    normalizeTurneroSurfaceId,
    resolveTurneroUpdateRelativeDirectory,
} = registryModule;

const REGISTRY_DEFAULTS = getTurneroRegistryDefaults();
const DEFAULT_BASE_URL = REGISTRY_DEFAULTS.baseUrl;
const DEFAULT_UPDATE_BASE_URL = new URL(
    REGISTRY_DEFAULTS.updateBasePath,
    `${DEFAULT_BASE_URL}/`
).toString();

export function normalizeSurface(value) {
    return normalizeTurneroSurfaceId(value, {
        family: 'desktop',
        fallback: 'operator',
    });
}

export function normalizeLaunchMode(value) {
    return String(value || '')
        .trim()
        .toLowerCase() === 'windowed'
        ? 'windowed'
        : 'fullscreen';
}

export function normalizeStationMode(value, fallback = 'free') {
    return String(value || fallback)
        .trim()
        .toLowerCase() === 'locked'
        ? 'locked'
        : 'free';
}

export function normalizeStationConsultorio(value, fallback = 1) {
    return Number(value || fallback) === 2 ? 2 : 1;
}

export function normalizeAutoStart(value, fallback = true) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

export function normalizeUpdateChannel(value, fallback = 'stable') {
    const normalized = String(value || fallback)
        .trim()
        .toLowerCase();
    return normalized === '' ? 'stable' : normalized;
}

export function normalizeOneTap(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }

    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(fallback);
}

export function sanitizeBaseUrl(value, fallback = DEFAULT_BASE_URL) {
    try {
        const url = new URL(String(value || fallback).trim() || fallback);
        if (!['http:', 'https:'].includes(url.protocol)) {
            return fallback;
        }
        url.pathname = '/';
        url.search = '';
        url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch (_error) {
        return fallback;
    }
}

export function sanitizeUpdateBaseUrl(value, baseUrl = DEFAULT_BASE_URL) {
    const fallback = new URL(
        '/desktop-updates/',
        `${sanitizeBaseUrl(baseUrl)}/`
    );
    try {
        const url = new URL(
            String(value || fallback.toString()).trim() || fallback
        );
        if (!['http:', 'https:'].includes(url.protocol)) {
            return fallback.toString();
        }
        if (!url.pathname.endsWith('/')) {
            url.pathname = `${url.pathname}/`;
        }
        url.search = '';
        url.hash = '';
        return url.toString();
    } catch (_error) {
        return fallback.toString();
    }
}

export function getSurfaceMeta(surface) {
    return getTurneroSurfaceDefinition(normalizeSurface(surface), {
        family: 'desktop',
    });
}

export function getSurfaceRoute(surface) {
    return String(getSurfaceMeta(surface)?.route || '');
}

export function createBuildConfig(partial = {}) {
    const surface = normalizeSurface(partial.surface);
    const surfaceMeta = getSurfaceMeta(surface);
    const baseUrl = sanitizeBaseUrl(partial.baseUrl, DEFAULT_BASE_URL);
    return {
        surface,
        baseUrl,
        launchMode: normalizeLaunchMode(partial.launchMode),
        stationMode: normalizeStationMode(partial.stationMode, 'free'),
        stationConsultorio: normalizeStationConsultorio(
            partial.stationConsultorio,
            1
        ),
        oneTap: normalizeOneTap(partial.oneTap, false),
        autoStart: normalizeAutoStart(partial.autoStart, true),
        updateChannel: normalizeUpdateChannel(
            partial.updateChannel,
            surfaceMeta?.updateChannel || 'stable'
        ),
        updateBaseUrl: sanitizeUpdateBaseUrl(partial.updateBaseUrl, baseUrl),
    };
}

export function mergeRuntimeConfig(buildConfig, persisted = {}) {
    return {
        surface: normalizeSurface(buildConfig.surface),
        baseUrl: sanitizeBaseUrl(persisted.baseUrl, buildConfig.baseUrl),
        launchMode: normalizeLaunchMode(
            persisted.launchMode || buildConfig.launchMode
        ),
        stationMode: normalizeStationMode(
            persisted.stationMode,
            buildConfig.stationMode
        ),
        stationConsultorio: normalizeStationConsultorio(
            persisted.stationConsultorio,
            buildConfig.stationConsultorio
        ),
        oneTap: normalizeOneTap(persisted.oneTap, buildConfig.oneTap),
        autoStart: normalizeAutoStart(
            persisted.autoStart,
            buildConfig.autoStart
        ),
        updateChannel: normalizeUpdateChannel(
            persisted.updateChannel || buildConfig.updateChannel,
            buildConfig.updateChannel
        ),
        updateBaseUrl: sanitizeUpdateBaseUrl(
            persisted.updateBaseUrl || buildConfig.updateBaseUrl,
            persisted.baseUrl || buildConfig.baseUrl
        ),
    };
}

export function createSurfaceUrl(config) {
    const url = new URL(
        getSurfaceRoute(config.surface),
        `${sanitizeBaseUrl(config.baseUrl)}/`
    );

    if (normalizeSurface(config.surface) === 'operator') {
        url.searchParams.set(
            'station',
            normalizeStationConsultorio(config.stationConsultorio, 1) === 2
                ? 'c2'
                : 'c1'
        );
        url.searchParams.set(
            'lock',
            normalizeStationMode(config.stationMode, 'free') === 'locked'
                ? '1'
                : '0'
        );
        url.searchParams.set(
            'one_tap',
            normalizeOneTap(config.oneTap, false) ? '1' : '0'
        );
    }

    return url.toString();
}

export function buildUpdateFeedUrl(config, platform = process.platform) {
    const platformSegment = platform === 'darwin' ? 'mac' : 'win';
    const relativePath = resolveTurneroUpdateRelativeDirectory(
        normalizeSurface(config.surface),
        getTurneroDefaultTargetKey(normalizeSurface(config.surface), {
            targetKey: platformSegment,
        }),
        {
            channel: normalizeUpdateChannel(config.updateChannel, 'stable'),
        }
    );
    return new URL(
        relativePath,
        sanitizeUpdateBaseUrl(config.updateBaseUrl, config.baseUrl)
    ).toString();
}

export function getDefaultBaseUrl() {
    return DEFAULT_BASE_URL;
}

export function getDefaultUpdateBaseUrl() {
    return DEFAULT_UPDATE_BASE_URL;
}
