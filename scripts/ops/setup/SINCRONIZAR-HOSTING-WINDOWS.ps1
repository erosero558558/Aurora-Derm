param(
    [string]$MirrorRepoPath = 'C:\dev\pielarmonia-clean-main',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$StatusPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync-status.json',
    [string]$LogPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync.log',
    [string]$ReleaseTargetPath = 'C:\ProgramData\Pielarmonia\hosting\release-target.json',
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
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$mirrorRepoPathResolved = [System.IO.Path]::GetFullPath($MirrorRepoPath)
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
$lockInfoPath = $lockPath + '.json'
$gitExe = (Get-Command git -ErrorAction Stop).Source
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source

function Ensure-ParentDirectory {
    param([string]$Path)

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function Write-Info {
    param([string]$Message)

    $line = ('[{0}] {1}' -f ([DateTimeOffset]::Now.ToString('o')), $Message)
    Ensure-ParentDirectory -Path $logPathResolved
    Add-Content -Path $logPathResolved -Value $line -Encoding ASCII
    if (-not $Quiet) {
        Write-Host "[hosting-sync] $Message"
    }
}

function Read-JsonFileSafe {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $raw = Get-Content -LiteralPath $Path -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        return (($raw -replace "^\uFEFF", '') | ConvertFrom-Json -Depth 20)
    } catch {
        return $null
    }
}

function Write-JsonFile {
    param(
        [string]$Path,
        [hashtable]$Payload
    )

    Ensure-ParentDirectory -Path $Path
    $json = $Payload | ConvertTo-Json -Depth 20
    Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Write-Status {
    param([hashtable]$Payload)

    Write-JsonFile -Path $statusPathResolved -Payload $Payload
}

function Get-FileHashSafe {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return ''
    }

    $getFileHashCommand = Get-Command Get-FileHash -ErrorAction SilentlyContinue
    if ($null -ne $getFileHashCommand) {
        return [string]((Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash).ToLowerInvariant()
    }

    $stream = $null
    $sha256 = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $sha256.ComputeHash($stream)
        $builder = New-Object System.Text.StringBuilder
        foreach ($byte in $hashBytes) {
            [void]$builder.AppendFormat('{0:x2}', $byte)
        }
        return [string]$builder.ToString()
    } finally {
        if ($null -ne $sha256) {
            $sha256.Dispose()
        }
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }
}

function Invoke-CommandWithOutput {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process `
            -FilePath $FilePath `
            -ArgumentList $Arguments `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $chunks = @()
        if (Test-Path -LiteralPath $stdoutPath) {
            $stdout = Get-Content -LiteralPath $stdoutPath -Raw
            if (-not [string]::IsNullOrWhiteSpace($stdout)) {
                $chunks += $stdout.Trim()
            }
        }

        if (Test-Path -LiteralPath $stderrPath) {
            $stderr = Get-Content -LiteralPath $stderrPath -Raw
            if (-not [string]::IsNullOrWhiteSpace($stderr)) {
                $chunks += $stderr.Trim()
            }
        }

        return [PSCustomObject]@{
            ExitCode = $process.ExitCode
            Output = $chunks -join [Environment]::NewLine
        }
    } finally {
        foreach ($tempPath in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $tempPath) {
                Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Invoke-Git {
    param([string[]]$Arguments)

    return Invoke-CommandWithOutput -FilePath $gitExe -Arguments $Arguments
}

function Add-OptionalNamedArgument {
    param(
        [System.Collections.Generic.List[string]]$Arguments,
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $Arguments.Add($Name) | Out-Null
    $Arguments.Add($Value) | Out-Null
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

function Test-ProcessExists {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $false
    }

    try {
        return $null -ne (Get-Process -Id $ProcessId -ErrorAction Stop)
    } catch {
        return $false
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

    $payload = Read-JsonFileSafe -Path $InfoPath
    if ($null -ne $payload) {
        try { $snapshot.owner_pid = [int]$payload.owner_pid } catch {}
        try { $snapshot.started_at = [string]$payload.started_at } catch {}
    }

    if ($snapshot.owner_pid -gt 0) {
        $snapshot.owner_active = Test-ProcessExists -ProcessId $snapshot.owner_pid
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

function Clear-SyncLockArtifacts {
    param(
        [string]$CurrentLockPath,
        [string]$CurrentLockInfoPath
    )

    foreach ($path in @($CurrentLockPath, $CurrentLockInfoPath)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
}

function Acquire-SyncLock {
    param(
        [string]$CurrentLockPath,
        [string]$CurrentLockInfoPath,
        [int]$TtlSeconds
    )

    foreach ($attempt in 1..2) {
        try {
            $stream = [System.IO.File]::Open($CurrentLockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
            $payload = [ordered]@{
                owner_pid = $PID
                started_at = [DateTimeOffset]::Now.ToString('o')
            }
            Write-JsonFile -Path $CurrentLockInfoPath -Payload $payload
            return [PSCustomObject]@{
                Acquired = $true
                Stream = $stream
                Snapshot = [PSCustomObject]@{
                    owner_pid = $PID
                    started_at = $payload.started_at
                    age_seconds = 0
                    owner_active = $true
                    stale = $false
                }
            }
        } catch {
            $snapshot = Get-LockSnapshot -InfoPath $CurrentLockInfoPath -TtlSeconds $TtlSeconds
            if ($snapshot.stale -and $attempt -eq 1) {
                Write-Info ("Stale lock detectado; se libera lock owner_pid={0} age_seconds={1}" -f $snapshot.owner_pid, $snapshot.age_seconds)
                Clear-SyncLockArtifacts -CurrentLockPath $CurrentLockPath -CurrentLockInfoPath $CurrentLockInfoPath
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
        Snapshot = (Get-LockSnapshot -InfoPath $CurrentLockInfoPath -TtlSeconds $TtlSeconds)
    }
}

function Get-ProcessesByNeedle {
    param([string[]]$Needles)

    return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
        $commandLine = [string]$_.CommandLine
        if ([string]::IsNullOrWhiteSpace($commandLine)) {
            return $false
        }

        foreach ($needle in $Needles) {
            if ([string]::IsNullOrWhiteSpace($needle)) {
                continue
            }

            if ($commandLine.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
                return $false
            }
        }

        return $true
    })
}

function Get-ServiceSnapshot {
    param([string]$CurrentTunnelId)

    $phpProcesses = Get-ProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000')
    $caddyProcesses = Get-ProcessesByNeedle -Needles @('caddy.exe', 'ops\caddy\Caddyfile', 'run')
    $cloudflaredProcesses = Get-ProcessesByNeedle -Needles @('cloudflared.exe', $CurrentTunnelId, '--url http://127.0.0.1')
    $helperProcesses = Get-ProcessesByNeedle -Needles @('openclaw-auth-helper.js')

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
    try {
        $response = Invoke-WebRequest `
            -Uri 'http://127.0.0.1/api.php?resource=health-diagnostics' `
            -Headers @{ Accept = 'application/json' } `
            -UseBasicParsing `
            -TimeoutSec 20
        $payload = $response.Content | ConvertFrom-Json
        return [PSCustomObject]@{
            Ok = ($payload.ok -eq $true)
            Payload = $payload
            Error = ''
        }
    } catch {
        return [PSCustomObject]@{
            Ok = $false
            Payload = $null
            Error = $_.Exception.Message
        }
    }
}

function Invoke-OperatorAuthStatus {
    try {
        $response = Invoke-WebRequest `
            -Uri 'http://127.0.0.1/admin-auth.php?action=status' `
            -Headers @{ Accept = 'application/json' } `
            -UseBasicParsing `
            -TimeoutSec 20
        $payload = $response.Content | ConvertFrom-Json
        $mode = [string]($payload.mode)
        $transport = [string]($payload.transport)
        $status = [string]($payload.status)
        $transportValid =
            [string]::Equals($transport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase) -or
            [string]::Equals($transport, 'local_helper', [System.StringComparison]::OrdinalIgnoreCase)
        $ok =
            [string]::Equals($mode, 'openclaw_chatgpt', [System.StringComparison]::OrdinalIgnoreCase) -and
            $transportValid -and
            (-not [string]::Equals($status, 'transport_misconfigured', [System.StringComparison]::OrdinalIgnoreCase))
        return [PSCustomObject]@{
            Ok = $ok
            Payload = $payload
            Error = if ($ok) { '' } else { 'admin-auth.php?action=status no publico un contrato OpenClaw valido.' }
        }
    } catch {
        return [PSCustomObject]@{
            Ok = $false
            Payload = $null
            Error = $_.Exception.Message
        }
    }
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

    $payload = [ordered]@{
        target_commit = $TargetCommit
        approved_at = [DateTimeOffset]::Now.ToString('o')
        source_run_id = if ([string]::IsNullOrWhiteSpace($SourceRunId)) { 'windows_hosting_sync' } else { $SourceRunId }
        approved_by = $ApprovedBy
    }

    if (-not [string]::IsNullOrWhiteSpace($RollbackReason)) {
        $payload.rollback_reason = $RollbackReason
    }
    if (-not [string]::IsNullOrWhiteSpace($PreviousTargetCommit)) {
        $payload.previous_target_commit = $PreviousTargetCommit
    }

    Write-JsonFile -Path $Path -Payload $payload
    return $payload
}

function Resolve-DesiredCommit {
    param(
        [string]$CurrentReleaseTargetPath,
        [string]$CurrentRemoteHead,
        [switch]$AllowBootstrap
    )

    $releaseTarget = Read-JsonFileSafe -Path $CurrentReleaseTargetPath
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
        '-OperatorUserProfile', $CurrentOperatorUserProfile,
        '-StopLegacy',
        '-Quiet'
    )) {
        $arguments.Add([string]$token) | Out-Null
    }
    Add-OptionalNamedArgument -Arguments $arguments -Name '-CaddyExePath' -Value $CurrentCaddyExePath
    Add-OptionalNamedArgument -Arguments $arguments -Name '-CloudflaredExePath' -Value $CurrentCloudflaredExePath
    Add-OptionalNamedArgument -Arguments $arguments -Name '-PhpCgiExePath' -Value $CurrentPhpCgiExePath

    $result = Invoke-CommandWithOutput -FilePath $powershellExe -Arguments $arguments
    if ($result.ExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($result.Output)) {
            Write-Info $result.Output.Trim()
        }
        throw 'El stack del mirror no pudo reiniciarse correctamente.'
    }

    if (-not [string]::IsNullOrWhiteSpace($result.Output)) {
        Write-Info $result.Output.Trim()
    }
}

function Invoke-ValidateMirror {
    param([string]$CurrentTunnelId)

    $service = Get-ServiceSnapshot -CurrentTunnelId $CurrentTunnelId
    $health = Invoke-HealthDiagnostics
    $authContract = Invoke-OperatorAuthStatus
    return [PSCustomObject]@{
        Ok = ($health.Ok -eq $true) -and ($authContract.Ok -eq $true)
        Health = $health
        Auth = $authContract
        Service = $service
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
    if ($Validation.Auth.Payload) {
        $CurrentStatus.auth_mode = [string]$Validation.Auth.Payload.mode
        $CurrentStatus.auth_transport = [string]$Validation.Auth.Payload.transport
        $CurrentStatus.auth_status = [string]$Validation.Auth.Payload.status
    }
}

$existingStatus = Read-JsonFileSafe -Path $statusPathResolved
$existingReleaseTarget = Read-JsonFileSafe -Path $releaseTargetPathResolved
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
    restarted = $false
    cloned = $false
    health_ok = $false
    auth_contract_ok = $false
    auth_mode = ''
    auth_transport = ''
    auth_status = ''
    service_state = 'unknown'
    lock_owner_pid = 0
    lock_started_at = ''
    lock_age_seconds = 0
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
    Ensure-ParentDirectory -Path $statusPathResolved
    Ensure-ParentDirectory -Path $lockPath
    Ensure-ParentDirectory -Path $releaseTargetPathResolved

    $lockResult = Acquire-SyncLock `
        -CurrentLockPath $lockPath `
        -CurrentLockInfoPath $lockInfoPath `
        -TtlSeconds $LockTtlSeconds

    if (-not $lockResult.Acquired) {
        $status.state = 'locked'
        $status.deploy_state = 'waiting_for_lock'
        $status.error = 'sync_already_running'
        $status.last_failure_reason = $status.error
        $status.lock_owner_pid = [int]$lockResult.Snapshot.owner_pid
        $status.lock_started_at = [string]$lockResult.Snapshot.started_at
        $status.lock_age_seconds = [int]$lockResult.Snapshot.age_seconds
        $validation = Invoke-ValidateMirror -CurrentTunnelId $TunnelId
        Set-StatusFromValidation -CurrentStatus $status -Validation $validation
        Write-Status -Payload $status
        Write-Info ("Otro ciclo de sync sigue en ejecucion; owner_pid={0} age_seconds={1}" -f $status.lock_owner_pid, $status.lock_age_seconds)
        exit 0
    }

    $lockStream = $lockResult.Stream
    $status.lock_owner_pid = $PID
    $status.lock_started_at = [DateTimeOffset]::Now.ToString('o')
    $status.lock_age_seconds = 0

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

    $mirrorEnvHashBefore = Get-FileHashSafe -Path $mirrorEnvPath
    $externalEnvHash = Get-FileHashSafe -Path $externalEnvPathResolved

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

    $mirrorEnvHashAfter = Get-FileHashSafe -Path $mirrorEnvPath
    $status.env_changed = ($mirrorEnvHashBefore -ne $mirrorEnvHashAfter) -or ($externalEnvHash -ne $mirrorEnvHashBefore)

    $preValidation = Invoke-ValidateMirror -CurrentTunnelId $TunnelId
    Set-StatusFromValidation -CurrentStatus $status -Validation $preValidation

    $needsRestart = $status.cloned -or $status.head_changed -or $status.env_changed -or (-not $preValidation.Ok)
    if ($needsRestart) {
        Invoke-StartMirrorStack `
            -StartScriptPath $mirrorStartScriptPath `
            -CurrentPublicDomain $PublicDomain `
            -CurrentTunnelId $TunnelId `
            -CurrentOperatorUserProfile $resolvedOperatorUserProfile `
            -CurrentCaddyExePath $CaddyExePath `
            -CurrentCloudflaredExePath $CloudflaredExePath `
            -CurrentPhpCgiExePath $PhpCgiExePath

        $status.restarted = $true
    }

    $postValidation = Invoke-ValidateMirror -CurrentTunnelId $TunnelId
    Set-StatusFromValidation -CurrentStatus $status -Validation $postValidation

    if (-not $postValidation.Ok) {
        $originalFailure = if ($postValidation.Health.Ok -ne $true) {
            "El health local no quedo sano en el mirror. $([string]$postValidation.Health.Error)"
        } else {
            "El contrato de auth no quedo sano en el mirror. $([string]$postValidation.Auth.Error)"
        }

        if (
            (-not [string]::IsNullOrWhiteSpace($previousSuccessfulCommit)) -and
            ($previousSuccessfulCommit -ne $status.desired_commit)
        ) {
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

            $rollbackValidation = Invoke-ValidateMirror -CurrentTunnelId $TunnelId
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
            $status.state = 'rolled_back'
            $status.deploy_state = 'rollback_succeeded'
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
    $status.state = if ($status.restarted) { 'updated' } else { 'idle' }
    $status.deploy_state = if ($status.restarted) { 'desired_commit_applied' } else { 'current' }
    $status.last_successful_deploy_at = [DateTimeOffset]::Now.ToString('o')
    $status.last_failure_reason = ''
    Write-Status -Payload $status
    Write-Info ("Sync completado: state={0} desired={1} current={2} transport={3}" -f $status.state, $status.desired_commit, $status.current_commit, $status.auth_transport)
} catch {
    $status.ok = $false
    $status.state = 'failed'
    $status.deploy_state = 'failed'
    $status.error = $_.Exception.Message
    $status.last_failure_reason = $status.error
    if ([string]::IsNullOrWhiteSpace($status.current_commit)) {
        $status.current_commit = Get-GitHeadSafe -RepoPath $mirrorRepoPathResolved
        $status.current_head = $status.current_commit
    }
    $validation = Invoke-ValidateMirror -CurrentTunnelId $TunnelId
    Set-StatusFromValidation -CurrentStatus $status -Validation $validation
    Write-Status -Payload $status
    Write-Info ("Sync fallido: {0}" -f $status.error)
    throw
} finally {
    if ($null -ne $lockStream) {
        $lockStream.Dispose()
    }

    $lockSnapshot = Read-JsonFileSafe -Path $lockInfoPath
    $ownerPid = 0
    if ($null -ne $lockSnapshot) {
        try { $ownerPid = [int]$lockSnapshot.owner_pid } catch { $ownerPid = 0 }
    }

    if (($ownerPid -eq 0) -or ($ownerPid -eq $PID) -or (-not (Test-ProcessExists -ProcessId $ownerPid))) {
        Clear-SyncLockArtifacts -CurrentLockPath $lockPath -CurrentLockInfoPath $lockInfoPath
    }
}
