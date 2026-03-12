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
        $WarningCode -eq 'telemedicine_not_configured' -or
        $WarningCode -eq 'sentry_backend_no_configurado' -or
        $WarningCode -eq 'sentry_frontend_no_configurado'
    ) {
        return 'critical'
    }

    foreach ($prefix in @(
        'error_rate_alta_',
        'calendar_source_',
        'calendar_mode_',
        'public_sync_',
        'telemedicine_diagnostics_critical_',
        'telemedicine_dangling_links_',
        'telemedicine_case_photos_missing_private_path_'
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
        'services_catalog_',
        'service_priorities_',
        'idempotency_conflict_rate_alta_',
        'recurrence_rate_',
        'conversion_rate_',
        'start_checkout_rate_',
        'service_funnel_',
        'leadops_worker_',
        'leadops_pending_queue_alta_',
        'leadops_hot_queue_alta_',
        'leadops_ai_backlog_',
        'leadops_first_contact_promedio_alto_',
        'leadops_close_rate_baja_',
        'leadops_ai_acceptance_baja_',
        'telemedicine_diagnostics_warning_',
        'telemedicine_review_queue_alta_',
        'telemedicine_staged_legacy_uploads_',
        'telemedicine_unlinked_intakes_alta_'
    )) {
        if ($WarningCode.StartsWith($prefix)) {
            return 'non_critical'
        }
    }

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
    if ($WarningCode.StartsWith('services_catalog_')) {
        return 'conversion'
    }
    if ($WarningCode.StartsWith('service_priorities_')) {
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
    if ($WarningCode.StartsWith('telemedicine_')) {
        return 'telemedicine'
    }
    if ($WarningCode.StartsWith('leadops_')) {
        return 'leadops'
    }
    if ($WarningCode.StartsWith('public_sync_')) {
        return 'observability'
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
    if ($WarningCode.StartsWith('public_sync_')) {
        return 'docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md'
    }
    if ($WarningCode.StartsWith('telemedicine_')) {
        return 'docs/API.md#observabilidad-operativa-de-telemedicina'
    }
    if ($WarningCode.StartsWith('leadops_')) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }
    if (
        $WarningCode.StartsWith('conversion_rate_') -or
        $WarningCode.StartsWith('start_checkout_rate_') -or
        $WarningCode.StartsWith('service_funnel_') -or
        $WarningCode.StartsWith('services_catalog_') -or
        $WarningCode.StartsWith('service_priorities_') -or
        $WarningCode.StartsWith('idempotency_conflict_rate_alta_') -or
        $WarningCode.StartsWith('recurrence_rate_') -or
        $WarningCode.StartsWith('no_show_rate_alta_') -or
        $WarningCode.StartsWith('retention_report_')
    ) {
        return 'docs/RUNBOOKS.md#31-monitoreo-diario'
    }

    return 'docs/RUNBOOKS.md#2-respuesta-a-incidentes-emergency-response'
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

function Get-WarningCriticalCountFromReportPayload {
    param($ReportPayload)

    if ($null -eq $ReportPayload) {
        return -1
    }

    $warningCounts = Get-ObjectValueOrDefault -Object $ReportPayload -Property 'warningCounts' -DefaultValue $null
    if ($null -ne $warningCounts) {
        $criticalRaw = Get-ObjectValueOrDefault -Object $warningCounts -Property 'critical' -DefaultValue $null
        if ($null -ne $criticalRaw -and -not [string]::IsNullOrWhiteSpace([string]$criticalRaw)) {
            try {
                $criticalParsed = [int]$criticalRaw
                if ($criticalParsed -ge 0) {
                    return $criticalParsed
                }
            } catch {
            }
        }
    }

    $warningsBySeverity = Get-ObjectValueOrDefault -Object $ReportPayload -Property 'warningsBySeverity' -DefaultValue $null
    if ($null -ne $warningsBySeverity) {
        $criticalRows = Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $warningsBySeverity -Property 'critical' -DefaultValue @())
        return $criticalRows.Count
    }

    $warningsLegacy = Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $ReportPayload -Property 'warnings' -DefaultValue @())
    if ($warningsLegacy.Count -gt 0) {
        return $warningsLegacy.Count
    }

    return 0
}

function Get-WeeklyCycleEvaluation {
    param(
        [array]$History,
        [int]$Target
    )

    $safeTarget = if ($Target -lt 1) { 1 } else { $Target }
    $historyRows = Convert-ToArraySafe -Value $History
    $consecutiveNoCritical = 0
    $breakReason = 'none'
    $lastCriticalGeneratedAt = ''

    foreach ($entry in $historyRows) {
        $criticalWarnings = [int](Get-ObjectValueOrDefault -Object $entry -Property 'criticalWarnings' -DefaultValue -1)
        $generatedAt = [string](Get-ObjectValueOrDefault -Object $entry -Property 'generatedAt' -DefaultValue '')

        if ($criticalWarnings -lt 0) {
            $breakReason = 'history_invalid'
            break
        }
        if ($criticalWarnings -gt 0) {
            if ([string]::IsNullOrWhiteSpace($lastCriticalGeneratedAt) -and -not [string]::IsNullOrWhiteSpace($generatedAt)) {
                $lastCriticalGeneratedAt = $generatedAt
            }
            $breakReason = 'critical_warning_found'
            break
        }
        $consecutiveNoCritical++
    }

    if ([string]::IsNullOrWhiteSpace($lastCriticalGeneratedAt)) {
        foreach ($entry in $historyRows) {
            $criticalWarnings = [int](Get-ObjectValueOrDefault -Object $entry -Property 'criticalWarnings' -DefaultValue -1)
            if ($criticalWarnings -gt 0) {
                $lastCriticalGeneratedAt = [string](Get-ObjectValueOrDefault -Object $entry -Property 'generatedAt' -DefaultValue '')
                break
            }
        }
    }

    $ready = $consecutiveNoCritical -ge $safeTarget
    $status = 'in_progress'
    $reason = 'awaiting_clean_cycles'

    if ($ready) {
        $status = 'ready'
        $reason = 'target_met'
    } elseif ($historyRows.Count -eq 0) {
        $reason = 'history_missing'
    } elseif ($breakReason -eq 'history_invalid') {
        $status = 'blocked'
        $reason = 'history_invalid'
    } elseif ([int](Get-ObjectValueOrDefault -Object $historyRows[0] -Property 'criticalWarnings' -DefaultValue -1) -gt 0) {
        $status = 'blocked'
        $reason = 'current_has_critical'
    }

    return [ordered]@{
        targetConsecutiveNoCritical = $safeTarget
        consecutiveNoCritical = $consecutiveNoCritical
        ready = [bool]$ready
        status = $status
        reason = $reason
        lastCriticalGeneratedAt = $lastCriticalGeneratedAt
        historyCount = $historyRows.Count
    }
}

function New-WeeklyWarningAnalysis {
    param([string[]]$Warnings)

    $warningsCritical = New-Object System.Collections.Generic.List[string]
    $warningsNonCritical = New-Object System.Collections.Generic.List[string]
    $warningDetails = New-Object System.Collections.Generic.List[object]

    foreach ($warningCode in $Warnings) {
        $warningSeverity = Get-WarningSeverity -WarningCode $warningCode
        $warningImpact = Get-WarningImpact -WarningCode $warningCode
        $warningRunbookRef = Get-WarningRunbookRef -WarningCode $warningCode
        $warningDetails.Add([pscustomobject]@{
            code = $warningCode
            severity = $warningSeverity
            impact = $warningImpact
            runbookRef = $warningRunbookRef
        }) | Out-Null

        if ($warningSeverity -eq 'non_critical') {
            $warningsNonCritical.Add($warningCode) | Out-Null
        } else {
            $warningsCritical.Add($warningCode) | Out-Null
        }
    }

    $warningsByImpact = [ordered]@{
        agenda = @()
        chat = @()
        conversion = @()
        retention = @()
        telemedicine = @()
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

    $warningCountsTotal = @($Warnings).Count
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

    $warningBlock = if ($warningCountsTotal -eq 0) {
        '- none'
    } else {
        (@($Warnings) | ForEach-Object { "- $_" }) -join "`n"
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

    $warningCountsPayload = [ordered]@{
        total = $warningCountsTotal
        critical = $warningCountsCritical
        nonCritical = $warningCountsNonCritical
    }

    $releaseGuardrailsPayload = [ordered]@{
        decision = $releaseDecision
        reason = $releaseReason
        action = $releaseAction
        criticalWarnings = @($warningsCritical)
        nonCriticalWarnings = @($warningsNonCritical)
    }

    $warningsBySeverityPayload = [ordered]@{
        critical = @($warningsCritical)
        nonCritical = @($warningsNonCritical)
    }

    $analysis = [ordered]@{
        WarningsCritical = @($warningsCritical.ToArray())
        WarningsNonCritical = @($warningsNonCritical.ToArray())
        WarningDetails = @($warningDetails.ToArray())
        WarningsByImpact = $warningsByImpactPayload
        WarningsByImpactPayload = $warningsByImpactPayload
        WarningDetailsPayload = @($warningDetailsPayload)
        WarningCountsTotal = $warningCountsTotal
        WarningCountsCritical = $warningCountsCritical
        WarningCountsNonCritical = $warningCountsNonCritical
        WarningCountsPayload = $warningCountsPayload
        WarningBlock = $warningBlock
        WarningDetailBlock = $warningDetailBlock
        ReleaseDecision = $releaseDecision
        ReleaseReason = $releaseReason
        ReleaseAction = $releaseAction
        ReleaseGuardrailsPayload = $releaseGuardrailsPayload
        WarningsBySeverityPayload = $warningsBySeverityPayload
    }

    return [pscustomobject]$analysis
}

function Get-WeeklyCycleState {
    param(
        [string]$ReportGeneratedAt,
        [int]$CurrentCriticalWarnings,
        [int]$CurrentTotalWarnings,
        [object[]]$ReportCandidates,
        [string]$ReportJsonPath,
        [int]$Target
    )

    $weeklyCycleHistoryLimit = [Math]::Max(6, $Target + 4)
    $weeklyCycleHistory = New-Object System.Collections.Generic.List[object]
    $weeklyCycleHistory.Add([ordered]@{
        generatedAt = $ReportGeneratedAt
        criticalWarnings = $CurrentCriticalWarnings
        totalWarnings = $CurrentTotalWarnings
        source = 'current_run'
    }) | Out-Null

    foreach ($candidate in $ReportCandidates) {
        if ($weeklyCycleHistory.Count -ge $weeklyCycleHistoryLimit) {
            break
        }
        if ($candidate.FullName -eq $ReportJsonPath) {
            continue
        }

        $historyPayload = Read-JsonFileSafe -Path $candidate.FullName
        if ($null -eq $historyPayload) {
            continue
        }

        $historyGeneratedAt = [string](Get-ObjectValueOrDefault -Object $historyPayload -Property 'generatedAt' -DefaultValue '')
        if ([string]::IsNullOrWhiteSpace($historyGeneratedAt)) {
            try {
                $historyGeneratedAt = ([DateTimeOffset]$candidate.LastWriteTimeUtc).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
            } catch {
                $historyGeneratedAt = ''
            }
        }
        $historyCriticalWarnings = Get-WarningCriticalCountFromReportPayload -ReportPayload $historyPayload
        $historyWarningCounts = Get-ObjectValueOrDefault -Object $historyPayload -Property 'warningCounts' -DefaultValue $null
        $historyTotalWarningsRaw = Get-ObjectValueOrDefault -Object $historyWarningCounts -Property 'total' -DefaultValue $null
        $historyTotalWarnings = 0
        if ($null -ne $historyTotalWarningsRaw -and -not [string]::IsNullOrWhiteSpace([string]$historyTotalWarningsRaw)) {
            try {
                $historyTotalWarnings = [int]$historyTotalWarningsRaw
            } catch {
                $historyTotalWarnings = 0
            }
        } else {
            $historyWarningsLegacy = Convert-ToArraySafe -Value (Get-ObjectValueOrDefault -Object $historyPayload -Property 'warnings' -DefaultValue @())
            $historyTotalWarnings = $historyWarningsLegacy.Count
        }

        $weeklyCycleHistory.Add([ordered]@{
            generatedAt = $historyGeneratedAt
            criticalWarnings = $historyCriticalWarnings
            totalWarnings = $historyTotalWarnings
            source = 'history_file'
        }) | Out-Null
    }

    $weeklyCycleHistoryArray = if ($null -eq $weeklyCycleHistory) { @() } else { $weeklyCycleHistory.ToArray() }
    $weeklyCycleEval = Get-WeeklyCycleEvaluation -History $weeklyCycleHistoryArray -Target $Target
    $weeklyCycleTarget = [int](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'targetConsecutiveNoCritical' -DefaultValue $Target)
    $weeklyCycleConsecutiveNoCritical = [int](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'consecutiveNoCritical' -DefaultValue 0)
    $weeklyCycleReady = [bool](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'ready' -DefaultValue $false)
    $weeklyCycleStatus = [string](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'status' -DefaultValue 'in_progress')
    $weeklyCycleReason = [string](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'reason' -DefaultValue 'awaiting_clean_cycles')
    $weeklyCycleLastCriticalGeneratedAt = [string](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'lastCriticalGeneratedAt' -DefaultValue '')
    $weeklyCycleHistoryCount = [int](Get-ObjectValueOrDefault -Object $weeklyCycleEval -Property 'historyCount' -DefaultValue $weeklyCycleHistory.Count)
    $weeklyCycleLastCriticalGeneratedAtLabel = if ([string]::IsNullOrWhiteSpace($weeklyCycleLastCriticalGeneratedAt)) { 'none' } else { $weeklyCycleLastCriticalGeneratedAt }
    $weeklyCycleHistoryBlock = if ($weeklyCycleHistory.Count -eq 0) {
        '- none'
    } else {
        @(
            $weeklyCycleHistory | ForEach-Object {
                $cycleGeneratedAt = [string](Get-ObjectValueOrDefault -Object $_ -Property 'generatedAt' -DefaultValue 'n/a')
                $cycleCritical = [string](Get-ObjectValueOrDefault -Object $_ -Property 'criticalWarnings' -DefaultValue 'n/a')
                $cycleTotal = [string](Get-ObjectValueOrDefault -Object $_ -Property 'totalWarnings' -DefaultValue 'n/a')
                $cycleSource = [string](Get-ObjectValueOrDefault -Object $_ -Property 'source' -DefaultValue 'unknown')
                "- generatedAt: $cycleGeneratedAt | critical: $cycleCritical | total: $cycleTotal | source: $cycleSource"
            }
        ) -join "`n"
    }

    $weeklyCycleHistoryPayload = @(
        $weeklyCycleHistory | ForEach-Object {
            [ordered]@{
                generatedAt = [string](Get-ObjectValueOrDefault -Object $_ -Property 'generatedAt' -DefaultValue '')
                criticalWarnings = [int](Get-ObjectValueOrDefault -Object $_ -Property 'criticalWarnings' -DefaultValue -1)
                totalWarnings = [int](Get-ObjectValueOrDefault -Object $_ -Property 'totalWarnings' -DefaultValue 0)
                source = [string](Get-ObjectValueOrDefault -Object $_ -Property 'source' -DefaultValue 'unknown')
            }
        }
    )
    $weeklyCyclePayload = [ordered]@{}
    $weeklyCyclePayload.targetConsecutiveNoCritical = $weeklyCycleTarget
    $weeklyCyclePayload.consecutiveNoCritical = $weeklyCycleConsecutiveNoCritical
    $weeklyCyclePayload.ready = [bool]$weeklyCycleReady
    $weeklyCyclePayload.status = $weeklyCycleStatus
    $weeklyCyclePayload.reason = $weeklyCycleReason
    $weeklyCyclePayload.lastCriticalGeneratedAt = $weeklyCycleLastCriticalGeneratedAtLabel
    $weeklyCyclePayload.historyCount = $weeklyCycleHistoryCount
    $weeklyCyclePayload.history = $weeklyCycleHistoryPayload

    return [pscustomobject]@{
        WeeklyCycleHistory = @($weeklyCycleHistoryArray)
        WeeklyCycleTarget = $weeklyCycleTarget
        WeeklyCycleConsecutiveNoCritical = $weeklyCycleConsecutiveNoCritical
        WeeklyCycleReady = $weeklyCycleReady
        WeeklyCycleStatus = $weeklyCycleStatus
        WeeklyCycleReason = $weeklyCycleReason
        WeeklyCycleLastCriticalGeneratedAt = $weeklyCycleLastCriticalGeneratedAt
        WeeklyCycleLastCriticalGeneratedAtLabel = $weeklyCycleLastCriticalGeneratedAtLabel
        WeeklyCycleHistoryCount = $weeklyCycleHistoryCount
        WeeklyCycleHistoryBlock = $weeklyCycleHistoryBlock
        WeeklyCyclePayload = $weeklyCyclePayload
    }
}

function Get-WeeklyReportMarkdown {
    param(
        [object]$WarningsAnalysis,
        [object]$WeeklyCycleState
    )

    $warningCountsTotal = [int]$WarningsAnalysis.WarningCountsTotal
    $warningCountsCritical = [int]$WarningsAnalysis.WarningCountsCritical
    $warningCountsNonCritical = [int]$WarningsAnalysis.WarningCountsNonCritical
    $warningBlock = [string]$WarningsAnalysis.WarningBlock
    $warningDetailBlock = [string]$WarningsAnalysis.WarningDetailBlock
    $releaseDecision = [string]$WarningsAnalysis.ReleaseDecision
    $releaseReason = [string]$WarningsAnalysis.ReleaseReason
    $releaseAction = [string]$WarningsAnalysis.ReleaseAction
    $weeklyCycleTarget = [int]$WeeklyCycleState.WeeklyCycleTarget
    $weeklyCycleConsecutiveNoCritical = [int]$WeeklyCycleState.WeeklyCycleConsecutiveNoCritical
    $weeklyCycleReady = [bool]$WeeklyCycleState.WeeklyCycleReady
    $weeklyCycleStatus = [string]$WeeklyCycleState.WeeklyCycleStatus
    $weeklyCycleReason = [string]$WeeklyCycleState.WeeklyCycleReason
    $weeklyCycleLastCriticalGeneratedAtLabel = [string]$WeeklyCycleState.WeeklyCycleLastCriticalGeneratedAtLabel
    $weeklyCycleHistoryCount = [int]$WeeklyCycleState.WeeklyCycleHistoryCount
    $weeklyCycleHistoryBlock = [string]$WeeklyCycleState.WeeklyCycleHistoryBlock

    return @"
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

## Public Sync Ops

- public_sync_configured: $publicSyncConfigured
- public_sync_healthy: $publicSyncHealthy
- public_sync_job_id: $publicSyncJobId
- public_sync_state: $publicSyncState
- public_sync_age_seconds: $publicSyncAgeSeconds
- public_sync_expected_max_lag_seconds: $publicSyncExpectedMaxLagSeconds
- public_sync_last_checked_at: $publicSyncLastCheckedAt
- public_sync_last_success_at: $publicSyncLastSuccessAt
- public_sync_last_error_at: $publicSyncLastErrorAt
- public_sync_last_error_message: $publicSyncLastErrorMessage
- public_sync_deployed_commit: $publicSyncDeployedCommit
- public_sync_duration_ms: $publicSyncDurationMs
- public_sync_current_head: $publicSyncCurrentHead
- public_sync_remote_head: $publicSyncRemoteHead
- public_sync_head_drift: $publicSyncHeadDrift
- public_sync_branch: $publicSyncBranch
- public_sync_repo_path: $publicSyncRepoPath
- public_sync_dirty_paths_count: $publicSyncDirtyPathsCount
- public_sync_dirty_paths_sample: $publicSyncDirtyPathsSampleLabel
- public_sync_telemetry_gap: $publicSyncTelemetryGap
- public_sync_status_path: $publicSyncStatusPath
- public_sync_log_path: $publicSyncLogPath
- public_sync_lock_file: $publicSyncLockFile

## Services Catalog

- services_catalog_source: $servicesCatalogSource
- services_catalog_configured: $servicesCatalogConfigured
- services_catalog_version: $servicesCatalogVersion
- services_catalog_count: $servicesCatalogCount

## Service Priorities

- service_priorities_source: $servicePrioritiesSource
- service_priorities_catalog_source: $servicePrioritiesCatalogSource
- service_priorities_catalog_version: $servicePrioritiesCatalogVersion
- service_priorities_services_count: $servicePrioritiesServiceCount
- service_priorities_categories_count: $servicePrioritiesCategoryCount
- service_priorities_featured_count: $servicePrioritiesFeaturedCount
- service_priorities_sort: $servicePrioritiesSort
- service_priorities_audience: $servicePrioritiesAudience

## Telemedicine Ops

- telemedicine_configured: $telemedicineConfigured
- telemedicine_intakes_total: $telemedicineIntakesTotal
- telemedicine_review_queue_count: $telemedicineReviewQueueCount
- telemedicine_latest_activity_at: $telemedicineLatestActivityAt
- telemedicine_diagnostics_status: $telemedicineDiagnosticsStatus
- telemedicine_diagnostics_healthy: $telemedicineDiagnosticsHealthy
- telemedicine_diagnostics_critical_count: $telemedicineDiagnosticsCriticalCount
- telemedicine_diagnostics_warning_count: $telemedicineDiagnosticsWarningCount
- telemedicine_diagnostics_info_count: $telemedicineDiagnosticsInfoCount
- telemedicine_diagnostics_total_checks: $telemedicineDiagnosticsTotalChecks
- telemedicine_diagnostics_total_issues: $telemedicineDiagnosticsTotalIssues
- telemedicine_shadow_mode_enabled: $telemedicineShadowModeEnabled
- telemedicine_enforce_unsuitable: $telemedicineEnforceUnsuitable
- telemedicine_enforce_review_required: $telemedicineEnforceReviewRequired
- telemedicine_allow_decision_override: $telemedicineAllowDecisionOverride
- telemedicine_unlinked_intakes_count: $telemedicineUnlinkedIntakesCount
- telemedicine_staged_legacy_uploads_count: $telemedicineStagedLegacyUploadsCount
- telemedicine_dangling_links_count: $telemedicineDanglingLinksCount
- telemedicine_case_photos_missing_private_path_count: $telemedicineCasePhotosMissingPrivatePathCount
- telemedicine_orphaned_clinical_uploads_count: $telemedicineOrphanedClinicalUploadsCount
- telemedicine_appointments_without_intake_count: $telemedicineAppointmentsWithoutIntakeCount
- telemedicine_review_queue_warn_threshold: $TelemedicineReviewQueueWarnCount
- telemedicine_staged_uploads_warn_threshold: $TelemedicineStagedUploadsWarnCount
- telemedicine_unlinked_intakes_warn_threshold: $TelemedicineUnlinkedIntakesWarnCount

## LeadOps

- leadops_configured: $leadOpsConfigured
- leadops_mode: $leadOpsMode
- leadops_degraded: $leadOpsDegraded
- leadops_callbacks_total: $leadOpsCallbacksTotal
- leadops_pending_callbacks: $leadOpsPendingCallbacks
- leadops_contacted_count: $leadOpsContactedCount
- leadops_priority_hot: $leadOpsPriorityHot
- leadops_priority_warm: $leadOpsPriorityWarm
- leadops_priority_hot_pending: $leadOpsPriorityHotPending
- leadops_priority_warm_pending: $leadOpsPriorityWarmPending
- leadops_ai_requested: $leadOpsAiRequested
- leadops_ai_completed: $leadOpsAiCompleted
- leadops_ai_accepted: $leadOpsAiAccepted
- leadops_outcome_closed_won: $leadOpsOutcomeClosedWon
- leadops_outcome_no_response: $leadOpsOutcomeNoResponse
- leadops_outcome_discarded: $leadOpsOutcomeDiscarded
- leadops_first_contact_samples: $leadOpsFirstContactSamples
- leadops_first_contact_avg_minutes: $leadOpsFirstContactAvgMinutes
- leadops_first_contact_p95_minutes: $leadOpsFirstContactP95Minutes
- leadops_ai_acceptance_rate_pct: $leadOpsAiAcceptanceRatePct
- leadops_close_rate_pct: $leadOpsCloseRatePct
- leadops_close_from_contacted_rate_pct: $leadOpsCloseFromContactedRatePct
- leadops_worker_last_seen_at: $leadOpsWorkerLastSeenAt
- leadops_worker_last_error_at: $leadOpsWorkerLastErrorAt
- leadops_pending_warn_threshold: $LeadOpsPendingWarnCount
- leadops_hot_warn_threshold: $LeadOpsHotWarnCount
- leadops_first_contact_warn_min_samples: $LeadOpsFirstContactWarnMinSamples
- leadops_first_contact_avg_warn_minutes: $LeadOpsFirstContactAvgWarnMinutes
- leadops_first_contact_sample_sufficient: $leadOpsFirstContactSampleSufficient
- leadops_close_rate_warn_min_samples: $LeadOpsCloseRateWarnMinSamples
- leadops_close_rate_min_warn_pct: $LeadOpsCloseRateMinWarnPct
- leadops_close_rate_sample_sufficient: $leadOpsCloseRateSampleSufficient
- leadops_ai_acceptance_warn_min_samples: $LeadOpsAiAcceptanceWarnMinSamples
- leadops_ai_acceptance_min_warn_pct: $LeadOpsAiAcceptanceMinWarnPct
- leadops_ai_acceptance_sample_sufficient: $leadOpsAiAcceptanceSampleSufficient

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

## Weekly Cycle Guardrail

- critical_free_cycle_target: $weeklyCycleTarget
- consecutive_no_critical_weeks: $weeklyCycleConsecutiveNoCritical
- cycle_ready: $weeklyCycleReady
- cycle_status: $weeklyCycleStatus
- cycle_reason: $weeklyCycleReason
- last_critical_generated_at: $weeklyCycleLastCriticalGeneratedAtLabel
- history_count: $weeklyCycleHistoryCount

$weeklyCycleHistoryBlock

## Incident Triage (<= 15 min)

- minute_0_5: run `npm run gate:prod:fast` and check health/availability/chat status.
- minute_5_10: pick first critical warning and follow `runbookRef`.
- minute_10_15: if still degraded, escalate and open/refresh incident issue `[ALERTA PROD]`.

## Release Guardrails

- release_decision: $releaseDecision
- release_reason: $releaseReason
- release_action: $releaseAction
"@
}

function New-WeeklyReportPayload {
    param(
        [object]$WarningsAnalysis,
        [object]$WeeklyCycleState
    )

    $summaryPayload = [ordered]@{
        viewBooking = $viewBooking
        startCheckout = $startCheckout
        bookingConfirmed = $bookingConfirmed
        checkoutAbandon = $checkoutAbandon
        bookingError = $bookingError
        checkoutError = $checkoutError
        bookingErrorRatePct = $errorRatePct
    }

    $conversionPayload = [ordered]@{
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

    $serviceFunnelPayload = [ordered]@{
        source = $serviceFunnelSource
        rows = $serviceFunnelRowsCount
        rowsDetailSample = $serviceFunnelRowsWithDetailSample
        rowsCheckoutSample = $serviceFunnelRowsWithCheckoutSample
        thresholds = [ordered]@{
            minDetailViews = $ServiceFunnelWarnMinDetailViews
            minCheckoutStarts = $ServiceFunnelWarnMinCheckoutStarts
            checkoutToConfirmedMinWarnPct = [Math]::Round([double]$ServiceFunnelCheckoutToConfirmedMinWarnPct, 2)
            detailToConfirmedMinWarnPct = [Math]::Round([double]$ServiceFunnelDetailToConfirmedMinWarnPct, 2)
        }
        top = @($serviceFunnelTopRows)
        alertCount = $serviceFunnelAlertCount
        alertCodes = @($serviceFunnelAlertCodes)
        alerts = Convert-ToArraySafe -Value $serviceFunnelAlerts
    }

    $retentionPayload = [ordered]@{
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

    $reportPayload = [ordered]@{
        generatedAt = $reportGeneratedAt
        domain = $base
        summary = $summaryPayload
        conversion = $conversionPayload
        conversionTrend = [ordered]@{
            previousReportGeneratedAt = $previousReportDate
            startCheckoutRateDeltaPct = $startCheckoutRateDeltaPct
            bookingConfirmedRateDeltaPct = $bookingConfirmedRateDeltaPct
        }
        serviceFunnel = $serviceFunnelPayload
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
        publicSync = [ordered]@{
            configured = [bool]$publicSyncConfigured
            healthy = [bool]$publicSyncHealthy
            jobId = $publicSyncJobId
            state = $publicSyncState
            ageSeconds = $publicSyncAgeSeconds
            expectedMaxLagSeconds = $publicSyncExpectedMaxLagSeconds
            lastCheckedAt = $publicSyncLastCheckedAt
            lastSuccessAt = $publicSyncLastSuccessAt
            lastErrorAt = $publicSyncLastErrorAt
            lastErrorMessage = $publicSyncLastErrorMessage
            deployedCommit = $publicSyncDeployedCommit
            durationMs = $publicSyncDurationMs
            currentHead = $publicSyncCurrentHead
            remoteHead = $publicSyncRemoteHead
            headDrift = [bool]$publicSyncHeadDrift
            branch = $publicSyncBranch
            repoPath = $publicSyncRepoPath
            dirtyPathsCount = $publicSyncDirtyPathsCount
            dirtyPathsSample = @($publicSyncDirtyPathsSample)
            telemetryGap = [bool]$publicSyncTelemetryGap
            statusPath = $publicSyncStatusPath
            logPath = $publicSyncLogPath
            lockFile = $publicSyncLockFile
        }
        servicesCatalog = [ordered]@{
            source = $servicesCatalogSource
            configured = $servicesCatalogConfigured
            version = $servicesCatalogVersion
            servicesCount = $servicesCatalogCount
        }
        servicePriorities = [ordered]@{
            source = $servicePrioritiesSource
            catalogSource = $servicePrioritiesCatalogSource
            catalogVersion = $servicePrioritiesCatalogVersion
            servicesCount = $servicePrioritiesServiceCount
            categoriesCount = $servicePrioritiesCategoryCount
            featuredCount = $servicePrioritiesFeaturedCount
            sort = $servicePrioritiesSort
            audience = $servicePrioritiesAudience
        }
        telemedicine = [ordered]@{
            configured = [bool]$telemedicineConfigured
            intakesTotal = $telemedicineIntakesTotal
            reviewQueueCount = $telemedicineReviewQueueCount
            latestActivityAt = $telemedicineLatestActivityAt
            diagnostics = [ordered]@{
                status = $telemedicineDiagnosticsStatus
                healthy = [bool]$telemedicineDiagnosticsHealthy
                criticalCount = $telemedicineDiagnosticsCriticalCount
                warningCount = $telemedicineDiagnosticsWarningCount
                infoCount = $telemedicineDiagnosticsInfoCount
                totalChecks = $telemedicineDiagnosticsTotalChecks
                totalIssues = $telemedicineDiagnosticsTotalIssues
            }
            policy = [ordered]@{
                shadowModeEnabled = [bool]$telemedicineShadowModeEnabled
                enforceUnsuitable = [bool]$telemedicineEnforceUnsuitable
                enforceReviewRequired = [bool]$telemedicineEnforceReviewRequired
                allowDecisionOverride = [bool]$telemedicineAllowDecisionOverride
            }
            integrity = [ordered]@{
                unlinkedIntakesCount = $telemedicineUnlinkedIntakesCount
                stagedLegacyUploadsCount = $telemedicineStagedLegacyUploadsCount
                danglingLinksCount = $telemedicineDanglingLinksCount
                casePhotosMissingPrivatePathCount = $telemedicineCasePhotosMissingPrivatePathCount
                orphanedClinicalUploadsCount = $telemedicineOrphanedClinicalUploadsCount
                appointmentsWithoutIntakeCount = $telemedicineAppointmentsWithoutIntakeCount
            }
            thresholds = [ordered]@{
                reviewQueueWarnCount = $TelemedicineReviewQueueWarnCount
                stagedUploadsWarnCount = $TelemedicineStagedUploadsWarnCount
                unlinkedIntakesWarnCount = $TelemedicineUnlinkedIntakesWarnCount
            }
        }
        leadOps = [ordered]@{
            configured = [bool]$leadOpsConfigured
            mode = $leadOpsMode
            degraded = [bool]$leadOpsDegraded
            callbacksTotal = $leadOpsCallbacksTotal
            pendingCallbacks = $leadOpsPendingCallbacks
            contactedCount = $leadOpsContactedCount
            priorityHot = $leadOpsPriorityHot
            priorityWarm = $leadOpsPriorityWarm
            priorityHotPending = $leadOpsPriorityHotPending
            priorityWarmPending = $leadOpsPriorityWarmPending
            aiRequested = $leadOpsAiRequested
            aiCompleted = $leadOpsAiCompleted
            aiAccepted = $leadOpsAiAccepted
            outcomes = [ordered]@{
                closedWon = $leadOpsOutcomeClosedWon
                noResponse = $leadOpsOutcomeNoResponse
                discarded = $leadOpsOutcomeDiscarded
            }
            firstContact = [ordered]@{
                samples = $leadOpsFirstContactSamples
                avgMinutes = [Math]::Round([double]$leadOpsFirstContactAvgMinutes, 2)
                p95Minutes = [Math]::Round([double]$leadOpsFirstContactP95Minutes, 2)
                sampleSufficient = [bool]$leadOpsFirstContactSampleSufficient
            }
            rates = [ordered]@{
                aiAcceptancePct = [Math]::Round([double]$leadOpsAiAcceptanceRatePct, 2)
                closedPct = [Math]::Round([double]$leadOpsCloseRatePct, 2)
                closedFromContactedPct = [Math]::Round([double]$leadOpsCloseFromContactedRatePct, 2)
                closeRateSampleSufficient = [bool]$leadOpsCloseRateSampleSufficient
                aiAcceptanceSampleSufficient = [bool]$leadOpsAiAcceptanceSampleSufficient
            }
            workerLastSeenAt = $leadOpsWorkerLastSeenAt
            workerLastErrorAt = $leadOpsWorkerLastErrorAt
            thresholds = [ordered]@{
                pendingWarnCount = $LeadOpsPendingWarnCount
                hotWarnCount = $LeadOpsHotWarnCount
                firstContactWarnMinSamples = $LeadOpsFirstContactWarnMinSamples
                firstContactAvgWarnMinutes = $LeadOpsFirstContactAvgWarnMinutes
                closeRateWarnMinSamples = $LeadOpsCloseRateWarnMinSamples
                closeRateMinWarnPct = [Math]::Round([double]$LeadOpsCloseRateMinWarnPct, 2)
                aiAcceptanceWarnMinSamples = $LeadOpsAiAcceptanceWarnMinSamples
                aiAcceptanceMinWarnPct = [Math]::Round([double]$LeadOpsAiAcceptanceMinWarnPct, 2)
            }
        }
        retention = $retentionPayload
        retentionReport = [ordered]@{
            source = $retentionReportSource
            days = $RetentionReportDays
            error = $retentionReportError
            meta = $retentionReportMeta
            summary = $retentionReportSummary
            alertCounts = [ordered]@{
                total = $retentionReportAlertCount
                warn = $retentionReportAlertWarnCount
                critical = $retentionReportAlertCriticalCount
            }
            alerts = Convert-ToArraySafe -Value $retentionReportAlerts
            alertCodes = @($retentionReportAlertCodes)
        }
        idempotency = [ordered]@{
            requestsWithKey = $idempotencyRequestsWithKey
            new = $idempotencyNew
            replay = $idempotencyReplay
            conflict = $idempotencyConflict
            unknown = $idempotencyUnknown
            conflictRatePct = [Math]::Round([double]$idempotencyConflictRatePct, 2)
            replayRatePct = [Math]::Round([double]$idempotencyReplayRatePct, 2)
            conflictWarningSampleSufficient = [bool]$idempotencySampleSufficient
            conflictWarnPctThreshold = [Math]::Round([double]$IdempotencyConflictRateWarnPct, 2)
        }
        retentionTrend = [ordered]@{
            previousReportGeneratedAt = $previousReportDate
            noShowRateDeltaPct = $retentionNoShowRateDeltaPct
            recurrenceRateDeltaPct = $retentionRecurrenceRateDeltaPct
            trendReady = [bool]$retentionTrendReady
        }
        retentionBaseline = [ordered]@{
            generatedAt = $retentionBaselineGeneratedAt
            noShowRatePct = $retentionBaselineNoShowRatePct
            recurrenceRatePct = $retentionBaselineRecurrenceRatePct
            source = $retentionBaselineSource
        }
        latency = [ordered]@{
            coreP95MaxMs = $coreP95Max
            coreP95TargetMs = $CoreP95MaxMs
            figoPostP95Ms = $figoPostP95
            figoPostP95TargetMs = $FigoPostP95MaxMs
            bench = $benchResults
        }
        warningCounts = $WarningsAnalysis.WarningCountsPayload
        releaseGuardrails = $WarningsAnalysis.ReleaseGuardrailsPayload
        weeklyCycle = $WeeklyCycleState.WeeklyCyclePayload
        warningsBySeverity = $WarningsAnalysis.WarningsBySeverityPayload
        warningsByImpact = $WarningsAnalysis.WarningsByImpactPayload
        warningDetails = $WarningsAnalysis.WarningDetailsPayload
        warningsCritical = @($WarningsAnalysis.WarningsCritical)
        warningsNonCritical = @($WarningsAnalysis.WarningsNonCritical)
        warnings = @($warnings)
        triagePlaybook = [ordered]@{
            targetMinutes = 15
            quickChecks = @(
                'npm run gate:prod:fast',
                'GET /api.php?resource=health',
                'GET /api.php?resource=availability',
                'POST /figo-chat.php'
            )
            defaultRunbook = 'docs/RUNBOOKS.md#2-respuesta-a-incidentes-emergency-response'
        }
    }

    return $reportPayload
}

function Write-WeeklyReportArtifacts {
    param(
        [string]$ReportMdPath,
        [string]$ReportJsonPath,
        [string]$RetentionBaselinePath,
        [object]$WarningsAnalysis,
        [object]$WeeklyCycleState
    )

    $retentionBaselinePayload = [ordered]@{
        generatedAt = $retentionBaselineGeneratedAt
        noShowRatePct = $retentionBaselineNoShowRatePct
        recurrenceRatePct = $retentionBaselineRecurrenceRatePct
        source = $retentionBaselineSource
    }
    $markdown = Get-WeeklyReportMarkdown -WarningsAnalysis $WarningsAnalysis -WeeklyCycleState $WeeklyCycleState
    $reportPayload = New-WeeklyReportPayload -WarningsAnalysis $WarningsAnalysis -WeeklyCycleState $WeeklyCycleState

    Set-Content -Path $ReportMdPath -Value $markdown -Encoding UTF8
    $retentionBaselinePayload | ConvertTo-Json -Depth 6 | Set-Content -Path $RetentionBaselinePath -Encoding UTF8
    $reportPayload | ConvertTo-Json -Depth 10 | Set-Content -Path $ReportJsonPath -Encoding UTF8

    return [pscustomobject]@{
        Markdown = $markdown
        ReportPayload = $reportPayload
        RetentionBaselinePayload = $retentionBaselinePayload
    }
}
