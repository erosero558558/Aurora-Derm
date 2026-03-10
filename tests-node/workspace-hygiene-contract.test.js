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
        'npm run chunks:admin:check',
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

test('scripts activos de prod delegan a implementaciones canonicas fuera de la raiz', () => {
    const wrappers = {
        'BENCH-API-PRODUCCION.ps1': 'scripts/ops/prod/BENCH-API-PRODUCCION.ps1',
        'GATE-POSTDEPLOY.ps1': 'scripts/ops/prod/GATE-POSTDEPLOY.ps1',
        'MONITOR-PRODUCCION.ps1': 'scripts/ops/prod/MONITOR-PRODUCCION.ps1',
        'REPORTE-SEMANAL-PRODUCCION.ps1':
            'scripts/ops/prod/REPORTE-SEMANAL-PRODUCCION.ps1',
        'SMOKE-PRODUCCION.ps1': 'scripts/ops/prod/SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1': 'scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1',
        'ADMIN-UI-CONTINGENCIA.ps1':
            'scripts/ops/admin/ADMIN-UI-CONTINGENCIA.ps1',
        'GATE-ADMIN-ROLLOUT.ps1': 'scripts/ops/admin/GATE-ADMIN-ROLLOUT.ps1',
        'PREPARAR-PAQUETE-DESPLIEGUE.ps1':
            'scripts/ops/deploy/PREPARAR-PAQUETE-DESPLIEGUE.ps1',
        'CONFIGURAR-BACKUP-OFFSITE.ps1':
            'scripts/ops/setup/CONFIGURAR-BACKUP-OFFSITE.ps1',
        'CONFIGURAR-TELEGRAM-WEBHOOK.ps1':
            'scripts/ops/setup/CONFIGURAR-TELEGRAM-WEBHOOK.ps1',
    };

    for (const [file, target] of Object.entries(wrappers)) {
        const wrapper = readRepoFile(file);
        assert.equal(
            wrapper.includes(target),
            true,
            `wrapper root debe apuntar a ${target}`
        );
        assert.equal(
            existsSync(resolve(REPO_ROOT, target)),
            true,
            `falta implementacion canonica de ops: ${file}`
        );
    }

    const opsIndex = readRepoFile('scripts/ops/README.md');
    const opsReadme = readRepoFile('scripts/ops/prod/README.md');
    assert.equal(
        opsIndex.includes(
            'Los archivos de raiz se mantienen como wrappers compatibles'
        ),
        true,
        'falta aclaracion de wrappers compatibles en scripts/ops/README.md'
    );
    assert.equal(
        opsReadme.includes(
            'Los archivos de raiz se mantienen como wrappers compatibles'
        ),
        true,
        'falta aclaracion de wrappers compatibles en scripts/ops/prod/README.md'
    );
});

test('legacy admin css sale de la raiz activa y el bundle de deploy usa estilos canonicos', () => {
    const legacyRootCss = ['admin.css', 'admin-v2.css', 'admin.min.css'];
    const archivedLegacyCss = legacyRootCss.map((file) =>
        resolve(REPO_ROOT, 'styles', 'archive', 'admin', file)
    );

    for (const file of legacyRootCss) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `css admin legacy no debe seguir en raiz: ${file}`
        );
    }

    for (const file of archivedLegacyCss) {
        assert.equal(
            existsSync(file),
            true,
            `falta css admin legacy archivado: ${file}`
        );
    }

    const archiveReadme = readRepoFile('styles/archive/admin/README.md');
    const deployOpsReadme = readRepoFile('scripts/ops/deploy/README.md');
    assert.equal(
        archiveReadme.includes('No forman parte del shell `sony_v3`'),
        true,
        'falta aclaracion de archivo legacy admin en styles/archive/admin/README.md'
    );
    assert.equal(
        deployOpsReadme.includes(
            'El bundle canonico del admin incluye `admin-v3.css` y `queue-ops.css`.'
        ),
        true,
        'falta aclaracion de assets admin canonicos en scripts/ops/deploy/README.md'
    );

    const deployBundle = readRepoFile(
        'scripts/ops/deploy/PREPARAR-PAQUETE-DESPLIEGUE.ps1'
    );
    const deployDoc = readRepoFile('DESPLIEGUE-PIELARMONIA.md');

    assert.equal(
        deployBundle.includes("'admin-v3.css'"),
        true,
        'bundle de deploy debe incluir admin-v3.css'
    );
    assert.equal(
        deployBundle.includes("'queue-ops.css'"),
        true,
        'bundle de deploy debe incluir queue-ops.css'
    );
    assert.equal(
        deployBundle.includes("'admin.css'"),
        false,
        'bundle de deploy no debe incluir admin.css legacy'
    );
    assert.equal(
        deployDoc.includes('- `admin-v3.css`'),
        true,
        'DESPLIEGUE-PIELARMONIA.md debe listar admin-v3.css'
    );
    assert.equal(
        deployDoc.includes('- `queue-ops.css`'),
        true,
        'DESPLIEGUE-PIELARMONIA.md debe listar queue-ops.css'
    );
});

test('runtime source del admin deja legacy y v2 archivados fuera del arbol activo', () => {
    const activeEntry = readRepoFile('src/apps/admin/index.js');
    const archiveIndex = readRepoFile('src/apps/archive/README.md');
    const legacyArchive = readRepoFile(
        'src/apps/archive/admin-legacy/README.md'
    );
    const v2Archive = readRepoFile('src/apps/archive/admin-v2/README.md');
    const designCharter = readRepoFile('docs/admin-v3-design-charter.md');
    const rolloutDoc = readRepoFile('docs/ADMIN-UI-ROLLOUT.md');

    assert.equal(
        existsSync(
            resolve(REPO_ROOT, 'src', 'apps', 'admin', 'legacy-index.js')
        ),
        false,
        'legacy-index.js no debe seguir en src/apps/admin'
    );
    assert.equal(
        existsSync(resolve(REPO_ROOT, 'src', 'apps', 'admin', 'modules')),
        false,
        'modules legacy no deben seguir en src/apps/admin'
    );
    assert.equal(
        existsSync(resolve(REPO_ROOT, 'src', 'apps', 'admin', 'utils.js')),
        false,
        'utils legacy no debe seguir en src/apps/admin'
    );
    assert.equal(
        existsSync(resolve(REPO_ROOT, 'src', 'apps', 'admin-v2')),
        false,
        'admin-v2 no debe seguir en el arbol activo'
    );

    assert.equal(
        existsSync(
            resolve(
                REPO_ROOT,
                'src',
                'apps',
                'archive',
                'admin-legacy',
                'legacy-index.js'
            )
        ),
        true,
        'falta legacy-index.js archivado'
    );
    assert.equal(
        existsSync(
            resolve(
                REPO_ROOT,
                'src',
                'apps',
                'archive',
                'admin-legacy',
                'modules'
            )
        ),
        true,
        'falta modules legacy archivado'
    );
    assert.equal(
        existsSync(
            resolve(
                REPO_ROOT,
                'src',
                'apps',
                'archive',
                'admin-legacy',
                'utils.js'
            )
        ),
        true,
        'falta utils legacy archivado'
    );
    assert.equal(
        existsSync(
            resolve(REPO_ROOT, 'src', 'apps', 'archive', 'admin-v2', 'index.js')
        ),
        true,
        'falta admin-v2 archivado'
    );

    assert.equal(
        activeEntry.includes("import('../admin-v3/index.js')"),
        true,
        'entrypoint activo debe cargar admin-v3'
    );
    assert.equal(
        activeEntry.includes('admin-v2'),
        false,
        'entrypoint activo no debe depender de admin-v2'
    );
    assert.equal(
        activeEntry.includes('legacy-index'),
        false,
        'entrypoint activo no debe depender de legacy-index'
    );

    assert.equal(
        archiveIndex.includes('No forman parte del bundle activo'),
        true,
        'falta aclaracion de archivo historico en src/apps/archive/README.md'
    );
    assert.equal(
        legacyArchive.includes('Se conserva solo como referencia historica.'),
        true,
        'falta aclaracion de archivo historico en src/apps/archive/admin-legacy/README.md'
    );
    assert.equal(
        v2Archive.includes('No forma parte del shell `admin.html`'),
        true,
        'falta aclaracion de archivo historico en src/apps/archive/admin-v2/README.md'
    );
    assert.equal(
        designCharter.includes('src/apps/archive/admin-legacy/**'),
        true,
        'design charter debe apuntar al archivo admin-legacy'
    );
    assert.equal(
        designCharter.includes('revert + deploy'),
        true,
        'design charter debe fijar rollback por revert + deploy'
    );
    assert.equal(
        rolloutDoc.includes('src/apps/archive/admin-v2/'),
        true,
        'ADMIN-UI-ROLLOUT debe apuntar al archivo admin-v2'
    );
});

test('preboot admin y residuos v2 salen del carril activo', () => {
    const activeEntry = readRepoFile('src/apps/admin/index.js');
    const preboot = readRepoFile('js/admin-preboot-shortcuts.js');
    const domContract = readRepoFile('docs/admin-dom-contract.md');
    const archiveScriptsIndex = readRepoFile('scripts/archive/README.md');

    assert.equal(
        activeEntry.includes('adminUiVariant'),
        false,
        'entrypoint admin no debe seguir limpiando adminUiVariant'
    );
    assert.equal(
        activeEntry.includes('admin_ui'),
        false,
        'entrypoint admin no debe seguir procesando admin_ui'
    );
    assert.equal(
        preboot.includes('adminUiVariant'),
        false,
        'preboot admin no debe seguir limpiando adminUiVariant'
    );
    assert.equal(
        preboot.includes('admin_ui'),
        false,
        'preboot admin no debe seguir procesando admin_ui'
    );
    assert.equal(
        domContract.includes('preboot/runtime no longer reads or mutates it.'),
        true,
        'admin-dom-contract debe fijar que la compatibilidad legacy es inerte'
    );
    assert.equal(
        existsSync(resolve(REPO_ROOT, 'bin', 'run-admin-queue-v2.js')),
        false,
        'run-admin-queue-v2.js no debe seguir en bin/'
    );
    assert.equal(
        existsSync(
            resolve(REPO_ROOT, 'scripts', 'archive', 'run-admin-queue-v2.js')
        ),
        true,
        'run-admin-queue-v2.js debe quedar archivado'
    );
    assert.equal(
        archiveScriptsIndex.includes('run-admin-queue-v2.js'),
        true,
        'scripts/archive/README.md debe documentar el runner v2 archivado'
    );
});
