param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$TestFigoPost,
    [switch]$AllowFigoRateLimit,
    [switch]$AllowDegradedFigo,
    [switch]$AllowRecursiveFigo,
    [switch]$AllowMetaCspFallback,
    [switch]$RequireWebhookSecret,
    [switch]$RequireBackupReceiverReady,
    [switch]$RequireCronReady,
    [switch]$RequireTelemedicineReady,
    [switch]$RequireTurneroWebSurfaces,
    [switch]$RequireTurneroOperatorPilot,
    [int]$MaxHealthTimingMs = 2000,
    [int]$FigoPostRetries = 3,
    [int]$FigoPostRetryDelaySec = 2,
    [string]$GitHubRepo = 'erosero558558/Aurora-Derm',
    [string]$GitHubApiBase = 'https://api.github.com',
    [int]$GitHubAlertsTimeoutSec = 15,
    [int]$GitHubAlertsIssueLimit = 30,
    [switch]$AllowOpenGitHubDeployAlerts
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'
$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'
. $commonHttpPath
$tmpRoot = [string]$env:TEMP
if ([string]::IsNullOrWhiteSpace($tmpRoot)) {
    $tmpRoot = [string]$env:TMPDIR
}
if ([string]::IsNullOrWhiteSpace($tmpRoot)) {
    $tmpRoot = [string]$env:RUNNER_TEMP
}
if ([string]::IsNullOrWhiteSpace($tmpRoot)) {
    try {
        $tmpRoot = [System.IO.Path]::GetTempPath()
    } catch {
        $tmpRoot = '.'
    }
}
if ([string]::IsNullOrWhiteSpace($tmpRoot)) {
    $tmpRoot = '.'
}
$tmpFile = Join-Path $tmpRoot 'pielarmonia-smoke-body.tmp'
$curlCommand = $null

function Resolve-CurlCommand {
    param(
        [string]$Name,
        [string]$Type = ''
    )

    try {
        $commands = if ([string]::IsNullOrWhiteSpace($Type)) {
            @(Get-Command $Name -ErrorAction SilentlyContinue)
        } else {
            @(Get-Command $Name -CommandType $Type -ErrorAction SilentlyContinue)
        }

        foreach ($cmd in $commands) {
            if ($null -eq $cmd) {
                continue
            }
            $source = [string]$cmd.Source
            if (-not [string]::IsNullOrWhiteSpace($source)) {
                return $source
            }
        }
    } catch {}

    return $null
}

$curlCommand = Resolve-CurlCommand -Name 'curl.exe'
if (-not $curlCommand) {
    $curlCommand = Resolve-CurlCommand -Name 'curl' -Type 'Application'
}
if (-not $curlCommand) {
    $curlCommand = 'curl'
}

function Convert-ResponseContentToText {
    param(
        [object]$Content
    )

    if ($null -eq $Content) {
        return ''
    }

    if ($Content -is [string]) {
        return $Content
    }

    if ($Content -is [byte[]]) {
        if ($Content.Length -eq 0) {
            return ''
        }
        return [System.Text.Encoding]::UTF8.GetString($Content)
    }

    if ($Content -is [System.Collections.IEnumerable] -and -not ($Content -is [string])) {
        try {
            $byteItems = @($Content | ForEach-Object { [byte]$_ })
            if ($byteItems.Count -gt 0) {
                return [System.Text.Encoding]::UTF8.GetString([byte[]]$byteItems)
            }
        } catch {}
    }

    try {
        return [string]$Content
    } catch {
        return ''
    }
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

$indexLocalRaw = if (Test-Path 'index.html') { Get-Content -Path 'index.html' -Raw } else { '' }
$localScriptRef = Get-RefFromIndex -IndexHtml $indexLocalRaw -Pattern '<script\s+src="([^"]*script\.js[^"]*)"'
$localStyleRef = Get-RefFromIndex -IndexHtml $indexLocalRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles\.css[^"]*)"'
$localDeferredStyleRef = Get-RefFromIndex -IndexHtml $indexLocalRaw -Pattern '<link\s+rel="stylesheet"\s+href="([^"]*styles-deferred\.css[^"]*)"'
$appScriptAssetUrl = if ($localScriptRef -ne '') { Get-Url -Base $base -Ref $localScriptRef } else { "$base/script.js" }
$criticalCssAssetUrl = if ($localStyleRef -ne '') {
    Get-Url -Base $base -Ref $localStyleRef
} elseif ($localDeferredStyleRef -ne '') {
    Get-Url -Base $base -Ref $localDeferredStyleRef
} elseif (Test-Path 'styles.css') {
    "$base/styles.css"
} elseif (Test-Path 'styles-deferred.css') {
    "$base/styles-deferred.css"
} else {
    "$base/styles.css"
}

$scriptLocalRaw = if (Test-Path 'script.js') { Get-Content -Path 'script.js' -Raw } else { '' }
$i18nEngineLocalRaw = if (Test-Path 'i18n-engine.js') { Get-Content -Path 'i18n-engine.js' -Raw } else { '' }
$rescheduleGatewayLocalRaw = if (Test-Path 'reschedule-gateway-engine.js') { Get-Content -Path 'reschedule-gateway-engine.js' -Raw } else { '' }

$chatEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'chat-engine.js'
$chatEngineAssetUrl = if ($chatEngineRef -ne '') {
    Get-Url -Base $base -Ref $chatEngineRef
} elseif (Test-Path 'js/engines/chat-engine.js') {
    "$base/js/engines/chat-engine.js"
} else {
    ''
}

$deferredStylesRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'styles-deferred.css'
$deferredStylesAssetUrl = if ($localDeferredStyleRef -ne '') {
    Get-Url -Base $base -Ref $localDeferredStyleRef
} elseif ($deferredStylesRef -ne '') {
    Get-Url -Base $base -Ref $deferredStylesRef
} elseif (Test-Path 'styles-deferred.css') {
    "$base/styles-deferred.css"
} else {
    ''
}

$translationsEnRef = Get-ScriptVersionedRef -ScriptText $i18nEngineLocalRaw -FileName 'translations-en.js'
if ($translationsEnRef -eq '') {
    $translationsEnRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'translations-en.js'
}
$translationsEnAssetUrl = if ($translationsEnRef -ne '') {
    Get-Url -Base $base -Ref $translationsEnRef
} elseif (Test-Path 'translations-en.js') {
    "$base/translations-en.js"
} elseif (Test-Path 'js/translations-en.js') {
    "$base/js/translations-en.js"
} else {
    ''
}

$bookingEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'booking-engine.js'
$bookingEngineAssetUrl = if ($bookingEngineRef -ne '') {
    Get-Url -Base $base -Ref $bookingEngineRef
} elseif (Test-Path 'js/engines/booking-engine.js') {
    "$base/js/engines/booking-engine.js"
} else {
    ''
}

$rescheduleEngineRef = Get-ScriptVersionedRef -ScriptText $rescheduleGatewayLocalRaw -FileName 'reschedule-engine.js'
if ($rescheduleEngineRef -eq '') {
    $rescheduleEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'reschedule-engine.js'
}
$rescheduleEngineAssetUrl = if ($rescheduleEngineRef -ne '') {
    Get-Url -Base $base -Ref $rescheduleEngineRef
} elseif (Test-Path 'js/engines/reschedule-engine.js') {
    "$base/js/engines/reschedule-engine.js"
} else {
    ''
}

$bookingUiRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'booking-ui.js'
$bookingUiAssetUrl = if ($bookingUiRef -ne '') {
    Get-Url -Base $base -Ref $bookingUiRef
} elseif (Test-Path 'js/engines/booking-ui.js') {
    "$base/js/engines/booking-ui.js"
} else {
    ''
}

$chatBookingEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'chat-booking-engine.js'
$chatBookingEngineAssetUrl = if ($chatBookingEngineRef -ne '') {
    Get-Url -Base $base -Ref $chatBookingEngineRef
} elseif (Test-Path 'js/engines/chat-booking-engine.js') {
    "$base/js/engines/chat-booking-engine.js"
} else {
    ''
}

$successModalEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'success-modal-engine.js'
$successModalEngineAssetUrl = if ($successModalEngineRef -ne '') {
    Get-Url -Base $base -Ref $successModalEngineRef
} elseif (Test-Path 'js/engines/success-modal-engine.js') {
    "$base/js/engines/success-modal-engine.js"
} else {
    ''
}

$engagementFormsEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'engagement-forms-engine.js'
$engagementFormsEngineAssetUrl = if ($engagementFormsEngineRef -ne '') {
    Get-Url -Base $base -Ref $engagementFormsEngineRef
} elseif (Test-Path 'js/engines/engagement-forms-engine.js') {
    "$base/js/engines/engagement-forms-engine.js"
} else {
    ''
}

$modalUxEngineRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'modal-ux-engine.js'
$modalUxEngineAssetUrl = if ($modalUxEngineRef -ne '') {
    Get-Url -Base $base -Ref $modalUxEngineRef
} elseif (Test-Path 'js/engines/modal-ux-engine.js') {
    "$base/js/engines/modal-ux-engine.js"
} else {
    ''
}

$uiEffectsRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'ui-effects.js'
$uiEffectsAssetUrl = if ($uiEffectsRef -ne '') {
    Get-Url -Base $base -Ref $uiEffectsRef
} elseif (Test-Path 'js/engines/ui-effects.js') {
    "$base/js/engines/ui-effects.js"
} else {
    ''
}

$galleryInteractionsRef = Get-ScriptVersionedRef -ScriptText $scriptLocalRaw -FileName 'gallery-interactions.js'
$galleryInteractionsAssetUrl = if ($galleryInteractionsRef -ne '') {
    Get-Url -Base $base -Ref $galleryInteractionsRef
} elseif (Test-Path 'js/engines/gallery-interactions.js') {
    "$base/js/engines/gallery-interactions.js"
} else {
    ''
}

$assetChecks = @(
    @{ Name = 'Chat engine asset'; Url = $chatEngineAssetUrl },
    @{ Name = 'Deferred styles asset'; Url = $deferredStylesAssetUrl },
    @{ Name = 'EN translations asset'; Url = $translationsEnAssetUrl },
    @{ Name = 'Booking engine asset'; Url = $bookingEngineAssetUrl },
    @{ Name = 'Booking UI asset'; Url = $bookingUiAssetUrl },
    @{ Name = 'Chat booking engine asset'; Url = $chatBookingEngineAssetUrl },
    @{ Name = 'Success modal engine asset'; Url = $successModalEngineAssetUrl },
    @{ Name = 'Engagement forms engine asset'; Url = $engagementFormsEngineAssetUrl },
    @{ Name = 'Modal UX engine asset'; Url = $modalUxEngineAssetUrl },
    @{ Name = 'Reschedule engine asset'; Url = $rescheduleEngineAssetUrl },
    @{ Name = 'UI effects asset'; Url = $uiEffectsAssetUrl },
    @{ Name = 'Gallery interactions asset'; Url = $galleryInteractionsAssetUrl },
    @{ Name = 'App script asset'; Url = $appScriptAssetUrl },
    @{ Name = 'Critical CSS asset'; Url = $criticalCssAssetUrl }
)

$optionalMissingAssets = @(
    'EN translations asset',
    'Booking UI asset',
    'Reschedule engine asset'
)

$turneroOperatorSurfaceUrl = "$base/operador-turnos.html"
$turneroKioskSurfaceUrl = "$base/kiosco-turnos.html"
$turneroDisplaySurfaceUrl = "$base/sala-turnos.html"
$turneroOperatorPilotCenterUrl = "$base/app-downloads/?surface=operator&platform=win"
$turneroOperatorPilotFeedUrl = "$base/desktop-updates/pilot/operator/win/latest.yml"
$turneroOperatorPilotInstallerUrl = "$base/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"

function Invoke-Check {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = 'GET',
        [object]$Body = $null
    )

    if (Test-Path $tmpFile) {
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }

    $args = @(
        '-sS',
        '--max-time', '20',
        '--connect-timeout', '8',
        '-o', $tmpFile,
        '-w', '%{http_code}',
        '-A', 'PielArmoniaSmoke/1.0',
        '-L'
    )

    if ($Method -eq 'POST') {
        $jsonBody = if ($null -eq $Body) { '{}' } else { $Body | ConvertTo-Json -Depth 8 -Compress }
        $args += @('-X', 'POST', '-H', 'Content-Type: application/json', '--data', $jsonBody)
    }

    $args += $Url

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $rawStatus = ''
    $curlError = ''
    try {
        $rawStatus = (& $curlCommand @args 2>&1 | Out-String).Trim()
    } catch {
        $curlError = $_.Exception.Message
    }
    $sw.Stop()

    $status = 0
    if ($rawStatus -match '^\d{3}$') {
        $status = [int]$rawStatus
    }

    $bodyText = ''
    if (Test-Path $tmpFile) {
        $bodyText = Get-Content $tmpFile -Raw
        Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
    }

    if ($LASTEXITCODE -eq 0 -and $status -ge 200 -and $status -lt 500) {
        Write-Host "[OK]  $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        return [PSCustomObject]@{
            Name = $Name
            Ok = $true
            Status = $status
            Body = $bodyText
        }
    }

    Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
    if ($curlError) {
        Write-Host "       $curlError"
    } elseif ($rawStatus -and $rawStatus -notmatch '^\d{3}$') {
        Write-Host "       $rawStatus"
    } elseif ($bodyText) {
        Write-Host "       $bodyText"
    } else {
        Write-Host "       Sin respuesta"
    }

    return [PSCustomObject]@{
        Name = $Name
        Ok = $false
        Status = $status
        Body = $bodyText
    }
}

function Invoke-StrictGetCheck {
    param(
        [string]$Name,
        [string]$Url
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaSmoke/1.0'
        }
        $sw.Stop()
        $status = [int]$resp.StatusCode
        $bodyText = Convert-ResponseContentToText -Content $resp.Content
        if ($status -ge 200 -and $status -lt 300) {
            Write-Host "[OK]  $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        } else {
            Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        }
        return [PSCustomObject]@{
            Name = $Name
            Ok = ($status -ge 200 -and $status -lt 300)
            Status = $status
            Body = $bodyText
        }
    } catch {
        $sw.Stop()
        $status = 0
        $bodyText = ''
        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $bodyText = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }
        Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        if ($bodyText) {
            Write-Host "       $bodyText"
        } elseif ($_.Exception.Message) {
            Write-Host "       $($_.Exception.Message)"
        } else {
            Write-Host '       Sin respuesta'
        }
        return [PSCustomObject]@{
            Name = $Name
            Ok = $false
            Status = $status
            Body = $bodyText
        }
    }
}

function Invoke-HeadCheck {
    param(
        [string]$Name,
        [string]$Url
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method HEAD -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaSmoke/1.0'
        }
        $sw.Stop()
        $status = [int]$resp.StatusCode
        Write-Host "[OK]  $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        return [PSCustomObject]@{
            Name = $Name
            Ok = ($status -ge 200 -and $status -lt 300)
            Status = $status
            Body = ''
        }
    } catch {
        $sw.Stop()
        $status = 0
        if ($_.Exception.Response) {
            try { $status = [int]$_.Exception.Response.StatusCode.value__ } catch {}
        }
        Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
        if ($_.Exception.Message) {
            Write-Host "       $($_.Exception.Message)"
        } else {
            Write-Host "       Sin respuesta"
        }
        return [PSCustomObject]@{
            Name = $Name
            Ok = $false
            Status = $status
            Body = ''
        }
    }
}

function Invoke-JsonPostCheck {
    param(
        [string]$Name,
        [string]$Url,
        [object]$Body,
        [int]$RetryCount = 1,
        [int]$RetryDelaySec = 2
    )

    $jsonBody = if ($null -eq $Body) { '{}' } else { $Body | ConvertTo-Json -Depth 8 -Compress }
    $maxAttempts = [Math]::Max(1, $RetryCount)

    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        $status = 0
        $bodyText = ''
        $ok = $false

        try {
            $resp = Invoke-WebRequest -Uri $Url -Method POST -ContentType 'application/json' -Body $jsonBody -TimeoutSec 20 -UseBasicParsing -Headers @{
                'Accept' = 'application/json'
                'User-Agent' = 'PielArmoniaSmoke/1.0'
            }
            $status = [int]$resp.StatusCode
            $bodyText = Convert-ResponseContentToText -Content $resp.Content
            $ok = $true
        } catch {
            $response = $_.Exception.Response
            if ($null -ne $response) {
                try { $status = [int]$response.StatusCode } catch { $status = 0 }
                try {
                    $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                    $bodyText = $reader.ReadToEnd()
                    $reader.Close()
                } catch {}
            }
            $ok = $false
        }
        $sw.Stop()

        $retryableStatus = @(
            0, 408, 425, 429, 500, 502, 503, 504
        )
        $shouldRetry = ($retryableStatus -contains [int]$status)

        if ($status -ge 200 -and $status -lt 500 -and -not $shouldRetry) {
            if ($attempt -gt 1) {
                Write-Host "[INFO] $Name recuperado en intento $attempt/$maxAttempts"
            }
            Write-Host "[OK]  $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
            return [PSCustomObject]@{
                Name = $Name
                Ok = $true
                Status = $status
                Body = $bodyText
            }
        }

        if ($attempt -lt $maxAttempts -and $shouldRetry) {
            Write-Host "[WARN] $Name intento $attempt/$maxAttempts con estado transitorio (HTTP $status). Reintentando en $RetryDelaySec s..."
            Start-Sleep -Seconds $RetryDelaySec
        } else {
            Write-Host "[FAIL] $Name -> HTTP $status ($([int]$sw.ElapsedMilliseconds) ms)"
            if ($bodyText) {
                Write-Host "       $bodyText"
            } else {
                Write-Host "       Sin respuesta"
            }

            return [PSCustomObject]@{
                Name = $Name
                Ok = $ok
                Status = $status
                Body = $bodyText
            }
        }
    }
}

Write-Host "== Smoke Produccion =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$results = @()
$results += Invoke-Check -Name 'Home' -Url "$base/"
$results += Invoke-Check -Name 'Health API' -Url "$base/api.php?resource=health"
$results += Invoke-Check -Name 'Reviews API' -Url "$base/api.php?resource=reviews"
$results += Invoke-Check -Name 'Availability API' -Url "$base/api.php?resource=availability"
$results += Invoke-JsonPostCheck -Name 'Funnel event POST' -Url "$base/api.php?resource=funnel-event" -Body @{
    event = 'view_booking'
    params = @{
        source = 'smoke'
    }
}
$results += Invoke-Check -Name 'Funnel metrics unauthorized' -Url "$base/api.php?resource=funnel-metrics"
$results += Invoke-Check -Name 'Admin auth status' -Url "$base/admin-auth.php?action=status"
$results += Invoke-Check -Name 'Figo chat GET' -Url "$base/figo-chat.php"
$results += Invoke-Check -Name 'Figo backend GET' -Url "$base/figo-backend.php"
$results += Invoke-Check -Name 'Backup receiver GET' -Url "$base/backup-receiver.php"
if ($RequireCronReady) {
    $results += Invoke-Check -Name 'Cron backup health unauthorized' -Url "$base/cron.php?action=backup-health"
    $results += Invoke-Check -Name 'Cron backup offsite unauthorized' -Url "$base/cron.php?action=backup-offsite"
}
if ($RequireTurneroWebSurfaces -or $RequireTurneroOperatorPilot) {
    $results += Invoke-StrictGetCheck -Name 'Turnero operador web' -Url $turneroOperatorSurfaceUrl
}
if ($RequireTurneroWebSurfaces) {
    $results += Invoke-StrictGetCheck -Name 'Turnero kiosco web' -Url $turneroKioskSurfaceUrl
    $results += Invoke-StrictGetCheck -Name 'Turnero sala web' -Url $turneroDisplaySurfaceUrl
}
if ($RequireTurneroOperatorPilot) {
    $results += Invoke-StrictGetCheck -Name 'Turnero operador pilot center' -Url $turneroOperatorPilotCenterUrl
    $results += Invoke-StrictGetCheck -Name 'Turnero operador pilot feed' -Url $turneroOperatorPilotFeedUrl
    $results += Invoke-HeadCheck -Name 'Turnero operador pilot installer' -Url $turneroOperatorPilotInstallerUrl
}
foreach ($assetCheck in $assetChecks) {
    if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
        Write-Host "[INFO] $($assetCheck.Name) omitido: no referenciado en el build local."
        continue
    }
    $results += Invoke-Check -Name $assetCheck.Name -Url $assetCheck.Url
}

if ($TestFigoPost) {
    $figoPayload = @{
        model = 'figo-assistant'
        messages = @(
            @{
                role = 'user'
                content = 'hola'
            }
        )
        max_tokens = 120
        temperature = 0.4
    }
    $results += Invoke-JsonPostCheck -Name 'Figo chat POST' -Url "$base/figo-chat.php" -Body $figoPayload -RetryCount $FigoPostRetries -RetryDelaySec $FigoPostRetryDelaySec
}

if ($RequireBackupReceiverReady) {
    $results += Invoke-JsonPostCheck -Name 'Backup receiver POST unauthorized' -Url "$base/backup-receiver.php" -Body @{
        smoke = $true
    }
}

$contractFailures = 0

$expectedStatusByName = @{
    'Home' = 200
    'Health API' = 200
    'Reviews API' = 200
    'Availability API' = 200
    'Funnel event POST' = @(202, 401)
    'Funnel metrics unauthorized' = 401
    'Admin auth status' = 200
    'Figo chat GET' = 200
    'Figo backend GET' = 200
    'Backup receiver GET' = 405
    'Cron backup health unauthorized' = 403
    'Cron backup offsite unauthorized' = 403
}
if ($RequireTurneroWebSurfaces -or $RequireTurneroOperatorPilot) {
    $expectedStatusByName['Turnero operador web'] = 200
}
if ($RequireTurneroWebSurfaces) {
    $expectedStatusByName['Turnero kiosco web'] = 200
    $expectedStatusByName['Turnero sala web'] = 200
}
if ($RequireTurneroOperatorPilot) {
    $expectedStatusByName['Turnero operador pilot center'] = 200
    $expectedStatusByName['Turnero operador pilot feed'] = 200
    $expectedStatusByName['Turnero operador pilot installer'] = 200
}
foreach ($assetCheck in $assetChecks) {
    if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
        continue
    }
    if ($optionalMissingAssets -contains $assetCheck.Name) {
        $expectedStatusByName[$assetCheck.Name] = @(200, 404)
    } else {
        $expectedStatusByName[$assetCheck.Name] = 200
    }
}
if ($TestFigoPost) {
    $expectedStatusByName['Figo chat POST'] = 200
}
if ($RequireBackupReceiverReady) {
    $expectedStatusByName['Backup receiver POST unauthorized'] = 401
}
if (-not $RequireCronReady) {
    $expectedStatusByName.Remove('Cron backup health unauthorized') | Out-Null
    $expectedStatusByName.Remove('Cron backup offsite unauthorized') | Out-Null
}

foreach ($result in $results) {
    $expected = $expectedStatusByName[$result.Name]
    if ($result.Name -eq 'Figo chat POST' -and $AllowFigoRateLimit -and [int]$result.Status -eq 429) {
        Write-Host "[WARN] Figo chat POST en rate-limit (429) aceptado por configuracion"
        continue
    }
    if ($null -eq $expected) {
        continue
    }

    if ($expected -is [System.Array]) {
        if (-not ($expected -contains [int]$result.Status)) {
            Write-Host "[FAIL] $($result.Name) devolvio HTTP $($result.Status), esperado uno de: $($expected -join ', ')"
            $contractFailures += 1
        } elseif ($result.Name -eq 'Funnel event POST' -and [int]$result.Status -eq 401) {
            Write-Host "[WARN] Funnel event POST protegido (401). Se acepta en modo hardening."
        }
        continue
    }

    if ([int]$result.Status -ne [int]$expected) {
        Write-Host "[FAIL] $($result.Name) devolvio HTTP $($result.Status), esperado HTTP $expected"
        $contractFailures += 1
    }
}

if ($RequireTurneroOperatorPilot) {
    $turneroPilotCenterResult = $results | Where-Object { $_.Name -eq 'Turnero operador pilot center' } | Select-Object -First 1
    if ($null -ne $turneroPilotCenterResult -and [int]$turneroPilotCenterResult.Status -eq 200) {
        if (-not ([string]$turneroPilotCenterResult.Body).Contains('TurneroOperadorSetup.exe')) {
            Write-Host '[FAIL] Turnero operador pilot center no muestra el instalador canonico'
            $contractFailures += 1
        } else {
            Write-Host '[OK]  Turnero operador pilot center muestra el instalador canonico'
        }
    }

    $turneroPilotFeedResult = $results | Where-Object { $_.Name -eq 'Turnero operador pilot feed' } | Select-Object -First 1
    if ($null -ne $turneroPilotFeedResult -and [int]$turneroPilotFeedResult.Status -eq 200) {
        if (-not [regex]::IsMatch([string]$turneroPilotFeedResult.Body, '(?m)^path:\s*TurneroOperadorSetup\.exe\s*$')) {
            Write-Host '[FAIL] Turnero operador pilot feed no apunta a TurneroOperadorSetup.exe'
            $contractFailures += 1
        } else {
            Write-Host '[OK]  Turnero operador pilot feed apunta al instalador canonico'
        }
    }
}

try {
    $homeHeaderResp = Invoke-WebRequest -Uri "$base/" -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
        'Accept' = 'text/html'
        'User-Agent' = 'PielArmoniaSmoke/1.0'
    }
    $homeHtml = ''
    try { $homeHtml = Convert-ResponseContentToText -Content $homeHeaderResp.Content } catch { $homeHtml = '' }
    foreach ($headerName in @('Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy')) {
        if ($null -eq $homeHeaderResp.Headers[$headerName]) {
            if ($headerName -eq 'Content-Security-Policy' -and $AllowMetaCspFallback -and [regex]::IsMatch($homeHtml, '<meta[^>]+http-equiv\s*=\s*["'']Content-Security-Policy["'']', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)) {
                Write-Host "[WARN] Home sin header CSP; usando fallback temporal por meta-CSP"
                continue
            }
            Write-Host "[FAIL] Home sin header de seguridad: $headerName"
            $contractFailures += 1
        }
    }
} catch {
    Write-Host "[FAIL] No se pudieron validar headers de seguridad en Home"
    $contractFailures += 1
}

foreach ($assetCheck in $assetChecks) {
    if ([string]::IsNullOrWhiteSpace($assetCheck.Url)) {
        continue
    }
    $assetResult = $results | Where-Object { $_.Name -eq $assetCheck.Name } | Select-Object -First 1
    if ($null -eq $assetResult -or [int]$assetResult.Status -ne 200) {
        Write-Host "[INFO] $($assetCheck.Name) omite validacion de cache (status actual: $($assetResult.Status))"
        continue
    }
    try {
        $assetResp = Invoke-WebRequest -Uri $assetCheck.Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaSmoke/1.0'
        }
        $cacheHeader = [string]$assetResp.Headers['Cache-Control']
        if ([string]::IsNullOrWhiteSpace($cacheHeader) -or $cacheHeader -notmatch 'max-age') {
            Write-Host "[FAIL] $($assetCheck.Name) sin Cache-Control con max-age"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] $($assetCheck.Name) no permitio validar cache: $($_.Exception.Message)"
        $contractFailures += 1
    }
}

try {
    $apiHeaderResp = Invoke-WebRequest -Uri "$base/api.php?resource=health" -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
        'Cache-Control' = 'no-cache'
        'User-Agent' = 'PielArmoniaSmoke/1.0'
    }
    $apiCacheHeader = [string]$apiHeaderResp.Headers['Cache-Control']
    if ([string]::IsNullOrWhiteSpace($apiCacheHeader) -or $apiCacheHeader -notmatch 'no-store|no-cache') {
        Write-Host "[FAIL] Health API sin politica no-store/no-cache"
        $contractFailures += 1
    }
} catch {
    Write-Host "[FAIL] No se pudo validar Cache-Control de Health API"
    $contractFailures += 1
}

$healthDiagnosticsUrl = "$base/api.php?resource=health-diagnostics"
$healthPublicUrl = "$base/api.php?resource=health"
$healthDiagnosticsSupportsDetailedChecks = $true
$healthResult = $results | Where-Object { $_.Name -eq 'Health API' } | Select-Object -First 1
if ($null -ne $healthResult -and $healthResult.Ok) {
    try {
        $healthJson = $healthResult.Body | ConvertFrom-Json
        foreach ($field in @('ok', 'status', 'storageReady', 'dataDirWritable', 'timingMs', 'version', 'timestamp')) {
            if ($null -eq $healthJson.PSObject.Properties[$field]) {
                Write-Host "[FAIL] Health API sin campo requerido: $field"
                $contractFailures += 1
            }
        }

        $healthTimingMs = 0
        try { $healthTimingMs = [int]$healthJson.timingMs } catch { $healthTimingMs = 0 }
        if ($healthTimingMs -gt $MaxHealthTimingMs) {
            Write-Host "[FAIL] Health API timingMs alto: $healthTimingMs ms (max $MaxHealthTimingMs ms)"
            $contractFailures += 1
        }

        $healthDiagnosticsJson = $null
        try {
            $healthDiagnosticsResp = Invoke-JsonGetStrict -Url $healthDiagnosticsUrl -UserAgent 'PielArmoniaSmoke/1.0'
            $healthDiagnosticsJson = $healthDiagnosticsResp.Json
        } catch {
            Write-Host "[WARN] Health diagnostics no disponible: $($_.Exception.Message)"
            try {
                $healthDiagnosticsResp = Invoke-JsonGetStrict -Url $healthPublicUrl -UserAgent 'PielArmoniaSmoke/1.0'
                $healthDiagnosticsJson = $healthDiagnosticsResp.Json
                $healthDiagnosticsSupportsDetailedChecks = $false
                Write-Host '[INFO] Health diagnostics fallback activo: usando health publico para checks compatibles'
            } catch {
                Write-Host "[FAIL] Health diagnostics no disponible: $($_.Exception.Message)"
                $contractFailures += 1
            }
        }

        if ($null -ne $healthDiagnosticsJson) {
            if ($healthDiagnosticsSupportsDetailedChecks) {
                foreach ($field in @('storeEncrypted', 'figoConfigured', 'figoRecursiveConfig')) {
                    if ($null -eq $healthDiagnosticsJson.PSObject.Properties[$field]) {
                        Write-Host "[FAIL] Health diagnostics sin campo requerido: $field"
                        $contractFailures += 1
                    }
                }
            } else {
                Write-Host '[INFO] Health publico activo: se omiten campos solo diagnostics (storeEncrypted/figoConfigured/figoRecursiveConfig)'
            }
            if (Test-Path $turneroClinicProfileScriptPath) {
                $turneroPilotStatusRaw = ''
                $turneroPilotStatusExit = 0
                $turneroPilotStatus = $null
                $turneroPilotClinicId = ''
                $turneroPilotCatalogMatch = $false
                $turneroPilotVerifyRequired = $false
                $turneroPilotRecoveryTargets = @()
                $turneroPilotRecoveryTargetsLabel = 'none'

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
                    Write-Host '[FAIL] turneroPilot clinic-profile status unresolved'
                    $contractFailures += 1
                } else {
                    try { $turneroPilotClinicId = [string]$turneroPilotStatus.profile.clinic_id } catch { $turneroPilotClinicId = '' }
                    try { $turneroPilotCatalogMatch = [bool]$turneroPilotStatus.matchesCatalog } catch { $turneroPilotCatalogMatch = $false }
                    try { $turneroPilotVerifyRequired = ([bool]$turneroPilotStatus.ok) -and ([string]$turneroPilotStatus.profile.release.mode -eq 'web_pilot') } catch { $turneroPilotVerifyRequired = $false }

                    if (-not $turneroPilotCatalogMatch) {
                        Write-Host "[FAIL] turneroPilot catalog drift (clinicId=$turneroPilotClinicId)"
                        $contractFailures += 1
                    } elseif ($turneroPilotVerifyRequired) {
                        $turneroPilotRecoveryTargets = @(
                            '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado',
                            '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'
                        )
                        $turneroPilotRecoveryTargetsLabel = ($turneroPilotRecoveryTargets -join '|')
                        Write-Host "[INFO] turneroPilot clinicId=$turneroPilotClinicId catalogMatch=$turneroPilotCatalogMatch"

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
                        $turneroPilotRemoteHealthRedacted = $false
                        $turneroPilotRemoteDiagnosticsAuthorized = $false
                        $turneroPilotRemoteResource = 'health'
                        try { $turneroPilotRemoteClinicId = [string]$turneroPilotVerify.turneroPilot.clinicId } catch { $turneroPilotRemoteClinicId = '' }
                        try { $turneroPilotRemoteFingerprint = [string]$turneroPilotVerify.turneroPilot.profileFingerprint } catch { $turneroPilotRemoteFingerprint = '' }
                        try { $turneroPilotRemoteCatalogReady = [bool]$turneroPilotVerify.turneroPilot.catalogReady } catch { $turneroPilotRemoteCatalogReady = $false }
                        try { $turneroPilotRemoteHealthRedacted = [bool]$turneroPilotVerify.publicHealthRedacted } catch { $turneroPilotRemoteHealthRedacted = $false }
                        try { $turneroPilotRemoteDiagnosticsAuthorized = [bool]$turneroPilotVerify.diagnosticsAuthorized } catch { $turneroPilotRemoteDiagnosticsAuthorized = $false }
                        try { $turneroPilotRemoteResource = [string]$turneroPilotVerify.remoteResource } catch { $turneroPilotRemoteResource = 'health' }

                        Write-Host "[INFO] turneroPilot remote clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady"
                        Write-Host "[INFO] turneroPilot recoveryTargets=$turneroPilotRecoveryTargetsLabel"

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
                            Write-Host "[FAIL] turneroPilot remote health redacted (resource=$turneroPilotRemoteResource diagnosticsAuthorized=$turneroPilotRemoteDiagnosticsAuthorized)"
                        } elseif (
                            [string]::IsNullOrWhiteSpace($turneroPilotRemoteClinicId) -or
                            [string]::IsNullOrWhiteSpace($turneroPilotRemoteFingerprint) -or
                            -not $turneroPilotRemoteCatalogReady
                        ) {
                            Write-Host "[FAIL] turneroPilot remote identity unresolved (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)"
                        }

                        if ($turneroPilotRemoteVerificationBlocked) {
                            Write-Host "[FAIL] turneroPilot remote mismatch (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)"
                            $contractFailures += 1
                        }
                    } else {
                        Write-Host '[INFO] turneroPilot verify-remote omitido: perfil activo no esta en modo web_pilot.'
                    }
                }
            } else {
                Write-Host '[WARN] bin/turnero-clinic-profile.js no existe; se omite smoke turneroPilot.'
            }
            $githubDeployAlerts = Get-GitHubProductionAlertSummary `
                -Repo $GitHubRepo `
                -ApiBase $GitHubApiBase `
                -TimeoutSec $GitHubAlertsTimeoutSec `
                -IssueLimit $GitHubAlertsIssueLimit `
                -UserAgent 'PielArmoniaSmoke/1.0'
            $githubDeployAlertsFetchOk = $false
            $githubDeployAlertsRelevantCount = 0
            $githubDeployAlertsTransportCount = 0
            $githubDeployAlertsConnectivityCount = 0
            $githubDeployAlertsRepairGitSyncCount = 0
            $githubDeployAlertsSelfHostedRunnerCount = 0
            $githubDeployAlertsSelfHostedDeployCount = 0
            $githubDeployAlertsIssueNumbersLabel = 'none'
            $githubDeployAlertsIssueRefsLabel = 'none'
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
                    $contractFailures += 1
                }
            } else {
                Write-Host '[OK]  github.deployAlerts sin incidentes abiertos'
            }
            $healthRecursive = $false
            try { $healthRecursive = [bool]$healthDiagnosticsJson.figoRecursiveConfig } catch { $healthRecursive = $false }
            if ($healthRecursive -and -not $AllowRecursiveFigo) {
                Write-Host "[FAIL] Health diagnostics reporta figoRecursiveConfig=true"
                $contractFailures += 1
            }

            if ($RequireCronReady) {
                $publicSync = $null
                try { $publicSync = $healthDiagnosticsJson.checks.publicSync } catch { $publicSync = $null }
                if ($null -eq $publicSync) {
                    Write-Host "[FAIL] Health diagnostics sin checks.publicSync"
                    $contractFailures += 1
                } else {
                    $jobId = ''
                    $jobKey = ''
                    $configured = $false
                    $healthy = $false
                    $ageSeconds = 999999
                    $state = ''
                    $lastErrorMessage = ''
                    $currentHead = ''
                    $remoteHead = ''
                    $dirtyPathsCount = 0
                    $dirtyPathsSample = @()
                    try { $jobId = [string]$publicSync.jobId } catch { $jobId = '' }
                    try { $jobKey = [string]$publicSync.jobKey } catch { $jobKey = '' }
                    try { $configured = [bool]$publicSync.configured } catch { $configured = $false }
                    try { $healthy = [bool]$publicSync.healthy } catch { $healthy = $false }
                    try { $ageSeconds = [int]$publicSync.ageSeconds } catch { $ageSeconds = 999999 }
                    try { $state = [string]$publicSync.state } catch { $state = '' }
                    try { $lastErrorMessage = [string]$publicSync.lastErrorMessage } catch { $lastErrorMessage = '' }
                    try { $currentHead = [string]$publicSync.currentHead } catch { $currentHead = '' }
                    try { $remoteHead = [string]$publicSync.remoteHead } catch { $remoteHead = '' }
                    try { $dirtyPathsCount = [int]$publicSync.dirtyPathsCount } catch { $dirtyPathsCount = 0 }
                    try {
                        if ($null -ne $publicSync.dirtyPathsSample) {
                            $dirtyPathsSample = @($publicSync.dirtyPathsSample)
                        }
                    } catch {
                        $dirtyPathsSample = @()
                    }
                    $dirtyPathsSampleLabel = if ($dirtyPathsSample.Count -eq 0) {
                        'none'
                    } else {
                        (@($dirtyPathsSample | Select-Object -First 5 | ForEach-Object { [string]$_ }) -join ', ')
                    }
                    $headDrift = $false
                    if ($healthDiagnosticsSupportsDetailedChecks) {
                        $headDrift = (
                            -not [string]::IsNullOrWhiteSpace($currentHead) -and
                            -not [string]::IsNullOrWhiteSpace($remoteHead) -and
                            $currentHead -ne $remoteHead
                        )
                    } else {
                        try { $headDrift = [bool]$publicSync.headDrift } catch { $headDrift = $false }
                    }
                    $telemetryGap = $false
                    if ($healthDiagnosticsSupportsDetailedChecks) {
                        $telemetryGap = (
                            -not $healthy -and
                            -not [string]::IsNullOrWhiteSpace($lastErrorMessage) -and
                            [string]::IsNullOrWhiteSpace($currentHead) -and
                            [string]::IsNullOrWhiteSpace($remoteHead) -and
                            $dirtyPathsCount -le 0
                        )
                    }

                    Write-Host "[INFO] checks.publicSync state=$state lastErrorMessage=$lastErrorMessage currentHead=$currentHead remoteHead=$remoteHead headDrift=$headDrift dirtyPathsCount=$dirtyPathsCount telemetryGap=$telemetryGap dirtyPathsSample=$dirtyPathsSampleLabel"

                    if (-not $configured) {
                        Write-Host "[FAIL] checks.publicSync.configured=false"
                        $contractFailures += 1
                    }
                    if ($healthDiagnosticsSupportsDetailedChecks -and $jobId -ne '8d31e299-7e57-4959-80b5-aaa2d73e9674') {
                        Write-Host "[FAIL] checks.publicSync.jobId invalido: $jobId"
                        $contractFailures += 1
                    } elseif (-not $healthDiagnosticsSupportsDetailedChecks -and $jobKey -and $jobKey -ne 'public_main_sync') {
                        Write-Host "[FAIL] checks.publicSync.jobKey invalido: $jobKey"
                        $contractFailures += 1
                    }
                    if (-not $healthy) {
                        Write-Host "[FAIL] checks.publicSync.healthy=false (state=$state, lastErrorMessage=$lastErrorMessage, dirtyPathsCount=$dirtyPathsCount)"
                        $contractFailures += 1
                    }
                    if ($ageSeconds -gt 120) {
                        Write-Host "[FAIL] checks.publicSync.ageSeconds alto: $ageSeconds (state=$state, currentHead=$currentHead, remoteHead=$remoteHead)"
                        $contractFailures += 1
                    }
                    if ($headDrift) {
                        Write-Host "[FAIL] checks.publicSync head drift detectado: currentHead=$currentHead remoteHead=$remoteHead"
                        $contractFailures += 1
                    }
                    if ($healthDiagnosticsSupportsDetailedChecks -and $telemetryGap) {
                        Write-Host "[FAIL] checks.publicSync failed sin telemetria runtime suficiente (currentHead/remoteHead/dirtyPathsCount ausentes)"
                        $contractFailures += 1
                    }
                }
            }

            if ($RequireTelemedicineReady) {
                $telemedicine = $null
                try { $telemedicine = $healthDiagnosticsJson.checks.telemedicine } catch { $telemedicine = $null }
                if ($null -eq $telemedicine) {
                    Write-Host "[FAIL] Health diagnostics sin checks.telemedicine"
                    $contractFailures += 1
                } else {
                    $telemedicineConfigured = $false
                    $telemedicineDiagnosticsStatus = ''
                    $telemedicineCriticalCount = 0
                    $telemedicineDanglingLinks = 0
                    $telemedicineCasePhotosMissingPrivatePath = 0
                    try { $telemedicineConfigured = [bool]$telemedicine.configured } catch { $telemedicineConfigured = $false }
                    try { $telemedicineDiagnosticsStatus = [string]$telemedicine.diagnostics.status } catch { $telemedicineDiagnosticsStatus = '' }
                    try { $telemedicineCriticalCount = [int]$telemedicine.diagnostics.summary.critical } catch { $telemedicineCriticalCount = 0 }
                    try { $telemedicineDanglingLinks = [int]$telemedicine.integrity.danglingAppointmentLinksCount } catch { $telemedicineDanglingLinks = 0 }
                    try { $telemedicineCasePhotosMissingPrivatePath = [int]$telemedicine.integrity.casePhotosWithoutPrivatePathCount } catch { $telemedicineCasePhotosMissingPrivatePath = 0 }

                    if (-not $telemedicineConfigured) {
                        Write-Host "[FAIL] checks.telemedicine.configured=false"
                        $contractFailures += 1
                    }
                    if ($telemedicineDiagnosticsStatus -eq 'critical' -or $telemedicineCriticalCount -gt 0) {
                        Write-Host "[FAIL] checks.telemedicine diagnostics critico (status=$telemedicineDiagnosticsStatus, critical=$telemedicineCriticalCount)"
                        $contractFailures += 1
                    }
                    if ($telemedicineDanglingLinks -gt 0) {
                        Write-Host "[FAIL] checks.telemedicine danglingAppointmentLinksCount=$telemedicineDanglingLinks"
                        $contractFailures += 1
                    }
                    if ($telemedicineCasePhotosMissingPrivatePath -gt 0) {
                        Write-Host "[FAIL] checks.telemedicine casePhotosWithoutPrivatePathCount=$telemedicineCasePhotosMissingPrivatePath"
                        $contractFailures += 1
                    }
                }
            }
        }
    } catch {
        Write-Host "[FAIL] Health API no devolvio JSON valido"
        $contractFailures += 1
    }
}

$figoGetResult = $results | Where-Object { $_.Name -eq 'Figo chat GET' } | Select-Object -First 1
if ($null -ne $figoGetResult -and $figoGetResult.Ok) {
    try {
        $figoJson = $figoGetResult.Body | ConvertFrom-Json
        foreach ($field in @('mode', 'recursiveConfigDetected', 'upstreamReachable')) {
            if ($null -eq $figoJson.PSObject.Properties[$field]) {
                Write-Host "[FAIL] Figo chat GET sin campo requerido: $field"
                $contractFailures += 1
            }
        }

        $mode = ''
        try { $mode = [string]$figoJson.mode } catch { $mode = '' }
        if (-not $AllowDegradedFigo -and $mode -ne 'live') {
            Write-Host "[FAIL] Figo chat GET mode=$mode (se esperaba live)"
            $contractFailures += 1
        }

        $recursive = $false
        try { $recursive = [bool]$figoJson.recursiveConfigDetected } catch { $recursive = $false }
        if ($recursive -and -not $AllowRecursiveFigo) {
            Write-Host "[FAIL] Figo chat GET recursiveConfigDetected=true"
            $contractFailures += 1
        }

        $upstreamReachable = $true
        try { $upstreamReachable = [bool]$figoJson.upstreamReachable } catch { $upstreamReachable = $false }
        if (-not $AllowDegradedFigo -and -not $upstreamReachable) {
            Write-Host "[FAIL] Figo chat GET upstreamReachable=false"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Figo chat GET no devolvio JSON valido"
        $contractFailures += 1
    }
}

$funnelEventResult = $results | Where-Object { $_.Name -eq 'Funnel event POST' } | Select-Object -First 1
if ($null -ne $funnelEventResult -and [int]$funnelEventResult.Status -eq 202) {
    try {
        $funnelEventJson = $funnelEventResult.Body | ConvertFrom-Json
        if (-not [bool]$funnelEventJson.ok -or -not [bool]$funnelEventJson.recorded) {
            Write-Host "[FAIL] Funnel event POST no confirmo registro (ok/recorded)"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Funnel event POST no devolvio JSON valido"
        $contractFailures += 1
    }
}

$figoPostResult = $results | Where-Object { $_.Name -eq 'Figo chat POST' } | Select-Object -First 1
if ($null -ne $figoPostResult -and $figoPostResult.Ok) {
    try {
        $figoPostJson = $figoPostResult.Body | ConvertFrom-Json
        $assistantText = ''
        try {
            if ($figoPostJson.choices -and $figoPostJson.choices.Count -gt 0) {
                $assistantText = [string]$figoPostJson.choices[0].message.content
            }
        } catch {
            $assistantText = ''
        }

        $normalizedText = ($assistantText.ToLowerInvariant())
        if ($normalizedText -like '*problemas t*cnicos*' -or
            $normalizedText -like '*contact*nos directamente por whatsapp*' -or
            $normalizedText -like '*te atenderemos personalmente*') {
            Write-Host "[FAIL] Figo chat POST devolvio fallback tecnico en lugar de respuesta inteligente"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Figo chat POST no devolvio JSON valido"
        $contractFailures += 1
    }
}

$figoBackendGetResult = $results | Where-Object { $_.Name -eq 'Figo backend GET' } | Select-Object -First 1
if ($null -ne $figoBackendGetResult -and $figoBackendGetResult.Ok) {
    try {
        $figoBackendJson = $figoBackendGetResult.Body | ConvertFrom-Json
        foreach ($field in @('service', 'mode', 'provider', 'telegramConfigured', 'webhookSecretConfigured')) {
            if ($null -eq $figoBackendJson.PSObject.Properties[$field]) {
                Write-Host "[FAIL] Figo backend GET sin campo requerido: $field"
                $contractFailures += 1
            }
        }

        if ([string]$figoBackendJson.service -ne 'figo-backend') {
            Write-Host "[FAIL] Figo backend GET service invalido: $($figoBackendJson.service)"
            $contractFailures += 1
        }

        if ($RequireWebhookSecret -and -not [bool]$figoBackendJson.webhookSecretConfigured) {
            Write-Host "[FAIL] Figo backend GET webhookSecretConfigured=false"
            $contractFailures += 1
        }
    } catch {
        Write-Host "[FAIL] Figo backend GET no devolvio JSON valido"
        $contractFailures += 1
    }
}

$okCount = 0
foreach ($result in $results) {
    $isOk = $false
    try { $isOk = [bool]$result.Ok } catch { $isOk = $false }
    if (-not $isOk -and $result.Name -eq 'Figo chat POST' -and $AllowFigoRateLimit -and [int]$result.Status -eq 429) {
        $isOk = $true
    }
    if ($isOk) {
        $okCount++
    }
}
$total = $results.Count
Write-Host ""
Write-Host "Resultado HTTP base: $okCount/$total checks OK"
Write-Host "Fallas de contrato/reglas: $contractFailures"

if ($okCount -ne $total -or $contractFailures -gt 0) {
    exit 1
}

exit 0
