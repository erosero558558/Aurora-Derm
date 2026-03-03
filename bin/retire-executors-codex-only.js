#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('fs');
const { resolve } = require('path');
const coreParsers = require('../tools/agent-orchestrator/core/parsers');
const coreSerializers = require('../tools/agent-orchestrator/core/serializers');
const taskGuards = require('../tools/agent-orchestrator/domain/task-guards');

const TERMINAL_STATUSES = new Set(['done', 'failed']);
const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);
const RETIRED_EXECUTORS = new Set(['claude', 'jules', 'kimi']);

function parseArgs(argv = []) {
    const options = {
        boardPath: resolve(process.cwd(), 'AGENT_BOARD.yaml'),
        apply: false,
        json: false,
        expectRev: null,
    };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = String(argv[index] || '').trim();
        if (!arg) continue;
        if (arg === '--file') {
            options.boardPath = resolve(
                process.cwd(),
                String(argv[index + 1] || '').trim() || 'AGENT_BOARD.yaml'
            );
            index += 1;
            continue;
        }
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg === '--expect-rev') {
            const parsed = Number.parseInt(
                String(argv[index + 1] || '').trim(),
                10
            );
            if (Number.isFinite(parsed)) {
                options.expectRev = parsed;
            }
            index += 1;
        }
    }
    return options;
}

function normalizePath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase();
}

function hasOverlap(leftFiles = [], rightFiles = []) {
    const left = new Set((leftFiles || []).map(normalizePath).filter(Boolean));
    const right = new Set(
        (rightFiles || []).map(normalizePath).filter(Boolean)
    );
    if (left.size === 0 || right.size === 0) return false;
    for (const file of left) {
        if (right.has(file)) return true;
    }
    return false;
}

function inferCodexLane(task) {
    const inferred = taskGuards.inferDomainLaneFromFiles(task.files || []);
    const isCritical =
        Boolean(task.critical_zone) ||
        String(task.runtime_impact || '').toLowerCase() === 'high';
    if (
        isCritical ||
        inferred.hasCrossDomainFiles ||
        inferred.lane === 'backend_ops'
    ) {
        return {
            domain_lane: 'backend_ops',
            codex_instance: 'codex_backend_ops',
        };
    }
    return {
        domain_lane: 'frontend_content',
        codex_instance: 'codex_frontend',
    };
}

function migrateBoard(board) {
    const changes = [];
    for (const task of board.tasks || []) {
        const executor = String(task.executor || '')
            .trim()
            .toLowerCase();
        const status = String(task.status || '')
            .trim()
            .toLowerCase();
        if (!RETIRED_EXECUTORS.has(executor) || TERMINAL_STATUSES.has(status)) {
            continue;
        }

        const nextLane = inferCodexLane(task);
        const nextTask = {
            ...task,
            executor: 'codex',
            domain_lane: nextLane.domain_lane,
            codex_instance: nextLane.codex_instance,
        };
        taskGuards.ensureTaskDualCodexDefaults(nextTask);

        const hasBlockingActiveOverlap = (board.tasks || []).some(
            (otherTask) => {
                if (otherTask === task) return false;
                if (
                    !ACTIVE_STATUSES.has(
                        String(otherTask.status || '')
                            .trim()
                            .toLowerCase()
                    )
                ) {
                    return false;
                }
                if (
                    String(otherTask.codex_instance || '')
                        .trim()
                        .toLowerCase() !==
                    String(nextTask.codex_instance || '')
                        .trim()
                        .toLowerCase()
                ) {
                    return false;
                }
                return hasOverlap(nextTask.files, otherTask.files);
            }
        );

        if (hasBlockingActiveOverlap) {
            nextTask.status = 'backlog';
            nextTask.blocked_reason =
                'retired_executor_conflict_migrated_to_backlog';
        }

        changes.push({
            id: String(task.id || ''),
            from_executor: executor,
            to_executor: 'codex',
            from_status: status,
            to_status: String(nextTask.status || ''),
            codex_instance: String(nextTask.codex_instance || ''),
        });
        Object.assign(task, nextTask);
    }
    return changes;
}

function main(argv = process.argv.slice(2)) {
    const options = parseArgs(argv);
    const raw = readFileSync(options.boardPath, 'utf8');
    const board = coreParsers.parseBoardContent(raw);
    const currentRevision = Number.parseInt(
        String(board?.policy?.revision || '0'),
        10
    );

    if (options.apply && !Number.isFinite(options.expectRev)) {
        throw new Error('--apply requiere --expect-rev <revision_actual>');
    }
    if (
        options.apply &&
        Number.isFinite(options.expectRev) &&
        options.expectRev !== currentRevision
    ) {
        throw new Error(
            `board revision mismatch: expected ${options.expectRev}, actual ${currentRevision}`
        );
    }

    const changes = migrateBoard(board);
    if (options.apply && changes.length > 0) {
        board.policy = board.policy || {};
        board.policy.revision = currentRevision + 1;
        writeFileSync(
            options.boardPath,
            coreSerializers.serializeBoard(board),
            'utf8'
        );
    }

    const report = {
        version: 1,
        ok: true,
        apply: options.apply,
        board_path: options.boardPath,
        current_revision: currentRevision,
        next_revision:
            options.apply && changes.length > 0
                ? currentRevision + 1
                : currentRevision,
        migrated_tasks: changes.length,
        changes,
    };

    if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
    }

    console.log(`Migrated tasks: ${changes.length}`);
    if (changes.length > 0) {
        for (const change of changes) {
            console.log(
                `- ${change.id}: ${change.from_executor} -> ${change.to_executor} (${change.to_status}, ${change.codex_instance})`
            );
        }
    }
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`ERROR: ${error.message}`);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    migrateBoard,
    inferCodexLane,
};
