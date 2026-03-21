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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
}

function normalizeChecklistSummary(checklist) {
    const summary =
        checklist && typeof checklist === 'object' ? checklist.summary : null;
    return {
        all: Math.max(0, toNumber(summary?.all)),
        pass: Math.max(0, toNumber(summary?.pass)),
        fail: Math.max(0, toNumber(summary?.fail)),
    };
}

function scoreAdoptionState(value) {
    const normalized = toString(value, 'watch').toLowerCase();
    if (normalized === 'ready') {
        return 100;
    }
    if (normalized === 'watch') {
        return 82;
    }
    if (normalized === 'draft' || normalized === 'pending') {
        return 58;
    }
    if (normalized === 'degraded') {
        return 38;
    }
    if (normalized === 'blocked') {
        return 18;
    }
    return 72;
}

function scoreIncidentBand(value) {
    const normalized = toString(value, 'low').toLowerCase();
    if (normalized === 'low') {
        return 100;
    }
    if (normalized === 'medium') {
        return 72;
    }
    if (normalized === 'high') {
        return 34;
    }
    if (normalized === 'critical') {
        return 10;
    }
    return 72;
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
        return 58;
    }
    if (normalized === 'bad') {
        return 20;
    }
    return 72;
}

function normalizeSignalStatus(value) {
    const normalized = toString(value, '').toLowerCase();
    if (
        ['blocked', 'degraded', 'alert', 'critical', 'error'].includes(
            normalized
        )
    ) {
        return 'blocked';
    }
    if (['watch', 'review', 'pending', 'draft'].includes(normalized)) {
        return 'watch';
    }
    return 'ready';
}

function buildSummary(band) {
    if (band === 'ready') {
        return 'Customer success listo para continuidad y renovacion.';
    }
    if (band === 'watch') {
        return 'Customer success estable, con seguimiento periodico recomendado.';
    }
    if (band === 'degraded') {
        return 'Customer success degradado; conviene estabilizar evidencia y seguimiento.';
    }
    return 'Customer success bloqueado por señales duras.';
}

function buildDecision(band) {
    switch (band) {
        case 'ready':
            return 'customer-success-ready';
        case 'watch':
            return 'review-success-readiness';
        case 'degraded':
            return 'stabilize-success-readiness';
        default:
            return 'hold-success-readiness';
    }
}

function buildDetail(snapshot, counts) {
    return [
        `Adoption ${toString(snapshot.adoptionState, 'watch')}`,
        `incidents ${toString(snapshot.incidentRateBand, 'low')}`,
        `feedback ${toString(snapshot.feedbackState, 'good')}`,
        `owner ${toString(snapshot.successOwner, 'sin owner') || 'sin owner'}`,
        `follow-up ${toString(snapshot.followupWindow, 'sin ventana') || 'sin ventana'}`,
        `ledger ${counts.ledgerCount}`,
    ].join(' · ');
}

function buildBlockers(snapshot, checklist, ledger, owners) {
    const blockers = [];
    const runtimeState = toString(snapshot.runtimeState, 'unknown').toLowerCase();
    const truthState = toString(snapshot.truth, 'unknown').toLowerCase();
    const adoptionState = toString(snapshot.adoptionState, 'watch').toLowerCase();
    const incidentRateBand = toString(snapshot.incidentRateBand, 'low').toLowerCase();
    const feedbackState = toString(snapshot.feedbackState, 'good').toLowerCase();
    const ledgerBlocked = ledger.some(
        (entry) => normalizeSignalStatus(entry?.status) === 'blocked'
    );
    const ownerBlocked = owners.some(
        (entry) => normalizeSignalStatus(entry?.status) === 'blocked'
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
    if (adoptionState === 'blocked') {
        blockers.push('adoption');
    }
    if (['high', 'critical'].includes(incidentRateBand)) {
        blockers.push('incident-rate');
    }
    if (feedbackState === 'bad') {
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

function buildWarnings(snapshot, checklist, ledger, owners) {
    const warnings = [];
    const adoptionState = toString(snapshot.adoptionState, 'watch').toLowerCase();
    const incidentRateBand = toString(snapshot.incidentRateBand, 'low').toLowerCase();
    const feedbackState = toString(snapshot.feedbackState, 'good').toLowerCase();

    if (checklist.fail === 1) {
        warnings.push('checklist');
    }
    if (adoptionState === 'watch' || adoptionState === 'draft') {
        warnings.push('adoption');
    }
    if (incidentRateBand === 'medium') {
        warnings.push('incident-rate');
    }
    if (feedbackState === 'mixed' || feedbackState === 'neutral') {
        warnings.push('feedback');
    }
    if (!toString(snapshot.successOwner, '')) {
        warnings.push('missing-owner');
    }
    if (!toString(snapshot.followupWindow, '')) {
        warnings.push('missing-followup');
    }
    if (ledger.length === 0) {
        warnings.push('ledger-empty');
    }
    if (owners.length === 0) {
        warnings.push('owners-empty');
    }

    return warnings;
}

export function buildTurneroSurfaceSuccessGate(input = {}) {
    const snapshot = asObject(input.snapshot);
    const checklist = normalizeChecklistSummary(input.checklist);
    const ledger = asArray(input.ledger);
    const owners = asArray(input.owners);
    const readyLedgerCount = ledger.filter(
        (entry) =>
            ['ready', 'done', 'closed'].includes(
                normalizeSignalStatus(entry?.status)
            )
    ).length;
    const activeOwnerCount = owners.filter(
        (entry) => normalizeSignalStatus(entry?.status) === 'ready'
    ).length;
    const checklistPct =
        checklist.all > 0 ? (checklist.pass / checklist.all) * 100 : 0;
    const adoptionScore = scoreAdoptionState(snapshot.adoptionState);
    const incidentScore = scoreIncidentBand(snapshot.incidentRateBand);
    const feedbackScore = scoreFeedbackState(snapshot.feedbackState);
    const ownerScore =
        owners.length > 0
            ? (activeOwnerCount / owners.length) * 100
            : snapshot.successOwner
              ? 100
              : 0;
    const followupScore = snapshot.followupWindow ? 100 : 0;
    const ledgerScore =
        ledger.length > 0
            ? (readyLedgerCount / ledger.length) * 100
            : snapshot.successOwner
              ? 100
              : 0;

    let score =
        checklistPct * 0.3 +
        adoptionScore * 0.18 +
        incidentScore * 0.18 +
        feedbackScore * 0.14 +
        ownerScore * 0.1 +
        followupScore * 0.05 +
        ledgerScore * 0.05;
    score = clamp(Number(score.toFixed(1)), 0, 100);

    const blockers = buildBlockers(snapshot, checklist, ledger, owners);
    const warnings = buildWarnings(snapshot, checklist, ledger, owners);

    let band = 'degraded';
    if (blockers.length > 0) {
        band = 'blocked';
    } else if (
        score >= 90 &&
        checklist.fail === 0 &&
        Boolean(snapshot.successOwner) &&
        Boolean(snapshot.followupWindow) &&
        toString(snapshot.incidentRateBand, 'low') === 'low' &&
        toString(snapshot.feedbackState, 'good') === 'good'
    ) {
        band = 'ready';
    } else if (
        score >= 70 ||
        readyLedgerCount > 0 ||
        activeOwnerCount > 0 ||
        Boolean(snapshot.successOwner)
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
        activeOwnerCount,
        adoptionState: toString(snapshot.adoptionState, 'watch'),
        incidentRateBand: toString(snapshot.incidentRateBand, 'low'),
        feedbackState: toString(snapshot.feedbackState, 'good'),
        successOwner: toString(snapshot.successOwner, ''),
        followupWindow: toString(snapshot.followupWindow, ''),
        blockers: band === 'ready' ? [] : blockers,
        warnings: band === 'ready' ? [] : warnings,
        summary: buildSummary(band),
        detail: buildDetail(snapshot, {
            ledgerCount: ledger.length,
        }),
        generatedAt: new Date().toISOString(),
    };
}
