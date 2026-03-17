#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    copyFileSync,
    rmSync,
} = require('fs');
const { resolve, join } = require('path');

const REPO_ROOT = resolve(__dirname, '..');
const VALIDATOR_SOURCE = join(
    REPO_ROOT,
    'bin',
    'validate-agent-governance.php'
);
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const AGENT_JOBS_SOURCE = join(REPO_ROOT, 'AGENT_JOBS.yaml');

function createPhpGovernanceFixtureDir() {
    const fixturesRoot = join(REPO_ROOT, '.generated', 'tmp');
    mkdirSync(fixturesRoot, { recursive: true });
    const dir = mkdtempSync(join(fixturesRoot, 'php-governance-contract-'));
    mkdirSync(join(dir, 'bin'), { recursive: true });
    copyFileSync(
        VALIDATOR_SOURCE,
        join(dir, 'bin', 'validate-agent-governance.php')
    );
    copyFileSync(GOVERNANCE_POLICY_SOURCE, join(dir, 'governance-policy.json'));
    writeFileSync(
        join(dir, 'AGENTS.md'),
        'AGENT_POLICY_VERSION: test\nCANONICAL_AGENT_POLICY: AGENTS.md\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'CLAUDE.md'),
        'SOURCE_OF_TRUTH: AGENTS.md\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        'version: 1\nhandoffs: []\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_SIGNALS.yaml'),
        'version: 1\nupdated_at: 2026-03-15\nsignals: []\n',
        'utf8'
    );
    copyFileSync(AGENT_JOBS_SOURCE, join(dir, 'AGENT_JOBS.yaml'));
    writeFileSync(join(dir, 'JULES_TASKS.md'), '# legacy\n', 'utf8');
    writeFileSync(join(dir, 'KIMI_TASKS.md'), '# legacy\n', 'utf8');
    return dir;
}

function cleanupPhpGovernanceFixtureDir(dir) {
    rmSync(dir, { recursive: true, force: true });
}

test('php-governance-contract ejecuta validador canonico de gobernanza', (t) => {
    const phpProbe = spawnSync('php', ['-v'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    if (phpProbe.error || phpProbe.status !== 0) {
        t.skip('php no disponible en PATH para ejecutar contrato PHP local');
        return;
    }

    const result = spawnSync('php', ['bin/validate-agent-governance.php'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    assert.equal(
        result.status,
        0,
        `php bin/validate-agent-governance.php fallo\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`
    );
    assert.match(
        String(result.stdout || ''),
        /OK:\s+gobernanza de agentes valida/i
    );
});

test('php-governance-contract rechaza colision same-lane entre claim y blocked_scope', (t) => {
    const phpProbe = spawnSync('php', ['-v'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    if (phpProbe.error || phpProbe.status !== 0) {
        t.skip('php no disponible en PATH para ejecutar contrato PHP local');
        return;
    }

    const dir = createPhpGovernanceFixtureDir();
    try {
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  revision: 0
  updated_at: 2026-03-15
strategy:
  active:
    id: STRAT-TEST-AMBIGUO
    title: "Fixture ambigua"
    objective: "Validar colision same-lane"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: active
    started_at: "2026-03-15"
    review_due_at: "2026-03-20"
    exit_criteria: ["uno"]
    success_signal: "demo"
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-admin
        title: "Admin"
        allowed_scopes: ["frontend-admin"]
        support_only_scopes: []
        blocked_scopes: []
        wip_limit: 1
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-queue
        title: "Queue"
        allowed_scopes: ["queue"]
        support_only_scopes: []
        blocked_scopes: ["frontend-admin"]
        wip_limit: 1
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend
        title: "Backend"
        allowed_scopes: ["backend"]
        support_only_scopes: ["tests"]
        blocked_scopes: ["frontend-public"]
        wip_limit: 1
        default_acceptance_profile: "backend_gate_checkpoint"
        exception_ttl_hours: 6
      - codex_instance: codex_transversal
        subfront_id: SF-transversal
        title: "Transversal"
        allowed_scopes: []
        support_only_scopes: ["codex-governance"]
        blocked_scopes: ["legacy-runtime"]
        wip_limit: 1
        default_acceptance_profile: "transversal_runtime_checkpoint"
        exception_ttl_hours: 4
  next: null
  updated_at: "2026-03-15"
tasks:
  - id: AG-001
    title: "Fixture terminal"
    owner: ernesto
    executor: codex
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "ok"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "fixture"
    created_at: 2026-03-15
    updated_at: 2026-03-15
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan fixture

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-TEST-AMBIGUO
title: "Fixture ambigua"
status: active
owner: ernesto
subfront_ids: ["SF-frontend-admin", "SF-frontend-queue", "SF-backend", "SF-transversal"]
updated_at: "2026-03-15"
-->

Relacion con Operativo 2026:
- Fixture.
`,
            'utf8'
        );

        const result = spawnSync('php', ['bin/validate-agent-governance.php'], {
            cwd: dir,
            encoding: 'utf8',
        });

        assert.equal(
            result.status,
            1,
            `validator deberia fallar\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`
        );
        assert.match(
            String(result.stderr || ''),
            /scope frontend-admin asignado de forma ambigua/i
        );
    } finally {
        cleanupPhpGovernanceFixtureDir(dir);
    }
});

test('php-governance-contract permite validated_release_promotion sobre frontend-public bloqueado', (t) => {
    const phpProbe = spawnSync('php', ['-v'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    if (phpProbe.error || phpProbe.status !== 0) {
        t.skip('php no disponible en PATH para ejecutar contrato PHP local');
        return;
    }

    const dir = createPhpGovernanceFixtureDir();
    try {
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  revision: 0
  updated_at: 2026-03-15
strategy:
  active:
    id: STRAT-TEST-RELEASE
    title: "Fixture release"
    objective: "Validar release-publish formal"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: active
    started_at: "2026-03-15"
    review_due_at: "2026-03-20"
    exit_criteria: ["uno"]
    success_signal: "demo"
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend
        title: "Frontend"
        allowed_scopes: ["frontend-admin"]
        support_only_scopes: ["frontend-qa"]
        blocked_scopes: ["frontend-public"]
        wip_limit: 1
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend
        title: "Backend"
        allowed_scopes: ["backend"]
        support_only_scopes: ["tests"]
        blocked_scopes: ["payments"]
        wip_limit: 1
        default_acceptance_profile: "backend_gate_checkpoint"
        exception_ttl_hours: 8
      - codex_instance: codex_transversal
        subfront_id: SF-transversal
        title: "Transversal"
        allowed_scopes: []
        support_only_scopes: ["codex-governance"]
        blocked_scopes: ["deploy"]
        wip_limit: 1
        default_acceptance_profile: "transversal_runtime_checkpoint"
        exception_ttl_hours: 8
  next: null
  updated_at: "2026-03-15"
tasks:
  - id: AG-256
    title: "Fixture release publish"
    owner: deck
    executor: codex
    status: review
    status_since_at: "2026-03-15T00:00:00.000Z"
    risk: medium
    scope: frontend-public
    codex_instance: codex_frontend
    domain_lane: frontend_content
    lane_lock: strict
    cross_domain: false
    provider_mode:
    runtime_surface:
    runtime_transport:
    runtime_last_transport:
    files: ["content/public-v6/es/home.json", "tests/public-v6-news-strip.spec.js"]
    source_signal: manual
    source_ref: ""
    priority_score: 0
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
    acceptance: "release"
    acceptance_ref: "verification/agent-runs/AG-256.md"
    evidence_ref: "verification/agent-runs/AG-256.md"
    strategy_id: "STRAT-TEST-RELEASE"
    subfront_id: "SF-frontend"
    strategy_role: "exception"
    strategy_reason: "validated_release_promotion"
    focus_id: ""
    focus_step: ""
    integration_slice: "governance_evidence"
    work_type: "evidence"
    expected_outcome: ""
    decision_ref: ""
    rework_parent: ""
    rework_reason: ""
    depends_on: []
    prompt: "fixture release"
    created_at: 2026-03-15
    updated_at: 2026-03-15
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan fixture

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-TEST-RELEASE
title: "Fixture release"
status: active
owner: ernesto
owner_policy: "detected_default_owner"
subfront_ids: ["SF-frontend", "SF-backend", "SF-transversal"]
updated_at: "2026-03-15"
-->

Relacion con Operativo 2026:
- Fixture.
`,
            'utf8'
        );

        const result = spawnSync('php', ['bin/validate-agent-governance.php'], {
            cwd: dir,
            encoding: 'utf8',
        });

        assert.equal(
            result.status,
            0,
            `validator deberia aceptar validated_release_promotion\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`
        );
        assert.match(String(result.stdout || ''), /OK:\s+gobernanza de agentes valida/i);
    } finally {
        cleanupPhpGovernanceFixtureDir(dir);
    }
});

test('php-governance-contract permite archivos de soporte release cuando validated_release_promotion ya esta done', (t) => {
    const phpProbe = spawnSync('php', ['-v'], {
        cwd: REPO_ROOT,
        encoding: 'utf8',
    });

    if (phpProbe.error || phpProbe.status !== 0) {
        t.skip('php no disponible en PATH para ejecutar contrato PHP local');
        return;
    }

    const dir = createPhpGovernanceFixtureDir();
    try {
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  revision: 0
  updated_at: 2026-03-17
strategy:
  active:
    id: STRAT-TEST-RELEASE
    title: "Fixture release"
    objective: "Validar release-publish formal"
    owner: ernesto
    owner_policy: "detected_default_owner"
    status: active
    started_at: "2026-03-15"
    review_due_at: "2026-03-20"
    exit_criteria: ["uno"]
    success_signal: "demo"
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend
        title: "Frontend"
        allowed_scopes: ["frontend-admin"]
        support_only_scopes: ["frontend-qa"]
        blocked_scopes: ["frontend-public"]
        wip_limit: 1
        default_acceptance_profile: "frontend_delivery_checkpoint"
        exception_ttl_hours: 8
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend
        title: "Backend"
        allowed_scopes: ["backend"]
        support_only_scopes: ["tests"]
        blocked_scopes: ["payments"]
        wip_limit: 1
        default_acceptance_profile: "backend_gate_checkpoint"
        exception_ttl_hours: 8
      - codex_instance: codex_transversal
        subfront_id: SF-transversal
        title: "Transversal"
        allowed_scopes: []
        support_only_scopes: ["codex-governance"]
        blocked_scopes: ["deploy"]
        wip_limit: 1
        default_acceptance_profile: "transversal_runtime_checkpoint"
        exception_ttl_hours: 8
  next: null
  updated_at: "2026-03-17"
tasks:
  - id: AG-256
    title: "Fixture release publish done"
    owner: deck
    executor: codex
    status: done
    status_since_at: "2026-03-17T00:00:00.000Z"
    risk: medium
    scope: frontend-public
    codex_instance: codex_frontend
    domain_lane: frontend_content
    lane_lock: strict
    cross_domain: false
    provider_mode:
    runtime_surface:
    runtime_transport:
    runtime_last_transport:
    files: ["content/public-v6/es/home.json", "tests/public-v6-news-strip.spec.js", "verification/public-v6-canonical/artifact-drift.json"]
    source_signal: manual
    source_ref: ""
    priority_score: 0
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
    lease_cleared_at: "2026-03-17T00:00:00.000Z"
    lease_cleared_reason: "terminal:done"
    runtime_impact: low
    critical_zone: false
    acceptance: "release done"
    acceptance_ref: "verification/agent-runs/AG-256.md"
    evidence_ref: "verification/agent-runs/AG-256.md"
    strategy_id: "STRAT-TEST-RELEASE"
    subfront_id: "SF-frontend"
    strategy_role: "exception"
    strategy_reason: "validated_release_promotion"
    focus_id: ""
    focus_step: ""
    integration_slice: "governance_evidence"
    work_type: "evidence"
    expected_outcome: ""
    decision_ref: ""
    rework_parent: ""
    rework_reason: ""
    depends_on: []
    prompt: "fixture release done"
    created_at: 2026-03-17
    updated_at: 2026-03-17
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan fixture

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-TEST-RELEASE
title: "Fixture release"
status: active
owner: ernesto
owner_policy: "detected_default_owner"
subfront_ids: ["SF-frontend", "SF-backend", "SF-transversal"]
updated_at: "2026-03-17"
-->

Relacion con Operativo 2026:
- Fixture.
`,
            'utf8'
        );

        const result = spawnSync('php', ['bin/validate-agent-governance.php'], {
            cwd: dir,
            encoding: 'utf8',
        });

        assert.equal(
            result.status,
            0,
            `validator deberia aceptar validated_release_promotion ya done\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}`
        );
        assert.match(String(result.stdout || ''), /OK:\s+gobernanza de agentes valida/i);
    } finally {
        cleanupPhpGovernanceFixtureDir(dir);
    }
});
