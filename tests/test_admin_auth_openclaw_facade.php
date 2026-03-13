<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/operator_auth_test_helper.php';

function admin_auth_openclaw_request(
    string $method,
    string $baseUrl,
    string $action,
    $data = null,
    ?string $cookieFile = null,
    array $headers = []
): array {
    $url = rtrim($baseUrl, '/') . '/admin-auth.php?action=' . rawurlencode($action);
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
            'headers' => [],
            'raw' => '',
            'error' => $error,
        ];
    }

    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $rawHeaders = substr($response, 0, $headerSize);
    $rawBody = substr($response, $headerSize);
    curl_close($ch);

    return [
        'code' => $code,
        'body' => json_decode((string) $rawBody, true) ?: [],
        'headers' => preg_split("/\r\n|\n|\r/", trim((string) $rawHeaders)) ?: [],
        'raw' => (string) $rawBody,
    ];
}

function admin_auth_openclaw_cookie_file(): string
{
    $path = tempnam(sys_get_temp_dir(), 'admin-auth-openclaw-cookie-');
    if ($path === false) {
        throw new RuntimeException('No se pudo crear archivo temporal de cookies.');
    }

    return $path;
}

function admin_auth_openclaw_cleanup_cookie(string $path): void
{
    if ($path !== '' && file_exists($path)) {
        @unlink($path);
    }
}

$dataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-openclaw-' . uniqid('', true);
$server = [];

ensure_clean_directory($dataDir);

try {
    $server = start_test_php_server([
        'docroot' => __DIR__ . '/..',
        'env' => [
            'PIELARMONIA_DATA_DIR' => $dataDir,
            'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
        ] + operator_auth_test_env(),
        'startup_timeout_ms' => 12000,
    ]);

    $serverBaseUrl = $server['base_url'];

    run_test('admin-auth status exposes openclaw anonymous mode when configured', function () use ($serverBaseUrl) {
        $cookieFile = admin_auth_openclaw_cookie_file();
        try {
            $status = admin_auth_openclaw_request('GET', $serverBaseUrl, 'status', null, $cookieFile);

            assert_equals(200, $status['code'], 'status should respond 200');
            assert_true($status['body']['ok'] ?? false, 'status payload should be ok');
            assert_false($status['body']['authenticated'] ?? true, 'anonymous operator should not authenticate');
            assert_equals('openclaw_chatgpt', $status['body']['mode'] ?? '', 'mode should expose openclaw_chatgpt');
            assert_equals('anonymous', $status['body']['status'] ?? '', 'status should remain anonymous before challenge');
        } finally {
            admin_auth_openclaw_cleanup_cookie($cookieFile);
        }
    });

    run_test('admin-auth start status logout completes an operator session through facade', function () use ($serverBaseUrl) {
        $cookieFile = admin_auth_openclaw_cookie_file();
        try {
            $start = admin_auth_openclaw_request('POST', $serverBaseUrl, 'start', [], $cookieFile);
            assert_equals(202, $start['code'], 'start should create challenge');
            assert_equals('pending', $start['body']['status'] ?? '', 'start should leave challenge pending');
            assert_equals('openclaw_chatgpt', $start['body']['mode'] ?? '', 'start should report openclaw mode');

            $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];
            assert_true(isset($challenge['helperUrl']), 'challenge should expose helperUrl');
            assert_true(isset($challenge['manualCode']), 'challenge should expose manualCode');

            $complete = operator_auth_test_complete_request($serverBaseUrl, $challenge);
            assert_equals(202, $complete['code'], 'bridge completion should succeed');

            $status = admin_auth_openclaw_request('GET', $serverBaseUrl, 'status', null, $cookieFile);
            assert_equals(200, $status['code'], 'status should authenticate after completion');
            assert_true($status['body']['authenticated'] ?? false, 'status should authenticate operator');
            assert_equals('autenticado', $status['body']['status'] ?? '', 'status should expose autenticado');
            assert_equals('operator@example.com', $status['body']['operator']['email'] ?? '', 'operator email should match allowlist');
            assert_true(strlen((string) ($status['body']['csrfToken'] ?? '')) > 10, 'status should expose csrfToken');

            $logout = admin_auth_openclaw_request('POST', $serverBaseUrl, 'logout', [], $cookieFile);
            assert_equals(200, $logout['code'], 'logout should respond 200');
            assert_false($logout['body']['authenticated'] ?? true, 'logout should clear authentication');
            assert_equals('logout', $logout['body']['status'] ?? '', 'logout should expose logout status');
            assert_equals('openclaw_chatgpt', $logout['body']['mode'] ?? '', 'logout should preserve auth mode');
        } finally {
            admin_auth_openclaw_cleanup_cookie($cookieFile);
        }
    });

    run_test('admin-auth rejects legacy password login when openclaw mode is enabled', function () use ($serverBaseUrl) {
        $response = admin_auth_openclaw_request('POST', $serverBaseUrl, 'login', [
            'password' => 'should-not-work',
        ]);

        assert_equals(401, $response['code'], 'legacy login should be disabled');
        assert_false($response['body']['ok'] ?? true, 'disabled legacy login should not return ok');
        assert_true(
            str_contains((string) ($response['body']['error'] ?? ''), 'ya no esta disponible'),
            'error should explain that password auth is disabled'
        );
    });

    run_test('admin-auth honors explicit legacy override even when openclaw mode is configured', function () {
        $overrideDataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-legacy-override-' . uniqid('', true);
        $overrideServer = [];
        ensure_clean_directory($overrideDataDir);

        try {
            $overrideServer = start_test_php_server([
                'docroot' => __DIR__ . '/..',
                'env' => [
                    'PIELARMONIA_DATA_DIR' => $overrideDataDir,
                    'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
                    'PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY' => 'legacy_password',
                    'PIELARMONIA_ADMIN_PASSWORD' => 'legacy-override-secret',
                ] + operator_auth_test_env(),
                'startup_timeout_ms' => 12000,
            ]);

            $baseUrl = $overrideServer['base_url'];
            $cookieFile = admin_auth_openclaw_cookie_file();
            try {
                $status = admin_auth_openclaw_request('GET', $baseUrl, 'status', null, $cookieFile);
                assert_equals(200, $status['code'], 'status should respond 200');
                assert_equals('legacy_password', $status['body']['mode'] ?? '', 'explicit legacy override should win');
                assert_equals('anonymous', $status['body']['status'] ?? '', 'configured legacy auth should remain anonymous before login');

                $login = admin_auth_openclaw_request('POST', $baseUrl, 'login', [
                    'password' => 'legacy-override-secret',
                ], $cookieFile);
                assert_equals(200, $login['code'], 'legacy login should succeed when override is explicit');
                assert_true($login['body']['authenticated'] ?? false, 'legacy override login should authenticate');
                assert_true(strlen((string) ($login['body']['csrfToken'] ?? '')) > 10, 'legacy override login should expose csrfToken');
            } finally {
                admin_auth_openclaw_cleanup_cookie($cookieFile);
            }
        } finally {
            stop_test_php_server($overrideServer);
            delete_path_recursive($overrideDataDir);
        }
    });
} finally {
    stop_test_php_server($server);
    delete_path_recursive($dataDir);
}

print_test_summary();
