<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/metrics.php';
require_once __DIR__ . '/figo_utils.php';

require_once __DIR__ . '/Figo/Config.php';
require_once __DIR__ . '/Figo/Storage.php';
require_once __DIR__ . '/Figo/Gateway.php';
require_once __DIR__ . '/Figo/Worker.php';
require_once __DIR__ . '/Figo/Service.php';

function figo_queue_clamp_int($raw, int $default, int $min, int $max): int
{
    return FigoConfig::clampInt($raw, $default, $min, $max);
}

function figo_queue_provider_mode(): string
{
    return FigoConfig::getProviderMode();
}

function figo_queue_enabled(): bool
{
    return FigoConfig::isQueueEnabled();
}

function figo_queue_gateway_endpoint(): string
{
    return FigoConfig::getGatewayEndpoint();
}

function figo_queue_gateway_api_key(): string
{
    return FigoConfig::getGatewayApiKey();
}

function figo_queue_prefers_figo_ai_auth(): bool
{
    return FigoConfig::prefersFigoAiAuth();
}

function figo_queue_gateway_model(): string
{
    return FigoConfig::getGatewayModel();
}

function figo_queue_gateway_key_header(): string
{
    return FigoConfig::getGatewayKeyHeader();
}

function figo_queue_gateway_key_prefix(): string
{
    return FigoConfig::getGatewayKeyPrefix();
}

function figo_queue_allow_local_fallback(): bool
{
    return FigoConfig::allowLocalFallback();
}

function figo_queue_queue_ttl_sec(): int
{
    return FigoConfig::getQueueTtlSec();
}

function figo_queue_retention_sec(): int
{
    return FigoConfig::getRetentionSec();
}

function figo_queue_sync_wait_ms(): int
{
    return FigoConfig::getSyncWaitMs();
}

function figo_queue_worker_max_jobs(): int
{
    return FigoConfig::getWorkerMaxJobs();
}

function figo_queue_worker_retry_max(): int
{
    return FigoConfig::getWorkerRetryMax();
}

function figo_queue_worker_timeout_seconds(): int
{
    return FigoConfig::getWorkerTimeoutSeconds();
}

function figo_queue_poll_after_ms(): int
{
    return FigoConfig::getPollAfterMs();
}

function figo_queue_poll_process_timeout_seconds(): int
{
    return FigoConfig::getPollProcessTimeoutSeconds();
}

function figo_queue_allow_client_model(): bool
{
    return FigoConfig::allowClientModel();
}

function figo_queue_normalize_model_name($rawModel): string
{
    return FigoConfig::normalizeModelName($rawModel);
}

function figo_queue_dir_base(): string
{
    return FigoStorage::getBaseDir();
}

function figo_queue_dir_jobs(): string
{
    return FigoStorage::getJobsDir();
}

function figo_queue_dir_locks(): string
{
    return FigoStorage::getLocksDir();
}

function figo_queue_worker_meta_path(): string
{
    return FigoStorage::getWorkerMetaPath();
}

function figo_queue_gateway_status_path(): string
{
    return FigoStorage::getGatewayStatusPath();
}

function figo_queue_ensure_dirs(): bool
{
    return FigoStorage::ensureDirs();
}

function figo_queue_job_id_is_valid(string $jobId): bool
{
    return FigoStorage::isValidJobId($jobId);
}

function figo_queue_new_job_id(): string
{
    return FigoStorage::generateJobId();
}

function figo_queue_job_path(string $jobId): string
{
    return FigoStorage::getJobPath($jobId);
}

function figo_queue_now(): int
{
    return time();
}

function figo_queue_safe_time_iso(int $ts): string
{
    return gmdate('c', max(1, $ts));
}

function figo_queue_read_json_file(string $path): ?array
{
    return FigoStorage::readJsonFile($path);
}

function figo_queue_write_json_file(string $path, array $data): bool
{
    return FigoStorage::writeJsonFile($path, $data);
}

function figo_queue_read_job(string $jobId): ?array
{
    return FigoStorage::readJob($jobId);
}

function figo_queue_write_job(array $job): bool
{
    return FigoStorage::writeJob($job);
}

function figo_queue_write_worker_meta(array $meta): void
{
    FigoStorage::writeWorkerMeta($meta);
}

function figo_queue_read_worker_meta(): array
{
    return FigoStorage::readWorkerMeta();
}

function figo_queue_write_gateway_status(array $status): void
{
    FigoStorage::writeGatewayStatus($status);
}

function figo_queue_read_gateway_status(): array
{
    return FigoStorage::readGatewayStatus();
}

function figo_queue_acquire_lock(string $name, int $timeoutMs = 800)
{
    return FigoStorage::acquireLock($name, $timeoutMs);
}

function figo_queue_release_lock($handle): void
{
    FigoStorage::releaseLock($handle);
}

function figo_queue_hash_value(string $value): string
{
    return hash('sha256', $value);
}

function figo_queue_gateway_error_code_from_status(int $httpCode, string $curlErr): string
{
    return FigoGateway::getErrorCodeFromStatus($httpCode, $curlErr);
}

function figo_queue_gateway_call(array $job, ?int $timeoutOverrideSeconds = null): array
{
    return FigoGateway::call($job, $timeoutOverrideSeconds);
}

function figo_queue_probe_gateway(int $timeoutSeconds = 2): ?bool
{
    return FigoGateway::probe($timeoutSeconds);
}

function figo_queue_build_unavailable_message(): string
{
    return FigoService::buildUnavailableMessage();
}

function figo_queue_count_depth(): array
{
    return FigoService::countDepth();
}

function figo_queue_purge_old_jobs(?int $nowTs = null): array
{
    return FigoWorker::purgeOldJobs($nowTs);
}

function figo_queue_mark_job(array $job, string $status, string $errorCode = '', string $errorMessage = '', ?array $completion = null): array
{
    return FigoWorker::markJob($job, $status, $errorCode, $errorMessage, $completion);
}

function figo_queue_process_job(string $jobId, ?int $gatewayTimeoutSeconds = null): array
{
    return FigoWorker::processJob($jobId, $gatewayTimeoutSeconds);
}

function figo_queue_pending_job_ids(): array
{
    return FigoWorker::getPendingJobIds();
}

function figo_queue_process_worker(?int $maxJobs = null, ?int $timeBudgetMs = null, bool $fromCron = false): array
{
    return FigoWorker::processWorker($maxJobs, $timeBudgetMs, $fromCron);
}

function figo_queue_wait_for_terminal(string $jobId, int $waitMs): array
{
    return FigoService::waitForTerminal($jobId, $waitMs);
}

function figo_queue_enqueue(array $payload): array
{
    return FigoService::enqueue($payload);
}

function figo_queue_status_payload_for_job(string $jobId): array
{
    return FigoService::statusPayloadForJob($jobId);
}

function figo_queue_bridge_result(array $payload): array
{
    return FigoService::bridgeResult($payload);
}

function figo_queue_status_overview(): array
{
    return FigoService::getStatusOverview();
}
