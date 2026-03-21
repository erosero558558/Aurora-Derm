#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    copyFileSync,
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const DAILY_PULSE_SCRIPT = join(REPO_ROOT, 'bin', 'agent-daily-pulse.js');
const CLEAN_LOCAL_ARTIFACTS_SOURCE = join(
    REPO_ROOT,
    'bin',
    'clean-local-artifacts.js'
);
const WORKSPACE_HYGIENE_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'workspace-hygiene.js'
);
const GENERATED_SITE_ROOT_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'generated-site-root.js'
);
const PULSE_NOW = '2026-03-16T12:00:00Z';

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-daily-pulse-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
    cpSync(ORCHESTRATOR_TOOLS_DIR, join(dir, 'tools', 'agent-orchestrator'), {
        recursive: true,
    });
    copyFileSync(GOVERNANCE_POLICY_SOURCE, join(dir, 'governance-policy.json'));
    mkdirSync(join(dir, 'bin'), { recursive: true });
    mkdirSync(join(dir, 'bin', 'lib'), { recursive: true });
    copyFileSync(
        CLEAN_LOCAL_ARTIFACTS_SOURCE,
        join(dir, 'bin', 'clean-local-artifacts.js')
    );
    copyFileSync(
        WORKSPACE_HYGIENE_SOURCE,
        join(dir, 'bin', 'lib', 'workspace-hygiene.js')
    );
    copyFileSync(
        GENERATED_SITE_ROOT_SOURCE,
        join(dir, 'bin', 'lib', 'generated-site-root.js')
    );
    return dir;
}

function cleanupFixtureDir(dir) {
    rmSync(dir, { recursive: true, force: true });
}

function writeCommonFiles(dir) {
    mkdirSync(join(dir, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(dir, 'verification', 'agent-runs', 'AG-900.md'),
        '# AG-900 evidence\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        'version: 1\nhandoffs: []\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_DECISIONS.yaml'),
        'version: 1\npolicy:\n  owner_model: human_supervisor\n  revision: 1\n  updated_at: "2026-03-16"\ndecisions: []\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_SIGNALS.yaml'),
        'version: 1\nsignals: []\n',
        'utf8'
    );
}

function writeJobsFixture(dir) {
    const runtimeDir = join(dir, 'runtime');
    const statusPath = join(runtimeDir, 'public-sync-status.json');
    const nowIso = new Date().toISOString();
    mkdirSync(runtimeDir, { recursive: true });
    writeFileSync(
        statusPath,
        `${JSON.stringify(
            {
                version: 1,
                job_id: 'job-public-main-sync',
                job_key: 'public_main_sync',
                state: 'success',
                checked_at: nowIso,
                last_success_at: nowIso,
                last_error_at: '',
                last_error_message: '',
                deployed_commit: 'abc1234',
                current_head: 'abc1234',
                remote_head: 'abc1234',
                dirty_paths_count: 0,
                dirty_paths_sample: [],
                dirty_paths: [],
            },
            null,
            2
        )}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_JOBS.yaml'),
        `version: 1
updated_at: "2026-03-16T00:00:00Z"
jobs:
  - key: public_main_sync
    job_id: "job-public-main-sync"
    enabled: true
    type: external_cron
    owner: codex_backend_ops
    environment: production
    repo_path: /var/www/figo
    branch: main
    schedule: "* * * * *"
    command: /root/sync-pielarmonia.sh
    wrapper_fallback: /var/www/figo/bin/deploy-public-v3-cron-sync.sh
    lock_file: /tmp/sync-pielarmonia.lock
    log_path: /var/log/sync-pielarmonia.log
    status_path: "${statusPath.replace(/\\/g, '/')}"
    expected_max_lag_seconds: 120
    source_of_truth: host_cron
    publish_strategy: main_auto_guarded
`,
        'utf8'
    );
}

function writePlanFile(dir, includeCodexActive = false) {
    const activeBlock = includeCodexActive
        ? `
<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: blocked
files: ["AGENT_BOARD.yaml", "agent-orchestrator.js"]
updated_at: 2026-03-16
-->
`
        : '';
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        `# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-2026-03-admin-operativo
title: "Admin operativo"
status: active
owner: deck
objective: "Cerrar admin operativo"
started_at: "2026-03-14"
review_due_at: "2026-03-21"
success_signal: "demo"
subfront_ids: ["SF-backend-admin-operativo", "SF-transversal-admin-operativo"]
updated_at: 2026-03-16
-->
${activeBlock}
Fixture.
`,
        'utf8'
    );
}

function writeBoardFixture(dir, options = {}) {
    const includeCodexBlocked = options.includeCodexBlocked === true;
    const board = `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  revision: "12"
  updated_at: "2026-03-16"
strategy:
  active:
    id: STRAT-2026-03-admin-operativo
    title: "Admin operativo"
    objective: "Cerrar admin operativo"
    owner: deck
    status: active
    started_at: "2026-03-14"
    review_due_at: "2026-03-21"
    exit_criteria: ["demo"]
    success_signal: "demo"
    focus_id: "FOCUS-2026-03-admin-operativo-cut-1"
    focus_title: "Admin operativo demostrable"
    focus_summary: "Corte comun"
    focus_status: active
    focus_proof: "Demo comun"
    focus_steps: ["feedback_trim"]
    focus_next_step: "feedback_trim"
    focus_required_checks: ["job:public_main_sync"]
    focus_non_goals: ["rediseno_publico"]
    focus_owner: "deck"
    focus_review_due_at: "2026-03-21"
    focus_evidence_ref: ""
    focus_max_active_slices: 3
    subfronts:
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend-admin-operativo
        title: "Backend soporte"
        allowed_scopes: ["auth", "backend", "readiness", "gates"]
        support_only_scopes: ["deploy", "ops", "monitoring", "tests"]
        blocked_scopes: ["frontend-public"]
      - codex_instance: codex_transversal
        subfront_id: SF-transversal-admin-operativo
        title: "Tooling soporte"
        allowed_scopes: []
        support_only_scopes: ["tooling", "codex-governance"]
        blocked_scopes: ["backend"]
tasks:
  - id: AG-900
    title: "Dependency closed"
    owner: deck
    executor: codex
    status: done
    risk: low
    scope: tests
    files: ["README.md"]
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: support
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: feedback_trim
    integration_slice: tests_quality
    work_type: support
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-900.md"
    evidence_ref: "verification/agent-runs/AG-900.md"
    depends_on: []
    created_at: "2026-03-14"
    updated_at: "2026-03-16"
  - id: AG-101
    title: "Stale in progress"
    owner: deck
    executor: codex
    status: in_progress
    risk: medium
    scope: backend
    files: ["docs/backend.md"]
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: primary
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: feedback_trim
    integration_slice: backend_readiness
    work_type: support
    status_since_at: "2026-03-14T00:00:00Z"
    lease_id: "lease_AG-101"
    lease_owner: "deck"
    lease_created_at: "2026-03-14T00:00:00Z"
    heartbeat_at: "2026-03-14T01:00:00Z"
    lease_expires_at: "2026-03-14T05:00:00Z"
    blocked_reason: ""
    depends_on: []
    created_at: "2026-03-14"
    updated_at: "2026-03-16"
  - id: AG-102
    title: "Blocked by dependency"
    owner: deck
    executor: codex
    status: blocked
    risk: medium
    scope: backend
    files: ["docs/dependency.md"]
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: primary
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: feedback_trim
    integration_slice: backend_readiness
    work_type: support
    status_since_at: "2026-03-16T01:00:00Z"
    blocked_reason: "waiting_dependency"
    depends_on: ["AG-900"]
    created_at: "2026-03-14"
    updated_at: "2026-03-16"
  - id: AG-103
    title: "Public sync support task"
    owner: deck
    executor: codex
    status: blocked
    risk: medium
    scope: deploy
    files: ["controllers/HealthController.php", "docs/PUBLIC_MAIN_UPDATE_RUNBOOK.md"]
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: support
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: feedback_trim
    integration_slice: ops_deploy
    work_type: support
    status_since_at: "2026-03-16T01:30:00Z"
    blocked_reason: "waiting_public_sync"
    expected_outcome: "public_main_sync vuelve a verde"
    depends_on: []
    created_at: "2026-03-14"
    updated_at: "2026-03-16"
  - id: AG-104
    title: "Blocked with expired lease"
    owner: deck
    executor: codex
    status: blocked
    risk: low
    scope: docs
    files: ["docs/ops.md"]
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: support
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: feedback_trim
    integration_slice: governance_evidence
    work_type: support
    status_since_at: "2026-03-16T04:00:00Z"
    blocked_reason: "waiting_manual_review"
    lease_id: "lease_AG-104"
    lease_owner: "deck"
    lease_created_at: "2026-03-16T04:00:00Z"
    heartbeat_at: "2026-03-16T04:05:00Z"
    lease_expires_at: "2026-03-16T08:00:00Z"
    depends_on: []
    created_at: "2026-03-16"
    updated_at: "2026-03-16"
${
    includeCodexBlocked
        ? `  - id: CDX-001
    title: "Codex public sync mirror"
    owner: deck
    executor: codex
    status: blocked
    risk: medium
    scope: tooling
    files: ["agent-orchestrator.js", "controllers/HealthController.php"]
    codex_instance: codex_transversal
    domain_lane: transversal_runtime
    lane_lock: strict
    cross_domain: false
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-transversal-admin-operativo
    strategy_role: support
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: feedback_trim
    integration_slice: governance_evidence
    work_type: support
    status_since_at: "2026-03-16T05:00:00Z"
    blocked_reason: "waiting_public_sync"
    expected_outcome: "public_main_sync vuelve a verde"
    depends_on: []
    created_at: "2026-03-16"
    updated_at: "2026-03-16"
`
        : ''
}`;
    writeFileSync(join(dir, 'AGENT_BOARD.yaml'), board, 'utf8');
}

function runPulse(dir, args = [], envPatch = null) {
    const result = spawnSync(
        process.execPath,
        [DAILY_PULSE_SCRIPT, '--root', dir, ...args],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env: envPatch ? { ...process.env, ...envPatch } : process.env,
            maxBuffer: 2 * 1024 * 1024,
        }
    );
    if (result.error) throw result.error;
    return result;
}

test('agent-daily-pulse preview genera artefactos estables sin mutar el board', () => {
    const dir = createFixtureDir();
    try {
        writeCommonFiles(dir);
        writeJobsFixture(dir);
        writeBoardFixture(dir);
        writePlanFile(dir);
        const boardBefore = readFileSync(join(dir, 'AGENT_BOARD.yaml'), 'utf8');

        const result = runPulse(dir, ['--json'], {
            AGENT_DAILY_PULSE_NOW: PULSE_NOW,
        });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const payload = JSON.parse(result.stdout);

        assert.equal(typeof payload.summary, 'object');
        assert.equal(Array.isArray(payload.blockers), true);
        assert.equal(Array.isArray(payload.active_tasks), true);
        assert.equal(typeof payload.checks, 'object');
        assert.equal(typeof payload.autofix, 'object');
        assert.equal(typeof payload.trends, 'object');
        assert.equal(Array.isArray(payload.recommended_actions), true);
        assert.equal(payload.autofix.mode, 'preview');
        assert.equal(payload.autofix.applied_total, 0);

        assert.equal(
            existsSync(join(dir, 'verification', 'daily-ops', 'latest.json')),
            true
        );
        assert.equal(
            existsSync(join(dir, 'verification', 'daily-ops', 'latest.md')),
            true
        );
        assert.equal(
            existsSync(
                join(dir, 'verification', 'agent-daily-pulse-history.json')
            ),
            true
        );
        assert.equal(
            readFileSync(join(dir, 'AGENT_BOARD.yaml'), 'utf8'),
            boardBefore
        );
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('agent-daily-pulse --apply bloquea stale tasks, desbloquea bloqueados elegibles y renueva leases restantes', () => {
    const dir = createFixtureDir();
    try {
        writeCommonFiles(dir);
        writeJobsFixture(dir);
        writeBoardFixture(dir);
        writePlanFile(dir);

        const result = runPulse(dir, ['--json', '--apply'], {
            AGENT_DAILY_PULSE_NOW: PULSE_NOW,
        });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const payload = JSON.parse(result.stdout);
        assert.equal(payload.autofix.mode, 'apply');
        assert.equal(payload.autofix.applied_total, 4);
        assert.equal(
            payload.autofix.actions.every((item) => {
                if (!item.command) return true;
                return (
                    item.command.startsWith(
                        'node agent-orchestrator.js task claim'
                    ) ||
                    item.command.startsWith(
                        'node agent-orchestrator.js leases heartbeat'
                    )
                );
            }),
            true
        );

        const boardAfter = readFileSync(join(dir, 'AGENT_BOARD.yaml'), 'utf8');
        assert.match(boardAfter, /id: AG-101[\s\S]*?status: blocked/);
        assert.match(
            boardAfter,
            /id: AG-101[\s\S]*?blocked_reason: "auto:daily_pulse:stale_status_without_fresh_heartbeat"|id: AG-101[\s\S]*?blocked_reason: auto:daily_pulse:stale_status_without_fresh_heartbeat/
        );
        assert.match(boardAfter, /id: AG-102[\s\S]*?status: ready/);
        assert.match(boardAfter, /id: AG-103[\s\S]*?status: ready/);
        assert.match(
            boardAfter,
            /id: AG-104[\s\S]*?heartbeat_at: "[0-9]{4}-[0-9]{2}-[0-9]{2}T/
        );

        assert.equal(
            existsSync(join(dir, 'verification', 'agent-board-events.jsonl')),
            true
        );
        const latestJson = JSON.parse(
            readFileSync(
                join(dir, 'verification', 'daily-ops', 'latest.json'),
                'utf8'
            )
        );
        assert.equal(latestJson.summary.active_tasks_total >= 1, true);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('agent-daily-pulse mantiene tareas CDX en modo manual y no rompe la retencion del historial', () => {
    const dir = createFixtureDir();
    try {
        writeCommonFiles(dir);
        writeJobsFixture(dir);
        writeBoardFixture(dir, { includeCodexBlocked: true });
        writePlanFile(dir, true);

        const snapshots = [];
        for (let index = 0; index < 365; index += 1) {
            const day = String((index % 28) + 1).padStart(2, '0');
            const month = String((index % 12) + 1).padStart(2, '0');
            snapshots.push({
                date: `2025-${month}-${day}`,
                generated_at: `2025-${month}-${day}T06:15:00Z`,
                focus_id: 'FOCUS-old',
                focus_step: 'feedback_trim',
                global_signal: 'YELLOW',
                blocker_codes: ['block.jobs.public_main_sync_failed'],
                required_checks: [{ id: 'job:public_main_sync', ok: false }],
                expired_leases: 0,
                auto_actions: [],
                active_task_ids: ['AG-001'],
                git_activity: { available: false, totals: { commits: 0 } },
                board_events: { total: 0, by_event_type: {} },
            });
        }
        writeFileSync(
            join(dir, 'verification', 'agent-daily-pulse-history.json'),
            `${JSON.stringify(
                {
                    version: 1,
                    updated_at: '2025-12-31T06:15:00Z',
                    retention_days: 365,
                    snapshots,
                },
                null,
                2
            )}\n`,
            'utf8'
        );

        const result = runPulse(dir, ['--json'], {
            AGENT_DAILY_PULSE_NOW: PULSE_NOW,
        });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        const payload = JSON.parse(result.stdout);
        const skipped = payload.autofix.actions.find(
            (item) => item.task_id === 'CDX-001'
        );
        assert.ok(skipped);
        assert.equal(skipped.status, 'skipped');

        const history = JSON.parse(
            readFileSync(
                join(dir, 'verification', 'agent-daily-pulse-history.json'),
                'utf8'
            )
        );
        assert.equal(history.snapshots.length, 365);
        assert.equal(
            Object.values(payload.trends.history.blocker_streaks).some(
                (value) => Number(value) >= 1
            ),
            true
        );
    } finally {
        cleanupFixtureDir(dir);
    }
});
