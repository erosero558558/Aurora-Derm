import {
    asObject,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';
import { computeReleaseScorecard } from './turnero-release-scorecard.js';

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

function resolveSnapshotCandidate(input = {}) {
    const source = asObject(input);
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

function resolveHistoryCandidate(entry = {}) {
    const source = asObject(entry);
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

function compareDatesDesc(left, right) {
    const leftTime = new Date(
        left?.promotedAt ||
            left?.savedAt ||
            left?.generatedAt ||
            left?.createdAt ||
            0
    ).getTime();
    const rightTime = new Date(
        right?.promotedAt ||
            right?.savedAt ||
            right?.generatedAt ||
            right?.createdAt ||
            0
    ).getTime();

    if (Number.isNaN(leftTime) && Number.isNaN(rightTime)) {
        return 0;
    }
    if (Number.isNaN(leftTime)) {
        return 1;
    }
    if (Number.isNaN(rightTime)) {
        return -1;
    }

    return rightTime - leftTime;
}

function buildKindLabel(incident = {}) {
    const kind = toText(
        incident.kind ||
            incident.code ||
            incident.source ||
            incident.id ||
            'incident',
        'incident'
    );
    return kind.toLowerCase();
}

function countSeverity(incidents) {
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
                accumulator.warning += 1;
            } else if (severity === 'ready') {
                accumulator.ready += 1;
            } else {
                accumulator.info += 1;
            }
            return accumulator;
        },
        {
            critical: 0,
            warning: 0,
            ready: 0,
            info: 0,
        }
    );
}

function buildTrendSeriesEntry(entry, index = 0) {
    const candidate = resolveHistoryCandidate(entry);
    const normalized = normalizeReleaseSnapshot(candidate || {});
    const existingScorecard = asObject(entry?.scorecard);
    const scorecard = Number.isFinite(Number(existingScorecard.score))
        ? existingScorecard
        : computeReleaseScorecard(normalized, { excludeTrend: true });
    const incidents = toArray(normalized.incidents);

    return {
        index,
        snapshotId: normalized.snapshotId,
        baselineId:
            toText(
                entry?.baselineId ||
                    entry?.baseline?.baselineId ||
                    normalized.baselineId ||
                    ''
            ) || null,
        label: toText(
            entry?.label ||
                entry?.baselineLabel ||
                normalized.label ||
                normalized.clinicShortName ||
                normalized.clinicName ||
                normalized.clinicId ||
                `baseline-${index + 1}`
        ),
        clinicId: normalized.clinicId || 'default-clinic',
        score: safeNumber(scorecard.score, 0),
        grade: toText(scorecard.grade, 'F'),
        decisionHint: toText(
            scorecard.decisionHint,
            normalized.decision || 'review'
        ),
        severity: toText(normalized.severity || scorecard.severity || 'info'),
        summary: toText(
            entry?.summary ||
                entry?.baselineSummary ||
                normalized.summary ||
                normalized.supportCopy ||
                ''
        ),
        promotedAt: toText(entry?.promotedAt || normalized.promotedAt || ''),
        savedAt: toText(entry?.savedAt || normalized.savedAt || ''),
        archivedAt: toText(entry?.archivedAt || normalized.archivedAt || ''),
        isArchived:
            entry?.isArchived === true || normalized.isArchived === true,
        incidentCount: incidents.length,
        surfaceCount: safeNumber(normalized.surfaceCount, 0),
        incidents,
        kindCounts: incidents.reduce((accumulator, incident) => {
            const kind = buildKindLabel(incident);
            accumulator[kind] = (accumulator[kind] || 0) + 1;
            return accumulator;
        }, {}),
    };
}

function buildSummary({
    sampleSize,
    currentScore,
    delta,
    direction,
    stabilityIndex,
    regressionCount,
    improvementCount,
}) {
    if (sampleSize < 2) {
        return `Historial insuficiente: ${sampleSize} baseline(s) promovido(s). Score actual ${currentScore}/100.`;
    }

    const directionLabel =
        direction === 'improving'
            ? 'mejorando'
            : direction === 'regressing'
              ? 'regresando'
              : 'estable';

    return `Trend ${directionLabel} · delta ${delta} · stability ${stabilityIndex} · regressions ${regressionCount} · improvements ${improvementCount}.`;
}

export function analyzeReleaseTrend(history = [], options = {}) {
    const historyEntries = toArray(history)
        .map((entry, index) => buildTrendSeriesEntry(entry, index))
        .filter((entry) => Boolean(entry.snapshotId || entry.label))
        .sort(compareDatesDesc)
        .slice(
            0,
            Number.isFinite(Number(options.limit))
                ? Math.max(1, Number(options.limit))
                : 5
        );

    const currentCandidate = resolveSnapshotCandidate(
        options.currentSnapshot ||
            options.currentControlCenter ||
            options.currentEvidence ||
            options.current ||
            {}
    );
    const currentNormalized = currentCandidate
        ? normalizeReleaseSnapshot(currentCandidate)
        : null;
    const currentScorecard = currentNormalized
        ? computeReleaseScorecard(currentNormalized, { excludeTrend: true })
        : null;
    const currentScore = safeNumber(currentScorecard?.score, 0);
    const historicalScores = historyEntries.map((entry) =>
        safeNumber(entry.score, 0)
    );
    const mostRecentHistoricalScore = historicalScores[0] ?? null;
    const oldestHistoricalScore =
        historicalScores[historicalScores.length - 1] ??
        mostRecentHistoricalScore ??
        currentScore;
    const historyDelta =
        historicalScores.length > 0
            ? safeNumber(mostRecentHistoricalScore, currentScore) -
              safeNumber(oldestHistoricalScore, currentScore)
            : 0;
    const currentDelta =
        mostRecentHistoricalScore === null
            ? 0
            : currentScore -
              safeNumber(mostRecentHistoricalScore, currentScore);
    const delta = currentCandidate ? currentDelta : historyDelta;
    const direction =
        delta > 5 ? 'improving' : delta < -5 ? 'regressing' : 'stable';
    const insufficientHistory = historyEntries.length < 2;

    let regressionCount = 0;
    let improvementCount = 0;
    const severityCounter = {
        critical: 0,
        warning: 0,
        ready: 0,
        info: 0,
    };
    const kindCounter = {};

    const seriesForVariance = [];

    historyEntries.forEach((entry, index) => {
        seriesForVariance.push(entry.score);
        const severityCounts = countSeverity(entry.incidents);
        severityCounter.critical += severityCounts.critical;
        severityCounter.warning += severityCounts.warning;
        severityCounter.ready += severityCounts.ready;
        severityCounter.info += severityCounts.info;

        entry.incidents.forEach((incident) => {
            const kind = buildKindLabel(incident);
            kindCounter[kind] = (kindCounter[kind] || 0) + 1;
        });

        const nextEntry = historyEntries[index + 1] || null;
        if (!nextEntry) {
            return;
        }

        if (entry.score > nextEntry.score + 3) {
            improvementCount += 1;
        } else if (entry.score < nextEntry.score - 3) {
            regressionCount += 1;
        }
    });

    if (currentNormalized) {
        const currentSeverityCounts = countSeverity(
            currentNormalized.incidents
        );
        severityCounter.critical += currentSeverityCounts.critical;
        severityCounter.warning += currentSeverityCounts.warning;
        severityCounter.ready += currentSeverityCounts.ready;
        severityCounter.info += currentSeverityCounts.info;
        toArray(currentNormalized.incidents).forEach((incident) => {
            const kind = buildKindLabel(incident);
            kindCounter[kind] = (kindCounter[kind] || 0) + 1;
        });

        if (mostRecentHistoricalScore !== null) {
            if (currentScore > mostRecentHistoricalScore + 3) {
                improvementCount += 1;
            } else if (currentScore < mostRecentHistoricalScore - 3) {
                regressionCount += 1;
            }
        }

        seriesForVariance.push(currentScore);
    }

    const mean = seriesForVariance.length
        ? seriesForVariance.reduce((sum, value) => sum + value, 0) /
          seriesForVariance.length
        : currentScore;
    const variance = seriesForVariance.length
        ? seriesForVariance.reduce(
              (sum, value) => sum + (value - mean) * (value - mean),
              0
          ) / seriesForVariance.length
        : 0;
    const variancePenalty = Math.min(24, Math.round(Math.sqrt(variance)));
    const stabilityIndex = clamp(
        68 +
            Math.round(delta * 1.2) +
            improvementCount * 3 -
            regressionCount * 5 -
            variancePenalty,
        0,
        100
    );

    const noisySignals = Object.entries(kindCounter)
        .filter(([_kind, count]) => count >= 2)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([kind]) => kind);

    const reference = historyEntries[0] || null;
    const summary = buildSummary({
        sampleSize: historyEntries.length,
        currentScore,
        delta,
        direction,
        stabilityIndex,
        regressionCount,
        improvementCount,
    });

    return {
        sampleSize: historyEntries.length,
        scores: historyEntries.map((entry) => entry.score),
        series: historyEntries,
        currentScore,
        delta,
        direction,
        stabilityIndex,
        regressionCount,
        improvementCount,
        severityCounter,
        noisySignals,
        insufficientHistory,
        referenceBaselineId: reference?.baselineId || null,
        referenceSnapshotId: reference?.snapshotId || null,
        referenceLabel: reference?.label || null,
        summary,
    };
}

export default analyzeReleaseTrend;
