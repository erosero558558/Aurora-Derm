'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const backfillEvidenceRefs = require('../bin/backfill-agent-evidence-refs');

function writeText(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
}

test('backfill-agent-evidence-refs parseArgs exige expect-rev en apply', () => {
    assert.throws(
        () => backfillEvidenceRefs.parseArgs(['--apply'], process.cwd()),
        /requiere --expect-rev/
    );
});

test('backfill-agent-evidence-refs preview detecta candidatos seguros', () => {
    const board = {
        policy: { revision: '10' },
        tasks: [
            {
                id: 'AG-009',
                status: 'done',
                owner: 'ernes',
                executor: 'kimi',
                evidence_ref: 'queue:kimi',
                acceptance_ref: 'verification/agent-runs/AG-009.md',
            },
            {
                id: 'AG-010',
                status: 'done',
                owner: 'ernes',
                executor: 'codex',
                evidence_ref: 'verification/agent-runs/AG-010.md',
                acceptance_ref: 'verification/agent-runs/AG-010.md',
            },
        ],
    };

    const evidenceFile = path.resolve(
        process.cwd(),
        'verification/agent-runs/AG-009.md'
    );
    const originalExistsSync = fs.existsSync;

    fs.existsSync = (filePath) =>
        filePath === evidenceFile || originalExistsSync(filePath);

    try {
        const preview = backfillEvidenceRefs.previewBackfill(board, {
            boardPath: path.resolve(process.cwd(), 'AGENT_BOARD.yaml'),
        });
        assert.equal(preview.revision_before, 10);
        assert.equal(preview.scanned_backfill_candidates >= 1, true);
        assert.equal(preview.changes.length, 1);
        assert.equal(preview.changes[0].id, 'AG-009');
        assert.equal(
            preview.changes[0].next_evidence_ref,
            'verification/agent-runs/AG-009.md'
        );
    } finally {
        fs.existsSync = originalExistsSync;
    }
});

test('backfill-agent-evidence-refs run aplica cambios con expect-rev', () => {
    const tmpRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'backfill-agent-evidence-refs-')
    );
    const boardPath = path.join(tmpRoot, 'AGENT_BOARD.yaml');
    const evidenceDir = path.join(tmpRoot, 'verification/agent-runs');

    writeText(path.join(evidenceDir, 'AG-009.md'), '# AG-009 evidence\n');
    writeText(path.join(evidenceDir, 'AG-011.md'), '# AG-011 evidence\n');

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
  revision: 10
  updated_at: 2026-03-03

tasks:
  - id: AG-009
    title: "Task 9"
    owner: ernes
    executor: kimi
    status: done
    status_since_at: "2026-02-25"
    risk: low
    scope: docs
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    files: ["README.md"]
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
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-009.md"
    evidence_ref: "queue:kimi"
    depends_on: []
    prompt: "Fixture"
    created_at: 2026-03-03
    updated_at: 2026-03-03

  - id: AG-011
    title: "Task 11"
    owner: ernes
    executor: kimi
    status: done
    status_since_at: "2026-02-25"
    risk: low
    scope: docs
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    files: ["README.md"]
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
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-011.md"
    evidence_ref: "queue:kimi"
    depends_on: []
    prompt: "Fixture"
    created_at: 2026-03-03
    updated_at: 2026-03-03
`,
        'utf8'
    );

    const result = backfillEvidenceRefs.run({
        boardPath,
        expectRev: 10,
        apply: true,
    });

    assert.equal(result.applied, true);
    assert.equal(result.revision_before, 10);
    assert.equal(result.revision_after, 11);
    assert.equal(result.changes.length, 2);

    const written = fs.readFileSync(boardPath, 'utf8');
    assert.match(written, /revision: 11/);
    assert.match(
        written,
        /evidence_ref: "verification\/agent-runs\/AG-009.md"/
    );
    assert.match(
        written,
        /evidence_ref: "verification\/agent-runs\/AG-011.md"/
    );
});

test('backfill-agent-evidence-refs apply falla por revision mismatch', () => {
    const board = {
        policy: { revision: '10' },
        tasks: [],
    };
    const preview = {
        revision_before: 10,
        changes: [],
    };

    assert.throws(
        () =>
            backfillEvidenceRefs.applyBackfill(board, preview, {
                boardPath: path.resolve(process.cwd(), 'AGENT_BOARD.yaml'),
                expectRev: 9,
            }),
        /board revision mismatch/
    );
});
