Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$canonicalScript = Join-Path $repoRoot 'scripts\ops\admin\INICIAR-OPENCLAW-AUTH-HELPER.ps1'
Push-Location $repoRoot

try {
    Write-Warning '[DEPRECATED] OPENCLAW-OPERATOR-AUTH-BRIDGE.ps1 ahora delega a INICIAR-OPENCLAW-AUTH-HELPER.ps1. Usa `npm run openclaw:auth:start`.'
    & $canonicalScript @args
} finally {
    Pop-Location
}
