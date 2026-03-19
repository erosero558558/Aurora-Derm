export function buildTurneroReleaseClinicDigitalTwin(input = {}) {
    const clinics = Array.isArray(input.clinics) ? input.clinics : [];
    const demandRows = Array.isArray(input.demandRows) ? input.demandRows : [];
    const qualityRows = Array.isArray(input.qualityRows)
        ? input.qualityRows
        : [];
    const reliabilityRows = Array.isArray(input.reliabilityRows)
        ? input.reliabilityRows
        : [];

    const rows = clinics.map((clinic, index) => {
        const clinicId = clinic.clinicId || clinic.id || `clinic-${index + 1}`;
        const demand =
            demandRows.find((item) => item.clinicId === clinicId) || {};
        const quality =
            qualityRows.find((item) => item.clinicId === clinicId) || {};
        const reliability =
            reliabilityRows.find((item) => item.clinicId === clinicId) || {};
        const twinScore = Number(
            (
                Number(quality.score || clinic.qualityScore || 70) * 0.35 +
                Math.max(0, 100 - Number(demand.forecast30d || 0) / 12) * 0.2 +
                Number(
                    reliability.resilienceScore || clinic.resilienceScore || 70
                ) *
                    0.25 +
                Number(clinic.adoptionRate || 70) * 0.2
            ).toFixed(1)
        );
        const state =
            twinScore >= 85
                ? 'scale-ready'
                : twinScore >= 70
                  ? 'operational'
                  : twinScore >= 55
                    ? 'assist'
                    : 'stabilize';

        return {
            clinicId,
            twinScore,
            state,
            forecast30d: Number(demand.forecast30d || 0),
            qualityScore: Number(quality.score || clinic.qualityScore || 0),
            resilienceScore: Number(
                reliability.resilienceScore || clinic.resilienceScore || 0
            ),
        };
    });

    return {
        rows,
        generatedAt: new Date().toISOString(),
    };
}
