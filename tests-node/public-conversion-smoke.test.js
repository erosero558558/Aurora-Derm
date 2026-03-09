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
    const switchHref = locale === 'en' ? '/es/' : '/en/';
    const bookingTitle =
        locale === 'en'
            ? 'Online booking under maintenance'
            : 'Reserva online en mantenimiento';
    const withoutHero = options.withoutHero === true;

    return `<!doctype html>
<html lang="${locale}">
<body>
  <header data-v6-header></header>
  ${withoutHero ? '' : '<section data-v6-hero></section>'}
  <section data-v6-news-strip><a href="${switchHref}">switch</a></section>
  <section data-v6-booking-status>
    <h2>${bookingTitle}</h2>
    <a href="${locale === 'en' ? '/en/services/' : '/es/servicios/'}">cta</a>
  </section>
</body>
</html>`;
}

function standardPageHtml(locale, routeType = 'hub') {
    return `<!doctype html>
<html lang="${locale}">
<body>
  <header data-v6-header></header>
  ${
      routeType === 'hub'
          ? '<section data-v6-page-head></section>'
          : '<section data-v6-page-head></section><section data-v6-booking-status><a href="/' +
            (locale === 'en' ? 'en/telemedicine/' : 'es/telemedicina/') +
            '">cta</a></section>'
  }
</body>
</html>`;
}

function teleHtml(locale) {
    return `<!doctype html>
<html lang="${locale}">
<body>
  <section data-v6-page-head></section>
  <section data-v6-booking-status>
    <a href="https://wa.me/593982453672">wa</a>
  </section>
</body>
</html>`;
}

function legalHtml(locale) {
    const homeHref = locale === 'en' ? '/en/' : '/es/';
    return `<!doctype html>
<html lang="${locale}">
<body>
  <section data-v6-page-head></section>
  <a href="${homeHref}">home</a>
</body>
</html>`;
}

function createHandler(options = {}) {
    const breakHomeHero = options.breakHomeHero === true;
    const pages = new Map([
        ['/es/', homeHtml('es', { withoutHero: breakHomeHero })],
        ['/en/', homeHtml('en')],
        ['/es/servicios/', standardPageHtml('es', 'hub')],
        ['/en/services/', standardPageHtml('en', 'hub')],
        [
            '/es/servicios/diagnostico-integral/',
            standardPageHtml('es', 'service'),
        ],
        [
            '/en/services/diagnostico-integral/',
            standardPageHtml('en', 'service'),
        ],
        ['/es/telemedicina/', teleHtml('es')],
        ['/en/telemedicine/', teleHtml('en')],
        ['/es/legal/privacidad/', legalHtml('es')],
        ['/en/legal/privacy/', legalHtml('en')],
    ]);

    return (req, res) => {
        const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
        if (!requestUrl.pathname.startsWith(BASE_PREFIX)) {
            res.writeHead(404);
            res.end('missing-prefix');
            return;
        }

        const relativePath =
            requestUrl.pathname.slice(BASE_PREFIX.length) || '/';
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

test('public conversion smoke passes with V6 signals and booking freeze copy', async () => {
    const { server, port } = await startServer(createHandler());
    const outputPath = path.join(
        os.tmpdir(),
        `public-conversion-smoke-${Date.now()}.json`
    );
    try {
        const baseUrl = `http://127.0.0.1:${port}/staging`;
        const result = await runConversionSmoke(baseUrl, outputPath);
        assert.equal(
            result.code,
            0,
            `Expected success but got:\n${result.stderr}`
        );
        assert.equal(
            result.stdout.includes('All public conversion checks passed.'),
            true,
            'success summary not found'
        );
        const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
        assert.equal(report.passed, true, 'expected JSON report to pass');
        assert.equal(
            Array.isArray(report.checks),
            true,
            'expected checks array'
        );
    } finally {
        fs.rmSync(outputPath, { force: true });
        await new Promise((resolve) => server.close(resolve));
    }
});

test('public conversion smoke fails when V6 hero is missing on home', async () => {
    const { server, port } = await startServer(
        createHandler({ breakHomeHero: true })
    );
    try {
        const baseUrl = `http://127.0.0.1:${port}/staging`;
        const result = await runConversionSmoke(baseUrl);
        assert.equal(result.code, 1, 'Expected non-zero exit code');
        const combined = `${result.stdout}\n${result.stderr}`;
        assert.equal(
            combined.includes('Route /es/ missing data-v6-hero'),
            true,
            'Expected missing V6 hero error in output'
        );
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
