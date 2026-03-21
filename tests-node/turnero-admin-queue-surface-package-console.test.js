#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');
const ORIGINAL_GLOBALS = {
    document: global.document,
    HTMLElement: global.HTMLElement,
    localStorage: global.localStorage,
};

async function importRepoModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

function installLocalStorageMock() {
    const store = new Map();
    global.localStorage = {
        getItem(key) {
            const normalizedKey = String(key);
            return store.has(normalizedKey) ? store.get(normalizedKey) : null;
        },
        setItem(key, value) {
            store.set(String(key), String(value));
        },
        removeItem(key) {
            store.delete(String(key));
        },
        clear() {
            store.clear();
        },
        entries() {
            return Array.from(store.entries());
        },
    };
    return store;
}

class FakeElement {
    constructor(tagName, ownerDocument) {
        this.tagName = String(tagName || 'div').toUpperCase();
        this.ownerDocument = ownerDocument || null;
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.className = '';
        this.hidden = false;
        this.style = {};
        this.attributes = new Map();
        this.eventListeners = new Map();
        this.nodes = new Map();
        this._id = '';
        this._textContent = '';
        this._innerHTML = '';
        this._value = '';
        this._type = '';
    }

    set id(value) {
        this._id = String(value || '');
        if (this.ownerDocument) {
            this.ownerDocument.registerId(this);
        }
    }

    get id() {
        return this._id;
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

    set innerHTML(value) {
        this._innerHTML = String(value ?? '');
        this._textContent = '';
        this.children = [];
    }

    get innerHTML() {
        return this._innerHTML;
    }

    set value(value) {
        this._value = String(value ?? '');
    }

    get value() {
        return this._value;
    }

    set type(value) {
        this._type = String(value ?? '');
    }

    get type() {
        return this._type;
    }

    querySelector(selector) {
        const key = String(selector);
        if (!this.nodes.has(key)) {
            const node = new FakeElement(
                key.includes('[data-field="')
                    ? 'input'
                    : key === '[data-role="brief"]'
                      ? 'pre'
                      : 'div'
            );
            this.nodes.set(key, node);
        }
        return this.nodes.get(key);
    }

    appendChild(child) {
        if (!(child instanceof FakeElement)) {
            throw new TypeError('FakeElement only accepts FakeElement children');
        }

        child.parentElement = this;
        child.ownerDocument = this.ownerDocument;
        this.children.push(child);
        if (child.id && child.ownerDocument) {
            child.ownerDocument.registerId(child);
        }
        return child;
    }

    replaceChildren(...nodes) {
        this.children = [];
        this._textContent = '';
        this._innerHTML = '';
        nodes.filter(Boolean).forEach((node) => this.appendChild(node));
    }

    remove() {
        if (this.parentElement) {
            const index = this.parentElement.children.indexOf(this);
            if (index >= 0) {
                this.parentElement.children.splice(index, 1);
            }
            this.parentElement = null;
        }
        if (this.ownerDocument) {
            this.ownerDocument.unregisterId(this);
        }
    }

    setAttribute(name, value) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            this.id = value;
            return;
        }
        if (normalizedName === 'class') {
            this.className = String(value || '');
            return;
        }
        this.attributes.set(normalizedName, String(value || ''));
    }

    getAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            return this.id || null;
        }
        if (normalizedName === 'class') {
            return this.className || null;
        }
        return this.attributes.has(normalizedName)
            ? this.attributes.get(normalizedName)
            : null;
    }

    removeAttribute(name) {
        const normalizedName = String(name || '');
        if (normalizedName === 'id') {
            this.id = '';
            return;
        }
        if (normalizedName === 'class') {
            this.className = '';
            return;
        }
        this.attributes.delete(normalizedName);
    }

    addEventListener(type, handler) {
        const normalizedType = String(type || '');
        if (!this.eventListeners.has(normalizedType)) {
            this.eventListeners.set(normalizedType, []);
        }
        this.eventListeners.get(normalizedType).push(handler);
    }

    dispatchEvent(event) {
        const normalizedType = String(event?.type || '');
        const listeners = this.eventListeners.get(normalizedType) || [];
        listeners.forEach((listener) => {
            listener.call(this, event);
        });
        return true;
    }

    click() {
        this.dispatchEvent({
            type: 'click',
            target: this,
            currentTarget: this,
            preventDefault() {},
            stopPropagation() {},
        });
    }
}

class FakeDocument {
    constructor() {
        this._ids = new Map();
        this.head = new FakeElement('head', this);
        this.body = new FakeElement('body', this);
        this.documentElement = new FakeElement('html', this);
    }

    createElement(tagName) {
        return new FakeElement(tagName, this);
    }

    getElementById(id) {
        return this._ids.get(String(id || '')) || null;
    }

    querySelector(selector) {
        if (String(selector || '').startsWith('#')) {
            return this.getElementById(String(selector).slice(1));
        }
        return null;
    }

    registerId(element) {
        if (element && element.id) {
            this._ids.set(element.id, element);
        }
    }

    unregisterId(element) {
        if (element && element.id && this._ids.get(element.id) === element) {
            this._ids.delete(element.id);
        }
    }
}

function installFakeDom() {
    const document = new FakeDocument();
    global.HTMLElement = FakeElement;
    global.document = document;
    return document;
}

function restoreGlobals() {
    global.document = ORIGINAL_GLOBALS.document;
    global.HTMLElement = ORIGINAL_GLOBALS.HTMLElement;
    global.localStorage = ORIGINAL_GLOBALS.localStorage;
}

function buildClinicProfile(overrides = {}) {
    return {
        clinic_id: 'clinica-demo',
        branding: {
            name: 'Clinica Demo',
            short_name: 'Demo',
        },
        ...overrides,
    };
}

test.beforeEach(() => {
    installLocalStorageMock();
});

test.afterEach(() => {
    restoreGlobals();
});

test('package console renders and persists form actions', async () => {
    const module = await importRepoModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-package-console.js'
    );

    const host = new FakeElement('div', 'queueSurfacePackageConsoleHost');
    const clipboardWrites = [];
    const downloadClicks = [];
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-package',
        branding: {
            name: 'Clinica Package',
            short_name: 'Package',
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
            HTMLElement: FakeElement,
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
                    return 'blob:turnero-package';
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
            const mounted = module.mountTurneroAdminQueueSurfacePackageConsole(
                host,
                {
                    scope: 'regional',
                    clinicProfile,
                    snapshots: [
                        {
                            surfaceKey: 'operator',
                            packageTier: 'pilot-plus',
                            packageOwner: 'ops-lead',
                            bundleState: 'watch',
                            provisioningState: 'watch',
                            onboardingKitState: 'draft',
                        },
                        {
                            surfaceKey: 'kiosk',
                            packageTier: 'pilot',
                            packageOwner: '',
                            bundleState: 'draft',
                            provisioningState: 'draft',
                            onboardingKitState: 'draft',
                        },
                        {
                            surfaceKey: 'display',
                            packageTier: 'pilot-plus',
                            packageOwner: 'ops-display',
                            bundleState: 'ready',
                            provisioningState: 'ready',
                            onboardingKitState: 'ready',
                        },
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
            assert.match(host.textContent, /Surface Package Standardization/);

            const clickHandlers = mounted.root.eventListeners.get('click') || [];
            const clickHandler = clickHandlers[0];

            await clickHandler({ target: createActionTarget('copy-brief') });
            await clickHandler({ target: createActionTarget('download-json') });
            await clickHandler({ target: createActionTarget('refresh') });

            assert.equal(mounted.state.surfacePacks.length, 3);
            assert.equal(mounted.state.gate.band, 'blocked');
            assert.equal(clipboardWrites.length, 1);
            assert.equal(downloadClicks.length, 1);
            assert.match(host.textContent, /Turnero Operador/);
            assert.match(host.textContent, /Turnero Sala TV/);
        }
    );
});

function createDocumentStub(host, downloadClicks) {
    const head = new FakeElement('head', null);
    const body = new FakeElement('body', null);

    return {
        head,
        body,
        createElement(tag) {
            const node = new FakeElement(tag);
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
            return String(id) === 'queueSurfacePackageConsoleHost'
                ? host
                : null;
        },
        querySelector() {
            return null;
        },
    };
}

function createActionTarget(action) {
    const target = new FakeElement('button');
    target.dataset.action = action;
    target.closest = (selector) =>
        String(selector || '').includes('[data-action]') ? target : null;
    return target;
}

async function withGlobals(setup, callback) {
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
