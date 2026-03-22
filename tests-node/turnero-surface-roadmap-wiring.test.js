#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(relativePath) {
    return fs.readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

test('install hub wires roadmap console host, import, builder and render', () => {
    const source = readRepoFile(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
    );

    assert.match(source, /mountTurneroAdminQueueSurfaceRoadmapConsole/);
    assert.match(source, /buildTurneroSurfaceRoadmapSnapshot/);
    assert.match(source, /queueSurfaceRoadmapConsoleHost/);
    assert.match(source, /function buildSurfaceRoadmapConsolePacks\(/);
    assert.match(source, /function renderQueueSurfaceRoadmapConsole\(/);
    assert.match(
        source,
        /renderQueueSurfaceRoadmapConsole\(manifest, detectedPlatform\);/
    );

    const packageHostIndex = source.indexOf('queueSurfacePackageConsoleHost');
    const roadmapHostIndex = source.indexOf('queueSurfaceRoadmapConsoleHost');
    const optimizationHostIndex = source.indexOf(
        'queueSurfaceTelemetryOptimizationHubHost'
    );

    assert.notEqual(packageHostIndex, -1);
    assert.notEqual(roadmapHostIndex, -1);
    assert.notEqual(optimizationHostIndex, -1);
    assert.ok(roadmapHostIndex > packageHostIndex);
    assert.ok(optimizationHostIndex > roadmapHostIndex);
});

test('operator, kiosk and display expose roadmap pack, panel and render hooks', () => {
    const operatorSource = readRepoFile('src/apps/queue-operator/index.js');
    const kioskSource = readRepoFile('src/apps/queue-kiosk/index.js');
    const displaySource = readRepoFile('src/apps/queue-display/index.js');

    assert.match(operatorSource, /surfaceRoadmapPack: null/);
    assert.match(operatorSource, /function buildOperatorSurfaceRoadmapPack\(/);
    assert.match(operatorSource, /function ensureOperatorSurfaceRoadmapPanel\(/);
    assert.match(operatorSource, /function renderOperatorSurfaceRoadmapState\(/);
    assert.match(operatorSource, /mountTurneroSurfaceRoadmapBanner/);
    assert.match(operatorSource, /renderOperatorSurfaceRoadmapState\(state\);/);

    assert.match(kioskSource, /surfaceRoadmapPack: null/);
    assert.match(kioskSource, /function buildKioskSurfaceRoadmapPack\(/);
    assert.match(kioskSource, /function ensureKioskSurfaceRoadmapPanel\(/);
    assert.match(kioskSource, /function renderKioskSurfaceRoadmapState\(/);
    assert.match(kioskSource, /mountTurneroSurfaceRoadmapBanner/);
    assert.match(kioskSource, /renderKioskSurfaceRoadmapState\(inputState\);/);

    assert.match(displaySource, /surfaceRoadmapPack: null/);
    assert.match(displaySource, /function buildDisplaySurfaceRoadmapPack\(/);
    assert.match(displaySource, /function ensureDisplaySurfaceRoadmapPanel\(/);
    assert.match(displaySource, /function renderDisplaySurfaceRoadmapState\(/);
    assert.match(displaySource, /mountTurneroSurfaceRoadmapBanner/);
    assert.match(
        displaySource,
        /renderDisplaySurfaceRoadmapState\(resolvedInputState\);/
    );
});
