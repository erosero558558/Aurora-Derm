import { toArray, toText } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatLabel(clinic = {}, index = 0) {
    return toText(
        clinic.clinicName ||
            clinic.name ||
            clinic.label ||
            clinic.branding?.short_name ||
            clinic.branding?.name ||
            clinic.clinicId ||
            clinic.id ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
}

function normalizeFinanceClinic(clinic = {}, index = 0) {
    const source = clinic && typeof clinic === 'object' ? clinic : {};
    const capex = safeNumber(source.capex ?? source.hardwareCost, 1200);
    const monthlyOpex = safeNumber(
        source.monthlyOpex ?? source.supportCost,
        280
    );

    return {
        clinicId: toText(
            source.clinicId ||
                source.clinic_id ||
                source.id ||
                `clinic-${index + 1}`,
            `clinic-${index + 1}`
        ),
        label: formatLabel(source, index),
        capex,
        monthlyOpex,
        supportCost: safeNumber(source.supportCost, 180),
        hardwareCost: safeNumber(source.hardwareCost, 700),
        runwayContribution: Number((capex + monthlyOpex * 6).toFixed(2)),
        state:
            monthlyOpex > capex * 0.5
                ? 'watch'
                : monthlyOpex > capex * 0.3
                  ? 'stable'
                  : 'ready',
    };
}

function buildFallbackFinance(input = {}) {
    return normalizeFinanceClinic(
        {
            clinicId: input.clinicId || input.id || 'default-clinic',
            clinicName:
                input.clinicName ||
                input.brandName ||
                input.branding?.short_name ||
                input.branding?.name ||
                'Piel en Armonia',
            capex: input.capex ?? 1200,
            monthlyOpex: input.monthlyOpex ?? 280,
            supportCost: input.supportCost ?? 180,
            hardwareCost: input.hardwareCost ?? 700,
        },
        0
    );
}

export function buildTurneroReleaseCapexOpexPlanner(input = {}) {
    const clinics = toArray(input.clinics).map(normalizeFinanceClinic);
    const rows = clinics.length ? clinics : [buildFallbackFinance(input)];
    const capex = rows.reduce((sum, row) => sum + safeNumber(row.capex, 0), 0);
    const monthlyOpex = rows.reduce(
        (sum, row) => sum + safeNumber(row.monthlyOpex, 0),
        0
    );
    const runwayBudget = safeNumber(
        input.runwayBudget,
        capex + monthlyOpex * 6 || 0
    );
    const residualBudget = Math.max(0, runwayBudget - capex);
    const runwayMonths =
        monthlyOpex > 0 ? Number((residualBudget / monthlyOpex).toFixed(1)) : 0;

    return {
        rows,
        capex,
        monthlyOpex,
        annualOpex: Number((monthlyOpex * 12).toFixed(2)),
        runwayBudget,
        residualBudget,
        runwayMonths,
        mode:
            runwayMonths < 3
                ? 'constrained'
                : runwayMonths < 6
                  ? 'watch'
                  : 'stable',
        summary: `Capex ${capex} · Opex ${monthlyOpex}/mo · runway ${runwayMonths} month(s).`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseCapexOpexPlanner;
