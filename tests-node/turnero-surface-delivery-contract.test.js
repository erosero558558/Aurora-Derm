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

class FakeElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.children = [];
        this.className = '';
        this.hidden = false;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(child) {
        this.children.push(child);
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._innerHTML = '';
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    querySelector() {
        return null;
    }
}

function withGlobals(setup, callback) {
    const previous = {};
    for (const [key, value] of Object.entries(setup)) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        Object.defineProperty(global, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            value,
        });
    }

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            for (const [key, descriptor] of Object.entries(previous)) {
                if (!descriptor) {
                    delete global[key];
                    continue;
                }

                Object.defineProperty(global, key, descriptor);
            }
        });
}

installLocalStorageMock();

test.beforeEach(() => {
    global.localStorage.clear();
});

const CLINIC_PROFILE = Object.freeze({
    clinic_id: 'clinica-demo',
    branding: {
        name: 'Clinica Demo',
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

test('delivery snapshot normalizes clinic data and aliases', async () => {
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-snapshot.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceDeliverySnapshot({
        surfaceKey: 'operador-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
    });

    assert.equal(snapshot.surfaceKey, 'operator');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clinica Demo');
    assert.equal(snapshot.targetWindow, '48h');
    assert.equal(snapshot.deliveryOwner, 'ops-lead');
});

test('delivery ledger and owner store isolate clinic and scope', async () => {
    const ledgerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-ledger.js'
    );
    const ownerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-owner-store.js'
    );

    const regionalLedger = ledgerModule.createTurneroSurfaceDeliveryLedger(
        'regional',
        CLINIC_PROFILE
    );
    const sameScopeLedger = ledgerModule.createTurneroSurfaceDeliveryLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherScopeLedger = ledgerModule.createTurneroSurfaceDeliveryLedger(
        'local',
        CLINIC_PROFILE
    );
    const otherClinicLedger = ledgerModule.createTurneroSurfaceDeliveryLedger(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    const regionalOwners = ownerModule.createTurneroSurfaceDeliveryOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const sameScopeOwners = ownerModule.createTurneroSurfaceDeliveryOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherScopeOwners = ownerModule.createTurneroSurfaceDeliveryOwnerStore(
        'local',
        CLINIC_PROFILE
    );
    const otherClinicOwners = ownerModule.createTurneroSurfaceDeliveryOwnerStore(
        'regional',
        {
            ...CLINIC_PROFILE,
            clinic_id: 'clinica-otra',
        }
    );

    regionalLedger.add({
        surfaceKey: 'operator-turnos',
        kind: 'dependency',
        status: 'open',
        owner: 'ops-lead',
        title: 'Print provider',
        note: 'Pendiente de validar.',
        dependencyRef: 'DEP-101',
        targetWindow: '48h',
    });
    regionalOwners.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'delivery',
        status: 'active',
        note: 'Owner delivery.',
    });

    assert.equal(sameScopeLedger.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(otherScopeLedger.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(otherClinicLedger.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(sameScopeOwners.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(otherScopeOwners.list({ surfaceKey: 'operator' }).length, 0);
    assert.equal(otherClinicOwners.list({ surfaceKey: 'operator' }).length, 0);
});

test('delivery gate and readout expose band, decision and three checkpoints', async () => {
    const gateModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-gate.js'
    );
    const readoutModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-readout.js'
    );
    const snapshotModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-snapshot.js'
    );

    const readySnapshot = snapshotModule.buildTurneroSurfaceDeliverySnapshot({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'aligned',
        targetWindow: '24h',
        dependencyState: 'ready',
        blockerState: 'clear',
        deliveryOwner: 'ops-display',
        releaseOwner: 'release-lead',
        opsOwner: 'av-ops',
    });
    const readyGate = gateModule.buildTurneroSurfaceDeliveryGate({
        snapshot: readySnapshot,
        checklist: {
            summary: {
                all: 5,
                pass: 5,
                fail: 0,
            },
        },
        ledger: [
            {
                surfaceKey: 'display',
                kind: 'plan',
                status: 'ready',
            },
        ],
        owners: [
            {
                surfaceKey: 'display',
                actor: 'ops-display',
                role: 'delivery',
                status: 'active',
            },
            {
                surfaceKey: 'display',
                actor: 'release-lead',
                role: 'release',
                status: 'active',
            },
            {
                surfaceKey: 'display',
                actor: 'av-ops',
                role: 'ops',
                status: 'active',
            },
        ],
    });
    const readout = readoutModule.buildTurneroSurfaceDeliveryReadout({
        snapshot: readySnapshot,
        gate: readyGate,
    });
    const blockedGate = gateModule.buildTurneroSurfaceDeliveryGate({
        snapshot: readySnapshot,
        checklist: {
            summary: {
                all: 5,
                pass: 2,
                fail: 3,
            },
        },
        ledger: [],
        owners: [],
    });

    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'ready-for-delivery-window');
    assert.equal(readout.checkpoints.length, 3);
    assert.deepEqual(
        readout.checkpoints.map((chip) => chip.label),
        ['window', 'deps', 'gate']
    );
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'hold-delivery-plan');
});

test('delivery pack assembles brief and normalized fields', async () => {
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-pack.js'
    );

    const pack = packModule.buildTurneroSurfaceDeliveryPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'watch',
        truth: 'watch',
        targetWindow: '48h',
        dependencyState: 'watch',
        blockerState: 'clear',
        deliveryOwner: 'ops-lead',
        releaseOwner: 'release-lead',
        opsOwner: 'operator-supervisor',
        checklist: {
            summary: {
                all: 5,
                pass: 4,
                fail: 1,
            },
        },
        ledger: [
            {
                surfaceKey: 'operator',
                kind: 'dependency',
                status: 'open',
                owner: 'ops',
                title: 'Print provider',
                note: 'Pendiente.',
                dependencyRef: 'DEP-101',
                targetWindow: '48h',
            },
        ],
        owners: [
            {
                surfaceKey: 'operator',
                actor: 'ops-lead',
                role: 'delivery',
                status: 'active',
                note: 'Owner delivery.',
            },
            {
                surfaceKey: 'operator',
                actor: 'release-lead',
                role: 'release',
                status: 'active',
                note: 'Owner release.',
            },
            {
                surfaceKey: 'operator',
                actor: 'operator-supervisor',
                role: 'ops',
                status: 'active',
                note: 'Owner ops.',
            },
        ],
    });

    assert.equal(pack.snapshot.surfaceKey, 'operator');
    assert.equal(pack.readout.targetWindow, '48h');
    assert.match(pack.brief, /Surface Delivery Planning Console/);
    assert.match(pack.brief, /Print provider/);
});

test('delivery banner stays visible when band is ready', async () => {
    const bannerModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-banner.js'
    );
    const packModule = await importRepoModule(
        'src/apps/queue-shared/turnero-surface-delivery-pack.js'
    );
    const host = new FakeElement('div', 'deliveryBannerHost');

    await withGlobals(
        {
            HTMLElement: FakeElement,
            document: {
                head: new FakeElement('head', 'head'),
                createElement(tagName) {
                    return new FakeElement(tagName);
                },
                getElementById() {
                    return null;
                },
            },
        },
        async () => {
            const pack = packModule.buildTurneroSurfaceDeliveryPack({
                surfaceKey: 'sala-turnos',
                clinicProfile: CLINIC_PROFILE,
                runtimeState: 'ready',
                truth: 'aligned',
                targetWindow: '24h',
                dependencyState: 'ready',
                blockerState: 'clear',
                deliveryOwner: 'ops-display',
                releaseOwner: 'release-lead',
                opsOwner: 'av-ops',
                checklist: {
                    summary: {
                        all: 5,
                        pass: 5,
                        fail: 0,
                    },
                },
                owners: [
                    { role: 'delivery', actor: 'ops-display', status: 'active' },
                    { role: 'release', actor: 'release-lead', status: 'active' },
                    { role: 'ops', actor: 'av-ops', status: 'active' },
                ],
            });

            const node = bannerModule.mountTurneroSurfaceDeliveryBanner(host, {
                pack,
                title: 'Display delivery',
            });

            assert.ok(node);
            assert.equal(host.hidden, false);
            assert.equal(host.dataset.band, 'ready');
            assert.match(host.innerHTML, /Display delivery/);
        }
    );
});
