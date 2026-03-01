param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$OpenCleanupUrl,
    [switch]$OpenForcedLegacyUrl
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')

function Invoke-JsonGet {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'application/json'
            'User-Agent' = 'AdminUiContingencia/1.0'
        }

        $parsed = $null
        try {
            $parsed = $response.Content | ConvertFrom-Json
        } catch {
            $parsed = $null
        }

        return [PSCustomObject]@{
            Ok = $true
            Status = [int]$response.StatusCode
            Json = $parsed
            Raw = [string]$response.Content
            Error = ''
        }
    } catch {
        $status = 0
        $raw = ''
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try { $status = [int]$response.StatusCode } catch { $status = 0 }
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $raw = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }

        return [PSCustomObject]@{
            Ok = $false
            Status = $status
            Json = $null
            Raw = $raw
            Error = $_.Exception.Message
        }
    }
}

$featuresUrl = "$base/api.php?resource=features"
$cleanupUrl = "$base/admin.html?admin_ui_reset=1"
$forcedLegacyUrl = "$base/admin.html?admin_ui=legacy&admin_ui_reset=1"
$forcedSonyUrl = "$base/admin.html?admin_ui=sony_v2"

Write-Host "== Admin UI Contingencia =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

$featuresResult = Invoke-JsonGet -Url $featuresUrl
if ($featuresResult.Ok -and $null -ne $featuresResult.Json -and $featuresResult.Json.ok -eq $true) {
    $flagEnabled = $false
    try {
        $flagEnabled = [bool]$featuresResult.Json.data.admin_sony_ui
    } catch {
        $flagEnabled = $false
    }
    $flagText = if ($flagEnabled) { 'true' } else { 'false' }
    Write-Host "[OK] Features API -> HTTP $($featuresResult.Status)"
    Write-Host "[INFO] admin_sony_ui actual: $flagText"
} else {
    Write-Host "[WARN] No se pudo leer el estado de admin_sony_ui desde $featuresUrl (HTTP $($featuresResult.Status))."
    if ($featuresResult.Error) {
        Write-Host "       $($featuresResult.Error)"
    }
}

Write-Host ""
Write-Host "URLs operativas:"
Write-Host " - Limpieza de variante local: $cleanupUrl"
Write-Host " - Legacy forzado sin persistencia: $forcedLegacyUrl"
Write-Host " - Sony v2 forzado (QA): $forcedSonyUrl"
Write-Host ""
Write-Host "Rollback inmediato recomendado:"
Write-Host "1. Forzar kill-switch global: FEATURE_ADMIN_SONY_UI=false (o admin_sony_ui=false en storage de flags)."
Write-Host "2. En cada estacion de admin, abrir URL de limpieza: $cleanupUrl"
Write-Host "3. Si se requiere sesion legacy inmediata, abrir: $forcedLegacyUrl"
Write-Host "4. Cerrar y reabrir admin.html sin query params para validar fallback legacy."
Write-Host ""
Write-Host "Cutover / canary recomendado:"
Write-Host "1. QA interno: usar ?admin_ui=sony_v2."
Write-Host "2. Canary: habilitar admin_sony_ui gradualmente."
Write-Host "3. General: admin_sony_ui=true."
Write-Host "4. Validar smoke admin despues de cada cambio."

if ($OpenCleanupUrl) {
    Write-Host ""
    Write-Host "[INFO] Abriendo URL de limpieza en navegador..."
    Start-Process $cleanupUrl
}

if ($OpenForcedLegacyUrl) {
    Write-Host ""
    Write-Host "[INFO] Abriendo URL de legacy forzado en navegador..."
    Start-Process $forcedLegacyUrl
}

exit 0
