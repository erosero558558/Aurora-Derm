#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

function installLocalStorageMock() {
    const store = new Map();
    global.localStorage = {
        getItem(key) {
            const normalizedKey = String(key);
            return store.has(normalizedKey) ? store.get(normalizedKey) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
    };
}

installLocalStorageMock();

test.beforeEach(() => {
    global.localStorage.clear();
});

const CLINIC_PROFILE = Object.freeze({
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
            route: '/operador-turnos.html',
        },
        kiosk: {
            label: 'Turnero Kiosco',
            route: '/kiosco-turnos.html',
        },
        display: {
            label: 'Turnero Sala TV',
            route: '/sala-turnos.html',
        },
    },
});

test('service handover snapshot normalizes surfaces and packs expose three chips', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-service-handover-snapshot.js'
    );
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-service-handover-pack.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceServiceHandoverSnapshot({
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
    });
    const pack = packModule.buildTurneroSurfaceServiceHandoverPack({
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
    });

    assert.equal(snapshot.surfaceKey, 'operator-turnos');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.runtimeState, 'ready');
    assert.equal(snapshot.truth, 'watch');
    assert.equal(snapshot.playbookState, 'ready');
    assert.equal(pack.readout.chips.length, 3);
    assert.match(pack.readout.summary, /Service handover/);
    assert.match(pack.readout.detail, /Runtime ready/);
});

test('playbook ledger and owner roster persist by clinic scope', async () => {
    const playbookModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-service-playbook-ledger.js'
    );
    const rosterModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-owner-roster-store.js'
    );

    const playbook = playbookModule.createTurneroSurfaceServicePlaybookLedger(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicPlaybook =
        playbookModule.createTurneroSurfaceServicePlaybookLedger(
            'regional',
            CLINIC_PROFILE
        );
    const otherClinicPlaybook =
        playbookModule.createTurneroSurfaceServicePlaybookLedger('regional', {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        });
    const roster = rosterModule.createTurneroSurfaceOwnerRosterStore(
        'regional',
        CLINIC_PROFILE
    );
    const sameClinicRoster = rosterModule.createTurneroSurfaceOwnerRosterStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherClinicRoster = rosterModule.createTurneroSurfaceOwnerRosterStore(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    const playbookEntry = playbook.add({
        surfaceKey: 'operator-turnos',
        title: 'Brief operator',
        owner: 'ops-lead',
        status: 'ready',
        note: 'Lista para el operador.',
    });
    roster.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'primary',
        status: 'active',
        note: 'Owner principal.',
    });

    assert.equal(sameClinicPlaybook.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicPlaybook.list({ surfaceKey: 'operator-turnos' }).length, 0);
    assert.equal(sameClinicRoster.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherClinicRoster.list({ surfaceKey: 'operator-turnos' }).length, 0);
    assert.equal(playbookEntry.surfaceKey, 'operator-turnos');
});

test('service handover gate resolves ready watch and blocked bands', async () => {
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-service-handover-gate.js'
    );

    const ready = gateModule.buildTurneroSurfaceServiceHandoverGate({
        snapshots: [
            {
                surfaceKey: 'sala-turnos',
                runtimeState: 'ready',
                truth: 'aligned',
                primaryOwner: 'ops-display',
                backupOwner: 'backup-display',
                playbookState: 'ready',
                supportChannel: 'chat',
                handoverMode: 'broadcast',
            },
        ],
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
    });

    const watch = gateModule.buildTurneroSurfaceServiceHandoverGate({
        snapshots: [
            {
                surfaceKey: 'operator-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                primaryOwner: 'ops-lead',
                backupOwner: 'backup-ops',
                playbookState: 'ready',
                supportChannel: 'whatsapp',
                handoverMode: 'guided',
            },
        ],
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
    });

    const blocked = gateModule.buildTurneroSurfaceServiceHandoverGate({
        snapshots: [
            {
                surfaceKey: 'kiosco-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                primaryOwner: '',
                backupOwner: '',
                playbookState: 'missing',
                supportChannel: '',
                handoverMode: 'manual',
            },
        ],
        checklist: { summary: { all: 6, pass: 4, fail: 2 } },
    });

    assert.equal(ready.band, 'ready');
    assert.equal(ready.decision, 'service-handover-ready');
    assert.equal(watch.band, 'watch');
    assert.equal(watch.decision, 'review-service-handover');
    assert.equal(blocked.band, 'blocked');
    assert.equal(blocked.decision, 'hold-service-handover');
});

test('admin console html renders the service handover actions and surfaces', async () => {
    const consoleModule = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-service-handover-console.js'
    );

    const html =
        consoleModule.buildTurneroAdminQueueSurfaceServiceHandoverConsoleHtml({
            scope: 'regional',
            clinicProfile: CLINIC_PROFILE,
            snapshots: [
                { surfaceKey: 'operator-turnos' },
                { surfaceKey: 'kiosco-turnos' },
                { surfaceKey: 'sala-turnos' },
            ],
            checklist: { summary: { all: 6, pass: 4, fail: 2 } },
        });

    assert.match(html, /Surface Service Handover/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Add playbook/);
    assert.match(html, /Add owner/);
    assert.match(html, /Recompute/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /data-role="banner"/);
    assert.match(html, /data-role="brief"/);
    assert.match(html, /data-state="blocked"/);
});
