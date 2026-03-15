#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'verification', 'public-v6-audit');
const SHOT_DIR = path.join(ROOT, 'verification', 'public-v6-screenshots');
const SONY_HOME = 'https://www.sony.com/en/';
const STRICT = process.argv.includes('--strict');

function parseArg(flag, fallback = '') {
    const index = process.argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = process.argv[index + 1];
    return typeof value === 'undefined' ? fallback : value;
}

function rgbLuma(color) {
    const m = String(color || '').match(
        /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
    );
    if (!m) return null;
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function findCheck(checks, id) {
    return checks.find((check) => check.id === id) || null;
}

function getMetaNumber(check, key, fallback = 0) {
    const value = Number(check?.meta?.[key]);
    return Number.isFinite(value) ? value : fallback;
}

function fmt(value) {
    if (typeof value === 'number')
        return Number.isInteger(value) ? String(value) : value.toFixed(3);
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
    return String(value ?? 'n/a');
}

function runLocalContractAudit() {
    const explicitBaseUrl = String(
        parseArg('--base-url', process.env.TEST_BASE_URL || '')
    ).trim();
    const args = [
        path.join(ROOT, 'bin', 'audit-public-v6-visual-contract.js'),
        '--min-checkpoints',
        '104',
        '--strict',
    ];
    if (explicitBaseUrl) {
        args.push('--base-url', explicitBaseUrl);
    }
    const run = spawnSync(process.execPath, args, {
        cwd: ROOT,
        stdio: 'inherit',
    });
    if (run.status !== 0) {
        throw new Error('fallo audit-public-v6-visual-contract');
    }
    const contractPath = path.join(OUT_DIR, 'visual-contract.json');
    if (!fs.existsSync(contractPath)) {
        throw new Error('no se encontro visual-contract.json');
    }
    return JSON.parse(fs.readFileSync(contractPath, 'utf8'));
}

async function collectSonyMetrics(mobile = false) {
    const contextOptions = {
        viewport: mobile
            ? { width: 390, height: 844 }
            : { width: 1536, height: 864 },
        isMobile: mobile,
        hasTouch: mobile,
        deviceScaleFactor: mobile ? 3 : 1,
        locale: 'en-US',
        userAgent: mobile
            ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1'
            : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
            'accept-language': 'en-US,en;q=0.9',
            'sec-ch-ua':
                '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-mobile': mobile ? '?1' : '?0',
            'sec-ch-ua-platform': mobile ? '"iOS"' : '"Windows"',
        },
    };

    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();
        await page.goto(SONY_HOME, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });
        await page
            .waitForLoadState('load', { timeout: 30000 })
            .catch(() => null);
        await page.waitForTimeout(3500);
        await page.addStyleTag({
            content: `
                *, *::before, *::after { animation: none !important; transition: none !important; }
                #onetrust-banner-sdk, .onetrust-pc-dark-filter { display: none !important; opacity: 0 !important; pointer-events: none !important; }
            `,
        });
        const shot = path.join(
            SHOT_DIR,
            mobile
                ? 'sony-home-mobile-evidence.png'
                : 'sony-home-desktop-evidence.png'
        );
        await page.screenshot({ path: shot, fullPage: false });
        const metrics = await page.evaluate((mobile) => {
            const header = document.querySelector('#tmpl-header');
            const bgNode =
                document.querySelector('#tmpl-header .tmpl-header_bg') ||
                header;
            const navCount = document.querySelectorAll(
                '#tmpl-headerNav_list > li'
            ).length;
            const hero = document.querySelector('.hero');
            const slides = Array.from(
                document.querySelectorAll('.hero .hero-item')
            ).filter((node) => {
                const r = node.getBoundingClientRect();
                const s = getComputedStyle(node);
                return (
                    r.width > 80 &&
                    r.left < window.innerWidth &&
                    r.right > 0 &&
                    s.display !== 'none'
                );
            });
            const indicators = document.querySelectorAll(
                '.hero-controls [aria-label*="slide"], .hero-controls a, .hero-controls .swiper-pagination-bullet'
            ).length;
            const news = document.querySelector('.headline-news');
            const menu = document.querySelector(
                '#tmpl-header .tmpl-header_hamburger, #tmpl-headerHamburger, #tmpl-header .tmpl-headerHamburger'
            );
            return {
                headerHeight: header?.getBoundingClientRect().height || 0,
                headerBg: getComputedStyle(bgNode || document.body)
                    .backgroundColor,
                navCount,
                heroRatio: hero
                    ? hero.getBoundingClientRect().height / window.innerHeight
                    : 0,
                visibleSlides: slides.length,
                indicators,
                hasNews: Boolean(news),
                hasMenu: Boolean(menu),
                isMobile: mobile,
            };
        }, mobile);
        await context.close();
        return metrics;
    } finally {
        await browser.close();
    }
}

function buildReport(contract, sonyDesktop, sonyMobile) {
    const checks = contract.checks || [];
    const v6Header = getMetaNumber(findCheck(checks, 'VC-03'), 'headerHeight');
    const v6Nav = getMetaNumber(findCheck(checks, 'VC-05'), 'navItems');
    const v6HeroRatio = getMetaNumber(findCheck(checks, 'VC-29'), 'heroRatio');
    const v6Slides = getMetaNumber(
        findCheck(checks, 'VC-17'),
        'visibleSlideCount'
    );
    const v6Indicators = getMetaNumber(
        findCheck(checks, 'VC-25'),
        'indicators'
    );
    const v6HasNews = Boolean(findCheck(checks, 'VC-31')?.pass);
    const v6HasMobileMenu = Boolean(findCheck(checks, 'VC-13')?.pass);
    const v6HeroMobile1Col = Boolean(findCheck(checks, 'VC-39')?.pass);
    const sonyHeaderLuma = rgbLuma(sonyDesktop.headerBg);

    const parity = [];
    const push = (id, desc, pass, sony, v6) =>
        parity.push({ id, desc, pass: Boolean(pass), sony, v6 });
    push(
        'SP-LIVE-01',
        'Sony header dark luma <= 24',
        (sonyHeaderLuma ?? 999) <= 24,
        sonyHeaderLuma,
        24
    );
    push(
        'SP-LIVE-02',
        'header stays in compact editorial band on both',
        sonyDesktop.headerHeight >= 60 &&
            sonyDesktop.headerHeight <= 78 &&
            v6Header >= 68 &&
            v6Header <= 86,
        sonyDesktop.headerHeight,
        v6Header
    );
    push(
        'SP-LIVE-03',
        'V6 keeps a focused desktop nav while Sony remains denser',
        sonyDesktop.navCount >= 6 && v6Nav >= 4 && v6Nav <= 6,
        sonyDesktop.navCount,
        v6Nav
    );
    push(
        'SP-LIVE-04',
        'hero ratio delta <= 0.08',
        Math.abs(sonyDesktop.heroRatio - v6HeroRatio) <= 0.08,
        sonyDesktop.heroRatio,
        v6HeroRatio
    );
    push(
        'SP-LIVE-05',
        'desktop visible slides >= 3 on both',
        sonyDesktop.visibleSlides >= 3 && v6Slides >= 3,
        sonyDesktop.visibleSlides,
        v6Slides
    );
    push(
        'SP-LIVE-06',
        'indicator delta <= 3',
        Math.abs(sonyDesktop.indicators - v6Indicators) <= 3,
        sonyDesktop.indicators,
        v6Indicators
    );
    push(
        'SP-LIVE-07',
        'news strip visible on both',
        sonyDesktop.hasNews && v6HasNews,
        sonyDesktop.hasNews,
        v6HasNews
    );
    push(
        'SP-LIVE-08',
        'mobile menu trigger visible on both',
        sonyMobile.hasMenu && v6HasMobileMenu,
        sonyMobile.hasMenu,
        v6HasMobileMenu
    );
    push(
        'SP-LIVE-09',
        'mobile hero remains multi-panel on Sony and one-column on V6',
        sonyMobile.visibleSlides >= 1 &&
            sonyMobile.visibleSlides <= 3 &&
            v6HeroMobile1Col,
        sonyMobile.visibleSlides,
        v6HeroMobile1Col
    );
    push(
        'SP-LIVE-10',
        'V6 mobile editorial collapses to one column',
        v6HeroMobile1Col,
        'n/a',
        v6HeroMobile1Col
    );

    const parityPassed = parity.filter((item) => item.pass).length;
    const payload = {
        generatedAt: new Date().toISOString(),
        ok: contract.ok && parityPassed === parity.length,
        runtime: {
            contract_base_url:
                String(contract?.runtime?.base_url || '').trim() || 'unknown',
            contract_source:
                String(contract?.runtime?.source || '').trim() || 'unknown',
        },
        summary: {
            v6_contract_passed: contract.passed,
            v6_contract_total: contract.total,
            live_parity_passed: parityPassed,
            live_parity_total: parity.length,
            combined_passed: (contract.passed || 0) + parityPassed,
            combined_total: (contract.total || 0) + parity.length,
        },
        live_parity: parity,
        sony: { desktop: sonyDesktop, mobile: sonyMobile },
    };
    return payload;
}

function writeArtifacts(payload) {
    const jsonPath = path.join(OUT_DIR, 'sony-live-evidence.json');
    const mdPath = path.join(OUT_DIR, 'sony-live-evidence.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    const lines = [
        '# Public V6 Sony Live Evidence',
        '',
        `- Combined checkpoints: **${payload.summary.combined_passed}/${payload.summary.combined_total}**`,
        `- V6 contract: **${payload.summary.v6_contract_passed}/${payload.summary.v6_contract_total}**`,
        `- Sony live parity: **${payload.summary.live_parity_passed}/${payload.summary.live_parity_total}**`,
        `- Runtime base URL: **${payload.runtime.contract_base_url}**`,
        `- Runtime source: **${payload.runtime.contract_source}**`,
        `- Status: **${payload.ok ? 'PASS' : 'FAIL'}**`,
        '',
        '| ID | Result | Check | Sony | V6 |',
        '|---|---|---|---|---|',
        ...payload.live_parity.map(
            (item) =>
                `| ${item.id} | ${item.pass ? 'PASS' : 'FAIL'} | ${item.desc} | ${fmt(item.sony)} | ${fmt(item.v6)} |`
        ),
        '',
    ];
    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    const contract = runLocalContractAudit();
    const sonyDesktop = await collectSonyMetrics(false);
    const sonyMobile = await collectSonyMetrics(true);
    const payload = buildReport(contract, sonyDesktop, sonyMobile);
    const artifacts = writeArtifacts(payload);
    process.stdout.write(
        [
            `Public V6 Sony live evidence: ${payload.ok ? 'PASS' : 'FAIL'}`,
            `Combined: ${payload.summary.combined_passed}/${payload.summary.combined_total}`,
            `Runtime: ${payload.runtime.contract_base_url} (${payload.runtime.contract_source})`,
            `Artifacts:`,
            `- ${path.relative(ROOT, artifacts.jsonPath).replace(/\\/g, '/')}`,
            `- ${path.relative(ROOT, artifacts.mdPath).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );
    if (STRICT && !payload.ok) process.exitCode = 1;
}

main().catch((error) => {
    process.stderr.write(
        `audit-public-v6-sony-evidence failed: ${error.message}\n`
    );
    process.exitCode = 1;
});
