import {
    readClinicScopedStorageValue,
    persistClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { asObject, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-replay-recovery-queue:v1';

function normalizeScope(scope = 'global') {
    return toText(scope, 'global');
}

function parseRows(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (typeof value === 'string' && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
            return [];
        }
    }

    return [];
}

function normalizeReplayEntry(entry = {}, index = 0) {
    const item = asObject(entry);

    return {
        id: toText(item.id, `replay-${index + 1}`),
        label: toText(item.label, 'Replay item'),
        owner: String(item.owner || 'integration')
            .trim()
            .toLowerCase(),
        contractId: toText(item.contractId, ''),
        state: String(item.state || 'queued')
            .trim()
            .toLowerCase(),
        priority: String(item.priority || 'medium')
            .trim()
            .toLowerCase(),
        createdAt: toText(item.createdAt, new Date().toISOString()),
    };
}

export function createTurneroReleaseReplayRecoveryQueue(scope = 'global') {
    const storageProfile = { clinic_id: normalizeScope(scope) };

    const list = () => {
        const value = readClinicScopedStorageValue(
            STORAGE_KEY,
            storageProfile,
            {
                fallbackValue: [],
            }
        );
        return parseRows(value)
            .map((entry, index) => normalizeReplayEntry(entry, index))
            .filter((entry) => Boolean(entry.label));
    };

    const add = (entry = {}) => {
        const rows = list();
        const next = normalizeReplayEntry(entry, rows.length);
        persistClinicScopedStorageValue(
            STORAGE_KEY,
            storageProfile,
            [next, ...rows].slice(0, 250)
        );
        return next;
    };

    const clear = () =>
        removeClinicScopedStorageValue(STORAGE_KEY, storageProfile);

    return {
        list,
        add,
        clear,
    };
}
