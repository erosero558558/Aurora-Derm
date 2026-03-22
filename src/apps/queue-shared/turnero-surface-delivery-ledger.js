import {
    persistClinicScopedStorageValue,
    readClinicScopedStorageValue,
    removeClinicScopedStorageValue,
} from './clinic-storage.js';
import {
    normalizeTurneroSurfaceDeliverySurfaceKey,
    resolveTurneroSurfaceDeliveryScope,
} from './turnero-surface-delivery-snapshot.js';

const STORAGE_KEY = 'turneroSurfaceDeliveryLedgerV1';
const STORAGE_SCHEMA = 'turnero-surface-delivery-ledger/v1';
const MEMORY_FALLBACK_STORES = new Map();
const MAX_HISTORY = 300;

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

function normalizeScope(scope, clinicProfile) {
    return resolveTurneroSurfaceDeliveryScope(scope, clinicProfile);
}

function normalizeKind(value) {
    const normalized = toString(value, 'plan')
        .toLowerCase()
        .replace(/[\s_]+/g, '-');

    if (['plan', 'dependency', 'blocker'].includes(normalized)) {
        return normalized;
    }
    if (['deps', 'dep'].includes(normalized)) {
        return 'dependency';
    }
    if (['risk', 'issue'].includes(normalized)) {
        return 'blocker';
    }
    return normalized || 'plan';
}

function normalizeStatus(value) {
    const normalized = toString(value, 'open').toLowerCase();

    if (
        ['ready', 'done', 'closed', 'approved', 'resolved', 'clear', 'complete'].includes(
            normalized
        )
    ) {
        return 'ready';
    }
    if (
        ['watch', 'review', 'pending', 'queued', 'active', 'open', 'in-progress'].includes(
            normalized
        )
    ) {
        return 'open';
    }
    if (['blocked', 'hold', 'failed', 'alert'].includes(normalized)) {
        return 'blocked';
    }
    if (['draft', 'note'].includes(normalized)) {
        return 'draft';
    }

    return normalized || 'open';
}

function getClinicFallbackKey(clinicProfile) {
    const profile =
        clinicProfile && typeof clinicProfile === 'object' ? clinicProfile : {};
    return toString(
        profile?.clinic_id || profile?.clinicId || profile?.id,
        'default-clinic'
    );
}

function getFallbackStoreKey(storageKey, clinicProfile) {
    return `${toString(storageKey, STORAGE_KEY)}:${getClinicFallbackKey(
        clinicProfile
    )}`;
}

function normalizeEnvelope(rawEnvelope, fallbackScope = 'regional') {
    if (Array.isArray(rawEnvelope)) {
        return {
            schema: STORAGE_SCHEMA,
            scopes: {
                [normalizeScope(fallbackScope)]: rawEnvelope,
            },
        };
    }

    const source = asObject(rawEnvelope);
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
    const scope = normalizeScope(source.scope || fallbackScope, {});
    const createdAt =
        toString(source.createdAt || source.updatedAt) ||
        new Date().toISOString();

    return {
        id:
            toString(source.id) ||
            `delivery-ledger-${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
        scope,
        surfaceKey: normalizeTurneroSurfaceDeliverySurfaceKey(
            source.surfaceKey || source.surface || 'surface'
        ),
        kind: normalizeKind(source.kind),
        status: normalizeStatus(source.status),
        title: toString(source.title || source.label, 'Delivery item'),
        owner: toString(source.owner || source.actor || 'ops', 'ops'),
        note: toString(source.note || source.detail, ''),
        dependencyRef: toString(source.dependencyRef || source.reference, ''),
        targetWindow: toString(source.targetWindow, ''),
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
    const fallbackEnvelope = MEMORY_FALLBACK_STORES.get(fallbackKey);
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
        MEMORY_FALLBACK_STORES.delete(fallbackKey);
        return true;
    }

    MEMORY_FALLBACK_STORES.set(fallbackKey, normalized);
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
    const normalizedScope = normalizeScope(scope, clinicProfile);
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
                MEMORY_FALLBACK_STORES.delete(
                    getFallbackStoreKey(storageKey, clinicProfile)
                );
            }
            return cleared;
        }

        return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
    }

    nextEnvelope.scopes[normalizedScope] = normalizedEntries.slice(0, MAX_HISTORY);
    return persistEnvelope(storageKey, clinicProfile, nextEnvelope);
}

export function createTurneroSurfaceDeliveryLedger(
    scope = 'regional',
    clinicProfile = null
) {
    const normalizedScope = normalizeScope(scope, clinicProfile);

    return {
        list({ surfaceKey = '', kind = '', status = '' } = {}) {
            const normalizedSurfaceKey = toString(surfaceKey)
                ? normalizeTurneroSurfaceDeliverySurfaceKey(surfaceKey)
                : '';
            const normalizedKind = toString(kind) ? normalizeKind(kind) : '';
            const normalizedStatus = toString(status)
                ? normalizeStatus(status)
                : '';

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
                    return true;
                })
                .map((entry) => ({ ...entry }));
        },
        add(entry = {}) {
            const nextEntry = normalizeEntry({
                ...entry,
                scope: normalizedScope,
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
            const normalizedSurfaceKey = toString(surfaceKey)
                ? normalizeTurneroSurfaceDeliverySurfaceKey(surfaceKey)
                : '';
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
