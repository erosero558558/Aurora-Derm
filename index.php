<?php

declare(strict_types=1);

require_once __DIR__ . '/api-lib.php';

if (!headers_sent()) {
    header('Content-Type: text/html; charset=UTF-8');
    apply_security_headers(true);
}

function public_env_bool(string $name, bool $default): bool
{
    $raw = getenv($name);
    if (!is_string($raw) || trim($raw) === '') {
        return $default;
    }

    $normalized = strtolower(trim($raw));
    return in_array($normalized, ['1', 'true', 'yes', 'on'], true);
}

/**
 * @param mixed $value
 */
function public_parse_bool($value, bool $default): bool
{
    if (is_bool($value)) {
        return $value;
    }

    if (!is_string($value) && !is_numeric($value)) {
        return $default;
    }

    $normalized = strtolower(trim((string) $value));
    if ($normalized === '') {
        return $default;
    }

    if (in_array($normalized, ['1', 'true', 'yes', 'on'], true)) {
        return true;
    }
    if (in_array($normalized, ['0', 'false', 'no', 'off'], true)) {
        return false;
    }
    return $default;
}

/**
 * @param mixed $value
 */
function public_parse_ratio($value, float $default): float
{
    if (!is_numeric($value)) {
        return $default;
    }

    $parsed = (float) $value;
    if (!is_finite($parsed)) {
        return $default;
    }
    if ($parsed < 0.0) {
        return 0.0;
    }
    if ($parsed > 1.0) {
        return 1.0;
    }

    return $parsed;
}

/**
 * @return array{
 *   public_v5_enabled:bool,
 *   public_v5_ratio:float,
 *   public_v5_force_locale:string,
 *   public_v5_kill_switch:bool
 * }
 */
function read_public_v5_catalog_defaults(): array
{
    $defaults = [
        'public_v5_enabled' => true,
        'public_v5_ratio' => 1.0,
        'public_v5_force_locale' => '',
        'public_v5_kill_switch' => false,
    ];

    $catalogPath = __DIR__ . DIRECTORY_SEPARATOR . 'content' . DIRECTORY_SEPARATOR . 'public-v5' . DIRECTORY_SEPARATOR . 'catalog.json';
    if (!is_file($catalogPath)) {
        return $defaults;
    }

    $raw = @file_get_contents($catalogPath);
    if (!is_string($raw) || trim($raw) === '') {
        return $defaults;
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return $defaults;
    }

    $featureFlags = isset($decoded['feature_flags_defaults']) && is_array($decoded['feature_flags_defaults'])
        ? $decoded['feature_flags_defaults']
        : [];

    $forceLocaleRaw = strtolower(trim((string) ($featureFlags['public_v5_force_locale'] ?? '')));
    $forceLocale = in_array($forceLocaleRaw, ['es', 'en'], true) ? $forceLocaleRaw : '';

    return [
        'public_v5_enabled' => public_parse_bool(
            $featureFlags['public_v5_enabled'] ?? $defaults['public_v5_enabled'],
            $defaults['public_v5_enabled']
        ),
        'public_v5_ratio' => public_parse_ratio(
            $featureFlags['public_v5_ratio'] ?? $defaults['public_v5_ratio'],
            $defaults['public_v5_ratio']
        ),
        'public_v5_force_locale' => $forceLocale,
        'public_v5_kill_switch' => public_parse_bool(
            $featureFlags['public_v5_kill_switch'] ?? $defaults['public_v5_kill_switch'],
            $defaults['public_v5_kill_switch']
        ),
    ];
}

function public_env_ratio(string $name, float $default): float
{
    $raw = getenv($name);
    if (!is_string($raw) || trim($raw) === '') {
        return $default;
    }

    $value = (float) trim($raw);
    if (!is_finite($value)) {
        return $default;
    }

    if ($value < 0.0) {
        return 0.0;
    }
    if ($value > 1.0) {
        return 1.0;
    }
    return $value;
}

function resolve_public_locale(string $forced): string
{
    if ($forced === 'en' || $forced === 'es') {
        return $forced;
    }

    $acceptLanguage = strtolower((string) ($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? ''));
    if (strpos($acceptLanguage, 'en') === 0) {
        return 'en';
    }

    return 'es';
}

function persist_surface_cookie(string $surface): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie('pa_public_surface', $surface, [
        'expires' => time() + (60 * 60 * 8),
        'path' => '/',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
}

function clear_surface_cookie(): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    setcookie('pa_public_surface', '', [
        'expires' => time() - (60 * 60),
        'path' => '/',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
}

function persist_rollout_cookie(string $surface, float $ratio): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $cohort = 'legacy';
    if ($surface === 'v5') {
        $cohort = $ratio < 1.0 ? 'v5_canary' : 'v5_general';
    } elseif ($ratio > 0.0) {
        $cohort = 'legacy_control';
    }

    setcookie('pa_public_rollout', $cohort, [
        'expires' => time() + (60 * 60 * 8),
        'path' => '/',
        'secure' => $secure,
        'httponly' => false,
        'samesite' => 'Lax',
    ]);
}

function emit_public_gateway_headers(
    string $surface,
    bool $enabled,
    float $ratio,
    bool $killSwitch,
    string $forcedLocale
): void {
    header('X-Public-Surface: ' . $surface);
    header('X-Public-V5-Enabled: ' . ($enabled ? 'true' : 'false'));
    header('X-Public-V5-Ratio: ' . sprintf('%.4F', $ratio));
    header('X-Public-V5-Kill-Switch: ' . ($killSwitch ? 'true' : 'false'));
    header('X-Public-V5-Force-Locale: ' . ($forcedLocale !== '' ? $forcedLocale : 'auto'));
}

$catalogDefaults = read_public_v5_catalog_defaults();
$enabled = public_env_bool('PIELARMONIA_PUBLIC_V5_ENABLED', $catalogDefaults['public_v5_enabled']);
$ratio = public_env_ratio('PIELARMONIA_PUBLIC_V5_RATIO', $catalogDefaults['public_v5_ratio']);
$killSwitch = public_env_bool('PIELARMONIA_PUBLIC_V5_KILL_SWITCH', $catalogDefaults['public_v5_kill_switch']);

$forcedLocaleEnvRaw = getenv('PIELARMONIA_PUBLIC_V5_FORCE_LOCALE');
$forcedLocaleRaw = '';
if (is_string($forcedLocaleEnvRaw) && trim($forcedLocaleEnvRaw) !== '') {
    $forcedLocaleRaw = strtolower(trim($forcedLocaleEnvRaw));
} else {
    $forcedLocaleRaw = strtolower(trim((string) ($catalogDefaults['public_v5_force_locale'] ?? '')));
}
$forcedLocale = in_array($forcedLocaleRaw, ['es', 'en'], true) ? $forcedLocaleRaw : '';

$surfaceOverride = strtolower(trim((string) ($_GET['surface'] ?? '')));
$legacyOverride = trim((string) ($_GET['legacy'] ?? ''));
$surfaceOverrideAuto = $surfaceOverride === 'auto';

if ($surfaceOverrideAuto) {
    clear_surface_cookie();
}

if ($legacyOverride === '1' || $surfaceOverride === 'legacy') {
    persist_surface_cookie('legacy');
    persist_rollout_cookie('legacy', $ratio);
    emit_public_gateway_headers('legacy', $enabled, $ratio, $killSwitch, $forcedLocale);
    header('Location: /legacy.php', true, 302);
    exit;
}

$surface = '';
if ($surfaceOverride === 'v5' || $surfaceOverride === 'v4') {
    $surface = 'v5';
    persist_surface_cookie('v5');
    persist_rollout_cookie('v5', $ratio);
} elseif ($surfaceOverrideAuto) {
    $surface = '';
} else {
    $surface = strtolower(trim((string) ($_COOKIE['pa_public_surface'] ?? '')));
    if ($surface === 'v4') {
        $surface = 'v5';
    }
}

if (!in_array($surface, ['v5', 'legacy'], true)) {
    if (!$enabled || $killSwitch || $ratio <= 0) {
        $surface = 'legacy';
    } elseif ($ratio >= 1) {
        $surface = 'v5';
    } else {
        $sample = random_int(1, 10000) / 10000;
        $surface = $sample <= $ratio ? 'v5' : 'legacy';
    }
    persist_surface_cookie($surface);
    persist_rollout_cookie($surface, $ratio);
}

if (!$enabled || $killSwitch) {
    $surface = 'legacy';
    persist_surface_cookie('legacy');
    persist_rollout_cookie('legacy', $ratio);
}

if ($surface === 'legacy') {
    emit_public_gateway_headers('legacy', $enabled, $ratio, $killSwitch, $forcedLocale);
    header('Location: /legacy.php', true, 302);
    exit;
}

$targetLocale = resolve_public_locale($forcedLocale);
$targetPath = $targetLocale === 'en' ? '/en/' : '/es/';

header('Cache-Control: no-store, private, max-age=0');
emit_public_gateway_headers('v5', $enabled, $ratio, $killSwitch, $forcedLocale);
header('X-Public-Target-Locale: ' . $targetLocale);
header('Location: ' . $targetPath, true, 302);
exit;
