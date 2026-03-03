#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const DEFAULT_URL = 'https://www.sony.com/en_us/';
const DEFAULT_OUT_DIR = path.join('verification', 'sony-reference');
const DEFAULT_TIMEOUT_MS = 45000;

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
        fullPage: true,
    },
];

function parseArgs(argv) {
    const parsed = {
        url: DEFAULT_URL,
        outDir: DEFAULT_OUT_DIR,
        label: 'sony-reference',
    };

    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (token === '--url') {
            parsed.url = String(argv[index + 1] || parsed.url).trim();
            index += 1;
            continue;
        }
        if (token === '--out-dir') {
            parsed.outDir = String(argv[index + 1] || parsed.outDir).trim();
            index += 1;
            continue;
        }
        if (token === '--label') {
            parsed.label = String(argv[index + 1] || parsed.label).trim();
            index += 1;
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

async function captureViewport(browser, outputRoot, targetUrl, config) {
    const viewportDir = path.join(outputRoot, config.id);
    fs.mkdirSync(viewportDir, { recursive: true });

    const context = await browser.newContext({
        viewport: config.viewport,
        isMobile: config.isMobile,
        hasTouch: config.isMobile,
        colorScheme: 'light',
        locale: 'en-US',
        deviceScaleFactor: config.isMobile ? 3 : 1,
    });

    const page = await context.newPage();
    try {
        await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: DEFAULT_TIMEOUT_MS,
        });
        await page.waitForTimeout(2500);

        await page.evaluate(() => {
            const styleId = 'sony-reference-capture-stabilizer';
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
        });

        const screenshotPath = path.join(viewportDir, 'sony-home.png');
        await page.screenshot({
            path: screenshotPath,
            type: 'png',
            fullPage: config.fullPage,
        });

        return {
            viewport: config.id,
            file: path.relative(outputRoot, screenshotPath).replace(/\\/g, '/'),
            status: 'ok',
        };
    } finally {
        await page.close();
        await context.close();
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const repoRoot = process.cwd();
    const runId = `${nowStamp()}-${String(
        args.label || 'sony-reference'
    ).replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
    const outputRoot = path.resolve(repoRoot, args.outDir, runId);
    fs.mkdirSync(outputRoot, { recursive: true });

    const browser = await chromium.launch({
        headless: true,
        args:
            process.env.GITHUB_ACTIONS === 'true'
                ? ['--no-sandbox', '--disable-dev-shm-usage']
                : [],
    });

    const manifest = {
        generatedAt: new Date().toISOString(),
        sourceUrl: args.url,
        outputRoot,
        captures: [],
    };

    try {
        for (const viewport of VIEWPORTS) {
            const capture = await captureViewport(
                browser,
                outputRoot,
                args.url,
                viewport
            );
            manifest.captures.push(capture);
        }
    } finally {
        await browser.close();
    }

    const manifestPath = path.join(outputRoot, 'manifest.json');
    fs.writeFileSync(
        manifestPath,
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8'
    );

    process.stdout.write(
        [
            'Sony reference capture: DONE',
            `Source: ${args.url}`,
            `Artifacts:`,
            `- ${path.relative(repoRoot, manifestPath).replace(/\\/g, '/')}`,
            '',
        ].join('\n')
    );
}

main().catch((error) => {
    process.stderr.write(`capture-sony-reference failed: ${error.message}\n`);
    process.exitCode = 1;
});
