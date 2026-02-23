<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
api_apply_cors(['GET', 'POST', 'OPTIONS'], ['Content-Type', 'Authorization'], true);

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

if ($method === 'GET') {
    $overview = figo_queue_status_overview();
    json_response([
        'ok' => true,
        'service' => 'figo-ai-bridge',
        'provider' => 'openclaw_queue',
        'providerMode' => figo_queue_provider_mode(),
        'queueDepth' => $overview['queueDepth'] ?? [],
        'workerLastRunAt' => $overview['workerLastRunAt'] ?? '',
        'openclawReachable' => $overview['openclawReachable'] ?? null,
        'gatewayConfigured' => $overview['gatewayConfigured'] ?? false,
        'timestamp' => gmdate('c')
    ]);
}

if ($method !== 'POST') {
    json_response([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

if (!figo_queue_enabled()) {
    json_response([
        'ok' => false,
        'mode' => 'failed',
        'provider' => 'openclaw_queue',
        'errorCode' => 'provider_mode_disabled',
        'error' => 'FIGO_PROVIDER_MODE no esta configurado en openclaw_queue'
    ], 503);
}

require_rate_limit('figo-ai-bridge', 20, 60);
start_secure_session();

$payload = require_json_body();
$result = figo_queue_bridge_result($payload);
$httpStatus = isset($result['httpStatus']) ? (int) $result['httpStatus'] : 500;
$responsePayload = isset($result['payload']) && is_array($result['payload'])
    ? $result['payload']
    : [
        'ok' => false,
        'mode' => 'failed',
        'provider' => 'openclaw_queue',
        'errorCode' => 'bridge_internal_error',
        'error' => 'No se pudo procesar la solicitud'
    ];

if (($responsePayload['mode'] ?? '') === 'queued' && isset($responsePayload['pollUrl'])) {
    $pollUrl = (string) $responsePayload['pollUrl'];
    if ($pollUrl !== '' && strpos($pollUrl, 'http') !== 0) {
        $responsePayload['pollUrl'] = $pollUrl;
    }
}

json_response($responsePayload, $httpStatus);

