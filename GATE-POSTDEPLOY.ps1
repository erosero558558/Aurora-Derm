param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$BenchRuns = 25,
    [int]$CoreP95MaxMs = 800,
    [int]$FigoPostP95MaxMs = 8000,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$AllowMetaCspFallback,
    [switch]$RequireWebhookSecret,
    [switch]$RequireBackupHealthy,
    [switch]$RequireBackupReceiverReady,
    [switch]$RequireCronReady,
    [switch]$RequireStableDataDir,
    [switch]$SkipAssetHashChecks,
    [switch]$SkipFigoPostBench,
    [int]$AssetHashRetryCount = 2,
    [int]$AssetHashRetryDelaySec = 4,
    [int]$VerifyRetryAttempts = 1,
    [int]$VerifyRetryDelaySec = 75
)

$ErrorActionPreference = 'Stop'

Write-Host "== Gate Post-Deploy ==" -ForegroundColor Cyan
Write-Host "Dominio: $Domain"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$failures = 0

Write-Host ""
Write-Host "[1/3] Verificacion de despliegue..." -ForegroundColor Yellow
$verifyAttempts = 0
$verifyMaxAttempts = [Math]::Max(1, $VerifyRetryAttempts + 1)
$verifyPassed = $false

while ($verifyAttempts -lt $verifyMaxAttempts) {
    & .\VERIFICAR-DESPLIEGUE.ps1 `
        -Domain $Domain `
        -AllowDegradedFigo:$AllowDegradedFigo `
        -AllowRecursiveFigo:$AllowRecursiveFigo `
        -AllowMetaCspFallback:$AllowMetaCspFallback `
        -RequireWebhookSecret:$RequireWebhookSecret `
        -RequireBackupHealthy:$RequireBackupHealthy `
        -RequireStableDataDir:$RequireStableDataDir `
        -SkipAssetHashChecks:$SkipAssetHashChecks `
        -AssetHashRetryCount $AssetHashRetryCount `
        -AssetHashRetryDelaySec $AssetHashRetryDelaySec

    if ($LASTEXITCODE -eq 0) {
        $verifyPassed = $true
        break
    }

    $verifyAttempts += 1
    if ($verifyAttempts -lt $verifyMaxAttempts) {
        Write-Host "[WARN] Verificacion fallida. Reintento $verifyAttempts/$($verifyMaxAttempts - 1) en $VerifyRetryDelaySec s..." -ForegroundColor Yellow
        Start-Sleep -Seconds ([Math]::Max(1, $VerifyRetryDelaySec))
    }
}

if (-not $verifyPassed) {
    $failures += 1
}

Write-Host ""
Write-Host "[2/3] Smoke de produccion..." -ForegroundColor Yellow
& .\SMOKE-PRODUCCION.ps1 `
    -Domain $Domain `
    -TestFigoPost `
    -AllowFigoRateLimit `
    -AllowDegradedFigo:$AllowDegradedFigo `
    -AllowRecursiveFigo:$AllowRecursiveFigo `
    -AllowMetaCspFallback:$AllowMetaCspFallback `
    -RequireWebhookSecret:$RequireWebhookSecret `
    -RequireBackupReceiverReady:$RequireBackupReceiverReady `
    -RequireCronReady:$RequireCronReady
if ($LASTEXITCODE -ne 0) {
    $failures += 1
}

Write-Host ""
Write-Host "[3/3] Benchmark API..." -ForegroundColor Yellow
if ($SkipFigoPostBench) {
    Write-Host "[WARN] Benchmark figo-post omitido para este gate."
    & .\BENCH-API-PRODUCCION.ps1 `
        -Domain $Domain `
        -Runs $BenchRuns `
        -CoreP95MaxMs $CoreP95MaxMs `
        -FigoPostP95MaxMs $FigoPostP95MaxMs
} else {
    & .\BENCH-API-PRODUCCION.ps1 `
        -Domain $Domain `
        -Runs $BenchRuns `
        -CoreP95MaxMs $CoreP95MaxMs `
        -FigoPostP95MaxMs $FigoPostP95MaxMs `
        -IncludeFigoPost
}
if ($LASTEXITCODE -ne 0) {
    $failures += 1
}

Write-Host ""
if ($failures -gt 0) {
    Write-Host "Gate FALLIDO: $failures bloque(s) con errores." -ForegroundColor Red
    exit 1
}

Write-Host "Gate OK: despliegue validado." -ForegroundColor Green
exit 0
