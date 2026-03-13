<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/QueueService.php';
require_once __DIR__ . '/../lib/QueueSurfaceStatusStore.php';
require_once __DIR__ . '/../lib/AppDownloadsCatalog.php';
require_once __DIR__ . '/../lib/CaseMediaFlowService.php';
require_once __DIR__ . '/../lib/TurneroClinicProfile.php';
require_once __DIR__ . '/../lib/telemedicine/TelemedicineOpsSnapshot.php';
require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';

class AdminDataController
{
    public static function index(array $context): void
    {
        // GET /data (Admin)
        $store = $context['store'];
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

        $store['appDownloads'] = self::buildAppDownloads();
        $store['turneroClinicProfile'] = read_turnero_clinic_profile();
        $store['turneroClinicProfileCatalogStatus'] = read_turnero_clinic_profile_catalog_status();
        $store['queueSurfaceStatus'] = QueueSurfaceStatusStore::readSummary();

        $store['telemedicineMeta'] = TelemedicineOpsSnapshot::forAdmin(
            TelemedicineOpsSnapshot::build($store)
        );
        $store['clinicalHistoryMeta'] = ClinicalHistoryOpsSnapshot::forAdmin(
            ClinicalHistoryOpsSnapshot::build($store)
        );
        $store['mediaFlowMeta'] = CaseMediaFlowService::buildAdminMeta($store);

        json_response([
            'ok' => true,
            'data' => $store
        ]);
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
        $store['appointments'] = isset($payload['appointments']) && is_array($payload['appointments']) ? $payload['appointments'] : [];
        $store['callbacks'] = isset($payload['callbacks']) && is_array($payload['callbacks']) ? $payload['callbacks'] : [];
        $store['reviews'] = isset($payload['reviews']) && is_array($payload['reviews']) ? $payload['reviews'] : [];
        $store['queue_tickets'] = isset($payload['queue_tickets']) && is_array($payload['queue_tickets']) ? $payload['queue_tickets'] : [];
        $store['queue_help_requests'] = isset($payload['queue_help_requests']) && is_array($payload['queue_help_requests'])
            ? $payload['queue_help_requests']
            : [];
        if (isset($payload['telemedicine_intakes']) && is_array($payload['telemedicine_intakes'])) {
            $store['telemedicine_intakes'] = $payload['telemedicine_intakes'];
        }
        if (isset($payload['clinical_uploads']) && is_array($payload['clinical_uploads'])) {
            $store['clinical_uploads'] = $payload['clinical_uploads'];
        }
        if (isset($payload['clinical_history_sessions']) && is_array($payload['clinical_history_sessions'])) {
            $store['clinical_history_sessions'] = $payload['clinical_history_sessions'];
        }
        if (isset($payload['clinical_history_drafts']) && is_array($payload['clinical_history_drafts'])) {
            $store['clinical_history_drafts'] = $payload['clinical_history_drafts'];
        }
        if (isset($payload['clinical_history_events']) && is_array($payload['clinical_history_events'])) {
            $store['clinical_history_events'] = $payload['clinical_history_events'];
        }
        if (isset($payload['case_media_proposals']) && is_array($payload['case_media_proposals'])) {
            $store['case_media_proposals'] = $payload['case_media_proposals'];
        }
        if (isset($payload['case_media_publications']) && is_array($payload['case_media_publications'])) {
            $store['case_media_publications'] = $payload['case_media_publications'];
        }
        if (isset($payload['case_media_events']) && is_array($payload['case_media_events'])) {
            $store['case_media_events'] = $payload['case_media_events'];
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
