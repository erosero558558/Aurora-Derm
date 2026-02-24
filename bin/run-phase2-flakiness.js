#!/usr/bin/env node
/* eslint-disable no-console */
const { spawnSync } = require('child_process');
const { mkdirSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');

function parseIntArg(name, fallback, minValue = 1) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    if (!match) return fallback;
    const raw = match.slice(prefix.length).trim();
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < minValue) {
        throw new Error(`Argumento invalido --${name}: ${raw}`);
    }
    return parsed;
}

function parseStringArg(name, fallback) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    if (!match) return fallback;
    const raw = match.slice(prefix.length).trim();
    return raw === '' ? fallback : raw;
}

function appendGithubOutput(key, value) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) return;
    writeFileSync(outputPath, `${key}=${value}\n`, {
        encoding: 'utf8',
        flag: 'a',
    });
}

function appendGithubOutputMultiline(key, value) {
    const outputPath = process.env.GITHUB_OUTPUT;
    if (!outputPath) return;
    writeFileSync(outputPath, `${key}<<EOF\n${value}\nEOF\n`, {
        encoding: 'utf8',
        flag: 'a',
    });
}

function classifyFailures(failures, maxFailures) {
    if (failures === 0) return 'stable';
    if (failures <= maxFailures) return 'intermittent';
    return 'unstable';
}

function main() {
    const runs = parseIntArg('runs', 3, 1);
    const maxFailures = parseIntArg('max-failures', 0, 0);
    const command = parseStringArg('command', 'npm run test:phase2');
    const jsonOut = resolve(
        parseStringArg(
            'json-out',
            'verification/runtime/phase2-flakiness-last.json'
        )
    );

    const attempts = [];
    let passes = 0;
    let failures = 0;

    for (let i = 1; i <= runs; i += 1) {
        const startedAt = new Date();
        const startedMs = Date.now();
        console.log(`==> Intento ${i}/${runs}`);

        const result = spawnSync(command, {
            cwd: process.cwd(),
            stdio: 'inherit',
            shell: true,
            env: process.env,
        });

        const durationMs = Date.now() - startedMs;
        const ok = result.status === 0;
        if (ok) {
            passes += 1;
        } else {
            failures += 1;
        }

        attempts.push({
            attempt: i,
            status: ok ? 'pass' : 'fail',
            exitCode: typeof result.status === 'number' ? result.status : 1,
            startedAt: startedAt.toISOString(),
            finishedAt: new Date().toISOString(),
            durationMs,
        });
    }

    const classification = classifyFailures(failures, maxFailures);
    const details = attempts
        .map(
            (item) =>
                `- intento ${item.attempt}: ${item.status} (exit=${item.exitCode}, ${item.durationMs}ms)`
        )
        .join('\n');

    const payload = {
        generatedAt: new Date().toISOString(),
        runs,
        maxFailures,
        command,
        passes,
        failures,
        classification,
        attempts,
    };

    mkdirSync(dirname(jsonOut), { recursive: true });
    writeFileSync(jsonOut, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    appendGithubOutput('passes', String(passes));
    appendGithubOutput('failures', String(failures));
    appendGithubOutput('classification', classification);
    appendGithubOutput('json_path', jsonOut.replace(/\\/g, '/'));
    appendGithubOutputMultiline('details', details);

    console.log(
        `Flakiness probe: passes=${passes}, failures=${failures}, classification=${classification}`
    );
    console.log(`JSON report: ${jsonOut}`);

    if (failures > maxFailures) {
        process.exit(1);
    }
}

try {
    main();
} catch (error) {
    console.error(
        `run-phase2-flakiness.js error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
}
