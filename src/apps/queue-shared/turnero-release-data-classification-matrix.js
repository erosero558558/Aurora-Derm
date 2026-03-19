import { toArray, toText } from './turnero-release-control-center.js';

function normalizeSurface(input = {}, index = 0) {
    const surface = input && typeof input === 'object' ? input : {};
    const id = toText(
        surface.id ||
            surface.key ||
            surface.surfaceId ||
            surface.route ||
            `surface-${index + 1}`,
        `surface-${index + 1}`
    );
    const label = toText(
        surface.label || surface.name || surface.title || surface.flow || id,
        id
    );
    const flow = toText(
        surface.flow || surface.channel || surface.surface || surface.route,
        id
    );
    const containsPII = Boolean(
        surface.containsPII ||
        surface.containsPersonalData ||
        surface.containsIdentityData
    );
    const containsClinicalSignals = Boolean(
        surface.containsClinicalSignals ||
        surface.containsMedicalData ||
        surface.containsSensitiveClinicalData
    );
    const containsQueueOps = surface.containsQueueOps !== false;
    const classification = containsClinicalSignals
        ? 'clinical-sensitive'
        : containsPII
          ? 'personal-operational'
          : containsQueueOps
            ? 'operational'
            : 'public';
    const exposure =
        classification === 'clinical-sensitive'
            ? 'restricted'
            : classification === 'personal-operational'
              ? 'controlled'
              : classification === 'operational'
                ? 'internal'
                : 'public';

    return {
        id,
        label,
        flow,
        classification,
        exposure,
        containsPII,
        containsClinicalSignals,
        containsQueueOps,
        note: toText(surface.note || surface.description || ''),
    };
}

export function buildTurneroReleaseDataClassificationMatrix(input = {}) {
    const surfaces = toArray(input.surfaces).map(normalizeSurface);
    const rows = surfaces;
    const summary = {
        all: rows.length,
        restricted: rows.filter((row) => row.exposure === 'restricted').length,
        controlled: rows.filter((row) => row.exposure === 'controlled').length,
        internal: rows.filter((row) => row.exposure === 'internal').length,
        public: rows.filter((row) => row.exposure === 'public').length,
        clinicalSensitive: rows.filter(
            (row) => row.classification === 'clinical-sensitive'
        ).length,
        personalOperational: rows.filter(
            (row) => row.classification === 'personal-operational'
        ).length,
        operational: rows.filter((row) => row.classification === 'operational')
            .length,
    };

    return {
        rows,
        summary,
        generatedAt: new Date().toISOString(),
    };
}

export { normalizeSurface as normalizeTurneroReleaseSafetyPrivacySurface };
