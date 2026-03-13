#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
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
const COMMON_HTTP_PATH = resolve(REPO_ROOT, 'bin', 'powershell', 'Common.Http.ps1');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod smoke expone telemetria rica de publicSync', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
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

test('prod smoke integra github.deployAlerts en el gate cron manual', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
        "[string]$GitHubRepo = 'erosero558558/Aurora-Derm'",
        '[switch]$AllowOpenGitHubDeployAlerts',
        '$githubDeployAlerts = Get-GitHubProductionAlertSummary',
        "$githubDeployAlertsSeverity = if ($AllowOpenGitHubDeployAlerts) { 'WARN' } else { 'FAIL' }",
        '[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk repo=$GitHubRepo relevantCount=$githubDeployAlertsRelevantCount transportCount=$githubDeployAlertsTransportCount connectivityCount=$githubDeployAlertsConnectivityCount repairGitSyncCount=$githubDeployAlertsRepairGitSyncCount selfHostedRunnerCount=$githubDeployAlertsSelfHostedRunnerCount issueNumbers=$githubDeployAlertsIssueNumbersLabel issueRefs=$githubDeployAlertsIssueRefsLabel',
        '[WARN] github.deployAlerts unreachable (repo=$GitHubRepo error=$githubDeployAlertsError)',
        '[$githubDeployAlertsSeverity] github.deployAlerts open production alerts (count=$githubDeployAlertsRelevantCount issueNumbers=$githubDeployAlertsIssueNumbersLabel)',
        '[$githubDeployAlertsSeverity] github.deployAlerts self-hosted runner blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)',
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
        "$publicSyncLastErrorMessage = ''",
        "$publicSyncCurrentHead = ''",
        "$publicSyncRemoteHead = ''",
        '$publicSyncDirtyPathsCount = 0',
        '$publicSyncDirtyPathsSample = @()',
        '$publicSyncTelemetryGap = (',
        '[INFO] public sync lastErrorMessage=$publicSyncLastErrorMessage currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead headDrift=$publicSyncHeadDrift dirtyPathsCount=$publicSyncDirtyPathsCount',
        'dirtyPathsSample=$publicSyncDirtyPathsSampleLabel',
        "Asset = 'health-public-sync-working-tree-dirty'",
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

test('prod verify integra github.deployAlerts y propaga el override al smoke', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        "[string]$GitHubRepo = 'erosero558558/Aurora-Derm'",
        '[switch]$AllowOpenGitHubDeployAlerts',
        '$githubDeployAlerts = Get-GitHubProductionAlertSummary',
        "[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk repo=$GitHubRepo relevantCount=$githubDeployAlertsRelevantCount transportCount=$githubDeployAlertsTransportCount connectivityCount=$githubDeployAlertsConnectivityCount repairGitSyncCount=$githubDeployAlertsRepairGitSyncCount selfHostedRunnerCount=$githubDeployAlertsSelfHostedRunnerCount issueNumbers=$githubDeployAlertsIssueNumbersLabel issueRefs=$githubDeployAlertsIssueRefsLabel",
        "Asset = 'github-deploy-alerts-open'",
        "Asset = 'github-deploy-transport-blocked'",
        "Asset = 'github-deploy-connectivity-blocked'",
        '-GitHubRepo $GitHubRepo',
        '-AllowOpenGitHubDeployAlerts:$AllowOpenGitHubDeployAlerts',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet github.deployAlerts en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
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
        'public_main_sync',
        'dirtyPathsCount',
        'dirtyPathsSample',
        'github.deployAlerts',
        'AllowOpenGitHubDeployAlerts',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de documentacion publicSync en scripts/ops/prod/README.md: ${snippet}`
        );
    }
});

test('prod verify expone diagnostico por asset cuando falla cache-header', () => {
    const raw = load(COMMON_HTTP_PATH);
    const requiredSnippets = [
        'Write-Host "[FAIL] No se pudo validar Cache-Control del asset: $($assetCheck.Name)"',
        'Write-Host "       Url          : $($assetCheck.Url)"',
        'Write-Host "       Error        : $errorSummary"',
        '$errorSummary = ([string]$_.Exception.Message).Trim()',
        "$errorSummary = 'unknown_request_error'",
        '$errorSummary = ($errorSummary -replace \'\\s+\', \' \')',
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
