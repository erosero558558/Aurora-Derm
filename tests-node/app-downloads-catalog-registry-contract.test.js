#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

test('AppDownloadsCatalog deriva defaults desde el registry canonicamente', () => {
    const result = spawnSync(
        'php',
        [
            '-r',
            "require 'lib/AppDownloadsCatalog.php'; echo json_encode(build_app_downloads_runtime_payload());",
        ],
        {
            cwd: resolve(__dirname, '..'),
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    const catalog = payload.catalog;
    const surfaces = payload.surfaces;

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
        surfaces.operator.ops.installHub.recommendedFor,
        'PC operador'
    );
    assert.equal(surfaces.kiosk.catalog.eyebrow, 'Recepcion de pacientes');
    assert.equal(surfaces.sala_tv.ops.telemetry.title, 'Sala TV');
    assert.deepEqual(surfaces.sala_tv.targetOrder, ['android_tv']);
});
