<?php

declare(strict_types=1);

require_once __DIR__ . '/../audit.php';
require_once __DIR__ . '/../metrics.php';
require_once __DIR__ . '/Config.php';
require_once __DIR__ . '/Storage.php';
require_once __DIR__ . '/Gateway.php';
require_once __DIR__ . '/Worker.php';

class FigoService
{
    private static function hashValue(string $value): string
    {
        return hash('sha256', $value);
    }

    private static function normalizeMessages(array $messages): array
    {
        $normalized = [];
        foreach ($messages as $msg) {
            if (!is_array($msg)) {
                continue;
            }

            $role = isset($msg['role']) ? strtolower(trim((string) $msg['role'])) : '';
            if (!in_array($role, ['system', 'user', 'assistant'], true)) {
                continue;
            }

            $content = trim((string) ($msg['content'] ?? ''));
            if ($content === '') {
                continue;
            }
            if (strlen($content) > 5000) {
                $content = substr($content, 0, 5000);
            }

            $normalized[] = [
                'role' => $role,
                'content' => $content
            ];
        }

        if (count($normalized) > 20) {
            $normalized = array_slice($normalized, -20);
        }

        return $normalized;
    }

    private static function defaultRequest(array $payload): array
    {
        $messages = isset($payload['messages']) && is_array($payload['messages'])
            ? self::normalizeMessages($payload['messages'])
            : [];
        $model = FigoConfig::getGatewayModel();
        if (FigoConfig::allowClientModel()) {
            $clientModel = FigoConfig::normalizeModelName($payload['model'] ?? null);
            if ($clientModel !== '') {
                $model = $clientModel;
            }
        }

        $maxTokens = isset($payload['max_tokens']) ? (int) $payload['max_tokens'] : 1000;
        if ($maxTokens < 64) {
            $maxTokens = 64;
        }
        if ($maxTokens > 2000) {
            $maxTokens = 2000;
        }

        $temperature = isset($payload['temperature']) ? (float) $payload['temperature'] : 0.7;
        if ($temperature < 0.0) {
            $temperature = 0.0;
        }
        if ($temperature > 1.0) {
            $temperature = 1.0;
        }

        return [
            'model' => $model,
            'messages' => $messages,
            'max_tokens' => $maxTokens,
            'temperature' => $temperature
        ];
    }

    private static function extractSessionId(array $payload): string
    {
        $metadata = isset($payload['metadata']) && is_array($payload['metadata']) ? $payload['metadata'] : [];
        $candidate = api_first_non_empty([
            isset($metadata['sessionId']) ? (string) $metadata['sessionId'] : '',
            isset($payload['sessionId']) ? (string) $payload['sessionId'] : '',
            session_id(),
            isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : ''
        ]);

        return $candidate !== '' ? $candidate : 'anonymous';
    }

    private static function requestHash(array $request): string
    {
        $payload = [
            'model' => (string) ($request['model'] ?? ''),
            'messages' => isset($request['messages']) && is_array($request['messages']) ? $request['messages'] : [],
            'max_tokens' => (int) ($request['max_tokens'] ?? 0),
            'temperature' => (float) ($request['temperature'] ?? 0)
        ];
        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            $encoded = serialize($payload);
        }

        return self::hashValue($encoded);
    }

    private static function findRecentByRequestHash(string $requestHash, string $sessionHash, int $lookbackSec = 75): ?array
    {
        if (!FigoStorage::ensureDirs()) {
            return null;
        }
        $files = glob(FigoStorage::getJobsDir() . DIRECTORY_SEPARATOR . '*.json');
        if (!is_array($files) || $files === []) {
            return null;
        }

        $now = time();
        rsort($files, SORT_STRING);
        $checked = 0;
        foreach ($files as $path) {
            $checked++;
            if ($checked > 80) {
                break;
            }

            $mtime = (int) @filemtime($path);
            if ($mtime > 0 && ($now - $mtime) > $lookbackSec) {
                continue;
            }

            $job = FigoStorage::readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }
            if ((string) ($job['requestHash'] ?? '') !== $requestHash) {
                continue;
            }
            if ((string) ($job['sessionIdHash'] ?? '') !== $sessionHash) {
                continue;
            }
            $status = (string) ($job['status'] ?? '');
            if (!in_array($status, ['queued', 'processing', 'completed'], true)) {
                continue;
            }

            $expiresAt = strtotime((string) ($job['expiresAt'] ?? ''));
            if ($expiresAt > 0 && $expiresAt < $now) {
                continue;
            }
            return $job;
        }

        return null;
    }

    private static function completionFromJob(array $job): ?array
    {
        if (isset($job['response']) && is_array($job['response'])) {
            if (isset($job['response']['choices'][0]['message']['content']) && is_string($job['response']['choices'][0]['message']['content'])) {
                return $job['response'];
            }
        }
        return null;
    }

    public static function buildUnavailableMessage(): string
    {
        return 'El asistente Figo no esta disponible temporalmente. Puedes escribirnos por WhatsApp al +593 98 245 3672.';
    }

    public static function enqueue(array $payload): array
    {
        if (!FigoStorage::ensureDirs()) {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => 'queue_storage_unavailable',
                'errorMessage' => 'No se pudo inicializar almacenamiento de cola'
            ];
        }

        $request = self::defaultRequest($payload);
        if (!isset($request['messages']) || !is_array($request['messages']) || $request['messages'] === []) {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => 'messages_required',
                'errorMessage' => 'messages es obligatorio'
            ];
        }

        $sessionHash = self::hashValue(self::extractSessionId($payload));
        $requestHash = self::requestHash($request);
        $recentJob = self::findRecentByRequestHash($requestHash, $sessionHash);
        if (is_array($recentJob)) {
            return [
                'ok' => true,
                'status' => 'deduplicated',
                'job' => $recentJob,
                'jobId' => (string) ($recentJob['jobId'] ?? '')
            ];
        }

        $now = time();
        $expiresTs = $now + FigoConfig::getQueueTtlSec();
        $jobId = FigoStorage::generateJobId();
        $job = [
            'jobId' => $jobId,
            'status' => 'queued',
            'createdAt' => gmdate('c', $now),
            'updatedAt' => gmdate('c', $now),
            'expiresAt' => gmdate('c', $expiresTs),
            'nextAttemptAt' => gmdate('c', $now),
            'sessionIdHash' => $sessionHash,
            'requestHash' => $requestHash,
            'attempts' => 0,
            'model' => (string) $request['model'],
            'messages' => $request['messages'],
            'temperature' => (float) $request['temperature'],
            'maxTokens' => (int) $request['max_tokens']
        ];

        if (!FigoStorage::writeJob($job)) {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => 'queue_write_failed',
                'errorMessage' => 'No se pudo persistir job'
            ];
        }

        Metrics::increment('openclaw_queue_jobs_total', ['status' => 'queued']);
        audit_log_event('figo.queue.enqueued', ['jobId' => $jobId]);

        return [
            'ok' => true,
            'status' => 'queued',
            'jobId' => $jobId,
            'job' => $job
        ];
    }

    public static function statusPayloadForJob(string $jobId): array
    {
        $job = FigoStorage::readJob($jobId);
        if (!is_array($job)) {
            return [
                'ok' => false,
                'status' => 'expired',
                'errorCode' => 'queue_expired',
                'errorMessage' => 'El job no existe o fue purgado'
            ];
        }

        $status = (string) ($job['status'] ?? 'queued');
        if ($status === 'completed') {
            $completion = self::completionFromJob($job);
            if (is_array($completion)) {
                return [
                    'ok' => true,
                    'status' => 'completed',
                    'completedAt' => (string) ($job['completedAt'] ?? gmdate('c')),
                    'provider' => 'openclaw_queue',
                    'completion' => $completion
                ];
            }
            $status = 'failed';
        }

        if ($status === 'failed') {
            return [
                'ok' => false,
                'status' => 'failed',
                'errorCode' => (string) ($job['errorCode'] ?? 'gateway_unknown'),
                'errorMessage' => (string) ($job['errorMessage'] ?? self::buildUnavailableMessage()),
                'failedAt' => (string) ($job['failedAt'] ?? gmdate('c'))
            ];
        }

        if ($status === 'expired') {
            return [
                'ok' => false,
                'status' => 'expired',
                'errorCode' => (string) ($job['errorCode'] ?? 'queue_expired'),
                'errorMessage' => (string) ($job['errorMessage'] ?? 'Solicitud expirada'),
                'expiredAt' => (string) ($job['expiredAt'] ?? gmdate('c'))
            ];
        }

        return [
            'ok' => true,
            'status' => $status,
            'jobId' => $jobId,
            'nextAttemptAt' => (string) ($job['nextAttemptAt'] ?? ''),
            'updatedAt' => (string) ($job['updatedAt'] ?? '')
        ];
    }

    public static function waitForTerminal(string $jobId, int $waitMs): array
    {
        $waitMs = FigoConfig::clampInt($waitMs, 2200, 0, 10000);
        if ($waitMs <= 0) {
            return ['status' => 'queued', 'job' => FigoStorage::readJob($jobId)];
        }

        $startedAt = (int) floor(microtime(true) * 1000);
        do {
            $job = FigoStorage::readJob($jobId);
            $status = is_array($job) ? (string) ($job['status'] ?? 'queued') : 'queued';
            if (in_array($status, ['completed', 'failed', 'expired'], true)) {
                return ['status' => $status, 'job' => $job];
            }
            usleep(120000);
        } while (((int) floor(microtime(true) * 1000) - $startedAt) < $waitMs);

        return ['status' => 'queued', 'job' => FigoStorage::readJob($jobId)];
    }

    public static function bridgeResult(array $payload): array
    {
        $enqueue = self::enqueue($payload);
        if (($enqueue['ok'] ?? false) !== true) {
            return [
                'httpStatus' => 400,
                'payload' => [
                    'ok' => false,
                    'provider' => 'openclaw_queue',
                    'mode' => 'failed',
                    'errorCode' => (string) ($enqueue['errorCode'] ?? 'queue_failed'),
                    'error' => (string) ($enqueue['errorMessage'] ?? 'No se pudo procesar la solicitud')
                ]
            ];
        }

        $jobId = (string) ($enqueue['jobId'] ?? '');
        if (!FigoStorage::isValidJobId($jobId)) {
            return [
                'httpStatus' => 500,
                'payload' => [
                    'ok' => false,
                    'provider' => 'openclaw_queue',
                    'mode' => 'failed',
                    'errorCode' => 'queue_invalid_jobid',
                    'error' => 'No se pudo crear el job'
                ]
            ];
        }

        FigoWorker::processWorker(
            FigoConfig::clampInt(getenv('OPENCLAW_TRIGGER_MAX_JOBS'), 1, 1, 8),
            FigoConfig::clampInt(getenv('OPENCLAW_TRIGGER_TIME_BUDGET_MS'), 900, 200, 5000),
            false
        );

        $terminal = self::waitForTerminal($jobId, FigoConfig::getSyncWaitMs());
        $status = (string) ($terminal['status'] ?? 'queued');
        $job = isset($terminal['job']) && is_array($terminal['job']) ? $terminal['job'] : FigoStorage::readJob($jobId);

        if ($status === 'completed' && is_array($job)) {
            $completion = self::completionFromJob($job);
            if (is_array($completion)) {
                $completion['mode'] = 'live';
                $completion['provider'] = 'openclaw_queue';
                $completion['source'] = 'openclaw_gateway';
                $completion['jobId'] = $jobId;
                return ['httpStatus' => 200, 'payload' => $completion];
            }
        }

        if ($status === 'failed' && is_array($job)) {
            return [
                'httpStatus' => 503,
                'payload' => [
                    'ok' => false,
                    'mode' => 'failed',
                    'provider' => 'openclaw_queue',
                    'source' => 'openclaw_gateway',
                    'jobId' => $jobId,
                    'errorCode' => (string) ($job['errorCode'] ?? 'gateway_unknown'),
                    'reason' => (string) ($job['errorCode'] ?? 'gateway_unknown'),
                    'error' => (string) ($job['errorMessage'] ?? self::buildUnavailableMessage())
                ]
            ];
        }

        return [
            'httpStatus' => 200,
            'payload' => [
                'ok' => true,
                'mode' => 'queued',
                'provider' => 'openclaw_queue',
                'source' => 'openclaw_queue',
                'jobId' => $jobId,
                'status' => 'queued',
                'pollUrl' => '/check-ai-response.php?jobId=' . rawurlencode($jobId),
                'pollAfterMs' => FigoConfig::getPollAfterMs(),
                'message' => 'Estamos procesando tu consulta...'
            ]
        ];
    }

    public static function countDepth(): array
    {
        $counts = [
            'queued' => 0,
            'processing' => 0,
            'completed' => 0,
            'failed' => 0,
            'expired' => 0
        ];
        if (!FigoStorage::ensureDirs()) {
            return $counts;
        }
        $files = glob(FigoStorage::getJobsDir() . DIRECTORY_SEPARATOR . '*.json');
        if (!is_array($files)) {
            return $counts;
        }
        foreach ($files as $path) {
            $job = FigoStorage::readJsonFile($path);
            if (!is_array($job)) {
                continue;
            }
            $status = (string) ($job['status'] ?? '');
            if (array_key_exists($status, $counts)) {
                $counts[$status]++;
            }
        }
        return $counts;
    }

    public static function getStatusOverview(): array
    {
        $depth = self::countDepth();
        $workerMeta = FigoStorage::readWorkerMeta();
        $gatewayStatus = FigoStorage::readGatewayStatus();
        $endpoint = FigoConfig::getGatewayEndpoint();
        $host = '';
        $path = '';
        if ($endpoint !== '') {
            $parts = @parse_url($endpoint);
            if (is_array($parts)) {
                $host = isset($parts['host']) ? strtolower((string) $parts['host']) : '';
                $path = isset($parts['path']) ? (string) $parts['path'] : '';
            }
        }

        return [
            'providerMode' => FigoConfig::getProviderMode(),
            'queueDepth' => $depth,
            'workerLastRunAt' => isset($workerMeta['lastRunAt']) ? (string) $workerMeta['lastRunAt'] : '',
            'workerLastRunDurationMs' => isset($workerMeta['lastRunDurationMs']) ? (int) $workerMeta['lastRunDurationMs'] : 0,
            'openclawReachable' => FigoGateway::probe(2),
            'gatewayHost' => $host,
            'gatewayPath' => $path,
            'gatewayAuthHeader' => FigoConfig::getGatewayKeyHeader(),
            'gatewayAuthPrefix' => FigoConfig::getGatewayKeyPrefix(),
            'prefersFigoAiAuth' => FigoConfig::prefersFigoAiAuth(),
            'gatewayConfigured' => $endpoint !== '',
            'gatewayAuthConfigured' => FigoConfig::getGatewayApiKey() !== '',
            'gatewayLastStatus' => $gatewayStatus
        ];
    }
}
