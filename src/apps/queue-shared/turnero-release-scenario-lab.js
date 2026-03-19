import { toArray } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildTurneroReleaseScenarioLab(input = {}) {
    const clinicsCount = safeNumber(
        input.clinicsCount,
        toArray(input.clinics).length || 1
    );
    const baseMonthlyOpex = safeNumber(input.baseMonthlyOpex, 0);
    const baseRiskScore = safeNumber(input.baseRiskScore, 40);
    const baseInvestment = safeNumber(input.baseInvestment, 0);
    const scenarios = [
        { key: 'base', label: 'Base', multiplier: 1, riskFactor: 1 },
        { key: 'stress', label: 'Stress', multiplier: 1.25, riskFactor: 1.35 },
        {
            key: 'aggressive',
            label: 'Aggressive',
            multiplier: 1.45,
            riskFactor: 1.15,
        },
    ].map((scenario) => {
        const opex = Number((baseMonthlyOpex * scenario.multiplier).toFixed(2));
        const risk = Number((baseRiskScore * scenario.riskFactor).toFixed(1));
        const supportLoad = Number(
            (clinicsCount * scenario.multiplier).toFixed(1)
        );
        const investment = Number(
            (baseInvestment * scenario.multiplier).toFixed(2)
        );
        const decision = risk >= 90 ? 'hold' : risk >= 60 ? 'review' : 'ready';

        return {
            ...scenario,
            opex,
            risk,
            supportLoad,
            investment,
            decision,
        };
    });

    const state = scenarios.some((scenario) => scenario.decision === 'hold')
        ? 'alert'
        : scenarios.some((scenario) => scenario.decision === 'review')
          ? 'warning'
          : 'ready';

    return {
        clinicsCount,
        scenarios,
        state,
        summary: `Scenario lab for ${clinicsCount} clinic(s) across base, stress and aggressive outlooks.`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseScenarioLab;
