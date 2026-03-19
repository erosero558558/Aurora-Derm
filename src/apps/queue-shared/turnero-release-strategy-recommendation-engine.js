export function buildTurneroReleaseStrategyRecommendationEngine(input = {}) {
    const decisions = Array.isArray(input.decisions) ? input.decisions : [];
    const resources = input.resources || { totals: { totalUnits: 0 } };
    const top =
        [...decisions].sort(
            (a, b) => Number(b.confidence || 0) - Number(a.confidence || 0)
        )[0] || null;

    let recommendation = 'review';
    if (top) {
        recommendation =
            top.decision === 'promote' &&
            Number(resources.totals?.totalUnits || 0) <= 18
                ? 'execute_controlled_plan'
                : top.decision === 'review'
                  ? 'stage_gate_review'
                  : 'stabilize_before_scale';
    }

    return {
        topStrategy: top,
        recommendation,
        narrative:
            recommendation === 'execute_controlled_plan'
                ? 'Hay base suficiente para avanzar con un rollout controlado por cohortes.'
                : recommendation === 'stage_gate_review'
                  ? 'Conviene revisión ejecutiva antes de ampliar el rollout.'
                  : 'Conviene estabilizar clínicas con menor score antes de escalar.',
        generatedAt: new Date().toISOString(),
    };
}
