<?php

declare(strict_types=1);

final class WhatsappOpenclawConfig
{
    public static function isEnabled(): bool
    {
        return self::parseBool((string) (getenv('PIELARMONIA_WHATSAPP_OPENCLAW_ENABLED') ?: 'false'));
    }

    public static function mode(): string
    {
        $mode = strtolower(trim((string) (getenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODE') ?: 'dry_run')));
        if (!in_array($mode, ['dry_run', 'live_allowlist', 'live'], true)) {
            $mode = 'dry_run';
        }
        return $mode;
    }

    public static function allowlistPhones(): array
    {
        $raw = (string) (getenv('PIELARMONIA_WHATSAPP_OPENCLAW_ALLOWLIST') ?: '');
        if ($raw === '') {
            return [];
        }

        $phones = [];
        foreach (explode(',', $raw) as $item) {
            $normalized = whatsapp_openclaw_normalize_phone((string) $item);
            if ($normalized !== '') {
                $phones[$normalized] = true;
            }
        }

        return array_keys($phones);
    }

    public static function resolveMutationMode(string $phone): string
    {
        if (!self::isEnabled()) {
            return 'disabled';
        }

        $mode = self::mode();
        if ($mode === 'live') {
            return 'live';
        }

        if ($mode === 'live_allowlist') {
            $normalized = whatsapp_openclaw_normalize_phone($phone);
            if ($normalized !== '' && in_array($normalized, self::allowlistPhones(), true)) {
                return 'live';
            }
        }

        return 'dry_run';
    }

    public static function shouldMutate(string $phone): bool
    {
        return self::resolveMutationMode($phone) === 'live';
    }

    public static function bridgeToken(): string
    {
        return trim((string) getenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN'));
    }

    public static function bridgeTokenHeader(): string
    {
        $header = trim((string) getenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_HEADER'));
        return $header !== '' ? $header : 'Authorization';
    }

    public static function bridgeTokenPrefix(): string
    {
        $prefix = trim((string) getenv('PIELARMONIA_WHATSAPP_BRIDGE_TOKEN_PREFIX'));
        return $prefix !== '' ? $prefix : 'Bearer';
    }

    public static function bridgeStaleAfterSeconds(): int
    {
        $value = (int) getenv('PIELARMONIA_WHATSAPP_BRIDGE_STALE_AFTER_SECONDS');
        return $value > 0 ? $value : 600;
    }

    public static function slotHoldTtlCardSeconds(): int
    {
        $value = (int) getenv('PIELARMONIA_WHATSAPP_SLOT_HOLD_TTL_CARD_SEC');
        return $value > 0 ? $value : 600;
    }

    public static function slotHoldTtlTransferSeconds(): int
    {
        $value = (int) getenv('PIELARMONIA_WHATSAPP_SLOT_HOLD_TTL_TRANSFER_SEC');
        return $value > 0 ? $value : 300;
    }

    public static function slotHoldTtlForPaymentMethod(string $paymentMethod): int
    {
        $paymentMethod = strtolower(trim($paymentMethod));
        if ($paymentMethod === 'card') {
            return self::slotHoldTtlCardSeconds();
        }
        return self::slotHoldTtlTransferSeconds();
    }

    public static function gatewayEndpoint(): string
    {
        $direct = trim((string) getenv('PIELARMONIA_WHATSAPP_OPENCLAW_GATEWAY_ENDPOINT'));
        if ($direct !== '') {
            return $direct;
        }
        return api_figo_env_gateway_endpoint();
    }

    public static function gatewayApiKey(): string
    {
        $direct = trim((string) getenv('PIELARMONIA_WHATSAPP_OPENCLAW_GATEWAY_API_KEY'));
        if ($direct !== '') {
            return $direct;
        }
        return api_figo_env_gateway_api_key();
    }

    public static function gatewayModel(): string
    {
        $direct = trim((string) getenv('PIELARMONIA_WHATSAPP_OPENCLAW_MODEL'));
        if ($direct !== '') {
            return $direct;
        }
        return api_figo_env_gateway_model();
    }

    public static function gatewayKeyHeader(): string
    {
        $direct = trim((string) getenv('PIELARMONIA_WHATSAPP_OPENCLAW_GATEWAY_KEY_HEADER'));
        if ($direct !== '') {
            return $direct;
        }
        return api_figo_env_gateway_key_header();
    }

    public static function gatewayKeyPrefix(): string
    {
        $direct = trim((string) getenv('PIELARMONIA_WHATSAPP_OPENCLAW_GATEWAY_KEY_PREFIX'));
        if ($direct !== '') {
            return $direct;
        }
        return api_figo_env_gateway_key_prefix();
    }

    public static function checkoutSuccessUrl(): string
    {
        $value = trim((string) getenv('PIELARMONIA_WHATSAPP_PAYMENT_SUCCESS_URL'));
        if ($value !== '') {
            return $value;
        }
        return rtrim(AppConfig::BASE_URL, '/') . '/gracias';
    }

    public static function checkoutCancelUrl(): string
    {
        $value = trim((string) getenv('PIELARMONIA_WHATSAPP_PAYMENT_CANCEL_URL'));
        if ($value !== '') {
            return $value;
        }
        return rtrim(AppConfig::BASE_URL, '/') . '/reservar';
    }

    public static function assertMachineToken(): void
    {
        $expected = self::bridgeToken();
        if ($expected === '') {
            json_response(['ok' => false, 'error' => 'WhatsApp bridge token no configurado'], 503);
        }

        $received = self::resolveHeaderValue(self::bridgeTokenHeader());
        if ($received === '' && strcasecmp(self::bridgeTokenHeader(), 'Authorization') !== 0) {
            $received = self::resolveHeaderValue('Authorization');
        }

        $normalized = trim($received);
        $prefix = self::bridgeTokenPrefix();
        if (
            $normalized !== ''
            && $prefix !== ''
            && preg_match('/^' . preg_quote($prefix, '/') . '\s+(.+)$/i', $normalized, $matches) === 1
        ) {
            $normalized = trim((string) ($matches[1] ?? ''));
        }

        if (!hash_equals($expected, $normalized)) {
            json_response(['ok' => false, 'error' => 'No autorizado'], 401);
        }
    }

    public static function resolveHeaderValue(string $headerName): string
    {
        $normalized = strtoupper(str_replace('-', '_', $headerName));
        if ($normalized === 'AUTHORIZATION') {
            return trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? ''));
        }

        return trim((string) ($_SERVER['HTTP_' . $normalized] ?? ''));
    }

    private static function parseBool(string $raw): bool
    {
        return in_array(strtolower(trim($raw)), ['1', 'true', 'yes', 'on'], true);
    }
}
