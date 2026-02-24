<?php

declare(strict_types=1);

/**
 * Secure offsite backup receiver.
 *
 * Expected request:
 * - POST multipart/form-data
 * - file field: "backup"
 * - optional field: "metadata" (JSON string)
 * - auth: Authorization: Bearer <token> OR X-Backup-Token header
 */

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
api_apply_cors(['POST', 'OPTIONS'], ['Content-Type', 'Authorization', 'X-Backup-Token'], false);

function backup_receiver_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function backup_receiver_extract_token(): string
{
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) $_SERVER['HTTP_AUTHORIZATION']) : '';
    if ($authHeader !== '') {
        if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches) === 1) {
            return trim((string) ($matches[1] ?? ''));
        }
        return $authHeader;
    }

    $backupHeader = isset($_SERVER['HTTP_X_BACKUP_TOKEN']) ? trim((string) $_SERVER['HTTP_X_BACKUP_TOKEN']) : '';
    if ($backupHeader !== '') {
        return $backupHeader;
    }

    return '';
}

function backup_receiver_max_upload_bytes(): int
{
    $raw = getenv('PIELARMONIA_BACKUP_RECEIVER_MAX_MB');
    $mb = is_string($raw) && trim($raw) !== '' ? (int) trim($raw) : 50;
    if ($mb < 1) {
        $mb = 1;
    }
    if ($mb > 512) {
        $mb = 512;
    }
    return $mb * 1024 * 1024;
}

function backup_receiver_safe_filename(string $name): string
{
    $base = basename($name);
    $safe = preg_replace('/[^a-zA-Z0-9._-]/', '_', $base);
    if (!is_string($safe) || $safe === '' || $safe === '.' || $safe === '..') {
        return 'backup.bin';
    }
    return $safe;
}

function backup_receiver_extract_checksum(): string
{
    $candidates = [
        isset($_SERVER['HTTP_X_BACKUP_SHA256']) ? (string) $_SERVER['HTTP_X_BACKUP_SHA256'] : '',
        isset($_SERVER['HTTP_X_FILE_SHA256']) ? (string) $_SERVER['HTTP_X_FILE_SHA256'] : '',
        isset($_SERVER['HTTP_CONTENT_SHA256']) ? (string) $_SERVER['HTTP_CONTENT_SHA256'] : ''
    ];

    foreach ($candidates as $candidate) {
        $normalized = backup_receiver_normalize_sha256($candidate);
        if ($normalized !== '') {
            return $normalized;
        }
    }

    return '';
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    backup_receiver_json(['ok' => true, 'service' => 'backup-receiver']);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

$expectedToken = backup_first_non_empty_string([
    getenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN'),
    getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN'),
    getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN')
]);
if ($expectedToken === '') {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Receiver token no configurado'
    ], 503);
}

$providedToken = backup_receiver_extract_token();
if ($providedToken === '' || !hash_equals($expectedToken, $providedToken)) {
    audit_log_event('backup.receiver.unauthorized', [
        'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
        'path' => (string) ($_SERVER['REQUEST_URI'] ?? '')
    ]);
    backup_receiver_json([
        'ok' => false,
        'error' => 'No autorizado'
    ], 401);
}

if (!isset($_FILES['backup']) || !is_array($_FILES['backup'])) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Archivo backup no enviado'
    ], 400);
}

$upload = $_FILES['backup'];
$uploadError = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
if ($uploadError !== UPLOAD_ERR_OK) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Error de subida',
        'code' => $uploadError
    ], 400);
}

$tmpPath = (string) ($upload['tmp_name'] ?? '');
if ($tmpPath === '' || !is_uploaded_file($tmpPath)) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Upload temporal invalido'
    ], 400);
}

$size = (int) ($upload['size'] ?? 0);
$maxBytes = backup_receiver_max_upload_bytes();
if ($size <= 0 || $size > $maxBytes) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Tamano de backup invalido',
        'maxBytes' => $maxBytes
    ], 400);
}

$originalName = backup_receiver_safe_filename((string) ($upload['name'] ?? 'backup.bin'));
$extension = strtolower((string) pathinfo($originalName, PATHINFO_EXTENSION));
$allowedExt = ['json', 'gz'];
if ($extension === '' || !in_array($extension, $allowedExt, true)) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Extension no permitida'
    ], 400);
}

$storageRoot = backup_receiver_storage_root();
$dateDir = gmdate('Y') . DIRECTORY_SEPARATOR . gmdate('m') . DIRECTORY_SEPARATOR . gmdate('d');
$targetDir = $storageRoot . DIRECTORY_SEPARATOR . $dateDir;
if (!is_dir($targetDir) && !@mkdir($targetDir, 0775, true) && !is_dir($targetDir)) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'No se pudo preparar almacenamiento'
    ], 500);
}

$computedSha = hash_file('sha256', $tmpPath);
if (!is_string($computedSha) || backup_receiver_normalize_sha256($computedSha) === '') {
    backup_receiver_json([
        'ok' => false,
        'error' => 'No se pudo calcular checksum del backup'
    ], 500);
}

$providedSha = backup_receiver_extract_checksum();
if (backup_receiver_checksum_required() && $providedSha === '') {
    backup_receiver_json([
        'ok' => false,
        'error' => 'Checksum SHA-256 requerido',
        'code' => 'checksum_required'
    ], 400);
}

if ($providedSha !== '' && !backup_receiver_checksum_matches($providedSha, $computedSha)) {
    audit_log_event('backup.receiver.checksum_mismatch', [
        'providedSha256' => $providedSha,
        'computedSha256' => strtolower($computedSha),
        'originalName' => $originalName
    ]);
    backup_receiver_json([
        'ok' => false,
        'error' => 'Checksum invalido',
        'code' => 'checksum_mismatch'
    ], 422);
}

$rawPayload = @file_get_contents($tmpPath);
if (!is_string($rawPayload) || $rawPayload === '') {
    backup_receiver_json([
        'ok' => false,
        'error' => 'No se pudo leer backup temporal'
    ], 500);
}

$encrypted = backup_receiver_encrypt_payload($rawPayload);
if (($encrypted['ok'] ?? false) !== true) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'No se pudo cifrar backup',
        'reason' => (string) ($encrypted['reason'] ?? 'encrypt_failed')
    ], 500);
}

try {
    $suffix = bin2hex(random_bytes(4));
} catch (Throwable $e) {
    $suffix = substr(md5((string) microtime(true)), 0, 8);
}

$storedName = 'backup-' . gmdate('Ymd-His') . '-' . $suffix . '-' . $originalName . '.enc';
$storedPath = $targetDir . DIRECTORY_SEPARATOR . $storedName;
if (@file_put_contents($storedPath, (string) ($encrypted['ciphertext'] ?? ''), LOCK_EX) === false) {
    backup_receiver_json([
        'ok' => false,
        'error' => 'No se pudo guardar backup cifrado'
    ], 500);
}

$metadataRaw = isset($_POST['metadata']) ? (string) $_POST['metadata'] : '';
$metadata = [];
if ($metadataRaw !== '') {
    $decoded = json_decode($metadataRaw, true);
    if (is_array($decoded)) {
        $metadata = $decoded;
    }
}

$metaPayload = [
    'receivedAt' => gmdate('c'),
    'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    'userAgent' => (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''),
    'originalName' => $originalName,
    'storedName' => $storedName,
    'storedEncoding' => 'BKPv1:aes-256-cbc+hmac-sha256',
    'sizeBytes' => (int) @filesize($storedPath),
    'sha256' => strtolower($computedSha),
    'providedChecksum' => $providedSha,
    'checksumVerified' => $providedSha === '' ? !backup_receiver_checksum_required() : true,
    'metadata' => $metadata
];
@file_put_contents(
    $storedPath . '.meta.json',
    json_encode($metaPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
    LOCK_EX
);

audit_log_event('backup.receiver.stored', [
    'storedName' => $storedName,
    'sizeBytes' => (int) ($metaPayload['sizeBytes'] ?? 0),
    'sha256' => (string) ($metaPayload['sha256'] ?? ''),
    'checksumVerified' => (bool) ($metaPayload['checksumVerified'] ?? false),
    'source' => isset($metadata['source']) ? (string) $metadata['source'] : ''
]);

$cleanup = backup_receiver_cleanup_retention($storageRoot);

backup_receiver_json([
    'ok' => true,
    'service' => 'backup-receiver',
    'storedName' => $storedName,
    'sizeBytes' => (int) ($metaPayload['sizeBytes'] ?? 0),
    'sha256' => (string) ($metaPayload['sha256'] ?? ''),
    'checksumVerified' => (bool) ($metaPayload['checksumVerified'] ?? false),
    'encrypted' => true,
    'cleanup' => $cleanup,
    'receivedAt' => (string) ($metaPayload['receivedAt'] ?? gmdate('c'))
], 201);
