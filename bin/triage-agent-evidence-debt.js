#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, relative, resolve } = require('path');
const coreParsers = require('../tools/agent-orchestrator/core/parsers');
const reportEvidenceGaps = require('./report-agent-evidence-gaps');

const ROOT_DIR = resolve(__dirname, '..');
const DEFAULT_BOARD_PATH = resolve(ROOT_DIR, 'AGENT_BOARD.yaml');
const DEFAULT_EVIDENCE_DIR = resolve(ROOT_DIR, 'verification/agent-runs');
const ALLOWED_STATUSES = new Set([
    'backlog',
    'ready',
    'in_progress',
    'review',
    'done',
    'blocked',
    'failed',
]);
const TERMINAL_STATUSES = new Set(['done', 'failed']);
const MANUAL_REVIEW_BUCKET = 'manual_review';
const BACKFILL_NOW_BUCKET = 'backfill_now';
const LEGACY_CUTOFF_BUCKET = 'legacy_cutoff_candidate';

function normalizeRelativePath(value) {
    return String(value || '')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
        .replace(/^\.\//, '')
        .replace(/\/$/, '');
}

function parseArgs(argv = [], cwd = process.cwd()) {
    const options = {
        boardPath: DEFAULT_BOARD_PATH,
        evidenceDir: DEFAULT_EVIDENCE_DIR,
        writeJsonPath: '',
        writeMarkdownPath: '',
        json: false,
        apply: false,
        includeManualReview: false,
        includeLegacyCutoff: false,
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
        if (arg === '--include-manual-review') {
            options.includeManualReview = true;
            continue;
        }
        if (arg === '--include-legacy-cutoff') {
            options.includeLegacyCutoff = true;
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
            `Flag no soportado: ${arg}. Usa --json --apply --include-manual-review --include-legacy-cutoff --board --evidence-dir --write-json --write-md --ids`
        );
    }

    return options;
}

function ensureDirForFile(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function loadBoard(boardPath) {
    return coreParsers.parseBoardContent(readFileSync(boardPath, 'utf8'), {
        allowedStatuses: ALLOWED_STATUSES,
    });
}

function splitReferenceList(value) {
    const raw = String(value || '').trim();
    if (!raw || raw === 'signal_resolved:auto' || raw.startsWith('queue:')) {
        return [];
    }
    return raw
        .split(',')
        .map((part) => normalizeRelativePath(part))
        .filter(Boolean);
}

function listSupportArtifacts(rootDir, row, task, fileExists = existsSync) {
    const refs = [];
    const seen = new Set();
    for (const ref of splitReferenceList(row.acceptance_ref)) {
        if (!seen.has(`ref:${ref}`)) {
            seen.add(`ref:${ref}`);
            refs.push({
                kind: 'acceptance_ref',
                path: ref,
                exists: fileExists(resolve(rootDir, ref)),
            });
        }
    }
    for (const ref of splitReferenceList(row.evidence_ref)) {
        if (!seen.has(`ref:${ref}`)) {
            seen.add(`ref:${ref}`);
            refs.push({
                kind: 'evidence_ref',
                path: ref,
                exists: fileExists(resolve(rootDir, ref)),
            });
        }
    }

    const files = [];
    for (const file of Array.isArray(task.files) ? task.files : []) {
        const normalized = normalizeRelativePath(file);
        if (!normalized || seen.has(`file:${normalized}`)) continue;
        seen.add(`file:${normalized}`);
        files.push({
            kind: 'task_file',
            path: normalized,
            exists: fileExists(resolve(rootDir, normalized)),
        });
    }

    return {
        refs,
        files,
        existingRefs: refs.filter((item) => item.exists),
        missingRefs: refs.filter((item) => !item.exists),
        existingFiles: files.filter((item) => item.exists),
        missingFiles: files.filter((item) => !item.exists),
    };
}

function classifyEvidenceDebt(row, task, support) {
    const reasons = [];

    if (String(task.critical_zone || '').trim() === 'true') {
        reasons.push('critical_zone');
    }
    if (String(task.risk || '').trim() === 'high') {
        reasons.push('high_risk');
    }
    if (reasons.length > 0) {
        return {
            bucket: MANUAL_REVIEW_BUCKET,
            reasons,
        };
    }

    if (support.existingRefs.length > 0 || support.existingFiles.length > 0) {
        if (support.existingRefs.length > 0) {
            reasons.push('surviving_reference_exists');
        }
        if (support.existingFiles.length > 0) {
            reasons.push('surviving_scoped_files_exist');
        }
        return {
            bucket: BACKFILL_NOW_BUCKET,
            reasons,
        };
    }

    reasons.push('no_surviving_artifact');
    return {
        bucket: LEGACY_CUTOFF_BUCKET,
        reasons,
    };
}

function buildTaskMap(board) {
    const map = new Map();
    for (const task of Array.isArray(board?.tasks) ? board.tasks : []) {
        const status = String(task.status || '')
            .trim()
            .toLowerCase();
        if (!TERMINAL_STATUSES.has(status)) continue;
        map.set(String(task.id || '').trim(), task);
    }
    return map;
}

function buildTriageReport(board, options = {}, deps = {}) {
    const rootDir =
        options.rootDir || dirname(options.boardPath || DEFAULT_BOARD_PATH);
    const evidenceDir =
        options.evidenceDir || resolve(rootDir, 'verification/agent-runs');
    const fileExists = deps.existsSync || existsSync;
    const gaps = reportEvidenceGaps.buildEvidenceGapReport(
        board,
        {
            boardPath: options.boardPath || DEFAULT_BOARD_PATH,
            evidenceDir,
            rootDir,
        },
        deps
    );
    const taskMap = buildTaskMap(board);
    const filterIds = new Set(
        (Array.isArray(options.ids) ? options.ids : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
    );
    const rows = [];

    for (const row of gaps.missing_expected_evidence || []) {
        if (filterIds.size > 0 && !filterIds.has(row.id)) continue;
        const task = taskMap.get(row.id);
        if (!task) continue;
        const support = listSupportArtifacts(rootDir, row, task, fileExists);
        const classification = classifyEvidenceDebt(row, task, support);

        rows.push({
            id: row.id,
            title: String(task.title || '').trim(),
            owner: String(task.owner || '').trim(),
            executor: String(task.executor || '').trim(),
            status: String(task.status || '').trim(),
            risk: String(task.risk || '').trim(),
            scope: String(task.scope || '').trim(),
            runtime_impact: String(task.runtime_impact || '').trim(),
            critical_zone: String(task.critical_zone || '').trim() === 'true',
            expected_evidence_ref: row.expected_evidence_ref,
            expected_evidence_exists: row.expected_evidence_exists,
            acceptance_ref: row.acceptance_ref,
            evidence_ref: row.evidence_ref,
            bucket: classification.bucket,
            bucket_reasons: classification.reasons,
            existing_supporting_refs: support.existingRefs,
            missing_supporting_refs: support.missingRefs,
            existing_scoped_files: support.existingFiles,
            missing_scoped_files: support.missingFiles,
            files: Array.isArray(task.files) ? task.files : [],
            acceptance: String(task.acceptance || '').trim(),
            prompt: String(task.prompt || '').trim(),
            source_signal: String(task.source_signal || '').trim(),
            source_ref: String(task.source_ref || '').trim(),
            updated_at: String(task.updated_at || row.updated_at || '').trim(),
        });
    }

    rows.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

    const summary = {
        total_missing_expected_evidence: rows.length,
        backfill_now: rows.filter((row) => row.bucket === BACKFILL_NOW_BUCKET)
            .length,
        manual_review: rows.filter((row) => row.bucket === MANUAL_REVIEW_BUCKET)
            .length,
        legacy_cutoff_candidate: rows.filter(
            (row) => row.bucket === LEGACY_CUTOFF_BUCKET
        ).length,
        by_executor: Object.fromEntries(
            Array.from(
                rows
                    .reduce((map, row) => {
                        const key = row.executor || '(empty)';
                        map.set(key, (map.get(key) || 0) + 1);
                        return map;
                    }, new Map())
                    .entries()
            ).sort((a, b) => b[1] - a[1])
        ),
        by_scope: Object.fromEntries(
            Array.from(
                rows
                    .reduce((map, row) => {
                        const key = row.scope || '(empty)';
                        map.set(key, (map.get(key) || 0) + 1);
                        return map;
                    }, new Map())
                    .entries()
            ).sort((a, b) => b[1] - a[1])
        ),
    };

    return {
        version: 1,
        generated_at: new Date().toISOString(),
        board_path: normalizeRelativePath(
            relative(rootDir, options.boardPath || DEFAULT_BOARD_PATH)
        ),
        evidence_dir: normalizeRelativePath(relative(rootDir, evidenceDir)),
        summary,
        rows,
    };
}

function buildArtifactPlan(row, options = {}) {
    if (row.bucket === BACKFILL_NOW_BUCKET) {
        return {
            shouldWrite: true,
            title: 'Evidence Backfill',
            generatedBy: 'triage-agent-evidence-debt --apply',
            reconstructionMode: 'surviving_repo_artifacts',
            intent: 'this is a reconstructed evidence file generated because the original per-task run artifact was missing.',
            notes: [
                'This file was backfilled from current repository state and AGENT_BOARD metadata.',
                'It should be treated as reconstructed evidence, not as the original execution transcript.',
            ],
        };
    }

    if (row.bucket === MANUAL_REVIEW_BUCKET) {
        return {
            shouldWrite: Boolean(options.includeManualReview),
            title: 'Evidence Manual Review Reconstruction',
            generatedBy:
                'triage-agent-evidence-debt --apply --include-manual-review',
            reconstructionMode: 'manual_review_high_risk',
            intent: 'this is a manually reviewed reconstruction for a high-risk or critical task whose expected evidence file was missing.',
            notes: [
                'This file was reconstructed after manual review because the task is high-risk and could not be auto-backfilled safely in the first pass.',
                'It documents surviving repository artifacts and the current reconstruction rationale; it is not the original execution transcript.',
                'No runtime behavior was changed as part of this evidence reconstruction.',
            ],
        };
    }

    if (row.bucket === LEGACY_CUTOFF_BUCKET) {
        return {
            shouldWrite: Boolean(options.includeLegacyCutoff),
            title: 'Evidence Legacy Cutoff Record',
            generatedBy:
                'triage-agent-evidence-debt --apply --include-legacy-cutoff',
            reconstructionMode: 'legacy_cutoff_no_surviving_artifacts',
            intent: 'this file records an explicit cutoff decision because no surviving repository artifacts remained to reconstruct the original run evidence.',
            notes: [
                'No surviving supporting refs or scoped files remained in the current repository snapshot for this task.',
                'This file records the cutoff rationale and should not be interpreted as proof of the original implementation session.',
                'If external artifacts are recovered later, this cutoff record should be replaced by a richer evidence reconstruction.',
            ],
        };
    }

    return {
        shouldWrite: false,
        title: 'Evidence Artifact',
        generatedBy: 'triage-agent-evidence-debt --apply',
        reconstructionMode: 'unknown',
        intent: 'unsupported bucket',
        notes: ['Unsupported bucket.'],
    };
}

function renderEvidenceBackfill(row, options = {}) {
    const plan = buildArtifactPlan(row, options);
    const lines = [
        `# ${plan.title}: ${row.id}`,
        '',
        '## Provenance',
        '',
        `- Generated at: ${new Date().toISOString()}`,
        `- Generated by: ${plan.generatedBy}`,
        `- Reconstruction mode: ${plan.reconstructionMode}`,
        `- Note: ${plan.intent}`,
        '',
        '## Task Metadata',
        '',
        `- Title: ${row.title || '(missing)'}`,
        `- Owner: ${row.owner || '(missing)'}`,
        `- Executor: ${row.executor || '(missing)'}`,
        `- Status: ${row.status || '(missing)'}`,
        `- Risk: ${row.risk || '(missing)'}`,
        `- Scope: ${row.scope || '(missing)'}`,
        `- Runtime impact: ${row.runtime_impact || '(missing)'}`,
        `- Critical zone: ${row.critical_zone ? 'true' : 'false'}`,
        `- Triage bucket: ${row.bucket}`,
        `- Triage reasons: ${row.bucket_reasons.join(', ') || '(none)'}`,
        '',
        '## Original References',
        '',
        `- acceptance_ref: ${row.acceptance_ref || '(empty)'}`,
        `- evidence_ref: ${row.evidence_ref || '(empty)'}`,
        `- expected_evidence_ref: ${row.expected_evidence_ref || '(missing)'}`,
        '',
        '## Acceptance Criteria Snapshot',
        '',
        row.acceptance ? row.acceptance : '- (missing)',
        '',
        '## Surviving Supporting References',
        '',
    ];

    if (row.existing_supporting_refs.length === 0) {
        lines.push('- None.');
    } else {
        for (const ref of row.existing_supporting_refs) {
            lines.push(`- [${ref.path}](${ref.path}) (${ref.kind})`);
        }
    }

    lines.push('');
    lines.push('## Missing Supporting References');
    lines.push('');

    if (row.missing_supporting_refs.length === 0) {
        lines.push('- None.');
    } else {
        for (const ref of row.missing_supporting_refs) {
            lines.push(`- ${ref.path} (${ref.kind})`);
        }
    }

    lines.push('');
    lines.push('## Files In Scope');
    lines.push('');

    if ((row.files || []).length === 0) {
        lines.push('- None.');
    } else {
        for (const file of row.files) {
            const existing = row.existing_scoped_files.find(
                (item) => item.path === file
            );
            lines.push(`- ${file} (${existing ? 'exists' : 'missing'})`);
        }
    }

    lines.push('');
    lines.push('## Notes');
    lines.push('');
    for (const note of plan.notes) {
        lines.push(`- ${note}`);
    }
    if (row.prompt) {
        lines.push(`- Original prompt snapshot: ${row.prompt}`);
    }
    if (row.source_signal) {
        lines.push(`- Original source signal: ${row.source_signal}`);
    }
    if (row.source_ref) {
        lines.push(`- Original source ref: ${row.source_ref}`);
    }

    return `${lines.join('\n')}\n`;
}

function applyBackfill(report, options = {}) {
    const rootDir =
        options.rootDir || dirname(options.boardPath || DEFAULT_BOARD_PATH);
    const writeFile = options.writeFileSync || writeFileSync;
    const fileExists = options.existsSync || existsSync;
    let generated = 0;
    let skippedExisting = 0;
    const generatedByBucket = {
        [BACKFILL_NOW_BUCKET]: 0,
        [MANUAL_REVIEW_BUCKET]: 0,
        [LEGACY_CUTOFF_BUCKET]: 0,
    };

    for (const row of report.rows || []) {
        const plan = buildArtifactPlan(row, options);
        if (!plan.shouldWrite) continue;
        const targetPath = resolve(rootDir, row.expected_evidence_ref);
        if (fileExists(targetPath)) {
            skippedExisting += 1;
            continue;
        }
        ensureDirForFile(targetPath);
        writeFile(targetPath, renderEvidenceBackfill(row, options), 'utf8');
        generated += 1;
        if (
            Object.prototype.hasOwnProperty.call(generatedByBucket, row.bucket)
        ) {
            generatedByBucket[row.bucket] += 1;
        }
    }

    return {
        generated,
        skipped_existing: skippedExisting,
        generated_by_bucket: generatedByBucket,
    };
}

function formatMarkdown(report, applyResult = null) {
    const lines = [
        '# Agent Evidence Debt Triage',
        '',
        `Generated at: ${report.generated_at}`,
        `Board: ${report.board_path}`,
        `Evidence dir: ${report.evidence_dir}`,
        '',
        '## Summary',
        '',
        `- Missing expected evidence tasks: ${report.summary.total_missing_expected_evidence}`,
        `- backfill_now: ${report.summary.backfill_now}`,
        `- manual_review: ${report.summary.manual_review}`,
        `- legacy_cutoff_candidate: ${report.summary.legacy_cutoff_candidate}`,
    ];

    if (applyResult) {
        lines.push(`- generated files in this run: ${applyResult.generated}`);
        lines.push(`- skipped existing files: ${applyResult.skipped_existing}`);
    }

    lines.push('');
    lines.push('## By Executor');
    lines.push('');
    lines.push('| Executor | Count |');
    lines.push('| --- | ---: |');
    for (const [executor, count] of Object.entries(
        report.summary.by_executor
    )) {
        lines.push(`| ${executor} | ${count} |`);
    }

    lines.push('');
    lines.push('## By Scope');
    lines.push('');
    lines.push('| Scope | Count |');
    lines.push('| --- | ---: |');
    for (const [scope, count] of Object.entries(report.summary.by_scope)) {
        lines.push(`| ${scope} | ${count} |`);
    }

    const buckets = [
        BACKFILL_NOW_BUCKET,
        MANUAL_REVIEW_BUCKET,
        LEGACY_CUTOFF_BUCKET,
    ];
    for (const bucket of buckets) {
        lines.push('');
        lines.push(`## ${bucket}`);
        lines.push('');
        const rows = (report.rows || []).filter((row) => row.bucket === bucket);
        if (rows.length === 0) {
            lines.push('- None.');
            continue;
        }
        for (const row of rows) {
            lines.push(
                `- ${row.id}: risk=${row.risk}; scope=${row.scope}; reasons=${row.bucket_reasons.join(',')}; expected=${row.expected_evidence_ref}`
            );
        }
    }

    return `${lines.join('\n')}\n`;
}

function run(options = {}, deps = {}) {
    const boardPath = options.boardPath || DEFAULT_BOARD_PATH;
    const rootDir = options.rootDir || dirname(boardPath);
    const evidenceDir =
        options.evidenceDir || resolve(rootDir, 'verification/agent-runs');
    const board = loadBoard(boardPath);
    const report = buildTriageReport(
        board,
        {
            ...options,
            boardPath,
            evidenceDir,
            rootDir,
        },
        deps
    );

    let applyResult = null;
    if (options.apply) {
        applyResult = applyBackfill(report, {
            ...options,
            boardPath,
            rootDir,
            existsSync: deps.existsSync || existsSync,
            writeFileSync: deps.writeFileSync || writeFileSync,
        });
    }

    if (options.writeJsonPath) {
        ensureDirForFile(options.writeJsonPath);
        writeFileSync(
            options.writeJsonPath,
            JSON.stringify(
                {
                    ...report,
                    apply_result: applyResult,
                },
                null,
                2
            ),
            'utf8'
        );
    }

    if (options.writeMarkdownPath) {
        ensureDirForFile(options.writeMarkdownPath);
        writeFileSync(
            options.writeMarkdownPath,
            formatMarkdown(report, applyResult),
            'utf8'
        );
    }

    return {
        ...report,
        apply_result: applyResult,
    };
}

function printTextSummary(result) {
    console.log('Agent evidence debt triage');
    console.log(
        `missing_expected_evidence=${result.summary.total_missing_expected_evidence}`
    );
    console.log(`backfill_now=${result.summary.backfill_now}`);
    console.log(`manual_review=${result.summary.manual_review}`);
    console.log(
        `legacy_cutoff_candidate=${result.summary.legacy_cutoff_candidate}`
    );
    if (result.apply_result) {
        console.log(`generated=${result.apply_result.generated}`);
        console.log(`skipped_existing=${result.apply_result.skipped_existing}`);
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
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    splitReferenceList,
    listSupportArtifacts,
    classifyEvidenceDebt,
    buildTriageReport,
    renderEvidenceBackfill,
    applyBackfill,
    formatMarkdown,
    run,
};
