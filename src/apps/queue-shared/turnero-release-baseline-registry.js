import { asObject, toArray, toText } from './turnero-release-control-center.js';

const STORAGE_PREFIX = 'turnero.release.baselines';
const DEFAULT_CLINIC_ID = 'default-clinic';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nowIso() {
    return new Date().toISOString();
}

function cloneValue(value) {
    if (typeof structuredClone === 'function') {
        try {
            return structuredClone(value);
        } catch (_error) {
            // Fall back to JSON cloning below.
        }
    }

    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_error) {
        return isPlainObject(value) ? { ...value } : value;
    }
}

function getStorage(storageOverride) {
    if (
        storageOverride &&
        typeof storageOverride.getItem === 'function' &&
        typeof storageOverride.setItem === 'function' &&
        typeof storageOverride.removeItem === 'function'
    ) {
        return storageOverride;
    }

    try {
        return typeof globalThis !== 'undefined' &&
            globalThis.localStorage &&
            typeof globalThis.localStorage.getItem === 'function'
            ? globalThis.localStorage
            : null;
    } catch (_error) {
        return null;
    }
}

function sanitizeClinicKey(value) {
    return (
        toText(value, DEFAULT_CLINIC_ID)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || DEFAULT_CLINIC_ID
    );
}

function storageKey(clinicId) {
    return `${STORAGE_PREFIX}.${sanitizeClinicKey(clinicId)}`;
}

function readJson(storage, key, fallbackValue) {
    if (!storage) {
        return fallbackValue;
    }

    try {
        const rawValue = storage.getItem(key);
        if (!rawValue) {
            return fallbackValue;
        }
        return JSON.parse(rawValue);
    } catch (_error) {
        return fallbackValue;
    }
}

function writeJson(storage, key, value) {
    if (!storage) {
        return false;
    }

    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch (_error) {
        return false;
    }
}

function removeKey(storage, key) {
    if (!storage) {
        return false;
    }

    try {
        storage.removeItem(key);
        return true;
    } catch (_error) {
        return false;
    }
}

function normalizeRegistryState(value, clinicId) {
    const source = isPlainObject(value) ? value : {};
    const normalizedClinicId = toText(
        source.clinicId || clinicId || DEFAULT_CLINIC_ID,
        DEFAULT_CLINIC_ID
    );
    const items = toArray(source.items)
        .map((entry, index) =>
            normalizeBaselineRecord(entry, normalizedClinicId, index)
        )
        .filter(Boolean);
    const activeBaselineId = toText(source.activeBaselineId || '');

    return {
        clinicId: normalizedClinicId,
        activeBaselineId,
        items,
    };
}

function readRegistryState(clinicId, storageOverride = null) {
    const storage = getStorage(storageOverride);
    const key = storageKey(clinicId);
    return normalizeRegistryState(
        readJson(storage, key, {
            clinicId: toText(clinicId, DEFAULT_CLINIC_ID),
            activeBaselineId: '',
            items: [],
        }),
        clinicId
    );
}

function writeRegistryState(clinicId, nextState, storageOverride = null) {
    const storage = getStorage(storageOverride);
    const key = storageKey(clinicId);
    const normalized = normalizeRegistryState(nextState, clinicId);
    writeJson(storage, key, normalized);
    return normalized;
}

function buildBaselineId() {
    return `baseline-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeBaselineRecord(record, clinicId, index = 0) {
    const source = isPlainObject(record) ? record : {};
    const sourceSnapshot = isPlainObject(source.snapshot)
        ? cloneValue(source.snapshot)
        : cloneValue(
              source.controlCenter ||
                  source.currentSnapshot ||
                  source.currentEvidence ||
                  {}
          );
    const normalizedClinicId = toText(
        source.clinicId || clinicId || DEFAULT_CLINIC_ID,
        DEFAULT_CLINIC_ID
    );
    const promotedAt = toText(
        source.promotedAt || source.createdAt || nowIso()
    );
    const createdAt = toText(source.createdAt || promotedAt || nowIso());
    const archivedAt = toText(source.archivedAt || '');
    const baselineId =
        toText(
            source.baselineId ||
                source.id ||
                source.snapshotId ||
                source.sourceSnapshotId,
            ''
        ) || buildBaselineId();

    return {
        baselineId,
        clinicId: normalizedClinicId,
        label: toText(
            source.label ||
                source.name ||
                sourceSnapshot.label ||
                sourceSnapshot.clinicShortName ||
                sourceSnapshot.clinicName ||
                `${normalizedClinicId} baseline ${index + 1}`,
            `${normalizedClinicId} baseline ${index + 1}`
        ),
        reason: toText(source.reason || ''),
        summary: toText(
            source.summary ||
                sourceSnapshot.summary ||
                sourceSnapshot.supportCopy ||
                sourceSnapshot.decisionReason ||
                ''
        ),
        createdAt,
        promotedAt,
        archivedAt: archivedAt || null,
        isArchived: source.isArchived === true || Boolean(archivedAt),
        sourceSnapshotId:
            toText(
                source.sourceSnapshotId ||
                    sourceSnapshot.snapshotFileName ||
                    sourceSnapshot.snapshotId ||
                    sourceSnapshot.generatedAt ||
                    ''
            ) || null,
        sourceFingerprint:
            toText(
                source.sourceFingerprint ||
                    sourceSnapshot.profileFingerprint ||
                    sourceSnapshot.fingerprint ||
                    ''
            ) || null,
        releaseDecision: toText(
            source.releaseDecision ||
                sourceSnapshot.decision ||
                sourceSnapshot.decisionHint ||
                sourceSnapshot.tone ||
                ''
        ),
        snapshot: sourceSnapshot,
    };
}

function persistRegistryState(clinicId, state, storageOverride = null) {
    const normalized = normalizeRegistryState(state, clinicId);
    writeRegistryState(clinicId, normalized, storageOverride);
    return normalized;
}

export function listReleaseBaselines(clinicId, options = {}) {
    return readRegistryState(clinicId, options.storage).items;
}

export function getActiveReleaseBaseline(clinicId, options = {}) {
    const state = readRegistryState(clinicId, options.storage);
    return (
        state.items.find(
            (item) => item.baselineId === state.activeBaselineId
        ) || null
    );
}

export function promoteReleaseBaseline(clinicId, snapshot, options = {}) {
    const normalizedClinicId = toText(
        clinicId || snapshot?.clinicId,
        DEFAULT_CLINIC_ID
    );
    const state = readRegistryState(normalizedClinicId, options.storage);
    const baseline = normalizeBaselineRecord(
        {
            baselineId: buildBaselineId(),
            clinicId: normalizedClinicId,
            label: options.label,
            reason: options.reason,
            summary: options.summary,
            sourceSnapshotId:
                snapshot?.snapshotFileName ||
                snapshot?.snapshotId ||
                snapshot?.generatedAt ||
                '',
            sourceFingerprint:
                snapshot?.profileFingerprint || snapshot?.fingerprint || '',
            releaseDecision: snapshot?.decision || snapshot?.decisionHint || '',
            snapshot: cloneValue(snapshot || {}),
            createdAt: nowIso(),
            promotedAt: nowIso(),
        },
        normalizedClinicId,
        0
    );

    const nextItems = [
        baseline,
        ...state.items.filter(
            (item) => item.baselineId !== baseline.baselineId
        ),
    ];
    const nextState = persistRegistryState(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            activeBaselineId: baseline.baselineId,
            items: nextItems,
        },
        options.storage
    );

    return (
        nextState.items.find(
            (item) => item.baselineId === baseline.baselineId
        ) || baseline
    );
}

export function renameReleaseBaseline(
    clinicId,
    baselineId,
    label,
    options = {}
) {
    const normalizedClinicId = toText(clinicId, DEFAULT_CLINIC_ID);
    const state = readRegistryState(normalizedClinicId, options.storage);
    const nextLabel = toText(label, '');
    if (!toText(baselineId) || !nextLabel) {
        return null;
    }

    const nextItems = state.items.map((item) =>
        item.baselineId === baselineId ? { ...item, label: nextLabel } : item
    );
    const nextState = persistRegistryState(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            activeBaselineId: state.activeBaselineId,
            items: nextItems,
        },
        options.storage
    );

    return (
        nextState.items.find((item) => item.baselineId === baselineId) || null
    );
}

export function archiveReleaseBaseline(clinicId, baselineId, options = {}) {
    const normalizedClinicId = toText(clinicId, DEFAULT_CLINIC_ID);
    const targetBaselineId = toText(baselineId, '');
    if (!targetBaselineId) {
        return null;
    }

    const state = readRegistryState(normalizedClinicId, options.storage);
    let found = null;
    const nextItems = state.items.map((item) => {
        if (item.baselineId !== targetBaselineId) {
            return item;
        }

        found = {
            ...item,
            isArchived: true,
            archivedAt: nowIso(),
        };
        return found;
    });

    if (!found) {
        return null;
    }

    const nextState = persistRegistryState(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            activeBaselineId:
                state.activeBaselineId === targetBaselineId
                    ? ''
                    : state.activeBaselineId,
            items: nextItems,
        },
        options.storage
    );

    return (
        nextState.items.find((item) => item.baselineId === targetBaselineId) ||
        null
    );
}

export function restoreReleaseBaseline(clinicId, baselineId, options = {}) {
    const normalizedClinicId = toText(clinicId, DEFAULT_CLINIC_ID);
    const targetBaselineId = toText(baselineId, '');
    if (!targetBaselineId) {
        return null;
    }

    const state = readRegistryState(normalizedClinicId, options.storage);
    let found = null;
    const nextItems = state.items.map((item) => {
        if (item.baselineId !== targetBaselineId) {
            return item;
        }

        found = {
            ...item,
            isArchived: false,
            archivedAt: null,
        };
        return found;
    });

    if (!found) {
        return null;
    }

    const nextState = persistRegistryState(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            activeBaselineId: state.activeBaselineId,
            items: nextItems,
        },
        options.storage
    );

    return (
        nextState.items.find((item) => item.baselineId === targetBaselineId) ||
        null
    );
}

export function setActiveReleaseBaseline(clinicId, baselineId, options = {}) {
    const normalizedClinicId = toText(clinicId, DEFAULT_CLINIC_ID);
    const targetBaselineId = toText(baselineId, '');
    if (!targetBaselineId) {
        return clearActiveReleaseBaseline(normalizedClinicId, options);
    }

    const state = readRegistryState(normalizedClinicId, options.storage);
    const target = state.items.find(
        (item) =>
            item.baselineId === targetBaselineId && item.isArchived !== true
    );
    if (!target) {
        return null;
    }

    persistRegistryState(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            activeBaselineId: targetBaselineId,
            items: state.items,
        },
        options.storage
    );

    return getActiveReleaseBaseline(normalizedClinicId, options);
}

export function clearActiveReleaseBaseline(clinicId, options = {}) {
    const normalizedClinicId = toText(clinicId, DEFAULT_CLINIC_ID);
    const state = readRegistryState(normalizedClinicId, options.storage);
    persistRegistryState(
        normalizedClinicId,
        {
            clinicId: normalizedClinicId,
            activeBaselineId: '',
            items: state.items,
        },
        options.storage
    );
    return true;
}

export function getReleaseBaselineHistoryEntries(clinicId, options = {}) {
    return listReleaseBaselines(clinicId, options)
        .filter((item) => item && item.snapshot)
        .map((item) => ({
            ...cloneValue(item.snapshot),
            baselineId: item.baselineId,
            baselineLabel: item.label,
            baselineReason: item.reason,
            baselineSummary: item.summary,
            promotedAt: item.promotedAt,
            archivedAt: item.archivedAt,
            isArchived: item.isArchived === true,
            releaseDecision: item.releaseDecision,
            source: 'baseline-registry',
            savedAt: item.promotedAt || item.createdAt || nowIso(),
        }));
}

export function buildReleaseBaselineRegistryPack(clinicId, options = {}) {
    const normalizedClinicId = toText(clinicId, DEFAULT_CLINIC_ID);
    const items = listReleaseBaselines(normalizedClinicId, options);
    const active = getActiveReleaseBaseline(normalizedClinicId, options);

    return {
        clinicId: normalizedClinicId,
        generatedAt: nowIso(),
        total: items.length,
        archivedTotal: items.filter((item) => item.isArchived === true).length,
        activeBaselineId: active?.baselineId || null,
        active,
        items,
        history: getReleaseBaselineHistoryEntries(normalizedClinicId, options),
    };
}

export default buildReleaseBaselineRegistryPack;
