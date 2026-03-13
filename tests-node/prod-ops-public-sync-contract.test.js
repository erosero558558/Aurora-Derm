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
        "$authRecommendedMode = 'openclaw_chatgpt'",
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
