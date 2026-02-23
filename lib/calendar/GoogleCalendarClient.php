<?php

declare(strict_types=1);

require_once __DIR__ . '/../common.php';

class GoogleCalendarClient
{
    private GoogleTokenProvider $tokenProvider;
    private string $timezone;
    private string $baseUrl;
    private int $timeoutMs;
    private array $doctorCalendarMap;
    private string $statusPath;
    private int $cacheTtlSec;

    public function __construct(
        GoogleTokenProvider $tokenProvider,
        string $timezone,
        array $doctorCalendarMap,
        string $baseUrl = 'https://www.googleapis.com/calendar/v3',
        int $timeoutMs = 8500,
        int $cacheTtlSec = 60
    ) {
        $this->tokenProvider = $tokenProvider;
        $this->timezone = trim($timezone) !== '' ? trim($timezone) : APP_TIMEZONE;
        $this->doctorCalendarMap = $doctorCalendarMap;
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->timeoutMs = max(2000, $timeoutMs);
        $this->cacheTtlSec = max(0, min(300, $cacheTtlSec));
        $statusDir = data_dir_path() . DIRECTORY_SEPARATOR . 'cache';
        if (!is_dir($statusDir)) {
            @mkdir($statusDir, 0775, true);
        }
        $this->statusPath = $statusDir . DIRECTORY_SEPARATOR . 'calendar-status.json';
    }

    public static function fromEnv(): self
    {
        $map = [
            'rosero' => (string) (getenv('PIELARMONIA_GOOGLE_CALENDAR_ID_ROSERO') ?: ''),
            'narvaez' => (string) (getenv('PIELARMONIA_GOOGLE_CALENDAR_ID_NARVAEZ') ?: ''),
        ];
        $cacheTtlSec = (int) (getenv('PIELARMONIA_CALENDAR_CACHE_TTL_SEC') ?: 60);

        return new self(
            GoogleTokenProvider::fromEnv(),
            (string) (getenv('PIELARMONIA_CALENDAR_TIMEZONE') ?: APP_TIMEZONE),
            $map,
            'https://www.googleapis.com/calendar/v3',
            8500,
            $cacheTtlSec
        );
    }

    public function isConfigured(): bool
    {
        if (!$this->tokenProvider->isConfigured()) {
            return false;
        }
        return $this->doctorCalendarMap['rosero'] !== '' && $this->doctorCalendarMap['narvaez'] !== '';
    }

    public function getTimezone(): string
    {
        return $this->timezone;
    }

    public function getAuthMode(): string
    {
        if (!$this->tokenProvider->isConfigured()) {
            return 'none';
        }
        $mode = $this->tokenProvider->getAuthMode();
        return $mode !== '' ? $mode : 'none';
    }

    public function getDoctorCalendarMap(): array
    {
        return [
            'rosero' => (string) ($this->doctorCalendarMap['rosero'] ?? ''),
            'narvaez' => (string) ($this->doctorCalendarMap['narvaez'] ?? ''),
        ];
    }

    public function getCalendarIdForDoctor(string $doctor): string
    {
        $doctor = strtolower(trim($doctor));
        if (!in_array($doctor, ['rosero', 'narvaez'], true)) {
            return '';
        }
        return (string) ($this->doctorCalendarMap[$doctor] ?? '');
    }

    public function freeBusy(array $calendarIds, string $timeMinIso, string $timeMaxIso, bool $bypassCache = false): array
    {
        $items = [];
        foreach ($calendarIds as $calendarId) {
            $id = trim((string) $calendarId);
            if ($id === '') {
                continue;
            }
            $items[] = ['id' => $id];
        }
        if (count($items) === 0) {
            return [
                'ok' => false,
                'error' => 'Sin calendarios configurados',
                'code' => 'calendar_not_configured',
                'status' => 500,
            ];
        }

        $cacheKey = $this->buildFreeBusyCacheKey($calendarIds, $timeMinIso, $timeMaxIso);
        if (!$bypassCache) {
            $cached = $this->readFreeBusyCache($cacheKey);
            if (is_array($cached)) {
                return [
                    'ok' => true,
                    'status' => 200,
                    'data' => $cached,
                    'cached' => true,
                ];
            }
        }

        $response = $this->request(
            'freebusy_query',
            'POST',
            '/freeBusy',
            [],
            [
                'timeMin' => $timeMinIso,
                'timeMax' => $timeMaxIso,
                'timeZone' => $this->timezone,
                'items' => $items,
            ]
        );

        if (!$bypassCache && ($response['ok'] ?? false) === true && isset($response['data']) && is_array($response['data'])) {
            $this->writeFreeBusyCache($cacheKey, $response['data']);
        }

        return $response;
    }

    public function createEvent(string $calendarId, array $payload): array
    {
        $calendarId = trim($calendarId);
        if ($calendarId === '') {
            return [
                'ok' => false,
                'error' => 'CalendarId inválido',
                'code' => 'calendar_not_configured',
                'status' => 500,
            ];
        }

        $response = $this->request(
            'events_insert',
            'POST',
            '/calendars/' . rawurlencode($calendarId) . '/events',
            [],
            $payload
        );
        if (($response['ok'] ?? false) === true) {
            $this->purgeFreeBusyCache();
        }
        return $response;
    }

    public function patchEvent(string $calendarId, string $eventId, array $payload): array
    {
        $calendarId = trim($calendarId);
        $eventId = trim($eventId);
        if ($calendarId === '' || $eventId === '') {
            return [
                'ok' => false,
                'error' => 'Parámetros inválidos para actualización',
                'code' => 'calendar_bad_request',
                'status' => 400,
            ];
        }

        $response = $this->request(
            'events_patch',
            'PATCH',
            '/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode($eventId),
            [],
            $payload
        );
        if (($response['ok'] ?? false) === true) {
            $this->purgeFreeBusyCache();
        }
        return $response;
    }

    public function deleteEvent(string $calendarId, string $eventId): array
    {
        $calendarId = trim($calendarId);
        $eventId = trim($eventId);
        if ($calendarId === '' || $eventId === '') {
            return [
                'ok' => false,
                'error' => 'Parámetros inválidos para eliminación',
                'code' => 'calendar_bad_request',
                'status' => 400,
            ];
        }

        $response = $this->request(
            'events_delete',
            'DELETE',
            '/calendars/' . rawurlencode($calendarId) . '/events/' . rawurlencode($eventId)
        );
        if (($response['ok'] ?? false) === true) {
            $this->purgeFreeBusyCache();
        }
        return $response;
    }

    public static function readStatusSnapshot(): array
    {
        $statusPath = data_dir_path() . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR . 'calendar-status.json';
        if (!is_file($statusPath)) {
            return [];
        }
        $raw = @file_get_contents($statusPath);
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }
        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function request(
        string $operation,
        string $method,
        string $path,
        array $query = [],
        ?array $body = null
    ): array {
        $startedAt = microtime(true);
        $auth = $this->tokenProvider->getAccessToken();
        if (($auth['ok'] ?? false) !== true) {
            $authReason = trim((string) ($auth['reason'] ?? ''));
            $this->recordFailure(
                $operation,
                $authReason !== '' ? $authReason : (string) ($auth['code'] ?? 'calendar_auth_failed')
            );
            return [
                'ok' => false,
                'error' => (string) ($auth['error'] ?? 'No se pudo autenticar con Google Calendar'),
                'code' => (string) ($auth['code'] ?? 'calendar_auth_failed'),
                'status' => 503,
            ];
        }

        $accessToken = (string) ($auth['accessToken'] ?? '');
        if ($accessToken === '') {
            $this->recordFailure($operation, 'calendar_auth_failed');
            return [
                'ok' => false,
                'error' => 'No se pudo autenticar con Google Calendar',
                'code' => 'calendar_auth_failed',
                'status' => 503,
            ];
        }

        $url = $this->baseUrl . '/' . ltrim($path, '/');
        if (count($query) > 0) {
            $url .= '?' . http_build_query($query);
        }

        $headers = [
            'Accept: application/json',
            'Authorization: Bearer ' . $accessToken,
        ];
        $payload = '';
        if (is_array($body)) {
            $headers[] = 'Content-Type: application/json';
            $payload = (string) json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        $response = $this->httpRequest($url, strtoupper($method), $headers, $payload);
        $elapsed = microtime(true) - $startedAt;
        Metrics::observe('calendar_api_duration_seconds', $elapsed, ['operation' => $operation], [
            0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 2.5, 5.0
        ]);

        if (($response['ok'] ?? false) !== true) {
            Metrics::increment('calendar_api_errors_total', ['operation' => $operation, 'reason' => 'network']);
            $this->recordFailure($operation, 'network');
            return [
                'ok' => false,
                'error' => 'No se pudo conectar con Google Calendar',
                'code' => 'calendar_unreachable',
                'status' => 503,
            ];
        }

        $status = (int) ($response['status'] ?? 0);
        $rawBody = (string) ($response['body'] ?? '');
        $json = [];
        if ($rawBody !== '') {
            $decoded = json_decode($rawBody, true);
            if (is_array($decoded)) {
                $json = $decoded;
            }
        }

        if ($status < 200 || $status >= 300) {
            $reason = 'status_' . $status;
            if (isset($json['error']['status']) && is_string($json['error']['status']) && trim($json['error']['status']) !== '') {
                $reason = strtolower(trim($json['error']['status']));
            }
            Metrics::increment('calendar_api_errors_total', ['operation' => $operation, 'reason' => $reason]);
            $this->recordFailure($operation, $reason);

            $code = ($status >= 500 || $status === 429) ? 'calendar_unreachable' : 'calendar_request_rejected';
            return [
                'ok' => false,
                'error' => 'Google Calendar no aceptó la solicitud',
                'code' => $code,
                'status' => $status > 0 ? $status : 503,
                'raw' => $json,
            ];
        }

        $this->recordSuccess($operation);
        return [
            'ok' => true,
            'status' => $status,
            'data' => $json,
        ];
    }

    private function httpRequest(string $url, string $method, array $headers, string $body = ''): array
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            if ($ch !== false) {
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
                curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
                curl_setopt($ch, CURLOPT_TIMEOUT_MS, $this->timeoutMs);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT_MS, min(3000, $this->timeoutMs));
                if ($body !== '') {
                    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
                }
                $responseBody = curl_exec($ch);
                $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);

                if ($responseBody === false) {
                    return ['ok' => false, 'status' => $status, 'error' => $curlError];
                }

                return ['ok' => true, 'status' => $status, 'body' => (string) $responseBody];
            }
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'timeout' => max(1, (int) ceil($this->timeoutMs / 1000)),
                'ignore_errors' => true,
            ],
        ]);

        $responseBody = @file_get_contents($url, false, $context);
        $status = 0;
        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $line) {
                if (preg_match('/^HTTP\/\d+\.\d+\s+(\d+)/i', (string) $line, $match) === 1) {
                    $status = (int) $match[1];
                    break;
                }
            }
        }

        if (!is_string($responseBody)) {
            return ['ok' => false, 'status' => $status];
        }

        return ['ok' => true, 'status' => $status, 'body' => $responseBody];
    }

    private function recordSuccess(string $operation): void
    {
        audit_log_event($this->resolveAuditEventName($operation), [
            'operation' => $operation,
            'result' => 'ok',
        ]);
        $this->writeStatus([
            'lastSuccessAt' => local_date('c'),
            'lastErrorAt' => '',
            'lastErrorReason' => '',
            'lastOperation' => $operation,
        ]);
    }

    private function recordFailure(string $operation, string $reason): void
    {
        audit_log_event('calendar.error', [
            'operation' => $operation,
            'reason' => $reason,
        ]);
        $this->writeStatus([
            'lastErrorAt' => local_date('c'),
            'lastErrorReason' => $reason,
            'lastOperation' => $operation,
        ]);
    }

    private function writeStatus(array $patch): void
    {
        $current = self::readStatusSnapshot();
        $updated = array_merge($current, $patch, [
            'updatedAt' => local_date('c'),
        ]);
        @file_put_contents($this->statusPath, json_encode($updated, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function resolveAuditEventName(string $operation): string
    {
        $normalized = strtolower(trim($operation));
        if ($normalized === 'freebusy_query') {
            return 'calendar.availability.query';
        }
        if ($normalized === 'events_insert') {
            return 'calendar.booking.create';
        }
        if ($normalized === 'events_patch') {
            return 'calendar.booking.reschedule';
        }
        if ($normalized === 'events_delete') {
            return 'calendar.booking.cancel';
        }
        return 'calendar.availability.query';
    }

    private function buildFreeBusyCacheKey(array $calendarIds, string $timeMinIso, string $timeMaxIso): string
    {
        $cleanIds = [];
        foreach ($calendarIds as $id) {
            $clean = trim((string) $id);
            if ($clean !== '') {
                $cleanIds[] = $clean;
            }
        }
        sort($cleanIds, SORT_STRING);
        return hash('sha256', implode('|', $cleanIds) . '|' . $timeMinIso . '|' . $timeMaxIso . '|' . $this->timezone);
    }

    private function readFreeBusyCache(string $cacheKey): ?array
    {
        if ($this->cacheTtlSec <= 0 || $cacheKey === '') {
            return null;
        }
        $path = data_dir_path() . DIRECTORY_SEPARATOR . 'cache' . DIRECTORY_SEPARATOR . 'freebusy-' . $cacheKey . '.json';
        if (!is_file($path)) {
            return null;
        }
        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return null;
        }
        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return null;
        }
        $expiresAt = (int) ($decoded['expiresAt'] ?? 0);
        if ($expiresAt <= time()) {
            return null;
        }
        $payload = $decoded['data'] ?? null;
        return is_array($payload) ? $payload : null;
    }

    private function writeFreeBusyCache(string $cacheKey, array $payload): void
    {
        if ($this->cacheTtlSec <= 0 || $cacheKey === '') {
            return;
        }
        $dir = data_dir_path() . DIRECTORY_SEPARATOR . 'cache';
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $path = $dir . DIRECTORY_SEPARATOR . 'freebusy-' . $cacheKey . '.json';
        $record = [
            'expiresAt' => time() + $this->cacheTtlSec,
            'updatedAt' => local_date('c'),
            'data' => $payload,
        ];
        @file_put_contents($path, json_encode($record, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    private function purgeFreeBusyCache(): void
    {
        $dir = data_dir_path() . DIRECTORY_SEPARATOR . 'cache';
        if (!is_dir($dir)) {
            return;
        }
        $files = glob($dir . DIRECTORY_SEPARATOR . 'freebusy-*.json');
        if (!is_array($files)) {
            return;
        }
        foreach ($files as $file) {
            if (is_string($file) && is_file($file)) {
                @unlink($file);
            }
        }
    }
}
