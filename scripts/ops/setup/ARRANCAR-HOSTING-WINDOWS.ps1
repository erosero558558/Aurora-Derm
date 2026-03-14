param(
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [string]$CaddyExePath = '',
    [string]$CloudflaredExePath = '',
    [string]$PhpCgiExePath = '',
    [switch]$StopLegacy,
    [switch]$SkipBridge,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$runtimeRoot = Join-Path $repoRoot 'data\runtime\hosting'
$logRoot = Join-Path $runtimeRoot 'logs'
$pidRoot = Join-Path $runtimeRoot 'pids'
$caddyConfigPath = Join-Path $repoRoot 'ops\caddy\Caddyfile'
$helperScriptPath = Join-Path $repoRoot 'scripts\ops\admin\INICIAR-OPENCLAW-AUTH-HELPER.ps1'
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

function Test-CommandLineMatch {
    param(
        [string]$CommandLine,
        [string[]]$Needles
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    foreach ($needle in $Needles) {
        if ([string]::IsNullOrWhiteSpace($needle)) {
            continue
        }

        if ($CommandLine.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            return $false
        }
    }

    return $true
}

function Get-ProcessesByNeedle {
    param([string[]]$Needles)

    return @(Get-CimInstance Win32_Process | Where-Object {
        Test-CommandLineMatch -CommandLine ([string]$_.CommandLine) -Needles $Needles
    })
}

function Stop-ProcessesByNeedle {
    param(
        [string[]]$Needles,
        [string]$Label
    )

    $matches = Get-ProcessesByNeedle -Needles $Needles
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
        try {
            $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -TimeoutSec 5
            if ($null -ne $response.StatusCode -and [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500) {
                return $true
            }
        } catch {
        }

        Start-Sleep -Milliseconds $DelayMs
    }

    return $false
}

function Wait-ForTcp {
    param(
        [int]$Port,
        [int]$Attempts = 20,
        [int]$DelayMs = 500
    )

    for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
        $match = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
            Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $_.LocalPort -eq $Port } |
            Select-Object -First 1
        if ($null -ne $match) {
            return $true
        }

        Start-Sleep -Milliseconds $DelayMs
    }

    return $false
}

function Get-ListeningTcpProcess {
    param([int]$Port)

    return Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalAddress -eq '127.0.0.1' -and $_.LocalPort -eq $Port } |
        Select-Object -First 1
}

function Get-ProcessByIdSafe {
    param([int]$ProcessId)

    return Get-CimInstance Win32_Process -Filter ("ProcessId = {0}" -f $ProcessId) -ErrorAction SilentlyContinue
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

if (-not (Test-Path -LiteralPath $caddyConfigPath)) {
    throw "No existe el Caddyfile canonico: $caddyConfigPath"
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

Ensure-PhpCgiListener `
    -PhpCgiExecutable $phpCgiExe `
    -WorkingDirectory $repoRoot `
    -StdOutPath $phpStdOutPath `
    -StdErrPath $phpStdErrPath

Start-ManagedProcess `
    -FilePath $caddyExe `
    -Arguments @('run', '--config', $caddyConfigPath, '--adapter', 'caddyfile', '--pidfile', (Join-Path $pidRoot 'caddy.pid')) `
    -WorkingDirectory $repoRoot `
    -StdOutPath $caddyStdOutPath `
    -StdErrPath $caddyStdErrPath `
    -AlreadyRunningNeedles @($caddyConfigPath, 'caddy.exe', 'run') `
    -Label 'Caddy edge' | Out-Null

if (-not (Wait-ForHttp -Url 'http://127.0.0.1/healthz')) {
    throw 'Caddy no responde en http://127.0.0.1/healthz'
}

Start-ManagedProcess `
    -FilePath $cloudflaredExe `
    -Arguments @('tunnel', '--metrics', '127.0.0.1:20241', '--pidfile', $cloudflaredPidPath, '--logfile', $cloudflaredLogPath, 'run', '--credentials-file', $cloudflaredCredPath, '--url', 'http://127.0.0.1', $TunnelId) `
    -WorkingDirectory $repoRoot `
    -StdOutPath (Join-Path $logRoot 'cloudflared-stdout.log') `
    -StdErrPath (Join-Path $logRoot 'cloudflared-stderr.log') `
    -AlreadyRunningNeedles @('cloudflared.exe', $TunnelId, '--url http://127.0.0.1') `
    -Label 'Cloudflare tunnel' | Out-Null

if (-not $SkipBridge) {
    Start-ManagedProcess `
        -FilePath $powershellExe `
        -Arguments @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $helperScriptPath) `
        -WorkingDirectory $repoRoot `
        -StdOutPath $bridgeStdOutPath `
        -StdErrPath $bridgeStdErrPath `
        -AlreadyRunningNeedles @('openclaw-auth-helper.js') `
        -Label 'OpenClaw auth helper' | Out-Null

    if (-not (Wait-ForHttp -Url 'http://127.0.0.1:4173/health')) {
        throw 'El helper local de OpenClaw no responde en 127.0.0.1:4173/health'
    }
} else {
    Write-Info 'OpenClaw auth helper omitido en modo boot/public stack.'
}

Write-Info ("Stack listo. Public domain esperado: https://{0}" -f $PublicDomain)
