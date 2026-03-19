import { asObject, toText } from './turnero-release-control-center.js';
import { buildMultiClinicCohortPlanner } from './turnero-release-clinic-cohort-planner.js';
import { buildMultiClinicRegionalCoverage } from './turnero-release-regional-coverage.js';
import { buildMultiClinicRegionalScoreboard } from './turnero-release-regional-scoreboard.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function recommendationRank(value) {
    switch (value) {
        case 'safe-expand':
            return 0;
        case 'review-expand':
            return 1;
        default:
            return 2;
    }
}

function buildScenario(name, trafficPercent, planner, scoreboard, coverage) {
    const plans = Array.isArray(planner.plans) ? planner.plans : [];
    const underCoveredCount = Array.isArray(coverage.underCoveredRegions)
        ? coverage.underCoveredRegions.length
        : 0;
    const highRiskCount = plans.filter(
        (plan) => plan.riskBand === 'high' || plan.riskBand === 'critical'
    ).length;
    const averageScore = safeNumber(scoreboard.averageScore, 0);
    const averageRisk = safeNumber(scoreboard.averageRisk, 0);
    const expectedGain = clamp(
        Math.round(averageScore * (trafficPercent / 100) * 0.75),
        0,
        100
    );
    const riskDelta = clamp(
        Math.round(
            averageRisk * (trafficPercent / 100) * 0.8 +
                underCoveredCount * 10 +
                highRiskCount * 3
        ),
        0,
        100
    );
    const rollbackExposure = clamp(
        Math.round(trafficPercent / 5 + highRiskCount * 2),
        0,
        100
    );
    const coverageNeed = clamp(
        underCoveredCount + (trafficPercent > 25 ? 1 : 0),
        0,
        20
    );
    const operatorLoad = clamp(
        Math.round(plans.length * (trafficPercent / 20) + coverageNeed * 2),
        0,
        100
    );
    const approvalDebt = clamp(
        safeNumber(planner.counts?.approvalDebt, 0) +
            coverageNeed +
            Math.round(trafficPercent / 10),
        0,
        100
    );
    const recommendation =
        riskDelta <= 20 && coverageNeed === 0
            ? 'safe-expand'
            : riskDelta <= 40 && coverageNeed <= 1
              ? 'review-expand'
              : 'hold-expand';

    return {
        name,
        trafficPercent,
        targetCohort:
            trafficPercent <= 10
                ? 'pilot'
                : trafficPercent <= 25
                  ? 'wave-1'
                  : trafficPercent <= 45
                    ? 'wave-2'
                    : 'wave-3',
        expectedGain,
        riskDelta,
        rollbackExposure,
        coverageNeed,
        operatorLoad,
        approvalDebt,
        recommendation,
        tone:
            recommendation === 'safe-expand'
                ? 'ready'
                : recommendation === 'review-expand'
                  ? 'warning'
                  : 'alert',
        summary: `${name} ${trafficPercent}% · gain ${expectedGain} · risk ${riskDelta} · rollback ${rollbackExposure}`,
    };
}

function compareScenarios(left, right) {
    const leftRank = recommendationRank(left.recommendation);
    const rightRank = recommendationRank(right.recommendation);
    if (leftRank !== rightRank) {
        return leftRank - rightRank;
    }

    if (left.riskDelta !== right.riskDelta) {
        return left.riskDelta - right.riskDelta;
    }

    return right.expectedGain - left.expectedGain;
}

export function buildMultiClinicExpansionSimulator(input = {}) {
    const source = asObject(input);
    const planner = source.planner || buildMultiClinicCohortPlanner(source);
    const scoreboard =
        source.scoreboard ||
        buildMultiClinicRegionalScoreboard({ ...source, planner });
    const coverage =
        source.coverage ||
        buildMultiClinicRegionalCoverage({ ...source, scoreboard });
    const scenarios = [
        buildScenario('conservative', 10, planner, scoreboard, coverage),
        buildScenario('balanced', 25, planner, scoreboard, coverage),
        buildScenario('aggressive', 45, planner, scoreboard, coverage),
    ];
    const selectedScenario =
        scenarios.slice().sort(compareScenarios)[0] || scenarios[0] || null;
    const recommendedScenario = selectedScenario
        ? selectedScenario.recommendation
        : 'hold-expand';

    return {
        planner,
        scoreboard,
        coverage,
        scenarios,
        selectedScenario,
        recommendedScenario,
        recommendedTrafficPercent: selectedScenario?.trafficPercent || 0,
        recommendedCohort: selectedScenario?.targetCohort || 'holdouts',
        safeToExpand: recommendedScenario === 'safe-expand',
        summary: scenarios.length
            ? `Simulador multi-clinic ${scenarios.length} escenario(s) · recomendado ${selectedScenario?.name || 'n/a'} (${recommendedScenario}).`
            : 'Simulador multi-clinic vacío.',
        scenarioMap: Object.fromEntries(
            scenarios.map((scenario) => [scenario.name, scenario])
        ),
        riskEnvelope: {
            bestCase: scenarios[0]?.expectedGain || 0,
            worstCase: scenarios[scenarios.length - 1]?.riskDelta || 0,
            underCoveredRegions: Array.isArray(coverage.underCoveredRegions)
                ? coverage.underCoveredRegions.length
                : 0,
        },
        approvalDebt: safeNumber(planner.counts?.approvalDebt, 0),
    };
}

export default buildMultiClinicExpansionSimulator;
