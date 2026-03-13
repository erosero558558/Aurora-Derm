param(
    [string]$ServerBaseUrl = '',
    [switch]$Json
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$smokeScript = Join-Path $repoRoot 'bin/openclaw-auth-local-smoke.js'
$nodeCommand = Get-Command node -ErrorAction Stop

if (-not [string]::IsNullOrWhiteSpace($ServerBaseUrl)) {
    [Environment]::SetEnvironmentVariable(
        'PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL',
        $ServerBaseUrl.Trim(),
        'Process'
    )
}

$arguments = @($smokeScript)
if ($Json) {
    $arguments += '--json'
}

& $nodeCommand.Source @arguments
exit $LASTEXITCODE
