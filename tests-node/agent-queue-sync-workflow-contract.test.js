#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const REPO_ROOT = resolve(__dirname, '..');
const ACTIVE_WORKFLOW = '.github/workflows/agent-intake.yml';
const RETIRED_WORKFLOWS = [
    '.github/workflows/agent-autopilot.yml',
    '.github/workflows/agent-kimi-autopilot.yml',
    '.github/workflows/jules-pr.yml',
];

function loadRaw(relativePath) {
    return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

test('agent-intake usa sync-main-safe y no despacha executors retirados', () => {
    const raw = loadRaw(ACTIVE_WORKFLOW);
    assert.equal(raw.includes('node bin/sync-main-safe.js'), true);
    assert.equal(raw.includes('dispatch --agent jules'), false);
    assert.equal(raw.includes('agent-kimi-autopilot'), false);
    assert.equal(raw.includes('JULES_API_KEY'), false);
    assert.equal(raw.includes('KIMI_'), false);
    assert.equal(raw.includes('node agent-orchestrator.js jobs status --json'), true);
});

test('workflows legacy de Jules/Kimi fueron retirados del runtime CI', () => {
    for (const workflowFile of RETIRED_WORKFLOWS) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, workflowFile)),
            false,
            `${workflowFile} debe estar eliminado en modo codex-only`
        );
    }
});
