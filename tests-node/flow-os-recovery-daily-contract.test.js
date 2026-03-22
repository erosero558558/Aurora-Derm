#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_PATH = resolve(REPO_ROOT, 'package.json');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'flow-os-recovery-daily.js');
const PLAN_PATH = resolve(REPO_ROOT, 'docs', 'FLOW_OS_RECOVERY_PLAN.md');
const STATUS_PATH = resolve(REPO_ROOT, 'docs', 'PRODUCT_OPERATIONAL_STATUS.md');
const README_PATH = resolve(REPO_ROOT, 'README.md');
const OPERATIONS_INDEX_PATH = resolve(REPO_ROOT, 'docs', 'OPERATIONS_INDEX.md');
const PROD_README_PATH = resolve(
    REPO_ROOT,
    'scripts',
    'ops',
    'prod',
    'README.md'
);

function load(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('package.json expone el ritual diario canonico de recovery', () => {
    const pkg = JSON.parse(load(PACKAGE_PATH));
    assert.equal(
        pkg.scripts['flow-os:recovery:daily'],
        'node bin/flow-os-recovery-daily.js --domain https://pielarmonia.com'
    );
});

test('flow-os-recovery-daily orquesta readiness summary y diagnostico Operator Auth', () => {
    const raw = load(SCRIPT_PATH);
    const requiredSnippets = [
        'flow-os-recovery-2026-03-21',
        '2026-03-21',
        '2026-04-20',
        'admin v3 + queue/turnero + auth Google + readiness + deploy',
        'docs/PRODUCT_OPERATIONAL_STATUS.md',
        'docs/FLOW_OS_RECOVERY_PLAN.md',
        'verification/runtime/flow-os-recovery-daily.json',
        "runNodeScript('bin/prod-readiness-summary.js'",
        '--print-json',
        "'bin/admin-openclaw-rollout-diagnostic.js'",
        '--allow-not-ready',
        'verification/runtime/prod-readiness-summary.json',
        'verification/runtime/prod-readiness-summary.md',
        'verification/last-admin-openclaw-auth-diagnostic.json',
    ];

    for (const snippet of requiredSnippets) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta wiring del ritual diario en bin/flow-os-recovery-daily.js: ${snippet}`
        );
    }
});

test('la documentacion viva referencia el recovery cycle como corte operativo', () => {
    for (const [filePath, requiredSnippets] of [
        [
            PLAN_PATH,
            [
                '2026-03-21 -> 2026-04-20',
                'npm run flow-os:recovery:daily',
                'admin v3',
                'queue/turnero',
                'auth Google',
            ],
        ],
        [
            STATUS_PATH,
            [
                'docs/FLOW_OS_RECOVERY_PLAN.md',
                'npm run flow-os:recovery:daily',
                'Ciclo de recuperacion 2026-03-21 -> 2026-04-20',
            ],
        ],
        [
            README_PATH,
            [
                'docs/FLOW_OS_RECOVERY_PLAN.md',
                'docs/PRODUCT_OPERATIONAL_STATUS.md',
                'Recovery cycle activo `2026-03-21 -> 2026-04-20`',
            ],
        ],
        [
            OPERATIONS_INDEX_PATH,
            [
                'docs/FLOW_OS_RECOVERY_PLAN.md',
                'npm run flow-os:recovery:daily',
                'freeze duro en `admin v3 + queue/turnero + auth Google + readiness + deploy`',
            ],
        ],
        [
            PROD_README_PATH,
            [
                'npm run flow-os:recovery:daily',
                'verification/runtime/flow-os-recovery-daily.json',
                'Ritual diario de recuperacion',
            ],
        ],
    ]) {
        const raw = load(filePath);
        for (const snippet of requiredSnippets) {
            assert.equal(
                raw.includes(snippet),
                true,
                `falta documentacion del recovery cycle en ${filePath}: ${snippet}`
            );
        }
    }
});
