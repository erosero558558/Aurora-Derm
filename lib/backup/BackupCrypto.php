<?php

declare(strict_types=1);

final class BackupCrypto
{
    public static function receiverNormalizeSha256(string $value): string
    {
        $candidate = strtolower(trim($value));
        if ($candidate === '') {
            return '';
        }

        if (preg_match('/\b([a-f0-9]{64})\b/i', $candidate, $matches) !== 1) {
            return '';
        }

        return strtolower((string) ($matches[1] ?? ''));
    }

    public static function receiverChecksumMatches(string $provided, string $computed): bool
    {
        $providedNormalized = self::receiverNormalizeSha256($provided);
        $computedNormalized = self::receiverNormalizeSha256($computed);
        if ($providedNormalized === '' || $computedNormalized === '') {
            return false;
        }

        return hash_equals($computedNormalized, $providedNormalized);
    }

    public static function receiverEncryptionKey(): string
    {
        static $resolved = null;
        if (is_string($resolved)) {
            return $resolved;
        }

        $raw = BackupConfig::firstNonEmptyString([
            getenv('PIELARMONIA_BACKUP_RECEIVER_ENCRYPTION_KEY'),
            getenv('PIELARMONIA_DATA_ENCRYPTION_KEY'),
            getenv('PIELARMONIA_DATA_KEY'),
        ]);

        if ($raw === '') {
            $resolved = '';
            return $resolved;
        }

        if (strpos($raw, 'base64:') === 0) {
            $decoded = base64_decode(substr($raw, 7), true);
            if (is_string($decoded) && $decoded !== '') {
                $raw = $decoded;
            }
        }

        if (strlen($raw) !== 32) {
            $raw = hash('sha256', $raw, true);
        }

        $resolved = substr($raw, 0, 32);
        return $resolved;
    }

    public static function receiverEncryptPayload(string $plain): array
    {
        if ($plain === '') {
            return [
                'ok' => false,
                'reason' => 'empty_payload',
                'ciphertext' => '',
                'sha256' => '',
            ];
        }

        $key = self::receiverEncryptionKey();
        if ($key === '') {
            return [
                'ok' => false,
                'reason' => 'encryption_key_missing',
                'ciphertext' => '',
                'sha256' => '',
            ];
        }

        if (!function_exists('openssl_encrypt')) {
            return [
                'ok' => false,
                'reason' => 'openssl_not_available',
                'ciphertext' => '',
                'sha256' => '',
            ];
        }

        try {
            $iv = random_bytes(16);
        } catch (Throwable $e) {
            return [
                'ok' => false,
                'reason' => 'iv_generation_failed',
                'ciphertext' => '',
                'sha256' => '',
            ];
        }

        $cipher = openssl_encrypt($plain, BACKUP_RECEIVER_ENCRYPTION_ALGO, $key, OPENSSL_RAW_DATA, $iv);
        if (!is_string($cipher) || $cipher === '') {
            return [
                'ok' => false,
                'reason' => 'encrypt_failed',
                'ciphertext' => '',
                'sha256' => '',
            ];
        }

        $payload = BACKUP_RECEIVER_ENVELOPE_PREFIX . base64_encode($iv . hash_hmac('sha256', $iv . $cipher, $key, true) . $cipher);
        return [
            'ok' => true,
            'reason' => '',
            'ciphertext' => $payload,
            'sha256' => hash('sha256', $plain),
        ];
    }

    public static function receiverDecryptPayload(string $encoded): array
    {
        if (strpos($encoded, BACKUP_RECEIVER_ENVELOPE_PREFIX) !== 0) {
            return [
                'ok' => false,
                'reason' => 'invalid_envelope',
                'plain' => '',
                'sha256' => '',
            ];
        }

        $key = self::receiverEncryptionKey();
        if ($key === '') {
            return [
                'ok' => false,
                'reason' => 'encryption_key_missing',
                'plain' => '',
                'sha256' => '',
            ];
        }

        if (!function_exists('openssl_decrypt')) {
            return [
                'ok' => false,
                'reason' => 'openssl_not_available',
                'plain' => '',
                'sha256' => '',
            ];
        }

        $packed = base64_decode(substr($encoded, strlen(BACKUP_RECEIVER_ENVELOPE_PREFIX)), true);
        if (!is_string($packed) || strlen($packed) <= 48) {
            return [
                'ok' => false,
                'reason' => 'invalid_payload',
                'plain' => '',
                'sha256' => '',
            ];
        }

        $iv = substr($packed, 0, 16);
        $mac = substr($packed, 16, 32);
        $cipher = substr($packed, 48);
        $expectedMac = hash_hmac('sha256', $iv . $cipher, $key, true);
        if (!hash_equals($expectedMac, $mac)) {
            return [
                'ok' => false,
                'reason' => 'integrity_check_failed',
                'plain' => '',
                'sha256' => '',
            ];
        }

        $plain = openssl_decrypt($cipher, BACKUP_RECEIVER_ENCRYPTION_ALGO, $key, OPENSSL_RAW_DATA, $iv);
        if (!is_string($plain)) {
            return [
                'ok' => false,
                'reason' => 'decrypt_failed',
                'plain' => '',
                'sha256' => '',
            ];
        }

        return [
            'ok' => true,
            'reason' => '',
            'plain' => $plain,
            'sha256' => hash('sha256', $plain),
        ];
    }

    public static function receiverVerifyStoredFile(string $path): array
    {
        $result = [
            'ok' => false,
            'reason' => '',
            'path' => $path,
            'file' => basename($path),
            'sizeBytes' => 0,
            'sha256' => '',
            'metaSha256' => '',
            'metaMatch' => false,
        ];

        if (!is_file($path) || !is_readable($path)) {
            $result['reason'] = 'file_not_readable';
            return $result;
        }

        $size = @filesize($path);
        if (is_int($size) && $size >= 0) {
            $result['sizeBytes'] = $size;
        }

        $raw = @file_get_contents($path);
        if (!is_string($raw) || $raw === '') {
            $result['reason'] = 'file_empty';
            return $result;
        }

        $decoded = self::receiverDecryptPayload($raw);
        if (($decoded['ok'] ?? false) !== true) {
            $result['reason'] = (string) ($decoded['reason'] ?? 'decrypt_failed');
            return $result;
        }

        $plainSha = (string) ($decoded['sha256'] ?? '');
        $result['sha256'] = $plainSha;

        $metaPath = $path . '.meta.json';
        if (is_file($metaPath) && is_readable($metaPath)) {
            $metaRaw = @file_get_contents($metaPath);
            if (is_string($metaRaw) && $metaRaw !== '') {
                $meta = json_decode($metaRaw, true);
                if (is_array($meta)) {
                    $metaSha = self::receiverNormalizeSha256((string) ($meta['sha256'] ?? ''));
                    $result['metaSha256'] = $metaSha;
                    if ($metaSha !== '') {
                        $result['metaMatch'] = self::receiverChecksumMatches($metaSha, $plainSha);
                    }
                }
            }
        }

        if ($result['metaSha256'] !== '' && !$result['metaMatch']) {
            $result['reason'] = 'metadata_checksum_mismatch';
            return $result;
        }

        $result['ok'] = true;
        return $result;
    }
}
