<?php

declare(strict_types=1);

/**
 * Common configuration and helper functions.
 */

const APP_TIMEZONE = 'America/Guayaquil';

date_default_timezone_set(APP_TIMEZONE);

if (!function_exists('mb_strlen')) {
    function mb_strlen(string $value, ?string $encoding = null): int
    {
        $chars = @preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
        if (is_array($chars)) {
            return count($chars);
        }
        return strlen($value);
    }
}

if (!function_exists('mb_substr')) {
    function mb_substr(string $value, int $start, ?int $length = null, ?string $encoding = null): string
    {
        $chars = @preg_split('//u', $value, -1, PREG_SPLIT_NO_EMPTY);
        if (is_array($chars)) {
            $slice = $length === null
                ? array_slice($chars, $start)
                : array_slice($chars, $start, $length);
            return implode('', $slice);
        }

        $slice = $length === null ? substr($value, $start) : substr($value, $start, $length);
        return is_string($slice) ? $slice : '';
    }
}

function local_date(string $format): string
{
    return date($format);
}

function app_runtime_version(): string
{
    static $resolved = null;
    if (is_string($resolved) && $resolved !== '') {
        return $resolved;
    }

    $candidates = [
        app_env('AURORADERM_APP_VERSION'),
        getenv('APP_VERSION')
    ];

    foreach ($candidates as $candidate) {
        if (is_string($candidate) && trim($candidate) !== '') {
            $resolved = trim($candidate);
            return $resolved;
        }
    }

    $versionSources = [
        __DIR__ . '/../index.php',
        __DIR__ . '/../index.html',
        __DIR__ . '/../script.js',
        __DIR__ . '/../styles.css',
        __DIR__ . '/../api.php',
        __DIR__ . '/../figo-chat.php'
    ];

    $versionGlobs = [
        __DIR__ . '/../*.js',
        __DIR__ . '/../*.css',
        __DIR__ . '/../*.html',
        __DIR__ . '/../js/*.js',
        __DIR__ . '/../lib/*.php',
        __DIR__ . '/../controllers/*.php'
    ];

    $indexed = [];
    foreach ($versionSources as $source) {
        $indexed[$source] = true;
    }

    foreach ($versionGlobs as $pattern) {
        $matches = glob($pattern);
        if (!is_array($matches)) {
            continue;
        }
        foreach ($matches as $match) {
            if (is_string($match) && $match !== '') {
                $indexed[$match] = true;
            }
        }
    }

    $versionSources = array_keys($indexed);

    $latestMtime = 0;
    foreach ($versionSources as $source) {
        if (!is_file($source)) {
            continue;
        }
        $mtime = @filemtime($source);
        if (is_int($mtime) && $mtime > $latestMtime) {
            $latestMtime = $mtime;
        }
    }

    if ($latestMtime > 0) {
        $resolved = gmdate('YmdHis', $latestMtime);
    } else {
        $resolved = 'dev';
    }

    return $resolved;
}

function app_brand_name(): string
{
    return 'Aurora Derm';
}

function app_env_names(string $name): array
{
    $normalized = trim($name);
    if ($normalized === '') {
        return [];
    }

    if (strpos($normalized, 'AURORADERM_') === 0) {
        return [
            $normalized,
            'PIELARMONIA_' . substr($normalized, strlen('AURORADERM_')),
        ];
    }

    if (strpos($normalized, 'PIELARMONIA_') === 0) {
        $suffix = substr($normalized, strlen('PIELARMONIA_'));
        return [
            'AURORADERM_' . $suffix,
            $normalized,
        ];
    }

    return [$normalized];
}

function app_set_process_env(string $name, string $value): void
{
    putenv($name . '=' . $value);
    $_ENV[$name] = $value;
    $_SERVER[$name] = $value;
}

function app_env(string $name, $default = false)
{
    foreach (app_env_names($name) as $candidate) {
        $value = getenv($candidate);
        if ($value !== false) {
            return $value;
        }
    }

    return $default;
}

function app_ca_bundle_path(): string
{
    $raw = app_env('AURORADERM_CA_BUNDLE', '');
    if (!is_string($raw)) {
        return '';
    }

    $path = trim($raw);
    if ($path === '' || !is_file($path)) {
        return '';
    }

    return $path;
}

function app_curl_apply_tls_defaults($curlHandle): void
{
    if (!is_resource($curlHandle) && !is_object($curlHandle)) {
        return;
    }

    $caBundlePath = app_ca_bundle_path();
    if ($caBundlePath !== '') {
        @curl_setopt($curlHandle, CURLOPT_CAINFO, $caBundlePath);
    }
}

function app_stream_ssl_context_options(): array
{
    $options = [
        'verify_peer' => true,
        'verify_peer_name' => true,
    ];

    $caBundlePath = app_ca_bundle_path();
    if ($caBundlePath !== '') {
        $options['cafile'] = $caBundlePath;
    }

    return $options;
}

function app_bootstrap_env_aliases(): void
{
    static $bootstrapped = false;
    if ($bootstrapped) {
        return;
    }
    $bootstrapped = true;

    $sources = [];
    $envDump = getenv();
    if (is_array($envDump)) {
        $sources[] = $envDump;
    }
    if (is_array($_ENV)) {
        $sources[] = $_ENV;
    }
    if (is_array($_SERVER)) {
        $sources[] = $_SERVER;
    }

    $names = [];
    foreach ($sources as $source) {
        foreach ($source as $key => $value) {
            if (!is_string($key)) {
                continue;
            }
            if (
                strpos($key, 'AURORADERM_') === 0 ||
                strpos($key, 'PIELARMONIA_') === 0
            ) {
                $names[$key] = true;
            }
        }
    }

    foreach (array_keys($names) as $name) {
        $pair = app_env_names($name);
        if (count($pair) < 2) {
            continue;
        }

        [$canonicalName, $legacyName] = $pair;
        $canonicalValue = getenv($canonicalName);
        $legacyValue = getenv($legacyName);

        if ($canonicalValue !== false) {
            $normalized = is_string($canonicalValue) ? $canonicalValue : (string) $canonicalValue;
            app_set_process_env($canonicalName, $normalized);
            app_set_process_env($legacyName, $normalized);
            continue;
        }

        if ($legacyValue !== false) {
            $normalized = is_string($legacyValue) ? $legacyValue : (string) $legacyValue;
            app_set_process_env($canonicalName, $normalized);
            app_set_process_env($legacyName, $normalized);
        }
    }
}

function app_prometheus_aliases(string $metricName): array
{
    $normalized = trim($metricName);
    if ($normalized === '') {
        return [];
    }

    if (strpos($normalized, 'auroraderm_') === 0) {
        return [
            $normalized,
            'pielarmonia_' . substr($normalized, strlen('auroraderm_')),
        ];
    }

    if (strpos($normalized, 'pielarmonia_') === 0) {
        return [
            'auroraderm_' . substr($normalized, strlen('pielarmonia_')),
            $normalized,
        ];
    }

    return [$normalized];
}

function app_prometheus_render_metric(string $type, string $metricName, string $value): string
{
    $sampleName = trim($metricName);
    $typeName = $sampleName;
    $labelPos = strpos($sampleName, '{');
    if ($labelPos !== false) {
        $typeName = substr($sampleName, 0, $labelPos);
    }

    $lines = [];
    $typeAliases = app_prometheus_aliases($typeName);
    $sampleAliases = app_prometheus_aliases($sampleName);
    foreach ($typeAliases as $alias) {
        $lines[] = "# TYPE $alias $type";
    }
    foreach ($sampleAliases as $alias) {
        $lines[] = "$alias $value";
    }

    return "\n" . implode("\n", $lines);
}

function app_prometheus_alias_output(string $payload): string
{
    $trimmed = trim($payload);
    if ($trimmed === '') {
        return $payload;
    }

    $lines = preg_split("/\r\n|\n|\r/", $payload);
    if (!is_array($lines)) {
        return $payload;
    }

    $expanded = [];
    $seen = [];
    $append = static function (string $line) use (&$expanded, &$seen): void {
        if (isset($seen[$line])) {
            return;
        }

        $expanded[] = $line;
        $seen[$line] = true;
    };

    foreach ($lines as $line) {
        if ($line === '') {
            continue;
        }

        if (preg_match('/^# TYPE ([A-Za-z_:][A-Za-z0-9_:]*) (counter|gauge|histogram|summary|untyped)$/', $line, $matches) === 1) {
            foreach (app_prometheus_aliases($matches[1]) as $alias) {
                $append("# TYPE $alias {$matches[2]}");
            }
            continue;
        }

        if (preg_match('/^([A-Za-z_:][A-Za-z0-9_:]*)(\{[^}]*\})?\s+(.+)$/', $line, $matches) === 1) {
            $labels = isset($matches[2]) ? $matches[2] : '';
            $value = $matches[3];
            foreach (app_prometheus_aliases($matches[1]) as $alias) {
                $append($alias . $labels . ' ' . $value);
            }
            continue;
        }

        $append($line);
    }

    return "\n" . implode("\n", $expanded);
}

app_bootstrap_env_aliases();
