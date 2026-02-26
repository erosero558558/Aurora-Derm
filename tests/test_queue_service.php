<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/QueueService.php';
require_once __DIR__ . '/../lib/TicketPrinter.php';

function qs_fail(string $message): void
{
    fwrite(STDERR, "[FAIL] " . $message . PHP_EOL);
    exit(1);
}

function qs_assert_true($value, string $message): void
{
    if ($value !== true) {
        qs_fail($message);
    }
}

function qs_assert_equals($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        qs_fail($message . ' | expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true));
    }
}

function qs_base_store(): array
{
    return [
        'appointments' => [],
        'callbacks' => [],
        'reviews' => [],
        'queue_tickets' => [],
        'availability' => [],
        'updatedAt' => date('c'),
    ];
}

$service = new QueueService();

// 1) Walk-in creation
$walkin = $service->createWalkInTicket(qs_base_store(), ['patientInitials' => 'EP'], 'kiosk');
qs_assert_true(($walkin['ok'] ?? false) === true, 'walk-in should be created');
qs_assert_equals('A-001', (string) ($walkin['ticket']['ticketCode'] ?? ''), 'first walk-in should be A-001');
qs_assert_equals('waiting', (string) ($walkin['ticket']['status'] ?? ''), 'walk-in status should be waiting');

// 2) Appointment check-in should avoid duplicates
$today = date('Y-m-d');
$store = qs_base_store();
$store['appointments'][] = [
    'id' => 9101,
    'date' => $today,
    'time' => '10:00',
    'name' => 'Juan Perez',
    'phone' => '+593 98 245 3672',
    'status' => 'confirmed',
];

$checkin1 = $service->checkInAppointment($store, [
    'telefono' => '0982453672',
    'hora' => '10:00',
    'fecha' => $today,
], 'kiosk');
qs_assert_true(($checkin1['ok'] ?? false) === true, 'appointment check-in should succeed');
qs_assert_true(($checkin1['replay'] ?? false) === false, 'first check-in should not be replay');

$checkin2 = $service->checkInAppointment(($checkin1['store'] ?? []), [
    'telefono' => '0982453672',
    'hora' => '10:00',
    'fecha' => $today,
], 'kiosk');
qs_assert_true(($checkin2['ok'] ?? false) === true, 'second check-in should succeed');
qs_assert_true(($checkin2['replay'] ?? false) === true, 'second check-in should be replay');
qs_assert_equals(
    (int) ($checkin1['ticket']['id'] ?? 0),
    (int) ($checkin2['ticket']['id'] ?? -1),
    'second check-in should return same ticket'
);

// 3) Priority order for call-next: appt_overdue > appt_current > walk_in
$store2 = qs_base_store();
$store2['appointments'][] = [
    'id' => 9201,
    'date' => date('Y-m-d', strtotime('-1 day')),
    'time' => '09:00',
    'name' => 'Paciente Overdue',
    'phone' => '099991111',
    'status' => 'confirmed',
];
$store2['appointments'][] = [
    'id' => 9202,
    'date' => date('Y-m-d', strtotime('+1 day')),
    'time' => '10:00',
    'name' => 'Paciente Current',
    'phone' => '099992222',
    'status' => 'confirmed',
];

$rOverdue = $service->checkInAppointment($store2, [
    'telefono' => '099991111',
    'hora' => '09:00',
    'fecha' => date('Y-m-d', strtotime('-1 day')),
], 'kiosk');
qs_assert_true(($rOverdue['ok'] ?? false) === true, 'overdue check-in should succeed');

$rCurrent = $service->checkInAppointment(($rOverdue['store'] ?? []), [
    'telefono' => '099992222',
    'hora' => '10:00',
    'fecha' => date('Y-m-d', strtotime('+1 day')),
], 'kiosk');
qs_assert_true(($rCurrent['ok'] ?? false) === true, 'current check-in should succeed');

$rWalkIn = $service->createWalkInTicket(($rCurrent['store'] ?? []), ['patientInitials' => 'WI'], 'kiosk');
qs_assert_true(($rWalkIn['ok'] ?? false) === true, 'walk-in in mixed queue should succeed');

$call1 = $service->callNext(($rWalkIn['store'] ?? []), 1);
qs_assert_true(($call1['ok'] ?? false) === true, 'first call-next should succeed');
qs_assert_equals(
    'appt_overdue',
    (string) ($call1['ticket']['priorityClass'] ?? ''),
    'first call-next must pick overdue appointment'
);
qs_assert_equals(1, (int) ($call1['ticket']['assignedConsultorio'] ?? 0), 'first call should assign consultorio 1');

$call2 = $service->callNext(($call1['store'] ?? []), 2);
qs_assert_true(($call2['ok'] ?? false) === true, 'second call-next should succeed');
qs_assert_equals(
    'appt_current',
    (string) ($call2['ticket']['priorityClass'] ?? ''),
    'second call-next must pick current appointment'
);
qs_assert_equals(2, (int) ($call2['ticket']['assignedConsultorio'] ?? 0), 'second call should assign consultorio 2');

// 4) Patch ticket actions
$patched = $service->patchTicket(($call2['store'] ?? []), [
    'id' => (int) ($call2['ticket']['id'] ?? 0),
    'action' => 'completar',
]);
qs_assert_true(($patched['ok'] ?? false) === true, 'patch complete should succeed');
qs_assert_equals('completed', (string) ($patched['ticket']['status'] ?? ''), 'patched ticket should be completed');

// 5) Printer fallback behavior when disabled
putenv('PIELARMONIA_TICKET_PRINTER_ENABLED=false');
$printer = TicketPrinter::fromEnv();
$printed = $printer->printQueueTicket([
    'ticketCode' => 'A-001',
    'patientInitials' => 'EP',
    'queueType' => 'walk_in',
    'priorityClass' => 'walk_in',
    'createdAt' => date('c'),
]);
qs_assert_true(($printed['ok'] ?? false) === true, 'disabled printer should not fail endpoint flow');
qs_assert_true(($printed['printed'] ?? true) === false, 'disabled printer should return printed=false');
qs_assert_equals('printer_disabled', (string) ($printed['errorCode'] ?? ''), 'disabled printer error code mismatch');

echo "All queue service tests passed." . PHP_EOL;
exit(0);

