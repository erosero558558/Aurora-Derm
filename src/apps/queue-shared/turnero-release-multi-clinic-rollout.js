import { asObject, toText } from './turnero-release-control-center.js';
import { buildMultiClinicExpansionSimulator } from './turnero-release-expansion-simulator.js';
import { buildMultiClinicPortfolioHeatmap } from './turnero-release-portfolio-heatmap.js';
import { buildMultiClinicRegionalCoverage } from './turnero-release-regional-coverage.js';
import { buildMultiClinicRegionalRegistry } from './turnero-release-regional-registry.js';
import { buildMultiClinicCohortPlanner } from './turnero-release-clinic-cohort-planner.js';
import { buildMultiClinicRegionalScoreboard } from './turnero-release-regional-scoreboard.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function cloneSerializable(value) {
    return JSON.parse(
        JSON.stringify(value, (_key, entry) => {
            if (typeof entry === 'function') {
                return undefined;
            }

            return entry;
        })
    );
}

function buildDecision(scoreboard, simulator, coverage) {
    const underCovered = Array.isArray(coverage.underCoveredRegions)
        ? coverage.underCoveredRegions
        : [];

    if (
        coverage.overallStatus === 'red' ||
        underCovered.some((entry) => entry.status === 'single-point-of-failure')
    ) {
        return {
            decision: 'hold',
            tone: 'alert',
            reason: 'Cobertura insuficiente para expandir.',
        };
    }

    if (simulator.recommendedScenario === 'safe-expand') {
        return {
            decision: 'promote',
            tone: 'ready',
            reason: 'Escenario seguro con cobertura suficiente.',
        };
    }

    if (simulator.recommendedScenario === 'review-expand') {
        return {
            decision: 'review',
            tone: 'warning',
            reason: 'Escenario apto pero requiere revisión adicional.',
        };
    }

    const highestRisk = scoreboard.highestRisk || null;
    return {
        decision: 'hold',
        tone: 'alert',
        reason: highestRisk
            ? `Riesgo alto en ${highestRisk.clinicLabel}.`
            : 'Riesgo alto o cobertura incompleta.',
    };
}

function buildRegionalPlan(scoreboard, coverage) {
    const coverageMap = coverage.coverageMap || {};

    return (scoreboard.regions || []).map((region) => {
        const coverageRow = coverageMap[region.region] || {};
        const status = coverageRow.status || 'unknown';

        return {
            region: region.region,
            clinicCount: region.clinicCount,
            averageScore: region.averageScore,
            averageRisk: region.averageRisk,
            status,
            tone: coverageRow.tone || region.tone || 'info',
            ownerTeams: region.ownerTeams || [],
            nextStep:
                status === 'healthy-coverage'
                    ? 'promote'
                    : status === 'thin-coverage'
                      ? 'review'
                      : 'hold',
            note:
                coverageRow.notes ||
                (status === 'healthy-coverage'
                    ? 'Cobertura saludable'
                    : 'Requiere refuerzo'),
        };
    });
}

function buildTopRegionalRisks(scoreboard, coverage, heatmap) {
    const risks = [];

    if (scoreboard.highestRisk) {
        risks.push({
            type: 'clinic',
            label: scoreboard.highestRisk.clinicLabel,
            region: scoreboard.highestRisk.region,
            riskScore: scoreboard.highestRisk.riskScore,
            reason: 'Mayor riesgo del portafolio',
        });
    }

    for (const entry of coverage.underCoveredRegions || []) {
        risks.push({
            type: 'region',
            label: entry.region,
            region: entry.region,
            riskScore: entry.averageRisk,
            reason: entry.notes,
        });
    }

    for (const hotspot of heatmap.hotspots || []) {
        risks.push({
            type: 'hotspot',
            label: hotspot.clinicLabel,
            region: hotspot.region,
            riskScore: hotspot.riskScore,
            reason: hotspot.reason,
        });
    }

    return risks
        .filter(Boolean)
        .sort(
            (left, right) =>
                safeNumber(right.riskScore, 0) - safeNumber(left.riskScore, 0)
        )
        .slice(0, 5);
}

function buildCopyableExecutiveBrief({
    registry,
    planner,
    scoreboard,
    simulator,
    heatmap,
    coverage,
    portfolioDecision,
    recommendedNextCohort,
    topRegionalRisks,
}) {
    const lines = [
        '# Turnero Multi-Clinic Control Tower',
        '',
        `- Decision: ${portfolioDecision.decision}`,
        `- Reason: ${portfolioDecision.reason}`,
        `- Recommended cohort: ${toText(recommendedNextCohort, 'holdouts')}`,
        `- Registry: ${registry.summary}`,
        `- Planner: ${planner.summary}`,
        `- Scoreboard: ${scoreboard.summary}`,
        `- Coverage: ${coverage.summary}`,
        `- Simulator: ${simulator.summary}`,
        `- Heatmap: ${heatmap.summary}`,
        '',
        '## Top risks',
        ...(topRegionalRisks.length
            ? topRegionalRisks.map(
                  (risk) =>
                      `- [${risk.type}] ${risk.label}: ${risk.reason} (${risk.riskScore})`
              )
            : ['- Sin riesgos destacados.']),
    ];

    return lines.join('\n');
}

function buildTextPack(title, rows) {
    const lines = [title, ''];

    for (const row of rows) {
        lines.push(`- ${row}`);
    }

    return lines.join('\n').trim();
}

function buildScoreboardText(scoreboard) {
    const lines = [scoreboard.summary, '', 'Regions:'];

    for (const region of scoreboard.regions || []) {
        lines.push(
            `- ${region.region}: clinics ${region.clinicCount}, avg score ${region.averageScore}, avg risk ${region.averageRisk}, status ${region.tone}`
        );
    }

    return lines.join('\n');
}

function buildCohortPlanText(planner) {
    const rows = (planner.plans || []).map(
        (plan) =>
            `${plan.clinicLabel} · ${plan.cohort} · score ${plan.score} · risk ${plan.riskBand} · decision ${plan.decision}`
    );
    return buildTextPack(planner.summary, rows);
}

function buildHotspotText(heatmap) {
    const rows = (heatmap.hotspots || []).map(
        (hotspot) =>
            `${hotspot.clinicLabel} · ${hotspot.region} · ${hotspot.reason} · risk ${hotspot.riskScore}`
    );
    return buildTextPack(heatmap.summary, rows);
}

function buildSimulatorText(simulator) {
    const rows = (simulator.scenarios || []).map(
        (scenario) =>
            `${scenario.name} · ${scenario.trafficPercent}% · ${scenario.recommendation} · gain ${scenario.expectedGain} · risk ${scenario.riskDelta}`
    );
    return buildTextPack(simulator.summary, rows);
}

function buildCoverageText(coverage) {
    const rows = (coverage.coverage || []).map(
        (entry) =>
            `${entry.region} · ${entry.status} · clinics ${entry.clinicCount} · avg risk ${entry.averageRisk}`
    );
    return buildTextPack(coverage.summary, rows);
}

export function buildMultiClinicRollout(context = {}) {
    const source = asObject(context);
    const registry =
        source.registry || buildMultiClinicRegionalRegistry(source);
    const cohortPlanner =
        source.cohortPlanner ||
        buildMultiClinicCohortPlanner({ ...source, registry });
    const scoreboard =
        source.scoreboard ||
        buildMultiClinicRegionalScoreboard({
            ...source,
            planner: cohortPlanner,
        });
    const coverage =
        source.coverage ||
        buildMultiClinicRegionalCoverage({ ...source, scoreboard });
    const heatmap =
        source.heatmap ||
        buildMultiClinicPortfolioHeatmap({ ...source, planner: cohortPlanner });
    const simulator =
        source.simulator ||
        buildMultiClinicExpansionSimulator({
            ...source,
            planner: cohortPlanner,
            scoreboard,
            coverage,
        });
    const portfolioDecision = buildDecision(scoreboard, simulator, coverage);
    const recommendedNextCohort =
        simulator.recommendedCohort ||
        cohortPlanner.recommendedNextCohort ||
        'holdouts';
    const topRegionalRisks = buildTopRegionalRisks(
        scoreboard,
        coverage,
        heatmap
    );
    const regionalPlan = buildRegionalPlan(scoreboard, coverage);
    const generatedAt = toText(source.generatedAt || new Date().toISOString());
    const copyableExecutiveBrief = buildCopyableExecutiveBrief({
        registry,
        planner: cohortPlanner,
        scoreboard,
        simulator,
        heatmap,
        coverage,
        portfolioDecision,
        recommendedNextCohort,
        topRegionalRisks,
    });
    const copyableCohortPlan = buildCohortPlanText(cohortPlanner);
    const copyableScoreboard = buildScoreboardText(scoreboard);
    const copyableHotspots = buildHotspotText(heatmap);
    const copyableSimulator = buildSimulatorText(simulator);
    const copyableCoverage = buildCoverageText(coverage);
    const jsonPack = cloneSerializable({
        generatedAt,
        registry: cloneSerializable(registry),
        cohortPlanner: cloneSerializable(cohortPlanner),
        scoreboard: cloneSerializable(scoreboard),
        simulator: cloneSerializable(simulator),
        heatmap: cloneSerializable(heatmap),
        coverage: cloneSerializable(coverage),
        portfolioDecision: cloneSerializable(portfolioDecision),
        recommendedNextCohort,
        topRegionalRisks: cloneSerializable(topRegionalRisks),
        regionalPlan: cloneSerializable(regionalPlan),
        executiveBrief: copyableExecutiveBrief,
    });

    return {
        generatedAt,
        registry,
        cohortPlanner,
        scoreboard,
        simulator,
        heatmap,
        coverage,
        portfolioDecision,
        recommendedNextCohort,
        topRegionalRisks,
        regionalPlan,
        copyableExecutiveBrief,
        copyableCohortPlan,
        copyableScoreboard,
        copyableHotspots,
        copyableSimulator,
        copyableCoverage,
        jsonPack,
        jsonPackFileName: `turnero-multi-clinic-control-tower-${generatedAt
            .slice(0, 10)
            .replace(/-/g, '')}.json`,
        summary: `Turnero multi-clinic ${portfolioDecision.decision} · ${recommendedNextCohort} · ${scoreboard.summary}`,
    };
}

export { buildDecision };

export default buildMultiClinicRollout;
