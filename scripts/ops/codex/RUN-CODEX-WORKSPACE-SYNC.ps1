param(
    [string]$RepoRoot = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RepoRoot)) {
    $RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..\..")
} else {
    $RepoRoot = Resolve-Path $RepoRoot
}

Push-Location $RepoRoot
try {
    & node "agent-orchestrator.js" workspace sync --once --json | Out-Null
} finally {
    Pop-Location
}
