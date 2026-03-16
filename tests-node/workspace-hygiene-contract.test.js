#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('fs');
const { execFileSync, spawnSync } = require('child_process');
const { resolve } = require('path');
const {
    buildDeployBundleManifest,
} = require('../bin/lib/deploy-bundle-contract.js');
const { GENERATED_SITE_ROOT } = require('../bin/lib/generated-site-root.js');

const REPO_ROOT = resolve(__dirname, '..');
let generatedRuntimePrepared = false;

function readRepoFile(relativePath) {
    return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8');
}

function isGeneratedRuntimeArtifact(relativePath) {
    const normalizedPath = String(relativePath || '')
        .trim()
        .replace(/\\/g, '/');
    return (
        normalizedPath === 'script.js' ||
        normalizedPath === 'admin.js' ||
        normalizedPath === 'js/booking-calendar.js' ||
        normalizedPath === 'js/queue-kiosk.js' ||
        normalizedPath === 'js/queue-display.js' ||
        normalizedPath.startsWith('js/chunks/') ||
        normalizedPath.startsWith('js/admin-chunks/') ||
        normalizedPath.startsWith('js/engines/')
    );
}

function ensureGeneratedRuntimeArtifact(relativePath) {
    const normalizedPath = String(relativePath || '')
        .trim()
        .replace(/\\/g, '/');
    const generatedPath = resolve(GENERATED_SITE_ROOT, normalizedPath);
    if (
        existsSync(generatedPath) ||
        !isGeneratedRuntimeArtifact(normalizedPath)
    ) {
        return generatedPath;
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

    return generatedPath;
}

function readRuntimeArtifact(relativePath) {
    const generatedPath = ensureGeneratedRuntimeArtifact(relativePath);
    if (existsSync(generatedPath)) {
        return readFileSync(generatedPath, 'utf8');
    }
    return readRepoFile(relativePath);
}

function listTrackedRepoPaths() {
    return execFileSync('git', ['ls-files', '-z'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    })
        .split('\0')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .sort();
}

function listTrackedRootFiles() {
    return listTrackedRepoPaths()
        .filter((entry) => !entry.includes('/'))
        .sort();
}

function listTrackedRootDirectories() {
    return Array.from(
        new Set(
            listTrackedRepoPaths()
                .filter((entry) => entry.includes('/'))
                .map((entry) => entry.split('/')[0])
        )
    ).sort();
}

test('gitignore incluye caches locales de PHP y cobertura', () => {
    const raw = readRepoFile('.gitignore');
    const requiredEntries = [
        '.php-cs-fixer.cache',
        '.phpunit.cache/',
        'coverage.xml',
        '.tmp-calendar-write-report.json',
        '.codex-public-paths.txt',
        'build_analysis.txt',
        'conflict_branches.txt',
        'stats.html',
        'styles.min.css',
        'styles.optimized.css',
        'styles-critical.min.css',
        'styles-deferred.min.css',
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

test('gitignore permite versionar el registry canonico de surfaces del turnero', () => {
    const raw = readRepoFile('.gitignore');

    assert.equal(
        raw.includes('!data/turnero-surfaces.json'),
        true,
        'falta exception en .gitignore: !data/turnero-surfaces.json'
    );

    const trackedPaths = listTrackedRepoPaths();
    assert.equal(
        trackedPaths.includes('data/turnero-surfaces.json'),
        true,
        'data/turnero-surfaces.json debe quedar versionado para builds CI/deploy'
    );
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
        'docs/LOCAL_SERVER.md',
        'docs/CONTRIBUTING.md',
        'docs/DEPLOYMENT.md',
        'docs/DEPLOY_HOSTING_PLAYBOOK.md',
        'docs/GITHUB_ACTIONS_DEPLOY.md',
        'docs/PRODUCTION_TEST_CHECKLIST.md',
        'docs/CALENDAR_CUTOVER.md',
        'docs/STABILITY_14_DAYS_PLAN.md',
        'docs/ROOT_SURFACES.md',
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

test('runbooks y deploy docs activos evitan mojibake comun', () => {
    const files = [
        'docs/RUNBOOKS.md',
        'docs/DEPLOY_HOSTING_PLAYBOOK.md',
        'DESPLIEGUE-PIELARMONIA.md',
        'SERVIDOR-LOCAL.md',
    ];
    const mojibakeMarkers = ['Ã', 'ðŸ', 'âš', 'ï¸'];

    for (const file of files) {
        const raw = readRepoFile(file);

        for (const marker of mojibakeMarkers) {
            assert.equal(
                raw.includes(marker),
                false,
                `${file} contiene mojibake: ${marker}`
            );
        }
    }

    const runbooks = readRepoFile('docs/RUNBOOKS.md');
    const deployGuide = readRepoFile('docs/DEPLOY_HOSTING_PLAYBOOK.md');

    assert.equal(
        runbooks.includes('npm run clean:local:artifacts'),
        true,
        'RUNBOOKS debe conservar la limpieza local canonica'
    );
    assert.equal(
        runbooks.includes('npm run benchmark:local'),
        true,
        'RUNBOOKS debe conservar benchmark:local'
    );
    assert.equal(
        deployGuide.includes('PIELARMONIA_EMAIL_FROM'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe conservar PIELARMONIA_EMAIL_FROM'
    );
    assert.equal(
        deployGuide.includes('FIGO_TELEGRAM_BOT_TOKEN'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe conservar FIGO_TELEGRAM_BOT_TOKEN'
    );
    assert.equal(
        deployGuide.includes('js/public-v6-shell.js'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe documentar la shell publica V6'
    );
    assert.equal(
        deployGuide.includes('js/admin-chunks/'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe documentar los chunks activos del admin'
    );
    assert.equal(
        deployGuide.includes('operador-turnos.html'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe documentar las superficies de turnero'
    );
    assert.equal(
        deployGuide.includes('- `index.html`'),
        false,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md no debe exigir index.html raiz como artefacto V6'
    );
});

test('docs operativas de raiz quedan como shims compatibles hacia docs canonicos', () => {
    const rootDeploy = readRepoFile('DESPLIEGUE-PIELARMONIA.md');
    const rootLocal = readRepoFile('SERVIDOR-LOCAL.md');
    const rootContributing = readRepoFile('CONTRIBUTING.md');
    const rootGitHubDeploy = readRepoFile('GITHUB-ACTIONS-DEPLOY.md');
    const rootProdChecklist = readRepoFile('CHECKLIST-PRUEBAS-PRODUCCION.md');
    const rootCalendarCutover = readRepoFile('CALENDAR-CUTOVER.md');
    const rootProductStatus = readRepoFile('ESTADO_PRODUCTO_OPERATIVO.md');
    const rootStabilityPlan = readRepoFile('PLAN_ESTABILIDAD_14DIAS.md');
    const rootSecurityAudit = readRepoFile('SECURITY_AUDIT.md');

    assert.equal(
        rootDeploy.includes('docs/DEPLOYMENT.md'),
        true,
        'DESPLIEGUE-PIELARMONIA.md debe apuntar a docs/DEPLOYMENT.md'
    );
    assert.equal(
        rootDeploy.includes('docs/DEPLOY_HOSTING_PLAYBOOK.md'),
        true,
        'DESPLIEGUE-PIELARMONIA.md debe apuntar a docs/DEPLOY_HOSTING_PLAYBOOK.md'
    );
    assert.equal(
        rootLocal.includes('docs/LOCAL_SERVER.md'),
        true,
        'SERVIDOR-LOCAL.md debe apuntar a docs/LOCAL_SERVER.md'
    );
    assert.equal(
        rootLocal.includes('docs/CONTRIBUTING.md'),
        true,
        'SERVIDOR-LOCAL.md debe apuntar a docs/CONTRIBUTING.md'
    );
    assert.equal(
        rootContributing.includes('docs/CONTRIBUTING.md'),
        true,
        'CONTRIBUTING.md debe apuntar a docs/CONTRIBUTING.md'
    );
    assert.equal(
        rootGitHubDeploy.includes('docs/GITHUB_ACTIONS_DEPLOY.md'),
        true,
        'GITHUB-ACTIONS-DEPLOY.md debe apuntar a docs/GITHUB_ACTIONS_DEPLOY.md'
    );
    assert.equal(
        rootProdChecklist.includes('docs/PRODUCTION_TEST_CHECKLIST.md'),
        true,
        'CHECKLIST-PRUEBAS-PRODUCCION.md debe apuntar a docs/PRODUCTION_TEST_CHECKLIST.md'
    );
    assert.equal(
        rootCalendarCutover.includes('docs/CALENDAR_CUTOVER.md'),
        true,
        'CALENDAR-CUTOVER.md debe apuntar a docs/CALENDAR_CUTOVER.md'
    );
    assert.equal(
        rootProductStatus.includes('docs/PRODUCT_OPERATIONAL_STATUS.md'),
        true,
        'ESTADO_PRODUCTO_OPERATIVO.md debe apuntar a docs/PRODUCT_OPERATIONAL_STATUS.md'
    );
    assert.equal(
        rootStabilityPlan.includes('docs/STABILITY_14_DAYS_PLAN.md'),
        true,
        'PLAN_ESTABILIDAD_14DIAS.md debe apuntar a docs/STABILITY_14_DAYS_PLAN.md'
    );
    assert.equal(
        rootSecurityAudit.includes('docs/SECURITY_AUDIT.md'),
        true,
        'SECURITY_AUDIT.md debe apuntar a docs/SECURITY_AUDIT.md'
    );
});

test('frontera de markdowns en raiz queda explicita y limitada', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const currentRootMarkdown = readdirSync(REPO_ROOT)
        .filter((entry) => entry.endsWith('.md'))
        .sort();
    const expectedRootMarkdown = [
        'AGENTS.md',
        'CALENDAR-CUTOVER.md',
        'CHECKLIST-PRUEBAS-PRODUCCION.md',
        'CLAUDE.md',
        'CONTRIBUTING.md',
        'DESPLIEGUE-PIELARMONIA.md',
        'DUAL_CODEX_RUNBOOK.md',
        'ESTADO_PRODUCTO_OPERATIVO.md',
        'GITHUB-ACTIONS-DEPLOY.md',
        'JULES_TASKS.md',
        'KIMI_TASKS.md',
        'PLAN_ESTABILIDAD_14DIAS.md',
        'PLAN_MAESTRO_2026_STATUS.md',
        'PLAN_MAESTRO_CODEX_2026.md',
        'PLAN_MAESTRO_OPERATIVO_2026.md',
        'README.md',
        'SECURITY_AUDIT.md',
        'SERVIDOR-LOCAL.md',
        'TRI_LANE_RUNTIME_RUNBOOK.md',
    ].sort();
    const requiredEntries = [
        'README.md',
        'AGENTS.md',
        'DUAL_CODEX_RUNBOOK.md',
        'TRI_LANE_RUNTIME_RUNBOOK.md',
        'PLAN_MAESTRO_CODEX_2026.md',
        'PLAN_MAESTRO_OPERATIVO_2026.md',
        'PLAN_MAESTRO_2026_STATUS.md',
        'CLAUDE.md',
        'JULES_TASKS.md',
        'KIMI_TASKS.md',
        'SERVIDOR-LOCAL.md',
        'docs/LOCAL_SERVER.md',
        'docs/archive/root-history/**',
        '.tmp-calendar-write-report.json',
        'build_analysis.txt',
        'conflict_branches.txt',
        'tests-node/workspace-hygiene-contract.test.js',
    ];

    assert.deepEqual(
        currentRootMarkdown,
        expectedRootMarkdown,
        'la raiz debe quedar limitada a markdowns canonicos, shims y tombstones aprobados'
    );

    for (const entry of requiredEntries) {
        assert.equal(
            rootSurfaces.includes(entry),
            true,
            `docs/ROOT_SURFACES.md debe documentar ${entry}`
        );
    }
});

test('frontera de js en raiz queda explicita y limitada', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const archiveIndex = readRepoFile('scripts/archive/README.md');
    const currentRootJs = readdirSync(REPO_ROOT)
        .filter((entry) => entry.endsWith('.js'))
        .sort();
    const expectedRootJs = [
        'agent-orchestrator.js',
        'eslint.config.js',
        'playwright.config.js',
        'sw.js',
    ].sort();

    assert.deepEqual(
        currentRootJs,
        expectedRootJs,
        'la raiz debe quedar limitada a runtime/tooling JS canonico aprobado'
    );

    for (const entry of [
        'sw.js',
        'agent-orchestrator.js',
        'eslint.config.js',
        'playwright.config.js',
        '.generated/site-root/script.js',
        '.generated/site-root/admin.js',
        '.generated/site-root/js/chunks/**',
        '.generated/site-root/js/admin-chunks/**',
        'scripts/archive/jules-dispatch.js',
        'scripts/archive/kimi-run.js',
        'js/archive/root-legacy/**',
    ]) {
        assert.equal(
            rootSurfaces.includes(entry),
            true,
            `docs/ROOT_SURFACES.md debe documentar ${entry}`
        );
    }

    for (const file of ['jules-dispatch.js', 'kimi-run.js']) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `tombstone ejecutable no debe seguir en raiz: ${file}`
        );
        assert.equal(
            existsSync(resolve(REPO_ROOT, 'scripts', 'archive', file)),
            true,
            `falta tombstone ejecutable archivado: ${file}`
        );
        assert.equal(
            archiveIndex.includes(file),
            true,
            `scripts/archive/README.md debe documentar ${file}`
        );
    }

    assert.equal(
        rootSurfaces.includes('`.generated/site-root/`'),
        true,
        'docs/ROOT_SURFACES.md debe distinguir el stage root generado de las copias legacy en raiz'
    );
    assert.doesNotMatch(
        rootSurfaces,
        /permanecen en raiz por contrato de hosting\/runtime/u,
        'docs/ROOT_SURFACES.md no debe seguir describiendo script.js/admin.js root como fuente primaria del contrato'
    );
});

test('frontera de html css php y ps1 en raiz queda explicita y limitada', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const currentRootHtml = readdirSync(REPO_ROOT)
        .filter((entry) => entry.endsWith('.html'))
        .sort();
    const currentRootCss = readdirSync(REPO_ROOT)
        .filter((entry) => entry.endsWith('.css'))
        .sort();
    const currentRootPhp = readdirSync(REPO_ROOT)
        .filter((entry) => entry.endsWith('.php'))
        .filter((entry) => entry !== 'env.php')
        .sort();
    const currentRootPs1 = readdirSync(REPO_ROOT)
        .filter((entry) => entry.endsWith('.ps1'))
        .sort();
    const expectedRootHtml = [
        'admin.html',
        'kiosco-turnos.html',
        'operador-turnos.html',
        'sala-turnos.html',
    ].sort();
    const expectedRootCss = [
        'admin-v3.css',
        'legal.css',
        'ops-design-system.css',
        'queue-display.css',
        'queue-kiosk.css',
        'queue-ops.css',
        'styles-astro.css',
        'styles-critical.css',
        'styles-deferred.css',
        'styles-telemedicina.css',
        'styles.css',
    ].sort();
    const expectedRootPhp = [
        '.php-cs-fixer.dist.php',
        'admin-auth.php',
        'api-lib.php',
        'api-router.php',
        'api.php',
        'backup-receiver.php',
        'check-ai-response.php',
        'cron.php',
        'env.example.php',
        'figo-ai-bridge.php',
        'figo-backend.php',
        'figo-brain.php',
        'figo-chat.php',
        'hosting-runtime.php',
        'index.php',
        'legacy.php',
        'payment-lib.php',
        'verify-backup.php',
    ].sort();
    const expectedRootPs1 = [
        'ADMIN-UI-CONTINGENCIA.ps1',
        'BENCH-API-PRODUCCION.ps1',
        'CONFIGURAR-BACKUP-OFFSITE.ps1',
        'CONFIGURAR-TELEGRAM-WEBHOOK.ps1',
        'GATE-ADMIN-ROLLOUT.ps1',
        'GATE-POSTDEPLOY.ps1',
        'MONITOR-PRODUCCION.ps1',
        'PREPARAR-PAQUETE-DESPLIEGUE.ps1',
        'REPORTE-SEMANAL-PRODUCCION.ps1',
        'SMOKE-PRODUCCION.ps1',
        'VERIFICAR-DESPLIEGUE.ps1',
    ].sort();

    assert.deepEqual(
        currentRootHtml,
        expectedRootHtml,
        'la raiz debe quedar limitada a shells HTML activos aprobados'
    );
    assert.deepEqual(
        currentRootCss,
        expectedRootCss,
        'la raiz debe quedar limitada a CSS activos aprobados'
    );
    assert.deepEqual(
        currentRootPhp,
        expectedRootPhp,
        'la raiz debe quedar limitada a PHP activos aprobados'
    );
    assert.deepEqual(
        currentRootPs1,
        expectedRootPs1,
        'la raiz debe quedar limitada a wrappers/runbooks PS1 aprobados'
    );

    for (const entry of [
        ...expectedRootHtml,
        ...expectedRootCss,
        ...expectedRootPhp,
        ...expectedRootPs1,
        'styles/archive/public-legacy/**',
        'docs/archive/root-history/stats.html',
    ]) {
        assert.equal(
            rootSurfaces.includes(entry),
            true,
            `docs/ROOT_SURFACES.md debe documentar ${entry}`
        );
    }
});

test('frontera de json yaml yml txt y toml en raiz queda explicita y limitada', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const readme = readRepoFile('README.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const trackedRootFiles = listTrackedRootFiles();
    const currentRootJson = trackedRootFiles
        .filter((entry) => entry.endsWith('.json'))
        .sort();
    const currentRootYaml = trackedRootFiles
        .filter((entry) => entry.endsWith('.yaml'))
        .sort();
    const currentRootYml = trackedRootFiles
        .filter((entry) => entry.endsWith('.yml'))
        .sort();
    const currentRootTxt = trackedRootFiles
        .filter((entry) => entry.endsWith('.txt'))
        .sort();
    const currentRootToml = trackedRootFiles
        .filter((entry) => entry.endsWith('.toml'))
        .sort();
    const expectedRootJson = [
        '.lighthouserc.json',
        'composer.json',
        'governance-policy.json',
        'lighthouserc.premium.json',
        'manifest.json',
        'package-lock.json',
        'package.json',
    ].sort();
    const expectedRootYaml = [
        'AGENT_BOARD.yaml',
        'AGENT_HANDOFFS.yaml',
        'AGENT_JOBS.yaml',
        'AGENT_SIGNALS.yaml',
    ].sort();
    const expectedRootYml = [
        'docker-compose.monitoring.yml',
        'docker-compose.yml',
        'prometheus.docker.yml',
        'prometheus.rules.yml',
        'prometheus.yml',
    ].sort();
    const expectedRootTxt = ['robots.txt'];

    assert.deepEqual(
        currentRootJson,
        expectedRootJson,
        'la raiz debe quedar limitada a JSON de control aprobados'
    );
    assert.deepEqual(
        currentRootYaml,
        expectedRootYaml,
        'la raiz debe quedar limitada a YAML canonicos aprobados'
    );
    assert.deepEqual(
        currentRootYml,
        expectedRootYml,
        'la raiz debe quedar limitada a YML de infraestructura aprobados'
    );
    assert.deepEqual(
        currentRootTxt,
        expectedRootTxt,
        'la raiz debe quedar limitada a TXT activos aprobados'
    );
    assert.deepEqual(
        currentRootToml,
        [],
        'no debe haber TOML activos en la raiz'
    );

    for (const entry of [
        ...expectedRootJson,
        ...expectedRootYaml,
        ...expectedRootYml,
        ...expectedRootTxt,
        'No hay `.toml` aprobados hoy en la raiz.',
        '.codex-public-paths.txt',
    ]) {
        assert.equal(
            rootSurfaces.includes(entry),
            true,
            `docs/ROOT_SURFACES.md debe documentar ${entry}`
        );
    }

    assert.equal(
        readme.includes('.json') &&
            readme.includes('.yaml') &&
            readme.includes('.txt'),
        true,
        'README.md debe documentar que docs/ROOT_SURFACES.md cubre tambien superficies de control'
    );
    assert.equal(
        operationsIndex.includes('superficies permitidas en raiz'),
        true,
        'OPERATIONS_INDEX debe tratar docs/ROOT_SURFACES.md como frontera general del front door'
    );
});

test('frontera de dotfiles y singletones especiales en raiz queda explicita y limitada', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const readme = readRepoFile('README.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const publicCanonicalSource = readRepoFile(
        'docs/public-v6-canonical-source.md'
    );
    const trackedRootFiles = listTrackedRootFiles();
    const currentRootDotfiles = trackedRootFiles
        .filter((entry) => entry.startsWith('.'))
        .sort();
    const expectedRootDotfiles = [
        '.editorconfig',
        '.gitattributes',
        '.gitignore',
        '.htaccess',
        '.lighthouserc.json',
        '.php-cs-fixer.dist.php',
        '.prettierignore',
        '.prettierrc',
    ].sort();
    const currentRootXml = trackedRootFiles.filter((entry) =>
        ['phpunit.xml', 'psalm.xml', 'sitemap.xml'].includes(entry)
    );
    const currentRootSpecialSingletons = trackedRootFiles.filter((entry) =>
        [
            'Dockerfile',
            'composer.lock',
            'rollup.config.mjs',
            'nginx-pielarmonia.conf',
            'favicon.ico',
        ].includes(entry)
    );

    assert.deepEqual(
        currentRootDotfiles,
        expectedRootDotfiles,
        'la raiz debe quedar limitada a dotfiles aprobados'
    );
    assert.deepEqual(
        currentRootXml.sort(),
        ['phpunit.xml', 'psalm.xml', 'sitemap.xml'].sort(),
        'la raiz debe quedar limitada a XML activos aprobados'
    );
    assert.deepEqual(
        currentRootSpecialSingletons.sort(),
        [
            'Dockerfile',
            'composer.lock',
            'rollup.config.mjs',
            'nginx-pielarmonia.conf',
            'favicon.ico',
        ].sort(),
        'la raiz debe quedar limitada a singletones especiales aprobados'
    );

    for (const entry of [
        ...expectedRootDotfiles,
        'phpunit.xml',
        'psalm.xml',
        'sitemap.xml',
        'Dockerfile',
        'composer.lock',
        'rollup.config.mjs',
        'nginx-pielarmonia.conf',
        'favicon.ico',
        'images/archive/root-legacy/**',
        'hero-woman.webp',
    ]) {
        assert.equal(
            rootSurfaces.includes(entry),
            true,
            `docs/ROOT_SURFACES.md debe documentar ${entry}`
        );
    }

    assert.equal(
        readme.includes('dotfiles') &&
            readme.includes('singletones especiales'),
        true,
        'README.md debe documentar que ROOT_SURFACES cubre tambien dotfiles y singletones especiales'
    );
    assert.equal(
        readme.includes('images/archive/root-legacy/**'),
        true,
        'README.md debe documentar el archivo root-legacy de imagenes'
    );
    assert.equal(
        operationsIndex.includes('dotfiles') &&
            operationsIndex.includes('singletones especiales'),
        true,
        'OPERATIONS_INDEX debe tratar docs/ROOT_SURFACES.md como frontera de dotfiles y singletones'
    );
    assert.equal(
        publicCanonicalSource.includes('favicon.ico'),
        true,
        'docs/public-v6-canonical-source.md debe documentar favicon.ico'
    );
    assert.equal(
        publicCanonicalSource.includes('sitemap.xml'),
        true,
        'docs/public-v6-canonical-source.md debe documentar sitemap.xml'
    );
});

test('frontera de directorios en raiz queda explicita y limitada', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const readme = readRepoFile('README.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const gitignore = readRepoFile('.gitignore');
    const trackedRootDirectories = listTrackedRootDirectories();
    const expectedTrackedRootDirectories = [
        '.claude',
        '.github',
        '.husky',
        '.vscode',
        'app-downloads',
        'bin',
        'components',
        'content',
        'controllers',
        'data',
        'desktop-updates',
        'docs',
        'fonts',
        'grafana',
        'images',
        'js',
        'k8s',
        'lib',
        'ops',
        'release',
        'scripts',
        'servicios',
        'src',
        'styles',
        'templates',
        'tests',
        'tests-node',
        'tools',
        'uploads',
        'vendor',
        'verification',
    ].sort();

    assert.deepEqual(
        trackedRootDirectories,
        expectedTrackedRootDirectories,
        'la raiz debe quedar limitada a directorios trackeados aprobados'
    );

    for (const entry of [
        ...expectedTrackedRootDirectories,
        '.git/',
        'node_modules/',
        '.phpunit.cache/',
        'data/',
        'test-results/',
        '%TEMP%/',
    ]) {
        assert.equal(
            rootSurfaces.includes(entry),
            true,
            `docs/ROOT_SURFACES.md debe documentar ${entry}`
        );
    }

    assert.equal(
        readme.includes('directorios permitidos en raiz'),
        true,
        'README.md debe documentar que ROOT_SURFACES cubre tambien directorios'
    );
    assert.equal(
        operationsIndex.includes('directorios que todavia permanecen en raiz'),
        true,
        'OPERATIONS_INDEX debe tratar docs/ROOT_SURFACES.md como frontera tambien de directorios'
    );
    assert.equal(
        gitignore.includes('%TEMP%/'),
        true,
        '.gitignore debe ignorar %TEMP%/ como scratch local'
    );

    for (const entry of ['_astro', 'en', 'es']) {
        assert.equal(
            trackedRootDirectories.includes(entry),
            false,
            `${entry} no debe seguir trackeado como directorio root canonico`
        );
        assert.equal(
            gitignore.includes(`${entry}/`),
            true,
            `.gitignore debe ignorar ${entry}/`
        );
    }
});

test('docs canonicos de ops preservan contratos clave del runtime actual', () => {
    const githubActionsDeploy = readRepoFile('docs/GITHUB_ACTIONS_DEPLOY.md');
    const productionChecklist = readRepoFile(
        'docs/PRODUCTION_TEST_CHECKLIST.md'
    );
    const calendarCutover = readRepoFile('docs/CALENDAR_CUTOVER.md');
    const productStatus = readRepoFile('docs/PRODUCT_OPERATIONAL_STATUS.md');
    const securityAudit = readRepoFile('docs/SECURITY_AUDIT.md');
    const stabilityPlan = readRepoFile('docs/STABILITY_14_DAYS_PLAN.md');

    assert.equal(
        githubActionsDeploy.includes('Deploy Hosting (Canary Pipeline)'),
        true,
        'docs/GITHUB_ACTIONS_DEPLOY.md debe documentar el workflow principal'
    );
    assert.equal(
        githubActionsDeploy.includes('js/public-v6-shell.js'),
        true,
        'docs/GITHUB_ACTIONS_DEPLOY.md debe documentar la shell publica V6'
    );

    assert.equal(
        productionChecklist.includes('js/public-v6-shell.js'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar la shell publica V6'
    );
    assert.equal(
        productionChecklist.includes('js/admin-chunks/'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar los chunks activos del admin'
    );
    assert.equal(
        productionChecklist.includes('script.js'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar script.js como runtime versionado del gateway publico'
    );
    assert.equal(
        productionChecklist.includes('js/chunks/'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar js/chunks/ como runtime versionado del gateway publico'
    );
    assert.equal(
        productionChecklist.includes('js/engines/'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar js/engines/ como runtime versionado del gateway publico'
    );
    assert.equal(
        productionChecklist.includes('styles.css'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar styles.css como soporte del gateway publico'
    );
    assert.equal(
        productionChecklist.includes('styles-deferred.css'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar styles-deferred.css como soporte del gateway publico'
    );
    assert.equal(
        productionChecklist.includes('https://TU_DOMINIO/es/'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar la shell publica ES'
    );
    assert.equal(
        productionChecklist.includes('https://TU_DOMINIO/en/'),
        true,
        'docs/PRODUCTION_TEST_CHECKLIST.md debe validar la shell publica EN'
    );
    assert.equal(
        productionChecklist.includes('- `index.html`'),
        false,
        'docs/PRODUCTION_TEST_CHECKLIST.md no debe exigir index.html raiz como artefacto V6'
    );

    assert.equal(
        calendarCutover.includes('PIELARMONIA_AVAILABILITY_SOURCE=google'),
        true,
        'docs/CALENDAR_CUTOVER.md debe fijar source=google para el corte'
    );
    assert.equal(
        calendarCutover.includes('REQUIRE_GOOGLE_CALENDAR=true'),
        true,
        'docs/CALENDAR_CUTOVER.md debe documentar REQUIRE_GOOGLE_CALENDAR=true'
    );

    assert.equal(
        productStatus.includes('gate:prod:fast'),
        true,
        'docs/PRODUCT_OPERATIONAL_STATUS.md debe usar gate:prod:fast como fuente'
    );
    assert.equal(
        productStatus.includes('calendarSource=google'),
        true,
        'docs/PRODUCT_OPERATIONAL_STATUS.md debe reflejar agenda real en Google'
    );

    assert.equal(
        securityAudit.includes('Cross-Site Scripting (XSS)'),
        true,
        'docs/SECURITY_AUDIT.md debe conservar el baseline XSS'
    );
    assert.equal(
        securityAudit.includes('Cross-Site Request Forgery (CSRF)'),
        true,
        'docs/SECURITY_AUDIT.md debe conservar el baseline CSRF'
    );

    assert.equal(
        stabilityPlan.includes('nightly-stability.yml'),
        true,
        'docs/STABILITY_14_DAYS_PLAN.md debe documentar la nightly'
    );
    assert.equal(
        stabilityPlan.includes('gate:prod:fast'),
        true,
        'docs/STABILITY_14_DAYS_PLAN.md debe conservar el fast lane'
    );
});

test('operations index agrupa comandos canonicos de web, admin, prod y gobernanza', () => {
    const raw = readRepoFile('docs/OPERATIONS_INDEX.md');
    const requiredEntries = [
        'npm run build:public:v6',
        'npm run check:public:runtime:artifacts',
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
        'PLAN_MAESTRO_ESTRATEGICO.md',
        'PLAN_OPTIMIZACION.md',
        'CONSOLIDADO_ESTADO_ACTUAL.md',
        'TEST_COVERAGE_REPORT.md',
        'CHANGELOG.md',
        'ISSUES.md',
    ];
    const rootHistoricalArtifacts = [
        '.tmp-calendar-write-report.json',
        'build_analysis.txt',
        'conflict_branches.txt',
        'stats.html',
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

    for (const file of rootHistoricalArtifacts) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `residuo generado no debe seguir en raiz: ${file}`
        );
        assert.equal(
            existsSync(
                resolve(REPO_ROOT, 'docs', 'archive', 'root-history', file)
            ),
            true,
            `falta residuo generado archivado: ${file}`
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
        historyIndex.includes('.tmp-calendar-write-report.json'),
        true,
        'docs/archive/root-history/README.md debe documentar .tmp-calendar-write-report.json'
    );
    assert.equal(
        historyIndex.includes('build_analysis.txt'),
        true,
        'docs/archive/root-history/README.md debe documentar build_analysis.txt'
    );
    assert.equal(
        historyIndex.includes('conflict_branches.txt'),
        true,
        'docs/archive/root-history/README.md debe documentar conflict_branches.txt'
    );
    assert.equal(
        historyIndex.includes('stats.html'),
        true,
        'docs/archive/root-history/README.md debe documentar stats.html'
    );
    assert.equal(
        scriptsIndex.includes('No forman parte del carril diario recomendado.'),
        true,
        'falta aclaracion de scripts legacy en scripts/archive/README.md'
    );
});

test('media legacy de raiz sale del front door y queda archivada fuera del runtime activo', () => {
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const archiveReadme = readRepoFile('images/archive/root-legacy/README.md');

    assert.equal(
        existsSync(resolve(REPO_ROOT, 'hero-woman.webp')),
        false,
        'hero-woman.webp no debe seguir en la raiz activa'
    );
    assert.equal(
        existsSync(
            resolve(
                REPO_ROOT,
                'images',
                'archive',
                'root-legacy',
                'hero-woman.webp'
            )
        ),
        true,
        'falta hero-woman.webp archivado'
    );
    assert.equal(
        archiveReadme.includes(
            'No son parte del gateway publico V6 ni del shell admin.'
        ),
        true,
        'images/archive/root-legacy/README.md debe aclarar que el archivo es historico'
    );
    assert.equal(
        rootSurfaces.includes('images/archive/root-legacy/**'),
        true,
        'docs/ROOT_SURFACES.md debe documentar el archivo root-legacy de imagenes'
    );
});

test('legacy public css sale de la raiz activa y queda archivado fuera del front door', () => {
    const legacyPublicCss = [
        'styles.min.css',
        'styles.optimized.css',
        'styles-critical.min.css',
        'styles-deferred.min.css',
    ];
    const archiveReadme = readRepoFile(
        'styles/archive/public-legacy/README.md'
    );

    for (const file of legacyPublicCss) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `css publico legacy no debe seguir en raiz: ${file}`
        );
        assert.equal(
            existsSync(
                resolve(REPO_ROOT, 'styles', 'archive', 'public-legacy', file)
            ),
            true,
            `falta css publico legacy archivado: ${file}`
        );
    }

    assert.equal(
        archiveReadme.includes(
            'No forman parte del runtime publico ni admin activo.'
        ),
        true,
        'styles/archive/public-legacy/README.md debe aclarar que el archivo es historico'
    );
    assert.equal(
        archiveReadme.includes('styles.css'),
        true,
        'styles/archive/public-legacy/README.md debe documentar el runtime CSS canonico'
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

test('runtime publico y bundle de deploy consumen docs canonicos, no shims markdown de raiz', () => {
    const chatEngine = readRepoFile('src/apps/chat/engine.js');
    const chatShell = readRepoFile('src/apps/chat/shell.js');
    const scriptBundle = readRuntimeArtifact('script.js');
    const deployBundlePaths = buildDeployBundleManifest({
        includeTooling: true,
    }).map((entry) => entry.relativePath);
    const deployReadme = readRepoFile('scripts/ops/deploy/README.md');
    const publicCanonicalSource = readRepoFile(
        'docs/public-v6-canonical-source.md'
    );
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const shellChunks = Array.from(
        new Set(
            Array.from(
                scriptBundle.matchAll(/\.\/js\/chunks\/(shell-[^"']+\.js)/g),
                ([, chunk]) => chunk
            )
        )
    );

    assert.equal(
        chatEngine.includes('docs/LOCAL_SERVER.md'),
        true,
        'src/apps/chat/engine.js debe apuntar a docs/LOCAL_SERVER.md'
    );
    assert.equal(
        chatEngine.includes('SERVIDOR-LOCAL.md'),
        false,
        'src/apps/chat/engine.js no debe depender del shim SERVIDOR-LOCAL.md'
    );
    assert.equal(
        chatShell.includes('docs/LOCAL_SERVER.md'),
        true,
        'src/apps/chat/shell.js debe apuntar a docs/LOCAL_SERVER.md'
    );
    assert.equal(
        chatShell.includes('SERVIDOR-LOCAL.md'),
        false,
        'src/apps/chat/shell.js no debe depender del shim SERVIDOR-LOCAL.md'
    );

    assert.equal(
        shellChunks.length > 0,
        true,
        'script.js debe seguir referenciando al menos un shell chunk activo'
    );

    for (const chunk of shellChunks) {
        const raw = readRuntimeArtifact(`js/chunks/${chunk}`);
        assert.equal(
            raw.includes('docs/LOCAL_SERVER.md'),
            true,
            `${chunk} debe apuntar a docs/LOCAL_SERVER.md`
        );
        assert.equal(
            raw.includes('SERVIDOR-LOCAL.md'),
            false,
            `${chunk} no debe depender del shim SERVIDOR-LOCAL.md`
        );
    }

    const requiredDeployDocs = [
        "'docs/DEPLOYMENT.md'",
        "'docs/DEPLOY_HOSTING_PLAYBOOK.md'",
        "'docs/PRODUCTION_TEST_CHECKLIST.md'",
    ];
    for (const entry of requiredDeployDocs) {
        assert.equal(
            deployBundlePaths.includes(entry.replace(/'/g, '')),
            true,
            `bundle de deploy debe incluir ${entry}`
        );
    }

    for (const entry of [
        "'styles.css'",
        "'styles-deferred.css'",
        "'script.js'",
        "'js/chunks'",
        "'js/engines'",
    ]) {
        assert.equal(
            deployBundlePaths.includes(entry.replace(/'/g, '')),
            true,
            `bundle de deploy debe incluir ${entry} para el runtime publico`
        );
    }

    const forbiddenLegacyRootEngines = [
        "'app-bootstrap-engine.js'",
        "'analytics-engine.js'",
        "'chat-engine.js'",
        "'theme-engine.js'",
        "'data-engine.js'",
        "'ui-bridge-engine.js'",
    ];
    for (const entry of forbiddenLegacyRootEngines) {
        assert.equal(
            deployBundlePaths.includes(entry.replace(/'/g, '')),
            false,
            `bundle de deploy no debe seguir dependiendo del root legacy ${entry}`
        );
    }

    const forbiddenRootShims = [
        "'DESPLIEGUE-PIELARMONIA.md'",
        "'CHECKLIST-PRUEBAS-PRODUCCION.md'",
    ];
    for (const entry of forbiddenRootShims) {
        assert.equal(
            deployBundlePaths.includes(entry.replace(/'/g, '')),
            false,
            `bundle de deploy no debe depender del shim ${entry}`
        );
    }

    assert.equal(
        deployReadme.includes('docs/DEPLOYMENT.md'),
        true,
        'scripts/ops/deploy/README.md debe documentar docs/DEPLOYMENT.md'
    );
    assert.equal(
        deployReadme.includes('docs/DEPLOY_HOSTING_PLAYBOOK.md'),
        true,
        'scripts/ops/deploy/README.md debe documentar docs/DEPLOY_HOSTING_PLAYBOOK.md'
    );
    assert.equal(
        deployReadme.includes('docs/PRODUCTION_TEST_CHECKLIST.md'),
        true,
        'scripts/ops/deploy/README.md debe documentar docs/PRODUCTION_TEST_CHECKLIST.md'
    );
    assert.equal(
        deployReadme.includes('script.js'),
        true,
        'scripts/ops/deploy/README.md debe documentar script.js como runtime publico versionado'
    );
    assert.equal(
        deployReadme.includes('styles.css'),
        true,
        'scripts/ops/deploy/README.md debe documentar styles.css como soporte del gateway publico'
    );
    assert.equal(
        deployReadme.includes('styles-deferred.css'),
        true,
        'scripts/ops/deploy/README.md debe documentar styles-deferred.css como soporte del gateway publico'
    );
    assert.equal(
        deployReadme.includes('js/chunks/**'),
        true,
        'scripts/ops/deploy/README.md debe documentar js/chunks/** como runtime publico versionado'
    );
    assert.equal(
        deployReadme.includes('js/engines/**'),
        true,
        'scripts/ops/deploy/README.md debe documentar js/engines/** como runtime publico versionado'
    );
    for (const snippet of [
        'check:public:runtime:artifacts',
        'styles.css',
        'styles-deferred.css',
        'script.js',
        'js/chunks/**',
        'js/engines/**',
        'runtime-artifacts-report.json',
    ]) {
        assert.equal(
            publicCanonicalSource.includes(snippet),
            true,
            `docs/public-v6-canonical-source.md debe documentar ${snippet}`
        );
    }
    assert.equal(
        rootSurfaces.includes(
            'Los shims de raiz existen solo para compatibilidad humana; runtime, tooling'
        ),
        true,
        'docs/ROOT_SURFACES.md debe fijar que runtime y tooling no dependan de shims de raiz'
    );
});

test('gate postdeploy canonico invoca siblings de prod sin reentrar por wrappers root', () => {
    const raw = readRepoFile('scripts/ops/prod/GATE-POSTDEPLOY.ps1');
    const requiredEntries = [
        "$verifyScriptPath = Join-Path $PSScriptRoot 'VERIFICAR-DESPLIEGUE.ps1'",
        "$smokeScriptPath = Join-Path $PSScriptRoot 'SMOKE-PRODUCCION.ps1'",
        "$benchScriptPath = Join-Path $PSScriptRoot 'BENCH-API-PRODUCCION.ps1'",
        '& $verifyScriptPath',
        '& $smokeScriptPath',
        '& $benchScriptPath',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `GATE-POSTDEPLOY canonico debe incluir ${entry}`
        );
    }

    for (const legacyEntry of [
        '& .\\VERIFICAR-DESPLIEGUE.ps1',
        '& .\\SMOKE-PRODUCCION.ps1',
        '& .\\BENCH-API-PRODUCCION.ps1',
    ]) {
        assert.equal(
            raw.includes(legacyEntry),
            false,
            `GATE-POSTDEPLOY no debe depender de wrapper/root path legacy: ${legacyEntry}`
        );
    }
});

test('runtime publico y verificacion prod no aceptan residuos JS legacy de raiz', () => {
    const publicCanonicalSource = readRepoFile(
        'docs/public-v6-canonical-source.md'
    );
    const rootSurfaces = readRepoFile('docs/ROOT_SURFACES.md');
    const prodOpsReadme = readRepoFile('scripts/ops/prod/README.md');
    const archiveReadme = readRepoFile('js/archive/root-legacy/README.md');
    const commonHttp = readRepoFile('bin/powershell/Common.Http.ps1');
    const smokeProd = readRepoFile('scripts/ops/prod/SMOKE-PRODUCCION.ps1');
    const verifyDeploy = readRepoFile(
        'scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1'
    );
    const legacyEngineFiles = [
        'chat-widget-engine.js',
        'chat-engine.js',
        'chat-ui-engine.js',
        'booking-engine.js',
        'ui-effects.js',
        'gallery-interactions.js',
        'booking-ui.js',
        'chat-booking-engine.js',
        'success-modal-engine.js',
        'engagement-forms-engine.js',
        'modal-ux-engine.js',
        'reschedule-engine.js',
    ];

    for (const file of ['booking-engine.js', 'utils.js']) {
        assert.equal(
            existsSync(resolve(REPO_ROOT, file)),
            false,
            `residuo JS legacy no debe seguir en raiz: ${file}`
        );
        assert.equal(
            existsSync(
                resolve(REPO_ROOT, 'js', 'archive', 'root-legacy', file)
            ),
            true,
            `falta residuo JS legacy archivado: ${file}`
        );
    }

    for (const snippet of [
        'js/archive/root-legacy/**',
        'booking-engine.js',
        'utils.js',
    ]) {
        assert.equal(
            publicCanonicalSource.includes(snippet),
            true,
            `docs/public-v6-canonical-source.md debe documentar ${snippet}`
        );
    }

    assert.equal(
        rootSurfaces.includes('js/archive/root-legacy/**'),
        true,
        'docs/ROOT_SURFACES.md debe fijar el archivo JS root-legacy'
    );
    assert.equal(
        prodOpsReadme.includes('js/engines/**'),
        true,
        'scripts/ops/prod/README.md debe fijar js/engines/** como origen canonico'
    );
    assert.equal(
        archiveReadme.includes('not part of the active public runtime'),
        true,
        'js/archive/root-legacy/README.md debe aclarar que el archivo es historico'
    );

    for (const file of legacyEngineFiles) {
        if (file !== 'reschedule-engine.js') {
            assert.equal(
                commonHttp.includes(`@('${file}', 'js/engines/${file}')`),
                false,
                `Common.Http no debe tolerar fallback root para ${file}`
            );
        }
        assert.equal(
            commonHttp.includes(`LocalCandidates = @('${file}')`),
            false,
            `Common.Http no debe tolerar candidato local root para ${file}`
        );
        assert.equal(
            verifyDeploy.includes(`LocalCandidates = @('${file}')`),
            false,
            `VERIFICAR-DESPLIEGUE no debe tolerar candidato local root para ${file}`
        );
        assert.equal(
            smokeProd.includes(
                `(Test-Path '${file}') -or (Test-Path 'js/engines/${file}')`
            ),
            false,
            `SMOKE-PRODUCCION no debe tolerar fallback root para ${file}`
        );
    }

    assert.equal(
        commonHttp.includes("Test-Path 'reschedule-engine.js'"),
        false,
        'Common.Http no debe seguir chequeando reschedule-engine.js en raiz'
    );
    assert.equal(
        verifyDeploy.includes("Test-Path 'reschedule-engine.js'"),
        false,
        'VERIFICAR-DESPLIEGUE no debe seguir chequeando reschedule-engine.js en raiz'
    );
});

test('verify deploy soporta layout publico v6 y rutas locales canonicas', () => {
    const raw = readRepoFile('scripts/ops/prod/VERIFICAR-DESPLIEGUE.ps1');
    const requiredEntries = [
        "Join-Path $repoRoot '.generated/site-root'",
        "Join-Path $generatedSiteRoot 'es/index.html'",
        "Join-Path $generatedSiteRoot 'en/index.html'",
        "Join-Path $generatedSiteRoot 'script.js'",
        "Join-Path $PSScriptRoot 'SMOKE-PRODUCCION.ps1'",
        'public-v6-shell\\.js',
        '_astro/[^"]+\\.css',
        'Get-Content -Path $localIndexPath -Raw',
        '& $smokeScriptPath -Domain $base',
    ];

    for (const entry of requiredEntries) {
        assert.equal(
            raw.includes(entry),
            true,
            `VERIFICAR-DESPLIEGUE debe incluir ${entry}`
        );
    }

    assert.equal(
        raw.includes("Get-Content -Path 'index.html' -Raw"),
        false,
        'VERIFICAR-DESPLIEGUE no debe depender solo de index.html en raiz'
    );
    assert.equal(
        raw.includes("LocalPath = 'script.js'"),
        false,
        'VERIFICAR-DESPLIEGUE no debe hashear script.js desde root como fuente primaria'
    );
    assert.equal(
        raw.includes('& .\\SMOKE-PRODUCCION.ps1'),
        false,
        'VERIFICAR-DESPLIEGUE no debe reentrar a SMOKE-PRODUCCION por wrapper root'
    );
});

test('verify gate soporta shell publico V6 y assets stageados sin depender del root legacy', () => {
    const raw = readRepoFile('bin/verify-gate.php');

    for (const entry of [
        ".generated' . DIRECTORY_SEPARATOR . 'site-root'",
        'function detect_local_asset_candidates',
        'public-v6-shell\\.js',
        '_astro\\/.+\\.css',
        'Asset Hash: ',
        'detect_local_asset_candidates($scriptRef)',
        'detect_local_asset_candidates($styleRef)',
    ]) {
        assert.equal(
            raw.includes(entry),
            true,
            `bin/verify-gate.php debe incluir ${entry}`
        );
    }

    assert.equal(
        raw.includes("file_exists('script.js')"),
        false,
        'bin/verify-gate.php no debe depender solo de script.js en raiz'
    );
    assert.equal(
        raw.includes("file_exists('styles.css')"),
        false,
        'bin/verify-gate.php no debe depender solo de styles.css en raiz'
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

    const deployBundleContract = readRepoFile(
        'bin/lib/deploy-bundle-contract.js'
    );
    const deployDoc = readRepoFile('docs/DEPLOY_HOSTING_PLAYBOOK.md');

    assert.equal(
        deployBundleContract.includes("'admin-v3.css'"),
        true,
        'bundle de deploy debe incluir admin-v3.css'
    );
    assert.equal(
        deployBundleContract.includes("'queue-ops.css'"),
        true,
        'bundle de deploy debe incluir queue-ops.css'
    );
    assert.equal(
        deployBundleContract.includes("'admin.css'"),
        false,
        'bundle de deploy no debe incluir admin.css legacy'
    );
    assert.equal(
        deployDoc.includes('- `admin-v3.css`'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe listar admin-v3.css'
    );
    assert.equal(
        deployDoc.includes('- `queue-ops.css`'),
        true,
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe listar queue-ops.css'
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
    const serverLocal = readRepoFile('docs/LOCAL_SERVER.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const pentestP0 = readRepoFile('tests/pentest_p0.php');
    const penetration = readRepoFile('tests/penetration_test.php');
    const localStageRouterCommand =
        'php -S 127.0.0.1:8011 -t . bin/local-stage-router.php';

    assert.equal(
        readme.includes(localStageRouterCommand),
        true,
        'README.md debe usar 127.0.0.1:8011 como setup local canonico'
    );
    assert.equal(
        readme.includes('http://127.0.0.1:8011/admin.html'),
        true,
        'README.md debe apuntar el admin al host local canonico'
    );
    assert.equal(
        readme.includes('http://127.0.0.1:8011/es/'),
        true,
        'README.md debe documentar la shell publica ES'
    );
    assert.equal(
        readme.includes('http://127.0.0.1:8011/en/'),
        true,
        'README.md debe documentar la shell publica EN'
    );
    assert.equal(
        readme.includes('TEST_LOCAL_SERVER_PORT'),
        true,
        'README.md debe documentar TEST_LOCAL_SERVER_PORT'
    );
    assert.equal(
        serverLocal.includes(localStageRouterCommand),
        true,
        'docs/LOCAL_SERVER.md debe usar 127.0.0.1:8011 como arranque canonico'
    );
    assert.equal(
        serverLocal.includes('TEST_BASE_URL'),
        true,
        'docs/LOCAL_SERVER.md debe documentar TEST_BASE_URL'
    );
    assert.equal(
        serverLocal.includes('http://127.0.0.1:8011/es/'),
        true,
        'docs/LOCAL_SERVER.md debe apuntar a la shell publica ES'
    );
    assert.equal(
        serverLocal.includes('http://127.0.0.1:8011/en/'),
        true,
        'docs/LOCAL_SERVER.md debe apuntar a la shell publica EN'
    );
    assert.doesNotMatch(
        serverLocal,
        /-\s+Sitio:\s*`http:\/\/127\.0\.0\.1:8011\/index\.html`/,
        'docs/LOCAL_SERVER.md no debe presentar /index.html como entrypoint local'
    );
    assert.equal(
        serverLocal.includes('no es la entrada canonica'),
        true,
        'docs/LOCAL_SERVER.md debe aclarar que /index.html no es la entrada local canonica'
    );
    assert.equal(
        operationsIndex.includes('http://127.0.0.1:8011'),
        true,
        'OPERATIONS_INDEX debe fijar el host local canonico'
    );
    assert.equal(
        operationsIndex.includes('/es/'),
        true,
        'OPERATIONS_INDEX debe aclarar la shell publica ES'
    );
    assert.equal(
        pentestP0.includes(
            "getenv('TEST_BASE_URL') ?: 'http://127.0.0.1:8011'"
        ),
        true,
        'tests/pentest_p0.php debe usar TEST_BASE_URL o el host local canonico'
    );
    assert.doesNotMatch(
        pentestP0,
        /admin123/,
        'tests/pentest_p0.php no debe depender de admin123'
    );
    assert.equal(
        pentestP0.includes('PIELARMONIA_ADMIN_PASSWORD no definido'),
        true,
        'tests/pentest_p0.php debe saltar CSRF si falta la password admin'
    );
    assert.equal(
        penetration.includes(
            "getenv('TEST_BASE_URL') ?: 'http://127.0.0.1:8011'"
        ),
        true,
        'tests/penetration_test.php debe usar TEST_BASE_URL o el host local canonico'
    );
    assert.doesNotMatch(
        penetration,
        /admin123/,
        'tests/penetration_test.php no debe depender de admin123'
    );
    assert.equal(
        penetration.includes('PIELARMONIA_ADMIN_PASSWORD no definido'),
        true,
        'tests/penetration_test.php debe saltar CSRF si falta la password admin'
    );

    assert.doesNotMatch(
        readme,
        /127\.0\.0\.1:8000|localhost:8000/,
        'README.md no debe seguir apuntando a 8000'
    );
    assert.doesNotMatch(
        readme,
        /admin123/,
        'README.md no debe seguir sugiriendo admin123'
    );
    assert.doesNotMatch(
        serverLocal,
        /127\.0\.0\.1:8000|localhost:8000/,
        'docs/LOCAL_SERVER.md no debe seguir apuntando a 8000'
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
    const localStageRouterCommand =
        'php -S 127.0.0.1:8011 -t . bin/local-stage-router.php';

    assert.equal(
        contributing.includes(localStageRouterCommand),
        true,
        'CONTRIBUTING debe fijar 127.0.0.1:8011 como setup local'
    );
    assert.equal(
        contributing.includes('TEST_BASE_URL'),
        true,
        'CONTRIBUTING debe documentar TEST_BASE_URL'
    );
    assert.equal(
        disasterRecovery.includes(localStageRouterCommand),
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
        deployment.includes('.generated/site-root/'),
        true,
        'DEPLOYMENT debe documentar el stage root canonico'
    );
    assert.equal(
        deployment.includes('_deploy_bundle/'),
        true,
        'DEPLOYMENT debe documentar el bundle canonico de deploy'
    );
    assert.doesNotMatch(
        deployment,
        /artefactos generados comprometidos en `main`|artifacts generated committed in main/u,
        'DEPLOYMENT no debe volver al contrato legacy de artifacts generados comprometidos en main'
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

test('local-stage-router prioriza el stage root para outputs generados y deja fallback al repo para authored assets', () => {
    const router = readRepoFile('bin/local-stage-router.php');

    for (const snippet of [
        "'.generated' . DIRECTORY_SEPARATOR . 'site-root'",
        'function resolveStageCandidate',
        'function isGeneratedStagePath',
        "'es'",
        "'en'",
        "'_astro'",
        "'script.js'",
        "'admin.js'",
        "'js/chunks'",
        "'js/engines'",
        "'js/admin-chunks'",
        "'js/booking-calendar.js'",
        "'js/queue-kiosk.js'",
        "'js/queue-display.js'",
        'if ($stageCandidate !== false && isGeneratedStagePath($normalizedPath))',
    ]) {
        assert.equal(
            router.includes(snippet),
            true,
            `bin/local-stage-router.php debe priorizar el stage generado: ${snippet}`
        );
    }

    assert.equal(
        router.includes(
            '$repoCandidate = realpath($repoRoot . DIRECTORY_SEPARATOR . $normalizedPath);'
        ),
        true,
        'bin/local-stage-router.php debe conservar fallback al repo para assets authored'
    );
});

test('tooling local de performance usa el host canonico y expone benchmark reutilizable', () => {
    const readme = readRepoFile('README.md');
    const serverLocal = readRepoFile('docs/LOCAL_SERVER.md');
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
        'docs/LOCAL_SERVER.md debe exponer npm run benchmark:local'
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
        'bin/local-stage-router.php',
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
    const deployGuide = readRepoFile('docs/DEPLOY_HOSTING_PLAYBOOK.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const localStageRouterCommand =
        '"php -S 127.0.0.1:8011 -t . bin/local-stage-router.php"';

    assert.equal(
        defaultLhci.includes(localStageRouterCommand),
        true,
        '.lighthouserc.json debe usar 127.0.0.1:8011 como host local canonico'
    );
    assert.equal(
        premiumLhci.includes(localStageRouterCommand),
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
        'bin/local-stage-router.php',
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
        'docs/DEPLOY_HOSTING_PLAYBOOK.md debe aclarar que 8080 corresponde solo al stack Docker'
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

test('artefactos locales efimeros salen del repo activo y tienen limpieza canonica', () => {
    const gitignore = readRepoFile('.gitignore');
    const packageJson = readRepoFile('package.json');
    const readme = readRepoFile('README.md');
    const operationsIndex = readRepoFile('docs/OPERATIONS_INDEX.md');
    const runbooks = readRepoFile('docs/RUNBOOKS.md');
    const cleaner = readRepoFile('bin/clean-local-artifacts.js');

    assert.equal(
        existsSync(resolve(REPO_ROOT, 'cookies.txt')),
        false,
        'cookies.txt no debe seguir versionado en la raiz activa'
    );
    assert.equal(
        gitignore.includes('cookies.txt'),
        true,
        '.gitignore debe ignorar cookies.txt'
    );
    for (const entry of [
        'playwright-report/',
        'test-results/',
        'php_server.log',
        '.php-cs-fixer.cache',
        '.phpunit.cache/',
        'coverage.xml',
        '.tmp-calendar-write-report.json',
        '.codex-public-paths.txt',
        'build_analysis.txt',
        'conflict_branches.txt',
        'stats.html',
        'styles.min.css',
        'styles.optimized.css',
        'styles-critical.min.css',
        'styles-deferred.min.css',
    ]) {
        assert.equal(
            gitignore.includes(entry),
            true,
            `.gitignore debe ignorar ${entry}`
        );
    }

    for (const snippet of [
        '"check:local:artifacts": "node bin/clean-local-artifacts.js --dry-run"',
        '"clean:local:artifacts": "node bin/clean-local-artifacts.js"',
        '"workspace:hygiene:doctor": "node bin/workspace-hygiene.js doctor --all-worktrees"',
    ]) {
        assert.equal(
            packageJson.includes(snippet),
            true,
            `package.json debe exponer ${snippet}`
        );
    }

    for (const snippet of [
        'cookies.txt',
        '.lighthouseci',
        'lhci_reports',
        '_deploy_bundle',
        'playwright-report',
        'test-results',
        'php_server.log',
        '.php-cs-fixer.cache',
        '.phpunit.cache',
        'coverage.xml',
        '.tmp-calendar-write-report.json',
        '.codex-public-paths.txt',
        'build_analysis.txt',
        'conflict_branches.txt',
        'stats.html',
        'styles.min.css',
        'styles.optimized.css',
        'styles-critical.min.css',
        'styles-deferred.min.css',
        'DRY RUN',
    ]) {
        assert.equal(
            cleaner.includes(snippet),
            true,
            `clean-local-artifacts debe incluir ${snippet}`
        );
    }

    assert.equal(
        readme.includes('npm run workspace:hygiene:doctor'),
        true,
        'README.md debe documentar el doctor canonico de workspace hygiene'
    );
    assert.equal(
        readme.includes('npm run check:local:artifacts'),
        true,
        'README.md debe documentar el dry-run de limpieza local'
    );
    assert.equal(
        readme.includes('npm run clean:local:artifacts'),
        true,
        'README.md debe documentar la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('npm run workspace:hygiene:doctor'),
        true,
        'OPERATIONS_INDEX debe documentar el doctor canonico de workspace hygiene'
    );
    assert.equal(
        operationsIndex.includes('npm run check:local:artifacts'),
        true,
        'OPERATIONS_INDEX debe documentar el dry-run de limpieza local'
    );
    assert.equal(
        operationsIndex.includes('npm run clean:local:artifacts'),
        true,
        'OPERATIONS_INDEX debe documentar la limpieza local'
    );
    assert.equal(
        readme.includes('overall_state'),
        true,
        'README.md debe documentar el contrato V3 del doctor'
    );
    assert.equal(
        readme.includes('issues[]'),
        true,
        'README.md debe documentar la agregacion por issues del doctor'
    );
    assert.equal(
        readme.includes('remediation_plan[]'),
        true,
        'README.md debe documentar el plan de remediacion del doctor'
    );
    assert.equal(
        readme.includes('--include-entries'),
        true,
        'README.md debe documentar el modo expandido del doctor'
    );
    assert.equal(
        readme.includes('legacy_generated_root_deindexed'),
        true,
        'README.md debe documentar el bloqueo por deindexado legacy pendiente'
    );
    assert.equal(
        operationsIndex.includes('overall_state'),
        true,
        'OPERATIONS_INDEX debe documentar el contrato V3 del doctor'
    );
    assert.equal(
        operationsIndex.includes('issues[]'),
        true,
        'OPERATIONS_INDEX debe documentar la agregacion por issues del doctor'
    );
    assert.equal(
        operationsIndex.includes('remediation_plan[]'),
        true,
        'OPERATIONS_INDEX debe documentar el plan de remediacion del doctor'
    );
    assert.equal(
        operationsIndex.includes('--include-entries'),
        true,
        'OPERATIONS_INDEX debe documentar el modo expandido del doctor'
    );
    assert.equal(
        operationsIndex.includes('legacy_generated_root_deindexed'),
        true,
        'OPERATIONS_INDEX debe documentar el bloqueo por deindexado legacy pendiente'
    );
    assert.equal(
        runbooks.includes('npm run clean:local:artifacts'),
        true,
        'RUNBOOKS debe documentar la limpieza de artefactos locales'
    );
    assert.equal(
        readme.includes('playwright-report/'),
        true,
        'README.md debe incluir playwright-report/ en la limpieza local'
    );
    assert.equal(
        readme.includes('test-results/'),
        true,
        'README.md debe incluir test-results/ en la limpieza local'
    );
    assert.equal(
        readme.includes('php_server.log'),
        true,
        'README.md debe incluir php_server.log en la limpieza local'
    );
    assert.equal(
        readme.includes('.php-cs-fixer.cache'),
        true,
        'README.md debe incluir .php-cs-fixer.cache en la limpieza local'
    );
    assert.equal(
        readme.includes('.phpunit.cache/'),
        true,
        'README.md debe incluir .phpunit.cache/ en la limpieza local'
    );
    assert.equal(
        readme.includes('coverage.xml'),
        true,
        'README.md debe incluir coverage.xml en la limpieza local'
    );
    assert.equal(
        readme.includes('.tmp-calendar-write-report.json'),
        true,
        'README.md debe incluir .tmp-calendar-write-report.json en la limpieza local'
    );
    assert.equal(
        readme.includes('.codex-public-paths.txt'),
        true,
        'README.md debe incluir .codex-public-paths.txt en la limpieza local'
    );
    assert.equal(
        readme.includes('build_analysis.txt'),
        true,
        'README.md debe incluir build_analysis.txt en la limpieza local'
    );
    assert.equal(
        readme.includes('conflict_branches.txt'),
        true,
        'README.md debe incluir conflict_branches.txt en la limpieza local'
    );
    assert.equal(
        readme.includes('stats.html'),
        true,
        'README.md debe incluir stats.html en la limpieza local'
    );
    assert.equal(
        readme.includes('styles.min.css'),
        true,
        'README.md debe incluir styles.min.css en la limpieza local'
    );
    assert.equal(
        readme.includes('styles.optimized.css'),
        true,
        'README.md debe incluir styles.optimized.css en la limpieza local'
    );
    assert.equal(
        readme.includes('styles-critical.min.css'),
        true,
        'README.md debe incluir styles-critical.min.css en la limpieza local'
    );
    assert.equal(
        readme.includes('styles-deferred.min.css'),
        true,
        'README.md debe incluir styles-deferred.min.css en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('playwright-report/'),
        true,
        'OPERATIONS_INDEX debe incluir playwright-report/ en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('test-results/'),
        true,
        'OPERATIONS_INDEX debe incluir test-results/ en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('php_server.log'),
        true,
        'OPERATIONS_INDEX debe incluir php_server.log en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('.php-cs-fixer.cache'),
        true,
        'OPERATIONS_INDEX debe incluir .php-cs-fixer.cache en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('.phpunit.cache/'),
        true,
        'OPERATIONS_INDEX debe incluir .phpunit.cache/ en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('coverage.xml'),
        true,
        'OPERATIONS_INDEX debe incluir coverage.xml en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('.tmp-calendar-write-report.json'),
        true,
        'OPERATIONS_INDEX debe incluir .tmp-calendar-write-report.json en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('.codex-public-paths.txt'),
        true,
        'OPERATIONS_INDEX debe incluir .codex-public-paths.txt en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('build_analysis.txt'),
        true,
        'OPERATIONS_INDEX debe incluir build_analysis.txt en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('conflict_branches.txt'),
        true,
        'OPERATIONS_INDEX debe incluir conflict_branches.txt en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('stats.html'),
        true,
        'OPERATIONS_INDEX debe incluir stats.html en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('styles.min.css'),
        true,
        'OPERATIONS_INDEX debe incluir styles.min.css en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('styles.optimized.css'),
        true,
        'OPERATIONS_INDEX debe incluir styles.optimized.css en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('styles-critical.min.css'),
        true,
        'OPERATIONS_INDEX debe incluir styles-critical.min.css en la limpieza local'
    );
    assert.equal(
        operationsIndex.includes('styles-deferred.min.css'),
        true,
        'OPERATIONS_INDEX debe incluir styles-deferred.min.css en la limpieza local'
    );
    assert.equal(
        runbooks.includes('_deploy_bundle/'),
        true,
        'RUNBOOKS debe seguir documentando el bundle de deploy temporal'
    );
    assert.equal(
        runbooks.includes('playwright-report/'),
        true,
        'RUNBOOKS debe incluir playwright-report/ en la limpieza local'
    );
    assert.equal(
        runbooks.includes('test-results/'),
        true,
        'RUNBOOKS debe incluir test-results/ en la limpieza local'
    );
    assert.equal(
        runbooks.includes('php_server.log'),
        true,
        'RUNBOOKS debe incluir php_server.log en la limpieza local'
    );
    assert.equal(
        runbooks.includes('.php-cs-fixer.cache'),
        true,
        'RUNBOOKS debe incluir .php-cs-fixer.cache en la limpieza local'
    );
    assert.equal(
        runbooks.includes('.phpunit.cache/'),
        true,
        'RUNBOOKS debe incluir .phpunit.cache/ en la limpieza local'
    );
    assert.equal(
        runbooks.includes('coverage.xml'),
        true,
        'RUNBOOKS debe incluir coverage.xml en la limpieza local'
    );
    assert.equal(
        runbooks.includes('.tmp-calendar-write-report.json'),
        true,
        'RUNBOOKS debe incluir .tmp-calendar-write-report.json en la limpieza local'
    );
    assert.equal(
        runbooks.includes('.codex-public-paths.txt'),
        true,
        'RUNBOOKS debe incluir .codex-public-paths.txt en la limpieza local'
    );
    assert.equal(
        runbooks.includes('build_analysis.txt'),
        true,
        'RUNBOOKS debe incluir build_analysis.txt en la limpieza local'
    );
    assert.equal(
        runbooks.includes('conflict_branches.txt'),
        true,
        'RUNBOOKS debe incluir conflict_branches.txt en la limpieza local'
    );
    assert.equal(
        runbooks.includes('stats.html'),
        true,
        'RUNBOOKS debe incluir stats.html en la limpieza local'
    );
    assert.equal(
        runbooks.includes('styles.min.css'),
        true,
        'RUNBOOKS debe incluir styles.min.css en la limpieza local'
    );
    assert.equal(
        runbooks.includes('styles.optimized.css'),
        true,
        'RUNBOOKS debe incluir styles.optimized.css en la limpieza local'
    );
    assert.equal(
        runbooks.includes('styles-critical.min.css'),
        true,
        'RUNBOOKS debe incluir styles-critical.min.css en la limpieza local'
    );
    assert.equal(
        runbooks.includes('styles-deferred.min.css'),
        true,
        'RUNBOOKS debe incluir styles-deferred.min.css en la limpieza local'
    );
});
