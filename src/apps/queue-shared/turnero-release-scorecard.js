import {
    asObject,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';

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
        source.controlCenter?.snapshot ||
        source.currentSnapshot ||
        source.snapshot ||
        source.controlCenter ||
        source
    );
}

function normalizeReadinessState(value) {
    const state = toText(value, 'info').toLowerCase();
    if (['ready', 'done', 'ok', 'success', 'clear'].includes(state)) {
        return 'ready';
    }
    if (
        ['warning', 'watch', 'pending', 'pending_review', 'review'].includes(
            state
        )
    ) {
        return 'warning';
    }
    if (['alert', 'blocked', 'critical', 'error', 'hold'].includes(state)) {
        return 'alert';
    }

    return 'info';
}

function describeReadinessState(value) {
    const state = normalizeReadinessState(value);
    if (state === 'ready') {
        return 'ready';
    }
    if (state === 'warning') {
        return 'warning';
    }
    if (state === 'alert') {
        return 'alert';
    }
    return 'info';
}

function pointsForState(state, pointMap, fallback = 0) {
    const normalized = normalizeReadinessState(state);
    if (normalized === 'ready') {
        return safeNumber(pointMap.ready, fallback);
    }
    if (normalized === 'warning') {
        return safeNumber(pointMap.warning, fallback);
    }
    if (normalized === 'alert') {
        return safeNumber(pointMap.alert, fallback);
    }
    return safeNumber(pointMap.info, fallback);
}

function countIncidents(incidents) {
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
            } else {
                accumulator.info += 1;
            }
            return accumulator;
        },
        {
            critical: 0,
            warning: 0,
            info: 0,
        }
    );
}

function stateLabel(value) {
    const state = describeReadinessState(value);
    if (state === 'ready') {
        return 'ready';
    }
    if (state === 'warning') {
        return 'review';
    }
    if (state === 'alert') {
        return 'hold';
    }
    return 'partial';
}

function computeOwnerProgress(snapshot) {
    const localReadiness = asObject(
        snapshot.localReadinessModel ||
            snapshot.pilotReadiness ||
            snapshot.turneroPilotReadiness ||
            {}
    );
    const totalSurfaceCount = safeNumber(
        localReadiness.totalSurfaceCount || localReadiness.totalSurfaces,
        0
    );
    const readySurfaceCount = safeNumber(
        localReadiness.readySurfaceCount || localReadiness.readyCount,
        0
    );
    const readinessItems = toArray(
        localReadiness.readinessItems || snapshot.readinessItems
    );
    const goLiveIssues = toArray(
        localReadiness.goLiveIssues || snapshot.goLiveIssues
    );

    if (totalSurfaceCount > 0) {
        const ratio = clamp(readySurfaceCount / totalSurfaceCount, 0, 1);
        const issuePenalty = clamp(
            safeNumber(localReadiness.readinessBlockingCount, 0) +
                safeNumber(localReadiness.goLiveBlockingCount, 0),
            0,
            6
        );
        return clamp(Math.round(ratio * 10) - issuePenalty, 0, 10);
    }

    if (readinessItems.length || goLiveIssues.length) {
        const completed = readinessItems.filter((item) =>
            ['ready', 'done', 'ok', 'success', 'clear'].includes(
                normalizeReadinessState(
                    item?.state || item?.status || item?.tone
                )
            )
        ).length;
        const completedGoLive = goLiveIssues.filter((item) =>
            ['ready', 'done', 'ok', 'success', 'clear'].includes(
                normalizeReadinessState(
                    item?.state || item?.status || item?.tone
                )
            )
        ).length;
        const totalItems = readinessItems.length + goLiveIssues.length;
        return totalItems
            ? clamp(
                  Math.round(((completed + completedGoLive) / totalItems) * 10),
                  0,
                  10
              )
            : 0;
    }

    if (snapshot.decision === 'ready') {
        return 8;
    }
    if (snapshot.decision === 'review') {
        return 5;
    }
    return 2;
}

function computeEvidenceCoverage(snapshot) {
    let coverage = 0;

    if (snapshot.turneroClinicProfile || snapshot.clinicProfile) {
        coverage += 2;
    }
    if (snapshot.pilotReadiness || snapshot.turneroPilotReadiness) {
        coverage += 2;
    }
    if (
        snapshot.remoteReleaseReadiness ||
        snapshot.turneroRemoteReleaseReadiness
    ) {
        coverage += 3;
    }
    if (snapshot.publicShellDrift || snapshot.turneroPublicShellDrift) {
        coverage += 3;
    }

    return clamp(coverage, 0, 10);
}

function computeTrendImpact(trend = {}) {
    const sampleSize = safeNumber(trend.sampleSize, 0);
    if (sampleSize <= 0 || trend.insufficientHistory === true) {
        return 0;
    }

    const confidence = sampleSize >= 3 ? 1 : sampleSize === 2 ? 0.8 : 0.5;
    const directionBonus =
        trend.direction === 'improving'
            ? 6
            : trend.direction === 'regressing'
              ? -8
              : 0;
    const deltaBonus = clamp(Math.round(safeNumber(trend.delta, 0) / 3), -6, 6);
    const stabilityBonus = clamp(
        Math.round((safeNumber(trend.stabilityIndex, 50) - 50) / 10),
        -4,
        4
    );

    return clamp(
        Math.round((directionBonus + deltaBonus + stabilityBonus) * confidence),
        -12,
        12
    );
}

function scoreFromBuckets(scorecard) {
    return safeNumber(
        scorecard.localReadiness +
            scorecard.remoteReadiness +
            scorecard.publicShell +
            scorecard.ownerProgress +
            scorecard.evidenceCoverage +
            scorecard.trend -
            scorecard.incidentPenalty -
            scorecard.decisionPenalty,
        0
    );
}

function scoreToGrade(score) {
    if (score >= 90) {
        return 'A';
    }
    if (score >= 80) {
        return 'B';
    }
    if (score >= 70) {
        return 'C';
    }
    if (score >= 60) {
        return 'D';
    }
    return 'F';
}

function scoreToDecision(score, severityCounts, bucketStates) {
    if (severityCounts.critical > 0 || bucketStates.shell === 'alert') {
        return score >= 75 ? 'review' : 'hold';
    }

    if (
        score >= 85 &&
        severityCounts.warning === 0 &&
        bucketStates.remote !== 'warning' &&
        bucketStates.local !== 'warning'
    ) {
        return 'ready';
    }

    if (score >= 65) {
        return 'review';
    }

    return 'hold';
}

function buildClipboardSummary(model) {
    return [
        'Release scorecard',
        `Clinic: ${model.clinicLabel || model.clinicName || model.clinicId}`,
        `Score: ${model.score}/100 (${model.grade})`,
        `Decision: ${model.decisionHint}`,
        `Trend: ${model.trendSummary}`,
        `Buckets: local ${model.buckets.localReadiness}, remote ${model.buckets.remoteReadiness}, shell ${model.buckets.publicShell}, owner ${model.buckets.ownerProgress}, coverage ${model.buckets.evidenceCoverage}, trend ${model.buckets.trend}, penalty ${model.buckets.incidentPenalty + model.buckets.decisionPenalty}`,
    ].join('\n');
}

export function computeReleaseScorecard(snapshot = {}, options = {}) {
    const normalized = normalizeReleaseSnapshot(
        resolveSnapshotCandidate(snapshot)
    );
    const incidents = toArray(normalized.incidents);
    const severityCounts = countIncidents(incidents);
    const currentDecision = toText(normalized.decision, 'ready').toLowerCase();
    const localState = stateLabel(
        normalized.localReadinessModel?.state ||
            normalized.pilotReadiness?.readinessState ||
            normalized.turneroPilotReadiness?.readinessState ||
            currentDecision
    );
    const remoteState = stateLabel(
        normalized.remoteReleaseModel?.status ||
            normalized.remoteReleaseReadiness?.tone ||
            normalized.turneroRemoteReleaseReadiness?.tone ||
            currentDecision
    );
    const publicShell = asObject(
        normalized.publicShellDriftModel ||
            normalized.publicShellDrift ||
            normalized.turneroPublicShellDrift ||
            {}
    );
    let shellState = stateLabel(
        publicShell.driftStatus ||
            publicShell.state ||
            publicShell.tone ||
            currentDecision
    );
    if (
        publicShell.pageOk === false ||
        toArray(publicShell.blockers).length > 0 ||
        publicShell.hasDrift === true
    ) {
        shellState = 'hold';
    }

    const localReadiness = pointsForState(localState, {
        ready: 25,
        warning: 17,
        alert: 6,
        info: 12,
    });
    const remoteReadiness = pointsForState(remoteState, {
        ready: 25,
        warning: 17,
        alert: 6,
        info: 12,
    });
    const publicShellPoints = pointsForState(shellState, {
        ready: 20,
        warning: 12,
        alert: 4,
        info: 14,
    });
    const ownerProgress = computeOwnerProgress(normalized);
    const evidenceCoverage = computeEvidenceCoverage(normalized);
    const trend = asObject(options.trend || snapshot.trend || normalized.trend);
    const trendImpact =
        options.excludeTrend === true ? 0 : computeTrendImpact(trend);
    const incidentPenalty =
        severityCounts.critical * 14 +
        severityCounts.warning * 4 +
        severityCounts.info * 1 +
        clamp(safeNumber(normalized.alertCount, 0), 0, 12) * 2;
    const decisionPenalty =
        currentDecision === 'hold' ? 8 : currentDecision === 'review' ? 2 : 0;

    const buckets = {
        localReadiness,
        remoteReadiness,
        publicShell: publicShellPoints,
        ownerProgress,
        evidenceCoverage,
        trend: trendImpact,
        incidentPenalty,
        decisionPenalty,
    };

    const rawScore = scoreFromBuckets(buckets);
    const score = clamp(Math.round(rawScore), 0, 100);
    const grade = scoreToGrade(score);
    const decisionHint = scoreToDecision(score, severityCounts, {
        local: localState,
        remote: remoteState,
        shell: shellState,
    });
    const trendSummary = trend.insufficientHistory
        ? 'insufficient history'
        : `${trend.direction || 'stable'} / delta ${safeNumber(trend.delta, 0)} / stability ${safeNumber(trend.stabilityIndex, 50)}`;
    const summary = `Score ${score}/100 (${grade}) · ${decisionHint} · local ${localState} · remote ${remoteState} · shell ${shellState}${
        trend.sampleSize ? ` · trend ${trend.direction || 'stable'}` : ''
    }`;
    const clinicLabel = toText(
        normalized.clinicShortName ||
            normalized.clinicName ||
            normalized.label ||
            normalized.clinicId ||
            'default-clinic'
    );

    return {
        clinicId: normalized.clinicId || 'default-clinic',
        clinicName: normalized.clinicName || clinicLabel,
        clinicShortName: normalized.clinicShortName || clinicLabel,
        clinicLabel,
        profileFingerprint: normalized.profileFingerprint || '',
        score,
        grade,
        decisionHint,
        trendImpact,
        trendSummary,
        buckets,
        severity: {
            critical: severityCounts.critical,
            warning: severityCounts.warning,
            info: severityCounts.info,
        },
        bucketStates: {
            local: localState,
            remote: remoteState,
            shell: shellState,
        },
        incidents: incidents.length,
        surfaceCount: safeNumber(normalized.surfaceCount, 0),
        trendSampleSize: safeNumber(trend.sampleSize, 0),
        summary,
        clipboardSummary: buildClipboardSummary({
            clinicLabel,
            clinicName: normalized.clinicName,
            clinicId: normalized.clinicId,
            score,
            grade,
            decisionHint,
            trendSummary,
            buckets,
        }),
    };
}

export default computeReleaseScorecard;
