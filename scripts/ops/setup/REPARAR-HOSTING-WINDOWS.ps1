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
    $caddyProcesses = Get-HostingProcessesByNeedle -Needles @('caddy.exe', 'ops\caddy\Caddyfile', 'run')
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
        ([string]$payload.mode -eq 'openclaw_chatgpt') -and
        ([string]$payload.transport -eq 'web_broker') -and
        ([string]$payload.status -ne 'transport_misconfigured')

    return [PSCustomObject]@{
        Ok = $ok
        Mode = if ($null -eq $payload) { '' } else { [string]$payload.mode }
        Transport = if ($null -eq $payload) { '' } else { [string]$payload.transport }
        Status = if ($null -eq $payload) { '' } else { [string]$payload.status }
        Error = if ($ok) { '' } elseif (-not [string]::IsNullOrWhiteSpace($response.Error)) { $response.Error } else { 'Contrato OpenClaw invalido.' }
    }
}

function Invoke-LocalHealthCheck {
    $response = Invoke-HostingJsonRequest `
        -Url 'http://127.0.0.1/api.php?resource=health-diagnostics' `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec 15

    return [PSCustomObject]@{
        Ok = ($response.Ok -and $response.Payload.ok -eq $true)
        Error = if ($response.Ok -or [string]::IsNullOrWhiteSpace($response.Error)) { '' } else { $response.Error }
    }
}

function Invoke-LocalSmoke {
    param([string]$ScriptPath)

    if (-not (Test-Path -LiteralPath $ScriptPath)) {
        throw "No existe el smoke canonico: $ScriptPath"
    }

    $result = Start-Process `
        -FilePath $powershellExe `
        -ArgumentList @(
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-File', $ScriptPath,
            '-BaseUrl', 'http://127.0.0.1',
            '-ExpectedAuthMode', 'openclaw_chatgpt',
            '-ExpectedTransport', 'web_broker',
            '-Quiet'
        ) `
        -NoNewWindow `
        -Wait `
        -PassThru

    if ($result.ExitCode -ne 0) {
        throw 'El smoke local del hosting no quedo sano despues de reparar.'
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

function Clear-HostingLocks {
    param([string]$HostingDir)

    $lockPatterns = @(
        'main-sync-status.json.lock',
        'main-sync-status.json.lock.json',
        'hosting-supervisor-status.json.lock',
        'hosting-supervisor-status.json.lock.json'
    )

    foreach ($pattern in $lockPatterns) {
        $candidate = Join-Path $HostingDir $pattern
        if (Test-Path -LiteralPath $candidate) {
            Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue
            Write-Info ("Lock eliminado: {0}" -f $candidate)
        }
    }
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
    param([switch]$CurrentPreflightOnly)

    $arguments = New-SyncArguments -CurrentPreflightOnly:$CurrentPreflightOnly
    return Invoke-HostingCommandWithOutput -FilePath $powershellExe -Arguments $arguments
}

function Invoke-ConfigScript {
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

    return Invoke-HostingCommandWithOutput -FilePath $powershellExe -Arguments $arguments
}

$status = [ordered]@{
    ok = $false
    timestamp = [DateTimeOffset]::Now.ToString('o')
    phase = 'discover'
    mirror_repo_path = $mirrorRepoPathResolved
    release_target_path = $releaseTargetPathResolved
    external_env_path = $externalEnvPathResolved
    desired_commit = ''
    current_commit = ''
    previous_commit = ''
    service_state = 'unknown'
    health_ok = $false
    auth_contract_ok = $false
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
    error = ''
}

try {
    Ensure-HostingParentDirectory -Path $statusPathResolved
    Ensure-HostingParentDirectory -Path $releaseTargetPathResolved
    $hostingDir = Split-Path -Parent $releaseTargetPathResolved

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

    $status.phase = 'preflight'
    $preflightResult = Invoke-SyncScript -CurrentPreflightOnly
    if ($preflightResult.ExitCode -ne 0) {
        throw ("Preflight del sync fallido. {0}" -f $preflightResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($preflightResult.Output)) {
        Write-Info $preflightResult.Output.Trim()
    }
    $status.preflight_ok = $true

    if ($PreflightOnly) {
        $status.ok = $true
        $status.phase = 'preflight_ready'
        Write-Status -Payload $status
        Write-Info 'Preflight de reparacion OK; no se tocaron procesos activos.'
        exit 0
    }

    $status.phase = 'quiesce'
    foreach ($taskName in $taskNames) {
        Stop-TaskIfPresent -TaskName $taskName
    }
    Stop-HostingProcessesByNeedle -Needles @('SUPERVISAR-HOSTING-WINDOWS.ps1') -Label 'Hosting supervisor'
    Stop-HostingProcessesByNeedle -Needles @('openclaw-auth-helper.js') -Label 'OpenClaw auth helper'
    Clear-HostingLocks -HostingDir $hostingDir

    $status.phase = 'apply'
    $syncResult = Invoke-SyncScript
    if ($syncResult.ExitCode -ne 0) {
        throw ("SINCRONIZAR-HOSTING-WINDOWS.ps1 no pudo recuperar el servicio. {0}" -f $syncResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($syncResult.Output)) {
        Write-Info $syncResult.Output.Trim()
    }

    $status.phase = 'reinstall'
    $configResult = Invoke-ConfigScript
    if ($configResult.ExitCode -ne 0) {
        throw ("CONFIGURAR-HOSTING-WINDOWS.ps1 no pudo reinstalar el supervisor. {0}" -f $configResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($configResult.Output)) {
        Write-Info $configResult.Output.Trim()
    }

    if (Test-Path -LiteralPath $supervisorLauncherPath) {
        Start-Process -FilePath $supervisorLauncherPath -WindowStyle Hidden | Out-Null
        Write-Info 'Supervisor lanzado en la sesion actual tras la reparacion.'
    }

    $status.phase = 'validate'
    Invoke-LocalSmoke -ScriptPath $smokeScriptPath

    $syncStatusPath = Join-Path $hostingDir 'main-sync-status.json'
    $syncStatus = Read-HostingJsonFileSafe -Path $syncStatusPath
    if ($null -ne $syncStatus) {
        try { $status.desired_commit = [string]$syncStatus.desired_commit } catch {}
        try { $status.current_commit = [string]$syncStatus.current_commit } catch {}
        try { $status.previous_commit = [string]$syncStatus.previous_commit } catch {}
        try { $status.last_successful_deploy_at = [string]$syncStatus.last_successful_deploy_at } catch {}
        try { $status.rollback_performed = ($syncStatus.rollback_performed -eq $true) } catch {}
        try { $status.rollback_reason = [string]$syncStatus.rollback_reason } catch {}
        try { $status.service_state = [string]$syncStatus.service_state } catch {}
        try { $status.health_ok = ($syncStatus.health_ok -eq $true) } catch {}
        try { $status.auth_contract_ok = ($syncStatus.auth_contract_ok -eq $true) } catch {}
        try { $status.auth_mode = [string]$syncStatus.auth_mode } catch {}
        try { $status.auth_transport = [string]$syncStatus.auth_transport } catch {}
        try { $status.auth_status = [string]$syncStatus.auth_status } catch {}
        try { $status.last_failure_reason = [string]$syncStatus.last_failure_reason } catch {}
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

    $status.ok = $true
    $status.repaired = $true
    $status.phase = 'completed'
    $status.error = ''
    Write-Status -Payload $status
    Write-Info 'Reparacion completada con health/auth/smoke locales en verde.'
} catch {
    $status.error = $_.Exception.Message
    $status.last_failure_reason = $status.error
    $status.phase = if (($status.phase -eq 'discover') -or ($status.phase -eq 'preflight')) { 'failed_preflight' } else { 'failed' }
    Write-Status -Payload $status
    Write-Info ("Reparacion fallida: {0}" -f $status.error)
    throw
}
