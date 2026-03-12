<?php

declare(strict_types=1);

if (!function_exists('public_sync_parse_scalar')) {
    function public_sync_parse_scalar(string $raw)
    {
        $value = trim($raw);
        if ($value === '') {
            return '';
        }
        if ($value === 'true') {
            return true;
        }
        if ($value === 'false') {
            return false;
        }
        if (preg_match('/^-?\d+$/', $value) === 1) {
            return (int) $value;
        }
        if ($value[0] === '"' && substr($value, -1) === '"') {
            return str_replace('\"', '"', substr($value, 1, -1));
        }
        return $value;
    }
}

if (!function_exists('public_sync_parse_registry')) {
    /**
     * @return array{version:mixed,updated_at:string,jobs:array<int,array<string,mixed>>}
     */
    function public_sync_parse_registry(): array
    {
        static $cache = null;
        if (is_array($cache)) {
            return $cache;
        }

        $path = dirname(__DIR__) . '/AGENT_JOBS.yaml';
        $data = [
            'version' => 1,
            'updated_at' => '',
            'jobs' => [],
        ];
        if (!is_file($path)) {
            $cache = $data;
            return $cache;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            $cache = $data;
            return $cache;
        }

        $lines = preg_split('/\r?\n/', $raw) ?: [];
        $inJobs = false;
        $job = null;
        foreach ($lines as $lineRaw) {
            $line = str_replace("\t", '    ', (string) $lineRaw);
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            if (!$inJobs && preg_match('/^version:\s*(.+)$/', $line, $matches) === 1) {
                $data['version'] = public_sync_parse_scalar((string) $matches[1]);
                continue;
            }
            if (!$inJobs && preg_match('/^updated_at:\s*(.+)$/', $line, $matches) === 1) {
                $data['updated_at'] = (string) public_sync_parse_scalar((string) $matches[1]);
                continue;
            }
            if ($trimmed === 'jobs:') {
                $inJobs = true;
                if (is_array($job)) {
                    $data['jobs'][] = $job;
                    $job = null;
                }
                continue;
            }
            if (!$inJobs) {
                continue;
            }
            if (preg_match('/^\s{2}-\s+key:\s*(.+)$/', $line, $matches) === 1) {
                if (is_array($job)) {
                    $data['jobs'][] = $job;
                }
                $job = ['key' => public_sync_parse_scalar((string) $matches[1])];
                continue;
            }
            if (
                is_array($job) &&
                preg_match('/^\s{4}([a-zA-Z_][\w-]*):\s*(.*)$/', $line, $matches) === 1
            ) {
                $job[(string) $matches[1]] = public_sync_parse_scalar((string) $matches[2]);
            }
        }

        if (is_array($job)) {
            $data['jobs'][] = $job;
        }

        $cache = $data;
        return $cache;
    }
}

if (!function_exists('public_sync_job_config')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_job_config(): array
    {
        static $cache = null;
        if (is_array($cache)) {
            return $cache;
        }

        $registry = public_sync_parse_registry();
        $job = null;
        foreach ($registry['jobs'] as $candidate) {
            if (trim((string) ($candidate['key'] ?? '')) === 'public_main_sync') {
                $job = $candidate;
                break;
            }
        }

        if (!is_array($job)) {
            $cache = [
                'configured' => false,
                'key' => 'public_main_sync',
                'job_id' => '',
                'enabled' => false,
                'type' => 'external_cron',
                'owner' => 'codex_backend_ops',
                'environment' => 'production',
                'repo_path' => '',
                'branch' => 'main',
                'schedule' => '',
                'command' => '',
                'wrapper_fallback' => '',
                'lock_file' => '',
                'log_path' => '',
                'status_path' => '',
                'health_url' => '',
                'expected_max_lag_seconds' => 120,
                'source_of_truth' => 'host_cron',
                'publish_strategy' => 'main_auto_guarded',
            ];
            return $cache;
        }

        $cache = [
            'configured' => true,
            'key' => trim((string) ($job['key'] ?? 'public_main_sync')),
            'job_id' => trim((string) ($job['job_id'] ?? '')),
            'enabled' => (bool) ($job['enabled'] ?? true),
            'type' => trim((string) ($job['type'] ?? 'external_cron')),
            'owner' => trim((string) ($job['owner'] ?? 'codex_backend_ops')),
            'environment' => trim((string) ($job['environment'] ?? 'production')),
            'repo_path' => trim((string) ($job['repo_path'] ?? '')),
            'branch' => trim((string) ($job['branch'] ?? 'main')),
            'schedule' => trim((string) ($job['schedule'] ?? '')),
            'command' => trim((string) ($job['command'] ?? '')),
            'wrapper_fallback' => trim((string) ($job['wrapper_fallback'] ?? '')),
            'lock_file' => trim((string) ($job['lock_file'] ?? '')),
            'log_path' => trim((string) ($job['log_path'] ?? '')),
            'status_path' => trim((string) ($job['status_path'] ?? '')),
            'health_url' => trim((string) ($job['health_url'] ?? '')),
            'expected_max_lag_seconds' => max(1, (int) ($job['expected_max_lag_seconds'] ?? 120)),
            'source_of_truth' => trim((string) ($job['source_of_truth'] ?? 'host_cron')),
            'publish_strategy' => trim((string) ($job['publish_strategy'] ?? 'main_auto_guarded')),
        ];
        return $cache;
    }
}

if (!function_exists('public_sync_read_status')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_read_status(): array
    {
        $config = public_sync_job_config();
        $statusPath = trim((string) ($config['status_path'] ?? ''));
        $result = [
            'configured' => (bool) ($config['configured'] ?? false),
            'exists' => false,
            'path' => $statusPath,
            'status' => [],
            'error' => '',
        ];

        if (!$result['configured'] || $statusPath === '') {
            return $result;
        }

        if (!is_file($statusPath)) {
            $result['error'] = 'status_file_missing';
            return $result;
        }

        $raw = @file_get_contents($statusPath);
        if (!is_string($raw) || trim($raw) === '') {
            $result['error'] = 'status_file_unreadable';
            return $result;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            $result['error'] = 'status_file_invalid_json';
            return $result;
        }

        $result['exists'] = true;
        $result['status'] = $decoded;
        return $result;
    }
}

if (!function_exists('public_sync_normalize_string_list')) {
    /**
     * @return array<int,string>
     */
    function public_sync_normalize_string_list($value): array
    {
        if (!is_array($value)) {
            return [];
        }

        $normalized = [];
        foreach ($value as $item) {
            $candidate = trim((string) $item);
            if ($candidate === '') {
                continue;
            }
            $normalized[] = $candidate;
        }

        return $normalized;
    }
}

if (!function_exists('public_sync_compute_head_drift')) {
    function public_sync_compute_head_drift(string $currentHead, string $remoteHead): bool
    {
        return $currentHead !== '' && $remoteHead !== '' && $currentHead !== $remoteHead;
    }
}

if (!function_exists('public_sync_compute_telemetry_gap')) {
    /**
     * @param array<int,string> $dirtyPathsSample
     * @param array<int,string> $dirtyPaths
     */
    function public_sync_compute_telemetry_gap(
        bool $healthy,
        string $lastErrorMessage,
        string $currentHead,
        string $remoteHead,
        int $dirtyPathsCount,
        array $dirtyPathsSample,
        array $dirtyPaths
    ): bool {
        return !$healthy &&
            $lastErrorMessage !== '' &&
            $currentHead === '' &&
            $remoteHead === '' &&
            $dirtyPathsCount <= 0 &&
            count($dirtyPathsSample) === 0 &&
            count($dirtyPaths) === 0;
    }
}

if (!function_exists('public_sync_compute_failure_reason')) {
    /**
     * @param array<string,mixed> $snapshot
     */
    function public_sync_compute_failure_reason(array $snapshot): string
    {
        if (!(bool) ($snapshot['configured'] ?? false)) {
            return 'unconfigured';
        }

        $ageSeconds = $snapshot['ageSeconds'] ?? null;
        $expectedMaxLagSeconds = max(1, (int) ($snapshot['expectedMaxLagSeconds'] ?? 120));
        if ($ageSeconds !== null && (int) $ageSeconds > $expectedMaxLagSeconds) {
            return 'stale';
        }

        $lastErrorMessage = trim((string) ($snapshot['lastErrorMessage'] ?? ''));
        if ($lastErrorMessage !== '') {
            return $lastErrorMessage;
        }

        $state = trim((string) ($snapshot['state'] ?? 'unknown'));
        if ($state === 'failed') {
            return 'failed';
        }

        if (!(bool) ($snapshot['healthy'] ?? false)) {
            return 'unhealthy';
        }

        return '';
    }
}

if (!function_exists('public_sync_health_snapshot')) {
    /**
     * @return array<string,mixed>
     */
    function public_sync_health_snapshot(): array
    {
        $config = public_sync_job_config();
        $statusEnvelope = public_sync_read_status();
        $status = is_array($statusEnvelope['status'] ?? null) ? $statusEnvelope['status'] : [];

        $lastCheckedAt = trim((string) ($status['checked_at'] ?? $status['finished_at'] ?? $status['started_at'] ?? ''));
        $lastSuccessAt = trim((string) ($status['last_success_at'] ?? ''));
        $lastErrorAt = trim((string) ($status['last_error_at'] ?? ''));
        $lastErrorMessage = trim((string) ($status['last_error_message'] ?? $statusEnvelope['error'] ?? ''));
        $state = trim((string) ($status['state'] ?? 'unknown'));
        $repoPath = trim((string) ($status['repo_path'] ?? $config['repo_path'] ?? ''));
        $branch = trim((string) ($status['branch'] ?? $config['branch'] ?? 'main'));
        $currentHead = trim((string) ($status['current_head'] ?? ''));
        $remoteHead = trim((string) ($status['remote_head'] ?? ''));
        $dirtyPathsCount = max(0, (int) ($status['dirty_paths_count'] ?? 0));
        $dirtyPathsSample = public_sync_normalize_string_list($status['dirty_paths_sample'] ?? []);
        $dirtyPaths = public_sync_normalize_string_list($status['dirty_paths'] ?? []);
        $durationMs = array_key_exists('duration_ms', $status) ? (int) $status['duration_ms'] : null;
        $expectedMaxLagSeconds = max(1, (int) ($config['expected_max_lag_seconds'] ?? 120));
        $ageSeconds = null;
        $headDrift = public_sync_compute_head_drift($currentHead, $remoteHead);

        if ($lastCheckedAt !== '') {
            try {
                $checkedAt = new DateTimeImmutable($lastCheckedAt);
                $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
                $ageSeconds = max(0, $now->getTimestamp() - $checkedAt->getTimestamp());
            } catch (Throwable $throwable) {
                $ageSeconds = null;
            }
        }

        $healthy = false;
        if (
            (bool) ($config['configured'] ?? false) &&
            (bool) ($statusEnvelope['exists'] ?? false) &&
            $state !== '' &&
            $state !== 'failed' &&
            $ageSeconds !== null &&
            $ageSeconds <= $expectedMaxLagSeconds
        ) {
            $healthy = true;
        }

        $telemetryGap = public_sync_compute_telemetry_gap(
            $healthy,
            $lastErrorMessage,
            $currentHead,
            $remoteHead,
            $dirtyPathsCount,
            $dirtyPathsSample,
            $dirtyPaths
        );
        $failureReason = public_sync_compute_failure_reason([
            'configured' => (bool) ($config['configured'] ?? false),
            'healthy' => $healthy,
            'state' => $state !== '' ? $state : 'unknown',
            'ageSeconds' => $ageSeconds,
            'expectedMaxLagSeconds' => $expectedMaxLagSeconds,
            'lastErrorMessage' => $lastErrorMessage,
        ]);

        return [
            'configured' => (bool) ($config['configured'] ?? false),
            'jobId' => trim((string) ($config['job_id'] ?? '')),
            'jobKey' => trim((string) ($config['key'] ?? 'public_main_sync')),
            'mode' => trim((string) ($config['type'] ?? 'external_cron')),
            'schedule' => trim((string) ($config['schedule'] ?? '')),
            'statusPath' => trim((string) ($config['status_path'] ?? '')),
            'logPath' => trim((string) ($config['log_path'] ?? '')),
            'lockFile' => trim((string) ($config['lock_file'] ?? '')),
            'repoPath' => $repoPath,
            'branch' => $branch,
            'state' => $state !== '' ? $state : 'unknown',
            'healthy' => $healthy,
            'ageSeconds' => $ageSeconds,
            'expectedMaxLagSeconds' => $expectedMaxLagSeconds,
            'lastCheckedAt' => $lastCheckedAt,
            'lastSuccessAt' => $lastSuccessAt,
            'lastErrorAt' => $lastErrorAt,
            'lastErrorMessage' => $lastErrorMessage,
            'failureReason' => $failureReason,
            'deployedCommit' => trim((string) ($status['deployed_commit'] ?? '')),
            'currentHead' => $currentHead,
            'remoteHead' => $remoteHead,
            'headDrift' => $headDrift,
            'durationMs' => $durationMs,
            'dirtyPathsCount' => $dirtyPathsCount,
            'dirtyPathsSample' => $dirtyPathsSample,
            'dirtyPaths' => $dirtyPaths,
            'telemetryGap' => $telemetryGap,
        ];
    }
}
