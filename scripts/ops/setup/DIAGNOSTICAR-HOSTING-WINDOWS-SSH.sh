#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"

# shellcheck source=./windows-hosting-ssh-common.sh
source "${SCRIPT_DIR}/windows-hosting-ssh-common.sh"

windows_hosting_init_env
windows_hosting_prepare_ssh
windows_hosting_warn_local_dirty_tree "${REPO_ROOT}"
windows_hosting_verify_remote_main_pin "${REPO_ROOT}"

repo_path_ps="$(windows_hosting_ps_literal "${WINDOWS_MIRROR_PATH}")"
env_path_ps="$(windows_hosting_ps_literal "${WINDOWS_ENV_PATH}")"
hosting_dir_ps="$(windows_hosting_ps_literal "${WINDOWS_HOSTING_DIR}")"
expected_commit_ps="$(windows_hosting_ps_literal "${WINDOWS_EXPECTED_COMMIT}")"
public_domain_ps="$(windows_hosting_ps_literal "${WINDOWS_PUBLIC_DOMAIN}")"

read -r -d '' REMOTE_SCRIPT <<'PS1' || true
$ErrorActionPreference = 'Stop'

$repoPath = '__REPO_PATH__'
$envPath = '__ENV_PATH__'
$hostingDir = '__HOSTING_DIR__'
$expectedCommit = '__EXPECTED_COMMIT__'
$publicDomain = '__PUBLIC_DOMAIN__'

function Normalize-PathText {
    param([string]$PathText)

    if ([string]::IsNullOrWhiteSpace($PathText)) {
        return ''
    }

    try {
        $resolved = [System.IO.Path]::GetFullPath($PathText)
    } catch {
        $resolved = $PathText
    }

    return ($resolved.TrimEnd('\', '/')).Replace('/', '\').ToLowerInvariant()
}

function Test-PathEquivalent {
    param(
        [string]$LeftPath,
        [string]$RightPath
    )

    $left = Normalize-PathText -PathText $LeftPath
    $right = Normalize-PathText -PathText $RightPath
    return (-not [string]::IsNullOrWhiteSpace($left)) -and ($left -eq $right)
}

function Write-Section {
    param(
        [string]$Name,
        [string]$Content
    )

    Write-Host "===BEGIN:${Name}==="
    if ($null -ne $Content) {
        Write-Host $Content
    }
    Write-Host "===END:${Name}==="
}

function Read-RawMaybe {
    param([string]$Path)

    if (Test-Path -LiteralPath $Path) {
        return [string](Get-Content -LiteralPath $Path -Raw)
    }

    return '__MISSING__'
}

function Invoke-JsonRawMaybe {
    param([string]$Url)

    try {
        return [string]((Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20).Content)
    } catch {
        return "__REQUEST_FAILED__: $($_.Exception.Message)"
    }
}

function Test-AuthPayload {
    param([string]$RawContent)

    if ([string]::IsNullOrWhiteSpace($RawContent) -or $RawContent.StartsWith('__REQUEST_FAILED__')) {
        return $false
    }

    try {
        $payload = $RawContent | ConvertFrom-Json
    } catch {
        return $false
    }

    return
        [string]::Equals([string]$payload.mode, 'openclaw_chatgpt', [System.StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals([string]$payload.transport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase) -and
        (-not [string]::Equals([string]$payload.status, 'transport_misconfigured', [System.StringComparison]::OrdinalIgnoreCase))
}

$summary = [ordered]@{
    ok = $false
    repo_path = $repoPath
    env_path = $envPath
    hosting_dir = $hostingDir
    expected_commit = $expectedCommit
    powershell_version = $PSVersionTable.PSVersion.ToString()
    repo_head = ''
    runtime_ok = $false
    local_auth_ok = $false
    public_auth_ok = $false
    problems = @()
}

$problems = New-Object System.Collections.Generic.List[string]
$runtimeRaw = ''
$localAuthRaw = ''
$publicAuthRaw = ''
$mainSyncRaw = ''
$repairRaw = ''
$supervisorRaw = ''

if (-not (Test-Path -LiteralPath $repoPath)) {
    $problems.Add('mirror_repo_missing') | Out-Null
} else {
    Set-Location $repoPath
    try {
        $summary.repo_head = [string]((git rev-parse HEAD).Trim())
    } catch {
        $problems.Add('git_head_unavailable') | Out-Null
    }

    if (-not [string]::Equals($summary.repo_head, $expectedCommit, [System.StringComparison]::OrdinalIgnoreCase)) {
        $problems.Add(("head_mismatch:{0}" -f $summary.repo_head)) | Out-Null
    }
}

if (-not (Test-Path -LiteralPath $envPath)) {
    $problems.Add('external_env_missing') | Out-Null
}

$runtimeRaw = Invoke-JsonRawMaybe -Url 'http://127.0.0.1/__hosting/runtime'
if (-not $runtimeRaw.StartsWith('__REQUEST_FAILED__')) {
    try {
        $runtimePayload = $runtimeRaw | ConvertFrom-Json
        $summary.runtime_ok =
            ($runtimePayload.ok -eq $true) -and
            (Test-PathEquivalent -LeftPath ([string]$runtimePayload.site_root) -RightPath $repoPath)
        if (-not $summary.runtime_ok) {
            $problems.Add('site_root_mismatch') | Out-Null
        }
    } catch {
        $problems.Add('runtime_fingerprint_invalid') | Out-Null
    }
} else {
    $problems.Add('runtime_fingerprint_unavailable') | Out-Null
}

$localAuthRaw = Invoke-JsonRawMaybe -Url 'http://127.0.0.1/admin-auth.php?action=status'
$summary.local_auth_ok = Test-AuthPayload -RawContent $localAuthRaw
if (-not $summary.local_auth_ok) {
    $problems.Add('local_auth_contract_invalid') | Out-Null
}

$publicAuthRaw = Invoke-JsonRawMaybe -Url ("https://{0}/admin-auth.php?action=status" -f $publicDomain)
$summary.public_auth_ok = Test-AuthPayload -RawContent $publicAuthRaw
if (-not $summary.public_auth_ok) {
    $problems.Add('public_auth_contract_invalid') | Out-Null
}

$repairRaw = Read-RawMaybe -Path (Join-Path $hostingDir 'repair-hosting-status.json')
$mainSyncRaw = Read-RawMaybe -Path (Join-Path $hostingDir 'main-sync-status.json')
$supervisorRaw = Read-RawMaybe -Path (Join-Path $hostingDir 'hosting-supervisor-status.json')

$summary.problems = @($problems)
$summary.ok = ($problems.Count -eq 0)

Write-Section -Name 'runtime_fingerprint' -Content $runtimeRaw
Write-Section -Name 'local_auth_status' -Content $localAuthRaw
Write-Section -Name 'public_auth_status' -Content $publicAuthRaw
Write-Section -Name 'repair_status' -Content $repairRaw
Write-Section -Name 'main_sync_status' -Content $mainSyncRaw
Write-Section -Name 'supervisor_status' -Content $supervisorRaw
Write-Section -Name 'diagnostic_summary' -Content ([string]($summary | ConvertTo-Json -Depth 10))

if (-not $summary.ok) {
    Write-Error ("windows_hosting_ssh_diagnostic_failed: {0}" -f ($summary.problems -join ','))
    exit 1
}
PS1

REMOTE_SCRIPT="${REMOTE_SCRIPT//__REPO_PATH__/${repo_path_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__ENV_PATH__/${env_path_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__HOSTING_DIR__/${hosting_dir_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__EXPECTED_COMMIT__/${expected_commit_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__PUBLIC_DOMAIN__/${public_domain_ps}}"

windows_hosting_run_remote_powershell "diagnosticar_hosting_windows" "${REMOTE_SCRIPT}"
