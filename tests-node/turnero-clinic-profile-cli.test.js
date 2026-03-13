'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'bin', 'turnero-clinic-profile.js');

test('CLI lista perfiles catalogados en JSON', () => {
    const result = spawnSync('node', [cliPath, 'list', '--json'], {
        cwd: projectRoot,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.ok(Array.isArray(payload.items));
    assert.ok(
        payload.items.some((item) => item.id === 'piel-armonia-quito'),
        result.stdout
    );
});

test('CLI reporta status del perfil activo actual', () => {
    const result = spawnSync('node', [cliPath, 'status', '--json'], {
        cwd: projectRoot,
        encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.profile.clinic_id, 'piel-armonia-quito');
    assert.equal(payload.matchingProfileId, 'piel-armonia-quito');
});

test('CLI permite preview de stage sin escribir el perfil activo', () => {
    const result = spawnSync(
        'node',
        [cliPath, 'stage', '--id', 'clinica-norte-demo', '--dry-run', '--json'],
        {
            cwd: projectRoot,
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.id, 'clinica-norte-demo');
    assert.equal(payload.dryRun, true);
    assert.equal(payload.profile.clinic_id, 'clinica-norte-demo');
});
