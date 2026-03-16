const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { GENERATED_SITE_ROOT } = require('../bin/lib/generated-site-root.js');

const repoRoot = path.join(__dirname, '..');
const generatedSiteRoot = GENERATED_SITE_ROOT;

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function resolveRuntimeArtifactPath(relativePath) {
    const normalizedPath = path.normalize(String(relativePath || ''));
    const generatedPath = path.join(generatedSiteRoot, normalizedPath);
    assert.equal(
        fs.existsSync(generatedPath),
        true,
        `falta artefacto generado en .generated/site-root: ${normalizedPath}. Ejecuta npm run build para regenerar el runtime staged`
    );
    return generatedPath;
}

function readRuntimeArtifact(relativePath) {
    return fs.readFileSync(resolveRuntimeArtifactPath(relativePath), 'utf8');
}

function readJson(relativePath) {
    return JSON.parse(read(relativePath));
}

function findRasterMaster(assetId) {
    return ['.jpg', '.jpeg', '.png']
        .map((extension) =>
            path.join(repoRoot, 'images', 'src', `${assetId}${extension}`)
        )
        .find((candidate) => fs.existsSync(candidate));
}

function normalizeAssetBasePath(value) {
    return String(value || '')
        .trim()
        .split(/\s+/u)[0]
        .replace(
            /-(400|500|640|800|900|1024|1200|1344|1400|lqip)(?=\.(webp|jpg)$)/u,
            ''
        );
}

function collectPrimaryImageRefs(value, counts) {
    if (!value || typeof value === 'string') {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => collectPrimaryImageRefs(item, counts));
        return;
    }

    if (typeof value === 'object') {
        for (const [key, item] of Object.entries(value)) {
            if (
                (key === 'src' || key === 'image' || key === 'heroImage') &&
                typeof item === 'string' &&
                item.startsWith('/images/optimized/')
            ) {
                const normalized = normalizeAssetBasePath(item);
                counts.set(normalized, (counts.get(normalized) || 0) + 1);
            }
            collectPrimaryImageRefs(item, counts);
        }
    }
}

function collectUniqueSectionImages(items, field = 'image') {
    return Array.isArray(items)
        ? items
              .map((item) =>
                  normalizeAssetBasePath(
                      item && typeof item === 'object' ? item[field] : ''
                  )
              )
              .filter(Boolean)
        : [];
}

function assertUniqueAssetRefs(items, label, field = 'image') {
    const refs = collectUniqueSectionImages(items, field);
    const unique = new Set(refs);
    assert.equal(
        unique.size,
        refs.length,
        `${label} must not repeat image refs inside the same section`
    );
}

function extractMetaContent(html, property) {
    const escaped = property.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const pattern = new RegExp(
        `<meta[^>]+property="${escaped}"[^>]+content="([^"]+)"`,
        'u'
    );
    const match = html.match(pattern);
    return match ? match[1] : '';
}

function toOgImageUrl(relativePath) {
    const normalized = String(relativePath || '')
        .trim()
        .replace(/\.webp$/u, '.jpg');
    return normalized.startsWith('http')
        ? normalized
        : `https://pielarmonia.com${normalized}`;
}

const LEGACY_PUBLIC_IMAGE_PATTERN =
    /\/(?:showcase-|service-|team-)[a-z0-9-]+\.(?:webp|jpg|avif|png)|hero-woman/u;

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
    const entryPath = resolveRuntimeArtifactPath('script.js');
    const chunksDir = resolveRuntimeArtifactPath(path.join('js', 'chunks'));
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

test('quality150 gate exposes a dedicated runner and canonical report outputs', () => {
    const packageJson = JSON.parse(read('package.json'));
    const gateScript = String(
        packageJson.scripts['gate:public:v6:quality150'] || ''
    );
    const runner = read(path.join('bin', 'gate-public-v6-quality150.js'));

    assert.equal(
        gateScript,
        'node bin/gate-public-v6-quality150.js',
        'gate:public:v6:quality150 must point to the dedicated runner'
    );
    assert.match(
        runner,
        /quality150\.json/u,
        'quality150 runner must write quality150.json'
    );
    assert.match(
        runner,
        /quality150\.md/u,
        'quality150 runner must write quality150.md'
    );
    assert.match(
        runner,
        /visual-contract\.json/u,
        'quality150 runner must read visual-contract.json'
    );
    assert.match(
        runner,
        /sony-parity-50\.json/u,
        'quality150 runner must read sony-parity-50.json'
    );
    assert.match(
        runner,
        /quality_score/u,
        'quality150 runner must persist quality_score'
    );
    assert.match(
        runner,
        /154/u,
        'quality150 runner must keep the canonical 154-point ceiling'
    );
    assert.match(
        runner,
        /test:frontend:performance:gate/u,
        'quality150 runner must include the performance hard gate'
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
    const scriptBundle = readRuntimeArtifact('script.js');

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
    const packageJson = JSON.parse(read('package.json'));
    const runner = read(path.join('bin', 'build-public-v6.js'));

    assert.equal(
        packageJson.scripts['stage:site-root'],
        'node src/apps/astro/scripts/sync-dist.mjs',
        'package.json debe exponer stage:site-root como stage canonico del sitio generado'
    );
    assert.match(
        runner,
        /content:public-v6:validate/u,
        'runner must validate V6 content first'
    );
    assert.match(runner, /astro:build/u, 'runner must build Astro artifacts');
    assert.match(
        runner,
        /stage:site-root/u,
        'runner must stage dist artifacts into .generated/site-root'
    );
    assert.match(
        runner,
        /chunks:public:prune/u,
        'runner must prune stale public chunks from the staged runtime graph'
    );
    assert.match(
        runner,
        /chunks:admin:prune/u,
        'runner must prune stale admin chunks from the staged runtime graph'
    );
    assert.match(
        runner,
        /check:public:v6:artifacts/u,
        'runner must verify staged artifacts against dist'
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
    const chunksDir = resolveRuntimeArtifactPath(path.join('js', 'chunks'));
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
        readRuntimeArtifact('script.js'),
        new RegExp(activeShells[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u'),
        'script.js debe apuntar al shell chunk activo'
    );
});

test('public V6 manifest includes the relaunch image family', () => {
    const manifest = readJson(
        path.join('content', 'public-v6', 'assets-manifest.json')
    );
    const assetIds = new Set(
        Array.isArray(manifest.assets)
            ? manifest.assets.map((asset) => asset.id)
            : []
    );
    const requiredIds = [
        'v6-clinic-home-followup',
        'v6-clinic-team-roundtable',
        'v6-clinic-hub-editorial-map',
        'v6-clinic-telemedicine-intake',
        'v6-clinic-telemedicine-review',
        'v6-clinic-legal-governance',
        'v6-clinic-statement-clinical-direction',
        'v6-clinic-statement-procedure-guidance',
        'v6-clinic-statement-family-support',
    ];

    requiredIds.forEach((assetId) => {
        assert.equal(
            assetIds.has(assetId),
            true,
            `assets-manifest must include ${assetId}`
        );
    });
});

test('public V6 manifest marks photo provenance and ships raster masters for every asset', () => {
    const manifest = readJson(
        path.join('content', 'public-v6', 'assets-manifest.json')
    );
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];
    const validSourceKinds = new Set(['real_photo', 'ai_photoreal']);
    const validIdentityPolicies = new Set(['generic', 'staff_real']);
    const staffRequired = new Set([
        'v6-clinic-doctor-rosero',
        'v6-clinic-doctor-narvaez',
        'v6-clinic-team-roundtable',
    ]);

    assets.forEach((asset) => {
        assert.equal(
            validSourceKinds.has(asset.sourceKind),
            true,
            `${asset.id} must declare sourceKind`
        );
        assert.equal(
            validIdentityPolicies.has(asset.identityPolicy),
            true,
            `${asset.id} must declare identityPolicy`
        );
        assert.ok(
            findRasterMaster(asset.id),
            `${asset.id} must ship a raster master in images/src`
        );
        if (staffRequired.has(asset.id)) {
            assert.equal(
                asset.identityPolicy,
                'staff_real',
                `${asset.id} must be marked staff_real`
            );
            assert.equal(
                asset.sourceKind,
                'real_photo',
                `${asset.id} must use real_photo`
            );
        }
    });
});

test('public V6 content caps primary asset reuse and keeps section-level image sets unique', () => {
    const contentFiles = [
        path.join('content', 'public-v6', 'es', 'home.json'),
        path.join('content', 'public-v6', 'es', 'hub.json'),
        path.join('content', 'public-v6', 'es', 'service.json'),
        path.join('content', 'public-v6', 'es', 'telemedicine.json'),
        path.join('content', 'public-v6', 'es', 'legal.json'),
        path.join('content', 'public-v6', 'en', 'home.json'),
        path.join('content', 'public-v6', 'en', 'hub.json'),
        path.join('content', 'public-v6', 'en', 'service.json'),
        path.join('content', 'public-v6', 'en', 'telemedicine.json'),
        path.join('content', 'public-v6', 'en', 'legal.json'),
    ];
    const counts = new Map();

    contentFiles.forEach((file) => {
        collectPrimaryImageRefs(readJson(file), counts);
    });

    const overLimit = Array.from(counts.entries()).filter(
        ([, count]) => count > 8
    );
    assert.deepEqual(
        overLimit,
        [],
        `primary image refs must stay at or below 8: ${JSON.stringify(
            overLimit
        )}`
    );

    ['es', 'en'].forEach((locale) => {
        const home = readJson(
            path.join('content', 'public-v6', locale, 'home.json')
        );
        const hub = readJson(
            path.join('content', 'public-v6', locale, 'hub.json')
        );
        const telemedicine = readJson(
            path.join('content', 'public-v6', locale, 'telemedicine.json')
        );

        assertUniqueAssetRefs(home?.hero?.slides, `${locale} home hero`);
        assertUniqueAssetRefs(
            home?.editorial?.cards,
            `${locale} home editorial`
        );
        assertUniqueAssetRefs(
            home?.corporateMatrix?.cards,
            `${locale} home corporate matrix`
        );
        assertUniqueAssetRefs(hub?.featured, `${locale} hub featured`);
        assertUniqueAssetRefs(hub?.initiatives, `${locale} hub initiatives`);
        assertUniqueAssetRefs(
            telemedicine?.initiatives,
            `${locale} telemedicine initiatives`
        );
        (Array.isArray(hub?.sections) ? hub.sections : []).forEach(
            (section) => {
                assertUniqueAssetRefs(
                    section?.cards,
                    `${locale} hub section ${section?.id || 'unknown'}`
                );
            }
        );
    });
});

test('public V6 root HTML publishes route-specific og:image values and strips legacy image refs', () => {
    const routes = [
        {
            html: path.join('es', 'index.html'),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'es', 'home.json')
            ).hero.slides[0].image,
        },
        {
            html: path.join('en', 'index.html'),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'en', 'home.json')
            ).hero.slides[0].image,
        },
        {
            html: path.join(
                'es',
                'servicios',
                'diagnostico-integral',
                'index.html'
            ),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'es', 'service.json')
            ).services.find(
                (service) => service.slug === 'diagnostico-integral'
            ).heroImage,
        },
        {
            html: path.join('es', 'telemedicina', 'index.html'),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'es', 'telemedicine.json')
            ).heroImage.src,
        },
        {
            html: path.join('es', 'legal', 'terminos', 'index.html'),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'es', 'legal.json')
            ).pages.terminos.heroImage,
        },
        {
            html: path.join(
                'en',
                'services',
                'diagnostico-integral',
                'index.html'
            ),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'en', 'service.json')
            ).services.find(
                (service) => service.slug === 'diagnostico-integral'
            ).heroImage,
        },
        {
            html: path.join('en', 'telemedicine', 'index.html'),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'en', 'telemedicine.json')
            ).heroImage.src,
        },
        {
            html: path.join('en', 'legal', 'terms', 'index.html'),
            expectedImage: readJson(
                path.join('content', 'public-v6', 'en', 'legal.json')
            ).pages.terms.heroImage,
        },
        {
            html: path.join('es', 'software', 'turnero-clinicas', 'index.html'),
            expectedImage: '/images/optimized/v6-software-og-suite.jpg',
        },
        {
            html: path.join(
                'es',
                'software',
                'turnero-clinicas',
                'demo',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-demo.jpg',
        },
        {
            html: path.join(
                'es',
                'software',
                'turnero-clinicas',
                'estado-turno',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-status.jpg',
        },
        {
            html: path.join(
                'es',
                'software',
                'turnero-clinicas',
                'dashboard',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-dashboard.jpg',
        },
        {
            html: path.join(
                'en',
                'software',
                'clinic-flow-suite',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-suite.jpg',
        },
        {
            html: path.join(
                'en',
                'software',
                'clinic-flow-suite',
                'demo',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-demo.jpg',
        },
        {
            html: path.join(
                'en',
                'software',
                'clinic-flow-suite',
                'queue-status',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-status.jpg',
        },
        {
            html: path.join(
                'en',
                'software',
                'clinic-flow-suite',
                'dashboard',
                'index.html'
            ),
            expectedImage: '/images/optimized/v6-software-og-dashboard.jpg',
        },
    ];

    routes.forEach(({ html, expectedImage }) => {
        const pageHtml = readRuntimeArtifact(html);
        const ogImage = extractMetaContent(pageHtml, 'og:image');
        assert.equal(
            ogImage,
            toOgImageUrl(expectedImage),
            `${html} must publish the route hero as og:image`
        );
        assert.doesNotMatch(
            pageHtml,
            LEGACY_PUBLIC_IMAGE_PATTERN,
            `${html} must not keep legacy public image refs`
        );
    });
});
