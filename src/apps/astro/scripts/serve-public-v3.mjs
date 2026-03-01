#!/usr/bin/env node

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../../../');
const host = process.env.PUBLIC_V3_HOST || '127.0.0.1';
const port = Number(process.env.PUBLIC_V3_PORT || '8091');

const MIME_TYPES = new Map([
    ['.css', 'text/css; charset=UTF-8'],
    ['.html', 'text/html; charset=UTF-8'],
    ['.ico', 'image/x-icon'],
    ['.js', 'application/javascript; charset=UTF-8'],
    ['.json', 'application/json; charset=UTF-8'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.txt', 'text/plain; charset=UTF-8'],
    ['.webp', 'image/webp'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2'],
    ['.xml', 'application/xml; charset=UTF-8'],
]);

function preserveQuery(target, search) {
    return search ? `${target}${search}` : target;
}

function resolveLegacyRedirect(pathname, search) {
    if (pathname === '/') return preserveQuery('/es/', search);
    if (pathname === '/index.html') return preserveQuery('/es/', search);
    if (/^\/telemedicina(?:\.html)?\/?$/i.test(pathname)) {
        return preserveQuery('/es/telemedicina/', search);
    }
    if (/^\/terminos\.html$/i.test(pathname)) {
        return preserveQuery('/es/legal/terminos/', search);
    }
    if (/^\/privacidad\.html$/i.test(pathname)) {
        return preserveQuery('/es/legal/privacidad/', search);
    }
    if (/^\/cookies\.html$/i.test(pathname)) {
        return preserveQuery('/es/legal/cookies/', search);
    }
    if (/^\/aviso-medico\.html$/i.test(pathname)) {
        return preserveQuery('/es/legal/aviso-medico/', search);
    }
    if (/^\/servicios\/acne(?:\.html)?\/?$/i.test(pathname)) {
        return preserveQuery('/es/servicios/acne-rosacea/', search);
    }
    if (/^\/servicios\/laser(?:\.html)?\/?$/i.test(pathname)) {
        return preserveQuery('/es/servicios/laser-dermatologico/', search);
    }

    const serviceHtmlMatch = pathname.match(
        /^\/servicios\/([a-z0-9-]+)\.html$/i
    );
    if (serviceHtmlMatch) {
        return preserveQuery(`/es/servicios/${serviceHtmlMatch[1]}/`, search);
    }

    const childHtmlMatch = pathname.match(/^\/ninos\/([a-z0-9-]+)\.html$/i);
    if (childHtmlMatch) {
        return preserveQuery(`/es/servicios/${childHtmlMatch[1]}/`, search);
    }

    return '';
}

function safeResolveFile(pathname) {
    const cleanedPath = decodeURIComponent(pathname).replace(/\\/g, '/');
    const relativePath = cleanedPath.replace(/^\/+/, '');
    const absolutePath = path.resolve(repoRoot, relativePath);

    if (!absolutePath.startsWith(repoRoot)) {
        return '';
    }

    if (existsSync(absolutePath)) {
        const stats = statSync(absolutePath);
        if (stats.isFile()) {
            return absolutePath;
        }
        if (stats.isDirectory()) {
            const indexPath = path.join(absolutePath, 'index.html');
            if (existsSync(indexPath) && statSync(indexPath).isFile()) {
                return indexPath;
            }
        }
    }

    if (cleanedPath.endsWith('/')) {
        const indexPath = path.resolve(repoRoot, relativePath, 'index.html');
        if (indexPath.startsWith(repoRoot) && existsSync(indexPath)) {
            return indexPath;
        }
    }

    return '';
}

function contentTypeFor(filePath) {
    return (
        MIME_TYPES.get(path.extname(filePath).toLowerCase()) ||
        'application/octet-stream'
    );
}

const server = createServer((request, response) => {
    const requestUrl = new URL(
        request.url || '/',
        `http://${request.headers.host || `${host}:${port}`}`
    );
    const redirectTarget = resolveLegacyRedirect(
        requestUrl.pathname,
        requestUrl.search
    );

    if (redirectTarget) {
        response.writeHead(301, {
            Location: redirectTarget,
            'Cache-Control': 'no-store',
        });
        response.end();
        return;
    }

    const filePath = safeResolveFile(requestUrl.pathname);
    if (!filePath) {
        response.writeHead(404, {
            'Content-Type': 'text/plain; charset=UTF-8',
        });
        response.end('Not found');
        return;
    }

    try {
        const body = readFileSync(filePath);
        response.writeHead(200, {
            'Content-Type': contentTypeFor(filePath),
            'Cache-Control': 'no-store',
        });
        response.end(body);
    } catch (error) {
        response.writeHead(500, {
            'Content-Type': 'text/plain; charset=UTF-8',
        });
        response.end(
            `Read error: ${error instanceof Error ? error.message : 'unknown'}`
        );
    }
});

server.listen(port, host, () => {
    process.stdout.write(
        `[public-v3-server] listening on http://${host}:${port}\n`
    );
});

function shutdown() {
    server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
