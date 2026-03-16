'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME_TYPES = new Map([
    ['.avif', 'image/avif'],
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

function safeResolveFile(repoRoot, pathname) {
    let cleanedPath = String(pathname || '/');
    try {
        cleanedPath = decodeURIComponent(cleanedPath);
    } catch (_error) {
        return '';
    }
    cleanedPath = cleanedPath.replace(/\\/g, '/');
    const relativePath = cleanedPath.replace(/^\/+/, '');
    const absolutePath = path.resolve(repoRoot, relativePath);

    if (!absolutePath.startsWith(repoRoot)) {
        return '';
    }

    if (fs.existsSync(absolutePath)) {
        const stats = fs.statSync(absolutePath);
        if (stats.isFile()) {
            return absolutePath;
        }
        if (stats.isDirectory()) {
            const indexPath = path.join(absolutePath, 'index.html');
            if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
                return indexPath;
            }
        }
    }

    if (cleanedPath.endsWith('/')) {
        const indexPath = path.resolve(repoRoot, relativePath, 'index.html');
        if (indexPath.startsWith(repoRoot) && fs.existsSync(indexPath)) {
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

function resolvePublicRuntimeRoot(repoRoot, options = {}) {
    const explicitRuntimeRoot = String(options.runtimeRoot || '').trim();
    if (explicitRuntimeRoot) {
        return path.resolve(explicitRuntimeRoot);
    }

    const stagedRuntimeRoot = path.join(repoRoot, '.generated', 'site-root');
    if (
        fs.existsSync(stagedRuntimeRoot) &&
        fs.statSync(stagedRuntimeRoot).isDirectory()
    ) {
        return stagedRuntimeRoot;
    }

    return repoRoot;
}

function createPublicRequestHandler(repoRoot, options = {}) {
    const host = options.host || '127.0.0.1';
    const port = Number(options.port || 0);
    const runtimeRoot = resolvePublicRuntimeRoot(repoRoot, options);

    return (request, response) => {
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

        const filePath =
            safeResolveFile(runtimeRoot, requestUrl.pathname) ||
            safeResolveFile(repoRoot, requestUrl.pathname);
        if (!filePath) {
            response.writeHead(404, {
                'Content-Type': 'text/plain; charset=UTF-8',
                'Cache-Control': 'no-store',
            });
            response.end('Not found');
            return;
        }

        try {
            const body = fs.readFileSync(filePath);
            response.writeHead(200, {
                'Content-Type': contentTypeFor(filePath),
                'Cache-Control': 'no-store',
            });
            response.end(body);
        } catch (error) {
            response.writeHead(500, {
                'Content-Type': 'text/plain; charset=UTF-8',
                'Cache-Control': 'no-store',
            });
            response.end(
                `Read error: ${
                    error instanceof Error ? error.message : 'unknown'
                }`
            );
        }
    };
}

async function startLocalPublicServer(repoRoot, options = {}) {
    const host = options.host || '127.0.0.1';
    const port = Number(options.port || 0);
    const runtimeRoot = resolvePublicRuntimeRoot(repoRoot, options);
    const server = http.createServer(
        createPublicRequestHandler(repoRoot, {
            host,
            port,
            runtimeRoot,
        })
    );

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
        server.close();
        throw new Error(
            'No se pudo resolver la direccion del servidor local V6'
        );
    }

    return {
        server,
        baseUrl: new URL(`http://${host}:${address.port}`),
        runtimeRoot,
    };
}

async function stopLocalPublicServer(server) {
    if (!server) return;
    await new Promise((resolve) => server.close(resolve));
}

module.exports = {
    createPublicRequestHandler,
    resolveLegacyRedirect,
    resolvePublicRuntimeRoot,
    startLocalPublicServer,
    stopLocalPublicServer,
};
