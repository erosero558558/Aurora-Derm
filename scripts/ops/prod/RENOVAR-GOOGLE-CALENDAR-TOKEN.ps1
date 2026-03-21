param(
    [string]$ServerBaseUrl = 'http://127.0.0.1',
    [int]$TimeoutSec = 600,
    [int]$PollSec = 2,
    [switch]$NoBrowser,
    [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'
$base = $ServerBaseUrl.TrimEnd('/')

function Invoke-JsonRequest {
    param(
        [string]$Method,
        [string]$Url,
        $Body = $null
    )

    $invokeParams = @{
        Method = $Method
        Uri = $Url
        Headers = @{ Accept = 'application/json' }
        TimeoutSec = 30
        ErrorAction = 'Stop'
    }

    if ($null -ne $Body) {
        $invokeParams['ContentType'] = 'application/json'
        $invokeParams['Body'] = ($Body | ConvertTo-Json -Depth 8 -Compress)
    }

    return Invoke-RestMethod @invokeParams
}

Write-Host '== Renovar Google Calendar Token =='
Write-Host "Base local: $base"
Write-Host 'Iniciando challenge de reautorizacion...'

$start = Invoke-JsonRequest -Method 'POST' -Url "$base/admin-auth.php?action=calendar-token-start" -Body @{}
if (-not $start.ok) {
    throw ("No se pudo iniciar la reautorizacion: " + [string]$start.error)
}

$challenge = $start.challenge
$challengeId = [string]$challenge.challengeId
$authUrl = [string]$challenge.authUrl
$expiresAt = [string]$challenge.expiresAt

Write-Host "Challenge: $challengeId"
Write-Host "Expira: $expiresAt"
Write-Host "URL Google: $authUrl"

if (-not $NoBrowser) {
    try {
        Start-Process $authUrl | Out-Null
        Write-Host 'Browser abierto para completar el consentimiento.'
    } catch {
        Write-Host '[WARN] No se pudo abrir el browser automaticamente.'
    }
}

$deadline = (Get-Date).AddSeconds([Math]::Max(30, $TimeoutSec))
$lastStatus = ''
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds ([Math]::Max(1, $PollSec))
    $status = Invoke-JsonRequest -Method 'GET' -Url "$base/admin-auth.php?action=calendar-token-status&challengeId=$challengeId"
    if (-not $status.ok) {
        throw ("No se pudo leer el estado del challenge: " + [string]$status.error)
    }

    $challengeStatus = [string]$status.status
    if ($challengeStatus -ne $lastStatus) {
        $lastStatus = $challengeStatus
        Write-Host "Estado: $challengeStatus"
    }

    if ($challengeStatus -eq 'completed') {
        $payload = $status.challenge
        Write-Host 'Refresh token renovado y aplicado.'
        Write-Host ("Env actualizado: " + [string]$payload.envUpdated)
        Write-Host ("Token validado: " + [string]$payload.tokenValidated)
        if ([string]$payload.calendarProbeReason -ne '') {
            Write-Host ("Calendar probe: " + [string]$payload.calendarProbeReason)
        }

        if (-not $SkipHealthCheck) {
            Write-Host 'Verificando health local despues de la renovacion...'
            $health = Invoke-JsonRequest -Method 'GET' -Url "$base/api.php?resource=health"
            Write-Host ("calendarSource=" + [string]$health.calendarSource)
            Write-Host ("calendarReachable=" + [string]$health.calendarReachable)
            Write-Host ("calendarMode=" + [string]$health.calendarMode)
            Write-Host ("calendarTokenHealthy=" + [string]$health.calendarTokenHealthy)
            Write-Host ("calendarLastErrorReason=" + [string]$health.calendarLastErrorReason)
        }

        exit 0
    }

    if ($challengeStatus -eq 'error' -or $challengeStatus -eq 'expired') {
        $payload = $status.challenge
        $message = [string]$payload.error
        if ($message -eq '') {
            $message = 'La reautorizacion no se completo.'
        }
        throw $message
    }
}

throw "Timeout esperando el callback de Google. Challenge pendiente: $challengeId"
