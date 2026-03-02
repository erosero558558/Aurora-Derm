<?php

declare(strict_types=1);

require_once __DIR__ . '/AnalyticsLabelNormalizer.php';

final class RetentionReportService
{
    private const DEFAULT_DAYS = 30;
    private const MAX_DAYS = 120;
    private const NO_SHOW_MIN_SAMPLE = 10;

    /**
     * @return array<string,mixed>
     */
    public static function resolveParamsFromQuery(array $query): array
    {
        $timezone = trim((string) getenv('PIELARMONIA_CALENDAR_TIMEZONE'));
        if ($timezone === '') {
            $timezone = 'America/Guayaquil';
        }

        $today = new DateTimeImmutable('today', new DateTimeZone($timezone));
        $format = strtolower(trim((string) ($query['format'] ?? 'json')));
        if (!in_array($format, ['json', 'csv'], true)) {
            throw new InvalidArgumentException('Formato invalido. Usa format=json o format=csv');
        }

        $daysRaw = (string) ($query['days'] ?? self::DEFAULT_DAYS);
        $days = (int) $daysRaw;
        if ($days < 1) {
            $days = self::DEFAULT_DAYS;
        }
        if ($days > self::MAX_DAYS) {
            throw new InvalidArgumentException('Parametro days excede el maximo permitido');
        }

        $dateToRaw = trim((string) ($query['dateTo'] ?? ''));
        $dateFromRaw = trim((string) ($query['dateFrom'] ?? ''));

        $dateTo = $dateToRaw !== ''
            ? self::parseIsoDate($dateToRaw, $timezone)
            : $today;
        if ($dateTo === null) {
            throw new InvalidArgumentException('dateTo debe tener formato YYYY-MM-DD');
        }

        $dateFrom = $dateFromRaw !== ''
            ? self::parseIsoDate($dateFromRaw, $timezone)
            : $dateTo->modify('-' . ($days - 1) . ' days');
        if ($dateFrom === null) {
            throw new InvalidArgumentException('dateFrom debe tener formato YYYY-MM-DD');
        }

        if ($dateFrom > $dateTo) {
            throw new InvalidArgumentException('dateFrom no puede ser mayor que dateTo');
        }

        $rangeDays = ((int) $dateFrom->diff($dateTo)->format('%a')) + 1;
        if ($rangeDays > self::MAX_DAYS) {
            throw new InvalidArgumentException('Rango de fechas excede el maximo permitido');
        }

        return [
            'format' => $format,
            'timezone' => $timezone,
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'doctor' => AnalyticsLabelNormalizer::normalize($query['doctor'] ?? '', ''),
            'service' => AnalyticsLabelNormalizer::normalize($query['service'] ?? '', ''),
        ];
    }

    /**
     * @return array<string,int|float|array<string,int>>
     */
    public static function buildSnapshot(array $store): array
    {
        $appointments = isset($store['appointments']) && is_array($store['appointments'])
            ? $store['appointments']
            : [];

        $statusCounts = [
            'confirmed' => 0,
            'completed' => 0,
            'noShow' => 0,
            'cancelled' => 0,
        ];
        $appointmentsNonCancelled = 0;
        $patientVisits = [];

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $status = self::normalizeAppointmentStatus((string) ($appointment['status'] ?? 'confirmed'));

            if ($status === 'completed') {
                $statusCounts['completed']++;
            } elseif ($status === 'no_show') {
                $statusCounts['noShow']++;
            } elseif ($status === 'cancelled') {
                $statusCounts['cancelled']++;
            } else {
                $statusCounts['confirmed']++;
            }

            if ($status === 'cancelled') {
                continue;
            }

            $appointmentsNonCancelled++;
            $patientKey = AnalyticsLabelNormalizer::resolvePatientKey($appointment);
            if ($patientKey === '') {
                continue;
            }
            if (!isset($patientVisits[$patientKey])) {
                $patientVisits[$patientKey] = 0;
            }
            $patientVisits[$patientKey]++;
        }

        $uniquePatients = count($patientVisits);
        $recurrentPatients = 0;
        foreach ($patientVisits as $visits) {
            if ((int) $visits >= 2) {
                $recurrentPatients++;
            }
        }

        $noShowRate = $appointmentsNonCancelled > 0
            ? round(($statusCounts['noShow'] / $appointmentsNonCancelled) * 100, 1)
            : 0.0;
        $completionRate = $appointmentsNonCancelled > 0
            ? round(($statusCounts['completed'] / $appointmentsNonCancelled) * 100, 1)
            : 0.0;
        $recurrenceRate = $uniquePatients > 0
            ? round(($recurrentPatients / $uniquePatients) * 100, 1)
            : 0.0;

        return [
            'appointmentsTotal' => count($appointments),
            'appointmentsNonCancelled' => $appointmentsNonCancelled,
            'statusCounts' => $statusCounts,
            'noShowRatePct' => $noShowRate,
            'completionRatePct' => $completionRate,
            'uniquePatients' => $uniquePatients,
            'recurrentPatients' => $recurrentPatients,
            'recurrenceRatePct' => $recurrenceRate,
        ];
    }

    /**
     * @param array<string,mixed> $context
     * @param array<string,mixed> $params
     * @return array<string,mixed>
     */
    public static function buildReportData(array $context, array $params): array
    {
        $store = isset($context['store']) && is_array($context['store']) ? $context['store'] : [];
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];

        /** @var DateTimeImmutable $dateFrom */
        $dateFrom = $params['dateFrom'];
        /** @var DateTimeImmutable $dateTo */
        $dateTo = $params['dateTo'];
        $doctorFilter = (string) ($params['doctor'] ?? '');
        $serviceFilter = (string) ($params['service'] ?? '');
        $timezone = (string) ($params['timezone'] ?? 'America/Guayaquil');

        $daily = [];
        $cursor = $dateFrom;
        while ($cursor <= $dateTo) {
            $key = $cursor->format('Y-m-d');
            $daily[$key] = [
                'date' => $key,
                'appointmentsTotal' => 0,
                'appointmentsNonCancelled' => 0,
                'statusCounts' => [
                    'confirmed' => 0,
                    'completed' => 0,
                    'noShow' => 0,
                    'cancelled' => 0,
                ],
                'uniquePatients' => 0,
                'noShowRatePct' => 0.0,
                'completionRatePct' => 0.0,
                '_patientSet' => [],
            ];
            $cursor = $cursor->modify('+1 day');
        }

        $summaryStatus = [
            'confirmed' => 0,
            'completed' => 0,
            'noShow' => 0,
            'cancelled' => 0,
        ];
        $summaryAppointmentsTotal = 0;
        $summaryNonCancelled = 0;
        $patientVisits = [];

        foreach ($appointments as $appointment) {
            if (!is_array($appointment)) {
                continue;
            }

            $appointmentDateRaw = trim((string) ($appointment['date'] ?? ''));
            $appointmentDate = self::parseIsoDate($appointmentDateRaw, $timezone);
            if ($appointmentDate === null) {
                continue;
            }

            if ($appointmentDate < $dateFrom || $appointmentDate > $dateTo) {
                continue;
            }

            if ($doctorFilter !== '') {
                $doctorValue = AnalyticsLabelNormalizer::normalize($appointment['doctor'] ?? '', '');
                if ($doctorValue !== $doctorFilter) {
                    continue;
                }
            }
            if ($serviceFilter !== '') {
                $serviceValue = AnalyticsLabelNormalizer::normalize($appointment['service'] ?? '', '');
                if ($serviceValue !== $serviceFilter) {
                    continue;
                }
            }

            $dayKey = $appointmentDate->format('Y-m-d');
            if (!isset($daily[$dayKey])) {
                continue;
            }

            $status = self::normalizeAppointmentStatus((string) ($appointment['status'] ?? 'confirmed'));
            $statusKey = 'confirmed';
            if ($status === 'completed') {
                $statusKey = 'completed';
            } elseif ($status === 'no_show') {
                $statusKey = 'noShow';
            } elseif ($status === 'cancelled') {
                $statusKey = 'cancelled';
            }

            $daily[$dayKey]['appointmentsTotal']++;
            $daily[$dayKey]['statusCounts'][$statusKey]++;
            $summaryAppointmentsTotal++;
            $summaryStatus[$statusKey]++;

            if ($statusKey !== 'cancelled') {
                $daily[$dayKey]['appointmentsNonCancelled']++;
                $summaryNonCancelled++;
                $patientKey = AnalyticsLabelNormalizer::resolvePatientKey($appointment);
                if ($patientKey !== '') {
                    $daily[$dayKey]['_patientSet'][$patientKey] = true;
                    if (!isset($patientVisits[$patientKey])) {
                        $patientVisits[$patientKey] = 0;
                    }
                    $patientVisits[$patientKey]++;
                }
            }
        }

        $series = [];
        foreach ($daily as $row) {
            $nonCancelled = (int) $row['appointmentsNonCancelled'];
            $row['uniquePatients'] = count($row['_patientSet']);
            $row['noShowRatePct'] = $nonCancelled > 0
                ? round((((int) $row['statusCounts']['noShow']) / $nonCancelled) * 100, 2)
                : 0.0;
            $row['completionRatePct'] = $nonCancelled > 0
                ? round((((int) $row['statusCounts']['completed']) / $nonCancelled) * 100, 2)
                : 0.0;
            unset($row['_patientSet']);
            $series[] = $row;
        }

        $uniquePatients = count($patientVisits);
        $recurrentPatients = 0;
        foreach ($patientVisits as $visits) {
            if ((int) $visits >= 2) {
                $recurrentPatients++;
            }
        }

        $noShowRatePct = $summaryNonCancelled > 0
            ? round(($summaryStatus['noShow'] / $summaryNonCancelled) * 100, 2)
            : 0.0;
        $completionRatePct = $summaryNonCancelled > 0
            ? round(($summaryStatus['completed'] / $summaryNonCancelled) * 100, 2)
            : 0.0;
        $recurrenceRatePct = $uniquePatients > 0
            ? round(($recurrentPatients / $uniquePatients) * 100, 2)
            : 0.0;

        $noShowWarnPct = self::getEnvFloat('PIELARMONIA_RETENTION_NO_SHOW_WARN_PCT', 20.0);
        $recurrenceMinWarnPct = self::getEnvFloat('PIELARMONIA_RETENTION_RECURRENCE_MIN_WARN_PCT', 30.0);
        $recurrenceMinUniquePatients = self::getEnvInt('PIELARMONIA_RETENTION_RECURRENCE_MIN_UNIQUE_PATIENTS', 5);
        $alerts = [];
        if ($summaryNonCancelled >= self::NO_SHOW_MIN_SAMPLE && $noShowRatePct >= $noShowWarnPct) {
            $alerts[] = [
                'code' => 'no_show_rate_high',
                'severity' => 'warn',
                'impact' => 'retention',
                'thresholdPct' => $noShowWarnPct,
                'actualPct' => $noShowRatePct,
            ];
        }
        if ($uniquePatients >= $recurrenceMinUniquePatients && $recurrenceRatePct < $recurrenceMinWarnPct) {
            $alerts[] = [
                'code' => 'recurrence_rate_low',
                'severity' => 'warn',
                'impact' => 'retention',
                'thresholdPct' => $recurrenceMinWarnPct,
                'actualPct' => $recurrenceRatePct,
            ];
        }

        return [
            'meta' => [
                'dateFrom' => $dateFrom->format('Y-m-d'),
                'dateTo' => $dateTo->format('Y-m-d'),
                'days' => count($series),
                'timezone' => $timezone,
                'doctor' => $doctorFilter,
                'service' => $serviceFilter,
                'format' => (string) ($params['format'] ?? 'json'),
                'generatedAt' => gmdate('c'),
            ],
            'summary' => [
                'appointmentsTotal' => $summaryAppointmentsTotal,
                'appointmentsNonCancelled' => $summaryNonCancelled,
                'statusCounts' => $summaryStatus,
                'noShowRatePct' => $noShowRatePct,
                'completionRatePct' => $completionRatePct,
                'uniquePatients' => $uniquePatients,
                'recurrentPatients' => $recurrentPatients,
                'recurrenceRatePct' => $recurrenceRatePct,
            ],
            'series' => $series,
            'alerts' => $alerts,
        ];
    }

    private static function parseIsoDate(string $rawDate, string $timezone): ?DateTimeImmutable
    {
        if ($rawDate === '') {
            return null;
        }

        $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $rawDate, new DateTimeZone($timezone));
        if (!$dt instanceof DateTimeImmutable) {
            return null;
        }
        if ($dt->format('Y-m-d') !== $rawDate) {
            return null;
        }

        return $dt;
    }

    private static function getEnvFloat(string $name, float $default): float
    {
        $raw = getenv($name);
        if ($raw === false) {
            return $default;
        }

        $value = trim((string) $raw);
        if ($value === '' || !is_numeric($value)) {
            return $default;
        }

        return (float) $value;
    }

    private static function getEnvInt(string $name, int $default): int
    {
        $raw = getenv($name);
        if ($raw === false) {
            return $default;
        }

        $value = trim((string) $raw);
        if ($value === '' || !preg_match('/^-?\d+$/', $value)) {
            return $default;
        }

        return (int) $value;
    }

    private static function normalizeAppointmentStatus(string $rawStatus): string
    {
        $status = function_exists('map_appointment_status')
            ? map_appointment_status($rawStatus)
            : strtolower(trim($rawStatus));

        if ($status === 'noshow') {
            return 'no_show';
        }

        return $status;
    }
}
