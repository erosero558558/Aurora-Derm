#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = resolve(__dirname, '..');

async function loadModule(relativePath) {
    return import(pathToFileURL(resolve(REPO_ROOT, relativePath)).href);
}

function createClinicalState(baseState, overrides = {}) {
    return {
        ...baseState,
        auth: {
            ...baseState.auth,
            authenticated: true,
            capabilities: {
                ...baseState.auth.capabilities,
                adminAgent: true,
            },
            ...(overrides.auth || {}),
        },
        ui: {
            ...baseState.ui,
            activeSection: 'clinical-history',
            lastRefreshAt: 1710526800000,
            ...(overrides.ui || {}),
        },
        data: {
            ...baseState.data,
            availabilityMeta: {
                mode: 'live',
            },
            leadOpsMeta: {
                worker: {
                    mode: 'enabled',
                },
            },
            queueMeta: {
                updatedAt: '2026-03-15T13:00:00.000Z',
            },
            clinicalHistoryMeta: {
                reviewQueue: [
                    {
                        sessionId: 'chs-001',
                        caseId: 'case-001',
                        patientName: 'Ana Ruiz',
                        reviewStatus: 'review_required',
                        requiresHumanReview: true,
                        reviewReasons: ['dose_ambiguous'],
                        pendingAiStatus: 'queued',
                        attachmentCount: 1,
                        openEventCount: 1,
                        highestOpenSeverity: 'warning',
                        latestOpenEventTitle: 'Ajustar dosis',
                    },
                ],
            },
            mediaFlowMeta: {
                queue: [
                    {
                        caseId: 'case-001',
                        patientName: 'Ana Ruiz',
                    },
                    {
                        caseId: 'case-002',
                        patientName: 'Bruno Paz',
                    },
                ],
            },
            ...(overrides.data || {}),
        },
        clinicalHistory: {
            ...baseState.clinicalHistory,
            activeWorkspace: 'review',
            queueFilter: 'alert',
            selectedSessionId: 'chs-001',
            current: {
                session: {
                    sessionId: 'chs-001',
                    caseId: 'case-001',
                    patient: {
                        name: 'Ana Ruiz',
                    },
                },
                draft: {
                    reviewStatus: 'review_required',
                },
                events: [
                    {
                        severity: 'warning',
                    },
                ],
            },
            draftForm: {
                sessionId: 'chs-001',
                caseId: 'case-001',
            },
            ...(overrides.clinicalHistory || {}),
        },
        caseMediaFlow: {
            ...baseState.caseMediaFlow,
            selectedCaseId: 'case-002',
            current: {
                caseId: 'case-002',
                summary: {
                    headline: 'Caso editorial Bruno',
                },
                proposal: {
                    proposalId: 'prop-002',
                    selectedAssetIds: ['asset-1', 'asset-2'],
                },
                mediaAssets: [{ assetId: 'asset-1' }, { assetId: 'asset-2' }],
                publication: {
                    status: 'draft',
                },
                policy: {
                    status: 'eligible',
                },
            },
            ...(overrides.caseMediaFlow || {}),
        },
    };
}

function createClassList() {
    const values = new Set();
    return {
        add(...tokens) {
            tokens.forEach((token) => values.add(String(token)));
        },
        remove(...tokens) {
            tokens.forEach((token) => values.delete(String(token)));
        },
        toggle(token, force) {
            const value = String(token);
            if (force === undefined) {
                if (values.has(value)) {
                    values.delete(value);
                    return false;
                }
                values.add(value);
                return true;
            }
            if (force) {
                values.add(value);
                return true;
            }
            values.delete(value);
            return false;
        },
        contains(token) {
            return values.has(String(token));
        },
        toString() {
            return Array.from(values).join(' ');
        },
    };
}

class HTMLElementStub {
    constructor() {
        this.attributes = new Map();
        this.classList = createClassList();
        this.dataset = {};
        this.disabled = false;
        this.hidden = false;
        this.innerHTML = '';
        this.textContent = '';
        this.value = '';
        this.focused = false;
    }

    setAttribute(name, value) {
        this.attributes.set(String(name), String(value));
    }

    getAttribute(name) {
        return this.attributes.get(String(name));
    }

    removeAttribute(name) {
        this.attributes.delete(String(name));
    }

    focus() {
        this.focused = true;
    }

    closest() {
        return null;
    }
}

class HTMLButtonElementStub extends HTMLElementStub {}

class HTMLTextAreaElementStub extends HTMLElementStub {}

function installAgentDomEnvironment() {
    const previousDocument = global.document;
    const previousWindow = global.window;
    const previousFetch = global.fetch;
    const previousHTMLElement = global.HTMLElement;
    const previousHTMLButtonElement = global.HTMLButtonElement;
    const previousHTMLTextAreaElement = global.HTMLTextAreaElement;

    const requests = [];
    const elements = new Map();

    function elementForSelector(selector) {
        const key = String(selector);
        if (elements.has(key)) {
            return elements.get(key);
        }

        let element;
        if (key === '#adminAgentPrompt') {
            element = new HTMLTextAreaElementStub();
        } else if (
            key === '#adminAgentSubmitBtn' ||
            key === '[data-action="open-agent-panel"]'
        ) {
            element = new HTMLButtonElementStub();
        } else {
            element = new HTMLElementStub();
        }

        if (key === '#adminAgentPanel') {
            element.classList.add('is-hidden');
        }

        elements.set(key, element);
        return element;
    }

    global.HTMLElement = HTMLElementStub;
    global.HTMLButtonElement = HTMLButtonElementStub;
    global.HTMLTextAreaElement = HTMLTextAreaElementStub;
    global.document = {
        body: new HTMLElementStub(),
        documentElement: new HTMLElementStub(),
        activeElement: null,
        createElement() {
            return new HTMLElementStub();
        },
        getElementById(id) {
            return elementForSelector(`#${id}`);
        },
        querySelector(selector) {
            return elementForSelector(selector);
        },
        querySelectorAll() {
            return [];
        },
    };
    global.window = {
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
        confirm() {
            return true;
        },
    };
    global.fetch = async (url, init = {}) => {
        requests.push({
            url: String(url),
            method: String(init.method || 'GET').toUpperCase(),
            body: init.body ? JSON.parse(init.body) : null,
        });

        return {
            ok: true,
            status: 200,
            async text() {
                return JSON.stringify({
                    ok: true,
                    data: {
                        session: null,
                        outbox: [],
                        health: {
                            relay: {
                                mode: 'disabled',
                            },
                            counts: {
                                messages: 0,
                                turns: 0,
                                toolCalls: 0,
                                pendingApprovals: 0,
                                outboxQueued: 0,
                                outboxTotal: 0,
                            },
                        },
                        tools: [],
                    },
                });
            },
        };
    };

    return {
        requests,
        elements,
        restore() {
            if (previousDocument === undefined) {
                delete global.document;
            } else {
                global.document = previousDocument;
            }

            if (previousWindow === undefined) {
                delete global.window;
            } else {
                global.window = previousWindow;
            }

            if (previousFetch === undefined) {
                delete global.fetch;
            } else {
                global.fetch = previousFetch;
            }

            if (previousHTMLElement === undefined) {
                delete global.HTMLElement;
            } else {
                global.HTMLElement = previousHTMLElement;
            }

            if (previousHTMLButtonElement === undefined) {
                delete global.HTMLButtonElement;
            } else {
                global.HTMLButtonElement = previousHTMLButtonElement;
            }

            if (previousHTMLTextAreaElement === undefined) {
                delete global.HTMLTextAreaElement;
            } else {
                global.HTMLTextAreaElement = previousHTMLTextAreaElement;
            }
        },
    };
}

test('buildAgentContextFromState prioriza el review clinico activo', async () => {
    const agentModule = await loadModule(
        'src/apps/admin-v3/shared/modules/agent.js'
    );
    const store = await loadModule('src/apps/admin-v3/shared/core/store.js');
    store.resetState();
    const state = createClinicalState(structuredClone(store.getState()));

    const context = agentModule.buildAgentContextFromState(state);

    assert.equal(context.section, 'clinical-history');
    assert.equal(context.workspace, 'review');
    assert.equal(context.caseId, 'case-001');
    assert.deepEqual(context.visibleIds, ['chs-001']);
    assert.deepEqual(context.filters, {
        workspace: 'review',
        queueFilter: 'alert',
        reviewStatus: 'review_required',
    });
    assert.deepEqual(context.selectedEntity, {
        type: 'clinical_session',
        id: 0,
        ref: 'chs-001',
        label: 'Ana Ruiz',
    });
    assert.deepEqual(context.domainContext, {
        sessionId: 'chs-001',
        caseId: 'case-001',
        proposalId: '',
        selectedAssetIds: [],
    });
});

test('buildAgentContextFromState usa contexto editorial cuando el workspace es media-flow', async () => {
    const agentModule = await loadModule(
        'src/apps/admin-v3/shared/modules/agent.js'
    );
    const store = await loadModule('src/apps/admin-v3/shared/core/store.js');
    store.resetState();
    const state = createClinicalState(structuredClone(store.getState()), {
        clinicalHistory: {
            activeWorkspace: 'media-flow',
        },
    });

    const context = agentModule.buildAgentContextFromState(state);

    assert.equal(context.workspace, 'media-flow');
    assert.equal(context.caseId, 'case-002');
    assert.equal(context.proposalId, 'prop-002');
    assert.deepEqual(context.selectedAssetIds, ['asset-1', 'asset-2']);
    assert.deepEqual(context.visibleIds, ['case-001', 'case-002']);
    assert.deepEqual(context.selectedEntity, {
        type: 'case_media',
        id: 0,
        ref: 'case-002',
        label: 'Caso editorial Bruno',
    });
    assert.deepEqual(context.domainContext, {
        sessionId: 'chs-001',
        caseId: 'case-002',
        proposalId: 'prop-002',
        selectedAssetIds: ['asset-1', 'asset-2'],
    });
});

test('normalizeClinicalHistoryWorkspace y filterClinicalReviewQueue respetan el triage esperado', async () => {
    const clinicalHistoryModule = await loadModule(
        'src/apps/admin-v3/sections/clinical-history/render/index.js'
    );
    const queue = [
        {
            sessionId: 'chs-review',
            reviewStatus: 'review_required',
            requiresHumanReview: true,
            pendingAiStatus: '',
            openEventCount: 0,
            highestOpenSeverity: '',
            attachmentCount: 0,
        },
        {
            sessionId: 'chs-ai',
            reviewStatus: 'ready_for_review',
            requiresHumanReview: false,
            pendingAiStatus: 'queued',
            openEventCount: 0,
            highestOpenSeverity: '',
            attachmentCount: 0,
        },
        {
            sessionId: 'chs-alert',
            reviewStatus: 'approved',
            requiresHumanReview: false,
            pendingAiStatus: '',
            openEventCount: 2,
            highestOpenSeverity: 'critical',
            attachmentCount: 3,
        },
    ];

    assert.equal(
        clinicalHistoryModule.normalizeClinicalHistoryWorkspace('media_flow'),
        'media-flow'
    );
    assert.equal(
        clinicalHistoryModule.normalizeClinicalHistoryWorkspace(
            'cualquier-cosa'
        ),
        'review'
    );
    assert.deepEqual(
        clinicalHistoryModule
            .filterClinicalReviewQueue(queue, 'review_required')
            .map((item) => item.sessionId),
        ['chs-review', 'chs-ai']
    );
    assert.deepEqual(
        clinicalHistoryModule
            .filterClinicalReviewQueue(queue, 'pending_ai')
            .map((item) => item.sessionId),
        ['chs-ai']
    );
    assert.deepEqual(
        clinicalHistoryModule
            .filterClinicalReviewQueue(queue, 'alert')
            .map((item) => item.sessionId),
        ['chs-alert']
    );
    assert.deepEqual(
        clinicalHistoryModule
            .filterClinicalReviewQueue(queue, 'with_attachments')
            .map((item) => item.sessionId),
        ['chs-alert']
    );
});

test('resolveMediaFlowSelection sigue el caso clinico seleccionado y marca cuando falta media', async () => {
    const mediaFlowModule = await loadModule(
        'src/apps/admin-v3/sections/clinical-history/render/media-flow.js'
    );

    assert.deepEqual(
        mediaFlowModule.resolveMediaFlowSelection({
            clinicalCaseId: 'case-001',
            selectedCaseId: 'case-002',
            queue: [{ caseId: 'case-001' }, { caseId: 'case-003' }],
        }),
        {
            preferredCaseId: 'case-001',
            linkedCaseMissing: false,
        }
    );
    assert.deepEqual(
        mediaFlowModule.resolveMediaFlowSelection({
            clinicalCaseId: 'case-999',
            selectedCaseId: 'case-002',
            queue: [{ caseId: 'case-001' }, { caseId: 'case-003' }],
        }),
        {
            preferredCaseId: 'case-999',
            linkedCaseMissing: true,
        }
    );
    assert.deepEqual(
        mediaFlowModule.resolveMediaFlowSelection({
            clinicalCaseId: '',
            selectedCaseId: 'case-003',
            queue: [{ caseId: 'case-001' }, { caseId: 'case-003' }],
        }),
        {
            preferredCaseId: 'case-003',
            linkedCaseMissing: false,
        }
    );
});

test('openAgentPanelExperience acepta contextOverride y preserva contexto editorial en el panel global', async () => {
    const agentModule = await loadModule(
        'src/apps/admin-v3/shared/modules/agent.js'
    );
    const store = await loadModule('src/apps/admin-v3/shared/core/store.js');
    const dom = installAgentDomEnvironment();

    try {
        store.resetState();
        const state = createClinicalState(structuredClone(store.getState()), {
            clinicalHistory: {
                activeWorkspace: 'media-flow',
            },
        });
        store.setState(state);

        await agentModule.openAgentPanelExperience({
            contextOverride: {
                workspace: 'media-flow',
                caseId: 'case-002',
                proposalId: 'prop-002',
                selectedAssetIds: ['asset-1', 'asset-2'],
            },
        });

        const nextState = store.getState();
        assert.equal(nextState.agent.open, true);
        assert.equal(nextState.agent.context.workspace, 'media-flow');
        assert.equal(nextState.agent.context.caseId, 'case-002');
        assert.equal(nextState.agent.context.proposalId, 'prop-002');
        assert.deepEqual(nextState.agent.context.selectedAssetIds, [
            'asset-1',
            'asset-2',
        ]);
        assert.equal(
            dom.requests[0].url,
            '/api.php?resource=admin-agent-status'
        );
        assert.equal(
            dom.elements.get('#adminAgentContextMeta').textContent,
            'case case-002 · prop-002'
        );
    } finally {
        dom.restore();
        store.resetState();
    }
});
