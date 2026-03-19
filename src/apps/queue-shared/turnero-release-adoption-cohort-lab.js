export function buildTurneroReleaseAdoptionCohortLab(input = {}) {
    const clinics = Array.isArray(input.clinics) ? input.clinics : [];
    const cohorts = [
        { key: 'champion', label: 'Champion', min: 85 },
        { key: 'steady', label: 'Steady', min: 70 },
        { key: 'assisted', label: 'Assisted', min: 50 },
        { key: 'intensive', label: 'Intensive', min: 0 },
    ];

    const rows = clinics.map((clinic, index) => {
        const adoption = Number(clinic.adoptionRate || 0);
        const training = Number(clinic.trainingReadiness || 0);
        const quality = Number(clinic.qualityScore || 0);
        const combined = Number(
            (adoption * 0.5 + training * 0.2 + quality * 0.3).toFixed(1)
        );
        const cohort =
            cohorts.find((item) => combined >= item.min) ||
            cohorts[cohorts.length - 1];
        return {
            clinicId: clinic.clinicId || clinic.id || `clinic-${index + 1}`,
            adoption,
            training,
            quality,
            combined,
            cohort: cohort.key,
            cohortLabel: cohort.label,
        };
    });

    return {
        rows,
        generatedAt: new Date().toISOString(),
    };
}
