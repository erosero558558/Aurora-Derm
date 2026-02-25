<?php

declare(strict_types=1);

class CalendarBookingService
{
    private CalendarAvailabilityService $availabilityService;

    public function __construct(CalendarAvailabilityService $availabilityService)
    {
        $this->availabilityService = $availabilityService;
    }

    public static function fromEnv(): self
    {
        return new self(CalendarAvailabilityService::fromEnv());
    }

    public function getDurationMin(string $service): int
    {
        return $this->availabilityService->getDurationMin($service);
    }

    public function isGoogleActive(): bool
    {
        return $this->availabilityService->isGoogleActive();
    }

    public function isGoogleRequired(): bool
    {
        return $this->availabilityService->isGoogleRequired();
    }

    public function isGoogleRequirementMet(): bool
    {
        return $this->availabilityService->isGoogleRequirementMet();
    }

    public function ensureGoogleRequirement(string $doctor = 'indiferente', string $service = 'consulta'): array
    {
        if ($this->isGoogleRequirementMet()) {
            return ['ok' => true];
        }

        $blocked = $this->availabilityService->googleRequiredBlockedResult($doctor, $service);
        return [
            'ok' => false,
            'status' => (int) ($blocked['status'] ?? 503),
            'code' => (string) ($blocked['code'] ?? 'calendar_unreachable'),
            'error' => (string) ($blocked['error'] ?? 'Agenda temporalmente no disponible'),
            'meta' => isset($blocked['meta']) && is_array($blocked['meta']) ? $blocked['meta'] : [],
        ];
    }

    public function ensureSlotAvailable(array $store, string $date, string $time, string $doctor, string $service, bool $fresh = true): array
    {
        $check = $this->availabilityService->isSlotAvailable($store, $date, $time, $doctor, $service, $fresh);
        if (($check['ok'] ?? false) === true) {
            return [
                'ok' => true,
                'status' => 200,
                'doctor' => $doctor,
                'durationMin' => $this->getDurationMin($service),
                'meta' => $check['meta'] ?? [],
            ];
        }

        return [
            'ok' => false,
            'status' => (int) ($check['status'] ?? 409),
            'code' => (string) ($check['code'] ?? 'slot_unavailable'),
            'error' => (string) ($check['error'] ?? 'Ese horario no está disponible'),
            'meta' => $check['meta'] ?? [],
        ];
    }

    public function assignDoctorForIndiferente(array $store, string $date, string $time, string $service): array
    {
        $candidates = ['rosero', 'narvaez'];

        // Optimize: warm up availability for all candidates in parallel
        $warmUpRequests = [];
        foreach ($candidates as $candidate) {
            $warmUpRequests[] = [
                'doctor' => $candidate,
                'dateFrom' => $date,
                'days' => 1,
                'fresh' => true,
            ];
        }
        $this->availabilityService->warmUpAvailability($warmUpRequests);

        $available = [];

        foreach ($candidates as $candidate) {
            $slot = $this->ensureSlotAvailable($store, $date, $time, $candidate, $service, false);
            if (($slot['ok'] ?? false) === true) {
                $available[] = $candidate;
            } elseif (($slot['code'] ?? '') === 'calendar_unreachable') {
                return [
                    'ok' => false,
                    'status' => (int) ($slot['status'] ?? 503),
                    'code' => 'calendar_unreachable',
                    'error' => (string) ($slot['error'] ?? 'Agenda temporalmente no disponible'),
                ];
            }
        }

        if (count($available) === 0) {
            return [
                'ok' => false,
                'status' => 409,
                'code' => 'slot_unavailable',
                'error' => 'Ese horario no está disponible',
            ];
        }

        $loads = [];
        foreach ($available as $doctor) {
            $loads[$doctor] = $this->countDoctorLoad($store, $date, $doctor);
        }

        asort($loads, SORT_NUMERIC);
        $minLoad = (int) reset($loads);
        $top = [];
        foreach ($loads as $doctor => $load) {
            if ((int) $load === $minLoad) {
                $top[] = (string) $doctor;
            }
        }

        $selected = $top[0];
        if (count($top) > 1) {
            $cursor = strtolower(trim((string) (($store['meta']['indiferenteCursor'] ?? 'rosero'))));
            if (!in_array($cursor, ['rosero', 'narvaez'], true)) {
                $cursor = 'rosero';
            }
            $selected = in_array($cursor, $top, true) ? $cursor : $top[0];
        }

        Metrics::increment('booking_assignment_total', [
            'doctor' => $selected,
            'mode' => 'indiferente_least_load',
        ]);

        return [
            'ok' => true,
            'doctor' => $selected,
            'durationMin' => $this->getDurationMin($service),
            'loads' => $loads,
            'availableDoctors' => $available,
        ];
    }

    public function createCalendarEvent(array $appointment, string $doctor): array
    {
        if (!$this->isGoogleActive()) {
            return [
                'ok' => true,
                'provider' => '',
                'calendarId' => '',
                'eventId' => '',
                'durationMin' => $this->getDurationMin((string) ($appointment['service'] ?? 'consulta')),
            ];
        }

        $client = $this->availabilityService->getClient();
        $calendarId = $client->getCalendarIdForDoctor($doctor);
        if ($calendarId === '') {
            return [
                'ok' => false,
                'status' => 503,
                'code' => 'calendar_not_configured',
                'error' => 'No hay calendario configurado para el doctor',
            ];
        }

        $service = (string) ($appointment['service'] ?? 'consulta');
        $durationMin = $this->getDurationMin($service);
        $timezone = $client->getTimezone();
        $startIso = $this->toIso((string) ($appointment['date'] ?? ''), (string) ($appointment['time'] ?? ''), $timezone);
        $endIso = $this->toIso((string) ($appointment['date'] ?? ''), (string) ($appointment['time'] ?? ''), $timezone, $durationMin);
        if ($startIso === '' || $endIso === '') {
            return [
                'ok' => false,
                'status' => 400,
                'code' => 'calendar_bad_request',
                'error' => 'Fecha u hora inválidas para evento de calendario',
            ];
        }

        $summary = 'Piel en Armonía - ' . get_service_label($service);
        $description = $this->buildEventDescription($appointment, $doctor, $durationMin);
        $payload = [
            'summary' => $summary,
            'description' => $description,
            'start' => [
                'dateTime' => $startIso,
                'timeZone' => $timezone,
            ],
            'end' => [
                'dateTime' => $endIso,
                'timeZone' => $timezone,
            ],
            'location' => 'Piel en Armonía, Valparaiso 13-183 y Sodiro, Quito, Ecuador',
            'extendedProperties' => [
                'private' => [
                    'site' => 'pielarmonia.com',
                    'appointment_id' => (string) ($appointment['id'] ?? ''),
                    'service' => $service,
                    'doctor' => $doctor,
                    'email' => (string) ($appointment['email'] ?? ''),
                    'phone' => (string) ($appointment['phone'] ?? ''),
                ],
            ],
        ];

        $response = $client->createEvent($calendarId, $payload);
        if (($response['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'status' => (int) ($response['status'] ?? 503),
                'code' => (string) ($response['code'] ?? 'calendar_unreachable'),
                'error' => (string) ($response['error'] ?? 'No se pudo crear evento en Google Calendar'),
            ];
        }

        $event = is_array($response['data'] ?? null) ? $response['data'] : [];
        return [
            'ok' => true,
            'provider' => 'google',
            'calendarId' => $calendarId,
            'eventId' => (string) ($event['id'] ?? ''),
            'eventHtmlLink' => (string) ($event['htmlLink'] ?? ''),
            'durationMin' => $durationMin,
        ];
    }

    public function patchCalendarEvent(array $appointment, string $newDate, string $newTime, ?string $doctorOverride = null): array
    {
        if (!$this->isGoogleActive()) {
            return ['ok' => true];
        }

        $doctor = strtolower(trim((string) ($doctorOverride ?? ($appointment['doctor'] ?? ''))));
        $service = (string) ($appointment['service'] ?? 'consulta');
        $calendarId = trim((string) ($appointment['calendarId'] ?? ''));
        $eventId = trim((string) ($appointment['calendarEventId'] ?? ''));

        if ($calendarId === '') {
            $calendarId = $this->availabilityService->getClient()->getCalendarIdForDoctor($doctor);
        }

        if ($calendarId === '' || $eventId === '') {
            return [
                'ok' => false,
                'status' => 400,
                'code' => 'calendar_bad_request',
                'error' => 'La cita no tiene referencia de evento en Google Calendar',
            ];
        }

        $durationMin = $this->getDurationMin($service);
        $timezone = $this->availabilityService->getClient()->getTimezone();
        $startIso = $this->toIso($newDate, $newTime, $timezone);
        $endIso = $this->toIso($newDate, $newTime, $timezone, $durationMin);

        $payload = [
            'start' => [
                'dateTime' => $startIso,
                'timeZone' => $timezone,
            ],
            'end' => [
                'dateTime' => $endIso,
                'timeZone' => $timezone,
            ],
        ];

        $response = $this->availabilityService->getClient()->patchEvent($calendarId, $eventId, $payload);
        if (($response['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'status' => (int) ($response['status'] ?? 503),
                'code' => (string) ($response['code'] ?? 'calendar_unreachable'),
                'error' => (string) ($response['error'] ?? 'No se pudo reprogramar el evento en Google Calendar'),
            ];
        }

        return ['ok' => true];
    }

    public function cancelCalendarEvent(array $appointment): array
    {
        if (!$this->isGoogleActive()) {
            return ['ok' => true];
        }

        $calendarId = trim((string) ($appointment['calendarId'] ?? ''));
        $eventId = trim((string) ($appointment['calendarEventId'] ?? ''));
        if ($calendarId === '' || $eventId === '') {
            return ['ok' => true];
        }

        $response = $this->availabilityService->getClient()->deleteEvent($calendarId, $eventId);
        if (($response['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'status' => (int) ($response['status'] ?? 503),
                'code' => (string) ($response['code'] ?? 'calendar_unreachable'),
                'error' => (string) ($response['error'] ?? 'No se pudo cancelar el evento en Google Calendar'),
            ];
        }

        return ['ok' => true];
    }

    public function advanceIndiferenteCursor(array &$store, string $selectedDoctor): void
    {
        if (!isset($store['meta']) || !is_array($store['meta'])) {
            $store['meta'] = [];
        }
        $selectedDoctor = strtolower(trim($selectedDoctor));
        $store['meta']['indiferenteCursor'] = $selectedDoctor === 'rosero' ? 'narvaez' : 'rosero';
    }

    public static function withSlotLock(string $date, string $time, callable $callback, int $timeoutMs = 1800): array
    {
        $normalizedDate = preg_replace('/[^0-9\-]/', '', $date);
        $normalizedTime = preg_replace('/[^0-9]/', '', $time);
        if ($normalizedDate === '' || $normalizedTime === '') {
            return [
                'ok' => false,
                'status' => 400,
                'code' => 'slot_lock_invalid',
                'error' => 'Fecha/hora inválida para lock',
            ];
        }

        $lockDir = data_dir_path() . DIRECTORY_SEPARATOR . 'locks';
        if (!is_dir($lockDir)) {
            @mkdir($lockDir, 0775, true);
        }
        $lockPath = $lockDir . DIRECTORY_SEPARATOR . 'booking-' . $normalizedDate . '-' . $normalizedTime . '.lock';
        $fp = @fopen($lockPath, 'c+');
        if (!is_resource($fp)) {
            return [
                'ok' => false,
                'status' => 503,
                'code' => 'slot_lock_failed',
                'error' => 'No se pudo crear lock de agenda',
            ];
        }

        $deadline = microtime(true) + ((float) $timeoutMs / 1000.0);
        $locked = false;
        while (microtime(true) < $deadline) {
            if (@flock($fp, LOCK_EX | LOCK_NB)) {
                $locked = true;
                break;
            }
            usleep(25000);
        }

        if (!$locked) {
            fclose($fp);
            return [
                'ok' => false,
                'status' => 409,
                'code' => 'slot_locked',
                'error' => 'Otro proceso está reservando ese horario. Intenta de nuevo.',
            ];
        }

        try {
            $result = $callback();
            return [
                'ok' => true,
                'result' => $result,
            ];
        } catch (Throwable $e) {
            return [
                'ok' => false,
                'status' => 500,
                'code' => 'slot_lock_callback_failed',
                'error' => $e->getMessage(),
            ];
        } finally {
            @flock($fp, LOCK_UN);
            @fclose($fp);
        }
    }

    private function countDoctorLoad(array $store, string $date, string $doctor): int
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $count = 0;
        foreach ($appointments as $appointment) {
            if ((string) ($appointment['date'] ?? '') !== $date) {
                continue;
            }
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status === 'cancelled') {
                continue;
            }
            if (strtolower((string) ($appointment['doctor'] ?? '')) === $doctor) {
                $count++;
            }
        }
        return $count;
    }

    private function toIso(string $date, string $time, string $timezone, int $plusMin = 0): string
    {
        try {
            $tz = new DateTimeZone($timezone);
            $dt = new DateTime(trim($date) . ' ' . trim($time) . ':00', $tz);
            if ($plusMin !== 0) {
                $dt->modify(($plusMin > 0 ? '+' : '') . $plusMin . ' minutes');
            }
            return $dt->format(DateTimeInterface::ATOM);
        } catch (Throwable $e) {
            return '';
        }
    }

    private function buildEventDescription(array $appointment, string $doctor, int $durationMin): string
    {
        $lines = [];
        $lines[] = 'Cita agendada desde pielarmonia.com';
        $lines[] = 'Paciente: ' . (string) ($appointment['name'] ?? '');
        $lines[] = 'Email: ' . (string) ($appointment['email'] ?? '');
        $lines[] = 'Teléfono: ' . (string) ($appointment['phone'] ?? '');
        $lines[] = 'Servicio: ' . get_service_label((string) ($appointment['service'] ?? ''));
        $lines[] = 'Doctor: ' . get_doctor_label($doctor);
        $lines[] = 'Duración: ' . $durationMin . ' min';
        $reason = trim((string) ($appointment['reason'] ?? ''));
        if ($reason !== '') {
            $lines[] = 'Motivo: ' . $reason;
        }
        return implode("\n", $lines);
    }
}
