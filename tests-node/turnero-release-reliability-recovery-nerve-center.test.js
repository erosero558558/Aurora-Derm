'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    loadModule,
    buildClinicProfile,
    createLocalStorageStub,
} = require('./turnero-release-test-fixtures.js');

async function loadReliabilityModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-reliability-recovery-nerve-center.js'
    );
}

class HTMLElementStub {
    constructor(id = '') {
        this.id = id;
        this.dataset = {};
        this.attributes = new Map();
        this.listeners = new Map();
        this.children = [];
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.checked = false;
        this.style = {};
        this.__queries = new Map();
    }

    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        const value = this.attributes.get(String(name));
        return value === undefined ? null : value;
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    appendChild(node) {
        this.children.push(node);
        this.__child = node;
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
        if (selector === `#${this.id}`) {
            return this;
        }

        const match = /^\[data-(role|field)="([^"]+)"\]$/.exec(
            String(selector)
        );
        if (!match) {
            return null;
        }

        const key = `${match[1]}:${match[2]}`;
        if (!this.__queries.has(key)) {
            this.__queries.set(key, new HTMLElementStub(key));
        }

        return this.__queries.get(key);
    }

    querySelectorAll() {
        return [];
    }

    click() {
        this.clicked = true;
    }

    remove() {
        this.removed = true;
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

function buildReleaseIncidents() {
    return [
        {
            id: 'incident-health',
            kind: 'health',
            severity: 'critical',
            title: 'Remote health outage',
            owner: 'infra',
            dependency: 'health',
        },
        {
            id: 'incident-sync',
            kind: 'publicSync',
            severity: 'high',
            title: 'Public sync lag',
            owner: 'web',
            dependency: 'publicSync',
        },
        {
            id: 'incident-shell',
            kind: 'shellDrift',
            severity: 'medium',
            title: 'Shell drift',
            owner: 'frontend',
            dependency: 'shell',
        },
    ];
}

function buildClickTarget(action) {
    const target = new HTMLElementStub(`button-${action}`);
    target.setAttribute('data-action', action);
    return target;
}

test('reliability recovery module clasifica, persiste y exporta el pack consolidado', async () => {
    const module = await loadReliabilityModule();
    const storage = createLocalStorageStub();
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-norte-demo',
        region: 'norte',
        branding: {
            name: 'Clínica Norte',
            short_name: 'Norte',
        },
    });
    const host = new HTMLElementStub('queueReliabilityRecoveryNerveCenterHost');

    let copiedText = '';
    let createdAnchor = null;

    await withGlobals(
        {
            localStorage: storage,
            HTMLElement: HTMLElementStub,
            HTMLButtonElement: HTMLElementStub,
            HTMLInputElement: HTMLElementStub,
            HTMLTextAreaElement: HTMLElementStub,
            Blob: global.Blob,
            URL: {
                createObjectURL(blob) {
                    createdAnchor = createdAnchor || {};
                    createdAnchor.__blob = blob;
                    return 'blob:turnero-reliability-pack';
                },
                revokeObjectURL() {},
            },
            navigator: {
                clipboard: {
                    async writeText(text) {
                        copiedText = text;
                    },
                },
            },
            document: {
                body: new HTMLElementStub('body'),
                createElement(tag) {
                    if (tag === 'a') {
                        const anchor = new HTMLElementStub('a');
                        anchor.click = function click() {
                            this.clicked = true;
                        };
                        anchor.remove = function remove() {
                            this.removed = true;
                        };
                        createdAnchor = anchor;
                        return anchor;
                    }
                    return new HTMLElementStub(tag);
                },
                getElementById(id) {
                    return id === 'queueReliabilityRecoveryNerveCenterHost'
                        ? host
                        : null;
                },
                querySelector() {
                    return null;
                },
            },
        },
        async () => {
            const mounted =
                module.mountTurneroReleaseReliabilityRecoveryNerveCenter(host, {
                    clinicProfile,
                    releaseIncidents: buildReleaseIncidents(),
                });

            assert.ok(mounted);
            assert.equal(
                host.dataset.turneroReliabilityRecoveryMounted,
                'true'
            );
            assert.equal(host.dataset.turneroReliabilityRecoveryScope, 'norte');
            assert.equal(
                host.dataset.turneroReliabilityRecoveryRegion,
                'norte'
            );
            assert.equal(
                host.dataset.turneroReliabilityRecoveryRollbackMode,
                'rollback_ready'
            );
            assert.equal(mounted.pack.taxonomy.rows.length, 3);
            assert.equal(mounted.pack.dependencyMap.rows.length, 4);
            assert.equal(mounted.pack.dependencyMap.rows[0].state, 'watch');
            assert.equal(mounted.pack.resilience.score, 79);
            assert.equal(mounted.pack.resilience.band, 'stable');
            assert.match(
                mounted.root.querySelector('[data-role="recovery-brief"]')
                    .textContent,
                /Reliability Recovery Nerve Center/
            );

            const clickHandler = mounted.root.listeners.get('click');
            assert.equal(typeof clickHandler, 'function');

            await clickHandler({
                target: buildClickTarget('copy-recovery-brief'),
            });
            assert.match(copiedText, /Scope: norte/);
            assert.match(copiedText, /Resilience score: 79/);

            await clickHandler({
                target: buildClickTarget('download-reliability-pack'),
            });
            assert.equal(
                createdAnchor.download,
                'turnero-release-reliability-pack.json'
            );
            assert.equal(createdAnchor.clicked, true);

            mounted.root.querySelector('[data-field="drill-title"]').value =
                'Primary failover drill';
            mounted.root.querySelector('[data-field="drill-owner"]').value =
                'infra';
            mounted.root.querySelector('[data-field="drill-result"]').value =
                'passed';
            await clickHandler({
                target: buildClickTarget('add-drill'),
            });
            assert.equal(mounted.pack.drills.length, 1);
            assert.equal(
                mounted.root.querySelector('[data-role="drill-count"]')
                    .textContent,
                '1'
            );

            mounted.root.querySelector(
                '[data-field="checkpoint-label"]'
            ).value = 'Recovery checkpoint';
            mounted.root.querySelector(
                '[data-field="checkpoint-owner"]'
            ).value = 'ops';
            mounted.root.querySelector('[data-field="checkpoint-note"]').value =
                'Checklist restored';
            await clickHandler({
                target: buildClickTarget('add-checkpoint'),
            });
            assert.equal(mounted.pack.checkpoints.length, 1);
            assert.equal(
                mounted.root.querySelector('[data-role="checkpoint-count"]')
                    .textContent,
                '1'
            );

            mounted.root.querySelector(
                '[data-field="postmortem-title"]'
            ).value = 'Incident follow-up';
            mounted.root.querySelector(
                '[data-field="postmortem-owner"]'
            ).value = 'qa';
            mounted.root.querySelector('[data-field="postmortem-root"]').value =
                'Dependency lag';
            mounted.root.querySelector(
                '[data-field="postmortem-action"]'
            ).value = 'Tighten rollout guardrails';
            await clickHandler({
                target: buildClickTarget('add-postmortem'),
            });
            assert.equal(mounted.pack.postmortems.length, 1);
            assert.equal(
                mounted.root.querySelector('[data-role="postmortem-count"]')
                    .textContent,
                '1'
            );

            assert.equal(mounted.pack.resilience.score, 85);
            assert.equal(mounted.pack.resilience.band, 'stable');
            assert.match(
                mounted.root.querySelector('[data-role="recovery-brief"]')
                    .textContent,
                /Drills: 1/
            );
            assert.match(
                mounted.root.querySelector('[data-role="recovery-brief"]')
                    .textContent,
                /Checkpoints: 1/
            );
            assert.match(
                mounted.root.querySelector('[data-role="recovery-brief"]')
                    .textContent,
                /Postmortems: 1/
            );

            const dump = storage.dump();
            assert.equal(
                JSON.parse(dump['turnero-release-failover-drill-registry:v1'])
                    .norte.length,
                1
            );
            assert.equal(
                JSON.parse(
                    dump['turnero-release-recovery-checkpoint-journal:v1']
                ).norte.length,
                1
            );
            assert.equal(
                JSON.parse(dump['turnero-release-postmortem-workspace:v1'])
                    .norte.length,
                1
            );
        }
    );
});
