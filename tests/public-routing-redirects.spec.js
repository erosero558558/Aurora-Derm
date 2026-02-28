// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

function readFile(relativePath) {
    const filePath = path.join(REPO_ROOT, relativePath);
    return fs.readFileSync(filePath, 'utf8');
}

test.describe('Public routing redirect maps', () => {
    test('apache map includes canonical 301 migration for legacy public routes', async () => {
        const htaccess = readFile('.htaccess');

        expect(htaccess).toContain('RewriteRule ^$ /es/ [R=301,L]');
        expect(htaccess).toContain('RewriteRule ^index\\.html$ /es/ [R=301,L,NC]');
        expect(htaccess).toContain(
            'RewriteRule ^telemedicina(?:\\.html)?$ /es/telemedicina/ [R=301,L,NC]'
        );
        expect(htaccess).toContain(
            'RewriteRule ^servicios/([a-z0-9-]+)\\.html$ /es/servicios/$1/ [R=301,L,NC]'
        );
        expect(htaccess).toContain(
            'RewriteRule ^ninos/([a-z0-9-]+)\\.html$ /es/servicios/$1/ [R=301,L,NC]'
        );
    });

    test('nginx map preserves query params in 301 redirects', async () => {
        const nginxConf = readFile('nginx-pielarmonia.conf');

        expect(nginxConf).toContain('location = / {');
        expect(nginxConf).toContain('return 301 /es/$is_args$args;');
        expect(nginxConf).toContain(
            'return 301 /es/servicios/$1/$is_args$args;'
        );
        expect(nginxConf).toContain(
            'return 301 /es/legal/aviso-medico/$is_args$args;'
        );
    });
});
