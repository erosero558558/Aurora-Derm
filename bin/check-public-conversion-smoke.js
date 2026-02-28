#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TIMEOUT_MS = 12000;
const DEFAULT_RETRIES = 2;

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

function hasMatch(text, pattern) {
    return pattern.test(String(text || ''));
}

function expectMatch(failures, route, html, pattern, description) {
    if (!hasMatch(html, pattern)) {
        failures.push(`Route ${route} missing ${description}`);
    }
}

async function fetchHtml(baseUrl, route, failures) {
    const url = joinWithBasePath(baseUrl, route);
    const response = await requestWithRetry(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept: 'text/html,*/*;q=0.8' },
    });
    if (!(response.status >= 200 && response.status < 300)) {
        failures.push(`Route ${route} expected 2xx but got ${response.status}`);
        return '';
    }
    return response.text();
}

async function checkHomeConversionHooks(baseUrl, failures) {
    const routeChecks = [
        {
            route: '/es/',
            lang: /<html[^>]+lang=["']es["']/i,
            bookingHref: /href=["']\/es\/#citas["']/i,
            switchHref: /class=["'][^"']*sony-lang[^"']*["'][^>]*href=["']\/en\//i,
        },
        {
            route: '/en/',
            lang: /<html[^>]+lang=["']en["']/i,
            bookingHref: /href=["']\/en\/#citas["']/i,
            switchHref: /class=["'][^"']*sony-lang[^"']*["'][^>]*href=["']\/es\//i,
        },
    ];
    const checks = [];

    for (const item of routeChecks) {
        const html = await fetchHtml(baseUrl, item.route, failures);
        if (!html) {
            checks.push({
                type: 'home',
                route: item.route,
                status: 'failed',
                issues: failures.filter((entry) => entry.includes(item.route)),
            });
            continue;
        }

        const beforeCount = failures.length;
        expectMatch(failures, item.route, html, item.lang, 'lang attribute');
        expectMatch(
            failures,
            item.route,
            html,
            /id=["']citas["']/i,
            'booking anchor #citas'
        );
        expectMatch(
            failures,
            item.route,
            html,
            /id=["']appointmentForm["']/i,
            'booking form #appointmentForm'
        );
        expectMatch(
            failures,
            item.route,
            html,
            /id=["']serviceSelect["']/i,
            'booking select #serviceSelect'
        );
        expectMatch(
            failures,
            item.route,
            html,
            /id=["']chatbotWidget["']/i,
            'chat mount #chatbotWidget'
        );
        expectMatch(
            failures,
            item.route,
            html,
            item.bookingHref,
            'primary booking CTA href'
        );
        expectMatch(
            failures,
            item.route,
            html,
            item.switchHref,
            'language switch href'
        );

        const routeIssues = failures.slice(beforeCount);
        checks.push({
            type: 'home',
            route: item.route,
            status: routeIssues.length === 0 ? 'passed' : 'failed',
            issues: routeIssues,
        });

        if (routeIssues.length === 0) {
            console.log(`[conversion-smoke] home OK ${item.route}`);
        }
    }

    return checks;
}

function serviceHrefPattern(hint) {
    return new RegExp(`href=["'][^"']*\\?service=${hint}#citas["']`, 'i');
}

async function checkServiceCtas(baseUrl, failures) {
    const routeChecks = [
        { route: '/es/servicios/botox/', hint: 'rejuvenecimiento' },
        { route: '/es/servicios/cancer-piel/', hint: 'cancer' },
        { route: '/en/services/botox/', hint: 'rejuvenecimiento' },
    ];
    const checks = [];

    for (const item of routeChecks) {
        const html = await fetchHtml(baseUrl, item.route, failures);
        if (!html) {
            checks.push({
                type: 'service_cta',
                route: item.route,
                status: 'failed',
                issues: failures.filter((entry) => entry.includes(item.route)),
            });
            continue;
        }

        const beforeCount = failures.length;
        expectMatch(
            failures,
            item.route,
            html,
            /data-analytics-event=["']start_booking_from_service["']/i,
            'service conversion analytics CTA'
        );
        expectMatch(
            failures,
            item.route,
            html,
            serviceHrefPattern(item.hint),
            `service booking hint ${item.hint}`
        );

        const routeIssues = failures.slice(beforeCount);
        checks.push({
            type: 'service_cta',
            route: item.route,
            status: routeIssues.length === 0 ? 'passed' : 'failed',
            issues: routeIssues,
            hint: item.hint,
        });

        if (routeIssues.length === 0) {
            console.log(`[conversion-smoke] service CTA OK ${item.route}`);
        }
    }

    return checks;
}

async function checkTelemedicineCtas(baseUrl, failures) {
    const routeChecks = [
        { route: '/es/telemedicina/', href: /href=["']\/es\/#citas["']/i },
        { route: '/en/telemedicine/', href: /href=["']\/en\/#citas["']/i },
    ];
    const checks = [];

    for (const item of routeChecks) {
        const html = await fetchHtml(baseUrl, item.route, failures);
        if (!html) {
            checks.push({
                type: 'telemedicine_cta',
                route: item.route,
                status: 'failed',
                issues: failures.filter((entry) => entry.includes(item.route)),
            });
            continue;
        }

        const beforeCount = failures.length;
        expectMatch(failures, item.route, html, item.href, 'telemedicine booking CTA');
        expectMatch(
            failures,
            item.route,
            html,
            /wa\.me\/593982453672/i,
            'telemedicine WhatsApp CTA'
        );

        const routeIssues = failures.slice(beforeCount);
        checks.push({
            type: 'telemedicine_cta',
            route: item.route,
            status: routeIssues.length === 0 ? 'passed' : 'failed',
            issues: routeIssues,
        });

        if (routeIssues.length === 0) {
            console.log(`[conversion-smoke] telemedicine CTA OK ${item.route}`);
        }
    }

    return checks;
}

async function checkLegalReturnLinks(baseUrl, failures) {
    const routeChecks = [
        { route: '/es/legal/privacidad/', back: /href=["']\/es\/["']/i },
        { route: '/en/legal/terms/', back: /href=["']\/en\/["']/i },
    ];
    const checks = [];

    for (const item of routeChecks) {
        const html = await fetchHtml(baseUrl, item.route, failures);
        if (!html) {
            checks.push({
                type: 'legal_return',
                route: item.route,
                status: 'failed',
                issues: failures.filter((entry) => entry.includes(item.route)),
            });
            continue;
        }

        const beforeCount = failures.length;
        expectMatch(failures, item.route, html, item.back, 'home return link');
        const routeIssues = failures.slice(beforeCount);
        checks.push({
            type: 'legal_return',
            route: item.route,
            status: routeIssues.length === 0 ? 'passed' : 'failed',
            issues: routeIssues,
        });
        if (routeIssues.length === 0) {
            console.log(`[conversion-smoke] legal return OK ${item.route}`);
        }
    }

    return checks;
}

async function checkPublicRuntimeConfig(baseUrl, failures) {
    const check = {
        type: 'runtime_config',
        route: '/api.php?resource=public-runtime-config',
        status: 'passed',
        issues: [],
    };
    const url = joinWithBasePath(baseUrl, '/api.php', 'resource=public-runtime-config');
    const response = await requestWithRetry(url, {
        method: 'GET',
        redirect: 'manual',
        headers: { accept: 'application/json' },
    });

    if (!(response.status >= 200 && response.status < 300)) {
        failures.push(
            `Route /api.php?resource=public-runtime-config expected 2xx but got ${response.status}`
        );
        check.status = 'failed';
        check.issues = failures.filter((entry) => entry.includes('public-runtime-config'));
        return check;
    }

    let payload;
    try {
        payload = await response.json();
    } catch (_error) {
        failures.push('public-runtime-config response is not valid JSON');
        check.status = 'failed';
        check.issues = failures.filter((entry) => entry.includes('public-runtime-config'));
        return check;
    }

    const data = payload && typeof payload === 'object' ? payload.data : null;
    if (!data || typeof data !== 'object') {
        failures.push('public-runtime-config missing data object');
        check.status = 'failed';
        check.issues = failures.filter((entry) => entry.includes('public-runtime-config'));
        return check;
    }
    const captcha = data.captcha;
    if (!captcha || typeof captcha !== 'object') {
        failures.push('public-runtime-config missing captcha object');
    }
    if (!Object.prototype.hasOwnProperty.call(data, 'features')) {
        failures.push('public-runtime-config missing features field');
    }
    if (!Object.prototype.hasOwnProperty.call(data, 'deployVersion')) {
        failures.push('public-runtime-config missing deployVersion field');
    }

    check.issues = failures.filter((entry) => entry.includes('public-runtime-config'));
    if (check.issues.length > 0) {
        check.status = 'failed';
    }

    if (check.status === 'passed') {
        console.log('[conversion-smoke] runtime config OK /api.php?resource=public-runtime-config');
    }

    return check;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const baseInput = args.baseUrl || process.env.PUBLIC_BASE_URL || process.env.PROD_URL || '';
    const baseUrl = ensureUrl(baseInput);

    if (!baseUrl) {
        console.error(
            '[conversion-smoke] Missing or invalid base URL. Use --base-url https://example.com'
        );
        process.exitCode = 2;
        return;
    }

    console.log(
        `[conversion-smoke] Running ${args.label} checks against ${baseUrl.toString()}`
    );

    const failures = [];
    const checks = [
        ...(await checkHomeConversionHooks(baseUrl, failures)),
        ...(await checkServiceCtas(baseUrl, failures)),
        ...(await checkTelemedicineCtas(baseUrl, failures)),
        ...(await checkLegalReturnLinks(baseUrl, failures)),
        await checkPublicRuntimeConfig(baseUrl, failures),
    ];

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
        console.error(`[conversion-smoke] FAILED with ${failures.length} issue(s):`);
        for (const failure of failures) {
            console.error(` - ${failure}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log('[conversion-smoke] All public conversion checks passed.');
}

main().catch((error) => {
    console.error(`[conversion-smoke] Unexpected error: ${error.message}`);
    process.exitCode = 1;
});
