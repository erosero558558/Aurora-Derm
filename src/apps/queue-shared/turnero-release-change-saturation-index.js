export function buildTurneroReleaseChangeSaturationIndex(input = {}) {
    const clinics = Array.isArray(input.clinics) ? input.clinics : [];
    const incidents = Array.isArray(input.incidents) ? input.incidents : [];
    const feedback = Array.isArray(input.feedback) ? input.feedback : [];
    const training = Array.isArray(input.training) ? input.training : [];

    const rows = clinics.map((clinic, index) => {
        const clinicId = clinic.clinicId || clinic.id || `clinic-${index + 1}`;
        const incidentLoad = incidents.filter(
            (item) => (item.clinicId || clinicId) === clinicId
        ).length;
        const feedbackLoad = feedback.filter(
            (item) => (item.clinicId || clinicId) === clinicId
        ).length;
        const trainingRows = training.filter(
            (item) => (item.clinicId || clinicId) === clinicId
        );
        const trainingReadiness = trainingRows.reduce(
            (sum, item) => sum + Number(item.readiness || 0),
            0
        );
        const avgTraining = trainingRows.length
            ? trainingReadiness / trainingRows.length
            : 0;
        const changeLoad = Math.min(
            100,
            incidentLoad * 12 + feedbackLoad * 7 + Math.max(0, 80 - avgTraining)
        );
        const state =
            changeLoad >= 85
                ? 'saturated'
                : changeLoad >= 60
                  ? 'watch'
                  : 'healthy';
        return {
            clinicId,
            changeLoad: Number(changeLoad.toFixed(1)),
            state,
            incidentLoad,
            feedbackLoad,
        };
    });

    const avgLoad = rows.length
        ? Number(
              (
                  rows.reduce((sum, row) => sum + row.changeLoad, 0) /
                  rows.length
              ).toFixed(1)
          )
        : 0;

    return {
        rows,
        avgLoad,
        generatedAt: new Date().toISOString(),
    };
}
