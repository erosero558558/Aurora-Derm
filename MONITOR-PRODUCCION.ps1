param(
    [string]$Domain = 'https://pielarmonia.com',
    [int]$TimeoutSec = 15,
    [int]$MaxLatencyMs = 3500,
    [switch]$AllowDegradedFigo,
    [switch]$SkipBackupCheck,
    [switch]$AllowStoreCalendar,
    [switch]$AllowBlockedCalendar
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$todayDate = Get-Date -Format 'yyyy-MM-dd'

function Invoke-EndpointCheck {
    param(
        [string]$Name,
        [string]$Url
    )

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        $response = Invoke-WebRequest -Uri $Url -Method Get -TimeoutSec $TimeoutSec -UseBasicParsing
        $sw.Stop()
        return [pscustomobject]@{
            Name = $Name
            Url = $Url
            Ok = $true
            StatusCode = [int]$response.StatusCode
            DurationMs = [int]$sw.ElapsedMilliseconds
            Body = [string]$response.Content
            Error = ''
        }
    } catch {
        $sw.Stop()
        $statusCode = 0
        $body = ''
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $body = $reader.ReadToEnd()
                    $reader.Close()
                }
            } catch {}
        }

        return [pscustomobject]@{
            Name = $Name
            Url = $Url
            Ok = $false
            StatusCode = $statusCode
            DurationMs = [int]$sw.ElapsedMilliseconds
            Body = $body
            Error = $_.Exception.Message
        }
    }
}

function Parse-JsonBody {
    param([string]$Body)
    if ([string]::IsNullOrWhiteSpace($Body)) { return $null }
    try {
        $convertCmd = Get-Command ConvertFrom-Json -ErrorAction Stop
        if ($convertCmd.Parameters.ContainsKey('Depth')) {
            return ($Body | ConvertFrom-Json -Depth 10)
        }
        return ($Body | ConvertFrom-Json)
    } catch {
        return $null
    }
}

$checks = @(
    @{ Name = 'home'; Url = "$base/" },
    @{ Name = 'health'; Url = "$base/api.php?resource=health" },
    @{ Name = 'reviews'; Url = "$base/api.php?resource=reviews" },
    @{ Name = 'availability'; Url = "$base/api.php?resource=availability" },
    @{ Name = 'booked-slots'; Url = "$base/api.php?resource=booked-slots&date=$todayDate&doctor=indiferente&service=consulta" },
    @{ Name = 'figo-get'; Url = "$base/figo-chat.php" }
)

$results = @()
$failures = @()
$effectiveAllowStoreCalendar = [bool]$AllowStoreCalendar

Write-Host "== Monitor Produccion =="
Write-Host "Dominio: $base"
Write-Host "Fecha: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

foreach ($c in $checks) {
    $r = Invoke-EndpointCheck -Name $c.Name -Url $c.Url
    $results += $r

    if ($r.StatusCode -ne 200) {
        $handledBlockedCalendar = $false
        if (
            $AllowBlockedCalendar -and
            ($r.Name -eq 'availability' -or $r.Name -eq 'booked-slots') -and
            $r.StatusCode -eq 503
        ) {
            $payload = Parse-JsonBody -Body $r.Body
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

    if ($r.DurationMs -gt $MaxLatencyMs) {
        $failures += "[FAIL] $($r.Name): latencia alta $($r.DurationMs)ms (max ${MaxLatencyMs}ms)"
    } else {
        Write-Host "[OK]  $($r.Name): $($r.StatusCode) en $($r.DurationMs)ms"
    }
}

$healthResult = $results | Where-Object { $_.Name -eq 'health' } | Select-Object -First 1
if ($null -ne $healthResult -and $healthResult.StatusCode -eq 200) {
    $health = Parse-JsonBody -Body $healthResult.Body
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
        } catch {
            $failures += "[FAIL] health: validacion exception $($_.Exception.Message)"
        }
    }
}

$figoResult = $results | Where-Object { $_.Name -eq 'figo-get' } | Select-Object -First 1
if ($null -ne $figoResult -and $figoResult.StatusCode -eq 200) {
    $figo = Parse-JsonBody -Body $figoResult.Body
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
    $availability = Parse-JsonBody -Body $availabilityResult.Body
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
    $booked = Parse-JsonBody -Body $bookedResult.Body
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
