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
    constructor(tagName = 'div', id = '') {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.id = String(id || '');
        this.dataset = {};
        this.children = [];
        this.className = '';
        this.style = {};
        this.textContent = '';
        this.value = '';
        this.hidden = false;
        this.parentNode = null;
        this._innerHTML = '';
        this.nodes = new Map();
    }

    set innerHTML(value) {
        this._innerHTML = String(value || '');
    }

    get innerHTML() {
        return this._innerHTML;
    }

    appendChild(node) {
        this.children.push(node);
        node.parentNode = this;
        return node;
    }

    removeChild(node) {
        this.children = this.children.filter((child) => child !== node);
        node.parentNode = null;
        return node;
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new HTMLElementStub(
                key.includes('[data-field="') ? 'input' : key === '[data-role="brief"]' ? 'pre' : 'div'
            );
            this.nodes.set(key, node);
        }
        return this.nodes.get(key);
    }

    remove() {
        if (
            this.parentNode &&
            typeof this.parentNode.removeChild === 'function'
        ) {
            this.parentNode.removeChild(this);
        }
    }

    click() {
        this.clicked = true;
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
            } else {
                Object.defineProperty(global, key, descriptor);
            }
        }
    }
}

function createDocumentStub(host, downloadClicks) {
    const head = new HTMLElementStub('head', 'head');
    const body = new HTMLElementStub('body', 'body');

    return {
        head,
        body,
        createElement(tag) {
            const node = new HTMLElementStub(tag);
            if (tag === 'a') {
                node.click = () => {
                    downloadClicks.push({
                        download: node.download,
                        href: node.href,
                    });
                };
            }
            return node;
        },
        getElementById(id) {
            return String(id) === 'queueSurfaceOnboardingConsoleHost'
                ? host
                : null;
        },
        querySelector() {
            return null;
        },
    };
}

function createActionTarget(action) {
    return {
        getAttribute(name) {
            return String(name) === 'data-action' ? action : null;
        },
    };
}

test('mount onboarding console renders and persists form actions', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-onboarding-console.js'
    );

    const host = new HTMLElementStub('div', 'queueSurfaceOnboardingConsoleHost');
    const clipboardWrites = [];
    const downloadClicks = [];
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-onboarding',
        branding: {
            name: 'Clinica Onboarding',
            short_name: 'Onboarding',
            city: 'Quito',
        },
        region: 'sierra',
        surfaces: {
            operator: { label: 'Turnero Operador', route: '/operador-turnos.html' },
            kiosk: { label: 'Turnero Kiosco', route: '/kiosco-turnos.html' },
            display: { label: 'Turnero Sala TV', route: '/sala-turnos.html' },
        },
    });

    await withGlobals(
        {
            HTMLElement: HTMLElementStub,
            document: createDocumentStub(host, downloadClicks),
            navigator: {
                clipboard: {
                    async writeText(value) {
                        clipboardWrites.push(String(value));
                    },
                },
            },
            Blob: class BlobStub {
                constructor(parts, options) {
                    this.parts = parts;
                    this.options = options;
                }
            },
            URL: {
                createObjectURL() {
                    return 'blob:turnero-onboarding';
                },
                revokeObjectURL() {},
            },
            setTimeout(callback) {
                if (typeof callback === 'function') {
                    callback();
                }
                return 0;
            },
        },
        async () => {
            const mounted = module.mountTurneroAdminQueueSurfaceOnboardingConsole(
                host,
                {
                    scope: 'regional',
                    clinicProfile,
                    snapshots: [
                        { surfaceKey: 'operator-turnos' },
                        { surfaceKey: 'kiosco-turnos' },
                        { surfaceKey: 'sala-turnos' },
                    ],
                    checklist: {
                        summary: {
                            all: 6,
                            pass: 4,
                            fail: 2,
                        },
                    },
                }
            );

            assert.ok(mounted);
            assert.equal(host.dataset.state, 'blocked');
            assert.match(host.innerHTML, /Surface Customer Onboarding/);

            host.querySelector('[data-field="ledger-surface-key"]').value =
                'operator-turnos';
            host.querySelector('[data-field="ledger-title"]').value =
                'Checklist operator';
            host.querySelector('[data-field="ledger-note"]').value =
                'Brief operator listo.';
            await host.onclick({ target: createActionTarget('add-ledger') });

            host.querySelector('[data-field="owner-surface-key"]').value =
                'operator-turnos';
            host.querySelector('[data-field="owner-actor"]').value = 'ops-lead';
            host.querySelector('[data-field="owner-note"]').value =
                'Owner asignado.';
            await host.onclick({ target: createActionTarget('add-owner') });

            await host.onclick({ target: createActionTarget('copy-brief') });
            await host.onclick({ target: createActionTarget('download-json') });

            assert.equal(mounted.state.ledgerRows.length, 1);
            assert.equal(mounted.state.ownerRows.length, 1);
            assert.equal(
                mounted.state.ledgerRows[0].surfaceKey,
                'operator-turnos'
            );
            assert.equal(
                mounted.state.ownerRows[0].actor,
                'ops-lead'
            );
            assert.equal(clipboardWrites.length, 1);
            assert.equal(downloadClicks.length, 1);
            assert.match(host.innerHTML, /Checklist operator/);
            assert.match(host.innerHTML, /ops-lead/);
        }
    );
});
