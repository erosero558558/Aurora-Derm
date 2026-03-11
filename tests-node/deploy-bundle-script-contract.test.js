#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'PREPARAR-PAQUETE-DESPLIEGUE.ps1');
const POWERSHELL_CANDIDATES =
    process.platform === 'win32'
        ? ['powershell', 'powershell.exe', 'pwsh']
        : ['pwsh', 'powershell'];

function resolvePowerShellBinary() {
    for (const candidate of POWERSHELL_CANDIDATES) {
        const probe = spawnSync(
            candidate,
            ['-NoProfile', '-Command', 'Get-Command Get-FileHash | Out-Null'],
            {
                cwd: REPO_ROOT,
                encoding: 'utf8',
            }
        );
        if (!probe.error && probe.status === 0) {
            return candidate;
        }
    }

    return null;
}

function runPowerShell(binary, args, options = {}) {
    return spawnSync(binary, args, {
        cwd: REPO_ROOT,
        encoding: 'utf8',
        ...options,
    });
}

function getGeneratedStageRoot(outputRoot) {
    const entries = fs
        .readdirSync(outputRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .filter((entry) => entry.name.startsWith('pielarmonia-deploy-'));

    assert.equal(
        entries.length,
        1,
        `se esperaba un solo directorio stage en ${outputRoot}`
    );

    return path.join(outputRoot, entries[0].name);
}

test('bundle deploy conserva wrappers root y tooling canonico ejecutable', (t) => {
    const powerShellBinary = resolvePowerShellBinary();
    if (!powerShellBinary) {
        t.skip('PowerShell con Get-FileHash no disponible');
        return;
    }

    const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-bundle-'));
    const outputArg = path.relative(REPO_ROOT, outputRoot);
    t.after(() => {
        fs.rmSync(outputRoot, { recursive: true, force: true });
    });

    const scriptArgs =
        process.platform === 'win32'
            ? [
                  '-NoProfile',
                  '-ExecutionPolicy',
                  'Bypass',
                  '-File',
                  SCRIPT_PATH,
                  '-OutputDir',
                  outputArg,
                  '-IncludeTooling',
              ]
            : [
                  '-NoProfile',
                  '-File',
                  SCRIPT_PATH,
                  '-OutputDir',
                  outputArg,
                  '-IncludeTooling',
              ];

    const result = runPowerShell(powerShellBinary, scriptArgs, {
        cwd: REPO_ROOT,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const stageRoot = getGeneratedStageRoot(outputRoot);
    const stageName = path.basename(stageRoot);
    const zipPath = path.join(outputRoot, `${stageName}.zip`);

    const requiredPaths = [
        path.join('es', 'index.html'),
        path.join('en', 'index.html'),
        '_astro',
        path.join('fonts', 'plus-jakarta-sans.woff2'),
        path.join('fonts', 'fraunces.woff2'),
        path.join('images', 'optimized'),
        path.join('images', 'icon-192.png'),
        path.join('images', 'icon-512.png'),
        path.join('content', 'index.json'),
        path.join('content', 'es.json'),
        path.join('content', 'en.json'),
        path.join('js', 'public-v6-shell.js'),
        path.join('js', 'admin-preboot-shortcuts.js'),
        path.join('js', 'admin-runtime.js'),
        path.join('js', 'monitoring-loader.js'),
        'sw.js',
        'manifest.json',
        'SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1',
        'BENCH-API-PRODUCCION.ps1',
        'GATE-POSTDEPLOY.ps1',
        'CONFIGURAR-TELEGRAM-WEBHOOK.ps1',
        'admin-v3.css',
        'queue-ops.css',
        'operador-turnos.html',
        'kiosco-turnos.html',
        'sala-turnos.html',
        'queue-kiosk.css',
        'queue-display.css',
        path.join('js', 'queue-operator.js'),
        path.join('js', 'queue-kiosk.js'),
        path.join('js', 'queue-display.js'),
        path.join('scripts', 'ops', 'prod', 'SMOKE-PRODUCCION.ps1'),
        path.join('scripts', 'ops', 'prod', 'VERIFICAR-DESPLIEGUE.ps1'),
        path.join('scripts', 'ops', 'prod', 'BENCH-API-PRODUCCION.ps1'),
        path.join('scripts', 'ops', 'prod', 'GATE-POSTDEPLOY.ps1'),
        path.join('scripts', 'ops', 'setup', 'CONFIGURAR-TELEGRAM-WEBHOOK.ps1'),
        path.join('bin', 'powershell', 'Common.Http.ps1'),
        path.join('bin', 'powershell', 'Common.Metrics.ps1'),
        path.join('bin', 'powershell', 'Common.Warnings.ps1'),
        'manifest-sha256.txt',
    ];

    for (const relativePath of requiredPaths) {
        assert.equal(
            fs.existsSync(path.join(stageRoot, relativePath)),
            true,
            `falta ruta en bundle: ${relativePath}`
        );
    }

    const adminChunksDir = path.join(stageRoot, 'js', 'admin-chunks');
    const adminChunkEntries = fs.existsSync(adminChunksDir)
        ? fs.readdirSync(adminChunksDir)
        : [];
    assert.equal(
        adminChunkEntries.some((entry) => /^index-.*\.js$/.test(entry)),
        true,
        'el bundle debe incluir el chunk activo del admin en js/admin-chunks/'
    );

    assert.equal(
        fs.existsSync(path.join(stageRoot, 'admin.css')),
        false,
        'el bundle no debe reintroducir admin.css legacy'
    );
    assert.equal(
        fs.existsSync(path.join(stageRoot, 'index.html')),
        false,
        'el bundle no debe exigir index.html raiz para la shell publica V6'
    );
    assert.equal(fs.existsSync(zipPath), true, 'falta zip final del bundle');

    const manifestRaw = fs.readFileSync(
        path.join(stageRoot, 'manifest-sha256.txt'),
        'utf8'
    );
    assert.equal(
        manifestRaw.includes('scripts/ops/prod/GATE-POSTDEPLOY.ps1'),
        true,
        'manifest debe incluir tooling canonico de prod'
    );
    assert.equal(
        manifestRaw.includes('bin/powershell/Common.Http.ps1'),
        true,
        'manifest debe incluir dependencias compartidas de PowerShell'
    );
    assert.equal(
        manifestRaw.includes('es/index.html'),
        true,
        'manifest debe incluir la shell publica ES'
    );
    assert.equal(
        manifestRaw.includes('js/public-v6-shell.js'),
        true,
        'manifest debe incluir el runtime publico V6'
    );
    assert.equal(
        manifestRaw.includes('js/admin-chunks/'),
        true,
        'manifest debe incluir los chunks activos del admin'
    );
});
