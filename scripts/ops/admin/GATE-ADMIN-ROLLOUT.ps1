param(
    [string]$Domain = 'https://pielarmonia.com',
    [ValidateSet('stable')]
    [string]$Stage = 'stable',
    [switch]$SkipRuntimeSmoke,
    [string]$ReportPath = 'verification/last-admin-ui-rollout-gate.json'
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$failures = 0
$timestampUtc = (Get-Date).ToUniversalTime().ToString('o')

$report = [ordered]@{
    ok = $false
    timestamp_utc = $timestampUtc
    domain = $base
    stage = $Stage
    page = [ordered]@{
        url = "$base/admin.html"
        ok = $false
        http_status = 0
    }
    assets = [ordered]@{
        has_admin_v3_css = $false
        uses_canonical_runtime = $false
        references_runtime_bridge = $false
        references_legacy_styles = $false
    }
    csp = [ordered]@{
        checked = $false
        meta_present = $false
        self_only_script = $false
        self_only_style = $false
        self_only_font = $false
    }
    runtime_smoke = [ordered]@{
        executed = $false
        ok = $null
        base_url = ''
        suites = @()
    }
    failures = 0
}

function Invoke-HttpCheck {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'text/html,application/json;q=0.9,*/*;q=0.8'
            'User-Agent' = 'AdminUiRolloutGate/2.0'
        }

        return [PSCustomObject]@{
            Ok = $true
            Status = [int]$response.StatusCode
            Headers = $response.Headers
            Body = [string]$response.Content
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
            Headers = @{}
            Body = $raw
            Error = $_.Exception.Message
        }
    }
}

function Invoke-PlaywrightSmokeSuite {
    param(
        [string]$Name,
        [string[]]$Specs,
        [string]$BaseUrl
    )

    $specList = @($Specs | Where-Object {
        -not [string]::IsNullOrWhiteSpace([string]$_)
    })

    if ($specList.Count -eq 0) {
        return [PSCustomObject]@{
            name = $Name
            ok = $true
            exit_code = 0
            specs = @()
        }
    }

    Write-Host "[SMOKE] $Name -> $($specList -join ', ') @ $BaseUrl"

    $args = @('playwright', 'test') + $specList + @('--workers=1')
    $hadBaseUrl = Test-Path Env:TEST_BASE_URL
    $previousBaseUrl = $env:TEST_BASE_URL
    $hadReuseExistingServer = Test-Path Env:TEST_REUSE_EXISTING_SERVER
    $previousReuseExistingServer = $env:TEST_REUSE_EXISTING_SERVER

    try {
        $env:TEST_BASE_URL = $BaseUrl
        $env:TEST_REUSE_EXISTING_SERVER = '0'
        & npx @args
        $exitCode = $LASTEXITCODE
    } finally {
        if ($hadBaseUrl) {
            $env:TEST_BASE_URL = $previousBaseUrl
        } else {
            Remove-Item Env:TEST_BASE_URL -ErrorAction SilentlyContinue
        }

        if ($hadReuseExistingServer) {
            $env:TEST_REUSE_EXISTING_SERVER = $previousReuseExistingServer
        } else {
            Remove-Item Env:TEST_REUSE_EXISTING_SERVER -ErrorAction SilentlyContinue
        }
    }
    $ok = ($exitCode -eq 0)

    if ($ok) {
        Write-Host "[OK]  $Name en verde."
    } else {
        Write-Host "[FAIL] $Name fallo."
    }

    return [PSCustomObject]@{
        name = $Name
        ok = $ok
        exit_code = $exitCode
        specs = $specList
    }
}

Write-Host "== Gate Admin UI Rollout =="
Write-Host "Dominio: $base"
Write-Host "Stage: $Stage"

$pageResult = Invoke-HttpCheck -Url $report.page.url
$report.page.ok = [bool]$pageResult.Ok
$report.page.http_status = [int]$pageResult.Status

if (-not $pageResult.Ok) {
    Write-Host "[FAIL] admin.html -> HTTP $($pageResult.Status)"
    $failures += 1
} else {
    Write-Host "[OK]  admin.html -> HTTP $($pageResult.Status)"
}

$rawHtml = [string]$pageResult.Body
$report.assets.has_admin_v3_css = $rawHtml.Contains('admin-v3.css')
$report.assets.uses_canonical_runtime = $rawHtml.Contains('src="admin.js')
$report.assets.references_runtime_bridge = $rawHtml.Contains('js/admin-runtime.js')
$report.assets.references_legacy_styles = (
    $rawHtml.Contains('styles.min.css') -or
    $rawHtml.Contains('admin.min.css') -or
    $rawHtml.Contains('admin.css') -or
    $rawHtml.Contains('admin-v2.css')
)

if ($report.assets.has_admin_v3_css) {
    Write-Host "[OK]  shell referencia admin-v3.css"
} else {
    Write-Host "[FAIL] shell no referencia admin-v3.css"
    $failures += 1
}

if ($report.assets.uses_canonical_runtime) {
    Write-Host "[OK]  shell referencia admin.js canonico"
} else {
    Write-Host "[FAIL] shell no referencia admin.js canonico"
    $failures += 1
}

if (-not $report.assets.references_runtime_bridge) {
    Write-Host "[OK]  shell no referencia runtime bridge heredado"
} else {
    Write-Host "[FAIL] shell mantiene referencia a js/admin-runtime.js"
    $failures += 1
}

if (-not $report.assets.references_legacy_styles) {
    Write-Host "[OK]  shell sin referencias CSS legacy"
} else {
    Write-Host "[FAIL] shell mantiene referencias CSS legacy"
    $failures += 1
}

$report.csp.checked = $true
$report.csp.meta_present = $rawHtml.Contains('Content-Security-Policy')
$report.csp.self_only_script = $rawHtml.Contains("script-src 'self'")
$report.csp.self_only_style = $rawHtml.Contains("style-src 'self'")
$report.csp.self_only_font = $rawHtml.Contains("font-src 'self'")

if ($report.csp.meta_present -and $report.csp.self_only_script -and $report.csp.self_only_style -and $report.csp.self_only_font) {
    Write-Host "[OK]  CSP admin endurecida"
} else {
    Write-Host "[FAIL] CSP admin incompleta"
    $failures += 1
}

if (-not $SkipRuntimeSmoke) {
    $report.runtime_smoke.executed = $true
    $report.runtime_smoke.base_url = $base

    $runtimeSuites = @(
        @{
            Name = 'admin-ui-runtime'
            Specs = @('tests/admin-ui-runtime-smoke.spec.js')
        },
        @{
            Name = 'admin-v3-runtime'
            Specs = @('tests/admin-v3-canary-runtime.spec.js')
        }
    )

    $runtimeOk = $true
    foreach ($suite in $runtimeSuites) {
        $suiteResult = Invoke-PlaywrightSmokeSuite -Name $suite.Name -Specs $suite.Specs -BaseUrl $base
        $report.runtime_smoke.suites += [ordered]@{
            name = $suiteResult.name
            ok = [bool]$suiteResult.ok
            exit_code = [int]$suiteResult.exit_code
            specs = @($suiteResult.specs)
        }

        if (-not $suiteResult.ok) {
            $runtimeOk = $false
            $failures += 1
        }
    }

    $report.runtime_smoke.ok = [bool]$runtimeOk
} else {
    Write-Host "[INFO] Runtime smoke omitido por flag."
}

$report.failures = [int]$failures
$report.ok = ($failures -eq 0)

try {
    $directory = Split-Path -Parent $ReportPath
    if ($directory) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $report | ConvertTo-Json -Depth 6 | Set-Content -Path $ReportPath -Encoding UTF8
    Write-Host "[INFO] Reporte escrito en $ReportPath"
} catch {
    Write-Host "[WARN] No se pudo escribir reporte: $($_.Exception.Message)"
}

if ($report.ok) {
    Write-Host "[OK]  Gate admin rollout en verde."
    exit 0
}

Write-Host "[FAIL] Gate admin rollout fallo con $failures incidencia(s)."
exit 1
