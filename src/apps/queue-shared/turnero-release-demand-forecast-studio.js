export function buildTurneroReleaseDemandForecastStudio(input = {}) {
    const clinics = Array.isArray(input.clinics) ? input.clinics : [];
    const rows = clinics.map((clinic, index) => {
        const baseDemand = Number(clinic.baseDemand || 20);
        const growthFactor = Number(clinic.growthFactor || 1.08);
        const seasonality = Number(clinic.seasonality || 1);
        const forecast7d = Number(
            (baseDemand * growthFactor * seasonality * 7).toFixed(1)
        );
        const forecast30d = Number(
            (baseDemand * growthFactor * seasonality * 30).toFixed(1)
        );
        const pressureBand =
            forecast30d >= 900
                ? 'high'
                : forecast30d >= 500
                  ? 'watch'
                  : 'stable';

        return {
            clinicId: clinic.clinicId || clinic.id || `clinic-${index + 1}`,
            baseDemand,
            growthFactor,
            seasonality,
            forecast7d,
            forecast30d,
            pressureBand,
        };
    });

    const regional30d = rows.reduce((sum, row) => sum + row.forecast30d, 0);

    return {
        rows,
        regional30d: Number(regional30d.toFixed(1)),
        generatedAt: new Date().toISOString(),
    };
}
