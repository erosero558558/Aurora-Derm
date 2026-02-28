#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 2;

function parseArgs(argv) {
    const args = { baseUrl: '', label: 'public-routing', output: '' };
    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (token === '--base-url') {
            args.baseUrl = String(argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
        if (token === '--label') {
            args.label = String(argv[i + 1] || '').trim() || args.label;
            i += 1;
            continue;
        }
        if (token === '--output') {
            args.output = String(argv[i + 1] || '').trim();
            i += 1;
            continue;
        }
    }
    return args;
}

function ensureUrl(value) {
    if (!value) {
        return null;
    }
    try {
        return new URL(value);
    } catch (_error) {
        return null;
    }
}

function cleanRoutePath(pathname) {
    const normalized = `/${String(pathname || '/').replace(/^\/+/, '')}`;
    return normalized === '/' ? '/' : normalized.replace(/\/{2,}/g, '/');
}

function joinWithBasePath(baseUrl, routePath, query = '') {
    const basePath = String(baseUrl.pathname || '').replace(/^\/+|\/+$/g, '');
    const normalizedRoute = cleanRoutePath(routePath);
    const combinedPath = basePath ? `/${basePath}${normalizedRoute}` : normalizedRoute;
    const result = new URL(baseUrl.origin);
    result.pathname = combinedPath;
    result.search = query ? `?${query.replace(/^\?/, '')}` : '';
    return result.toString();
}

function parseAsUrl(value, fallbackBase) {
    try {
        return new URL(String(value || ''), fallbackBase);
    } catch (_error) {
        return null;
    }
}

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestWithRetry(url, init, retries = DEFAULT_RETRIES) {
    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return await fetch(url, {
                ...init,
                signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
            });
        } catch (error) {
            lastError = error;
            if (attempt < retries) {
                await sleep(500);
            }
        }
    }
    throw lastError || new Error(`Request failed for ${url}`);
}

function writeReport(outputPath, report) {
    if (!outputPath) {
        return;
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function areSearchParamsEqual(actualUrl, expectedUrl) {
    const actualEntries = [...actualUrl.searchParams.entries()].sort();
    const expectedEntries = [...expectedUrl.searchParams.entries()].sort();
    if (actualEntries.length !== expectedEntries.length) {
        return false;
    }
    for (let i = 0; i < actualEntries.length; i += 1) {
        if (actualEntries[i][0] !== expectedEntries[i][0]) return false;
        if (actualEntries[i][1] !== expectedEntries[i][1]) return false;
    }
    return true;
}

async function checkCanonicalRoutes(baseUrl, failures, checks) {
    const canonicalRoutes = [
        '/es/',
        '/en/',
        '/es/telemedicina/',
        '/en/telemedicine/',
        '/es/servicios/acne-rosacea/',
        '/en/services/acne-rosacea/',
        '/es/legal/privacidad/',
        '/en/legal/privacy/',
    ];

    for (const route of canonicalRoutes) {
        const url = joinWithBasePath(baseUrl, route);
        const response = await requestWithRetry(url, {
            method: 'GET',
            redirect: 'manual',
        });
        const ok = response.status >= 200 && response.status < 300;
        if (ok) {
            checks.push({
                type: 'canonical',
                route,
                status: 'passed',
                httpStatus: response.status,
            });
            console.log(`[routing-smoke] canonical OK ${route} -> ${response.status}`);
            continue;
        }

        const location = response.headers.get('location') || '';
        checks.push({
            type: 'canonical',
            route,
            status: 'failed',
            httpStatus: response.status,
            location,
        });
        failures.push(
            `Canonical route ${route} expected 2xx but got ${response.status}${
                location ? ` (location=${location})` : ''
            }`
        );
    }
}

async function checkRedirectRoutes(baseUrl, failures, checks) {
    const query = 'utm_source=routing_smoke&utm_medium=deploy&utm_campaign=sony_cutover';
    const redirects = [
        { from: '/', to: '/es/' },
        { from: '/index.html', to: '/es/' },
        { from: '/telemedicina.html', to: '/es/telemedicina/' },
        { from: '/servicios/acne-rosacea.html', to: '/es/servicios/acne-rosacea/' },
        { from: '/ninos/dermatologia-pediatrica.html', to: '/es/servicios/dermatologia-pediatrica/' },
        { from: '/terminos.html', to: '/es/legal/terminos/' },
    ];

    for (const rule of redirects) {
        const fromUrl = joinWithBasePath(baseUrl, rule.from, query);
        const expectedUrl = parseAsUrl(
            joinWithBasePath(baseUrl, rule.to, query),
            baseUrl.origin
        );

        const response = await requestWithRetry(fromUrl, {
            method: 'GET',
            redirect: 'manual',
        });
        if (response.status !== 301) {
            checks.push({
                type: 'redirect',
                route: rule.from,
                target: rule.to,
                status: 'failed',
                httpStatus: response.status,
            });
            failures.push(
                `Redirect ${rule.from} expected 301 but got ${response.status}`
            );
            continue;
        }

        const location = response.headers.get('location');
        if (!location) {
            checks.push({
                type: 'redirect',
                route: rule.from,
                target: rule.to,
                status: 'failed',
                httpStatus: response.status,
                location: '',
            });
            failures.push(`Redirect ${rule.from} returned 301 without Location header`);
            continue;
        }

        const actualUrl = parseAsUrl(location, fromUrl);
        if (!actualUrl) {
            checks.push({
                type: 'redirect',
                route: rule.from,
                target: rule.to,
                status: 'failed',
                httpStatus: response.status,
                location,
            });
            failures.push(`Redirect ${rule.from} returned invalid Location: ${location}`);
            continue;
        }

        if (actualUrl.pathname !== expectedUrl.pathname) {
            checks.push({
                type: 'redirect',
                route: rule.from,
                target: rule.to,
                status: 'failed',
                httpStatus: response.status,
                location: actualUrl.toString(),
            });
            failures.push(
                `Redirect ${rule.from} expected path ${expectedUrl.pathname} but got ${actualUrl.pathname}`
            );
            continue;
        }

        if (!areSearchParamsEqual(actualUrl, expectedUrl)) {
            checks.push({
                type: 'redirect',
                route: rule.from,
                target: rule.to,
                status: 'failed',
                httpStatus: response.status,
                location: actualUrl.toString(),
            });
            failures.push(
                `Redirect ${rule.from} did not preserve query params (${actualUrl.search} vs ${expectedUrl.search})`
            );
            continue;
        }

        const follow = await requestWithRetry(actualUrl.toString(), {
            method: 'GET',
            redirect: 'manual',
        });
        if (!(follow.status >= 200 && follow.status < 300)) {
            checks.push({
                type: 'redirect',
                route: rule.from,
                target: rule.to,
                status: 'failed',
                httpStatus: response.status,
                location: actualUrl.toString(),
                targetStatus: follow.status,
            });
            failures.push(
                `Redirect target ${actualUrl.pathname} expected 2xx but got ${follow.status}`
            );
            continue;
        }

        checks.push({
            type: 'redirect',
            route: rule.from,
            target: rule.to,
            status: 'passed',
            httpStatus: response.status,
            location: actualUrl.toString(),
            targetStatus: follow.status,
        });
        console.log(
            `[routing-smoke] redirect OK ${rule.from} -> ${actualUrl.pathname}${actualUrl.search}`
        );
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseInput = args.baseUrl || process.env.PUBLIC_BASE_URL || process.env.PROD_URL || '';
    const baseUrl = ensureUrl(baseInput);

    if (!baseUrl) {
        console.error(
            '[routing-smoke] Missing or invalid base URL. Use --base-url https://example.com'
        );
        process.exitCode = 2;
        return;
    }

    console.log(
        `[routing-smoke] Running ${args.label} checks against ${baseUrl.toString()}`
    );

    const failures = [];
    const checks = [];
    await checkCanonicalRoutes(baseUrl, failures, checks);
    await checkRedirectRoutes(baseUrl, failures, checks);

    const report = {
        label: args.label,
        baseUrl: baseUrl.toString(),
        generatedAt: new Date().toISOString(),
        passed: failures.length === 0,
        failures,
        checks,
    };
    writeReport(args.output, report);

    if (failures.length > 0) {
        console.error(
            `[routing-smoke] FAILED with ${failures.length} issue(s):`
        );
        for (const failure of failures) {
            console.error(` - ${failure}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log('[routing-smoke] All public routing checks passed.');
}

main().catch((error) => {
    console.error(`[routing-smoke] Unexpected error: ${error.message}`);
    process.exitCode = 1;
});
