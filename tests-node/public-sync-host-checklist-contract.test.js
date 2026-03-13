#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'CHECKLIST-HOST-PUBLIC-SYNC.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const RUNBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'PUBLIC_MAIN_UPDATE_RUNBOOK.md'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('public sync host checklist script expone comandos canonicos de triage host-side', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$RepoPath = '/var/www/figo'",
        "[string]$WrapperPath = '/root/sync-pielarmonia.sh'",
        "[string]$CanonicalWrapperPath = '/var/www/figo/bin/deploy-public-v3-cron-sync.sh'",
        "[string]$StatusPath = '/var/lib/pielarmonia/public-sync-status.json'",
        "[string]$LogPath = '/var/log/sync-pielarmonia.log'",
        "[string]$DiagnosticsUrl = 'http://127.0.0.1/api.php?resource=health-diagnostics'",
        'sha256sum $WrapperPath $CanonicalWrapperPath',
        'cmp -s $WrapperPath $CanonicalWrapperPath && echo wrapper_match || echo wrapper_diff',
        'git status --short',
        'git rev-parse HEAD',
        'git rev-parse origin/main',
        "curl -s $DiagnosticsUrl | jq '.checks.publicSync | {configured, jobId, state, healthy, operationallyHealthy, repoHygieneIssue, ageSeconds, expectedMaxLagSeconds, lastCheckedAt, lastSuccessAt, lastErrorAt, failureReason, lastErrorMessage, currentHead, remoteHead, dirtyPathsCount, dirtyPathsSample}'",
        "curl -s $DiagnosticsUrl | jq '.checks.storage | {backend, source, encrypted, encryptionConfigured, encryptionRequired, encryptionStatus, encryptionCompliant}'",
        "curl -s $DiagnosticsUrl | jq '.checks.auth | {mode, status, configured, hardeningCompliant, recommendedMode, recommendedModeActive, twoFactorEnabled, operatorAuthEnabled, operatorAuthConfigured, legacyPasswordConfigured}'",
        'install -m 0755 $CanonicalWrapperPath $WrapperPath',
        '/usr/bin/flock -n $LockPath $WrapperPath',
        'PIELARMONIA_DATA_ENCRYPTION_KEY',
        'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
        'checks.storage.encryptionCompliant=true',
        'checks.publicSync.telemetryGap=false',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet canonico en CHECKLIST-HOST-PUBLIC-SYNC.ps1: ${snippet}`
        );
    }
});

test('surface operativa documenta el checklist host-side de public sync', () => {
    const readme = load(README_PATH);
    const operationsIndex = load(OPERATIONS_INDEX_PATH);
    const runbook = load(RUNBOOK_PATH);
    const requiredReadmeSnippets = [
        'CHECKLIST-HOST-PUBLIC-SYNC.ps1',
        'npm run checklist:prod:public-sync:host',
        'public-sync-status.json',
        'storeEncryptionCompliant',
    ];
    const requiredOperationsSnippets = [
        'npm run checklist:prod:public-sync:host',
        'CHECKLIST-HOST-PUBLIC-SYNC.ps1',
    ];
    const requiredRunbookSnippets = [
        'pwsh -File scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1',
        'storeEncryptionCompliant=true',
    ];

    for (const snippet of requiredReadmeSnippets) {
        assert.equal(
            readme.includes(snippet),
            true,
            `README de prod ops debe documentar checklist host-side: ${snippet}`
        );
    }

    for (const snippet of requiredOperationsSnippets) {
        assert.equal(
            operationsIndex.includes(snippet),
            true,
            `Operations Index debe documentar checklist host-side: ${snippet}`
        );
    }

    for (const snippet of requiredRunbookSnippets) {
        assert.equal(
            runbook.includes(snippet),
            true,
            `Runbook debe enlazar checklist host-side: ${snippet}`
        );
    }
});

test('package.json expone checklist host-side como script npm canonico', () => {
    const pkg = JSON.parse(load(resolve(REPO_ROOT, 'package.json')));
    assert.equal(
        String(pkg.scripts?.['checklist:prod:public-sync:host'] || '').includes(
            './scripts/ops/prod/CHECKLIST-HOST-PUBLIC-SYNC.ps1'
        ),
        true,
        'package.json debe exponer checklist:prod:public-sync:host con el entrypoint canonico'
    );
});
