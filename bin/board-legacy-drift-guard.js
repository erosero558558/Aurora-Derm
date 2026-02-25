#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const {
    parseBoardContent,
} = require('../tools/agent-orchestrator/core/parsers');
const {
    serializeBoard,
} = require('../tools/agent-orchestrator/core/serializers');
const {
    inferDomainLaneFromFiles,
    ensureTaskDualCodexDefaults,
} = require('../tools/agent-orchestrator/domain/task-guards');

const ROOT = resolve(__dirname, '..');
const BOARD_PATH = resolve(ROOT, 'AGENT_BOARD.yaml');
const TERMINAL_STATUSES = new Set(['done', 'failed']);

function parseArgs(argv = []) {
    const flags = new Set(argv.filter((arg) => String(arg).startsWith('--')));
    return {
        write: flags.has('--write'),
        check: flags.has('--check') || !flags.has('--write'),
        json: flags.has('--json'),
    };
}

function currentDate() {
    return new Date().toISOString().slice(0, 10);
}

function normalizeTask(task) {
    ensureTaskDualCodexDefaults(task);
    const status = String(task.status || '')
        .trim()
        .toLowerCase();
    const files = Array.isArray(task.files) ? task.files : [];
    const inference = inferDomainLaneFromFiles(files);
    const mixed = Boolean(inference.hasCrossDomainFiles);
    const expectedSingleLane = String(inference.lane || 'backend_ops');
    const expectedSingleInstance =
        expectedSingleLane === 'frontend_content'
            ? 'codex_frontend'
            : 'codex_backend_ops';

    const reasons = [];
    if (mixed && !task.cross_domain) {
        reasons.push('mixed_files_requires_cross_domain');
    }
    if (task.cross_domain && String(task.lane_lock) !== 'handoff_allowed') {
        reasons.push('cross_domain_requires_handoff_allowed');
    }
    if (!task.cross_domain && String(task.lane_lock) !== 'strict') {
        reasons.push('non_cross_requires_strict_lane_lock');
    }
    if (!mixed && !task.cross_domain) {
        if (String(task.domain_lane) !== expectedSingleLane) {
            reasons.push('single_lane_domain_mismatch');
        }
        if (String(task.codex_instance) !== expectedSingleInstance) {
            reasons.push('single_lane_instance_mismatch');
        }
    }
    if (
        task.cross_domain &&
        (!Array.isArray(task.depends_on) || task.depends_on.length === 0)
    ) {
        reasons.push('cross_domain_requires_depends_on');
    }

    const isTerminal = TERMINAL_STATUSES.has(status);
    const hasDrift = reasons.length > 0;
    let applied = false;

    if (hasDrift && isTerminal) {
        if (mixed) {
            task.cross_domain = true;
            task.domain_lane = 'backend_ops';
            task.codex_instance = 'codex_backend_ops';
            task.lane_lock = 'handoff_allowed';
            if (!Array.isArray(task.depends_on)) {
                task.depends_on = [];
            }
            if (!task.depends_on.includes('CDX-001')) {
                task.depends_on.push('CDX-001');
            }
        } else {
            task.cross_domain = false;
            task.domain_lane = expectedSingleLane;
            task.codex_instance = expectedSingleInstance;
            task.lane_lock = 'strict';
        }
        if (task.cross_domain && task.lane_lock !== 'handoff_allowed') {
            task.lane_lock = 'handoff_allowed';
        }
        if (
            task.cross_domain &&
            (!Array.isArray(task.depends_on) || task.depends_on.length === 0)
        ) {
            task.depends_on = ['CDX-001'];
        }
        task.updated_at = currentDate();
        applied = true;
    }

    return {
        id: String(task.id || ''),
        status,
        terminal: isTerminal,
        mixed_files: mixed,
        reasons,
        applied,
    };
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!existsSync(BOARD_PATH)) {
        const error = `No existe ${BOARD_PATH}`;
        if (opts.json) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: false,
                        error,
                        error_code: 'board_not_found',
                    },
                    null,
                    2
                )
            );
            process.exit(1);
        }
        throw new Error(error);
    }

    const boardRaw = readFileSync(BOARD_PATH, 'utf8');
    const board = parseBoardContent(boardRaw);

    const findings = [];
    let fixes = 0;
    for (const task of board.tasks || []) {
        const result = normalizeTask(task);
        if (result.reasons.length > 0) {
            findings.push(result);
        }
        if (result.applied) {
            fixes += 1;
        }
    }

    if (opts.write && fixes > 0) {
        writeFileSync(
            BOARD_PATH,
            serializeBoard(board, {
                currentDate,
            }),
            'utf8'
        );
    }

    const remaining = findings.filter((item) => !item.applied);
    const payload = {
        version: 1,
        ok: remaining.length === 0,
        mode: opts.write ? 'write' : 'check',
        board_path: BOARD_PATH,
        findings_total: findings.length,
        normalized_total: fixes,
        remaining_total: remaining.length,
        findings,
        remaining,
    };

    if (opts.json) {
        console.log(JSON.stringify(payload, null, 2));
    } else {
        console.log(
            `Legacy board drift: findings=${payload.findings_total}, normalized=${payload.normalized_total}, remaining=${payload.remaining_total}`
        );
        for (const item of payload.remaining) {
            console.log(
                `- ${item.id} [${item.status}] reasons=${item.reasons.join(', ')}`
            );
        }
    }

    if (opts.check && remaining.length > 0) {
        process.exit(1);
    }
}

main();
