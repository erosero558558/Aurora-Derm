#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('fs');
const { resolve } = require('path');
const { spawnSync } = require('child_process');
const { GENERATED_SITE_ROOT } = require('../bin/lib/generated-site-root.js');

const WRAPPER_PATH = resolve(__dirname, '..', 'GATE-ADMIN-ROLLOUT.ps1');
const SCRIPT_PATH = resolve(
    __dirname,
    '..',
    'scripts',
    'ops',
    'admin',
    'GATE-ADMIN-ROLLOUT.ps1'
);
const NODE_GATE_PATH = resolve(
    __dirname,
    '..',
    'bin',
    'admin-rollout-gate.js'
);
const ADMIN_HTML_PATH = resolve(__dirname, '..', 'admin.html');
const OPERATOR_HTML_PATH = resolve(__dirname, '..', 'operador-turnos.html');
const ADMIN_RUNTIME_PATH = resolve(__dirname, '..', 'js', 'admin-runtime.js');
const ADMIN_ENTRY_PATH = resolve(
    __dirname,
    '..',
    'src',
    'apps',
    'admin',
    'index.js'
);
const ADMIN_PREBOOT_PATH = resolve(
    __dirname,
    '..',
    'js',
    'admin-preboot-shortcuts.js'
);
const ADMIN_BUNDLE_PATH = resolveGeneratedRuntimePath('admin.js');
const ADMIN_CHUNKS_DIR = resolveGeneratedRuntimePath('js', 'admin-chunks');
const CLEAN_ADMIN_CHUNKS_PATH = resolve(
    __dirname,
    '..',
    'bin',
    'clean-admin-chunks.js'
);
const REPO_ROOT = resolve(__dirname, '..');
const PACKAGE_JSON_PATH = resolve(__dirname, '..', 'package.json');
const PLAYWRIGHT_CONFIG_PATH = resolve(__dirname, '..', 'playwright.config.js');
const SW_PATH = resolve(__dirname, '..', 'sw.js');
const MERGE_CONFLICT_MARKER_PATTERN = /^(<{7,}.*|={7,}|>{7,}.*)$/m;
let generatedRuntimePrepared = false;

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

function loadWrapper() {
    return readFileSync(WRAPPER_PATH, 'utf8');
}

function loadFile(path) {
    return readFileSync(path, 'utf8');
}

function loadNodeGate() {
    return readFileSync(NODE_GATE_PATH, 'utf8');
}

function resolveGeneratedRuntimePath(...segments) {
    return resolve(GENERATED_SITE_ROOT, ...segments);
}

function ensureGeneratedRuntimePaths(paths, label) {
    const requiredPaths = Array.isArray(paths) ? paths : [paths];
    const missingPaths = requiredPaths.filter(
        (pathValue) => !existsSync(pathValue)
    );
    if (missingPaths.length === 0) {
        return;
    }

    if (!generatedRuntimePrepared) {
        const result =
            process.platform === 'win32'
                ? spawnSync(
                      'cmd.exe',
                      ['/d', '/s', '/c', 'npx rollup -c rollup.config.mjs'],
                      {
                          cwd: REPO_ROOT,
                          encoding: 'utf8',
                      }
                  )
                : spawnSync('npx', ['rollup', '-c', 'rollup.config.mjs'], {
                      cwd: REPO_ROOT,
                      encoding: 'utf8',
                  });
        generatedRuntimePrepared = true;
        assert.equal(
            result.status,
            0,
            (result.error && result.error.message) ||
                result.stderr ||
                result.stdout ||
                'no se pudo regenerar el runtime JS staged con rollup'
        );
    }

    const stillMissingPaths = requiredPaths.filter(
        (pathValue) => !existsSync(pathValue)
    );
    assert.equal(
        stillMissingPaths.length,
        0,
        `faltan assets runtime stageados (${label || 'runtime staged'}): ${stillMissingPaths
            .map((pathValue) =>
                pathValue
                    .replace(`${GENERATED_SITE_ROOT}\\`, '')
                    .replace(`${GENERATED_SITE_ROOT}/`, '')
                    .replace(/\\/g, '/')
            )
            .join(', ')}`
    );
}

function assertGeneratedRuntimePathExists(pathValue, label) {
    const relativePath = pathValue
        .replace(`${GENERATED_SITE_ROOT}\\`, '')
        .replace(`${GENERATED_SITE_ROOT}/`, '')
        .replace(/\\/g, '/');
    ensureGeneratedRuntimePaths(pathValue, label || relativePath);
    assert.equal(
        existsSync(pathValue),
        true,
        `falta runtime staged ${label || relativePath} en .generated/site-root. Ejecuta npm run build para regenerar el runtime canonico`
    );
    return pathValue;
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractAssetVersion(content, assetPath) {
    const pattern = new RegExp(
        `${escapeRegExp(assetPath)}\\?v=([^"'\\s]+)`,
        'i'
    );
    const match = content.match(pattern);
    return match ? match[1] : '';
}

function parseAdminChunkImports(content) {
    return Array.from(
        content.matchAll(/\.\/js\/admin-chunks\/([^"'`?#]+\.js)/g),
        (match) => String(match[1] || '').trim()
    ).filter(Boolean);
}

test('admin rollout root wrapper delega a la implementacion canonica de admin ops', () => {
    const raw = loadWrapper();

    assert.equal(
        raw.includes('scripts/ops/admin/GATE-ADMIN-ROLLOUT.ps1'),
        true,
        'wrapper root debe apuntar a scripts/ops/admin/GATE-ADMIN-ROLLOUT.ps1'
    );
    assert.equal(
        raw.includes('Push-Location $PSScriptRoot'),
        true,
        'wrapper root debe fijar cwd al repo root'
    );
});

test('admin rollout gate expone stage estable y contrato v3-only', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes("[Alias('RequireOpenClawAuth')]"),
        true,
        'falta alias RequireOpenClawAuth para compatibilidad del gate'
    );
    assert.equal(
        raw.includes('[switch]$RequireOperatorAuth'),
        true,
        'falta flag RequireOperatorAuth para endurecer el gate'
    );
    assert.equal(
        raw.includes(
            "[ValidateSet('stable', 'internal', 'canary', 'general', 'rollback')]"
        ),
        true,
        'falta validate set alineado con los stages canonicos del rollout'
    );
    assert.equal(
        raw.includes('[switch]$AllowFeatureApiFailure'),
        true,
        'falta flag AllowFeatureApiFailure para el gate invocado desde deploy-hosting'
    );
    assert.equal(
        raw.includes('[switch]$AllowMissingAdminFlag'),
        true,
        'falta flag AllowMissingAdminFlag para el gate invocado desde deploy-hosting'
    );
    assert.equal(
        raw.includes('url = "$base/admin.html"'),
        true,
        'falta chequeo canonico de admin.html'
    );
    assert.equal(
        raw.includes("error = ''"),
        true,
        'falta campo de error para diagnostico del gate'
    );
    assert.equal(
        raw.includes('has_admin_v3_css = $false'),
        true,
        'falta flag de admin-v3.css en el reporte'
    );
    assert.equal(
        raw.includes('uses_canonical_runtime = $false'),
        true,
        'falta flag de runtime canonico en el reporte'
    );
    assert.equal(
        raw.includes('references_runtime_bridge = $false'),
        true,
        'falta flag de runtime bridge heredado en el reporte'
    );
    assert.equal(
        raw.includes('references_legacy_styles = $false'),
        true,
        'falta flag de referencias legacy en el reporte'
    );
    assert.equal(
        raw.includes('operator_auth = [ordered]@{'),
        true,
        'falta bloque operator_auth en el reporte'
    );
});

test('admin shell usa el bundle canonico v3 y deja runtime bridge solo como alias', () => {
    const html = loadFile(ADMIN_HTML_PATH);
    const runtimeBridge = loadFile(ADMIN_RUNTIME_PATH);

    assert.match(
        html,
        /href="admin-v3\.css\?v=/,
        'admin.html debe cargar admin-v3.css'
    );
    assert.match(
        html,
        /src="admin\.js\?v=/,
        'admin.html debe cargar admin.js canonico'
    );
    assert.doesNotMatch(
        html,
        /js\/admin-runtime\.js/,
        'admin.html no debe cargar el runtime bridge heredado'
    );
    assert.doesNotMatch(
        html,
        /href="admin\.css|href="admin-v2\.css|href="admin\.min\.css/,
        'admin.html no debe referenciar hojas de estilo legacy'
    );

    assert.match(
        runtimeBridge,
        /import '\.\.\/admin\.js';/,
        'admin-runtime debe reenviar al bundle canonico'
    );
    assert.doesNotMatch(
        runtimeBridge,
        /src\/apps\/admin\/index\.js/,
        'admin-runtime ya no debe importar codigo fuente desde src'
    );
});

test('admin entrypoint y preboot ya no limpian compatibilidad legacy', () => {
    const entry = loadFile(ADMIN_ENTRY_PATH);
    const preboot = loadFile(ADMIN_PREBOOT_PATH);

    assert.match(
        entry,
        /import\('\.\.\/admin-v3\/index\.js'\)/,
        'entrypoint activo debe cargar admin-v3'
    );
    assert.doesNotMatch(
        entry,
        /adminUiVariant|admin_ui_reset|admin_ui/,
        'entrypoint activo no debe mutar compatibilidad legacy'
    );
    assert.doesNotMatch(
        preboot,
        /adminUiVariant|admin_ui_reset|admin_ui/,
        'preboot admin no debe mutar compatibilidad legacy'
    );
    assert.match(
        preboot,
        /clinical-history/,
        'preboot admin debe mantener historia clinica dentro del shell RC1'
    );
    assert.doesNotMatch(
        preboot,
        /reviews|queue/,
        'preboot admin no debe sembrar shortcuts hacia superficies ocultas del RC1'
    );
});

test('service worker precachea el shell admin canonico sin assets legacy', () => {
    const sw = loadFile(SW_PATH);

    assert.match(sw, /'\/admin\.html'/, 'sw debe precachear admin.html');
    assert.match(sw, /'\/admin-v3\.css\?v=/, 'sw debe precachear admin-v3.css');
    assert.match(sw, /'\/admin\.js\?v=/, 'sw debe precachear admin.js');
    assert.match(
        sw,
        /'\/js\/admin-preboot-shortcuts\.js\?v=/,
        'sw debe precachear el preboot admin'
    );
    assert.doesNotMatch(
        sw,
        /'\/admin\.css\?v=/,
        'sw no debe precachear admin.css legacy'
    );
    assert.doesNotMatch(
        sw,
        /'\/js\/admin-runtime\.js\?v=/,
        'sw no debe precachear el runtime bridge heredado'
    );
});

test('shell admin y service worker comparten versiones canonicas de assets admin', () => {
    const html = loadFile(ADMIN_HTML_PATH);
    const sw = loadFile(SW_PATH);
    const adminAssets = [
        'admin-v3.css',
        'admin.js',
        'queue-ops.css',
        'js/admin-preboot-shortcuts.js',
    ];

    for (const asset of adminAssets) {
        const htmlVersion = extractAssetVersion(html, asset);
        const swVersion = extractAssetVersion(sw, `/${asset}`);

        assert.notEqual(htmlVersion, '', `admin.html debe versionar ${asset}`);
        assert.equal(
            swVersion,
            htmlVersion,
            `sw.js debe precachear ${asset} con la misma version del shell`
        );
    }
});

test('shell operador y service worker comparten versiones canonicas de assets turnero', () => {
    const html = loadFile(OPERATOR_HTML_PATH);
    const sw = loadFile(SW_PATH);
    const operatorAssets = ['queue-ops.css', 'js/queue-operator.js'];

    for (const asset of operatorAssets) {
        const htmlVersion = extractAssetVersion(html, asset);
        const swVersion = extractAssetVersion(sw, `/${asset}`);

        assert.notEqual(
            htmlVersion,
            '',
            `operador-turnos.html debe versionar ${asset}`
        );
        assert.equal(
            swVersion,
            htmlVersion,
            `sw.js debe precachear ${asset} con la misma version del shell operador`
        );
    }
});

test('node gate admin expone surface parity para admin y operador contra sw.js', () => {
    const raw = loadNodeGate();

    for (const snippet of [
        'url: `${base}/sw.js`',
        'url: `${base}/operador-turnos.html`',
        'cache_name:',
        'admin_shell_vs_sw_ok: false',
        'operator_shell_vs_sw_ok: false',
        'mismatches: []',
        "const adminAssets = [",
        "const operatorAssets = ['queue-ops.css', 'js/queue-operator.js']",
        "compareShellVsServiceWorker(",
        "'admin_shell_vs_sw'",
        "'operator_shell_vs_sw'",
        '[FAIL] admin shell vs sw drift detectado',
        '[FAIL] operador-turnos shell vs sw drift detectado',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta parity surface->sw en bin/admin-rollout-gate.js: ${snippet}`
        );
    }
});

test('package.json expone check canonico para chunks admin', () => {
    const packageJson = loadFile(PACKAGE_JSON_PATH);

    assert.equal(
        packageJson.includes(
            '"chunks:admin:check": "node bin/clean-admin-chunks.js --dry-run --strict"'
        ),
        true,
        'package.json debe exponer chunks:admin:check como diagnostico canonico'
    );
});

test('package.json expone gate endurecido para rollout Operator Auth del admin', () => {
    const packageJson = loadFile(PACKAGE_JSON_PATH);

    assert.equal(
        packageJson.includes(
            '"gate:admin:rollout:auth": "powershell -NoProfile -ExecutionPolicy Bypass -File ./GATE-ADMIN-ROLLOUT.ps1 -Domain https://pielarmonia.com -Stage general -RequireOperatorAuth"'
        ),
        true,
        'package.json debe exponer gate:admin:rollout:auth'
    );
});

test('package.json mueve el preflight de chunks admin a agent:test y deja agent:gate como carril diario local', () => {
    const packageJson = loadFile(PACKAGE_JSON_PATH);

    assert.equal(
        packageJson.includes(
            '"agent:test": "npm run chunks:admin:check && node --test'
        ),
        true,
        'agent:test debe fallar temprano por drift admin antes de la suite larga'
    );
    assert.equal(
        packageJson.includes(
            '"agent:gate": "npm run workspace:hygiene:doctor -- --json --strict && node agent-orchestrator.js board doctor --strict --json && npm run agent:test'
        ),
        true,
        'agent:gate debe quedarse como carril diario/local sin duplicar el preflight de chunks'
    );
});

test('package.json expone agent:gate:release para el carril duro de cierre/publicacion', () => {
    const packageJson = loadFile(PACKAGE_JSON_PATH);

    assert.equal(
        packageJson.includes(
            '"agent:gate:release": "npm run agent:gate && node agent-orchestrator.js focus check --enforce-required-checks --json && node agent-orchestrator.js jobs verify public_main_sync --json && node agent-orchestrator.js runtime verify pilot_runtime --json"'
        ),
        true,
        'agent:gate:release debe endurecer focus, jobs verify y runtime verify para release'
    );
});

test('package.json incluye la spec de login OpenClaw dentro del QA canonico del admin', () => {
    const packageJson = loadFile(PACKAGE_JSON_PATH);

    assert.equal(
        packageJson.includes(
            'tests/admin-openclaw-login.spec.js tests/admin-navigation-responsive.spec.js'
        ),
        true,
        'test:frontend:qa:admin debe cubrir admin-openclaw-login.spec.js dentro del carril canonico'
    );
});

test('playwright local usa puerto dedicado y reuse opt-in para evitar drift de servidores viejos', () => {
    const raw = loadFile(PLAYWRIGHT_CONFIG_PATH);

    assert.equal(
        raw.includes('TEST_LOCAL_SERVER_PORT'),
        true,
        'playwright config debe permitir override de puerto local'
    );
    assert.equal(
        raw.includes('parsePortEnv(process.env.TEST_LOCAL_SERVER_PORT, 8011)'),
        true,
        'playwright config debe usar 8011 como puerto local canonico por defecto'
    );
    assert.equal(
        raw.includes('TEST_REUSE_EXISTING_SERVER'),
        true,
        'playwright config debe requerir opt-in explicito para reusar servidor existente'
    );
    assert.equal(
        raw.includes('reuseExistingServer,'),
        true,
        'webServer debe depender de reuseExistingServer configurable'
    );
    assert.doesNotMatch(
        raw,
        /127\.0\.0\.1:8000|http\.server 8000|port:\s*8000/,
        'playwright config no debe seguir anclado al puerto 8000'
    );
});

test('admin rollout gate fuerza Playwright al Domain configurado', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes("base_url = ''"),
        true,
        'runtime_smoke debe registrar el base_url utilizado'
    );
    assert.equal(
        raw.includes('$report.runtime_smoke.base_url = $base'),
        true,
        'gate debe persistir el Domain usado por runtime_smoke'
    );
    assert.equal(
        raw.includes('$env:TEST_BASE_URL = $BaseUrl'),
        true,
        'gate debe inyectar TEST_BASE_URL para que Playwright use el Domain solicitado'
    );
    assert.equal(
        raw.includes("$env:TEST_REUSE_EXISTING_SERVER = '0'"),
        true,
        'gate debe desactivar reuseExistingServer durante el smoke'
    );
    assert.equal(
        raw.includes(
            'Invoke-PlaywrightSmokeSuite -Name $suite.Name -Specs $suite.Specs -BaseUrl $base'
        ),
        true,
        'gate debe pasar el Domain del gate a cada suite Playwright'
    );
});

test('admin rollout gate registra suites runtime v3-only', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('runtime_smoke = [ordered]@{'),
        true,
        'falta bloque runtime_smoke en el reporte'
    );
    assert.equal(
        raw.includes("base_url = ''"),
        true,
        'falta base_url del smoke runtime en el reporte'
    );
    assert.equal(
        raw.includes('suites = @()'),
        true,
        'falta coleccion de suites runtime en el reporte'
    );
    assert.equal(
        raw.includes("Name = 'admin-ui-runtime'"),
        true,
        'falta suite base admin-ui-runtime'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-ui-runtime-smoke.spec.js')"),
        true,
        'falta spec base admin-ui-runtime-smoke'
    );
    assert.equal(
        raw.includes("Name = 'admin-v3-runtime'"),
        true,
        'falta suite estable admin-v3-runtime'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-v3-canary-runtime.spec.js')"),
        true,
        'falta spec estable de runtime V3'
    );
    assert.equal(
        raw.includes("Name = 'admin-auth'"),
        true,
        'falta suite de login Operator Auth en el gate admin'
    );
    assert.equal(
        raw.includes("Specs = @('tests/admin-openclaw-login.spec.js')"),
        true,
        'falta spec de login OpenClaw en el gate admin'
    );
});

test('admin rollout gate captura la surface operator-auth-status y puede endurecer Operator Auth', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('url = "$base/api.php?resource=operator-auth-status"'),
        true,
        'falta URL canonica de operator-auth-status en el reporte del gate'
    );
    assert.equal(
        raw.includes('facade_url = "$base/admin-auth.php?action=status"'),
        true,
        'falta URL fallback de admin-auth.php?action=status en el reporte del gate'
    );
    assert.equal(
        raw.includes("source = ''"),
        true,
        'falta campo source para diagnosticar que surface resolvio operator_auth'
    );
    assert.equal(
        raw.includes('contract_valid = $false'),
        true,
        'falta flag contract_valid para endurecer el rollout Operator Auth'
    );
    assert.equal(
        raw.includes('authenticated = $false'),
        true,
        'falta authenticated en el snapshot operator_auth del gate'
    );
    assert.equal(
        raw.includes(
            '$report.operator_auth.error = [string]$operatorAuthResult.Error'
        ),
        true,
        'falta persistencia del error raw en operator_auth'
    );
    assert.equal(
        raw.includes('facade_http_status = 0'),
        true,
        'falta facade_http_status en el reporte operator_auth'
    );
    assert.equal(
        raw.includes("facade_error = ''"),
        true,
        'falta facade_error en el reporte operator_auth'
    );
    assert.equal(
        raw.includes('bridge_token_configured = $false'),
        true,
        'falta flag de bridge token en operator_auth'
    );
    assert.equal(
        raw.includes('allowlist_configured = $false'),
        true,
        'falta flag de allowlist en operator_auth'
    );
    assert.equal(
        raw.includes('missing = @()'),
        true,
        'falta lista de missing config en operator_auth'
    );
    assert.equal(
        raw.includes('if ($RequireOperatorAuth) {'),
        true,
        'falta endurecimiento opcional del gate para Operator Auth'
    );
    assert.equal(
        raw.includes('[OK]  operator auth Google web_broker configurado'),
        true,
        'falta feedback positivo del gate endurecido'
    );
    assert.equal(
        raw.includes(
            'admin-auth facade respondio, pero sigue en contrato legacy sin mode/status auth.'
        ),
        true,
        'falta warning cuando la fachada admin-auth responde en contrato legacy'
    );
    assert.equal(
        raw.includes(
            '[WARN] operator auth sin contrato auth valido. source=$($report.operator_auth.source)'
        ),
        true,
        'falta warning cuando RequireOperatorAuth detecta contrato invalido'
    );
});

test('admin rollout gate intenta resolver snapshot auth via fallback de la fachada admin-auth', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('function Test-OperatorAuthContractPayload {'),
        true,
        'falta helper para validar el contrato operator_auth'
    );
    assert.equal(
        raw.includes('function Set-OperatorAuthReportFromPayload {'),
        true,
        'falta helper para normalizar payloads operator_auth'
    );
    assert.equal(
        raw.includes(
            "Set-OperatorAuthReportFromPayload -Report $report.operator_auth -Payload $operatorAuthPayload -Source 'operator-auth-status'"
        ),
        true,
        'falta aplicar el payload primario de operator-auth-status al reporte'
    );
    assert.equal(
        raw.includes(
            '$facadeResult = Invoke-HttpCheck -Url $report.operator_auth.facade_url'
        ),
        true,
        'falta invocar la fachada admin-auth como fallback'
    );
    assert.equal(
        raw.includes(
            "Set-OperatorAuthReportFromPayload -Report $report.operator_auth -Payload $facadePayload -Source 'admin-auth-facade'"
        ),
        true,
        'falta capturar el contrato auth desde la fachada admin-auth'
    );
    assert.equal(
        raw.includes(
            "Set-OperatorAuthReportFromPayload -Report $report.operator_auth -Payload $facadePayload -Source 'admin-auth-facade-legacy'"
        ),
        true,
        'falta marcar la fachada admin-auth como legacy cuando no expone contrato auth'
    );
    assert.equal(
        raw.includes('[WARN] admin-auth facade no respondio correctamente'),
        true,
        'falta warning explicito cuando falla la fachada admin-auth'
    );
});

test('admin rollout gate persiste resultados suite por suite', () => {
    const raw = loadScript();

    assert.equal(
        raw.includes('$suiteResult = Invoke-PlaywrightSmokeSuite'),
        true,
        'falta ejecucion de suites runtime via helper reusable'
    );
    assert.equal(
        raw.includes('$report.runtime_smoke.suites += [ordered]@{'),
        true,
        'falta persistencia de resultado por suite'
    );
    assert.equal(
        raw.includes('exit_code = [int]$suiteResult.exit_code'),
        true,
        'falta exit_code por suite en el reporte'
    );
    assert.equal(
        raw.includes('specs = @($suiteResult.specs)'),
        true,
        'falta lista de specs por suite en el reporte'
    );
});

test('admin runtime no deja chunks huerfanos respecto a admin.js canonico', () => {
    ensureGeneratedRuntimePaths(
        [ADMIN_BUNDLE_PATH, ADMIN_CHUNKS_DIR],
        'admin runtime canonico'
    );
    const result = spawnSync(
        process.execPath,
        [CLEAN_ADMIN_CHUNKS_PATH, '--dry-run', '--strict'],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
        }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(
        result.stdout,
        /Se eliminarian \d+ chunk\(s\)/,
        'js/admin-chunks no debe conservar residuos fuera del grafo activo'
    );
});

test('admin.js apunta al unico chunk index canonico del runtime', () => {
    const adminBundle = loadFile(
        assertGeneratedRuntimePathExists(ADMIN_BUNDLE_PATH, 'admin.js')
    );
    const indexChunks = readdirSync(
        assertGeneratedRuntimePathExists(ADMIN_CHUNKS_DIR, 'js/admin-chunks/')
    ).filter((file) => /^index-[A-Za-z0-9_-]+\.js$/.test(file));

    assert.equal(
        indexChunks.length,
        1,
        `js/admin-chunks debe conservar un solo index activo, encontrados: ${indexChunks.join(', ')}`
    );
    assert.match(
        adminBundle,
        new RegExp(`js/admin-chunks/${escapeRegExp(indexChunks[0])}`),
        'admin.js debe importar el unico chunk index activo'
    );
});

test('bundle admin canonico no contiene marcadores de merge en assets activos', () => {
    const adminBundle = loadFile(
        assertGeneratedRuntimePathExists(ADMIN_BUNDLE_PATH, 'admin.js')
    );
    const referencedChunks = parseAdminChunkImports(adminBundle);

    assert.doesNotMatch(
        adminBundle,
        MERGE_CONFLICT_MARKER_PATTERN,
        'admin.js no debe contener marcadores de merge'
    );
    assert.notEqual(
        referencedChunks.length,
        0,
        'admin.js debe importar al menos un chunk activo'
    );

    for (const chunk of referencedChunks) {
        const chunkContent = loadFile(
            assertGeneratedRuntimePathExists(
                resolve(ADMIN_CHUNKS_DIR, chunk),
                `js/admin-chunks/${chunk}`
            )
        );
        assert.doesNotMatch(
            chunkContent,
            MERGE_CONFLICT_MARKER_PATTERN,
            `chunk activo no debe contener marcadores de merge: ${chunk}`
        );
    }
});
