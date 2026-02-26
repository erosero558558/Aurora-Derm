<?php

declare(strict_types=1);

/**
 * TOTP implementation compatible with Google Authenticator.
 * Uses HMAC-SHA1 and Base32.
 */
class TOTP
{
    private const DIGITS = 6;
    private const PERIOD = 30;

    /**
     * Generate a new Base32 secret key.
     */
    public static function generateSecret(int $length = 16): string
    {
        $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $secret = '';
        try {
            for ($i = 0; $i < $length; $i++) {
                $secret .= $chars[random_int(0, 31)];
            }
        } catch (Throwable $e) {
            // Fallback for older PHP versions or random_int failure
            for ($i = 0; $i < $length; $i++) {
                $secret .= $chars[mt_rand(0, 31)];
            }
        }
        return $secret;
    }

    /**
     * Verify a code against a secret.
     * Allows for a time window drift.
     */
    public static function verify(string $secret, string $code, int $window = 1, ?int $timestamp = null): bool
    {
        $code = trim($code);
        if (strlen($code) !== self::DIGITS || !ctype_digit($code)) {
            return false;
        }

        $timestamp = $timestamp ?? time();
        for ($i = -$window; $i <= $window; $i++) {
            if (self::getCode($secret, $timestamp + ($i * self::PERIOD)) === $code) {
                return true;
            }
        }
        return false;
    }

    private static function getCode(string $secret, int $timestamp): string
    {
        $timeSlice = (int) floor($timestamp / self::PERIOD);
        $timePacked = pack('N*', 0) . pack('N*', $timeSlice);

        $key = self::base32Decode($secret);
        $hmac = hash_hmac('sha1', $timePacked, $key, true);
        $offset = ord($hmac[19]) & 0xf;
        $token = (
            ((ord($hmac[$offset + 0]) & 0x7f) << 24) |
            ((ord($hmac[$offset + 1]) & 0xff) << 16) |
            ((ord($hmac[$offset + 2]) & 0xff) << 8) |
            (ord($hmac[$offset + 3]) & 0xff)
        ) % 1000000; // pow(10, 6)

        return str_pad((string)$token, self::DIGITS, '0', STR_PAD_LEFT);
    }

    private static function base32Decode(string $base32): string
    {
        $base32 = strtoupper($base32);
        $l = strlen($base32);
        $n = 0;
        $j = 0;
        $binary = '';
        $map = array_flip(str_split('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'));

        for ($i = 0; $i < $l; $i++) {
            if (!isset($map[$base32[$i]])) {
                continue;
            } // Skip invalid chars
            $n = $n << 5;
            $n = $n + $map[$base32[$i]];
            $j = $j + 5;
            if ($j >= 8) {
                $j = $j - 8;
                $binary .= chr(($n & (0xFF << $j)) >> $j);
            }
        }
        return $binary;
    }
}
