#!/usr/bin/env node
'use strict';

const path = require('node:path');
const {
    DEFAULT_REPO_ROOT,
    validatePublicV3Content,
} = require('./lib/public-v3-content-validator.js');

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--schema-version') {
            options.schemaVersion = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--fallback-version') {
            options.fallbackVersion = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--no-fallback') {
            options.allowFallback = false;
            continue;
        }
    }
    return options;
}

const cliOptions = parseArgs(process.argv.slice(2));
const result = validatePublicV3Content({
    repoRoot: path.resolve(DEFAULT_REPO_ROOT),
    ...cliOptions,
});

if (!result.ok) {
    process.stderr.write(
        `[public-v3-content] validation failed (requested=${result.requestedSchemaVersion}, resolved=${result.schemaVersion}).\n`
    );
    for (const message of result.errors) {
        process.stderr.write(`- ${message}\n`);
    }
    process.exitCode = 1;
} else {
    process.stdout.write(
        `[public-v3-content] validation passed for es/en (requested=${result.requestedSchemaVersion}, resolved=${result.schemaVersion}).\n`
    );
    if (result.fallbackUsed) {
        const details = result.fallbackHits
            .map((item) => `${item.schema}->${item.fromVersion}`)
            .join(', ');
        process.stdout.write(`[public-v3-content] fallback used: ${details}\n`);
    }
}
