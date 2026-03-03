#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, relative, resolve } = require('path');
const coreParsers = require('../tools/agent-orchestrator/core/parsers');

const ROOT_DIR = resolve(__dirname, '..');
const DEFAULT_BOARD_PATH = resolve(ROOT_DIR, 'AGENT_BOARD.yaml');
const DEFAULT_EVIDENCE_DIR = resolve(ROOT_DIR, 'verification/agent-runs');
const TERMINAL_STATUSES = new Set(['done', 'failed']);
const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);

function parseArgs(argv = [], cwd = process.cwd()) {
    const options = {
        boardPath: DEFAULT_BOARD_PATH,
        evidenceDir: DEFAULT_EVIDENCE_DIR,
        writeJsonPath: '',
        writeMarkdownPath: '',
        json: false,
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = String(argv[i] || '').trim();
        if (!arg) continue;

        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg === '--board') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--board requiere ruta');
            options.boardPath = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--evidence-dir') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--evidence-dir requiere ruta');
            options.evidenceDir = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--write-json') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--write-json requiere ruta');
            options.writeJsonPath = resolve(cwd, value);
            i += 1;
            continue;
        }
        if (arg === '--write-md') {
            const value = String(argv[i + 1] || '').trim();
            if (!value) throw new Error('--write-md requiere ruta');
            options.writeMarkdownPath = resolve(cwd, value);
            i += 1;
            continue;
        }

        throw new Error(
            `Flag no soportado: ${arg}. Usa --json --board --evidence-dir --write-json --write-md`
        );
    }

    return options;
}

function ensureDirForFile(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function normalizeRelativePath(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/$/, '');
}

function expectedEvidenceRef(
    taskId,
    evidenceDir = DEFAULT_EVIDENCE_DIR,
    rootDir = ROOT_DIR
) {
    const relDir = normalizeRelativePath(relative(rootDir, evidenceDir));
    return `${relDir}/${taskId}.md`;
}

function bucketReference(ref, expectedRef, refExists) {
    const value = String(ref || '').trim();
    if (!value) return 'missing';
    if (value === expectedRef) return 'expected';
    if (value.startsWith('queue:')) return 'queue';
    if (value.startsWith('verification/agent-runs/')) {
        return refExists
            ? 'verification_other_existing'
            : 'verification_other_missing';
    }
    return 'other';
}

function summarizeBuckets(rows, key) {
    const summary = {};
    for (const row of rows) {
        const bucket = String(row[key] || 'unknown');
        summary[bucket] = (summary[bucket] || 0) + 1;
    }
    return summary;
}

function buildRow(task, options, deps) {
    const rootDir = options.rootDir || ROOT_DIR;
    const evidenceDir = options.evidenceDir || DEFAULT_EVIDENCE_DIR;
    const fileExists = deps.existsSync || existsSync;
    const taskId = String(task.id || '').trim();
    const expectedRef = expectedEvidenceRef(taskId, evidenceDir, rootDir);
    const expectedEvidencePath = resolve(rootDir, expectedRef);
    const expectedEvidenceExists = fileExists(expectedEvidencePath);

    const evidenceRef = String(task.evidence_ref || '').trim();
    const acceptanceRef = String(task.acceptance_ref || '').trim();
    const evidenceRefPath = evidenceRef ? resolve(rootDir, evidenceRef) : '';
    const acceptanceRefPath = acceptanceRef
        ? resolve(rootDir, acceptanceRef)
        : '';

    const evidenceRefExists = evidenceRefPath
        ? fileExists(evidenceRefPath)
        : false;
    const acceptanceRefExists = acceptanceRefPath
        ? fileExists(acceptanceRefPath)
        : false;

    const evidenceBucket = bucketReference(
        evidenceRef,
        expectedRef,
        evidenceRefExists
    );
    const acceptanceBucket = bucketReference(
        acceptanceRef,
        expectedRef,
        acceptanceRefExists
    );

    const reasons = [];
    if (expectedEvidenceExists && evidenceRef !== expectedRef) {
        if (evidenceBucket === 'queue') {
            reasons.push('queue_ref_can_be_backfilled');
        } else if (evidenceBucket === 'missing') {
            reasons.push('missing_evidence_ref_can_be_backfilled');
        } else if (
            evidenceBucket === 'verification_other_existing' ||
            evidenceBucket === 'verification_other_missing'
        ) {
            reasons.push('mismatched_evidence_ref');
        } else {
            reasons.push('non_standard_evidence_ref');
        }
    }

    if (expectedEvidenceExists && acceptanceRef !== expectedRef) {
        if (acceptanceBucket === 'missing') {
            reasons.push('missing_acceptance_ref_can_be_backfilled');
        } else if (
            acceptanceBucket === 'verification_other_existing' ||
            acceptanceBucket === 'verification_other_missing'
        ) {
            reasons.push('mismatched_acceptance_ref');
        } else if (acceptanceBucket === 'queue') {
            reasons.push('queue_acceptance_ref_can_be_backfilled');
        } else if (acceptanceBucket === 'other') {
            reasons.push('non_standard_acceptance_ref');
        }
    }

    if (!expectedEvidenceExists) {
        reasons.push('expected_evidence_file_missing');
    }

    return {
        id: taskId,
        status: String(task.status || '').trim(),
        owner: String(task.owner || '').trim(),
        executor: String(task.executor || '').trim(),
        updated_at: String(
            task.updated_at || task.status_since_at || ''
        ).trim(),
        expected_evidence_ref: expectedRef,
        expected_evidence_exists: expectedEvidenceExists,
        evidence_ref: evidenceRef,
        evidence_ref_bucket: evidenceBucket,
        evidence_ref_exists: evidenceRefExists,
        acceptance_ref: acceptanceRef,
        acceptance_ref_bucket: acceptanceBucket,
        acceptance_ref_exists: acceptanceRefExists,
        backfill_candidate:
            expectedEvidenceExists &&
            (evidenceRef !== expectedRef || acceptanceRef !== expectedRef),
        reasons,
        files: Array.isArray(task.files) ? task.files : [],
    };
}

function buildEvidenceGapReport(board, options = {}, deps = {}) {
    const rootDir = options.rootDir || ROOT_DIR;
    const rows = (Array.isArray(board?.tasks) ? board.tasks : [])
        .filter((task) =>
            TERMINAL_STATUSES.has(
                String(task.status || '')
                    .trim()
                    .toLowerCase()
            )
        )
        .map((task) => buildRow(task, options, deps))
        .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    const backfillCandidates = rows.filter((row) => row.backfill_candidate);
    const expectedMissing = rows.filter((row) =>
        row.reasons.includes('expected_evidence_file_missing')
    );
    const aligned = rows.filter(
        (row) =>
            row.expected_evidence_exists &&
            row.evidence_ref === row.expected_evidence_ref &&
            row.acceptance_ref === row.expected_evidence_ref
    );
    const mismatchedVerificationRefs = rows.filter((row) =>
        row.reasons.some((reason) => reason.startsWith('mismatched_'))
    );

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        board_path: normalizeRelativePath(
            relative(rootDir, options.boardPath || DEFAULT_BOARD_PATH)
        ),
        evidence_dir: normalizeRelativePath(
            relative(rootDir, options.evidenceDir || DEFAULT_EVIDENCE_DIR)
        ),
        summary: {
            terminal_tasks: rows.length,
            expected_evidence_exists: rows.filter(
                (row) => row.expected_evidence_exists
            ).length,
            expected_evidence_missing: expectedMissing.length,
            aligned_count: aligned.length,
            backfill_candidate_count: backfillCandidates.length,
            mismatched_reference_count: mismatchedVerificationRefs.length,
            evidence_ref_buckets: summarizeBuckets(rows, 'evidence_ref_bucket'),
            acceptance_ref_buckets: summarizeBuckets(
                rows,
                'acceptance_ref_bucket'
            ),
        },
        backfill_candidates: backfillCandidates,
        missing_expected_evidence: expectedMissing,
        mismatched_references: mismatchedVerificationRefs,
        rows,
    };
}

function formatMarkdown(report) {
    const summary = report.summary || {};
    const lines = [
        '# Governance Evidence Gap Report',
        '',
        `Generated at: ${report.generated_at}`,
        `Board: ${report.board_path}`,
        `Evidence dir: ${report.evidence_dir}`,
        '',
        '## Summary',
        '',
        `- Terminal tasks scanned: ${summary.terminal_tasks || 0}`,
        `- Expected evidence file exists: ${summary.expected_evidence_exists || 0}`,
        `- Expected evidence file missing: ${summary.expected_evidence_missing || 0}`,
        `- Fully aligned refs: ${summary.aligned_count || 0}`,
        `- Backfill candidates: ${summary.backfill_candidate_count || 0}`,
        `- Mismatched refs: ${summary.mismatched_reference_count || 0}`,
        '',
        '## Evidence Ref Buckets',
        '',
        '| Bucket | Count |',
        '| --- | ---: |',
    ];

    for (const [bucket, count] of Object.entries(
        summary.evidence_ref_buckets || {}
    ).sort((a, b) => a[0].localeCompare(b[0]))) {
        lines.push(`| ${bucket} | ${count} |`);
    }

    lines.push('');
    lines.push('## Acceptance Ref Buckets');
    lines.push('');
    lines.push('| Bucket | Count |');
    lines.push('| --- | ---: |');

    for (const [bucket, count] of Object.entries(
        summary.acceptance_ref_buckets || {}
    ).sort((a, b) => a[0].localeCompare(b[0]))) {
        lines.push(`| ${bucket} | ${count} |`);
    }

    lines.push('');
    lines.push('## Backfill Candidates');
    lines.push('');

    if ((report.backfill_candidates || []).length === 0) {
        lines.push('- None.');
    } else {
        for (const row of report.backfill_candidates) {
            lines.push(
                `- ${row.id}: evidence_ref=${row.evidence_ref || '(empty)'}; acceptance_ref=${row.acceptance_ref || '(empty)'}; expected=${row.expected_evidence_ref}; reasons=${row.reasons.join(',')}`
            );
        }
    }

    lines.push('');
    lines.push('## Missing Expected Evidence Files');
    lines.push('');

    if ((report.missing_expected_evidence || []).length === 0) {
        lines.push('- None.');
    } else {
        for (const row of report.missing_expected_evidence) {
            lines.push(
                `- ${row.id}: evidence_ref=${row.evidence_ref || '(empty)'}; acceptance_ref=${row.acceptance_ref || '(empty)'}`
            );
        }
    }

    return `${lines.join('\n')}\n`;
}

function loadBoard(boardPath) {
    return coreParsers.parseBoardContent(readFileSync(boardPath, 'utf8'), {
        allowedStatuses: ALLOWED_STATUSES,
    });
}

function runReport(options = {}, deps = {}) {
    const boardPath = options.boardPath || DEFAULT_BOARD_PATH;
    const rootDir = options.rootDir || dirname(boardPath);
    const evidenceDir =
        options.evidenceDir || resolve(rootDir, 'verification/agent-runs');
    const board = loadBoard(options.boardPath || DEFAULT_BOARD_PATH);
    const report = buildEvidenceGapReport(
        board,
        {
            boardPath,
            evidenceDir,
            rootDir,
        },
        deps
    );

    if (options.writeJsonPath) {
        ensureDirForFile(options.writeJsonPath);
        writeFileSync(
            options.writeJsonPath,
            JSON.stringify(report, null, 2),
            'utf8'
        );
    }

    if (options.writeMarkdownPath) {
        ensureDirForFile(options.writeMarkdownPath);
        writeFileSync(
            options.writeMarkdownPath,
            formatMarkdown(report),
            'utf8'
        );
    }

    return report;
}

function printTextSummary(report) {
    const summary = report.summary || {};
    console.log('Governance evidence gap report');
    console.log(`terminal_tasks=${summary.terminal_tasks || 0}`);
    console.log(
        `expected_evidence_exists=${summary.expected_evidence_exists || 0}`
    );
    console.log(
        `expected_evidence_missing=${summary.expected_evidence_missing || 0}`
    );
    console.log(`aligned_count=${summary.aligned_count || 0}`);
    console.log(
        `backfill_candidate_count=${summary.backfill_candidate_count || 0}`
    );
    console.log(
        `mismatched_reference_count=${summary.mismatched_reference_count || 0}`
    );
}

if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2), process.cwd());
        const report = runReport(options);
        if (options.json) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            printTextSummary(report);
        }
    } catch (error) {
        console.error(
            error instanceof Error
                ? error.message
                : String(error || 'Unknown error')
        );
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    buildEvidenceGapReport,
    formatMarkdown,
    runReport,
    expectedEvidenceRef,
    normalizeRelativePath,
};
