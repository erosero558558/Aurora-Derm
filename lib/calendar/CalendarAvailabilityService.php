<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

class CalendarAvailabilityService
{
    private GoogleCalendarClient $client;
    private string $source;
    private bool $blockOnFailure;
    private string $timezone;
    private int $slotStepMin;
    private array $durationMap;
    private int $maxDays;

    public function __construct(
        GoogleCalendarClient $client,
        string $source,
        bool $blockOnFailure,
        string $timezone,
        int $slotStepMin,
        array $durationMap,
        int $maxDays = 45
    ) {
        $this->client = $client;
        $this->source = $source;
        $this->blockOnFailure = $blockOnFailure;
        $this->timezone = $timezone !== '' ? $timezone : APP_TIMEZONE;
        $this->slotStepMin = max(15, min(60, $slotStepMin));
        $this->durationMap = $durationMap;
        $this->maxDays = max(1, min(90, $maxDays));
    }

    public static function fromEnv(): self
    {
        $source = strtolower(trim((string) (getenv('PIELARMONIA_AVAILABILITY_SOURCE') ?: 'store')));
        if (!in_array($source, ['store', 'google'], true)) {
            $source = 'store';
        }

        $blockOnFailure = self::parseBool((string) (getenv('PIELARMONIA_CALENDAR_BLOCK_ON_FAILURE') ?: 'true'));
        $timezone = (string) (getenv('PIELARMONIA_CALENDAR_TIMEZONE') ?: APP_TIMEZONE);
        $slotStepMin = (int) (getenv('PIELARMONIA_CALENDAR_SLOT_STEP_MIN') ?: 30);
        $durationMap = self::parseDurationMap(
            (string) (getenv('PIELARMONIA_SERVICE_DURATION_MAP') ?: 'consulta:30,telefono:30,video:30,acne:30,cancer:30,laser:60,rejuvenecimiento:60')
        );

        return new self(
            GoogleCalendarClient::fromEnv(),
            $source,
            $blockOnFailure,
            $timezone,
            $slotStepMin,
            $durationMap,
            45
        );
    }

    public function getSource(): string
    {
        return $this->source;
    }

    public function getBlockOnFailure(): bool
    {
        return $this->blockOnFailure;
    }

    public function getDurationMin(string $service): int
    {
        $service = strtolower(trim($service));
        if ($service === '') {
            return 30;
        }
        $duration = (int) ($this->durationMap[$service] ?? 30);
        if ($duration < $this->slotStepMin) {
            $duration = $this->slotStepMin;
        }
        if (($duration % $this->slotStepMin) !== 0) {
            $duration = (int) (ceil($duration / $this->slotStepMin) * $this->slotStepMin);
        }
        return $duration;
    }

    public function isGoogleActive(): bool
    {
        return $this->source === 'google';
    }

    public function getDoctorCalendarMapMasked(): array
    {
        $map = $this->client->getDoctorCalendarMap();
        $masked = [];
        foreach ($map as $doctor => $calendarId) {
            $id = trim((string) $calendarId);
            if ($id === '') {
                $masked[$doctor] = '';
                continue;
            }
            $masked[$doctor] = strlen($id) <= 8
                ? '***'
                : substr($id, 0, 4) . '***' . substr($id, -4);
        }
        return $masked;
    }

    public function getAvailability(array $store, array $options = []): array
    {
        $doctor = strtolower(trim((string) ($options['doctor'] ?? 'indiferente')));
        if (!in_array($doctor, ['rosero', 'narvaez', 'indiferente'], true)) {
            $doctor = 'indiferente';
        }

        $service = strtolower(trim((string) ($options['service'] ?? 'consulta')));
        $durationMin = $this->getDurationMin($service);

        $dateFrom = trim((string) ($options['dateFrom'] ?? local_date('Y-m-d')));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
            $dateFrom = local_date('Y-m-d');
        }

        $days = (int) ($options['days'] ?? 21);
        $days = max(1, min($days, $this->maxDays));
        $fresh = isset($options['fresh']) && $options['fresh'] === true;

        $meta = $this->buildMeta($doctor, $service, $durationMin, 'store', 'live');

        $template = $this->buildTemplateSlots($store, $dateFrom, $days);
        $durationFilteredTemplate = $this->applyDurationFilterToTemplate($template, $durationMin);
        if (!$this->isGoogleActive()) {
            $this->recordModeMetric('store', 'live');
            return [
                'ok' => true,
                'data' => $durationFilteredTemplate,
                'meta' => array_merge($meta, ['source' => 'store']),
            ];
        }

        if (!$this->client->isConfigured()) {
            if ($this->blockOnFailure) {
                $this->recordModeMetric('google', 'blocked');
                return [
                    'ok' => false,
                    'status' => 503,
                    'code' => 'calendar_unreachable',
                    'error' => 'Google Calendar no está configurado',
                    'meta' => array_merge($meta, ['source' => 'google', 'mode' => 'blocked']),
                ];
            }
            $this->recordModeMetric('fallback', 'live');
            return [
                'ok' => true,
                'data' => $durationFilteredTemplate,
                'meta' => array_merge($meta, ['source' => 'fallback', 'mode' => 'live', 'degraded' => true]),
            ];
        }

        $dateTo = $this->addDays($dateFrom, $days);
        $calendarIds = $this->resolveCalendarIdsForDoctor($doctor);
        $rangeStartIso = $this->toIsoStart($dateFrom);
        $rangeEndIso = $this->toIsoStart($dateTo);

        $freeBusy = $this->client->freeBusy($calendarIds, $rangeStartIso, $rangeEndIso, $fresh);
        if (($freeBusy['ok'] ?? false) !== true) {
            if ($this->blockOnFailure) {
                $this->recordModeMetric('google', 'blocked');
                return [
                    'ok' => false,
                    'status' => 503,
                    'code' => 'calendar_unreachable',
                    'error' => 'No se pudo consultar la agenda real',
                    'meta' => array_merge($meta, ['source' => 'google', 'mode' => 'blocked']),
                ];
            }
            $this->recordModeMetric('fallback', 'live');
            return [
                'ok' => true,
                'data' => $durationFilteredTemplate,
                'meta' => array_merge($meta, ['source' => 'fallback', 'mode' => 'live', 'degraded' => true]),
            ];
        }

        $busyByCalendar = $this->extractBusyRangesByCalendar($freeBusy['data'] ?? []);
        $result = [];

        foreach ($template as $date => $slots) {
            $slotLookup = array_fill_keys($slots, true);
            $availableSlots = [];
            foreach ($slots as $slot) {
                if (!$this->supportsDurationFromTemplate($date, $slot, $durationMin, $slotLookup)) {
                    continue;
                }
                if ($this->isSlotAvailableForDoctor($doctor, $date, $slot, $durationMin, $busyByCalendar)) {
                    $availableSlots[] = $slot;
                }
            }

            if (count($availableSlots) > 0) {
                $result[$date] = $availableSlots;
            }
        }

        $this->recordModeMetric('google', 'live');
        return [
            'ok' => true,
            'data' => $result,
            'meta' => array_merge($meta, ['source' => 'google', 'mode' => 'live']),
        ];
    }

    public function getBookedSlots(array $store, string $date, string $doctor, string $service = 'consulta'): array
    {
        $date = trim($date);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            $this->recordModeMetric('store', 'live');
            return [
                'ok' => false,
                'status' => 400,
                'code' => 'calendar_bad_request',
                'error' => 'Fecha inválida',
                'meta' => $this->buildMeta($doctor, $service, $this->getDurationMin($service), 'store', 'live'),
            ];
        }

        $doctor = strtolower(trim($doctor));
        if (!in_array($doctor, ['rosero', 'narvaez', 'indiferente', ''], true)) {
            $doctor = '';
        }
        if ($doctor === '') {
            $doctor = 'indiferente';
        }

        $durationMin = $this->getDurationMin($service);
        $meta = $this->buildMeta($doctor, $service, $durationMin, 'store', 'live');

        $template = $this->buildTemplateSlots($store, $date, 1);
        $slots = isset($template[$date]) && is_array($template[$date]) ? $template[$date] : [];
        $slotLookup = array_fill_keys($slots, true);

        if (!$this->isGoogleActive()) {
            $this->recordModeMetric('store', 'live');
            return [
                'ok' => true,
                'data' => $this->bookedSlotsFromStore($store, $date, $doctor, $service, $slots, $slotLookup),
                'meta' => array_merge($meta, ['source' => 'store']),
            ];
        }

        if (!$this->client->isConfigured()) {
            if ($this->blockOnFailure) {
                $this->recordModeMetric('google', 'blocked');
                return [
                    'ok' => false,
                    'status' => 503,
                    'code' => 'calendar_unreachable',
                    'error' => 'Google Calendar no está configurado',
                    'meta' => array_merge($meta, ['source' => 'google', 'mode' => 'blocked']),
                ];
            }
            $this->recordModeMetric('fallback', 'live');
            return [
                'ok' => true,
                'data' => $this->bookedSlotsFromStore($store, $date, $doctor, $service, $slots, $slotLookup),
                'meta' => array_merge($meta, ['source' => 'fallback', 'mode' => 'live', 'degraded' => true]),
            ];
        }

        $calendarIds = $this->resolveCalendarIdsForDoctor($doctor);
        $fromIso = $this->toIsoStart($date);
        $toIso = $this->toIsoStart($this->addDays($date, 1));
        $freeBusy = $this->client->freeBusy($calendarIds, $fromIso, $toIso);
        if (($freeBusy['ok'] ?? false) !== true) {
            if ($this->blockOnFailure) {
                $this->recordModeMetric('google', 'blocked');
                return [
                    'ok' => false,
                    'status' => 503,
                    'code' => 'calendar_unreachable',
                    'error' => 'No se pudo consultar la agenda real',
                    'meta' => array_merge($meta, ['source' => 'google', 'mode' => 'blocked']),
                ];
            }
            $this->recordModeMetric('fallback', 'live');
            return [
                'ok' => true,
                'data' => $this->bookedSlotsFromStore($store, $date, $doctor, $service, $slots, $slotLookup),
                'meta' => array_merge($meta, ['source' => 'fallback', 'mode' => 'live', 'degraded' => true]),
            ];
        }

        $busyByCalendar = $this->extractBusyRangesByCalendar($freeBusy['data'] ?? []);
        $booked = [];
        foreach ($slots as $slot) {
            if (!$this->supportsDurationFromTemplate($date, $slot, $durationMin, $slotLookup)) {
                $booked[] = $slot;
                continue;
            }
            if (!$this->isSlotAvailableForDoctor($doctor, $date, $slot, $durationMin, $busyByCalendar)) {
                $booked[] = $slot;
            }
        }

        sort($booked, SORT_STRING);

        $this->recordModeMetric('google', 'live');
        return [
            'ok' => true,
            'data' => array_values(array_unique($booked)),
            'meta' => array_merge($meta, ['source' => 'google', 'mode' => 'live']),
        ];
    }

    public function isSlotAvailable(array $store, string $date, string $time, string $doctor, string $service, bool $fresh = false): array
    {
        $doctor = strtolower(trim($doctor));
        if ($doctor === '') {
            $doctor = 'indiferente';
        }
        $availability = $this->getAvailability($store, [
            'doctor' => $doctor,
            'service' => $service,
            'dateFrom' => $date,
            'days' => 1,
            'fresh' => $fresh,
        ]);

        if (($availability['ok'] ?? false) !== true) {
            return $availability;
        }

        $slots = isset($availability['data'][$date]) && is_array($availability['data'][$date])
            ? $availability['data'][$date]
            : [];

        return [
            'ok' => in_array($time, $slots, true),
            'data' => ['available' => in_array($time, $slots, true)],
            'meta' => $availability['meta'] ?? [],
            'status' => in_array($time, $slots, true) ? 200 : 409,
            'code' => in_array($time, $slots, true) ? 'ok' : 'slot_unavailable',
            'error' => in_array($time, $slots, true) ? '' : 'Ese horario no está disponible',
        ];
    }

    public function resolveCalendarIdsForDoctor(string $doctor): array
    {
        $doctor = strtolower(trim($doctor));
        if ($doctor === 'rosero' || $doctor === 'narvaez') {
            $id = $this->client->getCalendarIdForDoctor($doctor);
            return $id !== '' ? [$id] : [];
        }
        return array_values(array_filter([
            $this->client->getCalendarIdForDoctor('rosero'),
            $this->client->getCalendarIdForDoctor('narvaez'),
        ]));
    }

    public function getClient(): GoogleCalendarClient
    {
        return $this->client;
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

    private function recordModeMetric(string $source, string $mode): void
    {
        Metrics::increment('calendar_mode_state', [
            'source' => $source,
            'mode' => $mode,
        ]);
    }

    private static function parseBool(string $raw): bool
    {
        $raw = strtolower(trim($raw));
        return in_array($raw, ['1', 'true', 'yes', 'on'], true);
    }

    private static function parseDurationMap(string $raw): array
    {
        $map = [];
        $pairs = explode(',', $raw);
        foreach ($pairs as $pair) {
            $parts = explode(':', trim($pair), 2);
            if (count($parts) !== 2) {
                continue;
            }
            $service = strtolower(trim($parts[0]));
            $minutes = (int) trim($parts[1]);
            if ($service === '' || $minutes <= 0) {
                continue;
            }
            $map[$service] = $minutes;
        }
        if (count($map) === 0) {
            return [
                'consulta' => 30,
                'telefono' => 30,
                'video' => 30,
                'acne' => 30,
                'cancer' => 30,
                'laser' => 60,
                'rejuvenecimiento' => 60,
            ];
        }
        return $map;
    }

    private function buildTemplateSlots(array $store, string $dateFrom, int $days): array
    {
        $source = isset($store['availability']) && is_array($store['availability'])
            ? $store['availability']
            : [];

        if (count($source) === 0 && function_exists('default_availability_enabled') && default_availability_enabled() && function_exists('get_default_availability')) {
            $source = get_default_availability(max($days, 21));
        }

        $result = [];
        for ($i = 0; $i < $days; $i++) {
            $date = $this->addDays($dateFrom, $i);
            $slots = isset($source[$date]) && is_array($source[$date]) ? $source[$date] : [];
            $normalized = [];
            foreach ($slots as $slot) {
                $slot = trim((string) $slot);
                if (!preg_match('/^\d{2}:\d{2}$/', $slot)) {
                    continue;
                }
                $normalized[$slot] = true;
            }
            $slots = array_keys($normalized);
            sort($slots, SORT_STRING);
            if (count($slots) > 0) {
                $result[$date] = $slots;
            }
        }
        return $result;
    }

    private function bookedSlotsFromStore(
        array $store,
        string $date,
        string $doctor,
        string $service,
        array $templateSlots,
        array $slotLookup
    ): array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $busyRanges = [];

        foreach ($appointments as $appointment) {
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status === 'cancelled') {
                continue;
            }
            if ((string) ($appointment['date'] ?? '') !== $date) {
                continue;
            }
            if ($doctor !== '' && $doctor !== 'indiferente') {
                $apptDoctor = (string) ($appointment['doctor'] ?? '');
                if ($apptDoctor !== '' && $apptDoctor !== 'indiferente' && $apptDoctor !== $doctor) {
                    continue;
                }
            }

            $time = trim((string) ($appointment['time'] ?? ''));
            if (!preg_match('/^\d{2}:\d{2}$/', $time)) {
                continue;
            }

            $startTs = $this->dateTimeToTimestamp($date, $time);
            if ($startTs <= 0) {
                continue;
            }

            $appointmentDuration = (int) ($appointment['slotDurationMin'] ?? 0);
            if ($appointmentDuration <= 0) {
                $appointmentDuration = $this->getDurationMin((string) ($appointment['service'] ?? 'consulta'));
            }
            $busyRanges[] = [
                'start' => $startTs,
                'end' => $startTs + ($appointmentDuration * 60),
            ];
        }

        $requestedDuration = $this->getDurationMin($service);
        $booked = [];
        foreach ($templateSlots as $slot) {
            $slotTime = trim((string) $slot);
            if (!preg_match('/^\d{2}:\d{2}$/', $slotTime)) {
                continue;
            }

            if (!$this->supportsDurationFromTemplate($date, $slotTime, $requestedDuration, $slotLookup)) {
                $booked[] = $slotTime;
                continue;
            }

            $candidateStart = $this->dateTimeToTimestamp($date, $slotTime);
            if ($candidateStart <= 0) {
                $booked[] = $slotTime;
                continue;
            }
            $candidateEnd = $candidateStart + ($requestedDuration * 60);

            foreach ($busyRanges as $range) {
                $busyStart = (int) ($range['start'] ?? 0);
                $busyEnd = (int) ($range['end'] ?? 0);
                if ($busyStart <= 0 || $busyEnd <= 0) {
                    continue;
                }
                if ($candidateStart < $busyEnd && $busyStart < $candidateEnd) {
                    $booked[] = $slotTime;
                    break;
                }
            }
        }

        $booked = array_values(array_unique($booked));
        sort($booked, SORT_STRING);
        return $booked;
    }

    private function applyDurationFilterToTemplate(array $template, int $durationMin): array
    {
        if ($durationMin <= $this->slotStepMin) {
            return $template;
        }

        $result = [];
        foreach ($template as $date => $slots) {
            if (!is_array($slots) || count($slots) === 0) {
                continue;
            }
            $lookup = array_fill_keys($slots, true);
            $available = [];
            foreach ($slots as $slot) {
                if ($this->supportsDurationFromTemplate((string) $date, (string) $slot, $durationMin, $lookup)) {
                    $available[] = (string) $slot;
                }
            }
            if (count($available) > 0) {
                $result[(string) $date] = $available;
            }
        }
        return $result;
    }

    private function addDays(string $date, int $days): string
    {
        $tz = new DateTimeZone($this->timezone);
        $dt = new DateTime($date . ' 00:00:00', $tz);
        if ($days !== 0) {
            $dt->modify(($days > 0 ? '+' : '') . $days . ' day');
        }
        return $dt->format('Y-m-d');
    }

    private function toIsoStart(string $date): string
    {
        $tz = new DateTimeZone($this->timezone);
        $dt = new DateTime($date . ' 00:00:00', $tz);
        return $dt->format(DateTimeInterface::ATOM);
    }

    private function extractBusyRangesByCalendar(array $freeBusyPayload): array
    {
        $result = [];
        $calendars = isset($freeBusyPayload['calendars']) && is_array($freeBusyPayload['calendars'])
            ? $freeBusyPayload['calendars']
            : [];
        foreach ($calendars as $calendarId => $calendarData) {
            $busyItems = isset($calendarData['busy']) && is_array($calendarData['busy']) ? $calendarData['busy'] : [];
            $ranges = [];
            foreach ($busyItems as $busy) {
                $start = isset($busy['start']) ? trim((string) $busy['start']) : '';
                $end = isset($busy['end']) ? trim((string) $busy['end']) : '';
                if ($start === '' || $end === '') {
                    continue;
                }
                try {
                    $startDt = new DateTime($start);
                    $endDt = new DateTime($end);
                } catch (Throwable $e) {
                    continue;
                }
                $ranges[] = [
                    'start' => $startDt->getTimestamp(),
                    'end' => $endDt->getTimestamp(),
                ];
            }
            $result[(string) $calendarId] = $ranges;
        }
        return $result;
    }

    private function supportsDurationFromTemplate(string $date, string $slot, int $durationMin, array $slotLookup): bool
    {
        $parts = (int) max(1, $durationMin / $this->slotStepMin);
        if ($parts === 1) {
            return true;
        }
        for ($i = 1; $i < $parts; $i++) {
            $next = $this->addMinutesToTime($slot, $i * $this->slotStepMin);
            if (!isset($slotLookup[$next])) {
                return false;
            }
        }
        return true;
    }

    private function isSlotAvailableForDoctor(
        string $doctor,
        string $date,
        string $slot,
        int $durationMin,
        array $busyByCalendar
    ): bool {
        if ($doctor === 'rosero' || $doctor === 'narvaez') {
            $calendarId = $this->client->getCalendarIdForDoctor($doctor);
            return $calendarId !== '' && !$this->slotOverlapsBusy($date, $slot, $durationMin, $busyByCalendar[(string) $calendarId] ?? []);
        }

        $roseroCalendar = $this->client->getCalendarIdForDoctor('rosero');
        $narvaezCalendar = $this->client->getCalendarIdForDoctor('narvaez');
        $roseroFree = $roseroCalendar !== ''
            && !$this->slotOverlapsBusy($date, $slot, $durationMin, $busyByCalendar[(string) $roseroCalendar] ?? []);
        $narvaezFree = $narvaezCalendar !== ''
            && !$this->slotOverlapsBusy($date, $slot, $durationMin, $busyByCalendar[(string) $narvaezCalendar] ?? []);
        return $roseroFree || $narvaezFree;
    }

    private function slotOverlapsBusy(string $date, string $slot, int $durationMin, array $busyRanges): bool
    {
        $startTs = $this->dateTimeToTimestamp($date, $slot);
        if ($startTs <= 0) {
            return true;
        }
        $endTs = $startTs + ($durationMin * 60);

        foreach ($busyRanges as $range) {
            $busyStart = (int) ($range['start'] ?? 0);
            $busyEnd = (int) ($range['end'] ?? 0);
            if ($busyStart <= 0 || $busyEnd <= 0) {
                continue;
            }
            if ($startTs < $busyEnd && $busyStart < $endTs) {
                return true;
            }
        }
        return false;
    }

    private function dateTimeToTimestamp(string $date, string $time): int
    {
        try {
            $tz = new DateTimeZone($this->timezone);
            $dt = new DateTime($date . ' ' . $time . ':00', $tz);
            return $dt->getTimestamp();
        } catch (Throwable $e) {
            return 0;
        }
    }

    private function addMinutesToTime(string $time, int $minutes): string
    {
        [$hour, $min] = array_map('intval', explode(':', $time));
        $total = ($hour * 60) + $min + $minutes;
        $h = (int) floor($total / 60);
        $m = $total % 60;
        return str_pad((string) $h, 2, '0', STR_PAD_LEFT) . ':' . str_pad((string) $m, 2, '0', STR_PAD_LEFT);
    }
}
