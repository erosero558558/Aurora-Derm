<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class AdminDataAppDownloadsContractTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'admin-app-downloads-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';

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
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testAdminDataIncludesCanonicalAppDownloadsPayload(): void
    {
        try {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
        }

        $this->assertTrue($payload['ok']);
        $this->assertArrayHasKey('appDownloads', $payload['data']);

        $appDownloads = $payload['data']['appDownloads'];
        $this->assertArrayHasKey('catalog', $appDownloads);
        $this->assertArrayHasKey('surfaces', $appDownloads);
        $this->assertArrayHasKey('operator', $appDownloads['catalog']);
        $this->assertArrayHasKey('sala_tv', $appDownloads['surfaces']);
        $this->assertSame(
            '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe',
            (string) ($appDownloads['catalog']['operator']['targets']['win']['url'] ?? '')
        );
        $this->assertSame(
            'PC operador',
            (string) ($appDownloads['surfaces']['operator']['ops']['installHub']['recommendedFor'] ?? '')
        );
        $this->assertSame(
            'Sala TV',
            (string) ($appDownloads['surfaces']['sala_tv']['ops']['telemetry']['title'] ?? '')
        );
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
