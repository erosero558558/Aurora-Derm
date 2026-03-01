param(
    [string]$Domain = 'https://pielarmonia.com',
    [ValidateSet('internal', 'canary', 'general', 'rollback')]
    [string]$Stage = 'canary',
    [switch]$SkipRuntimeSmoke,
    [switch]$AllowFeatureApiFailure,
    [switch]$AllowMissingAdminFlag,
    [string]$ReportPath = 'verification/last-admin-ui-rollout-gate.json'
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$failures = 0
$timestampUtc = (Get-Date).ToUniversalTime().ToString('o')
$allowFeatureApiFailureEffective = [bool]$AllowFeatureApiFailure -or $Stage -eq 'internal'
$allowMissingAdminFlagEffective = [bool]$AllowMissingAdminFlag -or $Stage -eq 'internal'

$report = [ordered]@{
    ok = $false
    timestamp_utc = $timestampUtc
    domain = $base
    stage = $Stage
    options = [ordered]@{
        skip_runtime_smoke = [bool]$SkipRuntimeSmoke
        allow_feature_api_failure = [bool]$AllowFeatureApiFailure
        allow_missing_admin_flag = [bool]$AllowMissingAdminFlag
        allow_feature_api_failure_effective = [bool]$allowFeatureApiFailureEffective
        allow_missing_admin_flag_effective = [bool]$allowMissingAdminFlagEffective
    }
    features = [ordered]@{
        url = "$base/api.php?resource=features"
        request_ok = $false
        http_status = 0
        response_ok = $false
        has_admin_sony_ui = $false
        admin_sony_ui = $null
        expected_admin_sony_ui = $null
        stage_expectation_match = $null
        warning = $null
        error = $null
    }
    url_checks = @()
    csp = [ordered]@{
        checked = $false
        meta_present = $false
    }
    runtime_smoke = [ordered]@{
        executed = $false
        ok = $null
    }
    failures = 0
}

function Invoke-JsonGet {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'application/json'
            'User-Agent' = 'AdminUiRolloutGate/1.0'
        }

        $payload = $null
        try {
            $payload = $response.Content | ConvertFrom-Json
        } catch {
            $payload = $null
        }

        return [PSCustomObject]@{
            Ok = $true
            Status = [int]$response.StatusCode
            Json = $payload
            Raw = [string]$response.Content
            Error = ''
        }
    } catch {
        $status = 0
        $raw = ''
        $response = $_.Exception.Response
        if ($null -ne $response) {
            try { $status = [int]$response.StatusCode } catch { $status = 0 }
            try {
                $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
                $raw = $reader.ReadToEnd()
                $reader.Close()
            } catch {}
        }

        return [PSCustomObject]@{
            Ok = $false
            Status = $status
            Json = $null
            Raw = $raw
            Error = $_.Exception.Message
        }
    }
}

function Invoke-HttpCheck {
    param(
        [string]$Name,
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'text/html,application/json;q=0.9,*/*;q=0.8'
            'User-Agent' = 'AdminUiRolloutGate/1.0'
        }
        $status = [int]$response.StatusCode
        if ($status -ge 200 -and $status -lt 400) {
            Write-Host "[OK]  $Name -> HTTP $status"
            return [PSCustomObject]@{
                Ok = $true
                Status = $status
                Headers = $response.Headers
                Body = [string]$response.Content
            }
        }
        Write-Host "[FAIL] $Name -> HTTP $status"
        return [PSCustomObject]@{
            Ok = $false
            Status = $status
            Headers = $response.Headers
            Body = [string]$response.Content
        }
    } catch {
        Write-Host "[FAIL] $Name -> $($_.Exception.Message)"
        return [PSCustomObject]@{
            Ok = $false
            Status = 0
            Headers = @{}
            Body = ''
        }
    }
}

function Get-ExpectedFeatureValueByStage {
    param(
        [string]$CurrentStage
    )

    if ($CurrentStage -eq 'canary' -or $CurrentStage -eq 'general') {
        return $true
    }
    if ($CurrentStage -eq 'rollback') {
        return $false
    }
    return $null
}

Write-Host "== Gate Admin UI Rollout =="
Write-Host "Dominio: $base"
Write-Host "Stage: $Stage"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

$featuresUrl = "$base/api.php?resource=features"
$featuresResult = Invoke-JsonGet -Url $featuresUrl
$featureValue = $null

if ($featuresResult.Ok -and $null -ne $featuresResult.Json -and $featuresResult.Json.ok -eq $true) {
    $report.features.request_ok = $true
    $report.features.http_status = [int]$featuresResult.Status
    $report.features.response_ok = $true
    if ($null -eq $featuresResult.Json.data -or $null -eq $featuresResult.Json.data.admin_sony_ui) {
        if ($allowMissingAdminFlagEffective) {
            Write-Host "[WARN] Features API no contiene data.admin_sony_ui (permitido por politica efectiva de stage/flag)."
            $report.features.warning = 'missing_admin_sony_ui_allowed'
        } else {
            Write-Host "[FAIL] Features API no contiene data.admin_sony_ui"
            $failures += 1
            $report.features.error = 'missing_admin_sony_ui'
        }
    } else {
        $featureValue = [bool]$featuresResult.Json.data.admin_sony_ui
        $featureText = if ($featureValue) { 'true' } else { 'false' }
        $report.features.has_admin_sony_ui = $true
        $report.features.admin_sony_ui = [bool]$featureValue
        Write-Host "[OK]  Features API -> HTTP $($featuresResult.Status)"
        Write-Host "[INFO] admin_sony_ui actual: $featureText"
    }
} else {
    $report.features.request_ok = [bool]$featuresResult.Ok
    $report.features.http_status = [int]$featuresResult.Status
    if ($allowFeatureApiFailureEffective) {
        Write-Host "[WARN] Features API no disponible (HTTP $($featuresResult.Status)); se continua por politica efectiva de stage/flag."
        $report.features.warning = 'features_api_failure_allowed'
    } else {
        Write-Host "[FAIL] Features API no disponible (HTTP $($featuresResult.Status))"
        if ($featuresResult.Error) {
            Write-Host "       $($featuresResult.Error)"
        }
        $failures += 1
        $report.features.error = 'features_api_failure'
    }
}

$expectedFeatureValue = Get-ExpectedFeatureValueByStage -CurrentStage $Stage
$report.features.expected_admin_sony_ui = $expectedFeatureValue
if ($null -ne $expectedFeatureValue -and $null -ne $featureValue) {
    if ([bool]$featureValue -ne [bool]$expectedFeatureValue) {
        $expectedText = if ($expectedFeatureValue) { 'true' } else { 'false' }
        $actualText = if ($featureValue) { 'true' } else { 'false' }
        Write-Host "[FAIL] Stage '$Stage' requiere admin_sony_ui=$expectedText, actual=$actualText"
        $failures += 1
        $report.features.stage_expectation_match = $false
    } else {
        Write-Host "[OK]  Stage '$Stage' coincide con admin_sony_ui esperado"
        $report.features.stage_expectation_match = $true
    }
} elseif ($Stage -eq 'internal') {
    Write-Host "[INFO] Stage internal: no se fuerza valor de admin_sony_ui"
    $report.features.stage_expectation_match = $null
}

Write-Host ""
$urlChecks = @(
    @{ Name = 'Admin base'; Url = "$base/admin.html" },
    @{ Name = 'Admin query legacy'; Url = "$base/admin.html?admin_ui=legacy" },
    @{ Name = 'Admin query sony_v2'; Url = "$base/admin.html?admin_ui=sony_v2" },
    @{ Name = 'Admin contingency reset'; Url = "$base/admin.html?admin_ui_reset=1" }
)

$adminBaseResult = $null
foreach ($check in $urlChecks) {
    $result = Invoke-HttpCheck -Name $check.Name -Url $check.Url
    $report.url_checks += [ordered]@{
        name = [string]$check.Name
        url = [string]$check.Url
        ok = [bool]$result.Ok
        http_status = [int]$result.Status
    }
    if (-not $result.Ok) {
        $failures += 1
    }
    if ($check.Name -eq 'Admin base') {
        $adminBaseResult = $result
    }
}

if ($null -ne $adminBaseResult -and $adminBaseResult.Ok) {
    $report.csp.checked = $true
    $cspMetaFound = [regex]::IsMatch(
        [string]$adminBaseResult.Body,
        '<meta[^>]+http-equiv\s*=\s*["'']Content-Security-Policy["''][^>]*>',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if ($cspMetaFound) {
        Write-Host "[OK]  Admin base incluye meta CSP"
        $report.csp.meta_present = $true
    } else {
        Write-Host "[FAIL] Admin base no incluye meta CSP"
        $failures += 1
        $report.csp.meta_present = $false
    }
}

if (-not $SkipRuntimeSmoke) {
    Write-Host ""
    Write-Host "[SMOKE] Ejecutando runtime smoke Playwright admin-ui..."
    $report.runtime_smoke.executed = $true

    $previousBaseUrl = $env:TEST_BASE_URL
    $env:TEST_BASE_URL = $base
    try {
        npx playwright test tests/admin-ui-runtime-smoke.spec.js --workers=1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[FAIL] Runtime smoke Playwright fallo."
            $failures += 1
            $report.runtime_smoke.ok = $false
        } else {
            Write-Host "[OK]  Runtime smoke Playwright en verde."
            $report.runtime_smoke.ok = $true
        }
    } finally {
        if ($null -eq $previousBaseUrl) {
            Remove-Item Env:TEST_BASE_URL -ErrorAction SilentlyContinue
        } else {
            $env:TEST_BASE_URL = $previousBaseUrl
        }
    }
} else {
    Write-Host ""
    Write-Host "[WARN] Runtime smoke Playwright omitido por bandera -SkipRuntimeSmoke."
    $report.runtime_smoke.executed = $false
    $report.runtime_smoke.ok = $null
}

$report.failures = [int]$failures
$report.ok = ($failures -eq 0)

if (-not [string]::IsNullOrWhiteSpace($ReportPath)) {
    try {
        $reportDirectory = Split-Path -Parent $ReportPath
        if (-not [string]::IsNullOrWhiteSpace($reportDirectory)) {
            New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
        }
        $report | ConvertTo-Json -Depth 12 | Out-File -FilePath $ReportPath -Encoding utf8
        Write-Host "[INFO] Reporte JSON guardado en: $ReportPath"
    } catch {
        Write-Host "[WARN] No se pudo guardar reporte JSON en '$ReportPath': $($_.Exception.Message)"
    }
}

Write-Host ""
if ($failures -gt 0) {
    Write-Host "Gate Admin UI Rollout: FALLIDO ($failures fallo(s))." -ForegroundColor Red
    exit 1
}

Write-Host "Gate Admin UI Rollout: OK." -ForegroundColor Green
exit 0
