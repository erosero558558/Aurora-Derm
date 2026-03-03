#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_OUT_DIR = path.join('verification', 'public-v5-audit');
const DEFAULT_LABEL = 'public-v5-surface';
// FE-V5-P18: full-surface IA includes expanded shell/footer density.
const DEFAULT_HOME_MAX_BLOCKS = 10;
const DEFAULT_HOME_MAX_LINKS = 56;
const DEFAULT_HUB_MAX_BLOCKS = 8;
const DEFAULT_HUB_MAX_LINKS = 52;

function parseArgs(argv) {
    const parsed = {
        outDir: DEFAULT_OUT_DIR,
        label: DEFAULT_LABEL,
        strict: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (token === '--out-dir') {
            parsed.outDir = String(argv[index + 1] || parsed.outDir).trim();
            index += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[index + 1] || parsed.label).trim();
            index += 1;
            continue;
        }
        if (token === '--strict') {
            parsed.strict = true;
        }
    }

    return parsed;
}

function nowStamp() {
    const date = new Date();
    return [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
        '-',
        String(date.getUTCHours()).padStart(2, '0'),
        String(date.getUTCMinutes()).padStart(2, '0'),
        String(date.getUTCSeconds()).padStart(2, '0'),
    ].join('');
}

function readJsonIfExists(filePath) {
    if (!fs.existsSync(filePath)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
        return null;
    }
}

function countMatches(value, pattern) {
    const matches = String(value || '').match(pattern);
    return matches ? matches.length : 0;
}

function extractVisibleText(html) {
    return String(html || '')
        .replace(/<script[\s\S]*?<\/script>/giu, ' ')
        .replace(/<style[\s\S]*?<\/style>/giu, ' ')
        .replace(/<[^>]+>/gu, ' ')
        .replace(/&nbsp;/gu, ' ')
        .replace(/&amp;/gu, '&')
        .replace(/\s+/gu, ' ')
        .trim();
}

function resolveRole(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/');
    if (normalized === 'es/index.html' || normalized === 'en/index.html') {
        return 'home';
    }
    if (
        normalized === 'es/servicios/index.html' ||
        normalized === 'en/services/index.html'
    ) {
        return 'hub';
    }
    if (
        /^es\/servicios\/[^/]+\/index\.html$/u.test(normalized) ||
        /^en\/services\/[^/]+\/index\.html$/u.test(normalized)
    ) {
        return 'service';
    }
    if (
        normalized === 'es/telemedicina/index.html' ||
        normalized === 'en/telemedicine/index.html'
    ) {
        return 'telemedicine';
    }
    if (
        /^es\/legal\/[^/]+\/index\.html$/u.test(normalized) ||
        /^en\/legal\/[^/]+\/index\.html$/u.test(normalized)
    ) {
        return 'legal';
    }
    return 'other';
}

function detectLocale(relativePath) {
    const normalized = String(relativePath || '').replace(/\\/g, '/');
    if (normalized.startsWith('es/')) return 'es';
    if (normalized.startsWith('en/')) return 'en';
    return '';
}

function collectHtmlFiles(rootDir) {
    const out = [];
    const queues = [path.join(rootDir, 'es'), path.join(rootDir, 'en')];

    while (queues.length > 0) {
        const current = queues.pop();
        if (!current || !fs.existsSync(current)) continue;

        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const target = path.join(current, entry.name);
            if (entry.isDirectory()) {
                queues.push(target);
                continue;
            }
            if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
                out.push(target);
            }
        }
    }

    return out.sort();
}

function analyzeRoute(filePath, rootDir) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const route = `/${relativePath.replace(/index\.html$/u, '')}`;
    const locale = detectLocale(relativePath);
    const role = resolveRole(relativePath);

    const html = fs.readFileSync(filePath, 'utf8');
    const text = extractVisibleText(html);

    const technicalTextMatches = countMatches(
        text,
        /\b(bridge|runtime|shell|v3|v4)\b/giu
    );
    const mixedLocaleMatches =
        locale === 'es'
            ? countMatches(
                  text,
                  /\b(adults?|seniors?|children|teenagers?)\b/giu
              )
            : locale === 'en'
              ? countMatches(
                    text,
                    /\b(adultos?|ninos|niños|adolescentes|adultos mayores)\b/giu
                )
              : 0;

    const localizedPriceTokenOk =
        role === 'service'
            ? locale === 'es'
                ? /\bIVA\b/u.test(text)
                : /\bTax\b/u.test(text)
            : true;

    return {
        file: relativePath,
        route,
        role,
        locale,
        sections: countMatches(html, /<section\b/giu),
        articles: countMatches(html, /<article\b/giu),
        links: countMatches(html, /<a\b/giu),
        buttons: countMatches(html, /<button\b/giu),
        h1: countMatches(html, /<h1\b/giu),
        hasBookingMount: /id=["']v5-booking["']/iu.test(html),
        hasPaymentModal: /id=["']v5-payment-modal["']/iu.test(html),
        hasServiceSelect: /id=["']v5-service-select["']/iu.test(html),
        technicalTextMatches,
        mixedLocaleMatches,
        localizedPriceTokenOk,
    };
}

function buildFailures(routes, limits) {
    const failures = [];

    routes.forEach((route) => {
        if (route.technicalTextMatches > 0) {
            failures.push({
                route: route.route,
                reason: 'technical_text_visible',
                value: route.technicalTextMatches,
            });
        }

        if (route.mixedLocaleMatches > 0) {
            failures.push({
                route: route.route,
                reason: 'mixed_locale_tokens_visible',
                value: route.mixedLocaleMatches,
            });
        }

        if (
            ['home', 'hub', 'service', 'telemedicine'].includes(route.role) &&
            route.h1 !== 1
        ) {
            failures.push({
                route: route.route,
                reason: 'invalid_h1_count',
                value: route.h1,
            });
        }

        if (route.role === 'service') {
            if (!route.hasBookingMount) {
                failures.push({
                    route: route.route,
                    reason: 'missing_booking_mount',
                    value: 'id="v5-booking"',
                });
            }
            if (!route.hasPaymentModal) {
                failures.push({
                    route: route.route,
                    reason: 'missing_payment_modal',
                    value: 'id="v5-payment-modal"',
                });
            }
            if (!route.hasServiceSelect) {
                failures.push({
                    route: route.route,
                    reason: 'missing_service_selector',
                    value: 'id="v5-service-select"',
                });
            }
            if (!route.localizedPriceTokenOk) {
                failures.push({
                    route: route.route,
                    reason: 'missing_localized_price_token',
                    value: route.locale === 'es' ? 'IVA' : 'Tax',
                });
            }
        }
    });

    const homeRoutes = routes.filter((item) => item.role === 'home');
    homeRoutes.forEach((route) => {
        if (route.sections > limits.homeMaxBlocks) {
            failures.push({
                route: route.route,
                reason: 'home_sections_exceed_limit',
                value: route.sections,
                expected: `<= ${limits.homeMaxBlocks}`,
            });
        }
        if (route.links > limits.homeMaxLinks) {
            failures.push({
                route: route.route,
                reason: 'home_links_exceed_limit',
                value: route.links,
                expected: `<= ${limits.homeMaxLinks}`,
            });
        }
    });

    const hubRoutes = routes.filter((item) => item.role === 'hub');
    hubRoutes.forEach((route) => {
        if (route.sections > limits.hubMaxBlocks) {
            failures.push({
                route: route.route,
                reason: 'hub_sections_exceed_limit',
                value: route.sections,
                expected: `<= ${limits.hubMaxBlocks}`,
            });
        }
        if (route.links > limits.hubMaxLinks) {
            failures.push({
                route: route.route,
                reason: 'hub_links_exceed_limit',
                value: route.links,
                expected: `<= ${limits.hubMaxLinks}`,
            });
        }
    });

    return failures;
}

function summarizeRoutes(routes) {
    const roles = {
        home: 0,
        hub: 0,
        service: 0,
        telemedicine: 0,
        legal: 0,
        other: 0,
    };

    let technicalTextMatches = 0;
    let mixedLocaleMatches = 0;
    let serviceWithBookingMount = 0;
    let serviceWithPaymentModal = 0;

    routes.forEach((route) => {
        roles[route.role] = (roles[route.role] || 0) + 1;
        technicalTextMatches += route.technicalTextMatches;
        mixedLocaleMatches += route.mixedLocaleMatches;
        if (route.role === 'service' && route.hasBookingMount) {
            serviceWithBookingMount += 1;
        }
        if (route.role === 'service' && route.hasPaymentModal) {
            serviceWithPaymentModal += 1;
        }
    });

    return {
        routeCount: routes.length,
        roles,
        technicalTextMatches,
        mixedLocaleMatches,
        serviceWithBookingMount,
        serviceWithPaymentModal,
    };
}

function writeReport(runDir, payload) {
    const jsonPath = path.join(runDir, 'surface-audit.json');
    const mdPath = path.join(runDir, 'surface-audit.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const lines = [
        '# Public V5 Surface Audit',
        '',
        `- Generated At: ${payload.generatedAt}`,
        `- Strict Mode: ${payload.strict ? 'true' : 'false'}`,
        `- Result: ${payload.passed ? 'PASS' : 'FAIL'}`,
        '',
        '## Summary',
        '',
        `- Routes: ${payload.summary.routeCount}`,
        `- Home routes: ${payload.summary.roles.home}`,
        `- Hub routes: ${payload.summary.roles.hub}`,
        `- Service routes: ${payload.summary.roles.service}`,
        `- Technical text matches: ${payload.summary.technicalTextMatches}`,
        `- Mixed locale matches: ${payload.summary.mixedLocaleMatches}`,
        `- Service routes with booking mount: ${payload.summary.serviceWithBookingMount}/${payload.summary.roles.service}`,
        `- Service routes with payment modal: ${payload.summary.serviceWithPaymentModal}/${payload.summary.roles.service}`,
        '',
        '## Limits',
        '',
        `- Home max sections: ${payload.limits.homeMaxBlocks}`,
        `- Home max links: ${payload.limits.homeMaxLinks}`,
        `- Hub max sections: ${payload.limits.hubMaxBlocks}`,
        `- Hub max links: ${payload.limits.hubMaxLinks}`,
        '',
        '## Failures',
        '',
    ];

    if (payload.failures.length === 0) {
        lines.push('- None');
    } else {
        payload.failures.forEach((failure) => {
            const expected = failure.expected
                ? ` (expected ${failure.expected})`
                : '';
            lines.push(
                `- ${failure.route} :: ${failure.reason} :: ${failure.value}${expected}`
            );
        });
    }

    lines.push('');
    lines.push('## Route Metrics');
    lines.push('');

    payload.routes.forEach((route) => {
        lines.push(`### ${route.route}`);
        lines.push(`- role: ${route.role}`);
        lines.push(`- sections: ${route.sections}`);
        lines.push(`- articles: ${route.articles}`);
        lines.push(`- links: ${route.links}`);
        lines.push(`- buttons: ${route.buttons}`);
        lines.push(`- h1: ${route.h1}`);
        lines.push(`- technical_text_matches: ${route.technicalTextMatches}`);
        lines.push(`- mixed_locale_matches: ${route.mixedLocaleMatches}`);
        lines.push(
            `- has_booking_mount: ${route.hasBookingMount ? 'yes' : 'no'}`
        );
        lines.push(
            `- has_payment_modal: ${route.hasPaymentModal ? 'yes' : 'no'}`
        );
        lines.push('');
    });

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const catalogPath = path.join(
        repoRoot,
        'content',
        'public-v5',
        'catalog.json'
    );
    const catalog = readJsonIfExists(catalogPath);

    const limits = {
        homeMaxBlocks: Math.max(
            DEFAULT_HOME_MAX_BLOCKS,
            Number(catalog?.home_contract?.max_primary_blocks ?? 0)
        ),
        homeMaxLinks: DEFAULT_HOME_MAX_LINKS,
        hubMaxBlocks: DEFAULT_HUB_MAX_BLOCKS,
        hubMaxLinks: DEFAULT_HUB_MAX_LINKS,
    };

    const files = collectHtmlFiles(repoRoot);
    const routes = files.map((filePath) => analyzeRoute(filePath, repoRoot));
    const failures = buildFailures(routes, limits);
    const summary = summarizeRoutes(routes);

    const runDir = path.resolve(
        args.outDir,
        `${nowStamp()}-${String(args.label || DEFAULT_LABEL).replace(
            /[^a-zA-Z0-9_-]+/gu,
            '-'
        )}`
    );
    fs.mkdirSync(runDir, { recursive: true });

    const payload = {
        generatedAt: new Date().toISOString(),
        strict: args.strict,
        limits,
        passed: failures.length === 0,
        summary,
        failures,
        routes,
    };

    const report = writeReport(runDir, payload);
    const relJson = path
        .relative(repoRoot, report.jsonPath)
        .replace(/\\/g, '/');
    const relMd = path.relative(repoRoot, report.mdPath).replace(/\\/g, '/');

    process.stdout.write(
        [
            `Public V5 surface audit: ${payload.passed ? 'PASS' : 'FAIL'}`,
            `Routes: ${summary.routeCount}`,
            `Failures: ${failures.length}`,
            'Artifacts:',
            `- ${relJson}`,
            `- ${relMd}`,
            '',
        ].join('\n')
    );

    if (args.strict && failures.length > 0) {
        process.exitCode = 1;
    }
}

main();
