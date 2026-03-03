'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const triageEvidenceDebt = require('../bin/triage-agent-evidence-debt');

function writeText(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

test('triage-agent-evidence-debt parseArgs reconoce apply e ids', () => {
    const options = triageEvidenceDebt.parseArgs(
        ['--apply', '--ids', 'AG-001,AG-002', '--json'],
        process.cwd()
    );

    assert.equal(options.apply, true);
    assert.equal(options.json, true);
    assert.deepEqual(options.ids, ['AG-001', 'AG-002']);
});

test('triage-agent-evidence-debt parseArgs reconoce flags de residual closure', () => {
    const options = triageEvidenceDebt.parseArgs(
        ['--apply', '--include-manual-review', '--include-legacy-cutoff'],
        process.cwd()
    );

    assert.equal(options.apply, true);
    assert.equal(options.includeManualReview, true);
    assert.equal(options.includeLegacyCutoff, true);
});

test('triage-agent-evidence-debt classifyEvidenceDebt prioriza manual review por high risk', () => {
    const result = triageEvidenceDebt.classifyEvidenceDebt(
        {},
        {
            risk: 'high',
            critical_zone: 'false',
        },
        {
            existingRefs: [{ path: 'tests/FooTest.php', exists: true }],
            existingFiles: [{ path: 'lib/foo.php', exists: true }],
        }
    );

    assert.equal(result.bucket, 'manual_review');
    assert.deepEqual(result.reasons, ['high_risk']);
});

test('triage-agent-evidence-debt buildTriageReport clasifica backfill y legacy con refs csv', () => {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'triage-agent-evidence-debt-')
    );
    const boardPath = path.join(tmpRoot, 'AGENT_BOARD.yaml');
    const evidenceDir = path.join(tmpRoot, 'verification/agent-runs');

    writeText(path.join(tmpRoot, 'docs/openapi.yaml'), 'openapi: 3.1.0\n');
    writeText(path.join(tmpRoot, 'README.md'), '# Readme\n');
    writeText(path.join(tmpRoot, 'src/no-artifact.txt'), 'x\n');

    writeText(
        boardPath,
        `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  codex_partition_model: dual_fixed_domains
  codex_backend_instance: codex_backend_ops
  codex_frontend_instance: codex_frontend
  revision: 1
  updated_at: 2026-03-03

tasks:
  - id: AG-003
    title: "OpenAPI"
    owner: ernesto
    executor: jules
    status: done
    status_since_at: "2026-02-25"
    risk: low
    scope: docs
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    files: ["docs/openapi.yaml", "README.md"]
    source_signal: manual
    source_ref: ""
    priority_score: 10
    sla_due_at: ""
    last_attempt_at: ""
    attempts: 0
    blocked_reason: ""
    lease_id: ""
    lease_owner: ""
    lease_created_at: ""
    heartbeat_at: ""
    lease_expires_at: ""
    lease_reason: ""
    lease_cleared_at: ""
    lease_cleared_reason: ""
    runtime_impact: low
    critical_zone: false
    acceptance: "OpenAPI spec"
    acceptance_ref: "docs/openapi.yaml,README.md"
    evidence_ref: "queue:jules"
    depends_on: []
    prompt: "Generate docs"
    created_at: 2026-03-03
    updated_at: 2026-03-03

  - id: AG-999
    title: "No artifacts"
    owner: ernesto
    executor: kimi
    status: done
    status_since_at: "2026-02-25"
    risk: low
    scope: docs
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    files: []
    source_signal: manual
    source_ref: ""
    priority_score: 10
    sla_due_at: ""
    last_attempt_at: ""
    attempts: 0
    blocked_reason: ""
    lease_id: ""
    lease_owner: ""
    lease_created_at: ""
    heartbeat_at: ""
    lease_expires_at: ""
    lease_reason: ""
    lease_cleared_at: ""
    lease_cleared_reason: ""
    runtime_impact: low
    critical_zone: false
    acceptance: "No artifacts"
    acceptance_ref: "signal_resolved:auto"
    evidence_ref: "queue:kimi"
    depends_on: []
    prompt: "None"
    created_at: 2026-03-03
    updated_at: 2026-03-03
`,
        'utf8'
    );

    const board =
        require('../tools/agent-orchestrator/core/parsers').parseBoardContent(
            fs.readFileSync(boardPath, 'utf8'),
            {
                allowedStatuses: new Set([
                    'backlog',
                    'ready',
                    'in_progress',
                    'review',
                    'done',
                    'blocked',
                    'failed',
                ]),
            }
        );

    const report = triageEvidenceDebt.buildTriageReport(board, {
        boardPath,
        evidenceDir,
        rootDir: tmpRoot,
    });

    const ag003 = report.rows.find((row) => row.id === 'AG-003');
    const ag999 = report.rows.find((row) => row.id === 'AG-999');

    assert.equal(ag003.bucket, 'backfill_now');
    assert.equal(ag003.existing_supporting_refs.length, 2);
    assert.equal(ag999.bucket, 'legacy_cutoff_candidate');
    assert.equal(report.summary.backfill_now, 1);
    assert.equal(report.summary.legacy_cutoff_candidate, 1);
});

test('triage-agent-evidence-debt applyBackfill writes only backfill_now files', () => {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'triage-agent-evidence-apply-')
    );
    const evidencePath = path.join(
        tmpRoot,
        'verification/agent-runs/AG-003.md'
    );
    const manualPath = path.join(tmpRoot, 'verification/agent-runs/AG-001.md');

    const report = {
        rows: [
            {
                id: 'AG-003',
                title: 'OpenAPI',
                owner: 'ernesto',
                executor: 'jules',
                status: 'done',
                risk: 'low',
                scope: 'docs',
                runtime_impact: 'low',
                critical_zone: false,
                bucket: 'backfill_now',
                bucket_reasons: ['surviving_reference_exists'],
                expected_evidence_ref: 'verification/agent-runs/AG-003.md',
                acceptance_ref: 'docs/openapi.yaml',
                evidence_ref: 'queue:jules',
                existing_supporting_refs: [
                    {
                        kind: 'acceptance_ref',
                        path: 'docs/openapi.yaml',
                        exists: true,
                    },
                ],
                missing_supporting_refs: [],
                existing_scoped_files: [
                    {
                        kind: 'task_file',
                        path: 'docs/openapi.yaml',
                        exists: true,
                    },
                ],
                missing_scoped_files: [],
                files: ['docs/openapi.yaml'],
                acceptance: 'OpenAPI spec',
                prompt: 'Generate docs',
            },
            {
                id: 'AG-001',
                title: 'Critical',
                owner: 'ernesto',
                executor: 'jules',
                status: 'done',
                risk: 'high',
                scope: 'platform',
                runtime_impact: 'low',
                critical_zone: false,
                bucket: 'manual_review',
                bucket_reasons: ['high_risk'],
                expected_evidence_ref: 'verification/agent-runs/AG-001.md',
                acceptance_ref: 'tests/BackupReceiverTest.php',
                evidence_ref: 'queue:jules',
                existing_supporting_refs: [],
                missing_supporting_refs: [],
                existing_scoped_files: [],
                missing_scoped_files: [],
                files: [],
                acceptance: 'Backup',
                prompt: 'Critical work',
            },
        ],
    };

    const result = triageEvidenceDebt.applyBackfill(report, {
        rootDir: tmpRoot,
    });

    assert.equal(result.generated, 1);
    assert.equal(result.skipped_existing, 0);
    assert.equal(fs.existsSync(evidencePath), true);
    assert.equal(fs.existsSync(manualPath), false);
    assert.match(
        fs.readFileSync(evidencePath, 'utf8'),
        /Evidence Backfill: AG-003/
    );
});

test('triage-agent-evidence-debt applyBackfill puede cerrar manual_review y legacy con flags explicitos', () => {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'triage-agent-evidence-residual-')
    );
    const manualPath = path.join(tmpRoot, 'verification/agent-runs/AG-001.md');
    const legacyPath = path.join(tmpRoot, 'verification/agent-runs/AG-004.md');

    const report = {
        rows: [
            {
                id: 'AG-001',
                title: 'Critical backup',
                owner: 'ernesto',
                executor: 'jules',
                status: 'done',
                risk: 'high',
                scope: 'platform',
                runtime_impact: 'low',
                critical_zone: false,
                bucket: 'manual_review',
                bucket_reasons: ['high_risk'],
                expected_evidence_ref: 'verification/agent-runs/AG-001.md',
                acceptance_ref: 'tests/BackupReceiverTest.php',
                evidence_ref: 'queue:jules',
                existing_supporting_refs: [
                    {
                        kind: 'acceptance_ref',
                        path: 'tests/BackupReceiverTest.php',
                        exists: true,
                    },
                ],
                missing_supporting_refs: [],
                existing_scoped_files: [
                    {
                        kind: 'task_file',
                        path: 'lib/backup.php',
                        exists: true,
                    },
                ],
                missing_scoped_files: [],
                files: ['lib/backup.php'],
                acceptance: 'Critical backup acceptance',
                prompt: 'Critical prompt',
                source_signal: 'manual',
                source_ref: '',
            },
            {
                id: 'AG-004',
                title: 'Legacy email',
                owner: 'ernesto',
                executor: 'jules',
                status: 'done',
                risk: 'medium',
                scope: 'backend',
                runtime_impact: 'low',
                critical_zone: false,
                bucket: 'legacy_cutoff_candidate',
                bucket_reasons: ['no_surviving_artifact'],
                expected_evidence_ref: 'verification/agent-runs/AG-004.md',
                acceptance_ref: 'verification/agent-runs/AG-004.md',
                evidence_ref: 'queue:jules',
                existing_supporting_refs: [],
                missing_supporting_refs: [
                    {
                        kind: 'acceptance_ref',
                        path: 'verification/agent-runs/AG-004.md',
                        exists: false,
                    },
                ],
                existing_scoped_files: [],
                missing_scoped_files: [
                    {
                        kind: 'task_file',
                        path: 'lib/mailer.php',
                        exists: false,
                    },
                ],
                files: ['lib/mailer.php'],
                acceptance: 'Legacy email acceptance',
                prompt: 'Legacy prompt',
                source_signal: 'manual',
                source_ref: '',
            },
        ],
    };

    const result = triageEvidenceDebt.applyBackfill(report, {
        rootDir: tmpRoot,
        includeManualReview: true,
        includeLegacyCutoff: true,
    });

    assert.equal(result.generated, 2);
    assert.equal(result.generated_by_bucket.manual_review, 1);
    assert.equal(result.generated_by_bucket.legacy_cutoff_candidate, 1);
    assert.equal(fs.existsSync(manualPath), true);
    assert.equal(fs.existsSync(legacyPath), true);
    assert.match(
        fs.readFileSync(manualPath, 'utf8'),
        /Evidence Manual Review Reconstruction: AG-001/
    );
    assert.match(
        fs.readFileSync(legacyPath, 'utf8'),
        /Evidence Legacy Cutoff Record: AG-004/
    );
});
