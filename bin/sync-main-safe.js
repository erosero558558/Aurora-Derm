#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { resolve } = require('path');

const DEFAULT_OPTIONS = {
    remote: 'origin',
    branch: 'main',
    sourceRef: '',
    boardPath: 'AGENT_BOARD.yaml',
    autoStash: true,
    autoDiscardDerivedQueueNoise: true,
    push: true,
    maxSyncAttempts: 3,
    dryRun: false,
    json: false,
};

const DERIVED_QUEUE_FILES = new Set(['jules_tasks.md', 'kimi_tasks.md']);

function parseArgs(argv = []) {
    const opts = { ...DEFAULT_OPTIONS };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (!arg) continue;
        if (arg === '--remote') {
            opts.remote = String(argv[i + 1] || '').trim() || opts.remote;
            i += 1;
            continue;
        }
        if (arg === '--branch') {
            opts.branch = String(argv[i + 1] || '').trim() || opts.branch;
            i += 1;
            continue;
        }
        if (arg === '--source-ref') {
            opts.sourceRef = String(argv[i + 1] || '').trim() || opts.sourceRef;
            i += 1;
            continue;
        }
        if (arg === '--board') {
            opts.boardPath = String(argv[i + 1] || '').trim() || opts.boardPath;
            i += 1;
            continue;
        }
        if (arg === '--no-stash') {
            opts.autoStash = false;
            continue;
        }
        if (arg === '--no-auto-discard-derived-queue-noise') {
            opts.autoDiscardDerivedQueueNoise = false;
            continue;
        }
        if (arg === '--no-push') {
            opts.push = false;
            continue;
        }
        if (arg === '--max-sync-attempts') {
            const rawValue = String(argv[i + 1] || '').trim();
            const parsed = Number.parseInt(rawValue, 10);
            if (Number.isFinite(parsed) && parsed >= 1) {
                opts.maxSyncAttempts = parsed;
            }
            i += 1;
            continue;
        }
        if (arg === '--dry-run') {
            opts.dryRun = true;
            continue;
        }
        if (arg === '--json') {
            opts.json = true;
            continue;
        }
    }
    return opts;
}

function buildCommandText(program, args) {
    return [program, ...args]
        .map((token) => {
            const value = String(token);
            return /\s/.test(value) ? `"${value}"` : value;
        })
        .join(' ');
}

function runProcess(program, args, options) {
    const command = buildCommandText(program, args);
    if (options.dryRun) {
        return {
            ok: true,
            code: 0,
            stdout: '',
            stderr: '',
            command,
            dryRun: true,
        };
    }
    const result = spawnSync(program, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
        ok: result.status === 0,
        code: result.status === null ? 1 : result.status,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        command,
        dryRun: false,
    };
}

function parseLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function parseDirtyFiles(statusOutput) {
    const files = [];
    for (const rawLine of String(statusOutput || '').split(/\r?\n/)) {
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;
        const pathPart = line.length > 3 ? line.slice(3).trim() : '';
        if (!pathPart) continue;
        const normalized = normalizePath(pathPart);
        if (normalized.includes(' -> ')) {
            const parts = normalized.split(' -> ');
            files.push(parts[parts.length - 1]);
        } else {
            files.push(normalized);
        }
    }
    return files;
}

function shouldDiscardDerivedQueueNoise(statusOutput) {
    const files = parseDirtyFiles(statusOutput);
    if (files.length === 0) return false;
    return files.every((file) => DERIVED_QUEUE_FILES.has(file));
}

function getUnmergedFiles(runner, options) {
    const result = runner(
        'git',
        ['diff', '--name-only', '--diff-filter=U'],
        options
    );
    if (!result.ok) return [];
    return parseLines(result.stdout);
}

function discardDerivedQueueNoise(runner, options, statusOutput) {
    const files = parseDirtyFiles(statusOutput).filter((file) =>
        DERIVED_QUEUE_FILES.has(file)
    );
    if (files.length === 0) {
        return {
            ok: true,
            code: 0,
            stdout: '',
            stderr: '',
            command: 'git restore --worktree --source=HEAD -- <none>',
            dryRun: Boolean(options.dryRun),
        };
    }
    return runner(
        'git',
        ['restore', '--worktree', '--source=HEAD', '--', ...files],
        options
    );
}

function normalizePath(pathValue) {
    return String(pathValue || '')
        .replace(/\\/g, '/')
        .toLowerCase();
}

function isOnlyBoardConflict(unmergedFiles, boardPath = 'AGENT_BOARD.yaml') {
    if (!Array.isArray(unmergedFiles) || unmergedFiles.length !== 1)
        return false;
    return normalizePath(unmergedFiles[0]) === normalizePath(boardPath);
}

function isRebaseInProgress(repoRoot = process.cwd()) {
    const rebaseMerge = resolve(repoRoot, '.git', 'rebase-merge');
    const rebaseApply = resolve(repoRoot, '.git', 'rebase-apply');
    return existsSync(rebaseMerge) || existsSync(rebaseApply);
}

function isRetryablePushFailure(pushResult) {
    const haystack =
        `${pushResult && pushResult.stderr ? pushResult.stderr : ''}\n${
            pushResult && pushResult.stdout ? pushResult.stdout : ''
        }`.toLowerCase();
    return (
        haystack.includes('fetch first') ||
        haystack.includes('non-fast-forward') ||
        haystack.includes('[rejected]')
    );
}

function runRebaseWithBoardAutoResolve({
    runner,
    options,
    repoRoot,
    result,
    stepPrefix = '',
}) {
    const prefix = stepPrefix ? `${stepPrefix}_` : '';
    const rebaseTarget = `${options.remote}/${options.branch}`;
    const rebaseResult = runner('git', ['rebase', rebaseTarget], options);
    result.steps.push({ name: `${prefix}rebase`, ...rebaseResult });

    if (rebaseResult.ok) return;

    for (
        let attempt = 0;
        attempt < 5 && isRebaseInProgress(repoRoot);
        attempt += 1
    ) {
        const unmerged = getUnmergedFiles(runner, options);
        if (unmerged.length === 0) {
            const continueResult = runner(
                'git',
                ['-c', 'core.editor=true', 'rebase', '--continue'],
                options
            );
            result.steps.push({
                name: `${prefix}rebase_continue_${attempt + 1}`,
                ...continueResult,
            });
            if (!continueResult.ok) {
                throw new Error(
                    `git rebase --continue fallo: ${continueResult.stderr || continueResult.stdout}`
                );
            }
            continue;
        }

        if (!isOnlyBoardConflict(unmerged, options.boardPath)) {
            throw new Error(
                `conflictos no auto-resolubles: ${unmerged.join(', ')}`
            );
        }

        const resolverResult = runner(
            process.execPath,
            [
                resolve(__dirname, 'resolve-board-revision-conflict.js'),
                '--file',
                options.boardPath,
            ],
            options
        );
        result.steps.push({
            name: `${prefix}resolve_board_conflict_${attempt + 1}`,
            ...resolverResult,
        });
        if (!resolverResult.ok) {
            throw new Error(
                `resolver de board fallo: ${resolverResult.stderr || resolverResult.stdout}`
            );
        }

        const addResult = runner('git', ['add', options.boardPath], options);
        result.steps.push({
            name: `${prefix}add_board_${attempt + 1}`,
            ...addResult,
        });
        if (!addResult.ok) {
            throw new Error(
                `git add fallo: ${addResult.stderr || addResult.stdout}`
            );
        }

        const continueResult = runner(
            'git',
            ['-c', 'core.editor=true', 'rebase', '--continue'],
            options
        );
        result.steps.push({
            name: `${prefix}rebase_continue_${attempt + 1}`,
            ...continueResult,
        });
        if (!continueResult.ok) {
            throw new Error(
                `git rebase --continue fallo: ${continueResult.stderr || continueResult.stdout}`
            );
        }
    }

    if (isRebaseInProgress(repoRoot)) {
        throw new Error(
            'rebase quedo en progreso tras intentos de autorresolucion'
        );
    }
}

function printResult(payload, jsonMode) {
    if (jsonMode) {
        console.log(JSON.stringify(payload, null, 2));
        return;
    }
    const status = payload.ok ? 'OK' : 'FAIL';
    console.log(`${status}: ${payload.message}`);
    if (payload.steps && payload.steps.length) {
        for (const step of payload.steps) {
            console.log(
                `- ${step.name}: ${step.command || ''} => ${step.code}`
            );
        }
    }
    if (payload.error) {
        console.log(`- error: ${payload.error}`);
    }
    if (payload.stash && payload.stash.created && !payload.stash.popped) {
        console.log(`- stash pendiente: ${payload.stash.ref}`);
    }
}

function run(argv = process.argv.slice(2), deps = {}) {
    const options = parseArgs(argv);
    const runner = deps.runner || runProcess;
    const repoRoot = deps.repoRoot || process.cwd();
    const result = {
        version: 1,
        ok: false,
        message: '',
        options,
        steps: [],
        stash: { created: false, popped: false, ref: '' },
        error: '',
    };

    try {
        const statusResult = runner('git', ['status', '--porcelain'], options);
        result.steps.push({ name: 'status', ...statusResult });
        if (!statusResult.ok) {
            throw new Error(
                `git status fallo: ${statusResult.stderr || statusResult.stdout}`
            );
        }

        let currentStatus = statusResult;
        let isDirty = parseLines(currentStatus.stdout).length > 0;

        if (
            isDirty &&
            options.autoDiscardDerivedQueueNoise &&
            shouldDiscardDerivedQueueNoise(currentStatus.stdout)
        ) {
            const discardResult = discardDerivedQueueNoise(
                runner,
                options,
                currentStatus.stdout
            );
            result.steps.push({
                name: 'discard_derived_queue_noise',
                ...discardResult,
            });
            if (!discardResult.ok) {
                throw new Error(
                    `git restore de colas derivadas fallo: ${discardResult.stderr || discardResult.stdout}`
                );
            }

            const statusAfterDiscard = runner(
                'git',
                ['status', '--porcelain'],
                options
            );
            result.steps.push({
                name: 'status_after_discard',
                ...statusAfterDiscard,
            });
            if (!statusAfterDiscard.ok) {
                throw new Error(
                    `git status post-discard fallo: ${statusAfterDiscard.stderr || statusAfterDiscard.stdout}`
                );
            }
            currentStatus = statusAfterDiscard;
            isDirty = parseLines(currentStatus.stdout).length > 0;
        }

        if (isDirty && options.autoStash) {
            const stashName = `tmp-sync-main-safe-${new Date().toISOString()}`;
            const stashResult = runner(
                'git',
                ['stash', 'push', '-u', '-m', stashName],
                options
            );
            result.steps.push({ name: 'stash_push', ...stashResult });
            if (!stashResult.ok) {
                throw new Error(
                    `git stash push fallo: ${stashResult.stderr || stashResult.stdout}`
                );
            }
            result.stash.created = true;
            result.stash.ref = 'stash@{0}';
        } else if (isDirty && !options.autoStash) {
            throw new Error('working tree sucio y --no-stash activo');
        }

        const maxSyncAttempts = Math.max(
            1,
            Number(options.maxSyncAttempts) || 1
        );
        for (
            let syncAttempt = 1;
            syncAttempt <= maxSyncAttempts;
            syncAttempt += 1
        ) {
            const suffix = syncAttempt > 1 ? `_retry_${syncAttempt}` : '';
            const fetchResult = runner(
                'git',
                ['fetch', options.remote, options.branch],
                options
            );
            result.steps.push({ name: `fetch${suffix}`, ...fetchResult });
            if (!fetchResult.ok) {
                throw new Error(
                    `git fetch fallo: ${fetchResult.stderr || fetchResult.stdout}`
                );
            }

            runRebaseWithBoardAutoResolve({
                runner,
                options,
                repoRoot,
                result,
                stepPrefix: syncAttempt > 1 ? `retry_${syncAttempt}` : '',
            });

            if (!options.push) {
                break;
            }

            const pushResult = runner(
                'git',
                [
                    'push',
                    options.remote,
                    options.sourceRef
                        ? `${options.sourceRef}:${options.branch}`
                        : options.branch,
                ],
                options
            );
            result.steps.push({ name: `push${suffix}`, ...pushResult });
            if (pushResult.ok) {
                break;
            }

            if (
                syncAttempt < maxSyncAttempts &&
                isRetryablePushFailure(pushResult)
            ) {
                continue;
            }

            throw new Error(
                `git push fallo: ${pushResult.stderr || pushResult.stdout}`
            );
        }

        if (result.stash.created) {
            const popResult = runner(
                'git',
                ['stash', 'pop', result.stash.ref],
                options
            );
            result.steps.push({ name: 'stash_pop', ...popResult });
            if (!popResult.ok) {
                throw new Error(
                    `git stash pop fallo: ${popResult.stderr || popResult.stdout}`
                );
            }
            result.stash.popped = true;
        }

        result.ok = true;
        result.message = 'sync main safe completado';
        printResult(result, options.json);
        return 0;
    } catch (error) {
        result.ok = false;
        result.error = String(error && error.message ? error.message : error);
        result.message = 'sync main safe fallo';
        printResult(result, options.json);
        return 1;
    }
}

if (require.main === module) {
    process.exit(run());
}

module.exports = {
    parseArgs,
    parseLines,
    parseDirtyFiles,
    shouldDiscardDerivedQueueNoise,
    discardDerivedQueueNoise,
    normalizePath,
    isOnlyBoardConflict,
    isRetryablePushFailure,
    runRebaseWithBoardAutoResolve,
    run,
};
