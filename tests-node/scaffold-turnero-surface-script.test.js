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
    'scaffold-turnero-surface.js'
);
const REGISTRY_FIXTURE = path.resolve(
    __dirname,
    '..',
    'data',
    'turnero-surfaces.json'
);

test('scaffold-turnero-surface registra una nueva superficie y crea sus stubs', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'turnero-surface-'));
    const registryPath = path.join(tempRoot, 'turnero-surfaces.json');
    const docsDir = path.join(tempRoot, 'docs');
    const stubsDir = path.join(tempRoot, 'stubs');
    fs.copyFileSync(REGISTRY_FIXTURE, registryPath);

    const result = spawnSync(
        process.execPath,
        [
            SCRIPT_PATH,
            '--registry',
            registryPath,
            '--docsDir',
            docsDir,
            '--stubsDir',
            stubsDir,
            '--id',
            'recepcion_movil',
            '--family',
            'desktop',
            '--route',
            '/recepcion-movil.html',
            '--productName',
            'Turnero Recepcion Movil',
            '--artifactBase',
            'TurneroRecepcionMovil',
        ],
        {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr);

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    const created = registry.surfaces.find(
        (surface) => surface.id === 'recepcion_movil'
    );
    assert.equal(typeof created, 'object');
    assert.equal(
        created.release.artifactName,
        'turnero-desktop-recepcion-movil'
    );

    const docsPath = path.join(docsDir, 'recepcion_movil.md');
    const stubPath = path.join(stubsDir, 'recepcion_movil.json');
    assert.equal(fs.existsSync(docsPath), true);
    assert.equal(fs.existsSync(stubPath), true);

    const stub = JSON.parse(fs.readFileSync(stubPath, 'utf8'));
    assert.equal(
        stub.expectedPublicPaths.downloads.includes(
            '/app-downloads/stable/recepcion-movil/win/TurneroRecepcionMovilSetup.exe'
        ),
        true
    );
});
