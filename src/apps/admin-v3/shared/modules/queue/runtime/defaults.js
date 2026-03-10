import { getQueryParam } from '../../../core/persistence.js';
import { getState, updateState } from '../../../core/store.js';
import { normalize } from '../helpers.js';
import { persistQueueUi, readQueueUiDefaults } from '../persistence.js';

function resolveStationFromQuery(stationQuery, fallback) {
    if (stationQuery === 'c2' || stationQuery === '2') {
        return 2;
    }
    if (stationQuery === 'c1' || stationQuery === '1') {
        return 1;
    }
    return fallback;
}

function resolveStationMode(lockQuery, fallback) {
    return lockQuery === '1' || lockQuery === 'true' ? 'locked' : fallback;
}

function resolveOneTap(oneTapQuery, fallback) {
    if (oneTapQuery === '1' || oneTapQuery === 'true') {
        return true;
    }
    if (oneTapQuery === '0' || oneTapQuery === 'false') {
        return false;
    }
    return fallback;
}

export function applyQueueRuntimeDefaults() {
    const defaults = readQueueUiDefaults();
    const stationQuery = normalize(getQueryParam('station'));
    const lockQuery = normalize(getQueryParam('lock'));
    const oneTapQuery = normalize(getQueryParam('one_tap'));

    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            stationMode: resolveStationMode(lockQuery, defaults.stationMode),
            stationConsultorio: resolveStationFromQuery(
                stationQuery,
                defaults.stationConsultorio
            ),
            oneTap: resolveOneTap(oneTapQuery, defaults.oneTap),
            helpOpen: defaults.helpOpen,
            customCallKey:
                defaults.customCallKey &&
                typeof defaults.customCallKey === 'object'
                    ? defaults.customCallKey
                    : null,
        },
    }));

    persistQueueUi(getState());
}
