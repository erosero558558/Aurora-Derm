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
    [switch]$RequireStoreEncryption,
    [switch]$RequireAuthConfigured,
    [switch]$RequireOperatorAuth,
    [switch]$RequireAdminTwoFactor,
    [switch]$RequireTurneroWebSurfaces,
    [switch]$RequireTurneroOperatorPilot,
    [switch]$RequireStableDataDir,
    [int]$MaxHealthTimingMs = 2000,
    [int]$AssetHashRetryCount = 2,
    [int]$AssetHashRetryDelaySec = 4,
    [switch]$SkipAssetHashChecks,
    [switch]$ForceAssetHashChecks,
    [string]$ReportPath = 'verification/last-deploy-verify.json',
    [string]$GitHubRepo = 'erosero558558/Aurora-Derm',
    [string]$GitHubApiBase = 'https://api.github.com',
    [int]$GitHubAlertsTimeoutSec = 15,
    [int]$GitHubAlertsIssueLimit = 30,
    [switch]$AllowOpenGitHubDeployAlerts
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$script:CurlBinary = $null
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'
$openClawAuthDiagnosticScriptPath = Join-Path $repoRoot 'scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1'
. $commonHttpPath

$generatedSiteRoot = Join-Path $repoRoot '.generated/site-root'
$localIndexCandidatePaths = @(
    (Join-Path $generatedSiteRoot 'es/index.html'),
    (Join-Path $generatedSiteRoot 'en/index.html'),
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
$localScriptPath = Join-Path $generatedSiteRoot 'script.js'
$localI18nEnginePath = Join-Path $repoRoot 'i18n-engine.js'
$localRescheduleGatewayPath = Join-Path $repoRoot 'reschedule-gateway-engine.js'
$generatedEnginesRoot = Join-Path $generatedSiteRoot 'js/engines'
$smokeScriptPath = Join-Path $PSScriptRoot 'SMOKE-PRODUCCION.ps1'
$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'
$primaryScriptRefPattern = '<script[^>]+src="([^"]*(?:script\.js|public-v6-shell\.js)[^"]*)"'
$primaryStyleRefPattern = '<link[^>]+href="([^"]*(?:styles\.css|_astro/[^"]+\.css)[^"]*)"'
$deferredStyleRefPattern = '<link[^>]+href="([^"]*styles-deferred\.css[^"]*)"'
$adminSurfaceUrl = "$base/admin.html"
$serviceWorkerUrl = "$base/sw.js"
$turneroOperatorSurfaceUrl = "$base/operador-turnos.html"
$turneroKioskSurfaceUrl = "$base/kiosco-turnos.html"
$turneroDisplaySurfaceUrl = "$base/sala-turnos.html"
$turneroOperatorPilotCenterUrl = "$base/app-downloads/?surface=operator&platform=win"
$turneroOperatorPilotFeedUrl = "$base/desktop-updates/pilot/operator/win/latest.yml"
$turneroOperatorPilotInstallerUrl = "$base/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"
$diagnosticsAccessToken = [string]$env:AURORADERM_DIAGNOSTICS_ACCESS_TOKEN
if ([string]::IsNullOrWhiteSpace($diagnosticsAccessToken)) {
    $diagnosticsAccessToken = [string]$env:PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN
}
if ([string]::IsNullOrWhiteSpace($diagnosticsAccessToken)) {
    $diagnosticsAccessToken = [string]$env:AURORADERM_CRON_SECRET
}
if ([string]::IsNullOrWhiteSpace($diagnosticsAccessToken)) {
    $diagnosticsAccessToken = [string]$env:PIELARMONIA_CRON_SECRET
}
$diagnosticsAuthConfigured = -not [string]::IsNullOrWhiteSpace($diagnosticsAccessToken)

function Test-BooleanLike {
    param(
        [string]$Value,
        [bool]$Default = $false
    )

    $normalized = ([string]$Value).Trim().ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($normalized)) {
        return $Default
    }
    if ($normalized -in @('1', 'true', 'yes', 'on')) {
        return $true
    }
    if ($normalized -in @('0', 'false', 'no', 'off')) {
        return $false
    }
    return $Default
}

function Resolve-RequireOperatorAuthFlag {
    param(
        [switch]$ExplicitFlag
    )

    if ($ExplicitFlag) {
        return $true
    }

    $explicitCandidates = @(
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_PRECHECK_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_INPUT,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_FAST_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_FAST,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_PRECHECK_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_INPUT,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_FAST_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_FAST,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH
    )

    foreach ($candidate in $explicitCandidates) {
        if (-not [string]::IsNullOrWhiteSpace([string]$candidate)) {
            return (Test-BooleanLike -Value ([string]$candidate) -Default:$false)
        }
    }

    $stageCandidates = @(
        $env:ADMIN_ROLLOUT_STAGE_EFFECTIVE,
        $env:ADMIN_ROLLOUT_STAGE_INPUT,
        $env:ADMIN_ROLLOUT_STAGE_FAST_EFFECTIVE,
        $env:ADMIN_ROLLOUT_STAGE_FAST,
        $env:ADMIN_ROLLOUT_STAGE
    )

    foreach ($candidate in $stageCandidates) {
        $normalized = ([string]$candidate).Trim().ToLowerInvariant()
        if ([string]::IsNullOrWhiteSpace($normalized)) {
            continue
        }
        if ($normalized -in @('stable', 'general', 'canary')) {
            return $true
        }
        if ($normalized -in @('internal', 'rollback')) {
            return $false
        }
    }

    return $false
}

function Invoke-HeadCheck {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 20,
        [string]$UserAgent = 'PielArmoniaDeployCheck/1.0'
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method HEAD -TimeoutSec $TimeoutSec -UseBasicParsing -Headers (Get-DiagnosticsAuthHeaders -UserAgent $UserAgent)
        $status = [int]$resp.StatusCode
        return [pscustomobject]@{
            Name = $Name
            Ok = ($status -ge 200 -and $status -lt 300)
            StatusCode = $status
            Error = if ($status -ge 200 -and $status -lt 300) { '' } else { "HTTP $status" }
        }
    } catch {
        $statusCode = 0
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        }
        return [pscustomobject]@{
            Name = $Name
            Ok = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
        }
    }
}

function Add-DeployFailure {
    param(
        [string]$Asset,
        [string]$LocalHash,
        [string]$RemoteHash,
        [string]$RemoteUrl
    )

    $script:results += [PSCustomObject]@{
        Asset = $Asset
        Match = $false
        LocalHash = $LocalHash
        RemoteHash = $RemoteHash
        RemoteUrl = $RemoteUrl
    }
}

function Get-AssetVersionFromText {
    param(
        [string]$Content,
        [string]$AssetPath
    )

    $normalizedAssetPath = ([string]$AssetPath).Trim().TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($normalizedAssetPath)) {
        return ''
    }

    $pattern = '(?:["''(=/]|^)/?' + [regex]::Escape($normalizedAssetPath) + '\?v=([^"''\s)]+)'
    $match = [regex]::Match([string]$Content, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
        return [string]$match.Groups[1].Value.Trim()
    }

    return ''
}

function Get-AssetVersionMap {
    param(
        [string]$Content,
        [string[]]$Assets
    )

    $map = [ordered]@{}
    foreach ($asset in @($Assets)) {
        $map[$asset] = [string](Get-AssetVersionFromText -Content $Content -AssetPath $asset)
    }

    return $map
}

function Get-ServiceWorkerCacheName {
    param(
        [string]$Content
    )

    $match = [regex]::Match([string]$Content, "const CACHE_NAME = '([^']+)'", [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
        return [string]$match.Groups[1].Value.Trim()
    }

    return ''
}

function Compare-AssetVersionMaps {
    param(
        [string]$ParityKey,
        [System.Collections.IDictionary]$ShellVersions,
        [System.Collections.IDictionary]$ServiceWorkerVersions,
        [string[]]$Assets
    )

    $mismatches = @()
    $ok = $true

    foreach ($asset in @($Assets)) {
        $shellVersion = if ($null -ne $ShellVersions -and $ShellVersions.Contains($asset)) {
            [string]$ShellVersions[$asset]
        } else {
            ''
        }
        $serviceWorkerVersion = if ($null -ne $ServiceWorkerVersions -and $ServiceWorkerVersions.Contains($asset)) {
            [string]$ServiceWorkerVersions[$asset]
        } else {
            ''
        }

        if ($shellVersion -eq $serviceWorkerVersion) {
            continue
        }

        $ok = $false
        $mismatches += [pscustomobject]@{
            parity = $ParityKey
            asset = $asset
            shellVersion = $shellVersion
            serviceWorkerVersion = $serviceWorkerVersion
        }
    }

    return [pscustomobject]@{
        Ok = $ok
        Mismatches = @($mismatches)
    }
}

function Format-AssetVersionMap {
    param(
        [System.Collections.IDictionary]$Versions,
        [string[]]$Assets
    )

    $parts = @()
    foreach ($asset in @($Assets)) {
        $value = if ($null -ne $Versions -and $Versions.Contains($asset)) {
            [string]$Versions[$asset]
        } else {
            ''
        }
        $label = if ([string]::IsNullOrWhiteSpace($value)) { 'missing' } else { $value }
        $parts += "${asset}=${label}"
    }

    return ($parts -join '; ')
}

function Format-ParityMismatchSummary {
    param(
        [Object[]]$Mismatches
    )

    $parts = @()
    foreach ($mismatch in @($Mismatches)) {
        $shellVersion = if ([string]::IsNullOrWhiteSpace([string]$mismatch.shellVersion)) {
            'missing'
        } else {
            [string]$mismatch.shellVersion
        }
        $serviceWorkerVersion = if ([string]::IsNullOrWhiteSpace([string]$mismatch.serviceWorkerVersion)) {
            'missing'
        } else {
            [string]$mismatch.serviceWorkerVersion
        }
        $parts += "$([string]$mismatch.asset): shell=$shellVersion sw=$serviceWorkerVersion"
    }

    return ($parts -join '; ')
}

function Invoke-OpenClawAuthRolloutDiagnostic {
    param(
        [string]$BaseUrl,
        [string]$ScriptPath
    )

    if (-not (Test-Path $ScriptPath)) {
        return [PSCustomObject]@{
            available = $false
            ok = $false
            diagnosis = 'diagnostic_script_missing'
            nextAction = 'No se encontro scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1 en este workspace.'
            source = ''
            mode = ''
            configured = $false
            error = 'diagnostic_script_missing'
        }
    }

    $reportPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-auth-rollout-" + [Guid]::NewGuid().ToString('N') + '.json')

    try {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -Domain $BaseUrl -AllowNotReady -ReportPath $reportPath *> $null

        if (-not (Test-Path $reportPath)) {
            throw 'No se genero reporte del diagnostico Operator Auth.'
        }

        $raw = Get-Content -Path $reportPath -Raw
        $payload = ($raw -replace "^\uFEFF", '') | ConvertFrom-Json -Depth 12

        return [PSCustomObject]@{
            available = $true
            ok = [bool]$payload.ok
            diagnosis = [string]$payload.diagnosis
            nextAction = [string]$payload.next_action
            source = [string]$payload.resolved.source
            mode = [string]$payload.resolved.mode
            configured = [bool]$payload.resolved.configured
            error = ''
        }
    } catch {
        return [PSCustomObject]@{
            available = $true
            ok = $false
            diagnosis = 'diagnostic_script_failed'
            nextAction = 'No se pudo interpretar el diagnostico Operator Auth del admin.'
            source = ''
            mode = ''
            configured = $false
            error = $_.Exception.Message
        }
    } finally {
        Remove-Item -Path $reportPath -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "== Verificacion de despliegue =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$effectiveRequireOperatorAuth = Resolve-RequireOperatorAuthFlag -ExplicitFlag:$RequireOperatorAuth
if ($effectiveRequireOperatorAuth -and -not $RequireOperatorAuth) {
    Write-Host "[INFO] RequireOperatorAuth activado automaticamente por la politica efectiva del rollout admin."
}

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
$adminSurfaceAssetList = @(
    'admin-v3.css',
    'queue-ops.css',
    'js/admin-preboot-shortcuts.js',
    'admin.js'
)
$operatorSurfaceAssetList = @(
    'queue-ops.css',
    'js/queue-operator.js'
)
$serviceWorkerAssetList = @($adminSurfaceAssetList + $operatorSurfaceAssetList | Select-Object -Unique)
$adminSurfaceResp = $null
$serviceWorkerResp = $null
$turneroOperatorSurfaceResp = $null
$adminSurfaceVersions = [ordered]@{}
$operatorSurfaceVersions = [ordered]@{}
$serviceWorkerVersions = [ordered]@{}
$serviceWorkerCacheName = ''
$adminSurfaceVsSwOk = $false
$operatorSurfaceVsSwOk = $false
$adminSurfaceParityMismatches = @()
$securityHeaderCheck = Test-SecurityHeaders -Base $base -AllowMetaCspFallback:$AllowMetaCspFallback
$results += @($securityHeaderCheck.Results)

$remoteScriptRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern $primaryScriptRefPattern
$remoteStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern $primaryStyleRefPattern
$remoteDeferredStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern $deferredStyleRefPattern
$remoteHasInlineCriticalCss = [regex]::IsMatch($remoteIndexRaw, '<style\b[^>]*>[\s\S]*?</style>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
$appScriptRemoteUrl = Get-Url -Base $base -Ref $remoteScriptRef
$criticalCssRemoteUrl = Get-Url -Base $base -Ref $remoteStyleRef
$indexDeferredStylesRemoteUrl = Get-Url -Base $base -Ref $remoteDeferredStyleRef
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

$adminSurfaceResp = Invoke-TextGet -Name 'admin-surface' -Url $adminSurfaceUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
$serviceWorkerResp = Invoke-TextGet -Name 'service-worker' -Url $serviceWorkerUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
$turneroOperatorSurfaceResp = Invoke-TextGet -Name 'turnero-operator-surface' -Url $turneroOperatorSurfaceUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
$adminSurfaceVersions = Get-AssetVersionMap -Content ([string]$adminSurfaceResp.Body) -Assets $adminSurfaceAssetList
$serviceWorkerVersions = Get-AssetVersionMap -Content ([string]$serviceWorkerResp.Body) -Assets $serviceWorkerAssetList
$operatorSurfaceVersions = Get-AssetVersionMap -Content ([string]$turneroOperatorSurfaceResp.Body) -Assets $operatorSurfaceAssetList
$serviceWorkerCacheName = Get-ServiceWorkerCacheName -Content ([string]$serviceWorkerResp.Body)

if ($adminSurfaceResp.Ok) {
    Write-Host '[OK]  admin surface publicado'
} else {
    Write-Host "[FAIL] admin surface ausente (status=$($adminSurfaceResp.StatusCode))"
}

if ($serviceWorkerResp.Ok) {
    $serviceWorkerCacheLabel = if ([string]::IsNullOrWhiteSpace($serviceWorkerCacheName)) {
        'cache_name missing'
    } else {
        "cache_name=$serviceWorkerCacheName"
    }
    Write-Host "[OK]  service worker publicado ($serviceWorkerCacheLabel)"
} else {
    Write-Host "[FAIL] service worker ausente (status=$($serviceWorkerResp.StatusCode))"
}

if ($turneroOperatorSurfaceResp.Ok) {
    Write-Host '[OK]  turnero operador web publicado'
} else {
    Write-Host "[FAIL] turnero operador web ausente (status=$($turneroOperatorSurfaceResp.StatusCode))"
}

$adminParityDetail = ''
if ($adminSurfaceResp.Ok -and $serviceWorkerResp.Ok) {
    $adminSurfaceComparison = Compare-AssetVersionMaps -ParityKey 'admin_shell_vs_sw' -ShellVersions $adminSurfaceVersions -ServiceWorkerVersions $serviceWorkerVersions -Assets $adminSurfaceAssetList
    $adminSurfaceVsSwOk = [bool]$adminSurfaceComparison.Ok
    if ($adminSurfaceVsSwOk) {
        Write-Host '[OK]  admin shell y sw.js alineados'
        $adminParityDetail = 'admin shell y sw.js alineados'
    } else {
        $adminSurfaceParityMismatches += @($adminSurfaceComparison.Mismatches)
        $adminParityDetail = Format-ParityMismatchSummary -Mismatches $adminSurfaceComparison.Mismatches
        Write-Host "[FAIL] admin shell vs sw drift detectado ($adminParityDetail)"
    }
} else {
    $adminParityReasons = @()
    if (-not $adminSurfaceResp.Ok) {
        $adminParityReasons += "admin.html status=$($adminSurfaceResp.StatusCode)"
    }
    if (-not $serviceWorkerResp.Ok) {
        $adminParityReasons += "sw.js status=$($serviceWorkerResp.StatusCode)"
    }
    $adminParityDetail = ($adminParityReasons -join '; ')
    Write-Host "[FAIL] admin shell vs sw no verificable ($adminParityDetail)"
}

$operatorParityDetail = ''
if ($turneroOperatorSurfaceResp.Ok -and $serviceWorkerResp.Ok) {
    $operatorSurfaceComparison = Compare-AssetVersionMaps -ParityKey 'operator_shell_vs_sw' -ShellVersions $operatorSurfaceVersions -ServiceWorkerVersions $serviceWorkerVersions -Assets $operatorSurfaceAssetList
    $operatorSurfaceVsSwOk = [bool]$operatorSurfaceComparison.Ok
    if ($operatorSurfaceVsSwOk) {
        Write-Host '[OK]  operador-turnos y sw.js alineados'
        $operatorParityDetail = 'operador-turnos y sw.js alineados'
    } else {
        $adminSurfaceParityMismatches += @($operatorSurfaceComparison.Mismatches)
        $operatorParityDetail = Format-ParityMismatchSummary -Mismatches $operatorSurfaceComparison.Mismatches
        Write-Host "[FAIL] operador-turnos shell vs sw drift detectado ($operatorParityDetail)"
    }
} else {
    $operatorParityReasons = @()
    if (-not $turneroOperatorSurfaceResp.Ok) {
        $operatorParityReasons += "operador-turnos.html status=$($turneroOperatorSurfaceResp.StatusCode)"
    }
    if (-not $serviceWorkerResp.Ok) {
        $operatorParityReasons += "sw.js status=$($serviceWorkerResp.StatusCode)"
    }
    $operatorParityDetail = ($operatorParityReasons -join '; ')
    Write-Host "[FAIL] operador-turnos shell vs sw no verificable ($operatorParityDetail)"
}

$results += [PSCustomObject]@{
    Asset = 'admin-sw-version-drift'
    Match = $adminSurfaceVsSwOk
    LocalHash = if ($adminSurfaceResp.Ok) { Format-AssetVersionMap -Versions $adminSurfaceVersions -Assets $adminSurfaceAssetList } else { "status=$($adminSurfaceResp.StatusCode)" }
    RemoteHash = if ($serviceWorkerResp.Ok) { "cache=$serviceWorkerCacheName; $(Format-AssetVersionMap -Versions $serviceWorkerVersions -Assets $adminSurfaceAssetList)" } else { "status=$($serviceWorkerResp.StatusCode)" }
    RemoteUrl = "$adminSurfaceUrl | $serviceWorkerUrl"
    Detail = $adminParityDetail
}

$results += [PSCustomObject]@{
    Asset = 'operator-sw-version-drift'
    Match = $operatorSurfaceVsSwOk
    LocalHash = if ($turneroOperatorSurfaceResp.Ok) { Format-AssetVersionMap -Versions $operatorSurfaceVersions -Assets $operatorSurfaceAssetList } else { "status=$($turneroOperatorSurfaceResp.StatusCode)" }
    RemoteHash = if ($serviceWorkerResp.Ok) { "cache=$serviceWorkerCacheName; $(Format-AssetVersionMap -Versions $serviceWorkerVersions -Assets $operatorSurfaceAssetList)" } else { "status=$($serviceWorkerResp.StatusCode)" }
    RemoteUrl = "$turneroOperatorSurfaceUrl | $serviceWorkerUrl"
    Detail = $operatorParityDetail
}

if ($RequireTurneroWebSurfaces -or $RequireTurneroOperatorPilot) {
    if ($turneroOperatorSurfaceResp.Ok) {
        Write-Host '[OK]  turnero operador web publicado'
    } else {
        Write-Host "[FAIL] turnero operador web ausente (status=$($turneroOperatorSurfaceResp.StatusCode))"
        Add-DeployFailure -Asset 'turnero-operator-surface' -LocalHash '200' -RemoteHash "status=$($turneroOperatorSurfaceResp.StatusCode)" -RemoteUrl $turneroOperatorSurfaceUrl
    }
}

if ($RequireTurneroWebSurfaces) {
    $turneroKioskSurfaceResp = Invoke-TextGet -Name 'turnero-kiosk-surface' -Url $turneroKioskSurfaceUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    if ($turneroKioskSurfaceResp.Ok) {
        Write-Host '[OK]  turnero kiosco web publicado'
    } else {
        Write-Host "[FAIL] turnero kiosco web ausente (status=$($turneroKioskSurfaceResp.StatusCode))"
        Add-DeployFailure -Asset 'turnero-kiosk-surface' -LocalHash '200' -RemoteHash "status=$($turneroKioskSurfaceResp.StatusCode)" -RemoteUrl $turneroKioskSurfaceUrl
    }

    $turneroDisplaySurfaceResp = Invoke-TextGet -Name 'turnero-display-surface' -Url $turneroDisplaySurfaceUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    if ($turneroDisplaySurfaceResp.Ok) {
        Write-Host '[OK]  turnero sala web publicado'
    } else {
        Write-Host "[FAIL] turnero sala web ausente (status=$($turneroDisplaySurfaceResp.StatusCode))"
        Add-DeployFailure -Asset 'turnero-display-surface' -LocalHash '200' -RemoteHash "status=$($turneroDisplaySurfaceResp.StatusCode)" -RemoteUrl $turneroDisplaySurfaceUrl
    }
}

if ($RequireTurneroOperatorPilot) {
    $turneroPilotCenterResp = Invoke-TextGet -Name 'turnero-operator-pilot-center' -Url $turneroOperatorPilotCenterUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $turneroPilotCenterMatches = $turneroPilotCenterResp.Ok -and ([string]$turneroPilotCenterResp.Body).Contains('TurneroOperadorSetup.exe')
    if ($turneroPilotCenterMatches) {
        Write-Host '[OK]  turnero operador pilot center publicado'
    } else {
        Write-Host "[FAIL] turnero operador pilot center incompleto (status=$($turneroPilotCenterResp.StatusCode))"
        Add-DeployFailure -Asset 'turnero-operator-pilot-center' -LocalHash 'TurneroOperadorSetup.exe visible' -RemoteHash $(if ($turneroPilotCenterResp.Ok) { 'installer missing in body' } else { "status=$($turneroPilotCenterResp.StatusCode)" }) -RemoteUrl $turneroOperatorPilotCenterUrl
    }

    $turneroPilotFeedResp = Invoke-TextGet -Name 'turnero-operator-pilot-feed' -Url $turneroOperatorPilotFeedUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    $turneroPilotFeedMatches = $turneroPilotFeedResp.Ok -and [regex]::IsMatch([string]$turneroPilotFeedResp.Body, '(?m)^path:\s*TurneroOperadorSetup\.exe\s*$')
    if ($turneroPilotFeedMatches) {
        Write-Host '[OK]  turnero operador pilot feed publicado'
    } else {
        Write-Host "[FAIL] turnero operador pilot feed incompleto (status=$($turneroPilotFeedResp.StatusCode))"
        Add-DeployFailure -Asset 'turnero-operator-pilot-feed' -LocalHash 'path: TurneroOperadorSetup.exe' -RemoteHash $(if ($turneroPilotFeedResp.Ok) { 'missing canonical path' } else { "status=$($turneroPilotFeedResp.StatusCode)" }) -RemoteUrl $turneroOperatorPilotFeedUrl
    }

    $turneroPilotInstallerResp = Invoke-HeadCheck -Name 'turnero-operator-pilot-installer' -Url $turneroOperatorPilotInstallerUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    if ($turneroPilotInstallerResp.Ok) {
        Write-Host '[OK]  turnero operador pilot installer publicado'
    } else {
        Write-Host "[FAIL] turnero operador pilot installer ausente (status=$($turneroPilotInstallerResp.StatusCode))"
        Add-DeployFailure -Asset 'turnero-operator-pilot-installer' -LocalHash '200' -RemoteHash "status=$($turneroPilotInstallerResp.StatusCode)" -RemoteUrl $turneroOperatorPilotInstallerUrl
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
            LocalPath = (Join-Path $repoRoot 'styles.css')
            RemoteUrl = (Get-Url -Base $base -Ref $localStyleRef)
        }
    }
    if ($remoteScriptRef -ne '') {
        $checks += [PSCustomObject]@{
            Name = 'script.js'
            LocalPath = $localScriptPath
            RemoteUrl = (Get-Url -Base $base -Ref $remoteScriptRef)
        }
    } else {
        Write-Host '[WARN] Se omite hash de script.js: referencia remota no detectada.'
    }

    $checks += @(
        [PSCustomObject]@{
            Name = 'chat-widget-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'chat-widget-engine.js')
            LocalCandidates = @()
            RemoteUrl = $chatWidgetEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'chat-engine.js')
            LocalCandidates = @()
            RemoteUrl = $chatEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-ui-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'chat-ui-engine.js')
            LocalCandidates = @()
            RemoteUrl = $chatUiEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'styles-deferred.css'
            LocalPath = (Join-Path $repoRoot 'styles-deferred.css')
            LocalCandidates = @()
            RemoteUrl = $deferredStylesRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'booking-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'booking-engine.js')
            LocalCandidates = @()
            RemoteUrl = $bookingEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'ui-effects.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'ui-effects.js')
            LocalCandidates = @()
            RemoteUrl = $uiEffectsRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'gallery-interactions.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'gallery-interactions.js')
            LocalCandidates = @()
            RemoteUrl = $galleryInteractionsRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'booking-ui.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'booking-ui.js')
            LocalCandidates = @()
            RemoteUrl = $bookingUiRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-booking-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'chat-booking-engine.js')
            LocalCandidates = @()
            RemoteUrl = $chatBookingEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'success-modal-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'success-modal-engine.js')
            LocalCandidates = @()
            RemoteUrl = $successModalEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'engagement-forms-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'engagement-forms-engine.js')
            LocalCandidates = @()
            RemoteUrl = $engagementFormsEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'modal-ux-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'modal-ux-engine.js')
            LocalCandidates = @()
            RemoteUrl = $modalUxEngineRemoteUrl
        }
    )
    if ($hasTranslationsEnAsset) {
        $checks += [PSCustomObject]@{
            Name = 'translations-en.js'
            LocalPath = (Join-Path $generatedSiteRoot 'translations-en.js')
            LocalCandidates = @('js/translations-en.js')
            RemoteUrl = $translationsEnRemoteUrl
        }
    }
    if (($rescheduleEngineRemoteUrl -ne '') -or (Test-Path 'js/engines/reschedule-engine.js')) {
        $checks += [PSCustomObject]@{
            Name = 'reschedule-engine.js'
            LocalPath = (Join-Path $generatedEnginesRoot 'reschedule-engine.js')
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

$healthUrl = "$base/api.php?resource=health-diagnostics"
$healthPublicUrl = "$base/api.php?resource=health"
$healthSupportsDetailedChecks = $true
try {
    try {
        $healthResp = Invoke-JsonGetStrict -Url $healthUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
    } catch {
        Write-Host "[WARN] health-diagnostics no disponible: $($_.Exception.Message)"
        $healthResp = Invoke-JsonGetStrict -Url $healthPublicUrl -UserAgent 'PielArmoniaDeployCheck/1.0'
        $healthUrl = $healthPublicUrl
        $healthSupportsDetailedChecks = $false
        Write-Host '[INFO] health fallback activo: usando payload publico para checks compatibles'
    }

    $healthRequired = if ($healthSupportsDetailedChecks) {
        @(
            'timingMs',
            'version',
            'dataDirWritable',
            'dataDirSource',
            'storeEncrypted',
            'storeEncryptionConfigured',
            'storeEncryptionRequired',
            'storeEncryptionStatus',
            'storeEncryptionCompliant',
            'authMode',
            'authStatus',
            'authConfigured',
            'authHardeningCompliant',
            'figoConfigured',
            'figoRecursiveConfig',
            'calendarConfigured',
            'calendarReachable',
            'calendarMode',
            'calendarSource',
            'calendarAuth',
            'calendarTokenHealthy'
        )
    } else {
        @(
            'timingMs',
            'version',
            'dataDirWritable',
            'storageReady',
            'timestamp'
        )
    }
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

    $storageNode = $null
    try {
        $storageNode = $healthResp.Json.checks.storage
    } catch {
        $storageNode = $null
    }
    if ($null -eq $storageNode) {
        Write-Host "[WARN] health no incluye checks.storage"
        if ($RequireStoreEncryption) {
            $results += [PSCustomObject]@{
                Asset = 'health-store-encryption-missing'
                Match = $false
                LocalHash = 'present'
                RemoteHash = 'missing'
                RemoteUrl = $healthUrl
            }
        }
    } else {
        $storeEncrypted = $false
        $storeEncryptionConfigured = $false
        $storeEncryptionRequired = $false
        $storeEncryptionStatus = 'unknown'
        $storeEncryptionCompliant = $false
        $storageBackend = 'unknown'
        $storageSource = 'unknown'

        try { $storeEncrypted = [bool]$storageNode.encrypted } catch { $storeEncrypted = $false }
        try { $storeEncryptionConfigured = [bool]$storageNode.encryptionConfigured } catch { $storeEncryptionConfigured = $false }
        try { $storeEncryptionRequired = [bool]$storageNode.encryptionRequired } catch { $storeEncryptionRequired = $false }
        try { $storeEncryptionStatus = [string]$storageNode.encryptionStatus } catch { $storeEncryptionStatus = 'unknown' }
        try { $storeEncryptionCompliant = [bool]$storageNode.encryptionCompliant } catch { $storeEncryptionCompliant = $false }
        try { $storageBackend = [string]$storageNode.backend } catch { $storageBackend = 'unknown' }
        try { $storageSource = [string]$storageNode.source } catch { $storageSource = 'unknown' }

        Write-Host "[INFO] health storage backend=$storageBackend source=$storageSource encrypted=$storeEncrypted encryptionConfigured=$storeEncryptionConfigured encryptionRequired=$storeEncryptionRequired encryptionStatus=$storeEncryptionStatus encryptionCompliant=$storeEncryptionCompliant"

        if (($storeEncryptionRequired -or $RequireStoreEncryption) -and -not $storeEncryptionCompliant) {
            $results += [PSCustomObject]@{
                Asset = 'health-store-encryption-compliant'
                Match = $false
                LocalHash = 'true'
                RemoteHash = "status=$storeEncryptionStatus;configured=$storeEncryptionConfigured;required=$storeEncryptionRequired"
                RemoteUrl = $healthUrl
            }
        } elseif (-not $storeEncryptionCompliant) {
            Write-Host "[WARN] health storage encryption no compliant"
        } elseif ($storeEncryptionStatus -eq 'encrypted') {
            Write-Host "[OK]  health storage cifrado en reposo activo"
        } else {
            Write-Host "[OK]  health storage status=$storeEncryptionStatus"
        }
    }

    $authNode = $null
    try {
        $authNode = $healthResp.Json.checks.auth
    } catch {
        $authNode = $null
    }
    if ($null -eq $authNode) {
        Write-Host "[WARN] health no incluye checks.auth"
        if (
            $healthSupportsDetailedChecks -or
            $RequireAuthConfigured -or
            $RequireOperatorAuth -or
            $RequireAdminTwoFactor
        ) {
            $results += [PSCustomObject]@{
                Asset = 'health-auth-missing'
                Match = $false
                LocalHash = 'present'
                RemoteHash = 'missing'
                RemoteUrl = $healthUrl
            }
        }
    } else {
        $authMode = 'unknown'
        $authStatus = 'unknown'
        $authConfigured = $false
        $authHardeningCompliant = $false
        $authRecommendedMode = 'google_oauth'
        $authRecommendedModeActive = $false
        $authOperatorAuthEnabled = $false
        $authOperatorAuthConfigured = $false
        $authLegacyPasswordConfigured = $false
        $authTwoFactorEnabled = $false

        try { $authMode = [string]$authNode.mode } catch { $authMode = 'unknown' }
        try { $authStatus = [string]$authNode.status } catch { $authStatus = 'unknown' }
        try { $authConfigured = [bool]$authNode.configured } catch { $authConfigured = $false }
        try { $authHardeningCompliant = [bool]$authNode.hardeningCompliant } catch { $authHardeningCompliant = $false }
        try { $authRecommendedMode = [string]$authNode.recommendedMode } catch { $authRecommendedMode = 'google_oauth' }
        try { $authRecommendedModeActive = [bool]$authNode.recommendedModeActive } catch { $authRecommendedModeActive = $false }
        try { $authOperatorAuthEnabled = [bool]$authNode.operatorAuthEnabled } catch { $authOperatorAuthEnabled = $false }
        try { $authOperatorAuthConfigured = [bool]$authNode.operatorAuthConfigured } catch { $authOperatorAuthConfigured = $false }
        try { $authLegacyPasswordConfigured = [bool]$authNode.legacyPasswordConfigured } catch { $authLegacyPasswordConfigured = $false }
        try { $authTwoFactorEnabled = [bool]$authNode.twoFactorEnabled } catch { $authTwoFactorEnabled = $false }

        Write-Host "[INFO] health auth mode=$authMode status=$authStatus configured=$authConfigured hardeningCompliant=$authHardeningCompliant recommendedMode=$authRecommendedMode recommendedModeActive=$authRecommendedModeActive operatorAuthEnabled=$authOperatorAuthEnabled operatorAuthConfigured=$authOperatorAuthConfigured legacyPasswordConfigured=$authLegacyPasswordConfigured twoFactorEnabled=$authTwoFactorEnabled"

        if (-not $authConfigured) {
            $results += [PSCustomObject]@{
                Asset = 'health-auth-configured'
                Match = $false
                LocalHash = 'true'
                RemoteHash = "mode=$authMode;status=$authStatus"
                RemoteUrl = $healthUrl
            }
        }
        if ($effectiveRequireOperatorAuth -and -not $authRecommendedModeActive) {
            $results += [PSCustomObject]@{
                Asset = 'health-auth-mode'
                Match = $false
                LocalHash = $authRecommendedMode
                RemoteHash = $authMode
                RemoteUrl = $healthUrl
            }
        }
        if ($RequireAdminTwoFactor -and -not $authTwoFactorEnabled) {
            $results += [PSCustomObject]@{
                Asset = 'health-auth-2fa'
                Match = $false
                LocalHash = 'true'
                RemoteHash = 'false'
                RemoteUrl = $healthUrl
            }
        }
        if ($RequireAuthConfigured -and -not $authHardeningCompliant) {
            $results += [PSCustomObject]@{
                Asset = 'health-auth-hardening'
                Match = $false
                LocalHash = 'true'
                RemoteHash = "mode=$authMode;recommendedMode=$authRecommendedMode;twoFactorEnabled=$authTwoFactorEnabled"
                RemoteUrl = $healthUrl
            }
        }
        if (-not $authRecommendedModeActive) {
            Write-Host "[WARN] health auth mode no recomendado (mode=$authMode expected=$authRecommendedMode)"
        }
        if ($authMode -eq 'legacy_password' -and -not $authTwoFactorEnabled) {
            Write-Host "[WARN] health auth legacy_password sin 2FA"
        }
        if ($authConfigured -and -not $authHardeningCompliant) {
            Write-Host "[WARN] health auth hardening pendiente"
        }

        if ($effectiveRequireOperatorAuth) {
            $operatorAuthRollout = Invoke-OpenClawAuthRolloutDiagnostic -BaseUrl $base -ScriptPath $openClawAuthDiagnosticScriptPath
            Write-Host "[INFO] operator auth rollout diagnosis=$($operatorAuthRollout.diagnosis) source=$($operatorAuthRollout.source) mode=$($operatorAuthRollout.mode) configured=$($operatorAuthRollout.configured)"
            if (-not $operatorAuthRollout.ok) {
                $results += [PSCustomObject]@{
                    Asset = 'operator-auth-rollout'
                    Match = $false
                    LocalHash = 'operator_auth_ready'
                    RemoteHash = "diagnosis=$($operatorAuthRollout.diagnosis);mode=$($operatorAuthRollout.mode);configured=$($operatorAuthRollout.configured)"
                    RemoteUrl = "$base/admin-auth.php?action=status"
                    Detail = [string]$operatorAuthRollout.nextAction
                }
            }
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
        Write-Host "[WARN] health no incluye checks.publicSync; el host probablemente sigue con HealthController stale"
        if ($RequireCronReady) {
            $results += [PSCustomObject]@{
                Asset = 'health-public-sync-missing'
                Match = $false
                LocalHash = 'present'
                RemoteHash = 'missing'
                RemoteUrl = $healthUrl
                Detail = 'health publico sin checks.publicSync; desplegar controllers/HealthController.php actualizado antes de clasificar public_main_sync'
            }
        }
    } else {
        $publicSyncConfigured = $false
        $publicSyncHealthy = $false
        $publicSyncJobId = ''
        $publicSyncJobKey = ''
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
        try { $publicSyncJobKey = [string]$publicSyncNode.jobKey } catch { $publicSyncJobKey = '' }
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
        $publicSyncHeadDrift = $false
        if ($healthSupportsDetailedChecks) {
            $publicSyncHeadDrift = (
                -not [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
                -not [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
                $publicSyncCurrentHead -ne $publicSyncRemoteHead
            )
        } else {
            try { $publicSyncHeadDrift = [bool]$publicSyncNode.headDrift } catch { $publicSyncHeadDrift = $false }
        }
        $publicSyncTelemetryGap = $false
        if ($healthSupportsDetailedChecks) {
            $publicSyncTelemetryGap = (
                -not $publicSyncHealthy -and
                -not [string]::IsNullOrWhiteSpace($publicSyncLastErrorMessage) -and
                [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
                [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
                $publicSyncDirtyPathsCount -le 0
            )
        }

        if ($publicSyncConfigured) {
            Write-Host "[OK]  public sync configurado (jobId=$publicSyncJobId, state=$publicSyncState, ageSeconds=$publicSyncAgeSeconds)"
        } else {
            Write-Host "[WARN] public sync no configurado"
        }

        if (-not [string]::IsNullOrWhiteSpace($publicSyncDeployedCommit)) {
            Write-Host "[INFO] public sync deployedCommit=$publicSyncDeployedCommit"
        }
        if (-not $healthSupportsDetailedChecks) {
            Write-Host '[INFO] public sync payload publico redactado; se omiten jobId/currentHead/remoteHead/dirtyPathsCount detallados'
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
            if ($healthSupportsDetailedChecks) {
                if ($publicSyncJobId -ne '8d31e299-7e57-4959-80b5-aaa2d73e9674') {
                    $results += [PSCustomObject]@{
                        Asset = 'health-public-sync-job-id'
                        Match = $false
                        LocalHash = '8d31e299-7e57-4959-80b5-aaa2d73e9674'
                        RemoteHash = if ($publicSyncJobId) { $publicSyncJobId } else { 'missing' }
                        RemoteUrl = $healthUrl
                    }
                }
            } elseif ($publicSyncJobKey -and $publicSyncJobKey -ne 'public_main_sync') {
                $results += [PSCustomObject]@{
                    Asset = 'health-public-sync-job-key'
                    Match = $false
                    LocalHash = 'public_main_sync'
                    RemoteHash = $publicSyncJobKey
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
            if ($healthSupportsDetailedChecks -and $publicSyncLastErrorMessage -eq 'working_tree_dirty') {
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
            if ($healthSupportsDetailedChecks -and $publicSyncTelemetryGap) {
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

    $githubDeployAlerts = Get-GitHubProductionAlertSummary `
        -Repo $GitHubRepo `
        -ApiBase $GitHubApiBase `
        -TimeoutSec $GitHubAlertsTimeoutSec `
        -IssueLimit $GitHubAlertsIssueLimit `
        -UserAgent 'PielArmoniaDeployCheck/1.0'
    $githubDeployAlertsFetchOk = $false
    $githubDeployAlertsRelevantCount = 0
    $githubDeployAlertsTransportCount = 0
    $githubDeployAlertsConnectivityCount = 0
    $githubDeployAlertsRepairGitSyncCount = 0
    $githubDeployAlertsSelfHostedRunnerCount = 0
    $githubDeployAlertsSelfHostedDeployCount = 0
    $githubDeployAlertsIssueNumbersLabel = 'none'
    $githubDeployAlertsIssueRefsLabel = 'none'
    $githubDeployAlertsApiUrl = ''
    $githubDeployAlertsError = ''
    $githubDeployAlertsHasTransportBlock = $false
    $githubDeployAlertsHasConnectivityBlock = $false
    $githubDeployAlertsHasRepairGitSyncBlock = $false
    $githubDeployAlertsHasSelfHostedRunnerBlock = $false
    $githubDeployAlertsHasSelfHostedDeployBlock = $false
    try { $githubDeployAlertsFetchOk = [bool]$githubDeployAlerts.fetchOk } catch { $githubDeployAlertsFetchOk = $false }
    try { $githubDeployAlertsRelevantCount = [int]$githubDeployAlerts.relevantCount } catch { $githubDeployAlertsRelevantCount = 0 }
    try { $githubDeployAlertsTransportCount = [int]$githubDeployAlerts.transportCount } catch { $githubDeployAlertsTransportCount = 0 }
    try { $githubDeployAlertsConnectivityCount = [int]$githubDeployAlerts.connectivityCount } catch { $githubDeployAlertsConnectivityCount = 0 }
    try { $githubDeployAlertsRepairGitSyncCount = [int]$githubDeployAlerts.repairGitSyncCount } catch { $githubDeployAlertsRepairGitSyncCount = 0 }
    try { $githubDeployAlertsSelfHostedRunnerCount = [int]$githubDeployAlerts.selfHostedRunnerCount } catch { $githubDeployAlertsSelfHostedRunnerCount = 0 }
    try { $githubDeployAlertsSelfHostedDeployCount = [int]$githubDeployAlerts.selfHostedDeployCount } catch { $githubDeployAlertsSelfHostedDeployCount = 0 }
    try { $githubDeployAlertsTurneroPilotCount = [int]$githubDeployAlerts.turneroPilotCount } catch { $githubDeployAlertsTurneroPilotCount = 0 }
    try { $githubDeployAlertsIssueNumbersLabel = [string]$githubDeployAlerts.issueNumbersLabel } catch { $githubDeployAlertsIssueNumbersLabel = 'none' }
    try { $githubDeployAlertsIssueRefsLabel = [string]$githubDeployAlerts.issueRefsLabel } catch { $githubDeployAlertsIssueRefsLabel = 'none' }
    try { $githubDeployAlertsApiUrl = [string]$githubDeployAlerts.apiUrl } catch { $githubDeployAlertsApiUrl = '' }
    try { $githubDeployAlertsError = [string]$githubDeployAlerts.error } catch { $githubDeployAlertsError = '' }
    try { $githubDeployAlertsHasTransportBlock = [bool]$githubDeployAlerts.hasTransportBlock } catch { $githubDeployAlertsHasTransportBlock = $false }
    try { $githubDeployAlertsHasConnectivityBlock = [bool]$githubDeployAlerts.hasConnectivityBlock } catch { $githubDeployAlertsHasConnectivityBlock = $false }
    try { $githubDeployAlertsHasRepairGitSyncBlock = [bool]$githubDeployAlerts.hasRepairGitSyncBlock } catch { $githubDeployAlertsHasRepairGitSyncBlock = $false }
    try { $githubDeployAlertsHasSelfHostedRunnerBlock = [bool]$githubDeployAlerts.hasSelfHostedRunnerBlock } catch { $githubDeployAlertsHasSelfHostedRunnerBlock = $false }
    try { $githubDeployAlertsHasSelfHostedDeployBlock = [bool]$githubDeployAlerts.hasSelfHostedDeployBlock } catch { $githubDeployAlertsHasSelfHostedDeployBlock = $false }
    try { $githubDeployAlertsHasTurneroPilotBlock = [bool]$githubDeployAlerts.hasTurneroPilotBlock } catch { $githubDeployAlertsHasTurneroPilotBlock = $false }

    Write-Host "[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk repo=$GitHubRepo relevantCount=$githubDeployAlertsRelevantCount transportCount=$githubDeployAlertsTransportCount connectivityCount=$githubDeployAlertsConnectivityCount repairGitSyncCount=$githubDeployAlertsRepairGitSyncCount selfHostedRunnerCount=$githubDeployAlertsSelfHostedRunnerCount selfHostedDeployCount=$githubDeployAlertsSelfHostedDeployCount turneroPilotCount=$githubDeployAlertsTurneroPilotCount turneroPilotRecoveryTargets=$turneroPilotRecoveryTargetsLabel issueNumbers=$githubDeployAlertsIssueNumbersLabel issueRefs=$githubDeployAlertsIssueRefsLabel"
    if (-not $githubDeployAlertsFetchOk) {
        Write-Host "[WARN] github.deployAlerts unreachable (repo=$GitHubRepo error=$githubDeployAlertsError)"
    } elseif ($githubDeployAlertsRelevantCount -gt 0) {
        $githubDeployAlertsSeverity = if ($AllowOpenGitHubDeployAlerts) { 'WARN' } else { 'FAIL' }
        Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts open production alerts (count=$githubDeployAlertsRelevantCount issueNumbers=$githubDeployAlertsIssueNumbersLabel)"
        if ($githubDeployAlertsHasTransportBlock) {
            Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts transport blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)"
        }
        if ($githubDeployAlertsHasConnectivityBlock) {
            Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts deploy connectivity blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)"
        }
        if ($githubDeployAlertsHasRepairGitSyncBlock) {
            Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts repair git sync blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)"
        }
        if ($githubDeployAlertsHasSelfHostedRunnerBlock) {
            Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts self-hosted runner blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)"
        }
        if ($githubDeployAlertsHasSelfHostedDeployBlock) {
            Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts self-hosted deploy blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)"
        }
        if ($githubDeployAlertsHasTurneroPilotBlock) {
            Write-Host "[$githubDeployAlertsSeverity] github.deployAlerts turnero pilot blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel recoveryTargets=$turneroPilotRecoveryTargetsLabel)"
        }

        if (-not $AllowOpenGitHubDeployAlerts) {
            $results += [PSCustomObject]@{
                Asset = 'github-deploy-alerts-open'
                Match = $false
                LocalHash = '0'
                RemoteHash = [string]$githubDeployAlertsRelevantCount
                RemoteUrl = $githubDeployAlertsApiUrl
            }
            if ($githubDeployAlertsHasTransportBlock) {
                $results += [PSCustomObject]@{
                    Asset = 'github-deploy-transport-blocked'
                    Match = $false
                    LocalHash = 'false'
                    RemoteHash = [string]$githubDeployAlertsTransportCount
                    RemoteUrl = $githubDeployAlertsApiUrl
                }
            }
            if ($githubDeployAlertsHasConnectivityBlock) {
                $results += [PSCustomObject]@{
                    Asset = 'github-deploy-connectivity-blocked'
                    Match = $false
                    LocalHash = 'false'
                    RemoteHash = [string]$githubDeployAlertsConnectivityCount
                    RemoteUrl = $githubDeployAlertsApiUrl
                }
            }
            if ($githubDeployAlertsHasRepairGitSyncBlock) {
                $results += [PSCustomObject]@{
                    Asset = 'github-deploy-repair-git-sync-blocked'
                    Match = $false
                    LocalHash = 'false'
                    RemoteHash = [string]$githubDeployAlertsRepairGitSyncCount
                    RemoteUrl = $githubDeployAlertsApiUrl
                }
            }
            if ($githubDeployAlertsHasSelfHostedRunnerBlock) {
                $results += [PSCustomObject]@{
                    Asset = 'github-deploy-self-hosted-runner-blocked'
                    Match = $false
                    LocalHash = 'false'
                    RemoteHash = [string]$githubDeployAlertsSelfHostedRunnerCount
                    RemoteUrl = $githubDeployAlertsApiUrl
                }
            }
            if ($githubDeployAlertsHasSelfHostedDeployBlock) {
                $results += [PSCustomObject]@{
                    Asset = 'github-deploy-self-hosted-deploy-blocked'
                    Match = $false
                    LocalHash = 'false'
                    RemoteHash = [string]$githubDeployAlertsSelfHostedDeployCount
                    RemoteUrl = $githubDeployAlertsApiUrl
                }
            }
            if ($githubDeployAlertsHasTurneroPilotBlock) {
                $results += [PSCustomObject]@{
                    Asset = 'github-deploy-turnero-pilot-blocked'
                    Match = $false
                    LocalHash = 'false'
                    RemoteHash = [string]$githubDeployAlertsTurneroPilotCount
                    RemoteUrl = $githubDeployAlertsApiUrl
                }
            }
        }
    } else {
        Write-Host '[OK]  github.deployAlerts sin incidentes abiertos'
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
    $healthErrorMessage = [string]$_.Exception.Message
    $healthDiagnosticsDenied = (
        -not $diagnosticsAuthConfigured -and (
            $healthErrorMessage -match '\(403\)' -or
            $healthErrorMessage -match 'HTTP 403'
        )
    )

    if ($healthDiagnosticsDenied) {
        Write-Host '[WARN] health-diagnostics protegido y sin token local; se omite validacion profunda.'
    } else {
        Write-Host "[FAIL] No se pudo validar health: $healthErrorMessage"
        $results += [PSCustomObject]@{
            Asset = "health-endpoint"
            Match = $false
            LocalHash = ''
            RemoteHash = ''
            RemoteUrl = $healthUrl
        }
    }
}

$turneroPilotStatusRaw = ''
$turneroPilotStatusExit = 0
$turneroPilotStatus = $null
$turneroPilotClinicId = ''
$turneroPilotProfileFingerprint = ''
$turneroPilotCatalogMatch = $false
$turneroPilotCatalogReady = $false
$turneroPilotCatalogEntryId = ''
$turneroPilotReleaseMode = ''
$turneroPilotAdminModeDefault = ''
$turneroPilotSeparateDeploy = $false
$turneroPilotNativeAppsBlocking = $false
$turneroPilotVerifyRequired = $false
$turneroPilotRemoteVerified = $false
$turneroPilotRemoteClinicId = ''
$turneroPilotRemoteFingerprint = ''
$turneroPilotRemoteCatalogReady = $false
$turneroPilotRemoteProfileSource = ''
$turneroPilotRemoteReleaseMode = ''
$turneroPilotRemoteAdminModeDefault = ''
$turneroPilotRemoteSeparateDeploy = $false
$turneroPilotRemoteNativeAppsBlocking = $false
$turneroPilotRemoteDeployedCommit = ''
$turneroPilotRemoteHealthRedacted = $false
$turneroPilotRemoteDiagnosticsAuthorized = $false
$turneroPilotRemoteResource = 'health'
$turneroPilotRecoveryTargets = @()
$turneroPilotRecoveryTargetsLabel = 'none'

if (Test-Path $turneroClinicProfileScriptPath) {

    try {
        $turneroPilotStatusRaw = ((& node $turneroClinicProfileScriptPath status --json 2>&1) | Out-String).Trim()
        $turneroPilotStatusExit = $LASTEXITCODE
        if (-not [string]::IsNullOrWhiteSpace($turneroPilotStatusRaw)) {
            $turneroPilotStatus = $turneroPilotStatusRaw | ConvertFrom-Json
        }
    } catch {
        $turneroPilotStatus = $null
    }

    if ($null -eq $turneroPilotStatus -or $turneroPilotStatusExit -ne 0) {
        Write-Host "[FAIL] No se pudo resolver el clinic-profile activo del turnero"
        $results += [PSCustomObject]@{
            Asset = 'turnero-pilot-profile-status'
            Match = $false
            LocalHash = 'status-ok'
            RemoteHash = if ($turneroPilotStatusRaw) { [string]$turneroPilotStatusRaw } else { 'status_failed' }
            RemoteUrl = $turneroClinicProfileScriptPath
        }
    } else {
        try { $turneroPilotClinicId = [string]$turneroPilotStatus.profile.clinic_id } catch { $turneroPilotClinicId = '' }
        try { $turneroPilotProfileFingerprint = [string]$turneroPilotStatus.profileFingerprint } catch { $turneroPilotProfileFingerprint = '' }
        try { $turneroPilotCatalogMatch = [bool]$turneroPilotStatus.matchesCatalog } catch { $turneroPilotCatalogMatch = $false }
        try { $turneroPilotCatalogReady = [bool]$turneroPilotStatus.catalogReady } catch { $turneroPilotCatalogReady = $false }
        try { $turneroPilotCatalogEntryId = [string]$turneroPilotStatus.matchingProfileId } catch { $turneroPilotCatalogEntryId = '' }
        try { $turneroPilotReleaseMode = [string]$turneroPilotStatus.profile.release.mode } catch { $turneroPilotReleaseMode = '' }
        try { $turneroPilotAdminModeDefault = [string]$turneroPilotStatus.profile.release.admin_mode_default } catch { $turneroPilotAdminModeDefault = '' }
        try { $turneroPilotSeparateDeploy = [bool]$turneroPilotStatus.profile.release.separate_deploy } catch { $turneroPilotSeparateDeploy = $false }
        try { $turneroPilotNativeAppsBlocking = [bool]$turneroPilotStatus.profile.release.native_apps_blocking } catch { $turneroPilotNativeAppsBlocking = $false }
        try { $turneroPilotVerifyRequired = ([bool]$turneroPilotStatus.ok) -and ([string]$turneroPilotStatus.profile.release.mode -eq 'web_pilot') } catch { $turneroPilotVerifyRequired = $false }

        if (-not $turneroPilotCatalogMatch) {
            Write-Host "[FAIL] turnero pilot local profile no coincide con catalogo"
            $results += [PSCustomObject]@{
                Asset = 'turnero-pilot-profile-status'
                Match = $false
                LocalHash = if ($turneroPilotClinicId) { $turneroPilotClinicId } else { 'clinic_id_missing' }
                RemoteHash = if ($turneroPilotStatus.matchingProfileId) { [string]$turneroPilotStatus.matchingProfileId } else { 'catalog_missing' }
                RemoteUrl = $turneroClinicProfileScriptPath
            }
        } elseif ($turneroPilotVerifyRequired) {
            $turneroPilotRecoveryTargets = @(
                '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado',
                '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'
            )
            $turneroPilotRecoveryTargetsLabel = ($turneroPilotRecoveryTargets -join '|')
            Write-Host "[INFO] turnero pilot profile active clinicId=$turneroPilotClinicId catalogMatch=$turneroPilotCatalogMatch"

            $turneroPilotVerifyRaw = ''
            $turneroPilotVerifyExit = 0
            $turneroPilotVerify = $null

            try {
                $turneroPilotVerifyRaw = ((& node $turneroClinicProfileScriptPath verify-remote --base-url $base --json 2>&1) | Out-String).Trim()
                $turneroPilotVerifyExit = $LASTEXITCODE
                if (-not [string]::IsNullOrWhiteSpace($turneroPilotVerifyRaw)) {
                    $turneroPilotVerify = $turneroPilotVerifyRaw | ConvertFrom-Json
                }
            } catch {
                $turneroPilotVerify = $null
            }

            $turneroPilotRemoteClinicId = ''
            $turneroPilotRemoteFingerprint = ''
            $turneroPilotRemoteCatalogReady = $false
            $turneroPilotRemoteDeployedCommit = ''
            $turneroPilotRemoteHealthRedacted = $false
            $turneroPilotRemoteDiagnosticsAuthorized = $false
            $turneroPilotRemoteResource = 'health'
            try { $turneroPilotRemoteClinicId = [string]$turneroPilotVerify.turneroPilot.clinicId } catch { $turneroPilotRemoteClinicId = '' }
            try { $turneroPilotRemoteFingerprint = [string]$turneroPilotVerify.turneroPilot.profileFingerprint } catch { $turneroPilotRemoteFingerprint = '' }
            try { $turneroPilotRemoteCatalogReady = [bool]$turneroPilotVerify.turneroPilot.catalogReady } catch { $turneroPilotRemoteCatalogReady = $false }
            try { $turneroPilotRemoteProfileSource = [string]$turneroPilotVerify.turneroPilot.profileSource } catch { $turneroPilotRemoteProfileSource = '' }
            try { $turneroPilotRemoteReleaseMode = [string]$turneroPilotVerify.turneroPilot.releaseMode } catch { $turneroPilotRemoteReleaseMode = '' }
            try { $turneroPilotRemoteAdminModeDefault = [string]$turneroPilotVerify.turneroPilot.adminModeDefault } catch { $turneroPilotRemoteAdminModeDefault = '' }
            try { $turneroPilotRemoteSeparateDeploy = [bool]$turneroPilotVerify.turneroPilot.separateDeploy } catch { $turneroPilotRemoteSeparateDeploy = $false }
            try { $turneroPilotRemoteNativeAppsBlocking = [bool]$turneroPilotVerify.turneroPilot.nativeAppsBlocking } catch { $turneroPilotRemoteNativeAppsBlocking = $false }
            try { $turneroPilotRemoteDeployedCommit = [string]$turneroPilotVerify.publicSync.deployedCommit } catch { $turneroPilotRemoteDeployedCommit = '' }
            try { $turneroPilotRemoteHealthRedacted = [bool]$turneroPilotVerify.publicHealthRedacted } catch { $turneroPilotRemoteHealthRedacted = $false }
            try { $turneroPilotRemoteDiagnosticsAuthorized = [bool]$turneroPilotVerify.diagnosticsAuthorized } catch { $turneroPilotRemoteDiagnosticsAuthorized = $false }
            try { $turneroPilotRemoteResource = [string]$turneroPilotVerify.remoteResource } catch { $turneroPilotRemoteResource = 'health' }

            Write-Host "[INFO] turnero pilot remote clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady deployedCommit=$turneroPilotRemoteDeployedCommit"
            Write-Host "[INFO] turnero pilot recoveryTargets=$turneroPilotRecoveryTargetsLabel"

            $turneroPilotRemoteVerificationBlocked = (
                $null -eq $turneroPilotVerify -or
                $turneroPilotVerifyExit -ne 0 -or
                -not [bool]$turneroPilotVerify.ok -or
                $turneroPilotRemoteHealthRedacted -or
                [string]::IsNullOrWhiteSpace($turneroPilotRemoteClinicId) -or
                [string]::IsNullOrWhiteSpace($turneroPilotRemoteFingerprint) -or
                -not $turneroPilotRemoteCatalogReady
            )

            if ($turneroPilotRemoteHealthRedacted) {
                Write-Host "[FAIL] turnero pilot remote health redacted (resource=$turneroPilotRemoteResource diagnosticsAuthorized=$turneroPilotRemoteDiagnosticsAuthorized)"
            } elseif (
                [string]::IsNullOrWhiteSpace($turneroPilotRemoteClinicId) -or
                [string]::IsNullOrWhiteSpace($turneroPilotRemoteFingerprint) -or
                -not $turneroPilotRemoteCatalogReady
            ) {
                Write-Host "[FAIL] turnero pilot remote identity unresolved (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)"
            }

            if ($turneroPilotRemoteVerificationBlocked) {
                $turneroPilotRemoteHash = if ($turneroPilotRemoteClinicId -or $turneroPilotRemoteFingerprint) {
                    "${turneroPilotRemoteClinicId}:${turneroPilotRemoteFingerprint}"
                } elseif ($turneroPilotRemoteHealthRedacted) {
                    "redacted:$turneroPilotRemoteResource"
                } elseif ($turneroPilotVerifyRaw) {
                    [string]$turneroPilotVerifyRaw
                } else {
                    'verify_failed'
                }
                $results += [PSCustomObject]@{
                    Asset = 'turnero-pilot-remote-verify'
                    Match = $false
                    LocalHash = if ($turneroPilotClinicId) { $turneroPilotClinicId } else { 'clinic_id_missing' }
                    RemoteHash = $turneroPilotRemoteHash
                    RemoteUrl = $healthUrl
                }
            } else {
                $turneroPilotRemoteVerified = $true
            }
        } else {
            Write-Host '[INFO] turnero pilot verify-remote omitido: perfil activo no esta en modo web_pilot.'
        }
    }
} else {
    Write-Host '[WARN] bin/turnero-clinic-profile.js no existe; se omite verify-remote del piloto.'
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
    & $smokeScriptPath -Domain $base `
        -TestFigoPost `
        -AllowDegradedFigo:$AllowDegradedFigo `
        -AllowRecursiveFigo:$AllowRecursiveFigo `
        -AllowMetaCspFallback:$AllowMetaCspFallback `
        -RequireWebhookSecret:$RequireWebhookSecret `
        -RequireCronReady:$RequireCronReady `
        -RequireTurneroWebSurfaces:$RequireTurneroWebSurfaces `
        -RequireTurneroOperatorPilot:$RequireTurneroOperatorPilot `
        -GitHubRepo $GitHubRepo `
        -GitHubApiBase $GitHubApiBase `
        -GitHubAlertsTimeoutSec $GitHubAlertsTimeoutSec `
        -GitHubAlertsIssueLimit $GitHubAlertsIssueLimit `
        -AllowOpenGitHubDeployAlerts:$AllowOpenGitHubDeployAlerts
}

$turneroPilotReport = [ordered]@{
    statusResolved = ($null -ne $turneroPilotStatus -and $turneroPilotStatusExit -eq 0)
    clinicId = $turneroPilotClinicId
    profileFingerprint = $turneroPilotProfileFingerprint
    catalogEntryId = $turneroPilotCatalogEntryId
    catalogMatch = $turneroPilotCatalogMatch
    catalogReady = $turneroPilotCatalogReady
    releaseMode = $turneroPilotReleaseMode
    adminModeDefault = $turneroPilotAdminModeDefault
    separateDeploy = $turneroPilotSeparateDeploy
    nativeAppsBlocking = $turneroPilotNativeAppsBlocking
    verifyRemoteRequired = $turneroPilotVerifyRequired
    recoveryTargets = @($turneroPilotRecoveryTargets)
    remoteVerified = $turneroPilotRemoteVerified
    remoteClinicId = $turneroPilotRemoteClinicId
    remoteProfileFingerprint = $turneroPilotRemoteFingerprint
    remoteCatalogReady = $turneroPilotRemoteCatalogReady
    remoteProfileSource = $turneroPilotRemoteProfileSource
    remoteReleaseMode = $turneroPilotRemoteReleaseMode
    remoteAdminModeDefault = $turneroPilotRemoteAdminModeDefault
    remoteSeparateDeploy = $turneroPilotRemoteSeparateDeploy
    remoteNativeAppsBlocking = $turneroPilotRemoteNativeAppsBlocking
    remoteDeployedCommit = $turneroPilotRemoteDeployedCommit
    remotePublicHealthRedacted = $turneroPilotRemoteHealthRedacted
    remoteDiagnosticsAuthorized = $turneroPilotRemoteDiagnosticsAuthorized
    remoteResource = $turneroPilotRemoteResource
}

$adminSurfaceParityReport = [ordered]@{
    admin = [ordered]@{
        url = $adminSurfaceUrl
        ok = ($null -ne $adminSurfaceResp -and $adminSurfaceResp.Ok)
        httpStatus = if ($null -ne $adminSurfaceResp) { $adminSurfaceResp.StatusCode } else { 0 }
        error = if ($null -ne $adminSurfaceResp) { [string]$adminSurfaceResp.Error } else { '' }
        versions = [pscustomobject]$adminSurfaceVersions
    }
    operator = [ordered]@{
        url = $turneroOperatorSurfaceUrl
        ok = ($null -ne $turneroOperatorSurfaceResp -and $turneroOperatorSurfaceResp.Ok)
        httpStatus = if ($null -ne $turneroOperatorSurfaceResp) { $turneroOperatorSurfaceResp.StatusCode } else { 0 }
        error = if ($null -ne $turneroOperatorSurfaceResp) { [string]$turneroOperatorSurfaceResp.Error } else { '' }
        versions = [pscustomobject]$operatorSurfaceVersions
    }
    serviceWorker = [ordered]@{
        url = $serviceWorkerUrl
        ok = ($null -ne $serviceWorkerResp -and $serviceWorkerResp.Ok)
        httpStatus = if ($null -ne $serviceWorkerResp) { $serviceWorkerResp.StatusCode } else { 0 }
        error = if ($null -ne $serviceWorkerResp) { [string]$serviceWorkerResp.Error } else { '' }
        cacheName = $serviceWorkerCacheName
        versions = [pscustomobject]$serviceWorkerVersions
    }
    adminShellVsSwOk = $adminSurfaceVsSwOk
    operatorShellVsSwOk = $operatorSurfaceVsSwOk
    mismatches = @($adminSurfaceParityMismatches)
}

$verifyMetadata = [ordered]@{
    turneroPilot = [pscustomobject]$turneroPilotReport
    adminSurfaceParity = [pscustomobject]$adminSurfaceParityReport
}

$failed = @($results | Where-Object { $_.Match -ne $true }).Count
Write-VerifyReport -Path $ReportPath -Domain $base -Results $results -FailedCount $failed -Metadata $verifyMetadata
if ($failed -gt 0) {
    Write-Host ""
    Write-Host "Resultado: $failed falla(s) detectadas."
    exit 1
}

Write-Host ""
Write-Host "Resultado: verificacion de despliegue OK."
exit 0
