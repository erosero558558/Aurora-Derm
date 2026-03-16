<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/QueueService.php';
require_once __DIR__ . '/../lib/QueueSurfaceStatusStore.php';
require_once __DIR__ . '/../lib/AppDownloadsCatalog.php';
require_once __DIR__ . '/../lib/PatientCaseService.php';
require_once __DIR__ . '/../lib/InternalConsoleReadiness.php';
require_once __DIR__ . '/../lib/TurneroClinicProfile.php';
require_once __DIR__ . '/../lib/TurneroOperatorAccess.php';
require_once __DIR__ . '/../lib/clinical_history/bootstrap.php';
require_once __DIR__ . '/../lib/CaseMediaFlowService.php';
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
        $store['clinicalHistoryMeta'] = ClinicalHistoryOpsSnapshot::forAdmin(
            ClinicalHistoryOpsSnapshot::build($store)
        );
        $store['mediaFlowMeta'] = CaseMediaFlowService::buildAdminMeta($store);
        $store['telemedicineMeta'] = TelemedicineOpsSnapshot::forAdmin(
            TelemedicineOpsSnapshot::build($store)
        );
        $store['internalConsoleMeta'] = function_exists('internal_console_readiness_snapshot')
            ? internal_console_readiness_snapshot()
            : null;
        $store['turneroClinicProfile'] = read_turnero_clinic_profile();
        $store['turneroClinicProfileMeta'] = read_turnero_clinic_profile_runtime_meta();
        $store['turneroClinicProfileCatalogStatus'] = read_turnero_clinic_profile_catalog_status();
        $store['turneroOperatorAccessMeta'] = turnero_operator_access_meta();
        $store = self::redactClinicalReadModelsIfBlocked($store);

        $store['appDownloads'] = self::buildAppDownloads();
        $store['queueSurfaceStatus'] = QueueSurfaceStatusStore::readSummary();
        $store['turneroV2Readiness'] = self::buildTurneroV2Readiness($store);

        if (($context['isQueueOperator'] ?? false) === true && ($context['isAdmin'] ?? false) !== true) {
            $store = self::buildQueueOperatorStore($store, $context);
        }

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

        if (isset($store['clinicalHistoryMeta']) && is_array($store['clinicalHistoryMeta'])) {
            $store['clinicalHistoryMeta'] = array_merge($store['clinicalHistoryMeta'], [
                'reviewQueue' => [],
                'events' => [],
            ]);
        }

        if (isset($store['mediaFlowMeta']) && is_array($store['mediaFlowMeta'])) {
            $store['mediaFlowMeta'] = array_merge($store['mediaFlowMeta'], [
                'queue' => [],
                'recentEvents' => [],
            ]);
        }

        if (isset($store['telemedicineMeta']) && is_array($store['telemedicineMeta'])) {
            $store['telemedicineMeta'] = array_merge($store['telemedicineMeta'], [
                'reviewQueue' => [],
            ]);
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

    private static function buildQueueOperatorStore(array $store, array $context): array
    {
        $queueOperatorSession = isset($context['queueOperatorSession']) && is_array($context['queueOperatorSession'])
            ? $context['queueOperatorSession']
            : null;

        return [
            'appointments' => [],
            'callbacks' => [],
            'reviews' => [],
            'availability' => [],
            'availabilityMeta' => [],
            'queue_tickets' => isset($store['queue_tickets']) && is_array($store['queue_tickets'])
                ? $store['queue_tickets']
                : [],
            'queueMeta' => isset($store['queueMeta']) && is_array($store['queueMeta'])
                ? $store['queueMeta']
                : null,
            'queueSurfaceStatus' => isset($store['queueSurfaceStatus']) && is_array($store['queueSurfaceStatus'])
                ? $store['queueSurfaceStatus']
                : null,
            'appDownloads' => isset($store['appDownloads']) && is_array($store['appDownloads'])
                ? $store['appDownloads']
                : null,
            'turneroClinicProfile' => isset($store['turneroClinicProfile']) && is_array($store['turneroClinicProfile'])
                ? $store['turneroClinicProfile']
                : null,
            'turneroClinicProfileMeta' => isset($store['turneroClinicProfileMeta']) && is_array($store['turneroClinicProfileMeta'])
                ? $store['turneroClinicProfileMeta']
                : null,
            'turneroClinicProfileCatalogStatus' => isset($store['turneroClinicProfileCatalogStatus']) && is_array($store['turneroClinicProfileCatalogStatus'])
                ? $store['turneroClinicProfileCatalogStatus']
                : null,
            'turneroOperatorAccessMeta' => isset($store['turneroOperatorAccessMeta']) && is_array($store['turneroOperatorAccessMeta'])
                ? $store['turneroOperatorAccessMeta']
                : null,
            'turneroV2Readiness' => isset($store['turneroV2Readiness']) && is_array($store['turneroV2Readiness'])
                ? $store['turneroV2Readiness']
                : null,
            'queueOperatorSession' => $queueOperatorSession,
            'funnelMetrics' => [],
        ];
    }

    private static function buildTurneroV2Readiness(array $store): array
    {
        $profile = isset($store['turneroClinicProfile']) && is_array($store['turneroClinicProfile'])
            ? $store['turneroClinicProfile']
            : read_turnero_clinic_profile();
        $release = isset($profile['release']) && is_array($profile['release'])
            ? $profile['release']
            : [];
        $releaseMode = trim((string) ($release['mode'] ?? ''));
        $nativeAppsBlocking = (bool) ($release['native_apps_blocking'] ?? false);
        $operatorAccessMeta = isset($store['turneroOperatorAccessMeta']) && is_array($store['turneroOperatorAccessMeta'])
            ? $store['turneroOperatorAccessMeta']
            : turnero_operator_access_meta();
        $surfaceStatus = isset($store['queueSurfaceStatus']) && is_array($store['queueSurfaceStatus'])
            ? $store['queueSurfaceStatus']
            : QueueSurfaceStatusStore::readSummary();

        $operatorSurface = self::buildTurneroSurfaceReadiness(
            'operator',
            'desktop',
            $surfaceStatus['operator'] ?? null,
            $nativeAppsBlocking
        );
        $kioskSurface = self::buildTurneroSurfaceReadiness(
            'kiosk',
            'desktop',
            $surfaceStatus['kiosk'] ?? null,
            $nativeAppsBlocking
        );
        $displaySurface = self::buildTurneroSurfaceReadiness(
            'display',
            'android_tv',
            $surfaceStatus['display'] ?? null,
            $nativeAppsBlocking
        );

        $adminReady = (string) ($release['admin_mode_default'] ?? '') === 'basic'
            && !empty($profile['surfaces']['admin']['enabled'])
            && trim((string) ($profile['surfaces']['admin']['route'] ?? '')) !== '';
        $adminSurface = [
            'surface' => 'admin',
            'label' => 'Admin',
            'expectedAppMode' => 'web',
            'appMode' => 'web',
            'ready' => $adminReady,
            'blocking' => false,
            'state' => $adminReady ? 'ready' : 'warning',
            'summary' => $adminReady
                ? 'Admin listo como consola de supervisión y fallback.'
                : 'Admin debe quedar habilitado en basic como consola de recuperación.',
            'stale' => false,
            'updatedAt' => '',
        ];

        $operatorDetails = self::surfaceLatestDetails($surfaceStatus['operator'] ?? null);
        $kioskDetails = self::surfaceLatestDetails($surfaceStatus['kiosk'] ?? null);
        $displayDetails = self::surfaceLatestDetails($surfaceStatus['display'] ?? null);

        $hardware = [
            'assistant' => self::buildTurneroHardwareReadiness(
                trim((string) ($kioskDetails['assistantSessionId'] ?? '')) !== '',
                'Asistente de kiosco',
                trim((string) ($kioskDetails['assistantSessionId'] ?? '')) !== ''
                    ? 'Asistente activo y midiendo sesiones.'
                    : 'Falta confirmar el asistente del kiosco con una sesión activa.'
            ),
            'printer' => self::buildTurneroHardwareReadiness(
                (bool) ($kioskDetails['printerPrinted'] ?? false),
                'Impresora térmica',
                (bool) ($kioskDetails['printerPrinted'] ?? false)
                    ? 'Impresora térmica validada con ticket reciente.'
                    : 'Falta una impresión térmica satisfactoria para salida.'
            ),
            'numpad' => self::buildTurneroHardwareReadiness(
                (bool) ($operatorDetails['numpadReady'] ?? false),
                'Numpad operador',
                (bool) ($operatorDetails['numpadReady'] ?? false)
                    ? 'Numpad operativo confirmado.'
                    : 'Falta validar el numpad antes del primer llamado.'
            ),
            'desktopShell' => self::buildTurneroHardwareReadiness(
                ($operatorSurface['ready'] ?? false) === true && ($kioskSurface['ready'] ?? false) === true,
                'Shell desktop',
                (($operatorSurface['ready'] ?? false) === true && ($kioskSurface['ready'] ?? false) === true)
                    ? 'Operator y kiosk reportan shell nativa lista.'
                    : 'Falta confirmar operator y kiosk como apps nativas listas.'
            ),
            'tvAudio' => self::buildTurneroHardwareReadiness(
                (bool) ($displayDetails['bellPrimed'] ?? false) && !($displayDetails['bellMuted'] ?? false),
                'Audio sala TV',
                ((bool) ($displayDetails['bellPrimed'] ?? false) && !($displayDetails['bellMuted'] ?? false))
                    ? 'Audio y campanilla de sala TV listos.'
                    : 'Falta destrabar audio o reactivar campanilla en sala TV.'
            ),
            'syncMode' => self::buildTurneroHardwareReadiness(
                (string) ($operatorDetails['queueSyncMode'] ?? '') === 'live'
                    && (string) ($kioskDetails['connection'] ?? '') === 'live'
                    && (string) ($displayDetails['connection'] ?? '') === 'live',
                'Sync clínico',
                (
                    (string) ($operatorDetails['queueSyncMode'] ?? '') === 'live'
                    && (string) ($kioskDetails['connection'] ?? '') === 'live'
                    && (string) ($displayDetails['connection'] ?? '') === 'live'
                )
                    ? 'Operator, kiosk y display reportan sync vivo.'
                    : 'Alguna superficie sigue en fallback, paused u offline.'
            ),
        ];

        $surfaceBlockingCount = count(array_filter([
            !$operatorSurface['ready'],
            !$kioskSurface['ready'],
            !$displaySurface['ready'],
            !((bool) ($operatorAccessMeta['configured'] ?? false)),
        ]));
        $hardwareBlockingCount = count(array_filter([
            !((bool) ($hardware['assistant']['ready'] ?? false)),
            !((bool) ($hardware['printer']['ready'] ?? false)),
            !((bool) ($hardware['numpad']['ready'] ?? false)),
            !((bool) ($hardware['desktopShell']['ready'] ?? false)),
            !((bool) ($hardware['tvAudio']['ready'] ?? false)),
            !((bool) ($hardware['syncMode']['ready'] ?? false)),
        ]));
        $blockingCount = $surfaceBlockingCount + $hardwareBlockingCount;

        return [
            'enabled' => $releaseMode === 'suite_v2',
            'releaseMode' => $releaseMode,
            'nativeAppsBlocking' => $nativeAppsBlocking,
            'ready' => $releaseMode === 'suite_v2' && $blockingCount === 0,
            'blockingCount' => $releaseMode === 'suite_v2' ? $blockingCount : 0,
            'surfaceBlockingCount' => $releaseMode === 'suite_v2' ? $surfaceBlockingCount : 0,
            'hardwareBlockingCount' => $releaseMode === 'suite_v2' ? $hardwareBlockingCount : 0,
            'operatorAccess' => [
                'configured' => (bool) ($operatorAccessMeta['configured'] ?? false),
                'detail' => (bool) ($operatorAccessMeta['configured'] ?? false)
                    ? 'PIN operativo configurado.'
                    : 'Falta configurar el PIN operativo de la clínica.',
            ],
            'surfaces' => [
                'admin' => $adminSurface,
                'operator' => $operatorSurface,
                'kiosk' => $kioskSurface,
                'display' => $displaySurface,
            ],
            'hardware' => $hardware,
            'generatedAt' => local_date('c'),
        ];
    }

    private static function buildTurneroSurfaceReadiness(
        string $surfaceKey,
        string $expectedAppMode,
        $surfaceGroup,
        bool $nativeAppsBlocking
    ): array {
        $group = is_array($surfaceGroup) ? $surfaceGroup : [];
        $latest = isset($group['latest']) && is_array($group['latest']) ? $group['latest'] : [];
        $appMode = trim((string) ($latest['appMode'] ?? ''));
        $effectiveStatus = trim((string) ($latest['effectiveStatus'] ?? $latest['status'] ?? 'unknown'));
        $statusReady = $effectiveStatus === 'ready' && (($latest['stale'] ?? true) !== true);
        $nativeModeReady = !$nativeAppsBlocking || $appMode === $expectedAppMode;
        $ready = $statusReady && $nativeModeReady;

        return [
            'surface' => $surfaceKey,
            'label' => (string) ($group['label'] ?? ucfirst($surfaceKey)),
            'expectedAppMode' => $expectedAppMode,
            'appMode' => $appMode,
            'ready' => $ready,
            'blocking' => true,
            'state' => $ready ? 'ready' : ($statusReady ? 'warning' : 'alert'),
            'summary' => $ready
                ? (string) ($group['summary'] ?? 'Superficie lista.')
                : (!$statusReady
                    ? (string) ($group['summary'] ?? 'Sin heartbeat listo.')
                    : sprintf('La superficie reporta %s, pero suite_v2 exige %s.', $appMode !== '' ? $appMode : 'modo desconocido', $expectedAppMode)),
            'stale' => (bool) ($latest['stale'] ?? true),
            'updatedAt' => (string) ($latest['updatedAt'] ?? ''),
        ];
    }

    /**
     * @param mixed $surfaceGroup
     * @return array<string,mixed>
     */
    private static function surfaceLatestDetails($surfaceGroup): array
    {
        $group = is_array($surfaceGroup) ? $surfaceGroup : [];
        $latest = isset($group['latest']) && is_array($group['latest']) ? $group['latest'] : [];
        return isset($latest['details']) && is_array($latest['details']) ? $latest['details'] : [];
    }

    /**
     * @return array<string,mixed>
     */
    private static function buildTurneroHardwareReadiness(bool $ready, string $label, string $detail): array
    {
        return [
            'label' => $label,
            'ready' => $ready,
            'state' => $ready ? 'ready' : 'warning',
            'detail' => $detail,
        ];
    }
}
