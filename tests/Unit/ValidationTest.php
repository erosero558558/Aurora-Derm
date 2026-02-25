<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../lib/validation.php';
require_once __DIR__ . '/../../lib/common.php';

class ValidationTest extends TestCase
{
    public function testValidateFutureDate(): void
    {
        // Past date
        $result = validate_future_date('2000-01-01', '10:00');
        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('pasada', $result['error']);

        // Future date
        $futureDate = date('Y-m-d', strtotime('+1 year'));
        $result = validate_future_date($futureDate, '10:00');
        $this->assertTrue($result['ok']);
        $this->assertNull($result['error']);

        // Invalid format
        $result = validate_future_date('invalid', '10:00');
        $this->assertFalse($result['ok']);
        $result = validate_future_date('2025-01-01', 'invalid');
        $this->assertFalse($result['ok']);

        // Test Same-Day Booking logic with mocked time
        $mockDate = '2025-06-15';
        $mockTime = '10:00'; // Current time is 10:00

        // 1. Booking in the past (same day)
        // 09:00 < 10:00 -> Fail
        $result = validate_future_date($mockDate, '09:00', $mockDate, $mockTime);
        $this->assertFalse($result['ok']);
        $this->assertStringContainsString('ya pasó', $result['error']);

        // 2. Booking exact same time
        // 10:00 == 10:00 -> Fail (need 1h buffer)
        $result = validate_future_date($mockDate, '10:00', $mockDate, $mockTime);
        $this->assertFalse($result['ok']);

        // 3. Booking 30 mins later
        // 10:30 < 11:00 -> Fail
        $result = validate_future_date($mockDate, '10:30', $mockDate, $mockTime);
        $this->assertFalse($result['ok']);

        // 4. Booking exactly 1 hour later
        // 11:00 == 10:00 + 1h -> Fail (logic says <= 60 mins)
        $result = validate_future_date($mockDate, '11:00', $mockDate, $mockTime);
        $this->assertFalse($result['ok']);

        // 5. Booking 1 hour and 1 min later
        // 11:01 > 11:00 -> Pass
        $result = validate_future_date($mockDate, '11:01', $mockDate, $mockTime);
        $this->assertTrue($result['ok']);

        // 6. Booking 2 hours later
        // 12:00 > 11:00 -> Pass
        $result = validate_future_date($mockDate, '12:00', $mockDate, $mockTime);
        $this->assertTrue($result['ok']);
    }

    public function testValidateServiceExists(): void
    {
        $validServices = ['consulta', 'laser'];
        $this->assertTrue(validate_service_exists('consulta', $validServices));
        $this->assertTrue(validate_service_exists('Laser', $validServices)); // Case insensitive
        $this->assertFalse(validate_service_exists('invalid', $validServices));
        $this->assertFalse(validate_service_exists('', $validServices));
    }

    public function testValidateDoctorExists(): void
    {
        $validDoctors = ['rosero', 'narvaez'];
        $this->assertTrue(validate_doctor_exists('rosero', $validDoctors));
        $this->assertTrue(validate_doctor_exists('Rosero', $validDoctors));
        $this->assertFalse(validate_doctor_exists('invalid', $validDoctors));
    }

    public function testValidateAppointmentPayload(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $payload = [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'phone' => '0991234567',
            'privacyConsent' => true,
            'date' => $futureDate,
            'time' => '10:00',
            'service' => 'consulta',
            'doctor' => 'rosero'
        ];

        $options = [
            'validServices' => ['consulta'],
            'validDoctors' => ['rosero'],
            'availability' => [
                $futureDate => ['10:00', '11:00']
            ]
        ];

        // Valid payload
        $result = validate_appointment_payload($payload, $options);
        $this->assertTrue($result['ok'], 'Valid payload should pass');

        // Missing field
        $invalidPayload = $payload;
        unset($invalidPayload['name']);
        $result = validate_appointment_payload($invalidPayload, $options);
        $this->assertFalse($result['ok'], 'Missing name should fail');

        // Invalid email
        $invalidPayload = $payload;
        $invalidPayload['email'] = 'not-an-email';
        $result = validate_appointment_payload($invalidPayload, $options);
        $this->assertFalse($result['ok'], 'Invalid email should fail');

        // Invalid service
        $invalidPayload = $payload;
        $invalidPayload['service'] = 'invalid-service';
        $result = validate_appointment_payload($invalidPayload, $options);
        $this->assertFalse($result['ok'], 'Invalid service should fail');

        // Slot unavailable
        $invalidPayload = $payload;
        $invalidPayload['time'] = '12:00'; // Not in availability
        $result = validate_appointment_payload($invalidPayload, $options);
        $this->assertFalse($result['ok'], 'Unavailable slot should fail');
    }

    public function testValidateReschedulePayload(): void
    {
        $futureDate = date('Y-m-d', strtotime('+1 day'));
        $validToken = '1234567890123456'; // 16 chars

        // Valid
        $result = validate_reschedule_payload($validToken, $futureDate, '10:00');
        $this->assertTrue($result['ok']);

        // Invalid token
        $result = validate_reschedule_payload('short', $futureDate, '10:00');
        $this->assertFalse($result['ok']);

        // Past date
        $result = validate_reschedule_payload($validToken, '2000-01-01', '10:00');
        $this->assertFalse($result['ok']);
    }
}
