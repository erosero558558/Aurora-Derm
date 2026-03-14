param(
    [string]$PublicDomain = 'pielarmonia.com',
    [string]$WwwDomain = 'www.pielarmonia.com',
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [string]$OperatorUserProfile = '',
    [switch]$RouteDns,
    [switch]$OverwriteDns,
    [switch]$StartNow
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$startScriptPath = Join-Path $repoRoot 'scripts\ops\setup\ARRANCAR-HOSTING-WINDOWS.ps1'
$startupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$startupCmdPath = Join-Path $startupDir 'Pielarmonia Hosting Stack.cmd'
$bootTaskName = 'Pielarmonia Hosting Stack'
$runKeyPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runKeyName = 'PielarmoniaHostingStack'
$resolvedOperatorUserProfile = if ([string]::IsNullOrWhiteSpace($OperatorUserProfile)) {
    $env:USERPROFILE
} else {
    [System.IO.Path]::GetFullPath($OperatorUserProfile)
}

function Write-Info {
    param([string]$Message)

    Write-Host "[hosting-config] $Message"
}

function Test-IsElevated {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function ConvertTo-CommandToken {
    param([string]$Value)

    if ($null -eq $Value) {
        return '""'
    }

    if ($Value -match '[\s"]') {
        return '"' + $Value.Replace('"', '\"') + '"'
    }

    return $Value
}

function New-StartCommand {
    param([string[]]$StartArguments)

    $escaped = foreach ($argument in $StartArguments) {
        ConvertTo-CommandToken -Value ([string]$argument)
    }

    return 'powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ' + ($escaped -join ' ')
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

$caddyExePath = (Get-Command caddy -ErrorAction Stop).Source
$cloudflaredExePath = (Get-Command cloudflared -ErrorAction Stop).Source
$phpCgiExePath = (Get-Command 'php-cgi' -ErrorAction Stop).Source

$commonStartArguments = @(
    $startScriptPath,
    '-PublicDomain', $PublicDomain,
    '-TunnelId', $TunnelId,
    '-OperatorUserProfile', $resolvedOperatorUserProfile,
    '-CaddyExePath', $caddyExePath,
    '-CloudflaredExePath', $cloudflaredExePath,
    '-PhpCgiExePath', $phpCgiExePath,
    '-StopLegacy',
    '-Quiet'
)

$loginStartCommand = New-StartCommand -StartArguments $commonStartArguments
$bootStartCommand = New-StartCommand -StartArguments ($commonStartArguments + @('-SkipBridge'))

if (-not (Test-Path -LiteralPath $startupDir)) {
    New-Item -ItemType Directory -Path $startupDir -Force | Out-Null
}

$startupCommand = $loginStartCommand
Set-Content -Path $startupCmdPath -Value "@echo off`r`n$startupCommand`r`n" -Encoding ASCII
Write-Info "Startup shim actualizado: $startupCmdPath"

if (-not (Test-Path -LiteralPath $runKeyPath)) {
    New-Item -Path $runKeyPath -Force | Out-Null
}

New-ItemProperty -Path $runKeyPath -Name $runKeyName -Value $loginStartCommand -PropertyType String -Force | Out-Null
Write-Info "Registro HKCU\\Run actualizado: $runKeyName"

if (Test-IsElevated) {
    $bootTaskArgs = @(
        '/Create',
        '/F',
        '/SC', 'ONSTART',
        '/RL', 'HIGHEST',
        '/RU', 'SYSTEM',
        '/TN', $bootTaskName,
        '/TR', $bootStartCommand
    )

    try {
        $taskResult = Invoke-Schtasks -Arguments $bootTaskArgs
        if ($taskResult.ExitCode -eq 0) {
            Write-Info "Tarea programada de boot instalada: $bootTaskName"
        } else {
            Write-Warning ("No se pudo registrar la tarea de boot sin login. {0}" -f $taskResult.Output.Trim())
        }
    } catch {
        Write-Warning ("No se pudo registrar la tarea de boot sin login. {0}" -f $_.Exception.Message.Trim())
    }
} else {
    Write-Warning 'La sesion actual no esta elevada. El stack queda resiliente al iniciar sesion via Startup + HKCU\\Run, pero el arranque pre-login requiere reejecutar este script como Administrador.'
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
    & $startScriptPath `
        -PublicDomain $PublicDomain `
        -TunnelId $TunnelId `
        -OperatorUserProfile $resolvedOperatorUserProfile `
        -CaddyExePath $caddyExePath `
        -CloudflaredExePath $cloudflaredExePath `
        -PhpCgiExePath $phpCgiExePath `
        -StopLegacy
    if ($LASTEXITCODE -ne 0) {
        throw 'El stack de hosting no pudo iniciarse durante la configuracion.'
    }
}
