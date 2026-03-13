<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/tenants.php';

final class PatientCaseService
{
    private const OPEN_STATUSES = ['booked', 'arrived', 'checked_in', 'called', 'in_consultorio'];
    private const STATUS_RANK = [
        'booked' => 10,
        'arrived' => 20,
        'checked_in' => 30,
        'called' => 40,
        'in_consultorio' => 50,
        'completed' => 60,
        'no_show' => 60,
        'cancelled' => 60,
    ];

    public function hydrateStore(array $store): array
    {
        $tenantId = $this->resolveTenantId($store);
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? array_values($store['appointments']) : [];
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? array_values($store['callbacks']) : [];
        $queueTickets = isset($store['queue_tickets']) && is_array($store['queue_tickets']) ? array_values($store['queue_tickets']) : [];
        $queueHelpRequests = isset($store['queue_help_requests']) && is_array($store['queue_help_requests'])
            ? array_values($store['queue_help_requests'])
            : [];
        $approvals = $this->normalizeApprovals($store['patient_case_approvals'] ?? [], $tenantId);

        $cases = [];
        $links = [];
        $timeline = [];
        $caseIdsByAppointmentId = [];
        $caseIdsByTicketId = [];
        $caseIdsByIdentity = [];

        foreach ($appointments as $index => $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $appointmentTenantId = $this->resolveRecordTenantId($appointment, $tenantId);
            $appointment['tenantId'] = $appointmentTenantId;
            $patientId = $this->resolveAppointmentPatientId($appointment, $appointmentTenantId);
            $appointment['patientId'] = $patientId;

            $appointmentId = (int) ($appointment['id'] ?? 0);
            $caseId = $this->resolveCaseId(
                (string) ($appointment['patientCaseId'] ?? ''),
                $appointmentTenantId,
                'appointment:' . $appointmentId
            );
            $appointment['patientCaseId'] = $caseId;
            $appointments[$index] = $appointment;

            if ($appointmentId > 0) {
                $caseIdsByAppointmentId[$appointmentId] = $caseId;
            }

            $this->registerIdentityKeys(
                $caseIdsByIdentity,
                $appointmentTenantId,
                $caseId,
                $this->buildAppointmentIdentityKeys($appointment)
            );

            $openedAt = $this->resolveOpenedAt($appointment);
            $this->ensureCase($cases, $caseId, $appointmentTenantId, $patientId, $openedAt);

            $scheduledStart = $this->composeScheduledTimestamp(
                (string) ($appointment['date'] ?? ''),
                (string) ($appointment['time'] ?? '')
            );
            $this->updateCaseFromAppointment($cases[$caseId], $appointment, $scheduledStart);

            if ($appointmentId > 0) {
                $linkId = $this->buildDeterministicId(
                    'pcl',
                    [$appointmentTenantId, $caseId, 'appointment', (string) $appointmentId]
                );
                $links[$linkId] = [
                    'id' => $linkId,
                    'tenantId' => $appointmentTenantId,
                    'patientCaseId' => $caseId,
                    'entityType' => 'appointment',
                    'entityId' => (string) $appointmentId,
                    'relationship' => 'primary',
                    'createdAt' => $openedAt,
                ];
            }

            $caseOpenedEventId = $this->buildEventId(
                $appointmentTenantId,
                $caseId,
                'case_opened',
                $openedAt,
                'appointment:' . $appointmentId
            );
            $timeline[$caseOpenedEventId] = [
                'id' => $caseOpenedEventId,
                'tenantId' => $appointmentTenantId,
                'patientCaseId' => $caseId,
                'type' => 'case_opened',
                'title' => 'Caso abierto desde agenda',
                'payload' => [
                    'appointmentId' => $appointmentId > 0 ? (string) $appointmentId : '',
                    'service' => (string) ($appointment['service'] ?? ''),
                ],
                'createdAt' => $openedAt,
            ];

            $appointmentCreatedEventId = $this->buildEventId(
                $appointmentTenantId,
                $caseId,
                'appointment_created',
                $openedAt,
                'appointment:' . $appointmentId
            );
            $timeline[$appointmentCreatedEventId] = [
                'id' => $appointmentCreatedEventId,
                'tenantId' => $appointmentTenantId,
                'patientCaseId' => $caseId,
                'type' => 'appointment_created',
                'title' => 'Reserva confirmada',
                'payload' => [
                    'appointmentId' => $appointmentId > 0 ? (string) $appointmentId : '',
                    'scheduledStart' => $scheduledStart,
                    'doctor' => (string) ($appointment['doctor'] ?? ''),
                ],
                'createdAt' => $openedAt,
            ];

            $appointmentStatus = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if (in_array($appointmentStatus, ['cancelled', 'completed', 'no_show'], true)) {
                $terminalAt = $this->resolveTerminalAt($appointment, $scheduledStart);
                $eventType = $appointmentStatus === 'completed'
                    ? 'visit_completed'
                    : ($appointmentStatus === 'no_show' ? 'no_show' : 'status_changed');
                $title = $appointmentStatus === 'completed'
                    ? 'Consulta cerrada'
                    : ($appointmentStatus === 'no_show' ? 'Paciente no asistio' : 'Caso cancelado');
                $eventId = $this->buildEventId(
                    $appointmentTenantId,
                    $caseId,
                    $eventType,
                    $terminalAt,
                    'appointment-status:' . $appointmentStatus
                );
                $timeline[$eventId] = [
                    'id' => $eventId,
                    'tenantId' => $appointmentTenantId,
                    'patientCaseId' => $caseId,
                    'type' => $eventType,
                    'title' => $title,
                    'payload' => [
                        'appointmentId' => $appointmentId > 0 ? (string) $appointmentId : '',
                        'status' => $appointmentStatus,
                    ],
                    'createdAt' => $terminalAt,
                ];
            }
        }

        foreach ($queueTickets as $index => $ticket) {
            if (!is_array($ticket)) {
                continue;
            }

            $ticketTenantId = $this->resolveRecordTenantId($ticket, $tenantId);
            $ticket['tenantId'] = $ticketTenantId;
            $ticketId = (int) ($ticket['id'] ?? 0);
            $appointmentId = (int) ($ticket['appointmentId'] ?? 0);
            $existingCaseId = trim((string) ($ticket['patientCaseId'] ?? ''));
            $caseId = $existingCaseId !== ''
                ? $existingCaseId
                : ($caseIdsByAppointmentId[$appointmentId] ?? $this->buildDeterministicId(
                    'pc',
                    [$ticketTenantId, 'ticket', (string) $ticketId]
                ));
            $ticket['patientCaseId'] = $caseId;

            $patientId = trim((string) ($ticket['patientId'] ?? ''));
            if ($patientId === '') {
                $patientId = isset($cases[$caseId]) ? (string) ($cases[$caseId]['patientId'] ?? '') : '';
            }
            if ($patientId === '') {
                $patientId = $this->buildDeterministicId(
                    'pt',
                    [$ticketTenantId, 'ticket', (string) $ticketId, (string) ($ticket['patientInitials'] ?? '')]
                );
            }
            $ticket['patientId'] = $patientId;
            $queueTickets[$index] = $ticket;

            if ($ticketId > 0) {
                $caseIdsByTicketId[$ticketId] = $caseId;
            }

            $createdAt = $this->normalizeTimestampValue((string) ($ticket['createdAt'] ?? local_date('c')), local_date('c'));
            $this->ensureCase($cases, $caseId, $ticketTenantId, $patientId, $createdAt);
            $this->updateCaseFromTicket($cases[$caseId], $ticket, $createdAt);

            if ($ticketId > 0) {
                $linkId = $this->buildDeterministicId(
                    'pcl',
                    [$ticketTenantId, $caseId, 'queue_ticket', (string) $ticketId]
                );
                $links[$linkId] = [
                    'id' => $linkId,
                    'tenantId' => $ticketTenantId,
                    'patientCaseId' => $caseId,
                    'entityType' => 'queue_ticket',
                    'entityId' => (string) $ticketId,
                    'relationship' => $appointmentId > 0 ? 'primary' : 'derived',
                    'createdAt' => $createdAt,
                ];
            }

            $arrivedEventId = $this->buildEventId(
                $ticketTenantId,
                $caseId,
                'status_changed',
                $createdAt,
                'arrived:' . $ticketId
            );
            $timeline[$arrivedEventId] = [
                'id' => $arrivedEventId,
                'tenantId' => $ticketTenantId,
                'patientCaseId' => $caseId,
                'type' => 'status_changed',
                'title' => 'Paciente llego a recepcion',
                'payload' => [
                    'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                    'status' => 'arrived',
                ],
                'createdAt' => $createdAt,
            ];

            $checkInEventId = $this->buildEventId(
                $ticketTenantId,
                $caseId,
                'check_in_completed',
                $createdAt,
                'ticket:' . $ticketId
            );
            $timeline[$checkInEventId] = [
                'id' => $checkInEventId,
                'tenantId' => $ticketTenantId,
                'patientCaseId' => $caseId,
                'type' => 'check_in_completed',
                'title' => 'Check-in completado',
                'payload' => [
                    'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                    'queueType' => (string) ($ticket['queueType'] ?? 'walk_in'),
                ],
                'createdAt' => $createdAt,
            ];

            $calledAt = trim((string) ($ticket['calledAt'] ?? ''));
            if ($calledAt !== '') {
                $normalizedCalledAt = $this->normalizeTimestampValue($calledAt, $createdAt);
                $calledEventId = $this->buildEventId(
                    $ticketTenantId,
                    $caseId,
                    'queue_called',
                    $normalizedCalledAt,
                    'ticket:' . $ticketId
                );
                $timeline[$calledEventId] = [
                    'id' => $calledEventId,
                    'tenantId' => $ticketTenantId,
                    'patientCaseId' => $caseId,
                    'type' => 'queue_called',
                    'title' => 'Paciente llamado a consultorio',
                    'payload' => [
                        'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                        'consultorio' => $ticket['assignedConsultorio'] ?? null,
                    ],
                    'createdAt' => $normalizedCalledAt,
                ];
            }

            $ticketStatus = strtolower(trim((string) ($ticket['status'] ?? 'waiting')));
            if (in_array($ticketStatus, ['completed', 'no_show', 'cancelled'], true)) {
                $terminalAt = $this->normalizeTimestampValue(
                    (string) ($ticket['completedAt'] ?? ''),
                    $calledAt !== '' ? $calledAt : $createdAt
                );
                $eventType = $ticketStatus === 'completed'
                    ? 'visit_completed'
                    : ($ticketStatus === 'no_show' ? 'no_show' : 'status_changed');
                $title = $ticketStatus === 'completed'
                    ? 'Turno completado'
                    : ($ticketStatus === 'no_show' ? 'Paciente no respondio al llamado' : 'Turno cancelado');
                $terminalEventId = $this->buildEventId(
                    $ticketTenantId,
                    $caseId,
                    $eventType,
                    $terminalAt,
                    'ticket-status:' . $ticketStatus . ':' . $ticketId
                );
                $timeline[$terminalEventId] = [
                    'id' => $terminalEventId,
                    'tenantId' => $ticketTenantId,
                    'patientCaseId' => $caseId,
                    'type' => $eventType,
                    'title' => $title,
                    'payload' => [
                        'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                        'status' => $ticketStatus,
                    ],
                    'createdAt' => $terminalAt,
                ];
            }
        }
        foreach ($queueHelpRequests as $index => $request) {
            if (!is_array($request)) {
                continue;
            }

            $requestTenantId = $this->resolveRecordTenantId($request, $tenantId);
            $request['tenantId'] = $requestTenantId;
            $requestId = (int) ($request['id'] ?? 0);
            $ticketId = (int) ($request['ticketId'] ?? 0);
            $caseId = $caseIdsByTicketId[$ticketId] ?? trim((string) ($request['patientCaseId'] ?? ''));
            if ($caseId !== '') {
                $request['patientCaseId'] = $caseId;
                if (isset($cases[$caseId])) {
                    $status = strtolower(trim((string) ($request['status'] ?? 'pending')));
                    $updatedAt = $this->normalizeTimestampValue(
                        (string) ($request['updatedAt'] ?? ($request['createdAt'] ?? '')),
                        local_date('c')
                    );
                    if (in_array($status, ['pending', 'attending'], true)) {
                        $cases[$caseId]['summary']['activeHelpRequestId'] = $requestId > 0 ? $requestId : null;
                        $cases[$caseId]['summary']['openActionCount'] = max(
                            (int) ($cases[$caseId]['summary']['openActionCount'] ?? 0),
                            1
                        );
                    }
                    $this->touchCase($cases[$caseId], $updatedAt);

                    $eventId = $this->buildEventId(
                        $requestTenantId,
                        $caseId,
                        'status_changed',
                        $updatedAt,
                        'help-request:' . $requestId . ':' . $status
                    );
                    $timeline[$eventId] = [
                        'id' => $eventId,
                        'tenantId' => $requestTenantId,
                        'patientCaseId' => $caseId,
                        'type' => 'status_changed',
                        'title' => 'Solicitud de apoyo: ' . $status,
                        'payload' => [
                            'helpRequestId' => $requestId > 0 ? (string) $requestId : '',
                            'ticketId' => $ticketId > 0 ? (string) $ticketId : '',
                            'reason' => (string) ($request['reason'] ?? 'general'),
                            'status' => $status,
                        ],
                        'createdAt' => $updatedAt,
                    ];
                }
            }
            $queueHelpRequests[$index] = $request;
        }

        foreach ($callbacks as $index => $callback) {
            if (!is_array($callback)) {
                continue;
            }

            $callbackTenantId = $this->resolveRecordTenantId($callback, $tenantId);
            $callback['tenantId'] = $callbackTenantId;
            $callbackId = (int) ($callback['id'] ?? 0);
            $patientId = $this->resolveCallbackPatientId($callback, $callbackTenantId);
            $callback['patientId'] = $patientId;
            $caseId = $this->resolveCallbackCaseId(
                $callback,
                $callbackTenantId,
                $caseIdsByIdentity,
                $cases
            );
            if ($caseId !== '') {
                $callback['patientCaseId'] = $caseId;
                if (isset($cases[$caseId])) {
                    $createdAt = $this->normalizeTimestampValue((string) ($callback['fecha'] ?? local_date('c')), local_date('c'));
                    $cases[$caseId]['summary']['latestCallbackId'] = $callbackId > 0 ? (string) $callbackId : null;
                    $cases[$caseId]['summary']['lastChannel'] = 'web';
                    $this->touchCase($cases[$caseId], $createdAt);
                    if ($cases[$caseId]['lastInboundAt'] === null || strcmp((string) $cases[$caseId]['lastInboundAt'], $createdAt) < 0) {
                        $cases[$caseId]['lastInboundAt'] = $createdAt;
                    }

                    $leadOps = isset($callback['leadOps']) && is_array($callback['leadOps']) ? $callback['leadOps'] : [];
                    $contactedAt = trim((string) ($leadOps['contactedAt'] ?? ''));
                    if ($contactedAt !== '') {
                        $cases[$caseId]['lastOutboundAt'] = $this->normalizeTimestampValue($contactedAt, $createdAt);
                    }

                    $linkId = $this->buildDeterministicId(
                        'pcl',
                        [$callbackTenantId, $caseId, 'callback', (string) $callbackId]
                    );
                    $links[$linkId] = [
                        'id' => $linkId,
                        'tenantId' => $callbackTenantId,
                        'patientCaseId' => $caseId,
                        'entityType' => 'callback',
                        'entityId' => (string) $callbackId,
                        'relationship' => 'secondary',
                        'createdAt' => $createdAt,
                    ];

                    $eventId = $this->buildEventId(
                        $callbackTenantId,
                        $caseId,
                        'callback_created',
                        $createdAt,
                        'callback:' . $callbackId
                    );
                    $timeline[$eventId] = [
                        'id' => $eventId,
                        'tenantId' => $callbackTenantId,
                        'patientCaseId' => $caseId,
                        'type' => 'callback_created',
                        'title' => 'Callback registrado',
                        'payload' => [
                            'callbackId' => $callbackId > 0 ? (string) $callbackId : '',
                            'status' => (string) ($callback['status'] ?? 'pendiente'),
                        ],
                        'createdAt' => $createdAt,
                    ];
                }
            }

            $callbacks[$index] = $callback;
        }

        foreach ($approvals as $approval) {
            if (!is_array($approval)) {
                continue;
            }
            $caseId = trim((string) ($approval['patientCaseId'] ?? ''));
            if ($caseId === '' || !isset($cases[$caseId])) {
                continue;
            }
            if ((string) ($approval['status'] ?? 'pending') === 'pending') {
                $cases[$caseId]['summary']['pendingApprovalCount'] = (int) ($cases[$caseId]['summary']['pendingApprovalCount'] ?? 0) + 1;
            }
        }

        $store['appointments'] = $appointments;
        $store['callbacks'] = $callbacks;
        $store['queue_tickets'] = $queueTickets;
        $store['queue_help_requests'] = $queueHelpRequests;
        $store['patient_cases'] = $this->sortCases(array_values($cases));
        $store['patient_case_links'] = $this->sortByCreatedAtDesc(array_values($links));
        $store['patient_case_timeline_events'] = $this->sortByCreatedAtDesc(array_values($timeline));
        $store['patient_case_approvals'] = $this->sortByCreatedAtDesc($approvals);

        return $store;
    }

    public function buildSummary(array $store): array
    {
        $store = $this->hydrateStore($store);
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
        $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
            ? $store['patient_case_approvals']
            : [];
        $callbacks = isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [];
        $queueHelpRequests = isset($store['queue_help_requests']) && is_array($store['queue_help_requests'])
            ? $store['queue_help_requests']
            : [];

        $statusCounts = [];
        $openCases = 0;
        $closedCases = 0;
        foreach ($cases as $case) {
            if (!is_array($case)) {
                continue;
            }
            $status = (string) ($case['status'] ?? 'booked');
            $statusCounts[$status] = (int) ($statusCounts[$status] ?? 0) + 1;
            if (in_array($status, self::OPEN_STATUSES, true)) {
                $openCases++;
            } else {
                $closedCases++;
            }
        }

        $callbacksLinked = 0;
        foreach ($callbacks as $callback) {
            if (is_array($callback) && trim((string) ($callback['patientCaseId'] ?? '')) !== '') {
                $callbacksLinked++;
            }
        }

        $pendingApprovals = 0;
        foreach ($approvals as $approval) {
            if (is_array($approval) && (string) ($approval['status'] ?? 'pending') === 'pending') {
                $pendingApprovals++;
            }
        }

        $activeHelpRequests = 0;
        foreach ($queueHelpRequests as $request) {
            if (!is_array($request)) {
                continue;
            }
            if (in_array((string) ($request['status'] ?? ''), ['pending', 'attending'], true)) {
                $activeHelpRequests++;
            }
        }

        return [
            'generatedAt' => local_date('c'),
            'casesTotal' => count($cases),
            'casesOpen' => $openCases,
            'casesClosed' => $closedCases,
            'statusCounts' => $statusCounts,
            'callbacksLinked' => $callbacksLinked,
            'pendingApprovals' => $pendingApprovals,
            'activeHelpRequests' => $activeHelpRequests,
        ];
    }

    public function buildReadModel(array $store, ?string $caseId = null): array
    {
        $store = $this->hydrateStore($store);
        $cases = isset($store['patient_cases']) && is_array($store['patient_cases']) ? $store['patient_cases'] : [];
        $links = isset($store['patient_case_links']) && is_array($store['patient_case_links'])
            ? $store['patient_case_links']
            : [];
        $timeline = isset($store['patient_case_timeline_events']) && is_array($store['patient_case_timeline_events'])
            ? $store['patient_case_timeline_events']
            : [];
        $approvals = isset($store['patient_case_approvals']) && is_array($store['patient_case_approvals'])
            ? $store['patient_case_approvals']
            : [];

        if ($caseId !== null && $caseId !== '') {
            $cases = array_values(array_filter($cases, static function (array $case) use ($caseId): bool {
                return (string) ($case['id'] ?? '') === $caseId;
            }));
            $links = array_values(array_filter($links, static function (array $link) use ($caseId): bool {
                return (string) ($link['patientCaseId'] ?? '') === $caseId;
            }));
            $timeline = array_values(array_filter($timeline, static function (array $event) use ($caseId): bool {
                return (string) ($event['patientCaseId'] ?? '') === $caseId;
            }));
            $approvals = array_values(array_filter($approvals, static function (array $approval) use ($caseId): bool {
                return (string) ($approval['patientCaseId'] ?? '') === $caseId;
            }));
        }

        return [
            'summary' => array_merge($this->buildSummary($store), [
                'selectedCaseId' => $caseId !== null && $caseId !== '' ? $caseId : null,
            ]),
            'cases' => $cases,
            'links' => $links,
            'timeline' => $timeline,
            'approvals' => $approvals,
        ];
    }

    private function resolveTenantId(array $store): string
    {
        foreach (['appointments', 'callbacks', 'queue_tickets', 'queue_help_requests', 'patient_cases'] as $key) {
            $records = $store[$key] ?? [];
            if (!is_array($records) || $records === []) {
                continue;
            }
            $first = $records[0];
            if (!is_array($first)) {
                continue;
            }
            $candidate = trim((string) ($first['tenantId'] ?? ''));
            if ($candidate !== '') {
                return $candidate;
            }
        }

        return get_current_tenant_id();
    }

    private function resolveRecordTenantId(array $record, string $fallbackTenantId): string
    {
        $tenantId = trim((string) ($record['tenantId'] ?? ''));
        return $tenantId !== '' ? $tenantId : $fallbackTenantId;
    }

    private function ensureCase(array &$cases, string $caseId, string $tenantId, string $patientId, string $openedAt): void
    {
        if (!isset($cases[$caseId])) {
            $cases[$caseId] = [
                'id' => $caseId,
                'tenantId' => $tenantId,
                'patientId' => $patientId,
                'status' => 'booked',
                'statusSource' => 'derived',
                'openedAt' => $openedAt,
                'latestActivityAt' => $openedAt,
                'closedAt' => null,
                'lastInboundAt' => null,
                'lastOutboundAt' => null,
                'summary' => [
                    'primaryAppointmentId' => null,
                    'latestAppointmentId' => null,
                    'latestCallbackId' => null,
                    'serviceLine' => null,
                    'providerName' => null,
                    'scheduledStart' => null,
                    'scheduledEnd' => null,
                    'queueStatus' => null,
                    'lastChannel' => null,
                    'openActionCount' => 0,
                    'pendingApprovalCount' => 0,
                    'latestTicketId' => null,
                    'latestTicketCode' => null,
                    'assignedConsultorio' => null,
                    'activeHelpRequestId' => null,
                    'patientLabel' => null,
                    'milestones' => [],
                ],
            ];
            return;
        }

        if ((string) ($cases[$caseId]['patientId'] ?? '') === '' && $patientId !== '') {
            $cases[$caseId]['patientId'] = $patientId;
        }
        if (strcmp((string) ($cases[$caseId]['openedAt'] ?? $openedAt), $openedAt) > 0) {
            $cases[$caseId]['openedAt'] = $openedAt;
        }
    }

    private function updateCaseFromAppointment(array &$case, array $appointment, string $scheduledStart): void
    {
        $appointmentId = (int) ($appointment['id'] ?? 0);
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        if (($summary['primaryAppointmentId'] ?? null) === null && $appointmentId > 0) {
            $summary['primaryAppointmentId'] = (string) $appointmentId;
        }
        if ($appointmentId > 0) {
            $summary['latestAppointmentId'] = (string) $appointmentId;
        }
        $summary['serviceLine'] = $this->firstNonEmptyString([
            (string) ($appointment['service'] ?? ''),
            isset($summary['serviceLine']) ? (string) $summary['serviceLine'] : '',
        ]);
        $summary['providerName'] = $this->firstNonEmptyString([
            (string) ($appointment['doctor'] ?? ''),
            (string) ($appointment['doctorAssigned'] ?? ''),
            isset($summary['providerName']) ? (string) $summary['providerName'] : '',
        ]);
        if ($scheduledStart !== '') {
            $summary['scheduledStart'] = $scheduledStart;
            $durationMin = max(0, (int) ($appointment['slotDurationMin'] ?? 0));
            $summary['scheduledEnd'] = $durationMin > 0
                ? $this->offsetTimestampMinutes($scheduledStart, $durationMin)
                : $scheduledStart;
        }
        $summary['patientLabel'] = $this->firstNonEmptyString([
            (string) ($appointment['name'] ?? ''),
            isset($summary['patientLabel']) ? (string) $summary['patientLabel'] : '',
        ]);
        $summary['milestones'] = $this->mergeMilestone($summary['milestones'] ?? [], 'bookedAt', $this->resolveOpenedAt($appointment));
        $case['summary'] = $summary;

        $status = $this->deriveAppointmentCaseStatus($appointment);
        $terminalAt = $this->resolveTerminalAt($appointment, $scheduledStart);
        $this->applyCaseStatus($case, $status, $terminalAt);
        $this->touchCase($case, $this->resolveOpenedAt($appointment));
    }

    private function updateCaseFromTicket(array &$case, array $ticket, string $createdAt): void
    {
        $summary = isset($case['summary']) && is_array($case['summary']) ? $case['summary'] : [];
        $ticketId = (int) ($ticket['id'] ?? 0);
        if ($ticketId > 0) {
            $summary['latestTicketId'] = (string) $ticketId;
        }
        $summary['latestTicketCode'] = $this->firstNonEmptyString([
            (string) ($ticket['ticketCode'] ?? ''),
            isset($summary['latestTicketCode']) ? (string) $summary['latestTicketCode'] : '',
        ]);
        $summary['queueStatus'] = (string) ($ticket['status'] ?? 'waiting');
        $summary['assignedConsultorio'] = $ticket['assignedConsultorio'] ?? null;
        $summary['patientLabel'] = $this->firstNonEmptyString([
            isset($summary['patientLabel']) ? (string) $summary['patientLabel'] : '',
            (string) ($ticket['patientInitials'] ?? ''),
            (string) ($ticket['ticketCode'] ?? ''),
        ]);
        $summary['lastChannel'] = (string) ($ticket['createdSource'] ?? 'kiosk');
        $summary['milestones'] = $this->mergeMilestone($summary['milestones'] ?? [], 'arrivedAt', $createdAt);
        $summary['milestones'] = $this->mergeMilestone($summary['milestones'] ?? [], 'checkedInAt', $createdAt);
        $calledAt = trim((string) ($ticket['calledAt'] ?? ''));
        if ($calledAt !== '') {
            $summary['milestones'] = $this->mergeMilestone(
                $summary['milestones'] ?? [],
                'calledAt',
                $this->normalizeTimestampValue($calledAt, $createdAt)
            );
        }
        $completedAt = trim((string) ($ticket['completedAt'] ?? ''));
        if ($completedAt !== '') {
            $summary['milestones'] = $this->mergeMilestone(
                $summary['milestones'] ?? [],
                'completedAt',
                $this->normalizeTimestampValue($completedAt, $calledAt !== '' ? $calledAt : $createdAt)
            );
        }
        $case['summary'] = $summary;

        $this->applyCaseStatus($case, 'arrived', $createdAt);
        $ticketStatus = strtolower(trim((string) ($ticket['status'] ?? 'waiting')));
        $mappedStatus = 'checked_in';
        if ($ticketStatus === 'called') {
            $mappedStatus = 'called';
        } elseif ($ticketStatus === 'completed') {
            $mappedStatus = 'completed';
        } elseif ($ticketStatus === 'no_show') {
            $mappedStatus = 'no_show';
        } elseif ($ticketStatus === 'cancelled') {
            $mappedStatus = 'cancelled';
        }
        $terminalAt = $this->normalizeTimestampValue(
            (string) ($ticket['completedAt'] ?? ''),
            trim((string) ($ticket['calledAt'] ?? '')) !== ''
                ? (string) $ticket['calledAt']
                : $createdAt
        );
        $this->applyCaseStatus($case, $mappedStatus, $terminalAt);
        $this->touchCase($case, $terminalAt !== '' ? $terminalAt : $createdAt);
    }

    private function applyCaseStatus(array &$case, string $status, string $eventAt): void
    {
        $status = trim($status);
        if (!isset(self::STATUS_RANK[$status])) {
            return;
        }

        $currentStatus = (string) ($case['status'] ?? 'booked');
        $currentRank = self::STATUS_RANK[$currentStatus] ?? 0;
        $candidateRank = self::STATUS_RANK[$status];
        if ($candidateRank >= $currentRank) {
            $case['status'] = $status;
        }

        if (in_array($status, ['completed', 'no_show', 'cancelled'], true)) {
            $case['closedAt'] = $eventAt !== '' ? $eventAt : (string) ($case['closedAt'] ?? '');
        }
    }

    private function touchCase(array &$case, string $timestamp): void
    {
        if ($timestamp === '') {
            return;
        }
        $current = (string) ($case['latestActivityAt'] ?? '');
        if ($current === '' || strcmp($current, $timestamp) < 0) {
            $case['latestActivityAt'] = $timestamp;
        }
    }

    private function normalizeApprovals(array $approvals, string $tenantId): array
    {
        $normalized = [];
        foreach ($approvals as $approval) {
            if (!is_array($approval)) {
                continue;
            }
            $createdAt = $this->normalizeTimestampValue((string) ($approval['createdAt'] ?? local_date('c')), local_date('c'));
            $updatedAt = $this->normalizeTimestampValue((string) ($approval['updatedAt'] ?? $createdAt), $createdAt);
            $status = strtolower(trim((string) ($approval['status'] ?? 'pending')));
            if (!in_array($status, ['pending', 'approved', 'rejected'], true)) {
                $status = 'pending';
            }
            $normalized[] = [
                'id' => trim((string) ($approval['id'] ?? $this->buildDeterministicId('pca', [$tenantId, $createdAt, (string) count($normalized)]))),
                'tenantId' => $this->resolveRecordTenantId($approval, $tenantId),
                'patientCaseId' => trim((string) ($approval['patientCaseId'] ?? '')),
                'type' => trim((string) ($approval['type'] ?? 'ops_exception')) ?: 'ops_exception',
                'status' => $status,
                'reason' => trim((string) ($approval['reason'] ?? '')),
                'requestedBy' => trim((string) ($approval['requestedBy'] ?? 'system')) ?: 'system',
                'resolvedBy' => trim((string) ($approval['resolvedBy'] ?? '')) ?: null,
                'resolutionNotes' => trim((string) ($approval['resolutionNotes'] ?? '')) ?: null,
                'createdAt' => $createdAt,
                'updatedAt' => $updatedAt,
                'resolvedAt' => trim((string) ($approval['resolvedAt'] ?? '')) ?: null,
            ];
        }

        return $normalized;
    }

    private function registerIdentityKeys(array &$index, string $tenantId, string $caseId, array $identityKeys): void
    {
        foreach ($identityKeys as $identityKey) {
            $key = trim((string) $identityKey);
            if ($key === '') {
                continue;
            }
            $index[$tenantId . '|' . $key] = $caseId;
        }
    }

    private function buildAppointmentIdentityKeys(array $appointment): array
    {
        $keys = [];
        $digits = preg_replace('/\D+/', '', (string) ($appointment['phone'] ?? ''));
        if (is_string($digits) && strlen($digits) >= 7) {
            $keys[] = 'phone:' . $digits;
        }
        $email = strtolower(trim((string) ($appointment['email'] ?? '')));
        if ($email !== '') {
            $keys[] = 'email:' . $email;
        }
        $name = strtolower(trim((string) ($appointment['name'] ?? '')));
        if ($name !== '' && is_string($digits) && strlen($digits) >= 4) {
            $keys[] = 'name_phone:' . $name . ':' . substr($digits, -4);
        }
        return array_values(array_unique($keys));
    }

    private function resolveCallbackCaseId(
        array $callback,
        string $tenantId,
        array $caseIdsByIdentity,
        array $cases
    ): string {
        $existing = trim((string) ($callback['patientCaseId'] ?? ''));
        if ($existing !== '' && isset($cases[$existing])) {
            return $existing;
        }

        foreach ($this->buildCallbackIdentityKeys($callback) as $identityKey) {
            $lookup = $tenantId . '|' . $identityKey;
            if (isset($caseIdsByIdentity[$lookup]) && isset($cases[$caseIdsByIdentity[$lookup]])) {
                return $caseIdsByIdentity[$lookup];
            }
        }

        return '';
    }

    private function buildCallbackIdentityKeys(array $callback): array
    {
        $keys = [];
        $digits = preg_replace('/\D+/', '', (string) ($callback['telefono'] ?? ''));
        if (is_string($digits) && strlen($digits) >= 7) {
            $keys[] = 'phone:' . $digits;
        }
        return array_values(array_unique($keys));
    }

    private function resolveAppointmentPatientId(array $appointment, string $tenantId): string
    {
        $existing = trim((string) ($appointment['patientId'] ?? ''));
        if ($existing !== '') {
            return $existing;
        }

        $keys = $this->buildAppointmentIdentityKeys($appointment);
        if ($keys !== []) {
            sort($keys, SORT_STRING);
            return $this->buildDeterministicId('pt', array_merge([$tenantId, 'appointment-patient'], $keys));
        }

        $appointmentId = (int) ($appointment['id'] ?? 0);
        return $this->buildDeterministicId('pt', [$tenantId, 'appointment-fallback', (string) $appointmentId]);
    }

    private function resolveCallbackPatientId(array $callback, string $tenantId): string
    {
        $existing = trim((string) ($callback['patientId'] ?? ''));
        if ($existing !== '') {
            return $existing;
        }

        $keys = $this->buildCallbackIdentityKeys($callback);
        if ($keys !== []) {
            sort($keys, SORT_STRING);
            return $this->buildDeterministicId('pt', array_merge([$tenantId, 'callback-patient'], $keys));
        }

        $callbackId = (int) ($callback['id'] ?? 0);
        return $this->buildDeterministicId('pt', [$tenantId, 'callback-fallback', (string) $callbackId]);
    }

    private function deriveAppointmentCaseStatus(array $appointment): string
    {
        $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
        if ($status === 'cancelled') {
            return 'cancelled';
        }
        if ($status === 'completed') {
            return 'completed';
        }
        if ($status === 'no_show') {
            return 'no_show';
        }
        return 'booked';
    }

    private function resolveOpenedAt(array $appointment): string
    {
        $dateBooked = trim((string) ($appointment['dateBooked'] ?? ''));
        if ($dateBooked !== '') {
            return $this->normalizeTimestampValue($dateBooked, local_date('c'));
        }

        $scheduledStart = $this->composeScheduledTimestamp(
            (string) ($appointment['date'] ?? ''),
            (string) ($appointment['time'] ?? '')
        );

        return $scheduledStart !== '' ? $scheduledStart : local_date('c');
    }

    private function resolveTerminalAt(array $appointment, string $scheduledStart): string
    {
        foreach (['paymentPaidAt', 'reminderSentAt', 'dateBooked'] as $field) {
            $candidate = trim((string) ($appointment[$field] ?? ''));
            if ($candidate !== '') {
                return $this->normalizeTimestampValue($candidate, $scheduledStart !== '' ? $scheduledStart : local_date('c'));
            }
        }

        return $scheduledStart !== '' ? $scheduledStart : local_date('c');
    }

    private function composeScheduledTimestamp(string $date, string $time): string
    {
        $date = trim($date);
        $time = trim($time);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
            return '';
        }

        return $date . 'T' . $time . ':00';
    }

    private function offsetTimestampMinutes(string $timestamp, int $minutes): string
    {
        $base = strtotime($timestamp);
        if ($base === false) {
            return $timestamp;
        }
        return date('c', $base + ($minutes * 60));
    }

    private function mergeMilestone($milestones, string $key, string $value): array
    {
        $normalized = is_array($milestones) ? $milestones : [];
        if ($value === '') {
            return $normalized;
        }

        if (!isset($normalized[$key]) || trim((string) $normalized[$key]) === '') {
            $normalized[$key] = $value;
            return $normalized;
        }

        if (strcmp((string) $normalized[$key], $value) > 0) {
            $normalized[$key] = $value;
        }

        return $normalized;
    }

    private function buildDeterministicId(string $prefix, array $parts): string
    {
        $seed = implode('|', array_map(static function ($value): string {
            return trim((string) $value);
        }, $parts));

        return $prefix . '_' . substr(hash('sha1', $seed), 0, 16);
    }

    private function resolveCaseId(string $existingCaseId, string $tenantId, string $seed): string
    {
        $existingCaseId = trim($existingCaseId);
        if ($existingCaseId !== '') {
            return $existingCaseId;
        }

        [$type, $entityId] = array_pad(explode(':', $seed, 2), 2, '');
        return $this->buildDeterministicId('pc', [$tenantId, $type !== '' ? $type : 'record', $entityId]);
    }

    private function buildEventId(string $tenantId, string $caseId, string $type, string $createdAt, string $salt): string
    {
        return $this->buildDeterministicId('pte', [$tenantId, $caseId, $type, $createdAt, $salt]);
    }

    private function sortByCreatedAtDesc(array $records): array
    {
        usort($records, static function (array $left, array $right): int {
            $leftAt = (string) ($left['createdAt'] ?? '');
            $rightAt = (string) ($right['createdAt'] ?? '');
            if ($leftAt !== $rightAt) {
                return strcmp($rightAt, $leftAt);
            }
            return strcmp((string) ($right['id'] ?? ''), (string) ($left['id'] ?? ''));
        });

        return $records;
    }

    private function sortCases(array $cases): array
    {
        usort($cases, static function (array $left, array $right): int {
            $leftAt = (string) ($left['latestActivityAt'] ?? '');
            $rightAt = (string) ($right['latestActivityAt'] ?? '');
            if ($leftAt !== $rightAt) {
                return strcmp($rightAt, $leftAt);
            }
            return strcmp((string) ($right['id'] ?? ''), (string) ($left['id'] ?? ''));
        });

        return $cases;
    }

    private function firstNonEmptyString(array $values): ?string
    {
        foreach ($values as $value) {
            $value = trim((string) $value);
            if ($value !== '') {
                return $value;
            }
        }

        return null;
    }

    private function normalizeTimestampValue(string $value, string $fallback): string
    {
        $value = trim($value);
        if ($value === '') {
            return $fallback;
        }

        $timestamp = strtotime($value);
        if ($timestamp === false) {
            return $value;
        }

        return date('c', $timestamp);
    }
}
