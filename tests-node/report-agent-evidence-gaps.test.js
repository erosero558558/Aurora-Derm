'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const reportEvidenceGaps = require('../bin/report-agent-evidence-gaps');

test('report-agent-evidence-gaps parseArgs aplica defaults y flags', () => {
    const cwd = process.cwd();
    const options = reportEvidenceGaps.parseArgs(
        [
            '--json',
            '--board',
            'tmp/AGENT_BOARD.yaml',
            '--evidence-dir',
            'verification/custom',
            '--write-json',
            'out/report.json',
            '--write-md',
            'out/report.md',
        ],
        cwd
    );

    assert.equal(options.json, true);
    assert.equal(options.boardPath, path.resolve(cwd, 'tmp/AGENT_BOARD.yaml'));
    assert.equal(options.evidenceDir, path.resolve(cwd, 'verification/custom'));
    assert.equal(options.writeJsonPath, path.resolve(cwd, 'out/report.json'));
    assert.equal(options.writeMarkdownPath, path.resolve(cwd, 'out/report.md'));
});

test('report-agent-evidence-gaps buildEvidenceGapReport clasifica refs y backfills', () => {
    const board = {
        tasks: [
            {
                id: 'AG-001',
                status: 'done',
                owner: 'ernesto',
                executor: 'kimi',
                evidence_ref: 'queue:kimi',
                acceptance_ref: '',
            },
            {
                id: 'AG-002',
                status: 'done',
                owner: 'ernesto',
                executor: 'codex',
                evidence_ref: 'verification/agent-runs/AG-002.md',
                acceptance_ref: 'verification/agent-runs/AG-002.md',
            },
            {
                id: 'AG-003',
                status: 'done',
                owner: 'ernesto',
                executor: 'codex',
                evidence_ref: 'verification/agent-runs/AG-999.md',
                acceptance_ref: 'verification/agent-runs/AG-003-old.md',
            },
            {
                id: 'AG-004',
                status: 'done',
                owner: 'ernesto',
                executor: 'jules',
                evidence_ref: 'queue:jules',
                acceptance_ref: 'README.md',
            },
        ],
    };

    const present = new Set([
        path.resolve(process.cwd(), 'verification/agent-runs/AG-001.md'),
        path.resolve(process.cwd(), 'verification/agent-runs/AG-002.md'),
        path.resolve(process.cwd(), 'verification/agent-runs/AG-003.md'),
        path.resolve(process.cwd(), 'verification/agent-runs/AG-999.md'),
        path.resolve(process.cwd(), 'verification/agent-runs/AG-003-old.md'),
    ]);

    const report = reportEvidenceGaps.buildEvidenceGapReport(
        board,
        {
            boardPath: path.resolve(process.cwd(), 'AGENT_BOARD.yaml'),
            evidenceDir: path.resolve(process.cwd(), 'verification/agent-runs'),
            rootDir: process.cwd(),
        },
        {
            existsSync(filePath) {
                return present.has(filePath);
            },
        }
    );

    assert.equal(report.summary.terminal_tasks, 4);
    assert.equal(report.summary.expected_evidence_exists, 3);
    assert.equal(report.summary.expected_evidence_missing, 1);
    assert.equal(report.summary.aligned_count, 1);
    assert.equal(report.summary.backfill_candidate_count, 2);
    assert.equal(report.summary.mismatched_reference_count, 1);

    const ag001 = report.backfill_candidates.find((row) => row.id === 'AG-001');
    assert.ok(ag001);
    assert.ok(ag001.reasons.includes('queue_ref_can_be_backfilled'));
    assert.ok(
        ag001.reasons.includes('missing_acceptance_ref_can_be_backfilled')
    );

    const ag003 = report.backfill_candidates.find((row) => row.id === 'AG-003');
    assert.ok(ag003);
    assert.ok(ag003.reasons.includes('mismatched_evidence_ref'));
    assert.ok(ag003.reasons.includes('mismatched_acceptance_ref'));

    const ag004 = report.missing_expected_evidence.find(
        (row) => row.id === 'AG-004'
    );
    assert.ok(ag004);
    assert.equal(ag004.expected_evidence_exists, false);
});

test('report-agent-evidence-gaps runReport escribe json y markdown', () => {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'report-agent-evidence-gaps-')
    );
    const boardPath = path.join(tmpRoot, 'AGENT_BOARD.yaml');
    const evidenceDir = path.join(tmpRoot, 'verification/agent-runs');
    const jsonPath = path.join(tmpRoot, 'out/report.json');
    const mdPath = path.join(tmpRoot, 'out/report.md');

    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(
        path.join(evidenceDir, 'AG-010.md'),
        '# Evidence\n',
        'utf8'
    );
    fs.writeFileSync(
        boardPath,
        `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  codex_partition_model: dual_fixed_domains
  codex_backend_instance: codex_backend_ops
  codex_frontend_instance: codex_frontend
  revision: 10
  updated_at: 2026-03-03

tasks:
  - id: AG-010
    title: "Task"
    owner: ernesto
    executor: codex
    status: done
    acceptance_ref: ""
    evidence_ref: "queue:kimi"
`,
        'utf8'
    );

    const report = reportEvidenceGaps.runReport({
        boardPath,
        evidenceDir,
        writeJsonPath: jsonPath,
        writeMarkdownPath: mdPath,
    });

    assert.equal(report.summary.terminal_tasks, 1);
    assert.equal(report.summary.backfill_candidate_count, 1);
    assert.ok(fs.existsSync(jsonPath));
    assert.ok(fs.existsSync(mdPath));

    const writtenJson = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const writtenMd = fs.readFileSync(mdPath, 'utf8');
    assert.equal(writtenJson.summary.backfill_candidate_count, 1);
    assert.match(writtenMd, /Backfill candidates: 1/);
    assert.match(writtenMd, /AG-010/);
});
