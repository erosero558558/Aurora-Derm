#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const path = require('node:path');

const SCRIPT_PATH = path.resolve(
    __dirname,
    '..',
    'bin',
    'check-public-conversion-smoke.js'
);

const BASE_PREFIX = '/staging';

function homeHtml(locale, options = {}) {
    const bookingHref = locale === 'en' ? '/en/#citas' : '/es/#citas';
    const langSwitch = locale === 'en' ? '/es/' : '/en/';
    const includeServiceSelect = options.includeServiceSelect !== false;
    return `<!doctype html>
<html lang="${locale}">
<body>
  <a class="sony-lang" href="${langSwitch}">switch</a>
  <a class="sony-cta" href="${bookingHref}">book</a>
  <section id="citas"></section>
  <form id="appointmentForm">
    ${includeServiceSelect ? '<select id="serviceSelect"></select>' : ''}
  </form>
  <div id="chatbotWidget"></div>
</body>
</html>`;
}

function serviceHtml(routeHint) {
    return `<!doctype html>
<html lang="es">
<body>
  <a data-analytics-event="start_booking_from_service" href="/es/?service=${routeHint}#citas">book</a>
</body>
</html>`;
}

function serviceHtmlEn(routeHint) {
    return `<!doctype html>
<html lang="en">
<body>
  <a data-analytics-event="start_booking_from_service" href="/en/?service=${routeHint}#citas">book</a>
</body>
</html>`;
}

function teleHtml(locale) {
    const bookingHref = locale === 'en' ? '/en/#citas' : '/es/#citas';
    return `<!doctype html>
<html lang="${locale}">
<body>
  <a href="${bookingHref}">book tele</a>
  <a href="https://wa.me/593982453672">wa</a>
</body>
</html>`;
}

function legalHtml(locale) {
    const homeHref = locale === 'en' ? '/en/' : '/es/';
    return `<!doctype html>
<html lang="${locale}">
<body>
  <a href="${homeHref}">home</a>
</body>
</html>`;
}

function createHandler(options = {}) {
    const breakHomeServiceSelect = options.breakHomeServiceSelect === true;
    const pages = new Map([
        ['/es/', homeHtml('es', { includeServiceSelect: !breakHomeServiceSelect })],
        ['/en/', homeHtml('en')],
        ['/es/servicios/botox/', serviceHtml('rejuvenecimiento')],
        ['/es/servicios/cancer-piel/', serviceHtml('cancer')],
        ['/en/services/botox/', serviceHtmlEn('rejuvenecimiento')],
        ['/es/telemedicina/', teleHtml('es')],
        ['/en/telemedicine/', teleHtml('en')],
        ['/es/legal/privacidad/', legalHtml('es')],
        ['/en/legal/terms/', legalHtml('en')],
    ]);

    return (req, res) => {
        const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
        if (!requestUrl.pathname.startsWith(BASE_PREFIX)) {
            res.writeHead(404);
            res.end('missing-prefix');
            return;
        }

        const relativePath = requestUrl.pathname.slice(BASE_PREFIX.length) || '/';
        if (
            relativePath === '/api.php' &&
            requestUrl.searchParams.get('resource') === 'public-runtime-config'
        ) {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(
                JSON.stringify({
                    ok: true,
                    data: {
                        captcha: {
                            provider: 'turnstile',
                            siteKey: 'test-site-key',
                            scriptUrl: 'https://example.test/captcha.js',
                        },
                        features: { publicRuntimeConfig: true },
                        deployVersion: 'test-2026-02-27',
                    },
                })
            );
            return;
        }

        const html = pages.get(relativePath);
        if (!html) {
            res.writeHead(404);
            res.end('not-found');
            return;
        }

        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(html);
    };
}

function startServer(handler) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(handler);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('Could not resolve test server address'));
                return;
            }
            resolve({ server, port: address.port });
        });
    });
}

function runConversionSmoke(baseUrl, outputPath = '') {
    const args = [SCRIPT_PATH, '--base-url', baseUrl];
    if (outputPath) {
        args.push('--output', outputPath);
    }
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk.toString();
        });
        child.on('exit', (code) => {
            resolve({ code, stdout, stderr });
        });
    });
}

test('public conversion smoke passes with expected hooks and CTAs', async () => {
    const { server, port } = await startServer(createHandler());
    const outputPath = path.join(os.tmpdir(), `public-conversion-smoke-${Date.now()}.json`);
    try {
        const baseUrl = `http://127.0.0.1:${port}/staging`;
        const result = await runConversionSmoke(baseUrl, outputPath);
        assert.equal(result.code, 0, `Expected success but got:\n${result.stderr}`);
        assert.equal(
            result.stdout.includes('All public conversion checks passed.'),
            true,
            'success summary not found'
        );
        const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        assert.equal(report.passed, true, 'expected JSON report to pass');
        assert.equal(Array.isArray(report.checks), true, 'expected checks array');
    } finally {
        fs.rmSync(outputPath, { force: true });
        await new Promise((resolve) => server.close(resolve));
    }
});

test('public conversion smoke fails when booking hook is missing on home', async () => {
    const { server, port } = await startServer(
        createHandler({ breakHomeServiceSelect: true })
    );
    try {
        const baseUrl = `http://127.0.0.1:${port}/staging`;
        const result = await runConversionSmoke(baseUrl);
        assert.equal(result.code, 1, 'Expected non-zero exit code');
        const combined = `${result.stdout}\n${result.stderr}`;
        assert.equal(
            combined.includes('Route /es/ missing booking select #serviceSelect'),
            true,
            'Expected missing serviceSelect error in output'
        );
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
