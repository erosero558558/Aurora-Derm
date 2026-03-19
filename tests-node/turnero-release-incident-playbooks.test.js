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
                    'src/apps/queue-shared/turnero-release-incident-playbooks.js'
                )
            ).href
        );
    }

    return modulePromise;
}

test('turnero release incident playbooks normaliza steps y owner', async () => {
    const module = await loadModule();

    const playbooks = module.buildIncidentPlaybooks({
        incidents: [
            {
                id: 'inc-1',
                code: 'clinic_profile_drift',
                owner: 'deploy',
                severity: 'critical',
                status: 'blocked',
                now: ['Revisar perfil'],
                next: ['Stagear catálogo'],
            },
            {
                id: 'inc-2',
                code: 'public_shell_drift',
                owner: 'deploy',
                severity: 'warning',
                status: 'doing',
            },
        ],
        context: {
            clinicId: 'clinica-demo',
            clinicName: 'Clínica Demo',
            baseUrl: 'https://demo.example',
            releaseMode: 'suite_v2',
        },
    });

    assert.equal(playbooks.length, 2);
    assert.equal(playbooks[0].owner, 'deploy');
    assert.deepEqual(playbooks[0].steps.now, ['Revisar perfil']);
    assert.ok(playbooks[0].steps.verify.length > 0);
    assert.ok(
        playbooks[1].commands.commands.some((entry) =>
            entry.includes('https://demo.example')
        )
    );
});

test('turnero release incident playbooks agrupa por owner', async () => {
    const module = await loadModule();

    const board = module.buildOwnerPlaybookBoard({
        incidents: [
            {
                id: 'inc-1',
                code: 'clinic_profile_drift',
                owner: 'deploy',
                severity: 'critical',
                status: 'blocked',
            },
            {
                id: 'inc-2',
                code: 'public_shell_drift',
                owner: 'deploy',
                severity: 'warning',
                status: 'doing',
            },
            {
                id: 'inc-3',
                code: 'figo_health_issue',
                owner: 'backend',
                severity: 'warning',
                status: 'doing',
            },
        ],
        context: {
            clinicId: 'clinica-demo',
            clinicName: 'Clínica Demo',
            baseUrl: 'https://demo.example',
            releaseMode: 'suite_v2',
        },
    });

    const deployBucket = board.find((entry) => entry.owner === 'deploy');
    assert.equal(deployBucket.total, 2);
    assert.equal(deployBucket.blocked, 1);
    assert.equal(deployBucket.critical, 1);
    assert.equal(board.find((entry) => entry.owner === 'backend').total, 1);
});
