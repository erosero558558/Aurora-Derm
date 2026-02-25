<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../metrics.php';
require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/Gateway.php';

class FigoWorker
{
    private static function shouldRetryError(string $errorCode): bool
    {
        return in_array($errorCode, ['gateway_timeout', 'gateway_network', 'gateway_upstream_5xx', 'gateway_rate_limited'], true);
    }

    private static function nextRetryAt(int $attempts, int $now): int
    {
        $backoff = min(5 + ($attempts * 2), 30);
        return $now + $backoff;
    }

    public static function markJob(array $job, string $status, string $errorCode = '', string $errorMessage = '', ?array $completion = null): array
    {
        $now = time();
        $job['status'] = $status;
        $job['updatedAt'] = gmdate('c', $now);

        if ($errorCode !== '') {
            $job['errorCode'] = $errorCode;
        } elseif (isset($job['errorCode'])) {
            unset($job['errorCode']);
        }

        if ($errorMessage !== '') {
            $job['errorMessage'] = $errorMessage;
        } elseif (isset($job['errorMessage'])) {
            unset($job['errorMessage']);
        }

        if (is_array($completion)) {
            $job['response'] = $completion;
        }

        if ($status === 'completed') {
            $job['completedAt'] = gmdate('c', $now);
        } elseif ($status === 'failed') {
            $job['failedAt'] = gmdate('c', $now);
        } elseif ($status === 'expired') {
            $job['expiredAt'] = gmdate('c', $now);
        }

        return $job;
    }

    public static function processJob(string $jobId, ?int $gatewayTimeoutSeconds = null): array
    {
        $jobLock = FigoStorage::acquireLock('job-' . $jobId, 600);
        if (!is_resource($jobLock)) {
            return ['ok' => false, 'status' => 'lock_busy', 'jobId' => $jobId];
        }

        try {
            $job = FigoStorage::readJob($jobId);
            if (!is_array($job)) {
                return ['ok' => false, 'status' => 'missing', 'jobId' => $jobId];
            }

            $status = (string) ($job['status'] ?? '');
            if (in_array($status, ['completed', 'failed', 'expired'], true)) {
                return ['ok' => true, 'status' => $status, 'jobId' => $jobId];
            }

            $now = time();
            $expiresAtTs = strtotime((string) ($job['expiresAt'] ?? ''));
            if ($expiresAtTs > 0 && $expiresAtTs < $now) {
                $job = self::markJob($job, 'expired', 'queue_expired', 'Job vencido en cola');
                FigoStorage::writeJob($job);
                Metrics::increment('openclaw_queue_jobs_total', ['status' => 'expired']);
                return ['ok' => false, 'status' => 'expired', 'jobId' => $jobId];
            }

            $nextAttemptAtTs = strtotime((string) ($job['nextAttemptAt'] ?? ''));
            if ($nextAttemptAtTs > $now) {
                return ['ok' => true, 'status' => 'deferred', 'jobId' => $jobId];
            }

            $attempts = isset($job['attempts']) ? ((int) $job['attempts']) + 1 : 1;
            $job['attempts'] = $attempts;
            $job = self::markJob($job, 'processing');
            FigoStorage::writeJob($job);

            $gatewayResult = FigoGateway::call($job, $gatewayTimeoutSeconds);
            FigoStorage::writeGatewayStatus([
                'ok' => (bool) ($gatewayResult['ok'] ?? false),
                'errorCode' => (string) ($gatewayResult['errorCode'] ?? ''),
                'httpCode' => (int) ($gatewayResult['httpCode'] ?? 0)
            ]);

            if (($gatewayResult['ok'] ?? false) === true && is_array($gatewayResult['completion'] ?? null)) {
                $job = self::markJob($job, 'completed', '', '', $gatewayResult['completion']);
                FigoStorage::writeJob($job);
                Metrics::increment('openclaw_queue_jobs_total', ['status' => 'completed']);
                audit_log_event('figo.queue.completed', [
                    'jobId' => $jobId,
                    'attempts' => $attempts,
                    'durationMs' => (int) ($gatewayResult['durationMs'] ?? 0)
                ]);
                return ['ok' => true, 'status' => 'completed', 'jobId' => $jobId];
            }

            $errorCode = (string) ($gatewayResult['errorCode'] ?? 'gateway_unknown');
            $errorMessage = (string) ($gatewayResult['errorMessage'] ?? 'Gateway error');
            $retryMax = FigoConfig::getWorkerRetryMax();
            $shouldRetry = $attempts <= $retryMax && self::shouldRetryError($errorCode);

            if ($shouldRetry) {
                $nextRetryTs = self::nextRetryAt($attempts, $now);
                $job['nextAttemptAt'] = gmdate('c', max(1, $nextRetryTs));
                $job = self::markJob($job, 'queued', $errorCode, $errorMessage);
                FigoStorage::writeJob($job);
                audit_log_event('figo.queue.retry', [
                    'jobId' => $jobId,
                    'attempts' => $attempts,
                    'errorCode' => $errorCode
                ]);
                return ['ok' => false, 'status' => 'retry', 'jobId' => $jobId];
            }

            $job = self::markJob($job, 'failed', $errorCode, $errorMessage);
            FigoStorage::writeJob($job);
            Metrics::increment('openclaw_queue_jobs_total', ['status' => 'failed']);
            audit_log_event('figo.queue.failed', [
                'jobId' => $jobId,
                'attempts' => $attempts,
                'errorCode' => $errorCode
            ]);
            return ['ok' => false, 'status' => 'failed', 'jobId' => $jobId];
        } finally {
            FigoStorage::releaseLock($jobLock);
        }
    }

    public static function purgeOldJobs(?int $nowTs = null): array
    {
        $now = is_int($nowTs) ? $nowTs : time();
        $ttl = FigoConfig::getQueueTtlSec();
        $retention = FigoConfig::getRetentionSec();
        $result = ['expiredNow' => 0, 'deleted' => 0];

        if (!FigoStorage::ensureDirs()) {
            return $result;
        }

        $files = glob(FigoStorage::getJobsDir() . DIRECTORY_SEPARATOR . '*.json');
        if (!is_array($files)) {
            return $result;
        }

        foreach ($files as $path) {
            $job = FigoStorage::readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }

            $status = (string) ($job['status'] ?? '');
            $createdAtTs = strtotime((string) ($job['createdAt'] ?? ''));
            if ($createdAtTs <= 0) {
                $createdAtTs = (int) @filemtime($path);
            }
            if ($createdAtTs <= 0) {
                $createdAtTs = $now;
            }

            if (in_array($status, ['queued', 'processing'], true)) {
                if (($now - $createdAtTs) > $ttl) {
                    $job['status'] = 'expired';
                    $job['updatedAt'] = gmdate('c');
                    $job['expiredAt'] = gmdate('c');
                    $job['errorCode'] = 'queue_expired';
                    $job['errorMessage'] = 'Job vencido en cola';
                    FigoStorage::writeJsonFile($path, $job);
                    $result['expiredNow']++;
                    Metrics::increment('openclaw_queue_jobs_total', ['status' => 'expired']);
                    audit_log_event('figo.queue.expired', [
                        'jobId' => (string) ($job['jobId'] ?? ''),
                        'reason' => 'ttl_exceeded'
                    ]);
                }
                continue;
            }

            if (($now - $createdAtTs) > $retention) {
                if (@unlink($path)) {
                    $result['deleted']++;
                }
            }
        }

        return $result;
    }

    public static function getPendingJobIds(): array
    {
        $result = [];
        if (!FigoStorage::ensureDirs()) {
            return $result;
        }
        $files = glob(FigoStorage::getJobsDir() . DIRECTORY_SEPARATOR . '*.json');
        if (!is_array($files) || $files === []) {
            return $result;
        }

        $now = time();
        $scored = [];
        foreach ($files as $path) {
            $job = FigoStorage::readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }
            $status = (string) ($job['status'] ?? '');
            if (!in_array($status, ['queued', 'processing'], true)) {
                continue;
            }
            $jobId = isset($job['jobId']) ? (string) $job['jobId'] : '';
            if (!FigoStorage::isValidJobId($jobId)) {
                continue;
            }

            $nextAttemptAtTs = strtotime((string) ($job['nextAttemptAt'] ?? ''));
            if ($nextAttemptAtTs > $now) {
                continue;
            }

            $createdAtTs = strtotime((string) ($job['createdAt'] ?? ''));
            if ($createdAtTs <= 0) {
                $createdAtTs = (int) @filemtime($path);
            }
            if ($createdAtTs <= 0) {
                $createdAtTs = $now;
            }

            $scored[] = ['jobId' => $jobId, 'createdAtTs' => $createdAtTs];
        }

        usort($scored, static function (array $a, array $b): int {
            return $a['createdAtTs'] <=> $b['createdAtTs'];
        });
        foreach ($scored as $row) {
            $result[] = (string) $row['jobId'];
        }

        return $result;
    }

    public static function processWorker(?int $maxJobs = null, ?int $timeBudgetMs = null, bool $fromCron = false): array
    {
        $start = microtime(true);
        $maxJobsValue = is_int($maxJobs) && $maxJobs > 0 ? $maxJobs : FigoConfig::getWorkerMaxJobs();
        $timeBudget = is_int($timeBudgetMs) && $timeBudgetMs > 0
            ? FigoConfig::clampInt($timeBudgetMs, 1600, 200, 30000)
            : 1600;

        $lock = FigoStorage::acquireLock('worker-global', 120);
        if (!is_resource($lock)) {
            return [
                'ok' => false,
                'reason' => 'worker_locked',
                'processed' => 0,
                'completed' => 0,
                'failed' => 0,
                'remaining' => 0,
                'durationMs' => 0
            ];
        }

        try {
            $purge = self::purgeOldJobs();
            $pending = self::getPendingJobIds();
            $processed = 0;
            $completed = 0;
            $failed = 0;

            foreach ($pending as $jobId) {
                $elapsedMs = (int) round((microtime(true) - $start) * 1000);
                if ($processed >= $maxJobsValue || $elapsedMs >= $timeBudget) {
                    break;
                }

                $timeoutOverride = null;
                if (!$fromCron) {
                    $remainingMs = max(200, $timeBudget - $elapsedMs);
                    $timeoutOverride = max(1, min(3, (int) ceil($remainingMs / 1000)));
                }

                $result = self::processJob($jobId, $timeoutOverride);
                $processed++;
                if (($result['status'] ?? '') === 'completed') {
                    $completed++;
                }
                if (($result['status'] ?? '') === 'failed') {
                    $failed++;
                }
            }

            $remaining = count(self::getPendingJobIds());
            $durationMs = (int) round((microtime(true) - $start) * 1000);
            Metrics::observe('openclaw_worker_duration_seconds', max(0.001, $durationMs / 1000), [
                'source' => $fromCron ? 'cron' : 'trigger'
            ]);

            FigoStorage::writeWorkerMeta([
                'lastRunAt' => gmdate('c'),
                'lastRunDurationMs' => $durationMs,
                'lastRunSource' => $fromCron ? 'cron' : 'trigger',
                'lastProcessed' => $processed,
                'lastCompleted' => $completed,
                'lastFailed' => $failed,
                'lastRemaining' => $remaining,
                'lastExpired' => (int) ($purge['expiredNow'] ?? 0)
            ]);

            return [
                'ok' => true,
                'processed' => $processed,
                'completed' => $completed,
                'failed' => $failed,
                'remaining' => $remaining,
                'expired' => (int) ($purge['expiredNow'] ?? 0),
                'deleted' => (int) ($purge['deleted'] ?? 0),
                'durationMs' => $durationMs
            ];
        } finally {
            FigoStorage::releaseLock($lock);
        }
    }
}
