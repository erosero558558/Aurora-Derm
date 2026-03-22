import {
    getStorageItem,
    setStorageJson,
    getStorageJson,
    removeStorageItem,
} from '../../core/persistence.js';
import { getState, updateState } from '../../core/store.js';
import {
    QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
    QUEUE_HELP_STORAGE_KEY,
    QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
    QUEUE_SNAPSHOT_STORAGE_KEY,
    QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
    QUEUE_STATION_MODE_STORAGE_KEY,
} from './constants.js';
import {
    getTurneroActiveClinicId as getActiveQueueClinicId,
    normalizeOneTap,
    normalizeStationConsultorio,
    normalizeStationMode,
} from '../../../../queue-shared/turnero-runtime-contract.mjs';

let lastQueueUiClinicId = null;

function normalizeScopedStorageMap(rawValue) {
    const source = rawValue && typeof rawValue === 'object' ? rawValue : {};
    const values =
        source.values && typeof source.values === 'object' ? source.values : {};
    return {
        values: { ...values },
    };
}

function readScopedStorageValue(key, clinicId, fallback, normalizeValue) {
    const activeClinicId = String(clinicId || '').trim() || 'default-clinic';
    try {
        const rawValue = getStorageItem(key, '');
        if (!rawValue) {
            return fallback;
        }
        const parsed = JSON.parse(rawValue);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            if (
                parsed.values &&
                typeof parsed.values === 'object'
            ) {
                return Object.prototype.hasOwnProperty.call(
                    parsed.values,
                    activeClinicId
                )
                    ? normalizeValue(parsed.values[activeClinicId])
                    : fallback;
            }
            if (
                Object.prototype.hasOwnProperty.call(parsed, 'clinicId') &&
                Object.prototype.hasOwnProperty.call(parsed, 'value')
            ) {
                return String(parsed.clinicId || '').trim() === activeClinicId
                    ? normalizeValue(parsed.value)
                    : fallback;
            }
            return normalizeValue(parsed);
        }
        return normalizeValue(parsed);
    } catch (_error) {
        const rawValue = getStorageItem(key, '');
        if (!rawValue) {
            return fallback;
        }
        return normalizeValue(rawValue);
    }
}

function persistScopedStorageValue(key, clinicId, value) {
    const activeClinicId = String(clinicId || '').trim() || 'default-clinic';
    const nextState = normalizeScopedStorageMap(getStorageJson(key, null));
    nextState.values[activeClinicId] = value;
    setStorageJson(key, nextState);
}

function removeScopedStorageValue(key, clinicId) {
    const activeClinicId = String(clinicId || '').trim() || 'default-clinic';
    const nextState = normalizeScopedStorageMap(getStorageJson(key, null));
    delete nextState.values[activeClinicId];
    if (Object.keys(nextState.values).length === 0) {
        removeStorageItem(key);
        return;
    }
    setStorageJson(key, nextState);
}

function normalizeCustomCallKeyValue(value) {
    return value && typeof value === 'object' ? value : null;
}

function buildQueueUiDefaultsForClinic(clinicId) {
    const stationMode = readScopedStorageValue(
        QUEUE_STATION_MODE_STORAGE_KEY,
        clinicId,
        'free',
        (value) => normalizeStationMode(value, 'free')
    );
    const stationConsultorio = readScopedStorageValue(
        QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
        clinicId,
        1,
        (value) => normalizeStationConsultorio(value, 1)
    );
    const oneTap = readScopedStorageValue(
        QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
        clinicId,
        false,
        (value) => normalizeOneTap(value, false)
    );
    const helpOpen = readScopedStorageValue(
        QUEUE_HELP_STORAGE_KEY,
        clinicId,
        false,
        (value) => normalizeOneTap(value, false)
    );
    const customCallKey = readScopedStorageValue(
        QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
        clinicId,
        null,
        normalizeCustomCallKeyValue
    );

    return {
        stationMode,
        stationConsultorio,
        oneTap,
        helpOpen,
        customCallKey,
    };
}

function persistQueueUiPreferences(state) {
    const clinicId = getActiveQueueClinicId();
    lastQueueUiClinicId = clinicId;
    persistScopedStorageValue(
        QUEUE_STATION_MODE_STORAGE_KEY,
        clinicId,
        normalizeStationMode(state.queue.stationMode || 'free', 'free')
    );
    persistScopedStorageValue(
        QUEUE_STATION_CONSULTORIO_STORAGE_KEY,
        clinicId,
        normalizeStationConsultorio(state.queue.stationConsultorio || 1, 1)
    );
    persistScopedStorageValue(
        QUEUE_ONE_TAP_ADVANCE_STORAGE_KEY,
        clinicId,
        Boolean(state.queue.oneTap)
    );
    persistScopedStorageValue(
        QUEUE_HELP_STORAGE_KEY,
        clinicId,
        Boolean(state.queue.helpOpen)
    );

    if (state.queue.customCallKey) {
        persistScopedStorageValue(
            QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY,
            clinicId,
            state.queue.customCallKey
        );
    } else {
        removeScopedStorageValue(QUEUE_CUSTOM_CALL_KEY_STORAGE_KEY, clinicId);
    }
}

function persistQueueSnapshot(state) {
    persistScopedStorageValue(QUEUE_SNAPSHOT_STORAGE_KEY, getActiveQueueClinicId(), {
        queueMeta: state.data.queueMeta,
        queueTickets: state.data.queueTickets,
        updatedAt: new Date().toISOString(),
    });
}

export function persistQueueUi(state) {
    persistQueueUiPreferences(state);
    persistQueueSnapshot(state);
}

export function readQueueUiDefaults() {
    return buildQueueUiDefaultsForClinic(getActiveQueueClinicId());
}

export function getQueueSnapshot() {
    return readScopedStorageValue(
        QUEUE_SNAPSHOT_STORAGE_KEY,
        getActiveQueueClinicId(),
        null,
        (value) => (value && typeof value === 'object' ? value : null)
    );
}

export function syncQueueUiToActiveClinic() {
    const clinicId = getActiveQueueClinicId();
    if (lastQueueUiClinicId === clinicId) {
        return false;
    }

    const defaults = buildQueueUiDefaultsForClinic(clinicId);
    updateState((state) => ({
        ...state,
        queue: {
            ...state.queue,
            stationMode: defaults.stationMode,
            stationConsultorio: defaults.stationConsultorio,
            oneTap: defaults.oneTap,
            helpOpen: defaults.helpOpen,
            customCallKey: defaults.customCallKey,
            captureCallKeyMode: false,
        },
    }));
    persistQueueUiPreferences(getState());
    lastQueueUiClinicId = clinicId;
    return true;
}
