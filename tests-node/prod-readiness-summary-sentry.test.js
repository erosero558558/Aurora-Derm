#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SUMMARY_SOURCE = resolve(REPO_ROOT, 'bin', 'prod-readiness-summary.js');

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'prod-readiness-sentry-'));
    mkdirSync(join(dir, 'bin'), { recursive: true });
    mkdirSync(join(dir, 'verification', 'runtime'), { recursive: true });
    copyFileSync(SUMMARY_SOURCE, join(dir, 'bin', 'prod-readiness-summary.js'));
    return dir;
}

test('prod-readiness-summary consume evidencia Sentry local y cierra PM-SENTRY-001', () => {
    const dir = createFixtureDir();
    const sentryPath = join(
        dir,
        'verification',
        'runtime',
        'sentry-events-last.json'
    );
    const jsonOut = join(dir, 'verification', 'runtime', 'prod-readiness.json');
    const mdOut = join(dir, 'verification', 'runtime', 'prod-readiness.md');

    try {
        writeFileSync(
            sentryPath,
            `${JSON.stringify(
                {
                    version: 1,
                    generatedAt: '2026-03-02T00:00:00.000Z',
                    artifactPath: 'verification/runtime/sentry-events-last.json',
                    source: 'sentry-api',
                    baseUrl: 'https://sentry.io',
                    org: 'pielarmonia',
                    lookbackHours: 168,
                    allowMissing: false,
                    maxAgeHours: null,
                    ok: true,
                    status: 'ok',
                    failureReason: null,
                    actionRequired: null,
                    missingEnv: [],
                    missingProjects: [],
                    staleProjects: [],
                    backend: {
                        project: 'pielarmonia-backend',
                        found: true,
                        latest: {
                            eventID: 'backend-evt-1',
                            date: '2026-03-01T23:00:00.000Z',
                            ageHours: 1,
                        },
                    },
                    frontend: {
                        project: 'pielarmonia-frontend',
                        found: true,
                        latest: {
                            eventID: 'frontend-evt-1',
                            date: '2026-03-01T23:15:00.000Z',
                            ageHours: 0.75,
                        },
                    },
                },
                null,
                2
            )}\n`,
            'utf8'
        );

        const result = spawnSync(
            process.execPath,
            [
                join(dir, 'bin', 'prod-readiness-summary.js'),
                `--json-out=${jsonOut}`,
                `--md-out=${mdOut}`,
            ],
            {
                cwd: dir,
                encoding: 'utf8',
            }
        );

        assert.equal(result.status, 0, result.stderr || result.stdout);

        const summary = JSON.parse(readFileSync(jsonOut, 'utf8'));
        const sentryPlanItem = summary.planMasterProgress.pending.find(
            (item) => item.id === 'PM-SENTRY-001'
        );
        assert.ok(sentryPlanItem, 'PM-SENTRY-001 debe existir');
        assert.equal(sentryPlanItem.status, 'done');
        assert.equal(summary.sentryEvidence.ok, true);
        assert.equal(summary.sentryEvidence.status, 'ok');

        const markdown = readFileSync(mdOut, 'utf8');
        assert.match(markdown, /## Sentry Evidence/);
        assert.match(markdown, /- status: ok/);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
