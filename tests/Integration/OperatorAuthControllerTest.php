<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
class OperatorAuthControllerTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [
            'HTTP_HOST' => '127.0.0.1:8011',
            'REQUEST_METHOD' => 'GET',
            'REMOTE_ADDR' => '127.0.0.1',
        ];

        $this->tempDir = sys_get_temp_dir() . '/test_operator_auth_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_SKIP_ENV_FILE=true');
        putenv('PIELARMONIA_OPERATOR_AUTH_MODE=openclaw_chatgpt');
        putenv('PIELARMONIA_OPERATOR_AUTH_ALLOWLIST=operator@example.com');
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN=operator-auth-bridge-test-token');
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET=operator-auth-bridge-test-secret');
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER=Authorization');
        putenv('PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL=http://127.0.0.1:8011');
        putenv('PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL=http://127.0.0.1:4173');
        putenv('PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS=300');
        putenv('PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS=1800');
        putenv('PIELARMONIA_OPERATOR_AUTH_TRANSPORT');
        putenv('PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL');
        putenv('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL');
        putenv('OPENCLAW_AUTH_BROKER_TOKEN_URL');
        putenv('OPENCLAW_AUTH_BROKER_USERINFO_URL');
        putenv('OPENCLAW_AUTH_BROKER_CLIENT_ID');
        putenv('OPENCLAW_AUTH_BROKER_CLIENT_SECRET');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/OperatorAuthController.php';
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_SKIP_ENV_FILE');
        putenv('PIELARMONIA_OPERATOR_AUTH_MODE');
        putenv('PIELARMONIA_OPERATOR_AUTH_ALLOWLIST');
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN');
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET');
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER');
        putenv('PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL');
        putenv('PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL');
        putenv('PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS');
        putenv('PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS');
        putenv('PIELARMONIA_OPERATOR_AUTH_TRANSPORT');
        putenv('PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL');
        putenv('OPENCLAW_AUTH_BROKER_AUTHORIZE_URL');
        putenv('OPENCLAW_AUTH_BROKER_TOKEN_URL');
        putenv('OPENCLAW_AUTH_BROKER_USERINFO_URL');
        putenv('OPENCLAW_AUTH_BROKER_CLIENT_ID');
        putenv('OPENCLAW_AUTH_BROKER_CLIENT_SECRET');
        putenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK');
        putenv('PIELARMONIA_ADMIN_PASSWORD');
        putenv('PIELARMONIA_ADMIN_PASSWORD_HASH');
        putenv('PIELARMONIA_ADMIN_2FA_SECRET');
        unset(
            $GLOBALS['__TEST_RESPONSE'],
            $GLOBALS['__TEST_JSON_BODY'],
            $GLOBALS['__TEST_REDIRECT'],
            $GLOBALS['__OPERATOR_AUTH_HTTP_CLIENT']
        );
        $_GET = [];
        $_POST = [];
        $_SESSION = [];
        $_SERVER = [];

        if (session_status() === PHP_SESSION_ACTIVE) {
            session_write_close();
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testStartCompleteAndStatusAuthenticateAllowedOperator(): void
    {
        $start = $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');

        self::assertSame(202, $start['status']);
        self::assertTrue((bool) ($start['payload']['ok'] ?? false));
        self::assertSame('pending', (string) ($start['payload']['status'] ?? ''));

        $challenge = $start['payload']['challenge'] ?? [];
        self::assertSame(32, strlen((string) ($challenge['challengeId'] ?? '')));
        self::assertStringContainsString('127.0.0.1:4173/resolve', (string) ($challenge['helperUrl'] ?? ''));

        $bridgePayload = [
            'challengeId' => (string) ($challenge['challengeId'] ?? ''),
            'nonce' => (string) ($challenge['nonce'] ?? ''),
            'status' => 'completed',
            'email' => 'operator@example.com',
            'profileId' => 'openai-codex:test-profile',
            'accountId' => 'acct-test-operator',
            'deviceId' => 'device-test-01',
            'timestamp' => gmdate('c'),
        ];
        $bridgePayload['signature'] = hash_hmac(
            'sha256',
            \operator_auth_bridge_signature_payload($bridgePayload),
            'operator-auth-bridge-test-secret'
        );

        $complete = $this->captureResponse(
            static fn () => \OperatorAuthController::complete([]),
            'POST',
            $bridgePayload,
            ['HTTP_AUTHORIZATION' => 'Bearer operator-auth-bridge-test-token']
        );

        self::assertSame(202, $complete['status']);
        self::assertTrue((bool) ($complete['payload']['ok'] ?? false));
        self::assertTrue((bool) ($complete['payload']['accepted'] ?? false));
        self::assertSame('completed', (string) ($complete['payload']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        self::assertTrue((bool) ($status['payload']['authenticated'] ?? false));
        self::assertSame('autenticado', (string) ($status['payload']['status'] ?? ''));
        self::assertSame('operator@example.com', (string) ($status['payload']['operator']['email'] ?? ''));
        self::assertNotSame('', (string) ($status['payload']['csrfToken'] ?? ''));

        $logout = $this->captureResponse(static fn () => \OperatorAuthController::logout([]), 'POST');
        self::assertSame(200, $logout['status']);
        self::assertSame('logout', (string) ($logout['payload']['status'] ?? ''));
    }

    public function testDeniedEmailIsSurfacedToClient(): void
    {
        $start = $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $challenge = $start['payload']['challenge'] ?? [];

        $bridgePayload = [
            'challengeId' => (string) ($challenge['challengeId'] ?? ''),
            'nonce' => (string) ($challenge['nonce'] ?? ''),
            'status' => 'completed',
            'email' => 'intruso@example.com',
            'profileId' => 'openai-codex:test-profile',
            'accountId' => 'acct-test-operator',
            'deviceId' => 'device-test-02',
            'timestamp' => gmdate('c'),
        ];
        $bridgePayload['signature'] = hash_hmac(
            'sha256',
            \operator_auth_bridge_signature_payload($bridgePayload),
            'operator-auth-bridge-test-secret'
        );

        $complete = $this->captureResponse(
            static fn () => \OperatorAuthController::complete([]),
            'POST',
            $bridgePayload,
            ['HTTP_AUTHORIZATION' => 'Bearer operator-auth-bridge-test-token']
        );

        self::assertSame(403, $complete['status']);
        self::assertFalse((bool) ($complete['payload']['accepted'] ?? true));
        self::assertSame('email_no_permitido', (string) ($complete['payload']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));
        self::assertSame('email_no_permitido', (string) ($status['payload']['status'] ?? ''));
    }

    public function testStartReturnsSetupPayloadWhenConfigIsIncomplete(): void
    {
        putenv('PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN');

        $response = $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');

        self::assertSame(200, $response['status']);
        self::assertTrue((bool) ($response['payload']['ok'] ?? false));
        self::assertFalse((bool) ($response['payload']['configured'] ?? true));
        self::assertSame(
            'operator_auth_not_configured',
            (string) ($response['payload']['status'] ?? '')
        );
        self::assertContains(
            'bridge_token',
            $response['payload']['configuration']['missing'] ?? []
        );
    }

    public function testStatusAdvertisesLegacyContingencyWhenEnabledAndConfigured(): void
    {
        putenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true');
        putenv('PIELARMONIA_ADMIN_PASSWORD_HASH=' . password_hash('contingencia-segura', PASSWORD_DEFAULT));
        putenv('PIELARMONIA_ADMIN_2FA_SECRET=JBSWY3DPEHPK3PXP');

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        self::assertSame('openclaw_chatgpt', (string) ($status['payload']['mode'] ?? ''));
        self::assertSame('openclaw_chatgpt', (string) ($status['payload']['recommendedMode'] ?? ''));
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));

        $fallback = $status['payload']['fallbacks']['legacy_password'] ?? [];
        self::assertTrue((bool) ($fallback['enabled'] ?? false));
        self::assertTrue((bool) ($fallback['configured'] ?? false));
        self::assertTrue((bool) ($fallback['requires2FA'] ?? false));
        self::assertTrue((bool) ($fallback['available'] ?? false));
        self::assertSame('fallback_available', (string) ($fallback['reason'] ?? ''));
    }

    public function testStatusDoesNotAdvertiseLegacyContingencyWhenTwoFactorIsMissing(): void
    {
        putenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK=true');
        putenv('PIELARMONIA_ADMIN_PASSWORD_HASH=' . password_hash('contingencia-segura', PASSWORD_DEFAULT));
        putenv('PIELARMONIA_ADMIN_2FA_SECRET');

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        $fallback = $status['payload']['fallbacks']['legacy_password'] ?? [];
        self::assertTrue((bool) ($fallback['enabled'] ?? false));
        self::assertFalse((bool) ($fallback['available'] ?? true));
        self::assertSame('admin_2fa_not_configured', (string) ($fallback['reason'] ?? ''));
    }

    public function testInvalidBridgeSignatureIsRejected(): void
    {
        $start = $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $challenge = $start['payload']['challenge'] ?? [];

        $bridgePayload = [
            'challengeId' => (string) ($challenge['challengeId'] ?? ''),
            'nonce' => (string) ($challenge['nonce'] ?? ''),
            'status' => 'completed',
            'email' => 'operator@example.com',
            'profileId' => 'openai-codex:test-profile',
            'accountId' => 'acct-test-operator',
            'deviceId' => 'device-test-03',
            'timestamp' => gmdate('c'),
            'signature' => str_repeat('0', 64),
        ];

        $complete = $this->captureResponse(
            static fn () => \OperatorAuthController::complete([]),
            'POST',
            $bridgePayload,
            ['HTTP_AUTHORIZATION' => 'Bearer operator-auth-bridge-test-token']
        );

        self::assertSame(401, $complete['status']);
        self::assertFalse((bool) ($complete['payload']['ok'] ?? true));
        self::assertSame(
            'Firma del bridge invalida',
            (string) ($complete['payload']['error'] ?? '')
        );
    }

    public function testTimestampOutsideWindowIsRejected(): void
    {
        $start = $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $challenge = $start['payload']['challenge'] ?? [];

        $bridgePayload = [
            'challengeId' => (string) ($challenge['challengeId'] ?? ''),
            'nonce' => (string) ($challenge['nonce'] ?? ''),
            'status' => 'completed',
            'email' => 'operator@example.com',
            'profileId' => 'openai-codex:test-profile',
            'accountId' => 'acct-test-operator',
            'deviceId' => 'device-test-04',
            'timestamp' => gmdate('c', time() - 3600),
        ];
        $bridgePayload['signature'] = hash_hmac(
            'sha256',
            \operator_auth_bridge_signature_payload($bridgePayload),
            'operator-auth-bridge-test-secret'
        );

        $complete = $this->captureResponse(
            static fn () => \OperatorAuthController::complete([]),
            'POST',
            $bridgePayload,
            ['HTTP_AUTHORIZATION' => 'Bearer operator-auth-bridge-test-token']
        );

        self::assertSame(400, $complete['status']);
        self::assertFalse((bool) ($complete['payload']['ok'] ?? true));
        self::assertSame(
            'Timestamp del bridge fuera de ventana',
            (string) ($complete['payload']['error'] ?? '')
        );
    }

    public function testWebBrokerStartReturnsRedirectUrlWithoutChallenge(): void
    {
        $this->configureWebBrokerTransport();

        $start = $this->captureResponse(
            static fn () => \OperatorAuthController::start([]),
            'POST',
            [
                'returnTo' => '/operador-turnos.html?station=c2',
            ]
        );

        self::assertSame(202, $start['status']);
        self::assertTrue((bool) ($start['payload']['ok'] ?? false));
        self::assertSame('web_broker', (string) ($start['payload']['transport'] ?? ''));
        self::assertSame('pending', (string) ($start['payload']['status'] ?? ''));
        self::assertArrayNotHasKey('challenge', $start['payload']);
        self::assertNotSame('', (string) ($start['payload']['redirectUrl'] ?? ''));
        self::assertStringContainsString(
            'https://broker.example.test/authorize',
            (string) ($start['payload']['redirectUrl'] ?? '')
        );
        self::assertNotSame('', (string) ($start['payload']['expiresAt'] ?? ''));
    }

    public function testWebBrokerStatusKeepsPendingAttemptAvailableUntilCallback(): void
    {
        $this->configureWebBrokerTransport();

        $start = $this->captureResponse(
            static fn () => \OperatorAuthController::start([]),
            'POST',
            [
                'returnTo' => '/admin.html?resume=web-broker',
            ]
        );

        self::assertSame(202, $start['status']);
        self::assertIsArray($_SESSION['operator_auth_pending_web_state'] ?? null);

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));
        self::assertSame('web_broker', (string) ($status['payload']['transport'] ?? ''));
        self::assertSame('pending', (string) ($status['payload']['status'] ?? ''));
        self::assertSame(
            (string) ($start['payload']['redirectUrl'] ?? ''),
            (string) ($status['payload']['redirectUrl'] ?? '')
        );
        self::assertSame(
            (string) ($start['payload']['expiresAt'] ?? ''),
            (string) ($status['payload']['expiresAt'] ?? '')
        );
        self::assertIsArray($_SESSION['operator_auth_pending_web_state'] ?? null);
    }

    public function testWebBrokerExpiredPendingAttemptReturnsInvalidStateOnce(): void
    {
        $this->configureWebBrokerTransport();

        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        self::assertIsArray($_SESSION['operator_auth_pending_web_state'] ?? null);
        $_SESSION['operator_auth_pending_web_state']['expiresAt'] = gmdate('c', time() - 60);

        $firstStatus = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertSame(200, $firstStatus['status']);
        self::assertFalse((bool) ($firstStatus['payload']['authenticated'] ?? true));
        self::assertSame('invalid_state', (string) ($firstStatus['payload']['status'] ?? ''));
        self::assertArrayNotHasKey('redirectUrl', $firstStatus['payload']);
        self::assertNull($_SESSION['operator_auth_pending_web_state'] ?? null);

        $secondStatus = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertSame(200, $secondStatus['status']);
        self::assertFalse((bool) ($secondStatus['payload']['authenticated'] ?? true));
        self::assertSame('anonymous', (string) ($secondStatus['payload']['status'] ?? ''));
    }

    public function testWebBrokerCallbackAuthenticatesAndReusesSession(): void
    {
        $this->configureWebBrokerTransport();
        $start = $this->captureResponse(
            static fn () => \OperatorAuthController::start([]),
            'POST',
            [
                'returnTo' => '/operador-turnos.html?station=c2',
            ]
        );
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $GLOBALS['__OPERATOR_AUTH_HTTP_CLIENT'] = static function (
            string $method,
            string $url,
            array $options = []
        ): array {
            if ($method === 'POST' && $url === 'https://broker.example.test/token') {
                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => [
                        'access_token' => 'token-web-broker-test',
                    ],
                ];
            }

            if ($method === 'GET' && $url === 'https://broker.example.test/userinfo') {
                self::assertSame(
                    'Bearer token-web-broker-test',
                    (string) (($options['headers']['Authorization'] ?? ''))
                );

                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => [
                        'email' => 'operator@example.com',
                        'sub' => 'profile-web-broker',
                        'accountId' => 'acct-web-broker',
                    ],
                ];
            }

            self::fail('Unexpected broker request: ' . $method . ' ' . $url);
        };

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'web-broker-auth-code',
            ]
        );

        self::assertSame(302, $redirect['status']);
        self::assertSame(
            '/operador-turnos.html?station=c2',
            (string) ($redirect['location'] ?? '')
        );
        self::assertSame('authenticated', (string) ($redirect['result']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertSame(200, $status['status']);
        self::assertTrue((bool) ($status['payload']['authenticated'] ?? false));
        self::assertSame('web_broker', (string) ($status['payload']['transport'] ?? ''));
        self::assertSame('operator@example.com', (string) ($status['payload']['operator']['email'] ?? ''));
        self::assertTrue((bool) ($status['payload']['capabilities']['adminAgent'] ?? false));
    }

    public function testWebBrokerInvalidStateDoesNotAuthenticate(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => 'invalid-state',
                'code' => 'code-ignored',
            ]
        );

        self::assertSame('invalid_state', (string) ($redirect['result']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));
        self::assertSame('invalid_state', (string) ($status['payload']['status'] ?? ''));
    }

    public function testWebBrokerExpiredCallbackDoesNotAuthenticate(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        self::assertIsArray($_SESSION['operator_auth_pending_web_state'] ?? null);
        $_SESSION['operator_auth_pending_web_state']['expiresAt'] = gmdate('c', time() - 60);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($_SESSION['operator_auth_pending_web_state']['state'] ?? ''),
                'code' => 'expired-code',
            ]
        );

        self::assertSame('invalid_state', (string) ($redirect['result']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));
        self::assertSame('invalid_state', (string) ($status['payload']['status'] ?? ''));
    }

    public function testWebBrokerAllowsAnyAuthenticatedEmailWhenFlagIsEnabled(): void
    {
        $this->configureWebBrokerTransport([
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => '',
            'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL' => 'true',
        ]);

        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $GLOBALS['__OPERATOR_AUTH_HTTP_CLIENT'] = static function (
            string $method,
            string $url
        ): array {
            if ($method === 'POST' && $url === 'https://broker.example.test/token') {
                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => [
                        'access_token' => 'token-any-email',
                    ],
                ];
            }

            if ($method === 'GET' && $url === 'https://broker.example.test/userinfo') {
                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => [
                        'email' => 'anyone@example.net',
                        'sub' => 'profile-anyone',
                    ],
                ];
            }

            return [
                'ok' => false,
                'status' => 404,
                'json' => null,
            ];
        };

        $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'allow-any-code',
            ]
        );

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertTrue((bool) ($status['payload']['authenticated'] ?? false));
        self::assertSame('anyone@example.net', (string) ($status['payload']['operator']['email'] ?? ''));
        self::assertTrue((bool) ($status['payload']['capabilities']['adminAgent'] ?? false));
    }

    /**
     * @param callable():void $callable
     * @param array<string,string> $serverOverrides
     * @param array<string,mixed>|null $body
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function captureResponse(callable $callable, string $method = 'GET', ?array $body = null, array $serverOverrides = []): array
    {
        $_SERVER['REQUEST_METHOD'] = strtoupper($method);
        foreach ($serverOverrides as $key => $value) {
            $_SERVER[$key] = $value;
        }

        if ($body !== null) {
            $GLOBALS['__TEST_JSON_BODY'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } else {
            unset($GLOBALS['__TEST_JSON_BODY']);
        }

        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            return [
                'payload' => is_array($e->payload) ? $e->payload : [],
                'status' => (int) $e->status,
            ];
        }
    }

    /**
     * @param callable():void $callable
     * @param array<string,string> $query
     * @return array{location:string,status:int,result:array<string,mixed>}
     */
    private function captureRedirect(callable $callable, array $query = []): array
    {
        $_SERVER['REQUEST_METHOD'] = 'GET';
        $_GET = $query;
        unset($GLOBALS['__TEST_REDIRECT']);

        $callable();

        $payload = $GLOBALS['__TEST_REDIRECT'] ?? null;
        self::assertIsArray($payload, 'Expected redirect payload');

        return [
            'location' => (string) ($payload['location'] ?? ''),
            'status' => (int) ($payload['status'] ?? 0),
            'result' => is_array($payload['result'] ?? null)
                ? $payload['result']
                : [],
        ];
    }

    /**
     * @param array<string,string> $overrides
     */
    private function configureWebBrokerTransport(array $overrides = []): void
    {
        $env = array_merge([
            'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => 'web_broker',
            'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL' => 'https://broker.example.test/authorize',
            'OPENCLAW_AUTH_BROKER_TOKEN_URL' => 'https://broker.example.test/token',
            'OPENCLAW_AUTH_BROKER_USERINFO_URL' => 'https://broker.example.test/userinfo',
            'OPENCLAW_AUTH_BROKER_CLIENT_ID' => 'broker-client-id',
            'OPENCLAW_AUTH_BROKER_CLIENT_SECRET' => '',
        ], $overrides);

        foreach ($env as $key => $value) {
            putenv($key . '=' . $value);
        }
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        $entries = array_diff(scandir($dir) ?: [], ['.', '..']);
        foreach ($entries as $entry) {
            $path = $dir . DIRECTORY_SEPARATOR . $entry;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }

        @rmdir($dir);
    }
}
