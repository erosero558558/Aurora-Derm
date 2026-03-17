'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.resolve(
    REPO_ROOT,
    'bin',
    'check-turnero-runtime-artifacts.js'
);

function createSandboxRoot(prefix = 'turnero-runtime-artifacts-') {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    const runtimeRoot = path.join(root, '.generated', 'site-root');
    fs.mkdirSync(runtimeRoot, { recursive: true });
    fs.mkdirSync(path.join(runtimeRoot, 'js'), { recursive: true });
    return {
        root,
        runtimeRoot,
        reportPath: path.join(root, 'runtime-artifacts-report.json'),
    };
}

function writeFile(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

function seedTurneroShells(sandbox) {
    writeFile(
        path.join(sandbox.root, 'admin.html'),
        '<!doctype html><html><body><script src="admin.js?v=test-admin"></script></body></html>\n'
    );
    writeFile(
        path.join(sandbox.root, 'kiosco-turnos.html'),
        '<!doctype html><html><body><script src="js/queue-kiosk.js?v=test-kiosk" type="module"></script></body></html>\n'
    );
    writeFile(
        path.join(sandbox.root, 'sala-turnos.html'),
        '<!doctype html><html><body><script src="js/queue-display.js?v=test-display" type="module"></script></body></html>\n'
    );
}

function runChecker(sandbox) {
    return spawnSync(
        'node',
        [
            SCRIPT_PATH,
            '--root',
            sandbox.root,
            '--runtime-root',
            sandbox.runtimeRoot,
            '--output',
            sandbox.reportPath,
        ],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
}

function cleanupSandbox(sandbox) {
    fs.rmSync(sandbox.root, { recursive: true, force: true });
}

test('check-turnero-runtime-artifacts valida shells y bundles servidos del turnero', () => {
    const sandbox = createSandboxRoot();

    try {
        seedTurneroShells(sandbox);
        writeFile(
            path.join(sandbox.runtimeRoot, 'admin.js'),
            'window.__turneroAdmin = true;\n'
        );
        writeFile(
            path.join(sandbox.runtimeRoot, 'js', 'queue-kiosk.js'),
            'window.__turneroKiosk = true;\n'
        );
        writeFile(
            path.join(sandbox.runtimeRoot, 'js', 'queue-display.js'),
            'window.__turneroDisplay = true;\n'
        );

        const result = runChecker(sandbox);
        assert.equal(result.status, 0, result.stderr || result.stdout);

        const report = JSON.parse(fs.readFileSync(sandbox.reportPath, 'utf8'));
        assert.equal(report.passed, true);
        assert.equal(report.diagnostics.length, 0);
        assert.equal(
            report.surfaces.every(
                (surface) =>
                    surface.htmlExists &&
                    surface.runtimeAssetExists &&
                    surface.htmlReferencesRuntimeAsset
            ),
            true
        );
        assert.equal(
            report.served.checks.every((check) => check.passed === true),
            true
        );
    } finally {
        cleanupSandbox(sandbox);
    }
});

test('check-turnero-runtime-artifacts falla cuando falta un bundle canonico', () => {
    const sandbox = createSandboxRoot('turnero-runtime-artifacts-missing-');

    try {
        seedTurneroShells(sandbox);
        writeFile(
            path.join(sandbox.runtimeRoot, 'admin.js'),
            'window.__turneroAdmin = true;\n'
        );
        writeFile(
            path.join(sandbox.runtimeRoot, 'js', 'queue-kiosk.js'),
            'window.__turneroKiosk = true;\n'
        );

        const result = runChecker(sandbox);
        assert.notEqual(result.status, 0, 'el checker debe fallar');

        const report = JSON.parse(fs.readFileSync(sandbox.reportPath, 'utf8'));
        assert.equal(report.passed, false);
        assert.equal(
            report.diagnostics.some(
                (entry) =>
                    entry.code === 'missing_runtime_asset' &&
                    entry.surface === 'display'
            ),
            true
        );
    } finally {
        cleanupSandbox(sandbox);
    }
});
