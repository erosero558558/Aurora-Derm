#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BASELINE = 42;
const DEFAULT_MIN_SCORE = 82;
const DEFAULT_MIN_CHECKPOINTS = 12;

const ROUTE_MAP = [
    {
        route: '/es/',
        role: 'home',
        locale: 'es',
        file: path.join('es', 'index.html'),
    },
    {
        route: '/en/',
        role: 'home',
        locale: 'en',
        file: path.join('en', 'index.html'),
    },
    {
        route: '/es/servicios/',
        role: 'hub',
        locale: 'es',
        file: path.join('es', 'servicios', 'index.html'),
    },
    {
        route: '/en/services/',
        role: 'hub',
        locale: 'en',
        file: path.join('en', 'services', 'index.html'),
    },
    {
        route: '/es/servicios/acne-rosacea/',
        role: 'service',
        locale: 'es',
        file: path.join('es', 'servicios', 'acne-rosacea', 'index.html'),
    },
    {
        route: '/en/services/acne-rosacea/',
        role: 'service',
        locale: 'en',
        file: path.join('en', 'services', 'acne-rosacea', 'index.html'),
    },
    {
        route: '/es/telemedicina/',
        role: 'telemedicine',
        locale: 'es',
        file: path.join('es', 'telemedicina', 'index.html'),
    },
    {
        route: '/en/telemedicine/',
        role: 'telemedicine',
        locale: 'en',
        file: path.join('en', 'telemedicine', 'index.html'),
    },
];

const V5_PAGE_SOURCE_FILES = [
    path.join('src', 'apps', 'astro', 'src', 'pages', 'es', 'index.astro'),
    path.join('src', 'apps', 'astro', 'src', 'pages', 'en', 'index.astro'),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'es',
        'servicios',
        'index.astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'en',
        'services',
        'index.astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'es',
        'servicios',
        '[slug].astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'en',
        'services',
        '[slug].astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'es',
        'telemedicina',
        'index.astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'en',
        'telemedicine',
        'index.astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'es',
        'legal',
        '[slug].astro'
    ),
    path.join(
        'src',
        'apps',
        'astro',
        'src',
        'pages',
        'en',
        'legal',
        '[slug].astro'
    ),
];
const V5_CONTENT_SOURCE_FILE = path.join(
    'src',
    'apps',
    'astro',
    'src',
    'lib',
    'content.js'
);

function parseArgs(argv) {
    const parsed = {
        outDir: path.join('verification', 'sony-score'),
        label: 'public-v5-sony',
        minScore: Number.NaN,
        baseline: DEFAULT_BASELINE,
        minCheckpoints: DEFAULT_MIN_CHECKPOINTS,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '');
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
        if (token === '--min-score') {
            parsed.minScore = Number(argv[index + 1]);
            index += 1;
            continue;
        }
        if (token === '--baseline') {
            parsed.baseline = Number(argv[index + 1]);
            index += 1;
            continue;
        }
        if (token === '--min-checkpoints') {
            parsed.minCheckpoints = Number(argv[index + 1]);
            index += 1;
        }
    }

    if (!Number.isFinite(parsed.baseline)) {
        parsed.baseline = DEFAULT_BASELINE;
    }

    if (!Number.isFinite(parsed.minCheckpoints)) {
        parsed.minCheckpoints = DEFAULT_MIN_CHECKPOINTS;
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

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function round(value, decimals = 2) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function readText(filePath) {
    return fs.readFileSync(filePath, 'utf8');
}

function countMatches(raw, pattern) {
    const matches = String(raw || '').match(pattern);
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

function normalizeAvg(items, key) {
    if (!Array.isArray(items) || items.length === 0) {
        return 0;
    }
    const sum = items.reduce((acc, item) => acc + Number(item[key] || 0), 0);
    return sum / items.length;
}

function densityBandScore(metric, goodMax, hardMax, weight) {
    if (metric <= goodMax) return weight;
    if (metric >= hardMax) return 0;
    const ratio = 1 - (metric - goodMax) / (hardMax - goodMax);
    return round(weight * clamp(ratio, 0, 1), 2);
}

function escapeRegex(raw) {
    return String(raw || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasTemplateBlock(html, blockId) {
    const safeId = escapeRegex(blockId);
    return new RegExp(`data-template-block=["']${safeId}["']`, 'iu').test(html);
}

function getRouteByPath(routes, routePath) {
    return routes.find((route) => route.route === routePath) || null;
}

function buildRouteMetrics(repoRoot) {
    return ROUTE_MAP.map((item) => {
        const filePath = path.join(repoRoot, item.file);
        const html = readText(filePath);
        const text = extractVisibleText(html);
        const technicalMatches = countMatches(
            text,
            /\b(bridge|runtime|shell|v3|v4)\b/giu
        );
        const hasLocalizedPriceToken =
            item.locale === 'es'
                ? /\bIVA\b/u.test(text)
                : /\bTax\b/u.test(text);
        const templateIdMatch = html.match(
            /data-public-template-id=["']([^"']+)["']/iu
        );

        return {
            ...item,
            file: item.file.replace(/\\/g, '/'),
            html,
            text,
            templateId: templateIdMatch
                ? String(templateIdMatch[1] || '').trim()
                : '',
            sections: countMatches(html, /<section\b/giu),
            articles: countMatches(html, /<article\b/giu),
            links: countMatches(html, /<a\b/giu),
            buttons: countMatches(html, /<button\b/giu),
            h1: countMatches(html, /<h1\b/giu),
            technicalMatches,
            hasBooking: /id=["']citas["']/iu.test(html),
            hasPaymentModal: /id=["']paymentModal["']/iu.test(html),
            hasServiceSelect: /id=["']serviceSelect["']/iu.test(html),
            hasPriceToken: hasLocalizedPriceToken,
            hasAssetLicense: /data-asset-license=["'][^"']+["']/iu.test(html),
            hasCitasAnchor: /href=["'][^"']*#citas["']/iu.test(html),
            hasUnsplashAsset: /images\.unsplash\.com/iu.test(html),
            homeDoctorCards: countMatches(
                html,
                /class=["'][^"']*sony-home-doctor[^"']*["']/giu
            ),
            textLength: text.length,
        };
    });
}

function auditV5SourceDebt(repoRoot) {
    const forbiddenPatterns = [
        /lib\/public-v3\.js/iu,
        /components\/public-v3\//iu,
    ];
    const findings = [];

    V5_PAGE_SOURCE_FILES.forEach((relativeFilePath) => {
        const filePath = path.join(repoRoot, relativeFilePath);
        const source = readText(filePath);
        const patternHits = forbiddenPatterns
            .filter((pattern) => pattern.test(source))
            .map((pattern) => pattern.toString());

        if (patternHits.length > 0) {
            findings.push({
                file: relativeFilePath.replace(/\\/g, '/'),
                patternHits,
            });
        }
    });

    return {
        totalFiles: V5_PAGE_SOURCE_FILES.length,
        findings,
        pass: findings.length === 0,
    };
}

function auditV5CanonicalContentSource(repoRoot) {
    const filePath = path.join(repoRoot, V5_CONTENT_SOURCE_FILE);
    const source = readText(filePath);

    const checks = [
        {
            id: 'has_v5_services_lookup',
            pass: /data\.v5Catalog\?\.services/iu.test(source),
            detail: 'getServices reads from v5Catalog.services',
        },
        {
            id: 'no_v4_services_fallback',
            pass: !/v4Catalog\?\.services/iu.test(source),
            detail: 'no fallback to v4Catalog.services',
        },
        {
            id: 'no_v4_booking_fallback',
            pass: !/getV5Catalog\(\)\s*\|\|\s*getV4Catalog\(\)/iu.test(source),
            detail: 'no fallback getV5Catalog() || getV4Catalog()',
        },
        {
            id: 'no_v4_assets_fallback',
            pass: !/getV5AssetsManifest\(\)\s*\|\|\s*getV4AssetsManifest\(\)/iu.test(
                source
            ),
            detail: 'no fallback getV5AssetsManifest() || getV4AssetsManifest()',
        },
    ];

    return {
        file: V5_CONTENT_SOURCE_FILE.replace(/\\/g, '/'),
        checks,
        pass: checks.every((item) => item.pass),
        failures: checks.filter((item) => !item.pass).map((item) => item.id),
    };
}

function scoreComposition(routes) {
    const home = routes.filter((route) => route.role === 'home');
    const hub = routes.filter((route) => route.role === 'hub');
    const service = routes.filter((route) => route.role === 'service');

    const homeDensity =
        normalizeAvg(home, 'sections') + normalizeAvg(home, 'links') / 8;
    const hubDensity =
        normalizeAvg(hub, 'sections') + normalizeAvg(hub, 'links') / 8;
    const serviceDensity =
        normalizeAvg(service, 'sections') +
        normalizeAvg(service, 'buttons') / 5 +
        normalizeAvg(service, 'links') / 16;

    const homeScore = densityBandScore(homeDensity, 9.2, 14.2, 10);
    const hubScore = densityBandScore(hubDensity, 7.8, 12.8, 10);
    const serviceScore = densityBandScore(serviceDensity, 14.5, 20.5, 10);

    return {
        score: round(homeScore + hubScore + serviceScore, 2),
        detail: {
            homeScore,
            hubScore,
            serviceScore,
            homeDensity: round(homeDensity, 2),
            hubDensity: round(hubDensity, 2),
            serviceDensity: round(serviceDensity, 2),
        },
    };
}

function scoreTypography(cssV5, tokensCss, shellAstro) {
    const hasLocalFontFace = /@font-face/iu.test(tokensCss);
    const hasFontToken =
        /--public-v5-font:\s*'Plus Jakarta Sans'/iu.test(tokensCss) &&
        /font-family:\s*var\(--public-v5-font/iu.test(cssV5);
    const hasNegativeTracking =
        countMatches(cssV5, /letter-spacing:\s*-[0-9.]+em/giu) >= 6;
    const hasFontPreload =
        /rel=["']preload["'][^>]+plus-jakarta-sans\.woff2/iu.test(shellAstro);

    let score = 0;
    if (hasLocalFontFace) score += 6;
    if (hasFontToken) score += 5;
    if (hasNegativeTracking) score += 5;
    if (hasFontPreload) score += 4;

    return {
        score,
        detail: {
            hasLocalFontFace,
            hasFontToken,
            hasNegativeTracking,
            hasFontPreload,
        },
    };
}

function scoreTone(routes) {
    const totalTechnicalMatches = routes.reduce(
        (acc, route) => acc + route.technicalMatches,
        0
    );
    const serviceText = routes
        .filter((route) => route.role === 'service')
        .map((route) => route.text.toLowerCase())
        .join(' ');

    const trustTerms = [
        'evidence',
        'evidencia',
        'cautelas',
        'caution',
        'booking',
        'reserva',
        'clinical',
        'clinica',
        'price',
        'precio',
        'tax',
        'iva',
    ];
    const trustHits = trustTerms.reduce((acc, term) => {
        return acc + (serviceText.includes(term) ? 1 : 0);
    }, 0);

    const localizedPriceRoutes = routes
        .filter((route) => route.role === 'service')
        .filter((route) => route.hasPriceToken).length;

    const technicalScore =
        totalTechnicalMatches === 0
            ? 10
            : Math.max(0, round(10 - totalTechnicalMatches * 0.75, 2));
    const trustScore = round(
        clamp((trustHits / trustTerms.length) * 6, 0, 6),
        2
    );
    const localizationScore = round(
        clamp((localizedPriceRoutes / 2) * 4, 0, 4),
        2
    );

    return {
        score: round(technicalScore + trustScore + localizationScore, 2),
        detail: {
            totalTechnicalMatches,
            trustHits,
            trustTermsTotal: trustTerms.length,
            localizedPriceRoutes,
            technicalScore,
            trustScore,
            localizationScore,
        },
    };
}

function scoreMotion(motionCss, cssV5) {
    const hasReducedMotion =
        /@media\s*\(prefers-reduced-motion:\s*reduce\)/iu.test(motionCss) ||
        /@media\s*\(prefers-reduced-motion:\s*reduce\)/iu.test(cssV5);
    const hasMeaningfulTransitions =
        countMatches(cssV5, /transition:/giu) >= 10;
    const hasStaggeredVisualHints =
        /@keyframes\s+publicV5SectionRise/iu.test(cssV5) &&
        /main\s*>\s*section:nth-of-type\(2\)/iu.test(cssV5) &&
        /main\s*>\s*section:nth-of-type\(3\)/iu.test(cssV5);

    let score = 0;
    if (hasReducedMotion) score += 4;
    if (hasMeaningfulTransitions) score += 3;
    if (hasStaggeredVisualHints) score += 3;

    return {
        score,
        detail: {
            hasReducedMotion,
            hasMeaningfulTransitions,
            hasStaggeredVisualHints,
        },
    };
}

function scoreClarity(routes) {
    const h1PassCount = routes.filter((route) => route.h1 === 1).length;
    const hasBookingAndPaymentEveryService = routes
        .filter((route) => route.role === 'service')
        .every((route) => route.hasBooking && route.hasPaymentModal);

    const homeRoutes = routes.filter((route) => route.role === 'home');
    const avgHomeLinks = normalizeAvg(homeRoutes, 'links');
    const avgHomeButtons = normalizeAvg(homeRoutes, 'buttons');
    const ctaDensityScore = densityBandScore(
        avgHomeLinks + avgHomeButtons * 0.8,
        23,
        34,
        6
    );

    const h1Score = round(clamp((h1PassCount / routes.length) * 8, 0, 8), 2);
    const bookingScore = hasBookingAndPaymentEveryService ? 6 : 0;

    return {
        score: round(h1Score + bookingScore + ctaDensityScore, 2),
        detail: {
            h1PassCount,
            routeCount: routes.length,
            hasBookingAndPaymentEveryService,
            avgHomeLinks: round(avgHomeLinks, 2),
            avgHomeButtons: round(avgHomeButtons, 2),
            h1Score,
            bookingScore,
            ctaDensityScore,
        },
    };
}

function buildCheckpoint(id, label, pass, evidence) {
    return {
        id,
        label,
        status: pass ? 'PASS' : 'FAIL',
        pass,
        evidence,
    };
}

function buildSonyCheckpoints(
    routes,
    cssV5,
    tokensCss,
    shellAstro,
    motionCss,
    layoutCss,
    sourceAudit,
    canonicalSourceAudit
) {
    const homeEs = getRouteByPath(routes, '/es/');
    const homeEn = getRouteByPath(routes, '/en/');
    const hubEs = getRouteByPath(routes, '/es/servicios/');
    const hubEn = getRouteByPath(routes, '/en/services/');
    const serviceEs = getRouteByPath(routes, '/es/servicios/acne-rosacea/');
    const serviceEn = getRouteByPath(routes, '/en/services/acne-rosacea/');
    const teleEs = getRouteByPath(routes, '/es/telemedicina/');
    const teleEn = getRouteByPath(routes, '/en/telemedicine/');

    function routeHasBlocks(route, blocks) {
        if (!route) return false;
        return blocks.every((blockId) => hasTemplateBlock(route.html, blockId));
    }

    const coreRoutes = routes.filter((route) =>
        ['home', 'hub', 'service', 'telemedicine'].includes(route.role)
    );
    const homeRoutes = [homeEs, homeEn].filter(Boolean);
    const hubRoutes = [hubEs, hubEn].filter(Boolean);
    const contentRoutes = routes.filter((route) =>
        ['home', 'hub', 'service'].includes(route.role)
    );
    const technicalMatches = routes.reduce(
        (acc, route) => acc + route.technicalMatches,
        0
    );

    const items = [
        buildCheckpoint(
            'CP-01',
            'Home blocks canonicos en ES/EN (hero, paths, authority, pricing, booking)',
            routeHasBlocks(homeEs, [
                'home_hero_v5',
                'home_paths_v5',
                'home_authority_v5',
                'home_pricing_v5',
                'home_booking_v5',
            ]) &&
                routeHasBlocks(homeEn, [
                    'home_hero_v5',
                    'home_paths_v5',
                    'home_authority_v5',
                    'home_pricing_v5',
                    'home_booking_v5',
                ]),
            'data-template-block home_*_v5'
        ),
        buildCheckpoint(
            'CP-02',
            'Hub blocks canonicos en ES/EN (hero, grid, booking teaser)',
            routeHasBlocks(hubEs, [
                'hub_hero_v5',
                'hub_grid_v5',
                'booking_teaser_v5',
            ]) &&
                routeHasBlocks(hubEn, [
                    'hub_hero_v5',
                    'hub_grid_v5',
                    'booking_teaser_v5',
                ]),
            'data-template-block hub_* + booking_teaser_v5'
        ),
        buildCheckpoint(
            'CP-03',
            'Service detail blocks canonicos en ES/EN (hero, fit, evidence, related, booking)',
            routeHasBlocks(serviceEs, [
                'service_hero_v5',
                'service_fit_v5',
                'service_evidence_v5',
                'service_related_v5',
                'service_booking_v5',
            ]) &&
                routeHasBlocks(serviceEn, [
                    'service_hero_v5',
                    'service_fit_v5',
                    'service_evidence_v5',
                    'service_related_v5',
                    'service_booking_v5',
                ]),
            'data-template-block service_*_v5 + service_booking_v5'
        ),
        buildCheckpoint(
            'CP-04',
            'Telemedicine blocks canonicos en ES/EN (hero, flow, fit, escalation, booking)',
            routeHasBlocks(teleEs, [
                'tele_hero_v5',
                'tele_flow_v5',
                'tele_fit_v5',
                'tele_escalation_v5',
                'booking_teaser_v5',
            ]) &&
                routeHasBlocks(teleEn, [
                    'tele_hero_v5',
                    'tele_flow_v5',
                    'tele_fit_v5',
                    'tele_escalation_v5',
                    'booking_teaser_v5',
                ]),
            'data-template-block tele_*_v5'
        ),
        buildCheckpoint(
            'CP-05',
            'No hay texto tecnico interno visible',
            technicalMatches === 0,
            `technical_matches=${technicalMatches}`
        ),
        buildCheckpoint(
            'CP-06',
            'Cada ruta core tiene exactamente 1 h1',
            coreRoutes.every((route) => route.h1 === 1),
            `h1_counts=${coreRoutes.map((route) => `${route.route}:${route.h1}`).join(', ')}`
        ),
        buildCheckpoint(
            'CP-07',
            'Home respeta densidad editorial (sections<=6, links<=30)',
            [homeEs, homeEn].every(
                (route) => route && route.sections <= 6 && route.links <= 30
            ),
            `home_sections_links=${[homeEs, homeEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.sections}/${route.links}`
                        : 'missing'
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-08',
            'Hub respeta densidad editorial (sections<=7, links<=30)',
            [hubEs, hubEn].every(
                (route) => route && route.sections <= 7 && route.links <= 30
            ),
            `hub_sections_links=${[hubEs, hubEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.sections}/${route.links}`
                        : 'missing'
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-09',
            'Booking/Pago V5 activo en service ES/EN (citas, paymentModal, serviceSelect)',
            [serviceEs, serviceEn].every(
                (route) =>
                    route &&
                    route.hasBooking &&
                    route.hasPaymentModal &&
                    route.hasServiceSelect
            ),
            `service_shell=${[serviceEs, serviceEn]
                .map((route) =>
                    route
                        ? `${route.route}:booking=${route.hasBooking},payment=${route.hasPaymentModal},select=${route.hasServiceSelect}`
                        : 'missing'
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-10',
            'Token de precio localizado presente en home/hub/service ES/EN',
            contentRoutes.every((route) => route.hasPriceToken),
            `price_tokens=${contentRoutes
                .map(
                    (route) =>
                        `${route.route}:${route.hasPriceToken ? 'ok' : 'missing'}`
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-11',
            'Fundacion tipografica V5 (font-face, token, tracking, preload)',
            /@font-face/iu.test(tokensCss) &&
                /--public-v5-font:\s*'Plus Jakarta Sans'/iu.test(tokensCss) &&
                /letter-spacing:\s*-[0-9.]+em/iu.test(cssV5) &&
                /plus-jakarta-sans\.woff2/iu.test(shellAstro),
            'tokens.css + components.css + PublicShellV5.astro'
        ),
        buildCheckpoint(
            'CP-12',
            'Motion editorial V5 (stagger + reduced-motion)',
            /@keyframes\s+publicV5SectionRise/iu.test(cssV5) &&
                /main\s*>\s*section:nth-of-type\(2\)/iu.test(cssV5) &&
                (/prefers-reduced-motion:\s*reduce/iu.test(cssV5) ||
                    /prefers-reduced-motion:\s*reduce/iu.test(motionCss)),
            'components.css + public-v3-motion.css'
        ),
        buildCheckpoint(
            'CP-13',
            'Banda de autoridad medica visible (>=2 perfiles por locale en home)',
            [homeEs, homeEn].every(
                (route) => route && route.homeDoctorCards >= 2
            ),
            `doctor_cards=${[homeEs, homeEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.homeDoctorCards}`
                        : 'missing'
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-14',
            'Assets hero con metadata de licencia en rutas core',
            coreRoutes.every((route) => route.hasAssetLicense),
            `asset_license=${coreRoutes
                .map(
                    (route) =>
                        `${route.route}:${route.hasAssetLicense ? 'ok' : 'missing'}`
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-15',
            'Continuidad de CTA a #citas en rutas core',
            coreRoutes.every((route) => route.hasCitasAnchor),
            `citas_anchors=${coreRoutes
                .map(
                    (route) =>
                        `${route.route}:${route.hasCitasAnchor ? 'ok' : 'missing'}`
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-16',
            'Rutas V5 no importan capas public-v3 directamente',
            sourceAudit.pass,
            sourceAudit.pass
                ? `files=${sourceAudit.totalFiles}, hits=0`
                : `files=${sourceAudit.totalFiles}, hits=${sourceAudit.findings.length}, offenders=${sourceAudit.findings
                      .map((item) => item.file)
                      .join(', ')}`
        ),
        buildCheckpoint(
            'CP-17',
            'Runtime content V5 sin fallback V4 en services/booking/assets',
            canonicalSourceAudit.pass,
            canonicalSourceAudit.pass
                ? `file=${canonicalSourceAudit.file}, checks=${canonicalSourceAudit.checks.length}, failures=0`
                : `file=${canonicalSourceAudit.file}, failures=${canonicalSourceAudit.failures.join(', ')}`
        ),
        buildCheckpoint(
            'CP-18',
            'Template ID canonico V5 presente en rutas core',
            coreRoutes.every(
                (route) =>
                    String(route.templateId || '').trim().length > 0 &&
                    /(?:^|_)v5$/iu.test(String(route.templateId || '').trim())
            ),
            `template_ids=${coreRoutes
                .map(
                    (route) => `${route.route}:${route.templateId || 'missing'}`
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-19',
            'Densidad service/tele en banda editorial (service<=12/30/12, tele<=10/26)',
            [serviceEs, serviceEn].every(
                (route) =>
                    route &&
                    route.sections <= 12 &&
                    route.links <= 30 &&
                    route.buttons <= 12
            ) &&
                [teleEs, teleEn].every(
                    (route) =>
                        route && route.sections <= 10 && route.links <= 26
                ),
            `service=${[serviceEs, serviceEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.sections}/${route.links}/${route.buttons}`
                        : 'missing'
                )
                .join(', ')} | tele=${[teleEs, teleEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.sections}/${route.links}`
                        : 'missing'
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-20',
            'Rutas core sin assets remotos de Unsplash',
            coreRoutes.every((route) => !route.hasUnsplashAsset),
            `unsplash_assets=${coreRoutes
                .map(
                    (route) =>
                        `${route.route}:${route.hasUnsplashAsset ? 'present' : 'none'}`
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-21',
            'Tokens visuales Sony P13 (palette neutral + stage + accent) aplicados',
            /--public-v5-bg:\s*#f5f6f8/iu.test(tokensCss) &&
                /--public-v5-ink:\s*#0a0a0a/iu.test(tokensCss) &&
                /--public-v5-stage:\s*#07090d/iu.test(tokensCss) &&
                /--public-v5-accent:\s*#2d5bff/iu.test(tokensCss),
            'tokens.css palette checkpoint'
        ),
        buildCheckpoint(
            'CP-22',
            'Shell visual P13 en heroes/surfaces (dark stage + white editorial surface)',
            /FE-V5-P13: Sony canonical visual refinement/iu.test(cssV5) &&
                /background:\s*linear-gradient\(170deg,\s*#07090d\s*0%,\s*#0f141d\s*100%\)/iu.test(
                    cssV5
                ) &&
                /body\[data-public-shell-version='v5'\]\s+\.sony-home-paths[\s\S]*?background:\s*#ffffff;/iu.test(
                    cssV5
                ),
            'components.css FE-V5-P13 markers'
        ),
        buildCheckpoint(
            'CP-23',
            'Shell P14 con precision Sony (nav underline + CTA monocrhomo + legal contrast)',
            /FE-V5-P14: Sony shell precision/iu.test(layoutCss) &&
                /\.public-nav__link::after/iu.test(layoutCss) &&
                /body\[data-public-shell-version='v5'\]\s+\.public-nav__cta[\s\S]*?background:\s*#0b0d12;/iu.test(
                    layoutCss
                ) &&
                /\.public-footer__legal a:hover[\s\S]*?color:\s*#ffffff;/iu.test(
                    layoutCss
                ),
            'layout.css FE-V5-P14 markers'
        ),
        buildCheckpoint(
            'CP-24',
            'Ritmo editorial P14 (spacing template blocks + motion hero calm rise)',
            /FE-V5-P14: Sony editorial rhythm \+ restrained motion/iu.test(
                cssV5
            ) &&
                /main\s*>\s*section\[data-template-block\]/iu.test(cssV5) &&
                /@keyframes\s+publicV5HeroCalmRise/iu.test(cssV5) &&
                /animation:\s*publicV5HeroCalmRise/iu.test(cssV5),
            'components.css FE-V5-P14 rhythm markers'
        ),
        buildCheckpoint(
            'CP-25',
            'Home P15 con jerarquia CTA limpia (quiet links y sin secondary button CTA)',
            homeRoutes.every(
                (route) =>
                    countMatches(
                        route.html,
                        /class=["'][^"']*sony-quiet-link[^"']*["']/giu
                    ) >= 2 &&
                    countMatches(
                        route.html,
                        /hero-stage__cta--secondary/giu
                    ) === 0
            ),
            `home_cta_cleanup=${homeRoutes
                .map((route) => {
                    const quietLinks = countMatches(
                        route.html,
                        /class=["'][^"']*sony-quiet-link[^"']*["']/giu
                    );
                    const secondaryCtas = countMatches(
                        route.html,
                        /hero-stage__cta--secondary/giu
                    );
                    return `${route.route}:quiet=${quietLinks},secondary=${secondaryCtas}`;
                })
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-26',
            'Hub P15 sin CTA duplicado de familia (count badge + card routing)',
            hubRoutes.every(
                (route) =>
                    countMatches(
                        route.html,
                        /data-entry-surface=["']v5_hub_family_route["']/giu
                    ) === 0 &&
                    countMatches(
                        route.html,
                        /class=["'][^"']*sony-hub-family__count[^"']*["']/giu
                    ) >= 2
            ),
            `hub_dedupe=${hubRoutes
                .map((route) => {
                    const familyRouteCtas = countMatches(
                        route.html,
                        /data-entry-surface=["']v5_hub_family_route["']/giu
                    );
                    const familyCountBadges = countMatches(
                        route.html,
                        /class=["'][^"']*sony-hub-family__count[^"']*["']/giu
                    );
                    return `${route.route}:family_cta=${familyRouteCtas},count_badges=${familyCountBadges}`;
                })
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-27',
            'Densidad P16 strict en Home/Hub (home<=5/20, hub<=3/22)',
            [homeEs, homeEn].every(
                (route) => route && route.sections <= 5 && route.links <= 20
            ) &&
                [hubEs, hubEn].every(
                    (route) => route && route.sections <= 3 && route.links <= 22
                ),
            `home=${[homeEs, homeEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.sections}/${route.links}`
                        : 'missing'
                )
                .join(', ')} | hub=${[hubEs, hubEn]
                .map((route) =>
                    route
                        ? `${route.route}:${route.sections}/${route.links}`
                        : 'missing'
                )
                .join(', ')}`
        ),
        buildCheckpoint(
            'CP-28',
            'Paridad editorial P16 (policy note + affordance consistente public-link-arrow/quiet-link)',
            /FE-V5-P16: editorial labels \+ link affordance parity/iu.test(
                cssV5
            ) &&
                /\.sony-home-pricing__policy-note[\s\S]*?text-transform:\s*uppercase;/iu.test(
                    cssV5
                ) &&
                /\.public-link-arrow[\s\S]*?font-size:\s*0\.82rem;[\s\S]*?text-transform:\s*uppercase;/iu.test(
                    cssV5
                ) &&
                /\.sony-quiet-link[\s\S]*?font-size:\s*0\.82rem;[\s\S]*?text-transform:\s*uppercase;/iu.test(
                    cssV5
                ),
            'components.css FE-V5-P16 markers'
        ),
    ];

    const passed = items.filter((item) => item.pass).length;
    const failed = items.length - passed;

    return {
        total: items.length,
        passed,
        failed,
        items,
    };
}

function pruneRouteForReport(route) {
    return {
        route: route.route,
        role: route.role,
        locale: route.locale,
        file: route.file,
        templateId: route.templateId,
        sections: route.sections,
        articles: route.articles,
        links: route.links,
        buttons: route.buttons,
        h1: route.h1,
        technicalMatches: route.technicalMatches,
        hasBooking: route.hasBooking,
        hasPaymentModal: route.hasPaymentModal,
        hasServiceSelect: route.hasServiceSelect,
        hasPriceToken: route.hasPriceToken,
        hasAssetLicense: route.hasAssetLicense,
        hasCitasAnchor: route.hasCitasAnchor,
        hasUnsplashAsset: route.hasUnsplashAsset,
    };
}

function writeReport(runDir, payload) {
    const jsonPath = path.join(runDir, 'sony-score.json');
    const mdPath = path.join(runDir, 'sony-score.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    const lines = [
        '# Public V5 Sony Similarity Score',
        '',
        `- Generated At: ${payload.generatedAt}`,
        `- Score: ${payload.score.total}/100`,
        `- Baseline: ${payload.baseline}`,
        `- Delta: ${payload.delta >= 0 ? '+' : ''}${payload.delta}`,
        `- Score Threshold (${payload.threshold}): ${payload.passesScoreThreshold ? 'PASS' : 'FAIL'}`,
        `- Checkpoint Gate (${payload.checkpoints.passed}/${payload.checkpoints.total} >= ${payload.checkpoints.minRequired}): ${payload.checkpoints.passesThreshold ? 'PASS' : 'FAIL'}`,
        `- Final Gate: ${payload.passesThreshold ? 'PASS' : 'FAIL'}`,
        '',
        '## Rubric',
        '',
        `- Composition (30): ${payload.score.composition}`,
        `- Typography (20): ${payload.score.typography}`,
        `- Tone (20): ${payload.score.tone}`,
        `- Motion (10): ${payload.score.motion}`,
        `- Clarity (20): ${payload.score.clarity}`,
        '',
        '## Sony Checkpoints',
        '',
    ];

    payload.checkpoints.items.forEach((item) => {
        lines.push(`- ${item.id} [${item.status}] ${item.label}`);
        lines.push(`  evidence: ${item.evidence}`);
    });

    lines.push('');
    lines.push('## Route Metrics');
    lines.push('');

    payload.routes.forEach((route) => {
        lines.push(`### ${route.route}`);
        lines.push(`- role: ${route.role}`);
        lines.push(`- template_id: ${route.templateId || 'n/a'}`);
        lines.push(`- sections: ${route.sections}`);
        lines.push(`- articles: ${route.articles}`);
        lines.push(`- links: ${route.links}`);
        lines.push(`- buttons: ${route.buttons}`);
        lines.push(`- h1: ${route.h1}`);
        lines.push(`- technical_matches: ${route.technicalMatches}`);
        lines.push(`- has_booking: ${route.hasBooking ? 'yes' : 'no'}`);
        lines.push(
            `- has_payment_modal: ${route.hasPaymentModal ? 'yes' : 'no'}`
        );
        lines.push(
            `- has_service_select: ${route.hasServiceSelect ? 'yes' : 'no'}`
        );
        lines.push(
            `- localized_price_token: ${route.hasPriceToken ? 'yes' : 'no'}`
        );
        lines.push(
            `- has_asset_license: ${route.hasAssetLicense ? 'yes' : 'no'}`
        );
        lines.push(
            `- has_citas_anchor: ${route.hasCitasAnchor ? 'yes' : 'no'}`
        );
        lines.push(
            `- has_unsplash_asset: ${route.hasUnsplashAsset ? 'yes' : 'no'}`
        );
        lines.push('');
    });

    lines.push('## Source Debt Audit');
    lines.push('');
    lines.push(`- files_scanned: ${payload.sourceAudit.totalFiles}`);
    lines.push(`- findings: ${payload.sourceAudit.findings.length}`);
    if (payload.sourceAudit.findings.length > 0) {
        payload.sourceAudit.findings.forEach((finding) => {
            lines.push(`- ${finding.file}`);
            lines.push(`  patterns: ${finding.patternHits.join(', ')}`);
        });
    }

    lines.push('');
    lines.push('## Canonical Source Audit');
    lines.push('');
    lines.push(`- file: ${payload.canonicalSourceAudit.file}`);
    lines.push(
        `- result: ${payload.canonicalSourceAudit.pass ? 'PASS' : 'FAIL'}`
    );
    lines.push(`- checks: ${payload.canonicalSourceAudit.checks.length}`);
    payload.canonicalSourceAudit.checks.forEach((check) => {
        lines.push(`- ${check.id}: ${check.pass ? 'PASS' : 'FAIL'}`);
    });

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const labelSafe = String(args.label || 'public-v5-sony').replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
    );
    const runDir = path.resolve(args.outDir, `${nowStamp()}-${labelSafe}`);
    fs.mkdirSync(runDir, { recursive: true });

    const routes = buildRouteMetrics(repoRoot);
    const componentsCss = readText(
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'styles',
            'public-v5',
            'components.css'
        )
    );
    const tokensCss = readText(
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'styles',
            'public-v5',
            'tokens.css'
        )
    );
    const motionCss = readText(
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'styles',
            'public-v3-motion.css'
        )
    );
    const layoutCss = readText(
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'styles',
            'public-v5',
            'layout.css'
        )
    );
    const shellAstro = readText(
        path.join(
            repoRoot,
            'src',
            'apps',
            'astro',
            'src',
            'layouts',
            'PublicShellV5.astro'
        )
    );

    const composition = scoreComposition(routes);
    const typography = scoreTypography(componentsCss, tokensCss, shellAstro);
    const tone = scoreTone(routes);
    const motion = scoreMotion(motionCss, componentsCss);
    const clarity = scoreClarity(routes);
    const sourceAudit = auditV5SourceDebt(repoRoot);
    const canonicalSourceAudit = auditV5CanonicalContentSource(repoRoot);

    const total = round(
        composition.score +
            typography.score +
            tone.score +
            motion.score +
            clarity.score,
        2
    );

    const threshold = Number.isFinite(args.minScore)
        ? args.minScore
        : DEFAULT_MIN_SCORE;
    const sonyCheckpoints = buildSonyCheckpoints(
        routes,
        componentsCss,
        tokensCss,
        shellAstro,
        motionCss,
        layoutCss,
        sourceAudit,
        canonicalSourceAudit
    );
    const minCheckpoints = Math.max(
        1,
        Math.min(sonyCheckpoints.total, Math.floor(args.minCheckpoints))
    );
    const passesScoreThreshold = total >= threshold;
    const passesCheckpointThreshold = sonyCheckpoints.passed >= minCheckpoints;
    const passesThreshold = passesScoreThreshold && passesCheckpointThreshold;

    const payload = {
        generatedAt: new Date().toISOString(),
        baseline: args.baseline,
        threshold,
        passesThreshold,
        passesScoreThreshold,
        delta: round(total - args.baseline, 2),
        score: {
            total,
            composition: composition.score,
            typography: typography.score,
            tone: tone.score,
            motion: motion.score,
            clarity: clarity.score,
        },
        detail: {
            composition: composition.detail,
            typography: typography.detail,
            tone: tone.detail,
            motion: motion.detail,
            clarity: clarity.detail,
        },
        checkpoints: {
            ...sonyCheckpoints,
            minRequired: minCheckpoints,
            passesThreshold: passesCheckpointThreshold,
        },
        routes: routes.map(pruneRouteForReport),
        sourceAudit,
        canonicalSourceAudit,
    };

    const files = writeReport(runDir, payload);

    process.stdout.write(
        [
            `Sony similarity score: ${payload.score.total}/100`,
            `Score threshold (${threshold}): ${passesScoreThreshold ? 'PASS' : 'FAIL'}`,
            `Checkpoint gate (${sonyCheckpoints.passed}/${sonyCheckpoints.total}, min ${minCheckpoints}): ${passesCheckpointThreshold ? 'PASS' : 'FAIL'}`,
            `Final gate: ${payload.passesThreshold ? 'PASS' : 'FAIL'}`,
            `Artifacts:`,
            `- ${path.relative(repoRoot, files.jsonPath).replace(/\\/g, '/')}`,
            `- ${path.relative(repoRoot, files.mdPath).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );

    if (!payload.passesThreshold) {
        process.exitCode = 1;
    }
}

main();
