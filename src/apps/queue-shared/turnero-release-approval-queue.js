import { asObject, toArray, toText } from './turnero-release-control-center.js';

const STORAGE_PREFIX = 'turnero.release.approvals.v1';
const VALID_STATUS = new Set([
    'requested',
    'approved',
    'rejected',
    'waived',
    'reopened',
    'cancelled',
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

function createId(prefix = 'approval') {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function key(clinicId) {
    return `${STORAGE_PREFIX}:${toText(clinicId, 'default')}`;
}

function normalizeStatus(value) {
    const normalized = toText(value, 'requested').toLowerCase();
    return VALID_STATUS.has(normalized) ? normalized : 'requested';
}

function normalizeItem(input = {}) {
    const source = asObject(input);
    const status = normalizeStatus(source.status);
    const requestedAt = toText(source.requestedAt, nowIso());
    const resolvedAt =
        source.resolvedAt === undefined || source.resolvedAt === null
            ? null
            : toText(source.resolvedAt);
    const statusHistory = toArray(source.statusHistory).map((entry) => ({
        at: toText(entry?.at, requestedAt),
        status: normalizeStatus(entry?.status || status),
        note: toText(entry?.note || ''),
    }));

    if (!statusHistory.length) {
        statusHistory.push({
            at: requestedAt,
            status,
            note: toText(source.note || ''),
        });
    }

    return {
        approvalId: toText(source.approvalId || source.id || createId()),
        clinicId: toText(source.clinicId || 'default'),
        reason: toText(source.reason || 'Approval required'),
        severity: toText(source.severity || 'medium'),
        blockingSignals: toArray(
            source.blockingSignals || source.signals || source.blockers
        ).map((entry) => toText(entry)),
        suggestedApprover: toText(source.suggestedApprover || 'ops'),
        status,
        requestedAt,
        resolvedAt,
        note: toText(source.note || ''),
        metadata: asObject(source.metadata),
        updatedAt: toText(source.updatedAt || requestedAt),
        statusHistory,
    };
}

function readItems(clinicId) {
    const storage = getStorage();
    if (!storage) {
        return [];
    }

    try {
        const raw = storage.getItem(key(clinicId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(normalizeItem) : [];
    } catch (_error) {
        return [];
    }
}

function writeItems(clinicId, items) {
    const storage = getStorage();
    const normalized = Array.isArray(items) ? items.map(normalizeItem) : [];

    if (storage) {
        storage.setItem(key(clinicId), JSON.stringify(normalized));
    }

    return normalized;
}

function patchItem(clinicId, approvalId, patch = {}) {
    const normalizedPatch = asObject(patch);
    const items = readItems(clinicId);
    let updatedItem = null;

    const nextItems = items.map((entry) => {
        if (entry.approvalId !== approvalId) {
            return entry;
        }

        const nextStatus = normalizeStatus(
            normalizedPatch.status || entry.status
        );
        const resolvedAt = ['approved', 'rejected', 'waived'].includes(
            nextStatus
        )
            ? normalizedPatch.resolvedAt || entry.resolvedAt || nowIso()
            : normalizedPatch.resolvedAt === undefined
              ? entry.resolvedAt
              : normalizedPatch.resolvedAt;
        const nextMetadata = {
            ...asObject(entry.metadata),
            ...asObject(normalizedPatch.metadata),
        };

        if (normalizedPatch.note) {
            nextMetadata.note = toText(normalizedPatch.note);
        }

        const merged = normalizeItem({
            ...entry,
            ...normalizedPatch,
            status: nextStatus,
            resolvedAt,
            metadata: nextMetadata,
            updatedAt: nowIso(),
            statusHistory:
                nextStatus === entry.status
                    ? toArray(entry.statusHistory)
                    : [
                          ...toArray(entry.statusHistory),
                          {
                              at: nowIso(),
                              status: nextStatus,
                              note: toText(normalizedPatch.note || ''),
                          },
                      ],
        });

        updatedItem = merged;
        return merged;
    });

    writeItems(clinicId, nextItems);
    return updatedItem;
}

export function listReleaseApprovalQueue(clinicId) {
    return readItems(clinicId).sort((left, right) =>
        String(right.requestedAt || '').localeCompare(
            String(left.requestedAt || '')
        )
    );
}

export function requestReleaseApproval(clinicId, input = {}) {
    const items = readItems(clinicId);
    const item = normalizeItem({
        ...asObject(input),
        clinicId: toText(clinicId, 'default'),
        status: 'requested',
    });

    items.unshift(item);
    writeItems(clinicId, items);
    return item;
}

export function approveReleaseApproval(clinicId, approvalId, note = '') {
    return patchItem(clinicId, approvalId, {
        status: 'approved',
        note,
    });
}

export function rejectReleaseApproval(clinicId, approvalId, note = '') {
    return patchItem(clinicId, approvalId, {
        status: 'rejected',
        note,
    });
}

export function waiveReleaseApproval(clinicId, approvalId, note = '') {
    return patchItem(clinicId, approvalId, {
        status: 'waived',
        note,
    });
}

export function reopenReleaseApproval(clinicId, approvalId, note = '') {
    return patchItem(clinicId, approvalId, {
        status: 'reopened',
        note,
        resolvedAt: null,
    });
}

export function buildReleaseApprovalQueuePack(clinicId) {
    const items = listReleaseApprovalQueue(clinicId);
    const pending = items.filter((entry) =>
        ['requested', 'reopened'].includes(entry.status)
    );
    const approved = items.filter((entry) => entry.status === 'approved');
    const rejected = items.filter((entry) => entry.status === 'rejected');
    const waived = items.filter((entry) => entry.status === 'waived');
    const cancelled = items.filter((entry) => entry.status === 'cancelled');

    return {
        clinicId: toText(clinicId, 'default'),
        items,
        pending,
        approved,
        rejected,
        waived,
        cancelled,
        blockingCount: pending.length,
        summary: pending.length
            ? `Aprobaciones pendientes: ${pending.length}`
            : 'Sin aprobaciones pendientes',
    };
}

export default buildReleaseApprovalQueuePack;
