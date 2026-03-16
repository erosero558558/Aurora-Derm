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
    [switch]$RunOnce,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

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
$lockPath = $statusPathResolved + '.lock'
$lockInfoPath = $lockPath + '.json'
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
        Write-Host "[hosting-supervisor] $Message"
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
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -Path $Path -Encoding UTF8
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

function Acquire-SupervisorLock {
    try {
        $stream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        Write-JsonFile -Path $lockInfoPath -Payload ([ordered]@{
            owner_pid = $PID
            started_at = [DateTimeOffset]::Now.ToString('o')
        })
        return $stream
    } catch {
        $snapshot = Read-JsonFileSafe -Path $lockInfoPath
        $ownerPid = 0
        if ($null -ne $snapshot) {
            try { $ownerPid = [int]$snapshot.owner_pid } catch {}
        }
        if (($ownerPid -eq 0) -or (-not (Test-ProcessExists -ProcessId $ownerPid))) {
            foreach ($path in @($lockPath, $lockInfoPath)) {
                if (Test-Path -LiteralPath $path) {
                    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
                }
            }
            return Acquire-SupervisorLock
        }
        throw 'Otro supervisor sigue activo.'
    }
}

function Invoke-LocalHealth {
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1/api.php?resource=health-diagnostics' -Headers @{ Accept = 'application/json' } -UseBasicParsing -TimeoutSec 15
        $payload = $response.Content | ConvertFrom-Json -Depth 12
        return [PSCustomObject]@{
            Ok = ($payload.ok -eq $true)
            Error = ''
        }
    } catch {
        return [PSCustomObject]@{
            Ok = $false
            Error = $_.Exception.Message
        }
    }
}

function Invoke-LocalAuth {
    try {
        $response = Invoke-WebRequest -Uri 'http://127.0.0.1/admin-auth.php?action=status' -Headers @{ Accept = 'application/json' } -UseBasicParsing -TimeoutSec 15
        $payload = $response.Content | ConvertFrom-Json -Depth 12
        $ok =
            ([string]$payload.mode -eq 'openclaw_chatgpt') -and
            ([string]$payload.transport -eq 'web_broker') -and
            ([string]$payload.status -ne 'transport_misconfigured')
        return [PSCustomObject]@{
            Ok = $ok
            Mode = [string]$payload.mode
            Transport = [string]$payload.transport
            Status = [string]$payload.status
            Error = if ($ok) { '' } else { 'Contrato OpenClaw invalido en supervisor.' }
        }
    } catch {
        return [PSCustomObject]@{
            Ok = $false
            Mode = ''
            Transport = ''
            Status = ''
            Error = $_.Exception.Message
        }
    }
}

function Get-ServiceState {
    param([string]$CurrentTunnelId)

    $phpProcesses = Get-ProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000')
    $caddyProcesses = Get-ProcessesByNeedle -Needles @('caddy.exe', 'ops\caddy\Caddyfile', 'run')
    $cloudflaredProcesses = Get-ProcessesByNeedle -Needles @('cloudflared.exe', $CurrentTunnelId, '--url http://127.0.0.1')
    $helperProcesses = Get-ProcessesByNeedle -Needles @('openclaw-auth-helper.js')

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

        $payload = Read-JsonFileSafe -Path $reportPath
        return [PSCustomObject]@{
            Ok = ($result.ExitCode -eq 0) -and ($null -ne $payload) -and ($payload.ok -eq $true)
            Error = if ($null -eq $payload) { 'No se genero reporte de smoke.' } else { [string]$payload.error }
        }
    } finally {
        Remove-Item -LiteralPath $reportPath -Force -ErrorAction SilentlyContinue
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
    Add-OptionalNamedArgument -Arguments $arguments -Name '-CaddyExePath' -Value $CaddyExePath
    Add-OptionalNamedArgument -Arguments $arguments -Name '-CloudflaredExePath' -Value $CloudflaredExePath
    Add-OptionalNamedArgument -Arguments $arguments -Name '-PhpCgiExePath' -Value $PhpCgiExePath

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

$lockStream = $null
$lastRepairAt = [DateTimeOffset]::MinValue

try {
    Ensure-ParentDirectory -Path $statusPathResolved
    $lockStream = Acquire-SupervisorLock
    Write-Info ("Supervisor activo para mirror={0}" -f $mirrorRepoPathResolved)

    while ($true) {
        $service = Get-ServiceState -CurrentTunnelId $TunnelId
        $health = Invoke-LocalHealth
        $auth = Invoke-LocalAuth
        $smoke = if ($health.Ok -and $auth.Ok) {
            Invoke-HostingSmoke -ScriptPath $smokeScriptPath
        } else {
            [PSCustomObject]@{ Ok = $false; Error = 'health/auth aun no estan sanos.' }
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
                } catch {
                    $repairError = $_.Exception.Message
                    $lastRepairAt = [DateTimeOffset]::Now
                    Write-Info ("Supervisor no pudo reparar el hosting: {0}" -f $repairError)
                }
            }
        }

        $status = [ordered]@{
            ok = (-not $degraded) -or ($repairAttempted -and [string]::IsNullOrWhiteSpace($repairError))
            timestamp = [DateTimeOffset]::Now.ToString('o')
            mirror_repo_path = $mirrorRepoPathResolved
            external_env_path = $externalEnvPathResolved
            release_target_path = $releaseTargetPathResolved
            service_state = [string]$service.State
            health_ok = $health.Ok -eq $true
            auth_contract_ok = $auth.Ok -eq $true
            auth_mode = [string]$auth.Mode
            auth_transport = [string]$auth.Transport
            auth_status = [string]$auth.Status
            smoke_ok = $smoke.Ok -eq $true
            degraded = $degraded
            repair_attempted = $repairAttempted
            last_repair_at = if ($lastRepairAt -eq [DateTimeOffset]::MinValue) { '' } else { $lastRepairAt.ToString('o') }
            repair_error = $repairError
            php_pids = @($service.PhpPids)
            caddy_pids = @($service.CaddyPids)
            cloudflared_pids = @($service.CloudflaredPids)
            helper_pids = @($service.HelperPids)
        }
        Write-JsonFile -Path $statusPathResolved -Payload $status

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

    foreach ($path in @($lockPath, $lockInfoPath)) {
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
        }
    }
}
