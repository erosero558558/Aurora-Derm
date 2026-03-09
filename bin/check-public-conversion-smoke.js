#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    startLocalPublicServer,
    stopLocalPublicServer,
} = require('./lib/public-v6-local-server.js');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 2;

const HOME_ROUTES = [
    {
        route: '/es/',
        localeSwitchHref: '/en/',
        bookingStatusTitle: 'Reserva online en mantenimiento',
    },
    {
        route: '/en/',
        localeSwitchHref: '/es/',
        bookingStatusTitle: 'Online booking under maintenance',
    },
];

const HUB_ROUTES = ['/es/servicios/', '/en/services/'];
const SERVICE_ROUTES = [
    '/es/servicios/diagnostico-integral/',
    '/en/services/diagnostico-integral/',
];
const TELEMEDICINE_ROUTES = ['/es/telemedicina/', '/en/telemedicine/'];
const LEGAL_ROUTES = [
    { route: '/es/legal/privacidad/', returnHref: '/es/' },
    { route: '/en/legal/privacy/', returnHref: '/en/' },
];

function parseArgs(argv) {
    const args = { baseUrl: '', label: 'public-conversion', output: '' };
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
        }
    }
    return args;
}

function ensureUrl(value) {
    if (!value) return null;
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

function joinWithBasePath(baseUrl, routePath) {
    const basePath = String(baseUrl.pathname || '').replace(/^\/+|\/+$/g, '');
    const normalizedRoute = cleanRoutePath(routePath);
    const combinedPath = basePath
        ? `/${basePath}${normalizedRoute}`
        : normalizedRoute;
    const result = new URL(baseUrl.origin);
    result.pathname = combinedPath;
    return result.toString();
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
    if (!outputPath) return;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
        outputPath,
        `${JSON.stringify(report, null, 2)}\n`,
        'utf8'
    );
}

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function recordCheck(checks, entry) {
    checks.push(entry);
}

function recordFailure(failures, checks, route, detail, extra = {}) {
    failures.push(`Route ${route} ${detail}`);
    checks.push({
        route,
        status: 'failed',
        detail,
        ...extra,
    });
}

function recordPass(checks, route, detail, extra = {}) {
    checks.push({
        route,
        status: 'passed',
        detail,
        ...extra,
    });
}

async function fetchHtml(baseUrl, route) {
    const response = await requestWithRetry(joinWithBasePath(baseUrl, route), {
        method: 'GET',
        redirect: 'manual',
    });
    const html = await response.text();
    return { response, html };
}

function ensurePattern({
    route,
    html,
    checks,
    failures,
    pattern,
    detail,
    httpStatus,
}) {
    if (!pattern.test(html)) {
        recordFailure(failures, checks, route, `missing ${detail}`, {
            httpStatus,
        });
        return false;
    }
    recordPass(checks, route, `found ${detail}`, { httpStatus });
    return true;
}

async function checkHomeRoutes(baseUrl, checks, failures) {
    for (const item of HOME_ROUTES) {
        const { response, html } = await fetchHtml(baseUrl, item.route);
        if (!(response.status >= 200 && response.status < 300)) {
            recordFailure(
                failures,
                checks,
                item.route,
                `expected 2xx but got ${response.status}`,
                { httpStatus: response.status }
            );
            continue;
        }

        const patterns = [
            { pattern: /data-v6-header/iu, detail: 'data-v6-header' },
            { pattern: /data-v6-hero/iu, detail: 'data-v6-hero' },
            { pattern: /data-v6-news-strip/iu, detail: 'data-v6-news-strip' },
            {
                pattern: /data-v6-booking-status/iu,
                detail: 'data-v6-booking-status',
            },
            {
                pattern: new RegExp(
                    `href=["']${escapeRegExp(item.localeSwitchHref)}["']`,
                    'iu'
                ),
                detail: `language switch ${item.localeSwitchHref}`,
            },
            {
                pattern: new RegExp(
                    escapeRegExp(item.bookingStatusTitle),
                    'iu'
                ),
                detail: `booking status copy "${item.bookingStatusTitle}"`,
            },
        ];

        patterns.forEach((entry) =>
            ensurePattern({
                route: item.route,
                html,
                checks,
                failures,
                pattern: entry.pattern,
                detail: entry.detail,
                httpStatus: response.status,
            })
        );

        if (/#citas|appointmentForm|serviceSelect/iu.test(html)) {
            recordFailure(
                failures,
                checks,
                item.route,
                'still exposes legacy booking hooks',
                { httpStatus: response.status }
            );
        } else {
            recordPass(checks, item.route, 'legacy booking hooks removed', {
                httpStatus: response.status,
            });
        }
    }
}

async function checkStandardRoutes(baseUrl, routes, checks, failures, detail) {
    for (const route of routes) {
        const { response, html } = await fetchHtml(baseUrl, route);
        if (!(response.status >= 200 && response.status < 300)) {
            recordFailure(
                failures,
                checks,
                route,
                `expected 2xx but got ${response.status}`,
                { httpStatus: response.status }
            );
            continue;
        }

        if (/#citas|appointmentForm|serviceSelect/iu.test(html)) {
            recordFailure(
                failures,
                checks,
                route,
                `still exposes legacy booking hooks on ${detail}`,
                { httpStatus: response.status }
            );
            continue;
        }

        recordPass(
            checks,
            route,
            `2xx and no legacy booking hooks on ${detail}`,
            {
                httpStatus: response.status,
            }
        );
    }
}

async function checkTelemedicineRoutes(baseUrl, checks, failures) {
    for (const route of TELEMEDICINE_ROUTES) {
        const { response, html } = await fetchHtml(baseUrl, route);
        if (!(response.status >= 200 && response.status < 300)) {
            recordFailure(
                failures,
                checks,
                route,
                `expected 2xx but got ${response.status}`,
                { httpStatus: response.status }
            );
            continue;
        }

        ensurePattern({
            route,
            html,
            checks,
            failures,
            pattern: /data-v6-page-head/iu,
            detail: 'data-v6-page-head',
            httpStatus: response.status,
        });
        ensurePattern({
            route,
            html,
            checks,
            failures,
            pattern: /data-v6-booking-status/iu,
            detail: 'data-v6-booking-status',
            httpStatus: response.status,
        });

        const usefulCta =
            /https:\/\/wa\.me\/593982453672/iu.test(html) ||
            /data-v6-booking-status[\s\S]*?<a[^>]+href=["'](?!#|\/(?:en|es)\/#citas)([^"']+)["']/iu.test(
                html
            );
        if (!usefulCta) {
            recordFailure(
                failures,
                checks,
                route,
                'missing useful telemedicine CTA',
                { httpStatus: response.status }
            );
            continue;
        }

        if (/#citas|appointmentForm|serviceSelect/iu.test(html)) {
            recordFailure(
                failures,
                checks,
                route,
                'still exposes legacy booking hooks',
                { httpStatus: response.status }
            );
            continue;
        }

        recordPass(
            checks,
            route,
            'telemedicine CTA and booking freeze are coherent',
            {
                httpStatus: response.status,
            }
        );
    }
}

async function checkLegalRoutes(baseUrl, checks, failures) {
    for (const item of LEGAL_ROUTES) {
        const { response, html } = await fetchHtml(baseUrl, item.route);
        if (!(response.status >= 200 && response.status < 300)) {
            recordFailure(
                failures,
                checks,
                item.route,
                `expected 2xx but got ${response.status}`,
                { httpStatus: response.status }
            );
            continue;
        }

        ensurePattern({
            route: item.route,
            html,
            checks,
            failures,
            pattern: /data-v6-page-head/iu,
            detail: 'data-v6-page-head',
            httpStatus: response.status,
        });
        ensurePattern({
            route: item.route,
            html,
            checks,
            failures,
            pattern: new RegExp(
                `href=["']${escapeRegExp(item.returnHref)}["']`,
                'iu'
            ),
            detail: `return link ${item.returnHref}`,
            httpStatus: response.status,
        });
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    let baseUrl = ensureUrl(
        args.baseUrl ||
            process.env.PUBLIC_BASE_URL ||
            process.env.PROD_URL ||
            ''
    );
    let localServer = null;

    if (!baseUrl) {
        localServer = await startLocalPublicServer(ROOT);
        baseUrl = localServer.baseUrl;
        console.log(
            `[conversion-smoke] Using local public V6 server at ${baseUrl.toString()}`
        );
    }

    const checks = [];
    const failures = [];

    try {
        console.log(
            `[conversion-smoke] Running ${args.label} checks against ${baseUrl.toString()}`
        );

        await checkHomeRoutes(baseUrl, checks, failures);
        await checkStandardRoutes(
            baseUrl,
            HUB_ROUTES,
            checks,
            failures,
            'hub route'
        );
        await checkStandardRoutes(
            baseUrl,
            SERVICE_ROUTES,
            checks,
            failures,
            'service route'
        );
        await checkTelemedicineRoutes(baseUrl, checks, failures);
        await checkLegalRoutes(baseUrl, checks, failures);
    } finally {
        if (localServer) {
            await stopLocalPublicServer(localServer.server);
        }
    }

    const report = {
        label: args.label,
        baseUrl: baseUrl.toString(),
        generatedAt: new Date().toISOString(),
        passed: failures.length === 0,
        failures,
        checks,
    };
    writeReport(args.output, report);

    if (failures.length) {
        console.error(
            `[conversion-smoke] FAILED with ${failures.length} issue(s):`
        );
        failures.forEach((failure) =>
            console.error(`[conversion-smoke] - ${failure}`)
        );
        process.exitCode = 1;
        return;
    }

    console.log('[conversion-smoke] All public conversion checks passed.');
}

main().catch((error) => {
    console.error(
        `[conversion-smoke] Fatal error: ${
            error instanceof Error ? error.message : String(error)
        }`
    );
    process.exitCode = 1;
});
