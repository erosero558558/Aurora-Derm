#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const SMOKE_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'SMOKE-PRODUCCION.ps1'
);
const VERIFY_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'VERIFICAR-DESPLIEGUE.ps1'
);
const README_PATH = resolve(REPO_ROOT, 'scripts', 'ops', 'prod', 'README.md');

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('prod smoke expone telemetria rica de publicSync', () => {
    const raw = load(SMOKE_PATH);
    const requiredSnippets = [
        "$lastErrorMessage = ''",
        "$currentHead = ''",
        "$remoteHead = ''",
        '$dirtyPathsCount = 0',
        '$dirtyPathsSample = @()',
        '$telemetryGap = (',
        '[INFO] checks.publicSync state=$state lastErrorMessage=$lastErrorMessage currentHead=$currentHead remoteHead=$remoteHead headDrift=$headDrift dirtyPathsCount=$dirtyPathsCount',
        'dirtyPathsSample=$dirtyPathsSampleLabel',
        'checks.publicSync.healthy=false (state=$state, lastErrorMessage=$lastErrorMessage, dirtyPathsCount=$dirtyPathsCount)',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet publicSync en SMOKE-PRODUCCION.ps1: ${snippet}`
        );
    }
});

test('prod verify propaga telemetria de publicSync a resultados y consola', () => {
    const raw = load(VERIFY_PATH);
    const requiredSnippets = [
        "$publicSyncLastErrorMessage = ''",
        "$publicSyncCurrentHead = ''",
        "$publicSyncRemoteHead = ''",
        '$publicSyncDirtyPathsCount = 0',
        '$publicSyncDirtyPathsSample = @()',
        '$publicSyncTelemetryGap = (',
        '[INFO] public sync lastErrorMessage=$publicSyncLastErrorMessage currentHead=$publicSyncCurrentHead remoteHead=$publicSyncRemoteHead headDrift=$publicSyncHeadDrift dirtyPathsCount=$publicSyncDirtyPathsCount',
        'dirtyPathsSample=$publicSyncDirtyPathsSampleLabel',
        "Asset = 'health-public-sync-working-tree-dirty'",
        'RemoteHash = if ($publicSyncState) { "${publicSyncState}:$publicSyncLastErrorMessage" } else { \'false\' }',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet publicSync en VERIFICAR-DESPLIEGUE.ps1: ${snippet}`
        );
    }
});

test('prod ops readme documenta triage de publicSync', () => {
    const raw = load(README_PATH);
    const requiredSnippets = [
        'REPORTE-SEMANAL-PRODUCCION.ps1',
        'SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1',
        'checks.publicSync',
        'public_main_sync',
        'dirtyPathsCount',
        'dirtyPathsSample',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta snippet de documentacion publicSync en scripts/ops/prod/README.md: ${snippet}`
        );
    }
});
