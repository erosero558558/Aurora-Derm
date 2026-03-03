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
    const dirtyCheck = raw.indexOf(
        'if [ -n "$(git status --porcelain)" ]; then'
    );

    assert.notEqual(idleCheck, -1, 'falta check de HEAD sincronizado');
    assert.notEqual(dirtyCheck, -1, 'falta check de working tree dirty');
    assert.equal(
        idleCheck < dirtyCheck,
        true,
        'el wrapper debe marcar idle antes de fallar por dirty tree cuando no hay drift remoto'
    );
});
