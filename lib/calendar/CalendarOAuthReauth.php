<?php

declare(strict_types=1);

require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/GoogleTokenProvider.php';
require_once __DIR__ . '/GoogleCalendarClient.php';

final class CalendarOAuthReauth
{
    private const KIND = 'calendar_oauth_reauth';
    private const STATE_PREFIX = 'calendar-reauth';

    public static function isConfigured(): bool
    {
        return operator_auth_google_client_id() !== ''
            && operator_auth_google_client_secret() !== ''
            && operator_auth_google_redirect_uri() !== ''
            && count(operator_auth_allowed_emails()) > 0;
    }

    public static function create(): array
    {
        if (!self::isConfigured()) {
            return self::configErrorPayload();
        }

        self::purgeExpiredChallenges();

        $challengeId = operator_auth_random_hex(16);
        $nonce = operator_auth_random_hex(16);
        $pkceVerifier = operator_auth_base64url_encode(self::randomBinary(48));
        $challenge = [
            'challengeId' => $challengeId,
            'kind' => self::KIND,
            'status' => 'pending',
            'nonce' => $nonce,
            'state' => self::buildState($challengeId),
            'pkceVerifier' => $pkceVerifier,
            'pkceChallenge' => self::pkceChallenge($pkceVerifier),
            'createdAt' => self::nowIso(),
            'updatedAt' => self::nowIso(),
            'expiresAt' => self::nowIso(time() + 600),
            'envPath' => self::primaryEnvFilePath(),
            'nextAction' => 'Completa el consentimiento en Google para emitir un nuevo refresh token de Calendar.',
        ];
        $challenge['authUrl'] = self::buildAuthUrl($challenge);

        if (!self::writeChallenge($challenge)) {
            return [
                'ok' => false,
                'status' => 'calendar_oauth_reauth_storage_error',
                'error' => 'No se pudo persistir el challenge de reautorizacion.',
            ];
        }

        self::writeLastResult(self::publicPayload($challenge));
        if (function_exists('audit_log_event')) {
            audit_log_event('calendar.reauth.started', [
                'challengeId' => $challengeId,
                'redirectUri' => operator_auth_google_redirect_uri(),
            ]);
        }

        return [
            'ok' => true,
            'status' => 'pending',
            'challenge' => self::publicPayload($challenge),
        ];
    }

    public static function statusPayload(string $challengeId): array
    {
        self::purgeExpiredChallenges();
        if (!self::isValidChallengeId($challengeId)) {
            return [
                'ok' => false,
                'status' => 'calendar_oauth_reauth_bad_request',
                'error' => 'challengeId invalido',
            ];
        }

        $challenge = self::readChallenge($challengeId);
        if (!is_array($challenge)) {
            return [
                'ok' => false,
                'status' => 'calendar_oauth_reauth_not_found',
                'error' => 'Challenge no encontrado',
            ];
        }

        return [
            'ok' => true,
            'status' => (string) ($challenge['status'] ?? 'pending'),
            'challenge' => self::publicPayload($challenge),
        ];
    }

    public static function isCallbackQuery(array $query): bool
    {
        return self::extractChallengeIdFromState((string) ($query['state'] ?? '')) !== '';
    }

    public static function completeCallback(array $query): ?array
    {
        if (!self::isCallbackQuery($query)) {
            return null;
        }

        self::purgeExpiredChallenges();
        $challengeId = self::extractChallengeIdFromState((string) ($query['state'] ?? ''));
        $challenge = self::readChallenge($challengeId);
        if (!is_array($challenge)) {
            return self::callbackPage(
                'Challenge no encontrado',
                'No se encontro el challenge de reautorizacion. Inicia uno nuevo desde la terminal.',
                'warning',
                'missing'
            );
        }

        $status = (string) ($challenge['status'] ?? 'pending');
        if ($status !== 'pending') {
            return self::callbackPage(
                $status === 'completed' ? 'Reautorizacion ya aplicada' : 'Intento ya procesado',
                $status === 'completed'
                    ? 'El refresh token de Google Calendar ya fue renovado para este challenge.'
                    : 'Este challenge ya no acepta cambios. Genera uno nuevo desde la terminal si hace falta.',
                $status === 'completed' ? 'success' : 'warning',
                $status
            );
        }

        $expiresAt = isset($challenge['expiresAt']) ? strtotime((string) $challenge['expiresAt']) : false;
        if ($expiresAt !== false && ((int) $expiresAt) <= time()) {
            self::markChallenge($challenge, 'expired', [
                'errorCode' => 'challenge_expired',
                'error' => 'El challenge de reautorizacion expiro antes de completarse.',
            ]);
            return self::callbackError(
                $challenge,
                'challenge_expired',
                'El challenge de reautorizacion expiro antes de completarse.',
                'Challenge expirado'
            );
        }

        $providerError = trim((string) ($query['error'] ?? ''));
        if ($providerError !== '') {
            $description = trim((string) ($query['error_description'] ?? ''));
            $message = $providerError === 'access_denied'
                ? 'La autorizacion en Google se cancelo antes de emitir un nuevo refresh token.'
                : ($description !== '' ? $description : 'Google devolvio un error durante la reautorizacion.');
            return self::callbackError(
                $challenge,
                $providerError === 'access_denied' ? 'google_oauth_cancelled' : 'google_oauth_error',
                $message,
                $providerError === 'access_denied' ? 'Autorizacion cancelada' : 'No se pudo renovar Google Calendar'
            );
        }

        $code = trim((string) ($query['code'] ?? ''));
        if ($code === '') {
            return self::callbackError(
                $challenge,
                'google_code_missing',
                'Google no devolvio el codigo necesario para emitir un nuevo refresh token.'
            );
        }

        $tokenResponse = operator_auth_google_exchange_code($challenge, $code);
        $tokenBody = is_array($tokenResponse['body'] ?? null) ? $tokenResponse['body'] : [];
        $refreshToken = trim((string) ($tokenBody['refresh_token'] ?? ''));
        $idToken = trim((string) ($tokenBody['id_token'] ?? ''));
        if (!($tokenResponse['ok'] ?? false) || $refreshToken === '' || $idToken === '') {
            $providerMessage = trim((string) ($tokenBody['error_description'] ?? $tokenBody['error'] ?? ''));
            if ($refreshToken === '' && ($tokenResponse['ok'] ?? false) === true) {
                $providerMessage = 'Google no devolvio refresh_token. Repite el consentimiento con la cuenta operativa.';
            }
            return self::callbackError(
                $challenge,
                $refreshToken === '' ? 'google_refresh_token_missing' : 'google_token_exchange_failed',
                $providerMessage !== '' ? $providerMessage : 'No se pudo intercambiar el codigo temporal con Google.'
            );
        }

        $tokenInfoResponse = operator_auth_google_validate_id_token($idToken);
        $tokenInfo = is_array($tokenInfoResponse['body'] ?? null) ? $tokenInfoResponse['body'] : [];
        if (!($tokenInfoResponse['ok'] ?? false) || $tokenInfo === []) {
            $providerMessage = trim((string) ($tokenInfo['error_description'] ?? $tokenInfo['error'] ?? ''));
            return self::callbackError(
                $challenge,
                'google_id_token_invalid',
                $providerMessage !== '' ? $providerMessage : 'No se pudo validar la identidad devuelta por Google.'
            );
        }

        $email = operator_auth_normalize_email((string) ($tokenInfo['email'] ?? ''));
        $emailVerified = filter_var($tokenInfo['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($email === '' || !$emailVerified || !operator_auth_is_email_allowed($email)) {
            return self::callbackError(
                $challenge,
                'email_no_permitido',
                'La cuenta Google usada para renovar Calendar no esta autorizada para operar este panel.',
                'Cuenta no autorizada'
            );
        }

        $envUpdate = self::updateEnvRefreshToken($refreshToken);
        if (($envUpdate['ok'] ?? false) !== true) {
            return self::callbackError(
                $challenge,
                trim((string) ($envUpdate['reason'] ?? 'env_update_failed')),
                'No se pudo actualizar env.php con el nuevo refresh token de Google Calendar.'
            );
        }

        putenv('PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN=' . $refreshToken);
        self::clearGoogleCache();
        $validation = self::validateGoogleToken();

        $updated = self::markChallenge($challenge, 'completed', [
            'completedAt' => self::nowIso(),
            'email' => $email,
            'maskedRefreshToken' => self::maskSecret($refreshToken),
            'envUpdated' => true,
            'envPath' => (string) ($envUpdate['envPath'] ?? self::primaryEnvFilePath()),
            'envBackupPath' => (string) ($envUpdate['envBackupPath'] ?? ''),
            'tokenValidated' => (bool) ($validation['ok'] ?? false),
            'tokenValidationReason' => (string) ($validation['reason'] ?? ''),
            'calendarProbeOk' => (bool) ($validation['calendarProbeOk'] ?? false),
            'calendarProbeReason' => (string) ($validation['calendarProbeReason'] ?? ''),
            'nextAction' => (($validation['ok'] ?? false) === true)
                ? 'La credencial de Google Calendar fue renovada. Verifica health y monitor de produccion.'
                : 'El refresh token fue renovado pero la validacion posterior sigue fallando. Revisa monitor y logs.',
        ]);

        if (function_exists('audit_log_event')) {
            audit_log_event('calendar.reauth.completed', [
                'challengeId' => (string) ($challenge['challengeId'] ?? ''),
                'email' => $email,
                'tokenValidated' => (bool) ($validation['ok'] ?? false),
                'calendarProbeOk' => (bool) ($validation['calendarProbeOk'] ?? false),
                'calendarProbeReason' => (string) ($validation['calendarProbeReason'] ?? ''),
            ]);
        }

        $message = (($validation['ok'] ?? false) === true)
            ? 'Google Calendar emitio un nuevo refresh token y ya quedo aplicado en env.php.'
            : 'Google Calendar emitio un nuevo refresh token y se aplico en env.php, pero la validacion posterior sigue degradada.';
        if (trim((string) ($validation['calendarProbeReason'] ?? '')) !== '') {
            $message .= ' Probe: ' . trim((string) $validation['calendarProbeReason']) . '.';
        }

        return [
            'status' => 200,
            'title' => 'Google Calendar reautorizado',
            'message' => $message,
            'tone' => (($validation['ok'] ?? false) === true) ? 'success' : 'warning',
            'redirectUrl' => rtrim(operator_auth_server_base_url(), '/') . '/admin.html?calendarReauth=ok',
            'challenge' => self::publicPayload($updated),
        ];
    }

    private static function configErrorPayload(): array
    {
        $missing = [];
        if (operator_auth_google_client_id() === '') {
            $missing[] = 'google_client_id';
        }
        if (operator_auth_google_client_secret() === '') {
            $missing[] = 'google_client_secret';
        }
        if (operator_auth_google_redirect_uri() === '') {
            $missing[] = 'google_redirect_uri';
        }
        if (count(operator_auth_allowed_emails()) === 0) {
            $missing[] = 'operator_auth_allowlist';
        }

        return [
            'ok' => false,
            'status' => 'calendar_oauth_reauth_not_configured',
            'error' => 'La reautorizacion de Google Calendar no esta configurada en este entorno.',
            'missing' => $missing,
        ];
    }

    private static function publicPayload(array $challenge): array
    {
        return [
            'challengeId' => (string) ($challenge['challengeId'] ?? ''),
            'status' => (string) ($challenge['status'] ?? 'pending'),
            'authUrl' => (string) ($challenge['authUrl'] ?? ''),
            'expiresAt' => (string) ($challenge['expiresAt'] ?? ''),
            'updatedAt' => (string) ($challenge['updatedAt'] ?? ''),
            'email' => (string) ($challenge['email'] ?? ''),
            'errorCode' => (string) ($challenge['errorCode'] ?? ''),
            'error' => (string) ($challenge['error'] ?? ''),
            'envUpdated' => (bool) ($challenge['envUpdated'] ?? false),
            'envPath' => (string) ($challenge['envPath'] ?? ''),
            'envBackupPath' => (string) ($challenge['envBackupPath'] ?? ''),
            'tokenValidated' => (bool) ($challenge['tokenValidated'] ?? false),
            'tokenValidationReason' => (string) ($challenge['tokenValidationReason'] ?? ''),
            'calendarProbeOk' => (bool) ($challenge['calendarProbeOk'] ?? false),
            'calendarProbeReason' => (string) ($challenge['calendarProbeReason'] ?? ''),
            'maskedRefreshToken' => (string) ($challenge['maskedRefreshToken'] ?? ''),
            'completedAt' => (string) ($challenge['completedAt'] ?? ''),
            'pollAfterMs' => 2000,
            'nextAction' => (string) ($challenge['nextAction'] ?? ''),
        ];
    }

    private static function callbackPage(string $title, string $message, string $tone, string $status): array
    {
        return [
            'status' => 200,
            'title' => $title,
            'message' => $message,
            'tone' => $tone,
            'redirectUrl' => rtrim(operator_auth_server_base_url(), '/') . '/admin.html?calendarReauth=' . rawurlencode($status),
        ];
    }

    private static function callbackError(array $challenge, string $errorCode, string $message, string $title = 'No se pudo renovar Google Calendar'): array
    {
        $updated = self::markChallenge($challenge, 'error', [
            'errorCode' => $errorCode,
            'error' => $message,
            'completedAt' => self::nowIso(),
            'nextAction' => 'Repite la reautorizacion y verifica la cuenta Google autorizada para operar el panel.',
        ]);
        if (function_exists('audit_log_event')) {
            audit_log_event('calendar.reauth.failed', [
                'challengeId' => (string) ($challenge['challengeId'] ?? ''),
                'errorCode' => $errorCode,
                'message' => $message,
            ]);
        }

        return [
            'status' => 200,
            'title' => $title,
            'message' => $message,
            'tone' => 'danger',
            'redirectUrl' => rtrim(operator_auth_server_base_url(), '/') . '/admin.html?calendarReauth=error',
            'challenge' => self::publicPayload($updated),
        ];
    }

    private static function updateEnvRefreshToken(string $refreshToken): array
    {
        $envPaths = self::envFilePaths();
        if ($envPaths === []) {
            return ['ok' => false, 'reason' => 'env_path_missing'];
        }

        $backupPaths = [];
        foreach ($envPaths as $envPath) {
            $current = is_file($envPath) ? @file_get_contents($envPath) : '';
            if (!is_string($current)) {
                return ['ok' => false, 'reason' => 'env_unreadable', 'envPath' => $envPath];
            }

            $backupPath = self::backupDir() . DIRECTORY_SEPARATOR . 'env-' . gmdate('Ymd-His') . '-' . operator_auth_random_hex(4) . '.php.bak';
            if (!self::writeRawFile($backupPath, $current)) {
                return ['ok' => false, 'reason' => 'env_backup_failed', 'envPath' => $envPath];
            }

            $replacement = "putenv('PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN=" . self::escapePutenvValue($refreshToken) . "');";
            $lines = preg_split("/\r\n|\n|\r/", $current);
            if (!is_array($lines)) {
                $lines = [];
            }

            $found = false;
            foreach ($lines as $index => $line) {
                if (preg_match('/^\s*putenv\(\s*[\'"]PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN=/i', (string) $line) === 1) {
                    $lines[$index] = $replacement;
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $inserted = false;
                foreach ($lines as $index => $line) {
                    if (preg_match('/^\s*putenv\(\s*[\'"]PIELARMONIA_GOOGLE_OAUTH_CLIENT_SECRET=/i', (string) $line) === 1) {
                        array_splice($lines, $index + 1, 0, [$replacement]);
                        $inserted = true;
                        break;
                    }
                }
                if (!$inserted) {
                    $lines[] = $replacement;
                }
            }

            $updated = implode(PHP_EOL, $lines);
            if ($current !== '' && !str_ends_with($updated, PHP_EOL)) {
                $updated .= PHP_EOL;
            }

            if (@file_put_contents($envPath, $updated) === false) {
                return [
                    'ok' => false,
                    'reason' => 'env_write_failed',
                    'envPath' => $envPath,
                    'envBackupPath' => $backupPath,
                ];
            }

            $backupPaths[] = $backupPath;
        }

        return [
            'ok' => true,
            'envPath' => self::primaryEnvFilePath(),
            'envBackupPath' => (string) ($backupPaths[0] ?? ''),
        ];
    }

    private static function validateGoogleToken(): array
    {
        $provider = GoogleTokenProvider::fromEnv();
        $token = $provider->getAccessToken();
        if (($token['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'reason' => trim((string) ($token['reason'] ?? $token['code'] ?? 'calendar_auth_failed')),
            ];
        }

        $probeOk = false;
        $probeReason = '';
        $client = GoogleCalendarClient::fromEnv();
        if ($client->isConfigured()) {
            $calendarIds = array_values(array_filter(
                $client->getDoctorCalendarMap(),
                static fn ($value): bool => trim((string) $value) !== ''
            ));
            if ($calendarIds !== []) {
                $probe = $client->freeBusy(
                    [trim((string) $calendarIds[0])],
                    gmdate('c'),
                    gmdate('c', time() + 3600),
                    true
                );
                $probeOk = ($probe['ok'] ?? false) === true;
                if (!$probeOk) {
                    $probeReason = trim((string) ($probe['code'] ?? $probe['error'] ?? 'calendar_probe_failed'));
                }
            }
        }

        return [
            'ok' => true,
            'reason' => 'token_refresh_validated',
            'calendarProbeOk' => $probeOk,
            'calendarProbeReason' => $probeReason,
        ];
    }

    private static function clearGoogleCache(): void
    {
        $cacheDir = data_dir_path() . DIRECTORY_SEPARATOR . 'cache';
        foreach (['google-token-oauth.json', 'google-token-status.json', 'calendar-status.json'] as $basename) {
            @unlink($cacheDir . DIRECTORY_SEPARATOR . $basename);
        }
    }

    private static function runtimeDir(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'calendar' . DIRECTORY_SEPARATOR . 'oauth-reauth';
    }

    private static function challengeDir(): string
    {
        return self::runtimeDir() . DIRECTORY_SEPARATOR . 'challenges';
    }

    private static function backupDir(): string
    {
        return self::runtimeDir() . DIRECTORY_SEPARATOR . 'env-backups';
    }

    private static function lastResultPath(): string
    {
        return self::runtimeDir() . DIRECTORY_SEPARATOR . 'last-result.json';
    }

    private static function envFilePaths(): array
    {
        $override = trim((string) (getenv('PIELARMONIA_GOOGLE_CALENDAR_ENV_FILE') ?: ''));
        if ($override !== '') {
            return [$override];
        }

        $paths = [];
        $externalEnv = 'C:\\ProgramData\\Pielarmonia\\hosting\\env.php';
        if (DIRECTORY_SEPARATOR === '\\' && is_file($externalEnv)) {
            $paths[] = $externalEnv;
        }

        $paths[] = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'env.php';

        $resolved = [];
        foreach ($paths as $path) {
            $normalized = trim((string) $path);
            if ($normalized === '') {
                continue;
            }
            if (!in_array($normalized, $resolved, true)) {
                $resolved[] = $normalized;
            }
        }

        return $resolved;
    }

    private static function primaryEnvFilePath(): string
    {
        return (string) (self::envFilePaths()[0] ?? '');
    }

    private static function nowIso(?int $timestamp = null): string
    {
        return gmdate('c', $timestamp ?? time());
    }

    private static function writeChallenge(array $challenge): bool
    {
        $challengeId = trim((string) ($challenge['challengeId'] ?? ''));
        if (!self::isValidChallengeId($challengeId)) {
            return false;
        }

        return self::writeJson(self::challengePath($challengeId), $challenge);
    }

    private static function readChallenge(string $challengeId): ?array
    {
        if (!self::isValidChallengeId($challengeId)) {
            return null;
        }
        $path = self::challengePath($challengeId);
        if (!is_file($path)) {
            return null;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : null;
    }

    private static function writeJson(string $path, array $payload): bool
    {
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }
        ensure_data_htaccess(data_dir_path());
        ensure_data_htaccess(dirname($dir));
        ensure_data_htaccess($dir);

        return @file_put_contents(
            $path,
            json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
        ) !== false;
    }

    private static function writeLastResult(array $payload): void
    {
        self::writeJson(self::lastResultPath(), $payload);
    }

    private static function writeRawFile(string $path, string $contents): bool
    {
        $dir = dirname($path);
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }

        return @file_put_contents($path, $contents) !== false;
    }

    private static function markChallenge(array $challenge, string $status, array $patch = []): array
    {
        $next = array_merge($challenge, $patch);
        $next['status'] = $status;
        $next['updatedAt'] = self::nowIso();
        self::writeChallenge($next);
        self::writeLastResult(self::publicPayload($next));
        return $next;
    }

    private static function purgeExpiredChallenges(): void
    {
        $dir = self::challengeDir();
        if (!is_dir($dir)) {
            return;
        }

        $now = time();
        foreach ((array) glob($dir . DIRECTORY_SEPARATOR . '*.json') as $path) {
            $raw = @file_get_contents($path);
            $challenge = json_decode(is_string($raw) ? $raw : '', true);
            if (!is_array($challenge)) {
                @unlink($path);
                continue;
            }

            $expiresAt = isset($challenge['expiresAt']) ? strtotime((string) $challenge['expiresAt']) : false;
            $updatedAt = isset($challenge['updatedAt']) ? strtotime((string) $challenge['updatedAt']) : false;
            if ($expiresAt !== false && ((int) $expiresAt) <= $now && (($challenge['status'] ?? 'pending') === 'pending')) {
                $challenge['status'] = 'expired';
                $challenge['updatedAt'] = self::nowIso();
                $challenge['errorCode'] = 'challenge_expired';
                $challenge['error'] = 'El challenge de reautorizacion expiro.';
                self::writeChallenge($challenge);
            }

            if ($updatedAt !== false && ((int) $updatedAt) < ($now - 7200)) {
                @unlink($path);
            }
        }
    }

    private static function buildState(string $challengeId): string
    {
        return self::STATE_PREFIX . '.' . $challengeId . '.' . operator_auth_random_hex(12);
    }

    private static function extractChallengeIdFromState(string $state): string
    {
        $segments = explode('.', trim($state), 3);
        if (count($segments) < 2 || trim((string) ($segments[0] ?? '')) !== self::STATE_PREFIX) {
            return '';
        }
        $challengeId = trim((string) ($segments[1] ?? ''));
        return self::isValidChallengeId($challengeId) ? $challengeId : '';
    }

    private static function buildAuthUrl(array $challenge): string
    {
        return operator_auth_google_authorize_url() . '?' . http_build_query([
            'client_id' => operator_auth_google_client_id(),
            'redirect_uri' => operator_auth_google_redirect_uri(),
            'response_type' => 'code',
            'scope' => 'openid email profile https://www.googleapis.com/auth/calendar',
            'state' => (string) ($challenge['state'] ?? ''),
            'nonce' => (string) ($challenge['nonce'] ?? ''),
            'prompt' => 'consent',
            'access_type' => 'offline',
            'include_granted_scopes' => 'false',
            'code_challenge' => (string) ($challenge['pkceChallenge'] ?? ''),
            'code_challenge_method' => 'S256',
        ]);
    }

    private static function challengePath(string $challengeId): string
    {
        return self::challengeDir() . DIRECTORY_SEPARATOR . $challengeId . '.json';
    }

    private static function isValidChallengeId(string $challengeId): bool
    {
        return preg_match('/^[a-f0-9]{32}$/', $challengeId) === 1;
    }

    private static function escapePutenvValue(string $value): string
    {
        return str_replace(['\\', '\''], ['\\\\', '\\\''], $value);
    }

    private static function maskSecret(string $value): string
    {
        $normalized = trim($value);
        if ($normalized === '') {
            return '';
        }
        if (strlen($normalized) <= 10) {
            return '***';
        }
        return substr($normalized, 0, 6) . '***' . substr($normalized, -4);
    }

    private static function randomBinary(int $bytes): string
    {
        try {
            return random_bytes($bytes);
        } catch (Throwable $e) {
            return substr(hash('sha512', uniqid('calendar-oauth-reauth', true), true), 0, max(1, $bytes));
        }
    }

    private static function pkceChallenge(string $verifier): string
    {
        return operator_auth_base64url_encode(hash('sha256', $verifier, true));
    }
}
