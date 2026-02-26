<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class ServiceCatalogControllerTest extends TestCase
{
    private string $tempDir;
    private string $catalogPath;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);
        $_GET = [];

        $this->tempDir = sys_get_temp_dir() . '/test_service_catalog_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
        $this->catalogPath = $this->tempDir . '/services.json';

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/http.php';
        require_once __DIR__ . '/../../controllers/ServiceCatalogController.php';
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE');
        $_GET = [];
        unset($GLOBALS['__TEST_RESPONSE']);
        $this->removeDirectory($this->tempDir);
    }

    public function testIndexAppliesCategoryAudienceDoctorAndPaginationFilters(): void
    {
        $this->writeCatalog([
            'version' => '2026.1',
            'timezone' => 'America/Guayaquil',
            'services' => [
                [
                    'slug' => 'diagnostico-integral',
                    'category' => 'clinical',
                    'subcategory' => 'core',
                    'audience' => ['children', 'adults'],
                    'hero' => 'Diagnóstico integral',
                    'summary' => 'Consulta médica completa',
                    'doctor_profile' => ['rosero', 'narvaez'],
                ],
                [
                    'slug' => 'botox',
                    'category' => 'aesthetic',
                    'subcategory' => 'injectables',
                    'audience' => ['adults'],
                    'hero' => 'Botox médico',
                    'summary' => 'Inyectable médico',
                    'doctor_profile' => ['narvaez'],
                ],
                [
                    'slug' => 'dermatologia-pediatrica',
                    'category' => 'clinical',
                    'subcategory' => 'pediatric',
                    'audience' => ['children'],
                    'hero' => 'Dermatología pediátrica',
                    'summary' => 'Atención dermatológica para niños',
                    'doctor_profile' => ['rosero'],
                ],
            ],
        ]);

        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->catalogPath);

        $_GET = [
            'category' => 'clinical',
            'audience' => 'children',
            'doctor' => 'rosero',
            'limit' => '1',
            'offset' => '1',
        ];

        try {
            \ServiceCatalogController::index([]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertSame('file', (string) ($e->payload['meta']['source'] ?? ''));
            $this->assertSame(3, (int) ($e->payload['meta']['total'] ?? -1));
            $this->assertSame(2, (int) ($e->payload['meta']['filtered'] ?? -1));
            $this->assertSame(1, (int) ($e->payload['meta']['returned'] ?? -1));
            $this->assertSame(1, (int) ($e->payload['meta']['offset'] ?? -1));
            $this->assertSame(1, (int) ($e->payload['meta']['limit'] ?? -1));
            $this->assertSame('dermatologia-pediatrica', (string) ($e->payload['data'][0]['slug'] ?? ''));
        }
    }

    public function testIndexSupportsSearchFilterAcrossHeroAndSummary(): void
    {
        $this->writeCatalog([
            'version' => '2026.1',
            'timezone' => 'America/Guayaquil',
            'services' => [
                [
                    'slug' => 'acne-rosacea',
                    'category' => 'clinical',
                    'subcategory' => 'inflammatory',
                    'audience' => ['children', 'adults'],
                    'hero' => 'Tratamiento para acné y rosácea',
                    'summary' => 'Control médico de brotes',
                    'doctor_profile' => ['rosero'],
                ],
                [
                    'slug' => 'botox',
                    'category' => 'aesthetic',
                    'subcategory' => 'injectables',
                    'audience' => ['adults'],
                    'hero' => 'Botox médico',
                    'summary' => 'Inyectables para líneas de expresión',
                    'doctor_profile' => ['narvaez'],
                ],
            ],
        ]);

        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->catalogPath);

        $_GET = [
            'q' => 'brotes',
        ];

        try {
            \ServiceCatalogController::index([]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertSame(1, (int) ($e->payload['meta']['filtered'] ?? -1));
            $this->assertSame('acne-rosacea', (string) ($e->payload['data'][0]['slug'] ?? ''));
            $this->assertSame('brotes', (string) ($e->payload['meta']['filters']['q'] ?? ''));
        }
    }

    public function testIndexReturnsMissingSourceWhenCatalogDoesNotExist(): void
    {
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->tempDir . '/missing.json');
        $_GET = [];

        try {
            \ServiceCatalogController::index([]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertSame('missing', (string) ($e->payload['meta']['source'] ?? ''));
            $this->assertSame([], $e->payload['data'] ?? null);
            $this->assertSame(0, (int) ($e->payload['meta']['total'] ?? -1));
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function writeCatalog(array $payload): void
    {
        file_put_contents($this->catalogPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
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
