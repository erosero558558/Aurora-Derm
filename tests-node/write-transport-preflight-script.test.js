#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT_PATH = path.resolve(
    __dirname,
    '..',
    'bin',
    'write-transport-preflight.js'
);

const {
    buildTransportPreflightPayload,
    normalizeBoolean,
} = require('../bin/write-transport-preflight.js');

test('write-transport-preflight compone target desde protocolo y puerto', () => {
    const payload = buildTransportPreflightPayload({
        reason: 'runner_tcp_unreachable',
        reachable: 'false',
        protocol: 'sftp',
        port: '22',
    });

    assert.equal(payload.reachable, false);
    assert.equal(payload.reason, 'runner_tcp_unreachable');
    assert.equal(payload.protocol, 'sftp');
    assert.equal(payload.port, '22');
    assert.equal(payload.target, 'sftp:22');
    assert.equal(payload.attempted, true);
});

test('write-transport-preflight persiste evidencia JSON canonica', () => {
    const tempDir = fs.mkdtempSync(
        path.join(os.tmpdir(), 'transport-preflight-')
    );
    const outputPath = path.join(tempDir, 'transport-preflight.json');

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--out',
            outputPath,
            '--reason',
            'ok',
            '--reachable',
            'true',
        ],
        {
            encoding: 'utf8',
            env: {
                ...process.env,
                DEPLOY_PROTOCOL: 'ftps',
                FTP_SERVER_PORT: '21',
            },
        }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);

    const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(payload.reachable, true);
    assert.equal(payload.reason, 'ok');
    assert.equal(payload.protocol, 'ftps');
    assert.equal(payload.port, '21');
    assert.equal(payload.target, 'ftps:21');
});

test('write-transport-preflight valida flags booleanas', () => {
    assert.equal(normalizeBoolean('true', 'reachable'), true);
    assert.equal(normalizeBoolean('false', 'reachable'), false);
    assert.throws(
        () => normalizeBoolean('maybe', 'reachable'),
        /invalid_boolean:reachable/
    );
});
