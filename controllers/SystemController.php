<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/monitoring.php';
require_once __DIR__ . '/../lib/metrics.php';
require_once __DIR__ . '/../lib/features.php';
require_once __DIR__ . '/../lib/prediction.php';

class SystemController
{
    public static function monitoringConfig(array $context): void
    {
        $config = get_monitoring_config();
        json_response($config);
    }

    public static function features(array $context): void
    {
        json_response([
            'ok' => true,
            'data' => FeatureFlags::getAll()
        ]);
    }

    public static function metrics(array $context): void
    {
        $store = $context['store'];

        if (!class_exists('Metrics')) {
            http_response_code(500);
            die("Metrics library not loaded");
        }
        header('Content-Type: text/plain; version=0.0.4');

        // Calculate Business Metrics from Store
        $revenueByDate = [];
        if (isset($store['appointments']) && is_array($store['appointments'])) {
            foreach ($store['appointments'] as $appt) {
                if (($appt['status'] ?? '') !== 'cancelled' && ($appt['paymentStatus'] ?? '') === 'paid') {
                    $date = $appt['date'] ?? '';
                    $service = $appt['service'] ?? '';
                    $price = function_exists('get_service_price_amount') ? get_service_price_amount($service, $date) : 0.0;
                    if ($date && $price > 0) {
                        if (!isset($revenueByDate[$date])) {
                            $revenueByDate[$date] = 0;
                        }
                        $revenueByDate[$date] += $price;
                    }
                }
            }
        }

        $stats = ['confirmed' => 0, 'no_show' => 0, 'completed' => 0, 'cancelled' => 0];
        if (isset($store['appointments']) && is_array($store['appointments'])) {
            foreach ($store['appointments'] as $appt) {
                $st = function_exists('map_appointment_status')
                    ? map_appointment_status($appt['status'] ?? 'confirmed')
                    : ($appt['status'] ?? 'confirmed');

                if (isset($stats[$st])) {
                    $stats[$st]++;
                }
            }
        }

        // Output standard metrics
        echo Metrics::export();

        // Output business metrics
        if (!empty($revenueByDate)) {
            echo "\n# TYPE pielarmonia_revenue_daily_total gauge";
            foreach ($revenueByDate as $date => $amount) {
                echo "\npielarmonia_revenue_daily_total{date=\"$date\"} $amount";
            }
        }

        if (!empty($stats)) {
            echo "\n# TYPE pielarmonia_appointments_total gauge";
            foreach ($stats as $st => $count) {
                echo "\npielarmonia_appointments_total{status=\"$st\"} $count";
            }
        }

        $totalValid = $stats['confirmed'] + $stats['no_show'] + $stats['completed'];
        $rate = $totalValid > 0 ? ($stats['no_show'] / $totalValid) : 0;
        echo "\n# TYPE pielarmonia_no_show_rate gauge";
        echo "\npielarmonia_no_show_rate $rate\n";

        // Store File Size
        $storeSize = @filesize(data_file_path());
        if ($storeSize !== false) {
            echo "\n# TYPE pielarmonia_store_file_size_bytes gauge";
            echo "\npielarmonia_store_file_size_bytes $storeSize";
        }

        // Service Popularity
        $serviceCounts = [];
        if (isset($store['appointments']) && is_array($store['appointments'])) {
            foreach ($store['appointments'] as $appt) {
                $svc = $appt['service'] ?? 'unknown';
                if ($svc === '') {
                    $svc = 'unknown';
                }
                if (!isset($serviceCounts[$svc])) {
                    $serviceCounts[$svc] = 0;
                }
                $serviceCounts[$svc]++;
            }
        }
        if (!empty($serviceCounts)) {
            echo "\n# TYPE pielarmonia_service_popularity_total gauge";
            foreach ($serviceCounts as $svc => $count) {
                echo "\npielarmonia_service_popularity_total{service=\"$svc\"} $count";
            }
        }

        // Lead Time (Last 30 days)
        $leadTimes = [];
        $now = time();
        if (isset($store['appointments']) && is_array($store['appointments'])) {
            foreach ($store['appointments'] as $appt) {
                if (($appt['status'] ?? '') === 'cancelled') {
                    continue;
                }
                $bookedAt = isset($appt['dateBooked']) ? strtotime($appt['dateBooked']) : false;
                $apptTime = strtotime(($appt['date'] ?? '') . ' ' . ($appt['time'] ?? ''));
                // Only consider bookings made in the last 30 days
                if ($bookedAt && $apptTime && $bookedAt > ($now - 30 * 86400)) {
                    $lead = $apptTime - $bookedAt;
                    if ($lead > 0) {
                        $leadTimes[] = $lead;
                    }
                }
            }
        }
        if (count($leadTimes) > 0) {
            $avgLead = array_sum($leadTimes) / count($leadTimes);
            echo "\n# TYPE pielarmonia_lead_time_seconds_avg gauge";
            echo "\npielarmonia_lead_time_seconds_avg $avgLead\n";
        }

        exit;
    }

    public static function predictions(array $context): void
    {
        $store = $context['store'];
        $action = isset($_GET['action']) ? (string) $_GET['action'] : '';

        if ($action === 'no-show') {
            // Admin check is already done by default for non-public endpoints
            $email = isset($_GET['email']) ? trim((string) $_GET['email']) : '';
            $phone = isset($_GET['phone']) ? trim((string) $_GET['phone']) : '';
            $date = isset($_GET['date']) ? trim((string) $_GET['date']) : '';
            $time = isset($_GET['time']) ? trim((string) $_GET['time']) : '';
            $service = isset($_GET['service']) ? trim((string) $_GET['service']) : '';

            if ($email === '' && $phone === '') {
                json_response(['ok' => false, 'error' => 'Email o telefono requerido'], 400);
            }

            $history = [];
            if (isset($store['appointments']) && is_array($store['appointments'])) {
                foreach ($store['appointments'] as $appt) {
                    $apptEmail = isset($appt['email']) ? trim((string) $appt['email']) : '';
                    $apptPhone = isset($appt['phone']) ? trim((string) $appt['phone']) : '';

                    if (($email !== '' && strcasecmp($email, $apptEmail) === 0) ||
                        ($phone !== '' && $phone === $apptPhone)) {
                        $history[] = $appt;
                    }
                }
            }

            $prediction = NoShowPredictor::predict([
                'date' => $date,
                'time' => $time,
                'service' => $service
            ], $history);

            json_response([
                'ok' => true,
                'prediction' => $prediction,
                'history_count' => count($history)
            ]);
        }

        json_response(['ok' => false, 'error' => 'Acción no soportada para predicciones'], 404);
    }
}
