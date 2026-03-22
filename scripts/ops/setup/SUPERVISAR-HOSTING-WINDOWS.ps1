param(
    [string]$MirrorRepoPath = 'C:\dev\pielarmonia-clean-main',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$ReleaseTargetPath = 'C:\ProgramData\Pielarmonia\hosting\release-target.json',
    [string]$StatusPath = 'C:\ProgramData\Pielarmonia\hosting\hosting-supervisor-status.json',
    [string]$LogPath = 'C:\ProgramData\Pielarmonia\hosting\hosting-supervisor.log',
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [string]$CaddyExePath = '',
    [string]$CloudflaredExePath = '',
    [string]$PhpCgiExePath = '',
    [int]$LoopDelaySeconds = 15,
    [int]$RepairCooldownSeconds = 300,
    [int]$LockTtlSeconds = 600,
    [switch]$RunOnce,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'
if (-not (Test-Path -LiteralPath $commonScriptPath)) {
    throw "No existe el modulo comun de hosting Windows: $commonScriptPath"
}
. $commonScriptPath

$mirrorRepoPathResolved = [System.IO.Path]::GetFullPath($MirrorRepoPath)
$runtimePaths = Get-HostingRuntimePaths -RepoRoot $mirrorRepoPathResolved
$expectedCaddyRuntimeConfigPath = [string]$runtimePaths.CaddyRuntimeConfigPath
$statusPathResolved = [System.IO.Path]::GetFullPath($StatusPath)
$logPathResolved = [System.IO.Path]::GetFullPath($LogPath)
$releaseTargetPathResolved = [System.IO.Path]::GetFullPath($ReleaseTargetPath)
$externalEnvPathResolved = [System.IO.Path]::GetFullPath($ExternalEnvPath)
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}
$repairScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\REPARAR-HOSTING-WINDOWS.ps1'
$smokeScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\SMOKE-HOSTING-WINDOWS.ps1'
$mainSyncStatusPath = Join-Path ([System.IO.Path]::GetDirectoryName($statusPathResolved)) 'main-sync-status.json'
$lockPath = $statusPathResolved + '.lock'
$lockInfoPath = Get-HostingLockInfoPath -LockDirectoryPath $lockPath
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source
$repairTimeoutSeconds = 300
$smokeTimeoutSeconds = 45

function Write-Info {
    param([string]$Message)

    $line = ('[{0}] {1}' -f ([DateTimeOffset]::Now.ToString('o')), $Message)
    Ensure-HostingParentDirectory -Path $logPathResolved
    Add-Content -Path $logPathResolved -Value $line -Encoding ASCII
    if (-not $Quiet) {
        Write-Host "[hosting-supervisor] $Message"
    }
}

function Get-LockSnapshot {
    param(
        [string]$InfoPath,
        [int]$TtlSeconds
    )

    $lockDirectoryPath = Split-Path -Parent $InfoPath
    return Get-HostingDirectoryLockSnapshot `
        -LockDirectoryPath $lockDirectoryPath `
        -TtlSeconds $TtlSeconds `
        -GraceSeconds 5
}

function Clear-SupervisorLockArtifacts {
    if (Test-Path -LiteralPath $lockPath) {
        Remove-HostingDirectoryLock -LockDirectoryPath $lockPath -Force | Out-Null
        if (Test-Path -LiteralPath $lockPath) {
            Remove-Item -LiteralPath $lockPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    foreach ($legacyPath in @($lockInfoPath, ($lockPath + '.json'))) {
        if (Test-Path -LiteralPath $legacyPath) {
            Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Acquire-SupervisorLock {
    $result = Acquire-HostingDirectoryLock `
        -LockDirectoryPath $lockPath `
        -TtlSeconds $LockTtlSeconds `
        -GraceSeconds 5 `
        -Reason 'hosting_supervisor'

    return [PSCustomObject]@{
        Acquired = $result.Acquired
        Stream = $null
        Snapshot = $result.Snapshot
    }
}

function Get-ServiceState {
    param([string]$CurrentTunnelId)

    $phpProcesses = Get-HostingProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000')
    $caddyProcesses = Get-HostingProcessesByNeedle -Needles @('caddy.exe', 'run')
    $cloudflaredProcesses = Get-HostingProcessesByNeedle -Needles @('cloudflared.exe', $CurrentTunnelId, '--url http://127.0.0.1')
    $helperProcesses = Get-HostingProcessesByNeedle -Needles @('openclaw-auth-helper.js')

    $state = if (($phpProcesses.Count -gt 0) -and ($caddyProcesses.Count -gt 0) -and ($cloudflaredProcesses.Count -gt 0)) {
        'running'
    } elseif (($phpProcesses.Count + $caddyProcesses.Count + $cloudflaredProcesses.Count) -gt 0) {
        'degraded'
    } else {
        'stopped'
    }

    return [PSCustomObject]@{
        State = $state
        PhpPids = @($phpProcesses | ForEach-Object { [int]$_.ProcessId })
        CaddyPids = @($caddyProcesses | ForEach-Object { [int]$_.ProcessId })
        CloudflaredPids = @($cloudflaredProcesses | ForEach-Object { [int]$_.ProcessId })
        HelperPids = @($helperProcesses | ForEach-Object { [int]$_.ProcessId })
    }
}

function Invoke-LocalHealth {
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

function Invoke-LocalAuth {
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
            $authError = 'Contrato Operator Auth invalido en supervisor.'
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

function Invoke-HostingSmoke {
    param([string]$ScriptPath)

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        return [PSCustomObject]@{
            Ok = $false
            Error = "No existe el smoke canonico: $ScriptPath"
        }
    }

    $reportPath = Join-Path ([System.IO.Path]::GetTempPath()) ("hosting-smoke-" + [Guid]::NewGuid().ToString('N') + '.json')
    try {
        $result = Invoke-HostingCommandWithOutput `
            -FilePath $powershellExe `
            -Arguments @(
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', $ScriptPath,
                '-BaseUrl', 'http://127.0.0.1',
                '-ExpectedAuthMode', 'google_oauth',
                '-ExpectedTransport', 'web_broker',
                '-ReportPath', $reportPath,
                '-Quiet'
            ) `
            -TimeoutSeconds $smokeTimeoutSeconds `
            -HeartbeatPath $statusPathResolved `
            -Label 'SMOKE-HOSTING-WINDOWS.ps1'

        if ($result.TimedOut -eq $true) {
            return [PSCustomObject]@{
                Ok = $false
                Error = 'smoke_timeout'
            }
        }

        $payload = Read-HostingJsonFileSafe -Path $reportPath
        $smokeError = ''
        if ($null -eq $payload) {
            $smokeError = 'No se genero reporte de smoke.'
        } else {
            $smokeError = [string]$payload.error
        }
        return [PSCustomObject]@{
            Ok = ($result.ExitCode -eq 0) -and ($null -ne $payload) -and ($payload.ok -eq $true)
            Error = $smokeError
        }
    } finally {
        if (Test-Path -LiteralPath $reportPath) {
            Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-Repair {
    param([string]$ScriptPath)

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        throw "No existe REPARAR-HOSTING-WINDOWS.ps1 en el mirror: $ScriptPath"
    }

    $arguments = New-Object 'System.Collections.Generic.List[string]'
    foreach ($token in @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $ScriptPath,
        '-MirrorRepoPath', $mirrorRepoPathResolved,
        '-ExternalEnvPath', $externalEnvPathResolved,
        '-ReleaseTargetPath', $releaseTargetPathResolved,
        '-PublicDomain', $PublicDomain,
        '-TunnelId', $TunnelId,
        '-OperatorUserProfile', $resolvedOperatorUserProfile,
        '-Quiet'
    )) {
        $arguments.Add([string]$token) | Out-Null
    }
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-CaddyExePath' -Value $CaddyExePath
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-CloudflaredExePath' -Value $CloudflaredExePath
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-PhpCgiExePath' -Value $PhpCgiExePath

    $result = Invoke-HostingCommandWithOutput `
        -FilePath $powershellExe `
        -Arguments $arguments `
        -TimeoutSeconds $repairTimeoutSeconds `
        -HeartbeatPath $statusPathResolved `
        -Label 'REPARAR-HOSTING-WINDOWS.ps1' `
        -StatusFilesToWatch @($mainSyncStatusPath)

    if ($result.TimedOut -eq $true) {
        throw 'repair_timeout'
    }
    if ($result.ExitCode -ne 0) {
        throw 'REPARAR-HOSTING-WINDOWS.ps1 no pudo recuperar el servicio.'
    }

    return $result
}

function Get-DesiredCommit {
    $payload = Read-HostingJsonFileSafe -Path $releaseTargetPathResolved
    if ($null -eq $payload) {
        return ''
    }
    try {
        return [string]$payload.target_commit
    } catch {
        return ''
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

function Merge-SyncStatus {
    param(
        [hashtable]$CurrentStatus,
        [object]$SyncStatus
    )

    if ($null -eq $SyncStatus) {
        return
    }

    try { $CurrentStatus.desired_commit = [string]$SyncStatus.desired_commit } catch {}
    try { $CurrentStatus.sync_state = [string]$SyncStatus.state } catch {}
    try { $CurrentStatus.sync_deploy_state = [string]$SyncStatus.deploy_state } catch {}
    try { $CurrentStatus.lock_repaired = ($SyncStatus.lock_repaired -eq $true) } catch {}
    try { $CurrentStatus.lock_repair_reason = [string]$SyncStatus.lock_repair_reason } catch {}
    try { $CurrentStatus.current_commit = [string]$SyncStatus.current_commit } catch {}
    try { $CurrentStatus.previous_commit = [string]$SyncStatus.previous_commit } catch {}
    try { $CurrentStatus.deploy_state = [string]$SyncStatus.deploy_state } catch {}
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
    try { $CurrentStatus.rollback_performed = ($SyncStatus.rollback_performed -eq $true) } catch {}
    try { $CurrentStatus.rollback_reason = [string]$SyncStatus.rollback_reason } catch {}
    try { $CurrentStatus.last_successful_deploy_at = [string]$SyncStatus.last_successful_deploy_at } catch {}
    try { $CurrentStatus.last_failure_reason = [string]$SyncStatus.last_failure_reason } catch {}
}

$lockStream = $null
$lastRepairAt = [DateTimeOffset]::MinValue
$lastRepairTimedOut = $false
$lastRepairError = ''
$lastRepairChildPid = 0

try {
    Ensure-HostingParentDirectory -Path $statusPathResolved
    $supervisorLockRepair = Repair-HostingLegacyLocks -LockPaths @($lockPath) -TtlSeconds $LockTtlSeconds -GraceSeconds 5
    if ($supervisorLockRepair.remaining_invalid_lock -eq $true) {
        throw 'supervisor_lock_unrecoverable'
    }
    $lockResult = Acquire-SupervisorLock
    if (-not $lockResult.Acquired) {
        if ([int]$lockResult.Snapshot.owner_pid -le 0) {
            $retryRepair = Repair-HostingLegacyLocks -LockPaths @($lockPath) -TtlSeconds $LockTtlSeconds -GraceSeconds 5
            if (-not $retryRepair.remaining_invalid_lock) {
                $lockResult = Acquire-SupervisorLock
            }
        }
    }

    if (-not $lockResult.Acquired) {
        if ([int]$lockResult.Snapshot.owner_pid -le 0) {
            Write-Info ("Lock invalido del supervisor; state={0} reason={1}" -f $lockResult.Snapshot.lock_state, $lockResult.Snapshot.lock_reason)
            throw 'supervisor_lock_unrecoverable'
        }
        $status = [ordered]@{
            ok = $false
            timestamp = [DateTimeOffset]::Now.ToString('o')
            phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
            status_source = 'supervisor_runtime'
            desired_commit = Get-DesiredCommit
            sync_state = ''
            sync_deploy_state = ''
            lock_repaired = ($supervisorLockRepair.repaired -eq $true)
            lock_repair_reason = [string]$supervisorLockRepair.repair_reason
            current_commit = ''
            previous_commit = ''
            deploy_state = 'waiting_for_lock'
            service_state = 'unknown'
            health_ok = $false
            auth_contract_ok = $false
            site_root_ok = $false
            served_site_root = ''
            served_commit = ''
            caddy_runtime_config_path = $expectedCaddyRuntimeConfigPath
            auth_mode = ''
            auth_transport = ''
            auth_status = ''
            supervisor_state = 'failed'
            degraded = $true
            repair_attempted = $false
            last_repair_at = ''
            repair_timeout = $false
            repair_child_pid = 0
            repair_error = 'supervisor_already_running'
            lock_state = [string]$lockResult.Snapshot.lock_state
            lock_reason = [string]$lockResult.Snapshot.lock_reason
            lock_owner_pid = [int]$lockResult.Snapshot.owner_pid
            lock_started_at = [string]$lockResult.Snapshot.started_at
            lock_age_seconds = [int]$lockResult.Snapshot.age_seconds
            rollback_performed = $false
            rollback_reason = ''
            last_successful_deploy_at = ''
            last_failure_reason = 'supervisor_already_running'
            mirror_repo_path = $mirrorRepoPathResolved
            release_target_path = $releaseTargetPathResolved
            external_env_path = $externalEnvPathResolved
        }
        Write-HostingJsonFile -Path $statusPathResolved -Payload $status
        Write-Info ("Otro supervisor sigue activo; owner_pid={0} age_seconds={1}" -f $status.lock_owner_pid, $status.lock_age_seconds)
        exit 0
    }

    $lockStream = $lockResult.Stream
    Write-Info ("Supervisor activo para mirror={0}" -f $mirrorRepoPathResolved)

    while ($true) {
        $service = Get-ServiceState -CurrentTunnelId $TunnelId
        $health = Invoke-LocalHealth
        $auth = Invoke-LocalAuth
        $desiredCommit = Get-DesiredCommit
        $runtime = Invoke-LocalRuntimeFingerprintStatus -ExpectedDesiredCommit $desiredCommit
        $smoke = if ($health.Ok -and $auth.Ok) {
            Invoke-HostingSmoke -ScriptPath $smokeScriptPath
        } else {
            [PSCustomObject]@{
                Ok = $false
                Error = 'health/auth aun no estan sanos.'
            }
        }

        $syncStatus = Read-HostingJsonFileSafe -Path $mainSyncStatusPath
        $syncDegraded = $false
        if ($null -ne $syncStatus) {
            $syncState = ''
            $syncDeployState = ''
            $syncCurrentCommit = ''
            $syncLockRepaired = $false
            $syncLockReason = ''
            $syncSiteRootOk = $false
            try { $syncState = [string]$syncStatus.state } catch {}
            try { $syncDeployState = [string]$syncStatus.deploy_state } catch {}
            try { $syncCurrentCommit = [string]$syncStatus.current_commit } catch {}
            try { $syncLockRepaired = ($syncStatus.lock_repaired -eq $true) } catch {}
            try { $syncLockReason = [string]$syncStatus.lock_repair_reason } catch {}
            try { $syncSiteRootOk = ($syncStatus.site_root_ok -eq $true) } catch {}
            $syncDegraded =
                (@('failed', 'locked') -contains $syncState) -or
                [string]::Equals($syncDeployState, 'lock_invalid', [System.StringComparison]::OrdinalIgnoreCase) -or
                [string]::IsNullOrWhiteSpace($syncCurrentCommit) -or
                (-not $syncSiteRootOk) -or
                ((-not $syncLockRepaired) -and (-not [string]::IsNullOrWhiteSpace($syncLockReason)))
        }

        $degraded = ($service.State -ne 'running') -or (-not $health.Ok) -or (-not $runtime.Ok) -or (-not $auth.Ok) -or (-not $smoke.Ok) -or $syncDegraded
        $repairAttempted = $false
        $repairError = ''
        $repairTimedOut = $false
        $repairChildPid = 0

        if ($degraded) {
            $age = ([DateTimeOffset]::Now - $lastRepairAt).TotalSeconds
            if ($age -ge $RepairCooldownSeconds) {
                $repairAttempted = $true
                try {
                    $repairResult = Invoke-Repair -ScriptPath $repairScriptPath
                    try { $repairChildPid = [int]$repairResult.ProcessId } catch {}
                    $lastRepairAt = [DateTimeOffset]::Now
                    $lastRepairTimedOut = $false
                    $lastRepairError = ''
                    $lastRepairChildPid = $repairChildPid
                    $service = Get-ServiceState -CurrentTunnelId $TunnelId
                    $health = Invoke-LocalHealth
                    $auth = Invoke-LocalAuth
                    $desiredCommit = Get-DesiredCommit
                    $runtime = Invoke-LocalRuntimeFingerprintStatus -ExpectedDesiredCommit $desiredCommit
                    $smoke = if ($health.Ok -and $auth.Ok) {
                        Invoke-HostingSmoke -ScriptPath $smokeScriptPath
                    } else {
                        [PSCustomObject]@{
                            Ok = $false
                            Error = 'health/auth aun no estan sanos.'
                        }
                    }
                    $syncStatus = Read-HostingJsonFileSafe -Path $mainSyncStatusPath
                    $syncDegraded = $false
                    if ($null -ne $syncStatus) {
                        $syncState = ''
                        $syncDeployState = ''
                        $syncCurrentCommit = ''
                        $syncLockRepaired = $false
                        $syncLockReason = ''
                        $syncSiteRootOk = $false
                        try { $syncState = [string]$syncStatus.state } catch {}
                        try { $syncDeployState = [string]$syncStatus.deploy_state } catch {}
                        try { $syncCurrentCommit = [string]$syncStatus.current_commit } catch {}
                        try { $syncLockRepaired = ($syncStatus.lock_repaired -eq $true) } catch {}
                        try { $syncLockReason = [string]$syncStatus.lock_repair_reason } catch {}
                        try { $syncSiteRootOk = ($syncStatus.site_root_ok -eq $true) } catch {}
                        $syncDegraded =
                            (@('failed', 'locked') -contains $syncState) -or
                            [string]::Equals($syncDeployState, 'lock_invalid', [System.StringComparison]::OrdinalIgnoreCase) -or
                            [string]::IsNullOrWhiteSpace($syncCurrentCommit) -or
                            (-not $syncSiteRootOk) -or
                            ((-not $syncLockRepaired) -and (-not [string]::IsNullOrWhiteSpace($syncLockReason)))
                    }
                    $degraded = ($service.State -ne 'running') -or (-not $health.Ok) -or (-not $runtime.Ok) -or (-not $auth.Ok) -or (-not $smoke.Ok) -or $syncDegraded
                } catch {
                    $repairError = $_.Exception.Message
                    $lastRepairAt = [DateTimeOffset]::Now
                    $repairTimedOut = [string]::Equals($repairError, 'repair_timeout', [System.StringComparison]::OrdinalIgnoreCase)
                    $lastRepairTimedOut = $repairTimedOut
                    $lastRepairError = $repairError
                    if ($repairTimedOut) {
                        $currentSupervisorStatus = Read-HostingJsonFileSafe -Path $statusPathResolved
                        if ($null -ne $currentSupervisorStatus) {
                            try { $repairChildPid = [int]$currentSupervisorStatus.child_pid } catch {}
                        }
                    }
                    $lastRepairChildPid = $repairChildPid
                    Write-Info ("Supervisor no pudo reparar el hosting: {0}" -f $repairError)
                }
            }
        }

        $lockSnapshot = Get-LockSnapshot -InfoPath $lockInfoPath -TtlSeconds $LockTtlSeconds
        $repairCooldownActive =
            $lastRepairTimedOut -and
            ($lastRepairAt -ne [DateTimeOffset]::MinValue) -and
            (([DateTimeOffset]::Now - $lastRepairAt).TotalSeconds -lt $RepairCooldownSeconds)
        if ($repairTimedOut) {
            $supervisorState = 'failed'
        } elseif ($repairCooldownActive) {
            $supervisorState = 'failed'
        } elseif ($repairAttempted -and [string]::IsNullOrWhiteSpace($repairError)) {
            $supervisorState = 'recovering'
        } elseif ($degraded -and -not [string]::IsNullOrWhiteSpace($repairError)) {
            $supervisorState = 'failed'
        } elseif ($degraded) {
            $supervisorState = 'degraded'
        } else {
            $supervisorState = 'running'
        }
        if ($degraded) {
            $deployState = 'degraded'
        } else {
            $deployState = 'current'
        }
        if ($lastRepairAt -eq [DateTimeOffset]::MinValue) {
            $lastRepairAtText = ''
        } else {
            $lastRepairAtText = $lastRepairAt.ToString('o')
        }
        if (-not [string]::IsNullOrWhiteSpace($repairError)) {
            $lastFailureReason = $repairError
        } elseif ($repairCooldownActive) {
            $lastFailureReason = $lastRepairError
        } else {
            $lastFailureReason = ''
        }
        $statusRepairTimeout = $repairTimedOut -or $repairCooldownActive
        if ($repairChildPid -le 0) {
            $repairChildPid = $lastRepairChildPid
        }
        if ([string]::IsNullOrWhiteSpace($repairError) -and $repairCooldownActive) {
            $repairError = $lastRepairError
        }

        $status = [ordered]@{
            ok = (-not $degraded)
            timestamp = [DateTimeOffset]::Now.ToString('o')
            phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
            status_source = 'supervisor_runtime'
            desired_commit = $desiredCommit
            sync_state = ''
            sync_deploy_state = ''
            lock_repaired = ($supervisorLockRepair.repaired -eq $true)
            lock_repair_reason = [string]$supervisorLockRepair.repair_reason
            current_commit = ''
            previous_commit = ''
            deploy_state = $deployState
            service_state = [string]$service.State
            health_ok = $health.Ok -eq $true
            auth_contract_ok = $auth.Ok -eq $true
            site_root_ok = ($runtime.Ok -eq $true)
            served_site_root = [string]$runtime.SiteRoot
            served_commit = if (-not [string]::IsNullOrWhiteSpace([string]$runtime.CurrentCommit)) { [string]$runtime.CurrentCommit } else { [string]$runtime.DesiredCommit }
            caddy_runtime_config_path = [string]$runtime.CaddyRuntimeConfigPath
            auth_mode = [string]$auth.Mode
            auth_transport = [string]$auth.Transport
            auth_status = [string]$auth.Status
            smoke_ok = $smoke.Ok -eq $true
            supervisor_state = $supervisorState
            degraded = $degraded
            repair_attempted = $repairAttempted
            last_repair_at = $lastRepairAtText
            repair_timeout = $statusRepairTimeout
            repair_child_pid = $repairChildPid
            repair_error = $repairError
            lock_state = [string]$lockSnapshot.lock_state
            lock_reason = [string]$lockSnapshot.lock_reason
            lock_owner_pid = [int]$lockSnapshot.owner_pid
            lock_started_at = [string]$lockSnapshot.started_at
            lock_age_seconds = [int]$lockSnapshot.age_seconds
            rollback_performed = $false
            rollback_reason = ''
            last_successful_deploy_at = ''
            last_failure_reason = $lastFailureReason
            php_pids = @($service.PhpPids)
            caddy_pids = @($service.CaddyPids)
            cloudflared_pids = @($service.CloudflaredPids)
            helper_pids = @($service.HelperPids)
            mirror_repo_path = $mirrorRepoPathResolved
            release_target_path = $releaseTargetPathResolved
            external_env_path = $externalEnvPathResolved
        }

        Merge-SyncStatus -CurrentStatus $status -SyncStatus $syncStatus
        Write-HostingJsonFile -Path $statusPathResolved -Payload $status

        if ($degraded -and -not [string]::IsNullOrWhiteSpace($repairError)) {
            Write-Info ("Supervisor detecto degradacion persistente: service_state={0} auth_transport={1}" -f $status.service_state, $status.auth_transport)
        }

        if ($RunOnce) {
            break
        }

        Start-Sleep -Seconds $LoopDelaySeconds
    }
} finally {
    if ($null -ne $lockStream) {
        $lockStream.Dispose()
    }

    $lockSnapshot = Get-LockSnapshot -InfoPath $lockInfoPath -TtlSeconds $LockTtlSeconds
    if (($lockSnapshot.owner_pid -eq 0) -or ($lockSnapshot.owner_pid -eq $PID) -or (-not (Test-HostingProcessExists -ProcessId $lockSnapshot.owner_pid))) {
        Clear-SupervisorLockArtifacts
    }
}
