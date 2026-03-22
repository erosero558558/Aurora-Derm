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

test.beforeEach(() => {
    storage.clear();
});

class HTMLElementStub {
    constructor(tagName = 'div') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.hidden = false;
        this.listeners = new Map();
        this.style = {};
        this.className = '';
        this._innerHTML = '';
        this._textContent = '';
        this.value = '';
        this.parentElement = null;
    }

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this._textContent = '';
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set textContent(value) {
        this._textContent = String(value ?? '');
        this._innerHTML = '';
        this.children = [];
    }

    get textContent() {
        if (this._textContent) {
            return this._textContent;
        }

        if (this.children.length > 0) {
            return this.children
                .map((child) => String(child.textContent || ''))
                .join('');
        }

        return this._innerHTML;
    }

    setAttribute(name, value) {
        const normalizedName = String(name || '');
        const normalizedValue = String(value ?? '');
        if (normalizedName === 'class') {
            this.className = normalizedValue;
            return;
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            this.dataset[datasetKey] = normalizedValue;
        }
        this.attributes.set(normalizedName, normalizedValue);
    }

    getAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'class') {
            return this.className || null;
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            return Object.prototype.hasOwnProperty.call(this.dataset, datasetKey)
                ? this.dataset[datasetKey]
                : null;
        }
        return this.attributes.has(normalizedName)
            ? this.attributes.get(normalizedName)
            : null;
    }

    removeAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'class') {
            this.className = '';
            return;
        }
        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName
                .slice(5)
                .replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
            delete this.dataset[datasetKey];
        }
        this.attributes.delete(normalizedName);
    }

    appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._innerHTML = '';
        this._textContent = '';
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type || ''), handler);
    }

    removeEventListener(type, handler) {
        if (this.listeners.get(String(type || '')) === handler) {
            this.listeners.delete(String(type || ''));
        }
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

function createDomDocument() {
    return {
        head: {
            appendChild() {},
        },
        body: {
            appendChild() {},
        },
        createElement(tagName) {
            return new HTMLElementStub(tagName);
        },
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
    };
}

const CLINIC_PROFILE = buildClinicProfile({
    clinic_id: 'clinica-roadmap',
    branding: {
        name: 'Clinica Roadmap',
        short_name: 'Roadmap',
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

test('snapshot normalizes aliases and clinic metadata', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-snapshot.js'
    );

    const operator = module.buildTurneroSurfaceRoadmapSnapshot({
        surfaceKey: 'operator',
        clinicProfile: CLINIC_PROFILE,
        scope: 'regional',
    });
    const kiosk = module.buildTurneroSurfaceRoadmapSnapshot({
        surfaceKey: 'kiosk',
        clinicProfile: CLINIC_PROFILE,
        scope: 'regional',
    });
    const display = module.buildTurneroSurfaceRoadmapSnapshot({
        surfaceKey: 'sala_tv',
        clinicProfile: CLINIC_PROFILE,
        scope: 'regional',
    });

    assert.equal(operator.surfaceKey, 'operator-turnos');
    assert.equal(operator.surfaceLabel, 'Turnero Operador');
    assert.equal(operator.surfaceRoute, '/operador-turnos.html');
    assert.equal(operator.clinicId, 'clinica-roadmap');
    assert.equal(operator.clinicLabel, 'Clinica Roadmap');
    assert.equal(operator.scope, 'regional');

    assert.equal(kiosk.surfaceKey, 'kiosco-turnos');
    assert.equal(kiosk.surfaceLabel, 'Turnero Kiosco');

    assert.equal(display.surfaceKey, 'sala-turnos');
    assert.equal(display.surfaceLabel, 'Turnero Sala TV');
});

test('ledger and owner stores persist by clinic scope', async () => {
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-owner-store.js'
    );
    const otherClinic = buildClinicProfile({
        clinic_id: 'clinica-roadmap-2',
        branding: {
            name: 'Clinica Roadmap 2',
            short_name: 'Roadmap 2',
            city: 'Guayaquil',
        },
        region: 'costa',
    });

    const ledger = ledgerModule.createTurneroSurfaceRoadmapLedger(
        'regional',
        CLINIC_PROFILE
    );
    const otherLedger = ledgerModule.createTurneroSurfaceRoadmapLedger(
        'regional',
        otherClinic
    );
    const owners = ownerModule.createTurneroSurfaceRoadmapOwnerStore(
        'regional',
        CLINIC_PROFILE
    );
    const otherOwners = ownerModule.createTurneroSurfaceRoadmapOwnerStore(
        'regional',
        otherClinic
    );

    ledger.add({
        surfaceKey: 'operator',
        status: 'planned',
        owner: 'ops',
        priorityBand: 'p1',
        title: 'Operator lane',
        nextAction: 'stabilize-operator-lane',
        note: 'Operator backlog ready.',
    });
    owners.add({
        surfaceKey: 'operator',
        actor: 'carla',
        role: 'roadmap',
        status: 'active',
        note: 'Primary roadmap owner.',
    });

    assert.equal(ledger.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherLedger.list().length, 0);
    assert.equal(owners.list({ surfaceKey: 'operator-turnos' }).length, 1);
    assert.equal(otherOwners.list().length, 0);
});

test('gate bands and decisions follow roadmap weighting', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-gate.js'
    );

    const readyGate = module.buildTurneroSurfaceRoadmapGate({
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [
            { status: 'planned' },
            { status: 'ready' },
            { status: 'approved' },
            { status: 'done' },
        ],
        owners: [{ status: 'active' }, { status: 'active' }],
    });

    const blockedGate = module.buildTurneroSurfaceRoadmapGate({
        checklist: { summary: { all: 4, pass: 2, fail: 2 } },
        ledger: [{ status: 'watch' }],
        owners: [],
    });

    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'roadmap-ready');
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'stabilize-before-roadmap');
});

test('pack and readout expose checkpoints and normalized surface state', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-pack.js'
    );

    const pack = module.buildTurneroSurfaceRoadmapPack({
        surfaceKey: 'display',
        clinicProfile: CLINIC_PROFILE,
        runtimeState: 'ready',
        truth: 'aligned',
        roadmapBand: 'core',
        backlogState: 'curated',
        nextAction: 'analytics-board',
        priorityBand: 'p1',
        roadmapOwner: 'ops-display',
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [
            {
                surfaceKey: 'display',
                status: 'planned',
                title: 'Analytics board',
                owner: 'ops-display',
                priorityBand: 'p1',
                nextAction: 'analytics-board',
            },
        ],
        owners: [
            {
                surfaceKey: 'display',
                actor: 'ops-display',
                role: 'roadmap',
                status: 'active',
            },
        ],
    });

    assert.equal(pack.snapshot.surfaceKey, 'sala-turnos');
    assert.equal(pack.readout.surfaceLabel, 'Turnero Sala TV');
    assert.equal(pack.readout.gateBand, 'watch');
    assert.equal(pack.readout.gateDecision, 'review-next-investment');
    assert.equal(pack.readout.checkpoints.length, 4);
    assert.equal(pack.readout.checkpoints[0].label, 'priority');
    assert.match(pack.readout.brief, /Surface Roadmap Prioritization/);
});

test('banner hides when roadmap is ready and shows detail when not ready', async () => {
    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDomDocument(),
        },
        async () => {
            const module = await loadModule(
                'src/apps/queue-shared/turnero-surface-roadmap-banner.js'
            );

            const hiddenRoot = new HTMLElementStub('div');
            const visibleRoot = new HTMLElementStub('div');

            const hidden = module.mountTurneroSurfaceRoadmapBanner(hiddenRoot, {
                gate: { band: 'ready', score: 100, decision: 'roadmap-ready' },
            });
            const visible = module.mountTurneroSurfaceRoadmapBanner(visibleRoot, {
                snapshot: {
                    surfaceKey: 'operator-turnos',
                    priorityBand: 'p1',
                    roadmapOwner: 'ops-lead',
                    backlogState: 'curated',
                    nextAction: 'stabilize-operator-lane',
                },
                gate: {
                    band: 'watch',
                    score: 71.3,
                    decision: 'review-next-investment',
                },
                readout: {
                    priorityBand: 'p1',
                    roadmapOwner: 'ops-lead',
                    backlogState: 'curated',
                    nextAction: 'stabilize-operator-lane',
                    checklistPass: 3,
                    checklistAll: 4,
                    readyLedgerCount: 1,
                    ledgerCount: 1,
                    gateScore: 71.3,
                    badge: 'watch · 71.3',
                },
            });

            assert.equal(hidden, null);
            assert.equal(hiddenRoot.hidden, true);
            assert.equal(hiddenRoot.innerHTML, '');

            assert.ok(visible);
            assert.equal(visibleRoot.hidden, false);
            assert.match(visibleRoot.innerHTML, /Surface roadmap prioritization visible/);
            assert.match(visibleRoot.innerHTML, /stabilize-operator-lane/);
        }
    );
});
