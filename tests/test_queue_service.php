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
        'queue_help_requests' => [],
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

// 5) Consultorio busy guard + release action
$busyStore = qs_base_store();
$busyStore['appointments'][] = [
    'id' => 9301,
    'date' => $today,
    'time' => '08:00',
    'name' => 'Paciente Uno',
    'phone' => '0991010101',
    'status' => 'confirmed',
];
$busyStore['appointments'][] = [
    'id' => 9302,
    'date' => $today,
    'time' => '08:30',
    'name' => 'Paciente Dos',
    'phone' => '0992020202',
    'status' => 'confirmed',
];

$busyCheckin1 = $service->checkInAppointment($busyStore, [
    'telefono' => '0991010101',
    'hora' => '08:00',
    'fecha' => $today,
], 'kiosk');
qs_assert_true(($busyCheckin1['ok'] ?? false) === true, 'busy checkin 1 should succeed');

$busyCheckin2 = $service->checkInAppointment(($busyCheckin1['store'] ?? []), [
    'telefono' => '0992020202',
    'hora' => '08:30',
    'fecha' => $today,
], 'kiosk');
qs_assert_true(($busyCheckin2['ok'] ?? false) === true, 'busy checkin 2 should succeed');

$busyCall1 = $service->callNext(($busyCheckin2['store'] ?? []), 1);
qs_assert_true(($busyCall1['ok'] ?? false) === true, 'first busy call should succeed');

$busyCallConflict = $service->callNext(($busyCall1['store'] ?? []), 1);
qs_assert_true(($busyCallConflict['ok'] ?? true) === false, 'second call on same consultorio should fail while busy');
qs_assert_equals('queue_consultorio_busy', (string) ($busyCallConflict['errorCode'] ?? ''), 'busy consultorio should return queue_consultorio_busy');

$releasedTicket = $service->patchTicket(($busyCall1['store'] ?? []), [
    'id' => (int) ($busyCall1['ticket']['id'] ?? 0),
    'action' => 'liberar',
]);
qs_assert_true(($releasedTicket['ok'] ?? false) === true, 'release action should succeed');
qs_assert_equals('waiting', (string) ($releasedTicket['ticket']['status'] ?? ''), 'released ticket should return to waiting');
qs_assert_equals('', (string) ($releasedTicket['ticket']['calledAt'] ?? ''), 'released ticket should clear calledAt');

$busyCallAfterRelease = $service->callNext(($releasedTicket['store'] ?? []), 1);
qs_assert_true(($busyCallAfterRelease['ok'] ?? false) === true, 'call after release should succeed');

// 6) Priority class is recalculated from appointment data before state/call
$priorityStore = qs_base_store();
$priorityStore['appointments'][] = [
    'id' => 9401,
    'date' => date('Y-m-d', strtotime('-1 day')),
    'time' => '07:00',
    'name' => 'Paciente Priority Drift',
    'phone' => '0993030303',
    'status' => 'confirmed',
];

$priorityCheckin = $service->checkInAppointment($priorityStore, [
    'telefono' => '0993030303',
    'hora' => '07:00',
    'fecha' => date('Y-m-d', strtotime('-1 day')),
], 'kiosk');
qs_assert_true(($priorityCheckin['ok'] ?? false) === true, 'priority checkin should succeed');

$tamperedStore = $priorityCheckin['store'] ?? [];
if (isset($tamperedStore['queue_tickets'][0]) && is_array($tamperedStore['queue_tickets'][0])) {
    $tamperedStore['queue_tickets'][0]['priorityClass'] = 'walk_in';
}

$refreshedState = $service->getQueueState($tamperedStore);
qs_assert_equals(
    'appt_overdue',
    (string) ($refreshedState['data']['nextTickets'][0]['priorityClass'] ?? ''),
    'queue-state should refresh overdue priority'
);

$priorityCall = $service->callNext($tamperedStore, 2);
qs_assert_true(($priorityCall['ok'] ?? false) === true, 'priority call should succeed');
qs_assert_equals(
    'appt_overdue',
    (string) ($priorityCall['ticket']['priorityClass'] ?? ''),
    'call-next should use refreshed overdue priority'
);

// 7) Help requests update queue-state and ticket flags
$helpStore = qs_base_store();
$helpWalkIn = $service->createWalkInTicket($helpStore, ['patientInitials' => 'AS'], 'kiosk');
qs_assert_true(($helpWalkIn['ok'] ?? false) === true, 'help test walk-in should be created');
$helpTicketId = (int) ($helpWalkIn['ticket']['id'] ?? 0);

$helpCreate = $service->createHelpRequest(($helpWalkIn['store'] ?? []), [
    'source' => 'assistant',
    'reason' => 'human_help',
    'message' => 'Necesito ayuda humana',
    'sessionId' => 'assistant_test_session',
    'ticketId' => $helpTicketId,
    'ticketCode' => (string) ($helpWalkIn['ticket']['ticketCode'] ?? ''),
    'patientInitials' => 'AS',
]);
qs_assert_true(($helpCreate['ok'] ?? false) === true, 'help request should be created');
qs_assert_true(($helpCreate['replay'] ?? true) === false, 'first help request should not replay');

$helpState = $service->getQueueState($helpCreate['store'] ?? []);
qs_assert_equals(
    1,
    (int) ($helpState['data']['assistancePendingCount'] ?? 0),
    'queue-state should expose pending assistance count'
);
qs_assert_equals(
    true,
    (bool) ($helpState['data']['nextTickets'][0]['needsAssistance'] ?? false),
    'next ticket should expose assistance flag'
);
qs_assert_equals(
    (string) ($helpWalkIn['ticket']['ticketCode'] ?? ''),
    (string) ($helpState['data']['activeHelpRequests'][0]['ticketCode'] ?? ''),
    'active help request should retain ticket code'
);

$helpAttendLegacy = $service->patchTicket(($helpCreate['store'] ?? []), [
    'id' => $helpTicketId,
    'action' => 'atender_apoyo',
]);
qs_assert_true(($helpAttendLegacy['ok'] ?? false) === true, 'legacy ticket action should mark help request attending');
$attendingState = $service->getQueueState($helpAttendLegacy['store'] ?? []);
qs_assert_equals(
    'attending',
    (string) ($attendingState['data']['activeHelpRequests'][0]['status'] ?? ''),
    'legacy ticket action should update active help request status'
);

$helpResolve = $service->patchHelpRequest(($helpAttendLegacy['store'] ?? []), [
    'ticketId' => $helpTicketId,
    'status' => 'resolved',
    'context' => [
        'reviewSource' => 'appointments',
        'reviewAssessmentKind' => 'appointment_match',
        'reviewAssessmentLabel' => 'Cita vigente',
        'resolutionOutcome' => 'appointment_confirmed',
        'resolutionOutcomeLabel' => 'Cita vigente confirmada',
        'resolutionNote' => 'La cita exacta ya existe en agenda.',
    ],
]);
qs_assert_true(($helpResolve['ok'] ?? false) === true, 'help request should resolve');
$resolvedState = $service->getQueueState($helpResolve['store'] ?? []);
qs_assert_equals(
    0,
    (int) ($resolvedState['data']['assistancePendingCount'] ?? 0),
    'resolved help request should clear pending assistance count'
);
qs_assert_equals(
    1,
    count($resolvedState['data']['recentResolvedHelpRequests'] ?? []),
    'resolved help request should appear in recent resolved list'
);
qs_assert_equals(
    'appointment_confirmed',
    (string) (($resolvedState['data']['recentResolvedHelpRequests'][0]['context']['resolutionOutcome'] ?? '')),
    'resolved help request should retain structured resolution outcome'
);

// 8) Printer fallback behavior when disabled
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
