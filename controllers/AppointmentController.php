<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/BookingService.php';

class AppointmentController
{
    private const ALLOWED_DOCTORS = ['rosero', 'narvaez', 'indiferente'];
    private const ALLOWED_SERVICES = ['consulta', 'telefono', 'video', 'acne', 'cancer', 'laser', 'rejuvenecimiento'];

    public static function index(array $context): void
    {
        // GET /appointments (Admin)
        $store = $context['store'];
        json_response([
            'ok' => true,
            'data' => $store['appointments']
        ]);
    }

    public static function bookedSlots(array $context): void
    {
        // GET /booked-slots
        $store = $context['store'];
        $date = trim((string) ($_GET['date'] ?? ''));
        if ($date === '') {
            json_response([
                'ok' => false,
                'error' => 'Fecha requerida',
                'code' => 'calendar_bad_request',
            ], 400);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            json_response([
                'ok' => false,
                'error' => 'Fecha invalida. Usa formato YYYY-MM-DD',
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $doctor = strtolower(trim((string) ($_GET['doctor'] ?? 'indiferente')));
        if ($doctor === '') {
            $doctor = 'indiferente';
        }
        if (!in_array($doctor, self::ALLOWED_DOCTORS, true)) {
            json_response([
                'ok' => false,
                'error' => 'Doctor invalido. Usa rosero, narvaez o indiferente.',
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $service = strtolower(trim((string) ($_GET['service'] ?? 'consulta')));
        if ($service === '') {
            $service = 'consulta';
        }
        if (!in_array($service, self::ALLOWED_SERVICES, true)) {
            json_response([
                'ok' => false,
                'error' => 'Servicio invalido para horarios ocupados',
                'code' => 'calendar_bad_request',
            ], 400);
        }

        $availabilityService = CalendarAvailabilityService::fromEnv();
        $result = $availabilityService->getBookedSlots($store, $date, $doctor, $service);
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'No se pudo consultar horarios ocupados'),
                'code' => (string) ($result['code'] ?? 'booked_slots_error'),
                'meta' => isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [],
            ], (int) ($result['status'] ?? 503));
        }

        json_response([
            'ok' => true,
            'data' => array_values(array_unique(is_array($result['data'] ?? null) ? $result['data'] : [])),
            'meta' => isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [],
        ]);
    }

    public static function store(array $context): void
    {
        // POST /appointments
        // Ignoring $context['store'] to use fresh read inside lock
        require_rate_limit('appointments', 5, 60);
        $payload = require_json_body();
        $bookingService = new BookingService();

        $normalized = normalize_appointment($payload);
        $lockDate = (string) ($normalized['date'] ?? '');
        $lockTime = (string) ($normalized['time'] ?? '');

        $runCreate = static function () use ($bookingService, $payload): array {
            $lockResult = with_store_lock(function () use ($bookingService, $payload) {
                $freshStore = read_store();
                $createResult = $bookingService->create($freshStore, $payload);

                if (($createResult['ok'] ?? false) === true) {
                    if (!write_store($createResult['store'], false)) {
                        // Rollback: cancel calendar event if created
                        $appointment = $createResult['data'] ?? [];
                        if (!empty($appointment['calendarId']) && !empty($appointment['calendarEventId'])) {
                            $calendarBooking = CalendarBookingService::fromEnv();
                            if ($calendarBooking->isGoogleActive()) {
                                $cancelResult = $calendarBooking->cancelCalendarEvent($appointment);
                                if (($cancelResult['ok'] ?? false) !== true) {
                                    audit_log_event('calendar.error', [
                                        'operation' => 'events_delete_compensation',
                                        'reason' => (string) ($cancelResult['error'] ?? 'compensation_failed'),
                                        'appointmentId' => (int) ($appointment['id'] ?? 0),
                                    ]);
                                }
                            }
                        }
                        return [
                            'ok' => false,
                            'error' => 'No se pudo confirmar la reserva en este momento (storage)',
                            'code' => 503,
                            'errorCode' => 'booking_store_failed'
                        ];
                    }
                }
                return $createResult;
            });

            if (($lockResult['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                    'code' => (int) ($lockResult['code'] ?? 503),
                ];
            }
            return is_array($lockResult['result']) ? $lockResult['result'] : ['ok' => false, 'code' => 500];
        };

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $lockDate) && preg_match('/^\d{2}:\d{2}$/', $lockTime)) {
            $lockResult = CalendarBookingService::withSlotLock($lockDate, $lockTime, $runCreate);
            if (($lockResult['ok'] ?? false) !== true) {
                json_response([
                    'ok' => false,
                    'error' => (string) ($lockResult['error'] ?? 'No se pudo reservar ese horario en este momento'),
                    'code' => (string) ($lockResult['code'] ?? 'slot_lock_failed'),
                ], (int) ($lockResult['status'] ?? 409));
            }
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : [
                'ok' => false,
                'error' => 'Respuesta invalida del proceso de reserva',
                'code' => 500,
            ];
        } else {
            $result = $runCreate();
        }

        if (!$result['ok']) {
            $statusCode = (int) ($result['code'] ?? 500);
            $errorCode = isset($result['errorCode']) ? trim((string) $result['errorCode']) : '';
            if ($errorCode === '') {
                $errorCode = self::inferErrorCode($statusCode, (string) ($result['error'] ?? ''));
            }
            $errorCode = self::normalizeConflictErrorCode($statusCode, $errorCode);
            $errorPayload = [
                'ok' => false,
                'error' => $result['error'],
                'code' => $errorCode,
            ];
            json_response($errorPayload, $statusCode);
        }

        $appointment = $result['data'];

        // Redundant checks removed as BookingService handles them now
        // But keeping slotDurationMin just in case
        if (!isset($appointment['slotDurationMin']) || (int) $appointment['slotDurationMin'] <= 0) {
            $calendarBooking = CalendarBookingService::fromEnv();
            $appointment['slotDurationMin'] = $calendarBooking->getDurationMin((string) ($appointment['service'] ?? 'consulta'));
        }

        $event = new BookingCreated($appointment);
        get_event_dispatcher()->dispatch($event);
        $emailSent = $event->emailSent;

        json_response([
            'ok' => true,
            'data' => $appointment,
            'emailSent' => $emailSent
        ], 201);
    }

    public static function update(array $context): void
    {
        // PATCH /appointments (Admin)
        $payload = require_json_body();
        $id = isset($payload['id']) ? (int) $payload['id'] : 0;
        if ($id <= 0) {
            json_response([
                'ok' => false,
                'error' => 'Identificador inválido'
            ], 400);
        }

        $lockResult = with_store_lock(function () use ($id, $payload) {
            $store = read_store();
            $found = false;
            $cancelledAppointment = null;
            $updatedAppointment = null;

            foreach ($store['appointments'] as &$appt) {
                if ((int) ($appt['id'] ?? 0) !== $id) {
                    continue;
                }
                $found = true;
                if (isset($payload['status'])) {
                    $appt['status'] = map_appointment_status((string) $payload['status']);
                    if ($appt['status'] === 'cancelled') {
                        $cancelledAppointment = $appt;
                    }
                }
                if (isset($payload['paymentStatus'])) {
                    $appt['paymentStatus'] = (string) $payload['paymentStatus'];
                }
                if (isset($payload['paymentMethod'])) {
                    $appt['paymentMethod'] = (string) $payload['paymentMethod'];
                }
                if (isset($payload['paymentProvider'])) {
                    $appt['paymentProvider'] = (string) $payload['paymentProvider'];
                }
                if (isset($payload['paymentIntentId'])) {
                    $appt['paymentIntentId'] = (string) $payload['paymentIntentId'];
                }
                if (isset($payload['paymentPaidAt'])) {
                    $appt['paymentPaidAt'] = (string) $payload['paymentPaidAt'];
                }
                if (isset($payload['transferReference'])) {
                    $appt['transferReference'] = (string) $payload['transferReference'];
                }
                if (isset($payload['transferProofPath'])) {
                    $appt['transferProofPath'] = (string) $payload['transferProofPath'];
                }
                if (isset($payload['transferProofUrl'])) {
                    $appt['transferProofUrl'] = (string) $payload['transferProofUrl'];
                }
                if (isset($payload['transferProofName'])) {
                    $appt['transferProofName'] = (string) $payload['transferProofName'];
                }
                if (isset($payload['transferProofMime'])) {
                    $appt['transferProofMime'] = (string) $payload['transferProofMime'];
                }
                $updatedAppointment = $appt;
            }
            unset($appt);

            if (!$found) {
                return ['ok' => false, 'error' => 'Cita no encontrada', 'code' => 404];
            }

            if (!write_store($store)) {
                return ['ok' => false, 'error' => 'Storage write failed', 'code' => 503];
            }

            return [
                'ok' => true,
                'cancelled' => $cancelledAppointment,
                'updated' => $updatedAppointment
            ];
        });

        if (($lockResult['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($lockResult['error'] ?? 'Store lock failed')
            ], (int) ($lockResult['code'] ?? 503));
        }

        $result = $lockResult['result'];
        if (($result['ok'] ?? false) !== true) {
            json_response([
                'ok' => false,
                'error' => (string) ($result['error'] ?? 'Error desconocido')
            ], (int) ($result['code'] ?? 500));
        }

        $cancelledAppointment = $result['cancelled'];
        if (is_array($cancelledAppointment)) {
            $calendarBooking = CalendarBookingService::fromEnv();
            if ($calendarBooking->isGoogleActive()) {
                $cancelResult = $calendarBooking->cancelCalendarEvent($cancelledAppointment);
                if (($cancelResult['ok'] ?? false) !== true) {
                    audit_log_event('calendar.error', [
                        'operation' => 'events_delete',
                        'reason' => (string) ($cancelResult['error'] ?? 'cancel_failed'),
                        'appointmentId' => $id,
                    ]);
                }
            }
        }

        // Enviar email de cancelación al paciente si se canceló la cita
        if (isset($payload['status']) && map_appointment_status((string) $payload['status']) === 'cancelled' && isset($result['updated'])) {
            get_event_dispatcher()->dispatch(new BookingCancelled($result['updated']));
        }

        json_response([
            'ok' => true
        ]);
    }

    public static function checkReschedule(array $context): void
    {
        // GET /reschedule
        $store = $context['store'];
        $token = trim((string) ($_GET['token'] ?? ''));
        if ($token === '' || strlen($token) < 16) {
            json_response([
                'ok' => false,
                'error' => 'Token invalido',
                'code' => 'invalid_token'
            ], 400);
        }

        $found = null;
        foreach ($store['appointments'] as $appt) {
            if (($appt['rescheduleToken'] ?? '') === $token && ($appt['status'] ?? '') !== 'cancelled') {
                $found = $appt;
                break;
            }
        }

        if (!$found) {
            json_response(['ok' => false, 'error' => 'Cita no encontrada o cancelada'], 404);
        }

        json_response([
            'ok' => true,
            'data' => [
                'id' => $found['id'],
                'service' => $found['service'] ?? '',
                'doctor' => $found['doctor'] ?? '',
                'date' => $found['date'] ?? '',
                'time' => $found['time'] ?? '',
                'name' => $found['name'] ?? '',
                'status' => $found['status'] ?? ''
            ]
        ]);
    }

    public static function processReschedule(array $context): void
    {
        // PATCH /reschedule
        require_rate_limit('reschedule', 5, 60);
        $payload = require_json_body();
        $token = trim((string) ($payload['token'] ?? ''));
        $newDate = trim((string) ($payload['date'] ?? ''));
        $newTime = trim((string) ($payload['time'] ?? ''));

        $bookingService = new BookingService();
        $runReschedule = static function () use ($bookingService, $token, $newDate, $newTime): array {
            $lockResult = with_store_lock(function () use ($bookingService, $token, $newDate, $newTime) {
                $freshStore = read_store();
                $rescheduleResult = $bookingService->reschedule($freshStore, $token, $newDate, $newTime);

                if (($rescheduleResult['ok'] ?? false) === true) {
                    if (!write_store($rescheduleResult['store'], false)) {
                        // Rollback: revert google calendar changes
                        $appointment = $rescheduleResult['data'] ?? [];
                        $previousCalendarState = null;
                        if (isset($rescheduleResult['meta']['previousCalendarState']) && is_array($rescheduleResult['meta']['previousCalendarState'])) {
                            $previousCalendarState = $rescheduleResult['meta']['previousCalendarState'];
                        }

                        $calendarBooking = CalendarBookingService::fromEnv();
                        if ($calendarBooking->isGoogleActive() && is_array($previousCalendarState)) {
                            $previousDate = trim((string) ($previousCalendarState['date'] ?? ''));
                            $previousTime = trim((string) ($previousCalendarState['time'] ?? ''));
                            $previousDoctor = trim((string) ($previousCalendarState['doctor'] ?? ($appointment['doctor'] ?? '')));
                            if (
                                preg_match('/^\d{4}-\d{2}-\d{2}$/', $previousDate) &&
                                preg_match('/^\d{2}:\d{2}$/', $previousTime)
                            ) {
                                $rollbackResult = $calendarBooking->patchCalendarEvent(
                                    $appointment,
                                    $previousDate,
                                    $previousTime,
                                    $previousDoctor !== '' ? $previousDoctor : null
                                );
                                if (($rollbackResult['ok'] ?? false) !== true) {
                                    audit_log_event('calendar.error', [
                                        'operation' => 'events_patch_rollback',
                                        'reason' => (string) ($rollbackResult['error'] ?? 'rollback_failed'),
                                        'appointmentId' => (int) ($appointment['id'] ?? 0),
                                    ]);
                                }
                            }
                        }
                        return [
                            'ok' => false,
                            'error' => 'No se pudo guardar la reprogramacion en este momento',
                            'code' => 503,
                            'errorCode' => 'reschedule_store_failed'
                        ];
                    }
                }
                return $rescheduleResult;
            });

            if (($lockResult['ok'] ?? false) !== true) {
                 return [
                    'ok' => false,
                    'error' => (string) ($lockResult['error'] ?? 'Store lock failed'),
                    'code' => (int) ($lockResult['code'] ?? 503),
                ];
            }
            return is_array($lockResult['result']) ? $lockResult['result'] : ['ok' => false, 'code' => 500];
        };

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $newDate) && preg_match('/^\d{2}:\d{2}$/', $newTime)) {
            $lockResult = CalendarBookingService::withSlotLock($newDate, $newTime, $runReschedule);
            if (($lockResult['ok'] ?? false) !== true) {
                json_response([
                    'ok' => false,
                    'error' => (string) ($lockResult['error'] ?? 'No se pudo reprogramar en este momento'),
                    'code' => (string) ($lockResult['code'] ?? 'slot_lock_failed'),
                ], (int) ($lockResult['status'] ?? 409));
            }
            $result = is_array($lockResult['result'] ?? null) ? $lockResult['result'] : [
                'ok' => false,
                'error' => 'Respuesta invalida del proceso de reprogramacion',
                'code' => 500,
            ];
        } else {
            $result = $runReschedule();
        }

        if (!$result['ok']) {
            $statusCode = (int) ($result['code'] ?? 500);
            $errorCode = isset($result['errorCode']) ? trim((string) $result['errorCode']) : '';
            if ($errorCode === '') {
                $errorCode = self::inferErrorCode($statusCode, (string) ($result['error'] ?? ''));
            }
            $errorCode = self::normalizeConflictErrorCode($statusCode, $errorCode);
            $errorPayload = [
                'ok' => false,
                'error' => $result['error'],
                'code' => $errorCode,
            ];
            json_response($errorPayload, $statusCode);
        }

        $appointment = $result['data'];

        // Redundant checks removed
        if (!isset($appointment['slotDurationMin']) || (int) $appointment['slotDurationMin'] <= 0) {
            $calendarBooking = CalendarBookingService::fromEnv();
            $appointment['slotDurationMin'] = $calendarBooking->getDurationMin((string) ($appointment['service'] ?? 'consulta'));
        }

        get_event_dispatcher()->dispatch(new BookingRescheduled($appointment));

        json_response([
            'ok' => true,
            'data' => [
                'id' => $appointment['id'],
                'date' => $newDate,
                'time' => $newTime,
                'doctor' => $appointment['doctor'] ?? '',
                'doctorAssigned' => $appointment['doctorAssigned'] ?? '',
                'calendarProvider' => $appointment['calendarProvider'] ?? '',
                'calendarId' => $appointment['calendarId'] ?? '',
                'calendarEventId' => $appointment['calendarEventId'] ?? '',
                'slotDurationMin' => (int) ($appointment['slotDurationMin'] ?? 0),
            ]
        ]);
    }

    private static function inferErrorCode(int $statusCode, string $errorMessage): string
    {
        $message = strtolower(trim($errorMessage));
        if ($statusCode === 400) {
            if (strpos($message, 'token') !== false) {
                return 'invalid_token';
            }
            return 'bad_request';
        }
        if ($statusCode === 404) {
            return 'not_found';
        }
        if ($statusCode === 409) {
            return 'slot_conflict';
        }
        if ($statusCode === 429) {
            return 'rate_limited';
        }
        if ($statusCode === 503) {
            return 'service_unavailable';
        }
        return 'internal_error';
    }

    private static function normalizeConflictErrorCode(int $statusCode, string $errorCode): string
    {
        if ($statusCode !== 409) {
            return $errorCode;
        }

        $normalized = strtolower(trim($errorCode));
        if ($normalized === '' || in_array($normalized, ['slot_unavailable', 'slot_locked', 'slot_lock_failed'], true)) {
            return 'slot_conflict';
        }
        return $normalized;
    }
}
