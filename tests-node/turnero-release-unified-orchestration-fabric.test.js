'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

const REPO_ROOT = resolve(__dirname, '..');

async function loadOrchestrationModules() {
    const [
        fabric,
        signalBus,
        policyRouter,
        workflowOrchestrator,
        priorityArbiter,
        operatorFeed,
        memoryIndex,
        federatedReadinessScore,
    ] = await Promise.all([
        loadModule(
            'src/apps/queue-shared/turnero-release-unified-orchestration-fabric.js'
        ),
        loadModule('src/apps/queue-shared/turnero-release-signal-bus.js'),
        loadModule('src/apps/queue-shared/turnero-release-policy-router.js'),
        loadModule(
            'src/apps/queue-shared/turnero-release-workflow-orchestrator.js'
        ),
        loadModule('src/apps/queue-shared/turnero-release-priority-arbiter.js'),
        loadModule('src/apps/queue-shared/turnero-release-operator-feed.js'),
        loadModule(
            'src/apps/queue-shared/turnero-release-unified-memory-index.js'
        ),
        loadModule(
            'src/apps/queue-shared/turnero-release-federated-readiness-score.js'
        ),
    ]);

    return {
        fabric,
        signalBus,
        policyRouter,
        workflowOrchestrator,
        priorityArbiter,
        operatorFeed,
        memoryIndex,
        federatedReadinessScore,
    };
}

class StubElement {
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.listeners = new Map();
        this.nodes = new Map();
        this.children = [];
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this.download = '';
        this.href = '';
        this.rel = '';
        this.clicked = false;
        this.removed = false;
        this.parentNode = null;
        this._innerHTML = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.nodes.clear();
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
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
        if (this.listeners.get(String(type)) === handler) {
            this.listeners.delete(String(type));
        }
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            let node;
            if (key === '#turneroReleaseUnifiedOrchestrationFabric') {
                node = new StubElement(
                    'section',
                    'turneroReleaseUnifiedOrchestrationFabric'
                );
            } else if (key.startsWith('#')) {
                node = new StubElement('div', key.slice(1));
            } else if (key.includes('textarea')) {
                node = new StubElement('textarea');
            } else if (key.includes('input')) {
                node = new StubElement('input');
            } else {
                node = new StubElement('span');
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
            return this;
        },
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

function createDocumentStub(downloadClicks) {
    const body = new StubElement('body');

    return {
        body,
        createElement(tag) {
            if (tag === 'a') {
                const anchor = new StubElement('a');
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

            return new StubElement(tag);
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

function buildDomainsFixture() {
    return [
        {
            key: 'governance',
            owner: 'program',
            signals: [
                {
                    label: 'Steering pending approvals',
                    severity: 'medium',
                    state: 'open',
                    kind: 'approval',
                },
                {
                    label: 'Board actions overdue',
                    severity: 'high',
                    state: 'open',
                    kind: 'action',
                },
            ],
        },
        {
            key: 'integration',
            owner: 'infra',
            signals: [
                {
                    label: 'Public sync freshness drift',
                    severity: 'high',
                    state: 'open',
                    kind: 'freshness',
                },
                {
                    label: 'Bridge backlog queued',
                    severity: 'medium',
                    state: 'open',
                    kind: 'replay',
                },
            ],
        },
        {
            key: 'reliability',
            owner: 'infra',
            signals: [
                {
                    label: 'Recovery drill pending',
                    severity: 'medium',
                    state: 'open',
                    kind: 'drill',
                },
            ],
        },
        {
            key: 'service',
            owner: 'ops',
            signals: [
                {
                    label: 'Change saturation in cohort B',
                    severity: 'high',
                    state: 'open',
                    kind: 'adoption',
                },
            ],
        },
        {
            key: 'strategy',
            owner: 'program',
            signals: [
                {
                    label: 'Regional demand pressure',
                    severity: 'medium',
                    state: 'open',
                    kind: 'forecast',
                },
            ],
        },
    ];
}

test('builders summarize the orchestration fabric with stable counts', async () => {
    const modules = await loadOrchestrationModules();
    const domains = buildDomainsFixture();

    const signalBus = modules.signalBus.buildTurneroReleaseSignalBus({
        domains,
    });
    const policy = modules.policyRouter.buildTurneroReleasePolicyRouter({
        signals: signalBus.rows,
    });
    const workflows =
        modules.workflowOrchestrator.buildTurneroReleaseWorkflowOrchestrator({
            routes: policy.rows,
        });
    const priority = modules.priorityArbiter.buildTurneroReleasePriorityArbiter(
        {
            signals: signalBus.rows,
            backlog: [{ owner: 'program', state: 'open' }],
        }
    );
    const readiness =
        modules.federatedReadinessScore.buildTurneroReleaseFederatedReadinessScore(
            {
                signalSummary: signalBus.summary,
                priorityTop: priority.top,
                operatorFeed: [],
                memoryIndex: [],
            }
        );
    const pack =
        modules.fabric.buildTurneroReleaseUnifiedOrchestrationFabricPack({
            scope: 'clinic-a',
            region: 'north',
            clinicId: 'clinic-a',
            clinicLabel: 'Clínica Norte',
            clinicShortName: 'Norte',
            releaseDecision: 'review',
            domains,
        });

    assert.equal(signalBus.rows.length, 7);
    assert.equal(signalBus.summary.all, 7);
    assert.equal(signalBus.summary.critical, 0);
    assert.equal(signalBus.summary.high, 3);
    assert.equal(signalBus.summary.open, 7);
    assert.equal(policy.rows.length, 7);
    assert.equal(workflows.rows.length, 7);
    assert.equal(
        workflows.rows.find((row) => row.route === 'backlog')?.steps[0],
        'Create item'
    );
    assert.equal(
        workflows.rows.find((row) => row.route === 'owner-workbench')?.steps[0],
        'Assign owner'
    );
    assert.equal(priority.top.band, 'P1');
    assert.equal(priority.top.priorityScore, 74);
    assert.equal(priority.top.label, 'Board actions overdue');
    assert.equal(readiness.score, 64.2);
    assert.equal(readiness.band, 'watch');
    assert.equal(readiness.decision, 'review');
    assert.equal(pack.signalBus.summary.all, 7);
    assert.equal(pack.federatedScore.score, 65);
    assert.equal(pack.federatedScore.band, 'watch');
    assert.equal(pack.federatedScore.decision, 'review');
    assert.match(pack.briefMarkdown, /Unified Orchestration Fabric/);
    assert.match(pack.briefMarkdown, /Signals: 7 total/);
});

test('scoped stores ignore malformed storage and keep feed and memory isolated', async () => {
    const storage = createLocalStorageStub({
        'turnero-release-operator-feed:v1': 'not-json',
        'turnero-release-unified-memory-index:v1': 'not-json',
    });

    await withGlobals({ localStorage: storage }, async () => {
        const modules = await loadOrchestrationModules();
        const feedA =
            modules.operatorFeed.createTurneroReleaseOperatorFeed('clinic-a');
        const feedB =
            modules.operatorFeed.createTurneroReleaseOperatorFeed('clinic-b');
        const memoryA =
            modules.memoryIndex.createTurneroReleaseUnifiedMemoryIndex(
                'clinic-a'
            );
        const memoryB =
            modules.memoryIndex.createTurneroReleaseUnifiedMemoryIndex(
                'clinic-b'
            );

        feedA.add({
            id: 'feed-a',
            title: 'Steering ping',
            owner: 'program',
            lane: 'priority',
            state: 'open',
        });
        feedB.add({
            id: 'feed-b',
            title: 'Integration ping',
            owner: 'infra',
            lane: 'scheduled',
            state: 'open',
        });
        memoryA.add({
            id: 'memory-a',
            domain: 'governance',
            key: 'brief',
            owner: 'program',
            value: 'Clinic A brief',
            state: 'stored',
        });
        memoryB.add({
            id: 'memory-b',
            domain: 'integration',
            key: 'brief',
            owner: 'infra',
            value: 'Clinic B brief',
            state: 'stored',
        });

        assert.equal(feedA.list().length, 1);
        assert.equal(feedB.list().length, 1);
        assert.equal(memoryA.list().length, 1);
        assert.equal(memoryB.list().length, 1);

        const dump = storage.dump();
        const feedDump = JSON.parse(dump['turnero-release-operator-feed:v1']);
        const memoryDump = JSON.parse(
            dump['turnero-release-unified-memory-index:v1']
        );

        assert.equal(feedDump['clinic-a'].length, 1);
        assert.equal(feedDump['clinic-b'].length, 1);
        assert.equal(memoryDump['clinic-a'].length, 1);
        assert.equal(memoryDump['clinic-b'].length, 1);
    });
});

test('mount renders actions, updates the pack and rerenders by scope', async () => {
    const modules = await loadOrchestrationModules();
    const storage = createLocalStorageStub();
    const clipboard = [];
    const downloadClicks = [];
    const blobs = [];
    const documentStub = createDocumentStub(downloadClicks);
    const clinicProfileA = buildClinicProfile({
        clinic_id: 'clinic-a',
        region: 'north',
        branding: {
            name: 'Clínica Norte',
            short_name: 'Norte',
        },
        release: {
            mode: 'suite_v2',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: true,
        },
    });
    const clinicProfileB = buildClinicProfile({
        clinic_id: 'clinic-b',
        region: 'south',
        branding: {
            name: 'Clínica Sur',
            short_name: 'Sur',
        },
        release: {
            mode: 'suite_v2',
            admin_mode_default: 'basic',
            separate_deploy: true,
            native_apps_blocking: true,
        },
    });
    const target = new StubElement(
        'div',
        'queueReleaseUnifiedOrchestrationFabricHost'
    );

    class BlobStub {
        constructor(parts, options) {
            this.parts = parts;
            this.options = options;
        }
    }

    await withGlobals(
        {
            localStorage: storage,
            navigator: {
                clipboard: {
                    async writeText(text) {
                        clipboard.push(text);
                    },
                },
            },
            document: documentStub,
            Blob: BlobStub,
            URL: {
                createObjectURL(blob) {
                    blobs.push(blob);
                    return 'blob:turnero-release-orchestration-pack';
                },
                revokeObjectURL() {},
            },
            HTMLElement: StubElement,
            HTMLButtonElement: StubElement,
            HTMLInputElement: StubElement,
            HTMLTextAreaElement: StubElement,
            setTimeout(fn) {
                if (typeof fn === 'function') {
                    fn();
                }
                return 0;
            },
        },
        async () => {
            const domains = buildDomainsFixture();
            const mountedA =
                modules.fabric.mountTurneroReleaseUnifiedOrchestrationFabric(
                    target,
                    {
                        scope: 'clinic-a',
                        region: 'north',
                        clinicId: 'clinic-a',
                        clinicProfile: clinicProfileA,
                        domains,
                        releaseDecision: 'review',
                    }
                );

            assert.ok(mountedA);
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricMounted,
                'true'
            );
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScore,
                '65'
            );
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricDecision,
                'review'
            );
            assert.equal(
                mountedA.root.id,
                'turneroReleaseUnifiedOrchestrationFabric'
            );
            assert.equal(mountedA.root.dataset.state, 'warning');
            assert.match(target.innerHTML, /Unified Orchestration Fabric/);
            assert.match(target.innerHTML, /Copy orchestration brief/);
            assert.match(target.innerHTML, /Download orchestration JSON/);
            assert.match(target.innerHTML, /data-role="federated-score"/);

            await target.listeners.get('click')({
                target: createActionTarget('copy-orchestration-brief'),
            });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /# Unified Orchestration Fabric/);
            assert.match(clipboard[0], /Scope: clinic-a/);

            await target.listeners.get('click')({
                target: createActionTarget('download-orchestration-pack'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-orchestration-pack.json'
            );
            assert.equal(downloadClicks[0].clicked, true);
            assert.equal(blobs.length, 1);
            const downloadedPack = JSON.parse(blobs[0].parts[0]);
            assert.equal(downloadedPack.scope, 'clinic-a');
            assert.equal(downloadedPack.federatedScore.score, 65);

            mountedA.root.querySelector('[data-field="feed-title"]').value =
                'Steering ping';
            mountedA.root.querySelector('[data-field="feed-owner"]').value =
                'program';
            mountedA.root.querySelector('[data-field="feed-lane"]').value =
                'priority';
            await target.listeners.get('click')({
                target: createActionTarget('add-feed-event'),
            });
            assert.equal(mountedA.pack.operatorFeed.length, 1);
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScore,
                '62.2'
            );

            mountedA.root.querySelector('[data-field="memory-domain"]').value =
                'governance';
            mountedA.root.querySelector('[data-field="memory-key"]').value =
                'brief';
            mountedA.root.querySelector('[data-field="memory-value"]').value =
                'Clinic A brief';
            await target.listeners.get('click')({
                target: createActionTarget('add-memory-entry'),
            });
            assert.equal(mountedA.pack.memoryIndex.length, 1);
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScore,
                '62.7'
            );
            assert.equal(mountedA.pack.federatedScore.score, 62.7);

            const mountedB =
                modules.fabric.mountTurneroReleaseUnifiedOrchestrationFabric(
                    target,
                    {
                        scope: 'clinic-b',
                        region: 'south',
                        clinicId: 'clinic-b',
                        clinicProfile: clinicProfileB,
                        domains,
                        releaseDecision: 'review',
                    }
                );

            assert.equal(mountedB.pack.operatorFeed.length, 0);
            assert.equal(mountedB.pack.memoryIndex.length, 0);
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScope,
                'clinic-b'
            );
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScore,
                '65'
            );

            const mountedAAgain =
                modules.fabric.mountTurneroReleaseUnifiedOrchestrationFabric(
                    target,
                    {
                        scope: 'clinic-a',
                        region: 'north',
                        clinicId: 'clinic-a',
                        clinicProfile: clinicProfileA,
                        domains,
                        releaseDecision: 'review',
                    }
                );

            assert.equal(mountedAAgain.pack.operatorFeed.length, 1);
            assert.equal(mountedAAgain.pack.memoryIndex.length, 1);
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScope,
                'clinic-a'
            );
            assert.equal(
                target.dataset.turneroUnifiedOrchestrationFabricScore,
                '62.7'
            );
        }
    );
});

test('source wiring includes the new host, helper and render hook', () => {
    const headerSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/ui/frame/templates/sections/queue/header.js'
        ),
        'utf8'
    );
    const installHubSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub.js'
        ),
        'utf8'
    );
    const helperSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/admin-v3/shared/modules/queue/render/section/install-hub/unified-orchestration-fabric.js'
        ),
        'utf8'
    );
    const moduleSource = readFileSync(
        resolve(
            REPO_ROOT,
            'src/apps/queue-shared/turnero-release-unified-orchestration-fabric.js'
        ),
        'utf8'
    );

    assert.match(headerSource, /queueReleaseUnifiedOrchestrationFabricHost/);
    assert.match(
        headerSource,
        /data-turnero-release-unified-orchestration-fabric/
    );
    assert.match(
        installHubSource,
        /renderQueueUnifiedOrchestrationFabric\(manifest,\s*detectedPlatform\);/
    );
    assert.match(
        installHubSource,
        /queueReleaseUnifiedOrchestrationFabricHost/
    );
    assert.match(helperSource, /wireTurneroUnifiedOrchestrationFabric/);
    assert.match(helperSource, /buildQueueUnifiedOrchestrationFabricContext/);
    assert.match(moduleSource, /turnero-release-unified-orchestration-fabric/);
    assert.match(moduleSource, /copy-orchestration-brief/);
    assert.match(moduleSource, /download-orchestration-pack/);
});
