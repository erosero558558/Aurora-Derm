<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class AnalyticsServiceFunnelMetricsTest extends TestCase
{
    private string $metricsFilePath;
    private string $tempDataDir;
    private ?string $metricsFileBackup = null;
    private bool $metricsFilePreviouslyExisted = false;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_SERVER['REMOTE_ADDR'] = '127.0.0.1';

        $this->tempDataDir = sys_get_temp_dir() . '/test_analytics_service_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDataDir)) {
            mkdir($this->tempDataDir, 0777, true);
        }
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDataDir);

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../controllers/AnalyticsController.php';

        $this->metricsFilePath = __DIR__ . '/../../data/metrics.json';
        $this->metricsFilePreviouslyExisted = is_file($this->metricsFilePath);
        if ($this->metricsFilePreviouslyExisted) {
            $backup = file_get_contents($this->metricsFilePath);
            $this->metricsFileBackup = $backup === false ? '' : $backup;
        }

        if (!is_dir(dirname($this->metricsFilePath))) {
            mkdir(dirname($this->metricsFilePath), 0777, true);
        }

        file_put_contents(
            $this->metricsFilePath,
            json_encode(['counters' => [], 'histograms' => []], JSON_UNESCAPED_UNICODE)
        );
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        unset($_SERVER['REMOTE_ADDR']);

        if ($this->metricsFilePreviouslyExisted) {
            file_put_contents($this->metricsFilePath, (string) $this->metricsFileBackup);
        } else {
            @unlink($this->metricsFilePath);
        }

        $this->removeDirectory($this->tempDataDir);
    }

    public function testRecordEventAcceptsServiceDetailAndPersistsServiceLabels(): void
    {
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'event' => 'view_service_detail',
            'params' => [
                'source' => 'service_page',
                'service_slug' => 'bioestimuladores-colageno',
                'service_category' => 'aesthetic',
            ],
        ], JSON_UNESCAPED_UNICODE);

        try {
            \AnalyticsController::recordEvent([]);
            $this->fail('Should have thrown TestingExitException');
        } catch (\TestingExitException $e) {
            $this->assertSame(202, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
            $this->assertTrue((bool) ($e->payload['recorded'] ?? false));
        }

        $metricsText = \Metrics::export();
        $this->assertStringContainsString('conversion_funnel_events_total{', $metricsText);
        $this->assertStringContainsString('event="view_service_detail"', $metricsText);
        $this->assertStringContainsString('service_slug="bioestimuladores_colageno"', $metricsText);
        $this->assertStringContainsString('service_category="aesthetic"', $metricsText);
    }

    public function testBuildFunnelMetricsDataIncludesServiceBreakdownsAndRates(): void
    {
        $this->incrementFunnel('view_service_detail', 'service_page', 20, [
            'service_slug' => 'botox',
            'service_category' => 'aesthetic',
        ]);
        $this->incrementFunnel('start_booking_from_service', 'service_page', 8, [
            'service_slug' => 'botox',
            'service_category' => 'aesthetic',
        ]);
        $this->incrementFunnel('start_checkout', 'booking_form', 6, [
            'service_slug' => 'botox',
            'service_category' => 'aesthetic',
        ]);
        $this->incrementFunnel('booking_confirmed', 'booking_form', 3, [
            'service_slug' => 'botox',
            'service_category' => 'aesthetic',
        ]);

        $this->incrementFunnel('view_service_detail', 'service_page', 10, [
            'service_slug' => 'acne_rosacea',
            'service_category' => 'clinical',
        ]);
        $this->incrementFunnel('start_booking_from_service', 'service_page', 5, [
            'service_slug' => 'acne_rosacea',
            'service_category' => 'clinical',
        ]);
        $this->incrementFunnel('start_checkout', 'booking_form', 4, [
            'service_slug' => 'acne_rosacea',
            'service_category' => 'clinical',
        ]);
        $this->incrementFunnel('booking_confirmed', 'booking_form', 2, [
            'service_slug' => 'acne_rosacea',
            'service_category' => 'clinical',
        ]);

        $payload = \AnalyticsController::buildFunnelMetricsData(['store' => ['appointments' => []]]);

        $this->assertArrayHasKey('serviceCategoryBreakdown', $payload);
        $this->assertArrayHasKey('serviceDetailBreakdown', $payload);
        $this->assertArrayHasKey('serviceBookingIntentBreakdown', $payload);
        $this->assertArrayHasKey('serviceCheckoutBreakdown', $payload);
        $this->assertArrayHasKey('serviceConfirmedBreakdown', $payload);
        $this->assertArrayHasKey('serviceFunnel', $payload);

        $categoryMap = $this->labelCountMap($payload['serviceCategoryBreakdown']);
        $this->assertSame(37, (int) ($categoryMap['aesthetic'] ?? -1));
        $this->assertSame(21, (int) ($categoryMap['clinical'] ?? -1));

        $detailMap = $this->labelCountMap($payload['serviceDetailBreakdown']);
        $this->assertSame(20, (int) ($detailMap['botox'] ?? -1));
        $this->assertSame(10, (int) ($detailMap['acne_rosacea'] ?? -1));

        $intentMap = $this->labelCountMap($payload['serviceBookingIntentBreakdown']);
        $this->assertSame(8, (int) ($intentMap['botox'] ?? -1));
        $this->assertSame(5, (int) ($intentMap['acne_rosacea'] ?? -1));

        $checkoutMap = $this->labelCountMap($payload['serviceCheckoutBreakdown']);
        $this->assertSame(6, (int) ($checkoutMap['botox'] ?? -1));
        $this->assertSame(4, (int) ($checkoutMap['acne_rosacea'] ?? -1));

        $confirmedMap = $this->labelCountMap($payload['serviceConfirmedBreakdown']);
        $this->assertSame(3, (int) ($confirmedMap['botox'] ?? -1));
        $this->assertSame(2, (int) ($confirmedMap['acne_rosacea'] ?? -1));

        $serviceFunnelMap = $this->serviceFunnelMap($payload['serviceFunnel']);
        $botox = $serviceFunnelMap['botox'] ?? [];
        $this->assertSame(20, (int) ($botox['detailViews'] ?? -1));
        $this->assertSame(8, (int) ($botox['bookingIntent'] ?? -1));
        $this->assertSame(6, (int) ($botox['checkoutStarts'] ?? -1));
        $this->assertSame(3, (int) ($botox['bookingConfirmed'] ?? -1));
        $this->assertSame(75.0, (float) ($botox['intentToCheckoutPct'] ?? -1));
        $this->assertSame(50.0, (float) ($botox['checkoutToConfirmedPct'] ?? -1));
        $this->assertSame(15.0, (float) ($botox['detailToConfirmedPct'] ?? -1));
    }

    /**
     * @param array<string,string> $extraLabels
     */
    private function incrementFunnel(string $event, string $source, int $value, array $extraLabels = []): void
    {
        $labels = array_merge([
            'event' => $event,
            'source' => $source,
        ], $extraLabels);

        \Metrics::increment('conversion_funnel_events_total', $labels, $value);
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @return array<string,int>
     */
    private function labelCountMap(array $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $label = (string) ($row['label'] ?? '');
            if ($label === '') {
                continue;
            }
            $map[$label] = (int) ($row['count'] ?? 0);
        }
        return $map;
    }

    /**
     * @param array<int,array<string,mixed>> $rows
     * @return array<string,array<string,mixed>>
     */
    private function serviceFunnelMap(array $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            if (!is_array($row)) {
                continue;
            }
            $slug = (string) ($row['serviceSlug'] ?? '');
            if ($slug === '') {
                continue;
            }
            $map[$slug] = $row;
        }
        return $map;
    }

    private function removeDirectory(string $dir): void
    {
        if ($dir === '' || !is_dir($dir)) {
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
