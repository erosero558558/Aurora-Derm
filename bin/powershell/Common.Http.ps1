function Ensure-Directory {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -Path $Path -ItemType Directory -Force | Out-Null
    }
}

function Parse-JsonBody {
    param(
        [string]$Body,
        [int]$Depth = 12
    )

    if ([string]::IsNullOrWhiteSpace($Body)) {
        return $null
    }

    try {
        $convertCmd = Get-Command ConvertFrom-Json -ErrorAction Stop
        if ($convertCmd.Parameters.ContainsKey('Depth')) {
            return ($Body | ConvertFrom-Json -Depth $Depth)
        }
        return ($Body | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Invoke-JsonGet {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 20,
        [string]$UserAgent = 'PielArmoniaHttp/1.0',
        [int]$JsonDepth = 12
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = $UserAgent
        }
        $status = [int]$resp.StatusCode
        $body = [string]$resp.Content
        if ($status -lt 200 -or $status -ge 300) {
            return [pscustomobject]@{
                Name = $Name
                Ok = $false
                StatusCode = $status
                Error = "HTTP $status"
                Json = $null
                Body = $body
            }
        }

        $json = Parse-JsonBody -Body $body -Depth $JsonDepth
        if ($null -eq $json) {
            return [pscustomobject]@{
                Name = $Name
                Ok = $false
                StatusCode = $status
                Error = 'JSON invalido'
                Json = $null
                Body = $body
            }
        }

        return [pscustomobject]@{
            Name = $Name
            Ok = $true
            StatusCode = $status
            Error = ''
            Json = $json
            Body = $body
        }
    } catch {
        return [pscustomobject]@{
            Name = $Name
            Ok = $false
            StatusCode = 0
            Error = $_.Exception.Message
            Json = $null
            Body = ''
        }
    }
}

function Invoke-JsonGetStrict {
    param(
        [string]$Url,
        [int]$TimeoutSec = 20,
        [string]$UserAgent = 'PielArmoniaHttp/1.0',
        [int]$JsonDepth = 12
    )

    $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'User-Agent' = $UserAgent
    }

    $status = [int]$resp.StatusCode
    $body = [string]$resp.Content
    if ($status -lt 200 -or $status -ge 300) {
        throw "HTTP $status en $Url"
    }

    $json = Parse-JsonBody -Body $body -Depth $JsonDepth
    if ($null -eq $json) {
        throw "La respuesta de $Url no es JSON valido"
    }

    return [pscustomobject]@{
        Status = $status
        Body = $body
        Json = $json
    }
}

function Invoke-TextGet {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 20,
        [string]$UserAgent = 'PielArmoniaHttp/1.0'
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = $UserAgent
        }
        $status = [int]$resp.StatusCode
        return [pscustomobject]@{
            Name = $Name
            Ok = ($status -ge 200 -and $status -lt 300)
            StatusCode = $status
            Error = if ($status -ge 200 -and $status -lt 300) { '' } else { "HTTP $status" }
            Body = [string]$resp.Content
        }
    } catch {
        $statusCode = 0
        $body = ''
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $body = $reader.ReadToEnd()
                    $reader.Close()
                }
            } catch {}
        }
        return [pscustomobject]@{
            Name = $Name
            Ok = $false
            StatusCode = $statusCode
            Error = $_.Exception.Message
            Body = $body
        }
    }
}

function Invoke-EndpointCheck {
    param(
        [string]$Name,
        [string]$Url,
        [int]$TimeoutSec = 15,
        [int]$RetryOnNetworkError = 1,
        [int]$RetryDelaySec = 3,
        [string]$UserAgent = 'PielArmoniaMonitor/1.0'
    )

    $attempt = 0
    $maxAttempts = 1 + $RetryOnNetworkError
    $lastResult = $null

    while ($attempt -lt $maxAttempts) {
        $attempt++
        if ($attempt -gt 1) {
            Write-Host "[RETRY] $Name (intento $attempt/$maxAttempts) tras ${RetryDelaySec}s..."
            Start-Sleep -Seconds $RetryDelaySec
        }

        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        try {
            $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing -Headers @{
                'Cache-Control' = 'no-cache'
                'User-Agent' = $UserAgent
            }
            $sw.Stop()
            return [pscustomobject]@{
                Name = $Name
                Url = $Url
                Ok = $true
                StatusCode = [int]$response.StatusCode
                DurationMs = [int]$sw.ElapsedMilliseconds
                Body = [string]$response.Content
                Error = ''
            }
        } catch {
            $sw.Stop()
            $statusCode = 0
            $body = ''
            if ($_.Exception.Response) {
                try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
                try {
                    $stream = $_.Exception.Response.GetResponseStream()
                    if ($stream) {
                        $reader = New-Object System.IO.StreamReader($stream)
                        $body = $reader.ReadToEnd()
                        $reader.Close()
                    }
                } catch {}
            }

            $lastResult = [pscustomobject]@{
                Name = $Name
                Url = $Url
                Ok = $false
                StatusCode = $statusCode
                DurationMs = [int]$sw.ElapsedMilliseconds
                Body = $body
                Error = $_.Exception.Message
            }

            if ($statusCode -ne 0) {
                break
            }
        }
    }

    return $lastResult
}

function Get-CurlBinary {
    if (-not [string]::IsNullOrWhiteSpace($script:CurlBinary)) {
        return $script:CurlBinary
    }

    foreach ($candidate in @('curl.exe', 'curl')) {
        $command = Get-Command $candidate -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($null -ne $command -and -not [string]::IsNullOrWhiteSpace($command.Source)) {
            $script:CurlBinary = $command.Source
            return $script:CurlBinary
        }
    }

    throw 'No se encontro curl/curl.exe en el entorno de ejecucion.'
}

function New-CompatTemporaryFile {
    try {
        return [System.IO.Path]::GetTempFileName()
    } catch {
        throw "No se pudo crear archivo temporal: $($_.Exception.Message)"
    }
}

function Invoke-CurlDownload {
    param(
        [string]$Url,
        [string]$OutputPath,
        [int]$MaxTimeSec = 20,
        [int]$ConnectTimeoutSec = 8
    )

    if ([string]::IsNullOrWhiteSpace($Url) -or [string]::IsNullOrWhiteSpace($OutputPath)) {
        throw 'Invoke-CurlDownload requiere Url y OutputPath.'
    }

    $curlBinary = Get-CurlBinary
    & $curlBinary -sS -L --max-time $MaxTimeSec --connect-timeout $ConnectTimeoutSec -o $OutputPath $Url | Out-Null
    return ($LASTEXITCODE -eq 0)
}

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

    $tmp = New-CompatTemporaryFile
    try {
        if (-not (Invoke-CurlDownload -Url $Url -OutputPath $tmp -MaxTimeSec 20 -ConnectTimeoutSec 8)) {
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

    return Get-LocalSha256 -Path $Path -NormalizeText:$NormalizeText
}

function Get-RemoteText {
    param([string]$Url)

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return ''
    }

    $tmp = New-CompatTemporaryFile
    try {
        if (-not (Invoke-CurlDownload -Url $Url -OutputPath $tmp -MaxTimeSec 20 -ConnectTimeoutSec 8)) {
            return ''
        }
        return [string](Get-Content -Path $tmp -Raw)
    } catch {
        return ''
    } finally {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmp
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
        return [pscustomobject]@{
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

function Get-RemoteIndexHtml {
    param([string]$Base)

    $remoteIndexRaw = ''
    $remoteIndexCandidates = @("$Base/", "$Base/index.html")
    foreach ($candidateUrl in $remoteIndexCandidates) {
        $remoteIndexTmp = New-CompatTemporaryFile
        try {
            if (-not (Invoke-CurlDownload -Url $candidateUrl -OutputPath $remoteIndexTmp -MaxTimeSec 20 -ConnectTimeoutSec 8)) {
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

    if ($null -eq $remoteIndexRaw) {
        return ''
    }

    return [string]$remoteIndexRaw
}

function Test-SecurityHeaders {
    param(
        [string]$Base,
        [switch]$AllowMetaCspFallback
    )

    $results = @()
    $homeHtml = ''

    try {
        $homeResp = $null
        $homeCandidates = @("$Base/", "$Base/index.html")
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
        try { $homeHtml = [string]$homeResp.Content } catch { $homeHtml = '' }
        foreach ($headerName in $requiredSecurityHeaders) {
            if ($null -ne $homeResp.Headers[$headerName]) {
                Write-Host "[OK]  header presente: $headerName"
            } else {
                if (
                    $headerName -eq 'Content-Security-Policy' -and
                    $AllowMetaCspFallback -and
                    [regex]::IsMatch($homeHtml, '<meta[^>]+http-equiv\s*=\s*["'']Content-Security-Policy["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
                ) {
                    Write-Host "[WARN] header ausente: $headerName (fallback temporal por meta-CSP)"
                    continue
                }
                Write-Host "[FAIL] header ausente: $headerName"
                $results += [pscustomobject]@{
                    Asset = "header:$headerName"
                    Match = $false
                    LocalHash = 'required'
                    RemoteHash = 'missing'
                    RemoteUrl = "$Base/"
                }
            }
        }

        $cspHeaderValues = @()
        if ($null -ne $homeResp.Headers['Content-Security-Policy']) {
            $rawCsp = $homeResp.Headers['Content-Security-Policy']
            if ($rawCsp -is [System.Array]) {
                $cspHeaderValues = @($rawCsp | ForEach-Object { [string]$_ })
            } else {
                $cspHeaderValues = @(([string]$rawCsp) -split "(\r?\n)+" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
            }
        }

        if ($cspHeaderValues.Count -gt 1) {
            Write-Host "[WARN] Se detectaron multiples cabeceras CSP ($($cspHeaderValues.Count)). Validando coherencia minima..."
            $requiredCspOrigins = @(
                'https://static.cloudflareinsights.com',
                'https://cloudflareinsights.com'
            )
            foreach ($origin in $requiredCspOrigins) {
                $missingIn = @()
                for ($i = 0; $i -lt $cspHeaderValues.Count; $i++) {
                    if (-not $cspHeaderValues[$i].Contains($origin)) {
                        $missingIn += ($i + 1)
                    }
                }

                if ($missingIn.Count -gt 0) {
                    Write-Host "[FAIL] CSP inconsistente: falta '$origin' en cabecera(s) #$($missingIn -join ', ')"
                    $results += [pscustomobject]@{
                        Asset = "header:csp-consistency:$origin"
                        Match = $false
                        LocalHash = 'required'
                        RemoteHash = "missing_in_headers_$($missingIn -join '-')"
                        RemoteUrl = "$Base/"
                    }
                }
            }
        }
    } catch {
        Write-Host "[FAIL] No se pudieron validar headers de seguridad: $($_.Exception.Message)"
        $results += [pscustomobject]@{
            Asset = 'headers:security'
            Match = $false
            LocalHash = ''
            RemoteHash = ''
            RemoteUrl = "$Base/"
        }
    }

    return [pscustomobject]@{
        Results = @($results)
        HomeHtml = $homeHtml
    }
}

function Test-AssetCacheHeaders {
    param(
        [object[]]$Checks,
        [string]$FailureAsset,
        [string]$Base,
        [string]$FailureMessage
    )

    $results = @()

    try {
        foreach ($assetCheck in $Checks) {
            if ([string]::IsNullOrWhiteSpace([string]$assetCheck.Url)) {
                continue
            }

            $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
                'Cache-Control' = 'no-cache'
                'User-Agent' = 'PielArmoniaDeployCheck/1.0'
            }
            $cacheHeader = [string]$assetResp.Headers['Cache-Control']
            if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
                Write-Host "[FAIL] asset sin Cache-Control con max-age: $($assetCheck.Name)"
                $results += [pscustomobject]@{
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
        Write-Host $FailureMessage
        $results += [pscustomobject]@{
            Asset = $FailureAsset
            Match = $false
            LocalHash = 'max-age'
            RemoteHash = ''
            RemoteUrl = "$Base/"
        }
    }

    return @($results)
}

function Test-IndexInlinePolicies {
    param(
        [string]$RemoteIndexRaw,
        [string]$Base
    )

    $results = @()

    if ([regex]::IsMatch([string]$RemoteIndexRaw, '<[a-zA-Z][^>]*\son[a-z]+\s*=', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        Write-Host '[FAIL] index remoto contiene event handlers inline (on*)'
        $results += [pscustomobject]@{
            Asset = 'index-inline-handlers'
            Match = $false
            LocalHash = 'none'
            RemoteHash = 'found'
            RemoteUrl = "$Base/"
        }
    } else {
        Write-Host '[OK]  index remoto sin handlers inline (on*)'
    }

    $inlineExecutableScriptPattern = '<script\b(?![^>]*\bsrc=)(?![^>]*\btype\s*=\s*["'']application/ld\+json["''])[^>]*>[\s\S]*?</script>'
    if ([regex]::IsMatch([string]$RemoteIndexRaw, $inlineExecutableScriptPattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
        Write-Host '[FAIL] index remoto contiene scripts inline ejecutables'
        $results += [pscustomobject]@{
            Asset = 'index-inline-executable-script'
            Match = $false
            LocalHash = 'none'
            RemoteHash = 'found'
            RemoteUrl = "$Base/"
        }
    } else {
        Write-Host '[OK]  index remoto sin scripts inline ejecutables'
    }

    return @($results)
}

function Test-IndexAssetReference {
    param(
        [string]$AssetKey,
        [string]$LocalRef,
        [string]$RemoteRef,
        [string]$Base,
        [switch]$ComparePathOnly,
        [switch]$Advisory,
        [switch]$AdvisoryAsInfo,
        [string]$AdvisoryReason
    )

    $results = @()
    $displayName = $AssetKey
    $match = $false

    if ([string]::IsNullOrWhiteSpace($RemoteRef)) {
        if ($Advisory) {
            $level = if ($AdvisoryAsInfo) { 'INFO' } else { 'WARN' }
            Write-Host "[$level] index remoto sin referencia de $displayName ($AdvisoryReason)"
            Write-Host "       Local : $LocalRef"
            return @()
        }

        Write-Host "[FAIL] index remoto sin referencia de $displayName"
        $results += [pscustomobject]@{
            Asset = "index-asset-refs:$AssetKey"
            Match = $false
            LocalHash = $LocalRef
            RemoteHash = ''
            RemoteUrl = "$Base/"
        }
        return @($results)
    }

    if ($ComparePathOnly) {
        $match = (Get-RefPath -Ref $RemoteRef) -eq (Get-RefPath -Ref $LocalRef)
    } else {
        $match = $RemoteRef -eq $LocalRef
    }

    if ($match) {
        Write-Host "[OK]  index remoto usa misma referencia de $displayName"
        return @()
    }

    if ($Advisory) {
        $level = if ($AdvisoryAsInfo) { 'INFO' } else { 'WARN' }
        Write-Host "[$level] index remoto $displayName diferente ($AdvisoryReason)"
        Write-Host "       Local : $LocalRef"
        Write-Host "       Remote: $RemoteRef"
        return @()
    }

    Write-Host "[FAIL] index remoto $displayName diferente"
    Write-Host "       Local : $LocalRef"
    Write-Host "       Remote: $RemoteRef"
    $results += [pscustomobject]@{
        Asset = "index-ref:$AssetKey"
        Match = $false
        LocalHash = $LocalRef
        RemoteHash = $RemoteRef
        RemoteUrl = "$Base/"
    }
    return @($results)
}

function Resolve-VersionedAssetRemoteUrl {
    param(
        [string]$Base,
        [string]$SourceText,
        [string]$FileName,
        [string[]]$FallbackPaths = @()
    )

    $assetRef = Get-ScriptVersionedRef -ScriptText $SourceText -FileName $FileName
    if ($assetRef -ne '') {
        return Get-Url -Base $Base -Ref $assetRef
    }

    foreach ($candidate in $FallbackPaths) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
            return Get-Url -Base $Base -Ref $candidate
        }
    }

    return ''
}

function Resolve-DeployAssetMap {
    param(
        [string]$Base,
        [string]$LocalScriptText,
        [string]$LocalI18nEngineText,
        [string]$LocalRescheduleGatewayText,
        [string]$IndexDeferredStylesRemoteUrl
    )

    $map = [ordered]@{}
    $map.ChatEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'chat-engine.js' -FallbackPaths @('chat-engine.js', 'js/engines/chat-engine.js')
    $map.ChatUiEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'chat-ui-engine.js' -FallbackPaths @('chat-ui-engine.js', 'js/engines/chat-ui-engine.js')
    $map.ChatWidgetEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'chat-widget-engine.js' -FallbackPaths @('chat-widget-engine.js', 'js/engines/chat-widget-engine.js')

    $deferredStylesRef = Get-ScriptVersionedRef -ScriptText $LocalScriptText -FileName 'styles-deferred.css'
    $map.DeferredStylesRemoteUrl = if ($IndexDeferredStylesRemoteUrl -ne '') {
        $IndexDeferredStylesRemoteUrl
    } elseif ($deferredStylesRef -ne '') {
        Get-Url -Base $Base -Ref $deferredStylesRef
    } elseif (Test-Path 'styles-deferred.css') {
        "$Base/styles-deferred.css"
    } else {
        ''
    }
    if (-not [string]::IsNullOrWhiteSpace($map.DeferredStylesRemoteUrl)) {
        if ($map.DeferredStylesRemoteUrl -match '\?') {
            $map.DeferredStylesRemoteUrl = "$($map.DeferredStylesRemoteUrl)&verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
        } else {
            $map.DeferredStylesRemoteUrl = "$($map.DeferredStylesRemoteUrl)?verify=$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
        }
    }

    $translationsEnRef = Get-ScriptVersionedRef -ScriptText $LocalI18nEngineText -FileName 'translations-en.js'
    if ($translationsEnRef -eq '') {
        $translationsEnRef = Get-ScriptVersionedRef -ScriptText $LocalScriptText -FileName 'translations-en.js'
    }
    $map.HasTranslationsEnAsset = ($translationsEnRef -ne '') -or (Test-Path 'translations-en.js')
    $map.TranslationsEnRemoteUrl = if ($translationsEnRef -ne '') {
        Get-Url -Base $Base -Ref $translationsEnRef
    } elseif (Test-Path 'translations-en.js') {
        "$Base/translations-en.js"
    } else {
        ''
    }

    $map.BookingEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'booking-engine.js' -FallbackPaths @('booking-engine.js', 'js/engines/booking-engine.js')
    $map.AnalyticsEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'analytics-engine.js' -FallbackPaths @('js/engines/analytics-engine.js')
    $map.UiEffectsRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'ui-effects.js' -FallbackPaths @('ui-effects.js', 'js/engines/ui-effects.js')
    $map.GalleryInteractionsRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'gallery-interactions.js' -FallbackPaths @('gallery-interactions.js', 'js/engines/gallery-interactions.js')

    $rescheduleEngineRef = Get-ScriptVersionedRef -ScriptText $LocalRescheduleGatewayText -FileName 'reschedule-engine.js'
    if ($rescheduleEngineRef -eq '') {
        $rescheduleEngineRef = Get-ScriptVersionedRef -ScriptText $LocalScriptText -FileName 'reschedule-engine.js'
    }
    $map.RescheduleEngineRemoteUrl = if ($rescheduleEngineRef -ne '') {
        Get-Url -Base $Base -Ref $rescheduleEngineRef
    } elseif ((Test-Path 'reschedule-engine.js') -or (Test-Path 'js/engines/reschedule-engine.js')) {
        "$Base/reschedule-engine.js"
    } else {
        ''
    }

    $map.BookingUiRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'booking-ui.js' -FallbackPaths @('booking-ui.js', 'js/engines/booking-ui.js')
    $map.ChatBookingEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'chat-booking-engine.js' -FallbackPaths @('chat-booking-engine.js', 'js/engines/chat-booking-engine.js')
    $map.SuccessModalEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'success-modal-engine.js' -FallbackPaths @('success-modal-engine.js', 'js/engines/success-modal-engine.js')
    $map.EngagementFormsEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'engagement-forms-engine.js' -FallbackPaths @('engagement-forms-engine.js', 'js/engines/engagement-forms-engine.js')
    $map.ModalUxEngineRemoteUrl = Resolve-VersionedAssetRemoteUrl -Base $Base -SourceText $LocalScriptText -FileName 'modal-ux-engine.js' -FallbackPaths @('modal-ux-engine.js', 'js/engines/modal-ux-engine.js')

    $map.SecondaryAssetHeaderChecks = @(
        @{ Name = 'chat-widget-engine'; Url = $map.ChatWidgetEngineRemoteUrl },
        @{ Name = 'chat-engine'; Url = $map.ChatEngineRemoteUrl },
        @{ Name = 'chat-ui-engine'; Url = $map.ChatUiEngineRemoteUrl },
        @{ Name = 'styles-deferred'; Url = $map.DeferredStylesRemoteUrl },
        @{ Name = 'translations-en'; Url = $map.TranslationsEnRemoteUrl },
        @{ Name = 'booking-engine'; Url = $map.BookingEngineRemoteUrl },
        @{ Name = 'booking-ui'; Url = $map.BookingUiRemoteUrl },
        @{ Name = 'chat-booking-engine'; Url = $map.ChatBookingEngineRemoteUrl },
        @{ Name = 'success-modal-engine'; Url = $map.SuccessModalEngineRemoteUrl },
        @{ Name = 'engagement-forms-engine'; Url = $map.EngagementFormsEngineRemoteUrl },
        @{ Name = 'modal-ux-engine'; Url = $map.ModalUxEngineRemoteUrl },
        @{ Name = 'reschedule-engine'; Url = $map.RescheduleEngineRemoteUrl },
        @{ Name = 'ui-effects'; Url = $map.UiEffectsRemoteUrl },
        @{ Name = 'gallery-interactions'; Url = $map.GalleryInteractionsRemoteUrl }
    )

    $map.HashChecks = @(
        [pscustomobject]@{ Name = 'chat-widget-engine.js'; LocalPath = 'js/engines/chat-widget-engine.js'; LocalCandidates = @('chat-widget-engine.js'); RemoteUrl = $map.ChatWidgetEngineRemoteUrl },
        [pscustomobject]@{ Name = 'chat-engine.js'; LocalPath = 'js/engines/chat-engine.js'; LocalCandidates = @('chat-engine.js'); RemoteUrl = $map.ChatEngineRemoteUrl },
        [pscustomobject]@{ Name = 'chat-ui-engine.js'; LocalPath = 'js/engines/chat-ui-engine.js'; LocalCandidates = @('chat-ui-engine.js'); RemoteUrl = $map.ChatUiEngineRemoteUrl },
        [pscustomobject]@{ Name = 'styles-deferred.css'; LocalPath = 'styles-deferred.css'; LocalCandidates = @(); RemoteUrl = $map.DeferredStylesRemoteUrl },
        [pscustomobject]@{ Name = 'booking-engine.js'; LocalPath = 'js/engines/booking-engine.js'; LocalCandidates = @('booking-engine.js'); RemoteUrl = $map.BookingEngineRemoteUrl },
        [pscustomobject]@{ Name = 'ui-effects.js'; LocalPath = 'js/engines/ui-effects.js'; LocalCandidates = @('ui-effects.js'); RemoteUrl = $map.UiEffectsRemoteUrl },
        [pscustomobject]@{ Name = 'gallery-interactions.js'; LocalPath = 'js/engines/gallery-interactions.js'; LocalCandidates = @('gallery-interactions.js'); RemoteUrl = $map.GalleryInteractionsRemoteUrl },
        [pscustomobject]@{ Name = 'booking-ui.js'; LocalPath = 'js/engines/booking-ui.js'; LocalCandidates = @('booking-ui.js'); RemoteUrl = $map.BookingUiRemoteUrl },
        [pscustomobject]@{ Name = 'chat-booking-engine.js'; LocalPath = 'js/engines/chat-booking-engine.js'; LocalCandidates = @('chat-booking-engine.js'); RemoteUrl = $map.ChatBookingEngineRemoteUrl },
        [pscustomobject]@{ Name = 'success-modal-engine.js'; LocalPath = 'js/engines/success-modal-engine.js'; LocalCandidates = @('success-modal-engine.js'); RemoteUrl = $map.SuccessModalEngineRemoteUrl },
        [pscustomobject]@{ Name = 'engagement-forms-engine.js'; LocalPath = 'js/engines/engagement-forms-engine.js'; LocalCandidates = @('engagement-forms-engine.js'); RemoteUrl = $map.EngagementFormsEngineRemoteUrl },
        [pscustomobject]@{ Name = 'modal-ux-engine.js'; LocalPath = 'js/engines/modal-ux-engine.js'; LocalCandidates = @('modal-ux-engine.js'); RemoteUrl = $map.ModalUxEngineRemoteUrl }
    )
    if ($map.HasTranslationsEnAsset) {
        $map.HashChecks += [pscustomobject]@{ Name = 'translations-en.js'; LocalPath = 'translations-en.js'; LocalCandidates = @('js/translations-en.js'); RemoteUrl = $map.TranslationsEnRemoteUrl }
    }
    if (($map.RescheduleEngineRemoteUrl -ne '') -or (Test-Path 'reschedule-engine.js') -or (Test-Path 'js/engines/reschedule-engine.js')) {
        $map.HashChecks += [pscustomobject]@{ Name = 'reschedule-engine.js'; LocalPath = 'js/engines/reschedule-engine.js'; LocalCandidates = @('reschedule-engine.js'); RemoteUrl = $map.RescheduleEngineRemoteUrl }
    }

    return [pscustomobject]$map
}

function Test-AssetHashes {
    param(
        [object[]]$Checks,
        [string]$DeployAssetVersion = '',
        [int]$RetryCount = 0,
        [int]$RetryDelaySec = 0
    )

    $results = @()

    foreach ($item in $Checks) {
        if ([string]::IsNullOrWhiteSpace([string]$item.RemoteUrl)) {
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

        $remoteUrlForHash = [string]$item.RemoteUrl
        if ($DeployAssetVersion -ne '' -and $item.Name -ne 'script.js') {
            $remoteUrlForHash = Add-QueryParam -Url $remoteUrlForHash -Name 'cv' -Value $DeployAssetVersion
        }

        $localHash = Get-LocalSha256FromGitHeadOrFile -Path $resolvedLocalPath -NormalizeText
        if ([string]::IsNullOrWhiteSpace($localHash)) {
            Write-Host "[INFO] Se omite hash de $($item.Name): no se pudo calcular hash local."
            continue
        }

        $remoteHash = Get-RemoteSha256 -Url (Get-CacheBypassUrl -Url $remoteUrlForHash -AssetName $item.Name -Attempt 0) -NormalizeText
        $attempts = 0
        $match = ($localHash -ne '' -and $localHash -eq $remoteHash)

        while (-not $match -and $attempts -lt $RetryCount) {
            Start-Sleep -Seconds $RetryDelaySec
            $attempts += 1
            $remoteHash = Get-RemoteSha256 -Url (Get-CacheBypassUrl -Url $remoteUrlForHash -AssetName $item.Name -Attempt $attempts) -NormalizeText
            $match = ($localHash -ne '' -and $localHash -eq $remoteHash)
        }

        $results += [pscustomobject]@{
            Asset = $item.Name
            Match = $match
            LocalHash = $localHash
            RemoteHash = $remoteHash
            LocalPath = $resolvedLocalPath
            RemoteUrl = $remoteUrlForHash
            Attempts = $attempts
        }
    }

    return @($results)
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

        $report = [pscustomobject]@{
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
