param(
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$WwwDomain = 'www.pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [switch]$RouteDns,
    [switch]$OverwriteDns,
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$startScriptPath = Join-Path $repoRoot 'scripts\ops\setup\ARRANCAR-HOSTING-WINDOWS.ps1'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startupCmdPath = Join-Path $startupDir 'Pielarmonia Hosting Stack.cmd'
$taskName = 'Pielarmonia Hosting Stack'

function Write-Info {
    param([string]$Message)

    Write-Host "[hosting-config] $Message"
}

function Invoke-Schtasks {
    param([string[]]$Arguments)

    $escapedArguments = foreach ($argument in $Arguments) {
        if ($null -eq $argument) {
            continue
        }

        $value = [string]$argument
        if ($value -match '[\s"]') {
            '"' + $value.Replace('"', '\"') + '"'
        } else {
            $value
        }
    }

    $commandLine = 'schtasks.exe ' + ($escapedArguments -join ' ')

    try {
        $output = & cmd.exe /d /c $commandLine 2>&1
        $exitCode = $LASTEXITCODE
        return [PSCustomObject]@{
            ExitCode = $exitCode
            Output = @($output) -join [Environment]::NewLine
        }
    } finally {
    }
}

if (-not (Test-Path -LiteralPath $startupDir)) {
    New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
}

$startupCommand = 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "{0}" -PublicDomain "{1}" -TunnelId "{2}" -StopLegacy -Quiet' -f $startScriptPath, $PublicDomain, $TunnelId
Set-Content -Path $startupCmdPath -Value "@echo off`r`n$startupCommand`r`n" -Encoding ASCII
Write-Info "Startup shim actualizado: $startupCmdPath"

$scheduledTaskArgs = @(
    '/Create',
    '/F',
    '/SC', 'ONLOGON',
    '/TN', $taskName,
    '/TR', $startupCommand
)

try {
    $taskResult = Invoke-Schtasks -Arguments $scheduledTaskArgs
    if ($taskResult.ExitCode -eq 0) {
        Write-Info "Tarea programada instalada: $taskName"
    } else {
        Write-Warning ("No se pudo registrar la tarea programada; queda activo el startup shim. {0}" -f $taskResult.Output.Trim())
    }
} catch {
    Write-Warning ("No se pudo registrar la tarea programada; queda activo el startup shim. {0}" -f $_.Exception.Message.Trim())
}

if ($RouteDns) {
    $dnsArgs = @()
    if ($OverwriteDns) {
        $dnsArgs += '--overwrite-dns'
    }

    & cloudflared tunnel route dns @dnsArgs $TunnelId $PublicDomain
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo enrutar DNS para $PublicDomain"
    }
    Write-Info "DNS del dominio principal apuntado al tunnel: $PublicDomain"

    & cloudflared tunnel route dns @dnsArgs $TunnelId $WwwDomain
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo enrutar DNS para $WwwDomain"
    }
    Write-Info "DNS del dominio www apuntado al tunnel: $WwwDomain"
}

if ($StartNow) {
    & $startScriptPath -PublicDomain $PublicDomain -TunnelId $TunnelId -StopLegacy
    if ($LASTEXITCODE -ne 0) {
        throw 'El stack de hosting no pudo iniciarse durante la configuracion.'
    }
}
