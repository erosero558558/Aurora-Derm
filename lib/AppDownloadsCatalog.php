<?php

declare(strict_types=1);

require_once __DIR__ . '/TurneroSurfaceRegistry.php';

function app_downloads_catalog_defaults(): array
{
    return turnero_surface_registry_catalog_defaults();
}

function app_downloads_catalog_timestamp(): string
{
    return '';
}

function app_downloads_manifest_path(): string
{
    return dirname(__DIR__) . '/app-downloads/stable/release-manifest.json';
}

function app_downloads_manifest_payload(): array
{
    $manifestPath = app_downloads_manifest_path();
    if (!is_file($manifestPath)) {
        return [];
    }

    $raw = file_get_contents($manifestPath);
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }

    $apps = isset($decoded['apps']) && is_array($decoded['apps'])
        ? $decoded['apps']
        : [];

    return [
        'version' => isset($decoded['version']) ? (string) $decoded['version'] : '',
        'releasedAt' => isset($decoded['releasedAt']) ? (string) $decoded['releasedAt'] : '',
        'apps' => $apps,
    ];
}

function app_downloads_merge_surface(
    array $default,
    array $loaded,
    array $manifestSurface,
    string $updatedAt
): array {
    $targets = isset($loaded['targets']) && is_array($loaded['targets'])
        ? $loaded['targets']
        : [];
    $manifestTargets = isset($manifestSurface['targets']) && is_array($manifestSurface['targets'])
        ? $manifestSurface['targets']
        : [];

    $resolvedVersion = isset($manifestSurface['version']) && $manifestSurface['version'] !== ''
        ? (string) $manifestSurface['version']
        : (string) ($loaded['version'] ?? $default['version']);
    $resolvedUpdatedAt = isset($manifestSurface['updatedAt']) && $manifestSurface['updatedAt'] !== ''
        ? (string) $manifestSurface['updatedAt']
        : (string) ($loaded['updatedAt'] ?? $updatedAt);

    return [
        'version' => $resolvedVersion,
        'updatedAt' => $resolvedUpdatedAt,
        'webFallbackUrl' => (string) (
            $manifestSurface['webFallbackUrl']
                ?? $loaded['webFallbackUrl']
                ?? $default['webFallbackUrl']
        ),
        'guideUrl' => (string) (
            $manifestSurface['guideUrl']
                ?? $loaded['guideUrl']
                ?? $default['guideUrl']
        ),
        'targets' => array_replace_recursive($default['targets'], $targets, $manifestTargets),
    ];
}

function read_app_downloads_catalog(): array
{
    $defaults = app_downloads_catalog_defaults();
    $updatedAt = app_downloads_catalog_timestamp();
    $catalogPath = dirname(__DIR__) . '/content/app-downloads/catalog.php';
    $manifest = app_downloads_manifest_payload();
    $manifestApps = isset($manifest['apps']) && is_array($manifest['apps'])
        ? $manifest['apps']
        : [];

    $loaded = [];
    if (is_file($catalogPath)) {
        $payload = require $catalogPath;
        if (is_array($payload)) {
            $loaded = $payload;
        }
    }

    $resolved = [];
    foreach ($defaults as $surfaceId => $surfaceDefaults) {
        if (!is_array($surfaceDefaults)) {
            continue;
        }

        $resolved[$surfaceId] = app_downloads_merge_surface(
            $surfaceDefaults,
            isset($loaded[$surfaceId]) && is_array($loaded[$surfaceId]) ? $loaded[$surfaceId] : [],
            isset($manifestApps[$surfaceId]) && is_array($manifestApps[$surfaceId])
                ? $manifestApps[$surfaceId]
                : [],
            $updatedAt
        );
    }

    return $resolved;
}

function app_downloads_surface_ui_map(): array
{
    $surfaces = [];
    foreach (turnero_surface_registry_surfaces() as $surfaceDefinition) {
        $surfaceId = (string) ($surfaceDefinition['id'] ?? '');
        if ($surfaceId === '') {
            continue;
        }

        $catalog = isset($surfaceDefinition['catalog']) && is_array($surfaceDefinition['catalog'])
            ? $surfaceDefinition['catalog']
            : [];
        $ops = isset($surfaceDefinition['ops']) && is_array($surfaceDefinition['ops'])
            ? $surfaceDefinition['ops']
            : [];
        $installHubOps = isset($ops['installHub']) && is_array($ops['installHub'])
            ? $ops['installHub']
            : [];
        $telemetryOps = isset($ops['telemetry']) && is_array($ops['telemetry'])
            ? $ops['telemetry']
            : [];
        $productName = (string) (($surfaceDefinition['productName'] ?? '') ?: $surfaceId);

        $surfaces[$surfaceId] = [
            'id' => $surfaceId,
            'family' => (string) ($surfaceDefinition['family'] ?? ''),
            'webFallbackUrl' => (string) ($surfaceDefinition['webFallbackUrl'] ?? '/'),
            'guideUrl' => (string) ($surfaceDefinition['guideUrl'] ?? ('/app-downloads/?surface=' . $surfaceId)),
            'catalog' => [
                'title' => (string) (($catalog['title'] ?? '') ?: $productName),
                'eyebrow' => (string) ($catalog['eyebrow'] ?? ''),
                'description' => (string) ($catalog['description'] ?? ''),
                'qrTarget' => (string) ($catalog['qrTarget'] ?? 'prepared'),
                'notes' => isset($catalog['notes']) && is_array($catalog['notes'])
                    ? array_values(array_map(static fn ($note): string => (string) $note, $catalog['notes']))
                    : [],
            ],
            'ops' => [
                'installHub' => [
                    'eyebrow' => (string) (($installHubOps['eyebrow'] ?? '') ?: ($catalog['eyebrow'] ?? '')),
                    'title' => (string) (($installHubOps['title'] ?? '') ?: (($catalog['title'] ?? '') ?: $productName)),
                    'description' => (string) (($installHubOps['description'] ?? '') ?: ($catalog['description'] ?? '')),
                    'recommendedFor' => (string) ($installHubOps['recommendedFor'] ?? ''),
                    'notes' => isset($installHubOps['notes']) && is_array($installHubOps['notes'])
                        ? array_values(array_map(static fn ($note): string => (string) $note, $installHubOps['notes']))
                        : [],
                ],
                'telemetry' => [
                    'title' => (string) (($telemetryOps['title'] ?? '') ?: (($installHubOps['title'] ?? '') ?: (($catalog['title'] ?? '') ?: $productName))),
                    'emptySummary' => (string) ($telemetryOps['emptySummary'] ?? ''),
                ],
            ],
            'targetOrder' => turnero_surface_registry_target_keys($surfaceDefinition),
            'launchDefaults' => isset($surfaceDefinition['launchDefaults']) && is_array($surfaceDefinition['launchDefaults'])
                ? $surfaceDefinition['launchDefaults']
                : [],
        ];
    }

    return $surfaces;
}

function build_app_downloads_runtime_payload(array $state = []): array
{
    return [
        'catalog' => read_app_downloads_catalog(),
        'surfaces' => app_downloads_surface_ui_map(),
        'state' => $state,
    ];
}
