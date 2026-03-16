#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const COMMON_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'Windows.Hosting.Common.ps1'
);
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
const SUPERVISOR_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'SUPERVISAR-HOSTING-WINDOWS.ps1'
);
const REPAIR_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'REPARAR-HOSTING-WINDOWS.ps1'
);
const START_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'ARRANCAR-HOSTING-WINDOWS.ps1'
);
const SMOKE_SCRIPT_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'setup',
    'SMOKE-HOSTING-WINDOWS.ps1'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('Windows V2 define modulo comun de compatibilidad para PowerShell 5.1', () => {
    const raw = load(COMMON_SCRIPT_PATH);
    const requiredSnippets = [
        'function ConvertFrom-JsonCompat',
        'function Read-HostingJsonFileSafe',
        'function Write-HostingJsonFile',
        'function Get-HostingFileSha256',
        'function Invoke-HostingHttpRequest',
        'function Invoke-HostingJsonRequest',
        'function Get-HostingProcessSnapshots',
        'Get-CimInstance Win32_Process',
        'Get-WmiObject Win32_Process',
        'tasklist.exe',
        'function Get-HostingListeningTcpEntries',
        'Get-NetTCPConnection -State Listen',
        "Invoke-HostingCommandWithOutput -FilePath $netstatCommand.Source -Arguments @('-ano', '-p', 'tcp')",
        'function Get-HostingScheduledTaskSafe',
        'function Stop-HostingScheduledTaskIfPresent',
        'function Remove-HostingScheduledTaskIfPresent',
        'schtasks.exe',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wrapper de compatibilidad Windows: ${snippet}`
        );
    }
});

test('sync V2 usa release pin, preflight y status operativo ampliado', () => {
    const raw = load(SYNC_SCRIPT_PATH);
    const requiredSnippets = [
        "[switch]$PreflightOnly",
        "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
        'Acquire-SyncLock',
        "state = 'discovering'",
        "deploy_state = 'discover'",
        "state = 'preflight'",
        "deploy_state = 'preflight'",
        'Get-GitRevisionOrThrow',
        'Invoke-ValidateMirror -CurrentTunnelId $TunnelId',
        "state = 'preflight_ready'",
        "deploy_state = 'preflight_ready'",
        "state = 'applying'",
        "deploy_state = 'apply'",
        "state = 'restarting'",
        "deploy_state = 'restart'",
        "state = 'validating'",
        "deploy_state = 'validate'",
        "state = 'rollback'",
        "deploy_state = 'rollback'",
        'desired_commit =',
        'current_commit =',
        'previous_commit =',
        'service_state =',
        'lock_owner_pid =',
        'lock_started_at =',
        'lock_age_seconds =',
        'rollback_performed = $false',
        'rollback_reason =',
        'last_successful_deploy_at =',
        'last_failure_reason =',
        'Release target bootstrapeado',
        'Desired commit {0} fallo validacion; se ejecuta rollback automatico',
        'Preflight OK: desired={0} current={1} service_state={2}',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet V2 en sync: ${snippet}`
        );
    }
});

test('config V2 registra solo supervisor y sync y mantiene repair launcher', () => {
    const raw = load(CONFIG_SCRIPT_PATH);
    const requiredSnippets = [
        "$mirrorSupervisorScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\SUPERVISAR-HOSTING-WINDOWS.ps1'",
        "$mirrorRepairScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\\ops\\setup\\REPARAR-HOSTING-WINDOWS.ps1'",
        "$supervisorTaskName = 'Pielarmonia Hosting Supervisor'",
        "$mainSyncTaskName = 'Pielarmonia Hosting Main Sync'",
        "$legacyBootTaskName = 'Pielarmonia Hosting Stack'",
        'Write-LauncherScript -Path $supervisorLauncherPath -Command $supervisorCommand',
        'Write-LauncherScript -Path $mainSyncLauncherPath -Command $mainSyncCommand',
        'Write-LauncherScript -Path $repairLauncherPath -Command $repairCommand',
        'Tarea legacy eliminada',
        'Tarea programada de supervisor instalada',
        'Tarea programada de sync instalada',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet V2 en configurador: ${snippet}`
        );
    }
});

test('repair, supervisor, start y smoke usan contrato V2 fail-safe', () => {
    const required = [
        {
            filePath: REPAIR_SCRIPT_PATH,
            snippets: [
                "[switch]$PreflightOnly",
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                "phase = 'discover'",
                "phase = 'preflight'",
                "phase = 'quiesce'",
                "phase = 'apply'",
                "phase = 'reinstall'",
                "phase = 'validate'",
                "phase = 'completed'",
                'Invoke-SyncScript -CurrentPreflightOnly',
                'Preflight de reparacion OK; no se tocaron procesos activos.',
                'Clear-HostingLocks',
                'Supervisor lanzado en la sesion actual tras la reparacion.',
                'Reparacion completada con health/auth/smoke locales en verde.',
            ],
        },
        {
            filePath: SUPERVISOR_SCRIPT_PATH,
            snippets: [
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                "[int]$LockTtlSeconds = 600",
                'Acquire-SupervisorLock',
                'Get-LockSnapshot',
                'Invoke-HostingSmoke',
                'Invoke-Repair',
                "supervisor_state = 'failed'",
                "supervisorState = if ($repairAttempted -and [string]::IsNullOrWhiteSpace($repairError))",
                'desired_commit = Get-DesiredCommit',
                'current_commit =',
                'previous_commit =',
                'lock_owner_pid =',
                'lock_started_at =',
                'lock_age_seconds =',
                'rollback_performed = $false',
                'rollback_reason =',
                'last_successful_deploy_at =',
                'last_failure_reason =',
                'Supervisor detecto degradacion persistente',
            ],
        },
        {
            filePath: START_SCRIPT_PATH,
            snippets: [
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                'function Ensure-CaddyEdge',
                'function Ensure-CloudflaredTunnel',
                'function Ensure-LocalHelper',
                'function Ensure-OperatorTransportReady',
                'Operator auth transport detectado',
                'OpenClaw auth helper omitido; transport activo:',
            ],
        },
        {
            filePath: SMOKE_SCRIPT_PATH,
            snippets: [
                "$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'",
                "$ExpectedTransport = 'web_broker'",
                '127\\.0\\.0\\.1:4173',
                '$adminJs = Invoke-TextFetch -Url "$base/admin.js"',
                '$operatorJs = Invoke-TextFetch -Url "$base/js/queue-operator.js"',
                'Smoke local OK: transport={0}',
            ],
        },
    ];

    for (const entry of required) {
        const raw = load(entry.filePath);
        for (const snippet of entry.snippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta snippet V2 en ${entry.filePath}: ${snippet}`
            );
        }
    }
});
