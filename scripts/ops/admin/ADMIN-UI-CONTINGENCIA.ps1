param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$OpenAdmin
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$adminUrl = "$base/admin.html"

function Invoke-HttpCheck {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'text/html,application/json;q=0.9,*/*;q=0.8'
            'User-Agent' = 'AdminUiContingencia/2.0'
        }

        return [PSCustomObject]@{
            Ok = $true
            Status = [int]$response.StatusCode
            Body = [string]$response.Content
            Error = ''
        }
    } catch {
        $status = 0
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try { $status = [int]$response.StatusCode } catch { $status = 0 }
        }

        return [PSCustomObject]@{
            Ok = $false
            Status = $status
            Body = ''
            Error = $_.Exception.Message
        }
    }
}

Write-Host "== Admin UI Contingencia =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

$adminResult = Invoke-HttpCheck -Url $adminUrl
if ($adminResult.Ok) {
    Write-Host "[OK] admin.html -> HTTP $($adminResult.Status)"
} else {
    Write-Host "[FAIL] admin.html no responde correctamente (HTTP $($adminResult.Status))"
    if ($adminResult.Error) {
        Write-Host "       $($adminResult.Error)"
    }
}

Write-Host ""
Write-Host "Contrato activo:"
Write-Host " - El admin arranca solo en sony_v3."
Write-Host " - No existe fallback runtime a sony_v2 o legacy."
Write-Host " - Los parametros admin_ui/admin_ui_reset quedan como ruido inerte; no se limpian."
Write-Host ""
Write-Host "Rollback recomendado:"
Write-Host "1. Identificar el commit problemático."
Write-Host "2. Hacer revert en git."
Write-Host "3. Desplegar el revert."
Write-Host "4. Ejecutar: npm run gate:admin:rollout"
Write-Host ""
Write-Host "Validacion operativa:"
Write-Host " - Admin URL: $adminUrl"
Write-Host " - Runtime smoke: npm run test:admin:runtime-smoke"
Write-Host " - Gate admin: npm run gate:admin:rollout"

if ($OpenAdmin) {
    Write-Host ""
    Write-Host "[INFO] Abriendo admin en navegador..."
    Start-Process $adminUrl
}

exit 0
