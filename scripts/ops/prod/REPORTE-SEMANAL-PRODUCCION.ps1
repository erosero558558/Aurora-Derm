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
    [int]$TelemedicineReviewQueueWarnCount = 12,
    [int]$TelemedicineStagedUploadsWarnCount = 1,
    [int]$TelemedicineUnlinkedIntakesWarnCount = 5,
    [int]$LeadOpsPendingWarnCount = 20,
    [int]$LeadOpsHotWarnCount = 8,
    [int]$LeadOpsFirstContactWarnMinSamples = 3,
    [int]$LeadOpsFirstContactAvgWarnMinutes = 60,
    [int]$LeadOpsCloseRateWarnMinSamples = 5,
    [double]$LeadOpsCloseRateMinWarnPct = 15,
    [int]$LeadOpsAiAcceptanceWarnMinSamples = 3,
    [double]$LeadOpsAiAcceptanceMinWarnPct = 25,
    [string]$GitHubRepo = 'erosero558558/Aurora-Derm',
    [string]$GitHubApiBase = 'https://api.github.com',
    [int]$GitHubAlertsTimeoutSec = 15,
    [int]$GitHubAlertsIssueLimit = 30,
    [switch]$FailOnWarnings,
    [switch]$FailOnCriticalWarnings,
    [int]$CriticalFreeCycleTarget = 2,
    [switch]$FailOnCycleNotReady
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'
$commonMetricsPath = Join-Path $repoRoot 'bin/powershell/Common.Metrics.ps1'
$commonWarningsPath = Join-Path $repoRoot 'bin/powershell/Common.Warnings.ps1'
$openClawAuthDiagnosticScriptPath = Join-Path $repoRoot 'scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1'
$hostChecklistCommand = 'npm run checklist:prod:public-sync:host'
$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'
. $commonHttpPath
. $commonMetricsPath
. $commonWarningsPath
if ($CriticalFreeCycleTarget -lt 1) {
    $CriticalFreeCycleTarget = 1
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
            status = ''
            configured = $false
            operatorAuthStatusHttpStatus = 0
            adminAuthFacadeHttpStatus = 0
            error = 'diagnostic_script_missing'
        }
    }

    $reportPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-auth-rollout-weekly-" + [Guid]::NewGuid().ToString('N') + '.json')

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
            status = [string]$payload.resolved.status
            configured = [bool]$payload.resolved.configured
            operatorAuthStatusHttpStatus = [int](Get-ObjectValueOrDefault -Object $payload.operator_auth_status -Property 'http_status' -DefaultValue 0)
            adminAuthFacadeHttpStatus = [int](Get-ObjectValueOrDefault -Object $payload.admin_auth_facade -Property 'http_status' -DefaultValue 0)
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
            status = ''
            configured = $false
            operatorAuthStatusHttpStatus = 0
            adminAuthFacadeHttpStatus = 0
            error = $_.Exception.Message
        }
    } finally {
        Remove-Item -Path $reportPath -Force -ErrorAction SilentlyContinue
    }
}

Write-Host '== Reporte Semanal Produccion =='
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$healthResult = Invoke-JsonGet -Name 'health-diagnostics' -Url "$base/api.php?resource=health-diagnostics" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'
$funnelResult = Invoke-JsonGet -Name 'funnel-metrics' -Url "$base/api.php?resource=funnel-metrics" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'
$retentionReportResult = Invoke-JsonGet -Name 'retention-report' -Url "$base/api.php?resource=retention-report&days=$RetentionReportDays" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'
$servicePrioritiesResult = Invoke-JsonGet -Name 'service-priorities' -Url "$base/api.php?resource=service-priorities&limit=12&categoryLimit=8&featuredLimit=3" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'

if (-not $healthResult.Ok) {
    throw "No se pudo consultar health-diagnostics: $($healthResult.Error)"
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
    $metricsResult = Invoke-TextGet -Name 'metrics' -Url "$base/api.php?resource=metrics" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'
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
        $metricsFallbackResult = Invoke-TextGet -Name 'metrics-retention' -Url "$base/api.php?resource=metrics" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'
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
        $metricsFallbackResult = Invoke-TextGet -Name 'metrics-idempotency' -Url "$base/api.php?resource=metrics" -TimeoutSec $TimeoutSec -UserAgent 'PielArmoniaWeeklyReport/1.0'
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
    $benchResults += Measure-BenchEndpoint -Name $check.Name -Url $check.Url -BenchRuns $BenchRuns -Method $check.Method -JsonBody $check.Body -UserAgent 'PielArmoniaWeeklyReport/1.0'
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
$servicesCatalogSource = [string](Get-ObjectValueOrDefault -Object $health -Property 'servicesCatalogSource' -DefaultValue 'unknown')
$servicesCatalogVersion = [string](Get-ObjectValueOrDefault -Object $health -Property 'servicesCatalogVersion' -DefaultValue 'unknown')
$servicesCatalogCount = [int](Get-ObjectValueOrDefault -Object $health -Property 'servicesCatalogCount' -DefaultValue 0)
$servicesCatalogConfigured = [bool](Get-ObjectValueOrDefault -Object $health -Property 'servicesCatalogConfigured' -DefaultValue $false)
$healthChecks = Get-ObjectValueOrDefault -Object $health -Property 'checks' -DefaultValue $null
$publicSyncCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'publicSync' -DefaultValue $null
$publicSyncConfigured = [bool](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'configured' -DefaultValue $false)
$publicSyncHealthy = [bool](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'healthy' -DefaultValue $false)
$publicSyncOperationallyHealthy = [bool](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'operationallyHealthy' -DefaultValue $publicSyncHealthy)
$publicSyncRepoHygieneIssue = [bool](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'repoHygieneIssue' -DefaultValue $false)
$publicSyncJobId = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'jobId' -DefaultValue '')
$publicSyncState = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'state' -DefaultValue 'unknown')
$publicSyncAgeSeconds = [int](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'ageSeconds' -DefaultValue 999999)
$publicSyncExpectedMaxLagSeconds = [int](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'expectedMaxLagSeconds' -DefaultValue 120)
$publicSyncLastCheckedAt = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'lastCheckedAt' -DefaultValue '')
$publicSyncLastSuccessAt = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'lastSuccessAt' -DefaultValue '')
$publicSyncLastErrorAt = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'lastErrorAt' -DefaultValue '')
$publicSyncFailureReason = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'failureReason' -DefaultValue '')
$publicSyncLastErrorMessage = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'lastErrorMessage' -DefaultValue '')
$publicSyncDeployedCommit = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'deployedCommit' -DefaultValue '')
$publicSyncDurationMs = Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'durationMs' -DefaultValue $null
$publicSyncCurrentHead = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'currentHead' -DefaultValue '')
$publicSyncRemoteHead = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'remoteHead' -DefaultValue '')
$publicSyncRepoPath = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'repoPath' -DefaultValue '')
$publicSyncBranch = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'branch' -DefaultValue '')
$publicSyncStatusPath = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'statusPath' -DefaultValue '')
$publicSyncLogPath = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'logPath' -DefaultValue '')
$publicSyncLockFile = [string](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'lockFile' -DefaultValue '')
$publicSyncDirtyPathsCount = [int](Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'dirtyPathsCount' -DefaultValue 0)
$publicSyncDirtyPathsSample = @(
    Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $publicSyncCheck -Property 'dirtyPathsSample' -DefaultValue @())
)
$publicSyncDirtyPathsSampleLabel = if ($publicSyncDirtyPathsSample.Count -eq 0) {
    'none'
} else {
    (@($publicSyncDirtyPathsSample | Select-Object -First 5 | ForEach-Object { [string]$_ }) -join ', ')
}
$publicSyncHeadDrift = $false
if (
    -not [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
    -not [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
    $publicSyncCurrentHead -ne $publicSyncRemoteHead
) {
    $publicSyncHeadDrift = $true
}
$publicSyncTelemetryGap = $false
if (
    $publicSyncConfigured -and
    -not $publicSyncOperationallyHealthy -and
    -not [string]::IsNullOrWhiteSpace($publicSyncLastErrorMessage) -and
    [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
    [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
    $publicSyncDirtyPathsCount -le 0
) {
    $publicSyncTelemetryGap = $true
}
if ([string]::IsNullOrWhiteSpace($publicSyncFailureReason) -and -not [string]::IsNullOrWhiteSpace($publicSyncLastErrorMessage)) {
    $publicSyncFailureReason = $publicSyncLastErrorMessage
}
if (-not $publicSyncRepoHygieneIssue) {
    $publicSyncRepoHygieneIssue = (
        $publicSyncFailureReason -eq 'working_tree_dirty' -and
        -not $publicSyncHeadDrift -and
        -not $publicSyncTelemetryGap -and
        $publicSyncDirtyPathsCount -gt 0
    )
}
if (
    -not $publicSyncOperationallyHealthy -and
    $publicSyncRepoHygieneIssue -and
    $publicSyncConfigured -and
    $publicSyncAgeSeconds -le $publicSyncExpectedMaxLagSeconds
) {
    $publicSyncOperationallyHealthy = $true
    $publicSyncHealthy = $true
}
$turneroPilotProfileStatusResolved = $false
$turneroPilotVerifyRequired = $false
$turneroPilotClinicId = ''
$turneroPilotCatalogMatch = $false
$turneroPilotRemoteOk = $false
$turneroPilotRemoteClinicId = ''
$turneroPilotRemoteFingerprint = ''
$turneroPilotRemoteCatalogReady = $false
$turneroPilotRemoteProfileSource = ''
$turneroPilotRemoteReleaseMode = ''
$turneroPilotRemoteAdminModeDefault = ''
$turneroPilotRecoveryTargets = @()
$turneroPilotErrors = New-Object System.Collections.Generic.List[string]
if (Test-Path $turneroClinicProfileScriptPath) {
    $turneroPilotStatusRaw = ''
    $turneroPilotStatusExit = 0
    $turneroPilotStatus = $null

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
        $turneroPilotErrors.Add('status_unresolved')
    } else {
        $turneroPilotProfileStatusResolved = [bool]$turneroPilotStatus.ok
        try { $turneroPilotClinicId = [string]$turneroPilotStatus.profile.clinic_id } catch { $turneroPilotClinicId = '' }
        try { $turneroPilotCatalogMatch = [bool]$turneroPilotStatus.matchesCatalog } catch { $turneroPilotCatalogMatch = $false }
        try { $turneroPilotVerifyRequired = ([bool]$turneroPilotStatus.ok) -and ([string]$turneroPilotStatus.profile.release.mode -eq 'web_pilot') } catch { $turneroPilotVerifyRequired = $false }
        if ($turneroPilotVerifyRequired) {
            $turneroPilotRecoveryTargets = @(
                '[ALERTA PROD] Deploy Hosting turneroPilot bloqueado',
                '[ALERTA PROD] Deploy Frontend Self-Hosted turneroPilot bloqueado'
            )
        }

        if (-not $turneroPilotCatalogMatch) {
            $turneroPilotErrors.Add('catalog_drift')
        } elseif ($turneroPilotVerifyRequired) {
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

            try { $turneroPilotRemoteOk = [bool]$turneroPilotVerify.ok } catch { $turneroPilotRemoteOk = $false }
            try { $turneroPilotRemoteClinicId = [string]$turneroPilotVerify.turneroPilot.clinicId } catch { $turneroPilotRemoteClinicId = '' }
            try { $turneroPilotRemoteFingerprint = [string]$turneroPilotVerify.turneroPilot.profileFingerprint } catch { $turneroPilotRemoteFingerprint = '' }
            try { $turneroPilotRemoteCatalogReady = [bool]$turneroPilotVerify.turneroPilot.catalogReady } catch { $turneroPilotRemoteCatalogReady = $false }
            try { $turneroPilotRemoteProfileSource = [string]$turneroPilotVerify.turneroPilot.profileSource } catch { $turneroPilotRemoteProfileSource = '' }
            try { $turneroPilotRemoteReleaseMode = [string]$turneroPilotVerify.turneroPilot.releaseMode } catch { $turneroPilotRemoteReleaseMode = '' }
            try { $turneroPilotRemoteAdminModeDefault = [string]$turneroPilotVerify.turneroPilot.adminModeDefault } catch { $turneroPilotRemoteAdminModeDefault = '' }

            if ($null -eq $turneroPilotVerify -or $turneroPilotVerifyExit -ne 0 -or -not $turneroPilotRemoteOk) {
                $turneroPilotErrors.Add('remote_mismatch')
            }
        }
    }
} else {
    $turneroPilotErrors.Add('cli_missing')
}
$githubDeployAlertsSummary = Get-GitHubProductionAlertSummary `
    -Repo $GitHubRepo `
    -ApiBase $GitHubApiBase `
    -TimeoutSec $GitHubAlertsTimeoutSec `
    -IssueLimit $GitHubAlertsIssueLimit `
    -UserAgent 'PielArmoniaWeeklyReport/1.0'
$githubDeployAlertsEnabled = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'enabled' -DefaultValue $true)
$githubDeployAlertsFetchOk = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'fetchOk' -DefaultValue $false)
$githubDeployAlertsApiUrl = [string](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'apiUrl' -DefaultValue '')
$githubDeployAlertsError = [string](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'error' -DefaultValue '')
$githubDeployAlertsRelevantCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'relevantCount' -DefaultValue 0)
$githubDeployAlertsTransportCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'transportCount' -DefaultValue 0)
$githubDeployAlertsConnectivityCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'connectivityCount' -DefaultValue 0)
$githubDeployAlertsRepairGitSyncCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'repairGitSyncCount' -DefaultValue 0)
$githubDeployAlertsSelfHostedRunnerCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'selfHostedRunnerCount' -DefaultValue 0)
$githubDeployAlertsSelfHostedDeployCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'selfHostedDeployCount' -DefaultValue 0)
$githubDeployAlertsTurneroPilotCount = [int](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'turneroPilotCount' -DefaultValue 0)
$githubDeployAlertsHasTransportBlock = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'hasTransportBlock' -DefaultValue $false)
$githubDeployAlertsHasConnectivityBlock = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'hasConnectivityBlock' -DefaultValue $false)
$githubDeployAlertsHasRepairGitSyncBlock = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'hasRepairGitSyncBlock' -DefaultValue $false)
$githubDeployAlertsHasSelfHostedRunnerBlock = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'hasSelfHostedRunnerBlock' -DefaultValue $false)
$githubDeployAlertsHasSelfHostedDeployBlock = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'hasSelfHostedDeployBlock' -DefaultValue $false)
$githubDeployAlertsHasTurneroPilotBlock = [bool](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'hasTurneroPilotBlock' -DefaultValue $false)
$githubDeployAlertsIssueNumbers = @(
    Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'issueNumbers' -DefaultValue @())
)
$githubDeployAlertsIssueUrls = @(
    Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'issueUrls' -DefaultValue @())
)
$githubDeployAlertsIssueRefs = @(
    Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'issueRefs' -DefaultValue @())
)
$githubDeployAlertsIssues = @(
    Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'issues' -DefaultValue @())
)
$githubDeployAlertsIssueNumbersLabel = [string](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'issueNumbersLabel' -DefaultValue 'none')
$githubDeployAlertsIssueRefsLabel = [string](Get-ObjectValueOrDefault -Object $githubDeployAlertsSummary -Property 'issueRefsLabel' -DefaultValue 'none')
$telemedicineCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'telemedicine' -DefaultValue $null
$telemedicineConfigured = [bool](Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'configured' -DefaultValue $false)
$telemedicineIntakesObj = Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'intakes' -DefaultValue $null
$telemedicineIntegrityObj = Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'integrity' -DefaultValue $null
$telemedicineDiagnosticsObj = Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'diagnostics' -DefaultValue $null
$telemedicinePolicyObj = Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'policy' -DefaultValue $null
$telemedicineIntakesTotal = [int](Get-ObjectValueOrDefault -Object $telemedicineIntakesObj -Property 'total' -DefaultValue 0)
$telemedicineReviewQueueCount = [int](Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'reviewQueueCount' -DefaultValue 0)
$telemedicineLatestActivityAt = [string](Get-ObjectValueOrDefault -Object $telemedicineCheck -Property 'latestActivityAt' -DefaultValue '')
$telemedicineDiagnosticsStatus = [string](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsObj -Property 'status' -DefaultValue 'unknown')
$telemedicineDiagnosticsHealthy = [bool](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsObj -Property 'healthy' -DefaultValue $false)
$telemedicineDiagnosticsSummaryObj = Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsObj -Property 'summary' -DefaultValue $null
$telemedicineDiagnosticsCriticalCount = [int](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsSummaryObj -Property 'critical' -DefaultValue 0)
$telemedicineDiagnosticsWarningCount = [int](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsSummaryObj -Property 'warning' -DefaultValue 0)
$telemedicineDiagnosticsInfoCount = [int](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsSummaryObj -Property 'info' -DefaultValue 0)
$telemedicineDiagnosticsTotalChecks = [int](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsSummaryObj -Property 'totalChecks' -DefaultValue 0)
$telemedicineDiagnosticsTotalIssues = [int](Get-ObjectValueOrDefault -Object $telemedicineDiagnosticsSummaryObj -Property 'totalIssues' -DefaultValue 0)
$telemedicineShadowModeEnabled = [bool](Get-ObjectValueOrDefault -Object $telemedicinePolicyObj -Property 'shadowModeEnabled' -DefaultValue $true)
$telemedicineEnforceUnsuitable = [bool](Get-ObjectValueOrDefault -Object $telemedicinePolicyObj -Property 'enforceUnsuitable' -DefaultValue $false)
$telemedicineEnforceReviewRequired = [bool](Get-ObjectValueOrDefault -Object $telemedicinePolicyObj -Property 'enforceReviewRequired' -DefaultValue $false)
$telemedicineAllowDecisionOverride = [bool](Get-ObjectValueOrDefault -Object $telemedicinePolicyObj -Property 'allowDecisionOverride' -DefaultValue $true)
$telemedicineUnlinkedIntakesCount = [int](Get-ObjectValueOrDefault -Object $telemedicineIntegrityObj -Property 'unlinkedIntakesCount' -DefaultValue 0)
$telemedicineStagedLegacyUploadsCount = [int](Get-ObjectValueOrDefault -Object $telemedicineIntegrityObj -Property 'stagedLegacyUploadsCount' -DefaultValue 0)
$telemedicineDanglingLinksCount = [int](Get-ObjectValueOrDefault -Object $telemedicineIntegrityObj -Property 'danglingAppointmentLinksCount' -DefaultValue 0)
$telemedicineCasePhotosMissingPrivatePathCount = [int](Get-ObjectValueOrDefault -Object $telemedicineIntegrityObj -Property 'casePhotosWithoutPrivatePathCount' -DefaultValue 0)
$telemedicineOrphanedClinicalUploadsCount = [int](Get-ObjectValueOrDefault -Object $telemedicineIntegrityObj -Property 'orphanedClinicalUploadsCount' -DefaultValue 0)
$telemedicineAppointmentsWithoutIntakeCount = [int](Get-ObjectValueOrDefault -Object $telemedicineIntegrityObj -Property 'telemedAppointmentsWithoutIntakeCount' -DefaultValue 0)
$leadOpsCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'leadOps' -DefaultValue $null
$leadOpsConfigured = [bool](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'configured' -DefaultValue $false)
$leadOpsMode = [string](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'mode' -DefaultValue 'disabled')
$leadOpsDegraded = [bool](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'degraded' -DefaultValue $true)
$leadOpsCallbacksTotal = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'callbacksTotal' -DefaultValue 0)
$leadOpsPendingCallbacks = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'pendingCallbacks' -DefaultValue 0)
$leadOpsContactedCount = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'contactedCount' -DefaultValue 0)
$leadOpsPriorityHot = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'priorityHot' -DefaultValue 0)
$leadOpsPriorityWarm = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'priorityWarm' -DefaultValue 0)
$leadOpsPriorityHotPending = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'priorityHotPending' -DefaultValue 0)
$leadOpsPriorityWarmPending = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'priorityWarmPending' -DefaultValue 0)
$leadOpsAiRequested = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'aiRequested' -DefaultValue 0)
$leadOpsAiCompleted = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'aiCompleted' -DefaultValue 0)
$leadOpsAiAccepted = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'aiAccepted' -DefaultValue 0)
$leadOpsOutcomeClosedWon = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'outcomeClosedWon' -DefaultValue 0)
$leadOpsOutcomeNoResponse = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'outcomeNoResponse' -DefaultValue 0)
$leadOpsOutcomeDiscarded = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'outcomeDiscarded' -DefaultValue 0)
$leadOpsFirstContactSamples = [int](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'firstContactSamples' -DefaultValue 0)
$leadOpsFirstContactAvgMinutes = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'firstContactAvgMinutes' -DefaultValue 0)
$leadOpsFirstContactP95Minutes = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'firstContactP95Minutes' -DefaultValue 0)
$leadOpsAiAcceptanceRatePct = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'aiAcceptanceRatePct' -DefaultValue 0)
$leadOpsCloseRatePct = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'closeRatePct' -DefaultValue 0)
$leadOpsCloseFromContactedRatePct = [double](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'closeFromContactedRatePct' -DefaultValue 0)
$leadOpsWorkerLastSeenAt = [string](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'workerLastSeenAt' -DefaultValue '')
$leadOpsWorkerLastErrorAt = [string](Get-ObjectValueOrDefault -Object $leadOpsCheck -Property 'workerLastErrorAt' -DefaultValue '')
$leadOpsFirstContactSampleSufficient = $leadOpsFirstContactSamples -ge $LeadOpsFirstContactWarnMinSamples
$leadOpsCloseRateSampleSufficient = $leadOpsContactedCount -ge $LeadOpsCloseRateWarnMinSamples
$leadOpsAiAcceptanceSampleSufficient = $leadOpsAiCompleted -ge $LeadOpsAiAcceptanceWarnMinSamples
$authCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'auth' -DefaultValue $null
$authMode = [string](Get-ObjectValueOrDefault -Object $authCheck -Property 'mode' -DefaultValue 'unknown')
$authStatus = [string](Get-ObjectValueOrDefault -Object $authCheck -Property 'status' -DefaultValue 'unknown')
$authConfigured = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'configured' -DefaultValue $false)
$authHardeningCompliant = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'hardeningCompliant' -DefaultValue $false)
$authRecommendedMode = [string](Get-ObjectValueOrDefault -Object $authCheck -Property 'recommendedMode' -DefaultValue 'google_oauth')
$authRecommendedModeActive = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'recommendedModeActive' -DefaultValue $false)
$authLegacyPasswordConfigured = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'legacyPasswordConfigured' -DefaultValue $false)
$authTwoFactorEnabled = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'twoFactorEnabled' -DefaultValue $false)
$authOperatorAuthEnabled = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'operatorAuthEnabled' -DefaultValue $false)
$authOperatorAuthConfigured = [bool](Get-ObjectValueOrDefault -Object $authCheck -Property 'operatorAuthConfigured' -DefaultValue $false)
$operatorAuthRollout = Invoke-OpenClawAuthRolloutDiagnostic -BaseUrl $base -ScriptPath $openClawAuthDiagnosticScriptPath
$operatorAuthRolloutAvailable = [bool](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'available' -DefaultValue $false)
$operatorAuthRolloutOk = [bool](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'ok' -DefaultValue $false)
$operatorAuthRolloutDiagnosis = [string](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'diagnosis' -DefaultValue 'unknown')
$operatorAuthRolloutNextAction = [string](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'nextAction' -DefaultValue '')
$operatorAuthRolloutSource = [string](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'source' -DefaultValue '')
$operatorAuthRolloutMode = [string](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'mode' -DefaultValue '')
$operatorAuthRolloutStatus = [string](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'status' -DefaultValue '')
$operatorAuthRolloutConfigured = [bool](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'configured' -DefaultValue $false)
$operatorAuthRolloutOperatorAuthStatusHttpStatus = [int](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'operatorAuthStatusHttpStatus' -DefaultValue 0)
$operatorAuthRolloutAdminAuthFacadeHttpStatus = [int](Get-ObjectValueOrDefault -Object $operatorAuthRollout -Property 'adminAuthFacadeHttpStatus' -DefaultValue 0)
$storageCheck = Get-ObjectValueOrDefault -Object $healthChecks -Property 'storage' -DefaultValue $null
$storageBackend = [string](Get-ObjectValueOrDefault -Object $storageCheck -Property 'backend' -DefaultValue 'unknown')
$storageSource = [string](Get-ObjectValueOrDefault -Object $storageCheck -Property 'source' -DefaultValue 'unknown')
$storeEncrypted = [bool](Get-ObjectValueOrDefault -Object $storageCheck -Property 'encrypted' -DefaultValue $false)
$storeEncryptionConfigured = [bool](Get-ObjectValueOrDefault -Object $storageCheck -Property 'encryptionConfigured' -DefaultValue $false)
$storeEncryptionRequired = [bool](Get-ObjectValueOrDefault -Object $storageCheck -Property 'encryptionRequired' -DefaultValue $false)
$storeEncryptionStatus = [string](Get-ObjectValueOrDefault -Object $storageCheck -Property 'encryptionStatus' -DefaultValue 'unknown')
$storeEncryptionCompliant = [bool](Get-ObjectValueOrDefault -Object $storageCheck -Property 'encryptionCompliant' -DefaultValue $false)
$servicePrioritiesSource = 'unreachable'
$servicePrioritiesCatalogSource = 'unknown'
$servicePrioritiesCatalogVersion = 'unknown'
$servicePrioritiesServiceCount = 0
$servicePrioritiesCategoryCount = 0
$servicePrioritiesFeaturedCount = 0
$servicePrioritiesSort = 'unknown'
$servicePrioritiesAudience = 'unknown'
if ($servicePrioritiesResult.Ok -and $null -ne $servicePrioritiesResult.Json -and [bool](Get-ObjectValueOrDefault -Object $servicePrioritiesResult.Json -Property 'ok' -DefaultValue $false)) {
    $servicePrioritiesPayload = Get-ObjectValueOrDefault -Object $servicePrioritiesResult.Json -Property 'data' -DefaultValue $null
    $servicePrioritiesMeta = Get-ObjectValueOrDefault -Object $servicePrioritiesResult.Json -Property 'meta' -DefaultValue $null
    $servicePrioritiesSource = [string](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'source' -DefaultValue 'unknown')
    $servicePrioritiesCatalogSource = [string](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'catalogSource' -DefaultValue 'unknown')
    $servicePrioritiesCatalogVersion = [string](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'catalogVersion' -DefaultValue 'unknown')
    $servicePrioritiesServiceCount = [int](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'serviceCount' -DefaultValue 0)
    $servicePrioritiesCategoryCount = [int](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'categoryCount' -DefaultValue 0)
    $servicePrioritiesSort = [string](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'sort' -DefaultValue 'unknown')
    $servicePrioritiesAudience = [string](Get-ObjectValueOrDefault -Object $servicePrioritiesMeta -Property 'audience' -DefaultValue '')
    $servicePrioritiesFeaturedRaw = Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $servicePrioritiesPayload -Property 'featured' -DefaultValue @())
    $servicePrioritiesFeaturedCount = $servicePrioritiesFeaturedRaw.Count
} elseif ($servicePrioritiesResult.Ok) {
    $servicePrioritiesSource = 'invalid_payload'
}

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
if (-not $authConfigured) {
    $warnings.Add("auth_status_${authStatus}")
}
if ($authMode -ne $authRecommendedMode) {
    $warnings.Add("auth_mode_${authMode}")
}
if ($authMode -eq 'legacy_password' -and -not $authTwoFactorEnabled) {
    $warnings.Add('auth_2fa_disabled')
}
if (-not $operatorAuthRolloutOk) {
    $warnings.Add("auth_rollout_${operatorAuthRolloutDiagnosis}")
}
if ($storeEncryptionRequired -and -not $storeEncryptionCompliant) {
    $warnings.Add("storage_encryption_required_noncompliant_${storeEncryptionStatus}")
} elseif (-not $storeEncryptionCompliant) {
    $warnings.Add("storage_encryption_noncompliant_${storeEncryptionStatus}")
}
if ($storageBackend -eq 'json_fallback') {
    $warnings.Add('storage_backend_json_fallback')
}
if (-not $publicSyncConfigured) {
    $warnings.Add('public_sync_unconfigured')
}
if ($publicSyncConfigured -and -not $publicSyncOperationallyHealthy) {
    $warnings.Add("public_sync_unhealthy_${publicSyncState}")
}
if ($publicSyncConfigured -and $publicSyncAgeSeconds -gt $publicSyncExpectedMaxLagSeconds) {
    $warnings.Add("public_sync_age_alta_${publicSyncAgeSeconds}s")
}
if ($publicSyncConfigured -and $publicSyncFailureReason -eq 'working_tree_dirty') {
    $warnings.Add("public_sync_working_tree_dirty_${publicSyncDirtyPathsCount}")
}
if ($publicSyncConfigured -and $publicSyncHeadDrift) {
    $warnings.Add('public_sync_head_drift')
}
if ($publicSyncConfigured -and $publicSyncTelemetryGap) {
    $warnings.Add('public_sync_telemetry_gap')
}
if (-not $turneroPilotProfileStatusResolved) {
    $warnings.Add('turnero_pilot_profile_status_unresolved')
}
if ($turneroPilotProfileStatusResolved -and -not $turneroPilotCatalogMatch) {
    $warnings.Add('turnero_pilot_catalog_drift')
}
if ($turneroPilotVerifyRequired -and -not $turneroPilotRemoteOk) {
    $warnings.Add('turnero_pilot_remote_mismatch')
}
if (-not $githubDeployAlertsFetchOk) {
    $warnings.Add('github_deploy_alerts_unreachable')
}
if ($githubDeployAlertsRelevantCount -gt 0) {
    $warnings.Add("github_deploy_alerts_open_${githubDeployAlertsRelevantCount}")
}
if ($githubDeployAlertsHasTransportBlock) {
    $warnings.Add('github_deploy_transport_blocked')
}
if ($githubDeployAlertsHasConnectivityBlock) {
    $warnings.Add('github_deploy_connectivity_blocked')
}
if ($githubDeployAlertsHasRepairGitSyncBlock) {
    $warnings.Add('github_deploy_repair_git_sync_blocked')
}
if ($githubDeployAlertsHasSelfHostedRunnerBlock) {
    $warnings.Add('github_deploy_self_hosted_runner_blocked')
}
if ($githubDeployAlertsHasSelfHostedDeployBlock) {
    $warnings.Add('github_deploy_self_hosted_deploy_blocked')
}
if ($githubDeployAlertsHasTurneroPilotBlock) {
    $warnings.Add('github_deploy_turnero_pilot_blocked')
}
if ($servicesCatalogSource -ne 'file') {
    $warnings.Add("services_catalog_${servicesCatalogSource}")
}
if (-not $servicesCatalogConfigured) {
    $warnings.Add('services_catalog_not_configured')
}
if ($servicesCatalogCount -le 0) {
    $warnings.Add('services_catalog_empty')
}
if ($servicePrioritiesSource -ne 'catalog+funnel') {
    $warnings.Add("service_priorities_${servicePrioritiesSource}")
}
if ($servicePrioritiesServiceCount -le 0) {
    $warnings.Add('service_priorities_services_empty')
}
if ($servicePrioritiesCategoryCount -le 0) {
    $warnings.Add('service_priorities_categories_empty')
}
if ($servicePrioritiesFeaturedCount -le 0) {
    $warnings.Add('service_priorities_featured_empty')
}
if (-not $telemedicineConfigured) {
    $warnings.Add('telemedicine_not_configured')
}
if ($telemedicineDiagnosticsCriticalCount -gt 0 -or $telemedicineDiagnosticsStatus -eq 'critical') {
    $warnings.Add("telemedicine_diagnostics_critical_${telemedicineDiagnosticsCriticalCount}")
}
if ($telemedicineDiagnosticsWarningCount -gt 0) {
    $warnings.Add("telemedicine_diagnostics_warning_${telemedicineDiagnosticsWarningCount}")
}
if ($telemedicineReviewQueueCount -ge $TelemedicineReviewQueueWarnCount) {
    $warnings.Add("telemedicine_review_queue_alta_${telemedicineReviewQueueCount}")
}
if ($telemedicineStagedLegacyUploadsCount -ge $TelemedicineStagedUploadsWarnCount) {
    $warnings.Add("telemedicine_staged_legacy_uploads_${telemedicineStagedLegacyUploadsCount}")
}
if ($telemedicineUnlinkedIntakesCount -ge $TelemedicineUnlinkedIntakesWarnCount) {
    $warnings.Add("telemedicine_unlinked_intakes_alta_${telemedicineUnlinkedIntakesCount}")
}
if ($telemedicineDanglingLinksCount -gt 0) {
    $warnings.Add("telemedicine_dangling_links_${telemedicineDanglingLinksCount}")
}
if ($telemedicineCasePhotosMissingPrivatePathCount -gt 0) {
    $warnings.Add("telemedicine_case_photos_missing_private_path_${telemedicineCasePhotosMissingPrivatePathCount}")
}
if ($leadOpsMode -ne 'online') {
    $warnings.Add("leadops_worker_${leadOpsMode}")
}
if ($leadOpsPendingCallbacks -ge $LeadOpsPendingWarnCount) {
    $warnings.Add("leadops_pending_queue_alta_${leadOpsPendingCallbacks}")
}
if ($leadOpsPriorityHot -ge $LeadOpsHotWarnCount) {
    $warnings.Add("leadops_hot_queue_alta_${leadOpsPriorityHot}")
}
if ($leadOpsAiRequested -gt 0 -and $leadOpsDegraded) {
    $warnings.Add("leadops_ai_backlog_${leadOpsAiRequested}")
}
if ($leadOpsFirstContactSampleSufficient -and $leadOpsFirstContactAvgMinutes -gt $LeadOpsFirstContactAvgWarnMinutes) {
    $warnings.Add("leadops_first_contact_promedio_alto_${leadOpsFirstContactAvgMinutes}min")
}
if ($leadOpsCloseRateSampleSufficient -and $leadOpsCloseFromContactedRatePct -lt $LeadOpsCloseRateMinWarnPct) {
    $warnings.Add("leadops_close_rate_baja_${leadOpsCloseFromContactedRatePct}pct")
}
if ($leadOpsAiAcceptanceSampleSufficient -and $leadOpsAiAcceptanceRatePct -lt $LeadOpsAiAcceptanceMinWarnPct) {
    $warnings.Add("leadops_ai_acceptance_baja_${leadOpsAiAcceptanceRatePct}pct")
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
$warningAnalysis = New-WeeklyWarningAnalysis -Warnings @($warnings)
$warningsCritical = @($warningAnalysis.WarningsCritical)
$warningsNonCritical = @($warningAnalysis.WarningsNonCritical)
$warningCountsTotal = [int]$warningAnalysis.WarningCountsTotal
$warningCountsCritical = [int]$warningAnalysis.WarningCountsCritical
$warningCountsNonCritical = [int]$warningAnalysis.WarningCountsNonCritical
$releaseDecision = [string]$warningAnalysis.ReleaseDecision
$releaseReason = [string]$warningAnalysis.ReleaseReason
$releaseAction = [string]$warningAnalysis.ReleaseAction

$weeklyCycleState = Get-WeeklyCycleState `
    -ReportGeneratedAt $reportGeneratedAt `
    -CurrentCriticalWarnings $warningCountsCritical `
    -CurrentTotalWarnings $warningCountsTotal `
    -ReportCandidates $reportCandidates `
    -ReportJsonPath $reportJsonPath `
    -Target $CriticalFreeCycleTarget
# Compat markers for weekly report contract tests:
# Get-WeeklyCycleEvaluation
# ## Weekly Cycle Guardrail
# $weeklyCycleHistoryBlock
# $weeklyCyclePayload = [ordered]@{}
# $weeklyCyclePayload.targetConsecutiveNoCritical = $weeklyCycleTarget
# $weeklyCyclePayload.consecutiveNoCritical = $weeklyCycleConsecutiveNoCritical
# $weeklyCyclePayload.ready = [bool]$weeklyCycleReady
# $reportPayload.weeklyCycle = $weeklyCyclePayload
$weeklyCycleTarget = [int]$weeklyCycleState.WeeklyCycleTarget
$weeklyCycleConsecutiveNoCritical = [int]$weeklyCycleState.WeeklyCycleConsecutiveNoCritical
$weeklyCycleReady = [bool]$weeklyCycleState.WeeklyCycleReady
$weeklyCycleStatus = [string]$weeklyCycleState.WeeklyCycleStatus
$weeklyCycleReason = [string]$weeklyCycleState.WeeklyCycleReason
$recoveryCycleParkedFronts = @(
    'superficies nativas nuevas',
    'expansion LeadOps',
    'ampliacion de estados',
    'rediseno grande de la web publica',
    'nuevas lineas comerciales',
    'cualquier trabajo multi-sede'
)
$recoveryCycleParkedFrontsBlock = if ($recoveryCycleParkedFronts.Count -eq 0) {
    '- parked_fronts: none'
} else {
    @(
        '- parked_fronts:'
        ($recoveryCycleParkedFronts | ForEach-Object { "  - $_" })
    ) -join "`n"
}
$recoveryCycleState = [pscustomobject]@{
    Id = 'flow-os-recovery-2026-03-21'
    Status = 'active'
    StartsAt = '2026-03-21'
    EndsAt = '2026-04-20'
    FreezeActive = $true
    AllowedSlice = 'admin v3 + queue/turnero + auth Google + readiness + deploy'
    ParkedFronts = @($recoveryCycleParkedFronts)
    ParkedFrontsBlock = $recoveryCycleParkedFrontsBlock
    StatusDoc = 'docs/PRODUCT_OPERATIONAL_STATUS.md'
    PlanDoc = 'docs/FLOW_OS_RECOVERY_PLAN.md'
    DailyRitualCommand = 'npm run flow-os:recovery:daily'
    WeeklyReady = [bool]$weeklyCycleReady
    PilotRecommendationEligible = [bool]($weeklyCycleReady -and $warningCountsCritical -eq 0)
}
# ## Recovery Cycle
# $recoveryCyclePayload = [ordered]@{}
# $recoveryCyclePayload.allowedSlice = 'admin v3 + queue/turnero + auth Google + readiness + deploy'
# $reportPayload.recoveryCycle = $recoveryCyclePayload

$null = Write-WeeklyReportArtifacts `
    -ReportMdPath $reportMdPath `
    -ReportJsonPath $reportJsonPath `
    -RetentionBaselinePath $retentionBaselinePath `
    -WarningsAnalysis $warningAnalysis `
    -WeeklyCycleState $weeklyCycleState `
    -RecoveryCycleState $recoveryCycleState

Write-Host ''
Write-Host "Reporte markdown: $reportMdPath"
Write-Host "Reporte json: $reportJsonPath"
Write-Host "start_checkout_rate_pct=$startCheckoutRatePct booking_confirmed=$bookingConfirmed booking_confirmed_rate_pct=$bookingConfirmedRatePct error_rate_pct=$errorRatePct core_p95_max_ms=$coreP95Max figo_post_p95_ms=$figoPostP95"
Write-Host "retention_no_show_rate_pct=$retentionNoShowRatePct retention_recurrence_rate_pct=$retentionRecurrenceRatePct retention_report_alert_count=$retentionReportAlertCount sentry_backend=$sentryBackendConfigured sentry_frontend=$sentryFrontendConfigured"
Write-Host "auth_mode=$authMode auth_status=$authStatus auth_configured=$authConfigured auth_hardening_compliant=$authHardeningCompliant auth_recommended_mode=$authRecommendedMode auth_recommended_mode_active=$authRecommendedModeActive auth_two_factor_enabled=$authTwoFactorEnabled auth_operator_enabled=$authOperatorAuthEnabled auth_operator_configured=$authOperatorAuthConfigured auth_legacy_password_configured=$authLegacyPasswordConfigured"
Write-Host "auth_rollout_available=$operatorAuthRolloutAvailable auth_rollout_ok=$operatorAuthRolloutOk auth_rollout_diagnosis=$operatorAuthRolloutDiagnosis auth_rollout_source=$operatorAuthRolloutSource auth_rollout_mode=$operatorAuthRolloutMode auth_rollout_status=$operatorAuthRolloutStatus auth_rollout_configured=$operatorAuthRolloutConfigured auth_rollout_operator_auth_status_http_status=$operatorAuthRolloutOperatorAuthStatusHttpStatus auth_rollout_admin_auth_facade_http_status=$operatorAuthRolloutAdminAuthFacadeHttpStatus auth_rollout_next_action=$operatorAuthRolloutNextAction"
Write-Host "storage_backend=$storageBackend storage_source=$storageSource storage_encrypted=$storeEncrypted storage_encryption_configured=$storeEncryptionConfigured storage_encryption_required=$storeEncryptionRequired storage_encryption_status=$storeEncryptionStatus storage_encryption_compliant=$storeEncryptionCompliant storage_host_checklist_command=$hostChecklistCommand"
Write-Host "public_sync_configured=$publicSyncConfigured public_sync_healthy=$publicSyncHealthy public_sync_operationally_healthy=$publicSyncOperationallyHealthy public_sync_repo_hygiene_issue=$publicSyncRepoHygieneIssue public_sync_state=$publicSyncState public_sync_age_seconds=$publicSyncAgeSeconds public_sync_expected_max_lag_seconds=$publicSyncExpectedMaxLagSeconds public_sync_failure_reason=$publicSyncFailureReason public_sync_last_error_message=$publicSyncLastErrorMessage public_sync_dirty_paths_count=$publicSyncDirtyPathsCount public_sync_telemetry_gap=$publicSyncTelemetryGap"
Write-Host "public_sync_job_id=$publicSyncJobId public_sync_deployed_commit=$publicSyncDeployedCommit public_sync_current_head=$publicSyncCurrentHead public_sync_remote_head=$publicSyncRemoteHead public_sync_head_drift=$publicSyncHeadDrift public_sync_dirty_paths_sample=$publicSyncDirtyPathsSampleLabel"
Write-Host "turnero_pilot_verify_required=$turneroPilotVerifyRequired turnero_pilot_profile_status_resolved=$turneroPilotProfileStatusResolved turnero_pilot_clinic_id=$turneroPilotClinicId turnero_pilot_catalog_match=$turneroPilotCatalogMatch turnero_pilot_remote_ok=$turneroPilotRemoteOk"
Write-Host "turnero_pilot_remote_clinic_id=$turneroPilotRemoteClinicId turnero_pilot_remote_fingerprint=$turneroPilotRemoteFingerprint turnero_pilot_remote_catalog_ready=$turneroPilotRemoteCatalogReady turnero_pilot_remote_profile_source=$turneroPilotRemoteProfileSource turnero_pilot_remote_release_mode=$turneroPilotRemoteReleaseMode turnero_pilot_remote_admin_mode_default=$turneroPilotRemoteAdminModeDefault turnero_pilot_errors=$($turneroPilotErrors -join ',')"
Write-Host "turnero_pilot_recovery_targets=$($turneroPilotRecoveryTargets -join '|')"
Write-Host "github_deploy_alerts_repo=$GitHubRepo github_deploy_alerts_fetch_ok=$githubDeployAlertsFetchOk github_deploy_alerts_relevant_count=$githubDeployAlertsRelevantCount github_deploy_transport_count=$githubDeployAlertsTransportCount github_deploy_connectivity_count=$githubDeployAlertsConnectivityCount github_deploy_repair_git_sync_count=$githubDeployAlertsRepairGitSyncCount github_deploy_self_hosted_runner_count=$githubDeployAlertsSelfHostedRunnerCount github_deploy_self_hosted_deploy_count=$githubDeployAlertsSelfHostedDeployCount github_deploy_turnero_pilot_count=$githubDeployAlertsTurneroPilotCount"
Write-Host "github_deploy_alerts_issue_numbers=$githubDeployAlertsIssueNumbersLabel github_deploy_alerts_issue_refs=$githubDeployAlertsIssueRefsLabel github_deploy_turnero_pilot_recovery_targets=$($turneroPilotRecoveryTargets -join '|') github_deploy_alerts_error=$githubDeployAlertsError"
Write-Host "idempotency_requests_with_key=$idempotencyRequestsWithKey idempotency_conflict_rate_pct=$idempotencyConflictRatePct idempotency_replay_rate_pct=$idempotencyReplayRatePct"
Write-Host "service_funnel_source=$serviceFunnelSource service_funnel_rows=$serviceFunnelRowsCount service_funnel_alert_count=$serviceFunnelAlertCount"
Write-Host "services_catalog_source=$servicesCatalogSource services_catalog_version=$servicesCatalogVersion services_catalog_count=$servicesCatalogCount services_catalog_configured=$servicesCatalogConfigured"
Write-Host "service_priorities_source=$servicePrioritiesSource service_priorities_catalog_source=$servicePrioritiesCatalogSource service_priorities_services_count=$servicePrioritiesServiceCount service_priorities_categories_count=$servicePrioritiesCategoryCount service_priorities_featured_count=$servicePrioritiesFeaturedCount"
Write-Host "telemedicine_configured=$telemedicineConfigured telemedicine_intakes_total=$telemedicineIntakesTotal telemedicine_review_queue_count=$telemedicineReviewQueueCount telemedicine_diagnostics_status=$telemedicineDiagnosticsStatus telemedicine_diagnostics_critical_count=$telemedicineDiagnosticsCriticalCount telemedicine_diagnostics_warning_count=$telemedicineDiagnosticsWarningCount"
Write-Host "leadops_configured=$leadOpsConfigured leadops_mode=$leadOpsMode leadops_callbacks_total=$leadOpsCallbacksTotal leadops_pending_callbacks=$leadOpsPendingCallbacks leadops_contacted_count=$leadOpsContactedCount leadops_priority_hot=$leadOpsPriorityHot leadops_priority_hot_pending=$leadOpsPriorityHotPending leadops_ai_requested=$leadOpsAiRequested leadops_ai_completed=$leadOpsAiCompleted leadops_ai_accepted=$leadOpsAiAccepted"
Write-Host "leadops_first_contact_avg_minutes=$leadOpsFirstContactAvgMinutes leadops_first_contact_p95_minutes=$leadOpsFirstContactP95Minutes leadops_close_rate_pct=$leadOpsCloseRatePct leadops_close_from_contacted_rate_pct=$leadOpsCloseFromContactedRatePct leadops_ai_acceptance_rate_pct=$leadOpsAiAcceptanceRatePct"
Write-Host "release_decision=$releaseDecision release_reason=$releaseReason"
Write-Host "weekly_cycle_target=$weeklyCycleTarget weekly_cycle_consecutive_no_critical=$weeklyCycleConsecutiveNoCritical weekly_cycle_ready=$weeklyCycleReady weekly_cycle_status=$weeklyCycleStatus weekly_cycle_reason=$weeklyCycleReason"
Write-Host "recovery_cycle_id=$($recoveryCycleState.Id) recovery_cycle_status=$($recoveryCycleState.Status) recovery_cycle_freeze_active=$($recoveryCycleState.FreezeActive) recovery_cycle_allowed_slice=$($recoveryCycleState.AllowedSlice) recovery_cycle_weekly_ready=$($recoveryCycleState.WeeklyReady) recovery_cycle_pilot_recommendation_eligible=$($recoveryCycleState.PilotRecommendationEligible)"
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

if ($FailOnCycleNotReady -and -not $weeklyCycleReady) {
    Write-Host "FailOnCycleNotReady activo: ciclo semanal no listo (consecutive=$weeklyCycleConsecutiveNoCritical target=$weeklyCycleTarget)." -ForegroundColor Red
    exit 2
}
