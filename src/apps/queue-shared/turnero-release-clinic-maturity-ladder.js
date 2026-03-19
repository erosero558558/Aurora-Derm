export function buildTurneroReleaseClinicMaturityLadder(input = {}) {
    const qualityRows = Array.isArray(input.qualityRows)
        ? input.qualityRows
        : [];
    const cohortRows = Array.isArray(input.cohortRows) ? input.cohortRows : [];
    const saturationRows = Array.isArray(input.saturationRows)
        ? input.saturationRows
        : [];

    const rows = qualityRows.map((qualityRow, index) => {
        const clinicId = qualityRow.clinicId || `clinic-${index + 1}`;
        const cohortRow =
            cohortRows.find((item) => item.clinicId === clinicId) || {};
        const saturationRow =
            saturationRows.find((item) => item.clinicId === clinicId) || {};
        const maturityScore = Number(
            (
                qualityRow.score * 0.45 +
                Number(cohortRow.combined || 0) * 0.35 +
                Math.max(0, 100 - Number(saturationRow.changeLoad || 0)) * 0.2
            ).toFixed(1)
        );
        const level =
            maturityScore >= 88
                ? 'L4-scale-ready'
                : maturityScore >= 75
                  ? 'L3-operational'
                  : maturityScore >= 60
                    ? 'L2-assisted'
                    : 'L1-stabilize';
        return {
            clinicId,
            maturityScore,
            level,
        };
    });

    return {
        rows,
        generatedAt: new Date().toISOString(),
    };
}
