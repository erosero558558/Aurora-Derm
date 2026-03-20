export function buildTurneroReleaseMainlineAuditScore(input = {}) {
    const reconciledSummary = input.reconciledSummary || {
        reconciled: 0,
        all: 0,
        mountedNoEvidence: 0,
        evidenceNoMount: 0,
        missing: 0,
    };
    const mountSummary = input.mountSummary || {
        strong: 0,
        all: 0,
    };
    const runtimeDiffSummary = input.runtimeDiffSummary || {
        aligned: 0,
        all: 0,
        drift: 0,
    };
    const blockerSummary = input.blockerSummary || {
        all: 0,
        high: 0,
    };

    const reconcilePct =
        reconciledSummary.all > 0
            ? (reconciledSummary.reconciled / reconciledSummary.all) * 100
            : 0;
    const mountPct =
        mountSummary.all > 0
            ? (mountSummary.strong / mountSummary.all) * 100
            : 0;
    const runtimePct =
        runtimeDiffSummary.all > 0
            ? (runtimeDiffSummary.aligned / runtimeDiffSummary.all) * 100
            : 0;

    let score = 0;
    score += reconcilePct * 0.35;
    score += mountPct * 0.2;
    score += runtimePct * 0.3;
    score +=
        Math.max(0, 100 - blockerSummary.all * 10 - blockerSummary.high * 12) *
        0.15;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'uncertain';

    return {
        score,
        band,
        decision:
            score < 55
                ? 'audit-main-branch-now'
                : score < 75
                  ? 'close-mainline-gaps'
                  : 'ready-for-final-diagnostic',
        generatedAt: new Date().toISOString(),
    };
}
