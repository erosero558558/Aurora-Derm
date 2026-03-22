#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../../.." && pwd)"

# shellcheck source=./windows-hosting-ssh-common.sh
source "${SCRIPT_DIR}/windows-hosting-ssh-common.sh"

windows_hosting_init_env
windows_hosting_resolve_expected_commit "${REPO_ROOT}"
windows_hosting_prepare_ssh
windows_hosting_warn_local_dirty_tree "${REPO_ROOT}"
windows_hosting_verify_remote_main_pin "${REPO_ROOT}"

repo_path_ps="$(windows_hosting_ps_literal "${WINDOWS_MIRROR_PATH}")"
env_path_ps="$(windows_hosting_ps_literal "${WINDOWS_ENV_PATH}")"
release_target_path_ps="$(windows_hosting_ps_literal "${WINDOWS_RELEASE_TARGET_PATH}")"
hosting_dir_ps="$(windows_hosting_ps_literal "${WINDOWS_HOSTING_DIR}")"
expected_commit_ps="$(windows_hosting_ps_literal "${WINDOWS_EXPECTED_COMMIT}")"
public_domain_ps="$(windows_hosting_ps_literal "${WINDOWS_PUBLIC_DOMAIN}")"

read -r -d '' REMOTE_SCRIPT <<'PS1' || true
$ErrorActionPreference = 'Stop'

$repoPath = '__REPO_PATH__'
$envPath = '__ENV_PATH__'
$releaseTargetPath = '__RELEASE_TARGET_PATH__'
$hostingDir = '__HOSTING_DIR__'
$expectedCommit = '__EXPECTED_COMMIT__'
$publicDomain = '__PUBLIC_DOMAIN__'
$startScriptPath = Join-Path $repoPath 'scripts\ops\setup\ARRANCAR-HOSTING-WINDOWS.ps1'
$repairScriptPath = Join-Path $repoPath 'scripts\ops\setup\REPARAR-HOSTING-WINDOWS.ps1'

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

function Invoke-ExternalCommandSection {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments = @()
    )

    $commandDisplay = $FilePath
    if ($Arguments.Count -gt 0) {
        $commandDisplay = '{0} {1}' -f $FilePath, ($Arguments -join ' ')
    }

    $LASTEXITCODE = 0
    $output = & $FilePath @Arguments 2>&1 | Out-String
    $exitCode = [int]$LASTEXITCODE
    $content = "command={0}`nexit_code={1}`n{2}" -f $commandDisplay, $exitCode, $output.Trim()
    Write-Section -Name $Name -Content $content
    if ($exitCode -ne 0) {
        throw ("{0}_failed_exit_{1}" -f $Name, $exitCode)
    }

    return [pscustomobject]@{
        Output = $output
        ExitCode = $exitCode
    }
}

function Invoke-ScriptSection {
    param(
        [string]$Name,
        [string]$ScriptPath,
        [string[]]$Arguments = @()
    )

    try {
        $output = & $ScriptPath @Arguments 2>&1 | Out-String
        $content = "script={0}`nexit_code=0`n{1}" -f $ScriptPath, $output.Trim()
        Write-Section -Name $Name -Content $content
        return [pscustomobject]@{
            Output = $output
            ExitCode = 0
        }
    } catch {
        $content = "script={0}`nexit_code=1`n{1}" -f $ScriptPath, ($_ | Out-String).Trim()
        Write-Section -Name $Name -Content $content
        throw
    }
}

function Get-JsonObjectMaybe {
    param([string]$RawContent)

    if ([string]::IsNullOrWhiteSpace($RawContent) -or
        $RawContent -eq '__MISSING__' -or
        $RawContent.StartsWith('__REQUEST_FAILED__')) {
        return $null
    }

    try {
        return ($RawContent | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Get-AuthValidation {
    param([string]$RawContent)

    $result = [ordered]@{
        ok = $false
        mode = ''
        transport = ''
        status = ''
    }

    $payload = Get-JsonObjectMaybe -RawContent $RawContent
    if ($null -eq $payload) {
        return [pscustomobject]$result
    }

    $result.mode = [string]$payload.mode
    $result.transport = [string]$payload.transport
    $result.status = [string]$payload.status
    $result.ok =
        [string]::Equals($result.mode, 'google_oauth', [System.StringComparison]::OrdinalIgnoreCase) -and
        [string]::Equals($result.transport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase) -and
        (-not [string]::Equals($result.status, 'transport_misconfigured', [System.StringComparison]::OrdinalIgnoreCase))

    return [pscustomobject]$result
}

$summary = [ordered]@{
    ok = $false
    repo_path = $repoPath
    env_path = $envPath
    release_target_path = $releaseTargetPath
    hosting_dir = $hostingDir
    public_domain = $publicDomain
    expected_commit = $expectedCommit
    repo_head_before = ''
    repo_head_after = ''
    site_root_ok = $false
    served_site_root = ''
    served_commit = ''
    caddy_runtime_config_path = ''
    main_sync_ok = $false
    auth_contract_ok = $false
    supervisor_present = $false
    supervisor_state = ''
    local_auth_ok = $false
    public_auth_ok = $false
    problems = @()
}

$problems = New-Object System.Collections.Generic.List[string]
$runtimeRaw = ''
$localAuthRaw = ''
$publicAuthRaw = ''
$repairRaw = ''
$mainSyncRaw = ''
$supervisorRaw = ''

if (-not (Test-Path -LiteralPath $repoPath)) {
    $problems.Add('mirror_repo_missing') | Out-Null
}

if (-not (Test-Path -LiteralPath $envPath)) {
    $problems.Add('external_env_missing') | Out-Null
}

if ($problems.Count -eq 0) {
    try {
        Set-Location $repoPath
        try {
            $summary.repo_head_before = [string]((git rev-parse HEAD).Trim())
        } catch {
            $problems.Add('git_head_unavailable_before') | Out-Null
        }

        if ($problems.Count -eq 0) {
            Invoke-ExternalCommandSection -Name 'git_fetch_origin' -FilePath 'git' -Arguments @('fetch', 'origin') | Out-Null
            Invoke-ExternalCommandSection -Name 'git_reset_hard_origin_main' -FilePath 'git' -Arguments @('reset', '--hard', 'origin/main') | Out-Null
            $headResult = Invoke-ExternalCommandSection -Name 'git_rev_parse_head' -FilePath 'git' -Arguments @('rev-parse', 'HEAD')
            $summary.repo_head_after = [string]($headResult.Output.Trim())

            if (-not [string]::Equals($summary.repo_head_after, $expectedCommit, [System.StringComparison]::OrdinalIgnoreCase)) {
                $problems.Add(("head_mismatch:{0}" -f $summary.repo_head_after)) | Out-Null
            }
        }

        if ($problems.Count -eq 0) {
            Invoke-ScriptSection -Name 'start_hosting' -ScriptPath $startScriptPath -Arguments @('-StopLegacy', '-ExternalEnvPath', $envPath) | Out-Null
            $runtimeRaw = Invoke-JsonRawMaybe -Url 'http://127.0.0.1/__hosting/runtime'
            Write-Section -Name 'runtime_fingerprint_pre_repair' -Content $runtimeRaw

            $runtimePayload = Get-JsonObjectMaybe -RawContent $runtimeRaw
            if ($null -eq $runtimePayload) {
                $problems.Add('runtime_fingerprint_invalid') | Out-Null
            } else {
                $summary.served_site_root = [string]$runtimePayload.site_root
                $summary.served_commit = [string]$runtimePayload.current_commit
                $summary.caddy_runtime_config_path = [string]$runtimePayload.caddy_runtime_config_path
                $summary.site_root_ok =
                    ($runtimePayload.ok -eq $true) -and
                    (Test-PathEquivalent -LeftPath $summary.served_site_root -RightPath $repoPath)
                if (-not $summary.site_root_ok) {
                    $problems.Add('site_root_mismatch') | Out-Null
                }
            }
        }

        if ($problems.Count -eq 0) {
            Invoke-ScriptSection -Name 'repair_preflight' -ScriptPath $repairScriptPath -Arguments @('-PromoteCurrentRemoteHead', '-PreflightOnly') | Out-Null
            Invoke-ScriptSection -Name 'repair_full' -ScriptPath $repairScriptPath -Arguments @('-PromoteCurrentRemoteHead') | Out-Null
        }
    } catch {
        $problems.Add(("remote_execution_failed:{0}" -f $_.Exception.Message)) | Out-Null
    }
}

$repairRaw = Read-RawMaybe -Path (Join-Path $hostingDir 'repair-hosting-status.json')
$mainSyncRaw = Read-RawMaybe -Path (Join-Path $hostingDir 'main-sync-status.json')
$supervisorRaw = Read-RawMaybe -Path (Join-Path $hostingDir 'hosting-supervisor-status.json')
$localAuthRaw = Invoke-JsonRawMaybe -Url 'http://127.0.0.1/admin-auth.php?action=status'
$publicAuthRaw = Invoke-JsonRawMaybe -Url ("https://{0}/admin-auth.php?action=status" -f $publicDomain)

$repairPayload = Get-JsonObjectMaybe -RawContent $repairRaw
$mainSyncPayload = Get-JsonObjectMaybe -RawContent $mainSyncRaw
$supervisorPayload = Get-JsonObjectMaybe -RawContent $supervisorRaw
$localAuth = Get-AuthValidation -RawContent $localAuthRaw
$publicAuth = Get-AuthValidation -RawContent $publicAuthRaw

if ($null -ne $mainSyncPayload) {
    $summary.main_sync_ok = ($mainSyncPayload.ok -eq $true)
    $summary.auth_contract_ok = ($mainSyncPayload.auth_contract_ok -eq $true)
    if (-not $summary.site_root_ok) {
        $summary.site_root_ok = ($mainSyncPayload.site_root_ok -eq $true)
    }
    if ([string]::IsNullOrWhiteSpace($summary.served_site_root)) {
        $summary.served_site_root = [string]$mainSyncPayload.served_site_root
    }
    if ([string]::IsNullOrWhiteSpace($summary.served_commit)) {
        $summary.served_commit = [string]$mainSyncPayload.served_commit
    }
    if ([string]::IsNullOrWhiteSpace($summary.caddy_runtime_config_path)) {
        $summary.caddy_runtime_config_path = [string]$mainSyncPayload.caddy_runtime_config_path
    }

    if (-not ($mainSyncPayload.ok -eq $true)) {
        $problems.Add('main_sync_not_ok') | Out-Null
    }
    if (-not ($mainSyncPayload.site_root_ok -eq $true)) {
        $problems.Add('site_root_not_ok') | Out-Null
    }
    if (-not (Test-PathEquivalent -LeftPath ([string]$mainSyncPayload.served_site_root) -RightPath $repoPath)) {
        $problems.Add('served_site_root_mismatch') | Out-Null
    }
    if (-not [string]::Equals([string]$mainSyncPayload.current_commit, $expectedCommit, [System.StringComparison]::OrdinalIgnoreCase)) {
        $problems.Add(("current_commit_mismatch:{0}" -f [string]$mainSyncPayload.current_commit)) | Out-Null
    }
    if (-not ($mainSyncPayload.auth_contract_ok -eq $true)) {
        $problems.Add('main_sync_auth_contract_invalid') | Out-Null
    }
} else {
    $problems.Add('main_sync_status_missing_or_invalid') | Out-Null
}

if ($null -ne $supervisorPayload) {
    $summary.supervisor_present = $true
    $summary.supervisor_state = [string]$supervisorPayload.supervisor_state
    if (-not (
        [string]::Equals($summary.supervisor_state, 'running', [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($summary.supervisor_state, 'recovering', [System.StringComparison]::OrdinalIgnoreCase)
    )) {
        $problems.Add(("supervisor_state_invalid:{0}" -f $summary.supervisor_state)) | Out-Null
    }
} else {
    $problems.Add('supervisor_status_missing') | Out-Null
}

$summary.local_auth_ok = $localAuth.ok
$summary.public_auth_ok = $publicAuth.ok

if (-not $summary.local_auth_ok) {
    $problems.Add(("local_auth_contract_invalid:{0}:{1}:{2}" -f $localAuth.mode, $localAuth.transport, $localAuth.status)) | Out-Null
}
if (-not $summary.public_auth_ok) {
    $problems.Add(("public_auth_contract_invalid:{0}:{1}:{2}" -f $publicAuth.mode, $publicAuth.transport, $publicAuth.status)) | Out-Null
}

Write-Section -Name 'runtime_fingerprint' -Content $runtimeRaw
Write-Section -Name 'repair_status' -Content $repairRaw
Write-Section -Name 'main_sync_status' -Content $mainSyncRaw
Write-Section -Name 'supervisor_status' -Content $supervisorRaw
Write-Section -Name 'local_auth_status' -Content $localAuthRaw
Write-Section -Name 'public_auth_status' -Content $publicAuthRaw

$summary.problems = @($problems)
$summary.ok = ($problems.Count -eq 0)
Write-Section -Name 'execution_summary' -Content ([string]($summary | ConvertTo-Json -Depth 12))

if (-not $summary.ok) {
    Write-Error ("windows_hosting_ssh_execute_failed: {0}" -f ($summary.problems -join ','))
    exit 1
}
PS1

REMOTE_SCRIPT="${REMOTE_SCRIPT//__REPO_PATH__/${repo_path_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__ENV_PATH__/${env_path_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__RELEASE_TARGET_PATH__/${release_target_path_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__HOSTING_DIR__/${hosting_dir_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__EXPECTED_COMMIT__/${expected_commit_ps}}"
REMOTE_SCRIPT="${REMOTE_SCRIPT//__PUBLIC_DOMAIN__/${public_domain_ps}}"

windows_hosting_run_remote_powershell "ejecutar_hosting_windows" "${REMOTE_SCRIPT}"
