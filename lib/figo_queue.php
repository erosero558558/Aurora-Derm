<?php

declare(strict_types=1);

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/audit.php';
require_once __DIR__ . '/metrics.php';
require_once __DIR__ . '/figo_utils.php';

function figo_queue_clamp_int($raw, int $default, int $min, int $max): int
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

function figo_queue_provider_mode(): string
{
    return api_figo_env_provider_mode();
}

function figo_queue_enabled(): bool
{
    return figo_queue_provider_mode() === 'openclaw_queue';
}

function figo_queue_gateway_endpoint(): string
{
    return api_figo_env_gateway_endpoint();
}

function figo_queue_gateway_api_key(): string
{
    return api_figo_env_gateway_api_key();
}

function figo_queue_prefers_figo_ai_auth(): bool
{
    return api_figo_env_ai_endpoint() !== '';
}

function figo_queue_gateway_model(): string
{
    return api_figo_env_gateway_model();
}

function figo_queue_gateway_key_header(): string
{
    return api_figo_env_gateway_key_header();
}

function figo_queue_gateway_key_prefix(): string
{
    return api_figo_env_gateway_key_prefix();
}

function figo_queue_allow_local_fallback(): bool
{
    return api_figo_env_allow_local_fallback();
}

function figo_queue_queue_ttl_sec(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_QUEUE_TTL_SEC'), 1800, 60, 86400);
}

function figo_queue_retention_sec(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_QUEUE_RETENTION_SEC'), 86400, 600, 604800);
}

function figo_queue_sync_wait_ms(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_BRIDGE_SYNC_WAIT_MS'), 1400, 0, 10000);
}

function figo_queue_worker_max_jobs(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_WORKER_MAX_JOBS'), 20, 1, 200);
}

function figo_queue_worker_retry_max(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_WORKER_RETRY_MAX'), 2, 0, 5);
}

function figo_queue_worker_timeout_seconds(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_GATEWAY_TIMEOUT_SECONDS'), 12, 4, 60);
}

function figo_queue_poll_after_ms(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_POLL_AFTER_MS'), 800, 400, 5000);
}

function figo_queue_poll_process_timeout_seconds(): int
{
    return figo_queue_clamp_int(getenv('OPENCLAW_POLL_PROCESS_TIMEOUT_SEC'), 8, 1, 20);
}

function figo_queue_allow_client_model(): bool
{
    return api_parse_bool(getenv('OPENCLAW_ALLOW_CLIENT_MODEL'), false);
}

function figo_queue_normalize_model_name($rawModel): string
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

function figo_queue_dir_base(): string
{
    return data_dir_path() . DIRECTORY_SEPARATOR . 'ai-queue';
}

function figo_queue_dir_jobs(): string
{
    return figo_queue_dir_base() . DIRECTORY_SEPARATOR . 'jobs';
}

function figo_queue_dir_locks(): string
{
    return figo_queue_dir_base() . DIRECTORY_SEPARATOR . 'locks';
}

function figo_queue_worker_meta_path(): string
{
    return figo_queue_dir_base() . DIRECTORY_SEPARATOR . 'worker-meta.json';
}

function figo_queue_gateway_status_path(): string
{
    return figo_queue_dir_base() . DIRECTORY_SEPARATOR . 'gateway-status.json';
}

function figo_queue_ensure_dirs(): bool
{
    $dirs = [figo_queue_dir_base(), figo_queue_dir_jobs(), figo_queue_dir_locks()];
    foreach ($dirs as $dir) {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            return false;
        }
        ensure_data_htaccess($dir);
    }
    return true;
}

function figo_queue_job_id_is_valid(string $jobId): bool
{
    return preg_match('/^[a-f0-9]{24,64}$/', $jobId) === 1;
}

function figo_queue_new_job_id(): string
{
    try {
        return bin2hex(random_bytes(16));
    } catch (Throwable $e) {
        return substr(sha1((string) microtime(true) . (string) mt_rand()), 0, 32);
    }
}

function figo_queue_job_path(string $jobId): string
{
    if (!figo_queue_job_id_is_valid($jobId)) {
        return '';
    }
    return figo_queue_dir_jobs() . DIRECTORY_SEPARATOR . $jobId . '.json';
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
    if (!is_file($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : null;
}

function figo_queue_write_json_file(string $path, array $data): bool
{
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) {
        return false;
    }
    return @file_put_contents($path, $json, LOCK_EX) !== false;
}

function figo_queue_read_job(string $jobId): ?array
{
    $path = figo_queue_job_path($jobId);
    if ($path === '') {
        return null;
    }
    return figo_queue_read_json_file($path);
}

function figo_queue_write_job(array $job): bool
{
    if (!figo_queue_ensure_dirs()) {
        return false;
    }

    $jobId = isset($job['jobId']) ? (string) $job['jobId'] : '';
    $path = figo_queue_job_path($jobId);
    if ($path === '') {
        return false;
    }

    return figo_queue_write_json_file($path, $job);
}

function figo_queue_write_worker_meta(array $meta): void
{
    if (!figo_queue_ensure_dirs()) {
        return;
    }
    $current = figo_queue_read_json_file(figo_queue_worker_meta_path());
    if (!is_array($current)) {
        $current = [];
    }
    $next = array_merge($current, $meta);
    $next['updatedAt'] = gmdate('c');
    figo_queue_write_json_file(figo_queue_worker_meta_path(), $next);
}

function figo_queue_read_worker_meta(): array
{
    $meta = figo_queue_read_json_file(figo_queue_worker_meta_path());
    return is_array($meta) ? $meta : [];
}

function figo_queue_write_gateway_status(array $status): void
{
    if (!figo_queue_ensure_dirs()) {
        return;
    }
    figo_queue_write_json_file(figo_queue_gateway_status_path(), [
        'updatedAt' => gmdate('c'),
        'status' => $status
    ]);
}

function figo_queue_read_gateway_status(): array
{
    $raw = figo_queue_read_json_file(figo_queue_gateway_status_path());
    if (!is_array($raw)) {
        return [];
    }
    return isset($raw['status']) && is_array($raw['status']) ? $raw['status'] : [];
}

function figo_queue_acquire_lock(string $name, int $timeoutMs = 800)
{
    if (!figo_queue_ensure_dirs()) {
        return null;
    }

    $safeName = preg_replace('/[^a-zA-Z0-9_-]/', '_', $name);
    if (!is_string($safeName) || $safeName === '') {
        $safeName = 'lock';
    }
    $path = figo_queue_dir_locks() . DIRECTORY_SEPARATOR . $safeName . '.lock';
    $fp = @fopen($path, 'c+');
    if ($fp === false) {
        return null;
    }

    $start = (int) floor(microtime(true) * 1000);
    do {
        if (@flock($fp, LOCK_EX | LOCK_NB)) {
            return $fp;
        }
        usleep(25000);
        $elapsed = (int) floor(microtime(true) * 1000) - $start;
    } while ($elapsed < max(0, $timeoutMs));

    @fclose($fp);
    return null;
}

function figo_queue_release_lock($handle): void
{
    if (!is_resource($handle)) {
        return;
    }
    @flock($handle, LOCK_UN);
    @fclose($handle);
}

function figo_queue_hash_value(string $value): string
{
    return hash('sha256', $value);
}

function figo_queue_normalize_messages(array $messages): array
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

function figo_queue_default_request(array $payload): array
{
    $messages = isset($payload['messages']) && is_array($payload['messages'])
        ? figo_queue_normalize_messages($payload['messages'])
        : [];
    $model = figo_queue_gateway_model();
    if (figo_queue_allow_client_model()) {
        $clientModel = figo_queue_normalize_model_name($payload['model'] ?? null);
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

function figo_queue_extract_session_id(array $payload): string
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

function figo_queue_request_hash(array $request): string
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

    return figo_queue_hash_value($encoded);
}

function figo_queue_find_recent_by_request_hash(string $requestHash, string $sessionHash, int $lookbackSec = 75): ?array
{
    if (!figo_queue_ensure_dirs()) {
        return null;
    }
    $files = glob(figo_queue_dir_jobs() . DIRECTORY_SEPARATOR . '*.json');
    if (!is_array($files) || $files === []) {
        return null;
    }

    $now = figo_queue_now();
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

        $job = figo_queue_read_json_file($path);
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

function figo_queue_build_completion(string $model, string $content): array
{
    try {
        $id = 'figo-openclaw-' . bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        $id = 'figo-openclaw-' . substr(sha1((string) microtime(true)), 0, 16);
    }

    return [
        'id' => $id,
        'object' => 'chat.completion',
        'created' => time(),
        'model' => $model,
        'choices' => [[
            'index' => 0,
            'message' => [
                'role' => 'assistant',
                'content' => $content
            ],
            'finish_reason' => 'stop'
        ]]
    ];
}

function figo_queue_extract_completion(array $decoded, string $fallbackModel): ?array
{
    if (isset($decoded['choices'][0]['message']['content']) && is_string($decoded['choices'][0]['message']['content'])) {
        return [
            'id' => isset($decoded['id']) && is_string($decoded['id']) ? (string) $decoded['id'] : ('figo-openclaw-' . substr(sha1((string) microtime(true)), 0, 16)),
            'object' => 'chat.completion',
            'created' => isset($decoded['created']) && is_numeric($decoded['created']) ? (int) $decoded['created'] : time(),
            'model' => isset($decoded['model']) && is_string($decoded['model']) ? (string) $decoded['model'] : $fallbackModel,
            'choices' => [[
                'index' => 0,
                'message' => [
                    'role' => 'assistant',
                    'content' => trim((string) $decoded['choices'][0]['message']['content'])
                ],
                'finish_reason' => 'stop'
            ]]
        ];
    }

    foreach (['reply', 'response', 'text', 'answer', 'output'] as $key) {
        if (isset($decoded[$key]) && is_string($decoded[$key]) && trim($decoded[$key]) !== '') {
            return figo_queue_build_completion($fallbackModel, trim((string) $decoded[$key]));
        }
    }

    return null;
}

function figo_queue_gateway_error_code_from_status(int $httpCode, string $curlErr): string
{
    if ($curlErr !== '') {
        if (stripos($curlErr, 'timed out') !== false) {
            return 'gateway_timeout';
        }
        if (stripos($curlErr, 'ssl') !== false) {
            return 'gateway_ssl_error';
        }
        return 'gateway_network';
    }
    if ($httpCode === 401 || $httpCode === 403) {
        return 'gateway_auth';
    }
    if ($httpCode === 408) {
        return 'gateway_timeout';
    }
    if ($httpCode === 429) {
        return 'gateway_rate_limited';
    }
    if ($httpCode >= 500) {
        return 'gateway_upstream_5xx';
    }
    if ($httpCode >= 400) {
        return 'gateway_upstream_4xx';
    }
    return 'gateway_unknown';
}

function figo_queue_gateway_call(array $job, ?int $timeoutOverrideSeconds = null): array
{
    $endpoint = figo_queue_gateway_endpoint();
    if ($endpoint === '') {
        return [
            'ok' => false,
            'errorCode' => 'gateway_not_configured',
            'errorMessage' => 'OPENCLAW_GATEWAY_ENDPOINT no configurado',
            'httpCode' => 0,
            'durationMs' => 0
        ];
    }
    if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
        return [
            'ok' => false,
            'errorCode' => 'curl_unavailable',
            'errorMessage' => 'cURL no disponible',
            'httpCode' => 0,
            'durationMs' => 0
        ];
    }

    $model = isset($job['model']) && is_string($job['model']) && trim($job['model']) !== ''
        ? trim((string) $job['model'])
        : figo_queue_gateway_model();
    $payload = [
        'model' => $model,
        'messages' => isset($job['messages']) && is_array($job['messages']) ? $job['messages'] : [],
        'max_tokens' => isset($job['maxTokens']) ? (int) $job['maxTokens'] : 1000,
        'temperature' => isset($job['temperature']) ? (float) $job['temperature'] : 0.7,
        'metadata' => [
            'source' => 'figo-openclaw-queue',
            'jobId' => isset($job['jobId']) ? (string) $job['jobId'] : ''
        ]
    ];

    $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($encoded)) {
        return [
            'ok' => false,
            'errorCode' => 'payload_encode_failed',
            'errorMessage' => 'No se pudo serializar payload',
            'httpCode' => 0,
            'durationMs' => 0
        ];
    }

    $headers = ['Content-Type: application/json', 'Accept: application/json'];
    $apiKey = figo_queue_gateway_api_key();
    if ($apiKey !== '') {
        $value = figo_queue_gateway_key_prefix() !== ''
            ? (figo_queue_gateway_key_prefix() . ' ' . $apiKey)
            : $apiKey;
        $headers[] = figo_queue_gateway_key_header() . ': ' . trim($value);
    }

    $timeout = is_int($timeoutOverrideSeconds)
        ? figo_queue_clamp_int($timeoutOverrideSeconds, figo_queue_worker_timeout_seconds(), 1, 60)
        : figo_queue_worker_timeout_seconds();
    $start = microtime(true);
    $ch = curl_init($endpoint);
    if ($ch === false) {
        return [
            'ok' => false,
            'errorCode' => 'curl_init_failed',
            'errorMessage' => 'No se pudo iniciar cURL',
            'httpCode' => 0,
            'durationMs' => 0
        ];
    }

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => $encoded,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => min(6, $timeout),
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_MAXFILESIZE => 1572864
    ]);

    $raw = curl_exec($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlErr = (string) curl_error($ch);
    curl_close($ch);

    $durationMs = (int) round((microtime(true) - $start) * 1000);
    Metrics::observe('openclaw_gateway_duration_seconds', max(0.001, $durationMs / 1000), [
        'operation' => 'chat_completion'
    ]);

    if (!is_string($raw) || $httpCode >= 400) {
        $errorCode = figo_queue_gateway_error_code_from_status($httpCode, $curlErr);
        Metrics::increment('openclaw_gateway_errors_total', ['reason' => $errorCode]);
        return [
            'ok' => false,
            'errorCode' => $errorCode,
            'errorMessage' => 'OpenClaw gateway no disponible',
            'httpCode' => $httpCode,
            'durationMs' => $durationMs
        ];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        Metrics::increment('openclaw_gateway_errors_total', ['reason' => 'gateway_invalid_json']);
        return [
            'ok' => false,
            'errorCode' => 'gateway_invalid_json',
            'errorMessage' => 'Respuesta no valida del gateway',
            'httpCode' => $httpCode,
            'durationMs' => $durationMs
        ];
    }

    $completion = figo_queue_extract_completion($decoded, $model);
    if (!is_array($completion)) {
        Metrics::increment('openclaw_gateway_errors_total', ['reason' => 'gateway_invalid_completion']);
        return [
            'ok' => false,
            'errorCode' => 'gateway_invalid_completion',
            'errorMessage' => 'Respuesta sin completion usable',
            'httpCode' => $httpCode,
            'durationMs' => $durationMs
        ];
    }

    return [
        'ok' => true,
        'completion' => $completion,
        'httpCode' => $httpCode,
        'durationMs' => $durationMs
    ];
}

function figo_queue_probe_gateway(int $timeoutSeconds = 2): ?bool
{
    $endpoint = figo_queue_gateway_endpoint();
    if ($endpoint === '') {
        return null;
    }
    if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
        return null;
    }

    $timeout = figo_queue_clamp_int($timeoutSeconds, 2, 1, 8);
    $ch = curl_init($endpoint);
    if ($ch === false) {
        return null;
    }
    curl_setopt_array($ch, [
        CURLOPT_NOBODY => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false || $status === 0) {
        return false;
    }
    return $status < 500;
}

function figo_queue_completion_from_job(array $job): ?array
{
    if (isset($job['response']) && is_array($job['response'])) {
        if (isset($job['response']['choices'][0]['message']['content']) && is_string($job['response']['choices'][0]['message']['content'])) {
            return $job['response'];
        }
    }
    return null;
}

function figo_queue_build_unavailable_message(): string
{
    return 'El asistente Figo no esta disponible temporalmente. Puedes escribirnos por WhatsApp al +593 98 245 3672.';
}

function figo_queue_count_depth(): array
{
    $counts = [
        'queued' => 0,
        'processing' => 0,
        'completed' => 0,
        'failed' => 0,
        'expired' => 0
    ];
    if (!figo_queue_ensure_dirs()) {
        return $counts;
    }
    $files = glob(figo_queue_dir_jobs() . DIRECTORY_SEPARATOR . '*.json');
    if (!is_array($files)) {
        return $counts;
    }
    foreach ($files as $path) {
        $job = figo_queue_read_json_file($path);
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

function figo_queue_purge_old_jobs(?int $nowTs = null): array
{
    $now = is_int($nowTs) ? $nowTs : figo_queue_now();
    $ttl = figo_queue_queue_ttl_sec();
    $retention = figo_queue_retention_sec();
    $result = ['expiredNow' => 0, 'deleted' => 0];

    if (!figo_queue_ensure_dirs()) {
        return $result;
    }

    $files = glob(figo_queue_dir_jobs() . DIRECTORY_SEPARATOR . '*.json');
    if (!is_array($files)) {
        return $result;
    }

    foreach ($files as $path) {
        $job = figo_queue_read_json_file($path);
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
                figo_queue_write_json_file($path, $job);
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

function figo_queue_mark_job(array $job, string $status, string $errorCode = '', string $errorMessage = '', ?array $completion = null): array
{
    $now = figo_queue_now();
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

function figo_queue_should_retry_error(string $errorCode): bool
{
    return in_array($errorCode, ['gateway_timeout', 'gateway_network', 'gateway_upstream_5xx', 'gateway_rate_limited'], true);
}

function figo_queue_next_retry_at(int $attempts, int $now): int
{
    $backoff = min(5 + ($attempts * 2), 30);
    return $now + $backoff;
}

function figo_queue_process_job(string $jobId, ?int $gatewayTimeoutSeconds = null): array
{
    $jobLock = figo_queue_acquire_lock('job-' . $jobId, 600);
    if (!is_resource($jobLock)) {
        return ['ok' => false, 'status' => 'lock_busy', 'jobId' => $jobId];
    }

    try {
        $job = figo_queue_read_job($jobId);
        if (!is_array($job)) {
            return ['ok' => false, 'status' => 'missing', 'jobId' => $jobId];
        }

        $status = (string) ($job['status'] ?? '');
        if (in_array($status, ['completed', 'failed', 'expired'], true)) {
            return ['ok' => true, 'status' => $status, 'jobId' => $jobId];
        }

        $now = figo_queue_now();
        $expiresAtTs = strtotime((string) ($job['expiresAt'] ?? ''));
        if ($expiresAtTs > 0 && $expiresAtTs < $now) {
            $job = figo_queue_mark_job($job, 'expired', 'queue_expired', 'Job vencido en cola');
            figo_queue_write_job($job);
            Metrics::increment('openclaw_queue_jobs_total', ['status' => 'expired']);
            return ['ok' => false, 'status' => 'expired', 'jobId' => $jobId];
        }

        $nextAttemptAtTs = strtotime((string) ($job['nextAttemptAt'] ?? ''));
        if ($nextAttemptAtTs > $now) {
            return ['ok' => true, 'status' => 'deferred', 'jobId' => $jobId];
        }

        $attempts = isset($job['attempts']) ? ((int) $job['attempts']) + 1 : 1;
        $job['attempts'] = $attempts;
        $job = figo_queue_mark_job($job, 'processing');
        figo_queue_write_job($job);

        $gatewayResult = figo_queue_gateway_call($job, $gatewayTimeoutSeconds);
        figo_queue_write_gateway_status([
            'ok' => (bool) ($gatewayResult['ok'] ?? false),
            'errorCode' => (string) ($gatewayResult['errorCode'] ?? ''),
            'httpCode' => (int) ($gatewayResult['httpCode'] ?? 0)
        ]);

        if (($gatewayResult['ok'] ?? false) === true && is_array($gatewayResult['completion'] ?? null)) {
            $job = figo_queue_mark_job($job, 'completed', '', '', $gatewayResult['completion']);
            figo_queue_write_job($job);
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
        $retryMax = figo_queue_worker_retry_max();
        $shouldRetry = $attempts <= $retryMax && figo_queue_should_retry_error($errorCode);

        if ($shouldRetry) {
            $nextRetryTs = figo_queue_next_retry_at($attempts, $now);
            $job['nextAttemptAt'] = figo_queue_safe_time_iso($nextRetryTs);
            $job = figo_queue_mark_job($job, 'queued', $errorCode, $errorMessage);
            figo_queue_write_job($job);
            audit_log_event('figo.queue.retry', [
                'jobId' => $jobId,
                'attempts' => $attempts,
                'errorCode' => $errorCode
            ]);
            return ['ok' => false, 'status' => 'retry', 'jobId' => $jobId];
        }

        $job = figo_queue_mark_job($job, 'failed', $errorCode, $errorMessage);
        figo_queue_write_job($job);
        Metrics::increment('openclaw_queue_jobs_total', ['status' => 'failed']);
        audit_log_event('figo.queue.failed', [
            'jobId' => $jobId,
            'attempts' => $attempts,
            'errorCode' => $errorCode
        ]);
        return ['ok' => false, 'status' => 'failed', 'jobId' => $jobId];
    } finally {
        figo_queue_release_lock($jobLock);
    }
}

function figo_queue_pending_job_ids(): array
{
    $result = [];
    if (!figo_queue_ensure_dirs()) {
        return $result;
    }
    $files = glob(figo_queue_dir_jobs() . DIRECTORY_SEPARATOR . '*.json');
    if (!is_array($files) || $files === []) {
        return $result;
    }

    $now = figo_queue_now();
    $scored = [];
    foreach ($files as $path) {
        $job = figo_queue_read_json_file($path);
        if (!is_array($job)) {
            continue;
        }
        $status = (string) ($job['status'] ?? '');
        if (!in_array($status, ['queued', 'processing'], true)) {
            continue;
        }
        $jobId = isset($job['jobId']) ? (string) $job['jobId'] : '';
        if (!figo_queue_job_id_is_valid($jobId)) {
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

function figo_queue_process_worker(?int $maxJobs = null, ?int $timeBudgetMs = null, bool $fromCron = false): array
{
    $start = microtime(true);
    $maxJobsValue = is_int($maxJobs) && $maxJobs > 0 ? $maxJobs : figo_queue_worker_max_jobs();
    $timeBudget = is_int($timeBudgetMs) && $timeBudgetMs > 0
        ? figo_queue_clamp_int($timeBudgetMs, 1600, 200, 30000)
        : 1600;

    $lock = figo_queue_acquire_lock('worker-global', 120);
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
        $purge = figo_queue_purge_old_jobs();
        $pending = figo_queue_pending_job_ids();
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

            $result = figo_queue_process_job($jobId, $timeoutOverride);
            $processed++;
            if (($result['status'] ?? '') === 'completed') {
                $completed++;
            }
            if (($result['status'] ?? '') === 'failed') {
                $failed++;
            }
        }

        $remaining = count(figo_queue_pending_job_ids());
        $durationMs = (int) round((microtime(true) - $start) * 1000);
        Metrics::observe('openclaw_worker_duration_seconds', max(0.001, $durationMs / 1000), [
            'source' => $fromCron ? 'cron' : 'trigger'
        ]);

        figo_queue_write_worker_meta([
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
        figo_queue_release_lock($lock);
    }
}

function figo_queue_wait_for_terminal(string $jobId, int $waitMs): array
{
    $waitMs = figo_queue_clamp_int($waitMs, 2200, 0, 10000);
    if ($waitMs <= 0) {
        return ['status' => 'queued', 'job' => figo_queue_read_job($jobId)];
    }

    $startedAt = (int) floor(microtime(true) * 1000);
    do {
        $job = figo_queue_read_job($jobId);
        $status = is_array($job) ? (string) ($job['status'] ?? 'queued') : 'queued';
        if (in_array($status, ['completed', 'failed', 'expired'], true)) {
            return ['status' => $status, 'job' => $job];
        }
        usleep(120000);
    } while (((int) floor(microtime(true) * 1000) - $startedAt) < $waitMs);

    return ['status' => 'queued', 'job' => figo_queue_read_job($jobId)];
}

function figo_queue_enqueue(array $payload): array
{
    if (!figo_queue_ensure_dirs()) {
        return [
            'ok' => false,
            'status' => 'failed',
            'errorCode' => 'queue_storage_unavailable',
            'errorMessage' => 'No se pudo inicializar almacenamiento de cola'
        ];
    }

    $request = figo_queue_default_request($payload);
    if (!isset($request['messages']) || !is_array($request['messages']) || $request['messages'] === []) {
        return [
            'ok' => false,
            'status' => 'failed',
            'errorCode' => 'messages_required',
            'errorMessage' => 'messages es obligatorio'
        ];
    }

    $sessionHash = figo_queue_hash_value(figo_queue_extract_session_id($payload));
    $requestHash = figo_queue_request_hash($request);
    $recentJob = figo_queue_find_recent_by_request_hash($requestHash, $sessionHash);
    if (is_array($recentJob)) {
        return [
            'ok' => true,
            'status' => 'deduplicated',
            'job' => $recentJob,
            'jobId' => (string) ($recentJob['jobId'] ?? '')
        ];
    }

    $now = figo_queue_now();
    $expiresTs = $now + figo_queue_queue_ttl_sec();
    $jobId = figo_queue_new_job_id();
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

    if (!figo_queue_write_job($job)) {
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

function figo_queue_status_payload_for_job(string $jobId): array
{
    $job = figo_queue_read_job($jobId);
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
        $completion = figo_queue_completion_from_job($job);
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
            'errorMessage' => (string) ($job['errorMessage'] ?? figo_queue_build_unavailable_message()),
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

function figo_queue_bridge_result(array $payload): array
{
    $enqueue = figo_queue_enqueue($payload);
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
    if (!figo_queue_job_id_is_valid($jobId)) {
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

    figo_queue_process_worker(
        figo_queue_clamp_int(getenv('OPENCLAW_TRIGGER_MAX_JOBS'), 1, 1, 8),
        figo_queue_clamp_int(getenv('OPENCLAW_TRIGGER_TIME_BUDGET_MS'), 900, 200, 5000),
        false
    );

    $terminal = figo_queue_wait_for_terminal($jobId, figo_queue_sync_wait_ms());
    $status = (string) ($terminal['status'] ?? 'queued');
    $job = isset($terminal['job']) && is_array($terminal['job']) ? $terminal['job'] : figo_queue_read_job($jobId);

    if ($status === 'completed' && is_array($job)) {
        $completion = figo_queue_completion_from_job($job);
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
                'error' => (string) ($job['errorMessage'] ?? figo_queue_build_unavailable_message())
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
            'pollAfterMs' => figo_queue_poll_after_ms(),
            'message' => 'Estamos procesando tu consulta...'
        ]
    ];
}

function figo_queue_status_overview(): array
{
    $depth = figo_queue_count_depth();
    $workerMeta = figo_queue_read_worker_meta();
    $gatewayStatus = figo_queue_read_gateway_status();
    $endpoint = figo_queue_gateway_endpoint();
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
        'providerMode' => figo_queue_provider_mode(),
        'queueDepth' => $depth,
        'workerLastRunAt' => isset($workerMeta['lastRunAt']) ? (string) $workerMeta['lastRunAt'] : '',
        'workerLastRunDurationMs' => isset($workerMeta['lastRunDurationMs']) ? (int) $workerMeta['lastRunDurationMs'] : 0,
        'openclawReachable' => figo_queue_probe_gateway(2),
        'gatewayHost' => $host,
        'gatewayPath' => $path,
        'gatewayAuthHeader' => figo_queue_gateway_key_header(),
        'gatewayAuthPrefix' => figo_queue_gateway_key_prefix(),
        'prefersFigoAiAuth' => figo_queue_prefers_figo_ai_auth(),
        'gatewayConfigured' => $endpoint !== '',
        'gatewayAuthConfigured' => figo_queue_gateway_api_key() !== '',
        'gatewayLastStatus' => $gatewayStatus
    ];
}
