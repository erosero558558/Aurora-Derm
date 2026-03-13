<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class HealthVisibilityTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REMOTE_ADDR' => '198.51.100.24',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'health-visibility-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/ApiConfig.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';
        require_once __DIR__ . '/../../controllers/SystemController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
        ] as $key) {
            putenv($key);
        }

        if (\function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [];
    }

    public function testPublicHealthRedactsDetailedDiagnosticsWithoutAuthorization(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => false,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertSame('ok', (string) ($response['payload']['status'] ?? ''));
        $this->assertArrayHasKey('version', $response['payload']);
        $this->assertArrayNotHasKey('storageBackend', $response['payload']);
        $this->assertArrayNotHasKey('dataDirSource', $response['payload']);
        $this->assertArrayNotHasKey('checks', $response['payload']);
    }

    public function testAuthorizedHealthStillExposesDetailedDiagnostics(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertArrayHasKey('storageBackend', $response['payload']);
        $this->assertArrayHasKey('storeEncryptionStatus', $response['payload']);
        $this->assertArrayHasKey('authMode', $response['payload']);
        $this->assertArrayHasKey('authStatus', $response['payload']);
        $this->assertArrayHasKey('checks', $response['payload']);
        $this->assertArrayHasKey('encryptionStatus', $response['payload']['checks']['storage'] ?? []);
        $this->assertArrayHasKey('auth', $response['payload']['checks']);
        $this->assertArrayHasKey('internalConsole', $response['payload']['checks']);
        $this->assertArrayHasKey('mode', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayHasKey('configured', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayHasKey('twoFactorEnabled', $response['payload']['checks']['auth'] ?? []);
        $this->assertArrayHasKey('overall', $response['payload']['checks']['internalConsole'] ?? []);
        $this->assertArrayHasKey('publicSync', $response['payload']['checks']);
    }

    public function testHealthDiagnosticsRejectsUnauthorizedRequest(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \HealthController::diagnostics([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health-diagnostics',
                'diagnosticsAuthorized' => false,
            ]);
        });

        $this->assertSame(403, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('No autorizado', (string) ($response['payload']['error'] ?? ''));
    }

    public function testMetricsRejectsUnauthorizedPublicRequest(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \SystemController::metrics([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'metrics',
                'diagnosticsAuthorized' => false,
            ]);
        });

        $this->assertSame(403, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('No autorizado', (string) ($response['payload']['error'] ?? ''));
    }

    public function testSensitiveDiagnosticsEndpointsAreNotInPublicApiAllowlist(): void
    {
        $publicEndpoints = \ApiConfig::getPublicEndpoints();
        $diagnosticsEndpoints = \ApiConfig::getDiagnosticsEndpoints();

        $this->assertFalse($this->containsEndpoint($publicEndpoints, 'GET', 'metrics'));
        $this->assertFalse($this->containsEndpoint($publicEndpoints, 'GET', 'health-diagnostics'));
        $this->assertTrue($this->containsEndpoint($diagnosticsEndpoints, 'GET', 'metrics'));
        $this->assertTrue($this->containsEndpoint($diagnosticsEndpoints, 'GET', 'health-diagnostics'));
    }

    /**
     * @param callable():void $callable
     * @return array{payload:array<string,mixed>,status:int}
     */
    private function captureJsonResponse(callable $callable): array
    {
        try {
            $callable();
            self::fail('Expected TestingExitException');
        } catch (\TestingExitException $exception) {
            return [
                'payload' => $exception->payload,
                'status' => $exception->status,
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

    /**
     * @param array<int,array<string,string>> $endpoints
     */
    private function containsEndpoint(array $endpoints, string $method, string $resource): bool
    {
        foreach ($endpoints as $endpoint) {
            if (
                (string) ($endpoint['method'] ?? '') === $method &&
                (string) ($endpoint['resource'] ?? '') === $resource
            ) {
                return true;
            }
        }

        return false;
    }
}
