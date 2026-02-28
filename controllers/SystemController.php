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

    public static function publicRuntimeConfig(array $context): void
    {
        $captchaProvider = function_exists('captcha_get_provider')
            ? captcha_get_provider()
            : null;
        $captchaSiteKey = function_exists('captcha_get_site_key')
            ? captcha_get_site_key()
            : null;
        $captchaScriptUrl = function_exists('captcha_get_script_url')
            ? captcha_get_script_url()
            : null;

        $features = [];
        if (class_exists('FeatureFlags') && method_exists('FeatureFlags', 'getAll')) {
            $rawFeatures = FeatureFlags::getAll();
            if (is_array($rawFeatures)) {
                $features = $rawFeatures;
            }
        }

        $deployVersion = function_exists('app_runtime_version')
            ? app_runtime_version()
            : gmdate('YmdHis');

        json_response([
            'ok' => true,
            'data' => [
                'captcha' => [
                    'provider' => is_string($captchaProvider) ? $captchaProvider : null,
                    'siteKey' => is_string($captchaSiteKey) ? $captchaSiteKey : null,
                    'scriptUrl' => is_string($captchaScriptUrl) ? $captchaScriptUrl : null,
                ],
                'features' => $features,
                'deployVersion' => (string) $deployVersion,
            ],
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
        $patientVisits = [];
        $patientKeyResolver = static function (array $appointment): string {
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
        };
        if (isset($store['appointments']) && is_array($store['appointments'])) {
            foreach ($store['appointments'] as $appt) {
                $st = function_exists('map_appointment_status')
                    ? map_appointment_status($appt['status'] ?? 'confirmed')
                    : ($appt['status'] ?? 'confirmed');

                if (isset($stats[$st])) {
                    $stats[$st]++;
                }

                if ($st === 'cancelled') {
                    continue;
                }
                $patientKey = $patientKeyResolver(is_array($appt) ? $appt : []);
                if ($patientKey === '') {
                    continue;
                }
                if (!isset($patientVisits[$patientKey])) {
                    $patientVisits[$patientKey] = 0;
                }
                $patientVisits[$patientKey]++;
            }
        }

        // Output standard metrics
        echo Metrics::export();

        // Output business metrics
        foreach ($revenueByDate as $date => $amount) {
            echo "\n# TYPE pielarmonia_revenue_daily_total gauge";
            echo "\npielarmonia_revenue_daily_total{date=\"$date\"} $amount";
        }

        foreach ($stats as $st => $count) {
            echo "\n# TYPE pielarmonia_appointments_total gauge";
            echo "\npielarmonia_appointments_total{status=\"$st\"} $count";
        }

        $totalValid = $stats['confirmed'] + $stats['no_show'] + $stats['completed'];
        $rate = $totalValid > 0 ? ($stats['no_show'] / $totalValid) : 0;
        $uniquePatients = count($patientVisits);
        $recurrentPatients = 0;
        foreach ($patientVisits as $visits) {
            if ((int) $visits >= 2) {
                $recurrentPatients++;
            }
        }
        $recurrenceRate = $uniquePatients > 0 ? ($recurrentPatients / $uniquePatients) : 0;
        echo "\n# TYPE pielarmonia_no_show_rate gauge";
        echo "\npielarmonia_no_show_rate $rate";
        echo "\n# TYPE pielarmonia_no_show_total gauge";
        echo "\npielarmonia_no_show_total {$stats['no_show']}";
        echo "\n# TYPE pielarmonia_patients_unique_total gauge";
        echo "\npielarmonia_patients_unique_total $uniquePatients";
        echo "\n# TYPE pielarmonia_patients_recurrent_total gauge";
        echo "\npielarmonia_patients_recurrent_total $recurrentPatients";
        echo "\n# TYPE pielarmonia_patient_recurrence_rate gauge";
        echo "\npielarmonia_patient_recurrence_rate $recurrenceRate\n";

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
        foreach ($serviceCounts as $svc => $count) {
            echo "\n# TYPE pielarmonia_service_popularity_total gauge";
            echo "\npielarmonia_service_popularity_total{service=\"$svc\"} $count";
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
