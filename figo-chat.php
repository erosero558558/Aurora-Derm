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

function figo_config_paths(): array
{
    $paths = [];

    $envPath = getenv('FIGO_CHAT_CONFIG_PATH');
    if (is_string($envPath) && trim($envPath) !== '') {
        $paths[] = trim($envPath);
    }

    $paths[] = data_dir_path() . DIRECTORY_SEPARATOR . 'figo-config.json';
    $paths[] = __DIR__ . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'figo-config.json';
    $paths[] = __DIR__ . DIRECTORY_SEPARATOR . 'figo-config.json';

    $normalized = [];
    foreach ($paths as $path) {
        $path = trim((string) $path);
        if ($path === '') {
            continue;
        }

        $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);
        if (!in_array($path, $normalized, true)) {
            $normalized[] = $path;
        }
    }

    return $normalized;
}

function figo_read_file_config(): array
{
    foreach (figo_config_paths() as $path) {
        if (!is_file($path)) {
            continue;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || trim($raw) === '') {
            continue;
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $decoded['__source'] = $path;
            return $decoded;
        }
    }

    return [];
}

function figo_first_non_empty(array $values): string
{
    foreach ($values as $value) {
        if (is_string($value) && trim($value) !== '') {
            return trim($value);
        }
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

figo_apply_cors();

$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit();
}

header('Content-Type: application/json; charset=utf-8');
$fileConfig = figo_read_file_config();
$providerMode = figo_queue_provider_mode();
$openclawOverview = [];
if ($providerMode === 'openclaw_queue') {
    $openclawOverview = figo_queue_status_overview();
}

$endpoint = figo_first_non_empty([
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
require_rate_limit('figo-chat', 15, 60);

$payload = require_json_body();
$messages = isset($payload['messages']) && is_array($payload['messages'])
    ? $payload['messages']
    : [];

if ($messages === []) {
    audit_log_event('figo.invalid_request', [
        'reason' => 'messages_required'
    ]);
    json_response([
        'ok' => false,
        'mode' => $diagnosticMode,
        'source' => 'none',
        'reason' => 'messages_required',
        'error' => 'messages es obligatorio'
    ], 400);
}

$model = isset($payload['model']) && is_string($payload['model']) && trim($payload['model']) !== ''
    ? trim($payload['model'])
    : 'figo-assistant';

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
        json_response($bridgePayload, 200);
    }

    if (isset($bridgePayload['choices'][0]['message']['content']) && is_string($bridgePayload['choices'][0]['message']['content'])) {
        $bridgePayload['providerMode'] = 'openclaw_queue';
        $bridgePayload['mode'] = isset($bridgePayload['mode']) && is_string($bridgePayload['mode']) && trim($bridgePayload['mode']) !== ''
            ? (string) $bridgePayload['mode']
            : 'live';
        $bridgePayload['source'] = isset($bridgePayload['source']) && is_string($bridgePayload['source']) && trim($bridgePayload['source']) !== ''
            ? (string) $bridgePayload['source']
            : 'openclaw_gateway';
        json_response($bridgePayload, 200);
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
    json_response($bridgePayload, $bridgeStatus >= 100 ? $bridgeStatus : 503);
}

$encodedPayload = json_encode($upstreamPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($encodedPayload)) {
    json_response([
        'ok' => false,
        'mode' => $diagnosticMode,
        'source' => 'none',
        'reason' => 'payload_encode_failed',
        'error' => 'No se pudo serializar el payload'
    ], 500);
}

$headers = [
    'Content-Type: application/json',
    'Accept: application/json'
];

$authToken = figo_first_non_empty([
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

$apiKey = figo_first_non_empty([
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
$apiKeyHeader = figo_first_non_empty([
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

$timeout = (int) figo_first_non_empty([
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
    json_response($fallback);
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
        json_response($fallback);
    }

    json_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'recursive_config',
        'error' => 'Configuracion circular detectada en FIGO_CHAT_ENDPOINT'
    ], 503);
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
        json_response($fallback);
    }

    json_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'curl_unavailable',
        'error' => 'cURL no disponible en el servidor'
    ], 503);
}

$ch = curl_init($endpoint);
if ($ch === false) {
    json_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'curl_init_failed',
        'error' => 'No se pudo inicializar la conexion de chat'
    ], 500);
}

curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => $headers,
    CURLOPT_POSTFIELDS => $encodedPayload,
    CURLOPT_TIMEOUT => $timeout,
    CURLOPT_CONNECTTIMEOUT => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
    CURLOPT_MAXFILESIZE => 1048576 // 1 MB limite de respuesta
]);

$rawResponse = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr = curl_error($ch);
curl_close($ch);

if (!is_string($rawResponse)) {
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
        json_response($fallback);
    }

    json_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'upstream_connection_failed',
        'error' => 'No se pudo conectar con el backend Figo'
    ], 503);
}

if ($httpCode >= 400) {
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
        json_response($fallback);
    }

    json_response([
        'ok' => false,
        'mode' => 'degraded',
        'source' => 'none',
        'reason' => 'upstream_http_error',
        'error' => 'El bot Figo devolvio un error',
        'status' => $httpCode
    ], 503);
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
    json_response($fallback);
}
if ($content === '') {
    $content = 'En este momento no pude generar una respuesta. ¿Deseas que te conecte por WhatsApp?';
}

try {
    $id = 'figo-' . bin2hex(random_bytes(8));
} catch (Throwable $e) {
    $id = 'figo-' . substr(md5((string) microtime(true)), 0, 16);
}

audit_log_event('figo.success', [
    'degraded' => false,
    'endpointHost' => $endpointDiagnostics['endpointHost']
]);

json_response(figo_finalize_completion([
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
], 'live', 'upstream', '', true, false, $httpCode));
