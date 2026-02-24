<?php

declare(strict_types=1);

if (!class_exists('GoogleTokenProvider') && !class_exists('CompatGoogleTokenProvider')) {
    class CompatGoogleTokenProvider
    {
        public static function fromEnv()
        {
            return new self();
        }

        public static function readStatusSnapshot(): array
        {
            return [
                'lastSuccessAt' => '',
                'lastErrorAt' => '',
                'lastErrorReason' => '',
                'expiresAt' => 0,
            ];
        }

        public function isConfigured(): bool
        {
            return false;
        }

        public function getAuthMode(): string
        {
            return 'none';
        }
    }

    class_alias('CompatGoogleTokenProvider', 'GoogleTokenProvider');
}

if (!class_exists('GoogleCalendarClient') && !class_exists('CompatGoogleCalendarClient')) {
    class CompatGoogleCalendarClient
    {
        public static function fromEnv()
        {
            return new self();
        }

        public static function readStatusSnapshot(): array
        {
            return [
                'lastSuccessAt' => '',
                'lastErrorAt' => '',
                'lastErrorReason' => '',
            ];
        }

        public function isConfigured(): bool
        {
            return false;
        }

        public function getAuthMode(): string
        {
            return 'none';
        }

        public function getTimezone(): string
        {
            $timezone = (string) (getenv('PIELARMONIA_CALENDAR_TIMEZONE') ?: 'America/Guayaquil');
            return trim($timezone) !== '' ? trim($timezone) : 'America/Guayaquil';
        }

        public function getCalendarIdForDoctor(string $doctor): string
        {
            $normalizedDoctor = strtolower(trim($doctor));
            if ($normalizedDoctor === 'rosero') {
                return (string) (getenv('PIELARMONIA_GOOGLE_CALENDAR_ID_ROSERO') ?: '');
            }
            if ($normalizedDoctor === 'narvaez') {
                return (string) (getenv('PIELARMONIA_GOOGLE_CALENDAR_ID_NARVAEZ') ?: '');
            }
            return '';
        }
    }

    class_alias('CompatGoogleCalendarClient', 'GoogleCalendarClient');
}

if (!class_exists('CalendarAvailabilityService') && !class_exists('CompatCalendarAvailabilityService')) {
    class CompatCalendarAvailabilityService
    {
        private $client;
        private $timezone;
        private $durationMap;
        private $blockOnFailure;

        public function __construct($client, string $timezone, array $durationMap, bool $blockOnFailure)
        {
            $this->client = $client;
            $this->timezone = $timezone;
            $this->durationMap = $durationMap;
            $this->blockOnFailure = $blockOnFailure;
        }

        public static function fromEnv()
        {
            $client = GoogleCalendarClient::fromEnv();
            $timezone = (string) (getenv('PIELARMONIA_CALENDAR_TIMEZONE') ?: 'America/Guayaquil');
            $map = self::resolveDurationMap((string) (getenv('PIELARMONIA_SERVICE_DURATION_MAP') ?: ''));
            $block = strtolower(trim((string) (getenv('PIELARMONIA_CALENDAR_BLOCK_ON_FAILURE') ?: 'false'))) === 'true';

            return new self($client, $timezone, $map, $block);
        }

        public function getClient()
        {
            return $this->client;
        }

        public function getBlockOnFailure(): bool
        {
            return $this->blockOnFailure;
        }

        public function getDurationMin(string $service): int
        {
            $key = strtolower(trim($service));
            if ($key === '') {
                $key = 'consulta';
            }
            if (isset($this->durationMap[$key]) && (int) $this->durationMap[$key] > 0) {
                return (int) $this->durationMap[$key];
            }
            return 30;
        }

        public function isGoogleActive(): bool
        {
            return false;
        }

        public function getAvailability(array $store, array $options = []): array
        {
            $doctor = strtolower(trim((string) ($options['doctor'] ?? 'indiferente')));
            if ($doctor === '') {
                $doctor = 'indiferente';
            }
            $service = strtolower(trim((string) ($options['service'] ?? 'consulta')));
            if ($service === '') {
                $service = 'consulta';
            }
            $dateFrom = trim((string) ($options['dateFrom'] ?? local_date('Y-m-d')));
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
                $dateFrom = local_date('Y-m-d');
            }
            $days = (int) ($options['days'] ?? 21);
            if ($days < 1) {
                $days = 1;
            }
            if ($days > 45) {
                $days = 45;
            }

            $availability = [];
            if (isset($store['availability']) && is_array($store['availability'])) {
                $availability = $store['availability'];
            }
            if ($availability === [] && function_exists('default_availability_enabled') && default_availability_enabled() && function_exists('get_default_availability')) {
                $availability = get_default_availability(max(21, $days));
            }

            $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
            $durationMin = $this->getDurationMin($service);
            $result = [];

            for ($offset = 0; $offset < $days; $offset++) {
                $date = date('Y-m-d', strtotime($dateFrom . ' +' . $offset . ' day'));
                if (!is_string($date) || $date === '' || !isset($availability[$date]) || !is_array($availability[$date])) {
                    continue;
                }

                $slots = [];
                foreach ($availability[$date] as $candidateSlot) {
                    $slot = trim((string) $candidateSlot);
                    if (!preg_match('/^\d{2}:\d{2}$/', $slot)) {
                        continue;
                    }
                    if ($this->isSlotTaken($appointments, $date, $slot, $doctor)) {
                        continue;
                    }
                    $slots[] = $slot;
                }

                sort($slots, SORT_STRING);
                $slots = array_values(array_unique($slots));
                if ($durationMin >= 60) {
                    $slots = $this->filterSixtyMinuteSlots($slots);
                }

                if ($slots !== []) {
                    $result[$date] = $slots;
                }
            }

            return [
                'ok' => true,
                'data' => $result,
                'meta' => $this->buildMeta($doctor, $service, $durationMin, 'store', 'live'),
            ];
        }

        public function getBookedSlots(array $store, string $date, string $doctor, string $service = 'consulta'): array
        {
            $doctor = strtolower(trim($doctor));
            if ($doctor === '') {
                $doctor = 'indiferente';
            }

            $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
            $booked = [];
            foreach ($appointments as $appointment) {
                if (!is_array($appointment)) {
                    continue;
                }
                if ((string) ($appointment['date'] ?? '') !== $date) {
                    continue;
                }
                $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
                if ($status === 'cancelled') {
                    continue;
                }
                $appointmentDoctor = strtolower(trim((string) ($appointment['doctor'] ?? ($appointment['doctorAssigned'] ?? ''))));
                if ($doctor !== 'indiferente' && $appointmentDoctor !== $doctor) {
                    continue;
                }
                $time = trim((string) ($appointment['time'] ?? ''));
                if (preg_match('/^\d{2}:\d{2}$/', $time)) {
                    $booked[$time] = true;
                }
            }

            $slots = array_keys($booked);
            sort($slots, SORT_STRING);
            return [
                'ok' => true,
                'data' => $slots,
                'meta' => $this->buildMeta($doctor, strtolower(trim($service)) ?: 'consulta', $this->getDurationMin($service), 'store', 'live'),
            ];
        }

        public function isSlotAvailable(array $store, string $date, string $time, string $doctor, string $service, bool $strict = false): array
        {
            $availability = $this->getAvailability($store, [
                'doctor' => $doctor,
                'service' => $service,
                'dateFrom' => $date,
                'days' => 1,
            ]);
            if (($availability['ok'] ?? false) !== true) {
                return [
                    'ok' => false,
                    'status' => 503,
                    'code' => 'calendar_unreachable',
                    'error' => 'Agenda temporalmente no disponible',
                    'meta' => isset($availability['meta']) && is_array($availability['meta']) ? $availability['meta'] : [],
                ];
            }

            $slots = isset($availability['data'][$date]) && is_array($availability['data'][$date]) ? $availability['data'][$date] : [];
            if (in_array($time, $slots, true)) {
                return [
                    'ok' => true,
                    'status' => 200,
                    'meta' => isset($availability['meta']) && is_array($availability['meta']) ? $availability['meta'] : [],
                ];
            }

            return [
                'ok' => false,
                'status' => $strict ? 409 : 400,
                'code' => 'slot_unavailable',
                'error' => 'Ese horario no esta disponible',
                'meta' => isset($availability['meta']) && is_array($availability['meta']) ? $availability['meta'] : [],
            ];
        }

        private function isSlotTaken(array $appointments, string $date, string $time, string $doctor): bool
        {
            $normalizedDoctor = strtolower(trim($doctor));
            if ($normalizedDoctor === '' || $normalizedDoctor === 'indiferente') {
                return appointment_slot_taken($appointments, $date, $time, null, '');
            }
            return appointment_slot_taken($appointments, $date, $time, null, $normalizedDoctor);
        }

        private function filterSixtyMinuteSlots(array $slots): array
        {
            if ($slots === []) {
                return [];
            }

            $set = array_fill_keys($slots, true);
            $valid = [];
            foreach ($slots as $slot) {
                $next = date('H:i', strtotime($slot . ' +30 minutes'));
                if (isset($set[$next])) {
                    $valid[] = $slot;
                }
            }
            return array_values(array_unique($valid));
        }

        private function buildMeta(string $doctor, string $service, int $durationMin, string $source, string $mode): array
        {
            return [
                'source' => $source,
                'mode' => $mode,
                'timezone' => $this->timezone,
                'doctor' => $doctor,
                'service' => $service,
                'durationMin' => $durationMin,
                'generatedAt' => local_date('c'),
            ];
        }

        private static function resolveDurationMap(string $raw): array
        {
            $defaults = [
                'consulta' => 30,
                'telefono' => 30,
                'video' => 30,
                'acne' => 30,
                'cancer' => 30,
                'laser' => 60,
                'rejuvenecimiento' => 60,
            ];

            $raw = trim($raw);
            if ($raw === '') {
                return $defaults;
            }

            $map = $defaults;
            $parts = explode(',', $raw);
            foreach ($parts as $part) {
                $entry = trim((string) $part);
                if ($entry === '' || strpos($entry, ':') === false) {
                    continue;
                }
                list($service, $minutesRaw) = array_map('trim', explode(':', $entry, 2));
                $service = strtolower($service);
                $minutes = (int) $minutesRaw;
                if ($service === '' || $minutes <= 0) {
                    continue;
                }
                $map[$service] = $minutes;
            }
            return $map;
        }
    }

    class_alias('CompatCalendarAvailabilityService', 'CalendarAvailabilityService');
}

if (!class_exists('CalendarBookingService') && !class_exists('CompatCalendarBookingService')) {
    class CompatCalendarBookingService
    {
        private $availabilityService;

        public function __construct($availabilityService)
        {
            $this->availabilityService = $availabilityService;
        }

        public static function fromEnv()
        {
            return new self(CalendarAvailabilityService::fromEnv());
        }

        public function getDurationMin(string $service): int
        {
            return $this->availabilityService->getDurationMin($service);
        }

        public function isGoogleActive(): bool
        {
            return false;
        }

        public function ensureSlotAvailable(array $store, string $date, string $time, string $doctor, string $service): array
        {
            $check = $this->availabilityService->isSlotAvailable($store, $date, $time, $doctor, $service, true);
            if (($check['ok'] ?? false) === true) {
                return [
                    'ok' => true,
                    'status' => 200,
                    'doctor' => $doctor,
                    'durationMin' => $this->getDurationMin($service),
                    'meta' => isset($check['meta']) && is_array($check['meta']) ? $check['meta'] : [],
                ];
            }

            return [
                'ok' => false,
                'status' => (int) ($check['status'] ?? 409),
                'code' => (string) ($check['code'] ?? 'slot_unavailable'),
                'error' => (string) ($check['error'] ?? 'Ese horario no esta disponible'),
                'meta' => isset($check['meta']) && is_array($check['meta']) ? $check['meta'] : [],
            ];
        }

        public function assignDoctorForIndiferente(array $store, string $date, string $time, string $service): array
        {
            $candidates = ['rosero', 'narvaez'];
            foreach ($candidates as $doctor) {
                $slot = $this->ensureSlotAvailable($store, $date, $time, $doctor, $service);
                if (($slot['ok'] ?? false) === true) {
                    return [
                        'ok' => true,
                        'doctor' => $doctor,
                        'durationMin' => $this->getDurationMin($service),
                        'availableDoctors' => $candidates,
                    ];
                }
            }

            return [
                'ok' => false,
                'status' => 409,
                'code' => 'slot_unavailable',
                'error' => 'Ese horario no esta disponible',
            ];
        }

        public function createCalendarEvent(array $appointment, string $doctor): array
        {
            return [
                'ok' => true,
                'provider' => '',
                'calendarId' => '',
                'eventId' => '',
                'durationMin' => $this->getDurationMin((string) ($appointment['service'] ?? 'consulta')),
            ];
        }

        public function patchCalendarEvent(array $appointment, string $newDate, string $newTime, ?string $doctorOverride = null): array
        {
            return ['ok' => true];
        }

        public function cancelCalendarEvent(array $appointment): array
        {
            return ['ok' => true];
        }

        public static function withSlotLock(string $date, string $time, callable $callback, int $timeoutMs = 1800): array
        {
            try {
                $result = $callback();
                return [
                    'ok' => true,
                    'status' => 200,
                    'result' => $result,
                ];
            } catch (Throwable $e) {
                return [
                    'ok' => false,
                    'status' => 409,
                    'code' => 'slot_lock_failed',
                    'error' => 'No se pudo reservar ese horario en este momento',
                ];
            }
        }
    }

    class_alias('CompatCalendarBookingService', 'CalendarBookingService');
}
