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
    return Array.isArray(value) ? value.filter(Boolean) : [];
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeChecklistSummary(checklist) {
    const source =
        checklist && typeof checklist === 'object'
            ? checklist.summary && typeof checklist.summary === 'object'
                ? checklist.summary
                : checklist
            : null;
    return {
        all: Math.max(0, toNumber(source?.all)),
        pass: Math.max(0, toNumber(source?.pass)),
        fail: Math.max(0, toNumber(source?.fail)),
    };
}

function normalizeLedgerStatus(value) {
    const normalized = toString(value, '').toLowerCase();
    if (
        ['blocked', 'alert', 'critical', 'error', 'failed'].includes(normalized)
    ) {
        return 'blocked';
    }
    if (
        ['watch', 'review', 'pending', 'draft', 'degraded'].includes(normalized)
    ) {
        return 'watch';
    }
    return 'ready';
}

function normalizeOwnerStatus(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (['blocked', 'alert'].includes(normalized)) {
        return 'blocked';
    }
    if (['active', 'ready', 'primary'].includes(normalized)) {
        return 'active';
    }
    if (['watch', 'standby', 'paused'].includes(normalized)) {
        return 'watch';
    }
    return 'inactive';
}

function scoreRenewalValueBand(value) {
    const normalized = toString(value, 'medium').toLowerCase();
    if (normalized === 'high') {
        return 100;
    }
    if (normalized === 'medium') {
        return 76;
    }
    if (normalized === 'low') {
        return 52;
    }
    return 32;
}

function scoreRetentionSignal(value) {
    const normalized = toString(value, 'stable').toLowerCase();
    if (normalized === 'expanding') {
        return 100;
    }
    if (normalized === 'stable') {
        return 84;
    }
    if (normalized === 'fragile') {
        return 44;
    }
    if (normalized === 'at-risk') {
        return 18;
    }
    return 60;
}

function scoreFeedbackState(value) {
    const normalized = toString(value, 'good').toLowerCase();
    if (normalized === 'good') {
        return 100;
    }
    if (normalized === 'mixed') {
        return 72;
    }
    if (normalized === 'neutral') {
        return 56;
    }
    if (normalized === 'bad') {
        return 18;
    }
    return 60;
}

function scoreActivityState(value) {
    const normalized = toString(value, 'active').toLowerCase();
    if (normalized === 'active') {
        return 100;
    }
    if (normalized === 'watch') {
        return 72;
    }
    if (normalized === 'idle') {
        return 48;
    }
    if (normalized === 'stalled') {
        return 20;
    }
    return 60;
}

function scorePendingCorrections(value) {
    const normalized = Math.max(0, toNumber(value));
    if (normalized <= 0) {
        return 100;
    }
    if (normalized === 1) {
        return 74;
    }
    if (normalized === 2) {
        return 48;
    }
    return 16;
}

function buildDecision(band) {
    switch (band) {
        case 'ready':
            return 'renewal-ready';
        case 'watch':
            return 'review-renewal-readiness';
        case 'degraded':
            return 'stabilize-renewal-readiness';
        default:
            return 'hold-renewal-readiness';
    }
}

function buildSummary(band) {
    if (band === 'ready') {
        return 'Renovacion lista para continuidad y retencion.';
    }
    if (band === 'watch') {
        return 'Renovacion visible, con seguimiento pendiente.';
    }
    if (band === 'degraded') {
        return 'Renovacion degradada; conviene estabilizar valor y owners.';
    }
    return 'Renovacion bloqueada por correcciones o senales duras.';
}

function buildDetail(snapshot, counts) {
    return [
        `value ${toString(snapshot.renewalValueBand, 'medium')}`,
        `retention ${toString(snapshot.retentionSignal, 'stable')}`,
        `feedback ${toString(snapshot.feedbackState, 'good')}`,
        `activity ${toString(snapshot.activityState, 'active')}`,
        `corrections ${Math.max(0, toNumber(snapshot.pendingCorrections))}`,
        `owner ${toString(snapshot.renewalOwner, 'sin owner') || 'sin owner'}`,
        `ledger ${counts.ledgerCount}`,
    ].join(' · ');
}

function buildBlockers(snapshot, checklist, ledger, owners) {
    const blockers = [];
    const runtimeState = toString(snapshot.runtimeState, 'unknown').toLowerCase();
    const truthState = toString(snapshot.truth, 'unknown').toLowerCase();
    const retentionSignal = toString(
        snapshot.retentionSignal,
        'stable'
    ).toLowerCase();
    const feedbackState = toString(snapshot.feedbackState, 'good').toLowerCase();
    const activityState = toString(snapshot.activityState, 'active').toLowerCase();
    const pendingCorrections = Math.max(0, toNumber(snapshot.pendingCorrections));
    const ledgerBlocked = ledger.some(
        (entry) => normalizeLedgerStatus(entry?.status) === 'blocked'
    );
    const ownerBlocked = owners.some(
        (entry) => normalizeOwnerStatus(entry?.status) === 'blocked'
    );

    if (checklist.fail >= 2) {
        blockers.push('checklist');
    }
    if (['blocked', 'alert', 'critical', 'error'].includes(runtimeState)) {
        blockers.push('runtime');
    }
    if (['blocked', 'alert', 'critical', 'error'].includes(truthState)) {
        blockers.push('truth');
    }
    if (pendingCorrections >= 3) {
        blockers.push('pending-corrections');
    }
    if (retentionSignal === 'at-risk') {
        blockers.push('retention');
    }
    if (feedbackState === 'bad' && activityState === 'stalled') {
        blockers.push('feedback');
    }
    if (ledgerBlocked) {
        blockers.push('ledger');
    }
    if (ownerBlocked) {
        blockers.push('owners');
    }

    return blockers;
}

function buildWarnings(snapshot, checklist, ledger, owners, coverage) {
    const warnings = [];
    const retentionSignal = toString(
        snapshot.retentionSignal,
        'stable'
    ).toLowerCase();
    const feedbackState = toString(snapshot.feedbackState, 'good').toLowerCase();
    const activityState = toString(snapshot.activityState, 'active').toLowerCase();
    const pendingCorrections = Math.max(0, toNumber(snapshot.pendingCorrections));

    if (checklist.fail === 1) {
        warnings.push('checklist');
    }
    if (!coverage.renewal) {
        warnings.push('missing-renewal-owner');
    }
    if (!coverage.commercial) {
        warnings.push('missing-commercial-owner');
    }
    if (!coverage.success) {
        warnings.push('missing-success-owner');
    }
    if (!toString(snapshot.nextRenewalWindow, '')) {
        warnings.push('missing-renewal-window');
    }
    if (pendingCorrections > 0) {
        warnings.push('pending-corrections');
    }
    if (retentionSignal === 'fragile') {
        warnings.push('retention');
    }
    if (feedbackState === 'mixed' || feedbackState === 'neutral') {
        warnings.push('feedback');
    }
    if (activityState === 'watch' || activityState === 'idle') {
        warnings.push('activity');
    }
    if (ledger.length === 0) {
        warnings.push('ledger-empty');
    }
    if (owners.length === 0) {
        warnings.push('owners-empty');
    }

    return warnings;
}

export function buildTurneroSurfaceRenewalGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const readyLedgerCount = ledger.filter(
        (entry) => normalizeLedgerStatus(entry?.status) === 'ready'
    ).length;
    const activeOwners = owners.filter(
        (entry) => normalizeOwnerStatus(entry?.status) === 'active'
    );
    const blockedOwners = owners.filter(
        (entry) => normalizeOwnerStatus(entry?.status) === 'blocked'
    );
    const coverage = {
        renewal:
            activeOwners.some(
                (entry) => toString(entry?.role, '').toLowerCase() === 'renewal'
            ) || Boolean(snapshot.renewalOwner),
        commercial:
            activeOwners.some(
                (entry) =>
                    toString(entry?.role, '').toLowerCase() === 'commercial'
            ) || Boolean(snapshot.commercialOwner),
        success:
            activeOwners.some(
                (entry) => toString(entry?.role, '').toLowerCase() === 'success'
            ) || Boolean(snapshot.successOwner),
    };
    const ownerCoverageScore =
        (Object.values(coverage).filter(Boolean).length / 3) * 100;
    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const valueScore = scoreRenewalValueBand(snapshot.renewalValueBand);
    const retentionScore = scoreRetentionSignal(snapshot.retentionSignal);
    const feedbackScore = scoreFeedbackState(snapshot.feedbackState);
    const activityScore = scoreActivityState(snapshot.activityState);
    const correctionsScore = scorePendingCorrections(snapshot.pendingCorrections);
    const ledgerScore =
        ledger.length > 0 ? (readyLedgerCount / ledger.length) * 100 : 0;

    let score =
        checklistPct * 0.22 +
        valueScore * 0.18 +
        retentionScore * 0.18 +
        feedbackScore * 0.12 +
        activityScore * 0.1 +
        ownerCoverageScore * 0.1 +
        correctionsScore * 0.06 +
        ledgerScore * 0.04;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const blockers = buildBlockers(snapshot, checklist, ledger, owners);
    const warnings = buildWarnings(snapshot, checklist, ledger, owners, coverage);

    let band = 'degraded';
    if (blockers.length > 0) {
        band = 'blocked';
    } else if (
        score >= 88 &&
        checklist.fail === 0 &&
        Math.max(0, toNumber(snapshot.pendingCorrections)) === 0 &&
        coverage.renewal &&
        coverage.success &&
        ['expanding', 'stable'].includes(
            toString(snapshot.retentionSignal, 'stable').toLowerCase()
        ) &&
        toString(snapshot.feedbackState, 'good').toLowerCase() === 'good' &&
        toString(snapshot.activityState, 'active').toLowerCase() === 'active'
    ) {
        band = 'ready';
    } else if (
        score >= 68 ||
        readyLedgerCount > 0 ||
        coverage.renewal ||
        coverage.success
    ) {
        band = 'watch';
    }

    return {
        scope: toString(snapshot.scope, 'regional'),
        surfaceKey: toString(snapshot.surfaceKey, 'surface'),
        score,
        band,
        decision: buildDecision(band),
        checklistAll: checklist.all,
        checklistPass: checklist.pass,
        checklistFail: checklist.fail,
        ledgerCount: ledger.length,
        readyLedgerCount,
        ownerCount: owners.length,
        activeOwnerCount: activeOwners.length,
        blockedOwnerCount: blockedOwners.length,
        renewalValueBand: toString(snapshot.renewalValueBand, 'medium'),
        retentionSignal: toString(snapshot.retentionSignal, 'stable'),
        feedbackState: toString(snapshot.feedbackState, 'good'),
        activityState: toString(snapshot.activityState, 'active'),
        pendingCorrections: Math.max(0, toNumber(snapshot.pendingCorrections)),
        renewalOwner: toString(snapshot.renewalOwner, ''),
        commercialOwner: toString(snapshot.commercialOwner, ''),
        successOwner: toString(snapshot.successOwner, ''),
        nextRenewalWindow: toString(snapshot.nextRenewalWindow, ''),
        ownerCoverage: coverage,
        blockers: band === 'ready' ? [] : blockers,
        warnings: band === 'ready' ? [] : warnings,
        summary: buildSummary(band),
        detail: buildDetail(snapshot, {
            ledgerCount: ledger.length,
        }),
        generatedAt: new Date().toISOString(),
    };
}
