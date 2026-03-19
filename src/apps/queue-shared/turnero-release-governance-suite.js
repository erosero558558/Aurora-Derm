import {
    asObject,
    copyToClipboardSafe,
    downloadJsonSnapshot,
    toArray,
    toText,
} from './turnero-release-control-center.js';
import { escapeHtml, formatDateTime } from '../admin-v3/shared/ui/render.js';

const SEVERITY_WEIGHTS = Object.freeze({
    low: 1,
    medium: 2,
    high: 4,
    critical: 7,
});

const MAX_PREVIEW_ROWS = 5;
const MAX_WAVES = 4;

function isDomElement(value) {
    return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function resolveTarget(target) {
    if (typeof target === 'string') {
        if (typeof document === 'undefined') {
            return null;
        }

        return (
            document.getElementById(target) || document.querySelector(target)
        );
    }

    return target;
}

function safeNumber(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function clampNumber(value, min = 0, max = 100) {
    return Math.min(max, Math.max(min, value));
}

function formatMoney(value) {
    return `$${Math.round(safeNumber(value, 0)).toLocaleString('en-US')}`;
}

function formatPercent(value) {
    const numberValue = safeNumber(value, 0);
    const formatted = Number.isInteger(numberValue)
        ? String(numberValue)
        : numberValue.toFixed(1).replace(/\.0$/, '');

    return `${formatted}%`;
}

function toneForDecision(decision) {
    if (decision === 'hold') return 'alert';
    if (decision === 'review') return 'warning';
    return 'ready';
}

function toneForComplianceStatus(status) {
    if (status === 'red') return 'alert';
    if (status === 'amber') return 'warning';
    return 'ready';
}

function toneForRiskGrade(grade) {
    if (grade === 'D') return 'alert';
    if (grade === 'C') return 'warning';
    return 'ready';
}

function toneForHeatmapZone(zone) {
    if (zone === 'protect') return 'alert';
    if (zone === 'watch') return 'warning';
    return 'ready';
}

function toneForCheckStatus(status) {
    if (status === 'fail') return 'alert';
    if (status === 'missing') return 'warning';
    return 'ready';
}

function normalizeSeverity(value) {
    const severity = toText(value, 'low').toLowerCase();
    if (
        ['critical', 'hold', 'blocker', 'blocked', 'alert', 'severe'].includes(
            severity
        )
    ) {
        return 'critical';
    }
    if (['high', 'error', 'red'].includes(severity)) {
        return 'high';
    }
    if (['medium', 'warning', 'review', 'amber'].includes(severity)) {
        return 'medium';
    }
    return 'low';
}

function normalizeCheckStatus(value) {
    const status = toText(value, 'missing').toLowerCase();
    if (
        ['pass', 'passed', 'ok', 'ready', 'green', 'clear', 'true'].includes(
            status
        )
    ) {
        return 'pass';
    }
    if (
        ['fail', 'failed', 'error', 'blocked', 'red', 'false'].includes(status)
    ) {
        return 'fail';
    }
    return 'missing';
}

function normalizeClinicRecord(input = {}, index = 0, context = {}) {
    const clinic = asObject(input);
    const clinicId = toText(
        clinic.clinicId ||
            clinic.clinic_id ||
            clinic.id ||
            clinic.key ||
            `clinic-${index + 1}`,
        `clinic-${index + 1}`
    );
    const label = toText(
        clinic.label ||
            clinic.clinicLabel ||
            clinic.clinic_name ||
            clinic.clinicName ||
            clinic.name ||
            clinicId,
        clinicId
    );
    const shortLabel = toText(
        clinic.shortLabel ||
            clinic.short_label ||
            clinic.abbreviation ||
            clinic.code ||
            label,
        label
    );
    const plannedFallback = safeNumber(
        context.plannedBudgetFallback ||
            36000 +
                safeNumber(context.alertCount, 0) * 5200 +
                safeNumber(context.warningCount, 0) * 2100 +
                safeNumber(context.recentSnapshotCount, 0) * 1700 +
                index * 2400,
        36000
    );
    const plannedBudget = safeNumber(
        clinic.plannedBudget ??
            clinic.budget?.planned ??
            clinic.financial?.planned ??
            clinic.planBudget ??
            clinic.targetBudget ??
            clinic.budgetPlanned ??
            plannedFallback,
        plannedFallback
    );
    const committedRatioFallback = clampNumber(
        0.58 +
            safeNumber(context.warningCount, 0) * 0.04 +
            safeNumber(context.alertCount, 0) * 0.06 -
            index * 0.015,
        0.42,
        0.92
    );
    const committedBudget = safeNumber(
        clinic.committedBudget ??
            clinic.budget?.committed ??
            clinic.financial?.committed ??
            clinic.spend ??
            clinic.actual ??
            Math.round(plannedBudget * committedRatioFallback),
        Math.round(plannedBudget * committedRatioFallback)
    );
    const atRiskBudget = safeNumber(
        clinic.atRiskBudget ??
            clinic.budget?.atRisk ??
            clinic.financial?.atRisk ??
            clinic.riskBudget ??
            Math.round(
                plannedBudget *
                    clampNumber(
                        0.08 +
                            safeNumber(context.alertCount, 0) * 0.04 +
                            safeNumber(context.warningCount, 0) * 0.02 +
                            index * 0.01,
                        0.04,
                        0.35
                    )
            ),
        Math.round(plannedBudget * 0.1)
    );
    const spend = safeNumber(clinic.spend ?? committedBudget, committedBudget);
    const risk = clampNumber(
        safeNumber(
            clinic.riskScore ??
                clinic.risk ??
                clinic.riskPct ??
                clinic.exposure ??
                Math.round(
                    safeNumber(context.alertCount, 0) * 24 +
                        safeNumber(context.warningCount, 0) * 10 +
                        safeNumber(context.recentSnapshotCount, 0) * 4 +
                        index * 5
                ),
            0
        ),
        0,
        100
    );
    const value = clampNumber(
        safeNumber(
            clinic.valueScore ??
                clinic.value ??
                Math.round(
                    100 - risk + (context.readinessReady ? 8 : 0) - index * 3
                ),
            0
        ),
        0,
        100
    );

    return {
        clinicId,
        label,
        shortLabel,
        region: toText(clinic.region || context.region || ''),
        status: toText(clinic.status || 'ready', 'ready'),
        plannedBudget,
        committedBudget,
        atRiskBudget,
        spend,
        risk,
        value,
        source: toText(clinic.source || context.source || 'input', 'input'),
        generatedAt: toText(
            clinic.generatedAt || clinic.updatedAt || context.generatedAt || ''
        ),
        meta: asObject(clinic.meta || {}),
    };
}

function normalizeWaveRecord(input = {}, index = 0, context = {}) {
    const wave = asObject(input);
    const clinicCount = Math.max(
        1,
        safeNumber(
            wave.clinicCount ??
                wave.clinics?.length ??
                context.clinicCount ??
                1,
            1
        )
    );
    const baseFallback = Math.round(
        9000 +
            clinicCount * 1200 +
            safeNumber(context.alertCount, 0) * 600 +
            index * 900
    );
    const supportFallback = Math.round(
        2200 +
            clinicCount * 300 +
            safeNumber(context.warningCount, 0) * 250 +
            index * 180
    );
    const incidentFallback = Math.round(
        (safeNumber(context.alertCount, 0) * 700 +
            safeNumber(context.warningCount, 0) * 300) /
            (index + 1)
    );
    const base = safeNumber(
        wave.base ?? wave.baseCost ?? wave.plan ?? baseFallback,
        baseFallback
    );
    const support = safeNumber(
        wave.support ?? wave.supportCost ?? supportFallback,
        supportFallback
    );
    const incident = safeNumber(
        wave.incident ??
            wave.incidentCost ??
            wave.incidentReserve ??
            incidentFallback,
        incidentFallback
    );
    const total = safeNumber(
        wave.total ?? wave.totalCost ?? wave.cost ?? base + support + incident,
        base + support + incident
    );

    return {
        waveId: toText(
            wave.waveId || wave.snapshotId || wave.id || `wave-${index + 1}`
        ),
        label: toText(
            wave.label ||
                wave.title ||
                wave.snapshotLabel ||
                wave.snapshotId ||
                `Wave ${index + 1}`,
            `Wave ${index + 1}`
        ),
        snapshotId: toText(wave.snapshotId || wave.waveId || ''),
        generatedAt: toText(
            wave.generatedAt || wave.savedAt || context.generatedAt || ''
        ),
        savedAt: toText(
            wave.savedAt || wave.generatedAt || context.generatedAt || ''
        ),
        clinicCount,
        base,
        support,
        incident,
        total,
        avgPerClinic: clinicCount > 0 ? total / clinicCount : total,
        source: toText(wave.source || context.source || 'history', 'history'),
    };
}

function normalizeIncidentRecord(input = {}, index = 0) {
    const incident = asObject(input);
    const severity = normalizeSeverity(
        incident.severity || incident.level || incident.risk || incident.state
    );
    const likelihood = clampNumber(
        safeNumber(incident.likelihood ?? incident.probability ?? 1, 1),
        1,
        5
    );
    const impact = clampNumber(
        safeNumber(
            incident.impact ?? incident.exposure ?? incident.damage ?? 1,
            1
        ),
        1,
        5
    );
    const weight = SEVERITY_WEIGHTS[severity] || 1;
    const score = safeNumber(incident.score, weight * likelihood * impact);

    return {
        id: toText(incident.id || incident.code || `incident-${index + 1}`),
        owner: toText(incident.owner || incident.assignee || 'ops', 'ops'),
        severity,
        likelihood,
        impact,
        score,
        title: toText(
            incident.title ||
                incident.label ||
                incident.summary ||
                incident.code ||
                `Incident ${index + 1}`,
            `Incident ${index + 1}`
        ),
        mitigation: toText(
            incident.mitigation ||
                incident.action ||
                incident.nextStep ||
                incident.detail ||
                ''
        ),
        detail: toText(
            incident.detail || incident.summary || incident.note || ''
        ),
        source: toText(incident.source || 'release', 'release'),
        updatedAt: toText(
            incident.updatedAt || incident.createdAt || new Date().toISOString()
        ),
    };
}

function normalizeCheckRecord(input = {}, index = 0) {
    const check = asObject(input);
    const status = normalizeCheckStatus(
        check.status || check.state || check.result || check.tone
    );
    return {
        id: toText(check.id || check.key || `check-${index + 1}`),
        label: toText(
            check.label || check.title || check.name || `Check ${index + 1}`,
            `Check ${index + 1}`
        ),
        status,
        tone: toneForCheckStatus(status),
        detail: toText(check.detail || check.summary || check.note || ''),
        evidence: toText(check.evidence || check.source || ''),
        source: toText(check.source || 'governance'),
    };
}

function buildGovernanceInputs(input = {}) {
    const releaseEvidenceBundle = asObject(
        input.releaseEvidenceBundle ||
            input.turneroReleaseEvidenceBundle ||
            input.evidenceBundle ||
            {}
    );
    const currentSnapshot = asObject(
        input.currentSnapshot ||
            releaseEvidenceBundle.currentSnapshot ||
            releaseEvidenceBundle.snapshot ||
            {}
    );
    const clinicProfile = asObject(
        input.clinicProfile ||
            input.turneroClinicProfile ||
            releaseEvidenceBundle.turneroClinicProfile ||
            releaseEvidenceBundle.clinicProfile ||
            {}
    );
    const remoteReadiness = asObject(
        input.remoteReadiness ||
            input.turneroRemoteReleaseReadiness ||
            releaseEvidenceBundle.turneroRemoteReleaseReadiness ||
            releaseEvidenceBundle.remoteReleaseReadiness ||
            currentSnapshot.turneroRemoteReleaseReadiness ||
            {}
    );
    const publicShellDrift = asObject(
        input.publicShellDrift ||
            input.turneroPublicShellDrift ||
            releaseEvidenceBundle.turneroPublicShellDrift ||
            releaseEvidenceBundle.publicShellDrift ||
            currentSnapshot.turneroPublicShellDrift ||
            {}
    );
    const clinicsInput = toArray(
        input.clinics ||
            input.regionalClinics ||
            clinicProfile.regionalClinics ||
            releaseEvidenceBundle.regionalClinics
    ).map(asObject);
    const historySnapshots = toArray(
        input.historySnapshots ||
            input.recentHistorySnapshots ||
            currentSnapshot.historySnapshots ||
            releaseEvidenceBundle.historySnapshots
    ).map(asObject);
    const wavesInput = toArray(
        input.waves ||
            currentSnapshot.waves ||
            releaseEvidenceBundle.waves ||
            historySnapshots
    ).map(asObject);
    const incidentsInput = toArray(
        input.releaseIncidents ||
            input.incidents ||
            input.riskIncidents ||
            currentSnapshot.incidents ||
            releaseEvidenceBundle.incidents
    ).map(asObject);
    const checksInput = toArray(
        input.checks || currentSnapshot.checks || releaseEvidenceBundle.checks
    ).map(asObject);
    const clinicId = toText(
        input.clinicId ||
            currentSnapshot.clinicId ||
            releaseEvidenceBundle.clinicId ||
            clinicProfile.clinic_id ||
            clinicProfile.clinicId ||
            'default-clinic',
        'default-clinic'
    );
    const clinicLabel = toText(
        input.clinicLabel ||
            clinicProfile.branding?.name ||
            clinicProfile.branding?.short_name ||
            currentSnapshot.clinicName ||
            releaseEvidenceBundle.clinicName ||
            clinicId,
        clinicId
    );
    const clinicShortName = toText(
        input.clinicShortName ||
            clinicProfile.branding?.short_name ||
            clinicProfile.branding?.name ||
            currentSnapshot.clinicShortName ||
            releaseEvidenceBundle.clinicShortName ||
            clinicLabel,
        clinicLabel
    );
    const region = toText(
        input.region ||
            clinicProfile.region ||
            currentSnapshot.region ||
            releaseEvidenceBundle.region ||
            'regional',
        'regional'
    );
    const generatedAt = toText(
        input.generatedAt ||
            currentSnapshot.generatedAt ||
            releaseEvidenceBundle.generatedAt ||
            new Date().toISOString()
    );
    const alertCount =
        historySnapshots.filter((snapshot) => {
            const severity = normalizeSeverity(
                snapshot.severity || snapshot.status || snapshot.decision
            );
            return severity === 'high' || severity === 'critical';
        }).length +
        (remoteReadiness.ready === false ? 1 : 0) +
        (publicShellDrift.pageOk === false ? 1 : 0);
    const warningCount =
        historySnapshots.filter((snapshot) => {
            const raw = toText(
                `${snapshot.decision || ''} ${snapshot.severity || ''} ${
                    snapshot.status || ''
                }`
            ).toLowerCase();
            return raw.includes('review') || raw.includes('amber');
        }).length +
        (safeNumber(remoteReadiness.warningCount, 0) > 0 ? 1 : 0) +
        (publicShellDrift.driftStatus === 'warning' ? 1 : 0);

    return {
        source: toText(
            input.source || releaseEvidenceBundle.source || 'queue-governance',
            'queue-governance'
        ),
        generatedAt,
        region,
        clinicId,
        clinicLabel,
        clinicShortName,
        turneroClinicProfile: clinicProfile,
        releaseEvidenceBundle,
        currentSnapshot,
        remoteReadiness,
        publicShellDrift,
        historySnapshots,
        clinicsInput,
        wavesInput,
        incidentsInput,
        checksInput,
        alertCount,
        warningCount,
        recentSnapshotCount: historySnapshots.length,
        readinessReady:
            remoteReadiness.ready === true ||
            currentSnapshot.pilotReadiness?.readinessState === 'ready' ||
            currentSnapshot.state === 'ready',
    };
}

function buildFallbackClinicRecord(context = {}, index = 0) {
    return normalizeClinicRecord(
        {
            clinicId: context.clinicId,
            label: context.clinicLabel,
            shortLabel: context.clinicShortName,
            region: context.region,
            plannedBudget:
                context.plannedBudgetFallback ||
                36000 +
                    safeNumber(context.alertCount, 0) * 5200 +
                    safeNumber(context.warningCount, 0) * 2100 +
                    safeNumber(context.recentSnapshotCount, 0) * 1700 +
                    index * 2400,
            committedBudget:
                context.committedBudgetFallback ||
                Math.round(
                    (context.plannedBudgetFallback ||
                        36000 +
                            safeNumber(context.alertCount, 0) * 5200 +
                            safeNumber(context.warningCount, 0) * 2100 +
                            safeNumber(context.recentSnapshotCount, 0) * 1700 +
                            index * 2400) *
                        clampNumber(
                            0.58 +
                                safeNumber(context.warningCount, 0) * 0.04 +
                                safeNumber(context.alertCount, 0) * 0.06 -
                                index * 0.015,
                            0.42,
                            0.92
                        )
                ),
            atRiskBudget:
                context.atRiskBudgetFallback ||
                Math.round(
                    (context.plannedBudgetFallback ||
                        36000 +
                            safeNumber(context.alertCount, 0) * 5200 +
                            safeNumber(context.warningCount, 0) * 2100 +
                            safeNumber(context.recentSnapshotCount, 0) * 1700 +
                            index * 2400) *
                        clampNumber(
                            0.08 +
                                safeNumber(context.alertCount, 0) * 0.04 +
                                safeNumber(context.warningCount, 0) * 0.02 +
                                index * 0.01,
                            0.04,
                            0.35
                        )
                ),
            riskScore:
                context.riskScoreFallback ||
                Math.round(
                    safeNumber(context.alertCount, 0) * 24 +
                        safeNumber(context.warningCount, 0) * 10 +
                        safeNumber(context.recentSnapshotCount, 0) * 4 +
                        index * 5
                ),
            valueScore:
                context.valueScoreFallback ||
                Math.round(
                    100 -
                        clampNumber(
                            safeNumber(context.alertCount, 0) * 24 +
                                safeNumber(context.warningCount, 0) * 10 +
                                safeNumber(context.recentSnapshotCount, 0) * 4 +
                                index * 5,
                            0,
                            100
                        ) +
                        (context.readinessReady ? 8 : 0) -
                        index * 3
                ),
            source: 'synthetic',
        },
        index,
        context
    );
}

function buildTurneroReleaseBudgetEnvelope(input = {}) {
    const context = buildGovernanceInputs(input);
    const clinics = context.clinicsInput.length
        ? context.clinicsInput.map((clinic, index) =>
              normalizeClinicRecord(clinic, index, context)
          )
        : [buildFallbackClinicRecord(context, 0)];
    const totals = clinics.reduce(
        (acc, clinic) => {
            acc.planned += safeNumber(clinic.plannedBudget, 0);
            acc.committed += safeNumber(clinic.committedBudget, 0);
            acc.atRisk += safeNumber(clinic.atRiskBudget, 0);
            return acc;
        },
        { planned: 0, committed: 0, atRisk: 0 }
    );
    const burnPct =
        totals.planned > 0
            ? Number(((totals.committed / totals.planned) * 100).toFixed(1))
            : 0;
    const riskPct =
        totals.planned > 0
            ? Number(((totals.atRisk / totals.planned) * 100).toFixed(1))
            : 0;
    const decision =
        burnPct > 90 || riskPct > 25
            ? 'hold'
            : burnPct > 75 || riskPct > 15
              ? 'review'
              : 'ready';

    return {
        region: context.region,
        clinicsCount: clinics.length,
        clinics,
        totals,
        burnPct,
        riskPct,
        decision,
        generatedAt: context.generatedAt,
    };
}

function buildTurneroReleaseCostModel(input = {}) {
    const context = buildGovernanceInputs(input);
    const budgetEnvelope = buildTurneroReleaseBudgetEnvelope(input);
    const waves = context.wavesInput.length
        ? context.wavesInput.map((wave, index) =>
              normalizeWaveRecord(wave, index, context)
          )
        : context.historySnapshots.length
          ? context.historySnapshots
                .slice(0, MAX_WAVES)
                .map((snapshot, index) =>
                    normalizeWaveRecord(
                        {
                            waveId:
                                snapshot.waveId ||
                                snapshot.snapshotId ||
                                `wave-${index + 1}`,
                            label:
                                snapshot.label ||
                                snapshot.snapshotLabel ||
                                snapshot.snapshotId ||
                                `Wave ${index + 1}`,
                            snapshotId:
                                snapshot.snapshotId || snapshot.waveId || '',
                            clinicCount:
                                snapshot.clinicCount ||
                                context.clinicsInput.length,
                            baseCost:
                                snapshot.baseCost ||
                                snapshot.costs?.base ||
                                snapshot.plannedBudget ||
                                snapshot.budget?.planned,
                            supportCost:
                                snapshot.supportCost ||
                                snapshot.costs?.support ||
                                snapshot.supportBudget ||
                                snapshot.budget?.committed,
                            incidentReserve:
                                snapshot.incidentReserve ||
                                snapshot.costs?.incident ||
                                snapshot.riskBudget ||
                                snapshot.budget?.atRisk,
                            generatedAt:
                                snapshot.generatedAt || context.generatedAt,
                            source: 'history',
                        },
                        index,
                        context
                    )
                )
          : [
                normalizeWaveRecord(
                    {
                        waveId: 'wave-1',
                        label: 'Current release',
                        clinicCount: context.clinicsInput.length || 1,
                        baseCost: budgetEnvelope.totals.planned * 0.52,
                        supportCost: budgetEnvelope.totals.planned * 0.14,
                        incidentReserve: budgetEnvelope.totals.atRisk * 0.65,
                        source: 'synthetic',
                        generatedAt: context.generatedAt,
                    },
                    0,
                    context
                ),
            ];
    const totalCost = waves.reduce(
        (sum, wave) => sum + safeNumber(wave.total, 0),
        0
    );

    return {
        lines: waves,
        totalCost,
        generatedAt: context.generatedAt,
    };
}

function buildTurneroReleaseCompliancePack(input = {}) {
    const context = buildGovernanceInputs(input);
    const checks = context.checksInput.length
        ? context.checksInput.map((check, index) =>
              normalizeCheckRecord(check, index, context)
          )
        : [
              normalizeCheckRecord(
                  {
                      id: 'turnero-pilot',
                      label: 'Turnero pilot',
                      status:
                          context.remoteReadiness.ready === false
                              ? 'fail'
                              : context.remoteReadiness.available === false
                                ? 'missing'
                                : 'pass',
                      detail: context.remoteReadiness.summary || 'Pilot ready.',
                      evidence:
                          context.remoteReadiness.profileFingerprint || '',
                      source: 'remote-readiness',
                  },
                  0
              ),
              normalizeCheckRecord(
                  {
                      id: 'public-sync',
                      label: 'Public sync',
                      status:
                          context.publicShellDrift.pageOk === false ||
                          context.publicShellDrift.driftStatus === 'warning'
                              ? 'fail'
                              : context.publicShellDrift.pageOk === undefined
                                ? 'missing'
                                : 'pass',
                      detail:
                          context.publicShellDrift.signalSummary ||
                          'Public shell aligned.',
                      evidence: context.publicShellDrift.stylesheetHref || '',
                      source: 'shell-drift',
                  },
                  1
              ),
              normalizeCheckRecord(
                  {
                      id: 'history',
                      label: 'History snapshots',
                      status:
                          context.historySnapshots.length > 0
                              ? 'pass'
                              : 'missing',
                      detail: `${context.historySnapshots.length} snapshot(s) available`,
                      evidence:
                          context.historySnapshots[0]?.snapshotId ||
                          context.historySnapshots[0]?.waveId ||
                          '',
                      source: 'history',
                  },
                  2
              ),
              normalizeCheckRecord(
                  {
                      id: 'regional-clinics',
                      label: 'Regional clinics',
                      status: 'pass',
                      detail: `${
                          context.clinicsInput.length || 1
                      } clinic(s) ready for board review`,
                      evidence: context.clinicId,
                      source: 'clinic-profile',
                  },
                  3
              ),
          ];
    const passed = checks.filter((item) => item.status === 'pass').length;
    const failed = checks.filter((item) => item.status === 'fail').length;
    const missing = checks.length - passed - failed;
    const status = failed > 0 ? 'red' : missing > 0 ? 'amber' : 'green';

    return {
        status,
        totals: {
            all: checks.length,
            passed,
            failed,
            missing,
        },
        checks,
        generatedAt: context.generatedAt,
    };
}

function buildTurneroReleaseRiskLedger(input = {}) {
    const context = buildGovernanceInputs(input);
    const incidents = toArray(input.incidents || input.riskIncidents).length
        ? toArray(input.incidents || input.riskIncidents).map(asObject)
        : context.incidentsInput;
    const rows = incidents.map((incident, index) => {
        const normalized = normalizeIncidentRecord(incident, index, context);
        return {
            ...normalized,
            title: normalized.title,
        };
    });
    const totalScore = rows.reduce(
        (sum, row) => sum + safeNumber(row.score, 0),
        0
    );
    const grade =
        totalScore >= 120
            ? 'D'
            : totalScore >= 80
              ? 'C'
              : totalScore >= 40
                ? 'B'
                : 'A';

    return {
        rows,
        totalScore,
        grade,
        generatedAt: context.generatedAt,
    };
}

function buildTurneroReleaseInvestmentHeatmap(input = {}) {
    const context = buildGovernanceInputs(input);
    const clinics = context.clinicsInput.length
        ? context.clinicsInput.map((clinic, index) =>
              normalizeClinicRecord(clinic, index, context)
          )
        : [buildFallbackClinicRecord(context, 0)];
    const buckets = clinics.map((clinic, index) => {
        const spend = safeNumber(clinic.committedBudget, 0);
        const risk = safeNumber(clinic.risk, clinic.riskScore || 0);
        const value = safeNumber(clinic.value, clinic.valueScore || 0);
        const zone =
            risk >= 80
                ? 'protect'
                : value >= 75 && risk < 50
                  ? 'accelerate'
                  : 'watch';

        return {
            clinicId: clinic.clinicId || `clinic-${index + 1}`,
            label: clinic.label || clinic.shortLabel || clinic.clinicId,
            spend,
            risk,
            value,
            zone,
        };
    });
    const summary = buckets.reduce(
        (acc, bucket) => {
            acc[bucket.zone] += 1;
            return acc;
        },
        { protect: 0, accelerate: 0, watch: 0 }
    );

    return {
        buckets,
        summary,
        generatedAt: context.generatedAt,
    };
}

function buildSyntheticIncidents(context, budget, compliance, heatmap) {
    if (context.incidentsInput.length > 0) {
        return context.incidentsInput
            .slice(0, MAX_PREVIEW_ROWS * 2)
            .map((incident, index) =>
                normalizeIncidentRecord(incident, index, context)
            );
    }

    const incidents = [];
    const protectCount = safeNumber(heatmap.summary?.protect, 0);
    const accelerateCount = safeNumber(heatmap.summary?.accelerate, 0);
    const watchCount = safeNumber(heatmap.summary?.watch, 0);
    const snapshotCount = context.historySnapshots.length;

    if (budget.decision === 'hold' || compliance.status === 'red') {
        incidents.push({
            id: 'budget-hold',
            owner: 'finance',
            severity: 'critical',
            likelihood: 5,
            impact: 5,
            title: 'Hold release expansion',
            mitigation:
                'Review burn, at-risk spend and board approval before scaling.',
            source: 'synthetic',
        });
    } else if (budget.decision === 'review' || compliance.status === 'amber') {
        incidents.push({
            id: 'board-review',
            owner: 'governance',
            severity: 'high',
            likelihood: 4,
            impact: 4,
            title: 'Executive review before expansion',
            mitigation:
                'Validate evidence and keep release within current scope.',
            source: 'synthetic',
        });
    }

    if (protectCount > 0) {
        incidents.push({
            id: 'protect-zones',
            owner: 'ops',
            severity: protectCount > 1 ? 'high' : 'medium',
            likelihood: 3,
            impact: 4,
            title: 'Protect-zone clinics need guardrails',
            mitigation:
                'Reallocate spend and reinforce the high-risk clinics first.',
            detail: `${protectCount} clinic(s) in protect zone.`,
            source: 'synthetic',
        });
    }

    if (watchCount > 0 || accelerateCount > 0) {
        incidents.push({
            id: 'portfolio-variance',
            owner: 'planning',
            severity: watchCount > accelerateCount ? 'medium' : 'low',
            likelihood: 2,
            impact: 3,
            title: 'Portfolio variance across clinics',
            mitigation: 'Use the heatmap to prioritize the next rollout slice.',
            detail: `${accelerateCount} accelerate, ${watchCount} watch.`,
            source: 'synthetic',
        });
    }

    if (snapshotCount > 0) {
        incidents.push({
            id: 'history-variance',
            owner: 'history',
            severity: snapshotCount > 2 ? 'medium' : 'low',
            likelihood: 2,
            impact: 2,
            title: 'Recent history snapshots need review',
            mitigation:
                'Compare the current board view with the latest snapshots.',
            detail: `${snapshotCount} recent snapshot(s).`,
            source: 'synthetic',
        });
    }

    if (incidents.length === 0) {
        incidents.push({
            id: 'no-material-incidents',
            owner: 'governance',
            severity: 'low',
            likelihood: 1,
            impact: 1,
            title: 'No material blockers',
            mitigation: 'Keep the governance view refreshed.',
            source: 'synthetic',
        });
    }

    return incidents
        .slice(0, MAX_PREVIEW_ROWS * 2)
        .map((incident, index) =>
            normalizeIncidentRecord(incident, index, context)
        );
}

function resolveGovernanceTone(budget, risks, compliance) {
    if (
        compliance?.status === 'red' ||
        budget?.decision === 'hold' ||
        risks?.grade === 'D'
    ) {
        return 'alert';
    }
    if (
        compliance?.status === 'amber' ||
        budget?.decision === 'review' ||
        risks?.grade === 'C'
    ) {
        return 'warning';
    }
    return 'ready';
}

function buildTurneroReleaseBoardReport(input = {}) {
    const budget = asObject(input.budget || {});
    const costs = asObject(input.costs || {});
    const risks = asObject(input.risks || {});
    const compliance = asObject(input.compliance || {});
    const heatmap = asObject(input.heatmap || {});
    const headline =
        compliance.status === 'red' ||
        budget.decision === 'hold' ||
        risks.grade === 'D'
            ? 'Hold release expansion and remediate priority blockers.'
            : compliance.status === 'amber' ||
                budget.decision === 'review' ||
                risks.grade === 'C'
              ? 'Proceed with executive review before expansion.'
              : 'Proceed with controlled rollout under current guardrails.';
    const executiveSummary = [
        `Budget burn: ${budget.burnPct ?? 0}%`,
        `Budget at risk: ${budget.riskPct ?? 0}%`,
        `Total cost: ${formatMoney(costs.totalCost ?? 0)}`,
        `Risk grade: ${risks.grade || 'N/A'} (${risks.totalScore ?? 0})`,
        `Compliance: ${compliance.status || 'unknown'}`,
        `Heatmap: protect ${safeNumber(heatmap.summary?.protect, 0)}, accelerate ${safeNumber(heatmap.summary?.accelerate, 0)}, watch ${safeNumber(heatmap.summary?.watch, 0)}`,
    ];

    return {
        headline,
        executiveSummary,
        tone: resolveGovernanceTone(budget, risks, compliance),
        decision: budget.decision || 'review',
        riskGrade: risks.grade || 'A',
        complianceStatus: compliance.status || 'unknown',
        generatedAt: input.generatedAt || new Date().toISOString(),
        budget,
        costs,
        risks,
        compliance,
        heatmap,
        clinicId: toText(input.clinicId || ''),
        clinicLabel: toText(input.clinicLabel || ''),
        region: toText(input.region || ''),
        historySnapshots: toArray(input.historySnapshots || []),
    };
}

function boardReportToMarkdown(report = {}) {
    const budget = asObject(report.budget || {});
    const costs = asObject(report.costs || {});
    const risks = asObject(report.risks || {});
    const compliance = asObject(report.compliance || {});
    const heatmap = asObject(report.heatmap || {});
    const lines = [];

    lines.push('# Turnero Release Board Report');
    lines.push('');
    lines.push(`Headline: ${toText(report.headline || 'N/A')}`);
    if (report.clinicLabel || report.clinicId) {
        lines.push(`Clinic: ${toText(report.clinicLabel || report.clinicId)}`);
    }
    if (report.region) {
        lines.push(`Region: ${toText(report.region)}`);
    }
    lines.push(`Generated at: ${toText(report.generatedAt || '')}`);
    lines.push('');
    lines.push('## Executive Summary');
    toArray(report.executiveSummary).forEach((item) => {
        lines.push(`- ${toText(item)}`);
    });
    lines.push('');
    lines.push('## Budget');
    lines.push(`- Planned: ${formatMoney(budget.totals?.planned || 0)}`);
    lines.push(`- Committed: ${formatMoney(budget.totals?.committed || 0)}`);
    lines.push(`- At risk: ${formatMoney(budget.totals?.atRisk || 0)}`);
    lines.push(`- Burn: ${formatPercent(budget.burnPct || 0)}`);
    lines.push(`- Decision: ${toText(budget.decision || 'review')}`);
    lines.push('');
    lines.push('## Cost Model');
    lines.push(`- Total cost: ${formatMoney(costs.totalCost || 0)}`);
    lines.push(`- Waves: ${safeNumber(toArray(costs.lines).length, 0)}`);
    lines.push('');
    lines.push('## Risk Ledger');
    lines.push(`- Total score: ${safeNumber(risks.totalScore, 0)}`);
    lines.push(`- Grade: ${toText(risks.grade || 'A')}`);
    lines.push('');
    lines.push('## Compliance');
    lines.push(`- Status: ${toText(compliance.status || 'unknown')}`);
    lines.push(
        `- Checks: ${safeNumber(compliance.totals?.passed, 0)}/${safeNumber(
            compliance.totals?.all,
            0
        )} passed`
    );
    lines.push('');
    lines.push('## Investment Heatmap');
    lines.push(
        `- Protect: ${safeNumber(heatmap.summary?.protect, 0)} · Accelerate: ${safeNumber(
            heatmap.summary?.accelerate,
            0
        )} · Watch: ${safeNumber(heatmap.summary?.watch, 0)}`
    );
    lines.push('');
    lines.push(
        `Generated at: ${toText(report.generatedAt || new Date().toISOString())}`
    );

    return lines.join('\n');
}

function buildTurneroReleaseGovernanceSuiteModel(input = {}) {
    const context = buildGovernanceInputs(input);
    const clinics = context.clinicsInput.length
        ? context.clinicsInput.map((clinic, index) =>
              normalizeClinicRecord(clinic, index, context)
          )
        : [buildFallbackClinicRecord(context, 0)];
    const modelInput = {
        ...input,
        ...context,
        clinics,
        historySnapshots: context.historySnapshots,
        currentSnapshot: context.currentSnapshot,
        releaseEvidenceBundle: context.releaseEvidenceBundle,
        turneroClinicProfile: context.turneroClinicProfile,
        remoteReadiness: context.remoteReadiness,
        publicShellDrift: context.publicShellDrift,
    };
    const budget = buildTurneroReleaseBudgetEnvelope(modelInput);
    const costs = buildTurneroReleaseCostModel(modelInput);
    const compliance = buildTurneroReleaseCompliancePack(modelInput);
    const heatmap = buildTurneroReleaseInvestmentHeatmap(modelInput);
    const incidents = buildSyntheticIncidents(
        context,
        budget,
        compliance,
        heatmap
    );
    const risks = buildTurneroReleaseRiskLedger({
        ...modelInput,
        incidents,
    });
    const board = buildTurneroReleaseBoardReport({
        ...modelInput,
        budget,
        costs,
        risks,
        compliance,
        heatmap,
    });
    const boardMarkdown = boardReportToMarkdown({
        ...board,
        budget,
        costs,
        risks,
        compliance,
        heatmap,
    });
    const summaryText = [
        board.headline,
        `Budget ${formatPercent(budget.burnPct || 0)} burn · ${formatPercent(
            budget.riskPct || 0
        )} at risk`,
        `Risk grade ${risks.grade || 'A'} (${safeNumber(risks.totalScore, 0)})`,
        `Compliance ${compliance.status || 'unknown'} · ${compliance.totals?.passed || 0}/${compliance.totals?.all || 0} checks`,
        `Clinics ${clinics.length} · Waves ${costs.lines.length} · Recent snapshots ${context.historySnapshots.length}`,
    ].join('\n');
    const pack = {
        generatedAt: context.generatedAt,
        source: context.source,
        clinicId: context.clinicId,
        clinicLabel: context.clinicLabel,
        clinicShortName: context.clinicShortName,
        region: context.region,
        clinics,
        waves: costs.lines,
        incidents: risks.rows,
        checks: compliance.checks,
        budget,
        costs,
        risks,
        compliance,
        heatmap,
        board,
        historySnapshots: context.historySnapshots,
        currentSnapshot: context.currentSnapshot,
        releaseEvidenceBundle: context.releaseEvidenceBundle,
        remoteReadiness: context.remoteReadiness,
        publicShellDrift: context.publicShellDrift,
    };

    return {
        title: 'Financial / Risk Governance Suite',
        headline: board.headline,
        tone: board.tone,
        generatedAt: context.generatedAt,
        clinicId: context.clinicId,
        clinicLabel: context.clinicLabel,
        clinicShortName: context.clinicShortName,
        region: context.region,
        clinics,
        waves: costs.lines,
        incidents: risks.rows,
        checks: compliance.checks,
        budget,
        costs,
        risks,
        compliance,
        heatmap,
        board,
        boardMarkdown,
        summaryText,
        pack,
    };
}

function isGovernanceSuiteModel(value) {
    return Boolean(
        value &&
        typeof value === 'object' &&
        value.pack &&
        value.boardMarkdown &&
        value.budget &&
        value.compliance
    );
}

function renderGovernancePill(label, value, tone = 'ready') {
    return `
        <span class="queue-app-card__tag" data-state="${escapeHtml(tone)}">
            ${escapeHtml(label)}: ${escapeHtml(value)}
        </span>
    `;
}

function renderGovernanceMetric(label, value, detail = '', tone = 'ready') {
    return `
        <article class="turnero-release-governance-suite__metric" data-state="${escapeHtml(tone)}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
            ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
        </article>
    `;
}

function renderGovernanceRow(label, value, detail = '', tone = 'ready') {
    return `
        <div class="turnero-release-governance-suite__row" data-state="${escapeHtml(tone)}">
            <strong>${escapeHtml(label)}</strong>
            <span>${escapeHtml(value)}</span>
            ${detail ? `<small>${escapeHtml(detail)}</small>` : ''}
        </div>
    `;
}

function renderGovernanceSummaryList(items = []) {
    return `
        <ul class="turnero-release-governance-suite__summary-list">
            ${items
                .map(
                    (item) => `
                        <li>
                            <strong>${escapeHtml(item.label)}</strong>
                            <span>${escapeHtml(item.value)}</span>
                            ${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}
                        </li>
                    `
                )
                .join('')}
        </ul>
    `;
}

function renderBudgetPanel(model) {
    const clinicRows = model.clinics.slice(0, MAX_PREVIEW_ROWS);
    const extraClinics = Math.max(0, model.clinics.length - clinicRows.length);
    return `
        <article
            id="turneroReleaseGovernanceBudget"
            class="queue-app-card turnero-release-governance-suite__panel"
            data-state="${escapeHtml(toneForDecision(model.budget.decision))}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Budget envelope</p>
                    <h6>Presupuesto y burn</h6>
                    <p>${escapeHtml(model.region)} · ${escapeHtml(
                        `${model.clinics.length} clinic(s)`
                    )}</p>
                </div>
                ${renderGovernancePill(
                    'Decision',
                    model.budget.decision,
                    toneForDecision(model.budget.decision)
                )}
            </header>
            <div class="turnero-release-governance-suite__metric-grid">
                ${renderGovernanceMetric(
                    'Planned',
                    formatMoney(model.budget.totals.planned),
                    'Base release envelope'
                )}
                ${renderGovernanceMetric(
                    'Committed',
                    formatMoney(model.budget.totals.committed),
                    'Budget already absorbed'
                )}
                ${renderGovernanceMetric(
                    'At risk',
                    formatMoney(model.budget.totals.atRisk),
                    'Exposure waiting to be remediated'
                )}
            </div>
            <div class="turnero-release-governance-suite__stack">
                ${clinicRows
                    .map((clinic) => {
                        const risk = safeNumber(
                            clinic.risk,
                            clinic.riskScore || 0
                        );
                        const zone = risk >= 80 ? 'protect' : 'watch';
                        return renderGovernanceRow(
                            clinic.shortLabel ||
                                clinic.label ||
                                clinic.clinicId,
                            `${formatMoney(clinic.committedBudget)} committed`,
                            `${formatMoney(clinic.plannedBudget)} planned · ${formatPercent(
                                risk
                            )} risk · ${formatPercent(clinic.value)} value`,
                            toneForHeatmapZone(zone)
                        );
                    })
                    .join('')}
                ${
                    extraClinics > 0
                        ? `<p class="turnero-release-governance-suite__more">+${extraClinics} clinic(s) more.</p>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderCostPanel(model) {
    const lines = model.costs.lines.slice(0, MAX_PREVIEW_ROWS);
    const extraLines = Math.max(0, model.costs.lines.length - lines.length);
    return `
        <article
            id="turneroReleaseGovernanceCosts"
            class="queue-app-card turnero-release-governance-suite__panel"
            data-state="${escapeHtml(model.budget.decision === 'hold' ? 'alert' : model.budget.decision === 'review' ? 'warning' : 'ready')}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Cost model</p>
                    <h6>Costos por wave</h6>
                    <p>Total proyectado ${escapeHtml(formatMoney(model.costs.totalCost))}</p>
                </div>
                ${renderGovernancePill(
                    'Waves',
                    `${model.costs.lines.length}`,
                    model.costs.lines.length > 1 ? 'warning' : 'ready'
                )}
            </header>
            <div class="turnero-release-governance-suite__stack">
                ${lines
                    .map((line) =>
                        renderGovernanceRow(
                            line.label || line.waveId,
                            formatMoney(line.total),
                            `${line.clinicCount} clinic(s) · ${formatMoney(line.base)} base · ${formatMoney(
                                line.support
                            )} support · ${formatMoney(line.incident)} incident`,
                            line.total > 0 ? 'ready' : 'warning'
                        )
                    )
                    .join('')}
                ${
                    extraLines > 0
                        ? `<p class="turnero-release-governance-suite__more">+${extraLines} wave(s) more.</p>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderRiskPanel(model) {
    const rows = model.risks.rows.slice(0, MAX_PREVIEW_ROWS);
    const extraRows = Math.max(0, model.risks.rows.length - rows.length);
    return `
        <article
            id="turneroReleaseGovernanceRisk"
            class="queue-app-card turnero-release-governance-suite__panel"
            data-state="${escapeHtml(toneForRiskGrade(model.risks.grade))}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Risk ledger</p>
                    <h6>Riesgo y mitigación</h6>
                    <p>Total score ${escapeHtml(String(model.risks.totalScore))}</p>
                </div>
                ${renderGovernancePill(
                    'Grade',
                    model.risks.grade,
                    toneForRiskGrade(model.risks.grade)
                )}
            </header>
            <div class="turnero-release-governance-suite__stack">
                ${rows
                    .map((row) =>
                        renderGovernanceRow(
                            row.title,
                            `Score ${row.score}`,
                            `${row.owner} · severity ${row.severity} · likelihood ${row.likelihood}/5 · impact ${row.impact}/5`,
                            toneForRiskGrade(model.risks.grade)
                        )
                    )
                    .join('')}
                ${
                    extraRows > 0
                        ? `<p class="turnero-release-governance-suite__more">+${extraRows} risk(s) more.</p>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderCompliancePanel(model) {
    const checks = model.compliance.checks.slice(0, MAX_PREVIEW_ROWS);
    const extraChecks = Math.max(
        0,
        model.compliance.checks.length - checks.length
    );
    return `
        <article
            id="turneroReleaseGovernanceCompliance"
            class="queue-app-card turnero-release-governance-suite__panel"
            data-state="${escapeHtml(toneForComplianceStatus(model.compliance.status))}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Compliance pack</p>
                    <h6>Cumplimiento</h6>
                    <p>${escapeHtml(
                        `${model.compliance.totals.passed}/${model.compliance.totals.all} checks passed`
                    )}</p>
                </div>
                ${renderGovernancePill(
                    'Status',
                    model.compliance.status,
                    toneForComplianceStatus(model.compliance.status)
                )}
            </header>
            <div class="turnero-release-governance-suite__metric-grid">
                ${renderGovernanceMetric(
                    'All',
                    String(model.compliance.totals.all),
                    'Checks in scope'
                )}
                ${renderGovernanceMetric(
                    'Passed',
                    String(model.compliance.totals.passed),
                    'Checks cleared'
                )}
                ${renderGovernanceMetric(
                    'Missing',
                    String(model.compliance.totals.missing),
                    'Checks pending'
                )}
            </div>
            <div class="turnero-release-governance-suite__stack">
                ${checks
                    .map((check) =>
                        renderGovernanceRow(
                            check.label,
                            check.status,
                            check.detail || check.evidence || check.source,
                            toneForCheckStatus(check.status)
                        )
                    )
                    .join('')}
                ${
                    extraChecks > 0
                        ? `<p class="turnero-release-governance-suite__more">+${extraChecks} check(s) more.</p>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderHeatmapPanel(model) {
    const buckets = model.heatmap.buckets.slice(0, MAX_PREVIEW_ROWS);
    const extraBuckets = Math.max(
        0,
        model.heatmap.buckets.length - buckets.length
    );
    return `
        <article
            id="turneroReleaseGovernanceHeatmap"
            class="queue-app-card turnero-release-governance-suite__panel"
            data-state="${escapeHtml(
                model.heatmap.summary.protect > 0 ? 'alert' : 'ready'
            )}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Investment heatmap</p>
                    <h6>Mapa de inversión</h6>
                    <p>${escapeHtml(
                        `${model.heatmap.summary.protect} protect · ${model.heatmap.summary.accelerate} accelerate · ${model.heatmap.summary.watch} watch`
                    )}</p>
                </div>
                ${renderGovernancePill(
                    'Zones',
                    `${model.heatmap.buckets.length}`,
                    model.heatmap.summary.protect > 0 ? 'alert' : 'ready'
                )}
            </header>
            <div class="turnero-release-governance-suite__stack">
                ${buckets
                    .map((bucket) =>
                        renderGovernanceRow(
                            bucket.label || bucket.clinicId,
                            `${bucket.zone}`,
                            `${formatMoney(bucket.spend)} spend · ${formatPercent(bucket.risk)} risk · ${formatPercent(bucket.value)} value`,
                            toneForHeatmapZone(bucket.zone)
                        )
                    )
                    .join('')}
                ${
                    extraBuckets > 0
                        ? `<p class="turnero-release-governance-suite__more">+${extraBuckets} bucket(s) more.</p>`
                        : ''
                }
            </div>
        </article>
    `;
}

function renderBoardPanel(model, escapeHtmlImpl = escapeHtml) {
    const summaryMarkdown = escapeHtmlImpl(model.boardMarkdown);
    return `
        <article
            id="turneroReleaseGovernanceBoard"
            class="queue-app-card turnero-release-governance-suite__panel"
            data-state="${escapeHtml(model.board.tone)}"
        >
            <header class="queue-app-card__header">
                <div>
                    <p class="queue-app-card__eyebrow">Board report</p>
                    <h6>${escapeHtml(model.board.headline)}</h6>
                    <p>${escapeHtml(model.summaryText.split('\n')[0] || '')}</p>
                </div>
                ${renderGovernancePill(
                    'Tone',
                    model.board.tone,
                    model.board.tone
                )}
            </header>
            <div class="turnero-release-governance-suite__stack">
                ${renderGovernanceSummaryList(
                    model.board.executiveSummary.map((item) => ({
                        label: item.split(':')[0] || 'Summary',
                        value: item.includes(':')
                            ? item.split(':').slice(1).join(':').trim()
                            : item,
                    }))
                )}
            </div>
            <details class="turnero-release-governance-suite__markdown">
                <summary>Markdown copiable</summary>
                <pre>${summaryMarkdown}</pre>
            </details>
        </article>
    `;
}

function renderTurneroReleaseGovernanceSuiteHtml(model, options = {}) {
    const escapeHtmlImpl =
        typeof options.escapeHtml === 'function'
            ? options.escapeHtml
            : escapeHtml;
    const formatDateTimeImpl =
        typeof options.formatDateTime === 'function'
            ? options.formatDateTime
            : formatDateTime;

    return `
        <section
            id="turneroReleaseGovernanceSuite"
            class="turnero-release-war-room turnero-release-governance-suite"
            data-state="${escapeHtmlImpl(model.tone)}"
            data-decision="${escapeHtmlImpl(model.budget.decision)}"
            data-compliance="${escapeHtmlImpl(model.compliance.status)}"
            data-risk-grade="${escapeHtmlImpl(model.risks.grade)}"
        >
            <header class="turnero-release-war-room__header">
                <div class="turnero-release-war-room__header-copy">
                    <p class="queue-premium-band__eyebrow">Deployment</p>
                    <h5>Financial / Risk Governance Suite</h5>
                    <p id="turneroReleaseGovernanceSummary">${escapeHtmlImpl(
                        model.summaryText
                    )}</p>
                </div>
                <div class="turnero-release-war-room__meta">
                    <span>Clinic: ${escapeHtmlImpl(model.clinicLabel)}</span>
                    <span>Region: ${escapeHtmlImpl(model.region)}</span>
                    <span>Generated: ${escapeHtmlImpl(
                        formatDateTimeImpl(model.generatedAt)
                    )}</span>
                </div>
            </header>

            <div class="turnero-release-war-room__global-summary">
                ${renderGovernancePill(
                    'Decision',
                    model.budget.decision,
                    toneForDecision(model.budget.decision)
                )}
                ${renderGovernancePill(
                    'Risk',
                    `${model.risks.grade} / ${model.risks.totalScore}`,
                    toneForRiskGrade(model.risks.grade)
                )}
                ${renderGovernancePill(
                    'Compliance',
                    `${model.compliance.status} (${model.compliance.totals.passed}/${model.compliance.totals.all})`,
                    toneForComplianceStatus(model.compliance.status)
                )}
                ${renderGovernancePill(
                    'Clinics',
                    `${model.clinics.length}`,
                    model.clinics.length > 1 ? 'ready' : 'warning'
                )}
                ${renderGovernancePill(
                    'Waves',
                    `${model.costs.lines.length}`,
                    model.costs.lines.length > 1 ? 'warning' : 'ready'
                )}
            </div>

            <div class="turnero-release-war-room__global-actions" id="turneroReleaseGovernanceActions">
                <button type="button" data-governance-action="copy-summary">Copiar resumen</button>
                <button type="button" data-governance-action="copy-markdown">Copiar markdown</button>
                <button type="button" data-governance-action="download-json">Descargar JSON</button>
            </div>

            <div class="turnero-release-war-room__lanes">
                ${renderBudgetPanel(model)}
                ${renderCostPanel(model)}
                ${renderRiskPanel(model)}
                ${renderCompliancePanel(model)}
                ${renderHeatmapPanel(model)}
                ${renderBoardPanel(model, escapeHtmlImpl)}
            </div>
        </section>
    `;
}

function bindGovernanceSuiteActions(host, model) {
    host.onclick = async (event) => {
        const target = event?.target;
        const button =
            target && typeof target.closest === 'function'
                ? target.closest('[data-governance-action]')
                : null;
        if (!(button instanceof HTMLElement) || !host.contains(button)) {
            return;
        }

        const action = toText(button.dataset.governanceAction, '');
        if (!action) {
            return;
        }

        if (action === 'copy-summary') {
            await copyToClipboardSafe(model.summaryText);
            return;
        }

        if (action === 'copy-markdown') {
            await copyToClipboardSafe(model.boardMarkdown);
            return;
        }

        if (action === 'download-json') {
            downloadJsonSnapshot(
                'turnero-release-governance-suite.json',
                model.pack
            );
        }
    };
}

export function renderTurneroReleaseGovernanceSuite(input = {}, options = {}) {
    const model = isGovernanceSuiteModel(input)
        ? input
        : buildTurneroReleaseGovernanceSuiteModel(input);
    return renderTurneroReleaseGovernanceSuiteHtml(model, options);
}

export function mountTurneroReleaseGovernanceSuite(
    target,
    input = {},
    options = {}
) {
    const host = resolveTarget(target);
    if (!isDomElement(host)) {
        return null;
    }

    const model = isGovernanceSuiteModel(input)
        ? input
        : buildTurneroReleaseGovernanceSuiteModel(input);
    host.innerHTML = renderTurneroReleaseGovernanceSuiteHtml(model, options);
    host.dataset.turneroReleaseGovernanceSuite = 'mounted';
    host.dataset.turneroReleaseGovernanceClinicId = model.clinicId;
    host.dataset.turneroReleaseGovernanceTone = model.tone;
    bindGovernanceSuiteActions(host, model);

    const root = host.querySelector('#turneroReleaseGovernanceSuite');
    if (root instanceof HTMLElement) {
        root.__turneroReleaseGovernanceSuiteModel = model;
        return root;
    }

    return host;
}

export {
    boardReportToMarkdown,
    buildTurneroReleaseBoardReport,
    buildTurneroReleaseBudgetEnvelope,
    buildTurneroReleaseCompliancePack,
    buildTurneroReleaseCostModel,
    buildTurneroReleaseGovernanceSuiteModel,
    buildTurneroReleaseInvestmentHeatmap,
    buildTurneroReleaseRiskLedger,
};

export default mountTurneroReleaseGovernanceSuite;
