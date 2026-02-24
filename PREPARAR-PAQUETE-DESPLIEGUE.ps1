param(
    [string]$OutputDir = '_deploy_bundle',
    [switch]$IncludeTooling
)

$ErrorActionPreference = 'Stop'

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Add-FileToStage {
    param(
        [string]$RelativePath,
        [string]$StageRoot,
        [System.Collections.Generic.List[string]]$Missing
    )

    $source = Join-Path (Get-Location) $RelativePath
    if (-not (Test-Path $source -PathType Leaf)) {
        $Missing.Add($RelativePath)
        return
    }

    $target = Join-Path $StageRoot $RelativePath
    $targetDir = Split-Path -Parent $target
    Ensure-Directory -Path $targetDir
    Copy-Item -Path $source -Destination $target -Force
}

function Add-DirectoryToStage {
    param(
        [string]$RelativePath,
        [string]$StageRoot,
        [System.Collections.Generic.List[string]]$Missing
    )

    $source = Join-Path (Get-Location) $RelativePath
    if (-not (Test-Path $source -PathType Container)) {
        $Missing.Add($RelativePath)
        return
    }

    $target = Join-Path $StageRoot $RelativePath
    Ensure-Directory -Path (Split-Path -Parent $target)
    Copy-Item -Path $source -Destination $target -Recurse -Force
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bundleRoot = Join-Path (Get-Location) $OutputDir
Ensure-Directory -Path $bundleRoot

$stageDirName = "pielarmonia-deploy-$timestamp"
$stageDir = Join-Path $bundleRoot $stageDirName
Ensure-Directory -Path $stageDir

$files = @(
    '.htaccess',
    'index.html',
    'index.php',
    'styles.css',
    'styles-deferred.css',
    'script.js',
    'app-bootstrap-engine.js',
    'analytics-engine.js',
    'booking-engine.js',
    'booking-ui.js',
    'chat-booking-engine.js',
    'chat-engine.js',
    'chat-state-engine.js',
    'chat-ui-engine.js',
    'chat-widget-engine.js',
    'consent-engine.js',
    'data-engine.js',
    'engagement-forms-engine.js',
    'gallery-interactions.js',
    'i18n-engine.js',
    'legal-i18n.js',
    'modal-ux-engine.js',
    'navigation-engine.js',
    'reschedule-engine.js',
    'reschedule-gateway-engine.js',
    'reviews-engine.js',
    'success-modal-engine.js',
    'theme-engine.js',
    'translations-en.js',
    'ui-effects.js',
    'ui-bridge-engine.js',
    'admin.html',
    'admin.css',
    'admin.js',
    'admin-auth.php',
    'api.php',
    'api-lib.php',
    'payment-lib.php',
    'figo-chat.php',
    'figo-backend.php',
    'terminos.html',
    'privacidad.html',
    'cookies.html',
    'aviso-medico.html',
    'telemedicina.html',
    'legal.css',
    'favicon.ico',
    'hero-woman.jpg',
    'robots.txt',
    'sitemap.xml',
    'nginx-pielarmonia.conf'
)

if ($IncludeTooling) {
    $files += @(
        'SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1',
        'BENCH-API-PRODUCCION.ps1',
        'GATE-POSTDEPLOY.ps1',
        'CONFIGURAR-TELEGRAM-WEBHOOK.ps1',
        'DESPLIEGUE-PIELARMONIA.md',
        'CHECKLIST-PRUEBAS-PRODUCCION.md'
    )
}

$directories = @(
    'images/optimized',
    'servicios'
)

$missing = New-Object 'System.Collections.Generic.List[string]'
foreach ($file in $files) {
    Add-FileToStage -RelativePath $file -StageRoot $stageDir -Missing $missing
}
foreach ($dir in $directories) {
    Add-DirectoryToStage -RelativePath $dir -StageRoot $stageDir -Missing $missing
}

$manifestFiles = Get-ChildItem -Path $stageDir -Recurse -File | Sort-Object FullName
$manifestPath = Join-Path $stageDir 'manifest-sha256.txt'
$manifestLines = @()
foreach ($item in $manifestFiles) {
    $relative = $item.FullName.Substring($stageDir.Length + 1).Replace('\', '/')
    $hash = (Get-FileHash -Algorithm SHA256 -Path $item.FullName).Hash.ToLowerInvariant()
    $manifestLines += "$hash  $relative"
}
Set-Content -Path $manifestPath -Value ($manifestLines -join [Environment]::NewLine)

$zipPath = Join-Path $bundleRoot "$stageDirName.zip"
if (Test-Path $zipPath) {
    Remove-Item -Path $zipPath -Force
}
Compress-Archive -Path (Join-Path $stageDir '*') -DestinationPath $zipPath -CompressionLevel Optimal

$fileCount = (Get-ChildItem -Path $stageDir -Recurse -File | Measure-Object).Count
Write-Host "Paquete listo: $zipPath"
Write-Host "Archivos incluidos: $fileCount"
if ($missing.Count -gt 0) {
    Write-Host "Advertencia: faltaron rutas (no incluidas):"
    $missing | ForEach-Object { Write-Host " - $_" }
}

Write-Host ""
Write-Host "Siguiente paso sugerido:"
Write-Host "1) Sube el contenido del zip al raiz de produccion (public_html o equivalente)."
Write-Host "2) Ejecuta: npm run verify:prod -- -AllowDegradedFigo -AllowRecursiveFigo"
