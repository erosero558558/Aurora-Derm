<?php

declare(strict_types=1);

class HealthController
{
    public static function check(array $context): void
    {
        $requestStartedAt = $context['requestStartedAt'] ?? microtime(true);
        $method = $context['method'] ?? 'GET';
        $resource = $context['resource'] ?? 'health';

        $storageReady = ensure_data_file();
        $dataWritable = data_dir_writable();
        $storeEncrypted = store_file_is_encrypted();
        $dataDirSource = function_exists('data_dir_source') ? data_dir_source() : 'unknown';
        $storageBackend = function_exists('storage_backend_mode') ? storage_backend_mode() : 'unknown';
        $sqliteDriverAvailable = function_exists('storage_sqlite_available') ? storage_sqlite_available() : false;
        $jsonFallbackEnabled = function_exists('storage_json_fallback_enabled')
            ? storage_json_fallback_enabled()
            : false;
        $figoEndpoint = self::resolve_figo_endpoint();
        $figoConfigured = $figoEndpoint !== '';
        $figoRecursive = self::is_figo_recursive_config($figoEndpoint);
        $calendarService = CalendarAvailabilityService::fromEnv();
        $calendarActive = $calendarService->isGoogleActive();
        $calendarRequired = $calendarService->isGoogleRequired();
        $calendarRequirementMet = $calendarService->isGoogleRequirementMet();
        $calendarClientConfigured = $calendarActive
            ? $calendarService->getClient()->isConfigured()
            : true;
        $calendarStatusSnapshot = GoogleCalendarClient::readStatusSnapshot();
        $calendarLastSuccessAt = (string) ($calendarStatusSnapshot['lastSuccessAt'] ?? '');
        $calendarLastErrorAt = (string) ($calendarStatusSnapshot['lastErrorAt'] ?? '');
        $calendarLastErrorReason = (string) ($calendarStatusSnapshot['lastErrorReason'] ?? '');
        $calendarReachable = self::resolveCalendarReachable(
            $calendarActive,
            $calendarRequired,
            $calendarClientConfigured,
            $calendarLastSuccessAt,
            $calendarLastErrorAt
        );
        $calendarMode = self::resolveCalendarMode(
            $calendarActive,
            $calendarRequired,
            $calendarService->getBlockOnFailure(),
            $calendarReachable
        );
        $calendarSource = $calendarActive ? 'google' : 'store';
        $calendarAuth = $calendarActive ? $calendarService->getClient()->getAuthMode() : 'none';
        $calendarTokenSnapshot = GoogleTokenProvider::readStatusSnapshot();
        $calendarTokenHealthy = self::resolveCalendarTokenHealthy(
            $calendarActive,
            $calendarRequired,
            $calendarClientConfigured,
            $calendarAuth,
            $calendarTokenSnapshot
        );
        $sentryBackendConfigured = trim((string) getenv('PIELARMONIA_SENTRY_DSN')) !== '';
        $sentryFrontendConfigured = trim((string) getenv('PIELARMONIA_SENTRY_DSN_PUBLIC')) !== '';
        $redisStatus = getenv('PIELARMONIA_REDIS_HOST') ? 'configured' : 'disabled';
        $store = isset($context['store']) && is_array($context['store']) ? $context['store'] : read_store();
        $appointments = isset($store['appointments']) && is_array($store['appointments']) ? $store['appointments'] : [];
        $confirmedAppointments = 0;
        foreach ($appointments as $appointment) {
            $status = map_appointment_status((string) ($appointment['status'] ?? 'confirmed'));
            if ($status !== 'cancelled') {
                $confirmedAppointments++;
            }
        }
        $storeCounts = [
            'appointments' => count($appointments),
            'appointmentsActive' => $confirmedAppointments,
            'callbacks' => isset($store['callbacks']) && is_array($store['callbacks']) ? count($store['callbacks']) : 0,
            'reviews' => isset($store['reviews']) && is_array($store['reviews']) ? count($store['reviews']) : 0,
            'availabilityDays' => isset($store['availability']) && is_array($store['availability']) ? count($store['availability']) : 0
        ];

        $backupCheck = [
            'enabled' => false
        ];
        if (function_exists('backup_latest_status')) {
            if (function_exists('backup_latest_status_fast')) {
                $backupStatus = backup_latest_status_fast();
            } else {
                $backupStatus = backup_latest_status();
            }
            $backupCheck = [
                'enabled' => true,
                'ok' => (bool) ($backupStatus['ok'] ?? false),
                'reason' => (string) ($backupStatus['reason'] ?? ''),
                'count' => (int) ($backupStatus['count'] ?? 0),
                'maxAgeHours' => (int) ($backupStatus['maxAgeHours'] ?? 24),
                'latestAgeHours' => $backupStatus['latestAgeHours'] ?? null,
                'latestValid' => (bool) ($backupStatus['latestValid'] ?? false),
                'latestFresh' => (bool) ($backupStatus['latestFresh'] ?? false),
                'autoRefresh' => isset($backupStatus['autoRefresh']) && is_array($backupStatus['autoRefresh'])
                    ? $backupStatus['autoRefresh']
                    : null,
                'offsiteConfigured' => function_exists('backup_offsite_configured') ? backup_offsite_configured() : false,
                'replicaMode' => function_exists('backup_replica_mode') ? backup_replica_mode() : 'none'
            ];
        }

        $timingMs = (int) round((microtime(true) - $requestStartedAt) * 1000);

        audit_log_event('api.health', [
            'method' => $method,
            'resource' => $resource,
            'storageReady' => $storageReady,
            'timingMs' => $timingMs,
            'version' => app_runtime_version(),
            'dataDirSource' => $dataDirSource,
            'storageBackend' => $storageBackend,
            'sqliteDriverAvailable' => $sqliteDriverAvailable,
            'jsonFallbackEnabled' => $jsonFallbackEnabled,
            'figoConfigured' => $figoConfigured,
            'figoRecursiveConfig' => $figoRecursive,
            'calendarConfigured' => $calendarClientConfigured,
            'calendarReachable' => $calendarReachable,
            'calendarMode' => $calendarMode,
            'calendarSource' => $calendarSource,
            'calendarRequired' => $calendarRequired,
            'calendarRequirementMet' => $calendarRequirementMet,
            'calendarLastSuccessAt' => $calendarLastSuccessAt,
            'calendarLastErrorAt' => $calendarLastErrorAt,
            'calendarLastErrorReason' => $calendarLastErrorReason,
            'calendarTokenHealthy' => $calendarTokenHealthy,
            'sentryBackendConfigured' => $sentryBackendConfigured,
            'sentryFrontendConfigured' => $sentryFrontendConfigured,
        ]);
        json_response([
            'ok' => true,
            'status' => 'ok',
            'storageReady' => $storageReady,
            'timingMs' => $timingMs,
            'version' => app_runtime_version(),
            'dataDirWritable' => $dataWritable,
            'dataDirSource' => $dataDirSource,
            'storageBackend' => $storageBackend,
            'sqliteDriverAvailable' => $sqliteDriverAvailable,
            'jsonFallbackEnabled' => $jsonFallbackEnabled,
            'storeEncrypted' => $storeEncrypted,
            'figoConfigured' => $figoConfigured,
            'figoRecursiveConfig' => $figoRecursive,
            'calendarConfigured' => $calendarClientConfigured,
            'calendarReachable' => $calendarReachable,
            'calendarMode' => $calendarMode,
            'calendarSource' => $calendarSource,
            'calendarAuth' => $calendarAuth,
            'calendarRequired' => $calendarRequired,
            'calendarRequirementMet' => $calendarRequirementMet,
            'calendarTokenHealthy' => $calendarTokenHealthy,
            'calendarLastSuccessAt' => $calendarLastSuccessAt,
            'calendarLastErrorAt' => $calendarLastErrorAt,
            'calendarLastErrorReason' => $calendarLastErrorReason,
            'sentryBackendConfigured' => $sentryBackendConfigured,
            'sentryFrontendConfigured' => $sentryFrontendConfigured,
            'checks' => [
                'storage' => [
                    'ready' => $storageReady,
                    'writable' => $dataWritable,
                    'encrypted' => $storeEncrypted,
                    'source' => $dataDirSource,
                    'backend' => $storageBackend,
                    'sqliteDriverAvailable' => $sqliteDriverAvailable,
                    'jsonFallbackEnabled' => $jsonFallbackEnabled
                ],
                'redis' => $redisStatus,
                'php_version' => PHP_VERSION,
                'calendar' => [
                    'calendarConfigured' => $calendarClientConfigured,
                    'calendarReachable' => $calendarReachable,
                    'calendarMode' => $calendarMode,
                    'calendarSource' => $calendarSource,
                    'calendarAuth' => $calendarAuth,
                    'calendarRequired' => $calendarRequired,
                    'calendarRequirementMet' => $calendarRequirementMet,
                    'calendarTokenHealthy' => $calendarTokenHealthy,
                    'calendarLastSuccessAt' => $calendarLastSuccessAt,
                    'calendarLastErrorAt' => $calendarLastErrorAt,
                    'calendarLastErrorReason' => $calendarLastErrorReason,
                ],
                'observability' => [
                    'sentryBackendConfigured' => $sentryBackendConfigured,
                    'sentryFrontendConfigured' => $sentryFrontendConfigured,
                ],
                'backup' => $backupCheck,
                'storeCounts' => $storeCounts
            ],
            'timestamp' => local_date('c')
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

    private static function resolve_figo_endpoint(): string
    {
        $envCandidates = [
            getenv('FIGO_CHAT_ENDPOINT'),
            getenv('FIGO_CHAT_URL'),
            getenv('FIGO_CHAT_API_URL'),
            getenv('FIGO_ENDPOINT'),
            getenv('FIGO_URL'),
            getenv('CLAWBOT_ENDPOINT'),
            getenv('CLAWBOT_URL'),
            getenv('CHATBOT_ENDPOINT'),
            getenv('CHATBOT_URL'),
            getenv('BOT_ENDPOINT'),
            getenv('PIELARMONIA_FIGO_ENDPOINT')
        ];

        foreach ($envCandidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        $configCandidates = [];
        $customPath = getenv('FIGO_CHAT_CONFIG_PATH');
        if (is_string($customPath) && trim($customPath) !== '') {
            $configCandidates[] = trim($customPath);
        }

        $configCandidates[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
        $configCandidates[] = __DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'figo-config.json';

        foreach ($configCandidates as $path) {
            if (!is_string($path) || $path === '' || !is_file($path)) {
                continue;
            }
            $raw = @file_get_contents($path);
            if (!is_string($raw) || trim($raw) === '') {
                continue;
            }
            $decoded = json_decode($raw, true);
            if (!is_array($decoded)) {
                continue;
            }
            $fileCandidates = [
                $decoded['endpoint'] ?? null,
                $decoded['apiUrl'] ?? null,
                $decoded['url'] ?? null
            ];
            foreach ($fileCandidates as $candidate) {
                if (is_string($candidate) && trim($candidate) !== '') {
                    return trim($candidate);
                }
            }
        }

        return '';
    }

    private static function is_figo_recursive_config(string $endpoint): bool
    {
        $endpoint = trim($endpoint);
        if ($endpoint === '') {
            return false;
        }

        $parts = @parse_url($endpoint);
        if (!is_array($parts)) {
            return false;
        }

        $endpointHost = strtolower((string) ($parts['host'] ?? ''));
        $endpointPath = strtolower((string) ($parts['path'] ?? ''));
        $currentHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));

        $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/api.php');
        $requestPath = strtolower((string) parse_url($requestUri, PHP_URL_PATH));
        if ($requestPath === '') {
            $requestPath = '/api.php';
        }

        if ($endpointHost === '' || $currentHost === '') {
            return false;
        }

        $normalizedEndpointHost = preg_replace('/^www\./', '', $endpointHost);
        $normalizedCurrentHost = preg_replace('/^www\./', '', $currentHost);

        if ($normalizedEndpointHost !== $normalizedCurrentHost) {
            return false;
        }

        if ($endpointPath === '') {
            return false;
        }

        if ($endpointPath === $requestPath) {
            return true;
        }

        return $endpointPath === '/figo-chat.php';
    }
}
