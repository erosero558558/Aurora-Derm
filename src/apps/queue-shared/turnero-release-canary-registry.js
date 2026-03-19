import { asObject, toArray, toText } from './turnero-release-control-center.js';

const STORAGE_PREFIX = 'turnero.release.canary.v1';
const VALID_STATES = new Set([
    'draft',
    'armed',
    'live',
    'hold',
    'rolled_back',
    'completed',
    'archived',
]);

function getStorage() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            return window.localStorage;
        }
    } catch (_error) {
        return null;
    }

    return null;
}

function nowIso() {
    return new Date().toISOString();
}

function createId(prefix = 'canary') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function key(clinicId) {
    return `${STORAGE_PREFIX}:${toText(clinicId, 'default')}`;
}

function clampNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeState(value) {
    const normalized = toText(value, 'draft').toLowerCase();
    return VALID_STATES.has(normalized) ? normalized : 'draft';
}

function normalizeCampaign(input = {}) {
    const source = asObject(input);
    const createdAt = toText(source.createdAt, nowIso());
    const state = normalizeState(source.state);
    const statusHistory = toArray(source.statusHistory).map((entry) => ({
        at: toText(entry?.at, createdAt),
        state: normalizeState(entry?.state || state),
        note: toText(entry?.note || ''),
    }));

    if (!statusHistory.length) {
        statusHistory.push({
            at: createdAt,
            state,
            note: toText(source.note || ''),
        });
    }

    return {
        campaignId: toText(source.campaignId || source.id || createId()),
        clinicId: toText(source.clinicId || 'default'),
        label: toText(source.label || source.name || 'Canary campaign'),
        owner: toText(source.owner || 'ops'),
        state,
        budget: clampNumber(source.budget, 100),
        maxErrorRate: clampNumber(source.maxErrorRate, 0.05),
        maxDurationMinutes: clampNumber(source.maxDurationMinutes, 180),
        targets: toArray(
            source.targets || source.clinics || source.surfaces
        ).map((entry) => toText(entry)),
        notes: toArray(source.notes).map((entry) => toText(entry)),
        baselineId: toText(
            source.baselineId || source.baselineSnapshotId || ''
        ),
        scoreAtStart:
            source.scoreAtStart == null || source.scoreAtStart === ''
                ? null
                : clampNumber(source.scoreAtStart, 0),
        gatesAtStart: toArray(source.gatesAtStart).map((entry) =>
            toText(entry)
        ),
        createdAt,
        updatedAt: toText(source.updatedAt || createdAt),
        startedAt: source.startedAt ? toText(source.startedAt) : null,
        endedAt: source.endedAt ? toText(source.endedAt) : null,
        archivedAt: source.archivedAt ? toText(source.archivedAt) : null,
        statusHistory,
        metadata: asObject(source.metadata),
    };
}

function readCampaigns(clinicId) {
    const storage = getStorage();
    if (!storage) {
        return [];
    }

    try {
        const raw = storage.getItem(key(clinicId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeCampaign) : [];
    } catch (_error) {
        return [];
    }
}

function writeCampaigns(clinicId, campaigns) {
    const storage = getStorage();
    const normalized = Array.isArray(campaigns)
        ? campaigns.map(normalizeCampaign)
        : [];

    if (storage) {
        storage.setItem(key(clinicId), JSON.stringify(normalized));
    }

    return normalized;
}

function patchCampaign(clinicId, campaignId, patch = {}) {
    const normalizedPatch = asObject(patch);
    const campaigns = readCampaigns(clinicId);
    let updatedCampaign = null;

    const nextCampaigns = campaigns.map((entry) => {
        if (entry.campaignId !== campaignId) {
            return entry;
        }

        const nextState = normalizeState(
            normalizedPatch.state || entry.state || 'draft'
        );
        const changedState = nextState !== entry.state;
        const nextMetadata = {
            ...asObject(entry.metadata),
            ...asObject(normalizedPatch.metadata),
        };

        if (normalizedPatch.note) {
            nextMetadata.note = toText(normalizedPatch.note);
        }
        if (normalizedPatch.holdNote) {
            nextMetadata.holdNote = toText(normalizedPatch.holdNote);
        }
        if (normalizedPatch.rollbackReason) {
            nextMetadata.rollbackReason = toText(
                normalizedPatch.rollbackReason
            );
        }

        const merged = normalizeCampaign({
            ...entry,
            ...normalizedPatch,
            state: nextState,
            metadata: nextMetadata,
            updatedAt: nowIso(),
            startedAt:
                nextState === 'live'
                    ? entry.startedAt || nowIso()
                    : normalizedPatch.startedAt === undefined
                      ? entry.startedAt
                      : normalizedPatch.startedAt,
            endedAt: ['rolled_back', 'completed'].includes(nextState)
                ? normalizedPatch.endedAt || entry.endedAt || nowIso()
                : normalizedPatch.endedAt === undefined
                  ? entry.endedAt
                  : normalizedPatch.endedAt,
            archivedAt:
                nextState === 'archived'
                    ? normalizedPatch.archivedAt || entry.archivedAt || nowIso()
                    : normalizedPatch.archivedAt === undefined
                      ? entry.archivedAt
                      : normalizedPatch.archivedAt,
            statusHistory: changedState
                ? [
                      ...toArray(entry.statusHistory),
                      {
                          at: nowIso(),
                          state: nextState,
                          note: toText(
                              normalizedPatch.note ||
                                  normalizedPatch.holdNote ||
                                  normalizedPatch.rollbackReason ||
                                  ''
                          ),
                      },
                  ]
                : toArray(entry.statusHistory),
        });

        updatedCampaign = merged;
        return merged;
    });

    writeCampaigns(clinicId, nextCampaigns);
    return updatedCampaign;
}

export function listReleaseCanaryCampaigns(clinicId) {
    return readCampaigns(clinicId).sort((left, right) =>
        String(right.createdAt || '').localeCompare(
            String(left.createdAt || '')
        )
    );
}

export function getActiveReleaseCanaryCampaign(clinicId) {
    return (
        listReleaseCanaryCampaigns(clinicId).find((entry) =>
            ['armed', 'live', 'hold'].includes(entry.state)
        ) || null
    );
}

export function createReleaseCanaryCampaign(clinicId, input = {}) {
    const campaigns = readCampaigns(clinicId);
    const campaign = normalizeCampaign({
        ...asObject(input),
        clinicId: toText(clinicId, 'default'),
    });

    campaigns.unshift(campaign);
    writeCampaigns(clinicId, campaigns);
    return campaign;
}

export function armReleaseCanaryCampaign(clinicId, campaignId, patch = {}) {
    return patchCampaign(clinicId, campaignId, {
        ...asObject(patch),
        state: 'armed',
    });
}

export function startReleaseCanaryCampaign(clinicId, campaignId, patch = {}) {
    return patchCampaign(clinicId, campaignId, {
        ...asObject(patch),
        state: 'live',
        startedAt: patch?.startedAt || nowIso(),
    });
}

export function holdReleaseCanaryCampaign(clinicId, campaignId, note = '') {
    return patchCampaign(clinicId, campaignId, {
        state: 'hold',
        holdNote: note,
        metadata: note ? { holdNote: toText(note) } : {},
    });
}

export function resumeReleaseCanaryCampaign(clinicId, campaignId) {
    return patchCampaign(clinicId, campaignId, {
        state: 'live',
    });
}

export function rollbackReleaseCanaryCampaign(
    clinicId,
    campaignId,
    reason = ''
) {
    return patchCampaign(clinicId, campaignId, {
        state: 'rolled_back',
        endedAt: nowIso(),
        rollbackReason: reason,
        metadata: reason ? { rollbackReason: toText(reason) } : {},
    });
}

export function completeReleaseCanaryCampaign(clinicId, campaignId) {
    return patchCampaign(clinicId, campaignId, {
        state: 'completed',
        endedAt: nowIso(),
    });
}

export function archiveReleaseCanaryCampaign(clinicId, campaignId) {
    return patchCampaign(clinicId, campaignId, {
        state: 'archived',
        archivedAt: nowIso(),
    });
}

export function buildReleaseCanaryRegistryPack(clinicId) {
    const campaigns = listReleaseCanaryCampaigns(clinicId);
    const active = getActiveReleaseCanaryCampaign(clinicId);
    const counts = campaigns.reduce(
        (accumulator, entry) => {
            accumulator.total += 1;
            accumulator.byState[entry.state] =
                (accumulator.byState[entry.state] || 0) + 1;
            return accumulator;
        },
        { total: 0, byState: {} }
    );

    return {
        clinicId: toText(clinicId, 'default'),
        active,
        campaigns,
        counts,
        summary: active
            ? `Canary activo: ${active.label} (${active.state}) | campañas: ${counts.total}`
            : `Sin canary activo | campañas: ${counts.total}`,
    };
}

export default buildReleaseCanaryRegistryPack;
