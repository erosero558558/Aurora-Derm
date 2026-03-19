export function buildTurneroReleaseResourceAllocationMatrix(input = {}) {
    const twins = Array.isArray(input.twins) ? input.twins : [];
    const rows = twins.map((twin) => {
        const opsUnits =
            twin.state === 'scale-ready'
                ? 1
                : twin.state === 'operational'
                  ? 2
                  : twin.state === 'assist'
                    ? 3
                    : 4;
        const fieldUnits =
            twin.forecast30d >= 800 ? 3 : twin.forecast30d >= 500 ? 2 : 1;
        const supportUnits =
            twin.resilienceScore >= 80 ? 1 : twin.resilienceScore >= 65 ? 2 : 3;

        return {
            clinicId: twin.clinicId,
            opsUnits,
            fieldUnits,
            supportUnits,
            totalUnits: opsUnits + fieldUnits + supportUnits,
        };
    });

    const totals = rows.reduce(
        (acc, row) => {
            acc.opsUnits += row.opsUnits;
            acc.fieldUnits += row.fieldUnits;
            acc.supportUnits += row.supportUnits;
            acc.totalUnits += row.totalUnits;
            return acc;
        },
        { opsUnits: 0, fieldUnits: 0, supportUnits: 0, totalUnits: 0 }
    );

    return {
        rows,
        totals,
        generatedAt: new Date().toISOString(),
    };
}
