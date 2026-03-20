'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
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
        this.removedHandlers = [];
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

    removeEventListener(type, handler) {
        const normalizedType = String(type);
        if (this.listeners.get(normalizedType) === handler) {
            this.listeners.delete(normalizedType);
            this.removedHandlers.push(handler);
        }
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

function createDocumentStub(host) {
    const body = new HTMLElementStub('body');

    return {
        body,
        createElement(tag) {
            return new HTMLElementStub(tag);
        },
        getElementById(id) {
            return String(id) ===
                'queueReleaseFinalDiagnosisAdjudicationBinderHost'
                ? host
                : null;
        },
        querySelector(selector) {
            return String(selector) ===
                '[data-turnero-release-final-diagnosis-adjudication-binder]'
                ? host
                : null;
        },
        execCommand() {
            return false;
        },
    };
}

function loadText(relativePath) {
    return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

function buildReadyBinderFixture(
    scope = 'clinica-binder',
    generatedAt = '2026-03-18T12:00:00.000Z'
) {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-binder',
        branding: {
            name: 'Clínica Binder',
            short_name: 'Binder',
        },
    });
    const manifestItems = [
        {
            key: 'mainline-evidence',
            label: 'Mainline Evidence',
            owner: 'program',
            criticality: 'critical',
        },
        {
            key: 'runtime-alignment',
            label: 'Runtime Alignment',
            owner: 'infra',
            criticality: 'critical',
        },
        {
            key: 'surface-readiness',
            label: 'Surface Readiness',
            owner: 'ops',
            criticality: 'high',
        },
        {
            key: 'integration-trust',
            label: 'Integration Trust',
            owner: 'infra',
            criticality: 'critical',
        },
        {
            key: 'closure-completeness',
            label: 'Closure Completeness',
            owner: 'program',
            criticality: 'critical',
        },
        {
            key: 'human-review',
            label: 'Human Review',
            owner: 'program',
            criticality: 'critical',
        },
    ];
    const bundles = [
        {
            key: 'mainline-evidence',
            label: 'Mainline Evidence',
            owner: 'program',
            status: 'ready',
            artifactCount: 4,
        },
        {
            key: 'runtime-alignment',
            label: 'Runtime Alignment',
            owner: 'infra',
            status: 'ready',
            artifactCount: 2,
        },
        {
            key: 'surface-readiness',
            label: 'Surface Readiness',
            owner: 'ops',
            status: 'ready',
            artifactCount: 3,
        },
        {
            key: 'closure-completeness',
            label: 'Closure Completeness',
            owner: 'program',
            status: 'ready',
            artifactCount: 2,
        },
    ];
    const blockers = [];
    const signoffs = [
        { reviewer: 'Ana', verdict: 'approve', note: 'Aligned' },
        { reviewer: 'Beto', verdict: 'approve', note: 'Aligned' },
    ];
    const releaseEvidenceBundle = {
        generatedAt,
        clinicId: 'clinica-binder',
        clinicLabel: 'Clínica Binder',
        clinicShortName: 'Binder',
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        manifestItems,
        bundles,
        blockers,
        signoffs,
    };
    const currentSnapshot = {
        generatedAt,
        clinicId: 'clinica-binder',
        clinicLabel: 'Clínica Binder',
        clinicName: 'Clínica Binder',
        brandName: 'Binder',
        turneroClinicProfile: clinicProfile,
        clinicProfile,
        releaseEvidenceBundle,
        manifestItems,
        bundles,
        blockers,
        signoffs,
    };

    return {
        scope,
        generatedAt,
        clinicProfile,
        releaseEvidenceBundle,
        currentSnapshot,
        manifestItems,
        bundles,
        blockers,
        signoffs,
    };
}

async function withGlobals(setup, callback) {
    const previous = {};

    for (const key of Object.keys(setup)) {
        previous[key] = global[key];
        Object.defineProperty(global, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            value: setup[key],
        });
    }

    try {
        return await callback();
    } finally {
        for (const key of Object.keys(setup)) {
            const value = previous[key];
            if (value === undefined) {
                delete global[key];
            } else {
                Object.defineProperty(global, key, {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value,
                });
            }
        }
    }
}

async function loadQueueSharedModule() {
    return loadFreshModule(
        'src/apps/queue-shared/turnero-release-final-diagnosis-adjudication-binder.js',
        'turnero-final-diagnosis-binder'
    );
}

async function loadSignoffStoreModule() {
    return loadFreshModule(
        'src/apps/queue-shared/turnero-release-review-panel-signoff-store.js',
        'turnero-review-panel-signoff-store'
    );
}

async function loadWrapperModule() {
    return loadFreshModule(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/final-diagnosis-adjudication-binder.js',
        'turnero-final-diagnosis-binder-wrapper'
    );
}

test('final diagnosis adjudication binder pack builds a ready release snapshot', async () => {
    const module = await loadQueueSharedModule();
    const fixture = buildReadyBinderFixture('clinica-ready-pack');
    const pack = module.buildTurneroReleaseFinalDiagnosisAdjudicationBinderPack(
        {
            scope: fixture.scope,
            clinicProfile: fixture.clinicProfile,
            currentSnapshot: fixture.currentSnapshot,
            releaseEvidenceBundle: fixture.releaseEvidenceBundle,
            manifestItems: fixture.manifestItems,
            bundles: fixture.bundles,
            blockers: fixture.blockers,
            signoffs: fixture.signoffs,
            generatedAt: fixture.generatedAt,
            downloadFileName:
                'turnero-release-final-diagnosis-adjudication-binder.json',
            detectedPlatform: 'web',
        }
    );

    assert.equal(pack.manifest.summary.all, 6);
    assert.equal(pack.bundleRegistry.summary.ready, 4);
    assert.equal(pack.matrix.summary.supported, 6);
    assert.equal(pack.matrix.summary.blocked, 0);
    assert.equal(pack.disposition.disposition, 'adjudicated-green');
    assert.equal(pack.binderScore.score, 100);
    assert.equal(pack.binderScore.band, 'ready');
    assert.equal(pack.binderScore.decision, 'deliver-final-binder');
    assert.match(pack.briefMarkdown, /Final Diagnosis Adjudication Binder/);
    assert.match(pack.briefMarkdown, /Binder score: 100 \(ready\)/);
    assert.match(pack.briefMarkdown, /Disposition: adjudicated-green/);
    assert.doesNotThrow(() => JSON.stringify(pack.snapshot));
});

test('review panel signoff store persists when localStorage is unavailable', async () => {
    const module = await loadSignoffStoreModule();
    const originalDescriptor = Object.getOwnPropertyDescriptor(
        global,
        'localStorage'
    );

    try {
        delete global.localStorage;

        const store = module.createTurneroReleaseReviewPanelSignoffStore(
            'clinica-memory-store',
            [{ reviewer: 'Seed', verdict: 'review', note: 'seeded' }]
        );

        assert.equal(store.list().length, 1);

        const added = store.add({
            reviewer: 'Ana',
            verdict: 'approve',
            note: 'Aligned',
        });

        assert.equal(added.verdict, 'approve');

        const secondStore = module.createTurneroReleaseReviewPanelSignoffStore(
            'clinica-memory-store'
        );

        assert.equal(secondStore.list().length, 2);
        assert.equal(secondStore.list()[0].reviewer, 'Ana');
    } finally {
        if (originalDescriptor) {
            Object.defineProperty(global, 'localStorage', originalDescriptor);
        } else {
            delete global.localStorage;
        }
    }
});

test('mountTurneroReleaseFinalDiagnosisAdjudicationBinder rerenders without duplicating the host DOM', async () => {
    const module = await loadQueueSharedModule();
    const fixture = buildReadyBinderFixture('clinica-rerender');
    const host = new HTMLElementStub(
        'div',
        'queueReleaseFinalDiagnosisAdjudicationBinderHost'
    );

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host),
            navigator: {
                clipboard: {
                    async writeText() {
                        return true;
                    },
                },
            },
        },
        async () => {
            const first =
                module.mountTurneroReleaseFinalDiagnosisAdjudicationBinder(
                    host,
                    {
                        scope: fixture.scope,
                        clinicProfile: fixture.clinicProfile,
                        currentSnapshot: fixture.currentSnapshot,
                        releaseEvidenceBundle: fixture.releaseEvidenceBundle,
                        manifestItems: fixture.manifestItems,
                        bundles: fixture.bundles,
                        blockers: fixture.blockers,
                        signoffs: fixture.signoffs,
                        detectedPlatform: 'web',
                    }
                );

            assert.ok(first);
            assert.equal(host.children.length, 1);
            assert.equal(
                first.root.id,
                'turneroReleaseFinalDiagnosisAdjudicationBinder'
            );
            assert.equal(
                first.root.dataset
                    .turneroReleaseFinalDiagnosisAdjudicationBinderScore,
                '100'
            );
            assert.match(first.root.innerHTML, /Copy binder brief/);
            assert.match(first.root.innerHTML, /Download binder JSON/);
            assert.match(first.root.innerHTML, /Add signoff/);

            const second =
                module.mountTurneroReleaseFinalDiagnosisAdjudicationBinder(
                    host,
                    {
                        scope: fixture.scope,
                        clinicProfile: fixture.clinicProfile,
                        currentSnapshot: fixture.currentSnapshot,
                        releaseEvidenceBundle: fixture.releaseEvidenceBundle,
                        manifestItems: fixture.manifestItems,
                        bundles: fixture.bundles,
                        blockers: fixture.blockers,
                        signoffs: fixture.signoffs,
                        detectedPlatform: 'web',
                    }
                );

            assert.ok(second);
            assert.equal(host.children.length, 1);
            assert.equal(host.children[0], second.root);
            assert.equal(host.removedHandlers.length, 1);
            assert.equal(typeof host.listeners.get('click'), 'function');
        }
    );
});

test('admin wrapper resolves the queue host and the source wiring is present', async () => {
    const store = await loadModule('src/apps/admin-v3/shared/core/store.js');
    const wrapperModule = await loadWrapperModule();
    const fixture = buildReadyBinderFixture('clinica-wrapper');
    const host = new HTMLElementStub(
        'div',
        'queueReleaseFinalDiagnosisAdjudicationBinderHost'
    );

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host),
        },
        async () => {
            const state = store.getState();
            store.setState({
                ...state,
                data: {
                    ...state.data,
                    turneroClinicProfile: fixture.clinicProfile,
                    turneroReleaseEvidenceBundle: fixture.releaseEvidenceBundle,
                    turneroReleaseSnapshot: fixture.currentSnapshot,
                    currentSnapshot: fixture.currentSnapshot,
                },
            });

            const result =
                wrapperModule.renderQueueFinalDiagnosisAdjudicationBinder(
                    { id: 'queue' },
                    'web'
                );

            assert.ok(result);
            assert.equal(host.children.length, 1);
            assert.equal(
                host.children[0].id,
                'turneroReleaseFinalDiagnosisAdjudicationBinder'
            );
            assert.equal(
                host.children[0].dataset
                    .turneroReleaseFinalDiagnosisAdjudicationBinderScore,
                '100'
            );
            assert.match(
                host.children[0].innerHTML,
                /Final Diagnosis Adjudication Binder/
            );
        }
    );

    try {
        const wrapperSource = loadText(
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/final-diagnosis-adjudication-binder.js'
        );
        const installHubSource = loadText(
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
        );
        const headerSource = loadText(
            'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
        );

        assert.match(
            wrapperSource,
            /mountTurneroReleaseFinalDiagnosisAdjudicationBinder/
        );
        assert.match(
            wrapperSource,
            /buildQueueFinalDiagnosisAdjudicationBinderContext/
        );
        assert.match(
            installHubSource,
            /queueReleaseFinalDiagnosisAdjudicationBinderHost/
        );
        assert.match(
            installHubSource,
            /renderQueueFinalDiagnosisAdjudicationBinder\(manifest, detectedPlatform\);/
        );
        assert.match(
            headerSource,
            /queueReleaseFinalDiagnosisAdjudicationBinderHost/
        );
        assert.match(
            headerSource,
            /data-turnero-release-final-diagnosis-adjudication-binder/
        );
    } finally {
        store.resetState();
    }
});
