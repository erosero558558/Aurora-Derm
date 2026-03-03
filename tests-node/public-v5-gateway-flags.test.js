#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                server.close(() =>
                    reject(new Error('Could not resolve free port'))
                );
                return;
            }
            server.close(() => resolve(address.port));
        });
    });
}

async function waitForHttpReady(url, timeoutMs = 12000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                redirect: 'manual',
                signal: AbortSignal.timeout(1500),
            });
            if (response.status >= 200 && response.status < 500) {
                return true;
            }
        } catch (_error) {
            // retry
        }
        await sleep(200);
    }
    return false;
}

function stopProcess(proc) {
    if (!proc || !proc.pid) return;
    if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            shell: true,
        });
        return;
    }
    proc.kill('SIGTERM');
}

async function startPhpServer(envOverrides = {}) {
    const port = await getFreePort();
    const env = { ...process.env, ...envOverrides };
    const proc = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', '.'], {
        cwd: REPO_ROOT,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
    });

    const baseUrl = `http://127.0.0.1:${port}`;
    const ready = await waitForHttpReady(`${baseUrl}/legacy.php`);
    if (!ready) {
        stopProcess(proc);
        throw new Error('Local PHP server did not become ready');
    }

    return { proc, baseUrl };
}

async function request(baseUrl, route, headers = {}) {
    return fetch(`${baseUrl}${route}`, {
        method: 'GET',
        redirect: 'manual',
        headers,
        signal: AbortSignal.timeout(5000),
    });
}

async function withServer(envOverrides, run) {
    const { proc, baseUrl } = await startPhpServer(envOverrides);
    try {
        await run(baseUrl);
    } finally {
        stopProcess(proc);
    }
}

function v5Env(overrides = {}) {
    return {
        PIELARMONIA_PUBLIC_V5_ENABLED: 'true',
        PIELARMONIA_PUBLIC_V5_RATIO: '1',
        PIELARMONIA_PUBLIC_V5_KILL_SWITCH: 'false',
        PIELARMONIA_PUBLIC_V5_FORCE_LOCALE: '',
        ...overrides,
    };
}

function readJson(relativePath) {
    const filePath = path.join(REPO_ROOT, relativePath);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalizeAssetPath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/');
}

function buildAssetIndexes(manifest) {
    const byId = new Map();
    const byPath = new Map();
    const assets = Array.isArray(manifest?.assets) ? manifest.assets : [];

    assets.forEach((asset) => {
        const assetId = String(asset?.id || '')
            .trim()
            .toLowerCase();
        if (assetId) {
            byId.set(assetId, asset);
        }

        const paths = [
            normalizeAssetPath(asset?.src),
            ...(Array.isArray(asset?.derivatives) ? asset.derivatives : []).map(
                (entry) => normalizeAssetPath(entry)
            ),
        ].filter(Boolean);

        paths.forEach((assetPath) => byPath.set(assetPath, asset));
    });

    return { byId, byPath };
}

function effectiveServiceCatalog() {
    const v5Catalog = readJson(
        path.join('content', 'public-v5', 'catalog.json')
    );
    const v4Catalog = readJson(
        path.join('content', 'public-v4', 'catalog.json')
    );
    const v5Services = Array.isArray(v5Catalog?.services)
        ? v5Catalog.services
        : [];
    const v4Services = Array.isArray(v4Catalog?.services)
        ? v4Catalog.services
        : [];

    if (v5Services.length > 0) {
        return {
            source: 'public-v5',
            services: v5Services,
        };
    }

    return {
        source: 'public-v4-fallback',
        services: v4Services,
    };
}

test('root gateway routes to /es/ with non-English Accept-Language', async () => {
    await withServer(v5Env(), async (baseUrl) => {
        const response = await request(baseUrl, '/', {
            'accept-language': 'es-EC,es;q=0.9',
        });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/es/');
        assert.equal(response.headers.get('x-public-surface'), 'v5');
    });
});

test('root gateway routes to /en/ when Accept-Language starts with en', async () => {
    await withServer(v5Env(), async (baseUrl) => {
        const response = await request(baseUrl, '/', {
            'accept-language': 'en-US,en;q=0.9',
        });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/en/');
        assert.equal(response.headers.get('x-public-surface'), 'v5');
    });
});

test('root gateway force locale takes precedence over Accept-Language', async () => {
    await withServer(
        v5Env({ PIELARMONIA_PUBLIC_V5_FORCE_LOCALE: 'en' }),
        async (baseUrl) => {
            const response = await request(baseUrl, '/', {
                'accept-language': 'es-EC,es;q=0.9',
            });
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/en/');
            assert.equal(response.headers.get('x-public-target-locale'), 'en');
        }
    );
});

test('root gateway sends traffic to legacy when ratio is 0', async () => {
    await withServer(
        v5Env({ PIELARMONIA_PUBLIC_V5_RATIO: '0' }),
        async (baseUrl) => {
            const response = await request(baseUrl, '/');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/legacy.php');
            assert.equal(response.headers.get('x-public-surface'), 'legacy');
        }
    );
});

test('root gateway kill-switch sends traffic to legacy immediately', async () => {
    await withServer(
        v5Env({ PIELARMONIA_PUBLIC_V5_KILL_SWITCH: 'true' }),
        async (baseUrl) => {
            const response = await request(baseUrl, '/');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/legacy.php');
            assert.equal(response.headers.get('x-public-surface'), 'legacy');
            assert.equal(
                response.headers.get('x-public-v5-kill-switch'),
                'true'
            );
        }
    );
});

test('root gateway publishes rollout headers for v5 decision path', async () => {
    await withServer(v5Env(), async (baseUrl) => {
        const response = await request(baseUrl, '/', {
            'accept-language': 'es-EC,es;q=0.9',
        });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/es/');
        assert.equal(response.headers.get('x-public-surface'), 'v5');
        assert.equal(response.headers.get('x-public-v5-enabled'), 'true');
        assert.equal(response.headers.get('x-public-v5-ratio'), '1.0000');
        assert.equal(response.headers.get('x-public-v5-kill-switch'), 'false');
    });
});

test('root gateway honors surface=v5 override when rollout ratio is 0', async () => {
    await withServer(
        v5Env({ PIELARMONIA_PUBLIC_V5_RATIO: '0' }),
        async (baseUrl) => {
            const response = await request(baseUrl, '/?surface=v5');
            assert.equal(response.status, 302);
            assert.equal(response.headers.get('location'), '/es/');
            assert.equal(response.headers.get('x-public-surface'), 'v5');
            const setCookie = response.headers.get('set-cookie') || '';
            assert.match(setCookie, /pa_public_surface=v5/i);
        }
    );
});

test('root gateway supports surface=auto by clearing stale cookie and re-evaluating rollout', async () => {
    await withServer(v5Env(), async (baseUrl) => {
        const response = await request(baseUrl, '/?surface=auto', {
            cookie: 'pa_public_surface=legacy',
        });
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/es/');
        assert.equal(response.headers.get('x-public-surface'), 'v5');
        const setCookie = response.headers.get('set-cookie') || '';
        assert.match(setCookie, /pa_public_surface=v5/i);
    });
});

test('root gateway honors legacy override query and persists surface cookie', async () => {
    await withServer(v5Env(), async (baseUrl) => {
        const response = await request(baseUrl, '/?legacy=1');
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), '/legacy.php');
        assert.equal(response.headers.get('x-public-surface'), 'legacy');
        const setCookie = response.headers.get('set-cookie') || '';
        assert.match(setCookie, /pa_public_surface=legacy/i);
    });
});

test('effective service catalog is non-empty for V5 surface', () => {
    const catalog = effectiveServiceCatalog();
    assert.equal(
        catalog.source,
        'public-v5',
        'effective service catalog must come from public-v5 without fallback'
    );
    assert.ok(
        Array.isArray(catalog.services) && catalog.services.length > 0,
        `effective services must be non-empty (source=${catalog.source})`
    );
});

test('effective service media maps to public-v5 assets manifest by asset_id and src', () => {
    const manifest = readJson(
        path.join('content', 'public-v5', 'assets-manifest.json')
    );
    const { byId, byPath } = buildAssetIndexes(manifest);
    const { services, source } = effectiveServiceCatalog();

    const errors = [];
    const seenAssetIds = new Set();

    services.forEach((service, index) => {
        const prefix = `${source}.services[${index}]`;
        const media =
            service?.media && typeof service.media === 'object'
                ? service.media
                : null;
        if (!media) {
            errors.push(`${prefix}.media must be an object.`);
            return;
        }

        const slug = String(service?.slug || '').trim() || `index-${index}`;
        const mediaSrc = normalizeAssetPath(media.src);
        const mediaAssetId = String(media.asset_id || media.assetId || '')
            .trim()
            .toLowerCase();

        if (!mediaAssetId) {
            errors.push(`${prefix}.media.asset_id missing for slug=${slug}.`);
            return;
        }
        if (!mediaSrc) {
            errors.push(`${prefix}.media.src missing for slug=${slug}.`);
            return;
        }
        if (!String(media.alt_es || '').trim()) {
            errors.push(`${prefix}.media.alt_es missing for slug=${slug}.`);
        }
        if (!String(media.alt_en || '').trim()) {
            errors.push(`${prefix}.media.alt_en missing for slug=${slug}.`);
        }

        const assetById = byId.get(mediaAssetId);
        if (!assetById) {
            errors.push(
                `${prefix}.media.asset_id not found in public-v5 manifest for slug=${slug} (${mediaAssetId}).`
            );
            return;
        }

        const assetByPath = byPath.get(mediaSrc);
        if (!assetByPath) {
            errors.push(
                `${prefix}.media.src not found in public-v5 manifest paths for slug=${slug} (${mediaSrc}).`
            );
            return;
        }

        const assetByPathId = String(assetByPath.id || '')
            .trim()
            .toLowerCase();
        if (assetByPathId !== mediaAssetId) {
            errors.push(
                `${prefix}.media.asset_id/src mismatch for slug=${slug} (${mediaAssetId} != ${assetByPathId}).`
            );
        }

        const usageScope = Array.isArray(assetById.usage_scope)
            ? assetById.usage_scope.map((entry) =>
                  String(entry || '')
                      .trim()
                      .toLowerCase()
              )
            : [];
        if (
            !usageScope.includes('services') &&
            !usageScope.includes('service-detail')
        ) {
            errors.push(
                `${prefix}.media.asset_id usage_scope missing services/service-detail for slug=${slug}.`
            );
        }

        seenAssetIds.add(mediaAssetId);
    });

    assert.equal(errors.length, 0, errors.join('\n'));
    assert.ok(
        seenAssetIds.size >= 6,
        `expected >=6 unique media asset ids across services, got ${seenAssetIds.size}`
    );
});

test('content runtime enforces canonical V5 source without V4 fallback for services/booking', () => {
    const contentLibPath = path.join(
        REPO_ROOT,
        'src',
        'apps',
        'astro',
        'src',
        'lib',
        'content.js'
    );
    const source = fs.readFileSync(contentLibPath, 'utf8');

    assert.match(
        source,
        /export function getServices\(\)\s*\{[\s\S]*data\.v5Catalog\?\.services/iu
    );
    assert.doesNotMatch(source, /v4Catalog\?\.services/iu);
    assert.doesNotMatch(source, /getV5Catalog\(\)\s*\|\|\s*getV4Catalog\(\)/iu);
});

test('content runtime enforces canonical V5 asset manifest lookup', () => {
    const contentLibPath = path.join(
        REPO_ROOT,
        'src',
        'apps',
        'astro',
        'src',
        'lib',
        'content.js'
    );
    const source = fs.readFileSync(contentLibPath, 'utf8');

    assert.match(source, /const manifest = getV5AssetsManifest\(\);/iu);
    assert.doesNotMatch(
        source,
        /getV5AssetsManifest\(\)\s*\|\|\s*getV4AssetsManifest\(\)/iu
    );
});
