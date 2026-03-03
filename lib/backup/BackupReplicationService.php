<?php

declare(strict_types=1);

final class BackupReplicationService
{
    public static function createOffsiteSnapshot(): array
    {
        if (!ensure_data_file()) {
            return ['ok' => false, 'reason' => 'store_not_ready'];
        }
        if (!ensure_backup_dir()) {
            return ['ok' => false, 'reason' => 'backup_dir_not_ready'];
        }

        $offsiteDir = backup_dir_path() . DIRECTORY_SEPARATOR . 'offsite';
        if (!is_dir($offsiteDir) && !@mkdir($offsiteDir, 0775, true) && !is_dir($offsiteDir)) {
            return ['ok' => false, 'reason' => 'offsite_dir_not_ready'];
        }

        $data = read_store();
        $raw = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if (!is_string($raw) || trim($raw) === '') {
            return ['ok' => false, 'reason' => 'store_empty'];
        }

        $shape = BackupHealthService::validateStoreShape($data);
        if (($shape['ok'] ?? false) !== true) {
            return ['ok' => false, 'reason' => 'invalid_store_shape_export'];
        }

        try {
            $suffix = bin2hex(random_bytes(4));
        } catch (Throwable $e) {
            $suffix = substr(md5((string) microtime(true)), 0, 8);
        }

        $baseName = 'store-offsite-' . local_date('Ymd-His') . '-' . $suffix;
        $jsonPath = $offsiteDir . DIRECTORY_SEPARATOR . $baseName . '.json';
        if (@file_put_contents($jsonPath, $raw, LOCK_EX) === false) {
            return ['ok' => false, 'reason' => 'snapshot_write_failed'];
        }

        $sha256 = hash('sha256', $raw);
        @file_put_contents($jsonPath . '.sha256', $sha256 . '  ' . basename($jsonPath) . PHP_EOL, LOCK_EX);

        $gzipPath = '';
        if (function_exists('gzencode')) {
            $gzData = gzencode($raw, 6);
            if (is_string($gzData) && $gzData !== '') {
                $candidate = $jsonPath . '.gz';
                if (@file_put_contents($candidate, $gzData, LOCK_EX) !== false) {
                    $gzipPath = $candidate;
                }
            }
        }

        $uploadPath = $gzipPath !== '' ? $gzipPath : $jsonPath;
        $uploadBytes = @filesize($uploadPath);

        return [
            'ok' => true,
            'reason' => '',
            'createdAt' => local_date('c'),
            'path' => $jsonPath,
            'file' => basename($jsonPath),
            'sizeBytes' => is_int($uploadBytes) && $uploadBytes > 0 ? $uploadBytes : 0,
            'gzipPath' => $gzipPath,
            'gzipFile' => $gzipPath !== '' ? basename($gzipPath) : '',
            'uploadPath' => $uploadPath,
            'sha256' => $sha256,
            'counts' => $shape['counts'] ?? [],
        ];
    }

    public static function uploadFile(string $filePath, array $metadata = []): array
    {
        $targetUrl = BackupConfig::offsiteTargetUrl();
        if ($targetUrl === '') {
            return ['ok' => false, 'status' => 0, 'reason' => 'offsite_url_not_configured'];
        }
        if (!is_file($filePath) || !is_readable($filePath)) {
            return ['ok' => false, 'status' => 0, 'reason' => 'snapshot_not_readable'];
        }
        if (!function_exists('curl_init') || !class_exists('CURLFile')) {
            return ['ok' => false, 'status' => 0, 'reason' => 'curl_not_available'];
        }

        $headers = ['Accept: application/json'];
        $payloadSha256 = @hash_file('sha256', $filePath);
        if (is_string($payloadSha256) && BackupCrypto::receiverNormalizeSha256($payloadSha256) !== '') {
            $headers[] = 'X-Backup-SHA256: ' . strtolower($payloadSha256);
        } else {
            $payloadSha256 = '';
        }

        $token = BackupConfig::offsiteToken();
        $tokenHeader = BackupConfig::offsiteTokenHeader();
        if ($token !== '' && $tokenHeader !== '') {
            if (strcasecmp($tokenHeader, 'Authorization') === 0 && stripos($token, 'Bearer ') !== 0) {
                $token = 'Bearer ' . $token;
            }
            $headers[] = $tokenHeader . ': ' . $token;
        }

        $meta = $metadata;
        $meta['filename'] = basename($filePath);
        $meta['generatedAt'] = local_date('c');
        $meta['runtimeVersion'] = app_runtime_version();
        if (is_string($payloadSha256) && $payloadSha256 !== '') {
            $meta['sha256'] = strtolower($payloadSha256);
        }

        $postFields = [
            'backup' => new CURLFile($filePath, 'application/octet-stream', basename($filePath)),
            'metadata' => json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        ];

        $ch = curl_init($targetUrl);
        if ($ch === false) {
            return ['ok' => false, 'status' => 0, 'reason' => 'curl_init_failed'];
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => $postFields,
            CURLOPT_TIMEOUT => BackupConfig::offsiteTimeoutSeconds(),
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if (!is_string($raw)) {
            return [
                'ok' => false,
                'status' => $status,
                'reason' => 'curl_exec_failed',
                'curlError' => $curlError,
            ];
        }

        $ok = $status >= 200 && $status < 300;
        $decoded = json_decode($raw, true);
        return [
            'ok' => $ok,
            'status' => $status,
            'reason' => $ok ? '' : 'offsite_http_error',
            'response' => is_array($decoded) ? $decoded : trim(substr($raw, 0, 500)),
        ];
    }

    public static function replicateLocalFile(string $filePath, array $metadata = []): array
    {
        if (!BackupConfig::localReplicaEnabled()) {
            return ['ok' => false, 'status' => 0, 'reason' => 'local_replica_disabled'];
        }
        if (!is_file($filePath) || !is_readable($filePath)) {
            return ['ok' => false, 'status' => 0, 'reason' => 'snapshot_not_readable'];
        }

        $replicaDir = BackupConfig::localReplicaDir();
        if (!is_dir($replicaDir) && !@mkdir($replicaDir, 0775, true) && !is_dir($replicaDir)) {
            return ['ok' => false, 'status' => 0, 'reason' => 'local_replica_dir_not_ready'];
        }

        $destination = $replicaDir . DIRECTORY_SEPARATOR . basename($filePath);
        if (!@copy($filePath, $destination)) {
            return ['ok' => false, 'status' => 0, 'reason' => 'local_replica_copy_failed'];
        }

        $sourceShaPath = $filePath . '.sha256';
        if (is_file($sourceShaPath) && is_readable($sourceShaPath)) {
            @copy($sourceShaPath, $destination . '.sha256');
        }

        $meta = $metadata;
        $meta['replicatedAt'] = local_date('c');
        $meta['runtimeVersion'] = app_runtime_version();
        @file_put_contents(
            $destination . '.meta.json',
            json_encode($meta, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
            LOCK_EX
        );

        $bytes = @filesize($destination);
        return [
            'ok' => true,
            'status' => 200,
            'reason' => '',
            'mode' => 'local',
            'file' => basename($destination),
            'path' => $destination,
            'sizeBytes' => is_int($bytes) && $bytes > 0 ? $bytes : 0,
        ];
    }
}
