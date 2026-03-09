#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST_ROOT = path.join(ROOT, 'src', 'apps', 'astro', 'dist');
const ARTIFACT_ENTRIES = ['es', 'en', '_astro'];

function parseArgs(argv) {
    const args = {
        rebuild: true,
        output: path.join(
            ROOT,
            'verification',
            'public-v6-canonical',
            'artifact-drift.json'
        ),
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--skip-build') {
            args.rebuild = false;
            continue;
        }
        if (token === '--output') {
            args.output = path.resolve(
                ROOT,
                String(argv[index + 1] || '').trim()
            );
            index += 1;
        }
    }

    return args;
}

function runCommand(program, args) {
    const result = spawnSync(program, args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
        shell: process.platform === 'win32',
    });

    if (result.status !== 0) {
        throw new Error(
            `Command failed: ${[program, ...args].join(' ')}\n${result.stdout}\n${result.stderr}`
        );
    }
}

function hashFile(filePath) {
    const buffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function listFilesRecursive(baseDir, currentDir = baseDir, collector = []) {
    if (!fs.existsSync(currentDir)) {
        return collector;
    }

    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
        const absolute = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            listFilesRecursive(baseDir, absolute, collector);
            continue;
        }
        if (!entry.isFile()) continue;
        collector.push(path.relative(baseDir, absolute).replace(/\\/g, '/'));
    }

    return collector.sort();
}

function compareEntry(entry) {
    const distDir = path.join(DIST_ROOT, entry);
    const repoDir = path.join(ROOT, entry);
    const distFiles = listFilesRecursive(distDir);
    const repoFiles = listFilesRecursive(repoDir);

    const distSet = new Set(distFiles);
    const repoSet = new Set(repoFiles);
    const missingInRepo = distFiles.filter((file) => !repoSet.has(file));
    const extraInRepo = repoFiles.filter((file) => !distSet.has(file));
    const changed = [];

    for (const relativePath of distFiles) {
        if (!repoSet.has(relativePath)) continue;
        const distHash = hashFile(path.join(distDir, relativePath));
        const repoHash = hashFile(path.join(repoDir, relativePath));
        if (distHash !== repoHash) {
            changed.push({
                file: relativePath,
                distHash,
                repoHash,
            });
        }
    }

    return {
        entry,
        distCount: distFiles.length,
        repoCount: repoFiles.length,
        missingInRepo,
        extraInRepo,
        changed,
    };
}

function writeReport(outputPath, report) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
        outputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    if (args.rebuild) {
        runCommand(npmCmd, ['run', 'astro:build']);
    }

    const checks = ARTIFACT_ENTRIES.map(compareEntry);
    const drift = checks.filter(
        (entry) =>
            entry.missingInRepo.length ||
            entry.extraInRepo.length ||
            entry.changed.length
    );

    const report = {
        generatedAt: new Date().toISOString(),
        rebuild: args.rebuild,
        distRoot: path.relative(ROOT, DIST_ROOT).replace(/\\/g, '/'),
        checks,
        passed: drift.length === 0,
        driftCount: drift.length,
    };

    writeReport(args.output, report);

    if (drift.length) {
        console.error(
            `[public-v6-artifacts] Drift detected in ${drift.length} entry(s). Report: ${path.relative(ROOT, args.output)}`
        );
        process.exitCode = 1;
        return;
    }

    console.log(
        `[public-v6-artifacts] /es, /en and /_astro match Astro dist. Report: ${path.relative(ROOT, args.output)}`
    );
}

main();
