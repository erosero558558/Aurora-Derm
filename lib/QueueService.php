<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/queue/TicketFactory.php';
require_once __DIR__ . '/queue/TicketPriorityPolicy.php';
require_once __DIR__ . '/queue/QueueSummaryBuilder.php';

class QueueService
{
    private const STATUS_WAITING = 'waiting';
    private const STATUS_CALLED = 'called';
    private const STATUS_COMPLETED = 'completed';
    private const STATUS_NO_SHOW = 'no_show';
    private const STATUS_CANCELLED = 'cancelled';

    private const ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'pending'];

    private TicketFactory $ticketFactory;
    private TicketPriorityPolicy $priorityPolicy;
    private QueueSummaryBuilder $summaryBuilder;

    public function __construct(
        ?TicketFactory $ticketFactory = null,
        ?TicketPriorityPolicy $priorityPolicy = null,
        ?QueueSummaryBuilder $summaryBuilder = null
    ) {
        $this->ticketFactory = $ticketFactory ?? new TicketFactory();
        $this->priorityPolicy = $priorityPolicy ?? new TicketPriorityPolicy();
        $this->summaryBuilder = $summaryBuilder ?? new QueueSummaryBuilder($this->priorityPolicy);
    }

    public function getQueueState(array $store): array
    {
        $store = $this->normalizeStore($store);
        $store = $this->priorityPolicy->refreshWaitingAppointmentPriorities($store);
        return $this->summaryBuilder->buildQueueState(
            $store['queue_tickets'] ?? [],
            $store['queue_help_requests'] ?? [],
            local_date('c')
        );
    }

    public function createWalkInTicket(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        if ($this->ticketFactory->resolveInitials($payload) === '') {
            return [
                'ok' => false,
                'error' => 'Iniciales del paciente requeridas',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $nowIso = local_date('c');
        $ticket = $this->ticketFactory->createWalkInTicket($store['queue_tickets'] ?? [], $payload, $createdSource, $nowIso);
        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    public function checkInAppointment(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        $phoneRaw = (string) ($payload['phone'] ?? ($payload['telefono'] ?? ''));
        $phoneLast4 = $this->ticketFactory->extractPhoneLast4($phoneRaw);
        if (strlen($phoneLast4) !== 4) {
            return [
                'ok' => false,
                'error' => 'Telefono invalido para check-in',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $time = $this->normalizeHour((string) ($payload['time'] ?? ($payload['hora'] ?? '')));
        if ($time === '') {
            return [
                'ok' => false,
                'error' => 'Hora invalida. Usa formato HH:MM',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $date = trim((string) ($payload['date'] ?? ($payload['fecha'] ?? local_date('Y-m-d'))));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return [
                'ok' => false,
                'error' => 'Fecha invalida. Usa formato YYYY-MM-DD',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $appointment = $this->findAppointment($store['appointments'] ?? [], $phoneLast4, $date, $time);
        if ($appointment === null) {
            return [
                'ok' => false,
                'error' => 'No se encontro una cita valida para ese telefono y hora',
                'status' => 404,
                'errorCode' => 'queue_appointment_not_found',
            ];
        }

        $appointmentId = (int) ($appointment['id'] ?? 0);
        if ($appointmentId <= 0) {
            return [
                'ok' => false,
                'error' => 'La cita encontrada no es valida para check-in',
                'status' => 409,
                'errorCode' => 'queue_appointment_invalid',
            ];
        }

        $existing = $this->findActiveTicketByAppointment($store['queue_tickets'] ?? [], $appointmentId);
        if ($existing !== null) {
            return [
                'ok' => true,
                'store' => $store,
                'ticket' => $existing,
                'replay' => true,
            ];
        }

        $nowIso = local_date('c');
        $ticket = $this->ticketFactory->createAppointmentTicket(
            $store['queue_tickets'] ?? [],
            $appointment,
            $payload,
            $createdSource,
            $this->priorityPolicy->resolveAppointmentPriority(
                (string) ($appointment['date'] ?? $date),
                (string) ($appointment['time'] ?? $time)
            ),
            $nowIso
        );

        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    public function createHelpRequest(array $store, array $payload): array
    {
        $store = $this->normalizeStore($store);
        $reason = strtolower(trim((string) ($payload['reason'] ?? 'general')));
        if ($reason === '') {
            $reason = 'general';
        }

        $ticketId = isset($payload['ticketId']) ? (int) $payload['ticketId'] : (isset($payload['ticket_id']) ? (int) $payload['ticket_id'] : 0);
        $ticket = $this->findTicketForHelpRequest($store, $payload, $ticketId);
        $ticketId = is_array($ticket) ? (int) ($ticket['id'] ?? 0) : $ticketId;
        $openRequest = $this->findOpenHelpRequest(
            $store['queue_help_requests'] ?? [],
            $ticketId,
            $reason,
            (string) ($payload['sessionId'] ?? ($payload['session_id'] ?? ''))
        );
        if (is_array($openRequest)) {
            return [
                'ok' => true,
                'store' => $store,
                'helpRequest' => $openRequest,
                'replay' => true,
            ];
        }

        $nowIso = local_date('c');
        $request = normalize_queue_help_request([
            'id' => $this->nextHelpRequestId($store['queue_help_requests'] ?? []),
            'source' => $payload['source'] ?? 'kiosk',
            'reason' => $reason,
            'status' => 'pending',
            'message' => $payload['message'] ?? '',
            'intent' => $payload['intent'] ?? '',
            'sessionId' => $payload['sessionId'] ?? ($payload['session_id'] ?? ''),
            'ticketId' => $ticketId > 0 ? $ticketId : null,
            'ticketCode' => $payload['ticketCode'] ?? ($ticket['ticketCode'] ?? ''),
            'patientInitials' => $payload['patientInitials'] ?? ($ticket['patientInitials'] ?? ''),
            'createdAt' => $nowIso,
            'updatedAt' => $nowIso,
            'context' => isset($payload['context']) && is_array($payload['context']) ? $payload['context'] : [],
        ]);

        $store['queue_help_requests'][] = $request;
        $store['updatedAt'] = $nowIso;
        $store = $this->syncTicketAssistanceFlags($store);

        Metrics::increment('queue_help_requests_total', [
            'reason' => $reason,
            'source' => (string) ($request['source'] ?? 'kiosk'),
            'status' => 'pending',
        ]);

        return [
            'ok' => true,
            'store' => $store,
            'helpRequest' => $request,
            'replay' => false,
        ];
    }

    public function patchHelpRequest(array $store, array $payload): array
    {
        $store = $this->normalizeStore($store);
        $requestId = isset($payload['id']) ? (int) $payload['id'] : 0;
        $ticketId = isset($payload['ticketId']) ? (int) $payload['ticketId'] : (isset($payload['ticket_id']) ? (int) $payload['ticket_id'] : 0);
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        if (!in_array($status, ['pending', 'attending', 'resolved'], true)) {
            return [
                'ok' => false,
                'error' => 'Estado de apoyo no soportado',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $found = false;
        $updatedRequest = null;
        $nowIso = local_date('c');
        foreach ($store['queue_help_requests'] as $idx => $request) {
            if (!is_array($request)) {
                continue;
            }
            $matchesById = $requestId > 0 && (int) ($request['id'] ?? 0) === $requestId;
            $matchesByTicket = $requestId <= 0 && $ticketId > 0 && (int) ($request['ticketId'] ?? 0) === $ticketId && in_array((string) ($request['status'] ?? ''), ['pending', 'attending'], true);
            if (!$matchesById && !$matchesByTicket) {
                continue;
            }

            $request['status'] = $status;
            $request['updatedAt'] = $nowIso;
            if ($status === 'attending') {
                $request['attendedAt'] = $nowIso;
            }
            if ($status === 'resolved') {
                $request['resolvedAt'] = $nowIso;
            }

            $store['queue_help_requests'][$idx] = normalize_queue_help_request($request);
            $updatedRequest = $store['queue_help_requests'][$idx];
            $found = true;
            if ($requestId > 0) {
                break;
            }
        }

        if (!$found || !is_array($updatedRequest)) {
            return [
                'ok' => false,
                'error' => 'Solicitud de apoyo no encontrada',
                'status' => 404,
                'errorCode' => 'queue_help_request_not_found',
            ];
        }

        $store['updatedAt'] = $nowIso;
        $store = $this->syncTicketAssistanceFlags($store);

        Metrics::increment('queue_help_requests_total', [
            'reason' => (string) ($updatedRequest['reason'] ?? 'general'),
            'source' => (string) ($updatedRequest['source'] ?? 'kiosk'),
            'status' => $status,
        ]);

        return [
            'ok' => true,
            'store' => $store,
            'helpRequest' => $updatedRequest,
        ];
    }

    public function callNext(array $store, int $consultorio): array
    {
        if (!in_array($consultorio, [1, 2], true)) {
            return [
                'ok' => false,
                'error' => 'Consultorio invalido',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $store = $this->normalizeStore($store);
        $store = $this->priorityPolicy->refreshWaitingAppointmentPriorities($store);

        $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'] ?? [], $consultorio);
        if (is_array($busyTicket)) {
            $ticketCode = (string) ($busyTicket['ticketCode'] ?? '--');
            return [
                'ok' => false,
                'error' => "Consultorio {$consultorio} ocupado por {$ticketCode}. Libera o completa ese turno antes de llamar otro.",
                'status' => 409,
                'errorCode' => 'queue_consultorio_busy',
            ];
        }

        $waiting = array_values(array_filter($store['queue_tickets'], static function ($ticket): bool {
            return is_array($ticket) && (($ticket['status'] ?? '') === self::STATUS_WAITING);
        }));
        $waiting = $this->priorityPolicy->sortWaitingTickets($waiting);
        if ($waiting === []) {
            return [
                'ok' => false,
                'error' => 'No hay turnos en espera',
                'status' => 404,
                'errorCode' => 'queue_empty',
            ];
        }

        $selectedId = (int) ($waiting[0]['id'] ?? 0);
        if ($selectedId <= 0) {
            return [
                'ok' => false,
                'error' => 'Ticket invalido',
                'status' => 409,
                'errorCode' => 'queue_ticket_invalid',
            ];
        }

        $updatedTicket = null;
        $nowIso = local_date('c');
        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket) || (int) ($ticket['id'] ?? 0) !== $selectedId) {
                continue;
            }
            $ticket['status'] = self::STATUS_CALLED;
            $ticket['assignedConsultorio'] = $consultorio;
            $ticket['calledAt'] = $nowIso;
            $ticket['completedAt'] = '';
            $store['queue_tickets'][$idx] = normalize_queue_ticket($ticket);
            $updatedTicket = $store['queue_tickets'][$idx];
            break;
        }

        if (!is_array($updatedTicket)) {
            return [
                'ok' => false,
                'error' => 'No se pudo actualizar el turno',
                'status' => 409,
                'errorCode' => 'queue_update_failed',
            ];
        }

        $store['updatedAt'] = $nowIso;
        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $updatedTicket,
        ];
    }

    public function patchTicket(array $store, array $payload): array
    {
        $store = $this->normalizeStore($store);
        $ticketId = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($ticketId <= 0) {
            return [
                'ok' => false,
                'error' => 'id de ticket invalido',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $action = strtolower(trim((string) ($payload['action'] ?? '')));
        $status = strtolower(trim((string) ($payload['status'] ?? '')));
        $consultorio = $this->normalizeConsultorio($payload['consultorio'] ?? ($payload['assignedConsultorio'] ?? null));
        $nowIso = local_date('c');

        $found = false;
        $updated = null;
        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket) || (int) ($ticket['id'] ?? 0) !== $ticketId) {
                continue;
            }
            $found = true;
            $currentStatus = (string) ($ticket['status'] ?? self::STATUS_WAITING);

            if ($action !== '') {
                switch ($action) {
                    case 're-llamar':
                    case 'rellamar':
                    case 'recall':
                    case 'llamar':
                        if ($this->isTerminalStatus($currentStatus)) {
                            return [
                                'ok' => false,
                                'error' => 'No puedes re-llamar un ticket en estado terminal',
                                'status' => 409,
                                'errorCode' => 'queue_transition_invalid',
                            ];
                        }
                        $targetConsultorio = $consultorio ?? $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
                        if ($targetConsultorio !== null) {
                            $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'], $targetConsultorio, $ticketId);
                            if (is_array($busyTicket)) {
                                $busyCode = (string) ($busyTicket['ticketCode'] ?? '--');
                                return [
                                    'ok' => false,
                                    'error' => "Consultorio {$targetConsultorio} ocupado por {$busyCode}",
                                    'status' => 409,
                                    'errorCode' => 'queue_consultorio_busy',
                                ];
                            }
                            $ticket['assignedConsultorio'] = $targetConsultorio;
                        }
                        $ticket['status'] = self::STATUS_CALLED;
                        $ticket['calledAt'] = $nowIso;
                        $ticket['completedAt'] = '';
                        break;
                    case 'completar':
                    case 'complete':
                    case 'completed':
                        $ticket['status'] = self::STATUS_COMPLETED;
                        $ticket['completedAt'] = $nowIso;
                        break;
                    case 'no_show':
                    case 'noshow':
                        $ticket['status'] = self::STATUS_NO_SHOW;
                        $ticket['completedAt'] = $nowIso;
                        break;
                    case 'cancelar':
                    case 'cancel':
                    case 'cancelled':
                        $ticket['status'] = self::STATUS_CANCELLED;
                        $ticket['completedAt'] = $nowIso;
                        break;
                    case 'liberar':
                    case 'release':
                        $ticket['status'] = self::STATUS_WAITING;
                        $ticket['assignedConsultorio'] = null;
                        $ticket['calledAt'] = '';
                        $ticket['completedAt'] = '';
                        break;
                    case 'reasignar':
                    case 'reassign':
                        if ($consultorio === null) {
                            return [
                                'ok' => false,
                                'error' => 'Consultorio invalido para reasignar',
                                'status' => 400,
                                'errorCode' => 'queue_bad_request',
                            ];
                        }
                        $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'], $consultorio, $ticketId);
                        if (is_array($busyTicket)) {
                            $busyCode = (string) ($busyTicket['ticketCode'] ?? '--');
                            return [
                                'ok' => false,
                                'error' => "Consultorio {$consultorio} ocupado por {$busyCode}",
                                'status' => 409,
                                'errorCode' => 'queue_consultorio_busy',
                            ];
                        }
                        $ticket['assignedConsultorio'] = $consultorio;
                        break;
                    default:
                        return [
                            'ok' => false,
                            'error' => 'Accion no soportada',
                            'status' => 400,
                            'errorCode' => 'queue_bad_request',
                        ];
                }
            } elseif ($status !== '') {
                if (!in_array($status, [
                    self::STATUS_WAITING,
                    self::STATUS_CALLED,
                    self::STATUS_COMPLETED,
                    self::STATUS_NO_SHOW,
                    self::STATUS_CANCELLED,
                ], true)) {
                    return [
                        'ok' => false,
                        'error' => 'Estado no soportado',
                        'status' => 400,
                        'errorCode' => 'queue_bad_request',
                    ];
                }

                $ticket['status'] = $status;
                if ($status === self::STATUS_CALLED) {
                    $targetConsultorio = $consultorio ?? $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
                    if ($targetConsultorio !== null) {
                        $busyTicket = $this->findActiveCalledByConsultorio($store['queue_tickets'], $targetConsultorio, $ticketId);
                        if (is_array($busyTicket)) {
                            $busyCode = (string) ($busyTicket['ticketCode'] ?? '--');
                            return [
                                'ok' => false,
                                'error' => "Consultorio {$targetConsultorio} ocupado por {$busyCode}",
                                'status' => 409,
                                'errorCode' => 'queue_consultorio_busy',
                            ];
                        }
                        $ticket['assignedConsultorio'] = $targetConsultorio;
                    }
                    $ticket['calledAt'] = $nowIso;
                    $ticket['completedAt'] = '';
                } elseif ($status === self::STATUS_WAITING) {
                    $ticket['assignedConsultorio'] = null;
                    $ticket['calledAt'] = '';
                    $ticket['completedAt'] = '';
                }
                if (in_array($status, [self::STATUS_COMPLETED, self::STATUS_NO_SHOW, self::STATUS_CANCELLED], true)) {
                    $ticket['completedAt'] = $nowIso;
                }
            } else {
                return [
                    'ok' => false,
                    'error' => 'Debes enviar action o status',
                    'status' => 400,
                    'errorCode' => 'queue_bad_request',
                ];
            }

            $store['queue_tickets'][$idx] = normalize_queue_ticket($ticket);
            $updated = $store['queue_tickets'][$idx];
            break;
        }

        if (!$found || !is_array($updated)) {
            return [
                'ok' => false,
                'error' => 'Ticket no encontrado',
                'status' => 404,
                'errorCode' => 'queue_ticket_not_found',
            ];
        }

        $store['updatedAt'] = $nowIso;
        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $updated,
        ];
    }

    public function findTicketById(array $store, int $ticketId): ?array
    {
        foreach ($this->normalizeTickets($store['queue_tickets'] ?? []) as $ticket) {
            if ((int) ($ticket['id'] ?? 0) === $ticketId) {
                return $ticket;
            }
        }
        return null;
    }

    public function buildAdminSummary(array $store): array
    {
        return $this->summaryBuilder->buildAdminSummary($this->getQueueState($store));
    }

    private function normalizeStore(array $store): array
    {
        $store = normalize_store_payload($store);
        $store['queue_tickets'] = $this->normalizeTickets($store['queue_tickets'] ?? []);
        $store['queue_help_requests'] = $this->normalizeHelpRequests($store['queue_help_requests'] ?? []);
        $store = $this->syncTicketAssistanceFlags($store);
        return $store;
    }

    private function normalizeTickets(array $rawTickets): array
    {
        $tickets = [];
        foreach ($rawTickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $tickets[] = normalize_queue_ticket($ticket);
        }
        return $tickets;
    }

    private function normalizeHelpRequests(array $rawRequests): array
    {
        $requests = [];
        foreach ($rawRequests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $requests[] = normalize_queue_help_request($request);
        }

        usort($requests, static function (array $left, array $right): int {
            $leftTs = strtotime((string) ($left['updatedAt'] ?? $left['createdAt'] ?? '')) ?: 0;
            $rightTs = strtotime((string) ($right['updatedAt'] ?? $right['createdAt'] ?? '')) ?: 0;
            if ($leftTs !== $rightTs) {
                return $rightTs <=> $leftTs;
            }
            return ((int) ($right['id'] ?? 0)) <=> ((int) ($left['id'] ?? 0));
        });

        return $requests;
    }

    private function syncTicketAssistanceFlags(array $store): array
    {
        $activeByTicketId = [];
        foreach ($store['queue_help_requests'] ?? [] as $request) {
            if (!is_array($request)) {
                continue;
            }
            $ticketId = (int) ($request['ticketId'] ?? 0);
            if ($ticketId <= 0) {
                continue;
            }
            $status = (string) ($request['status'] ?? '');
            if (!in_array($status, ['pending', 'attending'], true)) {
                continue;
            }
            if (!isset($activeByTicketId[$ticketId])) {
                $activeByTicketId[$ticketId] = $request;
            }
        }

        foreach ($store['queue_tickets'] as $idx => $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $ticketId = (int) ($ticket['id'] ?? 0);
            $activeRequest = $activeByTicketId[$ticketId] ?? null;
            if (is_array($activeRequest)) {
                $ticket['needsAssistance'] = true;
                $ticket['assistanceRequestStatus'] = (string) ($activeRequest['status'] ?? 'pending');
                $ticket['activeHelpRequestId'] = (int) ($activeRequest['id'] ?? 0);
                $ticket['assistanceReason'] = (string) ($activeRequest['reason'] ?? '');
                if ((string) ($activeRequest['reason'] ?? '') === 'special_priority') {
                    $ticket['specialPriority'] = true;
                }
                if ((string) ($activeRequest['reason'] ?? '') === 'late_arrival') {
                    $ticket['lateArrival'] = true;
                }
                if (in_array((string) ($activeRequest['reason'] ?? ''), ['printer_issue', 'reprint_requested'], true)) {
                    $ticket['reprintRequestedAt'] = (string) ($activeRequest['createdAt'] ?? local_date('c'));
                }
            } else {
                $ticket['needsAssistance'] = false;
                $ticket['assistanceRequestStatus'] = '';
                $ticket['activeHelpRequestId'] = null;
                $ticket['assistanceReason'] = (string) ($ticket['assistanceReason'] ?? '');
            }

            $store['queue_tickets'][$idx] = normalize_queue_ticket($ticket);
        }

        return $store;
    }

    private function nextHelpRequestId(array $requests): int
    {
        $maxId = 0;
        foreach ($requests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $maxId = max($maxId, (int) ($request['id'] ?? 0));
        }

        return $maxId + 1;
    }

    private function findTicketForHelpRequest(array $store, array $payload, int $ticketId): ?array
    {
        if ($ticketId > 0) {
            $ticket = $this->findTicketById($store, $ticketId);
            if (is_array($ticket)) {
                return $ticket;
            }
        }

        $ticketCode = trim((string) ($payload['ticketCode'] ?? ($payload['ticket_code'] ?? '')));
        if ($ticketCode !== '') {
            foreach ($store['queue_tickets'] ?? [] as $ticket) {
                if (!is_array($ticket)) {
                    continue;
                }
                if ((string) ($ticket['ticketCode'] ?? '') === $ticketCode) {
                    return normalize_queue_ticket($ticket);
                }
            }
        }

        $patientInitials = strtoupper(trim((string) ($payload['patientInitials'] ?? ($payload['patient_initials'] ?? ''))));
        if ($patientInitials !== '') {
            $tickets = array_reverse($store['queue_tickets'] ?? []);
            foreach ($tickets as $ticket) {
                if (!is_array($ticket)) {
                    continue;
                }
                if (strtoupper((string) ($ticket['patientInitials'] ?? '')) === $patientInitials) {
                    return normalize_queue_ticket($ticket);
                }
            }
        }

        return null;
    }

    private function findOpenHelpRequest(
        array $requests,
        int $ticketId,
        string $reason,
        string $sessionId = ''
    ): ?array {
        foreach ($requests as $request) {
            if (!is_array($request)) {
                continue;
            }
            $status = (string) ($request['status'] ?? '');
            if (!in_array($status, ['pending', 'attending'], true)) {
                continue;
            }
            $sameTicket = $ticketId > 0 && (int) ($request['ticketId'] ?? 0) === $ticketId;
            $sameSession = $sessionId !== '' && (string) ($request['sessionId'] ?? '') === $sessionId;
            if (!$sameTicket && !$sameSession) {
                continue;
            }
            if ((string) ($request['reason'] ?? '') !== $reason) {
                continue;
            }
            return normalize_queue_help_request($request);
        }

        return null;
    }

    private function normalizeHour(string $hour): string
    {
        $hour = trim($hour);
        if ($hour === '') {
            return '';
        }
        if (preg_match('/^(\d{1,2}):(\d{2})$/', $hour, $matches) !== 1) {
            return '';
        }
        $hh = (int) $matches[1];
        $mm = (int) $matches[2];
        if ($hh < 0 || $hh > 23 || $mm < 0 || $mm > 59) {
            return '';
        }
        return str_pad((string) $hh, 2, '0', STR_PAD_LEFT) . ':' . str_pad((string) $mm, 2, '0', STR_PAD_LEFT);
    }

    private function findAppointment(array $appointments, string $phoneLast4, string $date, string $time): ?array
    {
        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }
            $apptDate = trim((string) ($appointment['date'] ?? ''));
            $apptTime = $this->normalizeHour((string) ($appointment['time'] ?? ''));
            if ($apptDate !== $date || $apptTime !== $time) {
                continue;
            }

            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if (!in_array($status, self::ACTIVE_APPOINTMENT_STATUSES, true)) {
                continue;
            }

            $apptLast4 = $this->ticketFactory->extractPhoneLast4((string) ($appointment['phone'] ?? ''));
            if ($apptLast4 === '' || $apptLast4 !== $phoneLast4) {
                continue;
            }

            return $appointment;
        }

        return null;
    }

    private function findActiveTicketByAppointment(array $tickets, int $appointmentId): ?array
    {
        foreach ($tickets as $ticket) {
            if (!is_array($ticket) || (int) ($ticket['appointmentId'] ?? 0) !== $appointmentId) {
                continue;
            }
            $status = (string) ($ticket['status'] ?? '');
            if (in_array($status, [self::STATUS_WAITING, self::STATUS_CALLED, self::STATUS_COMPLETED], true)) {
                return normalize_queue_ticket($ticket);
            }
        }
        return null;
    }

    private function isTerminalStatus(string $status): bool
    {
        return in_array($status, [self::STATUS_COMPLETED, self::STATUS_NO_SHOW, self::STATUS_CANCELLED], true);
    }

    private function findActiveCalledByConsultorio(array $tickets, int $consultorio, int $excludeTicketId = 0): ?array
    {
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            if ((string) ($ticket['status'] ?? '') !== self::STATUS_CALLED) {
                continue;
            }
            if ((int) ($ticket['id'] ?? 0) === $excludeTicketId) {
                continue;
            }
            $ticketConsultorio = $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
            if ($ticketConsultorio === $consultorio) {
                return normalize_queue_ticket($ticket);
            }
        }
        return null;
    }

    private function normalizeConsultorio($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $candidate = (int) $value;
        return in_array($candidate, [1, 2], true) ? $candidate : null;
    }
}
