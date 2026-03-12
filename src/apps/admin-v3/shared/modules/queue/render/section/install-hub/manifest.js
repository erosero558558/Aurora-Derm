import { getState } from '../../../../../core/store.js';
import { DEFAULT_APP_DOWNLOADS } from './constants.js';

export function mergeManifest() {
    const appDownloads = getState().data.appDownloads;
    if (!appDownloads || typeof appDownloads !== 'object') {
        return DEFAULT_APP_DOWNLOADS;
    }
    const catalog =
        appDownloads.catalog && typeof appDownloads.catalog === 'object'
            ? appDownloads.catalog
            : appDownloads;
    return {
        operator: {
            ...DEFAULT_APP_DOWNLOADS.operator,
            ...(catalog.operator || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.operator.targets,
                ...((catalog.operator && catalog.operator.targets) || {}),
            },
        },
        kiosk: {
            ...DEFAULT_APP_DOWNLOADS.kiosk,
            ...(catalog.kiosk || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.kiosk.targets,
                ...((catalog.kiosk && catalog.kiosk.targets) || {}),
            },
        },
        sala_tv: {
            ...DEFAULT_APP_DOWNLOADS.sala_tv,
            ...(catalog.sala_tv || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.sala_tv.targets,
                ...((catalog.sala_tv && catalog.sala_tv.targets) || {}),
            },
        },
    };
}

export function buildGuideUrl(surfaceKey, preset, appConfig) {
    const base = new URL(
        String(appConfig.guideUrl || `/app-downloads/?surface=${surfaceKey}`),
        `${window.location.origin}/`
    );
    base.searchParams.set('surface', surfaceKey);
    if (surfaceKey === 'sala_tv') {
        base.searchParams.set('platform', 'android_tv');
    } else {
        base.searchParams.set(
            'platform',
            preset.platform === 'mac' ? 'mac' : 'win'
        );
    }
    if (surfaceKey === 'operator') {
        base.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        base.searchParams.set('lock', preset.lock ? '1' : '0');
        base.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    } else {
        base.searchParams.delete('station');
        base.searchParams.delete('lock');
        base.searchParams.delete('one_tap');
    }
    return `${base.pathname}${base.search}`;
}

export function getDesktopTarget(appConfig, platform) {
    if (platform === 'mac' && appConfig.targets.mac) {
        return appConfig.targets.mac;
    }
    if (platform === 'win' && appConfig.targets.win) {
        return appConfig.targets.win;
    }
    return appConfig.targets.win || appConfig.targets.mac || null;
}

export function buildPreparedSurfaceUrl(surfaceKey, appConfig, preset) {
    const url = new URL(
        String(appConfig.webFallbackUrl || '/'),
        `${window.location.origin}/`
    );

    if (surfaceKey === 'operator') {
        url.searchParams.set('station', preset.station === 'c2' ? 'c2' : 'c1');
        url.searchParams.set('lock', preset.lock ? '1' : '0');
        url.searchParams.set('one_tap', preset.oneTap ? '1' : '0');
    }

    return url.toString();
}
