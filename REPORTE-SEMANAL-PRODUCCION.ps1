param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$BenchRuns = 15,
    [int]$TimeoutSec = 20,
    [string]$OutputDir = 'verification/weekly',
    [int]$CoreP95MaxMs = 800,
    [int]$FigoPostP95MaxMs = 2500,
    [switch]$FailOnWarnings
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')

function Ensure-Directory {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -Path $Path -ItemType Directory -Force | Out-Null
    }
}

function Parse-JsonBody {
    param([string]$Body)
    if ([string]::IsNullOrWhiteSpace($Body)) {
        return $null
    }
    try {
        $convertCmd = Get-Command ConvertFrom-Json -ErrorAction Stop
        if ($convertCmd.Parameters.ContainsKey('Depth')) {
            return ($Body | ConvertFrom-Json -Depth 12)
        }
        return ($Body | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Invoke-JsonGet {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaWeeklyReport/1.0'
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
            }
        }
        $json = Parse-JsonBody -Body $body
        if ($null -eq $json) {
            return [pscustomobject]@{
                Name = $Name
                Ok = $false
                StatusCode = $status
                Error = 'JSON invalido'
                Json = $null
            }
        }

        return [pscustomobject]@{
            Name = $Name
            Ok = $true
            StatusCode = $status
            Error = ''
            Json = $json
        }
    } catch {
        return [pscustomobject]@{
            Name = $Name
            Ok = $false
            StatusCode = 0
            Error = $_.Exception.Message
            Json = $null
        }
    }
}

function Invoke-TextGet {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -Headers @{
            'Cache-Control' = 'no-cache'
            'User-Agent' = 'PielArmoniaWeeklyReport/1.0'
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

function Get-PercentileValue {
    param(
        [double[]]$Values,
        [double]$Percentile
    )
    if (-not $Values -or $Values.Count -eq 0) {
        return 0
    }
    $sorted = $Values | Sort-Object
    $index = [Math]::Ceiling(($Percentile / 100) * $sorted.Count) - 1
    if ($index -lt 0) { $index = 0 }
    if ($index -ge $sorted.Count) { $index = $sorted.Count - 1 }
    return [double]$sorted[$index]
}

function Measure-BenchEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = 'GET',
        [string]$JsonBody = ''
    )

    $times = New-Object System.Collections.Generic.List[double]
    $statusFailures = 0
    $networkFailures = 0

    for ($i = 1; $i -le $BenchRuns; $i++) {
        $args = @(
            '-sS',
            '-o', 'NUL',
            '-w', '%{http_code} %{time_total}',
            '--max-time', '20',
            '--connect-timeout', '8',
            '-L',
            '-A', 'PielArmoniaWeeklyReport/1.0'
        )

        if ($Method -eq 'POST') {
            $args += @('-X', 'POST', '-H', 'Content-Type: application/json', '--data', $JsonBody)
        }
        $args += $Url

        $out = ''
        try {
            $out = (& curl.exe @args 2>$null | Out-String).Trim()
        } catch {
            $networkFailures += 1
            continue
        }

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) {
            $networkFailures += 1
            continue
        }

        $parts = $out -split '\s+'
        if ($parts.Count -lt 2) {
            $networkFailures += 1
            continue
        }

        $status = 0
        $timeSeconds = 0.0
        [void][int]::TryParse($parts[0], [ref]$status)
        [void][double]::TryParse(
            $parts[1],
            [System.Globalization.NumberStyles]::Float,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$timeSeconds
        )

        if ($status -lt 200 -or $status -ge 500) {
            $statusFailures += 1
        }

        $times.Add([Math]::Round($timeSeconds * 1000, 2))
    }

    if ($times.Count -eq 0) {
        return [pscustomobject]@{
            Name = $Name
            Samples = 0
            AvgMs = 0
            P95Ms = 0
            MaxMs = 0
            StatusFailures = $statusFailures
            NetworkFailures = $networkFailures
        }
    }

    $avg = ($times | Measure-Object -Average).Average
    $p95 = Get-PercentileValue -Values $times.ToArray() -Percentile 95
    $max = ($times | Measure-Object -Maximum).Maximum

    return [pscustomobject]@{
        Name = $Name
        Samples = $times.Count
        AvgMs = [Math]::Round([double]$avg, 2)
        P95Ms = [Math]::Round([double]$p95, 2)
        MaxMs = [Math]::Round([double]$max, 2)
        StatusFailures = $statusFailures
        NetworkFailures = $networkFailures
    }
}

function Parse-PrometheusLabels {
    param([string]$RawLabels)
    $labels = @{}
    if ([string]::IsNullOrWhiteSpace($RawLabels)) {
        return $labels
    }

    $matches = [regex]::Matches($RawLabels, '([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"')
    foreach ($match in $matches) {
        $key = [string]$match.Groups[1].Value
        $value = [string]$match.Groups[2].Value
        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }
        $labels[$key] = [regex]::Unescape($value)
    }
    return $labels
}

function Parse-PrometheusCounterSeries {
    param(
        [string]$MetricsText,
        [string]$MetricName
    )

    $series = @()
    if ([string]::IsNullOrWhiteSpace($MetricsText) -or [string]::IsNullOrWhiteSpace($MetricName)) {
        return $series
    }

    $pattern = '^' + [regex]::Escape($MetricName) + '(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$'
    $lines = $MetricsText -split "\r?\n"
    foreach ($line in $lines) {
        $clean = [string]$line
        if ([string]::IsNullOrWhiteSpace($clean)) {
            continue
        }
        if ($clean.StartsWith('#')) {
            continue
        }
        $match = [regex]::Match($clean.Trim(), $pattern)
        if (-not $match.Success) {
            continue
        }

        $labelsRaw = [string]$match.Groups[1].Value
        $valueRaw = [string]$match.Groups[2].Value
        $value = 0.0
        [void][double]::TryParse($valueRaw, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$value)
        $series += [pscustomobject]@{
            Labels = Parse-PrometheusLabels -RawLabels $labelsRaw
            Value = $value
        }
    }
    return $series
}

function Get-EventCount {
    param(
        $Events,
        [string]$Name
    )
    if ($null -eq $Events) {
        return 0
    }
    try {
        $value = $Events.$Name
        if ($null -eq $value) {
            return 0
        }
        return [int]$value
    } catch {
        return 0
    }
}

function Get-ObjectValueOrDefault {
    param(
        $Object,
        [string]$Property,
        $DefaultValue
    )

    if ($null -eq $Object -or [string]::IsNullOrWhiteSpace($Property)) {
        return $DefaultValue
    }

    try {
        $value = $Object.$Property
        if ($null -eq $value) {
            return $DefaultValue
        }
        return $value
    } catch {
        return $DefaultValue
    }
}

Write-Host '== Reporte Semanal Produccion =='
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$healthResult = Invoke-JsonGet -Name 'health' -Url "$base/api.php?resource=health"
$funnelResult = Invoke-JsonGet -Name 'funnel-metrics' -Url "$base/api.php?resource=funnel-metrics"

if (-not $healthResult.Ok) {
    throw "No se pudo consultar health: $($healthResult.Error)"
}
$health = $healthResult.Json
$summary = $null
$events = @{}
$funnelSource = 'funnel-metrics'

if ($funnelResult.Ok -and $null -ne $funnelResult.Json -and [bool]($funnelResult.Json.ok)) {
    $funnel = $funnelResult.Json.data
    $summary = $funnel.summary
    $eventsObj = $funnel.events
    if ($null -ne $eventsObj) {
        $events = @{}
        $eventsObj.PSObject.Properties | ForEach-Object {
            $events[$_.Name] = [int]$_.Value
        }
    }
} else {
    $metricsResult = Invoke-TextGet -Name 'metrics' -Url "$base/api.php?resource=metrics"
    if (-not $metricsResult.Ok) {
        throw "No se pudo consultar funnel-metrics ni metrics: $($funnelResult.Error) / $($metricsResult.Error)"
    }

    $funnelSource = 'metrics_counter'
    $series = Parse-PrometheusCounterSeries -MetricsText $metricsResult.Body -MetricName 'conversion_funnel_events_total'
    $events = @{}
    foreach ($row in $series) {
        $labels = $row.Labels
        $eventName = ''
        if ($labels.ContainsKey('event')) {
            $eventName = [string]$labels['event']
        }
        if ([string]::IsNullOrWhiteSpace($eventName)) {
            continue
        }
        $current = 0
        if ($events.ContainsKey($eventName)) {
            $current = [int]$events[$eventName]
        }
        $events[$eventName] = $current + [int]([Math]::Round([double]$row.Value))
    }

    $viewBookingFromEvents = if ($events.ContainsKey('view_booking')) { [int]$events['view_booking'] } else { 0 }
    $startCheckoutFromEvents = if ($events.ContainsKey('start_checkout')) { [int]$events['start_checkout'] } else { 0 }
    $bookingConfirmedFromEvents = if ($events.ContainsKey('booking_confirmed')) { [int]$events['booking_confirmed'] } else { 0 }
    $checkoutAbandonFromEvents = if ($events.ContainsKey('checkout_abandon')) { [int]$events['checkout_abandon'] } else { 0 }

    $summary = [pscustomobject]@{
        viewBooking = $viewBookingFromEvents
        startCheckout = $startCheckoutFromEvents
        bookingConfirmed = $bookingConfirmedFromEvents
        checkoutAbandon = $checkoutAbandonFromEvents
    }
}

$viewBooking = [int](Get-ObjectValueOrDefault -Object $summary -Property 'viewBooking' -DefaultValue 0)
$startCheckout = [int](Get-ObjectValueOrDefault -Object $summary -Property 'startCheckout' -DefaultValue 0)
$bookingConfirmed = [int](Get-ObjectValueOrDefault -Object $summary -Property 'bookingConfirmed' -DefaultValue 0)
$checkoutAbandon = [int](Get-ObjectValueOrDefault -Object $summary -Property 'checkoutAbandon' -DefaultValue 0)

$bookingError = Get-EventCount -Events $events -Name 'booking_error'
$checkoutError = Get-EventCount -Events $events -Name 'checkout_error'
$totalErrorEvents = $bookingError + $checkoutError
$errorRatePct = if ($startCheckout -gt 0) {
    [Math]::Round(($totalErrorEvents / [double]$startCheckout) * 100, 2)
} else {
    0.0
}

$benchChecks = @(
    @{ Name = 'health'; Url = "$base/api.php?resource=health"; Method = 'GET'; Body = '' },
    @{ Name = 'reviews'; Url = "$base/api.php?resource=reviews"; Method = 'GET'; Body = '' },
    @{ Name = 'availability'; Url = "$base/api.php?resource=availability"; Method = 'GET'; Body = '' },
    @{ Name = 'figo-post'; Url = "$base/figo-chat.php"; Method = 'POST'; Body = '{"model":"figo-assistant","messages":[{"role":"user","content":"hola"}],"max_tokens":120,"temperature":0.4}' }
)

$benchResults = @()
foreach ($check in $benchChecks) {
    $benchResults += Measure-BenchEndpoint -Name $check.Name -Url $check.Url -Method $check.Method -JsonBody $check.Body
}

$benchMap = @{}
foreach ($row in $benchResults) {
    $benchMap[$row.Name] = $row
}

$coreP95 = @(
    [double]($benchMap['health'].P95Ms),
    [double]($benchMap['reviews'].P95Ms),
    [double]($benchMap['availability'].P95Ms)
)
$coreP95Max = [Math]::Round(($coreP95 | Measure-Object -Maximum).Maximum, 2)
$figoPostP95 = [double]($benchMap['figo-post'].P95Ms)

$calendarSource = [string](Get-ObjectValueOrDefault -Object $health -Property 'calendarSource' -DefaultValue 'unknown')
$calendarMode = [string](Get-ObjectValueOrDefault -Object $health -Property 'calendarMode' -DefaultValue 'unknown')
$calendarReachable = [bool](Get-ObjectValueOrDefault -Object $health -Property 'calendarReachable' -DefaultValue $false)
$calendarTokenHealthy = [bool](Get-ObjectValueOrDefault -Object $health -Property 'calendarTokenHealthy' -DefaultValue $false)
$calendarLastSuccessAt = [string](Get-ObjectValueOrDefault -Object $health -Property 'calendarLastSuccessAt' -DefaultValue '')

$warnings = New-Object System.Collections.Generic.List[string]
if ($errorRatePct -ge 2.0) {
    $warnings.Add("error_rate_alta_${errorRatePct}pct")
}
if ($coreP95Max -gt $CoreP95MaxMs) {
    $warnings.Add("core_p95_alto_${coreP95Max}ms")
}
if ($figoPostP95 -gt $FigoPostP95MaxMs) {
    $warnings.Add("figo_post_p95_alto_${figoPostP95}ms")
}
if ($calendarSource -ne 'google') {
    $warnings.Add("calendar_source_${calendarSource}")
}
if ($calendarMode -ne 'live') {
    $warnings.Add("calendar_mode_${calendarMode}")
}
if (-not $calendarReachable) {
    $warnings.Add('calendar_unreachable')
}
if (-not $calendarTokenHealthy) {
    $warnings.Add('calendar_token_unhealthy')
}

$reportGeneratedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$reportDate = Get-Date -Format 'yyyy-MM-dd'
$reportDateCompact = Get-Date -Format 'yyyyMMdd'

Ensure-Directory -Path $OutputDir
$reportMdPath = Join-Path $OutputDir "weekly-report-$reportDateCompact.md"
$reportJsonPath = Join-Path $OutputDir "weekly-report-$reportDateCompact.json"

$warningBlock = if ($warnings.Count -eq 0) {
    '- none'
} else {
    ($warnings | ForEach-Object { "- $_" }) -join "`n"
}

$benchTable = @()
foreach ($row in $benchResults) {
    $benchTable += "| $($row.Name) | $($row.Samples) | $($row.AvgMs) | $($row.P95Ms) | $($row.MaxMs) | $($row.StatusFailures) | $($row.NetworkFailures) |"
}

$markdown = @"
# Weekly Production Report - Piel en Armonia

- generatedAt: $reportGeneratedAt
- domain: $base
- reportDate: $reportDate

## Conversion

- source: $funnelSource
- view_booking: $viewBooking
- start_checkout: $startCheckout
- booking_confirmed: $bookingConfirmed
- checkout_abandon: $checkoutAbandon
- booking_error: $bookingError
- checkout_error: $checkoutError
- booking_error_rate_pct: $errorRatePct

## Calendar Health

- calendar_source: $calendarSource
- calendar_mode: $calendarMode
- calendar_reachable: $calendarReachable
- calendar_token_healthy: $calendarTokenHealthy
- calendar_last_success_at: $calendarLastSuccessAt

## Latency Bench

- core_p95_max_ms: $coreP95Max (target <= $CoreP95MaxMs)
- figo_post_p95_ms: $figoPostP95 (target <= $FigoPostP95MaxMs)

| endpoint | samples | avg_ms | p95_ms | max_ms | status_failures | network_failures |
|---|---:|---:|---:|---:|---:|---:|
$($benchTable -join "`n")

## Warnings

$warningBlock
"@

Set-Content -Path $reportMdPath -Value $markdown -Encoding UTF8

$reportPayload = [ordered]@{
    generatedAt = $reportGeneratedAt
    domain = $base
    summary = [ordered]@{
        viewBooking = $viewBooking
        startCheckout = $startCheckout
        bookingConfirmed = $bookingConfirmed
        checkoutAbandon = $checkoutAbandon
        bookingError = $bookingError
        checkoutError = $checkoutError
        bookingErrorRatePct = $errorRatePct
    }
    calendar = [ordered]@{
        source = $calendarSource
        mode = $calendarMode
        reachable = $calendarReachable
        tokenHealthy = $calendarTokenHealthy
        lastSuccessAt = $calendarLastSuccessAt
    }
    latency = [ordered]@{
        coreP95MaxMs = $coreP95Max
        coreP95TargetMs = $CoreP95MaxMs
        figoPostP95Ms = $figoPostP95
        figoPostP95TargetMs = $FigoPostP95MaxMs
        bench = $benchResults
    }
    warnings = @($warnings)
}
$reportPayload | ConvertTo-Json -Depth 10 | Set-Content -Path $reportJsonPath -Encoding UTF8

Write-Host ''
Write-Host "Reporte markdown: $reportMdPath"
Write-Host "Reporte json: $reportJsonPath"
Write-Host "booking_confirmed=$bookingConfirmed error_rate_pct=$errorRatePct core_p95_max_ms=$coreP95Max figo_post_p95_ms=$figoPostP95"
if ($warnings.Count -gt 0) {
    Write-Host "Warnings: $($warnings -join ', ')" -ForegroundColor Yellow
    if ($FailOnWarnings) {
        Write-Host 'FailOnWarnings activo: reporte marcado como fallido.' -ForegroundColor Red
        exit 2
    }
} else {
    Write-Host 'Warnings: none' -ForegroundColor Green
}
