const STORAGE_PREFIX = 'turneroReleaseOwnerStateV1';
const OWNER_KEYS = ['deploy', 'backend', 'frontend', 'ops', 'unknown'];

function getStorage() {
    try {
        return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (_error) {
        return null;
    }
}

function normalizeClinicId(value) {
    return String(value || 'default-clinic').trim() || 'default-clinic';
}

function toStorageKey(clinicId) {
    return `${STORAGE_PREFIX}:${normalizeClinicId(clinicId)}`;
}

function asObject(value) {
    return value && typeof value === 'object' ? value : {};
}

function normalizeOwner(value) {
    const owner = String(value || 'unknown')
        .trim()
        .toLowerCase();
    return OWNER_KEYS.includes(owner) ? owner : 'unknown';
}

function normalizeLaneState(value = {}) {
    const source = asObject(value);
    const status = String(source.status || 'pending')
        .trim()
        .toLowerCase();

    return {
        owner: normalizeOwner(source.owner),
        acknowledged: Boolean(source.acknowledged),
        status: ['pending', 'working', 'blocked', 'done'].includes(status)
            ? status
            : 'pending',
        note: String(source.note || '').trim(),
        updatedAt: String(source.updatedAt || new Date().toISOString()).trim(),
        updatedBy: String(source.updatedBy || 'local').trim(),
    };
}

function normalizeStateMap(value) {
    const source = asObject(value);
    const next = {};

    OWNER_KEYS.forEach((owner) => {
        next[owner] = normalizeLaneState({
            owner,
            ...(source[owner] || {}),
        });
    });

    return next;
}

export function readTurneroReleaseOwnerState(clinicId) {
    const storage = getStorage();
    if (!storage) {
        return normalizeStateMap({});
    }

    try {
        const raw = storage.getItem(toStorageKey(clinicId));
        return normalizeStateMap(raw ? JSON.parse(raw) : {});
    } catch (_error) {
        return normalizeStateMap({});
    }
}

export function writeTurneroReleaseOwnerState(clinicId, stateMap) {
    const storage = getStorage();
    const normalized = normalizeStateMap(stateMap);
    if (!storage) {
        return normalized;
    }

    try {
        storage.setItem(toStorageKey(clinicId), JSON.stringify(normalized));
    } catch (_error) {
        return normalized;
    }

    return normalized;
}

export function updateTurneroReleaseOwnerLaneState(
    clinicId,
    owner,
    patch = {}
) {
    const current = readTurneroReleaseOwnerState(clinicId);
    const laneOwner = normalizeOwner(owner);
    current[laneOwner] = normalizeLaneState({
        ...current[laneOwner],
        ...asObject(patch),
        owner: laneOwner,
        updatedAt: new Date().toISOString(),
    });

    return writeTurneroReleaseOwnerState(clinicId, current);
}

export function clearTurneroReleaseOwnerLaneState(clinicId, owner) {
    const current = readTurneroReleaseOwnerState(clinicId);
    const laneOwner = normalizeOwner(owner);
    current[laneOwner] = normalizeLaneState({ owner: laneOwner });
    return writeTurneroReleaseOwnerState(clinicId, current);
}

export function clearTurneroReleaseOwnerState(clinicId) {
    const storage = getStorage();
    if (!storage) {
        return false;
    }

    try {
        storage.removeItem(toStorageKey(clinicId));
        return true;
    } catch (_error) {
        return false;
    }
}

export function buildTurneroReleaseOwnerStateStats(stateMap) {
    const lanes = Object.values(normalizeStateMap(stateMap));
    return lanes.reduce(
        (acc, lane) => {
            acc.total += 1;
            if (lane.acknowledged) acc.acknowledged += 1;
            if (lane.status === 'done') acc.done += 1;
            if (lane.status === 'working') acc.working += 1;
            if (lane.status === 'blocked') acc.blocked += 1;
            if (lane.status === 'pending') acc.pending += 1;
            return acc;
        },
        {
            total: 0,
            acknowledged: 0,
            done: 0,
            working: 0,
            blocked: 0,
            pending: 0,
        }
    );
}
