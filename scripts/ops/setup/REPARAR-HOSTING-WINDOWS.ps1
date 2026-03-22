param(
    [string]$MirrorRepoPath = 'C:\dev\pielarmonia-clean-main',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$ReleaseTargetPath = 'C:\ProgramData\Pielarmonia\hosting\release-target.json',
    [string]$StatusPath = 'C:\ProgramData\Pielarmonia\hosting\repair-hosting-status.json',
    [string]$LogPath = 'C:\ProgramData\Pielarmonia\hosting\repair-hosting.log',
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [string]$CaddyExePath = '',
    [string]$CloudflaredExePath = '',
    [string]$PhpCgiExePath = '',
    [string]$TargetCommit = '',
    [switch]$PromoteCurrentRemoteHead,
    [switch]$PreflightOnly,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'
if (-not (Test-Path -LiteralPath $commonScriptPath)) {
    throw "No existe el modulo comun de hosting Windows: $commonScriptPath"
}
. $commonScriptPath

$mirrorRepoPathResolved = [System.IO.Path]::GetFullPath($MirrorRepoPath)
$externalEnvPathResolved = [System.IO.Path]::GetFullPath($ExternalEnvPath)
$releaseTargetPathResolved = [System.IO.Path]::GetFullPath($ReleaseTargetPath)
$statusPathResolved = [System.IO.Path]::GetFullPath($StatusPath)
$logPathResolved = [System.IO.Path]::GetFullPath($LogPath)
$runtimePaths = Get-HostingRuntimePaths -RepoRoot $mirrorRepoPathResolved
$expectedCaddyRuntimeConfigPath = [string]$runtimePaths.CaddyRuntimeConfigPath
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}
$syncScriptPath = Join-Path $repoRoot 'scripts\ops\setup\SINCRONIZAR-HOSTING-WINDOWS.ps1'
$configScriptPath = Join-Path $repoRoot 'scripts\ops\setup\CONFIGURAR-HOSTING-WINDOWS.ps1'
$smokeScriptPath = Join-Path $repoRoot 'scripts\ops\setup\SMOKE-HOSTING-WINDOWS.ps1'
$supervisorLauncherPath = Join-Path $mirrorRepoPathResolved 'data\runtime\hosting\supervisor.cmd'
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source
$gitExe = (Get-Command git -ErrorAction Stop).Source
$taskNames = @(
    'Pielarmonia Hosting Supervisor',
    'Pielarmonia Hosting Main Sync',
    'Pielarmonia Hosting Stack'
)
$arrancarTimeoutSeconds = 90
$syncPreflightTimeoutSeconds = 90
$syncApplyTimeoutSeconds = 240
$configTimeoutSeconds = 90
$smokeTimeoutSeconds = 45
$supervisorReadyTimeoutSeconds = 60

function Write-Info {
    param([string]$Message)

    $line = ('[{0}] {1}' -f ([DateTimeOffset]::Now.ToString('o')), $Message)
    Ensure-HostingParentDirectory -Path $logPathResolved
    Add-Content -Path $logPathResolved -Value $line -Encoding ASCII
    if (-not $Quiet) {
        Write-Host "[hosting-repair] $Message"
    }
}

function Invoke-Git {
    param([string[]]$Arguments)

    return Invoke-HostingCommandWithOutput -FilePath $gitExe -Arguments $Arguments
}

function Write-Status {
    param([hashtable]$Payload)

    $Payload.timestamp = [DateTimeOffset]::Now.ToString('o')
    Write-HostingJsonFile -Path $statusPathResolved -Payload $Payload
}

function Get-CurrentCommitSafe {
    param([string]$RepoPath)

    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
        return ''
    }

    $result = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', 'HEAD')
    if ($result.ExitCode -ne 0) {
        return ''
    }

    return [string]$result.Output.Trim()
}

function Resolve-RemoteHead {
    param(
        [string]$RepoPath,
        [string]$BranchName
    )

    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
        throw "No existe el mirror git para resolver remote head: $RepoPath"
    }

    $fetchResult = Invoke-Git -Arguments @('-C', $RepoPath, 'fetch', '--prune', 'origin')
    if ($fetchResult.ExitCode -ne 0) {
        throw ("No se pudo refrescar origin antes de promocionar remote head. {0}" -f $fetchResult.Output.Trim())
    }

    $revParse = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', "origin/$BranchName")
    if ($revParse.ExitCode -ne 0) {
        throw ("No se pudo resolver origin/{0}. {1}" -f $BranchName, $revParse.Output.Trim())
    }

    return [string]$revParse.Output.Trim()
}

function Get-ServiceStateSafe {
    param([string]$CurrentTunnelId)

    $phpProcesses = Get-HostingProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000')
    $caddyProcesses = Get-HostingProcessesByNeedle -Needles @('caddy.exe', 'run')
    $cloudflaredProcesses = Get-HostingProcessesByNeedle -Needles @('cloudflared.exe', $CurrentTunnelId, '--url http://127.0.0.1')

    if (($phpProcesses.Count -gt 0) -and ($caddyProcesses.Count -gt 0) -and ($cloudflaredProcesses.Count -gt 0)) {
        return 'running'
    }
    if (($phpProcesses.Count + $caddyProcesses.Count + $cloudflaredProcesses.Count) -gt 0) {
        return 'degraded'
    }
    return 'stopped'
}

function Invoke-LocalAuthContract {
    $response = Invoke-HostingJsonRequest `
        -Url 'http://127.0.0.1/admin-auth.php?action=status' `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec 15

    $payload = $response.Payload
    $ok =
        $response.Ok -and
        ([string]$payload.mode -eq 'google_oauth') -and
        ([string]$payload.transport -eq 'web_broker') -and
        ([string]$payload.status -ne 'transport_misconfigured')

    $authMode = ''
    $authTransport = ''
    $authStatus = ''
    if ($null -ne $payload) {
        $authMode = [string]$payload.mode
        $authTransport = [string]$payload.transport
        $authStatus = [string]$payload.status
    }
    $authError = ''
    if (-not $ok) {
        if (-not [string]::IsNullOrWhiteSpace($response.Error)) {
            $authError = $response.Error
        } else {
            $authError = 'Contrato Operator Auth invalido.'
        }
    }

    return [PSCustomObject]@{
        Ok = $ok
        Mode = $authMode
        Transport = $authTransport
        Status = $authStatus
        Error = $authError
    }
}

function Invoke-LocalHealthCheck {
    $response = Invoke-HostingJsonRequest `
        -Url 'http://127.0.0.1/api.php?resource=health-diagnostics' `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec 15

    $healthError = ''
    if ((-not $response.Ok) -and (-not [string]::IsNullOrWhiteSpace($response.Error))) {
        $healthError = $response.Error
    }

    return [PSCustomObject]@{
        Ok = ($response.Ok -and $response.Payload.ok -eq $true)
        Error = $healthError
    }
}

function Invoke-LocalRuntimeFingerprintStatus {
    param([string]$ExpectedDesiredCommit = '')

    $fingerprint = Invoke-HostingRuntimeFingerprint -BaseUrl 'http://127.0.0.1' -TimeoutSec 10
    return (Test-HostingRuntimeFingerprintMatch `
            -Fingerprint $fingerprint `
            -ExpectedSiteRoot $mirrorRepoPathResolved `
            -ExpectedDesiredCommit $ExpectedDesiredCommit `
            -ExpectedRuntimeConfigPath $expectedCaddyRuntimeConfigPath)
}

function Invoke-LocalSmoke {
    param(
        [string]$ScriptPath,
        [int]$TimeoutSeconds = 45
    )

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        throw "No existe el smoke canonico: $ScriptPath"
    }

    $result = Invoke-HostingCommandWithOutput `
        -FilePath $powershellExe `
        -Arguments @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', $ScriptPath,
            '-BaseUrl', 'http://127.0.0.1',
            '-ExpectedAuthMode', 'google_oauth',
            '-ExpectedTransport', 'web_broker',
            '-Quiet'
        ) `
        -TimeoutSeconds $TimeoutSeconds `
        -HeartbeatPath $statusPathResolved `
        -Label 'SMOKE-HOSTING-WINDOWS.ps1'

    if ($result.TimedOut -eq $true) {
        throw 'smoke_timeout'
    }
    if ($result.ExitCode -ne 0) {
        throw 'El smoke local del hosting no quedo sano despues de reparar.'
    }

    return $result
}

function Update-StatusFromSyncPayload {
    param(
        [hashtable]$CurrentStatus,
        [object]$SyncStatus
    )

    if ($null -eq $SyncStatus) {
        return
    }

    try { $CurrentStatus.sync_state = [string]$SyncStatus.state } catch {}
    try { $CurrentStatus.sync_deploy_state = [string]$SyncStatus.deploy_state } catch {}
    try { $CurrentStatus.desired_commit = [string]$SyncStatus.desired_commit } catch {}
    try { $CurrentStatus.current_commit = [string]$SyncStatus.current_commit } catch {}
    try { $CurrentStatus.previous_commit = [string]$SyncStatus.previous_commit } catch {}
    try { $CurrentStatus.last_successful_deploy_at = [string]$SyncStatus.last_successful_deploy_at } catch {}
    try { $CurrentStatus.rollback_performed = ($SyncStatus.rollback_performed -eq $true) } catch {}
    try { $CurrentStatus.rollback_reason = [string]$SyncStatus.rollback_reason } catch {}
    try { $CurrentStatus.service_state = [string]$SyncStatus.service_state } catch {}
    try { $CurrentStatus.health_ok = ($SyncStatus.health_ok -eq $true) } catch {}
    try { $CurrentStatus.auth_contract_ok = ($SyncStatus.auth_contract_ok -eq $true) } catch {}
    try { $CurrentStatus.site_root_ok = ($SyncStatus.site_root_ok -eq $true) } catch {}
    try { $CurrentStatus.served_site_root = [string]$SyncStatus.served_site_root } catch {}
    try { $CurrentStatus.served_commit = [string]$SyncStatus.served_commit } catch {}
    try { $CurrentStatus.caddy_runtime_config_path = [string]$SyncStatus.caddy_runtime_config_path } catch {}
    try { $CurrentStatus.auth_mode = [string]$SyncStatus.auth_mode } catch {}
    try { $CurrentStatus.auth_transport = [string]$SyncStatus.auth_transport } catch {}
    try { $CurrentStatus.auth_status = [string]$SyncStatus.auth_status } catch {}
    try { $CurrentStatus.last_failure_reason = [string]$SyncStatus.last_failure_reason } catch {}
}

function Assert-SyncStatusHealthy {
    param([object]$SyncStatus)

    if ($null -eq $SyncStatus) {
        throw 'sync_status_invalid:missing'
    }

    $syncOk = $false
    $syncState = ''
    $syncDeployState = ''
    $syncCurrentCommit = ''
    $syncAuthContractOk = $false
    $syncSiteRootOk = $false
    $syncError = ''
    try { $syncOk = ($SyncStatus.ok -eq $true) } catch {}
    try { $syncState = [string]$SyncStatus.state } catch {}
    try { $syncDeployState = [string]$SyncStatus.deploy_state } catch {}
    try { $syncCurrentCommit = [string]$SyncStatus.current_commit } catch {}
    try { $syncAuthContractOk = ($SyncStatus.auth_contract_ok -eq $true) } catch {}
    try { $syncSiteRootOk = ($SyncStatus.site_root_ok -eq $true) } catch {}
    try { $syncError = [string]$SyncStatus.error } catch {}

    if (-not $syncOk) {
        if ([string]::Equals($syncError, 'site_root_mismatch', [System.StringComparison]::OrdinalIgnoreCase)) {
            throw 'site_root_mismatch'
        }
        throw 'sync_status_invalid:not_ok'
    }
    if (@('failed', 'locked') -contains $syncState) {
        throw ("sync_status_invalid:state_{0}" -f $syncState)
    }
    if ([string]::Equals($syncDeployState, 'lock_invalid', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'sync_status_invalid:lock_invalid'
    }
    if ([string]::IsNullOrWhiteSpace($syncCurrentCommit)) {
        throw 'sync_status_invalid:current_commit_missing'
    }
    if (-not $syncSiteRootOk) {
        throw 'site_root_mismatch'
    }
    if (-not $syncAuthContractOk) {
        throw 'sync_status_invalid:auth_contract'
    }
}

function Write-ReleaseTarget {
    param(
        [string]$Path,
        [string]$Commit,
        [string]$SourceRunId
    )

    $payload = [ordered]@{
        target_commit = $Commit
        approved_at = [DateTimeOffset]::Now.ToString('o')
        source_run_id = $SourceRunId
        approved_by = 'windows_hosting_repair'
    }
    Write-HostingJsonFile -Path $Path -Payload $payload
}

function Stop-TaskIfPresent {
    param([string]$TaskName)

    if (Stop-HostingScheduledTaskIfPresent -TaskName $TaskName) {
        Write-Info ("Tarea detenida: {0}" -f $TaskName)
    }
}

function Remove-TaskIfPresent {
    param([string]$TaskName)

    if (Remove-HostingScheduledTaskIfPresent -TaskName $TaskName) {
        Write-Info ("Tarea eliminada durante rollback de control plane: {0}" -f $TaskName)
    }
}

function Clear-HostingLocks {
    param([string]$HostingDir)

    $lockPaths = @(
        (Join-Path $HostingDir 'main-sync-status.json.lock'),
        (Join-Path $HostingDir 'hosting-supervisor-status.json.lock')
    )
    $repair = Repair-HostingLegacyLocks -LockPaths $lockPaths
    foreach ($removedPath in @($repair.removed_paths)) {
        if (-not [string]::IsNullOrWhiteSpace([string]$removedPath)) {
            Write-Info ("Lock eliminado: {0}" -f [string]$removedPath)
        }
    }
}

function Stop-ControlPlaneOwnerByLock {
    param(
        [string]$LockPath,
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($LockPath)) {
        return
    }

    $snapshot = Get-HostingDirectoryLockSnapshot -LockDirectoryPath $LockPath -TtlSeconds 600 -GraceSeconds 5
    if (($snapshot.owner_pid -le 0) -or ($snapshot.owner_pid -eq $PID)) {
        return
    }
    if (-not (Test-HostingProcessExists -ProcessId $snapshot.owner_pid)) {
        return
    }

    Write-Info ("Deteniendo {0} owner pid={1}" -f $Label, [int]$snapshot.owner_pid)
    Stop-HostingProcessTree -ProcessId ([int]$snapshot.owner_pid) -KillTree
    Start-Sleep -Milliseconds 500
}

function Remove-InvalidHostingStatusFile {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    $payload = Read-HostingJsonFileSafe -Path $Path
    if ($null -eq $payload) {
        return $false
    }

    $lockOwnerPid = 0
    $lockState = ''
    $lockReason = ''
    $state = ''
    $currentCommit = ''
    try { $lockOwnerPid = [int]$payload.lock_owner_pid } catch {}
    try { $lockState = [string]$payload.lock_state } catch {}
    try { $lockReason = [string]$payload.lock_reason } catch {}
    try { $state = [string]$payload.state } catch {}
    try { $currentCommit = [string]$payload.current_commit } catch {}

    $invalidLockState = @('stale_legacy_file', 'stale_metadata_missing', 'transient', 'present', 'lock_invalid') -contains $lockState
    $invalidLockReason = @('legacy_file_lock', 'metadata_missing', 'lock_unrecoverable') -contains $lockReason
    $invalidState = (@('failed', 'locked') -contains $state) -and [string]::IsNullOrWhiteSpace($currentCommit)
    if (($lockOwnerPid -le 0) -and ($invalidLockState -or $invalidLockReason -or $invalidState)) {
        Remove-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        return $true
    }

    return $false
}

function Sanitize-LegacyHostingState {
    param([string]$HostingDir)

    $lockPaths = @(
        (Join-Path $HostingDir 'main-sync-status.json.lock'),
        (Join-Path $HostingDir 'hosting-supervisor-status.json.lock')
    )
    $repair = Repair-HostingLegacyLocks -LockPaths $lockPaths
    $removedPaths = New-Object System.Collections.ArrayList
    foreach ($removedPath in @($repair.removed_paths)) {
        $removedPaths.Add([string]$removedPath) | Out-Null
        Write-Info ("Lock eliminado: {0}" -f [string]$removedPath)
    }

    foreach ($statusPath in @(
        (Join-Path $HostingDir 'main-sync-status.json'),
        (Join-Path $HostingDir 'hosting-supervisor-status.json')
    )) {
        if (Remove-InvalidHostingStatusFile -Path $statusPath) {
            $removedPaths.Add([string]$statusPath) | Out-Null
            Write-Info ("Status legacy eliminado: {0}" -f [string]$statusPath)
        }
    }

    return [PSCustomObject]@{
        repaired = (($repair.repaired -eq $true) -or ($removedPaths.Count -gt 0))
        removed_paths = @($removedPaths)
        remaining_invalid_lock = ($repair.remaining_invalid_lock -eq $true)
        repair_reason = [string]$repair.repair_reason
        error = [string]$repair.error
    }
}

function Disable-ControlPlane {
    param(
        [string[]]$CurrentTaskNames,
        [string]$HostingDir,
        [switch]$RemoveTasks
    )

    foreach ($taskName in $CurrentTaskNames) {
        Stop-TaskIfPresent -TaskName $taskName
        if ($RemoveTasks) {
            Remove-TaskIfPresent -TaskName $taskName
        }
    }

    Stop-ControlPlaneOwnerByLock `
        -LockPath (Join-Path $HostingDir 'hosting-supervisor-status.json.lock') `
        -Label 'Hosting supervisor'
    Stop-ControlPlaneOwnerByLock `
        -LockPath (Join-Path $HostingDir 'main-sync-status.json.lock') `
        -Label 'Hosting main sync'
    Clear-HostingLocks -HostingDir $HostingDir
}

function Wait-ForSupervisorReady {
    param(
        [string]$SupervisorStatusPath,
        [int]$TimeoutSeconds = 60,
        [string]$HeartbeatPath = ''
    )

    $deadline = [DateTimeOffset]::Now.AddSeconds($TimeoutSeconds)
    $lastPayload = $null

    while ([DateTimeOffset]::Now -lt $deadline) {
        if (-not [string]::IsNullOrWhiteSpace($HeartbeatPath)) {
            Set-HostingJsonFields -Path $HeartbeatPath -Fields ([ordered]@{
                phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
                phase_timeout_seconds = $TimeoutSeconds
                timed_out = $false
            })
        }
        $payload = Read-HostingJsonFileSafe -Path $SupervisorStatusPath
        if ($null -ne $payload) {
            $lastPayload = $payload
            $supervisorState = [string]$payload.supervisor_state
            $serviceState = [string]$payload.service_state
            $authContractOk = ($payload.auth_contract_ok -eq $true)
            if ((@('running', 'recovering') -contains $supervisorState) -and $authContractOk -and ($serviceState -ne 'stopped')) {
                return $payload
            }
        }

        Start-Sleep -Seconds 2
    }

    if ($null -eq $lastPayload) {
        throw 'supervisor_boot_failed'
    }

    if ($lastPayload.auth_contract_ok -ne $true) {
        throw 'supervisor_auth_contract_failed'
    }

    if ([string]$lastPayload.service_state -eq 'stopped') {
        throw 'supervisor_service_stopped'
    }

    throw ("supervisor_state_invalid:{0}" -f [string]$lastPayload.supervisor_state)
}

function New-SyncArguments {
    param([switch]$CurrentPreflightOnly)

    $arguments = New-Object 'System.Collections.Generic.List[string]'
    foreach ($token in @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $syncScriptPath,
        '-MirrorRepoPath', $mirrorRepoPathResolved,
        '-ExternalEnvPath', $externalEnvPathResolved,
        '-ReleaseTargetPath', $releaseTargetPathResolved,
        '-PublicDomain', $PublicDomain,
        '-TunnelId', $TunnelId,
        '-OperatorUserProfile', $resolvedOperatorUserProfile,
        '-BootstrapReleaseTargetIfMissing',
        '-Quiet'
    )) {
        $arguments.Add([string]$token) | Out-Null
    }
    if ($CurrentPreflightOnly) {
        $arguments.Add('-PreflightOnly') | Out-Null
    }
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-CaddyExePath' -Value $CaddyExePath
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-CloudflaredExePath' -Value $CloudflaredExePath
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-PhpCgiExePath' -Value $PhpCgiExePath
    return $arguments
}

function Invoke-SyncScript {
    param(
        [switch]$CurrentPreflightOnly,
        [string]$SyncStatusWatchPath = ''
    )

    $arguments = New-SyncArguments -CurrentPreflightOnly:$CurrentPreflightOnly
    $timeoutSeconds = $syncApplyTimeoutSeconds
    if ($CurrentPreflightOnly) {
        $timeoutSeconds = $syncPreflightTimeoutSeconds
    }

    return Invoke-HostingCommandWithOutput `
        -FilePath $powershellExe `
        -Arguments $arguments `
        -TimeoutSeconds $timeoutSeconds `
        -HeartbeatPath $statusPathResolved `
        -Label 'SINCRONIZAR-HOSTING-WINDOWS.ps1' `
        -StatusFilesToWatch @($SyncStatusWatchPath)
}

function Invoke-ConfigScript {
    param(
        [switch]$SkipBootstrapSync,
        [switch]$StartSupervisorNow
    )

    $arguments = New-Object 'System.Collections.Generic.List[string]'
    foreach ($token in @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $configScriptPath,
        '-MirrorRepoPath', $mirrorRepoPathResolved,
        '-ExternalEnvPath', $externalEnvPathResolved,
        '-ReleaseTargetPath', $releaseTargetPathResolved,
        '-PublicDomain', $PublicDomain,
        '-TunnelId', $TunnelId,
        '-OperatorUserProfile', $resolvedOperatorUserProfile
    )) {
        $arguments.Add([string]$token) | Out-Null
    }
    if ($SkipBootstrapSync) {
        $arguments.Add('-SkipBootstrapSync') | Out-Null
    }
    if ($StartSupervisorNow) {
        $arguments.Add('-StartSupervisorNow') | Out-Null
    }

    return Invoke-HostingCommandWithOutput `
        -FilePath $powershellExe `
        -Arguments $arguments `
        -TimeoutSeconds $configTimeoutSeconds `
        -HeartbeatPath $statusPathResolved `
        -Label 'CONFIGURAR-HOSTING-WINDOWS.ps1' `
        -StatusFilesToWatch @($supervisorStatusPath)
}

function Set-RepairPhase {
    param(
        [hashtable]$CurrentStatus,
        [string]$Phase,
        [int]$TimeoutSeconds = 0,
        [string]$ChildScript = ''
    )

    $now = [DateTimeOffset]::Now.ToString('o')
    $CurrentStatus.phase = $Phase
    $CurrentStatus.phase_started_at = $now
    $CurrentStatus.phase_heartbeat_at = $now
    $CurrentStatus.phase_timeout_seconds = $TimeoutSeconds
    $CurrentStatus.child_script = $ChildScript
    $CurrentStatus.child_pid = 0
    $CurrentStatus.child_exit_code = ''
    $CurrentStatus.timed_out = $false
    Write-Status -Payload $CurrentStatus
}

function Update-RepairChildResult {
    param(
        [hashtable]$CurrentStatus,
        [object]$Result
    )

    if ($null -eq $Result) {
        return
    }

    $CurrentStatus.phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
    try { $CurrentStatus.child_pid = [int]$Result.ProcessId } catch {}
    try { $CurrentStatus.child_exit_code = [int]$Result.ExitCode } catch {}
    $CurrentStatus.timed_out = ($Result.TimedOut -eq $true)
    Write-Status -Payload $CurrentStatus
}

$status = [ordered]@{
    ok = $false
    timestamp = [DateTimeOffset]::Now.ToString('o')
    phase = 'discover'
    phase_started_at = [DateTimeOffset]::Now.ToString('o')
    phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
    phase_timeout_seconds = 0
    child_script = ''
    child_pid = 0
    child_exit_code = ''
    timed_out = $false
    status_source = 'repair_runtime'
    mirror_repo_path = $mirrorRepoPathResolved
    release_target_path = $releaseTargetPathResolved
    external_env_path = $externalEnvPathResolved
    desired_commit = ''
    current_commit = ''
    previous_commit = ''
    sync_status_path = ''
    sync_state = ''
    sync_deploy_state = ''
    sanitize_repaired = $false
    sanitize_removed_paths = @()
    sanitize_error = ''
    service_state = 'unknown'
    health_ok = $false
    auth_contract_ok = $false
    site_root_ok = $false
    served_site_root = ''
    served_commit = ''
    caddy_runtime_config_path = ''
    auth_mode = ''
    auth_transport = ''
    auth_status = ''
    promoted_commit = ''
    preflight_ok = $false
    repaired = $false
    rollback_performed = $false
    rollback_reason = ''
    last_successful_deploy_at = ''
    last_failure_reason = ''
    supervisor_status_path = ''
    supervisor_state = ''
    error = ''
}

$automationConfigured = $false
$hostingDir = ''
$supervisorStatusPath = ''

try {
    Ensure-HostingParentDirectory -Path $statusPathResolved
    Ensure-HostingParentDirectory -Path $releaseTargetPathResolved
    $hostingDir = Split-Path -Parent $releaseTargetPathResolved
    $supervisorStatusPath = Join-Path $hostingDir 'hosting-supervisor-status.json'
    $syncStatusPath = Join-Path $hostingDir 'main-sync-status.json'
    $status.supervisor_status_path = $supervisorStatusPath
    $status.sync_status_path = $syncStatusPath

    $status.current_commit = Get-CurrentCommitSafe -RepoPath $mirrorRepoPathResolved
    $status.previous_commit = $status.current_commit
    $status.service_state = Get-ServiceStateSafe -CurrentTunnelId $TunnelId
    $health = Invoke-LocalHealthCheck
    $auth = Invoke-LocalAuthContract
    $status.health_ok = $health.Ok -eq $true
    $status.auth_contract_ok = $auth.Ok -eq $true
    $status.auth_mode = [string]$auth.Mode
    $status.auth_transport = [string]$auth.Transport
    $status.auth_status = [string]$auth.Status
    Write-Status -Payload $status

    if ([string]::IsNullOrWhiteSpace($TargetCommit) -and $PromoteCurrentRemoteHead) {
        $TargetCommit = Resolve-RemoteHead -RepoPath $mirrorRepoPathResolved -BranchName 'main'
    }

    if (-not [string]::IsNullOrWhiteSpace($TargetCommit)) {
        Write-ReleaseTarget -Path $releaseTargetPathResolved -Commit $TargetCommit -SourceRunId 'repair_promote_remote'
        $status.promoted_commit = $TargetCommit
        Write-Info ("Release target actualizado manualmente: {0}" -f $TargetCommit)
    }

    $releaseTargetPayload = Read-HostingJsonFileSafe -Path $releaseTargetPathResolved
    if ($null -ne $releaseTargetPayload) {
        try { $status.desired_commit = [string]$releaseTargetPayload.target_commit } catch {}
    }
    $runtime = Invoke-LocalRuntimeFingerprintStatus -ExpectedDesiredCommit $status.desired_commit
    $status.site_root_ok = ($runtime.Ok -eq $true)
    $status.served_site_root = [string]$runtime.SiteRoot
    $status.served_commit = if (-not [string]::IsNullOrWhiteSpace([string]$runtime.CurrentCommit)) { [string]$runtime.CurrentCommit } else { [string]$runtime.DesiredCommit }
    $status.caddy_runtime_config_path = [string]$runtime.CaddyRuntimeConfigPath
    Write-Status -Payload $status

    Set-RepairPhase -CurrentStatus $status -Phase 'sanitize_legacy_state'
    $sanitizeResult = Sanitize-LegacyHostingState -HostingDir $hostingDir
    $status.sanitize_repaired = ($sanitizeResult.repaired -eq $true)
    $status.sanitize_removed_paths = @($sanitizeResult.removed_paths)
    $status.sanitize_error = [string]$sanitizeResult.error
    Write-Status -Payload $status
    if ($sanitizeResult.remaining_invalid_lock -eq $true) {
        throw 'sync_lock_unrecoverable'
    }

    Set-RepairPhase `
        -CurrentStatus $status `
        -Phase 'preflight' `
        -TimeoutSeconds $syncPreflightTimeoutSeconds `
        -ChildScript 'SINCRONIZAR-HOSTING-WINDOWS.ps1'
    $preflightResult = Invoke-SyncScript -CurrentPreflightOnly -SyncStatusWatchPath $syncStatusPath
    Update-RepairChildResult -CurrentStatus $status -Result $preflightResult
    if ($preflightResult.TimedOut -eq $true) {
        throw 'sync_timeout'
    }
    if ($preflightResult.ExitCode -ne 0) {
        throw ("Preflight del sync fallido. {0}" -f $preflightResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($preflightResult.Output)) {
        Write-Info $preflightResult.Output.Trim()
    }
    $status.preflight_ok = $true

    if ($PreflightOnly) {
        $status.ok = $true
        Set-RepairPhase -CurrentStatus $status -Phase 'preflight_ready'
        Write-Status -Payload $status
        Write-Info 'Preflight de reparacion OK; no se tocaron procesos activos.'
        exit 0
    }

    Set-RepairPhase -CurrentStatus $status -Phase 'quiesce'
    Disable-ControlPlane -CurrentTaskNames $taskNames -HostingDir $hostingDir

    Set-RepairPhase `
        -CurrentStatus $status `
        -Phase 'apply' `
        -TimeoutSeconds $syncApplyTimeoutSeconds `
        -ChildScript 'SINCRONIZAR-HOSTING-WINDOWS.ps1'
    $syncResult = Invoke-SyncScript -SyncStatusWatchPath $syncStatusPath
    Update-RepairChildResult -CurrentStatus $status -Result $syncResult
    $syncStatus = Read-HostingJsonFileSafe -Path $syncStatusPath
    if ($null -ne $syncStatus) {
        Update-StatusFromSyncPayload -CurrentStatus $status -SyncStatus $syncStatus
        Write-Status -Payload $status
    }
    if ($syncResult.TimedOut -eq $true) {
        throw 'sync_timeout'
    }
    if ($syncResult.ExitCode -ne 0) {
        $syncFailure = $syncResult.Output.Trim()
        if (($null -ne $syncStatus) -and (-not [string]::IsNullOrWhiteSpace([string]$syncStatus.error))) {
            $syncFailure = [string]$syncStatus.error
        }
        throw ("SINCRONIZAR-HOSTING-WINDOWS.ps1 no pudo recuperar el servicio. {0}" -f $syncFailure)
    }
    if (-not [string]::IsNullOrWhiteSpace($syncResult.Output)) {
        Write-Info $syncResult.Output.Trim()
    }

    if ($null -ne $syncStatus) {
        Update-StatusFromSyncPayload -CurrentStatus $status -SyncStatus $syncStatus
    } else {
        $status.current_commit = Get-CurrentCommitSafe -RepoPath $mirrorRepoPathResolved
        $status.service_state = Get-ServiceStateSafe -CurrentTunnelId $TunnelId
        $health = Invoke-LocalHealthCheck
        $auth = Invoke-LocalAuthContract
        $status.health_ok = $health.Ok -eq $true
        $status.auth_contract_ok = $auth.Ok -eq $true
        $status.auth_mode = [string]$auth.Mode
        $status.auth_transport = [string]$auth.Transport
        $status.auth_status = [string]$auth.Status
    }
    Assert-SyncStatusHealthy -SyncStatus $syncStatus

    Set-RepairPhase `
        -CurrentStatus $status `
        -Phase 'validate_stack' `
        -TimeoutSeconds $smokeTimeoutSeconds `
        -ChildScript 'SMOKE-HOSTING-WINDOWS.ps1'
    $smokeResult = Invoke-LocalSmoke -ScriptPath $smokeScriptPath -TimeoutSeconds $smokeTimeoutSeconds
    Update-RepairChildResult -CurrentStatus $status -Result $smokeResult

    Set-RepairPhase `
        -CurrentStatus $status `
        -Phase 'configure_runtime' `
        -TimeoutSeconds $configTimeoutSeconds `
        -ChildScript 'CONFIGURAR-HOSTING-WINDOWS.ps1'
    $automationConfigured = $true
    $configResult = Invoke-ConfigScript -SkipBootstrapSync -StartSupervisorNow
    Update-RepairChildResult -CurrentStatus $status -Result $configResult
    if ($configResult.TimedOut -eq $true) {
        throw 'config_timeout'
    }
    if ($configResult.ExitCode -ne 0) {
        throw ("CONFIGURAR-HOSTING-WINDOWS.ps1 no pudo reinstalar el supervisor. {0}" -f $configResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($configResult.Output)) {
        Write-Info $configResult.Output.Trim()
    }

    Set-RepairPhase -CurrentStatus $status -Phase 'start_supervisor'
    Set-RepairPhase `
        -CurrentStatus $status `
        -Phase 'validate_supervisor' `
        -TimeoutSeconds $supervisorReadyTimeoutSeconds `
        -ChildScript 'Wait-ForSupervisorReady'
    $supervisorStatus = Wait-ForSupervisorReady `
        -SupervisorStatusPath $supervisorStatusPath `
        -TimeoutSeconds $supervisorReadyTimeoutSeconds `
        -HeartbeatPath $statusPathResolved
    $status.supervisor_state = [string]$supervisorStatus.supervisor_state
    $status.service_state = [string]$supervisorStatus.service_state
    $status.auth_contract_ok = ($supervisorStatus.auth_contract_ok -eq $true)
    $status.auth_mode = [string]$supervisorStatus.auth_mode
    $status.auth_transport = [string]$supervisorStatus.auth_transport
    $status.auth_status = [string]$supervisorStatus.auth_status
    $status.phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
    Write-Status -Payload $status

    Set-RepairPhase `
        -CurrentStatus $status `
        -Phase 'final_smoke' `
        -TimeoutSeconds $smokeTimeoutSeconds `
        -ChildScript 'SMOKE-HOSTING-WINDOWS.ps1'
    $finalSmokeResult = Invoke-LocalSmoke -ScriptPath $smokeScriptPath -TimeoutSeconds $smokeTimeoutSeconds
    Update-RepairChildResult -CurrentStatus $status -Result $finalSmokeResult

    $status.ok = $true
    $status.repaired = $true
    Set-RepairPhase -CurrentStatus $status -Phase 'completed'
    $status.error = ''
    Write-Status -Payload $status
    Write-Info 'Reparacion completada con health/auth/smoke locales en verde.'
} catch {
    $status.error = $_.Exception.Message
    $status.last_failure_reason = $status.error
    $status.timed_out = @('sync_timeout', 'config_timeout', 'smoke_timeout') -contains $status.error
    if (($status.phase -ne 'discover') -and ($status.phase -ne 'sanitize_legacy_state') -and ($status.phase -ne 'preflight') -and ($status.phase -ne 'preflight_ready')) {
        Disable-ControlPlane -CurrentTaskNames $taskNames -HostingDir $hostingDir -RemoveTasks:$automationConfigured
    }
    if (($status.phase -eq 'discover') -or ($status.phase -eq 'sanitize_legacy_state') -or ($status.phase -eq 'preflight')) {
        $status.phase = 'failed_preflight'
    }
    Write-Status -Payload $status
    Write-Info ("Reparacion fallida: {0}" -f $status.error)
    throw
}
