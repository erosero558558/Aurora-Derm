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

test('deploy-public-v3-live usa artefactos publicos versionados y verifica el checkout canonico', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'verify_canonical_public_artifacts() {',
        '"es/index.html"',
        '"en/index.html"',
        '"_astro"',
        '"script.js"',
        '"styles.css"',
        '"styles-deferred.css"',
        '"operador-turnos.html"',
        '"kiosco-turnos.html"',
        '"sala-turnos.html"',
        '"queue-ops.css"',
        '"queue-kiosk.css"',
        '"queue-display.css"',
        '"js/chunks"',
        '"js/engines"',
        '"app-downloads/index.php"',
        '"app-downloads/app-downloads.css"',
        '"app-downloads/app-downloads.js"',
        '"app-downloads/pilot/release-manifest.json"',
        '"app-downloads/pilot/SHA256SUMS.txt"',
        '"app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"',
        '"app-downloads/pilot/operator/win/TurneroOperadorSetup.exe.blockmap"',
        '"desktop-updates/pilot/operator/win/latest.yml"',
        '"desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe"',
        '"desktop-updates/pilot/operator/win/TurneroOperadorSetup.exe.blockmap"',
        'Missing canonical public artifact:',
        'verify_canonical_public_artifacts',
        'normalize_public_web_tree_permissions',
        'ls -ld "$REPO/es" "$REPO/en" "$REPO/_astro" "$REPO/js/chunks" "$REPO/js/engines" "$REPO/app-downloads" "$REPO/desktop-updates" "$REPO/operador-turnos.html" "$REPO/kiosco-turnos.html" "$REPO/sala-turnos.html"',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta verificacion canonica de artefactos versionados en script live V3: ${snippet}`
        );
    }

    assert.doesNotMatch(
        raw,
        /require_cmd npm|npm ci|npm run astro:build|npm run astro:sync/u,
        'deploy-public-v3-live no debe reconstruir artefactos V6 en el host'
    );
});

test('deploy-public-v3-live resetea metadata tracked de Composer para no dejar dirty tree persistente', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'collect_generated_vendor_metadata_files() {',
        '"vendor/autoload.php"',
        '"vendor/composer/autoload_classmap.php"',
        '"vendor/composer/autoload_files.php"',
        '"vendor/composer/autoload_namespaces.php"',
        '"vendor/composer/autoload_psr4.php"',
        'reset_generated_vendor_metadata() {',
        '"vendor/composer/autoload_real.php"',
        '"vendor/composer/autoload_static.php"',
        '"vendor/composer/installed.php"',
        '"vendor/composer/installed.json"',
        '"vendor/composer/InstalledVersions.php"',
        '"vendor/composer/platform_check.php"',
        "git ls-files -- 'vendor/bin/*'",
        'done < <(collect_generated_vendor_metadata_files)',
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

test('deploy-public-v3-live normaliza permisos del arbol publico antes de verificar app-downloads y updates', () => {
    const raw = loadScript(SCRIPT_PATH);

    for (const snippet of [
        'normalize_public_web_tree_permissions() {',
        '"$REPO/app-downloads"',
        '"$REPO/desktop-updates"',
        'find "$public_dir" -type d -exec chmod 0755 {} +',
        'find "$public_dir" -type f -exec chmod 0644 {} +',
        'chmod 0644 "$public_file"',
        'Normalized public web tree permissions.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta normalizacion de permisos publicos en script live V3: ${snippet}`
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
        'LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL:-http://127.0.0.1:8080}"',
        'LOCAL_VERIFY_BASE_URL="${LOCAL_VERIFY_BASE_URL%/}"',
        'return 301 https://\\$host/es/\\$is_args\\$args;',
        's{return 301 /es/}{return 301 https://\\$host/es/}g; s{return 301 /en/}{return 301 https://\\$host/en/}g;',
        'echo "Local verify target: $LOCAL_VERIFY_BASE_URL"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/es/"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/en/"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/telemedicina.html"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/operador-turnos.html"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/kiosco-turnos.html"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/sala-turnos.html"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/app-downloads/"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/app-downloads/?surface=operator&platform=win"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/desktop-updates/pilot/operator/win/latest.yml"',
        'curl -I "$LOCAL_VERIFY_BASE_URL/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe"',
        'curl -I https://pielarmonia.com/',
        'curl -I https://pielarmonia.com/es/',
        'curl -I https://pielarmonia.com/en/',
        'curl -I https://pielarmonia.com/telemedicina.html',
        'curl -I https://pielarmonia.com/operador-turnos.html',
        'curl -I https://pielarmonia.com/kiosco-turnos.html',
        'curl -I https://pielarmonia.com/sala-turnos.html',
        'curl -I https://pielarmonia.com/app-downloads/',
        'curl -I "https://pielarmonia.com/app-downloads/?surface=operator&platform=win"',
        'curl -I https://pielarmonia.com/desktop-updates/pilot/operator/win/latest.yml',
        'curl -I https://pielarmonia.com/app-downloads/pilot/operator/win/TurneroOperadorSetup.exe',
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
