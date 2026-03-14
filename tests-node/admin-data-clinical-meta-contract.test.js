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

test('normalizers preservan metas clinicas e internas del admin shell', async () => {
    const { normalizeAdminDataPayload, normalizeAdminStorePayload } =
        await loadModule(
            'src/apps/admin-v3/shared/modules/data/normalizers.js'
        );

    const payload = {
        patientFlowMeta: {
            casesTotal: 3,
        },
        clinicalHistoryMeta: {
            summary: {
                reviewQueueCount: 2,
            },
            reviewQueue: [{ sessionId: 'chs-001' }],
            events: [{ eventId: 'che-001' }],
        },
        mediaFlowMeta: {
            summary: {
                totalCases: 1,
            },
            queue: [{ caseId: 'case-001' }],
            recentEvents: [{ eventId: 'mfe-001' }],
        },
        telemedicineMeta: {
            summary: {
                reviewQueueCount: 1,
            },
            reviewQueue: [{ intakeId: 601 }],
        },
        internalConsoleMeta: {
            clinicalData: {
                ready: false,
            },
        },
    };

    const normalized = normalizeAdminDataPayload(payload, null, {});
    const storePayload = normalizeAdminStorePayload(normalized, null);

    assert.deepEqual(normalized.patientFlowMeta, payload.patientFlowMeta);
    assert.deepEqual(
        normalized.clinicalHistoryMeta,
        payload.clinicalHistoryMeta
    );
    assert.deepEqual(normalized.mediaFlowMeta, payload.mediaFlowMeta);
    assert.deepEqual(normalized.telemedicineMeta, payload.telemedicineMeta);
    assert.deepEqual(
        normalized.internalConsoleMeta,
        payload.internalConsoleMeta
    );

    assert.deepEqual(storePayload.patientFlowMeta, payload.patientFlowMeta);
    assert.deepEqual(
        storePayload.clinicalHistoryMeta,
        payload.clinicalHistoryMeta
    );
    assert.deepEqual(storePayload.mediaFlowMeta, payload.mediaFlowMeta);
    assert.deepEqual(storePayload.telemedicineMeta, payload.telemedicineMeta);
    assert.deepEqual(
        storePayload.internalConsoleMeta,
        payload.internalConsoleMeta
    );
});

test('normalizers usan fallback para metas clinicas cuando /data llega parcial', async () => {
    const { normalizeAdminDataPayload } = await loadModule(
        'src/apps/admin-v3/shared/modules/data/normalizers.js'
    );

    const fallbackState = {
        patientFlowMeta: {
            casesTotal: 4,
        },
        clinicalHistoryMeta: {
            summary: {
                reviewQueueCount: 1,
            },
        },
        mediaFlowMeta: {
            summary: {
                totalCases: 2,
            },
        },
        telemedicineMeta: {
            summary: {
                reviewQueueCount: 3,
            },
        },
        internalConsoleMeta: {
            clinicalData: {
                ready: true,
            },
        },
    };

    const normalized = normalizeAdminDataPayload({}, null, fallbackState);

    assert.deepEqual(normalized.patientFlowMeta, fallbackState.patientFlowMeta);
    assert.deepEqual(
        normalized.clinicalHistoryMeta,
        fallbackState.clinicalHistoryMeta
    );
    assert.deepEqual(normalized.mediaFlowMeta, fallbackState.mediaFlowMeta);
    assert.deepEqual(
        normalized.telemedicineMeta,
        fallbackState.telemedicineMeta
    );
    assert.deepEqual(
        normalized.internalConsoleMeta,
        fallbackState.internalConsoleMeta
    );
});
