<?php

declare(strict_types=1);

final class StoreCrypto
{
    public static function encryptPayload(string $plain): string
    {
        $key = self::encryptionKey();
        if ($key === '') {
            return $plain;
        }

        if (!function_exists('openssl_encrypt')) {
            return $plain;
        }

        try {
            $iv = random_bytes(12);
        } catch (Exception $e) {
            $iv = openssl_random_pseudo_bytes(12);
        }

        $tag = '';
        $cipher = openssl_encrypt($plain, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if ($cipher === false) {
            return '';
        }

        return 'ENCv1:' . base64_encode($iv . $tag . $cipher);
    }

    public static function encryptionKey(): string
    {
        static $resolved = null;
        if (is_string($resolved)) {
            return $resolved;
        }

        $candidates = [
            getenv('PIELARMONIA_DATA_ENCRYPTION_KEY'),
            getenv('PIELARMONIA_DATA_KEY'),
        ];

        $raw = '';
        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                $raw = trim($candidate);
                break;
            }
        }

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

    public static function decryptPayload(string $raw): string
    {
        if (substr($raw, 0, 6) !== 'ENCv1:') {
            return $raw;
        }

        $key = self::encryptionKey();
        if ($key === '') {
            return '';
        }

        if (!function_exists('openssl_decrypt')) {
            return '';
        }

        $packed = base64_decode(substr($raw, 6), true);
        if (!is_string($packed) || strlen($packed) <= 28) {
            return '';
        }

        $iv = substr($packed, 0, 12);
        $tag = substr($packed, 12, 16);
        $cipher = substr($packed, 28);
        $plain = openssl_decrypt($cipher, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
        if (!is_string($plain)) {
            return '';
        }

        return $plain;
    }
}
