param(
    [string]$ServerBaseUrl = '',
    [string]$HelperBaseUrl = '',
    [string]$RuntimeBaseUrl = '',
    [string]$BridgeToken = '',
    [string]$BridgeSecret = '',
    [string]$HelperDeviceId = '',
    [string]$GatewayApiKey = '',
    [string]$GatewayKeyHeader = '',
    [string]$GatewayKeyPrefix = '',
    [switch]$SkipPreflight
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$preflightScript = Join-Path $repoRoot 'bin/openclaw-auth-preflight.js'
$helperScript = Join-Path $repoRoot 'bin/openclaw-auth-helper.js'
$nodeCommand = Get-Command node -ErrorAction Stop

function Set-OptionalEnv {
    param(
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    [Environment]::SetEnvironmentVariable($Name, $Value.Trim(), 'Process')
}

function Invoke-NodeJsonCommand {
    param(
        [string]$ScriptPath,
        [string[]]$Arguments = @()
    )

    $output = & $nodeCommand.Source $ScriptPath @Arguments
    $exitCode = $LASTEXITCODE
    $raw = @($output) -join [Environment]::NewLine

    if ([string]::IsNullOrWhiteSpace($raw)) {
        throw "El comando node $ScriptPath no produjo salida JSON."
    }

    try {
        $json = $raw | ConvertFrom-Json
    } catch {
        throw "No se pudo parsear la salida JSON de $ScriptPath.`n$raw"
    }

    return [PSCustomObject]@{
        ExitCode = [int]$exitCode
        Json = $json
        Raw = $raw
    }
}

Set-OptionalEnv -Name 'PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL' -Value $ServerBaseUrl
Set-OptionalEnv -Name 'PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL' -Value $HelperBaseUrl
Set-OptionalEnv -Name 'OPENCLAW_RUNTIME_BASE_URL' -Value $RuntimeBaseUrl
Set-OptionalEnv -Name 'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN' -Value $BridgeToken
Set-OptionalEnv -Name 'PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET' -Value $BridgeSecret
Set-OptionalEnv -Name 'OPENCLAW_HELPER_DEVICE_ID' -Value $HelperDeviceId
Set-OptionalEnv -Name 'OPENCLAW_GATEWAY_API_KEY' -Value $GatewayApiKey
Set-OptionalEnv -Name 'OPENCLAW_GATEWAY_KEY_HEADER' -Value $GatewayKeyHeader
Set-OptionalEnv -Name 'OPENCLAW_GATEWAY_KEY_PREFIX' -Value $GatewayKeyPrefix

if (-not $SkipPreflight) {
    Write-Host '[openclaw-auth] Ejecutando preflight local...'
    $preflightResult = Invoke-NodeJsonCommand -ScriptPath $preflightScript -Arguments @('--json')
    $preflight = $preflightResult.Json

    Write-Host "[openclaw-auth] ok=$($preflight.ok) readyForLogin=$($preflight.readyForLogin)"
    Write-Host "[openclaw-auth] helperBaseUrl=$($preflight.helper.baseUrl) runtimeBaseUrl=$($preflight.runtime.baseUrl)"

    if (-not [string]::IsNullOrWhiteSpace([string]$preflight.nextAction)) {
        Write-Host "[openclaw-auth] nextAction: $($preflight.nextAction)"
    }

    if (-not $preflight.ok) {
        throw "El preflight OpenClaw no cumplio los requisitos minimos. $($preflight.nextAction)"
    }

    if (-not $preflight.readyForLogin) {
        Write-Warning 'El runtime ya responde, pero todavia no hay sesion OpenClaw activa. El helper se iniciara igual para esperar el challenge del admin.'
    }
}

Write-Host '[openclaw-auth] Iniciando helper local en modo foreground...'
& $nodeCommand.Source $helperScript
exit $LASTEXITCODE
