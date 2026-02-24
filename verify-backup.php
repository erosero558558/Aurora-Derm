<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

apply_security_headers(false);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');
api_apply_cors(['GET', 'OPTIONS'], ['Authorization', 'X-Backup-Token', 'X-Cron-Token'], false);

function verify_backup_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

function verify_backup_extract_token(): string
{
    $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? trim((string) $_SERVER['HTTP_AUTHORIZATION']) : '';
    if ($authHeader !== '' && preg_match('/^Bearer\s+(.+)$/i', $authHeader, $matches) === 1) {
        return trim((string) ($matches[1] ?? ''));
    }
    if ($authHeader !== '') {
        return $authHeader;
    }

    $backupToken = isset($_SERVER['HTTP_X_BACKUP_TOKEN']) ? trim((string) $_SERVER['HTTP_X_BACKUP_TOKEN']) : '';
    if ($backupToken !== '') {
        return $backupToken;
    }

    $cronToken = isset($_SERVER['HTTP_X_CRON_TOKEN']) ? trim((string) $_SERVER['HTTP_X_CRON_TOKEN']) : '';
    if ($cronToken !== '') {
        return $cronToken;
    }

    return '';
}

function verify_backup_authorized(): bool
{
    $providedToken = verify_backup_extract_token();
    if ($providedToken === '') {
        return false;
    }

    $expectedTokens = [
        getenv('PIELARMONIA_BACKUP_RECEIVER_TOKEN'),
        getenv('PIELARMONIA_BACKUP_OFFSITE_TOKEN'),
        getenv('PIELARMONIA_BACKUP_WEBHOOK_TOKEN'),
        getenv('PIELARMONIA_CRON_SECRET')
    ];

    foreach ($expectedTokens as $expectedToken) {
        if (!is_string($expectedToken) || trim($expectedToken) === '') {
            continue;
        }
        if (hash_equals(trim($expectedToken), $providedToken)) {
            return true;
        }
    }

    return false;
}

function verify_backup_list_encrypted_files(string $storageRoot, int $limit = 100): array
{
    if (!is_dir($storageRoot)) {
        return [];
    }

    $files = [];
    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($storageRoot, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );
    } catch (Throwable $e) {
        return [];
    }

    foreach ($iterator as $entry) {
        if (!$entry instanceof SplFileInfo || !$entry->isFile()) {
            continue;
        }
        $path = $entry->getPathname();
        if (substr($path, -4) !== '.enc') {
            continue;
        }
        $files[] = [
            'path' => $path,
            'mtime' => (int) $entry->getMTime()
        ];
    }

    usort($files, static function (array $a, array $b): int {
        return ($b['mtime'] ?? 0) <=> ($a['mtime'] ?? 0);
    });

    if (count($files) > $limit) {
        $files = array_slice($files, 0, $limit);
    }

    return array_values(array_map(static function (array $item): string {
        return (string) ($item['path'] ?? '');
    }, $files));
}

function verify_backup_resolve_file(string $storageRoot, string $relativePath): string
{
    $normalized = str_replace(['\\', '/'], DIRECTORY_SEPARATOR, trim($relativePath));
    if ($normalized === '' || strpos($normalized, '..') !== false) {
        return '';
    }

    $candidate = $storageRoot . DIRECTORY_SEPARATOR . ltrim($normalized, DIRECTORY_SEPARATOR);
    $rootReal = realpath($storageRoot);
    $candidateReal = realpath($candidate);
    if ($rootReal === false || $candidateReal === false) {
        return '';
    }

    if (strpos($candidateReal, $rootReal) !== 0) {
        return '';
    }

    return $candidateReal;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    verify_backup_json(['ok' => true, 'service' => 'verify-backup']);
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    verify_backup_json([
        'ok' => false,
        'error' => 'Metodo no permitido'
    ], 405);
}

if (!verify_backup_authorized()) {
    verify_backup_json([
        'ok' => false,
        'error' => 'No autorizado'
    ], 401);
}

$storageRoot = backup_receiver_storage_root();
if (!is_dir($storageRoot)) {
    verify_backup_json([
        'ok' => false,
        'error' => 'No existe almacenamiento de backups',
        'code' => 'storage_not_found'
    ], 404);
}

$requestedFile = isset($_GET['file']) ? trim((string) $_GET['file']) : '';
$targetFile = '';
if ($requestedFile !== '') {
    $targetFile = verify_backup_resolve_file($storageRoot, $requestedFile);
    if ($targetFile === '') {
        verify_backup_json([
            'ok' => false,
            'error' => 'Archivo invalido',
            'code' => 'invalid_file'
        ], 400);
    }
} else {
    $files = verify_backup_list_encrypted_files($storageRoot, 1);
    $targetFile = count($files) > 0 ? (string) $files[0] : '';
}

if ($targetFile === '') {
    verify_backup_json([
        'ok' => false,
        'error' => 'No hay backups cifrados para verificar',
        'code' => 'no_backup_files'
    ], 404);
}

$verification = backup_receiver_verify_stored_file($targetFile);
$statusCode = ($verification['ok'] ?? false) ? 200 : 422;
$storageRootReal = realpath($storageRoot);
$relativeFile = $targetFile;
if (is_string($storageRootReal) && $storageRootReal !== '' && strpos($targetFile, $storageRootReal) === 0) {
    $relativeFile = ltrim(substr($targetFile, strlen($storageRootReal)), DIRECTORY_SEPARATOR);
}

verify_backup_json([
    'ok' => (bool) ($verification['ok'] ?? false),
    'service' => 'verify-backup',
    'file' => $relativeFile,
    'storageRoot' => $storageRoot,
    'verifiedAt' => gmdate('c'),
    'verification' => $verification
], $statusCode);
