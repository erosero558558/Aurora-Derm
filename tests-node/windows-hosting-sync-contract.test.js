#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SYNC_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'SINCRONIZAR-HOSTING-WINDOWS.ps1'
);
const CONFIG_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'CONFIGURAR-HOSTING-WINDOWS.ps1'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('sync script usa mirror limpio con env externo, reset seguro y validacion auth', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$MirrorRepoPath = 'C:\\dev\\pielarmonia-clean-main'",
        "[string]$ExternalEnvPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\env.php'",
        "[string]$StatusPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync-status.json'",
        "[string]$LogPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\main-sync.log'",
        "$mirrorEnvPath = Join-Path $mirrorRepoPathResolved 'env.php'",
        "$mirrorStartScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\ARRANCAR-HOSTING-WINDOWS.ps1'",
        "$lockPath = $statusPathResolved + '.lock'",
        "Invoke-Git -Arguments @('clone', '--branch', $Branch, '--single-branch', $RepoUrl, $mirrorRepoPathResolved)",
        "Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'fetch', '--prune', 'origin')",
        "Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'checkout', '--force', $Branch)",
        "Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'reset', '--hard', \"origin/$Branch\")",
        'Copy-Item -LiteralPath $externalEnvPathResolved -Destination $mirrorEnvPath -Force',
        "'http://127.0.0.1/api.php?resource=health-diagnostics'",
        "'http://127.0.0.1/admin-auth.php?action=status'",
        '$status.auth_contract_ok = $authContract.Ok -eq $true',
        '$status.auth_transport = [string]$authContract.Payload.transport',
        'throw ("El contrato de auth no quedo sano en el mirror.',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del sync seguro de Windows: ${snippet}`
        );
    }
});

test('config script registra boot y sync por minuto sobre el mirror limpio', () => {
    const raw = load(CONFIG_SCRIPT_PATH);
    const requiredSnippets = [
        "[string]$MirrorRepoPath = 'C:\\dev\\pielarmonia-clean-main'",
        "[string]$ExternalEnvPath = 'C:\\ProgramData\\Pielarmonia\\hosting\\env.php'",
        "$bootstrapSyncScriptPath = Join-Path $repoRoot 'scripts\\ops\\setup\\SINCRONIZAR-HOSTING-WINDOWS.ps1'",
        "$mirrorStartScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\ARRANCAR-HOSTING-WINDOWS.ps1'",
        "$mirrorSyncScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\SINCRONIZAR-HOSTING-WINDOWS.ps1'",
        "$mainSyncLauncherPath = Join-Path $runtimeRoot 'main-sync.cmd'",
        "$mainSyncTaskName = 'Pielarmonia Hosting Main Sync'",
        'Invoke-BootstrapSync `',
        'Write-LauncherScript -Path $mainSyncLauncherPath -Command $mainSyncCommand',
        "'/SC', 'MINUTE'",
        "'/MO', '1'",
        "'/RU', 'SYSTEM'",
        "'/TR', $mainSyncLauncherCommand",
        'Write-Info "Tarea programada de sync instalada: $mainSyncTaskName"',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del configurador de Windows: ${snippet}`
        );
    }
});
