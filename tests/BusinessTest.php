<?php

declare(strict_types=1);

require_once __DIR__ . '/test_framework.php';
require_once __DIR__ . '/../lib/common.php';
require_once __DIR__ . '/../lib/validation.php';
require_once __DIR__ . '/../lib/models.php';
require_once __DIR__ . '/../lib/business.php';

// Tests for lib/business.php

run_test('get_vat_rate default', function () {
    // Default is 0.12 if env not set (or empty string in mock env)
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

print_test_summary();
