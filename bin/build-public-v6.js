#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const REPORT_DEFAULT = path.join(
    ROOT,
    'verification',
    'public-v6-canonical',
    'build-report.json'
);

function parseArgs(argv) {
    const args = {
        validate: true,
        stage: true,
        check: true,
        report: REPORT_DEFAULT,
        json: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--skip-validate') {
            args.validate = false;
            continue;
        }
        if (token === '--skip-stage' || token === '--skip-sync') {
            args.stage = false;
            continue;
        }
        if (token === '--skip-check') {
            args.check = false;
            continue;
        }
        if (token === '--report') {
            args.report = path.resolve(
                ROOT,
                String(argv[index + 1] || '').trim()
            );
            index += 1;
            continue;
        }
        if (token === '--json') {
            args.json = true;
        }
    }

    return args;
}

function npmCommand() {
    return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function spawnNpmRun(args) {
    if (process.platform === 'win32') {
        return spawnSync(
            'cmd.exe',
            ['/d', '/s', '/c', npmCommand(), 'run', ...args],
            {
                cwd: ROOT,
                encoding: 'utf8',
                stdio: 'inherit',
            }
        );
    }

    return spawnSync(npmCommand(), ['run', ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'inherit',
    });
}

function runStep(step, args, report) {
    const startedAt = new Date().toISOString();
    const command = [npmCommand(), 'run', ...args].join(' ');
    const result = spawnNpmRun(args);

    const entry = {
        step,
        command,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: result.status === 0 ? 'passed' : 'failed',
        exitCode: result.status,
    };

    report.steps.push(entry);

    if (result.status !== 0) {
        const error = new Error(
            result.error && result.error.message
                ? `${step} failed: ${result.error.message}`
                : `${step} failed`
        );
        error.exitCode = result.status;
        throw error;
    }
}

function writeReport(reportPath, report) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(
        reportPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
}

function printResult(args, report) {
    if (args.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
    }

    console.log(
        `[build-public-v6] OK: ${report.steps.length} step(s), report ${path.relative(
            ROOT,
            report.reportPath
        )}`
    );
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const startedAt = new Date().toISOString();
    const report = {
        generatedAt: startedAt,
        reportPath: args.report,
        passed: false,
        steps: [],
    };

    try {
        if (args.validate) {
            runStep(
                'content:public-v6:validate',
                ['content:public-v6:validate'],
                report
            );
        }

        runStep('astro:build', ['astro:build'], report);

        if (args.stage) {
            runStep('stage:site-root', ['stage:site-root'], report);
        }

        runStep('chunks:public:prune', ['chunks:public:prune'], report);
        runStep('chunks:admin:prune', ['chunks:admin:prune'], report);

        if (args.check) {
            runStep(
                'check:public:v6:artifacts',
                ['check:public:v6:artifacts', '--', '--skip-build'],
                report
            );
        }

        report.passed = true;
        report.finishedAt = new Date().toISOString();
        writeReport(args.report, report);
        printResult(args, report);
    } catch (error) {
        report.passed = false;
        report.finishedAt = new Date().toISOString();
        report.error = error && error.message ? error.message : String(error);
        writeReport(args.report, report);
        process.exitCode =
            error && typeof error.exitCode === 'number' ? error.exitCode : 1;
    }
}

main();
