#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    existsSync,
    rmSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = resolve(__dirname, '..');
const SCRIPT_PATH = resolve(REPO_ROOT, 'bin', 'clean-admin-chunks.js');

function createSandboxRoot(prefix = 'admin-chunks-') {
    const base = mkdtempSync(resolve(tmpdir(), prefix));
    const chunksDir = resolve(base, 'js', 'admin-chunks');
    mkdirSync(chunksDir, { recursive: true });
    return { base, chunksDir };
}

function writeFile(filePath, content) {
    writeFileSync(filePath, content, 'utf8');
}

function runCleaner(rootPath, extraArgs = []) {
    const result = spawnSync(
        'node',
        [SCRIPT_PATH, '--root', rootPath, ...extraArgs],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    return result;
}

function removeSandbox(path) {
    rmSync(path, { recursive: true, force: true });
}

test('clean-admin-chunks elimina solo chunks huerfanos con import graph recursivo', () => {
    const sandbox = createSandboxRoot();
    try {
        writeFile(
            resolve(sandbox.base, 'admin.js'),
            "import('./js/admin-chunks/index-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'index-live.js'),
            "import('./legacy-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'legacy-live.js'),
            'export const ok = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runCleaner(sandbox.base);
        assert.equal(
            result.status,
            0,
            `salida inesperada: ${result.stderr || result.stdout}`
        );

        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'index-live.js')),
            true,
            'chunk live no debe eliminarse'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'legacy-live.js')),
            true,
            'chunk recursivo no debe eliminarse'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'stale.js')),
            false,
            'chunk huerfano debe eliminarse'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-admin-chunks dry-run reporta sin borrar archivos', () => {
    const sandbox = createSandboxRoot('admin-chunks-dry-');
    try {
        writeFile(
            resolve(sandbox.base, 'admin.js'),
            "import('./js/admin-chunks/index-live.js');\n"
        );
        writeFile(
            resolve(sandbox.chunksDir, 'index-live.js'),
            'export const live = true;\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'stale.js'),
            'export const stale = true;\n'
        );

        const result = runCleaner(sandbox.base, ['--dry-run']);
        assert.equal(
            result.status,
            0,
            `dry-run fallo: ${result.stderr || result.stdout}`
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'stale.js')),
            true,
            'dry-run no debe eliminar chunks'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});

test('clean-admin-chunks en strict falla cuando admin.js no referencia chunks', () => {
    const sandbox = createSandboxRoot('admin-chunks-strict-');
    try {
        writeFile(
            resolve(sandbox.base, 'admin.js'),
            'console.log("sin imports");\n'
        );
        writeFile(
            resolve(sandbox.chunksDir, 'old.js'),
            'export const old = true;\n'
        );

        const result = runCleaner(sandbox.base, ['--strict']);
        assert.notEqual(
            result.status,
            0,
            'strict debe fallar sin referencias detectadas'
        );
        assert.equal(
            existsSync(resolve(sandbox.chunksDir, 'old.js')),
            true,
            'sin referencias no debe borrar por seguridad'
        );
    } finally {
        removeSandbox(sandbox.base);
    }
});
