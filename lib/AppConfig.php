<?php

declare(strict_types=1);

/**
 * Centralized Application Configuration
 * Extracts constants and configuration logic from business.php, email.php, and payment-lib.php.
 */
class AppConfig
{
    // --- Business Constants ---
    public const IVA_GENERAL_RATE = 0.15;
    public const WEEKEND_PRICE_MULTIPLIER = 1.10;
    public const DEFAULT_AVAILABILITY_DAYS = 21;
    public const MAX_AVAILABILITY_DAYS = 60;

    // --- Contact & Branding ---
    public const BRAND_NAME = 'Piel en Armonía';
    public const BASE_URL = 'https://pielarmonia.com';
    public const ADDRESS = 'Valparaiso 13-183 y Sodiro, Quito, Ecuador';
    public const WHATSAPP_NUMBER = '+593 98 245 3672';

    // --- Email Defaults ---
    public const ADMIN_EMAIL_FALLBACK = 'javier.rosero94@gmail.com';
    public const NO_REPLY_EMAIL_DEFAULT = 'no-reply@pielarmonia.com';

    // --- Payment Constants ---
    public const CURRENCY_DEFAULT = 'USD';
    public const TRANSFER_PROOF_MAX_BYTES = 5242880; // 5 MB

    // --- Configuration Methods ---

    public static function getVatRate(?string $tenantId = null): float
    {
        // Future: use $tenantId to load tenant-specific settings
        $raw = getenv('PIELARMONIA_VAT_RATE');
        if (!is_string($raw) || trim($raw) === '') {
            return self::IVA_GENERAL_RATE;
        }

        $rate = (float) trim($raw);
        if ($rate > 1.0 && $rate <= 100.0) {
            $rate = $rate / 100.0;
        }

        if ($rate < 0.0) {
            return 0.0;
        }
        if ($rate > 1.0) {
            return 1.0;
        }
        return $rate;
    }

    public static function getServices(?string $tenantId = null): array
    {
        $vat = self::getVatRate($tenantId);

        return [
            'consulta' => [
                'name' => 'Consulta Dermatológica',
                'price_base' => 40.00,
                'tax_rate' => 0.00, // IVA 0% - servicio de salud
                'category' => 'clinico',
                'is_from_price' => false
            ],
            'telefono' => [
                'name' => 'Consulta Telefónica',
                'price_base' => 25.00,
                'tax_rate' => 0.00, // IVA 0%
                'category' => 'telemedicina',
                'is_from_price' => false
            ],
            'video' => [
                'name' => 'Video Consulta',
                'price_base' => 30.00,
                'tax_rate' => 0.00, // IVA 0%
                'category' => 'telemedicina',
                'is_from_price' => false
            ],
            'laser' => [
                'name' => 'Láser Dermatológico',
                'price_base' => 150.00,
                'tax_rate' => $vat, // IVA variable - estético
                'category' => 'procedimiento',
                'is_from_price' => true
            ],
            'rejuvenecimiento' => [
                'name' => 'Rejuvenecimiento Facial',
                'price_base' => 120.00,
                'tax_rate' => $vat, // IVA variable - estético
                'category' => 'estetico',
                'is_from_price' => true
            ],
            'acne' => [
                'name' => 'Tratamiento de Acné',
                'price_base' => 80.00,
                'tax_rate' => 0.00, // IVA 0% - médico
                'category' => 'clinico',
                'is_from_price' => true
            ],
            'cancer' => [
                'name' => 'Detección de Cáncer de Piel',
                'price_base' => 70.00,
                'tax_rate' => 0.00, // IVA 0% - prevención
                'category' => 'clinico',
                'is_from_price' => true
            ]
        ];
    }

    public static function getAvailabilitySlots(): array
    {
        return [
            'weekdays' => [
                '09:00', '09:30', '10:00', '10:30',
                '11:00', '11:30', '12:00', '12:30',
                '14:00', '14:30', '15:00', '15:30',
                '16:00', '16:30', '17:00', '17:30'
            ],
            'saturday' => [
                '09:00', '09:30', '10:00', '10:30',
                '11:00', '11:30', '12:00', '12:30'
            ]
        ];
    }

    public static function getDefaultReviews(): array
    {
        return [
            [
                'id' => 'google-jose-gancino',
                'name' => 'Jose Gancino',
                'rating' => 5,
                'text' => 'Buena atencion, solo faltan los numeros de la oficina y horarios de atencion.',
                'date' => '2025-10-01T10:00:00-05:00',
                'verified' => true
            ],
            [
                'id' => 'google-jacqueline-ruiz-torres',
                'name' => 'Jacqueline Ruiz Torres',
                'rating' => 5,
                'text' => 'Excelente atencion y economico.',
                'date' => '2025-04-15T10:00:00-05:00',
                'verified' => true
            ],
            [
                'id' => 'google-cris-lema',
                'name' => 'Cris Lema',
                'rating' => 5,
                'text' => '',
                'date' => '2025-10-10T10:00:00-05:00',
                'verified' => true
            ],
            [
                'id' => 'google-camila-escobar',
                'name' => 'Camila Escobar',
                'rating' => 5,
                'text' => '',
                'date' => '2025-02-01T10:00:00-05:00',
                'verified' => true
            ]
        ];
    }

    public static function getSmtpConfig(): array
    {
        return [
            'host' => (string) (getenv('PIELARMONIA_SMTP_HOST') ?: 'smtp.gmail.com'),
            'port' => (int) (getenv('PIELARMONIA_SMTP_PORT') ?: 587),
            'user' => (string) (getenv('PIELARMONIA_SMTP_USER') ?: ''),
            'pass' => (string) (getenv('PIELARMONIA_SMTP_PASS') ?: ''),
            'from' => (string) (getenv('PIELARMONIA_EMAIL_FROM') ?: ''),
            'from_name' => self::BRAND_NAME,
        ];
    }

    public static function getAdminEmail(): string
    {
        $email = getenv('PIELARMONIA_ADMIN_EMAIL');
        if (!is_string($email) || trim($email) === '') {
            return self::ADMIN_EMAIL_FALLBACK;
        }
        return trim($email);
    }

    public static function getNoReplyEmail(): string
    {
        $from = getenv('PIELARMONIA_EMAIL_FROM');
        if (!is_string($from) || trim($from) === '') {
            return self::NO_REPLY_EMAIL_DEFAULT;
        }
        return trim($from);
    }

    public static function getPaymentCurrency(): string
    {
        $raw = getenv('PIELARMONIA_PAYMENT_CURRENCY');
        $currency = is_string($raw) && trim($raw) !== '' ? strtoupper(trim($raw)) : self::CURRENCY_DEFAULT;
        if (!preg_match('/^[A-Z]{3}$/', $currency)) {
            return self::CURRENCY_DEFAULT;
        }
        return $currency;
    }

    public static function getTransferProofUploadDir(): string
    {
        $raw = getenv('PIELARMONIA_TRANSFER_UPLOAD_DIR');
        if (is_string($raw) && trim($raw) !== '') {
            return rtrim(trim($raw), DIRECTORY_SEPARATOR);
        }
        return __DIR__ . '/../uploads/transfer-proofs';
    }

    public static function getTransferProofPublicBaseUrl(): string
    {
        $raw = getenv('PIELARMONIA_TRANSFER_PUBLIC_BASE_URL');
        if (is_string($raw) && trim($raw) !== '') {
            return rtrim(trim($raw), '/');
        }
        return '/uploads/transfer-proofs';
    }
}
