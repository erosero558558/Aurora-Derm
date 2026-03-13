<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 * @preserveGlobalState disabled
 */
final class PatientCaseFlowTest extends TestCase
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

        $this->tempDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'patient-case-flow-' . bin2hex(random_bytes(6));
        mkdir($this->tempDir, 0777, true);

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . DIRECTORY_SEPARATOR . 'php-error.log');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../api-lib.php';
        require_once __DIR__ . '/../../lib/BookingService.php';
        require_once __DIR__ . '/../../lib/QueueService.php';
        require_once __DIR__ . '/../../controllers/AdminDataController.php';
        require_once __DIR__ . '/../../controllers/HealthController.php';
        require_once __DIR__ . '/../../controllers/PatientCaseController.php';

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

    public function testBookingAndQueueLifecycleHydratesSinglePatientCase(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 day'));
        $store = \read_store();
        $store['availability'][$futureDate] = ['09:00', '09:30'];
        \write_store($store, false);

        $bookingService = new \BookingService();
        $create = $bookingService->create(\read_store(), [
            'name' => 'Paciente Canonico',
            'email' => 'paciente@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '09:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ]);

        $this->assertTrue($create['ok']);
        $appointment = $create['data'];
        $this->assertNotSame('', (string) ($appointment['patientCaseId'] ?? ''));
        \write_store($create['store'], false);

        $store = \read_store();
        $this->assertSame(1, count($store['patient_cases'] ?? []));
        $this->assertSame('booked', (string) ($store['patient_cases'][0]['status'] ?? ''));
        $this->assertSame(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($store['appointments'][0]['patientCaseId'] ?? '')
        );

        $queueService = new \QueueService();
        $checkIn = $queueService->checkInAppointment($store, [
            'telefono' => '0991234567',
            'hora' => '09:00',
            'fecha' => $futureDate,
        ], 'kiosk');
        $this->assertTrue($checkIn['ok']);
        $this->assertFalse((bool) ($checkIn['replay'] ?? true));
        $this->assertSame(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($checkIn['ticket']['patientCaseId'] ?? '')
        );
        \write_store($checkIn['store'], false);

        $store = \read_store();
        $this->assertSame('checked_in', (string) ($store['patient_cases'][0]['status'] ?? ''));

        $call = $queueService->callNext($store, 1);
        $this->assertTrue($call['ok']);
        \write_store($call['store'], false);

        $store = \read_store();
        $this->assertSame('called', (string) ($store['patient_cases'][0]['status'] ?? ''));

        $complete = $queueService->patchTicket($store, [
            'id' => (int) ($call['ticket']['id'] ?? 0),
            'action' => 'completar',
        ]);
        $this->assertTrue($complete['ok']);
        \write_store($complete['store'], false);

        $store = \read_store();
        $case = $store['patient_cases'][0] ?? [];
        $timeline = $store['patient_case_timeline_events'] ?? [];

        $this->assertSame('completed', (string) ($case['status'] ?? ''));
        $this->assertNotSame('', (string) ($case['closedAt'] ?? ''));
        $this->assertSame(
            (string) ($appointment['patientCaseId'] ?? ''),
            (string) ($store['queue_tickets'][0]['patientCaseId'] ?? '')
        );
        $this->assertGreaterThanOrEqual(4, count($timeline));
        $this->assertContains('queue_called', array_column($timeline, 'type'));
        $this->assertContains('visit_completed', array_column($timeline, 'type'));
    }

    public function testAdminAndHealthExposePatientFlowReadModels(): void
    {
        $ticketCode = 'Z-901';
        $store = \read_store();
        $store['queue_tickets'][] = \normalize_queue_ticket([
            'id' => 91001,
            'ticketCode' => $ticketCode,
            'dailySeq' => 1,
            'queueType' => 'walk_in',
            'patientInitials' => 'EC',
            'status' => 'waiting',
            'createdAt' => date('c'),
            'createdSource' => 'kiosk',
        ]);
        $store['queue_help_requests'][] = \normalize_queue_help_request([
            'id' => 92001,
            'ticketId' => 91001,
            'ticketCode' => $ticketCode,
            'patientInitials' => 'EC',
            'reason' => 'human_help',
            'status' => 'pending',
            'createdAt' => date('c'),
            'updatedAt' => date('c'),
        ]);
        \write_store($store, false);

        $adminResponse = $this->captureJsonResponse(static function (): void {
            \AdminDataController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertTrue($adminResponse['payload']['ok']);
        $this->assertGreaterThanOrEqual(1, (int) ($adminResponse['payload']['data']['patientFlowMeta']['casesTotal'] ?? 0));
        $this->assertArrayHasKey('internalConsoleMeta', $adminResponse['payload']['data']);
        $this->assertArrayHasKey('overall', $adminResponse['payload']['data']['internalConsoleMeta'] ?? []);
        $this->assertGreaterThanOrEqual(1, count($adminResponse['payload']['data']['patient_cases'] ?? []));
        $queueCase = $this->findCaseByTicketCode($adminResponse['payload']['data']['patient_cases'] ?? [], $ticketCode);
        $this->assertNotNull($queueCase);
        $this->assertSame('waiting', (string) (($queueCase['summary']['queueStatus'] ?? '')));

        $_GET['caseId'] = (string) ($queueCase['id'] ?? '');
        $patientCaseResponse = $this->captureJsonResponse(static function (): void {
            \PatientCaseController::index([
                'store' => \read_store(),
                'isAdmin' => true,
            ]);
        });

        $this->assertTrue($patientCaseResponse['payload']['ok']);
        $this->assertSame(1, count($patientCaseResponse['payload']['data']['cases'] ?? []));
        $this->assertGreaterThanOrEqual(1, count($patientCaseResponse['payload']['data']['timeline'] ?? []));

        $healthResponse = $this->captureJsonResponse(static function (): void {
            \HealthController::check([
                'store' => \read_store(),
                'method' => 'GET',
                'resource' => 'health',
                'diagnosticsAuthorized' => true,
            ]);
        });

        $this->assertTrue($healthResponse['payload']['ok']);
        $this->assertGreaterThanOrEqual(1, (int) ($healthResponse['payload']['checks']['patientFlow']['casesTotal'] ?? 0));
        $this->assertSame(1, (int) ($healthResponse['payload']['checks']['patientFlow']['activeHelpRequests'] ?? 0));
        $this->assertGreaterThanOrEqual(1, (int) ($healthResponse['payload']['checks']['storeCounts']['patientCases'] ?? 0));
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

    private function findCaseByTicketCode(array $cases, string $ticketCode): ?array
    {
        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }
            if ((string) ($case['summary']['latestTicketCode'] ?? '') === $ticketCode) {
                return $case;
            }
        }

        return null;
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
