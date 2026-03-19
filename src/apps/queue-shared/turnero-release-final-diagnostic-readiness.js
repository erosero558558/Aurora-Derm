function count(summary, key) {
    return Number(summary?.[key] || 0);
}

export function buildTurneroReleaseFinalDiagnosticReadiness(input = {}) {
    const manifestSummary = input.manifestSummary || {};
    const wiringSummary = input.wiringSummary || {};
    const contractSummary = input.contractSummary || {};
    const convergenceSummary = input.convergenceSummary || {};
    const finalGapSummary = input.finalGapSummary || {};

    const penalties = {
        manifest: manifestSummary.all > 0 ? 0 : 20,
        wiring:
            count(wiringSummary, 'missing') * 12 +
            count(wiringSummary, 'partial') * 6,
        contracts:
            count(contractSummary, 'missing') * 10 +
            count(contractSummary, 'watch') * 4,
        convergence:
            count(convergenceSummary, 'fragmented') * 10 +
            count(convergenceSummary, 'partial') * 4,
        gaps:
            count(finalGapSummary, 'high') * 8 +
            count(finalGapSummary, 'open') * 2,
    };

    let score = 100;
    score -= Object.values(penalties).reduce(
        (total, penalty) => total + penalty,
        0
    );
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'ready'
            : score >= 75
              ? 'near-ready'
              : score >= 60
                ? 'review'
                : 'not-ready';
    const decision =
        band === 'ready'
            ? 'run-final-diagnostic'
            : band === 'near-ready'
              ? 'close-gaps-then-diagnose'
              : band === 'review'
                ? 'review-audits-and-pack'
                : 'consolidate-first';

    return {
        score,
        band,
        decision,
        penalties,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFinalDiagnosticReadiness;
