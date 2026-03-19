export function buildTurneroReleaseServiceQualityMetrics(input = {}) {
    const clinics = Array.isArray(input.clinics) ? input.clinics : [];
    const rows = clinics.map((clinic, index) => {
        const queueFlow = Number(clinic.queueFlowScore || 0);
        const callAccuracy = Number(clinic.callAccuracyScore || 0);
        const deskReadiness = Number(clinic.deskReadinessScore || 0);
        const patientSignal = Number(clinic.patientSignalScore || 0);
        const score = Number(
            (
                (queueFlow + callAccuracy + deskReadiness + patientSignal) /
                4
            ).toFixed(1)
        );
        const band =
            score >= 90
                ? 'excellent'
                : score >= 75
                  ? 'stable'
                  : score >= 60
                    ? 'watch'
                    : 'recovery';
        return {
            clinicId: clinic.clinicId || clinic.id || `clinic-${index + 1}`,
            queueFlow,
            callAccuracy,
            deskReadiness,
            patientSignal,
            score,
            band,
        };
    });

    const avgScore = rows.length
        ? Number(
              (
                  rows.reduce((sum, row) => sum + row.score, 0) / rows.length
              ).toFixed(1)
          )
        : 0;

    return {
        rows,
        avgScore,
        generatedAt: new Date().toISOString(),
    };
}
