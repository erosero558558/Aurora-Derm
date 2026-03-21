<?php

declare(strict_types=1);

require_once __DIR__ . '/QueueConfig.php';
require_once __DIR__ . '/../metrics.php';

final class GatewayClient
{
    public function buildCompletion(string $model, string $content): array
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
                    'content' => $content,
                ],
                'finish_reason' => 'stop',
            ]],
        ];
    }

    public function extractCompletion(array $decoded, string $fallbackModel): ?array
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
                        'content' => trim((string) $decoded['choices'][0]['message']['content']),
                    ],
                    'finish_reason' => 'stop',
                ]],
            ];
        }

        foreach (['reply', 'response', 'text', 'answer', 'output'] as $key) {
            if (isset($decoded[$key]) && is_string($decoded[$key]) && trim($decoded[$key]) !== '') {
                return $this->buildCompletion($fallbackModel, trim((string) $decoded[$key]));
            }
        }

        return null;
    }

    public function errorCodeFromStatus(int $httpCode, string $curlErr): string
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

    public function call(array $job, ?int $timeoutOverrideSeconds = null): array
    {
        $endpoint = QueueConfig::gatewayEndpoint();
        if ($endpoint === '') {
            return [
                'ok' => false,
                'errorCode' => 'gateway_not_configured',
                'errorMessage' => 'OPENCLAW_GATEWAY_ENDPOINT no configurado',
                'httpCode' => 0,
                'durationMs' => 0,
            ];
        }
        if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
            return [
                'ok' => false,
                'errorCode' => 'curl_unavailable',
                'errorMessage' => 'cURL no disponible',
                'httpCode' => 0,
                'durationMs' => 0,
            ];
        }

        $model = isset($job['model']) && is_string($job['model']) && trim($job['model']) !== ''
            ? trim((string) $job['model'])
            : QueueConfig::gatewayModel();
        $payload = [
            'model' => $model,
            'messages' => isset($job['messages']) && is_array($job['messages']) ? $job['messages'] : [],
            'max_tokens' => isset($job['maxTokens']) ? (int) $job['maxTokens'] : 1000,
            'temperature' => isset($job['temperature']) ? (float) $job['temperature'] : 0.7,
            'metadata' => [
                'source' => 'figo-openclaw-queue',
                'jobId' => isset($job['jobId']) ? (string) $job['jobId'] : '',
            ],
        ];

        $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            return [
                'ok' => false,
                'errorCode' => 'payload_encode_failed',
                'errorMessage' => 'No se pudo serializar payload',
                'httpCode' => 0,
                'durationMs' => 0,
            ];
        }

        $headers = ['Content-Type: application/json', 'Accept: application/json'];
        $apiKey = QueueConfig::gatewayApiKey();
        if ($apiKey !== '') {
            $value = QueueConfig::gatewayKeyPrefix() !== ''
                ? (QueueConfig::gatewayKeyPrefix() . ' ' . $apiKey)
                : $apiKey;
            $headers[] = QueueConfig::gatewayKeyHeader() . ': ' . trim($value);
        }

        $timeout = is_int($timeoutOverrideSeconds)
            ? QueueConfig::clampInt($timeoutOverrideSeconds, QueueConfig::workerTimeoutSeconds(), 1, 60)
            : QueueConfig::workerTimeoutSeconds();
        $start = microtime(true);
        $ch = curl_init($endpoint);
        if ($ch === false) {
            return [
                'ok' => false,
                'errorCode' => 'curl_init_failed',
                'errorMessage' => 'No se pudo iniciar cURL',
                'httpCode' => 0,
                'durationMs' => 0,
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
            CURLOPT_MAXFILESIZE => 1572864,
        ]);
        if (function_exists('app_curl_apply_tls_defaults')) {
            app_curl_apply_tls_defaults($ch);
        }

        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = (string) curl_error($ch);
        curl_close($ch);

        $durationMs = (int) round((microtime(true) - $start) * 1000);
        Metrics::observe('openclaw_gateway_duration_seconds', max(0.001, $durationMs / 1000), [
            'operation' => 'chat_completion',
        ]);

        if (!is_string($raw) || $httpCode >= 400) {
            $errorCode = $this->errorCodeFromStatus($httpCode, $curlErr);
            Metrics::increment('openclaw_gateway_errors_total', ['reason' => $errorCode]);
            return [
                'ok' => false,
                'errorCode' => $errorCode,
                'errorMessage' => 'OpenClaw gateway no disponible',
                'httpCode' => $httpCode,
                'durationMs' => $durationMs,
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
                'durationMs' => $durationMs,
            ];
        }

        $completion = $this->extractCompletion($decoded, $model);
        if (!is_array($completion)) {
            Metrics::increment('openclaw_gateway_errors_total', ['reason' => 'gateway_invalid_completion']);
            return [
                'ok' => false,
                'errorCode' => 'gateway_invalid_completion',
                'errorMessage' => 'Respuesta sin completion usable',
                'httpCode' => $httpCode,
                'durationMs' => $durationMs,
            ];
        }

        return [
            'ok' => true,
            'completion' => $completion,
            'httpCode' => $httpCode,
            'durationMs' => $durationMs,
        ];
    }

    public function probe(int $timeoutSeconds = 2): ?bool
    {
        $endpoint = QueueConfig::gatewayEndpoint();
        if ($endpoint === '') {
            return null;
        }
        if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
            return null;
        }

        $timeout = QueueConfig::clampInt($timeoutSeconds, 2, 1, 8);
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
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        if (function_exists('app_curl_apply_tls_defaults')) {
            app_curl_apply_tls_defaults($ch);
        }
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false || $status === 0) {
            return false;
        }
        return $status < 500;
    }

    public function completionFromJob(array $job): ?array
    {
        if (isset($job['response']) && is_array($job['response'])) {
            if (isset($job['response']['choices'][0]['message']['content']) && is_string($job['response']['choices'][0]['message']['content'])) {
                return $job['response'];
            }
        }
        return null;
    }

    public function unavailableMessage(): string
    {
        return 'El asistente Figo no esta disponible temporalmente. Puedes escribirnos por WhatsApp al +593 98 245 3672.';
    }
}
