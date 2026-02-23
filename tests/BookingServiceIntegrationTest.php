<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Mocks
$mock_store = [
    'appointments' => [],
    'availability' => [],
    'idx_appointments_date' => []
];
$mock_payload = [];
$mock_intent = [
    'status' => 'succeeded',
    'amount' => 4000,
    'currency' => 'usd',
    'metadata' => [
        'site' => 'pielarmonia.com',
        'service' => 'consulta',
        'date' => '2024-01-01',
        'time' => '10:00',
        'doctor' => 'rosero'
    ]
];

class JsonResponseException extends Exception
{
    public $payload;
    public $status;
    public function __construct($payload, $status)
    {
        $this->payload = $payload;
        $this->status = $status;
        parent::__construct(json_encode($payload));
    }
}

function json_response(array $payload, int $status = 200): void
{
    throw new JsonResponseException($payload, $status);
}

function read_store(): array
{
    global $mock_store;
    return $mock_store;
}

function write_store(array $store): bool
{
    global $mock_store;
    $mock_store = $store;
    return true;
}

function require_rate_limit($key, $limit, $window): void
{
}

function require_json_body(): array
{
    global $mock_payload;
    return $mock_payload;
}

function data_dir_path(): string
{
    return sys_get_temp_dir();
}

function with_store_lock(callable $callback): array
{
    // No-op lock for test
    return ['ok' => true, 'result' => $callback()];
}

// Mocking email functions if not already defined (though lib/email.php might be included via event_setup.php)
// Since we now include event_setup.php -> EmailListener.php -> email.php, we should remove these mocks if they conflict.
// However, existing tests rely on them being mocks? No, email.php has real logic.
// If we want to mock them, we should have done it before including email.php.
// But we are in a single file test runner.
// Strategy: Use runkit if available, or just don't include email.php if we can help it.
// But EmailListener requires email.php.
// So we must rely on the real email.php, but ensure it doesn't actually send emails during tests.
// email.php uses send_mail() which uses mail() or PHPMailer.
// We can define a mock for send_mail() if it's not defined? No, it's in email.php.
// The best way here is to remove these function definitions since they clash with email.php included by event_setup.php.
// And then we need to ensure email sending doesn't break the test (e.g. by configuring it to fail gracefully or pass).
// Or better: redefine `smtp_enabled` to return false and `mail` to return true?
// `mail` is a built-in.
// Let's remove the conflicting definitions first.

function payment_gateway_enabled(): bool
{
    return true;
}
function payment_currency(): string
{
    return 'USD';
}
function payment_expected_amount_cents($service): int
{
    return 4000;
} // 40 + 0% = 40.00

function stripe_get_payment_intent(string $id): array
{
    global $mock_intent;
    return $mock_intent;
}

// Include code under test
// Note: We avoid api-lib.php to prevent including real http.php/storage.php
require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/models.php';
require_once __DIR__ . '/../lib/business.php';
require_once __DIR__ . '/../lib/event_setup.php';
require_once __DIR__ . '/../controllers/AppointmentController.php';

// Tests for lib/business.php

run_test('get_vat_rate default', function () {
    // Default is 0.12 if env not set (or empty string in mock env)
    // Note: getenv returns false/string. In CLI it might be false.
    // business.php: if (!is_string($raw) || trim($raw) === '') return 0.12;
    // We can't easily mock getenv unless we use runkit or putenv.
    // Let's assume default behavior first.
    $rate = get_vat_rate();
    assert_true(is_float($rate));
});

run_test('get_service_price_amount exists', function () {
    $price = get_service_price_amount('consulta');
    assert_equals(40.0, $price);
});

run_test('get_service_price_amount invalid', function () {
    $price = get_service_price_amount('invalid_service');
    assert_equals(0.0, $price);
});

run_test('get_service_total_price calculation', function () {
    // 40 + 0% = 40.00
    // get_service_total_price returns formatted string '$40.00'
    $price = get_service_total_price('consulta');
    assert_equals('$40.00', $price);
});

run_test('appointment_slot_taken basic', function () {
    $appointments = [
        ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
    ];
    $taken = appointment_slot_taken($appointments, '2024-01-01', '10:00');
    assert_true($taken, 'Slot should be taken');

    $free = appointment_slot_taken($appointments, '2024-01-01', '11:00');
    assert_false($free, 'Slot should be free');
});

run_test('appointment_slot_taken excludes cancelled', function () {
    $appointments = [
        ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'cancelled', 'doctor' => 'rosero']
    ];
    $taken = appointment_slot_taken($appointments, '2024-01-01', '10:00');
    assert_false($taken, 'Cancelled slot should be free');
});

run_test('appointment_slot_taken excludes self', function () {
    $appointments = [
        ['id' => 123, 'date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
    ];
    $taken = appointment_slot_taken($appointments, '2024-01-01', '10:00', 123);
    assert_false($taken, 'Slot should be free if checking against self');
});

run_test('appointment_slot_taken doctor logic', function () {
    $appointments = [
        ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
    ];
    // Asking for any doctor ('') -> taken by rosero
    $taken = appointment_slot_taken($appointments, '2024-01-01', '10:00', null, '');
    assert_true($taken, 'Slot taken generally');

    // Asking for rosero -> taken
    $takenRosero = appointment_slot_taken($appointments, '2024-01-01', '10:00', null, 'rosero');
    assert_true($takenRosero, 'Slot taken for rosero');

    // Asking for narvaez -> free (since rosero has it)
    $takenNarvaez = appointment_slot_taken($appointments, '2024-01-01', '10:00', null, 'narvaez');
    assert_false($takenNarvaez, 'Slot free for narvaez');
});

// Tests for AppointmentController::store

run_test('AppointmentController::store validation failure', function () {
    global $mock_payload;
    $mock_payload = []; // Empty

    try {
        AppointmentController::store(['store' => read_store()]);
        throw new Exception("Should have thrown JsonResponseException");
    } catch (JsonResponseException $e) {
        assert_equals(400, $e->status);
        assert_contains('obligatorios', $e->payload['error']);
    }
});

run_test('AppointmentController::store successful card payment', function () {
    global $mock_store, $mock_payload, $mock_intent;

    // Reset store
    $mock_store = [
        'appointments' => [],
        'availability' => ['2024-01-01' => ['10:00']] // Slot must be in availability
    ];

    $mock_payload = [
        'name' => 'John Doe',
        'email' => 'john@example.com',
        'phone' => '0991234567',
        'date' => '2024-01-01',
        'time' => '10:00',
        'doctor' => 'rosero',
        'service' => 'consulta',
        'privacyConsent' => true,
        'paymentMethod' => 'card',
        'paymentIntentId' => 'pi_12345'
    ];

    $mock_intent = [
        'status' => 'succeeded',
        'amount' => 4000,
        'amount_received' => 4000,
        'currency' => 'USD',
        'metadata' => [
            'site' => 'pielarmonia.com',
            'service' => 'consulta',
            'date' => '2024-01-01',
            'time' => '10:00',
            'doctor' => 'rosero'
        ]
    ];

    // Trick: local_date checks date() which uses current time.
    // '2024-01-01' is in the past relative to now (unless we are in 2023).
    // The controller checks: if ($appointment['date'] < local_date('Y-m-d')) error.
    // We need a future date.
    $futureDate = date('Y-m-d', strtotime('+1 day'));
    $mock_payload['date'] = $futureDate;
    $mock_intent['metadata']['date'] = $futureDate;
    $mock_store['availability'][$futureDate] = ['10:00'];

    try {
        AppointmentController::store(['store' => read_store()]);
        throw new Exception("Should have thrown JsonResponseException 201");
    } catch (JsonResponseException $e) {
        if ($e->status !== 201) {
            echo "Error payload: " . json_encode($e->payload) . "\n";
        }
        assert_equals(201, $e->status);
        assert_equals(true, $e->payload['ok']);

        // Verify store was updated
        $store = read_store();
        assert_equals(1, count($store['appointments']));
        assert_equals($futureDate, $store['appointments'][0]['date']);
        assert_equals('paid', $store['appointments'][0]['paymentStatus']);
    }
});

print_test_summary();
