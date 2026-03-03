<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
final class TelemedicineAdminReadModelTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'telemedicine-admin-' . bin2hex(random_bytes(6));
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
        require_once __DIR__ . '/../../controllers/AdminDataController.php';

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
        unset($GLOBALS['__TEST_RESPONSE']);
    }

    public function testAdminDataIncludesTelemedicineSummaryAndReviewQueue(): void
    {
        $store = \read_store();
        $store['appointments'] = [];
        $store['telemedicine_intakes'] = [];
        $store['clinical_uploads'] = [];
        $store['appointments'][] = [
            'id' => 111,
            'service' => 'telefono',
            'status' => 'confirmed',
            'telemedicineIntakeId' => 601,
        ];
        $store['telemedicine_intakes'][] = [
            'id' => 601,
            'channel' => 'phone',
            'legacyService' => 'telefono',
            'status' => 'review_required',
            'suitability' => 'review_required',
            'reviewRequired' => true,
            'suitabilityReasons' => ['missing_structured_history'],
            'escalationRecommendation' => 'manual_review',
            'linkedAppointmentId' => 111,
            'patient' => [
                'name' => 'Paciente Admin',
                'email' => 'admin@example.com',
                'phone' => '0990000002',
            ],
            'clinicalMediaIds' => [],
            'requestedDate' => '2026-03-11',
            'requestedTime' => '11:30',
            'requestedDoctor' => 'narvaez',
            'createdAt' => '2026-03-03T11:00:00-05:00',
            'updatedAt' => '2026-03-03T11:10:00-05:00',
        ];
        \write_store($store, false);

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
        $this->assertArrayHasKey('telemedicineMeta', $payload['data']);

        $telemedicineMeta = $payload['data']['telemedicineMeta'];
        $this->assertSame(1, (int) ($telemedicineMeta['summary']['reviewQueueCount'] ?? -1));
        $this->assertSame(1, (int) ($telemedicineMeta['summary']['intakes']['total'] ?? -1));
        $this->assertCount(1, $telemedicineMeta['reviewQueue']);
        $this->assertSame('Paciente Admin', $telemedicineMeta['reviewQueue'][0]['patientName']);
        $this->assertSame('admin@example.com', $telemedicineMeta['reviewQueue'][0]['patientEmail']);
        $this->assertSame('manual_review', $telemedicineMeta['reviewQueue'][0]['escalationRecommendation']);
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
