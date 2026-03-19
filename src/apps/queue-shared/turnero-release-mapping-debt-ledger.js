import {
    readClinicScopedStorageValue,
    persistClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import { asObject, toText } from './turnero-release-control-center.js';

const STORAGE_KEY = 'turnero-release-mapping-debt-ledger:v1';

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

function normalizeMappingDebtEntry(entry = {}, index = 0) {
    const item = asObject(entry);

    return {
        id: toText(item.id, `mapping-${index + 1}`),
        label: toText(item.label, 'Mapping debt'),
        owner: String(item.owner || 'integration')
            .trim()
            .toLowerCase(),
        severity: String(item.severity || 'medium')
            .trim()
            .toLowerCase(),
        impactedFlow: toText(item.impactedFlow, ''),
        state: String(item.state || 'open')
            .trim()
            .toLowerCase(),
        createdAt: toText(item.createdAt, new Date().toISOString()),
    };
}

export function createTurneroReleaseMappingDebtLedger(scope = 'global') {
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
            .map((entry, index) => normalizeMappingDebtEntry(entry, index))
            .filter((entry) => Boolean(entry.label));
    };

    const add = (entry = {}) => {
        const rows = list();
        const next = normalizeMappingDebtEntry(entry, rows.length);
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
