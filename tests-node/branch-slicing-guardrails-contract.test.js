#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(...segments) {
    return readFileSync(resolve(REPO_ROOT, ...segments), 'utf8');
}

test('branch slicing guide documents the five preferred slices and repo-specific guardrails', () => {
    const guide = readRepoFile('docs', 'BRANCH_SLICING_GUARDRAILS.md');

    for (const snippet of [
        'One branch should answer one primary review question.',
        '`AGENTS.md` decides who owns the files.',
        '`TRI_LANE_RUNTIME_RUNBOOK.md` decides which Codex lane executes.',
        'ops/deploy',
        'queue runtime',
        'desktop shells',
        'tests',
        'governance evidence',
        '.github/workflows/**',
        'src/apps/admin-v3/**/queue/**',
        'src/apps/queue-operator/**',
        'src/apps/turnero-desktop/**',
        'tests/**',
        'tests-node/**',
        'verification/**',
        'If the branch crosses `ops/deploy`, `queue runtime`, `desktop shells`,',
        'feature/queue-runtime-*',
        'ops/*',
        'docs/*` or `chore/*` for governance evidence',
    ]) {
        assert.equal(
            guide.includes(snippet),
            true,
            `docs/BRANCH_SLICING_GUARDRAILS.md debe incluir ${snippet}`
        );
    }
});

test('front door docs link branch slicing guardrails and contribution flow keeps the default slices visible', () => {
    const expectations = [
        ['README.md', 'docs/BRANCH_SLICING_GUARDRAILS.md'],
        [
            'README.md',
            'Si una iniciativa toca ops, queue runtime, desktop, tests o governance al mismo tiempo',
        ],
        ['docs/OPERATIONS_INDEX.md', 'docs/BRANCH_SLICING_GUARDRAILS.md'],
        ['docs/OPERATIONS_INDEX.md', 'ops/deploy, queue runtime, desktop,'],
        ['docs/CONTRIBUTING.md', 'docs/BRANCH_SLICING_GUARDRAILS.md'],
        ['docs/CONTRIBUTING.md', '`ops/deploy`'],
        ['docs/CONTRIBUTING.md', '`queue runtime`'],
        ['docs/CONTRIBUTING.md', '`desktop shells`'],
        ['docs/CONTRIBUTING.md', '`tests`'],
        ['docs/CONTRIBUTING.md', '`governance evidence`'],
        ['TRI_LANE_RUNTIME_RUNBOOK.md', 'docs/BRANCH_SLICING_GUARDRAILS.md'],
        [
            'TRI_LANE_RUNTIME_RUNBOOK.md',
            'Lane ownership y branch slicing resuelven problemas distintos.',
        ],
    ];

    for (const [file, snippet] of expectations) {
        const raw = readRepoFile(file);
        assert.equal(
            raw.includes(snippet),
            true,
            `${file} debe incluir ${snippet}`
        );
    }
});

test('agent:test keeps the branch slicing contract inside the governance suite', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));
    const scripts = pkg.scripts || {};

    assert.match(
        scripts['agent:test'] || '',
        /tests-node\/branch-slicing-guardrails-contract\.test\.js/u,
        'agent:test debe ejecutar el contrato de branch slicing guardrails'
    );
});
