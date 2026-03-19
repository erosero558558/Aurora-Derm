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
                    'src/apps/queue-shared/turnero-release-incident-executor.js'
                )
            ).href
        );
    }

    return modulePromise;
}

function createMemoryStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
    };
}

test('turnero release incident executor persiste estados y notas por clínica', async () => {
    const module = await loadModule();
    const storage = createMemoryStorage();
    const executor = module.createIncidentExecutorStore({
        clinicId: 'clinica-demo',
        storage,
    });

    assert.match(
        executor.key,
        /turnero\.release\.incident\.executor\.clinica-demo$/
    );
    assert.deepEqual(executor.read(), { incidents: {}, updatedAt: null });

    executor.setStepState({
        incidentId: 'inc-1',
        lane: 'now',
        index: 0,
        nextState: 'doing',
    });
    executor.appendNote({
        incidentId: 'inc-1',
        note: 'Revisar después del corte',
        author: 'admin',
    });

    const afterWrite = executor.read();
    assert.equal(afterWrite.incidents['inc-1'].steps['now:0'].state, 'doing');
    assert.equal(
        afterWrite.incidents['inc-1'].notes[0].note,
        'Revisar después del corte'
    );

    const summary = module.buildExecutionSummary({
        playbooks: [
            {
                id: 'inc-1',
                title: 'Incidente',
                owner: 'deploy',
                severity: 'critical',
            },
        ],
        executorState: afterWrite,
    });

    assert.equal(summary[0].counters.doing, 1);
    assert.equal(summary[0].notes.length, 1);

    const exported = executor.exportPack({
        playbooks: [{ id: 'inc-1' }],
        context: { clinicName: 'Clínica Demo' },
    });

    assert.equal(exported.clinicId, 'clinica-demo');
    assert.equal(exported.playbooks.length, 1);
    assert.equal(exported.executorState.incidents['inc-1'].notes.length, 1);

    executor.resetIncident('inc-1');
    assert.deepEqual(executor.read(), {
        incidents: {},
        updatedAt: afterWrite.updatedAt ? executor.read().updatedAt : null,
    });
});

test('turnero release incident executor rechaza estados inválidos', async () => {
    const module = await loadModule();
    const executor = module.createIncidentExecutorStore({
        clinicId: 'clinica-demo',
        storage: createMemoryStorage(),
    });

    assert.throws(
        () =>
            executor.setStepState({
                incidentId: 'inc-1',
                lane: 'now',
                index: 0,
                nextState: 'broken',
            }),
        /Invalid step state/
    );
});
