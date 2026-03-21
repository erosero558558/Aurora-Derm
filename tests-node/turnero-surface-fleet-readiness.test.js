#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const storage = createLocalStorageStub();
global.localStorage = storage;

let copiedText = '';
let downloadClicks = [];
let revokedUrls = [];

class HTMLElementStub {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.listeners = new Map();
        this.nodes = new Map();
        this.className = '';
        this.style = {};
        this.textContent = '';
        this.value = '';
        this.hidden = false;
        this.parentNode = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        const normalizedName = String(name);
        const normalizedValue = String(value);
        this.attributes.set(normalizedName, normalizedValue);
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[datasetKey] = normalizedValue;
        }
    }

    getAttribute(name) {
        const normalizedName = String(name);
        if (this.attributes.has(normalizedName)) {
            return this.attributes.get(normalizedName);
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            return Object.prototype.hasOwnProperty.call(
                this.dataset,
                datasetKey
            )
                ? this.dataset[datasetKey]
                : null;
        }
        return null;
    }

    removeAttribute(name) {
        const normalizedName = String(name);
        this.attributes.delete(normalizedName);
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            delete this.dataset[datasetKey];
        }
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    replaceChildren(...nodes) {
        this.children = [];
        nodes.forEach((node) => {
            this.children.push(node);
            node.parentNode = this;
        });
        this._innerHTML = '';
        return nodes[0] || null;
    }

    removeChild(node) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const tagName = key.includes('[data-role="brief"]')
                ? 'pre'
                : key.includes('[data-field="')
                  ? key.includes('note')
                      ? 'textarea'
                      : key.includes('surface-key')
                        ? 'select'
                        : 'input'
                  : key.includes('[data-action="')
                    ? 'button'
                    : 'div';
            const node = new HTMLElementStub(tagName);
            this.nodes.set(key, node);
        }

        return this.nodes.get(key);
    }

    querySelectorAll() {
        return [];
    }

    focus() {}

    select() {}

    click() {
        this.clicked = true;
    }

    remove() {
        if (
            this.parentNode &&
            typeof this.parentNode.removeChild === 'function'
        ) {
            this.parentNode.removeChild(this);
        }
    }
}

function setGlobalValue(name, value) {
    Object.defineProperty(global, name, {
        configurable: true,
        enumerable: true,
        writable: true,
        value,
    });
}

function createDocumentStub() {
    const head = new HTMLElementStub('head', 'head');
    const body = new HTMLElementStub('body', 'body');

    return {
        head,
        body,
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new HTMLElementStub('a');
                anchor.click = () => {
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                        rel: anchor.rel,
                        clicked: true,
                    });
                };
                return anchor;
            }

            return new HTMLElementStub(tag);
        },
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
        execCommand() {
            return false;
        },
    };
}

function createActionTarget(action) {
    const target = new HTMLElementStub('button');
    target.dataset.action = action;
    return target;
}

async function invokeHostAction(host, action) {
    const handler = host.listeners.get('click');
    assert.equal(typeof handler, 'function');
    const actionNode = createActionTarget(action);
    await handler({
        target: {
            closest(selector) {
                return selector === '[data-action]' ? actionNode : null;
            },
        },
    });
}

const documentStub = createDocumentStub();
setGlobalValue('HTMLElement', HTMLElementStub);
setGlobalValue('document', documentStub);
setGlobalValue('navigator', {
    clipboard: {
        writeText: async (text) => {
            copiedText = String(text);
        },
    },
});

if (global.URL && typeof global.URL === 'object') {
    global.URL.createObjectURL = (blob) => {
        revokedUrls.push(`blob:${String(blob?.type || 'application/json')}`);
        return 'blob:turnero-surface-fleet';
    };
    global.URL.revokeObjectURL = (href) => {
        revokedUrls.push(String(href));
    };
} else if (global.URL && typeof global.URL === 'function') {
    global.URL.createObjectURL = (blob) => {
        revokedUrls.push(`blob:${String(blob?.type || 'application/json')}`);
        return 'blob:turnero-surface-fleet';
    };
    global.URL.revokeObjectURL = (href) => {
        revokedUrls.push(String(href));
    };
}

test.beforeEach(() => {
    storage.clear();
    copiedText = '';
    downloadClicks = [];
    revokedUrls = [];
});

const CLINIC_PROFILE = Object.freeze(
    buildClinicProfile({
        clinic_id: 'clinica-demo',
        region: 'sierra',
        branding: {
            name: 'Clínica Demo',
            short_name: 'Demo',
            city: 'Quito',
        },
    })
);

const OTHER_CLINIC_PROFILE = Object.freeze(
    buildClinicProfile({
        clinic_id: 'clinica-otra',
        region: 'sierra',
        branding: {
            name: 'Clínica Otra',
            short_name: 'Otra',
            city: 'Cuenca',
        },
    })
);

test('snapshot and pack normalize clinic metadata', async () => {
    const snapshotModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-fleet-snapshot.js'
    );
    const packModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-fleet-pack.js'
    );

    const snapshot = snapshotModule.buildTurneroSurfaceFleetSnapshot({
        surfaceKey: 'sala-turnos',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'aligned',
    });

    assert.equal(snapshot.surfaceKey, 'display');
    assert.equal(snapshot.clinicId, 'clinica-demo');
    assert.equal(snapshot.clinicLabel, 'Clínica Demo');
    assert.equal(snapshot.region, 'sierra');

    const pack = packModule.buildTurneroSurfaceFleetPack({
        surfaceKey: 'operator-turnos',
        clinicProfile: CLINIC_PROFILE,
        checklist: { summary: { all: 6, pass: 6, fail: 0 } },
        waves: [
            {
                surfaceKey: 'operator-turnos',
                title: 'Wave 1',
                waveLabel: 'Wave 1',
                owner: 'ops',
                status: 'ready',
                batch: 'batch-1',
                documentationState: 'ready',
            },
        ],
        owners: [
            {
                surfaceKey: 'operator-turnos',
                actor: 'ops-lead',
                role: 'regional',
                status: 'active',
            },
        ],
    });

    assert.equal(pack.scope, 'sierra');
    assert.equal(pack.snapshot.surfaceKey, 'operator');
    assert.equal(pack.snapshot.waveLabel, 'Wave 1');
    assert.equal(pack.snapshot.fleetOwner, 'ops-lead');
    assert.equal(pack.snapshot.rolloutBatch, 'batch-1');
    assert.equal(pack.snapshot.documentationState, 'ready');
    assert.equal(pack.gate.band, 'ready');
    assert.equal(pack.readout.title, 'Fleet readiness aligned');
    assert.equal(pack.readout.checkpoints.length, 5);
    assert.match(pack.readout.brief, /Surface Fleet Readiness/);
});

test('wave ledger and owner store stay clinic-scoped and bounded', async () => {
    const waveLedgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-wave-ledger.js'
    );
    const ownerStoreModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-fleet-owner-store.js'
    );

    const waveLedger = waveLedgerModule.createTurneroSurfaceWaveLedger(
        'sierra',
        CLINIC_PROFILE
    );
    const otherWaveLedger = waveLedgerModule.createTurneroSurfaceWaveLedger(
        'sierra',
        OTHER_CLINIC_PROFILE
    );
    const ownerStore = ownerStoreModule.createTurneroSurfaceFleetOwnerStore(
        'sierra',
        CLINIC_PROFILE
    );
    const otherOwnerStore =
        ownerStoreModule.createTurneroSurfaceFleetOwnerStore(
            'sierra',
            OTHER_CLINIC_PROFILE
        );

    const firstWave = waveLedger.add({
        surfaceKey: 'operator-turnos',
        title: 'Wave 1',
        waveLabel: 'Wave 1',
        owner: 'ops',
        status: 'ready',
        note: 'Primera ola.',
    });
    waveLedger.add({
        surfaceKey: 'kiosco-turnos',
        title: 'Wave 2',
        waveLabel: 'Wave 2',
        owner: 'ops',
        status: 'planned',
        note: 'Segunda ola.',
    });
    const firstOwner = ownerStore.add({
        surfaceKey: 'operator-turnos',
        actor: 'ops-lead',
        role: 'regional',
        status: 'active',
        note: 'Owner inicial.',
    });
    ownerStore.add({
        surfaceKey: 'kiosco-turnos',
        actor: 'ops-kiosk',
        role: 'regional',
        status: 'paused',
        note: 'Owner secundario.',
    });

    assert.equal(firstWave.surfaceKey, 'operator');
    assert.equal(firstOwner.surfaceKey, 'operator');
    assert.equal(waveLedger.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(waveLedger.list({ surfaceKey: 'kiosk' }).length, 1);
    assert.equal(waveLedger.list().length, 2);
    assert.equal(otherWaveLedger.list().length, 0);
    assert.equal(ownerStore.list({ surfaceKey: 'operator' }).length, 1);
    assert.equal(ownerStore.list({ surfaceKey: 'kiosk' }).length, 1);
    assert.equal(ownerStore.list().length, 2);
    assert.equal(otherOwnerStore.list().length, 0);
    assert.equal(
        waveLedger.snapshot().schema,
        'turnero-surface-wave-ledger/v1'
    );
    assert.equal(
        ownerStore.snapshot().schema,
        'turnero-surface-fleet-owner-store/v1'
    );

    for (let index = 0; index < 301; index += 1) {
        waveLedger.add({
            surfaceKey: 'operator-turnos',
            title: `Wave ${index + 3}`,
            waveLabel: `Wave ${index + 3}`,
            owner: 'ops',
            status: index % 2 === 0 ? 'ready' : 'planned',
            note: `Ola ${index + 3}.`,
            updatedAt: `2026-03-20T10:${String(index % 60).padStart(
                2,
                '0'
            )}:00.000Z`,
        });
        ownerStore.add({
            surfaceKey: 'operator-turnos',
            actor: `owner-${index}`,
            role: 'regional',
            status: index % 2 === 0 ? 'active' : 'paused',
            note: `Owner ${index}.`,
            updatedAt: `2026-03-20T11:${String(index % 60).padStart(
                2,
                '0'
            )}:00.000Z`,
        });
    }

    assert.equal(waveLedger.list().length, 300);
    assert.equal(ownerStore.list().length, 300);

    waveLedger.clear({ surfaceKey: 'kiosco-turnos' });
    ownerStore.clear({ surfaceKey: 'kiosco-turnos' });
    assert.equal(waveLedger.list({ surfaceKey: 'kiosk' }).length, 0);
    assert.equal(ownerStore.list({ surfaceKey: 'kiosk' }).length, 0);

    waveLedger.clear();
    ownerStore.clear();
    assert.equal(waveLedger.list().length, 0);
    assert.equal(ownerStore.list().length, 0);
});

test('gate bands resolve ready, watch and blocked', async () => {
    const gateModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-fleet-gate.js'
    );

    const readyGate = gateModule.buildTurneroSurfaceFleetGate({
        checklist: { summary: { all: 6, pass: 6, fail: 0 } },
        waves: [{ status: 'ready' }, { status: 'ready' }],
        owners: [{ status: 'active' }, { status: 'active' }],
    });
    const watchGate = gateModule.buildTurneroSurfaceFleetGate({
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        waves: [{ status: 'ready' }],
        owners: [{ status: 'active' }],
    });
    const blockedGate = gateModule.buildTurneroSurfaceFleetGate({
        checklist: { summary: { all: 4, pass: 2, fail: 2 } },
        waves: [{ status: 'ready' }],
        owners: [{ status: 'active' }],
    });

    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'fleet-ready');
    assert.equal(readyGate.score, 100);
    assert.equal(watchGate.band, 'watch');
    assert.equal(watchGate.decision, 'review-wave-plan');
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'hold-fleet-expansion');
});

test('admin console mounts and wires copy/download/add flows', async () => {
    const consoleModule = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-fleet-console.js'
    );

    const html =
        consoleModule.buildTurneroAdminQueueSurfaceFleetConsoleHtml({
            clinicProfile: CLINIC_PROFILE,
            scope: 'sierra',
            checklist: { summary: { all: 6, pass: 4, fail: 2 } },
        });

    assert.match(html, /Surface Fleet Readiness/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Add wave/);
    assert.match(html, /Add owner/);

    const host = new HTMLElementStub('div', 'queueSurfaceFleetConsoleHost');
    const mountResult = consoleModule.mountTurneroAdminQueueSurfaceFleetConsole(
        host,
        {
            clinicProfile: CLINIC_PROFILE,
            scope: 'sierra',
            checklist: { summary: { all: 6, pass: 4, fail: 2 } },
        }
    );

    assert.equal(mountResult.root, host);
    assert.match(host.innerHTML, /Surface Fleet Readiness/);
    assert.match(host.innerHTML, /Copy brief/);
    assert.match(host.innerHTML, /Download JSON/);

    host.querySelector('[data-field="wave-surface-key"]').value = 'operator';
    host.querySelector('[data-field="wave-label"]').value = 'Wave 9';
    host.querySelector('[data-field="wave-note"]').value =
        'Plan de despliegue.';
    await invokeHostAction(host, 'add-wave');

    assert.equal(host.querySelector('[data-role="wave-count"]').textContent, '1');
    assert.match(
        host.querySelector('[data-role="wave-list"]').innerHTML,
        /Wave 9/
    );

    host.querySelector('[data-field="owner-surface-key"]').value = 'display';
    host.querySelector('[data-field="owner-name"]').value = 'ops-lead';
    host.querySelector('[data-field="owner-note"]').value =
        'Fleet owner en sala.';
    await invokeHostAction(host, 'add-owner');

    assert.equal(
        host.querySelector('[data-role="owner-count"]').textContent,
        '1'
    );
    assert.match(
        host.querySelector('[data-role="owner-list"]').innerHTML,
        /ops-lead/
    );

    await invokeHostAction(host, 'copy-brief');
    assert.match(copiedText, /Surface Fleet Readiness/);
    assert.match(copiedText, /Wave 9/);
    assert.match(copiedText, /ops-lead/);

    await invokeHostAction(host, 'download-json');
    assert.equal(downloadClicks.length, 1);
    assert.equal(
        downloadClicks[0].download,
        'turnero-surface-fleet-readiness.json'
    );
    assert.equal(downloadClicks[0].clicked, true);
    assert.match(String(downloadClicks[0].href), /^blob:/);
});
