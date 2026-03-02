<?php

declare(strict_types=1);

require_once __DIR__ . '/../api-lib.php';
require_once __DIR__ . '/../lib/metrics.php';
require_once __DIR__ . '/../lib/analytics/AnalyticsLabelNormalizer.php';
require_once __DIR__ . '/../lib/analytics/FunnelMetricsService.php';
require_once __DIR__ . '/../lib/analytics/PrometheusCounterParser.php';
require_once __DIR__ . '/../lib/analytics/RetentionCsvExporter.php';
require_once __DIR__ . '/../lib/analytics/RetentionReportService.php';

class AnalyticsController
{
    public static function recordEvent(array $context): void
    {
        require_rate_limit('funnel-event', 120, 60);

        $payload = require_json_body();
        $event = FunnelMetricsService::normalizeEventName(
            is_array($payload) ? ($payload['event'] ?? $payload['eventName'] ?? '') : ''
        );

        if (!FunnelMetricsService::isAllowedEvent($event)) {
            json_response([
                'ok' => false,
                'error' => 'Evento de funnel invalido',
            ], 400);
        }

        $labels = FunnelMetricsService::buildEventLabels($payload, $event);
        if (class_exists('Metrics')) {
            Metrics::increment('conversion_funnel_events_total', $labels);
            FunnelMetricsService::recordDerivedMetrics($event, $labels);
        }

        json_response([
            'ok' => true,
            'recorded' => true,
        ], 202);
    }

    public static function getFunnelMetrics(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => self::buildFunnelMetricsData($context),
        ]);
    }

    public static function getRetentionReport(array $context): void
    {
        try {
            $params = RetentionReportService::resolveParamsFromQuery($_GET);
        } catch (InvalidArgumentException $exception) {
            json_response([
                'ok' => false,
                'error' => $exception->getMessage(),
            ], 400);
        }

        $data = RetentionReportService::buildReportData($context, $params);

        if (($params['format'] ?? 'json') === 'csv') {
            self::respondRetentionCsv($data);
            return;
        }

        json_response([
            'ok' => true,
            'data' => $data,
        ]);
    }

    /**
     * @return array<string,mixed>
     */
    public static function buildFunnelMetricsData(array $context): array
    {
        return FunnelMetricsService::buildData($context);
    }

    private static function respondRetentionCsv(array $data): void
    {
        $csv = RetentionCsvExporter::build($data);

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
}
