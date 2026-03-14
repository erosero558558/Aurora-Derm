#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

const LEGACY_SOURCE_FILES = [
    'bin/build-html.js',
    'servicios/build-service-pages.js',
    'templates/index.template.html',
    'templates/telemedicina.template.html',
    'src/apps/astro/scripts/serve-public-v3.mjs',
];

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function runGit(args) {
    const result = spawnSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: 'pipe',
    });
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'git command failed');
    }
    return String(result.stdout || '');
}

function fail(issues) {
    console.error('[public-v6-single-source] FAILED');
    issues.forEach((issue) => console.error(`- ${issue}`));
    process.exitCode = 1;
}

function main() {
    const issues = [];
    const packageJson = readJson(path.join(ROOT, 'package.json'));
    const scripts = packageJson.scripts || {};

    if (!scripts['build:public:v6']) {
        issues.push('package.json missing build:public:v6');
    }
    if (!scripts['check:public:v6:artifacts']) {
        issues.push('package.json missing check:public:v6:artifacts');
    }
    if (!scripts['gate:public:v6:canonical-publish']) {
        issues.push('package.json missing gate:public:v6:canonical-publish');
    }

    const buildScript = String(scripts.build || '');
    const buildPublicScript = String(scripts['build:public:v6'] || '');
    if (buildPublicScript !== 'node bin/build-public-v6.js') {
        issues.push(
            'package.json build:public:v6 must point to node bin/build-public-v6.js'
        );
    }
    for (const snippet of ['build:html', 'services:build']) {
        if (buildScript.includes(snippet)) {
            issues.push(`package.json build still calls ${snippet}`);
        }
        if (buildPublicScript.includes(snippet)) {
            issues.push(`package.json build:public:v6 still calls ${snippet}`);
        }
    }

    const trackedHtml = runGit(['ls-files', '*.html'])
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((file) => fs.existsSync(path.join(ROOT, file)));
    const forbiddenTrackedHtml = trackedHtml.filter((file) => {
        if (file.startsWith('templates/')) return false;
        if (file.startsWith('docs/archive/')) return false;
        if (file === 'admin.html') return false;
        if (file === 'operador-turnos.html') return false;
        if (file === 'kiosco-turnos.html') return false;
        if (file === 'sala-turnos.html') return false;
        if (file.startsWith('src/apps/turnero-desktop/src/renderer/')) return false;
        if (file.startsWith('es/')) return false;
        if (file.startsWith('en/')) return false;
        return true;
    });
    if (forbiddenTrackedHtml.length) {
        issues.push(
            `tracked HTML outside canonical artifacts: ${forbiddenTrackedHtml.join(', ')}`
        );
    }

    for (const legacyFile of LEGACY_SOURCE_FILES) {
        if (fs.existsSync(path.join(ROOT, legacyFile))) {
            issues.push(`legacy public source still exists: ${legacyFile}`);
        }
    }

    const deployDocs = [
        'docs/DEPLOYMENT.md',
        'docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md',
        'README.md',
    ];
    const bannedPatterns = [
        {
            pattern: /Public V3/iu,
            message: 'still names Public V3 as current public surface',
        },
        {
            pattern:
                /bridge de reserva|booking hooks criticos presentes|sigue visible/iu,
            message:
                'still documents legacy booking hooks as active requirements',
        },
        {
            pattern: /index\.html.*P[aá]gina principal/iu,
            message: 'still documents index.html as canonical home source',
        },
    ];

    deployDocs.forEach((file) => {
        const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
        bannedPatterns.forEach((entry) => {
            if (entry.pattern.test(raw)) {
                issues.push(`${file} ${entry.message}`);
            }
        });
    });

    const legacyManualDeploy = fs.readFileSync(
        path.join(ROOT, 'docs', 'PUBLIC_V3_MANUAL_DEPLOY.md'),
        'utf8'
    );
    if (!/legacy|historical|hist[oó]rico/iu.test(legacyManualDeploy)) {
        issues.push(
            'docs/PUBLIC_V3_MANUAL_DEPLOY.md must be marked as legacy/historical'
        );
    }
    if (!/V6/iu.test(legacyManualDeploy)) {
        issues.push(
            'docs/PUBLIC_V3_MANUAL_DEPLOY.md must state that current public source is V6'
        );
    }

    const smokeFiles = [
        'bin/check-public-conversion-smoke.js',
        'bin/run-staging-acceptance-gate.js',
        'tools/agent-orchestrator/commands/publish.js',
    ];
    smokeFiles.forEach((file) => {
        const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
        if (
            /missing booking select|booking anchor #citas|Booking hooks criticos presentes/iu.test(
                raw
            )
        ) {
            issues.push(`${file} still requires legacy public booking hooks`);
        }
    });

    const canonicalDoc = fs.readFileSync(
        path.join(ROOT, 'docs', 'public-v6-canonical-source.md'),
        'utf8'
    );
    for (const expected of [
        'build:public:v6',
        'check:public:v6:artifacts',
        'push to main',
        'cron git-sync',
    ]) {
        if (!canonicalDoc.includes(expected)) {
            issues.push(
                `docs/public-v6-canonical-source.md missing expected contract: ${expected}`
            );
        }
    }

    if (issues.length) {
        fail(issues);
        return;
    }

    console.log('[public-v6-single-source] OK');
}

main();
