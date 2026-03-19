import { toArray, toText } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeClinic(clinic = {}, index = 0) {
    const source = clinic && typeof clinic === 'object' ? clinic : {};
    const clinicId = toText(
        source.clinicId ||
            source.clinic_id ||
            source.id ||
            source.code ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
    const clinicName = toText(
        source.clinicName ||
            source.name ||
            source.label ||
            source.branding?.short_name ||
            source.branding?.name ||
            clinicId,
        clinicId
    );
    const expected = safeNumber(
        source.expectedBenefit ?? source.valueScore ?? source.benefitTarget,
        80
    );
    const realized = safeNumber(
        source.realizedBenefit ?? source.benefitRealized ?? expected * 0.6,
        Math.max(0, expected * 0.6)
    );
    const adoption = safeNumber(
        source.adoptionRate ?? source.adoption ?? source.usageRate,
        70
    );
    const gap = Number((expected - realized).toFixed(2));

    return {
        clinicId,
        clinicName,
        label: clinicName,
        region: toText(source.region || source.area || 'regional', 'regional'),
        expected,
        realized,
        gap,
        adoption,
        status:
            realized >= expected * 0.9
                ? 'on_track'
                : realized >= expected * 0.65
                  ? 'watch'
                  : 'recovery',
    };
}

function buildFallbackClinic(input = {}) {
    return normalizeClinic(
        {
            clinicId: input.clinicId || input.id || 'default-clinic',
            clinicName:
                input.clinicName ||
                input.brandName ||
                input.branding?.short_name ||
                input.branding?.name ||
                'Piel en Armonia',
            region: input.region || 'regional',
            expectedBenefit: input.expectedBenefit ?? 80,
            realizedBenefit: input.realizedBenefit ?? 50,
            adoptionRate: input.adoptionRate ?? 70,
        },
        0
    );
}

export function buildTurneroReleaseBenefitsTracker(input = {}) {
    const clinics = toArray(input.clinics).map(normalizeClinic);
    const rows = clinics.length ? clinics : [buildFallbackClinic(input)];
    const totals = rows.reduce(
        (accumulator, row) => {
            accumulator.expected += row.expected;
            accumulator.realized += row.realized;
            accumulator.gap += row.gap;
            return accumulator;
        },
        {
            expected: 0,
            realized: 0,
            gap: 0,
        }
    );
    const realizationPct =
        totals.expected > 0
            ? Number(((totals.realized / totals.expected) * 100).toFixed(1))
            : 0;
    const status =
        realizationPct >= 90
            ? 'ready'
            : realizationPct >= 70
              ? 'warning'
              : 'alert';

    return {
        rows,
        totals,
        realizationPct,
        status,
        summary: `Benefits realization ${realizationPct}% across ${rows.length} clinic(s).`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseBenefitsTracker;
