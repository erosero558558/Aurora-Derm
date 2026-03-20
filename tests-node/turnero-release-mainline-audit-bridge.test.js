'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const {
    loadModule,
    buildClinicProfile,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');

async function loadFreshModule(relativePath, token = Date.now()) {
    const url = pathToFileURL(resolve(REPO_ROOT, relativePath)).href;
    return import(`${url}?t=${token}`);
}

class HTMLElementStub {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.children = [];
        this.listeners = new Map();
        this.nodes = new Map();
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this.parentNode = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.nodes.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    setAttribute(name, value) {
        const normalizedName = String(name);
        const normalizedValue = String(value);
        this.attributes.set(normalizedName, normalizedValue);
        if (normalizedName.startsWith('data-')) {
            this.dataset[normalizedName.slice(5)] = normalizedValue;
        }
    }

    getAttribute(name) {
        const normalizedName = String(name);
        if (this.attributes.has(normalizedName)) {
            return this.attributes.get(normalizedName);
        }

        if (normalizedName.startsWith('data-')) {
            const datasetKey = normalizedName.slice(5);
            return Object.prototype.hasOwnProperty.call(
                this.dataset,
                datasetKey
            )
                ? this.dataset[datasetKey]
                : null;
        }

        return null;
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
        return nodes[0] || null;
    }

    addEventListener(type, handler) {
        this.listeners.set(String(type), handler);
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new HTMLElementStub(
                key.includes('input') ? 'input' : 'span'
            );
            if (key.includes('[data-field=')) {
                node.value = '';
            }
            if (key.includes('[data-role=')) {
                node.textContent = '';
            }
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
        if (this.parentNode && Array.isArray(this.parentNode.children)) {
            this.parentNode.children = this.parentNode.children.filter(
                (child) => child !== this
            );
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

function createDocumentStub(host) {
    const body = new HTMLElementStub('body');

    return {
        body,
        createElement(tag) {
            return new HTMLElementStub(tag);
        },
        execCommand() {
            return false;
        },
        getElementById(id) {
            return String(id) === 'queueReleaseMainlineAuditBridgeHost'
                ? host
                : null;
        },
        querySelector(selector) {
            return String(selector) ===
                '[data-turnero-release-mainline-audit-bridge]'
                ? host
                : null;
        },
    };
}

async function loadStoreModule() {
    return loadModule('src/apps/admin-v3/shared/core/store.js');
}

async function loadMainlineModule() {
    return loadFreshModule(
        'src/apps/queue-shared/turnero-release-mainline-audit-bridge.js',
        'mainline-audit'
    );
}

async function loadLedgerModule() {
    return loadFreshModule(
        'src/apps/queue-shared/turnero-release-branch-delta-ledger.js',
        'mainline-audit-ledger'
    );
}

async function loadWrapperModule() {
    return loadFreshModule(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/mainline-audit-bridge.js',
        'mainline-audit-wrapper'
    );
}

function buildAlignedInput() {
    const manifestRows = [
        {
            key: 'admin-queue-core',
            label: 'Admin Queue Core',
            owner: 'ops',
            surface: 'admin-queue',
            criticality: 'critical',
        },
        {
            key: 'remote-health',
            label: 'Remote Health',
            owner: 'infra',
            surface: 'admin-queue',
            criticality: 'critical',
        },
        {
            key: 'operator-surface',
            label: 'Operator Surface',
            owner: 'ops',
            surface: 'operator-turnos',
            criticality: 'high',
        },
        {
            key: 'repo-truth',
            label: 'Repo Truth',
            owner: 'program',
            surface: 'admin-queue',
            criticality: 'high',
        },
    ];
    const actualRows = manifestRows.map((row, index) => ({
        key: row.key,
        mounted: true,
        commitRef: `commit-${index + 1}`,
        owner: row.owner,
        surface: row.surface,
    }));
    const provenance = manifestRows.map((row, index) => ({
        moduleKey: row.key,
        commitRef: `commit-${index + 1}`,
    }));
    const runtimeRows = manifestRows.map((row, index) => ({
        key: row.key,
        surface: row.surface,
        present: true,
        fingerprint: `runtime-${index + 1}`,
    }));
    const surfaces = [
        { id: 'admin-queue', label: 'Admin Queue' },
        { id: 'operator-turnos', label: 'Operator Turnos' },
    ];

    return {
        scope: 'clinica-audit',
        region: 'Guayaquil',
        clinicId: 'clinica-audit',
        clinicLabel: 'Clínica Audit',
        clinicShortName: 'Audit',
        manifestRows,
        actualRows,
        provenance,
        runtimeRows,
        surfaces,
        branchDelta: [],
    };
}

test('mainline audit pack scores a reconciled snapshot at 100', async () => {
    const module = await loadMainlineModule();
    const pack =
        module.buildTurneroReleaseMainlineAuditBridgePack(buildAlignedInput());

    assert.equal(pack.manifest.summary.all, 4);
    assert.equal(pack.manifest.summary.critical, 2);
    assert.equal(pack.reconciled.summary.all, 4);
    assert.equal(pack.reconciled.summary.reconciled, 4);
    assert.equal(pack.mountAudit.summary.all, 2);
    assert.equal(pack.mountAudit.summary.strong, 2);
    assert.equal(pack.runtimeDiff.summary.aligned, 4);
    assert.equal(pack.blockerBoard.summary.all, 0);
    assert.equal(pack.summary.openBranchDeltas, 0);
    assert.equal(pack.auditScore.score, 100);
    assert.equal(pack.auditScore.band, 'strong');
    assert.equal(pack.auditScore.decision, 'ready-for-final-diagnostic');
    assert.ok(pack.briefMarkdown.includes('Mainline Audit Bridge'));
});

test('branch delta ledger persists without localStorage', async () => {
    const ledgerModule = await loadLedgerModule();
    const previousLocalStorage = Object.getOwnPropertyDescriptor(
        global,
        'localStorage'
    );

    try {
        delete global.localStorage;

        const ledger =
            ledgerModule.createTurneroReleaseBranchDeltaLedger(
                'clinica-memory'
            );
        assert.equal(ledger.list().length, 0);

        const next = ledger.add({
            title: 'Resolve evidence gap',
            owner: 'program',
            area: 'mainline-audit',
            severity: 'medium',
            status: 'open',
        });

        assert.equal(next.title, 'Resolve evidence gap');
        assert.equal(ledger.list().length, 1);

        const secondLedger =
            ledgerModule.createTurneroReleaseBranchDeltaLedger(
                'clinica-memory'
            );
        assert.equal(secondLedger.list().length, 1);
        assert.equal(secondLedger.list()[0].area, 'mainline-audit');
    } finally {
        if (previousLocalStorage) {
            Object.defineProperty(global, 'localStorage', previousLocalStorage);
        } else {
            delete global.localStorage;
        }
    }
});

test('mainline audit bridge resolves the host and renders live snapshot data', async () => {
    const store = await loadStoreModule();
    const wrapperModule = await loadWrapperModule();
    const host = new HTMLElementStub(
        'div',
        'queueReleaseMainlineAuditBridgeHost'
    );
    const currentSnapshot = {
        ...buildAlignedInput(),
        turneroClinicProfile: buildClinicProfile({
            clinic_id: 'clinica-audit',
            branding: {
                name: 'Clínica Audit',
                short_name: 'Audit',
            },
        }),
    };
    const state = store.getState();

    setGlobalValue('HTMLElement', HTMLElementStub);
    setGlobalValue('document', createDocumentStub(host));
    try {
        store.setState({
            ...state,
            data: {
                ...state.data,
                turneroClinicProfile: currentSnapshot.turneroClinicProfile,
                turneroReleaseEvidenceBundle: currentSnapshot,
                turneroReleaseSnapshot: currentSnapshot,
                currentSnapshot,
            },
        });

        const result = wrapperModule.renderQueueMainlineAuditBridge(
            { id: 'queue' },
            'web'
        );

        assert.ok(result);
        assert.equal(host.children.length, 1);

        const root = host.children[0];
        assert.equal(root.id, 'turneroReleaseMainlineAuditBridge');
        assert.match(root.innerHTML, /Mainline Audit Bridge/);
        assert.match(root.innerHTML, /Copy mainline brief/);
        assert.match(root.innerHTML, /Download mainline JSON/);
        assert.match(root.innerHTML, /Add branch delta/);
        assert.equal(root.dataset.turneroReleaseMainlineAuditScore, '100');

        root.querySelector('[data-field="delta-title"]').value =
            'Resolve evidence gap';
        root.querySelector('[data-field="delta-owner"]').value = 'program';
        root.querySelector('[data-field="delta-area"]').value =
            'mainline-audit';

        const clickHandler = root.listeners.get('click');
        assert.equal(typeof clickHandler, 'function');
        await clickHandler({
            target: {
                getAttribute(name) {
                    return String(name) === 'data-action'
                        ? 'add-branch-delta'
                        : null;
                },
            },
        });

        assert.equal(root.dataset.turneroReleaseMainlineAuditOpenDeltas, '1');
        assert.match(root.innerHTML, /Resolve evidence gap/);
        assert.match(root.innerHTML, /Open branch deltas/);
    } finally {
        store.resetState();
        delete global.document;
        delete global.HTMLElement;
    }
});
