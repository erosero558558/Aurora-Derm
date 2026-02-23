<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// --- Mocks ---

function data_dir_path(): string
{
    $dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'piel_test_' . getmypid();
    if (!is_dir($dir)) {
        @mkdir($dir, 0775, true);
    }
    return $dir;
}

function audit_log_event(string $event, array $data): void
{
    // No-op
}

function map_appointment_status(string $status): string
{
    return $status;
}

function default_availability_enabled(): bool
{
    return true;
}

function get_default_availability(int $days = 21): array
{
    $result = [];
    $start = new DateTime(local_date('Y-m-d'));
    for ($i = 0; $i < $days; $i++) {
        $date = $start->format('Y-m-d');
        // Default slots: 10:00, 10:30, 11:00, 11:30, 12:00
        $result[$date] = ['10:00', '10:30', '11:00', '11:30', '12:00'];
        $start->modify('+1 day');
    }
    return $result;
}

// --- Includes ---

// lib/common.php defines local_date(), APP_TIMEZONE
require_once __DIR__ . '/../lib/common.php';

// lib/metrics.php is required by GoogleTokenProvider/Client
require_once __DIR__ . '/../lib/metrics.php';

// Google Calendar Dependencies
require_once __DIR__ . '/../lib/calendar/GoogleTokenProvider.php';
require_once __DIR__ . '/../lib/calendar/GoogleCalendarClient.php';
require_once __DIR__ . '/../lib/calendar/CalendarAvailabilityService.php';

// --- Mock Classes ---

class MockGoogleCalendarClient extends GoogleCalendarClient
{
    private array $mockFreeBusy = [];
    private bool $configured = false;

    public function __construct()
    {
        // Bypass parent constructor
    }

    public function isConfigured(): bool
    {
        return $this->configured;
    }

    public function setConfigured(bool $configured): void
    {
        $this->configured = $configured;
    }

    public function getTimezone(): string
    {
        return APP_TIMEZONE;
    }

    public function getCalendarIdForDoctor(string $doctor): string
    {
        if ($doctor === 'rosero') return 'rosero@example.com';
        if ($doctor === 'narvaez') return 'narvaez@example.com';
        return '';
    }

    public function setMockFreeBusy(array $data): void
    {
        $this->mockFreeBusy = $data;
    }

    public function freeBusy(array $calendarIds, string $timeMinIso, string $timeMaxIso, bool $bypassCache = false): array
    {
        // Return mock data structure matching Google API response
        // expected format: ['ok' => true, 'data' => ['calendars' => ['calId' => ['busy' => [...]]]]]
        return [
            'ok' => true,
            'data' => [
                'calendars' => $this->mockFreeBusy
            ]
        ];
    }
}

// --- Test Setup ---

function create_service(string $source = 'store', bool $blockOnFailure = true): CalendarAvailabilityService
{
    $client = new MockGoogleCalendarClient();
    if ($source === 'google') {
        $client->setConfigured(true);
    }

    // Default duration map
    $durationMap = [
        'consulta' => 30,
        'laser' => 60
    ];

    return new CalendarAvailabilityService(
        $client,
        $source,
        $blockOnFailure,
        APP_TIMEZONE,
        30, // slot step
        $durationMap
    );
}

// --- Tests ---

echo "Running Availability Tests...\n";

run_test('test_store_mode_availability_empty', function () {
    $service = create_service('store');
    $today = local_date('Y-m-d');

    // Store with no appointments, using default availability
    $store = [
        'appointments' => [],
        'availability' => [] // Will fallback to get_default_availability
    ];

    $result = $service->getAvailability($store, [
        'doctor' => 'rosero',
        'service' => 'consulta',
        'dateFrom' => $today,
        'days' => 1
    ]);

    assert_true($result['ok'], 'Should be ok');
    assert_array_has_key($today, $result['data'], 'Should have today');

    $slots = $result['data'][$today];
    // Defaults: 10:00, 10:30, 11:00, 11:30, 12:00
    assert_true(in_array('10:00', $slots), '10:00 should be available');
    assert_true(in_array('12:00', $slots), '12:00 should be available');
});

run_test('test_store_mode_booked_slots', function () {
    $service = create_service('store');
    $today = local_date('Y-m-d');

    // 10:00 is booked
    $store = [
        'appointments' => [
            [
                'date' => $today,
                'time' => '10:00',
                'doctor' => 'rosero',
                'service' => 'consulta',
                'status' => 'confirmed',
                'slotDurationMin' => 30
            ]
        ],
        'availability' => []
    ];

    // Check booked slots
    $booked = $service->getBookedSlots($store, $today, 'rosero');
    assert_true($booked['ok'], 'getBookedSlots should be ok');
    assert_true(in_array('10:00', $booked['data']), '10:00 should be in booked list');

    // Check availability (Note: In Store mode, getAvailability returns the template, NOT net availability)
    $avail = $service->getAvailability($store, [
        'doctor' => 'rosero',
        'service' => 'consulta',
        'dateFrom' => $today,
        'days' => 1
    ]);

    $slots = $avail['data'][$today];
    // In Store mode, 10:00 is still in the template even if booked.
    // The filtering happens in BookingService or via getBookedSlots.
    assert_true(in_array('10:00', $slots), '10:00 is in the template');
});

run_test('test_duration_logic_insufficient_gap', function () {
    $service = create_service('store');
    $today = local_date('Y-m-d');

    // 10:30 is booked.
    // Default Slots: 10:00, 10:30, 11:00, 11:30, 12:00
    // If 10:30 is booked, then 10:00 is free for 30m service? Yes.
    // But 10:00 is NOT free for 60m service (needs 10:00-11:00).

    $store = [
        'appointments' => [
            [
                'date' => $today,
                'time' => '10:30', // Booked
                'doctor' => 'rosero',
                'service' => 'consulta',
                'status' => 'confirmed',
                'slotDurationMin' => 30
            ]
        ],
        'availability' => []
    ];

    // Case 1: 30m service (consulta)
    // We check getBookedSlots to see what is blocked
    $booked30 = $service->getBookedSlots($store, $today, 'rosero', 'consulta');
    $blocked30 = $booked30['data'];

    assert_false(in_array('10:00', $blocked30), '10:00 should NOT be blocked for 30m service');
    assert_true(in_array('10:30', $blocked30), '10:30 should be blocked (booked)');

    // Case 2: 60m service (laser)
    // We check getBookedSlots to see what is blocked
    // "Calendar booking logic considers slots with insufficient remaining duration... as 'booked'"
    $booked60 = $service->getBookedSlots($store, $today, 'rosero', 'laser');
    $blocked60 = $booked60['data'];

    assert_true(in_array('10:00', $blocked60), '10:00 should be blocked for 60m service (insufficient duration)');
    assert_true(in_array('10:30', $blocked60), '10:30 should be blocked (booked)');
});

run_test('test_google_mode_fallback', function () {
    // If Google isn't configured, it should fallback (if not blocking) or error
    $service = create_service('google', true); // Block on failure

    // Mock client configured = false (default in mock unless setConfigured called)
    $mockClient = $service->getClient();
    $mockClient->setConfigured(false);

    $store = ['appointments' => [], 'availability' => []];
    $avail = $service->getAvailability($store, ['doctor' => 'rosero']);

    assert_false($avail['ok'], 'Should fail if Google not configured and blockOnFailure=true');
    assert_equals('calendar_unreachable', $avail['code']);
});

run_test('test_google_mode_busy_ranges', function () {
    $service = create_service('google', true);
    $mockClient = $service->getClient();
    $today = local_date('Y-m-d');

    // Busy from 10:00 to 11:00 (UTC/Local handled by timestamp conversion)
    // We need to provide ISO strings.
    // Assuming timezone is America/Guayaquil (UTC-5)
    // 10:00 local = 15:00 UTC

    $startDt = new DateTime($today . ' 10:00:00', new DateTimeZone(APP_TIMEZONE));
    $endDt = new DateTime($today . ' 11:00:00', new DateTimeZone(APP_TIMEZONE));

    $mockClient->setMockFreeBusy([
        'rosero@example.com' => [
            'busy' => [
                [
                    'start' => $startDt->format(DateTimeInterface::ATOM),
                    'end' => $endDt->format(DateTimeInterface::ATOM)
                ]
            ]
        ]
    ]);

    $store = ['appointments' => [], 'availability' => []];
    $avail = $service->getAvailability($store, [
        'doctor' => 'rosero',
        'service' => 'consulta',
        'dateFrom' => $today,
        'days' => 1
    ]);

    $slots = $avail['data'][$today];

    // 10:00 and 10:30 fall within 10:00-11:00 busy range
    assert_false(in_array('10:00', $slots), '10:00 should be busy from Google');
    assert_false(in_array('10:30', $slots), '10:30 should be busy from Google');
    assert_true(in_array('11:00', $slots), '11:00 should be free');
});

print_test_summary();
