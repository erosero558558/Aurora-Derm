'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { resolve } = require('node:path');

const {
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');
const BlobCtor =
    typeof Blob !== 'undefined' ? Blob : require('node:buffer').Blob;

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
            const node = new HTMLElementStub(
                key.includes('[data-field=') ? 'input' : 'span'
            );
            if (key.includes('[data-field=')) {
                node.value = '';
            }
            if (key.includes('[data-role=') || key.startsWith('#')) {
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
            return this;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(host, downloadCalls) {
    const body = new HTMLElementStub('body');

    return {
        body,
        createElement(tag) {
            if (String(tag).toLowerCase() === 'a') {
                const anchor = new HTMLElementStub('a');
                anchor.download = '';
                anchor.href = '';
                anchor.rel = '';
                anchor.click = () => {
                    anchor.clicked = true;
                    downloadCalls.push({
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
        getElementById(id) {
            return String(id) === 'queueReleaseTerminalDiagnosticRunwayHost'
                ? host
                : null;
        },
        querySelector(selector) {
            return String(selector) ===
                '[data-turnero-release-terminal-diagnostic-runway]'
                ? host
                : null;
        },
        execCommand() {
            return false;
        },
    };
}

test('builds the default runway pack and reuses scoped state without localStorage', async () => {
    const charterModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-final-diagnostic-charter.js',
        'terminal-runway-charter'
    );
    const checklistModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-terminal-question-checklist.js',
        'terminal-runway-checklist'
    );
    const ledgerModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-blocker-settlement-ledger.js',
        'terminal-runway-ledger'
    );
    const sessionModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-terminal-adjudication-session.js',
        'terminal-runway-session'
    );
    const runbookModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-final-human-runbook.js',
        'terminal-runway-runbook'
    );
    const scoreModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-terminal-package-integrity-score.js',
        'terminal-runway-score'
    );
    const runwayModule = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-terminal-diagnostic-runway-builder.js',
        'terminal-runway-builder'
    );

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            localStorage: undefined,
        },
        async () => {
            const charter =
                charterModule.buildTurneroReleaseFinalDiagnosticCharter();
            assert.equal(charter.principles.length, 4);
            assert.equal(charter.finalQuestions.length, 4);

            const checklist =
                checklistModule.buildTurneroReleaseTerminalQuestionChecklist();
            assert.equal(checklist.rows.length, 5);
            assert.equal(checklist.summary.all, 5);
            assert.equal(checklist.summary.open, 5);

            const northLedger =
                ledgerModule.createTurneroReleaseBlockerSettlementLedger(
                    'north'
                );
            const southLedger =
                ledgerModule.createTurneroReleaseBlockerSettlementLedger(
                    'south'
                );
            const northSession =
                sessionModule.createTurneroReleaseTerminalAdjudicationSession(
                    'north'
                );

            northLedger.add({
                title: 'Runtime drift',
                owner: 'infra',
                severity: 'high',
                state: 'open',
                resolution: 'Align bundle with source',
            });
            northSession.set({
                status: 'prepared',
                moderator: 'ops',
                note: 'Ready for terminal diagnostic',
            });

            assert.equal(
                ledgerModule
                    .createTurneroReleaseBlockerSettlementLedger('north')
                    .list().length,
                1
            );
            assert.equal(southLedger.list().length, 0);
            assert.equal(
                sessionModule
                    .createTurneroReleaseTerminalAdjudicationSession('north')
                    .get().status,
                'prepared'
            );

            const integrityScore =
                scoreModule.buildTurneroReleaseTerminalPackageIntegrityScore({
                    checklistSummary: checklist.summary,
                    settlements: northLedger.list(),
                    session: northSession.get(),
                    dossierDecision: 'issue-final-verdict',
                });
            const runbook = runbookModule.buildTurneroReleaseFinalHumanRunbook({
                charter,
                checklist,
                settlements: northLedger.list(),
                session: northSession.get(),
                integrityScore,
            });
            assert.equal(runbook.steps.length, 5);
            const runway =
                runwayModule.buildTurneroReleaseTerminalDiagnosticRunway({
                    charter,
                    checklist,
                    settlements: northLedger.list(),
                    session: northSession.get(),
                    integrityScore,
                    dossierDecision: 'issue-final-verdict',
                });

            assert.match(runway.markdown, /Terminal Diagnostic Runway/);
            assert.match(runway.markdown, /Integrity score:/);
            assert.equal(typeof runway.generatedAt, 'string');
        }
    );
});

test('mounts the runway, copies the brief and downloads the pack', async () => {
    const module = await loadFreshModule(
        'src/apps/queue-shared/turnero-release-terminal-diagnostic-runway.js',
        'terminal-runway-mount'
    );
    const wrapper = await loadFreshModule(
        'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/terminal-diagnostic-runway.js',
        'terminal-runway-wrapper'
    );

    const host = new HTMLElementStub('div');
    const downloads = [];
    const clipboard = [];
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-runway',
        region: 'north',
        branding: {
            name: 'Clínica Runway',
            short_name: 'Runway',
        },
    });

    await withGlobals(
        {
            Blob: BlobCtor,
            HTMLElement: HTMLElementStub,
            URL: {
                createObjectURL() {
                    return 'blob:turnero-release-terminal-diagnostic-runway';
                },
                revokeObjectURL() {},
            },
            navigator: {
                clipboard: {
                    async writeText(text) {
                        clipboard.push(String(text));
                    },
                },
            },
            document: createDocumentStub(host, downloads),
            localStorage: createLocalStorageStub(),
        },
        async () => {
            const mountResult =
                module.mountTurneroReleaseTerminalDiagnosticRunway(host, {
                    scope: 'north',
                    region: 'north',
                    dossierDecision: 'issue-final-verdict',
                    clinicProfile,
                    currentSnapshot: {
                        scope: 'north',
                        region: 'north',
                        dossierDecision: 'issue-final-verdict',
                        clinicProfile,
                    },
                });

            assert.ok(mountResult);
            assert.equal(
                mountResult.root.id,
                'turneroReleaseTerminalDiagnosticRunway'
            );
            assert.equal(
                mountResult.root.dataset.turneroReleaseTerminalDiagnosticRunway,
                'mounted'
            );
            assert.match(
                mountResult.root.querySelector('[data-role="runway-brief"]')
                    .textContent,
                /Terminal Diagnostic Runway/
            );

            const click = mountResult.root.listeners.get('click');
            await click({
                target: createActionTarget('prepare-terminal-session'),
            });
            assert.equal(mountResult.pack.session.status, 'prepared');

            const settlementTitle = mountResult.root.querySelector(
                '[data-field="settlement-title"]'
            );
            const settlementOwner = mountResult.root.querySelector(
                '[data-field="settlement-owner"]'
            );
            const settlementSeverity = mountResult.root.querySelector(
                '[data-field="settlement-severity"]'
            );
            const settlementResolution = mountResult.root.querySelector(
                '[data-field="settlement-resolution"]'
            );
            settlementTitle.value = 'Local storage sync';
            settlementOwner.value = 'program';
            settlementSeverity.value = 'medium';
            settlementResolution.value = 'Persist scoped data';

            await click({ target: createActionTarget('add-settlement') });
            assert.equal(mountResult.pack.settlements.length, 1);
            assert.equal(
                mountResult.root.querySelector(
                    '[data-role="runway-settlement-count"]'
                ).textContent,
                '1'
            );

            await click({ target: createActionTarget('copy-runway-brief') });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /Terminal Diagnostic Runway/);

            await click({ target: createActionTarget('download-runway-pack') });
            assert.equal(downloads.length, 1);
            assert.equal(
                downloads[0].download,
                'turnero-release-terminal-diagnostic-runway.json'
            );
            assert.equal(
                wrapper.renderQueueTerminalDiagnosticRunway(
                    { title: 'terminal-runway' },
                    'web',
                    {
                        clinicProfile,
                        currentSnapshot: {
                            scope: 'north',
                            region: 'north',
                            dossierDecision: 'issue-final-verdict',
                            clinicProfile,
                        },
                    }
                ).root.id,
                'turneroReleaseTerminalDiagnosticRunway'
            );
        }
    );
});
