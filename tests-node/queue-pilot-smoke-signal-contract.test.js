const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let smokeSignalModulePromise = null;

async function loadSmokeSignalModule() {
    if (!smokeSignalModulePromise) {
        const modulePath = path.resolve(
            __dirname,
            '../src/apps/admin-v3/shared/modules/queue/render/section/install-hub/smoke-signal.js'
        );
        smokeSignalModulePromise = import(pathToFileURL(modulePath).href);
    }

    return smokeSignalModulePromise;
}

function buildState(overrides = {}) {
    return {
        data: {
            queueMeta: {
                calledCount: 0,
            },
            queueTickets: [],
        },
        queue: {
            activity: [],
        },
        ...overrides,
    };
}

test('smoke signal ignores activity from another clinic', async () => {
    const nowIso = new Date().toISOString();
    const state = buildState({
        queue: {
            activity: [
                {
                    at: nowIso,
                    clinicId: 'clinica-sur-demo',
                    message: 'Llamado C1 ejecutado',
                },
            ],
        },
    });
    const { hasRecentQueueSmokeSignalForState } = await loadSmokeSignalModule();

    assert.equal(
        hasRecentQueueSmokeSignalForState(state, 'clinica-norte-demo', 21600),
        false
    );
});

test('smoke signal accepts activity from the active clinic', async () => {
    const nowIso = new Date().toISOString();
    const state = buildState({
        queue: {
            activity: [
                {
                    at: nowIso,
                    clinicId: 'clinica-norte-demo',
                    message: 'Llamado C1 ejecutado',
                },
            ],
        },
    });
    const { hasRecentQueueSmokeSignalForState } = await loadSmokeSignalModule();

    assert.equal(
        hasRecentQueueSmokeSignalForState(state, 'clinica-norte-demo', 21600),
        true
    );
});

test('smoke signal ignores legacy activity without clinic id to avoid false green', async () => {
    const nowIso = new Date().toISOString();
    const state = buildState({
        queue: {
            activity: [
                {
                    at: nowIso,
                    message: 'Llamado C1 ejecutado',
                },
            ],
        },
    });
    const { hasRecentQueueSmokeSignalForState } = await loadSmokeSignalModule();

    assert.equal(
        hasRecentQueueSmokeSignalForState(state, 'clinica-norte-demo', 21600),
        false
    );
});
