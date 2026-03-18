<?php

declare(strict_types=1);

function flow_os_manifest_path(): string
{
    return __DIR__ . '/../data/flow-os/manifest.v1.json';
}

function load_flow_os_manifest(): array
{
    $path = flow_os_manifest_path();
    if (!is_file($path)) {
        throw new RuntimeException('Flow OS manifest no encontrado');
    }

    $raw = file_get_contents($path);
    if (!is_string($raw) || $raw === '') {
        throw new RuntimeException('Flow OS manifest vacio');
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new RuntimeException('Flow OS manifest invalido');
    }

    if (empty($decoded['journeyStages']) || !is_array($decoded['journeyStages'])) {
        throw new RuntimeException('Flow OS manifest sin journeyStages');
    }

    return $decoded;
}
