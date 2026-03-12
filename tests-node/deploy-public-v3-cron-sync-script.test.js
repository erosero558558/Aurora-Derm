#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const SCRIPT_PATH = resolve(
    __dirname,
    '..',
    'bin',
    'deploy-public-v3-cron-sync.sh'
);

function loadScript() {
    return readFileSync(SCRIPT_PATH, 'utf8');
}

test('deploy-public-v3-cron-sync soporta JOB_ID y status runtime externo', () => {
    const raw = loadScript();

    for (const snippet of [
        'JOB_ID="${JOB_ID:-8d31e299-7e57-4959-80b5-aaa2d73e9674}"',
        'PUBLIC_SYNC_JOB_KEY="${PUBLIC_SYNC_JOB_KEY:-public_main_sync}"',
        'PUBLIC_SYNC_STATUS_PATH="${PUBLIC_SYNC_STATUS_PATH:-/var/lib/pielarmonia/public-sync-status.json}"',
        '"job_id": "$(json_escape "$JOB_ID")"',
        '"job_key": "$(json_escape "$PUBLIC_SYNC_JOB_KEY")"',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta soporte de runtime job/status en cron sync: ${snippet}`
        );
    }
});

test('deploy-public-v3-cron-sync unifica defaults productivos y escribe status atomico', () => {
    const raw = loadScript();

    for (const snippet of [
        'LOCK_FILE="${LOCK_FILE:-/tmp/sync-pielarmonia.lock}"',
        'LOG_PATH="${LOG_PATH:-/var/log/sync-pielarmonia.log}"',
        'require_cmd mktemp',
        'require_cmd mv',
        'tmp_file="$(mktemp "${PUBLIC_SYNC_STATUS_PATH}.tmp.XXXXXX")"',
        'chmod 0644 "$tmp_file"',
        'mv "$tmp_file" "$PUBLIC_SYNC_STATUS_PATH"',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta default o write atomico en cron sync: ${snippet}`
        );
    }
});

test('deploy-public-v3-cron-sync registra estados running/idle/ok/failed con trap', () => {
    const raw = loadScript();

    for (const snippet of [
        'trap on_exit EXIT',
        'write_status "failed"',
        'write_status "running"',
        'STATE="idle"',
        'STATE="ok"',
        '"state": "$(json_escape "$state_value")"',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta transicion de estado en cron sync: ${snippet}`
        );
    }
});

test('deploy-public-v3-cron-sync permite idle con HEAD sincronizado antes de bloquear por dirty tree', () => {
    const raw = loadScript();
    const idleCheck = raw.indexOf(
        'if [ "$CURRENT_HEAD" = "$REMOTE_HEAD" ]; then'
    );
    const restoreCall = raw.indexOf(
        'if ! restore_canonical_derived_paths; then'
    );
    const dirtyCheck = raw.indexOf('LAST_ERROR_MESSAGE="working_tree_dirty"');

    assert.notEqual(idleCheck, -1, 'falta check de HEAD sincronizado');
    assert.notEqual(
        restoreCall,
        -1,
        'falta intento de saneamiento de artefactos canonicos antes del dirty tree'
    );
    assert.notEqual(dirtyCheck, -1, 'falta check de working tree dirty');
    assert.equal(
        idleCheck < dirtyCheck,
        true,
        'el wrapper debe marcar idle antes de fallar por dirty tree cuando no hay drift remoto'
    );
    assert.equal(
        restoreCall < dirtyCheck,
        true,
        'el wrapper debe intentar restaurar paths canonicos antes de marcar working_tree_dirty'
    );
});

test('deploy-public-v3-cron-sync solo autolimpia ruido derivado canonico antes de desplegar', () => {
    const raw = loadScript();

    for (const snippet of [
        'composer_generated_vendor_path_allowed() {',
        'canonical_derived_path_allowed() {',
        'es/*|en/*|_astro/*|script.js|styles.css|styles-deferred.css|js/chunks/*|js/engines/*)',
        'vendor/autoload.php|vendor/bin/*|vendor/composer/autoload_classmap.php|vendor/composer/autoload_files.php|vendor/composer/autoload_namespaces.php|vendor/composer/autoload_psr4.php|vendor/composer/autoload_real.php|vendor/composer/autoload_static.php|vendor/composer/installed.php|vendor/composer/installed.json|vendor/composer/InstalledVersions.php|vendor/composer/platform_check.php)',
        'composer_generated_vendor_path_allowed "$1"',
        'collect_dirty_paths() {',
        'restore_canonical_derived_paths() {',
        'record_dirty_path_telemetry "${dirty_paths[@]}"',
        'reset_dirty_path_telemetry',
        'git restore --worktree --source=HEAD -- "${tracked_restore[@]}"',
        'git clean -fd -- "${clean_targets[@]}"',
        'Restored canonical derived publish paths from HEAD.',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta saneamiento conservador de ruido canonico en cron sync: ${snippet}`
        );
    }
});

test('deploy-public-v3-cron-sync expone telemetria de dirty paths en el status runtime', () => {
    const raw = loadScript();

    for (const snippet of [
        'DIRTY_PATHS_COUNT=0',
        'DIRTY_PATHS_JSON="[]"',
        'DIRTY_PATHS_SAMPLE_JSON="[]"',
        'json_array_from_args() {',
        'record_dirty_path_telemetry() {',
        'local dirty_paths_sample=("${dirty_paths[@]:0:10}")',
        '"dirty_paths_count": $DIRTY_PATHS_COUNT',
        '"dirty_paths_sample": $DIRTY_PATHS_SAMPLE_JSON',
        '"dirty_paths": $DIRTY_PATHS_JSON',
    ]) {
        assert.equal(
            raw.includes(snippet),
            true,
            `falta telemetria de dirty paths en cron sync: ${snippet}`
        );
    }
});
