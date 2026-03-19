import { toArray, toText } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeProcurementItem(item = {}, index = 0) {
    const source = item && typeof item === 'object' ? item : {};
    const readiness = safeNumber(
        source.readiness ?? source.score ?? source.procurementReadiness,
        0
    );

    return {
        id: toText(source.id || source.key || `proc-${index + 1}`),
        label: toText(
            source.label ||
                source.name ||
                source.title ||
                source.clinicName ||
                source.clinicId ||
                `Procurement ${index + 1}`,
            `Procurement ${index + 1}`
        ),
        readiness,
        owner: toText(source.owner || 'ops', 'ops'),
        status:
            readiness >= 85 ? 'ready' : readiness >= 60 ? 'watch' : 'blocked',
    };
}

function buildDefaultProcurementItems(input = {}) {
    const clinics = toArray(input.clinics);

    if (clinics.length > 0) {
        return clinics.map((clinic, index) =>
            normalizeProcurementItem(
                {
                    id:
                        clinic.id ||
                        clinic.clinicId ||
                        clinic.clinic_id ||
                        `proc-${index + 1}`,
                    label:
                        clinic.clinicName ||
                        clinic.name ||
                        clinic.label ||
                        clinic.clinicId ||
                        `Clinic ${index + 1}`,
                    readiness:
                        clinic.procurementReadiness ??
                        clinic.readiness ??
                        clinic.valueScore ??
                        clinic.adoptionRate ??
                        70,
                    owner: clinic.owner || 'ops',
                },
                index
            )
        );
    }

    return [
        normalizeProcurementItem(
            {
                id: 'kiosk',
                label: 'Kiosk hardware',
                readiness: 82,
                owner: 'ops',
            },
            0
        ),
        normalizeProcurementItem(
            {
                id: 'display',
                label: 'Display rollout',
                readiness: 76,
                owner: 'field',
            },
            1
        ),
        normalizeProcurementItem(
            {
                id: 'network',
                label: 'Network readiness',
                readiness: 68,
                owner: 'infra',
            },
            2
        ),
    ];
}

export function buildTurneroReleaseProcurementReadiness(input = {}) {
    const rows = toArray(input.procurementItems).length
        ? toArray(input.procurementItems).map(normalizeProcurementItem)
        : buildDefaultProcurementItems(input);
    const avgReadiness = rows.length
        ? Number(
              (
                  rows.reduce(
                      (sum, row) => sum + safeNumber(row.readiness, 0),
                      0
                  ) / rows.length
              ).toFixed(1)
          )
        : 0;
    const readyCount = rows.filter((row) => row.status === 'ready').length;

    return {
        rows,
        avgReadiness,
        readyCount,
        state:
            avgReadiness >= 85
                ? 'ready'
                : avgReadiness >= 60
                  ? 'warning'
                  : 'alert',
        summary: `Procurement readiness ${avgReadiness}% across ${rows.length} item(s).`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseProcurementReadiness;
