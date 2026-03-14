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

test('fallback clinico prioriza telemedicina pausada cuando no hay sesiones', async () => {
    const { buildClinicalHistoryActions } = await loadModule(
        'src/apps/admin-v3/sections/dashboard/markup/actions.js'
    );

    const markup = buildClinicalHistoryActions({
        clinicalHistoryMeta: {
            summary: {
                drafts: {
                    pendingAiCount: 0,
                },
                events: {
                    unreadCount: 0,
                },
            },
            reviewQueue: [],
            events: [],
        },
        telemedicineMeta: {
            summary: {
                reviewQueueCount: 2,
            },
        },
        patientFlowMeta: {
            pendingApprovals: 1,
            activeHelpRequests: 0,
        },
        internalConsoleMeta: {
            clinicalData: {
                ready: false,
            },
        },
    });

    assert.match(markup, /data-action="context-open-clinical-history"/);
    assert.match(markup, /Abrir frente clinico/);
    assert.match(
        markup,
        /2 intake\(s\) telemedicina pausados por gate clinico/
    );
    assert.doesNotMatch(markup, /data-session-id=/);
});

test('fallback clinico usa patient flow cuando no hay intake de telemedicina', async () => {
    const { buildClinicalHistoryActions } = await loadModule(
        'src/apps/admin-v3/sections/dashboard/markup/actions.js'
    );

    const markup = buildClinicalHistoryActions({
        clinicalHistoryMeta: {
            summary: {
                drafts: {
                    pendingAiCount: 0,
                },
                events: {
                    unreadCount: 0,
                },
            },
            reviewQueue: [],
            events: [],
        },
        telemedicineMeta: {
            summary: {
                reviewQueueCount: 0,
            },
        },
        patientFlowMeta: {
            pendingApprovals: 3,
            activeHelpRequests: 0,
        },
        internalConsoleMeta: {
            clinicalData: {
                ready: true,
            },
        },
    });

    assert.match(markup, /Abrir frente clinico/);
    assert.match(markup, /3 aprobacion\(es\) pendientes en patient flow/);
});

test('acciones clinicas especificas siguen ganando sobre el fallback', async () => {
    const { buildClinicalHistoryActions } = await loadModule(
        'src/apps/admin-v3/sections/dashboard/markup/actions.js'
    );

    const markup = buildClinicalHistoryActions({
        clinicalHistoryMeta: {
            summary: {
                drafts: {
                    pendingAiCount: 0,
                },
                events: {
                    unreadCount: 0,
                },
            },
            reviewQueue: [
                {
                    sessionId: 'sess-001',
                    patientName: 'Ana Ruiz',
                    summary: 'Motivo respiratorio',
                },
            ],
            events: [],
        },
        telemedicineMeta: {
            summary: {
                reviewQueueCount: 4,
            },
        },
        patientFlowMeta: {
            pendingApprovals: 2,
            activeHelpRequests: 1,
        },
        internalConsoleMeta: {
            clinicalData: {
                ready: false,
            },
        },
    });

    assert.match(markup, /Abrir Ana Ruiz/);
    assert.match(markup, /data-session-id="sess-001"/);
    assert.doesNotMatch(
        markup,
        /intake\(s\) telemedicina pausados por gate clinico/
    );
});
