<?php

declare(strict_types=1);

/**
 * Rate limiting logic.
 */

function rate_limit_client_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
        $_SERVER['HTTP_X_REAL_IP'] ?? null,
    ];

    $forwarded = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null;
    if (is_string($forwarded) && trim($forwarded) !== '') {
        $parts = explode(',', $forwarded);
        $first = trim((string) ($parts[0] ?? ''));
        $candidates[] = $first;
    }

    $candidates[] = $_SERVER['REMOTE_ADDR'] ?? null;

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || trim($candidate) === '') {
            continue;
        }

        $candidate = trim($candidate);
        if (filter_var($candidate, FILTER_VALIDATE_IP) !== false) {
            return $candidate;
        }
    }

    return 'unknown';
}

function rate_limit_key(string $action, ?string $ip = null): string
{
    $clientIp = is_string($ip) && trim($ip) !== '' ? trim($ip) : rate_limit_client_ip();
    return md5($clientIp . ':' . $action);
}

function rate_limit_file_path(string $action, ?string $ip = null): string
{
    $key = rate_limit_key($action, $ip);
    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';
    $shard = substr($key, 0, 2);
    $shardDir = $rateDir . DIRECTORY_SEPARATOR . $shard;

    if (!@is_dir($shardDir)) {
        @mkdir($shardDir, 0775, true);
    }

    return $shardDir . DIRECTORY_SEPARATOR . $key . '.json';
}

function rate_limit_read_entries(string $filePath): array
{
    if (!is_file($filePath)) {
        return [];
    }

    $raw = @file_get_contents($filePath);
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $entries = [];
    foreach ($decoded as $value) {
        $ts = (int) $value;
        if ($ts > 0) {
            $entries[] = $ts;
        }
    }

    return $entries;
}

function rate_limit_filter_window(array $entries, int $now, int $windowSeconds): array
{
    return array_values(array_filter($entries, static function (int $ts) use ($now, $windowSeconds): bool {
        return ($now - $ts) < $windowSeconds;
    }));
}

function rate_limit_write_entries(string $filePath, array $entries): void
{
    @file_put_contents($filePath, json_encode($entries), LOCK_EX);
}

function rate_limit_cleanup_random_shard(string $rateDir, int $now): void
{
    // Limpieza probabilistica: evita escanear todo el arbol en cada request.
    if (mt_rand(1, 50) !== 1) {
        return;
    }

    $randomShard = sprintf('%02x', mt_rand(0, 255));
    $targetDir = $rateDir . DIRECTORY_SEPARATOR . $randomShard;
    $allFiles = @glob($targetDir . DIRECTORY_SEPARATOR . '*.json');
    if (!is_array($allFiles)) {
        return;
    }

    foreach ($allFiles as $filePath) {
        if (($now - (int) @filemtime($filePath)) > 3600) {
            @unlink($filePath);
        }
    }
}

function is_rate_limited(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $maxRequests = max(1, $maxRequests);
    $windowSeconds = max(1, $windowSeconds);

    $now = time();
    $filePath = rate_limit_file_path($action);
    $entries = rate_limit_read_entries($filePath);
    $entries = rate_limit_filter_window($entries, $now, $windowSeconds);

    return count($entries) >= $maxRequests;
}

function check_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): bool
{
    $maxRequests = max(1, $maxRequests);
    $windowSeconds = max(1, $windowSeconds);

    $rateDir = data_dir_path() . DIRECTORY_SEPARATOR . 'ratelimit';
    $filePath = rate_limit_file_path($action);
    $now = time();

    $entries = rate_limit_read_entries($filePath);
    $entries = rate_limit_filter_window($entries, $now, $windowSeconds);

    if (count($entries) >= $maxRequests) {
        rate_limit_write_entries($filePath, $entries);
        return false;
    }

    $entries[] = $now;
    rate_limit_write_entries($filePath, $entries);

    rate_limit_cleanup_random_shard($rateDir, $now);

    return true;
}

function reset_rate_limit(string $action): void
{
    $filePath = rate_limit_file_path($action);
    if (is_file($filePath)) {
        @unlink($filePath);
    }
}

function require_rate_limit(string $action, int $maxRequests = 10, int $windowSeconds = 60): void
{
    if (!check_rate_limit($action, $maxRequests, $windowSeconds)) {
        $retryAfterSec = max(1, $windowSeconds);
        header('Retry-After: ' . (string) $retryAfterSec);
        json_response([
            'ok' => false,
            'mode' => 'rate_limited',
            'source' => 'ratelimit',
            'reason' => 'rate_limited',
            'code' => 'rate_limited',
            'retryAfterSec' => $retryAfterSec,
            'error' => 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.'
        ], 429);
    }
}
