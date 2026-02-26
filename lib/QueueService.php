<?php

declare(strict_types=1);

require_once __DIR__ . '/common.php';
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/models.php';
require_once __DIR__ . '/storage.php';

class QueueService
{
    private const STATUS_WAITING = 'waiting';
    private const STATUS_CALLED = 'called';
    private const STATUS_COMPLETED = 'completed';
    private const STATUS_NO_SHOW = 'no_show';
    private const STATUS_CANCELLED = 'cancelled';

    private const ACTIVE_APPOINTMENT_STATUSES = ['confirmed', 'pending'];

    /**
     * @return array{ok:bool,data:array}
     */
    public function getQueueState(array $store): array
    {
        $tickets = $this->normalizeTickets($store['queue_tickets'] ?? []);
        $waiting = [];
        $called = [];
        $counts = [
            self::STATUS_WAITING => 0,
            self::STATUS_CALLED => 0,
            self::STATUS_COMPLETED => 0,
            self::STATUS_NO_SHOW => 0,
            self::STATUS_CANCELLED => 0,
        ];

        foreach ($tickets as $ticket) {
            $status = (string) ($ticket['status'] ?? self::STATUS_WAITING);
            if (isset($counts[$status])) {
                $counts[$status]++;
            }
            if ($status === self::STATUS_WAITING) {
                $waiting[] = $ticket;
            } elseif ($status === self::STATUS_CALLED) {
                $called[] = $ticket;
            }
        }

        usort($waiting, fn(array $a, array $b): int => $this->compareWaitingTickets($a, $b));
        usort($called, fn(array $a, array $b): int => $this->compareCalledTickets($a, $b));

        $callingNowByConsultorio = [];
        foreach ($called as $ticket) {
            $consultorio = $this->normalizeConsultorio($ticket['assignedConsultorio'] ?? null);
            if ($consultorio === null || isset($callingNowByConsultorio[$consultorio])) {
                continue;
            }
            $callingNowByConsultorio[$consultorio] = [
                'id' => (int) ($ticket['id'] ?? 0),
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                'assignedConsultorio' => $consultorio,
                'calledAt' => (string) ($ticket['calledAt'] ?? ''),
                'status' => self::STATUS_CALLED,
            ];
        }

        ksort($callingNowByConsultorio);
        $callingNow = array_values($callingNowByConsultorio);
        $nextTickets = [];
        foreach ($waiting as $index => $ticket) {
            if ($index >= 10) {
                break;
            }
            $nextTickets[] = [
                'id' => (int) ($ticket['id'] ?? 0),
                'ticketCode' => (string) ($ticket['ticketCode'] ?? ''),
                'patientInitials' => (string) ($ticket['patientInitials'] ?? ''),
                'queueType' => (string) ($ticket['queueType'] ?? 'walk_in'),
                'priorityClass' => (string) ($ticket['priorityClass'] ?? 'walk_in'),
                'position' => $index + 1,
                'createdAt' => (string) ($ticket['createdAt'] ?? ''),
            ];
        }

        return [
            'ok' => true,
            'data' => [
                'updatedAt' => local_date('c'),
                'callingNow' => $callingNow,
                'nextTickets' => $nextTickets,
                'counts' => $counts,
                'waitingCount' => count($waiting),
                'calledCount' => count($called),
            ],
        ];
    }

    /**
     * @return array{ok:bool,store?:array,ticket?:array,error?:string,status?:int,errorCode?:string,replay?:bool}
     */
    public function createWalkInTicket(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        $initials = $this->resolveInitials($payload);
        if ($initials === '') {
            return [
                'ok' => false,
                'error' => 'Iniciales del paciente requeridas',
                'status' => 400,
                'errorCode' => 'queue_bad_request',
            ];
        }

        $nowIso = local_date('c');
        $dailySeq = $this->nextDailySequence($store['queue_tickets'] ?? [], $nowIso);
        $ticket = normalize_queue_ticket([
            'id' => $this->nextTicketId($store['queue_tickets'] ?? []),
            'ticketCode' => $this->buildTicketCode($dailySeq),
            'dailySeq' => $dailySeq,
            'queueType' => 'walk_in',
            'appointmentId' => null,
            'patientInitials' => $initials,
            'phoneLast4' => $this->extractPhoneLast4((string) ($payload['phone'] ?? ($payload['telefono'] ?? ''))),
            'priorityClass' => 'walk_in',
            'status' => self::STATUS_WAITING,
            'assignedConsultorio' => null,
            'createdAt' => $nowIso,
            'calledAt' => '',
            'completedAt' => '',
            'createdSource' => $this->normalizeCreatedSource($createdSource),
        ]);

        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    /**
     * @return array{ok:bool,store?:array,ticket?:array,error?:string,status?:int,errorCode?:string,replay?:bool}
     */
    public function checkInAppointment(array $store, array $payload, string $createdSource = 'kiosk'): array
    {
        $store = $this->normalizeStore($store);
        $phoneRaw = (string) ($payload['phone'] ?? ($payload['telefono'] ?? ''));
        $phoneLast4 = $this->extractPhoneLast4($phoneRaw);
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
        $dailySeq = $this->nextDailySequence($store['queue_tickets'] ?? [], $nowIso);
        $initials = $this->resolveInitials([
            'patientInitials' => $payload['patientInitials'] ?? '',
            'name' => $appointment['name'] ?? '',
        ]);
        if ($initials === '') {
            $initials = 'PA';
        }

        $ticket = normalize_queue_ticket([
            'id' => $this->nextTicketId($store['queue_tickets'] ?? []),
            'ticketCode' => $this->buildTicketCode($dailySeq),
            'dailySeq' => $dailySeq,
            'queueType' => 'appointment',
            'appointmentId' => $appointmentId,
            'patientInitials' => $initials,
            'phoneLast4' => $phoneLast4,
            'priorityClass' => $this->resolveAppointmentPriority((string) ($appointment['date'] ?? $date), (string) ($appointment['time'] ?? $time)),
            'status' => self::STATUS_WAITING,
            'assignedConsultorio' => null,
            'createdAt' => $nowIso,
            'calledAt' => '',
            'completedAt' => '',
            'createdSource' => $this->normalizeCreatedSource($createdSource),
        ]);

        $store['queue_tickets'][] = $ticket;
        $store['updatedAt'] = $nowIso;

        return [
            'ok' => true,
            'store' => $store,
            'ticket' => $ticket,
            'replay' => false,
        ];
    }

    /**
     * @return array{ok:bool,store?:array,ticket?:array,error?:string,status?:int,errorCode?:string}
     */
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
        $waiting = array_values(array_filter($store['queue_tickets'], static function ($ticket): bool {
            return is_array($ticket) && (($ticket['status'] ?? '') === self::STATUS_WAITING);
        }));

        usort($waiting, fn(array $a, array $b): int => $this->compareWaitingTickets($a, $b));
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
            if (!is_array($ticket)) {
                continue;
            }
            if ((int) ($ticket['id'] ?? 0) !== $selectedId) {
                continue;
            }
            $ticket['status'] = self::STATUS_CALLED;
            $ticket['assignedConsultorio'] = $consultorio;
            $ticket['calledAt'] = $nowIso;
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

    /**
     * @return array{ok:bool,store?:array,ticket?:array,error?:string,status?:int,errorCode?:string}
     */
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

            if ($action !== '') {
                switch ($action) {
                    case 're-llamar':
                    case 'rellamar':
                    case 'recall':
                    case 'llamar':
                        $ticket['status'] = self::STATUS_CALLED;
                        $ticket['calledAt'] = $nowIso;
                        if ($consultorio !== null) {
                            $ticket['assignedConsultorio'] = $consultorio;
                        }
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
                    self::STATUS_CANCELLED
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
                    $ticket['calledAt'] = $nowIso;
                    if ($consultorio !== null) {
                        $ticket['assignedConsultorio'] = $consultorio;
                    }
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
        $tickets = $this->normalizeTickets($store['queue_tickets'] ?? []);
        foreach ($tickets as $ticket) {
            if ((int) ($ticket['id'] ?? 0) === $ticketId) {
                return $ticket;
            }
        }
        return null;
    }

    public function buildAdminSummary(array $store): array
    {
        $state = $this->getQueueState($store);
        $data = is_array($state['data'] ?? null) ? $state['data'] : [];
        $consultorio1 = null;
        $consultorio2 = null;
        foreach ($data['callingNow'] ?? [] as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $consultorio = (int) ($ticket['assignedConsultorio'] ?? 0);
            if ($consultorio === 1) {
                $consultorio1 = $ticket;
            } elseif ($consultorio === 2) {
                $consultorio2 = $ticket;
            }
        }

        return [
            'updatedAt' => (string) ($data['updatedAt'] ?? local_date('c')),
            'waitingCount' => (int) ($data['waitingCount'] ?? 0),
            'calledCount' => (int) ($data['calledCount'] ?? 0),
            'counts' => is_array($data['counts'] ?? null) ? $data['counts'] : [],
            'callingNowByConsultorio' => [
                '1' => $consultorio1,
                '2' => $consultorio2,
            ],
            'nextTickets' => is_array($data['nextTickets'] ?? null) ? $data['nextTickets'] : [],
        ];
    }

    private function normalizeStore(array $store): array
    {
        $store = normalize_store_payload($store);
        $store['queue_tickets'] = $this->normalizeTickets($store['queue_tickets'] ?? []);
        return $store;
    }

    /**
     * @param array<int,mixed> $rawTickets
     * @return array<int,array>
     */
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

    private function nextTicketId(array $tickets): int
    {
        $maxId = 0;
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $candidate = (int) ($ticket['id'] ?? 0);
            if ($candidate > $maxId) {
                $maxId = $candidate;
            }
        }
        $seed = (int) round(microtime(true) * 1000);
        return max($seed, $maxId + 1);
    }

    private function nextDailySequence(array $tickets, string $createdAt): int
    {
        $targetDate = $this->dateKeyFromIso($createdAt);
        $maxSeq = 0;
        foreach ($tickets as $ticket) {
            if (!is_array($ticket)) {
                continue;
            }
            $ticketDate = $this->dateKeyFromIso((string) ($ticket['createdAt'] ?? ''));
            if ($ticketDate !== $targetDate) {
                continue;
            }
            $seq = (int) ($ticket['dailySeq'] ?? 0);
            if ($seq > $maxSeq) {
                $maxSeq = $seq;
            }
        }
        return $maxSeq + 1;
    }

    private function buildTicketCode(int $dailySeq): string
    {
        $width = $dailySeq > 999 ? 4 : 3;
        return 'A-' . str_pad((string) $dailySeq, $width, '0', STR_PAD_LEFT);
    }

    private function dateKeyFromIso(string $iso): string
    {
        $ts = strtotime($iso);
        if ($ts === false) {
            return local_date('Y-m-d');
        }
        return date('Y-m-d', $ts);
    }

    private function resolveInitials(array $payload): string
    {
        $rawInitials = trim((string) ($payload['patientInitials'] ?? ''));
        if ($rawInitials !== '') {
            $clean = strtoupper((string) preg_replace('/[^A-Za-z]/', '', $rawInitials));
            if ($clean !== '') {
                return substr($clean, 0, 4);
            }
        }

        $name = trim((string) ($payload['name'] ?? ($payload['patientName'] ?? '')));
        if ($name === '') {
            return '';
        }

        $parts = preg_split('/\s+/', strtoupper($name));
        if (!is_array($parts)) {
            return '';
        }

        $letters = '';
        foreach ($parts as $part) {
            $part = preg_replace('/[^A-Z]/', '', $part ?? '');
            if (!is_string($part) || $part === '') {
                continue;
            }
            $letters .= substr($part, 0, 1);
            if (strlen($letters) >= 3) {
                break;
            }
        }

        return substr($letters, 0, 4);
    }

    private function extractPhoneLast4(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', sanitize_phone($phone));
        if (!is_string($digits) || strlen($digits) < 4) {
            return '';
        }
        return substr($digits, -4);
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

            $apptLast4 = $this->extractPhoneLast4((string) ($appointment['phone'] ?? ''));
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
            if (!is_array($ticket)) {
                continue;
            }
            if ((int) ($ticket['appointmentId'] ?? 0) !== $appointmentId) {
                continue;
            }
            $status = (string) ($ticket['status'] ?? '');
            if (in_array($status, [self::STATUS_WAITING, self::STATUS_CALLED, self::STATUS_COMPLETED], true)) {
                return normalize_queue_ticket($ticket);
            }
        }
        return null;
    }

    private function resolveAppointmentPriority(string $appointmentDate, string $appointmentTime): string
    {
        $normalizedTime = $this->normalizeHour($appointmentTime);
        if ($normalizedTime === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $appointmentDate)) {
            return 'appt_current';
        }

        $appointmentTs = strtotime($appointmentDate . ' ' . $normalizedTime);
        if ($appointmentTs === false) {
            return 'appt_current';
        }

        $now = time();
        if ($appointmentTs <= ($now - 300)) {
            return 'appt_overdue';
        }
        return 'appt_current';
    }

    private function compareWaitingTickets(array $a, array $b): int
    {
        $priorityDiff = $this->priorityWeight((string) ($a['priorityClass'] ?? 'walk_in'))
            <=> $this->priorityWeight((string) ($b['priorityClass'] ?? 'walk_in'));
        if ($priorityDiff !== 0) {
            return $priorityDiff;
        }

        $timeDiff = $this->ticketTimestamp($a, 'createdAt') <=> $this->ticketTimestamp($b, 'createdAt');
        if ($timeDiff !== 0) {
            return $timeDiff;
        }

        return ((int) ($a['id'] ?? 0)) <=> ((int) ($b['id'] ?? 0));
    }

    private function compareCalledTickets(array $a, array $b): int
    {
        $timeDiff = $this->ticketTimestamp($b, 'calledAt') <=> $this->ticketTimestamp($a, 'calledAt');
        if ($timeDiff !== 0) {
            return $timeDiff;
        }
        return ((int) ($b['id'] ?? 0)) <=> ((int) ($a['id'] ?? 0));
    }

    private function priorityWeight(string $priorityClass): int
    {
        switch ($priorityClass) {
            case 'appt_overdue':
                return 0;
            case 'appt_current':
                return 1;
            default:
                return 2;
        }
    }

    private function ticketTimestamp(array $ticket, string $field): int
    {
        $value = (string) ($ticket[$field] ?? '');
        $ts = strtotime($value);
        if ($ts === false) {
            return 0;
        }
        return $ts;
    }

    private function normalizeConsultorio($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $candidate = (int) $value;
        return in_array($candidate, [1, 2], true) ? $candidate : null;
    }

    private function normalizeCreatedSource(string $source): string
    {
        $source = strtolower(trim($source));
        return in_array($source, ['kiosk', 'admin'], true) ? $source : 'kiosk';
    }
}
