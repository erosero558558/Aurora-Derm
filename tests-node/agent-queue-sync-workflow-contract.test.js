#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const WORKFLOW_FILES = [
    '.github/workflows/agent-intake.yml',
    '.github/workflows/agent-autopilot.yml',
    '.github/workflows/agent-kimi-autopilot.yml',
    '.github/workflows/jules-pr.yml',
];

function loadWorkflowRaw(relativePath) {
    return readFileSync(resolve(__dirname, '..', relativePath), 'utf8');
}

test('workflows de cola usan sync-main-safe para sincronizar cambios', () => {
    for (const workflowFile of WORKFLOW_FILES) {
        const raw = loadWorkflowRaw(workflowFile);
        assert.equal(
            raw.includes('node bin/sync-main-safe.js'),
            true,
            `${workflowFile} debe usar sync-main-safe`
        );
    }
});

test('workflows de cola no usan push/pull manual en el paso de commit', () => {
    const forbiddenSnippets = [
        'git pull --rebase origin',
        'git push origin "HEAD:${GITHUB_REF_NAME}"',
        'git push origin "HEAD:$env:GITHUB_REF_NAME"',
        'git push origin HEAD:main',
    ];

    for (const workflowFile of WORKFLOW_FILES) {
        const raw = loadWorkflowRaw(workflowFile);
        for (const forbiddenSnippet of forbiddenSnippets) {
            assert.equal(
                raw.includes(forbiddenSnippet),
                false,
                `${workflowFile} no debe contener: ${forbiddenSnippet}`
            );
        }
    }
});
