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

async function loadSafetyPrivacyModule() {
    return loadModule(
        'src/apps/queue-shared/turnero-release-safety-privacy-cockpit.js'
    );
}

class StubElement {
    constructor(tagName = 'div') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.dataset = {};
        this.children = [];
        this.listeners = new Map();
        this.nodes = new Map();
        this.style = {};
        this.className = '';
        this.value = '';
        this.textContent = '';
        this._innerHTML = '';
        this.parentNode = null;
        this.download = '';
        this.href = '';
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
        this.children = [];
        this.nodes.clear();
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    remove() {
        if (this.parentNode && Array.isArray(this.parentNode.children)) {
            this.parentNode.children = this.parentNode.children.filter(
                (node) => node !== this
            );
        }
        this.parentNode = null;
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
            const node = new StubElement('span');
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
}

function withGlobals(setup, callback) {
    const previous = {};

    for (const key of Object.keys(setup)) {
        previous[key] = global[key];
        try {
            global[key] = setup[key];
        } catch (_error) {
            Object.defineProperty(global, key, {
                configurable: true,
                writable: true,
                value: setup[key],
            });
        }
    }

    return Promise.resolve()
        .then(callback)
        .finally(() => {
            for (const key of Object.keys(setup)) {
                const value = previous[key];
                try {
                    if (value === undefined) {
                        delete global[key];
                    } else {
                        global[key] = value;
                    }
                } catch (_error) {
                    Object.defineProperty(global, key, {
                        configurable: true,
                        writable: true,
                        value,
                    });
                }
            }
        });
}

function createActionTarget(action) {
    return {
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
        closest(selector) {
            return String(selector) === '[data-action]' ? this : null;
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
                    downloadClicks.push({
                        download: anchor.download,
                        href: anchor.href,
                    });
                };
                return anchor;
            }

            return new StubElement(tag);
        },
    };
}

function buildSafetyPrivacyFixture() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinic-a',
        region: 'north',
        branding: {
            name: 'Clinica Norte',
            short_name: 'Norte',
            base_url: 'https://norte.example',
        },
    });

    return {
        clinicProfile,
        incidents: [
            {
                id: 'incident-1',
                title: 'Access review pending',
                detail: 'Needs governance review',
                severity: 'watch',
                owner: 'security',
            },
        ],
    };
}

test('turnero safety/privacy cockpit builders synthesize pack and markdown', async () => {
    const module = await loadSafetyPrivacyModule();
    const fixture = buildSafetyPrivacyFixture();
    const pack = module.buildTurneroReleaseSafetyPrivacyCockpitPack({
        scope: 'north',
        region: 'north',
        clinicId: 'clinic-a',
        clinicProfile: fixture.clinicProfile,
        incidents: fixture.incidents,
    });

    assert.equal(pack.scope, 'north');
    assert.equal(pack.region, 'north');
    assert.equal(pack.clinicId, 'clinic-a');
    assert.equal(pack.surfaces.length, 5);
    assert.equal(pack.matrix.summary.all, 5);
    assert.equal(pack.matrix.summary.restricted, 1);
    assert.equal(pack.sensitiveMap.rows.length, 5);
    assert.equal(pack.guardrails.summary.all, 3);
    assert.equal(pack.guardrails.summary.watch, 1);
    assert.equal(pack.incidentSummary.summary.all, 1);
    assert.equal(pack.score.score, 89);
    assert.equal(pack.score.band, 'stable');
    assert.equal(pack.score.decision, 'ready');

    const markdown = module.privacyBriefToMarkdown(pack);
    assert.match(markdown, /Safety Privacy Cockpit/);
    assert.match(markdown, /## Sensitive surfaces/);
    assert.match(markdown, /## Guardrails/);
});

test('mount renders safety/privacy actions and rerenders without duplicating the host', async () => {
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
            return 'blob:turnero-safety-privacy';
        },
        revokeObjectURL() {},
    };
    const target = new StubElement('div');

    await withGlobals(
        {
            localStorage: storage,
            navigator: navigatorStub,
            document: documentStub,
            Blob: BlobStub,
            URL: URLStub,
            HTMLElement: StubElement,
            HTMLButtonElement: StubElement,
            HTMLInputElement: StubElement,
            HTMLTextAreaElement: StubElement,
        },
        async () => {
            const module = await loadSafetyPrivacyModule();
            const fixture = buildSafetyPrivacyFixture();
            const result = module.mountTurneroReleaseSafetyPrivacyCockpit(
                target,
                {
                    scope: 'north',
                    region: 'north',
                    clinicId: 'clinic-a',
                    clinicProfile: fixture.clinicProfile,
                    incidents: fixture.incidents,
                }
            );

            assert.ok(result);
            assert.equal(target.children.length, 1);
            assert.equal(target.children[0], result.root);
            assert.equal(
                result.root.className,
                'queue-app-card turnero-release-safety-privacy-cockpit'
            );
            assert.equal(result.root.dataset.score, '89');
            assert.equal(result.root.dataset.band, 'stable');
            assert.equal(result.root.dataset.decision, 'ready');
            assert.match(result.root.innerHTML, /Safety Privacy Cockpit/);
            assert.match(result.root.innerHTML, /Copy privacy brief/);

            await result.root.listeners.get('click')({
                target: createActionTarget('copy-privacy-brief'),
            });
            assert.equal(clipboard.length, 1);
            assert.match(clipboard[0], /Safety Privacy Cockpit/);

            await result.root.listeners.get('click')({
                target: createActionTarget('download-safety-privacy-pack'),
            });
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-release-safety-privacy-pack.json'
            );
            assert.equal(blobs.length, 1);
            const parsedPack = JSON.parse(blobs[0].parts[0]);
            assert.equal(parsedPack.score.score, 89);
            assert.equal(parsedPack.score.band, 'stable');

            result.root.querySelector(
                '[data-field="privacy-obligation-title"]'
            ).value = 'Retention review';
            result.root.querySelector(
                '[data-field="privacy-obligation-owner"]'
            ).value = 'governance';
            result.root.querySelector(
                '[data-field="privacy-obligation-due-date"]'
            ).value = '2026-03-20';
            await result.root.listeners.get('click')({
                target: createActionTarget('add-obligation'),
            });
            assert.equal(result.pack.obligations.length, 1);
            assert.equal(result.root.dataset.obligations, '1');

            const second = module.mountTurneroReleaseSafetyPrivacyCockpit(
                target,
                {
                    scope: 'north',
                    region: 'north',
                    clinicId: 'clinic-a',
                    clinicProfile: fixture.clinicProfile,
                    incidents: fixture.incidents,
                }
            );

            assert.ok(second);
            assert.equal(target.children.length, 1);
            assert.equal(target.children[0], second.root);
        }
    );
});

test('queue surface wiring includes safety/privacy cockpit host and render hook', () => {
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

    assert.match(headerSource, /id="queueReleaseSafetyPrivacyCockpitHost"/);
    assert.match(headerSource, /data-turnero-release-safety-privacy-cockpit/);
    assert.match(installHubSource, /mountTurneroReleaseSafetyPrivacyCockpit/);
    assert.match(installHubSource, /queueReleaseSafetyPrivacyCockpitHost/);
    assert.match(installHubSource, /readTurneroIncidentJournal/);
    assert.match(
        installHubSource,
        /renderQueueSafetyPrivacyCockpit\(manifest, detectedPlatform\);/
    );
});
