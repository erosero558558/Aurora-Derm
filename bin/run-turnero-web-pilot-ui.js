#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'turnero-web-pilot');
const OUTPUT_JSON = path.join(OUT_DIR, 'ui-report.json');
const OUTPUT_MD = path.join(OUT_DIR, 'ui-report.md');
const NPX_COMMAND = 'npx';

const SUITES = [
    {
        id: 'admin_queue',
        label: 'Admin queue',
        args: [
            'playwright',
            'test',
            'tests/admin-queue.spec.js',
            '--workers=1',
        ],
    },
    {
        id: 'queue_kiosk',
        label: 'Queue kiosk',
        args: [
            'playwright',
            'test',
            'tests/queue-kiosk.spec.js',
            '--workers=1',
        ],
    },
    {
        id: 'queue_operator',
        label: 'Queue operator',
        args: [
            'playwright',
            'test',
            'tests/queue-operator.spec.js',
            '--workers=1',
        ],
    },
    {
        id: 'queue_display',
        label: 'Queue display',
        args: [
            'playwright',
            'test',
            'tests/queue-display.spec.js',
            '--workers=1',
        ],
    },
    {
        id: 'queue_integrated_flow',
        label: 'Queue integrated flow',
        args: [
            'playwright',
            'test',
            'tests/queue-integrated-flow.spec.js',
            '--workers=1',
        ],
    },
];

function tailLines(text, maxLines = 20) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .split('\n')
        .filter(Boolean)
        .slice(-maxLines)
        .join('\n');
}

function runSuite(suite) {
    const startedAt = new Date();
    const spawnArgs =
        process.platform === 'win32'
            ? ['/d', '/s', '/c', NPX_COMMAND, ...suite.args]
            : suite.args;
    const result = spawnSync(
        process.platform === 'win32' ? 'cmd.exe' : NPX_COMMAND,
        spawnArgs,
        {
            cwd: ROOT,
            encoding: 'utf8',
            env: {
                ...process.env,
                TEST_REUSE_EXISTING_SERVER:
                    process.env.TEST_REUSE_EXISTING_SERVER || '1',
            },
            shell: false,
            maxBuffer: 1024 * 1024 * 40,
        }
    );
    const endedAt = new Date();
    const exitCode =
        typeof result.status === 'number'
            ? result.status
            : result.error
              ? 1
              : 0;

    return {
        id: suite.id,
        label: suite.label,
        command:
            process.platform === 'win32'
                ? `cmd.exe /d /s /c ${NPX_COMMAND} ${suite.args.join(' ')}`
                : `${NPX_COMMAND} ${suite.args.join(' ')}`,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs: endedAt.getTime() - startedAt.getTime(),
        exitCode,
        success: exitCode === 0,
        stdoutTail: tailLines(result.stdout),
        stderrTail: tailLines(result.stderr),
        error: result.error ? String(result.error.message || result.error) : '',
    };
}

function buildMarkdown(report) {
    const lines = [
        '# Turnero Web Pilot UI',
        '',
        `- Generated At: ${report.generatedAt}`,
        `- Status: ${report.ok ? 'PASS' : 'FAIL'}`,
        `- TEST_LOCAL_SERVER_PORT: ${report.testLocalServerPort}`,
        '',
        '| Suite | Status | Exit |',
        '| --- | --- | --- |',
        ...report.suites.map((suite) => {
            const status = suite.success ? 'PASS' : 'FAIL';
            return `| ${suite.label} | ${status} | ${suite.exitCode} |`;
        }),
        '',
    ];

    if (report.failures.length) {
        lines.push('## Failures');
        lines.push('');
        report.failures.forEach((failure) => lines.push(`- ${failure}`));
        lines.push('');
    }

    return `${lines.join('\n')}\n`;
}

function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const suites = [];
    for (const suite of SUITES) {
        process.stdout.write(`[turnero-web-pilot-ui] Running ${suite.label}\n`);
        const result = runSuite(suite);
        suites.push(result);
        process.stdout.write(
            `[turnero-web-pilot-ui] ${suite.label}: ${result.success ? 'PASS' : 'FAIL'} (${result.durationMs}ms)\n`
        );
    }

    const failures = suites
        .filter((suite) => !suite.success)
        .map((suite) => `${suite.label} failed`);

    const report = {
        generatedAt: new Date().toISOString(),
        ok: failures.length === 0,
        testLocalServerPort: process.env.TEST_LOCAL_SERVER_PORT || '8011',
        suites,
        failures,
    };

    fs.writeFileSync(
        OUTPUT_JSON,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
    fs.writeFileSync(OUTPUT_MD, buildMarkdown(report), 'utf8');

    process.stdout.write(
        [
            `[turnero-web-pilot-ui] Report JSON: ${path.relative(ROOT, OUTPUT_JSON).replace(/\\/g, '/')}`,
            `[turnero-web-pilot-ui] Report MD: ${path.relative(ROOT, OUTPUT_MD).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );

    if (!report.ok) {
        process.exitCode = 1;
    }
}

main();
