param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$RunSmoke,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$AllowMetaCspFallback,
    [switch]$RequireWebhookSecret,
    [switch]$RequireBackupHealthy,
    [switch]$RequireStableDataDir,
    [int]$MaxHealthTimingMs = 2000,
    [int]$AssetHashRetryCount = 2,
    [int]$AssetHashRetryDelaySec = 4,
    [switch]$SkipAssetHashChecks,
    [string]$ReportPath = 'verification/last-deploy-verify.json'
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')

function Get-RefFromIndex {
    param(
        [string]$IndexHtml,
        [string]$Pattern
    )

    $match = [regex]::Match($IndexHtml, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if (-not $match.Success) {
        return ''
    }
    return $match.Groups[1].Value
}

function Get-Url {
    param(
        [string]$Base,
        [string]$Ref
    )

    if ([string]::IsNullOrWhiteSpace($Ref)) {
        return ''
    }
    if ($Ref.StartsWith('http://') -or $Ref.StartsWith('https://')) {
        return $Ref
    }
    if ($Ref.StartsWith('/')) {
        return "$Base$Ref"
    }
    return "$Base/$Ref"
}

function Get-RefPath {
    param([string]$Ref)

    if ([string]::IsNullOrWhiteSpace($Ref)) {
        return ''
    }

    $clean = $Ref.Trim()
    $hashIndex = $clean.IndexOf('#')
    if ($hashIndex -ge 0) {
        $clean = $clean.Substring(0, $hashIndex)
    }

    $queryIndex = $clean.IndexOf('?')
    if ($queryIndex -ge 0) {
        $clean = $clean.Substring(0, $queryIndex)
    }

    return $clean
}

function Add-QueryParam {
    param(
        [string]$Url,
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Url) -or [string]::IsNullOrWhiteSpace($Name) -or [string]::IsNullOrWhiteSpace($Value)) {
        return $Url
    }

    try {
        $uri = [Uri]$Url
        $pathAndQuery = $uri.PathAndQuery
        $separator = if ($pathAndQuery.Contains('?')) { '&' } else { '?' }
        return "$Url$separator$Name=$([Uri]::EscapeDataString($Value))"
    } catch {
        $separator = if ($Url.Contains('?')) { '&' } else { '?' }
        return "$Url$separator$Name=$([Uri]::EscapeDataString($Value))"
    }
}

function Get-CacheBypassUrl {
    param(
        [string]$Url,
        [string]$AssetName,
        [int]$Attempt = 0
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return $Url
    }

    $safeAsset = if ([string]::IsNullOrWhiteSpace($AssetName)) { 'asset' } else { $AssetName }
    $nonce = "$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())-$safeAsset-$Attempt"
    $withVerify = Add-QueryParam -Url $Url -Name 'verify' -Value $nonce
    return Add-QueryParam -Url $withVerify -Name 'ha' -Value "$Attempt"
}

function Get-RemoteSha256 {
    param(
        [string]$Url,
        [switch]$NormalizeText
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return ''
    }

    $tmp = New-TemporaryFile
    try {
        curl.exe -sS -L --max-time 20 --connect-timeout 8 -o $tmp $Url | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo descargar $Url"
        }

        if ($NormalizeText) {
            $text = [string](Get-Content -Path $tmp -Raw)
            $normalized = $text -replace "`r`n", "`n" -replace "`r", "`n"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
            $sha = [System.Security.Cryptography.SHA256]::Create()
            return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
        }

        return (Get-FileHash -Algorithm SHA256 -Path $tmp).Hash.ToLowerInvariant()
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
    }
}

function Get-LocalSha256 {
    param(
        [string]$Path,
        [switch]$NormalizeText
    )
    if (-not (Test-Path $Path)) {
        return ''
    }

    if ($NormalizeText) {
        $text = [string](Get-Content -Path $Path -Raw)
        $normalized = $text -replace "`r`n", "`n" -replace "`r", "`n"
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }

    return (Get-FileHash -Algorithm SHA256 -Path $Path).Hash.ToLowerInvariant()
}

function Resolve-LocalAssetPath {
    param(
        [string]$PrimaryPath,
        [string[]]$FallbackPaths = @()
    )

    if (-not [string]::IsNullOrWhiteSpace($PrimaryPath) -and (Test-Path $PrimaryPath)) {
        return $PrimaryPath
    }

    foreach ($candidate in $FallbackPaths) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }
        if (Test-Path $candidate) {
            return $candidate
        }
    }

    return ''
}

function Get-ScriptVersionedRef {
    param(
        [string]$ScriptText,
        [string]$FileName
    )

    if ([string]::IsNullOrWhiteSpace($ScriptText) -or [string]::IsNullOrWhiteSpace($FileName)) {
        return ''
    }

    $escaped = [regex]::Escape($FileName)
    $pattern = "([/a-zA-Z0-9._-]*$escaped\?v=[a-zA-Z0-9._-]+)"
    $match = [regex]::Match($ScriptText, $pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($match.Success) {
        return $match.Groups[1].Value
    }
    return ''
}

function Get-LocalSha256FromGitHeadOrFile {
    param(
        [string]$Path,
        [switch]$NormalizeText
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return ''
    }

    $gitPath = $Path.Replace('\', '/')
    try {
        $headContent = & git show --no-textconv "HEAD:$gitPath" 2>$null
        if ($LASTEXITCODE -eq 0 -and $null -ne $headContent) {
            $text = if ($headContent -is [System.Array]) {
                [string]::Join("`n", $headContent)
            } else {
                [string]$headContent
            }
            if ($NormalizeText) {
                $normalized = $text -replace "`r`n", "`n" -replace "`r", "`n"
                $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
                $sha = [System.Security.Cryptography.SHA256]::Create()
                return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
            }
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
            $sha = [System.Security.Cryptography.SHA256]::Create()
            return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
        }
    } catch {
        # Fallback below
    }

    return Get-LocalSha256 -Path $Path -NormalizeText:$NormalizeText
}

function Get-RemoteText {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return ''
    }

    $tmp = New-TemporaryFile
    try {
        curl.exe -sS -L --max-time 20 --connect-timeout 8 -o $tmp $Url | Out-Null
        if ($LASTEXITCODE -ne 0) {
            return ''
        }
        return [string](Get-Content -Path $tmp -Raw)
    } catch {
        return ''
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
    }
}

function Invoke-JsonGet {
    param([string]$Url)

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaDeployCheck/1.0'
        }

        $status = [int]$resp.StatusCode
        $body = [string]$resp.Content
        if ($status -lt 200 -or $status -ge 300) {
            throw "HTTP $status en $Url"
        }

        try {
            $json = $body | ConvertFrom-Json
        } catch {
            throw "La respuesta de $Url no es JSON valido"
        }

        return [PSCustomObject]@{
            Status = $status
            Body = $body
            Json = $json
        }
    } catch {
        throw
    }
}

function Get-LocalGitHeadInfo {
    try {
        $hashRaw = (& git rev-parse --short HEAD 2>$null)
        $epochRaw = (& git log -1 --format=%ct HEAD 2>$null)
        if ($LASTEXITCODE -ne 0) {
            return $null
        }

        $hash = [string]$hashRaw
        $epochText = [string]$epochRaw
        if ([string]::IsNullOrWhiteSpace($hash) -or [string]::IsNullOrWhiteSpace($epochText)) {
            return $null
        }

        $commitEpoch = 0L
        if (-not [long]::TryParse($epochText.Trim(), [ref]$commitEpoch)) {
            return $null
        }

        $commitUtc = [DateTimeOffset]::FromUnixTimeSeconds($commitEpoch).UtcDateTime
        return [PSCustomObject]@{
            Hash = $hash.Trim()
            CommitUtc = $commitUtc
            CommitEpoch = $commitEpoch
        }
    } catch {
        return $null
    }
}

function Test-HeadTouchesFrontendAssets {
    try {
        $changedRaw = (& git diff --name-only HEAD~1 HEAD 2>$null)
        if ($LASTEXITCODE -ne 0 -or $null -eq $changedRaw) {
            return $true
        }

        $changedFiles = @($changedRaw | ForEach-Object {
            $line = [string]$_
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                $line.Trim().Replace('\', '/')
            }
        } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })

        if ($changedFiles.Count -eq 0) {
            return $true
        }

        $frontendPatterns = @(
            '^index\.html$',
            '^script\.js$',
            '^styles\.css$',
            '^styles-deferred\.css$',
            '^js/engines/',
            '^js/main\.js$',
            '^src/apps/',
            '^src/styles/',
            '^rollup\.config\.mjs$'
        )

        foreach ($file in $changedFiles) {
            foreach ($pattern in $frontendPatterns) {
                if ($file -match $pattern) {
                    return $true
                }
            }
        }

        return $false
    } catch {
        return $true
    }
}

function Get-HeadChangedFiles {
    try {
        $changedRaw = (& git diff --name-only HEAD~1 HEAD 2>$null)
        if ($LASTEXITCODE -ne 0 -or $null -eq $changedRaw) {
            return $null
        }

        return @($changedRaw | ForEach-Object {
            $line = [string]$_
            if (-not [string]::IsNullOrWhiteSpace($line)) {
                $line.Trim().Replace('\', '/')
            }
        } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    } catch {
        return $null
    }
}

function Test-ChangedFilesMatchPatterns {
    param(
        [string[]]$ChangedFiles,
        [string[]]$Patterns
    )

    if ($null -eq $ChangedFiles -or $ChangedFiles.Count -eq 0) {
        return $false
    }
    foreach ($file in $ChangedFiles) {
        foreach ($pattern in $Patterns) {
            if ($file -match $pattern) {
                return $true
            }
        }
    }
    return $false
}

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

$changedFiles = Get-HeadChangedFiles
$changedFilesKnown = ($null -ne $changedFiles)
$headTouchesFrontendAssets = $true
$headTouchesScriptFamily = $true
$headTouchesStyles = $true
$headTouchesDeferredStyles = $true
$headTouchesIndex = $true
$changedEngineAssets = @()
$headTouchesEngineAssets = $false

if ($changedFilesKnown) {
    $headTouchesFrontendAssets = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @(
        '^index\.html$',
        '^script\.js$',
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
        '^js/main\.js$',
        '^js/(loader|state|utils|main)\.js$',
        '^src/bundles/ui\.js$',
        '^rollup\.config\.mjs$'
    )
    $changedEngineAssets = @(
        $changedFiles | Where-Object { $_ -match '^js/engines/.+\.js$' }
    )
    $headTouchesEngineAssets = $changedEngineAssets.Count -gt 0
    $headTouchesStyles = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^styles\.css$')
    $headTouchesDeferredStyles = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^styles-deferred\.css$')
    $headTouchesIndex = Test-ChangedFilesMatchPatterns -ChangedFiles $changedFiles -Patterns @('^index\.html$')
}

if (-not $headTouchesFrontendAssets -and $changedFilesKnown) {
    $deployFreshnessFailRequired = $false
    Write-Host "[INFO] Deploy freshness en modo advisory: HEAD no cambia assets frontend."
}

$indexRaw = Get-Content -Path 'index.html' -Raw
$localScriptRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<script[^>]+src="([^"]*script\.js[^"]*)"'
$localStyleRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<link[^>]+href="([^"]*styles\.css[^"]*)"'
$localDeferredStyleRef = Get-RefFromIndex -IndexHtml $indexRaw -Pattern '<link[^>]+href="([^"]*styles-deferred\.css[^"]*)"'
$localHasInlineCriticalCss = [regex]::IsMatch($indexRaw, '<style\b[^>]*>[\s\S]*?</style>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)

if ($localScriptRef -eq '') {
    throw 'No se pudo detectar referencia de script.js en index.html'
}
if ($localStyleRef -eq '' -and $localDeferredStyleRef -eq '' -and -not $localHasInlineCriticalCss) {
    throw 'No se detecto CSS cargado desde index.html (styles.css, styles-deferred.css o inline)'
}

$remoteIndexRaw = ''
$remoteIndexCandidates = @("$base/", "$base/index.html")
foreach ($candidateUrl in $remoteIndexCandidates) {
    $remoteIndexTmp = New-TemporaryFile
    try {
        curl.exe -sS -L --max-time 20 --connect-timeout 8 -o $remoteIndexTmp $candidateUrl | Out-Null
        if ($LASTEXITCODE -ne 0) {
            continue
        }
        $candidateHtml = [string](Get-Content -Path $remoteIndexTmp -Raw)
        if ([regex]::IsMatch($candidateHtml, 'script\.js', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
            $remoteIndexRaw = $candidateHtml
            break
        }
        if ($remoteIndexRaw -eq '') {
            $remoteIndexRaw = $candidateHtml
        }
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $remoteIndexTmp
    }
}
$remoteIndexRaw = [string]$remoteIndexRaw
if ($null -eq $remoteIndexRaw) {
    $remoteIndexRaw = ''
}

$results = @()

try {
    $homeResp = $null
    $homeCandidates = @("$base/", "$base/index.html")
    foreach ($homeCandidate in $homeCandidates) {
        try {
            $candidateResp = Invoke-WebRequest -Uri $homeCandidate -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
                'Cache-Control' = 'no-cache'
                'User-Agent' = 'PielArmoniaDeployCheck/1.0'
            }
            if ($candidateResp -and [int]$candidateResp.StatusCode -ge 200 -and [int]$candidateResp.StatusCode -lt 300) {
                $homeResp = $candidateResp
                break
            }
        } catch {
            continue
        }
    }
    if ($null -eq $homeResp) {
        throw 'No se pudo obtener una respuesta 2xx desde / o /index.html'
    }

    $requiredSecurityHeaders = @(
        'Content-Security-Policy',
        'X-Content-Type-Options',
        'Referrer-Policy'
    )
    $homeHtml = ''
    try { $homeHtml = [string]$homeResp.Content } catch { $homeHtml = '' }
    foreach ($headerName in $requiredSecurityHeaders) {
        if ($null -ne $homeResp.Headers[$headerName]) {
            Write-Host "[OK]  header presente: $headerName"
        } else {
            if ($headerName -eq 'Content-Security-Policy' -and $AllowMetaCspFallback -and [regex]::IsMatch($homeHtml, '<meta[^>]+http-equiv\s*=\s*["'']Content-Security-Policy["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                Write-Host "[WARN] header ausente: $headerName (fallback temporal por meta-CSP)"
                continue
            }
            Write-Host "[FAIL] header ausente: $headerName"
            $results += [PSCustomObject]@{
                Asset = "header:$headerName"
                Match = $false
                LocalHash = 'required'
                RemoteHash = 'missing'
                RemoteUrl = "$base/"
            }
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de seguridad: $($_.Exception.Message)"
    $results += [PSCustomObject]@{
        Asset = 'headers:security'
        Match = $false
        LocalHash = ''
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
}

$remoteScriptRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<script[^>]+src="([^"]*script\.js[^"]*)"'
$remoteStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<link[^>]+href="([^"]*styles\.css[^"]*)"'
$remoteDeferredStyleRef = Get-RefFromIndex -IndexHtml $remoteIndexRaw -Pattern '<link[^>]+href="([^"]*styles-deferred\.css[^"]*)"'
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

try {
    $deployFreshnessProbeName = 'app-script'
    $deployFreshnessProbeUrl = $appScriptRemoteUrl
    if ($headTouchesEngineAssets) {
        $engineProbePath = [string]$changedEngineAssets[0]
        $deployFreshnessProbeName = "engine:$engineProbePath"
        $deployFreshnessProbeUrl = Get-Url -Base $base -Ref $engineProbePath
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
            $scriptHeadResp = Invoke-WebRequest -Uri $deployFreshnessProbeUrl -Method HEAD -TimeoutSec 20 -UseBasicParsing -Headers @{
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

try {
    $assetHeaderChecks = @(
        @{ Name = 'app-script'; Url = $appScriptRemoteUrl }
    )
    if (-not [string]::IsNullOrWhiteSpace($criticalCssRemoteUrl)) {
        $assetHeaderChecks += @{ Name = 'critical-css'; Url = $criticalCssRemoteUrl }
    } elseif (-not [string]::IsNullOrWhiteSpace($indexDeferredStylesRemoteUrl)) {
        $assetHeaderChecks += @{ Name = 'critical-css-fallback'; Url = $indexDeferredStylesRemoteUrl }
    }
    foreach ($assetCheck in $assetHeaderChecks) {
        if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
            continue
        }
        $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaDeployCheck/1.0'
        }
        $cacheHeader = [string]$assetResp.Headers['Cache-Control']
        if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
            Write-Host "[FAIL] asset sin Cache-Control con max-age: $($assetCheck.Name)"
            $results += [PSCustomObject]@{
                Asset = "cache-header:$($assetCheck.Name)"
                Match = $false
                LocalHash = 'max-age'
                RemoteHash = if ($cacheHeader) { $cacheHeader } else { 'missing' }
                RemoteUrl = $assetCheck.Url
            }
        } else {
            Write-Host "[OK]  cache header correcto en: $($assetCheck.Name)"
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de cache de assets"
    $results += [PSCustomObject]@{
        Asset = 'cache-header:assets'
        Match = $false
        LocalHash = 'max-age'
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
}

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

$localScriptTextForRefs = Get-Content -Path 'script.js' -Raw
$localI18nEngineTextForRefs = if (Test-Path 'i18n-engine.js') { Get-Content -Path 'i18n-engine.js' -Raw } else { '' }
$localRescheduleGatewayTextForRefs = if (Test-Path 'reschedule-gateway-engine.js') { Get-Content -Path 'reschedule-gateway-engine.js' -Raw } else { '' }
$chatEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'chat-engine.js'
$chatEngineRemoteUrl = if ($chatEngineRef -ne '') {
    Get-Url -Base $base -Ref $chatEngineRef
} elseif ((Test-Path 'chat-engine.js') -or (Test-Path 'js/engines/chat-engine.js')) {
    "$base/js/engines/chat-engine.js"
} else {
    ''
}

$chatUiEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'chat-ui-engine.js'
$chatUiEngineRemoteUrl = if ($chatUiEngineRef -ne '') {
    Get-Url -Base $base -Ref $chatUiEngineRef
} elseif ((Test-Path 'chat-ui-engine.js') -or (Test-Path 'js/engines/chat-ui-engine.js')) {
    "$base/js/engines/chat-ui-engine.js"
} else {
    ''
}

$chatWidgetEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'chat-widget-engine.js'
$chatWidgetEngineRemoteUrl = if ($chatWidgetEngineRef -ne '') {
    Get-Url -Base $base -Ref $chatWidgetEngineRef
} elseif ((Test-Path 'chat-widget-engine.js') -or (Test-Path 'js/engines/chat-widget-engine.js')) {
    "$base/js/engines/chat-widget-engine.js"
} else {
    ''
}

$deferredStylesRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'styles-deferred.css'
$deferredStylesRemoteUrl = if ($indexDeferredStylesRemoteUrl -ne '') {
    $indexDeferredStylesRemoteUrl
} elseif ($deferredStylesRef -ne '') {
    Get-Url -Base $base -Ref $deferredStylesRef
} elseif (Test-Path 'styles-deferred.css') {
    "$base/styles-deferred.css"
} else {
    ''
}

function Write-VerifyReport {
    param(
        [string]$Path,
        [string]$Domain,
        [Object[]]$Results,
        [int]$FailedCount
    )

    try {
        $reportDir = Split-Path -Path $Path -Parent
        if (-not [string]::IsNullOrWhiteSpace($reportDir) -and -not (Test-Path $reportDir)) {
            New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
        }

        $report = [PSCustomObject]@{
            generatedAt = (Get-Date).ToString('o')
            domain = $Domain
            failed = $FailedCount
            total = @($Results).Count
            ok = [Math]::Max(0, (@($Results).Count - $FailedCount))
            failures = @($Results | Where-Object { $_.Match -ne $true })
            checks = @($Results)
        }

        $report | ConvertTo-Json -Depth 12 | Set-Content -Path $Path -Encoding UTF8
        Write-Host "[INFO] reporte de verificacion guardado: $Path"
    } catch {
        Write-Host "[WARN] no se pudo escribir reporte de verificacion: $($_.Exception.Message)"
    }
}
if (-not [string]::IsNullOrWhiteSpace($deferredStylesRemoteUrl)) {
    if ($deferredStylesRemoteUrl -match '\?') {
        $deferredStylesRemoteUrl = "$deferredStylesRemoteUrl&verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
    } else {
        $deferredStylesRemoteUrl = "$deferredStylesRemoteUrl?verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
    }
}

$translationsEnRef = Get-ScriptVersionedRef -ScriptText $localI18nEngineTextForRefs -FileName 'translations-en.js'
if ($translationsEnRef -eq '') {
    $translationsEnRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'translations-en.js'
}
$hasTranslationsEnAsset = ($translationsEnRef -ne '') -or (Test-Path 'translations-en.js')
$translationsEnRemoteUrl = if ($translationsEnRef -ne '') {
    Get-Url -Base $base -Ref $translationsEnRef
} elseif (Test-Path 'translations-en.js') {
    "$base/translations-en.js"
} else {
    ''
}
if (-not $hasTranslationsEnAsset) {
    Write-Host '[INFO] translations-en.js no se detecta en local; se omite verificacion de hash.'
}

$bookingEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'booking-engine.js'
$bookingEngineRemoteUrl = if ($bookingEngineRef -ne '') {
    Get-Url -Base $base -Ref $bookingEngineRef
} elseif ((Test-Path 'booking-engine.js') -or (Test-Path 'js/engines/booking-engine.js')) {
    "$base/js/engines/booking-engine.js"
} else {
    ''
}

$analyticsEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'analytics-engine.js'
$analyticsEngineRemoteUrl = if ($analyticsEngineRef -ne '') {
    Get-Url -Base $base -Ref $analyticsEngineRef
} elseif (Test-Path 'js/engines/analytics-engine.js') {
    "$base/js/engines/analytics-engine.js"
} else {
    ''
}

$uiEffectsRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'ui-effects.js'
$uiEffectsRemoteUrl = if ($uiEffectsRef -ne '') {
    Get-Url -Base $base -Ref $uiEffectsRef
} elseif (Test-Path 'ui-effects.js') {
    "$base/ui-effects.js"
} else {
    ''
}

$galleryInteractionsRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'gallery-interactions.js'
$galleryInteractionsRemoteUrl = if ($galleryInteractionsRef -ne '') {
    Get-Url -Base $base -Ref $galleryInteractionsRef
} elseif (Test-Path 'js/engines/gallery-interactions.js') {
    "$base/js/engines/gallery-interactions.js"
} else {
    ''
}

$rescheduleEngineRef = Get-ScriptVersionedRef -ScriptText $localRescheduleGatewayTextForRefs -FileName 'reschedule-engine.js'
if ($rescheduleEngineRef -eq '') {
    $rescheduleEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'reschedule-engine.js'
}
$rescheduleEngineRemoteUrl = if ($rescheduleEngineRef -ne '') {
    Get-Url -Base $base -Ref $rescheduleEngineRef
} elseif (Test-Path 'reschedule-engine.js') {
    "$base/reschedule-engine.js"
} else {
    ''
}

$bookingUiRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'booking-ui.js'
$bookingUiRemoteUrl = if ($bookingUiRef -ne '') {
    Get-Url -Base $base -Ref $bookingUiRef
} elseif ((Test-Path 'booking-ui.js') -or (Test-Path 'js/engines/booking-ui.js')) {
    "$base/js/engines/booking-ui.js"
} else {
    ''
}

$chatBookingEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'chat-booking-engine.js'
$chatBookingEngineRemoteUrl = if ($chatBookingEngineRef -ne '') {
    Get-Url -Base $base -Ref $chatBookingEngineRef
} elseif ((Test-Path 'chat-booking-engine.js') -or (Test-Path 'js/engines/chat-booking-engine.js')) {
    "$base/js/engines/chat-booking-engine.js"
} else {
    ''
}

$successModalEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'success-modal-engine.js'
$successModalEngineRemoteUrl = if ($successModalEngineRef -ne '') {
    Get-Url -Base $base -Ref $successModalEngineRef
} elseif (Test-Path 'success-modal-engine.js') {
    "$base/success-modal-engine.js"
} else {
    ''
}

$engagementFormsEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'engagement-forms-engine.js'
$engagementFormsEngineRemoteUrl = if ($engagementFormsEngineRef -ne '') {
    Get-Url -Base $base -Ref $engagementFormsEngineRef
} elseif (Test-Path 'engagement-forms-engine.js') {
    "$base/engagement-forms-engine.js"
} else {
    ''
}

$modalUxEngineRef = Get-ScriptVersionedRef -ScriptText $localScriptTextForRefs -FileName 'modal-ux-engine.js'
$modalUxEngineRemoteUrl = if ($modalUxEngineRef -ne '') {
    Get-Url -Base $base -Ref $modalUxEngineRef
} elseif (Test-Path 'modal-ux-engine.js') {
    "$base/modal-ux-engine.js"
} else {
    ''
}

try {
    $assetHeaderChecks = @(
        @{ Name = 'chat-widget-engine'; Url = $chatWidgetEngineRemoteUrl },
        @{ Name = 'chat-engine'; Url = $chatEngineRemoteUrl },
        @{ Name = 'chat-ui-engine'; Url = $chatUiEngineRemoteUrl },
        @{ Name = 'styles-deferred'; Url = $deferredStylesRemoteUrl },
        @{ Name = 'translations-en'; Url = $translationsEnRemoteUrl },
        @{ Name = 'booking-engine'; Url = $bookingEngineRemoteUrl },
        @{ Name = 'booking-ui'; Url = $bookingUiRemoteUrl },
        @{ Name = 'chat-booking-engine'; Url = $chatBookingEngineRemoteUrl },
        @{ Name = 'success-modal-engine'; Url = $successModalEngineRemoteUrl },
        @{ Name = 'engagement-forms-engine'; Url = $engagementFormsEngineRemoteUrl },
        @{ Name = 'modal-ux-engine'; Url = $modalUxEngineRemoteUrl },
        @{ Name = 'reschedule-engine'; Url = $rescheduleEngineRemoteUrl },
        @{ Name = 'ui-effects'; Url = $uiEffectsRemoteUrl },
        @{ Name = 'gallery-interactions'; Url = $galleryInteractionsRemoteUrl }
    )
    foreach ($assetCheck in $assetHeaderChecks) {
        if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
            continue
        }
        $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaDeployCheck/1.0'
        }
        $cacheHeader = [string]$assetResp.Headers['Cache-Control']
        if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
            Write-Host "[FAIL] asset sin Cache-Control con max-age: $($assetCheck.Name)"
            $results += [PSCustomObject]@{
                Asset = "cache-header:$($assetCheck.Name)"
                Match = $false
                LocalHash = 'max-age'
                RemoteHash = if ($cacheHeader) { $cacheHeader } else { 'missing' }
                RemoteUrl = $assetCheck.Url
            }
        } else {
            Write-Host "[OK]  cache header correcto en: $($assetCheck.Name)"
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de cache de assets secundarios"
    $results += [PSCustomObject]@{
        Asset = 'cache-header:assets-secondary'
        Match = $false
        LocalHash = 'max-age'
        RemoteHash = ''
        RemoteUrl = "$base/"
    }
}

if ([regex]::IsMatch([string]$remoteIndexRaw, '<[a-zA-Z][^>]*\son[a-z]+\s*=', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    Write-Host "[FAIL] index remoto contiene event handlers inline (on*)"
    $results += [PSCustomObject]@{
        Asset = 'index-inline-handlers'
        Match = $false
        LocalHash = 'none'
        RemoteHash = 'found'
        RemoteUrl = "$base/"
    }
} else {
    Write-Host "[OK]  index remoto sin handlers inline (on*)"
}

$inlineExecutableScriptPattern = '<script\b(?![^>]*\bsrc=)(?![^>]*\btype\s*=\s*["'']application/ld\+json["''])[^>]*>[\s\S]*?</script>'
if ([regex]::IsMatch([string]$remoteIndexRaw, $inlineExecutableScriptPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
    Write-Host "[FAIL] index remoto contiene scripts inline ejecutables"
    $results += [PSCustomObject]@{
        Asset = 'index-inline-executable-script'
        Match = $false
        LocalHash = 'none'
        RemoteHash = 'found'
        RemoteUrl = "$base/"
    }
} else {
    Write-Host "[OK]  index remoto sin scripts inline ejecutables"
}

if ($remoteScriptRef -eq '') {
    Write-Host "[FAIL] No se pudo detectar referencia de script.js en index remoto"
    $results += [PSCustomObject]@{
        Asset = 'index-asset-refs:script'
        Match = $false
        LocalHash = $localScriptRef
        RemoteHash = $remoteScriptRef
        RemoteUrl = "$base/"
    }
} elseif ((Get-RefPath -Ref $remoteScriptRef) -eq (Get-RefPath -Ref $localScriptRef)) {
    Write-Host "[OK]  index remoto usa misma referencia de script.js"
} else {
    Write-Host "[FAIL] index remoto script.js diferente"
    Write-Host "       Local : $localScriptRef"
    Write-Host "       Remote: $remoteScriptRef"
    $results += [PSCustomObject]@{
        Asset = 'index-ref:script.js'
        Match = $false
        LocalHash = $localScriptRef
        RemoteHash = $remoteScriptRef
        RemoteUrl = "$base/"
    }
}

if ($localStyleRef -ne '') {
    if ($remoteStyleRef -eq '') {
        Write-Host "[FAIL] index remoto sin referencia de styles.css"
        $results += [PSCustomObject]@{
            Asset = 'index-asset-refs:styles.css'
            Match = $false
            LocalHash = $localStyleRef
            RemoteHash = ''
            RemoteUrl = "$base/"
        }
    } elseif ($remoteStyleRef -eq $localStyleRef) {
        Write-Host "[OK]  index remoto usa misma referencia de styles.css"
    } else {
        Write-Host "[FAIL] index remoto styles.css diferente"
        Write-Host "       Local : $localStyleRef"
        Write-Host "       Remote: $remoteStyleRef"
        $results += [PSCustomObject]@{
            Asset = 'index-ref:styles.css'
            Match = $false
            LocalHash = $localStyleRef
            RemoteHash = $remoteStyleRef
            RemoteUrl = "$base/"
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
        if ($remoteDeferredStyleRef -eq '') {
            Write-Host "[FAIL] index remoto sin referencia de styles-deferred.css"
            $results += [PSCustomObject]@{
                Asset = 'index-asset-refs:styles-deferred.css'
                Match = $false
                LocalHash = $localDeferredStyleRef
                RemoteHash = ''
                RemoteUrl = "$base/"
            }
        } elseif ($remoteDeferredStyleRef -eq $localDeferredStyleRef) {
            Write-Host "[OK]  index remoto usa misma referencia de styles-deferred.css"
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

if ($SkipAssetHashChecks) {
    Write-Host '[WARN] Se omite verificacion de hashes de assets (SkipAssetHashChecks).'
} elseif ($deployFreshnessStale) {
    Write-Host '[WARN] Se omite verificacion de hashes de assets hasta que el deploy remoto se sincronice con HEAD.'
} else {
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
            LocalPath = 'chat-widget-engine.js'
            LocalCandidates = @('js/engines/chat-widget-engine.js')
            RemoteUrl = $chatWidgetEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-engine.js'
            LocalPath = 'chat-engine.js'
            LocalCandidates = @('js/engines/chat-engine.js')
            RemoteUrl = $chatEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-ui-engine.js'
            LocalPath = 'chat-ui-engine.js'
            LocalCandidates = @('js/engines/chat-ui-engine.js')
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
            LocalPath = 'booking-engine.js'
            LocalCandidates = @('js/engines/booking-engine.js')
            RemoteUrl = $bookingEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'ui-effects.js'
            LocalPath = 'ui-effects.js'
            LocalCandidates = @('js/engines/ui-effects.js')
            RemoteUrl = $uiEffectsRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'gallery-interactions.js'
            LocalPath = 'gallery-interactions.js'
            LocalCandidates = @('js/engines/gallery-interactions.js')
            RemoteUrl = $galleryInteractionsRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'booking-ui.js'
            LocalPath = 'booking-ui.js'
            LocalCandidates = @('js/engines/booking-ui.js')
            RemoteUrl = $bookingUiRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'chat-booking-engine.js'
            LocalPath = 'chat-booking-engine.js'
            LocalCandidates = @('js/engines/chat-booking-engine.js')
            RemoteUrl = $chatBookingEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'success-modal-engine.js'
            LocalPath = 'success-modal-engine.js'
            LocalCandidates = @('js/engines/success-modal-engine.js')
            RemoteUrl = $successModalEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'engagement-forms-engine.js'
            LocalPath = 'engagement-forms-engine.js'
            LocalCandidates = @('js/engines/engagement-forms-engine.js')
            RemoteUrl = $engagementFormsEngineRemoteUrl
        },
        [PSCustomObject]@{
            Name = 'modal-ux-engine.js'
            LocalPath = 'modal-ux-engine.js'
            LocalCandidates = @('js/engines/modal-ux-engine.js')
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
    if (($rescheduleEngineRemoteUrl -ne '') -or (Test-Path 'reschedule-engine.js') -or (Test-Path 'js/engines/reschedule-engine.js')) {
        $checks += [PSCustomObject]@{
            Name = 'reschedule-engine.js'
            LocalPath = 'reschedule-engine.js'
            LocalCandidates = @('js/engines/reschedule-engine.js')
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

$healthUrl = "$base/api.php?resource=health"
try {
    $healthResp = Invoke-JsonGet -Url $healthUrl
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
            $healthRetryResp = Invoke-JsonGet -Url $healthUrlNoCache
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
    $availabilityResp = Invoke-JsonGet -Url $availabilityUrl
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
    $bookedResp = Invoke-JsonGet -Url $bookedSlotsUrl
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
    $figoResp = Invoke-JsonGet -Url $figoUrl
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
    $figoBackendResp = Invoke-JsonGet -Url $figoBackendUrl
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
    & .\SMOKE-PRODUCCION.ps1 -Domain $base -TestFigoPost -AllowDegradedFigo:$AllowDegradedFigo -AllowRecursiveFigo:$AllowRecursiveFigo -AllowMetaCspFallback:$AllowMetaCspFallback -RequireWebhookSecret:$RequireWebhookSecret
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
