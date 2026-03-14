<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;
use BookingService;

require_once __DIR__ . '/../../lib/BookingService.php';
require_once __DIR__ . '/../../lib/storage.php';

class BookingFlowTest extends TestCase
{
    private string $tempDir;
    private BookingService $service;

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/pielarmonia_test_flow_' . bin2hex(random_bytes(8));
        if (!mkdir($this->tempDir, 0777, true)) {
            $this->fail('Could not create temp dir');
        }
        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        ini_set('log_errors', '1');
        ini_set('error_log', $this->tempDir . '/php-error.log');

        // Prevent migration by creating empty store.json
        file_put_contents($this->tempDir . '/store.json', json_encode([
            'appointments' => [],
            'availability' => [],
            'reviews' => [],
            'callbacks' => [],
            'updatedAt' => date('c')
        ]));

        $this->service = new BookingService();
    }

    protected function tearDown(): void
    {
        foreach ([
            'PIELARMONIA_REQUIRE_DATA_ENCRYPTION',
            'PIELARMONIA_FORCE_SQLITE_UNAVAILABLE',
            'PIELARMONIA_DATA_ENCRYPTION_KEY',
        ] as $key) {
            putenv($key);
        }
        $this->resetStorageConnectionQuietly();
        $this->removeDirectory($this->tempDir);
        putenv('PIELARMONIA_DATA_DIR');
    }

    private function removeDirectory(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = $dir . '/' . $file;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                unlink($path);
            }
        }
        rmdir($dir);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testCompleteBookingFlow(): void
    {
        // 1. Initial State
        $store = read_store();
        $this->assertCount(0, $store['appointments']);

        // 2. Setup Availability
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store['availability'][$futureDate] = ['10:00', '11:00'];
        write_store($store);

        // 3. Create Appointment
        $payload = [
            'name' => 'Integration User',
            'email' => 'integration@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        // Reload store to simulate new request
        $store = read_store();
        $result = $this->service->create($store, $payload);

        $this->assertTrue($result['ok']);
        $newAppt = $result['data'];
        $this->assertNotEmpty($newAppt['id']);

        // Persist
        write_store($result['store']);

        // 4. Verify Persistence
        $store = read_store();
        $this->assertCount(1, $store['appointments']);
        $this->assertEquals($newAppt['id'], $store['appointments'][0]['id']);

        // 5. Reschedule
        $newTime = '11:00';
        $token = $newAppt['rescheduleToken'];

        $result = $this->service->reschedule($store, $token, $futureDate, $newTime);
        $this->assertTrue($result['ok']);

        // Persist
        write_store($result['store']);

        // Verify Reschedule
        $store = read_store();
        $updatedAppt = $store['appointments'][0];
        $this->assertEquals('11:00', $updatedAppt['time']);

        // 6. Cancel
        $result = $this->service->cancel($store, (int)$updatedAppt['id']);
        $this->assertTrue($result['ok']);

        // Persist
        write_store($result['store']);

        // Verify Cancel
        $store = read_store();
        $cancelledAppt = $store['appointments'][0];
        $this->assertEquals('cancelled', $cancelledAppt['status']);
    }

    /**
     * @runInSeparateProcess
     * @preserveGlobalState disabled
     */
    public function testTelemedicineBookingBlocksWhenClinicalStorageIsNotReady(): void
    {
        putenv('PIELARMONIA_REQUIRE_DATA_ENCRYPTION=1');
        putenv('PIELARMONIA_FORCE_SQLITE_UNAVAILABLE=1');
        putenv('PIELARMONIA_DATA_ENCRYPTION_KEY');
        $this->resetStorageConnectionQuietly();

        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store = read_store();
        $store['availability'][$futureDate] = ['10:00'];
        write_store($store);

        $payload = [
            'name' => 'Telemedicine Blocked',
            'email' => 'telemed-blocked@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'video',
            'reason' => 'Seguimiento telemedicina bloqueado.',
            'affectedArea' => 'rostro',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ];

        $result = $this->service->create(read_store(), $payload);

        $this->assertFalse((bool) ($result['ok'] ?? true));
        $this->assertSame(409, (int) ($result['code'] ?? 0));
        $this->assertSame('clinical_storage_not_ready', (string) ($result['errorCode'] ?? ''));
        $this->assertSame(false, (bool) ($result['meta']['clinicalData']['ready'] ?? true));

        $roundtrip = read_store();
        $this->assertCount(0, $roundtrip['appointments']);
        $this->assertCount(0, $roundtrip['telemedicine_intakes']);
        $this->assertCount(0, $roundtrip['clinical_uploads']);
    }

    private function resetStorageConnectionQuietly(): void
    {
        if (!\function_exists('get_db_connection')) {
            return;
        }

        ob_start();
        try {
            \get_db_connection(null, true);
        } finally {
            ob_end_clean();
        }
    }
}
