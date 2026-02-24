<?php

declare(strict_types=1);

namespace Tests\Integration;

use PHPUnit\Framework\TestCase;

/**
 * @runInSeparateProcess
 */
class AppointmentErrorCodesTest extends TestCase
{
    private string $tempDir;

    protected function setUp(): void
    {
        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);

        $this->tempDir = sys_get_temp_dir() . '/test_appointment_errors_' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        putenv('PIELARMONIA_DATA_DIR=' . $this->tempDir);
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=false');

        if (!defined('TESTING_ENV')) {
            define('TESTING_ENV', true);
        }

        require_once __DIR__ . '/../../lib/common.php';
        require_once __DIR__ . '/../../lib/storage.php';
        require_once __DIR__ . '/../../lib/business.php';
        require_once __DIR__ . '/../../lib/http.php';
        require_once __DIR__ . '/../../lib/ratelimit.php';
        require_once __DIR__ . '/../../lib/validation.php';
        require_once __DIR__ . '/../../lib/models.php';
        require_once __DIR__ . '/../../lib/event_setup.php';
        require_once __DIR__ . '/../../controllers/AppointmentController.php';

        \ensure_data_file();
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_DATA_DIR');
        putenv('PIELARMONIA_AVAILABILITY_SOURCE');
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR');

        unset($GLOBALS['__TEST_JSON_BODY']);
        unset($GLOBALS['__TEST_RESPONSE']);
        $this->removeDirectory($this->tempDir);
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

    private function buildValidPayload(string $date, string $time = '10:00'): array
    {
        return [
            'service' => 'consulta',
            'doctor' => 'rosero',
            'date' => $date,
            'time' => $time,
            'name' => 'Paciente Error Test',
            'email' => 'paciente.error.test@example.com',
            'phone' => '+593999000111',
            'reason' => 'Prueba de codigos',
            'privacyConsent' => true,
            'paymentMethod' => 'cash',
        ];
    }

    public function testStoreNormalizesConflictAsSlotConflict(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 day'));
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'][$futureDate] = ['10:00', '10:30'];
        \write_store($store);

        $payload = $this->buildValidPayload($futureDate, '10:00');

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for first booking');
        } catch (\TestingExitException $e) {
            $this->assertSame(201, $e->status);
            $this->assertTrue((bool) ($e->payload['ok'] ?? false));
        }

        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);
        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for slot conflict');
        } catch (\TestingExitException $e) {
            $this->assertSame(409, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('slot_conflict', (string) ($e->payload['code'] ?? ''));
        }
    }

    public function testStoreKeepsCalendarUnreachableCodeWhenGoogleIsRequired(): void
    {
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=true');

        $futureDate = date('Y-m-d', strtotime('+3 day'));
        $store = \read_store();
        $store['appointments'] = [];
        $store['callbacks'] = [];
        $store['reviews'] = [];
        $store['availability'][$futureDate] = ['11:00'];
        \write_store($store);

        $payload = $this->buildValidPayload($futureDate, '11:00');
        $GLOBALS['__TEST_JSON_BODY'] = json_encode($payload, JSON_UNESCAPED_UNICODE);

        try {
            \AppointmentController::store(['store' => \read_store()]);
            $this->fail('Expected TestingExitException for calendar requirement failure');
        } catch (\TestingExitException $e) {
            $this->assertSame(503, $e->status);
            $this->assertFalse((bool) ($e->payload['ok'] ?? true));
            $this->assertSame('calendar_unreachable', (string) ($e->payload['code'] ?? ''));
        }
    }
}
