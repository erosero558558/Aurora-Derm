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

function buildConsoleInput() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-console',
        branding: {
            name: 'Clinica Console',
            short_name: 'Console',
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

    return {
        clinicProfile,
        scope: 'regional',
        releaseManifest: {
            id: 'release-console',
            version: '2026.03.20',
        },
        surfaceRegistry: {
            operator: {
                label: 'Turnero Operador',
            },
            kiosk: {
                label: 'Turnero Kiosco',
            },
            display: {
                label: 'Turnero Sala TV',
            },
        },
        snapshots: [
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
        ],
        checklist: { summary: { all: 6, pass: 4, fail: 2 } },
    };
}

test('console html renders executive review surfaces and actions', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-executive-review-console.js'
    );

    const html = module.buildTurneroAdminQueueSurfaceExecutiveReviewConsoleHtml(
        buildConsoleInput()
    );

    assert.match(html, /Surface Executive Review Console/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Add review item/);
    assert.match(html, /Add owner/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /data-role="banner"/);
    assert.match(html, /data-role="chips"/);
});

test('mount wires copy, download, add-review-item and add-owner flows', async () => {
    const clipboardTexts = [];
    const downloadClicks = [];
    const downloadEvents = [];
    const consoleInput = buildConsoleInput();
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-executive-review-owner-store.js'
    );
    const host = new FakeElement('div', 'queueSurfaceExecutiveReviewConsoleHost');

    await withGlobals(
        {
            HTMLElement: FakeElement,
            document: createDocumentStub(host, downloadClicks, downloadEvents),
            navigator: {
                clipboard: {
                    writeText: async (text) => {
                        clipboardTexts.push(String(text));
                    },
                },
            },
            Blob: class BlobStub {
                constructor(parts, options) {
                    this.parts = parts;
                    this.options = options;
                    downloadEvents.push({ kind: 'blob', parts, options });
                }
            },
            URL: {
                createObjectURL(blob) {
                    downloadEvents.push({ kind: 'url', blob });
                    return 'blob:turnero-surface-executive-review-console';
                },
                revokeObjectURL(href) {
                    downloadEvents.push({ kind: 'revoke', href });
                },
            },
            setTimeout(fn) {
                downloadEvents.push({ kind: 'timeout' });
                fn();
                return 0;
            },
        },
        async () => {
            const module = await loadModule(
                'src/apps/queue-shared/turnero-admin-queue-surface-executive-review-console.js'
            );

            const result = module.mountTurneroAdminQueueSurfaceExecutiveReviewConsole(
                host,
                consoleInput
            );

            assert.ok(result);
            assert.equal(result.root, host.children[0]);
            assert.equal(result.root.dataset.turneroAdminQueueSurfaceExecutiveReviewConsole, 'mounted');
            assert.equal(
                result.root.dataset.turneroAdminQueueSurfaceExecutiveReviewBand,
                'blocked'
            );
            assert.equal(result.state.surfacePacks.length, 3);
            assert.match(result.root.innerHTML, /Surface Executive Review Console/);

            const overviewBanner = result.root.querySelector('[data-role="banner"]');
            assert.match(overviewBanner.innerHTML, /Surface Executive Review Console/);

            const operatorCard = result.root.querySelector('[data-surface-key="operator"]');
            const kioskCard = result.root.querySelector('[data-surface-key="kiosk"]');
            const displayCard = result.root.querySelector('[data-surface-key="display"]');

            assert.match(
                operatorCard.querySelector('[data-role="banner"]').innerHTML,
                /Turnero Operador/
            );
            assert.match(
                kioskCard.querySelector('[data-role="banner"]').innerHTML,
                /Turnero Kiosco/
            );
            assert.match(
                displayCard.querySelector('[data-role="banner"]').innerHTML,
                /Turnero Sala TV/
            );
            assert.equal(
                operatorCard.querySelector('[data-role="chips"]').children.length,
                3
            );
            assert.equal(
                kioskCard.querySelector('[data-role="chips"]').children.length,
                3
            );
            assert.equal(
                displayCard.querySelector('[data-role="chips"]').children.length,
                3
            );

            const clickHandler = result.root.listeners.get('click');
            const submitHandler = result.root.listeners.get('submit');
            assert.equal(typeof clickHandler, 'function');
            assert.equal(typeof submitHandler, 'function');

            await clickHandler({
                preventDefault() {},
                target: createActionButton('copy-brief'),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionButton('download-json'),
            });
            await clickHandler({
                preventDefault() {},
                target: createActionButton('refresh'),
            });

            assert.equal(clipboardTexts.length, 1);
            assert.match(clipboardTexts[0], /# Surface Executive Review Console/);
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-surface-executive-review-console.json'
            );
            assert.ok(downloadEvents.some((event) => event.kind === 'blob'));
            assert.ok(downloadEvents.some((event) => event.kind === 'url'));
            assert.ok(
                downloadEvents.some((event) => event.kind === 'anchor-click')
            );

            const reviewItemForm = createActionForm('add-review-item');
            setFieldValue(
                reviewItemForm,
                '[data-field="item-surface-key"]',
                'kiosco-turnos'
            );
            setFieldValue(reviewItemForm, '[data-field="item-kind"]', 'review');
            setFieldValue(
                reviewItemForm,
                '[data-field="item-status"]',
                'approved'
            );
            setFieldValue(
                reviewItemForm,
                '[data-field="item-owner"]',
                'ops-kiosk'
            );
            setFieldValue(
                reviewItemForm,
                '[data-field="item-title"]',
                'Kiosk executive review'
            );
            setFieldValue(
                reviewItemForm,
                '[data-field="item-note"]',
                'Lista para kiosko.'
            );

            submitHandler({
                preventDefault() {},
                target: reviewItemForm,
            });

            const ownerForm = createActionForm('add-owner');
            setFieldValue(
                ownerForm,
                '[data-field="owner-surface-key"]',
                'sala-turnos'
            );
            setFieldValue(ownerForm, '[data-field="owner-actor"]', 'carla');
            setFieldValue(
                ownerForm,
                '[data-field="owner-role"]',
                'executive-review'
            );
            setFieldValue(ownerForm, '[data-field="owner-status"]', 'primary');
            setFieldValue(
                ownerForm,
                '[data-field="owner-note"]',
                'Primary owner.'
            );

            submitHandler({
                preventDefault() {},
                target: ownerForm,
            });

            const freshLedgerStore =
                ledgerModule.createTurneroSurfaceExecutiveReviewLedger(
                    'regional',
                    consoleInput.clinicProfile
                );
            const freshOwnerStore =
                ownerModule.createTurneroSurfaceExecutiveReviewOwnerStore(
                    'regional',
                    consoleInput.clinicProfile
                );

            const kioskRows = freshLedgerStore.list({ surfaceKey: 'kiosk' });
            const displayOwners = freshOwnerStore.list({ surfaceKey: 'display' });

            assert.equal(kioskRows.length, 1);
            assert.equal(kioskRows[0].title, 'Kiosk executive review');
            assert.equal(kioskRows[0].kind, 'review-item');
            assert.equal(kioskRows[0].status, 'ready');
            assert.equal(kioskRows[0].owner, 'ops-kiosk');

            assert.equal(displayOwners.length, 1);
            assert.equal(displayOwners[0].actor, 'carla');
            assert.equal(displayOwners[0].status, 'active');

            assert.equal(result.state.ledger.length, 1);
            assert.equal(result.state.owners.length, 1);
            assert.equal(result.root.dataset.turneroAdminQueueSurfaceExecutiveReviewBand, 'blocked');
            assert.match(result.root.innerHTML, /Kiosk executive review/);

            result.destroy();
            assert.equal(result.root.listeners.has('click'), false);
            assert.equal(result.root.listeners.has('submit'), false);
        }
    );
});
