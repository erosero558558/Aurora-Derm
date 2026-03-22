import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';

const STORAGE_KEY = 'turneroSurfaceRenewalLedgerV1';
const STORAGE_SCHEMA = 'turnero-surface-renewal-ledger/v1';
const memoryFallbackStores = new Map();

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
    const normalized = toString(value, 'ready').toLowerCase();
    if (
        [
            'ready',
            'watch',
            'degraded',
            'blocked',
            'done',
            'closed',
            'draft',
            'review',
            'pending',
        ].includes(normalized)
    ) {
        return normalized;
    }
    return 'ready';
}

function normalizeSignal(value) {
    const normalized = toString(value, 'renewal').toLowerCase();
    if (
        [
            'renewal',
            'retention',
            'value',
            'feedback',
            'correction',
            'owner',
            'note',
        ].includes(normalized)
    ) {
        return normalized;
    }
    return 'renewal';
}

function normalizeKind(value) {
    return (
        toString(value, 'renewal-note')
            .toLowerCase()
            .replace(/[\s_]+/g, '-') || 'renewal-note'
    );
}

function getClinicKey(clinicProfile) {
    return (
        toString(clinicProfile?.clinic_id || clinicProfile?.clinicId) ||
        'default-clinic'
    );
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(storageKey, STORAGE_KEY)}:${getClinicKey(clinicProfile)}`;
}

function normalizeEnvelope(rawValue) {
    if (Array.isArray(rawValue)) {
        return {
            schema: STORAGE_SCHEMA,
            scopes: {
                global: rawValue,
            },
        };
    }

    const source = asObject(rawValue);
    return {
        schema: toString(source.schema, STORAGE_SCHEMA),
        scopes:
            source.scopes && typeof source.scopes === 'object'
                ? source.scopes
                : {},
    };
}

function normalizeEntry(entry = {}, fallbackScope = 'regional') {
    const source = asObject(entry);
    const createdAt =
        toString(source.createdAt || source.updatedAt) ||
        new Date().toISOString();

    return {
        id:
            toString(source.id) ||
            `renewal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        scope: toString(source.scope, fallbackScope || 'regional') || 'regional',
        surfaceKey: toString(source.surfaceKey, 'surface'),
        kind: normalizeKind(source.kind),
        signal: normalizeSignal(source.signal),
        status: normalizeStatus(source.status),
        owner: toString(source.owner, 'renewal'),
        note: toString(source.note || source.detail, ''),
        createdAt,
        updatedAt: toString(source.updatedAt, createdAt),
        meta:
            source.meta && typeof source.meta === 'object'
                ? { ...source.meta }
                : {},
    };
}

function readEnvelope(storageKey, clinicProfile) {
    const fallbackValue = {
        schema: STORAGE_SCHEMA,
        scopes: {},
    };

    const normalized = readClinicScopedStorageValue(storageKey, clinicProfile, {
        fallbackValue: null,
        normalizeValue: (value) => normalizeEnvelope(value),
    });

    if (normalized && typeof normalized === 'object') {
        return normalizeEnvelope(normalized);
    }

    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);
    const fallbackEnvelope = memoryFallbackStores.get(fallbackKey);
    if (fallbackEnvelope) {
        return normalizeEnvelope(fallbackEnvelope);
    }

    return fallbackValue;
}

function persistEnvelope(storageKey, clinicProfile, envelope) {
    const normalized = normalizeEnvelope(envelope);
    const persisted = persistClinicScopedStorageValue(
        storageKey,
        clinicProfile,
        normalized
    );
    const fallbackKey = getFallbackStoreKey(storageKey, clinicProfile);

    if (persisted) {
        memoryFallbackStores.delete(fallbackKey);
        return true;
    }

    memoryFallbackStores.set(fallbackKey, normalized);
    return false;
}

function readScopeEntries(storageKey, clinicProfile, scope) {
    const envelope = readEnvelope(storageKey, clinicProfile);
    const rawEntries = asArray(envelope.scopes?.[scope]);
    return rawEntries
        .map((entry) => normalizeEntry(entry, scope))
        .sort((left, right) =>
            String(right.updatedAt || right.createdAt || '').localeCompare(
                String(left.updatedAt || left.createdAt || '')
            )
        );
}

function writeScopeEntries(storageKey, clinicProfile, scope, entries) {
    const normalizedScope = toString(scope, 'regional') || 'regional';
    const normalizedEntries = asArray(entries)
        .map((entry) => normalizeEntry(entry, normalizedScope))
        .filter((entry) => Boolean(entry.id));
    const envelope = readEnvelope(storageKey, clinicProfile);
    const nextEnvelope = {
        schema: STORAGE_SCHEMA,
        scopes: {
            ...(envelope.scopes && typeof envelope.scopes === 'object'
                ? envelope.scopes
                : {}),
        },
    };

    if (normalizedEntries.length === 0) {
        delete nextEnvelope.scopes[normalizedScope];
        if (Object.keys(nextEnvelope.scopes).length === 0) {
            const cleared = removeClinicScopedStorageValue(
                storageKey,
                clinicProfile
            );
            if (cleared) {
                memoryFallbackStores.delete(
                    getFallbackStoreKey(storageKey, clinicProfile)
                );
            }
            return cleared;
        }

        return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
    }

    nextEnvelope.scopes[normalizedScope] = normalizedEntries.slice(0, 300);
    return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
}

export function createTurneroSurfaceRenewalLedger(
    scope = 'regional',
    clinicProfile = null
) {
    const normalizedScope = toString(scope, 'regional') || 'regional';

    return {
        list({ surfaceKey = '', kind = '', status = '', signal = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            const normalizedKind = toString(kind).toLowerCase();
            const normalizedStatus = toString(status).toLowerCase();
            const normalizedSignal = toString(signal).toLowerCase();
            return readScopeEntries(STORAGE_KEY, clinicProfile, normalizedScope)
                .filter((entry) => {
                    if (
                        normalizedSurfaceKey &&
                        entry.surfaceKey !== normalizedSurfaceKey
                    ) {
                        return false;
                    }
                    if (normalizedKind && entry.kind !== normalizedKind) {
                        return false;
                    }
                    if (normalizedStatus && entry.status !== normalizedStatus) {
                        return false;
                    }
                    if (normalizedSignal && entry.signal !== normalizedSignal) {
                        return false;
                    }
                    return true;
                })
                .map((entry) => ({ ...entry }));
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry({
                ...entry,
                scope: normalizedScope,
                status: entry.status || 'ready',
                owner: entry.owner || 'renewal',
            });
            const current = readScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope
            );
            writeScopeEntries(STORAGE_KEY, clinicProfile, normalizedScope, [
                nextEntry,
                ...current,
            ]);
            return nextEntry;
        },
        clear({ surfaceKey = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey);
            if (!normalizedSurfaceKey) {
                return writeScopeEntries(
                    STORAGE_KEY,
                    clinicProfile,
                    normalizedScope,
                    []
                );
            }
            const remaining = readScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope
            ).filter((entry) => entry.surfaceKey !== normalizedSurfaceKey);
            return writeScopeEntries(
                STORAGE_KEY,
                clinicProfile,
                normalizedScope,
                remaining
            );
        },
        snapshot() {
            return readEnvelope(STORAGE_KEY, clinicProfile);
        },
    };
}
