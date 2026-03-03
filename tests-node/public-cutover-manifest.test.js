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
    'write-public-cutover-manifest.js'
);

test('public cutover manifest composes routing/conversion evidence and bootstrap metadata', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-cutover-'));
    const routingPath = path.join(tempDir, 'routing.json');
    const conversionPath = path.join(tempDir, 'conversion.json');
    const outDir = path.join(tempDir, 'manifest');

    fs.writeFileSync(
        routingPath,
        JSON.stringify({
            passed: true,
            failures: [],
            checks: [{ route: '/es/' }],
        }),
        'utf8'
    );
    fs.writeFileSync(
        conversionPath,
        JSON.stringify({
            passed: true,
            failures: [],
            checks: [{ route: '/en/' }],
        }),
        'utf8'
    );

    const startedAt = '2026-02-27T20:00:00Z';
    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--base-url',
            'https://pielarmonia.com',
            '--label',
            'prod-cutover',
            '--out-dir',
            outDir,
            '--window-hours',
            '72',
            '--started-at',
            startedAt,
            '--routing-report',
            routingPath,
            '--conversion-report',
            conversionPath,
        ],
        { encoding: 'utf8' }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(outDir, 'public-cutover-manifest.json'),
            'utf8'
        )
    );
    assert.equal(manifest.passed, true);
    assert.equal(manifest.startedAt, '2026-02-27T20:00:00.000Z');
    assert.equal(manifest.monitorWindowHours, 72);
    assert.equal(
        manifest.monitorBootstrap.inputs.enable_public_cutover_monitor,
        'true'
    );
    assert.equal(
        manifest.monitorBootstrap.inputs.public_cutover_started_at,
        '2026-02-27T20:00:00.000Z'
    );
});

test('public cutover manifest treats skipped conversion report as passing evidence', () => {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'public-cutover-skip-')
    );
    const routingPath = path.join(tempDir, 'routing.json');
    const conversionPath = path.join(tempDir, 'conversion.json');
    const outDir = path.join(tempDir, 'manifest');

    fs.writeFileSync(
        routingPath,
        JSON.stringify({
            passed: true,
            failures: [],
            checks: [{ route: '/es/' }],
        }),
        'utf8'
    );
    fs.writeFileSync(
        conversionPath,
        JSON.stringify(
            {
                passed: true,
                skipped: true,
                failures: [],
                checks: [],
                reason: 'manual_override_skip_public_conversion_smoke',
            },
            null,
            2
        ),
        'utf8'
    );

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--base-url',
            'https://pielarmonia.com',
            '--out-dir',
            outDir,
            '--routing-report',
            routingPath,
            '--conversion-report',
            conversionPath,
        ],
        { encoding: 'utf8' }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const manifest = JSON.parse(
        fs.readFileSync(
            path.join(outDir, 'public-cutover-manifest.json'),
            'utf8'
        )
    );
    assert.equal(manifest.passed, true);
    assert.equal(manifest.summary.conversionPassed, true);
    assert.equal(manifest.summary.conversionSkipped, true);
    assert.deepEqual(manifest.summary.conversionFailures, []);
});
