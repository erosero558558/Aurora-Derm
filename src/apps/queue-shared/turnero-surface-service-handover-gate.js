import { buildTurneroSurfaceServiceHandoverSnapshot } from './turnero-surface-service-handover-snapshot.js';

function toText(value, fallback = '') {
    const normalized = String(value ?? '').trim();
    return normalized || fallback;
}

function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}

function toArray(value) {
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeChecklistSummary(checklist) {
    const source = asObject(checklist);
    const summary = asObject(source.summary);
    const checks = toArray(source.checks).map((item) => asObject(item));
    const allFromChecks = checks.length;
    const passFromChecks = checks.filter((check) => check.pass === true).length;
    const failFromChecks = checks.filter((check) => check.pass !== true).length;

    return {
        all: Math.max(0, toNumber(summary.all || allFromChecks)),
        pass: Math.max(0, toNumber(summary.pass || passFromChecks)),
        fail: Math.max(0, toNumber(summary.fail || failFromChecks)),
        checks,
    };
}

function normalizePlaybookStatus(value) {
    const normalized = toText(value, 'ready').toLowerCase();
    if (['ready', 'done', 'published'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'review', 'pending', 'draft'].includes(normalized)) {
        return 'watch';
    }
    if (
        ['blocked', 'hold', 'alert', 'critical', 'error'].includes(normalized)
    ) {
        return 'blocked';
    }
    return 'watch';
}

function normalizeRosterStatus(value) {
    const normalized = toText(value, 'active').toLowerCase();
    if (['active', 'assigned', 'primary'].includes(normalized)) {
        return 'active';
    }
    if (
        ['backup', 'watch', 'standby', 'handoff', 'pending'].includes(
            normalized
        )
    ) {
        return 'watch';
    }
    if (
        ['blocked', 'inactive', 'alert', 'critical', 'error'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }
    return 'watch';
}

function normalizeSnapshots(input = {}) {
    const direct = Array.isArray(input.snapshots)
        ? input.snapshots
        : Array.isArray(input.surfacePacks)
          ? input.surfacePacks.map((item) => item?.snapshot || item)
          : input.snapshot
            ? [input.snapshot]
            : [];

    return direct
        .map((snapshot) => buildTurneroSurfaceServiceHandoverSnapshot(snapshot))
        .filter(Boolean);
}

function getSurfaceScore(band) {
    if (band === 'ready') {
        return 100;
    }
    if (band === 'watch') {
        return 72;
    }
    return 28;
}

function evaluateSnapshotState(snapshot, checklist, playbook, roster) {
    const runtimeState = toText(snapshot.runtimeState, 'unknown').toLowerCase();
    const truthState = toText(snapshot.truth, 'unknown').toLowerCase();
    const playbookState = toText(
        snapshot.playbookState,
        'missing'
    ).toLowerCase();
    const handoverMode = toText(snapshot.handoverMode, 'manual').toLowerCase();
    const supportChannel = toText(snapshot.supportChannel, '').toLowerCase();
    const primaryOwner = toText(snapshot.primaryOwner, '');
    const backupOwner = toText(snapshot.backupOwner, '');

    const playbookStates = playbook.map((entry) =>
        normalizePlaybookStatus(entry.status || entry.state)
    );
    const rosterStates = roster.map((entry) =>
        normalizeRosterStatus(entry.status || entry.state)
    );

    const readyPlaybookCount = playbookStates.filter(
        (status) => status === 'ready'
    ).length;
    const blockedPlaybookCount = playbookStates.filter(
        (status) => status === 'blocked'
    ).length;
    const watchPlaybookCount = playbookStates.filter(
        (status) => status === 'watch'
    ).length;
    const activeOwnerCount = rosterStates.filter(
        (status) => status === 'active'
    ).length;
    const blockedRosterCount = rosterStates.filter(
        (status) => status === 'blocked'
    ).length;
    const watchRosterCount = rosterStates.filter(
        (status) => status === 'watch'
    ).length;

    const hasPrimaryOwner = Boolean(primaryOwner);
    const hasBackupOwner = Boolean(backupOwner);
    const hasBothOwners = hasPrimaryOwner && hasBackupOwner;
    const hasSupport = Boolean(supportChannel);
    const checklistBand =
        checklist.all > 0 && checklist.fail >= 2
            ? 'blocked'
            : checklist.all > 0 && checklist.pass === 0
              ? 'watch'
              : 'ready';

    const hardBlockReasons = [];
    if (
        ['blocked', 'alert', 'critical', 'error'].includes(runtimeState)
    ) {
        hardBlockReasons.push('runtime');
    }
    if (['blocked', 'alert', 'critical', 'error'].includes(truthState)) {
        hardBlockReasons.push('truth');
    }
    if (['blocked', 'alert', 'critical', 'error'].includes(playbookState)) {
        hardBlockReasons.push('playbook-state');
    }
    if (['blocked', 'alert', 'critical', 'error'].includes(handoverMode)) {
        hardBlockReasons.push('handover-mode');
    }
    if (['blocked', 'alert', 'critical', 'error'].includes(supportChannel)) {
        hardBlockReasons.push('support-channel');
    }
    if (blockedPlaybookCount > 0) {
        hardBlockReasons.push('playbook-ledger');
    }
    if (blockedRosterCount > 0) {
        hardBlockReasons.push('owner-roster');
    }
    if (checklistBand === 'blocked') {
        hardBlockReasons.push('checklist');
    }
    if (!snapshot.surfaceKey) {
        hardBlockReasons.push('surface');
    }

    const manualBlocked =
        handoverMode === 'manual' &&
        (!hasBothOwners || !hasSupport || playbookState === 'missing');
    if (manualBlocked) {
        hardBlockReasons.push('manual-handover');
    }

    const watchSignals = [];
    if (
        ['watch', 'warning', 'review', 'unknown'].includes(runtimeState)
    ) {
        watchSignals.push('runtime');
    }
    if (['watch', 'warning', 'review', 'unknown'].includes(truthState)) {
        watchSignals.push('truth');
    }
    if (playbookState === 'watch' || playbookState === 'draft') {
        watchSignals.push('playbook-state');
    }
    if (handoverMode === 'guided') {
        watchSignals.push('handover-mode');
    }
    if (checklistBand === 'watch') {
        watchSignals.push('checklist');
    }
    if (watchPlaybookCount > 0) {
        watchSignals.push('playbook-ledger');
    }
    if (watchRosterCount > 0) {
        watchSignals.push('owner-roster');
    }

    let band = 'ready';
    if (hardBlockReasons.length > 0) {
        band = 'blocked';
    } else if (watchSignals.length > 0 || !hasBothOwners) {
        band = 'watch';
    }

    const snapshotScore = getSurfaceScore(band);
    const checklistScore =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : snapshotScore;
    const playbookScore =
        playbook.length > 0
            ? (readyPlaybookCount / playbook.length) * 100
            : getSurfaceScore(
                  playbookState === 'ready'
                      ? 'ready'
                      : playbookState === 'watch'
                        ? 'watch'
                        : 'blocked'
              );
    const rosterScore =
        roster.length > 0
            ? (activeOwnerCount / roster.length) * 100
            : getSurfaceScore(hasBothOwners ? 'ready' : hasPrimaryOwner || hasBackupOwner ? 'watch' : 'blocked');

    let score =
        snapshotScore * 0.8 +
        checklistScore * 0.1 +
        playbookScore * 0.05 +
        rosterScore * 0.05;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    return {
        surfaceKey: snapshot.surfaceKey,
        surfaceLabel: snapshot.surfaceLabel,
        band,
        score,
        decision:
            band === 'ready'
                ? 'service-handover-ready'
                : band === 'watch'
                  ? 'review-service-handover'
                  : 'hold-service-handover',
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        playbookCount: playbook.length,
        readyPlaybookCount,
        watchPlaybookCount,
        blockedPlaybookCount,
        rosterCount: roster.length,
        activeOwnerCount,
        watchRosterCount,
        blockedRosterCount,
        snapshotState: {
            runtimeState,
            truthState,
            playbookState,
            handoverMode,
            supportChannel,
            primaryOwner,
            backupOwner,
            hasBothOwners,
            hasSupport,
            manualBlocked,
            hardBlockReasons,
            watchSignals,
        },
        generatedAt: new Date().toISOString(),
    };
}

function normalizeSurfaceState(surface, checklist, playbook, roster) {
    const snapshot = buildTurneroSurfaceServiceHandoverSnapshot(surface);
    const safePlaybook = toArray(playbook).map((item) => asObject(item));
    const safeRoster = toArray(roster).map((item) => asObject(item));
    const state = evaluateSnapshotState(
        snapshot,
        checklist,
        safePlaybook,
        safeRoster
    );

    return {
        snapshot,
        checklist,
        playbook: safePlaybook,
        roster: safeRoster,
        state,
    };
}

export function buildTurneroSurfaceServiceHandoverGate(input = {}) {
    const checklist = normalizeChecklistSummary(input.checklist);
    const playbook = toArray(input.playbook).map((item) => asObject(item));
    const roster = toArray(input.roster).map((item) => asObject(item));
    const snapshots = normalizeSnapshots(input);

    const surfaceStates = snapshots.map((surface) =>
        evaluateSnapshotState(
            surface,
            checklist,
            playbook.filter(
                (entry) =>
                    toText(entry.surfaceKey, '') === toText(surface.surfaceKey, '')
            ),
            roster.filter(
                (entry) =>
                    toText(entry.surfaceKey, '') === toText(surface.surfaceKey, '')
            )
        )
    );

    const readySnapshotCount = surfaceStates.filter(
        (surface) => surface.band === 'ready'
    ).length;
    const watchSnapshotCount = surfaceStates.filter(
        (surface) => surface.band === 'watch'
    ).length;
    const blockedSnapshotCount = surfaceStates.filter(
        (surface) => surface.band === 'blocked'
    ).length;

    const readyPlaybookCount = playbook.filter(
        (entry) => normalizePlaybookStatus(entry.status || entry.state) === 'ready'
    ).length;
    const watchPlaybookCount = playbook.filter(
        (entry) => normalizePlaybookStatus(entry.status || entry.state) === 'watch'
    ).length;
    const blockedPlaybookCount = playbook.filter(
        (entry) =>
            normalizePlaybookStatus(entry.status || entry.state) === 'blocked'
    ).length;
    const activeOwnerCount = roster.filter(
        (entry) => normalizeRosterStatus(entry.status || entry.state) === 'active'
    ).length;
    const watchRosterCount = roster.filter(
        (entry) => normalizeRosterStatus(entry.status || entry.state) === 'watch'
    ).length;
    const blockedRosterCount = roster.filter(
        (entry) =>
            normalizeRosterStatus(entry.status || entry.state) === 'blocked'
    ).length;

    const snapshotScore =
        surfaceStates.length > 0
            ? surfaceStates.reduce((total, surface) => total + Number(surface.score || 0), 0) /
              surfaceStates.length
            : 0;
    const checklistScore =
        checklist.all > 0
            ? (checklist.pass / checklist.all) * 100
            : surfaceStates.length > 0
              ? snapshotScore
              : 0;
    const playbookScore =
        playbook.length > 0
            ? (readyPlaybookCount / playbook.length) * 100
            : surfaceStates.length > 0
              ? snapshotScore
              : checklistScore;
    const rosterScore =
        roster.length > 0
            ? (activeOwnerCount / roster.length) * 100
            : surfaceStates.length > 0
              ? snapshotScore
              : checklistScore;

    let score =
        snapshotScore * 0.7 +
        checklistScore * 0.15 +
        playbookScore * 0.075 +
        rosterScore * 0.075;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const hardBlock =
        blockedSnapshotCount > 0 ||
        blockedPlaybookCount > 0 ||
        blockedRosterCount > 0 ||
        (checklist.all > 0 && checklist.fail >= 2) ||
        surfaceStates.length === 0;

    const band = hardBlock
        ? 'blocked'
        : watchSnapshotCount > 0 ||
            watchPlaybookCount > 0 ||
            watchRosterCount > 0
          ? 'watch'
          : 'ready';

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'service-handover-ready'
                : band === 'watch'
                  ? 'review-service-handover'
                  : 'hold-service-handover',
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        playbookCount: playbook.length,
        readyPlaybookCount,
        watchPlaybookCount,
        blockedPlaybookCount,
        rosterCount: roster.length,
        activeOwnerCount,
        watchRosterCount,
        blockedRosterCount,
        snapshotCount: surfaceStates.length,
        readySnapshotCount,
        watchSnapshotCount,
        blockedSnapshotCount,
        surfaceStates,
        generatedAt: new Date().toISOString(),
    };
}

export { normalizeSurfaceState };
