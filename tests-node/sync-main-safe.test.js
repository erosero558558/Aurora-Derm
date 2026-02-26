#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseArgs,
    parseLines,
    normalizePath,
    isOnlyBoardConflict,
    isRetryablePushFailure,
    run,
} = require('../bin/sync-main-safe');

test('sync-main-safe parseArgs aplica defaults', () => {
    const opts = parseArgs([]);
    assert.equal(opts.remote, 'origin');
    assert.equal(opts.branch, 'main');
    assert.equal(opts.boardPath, 'AGENT_BOARD.yaml');
    assert.equal(opts.autoStash, true);
    assert.equal(opts.push, true);
    assert.equal(opts.maxSyncAttempts, 3);
    assert.equal(opts.dryRun, false);
    assert.equal(opts.json, false);
});

test('sync-main-safe parseArgs reconoce flags principales', () => {
    const opts = parseArgs([
        '--remote',
        'upstream',
        '--branch',
        'release',
        '--board',
        'AGENT_BOARD.yaml',
        '--no-stash',
        '--no-push',
        '--max-sync-attempts',
        '5',
        '--dry-run',
        '--json',
    ]);
    assert.equal(opts.remote, 'upstream');
    assert.equal(opts.branch, 'release');
    assert.equal(opts.boardPath, 'AGENT_BOARD.yaml');
    assert.equal(opts.autoStash, false);
    assert.equal(opts.push, false);
    assert.equal(opts.maxSyncAttempts, 5);
    assert.equal(opts.dryRun, true);
    assert.equal(opts.json, true);
});

test('sync-main-safe parseLines limpia salida vacia de git', () => {
    assert.deepEqual(parseLines('\r\n \n'), []);
    assert.deepEqual(parseLines('A\nB\r\nC'), ['A', 'B', 'C']);
});

test('sync-main-safe detecta conflicto exclusivo de AGENT_BOARD', () => {
    assert.equal(isOnlyBoardConflict(['AGENT_BOARD.yaml']), true);
    assert.equal(isOnlyBoardConflict(['agent_board.yaml']), true);
    assert.equal(isOnlyBoardConflict(['AGENT_BOARD.yaml', 'README.md']), false);
    assert.equal(isOnlyBoardConflict(['README.md']), false);
});

test('sync-main-safe normaliza paths en formato cross-platform', () => {
    assert.equal(normalizePath('AGENT_BOARD.yaml'), 'agent_board.yaml');
    assert.equal(normalizePath('a\\b\\C.md'), 'a/b/c.md');
});

test('sync-main-safe detecta push retryable por fetch first/non-fast-forward', () => {
    assert.equal(
        isRetryablePushFailure({
            stderr: 'Updates were rejected because the remote contains work that you do not have locally (fetch first).',
        }),
        true
    );
    assert.equal(
        isRetryablePushFailure({
            stderr: '! [rejected] main -> main (non-fast-forward)',
        }),
        true
    );
    assert.equal(
        isRetryablePushFailure({ stderr: 'permission denied' }),
        false
    );
});

test('sync-main-safe reintenta fetch/rebase/push tras rechazo retryable', () => {
    const calls = [];
    let pushCount = 0;

    const fakeRunner = (program, args) => {
        const command = `${program} ${args.join(' ')}`;
        calls.push(command);

        if (program !== 'git') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }

        if (args[0] === 'status') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'fetch') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'rebase') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'push') {
            pushCount += 1;
            if (pushCount === 1) {
                return {
                    ok: false,
                    code: 1,
                    stdout: '',
                    stderr: 'Updates were rejected (fetch first).',
                    command,
                };
            }
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }
        if (args[0] === 'stash') {
            return { ok: true, code: 0, stdout: '', stderr: '', command };
        }

        return { ok: true, code: 0, stdout: '', stderr: '', command };
    };

    const code = run(['--max-sync-attempts', '3', '--json'], {
        runner: fakeRunner,
    });
    assert.equal(code, 0);
    assert.equal(pushCount, 2);
    assert.equal(
        calls.filter((entry) => entry.startsWith('git fetch ')).length >= 2,
        true
    );
});
