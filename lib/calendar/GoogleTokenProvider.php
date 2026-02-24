<?php

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';

class GoogleTokenProvider
{
    private string $authMode;
    private string $clientEmail;
    private string $privateKey;
    private string $oauthClientId;
    private string $oauthClientSecret;
    private string $oauthRefreshToken;
    private string $tokenUri;
    private string $scope;
    private string $cachePath;
    private string $statusPath;
    private static array $memoryCache = [];

    public function __construct(
        string $authMode,
        string $clientEmail,
        string $privateKey,
        string $oauthClientId,
        string $oauthClientSecret,
        string $oauthRefreshToken,
        string $tokenUri,
        string $scope,
        string $cachePath,
        string $statusPath
    ) {
        $this->authMode = trim($authMode);
        $this->clientEmail = trim($clientEmail);
        $this->privateKey = trim($privateKey);
        $this->oauthClientId = trim($oauthClientId);
        $this->oauthClientSecret = trim($oauthClientSecret);
        $this->oauthRefreshToken = trim($oauthRefreshToken);
        $this->tokenUri = trim($tokenUri);
        $this->scope = trim($scope);
        $this->cachePath = trim($cachePath);
        $this->statusPath = trim($statusPath);
    }

    public static function fromEnv(): self
    {
        $clientEmail = (string) (getenv('PIELARMONIA_GOOGLE_SA_CLIENT_EMAIL') ?: '');
        $privateKeyB64 = (string) (getenv('PIELARMONIA_GOOGLE_SA_PRIVATE_KEY_B64') ?: '');
        $privateKeyRaw = (string) (getenv('PIELARMONIA_GOOGLE_SA_PRIVATE_KEY') ?: '');

        $oauthClientId = (string) (getenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID') ?: '');
        $oauthClientSecret = (string) (getenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_SECRET') ?: '');
        $oauthRefreshToken = (string) (getenv('PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN') ?: '');

        $tokenUri = (string) (getenv('PIELARMONIA_GOOGLE_SA_TOKEN_URI') ?: 'https://oauth2.googleapis.com/token');
        $scope = (string) (getenv('PIELARMONIA_GOOGLE_SA_SCOPE') ?: 'https://www.googleapis.com/auth/calendar');

        $privateKey = '';
        if ($privateKeyB64 !== '') {
            $decoded = base64_decode($privateKeyB64, true);
            if (is_string($decoded) && trim($decoded) !== '') {
                $privateKey = trim($decoded);
            }
        }
        if ($privateKey === '' && $privateKeyRaw !== '') {
            $privateKey = str_replace('\\n', "\n", trim($privateKeyRaw));
        }

        $serviceAccountConfigured = trim($clientEmail) !== '' && $privateKey !== '';
        $oauthConfigured = trim($oauthClientId) !== ''
            && trim($oauthClientSecret) !== ''
            && trim($oauthRefreshToken) !== '';

        $requestedAuthMode = strtolower(trim((string) (getenv('PIELARMONIA_CALENDAR_AUTH_MODE') ?: 'auto')));
        if ($requestedAuthMode === 'oauth_refresh_token') {
            $requestedAuthMode = 'oauth_refresh';
        }
        if (!in_array($requestedAuthMode, ['auto', 'oauth_refresh', 'service_account', 'none'], true)) {
            $requestedAuthMode = 'auto';
        }
        $authMode = self::resolveAuthMode($requestedAuthMode, $serviceAccountConfigured, $oauthConfigured);

        $cacheDir = data_dir_path() . DIRECTORY_SEPARATOR . 'cache';
        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0775, true);
        }
        $cacheSuffix = 'none';
        if ($authMode === 'oauth_refresh') {
            $cacheSuffix = 'oauth';
        } elseif ($authMode === 'service_account') {
            $cacheSuffix = 'sa';
        }
        $cachePath = $cacheDir . DIRECTORY_SEPARATOR . 'google-token-' . $cacheSuffix . '.json';
        $statusPath = $cacheDir . DIRECTORY_SEPARATOR . 'google-token-status.json';

        return new self(
            $authMode,
            $clientEmail,
            $privateKey,
            $oauthClientId,
            $oauthClientSecret,
            $oauthRefreshToken,
            $tokenUri,
            $scope,
            $cachePath,
            $statusPath
        );
    }

    public static function readStatusSnapshot(): array
    {
        $path = data_dir_path() . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR . 'google-token-status.json';
        return self::readStatusSnapshotFromPath($path);
    }

    public function getAuthMode(): string
    {
        return $this->authMode !== '' ? $this->authMode : 'none';
    }

    public function isConfigured(): bool
    {
        if ($this->tokenUri === '') {
            return false;
        }
        if ($this->authMode === 'service_account') {
            return $this->clientEmail !== '' && $this->privateKey !== '';
        }
        if ($this->authMode === 'oauth_refresh') {
            return $this->oauthClientId !== ''
                && $this->oauthClientSecret !== ''
                && $this->oauthRefreshToken !== '';
        }
        return false;
    }

    public function getAccessToken(): array
    {
        if (!$this->isConfigured()) {
            $this->recordTokenFailure('calendar_not_configured');
            return [
                'ok' => false,
                'error' => 'Google Calendar not configured',
                'code' => 'calendar_not_configured',
            ];
        }

        $now = time();
        $cached = $this->loadCache();
        if (is_array($cached)) {
            $token = (string) ($cached['access_token'] ?? '');
            $expiresAt = (int) ($cached['expires_at'] ?? 0);
            if ($token !== '' && $expiresAt > ($now + 60)) {
                $this->recordTokenSuccess($expiresAt, 'cache_hit');
                return [
                    'ok' => true,
                    'accessToken' => $token,
                    'expiresAt' => $expiresAt,
                ];
            }
        }

        if ($this->authMode === 'service_account') {
            $jwt = $this->buildJwt($now);
            if ($jwt === '') {
                $this->recordTokenFailure('calendar_jwt_sign_failed');
                return [
                    'ok' => false,
                    'error' => 'Could not sign Google token',
                    'code' => 'calendar_jwt_sign_failed',
                ];
            }

            $tokenResponse = $this->requestToken(
                [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $jwt,
                ],
                'oauth_token_service_account'
            );
        } elseif ($this->authMode === 'oauth_refresh') {
            $tokenResponse = $this->requestToken(
                [
                    'grant_type' => 'refresh_token',
                    'client_id' => $this->oauthClientId,
                    'client_secret' => $this->oauthClientSecret,
                    'refresh_token' => $this->oauthRefreshToken,
                ],
                'oauth_token_refresh_token'
            );
        } else {
            $this->recordTokenFailure('calendar_not_configured');
            return [
                'ok' => false,
                'error' => 'Google Calendar not configured',
                'code' => 'calendar_not_configured',
            ];
        }

        if (($tokenResponse['ok'] ?? false) !== true) {
            $tokenFailureReason = trim((string) ($tokenResponse['reason'] ?? ''));
            if ($tokenFailureReason === '') {
                $tokenFailureReason = trim((string) ($tokenResponse['code'] ?? 'calendar_token_request_failed'));
            }
            $this->recordTokenFailure($tokenFailureReason);
            return $tokenResponse;
        }

        $accessToken = (string) ($tokenResponse['accessToken'] ?? '');
        $expiresIn = (int) ($tokenResponse['expiresIn'] ?? 0);
        if ($accessToken === '' || $expiresIn <= 0) {
            $this->recordTokenFailure('calendar_token_invalid_response');
            return [
                'ok' => false,
                'error' => 'Invalid response from Google OAuth',
                'code' => 'calendar_token_invalid_response',
            ];
        }

        $expiresAt = $now + max(120, $expiresIn);
        $record = [
            'access_token' => $accessToken,
            'expires_at' => $expiresAt,
            'updated_at' => gmdate('c'),
            'auth_mode' => $this->authMode,
        ];
        $this->storeCache($record);
        $this->recordTokenSuccess($expiresAt, 'token_refresh');

        return [
            'ok' => true,
            'accessToken' => $accessToken,
            'expiresAt' => $expiresAt,
        ];
    }

    private function buildJwt(int $issuedAt): string
    {
        $header = [
            'alg' => 'RS256',
            'typ' => 'JWT',
        ];
        $claimSet = [
            'iss' => $this->clientEmail,
            'scope' => $this->scope,
            'aud' => $this->tokenUri,
            'iat' => $issuedAt,
            'exp' => $issuedAt + 3600,
        ];

        $segments = [
            $this->base64UrlEncode((string) json_encode($header, JSON_UNESCAPED_SLASHES)),
            $this->base64UrlEncode((string) json_encode($claimSet, JSON_UNESCAPED_SLASHES)),
        ];
        $signingInput = implode('.', $segments);
        $signature = '';

        $privateKeyResource = @openssl_pkey_get_private($this->privateKey);
        if ($privateKeyResource === false) {
            return '';
        }

        $signed = @openssl_sign($signingInput, $signature, $privateKeyResource, OPENSSL_ALGO_SHA256);
        if (is_object($privateKeyResource) || is_resource($privateKeyResource)) {
            @openssl_pkey_free($privateKeyResource);
        }

        if ($signed !== true || $signature === '') {
            return '';
        }

        $segments[] = $this->base64UrlEncode($signature);
        return implode('.', $segments);
    }

    private function requestToken(array $payloadFields, string $operation): array
    {
        $payload = http_build_query($payloadFields);

        $headers = [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ];
        $timeoutMs = 8000;

        $response = $this->httpPost($this->tokenUri, $headers, $payload, $timeoutMs);
        if (($response['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'error' => 'Could not authenticate with Google Calendar',
                'code' => 'calendar_token_request_failed',
                'reason' => 'token_endpoint_unreachable',
            ];
        }

        $status = (int) ($response['status'] ?? 0);
        $body = (string) ($response['body'] ?? '');
        $json = json_decode($body, true);
        if (!is_array($json)) {
            return [
                'ok' => false,
                'error' => 'Invalid response from Google OAuth',
                'code' => 'calendar_token_invalid_json',
                'reason' => 'token_endpoint_invalid_json',
            ];
        }

        if ($status < 200 || $status >= 300) {
            $message = (string) ($json['error_description'] ?? $json['error'] ?? 'oauth_error');
            $errorCode = trim((string) ($json['error'] ?? ''));
            $errorReason = $errorCode !== '' ? $errorCode : ('status_' . $status);
            audit_log_event('calendar.error', [
                'operation' => $operation,
                'status' => $status,
                'reason' => $message,
            ]);

            return [
                'ok' => false,
                'error' => 'Google OAuth rejected authentication',
                'code' => 'calendar_token_rejected',
                'reason' => $errorReason,
            ];
        }

        return [
            'ok' => true,
            'accessToken' => (string) ($json['access_token'] ?? ''),
            'expiresIn' => (int) ($json['expires_in'] ?? 0),
        ];
    }

    private function httpPost(string $url, array $headers, string $body, int $timeoutMs): array
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                curl_setopt($ch, CURLOPT_TIMEOUT_MS, $timeoutMs);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT_MS, min(3000, $timeoutMs));
                $rawBody = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);

                if ($rawBody === false) {
                    return ['ok' => false, 'status' => $status, 'error' => $curlError];
                }
                return ['ok' => true, 'status' => $status, 'body' => (string) $rawBody];
            }
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'timeout' => max(1, (int) ceil($timeoutMs / 1000)),
                'ignore_errors' => true,
            ],
        ]);

        $rawBody = @file_get_contents($url, false, $context);
        $status = 0;
        $responseHeaders = [];
        if (function_exists('http_get_last_response_headers')) {
            $headers = http_get_last_response_headers();
            if (is_array($headers)) {
                $responseHeaders = $headers;
            }
        }
        if ($responseHeaders !== []) {
            foreach ($responseHeaders as $line) {
                if (preg_match('/^HTTP\/\d+\.\d+\s+(\d+)/i', (string) $line, $match) === 1) {
                    $status = (int) $match[1];
                    break;
                }
            }
        }

        if (!is_string($rawBody)) {
            return ['ok' => false, 'status' => $status];
        }

        return ['ok' => true, 'status' => $status, 'body' => $rawBody];
    }

    private function loadCache(): ?array
    {
        if ($this->cachePath !== '' && isset(self::$memoryCache[$this->cachePath]) && is_array(self::$memoryCache[$this->cachePath])) {
            return self::$memoryCache[$this->cachePath];
        }
        if ($this->cachePath === '' || !is_file($this->cachePath)) {
            return null;
        }
        $raw = @file_get_contents($this->cachePath);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }
        self::$memoryCache[$this->cachePath] = $decoded;
        return $decoded;
    }

    private function storeCache(array $record): void
    {
        if ($this->cachePath !== '') {
            self::$memoryCache[$this->cachePath] = $record;
        }
        if ($this->cachePath === '') {
            return;
        }
        $dir = dirname($this->cachePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        @file_put_contents($this->cachePath, json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function resolveAuthMode(string $requestedMode, bool $serviceAccountConfigured, bool $oauthConfigured): string
    {
        if ($requestedMode === 'none') {
            return 'none';
        }
        if ($requestedMode === 'oauth_refresh') {
            return $oauthConfigured ? 'oauth_refresh' : 'none';
        }
        if ($requestedMode === 'service_account') {
            return $serviceAccountConfigured ? 'service_account' : 'none';
        }

        if ($serviceAccountConfigured) {
            return 'service_account';
        }
        if ($oauthConfigured) {
            return 'oauth_refresh';
        }
        return 'none';
    }

    private static function readStatusSnapshotFromPath(string $path): array
    {
        if ($path === '' || !is_file($path)) {
            return [];
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function writeStatusSnapshot(array $patch): void
    {
        if ($this->statusPath === '') {
            return;
        }
        $dir = dirname($this->statusPath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $current = self::readStatusSnapshotFromPath($this->statusPath);
        $updated = array_merge($current, $patch, [
            'updatedAt' => local_date('c'),
        ]);
        @file_put_contents($this->statusPath, json_encode($updated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function recordTokenSuccess(int $expiresAt, string $source): void
    {
        $this->writeStatusSnapshot([
            'lastSuccessAt' => local_date('c'),
            'lastErrorAt' => '',
            'lastErrorReason' => '',
            'expiresAt' => $expiresAt,
            'authMode' => $this->getAuthMode(),
            'source' => $source,
        ]);
    }

    private function recordTokenFailure(string $reason): void
    {
        $normalizedReason = trim($reason) !== '' ? trim($reason) : 'token_error';
        $this->writeStatusSnapshot([
            'lastErrorAt' => local_date('c'),
            'lastErrorReason' => $normalizedReason,
            'authMode' => $this->getAuthMode(),
        ]);
    }
}
