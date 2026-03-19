'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

let modulePromise = null;

async function loadModule() {
    if (!modulePromise) {
        modulePromise = import(
            pathToFileURL(
                resolve(
                    REPO_ROOT,
                    'src/apps/queue-shared/turnero-release-command-library.js'
                )
            ).href
        );
    }

    return modulePromise;
}

test('turnero release command library resuelve la librería y reemplaza tokens', async () => {
    const module = await loadModule();

    const snapshot = module.buildCommandLibrarySnapshot({
        incident: {
            code: 'clinic_profile_drift',
            owner: 'deploy',
        },
        clinicId: 'clinica-demo',
        clinicName: 'Clínica Demo',
        baseUrl: 'https://demo.example',
        releaseMode: 'suite_v2',
    });

    assert.equal(snapshot.libraryKey, 'clinicProfile');
    assert.equal(snapshot.owner, 'deploy');
    assert.ok(
        snapshot.commands.some((entry) => entry.includes('clinica-demo'))
    );
    assert.ok(
        snapshot.commands.some((entry) =>
            entry.includes('https://demo.example')
        )
    );
    assert.equal(snapshot.replacements['$CLINIC_ID'], 'clinica-demo');
    assert.equal(snapshot.replacements['$BASE_URL'], 'https://demo.example');
});

test('turnero release command library arma packs por incidente', async () => {
    const module = await loadModule();

    const pack = module.buildCommandPack({
        incidents: [
            {
                id: 'inc-1',
                code: 'public_shell_drift',
                owner: 'deploy',
                severity: 'critical',
            },
            {
                id: 'inc-2',
                code: 'figo_health_issue',
                owner: 'backend',
                severity: 'warning',
            },
        ],
        clinicId: 'clinica-demo',
        clinicName: 'Clínica Demo',
        baseUrl: 'https://demo.example',
        releaseMode: 'suite_v2',
    });

    assert.equal(pack.length, 2);
    assert.equal(pack[0].incidentId, 'inc-1');
    assert.equal(pack[0].libraryKey, 'publicShell');
    assert.equal(pack[1].libraryKey, 'figo');
    assert.ok(pack[1].commands.every((entry) => typeof entry === 'string'));
});
