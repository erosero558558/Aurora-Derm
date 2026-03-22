<?php

declare(strict_types=1);

function operator_auth_test_defaults(array $overrides = []): array
{
    $defaults = [
        'mode' => 'google_oauth',
        'transport' => 'local_helper',
        'allowlist' => 'operator@example.com',
        'email' => 'operator@example.com',
        'profile_id' => 'openai-codex:test-profile',
        'account_id' => 'acct-test-operator',
        'device_id' => 'device-test-operator',
        'bridge_token' => 'operator-auth-bridge-test-token',
        'bridge_secret' => 'operator-auth-bridge-test-secret',
        'bridge_header' => 'Authorization',
        'bridge_prefix' => 'Bearer',
        'helper_base_url' => 'http://127.0.0.1:4173',
        'challenge_ttl' => '300',
        'session_ttl' => '1800',
        'max_skew' => '300',
    ];

    foreach ($overrides as $key => $value) {
        $defaults[(string) $key] = $value;
    }

    return $defaults;
}

function operator_auth_test_env(array $overrides = []): array
{
    $defaults = operator_auth_test_defaults($overrides);

    return [
        'PIELARMONIA_SKIP_ENV_FILE' => 'true',
        'PIELARMONIA_OPERATOR_AUTH_MODE' => (string) $defaults['mode'],
        'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => (string) $defaults['transport'],
        'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => (string) $defaults['allowlist'],
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN' => (string) $defaults['bridge_token'],
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET' => (string) $defaults['bridge_secret'],
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER' => (string) $defaults['bridge_header'],
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_PREFIX' => (string) $defaults['bridge_prefix'],
        'PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL' => (string) $defaults['helper_base_url'],
        'PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS' => (string) $defaults['challenge_ttl'],
        'PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS' => (string) $defaults['session_ttl'],
        'PIELARMONIA_OPERATOR_AUTH_BRIDGE_MAX_SKEW_SECONDS' => (string) $defaults['max_skew'],
    ];
}

function operator_auth_test_signature_payload(array $payload): string
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
        strtolower(trim((string) ($payload['email'] ?? ''))),
        trim((string) ($payload['profileId'] ?? '')),
        trim((string) ($payload['accountId'] ?? '')),
        $deviceId,
        $timestamp,
    ]);
}

function operator_auth_test_sign_payload(array $payload, string $secret): string
{
    return hash_hmac('sha256', operator_auth_test_signature_payload($payload), $secret);
}

function operator_auth_test_http_request(
    string $method,
    string $url,
    $data = null,
    ?string $cookieFile = null,
    array $headers = []
): array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_HEADER, true);

    $requestHeaders = $headers;
    if ($data !== null) {
        $requestHeaders[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    if ($requestHeaders !== []) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $requestHeaders);
    }

    if (is_string($cookieFile) && $cookieFile !== '') {
        curl_setopt($ch, CURLOPT_COOKIEJAR, $cookieFile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $cookieFile);
    }

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return [
            'code' => 0,
            'body' => [],
            'raw' => '',
            'headers' => [],
            'error' => $error,
        ];
    }

    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $rawHeaders = substr($response, 0, $headerSize);
    $rawBody = substr($response, $headerSize);
    curl_close($ch);

    $decoded = json_decode($rawBody, true);
    return [
        'code' => $code,
        'body' => is_array($decoded) ? $decoded : [],
        'raw' => $rawBody,
        'headers' => preg_split("/\r\n|\n|\r/", trim($rawHeaders)) ?: [],
    ];
}

function operator_auth_test_csrf_headers(string $serverBaseUrl, ?string $cookieFile = null): array
{
    $status = operator_auth_test_http_request(
        'GET',
        rtrim($serverBaseUrl, '/') . '/api.php?resource=operator-auth-status',
        null,
        $cookieFile
    );
    $csrfToken = is_array($status['body'] ?? null)
        ? (string) ($status['body']['csrfToken'] ?? '')
        : '';
    if ($csrfToken === '') {
        throw new RuntimeException('operator-auth-status no devolvio csrfToken para iniciar el flujo.');
    }

    return ['X-CSRF-Token: ' . $csrfToken];
}

if (!function_exists('operator_auth_test_build_completion_payload')) {
    function operator_auth_test_build_completion_payload(array $challenge, array $overrides = []): array
    {
        $defaults = operator_auth_test_defaults($overrides);
        $payload = [
            'challengeId' => (string) ($challenge['challengeId'] ?? ''),
            'nonce' => (string) ($challenge['nonce'] ?? ''),
            'status' => (string) ($overrides['status'] ?? 'completed'),
            'email' => (string) ($overrides['email'] ?? $defaults['email']),
            'profileId' => (string) ($overrides['profileId'] ?? $defaults['profile_id']),
            'accountId' => (string) ($overrides['accountId'] ?? $defaults['account_id']),
            'deviceId' => (string) ($overrides['deviceId'] ?? $defaults['device_id']),
            'timestamp' => (string) ($overrides['timestamp'] ?? gmdate('c')),
        ];

        if ($payload['status'] === 'error') {
            $payload['errorCode'] = (string) ($overrides['errorCode'] ?? 'helper_no_disponible');
            $payload['error'] = (string) ($overrides['error'] ?? 'error forzado desde test');
            unset($payload['email'], $payload['profileId'], $payload['accountId']);
        }

        $payload['signature'] = operator_auth_test_sign_payload($payload, (string) $defaults['bridge_secret']);
        return $payload;
    }
}

if (!function_exists('operator_auth_test_complete_request')) {
    function operator_auth_test_complete_request(string $serverBaseUrl, array $challenge, array $overrides = []): array
    {
        $defaults = operator_auth_test_defaults($overrides);
        $payload = operator_auth_test_build_completion_payload($challenge, $overrides);

        return operator_auth_test_http_request(
            'POST',
            rtrim($serverBaseUrl, '/') . '/api.php?resource=operator-auth-complete',
            $payload,
            null,
            [
                (string) $defaults['bridge_header'] . ': ' . (string) $defaults['bridge_prefix'] . ' ' . (string) $defaults['bridge_token'],
            ]
        );
    }
}

function operator_auth_test_login(string $serverBaseUrl, string $cookieFile, array $overrides = []): array
{
    $defaults = operator_auth_test_defaults($overrides);
    $baseUrl = rtrim($serverBaseUrl, '/');

    $start = operator_auth_test_http_request(
        'POST',
        $baseUrl . '/api.php?resource=operator-auth-start',
        [],
        $cookieFile,
        operator_auth_test_csrf_headers($baseUrl, $cookieFile)
    );
    if ($start['code'] !== 202) {
        return [
            'ok' => false,
            'reason' => 'start_failed',
            'start' => $start,
        ];
    }

    $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];
    if ($challenge === []) {
        return [
            'ok' => false,
            'reason' => 'challenge_missing',
            'start' => $start,
        ];
    }

    $complete = operator_auth_test_complete_request($baseUrl, $challenge, $overrides);
    if ($complete['code'] !== 202) {
        return [
            'ok' => false,
            'reason' => 'complete_failed',
            'challenge' => $challenge,
            'start' => $start,
            'complete' => $complete,
        ];
    }

    $status = operator_auth_test_http_request(
        'GET',
        $baseUrl . '/api.php?resource=operator-auth-status',
        null,
        $cookieFile
    );
    if ($status['code'] !== 200 || !($status['body']['authenticated'] ?? false)) {
        return [
            'ok' => false,
            'reason' => 'status_not_authenticated',
            'challenge' => $challenge,
            'start' => $start,
            'complete' => $complete,
            'statusResponse' => $status,
        ];
    }

    return [
        'ok' => true,
        'challenge' => $challenge,
        'csrfToken' => (string) ($status['body']['csrfToken'] ?? ''),
        'operator' => is_array($status['body']['operator'] ?? null) ? $status['body']['operator'] : [
            'email' => (string) $defaults['email'],
            'profileId' => (string) $defaults['profile_id'],
            'accountId' => (string) $defaults['account_id'],
            'source' => 'google_oauth',
        ],
        'start' => $start,
        'complete' => $complete,
        'statusResponse' => $status,
    ];
}
