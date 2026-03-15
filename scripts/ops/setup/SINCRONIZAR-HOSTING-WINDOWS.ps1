param(
    [string]$MirrorRepoPath = 'C:\dev\pielarmonia-clean-main',
    [string]$ExternalEnvPath = 'C:\ProgramData\Pielarmonia\hosting\env.php',
    [string]$StatusPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync-status.json',
    [string]$LogPath = 'C:\ProgramData\Pielarmonia\hosting\main-sync.log',
    [string]$RepoUrl = 'https://github.com/erosero558558/piel-en-armonia.git',
    [string]$Branch = 'main',
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [string]$CaddyExePath = '',
    [string]$CloudflaredExePath = '',
    [string]$PhpCgiExePath = '',
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$mirrorRepoPathResolved = [System.IO.Path]::GetFullPath($MirrorRepoPath)
$statusPathResolved = [System.IO.Path]::GetFullPath($StatusPath)
$logPathResolved = [System.IO.Path]::GetFullPath($LogPath)
$externalEnvPathResolved = [System.IO.Path]::GetFullPath($ExternalEnvPath)
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}
$mirrorEnvPath = Join-Path $mirrorRepoPathResolved 'env.php'
$mirrorStartScriptPath = Join-Path $mirrorRepoPathResolved 'scripts\ops\setup\ARRANCAR-HOSTING-WINDOWS.ps1'
$lockPath = $statusPathResolved + '.lock'
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

function Write-Status {
    param([hashtable]$Payload)

    Ensure-ParentDirectory -Path $statusPathResolved
    $json = $Payload | ConvertTo-Json -Depth 8
    Set-Content -Path $statusPathResolved -Value $json -Encoding UTF8
}

function Get-FileHashSafe {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return ''
    }

    return [string]((Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash).ToLowerInvariant()
}

function Invoke-CommandWithOutput {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $output = & $FilePath @Arguments 2>&1
    return [PSCustomObject]@{
        ExitCode = $LASTEXITCODE
        Output = @($output) -join [Environment]::NewLine
    }
}

function Invoke-Git {
    param([string[]]$Arguments)

    return Invoke-CommandWithOutput -FilePath $gitExe -Arguments $Arguments
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

    $arguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $StartScriptPath,
        '-PublicDomain', $CurrentPublicDomain,
        '-TunnelId', $CurrentTunnelId,
        '-OperatorUserProfile', $CurrentOperatorUserProfile,
        '-CaddyExePath', $CurrentCaddyExePath,
        '-CloudflaredExePath', $CurrentCloudflaredExePath,
        '-PhpCgiExePath', $CurrentPhpCgiExePath,
        '-StopLegacy',
        '-Quiet'
    )

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

$status = [ordered]@{
    ok = $false
    state = 'starting'
    timestamp = [DateTimeOffset]::Now.ToString('o')
    mirror_repo_path = $mirrorRepoPathResolved
    external_env_path = $externalEnvPathResolved
    repo_url = $RepoUrl
    branch = $Branch
    previous_head = ''
    current_head = ''
    head_changed = $false
    env_changed = $false
    restarted = $false
    cloned = $false
    health_ok = $false
    error = ''
}

$lockStream = $null

try {
    Ensure-ParentDirectory -Path $statusPathResolved
    Ensure-ParentDirectory -Path $logPathResolved
    Ensure-ParentDirectory -Path $lockPath

    try {
        $lockStream = [System.IO.File]::Open($lockPath, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    } catch {
        $status.state = 'locked'
        $status.ok = $true
        $status.error = 'sync_already_running'
        Write-Status -Payload $status
        Write-Info 'Otro ciclo de sync sigue en ejecucion; este intento se omite.'
        exit 0
    }

    if (-not (Test-Path -LiteralPath $externalEnvPathResolved)) {
        throw "No existe el env externo canonico: $externalEnvPathResolved"
    }

    $status.previous_head = Get-GitHeadSafe -RepoPath $mirrorRepoPathResolved
    $mirrorEnvHashBefore = Get-FileHashSafe -Path $mirrorEnvPath
    $externalEnvHash = Get-FileHashSafe -Path $externalEnvPathResolved

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

    $checkoutResult = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'checkout', '--force', $Branch)
    if ($checkoutResult.ExitCode -ne 0) {
        throw ("No se pudo cambiar el mirror a la rama $Branch. {0}" -f $checkoutResult.Output.Trim())
    }

    $resetResult = Invoke-Git -Arguments @('-C', $mirrorRepoPathResolved, 'reset', '--hard', "origin/$Branch")
    if ($resetResult.ExitCode -ne 0) {
        throw ("No se pudo alinear el mirror contra origin/$Branch. {0}" -f $resetResult.Output.Trim())
    }

    Copy-Item -LiteralPath $externalEnvPathResolved -Destination $mirrorEnvPath -Force

    $status.current_head = Get-GitHeadSafe -RepoPath $mirrorRepoPathResolved
    $status.head_changed = $status.previous_head -ne $status.current_head

    $mirrorEnvHashAfter = Get-FileHashSafe -Path $mirrorEnvPath
    $status.env_changed = $mirrorEnvHashBefore -ne $mirrorEnvHashAfter

    if ($status.cloned -or $status.head_changed -or $status.env_changed) {
        Invoke-StartMirrorStack `
            -StartScriptPath $mirrorStartScriptPath `
            -CurrentPublicDomain $PublicDomain `
            -CurrentTunnelId $TunnelId `
            -CurrentOperatorUserProfile $resolvedOperatorUserProfile `
            -CurrentCaddyExePath $CaddyExePath `
            -CurrentCloudflaredExePath $CloudflaredExePath `
            -CurrentPhpCgiExePath $PhpCgiExePath

        $health = Invoke-HealthDiagnostics
        if ($health.Ok -ne $true) {
            throw ("El health local no quedo sano despues del restart del mirror. {0}" -f [string]$health.Error)
        }

        $status.health_ok = $true
        $status.restarted = $true
        $status.state = 'updated'
    } else {
        $status.health_ok = $true
        $status.state = 'idle'
    }

    $status.ok = $true
    Write-Status -Payload $status
    Write-Info ("Sync completado: state={0} head={1}" -f $status.state, $status.current_head)
} catch {
    $status.ok = $false
    $status.state = 'failed'
    $status.error = $_.Exception.Message
    Write-Status -Payload $status
    Write-Info ("Sync fallido: {0}" -f $status.error)
    throw
} finally {
    if ($null -ne $lockStream) {
        $lockStream.Dispose()
    }
}
