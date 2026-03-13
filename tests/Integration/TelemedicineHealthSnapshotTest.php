<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class TelemedicineHealthSnapshotTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-health-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_TELEMED_V2_SHADOW=true');
        putenv('PIELARMONIA_TELEMED_V2_ENFORCE_UNSUITABLE=true');
        putenv('PIELARMONIA_TELEMED_V2_ENFORCE_REVIEW_REQUIRED=false');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_TELEMED_V2_SHADOW',
            'PIELARMONIA_TELEMED_V2_ENFORCE_UNSUITABLE',
            'PIELARMONIA_TELEMED_V2_ENFORCE_REVIEW_REQUIRED',
        ] as $key) {
            putenv($key);
        }

        if (function_exists('get_db_connection')) {
            \get_db_connection(null, true);
        }

        $this->removeDirectory($this->tempDir);
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testHealthExposesTelemedicineSummaryWithoutReviewQueuePhi(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['telemedicine_intakes'] = [];
        $store['clinical_uploads'] = [];
        $store['appointments'][] = [
            'id' => 101,
            'service' => 'video',
            'status' => 'confirmed',
            'telemedicineIntakeId' => 501,
        ];
        $store['telemedicine_intakes'][] = [
            'id' => 501,
            'channel' => 'secure_video',
            'legacyService' => 'video',
            'status' => 'review_required',
            'suitability' => 'review_required',
            'reviewRequired' => true,
            'suitabilityReasons' => ['missing_case_photos'],
            'escalationRecommendation' => 'manual_review',
            'linkedAppointmentId' => 101,
            'patient' => [
                'name' => 'Paciente Review',
                'email' => 'review@example.com',
                'phone' => '0990000001',
            ],
            'clinicalMediaIds' => [701],
            'requestedDate' => '2026-03-10',
            'requestedTime' => '10:00',
            'requestedDoctor' => 'rosero',
            'createdAt' => '2026-03-03T10:00:00-05:00',
            'updatedAt' => '2026-03-03T10:05:00-05:00',
        ];
        $store['clinical_uploads'][] = [
            'id' => 701,
            'intakeId' => 501,
            'appointmentId' => 101,
            'kind' => 'case_photo',
            'storageMode' => 'private_clinical',
            'privatePath' => 'clinical-media/review-case.jpg',
            'createdAt' => '2026-03-03T10:00:00-05:00',
            'updatedAt' => '2026-03-03T10:05:00-05:00',
        ];
        \write_store($store, false);

        try {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'requestStartedAt' => microtime(true),
                'diagnosticsAuthorized' => true,
            ]);
            self::fail('Se esperaba TestingExitException');
        } catch (\TestingExitException $e) {
            $payload = $e->payload;
        }

        $this->assertTrue($payload['ok']);
        $this->assertArrayHasKey('telemedicine', $payload['checks']);
        $telemedicine = $payload['checks']['telemedicine'];
        $this->assertTrue((bool) ($telemedicine['configured'] ?? false));
        $this->assertSame(1, (int) ($telemedicine['intakes']['total'] ?? -1));
        $this->assertSame(1, (int) ($telemedicine['reviewQueueCount'] ?? -1));
        $this->assertSame(1, (int) ($telemedicine['integrity']['linkedAppointmentsCount'] ?? -1));
        $this->assertSame(true, (bool) ($telemedicine['policy']['shadowModeEnabled'] ?? false));
        $this->assertSame(true, (bool) ($telemedicine['policy']['enforceUnsuitable'] ?? false));
        $this->assertSame(false, (bool) ($telemedicine['policy']['enforceReviewRequired'] ?? true));
        $this->assertArrayHasKey('diagnostics', $telemedicine);
        $this->assertSame('healthy', (string) ($telemedicine['diagnostics']['status'] ?? ''));
        $this->assertTrue((bool) ($telemedicine['diagnostics']['healthy'] ?? false));
        $this->assertSame(0, (int) ($telemedicine['diagnostics']['summary']['critical'] ?? -1));
        $this->assertArrayNotHasKey('reviewQueue', $telemedicine);
        $this->assertStringNotContainsString('review@example.com', json_encode($telemedicine, JSON_UNESCAPED_UNICODE));
        $this->assertStringNotContainsString('Paciente Review', json_encode($telemedicine, JSON_UNESCAPED_UNICODE));
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
