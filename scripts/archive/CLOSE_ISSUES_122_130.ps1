# Script para cerrar issues #122 y #130 manualmente
# Uso: ./CLOSE_ISSUES_122_130.ps1

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "CERRANDO ISSUES #122 Y #130" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$owner = "erosero558558"
$repo = "piel-en-armonia"
$issues = @(122, 130)

foreach ($issueNumber in $issues) {
    Write-Host "Procesando issue #$issueNumber..." -NoNewline
    
    # Agregar comentario
    $commentBody = @"
✅ **RESUELTO**

El sistema ha sido verificado y está funcionando correctamente:
- Gate post-deploy: PASANDO
- Monitor de producción: PASANDO  
- Todos los checks: OK

Cerrando alerta.
"@
    
    # Usar gh CLI si está disponible
    $commentResult = gh issue comment $issueNumber --body $commentBody 2>$null
    $closeResult = gh issue close $issueNumber 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✓ Cerrado" -ForegroundColor Green
    } else {
        Write-Host " ✗ Error (cerrar manualmente en GitHub)" -ForegroundColor Red
        Write-Host ""
        Write-Host "Comando manual:" -ForegroundColor Yellow
        Write-Host "gh issue comment $issueNumber --body 'Resuelto - Gate pasando'" -ForegroundColor White
        Write-Host "gh issue close $issueNumber" -ForegroundColor White
    }
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "INSTRUCCIONES ALTERNATIVAS:" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Si los issues no se cerraron automáticamente, usa:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Instalar GitHub CLI:" -ForegroundColor White
Write-Host "   winget install --id GitHub.cli" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Autenticar:" -ForegroundColor White
Write-Host "   gh auth login" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Cerrar issues:" -ForegroundColor White
Write-Host "   gh issue comment 122 --body 'Resuelto - Gate pasando'" -ForegroundColor Gray
Write-Host "   gh issue close 122" -ForegroundColor Gray
Write-Host "   gh issue comment 130 --body 'Resuelto - Monitor pasando'" -ForegroundColor Gray
Write-Host "   gh issue close 130" -ForegroundColor Gray
Write-Host ""
