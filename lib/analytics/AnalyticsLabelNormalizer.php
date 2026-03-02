<?php

declare(strict_types=1);

final class AnalyticsLabelNormalizer
{
    public static function normalize($value, string $fallback = 'unknown', int $maxLength = 48): string
    {
        if (!is_string($value) && !is_numeric($value)) {
            return $fallback;
        }

        $normalized = strtolower(trim((string) $value));
        if ($normalized === '') {
            return $fallback;
        }

        $normalized = preg_replace('/[^a-z0-9_]+/', '_', $normalized);
        $normalized = trim((string) $normalized, '_');
        if ($normalized === '') {
            return $fallback;
        }

        if (strlen($normalized) > $maxLength) {
            $normalized = substr($normalized, 0, $maxLength);
        }

        return $normalized;
    }

    public static function resolvePatientKey(array $appointment): string
    {
        $email = strtolower(trim((string) ($appointment['email'] ?? '')));
        if ($email !== '' && strpos($email, '@') !== false) {
            return 'email:' . $email;
        }

        $phoneRaw = trim((string) ($appointment['phone'] ?? ''));
        if ($phoneRaw === '') {
            return '';
        }

        $digits = preg_replace('/\D+/', '', $phoneRaw);
        if (!is_string($digits) || $digits === '') {
            return '';
        }

        return 'phone:' . $digits;
    }
}
