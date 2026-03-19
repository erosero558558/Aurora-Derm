import {
    asObject,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';

export const DEFAULT_NAMESPACE = 'turnero.release.history.v1';
export const MAX_HISTORY_ITEMS = 30;

function nowIso() {
    return new Date().toISOString();
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
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch (_error) {
        return null;
    }
}

function safeParse(rawValue, fallbackValue) {
    if (!rawValue) {
        return fallbackValue;
    }

    try {
        return JSON.parse(rawValue);
    } catch (_error) {
        return fallbackValue;
    }
}

function toIsoTimestamp(value, fallbackValue = nowIso()) {
    const parsed = value ? new Date(value) : new Date(fallbackValue);
    if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
    }

    const fallback = new Date(fallbackValue);
    return Number.isNaN(fallback.getTime()) ? nowIso() : fallback.toISOString();
}

function sanitizeSegment(value) {
    return (
        toText(value, 'default-clinic')
            .toLowerCase()
            .replace(/[^a-z0-9]+/gi, '-')
            .replace(/^-+|-+$/g, '') || 'default-clinic'
    );
}

function toCompactTimestamp(value) {
    const parsed = value ? new Date(value) : new Date();
    if (Number.isNaN(parsed.getTime())) {
        return new Date()
            .toISOString()
            .replace(/[-:TZ.]/g, '')
            .slice(0, 14);
    }

    return parsed
        .toISOString()
        .replace(/[-:TZ.]/g, '')
        .slice(0, 14);
}

function buildSnapshotId(clinicId, timestamp) {
    const clinicSegment = sanitizeSegment(clinicId);
    const timeSegment = toCompactTimestamp(timestamp);
    const randomSegment = Math.random().toString(36).slice(2, 8);
    return `${clinicSegment}-${timeSegment}-${randomSegment}`;
}

function isEphemeralSnapshotId(value) {
    const normalized = toText(value).toLowerCase();
    return (
        !normalized ||
        normalized === 'current' ||
        normalized === 'live' ||
        normalized === 'ephemeral' ||
        normalized.startsWith('live-') ||
        normalized.startsWith('current-') ||
        normalized.startsWith('runtime-')
    );
}

function deriveClinicName(clinicProfile, fallbackValue = '') {
    const profile = asObject(clinicProfile);
    return (
        toText(
            profile.branding?.name ||
                profile.clinic_name ||
                profile.clinicName ||
                profile.name ||
                profile.displayName ||
                fallbackValue
        ) || toText(fallbackValue, 'Turnero')
    );
}

function deriveClinicShortName(clinicProfile, fallbackValue = '') {
    const profile = asObject(clinicProfile);
    const explicit = toText(
        profile.branding?.short_name ||
            profile.branding?.shortName ||
            profile.short_name ||
            profile.shortName ||
            profile.clinic_short_name ||
            profile.clinicShortName
    );
    if (explicit) {
        return explicit;
    }

    const name = deriveClinicName(profile, fallbackValue);
    const parts = name.split(/\s+/u).filter(Boolean);
    return parts.slice(0, 2).join(' ') || toText(fallbackValue, 'Turnero');
}

function normalizeIncidentEntry(entry, index = 0) {
    const item = asObject(entry);
    const label = toText(
        item.label ||
            item.title ||
            item.summary ||
            item.detail ||
            item.name ||
            item.code ||
            item.id ||
            `incident-${index + 1}`
    );
    const kind = toText(
        item.kind || item.code || item.source || item.type || item.id || label,
        `incident-${index + 1}`
    );
    const owner = toText(
        item.owner ||
            item.assignee ||
            item.recommendedOwner ||
            item.recommended_owner ||
            item.lane ||
            item.section ||
            'unknown',
        'unknown'
    ).toLowerCase();
    const severity = normalizeSeverity(
        item.severity || item.state || item.tone || item.status || 'info'
    );
    const detail = toText(
        item.detail || item.description || item.summary || item.note || ''
    );

    return {
        incidentId:
            toText(
                item.incidentId || item.incident_id || item.id || item.key || ''
            ) || `${kind}-${index + 1}`,
        kind,
        severity,
        owner,
        label,
        detail,
        source: toText(item.source || item.channel || 'history', 'history'),
        state: toText(item.state || item.status || severity, severity),
        updatedAt: toIsoTimestamp(
            item.updatedAt || item.updated_at || item.createdAt || item.savedAt
        ),
        tags: toArray(item.tags || item.labels)
            .map((entryValue) => toText(entryValue))
            .filter(Boolean),
    };
}

function normalizeSurfaceEntry(entry, index = 0) {
    const item = asObject(entry);
    const key = toText(
        item.key ||
            item.id ||
            item.name ||
            item.surface ||
            `surface-${index + 1}`
    );
    const status = normalizeSeverity(
        item.status || item.state || item.tone || 'info'
    );
    const releaseMode = toText(
        item.releaseMode || item.release_mode || item.mode || ''
    );

    return {
        key,
        label: toText(
            item.label || item.title || key || `surface-${index + 1}`
        ),
        status,
        releaseMode,
        detail: toText(item.detail || item.summary || item.note || ''),
        source: toText(item.source || item.channel || 'history', 'history'),
        updatedAt: toIsoTimestamp(
            item.updatedAt || item.updated_at || item.createdAt || item.savedAt
        ),
    };
}

function normalizeIncidentList(source) {
    const directIncidents = toArray(source.incidents);
    if (directIncidents.length) {
        return directIncidents.map((incident, index) =>
            normalizeIncidentEntry(incident, index)
        );
    }

    const snapshotIncidents = toArray(source.snapshot?.incidents);
    if (snapshotIncidents.length) {
        return snapshotIncidents.map((incident, index) =>
            normalizeIncidentEntry(incident, index)
        );
    }

    const signalEntries = asObject(source.signals);
    const flattened = Object.values(signalEntries).flatMap((signal) =>
        toArray(signal?.items).map((item, index) =>
            normalizeIncidentEntry(
                {
                    ...asObject(item),
                    owner: item?.owner || signal?.owner || 'unknown',
                    source: item?.source || signal?.key || 'signal',
                },
                index
            )
        )
    );

    return flattened.length ? flattened : [];
}

function normalizeSurfaceList(source, releaseMode) {
    const directSurfaces = toArray(source.surfaces);
    if (directSurfaces.length) {
        return directSurfaces.map((surface, index) =>
            normalizeSurfaceEntry(surface, index)
        );
    }

    const snapshotSurfaces = toArray(source.snapshot?.surfaces);
    if (snapshotSurfaces.length) {
        return snapshotSurfaces.map((surface, index) =>
            normalizeSurfaceEntry(surface, index)
        );
    }

    const signalEntries = asObject(source.signals);
    const flattened = Object.entries(signalEntries).map(
        ([key, signal], index) =>
            normalizeSurfaceEntry(
                {
                    key: signal?.key || key || `surface-${index + 1}`,
                    label: signal?.label || key || `surface-${index + 1}`,
                    status: signal?.state || signal?.status || signal?.tone,
                    releaseMode: signal?.releaseMode || releaseMode,
                    detail: signal?.summary || signal?.support || '',
                    source: signal?.source || 'signal',
                },
                index
            )
    );

    return flattened.filter(Boolean);
}

function sortSnapshotsAscending(snapshots) {
    return snapshots.slice().sort((left, right) => {
        const leftTime = new Date(
            left.savedAt || left.generatedAt || 0
        ).getTime();
        const rightTime = new Date(
            right.savedAt || right.generatedAt || 0
        ).getTime();

        if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
            return 0;
        }
        if (Number.isNaN(leftTime)) {
            return -1;
        }
        if (Number.isNaN(rightTime)) {
            return 1;
        }
        return leftTime - rightTime;
    });
}

function normalizeComparisonSelection(value) {
    const source = asObject(value);
    return {
        clinicId: toText(source.clinicId || 'default-clinic', 'default-clinic'),
        snapshotAId: toText(
            source.snapshotAId || source.aId || source.leftId || ''
        ),
        snapshotBId: toText(
            source.snapshotBId || source.bId || source.rightId || ''
        ),
        updatedAt: toIsoTimestamp(
            source.updatedAt || source.savedAt || source.createdAt
        ),
    };
}

function readStoredJson(storage, key, fallbackValue) {
    if (!storage) {
        return fallbackValue;
    }

    try {
        return safeParse(storage.getItem(key), fallbackValue);
    } catch (_error) {
        return fallbackValue;
    }
}

function writeStoredJson(storage, key, value) {
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

function removeStoredKey(storage, key) {
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

export function normalizeReleaseSnapshot(input = {}) {
    const source = asObject(input.snapshot || input);
    const parts = asObject(source.parts || input.parts);
    const clinicProfile = asObject(
        source.clinicProfile ||
            source.turneroClinicProfile ||
            parts.clinicProfile ||
            input.clinicProfile ||
            {}
    );
    const clinicId =
        toText(
            input.clinicId ||
                source.clinicId ||
                clinicProfile.clinic_id ||
                clinicProfile.clinicId ||
                parts.clinicId ||
                ''
        ) || 'default-clinic';
    const generatedAt = toIsoTimestamp(
        input.generatedAt ||
            source.generatedAt ||
            source.createdAt ||
            source.savedAt ||
            parts.generatedAt
    );
    const savedAt = toIsoTimestamp(
        input.savedAt || source.savedAt || generatedAt
    );
    const releaseMode = toText(
        input.releaseMode ||
            source.releaseMode ||
            clinicProfile.release?.mode ||
            clinicProfile.releaseMode ||
            parts.releaseMode ||
            'suite_v2'
    );
    const decision = toText(
        input.decision ||
            source.decision ||
            (source.alertCount > 0
                ? 'hold'
                : source.warningCount > 0
                  ? 'review'
                  : 'ready'),
        'ready'
    ).toLowerCase();
    const severity = normalizeSeverity(
        input.severity ||
            source.severity ||
            source.tone ||
            (decision === 'hold'
                ? 'alert'
                : decision === 'review'
                  ? 'warning'
                  : 'ready')
    );
    const summary = toText(
        input.summary ||
            source.summary ||
            source.evidenceSummary ||
            source.supportCopy ||
            source.decisionReason ||
            ''
    );
    const label = toText(
        input.label ||
            source.label ||
            source.title ||
            source.clinicName ||
            clinicProfile.branding?.name ||
            clinicProfile.name ||
            clinicId
    );
    const profileFingerprint = toText(
        input.profileFingerprint ||
            source.profileFingerprint ||
            clinicProfile.runtime_meta?.profileFingerprint ||
            clinicProfile.profileFingerprint ||
            parts.profileFingerprint ||
            ''
    );
    const clinicName = deriveClinicName(clinicProfile, label || clinicId);
    const clinicShortName = deriveClinicShortName(clinicProfile, clinicName);
    const incidents = normalizeIncidentList(source);
    const surfaces = normalizeSurfaceList(source, releaseMode);
    const snapshotIdRaw = toText(
        input.snapshotId ||
            source.snapshotId ||
            source.historySnapshotId ||
            source.id ||
            ''
    );
    const snapshotId = snapshotIdRaw || buildSnapshotId(clinicId, generatedAt);

    return {
        snapshotId,
        clinicId,
        clinicName,
        clinicShortName,
        generatedAt,
        savedAt,
        label,
        summary,
        decision,
        severity,
        profileFingerprint,
        releaseMode,
        incidents,
        incidentCount: incidents.length,
        surfaces,
        surfaceCount: surfaces.length,
        source: toText(input.source || source.source || 'runtime', 'runtime'),
        parts,
        turneroClinicProfile: asObject(
            source.turneroClinicProfile ||
                source.clinicProfile ||
                input.turneroClinicProfile ||
                input.clinicProfile ||
                parts.turneroClinicProfile ||
                parts.clinicProfile ||
                {}
        ),
        clinicProfile: asObject(
            source.clinicProfile ||
                source.turneroClinicProfile ||
                input.clinicProfile ||
                input.turneroClinicProfile ||
                parts.clinicProfile ||
                parts.turneroClinicProfile ||
                {}
        ),
        pilotReadiness: asObject(
            source.pilotReadiness ||
                source.turneroPilotReadiness ||
                input.pilotReadiness ||
                input.turneroPilotReadiness ||
                parts.pilotReadiness ||
                parts.turneroPilotReadiness ||
                {}
        ),
        turneroPilotReadiness: asObject(
            source.turneroPilotReadiness ||
                source.pilotReadiness ||
                input.turneroPilotReadiness ||
                input.pilotReadiness ||
                parts.turneroPilotReadiness ||
                parts.pilotReadiness ||
                {}
        ),
        remoteReleaseReadiness: asObject(
            source.remoteReleaseReadiness ||
                source.turneroRemoteReleaseReadiness ||
                input.remoteReleaseReadiness ||
                input.turneroRemoteReleaseReadiness ||
                parts.remoteReleaseReadiness ||
                parts.turneroRemoteReleaseReadiness ||
                {}
        ),
        turneroRemoteReleaseReadiness: asObject(
            source.turneroRemoteReleaseReadiness ||
                source.remoteReleaseReadiness ||
                input.turneroRemoteReleaseReadiness ||
                input.remoteReleaseReadiness ||
                parts.turneroRemoteReleaseReadiness ||
                parts.remoteReleaseReadiness ||
                {}
        ),
        publicShellDrift: asObject(
            source.publicShellDrift ||
                source.turneroPublicShellDrift ||
                input.publicShellDrift ||
                input.turneroPublicShellDrift ||
                parts.publicShellDrift ||
                parts.turneroPublicShellDrift ||
                {}
        ),
        turneroPublicShellDrift: asObject(
            source.turneroPublicShellDrift ||
                source.publicShellDrift ||
                input.turneroPublicShellDrift ||
                input.publicShellDrift ||
                parts.turneroPublicShellDrift ||
                parts.publicShellDrift ||
                {}
        ),
        releaseEvidenceBundle: asObject(
            source.releaseEvidenceBundle ||
                input.releaseEvidenceBundle ||
                parts.releaseEvidenceBundle ||
                {}
        ),
        localReadinessModel: asObject(
            source.localReadinessModel ||
                input.localReadinessModel ||
                parts.localReadinessModel ||
                {}
        ),
        remoteReleaseModel: asObject(
            source.remoteReleaseModel ||
                input.remoteReleaseModel ||
                parts.remoteReleaseModel ||
                {}
        ),
        publicShellDriftModel: asObject(
            source.publicShellDriftModel ||
                input.publicShellDriftModel ||
                parts.publicShellDriftModel ||
                {}
        ),
        snapshot: asObject(source.snapshot || input.snapshot),
        notes: toArray(input.notes || source.notes)
            .map((entry) => toText(entry))
            .filter(Boolean),
        meta: asObject(input.meta || source.meta),
    };
}

export function createReleaseHistoryStore(options = {}) {
    const namespace = toText(
        options.namespace || DEFAULT_NAMESPACE,
        DEFAULT_NAMESPACE
    );
    const storage = getStorage(options.storage);
    const maxItems = Number.isFinite(options.maxItems)
        ? Math.max(1, Math.floor(options.maxItems))
        : MAX_HISTORY_ITEMS;

    function keyForClinic(clinicId, suffix = 'history') {
        return `${namespace}:${sanitizeSegment(clinicId)}:${suffix}`;
    }

    function listKey(clinicId) {
        return keyForClinic(clinicId, 'history');
    }

    function baselineKey(clinicId) {
        return keyForClinic(clinicId, 'baseline');
    }

    function selectionKey(clinicId) {
        return keyForClinic(clinicId, 'selection');
    }

    function list(clinicId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const rawItems = readStoredJson(
            storage,
            listKey(normalizedClinicId),
            []
        );
        const sourceItems = Array.isArray(rawItems)
            ? rawItems
            : Array.isArray(rawItems?.snapshots)
              ? rawItems.snapshots
              : [];
        const normalizedItems = sourceItems
            .map((item) =>
                normalizeReleaseSnapshot({
                    ...asObject(item),
                    clinicId: normalizedClinicId,
                })
            )
            .filter((item) => item && item.snapshotId);
        const deduped = [];
        const seenIds = new Set();

        sortSnapshotsAscending(normalizedItems).forEach((item) => {
            if (seenIds.has(item.snapshotId)) {
                return;
            }
            seenIds.add(item.snapshotId);
            deduped.push(item);
        });

        return deduped.slice(-maxItems);
    }

    function persistList(clinicId, items) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const payload = sortSnapshotsAscending(items).slice(-maxItems);
        writeStoredJson(storage, listKey(normalizedClinicId), payload);
        return payload;
    }

    function find(clinicId, snapshotId) {
        const normalizedSnapshotId = toText(snapshotId);
        if (!normalizedSnapshotId) {
            return null;
        }

        return (
            list(clinicId).find(
                (item) => item.snapshotId === normalizedSnapshotId
            ) || null
        );
    }

    function save(clinicId, snapshotInput = {}) {
        const normalizedClinicId = sanitizeSegment(
            clinicId ||
                snapshotInput.clinicId ||
                snapshotInput.snapshot?.clinicId
        );
        const history = list(normalizedClinicId);
        const normalizedSnapshot = normalizeReleaseSnapshot({
            ...asObject(snapshotInput),
            clinicId: normalizedClinicId,
            savedAt: nowIso(),
        });

        if (
            isEphemeralSnapshotId(
                snapshotInput.snapshotId || snapshotInput.snapshot?.snapshotId
            ) ||
            history.some(
                (item) => item.snapshotId === normalizedSnapshot.snapshotId
            )
        ) {
            normalizedSnapshot.snapshotId = buildSnapshotId(
                normalizedClinicId,
                normalizedSnapshot.savedAt
            );
        }

        const nextHistory = history.filter(
            (item) => item.snapshotId !== normalizedSnapshot.snapshotId
        );
        nextHistory.push(normalizedSnapshot);
        persistList(normalizedClinicId, nextHistory);
        return normalizedSnapshot;
    }

    function remove(clinicId, snapshotId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const targetSnapshotId = toText(snapshotId);
        if (!targetSnapshotId) {
            return false;
        }

        const history = list(normalizedClinicId);
        const nextHistory = history.filter(
            (item) => item.snapshotId !== targetSnapshotId
        );
        if (nextHistory.length === history.length) {
            return false;
        }

        persistList(normalizedClinicId, nextHistory);

        if (getBaselineId(normalizedClinicId) === targetSnapshotId) {
            removeStoredKey(storage, baselineKey(normalizedClinicId));
        }

        const selection = getComparisonSelection(normalizedClinicId);
        if (
            selection.snapshotAId === targetSnapshotId ||
            selection.snapshotBId === targetSnapshotId
        ) {
            clearComparisonSelection(normalizedClinicId);
        }

        return true;
    }

    function clear(clinicId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        removeStoredKey(storage, listKey(normalizedClinicId));
        removeStoredKey(storage, baselineKey(normalizedClinicId));
        removeStoredKey(storage, selectionKey(normalizedClinicId));
        return true;
    }

    function setBaseline(clinicId, snapshotId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const targetSnapshotId = toText(snapshotId);
        if (!targetSnapshotId) {
            removeStoredKey(storage, baselineKey(normalizedClinicId));
            return null;
        }

        const snapshot = find(normalizedClinicId, targetSnapshotId);
        if (!snapshot) {
            return null;
        }

        writeStoredJson(storage, baselineKey(normalizedClinicId), {
            clinicId: normalizedClinicId,
            snapshotId: targetSnapshotId,
            updatedAt: nowIso(),
        });
        return snapshot;
    }

    function getBaselineId(clinicId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const payload = readStoredJson(
            storage,
            baselineKey(normalizedClinicId),
            null
        );
        if (typeof payload === 'string') {
            return toText(payload);
        }
        if (payload && typeof payload === 'object') {
            return toText(
                payload.snapshotId || payload.baselineSnapshotId || ''
            );
        }
        return '';
    }

    function getBaseline(clinicId) {
        const baselineSnapshotId = getBaselineId(clinicId);
        if (!baselineSnapshotId) {
            return null;
        }

        return find(clinicId, baselineSnapshotId);
    }

    function getComparisonSelection(clinicId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const payload = readStoredJson(
            storage,
            selectionKey(normalizedClinicId),
            null
        );
        if (!payload) {
            return {
                clinicId: normalizedClinicId,
                snapshotAId: '',
                snapshotBId: '',
                updatedAt: '',
            };
        }

        const normalized = normalizeComparisonSelection({
            ...asObject(payload),
            clinicId: normalizedClinicId,
        });

        if (
            !payload ||
            normalized.snapshotAId !==
                toText(payload.snapshotAId || payload.aId || '') ||
            normalized.snapshotBId !==
                toText(payload.snapshotBId || payload.bId || '')
        ) {
            writeStoredJson(
                storage,
                selectionKey(normalizedClinicId),
                normalized
            );
        }

        return normalized;
    }

    function setComparisonSelection(clinicId, selectionInput = {}) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        const normalized = normalizeComparisonSelection({
            ...asObject(selectionInput),
            clinicId: normalizedClinicId,
            updatedAt: nowIso(),
        });

        if (!normalized.snapshotAId && !normalized.snapshotBId) {
            removeStoredKey(storage, selectionKey(normalizedClinicId));
            return normalized;
        }

        writeStoredJson(storage, selectionKey(normalizedClinicId), normalized);
        return normalized;
    }

    function clearComparisonSelection(clinicId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        removeStoredKey(storage, selectionKey(normalizedClinicId));
        return true;
    }

    function exportClinic(clinicId) {
        const normalizedClinicId = sanitizeSegment(clinicId);
        return {
            namespace,
            clinicId: normalizedClinicId,
            generatedAt: nowIso(),
            baselineSnapshotId: getBaselineId(normalizedClinicId),
            comparisonSelection: getComparisonSelection(normalizedClinicId),
            snapshots: list(normalizedClinicId),
        };
    }

    return {
        namespace,
        maxItems,
        storage,
        keyForClinic,
        list,
        save,
        remove,
        clear,
        setBaseline,
        getBaselineId,
        getBaseline,
        find,
        exportClinic,
        getComparisonSelection,
        setComparisonSelection,
        clearComparisonSelection,
    };
}

export default createReleaseHistoryStore;
