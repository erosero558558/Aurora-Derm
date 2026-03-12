param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$TimeoutSec = 15,
    [int]$MaxLatencyMs = 3500,
    [switch]$AllowDegradedFigo,
    [switch]$AllowDegradedServicePriorities,
    [switch]$AllowDegradedPublicSync,
    [switch]$SkipBackupCheck,
    [switch]$AllowStoreCalendar,
    [switch]$AllowBlockedCalendar,
    [switch]$RequireServicePrioritiesFunnel,
    [switch]$AllowDegradedTelemedicineDiagnostics,
    [bool]$RequireTelemedicineConfigured = $true,
    [int]$MaxTelemedicineReviewQueue = 12,
    [int]$MaxTelemedicineStagedUploads = 1,
    [int]$MaxTelemedicineUnlinkedIntakes = 5,
    [int]$MinServicePrioritiesServices = 1,
    [int]$MinServicePrioritiesCategories = 1,
    [int]$MinServicePrioritiesFeatured = 1
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$todayDate = Get-Date -Format 'yyyy-MM-dd'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'
. $commonHttpPath

$checks = @(
    @{ Name = 'home'; Url = "$base/"; MaxLatencyMs = 5000 },  # full HTML page — higher threshold
    @{ Name = 'health'; Url = "$base/api.php?resource=health" },
    @{ Name = 'reviews'; Url = "$base/api.php?resource=reviews" },
    @{ Name = 'availability'; Url = "$base/api.php?resource=availability" },
    @{ Name = 'booked-slots'; Url = "$base/api.php?resource=booked-slots&date=$todayDate&doctor=indiferente&service=consulta" },
    @{ Name = 'service-priorities'; Url = "$base/api.php?resource=service-priorities&limit=12&categoryLimit=8&featuredLimit=3" },
    @{ Name = 'figo-get'; Url = "$base/figo-chat.php" }
)

$results = @()
$failures = @()
$effectiveAllowStoreCalendar = [bool]$AllowStoreCalendar

function Add-MonitorFailure {
    param(
        [string]$Message,
        [switch]$AllowDegraded
    )

    if ($AllowDegraded) {
        $warningMessage = $Message -replace '^\[FAIL\]', '[WARN]'
        Write-Host $warningMessage
        return
    }

    $script:failures += $Message
}

Write-Host "== Monitor Produccion =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

foreach ($c in $checks) {
    $r = Invoke-EndpointCheck -Name $c.Name -Url $c.Url -TimeoutSec $TimeoutSec
    $results += $r

    if ($r.StatusCode -ne 200) {
        $handledBlockedCalendar = $false
        if (
            $AllowBlockedCalendar -and
            ($r.Name -eq 'availability' -or $r.Name -eq 'booked-slots') -and
            $r.StatusCode -eq 503
        ) {
            $payload = Parse-JsonBody -Body $r.Body -Depth 10
            $code = ''
            try { $code = [string]$payload.code } catch {}
            if ($code -eq 'calendar_unreachable') {
                Write-Host "[WARN] $($r.Name): calendario bloqueado temporalmente (503 calendar_unreachable)"
                $handledBlockedCalendar = $true
            }
        }

        if (-not $handledBlockedCalendar) {
            $failures += "[FAIL] $($r.Name): status=$($r.StatusCode) error=$($r.Error)"
        }
        continue
    }

    $effectiveMaxLatencyMs = if ($c.MaxLatencyMs) { $c.MaxLatencyMs } else { $MaxLatencyMs }
    if ($r.DurationMs -gt $effectiveMaxLatencyMs) {
        $failures += "[FAIL] $($r.Name): latencia alta $($r.DurationMs)ms (max ${effectiveMaxLatencyMs}ms)"
    } else {
        Write-Host "[OK]  $($r.Name): $($r.StatusCode) en $($r.DurationMs)ms"
    }
}

$healthResult = $results | Where-Object { $_.Name -eq 'health' } | Select-Object -First 1
if ($null -ne $healthResult -and $healthResult.StatusCode -eq 200) {
    $health = Parse-JsonBody -Body $healthResult.Body -Depth 10
    if ($null -eq $health) {
        $failures += '[FAIL] health: JSON invalido'
    } else {
        try {
            if ($health.status -ne 'ok') {
                $failures += "[FAIL] health.status=$($health.status)"
            }
            if (-not [bool]$health.storageReady) {
                $failures += '[FAIL] health.storageReady=false'
            }
            if ([string]$health.dataDirSource -eq 'tmp') {
                $failures += '[FAIL] health.dataDirSource=tmp (no persistente)'
            }
            if (-not $SkipBackupCheck) {
                $backupOk = $false
                try { $backupOk = [bool]$health.checks.backup.ok } catch { $backupOk = $false }
                if (-not $backupOk) {
                    $reason = ''
                    try { $reason = [string]$health.checks.backup.reason } catch {}
                    $failures += "[FAIL] backup no saludable (reason=$reason)"
                }
            }

            $publicSyncNode = $null
            try { $publicSyncNode = $health.checks.publicSync } catch { $publicSyncNode = $null }
            if ($null -eq $publicSyncNode) {
                Add-MonitorFailure -Message '[FAIL] health.checks.publicSync ausente' -AllowDegraded:$AllowDegradedPublicSync
            } else {
                $publicSyncConfigured = $false
                $publicSyncHealthy = $false
                $publicSyncJobId = ''
                $publicSyncState = 'unknown'
                $publicSyncAgeSeconds = 999999
                $publicSyncExpectedMaxLagSeconds = 120
                $publicSyncFailureReason = ''
                $publicSyncLastErrorMessage = ''
                $publicSyncCurrentHead = ''
                $publicSyncRemoteHead = ''
                $publicSyncDirtyPathsCount = 0
                $publicSyncDirtyPathsSample = @()

                try { $publicSyncConfigured = [bool]$publicSyncNode.configured } catch { $publicSyncConfigured = $false }
                try { $publicSyncHealthy = [bool]$publicSyncNode.healthy } catch { $publicSyncHealthy = $false }
                try { $publicSyncJobId = [string]$publicSyncNode.jobId } catch { $publicSyncJobId = '' }
                try { $publicSyncState = [string]$publicSyncNode.state } catch { $publicSyncState = 'unknown' }
                try { $publicSyncAgeSeconds = [int]$publicSyncNode.ageSeconds } catch { $publicSyncAgeSeconds = 999999 }
                try { $publicSyncExpectedMaxLagSeconds = [int]$publicSyncNode.expectedMaxLagSeconds } catch { $publicSyncExpectedMaxLagSeconds = 120 }
                try { $publicSyncFailureReason = [string]$publicSyncNode.failureReason } catch { $publicSyncFailureReason = '' }
                try { $publicSyncLastErrorMessage = [string]$publicSyncNode.lastErrorMessage } catch { $publicSyncLastErrorMessage = '' }
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

                if ([string]::IsNullOrWhiteSpace($publicSyncFailureReason) -and -not [string]::IsNullOrWhiteSpace($publicSyncLastErrorMessage)) {
                    $publicSyncFailureReason = $publicSyncLastErrorMessage
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
                    -not [string]::IsNullOrWhiteSpace($publicSyncFailureReason) -and
                    [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
                    [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
                    $publicSyncDirtyPathsCount -le 0
                )

                Write-Host "[INFO] health.publicSync configured=$publicSyncConfigured healthy=$publicSyncHealthy jobId=$publicSyncJobId state=$publicSyncState ageSeconds=$publicSyncAgeSeconds expectedMaxLagSeconds=$publicSyncExpectedMaxLagSeconds failureReason=$publicSyncFailureReason lastErrorMessage=$publicSyncLastErrorMessage currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead headDrift=$publicSyncHeadDrift dirtyPathsCount=$publicSyncDirtyPathsCount telemetryGap=$publicSyncTelemetryGap dirtyPathsSample=$publicSyncDirtyPathsSampleLabel"

                if (-not $publicSyncConfigured) {
                    Add-MonitorFailure -Message '[FAIL] health.publicSync.configured=false' -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and $publicSyncJobId -ne '8d31e299-7e57-4959-80b5-aaa2d73e9674') {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync.jobId invalido ($publicSyncJobId)" -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and -not $publicSyncHealthy) {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync unhealthy (state=$publicSyncState, failureReason=$publicSyncFailureReason, headDrift=$publicSyncHeadDrift, telemetryGap=$publicSyncTelemetryGap, dirtyPathsCount=$publicSyncDirtyPathsCount)" -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and $publicSyncAgeSeconds -gt $publicSyncExpectedMaxLagSeconds) {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync stale age=$publicSyncAgeSeconds max=$publicSyncExpectedMaxLagSeconds (state=$publicSyncState)" -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and $publicSyncHeadDrift) {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync head drift (currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead)" -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and $publicSyncTelemetryGap) {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync telemetry gap (failureReason=$publicSyncFailureReason lastErrorMessage=$publicSyncLastErrorMessage)" -AllowDegraded:$AllowDegradedPublicSync
                }
                if (
                    $publicSyncConfigured -and
                    $publicSyncFailureReason -eq 'working_tree_dirty' -and
                    -not $publicSyncTelemetryGap
                ) {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync working tree dirty (dirtyPathsCount=$publicSyncDirtyPathsCount dirtyPathsSample=$publicSyncDirtyPathsSampleLabel)" -AllowDegraded:$AllowDegradedPublicSync
                }
            }

            $calendarSource = ''
            $calendarMode = ''
            $calendarReachable = $false
            $calendarConfigured = $false
            $calendarRequired = $false
            $calendarLastErrorReason = ''
            $calendarLastErrorAt = ''
            try { $calendarSource = [string]$health.calendarSource } catch {}
            try { $calendarMode = [string]$health.calendarMode } catch {}
            try { $calendarReachable = [bool]$health.calendarReachable } catch { $calendarReachable = $false }
            try { $calendarConfigured = [bool]$health.calendarConfigured } catch { $calendarConfigured = $false }
            try { $calendarRequired = [bool]$health.calendarRequired } catch { $calendarRequired = $false }
            try { $calendarLastErrorReason = [string]$health.calendarLastErrorReason } catch {}
            try { $calendarLastErrorAt = [string]$health.calendarLastErrorAt } catch {}

            if ($calendarRequired -and $effectiveAllowStoreCalendar) {
                $effectiveAllowStoreCalendar = $false
                Write-Host '[WARN] health.calendarRequired=true; se fuerza validacion strict Google en monitor.'
            }

            if (-not $effectiveAllowStoreCalendar -and $calendarSource -ne 'google') {
                $failures += "[FAIL] health.calendarSource=$calendarSource (esperado=google)"
            }

            if ($calendarSource -eq 'google') {
                if (-not $calendarConfigured) {
                    $failures += '[FAIL] health.calendarConfigured=false'
                }
                if (-not $calendarReachable) {
                    $failures += '[FAIL] health.calendarReachable=false'
                }
                if (-not $AllowBlockedCalendar -and $calendarMode -ne 'live') {
                    $failures += "[FAIL] health.calendarMode=$calendarMode (reason=$calendarLastErrorReason at=$calendarLastErrorAt)"
                }
            }

            $telemedicineNode = $null
            try { $telemedicineNode = $health.checks.telemedicine } catch { $telemedicineNode = $null }
            if ($null -eq $telemedicineNode) {
                if ($RequireTelemedicineConfigured) {
                    $failures += '[FAIL] health.checks.telemedicine ausente'
                } else {
                    Write-Host '[WARN] health.checks.telemedicine ausente (modo permisivo)'
                }
            } else {
                $telemedicineConfigured = $false
                $telemedicineReviewQueueCount = 0
                $telemedicineDiagnosticsStatus = ''
                $telemedicineCriticalCount = 0
                $telemedicineWarningCount = 0
                $telemedicineStagedLegacyCount = 0
                $telemedicineUnlinkedIntakesCount = 0
                $telemedicineDanglingLinksCount = 0
                $telemedicineCasePhotosWithoutPrivatePathCount = 0

                try { $telemedicineConfigured = [bool]$telemedicineNode.configured } catch { $telemedicineConfigured = $false }
                try { $telemedicineReviewQueueCount = [int]$telemedicineNode.reviewQueueCount } catch { $telemedicineReviewQueueCount = 0 }
                try { $telemedicineDiagnosticsStatus = [string]$telemedicineNode.diagnostics.status } catch { $telemedicineDiagnosticsStatus = '' }
                try { $telemedicineCriticalCount = [int]$telemedicineNode.diagnostics.summary.critical } catch { $telemedicineCriticalCount = 0 }
                try { $telemedicineWarningCount = [int]$telemedicineNode.diagnostics.summary.warning } catch { $telemedicineWarningCount = 0 }
                try { $telemedicineStagedLegacyCount = [int]$telemedicineNode.integrity.stagedLegacyUploadsCount } catch { $telemedicineStagedLegacyCount = 0 }
                try { $telemedicineUnlinkedIntakesCount = [int]$telemedicineNode.integrity.unlinkedIntakesCount } catch { $telemedicineUnlinkedIntakesCount = 0 }
                try { $telemedicineDanglingLinksCount = [int]$telemedicineNode.integrity.danglingAppointmentLinksCount } catch { $telemedicineDanglingLinksCount = 0 }
                try { $telemedicineCasePhotosWithoutPrivatePathCount = [int]$telemedicineNode.integrity.casePhotosWithoutPrivatePathCount } catch { $telemedicineCasePhotosWithoutPrivatePathCount = 0 }

                Write-Host "[INFO] telemedicine diagnostics=$telemedicineDiagnosticsStatus critical=$telemedicineCriticalCount warning=$telemedicineWarningCount reviewQueue=$telemedicineReviewQueueCount"

                if ($RequireTelemedicineConfigured -and -not $telemedicineConfigured) {
                    $failures += '[FAIL] health.checks.telemedicine.configured=false'
                }
                if (-not $AllowDegradedTelemedicineDiagnostics -and ($telemedicineDiagnosticsStatus -eq 'critical' -or $telemedicineCriticalCount -gt 0)) {
                    $failures += "[FAIL] health.telemedicine diagnostics en estado critico (status=$telemedicineDiagnosticsStatus, critical=$telemedicineCriticalCount)"
                }
                if ($telemedicineReviewQueueCount -gt $MaxTelemedicineReviewQueue) {
                    $failures += "[FAIL] health.telemedicine.reviewQueueCount=$telemedicineReviewQueueCount (> $MaxTelemedicineReviewQueue)"
                }
                if ($telemedicineStagedLegacyCount -gt $MaxTelemedicineStagedUploads) {
                    $failures += "[FAIL] health.telemedicine.integrity.stagedLegacyUploadsCount=$telemedicineStagedLegacyCount (> $MaxTelemedicineStagedUploads)"
                }
                if ($telemedicineUnlinkedIntakesCount -gt $MaxTelemedicineUnlinkedIntakes) {
                    $failures += "[FAIL] health.telemedicine.integrity.unlinkedIntakesCount=$telemedicineUnlinkedIntakesCount (> $MaxTelemedicineUnlinkedIntakes)"
                }
                if ($telemedicineDanglingLinksCount -gt 0) {
                    $failures += "[FAIL] health.telemedicine.integrity.danglingAppointmentLinksCount=$telemedicineDanglingLinksCount (> 0)"
                }
                if ($telemedicineCasePhotosWithoutPrivatePathCount -gt 0) {
                    $failures += "[FAIL] health.telemedicine.integrity.casePhotosWithoutPrivatePathCount=$telemedicineCasePhotosWithoutPrivatePathCount (> 0)"
                }
            }
        } catch {
            $failures += "[FAIL] health: validacion exception $($_.Exception.Message)"
        }
    }
}

$figoResult = $results | Where-Object { $_.Name -eq 'figo-get' } | Select-Object -First 1
if ($null -ne $figoResult -and $figoResult.StatusCode -eq 200) {
    $figo = Parse-JsonBody -Body $figoResult.Body -Depth 10
    if ($null -eq $figo) {
        $failures += '[FAIL] figo-get: JSON invalido'
    } else {
        $mode = ''
        try { $mode = [string]$figo.mode } catch {}
        if (-not $AllowDegradedFigo -and $mode -ne 'live') {
            $reason = ''
            try { $reason = [string]$figo.reason } catch {}
            $failures += "[FAIL] figo mode no-live (mode=$mode reason=$reason)"
        }
    }
}

$availabilityResult = $results | Where-Object { $_.Name -eq 'availability' } | Select-Object -First 1
if ($null -ne $availabilityResult -and $availabilityResult.StatusCode -eq 200) {
    $availability = Parse-JsonBody -Body $availabilityResult.Body -Depth 10
    if ($null -eq $availability) {
        $failures += '[FAIL] availability: JSON invalido'
    } else {
        $meta = $null
        try { $meta = $availability.meta } catch { $meta = $null }
        if ($null -eq $meta) {
            $failures += '[FAIL] availability: meta ausente'
        } else {
            $source = ''
            $mode = ''
            $duration = 0
            try { $source = [string]$meta.source } catch {}
            try { $mode = [string]$meta.mode } catch {}
            try { $duration = [int]$meta.durationMin } catch { $duration = 0 }

            if (-not $effectiveAllowStoreCalendar -and $source -ne 'google') {
                $failures += "[FAIL] availability.meta.source=$source (esperado=google)"
            }
            if (-not $AllowBlockedCalendar -and $mode -ne 'live') {
                $failures += "[FAIL] availability.meta.mode=$mode (esperado=live)"
            }
            if ($duration -le 0) {
                $failures += "[FAIL] availability.meta.durationMin invalido ($duration)"
            }
        }
    }
}

$bookedResult = $results | Where-Object { $_.Name -eq 'booked-slots' } | Select-Object -First 1
if ($null -ne $bookedResult -and $bookedResult.StatusCode -eq 200) {
    $booked = Parse-JsonBody -Body $bookedResult.Body -Depth 10
    if ($null -eq $booked) {
        $failures += '[FAIL] booked-slots: JSON invalido'
    } else {
        $meta = $null
        try { $meta = $booked.meta } catch { $meta = $null }
        if ($null -eq $meta) {
            $failures += '[FAIL] booked-slots: meta ausente'
        } else {
            $source = ''
            $mode = ''
            $duration = 0
            try { $source = [string]$meta.source } catch {}
            try { $mode = [string]$meta.mode } catch {}
            try { $duration = [int]$meta.durationMin } catch { $duration = 0 }

            if (-not $effectiveAllowStoreCalendar -and $source -ne 'google') {
                $failures += "[FAIL] booked-slots.meta.source=$source (esperado=google)"
            }
            if (-not $AllowBlockedCalendar -and $mode -ne 'live') {
                $failures += "[FAIL] booked-slots.meta.mode=$mode (esperado=live)"
            }
            if ($duration -le 0) {
                $failures += "[FAIL] booked-slots.meta.durationMin invalido ($duration)"
            }
        }
    }
}

$servicePrioritiesResult = $results | Where-Object { $_.Name -eq 'service-priorities' } | Select-Object -First 1
if ($null -ne $servicePrioritiesResult -and $servicePrioritiesResult.StatusCode -eq 200) {
    $servicePriorities = Parse-JsonBody -Body $servicePrioritiesResult.Body -Depth 10
    if ($null -eq $servicePriorities) {
        $failures += '[FAIL] service-priorities: JSON invalido'
    } else {
        $meta = $null
        $data = $null
        try { $meta = $servicePriorities.meta } catch { $meta = $null }
        try { $data = $servicePriorities.data } catch { $data = $null }
        if ($null -eq $meta) {
            $failures += '[FAIL] service-priorities: meta ausente'
        } else {
            $source = ''
            $catalogVersion = ''
            $serviceCountMeta = -1
            try { $source = [string]$meta.source } catch {}
            try { $catalogVersion = [string]$meta.catalogVersion } catch {}
            try { $serviceCountMeta = [int]$meta.serviceCount } catch { $serviceCountMeta = -1 }

            $allowedSources = @('catalog_only', 'catalog+funnel')
            if ($RequireServicePrioritiesFunnel) {
                $allowedSources = @('catalog+funnel')
            }
            if (-not $AllowDegradedServicePriorities -and -not ($allowedSources -contains $source)) {
                $failures += "[FAIL] service-priorities.meta.source=$source (esperado=$($allowedSources -join '|'))"
            }
            if (-not $RequireServicePrioritiesFunnel -and $source -eq 'catalog_only') {
                Write-Host '[WARN] service-priorities sin señales de funnel; usando catalog_only temporalmente.'
            }
            if ([string]::IsNullOrWhiteSpace($catalogVersion)) {
                $failures += '[FAIL] service-priorities.meta.catalogVersion vacio'
            }
            if ($serviceCountMeta -lt $MinServicePrioritiesServices) {
                $failures += "[FAIL] service-priorities.meta.serviceCount=$serviceCountMeta (< $MinServicePrioritiesServices)"
            }
        }

        if ($null -eq $data) {
            $failures += '[FAIL] service-priorities: data ausente'
        } else {
            $servicesCount = 0
            $categoriesCount = 0
            $featuredCount = 0
            try { $servicesCount = @($data.services).Count } catch { $servicesCount = 0 }
            try { $categoriesCount = @($data.categories).Count } catch { $categoriesCount = 0 }
            try { $featuredCount = @($data.featured).Count } catch { $featuredCount = 0 }

            if ($servicesCount -lt $MinServicePrioritiesServices) {
                $failures += "[FAIL] service-priorities.data.services count=$servicesCount (< $MinServicePrioritiesServices)"
            }
            if ($categoriesCount -lt $MinServicePrioritiesCategories) {
                $failures += "[FAIL] service-priorities.data.categories count=$categoriesCount (< $MinServicePrioritiesCategories)"
            }
            if ($featuredCount -lt $MinServicePrioritiesFeatured) {
                $failures += "[FAIL] service-priorities.data.featured count=$featuredCount (< $MinServicePrioritiesFeatured)"
            }
        }
    }
}

Write-Host ''
if ($failures.Count -gt 0) {
    Write-Host 'Resultado: FALLIDO' -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host $f -ForegroundColor Red
    }
    exit 1
}

Write-Host 'Resultado: OK' -ForegroundColor Green
exit 0
