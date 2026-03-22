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
    private ?string $originalOpenSslConf = null;
    /** @var array{privateKey:string,kid:string,jwk:array<string,mixed>} */
    private array $brokerKeyMaterial;

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

        $this->applyProcessEnv([
            'PIELARMONIA_DATA_DIR' => $this->tempDir,
            'PIELARMONIA_SKIP_ENV_FILE' => 'true',
            'PIELARMONIA_OPERATOR_AUTH_MODE' => 'google_oauth',
            'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => 'local_helper',
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => 'operator@example.com',
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN' => 'operator-auth-bridge-test-token',
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET' => 'operator-auth-bridge-test-secret',
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER' => 'Authorization',
            'PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL' => 'http://127.0.0.1:8011',
            'PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL' => 'http://127.0.0.1:4173',
            'PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS' => '300',
            'PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS' => '1800',
            'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL' => null,
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => null,
            'PIELARMONIA_ADMIN_PASSWORD' => null,
            'PIELARMONIA_ADMIN_PASSWORD_HASH' => null,
            'PIELARMONIA_ADMIN_2FA_SECRET' => null,
            'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL' => null,
            'OPENCLAW_AUTH_BROKER_TOKEN_URL' => null,
            'OPENCLAW_AUTH_BROKER_USERINFO_URL' => null,
            'OPENCLAW_AUTH_BROKER_CLIENT_ID' => null,
            'OPENCLAW_AUTH_BROKER_CLIENT_SECRET' => null,
            'OPENCLAW_AUTH_BROKER_JWKS_URL' => null,
            'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER' => null,
            'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE' => null,
            'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED' => null,
            'OPENCLAW_AUTH_BROKER_CLOCK_SKEW_SECONDS' => null,
        ]);
        $this->configureOpenSslForTests();

        $this->brokerKeyMaterial = $this->generateBrokerKeyMaterial();

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/OperatorAuthController.php';
    }

    protected function tearDown(): void
    {
        $this->applyProcessEnv([
            'PIELARMONIA_DATA_DIR' => null,
            'PIELARMONIA_SKIP_ENV_FILE' => null,
            'PIELARMONIA_OPERATOR_AUTH_MODE' => null,
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => null,
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN' => null,
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_SECRET' => null,
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN_HEADER' => null,
            'PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL' => null,
            'PIELARMONIA_OPERATOR_AUTH_HELPER_BASE_URL' => null,
            'PIELARMONIA_OPERATOR_AUTH_CHALLENGE_TTL_SECONDS' => null,
            'PIELARMONIA_OPERATOR_AUTH_SESSION_TTL_SECONDS' => null,
            'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => null,
            'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL' => null,
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => null,
            'PIELARMONIA_ADMIN_PASSWORD' => null,
            'PIELARMONIA_ADMIN_PASSWORD_HASH' => null,
            'PIELARMONIA_ADMIN_2FA_SECRET' => null,
            'OPENCLAW_AUTH_BROKER_AUTHORIZE_URL' => null,
            'OPENCLAW_AUTH_BROKER_TOKEN_URL' => null,
            'OPENCLAW_AUTH_BROKER_USERINFO_URL' => null,
            'OPENCLAW_AUTH_BROKER_CLIENT_ID' => null,
            'OPENCLAW_AUTH_BROKER_CLIENT_SECRET' => null,
            'OPENCLAW_AUTH_BROKER_JWKS_URL' => null,
            'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER' => null,
            'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE' => null,
            'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED' => null,
            'OPENCLAW_AUTH_BROKER_CLOCK_SKEW_SECONDS' => null,
        ]);
        if ($this->originalOpenSslConf === null) {
            putenv('OPENSSL_CONF');
        } else {
            putenv('OPENSSL_CONF=' . $this->originalOpenSslConf);
        }
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

    /**
     * @param array<string,?string> $env
     */
    private function applyProcessEnv(array $env): void
    {
        foreach ($env as $name => $value) {
            foreach ($this->envAliases($name) as $candidate) {
                if ($value === null) {
                    putenv($candidate);
                    unset($_ENV[$candidate], $_SERVER[$candidate]);
                    continue;
                }

                putenv($candidate . '=' . $value);
                $_ENV[$candidate] = $value;
                $_SERVER[$candidate] = $value;
            }
        }
    }

    /**
     * @return list<string>
     */
    private function envAliases(string $name): array
    {
        if (str_starts_with($name, 'PIELARMONIA_')) {
            return [
                $name,
                'AURORADERM_' . substr($name, strlen('PIELARMONIA_')),
            ];
        }

        if (str_starts_with($name, 'AURORADERM_')) {
            return [
                $name,
                'PIELARMONIA_' . substr($name, strlen('AURORADERM_')),
            ];
        }

        return [$name];
    }

    private function configureOpenSslForTests(): void
    {
        $current = getenv('OPENSSL_CONF');
        $this->originalOpenSslConf = ($current === false || $current === '') ? null : (string) $current;
        if ($this->originalOpenSslConf !== null) {
            return;
        }

        foreach ([
            'C:\\Program Files\\Git\\mingw64\\etc\\ssl\\openssl.cnf',
            'C:\\Program Files\\Git\\usr\\ssl\\openssl.cnf',
        ] as $candidate) {
            if (is_file($candidate)) {
                putenv('OPENSSL_CONF=' . $candidate);
                return;
            }
        }
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
        $this->applyProcessEnv([
            'PIELARMONIA_OPERATOR_AUTH_BRIDGE_TOKEN' => null,
        ]);

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
        $this->applyProcessEnv([
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => 'true',
            'PIELARMONIA_ADMIN_PASSWORD_HASH' => password_hash('contingencia-segura', PASSWORD_DEFAULT),
            'PIELARMONIA_ADMIN_2FA_SECRET' => 'JBSWY3DPEHPK3PXP',
        ]);

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        self::assertSame('google_oauth', (string) ($status['payload']['mode'] ?? ''));
        self::assertSame('google_oauth', (string) ($status['payload']['recommendedMode'] ?? ''));
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
        $this->applyProcessEnv([
            'PIELARMONIA_INTERNAL_CONSOLE_AUTH_ALLOW_LEGACY_FALLBACK' => 'true',
            'PIELARMONIA_ADMIN_PASSWORD_HASH' => password_hash('contingencia-segura', PASSWORD_DEFAULT),
            'PIELARMONIA_ADMIN_2FA_SECRET' => null,
        ]);

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

    public function testMissingExplicitTransportFailsClosed(): void
    {
        $this->applyProcessEnv([
            'PIELARMONIA_OPERATOR_AUTH_TRANSPORT' => '',
        ]);

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));

        self::assertSame(200, $status['status']);
        self::assertFalse((bool) ($status['payload']['configured'] ?? true));
        self::assertSame('transport_misconfigured', (string) ($status['payload']['status'] ?? ''));
        self::assertSame('', (string) ($status['payload']['transport'] ?? ''));
        self::assertStringContainsString(
            'AURORADERM_OPERATOR_AUTH_TRANSPORT',
            (string) ($status['payload']['error'] ?? '')
        );
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

        $this->installWebBrokerHttpClient($pending);

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

    public function testWebBrokerCallbackAuthenticatesRestrictedAllowlistEmail(): void
    {
        $this->configureWebBrokerTransport([
            'PIELARMONIA_ADMIN_EMAIL' => 'restricted.operator@example.com',
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => 'restricted.operator@example.com',
            'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL' => 'false',
        ]);

        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-restricted-allowlist',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => (string) ($pending['nonce'] ?? ''),
                    'sub' => 'profile-restricted-operator',
                    'email' => 'restricted.operator@example.com',
                    'email_verified' => true,
                ]),
            ],
            'userinfoPayload' => [
                'email' => 'restricted.operator@example.com',
                'sub' => 'profile-restricted-operator',
                'email_verified' => true,
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'restricted-allowlist-code',
            ]
        );

        self::assertSame('authenticated', (string) ($redirect['result']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertTrue((bool) ($status['payload']['authenticated'] ?? false));
        self::assertSame(
            'restricted.operator@example.com',
            (string) ($status['payload']['operator']['email'] ?? '')
        );
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

    public function testWebBrokerRejectsAuthenticatedEmailOutsideRestrictedAllowlist(): void
    {
        $this->configureWebBrokerTransport([
            'PIELARMONIA_ADMIN_EMAIL' => 'restricted.operator@example.com',
            'PIELARMONIA_OPERATOR_AUTH_ALLOWLIST' => 'restricted.operator@example.com',
            'PIELARMONIA_OPERATOR_AUTH_ALLOW_ANY_AUTHENTICATED_EMAIL' => 'false',
        ]);

        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-outside-allowlist',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => (string) ($pending['nonce'] ?? ''),
                    'sub' => 'profile-intruder',
                    'email' => 'intruso@example.com',
                    'email_verified' => true,
                ]),
            ],
            'userinfoPayload' => [
                'email' => 'intruso@example.com',
                'sub' => 'profile-intruder',
                'email_verified' => true,
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'outside-allowlist-code',
            ]
        );

        self::assertSame('email_no_permitido', (string) ($redirect['result']['status'] ?? ''));

        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));
        self::assertSame('email_no_permitido', (string) ($status['payload']['status'] ?? ''));
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

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-any-email',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => (string) ($pending['nonce'] ?? ''),
                    'sub' => 'profile-anyone',
                    'email' => 'anyone@example.net',
                    'email_verified' => true,
                ]),
            ],
            'userinfoPayload' => [
                'email' => 'anyone@example.net',
                'sub' => 'profile-anyone',
                'email_verified' => true,
            ],
        ]);

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

    public function testWebBrokerCallbackRejectsMissingIdToken(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-without-id-token',
                'id_token' => '',
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'missing-id-token',
            ]
        );

        self::assertSame('broker_claims_invalid', (string) ($redirect['result']['status'] ?? ''));
        $status = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertFalse((bool) ($status['payload']['authenticated'] ?? true));
        self::assertSame('broker_claims_invalid', (string) ($status['payload']['status'] ?? ''));
    }

    public function testWebBrokerCallbackRejectsIssuerMismatch(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-bad-issuer',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => (string) ($pending['nonce'] ?? ''),
                    'iss' => 'https://otro-broker.example.test',
                ]),
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'bad-issuer',
            ]
        );

        self::assertSame('broker_claims_invalid', (string) ($redirect['result']['status'] ?? ''));
    }

    public function testWebBrokerCallbackRejectsAudienceMismatch(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-bad-audience',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => (string) ($pending['nonce'] ?? ''),
                    'aud' => 'otro-cliente',
                ]),
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'bad-audience',
            ]
        );

        self::assertSame('broker_claims_invalid', (string) ($redirect['result']['status'] ?? ''));
    }

    public function testWebBrokerCallbackRejectsNonceMismatch(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-bad-nonce',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => 'nonce-distinto',
                ]),
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'bad-nonce',
            ]
        );

        self::assertSame('broker_claims_invalid', (string) ($redirect['result']['status'] ?? ''));
    }

    public function testWebBrokerCallbackRejectsUnverifiedEmail(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'tokenPayload' => [
                'access_token' => 'token-unverified',
                'id_token' => $this->issueBrokerIdToken([
                    'nonce' => (string) ($pending['nonce'] ?? ''),
                    'email_verified' => false,
                ]),
            ],
            'userinfoPayload' => [
                'email' => 'operator@example.com',
                'sub' => 'profile-web-broker',
                'email_verified' => false,
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'unverified-email',
            ]
        );

        self::assertSame('identity_unverified', (string) ($redirect['result']['status'] ?? ''));
    }

    public function testWebBrokerCallbackRejectsSubjectMismatchBetweenIdTokenAndUserinfo(): void
    {
        $this->configureWebBrokerTransport();
        $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        $pending = $_SESSION['operator_auth_pending_web_state'] ?? null;
        self::assertIsArray($pending);

        $this->installWebBrokerHttpClient($pending, [
            'userinfoPayload' => [
                'email' => 'operator@example.com',
                'sub' => 'subject-distinto',
                'accountId' => 'acct-web-broker',
                'email_verified' => true,
            ],
        ]);

        $redirect = $this->captureRedirect(
            static fn () => \OperatorAuthController::callback([]),
            [
                'action' => 'callback',
                'state' => (string) ($pending['state'] ?? ''),
                'code' => 'mismatched-subject',
            ]
        );

        self::assertSame('broker_claims_invalid', (string) ($redirect['result']['status'] ?? ''));
    }

    public function testStartRequiresCsrfHeader(): void
    {
        $response = $this->captureResponse(
            static fn () => \OperatorAuthController::start([]),
            'POST',
            [],
            ['__disable_auto_csrf' => '1']
        );

        self::assertSame(403, $response['status']);
        self::assertFalse((bool) ($response['payload']['ok'] ?? true));
        self::assertSame('Token CSRF inválido o ausente', (string) ($response['payload']['error'] ?? ''));

        $success = $this->captureResponse(static fn () => \OperatorAuthController::start([]), 'POST');
        self::assertSame(202, $success['status']);
    }

    public function testLogoutRequiresCsrfHeaderAndClearsSessionWhenProvided(): void
    {
        \start_secure_session();
        \operator_auth_establish_session([
            'email' => 'operator@example.com',
            'profileId' => 'profile-session',
            'accountId' => 'acct-session',
        ]);

        $denied = $this->captureResponse(
            static fn () => \OperatorAuthController::logout([]),
            'POST',
            [],
            ['__disable_auto_csrf' => '1']
        );
        self::assertSame(403, $denied['status']);

        $statusBeforeLogout = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertTrue((bool) ($statusBeforeLogout['payload']['authenticated'] ?? false));

        $logout = $this->captureResponse(static fn () => \OperatorAuthController::logout([]), 'POST');
        self::assertSame(200, $logout['status']);
        self::assertSame('logout', (string) ($logout['payload']['status'] ?? ''));

        $statusAfterLogout = $this->captureResponse(static fn () => \OperatorAuthController::status([]));
        self::assertFalse((bool) ($statusAfterLogout['payload']['authenticated'] ?? true));
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
        $disableAutoCsrf = array_key_exists('__disable_auto_csrf', $serverOverrides);
        unset($serverOverrides['__disable_auto_csrf']);
        if (
            $_SERVER['REQUEST_METHOD'] === 'POST'
            && !$disableAutoCsrf
            && !array_key_exists('HTTP_X_CSRF_TOKEN', $serverOverrides)
        ) {
            \start_secure_session();
            $serverOverrides['HTTP_X_CSRF_TOKEN'] = \generate_csrf_token();
        }
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
            'OPENCLAW_AUTH_BROKER_JWKS_URL' => 'https://broker.example.test/jwks',
            'OPENCLAW_AUTH_BROKER_EXPECTED_ISSUER' => 'https://broker.example.test',
            'OPENCLAW_AUTH_BROKER_EXPECTED_AUDIENCE' => 'broker-audience',
            'OPENCLAW_AUTH_BROKER_REQUIRE_EMAIL_VERIFIED' => 'true',
            'OPENCLAW_AUTH_BROKER_CLOCK_SKEW_SECONDS' => '120',
        ], $overrides);
        $this->applyProcessEnv($env);
    }

    /**
     * @return array{privateKey:string,kid:string,jwk:array<string,mixed>}
     */
    private function generateBrokerKeyMaterial(): array
    {
        $opensslConfig = [
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ];
        $configPath = getenv('OPENSSL_CONF');
        if (is_string($configPath) && $configPath !== '' && is_file($configPath)) {
            $opensslConfig['config'] = $configPath;
        }

        $resource = openssl_pkey_new($opensslConfig);
        self::assertNotFalse($resource, 'No se pudo generar la llave RSA de test.');

        $privateKey = '';
        self::assertTrue(
            openssl_pkey_export($resource, $privateKey, null, $opensslConfig),
            'No se pudo exportar la llave privada de test.'
        );

        $details = openssl_pkey_get_details($resource);
        self::assertIsArray($details, 'No se pudieron leer los detalles de la llave RSA.');
        self::assertIsArray($details['rsa'] ?? null, 'La llave RSA de test no expuso modulo/exponente.');

        $kid = 'test-broker-kid';

        return [
            'privateKey' => $privateKey,
            'kid' => $kid,
            'jwk' => [
                'kty' => 'RSA',
                'kid' => $kid,
                'alg' => 'RS256',
                'use' => 'sig',
                'n' => $this->base64UrlEncode((string) $details['rsa']['n']),
                'e' => $this->base64UrlEncode((string) $details['rsa']['e']),
            ],
        ];
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function issueBrokerIdToken(array $claims = [], array $headers = []): string
    {
        $header = array_merge([
            'alg' => 'RS256',
            'typ' => 'JWT',
            'kid' => $this->brokerKeyMaterial['kid'],
        ], $headers);

        $payload = array_merge([
            'iss' => 'https://broker.example.test',
            'aud' => 'broker-audience',
            'sub' => 'profile-web-broker',
            'email' => 'operator@example.com',
            'email_verified' => true,
            'iat' => time(),
            'exp' => time() + 300,
        ], $claims);

        $signingInput = $this->base64UrlEncode((string) json_encode($header, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES))
            . '.'
            . $this->base64UrlEncode((string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $signature = '';
        self::assertTrue(
            openssl_sign($signingInput, $signature, $this->brokerKeyMaterial['privateKey'], OPENSSL_ALGO_SHA256),
            'No se pudo firmar el id_token de test.'
        );

        return $signingInput . '.' . $this->base64UrlEncode($signature);
    }

    /**
     * @param array<string,mixed> $pending
     * @param array<string,mixed> $options
     */
    private function installWebBrokerHttpClient(array $pending, array $options = []): void
    {
        $tokenPayload = array_merge([
            'access_token' => 'token-web-broker-test',
            'id_token' => $this->issueBrokerIdToken([
                'nonce' => (string) ($pending['nonce'] ?? ''),
                'sub' => 'profile-web-broker',
                'email' => 'operator@example.com',
                'email_verified' => true,
            ]),
        ], is_array($options['tokenPayload'] ?? null) ? $options['tokenPayload'] : []);

        $userinfoPayload = array_merge([
            'email' => 'operator@example.com',
            'sub' => 'profile-web-broker',
            'accountId' => 'acct-web-broker',
            'email_verified' => true,
        ], is_array($options['userinfoPayload'] ?? null) ? $options['userinfoPayload'] : []);

        $jwksPayload = is_array($options['jwksPayload'] ?? null)
            ? $options['jwksPayload']
            : ['keys' => [$this->brokerKeyMaterial['jwk']]];

        $GLOBALS['__OPERATOR_AUTH_HTTP_CLIENT'] = static function (
            string $method,
            string $url,
            array $requestOptions = []
        ) use ($tokenPayload, $userinfoPayload, $jwksPayload): array {
            if ($method === 'POST' && $url === 'https://broker.example.test/token') {
                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => $tokenPayload,
                ];
            }

            if ($method === 'GET' && $url === 'https://broker.example.test/userinfo') {
                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => $userinfoPayload,
                ];
            }

            if ($method === 'GET' && $url === 'https://broker.example.test/jwks') {
                return [
                    'ok' => true,
                    'status' => 200,
                    'json' => $jwksPayload,
                ];
            }

            self::fail('Unexpected broker request: ' . $method . ' ' . $url);
        };
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
