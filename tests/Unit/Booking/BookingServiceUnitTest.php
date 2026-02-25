<?php

declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;
use BookingService;

// Ensure BookingService is loaded
require_once __DIR__ . '/../../../lib/BookingService.php';

class BookingServiceUnitTest extends TestCase
{
    private BookingService $service;
    private array $emptyStore;
    private array $mockPaymentIntents = [];

    protected function setUp(): void
    {
        putenv('PIELARMONIA_AVAILABILITY_SOURCE=store');
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=false');

        $this->mockPaymentIntents = [];

        // Create partial mock of BookingService to mock protected methods
        $this->service = $this->getMockBuilder(BookingService::class)
            ->onlyMethods([
                'isPaymentGatewayEnabled',
                'getPaymentIntent',
                'getPaymentExpectedAmount',
                'getPaymentCurrency'
            ])
            ->getMock();

        // Default mock behavior
        $this->service->method('isPaymentGatewayEnabled')->willReturn(true);
        $this->service->method('getPaymentExpectedAmount')->willReturn(4000);
        $this->service->method('getPaymentCurrency')->willReturn('USD');

        // Default getPaymentIntent behavior (throws unless configured otherwise in test)
        $this->service->method('getPaymentIntent')->willReturnCallback(function($id) {
             if (isset($this->mockPaymentIntents[$id])) {
                 return $this->mockPaymentIntents[$id];
             }
             throw new \RuntimeException('Payment not mocked for: ' . $id);
        });

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
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR');
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

    public function testCreateFailsWhenGoogleIsRequiredButSourceIsStore(): void
    {
        putenv('PIELARMONIA_REQUIRE_GOOGLE_CALENDAR=true');

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

        $this->assertFalse($result['ok']);
        $this->assertEquals(503, $result['code']);
        $this->assertEquals('calendar_unreachable', $result['errorCode']);
    }

    public function testCreateWithCardPaymentSuccess(): void
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
            'paymentMethod' => 'card',
            'paymentIntentId' => 'pi_card_success'
        ];

        $this->mockPaymentIntents['pi_card_success'] = [
            'status' => 'succeeded',
            'amount' => 4000,
            'currency' => 'usd',
            'amount_received' => 4000,
            'metadata' => [
                'site' => 'pielarmonia.com',
                'service' => 'consulta',
                'date' => $futureDate,
                'time' => '10:00',
                'doctor' => 'rosero'
            ]
        ];

        $result = $this->service->create($store, $payload);

        $this->assertTrue($result['ok'], 'Expected OK, got: ' . ($result['error'] ?? ''));
        $this->assertEquals('paid', $result['data']['paymentStatus']);
        $this->assertEquals('stripe', $result['data']['paymentProvider']);
    }

    public function testCreateWithCardPaymentFailsStatus(): void
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
            'paymentMethod' => 'card',
            'paymentIntentId' => 'pi_card_status_fail'
        ];

        $this->mockPaymentIntents['pi_card_status_fail'] = [
            'status' => 'requires_payment_method',
            'amount' => 4000,
            'currency' => 'usd',
            'amount_received' => 0,
            'metadata' => []
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertEquals('El pago aun no esta completado', $result['error']);
    }

    public function testCreateWithCardPaymentFailsAmount(): void
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
            'paymentMethod' => 'card',
            'paymentIntentId' => 'pi_card_amount_fail'
        ];

        $this->mockPaymentIntents['pi_card_amount_fail'] = [
            'status' => 'succeeded',
            'amount' => 3000,
            'currency' => 'usd',
            'amount_received' => 3000,
            'metadata' => [
                'site' => 'pielarmonia.com',
                'service' => 'consulta',
                'date' => $futureDate,
                'time' => '10:00',
                'doctor' => 'rosero'
            ]
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertEquals('El monto pagado no coincide con la reserva', $result['error']);
    }

    public function testCreateWithCardPaymentFailsCurrency(): void
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
            'paymentMethod' => 'card',
            'paymentIntentId' => 'pi_card_currency_fail'
        ];

        $this->mockPaymentIntents['pi_card_currency_fail'] = [
            'status' => 'succeeded',
            'amount' => 4000,
            'currency' => 'eur',
            'amount_received' => 4000,
            'metadata' => [
                'site' => 'pielarmonia.com',
                'service' => 'consulta',
                'date' => $futureDate,
                'time' => '10:00',
                'doctor' => 'rosero'
            ]
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertEquals('La moneda del pago no coincide con la configuracion', $result['error']);
    }

    public function testCreateWithCardPaymentFailsMetadata(): void
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
            'paymentMethod' => 'card',
            'paymentIntentId' => 'pi_card_metadata_fail'
        ];

        $this->mockPaymentIntents['pi_card_metadata_fail'] = [
            'status' => 'succeeded',
            'amount' => 4000,
            'currency' => 'usd',
            'amount_received' => 4000,
            'metadata' => [
                'site' => 'pielarmonia.com',
                'service' => 'consulta',
                'date' => $futureDate,
                'time' => '11:00', // Wrong time
                'doctor' => 'rosero'
            ]
        ];

        $result = $this->service->create($store, $payload);

        $this->assertFalse($result['ok']);
        $this->assertEquals(400, $result['code']);
        $this->assertEquals('El pago no coincide con la hora seleccionada', $result['error']);
    }
}
