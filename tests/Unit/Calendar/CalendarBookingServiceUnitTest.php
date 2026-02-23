<?php

declare(strict_types=1);

namespace Tests\Unit\Calendar;

use PHPUnit\Framework\TestCase;
use CalendarBookingService;
use CalendarAvailabilityService;

require_once __DIR__ . '/../../../lib/common.php';
require_once __DIR__ . '/../../../lib/metrics.php';
require_once __DIR__ . '/../../../lib/business.php';
require_once __DIR__ . '/../../../lib/models.php';
require_once __DIR__ . '/../../../lib/storage.php';
require_once __DIR__ . '/../../../lib/audit.php';
require_once __DIR__ . '/../../../lib/calendar/GoogleTokenProvider.php';
require_once __DIR__ . '/../../../lib/calendar/GoogleCalendarClient.php';
require_once __DIR__ . '/../../../lib/calendar/CalendarAvailabilityService.php';
require_once __DIR__ . '/../../../lib/calendar/CalendarBookingService.php';

class CalendarBookingServiceUnitTest extends TestCase
{
    private string $tempDir;
    /** @var array<string,string> */
    private array $originalEnv = [];

    protected function setUp(): void
    {
        $this->tempDir = sys_get_temp_dir() . '/pielarmonia-calendar-unit-' . bin2hex(random_bytes(6));
        if (!is_dir($this->tempDir)) {
            mkdir($this->tempDir, 0777, true);
        }

        $this->rememberAndSetEnv('PIELARMONIA_DATA_DIR', $this->tempDir);
        $this->rememberAndSetEnv('PIELARMONIA_AVAILABILITY_SOURCE', 'store');
        $this->rememberAndSetEnv('PIELARMONIA_CALENDAR_SLOT_STEP_MIN', '30');
        $this->rememberAndSetEnv('PIELARMONIA_SERVICE_DURATION_MAP', 'consulta:30,telefono:30,video:30,acne:30,cancer:30,laser:60,rejuvenecimiento:60');
    }

    protected function tearDown(): void
    {
        foreach ($this->originalEnv as $key => $value) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }

        if (is_dir($this->tempDir)) {
            $this->removeDirectory($this->tempDir);
        }
    }

    public function testServiceDurationMapIsApplied(): void
    {
        $booking = CalendarBookingService::fromEnv();

        $this->assertSame(30, $booking->getDurationMin('consulta'));
        $this->assertSame(60, $booking->getDurationMin('laser'));
        $this->assertSame(30, $booking->getDurationMin('servicio-desconocido'));
    }

    public function testStoreAvailabilityFiltersInvalidStartsForSixtyMinuteServices(): void
    {
        $availability = CalendarAvailabilityService::fromEnv();
        $date = date('Y-m-d', strtotime('+2 day'));

        $store = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['09:00', '09:30', '10:30'],
            ],
        ];

        $result = $availability->getAvailability($store, [
            'doctor' => 'indiferente',
            'service' => 'laser',
            'dateFrom' => $date,
            'days' => 1,
        ]);

        $this->assertTrue($result['ok']);
        $this->assertSame(['09:00'], $result['data'][$date]);
    }

    public function testStoreBookedSlotsRespectOverlapAndDuration(): void
    {
        $availability = CalendarAvailabilityService::fromEnv();
        $date = date('Y-m-d', strtotime('+2 day'));

        $store = [
            'appointments' => [
                [
                    'id' => 99,
                    'date' => $date,
                    'time' => '09:00',
                    'doctor' => 'rosero',
                    'service' => 'laser',
                    'slotDurationMin' => 60,
                    'status' => 'confirmed',
                ],
            ],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['09:00', '09:30', '10:00', '10:30'],
            ],
        ];

        // The booked appointment is at 09:00 with 60 minutes duration (09:00-10:00).
        // It occupies the 09:00 and 09:30 slots.
        // The 10:30 slot is available, but if we request a 60 min service, it might not be enough if 11:00 is not in availability.
        // However, getBookedSlots returns slots that are *booked* or *conflicting*, or *insufficient duration*?
        // Wait, getBookedSlots returns the slots that are occupied or invalid.
        // The appointment is 09:00-10:00.
        // Slots: 09:00, 09:30, 10:00, 10:30.
        // 09:00 overlaps with appt? Yes (09:00 < 10:00 && 09:00 < 09:30 is false, 09:00 < 10:00 && 09:00 < 10:00? )
        // range: 09:00 (timestamp X) to X+3600.
        // slot 09:00 (X). 30 min service -> X to X+1800.
        // Overlap: X < X+3600 && X < X+1800 -> True. 09:00 is booked.
        // slot 09:30 (X+1800). 30 min service -> X+1800 to X+3600.
        // Overlap: X+1800 < X+3600 && X < X+3600 -> True. 09:30 is booked.
        // slot 10:00 (X+3600). 30 min service -> X+3600 to X+5400.
        // Overlap: X+3600 < X+3600 (False). 10:00 is free.
        // slot 10:30 (X+5400). 30 min service -> X+5400 to X+7200.
        // Overlap: X+5400 < X+3600 (False). 10:30 is free.

        // However, the failure output shows `10:30` is also in the actual result for `resultFor60`.
        // If we request 60 min service at 10:30:
        // Duration check: 10:30 + 60m = 11:30.
        // We need 10:30 and 11:00 to be in availability.
        // Availability has: 09:00, 09:30, 10:00, 10:30.
        // 11:00 is NOT in availability.
        // So 10:30 is invalid for a 60 min service because the subsequent slot (11:00) is missing.
        // Therefore, getBookedSlots (which returns unavailable slots) should include 10:30 for the 60min request.

        // For 30 min service (resultFor30):
        // 10:30 + 30m = 11:00. This fits in the slot itself (single slot check usually, but supportsDurationFromTemplate checks if consecutive slots exist).
        // supportsDurationFromTemplate for 30min (step 30) -> parts=1. Returns true immediately.
        // So 10:30 is valid for 30min service.
        // Thus resultFor30 should be ['09:00', '09:30'].

        // For 60 min service (resultFor60):
        // 10:30 + 60m = 11:30.
        // supportsDurationFromTemplate for 60min (step 30) -> parts=2.
        // i=1: next = 10:30 + 30m = 11:00.
        // Is 11:00 in availability? No.
        // So supportsDurationFromTemplate returns false.
        // The slot is added to booked (unavailable) list.
        // So resultFor60 should be ['09:00', '09:30', '10:30'].

        $resultFor30 = $availability->getBookedSlots($store, $date, 'rosero', 'consulta');
        $this->assertTrue($resultFor30['ok']);
        $this->assertSame(['09:00', '09:30'], $resultFor30['data']);

        $resultFor60 = $availability->getBookedSlots($store, $date, 'rosero', 'laser');
        $this->assertTrue($resultFor60['ok']);
        sort($resultFor60['data']);
        $this->assertSame(['09:00', '09:30', '10:30'], $resultFor60['data']);
    }

    public function testIndiferenteAssignsDoctorWithLeastLoad(): void
    {
        $booking = CalendarBookingService::fromEnv();
        $date = date('Y-m-d', strtotime('+3 day'));

        $store = [
            'appointments' => [
                [
                    'id' => 1,
                    'date' => $date,
                    'time' => '08:30',
                    'doctor' => 'rosero',
                    'status' => 'confirmed',
                ],
                [
                    'id' => 2,
                    'date' => $date,
                    'time' => '09:30',
                    'doctor' => 'rosero',
                    'status' => 'confirmed',
                ],
            ],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['10:00', '10:30'],
            ],
            'meta' => [
                'indiferenteCursor' => 'rosero',
            ],
        ];

        $assigned = $booking->assignDoctorForIndiferente($store, $date, '10:00', 'consulta');

        $this->assertTrue($assigned['ok']);
        $this->assertSame('narvaez', $assigned['doctor']);
    }

    public function testIndiferenteTieBreakUsesCursorAndThenAdvances(): void
    {
        $booking = CalendarBookingService::fromEnv();
        $date = date('Y-m-d', strtotime('+4 day'));

        $store = [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [
                $date => ['11:00', '11:30'],
            ],
            'meta' => [
                'indiferenteCursor' => 'narvaez',
            ],
        ];

        $assigned = $booking->assignDoctorForIndiferente($store, $date, '11:00', 'consulta');

        $this->assertTrue($assigned['ok']);
        $this->assertSame('narvaez', $assigned['doctor']);

        $booking->advanceIndiferenteCursor($store, $assigned['doctor']);
        $this->assertSame('rosero', $store['meta']['indiferenteCursor']);
    }

    private function rememberAndSetEnv(string $key, string $value): void
    {
        if (!array_key_exists($key, $this->originalEnv)) {
            $this->originalEnv[$key] = (string) (getenv($key) ?: '');
        }
        putenv($key . '=' . $value);
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }

    private function removeDirectory(string $dir): void
    {
        $items = @scandir($dir);
        if (!is_array($items)) {
            return;
        }
        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }
            $path = $dir . DIRECTORY_SEPARATOR . $item;
            if (is_dir($path)) {
                $this->removeDirectory($path);
            } else {
                @unlink($path);
            }
        }
        @rmdir($dir);
    }
}
