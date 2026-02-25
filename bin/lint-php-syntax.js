#!/usr/bin/env node
'use strict';

const { readdirSync } = require('fs');
const { join, resolve, extname } = require('path');
const { spawnSync } = require('child_process');

const ROOT = resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'vendor', 'node_modules']);

function walkPhpFiles(dir, out) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walkPhpFiles(fullPath, out);
            continue;
        }
        if (!entry.isFile()) continue;
        if (extname(entry.name).toLowerCase() === '.php') {
            out.push(fullPath);
        }
    }
}

function relativeToRoot(file) {
    return file.startsWith(`${ROOT}\\`)
        ? file.slice(ROOT.length + 1)
        : file.startsWith(`${ROOT}/`)
          ? file.slice(ROOT.length + 1)
          : file;
}

function main() {
    const phpFiles = [];
    walkPhpFiles(ROOT, phpFiles);
    phpFiles.sort((a, b) => a.localeCompare(b));

    if (phpFiles.length === 0) {
        process.stdout.write('No PHP files found.\n');
        return;
    }

    let failures = 0;
    for (const file of phpFiles) {
        process.stdout.write(`php -l ${relativeToRoot(file)}\n`);
        const result = spawnSync('php', ['-l', file], {
            cwd: ROOT,
            stdio: 'inherit',
            windowsHide: true,
        });
        if (result.status !== 0) {
            failures += 1;
        }
    }

    process.stdout.write(
        `PHP syntax lint complete: files=${phpFiles.length} failures=${failures}\n`
    );
    process.exit(failures > 0 ? 1 : 0);
}

main();
