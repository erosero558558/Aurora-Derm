export function buildTurneroReleaseRolloutStrategyScore(input = {}) {
    const forecast = input.forecast || { regional30d: 0 };
    const decisions = Array.isArray(input.decisions) ? input.decisions : [];
    const recommendation = input.recommendation || {};
    const resources = input.resources || { totals: { totalUnits: 0 } };

    const bestDecision =
        [...decisions].sort(
            (a, b) => Number(b.confidence || 0) - Number(a.confidence || 0)
        )[0] || {};
    let score = 0;
    score += Math.max(0, 100 - Number(forecast.regional30d || 0) / 80) * 0.2;
    score += Number(bestDecision.confidence || 0) * 0.45;
    score +=
        Math.max(0, 100 - Number(resources.totals?.totalUnits || 0) * 2.5) *
        0.2;
    score +=
        (recommendation.recommendation === 'execute_controlled_plan'
            ? 90
            : recommendation.recommendation === 'stage_gate_review'
              ? 72
              : 48) * 0.15;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'fragile';

    return {
        score,
        band,
        decision: score < 55 ? 'hold' : score < 75 ? 'review' : 'ready',
        generatedAt: new Date().toISOString(),
    };
}
