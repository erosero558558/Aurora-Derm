#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SMOKE_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'SMOKE-PRODUCCION.ps1'
);
const VERIFY_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'VERIFICAR-DESPLIEGUE.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');
const COMMON_HTTP_PATH = resolve(
    REPO_ROOT,
    'bin',
    'powershell',
    'Common.Http.ps1'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod smoke expone telemetria rica de publicSync', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
        'resource=health-diagnostics',
        "$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'",
        "$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'",
        '. $commonHttpPath',
        "$lastErrorMessage = ''",
        "$currentHead = ''",
        "$remoteHead = ''",
        '$dirtyPathsCount = 0',
        '$dirtyPathsSample = @()',
        '$telemetryGap = (',
        '[INFO] checks.publicSync state=$state lastErrorMessage=$lastErrorMessage currentHead=$currentHead remoteHead=$remoteHead headDrift=$headDrift dirtyPathsCount=$dirtyPathsCount',
        'dirtyPathsSample=$dirtyPathsSampleLabel',
        'checks.publicSync.healthy=false (state=$state, lastErrorMessage=$lastErrorMessage, dirtyPathsCount=$dirtyPathsCount)',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet publicSync en SMOKE-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod smoke integra verify-remote del piloto web por clínica en la corrida manual', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
        '$turneroPilotVerifyRequired = $false',
        '$turneroPilotRecoveryTargets = @()',
        "$turneroPilotRecoveryTargetsLabel = 'none'",
        "Write-Host '[FAIL] turneroPilot clinic-profile status unresolved'",
        'Write-Host "[FAIL] turneroPilot catalog drift (clinicId=$turneroPilotClinicId)"',
        "'[ALERTA PROD] Deploy Hosting turneroPilot bloqueado'",
        "'[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'",
        '[INFO] turneroPilot clinicId=$turneroPilotClinicId catalogMatch=$turneroPilotCatalogMatch',
        '& node $turneroClinicProfileScriptPath verify-remote --base-url $base --json 2>&1',
        '[INFO] turneroPilot remote clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady',
        '[INFO] turneroPilot recoveryTargets=$turneroPilotRecoveryTargetsLabel',
        'Write-Host "[FAIL] turneroPilot remote mismatch (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)"',
        "Write-Host '[INFO] turneroPilot verify-remote omitido: perfil activo no esta en modo web_pilot.'",
        "Write-Host '[WARN] bin/turnero-clinic-profile.js no existe; se omite smoke turneroPilot.'",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet turneroPilot en SMOKE-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod smoke integra github.deployAlerts en el gate cron manual', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
        "[string]$GitHubRepo = 'erosero558558/Aurora-Derm'",
        '[switch]$AllowOpenGitHubDeployAlerts',
        '$githubDeployAlerts = Get-GitHubProductionAlertSummary',
        "$githubDeployAlertsSeverity = if ($AllowOpenGitHubDeployAlerts) { 'WARN' } else { 'FAIL' }",
        '[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk repo=$GitHubRepo relevantCount=$githubDeployAlertsRelevantCount transportCount=$githubDeployAlertsTransportCount connectivityCount=$githubDeployAlertsConnectivityCount repairGitSyncCount=$githubDeployAlertsRepairGitSyncCount selfHostedRunnerCount=$githubDeployAlertsSelfHostedRunnerCount selfHostedDeployCount=$githubDeployAlertsSelfHostedDeployCount turneroPilotCount=$githubDeployAlertsTurneroPilotCount turneroPilotRecoveryTargets=$turneroPilotRecoveryTargetsLabel issueNumbers=$githubDeployAlertsIssueNumbersLabel issueRefs=$githubDeployAlertsIssueRefsLabel',
        '[WARN] github.deployAlerts unreachable (repo=$GitHubRepo error=$githubDeployAlertsError)',
        '[$githubDeployAlertsSeverity] github.deployAlerts open production alerts (count=$githubDeployAlertsRelevantCount issueNumbers=$githubDeployAlertsIssueNumbersLabel)',
        '[$githubDeployAlertsSeverity] github.deployAlerts self-hosted runner blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)',
        'selfHostedDeployCount=$githubDeployAlertsSelfHostedDeployCount',
        '[$githubDeployAlertsSeverity] github.deployAlerts self-hosted deploy blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)',
        '[$githubDeployAlertsSeverity] github.deployAlerts turnero pilot blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel recoveryTargets=$turneroPilotRecoveryTargetsLabel)',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet github.deployAlerts en SMOKE-PRODUCCION.ps1: ${snippet}`
        );
    }
});
test('prod verify propaga telemetria de publicSync a resultados y consola', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        'resource=health-diagnostics',
        "$publicSyncLastErrorMessage = ''",
        "$publicSyncCurrentHead = ''",
        "$publicSyncRemoteHead = ''",
        '$publicSyncDirtyPathsCount = 0',
        '$publicSyncDirtyPathsSample = @()',
        '$publicSyncTelemetryGap = (',
        '[WARN] health no incluye checks.publicSync; el host probablemente sigue con HealthController stale',
        '[INFO] public sync lastErrorMessage=$publicSyncLastErrorMessage currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead headDrift=$publicSyncHeadDrift dirtyPathsCount=$publicSyncDirtyPathsCount',
        'dirtyPathsSample=$publicSyncDirtyPathsSampleLabel',
        "Asset = 'health-public-sync-working-tree-dirty'",
        "Detail = 'health publico sin checks.publicSync; desplegar controllers/HealthController.php actualizado antes de clasificar public_main_sync'",
        'RemoteHash = if ($publicSyncState) { "${publicSyncState}:$publicSyncLastErrorMessage" } else { \'false\' }',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet publicSync en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod verify expone postura auth y assets de enforcement', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        '[switch]$RequireAuthConfigured',
        '[switch]$RequireOperatorAuth',
        '[switch]$RequireAdminTwoFactor',
        "'authMode'",
        "'authStatus'",
        "'authConfigured'",
        "'authHardeningCompliant'",
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
        '[WARN] health no incluye checks.auth',
        '[INFO] health auth mode=$authMode status=$authStatus configured=$authConfigured hardeningCompliant=$authHardeningCompliant recommendedMode=$authRecommendedMode recommendedModeActive=$authRecommendedModeActive operatorAuthEnabled=$authOperatorAuthEnabled operatorAuthConfigured=$authOperatorAuthConfigured legacyPasswordConfigured=$authLegacyPasswordConfigured twoFactorEnabled=$authTwoFactorEnabled',
        "Asset = 'health-auth-missing'",
        "Asset = 'health-auth-configured'",
        "Asset = 'health-auth-mode'",
        "Asset = 'health-auth-2fa'",
        "Asset = 'health-auth-hardening'",
        '[WARN] health auth mode no recomendado (mode=$authMode expected=$authRecommendedMode)',
        '[WARN] health auth legacy_password sin 2FA',
        '[WARN] health auth hardening pendiente',
        "[string]$GitHubRepo = 'erosero558558/Aurora-Derm'",
        '[switch]$AllowOpenGitHubDeployAlerts',
        '$githubDeployAlerts = Get-GitHubProductionAlertSummary',
        '[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk repo=$GitHubRepo relevantCount=$githubDeployAlertsRelevantCount transportCount=$githubDeployAlertsTransportCount connectivityCount=$githubDeployAlertsConnectivityCount repairGitSyncCount=$githubDeployAlertsRepairGitSyncCount selfHostedRunnerCount=$githubDeployAlertsSelfHostedRunnerCount selfHostedDeployCount=$githubDeployAlertsSelfHostedDeployCount turneroPilotCount=$githubDeployAlertsTurneroPilotCount turneroPilotRecoveryTargets=$turneroPilotRecoveryTargetsLabel issueNumbers=$githubDeployAlertsIssueNumbersLabel issueRefs=$githubDeployAlertsIssueRefsLabel',
        "Asset = 'github-deploy-alerts-open'",
        "Asset = 'github-deploy-transport-blocked'",
        "Asset = 'github-deploy-connectivity-blocked'",
        "Asset = 'github-deploy-self-hosted-deploy-blocked'",
        "Asset = 'github-deploy-turnero-pilot-blocked'",
        '-GitHubRepo $GitHubRepo',
        '-AllowOpenGitHubDeployAlerts:$AllowOpenGitHubDeployAlerts',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet auth en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod verify expone postura de cifrado en reposo y assets de enforcement', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        '[switch]$RequireStoreEncryption',
        "'storeEncryptionConfigured'",
        "'storeEncryptionRequired'",
        "'storeEncryptionStatus'",
        "'storeEncryptionCompliant'",
        '$storageNode = $null',
        '$storeEncrypted = $false',
        '$storeEncryptionConfigured = $false',
        '$storeEncryptionRequired = $false',
        "$storeEncryptionStatus = 'unknown'",
        '$storeEncryptionCompliant = $false',
        "$storageBackend = 'unknown'",
        "$storageSource = 'unknown'",
        '[WARN] health no incluye checks.storage',
        '[INFO] health storage backend=$storageBackend source=$storageSource encrypted=$storeEncrypted encryptionConfigured=$storeEncryptionConfigured encryptionRequired=$storeEncryptionRequired encryptionStatus=$storeEncryptionStatus encryptionCompliant=$storeEncryptionCompliant',
        "Asset = 'health-store-encryption-missing'",
        "Asset = 'health-store-encryption-compliant'",
        '[WARN] health storage encryption no compliant',
        '[OK]  health storage cifrado en reposo activo',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet storage en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod verify corre verify-remote del piloto web por clínica cuando el perfil activo lo exige', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        "$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'",
        '$turneroPilotVerifyRequired = $false',
        '$turneroPilotRecoveryTargets = @()',
        "$turneroPilotRecoveryTargetsLabel = 'none'",
        "Asset = 'turnero-pilot-profile-status'",
        "Asset = 'turnero-pilot-remote-verify'",
        "$turneroPilotProfileFingerprint = ''",
        "'[ALERTA PROD] Deploy Hosting turneroPilot bloqueado'",
        "'[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'",
        '[INFO] turnero pilot profile active clinicId=$turneroPilotClinicId catalogMatch=$turneroPilotCatalogMatch',
        '[INFO] turnero pilot remote clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady deployedCommit=$turneroPilotRemoteDeployedCommit',
        '[INFO] turnero pilot recoveryTargets=$turneroPilotRecoveryTargetsLabel',
        '& node $turneroClinicProfileScriptPath verify-remote --base-url $base --json 2>&1',
        '$verifyMetadata = [ordered]@{',
        'turneroPilot = [pscustomobject]$turneroPilotReport',
        'recoveryTargets = @($turneroPilotRecoveryTargets)',
        '-Metadata $verifyMetadata',
        "Write-Host '[INFO] turnero pilot verify-remote omitido: perfil activo no esta en modo web_pilot.'",
        "Write-Host '[WARN] bin/turnero-clinic-profile.js no existe; se omite verify-remote del piloto.'",
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet turneroPilot verify-remote en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod ops readme documenta triage de publicSync', () => {
    const raw = load(README_PATH);
    const requiredSnippets = [
        'REPORTE-SEMANAL-PRODUCCION.ps1',
        'SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1',
        'checks.publicSync',
        'checks.auth',
        'public_main_sync',
        'dirtyPathsCount',
        'dirtyPathsSample',
        'health-auth-*',
        'RequireOperatorAuth',
        'RequireAdminTwoFactor',
        'checks.storage',
        'RequireStoreEncryption',
        'health-store-encryption-*',
        'storeEncryptionCompliant',
        'github.deployAlerts',
        'AllowOpenGitHubDeployAlerts',
        'turnero-pilot-remote-verify',
        'turnero pilot blocked',
        'verify-remote',
        'clinic-profile',
        'turneroPilot',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de documentacion publicSync en scripts/ops/prod/README.md: ${snippet}`
        );
    }
});

test('HealthController expone checks.publicSync en health publico sin rutas internas', () => {
    const phpScript = `
        $tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'health-public-sync-' . bin2hex(random_bytes(6));
        mkdir($tempDir, 0777, true);
        putenv('PIELARMONIA_DATA_DIR=' . $tempDir);
        ini_set('log_errors', '1');
        ini_set('error_log', $tempDir . DIRECTORY_SEPARATOR . 'php-error.log');
        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }
        require 'api-lib.php';
        require 'controllers/HealthController.php';
        ensure_data_file();
        try {
            HealthController::check([
                'store' => read_store(),
                'requestStartedAt' => microtime(true),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => false,
            ]);
        } catch (TestingExitException $e) {
            echo json_encode($e->payload);
        }
    `;

    const result = spawnSync('php', ['-r', phpScript], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);

    const payload = JSON.parse(result.stdout);
    const snapshot = payload?.checks?.publicSync;

    assert.equal(payload.ok, true);
    assert.equal(payload.status, 'ok');
    assert.equal(snapshot?.configured, true);
    assert.equal(snapshot?.jobId, '8d31e299-7e57-4959-80b5-aaa2d73e9674');
    assert.equal(typeof snapshot?.healthy, 'boolean');
    assert.equal(typeof snapshot?.repoHygieneIssue, 'boolean');
    assert.equal(typeof snapshot?.state, 'string');
    assert.equal(typeof snapshot?.expectedMaxLagSeconds, 'number');
    assert.equal(Array.isArray(snapshot?.dirtyPathsSample), true);
    assert.equal('repoPath' in snapshot, false);
    assert.equal('statusPath' in snapshot, false);
    assert.equal('logPath' in snapshot, false);
    assert.equal('lockFile' in snapshot, false);
    assert.equal('dirtyPaths' in snapshot, false);
});

test('prod verify expone diagnostico por asset cuando falla cache-header', () => {
    const raw = load(COMMON_HTTP_PATH);
    const requiredSnippets = [
        'Write-Host "[FAIL] No se pudo validar Cache-Control del asset: $($assetCheck.Name)"',
        'Write-Host "       Url          : $($assetCheck.Url)"',
        'Write-Host "       Error        : $errorSummary"',
        '$errorSummary = ([string]$_.Exception.Message).Trim()',
        "$errorSummary = 'unknown_request_error'",
        "$errorSummary = ($errorSummary -replace '\\s+', ' ')",
        'RemoteHash = "request_error:$errorSummary"',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta diagnostico por asset en Common.Http.ps1: ${snippet}`
        );
    }
});

test('common http clasifica self-hosted route como deploy alert operativo', () => {
    const raw = load(COMMON_HTTP_PATH);
    const requiredSnippets = [
        'selfHostedDeployCount = 0',
        'hasSelfHostedDeployBlock = $false',
        "$labelValues -contains 'self-hosted-route'",
        "$categories.Add('self-hosted-deploy') | Out-Null",
        '$summary.selfHostedDeployCount++',
        '$summary.hasSelfHostedDeployBlock = [bool]($summary.selfHostedDeployCount -gt 0)',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta clasificacion self-hosted deploy en Common.Http.ps1: ${snippet}`
        );
    }
});
