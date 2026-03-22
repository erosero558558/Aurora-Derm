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

function createDocumentStub(host, downloadClicks, downloadEvents) {
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
            return String(id) === String(host.id) ? host : null;
        },
        querySelector() {
            return null;
        },
    };
}

function buildConsoleInput() {
    const clinicProfile = buildClinicProfile({
        clinic_id: 'clinica-roadmap-console',
        branding: {
            name: 'Clinica Roadmap Console',
            short_name: 'Roadmap Console',
            city: 'Quito',
        },
        region: 'sierra',
        surfaces: {
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
    });

    return {
        clinicProfile,
        scope: 'regional',
        releaseManifest: {
            id: 'release-roadmap-console',
            version: '2026.03.21',
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
                roadmapBand: 'core',
                backlogState: 'curated',
                nextAction: 'stabilize-operator-lane',
                priorityBand: 'p1',
                roadmapOwner: 'ops-lead',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
            {
                surfaceKey: 'kiosco-turnos',
                runtimeState: 'ready',
                truth: 'watch',
                roadmapBand: 'watch',
                backlogState: 'draft',
                nextAction: 'close-hardware-gaps',
                priorityBand: 'p2',
                roadmapOwner: '',
                checklist: { summary: { all: 4, pass: 2, fail: 2 } },
            },
            {
                surfaceKey: 'sala-turnos',
                runtimeState: 'ready',
                truth: 'aligned',
                roadmapBand: 'core',
                backlogState: 'curated',
                nextAction: 'analytics-board',
                priorityBand: 'p1',
                roadmapOwner: 'ops-display',
                checklist: { summary: { all: 4, pass: 3, fail: 1 } },
            },
        ],
        checklist: { summary: { all: 6, pass: 4, fail: 2 } },
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

test('console html renders roadmap surfaces and actions', async () => {
    const module = await loadModule(
        'src/apps/queue-shared/turnero-admin-queue-surface-roadmap-console.js'
    );

    const html = module.buildTurneroAdminQueueSurfaceRoadmapConsoleHtml(
        buildConsoleInput()
    );

    assert.match(html, /Surface Roadmap Prioritization/);
    assert.match(html, /Copy brief/);
    assert.match(html, /Download JSON/);
    assert.match(html, /Add roadmap item/);
    assert.match(html, /Add owner/);
    assert.match(html, /Turnero Operador/);
    assert.match(html, /Turnero Kiosco/);
    assert.match(html, /Turnero Sala TV/);
    assert.match(html, /data-role="banner"/);
    assert.match(html, /data-role="chips"/);
});

test('mount wires copy/download plus add-entry and add-owner flows', async () => {
    const clipboardTexts = [];
    const downloadClicks = [];
    const downloadEvents = [];
    const consoleInput = buildConsoleInput();
    const ledgerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-ledger.js'
    );
    const ownerModule = await loadModule(
        'src/apps/queue-shared/turnero-surface-roadmap-owner-store.js'
    );
    const host = new FakeElement('div', 'queueSurfaceRoadmapConsoleHost');

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
                    return 'blob:turnero-surface-roadmap-console';
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
                'src/apps/queue-shared/turnero-admin-queue-surface-roadmap-console.js'
            );

            const result = module.mountTurneroAdminQueueSurfaceRoadmapConsole(
                host,
                consoleInput
            );

            assert.ok(result);
            assert.equal(result.root, host.children[0]);
            assert.equal(
                result.root.dataset.turneroAdminQueueSurfaceRoadmapConsole,
                'mounted'
            );
            assert.equal(
                result.root.dataset.turneroAdminQueueSurfaceRoadmapScope,
                'regional'
            );
            assert.equal(result.state.surfacePacks.length, 3);
            assert.match(result.root.innerHTML, /Surface Roadmap Prioritization/);
            assert.match(result.root.innerHTML, /Add roadmap item/);
            assert.match(result.root.innerHTML, /Add owner/);

            const overviewBanner = result.root.querySelector('[data-role="banner"]');
            assert.match(overviewBanner.innerHTML, /Surface Roadmap Prioritization/);

            const operatorCard = result.root.querySelector(
                '[data-surface-key="operator-turnos"]'
            );
            const kioskCard = result.root.querySelector(
                '[data-surface-key="kiosco-turnos"]'
            );
            const displayCard = result.root.querySelector(
                '[data-surface-key="sala-turnos"]'
            );

            assert.equal(
                operatorCard.querySelector('[data-role="chips"]').children.length,
                4
            );
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

            assert.equal(clipboardTexts.length, 1);
            assert.match(clipboardTexts[0], /# Surface Roadmap Prioritization/);
            assert.equal(downloadClicks.length, 1);
            assert.equal(
                downloadClicks[0].download,
                'turnero-surface-roadmap-console.json'
            );
            assert.ok(downloadEvents.some((event) => event.kind === 'blob'));
            assert.ok(downloadEvents.some((event) => event.kind === 'url'));
            assert.ok(
                downloadEvents.some((event) => event.kind === 'anchor-click')
            );

            const entryForm = createActionForm('add-entry');
            setFieldValue(
                entryForm,
                '[data-field="entry-surface-key"]',
                'kiosco-turnos'
            );
            setFieldValue(entryForm, '[data-field="entry-status"]', 'planned');
            setFieldValue(entryForm, '[data-field="entry-priority-band"]', 'p2');
            setFieldValue(entryForm, '[data-field="entry-owner"]', 'ops');
            setFieldValue(
                entryForm,
                '[data-field="entry-title"]',
                'Kiosk hardware followup'
            );
            setFieldValue(
                entryForm,
                '[data-field="entry-next-action"]',
                'close-hardware-gaps'
            );
            setFieldValue(
                entryForm,
                '[data-field="entry-note"]',
                'Printer and enclosure review.'
            );

            submitHandler({
                preventDefault() {},
                target: entryForm,
            });

            const freshLedgerStore =
                ledgerModule.createTurneroSurfaceRoadmapLedger(
                    'regional',
                    consoleInput.clinicProfile
                );
            const freshOwnerStore =
                ownerModule.createTurneroSurfaceRoadmapOwnerStore(
                    'regional',
                    consoleInput.clinicProfile
                );

            assert.equal(
                freshLedgerStore.list({ surfaceKey: 'kiosk' }).length,
                1
            );
            assert.equal(
                freshLedgerStore.list({ surfaceKey: 'kiosk' })[0].title,
                'Kiosk hardware followup'
            );

            const ownerForm = createActionForm('add-owner');
            setFieldValue(
                ownerForm,
                '[data-field="owner-surface-key"]',
                'kiosco-turnos'
            );
            setFieldValue(ownerForm, '[data-field="owner-actor"]', 'carla');
            setFieldValue(ownerForm, '[data-field="owner-role"]', 'product');
            setFieldValue(ownerForm, '[data-field="owner-status"]', 'active');
            setFieldValue(
                ownerForm,
                '[data-field="owner-note"]',
                'Roadmap product owner.'
            );

            submitHandler({
                preventDefault() {},
                target: ownerForm,
            });

            assert.equal(
                freshOwnerStore.list({ surfaceKey: 'kiosk' }).length,
                1
            );
            assert.equal(
                freshOwnerStore.list({ surfaceKey: 'kiosk' })[0].actor,
                'carla'
            );

            result.destroy();
            assert.equal(result.root.listeners.has('click'), false);
            assert.equal(result.root.listeners.has('submit'), false);
        }
    );
});
