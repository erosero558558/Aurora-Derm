#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildTurneroCatalogDefaults,
    buildTurneroReleaseArtifactName,
    getTurneroSurfaceDefinition,
    listTurneroSurfaceDefinitions,
    normalizeTurneroSurfaceId,
    resolveTurneroUpdatePublicFeedPath,
} = require('../lib/turnero-surface-registry.js');

test('turnero surface registry expone las superficies canonicas actuales', () => {
    const ids = listTurneroSurfaceDefinitions().map((surface) => surface.id);
    assert.deepEqual(ids, ['operator', 'kiosk', 'sala_tv']);
    assert.equal(
        normalizeTurneroSurfaceId('KIOSK', { family: 'desktop' }),
        'kiosk'
    );
    assert.equal(
        normalizeTurneroSurfaceId('desconocido', { family: 'desktop' }),
        'operator'
    );
});

test('turnero surface registry resuelve metadata y rutas publicas desde una sola fuente', () => {
    const operator = getTurneroSurfaceDefinition('operator');
    assert.equal(operator.productName, 'Turnero Operador');
    assert.equal(operator.ops.installHub.recommendedFor, 'PC operador');
    assert.equal(operator.ops.telemetry.title, 'Operador');
    assert.equal(
        resolveTurneroUpdatePublicFeedPath('operator', 'win'),
        '/desktop-updates/stable/operator/win/latest.yml'
    );
    assert.equal(
        buildTurneroReleaseArtifactName('sala_tv', 'android_tv'),
        'turnero-android-sala-tv-android-tv'
    );
});

test('turnero surface registry genera defaults del catalogo sin hardcodes paralelos', () => {
    const catalog = buildTurneroCatalogDefaults();
    assert.equal(
        catalog.operator.targets.win.url,
        '/app-downloads/stable/operator/win/TurneroOperadorSetup.exe'
    );
    assert.equal(
        catalog.kiosk.targets.mac.url,
        '/app-downloads/stable/kiosk/mac/TurneroKiosco.dmg'
    );
    assert.equal(
        catalog.sala_tv.targets.android_tv.url,
        '/app-downloads/stable/sala-tv/android/TurneroSalaTV.apk'
    );
    assert.equal(
        getTurneroSurfaceDefinition('sala_tv').ops.installHub.recommendedFor,
        'TCL C655 / Google TV'
    );
});
