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
    'check-public-routing-smoke.js'
);

function createHandler(options = {}) {
    const breakQueryOnPath = options.breakQueryOnPath || '';
    const basePrefix = '/staging';
    const canonical = new Set([
        '/es/',
        '/en/',
        '/es/telemedicina/',
        '/en/telemedicine/',
        '/es/servicios/acne-rosacea/',
        '/en/services/acne-rosacea/',
        '/es/legal/privacidad/',
        '/en/legal/privacy/',
    ]);
    const redirects = new Map([
        ['/', '/es/'],
        ['/index.html', '/es/'],
        ['/telemedicina.html', '/es/telemedicina/'],
        ['/servicios/acne-rosacea.html', '/es/servicios/acne-rosacea/'],
        ['/ninos/dermatologia-pediatrica.html', '/es/servicios/dermatologia-pediatrica/'],
        ['/terminos.html', '/es/legal/terminos/'],
    ]);

    return (req, res) => {
        const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
        if (!requestUrl.pathname.startsWith(basePrefix)) {
            res.writeHead(404);
            res.end('missing-prefix');
            return;
        }

        const relativePath = requestUrl.pathname.slice(basePrefix.length) || '/';
        if (canonical.has(relativePath)) {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }

        const target = redirects.get(relativePath);
        if (target) {
            let location = `${basePrefix}${target}`;
            if (requestUrl.search && relativePath !== breakQueryOnPath) {
                location += requestUrl.search;
            }
            res.writeHead(301, { location });
            res.end('redirect');
            return;
        }

        if (relativePath === '/es/legal/terminos/') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }

        if (relativePath === '/es/servicios/dermatologia-pediatrica/') {
            res.writeHead(200, { 'content-type': 'text/plain' });
            res.end('ok');
            return;
        }

        res.writeHead(404);
        res.end('not-found');
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

function runRoutingSmoke(baseUrl, outputPath = '') {
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

test('public routing smoke passes when canonical and redirect rules are correct', async () => {
    const { server, port } = await startServer(createHandler());
    const outputPath = path.join(os.tmpdir(), `public-routing-smoke-${Date.now()}.json`);
    try {
        const baseUrl = `http://127.0.0.1:${port}/staging`;
        const result = await runRoutingSmoke(baseUrl, outputPath);
        assert.equal(result.code, 0, `Expected success but got:\n${result.stderr}`);
        assert.equal(
            result.stdout.includes('All public routing checks passed.'),
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

test('public routing smoke fails when redirect query params are not preserved', async () => {
    const { server, port } = await startServer(
        createHandler({ breakQueryOnPath: '/telemedicina.html' })
    );
    try {
        const baseUrl = `http://127.0.0.1:${port}/staging`;
        const result = await runRoutingSmoke(baseUrl);
        assert.equal(result.code, 1, 'Expected non-zero exit code');
        const combined = `${result.stdout}\n${result.stderr}`;
        assert.equal(
            combined.includes('did not preserve query params'),
            true,
            'Expected query preservation error in output'
        );
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});
