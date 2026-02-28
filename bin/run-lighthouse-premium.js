#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

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

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCommandCapture(command, args, options) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        ...options,
    });
    if (result.stdout) {
        process.stdout.write(result.stdout);
    }
    if (result.stderr) {
        process.stderr.write(result.stderr);
    }
    return result;
}

function requestOnce(urlString) {
    return new Promise((resolve) => {
        const url = new URL(urlString);
        const client = url.protocol === 'https:' ? https : http;
        const req = client.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port,
                path: url.pathname + url.search,
                method: 'GET',
                timeout: 1500,
            },
            (response) => {
                response.resume();
                resolve(true);
            }
        );
        req.on('timeout', () => {
            req.destroy();
            resolve(false);
        });
        req.on('error', () => resolve(false));
        req.end();
    });
}

async function waitForHttpReady(urlString, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const ready = await requestOnce(urlString);
        if (ready) {
            return true;
        }
        await sleep(350);
    }
    return false;
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
        await sleep(250);
    }
    return false;
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

function sanitizePathForFile(urlString, index) {
    try {
        const url = new URL(urlString);
        const slug = url.pathname
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .replace(/[^a-zA-Z0-9/_-]+/g, '-')
            .replace(/\//g, '__');
        return `premium-${String(index + 1).padStart(2, '0')}-${slug || 'home'}`;
    } catch (_error) {
        return `premium-${String(index + 1).padStart(2, '0')}`;
    }
}

function extractThresholds(config) {
    const assertions = (config && config.ci && config.ci.assert && config.ci.assert.assertions) || {};
    const map = {};
    for (const [key, value] of Object.entries(assertions)) {
        if (!key.startsWith('categories:') || !Array.isArray(value) || value.length < 2) {
            continue;
        }
        const category = key.split(':')[1];
        const severity = value[0] || 'error';
        const minScore = value[1] && typeof value[1].minScore === 'number' ? value[1].minScore : null;
        if (minScore === null) {
            continue;
        }
        map[category] = { severity, minScore };
    }
    return map;
}

function formatScore(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'n/a';
    }
    return value.toFixed(2);
}

async function runManualFlow(repoRoot, env) {
    const configPath = path.join(repoRoot, 'lighthouserc.premium.json');
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(rawConfig);
    const collect = (config.ci && config.ci.collect) || {};
    const urls = Array.isArray(collect.url) ? collect.url : [];
    const settings = collect.settings || {};
    const thresholds = extractThresholds(config);
    const outputDir = path.join(repoRoot, '.lighthouseci');
    const serverCommand = collect.startServerCommand || '';
    const chromeDebugPort = Number(env.LIGHTHOUSE_DEBUG_PORT || '9222');
    const chromeUserDataDir = path.join(outputDir, 'chrome-profile');

    if (!urls.length) {
        console.error('[lighthouse-premium] No URLs configured in lighthouserc.premium.json');
        return 1;
    }
    if (!serverCommand) {
        console.error('[lighthouse-premium] Missing collect.startServerCommand');
        return 1;
    }
    if (!env.CHROME_PATH) {
        console.error('[lighthouse-premium] CHROME_PATH unresolved on Windows force mode');
        return 1;
    }

    fs.mkdirSync(outputDir, { recursive: true });
    fs.mkdirSync(chromeUserDataDir, { recursive: true });

    const failures = [];
    const warnings = [];

    let serverProcess = null;
    let chromeProcess = null;
    let serverExitedCode = null;

    try {
        console.log(`[lighthouse-premium] Starting server: ${serverCommand}`);
        serverProcess = spawn(serverCommand, {
            cwd: repoRoot,
            env,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        serverProcess.on('exit', (code) => {
            serverExitedCode = code;
        });
        serverProcess.stdout.on('data', (chunk) => process.stdout.write(chunk.toString()));
        serverProcess.stderr.on('data', (chunk) => process.stderr.write(chunk.toString()));

        const firstUrl = urls[0];
        const httpReady = await waitForHttpReady(firstUrl, 30000);
        if (!httpReady) {
            failures.push(
                serverExitedCode === null
                    ? `Web server did not become ready for ${firstUrl}`
                    : `Web server exited early with code ${serverExitedCode}`
            );
            throw new Error('web-server-not-ready');
        }

        const chromeArgs = [
            `--remote-debugging-port=${chromeDebugPort}`,
            `--user-data-dir=${chromeUserDataDir}`,
            '--headless',
            '--disable-gpu',
            '--no-sandbox',
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-dev-shm-usage',
            'about:blank',
        ];
        console.log(`[lighthouse-premium] Launching Chrome: ${env.CHROME_PATH}`);
        chromeProcess = spawn(env.CHROME_PATH, chromeArgs, {
            cwd: repoRoot,
            env,
            stdio: 'ignore',
            shell: false,
        });

        const chromeReady = await waitForPort('127.0.0.1', chromeDebugPort, 15000);
        if (!chromeReady) {
            failures.push(`Chrome debugging port ${chromeDebugPort} did not open in time`);
            throw new Error('chrome-not-ready');
        }

        for (let index = 0; index < urls.length; index += 1) {
            const url = urls[index];
            const basename = sanitizePathForFile(url, index);
            const outputBase = path.join(outputDir, basename);
            const jsonReportPath = `${outputBase}.report.json`;

            const lighthouseArgs = [
                '--yes',
                'lighthouse',
                url,
                `--port=${chromeDebugPort}`,
                '--output=json',
                '--output=html',
                `--output-path=${outputBase}`,
                '--quiet',
            ];
            if (Array.isArray(settings.onlyCategories) && settings.onlyCategories.length > 0) {
                lighthouseArgs.push(`--only-categories=${settings.onlyCategories.join(',')}`);
            }
            if (settings.formFactor) {
                lighthouseArgs.push(`--form-factor=${settings.formFactor}`);
            }
            if (settings.throttlingMethod) {
                lighthouseArgs.push(`--throttling-method=${settings.throttlingMethod}`);
            }

            console.log(`[lighthouse-premium] Auditing ${url}`);
            const run = runCommandCapture('npx', lighthouseArgs, {
                cwd: repoRoot,
                env,
                shell: process.platform === 'win32',
            });

            const combinedOutput = `${run.stdout || ''}\n${run.stderr || ''}`;
            const hasReport = fs.existsSync(jsonReportPath);
            const recoverableEperm =
                run.status !== 0 &&
                hasReport &&
                /EPERM[\s\S]*lighthouse\.\d+/i.test(combinedOutput);

            if (run.status !== 0 && !recoverableEperm) {
                failures.push(`Lighthouse failed for ${url} with exit code ${run.status}`);
                continue;
            }
            if (!hasReport) {
                failures.push(`Missing report output for ${url}: ${jsonReportPath}`);
                continue;
            }
            if (recoverableEperm) {
                warnings.push(
                    `Recoverable EPERM cleanup issue on Windows for ${url}; report was collected.`
                );
            }

            let report;
            try {
                report = JSON.parse(fs.readFileSync(jsonReportPath, 'utf8'));
            } catch (error) {
                failures.push(`Invalid JSON report for ${url}: ${error.message}`);
                continue;
            }

            const categories = report.categories || {};
            const perf = categories.performance && categories.performance.score;
            const a11y = categories.accessibility && categories.accessibility.score;
            const best = categories['best-practices'] && categories['best-practices'].score;
            const seo = categories.seo && categories.seo.score;
            console.log(
                `[lighthouse-premium] scores ${url} :: performance=${formatScore(perf)} accessibility=${formatScore(
                    a11y
                )} best-practices=${formatScore(best)} seo=${formatScore(seo)}`
            );

            for (const [category, rule] of Object.entries(thresholds)) {
                const categoryScore = categories[category] && categories[category].score;
                if (typeof categoryScore !== 'number') {
                    failures.push(`Missing score for ${category} on ${url}`);
                    continue;
                }
                if (categoryScore < rule.minScore) {
                    const message = `${url} ${category} score ${formatScore(
                        categoryScore
                    )} is below ${formatScore(rule.minScore)} (${rule.severity})`;
                    if (rule.severity === 'error') {
                        failures.push(message);
                    } else {
                        warnings.push(message);
                    }
                }
            }
        }
    } catch (_error) {
        // Failures are already recorded above for actionable output.
    } finally {
        killProcess(chromeProcess);
        killProcess(serverProcess);
    }

    for (const warning of warnings) {
        console.warn(`[lighthouse-premium][warn] ${warning}`);
    }
    for (const failure of failures) {
        console.error(`[lighthouse-premium][error] ${failure}`);
    }

    if (failures.length > 0) {
        return 1;
    }

    console.log(
        `[lighthouse-premium] Completed manual run. URLs audited: ${urls.length}, warnings: ${warnings.length}`
    );
    return 0;
}

function shouldRunManualFlow(env) {
    if (env.LIGHTHOUSE_FORCE_MANUAL === '1') {
        return true;
    }
    if (process.platform === 'win32' && env.LIGHTHOUSE_FORCE_WINDOWS === '1') {
        return true;
    }
    return env.GITHUB_ACTIONS === 'true';
}

const repoRoot = path.resolve(__dirname, '..');
const chromepath = resolveChromiumPath();
const env = { ...process.env };
if (chromepath) {
    env.CHROME_PATH = chromepath;
}

const manualFlow = shouldRunManualFlow(env);

if (process.platform === 'win32' && !manualFlow) {
    console.log(
        '[lighthouse-premium] Skipping on Windows host (set LIGHTHOUSE_FORCE_WINDOWS=1 to force local run).'
    );
    process.exit(0);
}

if (manualFlow) {
    runManualFlow(repoRoot, env)
        .then((exitCode) => process.exit(exitCode))
        .catch((error) => {
            console.error('[lighthouse-premium] Unexpected manual flow error:', error.message);
            process.exit(1);
        });
    return;
}

const npxCmd = 'npx';
const commandArgs = [
    '--yes',
    '@lhci/cli',
    'autorun',
    '--config=./lighthouserc.premium.json',
];

console.log(
    `[lighthouse-premium] CHROME_PATH=${env.CHROME_PATH || 'system-default'}`
);

const result = spawnSync(npxCmd, commandArgs, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
});

if (result.error) {
    console.error('[lighthouse-premium] spawn error:', result.error.message);
}

if (typeof result.status === 'number') {
    process.exit(result.status);
}

process.exit(1);
