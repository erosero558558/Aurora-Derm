param(
    [string]$BaseUrl = 'http://127.0.0.1',
    [string]$ExpectedAuthMode = 'openclaw_chatgpt',
    [string]$ExpectedTransport = 'web_broker',
    [string]$ReportPath = '',
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'
$commonScriptPath = Join-Path $PSScriptRoot 'Windows.Hosting.Common.ps1'
if (-not (Test-Path -LiteralPath $commonScriptPath)) {
    throw "No existe el modulo comun de hosting Windows: $commonScriptPath"
}
. $commonScriptPath
$base = $BaseUrl.TrimEnd('/')

function Write-Info {
    param([string]$Message)

    if (-not $Quiet) {
        Write-Host "[hosting-smoke] $Message"
    }
}

function Invoke-TextFetch {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 20
    )

    $response = Invoke-HostingHttpRequest -Url $Url -Headers $Headers -TimeoutSec $TimeoutSec
    return [PSCustomObject]@{
        Ok = ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300)
        StatusCode = [int]$response.StatusCode
        Body = [string]$response.Body
        Error = [string]$response.Error
    }
}

function Add-SmokeCheck {
    param(
        [System.Collections.Generic.List[object]]$Collection,
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )

    $Collection.Add([PSCustomObject]@{
        name = $Name
        ok = $Ok
        detail = $Detail
    }) | Out-Null
}

$checks = New-Object 'System.Collections.Generic.List[object]'
$errors = New-Object 'System.Collections.Generic.List[string]'

$healthResponse = Invoke-TextFetch -Url "$base/api.php?resource=health-diagnostics" -Headers @{ Accept = 'application/json' }
$healthPayload = $null
if ($healthResponse.Ok) {
    $healthPayload = ConvertFrom-JsonCompat -Text $healthResponse.Body -Depth 12
    if ($null -eq $healthPayload) {
        $errors.Add('health-diagnostics devolvio JSON invalido.') | Out-Null
    }
} else {
    $errors.Add(("health-diagnostics fallo: {0}" -f $healthResponse.Error)) | Out-Null
}
Add-SmokeCheck `
    -Collection $checks `
    -Name 'health-diagnostics' `
    -Ok ($null -ne $healthPayload -and $healthPayload.ok -eq $true) `
    -Detail (if ($null -ne $healthPayload) { "status=$($healthPayload.status)" } else { $healthResponse.Error })

$statusResponse = Invoke-TextFetch -Url "$base/admin-auth.php?action=status" -Headers @{ Accept = 'application/json' }
$statusPayload = $null
if ($statusResponse.Ok) {
    $statusPayload = ConvertFrom-JsonCompat -Text $statusResponse.Body -Depth 12
    if ($null -eq $statusPayload) {
        $errors.Add('admin-auth.php?action=status devolvio JSON invalido.') | Out-Null
    }
} else {
    $errors.Add(("admin-auth.php?action=status fallo: {0}" -f $statusResponse.Error)) | Out-Null
}
$authOk =
    ($null -ne $statusPayload) -and
    ([string]$statusPayload.mode -eq $ExpectedAuthMode) -and
    ([string]$statusPayload.transport -eq $ExpectedTransport) -and
    ([string]$statusPayload.status -ne 'transport_misconfigured')
Add-SmokeCheck `
    -Collection $checks `
    -Name 'admin-auth-status' `
    -Ok $authOk `
    -Detail (if ($null -ne $statusPayload) {
        "mode=$([string]$statusPayload.mode) transport=$([string]$statusPayload.transport) status=$([string]$statusPayload.status)"
    } else {
        $statusResponse.Error
    })

$adminHtml = Invoke-TextFetch -Url "$base/admin.html"
$adminJs = Invoke-TextFetch -Url "$base/admin.js"
$operatorHtml = Invoke-TextFetch -Url "$base/operador-turnos.html"
$operatorJs = Invoke-TextFetch -Url "$base/js/queue-operator.js"
$localhostLeakDetected = $false
foreach ($response in @($adminHtml, $adminJs, $operatorHtml, $operatorJs)) {
    if ($response.Ok -and ($response.Body -match '127\.0\.0\.1:4173')) {
        $localhostLeakDetected = $true
        break
    }
}
Add-SmokeCheck `
    -Collection $checks `
    -Name 'localhost-leak' `
    -Ok (-not $localhostLeakDetected) `
    -Detail (if ($localhostLeakDetected) { 'Se detecto referencia activa a 127.0.0.1:4173 en el shell publicado.' } else { 'Sin referencias activas al helper local.' })

$allOk = ($checks | Where-Object { $_.ok -ne $true }).Count -eq 0
$report = [ordered]@{
    ok = $allOk
    timestamp = [DateTimeOffset]::Now.ToString('o')
    base_url = $base
    expected_auth_mode = $ExpectedAuthMode
    expected_transport = $ExpectedTransport
    checks = @($checks)
    error = if ($allOk) { '' } else { (@($errors) -join ' | ') }
}

if (-not [string]::IsNullOrWhiteSpace($ReportPath)) {
    $parent = Split-Path -Parent $ReportPath
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $report | ConvertTo-Json -Depth 10 | Set-Content -Path $ReportPath -Encoding UTF8
}

if ($allOk) {
    Write-Info ("Smoke local OK: transport={0}" -f $ExpectedTransport)
    exit 0
}

Write-Info ("Smoke local FAIL: {0}" -f $report.error)
exit 1
