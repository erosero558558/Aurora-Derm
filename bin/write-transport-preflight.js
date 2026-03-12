#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            throw new Error(`unexpected_argument:${token}`);
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (next === undefined || next.startsWith('--')) {
            throw new Error(`missing_value:${token}`);
        }
        options[key] = next;
        index += 1;
    }
    return options;
}

function normalizeBoolean(value, fieldName) {
    const normalized = String(value || '')
        .trim()
        .toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    throw new Error(`invalid_boolean:${fieldName}`);
}

function buildTransportPreflightPayload(options = {}) {
    const protocol = String(
        options.protocol ?? process.env.DEPLOY_PROTOCOL ?? ''
    ).trim();
    const port = String(
        options.port ?? process.env.FTP_SERVER_PORT ?? ''
    ).trim();
    const reason = String(options.reason ?? '').trim();
    if (!reason) {
        throw new Error('missing_reason');
    }

    const target = String(options.target ?? `${protocol}:${port}`).trim();

    return {
        attempted: normalizeBoolean(options.attempted ?? 'true', 'attempted'),
        reachable: normalizeBoolean(options.reachable ?? '', 'reachable'),
        reason,
        protocol,
        port,
        target,
        generated_at: new Date().toISOString(),
    };
}

function writeTransportPreflight(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main(argv) {
    const options = parseArgs(argv);
    const outputPath = String(options.out || '').trim();
    if (!outputPath) {
        throw new Error('missing_out');
    }

    const payload = buildTransportPreflightPayload(options);
    writeTransportPreflight(outputPath, payload);
}

if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        const message =
            error && error.message ? error.message : 'unknown_error';
        console.error(`[write-transport-preflight] ${message}`);
        process.exit(1);
    }
}

module.exports = {
    buildTransportPreflightPayload,
    normalizeBoolean,
    parseArgs,
    writeTransportPreflight,
};
