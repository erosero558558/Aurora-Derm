param(
    [string]$Domain = 'https://pielarmonia.com',
    [string]$RepoPath = '/var/www/figo',
    [string]$WrapperPath = '/root/sync-pielarmonia.sh',
    [string]$CanonicalWrapperPath = '/var/www/figo/bin/deploy-public-v3-cron-sync.sh',
    [string]$StatusPath = '/var/lib/pielarmonia/public-sync-status.json',
    [string]$LogPath = '/var/log/sync-pielarmonia.log',
    [string]$LockPath = '/tmp/sync-pielarmonia.lock',
    [string]$DiagnosticsUrl = 'http://127.0.0.1/api.php?resource=health-diagnostics',
    [ValidateSet('text', 'markdown')]
    [string]$Format = 'text',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$base = $Domain.TrimEnd('/')
$generatedAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
$lines = New-Object System.Collections.Generic.List[string]

function Add-ChecklistLine {
    param([string]$Line = '')

    $script:lines.Add($Line) | Out-Null
}

function Add-ChecklistSection {
    param([string]$Title)

    if ($script:Format -eq 'markdown') {
        Add-ChecklistLine "## $Title"
    } else {
        Add-ChecklistLine "== $Title =="
    }
    Add-ChecklistLine
}

function Add-ChecklistBullet {
    param([string]$Text)

    Add-ChecklistLine "- $Text"
}

function Add-ChecklistCommandBlock {
    param([string[]]$Commands)

    if ($script:Format -eq 'markdown') {
        Add-ChecklistLine '```bash'
        foreach ($command in $Commands) {
            Add-ChecklistLine $command
        }
        Add-ChecklistLine '```'
    } else {
        foreach ($command in $Commands) {
            Add-ChecklistLine "  $command"
        }
    }
    Add-ChecklistLine
}

if ($Format -eq 'markdown') {
    Add-ChecklistLine '# Host Checklist - Public Sync'
    Add-ChecklistLine
} else {
    Add-ChecklistLine 'HOST CHECKLIST - PUBLIC SYNC'
    Add-ChecklistLine
}

Add-ChecklistBullet "generatedAt: $generatedAt"
Add-ChecklistBullet "domain: $base"
Add-ChecklistBullet "repoPath: $RepoPath"
Add-ChecklistBullet "wrapperPath: $WrapperPath"
Add-ChecklistBullet "canonicalWrapperPath: $CanonicalWrapperPath"
Add-ChecklistBullet "statusPath: $StatusPath"
Add-ChecklistBullet "logPath: $LogPath"
Add-ChecklistBullet "diagnosticsUrl: $DiagnosticsUrl"
Add-ChecklistLine

Add-ChecklistSection 'Snapshot del host'
Add-ChecklistBullet 'Confirma si el wrapper live coincide con el wrapper canonico del repo antes de interpretar telemetryGap o working_tree_dirty.'
Add-ChecklistCommandBlock @(
    "sha256sum $WrapperPath $CanonicalWrapperPath",
    "cmp -s $WrapperPath $CanonicalWrapperPath && echo wrapper_match || echo wrapper_diff",
    "stat $WrapperPath $CanonicalWrapperPath",
    "cat $StatusPath",
    "tail -n 50 $LogPath"
)

Add-ChecklistSection 'Snapshot del repo live'
Add-ChecklistBullet 'Verifica drift tracked, HEAD local del VPS y referencia remota de main en el mismo pase.'
Add-ChecklistCommandBlock @(
    "cd $RepoPath",
    'git status --short',
    'git rev-parse HEAD',
    'git rev-parse origin/main',
    'git diff --name-only',
    'git ls-files -m'
)

Add-ChecklistSection 'Diagnostics runtime'
Add-ChecklistBullet 'Usa localhost o bearer de diagnostics; no dependas del health publico para el triage detallado.'
Add-ChecklistCommandBlock @(
    "curl -s $DiagnosticsUrl",
    "curl -s $DiagnosticsUrl | jq '.checks.publicSync | {configured, jobId, state, healthy, operationallyHealthy, repoHygieneIssue, ageSeconds, expectedMaxLagSeconds, lastCheckedAt, lastSuccessAt, lastErrorAt, failureReason, lastErrorMessage, currentHead, remoteHead, dirtyPathsCount, dirtyPathsSample}'",
    "curl -s $DiagnosticsUrl | jq '.checks.storage | {backend, source, encrypted, encryptionConfigured, encryptionRequired, encryptionStatus, encryptionCompliant}'",
    "curl -s $DiagnosticsUrl | jq '.checks.auth | {mode, status, configured, hardeningCompliant, recommendedMode, recommendedModeActive, twoFactorEnabled, operatorAuthEnabled, operatorAuthConfigured, legacyPasswordConfigured}'"
)

Add-ChecklistSection 'Wrapper canonico y corrida forzada'
Add-ChecklistBullet 'Si el wrapper no coincide o telemetryGap sigue true sin heads/dirty paths, reinstala el wrapper canonico antes de volver a diagnosticar.'
Add-ChecklistCommandBlock @(
    "install -m 0755 $CanonicalWrapperPath $WrapperPath",
    "/usr/bin/flock -n $LockPath $WrapperPath",
    "cat $StatusPath",
    "tail -n 50 $LogPath",
    "curl -s $DiagnosticsUrl | jq '.checks.publicSync | {state, healthy, operationallyHealthy, failureReason, currentHead, remoteHead, dirtyPathsCount}'"
)

Add-ChecklistSection 'Variables criticas del host'
Add-ChecklistBullet 'Valida presencia, no valores secretos. El objetivo es detectar misconfiguracion real del host.'
Add-ChecklistCommandBlock @(
    'php -r ''foreach (["PIELARMONIA_DATA_ENCRYPTION_KEY","PIELARMONIA_REQUIRE_DATA_ENCRYPTION","PIELARMONIA_OPERATOR_AUTH_MODE","PIELARMONIA_ADMIN_2FA_SECRET"] as $k) { $v = getenv($k); echo $k, "=", (($v === false || $v === "") ? "missing" : "set"), PHP_EOL; }''',
    "curl -s $DiagnosticsUrl | jq '{publicSync: .checks.publicSync, storage: .checks.storage, auth: .checks.auth}'"
)

Add-ChecklistSection 'Interpretacion rapida'
Add-ChecklistBullet 'wrapper_diff + telemetryGap=true: el host probablemente sigue ejecutando un wrapper stale o un entrypoint legacy.'
Add-ChecklistBullet 'failureReason=working_tree_dirty + dirtyPathsCount>0 + telemetryGap=false: el cron tiene suficiente telemetria; limpia drift tracked en el VPS antes de culpar al workflow.'
Add-ChecklistBullet 'currentHead != remoteHead: hay head drift real; no es solo working tree dirty.'
Add-ChecklistBullet 'encryptionStatus=plaintext o encryptionCompliant=false: falta configurar o aplicar PIELARMONIA_DATA_ENCRYPTION_KEY / PIELARMONIA_REQUIRE_DATA_ENCRYPTION en el host.'
Add-ChecklistBullet 'mode=legacy_password + twoFactorEnabled=false: auth sigue por debajo del baseline recomendado aunque el runtime este operativo.'
Add-ChecklistLine

Add-ChecklistSection 'Criterio de cierre'
Add-ChecklistBullet 'checks.publicSync.healthy=true'
Add-ChecklistBullet 'checks.publicSync.telemetryGap=false'
Add-ChecklistBullet 'checks.publicSync.currentHead y checks.publicSync.remoteHead presentes y alineados'
Add-ChecklistBullet 'checks.publicSync.dirtyPathsCount=0'
Add-ChecklistBullet 'checks.storage.encryptionCompliant=true'
Add-ChecklistBullet 'checks.storage.encryptionStatus != plaintext'
Add-ChecklistBullet 'checks.auth.configured=true'
Add-ChecklistLine

$output = $lines -join [Environment]::NewLine

if (-not [string]::IsNullOrWhiteSpace($OutputPath)) {
    $outputDir = Split-Path -Parent $OutputPath
    if (-not [string]::IsNullOrWhiteSpace($outputDir) -and -not (Test-Path -LiteralPath $outputDir)) {
        New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    }
    Set-Content -Path $OutputPath -Value $output -Encoding UTF8
    Write-Host "Checklist escrito en: $OutputPath"
}

Write-Output $output
