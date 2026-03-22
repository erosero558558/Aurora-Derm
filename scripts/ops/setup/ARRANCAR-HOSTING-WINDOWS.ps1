param(
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$OperatorUserProfile = '',
    [string]$CaddyExePath = '',
    [string]$CloudflaredExePath = '',
    [string]$PhpCgiExePath = '',
    [switch]$StopLegacy,
    [switch]$SkipBridge,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'
if (-not (Test-Path -LiteralPath $commonScriptPath)) {
    throw "No existe el modulo comun de hosting Windows: $commonScriptPath"
}
. $commonScriptPath

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$runtimePaths = Get-HostingRuntimePaths -RepoRoot $repoRoot
$runtimeRoot = [string]$runtimePaths.RuntimeRoot
$logRoot = [string]$runtimePaths.LogsRoot
$pidRoot = [string]$runtimePaths.PidRoot
$mirrorEnvPath = Join-Path $repoRoot 'env.php'
$caddyTemplatePath = [string]$runtimePaths.CaddyTemplatePath
$caddyRuntimeConfigPath = [string]$runtimePaths.CaddyRuntimeConfigPath
$caddyAccessLogPath = [string]$runtimePaths.CaddyAccessLogPath
$helperScriptPath = Join-Path $repoRoot 'scripts\ops\admin\INICIAR-OPENCLAW-AUTH-HELPER.ps1'
$externalEnvPathResolved = [System.IO.Path]::GetFullPath($ExternalEnvPath)
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}
$cloudflaredCredPath = Join-Path $resolvedOperatorUserProfile ".cloudflared\$TunnelId.json"

foreach ($path in @($runtimeRoot, $logRoot, $pidRoot)) {
    if (-not (Test-Path -LiteralPath $path)) {
        New-Item -ItemType Directory -Path $path -Force | Out-Null
    }
}

function Write-Info {
    param([string]$Message)

    if (-not $Quiet) {
        Write-Host "[hosting] $Message"
    }
}

function Resolve-ExecutablePath {
    param(
        [string]$ConfiguredPath,
        [string]$CommandName
    )

    if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
        $resolvedConfiguredPath = [System.IO.Path]::GetFullPath($ConfiguredPath)
        if (-not (Test-Path -LiteralPath $resolvedConfiguredPath)) {
            throw "No existe el binario configurado para ${CommandName}: $resolvedConfiguredPath"
        }

        return $resolvedConfiguredPath
    }

    return (Get-Command $CommandName -ErrorAction Stop).Source
}

function Stop-ProcessesByNeedle {
    param(
        [string[]]$Needles,
        [string]$Label
    )

    $matches = Get-HostingProcessesByNeedle -Needles $Needles
    foreach ($match in $matches) {
        Write-Info ("Stopping {0} pid={1}" -f $Label, $match.ProcessId)
        Stop-Process -Id $match.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Wait-ForHttp {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$Attempts = 20,
        [int]$DelayMs = 500
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        $response = Invoke-HostingHttpRequest -Url $Url -Headers $Headers -TimeoutSec 5
        if (($response.StatusCode -ge 200) -and ($response.StatusCode -lt 500)) {
            return $true
        }

        Start-Sleep -Milliseconds $DelayMs
    }

    return $false
}

function Invoke-JsonGetSafe {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 5
    )

    $response = Invoke-HostingJsonRequest -Url $Url -Headers $Headers -TimeoutSec $TimeoutSec
    return $response.Payload
}

function Read-PhpEnvFileValues {
    param([string]$Path)

    $parsed = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $parsed
    }

    try {
        $lines = Get-Content -LiteralPath $Path
    } catch {
        return $parsed
    }

    foreach ($line in $lines) {
        $match = [regex]::Match([string]$line, '^\s*putenv\(\s*([''"])([A-Z0-9_]+)=([\s\S]*?)\1\s*\)\s*;\s*$')
        if (-not $match.Success) {
            continue
        }

        $key = [string]$match.Groups[2].Value.Trim()
        $value = [string]$match.Groups[3].Value
        $value = $value.Replace("\'", "'").Replace('\"', '"').Trim()
        if (-not [string]::IsNullOrWhiteSpace($key)) {
            $parsed[$key] = $value
        }
    }

    return $parsed
}

function Test-OperatorAuthBootstrapMode {
    param([string]$Mode)

    return
        [string]::Equals($Mode, 'google_oauth', [System.StringComparison]::OrdinalIgnoreCase) -or
        [string]::Equals($Mode, 'openclaw_chatgpt', [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-EffectiveOperatorAuthBootstrapConfig {
    $envSources = @()
    foreach ($candidatePath in @($mirrorEnvPath, $externalEnvPathResolved)) {
        if ([string]::IsNullOrWhiteSpace($candidatePath)) {
            continue
        }
        $envSources += ,(Read-PhpEnvFileValues -Path $candidatePath)
    }

    $effective = @{}
    foreach ($source in $envSources) {
        foreach ($key in $source.Keys) {
            $effective[$key] = [string]$source[$key]
        }
    }

    if (-not $effective.ContainsKey('AURORADERM_OPERATOR_AUTH_MODE')) {
        $effective['AURORADERM_OPERATOR_AUTH_MODE'] = [string]$env:AURORADERM_OPERATOR_AUTH_MODE
    }
    if ([string]::IsNullOrWhiteSpace([string]$effective['AURORADERM_OPERATOR_AUTH_MODE'])) {
        $effective['AURORADERM_OPERATOR_AUTH_MODE'] = [string]$env:PIELARMONIA_OPERATOR_AUTH_MODE
    }
    if (-not $effective.ContainsKey('AURORADERM_OPERATOR_AUTH_TRANSPORT')) {
        $effective['AURORADERM_OPERATOR_AUTH_TRANSPORT'] = [string]$env:AURORADERM_OPERATOR_AUTH_TRANSPORT
    }
    if ([string]::IsNullOrWhiteSpace([string]$effective['AURORADERM_OPERATOR_AUTH_TRANSPORT'])) {
        $effective['AURORADERM_OPERATOR_AUTH_TRANSPORT'] = [string]$env:PIELARMONIA_OPERATOR_AUTH_TRANSPORT
    }

    return [PSCustomObject]@{
        Mode = [string]$effective['AURORADERM_OPERATOR_AUTH_MODE']
        Transport = [string]$effective['AURORADERM_OPERATOR_AUTH_TRANSPORT']
    }
}

function Sync-ExternalEnvFile {
    param(
        [string]$SourcePath,
        [string]$DestinationPath
    )

    if (-not (Test-Path -LiteralPath $SourcePath)) {
        return $false
    }

    $sourceHash = Get-HostingFileSha256 -Path $SourcePath
    $destinationHash = Get-HostingFileSha256 -Path $DestinationPath
    if ($sourceHash -eq $destinationHash) {
        return $false
    }

    Ensure-HostingParentDirectory -Path $DestinationPath
    Copy-Item -LiteralPath $SourcePath -Destination $DestinationPath -Force
    Write-Info ("env.php externo sincronizado: {0} -> {1}" -f $SourcePath, $DestinationPath)
    return $true
}

function Get-OperatorAuthStatusPayload {
    return Invoke-JsonGetSafe `
        -Url 'http://127.0.0.1/admin-auth.php?action=status' `
        -Headers @{ Accept = 'application/json' }
}

function Get-LocalRuntimeFingerprintStatus {
    param(
        [string]$ExpectedSiteRoot,
        [string]$ExpectedRuntimeConfigPath
    )

    $fingerprint = Invoke-HostingRuntimeFingerprint -BaseUrl 'http://127.0.0.1' -TimeoutSec 5
    return (Test-HostingRuntimeFingerprintMatch `
            -Fingerprint $fingerprint `
            -ExpectedSiteRoot $ExpectedSiteRoot `
            -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath)
}

function Refresh-OperatorAuthRuntime {
    param(
        [string]$PhpCgiExecutable,
        [string]$CaddyExecutable,
        [string]$CurrentConfigPath,
        [string]$ExpectedSiteRoot,
        [string]$ExpectedRuntimeConfigPath,
        [string]$BootstrapMode,
        [string]$BootstrapTransport
    )

    $payload = Get-OperatorAuthStatusPayload
    $transport = ''
    if ($null -ne $payload) {
        $transport = [string]$payload.transport
    }
    if (-not [string]::IsNullOrWhiteSpace($transport)) {
        return $payload
    }

    $bootstrapWebBroker =
        (Test-OperatorAuthBootstrapMode -Mode $BootstrapMode) -and
        [string]::Equals($BootstrapTransport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase)

    if (-not $bootstrapWebBroker) {
        return $payload
    }

    Write-Info 'Contrato local de Operator Auth sin transport; se reinicia PHP-CGI para refrescar env.'
    Stop-ProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000') -Label 'PHP-CGI auth refresh'
    Ensure-PhpCgiListener `
        -PhpCgiExecutable $PhpCgiExecutable `
        -WorkingDirectory $repoRoot `
        -StdOutPath $phpStdOutPath `
        -StdErrPath $phpStdErrPath
    $payload = Get-OperatorAuthStatusPayload
    if (($null -ne $payload) -and (-not [string]::IsNullOrWhiteSpace([string]$payload.transport))) {
        return $payload
    }

    Write-Info 'Contrato local de Operator Auth sigue sin transport; se reinicia Caddy y se reconsulta.'
    Stop-ProcessesByNeedle -Needles @('caddy.exe', 'run') -Label 'Caddy auth refresh'
    Ensure-CaddyAndBackendReady `
        -CaddyExecutable $CaddyExecutable `
        -WorkingDirectory $repoRoot `
        -StdOutPath $caddyStdOutPath `
        -StdErrPath $caddyStdErrPath `
        -CurrentConfigPath $CurrentConfigPath `
        -ExpectedSiteRoot $ExpectedSiteRoot `
        -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath
    return Get-OperatorAuthStatusPayload
}

function Resolve-OperatorAuthTransport {
    param(
        [string]$BootstrapMode = '',
        [string]$BootstrapTransport = '',
        [string]$Fallback = 'local_helper',
        [int]$Attempts = 10,
        [int]$DelayMs = 500
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        $payload = Invoke-JsonGetSafe `
            -Url 'http://127.0.0.1/admin-auth.php?action=status' `
            -Headers @{ Accept = 'application/json' }
        if ($null -eq $payload) {
            Start-Sleep -Milliseconds $DelayMs
            continue
        }

        $transport = [string]($payload.transport)
        if (-not [string]::IsNullOrWhiteSpace($transport)) {
            if ([string]::Equals($transport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase)) {
                return 'web_broker'
            }

            return 'local_helper'
        }

        $mode = [string]($payload.mode)
        $status = [string]($payload.status)
        if (
            (Test-OperatorAuthBootstrapMode -Mode $mode) -or
            [string]::Equals($status, 'transport_misconfigured', [System.StringComparison]::OrdinalIgnoreCase)
        ) {
            if (
                (Test-OperatorAuthBootstrapMode -Mode $BootstrapMode) -and
                [string]::Equals($BootstrapTransport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase)
            ) {
                Write-Info 'Se asume web_broker desde env.php efectivo durante bootstrap.'
                return 'web_broker'
            }

            throw 'admin-auth.php?action=status no publico un transport valido para Operator Auth. Corrige el runtime antes de iniciar el stack.'
        }

        Start-Sleep -Milliseconds $DelayMs
    }

    $envTransport = [string]$env:AURORADERM_OPERATOR_AUTH_TRANSPORT
    if ([string]::IsNullOrWhiteSpace($envTransport)) {
        $envTransport = [string]$env:PIELARMONIA_OPERATOR_AUTH_TRANSPORT
    }
    $envMode = [string]$env:AURORADERM_OPERATOR_AUTH_MODE
    if ([string]::IsNullOrWhiteSpace($envMode)) {
        $envMode = [string]$env:PIELARMONIA_OPERATOR_AUTH_MODE
    }
    if (
        (Test-OperatorAuthBootstrapMode -Mode $BootstrapMode) -and
        [string]::Equals($BootstrapTransport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase)
    ) {
        return 'web_broker'
    }
    if ([string]::Equals($envTransport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase)) {
        return 'web_broker'
    }
    if (Test-OperatorAuthBootstrapMode -Mode $envMode) {
        throw 'AURORADERM_OPERATOR_AUTH_TRANSPORT no esta declarado explicitamente para Operator Auth. Configure web_broker o local_helper antes de iniciar el stack.'
    }

    return $Fallback
}

function Wait-ForTcp {
    param(
        [int]$Port,
        [int]$Attempts = 20,
        [int]$DelayMs = 500
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        $match = Get-HostingListeningTcpEntry -Port $Port
        if ($null -ne $match) {
            return $true
        }

        Start-Sleep -Milliseconds $DelayMs
    }

    return $false
}

function Get-ListeningTcpProcess {
    param([int]$Port)

    return Get-HostingListeningTcpEntry -Port $Port
}

function Get-ProcessByIdSafe {
    param([int]$ProcessId)

    return Get-HostingProcessByIdSafe -ProcessId $ProcessId
}

function Stop-ProcessesById {
    param(
        [int[]]$ProcessIds,
        [string]$Label
    )

    foreach ($processId in ($ProcessIds | Where-Object { $_ -gt 0 } | Sort-Object -Unique)) {
        Write-Info ("Stopping {0} pid={1}" -f $Label, $processId)
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
}

function Ensure-PhpCgiListener {
    param(
        [string]$PhpCgiExecutable,
        [string]$WorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath
    )

    $phpNeedles = @('php-cgi.exe', '-b 127.0.0.1:9000')
    $listener = Get-ListeningTcpProcess -Port 9000
    if ($null -ne $listener) {
        $listenerProcess = Get-ProcessByIdSafe -ProcessId $listener.OwningProcess
        if ($null -eq $listenerProcess) {
            throw 'El puerto 9000 esta ocupado por un proceso no resoluble.'
        }

        if ([string]::Equals([string]$listenerProcess.Name, 'php-cgi.exe', [System.StringComparison]::OrdinalIgnoreCase)) {
            Write-Info ("PHP-CGI listener already active ({0})" -f $listener.OwningProcess)
        } else {
            throw ("El puerto 9000 ya esta ocupado por {0} (pid={1})." -f $listenerProcess.Name, $listener.OwningProcess)
        }
    } else {
        Start-ManagedProcess `
            -FilePath $PhpCgiExecutable `
            -Arguments @('-b', '127.0.0.1:9000') `
            -WorkingDirectory $WorkingDirectory `
            -StdOutPath $StdOutPath `
            -StdErrPath $StdErrPath `
            -AlreadyRunningNeedles $phpNeedles `
            -Label 'PHP-CGI' | Out-Null

        if (-not (Wait-ForTcp -Port 9000)) {
            throw 'PHP-CGI no quedo escuchando en 127.0.0.1:9000'
        }
    }

    $activeListener = Get-ListeningTcpProcess -Port 9000
    if ($null -eq $activeListener) {
        throw 'PHP-CGI listener no esta disponible despues del bootstrap.'
    }

    $duplicates = Get-ProcessesByNeedle -Needles $phpNeedles |
        Where-Object { $_.ProcessId -ne $activeListener.OwningProcess }

    if ($duplicates.Count -gt 0) {
        Stop-ProcessesById -ProcessIds ($duplicates | ForEach-Object { [int]$_.ProcessId }) -Label 'stale PHP-CGI duplicate'
    }
}

function Ensure-CaddyEdge {
    param(
        [string]$CaddyExecutable,
        [string]$WorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath,
        [string]$CurrentConfigPath,
        [string]$ExpectedSiteRoot,
        [string]$ExpectedRuntimeConfigPath
    )

    $needles = @('caddy.exe', 'run')
    $existing = Get-HostingProcessesByNeedle -Needles $needles
    $healthy = Wait-ForHttp -Url 'http://127.0.0.1/healthz' -Attempts 2 -DelayMs 250
    $runtimeStatus = $null
    if ($healthy) {
        $runtimeStatus = Get-LocalRuntimeFingerprintStatus `
            -ExpectedSiteRoot $ExpectedSiteRoot `
            -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath
    }

    if (($existing.Count -gt 0) -and $healthy -and ($null -ne $runtimeStatus) -and ($runtimeStatus.Ok -eq $true)) {
        $pids = ($existing | ForEach-Object { [string]$_.ProcessId } | Sort-Object) -join ', '
        Write-Info ("Caddy edge already running ({0})" -f $pids)
        return
    }

    if (($existing.Count -gt 0) -and $healthy -and ($null -ne $runtimeStatus) -and ($runtimeStatus.Ok -ne $true)) {
        Write-Info ("Caddy edge activo con runtime distinto; site_root={0} config={1}" -f [string]$runtimeStatus.SiteRoot, [string]$runtimeStatus.CaddyRuntimeConfigPath)
        Stop-ProcessesById -ProcessIds ($existing | ForEach-Object { [int]$_.ProcessId }) -Label 'mismatched Caddy edge'
        Start-Sleep -Milliseconds 400
    } elseif (($existing.Count -gt 0) -and (-not $healthy)) {
        Stop-ProcessesById -ProcessIds ($existing | ForEach-Object { [int]$_.ProcessId }) -Label 'unhealthy Caddy edge'
        Start-Sleep -Milliseconds 400
    }

    Start-ManagedProcess `
        -FilePath $CaddyExecutable `
        -Arguments @('run', '--config', $CurrentConfigPath, '--adapter', 'caddyfile', '--pidfile', (Join-Path $pidRoot 'caddy.pid')) `
        -WorkingDirectory $WorkingDirectory `
        -StdOutPath $StdOutPath `
        -StdErrPath $StdErrPath `
        -AlreadyRunningNeedles $needles `
        -Label 'Caddy edge' | Out-Null

    if (-not (Wait-ForHttp -Url 'http://127.0.0.1/healthz')) {
        throw 'Caddy no responde en http://127.0.0.1/healthz'
    }

    $postStartRuntime = Get-LocalRuntimeFingerprintStatus `
        -ExpectedSiteRoot $ExpectedSiteRoot `
        -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath
    if ($postStartRuntime.Ok -ne $true) {
        throw ("site_root_mismatch expected_root={0} served_root={1} runtime_config={2}" -f $ExpectedSiteRoot, [string]$postStartRuntime.SiteRoot, [string]$postStartRuntime.CaddyRuntimeConfigPath)
    }
}

function Ensure-CloudflaredTunnel {
    param(
        [string]$CloudflaredExecutable,
        [string]$WorkingDirectory,
        [string]$CurrentCredentialPath,
        [string]$CurrentTunnelId,
        [string]$CurrentPidPath,
        [string]$CurrentLogPath,
        [string]$StdOutPath,
        [string]$StdErrPath
    )

    Start-ManagedProcess `
        -FilePath $CloudflaredExecutable `
        -Arguments @('tunnel', '--metrics', '127.0.0.1:20241', '--pidfile', $CurrentPidPath, '--logfile', $CurrentLogPath, 'run', '--credentials-file', $CurrentCredentialPath, '--url', 'http://127.0.0.1', $CurrentTunnelId) `
        -WorkingDirectory $WorkingDirectory `
        -StdOutPath $StdOutPath `
        -StdErrPath $StdErrPath `
        -AlreadyRunningNeedles @('cloudflared.exe', $CurrentTunnelId, '--url http://127.0.0.1') `
        -Label 'Cloudflare tunnel' | Out-Null
}

function Ensure-LocalHelper {
    param(
        [string]$CurrentPowerShellExe,
        [string]$CurrentWorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath
    )

    $existing = Get-HostingProcessesByNeedle -Needles @('openclaw-auth-helper.js')
    $healthy = Wait-ForHttp -Url 'http://127.0.0.1:4173/health' -Attempts 2 -DelayMs 250
    if (($existing.Count -gt 0) -and $healthy) {
        return
    }
    if (($existing.Count -gt 0) -and (-not $healthy)) {
        Stop-ProcessesById -ProcessIds ($existing | ForEach-Object { [int]$_.ProcessId }) -Label 'unhealthy OpenClaw auth helper'
        Start-Sleep -Milliseconds 400
    }

    Start-ManagedProcess `
        -FilePath $CurrentPowerShellExe `
        -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $helperScriptPath) `
        -WorkingDirectory $CurrentWorkingDirectory `
        -StdOutPath $StdOutPath `
        -StdErrPath $StdErrPath `
        -AlreadyRunningNeedles @('openclaw-auth-helper.js') `
        -Label 'OpenClaw auth helper' | Out-Null

    if (-not (Wait-ForHttp -Url 'http://127.0.0.1:4173/health')) {
        throw 'El helper local de OpenClaw no responde en 127.0.0.1:4173/health'
    }
}

function Get-ProcessesByNeedle {
    param([string[]]$Needles)

    return Get-HostingProcessesByNeedle -Needles $Needles
}

function Ensure-CaddyAndBackendReady {
    param(
        [string]$CaddyExecutable,
        [string]$WorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath,
        [string]$CurrentConfigPath,
        [string]$ExpectedSiteRoot,
        [string]$ExpectedRuntimeConfigPath
    )

    Ensure-CaddyEdge `
        -CaddyExecutable $CaddyExecutable `
        -WorkingDirectory $WorkingDirectory `
        -StdOutPath $StdOutPath `
        -StdErrPath $StdErrPath `
        -CurrentConfigPath $CurrentConfigPath `
        -ExpectedSiteRoot $ExpectedSiteRoot `
        -ExpectedRuntimeConfigPath $ExpectedRuntimeConfigPath
}

function Ensure-OperatorTransportReady {
    param([string]$Transport)

    if ([string]::Equals($Transport, 'local_helper', [System.StringComparison]::OrdinalIgnoreCase)) {
        Ensure-LocalHelper `
            -CurrentPowerShellExe $powershellExe `
            -CurrentWorkingDirectory $repoRoot `
            -StdOutPath $bridgeStdOutPath `
            -StdErrPath $bridgeStdErrPath
        return
    }

    if ($SkipBridge) {
        Write-Info 'OpenClaw auth helper omitido en modo boot/public stack.'
    } else {
        Write-Info ("OpenClaw auth helper omitido; transport activo: {0}" -f $Transport)
    }
}

function Start-ManagedProcess {
    param(
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$StdOutPath,
        [string]$StdErrPath,
        [string[]]$AlreadyRunningNeedles,
        [string]$Label
    )

    $existing = Get-ProcessesByNeedle -Needles $AlreadyRunningNeedles
    if ($existing.Count -gt 0) {
        $pids = ($existing | ForEach-Object { [string]$_.ProcessId } | Sort-Object) -join ', '
        Write-Info ("{0} already running ({1})" -f $Label, $pids)
        return $false
    }

    Write-Info ("Starting {0}" -f $Label)
    Start-Process -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -WindowStyle Hidden `
        -RedirectStandardOutput $StdOutPath `
        -RedirectStandardError $StdErrPath | Out-Null
    return $true
}

if (-not (Test-Path -LiteralPath $caddyTemplatePath)) {
    throw "No existe el Caddyfile canonico: $caddyTemplatePath"
}

if (-not (Test-Path -LiteralPath $cloudflaredCredPath)) {
    throw "No existe el archivo de credenciales del tunnel: $cloudflaredCredPath"
}

$caddyExe = Resolve-ExecutablePath -ConfiguredPath $CaddyExePath -CommandName 'caddy'
$cloudflaredExe = Resolve-ExecutablePath -ConfiguredPath $CloudflaredExePath -CommandName 'cloudflared'
$phpCgiExe = Resolve-ExecutablePath -ConfiguredPath $PhpCgiExePath -CommandName 'php-cgi'
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source

$caddyStdOutPath = Join-Path $logRoot 'caddy-stdout.log'
$caddyStdErrPath = Join-Path $logRoot 'caddy-stderr.log'
$phpStdOutPath = Join-Path $logRoot 'php-cgi-stdout.log'
$phpStdErrPath = Join-Path $logRoot 'php-cgi-stderr.log'
$bridgeStdOutPath = Join-Path $logRoot 'openclaw-auth-helper-stdout.log'
$bridgeStdErrPath = Join-Path $logRoot 'openclaw-auth-helper-stderr.log'
$cloudflaredPidPath = Join-Path $pidRoot 'cloudflared.pid'
$cloudflaredLogPath = Join-Path $logRoot 'cloudflared.log'

if ($StopLegacy) {
    Stop-ProcessesByNeedle -Needles @('C:\srv\pielarmonia\config\Caddyfile', 'caddy.exe') -Label 'legacy Caddy'
    Stop-ProcessesByNeedle -Needles @('--url http://127.0.0.1:8011', $TunnelId, 'cloudflared.exe') -Label 'legacy cloudflared tunnel'
}

Write-Info 'phase=sync_env'
Sync-ExternalEnvFile -SourcePath $externalEnvPathResolved -DestinationPath $mirrorEnvPath | Out-Null
$bootstrapConfig = Get-EffectiveOperatorAuthBootstrapConfig

Write-Info 'phase=render_caddy'
$runtimeConfig = New-HostingRuntimeCaddyConfig `
    -TemplatePath $caddyTemplatePath `
    -RuntimeConfigPath $caddyRuntimeConfigPath `
    -SiteRootPath $repoRoot `
    -AccessLogPath $caddyAccessLogPath

Write-Info 'phase=refresh_php'
Ensure-PhpCgiListener `
    -PhpCgiExecutable $phpCgiExe `
    -WorkingDirectory $repoRoot `
    -StdOutPath $phpStdOutPath `
    -StdErrPath $phpStdErrPath

Write-Info 'phase=refresh_caddy'
Ensure-CaddyAndBackendReady `
    -CaddyExecutable $caddyExe `
    -WorkingDirectory $repoRoot `
    -StdOutPath $caddyStdOutPath `
    -StdErrPath $caddyStdErrPath `
    -CurrentConfigPath $runtimeConfig.Path `
    -ExpectedSiteRoot $repoRoot `
    -ExpectedRuntimeConfigPath $runtimeConfig.Path

Write-Info 'phase=validate_site_root'
$runtimeStatus = Get-LocalRuntimeFingerprintStatus `
    -ExpectedSiteRoot $repoRoot `
    -ExpectedRuntimeConfigPath $runtimeConfig.Path
if ($runtimeStatus.Ok -ne $true) {
    throw ("site_root_mismatch expected_root={0} served_root={1} runtime_config={2}" -f $repoRoot, [string]$runtimeStatus.SiteRoot, [string]$runtimeStatus.CaddyRuntimeConfigPath)
}

$null = Refresh-OperatorAuthRuntime `
    -PhpCgiExecutable $phpCgiExe `
    -CaddyExecutable $caddyExe `
    -CurrentConfigPath $runtimeConfig.Path `
    -ExpectedSiteRoot $repoRoot `
    -ExpectedRuntimeConfigPath $runtimeConfig.Path `
    -BootstrapMode ([string]$bootstrapConfig.Mode) `
    -BootstrapTransport ([string]$bootstrapConfig.Transport)

Write-Info 'phase=resolve_transport'
$operatorAuthTransport = Resolve-OperatorAuthTransport `
    -BootstrapMode ([string]$bootstrapConfig.Mode) `
    -BootstrapTransport ([string]$bootstrapConfig.Transport)
Write-Info ("Operator auth transport detectado: {0}" -f $operatorAuthTransport)

Write-Info 'phase=start_tunnel'
Ensure-CloudflaredTunnel `
    -CloudflaredExecutable $cloudflaredExe `
    -WorkingDirectory $repoRoot `
    -CurrentCredentialPath $cloudflaredCredPath `
    -CurrentTunnelId $TunnelId `
    -CurrentPidPath $cloudflaredPidPath `
    -CurrentLogPath $cloudflaredLogPath `
    -StdOutPath (Join-Path $logRoot 'cloudflared-stdout.log') `
    -StdErrPath (Join-Path $logRoot 'cloudflared-stderr.log')

if (-not $SkipBridge -or $operatorAuthTransport -eq 'local_helper') {
    Ensure-OperatorTransportReady -Transport $operatorAuthTransport
} else {
    Write-Info 'OpenClaw auth helper omitido en modo boot/public stack.'
}

$finalStatusPayload = Get-OperatorAuthStatusPayload
$bootstrapContractDeferred = $false
if (
    ($null -eq $finalStatusPayload -or [string]::IsNullOrWhiteSpace([string]$finalStatusPayload.transport)) -and
    (Test-OperatorAuthBootstrapMode -Mode ([string]$bootstrapConfig.Mode)) -and
    [string]::Equals([string]$bootstrapConfig.Transport, 'web_broker', [System.StringComparison]::OrdinalIgnoreCase)
) {
    $bootstrapContractDeferred = $true
}
Write-Info ("phase=ready bootstrap_contract_deferred={0} final_mode={1} final_transport={2}" -f $bootstrapContractDeferred, [string]$finalStatusPayload.mode, [string]$finalStatusPayload.transport)
Write-Info ("Stack listo. Public domain esperado: https://{0}" -f $PublicDomain)
