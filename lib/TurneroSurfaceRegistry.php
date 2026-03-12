<?php

declare(strict_types=1);

function turnero_surface_registry_path(): string
{
    return dirname(__DIR__) . '/data/turnero-surfaces.json';
}

function read_turnero_surface_registry(): array
{
    static $cache = null;

    if ($cache !== null) {
        return $cache;
    }

    $raw = file_get_contents(turnero_surface_registry_path());
    if ($raw === false || trim($raw) === '') {
        throw new RuntimeException('No se pudo leer el registry de superficies turnero');
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Registry turnero invalido');
    }

    $defaults = isset($decoded['defaults']) && is_array($decoded['defaults'])
        ? $decoded['defaults']
        : [];
    $surfaces = isset($decoded['surfaces']) && is_array($decoded['surfaces'])
        ? $decoded['surfaces']
        : [];

    $cache = [
        'schema' => (string) ($decoded['schema'] ?? ''),
        'defaults' => [
            'channel' => (string) ($defaults['channel'] ?? 'stable'),
            'version' => (string) ($defaults['version'] ?? '0.1.0'),
            'baseUrl' => (string) ($defaults['baseUrl'] ?? 'https://pielarmonia.com'),
            'downloadBasePath' => (string) ($defaults['downloadBasePath'] ?? '/app-downloads/'),
            'updateBasePath' => (string) ($defaults['updateBasePath'] ?? '/desktop-updates/'),
        ],
        'surfaces' => array_map(
            static fn (array $surface): array => turnero_surface_registry_normalize_surface($surface),
            $surfaces
        ),
    ];

    return $cache;
}

function turnero_surface_registry_normalize_surface(array $surface): array
{
    $targets = isset($surface['targets']) && is_array($surface['targets'])
        ? $surface['targets']
        : [];
    $ops = isset($surface['ops']) && is_array($surface['ops'])
        ? $surface['ops']
        : [];
    $installHubOps = isset($ops['installHub']) && is_array($ops['installHub'])
        ? $ops['installHub']
        : [];
    $telemetryOps = isset($ops['telemetry']) && is_array($ops['telemetry'])
        ? $ops['telemetry']
        : [];

    return [
        'id' => strtolower(trim((string) ($surface['id'] ?? ''))),
        'family' => strtolower(trim((string) ($surface['family'] ?? ''))),
        'route' => (string) ($surface['route'] ?? ''),
        'productName' => (string) ($surface['productName'] ?? ''),
        'artifactBase' => (string) ($surface['artifactBase'] ?? ''),
        'executableName' => (string) ($surface['executableName'] ?? ''),
        'appId' => (string) ($surface['appId'] ?? ''),
        'webFallbackUrl' => (string) ($surface['webFallbackUrl'] ?? ''),
        'guideUrl' => (string) ($surface['guideUrl'] ?? ''),
        'updateChannel' => (string) ($surface['updateChannel'] ?? 'stable'),
        'catalog' => isset($surface['catalog']) && is_array($surface['catalog'])
            ? $surface['catalog']
            : [],
        'ops' => [
            'installHub' => [
                'eyebrow' => (string) ($installHubOps['eyebrow'] ?? ''),
                'title' => (string) ($installHubOps['title'] ?? ''),
                'description' => (string) ($installHubOps['description'] ?? ''),
                'recommendedFor' => (string) ($installHubOps['recommendedFor'] ?? ''),
                'notes' => isset($installHubOps['notes']) && is_array($installHubOps['notes'])
                    ? array_values(array_map(static fn ($note): string => (string) $note, $installHubOps['notes']))
                    : [],
            ],
            'telemetry' => [
                'title' => (string) ($telemetryOps['title'] ?? ''),
                'emptySummary' => (string) ($telemetryOps['emptySummary'] ?? ''),
            ],
        ],
        'launchDefaults' => isset($surface['launchDefaults']) && is_array($surface['launchDefaults'])
            ? $surface['launchDefaults']
            : [],
        'release' => isset($surface['release']) && is_array($surface['release'])
            ? $surface['release']
            : [],
        'desktop' => isset($surface['desktop']) && is_array($surface['desktop'])
            ? $surface['desktop']
            : [],
        'android' => isset($surface['android']) && is_array($surface['android'])
            ? $surface['android']
            : [],
        'targets' => array_map(
            static function ($target): array {
                return [
                    'label' => (string) ($target['label'] ?? ''),
                    'downloadPath' => (string) ($target['downloadPath'] ?? ''),
                    'manualFile' => (string) ($target['manualFile'] ?? ''),
                    'updatePath' => (string) ($target['updatePath'] ?? ''),
                    'updateFile' => (string) ($target['updateFile'] ?? ''),
                    'feedFile' => (string) ($target['feedFile'] ?? ''),
                ];
            },
            $targets
        ),
    ];
}

function turnero_surface_registry_defaults(): array
{
    return read_turnero_surface_registry()['defaults'];
}

function turnero_surface_registry_surfaces(): array
{
    return read_turnero_surface_registry()['surfaces'];
}

function turnero_surface_registry_map(): array
{
    $map = [];
    foreach (turnero_surface_registry_surfaces() as $surface) {
        $map[(string) ($surface['id'] ?? '')] = $surface;
    }
    return $map;
}

function turnero_surface_registry_surface(string $id): ?array
{
    $requestedId = strtolower(trim($id));
    if ($requestedId === '') {
        return null;
    }

    $map = turnero_surface_registry_map();
    return isset($map[$requestedId]) && is_array($map[$requestedId])
        ? $map[$requestedId]
        : null;
}

function turnero_surface_registry_target_keys(array $surface): array
{
    $targets = isset($surface['targets']) && is_array($surface['targets'])
        ? $surface['targets']
        : [];
    return array_keys($targets);
}

function turnero_surface_registry_default_target_key(array $surface, string $preferred = ''): string
{
    $targetKeys = turnero_surface_registry_target_keys($surface);
    $preferred = strtolower(trim($preferred));
    if ($preferred !== '' && in_array($preferred, $targetKeys, true)) {
        return $preferred;
    }
    if (($surface['family'] ?? '') === 'desktop' && in_array('win', $targetKeys, true)) {
        return 'win';
    }
    return $targetKeys[0] ?? '';
}

function turnero_surface_registry_trim_slashes(string $value): string
{
    return trim($value, '/');
}

function turnero_surface_registry_download_public_path(array $surface, string $targetKey, ?string $channel = null): string
{
    $targets = isset($surface['targets']) && is_array($surface['targets'])
        ? $surface['targets']
        : [];
    $target = isset($targets[$targetKey]) && is_array($targets[$targetKey])
        ? $targets[$targetKey]
        : null;
    if ($target === null) {
        return '';
    }

    $downloadPath = (string) ($target['downloadPath'] ?? '');
    $manualFile = (string) ($target['manualFile'] ?? '');
    if ($downloadPath === '' || $manualFile === '') {
        return '';
    }

    $defaults = turnero_surface_registry_defaults();
    $channel = trim((string) ($channel ?? ($surface['updateChannel'] ?? $defaults['channel'])));
    if ($channel === '') {
        $channel = (string) $defaults['channel'];
    }

    return '/' . turnero_surface_registry_trim_slashes((string) $defaults['downloadBasePath'])
        . '/' . $channel
        . '/' . turnero_surface_registry_trim_slashes($downloadPath)
        . '/' . $manualFile;
}

function turnero_surface_registry_catalog_defaults(?string $channel = null, ?string $version = null): array
{
    $defaults = turnero_surface_registry_defaults();
    $resolvedChannel = trim((string) ($channel ?? $defaults['channel']));
    if ($resolvedChannel === '') {
        $resolvedChannel = (string) $defaults['channel'];
    }
    $resolvedVersion = trim((string) ($version ?? $defaults['version']));
    if ($resolvedVersion === '') {
        $resolvedVersion = (string) $defaults['version'];
    }

    $catalog = [];
    foreach (turnero_surface_registry_surfaces() as $surface) {
        $surfaceId = (string) ($surface['id'] ?? '');
        if ($surfaceId === '') {
            continue;
        }

        $catalog[$surfaceId] = [
            'version' => $resolvedVersion,
            'updatedAt' => '',
            'webFallbackUrl' => (string) ($surface['webFallbackUrl'] ?? ''),
            'guideUrl' => (string) ($surface['guideUrl'] ?? ''),
            'targets' => [],
        ];

        foreach (turnero_surface_registry_target_keys($surface) as $targetKey) {
            $target = $surface['targets'][$targetKey];
            $catalog[$surfaceId]['targets'][$targetKey] = [
                'url' => turnero_surface_registry_download_public_path(
                    $surface,
                    $targetKey,
                    $resolvedChannel
                ),
                'label' => (string) ($target['label'] ?? ''),
            ];
        }
    }

    return $catalog;
}
