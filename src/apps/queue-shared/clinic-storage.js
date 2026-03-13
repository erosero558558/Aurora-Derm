import { normalizeTurneroClinicProfile } from './clinic-profile.js';

const CLINIC_STORAGE_SCHEMA = 'turnero-clinic-storage/v1';
const DEFAULT_CLINIC_ID = 'default-clinic';

function parseClinicStorageEnvelope(rawValue) {
    if (typeof rawValue !== 'string' || !rawValue.trim()) {
        return null;
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return null;
        }
        if (
            parsed.values &&
            typeof parsed.values === 'object' &&
            !Array.isArray(parsed.values)
        ) {
            return {
                schema:
                    String(parsed.schema || '').trim() ||
                    CLINIC_STORAGE_SCHEMA,
                values: parsed.values,
            };
        }
    } catch (_error) {
        return null;
    }

    return null;
}

function ensureClinicId(clinicProfile) {
    const profile = normalizeTurneroClinicProfile(clinicProfile);
    const clinicId = String(profile?.clinic_id || '').trim();
    return clinicId || DEFAULT_CLINIC_ID;
}

export function readClinicScopedStorageValue(
    storageKey,
    clinicProfile,
    options = {}
) {
    const normalizeValue =
        typeof options.normalizeValue === 'function'
            ? options.normalizeValue
            : (value) => value;
    const fallbackValue =
        Object.prototype.hasOwnProperty.call(options, 'fallbackValue')
            ? options.fallbackValue
            : null;
    const clinicId = ensureClinicId(clinicProfile);

    try {
        const rawValue = localStorage.getItem(String(storageKey || ''));
        if (rawValue === null) {
            return fallbackValue;
        }

        const envelope = parseClinicStorageEnvelope(rawValue);
        if (!envelope) {
            return normalizeValue(rawValue, fallbackValue);
        }

        if (!Object.prototype.hasOwnProperty.call(envelope.values, clinicId)) {
            return fallbackValue;
        }

        return normalizeValue(envelope.values[clinicId], fallbackValue);
    } catch (_error) {
        return fallbackValue;
    }
}

export function persistClinicScopedStorageValue(
    storageKey,
    clinicProfile,
    value
) {
    const clinicId = ensureClinicId(clinicProfile);
    const key = String(storageKey || '');
    if (!key) return false;

    try {
        const existing = parseClinicStorageEnvelope(localStorage.getItem(key));
        const envelope = existing || {
            schema: CLINIC_STORAGE_SCHEMA,
            values: {},
        };
        envelope.values[clinicId] = value;
        localStorage.setItem(key, JSON.stringify(envelope));
        return true;
    } catch (_error) {
        return false;
    }
}

export function removeClinicScopedStorageValue(storageKey, clinicProfile) {
    const clinicId = ensureClinicId(clinicProfile);
    const key = String(storageKey || '');
    if (!key) return false;

    try {
        const rawValue = localStorage.getItem(key);
        const envelope = parseClinicStorageEnvelope(rawValue);
        if (!envelope) {
            localStorage.removeItem(key);
            return true;
        }

        delete envelope.values[clinicId];
        if (Object.keys(envelope.values).length === 0) {
            localStorage.removeItem(key);
            return true;
        }

        localStorage.setItem(key, JSON.stringify(envelope));
        return true;
    } catch (_error) {
        return false;
    }
}
