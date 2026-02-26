<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class ServicePriorityControllerTest extends TestCase
{
    private string $tempDir;
    private string $catalogPath;
    private string $metricsFilePath;
    private ?string $metricsBackup = null;
    private bool $metricsExisted = false;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        $this->tempDir = sys_get_temp_dir() . '/test_service_priority_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }
        $this->catalogPath = $this->tempDir . '/services.json';
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->catalogPath);
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AnalyticsController.php';
        require_once __DIR__ . '/../../controllers/ServicePriorityController.php';

        $this->metricsFilePath = __DIR__ . '/../../data/metrics.json';
        $this->metricsExisted = is_file($this->metricsFilePath);
        if ($this->metricsExisted) {
            $backup = file_get_contents($this->metricsFilePath);
            $this->metricsBackup = $backup === false ? '' : $backup;
        }
        if (!is_dir(dirname($this->metricsFilePath))) {
            mkdir(dirname($this->metricsFilePath), 0777, true);
        }
        file_put_contents($this->metricsFilePath, json_encode(['counters' => [], 'histograms' => []]));
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE');
        putenv('PIELARMONIA_DATA_DIR');
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        unset($_SERVER['REMOTE_ADDR']);
        $_GET = [];

        if ($this->metricsExisted) {
            file_put_contents($this->metricsFilePath, (string) $this->metricsBackup);
        } else {
            @unlink($this->metricsFilePath);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testIndexReturnsPrioritizedRowsUsingCatalogAndFunnelSignals(): void
    {
        $this->writeCatalog([
            'version' => '2026.2',
            'timezone' => 'America/Guayaquil',
            'services' => [
                [
                    'slug' => 'botox',
                    'category' => 'aesthetic',
                    'subcategory' => 'injectables',
                    'audience' => ['adults'],
                    'doctor_profile' => ['narvaez'],
                    'hero' => 'Botox médico',
                    'summary' => 'Aplicación por especialista',
                ],
                [
                    'slug' => 'acne-rosacea',
                    'category' => 'clinical',
                    'subcategory' => 'inflammatory',
                    'audience' => ['children', 'adults'],
                    'doctor_profile' => ['rosero'],
                    'hero' => 'Acné y rosácea',
                    'summary' => 'Control de brotes',
                ],
                [
                    'slug' => 'dermatologia-pediatrica',
                    'category' => 'clinical',
                    'subcategory' => 'pediatric',
                    'audience' => ['children'],
                    'doctor_profile' => ['rosero', 'narvaez'],
                    'hero' => 'Dermatología pediátrica',
                    'summary' => 'Atención para niños',
                ],
            ],
        ]);

        $this->incrementFunnel('botox', 'aesthetic', 40, 20, 15, 10);
        $this->incrementFunnel('acne_rosacea', 'clinical', 30, 12, 9, 5);
        $this->incrementFunnel('dermatologia_pediatrica', 'clinical', 18, 8, 7, 6);

        $_GET = [
            'sort' => 'hybrid',
            'limit' => '3',
            'categoryLimit' => '2',
            'featuredLimit' => '2',
        ];

        try {
            \ServicePriorityController::index(['store' => ['appointments' => []]]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $services = $e->payload['data']['services'] ?? [];
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertSame('catalog+funnel', (string) ($e->payload['meta']['source'] ?? ''));
            $this->assertSame('2026.2', (string) ($e->payload['meta']['catalogVersion'] ?? ''));
            $this->assertSame(3, (int) ($e->payload['meta']['serviceCount'] ?? -1));
            $this->assertCount(3, $services);
            $slugs = array_map(static fn ($row): string => (string) (($row['slug'] ?? '')), $services);
            sort($slugs);
            $this->assertSame(['acne-rosacea', 'botox', 'dermatologia-pediatrica'], $slugs);
            $this->assertSame(1, (int) ($services[0]['recommendedOrder'] ?? 0));
            $this->assertGreaterThanOrEqual(
                (float) ($services[1]['score'] ?? 0.0),
                (float) ($services[0]['score'] ?? 0.0)
            );
            $this->assertCount(2, $e->payload['data']['featured'] ?? []);
            $this->assertSame((string) ($services[0]['slug'] ?? ''), (string) ($e->payload['data']['featured'][0] ?? ''));
            $this->assertSame(1, (int) ($e->payload['data']['categories'][0]['recommendedOrder'] ?? 0));
        }
    }

    public function testIndexAudienceFilterPrioritizesChildrenFlow(): void
    {
        $this->writeCatalog([
            'version' => '2026.2',
            'timezone' => 'America/Guayaquil',
            'services' => [
                [
                    'slug' => 'acne-rosacea',
                    'category' => 'clinical',
                    'subcategory' => 'inflammatory',
                    'audience' => ['children', 'adults'],
                    'doctor_profile' => ['rosero'],
                    'hero' => 'Acné y rosácea',
                    'summary' => 'Control de brotes',
                ],
                [
                    'slug' => 'dermatologia-pediatrica',
                    'category' => 'clinical',
                    'subcategory' => 'pediatric',
                    'audience' => ['children'],
                    'doctor_profile' => ['rosero', 'narvaez'],
                    'hero' => 'Dermatología pediátrica',
                    'summary' => 'Atención para niños',
                ],
                [
                    'slug' => 'mesoterapia',
                    'category' => 'aesthetic',
                    'subcategory' => 'injectables',
                    'audience' => ['adults'],
                    'doctor_profile' => ['narvaez'],
                    'hero' => 'Mesoterapia',
                    'summary' => 'Tratamiento estético',
                ],
            ],
        ]);

        $this->incrementFunnel('acne_rosacea', 'clinical', 20, 8, 5, 2);
        $this->incrementFunnel('dermatologia_pediatrica', 'clinical', 10, 8, 8, 7);
        $this->incrementFunnel('mesoterapia', 'aesthetic', 50, 25, 20, 12);

        $_GET = [
            'audience' => 'ninos',
            'sort' => 'conversion',
            'limit' => '5',
        ];

        try {
            \ServicePriorityController::index(['store' => ['appointments' => []]]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $services = $e->payload['data']['services'] ?? [];
            $this->assertNotEmpty($services);
            $this->assertSame('children', (string) ($e->payload['meta']['audience'] ?? ''));
            $this->assertSame('dermatologia-pediatrica', (string) ($services[0]['slug'] ?? ''));
            foreach ($services as $row) {
                $this->assertContains('children', (array) ($row['audience'] ?? []));
            }
        }
    }

    public function testIndexReturnsMissingWhenCatalogFileDoesNotExist(): void
    {
        putenv('PIELARMONIA_SERVICES_CATALOG_FILE=' . $this->tempDir . '/missing-catalog.json');
        $_GET = [];

        try {
            \ServicePriorityController::index(['store' => ['appointments' => []]]);
            $this->fail('Expected TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(200, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertSame('missing', (string) ($e->payload['meta']['source'] ?? ''));
            $this->assertSame([], $e->payload['data']['services'] ?? null);
            $this->assertSame([], $e->payload['data']['categories'] ?? null);
            $this->assertSame([], $e->payload['data']['featured'] ?? null);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function writeCatalog(array $payload): void
    {
        file_put_contents($this->catalogPath, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    private function incrementFunnel(
        string $slug,
        string $category,
        int $detailViews,
        int $bookingIntent,
        int $checkoutStarts,
        int $bookingConfirmed
    ): void {
        \Metrics::increment('conversion_funnel_events_total', [
            'event' => 'view_service_detail',
            'source' => 'service_page',
            'service_slug' => $slug,
            'service_category' => $category,
        ], $detailViews);
        \Metrics::increment('conversion_funnel_events_total', [
            'event' => 'start_booking_from_service',
            'source' => 'service_page',
            'service_slug' => $slug,
            'service_category' => $category,
        ], $bookingIntent);
        \Metrics::increment('conversion_funnel_events_total', [
            'event' => 'start_checkout',
            'source' => 'booking_form',
            'service_slug' => $slug,
            'service_category' => $category,
        ], $checkoutStarts);
        \Metrics::increment('conversion_funnel_events_total', [
            'event' => 'booking_confirmed',
            'source' => 'booking_form',
            'service_slug' => $slug,
            'service_category' => $category,
        ], $bookingConfirmed);
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
