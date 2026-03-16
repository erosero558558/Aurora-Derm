const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..');
const testsDir = path.join(repoRoot, 'tests');
const {
    createPublicRequestHandler,
    resolvePublicRuntimeRoot,
} = require('../bin/lib/public-v6-local-server.js');

function read(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

test('public V6 specs import the V6 helper instead of the legacy public-v3 helper', () => {
    const v6Specs = fs
        .readdirSync(testsDir)
        .filter((entry) => /^public-v6-.*\.spec\.js$/u.test(entry))
        .sort();

    assert.ok(v6Specs.length > 0, 'expected at least one public-v6 spec');

    for (const entry of v6Specs) {
        const content = read(path.join('tests', entry));
        assert.match(
            content,
            /require\('\.\/helpers\/public-v6'\)/u,
            `${entry} must import ./helpers/public-v6`
        );
        assert.doesNotMatch(
            content,
            /require\('\.\/helpers\/public-v3'\)/u,
            `${entry} must not import ./helpers/public-v3`
        );
    }
});

test('public V6 helper exposes booking status wiring and keeps V3 helper as a legacy wrapper', () => {
    const v6Helper = read(path.join('tests', 'helpers', 'public-v6.js'));
    const legacyHelper = read(path.join('tests', 'helpers', 'public-v3.js'));

    assert.match(
        v6Helper,
        /\[data-v6-booking-status\]/u,
        'public-v6 helper must target the V6 booking status surface'
    );
    assert.match(
        legacyHelper,
        /require\('\.\/public-v6'\)/u,
        'public-v3 helper should delegate shared routines to public-v6'
    );
});

test('public V6 local server prefers the staged site-root runtime when it exists', () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'public-v6-local-server-')
    );
    const stagedRuntimeRoot = path.join(tempRoot, '.generated', 'site-root');
    fs.mkdirSync(stagedRuntimeRoot, { recursive: true });

    assert.equal(
        resolvePublicRuntimeRoot(tempRoot),
        stagedRuntimeRoot,
        'local server must prefer .generated/site-root over the repo root'
    );
    assert.equal(
        resolvePublicRuntimeRoot(tempRoot, { runtimeRoot: tempRoot }),
        tempRoot,
        'an explicit runtimeRoot override must win over the staged default'
    );
});

test('public V6 local server falls back to the repo root for shared assets missing from staged runtime', async () => {
    const tempRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'public-v6-local-server-assets-')
    );
    const stagedRuntimeRoot = path.join(tempRoot, '.generated', 'site-root');
    fs.mkdirSync(path.join(stagedRuntimeRoot, 'es'), { recursive: true });
    fs.mkdirSync(path.join(tempRoot, 'js'), { recursive: true });
    fs.writeFileSync(
        path.join(stagedRuntimeRoot, 'es', 'index.html'),
        '<!doctype html><title>staged</title>',
        'utf8'
    );
    fs.writeFileSync(
        path.join(tempRoot, 'js', 'public-v6-shell.js'),
        'console.log("fallback asset");',
        'utf8'
    );

    const handler = createPublicRequestHandler(tempRoot, {
        host: '127.0.0.1',
        port: 0,
    });

    const htmlResponse = await new Promise((resolve) => {
        const response = {
            statusCode: 0,
            headers: null,
            body: '',
            writeHead(statusCode, headers) {
                this.statusCode = statusCode;
                this.headers = headers;
            },
            end(body) {
                this.body = String(body || '');
                resolve(this);
            },
        };
        handler({ url: '/es/', headers: { host: '127.0.0.1' } }, response);
    });

    const assetResponse = await new Promise((resolve) => {
        const response = {
            statusCode: 0,
            headers: null,
            body: '',
            writeHead(statusCode, headers) {
                this.statusCode = statusCode;
                this.headers = headers;
            },
            end(body) {
                this.body = String(body || '');
                resolve(this);
            },
        };
        handler(
            {
                url: '/js/public-v6-shell.js',
                headers: { host: '127.0.0.1' },
            },
            response
        );
    });

    assert.equal(htmlResponse.statusCode, 200, 'staged HTML must resolve');
    assert.match(
        htmlResponse.body,
        /staged/u,
        'HTML requests should prefer the staged runtime root'
    );
    assert.equal(
        assetResponse.statusCode,
        200,
        'shared assets missing from staged runtime must fall back to repo root'
    );
    assert.match(
        assetResponse.body,
        /fallback asset/u,
        'fallback assets should be served from the repo root'
    );
});
