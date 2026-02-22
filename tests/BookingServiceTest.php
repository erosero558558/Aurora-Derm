<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';

// Mocks
if (!function_exists('payment_gateway_enabled')) {
    function payment_gateway_enabled(): bool
    {
        return true;
    }
}

if (!function_exists('stripe_get_payment_intent')) {
    function stripe_get_payment_intent(string $id): array
    {
        if ($id === 'pi_valid') {
            return [
                'status' => 'succeeded',
                'amount' => 4000,
                'currency' => 'usd',
                'amount_received' => 4000,
                'metadata' => [
                    'site' => 'pielarmonia.com',
                    'service' => 'consulta',
                    'date' => '2025-01-01',
                    'time' => '10:00',
                    'doctor' => 'rosero'
                ]
            ];
        }
        throw new \RuntimeException('Payment error');
    }
}

if (!function_exists('payment_expected_amount_cents')) {
    function payment_expected_amount_cents(string $service, ?string $date = null, ?string $time = null): int
    {
        return 4000;
    }
}

if (!function_exists('payment_currency')) {
    function payment_currency(): string
    {
        return 'USD';
    }
}

if (!function_exists('data_dir_path')) {
    function data_dir_path(): string
    {
        return sys_get_temp_dir();
    }
}

// Include code under test
require_once __DIR__ . '/../lib/BookingService.php';

// Helper to get fresh service and store
function setup_test(): array {
    // Reset availability source env to force store usage
    putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');

    $service = new BookingService();
    $emptyStore = [
        'appointments' => [],
        'availability' => [],
        'reviews' => [],
        'callbacks' => []
    ];
    return [$service, $emptyStore];
}

function teardown_test(): void {
    putenv('PIELARMONIA_AVAILABILITY_SOURCE');
}

run_test('BookingService::create success', function () {
    [$service, $store] = setup_test();
    try {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store['availability'][$futureDate] = ['10:00'];

        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $service->create($store, $payload);

        assert_true($result['ok'], 'Should be ok');
        assert_equals(201, $result['code']);
        assert_equals(1, count($result['store']['appointments']));
        assert_equals('pending_cash', $result['data']['paymentStatus']);
    } finally {
        teardown_test();
    }
});

run_test('BookingService::create slot conflict', function () {
    [$service, $store] = setup_test();
    try {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store['availability'][$futureDate] = ['10:00'];

        // Existing appointment
        $store['appointments'][] = [
            'id' => 1,
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed'
        ];

        $payload = [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $service->create($store, $payload);

        assert_false($result['ok']);
        assert_equals(409, $result['code']);
        assert_equals('Ese horario ya fue reservado', $result['error']);
    } finally {
        teardown_test();
    }
});

run_test('BookingService::create past date', function () {
    [$service, $store] = setup_test();
    try {
        $pastDate = date('Y-m-d', strtotime('-1 day'));

        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '0991234567',
            'date' => $pastDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $service->create($store, $payload);

        assert_false($result['ok']);
        assert_equals(400, $result['code']);
        assert_contains('pasada', $result['error']);
    } finally {
        teardown_test();
    }
});

run_test('BookingService::cancel', function () {
    [$service, $store] = setup_test();
    try {
        $store['appointments'][] = [
            'id' => 123,
            'date' => '2025-01-01',
            'status' => 'confirmed'
        ];

        $result = $service->cancel($store, 123);

        assert_true($result['ok']);
        assert_equals(200, $result['code']);

        // Verify in store
        $cancelled = null;
        foreach ($result['store']['appointments'] as $appt) {
            if ($appt['id'] === 123) {
                $cancelled = $appt;
                break;
            }
        }
        assert_equals('cancelled', $cancelled['status']);
    } finally {
        teardown_test();
    }
});

run_test('BookingService::reschedule success', function () {
    [$service, $store] = setup_test();
    try {
        $futureDate = date('Y-m-d', strtotime('+2 days'));
        $originalDate = date('Y-m-d', strtotime('+1 day'));

        $store['availability'][$futureDate] = ['11:00'];
        $store['appointments'][] = [
            'id' => 123,
            'date' => $originalDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed',
            'rescheduleToken' => 'token_1234567890123456'
        ];

        $result = $service->reschedule($store, 'token_1234567890123456', $futureDate, '11:00');

        assert_true($result['ok'], 'Reschedule should be ok: ' . ($result['error'] ?? ''));
        assert_equals(200, $result['code']);

        $updated = null;
        foreach ($result['store']['appointments'] as $appt) {
            if ($appt['id'] === 123) {
                $updated = $appt;
                break;
            }
        }
        assert_equals($futureDate, $updated['date']);
        assert_equals('11:00', $updated['time']);
    } finally {
        teardown_test();
    }
});

run_test('BookingService::create fails when date has no configured agenda', function () {
    [$service, $store] = setup_test();
    try {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        // Note: We do NOT add availability for this date

        $payload = [
            'name' => 'John Doe',
            'email' => 'john@example.com',
            'phone' => '0991234567',
            'date' => $futureDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'service' => 'consulta',
            'privacyConsent' => true,
            'paymentMethod' => 'cash'
        ];

        $result = $service->create($store, $payload);

        assert_false($result['ok']);
        assert_equals(400, $result['code']);
        assert_equals(
            'No hay agenda disponible para la fecha seleccionada',
            $result['error']
        );
    } finally {
        teardown_test();
    }
});

print_test_summary();
