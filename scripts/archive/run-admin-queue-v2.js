#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const cmdParts = [
    'npx',
    'playwright',
    'test',
    'tests/admin-queue-v2.spec.js',
    ...args,
];
const command = cmdParts.join(' ');

const result = spawnSync(command, {
    stdio: 'inherit',
    shell: true,
    env: {
        ...process.env,
        ADMIN_UI_VARIANT: 'sony_v2',
    },
});

if (typeof result.status === 'number') {
    process.exit(result.status);
}

process.exit(1);
