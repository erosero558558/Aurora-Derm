<?php

declare(strict_types=1);

/**
 * Analytics Controller
 * Handles funnel events and metrics for conversion tracking
 */

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/metrics.php';

class AnalyticsController
{
    /**
     * Allowed funnel event names
     */
    private const ALLOWED_EVENTS = [
        'view_booking',
        'view_service_category',
        'view_service_detail',
        'start_booking_from_service',
        'start_checkout',
        'payment_method_selected',
        'payment_success',
        'booking_confirmed',
        'checkout_abandon',
        'booking_step_completed',
        'booking_error',
        'checkout_error',
        'chat_started',
        'chat_handoff_whatsapp',
        'whatsapp_click'
    ];

    private const RETENTION_REPORT_DEFAULT_DAYS = 30;
    private const RETENTION_REPORT_MAX_DAYS = 120;
    private const RETENTION_REPORT_NO_SHOW_MIN_SAMPLE = 10;

    /**
     * POST /funnel-event - Record a funnel event
     */
    public static function recordEvent(array $context): void
    {
        require_rate_limit('funnel-event', 120, 60);

        $payload = require_json_body();
        $event = self::normalizeLabel(
            is_array($payload) ? ($payload['event'] ?? $payload['eventName'] ?? '') : '',
            ''
        );

        if ($event === '' || !in_array($event, self::ALLOWED_EVENTS, true)) {
            json_response([
                'ok' => false,
                'error' => 'Evento de funnel invalido'
            ], 400);
        }

        $params = [];
        if (is_array($payload) && isset($payload['params']) && is_array($payload['params'])) {
            $params = $payload['params'];
        }

        $labels = [
            'event' => $event,
            'source' => self::normalizeLabel($params['source'] ?? $payload['source'] ?? 'unknown')
        ];

        // Add event-specific labels
        $labels = self::extractEventLabels($event, $params, $labels);

        if (class_exists('Metrics')) {
            Metrics::increment('conversion_funnel_events_total', $labels);
            self::recordDerivedMetrics($event, $labels);
        }

        json_response([
            'ok' => true,
            'recorded' => true
        ], 202);
    }

    /**
     * GET /funnel-metrics - Get funnel analytics data
     */
    public static function getFunnelMetrics(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => self::buildFunnelMetricsData($context)
        ]);
    }

    /**
     * GET /retention-report - Daily retention/no-show report (JSON or CSV)
     */
    public static function getRetentionReport(array $context): void
    {
        $params = self::resolveRetentionReportParams();
        $data = self::buildRetentionReportData($context, $params);

        if ($params['format'] === 'csv') {
            self::respondRetentionCsv($data);
            return;
        }

        json_response([
            'ok' => true,
            'data' => $data,
        ]);
    }

    /**
     * Build funnel analytics payload without sending HTTP response.
     *
     * @return array<string,mixed>
     */
    public static function buildFunnelMetricsData(array $context): array
    {
        $rawMetrics = class_exists('Metrics') ? Metrics::export() : '';
        $series = self::parsePrometheusCounterSeries($rawMetrics, 'conversion_funnel_events_total');

        $eventTotals = [];
        foreach (self::ALLOWED_EVENTS as $eventName) {
            $eventTotals[$eventName] = 0;
        }

        $checkoutAbandonByStep = [];
        $checkoutAbandonByReason = [];
        $checkoutEntryBreakdown = [];
        $eventSourceBreakdown = [];
        $paymentMethodBreakdown = [];
        $bookingStepBreakdown = [];
        $errorCodeBreakdown = [];
        $serviceCategoryBreakdown = [];
        $serviceDetailBreakdown = [];
        $serviceBookingIntentBreakdown = [];
        $serviceCheckoutBreakdown = [];
        $serviceConfirmedBreakdown = [];

        foreach ($series as $row) {
            $labels = is_array($row['labels'] ?? null) ? $row['labels'] : [];
            $value = (int) round((float) ($row['value'] ?? 0));
            if ($value <= 0) {
                continue;
            }

            $eventName = self::normalizeLabel($labels['event'] ?? '', '');
            if ($eventName === '') {
                continue;
            }
            if (!isset($eventTotals[$eventName])) {
                $eventTotals[$eventName] = 0;
            }
            $eventTotals[$eventName] += $value;

            $source = self::normalizeLabel($labels['source'] ?? 'unknown');
            if (!isset($eventSourceBreakdown[$source])) {
                $eventSourceBreakdown[$source] = 0;
            }
            $eventSourceBreakdown[$source] += $value;

            $serviceCategory = self::normalizeLabel($labels['service_category'] ?? '', '');
            if ($serviceCategory !== '') {
                if (!isset($serviceCategoryBreakdown[$serviceCategory])) {
                    $serviceCategoryBreakdown[$serviceCategory] = 0;
                }
                $serviceCategoryBreakdown[$serviceCategory] += $value;
            }

            $serviceSlug = self::normalizeLabel($labels['service_slug'] ?? ($labels['service'] ?? ''), '');
            if ($serviceSlug !== '') {
                if ($eventName === 'view_service_detail') {
                    if (!isset($serviceDetailBreakdown[$serviceSlug])) {
                        $serviceDetailBreakdown[$serviceSlug] = 0;
                    }
                    $serviceDetailBreakdown[$serviceSlug] += $value;
                }

                if ($eventName === 'start_booking_from_service') {
                    if (!isset($serviceBookingIntentBreakdown[$serviceSlug])) {
                        $serviceBookingIntentBreakdown[$serviceSlug] = 0;
                    }
                    $serviceBookingIntentBreakdown[$serviceSlug] += $value;
                }

                if ($eventName === 'start_checkout') {
                    if (!isset($serviceCheckoutBreakdown[$serviceSlug])) {
                        $serviceCheckoutBreakdown[$serviceSlug] = 0;
                    }
                    $serviceCheckoutBreakdown[$serviceSlug] += $value;
                }

                if ($eventName === 'booking_confirmed') {
                    if (!isset($serviceConfirmedBreakdown[$serviceSlug])) {
                        $serviceConfirmedBreakdown[$serviceSlug] = 0;
                    }
                    $serviceConfirmedBreakdown[$serviceSlug] += $value;
                }
            }

            if ($eventName === 'checkout_abandon') {
                $step = self::normalizeLabel($labels['checkout_step'] ?? 'unknown');
                if (!isset($checkoutAbandonByStep[$step])) {
                    $checkoutAbandonByStep[$step] = 0;
                }
                $checkoutAbandonByStep[$step] += $value;

                $reason = self::normalizeLabel($labels['reason'] ?? 'unknown');
                if (!isset($checkoutAbandonByReason[$reason])) {
                    $checkoutAbandonByReason[$reason] = 0;
                }
                $checkoutAbandonByReason[$reason] += $value;
            }

            if ($eventName === 'start_checkout') {
                $entry = self::normalizeLabel($labels['checkout_entry'] ?? 'unknown');
                if (!isset($checkoutEntryBreakdown[$entry])) {
                    $checkoutEntryBreakdown[$entry] = 0;
                }
                $checkoutEntryBreakdown[$entry] += $value;
            }

            if ($eventName === 'payment_method_selected') {
                $method = self::normalizeLabel($labels['payment_method'] ?? 'unknown');
                if (!isset($paymentMethodBreakdown[$method])) {
                    $paymentMethodBreakdown[$method] = 0;
                }
                $paymentMethodBreakdown[$method] += $value;
            }

            if ($eventName === 'booking_step_completed') {
                $step = self::normalizeLabel($labels['step'] ?? 'unknown');
                if (!isset($bookingStepBreakdown[$step])) {
                    $bookingStepBreakdown[$step] = 0;
                }
                $bookingStepBreakdown[$step] += $value;
            }

            if ($eventName === 'booking_error' || $eventName === 'checkout_error') {
                $errorCode = self::normalizeLabel($labels['error_code'] ?? 'unknown');
                if (!isset($errorCodeBreakdown[$errorCode])) {
                    $errorCodeBreakdown[$errorCode] = 0;
                }
                $errorCodeBreakdown[$errorCode] += $value;
            }
        }

        arsort($checkoutAbandonByStep);
        arsort($checkoutAbandonByReason);
        arsort($checkoutEntryBreakdown);
        arsort($eventSourceBreakdown);
        arsort($paymentMethodBreakdown);
        arsort($bookingStepBreakdown);
        arsort($errorCodeBreakdown);
        arsort($serviceCategoryBreakdown);
        arsort($serviceDetailBreakdown);
        arsort($serviceBookingIntentBreakdown);
        arsort($serviceCheckoutBreakdown);
        arsort($serviceConfirmedBreakdown);

        $viewBooking = (int) ($eventTotals['view_booking'] ?? 0);
        $startCheckout = (int) ($eventTotals['start_checkout'] ?? 0);
        $bookingConfirmed = (int) ($eventTotals['booking_confirmed'] ?? 0);
        $checkoutAbandon = (int) ($eventTotals['checkout_abandon'] ?? 0);

        $startRate = $viewBooking > 0 ? round(($startCheckout / $viewBooking) * 100, 1) : 0.0;
        $confirmedRate = $startCheckout > 0 ? round(($bookingConfirmed / $startCheckout) * 100, 1) : 0.0;
        $abandonRate = $startCheckout > 0 ? round(($checkoutAbandon / $startCheckout) * 100, 1) : 0.0;
        $store = isset($context['store']) && is_array($context['store']) ? $context['store'] : [];
        $retention = self::buildRetentionSnapshot($store);
        $idempotency = self::buildIdempotencySnapshot($rawMetrics);

        $toList = static function (array $assoc): array {
            $rows = [];
            foreach ($assoc as $label => $value) {
                $rows[] = [
                    'label' => (string) $label,
                    'count' => (int) $value
                ];
            }
            return $rows;
        };

        $serviceFunnel = self::buildServiceFunnelBreakdown(
            $serviceDetailBreakdown,
            $serviceBookingIntentBreakdown,
            $serviceCheckoutBreakdown,
            $serviceConfirmedBreakdown
        );

        return [
            'summary' => [
                'viewBooking' => $viewBooking,
                'startCheckout' => $startCheckout,
                'bookingConfirmed' => $bookingConfirmed,
                'checkoutAbandon' => $checkoutAbandon,
                'startRatePct' => $startRate,
                'confirmedRatePct' => $confirmedRate,
                'abandonRatePct' => $abandonRate
            ],
            'events' => $eventTotals,
            'checkoutAbandonByStep' => $toList($checkoutAbandonByStep),
            'checkoutAbandonByReason' => $toList($checkoutAbandonByReason),
            'checkoutEntryBreakdown' => $toList($checkoutEntryBreakdown),
            'eventSourceBreakdown' => $toList($eventSourceBreakdown),
            'paymentMethodBreakdown' => $toList($paymentMethodBreakdown),
            'bookingStepBreakdown' => $toList($bookingStepBreakdown),
            'errorCodeBreakdown' => $toList($errorCodeBreakdown),
            'serviceCategoryBreakdown' => $toList($serviceCategoryBreakdown),
            'serviceDetailBreakdown' => $toList($serviceDetailBreakdown),
            'serviceBookingIntentBreakdown' => $toList($serviceBookingIntentBreakdown),
            'serviceCheckoutBreakdown' => $toList($serviceCheckoutBreakdown),
            'serviceConfirmedBreakdown' => $toList($serviceConfirmedBreakdown),
            'serviceFunnel' => $serviceFunnel,
            'retention' => $retention,
            'idempotency' => $idempotency,
            'generatedAt' => gmdate('c')
        ];
    }

    /**
     * Build retention snapshot from appointment statuses.
     */
    private static function buildRetentionSnapshot(array $store): array
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

            $rawStatus = (string) ($appointment['status'] ?? 'confirmed');
            $status = function_exists('map_appointment_status')
                ? map_appointment_status($rawStatus)
                : strtolower(trim($rawStatus));
            if ($status === 'noshow') {
                $status = 'no_show';
            }

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
            $patientKey = self::resolvePatientKey($appointment);
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
     * Build operational retention report scoped by date range and optional filters.
     *
     * @param array<string,mixed> $context
     * @param array<string,mixed> $params
     * @return array<string,mixed>
     */
    private static function buildRetentionReportData(array $context, array $params): array
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
                $doctorValue = self::normalizeLabel($appointment['doctor'] ?? '', '');
                if ($doctorValue !== $doctorFilter) {
                    continue;
                }
            }
            if ($serviceFilter !== '') {
                $serviceValue = self::normalizeLabel($appointment['service'] ?? '', '');
                if ($serviceValue !== $serviceFilter) {
                    continue;
                }
            }

            $dayKey = $appointmentDate->format('Y-m-d');
            if (!isset($daily[$dayKey])) {
                continue;
            }

            $status = (string) ($appointment['status'] ?? 'confirmed');
            if (function_exists('map_appointment_status')) {
                $status = map_appointment_status($status);
            } else {
                $status = strtolower(trim($status));
            }
            if ($status === 'noshow') {
                $status = 'no_show';
            }

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
                $patientKey = self::resolvePatientKey($appointment);
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
        if ($summaryNonCancelled >= self::RETENTION_REPORT_NO_SHOW_MIN_SAMPLE && $noShowRatePct >= $noShowWarnPct) {
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

    /**
     * @return array<string,mixed>
     */
    private static function resolveRetentionReportParams(): array
    {
        $timezone = trim((string) getenv('PIELARMONIA_CALENDAR_TIMEZONE'));
        if ($timezone === '') {
            $timezone = 'America/Guayaquil';
        }

        $today = new DateTimeImmutable('today', new DateTimeZone($timezone));
        $format = strtolower(trim((string) ($_GET['format'] ?? 'json')));
        if (!in_array($format, ['json', 'csv'], true)) {
            json_response([
                'ok' => false,
                'error' => 'Formato invalido. Usa format=json o format=csv'
            ], 400);
        }

        $daysRaw = (string) ($_GET['days'] ?? self::RETENTION_REPORT_DEFAULT_DAYS);
        $days = (int) $daysRaw;
        if ($days < 1) {
            $days = self::RETENTION_REPORT_DEFAULT_DAYS;
        }
        if ($days > self::RETENTION_REPORT_MAX_DAYS) {
            json_response([
                'ok' => false,
                'error' => 'Parametro days excede el maximo permitido'
            ], 400);
        }

        $dateToRaw = trim((string) ($_GET['dateTo'] ?? ''));
        $dateFromRaw = trim((string) ($_GET['dateFrom'] ?? ''));

        $dateTo = $dateToRaw !== ''
            ? self::parseIsoDate($dateToRaw, $timezone)
            : $today;
        if ($dateTo === null) {
            json_response([
                'ok' => false,
                'error' => 'dateTo debe tener formato YYYY-MM-DD'
            ], 400);
        }

        $dateFrom = $dateFromRaw !== ''
            ? self::parseIsoDate($dateFromRaw, $timezone)
            : $dateTo->modify('-' . ($days - 1) . ' days');
        if ($dateFrom === null) {
            json_response([
                'ok' => false,
                'error' => 'dateFrom debe tener formato YYYY-MM-DD'
            ], 400);
        }

        if ($dateFrom > $dateTo) {
            json_response([
                'ok' => false,
                'error' => 'dateFrom no puede ser mayor que dateTo'
            ], 400);
        }

        $rangeDays = ((int) $dateFrom->diff($dateTo)->format('%a')) + 1;
        if ($rangeDays > self::RETENTION_REPORT_MAX_DAYS) {
            json_response([
                'ok' => false,
                'error' => 'Rango de fechas excede el maximo permitido'
            ], 400);
        }

        return [
            'format' => $format,
            'timezone' => $timezone,
            'dateFrom' => $dateFrom,
            'dateTo' => $dateTo,
            'doctor' => self::normalizeLabel($_GET['doctor'] ?? '', ''),
            'service' => self::normalizeLabel($_GET['service'] ?? '', ''),
        ];
    }

    private static function respondRetentionCsv(array $data): void
    {
        $csv = self::buildRetentionCsv($data);

        if (defined('TESTING_ENV')) {
            $payload = [
                'ok' => true,
                'format' => 'csv',
                'data' => $data,
                'csv' => $csv,
            ];
            $GLOBALS['__TEST_RESPONSE'] = ['payload' => $payload, 'status' => 200];
            if (!defined('TESTING_FORCE_EXIT')) {
                throw new TestingExitException($payload, 200);
            }
        }

        $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
        $from = (string) ($meta['dateFrom'] ?? local_date('Y-m-d'));
        $to = (string) ($meta['dateTo'] ?? local_date('Y-m-d'));
        $filename = 'retention-report-' . $from . '-to-' . $to . '.csv';

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        echo $csv;
        exit();
    }

    private static function buildRetentionCsv(array $data): string
    {
        $rows = [];
        $rows[] = implode(',', [
            'date',
            'appointments_total',
            'appointments_non_cancelled',
            'status_confirmed',
            'status_completed',
            'status_no_show',
            'status_cancelled',
            'no_show_rate_pct',
            'completion_rate_pct',
            'unique_patients',
        ]);

        $series = isset($data['series']) && is_array($data['series']) ? $data['series'] : [];
        foreach ($series as $row) {
            if (!is_array($row)) {
                continue;
            }
            $statusCounts = isset($row['statusCounts']) && is_array($row['statusCounts']) ? $row['statusCounts'] : [];
            $rows[] = implode(',', [
                self::csvValue((string) ($row['date'] ?? '')),
                (string) ((int) ($row['appointmentsTotal'] ?? 0)),
                (string) ((int) ($row['appointmentsNonCancelled'] ?? 0)),
                (string) ((int) ($statusCounts['confirmed'] ?? 0)),
                (string) ((int) ($statusCounts['completed'] ?? 0)),
                (string) ((int) ($statusCounts['noShow'] ?? 0)),
                (string) ((int) ($statusCounts['cancelled'] ?? 0)),
                (string) ((float) ($row['noShowRatePct'] ?? 0)),
                (string) ((float) ($row['completionRatePct'] ?? 0)),
                (string) ((int) ($row['uniquePatients'] ?? 0)),
            ]);
        }

        $summary = isset($data['summary']) && is_array($data['summary']) ? $data['summary'] : [];
        $summaryStatus = isset($summary['statusCounts']) && is_array($summary['statusCounts']) ? $summary['statusCounts'] : [];
        $rows[] = implode(',', [
            'TOTAL',
            (string) ((int) ($summary['appointmentsTotal'] ?? 0)),
            (string) ((int) ($summary['appointmentsNonCancelled'] ?? 0)),
            (string) ((int) ($summaryStatus['confirmed'] ?? 0)),
            (string) ((int) ($summaryStatus['completed'] ?? 0)),
            (string) ((int) ($summaryStatus['noShow'] ?? 0)),
            (string) ((int) ($summaryStatus['cancelled'] ?? 0)),
            (string) ((float) ($summary['noShowRatePct'] ?? 0)),
            (string) ((float) ($summary['completionRatePct'] ?? 0)),
            (string) ((int) ($summary['uniquePatients'] ?? 0)),
        ]);

        return implode("\n", $rows) . "\n";
    }

    private static function csvValue(string $value): string
    {
        $escaped = str_replace('"', '""', $value);
        return '"' . $escaped . '"';
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

    /**
     * Resolve a stable patient key from appointment contact fields.
     */
    private static function resolvePatientKey(array $appointment): string
    {
        $email = strtolower(trim((string) ($appointment['email'] ?? '')));
        if ($email !== '' && strpos($email, '@') !== false) {
            return 'email:' . $email;
        }

        $phoneRaw = trim((string) ($appointment['phone'] ?? ''));
        if ($phoneRaw === '') {
            return '';
        }
        $digits = preg_replace('/\D+/', '', $phoneRaw);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        return 'phone:' . $digits;
    }

    /**
     * Extract event-specific labels
     */
    private static function extractEventLabels(string $event, array $params, array $labels): array
    {
        $serviceSlug = self::normalizeLabel($params['service_slug'] ?? ($params['service'] ?? ''), '');
        if ($serviceSlug !== '') {
            $labels['service_slug'] = $serviceSlug;
        }

        $serviceCategory = self::normalizeLabel($params['service_category'] ?? '', '');
        if ($serviceCategory !== '') {
            $labels['service_category'] = $serviceCategory;
        }

        $serviceAudience = self::normalizeLabel($params['service_audience'] ?? '', '');
        if ($serviceAudience !== '') {
            $labels['service_audience'] = $serviceAudience;
        }

        $entryPoint = self::normalizeLabel($params['entry_point'] ?? '', '');
        if ($entryPoint !== '') {
            $labels['entry_point'] = $entryPoint;
        }

        switch ($event) {
            case 'start_checkout':
                $labels['checkout_entry'] = self::normalizeLabel($params['checkout_entry'] ?? 'unknown');
                break;
            case 'payment_method_selected':
                $labels['payment_method'] = self::normalizeLabel($params['payment_method'] ?? 'unknown');
                break;
            case 'booking_confirmed':
                $labels['payment_method'] = self::normalizeLabel($params['payment_method'] ?? 'unknown');
                break;
            case 'checkout_abandon':
                $labels['checkout_step'] = self::normalizeLabel($params['checkout_step'] ?? 'unknown');
                $labels['reason'] = self::normalizeLabel($params['reason'] ?? 'unknown');
                break;
            case 'booking_step_completed':
                $labels['step'] = self::normalizeLabel($params['step'] ?? 'unknown');
                break;
            case 'booking_error':
            case 'checkout_error':
                $labels['error_code'] = self::normalizeLabel($params['error_code'] ?? 'unknown');
                break;
        }
        return $labels;
    }

    /**
     * Build service-level funnel conversion rows from event breakdowns.
     *
     * @param array<string,int> $serviceDetailBreakdown
     * @param array<string,int> $serviceBookingIntentBreakdown
     * @param array<string,int> $serviceCheckoutBreakdown
     * @param array<string,int> $serviceConfirmedBreakdown
     * @return array<int,array<string,int|float|string>>
     */
    private static function buildServiceFunnelBreakdown(
        array $serviceDetailBreakdown,
        array $serviceBookingIntentBreakdown,
        array $serviceCheckoutBreakdown,
        array $serviceConfirmedBreakdown
    ): array {
        $serviceKeys = array_values(array_unique(array_merge(
            array_keys($serviceDetailBreakdown),
            array_keys($serviceBookingIntentBreakdown),
            array_keys($serviceCheckoutBreakdown),
            array_keys($serviceConfirmedBreakdown)
        )));

        $rows = [];
        foreach ($serviceKeys as $serviceSlug) {
            $detailViews = (int) ($serviceDetailBreakdown[$serviceSlug] ?? 0);
            $bookingIntent = (int) ($serviceBookingIntentBreakdown[$serviceSlug] ?? 0);
            $checkoutStarts = (int) ($serviceCheckoutBreakdown[$serviceSlug] ?? 0);
            $bookingConfirmed = (int) ($serviceConfirmedBreakdown[$serviceSlug] ?? 0);

            $rows[] = [
                'serviceSlug' => (string) $serviceSlug,
                'detailViews' => $detailViews,
                'bookingIntent' => $bookingIntent,
                'checkoutStarts' => $checkoutStarts,
                'bookingConfirmed' => $bookingConfirmed,
                'intentToCheckoutPct' => $bookingIntent > 0
                    ? round(($checkoutStarts / $bookingIntent) * 100, 1)
                    : 0.0,
                'checkoutToConfirmedPct' => $checkoutStarts > 0
                    ? round(($bookingConfirmed / $checkoutStarts) * 100, 1)
                    : 0.0,
                'detailToConfirmedPct' => $detailViews > 0
                    ? round(($bookingConfirmed / $detailViews) * 100, 1)
                    : 0.0,
            ];
        }

        usort($rows, static function (array $a, array $b): int {
            $confirmedA = (int) ($a['bookingConfirmed'] ?? 0);
            $confirmedB = (int) ($b['bookingConfirmed'] ?? 0);
            if ($confirmedA !== $confirmedB) {
                return $confirmedB <=> $confirmedA;
            }

            $detailA = (int) ($a['detailViews'] ?? 0);
            $detailB = (int) ($b['detailViews'] ?? 0);
            if ($detailA !== $detailB) {
                return $detailB <=> $detailA;
            }

            return strcmp((string) ($a['serviceSlug'] ?? ''), (string) ($b['serviceSlug'] ?? ''));
        });

        return $rows;
    }

    /**
     * Record derived metrics that are easier to alert on and dashboard.
     */
    private static function recordDerivedMetrics(string $event, array $labels): void
    {
        if (!class_exists('Metrics')) {
            return;
        }

        if ($event === 'checkout_abandon') {
            Metrics::increment('booking_funnel_dropoff_total', [
                'step' => self::normalizeLabel($labels['checkout_step'] ?? 'unknown'),
                'reason' => self::normalizeLabel($labels['reason'] ?? 'unknown'),
            ]);
        }
    }

    /**
     * Build idempotency runtime snapshot from metrics counters.
     *
     * @return array<string,int|float>
     */
    private static function buildIdempotencySnapshot(string $rawMetrics): array
    {
        $series = self::parsePrometheusCounterSeries($rawMetrics, 'booking_idempotency_events_total');
        $counts = [
            'new' => 0,
            'replay' => 0,
            'conflict' => 0,
            'unknown' => 0,
        ];

        foreach ($series as $row) {
            $labels = is_array($row['labels'] ?? null) ? $row['labels'] : [];
            $value = (int) round((float) ($row['value'] ?? 0));
            if ($value <= 0) {
                continue;
            }

            $outcome = self::normalizeLabel($labels['outcome'] ?? 'unknown');
            if (!isset($counts[$outcome])) {
                $counts['unknown'] += $value;
                continue;
            }
            $counts[$outcome] += $value;
        }

        $requestsWithKey = $counts['new'] + $counts['replay'] + $counts['conflict'] + $counts['unknown'];
        $conflictRatePct = $requestsWithKey > 0 ? round(($counts['conflict'] / $requestsWithKey) * 100, 2) : 0.0;
        $replayRatePct = $requestsWithKey > 0 ? round(($counts['replay'] / $requestsWithKey) * 100, 2) : 0.0;

        return [
            'requestsWithKey' => $requestsWithKey,
            'new' => $counts['new'],
            'replay' => $counts['replay'],
            'conflict' => $counts['conflict'],
            'unknown' => $counts['unknown'],
            'conflictRatePct' => $conflictRatePct,
            'replayRatePct' => $replayRatePct,
        ];
    }

    /**
     * Normalize label for metrics
     */
    private static function normalizeLabel($value, string $fallback = 'unknown', int $maxLength = 48): string
    {
        if (!is_string($value) && !is_numeric($value)) {
            return $fallback;
        }

        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return $fallback;
        }

        $normalized = preg_replace('/[^a-z0-9_]+/', '_', $normalized);
        $normalized = trim((string) $normalized, '_');
        if ($normalized === '') {
            return $fallback;
        }

        if (strlen($normalized) > $maxLength) {
            $normalized = substr($normalized, 0, $maxLength);
        }

        return $normalized;
    }

    /**
     * Parse Prometheus counter series from metrics text
     */
    private static function parsePrometheusCounterSeries(string $metricsText, string $metricName): array
    {
        $series = [];
        if ($metricName === '' || trim($metricsText) === '') {
            return $series;
        }

        $pattern = '/^' . preg_quote($metricName, '/') . '(?:\{([^}]*)\})?\s+([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)$/';
        $lines = preg_split('/\R/', $metricsText) ?: [];

        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '' || $line[0] === '#') {
                continue;
            }

            if (preg_match($pattern, $line, $match) !== 1) {
                continue;
            }

            $labelsRaw = isset($match[1]) ? (string) $match[1] : '';
            $valueRaw = isset($match[2]) ? (string) $match[2] : '0';
            $value = is_numeric($valueRaw) ? (float) $valueRaw : 0.0;

            $series[] = [
                'labels' => self::parsePrometheusLabels($labelsRaw),
                'value' => $value
            ];
        }

        return $series;
    }

    /**
     * Parse Prometheus labels string
     */
    private static function parsePrometheusLabels(string $rawLabels): array
    {
        $labels = [];
        if ($rawLabels === '') {
            return $labels;
        }

        $matchCount = preg_match_all('/([a-zA-Z_][a-zA-Z0-9_]*)="((?:[^"\\\\]|\\\\.)*)"/', $rawLabels, $matches, PREG_SET_ORDER);
        if (!is_int($matchCount) || $matchCount < 1) {
            return $labels;
        }

        foreach ($matches as $match) {
            $key = isset($match[1]) ? (string) $match[1] : '';
            $value = isset($match[2]) ? (string) $match[2] : '';
            if ($key === '') {
                continue;
            }
            $labels[$key] = stripcslashes($value);
        }

        return $labels;
    }
}
