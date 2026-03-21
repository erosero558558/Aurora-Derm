import { buildTurneroSurfaceOnboardingSnapshot } from './turnero-surface-onboarding-snapshot.js';
import { asObject, toArray, toString } from './turnero-surface-helpers.js';

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
        all: Math.max(0, toNumber(summary.all || source.all || allFromChecks)),
        pass: Math.max(
            0,
            toNumber(summary.pass || source.pass || passFromChecks)
        ),
        fail: Math.max(
            0,
            toNumber(summary.fail || source.fail || failFromChecks)
        ),
        checks,
    };
}

function normalizeCheckpointState(value, fallback = 'pending') {
    const normalized = toString(value, fallback).toLowerCase();
    if (
        ['ready', 'aligned', 'active', 'done', 'closed', 'confirmed'].includes(
            normalized
        )
    ) {
        return 'ready';
    }
    if (
        ['watch', 'warning', 'review', 'pending', 'draft', 'unknown'].includes(
            normalized
        )
    ) {
        return normalized === 'pending' ? 'pending' : 'watch';
    }
    if (
        ['blocked', 'alert', 'critical', 'error', 'missing'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }
    return fallback;
}

function scoreFromCheckpointState(value) {
    if (value === 'ready') {
        return 100;
    }
    if (value === 'watch') {
        return 64;
    }
    if (value === 'pending') {
        return 40;
    }
    return 0;
}

function normalizeLedgerStatus(value) {
    const normalized = toString(value, 'ready').toLowerCase();
    if (['ready', 'done', 'scheduled', 'closed'].includes(normalized)) {
        return 'ready';
    }
    if (['watch', 'pending', 'draft'].includes(normalized)) {
        return 'watch';
    }
    if (['blocked', 'alert', 'error'].includes(normalized)) {
        return 'blocked';
    }
    return 'watch';
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['active', 'ready'].includes(normalized)) {
        return 'active';
    }
    if (['watch', 'standby'].includes(normalized)) {
        return 'watch';
    }
    if (['blocked', 'inactive'].includes(normalized)) {
        return 'blocked';
    }
    return 'watch';
}

function getSurfaceScore(band) {
    if (band === 'ready') {
        return 100;
    }
    if (band === 'watch') {
        return 72;
    }
    if (band === 'degraded') {
        return 48;
    }
    return 18;
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
        .map((snapshot) => buildTurneroSurfaceOnboardingSnapshot(snapshot))
        .filter(Boolean);
}

function evaluateSnapshotState(snapshot, checklist, ledgerRows, ownerRows) {
    const kickoffState = normalizeCheckpointState(snapshot.kickoffState);
    const dataIntakeState = normalizeCheckpointState(snapshot.dataIntakeState);
    const accessState = normalizeCheckpointState(snapshot.accessState);
    const trainingState = snapshot.trainingWindow ? 'ready' : 'pending';
    const runtimeState = normalizeCheckpointState(snapshot.runtimeState, 'watch');
    const truthState = normalizeCheckpointState(snapshot.truth, 'watch');
    const checkpointStates = [
        kickoffState,
        dataIntakeState,
        accessState,
        trainingState,
    ];
    const checkpointScore =
        checkpointStates.reduce(
            (total, state) => total + scoreFromCheckpointState(state),
            0
        ) / checkpointStates.length;

    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : checkpointScore;
    const ledgerStates = ledgerRows.map((entry) =>
        normalizeLedgerStatus(entry.status || entry.state)
    );
    const readyLedgerCount = ledgerStates.filter(
        (status) => status === 'ready'
    ).length;
    const blockedLedgerCount = ledgerStates.filter(
        (status) => status === 'blocked'
    ).length;
    const ledgerPct =
        ledgerRows.length > 0 ? (readyLedgerCount / ledgerRows.length) * 100 : 100;

    const ownerStates = ownerRows.map((entry) =>
        normalizeOwnerStatus(entry.status || entry.state)
    );
    const activeOwnerCount = ownerStates.filter(
        (status) => status === 'active'
    ).length;
    const blockedOwnerCount = ownerStates.filter(
        (status) => status === 'blocked'
    ).length;
    const ownerPct =
        ownerRows.length > 0
            ? (activeOwnerCount / ownerRows.length) * 100
            : snapshot.onboardingOwner
              ? 100
              : 0;

    const hardBlockReasons = [];
    if (checklist.fail >= 2) {
        hardBlockReasons.push('checklist');
    }
    if (accessState === 'blocked') {
        hardBlockReasons.push('access');
    }
    if (blockedLedgerCount > 0) {
        hardBlockReasons.push('ledger');
    }
    if (blockedOwnerCount > 0) {
        hardBlockReasons.push('owners');
    }

    const watchSignals = [];
    if (kickoffState !== 'ready') {
        watchSignals.push('kickoff');
    }
    if (dataIntakeState !== 'ready') {
        watchSignals.push('data-intake');
    }
    if (accessState !== 'ready') {
        watchSignals.push('access');
    }
    if (trainingState !== 'ready') {
        watchSignals.push('training-window');
    }
    if (runtimeState !== 'ready') {
        watchSignals.push('runtime');
    }
    if (truthState !== 'ready') {
        watchSignals.push('truth');
    }
    if (!snapshot.onboardingOwner && activeOwnerCount <= 0) {
        watchSignals.push('owner');
    }

    let band = 'ready';
    if (hardBlockReasons.length > 0) {
        band = 'blocked';
    } else if (
        checklist.fail > 0 ||
        watchSignals.length > 1 ||
        checkpointStates.includes('pending') ||
        checkpointStates.includes('watch')
    ) {
        band = checklist.fail > 1 || watchSignals.length > 4 ? 'degraded' : 'watch';
    }

    let score =
        checkpointScore * 0.55 +
        checklistPct * 0.25 +
        ledgerPct * 0.1 +
        ownerPct * 0.1;

    score =
        band === 'ready'
            ? Math.max(score, 92)
            : band === 'watch'
              ? Math.min(Math.max(score, 70), 89.9)
              : band === 'degraded'
                ? Math.min(Math.max(score, 45), 69.9)
                : Math.min(score, 44.9);
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    return {
        surfaceKey: snapshot.surfaceKey,
        surfaceLabel: snapshot.surfaceLabel,
        band,
        score,
        decision:
            band === 'ready'
                ? 'onboarding-ready'
                : band === 'watch' || band === 'degraded'
                  ? 'review-onboarding'
                  : 'hold-onboarding',
        checkpointScore: Number(checkpointScore.toFixed(1)),
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledgerRows.length,
        readyLedgerCount,
        blockedLedgerCount,
        ownerCount: ownerRows.length,
        activeOwnerCount,
        blockedOwnerCount,
        states: {
            runtimeState,
            truthState,
            kickoffState,
            dataIntakeState,
            accessState,
            trainingState,
            hardBlockReasons,
            watchSignals,
        },
        generatedAt: new Date().toISOString(),
    };
}

export function buildTurneroSurfaceOnboardingGate(input = {}) {
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = toArray(input.ledger).map((item) => asObject(item));
    const owners = toArray(input.owners).map((item) => asObject(item));
    const snapshots = normalizeSnapshots(input);

    const surfaceStates = snapshots.map((surface) =>
        evaluateSnapshotState(
            surface,
            checklist,
            ledger.filter(
                (entry) =>
                    toString(entry.surfaceKey, '') ===
                    toString(surface.surfaceKey, '')
            ),
            owners.filter(
                (entry) =>
                    toString(entry.surfaceKey, '') ===
                    toString(surface.surfaceKey, '')
            )
        )
    );

    const blockedSnapshotCount = surfaceStates.filter(
        (item) => item.band === 'blocked'
    ).length;
    const degradedSnapshotCount = surfaceStates.filter(
        (item) => item.band === 'degraded'
    ).length;
    const watchSnapshotCount = surfaceStates.filter(
        (item) => item.band === 'watch'
    ).length;
    const readySnapshotCount = surfaceStates.filter(
        (item) => item.band === 'ready'
    ).length;
    const readyLedgerCount = ledger.filter(
        (entry) => normalizeLedgerStatus(entry.status || entry.state) === 'ready'
    ).length;
    const activeOwnerCount = owners.filter(
        (entry) => normalizeOwnerStatus(entry.status || entry.state) === 'active'
    ).length;

    let score =
        surfaceStates.length > 0
            ? surfaceStates.reduce((total, item) => total + item.score, 0) /
              surfaceStates.length
            : getSurfaceScore('blocked');
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    let band = 'blocked';
    if (blockedSnapshotCount > 0 || checklist.fail >= 2) {
        band = 'blocked';
    } else if (degradedSnapshotCount > 0 || score < 70) {
        band = 'degraded';
    } else if (watchSnapshotCount > 0 || score < 90) {
        band = 'watch';
    } else if (readySnapshotCount === surfaceStates.length && surfaceStates.length > 0) {
        band = 'ready';
    }

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'onboarding-ready'
                : band === 'watch' || band === 'degraded'
                  ? 'review-onboarding'
                  : 'hold-onboarding',
        snapshotCount: surfaceStates.length,
        readySnapshotCount,
        watchSnapshotCount,
        degradedSnapshotCount,
        blockedSnapshotCount,
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount,
        surfaceStates,
        generatedAt: new Date().toISOString(),
    };
}
