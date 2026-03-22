param(
    [string]$MirrorRepoPath = 'C:\dev\pielarmonia-clean-main',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$StatusPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync-status.json',
    [string]$LogPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync.log',
    [string]$ReleaseTargetPath = 'C:\ProgramData\Pielarmonia\hosting\release-target.runtime.json',
    [string]$RepoUrl = 'https://github.com/erosero558558/piel-en-armonia.git',
    [string]$Branch = 'main',
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [string]$CaddyExePath = '',
    [string]$CloudflaredExePath = '',
    [string]$PhpCgiExePath = '',
    [int]$LockTtlSeconds = 600,
    [switch]$BootstrapReleaseTargetIfMissing,
    [switch]$PreflightOnly,
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
$expectedCaddyTemplatePath = [string]$runtimePaths.CaddyTemplatePath
$expectedCaddyAccessLogPath = [string]$runtimePaths.CaddyAccessLogPath
$statusPathResolved = [System.IO.Path]::GetFullPath($StatusPath)
$logPathResolved = [System.IO.Path]::GetFullPath($LogPath)
$externalEnvPathResolved = [System.IO.Path]::GetFullPath($ExternalEnvPath)
$releaseTargetPathResolved = [System.IO.Path]::GetFullPath($ReleaseTargetPath)
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}
$mirrorEnvPath = Join-Path $mirrorRepoPathResolved 'env.php'
$mirrorStartScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\ARRANCAR-HOSTING-WINDOWS.ps1'
$lockPath = $statusPathResolved + '.lock'
$lockInfoPath = Get-HostingLockInfoPath -LockDirectoryPath $lockPath
$gitExe = (Get-Command git -ErrorAction Stop).Source
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source
$npmExe = (Get-Command npm.cmd -ErrorAction SilentlyContinue | Select-Object -First 1).Source
if ([string]::IsNullOrWhiteSpace($npmExe)) {
    $npmExe = (Get-Command npm -ErrorAction Stop).Source
}
$generatedSiteRootPath = Join-Path $mirrorRepoPathResolved '.generated\site-root'
$publicBuildReportPath = Join-Path $runtimePaths.RuntimeRoot 'public-v6-build-report.json'
$astroBinaryCandidates = @(
    'node_modules\.bin\astro.cmd',
    'node_modules\.bin\astro'
)
$arrancarTimeoutSeconds = 90
$validationTimeoutSeconds = 90
$npmInstallTimeoutSeconds = 1800
$publicBuildTimeoutSeconds = 600
$requiredGeneratedDirectories = @(
    'es',
    'en',
    '_astro'
)
$optionalGeneratedDirectories = @(
    'js\chunks',
    'js\engines',
    'js\admin-chunks'
)
$optionalGeneratedFiles = @(
    'script.js',
    'admin.js',
    'js\booking-calendar.js',
    'js\queue-kiosk.js',
    'js\queue-display.js'
)

function Write-Info {
    param([string]$Message)

    $line = ('[{0}] {1}' -f ([DateTimeOffset]::Now.ToString('o')), $Message)
    Ensure-HostingParentDirectory -Path $logPathResolved
    Add-Content -Path $logPathResolved -Value $line -Encoding ASCII
    if (-not $Quiet) {
        Write-Host "[hosting-sync] $Message"
    }
}

function Write-Status {
    param([hashtable]$Payload)

    $Payload.timestamp = [DateTimeOffset]::Now.ToString('o')
    Write-HostingJsonFile -Path $statusPathResolved -Payload $Payload
}

function Invoke-Git {
    param([string[]]$Arguments)

    return Invoke-HostingCommandWithOutput -FilePath $gitExe -Arguments $Arguments
}

function Get-GitHeadSafe {
    param([string]$RepoPath)

    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
        return ''
    }

    $result = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', 'HEAD')
    if ($result.ExitCode -ne 0) {
        return ''
    }

    return [string]($result.Output.Trim())
}

function Get-GitRevisionOrThrow {
    param(
        [string]$RepoPath,
        [string]$Revision,
        [string]$ErrorMessage
    )

    $result = Invoke-Git -Arguments @('-C', $RepoPath, 'rev-parse', $Revision)
    if ($result.ExitCode -ne 0) {
        throw ("{0} {1}" -f $ErrorMessage, $result.Output.Trim())
    }

    return [string]($result.Output.Trim())
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

function Clear-SyncLockArtifacts {
    param(
        [string]$CurrentLockPath,
        [string]$CurrentLockInfoPath
    )

    if (Test-Path -LiteralPath $CurrentLockPath) {
        Remove-HostingDirectoryLock -LockDirectoryPath $CurrentLockPath -Force | Out-Null
        if (Test-Path -LiteralPath $CurrentLockPath) {
            Remove-Item -LiteralPath $CurrentLockPath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    foreach ($legacyPath in @($CurrentLockInfoPath, ($CurrentLockPath + '.json'))) {
        if (Test-Path -LiteralPath $legacyPath) {
            Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Acquire-SyncLock {
    param(
        [string]$CurrentLockPath,
        [string]$CurrentLockInfoPath,
        [int]$TtlSeconds
    )

    $result = Acquire-HostingDirectoryLock `
        -LockDirectoryPath $CurrentLockPath `
        -TtlSeconds $TtlSeconds `
        -GraceSeconds 5 `
        -Reason 'main_sync'

    return [PSCustomObject]@{
        Acquired = $result.Acquired
        Stream = $null
        Snapshot = $result.Snapshot
    }
}

function Get-ServiceSnapshot {
    param([string]$CurrentTunnelId)

    $phpProcesses = Get-HostingProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000')
    $caddyProcesses = Get-HostingProcessesByNeedle -Needles @('caddy.exe', 'run')
    $cloudflaredProcesses = Get-HostingProcessesByNeedle -Needles @('cloudflared.exe', $CurrentTunnelId, '--url http://127.0.0.1')
    $helperProcesses = Get-HostingProcessesByNeedle -Needles @('openclaw-auth-helper.js')

    $primaryHealthy = ($phpProcesses.Count -gt 0) -and ($caddyProcesses.Count -gt 0) -and ($cloudflaredProcesses.Count -gt 0)
    $state = if ($primaryHealthy) {
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

function Invoke-HealthDiagnostics {
    $response = Invoke-HostingJsonRequest `
        -Url 'http://127.0.0.1/api.php?resource=health-diagnostics' `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec 20

    $healthError = ''
    if ((-not $response.Ok) -and (-not [string]::IsNullOrWhiteSpace($response.Error))) {
        $healthError = $response.Error
    }

    return [PSCustomObject]@{
        Ok = ($response.Ok -and $response.Payload.ok -eq $true)
        Payload = $response.Payload
        Error = $healthError
    }
}

function Invoke-OperatorAuthStatus {
    $response = Invoke-HostingJsonRequest `
        -Url 'http://127.0.0.1/admin-auth.php?action=status' `
        -Headers @{ Accept = 'application/json' } `
        -TimeoutSec 20
    $payload = $response.Payload
    $mode = [string]($payload.mode)
    $transport = [string]($payload.transport)
    $status = [string]($payload.status)
    $ok =
        $response.Ok -and
        (
            [string]::Equals($mode, 'openclaw_chatgpt', [System.StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($mode, 'google_oauth', [System.StringComparison]::OrdinalIgnoreCase)
        ) -and
        [string]::Equals($transport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase) -and
        (-not [string]::Equals($status, 'transport_misconfigured', [System.StringComparison]::OrdinalIgnoreCase))

    $authError = ''
    if (-not $ok) {
        if (-not [string]::IsNullOrWhiteSpace($response.Error)) {
            $authError = $response.Error
        } else {
            $authError = 'admin-auth.php?action=status no publico un contrato Operator Auth valido.'
        }
    }

    return [PSCustomObject]@{
        Ok = $ok
        Payload = $payload
        Error = $authError
    }
}

function Test-TransientMirrorValidationFailure {
    param([PSCustomObject]$Validation)

    if ($null -eq $Validation) {
        return $false
    }

    $runtimeError = ''
    $runtimeSiteRoot = ''
    $serviceState = ''
    $healthError = ''
    $authError = ''
    try { $runtimeError = [string]$Validation.Runtime.Error } catch {}
    try { $runtimeSiteRoot = [string]$Validation.Runtime.SiteRoot } catch {}
    try { $serviceState = [string]$Validation.Service.State } catch {}
    try { $healthError = [string]$Validation.Health.Error } catch {}
    try { $authError = [string]$Validation.Auth.Error } catch {}

    if (
        [string]::IsNullOrWhiteSpace($runtimeSiteRoot) -and
        (
            [string]::Equals($runtimeError, 'runtime_fingerprint_unavailable', [System.StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($runtimeError, 'site_root_mismatch', [System.StringComparison]::OrdinalIgnoreCase)
        )
    ) {
        return $true
    }

    if (
        (
            [string]::Equals($serviceState, 'degraded', [System.StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($serviceState, 'stopped', [System.StringComparison]::OrdinalIgnoreCase)
        ) -and
        (
            $healthError -match '502|Bad Gateway|Unable to connect' -or
            $authError -match '502|Bad Gateway|Unable to connect'
        )
    ) {
        return $true
    }

    return $false
}

function Update-ReleaseTarget {
    param(
        [string]$Path,
        [string]$TargetCommit,
        [string]$SourceRunId,
        [string]$ApprovedBy = 'windows_hosting_sync',
        [string]$RollbackReason = '',
        [string]$PreviousTargetCommit = ''
    )

    $resolvedSourceRunId = $SourceRunId
    if ([string]::IsNullOrWhiteSpace($resolvedSourceRunId)) {
        $resolvedSourceRunId = 'windows_hosting_sync'
    }

    $payload = [ordered]@{
        target_commit = $TargetCommit
        approved_at = [DateTimeOffset]::Now.ToString('o')
        source_run_id = $resolvedSourceRunId
        approved_by = $ApprovedBy
    }

    if (-not [string]::IsNullOrWhiteSpace($RollbackReason)) {
        $payload.rollback_reason = $RollbackReason
    }
    if (-not [string]::IsNullOrWhiteSpace($PreviousTargetCommit)) {
        $payload.previous_target_commit = $PreviousTargetCommit
    }

    Write-HostingJsonFile -Path $Path -Payload $payload
    return $payload
}

function Resolve-DesiredCommit {
    param(
        [string]$CurrentReleaseTargetPath,
        [string]$CurrentRemoteHead,
        [switch]$AllowBootstrap
    )

    $releaseTarget = Read-HostingJsonFileSafe -Path $CurrentReleaseTargetPath
    $targetCommit = ''

    if ($null -ne $releaseTarget) {
        try { $targetCommit = [string]$releaseTarget.target_commit } catch { $targetCommit = '' }
    }

    if ([string]::IsNullOrWhiteSpace($targetCommit)) {
        if (-not $AllowBootstrap) {
            throw "No existe release-target canonico en $CurrentReleaseTargetPath. Inicializa el pin con REPARAR-HOSTING-WINDOWS.ps1 o CONFIGURAR-HOSTING-WINDOWS.ps1."
        }

        $releaseTarget = Update-ReleaseTarget `
            -Path $CurrentReleaseTargetPath `
            -TargetCommit $CurrentRemoteHead `
            -SourceRunId 'bootstrap_local' `
            -ApprovedBy 'windows_hosting_sync_bootstrap'
        $targetCommit = $CurrentRemoteHead
        Write-Info ("Release target bootstrapeado en {0}: {1}" -f $CurrentReleaseTargetPath, $targetCommit)
    }

    return [PSCustomObject]@{
        TargetCommit = $targetCommit
        Payload = $releaseTarget
    }
}

function Test-PublishedGeneratedArtifactsReady {
    param([string]$RepoPath)

    foreach ($relativePath in $requiredGeneratedDirectories) {
        if (-not (Test-Path -LiteralPath (Join-Path $RepoPath $relativePath) -PathType Container)) {
            return $false
        }
    }

    return $true
}

function Remove-PublishedGeneratedArtifacts {
    param([string]$RepoPath)

    foreach ($relativePath in $requiredGeneratedDirectories) {
        $targetPath = Join-Path $RepoPath $relativePath
        if (Test-Path -LiteralPath $targetPath) {
            Remove-Item -LiteralPath $targetPath -Recurse -Force -ErrorAction Stop
        }
    }
}

function Publish-PublicGeneratedArtifacts {
    param(
        [string]$RepoPath,
        [string]$GeneratedRootPath
    )

    if (-not (Test-Path -LiteralPath $GeneratedRootPath -PathType Container)) {
        throw "No existe .generated/site-root para publicar: $GeneratedRootPath"
    }

    foreach ($relativePath in $requiredGeneratedDirectories) {
        $sourcePath = Join-Path $GeneratedRootPath $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
            throw "Falta directorio generado requerido: $relativePath"
        }
    }

    Remove-PublishedGeneratedArtifacts -RepoPath $RepoPath

    foreach ($relativePath in $requiredGeneratedDirectories) {
        $sourcePath = Join-Path $GeneratedRootPath $relativePath
        $targetPath = Join-Path $RepoPath $relativePath
        Ensure-HostingParentDirectory -Path $targetPath
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse -Force
    }

    foreach ($relativePath in $optionalGeneratedDirectories) {
        $sourcePath = Join-Path $GeneratedRootPath $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
            continue
        }
        $targetPath = Join-Path $RepoPath $relativePath
        Ensure-HostingParentDirectory -Path $targetPath
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Recurse -Force
    }

    foreach ($relativePath in $optionalGeneratedFiles) {
        $sourcePath = Join-Path $GeneratedRootPath $relativePath
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
            continue
        }
        $targetPath = Join-Path $RepoPath $relativePath
        Ensure-HostingParentDirectory -Path $targetPath
        Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force
    }
}

function Invoke-PublicBuildAndPublish {
    param([string]$RepoPath)

    $hasAstroBinary = $false
    foreach ($relativePath in $astroBinaryCandidates) {
        if (Test-Path -LiteralPath (Join-Path $RepoPath $relativePath) -PathType Leaf) {
            $hasAstroBinary = $true
            break
        }
    }

    if (-not $hasAstroBinary) {
        Push-Location $RepoPath
        try {
            $installResult = Invoke-HostingCommandWithOutput `
                -FilePath $npmExe `
                -Arguments @('ci') `
                -TimeoutSeconds $npmInstallTimeoutSeconds `
                -HeartbeatPath $statusPathResolved `
                -Label 'npm ci'
            if ($installResult.TimedOut -eq $true) {
                throw 'public_deps_install_timeout'
            }
            if ($installResult.ExitCode -ne 0) {
                if (-not [string]::IsNullOrWhiteSpace($installResult.Output)) {
                    Write-Info $installResult.Output.Trim()
                }
                throw 'public_deps_install_failed'
            }
        } finally {
            Pop-Location
        }
    }

    Ensure-HostingParentDirectory -Path $publicBuildReportPath
    if (Test-Path -LiteralPath $publicBuildReportPath) {
        Remove-Item -LiteralPath $publicBuildReportPath -Force -ErrorAction SilentlyContinue
    }

    Push-Location $RepoPath
    try {
        $buildResult = Invoke-HostingCommandWithOutput `
            -FilePath $npmExe `
            -Arguments @('run', 'build:public:v6', '--', '--report', $publicBuildReportPath) `
            -TimeoutSeconds $publicBuildTimeoutSeconds `
            -HeartbeatPath $statusPathResolved `
            -Label 'build:public:v6'
        if ($buildResult.TimedOut -eq $true) {
            throw 'public_build_timeout'
        }
        if ($buildResult.ExitCode -ne 0) {
            if (-not [string]::IsNullOrWhiteSpace($buildResult.Output)) {
                Write-Info $buildResult.Output.Trim()
            }
            throw 'public_build_failed'
        }
    } finally {
        Pop-Location
    }

    Publish-PublicGeneratedArtifacts -RepoPath $RepoPath -GeneratedRootPath $generatedSiteRootPath
}

function Invoke-StartMirrorStack {
    param(
        [string]$StartScriptPath,
        [string]$CurrentPublicDomain,
        [string]$CurrentTunnelId,
        [string]$CurrentOperatorUserProfile,
        [string]$CurrentCaddyExePath,
        [string]$CurrentCloudflaredExePath,
        [string]$CurrentPhpCgiExePath
    )

    if (-not (Test-Path -LiteralPath $StartScriptPath)) {
        throw "No existe el script de arranque del mirror: $StartScriptPath"
    }

    $arguments = New-Object 'System.Collections.Generic.List[string]'
    foreach ($token in @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $StartScriptPath,
        '-PublicDomain', $CurrentPublicDomain,
        '-TunnelId', $CurrentTunnelId,
        '-ExternalEnvPath', $externalEnvPathResolved,
        '-OperatorUserProfile', $CurrentOperatorUserProfile,
        '-StopLegacy',
        '-Quiet'
    )) {
        $arguments.Add([string]$token) | Out-Null
    }
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-CaddyExePath' -Value $CurrentCaddyExePath
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-CloudflaredExePath' -Value $CurrentCloudflaredExePath
    Add-HostingOptionalNamedArgument -Arguments $arguments -Name '-PhpCgiExePath' -Value $CurrentPhpCgiExePath

    $result = Invoke-HostingCommandWithOutput `
        -FilePath $powershellExe `
        -Arguments $arguments `
        -TimeoutSeconds $arrancarTimeoutSeconds `
        -HeartbeatPath $statusPathResolved `
        -Label 'ARRANCAR-HOSTING-WINDOWS.ps1'
    if ($result.TimedOut -eq $true) {
        throw 'sync_restart_timeout'
    }
    if ($result.ExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($result.Output)) {
            Write-Info $result.Output.Trim()
        }
        throw 'El stack del mirror no pudo reiniciarse correctamente.'
    }

    if (-not [string]::IsNullOrWhiteSpace($result.Output)) {
        Write-Info $result.Output.Trim()
    }

    return $result
}

function Invoke-ValidateMirror {
    param(
        [string]$CurrentTunnelId,
        [string]$ExpectedSiteRoot,
        [string]$ExpectedCurrentCommit = '',
        [string]$ExpectedDesiredCommit = '',
        [string]$ExpectedRuntimeConfigPath = ''
    )

    $service = Get-ServiceSnapshot -CurrentTunnelId $CurrentTunnelId
    $health = Invoke-HealthDiagnostics
    $authContract = Invoke-OperatorAuthStatus
    $runtimeFingerprint = Invoke-HostingRuntimeFingerprint -BaseUrl 'http://127.0.0.1' -TimeoutSec 10
    $runtime = Test-HostingRuntimeFingerprintMatch `
        -Fingerprint $runtimeFingerprint `
        -ExpectedSiteRoot $ExpectedSiteRoot `
        -ExpectedCurrentCommit $ExpectedCurrentCommit `
        -ExpectedDesiredCommit $ExpectedDesiredCommit `
        -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath

    return [PSCustomObject]@{
        Ok = ($health.Ok -eq $true) -and ($runtime.Ok -eq $true) -and ($authContract.Ok -eq $true)
        Health = $health
        Auth = $authContract
        Service = $service
        Runtime = $runtime
    }
}

function Set-StatusFromValidation {
    param(
        [hashtable]$CurrentStatus,
        [PSCustomObject]$Validation
    )

    $CurrentStatus.health_ok = $Validation.Health.Ok -eq $true
    $CurrentStatus.auth_contract_ok = $Validation.Auth.Ok -eq $true
    $CurrentStatus.service_state = [string]$Validation.Service.State
    if ($null -ne $Validation.Runtime) {
        $CurrentStatus.site_root_ok = ($Validation.Runtime.Ok -eq $true)
        $CurrentStatus.served_site_root = [string]$Validation.Runtime.SiteRoot
        $CurrentStatus.served_commit = if (-not [string]::IsNullOrWhiteSpace([string]$Validation.Runtime.CurrentCommit)) { [string]$Validation.Runtime.CurrentCommit } else { [string]$Validation.Runtime.DesiredCommit }
        $CurrentStatus.caddy_runtime_config_path = [string]$Validation.Runtime.CaddyRuntimeConfigPath
    }
    if ($Validation.Auth.Payload) {
        $CurrentStatus.auth_mode = [string]$Validation.Auth.Payload.mode
        $CurrentStatus.auth_transport = [string]$Validation.Auth.Payload.transport
        $CurrentStatus.auth_status = [string]$Validation.Auth.Payload.status
    }
}

function Set-SyncPhase {
    param(
        [hashtable]$CurrentStatus,
        [string]$State,
        [string]$DeployState,
        [int]$TimeoutSeconds = 0
    )

    $now = [DateTimeOffset]::Now.ToString('o')
    $CurrentStatus.state = $State
    $CurrentStatus.deploy_state = $DeployState
    $CurrentStatus.phase_started_at = $now
    $CurrentStatus.phase_heartbeat_at = $now
    $CurrentStatus.phase_timeout_seconds = $TimeoutSeconds
    $CurrentStatus.timed_out = $false
    Write-Status -Payload $CurrentStatus
}

function Wait-ForMirrorValidation {
    param(
        [string]$CurrentTunnelId,
        [string]$ExpectedSiteRoot,
        [string]$ExpectedCurrentCommit = '',
        [string]$ExpectedDesiredCommit = '',
        [string]$ExpectedRuntimeConfigPath = '',
        [int]$TimeoutSeconds = 45
    )

    $deadline = [DateTimeOffset]::Now.AddSeconds($TimeoutSeconds)
    $lastValidation = $null
    $extendedForTransientGap = $false

    while ([DateTimeOffset]::Now -lt $deadline) {
        $lastValidation = Invoke-ValidateMirror `
            -CurrentTunnelId $CurrentTunnelId `
            -ExpectedSiteRoot $ExpectedSiteRoot `
            -ExpectedCurrentCommit $ExpectedCurrentCommit `
            -ExpectedDesiredCommit $ExpectedDesiredCommit `
            -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath
        if ($lastValidation.Ok) {
            return $lastValidation
        }

        if ((-not $extendedForTransientGap) -and (Test-TransientMirrorValidationFailure -Validation $lastValidation)) {
            $deadline = $deadline.AddSeconds(45)
            $extendedForTransientGap = $true
        }

        Set-HostingJsonFields -Path $statusPathResolved -Fields ([ordered]@{
            phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
            phase_timeout_seconds = $TimeoutSeconds
            timed_out = $false
        })
        Start-Sleep -Seconds 2
    }

    if ($null -eq $lastValidation) {
        return Invoke-ValidateMirror `
            -CurrentTunnelId $CurrentTunnelId `
            -ExpectedSiteRoot $ExpectedSiteRoot `
            -ExpectedCurrentCommit $ExpectedCurrentCommit `
            -ExpectedDesiredCommit $ExpectedDesiredCommit `
            -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath
    }

    return $lastValidation
}

$existingStatus = Read-HostingJsonFileSafe -Path $statusPathResolved
$existingReleaseTarget = Read-HostingJsonFileSafe -Path $releaseTargetPathResolved
$previousSuccessfulCommit = ''
$previousSuccessfulAt = ''
if ($null -ne $existingStatus) {
    try {
        if (($existingStatus.ok -eq $true) -and ($existingStatus.health_ok -eq $true) -and ($existingStatus.auth_contract_ok -eq $true)) {
            $previousSuccessfulCommit = [string]$existingStatus.current_commit
            $previousSuccessfulAt = [string]$existingStatus.last_successful_deploy_at
        }
    } catch {
    }
}

$status = [ordered]@{
    ok = $false
    state = 'starting'
    deploy_state = 'starting'
    timestamp = [DateTimeOffset]::Now.ToString('o')
    status_source = 'sync_runtime'
    phase_started_at = [DateTimeOffset]::Now.ToString('o')
    phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
    phase_timeout_seconds = 0
    timed_out = $false
    mirror_repo_path = $mirrorRepoPathResolved
    external_env_path = $externalEnvPathResolved
    release_target_path = $releaseTargetPathResolved
    repo_url = $RepoUrl
    branch = $Branch
    desired_commit = ''
    previous_commit = ''
    current_commit = ''
    previous_head = ''
    current_head = ''
    head_changed = $false
    env_changed = $false
    public_build_required = $false
    public_build_ran = $false
    public_artifacts_ok = $false
    public_build_report_path = $publicBuildReportPath
    restarted = $false
    cloned = $false
    health_ok = $false
    auth_contract_ok = $false
    site_root_ok = $false
    served_site_root = ''
    served_commit = ''
    caddy_runtime_config_path = $expectedCaddyRuntimeConfigPath
    auth_mode = ''
    auth_transport = ''
    auth_status = ''
    service_state = 'unknown'
    lock_state = 'missing'
    lock_reason = ''
    lock_owner_pid = 0
    lock_started_at = ''
    lock_age_seconds = 0
    lock_repaired = $false
    lock_repair_reason = ''
    rollback_performed = $false
    rollback_reason = ''
    last_successful_deploy_at = $previousSuccessfulAt
    last_failure_reason = ''
    error = ''
}

if ($null -ne $existingStatus) {
    try { $status.current_commit = [string]$existingStatus.current_commit } catch {}
    try { $status.current_head = [string]$existingStatus.current_head } catch {}
    try { $status.previous_commit = [string]$existingStatus.previous_commit } catch {}
    try { $status.previous_head = [string]$existingStatus.previous_head } catch {}
}
if ($null -ne $existingReleaseTarget) {
    try { $status.desired_commit = [string]$existingReleaseTarget.target_commit } catch {}
}

$lockStream = $null

try {
    Ensure-HostingParentDirectory -Path $statusPathResolved
    Ensure-HostingParentDirectory -Path $lockPath
    Ensure-HostingParentDirectory -Path $releaseTargetPathResolved
    Set-SyncPhase -CurrentStatus $status -State 'discovering' -DeployState 'discover'

    $lockRepair = Repair-HostingLegacyLocks -LockPaths @($lockPath) -TtlSeconds $LockTtlSeconds -GraceSeconds 5
    $status.lock_repaired = ($lockRepair.repaired -eq $true)
    $status.lock_repair_reason = [string]$lockRepair.repair_reason
    Write-Status -Payload $status
    if ($lockRepair.remaining_invalid_lock) {
        $status.state = 'failed'
        $status.deploy_state = 'lock_invalid'
        $status.error = 'sync_lock_unrecoverable'
        $status.last_failure_reason = $status.error
        $status.lock_state = 'lock_invalid'
        $status.lock_reason = if (-not [string]::IsNullOrWhiteSpace([string]$lockRepair.error)) { [string]$lockRepair.error } else { 'lock_unrecoverable' }
        $validation = Invoke-ValidateMirror `
            -CurrentTunnelId $TunnelId `
            -ExpectedSiteRoot $mirrorRepoPathResolved `
            -ExpectedCurrentCommit $status.current_commit `
            -ExpectedDesiredCommit $status.desired_commit `
            -ExpectedRuntimeConfigPath $expectedCaddyRuntimeConfigPath
        Set-StatusFromValidation -CurrentStatus $status -Validation $validation
        Write-Status -Payload $status
        throw 'sync_lock_unrecoverable'
    }

    $lockResult = Acquire-SyncLock `
        -CurrentLockPath $lockPath `
        -CurrentLockInfoPath $lockInfoPath `
        -TtlSeconds $LockTtlSeconds

    if (-not $lockResult.Acquired) {
        if ([int]$lockResult.Snapshot.owner_pid -le 0) {
            $retryRepair = Repair-HostingLegacyLocks -LockPaths @($lockPath) -TtlSeconds $LockTtlSeconds -GraceSeconds 5
            if ($retryRepair.repaired -eq $true) {
                $status.lock_repaired = $true
                $status.lock_repair_reason = [string]$retryRepair.repair_reason
            }
            if (-not $retryRepair.remaining_invalid_lock) {
                $lockResult = Acquire-SyncLock `
                    -CurrentLockPath $lockPath `
                    -CurrentLockInfoPath $lockInfoPath `
                    -TtlSeconds $LockTtlSeconds
            }
        }
    }

    if (-not $lockResult.Acquired) {
        $status.lock_owner_pid = [int]$lockResult.Snapshot.owner_pid
        $status.lock_started_at = [string]$lockResult.Snapshot.started_at
        $status.lock_age_seconds = [int]$lockResult.Snapshot.age_seconds
        $status.lock_state = [string]$lockResult.Snapshot.lock_state
        $status.lock_reason = [string]$lockResult.Snapshot.lock_reason
        if ($status.lock_owner_pid -gt 0) {
            $status.state = 'locked'
            $status.deploy_state = 'waiting_for_lock'
            $status.error = 'sync_already_running'
        } else {
            $status.state = 'failed'
            $status.deploy_state = 'lock_invalid'
            $status.error = 'sync_lock_unrecoverable'
        }
        $status.last_failure_reason = $status.error
        $validation = Invoke-ValidateMirror `
            -CurrentTunnelId $TunnelId `
            -ExpectedSiteRoot $mirrorRepoPathResolved `
            -ExpectedCurrentCommit $status.current_commit `
            -ExpectedDesiredCommit $status.desired_commit `
            -ExpectedRuntimeConfigPath $expectedCaddyRuntimeConfigPath
        Set-StatusFromValidation -CurrentStatus $status -Validation $validation
        Write-Status -Payload $status
        if ($status.lock_owner_pid -gt 0) {
            Write-Info ("Otro ciclo de sync sigue en ejecucion; owner_pid={0} age_seconds={1}" -f $status.lock_owner_pid, $status.lock_age_seconds)
            exit 0
        } else {
            Write-Info ("Lock invalido detectado; state={0} reason={1}" -f $status.lock_state, $status.lock_reason)
            throw 'sync_lock_unrecoverable'
        }
    }

    $lockStream = $lockResult.Stream
    $status.lock_owner_pid = $PID
    $status.lock_started_at = [DateTimeOffset]::Now.ToString('o')
    $status.lock_age_seconds = 0
    $status.lock_state = 'owned'
    $status.lock_reason = 'main_sync'
    Set-SyncPhase -CurrentStatus $status -State 'preflight' -DeployState 'preflight'

    if (-not (Test-Path -LiteralPath $externalEnvPathResolved)) {
        throw "No existe el env externo canonico: $externalEnvPathResolved"
    }

    if (Test-Path -LiteralPath $mirrorRepoPathResolved) {
        if (-not (Test-Path -LiteralPath (Join-Path $mirrorRepoPathResolved '.git'))) {
            throw "La ruta del mirror existe pero no es un repositorio git: $mirrorRepoPathResolved"
        }
    } else {
        Ensure-ParentDirectory -Path $mirrorRepoPathResolved
        $cloneResult = Invoke-Git -Arguments @('clone', '--branch', $Branch, '--single-branch', $RepoUrl, $mirrorRepoPathResolved)
        if ($cloneResult.ExitCode -ne 0) {
            throw ("No se pudo clonar origin/main en el mirror limpio. {0}" -f $cloneResult.Output.Trim())
        }
        $status.cloned = $true
        if (-not [string]::IsNullOrWhiteSpace($cloneResult.Output)) {
            Write-Info $cloneResult.Output.Trim()
        }
    }

    $remoteResult = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'remote', 'set-url', 'origin', $RepoUrl)
    if ($remoteResult.ExitCode -ne 0) {
        throw ("No se pudo fijar el remote origin del mirror. {0}" -f $remoteResult.Output.Trim())
    }

    $fetchResult = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'fetch', '--prune', 'origin')
    if ($fetchResult.ExitCode -ne 0) {
        throw ("No se pudo actualizar origin en el mirror. {0}" -f $fetchResult.Output.Trim())
    }

    $remoteHead = Get-GitRevisionOrThrow `
        -RepoPath $mirrorRepoPathResolved `
        -Revision ("origin/{0}" -f $Branch) `
        -ErrorMessage 'No se pudo resolver el remote head del mirror.'

    $targetResolution = Resolve-DesiredCommit `
        -CurrentReleaseTargetPath $releaseTargetPathResolved `
        -CurrentRemoteHead $remoteHead `
        -AllowBootstrap:$BootstrapReleaseTargetIfMissing

    $status.desired_commit = [string]$targetResolution.TargetCommit

    $currentHeadBefore = Get-GitHeadSafe -RepoPath $mirrorRepoPathResolved
    $status.previous_commit = $currentHeadBefore
    $status.previous_head = $currentHeadBefore
    if ([string]::IsNullOrWhiteSpace($previousSuccessfulCommit)) {
        $previousSuccessfulCommit = $currentHeadBefore
    }

    $mirrorEnvHashBefore = Get-HostingFileSha256 -Path $mirrorEnvPath
    $externalEnvHash = Get-HostingFileSha256 -Path $externalEnvPathResolved
    [void](Get-GitRevisionOrThrow `
        -RepoPath $mirrorRepoPathResolved `
        -Revision $status.desired_commit `
        -ErrorMessage 'No se pudo resolver desired_commit en el mirror.')

    $runtimeConfig = New-HostingRuntimeCaddyConfig `
        -TemplatePath $expectedCaddyTemplatePath `
        -RuntimeConfigPath $expectedCaddyRuntimeConfigPath `
        -SiteRootPath $mirrorRepoPathResolved `
        -AccessLogPath $expectedCaddyAccessLogPath
    $status.caddy_runtime_config_path = [string]$runtimeConfig.Path

    $preflightValidation = Invoke-ValidateMirror `
        -CurrentTunnelId $TunnelId `
        -ExpectedSiteRoot $mirrorRepoPathResolved `
        -ExpectedCurrentCommit $currentHeadBefore `
        -ExpectedDesiredCommit $status.desired_commit `
        -ExpectedRuntimeConfigPath $runtimeConfig.Path
    Set-StatusFromValidation -CurrentStatus $status -Validation $preflightValidation
    Write-Status -Payload $status
    if ($PreflightOnly) {
        $status.ok = $true
        Set-SyncPhase -CurrentStatus $status -State 'preflight_ready' -DeployState 'preflight_ready'
        Write-Status -Payload $status
        Write-Info ("Preflight OK: desired={0} current={1} service_state={2}" -f $status.desired_commit, $status.previous_commit, $status.service_state)
        return
    }

    Set-SyncPhase -CurrentStatus $status -State 'applying' -DeployState 'apply'
    $checkoutResult = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'checkout', '--force', $Branch)
    if ($checkoutResult.ExitCode -ne 0) {
        throw ("No se pudo cambiar el mirror a la rama $Branch. {0}" -f $checkoutResult.Output.Trim())
    }

    $resetResult = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'reset', '--hard', $status.desired_commit)
    if ($resetResult.ExitCode -ne 0) {
        throw ("No se pudo alinear el mirror contra desired_commit. {0}" -f $resetResult.Output.Trim())
    }

    Copy-Item -LiteralPath $externalEnvPathResolved -Destination $mirrorEnvPath -Force

    $status.current_commit = Get-GitHeadSafe -RepoPath $mirrorRepoPathResolved
    $status.current_head = $status.current_commit
    $status.head_changed = $status.previous_commit -ne $status.current_commit

    $mirrorEnvHashAfter = Get-HostingFileSha256 -Path $mirrorEnvPath
    $status.env_changed = ($mirrorEnvHashBefore -ne $mirrorEnvHashAfter) -or ($externalEnvHash -ne $mirrorEnvHashBefore)
    $status.public_artifacts_ok = Test-PublishedGeneratedArtifactsReady -RepoPath $mirrorRepoPathResolved
    $status.public_build_required = $status.cloned -or $status.head_changed -or (-not $status.public_artifacts_ok)
    $status.public_build_report_path = $publicBuildReportPath

    if ($status.public_build_required) {
        Set-SyncPhase -CurrentStatus $status -State 'building_public' -DeployState 'build_public' -TimeoutSeconds $publicBuildTimeoutSeconds
        Invoke-PublicBuildAndPublish -RepoPath $mirrorRepoPathResolved
        $status.public_build_ran = $true
        $status.public_artifacts_ok = Test-PublishedGeneratedArtifactsReady -RepoPath $mirrorRepoPathResolved
        if (-not $status.public_artifacts_ok) {
            throw 'public_artifacts_missing_after_publish'
        }
        Write-Status -Payload $status
    }

    $runtimeConfig = New-HostingRuntimeCaddyConfig `
        -TemplatePath $expectedCaddyTemplatePath `
        -RuntimeConfigPath $expectedCaddyRuntimeConfigPath `
        -SiteRootPath $mirrorRepoPathResolved `
        -AccessLogPath $expectedCaddyAccessLogPath
    $status.caddy_runtime_config_path = [string]$runtimeConfig.Path

    $preValidation = Invoke-ValidateMirror `
        -CurrentTunnelId $TunnelId `
        -ExpectedSiteRoot $mirrorRepoPathResolved `
        -ExpectedCurrentCommit $status.current_commit `
        -ExpectedDesiredCommit $status.desired_commit `
        -ExpectedRuntimeConfigPath $runtimeConfig.Path
    Set-StatusFromValidation -CurrentStatus $status -Validation $preValidation
    Write-Status -Payload $status

    $needsRestart = $status.cloned -or $status.head_changed -or $status.env_changed -or (-not $preValidation.Ok)
    if ($needsRestart) {
        Set-SyncPhase -CurrentStatus $status -State 'restarting' -DeployState 'restart' -TimeoutSeconds $arrancarTimeoutSeconds
        Invoke-StartMirrorStack `
            -StartScriptPath $mirrorStartScriptPath `
            -CurrentPublicDomain $PublicDomain `
            -CurrentTunnelId $TunnelId `
            -CurrentOperatorUserProfile $resolvedOperatorUserProfile `
            -CurrentCaddyExePath $CaddyExePath `
            -CurrentCloudflaredExePath $CloudflaredExePath `
            -CurrentPhpCgiExePath $PhpCgiExePath

        $status.restarted = $true
        $status.phase_heartbeat_at = [DateTimeOffset]::Now.ToString('o')
        Write-Status -Payload $status
    }

    Set-SyncPhase -CurrentStatus $status -State 'validating' -DeployState 'validate' -TimeoutSeconds $validationTimeoutSeconds
    $postValidation = Wait-ForMirrorValidation `
        -CurrentTunnelId $TunnelId `
        -ExpectedSiteRoot $mirrorRepoPathResolved `
        -ExpectedCurrentCommit $status.current_commit `
        -ExpectedDesiredCommit $status.desired_commit `
        -ExpectedRuntimeConfigPath $runtimeConfig.Path `
        -TimeoutSeconds $validationTimeoutSeconds
    Set-StatusFromValidation -CurrentStatus $status -Validation $postValidation
    Write-Status -Payload $status

    if (-not $postValidation.Ok) {
        $runtimeFailure = ''
        try { $runtimeFailure = [string]$postValidation.Runtime.Error } catch {}
        if (($null -ne $postValidation.Runtime) -and ($postValidation.Runtime.Ok -ne $true)) {
            if (-not [string]::IsNullOrWhiteSpace($runtimeFailure)) {
                $originalFailure = $runtimeFailure
            } else {
                $originalFailure = 'site_root_mismatch'
            }
        } elseif ($postValidation.Health.Ok -ne $true) {
            $originalFailure = "El health local no quedo sano en el mirror. $([string]$postValidation.Health.Error)"
        } else {
            $originalFailure = 'sync_post_restart_contract_invalid'
        }

        if (
            (-not [string]::IsNullOrWhiteSpace($previousSuccessfulCommit)) -and
            ($previousSuccessfulCommit -ne $status.desired_commit)
        ) {
            Set-SyncPhase -CurrentStatus $status -State 'rollback' -DeployState 'rollback'
            Write-Info ("Desired commit {0} fallo validacion; se ejecuta rollback automatico a {1}" -f $status.desired_commit, $previousSuccessfulCommit)
            $rollbackReset = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'reset', '--hard', $previousSuccessfulCommit)
            if ($rollbackReset.ExitCode -ne 0) {
                throw ("{0} Rollback no pudo alinear el mirror. {1}" -f $originalFailure, $rollbackReset.Output.Trim())
            }

            Copy-Item -LiteralPath $externalEnvPathResolved -Destination $mirrorEnvPath -Force
            Invoke-StartMirrorStack `
                -StartScriptPath $mirrorStartScriptPath `
                -CurrentPublicDomain $PublicDomain `
                -CurrentTunnelId $TunnelId `
                -CurrentOperatorUserProfile $resolvedOperatorUserProfile `
                -CurrentCaddyExePath $CaddyExePath `
                -CurrentCloudflaredExePath $CloudflaredExePath `
                -CurrentPhpCgiExePath $PhpCgiExePath

            $rollbackValidation = Invoke-ValidateMirror `
                -CurrentTunnelId $TunnelId `
                -ExpectedSiteRoot $mirrorRepoPathResolved `
                -ExpectedCurrentCommit $previousSuccessfulCommit `
                -ExpectedDesiredCommit $previousSuccessfulCommit `
                -ExpectedRuntimeConfigPath $runtimeConfig.Path
            if (-not $rollbackValidation.Ok) {
                throw ("{0} Rollback automatico no recupero servicio." -f $originalFailure)
            }

            Update-ReleaseTarget `
                -Path $releaseTargetPathResolved `
                -TargetCommit $previousSuccessfulCommit `
                -SourceRunId 'auto_rollback' `
                -ApprovedBy 'windows_hosting_sync' `
                -RollbackReason $originalFailure `
                -PreviousTargetCommit $status.desired_commit | Out-Null

            $status.rollback_performed = $true
            $status.rollback_reason = $originalFailure
            $status.desired_commit = $previousSuccessfulCommit
            $status.current_commit = $previousSuccessfulCommit
            $status.current_head = $previousSuccessfulCommit
            $status.head_changed = $false
            Set-SyncPhase -CurrentStatus $status -State 'rolled_back' -DeployState 'rollback_succeeded'
            $status.last_failure_reason = $originalFailure
            $status.last_successful_deploy_at = [DateTimeOffset]::Now.ToString('o')
            Set-StatusFromValidation -CurrentStatus $status -Validation $rollbackValidation
            $status.ok = $true
            Write-Status -Payload $status
            Write-Info ("Rollback completado: desired_commit repinneado a {0}" -f $status.desired_commit)
            return
        }

        throw $originalFailure
    }

    $status.ok = $true
    if ($status.restarted) {
        Set-SyncPhase -CurrentStatus $status -State 'updated' -DeployState 'desired_commit_applied'
    } else {
        Set-SyncPhase -CurrentStatus $status -State 'idle' -DeployState 'current'
    }
    $status.last_successful_deploy_at = [DateTimeOffset]::Now.ToString('o')
    $status.last_failure_reason = ''
    Write-Status -Payload $status
    Write-Info ("Sync completado: state={0} desired={1} current={2} transport={3}" -f $status.state, $status.desired_commit, $status.current_commit, $status.auth_transport)
} catch {
    $status.ok = $false
    $status.state = 'failed'
    $status.error = $_.Exception.Message
    if ([string]::Equals($status.error, 'sync_restart_timeout', [System.StringComparison]::OrdinalIgnoreCase)) {
        $status.deploy_state = 'restart_timeout'
        $status.last_failure_reason = 'sync_restart_timeout'
        $status.timed_out = $true
    } elseif ([string]::Equals($status.error, 'public_deps_install_timeout', [System.StringComparison]::OrdinalIgnoreCase)) {
        $status.deploy_state = 'build_public_timeout'
        $status.last_failure_reason = 'public_deps_install_timeout'
        $status.timed_out = $true
    } elseif ([string]::Equals($status.error, 'public_build_timeout', [System.StringComparison]::OrdinalIgnoreCase)) {
        $status.deploy_state = 'build_public_timeout'
        $status.last_failure_reason = 'public_build_timeout'
        $status.timed_out = $true
    } elseif (
        [string]::Equals($status.error, 'public_deps_install_failed', [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($status.error, 'public_build_failed', [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($status.error, 'public_artifacts_missing_after_publish', [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        $status.deploy_state = 'build_public_failed'
        $status.last_failure_reason = $status.error
    } elseif ([string]::Equals($status.error, 'sync_post_restart_contract_invalid', [System.StringComparison]::OrdinalIgnoreCase)) {
        $status.deploy_state = 'validate'
        $status.last_failure_reason = 'sync_post_restart_contract_invalid'
    } else {
        $status.deploy_state = 'failed'
        $status.last_failure_reason = $status.error
    }
    if ([string]::IsNullOrWhiteSpace($status.current_commit)) {
        $status.current_commit = Get-GitHeadSafe -RepoPath $mirrorRepoPathResolved
        $status.current_head = $status.current_commit
    }
    $validation = Invoke-ValidateMirror `
        -CurrentTunnelId $TunnelId `
        -ExpectedSiteRoot $mirrorRepoPathResolved `
        -ExpectedCurrentCommit $status.current_commit `
        -ExpectedDesiredCommit $status.desired_commit `
        -ExpectedRuntimeConfigPath $expectedCaddyRuntimeConfigPath
    Set-StatusFromValidation -CurrentStatus $status -Validation $validation
    Write-Status -Payload $status
    Write-Info ("Sync fallido: {0}" -f $status.error)
    throw
} finally {
    $lockSnapshot = Get-LockSnapshot -InfoPath $lockInfoPath -TtlSeconds $LockTtlSeconds
    if (($lockSnapshot.owner_pid -eq 0) -or ($lockSnapshot.owner_pid -eq $PID) -or (-not (Test-HostingProcessExists -ProcessId $lockSnapshot.owner_pid))) {
        Clear-SyncLockArtifacts -CurrentLockPath $lockPath -CurrentLockInfoPath $lockInfoPath
        if (-not (Test-Path -LiteralPath $lockPath)) {
            $status.lock_state = 'unlocked'
            $status.lock_reason = ''
            $status.lock_owner_pid = 0
            $status.lock_started_at = ''
            $status.lock_age_seconds = 0
            Write-Status -Payload $status
        }
    }

    if ($null -ne $lockStream) {
        $lockStream.Dispose()
    }
}
