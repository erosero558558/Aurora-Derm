<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

function admin_status_request(string $baseUrl): array
{
    $ch = curl_init(rtrim($baseUrl, '/') . '/admin-auth.php?action=status');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $bodyRaw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'code' => $code,
        'body' => json_decode((string) $bodyRaw, true),
    ];
}

function admin_login_request(string $baseUrl, string $password): array
{
    $ch = curl_init(rtrim($baseUrl, '/') . '/admin-auth.php?action=login');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['password' => $password]));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    $bodyRaw = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return [
        'code' => $code,
        'body' => json_decode((string) $bodyRaw, true),
    ];
}

function with_admin_status_server(array $env, callable $callback): void
{
    $dataDir = sys_get_temp_dir() . '/pielarmonia-test-admin-status-' . uniqid('', true);
    $server = [];
    ensure_clean_directory($dataDir);

    try {
        $server = start_test_php_server([
            'docroot' => __DIR__ . '/..',
            'env' => [
                'PIELARMONIA_DATA_DIR' => $dataDir,
                'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
            ] + $env,
        ]);
        $callback($server['base_url']);
    } finally {
        stop_test_php_server($server);
        delete_path_recursive($dataDir);
    }
}

run_test('admin status prefers openclaw mode when consultorio auth is primary by default', function () {
    with_admin_status_server([], function (string $baseUrl): void {
        $status = admin_status_request($baseUrl);
        assert_equals(200, $status['code'], 'status should respond 200');
        assert_true($status['body']['ok'] ?? false, 'status payload should be ok');
        assert_false($status['body']['authenticated'] ?? true, 'missing password should not authenticate');
        assert_equals('openclaw_chatgpt', $status['body']['mode'] ?? '', 'openclaw mode should be explicit by default');
        assert_equals('operator_auth_not_configured', $status['body']['status'] ?? '', 'status should report missing operator auth setup');
        assert_false($status['body']['configured'] ?? true, 'configured should be false when operator auth is incomplete');
        assert_equals('openclaw_chatgpt', $status['body']['recommendedMode'] ?? '', 'recommended mode should preserve openclaw as primary');
        assert_false(
            $status['body']['fallbacks']['legacy_password']['available'] ?? true,
            'legacy contingency should stay unavailable by default'
        );
        assert_false(
            $status['body']['capabilities']['adminAgent'] ?? true,
            'anonymous openclaw status should not grant admin agent capabilities'
        );
    });
});

run_test('admin status reports legacy mode as misconfigured when password is missing and legacy auth is forced', function () {
    with_admin_status_server([
        'PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY' => 'legacy_password',
    ], function (string $baseUrl): void {
        $status = admin_status_request($baseUrl);
        assert_equals(200, $status['code'], 'status should respond 200');
        assert_true($status['body']['ok'] ?? false, 'status payload should be ok');
        assert_false($status['body']['authenticated'] ?? true, 'missing password should not authenticate');
        assert_equals('legacy_password', $status['body']['mode'] ?? '', 'legacy mode should be explicit');
        assert_equals('legacy_auth_not_configured', $status['body']['status'] ?? '', 'legacy status should report misconfiguration');
        assert_false($status['body']['configured'] ?? true, 'configured should be false when password missing');
        assert_equals('legacy_password', $status['body']['recommendedMode'] ?? '', 'recommended mode should follow forced legacy auth');
        assert_false(
            $status['body']['fallbacks']['legacy_password']['available'] ?? true,
            'forced legacy mode should not advertise the contingency fallback by default'
        );
        assert_false(
            $status['body']['capabilities']['adminAgent'] ?? true,
            'anonymous legacy status should not grant admin agent capabilities'
        );
    });
});

run_test('admin status reports legacy mode as configured when password exists and legacy auth is forced', function () {
    with_admin_status_server([
        'PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY' => 'legacy_password',
        'PIELARMONIA_ADMIN_PASSWORD' => 'status-test-password',
    ], function (string $baseUrl): void {
        $status = admin_status_request($baseUrl);
        assert_equals(200, $status['code'], 'status should respond 200');
        assert_true($status['body']['ok'] ?? false, 'status payload should be ok');
        assert_false($status['body']['authenticated'] ?? true, 'status should remain anonymous before login');
        assert_equals('legacy_password', $status['body']['mode'] ?? '', 'legacy mode should be explicit');
        assert_equals('anonymous', $status['body']['status'] ?? '', 'configured legacy auth should report anonymous status');
        assert_true($status['body']['configured'] ?? false, 'configured should be true when password exists');
        assert_equals('legacy_password', $status['body']['recommendedMode'] ?? '', 'recommended mode should stay aligned with legacy override');
        assert_false(
            $status['body']['fallbacks']['legacy_password']['available'] ?? true,
            'legacy primary mode should not expose contingency semantics'
        );
        assert_false(
            $status['body']['capabilities']['adminAgent'] ?? true,
            'legacy status should remain capability-free before authentication'
        );
    });
});

run_test('admin login rejects legacy password by default even when a password exists', function () {
    with_admin_status_server([
        'PIELARMONIA_ADMIN_PASSWORD' => 'status-test-password',
    ], function (string $baseUrl): void {
        $login = admin_login_request($baseUrl, 'status-test-password');
        assert_equals(401, $login['code'], 'legacy login should stay disabled without explicit override');
        assert_false($login['body']['ok'] ?? true, 'disabled legacy login should not return ok');
        assert_equals('legacy_auth_disabled', $login['body']['code'] ?? '', 'disabled legacy login should expose explicit code');
        assert_contains(
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true',
            (string) ($login['body']['error'] ?? ''),
            'legacy login should explain the fallback override'
        );
    });
});

run_test('admin status advertises legacy contingency when enabled with password and 2FA', function () {
    with_admin_status_server([
        'PIELARMONIA_ADMIN_PASSWORD' => 'status-test-password',
        'PIELARMONIA_ADMIN_2FA_SECRET' => 'JBSWY3DPEHPK3PXP',
        'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => 'true',
    ], function (string $baseUrl): void {
        $status = admin_status_request($baseUrl);
        assert_equals(200, $status['code'], 'status should respond 200');
        assert_equals('openclaw_chatgpt', $status['body']['mode'] ?? '', 'openclaw should remain primary');
        assert_true(
            $status['body']['fallbacks']['legacy_password']['enabled'] ?? false,
            'fallback should report the environment flag as enabled'
        );
        assert_true(
            $status['body']['fallbacks']['legacy_password']['configured'] ?? false,
            'fallback should report password + 2FA as configured'
        );
        assert_true(
            $status['body']['fallbacks']['legacy_password']['requires2FA'] ?? false,
            'fallback should require 2FA'
        );
        assert_true(
            $status['body']['fallbacks']['legacy_password']['available'] ?? false,
            'fallback should be available when password and 2FA are configured'
        );
        assert_equals(
            'fallback_available',
            $status['body']['fallbacks']['legacy_password']['reason'] ?? '',
            'fallback should expose the availability reason'
        );
    });
});

run_test('admin status does not advertise legacy contingency when 2FA is missing', function () {
    with_admin_status_server([
        'PIELARMONIA_ADMIN_PASSWORD' => 'status-test-password',
        'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => 'true',
    ], function (string $baseUrl): void {
        $status = admin_status_request($baseUrl);
        assert_equals(200, $status['code'], 'status should respond 200');
        assert_true(
            $status['body']['fallbacks']['legacy_password']['enabled'] ?? false,
            'fallback should reflect the environment flag even when incomplete'
        );
        assert_false(
            $status['body']['fallbacks']['legacy_password']['configured'] ?? true,
            'fallback should report missing 2FA as incomplete'
        );
        assert_false(
            $status['body']['fallbacks']['legacy_password']['available'] ?? true,
            'fallback should not be available without 2FA'
        );
        assert_equals(
            'admin_2fa_not_configured',
            $status['body']['fallbacks']['legacy_password']['reason'] ?? '',
            'fallback should explain that 2FA is missing'
        );
    });
});

print_test_summary();
