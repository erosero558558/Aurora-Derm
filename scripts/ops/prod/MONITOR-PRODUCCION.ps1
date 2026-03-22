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
    [switch]$RequireAuthConfigured,
    [switch]$RequireOperatorAuth,
    [switch]$RequireAdminTwoFactor,
    [switch]$RequireStoreEncryption,
    [string]$GitHubRepo = 'erosero558558/Aurora-Derm',
    [string]$GitHubApiBase = 'https://api.github.com',
    [int]$GitHubAlertsTimeoutSec = 15,
    [int]$GitHubAlertsIssueLimit = 30,
    [bool]$RequireTelemedicineConfigured = $true,
    [int]$MaxTelemedicineReviewQueue = 12,
    [int]$MaxTelemedicineStagedUploads = 1,
    [int]$MaxTelemedicineUnlinkedIntakes = 5,
    [int]$MinServicePrioritiesServices = 1,
    [int]$MinServicePrioritiesCategories = 1,
    [int]$MinServicePrioritiesFeatured = 1,
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$todayDate = Get-Date -Format 'yyyy-MM-dd'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..')
$defaultReportPath = Join-Path $repoRoot 'verification\runtime\prod-monitor-last.json'
$effectiveReportPath = if ([string]::IsNullOrWhiteSpace($ReportPath)) { $defaultReportPath } else { $ReportPath }
$commonHttpPath = Join-Path $repoRoot 'bin/powershell/Common.Http.ps1'
$openClawAuthDiagnosticScriptPath = Join-Path $repoRoot 'scripts/ops/admin/DIAGNOSTICAR-OPENCLAW-AUTH-ROLLOUT.ps1'
$turneroClinicProfileScriptPath = Join-Path $repoRoot 'bin/turnero-clinic-profile.js'
. $commonHttpPath

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
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_INPUT,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_FAST_EFFECTIVE,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH_FAST,
        $env:ADMIN_ROLLOUT_REQUIRE_OPERATOR_AUTH,
        $env:ADMIN_ROLLOUT_REQUIRE_OPENCLAW_AUTH_EFFECTIVE,
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

$checks = @(
    @{ Name = 'home'; Url = "$base/"; MaxLatencyMs = 5000 },  # full HTML page — higher threshold
    @{ Name = 'health-diagnostics'; Url = "$base/api.php?resource=health-diagnostics" },
    @{ Name = 'admin-auth-status'; Url = "$base/admin-auth.php?action=status" },
    @{ Name = 'reviews'; Url = "$base/api.php?resource=reviews" },
    @{ Name = 'availability'; Url = "$base/api.php?resource=availability" },
    @{ Name = 'booked-slots'; Url = "$base/api.php?resource=booked-slots&date=$todayDate&doctor=indiferente&service=consulta" },
    @{ Name = 'service-priorities'; Url = "$base/api.php?resource=service-priorities&limit=12&categoryLimit=8&featuredLimit=3" },
    @{ Name = 'figo-get'; Url = "$base/figo-chat.php" }
)

$results = @()
$failures = @()
$warnings = @()
$effectiveAllowStoreCalendar = [bool]$AllowStoreCalendar
$monitorStatus = 'unknown'
$healthSnapshot = [ordered]@{
    available = $false
    status = 'not_evaluated'
    storageReady = $false
    dataDirSource = ''
    calendarSource = ''
    calendarMode = ''
    calendarReachable = $false
    calendarConfigured = $false
    calendarRequired = $false
    calendarLastErrorReason = ''
    calendarLastErrorAt = ''
    storage = [ordered]@{
        available = $false
        backend = ''
        source = ''
        encrypted = $false
        encryptionConfigured = $false
        encryptionRequired = $false
        encryptionStatus = 'unknown'
        encryptionCompliant = $false
    }
    auth = [ordered]@{
        available = $false
        mode = 'unknown'
        status = 'unknown'
        configured = $false
        hardeningCompliant = $false
        recommendedMode = 'google_oauth'
        recommendedModeActive = $false
        operatorAuthEnabled = $false
        operatorAuthConfigured = $false
        legacyPasswordConfigured = $false
        twoFactorEnabled = $false
    }
}
$publicSyncSnapshot = [ordered]@{
    available = $false
    status = 'not_evaluated'
    configured = $false
    healthy = $false
    operationallyHealthy = $false
    repoHygieneIssue = $false
    failureReason = ''
    lastErrorMessage = ''
    jobId = ''
    state = 'unknown'
    ageSeconds = $null
    expectedMaxLagSeconds = $null
    currentHead = ''
    remoteHead = ''
    headDrift = $false
    telemetryGap = $false
    dirtyPathsCount = 0
    dirtyPathsSample = @()
}
$telemedicineSnapshot = [ordered]@{
    available = $false
    status = 'not_evaluated'
    configured = $false
    diagnosticsStatus = ''
    reviewQueueCount = 0
    criticalCount = 0
    warningCount = 0
    stagedLegacyUploadsCount = 0
    unlinkedIntakesCount = 0
    danglingAppointmentLinksCount = 0
    casePhotosWithoutPrivatePathCount = 0
}
$turneroPilotSnapshot = [ordered]@{
    available = $false
    status = 'not_evaluated'
    clinicId = ''
    catalogMatch = $false
    verifyRequired = $false
    recoveryTargets = @()
    remote = [ordered]@{
        clinicId = ''
        profileFingerprint = ''
        catalogReady = $false
        ok = $false
    }
}
$githubDeployAlertsSnapshot = [ordered]@{
    available = $false
    status = 'not_evaluated'
    repo = $GitHubRepo
    fetchOk = $false
    error = ''
    relevantCount = 0
    transportCount = 0
    connectivityCount = 0
    repairGitSyncCount = 0
    selfHostedRunnerCount = 0
    selfHostedDeployCount = 0
    turneroPilotCount = 0
    issueNumbers = 'none'
    issueRefs = 'none'
    recoveryTargets = @()
    hasTransportBlock = $false
    hasConnectivityBlock = $false
    hasRepairGitSyncBlock = $false
    hasSelfHostedRunnerBlock = $false
    hasSelfHostedDeployBlock = $false
    hasTurneroPilotBlock = $false
}
$servicePrioritiesSnapshot = [ordered]@{
    available = $false
    status = 'not_evaluated'
    source = ''
    catalogVersion = ''
    serviceCountMeta = $null
    servicesCount = 0
    categoriesCount = 0
    featuredCount = 0
}

function Add-MonitorWarning {
    param([string]$Message)

    $script:warnings += $Message
    Write-Host $Message
}

function Add-MonitorFailure {
    param(
        [string]$Message,
        [switch]$AllowDegraded
    )

    if ($AllowDegraded) {
        $warningMessage = $Message -replace '^\[FAIL\]', '[WARN]'
        Add-MonitorWarning -Message $warningMessage
        return
    }

    $script:failures += $Message
}

function Get-MonitorReportRelativePath {
    param([string]$Path)

    try {
        $resolvedRepoRoot = [System.IO.Path]::GetFullPath([string]$repoRoot)
        $resolvedPath = [System.IO.Path]::GetFullPath([string]$Path)
        if ($resolvedPath.StartsWith($resolvedRepoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $resolvedPath.Substring($resolvedRepoRoot.Length).TrimStart('\') -replace '\\', '/'
        }
        return $resolvedPath -replace '\\', '/'
    } catch {
        return [string]$Path
    }
}

function Get-MonitorActionSummary {
    $areas = New-Object System.Collections.Generic.List[string]
    foreach ($message in @($script:failures + $script:warnings)) {
        if ($message -match 'health\.publicSync|publicSync') {
            if (-not $areas.Contains('publicSync')) { $areas.Add('publicSync') }
        }
        if ($message -match 'telemedicine') {
            if (-not $areas.Contains('telemedicine')) { $areas.Add('telemedicine') }
        }
        if ($message -match 'turneroPilot') {
            if (-not $areas.Contains('turneroPilot')) { $areas.Add('turneroPilot') }
        }
        if ($message -match 'github\.deployAlerts') {
            if (-not $areas.Contains('githubDeployAlerts')) { $areas.Add('githubDeployAlerts') }
        }
        if ($message -match 'service-priorities') {
            if (-not $areas.Contains('servicePriorities')) { $areas.Add('servicePriorities') }
        }
        if ($message -match 'health\.auth') {
            if (-not $areas.Contains('auth')) { $areas.Add('auth') }
        }
        if ($message -match 'health\.storage') {
            if (-not $areas.Contains('storage')) { $areas.Add('storage') }
        }
    }

    $headline = if ($script:failures.Count -gt 0) {
        'Revisar fallas criticas antes de considerar el monitor estable.'
    } elseif ($script:warnings.Count -gt 0) {
        'Monitor estable con warnings; revisar guardrails degradados y deuda operativa.'
    } else {
        'Sin accion inmediata; mantener corrida programada y captura de evidencia.'
    }

    $nextActions = if ($areas.Count -gt 0) {
        @($areas | ForEach-Object { "Revisar area $_" })
    } elseif ($script:failures.Count -gt 0) {
        @('Revisar detalle de failures del monitor.')
    } elseif ($script:warnings.Count -gt 0) {
        @('Revisar detalle de warnings del monitor.')
    } else {
        @('Mantener monitoreo continuo en produccion.')
    }

    return [ordered]@{
        headline = $headline
        focusAreas = @($areas)
        nextActions = $nextActions
    }
}

function Write-MonitorReport {
    $latencyThresholds = @{}
    foreach ($check in $checks) {
        $latencyThresholds[[string]$check.Name] = if ($check.MaxLatencyMs) { [int]$check.MaxLatencyMs } else { $MaxLatencyMs }
    }
    $latencyEndpoints = @(
        $results | ForEach-Object {
            [ordered]@{
                name = [string]$_.Name
                url = [string]$_.Url
                statusCode = $_.StatusCode
                durationMs = $_.DurationMs
                error = [string]$_.Error
                ok = ($_.StatusCode -eq 200)
            }
        }
    )
    $slowEndpoints = @(
        $latencyEndpoints | Where-Object {
            $endpoint = $_
            $max = if ($latencyThresholds.ContainsKey([string]$endpoint.name)) { [int]$latencyThresholds[[string]$endpoint.name] } else { $MaxLatencyMs }
            [int]$endpoint.durationMs -gt $max
        } | ForEach-Object { $_.name }
    )
    $reportPayload = [ordered]@{
        version = 1
        generatedAt = [DateTimeOffset]::UtcNow.ToString('o')
        domain = $base
        reportPath = Get-MonitorReportRelativePath -Path $effectiveReportPath
        ok = ($script:failures.Count -eq 0)
        status = $script:monitorStatus
        failures = @($script:failures)
        warnings = @($script:warnings)
        latency = [ordered]@{
            maxLatencyMs = $MaxLatencyMs
            endpoints = $latencyEndpoints
            slowEndpoints = $slowEndpoints
        }
        checks = [ordered]@{
            health = $script:healthSnapshot
            publicSync = $script:publicSyncSnapshot
            telemedicine = $script:telemedicineSnapshot
            turneroPilot = $script:turneroPilotSnapshot
            githubDeployAlerts = $script:githubDeployAlertsSnapshot
            servicePriorities = $script:servicePrioritiesSnapshot
        }
        summary = Get-MonitorActionSummary
    }

    $reportDirectory = Split-Path -Parent $effectiveReportPath
    if (-not [string]::IsNullOrWhiteSpace($reportDirectory)) {
        New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
    }
    $reportPayload | ConvertTo-Json -Depth 12 | Set-Content -Path $effectiveReportPath -Encoding utf8
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

    $reportPath = Join-Path ([System.IO.Path]::GetTempPath()) ("openclaw-auth-rollout-monitor-" + [Guid]::NewGuid().ToString('N') + '.json')

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

Write-Host "== Monitor Produccion =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$effectiveRequireOperatorAuth = Resolve-RequireOperatorAuthFlag -ExplicitFlag:$RequireOperatorAuth
if ($effectiveRequireOperatorAuth -and -not $RequireOperatorAuth) {
    Write-Host "[INFO] RequireOperatorAuth activado automaticamente por la politica efectiva del rollout admin."
}

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
                Add-MonitorWarning -Message "[WARN] $($r.Name): calendario bloqueado temporalmente (503 calendar_unreachable)"
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

$healthResult = $results | Where-Object { $_.Name -eq 'health-diagnostics' } | Select-Object -First 1
if ($null -ne $healthResult -and $healthResult.StatusCode -eq 200) {
    $health = Parse-JsonBody -Body $healthResult.Body -Depth 10
    if ($null -eq $health) {
        $failures += '[FAIL] health-diagnostics: JSON invalido'
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

            $storageNode = $null
            try { $storageNode = $health.checks.storage } catch { $storageNode = $null }
            if ($null -eq $storageNode) {
                if ($RequireStoreEncryption) {
                    $failures += '[FAIL] health.checks.storage ausente'
                } else {
                    Add-MonitorWarning -Message '[WARN] health.checks.storage ausente'
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

                Write-Host "[INFO] health.storage backend=$storageBackend source=$storageSource encrypted=$storeEncrypted encryptionConfigured=$storeEncryptionConfigured encryptionRequired=$storeEncryptionRequired encryptionStatus=$storeEncryptionStatus encryptionCompliant=$storeEncryptionCompliant"

                if ($storeEncryptionRequired -and -not $storeEncryptionCompliant) {
                    $failures += "[FAIL] health.storage.encryptionCompliant=false (status=$storeEncryptionStatus configured=$storeEncryptionConfigured required=$storeEncryptionRequired)"
                } elseif ($RequireStoreEncryption -and -not $storeEncryptionCompliant) {
                    $failures += "[FAIL] health.storage.encryptionCompliant=false (status=$storeEncryptionStatus configured=$storeEncryptionConfigured)"
                } elseif (-not $storeEncryptionCompliant) {
                    Add-MonitorWarning -Message "[WARN] health.storage encryption no compliant (status=$storeEncryptionStatus configured=$storeEncryptionConfigured required=$storeEncryptionRequired)"
                } elseif ($storeEncryptionStatus -eq 'encrypted') {
                    Write-Host '[OK]  health storage cifrado en reposo activo'
                } else {
                    Write-Host "[OK]  health storage status=$storeEncryptionStatus"
                }

                $script:healthSnapshot.storage = [ordered]@{
                    available = $true
                    backend = $storageBackend
                    source = $storageSource
                    encrypted = $storeEncrypted
                    encryptionConfigured = $storeEncryptionConfigured
                    encryptionRequired = $storeEncryptionRequired
                    encryptionStatus = $storeEncryptionStatus
                    encryptionCompliant = $storeEncryptionCompliant
                }
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

            $authNode = $null
            try { $authNode = $health.checks.auth } catch { $authNode = $null }
            if ($null -eq $authNode) {
                $failures += '[FAIL] health.checks.auth ausente'
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

                Write-Host "[INFO] health.auth mode=$authMode status=$authStatus configured=$authConfigured hardeningCompliant=$authHardeningCompliant recommendedMode=$authRecommendedMode recommendedModeActive=$authRecommendedModeActive operatorAuthEnabled=$authOperatorAuthEnabled operatorAuthConfigured=$authOperatorAuthConfigured legacyPasswordConfigured=$authLegacyPasswordConfigured twoFactorEnabled=$authTwoFactorEnabled"

                if (-not $authConfigured) {
                    $failures += "[FAIL] health.auth.configured=false (mode=$authMode status=$authStatus)"
                }
                if ($effectiveRequireOperatorAuth -and -not $authRecommendedModeActive) {
                    $failures += "[FAIL] health.auth.mode=$authMode (esperado=$authRecommendedMode)"
                } elseif (-not $authRecommendedModeActive) {
                    Add-MonitorWarning -Message "[WARN] health.auth mode no recomendado (mode=$authMode expected=$authRecommendedMode)"
                }
                if ($RequireAdminTwoFactor -and -not $authTwoFactorEnabled) {
                    $failures += '[FAIL] health.auth.twoFactorEnabled=false'
                } elseif ($authMode -eq 'legacy_password' -and -not $authTwoFactorEnabled) {
                    Add-MonitorWarning -Message '[WARN] health.auth legacy_password sin 2FA'
                }
                if ($RequireAuthConfigured -and -not $authHardeningCompliant) {
                    $failures += "[FAIL] health.auth.hardeningCompliant=false (mode=$authMode recommendedMode=$authRecommendedMode twoFactorEnabled=$authTwoFactorEnabled)"
                } elseif ($authConfigured -and -not $authHardeningCompliant) {
                    Add-MonitorWarning -Message "[WARN] health.auth hardening pendiente (mode=$authMode recommendedMode=$authRecommendedMode twoFactorEnabled=$authTwoFactorEnabled)"
                }

                if ($effectiveRequireOperatorAuth) {
                    $operatorAuthRollout = Invoke-OpenClawAuthRolloutDiagnostic -BaseUrl $base -ScriptPath $openClawAuthDiagnosticScriptPath
                    Write-Host "[INFO] operator auth rollout diagnosis=$($operatorAuthRollout.diagnosis) source=$($operatorAuthRollout.source) mode=$($operatorAuthRollout.mode) configured=$($operatorAuthRollout.configured)"
                    if (-not $operatorAuthRollout.ok) {
                        Add-MonitorFailure -Message "[FAIL] operator auth rollout diagnosis=$($operatorAuthRollout.diagnosis) source=$($operatorAuthRollout.source) mode=$($operatorAuthRollout.mode) configured=$($operatorAuthRollout.configured) nextAction=$($operatorAuthRollout.nextAction)" -AllowDegraded:$false
                    }
                }

                $script:healthSnapshot.auth = [ordered]@{
                    available = $true
                    mode = $authMode
                    status = $authStatus
                    configured = $authConfigured
                    hardeningCompliant = $authHardeningCompliant
                    recommendedMode = $authRecommendedMode
                    recommendedModeActive = $authRecommendedModeActive
                    operatorAuthEnabled = $authOperatorAuthEnabled
                    operatorAuthConfigured = $authOperatorAuthConfigured
                    legacyPasswordConfigured = $authLegacyPasswordConfigured
                    twoFactorEnabled = $authTwoFactorEnabled
                }
            }

            $publicSyncNode = $null
            try { $publicSyncNode = $health.checks.publicSync } catch { $publicSyncNode = $null }
            if ($null -eq $publicSyncNode) {
                Add-MonitorFailure -Message '[FAIL] health.checks.publicSync ausente' -AllowDegraded:$AllowDegradedPublicSync
                $script:publicSyncSnapshot = [ordered]@{
                    available = $false
                    status = 'failed'
                    configured = $false
                    healthy = $false
                    operationallyHealthy = $false
                    repoHygieneIssue = $false
                    failureReason = 'missing'
                    lastErrorMessage = ''
                    jobId = ''
                    state = 'missing'
                    ageSeconds = $null
                    expectedMaxLagSeconds = $null
                    currentHead = ''
                    remoteHead = ''
                    headDrift = $false
                    telemetryGap = $false
                    dirtyPathsCount = 0
                    dirtyPathsSample = @()
                }
            } else {
                $publicSyncConfigured = $false
                $publicSyncHealthy = $false
                $publicSyncJobId = ''
                $publicSyncState = 'unknown'
                $publicSyncAgeSeconds = 999999
                $publicSyncExpectedMaxLagSeconds = 120
                $publicSyncOperationallyHealthy = $false
                $publicSyncRepoHygieneIssue = $false
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
                try { $publicSyncOperationallyHealthy = [bool]$publicSyncNode.operationallyHealthy } catch { $publicSyncOperationallyHealthy = $publicSyncHealthy }
                try { $publicSyncRepoHygieneIssue = [bool]$publicSyncNode.repoHygieneIssue } catch { $publicSyncRepoHygieneIssue = $false }
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
                    -not $publicSyncOperationallyHealthy -and
                    -not [string]::IsNullOrWhiteSpace($publicSyncFailureReason) -and
                    [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
                    [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
                    $publicSyncDirtyPathsCount -le 0
                )
                $publicSyncUnverifiedTelemetry = (
                    -not $publicSyncOperationallyHealthy -and
                    $publicSyncState -eq 'unknown' -and
                    $publicSyncFailureReason -eq 'unverified' -and
                    [string]::IsNullOrWhiteSpace($publicSyncCurrentHead) -and
                    [string]::IsNullOrWhiteSpace($publicSyncRemoteHead) -and
                    $publicSyncDirtyPathsCount -le 0
                )
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

                Write-Host "[INFO] health.publicSync configured=$publicSyncConfigured healthy=$publicSyncHealthy operationallyHealthy=$publicSyncOperationallyHealthy repoHygieneIssue=$publicSyncRepoHygieneIssue jobId=$publicSyncJobId state=$publicSyncState ageSeconds=$publicSyncAgeSeconds expectedMaxLagSeconds=$publicSyncExpectedMaxLagSeconds failureReason=$publicSyncFailureReason lastErrorMessage=$publicSyncLastErrorMessage currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead headDrift=$publicSyncHeadDrift dirtyPathsCount=$publicSyncDirtyPathsCount telemetryGap=$publicSyncTelemetryGap dirtyPathsSample=$publicSyncDirtyPathsSampleLabel"

                if (-not $publicSyncConfigured) {
                    Add-MonitorFailure -Message '[FAIL] health.publicSync.configured=false' -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and $publicSyncJobId -ne '8d31e299-7e57-4959-80b5-aaa2d73e9674') {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync.jobId invalido ($publicSyncJobId)" -AllowDegraded:$AllowDegradedPublicSync
                }
                if ($publicSyncConfigured -and -not $publicSyncOperationallyHealthy) {
                    Add-MonitorFailure -Message "[FAIL] health.publicSync unhealthy (state=$publicSyncState, failureReason=$publicSyncFailureReason, repoHygieneIssue=$publicSyncRepoHygieneIssue, headDrift=$publicSyncHeadDrift, telemetryGap=$publicSyncTelemetryGap, dirtyPathsCount=$publicSyncDirtyPathsCount)" -AllowDegraded:$AllowDegradedPublicSync
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
                if ($publicSyncConfigured -and $publicSyncUnverifiedTelemetry) {
                    Write-Host '[WARN] health.publicSync unverified sin heads ni dirty paths; si jobs verify reporta verification_source=registry_only, confirmar health, health-diagnostics y public-sync-status antes de tratarlo como drift del repo'
                }
                if (
                    $publicSyncConfigured -and
                    $publicSyncRepoHygieneIssue
                ) {
                    Add-MonitorWarning -Message "[WARN] health.publicSync repo hygiene issue (dirtyPathsCount=$publicSyncDirtyPathsCount dirtyPathsSample=$publicSyncDirtyPathsSampleLabel)"
                }

                $publicSyncStatus = if (
                    $publicSyncConfigured -and
                    $publicSyncOperationallyHealthy -and
                    $publicSyncAgeSeconds -le $publicSyncExpectedMaxLagSeconds -and
                    -not $publicSyncHeadDrift -and
                    -not $publicSyncTelemetryGap
                ) {
                    if ($publicSyncRepoHygieneIssue) { 'warning' } else { 'ok' }
                } elseif (-not $publicSyncConfigured) {
                    'failed'
                } else {
                    'failed'
                }
                $script:publicSyncSnapshot = [ordered]@{
                    available = $true
                    status = $publicSyncStatus
                    configured = $publicSyncConfigured
                    healthy = $publicSyncHealthy
                    operationallyHealthy = $publicSyncOperationallyHealthy
                    repoHygieneIssue = $publicSyncRepoHygieneIssue
                    failureReason = $publicSyncFailureReason
                    lastErrorMessage = $publicSyncLastErrorMessage
                    jobId = $publicSyncJobId
                    state = $publicSyncState
                    ageSeconds = $publicSyncAgeSeconds
                    expectedMaxLagSeconds = $publicSyncExpectedMaxLagSeconds
                    currentHead = $publicSyncCurrentHead
                    remoteHead = $publicSyncRemoteHead
                    headDrift = $publicSyncHeadDrift
                    telemetryGap = $publicSyncTelemetryGap
                    dirtyPathsCount = $publicSyncDirtyPathsCount
                    dirtyPathsSample = @($publicSyncDirtyPathsSample)
                }
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
                    Add-MonitorFailure -Message '[FAIL] turneroPilot clinic-profile status unresolved' -AllowDegraded:$AllowDegradedPublicSync
                    $script:turneroPilotSnapshot = [ordered]@{
                        available = $true
                        status = 'failed'
                        clinicId = ''
                        catalogMatch = $false
                        verifyRequired = $false
                        recoveryTargets = @()
                        remote = [ordered]@{
                            clinicId = ''
                            profileFingerprint = ''
                            catalogReady = $false
                            ok = $false
                        }
                    }
                } else {
                    try { $turneroPilotClinicId = [string]$turneroPilotStatus.profile.clinic_id } catch { $turneroPilotClinicId = '' }
                    try { $turneroPilotCatalogMatch = [bool]$turneroPilotStatus.matchesCatalog } catch { $turneroPilotCatalogMatch = $false }
                    try { $turneroPilotVerifyRequired = ([bool]$turneroPilotStatus.ok) -and ([string]$turneroPilotStatus.profile.release.mode -eq 'web_pilot') } catch { $turneroPilotVerifyRequired = $false }

                    if (-not $turneroPilotCatalogMatch) {
                        Add-MonitorFailure -Message "[FAIL] turneroPilot catalog drift (clinicId=$turneroPilotClinicId)" -AllowDegraded:$AllowDegradedPublicSync
                        $script:turneroPilotSnapshot = [ordered]@{
                            available = $true
                            status = 'failed'
                            clinicId = $turneroPilotClinicId
                            catalogMatch = $turneroPilotCatalogMatch
                            verifyRequired = $turneroPilotVerifyRequired
                            recoveryTargets = @()
                            remote = [ordered]@{
                                clinicId = ''
                                profileFingerprint = ''
                                catalogReady = $false
                                ok = $false
                            }
                        }
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
                            Add-MonitorFailure -Message "[FAIL] turneroPilot remote health redacted (resource=$turneroPilotRemoteResource diagnosticsAuthorized=$turneroPilotRemoteDiagnosticsAuthorized)" -AllowDegraded:$AllowDegradedPublicSync
                        } elseif (
                            [string]::IsNullOrWhiteSpace($turneroPilotRemoteClinicId) -or
                            [string]::IsNullOrWhiteSpace($turneroPilotRemoteFingerprint) -or
                            -not $turneroPilotRemoteCatalogReady
                        ) {
                            Add-MonitorFailure -Message "[FAIL] turneroPilot remote identity unresolved (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)" -AllowDegraded:$AllowDegradedPublicSync
                        }

                        if ($turneroPilotRemoteVerificationBlocked) {
                            Add-MonitorFailure -Message "[FAIL] turneroPilot remote mismatch (clinicId=$turneroPilotRemoteClinicId fingerprint=$turneroPilotRemoteFingerprint catalogReady=$turneroPilotRemoteCatalogReady)" -AllowDegraded:$AllowDegradedPublicSync
                        }

                        $script:turneroPilotSnapshot = [ordered]@{
                            available = $true
                            status = if (-not $turneroPilotRemoteVerificationBlocked) { 'ok' } else { 'failed' }
                            clinicId = $turneroPilotClinicId
                            catalogMatch = $turneroPilotCatalogMatch
                            verifyRequired = $turneroPilotVerifyRequired
                            recoveryTargets = @($turneroPilotRecoveryTargets)
                            remote = [ordered]@{
                                clinicId = $turneroPilotRemoteClinicId
                                profileFingerprint = $turneroPilotRemoteFingerprint
                                catalogReady = $turneroPilotRemoteCatalogReady
                                ok = (-not $turneroPilotRemoteVerificationBlocked)
                                publicHealthRedacted = $turneroPilotRemoteHealthRedacted
                                diagnosticsAuthorized = $turneroPilotRemoteDiagnosticsAuthorized
                                resource = $turneroPilotRemoteResource
                            }
                        }
                    } else {
                        Write-Host '[INFO] turneroPilot verify-remote omitido: perfil activo no esta en modo web_pilot.'
                        $script:turneroPilotSnapshot = [ordered]@{
                            available = $true
                            status = 'not_required'
                            clinicId = $turneroPilotClinicId
                            catalogMatch = $turneroPilotCatalogMatch
                            verifyRequired = $turneroPilotVerifyRequired
                            recoveryTargets = @()
                            remote = [ordered]@{
                                clinicId = ''
                                profileFingerprint = ''
                                catalogReady = $false
                                ok = $false
                            }
                        }
                    }
                }
            } else {
                Add-MonitorWarning -Message '[WARN] bin/turnero-clinic-profile.js no existe; se omite monitor turneroPilot.'
                $script:turneroPilotSnapshot = [ordered]@{
                    available = $false
                    status = 'missing_script'
                    clinicId = ''
                    catalogMatch = $false
                    verifyRequired = $false
                    recoveryTargets = @()
                    remote = [ordered]@{
                        clinicId = ''
                        profileFingerprint = ''
                        catalogReady = $false
                        ok = $false
                    }
                }
            }

            $githubDeployAlertsSummary = Get-GitHubProductionAlertSummary `
                -Repo $GitHubRepo `
                -ApiBase $GitHubApiBase `
                -TimeoutSec $GitHubAlertsTimeoutSec `
                -IssueLimit $GitHubAlertsIssueLimit `
                -UserAgent 'PielArmoniaMonitor/1.0'
            $githubDeployAlertsFetchOk = $false
            $githubDeployAlertsError = ''
            $githubDeployAlertsRelevantCount = 0
            $githubDeployAlertsTransportCount = 0
            $githubDeployAlertsConnectivityCount = 0
            $githubDeployAlertsRepairGitSyncCount = 0
            $githubDeployAlertsSelfHostedRunnerCount = 0
            $githubDeployAlertsSelfHostedDeployCount = 0
            $githubDeployAlertsHasTransportBlock = $false
            $githubDeployAlertsHasConnectivityBlock = $false
            $githubDeployAlertsHasRepairGitSyncBlock = $false
            $githubDeployAlertsHasSelfHostedRunnerBlock = $false
            $githubDeployAlertsHasSelfHostedDeployBlock = $false
            $githubDeployAlertsIssueNumbersLabel = 'none'
            $githubDeployAlertsIssueRefsLabel = 'none'

            try { $githubDeployAlertsFetchOk = [bool]$githubDeployAlertsSummary.fetchOk } catch { $githubDeployAlertsFetchOk = $false }
            try { $githubDeployAlertsError = [string]$githubDeployAlertsSummary.error } catch { $githubDeployAlertsError = '' }
            try { $githubDeployAlertsRelevantCount = [int]$githubDeployAlertsSummary.relevantCount } catch { $githubDeployAlertsRelevantCount = 0 }
            try { $githubDeployAlertsTransportCount = [int]$githubDeployAlertsSummary.transportCount } catch { $githubDeployAlertsTransportCount = 0 }
            try { $githubDeployAlertsConnectivityCount = [int]$githubDeployAlertsSummary.connectivityCount } catch { $githubDeployAlertsConnectivityCount = 0 }
            try { $githubDeployAlertsRepairGitSyncCount = [int]$githubDeployAlertsSummary.repairGitSyncCount } catch { $githubDeployAlertsRepairGitSyncCount = 0 }
            try { $githubDeployAlertsSelfHostedRunnerCount = [int]$githubDeployAlertsSummary.selfHostedRunnerCount } catch { $githubDeployAlertsSelfHostedRunnerCount = 0 }
            try { $githubDeployAlertsSelfHostedDeployCount = [int]$githubDeployAlertsSummary.selfHostedDeployCount } catch { $githubDeployAlertsSelfHostedDeployCount = 0 }
            try { $githubDeployAlertsTurneroPilotCount = [int]$githubDeployAlertsSummary.turneroPilotCount } catch { $githubDeployAlertsTurneroPilotCount = 0 }
            try { $githubDeployAlertsHasTransportBlock = [bool]$githubDeployAlertsSummary.hasTransportBlock } catch { $githubDeployAlertsHasTransportBlock = $false }
            try { $githubDeployAlertsHasConnectivityBlock = [bool]$githubDeployAlertsSummary.hasConnectivityBlock } catch { $githubDeployAlertsHasConnectivityBlock = $false }
            try { $githubDeployAlertsHasRepairGitSyncBlock = [bool]$githubDeployAlertsSummary.hasRepairGitSyncBlock } catch { $githubDeployAlertsHasRepairGitSyncBlock = $false }
            try { $githubDeployAlertsHasSelfHostedRunnerBlock = [bool]$githubDeployAlertsSummary.hasSelfHostedRunnerBlock } catch { $githubDeployAlertsHasSelfHostedRunnerBlock = $false }
            try { $githubDeployAlertsHasSelfHostedDeployBlock = [bool]$githubDeployAlertsSummary.hasSelfHostedDeployBlock } catch { $githubDeployAlertsHasSelfHostedDeployBlock = $false }
            try { $githubDeployAlertsHasTurneroPilotBlock = [bool]$githubDeployAlertsSummary.hasTurneroPilotBlock } catch { $githubDeployAlertsHasTurneroPilotBlock = $false }
            try { $githubDeployAlertsIssueNumbersLabel = [string]$githubDeployAlertsSummary.issueNumbersLabel } catch { $githubDeployAlertsIssueNumbersLabel = 'none' }
            try { $githubDeployAlertsIssueRefsLabel = [string]$githubDeployAlertsSummary.issueRefsLabel } catch { $githubDeployAlertsIssueRefsLabel = 'none' }

            Write-Host "[INFO] github.deployAlerts fetchOk=$githubDeployAlertsFetchOk repo=$GitHubRepo relevantCount=$githubDeployAlertsRelevantCount transportCount=$githubDeployAlertsTransportCount connectivityCount=$githubDeployAlertsConnectivityCount repairGitSyncCount=$githubDeployAlertsRepairGitSyncCount selfHostedRunnerCount=$githubDeployAlertsSelfHostedRunnerCount selfHostedDeployCount=$githubDeployAlertsSelfHostedDeployCount turneroPilotCount=$githubDeployAlertsTurneroPilotCount turneroPilotRecoveryTargets=$turneroPilotRecoveryTargetsLabel issueNumbers=$githubDeployAlertsIssueNumbersLabel issueRefs=$githubDeployAlertsIssueRefsLabel"

            if (-not $githubDeployAlertsFetchOk) {
                Add-MonitorWarning -Message "[WARN] github.deployAlerts unreachable (repo=$GitHubRepo error=$githubDeployAlertsError)"
            }
            if ($githubDeployAlertsRelevantCount -gt 0) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts open production alerts (count=$githubDeployAlertsRelevantCount issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }
            if ($githubDeployAlertsHasTransportBlock) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts transport blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }
            if ($githubDeployAlertsHasConnectivityBlock) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts deploy connectivity blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }
            if ($githubDeployAlertsHasRepairGitSyncBlock) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts repair git sync blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }
            if ($githubDeployAlertsHasSelfHostedRunnerBlock) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts self-hosted runner blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }
            if ($githubDeployAlertsHasSelfHostedDeployBlock) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts self-hosted deploy blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }
            if ($githubDeployAlertsHasTurneroPilotBlock) {
                Add-MonitorFailure -Message "[FAIL] github.deployAlerts turnero pilot blocked (issueNumbers=$githubDeployAlertsIssueNumbersLabel recoveryTargets=$turneroPilotRecoveryTargetsLabel)" -AllowDegraded:$AllowDegradedPublicSync
            }

            $script:githubDeployAlertsSnapshot = [ordered]@{
                available = $true
                status = if (-not $githubDeployAlertsFetchOk) { 'unreachable' } elseif ($githubDeployAlertsRelevantCount -gt 0) { 'failed' } else { 'ok' }
                repo = $GitHubRepo
                fetchOk = $githubDeployAlertsFetchOk
                error = $githubDeployAlertsError
                relevantCount = $githubDeployAlertsRelevantCount
                transportCount = $githubDeployAlertsTransportCount
                connectivityCount = $githubDeployAlertsConnectivityCount
                repairGitSyncCount = $githubDeployAlertsRepairGitSyncCount
                selfHostedRunnerCount = $githubDeployAlertsSelfHostedRunnerCount
                selfHostedDeployCount = $githubDeployAlertsSelfHostedDeployCount
                turneroPilotCount = $githubDeployAlertsTurneroPilotCount
                issueNumbers = $githubDeployAlertsIssueNumbersLabel
                issueRefs = $githubDeployAlertsIssueRefsLabel
                recoveryTargets = @($turneroPilotRecoveryTargets)
                hasTransportBlock = $githubDeployAlertsHasTransportBlock
                hasConnectivityBlock = $githubDeployAlertsHasConnectivityBlock
                hasRepairGitSyncBlock = $githubDeployAlertsHasRepairGitSyncBlock
                hasSelfHostedRunnerBlock = $githubDeployAlertsHasSelfHostedRunnerBlock
                hasSelfHostedDeployBlock = $githubDeployAlertsHasSelfHostedDeployBlock
                hasTurneroPilotBlock = $githubDeployAlertsHasTurneroPilotBlock
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
                Add-MonitorWarning -Message '[WARN] health.calendarRequired=true; se fuerza validacion strict Google en monitor.'
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
                    Add-MonitorWarning -Message '[WARN] health.checks.telemedicine ausente (modo permisivo)'
                }
                $script:telemedicineSnapshot = [ordered]@{
                    available = $false
                    status = if ($RequireTelemedicineConfigured) { 'failed' } else { 'warning' }
                    configured = $false
                    diagnosticsStatus = ''
                    reviewQueueCount = 0
                    criticalCount = 0
                    warningCount = 0
                    stagedLegacyUploadsCount = 0
                    unlinkedIntakesCount = 0
                    danglingAppointmentLinksCount = 0
                    casePhotosWithoutPrivatePathCount = 0
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

                $script:telemedicineSnapshot = [ordered]@{
                    available = $true
                    status = if (
                        $telemedicineConfigured -and
                        $telemedicineDiagnosticsStatus -ne 'critical' -and
                        $telemedicineCriticalCount -le 0 -and
                        $telemedicineReviewQueueCount -le $MaxTelemedicineReviewQueue -and
                        $telemedicineStagedLegacyCount -le $MaxTelemedicineStagedUploads -and
                        $telemedicineUnlinkedIntakesCount -le $MaxTelemedicineUnlinkedIntakes -and
                        $telemedicineDanglingLinksCount -le 0 -and
                        $telemedicineCasePhotosWithoutPrivatePathCount -le 0
                    ) { 'ok' } else { 'failed' }
                    configured = $telemedicineConfigured
                    diagnosticsStatus = $telemedicineDiagnosticsStatus
                    reviewQueueCount = $telemedicineReviewQueueCount
                    criticalCount = $telemedicineCriticalCount
                    warningCount = $telemedicineWarningCount
                    stagedLegacyUploadsCount = $telemedicineStagedLegacyCount
                    unlinkedIntakesCount = $telemedicineUnlinkedIntakesCount
                    danglingAppointmentLinksCount = $telemedicineDanglingLinksCount
                    casePhotosWithoutPrivatePathCount = $telemedicineCasePhotosWithoutPrivatePathCount
                }
            }

            $script:healthSnapshot = [ordered]@{
                available = $true
                status = [string]$health.status
                storageReady = [bool]$health.storageReady
                dataDirSource = [string]$health.dataDirSource
                calendarSource = $calendarSource
                calendarMode = $calendarMode
                calendarReachable = $calendarReachable
                calendarConfigured = $calendarConfigured
                calendarRequired = $calendarRequired
                calendarLastErrorReason = $calendarLastErrorReason
                calendarLastErrorAt = $calendarLastErrorAt
                storage = $script:healthSnapshot.storage
                auth = $script:healthSnapshot.auth
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
                Add-MonitorWarning -Message '[WARN] service-priorities sin señales de funnel; usando catalog_only temporalmente.'
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

            $script:servicePrioritiesSnapshot = [ordered]@{
                available = $true
                status = if (
                    -not [string]::IsNullOrWhiteSpace($catalogVersion) -and
                    $serviceCountMeta -ge $MinServicePrioritiesServices -and
                    $servicesCount -ge $MinServicePrioritiesServices -and
                    $categoriesCount -ge $MinServicePrioritiesCategories -and
                    $featuredCount -ge $MinServicePrioritiesFeatured
                ) { 'ok' } else { 'failed' }
                source = $source
                catalogVersion = $catalogVersion
                serviceCountMeta = $serviceCountMeta
                servicesCount = $servicesCount
                categoriesCount = $categoriesCount
                featuredCount = $featuredCount
            }
        }
    }
}

$adminAuthResult = $results | Where-Object { $_.Name -eq 'admin-auth-status' } | Select-Object -First 1
if ($null -eq $adminAuthResult) {
    $failures += '[FAIL] admin-auth-status: endpoint no evaluado'
} elseif ($adminAuthResult.StatusCode -ne 200) {
    $failures += "[FAIL] admin-auth-status: status=$($adminAuthResult.StatusCode) error=$($adminAuthResult.Error)"
} else {
    $adminAuthPayload = Parse-JsonBody -Body $adminAuthResult.Body -Depth 10
    if ($null -eq $adminAuthPayload) {
        $failures += '[FAIL] admin-auth-status: JSON invalido'
    } else {
        $adminAuthMode = ''
        $adminAuthTransport = ''
        $adminAuthStatus = ''
        try { $adminAuthMode = [string]$adminAuthPayload.mode } catch {}
        try { $adminAuthTransport = [string]$adminAuthPayload.transport } catch {}
        try { $adminAuthStatus = [string]$adminAuthPayload.status } catch {}
        Write-Host "[INFO] admin-auth-status mode=$adminAuthMode transport=$adminAuthTransport status=$adminAuthStatus"

        if ($adminAuthMode -ne 'google_oauth') {
            $failures += "[FAIL] admin-auth-status mode inesperado ($adminAuthMode)"
        }
        if ([string]::IsNullOrWhiteSpace($adminAuthTransport)) {
            $failures += '[FAIL] admin-auth-status transport ausente'
        } elseif ($adminAuthTransport -ne 'web_broker') {
            $failures += "[FAIL] admin-auth-status transport inesperado ($adminAuthTransport)"
        }
        if ($adminAuthStatus -eq 'transport_misconfigured') {
            $failures += '[FAIL] admin-auth-status reporta transport_misconfigured'
        }
    }
}

Write-Host ''
$script:monitorStatus = if ($failures.Count -gt 0) { 'failed' } elseif ($warnings.Count -gt 0) { 'warning' } else { 'ok' }
try {
    Write-MonitorReport
} catch {
    $fallbackMessage = "[FAIL] prod-monitor report write exception $($_.Exception.Message)"
    if (-not ($failures -contains $fallbackMessage)) {
        $failures += $fallbackMessage
    }
    $script:monitorStatus = 'failed'
    try {
        $effectiveReportPath = $defaultReportPath
        Write-MonitorReport
    } catch {
        Add-MonitorWarning -Message "[WARN] no se pudo persistir prod-monitor report en ruta fallback: $($_.Exception.Message)"
    }
}
if ($failures.Count -gt 0) {
    Write-Host 'Resultado: FALLIDO' -ForegroundColor Red
    foreach ($f in $failures) {
        Write-Host $f -ForegroundColor Red
    }
    exit 1
}

Write-Host 'Resultado: OK' -ForegroundColor Green
exit 0
