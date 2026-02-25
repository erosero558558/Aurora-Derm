<?php

declare(strict_types=1);

require_once __DIR__ . '/../figo_utils.php';

class FigoConfig
{
    public static function clampInt($raw, int $default, int $min, int $max): int
    {
        $value = is_numeric($raw) ? (int) $raw : $default;
        if ($value < $min) {
            return $min;
        }
        if ($value > $max) {
            return $max;
        }
        return $value;
    }

    public static function getProviderMode(): string
    {
        return api_figo_env_provider_mode();
    }

    public static function isQueueEnabled(): bool
    {
        return self::getProviderMode() === 'openclaw_queue';
    }

    public static function getGatewayEndpoint(): string
    {
        return api_figo_env_gateway_endpoint();
    }

    public static function getGatewayApiKey(): string
    {
        return api_figo_env_gateway_api_key();
    }

    public static function prefersFigoAiAuth(): bool
    {
        return api_figo_env_ai_endpoint() !== '';
    }

    public static function getGatewayModel(): string
    {
        return api_figo_env_gateway_model();
    }

    public static function getGatewayKeyHeader(): string
    {
        return api_figo_env_gateway_key_header();
    }

    public static function getGatewayKeyPrefix(): string
    {
        return api_figo_env_gateway_key_prefix();
    }

    public static function allowLocalFallback(): bool
    {
        return api_figo_env_allow_local_fallback();
    }

    public static function getQueueTtlSec(): int
    {
        return self::clampInt(getenv('OPENCLAW_QUEUE_TTL_SEC'), 1800, 60, 86400);
    }

    public static function getRetentionSec(): int
    {
        return self::clampInt(getenv('OPENCLAW_QUEUE_RETENTION_SEC'), 86400, 600, 604800);
    }

    public static function getSyncWaitMs(): int
    {
        return self::clampInt(getenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS'), 1400, 0, 10000);
    }

    public static function getWorkerMaxJobs(): int
    {
        return self::clampInt(getenv('OPENCLAW_WORKER_MAX_JOBS'), 20, 1, 200);
    }

    public static function getWorkerRetryMax(): int
    {
        return self::clampInt(getenv('OPENCLAW_WORKER_RETRY_MAX'), 2, 0, 5);
    }

    public static function getWorkerTimeoutSeconds(): int
    {
        return self::clampInt(getenv('OPENCLAW_GATEWAY_TIMEOUT_SECONDS'), 12, 4, 60);
    }

    public static function getPollAfterMs(): int
    {
        return self::clampInt(getenv('OPENCLAW_POLL_AFTER_MS'), 800, 400, 5000);
    }

    public static function getPollProcessTimeoutSeconds(): int
    {
        return self::clampInt(getenv('OPENCLAW_POLL_PROCESS_TIMEOUT_SEC'), 8, 1, 20);
    }

    public static function allowClientModel(): bool
    {
        return api_parse_bool(getenv('OPENCLAW_ALLOW_CLIENT_MODEL'), false);
    }

    public static function normalizeModelName($rawModel): string
    {
        if (!is_string($rawModel)) {
            return '';
        }
        $model = trim($rawModel);
        if ($model === '') {
            return '';
        }
        if (!preg_match('/^[a-zA-Z0-9._:\\/\\-]{2,160}$/', $model)) {
            return '';
        }
        return $model;
    }
}
