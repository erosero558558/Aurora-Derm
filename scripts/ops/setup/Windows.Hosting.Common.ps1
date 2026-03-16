function Ensure-HostingParentDirectory {
    param([string]$Path)

    $parent = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parent) -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
}

function ConvertFrom-JsonCompat {
    param(
        [string]$Text,
        [int]$Depth = 20
    )

    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }

    $convertCommand = Get-Command ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($null -eq $convertCommand) {
        return $null
    }

    try {
        if ($convertCommand.Parameters.ContainsKey('Depth')) {
            return ($Text | ConvertFrom-Json -Depth $Depth)
        }
        return ($Text | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Read-HostingJsonFileSafe {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return $null
    }

    try {
        $raw = Get-Content -LiteralPath $Path -Raw
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        return (ConvertFrom-JsonCompat -Text ($raw -replace "^\uFEFF", '') -Depth 20)
    } catch {
        return $null
    }
}

function Write-HostingJsonFile {
    param(
        [string]$Path,
        [hashtable]$Payload
    )

    Ensure-HostingParentDirectory -Path $Path
    $json = $Payload | ConvertTo-Json -Depth 20
    Set-Content -Path $Path -Value $json -Encoding UTF8
}

function Add-HostingOptionalNamedArgument {
    param(
        [System.Collections.Generic.List[string]]$Arguments,
        [string]$Name,
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return
    }

    $Arguments.Add($Name) | Out-Null
    $Arguments.Add($Value) | Out-Null
}

function Get-HostingFileSha256 {
    param([string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        return ''
    }

    $getFileHashCommand = Get-Command Get-FileHash -ErrorAction SilentlyContinue
    if ($null -ne $getFileHashCommand) {
        try {
            return [string]((Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash).ToLowerInvariant()
        } catch {
        }
    }

    $stream = $null
    $sha256 = $null
    try {
        $stream = [System.IO.File]::OpenRead($Path)
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        $hashBytes = $sha256.ComputeHash($stream)
        $builder = New-Object System.Text.StringBuilder
        foreach ($byte in $hashBytes) {
            [void]$builder.AppendFormat('{0:x2}', $byte)
        }
        return [string]$builder.ToString()
    } finally {
        if ($null -ne $sha256) {
            $sha256.Dispose()
        }
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }
}

function Invoke-HostingCommandWithOutput {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    $stdoutPath = [System.IO.Path]::GetTempFileName()
    $stderrPath = [System.IO.Path]::GetTempFileName()
    try {
        $process = Start-Process `
            -FilePath $FilePath `
            -ArgumentList $Arguments `
            -NoNewWindow `
            -Wait `
            -PassThru `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath

        $chunks = @()
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                $content = Get-Content -LiteralPath $path -Raw
                if (-not [string]::IsNullOrWhiteSpace($content)) {
                    $chunks += $content.Trim()
                }
            }
        }

        return [PSCustomObject]@{
            ExitCode = $process.ExitCode
            Output = $chunks -join [Environment]::NewLine
        }
    } finally {
        foreach ($path in @($stdoutPath, $stderrPath)) {
            if (Test-Path -LiteralPath $path) {
                Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Get-HostingResponseBody {
    param([object]$Response)

    if ($null -eq $Response) {
        return ''
    }

    try {
        $content = $Response.Content
        if ($content -is [string]) {
            return $content
        }
    } catch {
    }

    try {
        $stream = $Response.GetResponseStream()
        if ($null -ne $stream) {
            $reader = New-Object System.IO.StreamReader($stream)
            try {
                return $reader.ReadToEnd()
            } finally {
                $reader.Close()
            }
        }
    } catch {
    }

    return ''
}

function Invoke-HostingHttpRequest {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 20
    )

    try {
        $response = Invoke-WebRequest -Uri $Url -Headers $Headers -UseBasicParsing -TimeoutSec $TimeoutSec
        return [PSCustomObject]@{
            Ok = $true
            StatusCode = [int]$response.StatusCode
            Body = [string](Get-HostingResponseBody -Response $response)
            Error = ''
        }
    } catch {
        $statusCode = 0
        $body = ''
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode.value__ } catch {}
            $body = Get-HostingResponseBody -Response $_.Exception.Response
        }
        return [PSCustomObject]@{
            Ok = $false
            StatusCode = $statusCode
            Body = $body
            Error = $_.Exception.Message
        }
    }
}

function Invoke-HostingJsonRequest {
    param(
        [string]$Url,
        [hashtable]$Headers = @{},
        [int]$TimeoutSec = 20,
        [int]$Depth = 20
    )

    $response = Invoke-HostingHttpRequest -Url $Url -Headers $Headers -TimeoutSec $TimeoutSec
    $payload = $null
    if (-not [string]::IsNullOrWhiteSpace($response.Body)) {
        $payload = ConvertFrom-JsonCompat -Text $response.Body -Depth $Depth
    }

    return [PSCustomObject]@{
        Ok = $response.Ok -and ($null -ne $payload)
        StatusCode = $response.StatusCode
        Body = $response.Body
        Payload = $payload
        Error = if ($response.Ok) {
            if ($null -eq $payload) { 'JSON invalido' } else { '' }
        } else {
            $response.Error
        }
    }
}

function Test-HostingProcessExists {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $false
    }

    try {
        return $null -ne (Get-Process -Id $ProcessId -ErrorAction Stop)
    } catch {
        return $false
    }
}

function Get-HostingProcessSnapshots {
    $result = @()

    $cimCommand = Get-Command Get-CimInstance -ErrorAction SilentlyContinue
    if ($null -ne $cimCommand) {
        try {
            return @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
                [PSCustomObject]@{
                    ProcessId = [int]$_.ProcessId
                    Name = [string]$_.Name
                    CommandLine = [string]$_.CommandLine
                }
            })
        } catch {
        }
    }

    $wmiCommand = Get-Command Get-WmiObject -ErrorAction SilentlyContinue
    if ($null -ne $wmiCommand) {
        try {
            return @(Get-WmiObject Win32_Process -ErrorAction SilentlyContinue | ForEach-Object {
                [PSCustomObject]@{
                    ProcessId = [int]$_.ProcessId
                    Name = [string]$_.Name
                    CommandLine = [string]$_.CommandLine
                }
            })
        } catch {
        }
    }

    $taskListCommand = Get-Command tasklist.exe -ErrorAction SilentlyContinue
    if ($null -ne $taskListCommand) {
        $taskList = Invoke-HostingCommandWithOutput -FilePath $taskListCommand.Source -Arguments @('/FO', 'CSV', '/NH')
        if ($taskList.ExitCode -eq 0 -and -not [string]::IsNullOrWhiteSpace($taskList.Output)) {
            foreach ($line in ($taskList.Output -split "`r?`n")) {
                if ([string]::IsNullOrWhiteSpace($line)) {
                    continue
                }
                try {
                    $fields = ConvertFrom-Csv -InputObject $line -Header 'ImageName', 'PID', 'SessionName', 'SessionNum', 'MemUsage'
                    $result += [PSCustomObject]@{
                        ProcessId = [int]$fields.PID
                        Name = [string]$fields.ImageName
                        CommandLine = ''
                    }
                } catch {
                }
            }
        }
    }

    return @($result)
}

function Test-HostingCommandLineMatch {
    param(
        [string]$CommandLine,
        [string[]]$Needles
    )

    if ([string]::IsNullOrWhiteSpace($CommandLine)) {
        return $false
    }

    foreach ($needle in $Needles) {
        if ([string]::IsNullOrWhiteSpace($needle)) {
            continue
        }
        if ($CommandLine.IndexOf($needle, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            return $false
        }
    }

    return $true
}

function Get-HostingProcessesByNeedle {
    param([string[]]$Needles)

    return @(Get-HostingProcessSnapshots | Where-Object {
        $commandLine = [string]$_.CommandLine
        if (-not [string]::IsNullOrWhiteSpace($commandLine)) {
            return (Test-HostingCommandLineMatch -CommandLine $commandLine -Needles $Needles)
        }

        foreach ($needle in $Needles) {
            if ([string]::IsNullOrWhiteSpace($needle)) {
                continue
            }
            if ([string]$_.Name -like "*$needle*") {
                return $true
            }
        }

        return $false
    })
}

function Stop-HostingProcessesByNeedle {
    param(
        [string[]]$Needles,
        [string]$Label = 'process'
    )

    foreach ($match in (Get-HostingProcessesByNeedle -Needles $Needles)) {
        try {
            Stop-Process -Id ([int]$match.ProcessId) -Force -ErrorAction SilentlyContinue
        } catch {
        }
    }
}

function Parse-HostingTcpEndpoint {
    param([string]$Endpoint)

    if ([string]::IsNullOrWhiteSpace($Endpoint)) {
        return $null
    }

    $trimmed = $Endpoint.Trim()
    $lastColon = $trimmed.LastIndexOf(':')
    if ($lastColon -lt 0 -or $lastColon -ge ($trimmed.Length - 1)) {
        return $null
    }

    $address = $trimmed.Substring(0, $lastColon).Trim('[', ']')
    $portText = $trimmed.Substring($lastColon + 1)
    $port = 0
    if (-not [int]::TryParse($portText, [ref]$port)) {
        return $null
    }

    return [PSCustomObject]@{
        Address = $address
        Port = $port
    }
}

function Get-HostingListeningTcpEntries {
    $netTcpCommand = Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue
    if ($null -ne $netTcpCommand) {
        try {
            return @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
                [PSCustomObject]@{
                    LocalAddress = [string]$_.LocalAddress
                    LocalPort = [int]$_.LocalPort
                    OwningProcess = [int]$_.OwningProcess
                }
            })
        } catch {
        }
    }

    $netstatCommand = Get-Command netstat.exe -ErrorAction SilentlyContinue
    if ($null -eq $netstatCommand) {
        return @()
    }

    $result = Invoke-HostingCommandWithOutput -FilePath $netstatCommand.Source -Arguments @('-ano', '-p', 'tcp')
    if ($result.ExitCode -ne 0 -or [string]::IsNullOrWhiteSpace($result.Output)) {
        return @()
    }

    $entries = @()
    foreach ($line in ($result.Output -split "`r?`n")) {
        if ($line -notmatch '^\s*TCP\s+(\S+)\s+(\S+)\s+(LISTENING|ESCUCHANDO)\s+(\d+)\s*$') {
            continue
        }

        $local = Parse-HostingTcpEndpoint -Endpoint $matches[1]
        if ($null -eq $local) {
            continue
        }

        $processId = 0
        [void][int]::TryParse($matches[4], [ref]$processId)
        $entries += [PSCustomObject]@{
            LocalAddress = [string]$local.Address
            LocalPort = [int]$local.Port
            OwningProcess = [int]$processId
        }
    }

    return @($entries)
}

function Get-HostingListeningTcpEntry {
    param(
        [int]$Port,
        [string[]]$Addresses = @('127.0.0.1', '::1', '0.0.0.0', '::')
    )

    return Get-HostingListeningTcpEntries |
        Where-Object {
            ($_.LocalPort -eq $Port) -and ($Addresses -contains [string]$_.LocalAddress)
        } |
        Select-Object -First 1
}

function Get-HostingProcessByIdSafe {
    param([int]$ProcessId)

    if ($ProcessId -le 0) {
        return $null
    }

    return Get-HostingProcessSnapshots |
        Where-Object { [int]$_.ProcessId -eq $ProcessId } |
        Select-Object -First 1
}

function Get-HostingScheduledTaskSafe {
    param([string]$TaskName)

    $scheduledTaskCommand = Get-Command Get-ScheduledTask -ErrorAction SilentlyContinue
    if ($null -ne $scheduledTaskCommand) {
        try {
            return Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
        } catch {
        }
    }

    $schtasksCommand = Get-Command schtasks.exe -ErrorAction SilentlyContinue
    if ($null -eq $schtasksCommand) {
        return $null
    }

    $query = Invoke-HostingCommandWithOutput -FilePath $schtasksCommand.Source -Arguments @('/Query', '/TN', $TaskName, '/FO', 'LIST')
    if ($query.ExitCode -ne 0) {
        return $null
    }

    $state = ''
    foreach ($line in ($query.Output -split "`r?`n")) {
        if ($line -match '^\s*Status:\s*(.+?)\s*$') {
            $state = $matches[1].Trim()
            break
        }
    }

    return [PSCustomObject]@{
        TaskName = $TaskName
        State = $state
    }
}

function Stop-HostingScheduledTaskIfPresent {
    param([string]$TaskName)

    $task = Get-HostingScheduledTaskSafe -TaskName $TaskName
    if ($null -eq $task) {
        return $false
    }

    $stopCommand = Get-Command Stop-ScheduledTask -ErrorAction SilentlyContinue
    if ($null -ne $stopCommand -and $task.PSObject.TypeNames -contains 'Microsoft.Management.Infrastructure.CimInstance#Root/Microsoft/Windows/TaskScheduler/MSFT_ScheduledTask') {
        try {
            Stop-ScheduledTask -InputObject $task -ErrorAction SilentlyContinue
            return $true
        } catch {
        }
    }

    $schtasksCommand = Get-Command schtasks.exe -ErrorAction SilentlyContinue
    if ($null -ne $schtasksCommand) {
        $stop = Invoke-HostingCommandWithOutput -FilePath $schtasksCommand.Source -Arguments @('/End', '/TN', $TaskName)
        return ($stop.ExitCode -eq 0)
    }

    return $false
}

function Remove-HostingScheduledTaskIfPresent {
    param([string]$TaskName)

    $task = Get-HostingScheduledTaskSafe -TaskName $TaskName
    if ($null -eq $task) {
        return $false
    }

    $unregisterCommand = Get-Command Unregister-ScheduledTask -ErrorAction SilentlyContinue
    if ($null -ne $unregisterCommand -and $task.PSObject.TypeNames -contains 'Microsoft.Management.Infrastructure.CimInstance#Root/Microsoft/Windows/TaskScheduler/MSFT_ScheduledTask') {
        try {
            Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
            return $true
        } catch {
        }
    }

    $schtasksCommand = Get-Command schtasks.exe -ErrorAction SilentlyContinue
    if ($null -ne $schtasksCommand) {
        $delete = Invoke-HostingCommandWithOutput -FilePath $schtasksCommand.Source -Arguments @('/Delete', '/F', '/TN', $TaskName)
        return ($delete.ExitCode -eq 0)
    }

    return $false
}
