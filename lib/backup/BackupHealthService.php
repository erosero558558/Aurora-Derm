<?php

declare(strict_types=1);

final class BackupHealthService
{
    public static function receiverCleanupRetention(string $storageRoot): array
    {
        $retentionDays = BackupConfig::receiverRetentionDays();
        $maxFiles = BackupConfig::receiverCleanupMaxFiles();
        $threshold = time() - ($retentionDays * 86400);

        $result = [
            'ok' => true,
            'retentionDays' => $retentionDays,
            'removed' => 0,
            'scanned' => 0,
            'errors' => 0,
        ];

        if (!is_dir($storageRoot)) {
            return $result;
        }

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($storageRoot, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::CHILD_FIRST
            );
        } catch (Throwable $e) {
            $result['ok'] = false;
            return $result;
        }

        foreach ($iterator as $item) {
            if ($result['scanned'] >= $maxFiles) {
                break;
            }
            $result['scanned']++;

            if (!$item instanceof SplFileInfo || !$item->isFile()) {
                continue;
            }

            $mtime = $item->getMTime();
            if (!is_int($mtime) || $mtime > $threshold) {
                continue;
            }

            if (@unlink($item->getPathname())) {
                $result['removed']++;
            } else {
                $result['errors']++;
            }
        }

        return $result;
    }

    public static function autoRefreshLastAttemptAgeSeconds(): ?int
    {
        $marker = BackupConfig::autoRefreshMarkerPath();
        if (!is_file($marker)) {
            return null;
        }

        $mtime = @filemtime($marker);
        if (!is_int($mtime) || $mtime <= 0) {
            return null;
        }

        return max(0, time() - $mtime);
    }

    public static function autoRefreshTouchMarker(): void
    {
        if (!ensure_backup_dir()) {
            return;
        }

        @touch(BackupConfig::autoRefreshMarkerPath());
    }

    public static function autoRefreshTryCreate(): array
    {
        $cooldownSeconds = BackupConfig::autoRefreshIntervalSeconds();
        $lastAttemptAge = self::autoRefreshLastAttemptAgeSeconds();

        $result = [
            'ok' => false,
            'attempted' => false,
            'created' => false,
            'reason' => '',
            'cooldownSeconds' => $cooldownSeconds,
            'lastAttemptAgeSeconds' => $lastAttemptAge,
            'file' => '',
        ];

        if (!BackupConfig::autoRefreshEnabled()) {
            $result['reason'] = 'auto_refresh_disabled';
            return $result;
        }
        if (!function_exists('ensure_data_file') || !function_exists('create_store_backup_locked')) {
            $result['reason'] = 'storage_helpers_unavailable';
            return $result;
        }
        if (!ensure_backup_dir()) {
            $result['reason'] = 'backup_dir_not_ready';
            return $result;
        }
        if ($lastAttemptAge !== null && $lastAttemptAge < $cooldownSeconds) {
            $result['reason'] = 'cooldown_active';
            return $result;
        }

        $storeReady = ensure_data_file();
        $storePath = self::resolveReadableStorePath();
        if ($storePath === '') {
            $result['reason'] = $storeReady ? 'store_file_missing' : 'store_not_ready';
            return $result;
        }

        $before = self::listFiles(1);
        $beforeLatest = count($before) > 0 ? basename((string) $before[0]) : '';

        $result['attempted'] = true;
        create_store_backup_locked($storePath);
        self::autoRefreshTouchMarker();

        $after = self::listFiles(1);
        if (count($after) === 0) {
            $result['reason'] = 'refresh_no_backup_created';
            return $result;
        }

        $afterLatest = basename((string) $after[0]);
        $result['ok'] = true;
        $result['created'] = $afterLatest !== '' && $afterLatest !== $beforeLatest;
        $result['file'] = $afterLatest;
        $result['reason'] = $result['created'] ? '' : 'refresh_not_detected';

        return $result;
    }

    public static function createInitialSeedIfMissing(): array
    {
        $result = [
            'ok' => false,
            'created' => false,
            'reason' => '',
            'file' => '',
            'path' => '',
        ];

        $existing = self::listFiles(1);
        if (count($existing) > 0) {
            $result['ok'] = true;
            $result['reason'] = 'already_exists';
            $result['file'] = basename((string) $existing[0]);
            $result['path'] = (string) $existing[0];
            return $result;
        }
        if (!function_exists('ensure_data_file') || !function_exists('create_store_backup_locked')) {
            $result['reason'] = 'storage_helpers_unavailable';
            return $result;
        }
        if (!ensure_data_file()) {
            $result['reason'] = 'store_not_ready';
            return $result;
        }

        $storePath = self::resolveReadableStorePath();
        if ($storePath === '') {
            $result['reason'] = 'store_file_missing';
            return $result;
        }
        if (!ensure_backup_dir()) {
            $result['reason'] = 'backup_dir_not_ready';
            return $result;
        }

        create_store_backup_locked($storePath);
        $after = self::listFiles(1);
        if (count($after) === 0) {
            $result['reason'] = 'seed_copy_failed';
            return $result;
        }

        $result['ok'] = true;
        $result['created'] = true;
        $result['file'] = basename((string) $after[0]);
        $result['path'] = (string) $after[0];
        return $result;
    }

    public static function listFiles(int $limit = 0): array
    {
        $patterns = [
            backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.sqlite',
            backup_dir_path() . DIRECTORY_SEPARATOR . 'store-*.json',
        ];

        $files = [];
        foreach ($patterns as $pattern) {
            $matches = glob($pattern);
            if (!is_array($matches) || $matches === []) {
                continue;
            }
            $files = array_merge($files, $matches);
        }
        if ($files === []) {
            return [];
        }

        rsort($files, SORT_STRING);
        $files = array_values(array_filter($files, static function ($file): bool {
            return is_string($file) && $file !== '';
        }));

        if ($limit > 0 && count($files) > $limit) {
            $files = array_slice($files, 0, $limit);
        }

        return $files;
    }

    public static function validateStoreShape(array $data): array
    {
        $issues = [];
        foreach (['appointments', 'callbacks', 'reviews', 'availability'] as $key) {
            if (!array_key_exists($key, $data)) {
                $issues[] = 'missing_' . $key;
                continue;
            }
            if (!is_array($data[$key])) {
                $issues[] = 'invalid_' . $key;
            }
        }

        return [
            'ok' => $issues === [],
            'issues' => $issues,
            'counts' => [
                'appointments' => isset($data['appointments']) && is_array($data['appointments']) ? count($data['appointments']) : 0,
                'callbacks' => isset($data['callbacks']) && is_array($data['callbacks']) ? count($data['callbacks']) : 0,
                'reviews' => isset($data['reviews']) && is_array($data['reviews']) ? count($data['reviews']) : 0,
                'availability' => isset($data['availability']) && is_array($data['availability']) ? count($data['availability']) : 0,
            ],
        ];
    }

    public static function decodeStorePayload(string $raw): array
    {
        $raw = trim($raw);
        if ($raw === '') {
            return ['ok' => false, 'reason' => 'empty_payload'];
        }

        $decoded = data_decrypt_payload($raw);
        if ($decoded === '') {
            return ['ok' => false, 'reason' => 'decrypt_failed'];
        }

        $data = json_decode($decoded, true);
        if (!is_array($data)) {
            return ['ok' => false, 'reason' => 'invalid_json'];
        }

        $shape = self::validateStoreShape($data);
        if (($shape['ok'] ?? false) !== true) {
            return [
                'ok' => false,
                'reason' => 'invalid_store_shape',
                'issues' => $shape['issues'] ?? [],
            ];
        }

        return [
            'ok' => true,
            'data' => $data,
            'counts' => $shape['counts'] ?? [],
        ];
    }

    public static function validateFile(string $path): array
    {
        $result = self::baseValidationResult($path);
        if (($result['exists'] ?? false) !== true || ($result['readable'] ?? false) !== true) {
            return $result;
        }

        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if ($ext === 'sqlite') {
            try {
                $pdo = new PDO("sqlite:$path");
                $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $result['counts'] = [
                    'appointments' => (int) $pdo->query("SELECT COUNT(*) FROM appointments")->fetchColumn(),
                    'callbacks' => (int) $pdo->query("SELECT COUNT(*) FROM callbacks")->fetchColumn(),
                    'reviews' => (int) $pdo->query("SELECT COUNT(*) FROM reviews")->fetchColumn(),
                    'availability' => (int) $pdo->query("SELECT COUNT(*) FROM availability")->fetchColumn(),
                ];
                $result['ok'] = true;
                $result['reason'] = '';
                return $result;
            } catch (Exception $e) {
                $result['reason'] = 'sqlite_error: ' . $e->getMessage();
                return $result;
            }
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            $result['reason'] = 'file_empty_or_unreadable';
            return $result;
        }

        $decoded = self::decodeStorePayload($raw);
        if (($decoded['ok'] ?? false) !== true) {
            $result['reason'] = (string) ($decoded['reason'] ?? 'decode_failed');
            if (isset($decoded['issues']) && is_array($decoded['issues'])) {
                $result['issues'] = $decoded['issues'];
            }
            return $result;
        }

        $result['ok'] = true;
        $result['reason'] = '';
        if (isset($decoded['counts']) && is_array($decoded['counts'])) {
            $result['counts'] = $decoded['counts'];
        }

        return $result;
    }

    public static function validateFileFast(string $path): array
    {
        $result = self::baseValidationResult($path);
        if (($result['exists'] ?? false) !== true || ($result['readable'] ?? false) !== true) {
            return $result;
        }
        if (($result['sizeBytes'] ?? 0) <= 0) {
            $result['reason'] = 'file_empty';
            return $result;
        }

        if (strtolower(pathinfo($path, PATHINFO_EXTENSION)) === 'sqlite') {
            $header = '';
            $fh = @fopen($path, 'rb');
            if ($fh !== false) {
                $read = @fread($fh, 16);
                if (is_string($read)) {
                    $header = $read;
                }
                @fclose($fh);
            }
            if ($header !== '' && strpos($header, 'SQLite format 3') !== 0) {
                $result['reason'] = 'sqlite_header_invalid';
                return $result;
            }
        }

        $result['ok'] = true;
        $result['reason'] = '';
        return $result;
    }

    public static function latestStatusInternal(?int $maxAgeHours, callable $validator): array
    {
        $maxAge = $maxAgeHours ?? BackupConfig::healthMaxAgeHours();
        if ($maxAge < 1) {
            $maxAge = 1;
        }

        $autoRefreshEnabled = BackupConfig::autoRefreshEnabled();
        $autoRefresh = [
            'enabled' => $autoRefreshEnabled,
            'attempted' => false,
            'created' => false,
            'reason' => '',
            'cooldownSeconds' => BackupConfig::autoRefreshIntervalSeconds(),
            'lastAttemptAgeSeconds' => self::autoRefreshLastAttemptAgeSeconds(),
            'file' => '',
        ];

        $files = self::listFiles();
        $count = count($files);

        $bootstrapResult = null;
        if ($count === 0) {
            $bootstrapResult = self::createInitialSeedIfMissing();
            if (($bootstrapResult['ok'] ?? false) === true) {
                $files = self::listFiles();
                $count = count($files);
            }
        }

        if ($count === 0 && $autoRefreshEnabled) {
            $refresh = self::autoRefreshTryCreate();
            $autoRefresh = self::mergeAutoRefreshState($autoRefresh, $refresh);
            if (($refresh['ok'] ?? false) === true) {
                $files = self::listFiles();
                $count = count($files);
            }
        }

        if ($count === 0) {
            return [
                'ok' => false,
                'reason' => 'no_backup_files',
                'count' => 0,
                'maxAgeHours' => $maxAge,
                'latestFile' => '',
                'latestPath' => '',
                'latestAgeHours' => null,
                'latestValid' => false,
                'latestFresh' => false,
                'bootstrapAttempted' => $bootstrapResult !== null,
                'bootstrapCreated' => (bool) ($bootstrapResult['created'] ?? false),
                'bootstrapReason' => (string) ($bootstrapResult['reason'] ?? ''),
                'autoRefresh' => $autoRefresh,
            ];
        }

        $latestPath = (string) $files[0];
        $latest = $validator($latestPath);
        $latestAgeHours = isset($latest['ageHours']) && is_numeric($latest['ageHours']) ? (float) $latest['ageHours'] : null;
        $latestValid = ($latest['ok'] ?? false) === true;
        $latestFresh = $latestAgeHours !== null && $latestAgeHours <= $maxAge;
        $ok = $latestValid && $latestFresh;
        $reason = self::latestStatusReason($latestValid, $latestFresh, $latest);

        if (!$ok && $autoRefreshEnabled && !$autoRefresh['attempted']) {
            $refresh = self::autoRefreshTryCreate();
            $autoRefresh = self::mergeAutoRefreshState($autoRefresh, $refresh);
            if (($refresh['ok'] ?? false) === true) {
                $files = self::listFiles();
                $count = count($files);
                if ($count > 0) {
                    $latestPath = (string) $files[0];
                    $latest = $validator($latestPath);
                    $latestAgeHours = isset($latest['ageHours']) && is_numeric($latest['ageHours']) ? (float) $latest['ageHours'] : null;
                    $latestValid = ($latest['ok'] ?? false) === true;
                    $latestFresh = $latestAgeHours !== null && $latestAgeHours <= $maxAge;
                    $ok = $latestValid && $latestFresh;
                    $reason = self::latestStatusReason($latestValid, $latestFresh, $latest);
                }
            }
        }

        return [
            'ok' => $ok,
            'reason' => $reason,
            'count' => $count,
            'maxAgeHours' => $maxAge,
            'latestFile' => basename($latestPath),
            'latestPath' => $latestPath,
            'latestAgeHours' => $latestAgeHours,
            'latestValid' => $latestValid,
            'latestFresh' => $latestFresh,
            'bootstrapAttempted' => $bootstrapResult !== null,
            'bootstrapCreated' => (bool) ($bootstrapResult['created'] ?? false),
            'bootstrapReason' => (string) ($bootstrapResult['reason'] ?? ''),
            'latest' => $latest,
            'autoRefresh' => $autoRefresh,
        ];
    }

    public static function latestStatus(?int $maxAgeHours = null): array
    {
        return self::latestStatusInternal($maxAgeHours, [self::class, 'validateFile']);
    }

    public static function latestStatusFast(?int $maxAgeHours = null): array
    {
        return self::latestStatusInternal($maxAgeHours, [self::class, 'validateFileFast']);
    }

    private static function resolveReadableStorePath(): string
    {
        $candidates = [];
        if (function_exists('data_file_path')) {
            $candidates[] = (string) data_file_path();
        }
        if (function_exists('data_json_path')) {
            $candidates[] = (string) data_json_path();
        }

        foreach ($candidates as $candidate) {
            if ($candidate !== '' && is_file($candidate) && is_readable($candidate)) {
                return $candidate;
            }
        }

        return '';
    }

    private static function baseValidationResult(string $path): array
    {
        $result = [
            'ok' => false,
            'path' => $path,
            'file' => basename($path),
            'exists' => false,
            'readable' => false,
            'sizeBytes' => 0,
            'mtime' => '',
            'ageHours' => null,
            'counts' => [
                'appointments' => 0,
                'callbacks' => 0,
                'reviews' => 0,
                'availability' => 0,
            ],
            'reason' => '',
        ];

        if (!is_file($path)) {
            $result['reason'] = 'file_not_found';
            return $result;
        }
        $result['exists'] = true;

        if (!is_readable($path)) {
            $result['reason'] = 'file_not_readable';
            return $result;
        }
        $result['readable'] = true;

        $size = @filesize($path);
        if (is_int($size) && $size >= 0) {
            $result['sizeBytes'] = $size;
        }

        $mtime = @filemtime($path);
        if (is_int($mtime) && $mtime > 0) {
            $result['mtime'] = date('c', $mtime);
            $result['ageHours'] = round(max(0, time() - $mtime) / 3600, 3);
        }

        return $result;
    }

    private static function latestStatusReason(bool $latestValid, bool $latestFresh, array $latest): string
    {
        if (!$latestValid) {
            return (string) ($latest['reason'] ?? 'latest_backup_invalid');
        }
        if (!$latestFresh) {
            return 'latest_backup_stale';
        }
        return '';
    }

    private static function mergeAutoRefreshState(array $current, array $refresh): array
    {
        $current['attempted'] = (bool) ($refresh['attempted'] ?? false);
        $current['created'] = (bool) ($refresh['created'] ?? false);
        $current['reason'] = (string) ($refresh['reason'] ?? '');
        $current['cooldownSeconds'] = (int) ($refresh['cooldownSeconds'] ?? $current['cooldownSeconds']);
        $current['lastAttemptAgeSeconds'] = $refresh['lastAttemptAgeSeconds'] ?? $current['lastAttemptAgeSeconds'];
        $current['file'] = (string) ($refresh['file'] ?? '');
        return $current;
    }
}
