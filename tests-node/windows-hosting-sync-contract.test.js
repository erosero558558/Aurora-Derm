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
const DEPLOY_PLAYBOOK_PATH = resolve(
    REPO_ROOT,
    'docs',
    'DEPLOY_HOSTING_PLAYBOOK.md'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('sync script usa mirror limpio con env externo y reset seguro a origin/main', () => {
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
        'if ($status.cloned -or $status.head_changed -or $status.env_changed) {',
        'Invoke-StartMirrorStack `',
        "'http://127.0.0.1/api.php?resource=health-diagnostics'",
        'throw "No existe el env externo canonico: $externalEnvPathResolved"',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet del sync canonico de Windows: ${snippet}`
        );
    }
});

test('config script registra stack de boot y tarea de sync cada minuto sobre el mirror limpio', () => {
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
        'Set-Content -Path $startupCmdPath -Value "@echo off`r`n$startupCommand`r`n" -Encoding ASCII',
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

test('playbook documenta linux con public_main_sync y windows con mirror limpio + task scheduler', () => {
    const raw = load(DEPLOY_PLAYBOOK_PATH);
    const requiredSnippets = [
        'C:\\dev\\pielarmonia-clean-main',
        'C:\\ProgramData\\Pielarmonia\\hosting\\env.php',
        'Task Scheduler',
        'public_main_sync',
        'no `git pull` ni',
        'workspace de trabajo',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de runbook para el mirror limpio de Windows: ${snippet}`
        );
    }
});
