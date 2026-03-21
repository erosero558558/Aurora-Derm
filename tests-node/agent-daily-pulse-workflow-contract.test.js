#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const yaml = require('yaml');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'agent-daily-pulse.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('agent-daily-pulse expone schedule diario y dispatch manual', () => {
    const { parsed } = loadWorkflow();
    assert.equal(parsed?.permissions?.contents, 'write');
    assert.equal(parsed?.on?.workflow_dispatch !== undefined, true);
    assert.equal(
        Array.isArray(parsed?.on?.schedule) &&
            parsed.on.schedule.some((item) => item?.cron === '15 11 * * *'),
        true
    );
});

test('agent-daily-pulse corre intake score stale y pulse apply en perfil ci', () => {
    const { raw } = loadWorkflow();
    assert.equal(
        raw.includes('node agent-orchestrator.js intake --strict'),
        true
    );
    assert.equal(raw.includes('node agent-orchestrator.js score'), true);
    assert.equal(
        raw.includes('node agent-orchestrator.js stale --strict'),
        true
    );
    assert.equal(
        raw.includes('node bin/agent-daily-pulse.js --profile ci --apply'),
        true
    );
});

test('agent-daily-pulse commitea surfaces esperadas y sube artifact', () => {
    const { raw } = loadWorkflow();
    assert.equal(
        raw.includes(
            'git diff --quiet -- AGENT_BOARD.yaml AGENT_SIGNALS.yaml verification'
        ),
        true
    );
    assert.equal(
        raw.includes(
            'git add AGENT_BOARD.yaml AGENT_SIGNALS.yaml verification'
        ),
        true
    );
    assert.equal(
        raw.includes(
            'node bin/sync-main-safe.js --remote origin --branch "${GITHUB_REF_NAME}" --max-sync-attempts 3 --json'
        ),
        true
    );
    assert.equal(raw.includes('actions/upload-artifact@v4'), true);
    assert.equal(raw.includes('verification/daily-ops/'), true);
    assert.equal(
        raw.includes('verification/agent-daily-pulse-history.json'),
        true
    );
});
