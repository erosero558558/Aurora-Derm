<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;
use ReflectionClass;

/**
 * @runInSeparateProcess
 */
class HealthServiceCatalogSnapshotTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/test_health_catalog_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        require_once __DIR__ . '/../../controllers/HealthController.php';
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE');
        $this->removeDirectory($this->tempDir);
    }

    public function testCollectServiceCatalogSnapshotReturnsMissingWhenFileDoesNotExist(): void
    {
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->tempDir . '/missing-services.json');
        $snapshot = $this->invokeSnapshot();

        $this->assertSame('missing', (string) ($snapshot['source'] ?? ''));
        $this->assertSame('missing', (string) ($snapshot['version'] ?? ''));
        $this->assertFalse((bool) ($snapshot['configured'] ?? true));
        $this->assertSame(0, (int) ($snapshot['servicesCount'] ?? -1));
    }

    public function testCollectServiceCatalogSnapshotReturnsFileDataWhenCatalogIsValid(): void
    {
        $path = $this->tempDir . '/services.json';
        file_put_contents(
            $path,
            json_encode([
                'version' => '2026.2',
                'timezone' => 'America/Guayaquil',
                'services' => [
                    ['slug' => 'diagnostico-integral'],
                    ['slug' => 'botox'],
                ],
            ], JSON_UNESCAPED_UNICODE)
        );

        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $path);
        $snapshot = $this->invokeSnapshot();

        $this->assertSame('file', (string) ($snapshot['source'] ?? ''));
        $this->assertSame('2026.2', (string) ($snapshot['version'] ?? ''));
        $this->assertSame('America/Guayaquil', (string) ($snapshot['timezone'] ?? ''));
        $this->assertTrue((bool) ($snapshot['configured'] ?? false));
        $this->assertSame(2, (int) ($snapshot['servicesCount'] ?? -1));
    }

    /**
     * @return array<string,mixed>
     */
    private function invokeSnapshot(): array
    {
        $ref = new ReflectionClass(\HealthController::class);
        $method = $ref->getMethod('collectServiceCatalogSnapshot');
        $method->setAccessible(true);
        $result = $method->invoke(null);
        return is_array($result) ? $result : [];
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
