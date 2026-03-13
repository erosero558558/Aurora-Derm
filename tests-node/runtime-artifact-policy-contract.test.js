#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(...segments) {
    return readFileSync(resolve(REPO_ROOT, ...segments), 'utf8');
}

test('package.json expone chequeos compuestos para artifacts runtime y deploy', () => {
    const pkg = JSON.parse(readRepoFile('package.json'));
    const scripts = pkg.scripts || {};

    assert.equal(
        scripts['check:runtime:artifacts'],
        'npm run check:public:runtime:artifacts && npm run chunks:public:check && npm run chunks:admin:check && npm run check:runtime:compat:versions',
        'check:runtime:artifacts debe reunir los validadores canonicos del runtime versionado'
    );
    assert.equal(
        scripts['check:runtime:compat:versions'],
        'node bin/sync-frontend-asset-versions.js --check',
        'check:runtime:compat:versions debe exponer el validador canonico de compatibilidad'
    );
    assert.equal(
        scripts['assets:versions:check'],
        'npm run check:runtime:compat:versions',
        'assets:versions:check debe quedar solo como alias compatible'
    );
    assert.equal(
        scripts['check:deploy:artifacts'],
        'npm run check:public:v6:artifacts && npm run check:runtime:artifacts',
        'check:deploy:artifacts debe extender el chequeo runtime hacia artifacts V6 de deploy'
    );
});

test('eslint separa bundles generados del lint de source authored', () => {
    const eslintConfig = readRepoFile('eslint.config.js');

    for (const snippet of [
        'artifact contracts instead of authored-source lint',
        "'admin.js'",
        "'script.js'",
        "'js/chunks/**'",
        "'js/admin-chunks/**'",
        "'js/engines/**'",
        "'js/booking-calendar.js'",
    ]) {
        assert.equal(
            eslintConfig.includes(snippet),
            true,
            `eslint.config.js debe fijar la frontera source-vs-output: ${snippet}`
        );
    }
});

test('runtime artifact policy documenta ownership, review order y comandos canonicos', () => {
    const policy = readRepoFile('docs', 'RUNTIME_ARTIFACT_POLICY.md');

    for (const snippet of [
        'Review source-of-truth files first',
        '`src/apps/admin/index.js`',
        '`src/apps/admin-v3/**`',
        '`js/main.js`',
        '`src/apps/booking/**`',
        '`src/apps/chat/**`',
        '`src/apps/analytics/**`',
        '`src/bundles/**`',
        '`es/**`',
        '`en/**`',
        '`_astro/**`',
        '`script.js`',
        '`js/chunks/**`',
        '`js/admin-chunks/**`',
        '`js/engines/**`',
        '`js/admin-preboot-shortcuts.js`',
        '`npm run check:public:v6:artifacts`',
        '`npm run check:public:runtime:artifacts`',
        '`npm run chunks:admin:check`',
        '`npm run check:runtime:compat:versions`',
        '`npm run assets:versions:check`',
        '`npm run check:runtime:artifacts`',
        '`npm run check:deploy:artifacts`',
        '`sw.js`',
    ]) {
        assert.equal(
            policy.includes(snippet),
            true,
            `docs/RUNTIME_ARTIFACT_POLICY.md debe incluir ${snippet}`
        );
    }
});

test('asset version sync cubre modo compat y pasa en el repo activo', () => {
    const output = execFileSync(
        'node',
        ['bin/sync-frontend-asset-versions.js', '--check'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );

    assert.match(
        output,
        /OK: (contrato de compatibilidad de versiones sincronizado|no hay superficies HTML legacy versionadas para sincronizar)/u,
        'assets:versions:check debe pasar en el repo activo y documentar si opera en modo compatibilidad'
    );
});

test('front door docs enlazan la politica canonica y tratan artifacts como outputs', () => {
    const expectations = [
        ['README.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['README.md', 'npm run check:runtime:artifacts'],
        ['README.md', 'npm run check:runtime:compat:versions'],
        ['README.md', 'npm run check:deploy:artifacts'],
        ['docs/OPERATIONS_INDEX.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['docs/OPERATIONS_INDEX.md', 'check:runtime:artifacts'],
        ['docs/OPERATIONS_INDEX.md', 'check:runtime:compat:versions'],
        ['docs/OPERATIONS_INDEX.md', 'check:deploy:artifacts'],
        [
            'docs/public-v6-canonical-source.md',
            'docs/RUNTIME_ARTIFACT_POLICY.md',
        ],
        ['docs/public-v6-canonical-source.md', 'check:runtime:artifacts'],
        ['docs/ADMIN-UI-ROLLOUT.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['docs/ADMIN-UI-ROLLOUT.md', 'check:runtime:artifacts'],
        ['docs/ROOT_SURFACES.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['scripts/ops/deploy/README.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['scripts/ops/deploy/README.md', 'npm run check:deploy:artifacts'],
    ];

    for (const [file, snippet] of expectations) {
        const raw = readRepoFile(file);
        assert.equal(
            raw.includes(snippet),
            true,
            `${file} debe fijar la politica source-vs-output con ${snippet}`
        );
    }
});
