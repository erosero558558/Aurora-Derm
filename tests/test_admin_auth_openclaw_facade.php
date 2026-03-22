<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/operator_auth_test_helper.php';
require_once __DIR__ . '/../lib/totp.php';

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

function admin_auth_openclaw_csrf_headers(string $baseUrl, ?string $cookieFile = null): array
{
    $status = admin_auth_openclaw_request('GET', $baseUrl, 'status', null, $cookieFile);
    $csrfToken = is_array($status['body'] ?? null)
        ? (string) ($status['body']['csrfToken'] ?? '')
        : '';
    if ($csrfToken === '') {
        throw new RuntimeException('admin-auth status no devolvio csrfToken para iniciar el flujo.');
    }

    return ['X-CSRF-Token: ' . $csrfToken];
}

function admin_auth_current_totp_code(string $secret): string
{
    $reflection = new ReflectionClass(TOTP::class);
    $method = $reflection->getMethod('getCode');
    $method->setAccessible(true);

    return (string) $method->invoke(null, $secret, time());
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
            assert_false(
                $status['body']['capabilities']['adminAgent'] ?? true,
                'anonymous facade status should not grant admin agent capabilities'
            );
        } finally {
            admin_auth_openclaw_cleanup_cookie($cookieFile);
        }
    });

    run_test('admin-auth start status logout completes an operator session through facade', function () use ($serverBaseUrl) {
        $cookieFile = admin_auth_openclaw_cookie_file();
        try {
            $start = admin_auth_openclaw_request(
                'POST',
                $serverBaseUrl,
                'start',
                [],
                $cookieFile,
                admin_auth_openclaw_csrf_headers($serverBaseUrl, $cookieFile)
            );
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
            assert_true(
                $status['body']['capabilities']['adminAgent'] ?? false,
                'authenticated operator should expose admin agent capabilities when editorial allowlist is open'
            );

            $logout = admin_auth_openclaw_request(
                'POST',
                $serverBaseUrl,
                'logout',
                [],
                $cookieFile,
                admin_auth_openclaw_csrf_headers($serverBaseUrl, $cookieFile)
            );
            assert_equals(200, $logout['code'], 'logout should respond 200');
            assert_false($logout['body']['authenticated'] ?? true, 'logout should clear authentication');
            assert_equals('logout', $logout['body']['status'] ?? '', 'logout should expose logout status');
            assert_equals('openclaw_chatgpt', $logout['body']['mode'] ?? '', 'logout should preserve auth mode');
            assert_false(
                $logout['body']['capabilities']['adminAgent'] ?? true,
                'logout should clear admin agent capabilities'
            );
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
        assert_equals('legacy_auth_disabled', $response['body']['code'] ?? '', 'disabled legacy login should expose legacy_auth_disabled');
        assert_true(
            str_contains((string) ($response['body']['error'] ?? ''), 'AURORADERM_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true'),
            'error should explain that the fallback flag is required'
        );
    });

    run_test('admin-auth allows legacy contingency login with 2FA when fallback is enabled under openclaw primary', function () {
        $overrideDataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-openclaw-fallback-' . uniqid('', true);
        $overrideServer = [];
        $totpSecret = 'JBSWY3DPEHPK3PXP';
        ensure_clean_directory($overrideDataDir);

        try {
            $overrideServer = start_test_php_server([
                'docroot' => __DIR__ . '/..',
                'env' => [
                    'PIELARMONIA_DATA_DIR' => $overrideDataDir,
                    'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
                    'PIELARMONIA_ADMIN_PASSWORD' => 'legacy-fallback-secret',
                    'PIELARMONIA_ADMIN_2FA_SECRET' => $totpSecret,
                    'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => 'true',
                ] + operator_auth_test_env(),
                'startup_timeout_ms' => 12000,
            ]);

            $baseUrl = $overrideServer['base_url'];
            $cookieFile = admin_auth_openclaw_cookie_file();
            try {
                $status = admin_auth_openclaw_request('GET', $baseUrl, 'status', null, $cookieFile);
                assert_equals(200, $status['code'], 'status should respond 200');
                assert_equals('openclaw_chatgpt', $status['body']['mode'] ?? '', 'openclaw should remain primary');
                assert_true(
                    $status['body']['fallbacks']['legacy_password']['available'] ?? false,
                    'fallback should be advertised when it is fully configured'
                );

                $login = admin_auth_openclaw_request('POST', $baseUrl, 'login', [
                    'password' => 'legacy-fallback-secret',
                ], $cookieFile);
                assert_equals(200, $login['code'], 'legacy contingency should reach the 2FA stage');
                assert_true($login['body']['twoFactorRequired'] ?? false, 'fallback should require 2FA');
                assert_equals('legacy_password', $login['body']['mode'] ?? '', 'login step should switch to legacy mode');
                assert_equals('openclaw_chatgpt', $login['body']['recommendedMode'] ?? '', 'openclaw should remain the recommended mode');

                $login2fa = admin_auth_openclaw_request('POST', $baseUrl, 'login-2fa', [
                    'code' => admin_auth_current_totp_code($totpSecret),
                ], $cookieFile);
                assert_equals(200, $login2fa['code'], '2FA should complete the fallback login');
                assert_true($login2fa['body']['authenticated'] ?? false, '2FA should authenticate the legacy fallback session');
                assert_equals('legacy_password', $login2fa['body']['mode'] ?? '', 'authenticated fallback should expose legacy mode');
                assert_equals('openclaw_chatgpt', $login2fa['body']['recommendedMode'] ?? '', 'authenticated fallback should preserve openclaw as primary');
                assert_true(
                    $login2fa['body']['capabilities']['adminAgent'] ?? false,
                    'authenticated fallback should still expose admin capabilities'
                );

                $statusAfterLogin = admin_auth_openclaw_request('GET', $baseUrl, 'status', null, $cookieFile);
                assert_equals(200, $statusAfterLogin['code'], 'status should respond after fallback login');
                assert_true($statusAfterLogin['body']['authenticated'] ?? false, 'status should restore the fallback session');
                assert_equals('legacy_password', $statusAfterLogin['body']['mode'] ?? '', 'status should expose the active fallback session mode');
                assert_equals('openclaw_chatgpt', $statusAfterLogin['body']['recommendedMode'] ?? '', 'status should preserve openclaw as the recommended mode');
            } finally {
                admin_auth_openclaw_cleanup_cookie($cookieFile);
            }
        } finally {
            stop_test_php_server($overrideServer);
            delete_path_recursive($overrideDataDir);
        }
    });

    run_test('admin-auth start devuelve redirectUrl y sin challenge cuando OpenClaw usa web_broker', function () {
        $overrideDataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-openclaw-web-broker-' . uniqid('', true);
        $overrideServer = [];
        ensure_clean_directory($overrideDataDir);

        try {
            $overrideServer = start_test_php_server([
                'docroot' => __DIR__ . '/..',
                'env' => [
                    'PIELARMONIA_DATA_DIR' => $overrideDataDir,
                    'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
                    'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => 'web_broker',
                    'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL' => 'https://broker.example.test/authorize',
                    'OPENCLAW_AUTH_BROKER_TOKEN_URL' => 'https://broker.example.test/token',
                    'OPENCLAW_AUTH_BROKER_USERINFO_URL' => 'https://broker.example.test/userinfo',
                    'OPENCLAW_AUTH_BROKER_CLIENT_ID' => 'broker-client-id',
                    'OPENCLAW_AUTH_BROKER_JWKS_URL' => 'https://broker.example.test/jwks',
                    'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER' => 'https://broker.example.test',
                    'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE' => 'broker-audience',
                    'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED' => 'true',
                ] + operator_auth_test_env(),
                'startup_timeout_ms' => 12000,
            ]);

            $cookieFile = admin_auth_openclaw_cookie_file();
            try {
                $start = admin_auth_openclaw_request(
                    'POST',
                    $overrideServer['base_url'],
                    'start',
                    [
                        'returnTo' => '/operador-turnos.html?station=c2',
                    ],
                    $cookieFile,
                    admin_auth_openclaw_csrf_headers($overrideServer['base_url'], $cookieFile)
                );

                assert_equals(202, $start['code'], 'web broker start should respond 202');
                assert_equals('pending', $start['body']['status'] ?? '', 'web broker start should remain pending');
                assert_equals('web_broker', $start['body']['transport'] ?? '', 'start should expose web_broker transport');
                assert_true(isset($start['body']['redirectUrl']), 'start should expose redirectUrl');
                assert_false(isset($start['body']['challenge']), 'web broker start should not expose helper challenge');
                assert_true(
                    str_contains((string) ($start['body']['redirectUrl'] ?? ''), 'https://broker.example.test/authorize'),
                    'redirectUrl should point to broker authorize endpoint'
                );
            } finally {
                admin_auth_openclaw_cleanup_cookie($cookieFile);
            }
        } finally {
            stop_test_php_server($overrideServer);
            delete_path_recursive($overrideDataDir);
        }
    });

    run_test('admin-auth status conserva pending con redirectUrl mientras el intento web siga vigente', function () {
        $overrideDataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-openclaw-web-broker-pending-' . uniqid('', true);
        $overrideServer = [];
        ensure_clean_directory($overrideDataDir);

        try {
            $overrideServer = start_test_php_server([
                'docroot' => __DIR__ . '/..',
                'env' => [
                    'PIELARMONIA_DATA_DIR' => $overrideDataDir,
                    'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
                    'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => 'web_broker',
                    'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL' => 'https://broker.example.test/authorize',
                    'OPENCLAW_AUTH_BROKER_TOKEN_URL' => 'https://broker.example.test/token',
                    'OPENCLAW_AUTH_BROKER_USERINFO_URL' => 'https://broker.example.test/userinfo',
                    'OPENCLAW_AUTH_BROKER_CLIENT_ID' => 'broker-client-id',
                    'OPENCLAW_AUTH_BROKER_JWKS_URL' => 'https://broker.example.test/jwks',
                    'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER' => 'https://broker.example.test',
                    'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE' => 'broker-audience',
                    'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED' => 'true',
                ] + operator_auth_test_env(),
                'startup_timeout_ms' => 12000,
            ]);

            $cookieFile = admin_auth_openclaw_cookie_file();
            try {
                $start = admin_auth_openclaw_request(
                    'POST',
                    $overrideServer['base_url'],
                    'start',
                    [
                        'returnTo' => '/admin.html?resume=web-broker',
                    ],
                    $cookieFile,
                    admin_auth_openclaw_csrf_headers($overrideServer['base_url'], $cookieFile)
                );
                assert_equals(202, $start['code'], 'web broker start should respond 202');

                $status = admin_auth_openclaw_request('GET', $overrideServer['base_url'], 'status', null, $cookieFile);
                assert_equals(200, $status['code'], 'status should respond 200');
                assert_equals('pending', $status['body']['status'] ?? '', 'status should preserve pending while callback is missing');
                assert_equals('web_broker', $status['body']['transport'] ?? '', 'status should preserve web_broker transport');
                assert_equals(
                    (string) ($start['body']['redirectUrl'] ?? ''),
                    (string) ($status['body']['redirectUrl'] ?? ''),
                    'status should keep the same redirectUrl while the attempt is active'
                );
                assert_equals(
                    (string) ($start['body']['expiresAt'] ?? ''),
                    (string) ($status['body']['expiresAt'] ?? ''),
                    'status should keep the same expiry while the attempt is active'
                );
            } finally {
                admin_auth_openclaw_cleanup_cookie($cookieFile);
            }
        } finally {
            stop_test_php_server($overrideServer);
            delete_path_recursive($overrideDataDir);
        }
    });

    run_test('admin-auth status sigue configurado con allowlist restringida para web_broker', function () {
        $overrideDataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-openclaw-web-broker-allowlist-' . uniqid('', true);
        $overrideServer = [];
        ensure_clean_directory($overrideDataDir);

        try {
            $overrideServer = start_test_php_server([
                'docroot' => __DIR__ . '/..',
                'env' => [
                    'PIELARMONIA_DATA_DIR' => $overrideDataDir,
                    'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
                    'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => 'web_broker',
                    'PIELARMONIA_ADMIN_EMAIL' => 'restricted.operator@example.com',
                    'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => 'restricted.operator@example.com',
                    'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL' => 'false',
                    'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL' => 'https://broker.example.test/authorize',
                    'OPENCLAW_AUTH_BROKER_TOKEN_URL' => 'https://broker.example.test/token',
                    'OPENCLAW_AUTH_BROKER_USERINFO_URL' => 'https://broker.example.test/userinfo',
                    'OPENCLAW_AUTH_BROKER_CLIENT_ID' => 'broker-client-id',
                    'OPENCLAW_AUTH_BROKER_JWKS_URL' => 'https://broker.example.test/jwks',
                    'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER' => 'https://broker.example.test',
                    'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE' => 'broker-audience',
                    'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED' => 'true',
                ] + operator_auth_test_env(),
                'startup_timeout_ms' => 12000,
            ]);

            $cookieFile = admin_auth_openclaw_cookie_file();
            try {
                $status = admin_auth_openclaw_request('GET', $overrideServer['base_url'], 'status', null, $cookieFile);
                assert_equals(200, $status['code'], 'status should respond 200');
                assert_true($status['body']['configured'] ?? false, 'web broker should remain configured with explicit allowlist');
                assert_equals('openclaw_chatgpt', $status['body']['mode'] ?? '', 'status should preserve openclaw mode');
                assert_equals('web_broker', $status['body']['transport'] ?? '', 'status should preserve web_broker transport');
                assert_false($status['body']['authenticated'] ?? true, 'anonymous status should remain unauthenticated before redirect');
                assert_equals('anonymous', $status['body']['status'] ?? '', 'restricted profile should remain anonymous until redirect starts');
                assert_false(
                    $status['body']['fallbacks']['legacy_password']['available'] ?? true,
                    'legacy fallback should remain hidden in the restricted web_broker profile'
                );
            } finally {
                admin_auth_openclaw_cleanup_cookie($cookieFile);
            }
        } finally {
            stop_test_php_server($overrideServer);
            delete_path_recursive($overrideDataDir);
        }
    });

    run_test('admin-auth expone transport_misconfigured cuando OpenClaw no declara transporte explicito', function () {
        $overrideDataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-auth-openclaw-missing-transport-' . uniqid('', true);
        $overrideServer = [];
        ensure_clean_directory($overrideDataDir);

        try {
            $overrideServer = start_test_php_server([
                'docroot' => __DIR__ . '/..',
                'env' => [
                    'PIELARMONIA_DATA_DIR' => $overrideDataDir,
                    'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
                ] + operator_auth_test_env([
                    'transport' => '',
                ]),
                'startup_timeout_ms' => 12000,
            ]);

            $cookieFile = admin_auth_openclaw_cookie_file();
            try {
                $status = admin_auth_openclaw_request('GET', $overrideServer['base_url'], 'status', null, $cookieFile);
                assert_equals(200, $status['code'], 'status should respond 200');
                assert_false($status['body']['configured'] ?? true, 'missing transport should fail closed');
                assert_equals('transport_misconfigured', $status['body']['status'] ?? '', 'missing transport should expose transport_misconfigured');
                assert_equals('', $status['body']['transport'] ?? '', 'transport should remain blank when misconfigured');
                assert_true(
                    str_contains((string) ($status['body']['error'] ?? ''), 'AURORADERM_OPERATOR_AUTH_TRANSPORT'),
                    'error should point to explicit transport configuration'
                );
            } finally {
                admin_auth_openclaw_cleanup_cookie($cookieFile);
            }
        } finally {
            stop_test_php_server($overrideServer);
            delete_path_recursive($overrideDataDir);
        }
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
                assert_true(
                    $login['body']['capabilities']['adminAgent'] ?? false,
                    'legacy override login should expose admin agent capabilities'
                );
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
