export function buildTurneroReleaseFederatedReadinessScore(input = {}) {
    const signalSummary = input.signalSummary || {
        critical: 0,
        high: 0,
        open: 0,
    };
    const priorityTop = input.priorityTop || { priorityScore: 0 };
    const operatorFeed = Array.isArray(input.operatorFeed)
        ? input.operatorFeed
        : [];
    const memoryIndex = Array.isArray(input.memoryIndex)
        ? input.memoryIndex
        : [];

    let score = 100;
    score -= (Number(signalSummary.critical || 0) || 0) * 15;
    score -= (Number(signalSummary.high || 0) || 0) * 7;
    score -= Math.min(25, Number(priorityTop.priorityScore || 0) * 0.2);
    score -=
        operatorFeed.filter(
            (item) =>
                String(item?.state || item?.status || 'open').trim() !==
                'closed'
        ).length * 2;
    score += Math.min(12, memoryIndex.length * 0.5);
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
        generatedAt: input.generatedAt || new Date().toISOString(),
    };
}
