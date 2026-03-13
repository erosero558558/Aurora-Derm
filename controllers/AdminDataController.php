<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/QueueService.php';
require_once __DIR__ . '/../lib/QueueSurfaceStatusStore.php';
require_once __DIR__ . '/../lib/AppDownloadsCatalog.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineOpsSnapshot.php';

class AdminDataController
{
    public static function index(array $context): void
    {
        // GET /data (Admin)
        $patientCaseService = new PatientCaseService();
        $store = $patientCaseService->hydrateStore($context['store']);
        $availabilityService = CalendarAvailabilityService::fromEnv();
        $calendarClient = $availabilityService->getClient();
        $calendarActive = $availabilityService->isGoogleActive();
        $calendarRequired = $availabilityService->isGoogleRequired();
        $calendarRequirementMet = $availabilityService->isGoogleRequirementMet();
        $calendarConfigured = $calendarActive ? $calendarClient->isConfigured() : true;
        $maskedCalendars = $availabilityService->getDoctorCalendarMapMasked();
        $rawCalendars = $calendarClient->getDoctorCalendarMap();
        $calendarStatus = GoogleCalendarClient::readStatusSnapshot();
        $calendarLastSuccessAt = (string) ($calendarStatus['lastSuccessAt'] ?? '');
        $calendarLastErrorAt = (string) ($calendarStatus['lastErrorAt'] ?? '');
        $calendarLastErrorReason = (string) ($calendarStatus['lastErrorReason'] ?? '');
        $calendarReachable = self::resolveCalendarReachable(
            $calendarActive,
            $calendarRequired,
            $calendarConfigured,
            $calendarLastSuccessAt,
            $calendarLastErrorAt
        );
        $calendarMode = self::resolveCalendarMode(
            $calendarActive,
            $calendarRequired,
            $availabilityService->getBlockOnFailure(),
            $calendarReachable
        );
        $calendarAuth = $calendarActive ? $calendarClient->getAuthMode() : 'none';
        $calendarTokenSnapshot = GoogleTokenProvider::readStatusSnapshot();
        $calendarTokenHealthy = self::resolveCalendarTokenHealthy(
            $calendarActive,
            $calendarRequired,
            $calendarConfigured,
            $calendarAuth,
            $calendarTokenSnapshot
        );
        $doctorCalendars = [];
        foreach (['rosero', 'narvaez'] as $doctor) {
            $calendarId = trim((string) ($rawCalendars[$doctor] ?? ''));
            $doctorCalendars[$doctor] = [
                'idMasked' => (string) ($maskedCalendars[$doctor] ?? ''),
                'openUrl' => $calendarId !== ''
                    ? 'https://calendar.google.com/calendar/u/0/r?cid=' . rawurlencode($calendarId)
                    : '',
            ];
        }

        $store['availabilityMeta'] = [
            'source' => $calendarActive ? 'google' : 'store',
            'mode' => $calendarMode,
            'timezone' => $calendarClient->getTimezone(),
            'calendarAuth' => $calendarAuth,
            'calendarRequired' => $calendarRequired,
            'calendarRequirementMet' => $calendarRequirementMet,
            'calendarTokenHealthy' => $calendarTokenHealthy,
            'calendarConfigured' => $calendarConfigured,
            'calendarReachable' => $calendarReachable,
            'calendarLastSuccessAt' => $calendarLastSuccessAt,
            'calendarLastErrorAt' => $calendarLastErrorAt,
            'calendarLastErrorReason' => $calendarLastErrorReason,
            'doctorCalendars' => $doctorCalendars,
            'generatedAt' => local_date('c'),
        ];

        if (class_exists('AnalyticsController') && method_exists('AnalyticsController', 'buildFunnelMetricsData')) {
            try {
                $store['funnelMetrics'] = AnalyticsController::buildFunnelMetricsData($context);
            } catch (\Throwable $th) {
                // Keep /data resilient if metrics export is temporarily unavailable.
                $store['funnelMetrics'] = null;
            }
        }

        $store['callbacks'] = LeadOpsService::enrichCallbacks(
            isset($store['callbacks']) && is_array($store['callbacks']) ? $store['callbacks'] : [],
            $store,
            isset($store['funnelMetrics']) && is_array($store['funnelMetrics']) ? $store['funnelMetrics'] : null
        );
        $store['leadOpsMeta'] = LeadOpsService::buildMeta(
            $store['callbacks'],
            $store,
            isset($store['funnelMetrics']) && is_array($store['funnelMetrics']) ? $store['funnelMetrics'] : null
        );

        try {
            $queueService = new QueueService();
            $store['queueMeta'] = $queueService->buildAdminSummary($store);
        } catch (\Throwable $th) {
            $store['queueMeta'] = null;
        }

        $store['patientFlowMeta'] = $patientCaseService->buildSummary($store);
        $store['internalConsoleMeta'] = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $store = self::redactClinicalReadModelsIfBlocked($store);

        $store['appDownloads'] = self::buildAppDownloads();
        $store['queueSurfaceStatus'] = QueueSurfaceStatusStore::readSummary();

        $store['telemedicineMeta'] = TelemedicineOpsSnapshot::forAdmin(
            TelemedicineOpsSnapshot::build($store)
        );

        json_response([
            'ok' => true,
            'data' => $store
        ]);
    }

    private static function redactClinicalReadModelsIfBlocked(array $store): array
    {
        $internalConsoleMeta = isset($store['internalConsoleMeta']) && is_array($store['internalConsoleMeta'])
            ? $store['internalConsoleMeta']
            : [];
        $clinicalReady = (bool) ($internalConsoleMeta['clinicalData']['ready'] ?? true);
        if ($clinicalReady) {
            return $store;
        }

        foreach ([
            'patient_cases',
            'patient_case_links',
            'patient_case_timeline_events',
            'patient_case_approvals',
            'clinical_uploads',
            'telemedicine_intakes',
        ] as $key) {
            $store[$key] = [];
        }

        return $store;
    }

    public static function import(array $context): void
    {
        // POST /import (Admin)
        $store = $context['store'];
        if (!$context['isAdmin']) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
        require_csrf();

        $payload = require_json_body();
        $clinicalFields = array_values(array_intersect(
            ['patient_case_approvals', 'telemedicine_intakes', 'clinical_uploads'],
            array_keys(is_array($payload) ? $payload : [])
        ));
        if ($clinicalFields !== [] && function_exists('internal_console_clinical_data_ready') && !internal_console_clinical_data_ready()) {
            $response = function_exists('internal_console_clinical_guard_payload')
                ? internal_console_clinical_guard_payload([
                    'clinicalFields' => $clinicalFields,
                ])
                : [
                    'ok' => false,
                    'code' => 'clinical_storage_not_ready',
                    'error' => 'Historias clinicas bloqueadas hasta habilitar almacenamiento cifrado.',
                    'clinicalFields' => $clinicalFields,
                ];
            json_response($response, 409);
        }

        $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
        $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
        $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
        $store['queue_tickets'] = isset($payload['queue_tickets']) && is_array($payload['queue_tickets']) ? $payload['queue_tickets'] : [];
        $store['queue_help_requests'] = isset($payload['queue_help_requests']) && is_array($payload['queue_help_requests'])
            ? $payload['queue_help_requests']
            : [];
        if (isset($payload['patient_case_approvals']) && is_array($payload['patient_case_approvals'])) {
            $store['patient_case_approvals'] = $payload['patient_case_approvals'];
        }
        if (isset($payload['telemedicine_intakes']) && is_array($payload['telemedicine_intakes'])) {
            $store['telemedicine_intakes'] = $payload['telemedicine_intakes'];
        }
        if (isset($payload['clinical_uploads']) && is_array($payload['clinical_uploads'])) {
            $store['clinical_uploads'] = $payload['clinical_uploads'];
        }
        $store['availability'] = isset($payload['availability']) && is_array($payload['availability']) ? $payload['availability'] : [];
        write_store($store);
        json_response([
            'ok' => true
        ]);
    }

    private static function resolveCalendarReachable(
        bool $calendarActive,
        bool $calendarRequired,
        bool $calendarConfigured,
        string $lastSuccessAt,
        string $lastErrorAt
    ): bool {
        if (!$calendarActive) {
            return !$calendarRequired;
        }
        if (!$calendarConfigured) {
            return false;
        }
        if ($lastSuccessAt === '' && $lastErrorAt === '') {
            return true;
        }
        if ($lastSuccessAt === '') {
            return false;
        }
        if ($lastErrorAt === '') {
            return true;
        }
        return !self::timestampGreater($lastErrorAt, $lastSuccessAt);
    }

    private static function resolveCalendarMode(
        bool $calendarActive,
        bool $calendarRequired,
        bool $blockOnFailure,
        bool $calendarReachable
    ): string {
        if (!$calendarActive) {
            return $calendarRequired ? 'blocked' : 'live';
        }
        if ($blockOnFailure && !$calendarReachable) {
            return 'blocked';
        }
        return 'live';
    }

    private static function resolveCalendarTokenHealthy(
        bool $calendarActive,
        bool $calendarRequired,
        bool $calendarConfigured,
        string $calendarAuth,
        array $tokenSnapshot
    ): bool {
        if (!$calendarActive) {
            return !$calendarRequired;
        }
        if (!$calendarConfigured) {
            return false;
        }
        if (!in_array($calendarAuth, ['oauth_refresh', 'service_account'], true)) {
            return false;
        }

        $expiresAt = (int) ($tokenSnapshot['expiresAt'] ?? 0);
        if ($expiresAt > (time() + 30)) {
            return true;
        }

        $lastSuccessAt = (string) ($tokenSnapshot['lastSuccessAt'] ?? '');
        $lastErrorAt = (string) ($tokenSnapshot['lastErrorAt'] ?? '');
        if ($lastSuccessAt === '' && $lastErrorAt === '') {
            return false;
        }
        if ($lastSuccessAt === '') {
            return false;
        }
        if ($lastErrorAt === '') {
            return true;
        }
        return !self::timestampGreater($lastErrorAt, $lastSuccessAt);
    }

    private static function timestampGreater(string $leftIso, string $rightIso): bool
    {
        $left = strtotime($leftIso);
        $right = strtotime($rightIso);
        if ($left === false || $right === false) {
            return false;
        }
        return $left > $right;
    }

    private static function buildAppDownloads(): array
    {
        return build_app_downloads_runtime_payload();
    }
}
