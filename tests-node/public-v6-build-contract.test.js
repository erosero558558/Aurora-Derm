const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
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
