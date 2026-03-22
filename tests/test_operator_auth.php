<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/operator_auth_test_helper.php';

$dataDir = sys_get_temp_dir() . '/pielarmonia-test-operator-auth-' . uniqid('', true);
$server = [];

ensure_clean_directory($dataDir);

$server = start_test_php_server([
    'docroot' => __DIR__ . '/..',
    'env' => [
        'PIELARMONIA_DATA_DIR' => $dataDir,
        'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
    ] + operator_auth_test_env(),
    'startup_timeout_ms' => 12000,
]);

$serverBaseUrl = $server['base_url'];

function operator_auth_test_challenge_file(string $dataDir, string $challengeId): string
{
    return $dataDir . DIRECTORY_SEPARATOR . 'operator-auth' . DIRECTORY_SEPARATOR . 'challenges' . DIRECTORY_SEPARATOR . $challengeId . '.json';
}

function operator_auth_test_cookie_file(): string
{
    $path = tempnam(sys_get_temp_dir(), 'operator-auth-cookie-');
    if ($path === false) {
        throw new RuntimeException('No se pudo crear un archivo temporal de cookies.');
    }

    return $path;
}

function operator_auth_test_cleanup_cookie(string $path): void
{
    if ($path !== '' && file_exists($path)) {
        @unlink($path);
    }
}

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

    if (($payload['status'] ?? '') === 'error') {
        $payload['errorCode'] = (string) ($overrides['errorCode'] ?? 'helper_no_disponible');
        $payload['error'] = (string) ($overrides['error'] ?? 'error forzado desde test');
        unset($payload['email'], $payload['profileId'], $payload['accountId']);
    }

    $payload['signature'] = operator_auth_test_sign_payload($payload, $defaults['bridge_secret']);
    return $payload;
}

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
            $defaults['bridge_header'] . ': ' . $defaults['bridge_prefix'] . ' ' . $defaults['bridge_token']
        ]
    );
}

try {
    run_test('Operator auth success establishes session and CSRF', function () use ($serverBaseUrl) {
        $cookieFile = operator_auth_test_cookie_file();
        try {
            $login = operator_auth_test_login($serverBaseUrl, $cookieFile);
            assert_true($login['ok'], 'operator auth should succeed');
            assert_true(strlen((string) ($login['csrfToken'] ?? '')) > 10, 'csrf token missing');
            assert_equals('operator@example.com', $login['operator']['email'] ?? '', 'operator email mismatch');
            assert_equals('google_oauth', $login['operator']['source'] ?? '', 'operator source mismatch');
        } finally {
            operator_auth_test_cleanup_cookie($cookieFile);
        }
    });

    run_test('Operator auth denies email outside allowlist', function () use ($serverBaseUrl) {
        $cookieFile = operator_auth_test_cookie_file();
        try {
            $start = operator_auth_test_http_request(
                'POST',
                $serverBaseUrl . '/api.php?resource=operator-auth-start',
                [],
                $cookieFile,
                operator_auth_test_csrf_headers($serverBaseUrl, $cookieFile)
            );
            assert_equals(202, $start['code'], 'start should create challenge');
            $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];

            $complete = operator_auth_test_complete_request($serverBaseUrl, $challenge, [
                'email' => 'blocked@example.com'
            ]);
            assert_equals(403, $complete['code'], 'blocked email should be rejected');
            assert_equals('email_no_permitido', $complete['body']['status'] ?? '', 'unexpected denied status');

            $status = operator_auth_test_http_request(
                'GET',
                $serverBaseUrl . '/api.php?resource=operator-auth-status',
                null,
                $cookieFile
            );
            assert_equals('email_no_permitido', $status['body']['status'] ?? '', 'status endpoint should expose denied challenge');
            assert_false($status['body']['authenticated'] ?? false, 'denied challenge must not authenticate');
        } finally {
            operator_auth_test_cleanup_cookie($cookieFile);
        }
    });

    run_test('Operator auth challenge cannot be reused', function () use ($serverBaseUrl) {
        $cookieFile = operator_auth_test_cookie_file();
        try {
            $start = operator_auth_test_http_request(
                'POST',
                $serverBaseUrl . '/api.php?resource=operator-auth-start',
                [],
                $cookieFile,
                operator_auth_test_csrf_headers($serverBaseUrl, $cookieFile)
            );
            assert_equals(202, $start['code'], 'start should create challenge');
            $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];

            $firstComplete = operator_auth_test_complete_request($serverBaseUrl, $challenge);
            assert_equals(202, $firstComplete['code'], 'first completion should be accepted');

            $secondComplete = operator_auth_test_complete_request($serverBaseUrl, $challenge);
            assert_equals(409, $secondComplete['code'], 'reused challenge should be rejected');
        } finally {
            operator_auth_test_cleanup_cookie($cookieFile);
        }
    });

    run_test('Operator auth expired challenge returns terminal status', function () use ($serverBaseUrl, $dataDir) {
        $cookieFile = operator_auth_test_cookie_file();
        try {
            $start = operator_auth_test_http_request(
                'POST',
                $serverBaseUrl . '/api.php?resource=operator-auth-start',
                [],
                $cookieFile,
                operator_auth_test_csrf_headers($serverBaseUrl, $cookieFile)
            );
            assert_equals(202, $start['code'], 'start should create challenge');
            $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];

            $challengeId = (string) ($challenge['challengeId'] ?? '');
            $challengePath = operator_auth_test_challenge_file($dataDir, $challengeId);
            $stored = json_decode((string) file_get_contents($challengePath), true);
            assert_true(is_array($stored), 'stored challenge should be readable');
            $stored['expiresAt'] = gmdate('c', time() - 120);
            file_put_contents(
                $challengePath,
                json_encode($stored, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)
            );

            $complete = operator_auth_test_complete_request($serverBaseUrl, $challenge);
            assert_equals(410, $complete['code'], 'expired challenge should reject completion');

            $status = operator_auth_test_http_request(
                'GET',
                $serverBaseUrl . '/api.php?resource=operator-auth-status',
                null,
                $cookieFile
            );
            assert_equals('challenge_expirado', $status['body']['status'] ?? '', 'expired challenge should map to terminal status');
            assert_false($status['body']['authenticated'] ?? false, 'expired challenge must not authenticate');
        } finally {
            operator_auth_test_cleanup_cookie($cookieFile);
        }
    });

    run_test('Operator auth rejects invalid bridge signature', function () use ($serverBaseUrl) {
        $cookieFile = operator_auth_test_cookie_file();
        try {
            $start = operator_auth_test_http_request(
                'POST',
                $serverBaseUrl . '/api.php?resource=operator-auth-start',
                [],
                $cookieFile,
                operator_auth_test_csrf_headers($serverBaseUrl, $cookieFile)
            );
            assert_equals(202, $start['code'], 'start should create challenge');
            $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];

            $payload = operator_auth_test_build_completion_payload($challenge);
            $payload['signature'] = str_repeat('0', 64);

            $response = operator_auth_test_http_request(
                'POST',
                $serverBaseUrl . '/api.php?resource=operator-auth-complete',
                $payload,
                null,
                ['Authorization: Bearer operator-auth-bridge-test-token']
            );

            assert_equals(401, $response['code'], 'invalid signature should be rejected');
            assert_equals('Firma del bridge invalida', $response['body']['error'] ?? '', 'unexpected invalid signature error');
        } finally {
            operator_auth_test_cleanup_cookie($cookieFile);
        }
    });

    run_test('Operator auth rejects bridge timestamp outside skew window', function () use ($serverBaseUrl) {
        $cookieFile = operator_auth_test_cookie_file();
        try {
            $start = operator_auth_test_http_request(
                'POST',
                $serverBaseUrl . '/api.php?resource=operator-auth-start',
                [],
                $cookieFile,
                operator_auth_test_csrf_headers($serverBaseUrl, $cookieFile)
            );
            assert_equals(202, $start['code'], 'start should create challenge');
            $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];

            $response = operator_auth_test_complete_request($serverBaseUrl, $challenge, [
                'timestamp' => gmdate('c', time() - 3600),
            ]);

            assert_equals(400, $response['code'], 'stale timestamp should be rejected');
            assert_equals(
                'Timestamp del bridge fuera de ventana',
                $response['body']['error'] ?? '',
                'unexpected stale timestamp error'
            );
        } finally {
            operator_auth_test_cleanup_cookie($cookieFile);
        }
    });
} finally {
    stop_test_php_server($server);
    delete_path_recursive($dataDir);
}

print_test_summary();
