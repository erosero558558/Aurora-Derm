<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Mocks for dependencies that are not included or need overriding
if (!function_exists('data_dir_path')) {
    function data_dir_path(): string {
        $tmp = sys_get_temp_dir() . '/pielarmonia-test-' . getmypid();
        if (!is_dir($tmp)) {
            @mkdir($tmp, 0775, true);
        }
        return $tmp;
    }
}

if (!function_exists('audit_log_event')) {
    function audit_log_event(string $event, array $details = []): void {}
}

if (!class_exists('Metrics')) {
    class Metrics {
        public static function increment(string $name, array $labels = [], int $value = 1): void {}
        public static function observe(string $name, float $value, array $labels = [], ?array $buckets = null): void {}
    }
}

// Ensure clean environment
putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
putenv('PIELARMONIA_GOOGLE_CALENDAR_ENABLED=false');

// Include System Under Test
// This will include common.php, business.php, validation.php, etc.
require_once __DIR__ . '/../lib/BookingService.php';

// Setup Store
$today = date('Y-m-d');
$tomorrow = date('Y-m-d', strtotime('+1 day'));
$dayAfter = date('Y-m-d', strtotime('+2 days'));
$pastDate = date('Y-m-d', strtotime('-1 day'));

$store = [
    'appointments' => [],
    'availability' => [
        $tomorrow => ['10:00', '11:00', '12:00'],
        $dayAfter => ['10:00', '11:00'],
        $pastDate => ['10:00'] // Even if available, should fail due to date check
    ],
    'idx_appointments_date' => []
];

$service = new BookingService();

// --- Test 1: Create ---
$createdId = 0;
$createdToken = '';

run_test('BookingService::create success', function () use ($service, &$store, $tomorrow, &$createdId, &$createdToken) {
    $payload = [
        'service' => 'consulta',
        'doctor' => 'rosero',
        'date' => $tomorrow,
        'time' => '10:00',
        'name' => 'Test User',
        'email' => 'test@example.com',
        'phone' => '0991234567',
        'privacyConsent' => true,
        'paymentMethod' => 'cash'
    ];

    $result = $service->create($store, $payload);

    assert_true($result['ok'], 'Create should succeed');
    assert_equals(201, $result['code'], 'Status code should be 201');
    assert_array_has_key('data', $result, 'Result should have data');
    assert_array_has_key('id', $result['data'], 'Data should have id');

    $createdId = (int)$result['data']['id'];
    $createdToken = (string)($result['data']['rescheduleToken'] ?? '');

    // Update store for next tests
    $store = $result['store'];

    // Verify it's in the store
    $found = false;
    foreach ($store['appointments'] as $appt) {
        if ((int)$appt['id'] === $createdId) {
            $found = true;
            assert_equals('confirmed', $appt['status'], 'Status should be confirmed');
            break;
        }
    }
    assert_true($found, 'Appointment should be in store');
});

// --- Test 2: Conflict ---
run_test('BookingService::create conflict', function () use ($service, &$store, $tomorrow) {
    $payload = [
        'service' => 'consulta',
        'doctor' => 'rosero', // Same doctor
        'date' => $tomorrow,
        'time' => '10:00', // Same time as Test 1
        'name' => 'Another User',
        'email' => 'other@example.com',
        'phone' => '0997654321',
        'privacyConsent' => true,
        'paymentMethod' => 'cash'
    ];

    $result = $service->create($store, $payload);

    assert_false($result['ok'], 'Create should fail due to conflict');
    // Expect 409 or similar error code for conflict
    assert_equals(409, $result['code'], 'Status code should be 409 for conflict');
    assert_contains('reservado', strtolower($result['error']), 'Error should mention reserved/taken');
});

// --- Test 3: Past Date ---
run_test('BookingService::create past date', function () use ($service, &$store, $pastDate) {
    $payload = [
        'service' => 'consulta',
        'doctor' => 'rosero',
        'date' => $pastDate,
        'time' => '10:00',
        'name' => 'Past User',
        'email' => 'past@example.com',
        'phone' => '0991112222',
        'privacyConsent' => true,
        'paymentMethod' => 'cash'
    ];

    $result = $service->create($store, $payload);

    assert_false($result['ok'], 'Create should fail for past date');
    assert_equals(400, $result['code'], 'Status code should be 400');
    assert_contains('pasada', strtolower($result['error']), 'Error should mention past date');
});

// --- Test 4: Cancel ---
run_test('BookingService::cancel success', function () use ($service, &$store, $createdId) {
    $result = $service->cancel($store, $createdId);

    assert_true($result['ok'], 'Cancel should succeed');

    // Update store
    $store = $result['store'];

    // Verify status
    $found = false;
    foreach ($store['appointments'] as $appt) {
        if ((int)$appt['id'] === $createdId) {
            $found = true;
            assert_equals('cancelled', $appt['status'], 'Status should be cancelled');
            break;
        }
    }
    assert_true($found, 'Appointment should exist');
});

// --- Test 5: Reschedule ---
run_test('BookingService::reschedule success', function () use ($service, &$store, $dayAfter) {
    // First, create a NEW appointment to reschedule (since the previous one is cancelled)
    $payload = [
        'service' => 'consulta',
        'doctor' => 'rosero',
        'date' => $dayAfter,
        'time' => '10:00',
        'name' => 'Reschedule User',
        'email' => 'resch@example.com',
        'phone' => '0998887777',
        'privacyConsent' => true,
        'paymentMethod' => 'cash'
    ];

    $createResult = $service->create($store, $payload);
    assert_true($createResult['ok'], 'Setup: Create appointment for reschedule failed');
    $store = $createResult['store'];
    $apptToReschedule = $createResult['data'];
    $token = (string)$apptToReschedule['rescheduleToken'];

    // Now reschedule it to 11:00 on the same day (or another day)
    // defined in availability: $dayAfter => ['10:00', '11:00']
    $newTime = '11:00';

    $result = $service->reschedule($store, $token, $dayAfter, $newTime);

    assert_true($result['ok'], 'Reschedule should succeed');

    // Update store
    $store = $result['store'];

    // Verify
    $found = false;
    foreach ($store['appointments'] as $appt) {
        // Search by token
        if (($appt['rescheduleToken'] ?? '') === $token) {
            $found = true;
            assert_equals($dayAfter, $appt['date'], 'Date should be updated');
            assert_equals($newTime, $appt['time'], 'Time should be updated');
            assert_equals('confirmed', $appt['status'], 'Status should be confirmed');
            break;
        }
    }
    assert_true($found, 'Rescheduled appointment should be found');
});

print_test_summary();
