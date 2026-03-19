import { buildReleaseSnapshotDiff } from './turnero-release-snapshot-diff.js';
import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';
import { toArray, toText } from './turnero-release-control-center.js';

function formatFingerprint(value) {
    const text = toText(value);
    if (text.length <= 12) {
        return text;
    }

    return `${text.slice(0, 6)}…${text.slice(-4)}`;
}

function countByKey(counts, key) {
    const normalizedKey = toText(key, 'unknown');
    counts[normalizedKey] = (counts[normalizedKey] || 0) + 1;
}

function buildTopDeltas(diff) {
    return toArray(diff?.changes)
        .slice(0, 8)
        .map((change) => ({
            kind: change.kind,
            label: change.label,
            owner: change.owner || '',
            severity:
                change.severity ||
                change.after?.severity ||
                change.before?.severity ||
                '',
            summary: change.summary || '',
            before:
                change.kind === 'scalar-profileFingerprint'
                    ? formatFingerprint(change.before)
                    : toText(
                          change.before?.label ||
                              change.before?.title ||
                              change.before
                      ),
            after:
                change.kind === 'scalar-profileFingerprint'
                    ? formatFingerprint(change.after)
                    : toText(
                          change.after?.label ||
                              change.after?.title ||
                              change.after
                      ),
            priority: change.priority || 0,
        }));
}

function normalizeTimelineSnapshot(snapshot) {
    return normalizeReleaseSnapshot(snapshot || {});
}

function compareSnapshotDates(left, right) {
    const leftTime = new Date(left.savedAt || left.generatedAt || 0).getTime();
    const rightTime = new Date(
        right.savedAt || right.generatedAt || 0
    ).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
        return 0;
    }
    if (Number.isNaN(leftTime)) {
        return 1;
    }
    if (Number.isNaN(rightTime)) {
        return -1;
    }

    return rightTime - leftTime;
}

function buildTimelineRow(snapshot, options = {}) {
    const normalized = normalizeTimelineSnapshot(snapshot);
    const baselineSnapshotId = toText(options.baselineSnapshotId);
    const selectedSnapshotAId = toText(options.selectedSnapshotAId);
    const selectedSnapshotBId = toText(options.selectedSnapshotBId);
    const currentSnapshotId = toText(options.currentSnapshotId);

    return {
        snapshotId: normalized.snapshotId,
        clinicId: normalized.clinicId,
        clinicName: normalized.clinicName,
        clinicShortName: normalized.clinicShortName,
        label: normalized.label,
        summary: normalized.summary,
        decision: normalized.decision,
        severity: normalized.severity,
        generatedAt: normalized.generatedAt,
        savedAt: normalized.savedAt,
        incidentCount: normalized.incidentCount,
        surfaceCount: normalized.surfaceCount,
        baselineSnapshotId,
        selectedSnapshotAId,
        selectedSnapshotBId,
        currentSnapshotId,
        isBaseline: normalized.snapshotId === baselineSnapshotId,
        isSelectedA: normalized.snapshotId === selectedSnapshotAId,
        isSelectedB: normalized.snapshotId === selectedSnapshotBId,
        isCurrent: normalized.snapshotId === currentSnapshotId,
    };
}

export function compareSnapshotAgainstBaseline(
    currentSnapshot,
    baselineSnapshot
) {
    const normalizedCurrent = currentSnapshot
        ? normalizeReleaseSnapshot(currentSnapshot)
        : null;
    const normalizedBaseline = baselineSnapshot
        ? normalizeReleaseSnapshot(baselineSnapshot)
        : null;

    if (!normalizedCurrent) {
        return {
            ok: false,
            reason: 'current_missing',
            diff: null,
            topDeltas: [],
            ownerDeltaCounts: {},
            severityDeltaCounts: {},
        };
    }

    if (!normalizedBaseline) {
        return {
            ok: false,
            reason: 'baseline_missing',
            diff: null,
            topDeltas: [],
            ownerDeltaCounts: {},
            severityDeltaCounts: {},
        };
    }

    const diff = buildReleaseSnapshotDiff(
        normalizedBaseline,
        normalizedCurrent
    );
    const ownerDeltaCounts = {};
    const severityDeltaCounts = {};

    toArray(diff?.incidents?.added).forEach((incident) => {
        countByKey(ownerDeltaCounts, incident.owner);
        countByKey(
            severityDeltaCounts,
            `incident:${incident.severity || 'info'}`
        );
    });

    toArray(diff?.incidents?.removed).forEach((incident) => {
        countByKey(ownerDeltaCounts, incident.owner);
        countByKey(
            severityDeltaCounts,
            `incident:${incident.severity || 'info'}`
        );
    });

    toArray(diff?.incidents?.severityChanges).forEach((change) => {
        countByKey(ownerDeltaCounts, change.owner);
        countByKey(
            severityDeltaCounts,
            `incident:${change.beforeSeverity || 'info'}→${change.afterSeverity || 'info'}`
        );
    });

    toArray(diff?.scalarChanges).forEach((change) => {
        if (change.field === 'severity') {
            countByKey(
                severityDeltaCounts,
                `scalar:${toText(change.before, 'info')}→${toText(change.after, 'info')}`
            );
        }
        if (change.field === 'decision') {
            countByKey(
                severityDeltaCounts,
                `decision:${toText(change.before, 'ready')}→${toText(change.after, 'ready')}`
            );
        }
    });

    const topDeltas = buildTopDeltas(diff);
    const ok = !diff?.hasChanges;
    const reason = ok ? 'no_changes' : 'changes_detected';

    return {
        ok,
        reason,
        diff,
        topDeltas,
        ownerDeltaCounts,
        severityDeltaCounts,
    };
}

export function buildHistoryTimeline(snapshots, options = {}) {
    return toArray(snapshots)
        .map((snapshot) => buildTimelineRow(snapshot, options))
        .sort(compareTimelineRows);
}

function compareTimelineRows(left, right) {
    if (left.isCurrent !== right.isCurrent) {
        return left.isCurrent ? -1 : 1;
    }
    if (left.isBaseline !== right.isBaseline) {
        return left.isBaseline ? -1 : 1;
    }

    return compareSnapshotDates(left, right);
}

export default compareSnapshotAgainstBaseline;
