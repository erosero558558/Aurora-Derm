<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';
require_once __DIR__ . '/figo-brain.php';

apply_security_headers(false);

/**
 * Figo chat endpoint.
 * Frontend -> /figo-chat.php -> configured Figo backend.
 */

function figo_apply_cors(): void
{
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

    $origin = isset($_SERVER['HTTP_ORIGIN']) ? trim((string) $_SERVER['HTTP_ORIGIN']) : '';
    if ($origin === '') {
        return;
    }

    $allowed = [];
    $rawAllowed = getenv('PIELARMONIA_ALLOWED_ORIGINS');
    if (is_string($rawAllowed) && trim($rawAllowed) !== '') {
        foreach (explode(',', $rawAllowed) as $item) {
            $item = trim($item);
            if ($item !== '') {
                $allowed[] = rtrim($item, '/');
            }
        }
    }

    $allowed[] = 'https://pielarmonia.com';
    $allowed[] = 'https://www.pielarmonia.com';
    $allowed = array_values(array_unique(array_filter($allowed)));

    $normalizedOrigin = rtrim($origin, '/');
    foreach ($allowed as $allowedOrigin) {
        if (strcasecmp($normalizedOrigin, $allowedOrigin) === 0) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Vary: Origin');
            header('Cross-Origin-Resource-Policy: cross-origin');
            return;
        }
    }
}

function figo_extract_text(array $decoded, string $raw): string
{
    if (isset($decoded['choices'][0]['message']['content']) && is_string($decoded['choices'][0]['message']['content'])) {
        return trim($decoded['choices'][0]['message']['content']);
    }

    if (isset($decoded['message']['content']) && is_string($decoded['message']['content'])) {
        return trim($decoded['message']['content']);
    }

    foreach (['reply', 'response', 'text', 'answer', 'output'] as $key) {
        if (isset($decoded[$key]) && is_string($decoded[$key])) {
            return trim($decoded[$key]);
        }
    }

    return trim($raw);
}

function figo_is_upstream_technical_fallback(string $content): bool
{
    $normalized = strtolower(trim($content));
    if ($normalized === '') {
        return false;
    }

    if (function_exists('iconv')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $normalized);
        if (is_string($ascii) && $ascii !== '') {
            $normalized = $ascii;
        }
    }

    $signals = [
        'estoy teniendo problemas tecnicos',
        'contactanos directamente por whatsapp',
        'te atenderemos personalmente'
    ];

    $matches = 0;
    foreach ($signals as $signal) {
        if (strpos($normalized, $signal) !== false) {
            $matches++;
        }
    }

    return $matches >= 2;
}

function figo_normalize_text(string $text): string
{
    $text = strtolower(trim($text));
    if ($text === '') {
        return '';
    }

    if (function_exists('iconv')) {
        $ascii = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if (is_string($ascii) && $ascii !== '') {
            $text = $ascii;
        }
    }

    $text = preg_replace('/\s+/', ' ', $text);
    return is_string($text) ? $text : '';
}

function figo_last_user_message(array $messages): string
{
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        $message = $messages[$i] ?? null;
        if (!is_array($message)) {
            continue;
        }
        $role = isset($message['role']) && is_string($message['role'])
            ? strtolower(trim((string) $message['role']))
            : '';
        $content = isset($message['content']) && is_string($message['content'])
            ? trim((string) $message['content'])
            : '';
        if ($role === 'user' && $content !== '') {
            return $content;
        }
    }
    return '';
}

function figo_contains_any_pattern(string $text, array $patterns): bool
{
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $text) === 1) {
            return true;
        }
    }
    return false;
}

function figo_fast_local_content(string $normalizedText): string
{
    if ($normalizedText === '') {
        return 'Soy Figo. Puedo ayudarte con servicios, precios, pagos, horarios y reservas de Piel en Armonia.';
    }

    if (preg_match('/^(hola|buenos dias|buenas tardes|buenas noches|hello|hi|gracias|ok|vale|listo|perfecto)$/', $normalizedText) === 1) {
        return 'Hola, soy Figo de Piel en Armonia. Te ayudo con servicios, precios y reservas de cita.';
    }

    if (figo_contains_any_pattern($normalizedText, [
        '/\bping\b/',
        '/\blatencia\b/',
        '/\btest\b/',
        '/\bprueba\b/'
    ])) {
        return 'Estoy activo y respondiendo. Puedo ayudarte con servicios, precios, pagos y reservas de cita.';
    }

    if (figo_contains_any_pattern($normalizedText, [
        '/\bcapital\b/',
        '/\bpresidente\b/',
        '/\bfutbol\b/',
        '/\bclima\b/',
        '/\bnoticia\b/',
        '/\bbitcoin\b/',
        '/\bcriptomoneda\b/'
    ])) {
        return 'Me enfoco en Piel en Armonia. Puedo ayudarte con citas, servicios, precios, pagos y ubicacion de la clinica.';
    }

    return '';
}


function figo_endpoint_diagnostics(string $endpoint): array
{
    if ($endpoint === '') {
        return [
            'configured' => false,
            'endpointHost' => '',
            'endpointScheme' => '',
            'endpointPath' => ''
        ];
    }

    $parts = @parse_url($endpoint);
    if (!is_array($parts)) {
        return [
            'configured' => true,
            'endpointHost' => '',
            'endpointScheme' => '',
            'endpointPath' => ''
        ];
    }

    return [
        'configured' => true,
        'endpointHost' => isset($parts['host']) ? (string) $parts['host'] : '',
        'endpointScheme' => isset($parts['scheme']) ? (string) $parts['scheme'] : '',
        'endpointPath' => isset($parts['path']) ? (string) $parts['path'] : ''
    ];
}

function figo_is_recursive_endpoint(string $endpoint): bool
{
    $endpoint = trim($endpoint);
    if ($endpoint === '') {
        return false;
    }

    $parts = @parse_url($endpoint);
    if (!is_array($parts)) {
        return false;
    }

    $endpointHost = strtolower((string) ($parts['host'] ?? ''));
    $endpointPath = strtolower((string) ($parts['path'] ?? ''));
    $requestHost = strtolower((string) ($_SERVER['HTTP_HOST'] ?? ''));
    $requestPath = strtolower((string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/figo-chat.php'), PHP_URL_PATH));
    if ($requestPath === '') {
        $requestPath = '/figo-chat.php';
    }

    if ($endpointHost === '' || $requestHost === '' || $endpointPath === '') {
        return false;
    }

    $normalizedEndpointHost = preg_replace('/^www\./', '', $endpointHost);
    $normalizedRequestHost = preg_replace('/^www\./', '', $requestHost);
    if ($normalizedEndpointHost !== $normalizedRequestHost) {
        return false;
    }

    if ($endpointPath === $requestPath) {
        return true;
    }

    return $endpointPath === '/figo-chat.php';
}

function figo_probe_upstream(string $endpoint, int $timeoutSeconds = 3): ?bool
{
    if (trim($endpoint) === '') {
        return null;
    }

    if (!function_exists('curl_init') || !function_exists('curl_setopt_array') || !function_exists('curl_exec')) {
        return null;
    }

    if (figo_is_recursive_endpoint($endpoint)) {
        return false;
    }

    $timeout = max(1, min(5, $timeoutSeconds));
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

function figo_finalize_completion(
    array $response,
    string $mode,
    string $source,
    string $reason = '',
    bool $configured = true,
    bool $recursiveConfigDetected = false,
    ?int $upstreamStatus = null
): array {
    $response['mode'] = $mode;
    $response['source'] = $source;
    $response['configured'] = $configured;
    $response['recursiveConfigDetected'] = $recursiveConfigDetected;
    if ($reason !== '') {
        $response['reason'] = $reason;
    }
    if (is_int($upstreamStatus)) {
        $response['upstreamStatus'] = $upstreamStatus;
    }
    return $response;
}

function figo_build_fallback_completion(string $model, array $messages): array
{
    // Try to use FigoBrain V3 (Advanced Logic)
    try {
        if (class_exists('FigoBrain')) {
            return FigoBrain::process($messages);
        }
    } catch (Throwable $e) {
        error_log('Piel en Armonía FigoBrain Exception: ' . $e->getMessage());
    }

    // Safety Net (Extreme Fallback)
    try {
        $id = 'figo-panic-' . bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        $id = 'figo-panic-' . substr(md5((string) microtime(true)), 0, 16);
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
                'content' => "Lo siento, estoy teniendo problemas técnicos momentáneos. Por favor contáctanos directamente al WhatsApp +593 98 245 3672."
            ],
            'finish_reason' => 'stop'
        ]]
    ];
}

function figo_degraded_mode_enabled(): bool
{
    $raw = getenv('FIGO_CHAT_DEGRADED_MODE');
    if (!is_string($raw) || trim($raw) === '') {
        // Default estricto: evita degradado silencioso cuando el backend IA falla.
        return false;
    }

    $value = strtolower(trim($raw));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function figo_failfast_window_seconds(): int
{
    $raw = getenv('FIGO_UPSTREAM_FAILFAST_SECONDS');
    $value = is_string($raw) ? (int) trim($raw) : 0;
    if ($value <= 0) {
        $value = 15;
    }
    return max(1, min(300, $value));
}

function figo_upstream_state_path(): string
{
    $cacheDir = data_dir_path() . DIRECTORY_SEPARATOR . 'cache';
    if (!is_dir($cacheDir)) {
        @mkdir($cacheDir, 0775, true);
    }
    return $cacheDir . DIRECTORY_SEPARATOR . 'figo-upstream-state.json';
}

function figo_read_upstream_state(): array
{
    $path = figo_upstream_state_path();
    if (!is_file($path)) {
        return [];
    }
    $raw = @file_get_contents($path);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function figo_write_upstream_state(bool $up, string $reason = ''): void
{
    $payload = [
        'up' => $up,
        'reason' => trim($reason),
        'updatedAt' => gmdate('c'),
        'lastFailureAt' => $up ? 0 : time(),
    ];
    @file_put_contents(
        figo_upstream_state_path(),
        (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
}

function figo_check_failfast_window(): array
{
    $state = figo_read_upstream_state();
    if (!is_array($state) || ($state['up'] ?? true) !== false) {
        return ['active' => false, 'retryAfterSec' => 0, 'reason' => ''];
    }

    $lastFailureAt = isset($state['lastFailureAt']) ? (int) $state['lastFailureAt'] : 0;
    if ($lastFailureAt <= 0) {
        return ['active' => false, 'retryAfterSec' => 0, 'reason' => ''];
    }

    $window = figo_failfast_window_seconds();
    $elapsed = time() - $lastFailureAt;
    if ($elapsed >= $window) {
        return ['active' => false, 'retryAfterSec' => 0, 'reason' => ''];
    }

    return [
        'active' => true,
        'retryAfterSec' => max(1, $window - $elapsed),
        'reason' => trim((string) ($state['reason'] ?? 'upstream_recent_failure')),
    ];
}

function figo_metric_label(string $value, string $fallback): string
{
    $value = strtolower(trim($value));
    if ($value === '') {
        return $fallback;
    }

    $value = preg_replace('/[^a-z0-9_:\.-]+/i', '_', $value);
    if (!is_string($value) || trim($value) === '') {
        return $fallback;
    }

    $value = substr($value, 0, 64);
    return $value !== '' ? $value : $fallback;
}

function figo_record_post_metrics(float $startedAt, string $providerMode, array $payload, int $statusCode): void
{
    if (!class_exists('Metrics')) {
        return;
    }

    $durationSec = max(0.0005, microtime(true) - $startedAt);
    $mode = figo_metric_label((string) ($payload['mode'] ?? ''), $statusCode >= 400 ? 'degraded' : 'live');
    $source = figo_metric_label((string) ($payload['source'] ?? ''), 'none');
    $reason = figo_metric_label((string) ($payload['reason'] ?? ''), $statusCode >= 400 ? ('http_' . $statusCode) : 'none');
    $provider = figo_metric_label($providerMode, 'legacy_proxy');
    $statusClass = ((int) floor(max(100, $statusCode) / 100)) . 'xx';

    Metrics::observe(
        'figo_chat_post_duration_seconds',
        $durationSec,
        [
            'providerMode' => $provider,
            'mode' => $mode,
            'source' => $source,
        ],
        [0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 2.5, 5.0, 10.0]
    );

    Metrics::increment('figo_chat_post_total', [
        'providerMode' => $provider,
        'mode' => $mode,
        'source' => $source,
        'statusClass' => $statusClass,
        'reason' => $reason,
    ]);

    if ($statusCode >= 400) {
        Metrics::increment('figo_chat_post_errors_total', [
            'providerMode' => $provider,
            'reason' => $reason,
        ]);
    }
}

function figo_json_post_response(array $payload, int $statusCode, float $startedAt, string $providerMode): void
{
    figo_record_post_metrics($startedAt, $providerMode, $payload, $statusCode);
    json_response($payload, $statusCode);
}

figo_apply_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
$fileConfig = api_figo_read_config();
$providerMode = figo_queue_provider_mode();
$openclawOverview = [];
if ($providerMode === 'openclaw_queue') {
    $openclawOverview = figo_queue_status_overview();
}

$endpoint = api_first_non_empty([
    getenv('FIGO_CHAT_ENDPOINT'),
    getenv('FIGO_CHAT_URL'),
    getenv('FIGO_CHAT_API_URL'),
    getenv('FIGO_ENDPOINT'),
    getenv('FIGO_URL'),
    getenv('CLAWBOT_ENDPOINT'),
    getenv('CLAWBOT_URL'),
    getenv('CHATBOT_ENDPOINT'),
    getenv('CHATBOT_URL'),
    getenv('BOT_ENDPOINT'),
    getenv('PIELARMONIA_FIGO_ENDPOINT'),
    $fileConfig['endpoint'] ?? null,
    $fileConfig['apiUrl'] ?? null,
    $fileConfig['url'] ?? null
]);
$endpointDiagnostics = figo_endpoint_diagnostics($endpoint);
$recursiveConfigDetected = figo_is_recursive_endpoint($endpoint);

// OPTIMIZATION: Only probe upstream for diagnostics (GET), not for every message (POST).
// For POST, we assume it's reachable and let the actual request handle failures.
$upstreamReachable = null;
$requestMethod = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($requestMethod === 'GET') {
    if ($providerMode === 'openclaw_queue') {
        $upstreamReachable = isset($openclawOverview['openclawReachable'])
            ? $openclawOverview['openclawReachable']
            : null;
    } else {
        $upstreamReachable = figo_probe_upstream($endpoint, 3);
    }
}

$diagnosticMode = 'live';
if ($providerMode === 'openclaw_queue') {
    $gatewayConfigured = isset($openclawOverview['gatewayConfigured'])
        ? ((bool) $openclawOverview['gatewayConfigured'])
        : false;
    if (!$gatewayConfigured || $upstreamReachable === false) {
        $diagnosticMode = 'degraded';
    }
} elseif (!$endpointDiagnostics['configured'] || $recursiveConfigDetected || $upstreamReachable === false) {
    $diagnosticMode = 'degraded';
}

$configSource = isset($fileConfig['__source']) && is_string($fileConfig['__source'])
    ? basename((string) $fileConfig['__source'])
    : 'environment';

if ($method === 'GET') {
    audit_log_event('figo.status', [
        'configured' => $endpointDiagnostics['configured'],
        'degradedMode' => figo_degraded_mode_enabled(),
        'endpointHost' => $endpointDiagnostics['endpointHost'],
        'recursiveConfigDetected' => $recursiveConfigDetected,
        'upstreamReachable' => $upstreamReachable,
        'providerMode' => $providerMode
    ]);
    $statusPayload = [
        'ok' => true,
        'service' => 'figo-chat',
        'mode' => $diagnosticMode,
        'providerMode' => $providerMode,
        'configured' => $endpointDiagnostics['configured'],
        'degradedMode' => figo_degraded_mode_enabled(),
        'hasFileConfig' => isset($fileConfig['__source']),
        'configSource' => $configSource,
        'endpointHost' => $endpointDiagnostics['endpointHost'],
        'endpointScheme' => $endpointDiagnostics['endpointScheme'],
        'endpointPath' => $endpointDiagnostics['endpointPath'],
        'recursiveConfigDetected' => $recursiveConfigDetected,
        'upstreamReachable' => $upstreamReachable,
        'timestamp' => gmdate('c')
    ];

    if ($providerMode === 'openclaw_queue') {
        $statusPayload['provider'] = 'openclaw_queue';
        $statusPayload['queueDepth'] = isset($openclawOverview['queueDepth']) && is_array($openclawOverview['queueDepth'])
            ? $openclawOverview['queueDepth']
            : [];
        $statusPayload['workerLastRunAt'] = isset($openclawOverview['workerLastRunAt'])
            ? (string) $openclawOverview['workerLastRunAt']
            : '';
        $statusPayload['workerLastRunDurationMs'] = isset($openclawOverview['workerLastRunDurationMs'])
            ? (int) $openclawOverview['workerLastRunDurationMs']
            : 0;
        $statusPayload['openclawReachable'] = isset($openclawOverview['openclawReachable'])
            ? $openclawOverview['openclawReachable']
            : null;
        $statusPayload['gatewayConfigured'] = isset($openclawOverview['gatewayConfigured'])
            ? ((bool) $openclawOverview['gatewayConfigured'])
            : false;
        $statusPayload['gatewayAuthConfigured'] = isset($openclawOverview['gatewayAuthConfigured'])
            ? ((bool) $openclawOverview['gatewayAuthConfigured'])
            : false;
        $statusPayload['gatewayHost'] = isset($openclawOverview['gatewayHost'])
            ? (string) $openclawOverview['gatewayHost']
            : '';
        $statusPayload['gatewayPath'] = isset($openclawOverview['gatewayPath'])
            ? (string) $openclawOverview['gatewayPath']
            : '';
    }

    json_response($statusPayload);
}

if ($method !== 'POST') {
    json_response([
        'ok' => false,
        'mode' => $diagnosticMode,
        'source' => 'none',
        'reason' => 'method_not_allowed',
        'error' => 'Metodo no permitido'
    ], 405);
}

start_secure_session();
// Límite más alto para evitar falsos 429 en tests y ráfagas cortas de UI/polling.
require_rate_limit('figo-chat', 60, 60);
$postRequestStartedAt = microtime(true);

$payload = require_json_body();
$messages = isset($payload['messages']) && is_array($payload['messages'])
    ? $payload['messages']
    : [];

if ($messages === []) {
    audit_log_event('figo.invalid_request', [
        'reason' => 'messages_required'
    ]);
    figo_json_post_response([
        'ok' => false,
        'mode' => $diagnosticMode,
        'source' => 'none',
        'reason' => 'messages_required',
        'error' => 'messages es obligatorio'
    ], 400, $postRequestStartedAt, $providerMode);
}

$model = isset($payload['model']) && is_string($payload['model']) && trim($payload['model']) !== ''
    ? trim($payload['model'])
    : 'figo-assistant';

$lastUserMessage = figo_last_user_message($messages);
$fastLocalContent = figo_fast_local_content(figo_normalize_text($lastUserMessage));
if ($fastLocalContent !== '') {
    try {
        $id = 'figo-fast-' . bin2hex(random_bytes(8));
    } catch (Throwable $e) {
        $id = 'figo-fast-' . substr(md5((string) microtime(true)), 0, 16);
    }

    $fastPayload = figo_finalize_completion([
        'id' => $id,
        'object' => 'chat.completion',
        'created' => time(),
        'model' => $model,
        'choices' => [[
            'index' => 0,
            'message' => [
                'role' => 'assistant',
                'content' => $fastLocalContent
            ],
            'finish_reason' => 'stop'
        ]]
    ], 'live', 'local_fastpath', 'fast_local_scope_guard', true, false, 200);
    $fastPayload['fastPath'] = true;
    figo_json_post_response($fastPayload, 200, $postRequestStartedAt, $providerMode);
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

$upstreamPayload = [
    'model' => $model,
    'messages' => array_slice($messages, -20),
    'max_tokens' => $maxTokens,
    'temperature' => $temperature,
    'metadata' => [
        'site' => 'pielarmonia.com',
        'source' => 'web'
    ]
];

if ($providerMode === 'openclaw_queue') {
    $bridgeResult = figo_queue_bridge_result($upstreamPayload);
    $bridgeStatus = isset($bridgeResult['httpStatus']) ? (int) $bridgeResult['httpStatus'] : 500;
    $bridgePayload = isset($bridgeResult['payload']) && is_array($bridgeResult['payload'])
        ? $bridgeResult['payload']
        : [
            'ok' => false,
            'mode' => 'failed',
            'provider' => 'openclaw_queue',
            'reason' => 'bridge_internal_error',
            'error' => 'No se pudo procesar la consulta'
        ];

    // Compatibilidad: passthrough de campos para polling en frontend.
    if (($bridgePayload['mode'] ?? '') === 'queued') {
        $bridgePayload['providerMode'] = 'openclaw_queue';
        $bridgePayload['pollAfterMs'] = isset($bridgePayload['pollAfterMs']) && is_numeric($bridgePayload['pollAfterMs'])
            ? (int) $bridgePayload['pollAfterMs']
            : figo_queue_poll_after_ms();
        if (!isset($bridgePayload['jobId']) || !is_string($bridgePayload['jobId'])) {
            $bridgePayload['jobId'] = '';
        }
        if (!isset($bridgePayload['pollUrl']) || !is_string($bridgePayload['pollUrl']) || trim($bridgePayload['pollUrl']) === '') {
            $bridgePayload['pollUrl'] = '/check-ai-response.php?jobId=' . rawurlencode((string) $bridgePayload['jobId']);
        }
        figo_json_post_response($bridgePayload, 200, $postRequestStartedAt, $providerMode);
    }

    if (isset($bridgePayload['choices'][0]['message']['content']) && is_string($bridgePayload['choices'][0]['message']['content'])) {
        $bridgePayload['providerMode'] = 'openclaw_queue';
        $bridgePayload['mode'] = isset($bridgePayload['mode']) && is_string($bridgePayload['mode']) && trim($bridgePayload['mode']) !== ''
            ? (string) $bridgePayload['mode']
            : 'live';
        $bridgePayload['source'] = isset($bridgePayload['source']) && is_string($bridgePayload['source']) && trim($bridgePayload['source']) !== ''
            ? (string) $bridgePayload['source']
            : 'openclaw_gateway';
        figo_json_post_response($bridgePayload, 200, $postRequestStartedAt, $providerMode);
    }

    // Sin fallback silencioso cuando OpenClaw no responde.
    if (!isset($bridgePayload['reason']) && isset($bridgePayload['errorCode'])) {
        $bridgePayload['reason'] = (string) $bridgePayload['errorCode'];
    }
    if (!isset($bridgePayload['provider'])) {
        $bridgePayload['provider'] = 'openclaw_queue';
    }
    if (!isset($bridgePayload['mode'])) {
        $bridgePayload['mode'] = 'failed';
    }
    figo_json_post_response(
        $bridgePayload,
        $bridgeStatus >= 100 ? $bridgeStatus : 503,
        $postRequestStartedAt,
        $providerMode
    );
}

$encodedPayload = json_encode($upstreamPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($encodedPayload)) {
    figo_json_post_response([
        'ok' => false,
        'mode' => $diagnosticMode,
        'source' => 'none',
        'reason' => 'payload_encode_failed',
        'error' => 'No se pudo serializar el payload'
    ], 500, $postRequestStartedAt, $providerMode);
}

$headers = [
    'Content-Type: application/json',
    'Accept: application/json'
];

$internalToken = api_first_non_empty([
    getenv('FIGO_INTERNAL_TOKEN'),
    getenv('FIGO_CHAT_INTERNAL_TOKEN'),
    $fileConfig['internalToken'] ?? null
]);
$internalTokenHeader = api_first_non_empty([
    getenv('FIGO_INTERNAL_TOKEN_HEADER'),
    $fileConfig['internalTokenHeader'] ?? null
]);
if ($internalTokenHeader === '') {
    $internalTokenHeader = 'X-Figo-Internal-Token';
}
if ($internalToken !== '') {
    if (strcasecmp($internalTokenHeader, 'Authorization') === 0) {
        $hasAuthorization = false;
        foreach ($headers as $headerLine) {
            if (stripos((string) $headerLine, 'Authorization:') === 0) {
                $hasAuthorization = true;
                break;
            }
        }
        if (!$hasAuthorization) {
            $headers[] = 'Authorization: Bearer ' . $internalToken;
        }
    } else {
        $headers[] = $internalTokenHeader . ': ' . $internalToken;
    }
}

$authToken = api_first_non_empty([
    getenv('FIGO_CHAT_TOKEN'),
    getenv('FIGO_CHAT_BEARER_TOKEN'),
    getenv('FIGO_TOKEN'),
    getenv('FIGO_BEARER_TOKEN'),
    getenv('CLAWBOT_TOKEN'),
    getenv('CHATBOT_TOKEN'),
    $fileConfig['token'] ?? null
]);
if ($authToken !== '') {
    $headers[] = 'Authorization: Bearer ' . $authToken;
}

$apiKey = api_first_non_empty([
    getenv('FIGO_CHAT_APIKEY'),
    getenv('FIGO_CHAT_API_KEY'),
    getenv('FIGO_APIKEY'),
    getenv('FIGO_API_KEY'),
    getenv('CLAWBOT_APIKEY'),
    getenv('CLAWBOT_API_KEY'),
    getenv('CHATBOT_APIKEY'),
    getenv('CHATBOT_API_KEY'),
    $fileConfig['apiKey'] ?? null
]);
$apiKeyHeader = api_first_non_empty([
    getenv('FIGO_CHAT_APIKEY_HEADER'),
    getenv('FIGO_CHAT_API_KEY_HEADER'),
    getenv('FIGO_APIKEY_HEADER'),
    getenv('FIGO_API_KEY_HEADER'),
    getenv('CLAWBOT_APIKEY_HEADER'),
    getenv('CLAWBOT_API_KEY_HEADER'),
    getenv('CHATBOT_APIKEY_HEADER'),
    getenv('CHATBOT_API_KEY_HEADER'),
    $fileConfig['apiKeyHeader'] ?? null
]);
if ($apiKey !== '' && $apiKeyHeader !== '') {
    $headers[] = $apiKeyHeader . ': ' . $apiKey;
}

$timeout = (int) api_first_non_empty([
    getenv('FIGO_CHAT_TIMEOUT_SECONDS'),
    getenv('FIGO_TIMEOUT_SECONDS'),
    getenv('CLAWBOT_TIMEOUT_SECONDS'),
    isset($fileConfig['timeout']) ? (string) $fileConfig['timeout'] : ''
]);
if ($timeout <= 0) {
    $timeout = 12;
}
if ($timeout < 5) {
    $timeout = 5;
}
if ($timeout > 45) {
    $timeout = 45;
}

$connectTimeout = (int) api_first_non_empty([
    getenv('FIGO_CHAT_CONNECT_TIMEOUT_SECONDS'),
    getenv('FIGO_CONNECT_TIMEOUT_SECONDS'),
    isset($fileConfig['connectTimeout']) ? (string) $fileConfig['connectTimeout'] : ''
]);
if ($connectTimeout <= 0) {
    $connectTimeout = max(2, min(6, $timeout - 1));
}
if ($connectTimeout >= $timeout) {
    $connectTimeout = max(2, $timeout - 1);
}
if ($connectTimeout > 15) {
    $connectTimeout = 15;
}

if ($endpoint === '') {
    audit_log_event('figo.fallback', [
        'reason' => 'endpoint_missing'
    ]);
    $fallback = figo_finalize_completion(
        figo_build_fallback_completion($model, $messages),
        'degraded',
        'fallback',
        'endpoint_missing',
        false,
        false
    );
    $fallback['degraded'] = true;
    $fallback['hint'] = 'Configura FIGO_CHAT_ENDPOINT o figo-config.json';
    figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
}

if ($recursiveConfigDetected) {
    audit_log_event('figo.fallback', [
        'reason' => 'recursive_config',
        'endpointHost' => $endpointDiagnostics['endpointHost'],
        'endpointPath' => $endpointDiagnostics['endpointPath']
    ]);

    if (figo_degraded_mode_enabled()) {
        $fallback = figo_finalize_completion(
            figo_build_fallback_completion($model, $messages),
            'degraded',
            'fallback',
            'recursive_config',
            true,
            true
        );
        $fallback['degraded'] = true;
        $fallback['error'] = 'Configuracion circular detectada en FIGO_CHAT_ENDPOINT';
        figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
    }

    figo_json_post_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'recursive_config',
        'error' => 'Configuracion circular detectada en FIGO_CHAT_ENDPOINT'
    ], 503, $postRequestStartedAt, $providerMode);
}

$curlAvailable = function_exists('curl_init') && function_exists('curl_setopt_array') && function_exists('curl_exec');
if (!$curlAvailable) {
    if (figo_degraded_mode_enabled()) {
        $fallback = figo_finalize_completion(
            figo_build_fallback_completion($model, $messages),
            'degraded',
            'fallback',
            'curl_unavailable',
            true,
            false
        );
        $fallback['degraded'] = true;
        $fallback['error'] = 'cURL no disponible en el servidor';
        figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
    }

    figo_json_post_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'curl_unavailable',
        'error' => 'cURL no disponible en el servidor'
    ], 503, $postRequestStartedAt, $providerMode);
}

$failfast = figo_check_failfast_window();
if (($failfast['active'] ?? false) === true) {
    $retryAfter = (int) ($failfast['retryAfterSec'] ?? 1);
    $reason = (string) ($failfast['reason'] ?? 'upstream_recent_failure');
    audit_log_event('figo.upstream_failfast', [
        'reason' => $reason,
        'retryAfterSec' => $retryAfter,
    ]);
    header('Retry-After: ' . max(1, $retryAfter));

    if (figo_degraded_mode_enabled()) {
        $fallback = figo_finalize_completion(
            figo_build_fallback_completion($model, $messages),
            'degraded',
            'fallback',
            'upstream_failfast',
            true,
            false
        );
        $fallback['degraded'] = true;
        $fallback['retryAfterSec'] = max(1, $retryAfter);
        $fallback['error'] = 'Backend Figo temporalmente no disponible';
        figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
    }

    figo_json_post_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'upstream_temporarily_unavailable',
        'error' => 'Backend Figo temporalmente no disponible',
        'retryAfterSec' => max(1, $retryAfter)
    ], 503, $postRequestStartedAt, $providerMode);
}

$ch = curl_init($endpoint);
if ($ch === false) {
    figo_json_post_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'curl_init_failed',
        'error' => 'No se pudo inicializar la conexion de chat'
    ], 500, $postRequestStartedAt, $providerMode);
}

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $encodedPayload,
    CURLOPT_TIMEOUT => $timeout,
    CURLOPT_CONNECTTIMEOUT => $connectTimeout,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_MAXFILESIZE => 1048576 // 1 MB limite de respuesta
]);
if (defined('CURLOPT_TCP_KEEPALIVE')) {
    curl_setopt($ch, CURLOPT_TCP_KEEPALIVE, 1);
}
if (defined('CURLOPT_TCP_KEEPIDLE')) {
    curl_setopt($ch, CURLOPT_TCP_KEEPIDLE, 30);
}
if (defined('CURLOPT_TCP_KEEPINTVL')) {
    curl_setopt($ch, CURLOPT_TCP_KEEPINTVL, 15);
}
if (defined('CURLOPT_DNS_CACHE_TIMEOUT')) {
    curl_setopt($ch, CURLOPT_DNS_CACHE_TIMEOUT, 120);
}
if (defined('CURLOPT_HTTP_VERSION') && defined('CURL_HTTP_VERSION_2TLS')) {
    curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_2TLS);
}

$rawResponse = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if (!is_string($rawResponse)) {
    figo_write_upstream_state(false, 'curl_failed');
    error_log('Piel en Armonía figo-chat: fallo conexion cURL (codigo: ' . $curlErr . ')');
    audit_log_event('figo.upstream_error', [
        'reason' => 'curl_failed'
    ]);
    if (figo_degraded_mode_enabled()) {
        $fallback = figo_finalize_completion(
            figo_build_fallback_completion($model, $messages),
            'degraded',
            'fallback',
            'upstream_connection_failed',
            true,
            false
        );
        $fallback['degraded'] = true;
        $fallback['error'] = 'No se pudo conectar con el backend Figo';
        figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
    }

    figo_json_post_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'upstream_connection_failed',
        'error' => 'No se pudo conectar con el backend Figo'
    ], 503, $postRequestStartedAt, $providerMode);
}

if ($httpCode >= 400) {
    figo_write_upstream_state(false, 'http_' . $httpCode);
    error_log('Piel en Armonía figo-chat: upstream devolvio HTTP ' . $httpCode);
    audit_log_event('figo.upstream_error', [
        'reason' => 'http_error',
        'status' => $httpCode
    ]);
    if (figo_degraded_mode_enabled()) {
        $fallback = figo_finalize_completion(
            figo_build_fallback_completion($model, $messages),
            'degraded',
            'fallback',
            'upstream_http_error',
            true,
            false,
            $httpCode
        );
        $fallback['degraded'] = true;
        figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
    }

    figo_json_post_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'upstream_http_error',
        'error' => 'El bot Figo devolvio un error',
        'status' => $httpCode
    ], 503, $postRequestStartedAt, $providerMode);
}

$decoded = json_decode($rawResponse, true);
if (!is_array($decoded)) {
    $decoded = [];
}

$content = figo_extract_text($decoded, $rawResponse);
if (figo_is_upstream_technical_fallback($content)) {
    audit_log_event('figo.fallback', [
        'reason' => 'upstream_technical_fallback',
        'endpointHost' => $endpointDiagnostics['endpointHost']
    ]);

    $fallback = figo_finalize_completion(
        figo_build_fallback_completion($model, $messages),
        'degraded',
        'fallback',
        'upstream_technical_fallback',
        true,
        false,
        $httpCode
    );
    $fallback['degraded'] = true;
    figo_json_post_response($fallback, 200, $postRequestStartedAt, $providerMode);
}
if ($content === '') {
    $content = 'En este momento no pude generar una respuesta. ¿Deseas que te conecte por WhatsApp?';
}

figo_write_upstream_state(true, '');

try {
    $id = 'figo-' . bin2hex(random_bytes(8));
} catch (Throwable $e) {
    $id = 'figo-' . substr(md5((string) microtime(true)), 0, 16);
}

audit_log_event('figo.success', [
    'degraded' => false,
    'endpointHost' => $endpointDiagnostics['endpointHost']
]);

$successPayload = figo_finalize_completion([
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
], 'live', 'upstream', '', true, false, $httpCode);

figo_json_post_response($successPayload, 200, $postRequestStartedAt, $providerMode);
