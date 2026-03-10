import { getState } from '../../../../../core/store.js';
import { DEFAULT_APP_DOWNLOADS } from './constants.js';

export function mergeManifest() {
    const appDownloads = getState().data.appDownloads;
    if (!appDownloads || typeof appDownloads !== 'object') {
        return DEFAULT_APP_DOWNLOADS;
    }
    return {
        operator: {
            ...DEFAULT_APP_DOWNLOADS.operator,
            ...(appDownloads.operator || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.operator.targets,
                ...((appDownloads.operator && appDownloads.operator.targets) ||
                    {}),
            },
        },
        kiosk: {
            ...DEFAULT_APP_DOWNLOADS.kiosk,
            ...(appDownloads.kiosk || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.kiosk.targets,
                ...((appDownloads.kiosk && appDownloads.kiosk.targets) || {}),
            },
        },
        sala_tv: {
            ...DEFAULT_APP_DOWNLOADS.sala_tv,
            ...(appDownloads.sala_tv || {}),
            targets: {
                ...DEFAULT_APP_DOWNLOADS.sala_tv.targets,
                ...((appDownloads.sala_tv && appDownloads.sala_tv.targets) ||
                    {}),
            },
        },
    };
}
