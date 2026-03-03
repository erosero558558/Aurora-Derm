#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const SCRIPT_PATH = resolve(__dirname, '..', 'bin', 'deploy-public-v3-live.sh');
const LEGACY_SHIM_PATH = resolve(
    __dirname,
    '..',
    'bin',
    'deploy-public-v2-live.sh'
);

function loadScript(filePath) {
    return readFileSync(filePath, 'utf8');
}

test('deploy-public-v3-live recompone artefactos Astro ES/EN y verifica output', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'npm run astro:build',
        'npm run astro:sync',
        'test -f "$REPO/es/index.html"',
        'test -f "$REPO/en/index.html"',
        'test -d "$REPO/_astro"',
        'ls -ld "$REPO/es" "$REPO/en" "$REPO/_astro"',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta verificacion/build Astro en script live V3: ${snippet}`
        );
    }
});

test('deploy-public-v3-live resetea metadata tracked de Composer para no dejar dirty tree persistente', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'reset_generated_vendor_metadata() {',
        '"vendor/composer/autoload_real.php"',
        '"vendor/composer/autoload_static.php"',
        '"vendor/composer/installed.php"',
        'git checkout -- "${tracked_files[@]}"',
        'Reset tracked Composer-generated metadata.',
        'composer install --no-dev --optimize-autoloader --prefer-dist --no-progress',
        'reset_generated_vendor_metadata',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta saneamiento de metadata Composer en script live V3: ${snippet}`
        );
    }
});

test('deploy-public-v3-live endurece nginx sin depender de PATH', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'NGINX_BIN="${NGINX_BIN:-/usr/sbin/nginx}"',
        'test -x "$NGINX_BIN"',
        '"$NGINX_BIN" -t',
        'systemctl reload nginx',
        'absolute_redirect off;',
        'port_in_redirect off;',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta hardening nginx en script live V3: ${snippet}`
        );
    }
});

test('deploy-public-v3-live neutraliza cron destructivo que borra artefactos no versionados', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'DISABLE_DESTRUCTIVE_SYNC_CRON="${DISABLE_DESTRUCTIVE_SYNC_CRON:-true}"',
        '== Cron guard ==',
        'command -v crontab',
        'index($0, repo) && index($0, "git clean -fd") { next }',
        'Removed destructive cron entries targeting $REPO with git clean -fd.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta guard contra cron destructivo en script live V3: ${snippet}`
        );
    }
});

test('deploy-public-v3-live corrige redirects canonicos y valida rutas publicas criticas', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'return 301 https://\\$host/es/\\$is_args\\$args;',
        's{return 301 /es/}{return 301 https://\\$host/es/}g; s{return 301 /en/}{return 301 https://\\$host/en/}g;',
        'curl -I http://127.0.0.1:8080/es/',
        'curl -I http://127.0.0.1:8080/en/',
        'curl -I https://pielarmonia.com/',
        'curl -I https://pielarmonia.com/es/',
        'curl -I https://pielarmonia.com/en/',
        'curl -I https://pielarmonia.com/telemedicina.html',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta redirect/verify critical path en script live V3: ${snippet}`
        );
    }
});

test('deploy-public-v2-live se mantiene como shim de compatibilidad hacia V3', () => {
    const raw = loadScript(LEGACY_SHIM_PATH);

    for (const snippet of [
        'DEPRECATED: deploy-public-v2-live.sh now delegates to deploy-public-v3-live.sh',
        'deploy-public-v3-live.sh',
        'exec bash "$SCRIPT_DIR/deploy-public-v3-live.sh" "$@"',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta comportamiento de shim en wrapper legacy: ${snippet}`
        );
    }
});
