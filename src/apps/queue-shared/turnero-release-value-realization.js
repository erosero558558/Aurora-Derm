import { asObject } from './turnero-release-control-center.js';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildTurneroReleaseValueRealization(input = {}) {
    const benefits = asObject(input.benefits || {});
    const totals = asObject(benefits.totals || {});
    const opex = asObject(input.opex || {});
    const realized = safeNumber(totals.realized, 0);
    const expected = safeNumber(totals.expected, 0);
    const capex = safeNumber(opex.capex, 0);
    const monthlyOpex = safeNumber(opex.monthlyOpex, 0);
    const monthlyPayback = Number((realized - monthlyOpex).toFixed(2));
    const annualizedValue = Number((monthlyPayback * 12).toFixed(2));
    const paybackMonths =
        monthlyPayback > 0
            ? Number((Math.max(0, capex) / monthlyPayback).toFixed(1))
            : null;
    const mode =
        monthlyPayback <= 0
            ? 'negative'
            : monthlyPayback < Math.max(1, expected * 0.2)
              ? 'slow'
              : 'healthy';

    return {
        monthlyPayback,
        annualizedValue,
        paybackMonths,
        mode,
        state:
            mode === 'negative'
                ? 'alert'
                : mode === 'slow'
                  ? 'warning'
                  : 'ready',
        realizationPct: safeNumber(benefits.realizationPct, 0),
        summary: `Value realization ${mode} · monthly payback ${monthlyPayback}.`,
        generatedAt: new Date().toISOString(),
    };
}

export default buildTurneroReleaseValueRealization;
