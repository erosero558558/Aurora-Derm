#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const WRAPPER_PATH = resolve(__dirname, '..', 'REPORTE-SEMANAL-PRODUCCION.ps1');
const SCRIPT_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'prod',
    'REPORTE-SEMANAL-PRODUCCION.ps1'
);

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

function loadWrapper() {
    return readFileSync(WRAPPER_PATH, 'utf8');
}

test('weekly report root wrapper delega a la implementacion canonica de prod ops', () => {
    const raw = loadWrapper();

    assert.equal(
        raw.includes('scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1'),
        true,
        'wrapper root debe apuntar a scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1'
    );
    assert.equal(
        raw.includes('Push-Location $PSScriptRoot'),
        true,
        'wrapper root debe fijar cwd al repo root'
    );
});

test('weekly report script expone parametros de ciclo semanal', () => {
    const raw = loadScript();
    const requiredSnippets = [
        'resource=health-diagnostics',
        '[int]$CriticalFreeCycleTarget = 2',
        '[switch]$FailOnCycleNotReady',
        '$CriticalFreeCycleTarget -lt 1',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de parametro/guardrail: ${snippet}`
        );
    }
});

test('weekly report script publica weeklyCycle en markdown y JSON', () => {
    const raw = loadScript();
    const requiredSnippets = [
        '## Weekly Cycle Guardrail',
        '$weeklyCycleHistoryBlock',
        '$weeklyCyclePayload = [ordered]@{}',
        '$weeklyCyclePayload.targetConsecutiveNoCritical = $weeklyCycleTarget',
        '$weeklyCyclePayload.consecutiveNoCritical = $weeklyCycleConsecutiveNoCritical',
        '$weeklyCyclePayload.ready = [bool]$weeklyCycleReady',
        '$reportPayload.weeklyCycle = $weeklyCyclePayload',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de salida weeklyCycle: ${snippet}`
        );
    }
});

test('weekly report script publica recoveryCycle en markdown y JSON', () => {
    const raw = loadScript();
    const requiredSnippets = [
        '## Recovery Cycle',
        '$recoveryCycleState = [pscustomobject]@{',
        "Id = 'flow-os-recovery-2026-03-21'",
        "AllowedSlice = 'admin v3 + queue/turnero + auth Google + readiness + deploy'",
        "DailyRitualCommand = 'npm run flow-os:recovery:daily'",
        'PilotRecommendationEligible = [bool]($weeklyCycleReady -and $warningCountsCritical -eq 0)',
        '# $recoveryCyclePayload = [ordered]@{}',
        '# $reportPayload.recoveryCycle = $recoveryCyclePayload',
        '-RecoveryCycleState $recoveryCycleState',
        'recovery_cycle_status=$($recoveryCycleState.Status)',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de salida recoveryCycle: ${snippet}`
        );
    }
});

test('weekly report script soporta fail opcional por ciclo no listo', () => {
    const raw = loadScript();
    const requiredSnippets = [
        'if ($FailOnCycleNotReady -and -not $weeklyCycleReady)',
        'FailOnCycleNotReady activo: ciclo semanal no listo',
        'Get-WeeklyCycleEvaluation',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de fail/gobernanza ciclo: ${snippet}`
        );
    }
});

test('weekly report script integra bloque telemedicina operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        '[int]$TelemedicineReviewQueueWarnCount = 12',
        '[int]$TelemedicineStagedUploadsWarnCount = 1',
        '[int]$TelemedicineUnlinkedIntakesWarnCount = 5',
        'telemedicine_diagnostics_status',
        'telemedicine_diagnostics_critical_',
        'telemedicine_case_photos_missing_private_path_',
    ];
    const requiredWarningsSnippets = [
        '## Telemedicine Ops',
        'telemedicine = [ordered]@{',
        "if ($WarningCode.StartsWith('telemedicine_')) {",
        'telemedicine = @()',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet telemedicina en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet telemedicina en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report script integra bloque public sync operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        "$publicSyncCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'publicSync' -DefaultValue $null",
        '$publicSyncOperationallyHealthy',
        '$publicSyncRepoHygieneIssue',
        '$publicSyncFailureReason',
        '$publicSyncExpectedMaxLagSeconds',
        '$publicSyncLastCheckedAt',
        '$publicSyncTelemetryGap',
        'public_sync_unconfigured',
        'public_sync_working_tree_dirty_${publicSyncDirtyPathsCount}',
        'public_sync_telemetry_gap',
        'public_sync_operationally_healthy=$publicSyncOperationallyHealthy',
        'public_sync_repo_hygiene_issue=$publicSyncRepoHygieneIssue',
        'public_sync_failure_reason=$publicSyncFailureReason',
        'public_sync_last_error_message=$publicSyncLastErrorMessage',
        'public_sync_current_head=$publicSyncCurrentHead',
        'public_sync_dirty_paths_sample=$publicSyncDirtyPathsSampleLabel',
    ];
    const requiredWarningsSnippets = [
        '## Public Sync Ops',
        'publicSync = [ordered]@{',
        'operationallyHealthy = [bool]$publicSyncOperationallyHealthy',
        'repoHygieneIssue = [bool]$publicSyncRepoHygieneIssue',
        'expectedMaxLagSeconds = $publicSyncExpectedMaxLagSeconds',
        'failureReason = $publicSyncFailureReason',
        'lastErrorMessage = $publicSyncLastErrorMessage',
        'dirtyPathsSample = @($publicSyncDirtyPathsSample)',
        'telemetryGap = [bool]$publicSyncTelemetryGap',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet publicSync en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet publicSync en Common.Warnings.ps1: ${snippet}`
        );
    }

    assert.match(
        rawWarnings,
        /if \(\$WarningCode\.StartsWith\('public_sync_'\)\) \{\s+return 'observability'/,
        'publicSync debe mapearse a impacto observability'
    );
    assert.match(
        rawWarnings,
        /if \(\$WarningCode\.StartsWith\('public_sync_'\)\) \{\s+return 'docs\/PUBLIC_MAIN_UPDATE_RUNBOOK\.md'/,
        'publicSync debe apuntar al runbook canonico'
    );
});

test('weekly report script integra bloque turnero pilot por clínica', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        "$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'",
        '$turneroPilotVerifyRequired = $false',
        'turnero_pilot_profile_status_unresolved',
        'turnero_pilot_catalog_drift',
        'turnero_pilot_remote_mismatch',
        'turnero_pilot_verify_required=$turneroPilotVerifyRequired',
        'turnero_pilot_remote_profile_source=$turneroPilotRemoteProfileSource',
        'turnero_pilot_remote_admin_mode_default=$turneroPilotRemoteAdminModeDefault',
        'turnero_pilot_recovery_targets=$($turneroPilotRecoveryTargets -join',
    ];
    const requiredWarningsSnippets = [
        '## Turnero Pilot',
        'turneroPilot = [ordered]@{',
        'remoteOk = [bool]$turneroPilotRemoteOk',
        'recoveryTargets = @($turneroPilotRecoveryTargets)',
        'errors = @($turneroPilotErrors)',
        "if ($WarningCode.StartsWith('turnero_pilot_')) {",
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet turneroPilot en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet turneroPilot en Common.Warnings.ps1: ${snippet}`
        );
    }

    assert.match(
        rawWarnings,
        /if \(\$WarningCode\.StartsWith\('turnero_pilot_'\)\) \{\s+return 'turnero'/,
        'turneroPilot debe mapearse a impacto turnero'
    );
    assert.match(
        rawWarnings,
        /if \(\$WarningCode\.StartsWith\('turnero_pilot_'\)\) \{\s+return 'docs\/TURNERO_WEB_PRODUCTION_CUT\.md'/,
        'turneroPilot debe apuntar al corte canónico del piloto web'
    );
});

test('weekly report script integra bloque GitHub deploy alerts operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        "[string]$GitHubRepo = 'erosero558558/Aurora-Derm'",
        '$githubDeployAlertsSummary = Get-GitHubProductionAlertSummary',
        'github_deploy_alerts_unreachable',
        'github_deploy_alerts_open_${githubDeployAlertsRelevantCount}',
        'github_deploy_transport_blocked',
        'github_deploy_connectivity_blocked',
        'github_deploy_repair_git_sync_blocked',
        'github_deploy_self_hosted_runner_blocked',
        'github_deploy_self_hosted_deploy_blocked',
        'github_deploy_turnero_pilot_blocked',
        'github_deploy_self_hosted_deploy_count=$githubDeployAlertsSelfHostedDeployCount',
        'github_deploy_turnero_pilot_count=$githubDeployAlertsTurneroPilotCount',
        'github_deploy_turnero_pilot_recovery_targets=$($turneroPilotRecoveryTargets -join',
        'github_deploy_alerts_issue_numbers=$githubDeployAlertsIssueNumbersLabel',
        'github_deploy_alerts_issue_refs=$githubDeployAlertsIssueRefsLabel',
    ];
    const requiredWarningsSnippets = [
        '## GitHub Deploy Alerts',
        'githubDeployAlerts = [ordered]@{',
        'transportCount = $githubDeployAlertsTransportCount',
        'selfHostedRunnerCount = $githubDeployAlertsSelfHostedRunnerCount',
        'selfHostedDeployCount = $githubDeployAlertsSelfHostedDeployCount',
        'turneroPilotCount = $githubDeployAlertsTurneroPilotCount',
        'turneroPilotRecoveryTargets = @($turneroPilotRecoveryTargets)',
        'hasSelfHostedDeployBlock = [bool]$githubDeployAlertsHasSelfHostedDeployBlock',
        'hasTurneroPilotBlock = [bool]$githubDeployAlertsHasTurneroPilotBlock',
        'issueRefs = @($githubDeployAlertsIssueRefs)',
        "if ($WarningCode -eq 'github_deploy_alerts_unreachable') {",
        "if ($WarningCode.StartsWith('github_deploy_')) {",
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet GitHub deploy alerts en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet GitHub deploy alerts en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report script integra bloque lead ops comercial', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        '[int]$LeadOpsPendingWarnCount = 20',
        '[int]$LeadOpsHotWarnCount = 8',
        '[int]$LeadOpsFirstContactWarnMinSamples = 3',
        '[double]$LeadOpsAiAcceptanceMinWarnPct = 25',
        "$leadOpsCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'leadOps' -DefaultValue $null",
        "$leadOpsFirstContactAvgMinutes = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'firstContactAvgMinutes' -DefaultValue 0)",
        'leadops_worker_${leadOpsMode}',
        'leadops_pending_queue_alta_${leadOpsPendingCallbacks}',
        'leadops_hot_queue_alta_${leadOpsPriorityHot}',
        'leadops_ai_backlog_${leadOpsAiRequested}',
        'leadops_first_contact_promedio_alto_${leadOpsFirstContactAvgMinutes}min',
        'leadops_close_rate_baja_${leadOpsCloseFromContactedRatePct}pct',
        'leadops_ai_acceptance_baja_${leadOpsAiAcceptanceRatePct}pct',
        'leadops_configured=$leadOpsConfigured',
    ];
    const requiredWarningsSnippets = [
        '## LeadOps',
        "if ($WarningCode.StartsWith('leadops_')) {",
        'leadOps = [ordered]@{',
        'pendingWarnCount = $LeadOpsPendingWarnCount',
        'hotWarnCount = $LeadOpsHotWarnCount',
        'firstContactWarnMinSamples = $LeadOpsFirstContactWarnMinSamples',
        'closeRateMinWarnPct = [Math]::Round([double]$LeadOpsCloseRateMinWarnPct, 2)',
        'aiAcceptanceMinWarnPct = [Math]::Round([double]$LeadOpsAiAcceptanceMinWarnPct, 2)',
        '- leadops_first_contact_avg_minutes: $leadOpsFirstContactAvgMinutes',
        '- leadops_close_from_contacted_rate_pct: $leadOpsCloseFromContactedRatePct',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet leadOps en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet leadOps en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report script integra bloque de postura auth operativa', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        "$authCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'auth' -DefaultValue $null",
        "$authMode = [string](Get-ObjectValueOrDefault -Object $authCheck -Property 'mode' -DefaultValue 'unknown')",
        "$authStatus = [string](Get-ObjectValueOrDefault -Object $authCheck -Property 'status' -DefaultValue 'unknown')",
        'auth_status_${authStatus}',
        'auth_mode_${authMode}',
        'auth_2fa_disabled',
        'auth_mode=$authMode',
        'auth_two_factor_enabled=$authTwoFactorEnabled',
        'auth_operator_enabled=$authOperatorAuthEnabled',
        'auth_legacy_password_configured=$authLegacyPasswordConfigured',
    ];
    const requiredWarningsSnippets = [
        '## Auth Posture',
        'auth = [ordered]@{',
        "if ($WarningCode.StartsWith('auth_')) {",
        'mode = $authMode',
        'hardeningCompliant = [bool]$authHardeningCompliant',
        'recommendedMode = $authRecommendedMode',
        'twoFactorEnabled = [bool]$authTwoFactorEnabled',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet auth en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet auth en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report script integra bloque operator auth rollout operativo', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        'scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1',
        'function Invoke-OpenClawAuthRolloutDiagnostic',
        '$operatorAuthRollout = Invoke-OpenClawAuthRolloutDiagnostic -BaseUrl $base -ScriptPath $openClawAuthDiagnosticScriptPath',
        "$operatorAuthRolloutDiagnosis = [string](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'diagnosis' -DefaultValue 'unknown')",
        "$operatorAuthRolloutOk = [bool](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'ok' -DefaultValue $false)",
        'auth_rollout_${operatorAuthRolloutDiagnosis}',
        'auth_rollout_available=$operatorAuthRolloutAvailable',
        'auth_rollout_diagnosis=$operatorAuthRolloutDiagnosis',
        'auth_rollout_next_action=$operatorAuthRolloutNextAction',
    ];
    const requiredWarningsSnippets = [
        '## Operator Auth Rollout',
        'operatorAuthRollout = [ordered]@{',
        'available = [bool]$operatorAuthRolloutAvailable',
        'diagnosis = $operatorAuthRolloutDiagnosis',
        'operatorAuthStatusHttpStatus = $operatorAuthRolloutOperatorAuthStatusHttpStatus',
        'adminAuthFacadeHttpStatus = $operatorAuthRolloutAdminAuthFacadeHttpStatus',
        'nextAction = $operatorAuthRolloutNextAction',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet operator auth rollout en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet operator auth rollout en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report script integra bloque de postura storage operativa', () => {
    const rawReport = loadScript();
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredReportSnippets = [
        "$hostChecklistCommand = 'npm run checklist:prod:public-sync:host'",
        "$storageCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'storage' -DefaultValue $null",
        "$storageBackend = [string](Get-ObjectValueOrDefault -Object $storageCheck -Property 'backend' -DefaultValue 'unknown')",
        "$storeEncryptionStatus = [string](Get-ObjectValueOrDefault -Object $storageCheck -Property 'encryptionStatus' -DefaultValue 'unknown')",
        'storage_encryption_required_noncompliant_${storeEncryptionStatus}',
        'storage_encryption_noncompliant_${storeEncryptionStatus}',
        'storage_backend_json_fallback',
        'storage_backend=$storageBackend',
        'storage_encryption_status=$storeEncryptionStatus',
        'storage_host_checklist_command=$hostChecklistCommand',
    ];
    const requiredWarningsSnippets = [
        '## Storage Posture',
        'storage = [ordered]@{',
        "if ($WarningCode.StartsWith('storage_')) {",
        "return 'docs/SECURITY.md'",
        "return 'npm run checklist:prod:public-sync:host'",
        'encryptionConfigured = [bool]$storeEncryptionConfigured',
        'encryptionCompliant = [bool]$storeEncryptionCompliant',
        'hostChecklistCommand = $effectiveHostChecklistCommand',
    ];

    for (const snippet of requiredReportSnippets) {
        assert.equal(
            rawReport.includes(snippet),
            true,
            `falta snippet storage en REPORTE-SEMANAL-PRODUCCION.ps1: ${snippet}`
        );
    }

    for (const snippet of requiredWarningsSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet storage en Common.Warnings.ps1: ${snippet}`
        );
    }
});

test('weekly report warning details incluyen remediacion y comando sugerido', () => {
    const rawWarnings = readFileSync(
        resolve(__dirname, '..', 'bin', 'powershell', 'Common.Warnings.ps1'),
        'utf8'
    );
    const requiredSnippets = [
        'function Get-WarningSuggestedCommand',
        'function Get-WarningRemediationSummary',
        'remediation = $warningRemediation',
        'suggestedCommand = $warningSuggestedCommand',
        'remediation = [string]$_.remediation',
        'suggestedCommand = [string]$_.suggestedCommand',
        'minute_5_10_host',
        '$hostChecklistCommand',
        'hostChecklistIssueFamilies = @(',
        'public_sync_*',
        'github_deploy_*',
        'auth_*',
        'storage_*',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            rawWarnings.includes(snippet),
            true,
            `falta snippet de remediacion semanal en Common.Warnings.ps1: ${snippet}`
        );
    }
});
