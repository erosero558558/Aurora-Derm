<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
api_apply_cors(['GET', 'OPTIONS'], ['Content-Type', 'Authorization'], true);

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if ($method !== 'GET') {
    json_response([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

if (!figo_queue_enabled()) {
    json_response([
        'ok' => false,
        'status' => 'failed',
        'provider' => 'openclaw_queue',
        'errorCode' => 'provider_mode_disabled',
        'errorMessage' => 'FIGO_PROVIDER_MODE no esta configurado en openclaw_queue'
    ], 503);
}

$jobId = strtolower(trim((string) ($_GET['jobId'] ?? '')));
if (!figo_queue_job_id_is_valid($jobId)) {
    json_response([
        'ok' => false,
        'status' => 'failed',
        'provider' => 'openclaw_queue',
        'errorCode' => 'invalid_job_id',
        'errorMessage' => 'jobId invalido'
    ], 400);
}

require_rate_limit('figo-ai-check-' . substr($jobId, 0, 12), 120, 60);

$status = figo_queue_status_payload_for_job($jobId);
$response = [
    'ok' => (bool) ($status['ok'] ?? false),
    'jobId' => $jobId,
    'provider' => 'openclaw_queue',
    'status' => (string) ($status['status'] ?? 'queued')
];

if (($response['status'] ?? '') === 'completed') {
    $response['completedAt'] = (string) ($status['completedAt'] ?? gmdate('c'));
    $response['completion'] = isset($status['completion']) && is_array($status['completion'])
        ? $status['completion']
        : null;
    json_response($response, 200);
}

if (($response['status'] ?? '') === 'queued' || ($response['status'] ?? '') === 'processing') {
    $response['pollAfterMs'] = figo_queue_poll_after_ms();
    $response['nextAttemptAt'] = (string) ($status['nextAttemptAt'] ?? '');
    $response['updatedAt'] = (string) ($status['updatedAt'] ?? '');
    json_response($response, 200);
}

$response['errorCode'] = (string) ($status['errorCode'] ?? 'queue_failed');
$response['errorMessage'] = (string) ($status['errorMessage'] ?? figo_queue_build_unavailable_message());
if (($response['status'] ?? '') === 'expired') {
    $response['expiredAt'] = (string) ($status['expiredAt'] ?? gmdate('c'));
    json_response($response, 410);
}

$response['failedAt'] = (string) ($status['failedAt'] ?? gmdate('c'));
json_response($response, 503);

