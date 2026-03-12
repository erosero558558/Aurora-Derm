param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$RunSmoke,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$AllowMetaCspFallback,
    [switch]$RequireWebhookSecret,
    [switch]$RequireBackupHealthy,
    [switch]$RequireCronReady,
    [switch]$RequireTelemedicineReady,
    [switch]$AllowDegradedTelemedicineDiagnostics,
    [int]$MaxTelemedicineReviewQueue = 12,
    [int]$MaxTelemedicineStagedUploads = 1,
    [int]$MaxTelemedicineUnlinkedIntakes = 5,
    [switch]$RequireStableDataDir,
    [int]$MaxHealthTimingMs = 2000,
    [int]$AssetHashRetryCount = 2,
    [int]$AssetHashRetryDelaySec = 4,
    [switch]$SkipAssetHashChecks,
    [switch]$ForceAssetHashChecks,
    [string]$ReportPath = 'verification/last-deploy-verify.json'
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$script:CurlBinary = $null
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'
. $commonHttpPath

$localIndexCandidatePaths = @(
    (Join-Path $repoRoot 'index.html'),
    (Join-Path $repoRoot 'es/index.html'),
    (Join-Path $repoRoot 'en/index.html')
)
$localIndexPath = ''
foreach ($candidatePath in $localIndexCandidatePaths) {
    if (Test-Path $candidatePath) {
        $localIndexPath = [string](Resolve-Path $candidatePath)
        break
    }
}
$localScriptPath = Join-Path $repoRoot 'script.js'
$localI18nEnginePath = Join-Path $repoRoot 'i18n-engine.js'
$localRescheduleGatewayPath = Join-Path $repoRoot 'reschedule-gateway-engine.js'
$smokeScriptPath = Join-Path $PSScriptRoot 'SMOKE-PRODUCCION.ps1'
$primaryScriptRefPattern = '<script[^>]+src="([^"]*(?:script\.js|public-v6-shell\.js)[^"]*)"'
$primaryStyleRefPattern = '<link[^>]+href="([^"]*(?:styles\.css|_astro/[^"]+\.css)[^"]*)"'
$deferredStyleRefPattern = '<link[^>]+href="([^"]*styles-deferred\.css[^"]*)"'

Write-Host "== Verificacion de despliegue =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$deployFreshnessChecked = $false
$deployFreshnessStale = $false
$deployFreshnessFailRequired = $true
$deployFreshnessDeltaSeconds = 0
$deployFreshnessLocalHash = ''
$deployFreshnessLocalCommitUtc = ''
$deployFreshnessRemoteLastModifiedUtc = ''
$deployFreshnessProbeName = 'app-script'
$deployFreshnessProbeUrl = ''
$autoSkipAssetHashChecksForNonFrontend = $false
$nonFrontendAdvisoryMode = $false

$changedFiles = Get-HeadChangedFiles
$changedFilesKnown = ($null -ne $changedFiles)
$headTouchesFrontendAssets = $true
$headTouchesScriptFamily = $true
$headTouchesAdminScriptFamily = $false
$headTouchesAdminHtml = $false
$headTouchesStyles = $true
$headTouchesDeferredStyles = $true
$headTouchesIndex = $true
$changedEngineAssets = @()
$headTouchesEngineAssets = $false

if ($changedFilesKnown) {
    $headTouchesFrontendAssets = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @(
        '^index\.html$',
        '^es/',
        '^en/',
        '^_astro/',
        '^admin\.html$',
        '^script\.js$',
        '^js/public-v6-shell\.js$',
        '^admin\.js$',
        '^styles\.css$',
        '^styles-deferred\.css$',
        '^js/engines/',
        '^js/main\.js$',
        '^src/apps/',
        '^src/styles/',
        '^rollup\.config\.mjs$'
    )
    $headTouchesScriptFamily = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @(
        '^script\.js$',
        '^js/public-v6-shell\.js$',
        '^admin\.js$',
        '^js/main\.js$',
        '^js/(loader|state|utils|main)\.js$',
        '^src/bundles/ui\.js$',
        '^rollup\.config\.mjs$'
    )
    $headTouchesAdminScriptFamily = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @(
        '^admin\.js$',
        '^src/apps/admin/',
        '^src/bundles/admin\.js$',
        '^rollup\.config\.mjs$'
    )
    $headTouchesAdminHtml = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^admin\.html$')
    $changedEngineAssets = @(
        $changedFiles | Where-Object { $_ -match '^js/engines/.+\.js$' }
    )
    $headTouchesEngineAssets = $changedEngineAssets.Count -gt 0
    $headTouchesStyles = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^styles\.css$', '^_astro/.+\.css$')
    $headTouchesDeferredStyles = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^styles-deferred\.css$')
    $headTouchesIndex = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^index\.html$', '^es/index\.html$', '^en/index\.html$')
}

if (-not $headTouchesFrontendAssets -and $changedFilesKnown) {
    $deployFreshnessFailRequired = $false
    $nonFrontendAdvisoryMode = -not $ForceAssetHashChecks
    if ($nonFrontendAdvisoryMode) {
        if (-not $SkipAssetHashChecks) {
            $SkipAssetHashChecks = $true
            $autoSkipAssetHashChecksForNonFrontend = $true
        }
        Write-Host "[INFO] Verificacion frontend en modo advisory: HEAD no cambia assets frontend."
    }
}

$indexRaw = ''
if (-not [string]::IsNullOrWhiteSpace($localIndexPath)) {
    $indexRaw = Get-Content -Path $localIndexPath -Raw
} elseif ($nonFrontendAdvisoryMode) {
    Write-Host '[INFO] index local canónico no disponible; se omite lectura local de entry HTML en modo advisory.'
} else {
    throw 'No se encontro index local canónico (index.html, es/index.html o en/index.html)'
}
$localScriptRef = if ($indexRaw -ne '') { Get-RefFromIndex -IndexHtml $indexRaw -Pattern $primaryScriptRefPattern } else { '' }
$localStyleRef = if ($indexRaw -ne '') { Get-RefFromIndex -IndexHtml $indexRaw -Pattern $primaryStyleRefPattern } else { '' }
$localDeferredStyleRef = if ($indexRaw -ne '') { Get-RefFromIndex -IndexHtml $indexRaw -Pattern $deferredStyleRefPattern } else { '' }
$localHasInlineCriticalCss = if ($indexRaw -ne '') {
    [regex]::IsMatch($indexRaw, '<style\b[^>]*>[\s\S]*?</style>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
} else {
    $false
}

if ($indexRaw -ne '' -and $localScriptRef -eq '') {
    throw 'No se pudo detectar referencia del script principal (script.js o public-v6-shell.js) en el index local'
}
if ($indexRaw -ne '' -and $localStyleRef -eq '' -and $localDeferredStyleRef -eq '' -and -not $localHasInlineCriticalCss) {
    throw 'No se detecto CSS cargado desde el index local (styles.css, styles-deferred.css, _astro/*.css o inline)'
}

$remoteIndexRaw = Get-RemoteIndexHtml -Base $base
$results = @()
$securityHeaderCheck = Test-SecurityHeaders -Base $base -AllowMetaCspFallback:$AllowMetaCspFallback
$results += @($securityHeaderCheck.Results)

$remoteScriptRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern $primaryScriptRefPattern
$remoteStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern $primaryStyleRefPattern
$remoteDeferredStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern $deferredStyleRefPattern
$remoteHasInlineCriticalCss = [regex]::IsMatch($remoteIndexRaw, '<style\b[^>]*>[\s\S]*?</style>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$appScriptRemoteUrl = Get-Url -Base $base -Ref $remoteScriptRef
$criticalCssRemoteUrl = Get-Url -Base $base -Ref $localStyleRef
$indexDeferredStylesRemoteUrl = Get-Url -Base $base -Ref $localDeferredStyleRef
$deployAssetVersion = ''
$deployVersionMatch = [regex]::Match($remoteScriptRef, '[?&]v=([^&]+)')
if ($deployVersionMatch.Success) {
    $deployAssetVersion = [Uri]::UnescapeDataString($deployVersionMatch.Groups[1].Value)
}
if ($deployAssetVersion -eq '') {
    $deployVersionMatch = [regex]::Match($localScriptRef, '[?&]v=([^&]+)')
    if ($deployVersionMatch.Success) {
        $deployAssetVersion = [Uri]::UnescapeDataString($deployVersionMatch.Groups[1].Value)
    }
}

if ($nonFrontendAdvisoryMode) {
    Write-Host '[INFO] Deploy freshness omitido: cambio actual no toca assets frontend.'
} else {
    try {
        $deployFreshnessProbeName = 'app-script'
        $deployFreshnessProbeUrl = $appScriptRemoteUrl
        if ($headTouchesEngineAssets) {
            $engineProbePath = [string]$changedEngineAssets[0]
            $deployFreshnessProbeName = "engine:$engineProbePath"
            $deployFreshnessProbeUrl = Get-Url -Base $base -Ref $engineProbePath
        } elseif ($headTouchesAdminScriptFamily) {
            $deployFreshnessProbeName = 'admin-script'
            $deployFreshnessProbeUrl = "$base/admin.js"
        } elseif ($headTouchesAdminHtml) {
            $deployFreshnessProbeName = 'admin-index'
            $deployFreshnessProbeUrl = "$base/admin.html"
        } elseif (-not $headTouchesScriptFamily) {
            if ($headTouchesDeferredStyles -and -not [string]::IsNullOrWhiteSpace($indexDeferredStylesRemoteUrl)) {
                $deployFreshnessProbeName = 'styles-deferred'
                $deployFreshnessProbeUrl = $indexDeferredStylesRemoteUrl
            } elseif ($headTouchesStyles -and -not [string]::IsNullOrWhiteSpace($criticalCssRemoteUrl)) {
                $deployFreshnessProbeName = 'styles'
                $deployFreshnessProbeUrl = $criticalCssRemoteUrl
            } elseif ($headTouchesIndex) {
                $deployFreshnessProbeName = 'index'
                $deployFreshnessProbeUrl = "$base/"
            }
        }

        if (-not [string]::IsNullOrWhiteSpace($deployFreshnessProbeUrl)) {
            $localHead = Get-LocalGitHeadInfo
            if ($null -ne $localHead) {
                $deployFreshnessChecked = $true
                $deployFreshnessCheckUrl = Get-CacheBypassUrl -Url $deployFreshnessProbeUrl -AssetName 'deploy-freshness' -Attempt 0
                $scriptHeadResp = Invoke-WebRequest -Uri $deployFreshnessCheckUrl -Method HEAD -TimeoutSec 20 -UseBasicParsing -Headers @{
                    'Cache-Control' = 'no-cache'
                    'User-Agent' = 'PielArmoniaDeployCheck/1.0'
                }
                $lastModifiedRaw = [string]$scriptHeadResp.Headers['Last-Modified']
                $ageRaw = [string]$scriptHeadResp.Headers['Age']
                if (-not [string]::IsNullOrWhiteSpace($lastModifiedRaw)) {
                    $remoteLastModifiedUtc = ([DateTimeOffset]::Parse($lastModifiedRaw)).UtcDateTime
                    $deltaSeconds = [int]([Math]::Round(($localHead.CommitUtc - $remoteLastModifiedUtc).TotalSeconds))
                    $deployFreshnessDeltaSeconds = $deltaSeconds
                    $deployFreshnessLocalHash = [string]$localHead.Hash
                    $deployFreshnessLocalCommitUtc = $localHead.CommitUtc.ToString('u')
                    $deployFreshnessRemoteLastModifiedUtc = $remoteLastModifiedUtc.ToString('u')
                    if ($deltaSeconds -gt 180) {
                        $deployFreshnessStale = $true
                        Write-Host "[WARN] deploy freshness ($deployFreshnessProbeName): remoto mas viejo que HEAD local"
                        Write-Host "       Local HEAD : $($localHead.Hash) @ $($localHead.CommitUtc.ToString('u'))"
                        Write-Host "       Remote LM  : $($remoteLastModifiedUtc.ToString('u'))"
                        if (-not [string]::IsNullOrWhiteSpace($ageRaw)) {
                            Write-Host "       CDN Age    : ${ageRaw}s"
                        }
                    } else {
                        Write-Host "[OK]  deploy freshness ($deployFreshnessProbeName) dentro de margen (${deltaSeconds}s)"
                    }
                } else {
                    Write-Host '[WARN] deploy freshness: Last-Modified no disponible'
                }
            } else {
                Write-Host '[WARN] deploy freshness: no se pudo leer metadata de git local'
            }
        }
    } catch {
        Write-Host "[WARN] No se pudo validar deploy freshness: $($_.Exception.Message)"
    }
}

if ($deployFreshnessChecked -and $deployFreshnessStale) {
    if ($deployFreshnessFailRequired) {
        Write-Host "[FAIL] Deploy no sincronizado con HEAD local; se omiten hashes para evitar ruido."
        $results += [PSCustomObject]@{
            Asset = 'deploy-freshness'
            Match = $false
            LocalHash = "$deployFreshnessLocalHash @ $deployFreshnessLocalCommitUtc"
            RemoteHash = "last-modified @ $deployFreshnessRemoteLastModifiedUtc"
            RemoteUrl = $deployFreshnessProbeUrl
            DeltaSeconds = $deployFreshnessDeltaSeconds
        }
    } else {
        Write-Host "[WARN] Deploy no sincronizado con HEAD local (advisory, sin cambios frontend)."
    }
}

$assetHeaderChecks = @(
    @{ Name = 'app-script'; Url = $appScriptRemoteUrl }
)
if (-not [string]::IsNullOrWhiteSpace($criticalCssRemoteUrl)) {
    $assetHeaderChecks += @{ Name = 'critical-css'; Url = $criticalCssRemoteUrl }
} elseif (-not [string]::IsNullOrWhiteSpace($indexDeferredStylesRemoteUrl)) {
    $assetHeaderChecks += @{ Name = 'critical-css-fallback'; Url = $indexDeferredStylesRemoteUrl }
}
$results += @(Test-AssetCacheHeaders -Checks $assetHeaderChecks -FailureAsset 'cache-header:assets' -Base $base -FailureMessage '[FAIL] No se pudieron validar headers de cache de assets')

try {
    $healthHeaderResp = Invoke-WebRequest -Uri "$base/api.php?resource=health" -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'User-Agent' = 'PielArmoniaDeployCheck/1.0'
    }
    $healthCacheHeader = [string]$healthHeaderResp.Headers['Cache-Control']
    if ([string]::IsNullOrWhiteSpace($healthCacheHeader) -or $healthCacheHeader -notmatch 'no-store|no-cache') {
        Write-Host "[FAIL] Health API sin no-store/no-cache"
        $results += [PSCustomObject]@{
            Asset = 'cache-header:health-api'
            Match = $false
            LocalHash = 'no-store'
            RemoteHash = if ($healthCacheHeader) { $healthCacheHeader } else { 'missing' }
            RemoteUrl = "$base/api.php?resource=health"
        }
    } else {
        Write-Host "[OK]  cache header no-store/no-cache en Health API"
    }
} catch {
    Write-Host "[FAIL] No se pudo validar Cache-Control de Health API"
    $results += [PSCustomObject]@{
        Asset = 'cache-header:health-api'
        Match = $false
        LocalHash = 'no-store'
        RemoteHash = ''
        RemoteUrl = "$base/api.php?resource=health"
    }
}

$localScriptTextForRefs = if (Test-Path $localScriptPath) { Get-Content -Path $localScriptPath -Raw } else { '' }
$localI18nEngineTextForRefs = if (Test-Path $localI18nEnginePath) { Get-Content -Path $localI18nEnginePath -Raw } else { '' }
$localRescheduleGatewayTextForRefs = if (Test-Path $localRescheduleGatewayPath) { Get-Content -Path $localRescheduleGatewayPath -Raw } else { '' }
$assetMap = Resolve-DeployAssetMap `
    -Base $base `
    -LocalScriptText $localScriptTextForRefs `
    -LocalI18nEngineText $localI18nEngineTextForRefs `
    -LocalRescheduleGatewayText $localRescheduleGatewayTextForRefs `
    -IndexDeferredStylesRemoteUrl $indexDeferredStylesRemoteUrl
$chatEngineRemoteUrl = [string]$assetMap.ChatEngineRemoteUrl
$chatUiEngineRemoteUrl = [string]$assetMap.ChatUiEngineRemoteUrl
$chatWidgetEngineRemoteUrl = [string]$assetMap.ChatWidgetEngineRemoteUrl
$deferredStylesRemoteUrl = [string]$assetMap.DeferredStylesRemoteUrl
$hasTranslationsEnAsset = [bool]$assetMap.HasTranslationsEnAsset
$translationsEnRemoteUrl = [string]$assetMap.TranslationsEnRemoteUrl
$bookingEngineRemoteUrl = [string]$assetMap.BookingEngineRemoteUrl
$analyticsEngineRemoteUrl = [string]$assetMap.AnalyticsEngineRemoteUrl
$uiEffectsRemoteUrl = [string]$assetMap.UiEffectsRemoteUrl
$galleryInteractionsRemoteUrl = [string]$assetMap.GalleryInteractionsRemoteUrl
$rescheduleEngineRemoteUrl = [string]$assetMap.RescheduleEngineRemoteUrl
$bookingUiRemoteUrl = [string]$assetMap.BookingUiRemoteUrl
$chatBookingEngineRemoteUrl = [string]$assetMap.ChatBookingEngineRemoteUrl
$successModalEngineRemoteUrl = [string]$assetMap.SuccessModalEngineRemoteUrl
$engagementFormsEngineRemoteUrl = [string]$assetMap.EngagementFormsEngineRemoteUrl
$modalUxEngineRemoteUrl = [string]$assetMap.ModalUxEngineRemoteUrl
if (-not $hasTranslationsEnAsset) {
    Write-Host '[INFO] translations-en.js no se detecta en local; se omite verificacion de hash.'
}
if ([string]::IsNullOrWhiteSpace($rescheduleEngineRemoteUrl) -and -not (Test-Path 'js/engines/reschedule-engine.js')) {
    Write-Host '[INFO] reschedule-engine.js no se detecta en local; se omite verificacion de hash.'
}
$results += @(Test-AssetCacheHeaders -Checks $assetMap.SecondaryAssetHeaderChecks -FailureAsset 'cache-header:assets-secondary' -Base $base -FailureMessage '[FAIL] No se pudieron validar headers de cache de assets secundarios')

if ([regex]::IsMatch([string]$remoteIndexRaw, '<[a-zA-Z][^>]*\son[a-z]+\s*=', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    if ($nonFrontendAdvisoryMode) {
        Write-Host '[INFO] index remoto contiene event handlers inline (on*) en modo advisory por cambio sin frontend.'
    } else {
        Write-Host "[FAIL] index remoto contiene event handlers inline (on*)"
        $results += [PSCustomObject]@{
            Asset = 'index-inline-handlers'
            Match = $false
            LocalHash = 'none'
            RemoteHash = 'found'
            RemoteUrl = "$base/"
        }
    }
} else {
    Write-Host "[OK]  index remoto sin handlers inline (on*)"
}

$inlineExecutableScriptPattern = '<script\b(?![^>]*\bsrc=)(?![^>]*\btype\s*=\s*["'']application/ld\+json["''])[^>]*>[\s\S]*?</script>'
if ([regex]::IsMatch([string]$remoteIndexRaw, $inlineExecutableScriptPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    if ($nonFrontendAdvisoryMode) {
        Write-Host '[INFO] index remoto contiene scripts inline ejecutables en modo advisory por cambio sin frontend.'
    } else {
        Write-Host "[FAIL] index remoto contiene scripts inline ejecutables"
        $results += [PSCustomObject]@{
            Asset = 'index-inline-executable-script'
            Match = $false
            LocalHash = 'none'
            RemoteHash = 'found'
            RemoteUrl = "$base/"
        }
    }
} else {
    Write-Host "[OK]  index remoto sin scripts inline ejecutables"
}

$frontendAssetDriftAdvisory = $changedFilesKnown -and -not $headTouchesFrontendAssets -and -not $ForceAssetHashChecks
$indexAssetRefAdvisory = ($SkipAssetHashChecks -and -not $headTouchesFrontendAssets) -or ($deployFreshnessStale -and -not $ForceAssetHashChecks -and -not $headTouchesFrontendAssets) -or $frontendAssetDriftAdvisory
$indexAssetRefAdvisoryAsInfo = $nonFrontendAdvisoryMode
$indexAssetRefAdvisoryReason = if ($SkipAssetHashChecks -and -not $headTouchesFrontendAssets) {
    'advisory por SkipAssetHashChecks sin cambios frontend'
} elseif ($deployFreshnessStale -and -not $ForceAssetHashChecks -and -not $headTouchesFrontendAssets) {
    'advisory por deploy freshness sin cambios frontend'
} elseif ($frontendAssetDriftAdvisory) {
    'advisory por HEAD sin cambios frontend (drift remoto tolerado)'
} else {
    ''
}

if ($nonFrontendAdvisoryMode) {
    Write-Host '[INFO] Se omite comparacion de referencias de assets en index (cambio actual sin frontend).'
} else {
    if ($remoteScriptRef -eq '') {
        if ($indexAssetRefAdvisory) {
            if ($indexAssetRefAdvisoryAsInfo) {
                Write-Host "[INFO] No se pudo detectar referencia del script principal en index remoto ($indexAssetRefAdvisoryReason)"
            } else {
                Write-Host "[WARN] No se pudo detectar referencia del script principal en index remoto ($indexAssetRefAdvisoryReason)"
            }
            Write-Host "       Local : $localScriptRef"
        } else {
            Write-Host "[FAIL] No se pudo detectar referencia del script principal en index remoto"
            $results += [PSCustomObject]@{
                Asset = 'index-asset-refs:script-entry'
                Match = $false
                LocalHash = $localScriptRef
                RemoteHash = $remoteScriptRef
                RemoteUrl = "$base/"
            }
        }
    } elseif ((Get-RefPath -Ref $remoteScriptRef) -eq (Get-RefPath -Ref $localScriptRef)) {
        Write-Host "[OK]  index remoto usa misma referencia de script principal"
    } else {
        if ($indexAssetRefAdvisory) {
            if ($indexAssetRefAdvisoryAsInfo) {
                Write-Host "[INFO] index remoto script principal diferente ($indexAssetRefAdvisoryReason)"
            } else {
                Write-Host "[WARN] index remoto script principal diferente ($indexAssetRefAdvisoryReason)"
            }
            Write-Host "       Local : $localScriptRef"
            Write-Host "       Remote: $remoteScriptRef"
        } else {
            Write-Host "[FAIL] index remoto script principal diferente"
            Write-Host "       Local : $localScriptRef"
            Write-Host "       Remote: $remoteScriptRef"
            $results += [PSCustomObject]@{
                Asset = 'index-ref:script-entry'
                Match = $false
                LocalHash = $localScriptRef
                RemoteHash = $remoteScriptRef
                RemoteUrl = "$base/"
            }
        }
    }

    if ($localStyleRef -ne '') {
        $styleRefAdvisory = $indexAssetRefAdvisory
        if ($remoteStyleRef -eq '') {
            if ($styleRefAdvisory) {
                if ($indexAssetRefAdvisoryAsInfo) {
                    Write-Host "[INFO] index remoto sin referencia del stylesheet principal ($indexAssetRefAdvisoryReason)"
                } else {
                    Write-Host "[WARN] index remoto sin referencia del stylesheet principal ($indexAssetRefAdvisoryReason)"
                }
                Write-Host "       Local : $localStyleRef"
            } else {
                Write-Host "[FAIL] index remoto sin referencia del stylesheet principal"
                $results += [PSCustomObject]@{
                    Asset = 'index-asset-refs:style-entry'
                    Match = $false
                    LocalHash = $localStyleRef
                    RemoteHash = ''
                    RemoteUrl = "$base/"
                }
            }
        } elseif ($remoteStyleRef -eq $localStyleRef) {
            Write-Host "[OK]  index remoto usa misma referencia de stylesheet principal"
        } else {
            if ($styleRefAdvisory) {
                if ($indexAssetRefAdvisoryAsInfo) {
                    Write-Host "[INFO] index remoto stylesheet principal diferente ($indexAssetRefAdvisoryReason)"
                } else {
                    Write-Host "[WARN] index remoto stylesheet principal diferente ($indexAssetRefAdvisoryReason)"
                }
                Write-Host "       Local : $localStyleRef"
                Write-Host "       Remote: $remoteStyleRef"
            } else {
                Write-Host "[FAIL] index remoto stylesheet principal diferente"
                Write-Host "       Local : $localStyleRef"
                Write-Host "       Remote: $remoteStyleRef"
                $results += [PSCustomObject]@{
                    Asset = 'index-ref:style-entry'
                    Match = $false
                    LocalHash = $localStyleRef
                    RemoteHash = $remoteStyleRef
                    RemoteUrl = "$base/"
                }
            }
        }
    } else {
        if ($localHasInlineCriticalCss) {
            if ($remoteHasInlineCriticalCss) {
                Write-Host "[OK]  index remoto mantiene CSS critico inline"
            } else {
                Write-Host "[FAIL] index remoto no contiene CSS critico inline esperado"
                $results += [PSCustomObject]@{
                    Asset = 'index-inline-critical-css'
                    Match = $false
                    LocalHash = 'present'
                    RemoteHash = 'missing'
                    RemoteUrl = "$base/"
                }
            }
        }

        if ($localDeferredStyleRef -ne '') {
            $deferredStyleRefAdvisory = $indexAssetRefAdvisory
            if ($remoteDeferredStyleRef -eq '') {
                if ($deferredStyleRefAdvisory) {
                    if ($indexAssetRefAdvisoryAsInfo) {
                        Write-Host "[INFO] index remoto sin referencia de styles-deferred.css ($indexAssetRefAdvisoryReason)"
                    } else {
                        Write-Host "[WARN] index remoto sin referencia de styles-deferred.css ($indexAssetRefAdvisoryReason)"
                    }
                    Write-Host "       Local : $localDeferredStyleRef"
                } else {
                    Write-Host "[FAIL] index remoto sin referencia de styles-deferred.css"
                    $results += [PSCustomObject]@{
                        Asset = 'index-asset-refs:styles-deferred.css'
                        Match = $false
                        LocalHash = $localDeferredStyleRef
                        RemoteHash = ''
                        RemoteUrl = "$base/"
                    }
                }
            } elseif ($remoteDeferredStyleRef -eq $localDeferredStyleRef) {
                Write-Host "[OK]  index remoto usa misma referencia de styles-deferred.css"
            } else {
                if ($deferredStyleRefAdvisory) {
                    if ($indexAssetRefAdvisoryAsInfo) {
                        Write-Host "[INFO] index remoto styles-deferred.css diferente ($indexAssetRefAdvisoryReason)"
                    } else {
                        Write-Host "[WARN] index remoto styles-deferred.css diferente ($indexAssetRefAdvisoryReason)"
                    }
                    Write-Host "       Local : $localDeferredStyleRef"
                    Write-Host "       Remote: $remoteDeferredStyleRef"
                } else {
                    Write-Host "[FAIL] index remoto styles-deferred.css diferente"
                    Write-Host "       Local : $localDeferredStyleRef"
                    Write-Host "       Remote: $remoteDeferredStyleRef"
                    $results += [PSCustomObject]@{
                        Asset = 'index-ref:styles-deferred.css'
                        Match = $false
                        LocalHash = $localDeferredStyleRef
                        RemoteHash = $remoteDeferredStyleRef
                        RemoteUrl = "$base/"
                    }
                }
            }
        }
    }
}

if ($SkipAssetHashChecks) {
    if ($autoSkipAssetHashChecksForNonFrontend -or $nonFrontendAdvisoryMode) {
        Write-Host '[INFO] Se omite verificacion de hashes de assets (cambio actual sin frontend).'
    } else {
        Write-Host '[WARN] Se omite verificacion de hashes de assets (SkipAssetHashChecks).'
    }
} elseif ($deployFreshnessStale -and -not $ForceAssetHashChecks) {
    Write-Host '[WARN] Se omite verificacion de hashes de assets hasta que el deploy remoto se sincronice con HEAD.'
} else {
    if ($deployFreshnessStale -and $ForceAssetHashChecks) {
        Write-Host '[WARN] Deploy remoto atrasado vs HEAD local, pero se ejecutan hash checks por modo estricto.'
    }
    if ($frontendAssetDriftAdvisory) {
        Write-Host '[WARN] Hash/ref de assets frontend en modo advisory: HEAD no cambia frontend.'
    }
    $checks = @()
    if ($localStyleRef -ne '') {
        $checks += [PSCustomObject]@{
            Name = 'styles.css'
            LocalPath = 'styles.css'
            RemoteUrl = (Get-Url -Base $base -Ref $localStyleRef)
        }
    }
    if ($remoteScriptRef -ne '') {
        $checks += [PSCustomObject]@{
            Name = 'script.js'
            LocalPath = 'script.js'
            RemoteUrl = (Get-Url -Base $base -Ref $remoteScriptRef)
        }
    } else {
        Write-Host '[WARN] Se omite hash de script.js: referencia remota no detectada.'
    }

    $checks += @(
        [PSCustomObject]@{
            Name = 'chat-widget-engine.js'
            LocalPath = 'js/engines/chat-widget-engine.js'
            LocalCandidates = @()
            RemoteUrl = $chatWidgetEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-engine.js'
            LocalPath = 'js/engines/chat-engine.js'
            LocalCandidates = @()
            RemoteUrl = $chatEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-ui-engine.js'
            LocalPath = 'js/engines/chat-ui-engine.js'
            LocalCandidates = @()
            RemoteUrl = $chatUiEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'styles-deferred.css'
            LocalPath = 'styles-deferred.css'
            LocalCandidates = @()
            RemoteUrl = $deferredStylesRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'booking-engine.js'
            LocalPath = 'js/engines/booking-engine.js'
            LocalCandidates = @()
            RemoteUrl = $bookingEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'ui-effects.js'
            LocalPath = 'js/engines/ui-effects.js'
            LocalCandidates = @()
            RemoteUrl = $uiEffectsRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'gallery-interactions.js'
            LocalPath = 'js/engines/gallery-interactions.js'
            LocalCandidates = @()
            RemoteUrl = $galleryInteractionsRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'booking-ui.js'
            LocalPath = 'js/engines/booking-ui.js'
            LocalCandidates = @()
            RemoteUrl = $bookingUiRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-booking-engine.js'
            LocalPath = 'js/engines/chat-booking-engine.js'
            LocalCandidates = @()
            RemoteUrl = $chatBookingEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'success-modal-engine.js'
            LocalPath = 'js/engines/success-modal-engine.js'
            LocalCandidates = @()
            RemoteUrl = $successModalEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'engagement-forms-engine.js'
            LocalPath = 'js/engines/engagement-forms-engine.js'
            LocalCandidates = @()
            RemoteUrl = $engagementFormsEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'modal-ux-engine.js'
            LocalPath = 'js/engines/modal-ux-engine.js'
            LocalCandidates = @()
            RemoteUrl = $modalUxEngineRemoteUrl
        }
    )
    if ($hasTranslationsEnAsset) {
        $checks += [PSCustomObject]@{
            Name = 'translations-en.js'
            LocalPath = 'translations-en.js'
            LocalCandidates = @('js/translations-en.js')
            RemoteUrl = $translationsEnRemoteUrl
        }
    }
    if (($rescheduleEngineRemoteUrl -ne '') -or (Test-Path 'js/engines/reschedule-engine.js')) {
        $checks += [PSCustomObject]@{
            Name = 'reschedule-engine.js'
            LocalPath = 'js/engines/reschedule-engine.js'
            LocalCandidates = @()
            RemoteUrl = $rescheduleEngineRemoteUrl
        }
    } else {
        Write-Host '[INFO] reschedule-engine.js no se detecta en local; se omite verificacion de hash.'
    }
    foreach ($item in $checks) {
        if ([string]::IsNullOrWhiteSpace($item.RemoteUrl)) {
            Write-Host "[WARN] Se omite hash de $($item.Name): URL remota vacia."
            continue
        }

        $localCandidates = @()
        if ($null -ne $item.PSObject.Properties['LocalCandidates']) {
            $localCandidates = @($item.LocalCandidates)
        }
        $resolvedLocalPath = Resolve-LocalAssetPath -PrimaryPath ([string]$item.LocalPath) -FallbackPaths $localCandidates
        if ([string]::IsNullOrWhiteSpace($resolvedLocalPath)) {
            Write-Host "[INFO] Se omite hash de $($item.Name): archivo local no encontrado."
            continue
        }

        $remoteUrlForHash = $item.RemoteUrl
        if ($deployAssetVersion -ne '' -and $item.Name -ne 'script.js') {
            $remoteUrlForHash = Add-QueryParam -Url $remoteUrlForHash -Name 'cv' -Value $deployAssetVersion
        }
        $localHash = Get-LocalSha256FromGitHeadOrFile -Path $resolvedLocalPath -NormalizeText
        if ([string]::IsNullOrWhiteSpace($localHash)) {
            Write-Host "[INFO] Se omite hash de $($item.Name): no se pudo calcular hash local."
            continue
        }
        $remoteHash = Get-RemoteSha256 -Url (Get-CacheBypassUrl -Url $remoteUrlForHash -AssetName $item.Name -Attempt 0) -NormalizeText
        $attempts = 0
        $match = ($localHash -ne '' -and $localHash -eq $remoteHash)

        while (-not $match -and $attempts -lt $AssetHashRetryCount) {
            Start-Sleep -Seconds $AssetHashRetryDelaySec
            $attempts += 1
            $remoteHash = Get-RemoteSha256 -Url (Get-CacheBypassUrl -Url $remoteUrlForHash -AssetName $item.Name -Attempt $attempts) -NormalizeText
            $match = ($localHash -ne '' -and $localHash -eq $remoteHash)
        }

        $results += [PSCustomObject]@{
            Asset = $item.Name
            Match = $match
            LocalHash = $localHash
            RemoteHash = $remoteHash
            LocalPath = $resolvedLocalPath
            RemoteUrl = $remoteUrlForHash
            Attempts = $attempts
        }
    }

    $results | ForEach-Object {
        if ($_.Match) {
            if ($_.Attempts -gt 0) {
                Write-Host "[OK]  $($_.Asset) hashes coinciden (retry=$($_.Attempts))"
            } else {
                Write-Host "[OK]  $($_.Asset) hashes coinciden"
            }
        } else {
            Write-Host "[FAIL] $($_.Asset) hash no coincide"
            Write-Host "       Local : $($_.LocalHash)"
            Write-Host "       Remote: $($_.RemoteHash)"
            Write-Host "       URL   : $($_.RemoteUrl)"
            if ($_.Attempts -gt 0) {
                Write-Host "       Retries agotados: $($_.Attempts)"
            }
        }
    }
}

$remoteScriptText = Get-RemoteText -Url (Get-Url -Base $base -Ref $localScriptRef)
$remoteBookingEngineText = Get-RemoteText -Url $bookingEngineRemoteUrl
$remoteAnalyticsEngineText = Get-RemoteText -Url $analyticsEngineRemoteUrl
$remoteChatBookingEngineText = Get-RemoteText -Url $chatBookingEngineRemoteUrl
$remoteChatWidgetEngineText = Get-RemoteText -Url $chatWidgetEngineRemoteUrl

$analyticsChecks = @(
    @{
        Name = 'function initGA4'
        Pattern = 'function\s+initGA4'
        Sources = @('script')
    },
    @{
        Name = 'initGA4()'
        Pattern = 'initGA4\(\)'
        Sources = @('script')
    },
    @{
        Name = 'trackEvent(start_checkout)'
        Pattern = "trackEvent\(\s*['""]start_checkout['""]"
        Sources = @('script', 'booking', 'analytics', 'chat-booking')
    },
    @{
        Name = 'trackEvent(view_booking)'
        Pattern = "['""]view_booking['""]"
        Sources = @('script', 'analytics')
    },
    @{
        Name = 'trackEvent(booking_step_completed)'
        Pattern = "trackEvent\(\s*['""]booking_step_completed['""]"
        Sources = @('chat-booking')
    },
    @{
        Name = 'trackEvent(payment_method_selected)'
        Pattern = "trackEvent\(\s*['""]payment_method_selected['""]"
        Sources = @('booking', 'chat-booking')
    },
    @{
        Name = 'trackEvent(payment_success)'
        Pattern = "trackEvent\(\s*['""]payment_success['""]"
        Sources = @('booking')
    },
    @{
        Name = 'trackEvent(booking_confirmed)'
        Pattern = "trackEvent\(\s*['""]booking_confirmed['""]"
        Sources = @('analytics')
    },
    @{
        Name = 'trackEvent(chat_handoff_whatsapp)'
        Pattern = "trackEvent\(\s*['""]chat_handoff_whatsapp['""]"
        Sources = @('script')
    },
    @{
        Name = 'trackEvent(whatsapp_click)'
        Pattern = "trackEvent\(\s*['""]whatsapp_click['""]"
        Sources = @('script')
    },
    @{
        Name = 'trackEvent(chat_started)'
        Pattern = "['""]chat_started['""]"
        Sources = @('script', 'chat-widget')
    }
)

$analyticsTokenAdvisory = $nonFrontendAdvisoryMode -and -not $ForceAssetHashChecks

foreach ($check in $analyticsChecks) {
    $matched = $false
    if ($check.Sources -contains 'script' -and -not $matched -and [regex]::IsMatch($remoteScriptText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }
    if ($check.Sources -contains 'booking' -and -not $matched -and [regex]::IsMatch($remoteBookingEngineText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }
    if ($check.Sources -contains 'analytics' -and -not $matched -and [regex]::IsMatch($remoteAnalyticsEngineText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }
    if ($check.Sources -contains 'chat-booking' -and -not $matched -and [regex]::IsMatch($remoteChatBookingEngineText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }
    if ($check.Sources -contains 'chat-widget' -and -not $matched -and [regex]::IsMatch($remoteChatWidgetEngineText, $check.Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        $matched = $true
    }

    if ($matched) {
        Write-Host "[OK]  assets remotos contienen: $($check.Name)"
    } else {
        if ($analyticsTokenAdvisory) {
            Write-Host "[WARN] assets remotos NO contienen (advisory): $($check.Name)"
        } else {
            Write-Host "[FAIL] assets remotos NO contienen: $($check.Name)"
            $results += [PSCustomObject]@{
                Asset = "script-token:$($check.Name)"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = (Get-Url -Base $base -Ref $localScriptRef)
            }
        }
    }
}

$healthUrl = "$base/api.php?resource=health"
try {
    $healthResp = Invoke-JsonGetStrict -Url $healthUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $healthRequired = @(
        'timingMs',
        'version',
        'dataDirWritable',
        'dataDirSource',
        'storeEncrypted',
        'figoConfigured',
        'figoRecursiveConfig',
        'calendarConfigured',
        'calendarReachable',
        'calendarMode',
        'calendarSource',
        'calendarAuth',
        'calendarTokenHealthy'
    )
    foreach ($field in $healthRequired) {
        if ($null -ne $healthResp.Json.PSObject.Properties[$field]) {
            Write-Host "[OK]  health incluye: $field"
        } else {
            Write-Host "[FAIL] health NO incluye: $field"
            $results += [PSCustomObject]@{
                Asset = "health-field:$field"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = $healthUrl
            }
        }
    }

    $healthTimingMs = 0
    try {
        $healthTimingMs = [int]($healthResp.Json.timingMs)
    } catch {
        $healthTimingMs = 0
    }
    if ($healthTimingMs -gt $MaxHealthTimingMs) {
        Write-Host "[FAIL] health timingMs alto: $healthTimingMs ms (max $MaxHealthTimingMs ms)"
        $results += [PSCustomObject]@{
            Asset = 'health-timingMs'
            Match = $false
            LocalHash = "$MaxHealthTimingMs"
            RemoteHash = "$healthTimingMs"
            RemoteUrl = $healthUrl
        }
    } else {
        Write-Host "[OK]  health timingMs dentro de umbral ($healthTimingMs ms)"
    }

    $healthRecursive = $false
    try {
        $healthRecursive = [bool]($healthResp.Json.figoRecursiveConfig)
    } catch {
        $healthRecursive = $false
    }
    if ($healthRecursive -and -not $AllowRecursiveFigo) {
        Write-Host "[FAIL] health reporta figoRecursiveConfig=true"
        $results += [PSCustomObject]@{
            Asset = 'health-figoRecursiveConfig'
            Match = $false
            LocalHash = 'false'
            RemoteHash = 'true'
            RemoteUrl = $healthUrl
        }
    }

    $dataDirSource = ''
    try {
        $dataDirSource = [string]($healthResp.Json.dataDirSource)
    } catch {
        $dataDirSource = ''
    }
    if ($dataDirSource -ne '') {
        if ($dataDirSource -eq 'tmp') {
            Write-Host "[WARN] health dataDirSource=tmp (persistencia efimera)"
            if ($RequireStableDataDir) {
                $results += [PSCustomObject]@{
                    Asset = 'health-dataDirSource'
                    Match = $false
                    LocalHash = 'stable'
                    RemoteHash = 'tmp'
                    RemoteUrl = $healthUrl
                }
            }
        } else {
            Write-Host "[OK]  health dataDirSource=$dataDirSource"
        }
    }

    $backupNode = $null
    try {
        $backupNode = $healthResp.Json.checks.backup
    } catch {
        $backupNode = $null
    }
    if ($null -eq $backupNode) {
        try {
            $healthUrlNoCache = if ($healthUrl -match '\?') {
                "$healthUrl&verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
            } else {
                "$healthUrl?verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
            }
            $healthRetryResp = Invoke-JsonGetStrict -Url $healthUrlNoCache -UserAgent 'PielArmoniaDeployCheck/1.0'
            $backupNode = $healthRetryResp.Json.checks.backup
            if ($null -ne $backupNode) {
                Write-Host "[INFO] health checks.backup recuperado en segunda lectura"
            }
        } catch {
            $backupNode = $null
        }
    }
    if ($null -eq $backupNode) {
        Write-Host "[WARN] health no incluye checks.backup"
        if ($RequireBackupHealthy) {
            $results += [PSCustomObject]@{
                Asset = 'health-backup-missing'
                Match = $false
                LocalHash = 'present'
                RemoteHash = 'missing'
                RemoteUrl = $healthUrl
            }
        }
    } else {
        $backupEnabled = $false
        $backupOk = $false
        $backupReason = ''
        $backupLatestAge = ''
        $backupOffsiteConfigured = $false
        try { $backupEnabled = [bool]$backupNode.enabled } catch { $backupEnabled = $false }
        try { $backupOk = [bool]$backupNode.ok } catch { $backupOk = $false }
        try { $backupReason = [string]$backupNode.reason } catch { $backupReason = '' }
        try { $backupLatestAge = [string]$backupNode.latestAgeHours } catch { $backupLatestAge = '' }
        try { $backupOffsiteConfigured = [bool]$backupNode.offsiteConfigured } catch { $backupOffsiteConfigured = $false }

        if (-not $backupEnabled) {
            Write-Host "[WARN] checks.backup.enabled=false"
            if ($RequireBackupHealthy) {
                $results += [PSCustomObject]@{
                    Asset = 'health-backup-enabled'
                    Match = $false
                    LocalHash = 'true'
                    RemoteHash = 'false'
                    RemoteUrl = $healthUrl
                }
            }
        } elseif ($backupOk) {
            Write-Host "[OK]  health backup: ok (latestAgeHours=$backupLatestAge)"
        } else {
            Write-Host "[WARN] health backup: no-ok (reason=$backupReason, latestAgeHours=$backupLatestAge)"
            if ($RequireBackupHealthy) {
                $results += [PSCustomObject]@{
                    Asset = 'health-backup-ok'
                    Match = $false
                    LocalHash = 'true'
                    RemoteHash = 'false'
                    RemoteUrl = $healthUrl
                }
            }
        }

        if ($backupOffsiteConfigured) {
            Write-Host "[OK]  backup offsite configurado"
        } else {
            Write-Host "[WARN] backup offsite no configurado"
        }
    }

    $publicSyncNode = $null
    try {
        $publicSyncNode = $healthResp.Json.checks.publicSync
    } catch {
        $publicSyncNode = $null
    }
    if ($null -eq $publicSyncNode) {
        Write-Host "[WARN] health no incluye checks.publicSync"
        if ($RequireCronReady) {
            $results += [PSCustomObject]@{
                Asset = 'health-public-sync-missing'
                Match = $false
                LocalHash = 'present'
                RemoteHash = 'missing'
                RemoteUrl = $healthUrl
            }
        }
    } else {
        $publicSyncConfigured = $false
        $publicSyncHealthy = $false
        $publicSyncJobId = ''
        $publicSyncAgeSeconds = 999999
        $publicSyncState = ''
        $publicSyncLastErrorMessage = ''
        $publicSyncDeployedCommit = ''
        $publicSyncCurrentHead = ''
        $publicSyncRemoteHead = ''
        $publicSyncDirtyPathsCount = 0
        $publicSyncDirtyPathsSample = @()
        try { $publicSyncConfigured = [bool]$publicSyncNode.configured } catch { $publicSyncConfigured = $false }
        try { $publicSyncHealthy = [bool]$publicSyncNode.healthy } catch { $publicSyncHealthy = $false }
        try { $publicSyncJobId = [string]$publicSyncNode.jobId } catch { $publicSyncJobId = '' }
        try { $publicSyncAgeSeconds = [int]$publicSyncNode.ageSeconds } catch { $publicSyncAgeSeconds = 999999 }
        try { $publicSyncState = [string]$publicSyncNode.state } catch { $publicSyncState = '' }
        try { $publicSyncLastErrorMessage = [string]$publicSyncNode.lastErrorMessage } catch { $publicSyncLastErrorMessage = '' }
        try { $publicSyncDeployedCommit = [string]$publicSyncNode.deployedCommit } catch { $publicSyncDeployedCommit = '' }
        try { $publicSyncCurrentHead = [string]$publicSyncNode.currentHead } catch { $publicSyncCurrentHead = '' }
        try { $publicSyncRemoteHead = [string]$publicSyncNode.remoteHead } catch { $publicSyncRemoteHead = '' }
        try { $publicSyncDirtyPathsCount = [int]$publicSyncNode.dirtyPathsCount } catch { $publicSyncDirtyPathsCount = 0 }
        try {
            if ($null -ne $publicSyncNode.dirtyPathsSample) {
                $publicSyncDirtyPathsSample = @($publicSyncNode.dirtyPathsSample)
            }
        } catch {
            $publicSyncDirtyPathsSample = @()
        }
        $publicSyncDirtyPathsSampleLabel = if ($publicSyncDirtyPathsSample.Count -eq 0) {
            'none'
        } else {
            (@($publicSyncDirtyPathsSample | Select-Object -First 5 | ForEach-Object { [string]$_ }) -join ', ')
        }
        $publicSyncHeadDrift = (
            -not [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
            -not [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
            $publicSyncCurrentHead -ne $publicSyncRemoteHead
        )
        $publicSyncTelemetryGap = (
            -not $publicSyncHealthy -and
            -not [string]::IsNullOrWhiteSpace($publicSyncLastErrorMessage) -and
            [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
            [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
            $publicSyncDirtyPathsCount -le 0
        )

        if ($publicSyncConfigured) {
            Write-Host "[OK]  public sync configurado (jobId=$publicSyncJobId, state=$publicSyncState, ageSeconds=$publicSyncAgeSeconds)"
        } else {
            Write-Host "[WARN] public sync no configurado"
        }

        if (-not [string]::IsNullOrWhiteSpace($publicSyncDeployedCommit)) {
            Write-Host "[INFO] public sync deployedCommit=$publicSyncDeployedCommit"
        }
        Write-Host "[INFO] public sync lastErrorMessage=$publicSyncLastErrorMessage currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead headDrift=$publicSyncHeadDrift dirtyPathsCount=$publicSyncDirtyPathsCount telemetryGap=$publicSyncTelemetryGap dirtyPathsSample=$publicSyncDirtyPathsSampleLabel"

        if ($RequireCronReady) {
            if (-not $publicSyncConfigured) {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-configured'
                    Match = $false
                    LocalHash = 'true'
                    RemoteHash = 'false'
                    RemoteUrl = $healthUrl
                }
            }
            if ($publicSyncJobId -ne '8d31e299-7e57-4959-80b5-aaa2d73e9674') {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-job-id'
                    Match = $false
                    LocalHash = '8d31e299-7e57-4959-80b5-aaa2d73e9674'
                    RemoteHash = if ($publicSyncJobId) { $publicSyncJobId } else { 'missing' }
                    RemoteUrl = $healthUrl
                }
            }
            if (-not $publicSyncHealthy) {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-healthy'
                    Match = $false
                    LocalHash = 'true'
                    RemoteHash = if ($publicSyncState) { "${publicSyncState}:$publicSyncLastErrorMessage" } else { 'false' }
                    RemoteUrl = $healthUrl
                }
            }
            if ($publicSyncAgeSeconds -gt 120) {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-age'
                    Match = $false
                    LocalHash = '<=120'
                    RemoteHash = [string]$publicSyncAgeSeconds
                    RemoteUrl = $healthUrl
                }
            }
            if ($publicSyncLastErrorMessage -eq 'working_tree_dirty') {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-working-tree-dirty'
                    Match = $false
                    LocalHash = 'clean'
                    RemoteHash = [string]$publicSyncDirtyPathsCount
                    RemoteUrl = $healthUrl
                }
            }
            if ($publicSyncHeadDrift) {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-head-drift'
                    Match = $false
                    LocalHash = if ($publicSyncCurrentHead) { $publicSyncCurrentHead } else { 'missing' }
                    RemoteHash = if ($publicSyncRemoteHead) { $publicSyncRemoteHead } else { 'missing' }
                    RemoteUrl = $healthUrl
                }
            }
            if ($publicSyncTelemetryGap) {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-telemetry-gap'
                    Match = $false
                    LocalHash = 'currentHead+remoteHead+dirtyPathsCount'
                    RemoteHash = 'missing'
                    RemoteUrl = $healthUrl
                }
            }
        }
    }

    $storeCountsNode = $null
    try {
        $storeCountsNode = $healthResp.Json.checks.storeCounts
    } catch {
        $storeCountsNode = $null
    }
    if ($null -eq $storeCountsNode) {
        Write-Host "[WARN] health no incluye checks.storeCounts"
    } else {
        Write-Host "[OK]  health incluye checks.storeCounts"
    }

    $telemedicineNode = $null
    try {
        $telemedicineNode = $healthResp.Json.checks.telemedicine
    } catch {
        $telemedicineNode = $null
    }
    if ($null -eq $telemedicineNode) {
        Write-Host "[WARN] health no incluye checks.telemedicine"
        if ($RequireTelemedicineReady) {
            $results += [PSCustomObject]@{
                Asset = 'health-telemedicine-missing'
                Match = $false
                LocalHash = 'present'
                RemoteHash = 'missing'
                RemoteUrl = $healthUrl
            }
        }
    } else {
        $telemedicineConfigured = $false
        $telemedicineReviewQueueCount = 0
        $telemedicineDiagnosticsStatus = ''
        $telemedicineCriticalCount = 0
        $telemedicineWarningCount = 0
        $telemedicineStagedLegacyCount = 0
        $telemedicineUnlinkedIntakesCount = 0
        $telemedicineDanglingCount = 0
        $telemedicineCasePhotosMissingPrivatePathCount = 0
        try { $telemedicineConfigured = [bool]$telemedicineNode.configured } catch { $telemedicineConfigured = $false }
        try { $telemedicineReviewQueueCount = [int]$telemedicineNode.reviewQueueCount } catch { $telemedicineReviewQueueCount = 0 }
        try { $telemedicineDiagnosticsStatus = [string]$telemedicineNode.diagnostics.status } catch { $telemedicineDiagnosticsStatus = '' }
        try { $telemedicineCriticalCount = [int]$telemedicineNode.diagnostics.summary.critical } catch { $telemedicineCriticalCount = 0 }
        try { $telemedicineWarningCount = [int]$telemedicineNode.diagnostics.summary.warning } catch { $telemedicineWarningCount = 0 }
        try { $telemedicineStagedLegacyCount = [int]$telemedicineNode.integrity.stagedLegacyUploadsCount } catch { $telemedicineStagedLegacyCount = 0 }
        try { $telemedicineUnlinkedIntakesCount = [int]$telemedicineNode.integrity.unlinkedIntakesCount } catch { $telemedicineUnlinkedIntakesCount = 0 }
        try { $telemedicineDanglingCount = [int]$telemedicineNode.integrity.danglingAppointmentLinksCount } catch { $telemedicineDanglingCount = 0 }
        try { $telemedicineCasePhotosMissingPrivatePathCount = [int]$telemedicineNode.integrity.casePhotosWithoutPrivatePathCount } catch { $telemedicineCasePhotosMissingPrivatePathCount = 0 }

        if ($telemedicineConfigured) {
            Write-Host "[OK]  telemedicine configurado (diag=$telemedicineDiagnosticsStatus, reviewQueue=$telemedicineReviewQueueCount)"
        } else {
            Write-Host "[WARN] telemedicine no configurado"
        }
        if ($telemedicineWarningCount -gt 0) {
            Write-Host "[WARN] telemedicine diagnostics warning=$telemedicineWarningCount"
        }

        if ($RequireTelemedicineReady) {
            if (-not $telemedicineConfigured) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-configured'
                    Match = $false
                    LocalHash = 'true'
                    RemoteHash = 'false'
                    RemoteUrl = $healthUrl
                }
            }
            if (
                -not $AllowDegradedTelemedicineDiagnostics -and
                ($telemedicineDiagnosticsStatus -eq 'critical' -or $telemedicineCriticalCount -gt 0)
            ) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-diagnostics-critical'
                    Match = $false
                    LocalHash = 'healthy'
                    RemoteHash = "status=$telemedicineDiagnosticsStatus;critical=$telemedicineCriticalCount"
                    RemoteUrl = $healthUrl
                }
            }
            if ($telemedicineReviewQueueCount -gt $MaxTelemedicineReviewQueue) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-review-queue'
                    Match = $false
                    LocalHash = "<=$MaxTelemedicineReviewQueue"
                    RemoteHash = [string]$telemedicineReviewQueueCount
                    RemoteUrl = $healthUrl
                }
            }
            if ($telemedicineStagedLegacyCount -gt $MaxTelemedicineStagedUploads) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-staged-uploads'
                    Match = $false
                    LocalHash = "<=$MaxTelemedicineStagedUploads"
                    RemoteHash = [string]$telemedicineStagedLegacyCount
                    RemoteUrl = $healthUrl
                }
            }
            if ($telemedicineUnlinkedIntakesCount -gt $MaxTelemedicineUnlinkedIntakes) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-unlinked-intakes'
                    Match = $false
                    LocalHash = "<=$MaxTelemedicineUnlinkedIntakes"
                    RemoteHash = [string]$telemedicineUnlinkedIntakesCount
                    RemoteUrl = $healthUrl
                }
            }
            if ($telemedicineDanglingCount -gt 0) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-dangling-links'
                    Match = $false
                    LocalHash = '0'
                    RemoteHash = [string]$telemedicineDanglingCount
                    RemoteUrl = $healthUrl
                }
            }
            if ($telemedicineCasePhotosMissingPrivatePathCount -gt 0) {
                $results += [PSCustomObject]@{
                    Asset = 'health-telemedicine-case-photo-private-path'
                    Match = $false
                    LocalHash = '0'
                    RemoteHash = [string]$telemedicineCasePhotosMissingPrivatePathCount
                    RemoteUrl = $healthUrl
                }
            }
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar health: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = "health-endpoint"
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $healthUrl
    }
}

$availabilityUrl = "$base/api.php?resource=availability&doctor=indiferente&service=consulta&days=7"
try {
    $availabilityResp = Invoke-JsonGetStrict -Url $availabilityUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $availabilityMeta = $null
    try { $availabilityMeta = $availabilityResp.Json.meta } catch { $availabilityMeta = $null }
    if ($null -eq $availabilityMeta) {
        Write-Host "[FAIL] availability no incluye meta"
        $results += [PSCustomObject]@{
            Asset = 'availability-meta'
            Match = $false
            LocalHash = 'present'
            RemoteHash = 'missing'
            RemoteUrl = $availabilityUrl
        }
    } else {
        $availabilityMetaRequired = @('source', 'mode', 'timezone', 'doctor', 'service', 'durationMin', 'generatedAt')
        foreach ($field in $availabilityMetaRequired) {
            if ($null -ne $availabilityMeta.PSObject.Properties[$field]) {
                Write-Host "[OK]  availability meta incluye: $field"
            } else {
                Write-Host "[FAIL] availability meta NO incluye: $field"
                $results += [PSCustomObject]@{
                    Asset = "availability-meta-field:$field"
                    Match = $false
                    LocalHash = 'present'
                    RemoteHash = 'missing'
                    RemoteUrl = $availabilityUrl
                }
            }
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar availability: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = 'availability-endpoint'
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $availabilityUrl
    }
}

$bookedSlotsUrl = "$base/api.php?resource=booked-slots&date=2030-01-15&doctor=indiferente&service=consulta"
try {
    $bookedResp = Invoke-JsonGetStrict -Url $bookedSlotsUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $bookedMeta = $null
    try { $bookedMeta = $bookedResp.Json.meta } catch { $bookedMeta = $null }
    if ($null -eq $bookedMeta) {
        Write-Host "[FAIL] booked-slots no incluye meta"
        $results += [PSCustomObject]@{
            Asset = 'booked-slots-meta'
            Match = $false
            LocalHash = 'present'
            RemoteHash = 'missing'
            RemoteUrl = $bookedSlotsUrl
        }
    } else {
        $bookedMetaRequired = @('source', 'mode', 'timezone', 'doctor', 'service', 'durationMin', 'generatedAt')
        foreach ($field in $bookedMetaRequired) {
            if ($null -ne $bookedMeta.PSObject.Properties[$field]) {
                Write-Host "[OK]  booked-slots meta incluye: $field"
            } else {
                Write-Host "[FAIL] booked-slots meta NO incluye: $field"
                $results += [PSCustomObject]@{
                    Asset = "booked-slots-meta-field:$field"
                    Match = $false
                    LocalHash = 'present'
                    RemoteHash = 'missing'
                    RemoteUrl = $bookedSlotsUrl
                }
            }
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar booked-slots: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = 'booked-slots-endpoint'
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $bookedSlotsUrl
    }
}

$figoUrl = "$base/figo-chat.php"
try {
    $figoResp = Invoke-JsonGetStrict -Url $figoUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $figoRequired = @('mode', 'recursiveConfigDetected', 'upstreamReachable')
    foreach ($field in $figoRequired) {
        if ($null -ne $figoResp.Json.PSObject.Properties[$field]) {
            Write-Host "[OK]  figo-status incluye: $field"
        } else {
            Write-Host "[FAIL] figo-status NO incluye: $field"
            $results += [PSCustomObject]@{
                Asset = "figo-field:$field"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = $figoUrl
            }
        }
    }

    $figoMode = ''
    try {
        $figoMode = [string]($figoResp.Json.mode)
    } catch {
        $figoMode = ''
    }
    if (-not $AllowDegradedFigo -and $figoMode -ne 'live') {
        Write-Host "[FAIL] figo-status mode=$figoMode (se esperaba live)"
        $results += [PSCustomObject]@{
            Asset = 'figo-mode'
            Match = $false
            LocalHash = 'live'
            RemoteHash = $figoMode
            RemoteUrl = $figoUrl
        }
    } else {
        Write-Host "[OK]  figo-status mode=$figoMode"
    }

    $figoRecursive = $false
    try {
        $figoRecursive = [bool]($figoResp.Json.recursiveConfigDetected)
    } catch {
        $figoRecursive = $false
    }
    if ($figoRecursive -and -not $AllowRecursiveFigo) {
        Write-Host "[FAIL] figo-status recursiveConfigDetected=true"
        $results += [PSCustomObject]@{
            Asset = 'figo-recursive'
            Match = $false
            LocalHash = 'false'
            RemoteHash = 'true'
            RemoteUrl = $figoUrl
        }
    }

    $upstreamReachable = $true
    try {
        $upstreamReachable = [bool]($figoResp.Json.upstreamReachable)
    } catch {
        $upstreamReachable = $false
    }
    if (-not $AllowDegradedFigo -and -not $upstreamReachable) {
        Write-Host "[FAIL] figo-status upstreamReachable=false"
        $results += [PSCustomObject]@{
            Asset = 'figo-upstreamReachable'
            Match = $false
            LocalHash = 'true'
            RemoteHash = 'false'
            RemoteUrl = $figoUrl
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar figo-chat.php GET: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = "figo-endpoint"
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $figoUrl
    }
}

$figoBackendUrl = "$base/figo-backend.php"
try {
    $figoBackendResp = Invoke-JsonGetStrict -Url $figoBackendUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $figoBackendRequired = @('service', 'mode', 'provider', 'telegramConfigured', 'webhookSecretConfigured')
    foreach ($field in $figoBackendRequired) {
        if ($null -ne $figoBackendResp.Json.PSObject.Properties[$field]) {
            Write-Host "[OK]  figo-backend incluye: $field"
        } else {
            Write-Host "[FAIL] figo-backend NO incluye: $field"
            $results += [PSCustomObject]@{
                Asset = "figo-backend-field:$field"
                Match = $false
                LocalHash = ''
                RemoteHash = ''
                RemoteUrl = $figoBackendUrl
            }
        }
    }

    $serviceName = [string]$figoBackendResp.Json.service
    if ($serviceName -ne 'figo-backend') {
        Write-Host "[FAIL] figo-backend service invalido: $serviceName"
        $results += [PSCustomObject]@{
            Asset = 'figo-backend-service'
            Match = $false
            LocalHash = 'figo-backend'
            RemoteHash = $serviceName
            RemoteUrl = $figoBackendUrl
        }
    }

    $webhookSecretConfigured = $false
    try {
        $webhookSecretConfigured = [bool]($figoBackendResp.Json.webhookSecretConfigured)
    } catch {
        $webhookSecretConfigured = $false
    }
    if ($RequireWebhookSecret -and -not $webhookSecretConfigured) {
        Write-Host "[FAIL] figo-backend webhookSecretConfigured=false"
        $results += [PSCustomObject]@{
            Asset = 'figo-backend-webhookSecretConfigured'
            Match = $false
            LocalHash = 'true'
            RemoteHash = 'false'
            RemoteUrl = $figoBackendUrl
        }
    }
} catch {
    Write-Host "[FAIL] No se pudo validar figo-backend.php GET: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = "figo-backend-endpoint"
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = $figoBackendUrl
    }
}

if ($RunSmoke) {
    Write-Host ""
    Write-Host "Ejecutando smoke..."
    & $smokeScriptPath -Domain $base -TestFigoPost -AllowDegradedFigo:$AllowDegradedFigo -AllowRecursiveFigo:$AllowRecursiveFigo -AllowMetaCspFallback:$AllowMetaCspFallback -RequireWebhookSecret:$RequireWebhookSecret
}

$failed = @($results | Where-Object { $_.Match -ne $true }).Count
Write-VerifyReport -Path $ReportPath -Domain $base -Results $results -FailedCount $failed
if ($failed -gt 0) {
    Write-Host ""
    Write-Host "Resultado: $failed falla(s) detectadas."
    exit 1
}

Write-Host ""
Write-Host "Resultado: verificacion de despliegue OK."
exit 0
