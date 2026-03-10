#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');

const DEFAULT_LOCAL_HOST = process.env.TEST_LOCAL_SERVER_HOST || '127.0.0.1';
const DEFAULT_LOCAL_PORT = Number(process.env.TEST_LOCAL_SERVER_PORT || '8011');
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_DEBUG_PORT = 9229;

function parseArgs(argv) {
    const parsed = {
        baseUrl: '',
        outDir: path.join('verification', 'performance-gate'),
        label: 'public-performance',
        routes: [
            '/es/',
            '/en/',
            '/es/servicios/',
            '/en/services/',
            '/es/servicios/acne-rosacea/',
            '/en/services/acne-rosacea/',
            '/es/telemedicina/',
            '/en/telemedicine/',
        ],
        thresholds: {
            performance: Number(process.env.PERF_SCORE_MIN || '0.85'),
            accessibility: Number(process.env.A11Y_SCORE_MIN || '0.95'),
            bestPractices: Number(process.env.BEST_SCORE_MIN || '0.9'),
            seo: Number(process.env.SEO_SCORE_MIN || '0.9'),
            lcpMs: Number(process.env.LCP_MAX_MS || '2500'),
            cls: Number(process.env.CLS_MAX || '0.1'),
            inpMs: Number(process.env.INP_MAX_MS || '200'),
        },
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
            parsed.label = String(argv[index + 1] || '').trim() || parsed.label;
            index += 1;
            continue;
        }
        if (token === '--routes') {
            const raw = String(argv[index + 1] || '').trim();
            if (raw) {
                parsed.routes = raw
                    .split(',')
                    .map((entry) => String(entry || '').trim())
                    .filter(Boolean);
            }
            index += 1;
            continue;
        }
    }

    return parsed;
}

function safeUrl(input) {
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

function resolveChromiumPath() {
    if (process.env.CHROME_PATH) {
        return process.env.CHROME_PATH;
    }

    try {
        const { chromium } = require('playwright');
        if (chromium && typeof chromium.executablePath === 'function') {
            return chromium.executablePath();
        }
    } catch (_error) {
        return '';
    }

    return '';
}

function killProcess(proc) {
    if (!proc || !proc.pid) {
        return;
    }
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], {
            stdio: 'ignore',
            shell: true,
        });
        return;
    }
    proc.kill('SIGTERM');
}

async function sleep(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPort(host, port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const connected = await new Promise((resolve) => {
            const socket = net.connect({ host, port });
            socket.setTimeout(1500);
            socket.once('connect', () => {
                socket.destroy();
                resolve(true);
            });
            socket.once('timeout', () => {
                socket.destroy();
                resolve(false);
            });
            socket.once('error', () => resolve(false));
        });
        if (connected) {
            return true;
        }
        await sleep(200);
    }
    return false;
}

async function startChromeSession(chromePath, profileDir, debugPort) {
    fs.mkdirSync(profileDir, { recursive: true });
    const chromeProcess = spawn(
        chromePath,
        [
            `--remote-debugging-port=${debugPort}`,
            `--user-data-dir=${profileDir}`,
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-dev-shm-usage',
            'about:blank',
        ],
        {
            stdio: 'ignore',
            shell: false,
        }
    );

    const chromeReady = await waitForPort('127.0.0.1', debugPort, 15000);
    if (!chromeReady) {
        killProcess(chromeProcess);
        throw new Error(`Chrome debug port ${debugPort} did not open.`);
    }

    return chromeProcess;
}

function requestOnce(urlString) {
    return new Promise((resolve) => {
        const url = new URL(urlString);
        const client = url.protocol === 'https:' ? https : http;
        const request = client.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port,
                path: `${url.pathname}${url.search}`,
                method: 'GET',
                timeout: 1500,
            },
            (response) => {
                response.resume();
                resolve(
                    response.statusCode >= 200 && response.statusCode < 500
                );
            }
        );
        request.on('timeout', () => {
            request.destroy();
            resolve(false);
        });
        request.on('error', () => resolve(false));
        request.end();
    });
}

async function waitForHttpReady(urlString, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ok = await requestOnce(urlString);
        if (ok) {
            return true;
        }
        await sleep(350);
    }
    return false;
}

function startLocalPhpServer(repoRoot, host, port) {
    return spawn('php', ['-S', `${host}:${port}`, '-t', '.'], {
        cwd: repoRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
    });
}

function joinRoute(baseUrl, routePath) {
    const cleanRoute = `/${String(routePath || '/').replace(/^\/+/, '')}`;
    const cleanBasePath = String(baseUrl.pathname || '').replace(
        /^\/+|\/+$/g,
        ''
    );
    const resolvedPath = cleanBasePath
        ? `/${cleanBasePath}${cleanRoute}`
        : cleanRoute;
    const target = new URL(baseUrl.origin);
    target.pathname = resolvedPath;
    return target.toString();
}

function formatNumber(value, decimals = 2) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'n/a';
    }
    return value.toFixed(decimals);
}

function evaluateRoute(result, thresholds) {
    const failures = [];
    if (result.scores.performance < thresholds.performance) {
        failures.push(
            `performance ${formatNumber(result.scores.performance)} < ${formatNumber(thresholds.performance)}`
        );
    }
    if (result.scores.accessibility < thresholds.accessibility) {
        failures.push(
            `accessibility ${formatNumber(result.scores.accessibility)} < ${formatNumber(
                thresholds.accessibility
            )}`
        );
    }
    if (result.scores.bestPractices < thresholds.bestPractices) {
        failures.push(
            `best-practices ${formatNumber(result.scores.bestPractices)} < ${formatNumber(
                thresholds.bestPractices
            )}`
        );
    }
    if (result.scores.seo < thresholds.seo) {
        failures.push(
            `seo ${formatNumber(result.scores.seo)} < ${formatNumber(thresholds.seo)}`
        );
    }
    if (result.metrics.lcpMs > thresholds.lcpMs) {
        failures.push(
            `LCP ${Math.round(result.metrics.lcpMs)}ms > ${Math.round(thresholds.lcpMs)}ms`
        );
    }
    if (result.metrics.cls > thresholds.cls) {
        failures.push(
            `CLS ${formatNumber(result.metrics.cls, 3)} > ${formatNumber(thresholds.cls, 3)}`
        );
    }
    if (result.metrics.inpMs > thresholds.inpMs) {
        failures.push(
            `INP ${Math.round(result.metrics.inpMs)}ms > ${Math.round(thresholds.inpMs)}ms`
        );
    }
    return failures;
}

function numberOrFallback(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    return fallback;
}

function writeSummary(runDir, summary) {
    const jsonPath = path.join(runDir, 'performance-gate.json');
    const mdPath = path.join(runDir, 'performance-gate.md');
    fs.writeFileSync(jsonPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

    const lines = [
        '# Public Performance Gate',
        '',
        `- Label: ${summary.label}`,
        `- Base URL: ${summary.baseUrl}`,
        `- Generated At: ${summary.generatedAt}`,
        `- Passed: ${summary.passed ? 'yes' : 'no'}`,
        '',
        '## Thresholds',
        '',
        `- performance >= ${summary.thresholds.performance}`,
        `- accessibility >= ${summary.thresholds.accessibility}`,
        `- best-practices >= ${summary.thresholds.bestPractices}`,
        `- seo >= ${summary.thresholds.seo}`,
        `- LCP <= ${summary.thresholds.lcpMs} ms`,
        `- CLS <= ${summary.thresholds.cls}`,
        `- INP <= ${summary.thresholds.inpMs} ms`,
        '',
        '## Routes',
        '',
    ];

    for (const route of summary.routes) {
        lines.push(`### ${route.route}`);
        lines.push(`- status: ${route.status}`);
        lines.push(`- performance: ${formatNumber(route.scores.performance)}`);
        lines.push(
            `- accessibility: ${formatNumber(route.scores.accessibility)}`
        );
        lines.push(
            `- best-practices: ${formatNumber(route.scores.bestPractices)}`
        );
        lines.push(`- seo: ${formatNumber(route.scores.seo)}`);
        lines.push(`- LCP: ${Math.round(route.metrics.lcpMs)} ms`);
        lines.push(`- CLS: ${formatNumber(route.metrics.cls, 3)}`);
        lines.push(`- INP: ${Math.round(route.metrics.inpMs)} ms`);
        if (Array.isArray(route.failures) && route.failures.length > 0) {
            lines.push(`- failures: ${route.failures.join('; ')}`);
        }
        lines.push('');
    }

    fs.writeFileSync(mdPath, `${lines.join('\n')}\n`, 'utf8');
    return { jsonPath, mdPath };
}

async function run() {
    const args = parseArgs(process.argv.slice(2));
    const labelSafe = String(args.label || 'public-performance').replace(
        /[^a-zA-Z0-9_-]+/g,
        '-'
    );
    const runDir = path.resolve(args.outDir, `${nowStamp()}-${labelSafe}`);
    fs.mkdirSync(runDir, { recursive: true });

    const chromePath = resolveChromiumPath();
    if (!chromePath) {
        console.error('[performance-gate] Could not resolve Chromium path.');
        process.exitCode = 1;
        return;
    }

    let baseUrl = safeUrl(args.baseUrl || process.env.TEST_BASE_URL || '');
    const repoRoot = process.cwd();
    let serverProcess = null;

    if (!baseUrl) {
        baseUrl = new URL(`http://${DEFAULT_LOCAL_HOST}:${DEFAULT_LOCAL_PORT}`);
        serverProcess = startLocalPhpServer(
            repoRoot,
            DEFAULT_LOCAL_HOST,
            DEFAULT_LOCAL_PORT
        );
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
            killProcess(serverProcess);
            console.error(
                '[performance-gate] Local PHP server did not become ready.'
            );
            process.exitCode = 1;
            return;
        }
    }

    const debugPort = Number(
        process.env.LIGHTHOUSE_DEBUG_PORT || DEFAULT_DEBUG_PORT
    );

    try {
        const summary = {
            label: args.label,
            baseUrl: baseUrl.toString(),
            generatedAt: new Date().toISOString(),
            thresholds: args.thresholds,
            routes: [],
            passed: true,
        };

        for (
            let routeIndex = 0;
            routeIndex < args.routes.length;
            routeIndex += 1
        ) {
            const routePath = args.routes[routeIndex];
            const targetUrl = joinRoute(baseUrl, routePath);
            const slug =
                routePath
                    .replace(/^\/+|\/+$/g, '')
                    .replace(/[^a-zA-Z0-9_-]+/g, '_') || 'home';
            const outputBase = path.join(runDir, `lighthouse-${slug}`);
            const reportPath = `${outputBase}.report.json`;
            const routeDebugPort = debugPort + routeIndex;
            const chromeProfileDir = path.join(runDir, 'chrome-profile', slug);
            let chromeProcess = null;

            console.log(`[performance-gate] Auditing ${targetUrl}`);
            try {
                chromeProcess = await startChromeSession(
                    chromePath,
                    chromeProfileDir,
                    routeDebugPort
                );
            } catch (error) {
                summary.passed = false;
                summary.routes.push({
                    route: routePath,
                    status: 'failed',
                    failures: [error.message],
                    scores: {
                        performance: 0,
                        accessibility: 0,
                        bestPractices: 0,
                        seo: 0,
                    },
                    metrics: {
                        lcpMs: Infinity,
                        cls: Infinity,
                        inpMs: Infinity,
                    },
                });
                continue;
            }

            const runResult = spawnSync(
                'npx',
                [
                    '--yes',
                    'lighthouse',
                    targetUrl,
                    `--port=${routeDebugPort}`,
                    '--output=json',
                    '--output=html',
                    `--output-path=${outputBase}`,
                    '--quiet',
                    '--form-factor=mobile',
                    '--throttling-method=simulate',
                    '--only-categories=performance,accessibility,best-practices,seo',
                ],
                {
                    encoding: 'utf8',
                    shell: process.platform === 'win32',
                }
            );

            const combinedLog = `${runResult.stdout || ''}\n${runResult.stderr || ''}`;
            fs.writeFileSync(
                path.join(runDir, `lighthouse-${slug}.log`),
                combinedLog,
                'utf8'
            );
            killProcess(chromeProcess);
            chromeProcess = null;

            if (runResult.status !== 0 || !fs.existsSync(reportPath)) {
                summary.passed = false;
                summary.routes.push({
                    route: routePath,
                    status: 'failed',
                    failures: [
                        runResult.status !== 0
                            ? `lighthouse exit code ${runResult.status}`
                            : 'missing report json',
                    ],
                    scores: {
                        performance: 0,
                        accessibility: 0,
                        bestPractices: 0,
                        seo: 0,
                    },
                    metrics: {
                        lcpMs: Infinity,
                        cls: Infinity,
                        inpMs: Infinity,
                    },
                });
                await sleep(120);
                continue;
            }

            const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
            const categories = report.categories || {};
            const audits = report.audits || {};
            const inpCandidate =
                audits['interaction-to-next-paint']?.numericValue ??
                audits['experimental-interaction-to-next-paint']
                    ?.numericValue ??
                audits['max-potential-fid']?.numericValue ??
                audits['total-blocking-time']?.numericValue;
            const routeSummary = {
                route: routePath,
                status: 'passed',
                scores: {
                    performance: Number(categories.performance?.score || 0),
                    accessibility: Number(categories.accessibility?.score || 0),
                    bestPractices: Number(
                        categories['best-practices']?.score || 0
                    ),
                    seo: Number(categories.seo?.score || 0),
                },
                metrics: {
                    lcpMs: numberOrFallback(
                        audits['largest-contentful-paint']?.numericValue,
                        Infinity
                    ),
                    cls: numberOrFallback(
                        audits['cumulative-layout-shift']?.numericValue,
                        Infinity
                    ),
                    inpMs: numberOrFallback(inpCandidate, Infinity),
                },
                failures: [],
            };

            const failures = evaluateRoute(routeSummary, args.thresholds);
            routeSummary.failures = failures;
            if (failures.length > 0) {
                routeSummary.status = 'failed';
                summary.passed = false;
            }

            summary.routes.push(routeSummary);
            await sleep(120);
        }

        const artifacts = writeSummary(runDir, summary);
        console.log(`[performance-gate] Summary JSON: ${artifacts.jsonPath}`);
        console.log(`[performance-gate] Summary MD: ${artifacts.mdPath}`);

        if (!summary.passed) {
            for (const route of summary.routes) {
                if (route.status !== 'failed') {
                    continue;
                }
                console.error(
                    `[performance-gate] ${route.route} failed: ${route.failures.join(' | ')}`
                );
            }
            process.exitCode = 1;
            return;
        }

        console.log('[performance-gate] All routes passed performance gate.');
    } catch (error) {
        console.error(`[performance-gate] Failed: ${error.message}`);
        process.exitCode = 1;
    } finally {
        killProcess(serverProcess);
    }
}

run();
