#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('fs');
const { resolve } = require('path');

const REPO_ROOT = resolve(__dirname, '..');

function readRepoFile(relativePath) {
    return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

test('gitignore incluye caches locales de PHP y cobertura', () => {
    const raw = readRepoFile('.gitignore');
    const requiredEntries = [
        '.php-cs-fixer.cache',
        '.phpunit.cache/',
        'coverage.xml',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `falta entry en .gitignore: ${entry}`
        );
    }
});

test('gitignore permite versionar evidencia por tarea en verification/agent-runs', () => {
    const raw = readRepoFile('.gitignore');
    const requiredEntries = [
        '!verification/agent-runs/AG-*.md',
        '!verification/agent-runs/CDX-*.md',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `falta exception en .gitignore: ${entry}`
        );
    }
});

test('prettierignore excluye colas derivadas de agentes', () => {
    const raw = readRepoFile('.prettierignore');
    const requiredEntries = ['JULES_TASKS.md', 'KIMI_TASKS.md'];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `falta entry en .prettierignore: ${entry}`
        );
    }
});

test('readme enlaza entradas canonicas y evita mojibake comun', () => {
    const raw = readRepoFile('README.md');
    const requiredEntries = [
        'docs/OPERATIONS_INDEX.md',
        'docs/LEADOPS_OPENCLAW.md',
        'docs/public-v6-canonical-source.md',
        'docs/ADMIN-UI-ROLLOUT.md',
        'docs/DEPLOYMENT.md',
        'AGENTS.md',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `README.md debe enlazar ${entry}`
        );
    }

    const mojibakeMarkers = ['Ã', 'ðŸ', 'âš', 'ï¸'];
    for (const marker of mojibakeMarkers) {
        assert.equal(
            raw.includes(marker),
            false,
            `README.md contiene mojibake: ${marker}`
        );
    }
});

test('operations index agrupa comandos canonicos de web, admin, prod y gobernanza', () => {
    const raw = readRepoFile('docs/OPERATIONS_INDEX.md');
    const requiredEntries = [
        'npm run build:public:v6',
        'npm run gate:admin:rollout',
        'npm run leadops:worker',
        'npm run test:critical:payments',
        'npm run nightly:stability',
        'npm run report:weekly:prod',
        'npm run agent:gate',
        'npm run agent:summary:local',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `OPERATIONS_INDEX debe incluir ${entry}`
        );
    }
});

test('leadops doc fija env vars y comandos canonicos del worker OpenClaw', () => {
    const raw = readRepoFile('docs/LEADOPS_OPENCLAW.md');
    const requiredEntries = [
        'PIELARMONIA_LEADOPS_MACHINE_TOKEN',
        'PIELARMONIA_LEADOPS_SERVER_BASE_URL',
        'OPENCLAW_GATEWAY_ENDPOINT',
        'OPENCLAW_GATEWAY_MODEL',
        'npm run leadops:worker',
        'lead-ai-queue',
        'lead-ai-result',
        'pending',
        'offline',
        'degraded',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `LEADOPS_OPENCLAW debe incluir ${entry}`
        );
    }
});

test('historicos de raiz y one-offs archivados salen del front door del repo', () => {
    const rootHistoricalDocs = [
        'ANALYSIS_REPORT.md',
        'AUDITORIA_COMPLETA.md',
        'FINAL_ANALYSIS_REPORT.md',
        'EJEMPLOS_CODIGO_JULES.md',
        'HANDOFF_JULES.md',
        'PLAN_TRABAJO_JULES.md',
        'ROADMAP_PRIORIDADES.md',
        'PENDIENTES_ACTUALES.md',
        'PENDIENTES_COMPLETO_2026-02-21.md',
        'TODOS_LOS_PENDIENTES.md',
        'LISTA_PENDIENTES_ULTRADETALLADA.md',
        'CERRAR_ISSUES_122_130.md',
    ];
    const archivedScripts = [
        'analysis_report.ps1',
        'CLOSE_ISSUES_122_130.ps1',
        'delete_branches.ps1',
        'CLEANUP_REMOTE_BRANCHES.ps1',
        'watch-gate-repair.ps1',
        'clean_branches.sh',
        'clean_remote_branches.sh',
        'close-issues-122-130.sh',
        'detailed_security_analysis.py',
        'full_analysis.py',
        'find_cycles.py',
        'minify_json.py',
        'security_analysis.py',
    ];

    for (const file of rootHistoricalDocs) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `historico no debe seguir en raiz: ${file}`
        );
        assert.equal(
            existsSync(
                resolve(REPO_ROOT, 'docs', 'archive', 'root-history', file)
            ),
            true,
            `falta historico archivado: ${file}`
        );
    }

    for (const file of archivedScripts) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `script one-off no debe seguir en raiz: ${file}`
        );
        assert.equal(
            existsSync(resolve(REPO_ROOT, 'scripts', 'archive', file)),
            true,
            `falta script archivado: ${file}`
        );
    }

    const historyIndex = readRepoFile('docs/archive/root-history/README.md');
    const scriptsIndex = readRepoFile('scripts/archive/README.md');

    assert.equal(
        historyIndex.includes('No son fuentes de verdad operativa.'),
        true,
        'falta aclaracion de archivo historico en docs/archive/root-history/README.md'
    );
    assert.equal(
        scriptsIndex.includes('No forman parte del carril diario recomendado.'),
        true,
        'falta aclaracion de scripts legacy en scripts/archive/README.md'
    );
});
