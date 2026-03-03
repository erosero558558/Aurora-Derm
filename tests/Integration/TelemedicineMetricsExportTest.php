<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class TelemedicineMetricsExportTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-metrics-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_TELEMED_V2_SHADOW=true');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/SystemController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_TELEMED_V2_SHADOW',
        ] as $key) {
            putenv($key);
        }

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
    }

    public function testMetricsExportsTelemedicineOperationalGauges(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['telemedicine_intakes'] = [];
        $store['clinical_uploads'] = [];
        $store['appointments'][] = [
            'id' => 201,
            'service' => 'video',
            'status' => 'confirmed',
            'telemedicineIntakeId' => 701,
        ];
        $store['telemedicine_intakes'][] = [
            'id' => 701,
            'channel' => 'secure_video',
            'legacyService' => 'video',
            'status' => 'review_required',
            'suitability' => 'review_required',
            'reviewRequired' => true,
            'linkedAppointmentId' => 201,
            'createdAt' => '2026-03-03T12:00:00-05:00',
            'updatedAt' => '2026-03-03T12:10:00-05:00',
        ];
        $store['clinical_uploads'][] = [
            'id' => 801,
            'intakeId' => 701,
            'appointmentId' => 201,
            'kind' => 'case_photo',
            'storageMode' => 'private_clinical',
            'privatePath' => 'clinical-media/case-801.jpg',
            'createdAt' => '2026-03-03T12:00:00-05:00',
            'updatedAt' => '2026-03-03T12:10:00-05:00',
        ];
        \write_store($store, false);

        ob_start();
        \SystemController::metrics(['store' => \read_store()]);
        $output = (string) ob_get_clean();

        $this->assertStringContainsString('pielarmonia_telemedicine_intakes_total 1', $output);
        $this->assertStringContainsString('pielarmonia_telemedicine_intakes_by_status_total{status="review_required"} 1', $output);
        $this->assertStringContainsString('pielarmonia_telemedicine_intakes_by_channel_total{channel="secure_video"} 1', $output);
        $this->assertStringContainsString('pielarmonia_telemedicine_media_by_kind_total{kind="case_photo"} 1', $output);
        $this->assertStringContainsString('pielarmonia_telemedicine_media_by_storage_total{storage_mode="private_clinical"} 1', $output);
        $this->assertStringContainsString('pielarmonia_telemedicine_review_queue_total 1', $output);
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
