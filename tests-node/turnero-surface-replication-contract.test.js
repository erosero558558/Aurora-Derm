'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
} = require('./turnero-release-test-fixtures.js');
const {
    installFakeDom,
    installLocalStorageMock,
} = require('./turnero-surface-rollout-test-helpers.js');

const CLINIC_PROFILE = buildClinicProfile({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clínica Demo',
        short_name: 'Demo',
        city: 'Quito',
    },
    region: 'sierra',
    surfaces: {
        operator: {
            label: 'Turnero Operador',
        },
        kiosk: {
            label: 'Turnero Kiosco',
        },
        display: {
            label: 'Turnero Sala TV',
        },
    },
});

let fakeDom;
let storage;

test.beforeEach(() => {
    storage = installLocalStorageMock();
    fakeDom = installFakeDom();
    global.__createdTurneroBlobs = [];
});

test.afterEach(() => {
    fakeDom?.cleanup();
    storage?.cleanup();
    delete global.__createdTurneroBlobs;
});

test('surface replication snapshot, gate and readout normalize defaults', async () => {
    const snapshotModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-replication-snapshot.js'
    );
    const gateModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-replication-gate.js'
    );
    const packModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-replication-pack.js'
    );
    const readoutModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-replication-readout.js'
    );

    const operatorSnapshot = snapshotModule.buildTurneroSurfaceReplicationSnapshot(
        {
            scope: 'regional',
            surfaceKey: 'operator-turnos',
            surfaceLabel: 'Turnero Operador',
            clinicProfile: CLINIC_PROFILE,
            runtimeState: 'ready',
            truth: 'watch',
            templateState: 'ready',
            assetProfile: 'mini-pc + printer',
            replicationOwner: 'ops-lead',
            installTimeBucket: 'half-day',
            documentationState: 'ready',
        }
    );

    assert.equal(operatorSnapshot.surfaceKey, 'operator-turnos');
    assert.equal(operatorSnapshot.clinicId, 'clinica-demo');
    assert.equal(operatorSnapshot.templateState, 'ready');
    assert.equal(operatorSnapshot.replicationOwner, 'ops-lead');

    const readyGate = gateModule.buildTurneroSurfaceReplicationGate({
        snapshot: operatorSnapshot,
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        templates: [{ status: 'ready' }],
        owners: [{ status: 'active' }],
    });
    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'replication-ready');

    const kioskPack = packModule.buildTurneroSurfaceReplicationPack({
        surfaceKey: 'kiosco-turnos',
        surfaceLabel: 'Turnero Kiosco',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'watch',
        templateState: 'draft',
        assetProfile: 'kiosk + printer',
        replicationOwner: '',
        installTimeBucket: 'unknown',
        documentationState: 'draft',
    });

    assert.equal(kioskPack.gate.band, 'degraded');
    assert.equal(kioskPack.readout.title, 'Replicación degradada');
    assert.match(kioskPack.readout.summary, /Scaleout degradado/);

    const readout = readoutModule.buildTurneroSurfaceReplicationReadout({
        snapshot: kioskPack.snapshot,
        checklist: kioskPack.checklist,
        gate: kioskPack.gate,
        templates: kioskPack.templates,
        owners: kioskPack.owners,
    });

    assert.equal(readout.surfaceKey, 'kiosco-turnos');
    assert.equal(readout.gateBand, 'degraded');
    assert.match(readout.brief, /Surface Replication Scaleout/);
});

test('surface replication stores are clinic-scoped and filter by surface key', async () => {
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-deployment-template-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-replication-owner-store.js'
    );

    const templates = ledgerModule.createTurneroSurfaceDeploymentTemplateLedger(
        'regional',
        CLINIC_PROFILE
    );
    const owners = ownerModule.createTurneroSurfaceReplicationOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherTemplates =
        ledgerModule.createTurneroSurfaceDeploymentTemplateLedger('regional', {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        });

    templates.add({
        surfaceKey: 'operator-turnos',
        kind: 'deployment-template',
        status: 'ready',
        owner: 'ops',
        note: 'Plantilla operador.',
    });
    templates.add({
        surfaceKey: 'kiosco-turnos',
        kind: 'deployment-template',
        status: 'ready',
        owner: 'ops',
        note: 'Plantilla kiosco.',
    });
    owners.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'replication',
        status: 'active',
        note: 'Owner operador.',
    });

    assert.equal(templates.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(templates.list({ surfaceKey: 'kiosco-turnos' }).length, 1);
    assert.equal(owners.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherTemplates.list({ surfaceKey: 'operator-turnos' }).length, 0);

    templates.clear({ surfaceKey: 'operator-turnos' });
    owners.clear({ surfaceKey: 'operator-turnos' });

    assert.equal(templates.list({ surfaceKey: 'operator-turnos' }).length, 0);
    assert.equal(owners.list({ surfaceKey: 'operator-turnos' }).length, 0);
});

test('admin replication console mounts banner, chips and actions', async () => {
    const consoleModule = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-replication-console.js'
    );

    const html = consoleModule.buildTurneroAdminQueueSurfaceReplicationConsoleHtml(
        {
            clinicProfile: CLINIC_PROFILE,
            scope: 'regional',
        }
    );

    assert.match(html, /Surface Replication Scaleout/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Add template/);
    assert.match(html, /Add owner/);

    const host = fakeDom.document.createElement('div');
    const controller =
        consoleModule.mountTurneroAdminQueueSurfaceReplicationConsole(host, {
            clinicProfile: CLINIC_PROFILE,
            scope: 'regional',
        });

    assert.ok(controller);
    assert.equal(host.children.length, 1);
    assert.equal(controller.state.surfacePacks.length, 3);
    assert.match(controller.bannerHost.textContent, /Surface Replication Scaleout/);
    assert.equal(controller.surfaceCardRefs.length, 3);
    assert.match(controller.surfaceCardRefs[0].templateChip.textContent, /template/i);
    assert.match(
        controller.surfaceCardRefs[0].replicationChip.textContent,
        /replication/i
    );
    assert.match(controller.surfaceCardRefs[0].scoreChip.textContent, /score/i);

    const copyHandler = controller.refs.copyButton.listeners.get('click');
    const downloadHandler = controller.refs.downloadButton.listeners.get('click');
    const refreshHandler = controller.refs.refreshButton.listeners.get('click');
    const templateSubmit = controller.refs.templateForm.listeners.get('submit');
    const ownerSubmit = controller.refs.ownerForm.listeners.get('submit');
    const clearTemplatesHandler =
        controller.refs.clearTemplatesButton.listeners.get('click');
    const clearOwnersHandler =
        controller.refs.clearOwnersButton.listeners.get('click');

    assert.equal(typeof copyHandler, 'function');
    assert.equal(typeof downloadHandler, 'function');
    assert.equal(typeof refreshHandler, 'function');
    assert.equal(typeof templateSubmit, 'function');
    assert.equal(typeof ownerSubmit, 'function');

    await copyHandler({ preventDefault() {} });
    assert.match(fakeDom.clipboardWrites.at(-1), /Surface Replication Scaleout/);

    await downloadHandler({ preventDefault() {} });
    assert.equal(global.__createdTurneroBlobs.length, 1);

    controller.refs.templateSurfaceSelect.value = 'operator-turnos';
    controller.refs.templateKindInput.value = 'deployment-template';
    controller.refs.templateVersionInput.value = 'v2';
    controller.refs.templateStatusInput.value = 'ready';
    controller.refs.templateOwnerInput.value = 'ops';
    controller.refs.templateNoteInput.value = 'Nueva plantilla';
    await templateSubmit({
        preventDefault() {},
        target: controller.refs.templateForm,
    });

    controller.refs.ownerSurfaceSelect.value = 'sala-turnos';
    controller.refs.ownerActorInput.value = 'ops-display';
    controller.refs.ownerRoleInput.value = 'replication';
    controller.refs.ownerStatusInput.value = 'active';
    controller.refs.ownerNoteInput.value = 'Nuevo owner';
    await ownerSubmit({
        preventDefault() {},
        target: controller.refs.ownerForm,
    });

    assert.equal(
        controller.state.templates.some((entry) => entry.note === 'Nueva plantilla'),
        true
    );
    assert.equal(
        controller.state.owners.some((entry) => entry.note === 'Nuevo owner'),
        true
    );

    await refreshHandler({ preventDefault() {} });
    assert.equal(controller.state.surfacePacks.length, 3);

    await clearTemplatesHandler({ preventDefault() {} });
    await clearOwnersHandler({ preventDefault() {} });

    assert.equal(controller.state.templates.length, 0);
    assert.equal(controller.state.owners.length, 0);
});
