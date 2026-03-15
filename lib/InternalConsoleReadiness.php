<?php

declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/storage.php';

function internal_console_primary_auth_mode(): string
{
    $raw = getenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY');
    if (is_string($raw) && trim($raw) !== '') {
        $normalized = strtolower(trim($raw));
        if (in_array($normalized, ['legacy_password', 'legacy', 'password'], true)) {
            return 'legacy_password';
        }
        if (in_array($normalized, [OPERATOR_AUTH_SOURCE, 'openclaw', 'openclaw_chatgpt'], true)) {
            return OPERATOR_AUTH_SOURCE;
        }
    }

    return OPERATOR_AUTH_SOURCE;
}

function internal_console_prefers_openclaw_auth(): bool
{
    return internal_console_primary_auth_mode() === OPERATOR_AUTH_SOURCE;
}

function internal_console_allows_legacy_password_auth(): bool
{
    if (internal_console_primary_auth_mode() === 'legacy_password') {
        return true;
    }

    $fallback = function_exists('internal_console_legacy_fallback_payload')
        ? internal_console_legacy_fallback_payload()
        : ['available' => false];

    return (bool) ($fallback['available'] ?? false);
}

function internal_console_readiness_snapshot(): array
{
    $authSnapshot = function_exists('operator_auth_configuration_snapshot')
        ? operator_auth_configuration_snapshot()
        : [
            'mode' => function_exists('operator_auth_mode') ? operator_auth_mode() : 'disabled',
            'enabled' => function_exists('operator_auth_is_enabled') ? operator_auth_is_enabled() : false,
            'configured' => function_exists('operator_auth_is_configured') ? operator_auth_is_configured() : false,
            'missing' => [],
            'allowedEmailCount' => 0,
            'brokerTrustConfigured' => false,
            'brokerIssuerPinned' => false,
            'brokerAudiencePinned' => false,
            'brokerJwksConfigured' => false,
            'brokerEmailVerifiedRequired' => true,
            'helperBaseUrl' => '',
            'serverBaseUrl' => '',
        ];

    $storageBackend = function_exists('storage_backend_mode') ? storage_backend_mode() : 'unknown';
    $storeEncrypted = function_exists('store_file_is_encrypted') ? store_file_is_encrypted() : false;
    $encryptionConfigured = function_exists('storage_encryption_configured')
        ? storage_encryption_configured()
        : false;
    $encryptionRequired = function_exists('storage_encryption_required')
        ? storage_encryption_required()
        : false;
    $encryptionStatus = function_exists('storage_encryption_status')
        ? storage_encryption_status()
        : ($storeEncrypted ? 'encrypted' : 'plaintext');
    $encryptionCompliant = function_exists('storage_encryption_compliant')
        ? storage_encryption_compliant()
        : (!$encryptionRequired || $storeEncrypted);
    $sqliteDriverAvailable = function_exists('storage_sqlite_available')
        ? storage_sqlite_available()
        : false;
    $jsonFallbackEnabled = function_exists('storage_json_fallback_enabled')
        ? storage_json_fallback_enabled()
        : false;

    $authReady = (bool) ($authSnapshot['configured'] ?? false)
        && (string) ($authSnapshot['mode'] ?? 'disabled') === OPERATOR_AUTH_SOURCE;
    $clinicalDataReady = $encryptionCompliant;
    $blockers = [];

    if (!$authReady) {
        $missing = is_array($authSnapshot['missing'] ?? null) ? $authSnapshot['missing'] : [];
        $detail = count($missing) > 0
            ? 'Falta configurar ' . implode(', ', $missing) . '.'
            : 'OpenClaw auth no esta listo en este entorno.';
        $blockers[] = [
            'code' => 'operator_auth',
            'title' => 'Acceso OpenClaw no listo',
            'detail' => $detail,
        ];
    }

    if (!$clinicalDataReady) {
        $blockers[] = [
            'code' => 'clinical_storage',
            'title' => 'Historias clinicas no aptas',
            'detail' => $storageBackend === 'json_fallback'
                ? 'El almacenamiento clinico requiere cifrado antes de uso real.'
                : 'El almacenamiento clinico no cumple el gate de seguridad.',
        ];
    }

    $overallReady = count($blockers) === 0;
    $overallStatus = $overallReady ? 'pilot_ready' : 'pilot_blocked';
    $summary = $overallReady
        ? 'Nucleo interno listo para piloto de consultorio.'
        : 'Piloto interno bloqueado hasta cerrar auth OpenClaw y/o cifrado clinico.';

    return [
        'mode' => 'consultorio_core',
        'pilotOnly' => true,
        'publicWebPaused' => true,
        'auth' => [
            'primaryMode' => internal_console_primary_auth_mode(),
            'requiredMode' => OPERATOR_AUTH_SOURCE,
            'mode' => (string) ($authSnapshot['mode'] ?? 'disabled'),
            'transport' => (string) ($authSnapshot['transport'] ?? ''),
            'enabled' => (bool) ($authSnapshot['enabled'] ?? false),
            'configured' => (bool) ($authSnapshot['configured'] ?? false),
            'ready' => $authReady,
            'legacyPasswordEnabled' => internal_console_allows_legacy_password_auth(),
            'missing' => is_array($authSnapshot['missing'] ?? null) ? $authSnapshot['missing'] : [],
            'allowedEmailCount' => (int) ($authSnapshot['allowedEmailCount'] ?? 0),
            'brokerTrustConfigured' => (bool) ($authSnapshot['brokerTrustConfigured'] ?? false),
            'brokerIssuerPinned' => (bool) ($authSnapshot['brokerIssuerPinned'] ?? false),
            'brokerAudiencePinned' => (bool) ($authSnapshot['brokerAudiencePinned'] ?? false),
            'brokerJwksConfigured' => (bool) ($authSnapshot['brokerJwksConfigured'] ?? false),
            'brokerEmailVerifiedRequired' => (bool) ($authSnapshot['brokerEmailVerifiedRequired'] ?? true),
            'helperBaseUrl' => (string) ($authSnapshot['helperBaseUrl'] ?? ''),
            'serverBaseUrl' => (string) ($authSnapshot['serverBaseUrl'] ?? ''),
        ],
        'clinicalData' => [
            'backend' => $storageBackend,
            'storeEncrypted' => $storeEncrypted,
            'encryptionConfigured' => $encryptionConfigured,
            'encryptionRequired' => $encryptionRequired,
            'encryptionStatus' => $encryptionStatus,
            'encryptionCompliant' => $encryptionCompliant,
            'sqliteDriverAvailable' => $sqliteDriverAvailable,
            'jsonFallbackEnabled' => $jsonFallbackEnabled,
            'ready' => $clinicalDataReady,
        ],
        'patientFlow' => [
            'enabled' => true,
            'blocked' => !$clinicalDataReady,
            'status' => $clinicalDataReady ? 'ready' : 'blocked',
        ],
        'overall' => [
            'ready' => $overallReady,
            'status' => $overallStatus,
            'summary' => $summary,
            'blockers' => $blockers,
        ],
    ];
}

function internal_console_clinical_data_ready(?array $snapshot = null): bool
{
    $snapshot = is_array($snapshot) ? $snapshot : internal_console_readiness_snapshot();
    return (bool) ($snapshot['clinicalData']['ready'] ?? true);
}

function internal_console_clinical_guard_payload(array $extra = []): array
{
    $snapshot = internal_console_readiness_snapshot();
    $blockers = is_array($snapshot['overall']['blockers'] ?? null)
        ? $snapshot['overall']['blockers']
        : [];
    $primaryBlocker = null;
    foreach ($blockers as $blocker) {
        if (!is_array($blocker)) {
            continue;
        }
        if (($blocker['code'] ?? '') === 'clinical_storage') {
            $primaryBlocker = $blocker;
            break;
        }
        if ($primaryBlocker === null) {
            $primaryBlocker = $blocker;
        }
    }

    $error = trim((string) (
        $primaryBlocker['detail']
        ?? $snapshot['overall']['summary']
        ?? 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.'
    ));

    return array_merge([
        'ok' => false,
        'code' => 'clinical_storage_not_ready',
        'error' => $error !== ''
            ? $error
            : 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
        'readiness' => $snapshot,
    ], $extra);
}
