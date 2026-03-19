import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';
import { toArray, toText } from './turnero-release-control-center.js';

function clamp(value, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return min;
    }

    return Math.max(min, Math.min(max, parsed));
}

function compareSnapshotsDesc(left, right) {
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

function minutesBetween(isoA, isoB) {
    const a = isoA ? new Date(isoA).getTime() : NaN;
    const b = isoB ? new Date(isoB).getTime() : NaN;

    if (!Number.isFinite(a) || !Number.isFinite(b)) {
        return null;
    }

    return Math.round((b - a) / 60000);
}

function snapshotDecision(snapshot) {
    return toText(
        snapshot?.decision ||
            snapshot?.tone ||
            (Number(snapshot?.alertCount || 0) > 0
                ? 'hold'
                : Number(snapshot?.warningCount || 0) > 0
                  ? 'review'
                  : 'ready'),
        'ready'
    ).toLowerCase();
}

function snapshotSeverity(snapshot) {
    return toText(
        snapshot?.severity ||
            snapshot?.tone ||
            (Number(snapshot?.alertCount || 0) > 0
                ? 'alert'
                : Number(snapshot?.warningCount || 0) > 0
                  ? 'warning'
                  : 'ready'),
        'ready'
    ).toLowerCase();
}

export function computeReleaseSlaMonitor(input = {}) {
    const history = toArray(
        input.history || input.snapshots || input.historyPack?.snapshots
    )
        .map((snapshot) => normalizeReleaseSnapshot(snapshot || {}))
        .sort(compareSnapshotsDesc);
    const windowSize = Math.max(1, Number(input.windowSize || 5));
    const recent = history.slice(0, windowSize);
    const readySnapshots = recent.filter(
        (snapshot) => snapshotDecision(snapshot) === 'ready'
    );
    const warningSnapshots = recent.filter((snapshot) =>
        ['review', 'warning'].includes(snapshotDecision(snapshot))
    );
    const holdSnapshots = recent.filter(
        (snapshot) =>
            ['hold', 'alert'].includes(snapshotDecision(snapshot)) ||
            snapshotSeverity(snapshot) === 'alert'
    );
    const lastReadySnapshot = readySnapshots[0] || null;
    const lastReadyAt = lastReadySnapshot
        ? lastReadySnapshot.savedAt || lastReadySnapshot.generatedAt || null
        : null;
    const nowIso = new Date().toISOString();
    const minutesSinceReady = lastReadyAt
        ? minutesBetween(lastReadyAt, nowIso)
        : null;
    const recentCritical = recent.reduce(
        (sum, snapshot) => sum + Number(snapshot.alertCount || 0),
        0
    );
    const recentWarning = recent.reduce(
        (sum, snapshot) => sum + Number(snapshot.warningCount || 0),
        0
    );
    const recentBreaches = [];

    if (holdSnapshots.length > 0) {
        recentBreaches.push(`${holdSnapshots.length} snapshot(s) con hold`);
    }
    if (warningSnapshots.length > Math.max(1, Math.ceil(windowSize / 2))) {
        recentBreaches.push(
            `warning recurrente en ${warningSnapshots.length} corridas`
        );
    }
    if (minutesSinceReady !== null && minutesSinceReady > 240) {
        recentBreaches.push(`último ready hace ${minutesSinceReady} min`);
    }
    if (recentCritical > 0) {
        recentBreaches.push(`críticos recientes: ${recentCritical}`);
    }

    const stableRecent =
        holdSnapshots.length === 0 && warningSnapshots.length <= 1;
    const slaStatus =
        recentBreaches.length === 0 && stableRecent
            ? 'healthy'
            : recentBreaches.length <= 2
              ? 'watch'
              : 'breached';
    const sloConfidence = clamp(
        92 -
            holdSnapshots.length * 20 -
            warningSnapshots.length * 8 -
            Math.max(0, recentCritical - readySnapshots.length) * 3,
        10,
        99
    );
    const errorBudgetRemaining = clamp(
        100 -
            holdSnapshots.length * 30 -
            warningSnapshots.length * 10 -
            (minutesSinceReady !== null && minutesSinceReady > 240 ? 10 : 0),
        0,
        100
    );
    const recoveryMomentum =
        holdSnapshots.length > 0
            ? 'down'
            : warningSnapshots.length > 1
              ? 'flat'
              : 'up';

    return {
        historyWindow: recent.length,
        windowSize,
        readyCount: readySnapshots.length,
        warningCount: warningSnapshots.length,
        holdCount: holdSnapshots.length,
        slaStatus,
        sloConfidence,
        errorBudgetRemaining,
        recentBreaches,
        recentCritical,
        recentWarning,
        lastReadyAt,
        minutesSinceReady,
        recoveryMomentum,
        summary: `SLA ${slaStatus} | confianza ${sloConfidence}% | error budget ${Math.round(
            errorBudgetRemaining
        )}/100 | breaches ${recentBreaches.length}`,
    };
}

export default computeReleaseSlaMonitor;
