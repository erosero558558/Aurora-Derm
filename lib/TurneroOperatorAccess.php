<?php

declare(strict_types=1);

require_once __DIR__ . '/TurneroClinicProfile.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/storage.php';

const TURNERO_OPERATOR_ACCESS_FILE = 'turnero-operator-access.json';
const TURNERO_OPERATOR_SESSION_KEY = 'turnero_operator_access';
const TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS = 8;
const TURNERO_OPERATOR_MIN_SESSION_TTL_HOURS = 1;
const TURNERO_OPERATOR_MAX_SESSION_TTL_HOURS = 24;
const TURNERO_OPERATOR_PIN_MIN_DIGITS = 4;
const TURNERO_OPERATOR_PIN_MAX_DIGITS = 8;
const TURNERO_OPERATOR_MODE = 'operator_pin';

function turnero_operator_access_file_path(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . TURNERO_OPERATOR_ACCESS_FILE;
}

function turnero_operator_access_now_iso(?int $timestamp = null): string
{
    return gmdate('c', $timestamp ?? time());
}

function turnero_operator_access_clinic_id(): string
{
    $profile = read_turnero_clinic_profile();
    return trim((string) ($profile['clinic_id'] ?? ''));
}

function turnero_operator_access_normalize_pin(string $pin): string
{
    return preg_replace('/\D+/', '', trim($pin)) ?? '';
}

function turnero_operator_access_pin_is_valid(string $pin): bool
{
    $length = strlen($pin);
    if ($length < TURNERO_OPERATOR_PIN_MIN_DIGITS || $length > TURNERO_OPERATOR_PIN_MAX_DIGITS) {
        return false;
    }

    return preg_match('/^\d+$/', $pin) === 1;
}

function turnero_operator_access_normalize_session_ttl_hours($value): int
{
    $ttl = (int) $value;
    if ($ttl <= 0) {
        $ttl = TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS;
    }

    return max(
        TURNERO_OPERATOR_MIN_SESSION_TTL_HOURS,
        min(TURNERO_OPERATOR_MAX_SESSION_TTL_HOURS, $ttl)
    );
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_access_default_store(): array
{
    return [
        'version' => 1,
        'records' => [],
    ];
}

function turnero_operator_access_normalize_iso_string(string $value): string
{
    $trimmed = trim($value);
    if ($trimmed === '') {
        return '';
    }

    return strtotime($trimmed) === false ? '' : $trimmed;
}

/**
 * @param array<string,mixed> $record
 * @return array<string,mixed>
 */
function turnero_operator_access_normalize_record(array $record, string $fallbackClinicId = ''): array
{
    $clinicId = trim((string) ($record['clinic_id'] ?? $fallbackClinicId));
    return [
        'clinic_id' => $clinicId,
        'pin_hash' => trim((string) ($record['pin_hash'] ?? '')),
        'pin_digits' => max(0, (int) ($record['pin_digits'] ?? 0)),
        'updated_at' => turnero_operator_access_normalize_iso_string((string) ($record['updated_at'] ?? '')),
        'rotated_at' => turnero_operator_access_normalize_iso_string((string) ($record['rotated_at'] ?? '')),
        'session_ttl_hours' => turnero_operator_access_normalize_session_ttl_hours(
            $record['session_ttl_hours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS
        ),
    ];
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_access_read_store(): array
{
    $path = turnero_operator_access_file_path();
    if (!is_file($path)) {
        return turnero_operator_access_default_store();
    }

    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return turnero_operator_access_default_store();
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return turnero_operator_access_default_store();
    }

    $records = is_array($decoded['records'] ?? null) ? $decoded['records'] : [];
    $normalizedRecords = [];
    foreach ($records as $clinicId => $record) {
        if (!is_array($record)) {
            continue;
        }

        $normalized = turnero_operator_access_normalize_record($record, is_string($clinicId) ? $clinicId : '');
        if ($normalized['clinic_id'] === '') {
            continue;
        }
        $normalizedRecords[$normalized['clinic_id']] = $normalized;
    }

    return [
        'version' => 1,
        'records' => $normalizedRecords,
    ];
}

/**
 * @param array<string,mixed> $store
 */
function turnero_operator_access_write_store(array $store): bool
{
    $normalizedStore = turnero_operator_access_default_store();
    $records = is_array($store['records'] ?? null) ? $store['records'] : [];
    foreach ($records as $clinicId => $record) {
        if (!is_array($record)) {
            continue;
        }
        $normalized = turnero_operator_access_normalize_record($record, is_string($clinicId) ? $clinicId : '');
        if ($normalized['clinic_id'] === '') {
            continue;
        }
        $normalizedStore['records'][$normalized['clinic_id']] = $normalized;
    }

    $path = turnero_operator_access_file_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }
    ensure_data_htaccess(data_dir_path());

    $json = json_encode($normalizedStore, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || $json === '') {
        return false;
    }

    $tmpPath = $path . '.tmp';
    if (@file_put_contents($tmpPath, $json . PHP_EOL, LOCK_EX) === false) {
        @unlink($tmpPath);
        return false;
    }

    if (@rename($tmpPath, $path)) {
        return true;
    }

    $copied = @copy($tmpPath, $path);
    @unlink($tmpPath);
    return $copied;
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_access_read_record(?string $clinicId = null): array
{
    $resolvedClinicId = trim((string) ($clinicId ?? turnero_operator_access_clinic_id()));
    if ($resolvedClinicId === '') {
        return [];
    }

    $store = turnero_operator_access_read_store();
    $records = is_array($store['records'] ?? null) ? $store['records'] : [];
    $record = $records[$resolvedClinicId] ?? null;
    if (!is_array($record)) {
        return [];
    }

    return turnero_operator_access_normalize_record($record, $resolvedClinicId);
}

function turnero_operator_access_is_configured(?string $clinicId = null): bool
{
    $record = turnero_operator_access_read_record($clinicId);
    return trim((string) ($record['clinic_id'] ?? '')) !== ''
        && trim((string) ($record['pin_hash'] ?? '')) !== '';
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_access_meta(?string $clinicId = null): array
{
    $resolvedClinicId = trim((string) ($clinicId ?? turnero_operator_access_clinic_id()));
    $record = turnero_operator_access_read_record($resolvedClinicId);
    $configured = trim((string) ($record['pin_hash'] ?? '')) !== '';
    $pinDigits = max(0, (int) ($record['pin_digits'] ?? 0));

    return [
        'mode' => TURNERO_OPERATOR_MODE,
        'clinicId' => $resolvedClinicId,
        'configured' => $configured,
        'pinSet' => $configured,
        'pinDigits' => $pinDigits,
        'maskedPinLabel' => $configured && $pinDigits > 0
            ? str_repeat('*', min($pinDigits, TURNERO_OPERATOR_PIN_MAX_DIGITS))
            : '',
        'updatedAt' => (string) ($record['updated_at'] ?? ''),
        'rotatedAt' => (string) ($record['rotated_at'] ?? ''),
        'sessionTtlHours' => (int) ($record['session_ttl_hours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS),
    ];
}

function turnero_operator_access_generate_pin(int $digits = 6): string
{
    $safeDigits = max(TURNERO_OPERATOR_PIN_MIN_DIGITS, min(TURNERO_OPERATOR_PIN_MAX_DIGITS, $digits));
    $max = (10 ** $safeDigits) - 1;
    $min = 10 ** ($safeDigits - 1);

    try {
        return (string) random_int($min, $max);
    } catch (\Throwable $th) {
        $value = '';
        while (strlen($value) < $safeDigits) {
            $value .= (string) mt_rand(0, 9);
        }
        if ($value[0] === '0') {
            $value[0] = (string) mt_rand(1, 9);
        }
        return substr($value, 0, $safeDigits);
    }
}

/**
 * @param array<string,mixed> $input
 * @return array<string,mixed>
 */
function turnero_operator_access_rotate(array $input = []): array
{
    $clinicId = trim((string) ($input['clinic_id'] ?? $input['clinicId'] ?? turnero_operator_access_clinic_id()));
    if ($clinicId === '') {
        throw new RuntimeException('No se pudo resolver la clínica activa del PIN operativo.', 400);
    }

    $providedPin = isset($input['pin']) ? turnero_operator_access_normalize_pin((string) $input['pin']) : '';
    $pin = $providedPin !== '' ? $providedPin : turnero_operator_access_generate_pin();
    if (!turnero_operator_access_pin_is_valid($pin)) {
        throw new RuntimeException('El PIN debe usar entre 4 y 8 dígitos numéricos.', 400);
    }

    $sessionTtlHours = turnero_operator_access_normalize_session_ttl_hours(
        $input['session_ttl_hours'] ?? $input['sessionTtlHours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS
    );
    $now = turnero_operator_access_now_iso();
    $record = [
        'clinic_id' => $clinicId,
        'pin_hash' => password_hash($pin, PASSWORD_DEFAULT),
        'pin_digits' => strlen($pin),
        'updated_at' => $now,
        'rotated_at' => $now,
        'session_ttl_hours' => $sessionTtlHours,
    ];

    $store = turnero_operator_access_read_store();
    $store['records'][$clinicId] = $record;
    if (!turnero_operator_access_write_store($store)) {
        throw new RuntimeException('No se pudo guardar el PIN operativo.', 503);
    }

    unset($_SESSION[TURNERO_OPERATOR_SESSION_KEY]);
    if (!legacy_admin_is_authenticated() && !operator_auth_is_authenticated()) {
        unset($_SESSION['csrf_token']);
    }

    return [
        'ok' => true,
        'status' => 'rotated',
        'mode' => TURNERO_OPERATOR_MODE,
        'pin' => $pin,
        'generated' => $providedPin === '',
        'turneroOperatorAccessMeta' => turnero_operator_access_meta($clinicId),
    ];
}

function turnero_operator_session_clear(): void
{
    unset($_SESSION[TURNERO_OPERATOR_SESSION_KEY]);

    if (!legacy_admin_is_authenticated() && !operator_auth_is_authenticated()) {
        unset($_SESSION['csrf_token']);
    }
}

/**
 * @return array<string,mixed>|null
 */
function turnero_operator_session_current(bool $refreshTtl = true): ?array
{
    $raw = $_SESSION[TURNERO_OPERATOR_SESSION_KEY] ?? null;
    if (!is_array($raw)) {
        return null;
    }

    $clinicId = trim((string) ($raw['clinicId'] ?? ''));
    $record = turnero_operator_access_read_record($clinicId);
    if ($clinicId === '' || trim((string) ($record['pin_hash'] ?? '')) === '') {
        turnero_operator_session_clear();
        return null;
    }

    $sessionRotatedAt = turnero_operator_access_normalize_iso_string((string) ($raw['rotatedAt'] ?? ''));
    $recordRotatedAt = turnero_operator_access_normalize_iso_string((string) ($record['rotated_at'] ?? ''));
    if ($recordRotatedAt !== '' && $sessionRotatedAt !== '' && $recordRotatedAt !== $sessionRotatedAt) {
        turnero_operator_session_clear();
        return null;
    }

    $expiresAt = strtotime((string) ($raw['expiresAt'] ?? ''));
    if ($expiresAt === false || ((int) $expiresAt) <= time()) {
        turnero_operator_session_clear();
        return null;
    }

    $session = [
        'clinicId' => $clinicId,
        'authenticatedAt' => turnero_operator_access_normalize_iso_string((string) ($raw['authenticatedAt'] ?? '')),
        'expiresAt' => turnero_operator_access_normalize_iso_string((string) ($raw['expiresAt'] ?? '')),
        'sessionTtlHours' => turnero_operator_access_normalize_session_ttl_hours(
            $raw['sessionTtlHours'] ?? $record['session_ttl_hours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS
        ),
        'source' => trim((string) ($raw['source'] ?? TURNERO_OPERATOR_MODE)),
        'rotatedAt' => $recordRotatedAt,
    ];

    if ($refreshTtl) {
        $session['expiresAt'] = turnero_operator_access_now_iso(
            time() + ((int) $session['sessionTtlHours'] * 3600)
        );
        $_SESSION[TURNERO_OPERATOR_SESSION_KEY] = $session;
    }

    return $session;
}

function turnero_operator_session_is_authenticated(): bool
{
    return turnero_operator_session_current() !== null;
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_session_status_payload(): array
{
    $session = turnero_operator_session_current();
    $meta = turnero_operator_access_meta();
    $authenticated = is_array($session);

    return [
        'ok' => true,
        'authenticated' => $authenticated,
        'status' => $authenticated ? 'authenticated' : ($meta['configured'] ? 'anonymous' : 'operator_pin_not_configured'),
        'mode' => TURNERO_OPERATOR_MODE,
        'recommendedMode' => TURNERO_OPERATOR_MODE,
        'configured' => (bool) ($meta['configured'] ?? false),
        'csrfToken' => $authenticated ? generate_csrf_token() : '',
        'capabilities' => [
            'adminAgent' => false,
        ],
        'operator' => $authenticated
            ? [
                'clinicId' => (string) ($session['clinicId'] ?? ''),
                'source' => (string) ($session['source'] ?? TURNERO_OPERATOR_MODE),
                'authenticatedAt' => (string) ($session['authenticatedAt'] ?? ''),
                'expiresAt' => (string) ($session['expiresAt'] ?? ''),
            ]
            : null,
        'turneroOperatorAccessMeta' => $meta,
        'error' => !$authenticated && !($meta['configured'] ?? false)
            ? 'El PIN operativo todavía no está configurado para esta clínica.'
            : '',
    ];
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_pin_status_payload(): array
{
    $payload = turnero_operator_session_status_payload();
    if ($payload['authenticated'] === true) {
        return $payload;
    }

    $payload['status'] = $payload['configured'] ? 'ready_for_login' : 'operator_pin_not_configured';
    return $payload;
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_login_payload(string $pin): array
{
    $normalizedPin = turnero_operator_access_normalize_pin($pin);
    if ($normalizedPin === '') {
        throw new RuntimeException('PIN requerido', 400);
    }

    $clinicId = turnero_operator_access_clinic_id();
    $record = turnero_operator_access_read_record($clinicId);
    if (trim((string) ($record['pin_hash'] ?? '')) === '') {
        throw new RuntimeException('El PIN operativo todavía no está configurado para esta clínica.', 503);
    }

    if (!password_verify($normalizedPin, (string) ($record['pin_hash'] ?? ''))) {
        throw new RuntimeException('PIN incorrecto', 401);
    }

    session_regenerate_id(true);
    $authenticatedAt = turnero_operator_access_now_iso();
    $sessionTtlHours = (int) ($record['session_ttl_hours'] ?? TURNERO_OPERATOR_DEFAULT_SESSION_TTL_HOURS);
    $_SESSION[TURNERO_OPERATOR_SESSION_KEY] = [
        'clinicId' => $clinicId,
        'authenticatedAt' => $authenticatedAt,
        'expiresAt' => turnero_operator_access_now_iso(time() + ($sessionTtlHours * 3600)),
        'sessionTtlHours' => $sessionTtlHours,
        'source' => TURNERO_OPERATOR_MODE,
        'rotatedAt' => (string) ($record['rotated_at'] ?? ''),
    ];

    return turnero_operator_session_status_payload();
}

/**
 * @return array<string,mixed>
 */
function turnero_operator_logout_payload(): array
{
    turnero_operator_session_clear();

    return [
        'ok' => true,
        'authenticated' => false,
        'status' => 'logout',
        'mode' => TURNERO_OPERATOR_MODE,
        'recommendedMode' => TURNERO_OPERATOR_MODE,
        'configured' => turnero_operator_access_is_configured(),
        'capabilities' => [
            'adminAgent' => false,
        ],
        'turneroOperatorAccessMeta' => turnero_operator_access_meta(),
    ];
}
