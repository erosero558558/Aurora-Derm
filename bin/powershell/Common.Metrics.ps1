function Get-PercentileValue {
    param(
        [double[]]$Values,
        [double]$Percentile
    )

    if (-not $Values -or $Values.Count -eq 0) {
        return 0
    }

    $sorted = $Values | Sort-Object
    $index = [Math]::Ceiling(($Percentile / 100) * $sorted.Count) - 1
    if ($index -lt 0) { $index = 0 }
    if ($index -ge $sorted.Count) { $index = $sorted.Count - 1 }
    return [double]$sorted[$index]
}

function Measure-BenchEndpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$BenchRuns,
        [string]$Method = 'GET',
        [string]$JsonBody = '',
        [int]$MaxTimeSec = 20,
        [int]$ConnectTimeoutSec = 8,
        [string]$UserAgent = 'PielArmoniaWeeklyReport/1.0'
    )

    $times = New-Object System.Collections.Generic.List[double]
    $statusFailures = 0
    $networkFailures = 0
    $curlBinary = Get-CurlBinary

    for ($i = 1; $i -le $BenchRuns; $i++) {
        $args = @(
            '-sS',
            '-o', 'NUL',
            '-w', '%{http_code} %{time_total}',
            '--max-time', [string]$MaxTimeSec,
            '--connect-timeout', [string]$ConnectTimeoutSec,
            '-L',
            '-A', $UserAgent
        )

        if ($Method -eq 'POST') {
            $args += @('-X', 'POST', '-H', 'Content-Type: application/json', '--data', $JsonBody)
        }
        $args += $Url

        $out = ''
        try {
            $out = (& $curlBinary @args 2>$null | Out-String).Trim()
        } catch {
            $networkFailures += 1
            continue
        }

        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($out)) {
            $networkFailures += 1
            continue
        }

        $parts = $out -split '\s+'
        if ($parts.Count -lt 2) {
            $networkFailures += 1
            continue
        }

        $status = 0
        $timeSeconds = 0.0
        [void][int]::TryParse($parts[0], [ref]$status)
        [void][double]::TryParse(
            $parts[1],
            [System.Globalization.NumberStyles]::Float,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$timeSeconds
        )

        if ($status -lt 200 -or $status -ge 500) {
            $statusFailures += 1
        }

        $times.Add([Math]::Round($timeSeconds * 1000, 2))
    }

    if ($times.Count -eq 0) {
        return [pscustomobject]@{
            Name = $Name
            Samples = 0
            AvgMs = 0
            P95Ms = 0
            MaxMs = 0
            StatusFailures = $statusFailures
            NetworkFailures = $networkFailures
        }
    }

    $avg = ($times | Measure-Object -Average).Average
    $p95 = Get-PercentileValue -Values $times.ToArray() -Percentile 95
    $max = ($times | Measure-Object -Maximum).Maximum

    return [pscustomobject]@{
        Name = $Name
        Samples = $times.Count
        AvgMs = [Math]::Round([double]$avg, 2)
        P95Ms = [Math]::Round([double]$p95, 2)
        MaxMs = [Math]::Round([double]$max, 2)
        StatusFailures = $statusFailures
        NetworkFailures = $networkFailures
    }
}

function Parse-PrometheusLabels {
    param([string]$RawLabels)

    $labels = @{}
    if ([string]::IsNullOrWhiteSpace($RawLabels)) {
        return $labels
    }

    $matches = [regex]::Matches($RawLabels, '([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\]|\\.)*)"')
    foreach ($match in $matches) {
        $key = [string]$match.Groups[1].Value
        $value = [string]$match.Groups[2].Value
        if ([string]::IsNullOrWhiteSpace($key)) {
            continue
        }
        $labels[$key] = [regex]::Unescape($value)
    }

    return $labels
}

function Parse-PrometheusCounterSeries {
    param(
        [string]$MetricsText,
        [string]$MetricName
    )

    $series = @()
    if ([string]::IsNullOrWhiteSpace($MetricsText) -or [string]::IsNullOrWhiteSpace($MetricName)) {
        return $series
    }

    $pattern = '^' + [regex]::Escape($MetricName) + '(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$'
    $lines = $MetricsText -split "\r?\n"
    foreach ($line in $lines) {
        $clean = [string]$line
        if ([string]::IsNullOrWhiteSpace($clean) -or $clean.StartsWith('#')) {
            continue
        }

        $match = [regex]::Match($clean.Trim(), $pattern)
        if (-not $match.Success) {
            continue
        }

        $labelsRaw = [string]$match.Groups[1].Value
        $valueRaw = [string]$match.Groups[2].Value
        $value = 0.0
        [void][double]::TryParse(
            $valueRaw,
            [System.Globalization.NumberStyles]::Float,
            [System.Globalization.CultureInfo]::InvariantCulture,
            [ref]$value
        )
        $series += [pscustomobject]@{
            Labels = Parse-PrometheusLabels -RawLabels $labelsRaw
            Value = $value
        }
    }

    return $series
}

function Get-ScalarMetricValue {
    param(
        [string]$MetricsText,
        [string]$MetricName,
        [double]$DefaultValue = 0
    )

    $series = Parse-PrometheusCounterSeries -MetricsText $MetricsText -MetricName $MetricName
    if (-not $series -or $series.Count -eq 0) {
        return [double]$DefaultValue
    }

    foreach ($row in $series) {
        $labels = $row.Labels
        if ($null -eq $labels -or $labels.Count -eq 0) {
            return [double]$row.Value
        }
    }

    return [double]$series[0].Value
}

function Get-EventCount {
    param(
        $Events,
        [string]$Name
    )

    if ($null -eq $Events) {
        return 0
    }

    try {
        $value = $Events.$Name
        if ($null -eq $value) {
            return 0
        }
        return [int]$value
    } catch {
        return 0
    }
}
