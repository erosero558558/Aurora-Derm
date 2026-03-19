export function buildTurneroReleaseServiceExcellenceScore(input = {}) {
    const quality = input.quality || { avgScore: 0 };
    const cohorts = Array.isArray(input.cohorts) ? input.cohorts : [];
    const maturity = Array.isArray(input.maturity) ? input.maturity : [];
    const saturation = input.saturation || { avgLoad: 100 };

    const cohortBonus = cohorts.length
        ? (cohorts.filter((item) =>
              ['champion', 'steady'].includes(item.cohort)
          ).length /
              cohorts.length) *
          10
        : 0;
    const maturityAvg = maturity.length
        ? maturity.reduce(
              (sum, item) => sum + Number(item.maturityScore || 0),
              0
          ) / maturity.length
        : 0;

    let score = Number(
        (
            quality.avgScore * 0.45 +
            maturityAvg * 0.35 +
            Math.max(0, 100 - saturation.avgLoad) * 0.2 +
            cohortBonus
        ).toFixed(1)
    );
    score = Math.max(0, Math.min(100, score));

    const band =
        score >= 90
            ? 'elite'
            : score >= 78
              ? 'strong'
              : score >= 65
                ? 'watch'
                : 'recovery';

    return {
        score,
        band,
        generatedAt: new Date().toISOString(),
    };
}
