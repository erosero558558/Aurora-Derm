const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function parseModuleSpecifiers(source) {
    const specifiers = [];
    const patterns = [
        /\bimport\s*\(\s*(['"`])([^'"`]+)\1\s*\)/g,
        /\bfrom\s*(['"`])([^'"`]+)\1/g,
        /\bimport\s*(['"`])([^'"`]+)\1/g,
    ];

    for (const pattern of patterns) {
        let match = pattern.exec(source);
        while (match) {
            const value = String(match[2] || '').trim();
            if (value) {
                specifiers.push(value);
            }
            match = pattern.exec(source);
        }
    }

    return specifiers;
}

function toChunkFilename(specifier) {
    const cleanValue = String(specifier || '')
        .split('?')[0]
        .split('#')[0];
    if (!cleanValue) return '';

    if (cleanValue.includes('js/chunks/')) {
        return cleanValue.slice(cleanValue.lastIndexOf('/') + 1);
    }

    if (cleanValue.startsWith('./') && !cleanValue.slice(2).includes('/')) {
        return cleanValue.slice(2);
    }

    return '';
}

function collectReachablePublicChunks() {
    const entryPath = path.join(repoRoot, 'script.js');
    const chunksDir = path.join(repoRoot, 'js', 'chunks');
    const reachable = new Set();
    const pendingFiles = [entryPath];
    const visited = new Set();

    while (pendingFiles.length > 0) {
        const current = pendingFiles.shift();
        if (!current || visited.has(current) || !fs.existsSync(current)) {
            continue;
        }

        visited.add(current);

        const source = fs.readFileSync(current, 'utf8');
        const specifiers = parseModuleSpecifiers(source);

        for (const specifier of specifiers) {
            const chunkFilename = toChunkFilename(specifier);
            if (!chunkFilename || !chunkFilename.endsWith('.js')) {
                continue;
            }

            reachable.add(chunkFilename);

            const nextChunkPath = path.join(chunksDir, chunkFilename);
            if (fs.existsSync(nextChunkPath) && !visited.has(nextChunkPath)) {
                pendingFiles.push(nextChunkPath);
            }
        }
    }

    return reachable;
}

test('build:public:v6 uses the dedicated Node runner instead of shell chaining', () => {
    const packageJson = JSON.parse(read('package.json'));
    const buildScript = String(packageJson.scripts['build:public:v6'] || '');

    assert.equal(
        buildScript,
        'node bin/build-public-v6.js',
        'build:public:v6 must point to the dedicated runner'
    );
    assert.doesNotMatch(
        buildScript,
        /&&/u,
        'build:public:v6 must not rely on shell chaining'
    );
});

test('canonical build wires public runtime validation after rollup', () => {
    const packageJson = JSON.parse(read('package.json'));
    const buildScript = String(packageJson.scripts.build || '');
    const publishGate = String(
        packageJson.scripts['gate:public:v6:canonical-publish'] || ''
    );

    assert.equal(
        packageJson.scripts['chunks:public:check'],
        'node bin/clean-public-chunks.js --dry-run --strict',
        'package.json debe exponer chunks:public:check'
    );
    assert.equal(
        packageJson.scripts['chunks:public:prune'],
        'node bin/clean-public-chunks.js',
        'package.json debe exponer chunks:public:prune'
    );
    assert.equal(
        packageJson.scripts['check:public:runtime:artifacts'],
        'node bin/check-public-runtime-artifacts.js',
        'package.json debe exponer check:public:runtime:artifacts'
    );
    assert.match(
        buildScript,
        /rollup -c/u,
        'build debe seguir compilando los bundles publicos con rollup'
    );
    assert.match(
        buildScript,
        /npm run chunks:public:prune/u,
        'build debe podar chunks publicos huerfanos despues de rollup'
    );
    assert.match(
        buildScript,
        /npm run check:public:runtime:artifacts/u,
        'build debe validar el runtime publico versionado despues de podar chunks'
    );
    assert.match(
        buildScript,
        /npm run chunks:admin:prune/u,
        'build debe seguir podando chunks admin huerfanos'
    );
    assert.match(
        publishGate,
        /npm run check:public:runtime:artifacts/u,
        'gate:public:v6:canonical-publish debe validar script.js y js/chunks'
    );
});

test('public runtime checker writes canonical report for script.js and js/chunks', () => {
    const checker = read(path.join('bin', 'check-public-runtime-artifacts.js'));
    const helper = read(path.join('bin', 'lib', 'public-runtime-artifacts.js'));

    assert.match(
        checker,
        /runtime-artifacts-report\.json/u,
        'checker debe escribir el reporte runtime-artifacts-report.json'
    );
    assert.match(
        checker,
        /inspectPublicRuntimeArtifacts/u,
        'checker debe reutilizar el helper canonico del runtime publico'
    );
    assert.match(
        helper,
        /active_shell_count_mismatch/u,
        'helper debe diagnosticar drift de shell activo'
    );
    assert.match(
        helper,
        /stale_chunks_detected/u,
        'helper debe diagnosticar chunks huerfanos'
    );
    assert.match(
        helper,
        /merge_conflicts_detected/u,
        'helper debe diagnosticar marcadores de merge en assets activos'
    );
    assert.match(
        helper,
        /missing_support_assets/u,
        'helper debe diagnosticar support assets faltantes del gateway publico'
    );
    assert.match(
        helper,
        /missing_referenced_engine_files/u,
        'helper debe diagnosticar engines faltantes referenciados por script.js'
    );
});

test('script.js references the canonical engine directory and deferred stylesheet support', () => {
    const scriptBundle = read('script.js');

    assert.match(
        scriptBundle,
        /\/js\/engines\/[a-z0-9-]+\.js/u,
        'script.js debe seguir referenciando js/engines/** para el gateway publico'
    );
    assert.match(
        scriptBundle,
        /styles-deferred\.css/u,
        'script.js debe seguir cargando styles-deferred.css como soporte del gateway'
    );
});

test('build-public-v6 runner preserves canonical sequence and report output', () => {
    const runner = read(path.join('bin', 'build-public-v6.js'));

    assert.match(
        runner,
        /content:public-v6:validate/u,
        'runner must validate V6 content first'
    );
    assert.match(runner, /astro:build/u, 'runner must build Astro artifacts');
    assert.match(
        runner,
        /astro:sync/u,
        'runner must sync dist artifacts to root'
    );
    assert.match(
        runner,
        /check:public:v6:artifacts/u,
        'runner must verify root artifacts against dist'
    );
    assert.match(
        runner,
        /build-report\.json/u,
        'runner must write a canonical build report'
    );
    assert.match(
        runner,
        /--skip-build/u,
        'runner must call artifact drift check without rebuilding twice'
    );
});

test('turnero demo state exposes a canonical schema for landing and software surfaces', async () => {
    const moduleUrl = pathToFileURL(
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'lib',
            'turnero-demo-state.js'
        )
    ).href;
    const { buildTurneroDemoState } = await import(moduleUrl);
    const esState = buildTurneroDemoState('es');
    const enState = buildTurneroDemoState('en');

    assert.equal(
        esState.version,
        'turnero-demo-state-v1',
        'el sandbox canonico debe publicar version estable'
    );
    assert.equal(
        enState.version,
        'turnero-demo-state-v1',
        'la version del sandbox debe ser igual en ambos locales'
    );
    assert.equal(
        esState.queue.currentTicket,
        enState.queue.currentTicket,
        'el ticket actual debe compartirse entre locales'
    );
    assert.equal(
        esState.queue.averageWaitMinutes,
        8,
        'la espera media del sandbox debe quedar fijada en el contrato'
    );
    assert.equal(
        esState.queue.noShowRatePct,
        6.2,
        'el no-show del sandbox debe quedar fijado en el contrato'
    );
    assert.equal(
        esState.queue.servedToday,
        124,
        'los tickets atendidos del sandbox deben quedar fijados en el contrato'
    );
    assert.equal(
        esState.proof.items.length,
        5,
        'el sandbox debe exponer cinco pruebas operativas canonicas'
    );
    assert.match(
        read(path.join('src', 'apps', 'astro', 'src', 'lib', 'public-v6.js')),
        /getV6SoftwareNavigationModel/u,
        'public-v6 debe exponer una navegacion dedicada para software'
    );
});

test('astro sync recreates canonical targets before copying dist contents', () => {
    const syncScript = read(
        path.join('src', 'apps', 'astro', 'scripts', 'sync-dist.mjs')
    );

    assert.match(
        syncScript,
        /ensureEmptyDirectory/u,
        'sync-dist must normalize target directories explicitly before copying'
    );
    assert.match(
        syncScript,
        /fs\.mkdirSync\(targetDir, \{ recursive: true \}\)/u,
        'sync-dist must recreate canonical targets after cleanup'
    );
    assert.match(
        syncScript,
        /for \(const entry of fs\.readdirSync\(sourceDir\)\)/u,
        'sync-dist must copy dist contents entry-by-entry'
    );
});

test('public V6 audits reuse the canonical local helper and avoid hardcoded 8000 assumptions', () => {
    const visualContract = read(
        path.join('bin', 'audit-public-v6-visual-contract.js')
    );
    const sonyEvidence = read(
        path.join('bin', 'audit-public-v6-sony-evidence.js')
    );
    const baselineCapture = read(
        path.join('bin', 'capture-public-baseline.js')
    );

    assert.match(
        visualContract,
        /public-v6-local-server/u,
        'visual contract audit must import the canonical public-v6 local helper'
    );
    assert.match(
        visualContract,
        /startLocalPublicServer/u,
        'visual contract audit must start the canonical local V6 server helper'
    );
    assert.match(
        visualContract,
        /parseArg\('--base-url'/u,
        'visual contract audit must support explicit --base-url overrides'
    );
    assert.doesNotMatch(
        visualContract,
        /127\.0\.0\.1:8000|http\.server 8000/u,
        'visual contract audit must not hardcode localhost:8000 anymore'
    );
    assert.doesNotMatch(
        sonyEvidence,
        /127\.0\.0\.1:8000/u,
        'sony evidence audit must not keep a stale localhost:8000 default'
    );
    assert.match(
        sonyEvidence,
        /parseArg\('--base-url'/u,
        'sony evidence audit must support explicit --base-url overrides'
    );
    assert.match(
        sonyEvidence,
        /contract_base_url/u,
        'sony evidence audit must persist the contract runtime base URL'
    );
    assert.match(
        baselineCapture,
        /public-v6-local-server/u,
        'baseline capture must import the canonical public-v6 local helper'
    );
    assert.match(
        baselineCapture,
        /startLocalPublicServer/u,
        'baseline capture must start the canonical local V6 server helper'
    );
    assert.match(
        baselineCapture,
        /runtimeSource/u,
        'baseline capture manifest must persist runtime source metadata'
    );
    assert.doesNotMatch(
        baselineCapture,
        /127\.0\.0\.1:8092|php -S/u,
        'baseline capture must not keep a bespoke fixed-port PHP server'
    );
});

test('script.js deja solo chunks publicos alcanzables y un shell activo', () => {
    const chunksDir = path.join(repoRoot, 'js', 'chunks');
    const allChunks = fs
        .readdirSync(chunksDir)
        .filter((entry) => entry.endsWith('.js'))
        .sort();
    const reachable = Array.from(collectReachablePublicChunks()).sort();
    const stale = allChunks.filter((entry) => !reachable.includes(entry));
    const activeShells = reachable.filter((entry) =>
        entry.startsWith('shell-')
    );

    assert.deepEqual(
        stale,
        [],
        `js/chunks no debe conservar chunks huerfanos: ${stale.join(', ')}`
    );
    assert.equal(
        activeShells.length,
        1,
        'script.js debe dejar exactamente un shell chunk activo'
    );
    assert.match(
        read('script.js'),
        new RegExp(activeShells[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
        'script.js debe apuntar al shell chunk activo'
    );
});
