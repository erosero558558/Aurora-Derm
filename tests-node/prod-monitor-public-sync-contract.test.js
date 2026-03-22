#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const MONITOR_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'MONITOR-PRODUCCION.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');
const RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'PUBLIC_MAIN_UPDATE_RUNBOOK.md'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod monitor clasifica incidentes publicSync con telemetria canonica', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        'resource=health-diagnostics',
        "$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'",
        '[switch]$AllowDegradedPublicSync',
        'function Add-MonitorFailure',
        '$publicSyncNode = $null',
        '$publicSyncOperationallyHealthy = $false',
        '$publicSyncRepoHygieneIssue = $false',
        "$publicSyncFailureReason = ''",
        "$publicSyncLastErrorMessage = ''",
        "$publicSyncCurrentHead = ''",
        "$publicSyncRemoteHead = ''",
        '$publicSyncDirtyPathsCount = 0',
        '$publicSyncDirtyPathsSample = @()',
        '$publicSyncHeadDrift = (',
        '$publicSyncTelemetryGap = (',
        '$publicSyncRepoHygieneIssue = (',
        '[INFO] health.publicSync configured=$publicSyncConfigured healthy=$publicSyncHealthy operationallyHealthy=$publicSyncOperationallyHealthy repoHygieneIssue=$publicSyncRepoHygieneIssue jobId=$publicSyncJobId state=$publicSyncState ageSeconds=$publicSyncAgeSeconds expectedMaxLagSeconds=$publicSyncExpectedMaxLagSeconds failureReason=$publicSyncFailureReason',
        'lastErrorMessage=$publicSyncLastErrorMessage',
        'dirtyPathsSample=$publicSyncDirtyPathsSampleLabel',
        "Add-MonitorFailure -Message '[FAIL] health.checks.publicSync ausente' -AllowDegraded:$AllowDegradedPublicSync",
        "Add-MonitorFailure -Message '[FAIL] health.publicSync.configured=false' -AllowDegraded:$AllowDegradedPublicSync",
        'Add-MonitorFailure -Message "[FAIL] health.publicSync unhealthy (state=$publicSyncState, failureReason=$publicSyncFailureReason, repoHygieneIssue=$publicSyncRepoHygieneIssue, headDrift=$publicSyncHeadDrift, telemetryGap=$publicSyncTelemetryGap, dirtyPathsCount=$publicSyncDirtyPathsCount)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] health.publicSync head drift (currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] health.publicSync telemetry gap (failureReason=$publicSyncFailureReason lastErrorMessage=$publicSyncLastErrorMessage)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorWarning -Message "[WARN] health.publicSync repo hygiene issue (dirtyPathsCount=$publicSyncDirtyPathsCount dirtyPathsSample=$publicSyncDirtyPathsSampleLabel)"',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet publicSync en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod monitor integra verify-remote del piloto web por clínica en el triage rápido', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        '$turneroPilotVerifyRequired = $false',
        '$turneroPilotRecoveryTargets = @()',
        "$turneroPilotRecoveryTargetsLabel = 'none'",
        "Add-MonitorFailure -Message '[FAIL] turneroPilot clinic-profile status unresolved' -AllowDegraded:$AllowDegradedPublicSync",
        'Add-MonitorFailure -Message "[FAIL] turneroPilot catalog drift (clinicId=$turneroPilotClinicId)" -AllowDegraded:$AllowDegradedPublicSync',
        "'[ALERTA PROD] Deploy Hosting turneroPilot bloqueado'",
        "'[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'",
        '[INFO] turneroPilot clinicId=$turneroPilotClinicId catalogMatch=$turneroPilotCatalogMatch',
        '& node $turneroClinicProfileScriptPath verify-remote --base-url $base --json 2>&1',
        '[INFO] turneroPilot remote clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady',
        '[INFO] turneroPilot recoveryTargets=$turneroPilotRecoveryTargetsLabel',
        '$turneroPilotRemoteHealthRedacted = $false',
        '$turneroPilotRemoteDiagnosticsAuthorized = $false',
        "$turneroPilotRemoteResource = 'health'",
        'try { $turneroPilotRemoteHealthRedacted = [bool]$turneroPilotVerify.publicHealthRedacted } catch { $turneroPilotRemoteHealthRedacted = $false }',
        'Add-MonitorFailure -Message "[FAIL] turneroPilot remote health redacted (resource=$turneroPilotRemoteResource diagnosticsAuthorized=$turneroPilotRemoteDiagnosticsAuthorized)" -AllowDegraded:$AllowDegradedPublicSync',
        '$turneroPilotRemoteVerificationBlocked = (',
        'Add-MonitorFailure -Message "[FAIL] turneroPilot remote mismatch (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)" -AllowDegraded:$AllowDegradedPublicSync',
        'publicHealthRedacted = $turneroPilotRemoteHealthRedacted',
        'diagnosticsAuthorized = $turneroPilotRemoteDiagnosticsAuthorized',
        'resource = $turneroPilotRemoteResource',
        "Write-Host '[INFO] turneroPilot verify-remote omitido: perfil activo no esta en modo web_pilot.'",
        "Add-MonitorWarning -Message '[WARN] bin/turnero-clinic-profile.js no existe; se omite monitor turneroPilot.'",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet turneroPilot en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod monitor clasifica alertas GitHub de deploy dentro del mismo triage', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        "[string]$GitHubRepo = 'erosero558558/Aurora-Derm'",
        '$githubDeployAlertsSummary = Get-GitHubProductionAlertSummary',
        '[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk',
        '[WARN] github.deployAlerts unreachable (repo=$GitHubRepo error=$githubDeployAlertsError)',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts open production alerts (count=$githubDeployAlertsRelevantCount issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts transport blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts deploy connectivity blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts repair git sync blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts self-hosted runner blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync',
        'selfHostedDeployCount=$githubDeployAlertsSelfHostedDeployCount',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts self-hosted deploy blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync',
        'turneroPilotCount=$githubDeployAlertsTurneroPilotCount',
        'turneroPilotRecoveryTargets=$turneroPilotRecoveryTargetsLabel',
        'Add-MonitorFailure -Message "[FAIL] github.deployAlerts turnero pilot blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel recoveryTargets=$turneroPilotRecoveryTargetsLabel)" -AllowDegraded:$AllowDegradedPublicSync',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet GitHub deploy alerts en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod monitor expone postura auth y guardrails optativos', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        '[switch]$RequireAuthConfigured',
        '[switch]$RequireOperatorAuth',
        '[switch]$RequireAdminTwoFactor',
        '$authNode = $null',
        "$authMode = 'unknown'",
        "$authStatus = 'unknown'",
        '$authConfigured = $false',
        '$authHardeningCompliant = $false',
        "$authRecommendedMode = 'google_oauth'",
        '$authRecommendedModeActive = $false',
        '$authOperatorAuthEnabled = $false',
        '$authOperatorAuthConfigured = $false',
        '$authLegacyPasswordConfigured = $false',
        '$authTwoFactorEnabled = $false',
        '[FAIL] health.checks.auth ausente',
        '[INFO] health.auth mode=$authMode status=$authStatus configured=$authConfigured hardeningCompliant=$authHardeningCompliant recommendedMode=$authRecommendedMode recommendedModeActive=$authRecommendedModeActive operatorAuthEnabled=$authOperatorAuthEnabled operatorAuthConfigured=$authOperatorAuthConfigured legacyPasswordConfigured=$authLegacyPasswordConfigured twoFactorEnabled=$authTwoFactorEnabled',
        '[FAIL] health.auth.configured=false (mode=$authMode status=$authStatus)',
        '[FAIL] health.auth.mode=$authMode (esperado=$authRecommendedMode)',
        '[FAIL] health.auth.twoFactorEnabled=false',
        '[FAIL] health.auth.hardeningCompliant=false (mode=$authMode recommendedMode=$authRecommendedMode twoFactorEnabled=$authTwoFactorEnabled)',
        '[WARN] health.auth mode no recomendado (mode=$authMode expected=$authRecommendedMode)',
        '[WARN] health.auth legacy_password sin 2FA',
        '[WARN] health.auth hardening pendiente (mode=$authMode recommendedMode=$authRecommendedMode twoFactorEnabled=$authTwoFactorEnabled)',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet auth en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod monitor expone postura de cifrado en reposo', () => {
    const raw = load(MONITOR_PATH);
    const requiredSnippets = [
        '[switch]$RequireStoreEncryption',
        '$storageNode = $null',
        '$storeEncrypted = $false',
        '$storeEncryptionConfigured = $false',
        '$storeEncryptionRequired = $false',
        "$storeEncryptionStatus = 'unknown'",
        '$storeEncryptionCompliant = $false',
        "$storageBackend = 'unknown'",
        "$storageSource = 'unknown'",
        '[WARN] health.checks.storage ausente',
        '[FAIL] health.checks.storage ausente',
        '[INFO] health.storage backend=$storageBackend source=$storageSource encrypted=$storeEncrypted encryptionConfigured=$storeEncryptionConfigured encryptionRequired=$storeEncryptionRequired encryptionStatus=$storeEncryptionStatus encryptionCompliant=$storeEncryptionCompliant',
        '[FAIL] health.storage.encryptionCompliant=false (status=$storeEncryptionStatus configured=$storeEncryptionConfigured required=$storeEncryptionRequired)',
        '[FAIL] health.storage.encryptionCompliant=false (status=$storeEncryptionStatus configured=$storeEncryptionConfigured)',
        '[WARN] health.storage encryption no compliant (status=$storeEncryptionStatus configured=$storeEncryptionConfigured required=$storeEncryptionRequired)',
        '[OK]  health storage cifrado en reposo activo',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet storage en MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod ops readme documenta el monitor como consumidor de publicSync', () => {
    const raw = load(README_PATH);
    const requiredSnippets = [
        'MONITOR-PRODUCCION.ps1',
        'AllowDegradedPublicSync',
        'failureReason',
        'repoHygieneIssue',
        'operationallyHealthy',
        'headDrift',
        'telemetryGap',
        'dirtyPathsCount',
        'dirtyPathsSample',
        'turneroPilot',
        'verify-remote',
        'github.deployAlerts',
        'github_deploy_*',
        'checks.auth',
        'RequireAuthConfigured',
        'RequireOperatorAuth',
        'RequireAdminTwoFactor',
        'checks.storage',
        'RequireStoreEncryption',
        'storeEncryptionStatus',
        'storeEncryptionCompliant',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de documentacion del monitor en scripts/ops/prod/README.md: ${snippet}`
        );
    }
});

test('runbook enlaza el monitor con el triage canonico de public sync', () => {
    const raw = load(RUNBOOK_PATH);
    const requiredSnippets = [
        'MONITOR-PRODUCCION.ps1',
        'AllowDegradedPublicSync',
        'failureReason',
        'repoHygieneIssue',
        'headDrift',
        'telemetryGap',
        'dirtyPathsSample',
        'turneroPilot',
        'verify-remote',
        'github.deployAlerts',
        'githubDeployAlerts',
        'github_deploy_*',
        'storeEncryptionCompliant',
        'storeEncryptionStatus',
        'health-diagnostics',
        'sha256sum /root/sync-pielarmonia.sh /var/www/figo/bin/deploy-public-v3-cron-sync.sh',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del runbook para MONITOR-PRODUCCION.ps1: ${snippet}`
        );
    }
});
