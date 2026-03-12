#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

const SCRIPT_PATH = resolve(
    __dirname,
    '..',
    'bin',
    'resolve-turnero-release-plan.js'
);

test('resolve-turnero-release-plan genera matrices desde el registry', () => {
    const result = spawnSync(process.execPath, [SCRIPT_PATH], {
        cwd: resolve(__dirname, '..'),
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    const desktop = payload.desktop_matrix?.include || [];
    const android = payload.android_matrix?.include || [];

    assert.equal(desktop.length, 4);
    assert.equal(
        desktop.some(
            (entry) =>
                entry.surface === 'operator' &&
                entry.platform === 'win' &&
                entry.artifact_name === 'turnero-desktop-operator-win'
        ),
        true
    );
    assert.equal(
        desktop.some(
            (entry) =>
                entry.surface === 'kiosk' &&
                entry.platform === 'mac' &&
                entry.artifact_name === 'turnero-desktop-kiosk-mac'
        ),
        true
    );
    assert.equal(android.length, 1);
    assert.equal(android[0].surface, 'sala_tv');
    assert.equal(
        android[0].artifact_name,
        'turnero-android-sala-tv-android-tv'
    );
    assert.equal(
        android[0].staged_artifact_path,
        'app/build/outputs/apk/release/TurneroSalaTV.apk'
    );
});
