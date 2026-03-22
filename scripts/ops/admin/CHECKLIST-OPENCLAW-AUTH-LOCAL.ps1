param(
    [string]$ServerBaseUrl = 'https://pielarmonia.com',
    [string]$HelperBaseUrl = 'http://127.0.0.1:4173',
    [string]$RuntimeBaseUrl = 'http://127.0.0.1:4141',
    [ValidateSet('text', 'markdown')]
    [string]$Format = 'text',
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$base = $ServerBaseUrl.TrimEnd('/')
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
        Add-ChecklistLine '```powershell'
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
    Add-ChecklistLine '# Local Checklist - Operator Auth'
    Add-ChecklistLine
} else {
    Add-ChecklistLine 'LOCAL CHECKLIST - OPERATOR AUTH'
    Add-ChecklistLine
}

Add-ChecklistBullet "generatedAt: $generatedAt"
Add-ChecklistBullet "serverBaseUrl: $base"
Add-ChecklistBullet "helperBaseUrl: $HelperBaseUrl"
Add-ChecklistBullet "runtimeBaseUrl: $RuntimeBaseUrl"
Add-ChecklistLine

Add-ChecklistSection 'Variables locales'
Add-ChecklistBullet 'Valida presencia local sin imprimir secretos completos antes de abrir el helper.'
Add-ChecklistCommandBlock -Commands @(
    '$required = @("AURORADERM_OPERATOR_AUTH_MODE","AURORADERM_OPERATOR_AUTH_SERVER_BASE_URL","AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL","AURORADERM_OPERATOR_AUTH_BRIDGE_TOKEN","AURORADERM_OPERATOR_AUTH_BRIDGE_SECRET","OPENCLAW_RUNTIME_BASE_URL")',
    '$required | ForEach-Object { $value = [Environment]::GetEnvironmentVariable($_, "Process"); if ([string]::IsNullOrWhiteSpace($value)) { $value = [Environment]::GetEnvironmentVariable($_, "User") }; if ([string]::IsNullOrWhiteSpace($value)) { "{0}=missing" -f $_ } else { "{0}=set" -f $_ } }',
    '$env:AURORADERM_OPERATOR_AUTH_SERVER_BASE_URL = "' + $base + '"',
    '$env:AURORADERM_OPERATOR_AUTH_HELPER_BASE_URL = "' + $HelperBaseUrl + '"',
    '$env:OPENCLAW_RUNTIME_BASE_URL = "' + $RuntimeBaseUrl + '"'
)

Add-ChecklistSection 'Preflight local'
Add-ChecklistBullet 'El preflight debe devolver nextAction claro antes de abrir el admin.'
Add-ChecklistCommandBlock -Commands @(
    'npm run openclaw:auth-preflight -- --json',
    'npm run openclaw:auth:start'
)

Add-ChecklistSection 'Estado del servidor'
Add-ChecklistBullet 'Confirma que el servidor ya publica el contrato OpenClaw antes de iniciar el smoke manual.'
Add-ChecklistCommandBlock -Commands @(
    'curl.exe -s "' + $base + '/api.php?resource=operator-auth-status"',
    'curl.exe -s "' + $base + '/admin-auth.php?action=status"'
)

Add-ChecklistSection 'Smoke manual del operador'
Add-ChecklistBullet 'El shell no debe renderizar password ni 2FA cuando mode=google_oauth.'
Add-ChecklistCommandBlock -Commands @(
    'Start-Process "' + $base + '/admin.html"',
    '# En el panel: click en "Continuar con OpenClaw"',
    '# Verifica que aparezcan manualCode, expiracion y estado pending',
    '# Completa login local en la ventana helper si OpenClaw aun no tiene sesion',
    '# Espera a que admin-auth.php?action=status pase a autenticado'
)

Add-ChecklistSection 'Diagnostico rapido'
Add-ChecklistBullet 'Usa estas respuestas para distinguir fallo local del laptop vs. falta de config en el servidor.'
Add-ChecklistCommandBlock -Commands @(
    'curl.exe -s "' + $base + '/admin-auth.php?action=status" | jq ".mode, .status, .authenticated"',
    'curl.exe -s "' + $base + '/api.php?resource=operator-auth-status" | jq ".mode, .status, .configured"',
    'node agent-orchestrator.js runtime verify pilot_runtime --json'
)

Add-ChecklistSection 'Interpretacion rapida'
Add-ChecklistBullet 'preflight ok=false: falta bridge local o el runtime OpenClaw no responde en el laptop.'
Add-ChecklistBullet 'preflight ok=true + readyForLogin=false: el helper puede correr, pero el operador aun no inicio sesion OpenClaw.'
Add-ChecklistBullet 'status=operator_auth_not_configured o mode=disabled: el bloqueo real esta en el servidor, no en el helper local.'
Add-ChecklistBullet 'admin-auth status=anonymous con mode=google_oauth: el servidor esta listo y falta iniciar challenge desde el panel.'
Add-ChecklistBullet 'admin-auth status=pending: el challenge ya existe y el helper o el operador aun no completan el bridge.'
Add-ChecklistBullet 'admin-auth status=autenticado: el login OpenClaw quedo operativo.'
Add-ChecklistLine

Add-ChecklistSection 'Criterio de cierre'
Add-ChecklistBullet 'AURORADERM_OPERATOR_AUTH_MODE=google_oauth'
Add-ChecklistBullet 'openclaw:auth-preflight -> ok=true'
Add-ChecklistBullet 'openclaw:auth-preflight -> readyForLogin=true o nextAction explicita de login pendiente'
Add-ChecklistBullet 'api.php?resource=operator-auth-status -> configured=true'
Add-ChecklistBullet 'admin-auth.php?action=status -> mode=google_oauth'
Add-ChecklistBullet 'admin.html no muestra password ni 2FA'
Add-ChecklistBullet 'El panel llega a status=autenticado con email allowlisted'
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
