<?php

declare(strict_types=1);

require_once __DIR__ . '/AppConfig.php';

function turnero_clinic_profile_path(): string
{
    return dirname(__DIR__) . '/content/turnero/clinic-profile.json';
}

function turnero_clinic_profile_defaults(): array
{
    return [
        'schema' => 'turnero-clinic-profile/v1',
        'clinic_id' => 'default-clinic',
        'branding' => [
            'name' => AppConfig::BRAND_NAME,
            'short_name' => AppConfig::BRAND_NAME,
            'city' => 'Quito',
            'base_url' => AppConfig::BASE_URL,
        ],
        'consultorios' => [
            'c1' => [
                'label' => 'Consultorio 1',
                'short_label' => 'C1',
            ],
            'c2' => [
                'label' => 'Consultorio 2',
                'short_label' => 'C2',
            ],
        ],
        'surfaces' => [
            'admin' => [
                'enabled' => true,
                'label' => 'Admin web',
                'route' => '/admin.html#queue',
            ],
            'operator' => [
                'enabled' => true,
                'label' => 'Operador web',
                'route' => '/operador-turnos.html',
            ],
            'kiosk' => [
                'enabled' => true,
                'label' => 'Kiosco web',
                'route' => '/kiosco-turnos.html',
            ],
            'display' => [
                'enabled' => true,
                'label' => 'Sala web',
                'route' => '/sala-turnos.html',
            ],
        ],
        'release' => [
            'mode' => 'web_pilot',
            'admin_mode_default' => 'basic',
            'separate_deploy' => true,
            'native_apps_blocking' => false,
            'notes' => [
                'El piloto a produccion usa las superficies web como canon operativo.',
                'Instaladores desktop y Android TV quedan como siguiente release, no como bloqueo de salida.',
            ],
        ],
    ];
}

function turnero_clinic_profile_merge(array $defaults, array $overrides): array
{
    $merged = $defaults;

    foreach ($overrides as $key => $value) {
        if (
            isset($merged[$key]) &&
            is_array($merged[$key]) &&
            is_array($value) &&
            array_is_list($merged[$key]) === false &&
            array_is_list($value) === false
        ) {
            $merged[$key] = turnero_clinic_profile_merge($merged[$key], $value);
            continue;
        }

        $merged[$key] = $value;
    }

    return $merged;
}

function turnero_clinic_profile_normalize(array $profile): array
{
    $branding = isset($profile['branding']) && is_array($profile['branding'])
        ? $profile['branding']
        : [];
    $consultorios = isset($profile['consultorios']) && is_array($profile['consultorios'])
        ? $profile['consultorios']
        : [];
    $surfaces = isset($profile['surfaces']) && is_array($profile['surfaces'])
        ? $profile['surfaces']
        : [];
    $release = isset($profile['release']) && is_array($profile['release'])
        ? $profile['release']
        : [];

    return [
        'schema' => (string) ($profile['schema'] ?? 'turnero-clinic-profile/v1'),
        'clinic_id' => (string) ($profile['clinic_id'] ?? 'default-clinic'),
        'branding' => [
            'name' => (string) ($branding['name'] ?? AppConfig::BRAND_NAME),
            'short_name' => (string) ($branding['short_name'] ?? ($branding['name'] ?? AppConfig::BRAND_NAME)),
            'city' => (string) ($branding['city'] ?? 'Quito'),
            'base_url' => (string) ($branding['base_url'] ?? AppConfig::BASE_URL),
        ],
        'consultorios' => [
            'c1' => [
                'label' => (string) (($consultorios['c1']['label'] ?? null) ?: 'Consultorio 1'),
                'short_label' => (string) (($consultorios['c1']['short_label'] ?? null) ?: 'C1'),
            ],
            'c2' => [
                'label' => (string) (($consultorios['c2']['label'] ?? null) ?: 'Consultorio 2'),
                'short_label' => (string) (($consultorios['c2']['short_label'] ?? null) ?: 'C2'),
            ],
        ],
        'surfaces' => [
            'admin' => [
                'enabled' => (bool) ($surfaces['admin']['enabled'] ?? true),
                'label' => (string) (($surfaces['admin']['label'] ?? null) ?: 'Admin web'),
                'route' => (string) (($surfaces['admin']['route'] ?? null) ?: '/admin.html#queue'),
            ],
            'operator' => [
                'enabled' => (bool) ($surfaces['operator']['enabled'] ?? true),
                'label' => (string) (($surfaces['operator']['label'] ?? null) ?: 'Operador web'),
                'route' => (string) (($surfaces['operator']['route'] ?? null) ?: '/operador-turnos.html'),
            ],
            'kiosk' => [
                'enabled' => (bool) ($surfaces['kiosk']['enabled'] ?? true),
                'label' => (string) (($surfaces['kiosk']['label'] ?? null) ?: 'Kiosco web'),
                'route' => (string) (($surfaces['kiosk']['route'] ?? null) ?: '/kiosco-turnos.html'),
            ],
            'display' => [
                'enabled' => (bool) ($surfaces['display']['enabled'] ?? true),
                'label' => (string) (($surfaces['display']['label'] ?? null) ?: 'Sala web'),
                'route' => (string) (($surfaces['display']['route'] ?? null) ?: '/sala-turnos.html'),
            ],
        ],
        'release' => [
            'mode' => (string) (($release['mode'] ?? null) ?: 'web_pilot'),
            'admin_mode_default' => (string) (($release['admin_mode_default'] ?? null) ?: 'basic'),
            'separate_deploy' => (bool) ($release['separate_deploy'] ?? true),
            'native_apps_blocking' => (bool) ($release['native_apps_blocking'] ?? false),
            'notes' => isset($release['notes']) && is_array($release['notes'])
                ? array_values(array_map(static fn ($note): string => (string) $note, $release['notes']))
                : [],
        ],
    ];
}

function read_turnero_clinic_profile(): array
{
    static $cache = null;

    if ($cache !== null) {
        return $cache;
    }

    $defaults = turnero_clinic_profile_defaults();
    $path = turnero_clinic_profile_path();
    $overrides = [];

    if (is_file($path)) {
        $raw = file_get_contents($path);
        if ($raw !== false && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $overrides = $decoded;
            }
        }
    }

    $cache = turnero_clinic_profile_normalize(
        turnero_clinic_profile_merge($defaults, $overrides)
    );

    return $cache;
}
