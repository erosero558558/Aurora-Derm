param(
    [string]$TunnelId = 'a2067e67-a462-41de-9d43-97cd7df4bda0',
    [switch]$IncludeLegacy,
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Write-Info {
    param([string]$Message)

    if (-not $Quiet) {
        Write-Host "[hosting] $Message"
    }
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

function Stop-ProcessesByNeedle {
    param(
        [string[]]$Needles,
        [string]$Label
    )

    $matches = @(Get-CimInstance Win32_Process | Where-Object {
        Test-CommandLineMatch -CommandLine ([string]$_.CommandLine) -Needles $Needles
    })

    foreach ($match in $matches) {
        Write-Info ("Stopping {0} pid={1}" -f $Label, $match.ProcessId)
        Stop-Process -Id $match.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Stop-ProcessesByNeedle -Needles @('openclaw-auth-helper.js') -Label 'OpenClaw auth helper'
Stop-ProcessesByNeedle -Needles @('OPENCLAW-OPERATOR-AUTH-BRIDGE.ps1') -Label 'legacy OpenClaw auth alias'
Stop-ProcessesByNeedle -Needles @('php-cgi.exe', '-b 127.0.0.1:9000') -Label 'PHP-CGI'
Stop-ProcessesByNeedle -Needles @('cloudflared.exe', $TunnelId) -Label 'Cloudflare tunnel'
Stop-ProcessesByNeedle -Needles @('ops\caddy\Caddyfile', 'caddy.exe', 'run') -Label 'Caddy edge'

if ($IncludeLegacy) {
    Stop-ProcessesByNeedle -Needles @('C:\srv\pielarmonia\config\Caddyfile', 'caddy.exe') -Label 'legacy Caddy'
    Stop-ProcessesByNeedle -Needles @('--url http://127.0.0.1:8011', $TunnelId, 'cloudflared.exe') -Label 'legacy cloudflared tunnel'
}
