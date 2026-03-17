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
        '`.generated/site-root/`',
        '`_deploy_bundle/`',
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
        '`npm run workspace:hygiene:doctor`',
        '`npm run legacy:generated-root:status`',
        '`npm run legacy:generated-root:check`',
        '`npm run legacy:generated-root:apply`',
        '`overall_state`',
        '`scope_context`',
        '`scope_counts`',
        '`issues[]`',
        '`remediation_plan[]`',
        '`attention`',
        '`in_scope`',
        '`out_of_scope`',
        '`unknown_scope`',
        '`--include-entries`',
        '`legacy_generated_root`',
        '`legacy_generated_root_deindexed`',
        '`sw.js`',
    ]) {
        assert.equal(
            policy.includes(snippet),
            true,
            `docs/RUNTIME_ARTIFACT_POLICY.md debe incluir ${snippet}`
        );
    }

    assert.doesNotMatch(
        policy,
        /production publishes from git sync|committed runtime bundles/u,
        'docs/RUNTIME_ARTIFACT_POLICY.md no debe seguir describiendo el contrato legacy de artifacts committeados'
    );
});

test('asset version sync cubre modo compat y pasa en el repo activo', () => {
    const syncScript = readRepoFile('bin', 'sync-frontend-asset-versions.js');
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
    assert.equal(
        syncScript.includes("require('./lib/generated-site-root.js')"),
        true,
        'sync-frontend-asset-versions debe tomar el stage root canonico como fuente preferida'
    );
    assert.equal(
        syncScript.includes('Los HTML stageados en .generated/site-root'),
        true,
        'sync-frontend-asset-versions debe validar consistencia entre entradas stageadas'
    );
});

test('front door docs enlazan la politica canonica y tratan artifacts como outputs', () => {
    const expectations = [
        ['README.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['README.md', 'npm run check:runtime:artifacts'],
        ['README.md', 'npm run check:runtime:compat:versions'],
        ['README.md', 'npm run check:deploy:artifacts'],
        ['README.md', 'npm run workspace:hygiene:doctor'],
        ['README.md', 'npm run legacy:generated-root:status'],
        ['README.md', 'npm run legacy:generated-root:apply'],
        ['docs/OPERATIONS_INDEX.md', 'docs/RUNTIME_ARTIFACT_POLICY.md'],
        ['docs/OPERATIONS_INDEX.md', 'workspace:hygiene:doctor'],
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

test('.generated queda fuera de Git y la politica documenta el stage root canonico', () => {
    const gitignore = readRepoFile('.gitignore');
    const trackedGenerated = execFileSync('git', ['ls-files', '.generated'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    }).trim();

    assert.equal(
        gitignore.includes('.generated/'),
        true,
        '.gitignore debe ignorar .generated/'
    );
    for (const snippet of [
        'es/',
        'en/',
        '_astro/',
        'script.js',
        'admin.js',
        'js/chunks/',
        'js/engines/',
        'js/admin-chunks/',
        'js/booking-calendar.js',
        'js/queue-kiosk.js',
        'js/queue-display.js',
    ]) {
        assert.equal(
            gitignore.includes(snippet),
            true,
            `.gitignore debe preparar el cleanup legacy root: ${snippet}`
        );
    }
    assert.equal(
        trackedGenerated,
        '',
        '.generated no debe tener archivos trackeados en Git'
    );
});

test('legacy generated root cleanup check pasa en el repo activo y evita reintroduccion trackeada', () => {
    const output = execFileSync(
        'node',
        ['bin/legacy-generated-root-cleanup.js', 'check', '--json'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );
    const payload = JSON.parse(output);

    assert.deepEqual(
        payload.trackedPaths,
        [],
        'no deben reaparecer artifacts legacy trackeados en el repo root'
    );
    assert.equal(
        payload.ignoreCoverage.ok,
        true,
        '.gitignore debe conservar el contrato de ignore para el cleanup legacy'
    );

    if (payload.dirtySummary && payload.dirtySummary.total > 0) {
        assert.deepEqual(
            Object.keys(payload.dirtySummary.byCategory || {}),
            ['legacy_generated_root_deindexed'],
            'si quedan cambios locales, solo deben ser deletions staged del deindexado legacy'
        );
    }
});

test('public main update runbook trata public_main_sync como telemetria host-side y no como fuente primaria de artifacts', () => {
    const runbook = readRepoFile('docs', 'PUBLIC_MAIN_UPDATE_RUNBOOK.md');

    for (const snippet of ['`.generated/site-root/`', '`_deploy_bundle/`']) {
        assert.equal(
            runbook.includes(snippet),
            true,
            `docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md debe incluir ${snippet}`
        );
    }

    assert.doesNotMatch(
        runbook,
        /generated artifacts committed to the repo|generated runtime artifacts committed to the repo/u,
        'docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md no debe seguir describiendo artifacts generados committeados como fuente primaria'
    );
});
