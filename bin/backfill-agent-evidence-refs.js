#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');
const coreParsers = require('../tools/agent-orchestrator/core/parsers');
const coreSerializers = require('../tools/agent-orchestrator/core/serializers');
const coreIo = require('../tools/agent-orchestrator/core/io');
const reportEvidenceGaps = require('./report-agent-evidence-gaps');

const ROOT_DIR = resolve(__dirname, '..');
const DEFAULT_BOARD_PATH = resolve(ROOT_DIR, 'AGENT_BOARD.yaml');
const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);

function currentDate() {
    return new Date().toISOString().slice(0, 10);
}

function parseRevision(value) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function parseArgs(argv = [], cwd = process.cwd()) {
    const options = {
        boardPath: DEFAULT_BOARD_PATH,
        json: false,
        apply: false,
        expectRev: null,
        ids: [],
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (!arg) continue;

        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg === '--apply') {
            options.apply = true;
            continue;
        }
        if (arg === '--board') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--board requiere ruta');
            options.boardPath = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--expect-rev' || arg === '--expect_rev') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--expect-rev requiere entero >= 0');
            const parsed = parseRevision(value);
            if (String(parsed) !== value && parsed !== Number(value)) {
                throw new Error('--expect-rev requiere entero >= 0');
            }
            options.expectRev = parsed;
            i += 1;
            continue;
        }
        if (arg === '--ids') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--ids requiere lista csv');
            options.ids = value
                .split(',')
                .map((part) => String(part || '').trim())
                .filter(Boolean);
            i += 1;
            continue;
        }

        throw new Error(
            `Flag no soportado: ${arg}. Usa --json --apply --board --expect-rev --ids`
        );
    }

    if (options.apply && options.expectRev === null) {
        throw new Error(
            'backfill-agent-evidence-refs --apply requiere --expect-rev para evitar carreras de AGENT_BOARD.yaml'
        );
    }

    return options;
}

function loadBoard(boardPath) {
    return coreParsers.parseBoardContent(readFileSync(boardPath, 'utf8'), {
        allowedStatuses: ALLOWED_STATUSES,
    });
}

function buildCandidates(board, options = {}) {
    const boardPath = options.boardPath || DEFAULT_BOARD_PATH;
    const rootDir = options.rootDir || dirname(boardPath);
    const report = reportEvidenceGaps.buildEvidenceGapReport(board, {
        boardPath,
        evidenceDir: resolve(rootDir, 'verification/agent-runs'),
        rootDir,
    });

    const filterIds = new Set(
        (Array.isArray(options.ids) ? options.ids : []).map((id) =>
            String(id || '').trim()
        )
    );

    const candidates = (report.backfill_candidates || []).filter((row) => {
        if (!row.expected_evidence_exists) return false;
        if (filterIds.size === 0) return true;
        return filterIds.has(String(row.id || '').trim());
    });

    return {
        report,
        candidates,
    };
}

function previewBackfill(board, options = {}) {
    const revisionBefore = parseRevision(board?.policy?.revision);
    const { report, candidates } = buildCandidates(board, options);
    const candidateMap = new Map(candidates.map((row) => [row.id, row]));
    const changes = [];

    for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
        const row = candidateMap.get(String(task.id || '').trim());
        if (!row) continue;

        const nextEvidenceRef = row.expected_evidence_ref;
        const nextAcceptanceRef = row.expected_evidence_ref;
        const previousEvidenceRef = String(task.evidence_ref || '').trim();
        const previousAcceptanceRef = String(task.acceptance_ref || '').trim();

        if (
            previousEvidenceRef === nextEvidenceRef &&
            previousAcceptanceRef === nextAcceptanceRef
        ) {
            continue;
        }

        changes.push({
            id: row.id,
            previous_evidence_ref: previousEvidenceRef,
            next_evidence_ref: nextEvidenceRef,
            previous_acceptance_ref: previousAcceptanceRef,
            next_acceptance_ref: nextAcceptanceRef,
            reasons: row.reasons,
        });
    }

    return {
        version: 1,
        ok: true,
        command: 'backfill-agent-evidence-refs',
        board_path: report.board_path,
        revision_before: revisionBefore,
        apply: Boolean(options.apply),
        filter_ids: Array.isArray(options.ids) ? options.ids : [],
        scanned_backfill_candidates: candidates.length,
        changes,
    };
}

function applyBackfill(board, preview, options = {}) {
    const revisionBefore = parseRevision(board?.policy?.revision);
    const expectedRevision = options.expectRev;

    if (expectedRevision !== null && expectedRevision !== revisionBefore) {
        const error = new Error(
            `board revision mismatch: expected ${expectedRevision}, actual ${revisionBefore}`
        );
        error.code = 'board_revision_mismatch';
        error.error_code = 'board_revision_mismatch';
        error.expected_revision = expectedRevision;
        error.actual_revision = revisionBefore;
        throw error;
    }

    if (!Array.isArray(preview.changes) || preview.changes.length === 0) {
        return {
            ...preview,
            applied: false,
            revision_after: revisionBefore,
        };
    }

    const changeMap = new Map(
        (preview.changes || []).map((change) => [change.id, change])
    );

    for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
        const change = changeMap.get(String(task.id || '').trim());
        if (!change) continue;
        task.acceptance_ref = change.next_acceptance_ref;
        task.evidence_ref = change.next_evidence_ref;
    }

    board.policy = board.policy || {};
    board.policy.revision = revisionBefore + 1;
    coreIo.writeBoardFile(board, {
        currentDate,
        boardPath: options.boardPath || DEFAULT_BOARD_PATH,
        serializeBoard: coreSerializers.serializeBoard,
        writeFile: writeFileSync,
    });

    return {
        ...preview,
        applied: true,
        revision_after: revisionBefore + 1,
    };
}

function run(options = {}) {
    const boardPath = options.boardPath || DEFAULT_BOARD_PATH;
    const rootDir = options.rootDir || dirname(boardPath);
    const board = loadBoard(boardPath);
    const preview = previewBackfill(board, {
        ...options,
        boardPath,
        rootDir,
    });
    if (!options.apply) {
        return {
            ...preview,
            applied: false,
            revision_after: preview.revision_before,
        };
    }
    return applyBackfill(board, preview, {
        ...options,
        boardPath,
        rootDir,
    });
}

function printTextSummary(result) {
    console.log('Backfill agent evidence refs');
    console.log(`revision_before=${result.revision_before}`);
    console.log(`revision_after=${result.revision_after}`);
    console.log(
        `changes=${Array.isArray(result.changes) ? result.changes.length : 0}`
    );
    if (Array.isArray(result.changes)) {
        for (const change of result.changes) {
            console.log(
                `- ${change.id}: evidence ${change.previous_evidence_ref || '(empty)'} -> ${change.next_evidence_ref}; acceptance ${change.previous_acceptance_ref || '(empty)'} -> ${change.next_acceptance_ref}`
            );
        }
    }
}

if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2), process.cwd());
        const result = run(options);
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            printTextSummary(result);
        }
    } catch (error) {
        const payload = {
            version: 1,
            ok: false,
            command: 'backfill-agent-evidence-refs',
            error: error instanceof Error ? error.message : String(error),
            error_code:
                error && typeof error === 'object' && error.error_code
                    ? error.error_code
                    : 'backfill_failed',
        };
        if (error && typeof error === 'object') {
            if (typeof error.expected_revision === 'number') {
                payload.expected_revision = error.expected_revision;
            }
            if (typeof error.actual_revision === 'number') {
                payload.actual_revision = error.actual_revision;
            }
        }
        console.error(JSON.stringify(payload, null, 2));
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    previewBackfill,
    applyBackfill,
    run,
};
