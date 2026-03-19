import {
    asObject,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';
import { computeReleaseScorecard } from './turnero-release-scorecard.js';
import { analyzeReleaseTrend } from './turnero-release-trend-analyzer.js';

function clamp(value, min, max) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return min;
    }

    return Math.max(min, Math.min(max, numberValue));
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function hasDetailedReleaseFields(source) {
    return Boolean(
        source.localReadinessModel ||
        source.pilotReadiness ||
        source.turneroPilotReadiness ||
        source.remoteReleaseReadiness ||
        source.turneroRemoteReleaseReadiness ||
        source.publicShellDrift ||
        source.turneroPublicShellDrift ||
        source.releaseEvidenceBundle ||
        source.turneroReleaseEvidenceBundle
    );
}

function resolveSnapshotCandidate(entry = {}) {
    const source = asObject(entry);
    if (hasDetailedReleaseFields(source)) {
        return source;
    }
    return (
        source.currentEvidence ||
        source.currentSnapshot ||
        source.controlCenter?.snapshot ||
        source.baseline?.snapshot ||
        source.snapshot ||
        source.controlCenter ||
        source
    );
}

function compareClinics(left, right) {
    const leftScore = safeNumber(left.score, -1);
    const rightScore = safeNumber(right.score, -1);
    if (leftScore !== rightScore) {
        return rightScore - leftScore;
    }

    return toText(left.clinicLabel || left.clinicId).localeCompare(
        toText(right.clinicLabel || right.clinicId)
    );
}

function countIncidentSeverity(incidents) {
    return toArray(incidents).reduce(
        (accumulator, incident) => {
            const severity = normalizeSeverity(
                incident?.severity ||
                    incident?.state ||
                    incident?.tone ||
                    'info'
            );
            if (severity === 'alert') {
                accumulator.critical += 1;
            } else if (severity === 'warning') {
                accumulator.high += 1;
            } else {
                accumulator.info += 1;
            }
            return accumulator;
        },
        {
            critical: 0,
            high: 0,
            info: 0,
        }
    );
}

function normalizeClinicSuite(entry, index = 0) {
    const source = asObject(entry);
    const currentSnapshot = normalizeReleaseSnapshot(
        resolveSnapshotCandidate(source) || {}
    );
    const trend =
        asObject(source.trend).sampleSize !== undefined
            ? asObject(source.trend)
            : analyzeReleaseTrend(toArray(source.history), {
                  currentSnapshot,
              });
    const scorecard =
        asObject(source.scorecard).score !== undefined
            ? asObject(source.scorecard)
            : computeReleaseScorecard(currentSnapshot, {
                  trend,
              });
    const baseline = asObject(source.baseline || source.activeBaseline || {});
    const baselineRegistry = asObject(source.baselineRegistry || {});
    const incidentCounts = countIncidentSeverity(currentSnapshot.incidents);
    const clinicId = toText(
        source.clinicId ||
            currentSnapshot.clinicId ||
            baseline.clinicId ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
    const clinicLabel = toText(
        source.clinicLabel ||
            source.clinicName ||
            currentSnapshot.clinicShortName ||
            currentSnapshot.clinicName ||
            clinicId,
        clinicId
    );
    const decisionHint = toText(
        scorecard.decisionHint ||
            source.decisionHint ||
            currentSnapshot.decision ||
            'review'
    );

    return {
        clinicId,
        clinicLabel,
        clinicName: currentSnapshot.clinicName || clinicLabel,
        score: safeNumber(scorecard.score, 0),
        grade: toText(scorecard.grade, 'F'),
        decisionHint,
        trend: trend.direction || 'stable',
        stabilityIndex: safeNumber(trend.stabilityIndex, 50),
        activeBaselineId:
            toText(
                baseline.baselineId ||
                    source.activeBaselineId ||
                    baselineRegistry.activeBaselineId ||
                    ''
            ) || null,
        criticalIncidents: incidentCounts.critical,
        highIncidents: incidentCounts.high,
        lastDecision: toText(
            source.releaseDecision ||
                scorecard.decisionHint ||
                currentSnapshot.decision,
            scorecard.decisionHint || currentSnapshot.decision || 'review'
        ),
        updatedAt: toText(
            source.updatedAt ||
                currentSnapshot.savedAt ||
                currentSnapshot.generatedAt ||
                ''
        ),
        currentSnapshot,
        scorecard,
        trendModel: trend,
        baseline,
    };
}

export function buildReleasePortfolioDashboard(clinicSnapshots = []) {
    const clinics = toArray(clinicSnapshots).map((entry, index) =>
        normalizeClinicSuite(entry, index)
    );
    clinics.sort(compareClinics);

    const totals = clinics.reduce(
        (accumulator, clinic) => {
            accumulator.total += 1;
            accumulator.scoreSum += safeNumber(clinic.score, 0);
            if (clinic.decisionHint === 'ready') {
                accumulator.ready += 1;
            } else if (clinic.decisionHint === 'review') {
                accumulator.review += 1;
            } else {
                accumulator.hold += 1;
            }
            accumulator.criticalIncidents += safeNumber(
                clinic.criticalIncidents,
                0
            );
            accumulator.highIncidents += safeNumber(clinic.highIncidents, 0);
            return accumulator;
        },
        {
            total: 0,
            ready: 0,
            review: 0,
            hold: 0,
            criticalIncidents: 0,
            highIncidents: 0,
            scoreSum: 0,
        }
    );

    const averageScore = totals.total
        ? Math.round((totals.scoreSum / totals.total) * 10) / 10
        : 0;
    const bestClinic = clinics[0] || null;
    const worstClinic = clinics[clinics.length - 1] || null;

    return {
        clinics,
        totals: {
            total: totals.total,
            ready: totals.ready,
            review: totals.review,
            hold: totals.hold,
            criticalIncidents: totals.criticalIncidents,
            highIncidents: totals.highIncidents,
            averageScore,
            bestScore: safeNumber(bestClinic?.score, 0),
            worstScore: safeNumber(worstClinic?.score, 0),
            scoreSum: totals.scoreSum,
        },
        summary:
            totals.total > 0
                ? `Portfolio ${totals.total} clinic(s) · ready ${totals.ready} · review ${totals.review} · hold ${totals.hold} · avg score ${averageScore}.`
                : 'Portfolio 0 clinic(s).',
    };
}

export default buildReleasePortfolioDashboard;
