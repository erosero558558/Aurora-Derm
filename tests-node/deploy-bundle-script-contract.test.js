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
        'SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1',
        'BENCH-API-PRODUCCION.ps1',
        'GATE-POSTDEPLOY.ps1',
        'CONFIGURAR-TELEGRAM-WEBHOOK.ps1',
        'admin-v3.css',
        'queue-ops.css',
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

    assert.equal(
        fs.existsSync(path.join(stageRoot, 'admin.css')),
        false,
        'el bundle no debe reintroducir admin.css legacy'
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
});
