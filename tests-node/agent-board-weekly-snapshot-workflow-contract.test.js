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
    'agent-board-weekly-snapshot.yml'
);

function loadWorkflow() {
    const raw = readFileSync(WORKFLOW_PATH, 'utf8');
    return { raw, parsed: yaml.parse(raw) };
}

test('agent-board-weekly-snapshot permite write para commit de poda', () => {
    const { parsed } = loadWorkflow();
    assert.equal(parsed?.permissions?.contents, 'write');
});

test('agent-board-weekly-snapshot ejecuta archive-agent-board en modo apply', () => {
    const { raw } = loadWorkflow();
    assert.equal(raw.includes('node bin/archive-agent-board.js'), true);
    assert.equal(raw.includes('--apply'), true);
    assert.equal(raw.includes('--keep-done "${BOARD_KEEP_DONE}"'), true);
    assert.equal(
        raw.includes('--older-than-days "${BOARD_ARCHIVE_OLDER_DAYS}"'),
        true
    );
});

test('agent-board-weekly-snapshot sincroniza main con sync-main-safe al commitear', () => {
    const { raw } = loadWorkflow();
    assert.equal(raw.includes('node bin/sync-main-safe.js'), true);
    assert.equal(
        raw.includes(
            'git diff --quiet -- AGENT_BOARD.yaml verification/board-snapshots'
        ),
        true
    );
    assert.equal(raw.includes('JULES_TASKS.md'), false);
    assert.equal(raw.includes('KIMI_TASKS.md'), false);
});
