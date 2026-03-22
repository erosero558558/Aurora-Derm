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

class FakeElement {
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
        this.hidden = false;
        this.value = '';
        this.clicked = false;
        this.parentElement = null;
        this._innerHTML = '';
        this._textContent = '';
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
        if (normalizedName === 'id') {
            this.id = normalizedValue;
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
        if (normalizedName === 'id') {
            return this.id || null;
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
        if (normalizedName === 'id') {
            this.id = '';
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
        const normalizedType = String(type || '');
        if (this.listeners.get(normalizedType) === handler) {
            this.listeners.delete(normalizedType);
        }
    }

    dispatchEvent(event) {
        const normalizedType = String(event?.type || '');
        const listener = this.listeners.get(normalizedType);
        if (typeof listener === 'function') {
            listener.call(this, event);
        }
        return true;
    }

    click() {
        this.clicked = true;
        this.dispatchEvent({
            type: 'click',
            target: this,
            currentTarget: this,
            preventDefault() {},
            stopPropagation() {},
        });
    }

    closest(selector) {
        const normalizedSelector = String(selector || '');
        if (
            (normalizedSelector === '[data-action]' ||
                normalizedSelector === 'form[data-action]') &&
            this.dataset.action
        ) {
            return this;
        }

        return null;
    }

    querySelector(selector) {
        const normalizedSelector = String(selector || '');
        if (!this.nodes.has(normalizedSelector)) {
            this.nodes.set(
                normalizedSelector,
                this.createNodeForSelector(normalizedSelector)
            );
        }

        return this.nodes.get(normalizedSelector);
    }

    createNodeForSelector(selector) {
        const normalizedSelector = String(selector || '');
        let tagName = 'div';

        if (normalizedSelector.includes('[data-role="brief"]')) {
            tagName = 'pre';
        } else if (normalizedSelector.includes('[data-field="')) {
            tagName = normalizedSelector.includes('textarea') ? 'textarea' : 'input';
        } else if (
            normalizedSelector.includes('form[data-action]') ||
            normalizedSelector.includes('[data-action="')
        ) {
            tagName = normalizedSelector.includes('form[data-action]')
                ? 'form'
                : 'button';
        } else if (normalizedSelector.includes('[data-role="chips"]')) {
            tagName = 'div';
        } else if (normalizedSelector.includes('[data-role="banner"]')) {
            tagName = 'div';
        } else if (normalizedSelector.includes('[data-surface-key="')) {
            tagName = 'article';
        }

        const node = new FakeElement(tagName);

        if (normalizedSelector.includes('[data-surface-key="')) {
            const match = normalizedSelector.match(/\[data-surface-key="([^"]+)"\]/);
            if (match) {
                node.dataset.surfaceKey = match[1];
            }
        }

        if (normalizedSelector.includes('[data-action="')) {
            const match = normalizedSelector.match(/\[data-action="([^"]+)"\]/);
            if (match) {
                node.dataset.action = match[1];
            }
        }

        return node;
    }

    remove() {
        if (this.parentElement) {
            this.parentElement.children = this.parentElement.children.filter(
                (child) => child !== this
            );
            this.parentElement = null;
        }
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

function createDocumentStub(host, downloadClicks = [], downloadEvents = []) {
    const head = new FakeElement('head', 'head');
    const body = new FakeElement('body', 'body');

    return {
        head,
        body,
        createElement(tagName) {
            if (String(tagName || '').toLowerCase() === 'a') {
                const anchor = new FakeElement('a');
                anchor.click = () => {
                    anchor.clicked = true;
                    downloadEvents.push({
                        kind: 'anchor-click',
                        download: anchor.download,
                    });
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                        rel: anchor.rel,
                        clicked: true,
                    });
                };
                return anchor;
            }

            return new FakeElement(tagName);
        },
        getElementById(id) {
            return String(id) === String(host?.id) ? host : null;
        },
        querySelector() {
            return null;
        },
    };
}

function createActionButton(action) {
    const button = new FakeElement('button');
    button.dataset.action = action;
    return button;
}

function createActionForm(action) {
    const form = new FakeElement('form');
    form.dataset.action = action;
    return form;
}

function setFieldValue(form, selector, value) {
    form.querySelector(selector).value = value;
}

function buildClinic() {
    return buildClinicProfile({
        clinic_id: 'clinica-review',
        branding: {
            name: 'Clinica Review',
            short_name: 'Review',
            city: 'Quito',
        },
        region: 'sierra',
        surfaces: {
            admin: {
                label: 'Queue Admin',
                route: '/admin.html#queue',
            },
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
}

function buildSnapshots() {
    return [
        {
            surfaceKey: 'operator-turnos',
            runtimeState: 'ready',
            truth: 'watch',
            portfolioBand: 'core',
            priorityBand: 'p1',
            decisionState: 'watch',
            reviewWindow: 'mensual',
            reviewOwner: 'ops-lead',
            checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        },
        {
            surfaceKey: 'kiosco-turnos',
            runtimeState: 'ready',
            truth: 'watch',
            portfolioBand: 'watch',
            priorityBand: 'p2',
            decisionState: 'pending',
            reviewWindow: '',
            reviewOwner: '',
            checklist: { summary: { all: 4, pass: 2, fail: 2 } },
        },
        {
            surfaceKey: 'sala-turnos',
            runtimeState: 'ready',
            truth: 'aligned',
            portfolioBand: 'core',
            priorityBand: 'p1',
            decisionState: 'approved',
            reviewWindow: 'mensual',
            reviewOwner: 'ops-display',
            checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        },
    ];
}

function buildLedgerEntries() {
    return [
        {
            surfaceKey: 'operator-turnos',
            kind: 'review',
            status: 'approved',
            title: 'Operator ready',
            owner: 'ops-lead',
            updatedAt: '2026-03-20T09:00:00.000Z',
        },
        {
            surfaceKey: 'operator',
            kind: 'review-item',
            status: 'watch',
            title: 'Operator watch',
            owner: 'ops-lead',
            updatedAt: '2026-03-20T10:00:00.000Z',
        },
        {
            surfaceKey: 'operator',
            kind: 'review-item',
            status: 'watch',
            title: 'Operator latest',
            owner: 'ops-lead',
            updatedAt: '2026-03-20T11:00:00.000Z',
        },
    ];
}

function buildOwnerEntries() {
    return [
        {
            surfaceKey: 'operator-turnos',
            actor: 'ana',
            role: 'executive-review',
            status: 'active',
            note: 'Lead owner',
            updatedAt: '2026-03-20T09:00:00.000Z',
        },
        {
            surfaceKey: 'operator',
            actor: 'maria',
            role: 'executive-review',
            status: 'paused',
            note: 'Backup owner',
            updatedAt: '2026-03-20T10:00:00.000Z',
        },
    ];
}

test('snapshot and readout normalize aliases and expose checkpoint shape', async () => {
    const [snapshotMod, gateMod, readoutMod] = await Promise.all([
        loadModule('src/apps/queue-shared/turnero-surface-executive-review-snapshot.js'),
        loadModule('src/apps/queue-shared/turnero-surface-executive-review-gate.js'),
        loadModule('src/apps/queue-shared/turnero-surface-executive-review-readout.js'),
    ]);

    const clinicProfile = buildClinic();
    const snapshot = snapshotMod.buildTurneroSurfaceExecutiveReviewSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile,
        scope: 'regional',
    });

    assert.equal(snapshot.surfaceKey, 'operator-turnos');
    assert.equal(snapshot.surfaceProfileKey, 'operator');
    assert.equal(snapshot.surfaceLabel, 'Turnero Operador');
    assert.equal(snapshot.route, '/operador-turnos.html');
    assert.equal(snapshot.clinicId, 'clinica-review');
    assert.equal(snapshot.clinicLabel, 'Clinica Review');

    const gate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
        snapshot,
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [
            { status: 'ready' },
            { status: 'ready' },
            { status: 'ready' },
        ],
        owners: [{ status: 'active', actor: 'ana', role: 'executive-review' }],
    });

    assert.equal(gate.band, 'ready');
    assert.equal(gate.decision, 'approve-executive-review');
    assert.equal(gate.reviewItemCount, 3);
    assert.equal(gate.activeOwnerCount, 1);

    const readout = readoutMod.buildTurneroSurfaceExecutiveReviewReadout({
        snapshot,
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [
            {
                id: 'one',
                surfaceKey: 'operator',
                kind: 'review',
                status: 'approved',
                title: 'Executive item',
                owner: 'ana',
                updatedAt: '2026-03-20T09:00:00.000Z',
            },
            {
                id: 'two',
                surfaceKey: 'operator',
                kind: 'review-item',
                status: 'watch',
                title: 'Follow-up item',
                owner: 'ana',
                updatedAt: '2026-03-20T10:00:00.000Z',
            },
            {
                id: 'three',
                surfaceKey: 'operator',
                kind: 'review-item',
                status: 'watch',
                title: 'Latest item',
                owner: 'ana',
                updatedAt: '2026-03-20T11:00:00.000Z',
            },
        ],
        owners: [
            {
                id: 'owner-1',
                surfaceKey: 'operator',
                actor: 'ana',
                role: 'executive-review',
                status: 'active',
                note: 'Lead owner',
            },
        ],
        gate,
    });

    assert.deepEqual(
        readout.checkpoints.map((checkpoint) => checkpoint.label),
        ['priority', 'review', 'score']
    );
    assert.equal(readout.reviewItemCount, 3);
    assert.equal(readout.activeOwnerCount, 1);
    assert.equal(readout.latestReviewItem.title, 'Latest item');
    assert.match(readout.brief, /# Surface Executive Review/);
});

test('ledger and owner stores remain clinic-scoped and normalize status', async () => {
    const ledgerMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-ledger.js'
    );
    const ownerMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-owner-store.js'
    );

    const clinicA = buildClinicProfile({
        clinic_id: 'clinica-review-a',
        branding: {
            name: 'Clinica Review A',
            short_name: 'Review A',
            city: 'Quito',
        },
    });
    const clinicB = buildClinicProfile({
        clinic_id: 'clinica-review-b',
        branding: {
            name: 'Clinica Review B',
            short_name: 'Review B',
            city: 'Guayaquil',
        },
    });

    const ledgerA = ledgerMod.createTurneroSurfaceExecutiveReviewLedger(
        'regional',
        clinicA
    );
    const ledgerB = ledgerMod.createTurneroSurfaceExecutiveReviewLedger(
        'regional',
        clinicB
    );
    const ownerA = ownerMod.createTurneroSurfaceExecutiveReviewOwnerStore(
        'regional',
        clinicA
    );
    const ownerB = ownerMod.createTurneroSurfaceExecutiveReviewOwnerStore(
        'regional',
        clinicB
    );

    ledgerA.add({
        surfaceKey: 'operator-turnos',
        kind: 'review',
        status: 'approved',
        title: 'A ready',
        owner: 'ops-a',
    });
    ledgerA.add({
        surfaceKey: 'operator',
        kind: 'review-item',
        status: 'watch',
        title: 'A watch',
        owner: 'ops-a',
    });
    ledgerB.add({
        surfaceKey: 'kiosco-turnos',
        kind: 'review-item',
        status: 'draft',
        title: 'B draft',
        owner: 'ops-b',
    });

    ownerA.add({
        surfaceKey: 'operator-turnos',
        actor: 'ana',
        role: 'executive-review',
        status: 'active',
        note: 'Lead owner',
    });
    ownerA.add({
        surfaceKey: 'operator',
        actor: 'maria',
        role: 'executive-review',
        status: 'paused',
        note: 'Backup owner',
    });
    ownerB.add({
        surfaceKey: 'kiosk',
        actor: 'beto',
        role: 'executive-review',
        status: 'active',
        note: 'Kiosk owner',
    });

    assert.equal(ledgerA.list({ surfaceKey: 'operator' }).length, 2);
    assert.equal(ledgerA.list({ surfaceKey: 'operator', status: 'ready' }).length, 1);
    assert.equal(ledgerA.list({ surfaceKey: 'operator-turnos', status: 'watch' }).length, 1);
    assert.equal(ledgerB.list({ surfaceKey: 'kiosk' }).length, 1);
    assert.equal(ledgerB.list({ surfaceKey: 'operator' }).length, 0);

    assert.equal(ownerA.list({ surfaceKey: 'operator' }).length, 2);
    assert.equal(ownerA.list({ surfaceKey: 'operator', status: 'active' }).length, 1);
    assert.equal(ownerA.list({ surfaceKey: 'operator-turnos', status: 'paused' }).length, 1);
    assert.equal(ownerB.list({ surfaceKey: 'kiosk' }).length, 1);
    assert.equal(ownerB.list({ surfaceKey: 'operator' }).length, 0);
});

test('gate thresholds classify ready watch degraded and blocked', async () => {
    const snapshotMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-snapshot.js'
    );
    const gateMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-gate.js'
    );
    const clinicProfile = buildClinic();
    const snapshot = snapshotMod.buildTurneroSurfaceExecutiveReviewSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile,
        scope: 'regional',
    });

    const readyGate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
        snapshot,
        checklist: { summary: { all: 4, pass: 4, fail: 0 } },
        ledger: [{ status: 'ready' }, { status: 'ready' }, { status: 'ready' }],
        owners: [{ status: 'active', actor: 'ana' }],
    });
    assert.equal(readyGate.band, 'ready');
    assert.equal(readyGate.decision, 'approve-executive-review');

    const watchGate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
        snapshot,
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [{ status: 'watch' }, { status: 'watch' }, { status: 'watch' }],
        owners: [{ status: 'active', actor: 'ana' }],
    });
    assert.equal(watchGate.band, 'watch');
    assert.equal(watchGate.decision, 'review-executive-feedback');

    const degradedGate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
        snapshot,
        checklist: { summary: { all: 4, pass: 2, fail: 1 } },
        ledger: [{ status: 'watch' }],
        owners: [{ status: 'active', actor: 'ana' }],
    });
    assert.equal(degradedGate.band, 'degraded');
    assert.equal(degradedGate.decision, 'stabilize-executive-review');

    const blockedGate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
        snapshot,
        checklist: { summary: { all: 4, pass: 1, fail: 2 } },
        ledger: [{ status: 'watch' }],
        owners: [{ status: 'active', actor: 'ana' }],
    });
    assert.equal(blockedGate.band, 'blocked');
    assert.equal(blockedGate.decision, 'hold-executive-review');
});

test('banner hides when ready and renders when under watch', async () => {
    const snapshotMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-snapshot.js'
    );
    const gateMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-gate.js'
    );
    const readoutMod = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-readout.js'
    );

    const clinicProfile = buildClinic();
    const snapshot = snapshotMod.buildTurneroSurfaceExecutiveReviewSnapshot({
        surfaceKey: 'operator-turnos',
        clinicProfile,
        scope: 'regional',
    });

    const watchGate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
        snapshot,
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [{ status: 'watch' }, { status: 'watch' }],
        owners: [{ status: 'active', actor: 'ana' }],
    });
    const watchReadout = readoutMod.buildTurneroSurfaceExecutiveReviewReadout({
        snapshot,
        checklist: { summary: { all: 4, pass: 3, fail: 1 } },
        ledger: [{ status: 'watch' }, { status: 'watch' }],
        owners: [{ status: 'active', actor: 'ana' }],
        gate: watchGate,
    });

    await withGlobals(
        {
            HTMLElement: FakeElement,
            document: createDocumentStub(new FakeElement('div', 'bannerHost')),
        },
        async () => {
            const bannerMod = await loadModule(
                'src/apps/queue-shared/turnero-surface-executive-review-banner.js'
            );
            const host = new FakeElement('div', 'watchBannerHost');
            const result = bannerMod.mountTurneroSurfaceExecutiveReviewBanner(host, {
                snapshot,
                gate: watchGate,
                readout: watchReadout,
            });

            assert.ok(result);
            assert.equal(host.hidden, false);
            assert.equal(host.dataset.state, 'warning');
            assert.equal(host.dataset.band, 'watch');
            assert.equal(host.dataset.decision, 'review-executive-feedback');
            assert.match(host.innerHTML, /turnero-surface-executive-review-banner/);

            const watchHtml = bannerMod.buildTurneroSurfaceExecutiveReviewBannerHtml(
                {
                    snapshot,
                    gate: watchGate,
                    readout: watchReadout,
                }
            );
            assert.match(watchHtml, /turnero-surface-executive-review-banner/);
            assert.match(watchHtml, /data-band="watch"/);

            const readyGate = gateMod.buildTurneroSurfaceExecutiveReviewGate({
                snapshot,
                checklist: { summary: { all: 4, pass: 4, fail: 0 } },
                ledger: [{ status: 'ready' }, { status: 'ready' }, { status: 'ready' }],
                owners: [{ status: 'active', actor: 'ana' }],
            });
            const readyReadout = readoutMod.buildTurneroSurfaceExecutiveReviewReadout({
                snapshot,
                checklist: { summary: { all: 4, pass: 4, fail: 0 } },
                ledger: [{ status: 'ready' }, { status: 'ready' }, { status: 'ready' }],
                owners: [{ status: 'active', actor: 'ana' }],
                gate: readyGate,
            });
            const readyHtml = bannerMod.buildTurneroSurfaceExecutiveReviewBannerHtml({
                snapshot,
                gate: readyGate,
                readout: readyReadout,
            });
            assert.equal(readyHtml, '');

            const readyHost = new FakeElement('div', 'readyBannerHost');
            const readyResult = bannerMod.mountTurneroSurfaceExecutiveReviewBanner(
                readyHost,
                {
                    snapshot,
                    gate: readyGate,
                    readout: readyReadout,
                }
            );
            assert.equal(readyResult, null);
            assert.equal(readyHost.hidden, true);
            assert.equal(readyHost.innerHTML, '');
            assert.equal(readyHost.dataset.state, undefined);
            assert.equal(readyHost.dataset.band, undefined);
            assert.equal(readyHost.dataset.decision, undefined);
        }
    );
});
