#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(
    __dirname,
    '..',
    'bin',
    'write-admin-rollout-placeholder-report.js'
);

const {
    buildAdminRolloutPlaceholderReport,
} = require('../bin/write-admin-rollout-placeholder-report.js');

test('admin rollout placeholder report conserva contexto de preflight', () => {
    const report = buildAdminRolloutPlaceholderReport({
        reason: 'deploy_hosting_precheck_not_executed',
        domain: 'https://pielarmonia.com',
        stage: 'general',
        preflightOutcome: 'failure',
        resolvePostdeployOutcome: 'skipped',
        transportPreflightReason: 'runner_tcp_unreachable',
        transportPreflightTarget: 'sftp:22',
    });

    assert.equal(report.status, 'skipped');
    assert.equal(report.skipped, true);
    assert.equal(report.reason, 'deploy_hosting_precheck_not_executed');
    assert.equal(report.preflight_outcome, 'failure');
    assert.equal(report.resolve_postdeploy_outcome, 'skipped');
    assert.equal(report.transport_preflight_reason, 'runner_tcp_unreachable');
    assert.equal(report.transport_preflight_target, 'sftp:22');
});

test('admin rollout placeholder report se escribe cuando falta el gate real', () => {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'admin-rollout-placeholder-')
    );
    const outputPath = path.join(tempDir, 'report.json');

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--out',
            outputPath,
            '--reason',
            'deploy_hosting_precheck_not_executed',
        ],
        {
            encoding: 'utf8',
            env: {
                ...process.env,
                PROD_URL: 'https://pielarmonia.com',
                ADMIN_ROLLOUT_STAGE_EFFECTIVE: 'general',
                PREFLIGHT_OUTCOME: 'failure',
                RESOLVE_POSTDEPLOY_OUTCOME: 'skipped',
                TRANSPORT_PREFLIGHT_REASON: 'runner_tcp_unreachable',
                TRANSPORT_PREFLIGHT_TARGET: 'sftp:22',
            },
        }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(report.domain, 'https://pielarmonia.com');
    assert.equal(report.stage, 'general');
    assert.equal(report.preflight_outcome, 'failure');
    assert.equal(report.resolve_postdeploy_outcome, 'skipped');
    assert.equal(report.transport_preflight_reason, 'runner_tcp_unreachable');
    assert.equal(report.transport_preflight_target, 'sftp:22');
});
