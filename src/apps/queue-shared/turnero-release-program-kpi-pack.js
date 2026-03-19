import { toArray, toText } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIncidentLevel(item = {}) {
    return String(item.severity || item.state || item.tone || '')
        .trim()
        .toLowerCase();
}

export function buildTurneroReleaseProgramKpiPack(input = {}) {
    const clinics = toArray(input.clinics);
    const incidents = toArray(input.incidents);
    const activeClinics =
        clinics.filter((clinic) => {
            const status = String(clinic.status || '')
                .trim()
                .toLowerCase();
            return (
                status !== 'paused' &&
                status !== 'inactive' &&
                status !== 'blocked'
            );
        }).length || clinics.length;
    const readyClinics = clinics.filter((clinic) => {
        const status = String(clinic.status || '')
            .trim()
            .toLowerCase();
        return (
            status === 'active' ||
            status === 'ready' ||
            safeNumber(clinic.valueScore, 0) >= 80 ||
            safeNumber(clinic.adoptionRate, 0) >= 75
        );
    }).length;
    const blockedIncidents = incidents.filter((item) =>
        ['alert', 'blocked', 'critical', 'high', 'error'].includes(
            normalizeIncidentLevel(item)
        )
    ).length;
    const warningIncidents = incidents.filter((item) =>
        ['warning', 'watch', 'pending', 'review'].includes(
            normalizeIncidentLevel(item)
        )
    ).length;
    const avgAdoption = clinics.length
        ? Number(
              (
                  clinics.reduce(
                      (sum, clinic) => sum + safeNumber(clinic.adoptionRate, 0),
                      0
                  ) / clinics.length
              ).toFixed(1)
          )
        : 0;
    const avgValue = clinics.length
        ? Number(
              (
                  clinics.reduce(
                      (sum, clinic) => sum + safeNumber(clinic.valueScore, 0),
                      0
                  ) / clinics.length
              ).toFixed(1)
          )
        : 0;
    const deliveryMode =
        blockedIncidents >= 5
            ? 'fragile'
            : blockedIncidents >= 2 || warningIncidents >= 3
              ? 'watch'
              : 'stable';

    return {
        activeClinics,
        readyClinics,
        blockedIncidents,
        warningIncidents,
        avgAdoption,
        avgValue,
        deliveryMode,
        state:
            blockedIncidents > 0
                ? 'alert'
                : warningIncidents > 0
                  ? 'warning'
                  : 'ready',
        summary: `KPI pack ${activeClinics} clinic(s) · delivery ${deliveryMode}.`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseProgramKpiPack;
