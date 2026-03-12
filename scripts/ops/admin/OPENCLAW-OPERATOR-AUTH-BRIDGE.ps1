Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
Push-Location $repoRoot

try {
    node .\bin\operator-auth-bridge.js @args
} finally {
    Pop-Location
}
