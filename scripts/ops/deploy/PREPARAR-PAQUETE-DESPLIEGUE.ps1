param(
    [string]$OutputDir = '_deploy_bundle',
    [switch]$IncludeTooling,
    [switch]$SkipBuild,
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$scriptPath = Join-Path $repoRoot 'bin\prepare-deploy-bundle.js'

if (-not (Test-Path -LiteralPath $scriptPath)) {
    throw "No existe $scriptPath"
}

$arguments = @($scriptPath, '--output-dir', $OutputDir)
if ($IncludeTooling) {
    $arguments += '--include-tooling'
}
if ($SkipBuild) {
    $arguments += '--skip-build'
}
if ($Json) {
    $arguments += '--json'
}

Push-Location $repoRoot
try {
    & node @arguments
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
