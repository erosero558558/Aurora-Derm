export function buildTurneroReleaseConvergenceScore(input = {}) {
    const registrySummary = input.registrySummary || { mounted: 0, all: 0 };
    const inventorySummary = input.inventorySummary || {
        present: 0,
        partial: 0,
        missing: 0,
        all: 0,
    };
    const coverageRows = Array.isArray(input.coverageRows)
        ? input.coverageRows
        : [];
    const duplicateSummary = input.duplicateSummary || { all: 0, high: 0 };
    const gaps = Array.isArray(input.gaps) ? input.gaps : [];

    const registryPct =
        registrySummary.all > 0
            ? (registrySummary.mounted / registrySummary.all) * 100
            : 0;
    const inventoryPct =
        inventorySummary.all > 0
            ? (inventorySummary.present / inventorySummary.all) * 100
            : 0;
    const coverageAvg = coverageRows.length
        ? coverageRows.reduce(
              (sum, row) => sum + Number(row.coveragePct || 0),
              0
          ) / coverageRows.length
        : 0;

    let score = 0;
    score += registryPct * 0.25;
    score += inventoryPct * 0.25;
    score += coverageAvg * 0.3;
    score +=
        Math.max(
            0,
            100 - duplicateSummary.all * 10 - duplicateSummary.high * 8
        ) * 0.1;
    score +=
        Math.max(
            0,
            100 - gaps.filter((item) => item.status !== 'closed').length * 6
        ) * 0.1;
    score = Math.max(0, Math.min(100, Number(score.toFixed(1))));

    const band =
        score >= 90
            ? 'strong'
            : score >= 75
              ? 'stable'
              : score >= 60
                ? 'watch'
                : 'fragmented';

    return {
        score,
        band,
        decision:
            score < 55
                ? 'consolidate_first'
                : score < 75
                  ? 'review_wiring'
                  : 'diagnostic_ready',
        generatedAt: new Date().toISOString(),
    };
}
