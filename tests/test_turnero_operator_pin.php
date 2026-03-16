<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/operator_auth_test_helper.php';

$dataDir = sys_get_temp_dir() . '/pielarmonia-test-turnero-operator-pin-' . uniqid('', true);
$server = [];

ensure_clean_directory($dataDir);
putenv('PIELARMONIA_DATA_DIR=' . $dataDir);
putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
putenv('PIELARMONIA_SKIP_ENV_FILE=true');
ob_start();
register_shutdown_function(static function (): void {
    while (ob_get_level() > 0) {
        ob_end_flush();
    }
});

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';

start_secure_session();
ensure_data_file();

function turnero_operator_pin_test_cookie_file(): string
{
    $path = tempnam(sys_get_temp_dir(), 'turnero-operator-pin-cookie-');
    if ($path === false) {
        throw new RuntimeException('No se pudo crear el archivo temporal de cookies.');
    }

    return $path;
}

function turnero_operator_pin_test_cleanup_cookie(string $path): void
{
    if ($path !== '' && file_exists($path)) {
        @unlink($path);
    }
}

function turnero_operator_pin_api_request(
    string $method,
    string $serverBaseUrl,
    string $resource,
    $data = null,
    ?string $cookieFile = null,
    array $headers = []
): array {
    $url = rtrim($serverBaseUrl, '/') . '/api.php?resource=' . rawurlencode($resource);

    return operator_auth_test_http_request(
        $method,
        $url,
        $data,
        $cookieFile,
        $headers
    );
}

function turnero_operator_pin_admin_login(string $serverBaseUrl, string $cookieFile): array
{
    return operator_auth_test_http_request(
        'POST',
        rtrim($serverBaseUrl, '/') . '/admin-auth.php?action=login',
        [
            'password' => 'turnero-v2-admin-secret',
        ],
        $cookieFile
    );
}

function turnero_operator_pin_admin_csrf_headers(string $serverBaseUrl, string $cookieFile): array
{
    $status = operator_auth_test_http_request(
        'GET',
        rtrim($serverBaseUrl, '/') . '/admin-auth.php?action=status',
        null,
        $cookieFile
    );
    $csrfToken = is_array($status['body'] ?? null)
        ? (string) ($status['body']['csrfToken'] ?? '')
        : '';
    if ($csrfToken === '') {
        throw new RuntimeException('admin-auth status no devolvio csrfToken.');
    }

    return ['X-CSRF-Token: ' . $csrfToken];
}

try {
    run_test('Turnero operator access guarda el PIN con hash y metadata enmascarada', function (): void {
        turnero_operator_session_clear();

        $result = turnero_operator_access_rotate([
            'pin' => '2468',
            'session_ttl_hours' => 6,
        ]);

        assert_true($result['ok'] ?? false, 'rotation should succeed');
        assert_equals('rotated', $result['status'] ?? '', 'unexpected rotation status');
        assert_equals('2468', $result['pin'] ?? '', 'explicit pin should be returned once');
        assert_false($result['generated'] ?? true, 'explicit pin should not be flagged as generated');
        assert_true(
            $result['turneroOperatorAccessMeta']['configured'] ?? false,
            'metadata should report configured pin'
        );
        assert_equals(
            '****',
            $result['turneroOperatorAccessMeta']['maskedPinLabel'] ?? '',
            'masked label should preserve only the digit count'
        );
        assert_equals(
            6,
            $result['turneroOperatorAccessMeta']['sessionTtlHours'] ?? 0,
            'session ttl should be preserved in metadata'
        );

        $record = turnero_operator_access_read_record('piel-armonia-quito');
        assert_equals('piel-armonia-quito', $record['clinic_id'] ?? '', 'record clinic mismatch');
        assert_true(
            is_string($record['pin_hash'] ?? null) && ($record['pin_hash'] ?? '') !== '',
            'pin hash should be stored'
        );
        assert_false(($record['pin_hash'] ?? '') === '2468', 'pin must not be stored in clear text');
        assert_true(
            password_verify('2468', (string) ($record['pin_hash'] ?? '')),
            'stored pin hash should validate the configured pin'
        );
        assert_equals(6, $record['session_ttl_hours'] ?? 0, 'stored ttl mismatch');
    });

    run_test('Turnero operator session expira y fuerza relogin cuando el PIN rota', function (): void {
        turnero_operator_session_clear();
        turnero_operator_access_rotate([
            'pin' => '2468',
            'session_ttl_hours' => 2,
        ]);

        $login = turnero_operator_login_payload('2468');
        assert_true($login['authenticated'] ?? false, 'login should authenticate');
        assert_true(
            strlen((string) ($login['csrfToken'] ?? '')) > 10,
            'login should expose csrf token'
        );

        $_SESSION[TURNERO_OPERATOR_SESSION_KEY]['expiresAt'] = gmdate('c', time() - 30);
        $expired = turnero_operator_session_status_payload();
        assert_false($expired['authenticated'] ?? true, 'expired session should be cleared');
        assert_equals('anonymous', $expired['status'] ?? '', 'expired session should fall back to anonymous');

        turnero_operator_access_rotate([
            'pin' => '1357',
            'session_ttl_hours' => 8,
        ]);

        try {
            turnero_operator_login_payload('2468');
            throw new RuntimeException('El PIN previo no debio seguir autenticando.');
        } catch (RuntimeException $error) {
            assert_equals('PIN incorrecto', $error->getMessage(), 'old pin should be invalid after rotation');
        }

        $freshLogin = turnero_operator_login_payload('1357');
        assert_true($freshLogin['authenticated'] ?? false, 'new pin should authenticate');
        assert_equals(
            8,
            $freshLogin['turneroOperatorAccessMeta']['sessionTtlHours'] ?? 0,
            'new ttl should be reflected after rotation'
        );
    });

    $server = start_test_php_server([
        'docroot' => __DIR__ . '/..',
        'env' => [
            'PIELARMONIA_DATA_DIR' => $dataDir,
            'PIELARMONIA_AVAILABILITY_SOURCE' => 'store',
            'PIELARMONIA_SKIP_ENV_FILE' => 'true',
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY' => 'legacy_password',
            'PIELARMONIA_ADMIN_PASSWORD' => 'turnero-v2-admin-secret',
        ],
        'startup_timeout_ms' => 12000,
    ]);

    $serverBaseUrl = $server['base_url'];

    run_test('Turnero operator PIN rota, autentica y cierra sesion por API', function () use ($serverBaseUrl): void {
        $adminCookie = turnero_operator_pin_test_cookie_file();
        $operatorCookie = turnero_operator_pin_test_cookie_file();

        try {
            $queueDenied = turnero_operator_pin_api_request(
                'POST',
                $serverBaseUrl,
                'queue-call-next',
                []
            );
            assert_equals(401, $queueDenied['code'], 'queue actions must reject anonymous access');

            $anonymousStatus = turnero_operator_pin_api_request(
                'GET',
                $serverBaseUrl,
                'operator-session-status'
            );
            assert_equals(200, $anonymousStatus['code'], 'session status should be public');
            assert_false(
                $anonymousStatus['body']['authenticated'] ?? true,
                'session status should start anonymous'
            );
            assert_true(
                in_array(
                    $anonymousStatus['body']['status'] ?? '',
                    ['authenticated', 'anonymous', 'operator_pin_not_configured'],
                    true
                ),
                'unexpected anonymous status'
            );

            $rotateWithoutAdmin = turnero_operator_pin_api_request(
                'POST',
                $serverBaseUrl,
                'operator-pin-rotate',
                [
                    'pin' => '2468',
                ]
            );
            assert_equals(401, $rotateWithoutAdmin['code'], 'rotate should require admin session');

            $adminLogin = turnero_operator_pin_admin_login($serverBaseUrl, $adminCookie);
            assert_equals(200, $adminLogin['code'], 'legacy admin login should succeed under forced legacy mode');
            assert_true($adminLogin['body']['authenticated'] ?? false, 'admin session should authenticate');

            $rotate = turnero_operator_pin_api_request(
                'POST',
                $serverBaseUrl,
                'operator-pin-rotate',
                [
                    'pin' => '2468',
                    'session_ttl_hours' => 6,
                ],
                $adminCookie,
                turnero_operator_pin_admin_csrf_headers($serverBaseUrl, $adminCookie)
            );
            assert_equals(200, $rotate['code'], 'admin should rotate the operator pin');
            assert_true($rotate['body']['ok'] ?? false, 'rotate response should be ok');
            assert_equals('2468', $rotate['body']['pin'] ?? '', 'rotate should return the configured pin once');
            assert_equals(
                6,
                $rotate['body']['turneroOperatorAccessMeta']['sessionTtlHours'] ?? 0,
                'rotate should return ttl metadata'
            );
            assert_true(
                $rotate['body']['turneroOperatorAccessMeta']['configured'] ?? false,
                'rotate should mark the operator access as configured'
            );

            $login = turnero_operator_pin_api_request(
                'POST',
                $serverBaseUrl,
                'operator-pin-login',
                [
                    'pin' => '2468',
                ],
                $operatorCookie
            );
            assert_equals(200, $login['code'], 'operator pin login should succeed');
            assert_true($login['body']['authenticated'] ?? false, 'operator pin login should authenticate');
            assert_equals('authenticated', $login['body']['status'] ?? '', 'login status mismatch');
            assert_equals('operator_pin', $login['body']['mode'] ?? '', 'operator mode mismatch');
            assert_true(
                strlen((string) ($login['body']['csrfToken'] ?? '')) > 10,
                'operator login should expose csrf token'
            );

            $session = turnero_operator_pin_api_request(
                'GET',
                $serverBaseUrl,
                'operator-session-status',
                null,
                $operatorCookie
            );
            assert_equals(200, $session['code'], 'session status should respond');
            assert_true($session['body']['authenticated'] ?? false, 'session should stay authenticated');
            assert_equals(
                'piel-armonia-quito',
                $session['body']['operator']['clinicId'] ?? '',
                'operator session should keep the active clinic'
            );

            $logout = turnero_operator_pin_api_request(
                'POST',
                $serverBaseUrl,
                'operator-pin-logout',
                [],
                $operatorCookie,
                ['X-CSRF-Token: ' . (string) ($login['body']['csrfToken'] ?? '')]
            );
            assert_equals(200, $logout['code'], 'logout should succeed with queue operator csrf');
            assert_false($logout['body']['authenticated'] ?? true, 'logout should clear authentication');
            assert_equals('logout', $logout['body']['status'] ?? '', 'logout status mismatch');

            $afterLogout = turnero_operator_pin_api_request(
                'GET',
                $serverBaseUrl,
                'operator-session-status',
                null,
                $operatorCookie
            );
            assert_equals(200, $afterLogout['code'], 'session status should remain available after logout');
            assert_false($afterLogout['body']['authenticated'] ?? true, 'session should be anonymous after logout');
            assert_equals('anonymous', $afterLogout['body']['status'] ?? '', 'post-logout status mismatch');
        } finally {
            turnero_operator_pin_test_cleanup_cookie($adminCookie);
            turnero_operator_pin_test_cleanup_cookie($operatorCookie);
        }
    });
} finally {
    stop_test_php_server($server);
    delete_path_recursive($dataDir);
}

print_test_summary();
