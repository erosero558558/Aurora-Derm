<?php

declare(strict_types=1);

namespace Tests\Unit\Booking;

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../../lib/business.php';

class AvailabilityCalculatorTest extends TestCase
{
    public function testSlotTakenBasic(): void
    {
        $appointments = [
            ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
        ];

        $this->assertTrue(
            appointment_slot_taken($appointments, '2024-01-01', '10:00'),
            'Slot should be taken'
        );

        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '11:00'),
            'Different time should be free'
        );

        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-02', '10:00'),
            'Different date should be free'
        );
    }

    public function testSlotTakenExcludesCancelled(): void
    {
        $appointments = [
            ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'cancelled', 'doctor' => 'rosero']
        ];

        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '10:00'),
            'Cancelled slot should be considered free'
        );
    }

    public function testSlotTakenExcludesSelf(): void
    {
        $appointments = [
            ['id' => 123, 'date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
        ];

        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', 123),
            'Should not be taken if checking against self (reschedule scenario)'
        );

        $this->assertTrue(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', 456),
            'Should be taken if checking against other ID'
        );
    }

    public function testSlotTakenDoctorLogic(): void
    {
        $appointments = [
            ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
        ];

        // 1. Checking generally (no specific doctor requested) -> taken
        $this->assertTrue(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', null, ''),
            'Slot taken generally'
        );

        // 2. Checking for specific doctor 'rosero' -> taken
        $this->assertTrue(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', null, 'rosero'),
            'Slot taken for rosero'
        );

        // 3. Checking for specific doctor 'narvaez' -> free (rosero has it)
        $this->assertFalse(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', null, 'narvaez'),
            'Slot should be free for narvaez even if rosero is booked'
        );
    }

    public function testSlotTakenIndiferenteLogic(): void
    {
        $appointments = [
            ['date' => '2024-01-01', 'time' => '10:00', 'status' => 'confirmed', 'doctor' => 'rosero']
        ];

        // If I request 'indiferente', I am asking "is this slot taken by ANYONE?".
        $this->assertTrue(
            appointment_slot_taken($appointments, '2024-01-01', '10:00', null, 'indiferente'),
            'Slot should be taken if requesting indiferente and someone is booked'
        );
    }
}
