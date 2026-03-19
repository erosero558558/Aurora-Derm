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
                    'src/apps/queue-shared/turnero-release-owner-workbench.js'
                )
            ).href
        );
    }

    return modulePromise;
}

const INCIDENTS = [
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
];

test('turnero release owner workbench compone board, summaries y clipboard bundle', async () => {
    const module = await loadModule();
    const context = {
        clinicId: 'clinica-demo',
        clinicName: 'Clínica Demo',
        baseUrl: 'https://demo.example',
        releaseMode: 'suite_v2',
    };
    const executorState = {
        incidents: {
            'inc-1': {
                steps: {
                    'now:0': {
                        state: 'doing',
                        updatedAt: '2026-03-18T12:00:00.000Z',
                    },
                },
                notes: [
                    {
                        author: 'admin',
                        note: 'Coordinar con deploy',
                        createdAt: '2026-03-18T12:05:00.000Z',
                    },
                ],
                updatedAt: '2026-03-18T12:05:00.000Z',
            },
        },
    };

    const snapshot = module.buildOwnerWorkbenchSnapshot({
        incidents: INCIDENTS,
        context,
        executorState,
    });

    const clipboard = module.buildWorkbenchClipboardBundle({
        snapshot,
        executorState,
    });

    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.owners.length, 2);
    assert.equal(
        snapshot.owners.find((entry) => entry.owner === 'deploy').total,
        2
    );
    assert.equal(snapshot.executionSummary.length, 3);
    assert.equal(snapshot.commandPack.length, 3);
    assert.equal(clipboard.ownerTexts.length, 2);
    assert.equal(clipboard.incidentTexts.length, 3);
    assert.match(clipboard.commandPackText, /INCIDENTE: inc-1/);
    assert.match(clipboard.incidentTexts[0].text, /Coordinar con deploy/);
});

test('turnero release owner workbench genera textos de runbook y handoff', async () => {
    const module = await loadModule();
    const context = {
        clinicId: 'clinica-demo',
        clinicName: 'Clínica Demo',
        baseUrl: 'https://demo.example',
        releaseMode: 'suite_v2',
    };

    const snapshot = module.buildOwnerWorkbenchSnapshot({
        incidents: INCIDENTS,
        context,
        executorState: { incidents: {} },
    });

    const deployBucket = snapshot.owners.find(
        (entry) => entry.owner === 'deploy'
    );
    const runbook = module.buildOwnerRunbookText(deployBucket);
    const handoff = module.buildIncidentHandoffText({
        playbook: deployBucket.items[0],
        incidentState: {
            steps: {
                'now:0': {
                    state: 'blocked',
                    updatedAt: '2026-03-18T12:10:00.000Z',
                },
            },
            notes: [
                {
                    author: 'admin',
                    note: 'Escalar a deploy',
                    createdAt: '2026-03-18T12:15:00.000Z',
                },
            ],
        },
    });

    assert.match(runbook, /OWNER: deploy/);
    assert.match(runbook, /Comandos:/);
    assert.match(handoff, /INCIDENTE: /);
    assert.match(handoff, /Escalar a deploy/);
});
