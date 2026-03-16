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
    [int]$RepairCooldownSeconds = 90,
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
$lockInfoPath = $lockPath + '.json'
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source

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

    $snapshot = [ordered]@{
        owner_pid = 0
        started_at = ''
        age_seconds = 0
        owner_active = $false
        stale = $false
    }

    $payload = Read-HostingJsonFileSafe -Path $InfoPath
    if ($null -ne $payload) {
        try { $snapshot.owner_pid = [int]$payload.owner_pid } catch {}
        try { $snapshot.started_at = [string]$payload.started_at } catch {}
    }

    if ($snapshot.owner_pid -gt 0) {
        $snapshot.owner_active = Test-HostingProcessExists -ProcessId $snapshot.owner_pid
    }

    if (-not [string]::IsNullOrWhiteSpace($snapshot.started_at)) {
        try {
            $started = [DateTimeOffset]::Parse($snapshot.started_at)
            $snapshot.age_seconds = [int][Math]::Max(0, ([DateTimeOffset]::Now - $started).TotalSeconds)
        } catch {
            $snapshot.age_seconds = 0
        }
    }

    $snapshot.stale =
        (($snapshot.owner_pid -gt 0) -and (-not $snapshot.owner_active)) -or
        (($snapshot.age_seconds -gt 0) -and ($snapshot.age_seconds -ge $TtlSeconds))

    return [PSCustomObject]$snapshot
}

function Clear-SupervisorLockArtifacts {
    foreach ($path in @($lockPath, $lockInfoPath)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
}

function Acquire-SupervisorLock {
    foreach ($attempt in 1..2) {
        try {
            $stream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            Write-HostingJsonFile -Path $lockInfoPath -Payload ([ordered]@{
                owner_pid = $PID
                started_at = [DateTimeOffset]::Now.ToString('o')
            })
            return [PSCustomObject]@{
                Acquired = $true
                Stream = $stream
                Snapshot = [PSCustomObject]@{
                    owner_pid = $PID
                    started_at = [DateTimeOffset]::Now.ToString('o')
                    age_seconds = 0
                    owner_active = $true
                    stale = $false
                }
            }
        } catch {
            $snapshot = Get-LockSnapshot -InfoPath $lockInfoPath -TtlSeconds $LockTtlSeconds
            if ($snapshot.stale -and $attempt -eq 1) {
                Write-Info ("Supervisor detecto stale lock owner_pid={0} age_seconds={1}; se libera." -f $snapshot.owner_pid, $snapshot.age_seconds)
                Clear-SupervisorLockArtifacts
                Start-Sleep -Milliseconds 200
                continue
            }

            return [PSCustomObject]@{
                Acquired = $false
                Stream = $null
                Snapshot = $snapshot
            }
        }
    }

    return [PSCustomObject]@{
        Acquired = $false
        Stream = $null
        Snapshot = (Get-LockSnapshot -InfoPath $lockInfoPath -TtlSeconds $LockTtlSeconds)
    }
}

function Get-ServiceState {
    param([string]$CurrentTunnelId)

    $phpProcesses = Get-HostingProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000')
    $caddyProcesses = Get-HostingProcessesByNeedle -Needles @('caddy.exe', 'ops\caddy\Caddyfile', 'run')
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

    return [PSCustomObject]@{
        Ok = ($response.Ok -and $response.Payload.ok -eq $true)
        Error = if ($response.Ok -or [string]::IsNullOrWhiteSpace($response.Error)) { '' } else { $response.Error }
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
        ([string]$payload.mode -eq 'openclaw_chatgpt') -and
        ([string]$payload.transport -eq 'web_broker') -and
        ([string]$payload.status -ne 'transport_misconfigured')

    return [PSCustomObject]@{
        Ok = $ok
        Mode = if ($null -eq $payload) { '' } else { [string]$payload.mode }
        Transport = if ($null -eq $payload) { '' } else { [string]$payload.transport }
        Status = if ($null -eq $payload) { '' } else { [string]$payload.status }
        Error = if ($ok) { '' } elseif (-not [string]::IsNullOrWhiteSpace($response.Error)) { $response.Error } else { 'Contrato OpenClaw invalido en supervisor.' }
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
        $result = Start-Process `
            -FilePath $powershellExe `
            -ArgumentList @(
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', $ScriptPath,
                '-BaseUrl', 'http://127.0.0.1',
                '-ExpectedAuthMode', 'openclaw_chatgpt',
                '-ExpectedTransport', 'web_broker',
                '-ReportPath', $reportPath,
                '-Quiet'
            ) `
            -NoNewWindow `
            -Wait `
            -PassThru

        $payload = Read-HostingJsonFileSafe -Path $reportPath
        return [PSCustomObject]@{
            Ok = ($result.ExitCode -eq 0) -and ($null -ne $payload) -and ($payload.ok -eq $true)
            Error = if ($null -eq $payload) { 'No se genero reporte de smoke.' } else { [string]$payload.error }
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

    $result = Start-Process `
        -FilePath $powershellExe `
        -ArgumentList $arguments `
        -NoNewWindow `
        -Wait `
        -PassThru

    if ($result.ExitCode -ne 0) {
        throw 'REPARAR-HOSTING-WINDOWS.ps1 no pudo recuperar el servicio.'
    }
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

function Merge-SyncStatus {
    param(
        [hashtable]$CurrentStatus,
        [object]$SyncStatus
    )

    if ($null -eq $SyncStatus) {
        return
    }

    try { $CurrentStatus.desired_commit = [string]$SyncStatus.desired_commit } catch {}
    try { $CurrentStatus.current_commit = [string]$SyncStatus.current_commit } catch {}
    try { $CurrentStatus.previous_commit = [string]$SyncStatus.previous_commit } catch {}
    try { $CurrentStatus.deploy_state = [string]$SyncStatus.deploy_state } catch {}
    try { $CurrentStatus.service_state = [string]$SyncStatus.service_state } catch {}
    try { $CurrentStatus.health_ok = ($SyncStatus.health_ok -eq $true) } catch {}
    try { $CurrentStatus.auth_contract_ok = ($SyncStatus.auth_contract_ok -eq $true) } catch {}
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

try {
    Ensure-HostingParentDirectory -Path $statusPathResolved
    $lockResult = Acquire-SupervisorLock
    if (-not $lockResult.Acquired) {
        $status = [ordered]@{
            ok = $false
            timestamp = [DateTimeOffset]::Now.ToString('o')
            desired_commit = Get-DesiredCommit
            current_commit = ''
            previous_commit = ''
            deploy_state = 'waiting_for_lock'
            service_state = 'unknown'
            health_ok = $false
            auth_contract_ok = $false
            auth_mode = ''
            auth_transport = ''
            auth_status = ''
            supervisor_state = 'failed'
            degraded = $true
            repair_attempted = $false
            last_repair_at = ''
            repair_error = 'supervisor_already_running'
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
        $smoke = if ($health.Ok -and $auth.Ok) {
            Invoke-HostingSmoke -ScriptPath $smokeScriptPath
        } else {
            [PSCustomObject]@{
                Ok = $false
                Error = 'health/auth aun no estan sanos.'
            }
        }

        $degraded = ($service.State -ne 'running') -or (-not $health.Ok) -or (-not $auth.Ok) -or (-not $smoke.Ok)
        $repairAttempted = $false
        $repairError = ''

        if ($degraded) {
            $age = ([DateTimeOffset]::Now - $lastRepairAt).TotalSeconds
            if ($age -ge $RepairCooldownSeconds) {
                $repairAttempted = $true
                try {
                    Invoke-Repair -ScriptPath $repairScriptPath
                    $lastRepairAt = [DateTimeOffset]::Now
                    $service = Get-ServiceState -CurrentTunnelId $TunnelId
                    $health = Invoke-LocalHealth
                    $auth = Invoke-LocalAuth
                    $smoke = if ($health.Ok -and $auth.Ok) {
                        Invoke-HostingSmoke -ScriptPath $smokeScriptPath
                    } else {
                        [PSCustomObject]@{
                            Ok = $false
                            Error = 'health/auth aun no estan sanos.'
                        }
                    }
                    $degraded = ($service.State -ne 'running') -or (-not $health.Ok) -or (-not $auth.Ok) -or (-not $smoke.Ok)
                } catch {
                    $repairError = $_.Exception.Message
                    $lastRepairAt = [DateTimeOffset]::Now
                    Write-Info ("Supervisor no pudo reparar el hosting: {0}" -f $repairError)
                }
            }
        }

        $syncStatus = Read-HostingJsonFileSafe -Path $mainSyncStatusPath
        $lockSnapshot = Get-LockSnapshot -InfoPath $lockInfoPath -TtlSeconds $LockTtlSeconds
        $supervisorState = if ($repairAttempted -and [string]::IsNullOrWhiteSpace($repairError)) {
            'recovering'
        } elseif ($degraded -and -not [string]::IsNullOrWhiteSpace($repairError)) {
            'failed'
        } elseif ($degraded) {
            'degraded'
        } else {
            'running'
        }

        $status = [ordered]@{
            ok = (-not $degraded)
            timestamp = [DateTimeOffset]::Now.ToString('o')
            desired_commit = Get-DesiredCommit
            current_commit = ''
            previous_commit = ''
            deploy_state = if ($degraded) { 'degraded' } else { 'current' }
            service_state = [string]$service.State
            health_ok = $health.Ok -eq $true
            auth_contract_ok = $auth.Ok -eq $true
            auth_mode = [string]$auth.Mode
            auth_transport = [string]$auth.Transport
            auth_status = [string]$auth.Status
            smoke_ok = $smoke.Ok -eq $true
            supervisor_state = $supervisorState
            degraded = $degraded
            repair_attempted = $repairAttempted
            last_repair_at = if ($lastRepairAt -eq [DateTimeOffset]::MinValue) { '' } else { $lastRepairAt.ToString('o') }
            repair_error = $repairError
            lock_owner_pid = [int]$lockSnapshot.owner_pid
            lock_started_at = [string]$lockSnapshot.started_at
            lock_age_seconds = [int]$lockSnapshot.age_seconds
            rollback_performed = $false
            rollback_reason = ''
            last_successful_deploy_at = ''
            last_failure_reason = if (-not [string]::IsNullOrWhiteSpace($repairError)) { $repairError } else { '' }
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
