<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/totp.php';

/**
 * Session and authentication logic.
 */

const SESSION_TIMEOUT = 1800; // 30 minutos de inactividad
const OPERATOR_AUTH_SESSION_KEY = 'operator_auth';
const OPERATOR_AUTH_PENDING_CHALLENGE_KEY = 'operator_auth_pending_challenge_id';
const OPERATOR_AUTH_SOURCE = 'openclaw_chatgpt';

function start_secure_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = is_https_request();

    ini_set('session.use_only_cookies', '1');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $secure ? '1' : '0');

    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Strict'
        ]);
    } else {
        ini_set('session.cookie_samesite', 'Strict');
        session_set_cookie_params(0, '/; samesite=Strict', '', $secure, true);
    }

    session_start();

    $sessionTimeout = SESSION_TIMEOUT;
    if (function_exists('operator_auth_session_ttl_seconds')) {
        $sessionTimeout = max($sessionTimeout, operator_auth_session_ttl_seconds());
    }

    // Expirar sesion por inactividad
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity']) > $sessionTimeout) {
        destroy_secure_session();
        start_secure_session();
    }
    $_SESSION['last_activity'] = time();
}

function destroy_secure_session(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        if (PHP_VERSION_ID >= 70300) {
            setcookie(session_name(), '', [
                'expires' => time() - 42000,
                'path' => $params['path'] ?? '/',
                'domain' => $params['domain'] ?? '',
                'secure' => (bool) ($params['secure'] ?? false),
                'httponly' => (bool) ($params['httponly'] ?? true),
                'samesite' => 'Strict'
            ]);
        } else {
            setcookie(session_name(), '', time() - 42000, ($params['path'] ?? '/') . '; samesite=Strict', $params['domain'] ?? '', (bool) ($params['secure'] ?? false), (bool) ($params['httponly'] ?? true));
        }
    }

    session_destroy();
}

function verify_admin_password(string $password): bool
{
    $hash = getenv('PIELARMONIA_ADMIN_PASSWORD_HASH');
    if (is_string($hash) && $hash !== '') {
        return password_verify($password, $hash);
    }

    $plain = getenv('PIELARMONIA_ADMIN_PASSWORD');
    if (is_string($plain) && $plain !== '') {
        return hash_equals($plain, $password);
    }

    return false;
}

function admin_password_is_configured(): bool
{
    $hash = getenv('PIELARMONIA_ADMIN_PASSWORD_HASH');
    if (is_string($hash) && trim($hash) !== '') {
        return true;
    }

    $plain = getenv('PIELARMONIA_ADMIN_PASSWORD');
    return is_string($plain) && trim($plain) !== '';
}

function admin_two_factor_is_configured(): bool
{
    $secret = getenv('PIELARMONIA_ADMIN_2FA_SECRET');
    return is_string($secret) && trim($secret) !== '';
}

function internal_console_legacy_fallback_enabled(): bool
{
    $raw = getenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK');
    if (!is_string($raw)) {
        return false;
    }

    return in_array(strtolower(trim($raw)), ['1', 'true', 'yes', 'on'], true);
}

function internal_console_legacy_fallback_payload(): array
{
    $enabled = internal_console_legacy_fallback_enabled();
    $passwordConfigured = admin_password_is_configured();
    $twoFactorConfigured = admin_two_factor_is_configured();
    $configured = $passwordConfigured && $twoFactorConfigured;
    $available = $enabled && $configured;
    $reason = 'fallback_available';

    if (!$enabled) {
        $reason = 'fallback_disabled';
    } elseif (!$passwordConfigured) {
        $reason = 'admin_password_not_configured';
    } elseif (!$twoFactorConfigured) {
        $reason = 'admin_2fa_not_configured';
    }

    return [
        'enabled' => $enabled,
        'configured' => $configured,
        'requires2FA' => true,
        'available' => $available,
        'reason' => $reason,
    ];
}

function internal_console_auth_fallbacks_payload(): array
{
    return [
        'legacy_password' => internal_console_legacy_fallback_payload(),
    ];
}

function verify_2fa_code(string $code): bool
{
    $secret = getenv('PIELARMONIA_ADMIN_2FA_SECRET');
    if (!is_string($secret) || trim($secret) === '') {
        return false;
    }
    return TOTP::verify($secret, $code);
}

function legacy_admin_is_authenticated(): bool
{
    return isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

function operator_auth_mode(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_MODE');
    $mode = is_string($raw) && trim($raw) !== '' ? strtolower(trim($raw)) : 'disabled';
    return $mode === OPERATOR_AUTH_SOURCE ? OPERATOR_AUTH_SOURCE : 'disabled';
}

function operator_auth_session_ttl_seconds(): int
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS');
    $value = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : SESSION_TIMEOUT;
    return max(300, min(86400, $value));
}

function operator_auth_challenge_ttl_seconds(): int
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS');
    $value = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 300;
    return max(60, min(3600, $value));
}

function operator_auth_bridge_timestamp_skew_seconds(): int
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_MAX_SKEW_SECONDS');
    $value = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 300;
    return max(30, min(1800, $value));
}

function operator_auth_helper_base_url(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL');
    $url = is_string($raw) && trim($raw) !== '' ? trim($raw) : 'http://127.0.0.1:4173';
    return rtrim($url, '/');
}

function operator_auth_server_base_url(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL');
    if (is_string($raw) && trim($raw) !== '') {
        return rtrim(trim($raw), '/');
    }

    $host = isset($_SERVER['HTTP_HOST']) ? trim((string) $_SERVER['HTTP_HOST']) : '';
    if ($host === '') {
        return 'http://127.0.0.1';
    }

    $scheme = is_https_request() ? 'https' : 'http';
    return $scheme . '://' . $host;
}

function operator_auth_bridge_token(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN');
    return is_string($raw) ? trim($raw) : '';
}

function operator_auth_bridge_signature_secret(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET');
    $secret = is_string($raw) ? trim($raw) : '';
    if ($secret !== '') {
        return $secret;
    }

    return operator_auth_bridge_token();
}

function operator_auth_bridge_token_header(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER');
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Authorization';
}

function operator_auth_bridge_token_prefix(): string
{
    $raw = getenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX');
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Bearer';
}

function operator_auth_is_enabled(): bool
{
    return operator_auth_mode() === OPERATOR_AUTH_SOURCE;
}

function operator_auth_normalize_email(string $email): string
{
    return strtolower(trim($email));
}

function operator_auth_allowed_emails(): array
{
    $rawCandidates = [
        getenv('PIELARMONIA_OPERATOR_AUTH_ALLOWLIST'),
        getenv('PIELARMONIA_OPERATOR_AUTH_ALLOWED_EMAILS'),
        getenv('PIELARMONIA_ADMIN_EMAIL'),
    ];
    $emails = [];

    foreach ($rawCandidates as $raw) {
        if (!is_string($raw) || trim($raw) === '') {
            continue;
        }

        foreach (explode(',', $raw) as $item) {
            $email = operator_auth_normalize_email((string) $item);
            if ($email !== '') {
                $emails[] = $email;
            }
        }
    }

    return array_values(array_unique($emails));
}

function operator_auth_configuration_snapshot(): array
{
    $mode = operator_auth_mode();
    $enabled = operator_auth_is_enabled();
    $bridgeTokenConfigured = operator_auth_bridge_token() !== '';
    $bridgeSecretConfigured = operator_auth_bridge_signature_secret() !== '';
    $allowedEmails = operator_auth_allowed_emails();
    $missing = [];

    if (!$enabled) {
        $missing[] = 'mode';
    }
    if (!$bridgeTokenConfigured) {
        $missing[] = 'bridge_token';
    }
    if (!$bridgeSecretConfigured) {
        $missing[] = 'bridge_secret';
    }
    if (count($allowedEmails) === 0) {
        $missing[] = 'allowlist';
    }

    return [
        'mode' => $mode,
        'enabled' => $enabled,
        'configured' => $enabled && count($missing) === 0,
        'bridgeTokenConfigured' => $bridgeTokenConfigured,
        'bridgeSecretConfigured' => $bridgeSecretConfigured,
        'allowlistConfigured' => count($allowedEmails) > 0,
        'allowedEmails' => $allowedEmails,
        'allowedEmailCount' => count($allowedEmails),
        'helperBaseUrl' => operator_auth_helper_base_url(),
        'serverBaseUrl' => operator_auth_server_base_url(),
        'missing' => $missing,
    ];
}

function operator_auth_is_configured(): bool
{
    return operator_auth_is_enabled()
        && operator_auth_bridge_token() !== ''
        && operator_auth_bridge_signature_secret() !== ''
        && count(operator_auth_allowed_emails()) > 0;
}

function operator_auth_is_email_allowed(string $email): bool
{
    $normalized = operator_auth_normalize_email($email);
    if ($normalized === '') {
        return false;
    }

    return in_array($normalized, operator_auth_allowed_emails(), true);
}

function admin_agent_editorial_allowlist(): array
{
    $raw = getenv('PIELARMONIA_ADMIN_AGENT_EDITORIAL_ALLOWLIST');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $emails = [];
    foreach (preg_split('/[\s,;]+/', $raw) ?: [] as $item) {
        $email = operator_auth_normalize_email((string) $item);
        if ($email !== '') {
            $emails[] = $email;
        }
    }

    return array_values(array_unique($emails));
}

function admin_agent_has_editorial_access(): bool
{
    if (legacy_admin_is_authenticated()) {
        return true;
    }

    if (!operator_auth_is_authenticated()) {
        return false;
    }

    $allowlist = admin_agent_editorial_allowlist();
    if ($allowlist === []) {
        return true;
    }

    $identity = operator_auth_current_identity(false);
    if (!is_array($identity)) {
        return false;
    }

    $email = operator_auth_normalize_email((string) ($identity['email'] ?? ''));
    return $email !== '' && in_array($email, $allowlist, true);
}

function admin_agent_capabilities_payload(): array
{
    return [
        'adminAgent' => admin_agent_has_editorial_access(),
    ];
}

function operator_auth_challenge_dir(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'operator-auth' . DIRECTORY_SEPARATOR . 'challenges';
}

function operator_auth_ensure_storage(): bool
{
    $dir = operator_auth_challenge_dir();
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    ensure_data_htaccess(data_dir_path());
    ensure_data_htaccess(dirname($dir));
    ensure_data_htaccess($dir);

    return true;
}

function operator_auth_challenge_path(string $challengeId): string
{
    return operator_auth_challenge_dir() . DIRECTORY_SEPARATOR . $challengeId . '.json';
}

function operator_auth_is_valid_challenge_id(string $challengeId): bool
{
    return preg_match('/^[a-f0-9]{32}$/', $challengeId) === 1;
}

function operator_auth_now_iso(?int $ts = null): string
{
    return gmdate('c', $ts ?? time());
}

function operator_auth_session_id_hash(): string
{
    return hash('sha256', (string) session_id());
}

function operator_auth_write_json_file(string $path, array $payload): bool
{
    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if (!is_string($encoded) || $encoded === '') {
        return false;
    }

    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        return false;
    }

    $tmp = $path . '.' . substr(hash('sha256', uniqid('', true)), 0, 8) . '.tmp';
    $bytes = @file_put_contents($tmp, $encoded . PHP_EOL, LOCK_EX);
    if (!is_int($bytes)) {
        @unlink($tmp);
        return false;
    }

    if (@rename($tmp, $path)) {
        return true;
    }

    $copied = @copy($tmp, $path);
    @unlink($tmp);
    return $copied;
}

function operator_auth_read_challenge(string $challengeId): ?array
{
    if (!operator_auth_is_valid_challenge_id($challengeId)) {
        return null;
    }

    $path = operator_auth_challenge_path($challengeId);
    if (!is_file($path)) {
        return null;
    }

    $raw = @file_get_contents($path);
    $decoded = json_decode(is_string($raw) ? $raw : '', true);
    return is_array($decoded) ? $decoded : null;
}

function operator_auth_write_challenge(array $challenge): bool
{
    $challengeId = isset($challenge['challengeId']) ? (string) $challenge['challengeId'] : '';
    if (!operator_auth_is_valid_challenge_id($challengeId) || !operator_auth_ensure_storage()) {
        return false;
    }

    return operator_auth_write_json_file(operator_auth_challenge_path($challengeId), $challenge);
}

function operator_auth_mark_challenge(array $challenge, string $status, array $patch = []): array
{
    $next = array_merge($challenge, $patch);
    $next['status'] = $status;
    $next['updatedAt'] = operator_auth_now_iso();
    operator_auth_write_challenge($next);
    return $next;
}

function operator_auth_purge_expired_challenges(): void
{
    $dir = operator_auth_challenge_dir();
    if (!is_dir($dir)) {
        return;
    }

    $now = time();
    $retention = max(operator_auth_challenge_ttl_seconds(), 300) * 4;
    foreach ((array) glob($dir . DIRECTORY_SEPARATOR . '*.json') as $path) {
        $raw = @file_get_contents($path);
        $challenge = json_decode(is_string($raw) ? $raw : '', true);
        if (!is_array($challenge)) {
            @unlink($path);
            continue;
        }

        $expiresAt = isset($challenge['expiresAt']) ? strtotime((string) $challenge['expiresAt']) : false;
        $updatedAt = isset($challenge['updatedAt']) ? strtotime((string) $challenge['updatedAt']) : false;
        $isExpired = ($expiresAt !== false) ? ((int) $expiresAt) < $now : false;
        $isStale = ($updatedAt !== false) ? ((int) $updatedAt) < ($now - $retention) : false;

        if ($isExpired && (($challenge['status'] ?? '') === 'pending')) {
            $challenge['status'] = 'expired';
            $challenge['updatedAt'] = operator_auth_now_iso();
            operator_auth_write_challenge($challenge);
        }

        if ($isStale) {
            @unlink($path);
        }
    }
}

function operator_auth_manual_code(string $challengeId): string
{
    $normalized = strtoupper(substr($challengeId, 0, 6) . '-' . substr($challengeId, 6, 6));
    return trim($normalized, '-');
}

function operator_auth_build_helper_url(array $challenge): string
{
    $base = operator_auth_helper_base_url();
    $query = http_build_query([
        'challengeId' => (string) ($challenge['challengeId'] ?? ''),
        'nonce' => (string) ($challenge['nonce'] ?? ''),
        'serverBaseUrl' => operator_auth_server_base_url(),
        'manualCode' => (string) ($challenge['manualCode'] ?? ''),
    ]);

    return $base . '/resolve?' . $query;
}

function operator_auth_config_error_payload(): array
{
    $snapshot = operator_auth_configuration_snapshot();
    $missingLabels = [
        'mode' => 'PIELARMONIA_OPERATOR_AUTH_MODE',
        'bridge_token' => 'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN',
        'bridge_secret' => 'PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET',
        'allowlist' => 'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST',
    ];
    $missingItems = array_map(
        static fn (string $item): string => $missingLabels[$item] ?? $item,
        is_array($snapshot['missing'] ?? null) ? $snapshot['missing'] : []
    );
    $error = count($missingItems) > 0
        ? 'Configuracion incompleta de OpenClaw/ChatGPT. Falta: ' . implode(', ', $missingItems) . '.'
        : 'El acceso OpenClaw/ChatGPT no esta configurado en este entorno.';

    return [
        'ok' => true,
        'authenticated' => false,
        'status' => 'operator_auth_not_configured',
        'mode' => OPERATOR_AUTH_SOURCE,
        'configured' => false,
        'recommendedMode' => OPERATOR_AUTH_SOURCE,
        'capabilities' => [
            'adminAgent' => false,
        ],
        'fallbacks' => internal_console_auth_fallbacks_payload(),
        'configuration' => $snapshot,
        'error' => $error,
    ];
}

function operator_auth_challenge_public_payload(array $challenge): array
{
    return [
        'challengeId' => (string) ($challenge['challengeId'] ?? ''),
        'nonce' => (string) ($challenge['nonce'] ?? ''),
        'expiresAt' => (string) ($challenge['expiresAt'] ?? ''),
        'status' => (string) ($challenge['status'] ?? 'pending'),
        'manualCode' => (string) ($challenge['manualCode'] ?? ''),
        'helperUrl' => operator_auth_build_helper_url($challenge),
        'pollAfterMs' => 1200,
    ];
}

function operator_auth_authenticated_payload(array $operator, string $status = 'autenticado'): array
{
    return [
        'ok' => true,
        'authenticated' => true,
        'status' => $status,
        'mode' => operator_auth_mode(),
        'configured' => true,
        'recommendedMode' => OPERATOR_AUTH_SOURCE,
        'csrfToken' => generate_csrf_token(),
        'capabilities' => admin_agent_capabilities_payload(),
        'fallbacks' => internal_console_auth_fallbacks_payload(),
        'operator' => [
            'email' => (string) ($operator['email'] ?? ''),
            'profileId' => (string) ($operator['profileId'] ?? ''),
            'accountId' => (string) ($operator['accountId'] ?? ''),
            'source' => (string) ($operator['source'] ?? OPERATOR_AUTH_SOURCE),
            'authenticatedAt' => (string) ($operator['authenticatedAt'] ?? ''),
            'expiresAt' => (string) ($operator['expiresAt'] ?? ''),
        ],
    ];
}

function operator_auth_error_payload(array $challenge, string $status, string $error): array
{
    return [
        'ok' => true,
        'authenticated' => false,
        'status' => $status,
        'mode' => operator_auth_mode(),
        'configured' => true,
        'recommendedMode' => OPERATOR_AUTH_SOURCE,
        'capabilities' => [
            'adminAgent' => false,
        ],
        'fallbacks' => internal_console_auth_fallbacks_payload(),
        'error' => $error,
        'challenge' => operator_auth_challenge_public_payload($challenge),
    ];
}

function operator_auth_clear_session_state(): void
{
    unset($_SESSION[OPERATOR_AUTH_SESSION_KEY], $_SESSION[OPERATOR_AUTH_PENDING_CHALLENGE_KEY], $_SESSION['csrf_token']);
    unset($_SESSION['admin_logged_in'], $_SESSION['admin_partial_login'], $_SESSION['admin_partial_login_expires']);
}

function operator_auth_current_identity(bool $refreshTtl = true): ?array
{
    $raw = $_SESSION[OPERATOR_AUTH_SESSION_KEY] ?? null;
    if (!is_array($raw)) {
        return null;
    }

    $expiresAt = isset($raw['expiresAt']) ? strtotime((string) $raw['expiresAt']) : false;
    if (($expiresAt !== false) && ((int) $expiresAt) <= time()) {
        operator_auth_clear_session_state();
        return null;
    }

    if ($refreshTtl) {
        $raw['expiresAt'] = operator_auth_now_iso(time() + operator_auth_session_ttl_seconds());
        $_SESSION[OPERATOR_AUTH_SESSION_KEY] = $raw;
    }

    return $raw;
}

function operator_auth_is_authenticated(): bool
{
    return operator_auth_current_identity() !== null;
}

function operator_auth_establish_session(array $identity): array
{
    $email = operator_auth_normalize_email((string) ($identity['email'] ?? ''));
    if ($email === '') {
        throw new RuntimeException('No se pudo resolver el email del operador.', 400);
    }

    session_regenerate_id(true);
    $operator = [
        'email' => $email,
        'profileId' => trim((string) ($identity['profileId'] ?? '')),
        'accountId' => trim((string) ($identity['accountId'] ?? '')),
        'source' => OPERATOR_AUTH_SOURCE,
        'authenticatedAt' => operator_auth_now_iso(),
        'expiresAt' => operator_auth_now_iso(time() + operator_auth_session_ttl_seconds()),
    ];

    operator_auth_clear_session_state();
    $_SESSION[OPERATOR_AUTH_SESSION_KEY] = $operator;
    return $operator;
}

function operator_auth_map_error_code_to_status(string $errorCode): string
{
    $normalized = strtolower(trim($errorCode));
    return match ($normalized) {
        'email_no_permitido' => 'email_no_permitido',
        'challenge_expirado' => 'challenge_expirado',
        'openclaw_not_logged_in',
        'openclaw_oauth_missing',
        'openclaw_login_required' => 'openclaw_no_logueado',
        default => 'helper_no_disponible',
    };
}

function operator_auth_pending_challenge_id(): string
{
    $raw = $_SESSION[OPERATOR_AUTH_PENDING_CHALLENGE_KEY] ?? '';
    $challengeId = is_string($raw) ? trim($raw) : '';
    return operator_auth_is_valid_challenge_id($challengeId) ? $challengeId : '';
}

function operator_auth_create_challenge(): array
{
    if (!operator_auth_is_configured()) {
        return operator_auth_config_error_payload();
    }

    operator_auth_purge_expired_challenges();

    $currentChallengeId = operator_auth_pending_challenge_id();
    if ($currentChallengeId !== '') {
        $current = operator_auth_read_challenge($currentChallengeId);
        if (is_array($current) && (($current['status'] ?? '') === 'pending')) {
            operator_auth_mark_challenge($current, 'superseded');
        }
    }

    try {
        $challengeId = bin2hex(random_bytes(16));
        $nonce = bin2hex(random_bytes(16));
    } catch (Throwable $e) {
        $challengeId = substr(hash('sha256', uniqid('operator-auth', true)), 0, 32);
        $nonce = substr(hash('sha256', uniqid('operator-auth-nonce', true)), 0, 32);
    }

    $challenge = [
        'challengeId' => $challengeId,
        'nonce' => $nonce,
        'mode' => operator_auth_mode(),
        'status' => 'pending',
        'sessionIdHash' => operator_auth_session_id_hash(),
        'manualCode' => operator_auth_manual_code($challengeId),
        'createdAt' => operator_auth_now_iso(),
        'updatedAt' => operator_auth_now_iso(),
        'expiresAt' => operator_auth_now_iso(time() + operator_auth_challenge_ttl_seconds()),
        'serverBaseUrl' => operator_auth_server_base_url(),
    ];

    if (!operator_auth_write_challenge($challenge)) {
        return [
            'ok' => false,
            'authenticated' => false,
            'status' => 'operator_auth_storage_error',
            'mode' => operator_auth_mode(),
            'error' => 'No se pudo crear el challenge de autenticacion.',
        ];
    }

    $_SESSION[OPERATOR_AUTH_PENDING_CHALLENGE_KEY] = $challengeId;
    if (function_exists('audit_log_event')) {
        audit_log_event('operator_auth.started', [
            'challengeId' => $challengeId,
            'mode' => operator_auth_mode(),
        ]);
    }

    return [
        'ok' => true,
        'authenticated' => false,
        'status' => 'pending',
        'mode' => operator_auth_mode(),
        'challenge' => operator_auth_challenge_public_payload($challenge),
    ];
}

function operator_auth_bridge_signature_payload(array $payload): string
{
    $status = strtolower(trim((string) ($payload['status'] ?? 'completed')));
    $timestamp = trim((string) ($payload['timestamp'] ?? ''));
    $challengeId = trim((string) ($payload['challengeId'] ?? ''));
    $nonce = trim((string) ($payload['nonce'] ?? ''));
    $deviceId = trim((string) ($payload['deviceId'] ?? ''));

    if ($status === 'error') {
        return implode("\n", [
            $challengeId,
            $nonce,
            $status,
            trim((string) ($payload['errorCode'] ?? '')),
            trim((string) ($payload['error'] ?? '')),
            $deviceId,
            $timestamp,
        ]);
    }

    return implode("\n", [
        $challengeId,
        $nonce,
        $status,
        operator_auth_normalize_email((string) ($payload['email'] ?? '')),
        trim((string) ($payload['profileId'] ?? '')),
        trim((string) ($payload['accountId'] ?? '')),
        $deviceId,
        $timestamp,
    ]);
}

function operator_auth_validate_bridge_signature(array $payload): bool
{
    $secret = operator_auth_bridge_signature_secret();
    $signature = trim((string) ($payload['signature'] ?? ''));
    if ($secret === '' || $signature === '') {
        return false;
    }

    $expected = hash_hmac('sha256', operator_auth_bridge_signature_payload($payload), $secret);
    return hash_equals($expected, $signature);
}

function operator_auth_complete_from_bridge(array $payload): array
{
    operator_auth_purge_expired_challenges();

    $challengeId = trim((string) ($payload['challengeId'] ?? ''));
    $nonce = trim((string) ($payload['nonce'] ?? ''));
    $deviceId = trim((string) ($payload['deviceId'] ?? ''));
    $timestamp = trim((string) ($payload['timestamp'] ?? ''));
    $status = strtolower(trim((string) ($payload['status'] ?? 'completed')));

    if (!operator_auth_is_enabled()) {
        return ['payload' => operator_auth_config_error_payload(), 'status' => 503];
    }
    if (!operator_auth_is_valid_challenge_id($challengeId)) {
        return ['payload' => ['ok' => false, 'error' => 'challengeId invalido'], 'status' => 400];
    }
    if ($nonce === '' || $deviceId === '' || $timestamp === '') {
        return ['payload' => ['ok' => false, 'error' => 'Faltan campos obligatorios del bridge'], 'status' => 400];
    }

    $challenge = operator_auth_read_challenge($challengeId);
    if (!is_array($challenge)) {
        return ['payload' => ['ok' => false, 'error' => 'Challenge no encontrado'], 'status' => 404];
    }
    if (((string) ($challenge['nonce'] ?? '')) !== $nonce) {
        return ['payload' => ['ok' => false, 'error' => 'Nonce invalido'], 'status' => 400];
    }

    $expiresAt = isset($challenge['expiresAt']) ? strtotime((string) $challenge['expiresAt']) : false;
    if (($expiresAt !== false) && ((int) $expiresAt) <= time()) {
        operator_auth_mark_challenge($challenge, 'expired', [
            'errorCode' => 'challenge_expirado',
            'error' => 'El challenge ya expiro.',
        ]);
        return ['payload' => ['ok' => false, 'error' => 'Challenge expirado'], 'status' => 410];
    }

    if ((string) ($challenge['status'] ?? '') !== 'pending') {
        return ['payload' => ['ok' => false, 'error' => 'El challenge ya no acepta cambios'], 'status' => 409];
    }

    if (!operator_auth_validate_bridge_signature($payload)) {
        return ['payload' => ['ok' => false, 'error' => 'Firma del bridge invalida'], 'status' => 401];
    }

    $reportedAt = strtotime($timestamp);
    if ($reportedAt === false || abs(time() - (int) $reportedAt) > operator_auth_bridge_timestamp_skew_seconds()) {
        return ['payload' => ['ok' => false, 'error' => 'Timestamp del bridge fuera de ventana'], 'status' => 400];
    }

    $status = $status === 'error' ? 'error' : 'completed';
    if ($status === 'error') {
        $errorCode = trim((string) ($payload['errorCode'] ?? 'helper_no_disponible'));
        $errorMessage = trim((string) ($payload['error'] ?? 'El helper local no pudo completar la autenticacion.'));
        $updated = operator_auth_mark_challenge($challenge, 'error', [
            'errorCode' => $errorCode,
            'error' => $errorMessage,
            'deviceId' => $deviceId,
            'completedAt' => operator_auth_now_iso(),
            'bridgeTimestamp' => $timestamp,
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('operator_auth.denied', [
                'challengeId' => $challengeId,
                'deviceId' => $deviceId,
                'reason' => $errorCode,
            ]);
        }

        return [
            'payload' => [
                'ok' => true,
                'accepted' => true,
                'status' => operator_auth_map_error_code_to_status($errorCode),
                'challenge' => operator_auth_challenge_public_payload($updated),
            ],
            'status' => 202,
        ];
    }

    $email = operator_auth_normalize_email((string) ($payload['email'] ?? ''));
    $profileId = trim((string) ($payload['profileId'] ?? ''));
    $accountId = trim((string) ($payload['accountId'] ?? ''));

    if ($email === '' || $profileId === '') {
        $updated = operator_auth_mark_challenge($challenge, 'error', [
            'errorCode' => 'openclaw_email_missing',
            'error' => 'OpenClaw no expuso un email resoluble para este perfil.',
            'deviceId' => $deviceId,
            'completedAt' => operator_auth_now_iso(),
            'bridgeTimestamp' => $timestamp,
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('operator_auth.denied', [
                'challengeId' => $challengeId,
                'deviceId' => $deviceId,
                'reason' => 'openclaw_email_missing',
            ]);
        }

        return [
            'payload' => [
                'ok' => true,
                'accepted' => true,
                'status' => 'helper_no_disponible',
                'challenge' => operator_auth_challenge_public_payload($updated),
            ],
            'status' => 202,
        ];
    }

    if (!operator_auth_is_email_allowed($email)) {
        $updated = operator_auth_mark_challenge($challenge, 'denied', [
            'email' => $email,
            'profileId' => $profileId,
            'accountId' => $accountId,
            'deviceId' => $deviceId,
            'errorCode' => 'email_no_permitido',
            'error' => 'El email autenticado no esta autorizado para operar este panel.',
            'completedAt' => operator_auth_now_iso(),
            'bridgeTimestamp' => $timestamp,
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('operator_auth.denied', [
                'challengeId' => $challengeId,
                'email' => $email,
                'deviceId' => $deviceId,
                'reason' => 'email_no_permitido',
            ]);
        }

        return [
            'payload' => [
                'ok' => false,
                'accepted' => false,
                'status' => 'email_no_permitido',
                'error' => 'El email autenticado no esta autorizado para operar este panel.',
                'challenge' => operator_auth_challenge_public_payload($updated),
            ],
            'status' => 403,
        ];
    }

    $updated = operator_auth_mark_challenge($challenge, 'completed', [
        'email' => $email,
        'profileId' => $profileId,
        'accountId' => $accountId,
        'deviceId' => $deviceId,
        'completedAt' => operator_auth_now_iso(),
        'bridgeTimestamp' => $timestamp,
    ]);

    if (function_exists('audit_log_event')) {
        audit_log_event('operator_auth.completed', [
            'challengeId' => $challengeId,
            'email' => $email,
            'profileId' => $profileId,
            'deviceId' => $deviceId,
        ]);
    }

    return [
        'payload' => [
            'ok' => true,
            'accepted' => true,
            'status' => 'completed',
            'challenge' => operator_auth_challenge_public_payload($updated),
        ],
        'status' => 202,
    ];
}

function operator_auth_status_payload(): array
{
    if (!operator_auth_is_configured()) {
        return operator_auth_config_error_payload();
    }

    $current = operator_auth_current_identity();
    if (is_array($current)) {
        return operator_auth_authenticated_payload($current);
    }

    operator_auth_purge_expired_challenges();
    $challengeId = operator_auth_pending_challenge_id();
    if ($challengeId === '') {
        return [
            'ok' => true,
            'authenticated' => false,
            'status' => 'anonymous',
            'mode' => operator_auth_mode(),
            'configured' => true,
            'recommendedMode' => OPERATOR_AUTH_SOURCE,
            'capabilities' => [
                'adminAgent' => false,
            ],
            'fallbacks' => internal_console_auth_fallbacks_payload(),
        ];
    }

    $challenge = operator_auth_read_challenge($challengeId);
    if (!is_array($challenge)) {
        unset($_SESSION[OPERATOR_AUTH_PENDING_CHALLENGE_KEY]);
        return [
            'ok' => true,
            'authenticated' => false,
            'status' => 'anonymous',
            'mode' => operator_auth_mode(),
            'configured' => true,
            'recommendedMode' => OPERATOR_AUTH_SOURCE,
            'capabilities' => [
                'adminAgent' => false,
            ],
            'fallbacks' => internal_console_auth_fallbacks_payload(),
        ];
    }

    if (((string) ($challenge['sessionIdHash'] ?? '')) !== operator_auth_session_id_hash()) {
        return [
            'ok' => true,
            'authenticated' => false,
            'status' => 'anonymous',
            'mode' => operator_auth_mode(),
            'configured' => true,
            'recommendedMode' => OPERATOR_AUTH_SOURCE,
            'capabilities' => [
                'adminAgent' => false,
            ],
        ];
    }

    $status = (string) ($challenge['status'] ?? 'pending');
    if ($status === 'completed') {
        $operator = operator_auth_establish_session([
            'email' => (string) ($challenge['email'] ?? ''),
            'profileId' => (string) ($challenge['profileId'] ?? ''),
            'accountId' => (string) ($challenge['accountId'] ?? ''),
        ]);
        operator_auth_mark_challenge($challenge, 'consumed', [
            'consumedAt' => operator_auth_now_iso(),
        ]);
        return operator_auth_authenticated_payload($operator);
    }

    if ($status === 'denied' || $status === 'error' || $status === 'expired') {
        $mappedStatus = $status === 'denied'
            ? 'email_no_permitido'
            : operator_auth_map_error_code_to_status((string) ($challenge['errorCode'] ?? ''));
        if ($status === 'expired') {
            $mappedStatus = 'challenge_expirado';
        }

        return operator_auth_error_payload(
            $challenge,
            $mappedStatus,
            (string) ($challenge['error'] ?? 'No se pudo completar la autenticacion.')
        );
    }

    if ($status === 'consumed' || $status === 'superseded') {
        unset($_SESSION[OPERATOR_AUTH_PENDING_CHALLENGE_KEY]);
        return [
            'ok' => true,
            'authenticated' => false,
            'status' => 'anonymous',
            'mode' => operator_auth_mode(),
            'configured' => true,
            'recommendedMode' => OPERATOR_AUTH_SOURCE,
            'capabilities' => [
                'adminAgent' => false,
            ],
            'fallbacks' => internal_console_auth_fallbacks_payload(),
        ];
    }

    return [
        'ok' => true,
        'authenticated' => false,
        'status' => 'pending',
        'mode' => operator_auth_mode(),
        'configured' => true,
        'recommendedMode' => OPERATOR_AUTH_SOURCE,
        'capabilities' => [
            'adminAgent' => false,
        ],
        'fallbacks' => internal_console_auth_fallbacks_payload(),
        'challenge' => operator_auth_challenge_public_payload($challenge),
    ];
}

function operator_auth_logout_payload(): array
{
    $email = '';
    $current = operator_auth_current_identity(false);
    if (is_array($current)) {
        $email = (string) ($current['email'] ?? '');
    }

    operator_auth_clear_session_state();
    destroy_secure_session();

    if (function_exists('audit_log_event')) {
        audit_log_event('operator_auth.logout', [
            'email' => $email,
        ]);
    }

    return [
        'ok' => true,
        'authenticated' => false,
        'status' => 'logout',
        'mode' => operator_auth_mode(),
        'configured' => operator_auth_is_configured(),
        'recommendedMode' => OPERATOR_AUTH_SOURCE,
        'capabilities' => [
            'adminAgent' => false,
        ],
        'fallbacks' => internal_console_auth_fallbacks_payload(),
    ];
}

function resolve_request_header_value(string $headerName): string
{
    $normalized = strtoupper(str_replace('-', '_', $headerName));
    if ($normalized === 'AUTHORIZATION') {
        return trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? ''));
    }

    $serverKey = 'HTTP_' . $normalized;
    $received = trim((string) ($_SERVER[$serverKey] ?? ''));
    if ($received === '' && $normalized !== 'AUTHORIZATION') {
        $received = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
    }

    return $received;
}

function bearer_header_matches_expected_token(string $expected, string $headerName = 'Authorization', string $prefix = 'Bearer'): bool
{
    if ($expected === '') {
        return false;
    }

    $received = resolve_request_header_value($headerName);
    $normalized = trim($received);
    if ($normalized !== '' && preg_match('/^' . preg_quote($prefix, '/') . '\s+(.+)$/i', $normalized, $matches) === 1) {
        $normalized = trim((string) ($matches[1] ?? ''));
    }

    return $normalized !== '' && hash_equals($expected, $normalized);
}

function diagnostics_access_token(): string
{
    $candidates = [
        getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN'),
        getenv('PIELARMONIA_CRON_SECRET'),
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            return trim($candidate);
        }
    }

    return '';
}

function diagnostics_access_token_header(): string
{
    $raw = getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_HEADER');
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Authorization';
}

function diagnostics_access_token_prefix(): string
{
    $raw = getenv('PIELARMONIA_DIAGNOSTICS_ACCESS_TOKEN_PREFIX');
    return is_string($raw) && trim($raw) !== '' ? trim($raw) : 'Bearer';
}

function request_is_localhost(): bool
{
    $clientIp = '';
    if (function_exists('rate_limit_client_ip')) {
        $clientIp = trim((string) rate_limit_client_ip());
    }

    if ($clientIp === '') {
        $clientIp = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    }

    return $clientIp === '127.0.0.1' || $clientIp === '::1';
}

function diagnostics_request_authorized(array $context = []): bool
{
    if (array_key_exists('diagnosticsAuthorized', $context)) {
        return (bool) $context['diagnosticsAuthorized'];
    }

    if ((bool) ($context['isAdmin'] ?? false)) {
        return true;
    }

    if (defined('TESTING_ENV') && TESTING_ENV) {
        return true;
    }

    if (request_is_localhost()) {
        return true;
    }

    $expected = diagnostics_access_token();
    if ($expected === '') {
        return false;
    }

    return bearer_header_matches_expected_token(
        $expected,
        diagnostics_access_token_header(),
        diagnostics_access_token_prefix()
    );
}

function operator_auth_require_bridge_token(): void
{
    $expected = operator_auth_bridge_token();
    if ($expected === '') {
        json_response([
            'ok' => false,
            'error' => 'Operator auth bridge token no configurado',
        ], 503);
    }

    $headerName = operator_auth_bridge_token_header();
    $prefix = operator_auth_bridge_token_prefix();
    if (!bearer_header_matches_expected_token($expected, $headerName, $prefix)) {
        json_response([
            'ok' => false,
            'error' => 'No autorizado',
        ], 401);
    }
}
