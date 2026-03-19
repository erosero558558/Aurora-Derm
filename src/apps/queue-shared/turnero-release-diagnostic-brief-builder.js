export function buildTurneroReleaseDiagnosticBrief(input = {}) {
    const convergence = input.convergence || {};
    const inventorySummary = input.inventorySummary || {};
    const duplicateSummary = input.duplicateSummary || {};
    const gaps = Array.isArray(input.gaps) ? input.gaps : [];
    const coverageRows = Array.isArray(input.coverageRows)
        ? input.coverageRows
        : [];
    const clinicLabel = String(
        input.clinicLabel ||
            input.clinicShortName ||
            input.clinicId ||
            input.scope ||
            'global'
    ).trim();
    const region = String(input.region || '').trim();
    const scope = String(input.scope || 'global').trim();
    const openGapCount = gaps.filter((item) => item.status !== 'closed').length;
    const topCoverage = coverageRows.length
        ? [...coverageRows].sort(
              (a, b) => Number(a.coveragePct || 0) - Number(b.coveragePct || 0)
          )[0]
        : null;

    const lines = [
        '# Repo Diagnostic Prep Hub',
        '',
        `Clinic: ${clinicLabel}`,
        `Region: ${region || 'n/a'}`,
        `Scope: ${scope}`,
        `Convergence score: ${convergence.score ?? 0} (${convergence.band || 'n/a'})`,
        `Decision: ${convergence.decision || 'review_wiring'}`,
        `Present domains: ${inventorySummary.present ?? 0}/${inventorySummary.all ?? 0}`,
        `Partial domains: ${inventorySummary.partial ?? 0}`,
        `Missing domains: ${inventorySummary.missing ?? 0}`,
        `Duplicate groups: ${duplicateSummary.all ?? 0}`,
        `Open gaps: ${openGapCount}`,
    ];

    if (topCoverage) {
        lines.push(
            `Lowest coverage surface: ${topCoverage.label || topCoverage.surfaceId} (${topCoverage.coveragePct}%)`
        );
    }

    lines.push(`Generated at: ${new Date().toISOString()}`);

    return {
        markdown: lines.join('\n'),
        generatedAt: new Date().toISOString(),
    };
}
