# Análisis de seguridad - Script PowerShell
Write-Host ""
Write-Host "6️⃣ EXPOSICIÓN DE DATOS SENSIBLES" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────────────────────"

$apiKeyPattern = "api[_-]?key.*="
$passPattern = "password.*="
$secretPattern = "secret.*="

$matches1 = Select-String -Path *.php -Pattern $apiKeyPattern 2>$null | Select-Object -First 3
$matches2 = Select-String -Path *.php -Pattern $passPattern 2>$null | Select-Object -First 3  
$matches3 = Select-String -Path *.php -Pattern $secretPattern 2>$null | Select-Object -First 3

if ($matches1 -or $matches2 -or $matches3) {
    Write-Host "  ⚠️ Posibles datos sensibles detectados" -ForegroundColor Red
} else {
    Write-Host "  ✅ No se detectaron datos sensibles expuestos" -ForegroundColor Green
}

Write-Host ""
Write-Host "7️⃣ SEGURIDAD EN JAVASCRIPT" -ForegroundColor Cyan
Write-Host "─────────────────────────────────────────────────────────────"

$mainJs = Get-Content "script.js" -Raw
$hasXSS = $mainJs -match "textContent"
$hasHTTPS = $mainJs -match "https"
$hasSecrets = $mainJs -match "apikey|secretkey"
$hasEval = $mainJs -match "eval\("

Write-Host "  script.js:" -ForegroundColor Green
if ($hasXSS) { Write-Host "  ├── XSS Protection:   True" -ForegroundColor Green } else { Write-Host "  ├── XSS Protection:   False" -ForegroundColor Yellow }
if ($hasHTTPS) { Write-Host "  ├── HTTPS:            True" -ForegroundColor Green } else { Write-Host "  ├── HTTPS:            False" -ForegroundColor Yellow }
if ($hasSecrets) { Write-Host "  ├── Secrets:          True" -ForegroundColor Red } else { Write-Host "  ├── Secrets:          False" -ForegroundColor Green }
if ($hasEval) { Write-Host "  └── Eval:             True" -ForegroundColor Red } else { Write-Host "  └── Eval:             False" -ForegroundColor Green }
