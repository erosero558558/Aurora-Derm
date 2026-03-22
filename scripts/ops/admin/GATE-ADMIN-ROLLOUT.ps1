param(
    [string]$Domain = 'https://pielarmonia.com',
    [ValidateSet('stable', 'internal', 'canary', 'general', 'rollback')]
    [string]$Stage = 'stable',
    [Alias('RequireOpenClawAuth')]
    [switch]$RequireOperatorAuth,
    [switch]$AllowFeatureApiFailure,
    [switch]$AllowMissingAdminFlag,
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
        error = ''
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
    operator_auth = [ordered]@{
        checked = $false
        url = "$base/api.php?resource=operator-auth-status"
        facade_url = "$base/admin-auth.php?action=status"
        source = ''
        ok = $null
        contract_valid = $false
        authenticated = $false
        http_status = 0
        error = ''
        facade_http_status = 0
        facade_error = ''
        mode = ''
        transport = ''
        status = ''
        configured = $false
        recommended_mode = ''
        helper_base_url = ''
        bridge_token_configured = $false
        bridge_secret_configured = $false
        allowlist_configured = $false
        broker_authorize_url_configured = $false
        broker_token_url_configured = $false
        broker_userinfo_url_configured = $false
        broker_client_id_configured = $false
        broker_trust_configured = $false
        broker_issuer_pinned = $false
        broker_audience_pinned = $false
        broker_jwks_configured = $false
        broker_email_verified_required = $true
        missing = @()
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

function ConvertFrom-JsonOrNull {
    param(
        [string]$Raw
    )

    if ([string]::IsNullOrWhiteSpace($Raw)) {
        return $null
    }

    try {
        return $Raw | ConvertFrom-Json
    } catch {
        return $null
    }
}

function Get-ObjectPropertyValue {
    param(
        $Object,
        [string]$Name,
        $Default = $null
    )

    if ($null -eq $Object) {
        return $Default
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $Default
    }

    return $property.Value
}

function Test-OperatorAuthContractPayload {
    param(
        $Payload
    )

    if ($null -eq $Payload) {
        return $false
    }

    $mode = Get-ObjectPropertyValue -Object $Payload -Name 'mode' -Default $null
    $status = Get-ObjectPropertyValue -Object $Payload -Name 'status' -Default $null
    $transport = Get-ObjectPropertyValue -Object $Payload -Name 'transport' -Default $null

    return ($null -ne $mode) -and ($null -ne $status) -and ($null -ne $transport)
}

function Set-OperatorAuthReportFromPayload {
    param(
        $Report,
        $Payload,
        [string]$Source
    )

    $configuration = Get-ObjectPropertyValue -Object $Payload -Name 'configuration'

    $Report['source'] = $Source
    $Report['ok'] = [bool](Get-ObjectPropertyValue -Object $Payload -Name 'ok' -Default $true)
    $Report['contract_valid'] = [bool](Test-OperatorAuthContractPayload -Payload $Payload)
    $Report['authenticated'] = [bool](Get-ObjectPropertyValue -Object $Payload -Name 'authenticated' -Default $false)
    $Report['mode'] = [string](Get-ObjectPropertyValue -Object $Payload -Name 'mode' -Default '')
    $Report['transport'] = [string](Get-ObjectPropertyValue -Object $Payload -Name 'transport' -Default '')
    $Report['status'] = [string](Get-ObjectPropertyValue -Object $Payload -Name 'status' -Default '')
    $Report['configured'] = [bool](Get-ObjectPropertyValue -Object $Payload -Name 'configured' -Default $false)
    $Report['recommended_mode'] = [string](Get-ObjectPropertyValue -Object $Payload -Name 'recommendedMode' -Default '')
    $Report['helper_base_url'] = [string](Get-ObjectPropertyValue -Object $configuration -Name 'helperBaseUrl' -Default '')
    $Report['bridge_token_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'bridgeTokenConfigured' -Default $false)
    $Report['bridge_secret_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'bridgeSecretConfigured' -Default $false)
    $Report['allowlist_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'allowlistConfigured' -Default $false)
    $Report['broker_authorize_url_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerAuthorizeUrlConfigured' -Default $false)
    $Report['broker_token_url_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerTokenUrlConfigured' -Default $false)
    $Report['broker_userinfo_url_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerUserinfoUrlConfigured' -Default $false)
    $Report['broker_client_id_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerClientIdConfigured' -Default $false)
    $Report['broker_trust_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerTrustConfigured' -Default $false)
    $Report['broker_issuer_pinned'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerIssuerPinned' -Default $false)
    $Report['broker_audience_pinned'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerAudiencePinned' -Default $false)
    $Report['broker_jwks_configured'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerJwksConfigured' -Default $false)
    $Report['broker_email_verified_required'] = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerEmailVerifiedRequired' -Default $true)
    $Report['missing'] = @(Get-ObjectPropertyValue -Object $configuration -Name 'missing' -Default @())
}

Write-Host "== Gate Admin UI Rollout =="
Write-Host "Dominio: $base"
Write-Host "Stage: $Stage"

$pageResult = Invoke-HttpCheck -Url $report.page.url
$report.page.ok = [bool]$pageResult.Ok
$report.page.http_status = [int]$pageResult.Status
$report.page.error = [string]$pageResult.Error

if (-not $pageResult.Ok) {
    Write-Host "[FAIL] admin.html -> HTTP $($pageResult.Status) ($($pageResult.Error))"
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

$report.operator_auth.checked = $true
$operatorAuthResult = Invoke-HttpCheck -Url $report.operator_auth.url
$report.operator_auth.http_status = [int]$operatorAuthResult.Status
$report.operator_auth.error = [string]$operatorAuthResult.Error
$operatorAuthPayload = $null
$operatorAuthContractValid = $false

if ($operatorAuthResult.Ok) {
    $operatorAuthPayload = ConvertFrom-JsonOrNull -Raw ([string]$operatorAuthResult.Body)
    if ($null -ne $operatorAuthPayload) {
        Set-OperatorAuthReportFromPayload -Report $report.operator_auth -Payload $operatorAuthPayload -Source 'operator-auth-status'
        $operatorAuthContractValid = [bool]$report.operator_auth.contract_valid

        if ($operatorAuthContractValid) {
            Write-Host "[INFO] operator_auth source=$($report.operator_auth.source) mode=$($report.operator_auth.mode) status=$($report.operator_auth.status) configured=$($report.operator_auth.configured)"
        } else {
            Write-Host "[WARN] operator_auth-status respondio, pero no expone el contrato auth canonico esperado."
        }
    } else {
        $report.operator_auth.ok = $false
        Write-Host "[WARN] operator_auth-status no devolvio JSON interpretable."
    }
} else {
    $report.operator_auth.ok = $false
    Write-Host "[WARN] operator_auth-status no respondio correctamente (HTTP $($operatorAuthResult.Status)): $($operatorAuthResult.Error)"
}

if (-not $operatorAuthContractValid) {
    $facadeResult = Invoke-HttpCheck -Url $report.operator_auth.facade_url
    $report.operator_auth.facade_http_status = [int]$facadeResult.Status
    $report.operator_auth.facade_error = [string]$facadeResult.Error

    if ($facadeResult.Ok) {
        $facadePayload = ConvertFrom-JsonOrNull -Raw ([string]$facadeResult.Body)
        if ($null -ne $facadePayload) {
            $facadeHasContract = Test-OperatorAuthContractPayload -Payload $facadePayload
            if ($facadeHasContract) {
                Set-OperatorAuthReportFromPayload -Report $report.operator_auth -Payload $facadePayload -Source 'admin-auth-facade'
                Write-Host "[INFO] operator_auth source=$($report.operator_auth.source) mode=$($report.operator_auth.mode) status=$($report.operator_auth.status) configured=$($report.operator_auth.configured)"
            } else {
                Set-OperatorAuthReportFromPayload -Report $report.operator_auth -Payload $facadePayload -Source 'admin-auth-facade-legacy'
                Write-Host "[WARN] admin-auth facade respondio, pero sigue en contrato legacy sin mode/status auth."
            }
        } else {
            Write-Host "[WARN] admin-auth facade no devolvio JSON interpretable."
        }
    } else {
        Write-Host "[WARN] admin-auth facade no respondio correctamente (HTTP $($facadeResult.Status)): $($facadeResult.Error)"
    }
}

if ($RequireOperatorAuth) {
    $brokerTrustReady = (
        $report.operator_auth.transport -ne 'web_broker' -or (
            [bool]$report.operator_auth.broker_trust_configured -and
            [bool]$report.operator_auth.broker_issuer_pinned -and
            [bool]$report.operator_auth.broker_audience_pinned -and
            [bool]$report.operator_auth.broker_jwks_configured -and
            [bool]$report.operator_auth.broker_email_verified_required
        )
    )
    if (
        $report.operator_auth.contract_valid -and
        $report.operator_auth.mode -eq 'google_oauth' -and
        $report.operator_auth.recommended_mode -eq 'google_oauth' -and
        $report.operator_auth.transport -eq 'web_broker' -and
        $report.operator_auth.configured -and
        $brokerTrustReady
    ) {
        Write-Host "[OK]  operator auth Google web_broker configurado"
    } else {
        if (-not $report.operator_auth.contract_valid) {
            Write-Host "[WARN] operator auth sin contrato auth valido. source=$($report.operator_auth.source)"
        }
        if ($report.operator_auth.mode -and $report.operator_auth.mode -ne 'google_oauth') {
            Write-Host "[WARN] operator auth expone mode=$($report.operator_auth.mode); esperado google_oauth."
        }
        if ($report.operator_auth.recommended_mode -and $report.operator_auth.recommended_mode -ne 'google_oauth') {
            Write-Host "[WARN] operator auth expone recommended_mode=$($report.operator_auth.recommended_mode); esperado google_oauth."
        }
        if ($report.operator_auth.transport -and $report.operator_auth.transport -ne 'web_broker') {
            Write-Host "[WARN] operator auth expone transport=$($report.operator_auth.transport); esperado web_broker."
        }
        if ($report.operator_auth.transport -eq 'web_broker' -and -not $brokerTrustReady) {
            Write-Host "[WARN] operator auth web_broker sin trust OIDC completo (JWKS/issuer/audience/email_verified)."
        }
        Write-Host "[FAIL] operator auth Google no esta configurado para este rollout"
        $failures += 1
    }
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
        },
        @{
            Name = 'admin-auth'
            Specs = @('tests/admin-openclaw-login.spec.js')
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
