<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

final class QueueSurfaceStatusStore
{
    private const FILE_NAME = 'queue-surface-status.json';
    private const STALE_AFTER_SECONDS = 45;
    private const EXPIRE_AFTER_SECONDS = 86400;

    /**
     * @return array<string, mixed>
     */
    public static function readSummary(): array
    {
        $records = self::pruneExpiredRecords(self::readRawRecords());
        $grouped = [
            'operator' => self::buildEmptyGroup('operator', 'Operador'),
            'kiosk' => self::buildEmptyGroup('kiosk', 'Kiosco'),
            'display' => self::buildEmptyGroup('display', 'Sala TV'),
        ];

        foreach ($records as $record) {
            $surface = (string) ($record['surface'] ?? '');
            if (!isset($grouped[$surface])) {
                continue;
            }

            $enriched = self::enrichRecord($record);
            $grouped[$surface]['instances'][] = $enriched;
        }

        foreach ($grouped as $surface => $group) {
            $instances = is_array($group['instances'] ?? null) ? $group['instances'] : [];
            usort($instances, static function (array $left, array $right): int {
                return strcmp(
                    (string) ($right['updatedAt'] ?? ''),
                    (string) ($left['updatedAt'] ?? '')
                );
            });

            $latest = $instances[0] ?? null;
            $grouped[$surface] = array_merge($group, [
                'instances' => array_values($instances),
                'latest' => $latest,
                'status' => is_array($latest) ? (string) ($latest['effectiveStatus'] ?? 'unknown') : 'unknown',
                'updatedAt' => is_array($latest) ? (string) ($latest['updatedAt'] ?? '') : '',
                'ageSec' => is_array($latest) ? self::nullableInt($latest['ageSec'] ?? null) : null,
                'stale' => is_array($latest) ? (bool) ($latest['stale'] ?? true) : true,
                'summary' => is_array($latest)
                    ? (string) ($latest['summary'] ?? '')
                    : 'Sin heartbeat todavía. Abre la app o el fallback web para registrar señal.',
            ]);
        }

        return $grouped;
    }

    /**
     * @return array<string, mixed>
     */
    public static function writeHeartbeat(array $payload): array
    {
        $record = self::normalizeRecord($payload);
        $records = self::pruneExpiredRecords(self::readRawRecords());
        $records[self::buildRecordKey($record)] = $record;
        self::writeRawRecords($records);
        return self::enrichRecord($record);
    }

    private static function filePath(): string
    {
        return data_dir_path() . DIRECTORY_SEPARATOR . self::FILE_NAME;
    }

    private static function lockPath(): string
    {
        return self::filePath() . '.lock';
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private static function readRawRecords(): array
    {
        $path = self::filePath();
        if (!is_file($path)) {
            return [];
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $records = is_array($decoded['records'] ?? null) ? $decoded['records'] : [];
        $normalized = [];
        foreach ($records as $key => $record) {
            if (!is_string($key) || !is_array($record)) {
                continue;
            }
            $normalized[$key] = self::normalizeRecord($record);
        }

        return $normalized;
    }

    /**
     * @param array<string, array<string, mixed>> $records
     */
    private static function writeRawRecords(array $records): void
    {
        $dir = data_dir_path();
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        ensure_data_htaccess($dir);

        $lock = @fopen(self::lockPath(), 'c+');
        if ($lock !== false) {
            @flock($lock, LOCK_EX);
        }

        try {
            $path = self::filePath();
            $tmpPath = $path . '.tmp';
            $payload = [
                'updatedAt' => local_date('c'),
                'records' => $records,
            ];
            $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
            if (!is_string($json)) {
                return;
            }
            @file_put_contents($tmpPath, $json, LOCK_EX);
            @rename($tmpPath, $path);
        } finally {
            if ($lock !== false) {
                @flock($lock, LOCK_UN);
                @fclose($lock);
            }
        }
    }

    /**
     * @param array<string, array<string, mixed>> $records
     * @return array<string, array<string, mixed>>
     */
    private static function pruneExpiredRecords(array $records): array
    {
        $now = time();
        $active = [];
        foreach ($records as $key => $record) {
            $updatedAt = strtotime((string) ($record['updatedAt'] ?? ''));
            if ($updatedAt === false) {
                continue;
            }
            if (($now - $updatedAt) > self::EXPIRE_AFTER_SECONDS) {
                continue;
            }
            $active[$key] = $record;
        }
        return $active;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private static function normalizeRecord(array $payload): array
    {
        $surface = self::normalizeSurface((string) ($payload['surface'] ?? ''));
        $instance = self::normalizeSlug((string) ($payload['instance'] ?? 'main'), 'main');
        $status = self::normalizeStatus((string) ($payload['status'] ?? 'warning'));
        $appMode = self::normalizeAppMode((string) ($payload['appMode'] ?? ($payload['app_mode'] ?? 'web')));
        $networkOnline = array_key_exists('networkOnline', $payload)
            ? (bool) $payload['networkOnline']
            : (array_key_exists('network_online', $payload) ? (bool) $payload['network_online'] : true);
        $updatedAt = self::normalizeIsoString((string) ($payload['updatedAt'] ?? ($payload['updated_at'] ?? '')));

        return [
            'surface' => $surface,
            'instance' => $instance,
            'deviceId' => self::normalizeSlug((string) ($payload['deviceId'] ?? ($payload['device_id'] ?? $surface)), $surface),
            'deviceLabel' => self::truncate(
                (string) ($payload['deviceLabel'] ?? ($payload['device_label'] ?? self::defaultDeviceLabel($surface, $instance))),
                80
            ),
            'appMode' => $appMode,
            'route' => self::truncate((string) ($payload['route'] ?? ($payload['path'] ?? '')), 220),
            'status' => $status,
            'summary' => self::truncate((string) ($payload['summary'] ?? ''), 200),
            'networkOnline' => $networkOnline,
            'lastEvent' => self::normalizeSlug((string) ($payload['lastEvent'] ?? ($payload['last_event'] ?? 'heartbeat')), 'heartbeat'),
            'lastEventAt' => self::normalizeIsoString((string) ($payload['lastEventAt'] ?? ($payload['last_event_at'] ?? ''))),
            'details' => self::sanitizeDetails($payload['details'] ?? []),
            'updatedAt' => $updatedAt !== '' ? $updatedAt : local_date('c'),
        ];
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    private static function enrichRecord(array $record): array
    {
        $updatedAtIso = (string) ($record['updatedAt'] ?? '');
        $updatedAt = strtotime($updatedAtIso);
        $ageSec = $updatedAt === false ? null : max(0, time() - $updatedAt);
        $stale = $ageSec === null ? true : $ageSec > self::STALE_AFTER_SECONDS;
        $status = self::normalizeStatus((string) ($record['status'] ?? 'warning'));
        $effectiveStatus = $status === 'alert'
            ? 'alert'
            : ($stale ? 'warning' : $status);

        return array_merge($record, [
            'ageSec' => $ageSec,
            'stale' => $stale,
            'effectiveStatus' => $effectiveStatus,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private static function buildEmptyGroup(string $surface, string $label): array
    {
        return [
            'surface' => $surface,
            'label' => $label,
            'status' => 'unknown',
            'updatedAt' => '',
            'ageSec' => null,
            'stale' => true,
            'summary' => 'Sin heartbeat todavía. Abre la app o el fallback web para registrar señal.',
            'latest' => null,
            'instances' => [],
        ];
    }

    /**
     * @param mixed $details
     * @return array<string, mixed>
     */
    private static function sanitizeDetails($details): array
    {
        if (!is_array($details)) {
            return [];
        }

        $normalized = [];
        foreach ($details as $key => $value) {
            if (!is_string($key) || trim($key) === '') {
                continue;
            }
            $safeKey = self::normalizeSlug($key, '');
            if ($safeKey === '') {
                continue;
            }
            if (is_bool($value) || is_int($value) || is_float($value)) {
                $normalized[$safeKey] = $value;
                continue;
            }
            if (is_string($value)) {
                $normalized[$safeKey] = self::truncate($value, 80);
                continue;
            }
        }

        return $normalized;
    }

    /**
     * @param array<string, mixed> $record
     */
    private static function buildRecordKey(array $record): string
    {
        return (string) ($record['surface'] ?? 'unknown') . ':' . (string) ($record['instance'] ?? 'main');
    }

    private static function normalizeSurface(string $surface): string
    {
        $value = strtolower(trim($surface));
        if ($value === 'sala_tv') {
            return 'display';
        }
        if (in_array($value, ['operator', 'kiosk', 'display'], true)) {
            return $value;
        }
        return 'operator';
    }

    private static function normalizeStatus(string $status): string
    {
        $value = strtolower(trim($status));
        if (in_array($value, ['ready', 'warning', 'alert', 'unknown'], true)) {
            return $value;
        }
        return 'warning';
    }

    private static function normalizeAppMode(string $appMode): string
    {
        $value = strtolower(trim($appMode));
        if (in_array($value, ['web', 'desktop', 'android_tv'], true)) {
            return $value;
        }
        return 'web';
    }

    private static function normalizeSlug(string $value, string $fallback): string
    {
        $normalized = strtolower(trim($value));
        $normalized = preg_replace('/[^a-z0-9_-]+/', '-', $normalized) ?? '';
        $normalized = trim($normalized, '-');
        if ($normalized === '') {
            return $fallback;
        }
        return self::truncate($normalized, 40);
    }

    private static function normalizeIsoString(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }
        return strtotime($trimmed) === false ? '' : $trimmed;
    }

    private static function defaultDeviceLabel(string $surface, string $instance): string
    {
        if ($surface === 'operator') {
            return $instance === 'main' ? 'Operador' : 'Operador ' . strtoupper($instance);
        }
        if ($surface === 'kiosk') {
            return 'Kiosco';
        }
        return 'Sala TV';
    }

    private static function truncate(string $value, int $maxLength): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }
        if (mb_strlen($trimmed) <= $maxLength) {
            return $trimmed;
        }
        return mb_substr($trimmed, 0, $maxLength);
    }

    /**
     * @param mixed $value
     */
    private static function nullableInt($value): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }
        $number = (int) $value;
        return $number >= 0 ? $number : null;
    }
}
