import { asObject, toArray, toText } from './turnero-release-control-center.js';
import { buildMultiClinicCohortPlanner } from './turnero-release-clinic-cohort-planner.js';

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function compareByScore(left, right) {
    if (right.score !== left.score) {
        return right.score - left.score;
    }

    if (left.riskScore !== right.riskScore) {
        return left.riskScore - right.riskScore;
    }

    return toText(left.clinicLabel).localeCompare(toText(right.clinicLabel));
}

function compareByRisk(left, right) {
    if (right.riskScore !== left.riskScore) {
        return right.riskScore - left.riskScore;
    }

    if (right.blockingCount !== left.blockingCount) {
        return right.blockingCount - left.blockingCount;
    }

    return toText(left.clinicLabel).localeCompare(toText(right.clinicLabel));
}

function buildRegionRow(region, plans) {
    const clinicCount = plans.length;
    const scoreSum = plans.reduce(
        (accumulator, plan) => accumulator + safeNumber(plan.score, 0),
        0
    );
    const riskSum = plans.reduce(
        (accumulator, plan) =>
            accumulator +
            safeNumber(plan.riskScore, 100 - safeNumber(plan.score, 0)),
        0
    );
    const readyCount = plans.filter(
        (plan) => plan.decision === 'promote'
    ).length;
    const reviewCount = plans.filter(
        (plan) => plan.decision === 'review'
    ).length;
    const holdCount = plans.filter((plan) => plan.decision === 'hold').length;
    const bestClinic = plans.slice().sort(compareByScore)[0] || null;
    const highestRiskClinic = plans.slice().sort(compareByRisk)[0] || null;

    return {
        region,
        clinicCount,
        averageScore: clinicCount ? Math.round(scoreSum / clinicCount) : 0,
        averageRisk: clinicCount ? Math.round(riskSum / clinicCount) : 0,
        readyCount,
        reviewCount,
        holdCount,
        bestClinic,
        highestRiskClinic,
        ownerTeams: Array.from(
            new Set(plans.map((plan) => toText(plan.ownerTeam)))
        ),
        tone:
            holdCount > 0 ||
            (highestRiskClinic && highestRiskClinic.riskScore >= 75)
                ? 'alert'
                : reviewCount > 0 ||
                    (highestRiskClinic && highestRiskClinic.riskScore >= 45)
                  ? 'warning'
                  : 'ready',
    };
}

export function buildMultiClinicRegionalScoreboard(input = {}) {
    const source = asObject(input);
    const planner = source.planner || buildMultiClinicCohortPlanner(source);
    const plans = Array.isArray(planner.plans) ? planner.plans : [];
    const byRegion = new Map();

    for (const plan of plans) {
        const region = toText(plan.region, 'nacional');
        const current = byRegion.get(region) || [];
        current.push(plan);
        byRegion.set(region, current);
    }

    const regions = Array.from(byRegion.entries())
        .map(([region, regionPlans]) => buildRegionRow(region, regionPlans))
        .sort((left, right) => {
            if (right.averageRisk !== left.averageRisk) {
                return right.averageRisk - left.averageRisk;
            }
            return toText(left.region).localeCompare(toText(right.region));
        });
    const bestToWorst = plans.slice().sort(compareByScore);
    const mostAtRisk = plans.slice().sort(compareByRisk);
    const highestRisk = mostAtRisk[0] || null;
    const bestClinic = bestToWorst[0] || null;
    const averageScore = plans.length
        ? Math.round(
              plans.reduce(
                  (accumulator, plan) =>
                      accumulator + safeNumber(plan.score, 0),
                  0
              ) / plans.length
          )
        : 0;
    const averageRisk = plans.length
        ? Math.round(
              plans.reduce(
                  (accumulator, plan) =>
                      accumulator +
                      safeNumber(
                          plan.riskScore,
                          100 - safeNumber(plan.score, 0)
                      ),
                  0
              ) / plans.length
          )
        : 0;

    return {
        planner,
        registry: planner.registry || null,
        regions,
        bestToWorst,
        mostAtRisk,
        highestRisk,
        bestClinic,
        averageScore,
        averageRisk,
        totals: {
            totalClinics: plans.length,
            promote: planner.counts?.promote || 0,
            review: planner.counts?.review || 0,
            hold: planner.counts?.hold || 0,
            highRisk: plans.filter((plan) => plan.riskBand === 'high').length,
            criticalRisk: plans.filter((plan) => plan.riskBand === 'critical')
                .length,
        },
        summary: plans.length
            ? `Scoreboard regional ${plans.length} clínica(s) · mejor ${bestClinic?.clinicLabel || 'n/a'} · riesgo ${highestRisk?.clinicLabel || 'n/a'} · promedio ${averageScore}/100.`
            : 'Scoreboard regional vacío.',
        regionMap: Object.fromEntries(
            regions.map((region) => [region.region, region])
        ),
        topRegions: regions.slice(0, 3),
        riskSpread: highestRisk
            ? {
                  highestRisk: highestRisk.riskScore,
                  lowestRisk:
                      bestToWorst[bestToWorst.length - 1]?.riskScore || 0,
              }
            : { highestRisk: 0, lowestRisk: 0 },
    };
}

export default buildMultiClinicRegionalScoreboard;
