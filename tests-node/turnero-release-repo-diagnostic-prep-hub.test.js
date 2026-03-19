'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadRepoDiagnosticPrepHubModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-repo-diagnostic-prep-hub.js'
    );
}

class HTMLElementStub {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this.nodes = new Map();
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this.parentNode = null;
        this._innerHTML = '';
        this.download = '';
        this.href = '';
        this.rel = '';
        this.clicked = false;
        this.removed = false;
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.children = [];
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
            let node;
            if (key === '#turneroReleaseRepoDiagnosticPrepHub') {
                node = new HTMLElementStub(
                    'section',
                    'turneroReleaseRepoDiagnosticPrepHub'
                );
            } else if (key.startsWith('#')) {
                node = new HTMLElementStub('div', key.slice(1));
            } else {
                node = new HTMLElementStub(
                    key.includes('input') || key.includes('textarea')
                        ? 'input'
                        : 'span'
                );
            }

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

    focus() {
        this.focused = true;
    }

    select() {
        this.selected = true;
    }

    click() {
        this.clicked = true;
    }

    remove() {
        this.removed = true;
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

async function withGlobals(setup, callback) {
    const previous = {};

    for (const [key, value] of Object.entries(setup)) {
        previous[key] = Object.getOwnPropertyDescriptor(global, key);
        setGlobalValue(key, value);
    }

    try {
        return await callback();
    } finally {
        for (const [key, descriptor] of Object.entries(previous)) {
            if (!descriptor) {
                delete global[key];
                continue;
            }

            Object.defineProperty(global, key, descriptor);
        }
    }
}

function createActionTarget(action) {
    return {
        closest() {
            return null;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(downloadClicks) {
    const body = new HTMLElementStub('body');

    return {
        body,
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new HTMLElementStub('a');
                anchor.click = () => {
                    anchor.clicked = true;
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
        execCommand() {
            return false;
        },
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
    };
}

function buildRepoDiagnosticInputs() {
    const domains = [
        {
            key: 'governance',
            label: 'Governance',
            owner: 'program',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'assurance',
            label: 'Assurance',
            owner: 'program',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'reliability',
            label: 'Reliability',
            owner: 'infra',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'service',
            label: 'Service Excellence',
            owner: 'ops',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'privacy',
            label: 'Safety Privacy',
            owner: 'governance',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'integration',
            label: 'Integration',
            owner: 'infra',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'telemetry',
            label: 'Telemetry',
            owner: 'ops',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'strategy',
            label: 'Strategy',
            owner: 'program',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
        {
            key: 'orchestration',
            label: 'Orchestration',
            owner: 'ops',
            mounted: true,
            surface: 'admin-queue',
            maturity: 'active',
        },
    ];
    const surfaces = [
        {
            id: 'admin-queue',
            label: 'Admin Queue',
            domains: [
                'governance',
                'assurance',
                'reliability',
                'service',
                'privacy',
                'integration',
                'telemetry',
                'strategy',
                'orchestration',
            ],
        },
        {
            id: 'operator-turnos',
            label: 'Operator Turnos',
            domains: ['service', 'integration', 'reliability'],
        },
        {
            id: 'kiosco-turnos',
            label: 'Kiosco Turnos',
            domains: ['service', 'integration'],
        },
        {
            id: 'sala-turnos',
            label: 'Sala Turnos',
            domains: ['service', 'integration'],
        },
    ];
    const signals = [
        {
            id: 'sig-1',
            domain: 'integration',
            owner: 'infra',
            label: 'Public sync freshness drift',
            route: 'owner-workbench',
        },
        {
            id: 'sig-2',
            domain: 'integration',
            owner: 'infra',
            label: 'Public sync freshness drift',
            route: 'war-room',
        },
        {
            id: 'sig-3',
            domain: 'service',
            owner: 'ops',
            label: 'Change saturation in cohort B',
            route: 'owner-workbench',
        },
        {
            id: 'sig-4',
            domain: 'governance',
            owner: 'program',
            label: 'Board actions overdue',
            route: 'backlog',
        },
    ];

    return { domains, surfaces, signals };
}

test('builders score registry, inventory, coverage, duplicates and brief', async () => {
    const module = await loadRepoDiagnosticPrepHubModule();
    const storage = createLocalStorageStub();

    await withGlobals({ localStorage: storage }, async () => {
        const { domains, surfaces, signals } = buildRepoDiagnosticInputs();
        const registry = module.buildTurneroReleaseDomainRegistry({ domains });
        assert.equal(registry.summary.all, 9);
        assert.equal(registry.summary.mounted, 9);
        assert.equal(registry.summary.active, 9);

        const inventory = module.buildTurneroReleaseIntegrationInventory({
            registryRows: registry.rows,
            surfaces,
        });
        assert.equal(inventory.summary.present, 9);
        assert.equal(inventory.summary.partial, 0);
        assert.equal(inventory.summary.missing, 0);

        const coverage = module.buildTurneroReleaseWireCoverageMatrix({
            surfaces,
            inventoryRows: inventory.rows,
        });
        assert.equal(coverage.rows.length, 4);
        assert.equal(coverage.rows[0].coveragePct, 100);
        assert.equal(coverage.rows[1].state, 'partial');

        const duplicates = module.buildTurneroReleaseDuplicateSignalDetector({
            signals,
        });
        assert.equal(duplicates.summary.all, 1);
        assert.equal(duplicates.rows[0].count, 2);

        const gapLedger = module.createTurneroReleaseGapLedger('clinic-a');
        gapLedger.add({
            title: 'Missing repo signal',
            domain: 'integration',
            owner: 'infra',
            surface: 'admin-queue',
        });
        const gaps = gapLedger.list();
        assert.equal(gaps.length, 1);

        const convergence = module.buildTurneroReleaseConvergenceScore({
            registrySummary: registry.summary,
            inventorySummary: inventory.summary,
            coverageRows: coverage.rows,
            duplicateSummary: duplicates.summary,
            gaps,
        });
        assert.equal(convergence.band, 'stable');
        assert.equal(convergence.decision, 'diagnostic_ready');

        const brief = module.buildTurneroReleaseDiagnosticBrief({
            clinicLabel: 'Clínica Repo',
            region: 'north',
            scope: 'clinic-a',
            convergence,
            inventorySummary: inventory.summary,
            duplicateSummary: duplicates.summary,
            gaps,
            coverageRows: coverage.rows,
        });
        assert.match(brief.markdown, /Repo Diagnostic Prep Hub/);
        assert.match(brief.markdown, /Clinic: Clínica Repo/);
        assert.match(brief.markdown, /Scope: clinic-a/);
        assert.match(brief.markdown, /Open gaps: 1/);
        assert.match(brief.markdown, /Lowest coverage surface:/);

        const dump = storage.dump();
        const ledgerDump = JSON.parse(dump['turnero-release-gap-ledger:v1']);
        assert.deepEqual(Object.keys(ledgerDump), ['clinic-a']);
    });
});

test('mount renders controls, copies the brief and keeps gap scopes isolated', async () => {
    const module = await loadRepoDiagnosticPrepHubModule();
    const storage = createLocalStorageStub();
    const clipboard = [];
    const downloadClicks = [];
    const blobs = [];

    class BlobStub {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    }

    const documentStub = createDocumentStub(downloadClicks);
    const navigatorStub = {
        clipboard: {
            writeText: async (text) => {
                clipboard.push(text);
            },
        },
    };
    const URLStub = {
        createObjectURL(blob) {
            blobs.push(blob);
            return 'blob:turnero-release-repo-diagnostic-prep-hub';
        },
        revokeObjectURL() {},
    };
    const targetClinic = new HTMLElementStub('div');
    const targetRegion = new HTMLElementStub('div');
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinic-a',
        region: 'north',
        branding: {
            name: 'Clínica Repo A',
            short_name: 'Repo A',
        },
    });
    const regionProfile = buildClinicProfile({
        clinic_id: ' ',
        region: 'north',
        branding: {
            name: 'Clínica Norte',
            short_name: 'Norte',
        },
    });

    await withGlobals(
        {
            localStorage: storage,
            navigator: navigatorStub,
            document: documentStub,
            Blob: BlobStub,
            URL: URLStub,
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            HTMLInputElement: HTMLElementStub,
            HTMLTextAreaElement: HTMLElementStub,
            setTimeout: (fn) => {
                if (typeof fn === 'function') {
                    fn();
                }
                return 0;
            },
        },
        async () => {
            const mountedClinic =
                module.mountTurneroReleaseRepoDiagnosticPrepHub(targetClinic, {
                    scope: 'clinic-a',
                    region: 'north',
                    clinicId: 'clinic-a',
                    turneroClinicProfile: clinicProfile,
                    clinicProfile,
                });

            assert.ok(mountedClinic);
            assert.equal(targetClinic.children.length, 1);
            assert.equal(targetClinic.children[0], mountedClinic.root);
            assert.equal(
                mountedClinic.root.className,
                'turnero-release-repo-diagnostic-prep-hub-root'
            );
            assert.match(
                mountedClinic.root.innerHTML,
                /Repo Diagnostic Prep Hub/
            );
            assert.match(mountedClinic.root.innerHTML, /Copy diagnostic brief/);
            assert.match(
                mountedClinic.root.innerHTML,
                /Download diagnostic JSON/
            );
            assert.match(
                mountedClinic.root.innerHTML,
                /data-turnero-scope="clinic-a"/
            );
            assert.match(mountedClinic.root.innerHTML, /data-band="stable"/);
            assert.match(mountedClinic.root.innerHTML, /Clínica Repo A/);

            await mountedClinic.root.listeners.get('click')({
                target: createActionTarget('copy-diagnostic-brief'),
            });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /# Repo Diagnostic Prep Hub/);
            assert.match(clipboard[0], /Scope: clinic-a/);
            assert.match(clipboard[0], /Clinic: Clínica Repo A/);

            await mountedClinic.root.listeners.get('click')({
                target: createActionTarget('download-diagnostic-json'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-repo-diagnostic-pack.json'
            );
            assert.equal(downloadClicks[0].clicked, true);
            assert.equal(blobs.length, 1);
            const downloadedSnapshot = JSON.parse(blobs[0].parts[0]);
            assert.equal(downloadedSnapshot.scope, 'clinic-a');
            assert.equal(downloadedSnapshot.convergence.band, 'stable');
            assert.equal(downloadedSnapshot.registry.summary.all, 9);

            mountedClinic.root.querySelector('[data-field="gap-title"]').value =
                'Missing repo signal';
            mountedClinic.root.querySelector(
                '[data-field="gap-domain"]'
            ).value = 'integration';
            mountedClinic.root.querySelector('[data-field="gap-owner"]').value =
                'infra';
            mountedClinic.root.querySelector(
                '[data-field="gap-surface"]'
            ).value = 'admin-queue';
            await mountedClinic.root.listeners.get('click')({
                target: createActionTarget('add-gap'),
            });
            assert.equal(mountedClinic.pack.gaps.length, 1);
            let gapLedgerDump = JSON.parse(
                storage.dump()['turnero-release-gap-ledger:v1']
            );
            assert.equal(gapLedgerDump['clinic-a'].length, 1);

            const mountedRegion =
                module.mountTurneroReleaseRepoDiagnosticPrepHub(targetRegion, {
                    region: 'north',
                    turneroClinicProfile: regionProfile,
                    clinicProfile: regionProfile,
                });

            assert.ok(mountedRegion);
            assert.equal(mountedRegion.pack.scope, 'north');
            assert.equal(mountedRegion.pack.gaps.length, 0);
            assert.match(
                mountedRegion.root.innerHTML,
                /data-turnero-scope="north"/
            );
            assert.match(mountedRegion.root.innerHTML, /Clínica Norte/);

            await mountedRegion.root.listeners.get('click')({
                target: createActionTarget('copy-diagnostic-brief'),
            });
            assert.equal(clipboard.length, 2);
            assert.match(clipboard[1], /Scope: north/);

            mountedRegion.root.querySelector('[data-field="gap-title"]').value =
                'Regional gap';
            mountedRegion.root.querySelector(
                '[data-field="gap-domain"]'
            ).value = 'governance';
            mountedRegion.root.querySelector('[data-field="gap-owner"]').value =
                'program';
            mountedRegion.root.querySelector(
                '[data-field="gap-surface"]'
            ).value = 'admin-queue';
            await mountedRegion.root.listeners.get('click')({
                target: createActionTarget('add-gap'),
            });

            gapLedgerDump = JSON.parse(
                storage.dump()['turnero-release-gap-ledger:v1']
            );
            assert.equal(gapLedgerDump['clinic-a'].length, 1);
            assert.equal(gapLedgerDump.north.length, 1);
            assert.equal(mountedRegion.pack.gaps.length, 1);
        }
    );
});
