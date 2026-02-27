#!/usr/bin/env node
'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

function resolveChromiumPath() {
    if (process.env.CHROME_PATH) {
        return process.env.CHROME_PATH;
    }

    try {
        const { chromium } = require('playwright');
        if (chromium && typeof chromium.executablePath === 'function') {
            return chromium.executablePath();
        }
    } catch (_error) {
        return '';
    }

    return '';
}

const repoRoot = path.resolve(__dirname, '..');
const chromepath = resolveChromiumPath();
const env = { ...process.env };
if (chromepath) {
    env.CHROME_PATH = chromepath;
}

if (process.platform === 'win32' && env.LIGHTHOUSE_FORCE_WINDOWS !== '1') {
    console.log(
        '[lighthouse-premium] Skipping on Windows host (set LIGHTHOUSE_FORCE_WINDOWS=1 to force local run).'
    );
    process.exit(0);
}

const npxCmd = 'npx';
const commandArgs = [
    '--yes',
    '@lhci/cli',
    'autorun',
    '--config=./lighthouserc.premium.json',
];

console.log(
    `[lighthouse-premium] CHROME_PATH=${env.CHROME_PATH || 'system-default'}`
);

const result = spawnSync(npxCmd, commandArgs, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

if (result.error) {
    console.error('[lighthouse-premium] spawn error:', result.error.message);
}

if (typeof result.status === 'number') {
    process.exit(result.status);
}

process.exit(1);
