param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$BenchRuns = 15,
    [int]$TimeoutSec = 20,
    [string]$OutputDir = 'verification/weekly',
    [int]$CoreP95MaxMs = 800,
    [int]$FigoPostP95MaxMs = 2500,
    [double]$NoShowRateWarnPct = 20,
    [double]$RecurrenceRateMinWarnPct = 30,
    [double]$RecurrenceRateDropWarnPct = 15,
    [int]$RecurrenceWarnMinUniquePatients = 5,
    [double]$ConversionRateMinWarnPct = 25,
    [double]$ConversionRateDropWarnPct = 15,
    [int]$ConversionWarnMinStartCheckout = 10,
    [double]$StartCheckoutRateMinWarnPct = 0.25,
    [double]$StartCheckoutRateDropWarnPct = 0.2,
    [int]$StartCheckoutWarnMinViewBooking = 100,
    [switch]$FailOnWarnings,
    [switch]$FailOnCriticalWarnings
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

function Read-JsonFileSafe {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return $null
    }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        return Parse-JsonBody -Body $raw
    } catch {
        return $null
    }
}

function Get-WarningSeverity {
    param([string]$WarningCode)

    if ([string]::IsNullOrWhiteSpace($WarningCode)) {
        return 'critical'
    }

    if (
        $WarningCode -eq 'calendar_unreachable' -or
        $WarningCode -eq 'calendar_token_unhealthy' -or
        $WarningCode -eq 'sentry_backend_no_configurado' -or
        $WarningCode -eq 'sentry_frontend_no_configurado'
    ) {
        return 'critical'
    }

    foreach ($prefix in @(
        'error_rate_alta_',
        'calendar_source_',
        'calendar_mode_'
    )) {
        if ($WarningCode.StartsWith($prefix)) {
            return 'critical'
        }
    }

    foreach ($prefix in @(
        'core_p95_alto_',
        'figo_post_p95_alto_',
        'no_show_rate_alta_',
        'recurrence_rate_',
        'conversion_rate_',
        'start_checkout_rate_'
    )) {
        if ($WarningCode.StartsWith($prefix)) {
            return 'non_critical'
        }
    }

    # Default conservador: si aparece un warning nuevo no clasificado, tratarlo como critico.
    return 'critical'
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

function Get-ScalarMetricValue {
    param(
        [string]$MetricsText,
        [string]$MetricName,
        [double]$DefaultValue = 0
    )

    $series = Parse-PrometheusCounterSeries -MetricsText $MetricsText -MetricName $MetricName
    if (-not $series -or $series.Count -eq 0) {
        return [double]$DefaultValue
    }

    foreach ($row in $series) {
        $labels = $row.Labels
        if ($null -eq $labels -or $labels.Count -eq 0) {
            return [double]$row.Value
        }
    }

    return [double]$series[0].Value
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
$retention = $null
$metricsText = ''
$funnelSource = 'funnel-metrics'

if ($funnelResult.Ok -and $null -ne $funnelResult.Json -and [bool]($funnelResult.Json.ok)) {
    $funnel = $funnelResult.Json.data
    $summary = $funnel.summary
    $retention = Get-ObjectValueOrDefault -Object $funnel -Property 'retention' -DefaultValue $null
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

    $metricsText = [string]$metricsResult.Body
    $funnelSource = 'metrics_counter'
    $series = Parse-PrometheusCounterSeries -MetricsText $metricsText -MetricName 'conversion_funnel_events_total'
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

if ($null -eq $retention) {
    if ([string]::IsNullOrWhiteSpace($metricsText)) {
        $metricsFallbackResult = Invoke-TextGet -Name 'metrics-retention' -Url "$base/api.php?resource=metrics"
        if ($metricsFallbackResult.Ok) {
            $metricsText = [string]$metricsFallbackResult.Body
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($metricsText)) {
        $statusCounts = @{
            confirmed = 0
            completed = 0
            noShow = 0
            cancelled = 0
        }
        $statusSeries = Parse-PrometheusCounterSeries -MetricsText $metricsText -MetricName 'pielarmonia_appointments_total'
        foreach ($row in $statusSeries) {
            $labels = $row.Labels
            if ($null -eq $labels -or -not $labels.ContainsKey('status')) {
                continue
            }
            $status = [string]$labels['status']
            $value = [int]([Math]::Round([double]$row.Value))
            if ($value -lt 0) {
                $value = 0
            }
            switch ($status) {
                'confirmed' { $statusCounts.confirmed += $value }
                'completed' { $statusCounts.completed += $value }
                'no_show'   { $statusCounts.noShow += $value }
                'cancelled' { $statusCounts.cancelled += $value }
            }
        }

        $appointmentsNonCancelled = $statusCounts.confirmed + $statusCounts.completed + $statusCounts.noShow
        $appointmentsTotal = $appointmentsNonCancelled + $statusCounts.cancelled
        $noShowRatePct = [Math]::Round((Get-ScalarMetricValue -MetricsText $metricsText -MetricName 'pielarmonia_no_show_rate' -DefaultValue 0) * 100, 1)
        $completionRatePct = if ($appointmentsNonCancelled -gt 0) {
            [Math]::Round(($statusCounts.completed / [double]$appointmentsNonCancelled) * 100, 1)
        } else {
            0.0
        }
        $uniquePatients = [int]([Math]::Round((Get-ScalarMetricValue -MetricsText $metricsText -MetricName 'pielarmonia_patients_unique_total' -DefaultValue 0)))
        $recurrentPatients = [int]([Math]::Round((Get-ScalarMetricValue -MetricsText $metricsText -MetricName 'pielarmonia_patients_recurrent_total' -DefaultValue 0)))
        $recurrenceRateRaw = Get-ScalarMetricValue -MetricsText $metricsText -MetricName 'pielarmonia_patient_recurrence_rate' -DefaultValue 0
        if ($recurrenceRateRaw -le 0 -and $uniquePatients -gt 0 -and $recurrentPatients -gt 0) {
            $recurrenceRateRaw = $recurrentPatients / [double]$uniquePatients
        }
        $recurrenceRatePct = [Math]::Round($recurrenceRateRaw * 100, 1)

        $retention = [pscustomobject]@{
            appointmentsTotal = $appointmentsTotal
            appointmentsNonCancelled = $appointmentsNonCancelled
            statusCounts = [pscustomobject]$statusCounts
            noShowRatePct = $noShowRatePct
            completionRatePct = $completionRatePct
            uniquePatients = $uniquePatients
            recurrentPatients = $recurrentPatients
            recurrenceRatePct = $recurrenceRatePct
        }
    }
}

if ($null -eq $retention) {
    $retention = [pscustomobject]@{
        appointmentsTotal = 0
        appointmentsNonCancelled = 0
        statusCounts = [pscustomobject]@{
            confirmed = 0
            completed = 0
            noShow = 0
            cancelled = 0
        }
        noShowRatePct = 0.0
        completionRatePct = 0.0
        uniquePatients = 0
        recurrentPatients = 0
        recurrenceRatePct = 0.0
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
$bookingConfirmedRatePct = if ($startCheckout -gt 0) {
    [Math]::Round(($bookingConfirmed / [double]$startCheckout) * 100, 2)
} else {
    0.0
}
$startCheckoutRatePct = if ($viewBooking -gt 0) {
    [Math]::Round(($startCheckout / [double]$viewBooking) * 100, 2)
} else {
    0.0
}
$checkoutAbandonRatePct = if ($startCheckout -gt 0) {
    [Math]::Round(($checkoutAbandon / [double]$startCheckout) * 100, 2)
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
$sentryBackendConfigured = [bool](Get-ObjectValueOrDefault -Object $health -Property 'sentryBackendConfigured' -DefaultValue $false)
$sentryFrontendConfigured = [bool](Get-ObjectValueOrDefault -Object $health -Property 'sentryFrontendConfigured' -DefaultValue $false)

$retentionStatusCounts = Get-ObjectValueOrDefault -Object $retention -Property 'statusCounts' -DefaultValue $null
$retentionAppointmentsTotal = [int](Get-ObjectValueOrDefault -Object $retention -Property 'appointmentsTotal' -DefaultValue 0)
$retentionAppointmentsNonCancelled = [int](Get-ObjectValueOrDefault -Object $retention -Property 'appointmentsNonCancelled' -DefaultValue 0)
$retentionConfirmed = [int](Get-ObjectValueOrDefault -Object $retentionStatusCounts -Property 'confirmed' -DefaultValue 0)
$retentionCompleted = [int](Get-ObjectValueOrDefault -Object $retentionStatusCounts -Property 'completed' -DefaultValue 0)
$retentionNoShow = [int](Get-ObjectValueOrDefault -Object $retentionStatusCounts -Property 'noShow' -DefaultValue 0)
$retentionCancelled = [int](Get-ObjectValueOrDefault -Object $retentionStatusCounts -Property 'cancelled' -DefaultValue 0)
$retentionNoShowRatePct = [double](Get-ObjectValueOrDefault -Object $retention -Property 'noShowRatePct' -DefaultValue 0)
$retentionCompletionRatePct = [double](Get-ObjectValueOrDefault -Object $retention -Property 'completionRatePct' -DefaultValue 0)
$retentionUniquePatients = [int](Get-ObjectValueOrDefault -Object $retention -Property 'uniquePatients' -DefaultValue 0)
$retentionRecurrentPatients = [int](Get-ObjectValueOrDefault -Object $retention -Property 'recurrentPatients' -DefaultValue 0)
$retentionRecurrenceRatePct = [double](Get-ObjectValueOrDefault -Object $retention -Property 'recurrenceRatePct' -DefaultValue 0)

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
if ($retentionNoShowRatePct -ge $NoShowRateWarnPct) {
    $warnings.Add("no_show_rate_alta_${retentionNoShowRatePct}pct")
}
if (-not $sentryBackendConfigured) {
    $warnings.Add('sentry_backend_no_configurado')
}
if (-not $sentryFrontendConfigured) {
    $warnings.Add('sentry_frontend_no_configurado')
}

$reportGeneratedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$reportDate = Get-Date -Format 'yyyy-MM-dd'
$reportDateCompact = Get-Date -Format 'yyyyMMdd'

Ensure-Directory -Path $OutputDir
$reportMdPath = Join-Path $OutputDir "weekly-report-$reportDateCompact.md"
$reportJsonPath = Join-Path $OutputDir "weekly-report-$reportDateCompact.json"
$previousReport = $null
$previousReportDate = ''
$reportCandidates = Get-ChildItem -Path $OutputDir -Filter 'weekly-report-*.json' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending
foreach ($candidate in $reportCandidates) {
    if ($candidate.FullName -eq $reportJsonPath) {
        continue
    }
    $payload = Read-JsonFileSafe -Path $candidate.FullName
    if ($null -ne $payload) {
        $previousReport = $payload
        break
    }
}
if ($null -eq $previousReport -and (Test-Path -LiteralPath $reportJsonPath)) {
    $previousReport = Read-JsonFileSafe -Path $reportJsonPath
}
if ($null -ne $previousReport) {
    $previousReportDate = [string](Get-ObjectValueOrDefault -Object $previousReport -Property 'generatedAt' -DefaultValue '')
}

$previousRetention = if ($null -ne $previousReport) {
    Get-ObjectValueOrDefault -Object $previousReport -Property 'retention' -DefaultValue $null
} else {
    $null
}
$previousConversion = if ($null -ne $previousReport) {
    Get-ObjectValueOrDefault -Object $previousReport -Property 'conversion' -DefaultValue $null
} else {
    $null
}
$retentionNoShowRateDeltaPct = $null
$retentionRecurrenceRateDeltaPct = $null
if ($null -ne $previousRetention) {
    $previousNoShowRatePct = [double](Get-ObjectValueOrDefault -Object $previousRetention -Property 'noShowRatePct' -DefaultValue 0)
    $previousRecurrenceRatePct = [double](Get-ObjectValueOrDefault -Object $previousRetention -Property 'recurrenceRatePct' -DefaultValue 0)
    $retentionNoShowRateDeltaPct = [Math]::Round(($retentionNoShowRatePct - $previousNoShowRatePct), 2)
    $retentionRecurrenceRateDeltaPct = [Math]::Round(($retentionRecurrenceRatePct - $previousRecurrenceRatePct), 2)
}
$previousStartCheckout = $null
$previousBookingConfirmed = $null
$previousViewBooking = $null
$previousBookingConfirmedRatePct = $null
$previousStartCheckoutRatePct = $null
if ($null -ne $previousConversion) {
    $previousViewBooking = [int](Get-ObjectValueOrDefault -Object $previousConversion -Property 'viewBooking' -DefaultValue 0)
    $previousStartCheckout = [int](Get-ObjectValueOrDefault -Object $previousConversion -Property 'startCheckout' -DefaultValue 0)
    $previousBookingConfirmed = [int](Get-ObjectValueOrDefault -Object $previousConversion -Property 'bookingConfirmed' -DefaultValue 0)
    if (Get-ObjectValueOrDefault -Object $previousConversion -Property 'bookingConfirmedRatePct' -DefaultValue $null) {
        $previousBookingConfirmedRatePct = [double](Get-ObjectValueOrDefault -Object $previousConversion -Property 'bookingConfirmedRatePct' -DefaultValue 0)
    } elseif ($previousStartCheckout -gt 0) {
        $previousBookingConfirmedRatePct = [Math]::Round(($previousBookingConfirmed / [double]$previousStartCheckout) * 100, 2)
    }
    if (Get-ObjectValueOrDefault -Object $previousConversion -Property 'startCheckoutRatePct' -DefaultValue $null) {
        $previousStartCheckoutRatePct = [double](Get-ObjectValueOrDefault -Object $previousConversion -Property 'startCheckoutRatePct' -DefaultValue 0)
    } elseif ($previousViewBooking -gt 0) {
        $previousStartCheckoutRatePct = [Math]::Round(($previousStartCheckout / [double]$previousViewBooking) * 100, 2)
    }
} elseif ($null -ne $previousReport) {
    $previousSummary = Get-ObjectValueOrDefault -Object $previousReport -Property 'summary' -DefaultValue $null
    if ($null -ne $previousSummary) {
        $previousViewBooking = [int](Get-ObjectValueOrDefault -Object $previousSummary -Property 'viewBooking' -DefaultValue 0)
        $previousStartCheckout = [int](Get-ObjectValueOrDefault -Object $previousSummary -Property 'startCheckout' -DefaultValue 0)
        $previousBookingConfirmed = [int](Get-ObjectValueOrDefault -Object $previousSummary -Property 'bookingConfirmed' -DefaultValue 0)
        if ($previousStartCheckout -gt 0) {
            $previousBookingConfirmedRatePct = [Math]::Round(($previousBookingConfirmed / [double]$previousStartCheckout) * 100, 2)
        }
        if ($previousViewBooking -gt 0) {
            $previousStartCheckoutRatePct = [Math]::Round(($previousStartCheckout / [double]$previousViewBooking) * 100, 2)
        }
    }
}
$bookingConfirmedRateDeltaPct = $null
if ($null -ne $previousBookingConfirmedRatePct) {
    $bookingConfirmedRateDeltaPct = [Math]::Round(($bookingConfirmedRatePct - $previousBookingConfirmedRatePct), 2)
}
$startCheckoutRateDeltaPct = $null
if ($null -ne $previousStartCheckoutRatePct) {
    $startCheckoutRateDeltaPct = [Math]::Round(($startCheckoutRatePct - $previousStartCheckoutRatePct), 2)
}

$benchTable = @()
foreach ($row in $benchResults) {
    $benchTable += "| $($row.Name) | $($row.Samples) | $($row.AvgMs) | $($row.P95Ms) | $($row.MaxMs) | $($row.StatusFailures) | $($row.NetworkFailures) |"
}
$retentionNoShowRateDeltaLabel = if ($null -eq $retentionNoShowRateDeltaPct) { 'n/a' } else { [string]$retentionNoShowRateDeltaPct }
$retentionRecurrenceRateDeltaLabel = if ($null -eq $retentionRecurrenceRateDeltaPct) { 'n/a' } else { [string]$retentionRecurrenceRateDeltaPct }
$bookingConfirmedRateDeltaLabel = if ($null -eq $bookingConfirmedRateDeltaPct) { 'n/a' } else { [string]$bookingConfirmedRateDeltaPct }
$startCheckoutRateDeltaLabel = if ($null -eq $startCheckoutRateDeltaPct) { 'n/a' } else { [string]$startCheckoutRateDeltaPct }

$retentionSampleSufficientForRecurrence = $retentionUniquePatients -ge $RecurrenceWarnMinUniquePatients
if ($retentionSampleSufficientForRecurrence -and $retentionRecurrenceRatePct -lt $RecurrenceRateMinWarnPct) {
    $warnings.Add("recurrence_rate_baja_${retentionRecurrenceRatePct}pct")
}
if (
    $retentionSampleSufficientForRecurrence -and
    $null -ne $retentionRecurrenceRateDeltaPct -and
    $retentionRecurrenceRateDeltaPct -le (-1 * [Math]::Abs($RecurrenceRateDropWarnPct))
) {
    $warnings.Add("recurrence_rate_caida_${retentionRecurrenceRateDeltaPct}pct")
}
$conversionSampleSufficient = $startCheckout -ge $ConversionWarnMinStartCheckout
$previousConversionSampleSufficient = ($null -ne $previousStartCheckout) -and ($previousStartCheckout -ge $ConversionWarnMinStartCheckout)
if ($conversionSampleSufficient -and $bookingConfirmedRatePct -lt $ConversionRateMinWarnPct) {
    $warnings.Add("conversion_rate_baja_${bookingConfirmedRatePct}pct")
}
if (
    $conversionSampleSufficient -and
    $previousConversionSampleSufficient -and
    $null -ne $bookingConfirmedRateDeltaPct -and
    $bookingConfirmedRateDeltaPct -le (-1 * [Math]::Abs($ConversionRateDropWarnPct))
) {
    $warnings.Add("conversion_rate_caida_${bookingConfirmedRateDeltaPct}pct")
}
$startCheckoutSampleSufficient = $viewBooking -ge $StartCheckoutWarnMinViewBooking
$previousStartCheckoutSampleSufficient = ($null -ne $previousViewBooking) -and ($previousViewBooking -ge $StartCheckoutWarnMinViewBooking)
if ($startCheckoutSampleSufficient -and $startCheckoutRatePct -lt $StartCheckoutRateMinWarnPct) {
    $warnings.Add("start_checkout_rate_baja_${startCheckoutRatePct}pct")
}
if (
    $startCheckoutSampleSufficient -and
    $previousStartCheckoutSampleSufficient -and
    $null -ne $startCheckoutRateDeltaPct -and
    $startCheckoutRateDeltaPct -le (-1 * [Math]::Abs($StartCheckoutRateDropWarnPct))
) {
    $warnings.Add("start_checkout_rate_caida_${startCheckoutRateDeltaPct}pct")
}
$warningsCritical = New-Object System.Collections.Generic.List[string]
$warningsNonCritical = New-Object System.Collections.Generic.List[string]
foreach ($warningCode in $warnings) {
    $warningSeverity = Get-WarningSeverity -WarningCode $warningCode
    if ($warningSeverity -eq 'non_critical') {
        $warningsNonCritical.Add($warningCode)
    } else {
        $warningsCritical.Add($warningCode)
    }
}
$warningCountsTotal = $warnings.Count
$warningCountsCritical = $warningsCritical.Count
$warningCountsNonCritical = $warningsNonCritical.Count
$warningBlock = if ($warnings.Count -eq 0) {
    '- none'
} else {
    ($warnings | ForEach-Object { "- $_" }) -join "`n"
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
- start_checkout_rate_pct: $startCheckoutRatePct
- booking_confirmed: $bookingConfirmed
- checkout_abandon: $checkoutAbandon
- booking_error: $bookingError
- checkout_error: $checkoutError
- booking_error_rate_pct: $errorRatePct
- booking_confirmed_rate_pct: $bookingConfirmedRatePct
- checkout_abandon_rate_pct: $checkoutAbandonRatePct
- conversion_warning_sample_sufficient: $conversionSampleSufficient (start_checkout >= $ConversionWarnMinStartCheckout)
- conversion_min_warn_pct: $ConversionRateMinWarnPct
- conversion_drop_warn_pct: $ConversionRateDropWarnPct
- start_checkout_warning_sample_sufficient: $startCheckoutSampleSufficient (view_booking >= $StartCheckoutWarnMinViewBooking)
- start_checkout_min_warn_pct: $StartCheckoutRateMinWarnPct
- start_checkout_drop_warn_pct: $StartCheckoutRateDropWarnPct
- previous_report_generated_at: $previousReportDate
- start_checkout_rate_delta_pct: $startCheckoutRateDeltaLabel
- booking_confirmed_rate_delta_pct: $bookingConfirmedRateDeltaLabel

## Calendar Health

- calendar_source: $calendarSource
- calendar_mode: $calendarMode
- calendar_reachable: $calendarReachable
- calendar_token_healthy: $calendarTokenHealthy
- calendar_last_success_at: $calendarLastSuccessAt

## Observability

- sentry_backend_configured: $sentryBackendConfigured
- sentry_frontend_configured: $sentryFrontendConfigured

## Retention

- appointments_total: $retentionAppointmentsTotal
- appointments_non_cancelled: $retentionAppointmentsNonCancelled
- status_confirmed: $retentionConfirmed
- status_completed: $retentionCompleted
- status_no_show: $retentionNoShow
- status_cancelled: $retentionCancelled
- no_show_rate_pct: $retentionNoShowRatePct
- completion_rate_pct: $retentionCompletionRatePct
- unique_patients: $retentionUniquePatients
- recurrent_patients: $retentionRecurrentPatients
- recurrence_rate_pct: $retentionRecurrenceRatePct
- recurrence_warning_sample_sufficient: $retentionSampleSufficientForRecurrence (unique_patients >= $RecurrenceWarnMinUniquePatients)
- recurrence_min_warn_pct: $RecurrenceRateMinWarnPct
- recurrence_drop_warn_pct: $RecurrenceRateDropWarnPct
- previous_report_generated_at: $previousReportDate
- no_show_rate_delta_pct: $retentionNoShowRateDeltaLabel
- recurrence_rate_delta_pct: $retentionRecurrenceRateDeltaLabel

## Latency Bench

- core_p95_max_ms: $coreP95Max (target <= $CoreP95MaxMs)
- figo_post_p95_ms: $figoPostP95 (target <= $FigoPostP95MaxMs)

| endpoint | samples | avg_ms | p95_ms | max_ms | status_failures | network_failures |
|---|---:|---:|---:|---:|---:|---:|
$($benchTable -join "`n")

## Warnings

- warnings_total: $warningCountsTotal
- warnings_critical: $warningCountsCritical
- warnings_non_critical: $warningCountsNonCritical

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
    conversion = [ordered]@{
        viewBooking = $viewBooking
        startCheckout = $startCheckout
        bookingConfirmed = $bookingConfirmed
        checkoutAbandon = $checkoutAbandon
        bookingError = $bookingError
        checkoutError = $checkoutError
        startCheckoutRatePct = [Math]::Round([double]$startCheckoutRatePct, 2)
        bookingConfirmedRatePct = [Math]::Round([double]$bookingConfirmedRatePct, 2)
        checkoutAbandonRatePct = [Math]::Round([double]$checkoutAbandonRatePct, 2)
        errorRatePct = [Math]::Round([double]$errorRatePct, 2)
        startCheckoutWarningSampleSufficient = [bool]$startCheckoutSampleSufficient
        startCheckoutWarnMinViewBooking = $StartCheckoutWarnMinViewBooking
        startCheckoutMinWarnPct = [Math]::Round([double]$StartCheckoutRateMinWarnPct, 2)
        startCheckoutDropWarnPct = [Math]::Round([double]$StartCheckoutRateDropWarnPct, 2)
        conversionWarningSampleSufficient = [bool]$conversionSampleSufficient
        conversionWarnMinStartCheckout = $ConversionWarnMinStartCheckout
        conversionMinWarnPct = [Math]::Round([double]$ConversionRateMinWarnPct, 2)
        conversionDropWarnPct = [Math]::Round([double]$ConversionRateDropWarnPct, 2)
    }
    conversionTrend = [ordered]@{
        previousReportGeneratedAt = $previousReportDate
        startCheckoutRateDeltaPct = $startCheckoutRateDeltaPct
        bookingConfirmedRateDeltaPct = $bookingConfirmedRateDeltaPct
    }
    calendar = [ordered]@{
        source = $calendarSource
        mode = $calendarMode
        reachable = $calendarReachable
        tokenHealthy = $calendarTokenHealthy
        lastSuccessAt = $calendarLastSuccessAt
    }
    observability = [ordered]@{
        sentryBackendConfigured = $sentryBackendConfigured
        sentryFrontendConfigured = $sentryFrontendConfigured
    }
    retention = [ordered]@{
        appointmentsTotal = $retentionAppointmentsTotal
        appointmentsNonCancelled = $retentionAppointmentsNonCancelled
        statusCounts = [ordered]@{
            confirmed = $retentionConfirmed
            completed = $retentionCompleted
            noShow = $retentionNoShow
            cancelled = $retentionCancelled
        }
        noShowRatePct = [Math]::Round([double]$retentionNoShowRatePct, 2)
        completionRatePct = [Math]::Round([double]$retentionCompletionRatePct, 2)
        uniquePatients = $retentionUniquePatients
        recurrentPatients = $retentionRecurrentPatients
        recurrenceRatePct = [Math]::Round([double]$retentionRecurrenceRatePct, 2)
        recurrenceWarningSampleSufficient = [bool]$retentionSampleSufficientForRecurrence
        recurrenceWarnMinUniquePatients = $RecurrenceWarnMinUniquePatients
        recurrenceMinWarnPct = [Math]::Round([double]$RecurrenceRateMinWarnPct, 2)
        recurrenceDropWarnPct = [Math]::Round([double]$RecurrenceRateDropWarnPct, 2)
    }
    retentionTrend = [ordered]@{
        previousReportGeneratedAt = $previousReportDate
        noShowRateDeltaPct = $retentionNoShowRateDeltaPct
        recurrenceRateDeltaPct = $retentionRecurrenceRateDeltaPct
    }
    latency = [ordered]@{
        coreP95MaxMs = $coreP95Max
        coreP95TargetMs = $CoreP95MaxMs
        figoPostP95Ms = $figoPostP95
        figoPostP95TargetMs = $FigoPostP95MaxMs
        bench = $benchResults
    }
    warningCounts = [ordered]@{
        total = $warningCountsTotal
        critical = $warningCountsCritical
        nonCritical = $warningCountsNonCritical
    }
    warningsBySeverity = [ordered]@{
        critical = @($warningsCritical)
        nonCritical = @($warningsNonCritical)
    }
    warningsCritical = @($warningsCritical)
    warningsNonCritical = @($warningsNonCritical)
    warnings = @($warnings)
}
$reportPayload | ConvertTo-Json -Depth 10 | Set-Content -Path $reportJsonPath -Encoding UTF8

Write-Host ''
Write-Host "Reporte markdown: $reportMdPath"
Write-Host "Reporte json: $reportJsonPath"
Write-Host "start_checkout_rate_pct=$startCheckoutRatePct booking_confirmed=$bookingConfirmed booking_confirmed_rate_pct=$bookingConfirmedRatePct error_rate_pct=$errorRatePct core_p95_max_ms=$coreP95Max figo_post_p95_ms=$figoPostP95"
Write-Host "retention_no_show_rate_pct=$retentionNoShowRatePct retention_recurrence_rate_pct=$retentionRecurrenceRatePct sentry_backend=$sentryBackendConfigured sentry_frontend=$sentryFrontendConfigured"
if ($warnings.Count -gt 0) {
    Write-Host "Warnings: $($warnings -join ', ')" -ForegroundColor Yellow
    Write-Host "Warnings by severity: critical=$warningCountsCritical non_critical=$warningCountsNonCritical" -ForegroundColor Yellow
    if ($FailOnWarnings) {
        Write-Host 'FailOnWarnings activo: reporte marcado como fallido.' -ForegroundColor Red
        exit 2
    }
    if ($FailOnCriticalWarnings -and $warningCountsCritical -gt 0) {
        Write-Host 'FailOnCriticalWarnings activo: reporte marcado como fallido por warnings criticos.' -ForegroundColor Red
        exit 2
    }
    if ($FailOnCriticalWarnings -and $warningCountsCritical -eq 0) {
        Write-Host 'FailOnCriticalWarnings activo: solo se detectaron warnings no criticos.' -ForegroundColor Yellow
    }
} else {
    Write-Host 'Warnings: none' -ForegroundColor Green
}
