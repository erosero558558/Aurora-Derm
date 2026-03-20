import { asObject, toArray, toText } from './turnero-release-control-center.js';

function normalizeBand(score) {
    if (score >= 90) {
        return 'ready';
    }

    if (score >= 75) {
        return 'near-ready';
    }

    if (score >= 60) {
        return 'review';
    }

    return 'blocked';
}

function scoreSessionStatus(status) {
    const normalized = toText(status, 'unprepared').toLowerCase();

    if (normalized === 'ready' || normalized === 'locked') {
        return 95;
    }

    if (normalized === 'prepared') {
        return 70;
    }

    if (normalized === 'open') {
        return 60;
    }

    return 40;
}

function scoreDossierDecision(decision) {
    const normalized = toText(decision, 'review').toLowerCase();

    if (normalized === 'issue-final-verdict') {
        return 95;
    }

    if (normalized === 'resolve-last-comments') {
        return 72;
    }

    return 45;
}

export function buildTurneroReleaseTerminalPackageIntegrityScore(input = {}) {
    const checklistSummary = asObject(input.checklistSummary);
    const settlements = toArray(input.settlements);
    const session = asObject(input.session);
    const dossierDecision = toText(input.dossierDecision, 'review');

    const totalQuestions = Number(
        checklistSummary.all ?? checklistSummary.total ?? 0
    );
    const openQuestions = Number(
        checklistSummary.open ?? checklistSummary.pending ?? 0
    );
    const checklistRatio =
        totalQuestions > 0
            ? Math.max(
                  0,
                  Math.min(1, (totalQuestions - openQuestions) / totalQuestions)
              )
            : 0;
    const closedSettlements = settlements.filter(
        (row) =>
            toText(row.state || row.status, 'open').toLowerCase() === 'closed'
    ).length;
    const settlementRatio =
        settlements.length > 0 ? closedSettlements / settlements.length : 1;
    const sessionScore = scoreSessionStatus(session.status);
    const dossierScore = scoreDossierDecision(dossierDecision);

    const score = Math.max(
        0,
        Math.min(
            100,
            Number(
                (
                    checklistRatio * 35 +
                    settlementRatio * 30 +
                    sessionScore * 0.2 +
                    dossierScore * 0.15
                ).toFixed(1)
            )
        )
    );
    const band = normalizeBand(score);

    return {
        score,
        band,
        decision:
            band === 'ready'
                ? 'start-honest-diagnostic'
                : band === 'near-ready'
                  ? 'close-terminal-items'
                  : 'hold-terminal-runway',
        breakdown: {
            checklistRatio,
            settlementRatio,
            sessionScore,
            dossierScore,
        },
        dossierDecision,
        generatedAt: toText(input.generatedAt, new Date().toISOString()),
    };
}

export default buildTurneroReleaseTerminalPackageIntegrityScore;
