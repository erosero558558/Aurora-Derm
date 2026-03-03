#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');

const LOCAL_HOST = '127.0.0.1';
const LOCAL_PORT = 8092;
const DEFAULT_TIMEOUT_MS = 30000;

const ROUTES = [
    { id: 'home-es', path: '/es/' },
    { id: 'home-en', path: '/en/' },
    { id: 'hub-es', path: '/es/servicios/' },
    { id: 'hub-en', path: '/en/services/' },
    { id: 'booking-es', path: '/es/servicios/#v5-booking' },
    { id: 'booking-en', path: '/en/services/#v5-booking' },
    { id: 'telemedicina-es', path: '/es/telemedicina/' },
    { id: 'telemedicine-en', path: '/en/telemedicine/' },
    {
        id: 'service-diagnostico-es',
        path: '/es/servicios/diagnostico-integral/',
    },
    {
        id: 'service-diagnostico-en',
        path: '/en/services/diagnostico-integral/',
    },
    { id: 'service-acne-es', path: '/es/servicios/acne-rosacea/' },
    { id: 'service-acne-en', path: '/en/services/acne-rosacea/' },
    { id: 'service-botox-es', path: '/es/servicios/botox/' },
    { id: 'service-botox-en', path: '/en/services/botox/' },
];

const VIEWPORTS = [
    {
        id: 'desktop',
        viewport: { width: 1440, height: 900 },
        isMobile: false,
        fullPage: true,
    },
    {
        id: 'mobile',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        fullPage: false,
    },
];

function parseArgs(argv) {
    const parsed = {
        baseUrl: '',
        outDir: path.join('verification', 'frontend-baseline'),
        label: '',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (token === '--base-url') {
            parsed.baseUrl = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
        if (token === '--out-dir') {
            parsed.outDir =
                String(argv[index + 1] || '').trim() || parsed.outDir;
            index += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[index + 1] || '').trim();
            index += 1;
            continue;
        }
    }

    return parsed;
}

function normalizeBaseUrl(input) {
    if (!input) {
        return null;
    }
    try {
        return new URL(input);
    } catch (_error) {
        return null;
    }
}

function nowStamp() {
    const date = new Date();
    const parts = [
        String(date.getUTCFullYear()).padStart(4, '0'),
        String(date.getUTCMonth() + 1).padStart(2, '0'),
        String(date.getUTCDate()).padStart(2, '0'),
        '-',
        String(date.getUTCHours()).padStart(2, '0'),
        String(date.getUTCMinutes()).padStart(2, '0'),
        String(date.getUTCSeconds()).padStart(2, '0'),
    ];
    return parts.join('');
}

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttpReady(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                signal: AbortSignal.timeout(1500),
            });
            if (response.status >= 200 && response.status < 500) {
                return true;
            }
        } catch (_error) {
            // Retry until timeout.
        }
        await sleep(350);
    }
    return false;
}

function startLocalPhpServer(repoRoot) {
    return spawn('php', ['-S', `${LOCAL_HOST}:${LOCAL_PORT}`, '-t', '.'], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
    });
}

function stopProcess(proc) {
    if (!proc || !proc.pid) {
        return;
    }
    if (process.platform === 'win32') {
        spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            shell: true,
        });
        return;
    }
    proc.kill('SIGTERM');
}

function joinRoute(baseUrl, routePath) {
    const basePath = String(baseUrl.pathname || '').replace(/^\/+|\/+$/g, '');
    const rawRoute = String(routePath || '/').trim() || '/';
    const hashIndex = rawRoute.indexOf('#');
    const routeWithoutHash =
        hashIndex >= 0 ? rawRoute.slice(0, hashIndex) : rawRoute;
    const routeHash = hashIndex >= 0 ? rawRoute.slice(hashIndex + 1) : '';
    const normalizedRoute = `/${routeWithoutHash.replace(/^\/+/, '')}`;
    const fullPath = basePath
        ? `/${basePath}${normalizedRoute}`
        : normalizedRoute;
    const target = new URL(baseUrl.origin);
    target.pathname = fullPath;
    if (routeHash) {
        target.hash = routeHash;
    }
    return target.toString();
}

async function captureRouteScreenshot(page, targetUrl, outputFile, fullPage) {
    await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_TIMEOUT_MS,
    });
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
        const styleId = 'visual-baseline-stabilizer';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                *, *::before, *::after {
                    animation: none !important;
                    transition: none !important;
                    caret-color: transparent !important;
                }
            `;
            document.head.appendChild(style);
        }

        ['#cookieBanner', '#chatbotWidget', '.quick-dock'].forEach(
            (selector) => {
                document.querySelectorAll(selector).forEach((node) => {
                    if (node instanceof HTMLElement) {
                        node.style.display = 'none';
                    }
                });
            }
        );
    });
    await page.screenshot({
        path: outputFile,
        fullPage,
        type: 'png',
    });
}

async function run() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    let baseUrl = normalizeBaseUrl(
        args.baseUrl || process.env.TEST_BASE_URL || ''
    );
    let serverProcess = null;

    if (!baseUrl) {
        baseUrl = new URL(`http://${LOCAL_HOST}:${LOCAL_PORT}`);
        console.log(
            `[baseline-capture] Starting local PHP server on ${baseUrl.toString()}`
        );
        serverProcess = startLocalPhpServer(repoRoot);
        serverProcess.stdout.on('data', (chunk) =>
            process.stdout.write(chunk.toString())
        );
        serverProcess.stderr.on('data', (chunk) =>
            process.stderr.write(chunk.toString())
        );

        const ready = await waitForHttpReady(
            joinRoute(baseUrl, '/es/'),
            DEFAULT_TIMEOUT_MS
        );
        if (!ready) {
            throw new Error('Local PHP server did not become ready in time');
        }
    }

    const stamp = args.label
        ? `${nowStamp()}-${args.label.replace(/[^a-zA-Z0-9_-]+/g, '-')}`
        : nowStamp();
    const outputRoot = path.resolve(repoRoot, args.outDir, stamp);
    fs.mkdirSync(outputRoot, { recursive: true });

    const manifest = {
        generatedAt: new Date().toISOString(),
        baseUrl: baseUrl.toString(),
        outputRoot: outputRoot,
        routes: [],
    };

    const launchOptions = { headless: true };
    if (process.env.GITHUB_ACTIONS === 'true') {
        launchOptions.args = ['--no-sandbox', '--disable-dev-shm-usage'];
    }

    const browser = await chromium.launch(launchOptions);
    try {
        for (const viewport of VIEWPORTS) {
            const viewportDir = path.join(outputRoot, viewport.id);
            fs.mkdirSync(viewportDir, { recursive: true });

            const context = await browser.newContext({
                viewport: viewport.viewport,
                isMobile: viewport.isMobile,
                hasTouch: viewport.isMobile,
                colorScheme: 'light',
                locale: 'es-EC',
                deviceScaleFactor: viewport.isMobile ? 3 : 1,
            });

            await context.addInitScript(() => {
                try {
                    localStorage.setItem(
                        'pa_cookie_consent_v1',
                        JSON.stringify({
                            status: 'accepted',
                            at: '2026-01-01T00:00:00.000Z',
                        })
                    );
                    localStorage.setItem('pa_hero_variant_v1', 'control');
                } catch (_error) {
                    // no-op
                }
            });

            for (const route of ROUTES) {
                const page = await context.newPage();
                try {
                    const targetUrl = joinRoute(baseUrl, route.path);
                    const filePath = path.join(viewportDir, `${route.id}.png`);
                    console.log(
                        `[baseline-capture] ${viewport.id} ${route.path} -> ${filePath}`
                    );
                    await captureRouteScreenshot(
                        page,
                        targetUrl,
                        filePath,
                        viewport.fullPage
                    );
                    manifest.routes.push({
                        viewport: viewport.id,
                        route: route.path,
                        file: path
                            .relative(outputRoot, filePath)
                            .replace(/\\/g, '/'),
                        status: 'ok',
                    });
                } catch (error) {
                    manifest.routes.push({
                        viewport: viewport.id,
                        route: route.path,
                        status: 'error',
                        error: error.message,
                    });
                    throw error;
                } finally {
                    await page.close();
                }
            }

            await context.close();
        }
    } finally {
        await browser.close();
        stopProcess(serverProcess);
    }

    const manifestPath = path.join(outputRoot, 'manifest.json');
    fs.writeFileSync(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );
    console.log(`[baseline-capture] Done. Manifest: ${manifestPath}`);
}

run().catch((error) => {
    console.error(`[baseline-capture] Failed: ${error.message}`);
    process.exitCode = 1;
});
