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
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
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
$powershellExe = (Get-Command powershell -ErrorAction Stop).Source
$gitExe = (Get-Command git -ErrorAction Stop).Source
$taskNames = @(
    'Pielarmonia Hosting Supervisor',
    'Pielarmonia Hosting Main Sync',
    'Pielarmonia Hosting Stack'
)

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
        Write-Host "[hosting-repair] $Message"
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
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                $content = Get-Content -LiteralPath $path -Raw
                if (-not [string]::IsNullOrWhiteSpace($content)) {
                    $chunks += $content.Trim()
                }
            }
        }

        return [PSCustomObject]@{
            ExitCode = $process.ExitCode
            Output = $chunks -join [Environment]::NewLine
        }
    } finally {
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
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

function Stop-TaskIfPresent {
    param([string]$TaskName)

    try {
        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        if ($null -ne $task) {
            Stop-ScheduledTask -InputObject $task -ErrorAction SilentlyContinue
            Write-Info ("Tarea detenida: {0}" -f $TaskName)
        }
    } catch {
    }
}

function Stop-ProcessesByNeedle {
    param(
        [string[]]$Needles,
        [string]$Label
    )

    $matches = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
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

    foreach ($match in $matches) {
        Write-Info ("Stopping {0} pid={1}" -f $Label, $match.ProcessId)
        Stop-Process -Id $match.ProcessId -Force -ErrorAction SilentlyContinue
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
    Write-JsonFile -Path $Path -Payload $payload
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

$status = [ordered]@{
    ok = $false
    timestamp = [DateTimeOffset]::Now.ToString('o')
    mirror_repo_path = $mirrorRepoPathResolved
    release_target_path = $releaseTargetPathResolved
    promoted_commit = ''
    repaired = $false
    error = ''
}

try {
    Ensure-ParentDirectory -Path $statusPathResolved
    Ensure-ParentDirectory -Path $releaseTargetPathResolved
    $hostingDir = Split-Path -Parent $releaseTargetPathResolved

    foreach ($taskName in $taskNames) {
        Stop-TaskIfPresent -TaskName $taskName
    }

    Stop-ProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000') -Label 'PHP-CGI'
    Stop-ProcessesByNeedle -Needles @('caddy.exe', 'ops\caddy\Caddyfile', 'run') -Label 'Caddy edge'
    Stop-ProcessesByNeedle -Needles @('cloudflared.exe', $TunnelId, '--url http://127.0.0.1') -Label 'Cloudflare tunnel'
    Stop-ProcessesByNeedle -Needles @('openclaw-auth-helper.js') -Label 'OpenClaw auth helper'
    Stop-ProcessesByNeedle -Needles @('SUPERVISAR-HOSTING-WINDOWS.ps1') -Label 'Hosting supervisor'
    Clear-HostingLocks -HostingDir $hostingDir

    if ([string]::IsNullOrWhiteSpace($TargetCommit) -and $PromoteCurrentRemoteHead) {
        $TargetCommit = Resolve-RemoteHead -RepoPath $mirrorRepoPathResolved -BranchName 'main'
    }
    if (-not [string]::IsNullOrWhiteSpace($TargetCommit)) {
        Write-ReleaseTarget -Path $releaseTargetPathResolved -Commit $TargetCommit -SourceRunId 'repair_promote_remote'
        $status.promoted_commit = $TargetCommit
        Write-Info ("Release target actualizado manualmente: {0}" -f $TargetCommit)
    }

    $syncArguments = New-Object 'System.Collections.Generic.List[string]'
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
        $syncArguments.Add([string]$token) | Out-Null
    }
    Add-OptionalNamedArgument -Arguments $syncArguments -Name '-CaddyExePath' -Value $CaddyExePath
    Add-OptionalNamedArgument -Arguments $syncArguments -Name '-CloudflaredExePath' -Value $CloudflaredExePath
    Add-OptionalNamedArgument -Arguments $syncArguments -Name '-PhpCgiExePath' -Value $PhpCgiExePath
    $syncResult = Invoke-CommandWithOutput -FilePath $powershellExe -Arguments $syncArguments
    if ($syncResult.ExitCode -ne 0) {
        throw ("SINCRONIZAR-HOSTING-WINDOWS.ps1 no pudo recuperar el servicio. {0}" -f $syncResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($syncResult.Output)) {
        Write-Info $syncResult.Output.Trim()
    }

    $configArguments = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $configScriptPath,
        '-MirrorRepoPath', $mirrorRepoPathResolved,
        '-ExternalEnvPath', $externalEnvPathResolved,
        '-ReleaseTargetPath', $releaseTargetPathResolved,
        '-PublicDomain', $PublicDomain,
        '-TunnelId', $TunnelId,
        '-OperatorUserProfile', $resolvedOperatorUserProfile
    )
    $configResult = Invoke-CommandWithOutput -FilePath $powershellExe -Arguments $configArguments
    if ($configResult.ExitCode -ne 0) {
        throw ("CONFIGURAR-HOSTING-WINDOWS.ps1 no pudo reinstalar el supervisor. {0}" -f $configResult.Output.Trim())
    }
    if (-not [string]::IsNullOrWhiteSpace($configResult.Output)) {
        Write-Info $configResult.Output.Trim()
    }

    Invoke-LocalSmoke -ScriptPath $smokeScriptPath

    $status.ok = $true
    $status.repaired = $true
    Write-JsonFile -Path $statusPathResolved -Payload $status
    Write-Info 'Reparacion completada con health/auth/smoke locales en verde.'
} catch {
    $status.error = $_.Exception.Message
    Write-JsonFile -Path $statusPathResolved -Payload $status
    Write-Info ("Reparacion fallida: {0}" -f $status.error)
    throw
}
