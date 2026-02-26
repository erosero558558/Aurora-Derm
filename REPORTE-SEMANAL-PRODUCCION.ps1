param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$BenchRuns = 15,
    [int]$TimeoutSec = 20,
    [string]$OutputDir = 'verification/weekly',
    [int]$RetentionReportDays = 30,
    [int]$CoreP95MaxMs = 800,
    [int]$FigoPostP95MaxMs = 2500,
    [double]$NoShowRateWarnPct = 20,
    [double]$IdempotencyConflictRateWarnPct = 5,
    [double]$RecurrenceRateMinWarnPct = 30,
    [double]$RecurrenceRateDropWarnPct = 15,
    [int]$RecurrenceWarnMinUniquePatients = 5,
    [double]$ConversionRateMinWarnPct = 25,
    [double]$ConversionRateDropWarnPct = 15,
    [int]$ConversionWarnMinStartCheckout = 10,
    [double]$StartCheckoutRateMinWarnPct = 0.25,
    [double]$StartCheckoutRateDropWarnPct = 0.2,
    [int]$StartCheckoutWarnMinViewBooking = 100,
    [int]$ServiceFunnelWarnMinDetailViews = 25,
    [int]$ServiceFunnelWarnMinCheckoutStarts = 5,
    [double]$ServiceFunnelCheckoutToConfirmedMinWarnPct = 35,
    [double]$ServiceFunnelDetailToConfirmedMinWarnPct = 8,
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

function Convert-ToArraySafe {
    param([object]$Value)
    if ($null -eq $Value) {
        return @()
    }
    if ($Value -is [System.Array]) {
        return @($Value)
    }
    $toArrayMethod = $Value.PSObject.Methods['ToArray']
    if ($null -ne $toArrayMethod) {
        return @($Value.ToArray())
    }
    return @($Value)
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
        'retention_report_',
        'idempotency_conflict_rate_alta_',
        'recurrence_rate_',
        'conversion_rate_',
        'start_checkout_rate_',
        'service_funnel_'
    )) {
        if ($WarningCode.StartsWith($prefix)) {
            return 'non_critical'
        }
    }

    # Default conservador: si aparece un warning nuevo no clasificado, tratarlo como critico.
    return 'critical'
}

function Get-WarningImpact {
    param([string]$WarningCode)

    if ([string]::IsNullOrWhiteSpace($WarningCode)) {
        return 'platform'
    }

    if ($WarningCode.StartsWith('calendar_')) {
        return 'agenda'
    }
    if ($WarningCode.StartsWith('figo_post_p95_alto_')) {
        return 'chat'
    }
    if ($WarningCode.StartsWith('conversion_rate_') -or $WarningCode.StartsWith('start_checkout_rate_')) {
        return 'conversion'
    }
    if ($WarningCode.StartsWith('service_funnel_')) {
        return 'conversion'
    }
    if ($WarningCode.StartsWith('idempotency_conflict_rate_alta_')) {
        return 'conversion'
    }
    if ($WarningCode.StartsWith('recurrence_rate_') -or $WarningCode.StartsWith('no_show_rate_alta_')) {
        return 'retention'
    }
    if ($WarningCode.StartsWith('retention_report_')) {
        return 'retention'
    }
    if ($WarningCode.StartsWith('sentry_')) {
        return 'observability'
    }

    return 'platform'
}

function Get-WarningRunbookRef {
    param([string]$WarningCode)

    if ([string]::IsNullOrWhiteSpace($WarningCode)) {
        return 'docs/RUNBOOKS.md#2-respuesta-a-incidentes-emergency-response'
    }

    if ($WarningCode -eq 'calendar_unreachable' -or $WarningCode -eq 'calendar_token_unhealthy' -or $WarningCode.StartsWith('calendar_')) {
        return 'docs/RUNBOOKS.md#21-sitio-caido-http-500--timeout'
    }
    if ($WarningCode.StartsWith('figo_post_p95_alto_')) {
        return 'docs/RUNBOOKS.md#24-chatbot-no-responde'
    }
    if ($WarningCode.StartsWith('core_p95_alto_') -or $WarningCode.StartsWith('error_rate_alta_')) {
        return 'docs/RUNBOOKS.md#25-falso-negativo-de-gate-por-latencia-p95'
    }
    if ($WarningCode.StartsWith('sentry_')) {
        return 'docs/MONITORING_SETUP.md'
    }
    if ($WarningCode.StartsWith('conversion_rate_') -or $WarningCode.StartsWith('start_checkout_rate_')) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }
    if ($WarningCode.StartsWith('service_funnel_')) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }
    if ($WarningCode.StartsWith('idempotency_conflict_rate_alta_')) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }
    if ($WarningCode.StartsWith('recurrence_rate_') -or $WarningCode.StartsWith('no_show_rate_alta_')) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }
    if ($WarningCode.StartsWith('retention_report_')) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }

    return 'docs/RUNBOOKS.md#2-respuesta-a-incidentes-emergency-response'
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
$retentionReportResult = Invoke-JsonGet -Name 'retention-report' -Url "$base/api.php?resource=retention-report&days=$RetentionReportDays"

if (-not $healthResult.Ok) {
    throw "No se pudo consultar health: $($healthResult.Error)"
}
$health = $healthResult.Json
$summary = $null
$events = @{}
$retention = $null
$idempotency = $null
$metricsText = ''
$funnelSource = 'funnel-metrics'
$retentionReportSource = 'uninitialized'
$retentionReportError = ''
$retentionReportMeta = [ordered]@{}
$retentionReportSummary = [ordered]@{}
$retentionReportAlerts = @()
$retentionReportAlertCodes = @()
$retentionReportAlertCount = 0
$retentionReportAlertWarnCount = 0
$retentionReportAlertCriticalCount = 0
$retentionReportWarningCode = ''

if ($funnelResult.Ok -and $null -ne $funnelResult.Json -and [bool]($funnelResult.Json.ok)) {
    $funnel = $funnelResult.Json.data
    $summary = $funnel.summary
    $retention = Get-ObjectValueOrDefault -Object $funnel -Property 'retention' -DefaultValue $null
    $idempotency = Get-ObjectValueOrDefault -Object $funnel -Property 'idempotency' -DefaultValue $null
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

if ($retentionReportResult.Ok -and $null -ne $retentionReportResult.Json -and [bool]($retentionReportResult.Json.ok)) {
    $retentionReportSource = 'retention-report'
    $retentionReportData = Get-ObjectValueOrDefault -Object $retentionReportResult.Json -Property 'data' -DefaultValue $null
    $retentionReportMetaRaw = Get-ObjectValueOrDefault -Object $retentionReportData -Property 'meta' -DefaultValue $null
    $retentionReportSummaryRaw = Get-ObjectValueOrDefault -Object $retentionReportData -Property 'summary' -DefaultValue $null
    $retentionReportAlertsRaw = Get-ObjectValueOrDefault -Object $retentionReportData -Property 'alerts' -DefaultValue @()

    $retentionReportMeta = [ordered]@{
        dateFrom = [string](Get-ObjectValueOrDefault -Object $retentionReportMetaRaw -Property 'dateFrom' -DefaultValue '')
        dateTo = [string](Get-ObjectValueOrDefault -Object $retentionReportMetaRaw -Property 'dateTo' -DefaultValue '')
        days = [int](Get-ObjectValueOrDefault -Object $retentionReportMetaRaw -Property 'days' -DefaultValue 0)
        format = [string](Get-ObjectValueOrDefault -Object $retentionReportMetaRaw -Property 'format' -DefaultValue 'json')
        timezone = [string](Get-ObjectValueOrDefault -Object $retentionReportMetaRaw -Property 'timezone' -DefaultValue 'America/Guayaquil')
        generatedAt = [string](Get-ObjectValueOrDefault -Object $retentionReportMetaRaw -Property 'generatedAt' -DefaultValue '')
    }
    $retentionReportSummary = [ordered]@{
        appointmentsTotal = [int](Get-ObjectValueOrDefault -Object $retentionReportSummaryRaw -Property 'appointmentsTotal' -DefaultValue 0)
        appointmentsNonCancelled = [int](Get-ObjectValueOrDefault -Object $retentionReportSummaryRaw -Property 'appointmentsNonCancelled' -DefaultValue 0)
        noShowRatePct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $retentionReportSummaryRaw -Property 'noShowRatePct' -DefaultValue 0), 2)
        recurrenceRatePct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $retentionReportSummaryRaw -Property 'recurrenceRatePct' -DefaultValue 0), 2)
        uniquePatients = [int](Get-ObjectValueOrDefault -Object $retentionReportSummaryRaw -Property 'uniquePatients' -DefaultValue 0)
        recurrentPatients = [int](Get-ObjectValueOrDefault -Object $retentionReportSummaryRaw -Property 'recurrentPatients' -DefaultValue 0)
    }

    foreach ($retentionReportAlertItem in @($retentionReportAlertsRaw)) {
        if ($null -eq $retentionReportAlertItem) {
            continue
        }
        $alertCode = [string](Get-ObjectValueOrDefault -Object $retentionReportAlertItem -Property 'code' -DefaultValue '')
        if ([string]::IsNullOrWhiteSpace($alertCode)) {
            $alertCode = 'unknown_alert'
        }
        $alertSeverity = [string](Get-ObjectValueOrDefault -Object $retentionReportAlertItem -Property 'severity' -DefaultValue 'warn')
        if ([string]::IsNullOrWhiteSpace($alertSeverity)) {
            $alertSeverity = 'warn'
        }
        $alertImpact = [string](Get-ObjectValueOrDefault -Object $retentionReportAlertItem -Property 'impact' -DefaultValue 'retention')
        if ([string]::IsNullOrWhiteSpace($alertImpact)) {
            $alertImpact = 'retention'
        }
        $alertThresholdPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $retentionReportAlertItem -Property 'thresholdPct' -DefaultValue 0), 2)
        $alertActualPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $retentionReportAlertItem -Property 'actualPct' -DefaultValue 0), 2)
        $alertMinSample = [int](Get-ObjectValueOrDefault -Object $retentionReportAlertItem -Property 'minSample' -DefaultValue 0)

        if ($alertSeverity -eq 'critical') {
            $retentionReportAlertCriticalCount++
        } else {
            $retentionReportAlertWarnCount++
        }

        $retentionReportAlertCodes += $alertCode
        $retentionReportAlerts += [ordered]@{
            code = $alertCode
            severity = $alertSeverity
            impact = $alertImpact
            thresholdPct = $alertThresholdPct
            actualPct = $alertActualPct
            minSample = $alertMinSample
        }
    }

    $retentionReportAlertCount = $retentionReportAlerts.Count
} elseif ($retentionReportResult.Ok) {
    $retentionReportSource = 'invalid_payload'
    $retentionReportError = 'retention-report payload invalido'
    $retentionReportWarningCode = 'retention_report_invalid_payload'
} else {
    $retentionReportSource = 'unreachable'
    $retentionReportError = [string]$retentionReportResult.Error
    $retentionReportWarningCode = 'retention_report_unreachable'
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

if ($null -eq $idempotency) {
    if ([string]::IsNullOrWhiteSpace($metricsText)) {
        $metricsFallbackResult = Invoke-TextGet -Name 'metrics-idempotency' -Url "$base/api.php?resource=metrics"
        if ($metricsFallbackResult.Ok) {
            $metricsText = [string]$metricsFallbackResult.Body
        }
    }

    $idempotencySeries = Parse-PrometheusCounterSeries -MetricsText $metricsText -MetricName 'booking_idempotency_events_total'
    $idempotencyCounts = @{
        new = 0
        replay = 0
        conflict = 0
        unknown = 0
    }
    foreach ($row in $idempotencySeries) {
        $labels = $row.Labels
        $value = [int]([Math]::Round([double]$row.Value))
        if ($value -le 0) {
            continue
        }
        $outcome = 'unknown'
        if ($null -ne $labels -and $labels.ContainsKey('outcome')) {
            $outcome = [string]$labels['outcome']
        }
        if ([string]::IsNullOrWhiteSpace($outcome)) {
            $outcome = 'unknown'
        }
        $outcome = $outcome.ToLowerInvariant()
        if (-not $idempotencyCounts.ContainsKey($outcome)) {
            $outcome = 'unknown'
        }
        $idempotencyCounts[$outcome] = [int]$idempotencyCounts[$outcome] + $value
    }
    $idempotencyRequestsWithKey = [int]$idempotencyCounts.new + [int]$idempotencyCounts.replay + [int]$idempotencyCounts.conflict + [int]$idempotencyCounts.unknown
    $idempotencyConflictRatePct = if ($idempotencyRequestsWithKey -gt 0) {
        [Math]::Round(([double]$idempotencyCounts.conflict / [double]$idempotencyRequestsWithKey) * 100, 2)
    } else {
        0.0
    }
    $idempotencyReplayRatePct = if ($idempotencyRequestsWithKey -gt 0) {
        [Math]::Round(([double]$idempotencyCounts.replay / [double]$idempotencyRequestsWithKey) * 100, 2)
    } else {
        0.0
    }
    $idempotency = [pscustomobject]@{
        requestsWithKey = $idempotencyRequestsWithKey
        new = [int]$idempotencyCounts.new
        replay = [int]$idempotencyCounts.replay
        conflict = [int]$idempotencyCounts.conflict
        unknown = [int]$idempotencyCounts.unknown
        conflictRatePct = $idempotencyConflictRatePct
        replayRatePct = $idempotencyReplayRatePct
    }
}

if ($null -eq $idempotency) {
    $idempotency = [pscustomobject]@{
        requestsWithKey = 0
        new = 0
        replay = 0
        conflict = 0
        unknown = 0
        conflictRatePct = 0.0
        replayRatePct = 0.0
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
$idempotencyRequestsWithKey = [int](Get-ObjectValueOrDefault -Object $idempotency -Property 'requestsWithKey' -DefaultValue 0)
$idempotencyNew = [int](Get-ObjectValueOrDefault -Object $idempotency -Property 'new' -DefaultValue 0)
$idempotencyReplay = [int](Get-ObjectValueOrDefault -Object $idempotency -Property 'replay' -DefaultValue 0)
$idempotencyConflict = [int](Get-ObjectValueOrDefault -Object $idempotency -Property 'conflict' -DefaultValue 0)
$idempotencyUnknown = [int](Get-ObjectValueOrDefault -Object $idempotency -Property 'unknown' -DefaultValue 0)
$idempotencyConflictRatePct = [double](Get-ObjectValueOrDefault -Object $idempotency -Property 'conflictRatePct' -DefaultValue 0)
$idempotencyReplayRatePct = [double](Get-ObjectValueOrDefault -Object $idempotency -Property 'replayRatePct' -DefaultValue 0)

$serviceFunnelRowsRaw = @()
if ($null -ne $funnel) {
    $serviceFunnelRowsRaw = @(
        Get-ObjectValueOrDefault -Object $funnel -Property 'serviceFunnel' -DefaultValue @()
    )
}
$serviceFunnelSource = if ($serviceFunnelRowsRaw.Count -gt 0) { 'funnel-metrics' } else { 'missing' }
$serviceFunnelRows = @()
$serviceFunnelAlertCodes = New-Object System.Collections.Generic.List[string]
$serviceFunnelAlerts = New-Object System.Collections.Generic.List[object]
$serviceFunnelAlertSeen = @{}

foreach ($serviceRow in $serviceFunnelRowsRaw) {
    if ($null -eq $serviceRow) {
        continue
    }

    $serviceSlug = [string](Get-ObjectValueOrDefault -Object $serviceRow -Property 'serviceSlug' -DefaultValue '')
    if ([string]::IsNullOrWhiteSpace($serviceSlug)) {
        continue
    }

    $detailViews = [int](Get-ObjectValueOrDefault -Object $serviceRow -Property 'detailViews' -DefaultValue 0)
    $bookingIntent = [int](Get-ObjectValueOrDefault -Object $serviceRow -Property 'bookingIntent' -DefaultValue 0)
    $checkoutStarts = [int](Get-ObjectValueOrDefault -Object $serviceRow -Property 'checkoutStarts' -DefaultValue 0)
    $bookingConfirmedService = [int](Get-ObjectValueOrDefault -Object $serviceRow -Property 'bookingConfirmed' -DefaultValue 0)
    $intentToCheckoutPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $serviceRow -Property 'intentToCheckoutPct' -DefaultValue 0), 2)
    $checkoutToConfirmedPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $serviceRow -Property 'checkoutToConfirmedPct' -DefaultValue 0), 2)
    $detailToConfirmedPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $serviceRow -Property 'detailToConfirmedPct' -DefaultValue 0), 2)

    $serviceFunnelRows += [ordered]@{
        serviceSlug = $serviceSlug
        detailViews = $detailViews
        bookingIntent = $bookingIntent
        checkoutStarts = $checkoutStarts
        bookingConfirmed = $bookingConfirmedService
        intentToCheckoutPct = $intentToCheckoutPct
        checkoutToConfirmedPct = $checkoutToConfirmedPct
        detailToConfirmedPct = $detailToConfirmedPct
    }

    if ($detailViews -ge $ServiceFunnelWarnMinDetailViews -and $checkoutStarts -lt $ServiceFunnelWarnMinCheckoutStarts) {
        $alertCode = "service_funnel_checkout_low_${serviceSlug}_${checkoutStarts}"
        if (-not $serviceFunnelAlertSeen.ContainsKey($alertCode)) {
            $serviceFunnelAlertSeen[$alertCode] = $true
            $serviceFunnelAlertCodes.Add($alertCode) | Out-Null
            $serviceFunnelAlerts.Add([ordered]@{
                code = $alertCode
                severity = 'warn'
                serviceSlug = $serviceSlug
                reason = 'checkout_starts_low'
                actual = $checkoutStarts
                threshold = $ServiceFunnelWarnMinCheckoutStarts
                detailViews = $detailViews
            }) | Out-Null
        }
    }

    if ($checkoutStarts -ge $ServiceFunnelWarnMinCheckoutStarts -and $checkoutToConfirmedPct -lt $ServiceFunnelCheckoutToConfirmedMinWarnPct) {
        $alertCode = "service_funnel_checkout_to_confirmed_baja_${serviceSlug}_${checkoutToConfirmedPct}pct"
        if (-not $serviceFunnelAlertSeen.ContainsKey($alertCode)) {
            $serviceFunnelAlertSeen[$alertCode] = $true
            $serviceFunnelAlertCodes.Add($alertCode) | Out-Null
            $serviceFunnelAlerts.Add([ordered]@{
                code = $alertCode
                severity = 'warn'
                serviceSlug = $serviceSlug
                reason = 'checkout_to_confirmed_low'
                actualPct = $checkoutToConfirmedPct
                thresholdPct = $ServiceFunnelCheckoutToConfirmedMinWarnPct
                checkoutStarts = $checkoutStarts
            }) | Out-Null
        }
    }

    if ($detailViews -ge $ServiceFunnelWarnMinDetailViews -and $detailToConfirmedPct -lt $ServiceFunnelDetailToConfirmedMinWarnPct) {
        $alertCode = "service_funnel_detail_to_confirmed_baja_${serviceSlug}_${detailToConfirmedPct}pct"
        if (-not $serviceFunnelAlertSeen.ContainsKey($alertCode)) {
            $serviceFunnelAlertSeen[$alertCode] = $true
            $serviceFunnelAlertCodes.Add($alertCode) | Out-Null
            $serviceFunnelAlerts.Add([ordered]@{
                code = $alertCode
                severity = 'warn'
                serviceSlug = $serviceSlug
                reason = 'detail_to_confirmed_low'
                actualPct = $detailToConfirmedPct
                thresholdPct = $ServiceFunnelDetailToConfirmedMinWarnPct
                detailViews = $detailViews
            }) | Out-Null
        }
    }
}

$serviceFunnelRows = @(
    $serviceFunnelRows |
        Sort-Object -Property `
            @{ Expression = { [int](Get-ObjectValueOrDefault -Object $_ -Property 'bookingConfirmed' -DefaultValue 0) }; Descending = $true }, `
            @{ Expression = { [int](Get-ObjectValueOrDefault -Object $_ -Property 'detailViews' -DefaultValue 0) }; Descending = $true }, `
            @{ Expression = { [string](Get-ObjectValueOrDefault -Object $_ -Property 'serviceSlug' -DefaultValue '') }; Descending = $false }
)
$serviceFunnelTopRows = @($serviceFunnelRows | Select-Object -First 8)
$serviceFunnelRowsCount = $serviceFunnelRows.Count
$serviceFunnelRowsWithDetailSample = @($serviceFunnelRows | Where-Object { [int](Get-ObjectValueOrDefault -Object $_ -Property 'detailViews' -DefaultValue 0) -ge $ServiceFunnelWarnMinDetailViews }).Count
$serviceFunnelRowsWithCheckoutSample = @($serviceFunnelRows | Where-Object { [int](Get-ObjectValueOrDefault -Object $_ -Property 'checkoutStarts' -DefaultValue 0) -ge $ServiceFunnelWarnMinCheckoutStarts }).Count
if ($serviceFunnelRowsCount -eq 0 -and $startCheckout -ge $ConversionWarnMinStartCheckout) {
    $missingAlertCode = 'service_funnel_missing'
    if (-not $serviceFunnelAlertSeen.ContainsKey($missingAlertCode)) {
        $serviceFunnelAlertSeen[$missingAlertCode] = $true
        $serviceFunnelAlertCodes.Add($missingAlertCode) | Out-Null
        $serviceFunnelAlerts.Add([ordered]@{
            code = $missingAlertCode
            severity = 'warn'
            serviceSlug = 'all'
            reason = 'service_funnel_payload_missing'
            actual = 0
            threshold = 1
            startCheckout = $startCheckout
        }) | Out-Null
    }
}
$serviceFunnelAlertCount = $serviceFunnelAlertCodes.Count
$serviceFunnelAlertCodesLabel = if ($serviceFunnelAlertCodes.Count -eq 0) { 'none' } else { (@($serviceFunnelAlertCodes) -join ', ') }
$serviceFunnelAlertListLabel = if ($serviceFunnelAlerts.Count -eq 0) {
    'none'
} else {
    @(
        $serviceFunnelAlerts | ForEach-Object {
            $alertCode = [string](Get-ObjectValueOrDefault -Object $_ -Property 'code' -DefaultValue 'service_funnel_unknown')
            $reason = [string](Get-ObjectValueOrDefault -Object $_ -Property 'reason' -DefaultValue 'unknown')
            $serviceSlug = [string](Get-ObjectValueOrDefault -Object $_ -Property 'serviceSlug' -DefaultValue 'unknown')
            "$alertCode(service:$serviceSlug reason:$reason)"
        }
    ) -join '; '
}
$serviceFunnelTopRowsBlock = if ($serviceFunnelTopRows.Count -eq 0) {
    '- none'
} else {
    @(
        $serviceFunnelTopRows | ForEach-Object {
            $serviceSlug = [string](Get-ObjectValueOrDefault -Object $_ -Property 'serviceSlug' -DefaultValue 'unknown')
            $detailViews = [int](Get-ObjectValueOrDefault -Object $_ -Property 'detailViews' -DefaultValue 0)
            $bookingIntent = [int](Get-ObjectValueOrDefault -Object $_ -Property 'bookingIntent' -DefaultValue 0)
            $checkoutStarts = [int](Get-ObjectValueOrDefault -Object $_ -Property 'checkoutStarts' -DefaultValue 0)
            $bookingConfirmedService = [int](Get-ObjectValueOrDefault -Object $_ -Property 'bookingConfirmed' -DefaultValue 0)
            $checkoutToConfirmedPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $_ -Property 'checkoutToConfirmedPct' -DefaultValue 0), 2)
            $detailToConfirmedPct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $_ -Property 'detailToConfirmedPct' -DefaultValue 0), 2)
            "- $serviceSlug | detail:$detailViews intent:$bookingIntent checkout:$checkoutStarts confirmed:$bookingConfirmedService checkout_to_confirmed_pct:$checkoutToConfirmedPct detail_to_confirmed_pct:$detailToConfirmedPct"
        }
    ) -join "`n"
}

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
if (-not [string]::IsNullOrWhiteSpace($retentionReportWarningCode)) {
    $warnings.Add($retentionReportWarningCode)
}
if (-not $sentryBackendConfigured) {
    $warnings.Add('sentry_backend_no_configurado')
}
if (-not $sentryFrontendConfigured) {
    $warnings.Add('sentry_frontend_no_configurado')
}
$idempotencySampleSufficient = $idempotencyRequestsWithKey -ge 10
if ($idempotencySampleSufficient -and $idempotencyConflictRatePct -ge $IdempotencyConflictRateWarnPct) {
    $warnings.Add("idempotency_conflict_rate_alta_${idempotencyConflictRatePct}pct")
}

$reportGeneratedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$reportDate = Get-Date -Format 'yyyy-MM-dd'
$reportDateCompact = Get-Date -Format 'yyyyMMdd'

Ensure-Directory -Path $OutputDir
$reportMdPath = Join-Path $OutputDir "weekly-report-$reportDateCompact.md"
$reportJsonPath = Join-Path $OutputDir "weekly-report-$reportDateCompact.json"
$retentionBaselinePath = Join-Path $OutputDir 'retention-baseline.json'
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

$retentionBaselineRaw = Read-JsonFileSafe -Path $retentionBaselinePath
$retentionBaselineGeneratedAt = ''
$retentionBaselineNoShowRatePct = $null
$retentionBaselineRecurrenceRatePct = $null
$retentionBaselineSource = 'missing'
if ($null -ne $retentionBaselineRaw) {
    $retentionBaselineGeneratedAt = [string](Get-ObjectValueOrDefault -Object $retentionBaselineRaw -Property 'generatedAt' -DefaultValue '')
    $baselineNoShowRaw = Get-ObjectValueOrDefault -Object $retentionBaselineRaw -Property 'noShowRatePct' -DefaultValue $null
    if ($null -ne $baselineNoShowRaw -and [string]$baselineNoShowRaw -ne '') {
        try {
            $retentionBaselineNoShowRatePct = [Math]::Round([double]$baselineNoShowRaw, 2)
        } catch {
            $retentionBaselineNoShowRatePct = $null
        }
    }
    $baselineRecurrenceRaw = Get-ObjectValueOrDefault -Object $retentionBaselineRaw -Property 'recurrenceRatePct' -DefaultValue $null
    if ($null -ne $baselineRecurrenceRaw -and [string]$baselineRecurrenceRaw -ne '') {
        try {
            $retentionBaselineRecurrenceRatePct = [Math]::Round([double]$baselineRecurrenceRaw, 2)
        } catch {
            $retentionBaselineRecurrenceRatePct = $null
        }
    }
    if ($null -ne $retentionBaselineNoShowRatePct -and $null -ne $retentionBaselineRecurrenceRatePct) {
        $retentionBaselineSource = 'persisted_file'
    }
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
if ($null -eq $retentionBaselineNoShowRatePct -or $null -eq $retentionBaselineRecurrenceRatePct) {
    if ($null -ne $previousRetention) {
        $retentionBaselineNoShowRatePct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $previousRetention -Property 'noShowRatePct' -DefaultValue $retentionNoShowRatePct), 2)
        $retentionBaselineRecurrenceRatePct = [Math]::Round([double](Get-ObjectValueOrDefault -Object $previousRetention -Property 'recurrenceRatePct' -DefaultValue $retentionRecurrenceRatePct), 2)
        $retentionBaselineGeneratedAt = if ([string]::IsNullOrWhiteSpace($previousReportDate)) { $reportGeneratedAt } else { $previousReportDate }
        $retentionBaselineSource = 'seeded_from_previous_report'
    } else {
        $retentionBaselineNoShowRatePct = [Math]::Round([double]$retentionNoShowRatePct, 2)
        $retentionBaselineRecurrenceRatePct = [Math]::Round([double]$retentionRecurrenceRatePct, 2)
        $retentionBaselineGeneratedAt = $reportGeneratedAt
        $retentionBaselineSource = 'seeded_current_report'
    }
}
$retentionTrendReady = ($null -ne $retentionNoShowRateDeltaPct) -and ($null -ne $retentionRecurrenceRateDeltaPct)
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
$retentionBaselineNoShowLabel = if ($null -eq $retentionBaselineNoShowRatePct) { 'n/a' } else { [string]$retentionBaselineNoShowRatePct }
$retentionBaselineRecurrenceLabel = if ($null -eq $retentionBaselineRecurrenceRatePct) { 'n/a' } else { [string]$retentionBaselineRecurrenceRatePct }
$retentionReportAlertCodesLabel = if ($retentionReportAlertCodes.Count -eq 0) { 'none' } else { ($retentionReportAlertCodes -join ', ') }
$retentionReportAlertBlock = if ($retentionReportAlerts.Count -eq 0) {
    '- none'
} else {
    ($retentionReportAlerts | ForEach-Object {
        "- code: $($_.code) | severity: $($_.severity) | actualPct: $($_.actualPct) | thresholdPct: $($_.thresholdPct) | minSample: $($_.minSample)"
    }) -join "`n"
}
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
foreach ($serviceFunnelWarningCode in $serviceFunnelAlertCodes) {
    if ([string]::IsNullOrWhiteSpace([string]$serviceFunnelWarningCode)) {
        continue
    }
    $warnings.Add([string]$serviceFunnelWarningCode)
}
$warningsCritical = New-Object System.Collections.Generic.List[string]
$warningsNonCritical = New-Object System.Collections.Generic.List[string]
$warningDetails = New-Object System.Collections.Generic.List[object]
foreach ($warningCode in $warnings) {
    $warningSeverity = Get-WarningSeverity -WarningCode $warningCode
    $warningImpact = Get-WarningImpact -WarningCode $warningCode
    $warningRunbookRef = Get-WarningRunbookRef -WarningCode $warningCode
    $warningDetails.Add([pscustomobject]@{
        code = $warningCode
        severity = $warningSeverity
        impact = $warningImpact
        runbookRef = $warningRunbookRef
    })
    if ($warningSeverity -eq 'non_critical') {
        $warningsNonCritical.Add($warningCode)
    } else {
        $warningsCritical.Add($warningCode)
    }
}
$warningsByImpact = [ordered]@{
    agenda = @()
    chat = @()
    conversion = @()
    retention = @()
    observability = @()
    platform = @()
}
foreach ($item in $warningDetails) {
    $impactKey = [string]$item.impact
    if (-not $warningsByImpact.Contains($impactKey)) {
        $warningsByImpact[$impactKey] = @()
    }
    $warningsByImpact[$impactKey] += [string]$item.code
}
$warningCountsTotal = $warnings.Count
$warningCountsCritical = $warningsCritical.Count
$warningCountsNonCritical = $warningsNonCritical.Count
$releaseDecision = 'pass'
$releaseReason = 'no_warnings'
if ($warningCountsCritical -gt 0) {
    $releaseDecision = 'block'
    $releaseReason = 'critical_warnings'
} elseif ($warningCountsNonCritical -gt 0) {
    $releaseDecision = 'warn'
    $releaseReason = 'non_critical_warnings'
}
$releaseAction = switch ($releaseDecision) {
    'block' { 'Stop release and execute incident runbook immediately.' }
    'warn' { 'Allow release with monitoring and follow-up hardening task.' }
    default { 'Release allowed.' }
}
$warningBlock = if ($warnings.Count -eq 0) {
    '- none'
} else {
    ($warnings | ForEach-Object { "- $_" }) -join "`n"
}
$warningDetailBlock = if ($warningDetails.Count -eq 0) {
    '- none'
} else {
    ($warningDetails | ForEach-Object { "- code: $($_.code) | severity: $($_.severity) | impact: $($_.impact) | runbook: $($_.runbookRef)" }) -join "`n"
}
$warningsByImpactPayload = [ordered]@{}
foreach ($impactKey in $warningsByImpact.Keys) {
    $warningsByImpactPayload[$impactKey] = @($warningsByImpact[$impactKey])
}
$warningDetailsPayload = @(
    $warningDetails | ForEach-Object {
        [ordered]@{
            code = [string]$_.code
            severity = [string]$_.severity
            impact = [string]$_.impact
            runbookRef = [string]$_.runbookRef
        }
    }
)

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

## Service Funnel

- source: $serviceFunnelSource
- rows: $serviceFunnelRowsCount
- rows_detail_sample: $serviceFunnelRowsWithDetailSample (detail_views >= $ServiceFunnelWarnMinDetailViews)
- rows_checkout_sample: $serviceFunnelRowsWithCheckoutSample (checkout_starts >= $ServiceFunnelWarnMinCheckoutStarts)
- alert_count: $serviceFunnelAlertCount
- alert_codes: $serviceFunnelAlertCodesLabel
- alert_list: $serviceFunnelAlertListLabel
- checkout_to_confirmed_min_warn_pct: $ServiceFunnelCheckoutToConfirmedMinWarnPct
- detail_to_confirmed_min_warn_pct: $ServiceFunnelDetailToConfirmedMinWarnPct

$serviceFunnelTopRowsBlock

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
- retention_baseline_source: $retentionBaselineSource
- retention_baseline_generated_at: $retentionBaselineGeneratedAt
- retention_baseline_no_show_rate_pct: $retentionBaselineNoShowLabel
- retention_baseline_recurrence_rate_pct: $retentionBaselineRecurrenceLabel
- retention_trend_ready: $retentionTrendReady

## Retention Report Alerts

- source: $retentionReportSource
- days: $RetentionReportDays
- alert_count: $retentionReportAlertCount
- warn_count: $retentionReportAlertWarnCount
- critical_count: $retentionReportAlertCriticalCount
- alert_codes: $retentionReportAlertCodesLabel
- error: $retentionReportError

$retentionReportAlertBlock

## Idempotency

- requests_with_key: $idempotencyRequestsWithKey
- new: $idempotencyNew
- replay: $idempotencyReplay
- conflict: $idempotencyConflict
- unknown: $idempotencyUnknown
- replay_rate_pct: $idempotencyReplayRatePct
- conflict_rate_pct: $idempotencyConflictRatePct
- conflict_warning_sample_sufficient: $idempotencySampleSufficient (requests_with_key >= 10)
- conflict_warn_pct_threshold: $IdempotencyConflictRateWarnPct

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

## Warning Details

$warningDetailBlock

## Incident Triage (<= 15 min)

- minute_0_5: run `npm run gate:prod:fast` and check health/availability/chat status.
- minute_5_10: pick first critical warning and follow `runbookRef`.
- minute_10_15: if still degraded, escalate and open/refresh incident issue `[ALERTA PROD]`.

## Release Guardrails

- release_decision: $releaseDecision
- release_reason: $releaseReason
- release_action: $releaseAction
"@

$retentionBaselinePayload = [ordered]@{
    generatedAt = $retentionBaselineGeneratedAt
    noShowRatePct = $retentionBaselineNoShowRatePct
    recurrenceRatePct = $retentionBaselineRecurrenceRatePct
    source = $retentionBaselineSource
}

Set-Content -Path $reportMdPath -Value $markdown -Encoding UTF8
$retentionBaselinePayload | ConvertTo-Json -Depth 6 | Set-Content -Path $retentionBaselinePath -Encoding UTF8

$summaryPayload = [ordered]@{}
$summaryPayload.viewBooking = $viewBooking
$summaryPayload.startCheckout = $startCheckout
$summaryPayload.bookingConfirmed = $bookingConfirmed
$summaryPayload.checkoutAbandon = $checkoutAbandon
$summaryPayload.bookingError = $bookingError
$summaryPayload.checkoutError = $checkoutError
$summaryPayload.bookingErrorRatePct = $errorRatePct

$conversionPayload = [ordered]@{}
$conversionPayload.viewBooking = $viewBooking
$conversionPayload.startCheckout = $startCheckout
$conversionPayload.bookingConfirmed = $bookingConfirmed
$conversionPayload.checkoutAbandon = $checkoutAbandon
$conversionPayload.bookingError = $bookingError
$conversionPayload.checkoutError = $checkoutError
$conversionPayload.startCheckoutRatePct = [Math]::Round([double]$startCheckoutRatePct, 2)
$conversionPayload.bookingConfirmedRatePct = [Math]::Round([double]$bookingConfirmedRatePct, 2)
$conversionPayload.checkoutAbandonRatePct = [Math]::Round([double]$checkoutAbandonRatePct, 2)
$conversionPayload.errorRatePct = [Math]::Round([double]$errorRatePct, 2)
$conversionPayload.startCheckoutWarningSampleSufficient = [bool]$startCheckoutSampleSufficient
$conversionPayload.startCheckoutWarnMinViewBooking = $StartCheckoutWarnMinViewBooking
$conversionPayload.startCheckoutMinWarnPct = [Math]::Round([double]$StartCheckoutRateMinWarnPct, 2)
$conversionPayload.startCheckoutDropWarnPct = [Math]::Round([double]$StartCheckoutRateDropWarnPct, 2)
$conversionPayload.conversionWarningSampleSufficient = [bool]$conversionSampleSufficient
$conversionPayload.conversionWarnMinStartCheckout = $ConversionWarnMinStartCheckout
$conversionPayload.conversionMinWarnPct = [Math]::Round([double]$ConversionRateMinWarnPct, 2)
$conversionPayload.conversionDropWarnPct = [Math]::Round([double]$ConversionRateDropWarnPct, 2)

$conversionTrendPayload = [ordered]@{}
$conversionTrendPayload.previousReportGeneratedAt = $previousReportDate
$conversionTrendPayload.startCheckoutRateDeltaPct = $startCheckoutRateDeltaPct
$conversionTrendPayload.bookingConfirmedRateDeltaPct = $bookingConfirmedRateDeltaPct

$serviceFunnelThresholdsPayload = [ordered]@{}
$serviceFunnelThresholdsPayload.minDetailViews = $ServiceFunnelWarnMinDetailViews
$serviceFunnelThresholdsPayload.minCheckoutStarts = $ServiceFunnelWarnMinCheckoutStarts
$serviceFunnelThresholdsPayload.checkoutToConfirmedMinWarnPct = [Math]::Round([double]$ServiceFunnelCheckoutToConfirmedMinWarnPct, 2)
$serviceFunnelThresholdsPayload.detailToConfirmedMinWarnPct = [Math]::Round([double]$ServiceFunnelDetailToConfirmedMinWarnPct, 2)

$serviceFunnelPayload = [ordered]@{}
$serviceFunnelPayload.source = $serviceFunnelSource
$serviceFunnelPayload.rows = $serviceFunnelRowsCount
$serviceFunnelPayload.rowsDetailSample = $serviceFunnelRowsWithDetailSample
$serviceFunnelPayload.rowsCheckoutSample = $serviceFunnelRowsWithCheckoutSample
$serviceFunnelPayload.thresholds = $serviceFunnelThresholdsPayload
$serviceFunnelPayload.top = @($serviceFunnelTopRows)
$serviceFunnelPayload.alertCount = $serviceFunnelAlertCount
$serviceFunnelPayload.alertCodes = @($serviceFunnelAlertCodes)
$serviceFunnelPayload['alerts'] = Convert-ToArraySafe -Value $serviceFunnelAlerts

$calendarPayload = [ordered]@{}
$calendarPayload.source = $calendarSource
$calendarPayload.mode = $calendarMode
$calendarPayload.reachable = $calendarReachable
$calendarPayload.tokenHealthy = $calendarTokenHealthy
$calendarPayload.lastSuccessAt = $calendarLastSuccessAt

$observabilityPayload = [ordered]@{}
$observabilityPayload.sentryBackendConfigured = $sentryBackendConfigured
$observabilityPayload.sentryFrontendConfigured = $sentryFrontendConfigured

$retentionStatusCountsPayload = [ordered]@{}
$retentionStatusCountsPayload.confirmed = $retentionConfirmed
$retentionStatusCountsPayload.completed = $retentionCompleted
$retentionStatusCountsPayload.noShow = $retentionNoShow
$retentionStatusCountsPayload.cancelled = $retentionCancelled

$retentionPayload = [ordered]@{}
$retentionPayload.appointmentsTotal = $retentionAppointmentsTotal
$retentionPayload.appointmentsNonCancelled = $retentionAppointmentsNonCancelled
$retentionPayload.statusCounts = $retentionStatusCountsPayload
$retentionPayload.noShowRatePct = [Math]::Round([double]$retentionNoShowRatePct, 2)
$retentionPayload.completionRatePct = [Math]::Round([double]$retentionCompletionRatePct, 2)
$retentionPayload.uniquePatients = $retentionUniquePatients
$retentionPayload.recurrentPatients = $retentionRecurrentPatients
$retentionPayload.recurrenceRatePct = [Math]::Round([double]$retentionRecurrenceRatePct, 2)
$retentionPayload.recurrenceWarningSampleSufficient = [bool]$retentionSampleSufficientForRecurrence
$retentionPayload.recurrenceWarnMinUniquePatients = $RecurrenceWarnMinUniquePatients
$retentionPayload.recurrenceMinWarnPct = [Math]::Round([double]$RecurrenceRateMinWarnPct, 2)
$retentionPayload.recurrenceDropWarnPct = [Math]::Round([double]$RecurrenceRateDropWarnPct, 2)

$retentionReportAlertCountsPayload = [ordered]@{}
$retentionReportAlertCountsPayload.total = $retentionReportAlertCount
$retentionReportAlertCountsPayload.warn = $retentionReportAlertWarnCount
$retentionReportAlertCountsPayload.critical = $retentionReportAlertCriticalCount

$retentionReportPayload = [ordered]@{}
$retentionReportPayload.source = $retentionReportSource
$retentionReportPayload.days = $RetentionReportDays
$retentionReportPayload.error = $retentionReportError
$retentionReportPayload.meta = $retentionReportMeta
$retentionReportPayload.summary = $retentionReportSummary
$retentionReportPayload.alertCounts = $retentionReportAlertCountsPayload
$retentionReportPayload['alerts'] = Convert-ToArraySafe -Value $retentionReportAlerts
$retentionReportPayload.alertCodes = @($retentionReportAlertCodes)

$idempotencyPayload = [ordered]@{}
$idempotencyPayload.requestsWithKey = $idempotencyRequestsWithKey
$idempotencyPayload.new = $idempotencyNew
$idempotencyPayload.replay = $idempotencyReplay
$idempotencyPayload.conflict = $idempotencyConflict
$idempotencyPayload.unknown = $idempotencyUnknown
$idempotencyPayload.conflictRatePct = [Math]::Round([double]$idempotencyConflictRatePct, 2)
$idempotencyPayload.replayRatePct = [Math]::Round([double]$idempotencyReplayRatePct, 2)
$idempotencyPayload.conflictWarningSampleSufficient = [bool]$idempotencySampleSufficient
$idempotencyPayload.conflictWarnPctThreshold = [Math]::Round([double]$IdempotencyConflictRateWarnPct, 2)

$retentionTrendPayload = [ordered]@{}
$retentionTrendPayload.previousReportGeneratedAt = $previousReportDate
$retentionTrendPayload.noShowRateDeltaPct = $retentionNoShowRateDeltaPct
$retentionTrendPayload.recurrenceRateDeltaPct = $retentionRecurrenceRateDeltaPct
$retentionTrendPayload.trendReady = [bool]$retentionTrendReady

$retentionBaselinePayloadForReport = [ordered]@{}
$retentionBaselinePayloadForReport.generatedAt = $retentionBaselineGeneratedAt
$retentionBaselinePayloadForReport.noShowRatePct = $retentionBaselineNoShowRatePct
$retentionBaselinePayloadForReport.recurrenceRatePct = $retentionBaselineRecurrenceRatePct
$retentionBaselinePayloadForReport.source = $retentionBaselineSource

$latencyPayload = [ordered]@{}
$latencyPayload.coreP95MaxMs = $coreP95Max
$latencyPayload.coreP95TargetMs = $CoreP95MaxMs
$latencyPayload.figoPostP95Ms = $figoPostP95
$latencyPayload.figoPostP95TargetMs = $FigoPostP95MaxMs
$latencyPayload.bench = $benchResults

$warningCountsPayload = [ordered]@{}
$warningCountsPayload.total = $warningCountsTotal
$warningCountsPayload.critical = $warningCountsCritical
$warningCountsPayload.nonCritical = $warningCountsNonCritical

$releaseGuardrailsPayload = [ordered]@{}
$releaseGuardrailsPayload.decision = $releaseDecision
$releaseGuardrailsPayload.reason = $releaseReason
$releaseGuardrailsPayload.action = $releaseAction
$releaseGuardrailsPayload.criticalWarnings = @($warningsCritical)
$releaseGuardrailsPayload.nonCriticalWarnings = @($warningsNonCritical)

$warningsBySeverityPayload = [ordered]@{}
$warningsBySeverityPayload.critical = @($warningsCritical)
$warningsBySeverityPayload.nonCritical = @($warningsNonCritical)

$triagePlaybookPayload = [ordered]@{}
$triagePlaybookPayload.targetMinutes = 15
$triagePlaybookPayload.quickChecks = @(
    'npm run gate:prod:fast',
    'GET /api.php?resource=health',
    'GET /api.php?resource=availability',
    'POST /figo-chat.php'
)
$triagePlaybookPayload.defaultRunbook = 'docs/RUNBOOKS.md#2-respuesta-a-incidentes-emergency-response'

$reportPayload = [ordered]@{}
$reportPayload.generatedAt = $reportGeneratedAt
$reportPayload.domain = $base
$reportPayload.summary = $summaryPayload
$reportPayload.conversion = $conversionPayload
$reportPayload.conversionTrend = $conversionTrendPayload
$reportPayload.serviceFunnel = $serviceFunnelPayload
$reportPayload.calendar = $calendarPayload
$reportPayload.observability = $observabilityPayload
$reportPayload.retention = $retentionPayload
$reportPayload.retentionReport = $retentionReportPayload
$reportPayload.idempotency = $idempotencyPayload
$reportPayload.retentionTrend = $retentionTrendPayload
$reportPayload.retentionBaseline = $retentionBaselinePayloadForReport
$reportPayload.latency = $latencyPayload
$reportPayload.warningCounts = $warningCountsPayload
$reportPayload.releaseGuardrails = $releaseGuardrailsPayload
$reportPayload.warningsBySeverity = $warningsBySeverityPayload
$reportPayload.warningsByImpact = $warningsByImpactPayload
$reportPayload.warningDetails = $warningDetailsPayload
$reportPayload.warningsCritical = @($warningsCritical)
$reportPayload.warningsNonCritical = @($warningsNonCritical)
$reportPayload.warnings = @($warnings)
$reportPayload.triagePlaybook = $triagePlaybookPayload
$reportPayload | ConvertTo-Json -Depth 10 | Set-Content -Path $reportJsonPath -Encoding UTF8

Write-Host ''
Write-Host "Reporte markdown: $reportMdPath"
Write-Host "Reporte json: $reportJsonPath"
Write-Host "start_checkout_rate_pct=$startCheckoutRatePct booking_confirmed=$bookingConfirmed booking_confirmed_rate_pct=$bookingConfirmedRatePct error_rate_pct=$errorRatePct core_p95_max_ms=$coreP95Max figo_post_p95_ms=$figoPostP95"
Write-Host "retention_no_show_rate_pct=$retentionNoShowRatePct retention_recurrence_rate_pct=$retentionRecurrenceRatePct retention_report_alert_count=$retentionReportAlertCount sentry_backend=$sentryBackendConfigured sentry_frontend=$sentryFrontendConfigured"
Write-Host "idempotency_requests_with_key=$idempotencyRequestsWithKey idempotency_conflict_rate_pct=$idempotencyConflictRatePct idempotency_replay_rate_pct=$idempotencyReplayRatePct"
Write-Host "service_funnel_source=$serviceFunnelSource service_funnel_rows=$serviceFunnelRowsCount service_funnel_alert_count=$serviceFunnelAlertCount"
Write-Host "release_decision=$releaseDecision release_reason=$releaseReason"
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
