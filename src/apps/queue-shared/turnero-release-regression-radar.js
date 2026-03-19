import {
    asObject,
    normalizeSeverity,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { normalizeReleaseSnapshot } from './turnero-release-history-store.js';

const RADAR_KINDS = Object.freeze([
    'remote-health',
    'public-sync',
    'figo',
    'fallback-source',
    'fingerprint-mismatch',
    'public-shell-drift',
    'surface-readiness',
]);

function resolveSnapshotCandidate(input = {}) {
    const source = asObject(input);
    if (
        source.localReadinessModel ||
        source.pilotReadiness ||
        source.turneroPilotReadiness ||
        source.remoteReleaseReadiness ||
        source.turneroRemoteReleaseReadiness ||
        source.publicShellDrift ||
        source.turneroPublicShellDrift ||
        source.releaseEvidenceBundle ||
        source.turneroReleaseEvidenceBundle
    ) {
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

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function resolveReferenceCandidate(entry = {}) {
    const source = asObject(entry);
    return (
        source.snapshot ||
        source.currentEvidence ||
        source.currentSnapshot ||
        source.controlCenter?.snapshot ||
        source.baseline?.snapshot ||
        source.controlCenter ||
        source
    );
}

function normalizeReferenceBaseline(activeBaseline, recentHistory) {
    if (activeBaseline && typeof activeBaseline === 'object') {
        return {
            baselineId: toText(
                activeBaseline.baselineId || activeBaseline.id || ''
            ),
            label: toText(activeBaseline.label || activeBaseline.name || ''),
            promotedAt: toText(
                activeBaseline.promotedAt || activeBaseline.createdAt || ''
            ),
            archivedAt: toText(activeBaseline.archivedAt || ''),
            isArchived: activeBaseline.isArchived === true,
            snapshot: normalizeReleaseSnapshot(
                resolveReferenceCandidate(activeBaseline) || {}
            ),
            source: 'active-baseline',
        };
    }

    const firstHistory = toArray(recentHistory)[0];
    if (firstHistory) {
        return {
            baselineId: toText(
                firstHistory.baselineId ||
                    firstHistory.id ||
                    firstHistory.snapshotId ||
                    ''
            ),
            label: toText(
                firstHistory.label ||
                    firstHistory.baselineLabel ||
                    firstHistory.clinicShortName ||
                    firstHistory.clinicName ||
                    firstHistory.clinicId ||
                    ''
            ),
            promotedAt: toText(
                firstHistory.promotedAt || firstHistory.savedAt || ''
            ),
            archivedAt: toText(firstHistory.archivedAt || ''),
            isArchived: firstHistory.isArchived === true,
            snapshot: normalizeReleaseSnapshot(
                resolveReferenceCandidate(firstHistory) || {}
            ),
            source: 'history',
        };
    }

    return null;
}

function normalizeHistoryEntry(entry, index = 0) {
    const source = asObject(entry);
    const snapshot = normalizeReleaseSnapshot(
        resolveReferenceCandidate(source) || {}
    );
    return {
        baselineId: toText(
            source.baselineId || source.id || snapshot.baselineId || ''
        ),
        label: toText(
            source.label ||
                source.baselineLabel ||
                snapshot.label ||
                snapshot.clinicShortName ||
                snapshot.clinicName ||
                snapshot.clinicId ||
                `history-${index + 1}`
        ),
        promotedAt: toText(
            source.promotedAt || source.savedAt || snapshot.savedAt || ''
        ),
        archivedAt: toText(source.archivedAt || snapshot.archivedAt || ''),
        isArchived: source.isArchived === true || snapshot.isArchived === true,
        snapshot,
        raw: source,
    };
}

function classifyRadarKind(incident = {}) {
    const source = asObject(incident);
    const explicitKind = toText(
        source.kind || source.radarKind || ''
    ).toLowerCase();
    if (RADAR_KINDS.includes(explicitKind)) {
        return explicitKind;
    }

    const text = [
        source.kind,
        source.code,
        source.id,
        source.label,
        source.title,
        source.summary,
        source.detail,
        source.source,
    ]
        .map((entry) => toText(entry).toLowerCase())
        .join(' ');

    if (text.includes('public sync') || text.includes('public_sync')) {
        return 'public-sync';
    }
    if (text.includes('figo')) {
        return 'figo';
    }
    if (text.includes('fallback') || text.includes('fallback-source')) {
        return 'fallback-source';
    }
    if (text.includes('fingerprint')) {
        return 'fingerprint-mismatch';
    }
    if (text.includes('shell') || text.includes('drift')) {
        return 'public-shell-drift';
    }
    if (text.includes('surface') || text.includes('readiness')) {
        return 'surface-readiness';
    }
    if (text.includes('remote') || text.includes('health')) {
        return 'remote-health';
    }

    return 'surface-readiness';
}

function buildIncidentSignature(incident = {}) {
    const source = asObject(incident);
    return [
        classifyRadarKind(source),
        normalizeSeverity(
            source.severity || source.state || source.tone || 'info'
        ),
        toText(source.code || source.id || source.title || source.label || ''),
        toText(source.detail || source.summary || ''),
    ].join('::');
}

function buildRegressionEntry({
    kind,
    title,
    detail,
    severity,
    currentValue,
    baselineValue,
    source,
}) {
    return {
        kind,
        radarKind: kind,
        title,
        detail,
        severity,
        currentValue,
        baselineValue,
        source,
        isNewAgainstBaseline: true,
    };
}

function addRegression(map, regression) {
    const key = [
        regression.kind,
        regression.title,
        regression.detail,
        regression.currentValue,
        regression.baselineValue,
    ].join('::');
    if (!map.has(key)) {
        map.set(key, regression);
    }
}

function getPublicSync(snapshot) {
    return asObject(
        snapshot.remoteReleaseReadiness?.checks?.publicSync ||
            snapshot.turneroRemoteReleaseReadiness?.checks?.publicSync ||
            snapshot.remoteReleaseModel?.checks?.publicSync ||
            {}
    );
}

function getRemoteReadiness(snapshot) {
    return asObject(
        snapshot.remoteReleaseReadiness ||
            snapshot.turneroRemoteReleaseReadiness ||
            snapshot.remoteReleaseModel ||
            {}
    );
}

function getPilotReadiness(snapshot) {
    return asObject(
        snapshot.pilotReadiness ||
            snapshot.turneroPilotReadiness ||
            snapshot.localReadinessModel ||
            {}
    );
}

function getShellDrift(snapshot) {
    return asObject(
        snapshot.publicShellDriftModel ||
            snapshot.publicShellDrift ||
            snapshot.turneroPublicShellDrift ||
            {}
    );
}

function getClinicProfile(snapshot) {
    return asObject(
        snapshot.turneroClinicProfile ||
            snapshot.clinicProfile ||
            snapshot.clinicProfileSnapshot ||
            {}
    );
}

function buildTrendCountsFromSnapshots(historyEntries, currentSnapshot) {
    const counts = {};

    historyEntries.forEach((entry) => {
        toArray(entry.snapshot?.incidents).forEach((incident) => {
            const kind = classifyRadarKind(incident);
            counts[kind] = (counts[kind] || 0) + 1;
        });
    });

    toArray(currentSnapshot?.incidents).forEach((incident) => {
        const kind = classifyRadarKind(incident);
        counts[kind] = (counts[kind] || 0) + 1;
    });

    return counts;
}

function buildSyntheticRegressions(
    currentSnapshot,
    referenceSnapshot,
    referenceBaseline
) {
    const regressions = [];
    const currentRemote = getRemoteReadiness(currentSnapshot);
    const referenceRemote = getRemoteReadiness(referenceSnapshot);
    const currentPublicSync = getPublicSync(currentSnapshot);
    const referencePublicSync = getPublicSync(referenceSnapshot);
    const currentPilot = getPilotReadiness(currentSnapshot);
    const referencePilot = getPilotReadiness(referenceSnapshot);
    const currentShell = getShellDrift(currentSnapshot);
    const referenceShell = getShellDrift(referenceSnapshot);
    const currentClinicProfile = getClinicProfile(currentSnapshot);
    const referenceClinicProfile = getClinicProfile(referenceSnapshot);

    const currentFingerprint = toText(
        currentSnapshot.profileFingerprint ||
            currentClinicProfile.runtime_meta?.profileFingerprint ||
            currentClinicProfile.profileFingerprint ||
            ''
    );
    const referenceFingerprint = toText(
        referenceSnapshot.profileFingerprint ||
            referenceClinicProfile.runtime_meta?.profileFingerprint ||
            referenceClinicProfile.profileFingerprint ||
            ''
    );

    const fingerprintMismatch =
        referenceBaseline &&
        currentFingerprint &&
        referenceFingerprint &&
        currentFingerprint !== referenceFingerprint;

    if (fingerprintMismatch) {
        regressions.push(
            buildRegressionEntry({
                kind: 'fingerprint-mismatch',
                title: 'Profile fingerprint mismatch',
                detail: `Current ${currentFingerprint} vs reference ${referenceFingerprint}`,
                severity: 'warning',
                currentValue: currentFingerprint,
                baselineValue: referenceFingerprint,
                source: 'profile',
            })
        );
    }

    const currentSource = toText(
        currentClinicProfile.runtime_meta?.source ||
            currentClinicProfile.source ||
            currentSnapshot.source ||
            ''
    ).toLowerCase();
    const referenceSource = toText(
        referenceClinicProfile.runtime_meta?.source ||
            referenceClinicProfile.source ||
            referenceSnapshot.source ||
            ''
    ).toLowerCase();
    const fallbackSource =
        currentSource &&
        !['remote', 'file'].includes(currentSource) &&
        (referenceBaseline ? currentSource !== referenceSource : true);

    if (fallbackSource) {
        regressions.push(
            buildRegressionEntry({
                kind: 'fallback-source',
                title: 'Fallback source detected',
                detail: `Current source ${currentSource || 'unknown'}${
                    referenceSource ? ` vs reference ${referenceSource}` : ''
                }`,
                severity: 'warning',
                currentValue: currentSource || 'unknown',
                baselineValue: referenceSource || 'none',
                source: 'clinic-profile',
            })
        );
    }

    const remoteAlert =
        currentRemote.state !== 'ready' ||
        currentRemote.ready !== true ||
        currentRemote.healthy === false ||
        safeBoolean(currentRemote.blockerCount > 0);
    const remoteReferenceAlert =
        referenceBaseline &&
        (referenceRemote.state !== 'ready' ||
            referenceRemote.ready !== true ||
            referenceRemote.healthy === false ||
            safeBoolean(referenceRemote.blockerCount > 0));
    if (remoteAlert && (!referenceBaseline || !remoteReferenceAlert)) {
        regressions.push(
            buildRegressionEntry({
                kind: 'remote-health',
                title: 'Remote health regression',
                detail:
                    currentRemote.summary ||
                    'Remote readiness no longer ready.',
                severity: normalizeSeverity(
                    currentRemote.state || currentRemote.tone || 'warning'
                ),
                currentValue:
                    currentRemote.state || currentRemote.tone || 'unknown',
                baselineValue:
                    referenceRemote.state || referenceRemote.tone || 'ready',
                source: 'remote-release-readiness',
            })
        );
    }

    const publicSyncAlert =
        currentPublicSync.healthy !== true ||
        currentPublicSync.headDrift === true ||
        currentPublicSync.state !== 'ok';
    const publicSyncReferenceAlert =
        referenceBaseline &&
        (referencePublicSync.healthy !== true ||
            referencePublicSync.headDrift === true ||
            referencePublicSync.state !== 'ok');
    if (publicSyncAlert && (!referenceBaseline || !publicSyncReferenceAlert)) {
        regressions.push(
            buildRegressionEntry({
                kind: 'public-sync',
                title: 'Public sync regression',
                detail:
                    currentPublicSync.failureReason ||
                    currentPublicSync.summary ||
                    'Public sync is not healthy.',
                severity: 'warning',
                currentValue: currentPublicSync.state || 'unknown',
                baselineValue: referencePublicSync.state || 'ok',
                source: 'public-sync',
            })
        );
    }

    const figoAlert =
        currentRemote.diagnosticsPayload?.figoConfigured === false ||
        currentRemote.diagnosticsPayload?.figoRecursiveConfig === true ||
        currentRemote.diagnostics?.kind === 'error';
    const figoReferenceAlert =
        referenceBaseline &&
        (referenceRemote.diagnosticsPayload?.figoConfigured === false ||
            referenceRemote.diagnosticsPayload?.figoRecursiveConfig === true ||
            referenceRemote.diagnostics?.kind === 'error');
    if (figoAlert && (!referenceBaseline || !figoReferenceAlert)) {
        regressions.push(
            buildRegressionEntry({
                kind: 'figo',
                title: 'Figo regression',
                detail:
                    currentRemote.diagnostics?.payload?.summary ||
                    currentRemote.diagnosticsPayload?.summary ||
                    'Figo diagnostics are degraded.',
                severity: 'warning',
                currentValue:
                    currentRemote.diagnosticsPayload?.figoConfigured === false
                        ? 'not-configured'
                        : 'recursive',
                baselineValue:
                    referenceRemote.diagnosticsPayload?.figoConfigured === false
                        ? 'not-configured'
                        : 'configured',
                source: 'diagnostics',
            })
        );
    }

    const currentShellBad =
        currentShell.driftStatus !== 'ready' ||
        currentShell.pageOk === false ||
        toArray(currentShell.blockers).length > 0 ||
        currentShell.hasDrift === true;
    const referenceShellBad =
        referenceBaseline &&
        (referenceShell.driftStatus !== 'ready' ||
            referenceShell.pageOk === false ||
            toArray(referenceShell.blockers).length > 0 ||
            referenceShell.hasDrift === true);
    if (currentShellBad && (!referenceBaseline || !referenceShellBad)) {
        regressions.push(
            buildRegressionEntry({
                kind: 'public-shell-drift',
                title: 'Public shell drift',
                detail:
                    currentShell.signalSummary ||
                    currentShell.supportCopy ||
                    'Public shell drift detected.',
                severity: 'warning',
                currentValue: currentShell.driftStatus || 'unknown',
                baselineValue: referenceShell.driftStatus || 'ready',
                source: 'public-shell',
            })
        );
    }

    const currentPilotBad =
        currentPilot.readinessState !== 'ready' ||
        currentPilot.ready === false ||
        safeBoolean(currentPilot.readinessBlockingCount > 0) ||
        safeBoolean(
            safeNumber(currentPilot.readySurfaceCount, 0) <
                safeNumber(currentPilot.totalSurfaceCount, 0)
        );
    const referencePilotBad =
        referenceBaseline &&
        (referencePilot.readinessState !== 'ready' ||
            referencePilot.ready === false ||
            safeBoolean(referencePilot.readinessBlockingCount > 0) ||
            safeBoolean(
                safeNumber(referencePilot.readySurfaceCount, 0) <
                    safeNumber(referencePilot.totalSurfaceCount, 0)
            ));
    if (currentPilotBad && (!referenceBaseline || !referencePilotBad)) {
        regressions.push(
            buildRegressionEntry({
                kind: 'surface-readiness',
                title: 'Surface readiness regression',
                detail:
                    currentPilot.readinessSummary ||
                    currentPilot.summary ||
                    'Surface readiness no longer meets the release bar.',
                severity: 'warning',
                currentValue: currentPilot.readinessState || 'unknown',
                baselineValue: referencePilot.readinessState || 'ready',
                source: 'pilot-readiness',
            })
        );
    }

    return regressions;
}

function safeBoolean(value) {
    return value === true;
}

function compareRegressionSeverity(left, right) {
    const severityRank = {
        alert: 4,
        critical: 4,
        warning: 3,
        ready: 0,
        info: 1,
    };

    return (
        (severityRank[right.severity] || 0) - (severityRank[left.severity] || 0)
    );
}

function dedupeRegressions(regressions) {
    const map = new Map();
    regressions.forEach((regression) => {
        const key = [
            regression.kind,
            regression.title,
            regression.detail,
            regression.currentValue,
            regression.baselineValue,
        ].join('::');
        if (!map.has(key)) {
            map.set(key, regression);
        }
    });

    return Array.from(map.values()).sort(compareRegressionSeverity);
}

function buildSummary(regressions, referenceBaseline, historyEntries) {
    const referenceLabel = referenceBaseline
        ? referenceBaseline.label || referenceBaseline.baselineId || 'baseline'
        : '';

    if (!referenceBaseline) {
        return regressions.length
            ? `Radar sin baseline activo y con ${regressions.length} regression(es) visibles.`
            : `Radar sin baseline activo${
                  historyEntries.length ? ' pero con historial promovido.' : '.'
              }`;
    }

    if (regressions.length) {
        const topKind = regressions[0]?.kind || 'n/a';
        return `Radar detecta ${regressions.length} regression(es) activas contra ${referenceLabel || 'baseline activo'}. Foco principal: ${topKind}.`;
    }

    return `Radar sin regresiones nuevas contra ${referenceLabel || 'baseline activo'}.`;
}

export function buildReleaseRegressionRadar({
    currentSnapshot,
    activeBaseline,
    recentHistory,
} = {}) {
    const normalizedCurrent = normalizeReleaseSnapshot(
        resolveSnapshotCandidate(currentSnapshot) || {}
    );
    const historyEntries = toArray(recentHistory)
        .map((entry, index) => normalizeHistoryEntry(entry, index))
        .sort((left, right) => {
            const leftTime = new Date(
                left.promotedAt ||
                    left.savedAt ||
                    left.snapshot.generatedAt ||
                    0
            ).getTime();
            const rightTime = new Date(
                right.promotedAt ||
                    right.savedAt ||
                    right.snapshot.generatedAt ||
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
        });
    const referenceBaselineRecord = normalizeReferenceBaseline(
        activeBaseline,
        historyEntries
    );
    const referenceSnapshot = referenceBaselineRecord
        ? referenceBaselineRecord.snapshot
        : null;
    const currentIncidents = toArray(normalizedCurrent.incidents);
    const referenceIncidents = toArray(referenceSnapshot?.incidents);
    const referenceSignatureSet = new Set(
        referenceIncidents.map((incident) => buildIncidentSignature(incident))
    );
    const regressions = [];

    currentIncidents.forEach((incident) => {
        const signature = buildIncidentSignature(incident);
        if (!referenceSignatureSet.has(signature)) {
            const kind = classifyRadarKind(incident);
            regressions.push(
                buildRegressionEntry({
                    kind,
                    title: toText(
                        incident.title ||
                            incident.label ||
                            incident.code ||
                            kind,
                        kind
                    ),
                    detail: toText(
                        incident.detail ||
                            incident.summary ||
                            incident.reason ||
                            ''
                    ),
                    severity: normalizeSeverity(
                        incident.severity ||
                            incident.state ||
                            incident.tone ||
                            'info'
                    ),
                    currentValue: toText(
                        incident.state || incident.severity || 'unknown'
                    ),
                    baselineValue: 'missing',
                    source: 'incident',
                })
            );
        }
    });

    buildSyntheticRegressions(
        normalizedCurrent,
        referenceSnapshot || {},
        referenceBaselineRecord
    ).forEach((regression) => regressions.push(regression));

    const dedupedRegressions = dedupeRegressions(regressions);
    const trendByKind = buildTrendCountsFromSnapshots(
        historyEntries,
        normalizedCurrent
    );
    dedupedRegressions.forEach((regression) => {
        trendByKind[regression.kind] = (trendByKind[regression.kind] || 0) + 1;
    });
    const hotKinds = Object.entries(trendByKind)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 5)
        .map(([kind, count]) => ({ kind, count }));
    const referenceSource = referenceBaselineRecord
        ? referenceBaselineRecord.source
        : 'none';
    const summary = buildSummary(
        dedupedRegressions,
        referenceBaselineRecord,
        historyEntries
    );

    return {
        total: dedupedRegressions.length,
        regressions: dedupedRegressions,
        trendByKind,
        hotKinds,
        referenceBaseline: referenceBaselineRecord,
        referenceSource,
        currentSnapshot: normalizedCurrent,
        summary,
    };
}

export default buildReleaseRegressionRadar;
