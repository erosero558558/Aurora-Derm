function toNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function buildTurneroReleaseAssuranceScorecard(input = {}) {
    const controlSummary = input.controlSummary || {
        pass: 0,
        watch: 0,
        fail: 0,
        all: 0,
    };
    const evidenceTotals = input.evidenceTotals || {
        all: 0,
        missing: 0,
        stale: 0,
    };
    const exceptions = Array.isArray(input.exceptions) ? input.exceptions : [];

    let score = 100;
    score -= toNumber(controlSummary.fail, 0) * 20;
    score -= toNumber(controlSummary.watch, 0) * 6;
    score -= toNumber(evidenceTotals.missing, 0) * 12;
    score -= toNumber(evidenceTotals.stale, 0) * 5;
    score -=
        exceptions.filter(
            (item) =>
                String(item?.status || '')
                    .trim()
                    .toLowerCase() !== 'closed'
        ).length * 4;
    score = Math.max(0, Math.min(100, score));

    const grade =
        score >= 90
            ? 'A'
            : score >= 75
              ? 'B'
              : score >= 60
                ? 'C'
                : score >= 40
                  ? 'D'
                  : 'E';

    const decision = score < 50 ? 'hold' : score < 75 ? 'review' : 'ready';

    return {
        score,
        grade,
        decision,
        generatedAt: new Date().toISOString(),
    };
}
