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

        $viewBooking = (int) ($eventTotals['view_booking'] ?? 0);
        $startCheckout = (int) ($eventTotals['start_checkout'] ?? 0);
        $bookingConfirmed = (int) ($eventTotals['booking_confirmed'] ?? 0);
        $checkoutAbandon = (int) ($eventTotals['checkout_abandon'] ?? 0);

        $startRate = $viewBooking > 0 ? round(($startCheckout / $viewBooking) * 100, 1) : 0.0;
        $confirmedRate = $startCheckout > 0 ? round(($bookingConfirmed / $startCheckout) * 100, 1) : 0.0;
        $abandonRate = $startCheckout > 0 ? round(($checkoutAbandon / $startCheckout) * 100, 1) : 0.0;

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

        json_response([
            'ok' => true,
            'data' => [
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
                'generatedAt' => gmdate('c')
            ]
        ]);
    }

    /**
     * Extract event-specific labels
     */
    private static function extractEventLabels(string $event, array $params, array $labels): array
    {
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
