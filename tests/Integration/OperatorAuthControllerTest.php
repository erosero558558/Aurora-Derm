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
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
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
