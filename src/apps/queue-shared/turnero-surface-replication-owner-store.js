import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const STORAGE_KEY = 'turneroSurfaceReplicationOwnerStoreV1';
const STORE_SCHEMA = 'turnero-surface-replication-owner-store/v1';
const MEMORY_FALLBACK_STORES = new Map();

function toString(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function normalizeStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['active', 'paused', 'inactive', 'standby'].includes(normalized)) {
        return normalized;
    }
    return 'active';
}

function getClinicKey(clinicProfile) {
    return (
        toString(clinicProfile?.clinic_id || clinicProfile?.clinicId) ||
        'default-clinic'
    );
}

function getFallbackStoreKey(clinicProfile) {
    return `${STORAGE_KEY}:${getClinicKey(clinicProfile)}`;
}

function normalizeEnvelope(rawValue) {
    if (Array.isArray(rawValue)) {
        return {
            schema: STORE_SCHEMA,
            scopes: {
                global: rawValue,
            },
        };
    }

    const source = asObject(rawValue);
    return {
        schema: toString(source.schema, STORE_SCHEMA),
        scopes:
            source.scopes && typeof source.scopes === 'object'
                ? source.scopes
                : {},
    };
}

function normalizeEntry(entry = {}, fallbackScope = 'global') {
    const source = asObject(entry);
    const createdAt =
        toString(source.createdAt || source.updatedAt) ||
        new Date().toISOString();

    return {
        id:
            toString(source.id) ||
            `owner-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scope: toString(source.scope, fallbackScope || 'global') || 'global',
        surfaceKey: toString(source.surfaceKey, 'surface'),
        actor: toString(source.actor, 'owner'),
        role: toString(source.role, 'replication'),
        status: normalizeStatus(source.status),
        note: toString(source.note || source.detail, ''),
        createdAt,
        updatedAt: toString(source.updatedAt, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function readEnvelope(clinicProfile) {
    const fallbackValue = {
        schema: STORE_SCHEMA,
        scopes: {},
    };

    const normalized = readClinicScopedStorageValue(STORAGE_KEY, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) => normalizeEnvelope(value),
    });

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized);
    }

    const fallbackKey = getFallbackStoreKey(clinicProfile);
    const fallbackEnvelope = MEMORY_FALLBACK_STORES.get(fallbackKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope);
    }

    return fallbackValue;
}

function persistEnvelope(clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope);
    const persisted = persistClinicScopedStorageValue(
        STORAGE_KEY,
        clinicProfile,
        normalized
    );
    const fallbackKey = getFallbackStoreKey(clinicProfile);

    if (!persisted) {
        MEMORY_FALLBACK_STORES.set(fallbackKey, normalized);
    } else {
        MEMORY_FALLBACK_STORES.delete(fallbackKey);
    }

    return persisted;
}

function readEntries(scope, clinicProfile) {
    const normalizedScope = toString(scope, 'global');
    const envelope = readEnvelope(clinicProfile);
    const rawEntries = asArray(envelope?.scopes?.[normalizedScope]);

    return rawEntries
        .map((entry) => normalizeEntry(entry, normalizedScope))
        .sort((left, right) =>
            String(right.updatedAt || right.createdAt || '').localeCompare(
                String(left.updatedAt || left.createdAt || '')
            )
        );
}

function writeEntries(scope, clinicProfile, entries) {
    const normalizedScope = toString(scope, 'global');
    const envelope = readEnvelope(clinicProfile);
    const scopes =
        envelope.scopes && typeof envelope.scopes === 'object'
            ? envelope.scopes
            : {};

    if (!Array.isArray(entries) || entries.length === 0) {
        if (Object.prototype.hasOwnProperty.call(scopes, normalizedScope)) {
            delete scopes[normalizedScope];
            if (Object.keys(scopes).length === 0) {
                return removeClinicScopedStorageValue(STORAGE_KEY, clinicProfile);
            }
            return persistClinicScopedStorageValue(STORAGE_KEY, clinicProfile, {
                schema: envelope.schema || STORE_SCHEMA,
                scopes,
            });
        }
        return true;
    }

    return persistEnvelope(clinicProfile, {
        schema: envelope.schema || STORE_SCHEMA,
        scopes: {
            ...scopes,
            [normalizedScope]: entries
                .map((entry) => normalizeEntry(entry, normalizedScope))
                .slice(0, 300),
        },
    });
}

export function createTurneroSurfaceReplicationOwnerStore(
    scope = 'global',
    clinicProfile = null
) {
    const normalizedScope = toString(scope, 'global');

    return {
        list({ surfaceKey = '', role = '', status = '', actor = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            const normalizedRole = toString(role).toLowerCase();
            const normalizedStatus = toString(status).toLowerCase();
            const normalizedActor = toString(actor).toLowerCase();

            return readEntries(normalizedScope, clinicProfile).filter(
                (entry) =>
                    (!normalizedSurfaceKey ||
                        entry.surfaceKey === normalizedSurfaceKey) &&
                    (!normalizedRole || entry.role === normalizedRole) &&
                    (!normalizedStatus || entry.status === normalizedStatus) &&
                    (!normalizedActor ||
                        String(entry.actor || '')
                            .toLowerCase()
                            .includes(normalizedActor))
            );
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry(
                {
                    ...entry,
                    scope: normalizedScope,
                    status: entry.status || 'active',
                    role: entry.role || 'replication',
                    actor: entry.actor || entry.owner || 'owner',
                },
                normalizedScope
            );
            const entries = readEntries(normalizedScope, clinicProfile);
            writeEntries(normalizedScope, clinicProfile, [
                nextEntry,
                ...entries,
            ]);
            return nextEntry;
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeEntries(normalizedScope, clinicProfile, []);
            }

            const remaining = readEntries(
                normalizedScope,
                clinicProfile
            ).filter((entry) => entry.surfaceKey !== normalizedSurfaceKey);
            return writeEntries(normalizedScope, clinicProfile, remaining);
        },
        snapshot() {
            return readEnvelope(clinicProfile);
        },
    };
}
