#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const WORKFLOW_PATH = resolve(
    __dirname,
    '..',
    '.github',
    'workflows',
    'deploy-frontend-selfhosted.yml'
);

function loadWorkflow() {
    return readFileSync(WORKFLOW_PATH, 'utf8');
}

test('deploy-frontend-selfhosted no depende de label kimi y mantiene runner windows self-hosted', () => {
    const raw = loadWorkflow();
    assert.equal(raw.includes('runs-on: [self-hosted, Windows]'), true);
    assert.equal(raw.includes('runs-on: [self-hosted, Windows, kimi]'), false);
});
