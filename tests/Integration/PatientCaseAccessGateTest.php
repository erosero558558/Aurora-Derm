<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class PatientCaseAccessGateTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_RESPONSE'], $GLOBALS['__TEST_JSON_BODY']);
        $_GET = [];
        $_SERVER = [
            'REMOTE_ADDR' => '127.0.0.1',
            'REQUEST_METHOD' => 'GET',
        ];

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'patient-case-access-gate-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=1');
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=1');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';
        require_once __DIR__ . '/../../controllers/PatientCaseController.php';
        require_once __DIR__ . '/../../controllers/TelemedicineAdminController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_DATA_DIR',
            'PIELARMONIA_AVAILABILITY_SOURCE',
            'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
            'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
            'PIELARMONIA_DATA_ENCRYPTION_KEY',
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

    public function testPatientCasesEndpointBlocksWhenClinicalStorageIsNotReady(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \PatientCaseController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(409, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame(
            'clinical_storage_not_ready',
            (string) ($response['payload']['code'] ?? '')
        );
        $this->assertFalse(
            (bool) ($response['payload']['readiness']['clinicalData']['ready'] ?? true)
        );
        $this->assertSame([], $response['payload']['data']['cases'] ?? null);
        $this->assertSame([], $response['payload']['data']['timeline'] ?? null);
    }

    public function testAdminDataRedactsClinicalReadModelsWhenStorageIsNotReady(): void
    {
        $store = \read_store();
        $store['queue_tickets'][] = \normalize_queue_ticket([
            'id' => 91001,
            'ticketCode' => 'Z-902',
            'dailySeq' => 2,
            'queueType' => 'walk_in',
            'patientInitials' => 'EC',
            'status' => 'waiting',
            'createdAt' => date('c'),
            'createdSource' => 'kiosk',
        ]);
        $store['queue_help_requests'][] = \normalize_queue_help_request([
            'id' => 92001,
            'ticketId' => 91001,
            'ticketCode' => 'Z-902',
            'patientInitials' => 'EC',
            'reason' => 'human_help',
            'status' => 'pending',
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ]);
        \write_store($store, false);

        $response = $this->captureJsonResponse(static function (): void {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(200, $response['status']);
        $this->assertTrue((bool) ($response['payload']['ok'] ?? false));
        $this->assertFalse(
            (bool) ($response['payload']['data']['internalConsoleMeta']['clinicalData']['ready'] ?? true)
        );
        $this->assertGreaterThanOrEqual(
            1,
            (int) ($response['payload']['data']['patientFlowMeta']['casesTotal'] ?? 0)
        );
        $this->assertSame([], $response['payload']['data']['patient_cases'] ?? null);
        $this->assertSame([], $response['payload']['data']['patient_case_timeline_events'] ?? null);
        $this->assertSame([], $response['payload']['data']['patient_case_approvals'] ?? null);
        $this->assertSame([], $response['payload']['data']['clinical_uploads'] ?? null);
        $this->assertSame([], $response['payload']['data']['telemedicine_intakes'] ?? null);
    }

    public function testTelemedicineIndexBlocksWhenClinicalStorageIsNotReady(): void
    {
        $response = $this->captureJsonResponse(static function (): void {
            \TelemedicineAdminController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(409, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('clinical_storage_not_ready', (string) ($response['payload']['code'] ?? ''));
        $this->assertSame([], $response['payload']['data']['items'] ?? null);
        $this->assertSame(0, (int) ($response['payload']['data']['count'] ?? -1));
    }

    public function testAdminImportRejectsClinicalCollectionsWhenStorageIsNotReady(): void
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';
        $_SERVER['HTTP_X_CSRF_TOKEN'] = 'test-csrf';
        $_SESSION['csrf_token'] = 'test-csrf';
        $GLOBALS['__TEST_JSON_BODY'] = json_encode([
            'patient_case_approvals' => [
                ['id' => 'approval-1'],
            ],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $response = $this->captureJsonResponse(static function (): void {
            \AdminDataController::import([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertSame(409, $response['status']);
        $this->assertFalse((bool) ($response['payload']['ok'] ?? true));
        $this->assertSame('clinical_storage_not_ready', (string) ($response['payload']['code'] ?? ''));
        $this->assertSame(
            ['patient_case_approvals'],
            $response['payload']['clinicalFields'] ?? null
        );
    }

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
        } finally {
            unset($GLOBALS['__TEST_JSON_BODY']);
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
