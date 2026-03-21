<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

function calendar_oauth_request(string $method, string $baseUrl, string $action, $data = null): array
{
    $url = rtrim($baseUrl, '/') . '/admin-auth.php?action=' . $action;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'Content-Type: application/json']);

    if ($data !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['code' => 0, 'body' => [], 'raw' => '', 'error' => $error];
    }

    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $rawBody = substr($response, $headerSize);
    curl_close($ch);

    return [
        'code' => $code,
        'body' => json_decode((string) $rawBody, true) ?: [],
        'raw' => (string) $rawBody,
    ];
}

$dataDir = sys_get_temp_dir() . '/pielarmonia-test-calendar-reauth-' . uniqid('', true);
$envPath = $dataDir . '/env.php';
$server = [];
$stubServer = [];

ensure_clean_directory($dataDir);
file_put_contents(
    $envPath,
    "<?php\n"
    . "putenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID=google-client-test');\n"
    . "putenv('PIELARMONIA_GOOGLE_OAUTH_CLIENT_SECRET=google-secret-test');\n"
    . "putenv('PIELARMONIA_GOOGLE_OAUTH_REFRESH_TOKEN=old-refresh-token');\n"
);

try {
    $host = test_server_host();
    $port = reserve_test_server_port(null, $host);
    $stubPort = reserve_test_server_port(null, $host);
    $stubBaseUrl = "http://{$host}:{$stubPort}";

    $stubServer = start_test_php_server([
        'docroot' => __DIR__ . '/..',
        'host' => $host,
        'port' => $stubPort,
        'env' => [
            'PIELARMONIA_SKIP_ENV_FILE' => 'true',
            'PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID' => 'google-client-test',
        ],
        'startup_timeout_ms' => 12000,
    ]);

    $server = start_test_php_server([
        'docroot' => __DIR__ . '/..',
        'host' => $host,
        'port' => $port,
        'env' => [
            'PIELARMONIA_SKIP_ENV_FILE' => 'true',
            'PIELARMONIA_DATA_DIR' => $dataDir,
            'PIELARMONIA_GOOGLE_CALENDAR_ENV_FILE' => $envPath,
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => 'operator@example.com',
            'PIELARMONIA_GOOGLE_OAUTH_CLIENT_ID' => 'google-client-test',
            'PIELARMONIA_GOOGLE_OAUTH_CLIENT_SECRET' => 'google-secret-test',
            'PIELARMONIA_GOOGLE_OAUTH_TOKEN_URL' => $stubBaseUrl . '/tests/google_oauth_stub.php?action=token',
            'PIELARMONIA_GOOGLE_OAUTH_TOKENINFO_URL' => $stubBaseUrl . '/tests/google_oauth_stub.php?action=tokeninfo',
            'PIELARMONIA_GOOGLE_SA_TOKEN_URI' => $stubBaseUrl . '/tests/google_oauth_stub.php?action=token',
            'PIELARMONIA_AVAILABILITY_SOURCE' => 'google',
        ],
        'startup_timeout_ms' => 12000,
    ]);

    $serverBaseUrl = $server['base_url'];

    run_test('calendar reauth start returns a Google auth URL from loopback', function () use ($serverBaseUrl) {
        $start = calendar_oauth_request('POST', $serverBaseUrl, 'calendar-token-start', []);
        assert_equals(202, $start['code'], 'start should create challenge');
        assert_true($start['body']['ok'] ?? false, 'start payload should be ok');
        assert_equals('pending', $start['body']['status'] ?? '', 'start should return pending');
        $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];
        assert_contains('accounts.google.com', (string) ($challenge['authUrl'] ?? ''), 'authUrl should point to Google');
    });

    run_test('calendar reauth callback updates env.php and exposes completed status', function () use ($serverBaseUrl, $envPath) {
        $start = calendar_oauth_request('POST', $serverBaseUrl, 'calendar-token-start', []);
        $challenge = is_array($start['body']['challenge'] ?? null) ? $start['body']['challenge'] : [];
        $authUrl = (string) ($challenge['authUrl'] ?? '');
        parse_str((string) parse_url($authUrl, PHP_URL_QUERY), $authQuery);
        $nonce = (string) ($authQuery['nonce'] ?? '');
        $state = rawurlencode((string) ($authQuery['state'] ?? ''));
        $code = rawurlencode($nonce . '|operator@example.com|google-sub-test|true|fresh-refresh-token');

        $callback = calendar_oauth_request('GET', $serverBaseUrl, 'oauth-callback&state=' . $state . '&code=' . $code);
        assert_equals(200, $callback['code'], 'callback should remain user-facing');
        assert_contains('Google Calendar reautorizado', $callback['raw'], 'callback should render success HTML');

        $status = calendar_oauth_request(
            'GET',
            $serverBaseUrl,
            'calendar-token-status&challengeId=' . rawurlencode((string) ($challenge['challengeId'] ?? ''))
        );
        assert_equals(200, $status['code'], 'status should return 200 after callback');
        assert_equals('completed', $status['body']['status'] ?? '', 'challenge should complete');
        assert_true($status['body']['challenge']['envUpdated'] ?? false, 'env should be updated');
        assert_true($status['body']['challenge']['tokenValidated'] ?? false, 'token should validate after update');
        assert_contains('fresh-refresh-token', file_get_contents($envPath) ?: '', 'env.php should receive the new refresh token');
    });
} finally {
    stop_test_php_server($server);
    stop_test_php_server($stubServer);
    delete_path_recursive($dataDir);
}

print_test_summary();
