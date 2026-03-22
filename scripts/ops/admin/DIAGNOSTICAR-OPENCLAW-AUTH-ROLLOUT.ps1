param(
    [string]$Domain = 'https://pielarmonia.com',
    [switch]$Json,
    [switch]$AllowNotReady,
    [string]$ReportPath = 'verification/last-admin-openclaw-auth-diagnostic.json'
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$timestampUtc = (Get-Date).ToUniversalTime().ToString('o')

$report = [ordered]@{
    ok = $false
    checked_at_utc = $timestampUtc
    domain = $base
    operator_auth_status = [ordered]@{
        url = "$base/api.php?resource=operator-auth-status"
        reachable = $false
        json_valid = $false
        contract_valid = $false
        http_status = 0
        error = ''
        raw_body = ''
        payload_error = ''
        ok = $false
        authenticated = $false
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
    admin_auth_facade = [ordered]@{
        url = "$base/admin-auth.php?action=status"
        reachable = $false
        json_valid = $false
        contract_valid = $false
        http_status = 0
        error = ''
        raw_body = ''
        payload_error = ''
        ok = $false
        authenticated = $false
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
    resolved = [ordered]@{
        source = ''
        contract_valid = $false
        ok = $false
        authenticated = $false
        mode = ''
        transport = ''
        status = ''
        configured = $false
        recommended_mode = ''
        helper_base_url = ''
        broker_trust_configured = $false
        broker_issuer_pinned = $false
        broker_audience_pinned = $false
        broker_jwks_configured = $false
        broker_email_verified_required = $true
        missing = @()
    }
    diagnosis = ''
    next_action = ''
    warnings = @()
}

function Invoke-AuthSnapshotRequest {
    param(
        [string]$Url
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 20 -UseBasicParsing -Headers @{
            'Accept' = 'application/json,text/html;q=0.8,*/*;q=0.5'
            'User-Agent' = 'OpenClawAuthRolloutDiagnostic/1.0'
            'Cache-Control' = 'no-cache'
        }

        return [PSCustomObject]@{
            Reachable = $true
            Status = [int]$response.StatusCode
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
            Reachable = $false
            Status = $status
            Body = $raw
            Error = $_.Exception.Message
        }
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

    return ($null -ne $mode) -and ($null -ne $status)
}

function Normalize-OperatorAuthSnapshot {
    param(
        [string]$Url,
        [string]$Name
    )

    $result = Invoke-AuthSnapshotRequest -Url $Url
    $payload = ConvertFrom-JsonOrNull -Raw ([string]$result.Body)
    $configuration = Get-ObjectPropertyValue -Object $payload -Name 'configuration'

    $snapshot = [ordered]@{
        url = $Url
        name = $Name
        reachable = [bool]$result.Reachable
        json_valid = ($null -ne $payload)
        contract_valid = [bool](Test-OperatorAuthContractPayload -Payload $payload)
        http_status = [int]$result.Status
        error = [string]$result.Error
        raw_body = [string]$result.Body
        payload_error = [string](Get-ObjectPropertyValue -Object $payload -Name 'error' -Default '')
        ok = [bool](Get-ObjectPropertyValue -Object $payload -Name 'ok' -Default $false)
        authenticated = [bool](Get-ObjectPropertyValue -Object $payload -Name 'authenticated' -Default $false)
        mode = [string](Get-ObjectPropertyValue -Object $payload -Name 'mode' -Default '')
        transport = [string](Get-ObjectPropertyValue -Object $payload -Name 'transport' -Default '')
        status = [string](Get-ObjectPropertyValue -Object $payload -Name 'status' -Default '')
        configured = [bool](Get-ObjectPropertyValue -Object $payload -Name 'configured' -Default $false)
        recommended_mode = [string](Get-ObjectPropertyValue -Object $payload -Name 'recommendedMode' -Default '')
        helper_base_url = [string](Get-ObjectPropertyValue -Object $configuration -Name 'helperBaseUrl' -Default '')
        bridge_token_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'bridgeTokenConfigured' -Default $false)
        bridge_secret_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'bridgeSecretConfigured' -Default $false)
        allowlist_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'allowlistConfigured' -Default $false)
        broker_authorize_url_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerAuthorizeUrlConfigured' -Default $false)
        broker_token_url_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerTokenUrlConfigured' -Default $false)
        broker_userinfo_url_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerUserinfoUrlConfigured' -Default $false)
        broker_client_id_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerClientIdConfigured' -Default $false)
        broker_trust_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerTrustConfigured' -Default $false)
        broker_issuer_pinned = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerIssuerPinned' -Default $false)
        broker_audience_pinned = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerAudiencePinned' -Default $false)
        broker_jwks_configured = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerJwksConfigured' -Default $false)
        broker_email_verified_required = [bool](Get-ObjectPropertyValue -Object $configuration -Name 'brokerEmailVerifiedRequired' -Default $true)
        missing = @(Get-ObjectPropertyValue -Object $configuration -Name 'missing' -Default @())
    }

    return $snapshot
}

function Add-DiagnosticWarning {
    param(
        $Report,
        [string]$Message
    )

    if ([string]::IsNullOrWhiteSpace($Message)) {
        return
    }

    $Report.warnings = @($Report.warnings) + @($Message)
}

function Merge-ResolvedSnapshot {
    param(
        $Resolved,
        $Snapshot,
        [string]$Source
    )

    $Resolved.source = $Source
    $Resolved.contract_valid = [bool]$Snapshot.contract_valid
    $Resolved.ok = [bool]$Snapshot.ok
    $Resolved.authenticated = [bool]$Snapshot.authenticated
    $Resolved.mode = [string]$Snapshot.mode
    $Resolved.transport = [string]$Snapshot.transport
    $Resolved.status = [string]$Snapshot.status
    $Resolved.configured = [bool]$Snapshot.configured
    $Resolved.recommended_mode = [string]$Snapshot.recommended_mode
    $Resolved.helper_base_url = [string]$Snapshot.helper_base_url
    $Resolved.broker_trust_configured = [bool]$Snapshot.broker_trust_configured
    $Resolved.broker_issuer_pinned = [bool]$Snapshot.broker_issuer_pinned
    $Resolved.broker_audience_pinned = [bool]$Snapshot.broker_audience_pinned
    $Resolved.broker_jwks_configured = [bool]$Snapshot.broker_jwks_configured
    $Resolved.broker_email_verified_required = [bool]$Snapshot.broker_email_verified_required
    $Resolved.missing = @($Snapshot.missing)
}

function Format-MissingOperatorAuthEnv {
    param(
        [string[]]$Missing
    )

    $labels = @{
        mode = 'AURORADERM_OPERATOR_AUTH_MODE'
        bridge_token = 'AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN'
        bridge_secret = 'AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET'
        allowlist = 'AURORADERM_OPERATOR_AUTH_ALLOWLIST'
        broker_authorize_url = 'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL'
        broker_token_url = 'OPENCLAW_AUTH_BROKER_TOKEN_URL'
        broker_userinfo_url = 'OPENCLAW_AUTH_BROKER_USERINFO_URL'
        broker_client_id = 'OPENCLAW_AUTH_BROKER_CLIENT_ID'
        broker_jwks_url = 'OPENCLAW_AUTH_BROKER_JWKS_URL'
        broker_expected_issuer = 'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER'
        broker_expected_audience = 'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE'
        broker_require_email_verified = 'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED=true'
    }

    $names = @()
    foreach ($item in @($Missing)) {
        $key = [string]$item
        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }

        $names += if ($labels.ContainsKey($key)) { $labels[$key] } else { $key }
    }

    return @($names | Select-Object -Unique)
}

function Resolve-OpenClawRolloutState {
    param(
        $Report
    )

    $primary = $Report.operator_auth_status
    $facade = $Report.admin_auth_facade
    $resolved = $Report.resolved

    $primaryValid = [bool]$primary.contract_valid
    $facadeValid = [bool]$facade.contract_valid

    if ($primaryValid) {
        Merge-ResolvedSnapshot -Resolved $resolved -Snapshot $primary -Source 'operator-auth-status'
    } elseif ($facadeValid) {
        Merge-ResolvedSnapshot -Resolved $resolved -Snapshot $facade -Source 'admin-auth-facade'
    }

    if ($primaryValid -and $facadeValid) {
        $surfaceMismatch = (
            ([string]$primary.mode -ne [string]$facade.mode) -or
            ([string]$primary.transport -ne [string]$facade.transport) -or
            ([string]$primary.status -ne [string]$facade.status) -or
            ([bool]$primary.configured -ne [bool]$facade.configured)
        )
        if ($surfaceMismatch) {
            Add-DiagnosticWarning -Report $Report -Message 'operator-auth-status y admin-auth.php?action=status no coinciden en mode/transport/status/configured.'
        }
    }

    if ([bool]$resolved.contract_valid) {
        if ((-not $primaryValid) -and $facadeValid) {
            $Report.diagnosis = 'facade_only_rollout'
            $Report.next_action = 'Desplegar y estabilizar api.php?resource=operator-auth-status; la fachada admin-auth ya expone contrato OpenClaw, pero el surface canonico aun no.'
            return
        }

        if ([string]$resolved.mode -ne 'openclaw_chatgpt') {
            $Report.diagnosis = 'openclaw_mode_disabled'
            $Report.next_action = 'Activar AURORADERM_OPERATOR_AUTH_MODE=openclaw_chatgpt en el entorno remoto.'
            return
        }

        if (-not [bool]$resolved.configured) {
            $missingEnv = Format-MissingOperatorAuthEnv -Missing @($resolved.missing)
            if ($missingEnv.Count -gt 0) {
                $Report.diagnosis = 'openclaw_not_configured'
                $Report.next_action = 'Completar configuracion remota: ' + ($missingEnv -join ', ') + '.'
            } else {
                $Report.diagnosis = 'openclaw_not_configured'
                $Report.next_action = if ([string]$resolved.transport -eq 'web_broker') {
                    'Completar broker OAuth/OpenID y callback remoto del rollout OpenClaw en el entorno remoto.'
                } else {
                    'Completar bridge, helper y allowlist del rollout OpenClaw en el entorno remoto.'
                }
            }
            return
        }

        if (
            [string]$resolved.transport -eq 'web_broker' -and (
                -not [bool]$resolved.broker_trust_configured -or
                -not [bool]$resolved.broker_issuer_pinned -or
                -not [bool]$resolved.broker_audience_pinned -or
                -not [bool]$resolved.broker_jwks_configured -or
                -not [bool]$resolved.broker_email_verified_required
            )
        ) {
            $Report.diagnosis = 'openclaw_not_configured'
            $Report.next_action = 'Completar trust OIDC del broker: JWKS, issuer, audience y email verificado obligatorio antes de pasar a openclaw_ready.'
            return
        }

        if (@($Report.warnings).Count -gt 0) {
            $Report.diagnosis = 'surface_mismatch'
            $Report.next_action = 'Alinear operator-auth-status y admin-auth.php?action=status para que publiquen el mismo contrato OpenClaw.'
            $Report.ok = $false
            return
        }

        $Report.diagnosis = 'openclaw_ready'
        $Report.next_action = if ([string]$resolved.transport -eq 'web_broker') {
            'El rollout OpenClaw web_broker ya esta listo; continuar con smoke web y gate admin.'
        } else {
            'El rollout OpenClaw ya esta listo; continuar con smoke humano y gate admin.'
        }
        $Report.ok = $true
        return
    }

    if ([bool]$facade.reachable -and [bool]$facade.json_valid -and -not [bool]$facade.contract_valid) {
        $Report.diagnosis = 'admin_auth_legacy_facade'
        $Report.next_action = 'Desplegar la fachada admin-auth.php con contrato OpenClaw (mode/status/configured) y alinear operator-auth-status.'
        return
    }

    $primaryEdgeFailure = [int]$primary.http_status -ge 520
    $facadeEdgeFailure = [int]$facade.http_status -ge 520
    if ($primaryEdgeFailure -or $facadeEdgeFailure) {
        $affectedSurfaces = @()
        if ($primaryEdgeFailure) {
            $affectedSurfaces += 'api.php?resource=operator-auth-status'
        }
        if ($facadeEdgeFailure) {
            $affectedSurfaces += 'admin-auth.php?action=status'
        }

        $statusLabel = @(
            @($primary.http_status, $facade.http_status) |
                Where-Object { [int]$_ -gt 0 } |
                Select-Object -Unique
        ) -join ','
        $hasCloudflare1033 = (
            ([string]$primary.raw_body -match '1033') -or
            ([string]$facade.raw_body -match '1033')
        )

        $Report.diagnosis = 'operator_auth_edge_failure'
        if ($hasCloudflare1033) {
            $Report.next_action =
                'Revisar Cloudflare/origen para ' + ($affectedSurfaces -join ' y ') +
                '; el edge esta devolviendo HTTP ' + $statusLabel +
                ' con error code 1033 en lugar del JSON canonico.'
        } else {
            $Report.next_action =
                'Revisar Cloudflare/origen y el routing de ' +
                ($affectedSurfaces -join ' y ') +
                '; el edge esta devolviendo HTTP ' + $statusLabel +
                ' antes de llegar al contrato OpenClaw.'
        }
        return
    }

    if (-not [bool]$primary.reachable) {
        if ([int]$primary.http_status -eq 503) {
            $Report.diagnosis = 'operator_auth_status_unavailable'
            $Report.next_action = 'Configurar y desplegar api.php?resource=operator-auth-status para este entorno remoto.'
            return
        }

        $Report.diagnosis = 'operator_auth_surface_unreachable'
        $Report.next_action = 'Revisar conectividad o routing de api.php?resource=operator-auth-status en el dominio remoto.'
        return
    }

    if (-not [bool]$primary.json_valid) {
        $Report.diagnosis = 'operator_auth_status_invalid_json'
        $Report.next_action = 'Corregir la respuesta JSON de api.php?resource=operator-auth-status.'
        return
    }

    $Report.diagnosis = 'unknown'
    $Report.next_action = 'Revisar el payload remoto de operator_auth y volver a correr el diagnostico.'
}

$report.operator_auth_status = Normalize-OperatorAuthSnapshot -Url $report.operator_auth_status.url -Name 'operator-auth-status'
$report.admin_auth_facade = Normalize-OperatorAuthSnapshot -Url $report.admin_auth_facade.url -Name 'admin-auth-facade'
Resolve-OpenClawRolloutState -Report $report

Write-Host '== Diagnostico OpenClaw Auth Rollout =='
Write-Host "Dominio: $base"
Write-Host "[INFO] operator-auth-status http=$($report.operator_auth_status.http_status) reachable=$($report.operator_auth_status.reachable) contract=$($report.operator_auth_status.contract_valid) mode=$($report.operator_auth_status.mode) transport=$($report.operator_auth_status.transport) status=$($report.operator_auth_status.status) configured=$($report.operator_auth_status.configured)"
if (-not [string]::IsNullOrWhiteSpace([string]$report.operator_auth_status.error)) {
    Write-Host "[WARN] operator-auth-status error: $($report.operator_auth_status.error)"
}
if (-not [string]::IsNullOrWhiteSpace([string]$report.operator_auth_status.payload_error)) {
    Write-Host "[WARN] operator-auth-status payload_error: $($report.operator_auth_status.payload_error)"
}

Write-Host "[INFO] admin-auth facade http=$($report.admin_auth_facade.http_status) reachable=$($report.admin_auth_facade.reachable) contract=$($report.admin_auth_facade.contract_valid) mode=$($report.admin_auth_facade.mode) transport=$($report.admin_auth_facade.transport) status=$($report.admin_auth_facade.status) configured=$($report.admin_auth_facade.configured)"
if (-not [string]::IsNullOrWhiteSpace([string]$report.admin_auth_facade.error)) {
    Write-Host "[WARN] admin-auth facade error: $($report.admin_auth_facade.error)"
}
if (-not [string]::IsNullOrWhiteSpace([string]$report.admin_auth_facade.payload_error)) {
    Write-Host "[WARN] admin-auth facade payload_error: $($report.admin_auth_facade.payload_error)"
}

foreach ($warning in @($report.warnings)) {
    Write-Host "[WARN] $warning"
}

if ($report.ok) {
    Write-Host "[OK]  rollout OpenClaw listo (source=$($report.resolved.source), helper=$($report.resolved.helper_base_url))"
} else {
    Write-Host "[FAIL] diagnostico=$($report.diagnosis)"
}
Write-Host "[INFO] nextAction=$($report.next_action)"

try {
    $directory = Split-Path -Parent $ReportPath
    if ($directory) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }
    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $ReportPath -Encoding UTF8
} catch {
    Write-Host "[WARN] No se pudo escribir reporte: $($_.Exception.Message)"
}

if ($Json) {
    $report | ConvertTo-Json -Depth 8
}

if ($report.ok -or $AllowNotReady) {
    exit 0
}

exit 1

