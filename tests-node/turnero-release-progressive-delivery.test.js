const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    buildPilotReadiness,
    buildRemoteReadiness,
    buildShellDrift,
    buildEvidenceSnapshot,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadProgressiveDeliveryModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-progressive-delivery.js'
    );
}

async function loadFreezeRegistryModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-freeze-window-registry.js'
    );
}

test('buildTurneroReleaseProgressiveDelivery agrupa las cuatro waves y el pack consolidado', async () => {
    const module = await loadProgressiveDeliveryModule();
    const snapshot = buildEvidenceSnapshot({
        turneroClinicProfile: buildClinicProfile({ clinicId: 'clinica-demo' }),
        pilotReadiness: buildPilotReadiness(),
        remoteReleaseReadiness: buildRemoteReadiness(),
        publicShellDrift: buildShellDrift(),
    });

    const model = module.buildTurneroReleaseProgressiveDelivery({ snapshot });

    assert.equal(model.clinicId, 'clinica-demo');
    assert.ok(model.pack);
    assert.ok(model.exports);
    assert.ok(
        model.executiveBriefMarkdown.includes(
            'Progressive Delivery Mission Control'
        )
    );
    assert.ok(model.wavePlanner.waves['wave-0']);
    assert.ok(model.wavePlanner.waves['wave-1']);
    assert.ok(model.wavePlanner.waves['wave-2']);
    assert.ok(model.wavePlanner.waves.global);
    assert.ok(Array.isArray(model.wavePlanner.waves['wave-0'].items));
    assert.ok(Array.isArray(model.wavePlanner.waves['wave-1'].items));
    assert.ok(Array.isArray(model.wavePlanner.waves['wave-2'].items));
    assert.ok(Array.isArray(model.wavePlanner.waves.global.items));
    assert.match(model.wavePlanMarkdown, /wave-0/);
    assert.match(model.dependencyGatesMarkdown, /Dependency Gates/);
    assert.match(model.rollbackRehearsalMarkdown, /Rollback Rehearsal/);
    assert.match(model.maintenanceWindowMarkdown, /Maintenance Window Planner/);
});

test('freeze window registry persiste y rehidrata ventanas de freeze por clínica', async () => {
    const module = await loadFreezeRegistryModule();
    const storage = createLocalStorageStub();
    const clinicId = 'clinica-demo';

    const saved = module.upsertTurneroReleaseFreezeWindow(
        clinicId,
        {
            id: 'freeze-night',
            waveId: 'wave-1',
            label: 'Bloqueo nocturno',
            startAt: '2026-03-18T20:00:00.000Z',
            endAt: '2026-03-18T22:00:00.000Z',
            owner: 'deploy',
            reason: 'Ventana de despliegue',
            status: 'active',
            notes: 'QA listo.',
        },
        { storage }
    );

    assert.equal(saved.items.length, 1);
    assert.equal(saved.items[0].label, 'Bloqueo nocturno');
    assert.equal(saved.state, 'warning');

    const reloaded = module.readTurneroReleaseFreezeWindowRegistry(clinicId, {
        storage,
    });

    assert.equal(reloaded.clinicId, clinicId);
    assert.equal(reloaded.items.length, 1);
    assert.equal(reloaded.items[0].id, 'freeze-night');
    assert.equal(reloaded.items[0].status, 'active');
    assert.match(reloaded.markdown, /Bloqueo nocturno/);

    const cleared = module.clearTurneroReleaseFreezeWindowRegistry(clinicId, {
        storage,
    });
    assert.equal(cleared.items.length, 0);
});
