#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    copyFileSync,
    cpSync,
    rmSync,
    existsSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawnSync, spawn } = require('child_process');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const SUMMARY_SCRIPT = join(REPO_ROOT, 'bin', 'agent-governance-summary.js');
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
const CLEAN_LOCAL_ARTIFACTS_SOURCE = join(
    REPO_ROOT,
    'bin',
    'clean-local-artifacts.js'
);
const DATE = '2026-02-24';
const CODEX_MODEL_ROUTING_FIELDS = `
    model_tier_default: "gpt-5.4-mini"
    premium_budget: 0
    premium_calls_used: 0
    premium_gate_state: "closed"
    decision_packet_ref: ""
    model_policy_version: "2026-03-17-codex-model-routing-v2"`;

function createFixtureDir() {
    const dir = mkdtempSync(join(tmpdir(), 'agent-governance-summary-'));
    copyFileSync(ORCHESTRATOR_SOURCE, join(dir, 'agent-orchestrator.js'));
    cpSync(ORCHESTRATOR_TOOLS_DIR, join(dir, 'tools', 'agent-orchestrator'), {
        recursive: true,
    });
    copyFileSync(GOVERNANCE_POLICY_SOURCE, join(dir, 'governance-policy.json'));
    mkdirSync(join(dir, 'bin', 'lib'), { recursive: true });
    copyFileSync(
        WORKSPACE_HYGIENE_SOURCE,
        join(dir, 'bin', 'lib', 'workspace-hygiene.js')
    );
    copyFileSync(
        GENERATED_SITE_ROOT_SOURCE,
        join(dir, 'bin', 'lib', 'generated-site-root.js')
    );
    copyFileSync(
        CLEAN_LOCAL_ARTIFACTS_SOURCE,
        join(dir, 'bin', 'clean-local-artifacts.js')
    );
    return dir;
}

function cleanupFixtureDir(dir) {
    rmSync(dir, { recursive: true, force: true });
}

function writeFixtureFiles(dir) {
    const board = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Fixture task"
    owner: ernesto
    executor: jules
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-001.md"
    evidence_ref: "verification/agent-runs/AG-001.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}

  - id: CDX-001
    title: "Codex fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: medium
    scope: codex-governance
${CODEX_MODEL_ROUTING_FIELDS}
    files: ["AGENTS.md", "agent-orchestrator.js"]
    acceptance: "Fixture"
    acceptance_ref: "PLAN_MAESTRO_CODEX_2026.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`;

    const handoffs = `
version: 1
handoffs: []
`;

    const plan = `
# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: in_progress
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: ${DATE}
-->

Relacion con Operativo 2026:
- Fixture.
`;

    writeFileSync(join(dir, 'AGENT_BOARD.yaml'), `${board.trim()}\n`, 'utf8');
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        `${handoffs.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        `${plan.trim()}\n`,
        'utf8'
    );
    mkdirSync(join(dir, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(dir, 'verification', 'agent-runs', 'AG-001.md'),
        '# AG-001 fixture evidence\n',
        'utf8'
    );
}

function writeFixtureFilesWithStrategy(
    dir,
    { runtimeRequiredCheck = 'runtime:openclaw_chatgpt' } = {}
) {
    const board = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
strategy:
  active:
    id: STRAT-2026-03-admin-operativo
    title: "Admin operativo"
    objective: "Cerrar admin operativo"
    owner: ernesto
    status: active
    started_at: "2026-03-14"
    review_due_at: "2026-03-21"
    exit_criteria: ["uno"]
    success_signal: "demo"
    focus_id: "FOCUS-2026-03-admin-operativo-cut-1"
    focus_title: "Admin operativo demostrable"
    focus_summary: "Corte comun"
    focus_status: active
    focus_proof: "Demo comun"
    focus_steps: ["admin_queue_pilot_cut", "pilot_readiness_evidence"]
    focus_next_step: "admin_queue_pilot_cut"
    focus_required_checks: ["job:public_main_sync", "${runtimeRequiredCheck}"]
    focus_non_goals: ["rediseno_publico"]
    focus_owner: "ernesto"
    focus_review_due_at: "2026-03-21"
    focus_evidence_ref: ""
    focus_max_active_slices: 3
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-admin-operativo
        title: "Admin UX"
        allowed_scopes: ["frontend-admin", "queue"]
        support_only_scopes: ["docs"]
        blocked_scopes: ["payments"]
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend-admin-operativo
        title: "Backend soporte"
        allowed_scopes: ["auth", "backend", "readiness", "gates"]
        support_only_scopes: ["tests"]
        blocked_scopes: ["frontend-public"]
      - codex_instance: codex_transversal
        subfront_id: SF-transversal-admin-operativo
        title: "Runtime soporte"
        allowed_scopes: []
        support_only_scopes: ["openclaw_runtime", "tooling"]
        blocked_scopes: ["backend"]
tasks:
  - id: AG-001
    title: "Fixture task"
    owner: ernesto
    executor: jules
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-001.md"
    evidence_ref: "verification/agent-runs/AG-001.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}

  - id: CDX-001
    title: "Codex fixture"
    owner: ernesto
    executor: codex
    status: done
    risk: medium
    scope: codex-governance
    files: ["AGENTS.md", "agent-orchestrator.js"]
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/CDX-001.md"
    evidence_ref: "verification/agent-runs/CDX-001.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`;

    const handoffs = `
version: 1
handoffs: []
`;

    const plan = `
# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-2026-03-admin-operativo
title: "Admin operativo"
status: active
owner: ernesto
objective: "Cerrar admin operativo"
started_at: "2026-03-14"
review_due_at: "2026-03-21"
success_signal: "demo"
subfront_ids: ["SF-frontend-admin-operativo", "SF-backend-admin-operativo", "SF-transversal-admin-operativo"]
updated_at: ${DATE}
-->

Relacion con Operativo 2026:
- Fixture.
`;

    writeFileSync(join(dir, 'AGENT_BOARD.yaml'), `${board.trim()}\n`, 'utf8');
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        `${handoffs.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        `${plan.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_DECISIONS.yaml'),
        `version: 1
policy:
  owner_model: human_supervisor
  revision: 1
  updated_at: "2026-03-14"
decisions:
  - id: DEC-001
    strategy_id: STRAT-2026-03-admin-operativo
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: admin_queue_pilot_cut
    title: "Resolver gate del corte"
    owner: ernesto
    status: open
    due_at: "2026-03-15"
    recommended_option: "repair_sync"
    selected_option: ""
    rationale: "public_main_sync esta rojo"
    related_tasks: ["CDX-001"]
    opened_at: "2026-03-14"
    resolved_at: ""
`,
        'utf8'
    );
    mkdirSync(join(dir, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(dir, 'verification', 'agent-runs', 'AG-001.md'),
        '# AG-001 fixture evidence\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'verification', 'agent-runs', 'CDX-001.md'),
        '# CDX-001 fixture evidence\n',
        'utf8'
    );
}

function writeFixtureFilesWithStrategyTasks(
    dir,
    tasksYaml,
    { requiredChecks = ['job:public_main_sync', 'runtime:openclaw_chatgpt'] } = {}
) {
    const taskLines = String(tasksYaml || '')
        .replace(/^\s*\n|\n\s*$/g, '')
        .split('\n');
    const commonIndent = taskLines
        .filter((line) => line.trim())
        .reduce((minIndent, line) => {
            const indent = (line.match(/^(\s*)/) || [''])[0].length;
            return minIndent === null ? indent : Math.min(minIndent, indent);
        }, null);
    const tasksBlock = taskLines
        .map((line) => {
            if (!line.trim()) return '';
            const normalizedLine =
                commonIndent && commonIndent > 0
                    ? line.slice(commonIndent)
                    : line;
            return `  ${normalizedLine}`;
        })
        .join('\n');
    const checksYaml = Array.isArray(requiredChecks)
        ? requiredChecks.map((value) => `"${String(value)}"`).join(', ')
        : '"job:public_main_sync"';
    const board = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
strategy:
  active:
    id: STRAT-2026-03-admin-operativo
    title: "Admin operativo"
    objective: "Cerrar admin operativo"
    owner: ernesto
    status: active
    started_at: "2026-03-14"
    review_due_at: "2026-03-21"
    exit_criteria: ["uno"]
    success_signal: "demo"
    focus_id: "FOCUS-2026-03-admin-operativo-cut-1"
    focus_title: "Admin operativo demostrable"
    focus_summary: "Corte comun"
    focus_status: active
    focus_proof: "Demo comun"
    focus_steps: ["admin_queue_pilot_cut", "pilot_readiness_evidence"]
    focus_next_step: "admin_queue_pilot_cut"
    focus_required_checks: [${checksYaml}]
    focus_non_goals: ["rediseno_publico"]
    focus_owner: "ernesto"
    focus_review_due_at: "2026-03-21"
    focus_evidence_ref: ""
    focus_max_active_slices: 3
    subfronts:
      - codex_instance: codex_frontend
        subfront_id: SF-frontend-admin-operativo
        title: "Admin UX"
        allowed_scopes: ["frontend-admin", "queue"]
        support_only_scopes: ["docs"]
        blocked_scopes: ["payments"]
      - codex_instance: codex_backend_ops
        subfront_id: SF-backend-admin-operativo
        title: "Backend soporte"
        allowed_scopes: ["auth", "backend", "readiness", "gates"]
        support_only_scopes: ["tests"]
        blocked_scopes: ["frontend-public"]
      - codex_instance: codex_transversal
        subfront_id: SF-transversal-admin-operativo
        title: "Runtime soporte"
        allowed_scopes: []
        support_only_scopes: ["openclaw_runtime", "tooling"]
        blocked_scopes: ["backend"]
tasks:
${tasksBlock}
`;

    const handoffs = `
version: 1
handoffs: []
`;

    const plan = `
# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_STRATEGY_ACTIVE
id: STRAT-2026-03-admin-operativo
title: "Admin operativo"
status: active
owner: ernesto
objective: "Cerrar admin operativo"
started_at: "2026-03-14"
review_due_at: "2026-03-21"
success_signal: "demo"
subfront_ids: ["SF-frontend-admin-operativo", "SF-backend-admin-operativo", "SF-transversal-admin-operativo"]
updated_at: ${DATE}
-->

Relacion con Operativo 2026:
- Fixture.
`;

    writeFileSync(join(dir, 'AGENT_BOARD.yaml'), `${board.trim()}\n`, 'utf8');
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        `${handoffs.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        `${plan.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_DECISIONS.yaml'),
        `version: 1
policy:
  owner_model: human_supervisor
  revision: 1
  updated_at: "2026-03-14"
decisions: []
`,
        'utf8'
    );
    mkdirSync(join(dir, 'verification', 'agent-runs'), { recursive: true });
}

function writePublicSyncJobsFixture(dir) {
    const runtimeDir = join(dir, 'runtime');
    const statusPath = join(runtimeDir, 'public-sync-status.json');
    mkdirSync(runtimeDir, { recursive: true });
    const nowIso = new Date().toISOString();
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
updated_at: "2026-03-11T00:00:00Z"
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

function writeFixtureFilesWithChatFailure(dir) {
    const board = `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Fixture task"
    owner: ernesto
    executor: jules
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-001.md"
    evidence_ref: "verification/agent-runs/AG-001.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}

  - id: AG-002
    title: "Chat failure fixture"
    owner: ernesto
    executor: kimi
    status: failed
    risk: high
    scope: chat
    files: ["src/apps/chat/engine.js"]
    acceptance: "Fixture"
    acceptance_ref: "verification/agent-runs/AG-002.md"
    evidence_ref: "verification/agent-runs/AG-002.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}

  - id: CDX-001
    title: "Codex fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: medium
    scope: codex-governance
${CODEX_MODEL_ROUTING_FIELDS}
    files: ["AGENTS.md", "agent-orchestrator.js"]
    acceptance: "Fixture"
    acceptance_ref: "PLAN_MAESTRO_CODEX_2026.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`;

    const handoffs = `
version: 1
handoffs: []
`;

    const plan = `
# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_ACTIVE
block: C1
task_id: CDX-001
status: in_progress
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: ${DATE}
-->

Relacion con Operativo 2026:
- Fixture.
`;

    writeFileSync(join(dir, 'AGENT_BOARD.yaml'), `${board.trim()}\n`, 'utf8');
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        `${handoffs.trim()}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        `${plan.trim()}\n`,
        'utf8'
    );
    mkdirSync(join(dir, 'verification', 'agent-runs'), { recursive: true });
    writeFileSync(
        join(dir, 'verification', 'agent-runs', 'AG-001.md'),
        '# AG-001 fixture evidence\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'verification', 'agent-runs', 'AG-002.md'),
        '# AG-002 fixture evidence\n',
        'utf8'
    );
}

function runSummary(dir, args = [], envPatch = null) {
    const env = {
        ...process.env,
    };
    delete env.OPENCLAW_RUNTIME_BASE_URL;
    delete env.PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL;
    delete env.PIELARMONIA_LEADOPS_SERVER_BASE_URL;
    if (envPatch && typeof envPatch === 'object') {
        Object.assign(env, envPatch);
    }
    const result = spawnSync(
        process.execPath,
        [SUMMARY_SCRIPT, '--root', dir, ...args],
        {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            env,
        }
    );
    if (result.error) throw result.error;
    return result;
}

function runSummaryAsync(dir, args = [], envPatch = null) {
    const env = {
        ...process.env,
    };
    delete env.OPENCLAW_RUNTIME_BASE_URL;
    delete env.PIELARMONIA_OPERATOR_AUTH_SERVER_BASE_URL;
    delete env.PIELARMONIA_LEADOPS_SERVER_BASE_URL;
    if (envPatch && typeof envPatch === 'object') {
        Object.assign(env, envPatch);
    }
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(
            process.execPath,
            [SUMMARY_SCRIPT, '--root', dir, ...args],
            {
                cwd: REPO_ROOT,
                env,
                stdio: ['ignore', 'pipe', 'pipe'],
            }
        );
        let stdout = '';
        let stderr = '';

        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (chunk) => {
            stdout += chunk;
        });
        child.stderr.on('data', (chunk) => {
            stderr += chunk;
        });
        child.on('error', (error) => rejectPromise(error));
        child.on('close', (code, signal) => {
            resolvePromise({
                status: typeof code === 'number' ? code : 1,
                signal: signal || null,
                stdout,
                stderr,
            });
        });
    });
}

async function startRuntimeFixtureServer() {
    const sockets = new Set();
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Connection', 'close');

        if (
            req.method === 'GET' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'health'
        ) {
            res.statusCode = 200;
            res.end(
                JSON.stringify({
                    ok: true,
                    status: 'ok',
                    checks: {
                        leadOps: {
                            configured: false,
                            mode: 'disabled',
                            degraded: false,
                        },
                    },
                })
            );
            return;
        }

        if (
            req.method === 'GET' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'operator-auth-status'
        ) {
            res.statusCode = 200;
            res.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: 'anonymous',
                    mode: 'openclaw_chatgpt',
                    configured: true,
                    recommendedMode: 'openclaw_chatgpt',
                    capabilities: {
                        adminAgent: false,
                    },
                    fallbacks: {
                        legacy_password: {
                            enabled: false,
                            configured: false,
                            requires2FA: true,
                            available: false,
                            reason: 'fallback_disabled',
                        },
                    },
                })
            );
            return;
        }

        if (req.method === 'GET' && url.pathname === '/figo-ai-bridge.php') {
            res.statusCode = 200;
            res.end(
                JSON.stringify({
                    ok: true,
                    provider: 'openclaw_queue',
                    providerMode: 'legacy_proxy',
                    gatewayConfigured: false,
                    openclawReachable: null,
                })
            );
            return;
        }

        res.statusCode = 404;
        res.end(JSON.stringify({ ok: false, error: 'not_found' }));
    });

    server.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl =
        address && typeof address === 'object'
            ? `http://127.0.0.1:${address.port}`
            : 'http://127.0.0.1';

    return {
        baseUrl,
        close: async () => {
            for (const socket of sockets) socket.destroy();
            await new Promise((resolve, reject) =>
                server.close((error) => (error ? reject(error) : resolve()))
            );
        },
    };
}

function assertSummaryJsonContractShape(parsed) {
    assert.equal(typeof parsed, 'object');
    assert.equal(parsed.version, 1);

    assert.equal(typeof parsed.overall, 'object');
    assert.equal(typeof parsed.overall.ok, 'boolean');
    assert.equal(typeof parsed.overall.signal, 'string');
    assert.equal(Array.isArray(parsed.overall.reasons), true);
    assert.equal(Array.isArray(parsed.overall.blockers), true);

    assert.equal(typeof parsed.policies, 'object');
    assert.equal(typeof parsed.policies.strict, 'object');
    assert.equal(typeof parsed.policies.strict.pass, 'boolean');
    assert.equal(typeof parsed.policies.strict.reason, 'string');
    assert.equal(typeof parsed.policies.fail_on_red, 'object');
    assert.equal(typeof parsed.policies.fail_on_red.pass, 'boolean');
    assert.equal(typeof parsed.policies.fail_on_red.reason, 'string');

    assert.equal(typeof parsed.delta_summary, 'object');
    assert.equal(typeof parsed.delta_summary.conflicts_blocking, 'object');
    assert.equal(
        typeof parsed.delta_summary.conflicts_blocking.delta,
        'number'
    );
    assert.equal(typeof parsed.delta_summary.conflicts_handoff, 'object');
    assert.equal(typeof parsed.delta_summary.conflicts_handoff.delta, 'number');

    assert.equal(Array.isArray(parsed.diagnostics), true);
    assert.equal(typeof parsed.warnings_count, 'number');
    assert.equal(typeof parsed.errors_count, 'number');

    assert.equal(typeof parsed.commands, 'object');
    for (const key of [
        'status',
        'conflicts',
        'handoffsStatus',
        'handoffsLint',
        'policy',
        'codexCheck',
        'boardDoctor',
        'metrics',
    ]) {
        assert.equal(typeof parsed.commands[key], 'object');
        assert.equal(typeof parsed.commands[key].exit_code, 'number');
        assert.equal(typeof parsed.commands[key].command, 'string');
    }

    assert.equal(typeof parsed.status, 'object');
    assert.equal(typeof parsed.conflicts, 'object');
    assert.equal(typeof parsed.handoffs, 'object');
    assert.equal(typeof parsed.handoffs.status, 'object');
    assert.equal(typeof parsed.handoffs.lint, 'object');
    assert.equal(typeof parsed.policy, 'object');
    assert.equal(typeof parsed.codex_check, 'object');
    assert.equal(typeof parsed.board_doctor, 'object');
    assert.equal(typeof parsed.metrics, 'object');
    assert.equal(typeof parsed.domain_health, 'object');
    assert.equal(typeof parsed.contribution, 'object');
    assert.equal(typeof parsed.workspace_hygiene, 'object');
    assert.equal(typeof parsed.workspace_truth, 'object');
    assert.equal(typeof parsed.status.evidence_summary, 'object');
    assert.equal(typeof parsed.board_doctor.evidence_summary, 'object');
}

test('agent-governance-summary genera JSON/Markdown y escribe artefactos', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const outJson = 'verification/agent-governance-summary.json';
    const outMd = 'verification/agent-governance-summary.md';
    const result = runSummary(dir, [
        '--format',
        'json',
        '--write-json',
        outJson,
        '--write-md',
        outMd,
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.version, 1);
    assert.equal(parsed.overall.ok, true);
    assert.equal(parsed.overall.signal, 'GREEN');
    assert.equal(Array.isArray(parsed.overall.reasons), true);
    assert.equal(parsed.overall.execution_state, 'DEGRADED');
    assert.match(
        parsed.overall.reasons.join(' | '),
        /required_checks_pending|warnings:/i
    );
    assert.deepEqual(parsed.overall.domain_reasons, ['stable']);
    assert.equal(typeof parsed.overall.domain_weighted_score_pct, 'number');
    assert.equal(
        typeof parsed.overall.domain_weighted_score_global_pct,
        'number'
    );
    assert.equal(
        typeof parsed.overall.domain_regression_green_to_red,
        'number'
    );
    assert.ok(parsed.policies);
    assert.equal(parsed.policies.strict.pass, true);
    assert.equal(parsed.policies.fail_on_red.pass, true);
    assert.equal(parsed.status.totals.tasks, 2);
    assert.equal(parsed.conflicts.totals.blocking, 0);
    assert.equal(parsed.handoffs.lint.ok, true);
    assert.equal(parsed.policy.ok, true);
    assert.equal(parsed.codex_check.ok, true);
    assert.equal(parsed.metrics.version, 1);
    assert.ok(parsed.contribution);
    assert.ok(parsed.domain_health);
    assert.ok(parsed.contribution_history);
    assert.ok(parsed.domain_health_history);
    assert.equal(Array.isArray(parsed.domain_health.ranking), true);
    assert.equal(Array.isArray(parsed.contribution_history.daily), true);
    assert.equal(Array.isArray(parsed.domain_health_history.daily), true);
    assert.ok(Array.isArray(parsed.contribution.ranking));
    assert.ok(parsed.contribution.top_executor);
    assert.equal(typeof parsed.workspace_hygiene, 'object');
    assert.equal(typeof parsed.workspace_truth, 'object');
    assert.equal(
        typeof parsed.delta_summary.conflicts_blocking.delta,
        'number'
    );
    assert.equal(typeof parsed.delta_summary.conflicts_handoff.delta, 'number');
    assert.equal(Array.isArray(parsed.diagnostics), true);
    assert.equal(typeof parsed.warnings_count, 'number');
    assert.equal(typeof parsed.errors_count, 'number');
    assert.equal(
        typeof parsed.status.evidence_summary.terminal_tasks,
        'number'
    );
    assert.equal(
        typeof parsed.board_doctor.evidence_summary.terminal_tasks,
        'number'
    );
    assert.equal(parsed.commands.status.exit_code, 0);
    assert.equal(parsed.commands.policy.exit_code, 0);
    assert.equal(parsed.commands.boardDoctor.exit_code, 0);
    assert.equal(parsed.commands.metrics.exit_code, 0);
    assert.match(
        parsed.commands.metrics.command,
        /metrics --json --profile local/
    );

    const jsonPath = join(dir, outJson);
    const mdPath = join(dir, outMd);
    const metricsPath = join(dir, 'verification', 'agent-metrics.json');
    assert.equal(existsSync(jsonPath), true);
    assert.equal(existsSync(mdPath), true);
    assert.equal(existsSync(metricsPath), false);

    const writtenJson = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const writtenMd = readFileSync(mdPath, 'utf8');
    assert.equal(writtenJson.version, 1);
    assert.match(writtenMd, /^## Agent Governance Summary/m);
    assert.match(writtenMd, /Overall:\s+DEGRADED/);
    assert.match(writtenMd, /Execution state:\s+`DEGRADED`/);
    assert.match(writtenMd, /Domain signal:\s+`GREEN`/);
    assert.match(writtenMd, /Score salud dominios \(priority\):/);
    assert.match(writtenMd, /Regresiones dominio GREEN->RED:/);
    assert.match(writtenMd, /Razones:\s+`warnings:\d+`/);
    assert.match(writtenMd, /Razones dominio:\s+`stable`/);
    assert.match(writtenMd, /Politicas:\s+strict=PASS/);
    assert.match(writtenMd, /Diagnostics warn-first:/);
    assert.match(writtenMd, /Delta vs Baseline \(Conflicts\/Handoffs\)/);
    assert.match(writtenMd, /Semaforo Por Dominio/);
    assert.match(writtenMd, /Historico Salud por Dominio/);
    assert.match(writtenMd, /Aporte Por Agente/);
    assert.match(writtenMd, /Historico Aporte/);
    assert.match(writtenMd, /Terminal evidence:/);
    assert.match(writtenMd, /Board Doctor/);
    assert.match(writtenMd, /Evidence: aligned=/);
    assert.match(writtenMd, /Warn-first Diagnostics/);
    assert.match(writtenMd, /\[GREEN\].*jules|\[GREEN\].*codex/);
});

test('agent-governance-summary deduplica required_check_unverified y agrega sources[]', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithStrategyTasks(
        dir,
        `
  - id: AG-010
    title: "Forward fixture"
    owner: ernesto
    executor: ci
    status: in_progress
    risk: medium
    scope: backend
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    files: ["controllers/AdminController.php"]
    acceptance: "Fixture"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-backend-admin-operativo
    strategy_role: primary
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: admin_queue_pilot_cut
    integration_slice: backend_readiness
    work_type: forward
    expected_outcome: "Forward delivery"
    decision_ref: ""
    rework_parent: ""
    rework_reason: ""
`,
        {
            requiredChecks: ['job:public_main_sync'],
        }
    );

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    const matches = parsed.diagnostics.filter(
        (item) => item.code === 'warn.focus.required_check_unverified'
    );

    assert.equal(matches.length, 1);
    assert.equal(matches[0].scope, 'release');
    assert.equal(Array.isArray(matches[0].sources), true);
    assert.equal(matches[0].sources.includes('status'), true);
    assert.equal(matches[0].sources.some((value) => /board/i.test(value)), true);
});

test('agent-governance-summary marca support_only, release_ready=false y blocker externo reconocido', async (t) => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeFixtureServer();
    t.after(async () => {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    });
    writeFixtureFilesWithStrategyTasks(
        dir,
        `
  - id: AG-020
    title: "Support-only fixture"
    owner: ernesto
    executor: ci
    status: blocked
    risk: medium
    scope: docs
    codex_instance: codex_frontend
    domain_lane: frontend_content
    lane_lock: strict
    cross_domain: false
    files: ["docs/runbook.md"]
    acceptance: "Fixture"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
    strategy_id: STRAT-2026-03-admin-operativo
    subfront_id: SF-frontend-admin-operativo
    strategy_role: support
    focus_id: FOCUS-2026-03-admin-operativo-cut-1
    focus_step: admin_queue_pilot_cut
    integration_slice: governance_evidence
    work_type: support
    expected_outcome: "Support only"
    decision_ref: ""
    rework_parent: ""
    rework_reason: ""
    blocked_reason: "host_502_publicsync_operator_auth_and_no_host_access"
`,
        {
            requiredChecks: [
                'job:public_main_sync',
                'runtime:openclaw_chatgpt',
            ],
        }
    );
    writePublicSyncJobsFixture(dir);

    const result = await runSummaryAsync(
        dir,
        ['--format', 'json'],
        {
            OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
        }
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    const supportOnlyDiag = parsed.diagnostics.find(
        (item) => item.code === 'warn.focus.support_only_active'
    );

    assert.equal(parsed.status.focus.support_only, true);
    assert.equal(parsed.status.focus.release_ready, false);
    assert.equal(parsed.overall.execution_state, 'BLOCKED');
    assert.equal(parsed.overall.acknowledged_external_blocker, true);
    assert.deepEqual(parsed.overall.external_blocker_task_ids, ['AG-020']);
    assert.ok(supportOnlyDiag);
    assert.equal(supportOnlyDiag.scope, 'operational');
});

test('agent-governance-summary mantiene contrato JSON minimo estable', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const parsed = JSON.parse(result.stdout);
    assertSummaryJsonContractShape(parsed);
});

test('agent-governance-summary expone estrategia activa en JSON y Markdown', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithStrategy(dir);

    let result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.equal(
        parsed.status.strategy.active.id,
        'STRAT-2026-03-admin-operativo'
    );
    assert.equal(
        parsed.board_doctor.strategy_summary.active.id,
        'STRAT-2026-03-admin-operativo'
    );
    assert.equal(
        parsed.status.focus.configured.id,
        'FOCUS-2026-03-admin-operativo-cut-1'
    );
    assert.equal(parsed.status.focus.decisions.open, 1);

    result = runSummary(dir, ['--format', 'markdown']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Strategy:\s+`STRAT-2026-03-admin-operativo`/);
    assert.match(
        result.stdout,
        /Focus:\s+`FOCUS-2026-03-admin-operativo-cut-1`/
    );
    assert.match(
        result.stdout,
        /Strategy doctor:\s+`STRAT-2026-03-admin-operativo`/
    );
    assert.match(
        result.stdout,
        /Focus doctor:\s+`FOCUS-2026-03-admin-operativo-cut-1`/
    );
});

test('agent-governance-summary conserva operator_auth green y public_main_sync green en todas las superficies', async (t) => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeFixtureServer();
    t.after(async () => {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    });
    writeFixtureFilesWithStrategy(dir, {
        runtimeRequiredCheck: 'runtime:operator_auth',
    });
    writePublicSyncJobsFixture(dir);

    const envPatch = {
        OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
    };
    let result = await runSummaryAsync(dir, ['--format', 'json'], envPatch);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    for (const payload of [
        parsed.status.focus,
        parsed.board_doctor.focus_summary,
        parsed.metrics.focus_summary,
    ]) {
        assert.equal(payload.required_checks_ok, true);
        assert.equal(
            payload.required_checks.some(
                (item) =>
                    item.id === 'job:public_main_sync' && item.state === 'green'
            ),
            true
        );
        assert.equal(
            payload.required_checks.some(
                (item) =>
                    item.id === 'runtime:operator_auth' &&
                    item.state === 'green'
            ),
            true
        );
    }

    result = await runSummaryAsync(dir, ['--format', 'markdown'], envPatch);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(
        result.stdout,
        /Focus checks:\s+`job:public_main_sync`=green, `runtime:operator_auth`=green/
    );
    assert.doesNotMatch(result.stdout, /runtime:operator_auth`=unverified/);
});

test('agent-governance-summary acepta operator_auth green cuando mode y recommendedMode coinciden fuera de OpenClaw', async (t) => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeFixtureServer({
        operatorPayload: {
            mode: 'google_oauth',
            recommendedMode: 'google_oauth',
            configured: true,
            status: 'anonymous',
        },
    });
    t.after(async () => {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    });
    writeFixtureFilesWithStrategy(dir, {
        runtimeRequiredCheck: 'runtime:operator_auth',
    });
    writePublicSyncJobsFixture(dir);

    const envPatch = {
        OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
    };
    const result = await runSummaryAsync(dir, ['--format', 'json'], envPatch);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);
    for (const payload of [
        parsed.status.focus,
        parsed.board_doctor.focus_summary,
        parsed.metrics.focus_summary,
    ]) {
        assert.equal(payload.required_checks_ok, true);
        assert.equal(
            payload.required_checks.some(
                (item) =>
                    item.id === 'runtime:operator_auth' &&
                    item.state === 'green'
            ),
            true
        );
    }
});

test('agent-governance-summary alerta regresion de dominio GREEN->RED en PR summary', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            {
                                domain: 'calendar',
                                signal: 'GREEN',
                                tasks_total: 0,
                                active_tasks: 0,
                                done_tasks: 0,
                                blocking_conflicts: 0,
                                handoff_conflicts: 0,
                                active_expired_handoffs: 0,
                            },
                            {
                                domain: 'chat',
                                signal: 'GREEN',
                                tasks_total: 1,
                                active_tasks: 0,
                                done_tasks: 1,
                                blocking_conflicts: 0,
                                handoff_conflicts: 0,
                                active_expired_handoffs: 0,
                            },
                            {
                                domain: 'payments',
                                signal: 'GREEN',
                                tasks_total: 0,
                                active_tasks: 0,
                                done_tasks: 0,
                                blocking_conflicts: 0,
                                handoff_conflicts: 0,
                                active_expired_handoffs: 0,
                            },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.overall.ok, true);
    assert.equal(parsed.overall.signal, 'RED');
    assert.ok(parsed.overall.domain_regression_green_to_red >= 1);
    assert.equal(parsed.policies.strict.pass, true);
    assert.equal(parsed.policies.fail_on_red.pass, false);
    assert.ok(parsed.domain_health_history);
    assert.ok(parsed.domain_health_history.regressions);
    assert.ok(
        parsed.domain_health_history.regressions.green_to_red.some(
            (row) => row.domain === 'chat'
        )
    );

    const md = runSummary(dir, ['--format', 'markdown']).stdout;
    assert.match(md, /Alertas de Regresion de Dominio/);
    assert.match(md, /`chat`: `GREEN` -> `RED`/);
});

test('agent-governance-summary soporta --explain-red en JSON y Markdown', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            { domain: 'calendar', signal: 'GREEN' },
                            { domain: 'chat', signal: 'GREEN' },
                            { domain: 'payments', signal: 'GREEN' },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    let result = runSummary(dir, ['--format', 'json', '--explain-red']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.ok(parsed.red_explanation);
    assert.equal(parsed.red_explanation.signal, 'RED');
    assert.ok(Array.isArray(parsed.red_explanation.blockers));
    assert.ok(
        Array.isArray(parsed.red_explanation.domain_regression_green_to_red)
    );
    assert.equal(
        parsed.red_explanation.domain_regression_green_to_red.length >= 1,
        true
    );

    result = runSummary(dir, ['--format', 'markdown', '--explain-red']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /### Explain RED/);
    assert.match(result.stdout, /Signal:\s+`RED`/);
    assert.match(result.stdout, /Regresiones GREEN->RED:/);
});

test('agent-governance-summary lee governance-policy.json para umbral de semaforo', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    writeFileSync(
        join(dir, 'governance-policy.json'),
        `${JSON.stringify(
            {
                version: 1,
                summary: {
                    thresholds: {
                        domain_score_priority_yellow_below: 101,
                    },
                },
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const result = runSummary(dir, ['--format', 'json']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);

    assert.equal(parsed.overall.signal, 'YELLOW');
    assert.ok(
        parsed.overall.domain_reasons.some((reason) =>
            String(reason).startsWith('domain_score_priority:')
        )
    );
});

test('agent-governance-summary soporta --profile ci y persiste metrics runtime', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFiles(dir);

    const result = runSummary(dir, ['--format', 'json', '--profile', 'ci']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const parsed = JSON.parse(result.stdout);

    assert.match(
        parsed.commands.metrics.command,
        /metrics --json --profile ci/
    );
    assert.equal(parsed.metrics?.io?.profile, 'ci');
    assert.equal(parsed.metrics?.io?.persisted, true);
    assert.equal(
        existsSync(join(dir, 'verification', 'agent-metrics.json')),
        true
    );
});

test('agent-governance-summary soporta --strict y --fail-on-red con politicas distintas', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            { domain: 'calendar', signal: 'GREEN' },
                            { domain: 'chat', signal: 'GREEN' },
                            { domain: 'payments', signal: 'GREEN' },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    let result = runSummary(dir, ['--format', 'json', '--strict']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.equal(parsed.overall.ok, true);
    assert.equal(parsed.overall.signal, 'RED');

    result = runSummary(dir, ['--format', 'json', '--fail-on-red']);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    parsed = JSON.parse(result.stdout);
    assert.equal(parsed.overall.signal, 'RED');
});

test('agent-governance-summary soporta --from-json y --policy-check', (t) => {
    const dir = createFixtureDir();
    t.after(() => cleanupFixtureDir(dir));
    writeFixtureFilesWithChatFailure(dir);

    const verificationDir = join(dir, 'verification');
    require('fs').mkdirSync(verificationDir, { recursive: true });
    writeFileSync(
        join(verificationDir, 'agent-domain-health-history.json'),
        `${JSON.stringify(
            {
                version: 1,
                updated_at: '2026-02-23T10:00:00Z',
                snapshots: [
                    {
                        date: '2026-02-23',
                        captured_at: '2026-02-23T10:00:00Z',
                        counts_by_signal: { GREEN: 3, YELLOW: 0, RED: 0 },
                        domains: [
                            { domain: 'calendar', signal: 'GREEN' },
                            { domain: 'chat', signal: 'GREEN' },
                            { domain: 'payments', signal: 'GREEN' },
                        ],
                    },
                ],
            },
            null,
            2
        )}\n`,
        'utf8'
    );

    const outJson = 'verification/agent-governance-summary.json';
    const build = runSummary(dir, [
        '--format',
        'json',
        '--write-json',
        outJson,
    ]);
    assert.equal(build.status, 0, build.stderr || build.stdout);

    let result = runSummary(dir, [
        '--from-json',
        outJson,
        '--format',
        'json',
        '--policy-check',
        'strict',
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    let parsed = JSON.parse(result.stdout);
    assert.ok(parsed.policies);
    assert.equal(parsed.policies.strict.pass, true);

    result = runSummary(dir, [
        '--from-json',
        outJson,
        '--format',
        'json',
        '--policy-check',
        'fail_on_red',
    ]);
    assert.equal(result.status, 1, result.stderr || result.stdout);
    parsed = JSON.parse(result.stdout);
    assert.equal(parsed.policies.fail_on_red.pass, false);
});
