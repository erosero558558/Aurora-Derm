const DEFAULT_GATES = [
    { key: 'pilot', label: 'Pilot Gate', runwayThreshold: 3 },
    { key: 'regional', label: 'Regional Gate', runwayThreshold: 6 },
    { key: 'scale', label: 'Scale Gate', runwayThreshold: 9 },
];

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildTurneroReleaseFundingGates(input = {}) {
    const gates =
        Array.isArray(input.gates) && input.gates.length
            ? input.gates
            : DEFAULT_GATES;
    const budgetMode = String(input.budgetMode || 'review')
        .trim()
        .toLowerCase();
    const riskGrade = String(input.riskGrade || 'B')
        .trim()
        .toUpperCase();
    const complianceStatus = String(input.complianceStatus || 'amber')
        .trim()
        .toLowerCase();
    const runwayMonths = safeNumber(input.runwayMonths, 0);

    const rows = gates.map((gate, index) => {
        const threshold = safeNumber(
            gate.runwayThreshold,
            DEFAULT_GATES[index]?.runwayThreshold || 3
        );
        const approved =
            budgetMode === 'ready' &&
            ['A', 'B'].includes(riskGrade) &&
            complianceStatus !== 'red' &&
            runwayMonths >= threshold;
        const review =
            !approved &&
            (budgetMode === 'review' ||
                complianceStatus === 'amber' ||
                runwayMonths >= Math.max(1, threshold - 1));
        const state = approved ? 'approved' : review ? 'review' : 'hold';

        return {
            key: String(gate.key || `gate-${index + 1}`),
            label: String(gate.label || `Gate ${index + 1}`),
            state,
            detail:
                gate.detail ||
                (state === 'approved'
                    ? `Runway ${runwayMonths} >= ${threshold}`
                    : state === 'review'
                      ? `Requiere validación antes de liberar.`
                      : `Bloqueado por presupuesto, riesgo o compliance.`),
        };
    });

    const approvedCount = rows.filter((row) => row.state === 'approved').length;
    const reviewCount = rows.filter((row) => row.state === 'review').length;
    const holdCount = rows.filter((row) => row.state === 'hold').length;

    return {
        rows,
        approvedCount,
        reviewCount,
        holdCount,
        state: holdCount > 0 ? 'alert' : reviewCount > 0 ? 'warning' : 'ready',
        summary: `Funding gates ${approvedCount}/${rows.length} approved.`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseFundingGates;
