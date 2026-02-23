<?php

declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;
use BookingService;

// Ensure BookingService is loaded
require_once __DIR__ . '/../../../lib/BookingService.php';

// Stub global functions for payment if they don't exist
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
                'amount' => 4000, // 40 + 0% = 40.00
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
// Override local_date to return a fixed date for past date testing?
// No, we can't redefine existing functions easily.
// We will use relative dates for testing.

/**
 * @runInSeparateProcess
 */
class BookingServiceUnitTest extends TestCase
{
    private BookingService $service;
    private array $emptyStore;

    protected function setUp(): void
    {
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        $this->service = new BookingService();
        $this->emptyStore = [
            'appointments' => [],
            'availability' => [],
            'reviews' => [],
            'callbacks' => []
        ];
    }

    protected function tearDown(): void
    {
        putenv('PIELARMONIA_AVAILABILITY_SOURCE');
    }

    public function testCreateSuccess(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store = $this->emptyStore;
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

        $result = $this->service->create($store, $payload);

        $this->assertTrue($result['ok']);
        $this->assertEquals(201, $result['code']);
        $this->assertCount(1, $result['store']['appointments']);
        $this->assertEquals('pending_cash', $result['data']['paymentStatus']);
    }

    public function testCreateSlotConflict(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store = $this->emptyStore;
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

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(409, $result['code']);
        $this->assertEquals('Ese horario ya fue reservado', $result['error']);
    }

    public function testCreatePastDate(): void
    {
        $pastDate = date('Y-m-d', strtotime('-1 day'));
        $store = $this->emptyStore;

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

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertStringContainsString('pasada', $result['error']);
    }

    public function testCancel(): void
    {
        $store = $this->emptyStore;
        $store['appointments'][] = [
            'id' => 123,
            'date' => '2025-01-01',
            'status' => 'confirmed'
        ];

        $result = $this->service->cancel($store, 123);

        $this->assertTrue($result['ok']);
        $this->assertEquals(200, $result['code']);

        // Verify in store
        $cancelled = null;
        foreach ($result['store']['appointments'] as $appt) {
            if ($appt['id'] === 123) {
                $cancelled = $appt;
                break;
            }
        }
        $this->assertEquals('cancelled', $cancelled['status']);
    }

    public function testRescheduleSuccess(): void
    {
        $futureDate = date('Y-m-d', strtotime('+2 days'));
        $originalDate = date('Y-m-d', strtotime('+1 day'));

        $store = $this->emptyStore;
        $store['availability'][$futureDate] = ['11:00'];
        $store['appointments'][] = [
            'id' => 123,
            'date' => $originalDate,
            'time' => '10:00',
            'doctor' => 'rosero',
            'status' => 'confirmed',
            'rescheduleToken' => 'token_1234567890123456'
        ];

        $result = $this->service->reschedule($store, 'token_1234567890123456', $futureDate, '11:00');

        $this->assertTrue($result['ok']);
        $this->assertEquals(200, $result['code']);

        $updated = null;
        foreach ($result['store']['appointments'] as $appt) {
            if ($appt['id'] === 123) {
                $updated = $appt;
                break;
            }
        }
        $this->assertEquals($futureDate, $updated['date']);
        $this->assertEquals('11:00', $updated['time']);
    }

    public function testCreateFailsWhenDateHasNoConfiguredAgenda(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $store = $this->emptyStore;

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

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertEquals(
            'No hay agenda disponible para la fecha seleccionada',
            $result['error']
        );
    }
}
