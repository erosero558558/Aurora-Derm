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

test('docs locales y pentests apuntan al host canonico 127.0.0.1:8011 o aceptan TEST_BASE_URL', () => {
    const readme = readRepoFile('README.md');
    const serverLocal = readRepoFile('SERVIDOR-LOCAL.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const pentestP0 = readRepoFile('tests/pentest_p0.php');
    const penetration = readRepoFile('tests/penetration_test.php');

    assert.equal(
        readme.includes('php -S 127.0.0.1:8011 -t .'),
        true,
        'README.md debe usar 127.0.0.1:8011 como setup local canonico'
    );
    assert.equal(
        readme.includes('http://127.0.0.1:8011/admin.html'),
        true,
        'README.md debe apuntar el admin al host local canonico'
    );
    assert.equal(
        readme.includes('TEST_LOCAL_SERVER_PORT'),
        true,
        'README.md debe documentar TEST_LOCAL_SERVER_PORT'
    );
    assert.equal(
        serverLocal.includes('php -S 127.0.0.1:8011 -t .'),
        true,
        'SERVIDOR-LOCAL.md debe usar 127.0.0.1:8011 como arranque canonico'
    );
    assert.equal(
        serverLocal.includes('TEST_BASE_URL'),
        true,
        'SERVIDOR-LOCAL.md debe documentar TEST_BASE_URL'
    );
    assert.equal(
        operationsIndex.includes('http://127.0.0.1:8011'),
        true,
        'OPERATIONS_INDEX debe fijar el host local canonico'
    );
    assert.equal(
        pentestP0.includes(
            "getenv('TEST_BASE_URL') ?: 'http://127.0.0.1:8011'"
        ),
        true,
        'tests/pentest_p0.php debe usar TEST_BASE_URL o el host local canonico'
    );
    assert.equal(
        pentestP0.includes(
            "getenv('PIELARMONIA_ADMIN_PASSWORD') ?: 'admin123'"
        ),
        true,
        'tests/pentest_p0.php debe usar la password admin desde env o fallback controlado'
    );
    assert.equal(
        penetration.includes(
            "getenv('TEST_BASE_URL') ?: 'http://127.0.0.1:8011'"
        ),
        true,
        'tests/penetration_test.php debe usar TEST_BASE_URL o el host local canonico'
    );
    assert.equal(
        penetration.includes(
            "getenv('PIELARMONIA_ADMIN_PASSWORD') ?: 'admin123'"
        ),
        true,
        'tests/penetration_test.php debe usar la password admin desde env o fallback controlado'
    );

    assert.doesNotMatch(
        readme,
        /127\.0\.0\.1:8000|localhost:8000/,
        'README.md no debe seguir apuntando a 8000'
    );
    assert.doesNotMatch(
        serverLocal,
        /127\.0\.0\.1:8000|localhost:8000/,
        'SERVIDOR-LOCAL.md no debe seguir apuntando a 8000'
    );
});

test('docs activas distinguen desarrollo local canonico del verify live del deploy', () => {
    const contributing = readRepoFile('docs/CONTRIBUTING.md');
    const disasterRecovery = readRepoFile('docs/DISASTER_RECOVERY.md');
    const openapi = readRepoFile('docs/openapi.yaml');
    const deployment = readRepoFile('docs/DEPLOYMENT.md');
    const publicV3Deploy = readRepoFile('docs/PUBLIC_V3_MANUAL_DEPLOY.md');
    const publicV2Deploy = readRepoFile('docs/PUBLIC_V2_MANUAL_DEPLOY.md');
    const publicMainRunbook = readRepoFile(
        'docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md'
    );
    const opsIndex = readRepoFile('scripts/ops/README.md');
    const deployScript = readRepoFile('bin/deploy-public-v3-live.sh');

    assert.equal(
        contributing.includes('php -S 127.0.0.1:8011 -t .'),
        true,
        'CONTRIBUTING debe fijar 127.0.0.1:8011 como setup local'
    );
    assert.equal(
        contributing.includes('TEST_BASE_URL'),
        true,
        'CONTRIBUTING debe documentar TEST_BASE_URL'
    );
    assert.equal(
        disasterRecovery.includes('php -S 127.0.0.1:8011 -t .'),
        true,
        'DISASTER_RECOVERY debe usar 127.0.0.1:8011 en simulacros locales'
    );
    assert.equal(
        disasterRecovery.includes('TEST_BASE_URL'),
        true,
        'DISASTER_RECOVERY debe documentar TEST_BASE_URL para restauraciones automatizadas'
    );
    assert.equal(
        openapi.includes('- url: http://127.0.0.1:8011'),
        true,
        'openapi.yaml debe usar el host local canonico'
    );
    assert.equal(
        deployment.includes('LOCAL_VERIFY_BASE_URL'),
        true,
        'DEPLOYMENT debe distinguir el verify live via LOCAL_VERIFY_BASE_URL'
    );
    assert.equal(
        opsIndex.includes('LOCAL_VERIFY_BASE_URL'),
        true,
        'scripts/ops/README.md debe documentar LOCAL_VERIFY_BASE_URL'
    );
    assert.equal(
        publicV3Deploy.includes('LOCAL_VERIFY_BASE_URL'),
        true,
        'PUBLIC_V3_MANUAL_DEPLOY debe documentar LOCAL_VERIFY_BASE_URL'
    );
    assert.equal(
        publicV3Deploy.includes('TEST_BASE_URL'),
        true,
        'PUBLIC_V3_MANUAL_DEPLOY debe distinguir TEST_BASE_URL del verify live'
    );
    assert.equal(
        publicV2Deploy.includes('LOCAL_VERIFY_BASE_URL'),
        true,
        'PUBLIC_V2_MANUAL_DEPLOY debe propagar LOCAL_VERIFY_BASE_URL al alias legacy'
    );
    assert.equal(
        publicMainRunbook.includes('LOCAL_VERIFY_BASE_URL'),
        true,
        'PUBLIC_MAIN_UPDATE_RUNBOOK debe documentar LOCAL_VERIFY_BASE_URL para fallback VPS'
    );
    assert.equal(
        deployScript.includes(
            'LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL:-http://127.0.0.1:8080}"'
        ),
        true,
        'deploy-public-v3-live debe permitir override del verify live'
    );
    assert.equal(
        deployScript.includes(
            'LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL%/}"'
        ),
        true,
        'deploy-public-v3-live debe normalizar slash final del verify live'
    );
    assert.equal(
        deployScript.includes('curl -I "$LOCAL_VERIFY_BASE_URL/es/"'),
        true,
        'deploy-public-v3-live debe verificar el host live via LOCAL_VERIFY_BASE_URL'
    );

    assert.doesNotMatch(
        contributing,
        /localhost:8080|127\.0\.0\.1:8080/,
        'CONTRIBUTING no debe seguir usando 8080 para desarrollo local'
    );
    assert.doesNotMatch(
        disasterRecovery,
        /localhost:8080|127\.0\.0\.1:8080/,
        'DISASTER_RECOVERY no debe seguir usando 8080 para simulacros locales'
    );
});

test('tooling local de performance usa el host canonico y expone benchmark reutilizable', () => {
    const readme = readRepoFile('README.md');
    const serverLocal = readRepoFile('SERVIDOR-LOCAL.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const runbooks = readRepoFile('docs/RUNBOOKS.md');
    const packageJson = readRepoFile('package.json');
    const benchmarkScript = readRepoFile('bin/run-benchmark-local.sh');
    const performanceGate = readRepoFile('bin/run-public-performance-gate.js');

    assert.equal(
        packageJson.includes(
            '"benchmark:local": "bash ./bin/run-benchmark-local.sh"'
        ),
        true,
        'package.json debe exponer benchmark:local'
    );
    assert.equal(
        readme.includes('npm run benchmark:local'),
        true,
        'README.md debe exponer npm run benchmark:local'
    );
    assert.equal(
        serverLocal.includes('npm run benchmark:local'),
        true,
        'SERVIDOR-LOCAL.md debe exponer npm run benchmark:local'
    );
    assert.equal(
        operationsIndex.includes('npm run benchmark:local'),
        true,
        'OPERATIONS_INDEX debe exponer npm run benchmark:local'
    );
    assert.equal(
        runbooks.includes('npm run benchmark:local'),
        true,
        'RUNBOOKS debe apuntar al benchmark dedicado'
    );

    for (const snippet of [
        'BENCHMARK_LOCAL_PORT="${BENCHMARK_LOCAL_PORT:-${TEST_LOCAL_SERVER_PORT:-8011}}"',
        'BASE_URL="${BENCHMARK_BASE_URL:-${TEST_BASE_URL:-$DEFAULT_BASE_URL}}"',
        'BASE_URL="${BASE_URL%/}"',
        'BENCHMARK_START_LOCAL_SERVER="${BENCHMARK_START_LOCAL_SERVER:-auto}"',
        'mkdir -p "$(dirname "$OUTPUT_FILE")"',
        'Using existing host: ${BASE_URL}',
        'Starting local PHP server on ${BASE_URL} ...',
    ]) {
        assert.equal(
            benchmarkScript.includes(snippet),
            true,
            `run-benchmark-local debe incluir ${snippet}`
        );
    }

    assert.doesNotMatch(
        benchmarkScript,
        /PORT="8080"|http:\/\/\$\{HOST\}:\$\{PORT\}/,
        'run-benchmark-local no debe seguir anclado al legado 8080'
    );

    assert.equal(
        performanceGate.includes(
            "const DEFAULT_LOCAL_PORT = Number(process.env.TEST_LOCAL_SERVER_PORT || '8011');"
        ),
        true,
        'run-public-performance-gate debe respetar TEST_LOCAL_SERVER_PORT con fallback a 8011'
    );
    assert.equal(
        performanceGate.includes(
            "const DEFAULT_LOCAL_HOST = process.env.TEST_LOCAL_SERVER_HOST || '127.0.0.1';"
        ),
        true,
        'run-public-performance-gate debe fijar 127.0.0.1 como host local por defecto'
    );
    assert.doesNotMatch(
        performanceGate,
        /const DEFAULT_LOCAL_PORT = 8096;/,
        'run-public-performance-gate no debe seguir usando 8096 como default fijo'
    );
});

test('lighthouse local y docs operativas distinguen QA canonico frente a puertos Docker', () => {
    const defaultLhci = readRepoFile('.lighthouserc.json');
    const premiumLhci = readRepoFile('lighthouserc.premium.json');
    const premiumRunner = readRepoFile('bin/run-lighthouse-premium.js');
    const monitoring = readRepoFile('docs/MONITORING_SETUP.md');
    const deployGuide = readRepoFile('DESPLIEGUE-PIELARMONIA.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');

    assert.equal(
        defaultLhci.includes('"php -S 127.0.0.1:8011 -t ."'),
        true,
        '.lighthouserc.json debe usar 127.0.0.1:8011 como host local canonico'
    );
    assert.equal(
        premiumLhci.includes('"php -S 127.0.0.1:8011 -t ."'),
        true,
        'lighthouserc.premium.json debe usar 127.0.0.1:8011 como host local canonico'
    );
    assert.doesNotMatch(
        defaultLhci,
        /127\.0\.0\.1:8080/,
        '.lighthouserc.json no debe seguir anclado a 8080'
    );
    assert.doesNotMatch(
        premiumLhci,
        /127\.0\.0\.1:8088/,
        'lighthouserc.premium.json no debe seguir anclado a 8088'
    );

    for (const snippet of [
        'LIGHTHOUSE_LOCAL_SERVER_PORT',
        'LIGHTHOUSE_LOCAL_SERVER_HOST',
        'LIGHTHOUSE_BASE_URL',
        'TEST_BASE_URL',
        'lighthouserc.premium.runtime.json',
        'LIGHTHOUSE_START_LOCAL_SERVER=0 requires LIGHTHOUSE_BASE_URL or TEST_BASE_URL',
    ]) {
        assert.equal(
            premiumRunner.includes(snippet),
            true,
            `run-lighthouse-premium debe incluir ${snippet}`
        );
    }

    assert.equal(
        monitoring.includes(
            'canonical bare PHP server for local QA remains `127.0.0.1:8011`'
        ),
        true,
        'MONITORING_SETUP debe distinguir el host canonico de QA frente al puerto Docker'
    );
    assert.equal(
        deployGuide.includes(
            '`localhost:8080` aqui pertenece solo al stack Docker'
        ),
        true,
        'DESPLIEGUE-PIELARMONIA debe aclarar que 8080 corresponde solo al stack Docker'
    );
    assert.equal(
        operationsIndex.includes('LIGHTHOUSE_LOCAL_SERVER_PORT'),
        true,
        'OPERATIONS_INDEX debe documentar LIGHTHOUSE_LOCAL_SERVER_PORT'
    );
    assert.equal(
        operationsIndex.includes('LIGHTHOUSE_BASE_URL'),
        true,
        'OPERATIONS_INDEX debe documentar LIGHTHOUSE_BASE_URL'
    );
});

test('php self-hosted tests usan helper portable y salen del carril posix-only', () => {
    const helper = readRepoFile('tests/test_server.php');
    const runner = readRepoFile('tests/run-php-tests.php');
    const contributing = readRepoFile('docs/CONTRIBUTING.md');
    const migratedFiles = [
        'tests/ApiSecurityTest.php',
        'tests/BookingFlowTest.php',
        'tests/CriticalFlowsE2ETest.php',
        'tests/verify_backups_p0.php',
        'tests/security_scan.php',
    ];

    assert.equal(
        helper.includes("return '127.0.0.1';"),
        true,
        'test_server.php debe fijar 127.0.0.1 como host local por defecto'
    );
    assert.equal(
        helper.includes('proc_open($command'),
        true,
        'test_server.php debe arrancar el servidor con proc_open'
    );
    assert.equal(
        helper.includes('@proc_terminate($process)'),
        true,
        'test_server.php debe detener el servidor con proc_terminate'
    );

    for (const file of migratedFiles) {
        const raw = readRepoFile(file);
        assert.equal(
            raw.includes('start_test_php_server('),
            true,
            `${file} debe usar start_test_php_server`
        );
        assert.equal(
            raw.includes('stop_test_php_server('),
            true,
            `${file} debe usar stop_test_php_server`
        );
        assert.equal(
            raw.includes('& echo $!'),
            false,
            `${file} no debe seguir arrancando servidores con shell POSIX`
        );
        assert.equal(
            raw.includes('kill $pid'),
            false,
            `${file} no debe seguir matando procesos con kill`
        );
        assert.equal(
            raw.includes('localhost:$port'),
            false,
            `${file} no debe seguir atado a localhost:$port`
        );
    }

    assert.equal(
        runner.includes("'test_server.php'"),
        true,
        'run-php-tests.php debe excluir el helper test_server.php del discovery'
    );
    assert.equal(
        runner.includes('PIELARMONIA_TEST_INCLUDE_POSIX'),
        false,
        'run-php-tests.php no debe conservar el gate legacy PIELARMONIA_TEST_INCLUDE_POSIX'
    );
    assert.equal(
        runner.includes('posixOnlyFiles'),
        false,
        'run-php-tests.php no debe conservar la lista legacy posixOnlyFiles'
    );
    assert.equal(
        contributing.includes('helper') &&
            contributing.includes('Windows o Unix'),
        true,
        'CONTRIBUTING debe documentar el helper portable del runner PHP'
    );
});
