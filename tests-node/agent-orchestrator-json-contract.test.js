#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    writeFileSync,
    readFileSync,
    existsSync,
    copyFileSync,
    cpSync,
    rmSync,
} = require('fs');
const { tmpdir } = require('os');
const { join, resolve } = require('path');
const { spawn, spawnSync } = require('child_process');
const http = require('http');

const REPO_ROOT = resolve(__dirname, '..');
const ORCHESTRATOR_SOURCE = join(REPO_ROOT, 'agent-orchestrator.js');
const ORCHESTRATOR_TOOLS_DIR = join(REPO_ROOT, 'tools', 'agent-orchestrator');
const GOVERNANCE_POLICY_SOURCE = join(REPO_ROOT, 'governance-policy.json');
const OPENCLAW_RUNTIME_HELPER_SOURCE = join(
    REPO_ROOT,
    'bin',
    'openclaw-runtime-helper.js'
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
const CLEAN_LOCAL_ARTIFACTS_SOURCE = join(
    REPO_ROOT,
    'bin',
    'clean-local-artifacts.js'
);
const LEADOPS_HELPER_SOURCE = join(
    REPO_ROOT,
    'bin',
    'lib',
    'lead-ai-worker.js'
);
const DATE = '2026-02-25';
const CODEX_MODEL_ROUTING_FIELDS = `
    model_tier_default: "gpt-5.4-mini"
    premium_budget: 0
    premium_calls_used: 0
    premium_gate_state: "closed"
    decision_packet_ref: ""
    model_policy_version: "2026-03-17-codex-model-routing-v2"`;

function createFixtureDir() {
    const dir = mkdtempSync(
        join(tmpdir(), 'agent-orchestrator-json-contract-')
    );
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

function installRuntimeHelperFixture(dir) {
    mkdirSync(join(dir, 'bin', 'lib'), { recursive: true });
    copyFileSync(
        OPENCLAW_RUNTIME_HELPER_SOURCE,
        join(dir, 'bin', 'openclaw-runtime-helper.js')
    );
    copyFileSync(
        LEADOPS_HELPER_SOURCE,
        join(dir, 'bin', 'lib', 'lead-ai-worker.js')
    );
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
    executor: codex
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
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
codex_instance: codex_backend_ops
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
}

function runJson(dir, args) {
    return runJsonExpectStatus(dir, args, 0);
}

function runJsonExpectStatus(dir, args, expectedStatus) {
    return runJsonExpectStatusWithOptions(dir, args, expectedStatus);
}

function runJsonExpectStatusWithOptions(
    dir,
    args,
    expectedStatus,
    options = {}
) {
    const finalArgs = withExpectedRevisionArgIfNeeded(dir, args);
    const result = spawnSync(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...finalArgs, '--json'],
        {
            cwd: dir,
            encoding: 'utf8',
            env: options.env ? { ...process.env, ...options.env } : undefined,
        }
    );

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${finalArgs.join(' ')} --json (expected ${expectedStatus})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    let parsed;
    assert.doesNotThrow(() => {
        parsed = JSON.parse(String(result.stdout || ''));
    });
    return parsed;
}

async function runJsonExpectStatusWithOptionsAsync(
    dir,
    args,
    expectedStatus,
    options = {}
) {
    const finalArgs = withExpectedRevisionArgIfNeeded(dir, args);
    const child = spawn(
        process.execPath,
        [join(dir, 'agent-orchestrator.js'), ...finalArgs, '--json'],
        {
            cwd: dir,
            env: options.env ? { ...process.env, ...options.env } : process.env,
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

    const result = await new Promise((resolvePromise, rejectPromise) => {
        child.on('error', rejectPromise);
        child.on('close', (status, signal) => {
            resolvePromise({ status, signal, stdout, stderr });
        });
    });

    assert.equal(
        result.status,
        expectedStatus,
        `Unexpected exit for ${finalArgs.join(' ')} --json (expected ${expectedStatus})\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );

    let parsed;
    assert.doesNotThrow(() => {
        parsed = JSON.parse(String(result.stdout || ''));
    });
    return parsed;
}

function readBoardRevisionFromFixture(dir) {
    const boardPath = join(dir, 'AGENT_BOARD.yaml');
    if (!existsSync(boardPath)) return 0;
    const raw = readFileSync(boardPath, 'utf8');
    const match = raw.match(/^\s*revision:\s*(\d+)\s*$/m);
    if (!match) return 0;
    const parsed = Number(match[1]);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function isMutatingCommandArgs(args = []) {
    const command = String(args[0] || '')
        .trim()
        .toLowerCase();
    const subcommand = String(args[1] || '')
        .trim()
        .toLowerCase();

    if (command === 'close') return true;
    if (command === 'codex') {
        if (['start', 'stop'].includes(subcommand)) return true;
        return (
            subcommand === 'premium' &&
            String(args[2] || '')
                .trim()
                .toLowerCase() === 'record'
        );
    }
    if (command === 'leases') {
        return ['heartbeat', 'clear'].includes(subcommand);
    }
    if (command === 'handoffs') {
        return ['create', 'close'].includes(subcommand);
    }
    if (command === 'strategy') {
        return [
            'set-active',
            'set-next',
            'activate-next',
            'close',
            'intake',
        ].includes(subcommand);
    }
    if (command === 'task') {
        if (['claim', 'start', 'finish'].includes(subcommand)) return true;
        if (subcommand !== 'create') return false;
        if (args.includes('--preview') || args.includes('--dry-run')) {
            return false;
        }
        if (args.includes('--validate-only')) return false;
        return true;
    }
    return false;
}

function withExpectedRevisionArgIfNeeded(dir, args = []) {
    const hasExplicitExpectRev =
        args.includes('--expect-rev') || args.includes('--expect_rev');
    if (hasExplicitExpectRev) return args;
    if (!isMutatingCommandArgs(args)) return args;
    const revision = readBoardRevisionFromFixture(dir);
    return [...args, '--expect-rev', String(revision)];
}

function assertTaskJsonShape(task) {
    assert.equal(typeof task, 'object');
    assert.equal(typeof task.id, 'string');
    assert.equal(typeof task.title, 'string');
    assert.equal(typeof task.owner, 'string');
    assert.equal(typeof task.executor, 'string');
    assert.equal(typeof task.status, 'string');
    assert.equal(typeof task.risk, 'string');
    assert.equal(typeof task.scope, 'string');
    assert.equal(Array.isArray(task.files), true);
}

function assertTaskFullJsonShape(task) {
    assertTaskJsonShape(task);
    assert.equal(typeof task.acceptance, 'string');
    assert.equal(typeof task.acceptance_ref, 'string');
    assert.equal(Array.isArray(task.depends_on), true);
    assert.equal(typeof task.prompt, 'string');
    assert.equal(typeof task.created_at, 'string');
    assert.equal(typeof task.updated_at, 'string');
}

function boardForRuntimeTaskFixture(options = {}) {
    const taskId = String(options.id || 'AG-900');
    const title = String(options.title || 'Runtime OpenClaw fixture');
    const runtimeSurface = String(options.runtimeSurface || 'figo_queue');
    const runtimeTransport = String(options.runtimeTransport || 'http_bridge');
    const files = Array.isArray(options.files)
        ? options.files
        : runtimeSurface === 'leadops_worker'
          ? ['bin/lead-ai-worker.js']
          : runtimeSurface === 'operator_auth'
            ? ['lib/auth.php']
            : ['figo-ai-bridge.php'];
    const prompt = String(
        options.prompt ||
            (runtimeSurface === 'leadops_worker'
                ? 'Genera un borrador para el callback LeadOps'
                : 'Genera una respuesta de runtime')
    );
    const acceptance = String(
        options.acceptance ||
            (runtimeSurface === 'leadops_worker'
                ? 'Responder desde LeadOps'
                : 'Responder desde runtime')
    );
    const status = String(options.status || 'ready');
    const sourceRef = String(options.sourceRef || '');
    const priorityScore = Number(options.priorityScore ?? 70);
    return `
version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  codex_partition_model: tri_lane_runtime
  codex_backend_instance: codex_backend_ops
  codex_frontend_instance: codex_frontend
  codex_transversal_instance: codex_transversal
  revision: 0
  updated_at: ${DATE}
tasks:
  - id: ${taskId}
    title: "${title}"
    owner: ernesto
    executor: codex
    status: ${status}
    status_since_at: "${DATE}"
    risk: medium
    scope: openclaw_runtime
    codex_instance: codex_transversal
    domain_lane: transversal_runtime
    lane_lock: strict
    cross_domain: false
    provider_mode: openclaw_chatgpt
    runtime_surface: ${runtimeSurface}
    runtime_transport: ${runtimeTransport}
    runtime_last_transport: ""
    files: [${files.map((item) => `"${item}"`).join(', ')}]
    source_signal: manual
    source_ref: "${sourceRef}"
    priority_score: ${priorityScore}
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
    runtime_impact: high
    critical_zone: true
    acceptance: "${acceptance}"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "${prompt}"
    created_at: ${DATE}
    updated_at: ${DATE}
`.trim();
}

function writeRuntimeFixtureFiles(dir, options = {}) {
    writeFileSync(
        join(dir, 'AGENT_BOARD.yaml'),
        `${boardForRuntimeTaskFixture(options)}\n`,
        'utf8'
    );
    writeFileSync(
        join(dir, 'AGENT_HANDOFFS.yaml'),
        'version: 1\nhandoffs: []\n',
        'utf8'
    );
    writeFileSync(
        join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
        '# Runtime JSON Fixture\n\nRelacion con Operativo 2026:\n- Fixture.\n',
        'utf8'
    );
}

async function startRuntimeJsonServer(options = {}) {
    const requests = [];
    const sockets = new Set();
    const server = http.createServer((req, res) => {
        const url = new URL(req.url, 'http://127.0.0.1');
        const requestRecord = {
            method: req.method,
            path: url.pathname,
            search: url.search,
        };
        requests.push(requestRecord);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Connection', 'close');
        if (req.method === 'GET' && url.pathname === '/figo-ai-bridge.php') {
            res.statusCode = Number(options.figoGetStatusCode ?? 200);
            res.end(
                JSON.stringify({
                    ok: true,
                    provider: 'openclaw_queue',
                    providerMode: 'openclaw_queue',
                    gatewayConfigured: true,
                    openclawReachable: true,
                    ...(options.figoGetPayload || {}),
                })
            );
            return;
        }
        if (req.method === 'POST' && url.pathname === '/figo-ai-bridge.php') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString('utf8');
            });
            req.on('end', () => {
                const parsed = body ? JSON.parse(body) : {};
                requestRecord.body = body;
                requestRecord.parsed_body = parsed;
                const payload =
                    typeof options.figoPostPayload === 'function'
                        ? options.figoPostPayload({
                              parsed,
                              body,
                              request: requestRecord,
                          })
                        : options.figoPostPayload &&
                            typeof options.figoPostPayload === 'object'
                          ? options.figoPostPayload
                          : {
                                ok: true,
                                mode: 'live',
                                provider: 'openclaw_queue',
                                completion: {
                                    id: 'cmpl-runtime',
                                    object: 'chat.completion',
                                    created: 1,
                                    model: parsed.model || 'openclaw:main',
                                    choices: [
                                        {
                                            index: 0,
                                            message: {
                                                role: 'assistant',
                                                content: 'runtime-ok',
                                            },
                                            finish_reason: 'stop',
                                        },
                                    ],
                                },
                            };
                res.statusCode = Number(options.figoPostStatusCode ?? 200);
                res.end(JSON.stringify(payload));
            });
            return;
        }
        if (req.method === 'POST' && url.pathname === '/openclaw-gateway') {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString('utf8');
            });
            req.on('end', () => {
                const parsed = body ? JSON.parse(body) : {};
                requestRecord.body = body;
                requestRecord.parsed_body = parsed;
                const payload =
                    typeof options.gatewayPayload === 'function'
                        ? options.gatewayPayload({
                              parsed,
                              body,
                              request: requestRecord,
                          })
                        : options.gatewayPayload &&
                            typeof options.gatewayPayload === 'object'
                          ? options.gatewayPayload
                          : {
                                output_text:
                                    '{"summary":"leadops-runtime-ok","draft":"mensaje de prueba"}',
                            };
                res.statusCode = Number(options.gatewayStatusCode ?? 200);
                res.end(JSON.stringify(payload));
            });
            return;
        }
        if (
            req.method === 'GET' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'health'
        ) {
            res.statusCode = Number(options.healthStatusCode ?? 200);
            res.end(
                JSON.stringify({
                    ok: true,
                    leadOpsMode: 'online',
                    leadOpsWorkerDegraded: false,
                    checks: {
                        leadOps: {
                            configured: true,
                            mode: 'online',
                            degraded: false,
                        },
                    },
                    ...(options.healthPayload || {}),
                })
            );
            return;
        }
        if (
            req.method === 'GET' &&
            url.pathname === '/api.php' &&
            url.searchParams.get('resource') === 'operator-auth-status'
        ) {
            res.statusCode = Number(options.operatorStatusCode ?? 200);
            res.end(
                JSON.stringify({
                    ok: true,
                    authenticated: false,
                    status: 'anonymous',
                    mode: 'openclaw_chatgpt',
                    ...(options.operatorPayload || {}),
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

    await new Promise((resolvePromise) =>
        server.listen(0, '127.0.0.1', resolvePromise)
    );
    const address = server.address();
    return {
        baseUrl: `http://127.0.0.1:${address.port}`,
        requests,
        close: () =>
            new Promise((resolvePromise) => {
                server.close(() => resolvePromise());
                if (typeof server.closeAllConnections === 'function') {
                    server.closeAllConnections();
                }
                for (const socket of sockets) {
                    socket.destroy();
                }
            }),
    };
}

function assertVersionLike(value) {
    const t = typeof value;
    assert.equal(t === 'number' || t === 'string', true);
}

test('JSON contract minimo estable para status/conflicts/handoffs/codex-check/leases/board doctor', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const status = runJson(dir, ['status']);
        assertVersionLike(status.version);
        assert.equal(typeof status.totals, 'object');
        assert.equal(typeof status.contribution, 'object');
        assert.equal(typeof status.domain_health, 'object');
        assert.equal(typeof status.conflicts, 'number');
        assert.equal(typeof status.evidence_summary, 'object');
        assert.equal(typeof status.evidence_summary.terminal_tasks, 'number');
        assert.equal(typeof status.model_usage_summary, 'object');
        assert.equal(status.model_usage_summary.codex_tasks_total, 1);
        assert.equal(typeof status.premium_subagent_sessions_total, 'number');
        assert.equal(typeof status.premium_root_exceptions_total, 'number');
        assert.equal(typeof status.premium_by_execution_mode, 'object');
        assert.equal(typeof status.mini_root_compliance_pct, 'number');
        assert.equal(typeof status.premium_budget_remaining, 'object');
        assert.equal(Array.isArray(status.premium_gate_blockers), true);
        assert.equal(Array.isArray(status.diagnostics), true);
        assert.equal(typeof status.warnings_count, 'number');
        assert.equal(typeof status.errors_count, 'number');
        assert.equal(status.warnings_count >= 1, true);

        const conflicts = runJson(dir, ['conflicts', '--strict']);
        assertVersionLike(conflicts.version);
        assert.equal(typeof conflicts.strict, 'boolean');
        assert.equal(typeof conflicts.totals, 'object');
        assert.equal(Array.isArray(conflicts.conflicts), true);
        assert.equal(Array.isArray(conflicts.diagnostics), true);

        const handoffsStatus = runJson(dir, ['handoffs', 'status']);
        assertVersionLike(handoffsStatus.version);
        assert.equal(typeof handoffsStatus.summary, 'object');
        assert.equal(Array.isArray(handoffsStatus.handoffs), true);
        assert.equal(Array.isArray(handoffsStatus.diagnostics), true);

        const handoffsLint = runJson(dir, ['handoffs', 'lint']);
        assert.equal(typeof handoffsLint.ok, 'boolean');
        assert.equal(typeof handoffsLint.error_count, 'number');
        assert.equal(Array.isArray(handoffsLint.errors), true);
        assert.equal(Array.isArray(handoffsLint.diagnostics), true);

        const codexCheck = runJson(dir, ['codex-check']);
        assertVersionLike(codexCheck.version);
        assert.equal(typeof codexCheck.ok, 'boolean');
        assert.equal(typeof codexCheck.error_count, 'number');
        assert.equal(Array.isArray(codexCheck.errors), true);
        assert.equal(typeof codexCheck.summary, 'object');
        assert.equal(Array.isArray(codexCheck.codex_task_ids), true);
        assert.equal(typeof codexCheck.summary.lane_capacity, 'object');
        assert.equal(typeof codexCheck.summary.available_slots, 'object');
        assert.equal(Array.isArray(codexCheck.summary.slot_statuses), true);
        assert.equal(Array.isArray(codexCheck.plan_blocks), true);
        assert.equal(typeof codexCheck.plan_blocks[0].subfront_id, 'string');
        assert.equal(typeof codexCheck.model_usage_summary, 'object');
        assert.equal(typeof codexCheck.premium_budget_remaining, 'object');
        assert.equal(Array.isArray(codexCheck.premium_gate_blockers), true);
        assert.equal(Array.isArray(codexCheck.diagnostics), true);

        const leasesStatus = runJson(dir, ['leases', 'status']);
        assertVersionLike(leasesStatus.version);
        assert.equal(typeof leasesStatus.summary, 'object');
        assert.equal(Array.isArray(leasesStatus.leases), true);
        assert.equal(Array.isArray(leasesStatus.diagnostics), true);
        assert.equal(typeof leasesStatus.warnings_count, 'number');
        assert.equal(typeof leasesStatus.errors_count, 'number');

        const boardDoctor = runJson(dir, ['board', 'doctor']);
        assertVersionLike(boardDoctor.version);
        assert.equal(typeof boardDoctor.command, 'string');
        assert.equal(boardDoctor.command, 'board doctor');
        assert.equal(typeof boardDoctor.summary, 'object');
        assert.equal(typeof boardDoctor.evidence_summary, 'object');
        assert.equal(
            typeof boardDoctor.evidence_summary.terminal_tasks,
            'number'
        );
        assert.equal(Array.isArray(boardDoctor.checks), true);
        assert.equal(Array.isArray(boardDoctor.diagnostics), true);
        assert.equal(typeof boardDoctor.warnings_count, 'number');
        assert.equal(typeof boardDoctor.errors_count, 'number');
        assert.equal(boardDoctor.warnings_count >= 1, true);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de handoffs lint y policy lint', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        writeFileSync(
            join(dir, 'AGENT_HANDOFFS.yaml'),
            `version: 1
handoffs:
  - id: HO-001
    status: active
    from_task: AG-001
    to_task: CDX-001
    reason: fixture_invalid
    files: ["*"]
    approved_by: ernesto
    created_at: 2026-02-25T10:00:00.000Z
    expires_at: 2026-02-25T14:00:00.000Z
`,
            'utf8'
        );

        const handoffsLint = runJsonExpectStatus(dir, ['handoffs', 'lint'], 1);
        assertVersionLike(handoffsLint.version);
        assert.equal(handoffsLint.ok, false);
        assert.equal(typeof handoffsLint.error_count, 'number');
        assert.equal(handoffsLint.error_count > 0, true);
        assert.equal(Array.isArray(handoffsLint.errors), true);
        assert.equal(Array.isArray(handoffsLint.diagnostics), true);
        assert.equal(typeof handoffsLint.warnings_count, 'number');
        assert.equal(typeof handoffsLint.errors_count, 'number');

        writeFileSync(
            join(dir, 'governance-policy.json'),
            JSON.stringify(
                {
                    version: 1,
                    domain_health: {
                        priority_domains: ['calendar'],
                        domain_weights: { default: -1 },
                        signal_scores: { GREEN: 100, YELLOW: 60, RED: 0 },
                    },
                    summary: {
                        thresholds: { domain_score_priority_yellow_below: 80 },
                    },
                },
                null,
                2
            ),
            'utf8'
        );

        const policyLint = runJsonExpectStatus(dir, ['policy', 'lint'], 1);
        assertVersionLike(policyLint.version);
        assert.equal(policyLint.ok, false);
        assert.equal(typeof policyLint.error_count, 'number');
        assert.equal(policyLint.error_count > 0, true);
        assert.equal(Array.isArray(policyLint.errors), true);
        assert.equal(Array.isArray(policyLint.warnings), true);
        assert.equal(Array.isArray(policyLint.diagnostics), true);
        assert.equal(typeof policyLint.source, 'object');
        assert.equal(typeof policyLint.source.path, 'string');
        assert.equal(typeof policyLint.source.exists, 'boolean');
        assert.equal(typeof policyLint.warnings_count, 'number');
        assert.equal(typeof policyLint.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de conflicts --strict y codex-check', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Conflict fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: low
    scope: docs
    files: ["AGENTS.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
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
`,
            'utf8'
        );

        const conflicts = runJsonExpectStatus(
            dir,
            ['conflicts', '--strict'],
            1
        );
        assertVersionLike(conflicts.version);
        assert.equal(conflicts.strict, true);
        assert.equal(typeof conflicts.totals, 'object');
        assert.equal(Array.isArray(conflicts.conflicts), true);
        assert.equal(conflicts.conflicts.length > 0, true);
        assert.equal(Array.isArray(conflicts.diagnostics), true);
        assert.equal(typeof conflicts.warnings_count, 'number');
        assert.equal(typeof conflicts.errors_count, 'number');

        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan Maestro Codex 2026 (Fixture)

<!-- CODEX_ACTIVE
codex_instance: codex_backend_ops
block: C1
task_id: CDX-001
status: review
files: ["AGENTS.md", "agent-orchestrator.js"]
updated_at: ${DATE}
-->

Fixture con drift.
`,
            'utf8'
        );

        const codexCheck = runJsonExpectStatus(dir, ['codex-check'], 1);
        assertVersionLike(codexCheck.version);
        assert.equal(codexCheck.ok, false);
        assert.equal(typeof codexCheck.error_count, 'number');
        assert.equal(codexCheck.error_count > 0, true);
        assert.equal(Array.isArray(codexCheck.errors), true);
        assert.equal(typeof codexCheck.summary, 'object');
        assert.equal(Array.isArray(codexCheck.codex_task_ids), true);
        assert.equal(Array.isArray(codexCheck.diagnostics), true);
        assert.equal(typeof codexCheck.warnings_count, 'number');
        assert.equal(typeof codexCheck.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de intake/dispatch/reconcile', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const intake = runJsonExpectStatus(
            dir,
            ['intake', '--strict', '--no-write', '--repo', 'invalid'],
            1
        );
        assertVersionLike(intake.version);
        assert.equal(intake.command, 'intake');
        assert.equal(intake.ok, false);
        assert.equal(typeof intake.error, 'string');
        assert.equal(intake.error_code, 'invalid_repository');
        assert.equal(intake.repository, 'invalid');

        const dispatch = runJsonExpectStatus(dir, ['dispatch'], 1);
        assertVersionLike(dispatch.version);
        assert.equal(dispatch.command, 'dispatch');
        assert.equal(dispatch.ok, false);
        assert.equal(typeof dispatch.error, 'string');
        assert.equal(dispatch.error_code, 'invalid_agent');

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Done without evidence"
    owner: ernesto
    executor: codex
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals: []
`,
            'utf8'
        );

        const reconcile = runJsonExpectStatus(
            dir,
            ['reconcile', '--strict'],
            1
        );
        assertVersionLike(reconcile.version);
        assert.equal(reconcile.command, 'reconcile');
        assert.equal(reconcile.ok, false);
        assert.equal(typeof reconcile.error, 'string');
        assert.equal(reconcile.error_code, 'done_without_evidence');
        assert.equal(Array.isArray(reconcile.done_without_evidence), true);
        assert.equal(reconcile.done_without_evidence.includes('AG-001'), true);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para errores de stale/budget/score', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Dormant fixture"
    owner: ernesto
    executor: codex
    status: done
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals:
  - id: SIG-001
    fingerprint: "fixture-critical-stale"
    source: manual
    source_ref: "fixture"
    title: "Critical fixture signal"
    severity: high
    critical: true
    status: open
    runtime_impact: high
    url: ""
    detected_at: "${DATE}T00:00:00.000Z"
    updated_at: "${DATE}T00:00:00.000Z"
    labels: ["fixture"]
`,
            'utf8'
        );

        const stale = runJsonExpectStatus(dir, ['stale', '--strict'], 1);
        assertVersionLike(stale.version);
        assert.equal(stale.command, 'stale');
        assert.equal(stale.ok, false);
        assert.equal(typeof stale.counts, 'object');
        assert.equal(Array.isArray(stale.invalid_reasons), true);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Budget fixture"
    owner: ernesto
    executor: codex
    status: in_progress
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    attempts: 3
    last_attempt_at: "${DATE}T10:00:00.000Z"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals: []
`,
            'utf8'
        );

        const budget = runJsonExpectStatusWithOptions(
            dir,
            ['budget', '--strict', '--agent', 'codex'],
            1,
            { env: { CODEX_DAILY_LIMIT: '0' } }
        );
        assertVersionLike(budget.version);
        assert.equal(budget.command, 'budget');
        assert.equal(budget.ok, false);
        assert.equal(Array.isArray(budget.exceeded), true);
        assert.equal(budget.exceeded.includes('codex'), true);
        assert.equal(typeof budget.usage, 'object');
        assert.equal(typeof budget.remaining, 'object');
        assert.equal(budget.remaining.codex, 0);

        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Score invalid fixture"
    owner: ernesto
    executor: codex
    status: invalid_status
    risk: low
    scope: docs
    files: ["README.md"]
    acceptance: "Fixture"
    acceptance_ref: "README.md"
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        const score = runJsonExpectStatus(dir, ['score'], 1);
        assertVersionLike(score.version);
        assert.equal(score.command, 'score');
        assert.equal(score.ok, false);
        assert.equal(typeof score.error, 'string');
        assert.equal(score.error_code, 'score_failed');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para board_revision_mismatch (--expect-rev)', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const taskClaim = runJsonExpectStatus(
            dir,
            ['task', 'claim', 'AG-001', '--owner', 'otro', '--expect-rev', '9'],
            1
        );
        assertVersionLike(taskClaim.version);
        assert.equal(taskClaim.ok, false);
        assert.equal(taskClaim.command, 'task');
        assert.equal(taskClaim.action, 'claim');
        assert.equal(taskClaim.error_code, 'board_revision_mismatch');
        assert.equal(typeof taskClaim.expected_revision, 'number');
        assert.equal(typeof taskClaim.actual_revision, 'number');

        const leasesHeartbeat = runJsonExpectStatus(
            dir,
            [
                'leases',
                'heartbeat',
                'CDX-001',
                '--ttl-hours',
                '1',
                '--expect-rev',
                '9',
            ],
            1
        );
        assertVersionLike(leasesHeartbeat.version);
        assert.equal(leasesHeartbeat.ok, false);
        assert.equal(leasesHeartbeat.command, 'leases');
        assert.equal(leasesHeartbeat.action, 'heartbeat');
        assert.equal(leasesHeartbeat.error_code, 'board_revision_mismatch');
        assert.equal(typeof leasesHeartbeat.expected_revision, 'number');
        assert.equal(typeof leasesHeartbeat.actual_revision, 'number');

        const handoffClose = runJsonExpectStatus(
            dir,
            ['handoffs', 'close', 'HO-999', '--expect-rev', '9'],
            1
        );
        assertVersionLike(handoffClose.version);
        assert.equal(handoffClose.ok, false);
        assert.equal(handoffClose.command, 'handoffs');
        assert.equal(handoffClose.error_code, 'board_revision_mismatch');
        assert.equal(typeof handoffClose.expected_revision, 'number');
        assert.equal(typeof handoffClose.actual_revision, 'number');

        const evidenceDir = join(dir, 'verification', 'agent-runs');
        mkdirSync(evidenceDir, { recursive: true });
        writeFileSync(
            join(evidenceDir, 'AG-001.md'),
            '# AG-001 fixture evidence\n',
            'utf8'
        );
        const closeCmd = runJsonExpectStatus(
            dir,
            [
                'close',
                'AG-001',
                '--evidence',
                'verification/agent-runs/AG-001.md',
                '--expect-rev',
                '9',
            ],
            1
        );
        assertVersionLike(closeCmd.version);
        assert.equal(closeCmd.ok, false);
        assert.equal(closeCmd.command, 'close');
        assert.equal(closeCmd.error_code, 'board_revision_mismatch');
        assert.equal(typeof closeCmd.expected_revision, 'number');
        assert.equal(typeof closeCmd.actual_revision, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para board doctor --strict (falla con payload JSON)', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const boardDoctor = runJsonExpectStatus(
            dir,
            ['board', 'doctor', '--strict'],
            1
        );
        assertVersionLike(boardDoctor.version);
        assert.equal(boardDoctor.command, 'board doctor');
        assert.equal(Array.isArray(boardDoctor.checks), true);
        assert.equal(Array.isArray(boardDoctor.diagnostics), true);
        assert.equal(boardDoctor.diagnostics.length > 0, true);
        assert.equal(typeof boardDoctor.warnings_count, 'number');
        assert.equal(typeof boardDoctor.errors_count, 'number');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para metrics --json', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const metrics = runJson(dir, ['metrics', '--profile', 'local']);
        assertVersionLike(metrics.version);
        assert.equal(typeof metrics.period, 'object');
        assert.equal(typeof metrics.targets, 'object');
        assert.equal(typeof metrics.baseline, 'object');
        assert.equal(typeof metrics.current, 'object');
        assert.equal(typeof metrics.delta, 'object');
        assert.equal(typeof metrics.contribution, 'object');
        assert.equal(typeof metrics.baseline_contribution, 'object');
        assert.equal(typeof metrics.contribution_delta, 'object');
        assert.equal(typeof metrics.domain_health, 'object');
        assert.equal(typeof metrics.domain_health_history, 'object');
        assert.equal(typeof metrics.model_usage_summary, 'object');
        assert.equal(metrics.model_usage_summary.codex_tasks_total, 1);
        assert.equal(typeof metrics.premium_subagent_sessions_total, 'number');
        assert.equal(typeof metrics.premium_root_exceptions_total, 'number');
        assert.equal(typeof metrics.premium_by_execution_mode, 'object');
        assert.equal(typeof metrics.mini_root_compliance_pct, 'number');
        assert.equal(typeof metrics.premium_budget_remaining, 'object');
        assert.equal(Array.isArray(metrics.premium_gate_blockers), true);
        assert.equal(typeof metrics.premium_roi, 'object');
        assert.equal(typeof metrics.io, 'object');
        assert.equal(typeof metrics.io.profile, 'string');
        assert.equal(typeof metrics.io.write_mode, 'string');
        assert.equal(typeof metrics.io.persisted, 'boolean');
        assert.equal(Array.isArray(metrics.io.output_files), true);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract status/metrics exponen runtime transversal por instancia provider y surface', () => {
    const dir = createFixtureDir();
    try {
        writeRuntimeFixtureFiles(dir, {
            id: 'AG-903',
            title: 'Runtime status metrics fixture',
            runtimeSurface: 'leadops_worker',
            runtimeTransport: 'hybrid_http_cli',
            files: ['bin/lead-ai-worker.js'],
            prompt: 'Genera un borrador LeadOps transversal',
            acceptance: 'Runtime transversal visible en status y metrics',
            priorityScore: 90,
        });

        const status = runJson(dir, ['status']);
        assertVersionLike(status.version);
        assert.equal(typeof status.codex_instances, 'object');
        assert.equal(typeof status.provider_modes, 'object');
        assert.equal(typeof status.runtime_surfaces, 'object');
        assert.equal(Array.isArray(status.codex_instances.rows), true);
        assert.equal(Array.isArray(status.provider_modes.rows), true);
        assert.equal(Array.isArray(status.runtime_surfaces.rows), true);
        assert.equal(
            status.codex_instances.rows.some(
                (row) =>
                    row.codex_instance === 'codex_transversal' &&
                    row.tasks === 1 &&
                    row.active_tasks === 1
            ),
            true
        );
        assert.equal(
            status.provider_modes.rows.some(
                (row) =>
                    row.provider_mode === 'openclaw_chatgpt' &&
                    row.tasks === 1 &&
                    row.active_tasks === 1
            ),
            true
        );
        assert.equal(
            status.runtime_surfaces.rows.some(
                (row) =>
                    row.runtime_surface === 'leadops_worker' &&
                    row.tasks === 1 &&
                    row.active_tasks === 1
            ),
            true
        );

        const metrics = runJson(dir, ['metrics', '--profile', 'local']);
        assertVersionLike(metrics.version);
        assert.equal(typeof metrics.codex_instances, 'object');
        assert.equal(typeof metrics.provider_modes, 'object');
        assert.equal(typeof metrics.runtime_surfaces, 'object');
        assert.equal(Array.isArray(metrics.codex_instances.rows), true);
        assert.equal(Array.isArray(metrics.provider_modes.rows), true);
        assert.equal(Array.isArray(metrics.runtime_surfaces.rows), true);
        assert.equal(
            metrics.codex_instances.rows.some(
                (row) =>
                    row.codex_instance === 'codex_transversal' &&
                    row.tasks === 1 &&
                    row.active_tasks === 1
            ),
            true
        );
        assert.equal(
            metrics.provider_modes.rows.some(
                (row) =>
                    row.provider_mode === 'openclaw_chatgpt' &&
                    row.tasks === 1 &&
                    row.active_tasks === 1
            ),
            true
        );
        assert.equal(
            metrics.runtime_surfaces.rows.some(
                (row) =>
                    row.runtime_surface === 'leadops_worker' &&
                    row.tasks === 1 &&
                    row.active_tasks === 1
            ),
            true
        );
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract codex premium record devuelve ledger entry y model usage summary', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            readFileSync(join(dir, 'AGENT_BOARD.yaml'), 'utf8').replace(
                '    risk: medium',
                '    risk: high'
            ),
            'utf8'
        );
        mkdirSync(join(dir, 'verification', 'codex-decisions'), {
            recursive: true,
        });
        writeFileSync(
            join(dir, 'verification', 'codex-decisions', 'CDX-001-1.md'),
            [
                'task_id: CDX-001',
                'execution_mode: subagent',
                'premium_reason: critical_review',
                'problem: validar cambio critico',
                'why_mini_or_local_failed: mini no destrabo el review',
                'exact_decision_requested: confirmar merge',
                'acceptable_output: decision estructurada',
                'risk_if_wrong: retrabajo',
                'action_taken: abrir subagente premium',
            ].join('\n') + '\n',
            'utf8'
        );

        const json = runJson(dir, [
            'codex',
            'premium',
            'record',
            'CDX-001',
            '--decision-packet-ref',
            'verification/codex-decisions/CDX-001-1.md',
            '--reason',
            'critical_review',
            '--execution-mode',
            'subagent',
            '--premium-session-id',
            'sess-json-001',
        ]);

        assertVersionLike(json.version);
        assert.equal(json.ok, true);
        assert.equal(json.command, 'codex');
        assert.equal(json.action, 'premium');
        assert.equal(json.subaction, 'record');
        assert.equal(typeof json.ledger_entry, 'object');
        assert.equal(json.ledger_entry.execution_mode, 'subagent');
        assert.equal(json.ledger_entry.budget_unit, 'premium_session');
        assert.equal(typeof json.model_usage_summary, 'object');
        assert.equal(json.model_usage_summary.premium_calls_used, 1);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract intake crea task runtime transversal desde signal local OpenClaw', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals:
  - id: SIG-001
    fingerprint: "manual:bin/lead-ai-worker.js"
    source: manual
    source_ref: "bin/lead-ai-worker.js"
    title: "Worker callback degraded"
    severity: medium
    critical: false
    status: open
    runtime_impact: high
    url: ""
    detected_at: "${DATE}T00:00:00.000Z"
    updated_at: "${DATE}T00:00:00.000Z"
    labels: ["openclaw", "runtime"]
`,
            'utf8'
        );

        const intake = runJsonExpectStatusWithOptions(dir, ['intake'], 0, {
            env: {
                PATH: '',
                GITHUB_TOKEN: '',
                GH_TOKEN: '',
            },
        });
        assertVersionLike(intake.version);
        assert.equal(intake.command, 'intake');
        assert.equal(intake.ok, true);
        assert.equal(intake.source, 'local_only');
        assert.equal(intake.intake.created_tasks, 1);
        assert.equal(intake.intake.reopened_tasks, 0);
        assert.equal(intake.intake.refreshed_tasks, 0);

        const listed = runJson(dir, [
            'task',
            'ls',
            '--scope',
            'openclaw_runtime',
        ]);
        assertVersionLike(listed.version);
        assert.equal(Array.isArray(listed.tasks), true);
        assert.equal(listed.tasks.length, 1);
        assertTaskJsonShape(listed.tasks[0]);
        assert.equal(listed.tasks[0].id, 'AG-002');
        assert.equal(listed.tasks[0].scope, 'openclaw_runtime');
        assert.equal(listed.tasks[0].codex_instance, 'codex_transversal');
        assert.equal(listed.tasks[0].domain_lane, 'transversal_runtime');
        assert.equal(listed.tasks[0].provider_mode, 'openclaw_chatgpt');
        assert.equal(listed.tasks[0].runtime_surface, 'leadops_worker');
        assert.equal(listed.tasks[0].runtime_transport, 'hybrid_http_cli');
        assert.deepEqual(listed.tasks[0].files, [
            'bin/lead-ai-worker.js',
            'bin/lib/lead-ai-worker.js',
            'controllers/LeadAiController.php',
            'lib/LeadOpsService.php',
        ]);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract intake refresca tarea existente y repara lane runtime OpenClaw', () => {
    const dir = createFixtureDir();
    try {
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Operator auth stale generic task"
    owner: ernesto
    executor: codex
    status: ready
    risk: low
    scope: general
    files: ["README.md"]
    codex_instance: codex_backend_ops
    domain_lane: backend_ops
    lane_lock: strict
    cross_domain: false
    source_signal: manual
    source_ref: "lib/auth.php"
    priority_score: 10
    sla_due_at: "${DATE}T12:00:00.000Z"
    last_attempt_at: ""
    attempts: 0
    blocked_reason: ""
    runtime_impact: low
    critical_zone: false
    acceptance: "Fixture"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_HANDOFFS.yaml'),
            `version: 1
handoffs: []
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan Maestro Codex 2026 (Fixture)

Relacion con Operativo 2026:
- Fixture.
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_SIGNALS.yaml'),
            `version: 1
updated_at: ${DATE}
signals:
  - id: SIG-001
    fingerprint: "manual:lib/auth.php"
    source: manual
    source_ref: "lib/auth.php"
    title: "Operator auth OpenClaw degraded"
    severity: high
    critical: false
    status: open
    runtime_impact: high
    url: ""
    detected_at: "${DATE}T00:00:00.000Z"
    updated_at: "${DATE}T00:00:00.000Z"
    labels: ["operator-auth", "openclaw"]
`,
            'utf8'
        );

        const intake = runJsonExpectStatusWithOptions(dir, ['intake'], 0, {
            env: {
                PATH: '',
                GITHUB_TOKEN: '',
                GH_TOKEN: '',
            },
        });
        assertVersionLike(intake.version);
        assert.equal(intake.command, 'intake');
        assert.equal(intake.ok, true);
        assert.equal(intake.intake.created_tasks, 0);
        assert.equal(intake.intake.reopened_tasks, 0);
        assert.equal(intake.intake.refreshed_tasks, 1);

        const listed = runJson(dir, ['task', 'ls', '--id', 'AG-001']);
        assertVersionLike(listed.version);
        assert.equal(Array.isArray(listed.tasks), true);
        assert.equal(listed.tasks.length, 1);
        assertTaskJsonShape(listed.tasks[0]);
        assert.equal(listed.tasks[0].scope, 'openclaw_runtime');
        assert.equal(listed.tasks[0].codex_instance, 'codex_transversal');
        assert.equal(listed.tasks[0].domain_lane, 'transversal_runtime');
        assert.equal(listed.tasks[0].lane_lock, 'strict');
        assert.equal(listed.tasks[0].cross_domain, false);
        assert.equal(listed.tasks[0].provider_mode, 'openclaw_chatgpt');
        assert.equal(listed.tasks[0].runtime_surface, 'operator_auth');
        assert.equal(listed.tasks[0].runtime_transport, 'hybrid_http_cli');
        assert.deepEqual(listed.tasks[0].files, [
            'lib/auth.php',
            'controllers/OperatorAuthController.php',
        ]);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract dispatch expone dispatched_tasks y prioriza runtime transversal empatado', async () => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeJsonServer();
    try {
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Docs task"
    owner: ernesto
    executor: codex
    status: ready
    risk: medium
    scope: docs
    files: ["docs/a.md"]
    priority_score: 60
    sla_due_at: "${DATE}T12:00:00.000Z"
    acceptance: "Fixture"
    acceptance_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
  - id: AG-002
    title: "LeadOps runtime"
    owner: ernesto
    executor: codex
    status: ready
    risk: medium
    scope: openclaw_runtime
    codex_instance: codex_transversal
    domain_lane: transversal_runtime
    lane_lock: strict
    cross_domain: false
    provider_mode: openclaw_chatgpt
    runtime_surface: leadops_worker
    runtime_transport: hybrid_http_cli
    runtime_last_transport: ""
    files: ["bin/lead-ai-worker.js"]
    priority_score: 60
    sla_due_at: "${DATE}T12:00:00.000Z"
    last_attempt_at: ""
    attempts: 0
    blocked_reason: ""
    runtime_impact: high
    critical_zone: true
    acceptance: "Fixture"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_HANDOFFS.yaml'),
            `version: 1
handoffs: []
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan Maestro Codex 2026 (Fixture)

Relacion con Operativo 2026:
- Fixture.
`,
            'utf8'
        );

        const dispatch = await runJsonExpectStatusWithOptionsAsync(
            dir,
            ['dispatch', '--agent', 'codex'],
            0,
            {
                env: {
                    CODEX_DAILY_LIMIT: '1',
                    OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
                },
            }
        );
        assertVersionLike(dispatch.version);
        assert.equal(dispatch.command, 'dispatch');
        assert.equal(dispatch.ok, true);
        assert.equal(dispatch.agent, 'codex');
        assert.deepEqual(dispatch.dispatched, ['AG-002']);
        assert.equal(Array.isArray(dispatch.dispatched_tasks), true);
        assert.equal(dispatch.dispatched_tasks.length, 1);
        assertTaskJsonShape(dispatch.dispatched_tasks[0]);
        assert.equal(dispatch.dispatched_tasks[0].id, 'AG-002');
        assert.equal(dispatch.dispatched_tasks[0].scope, 'openclaw_runtime');
        assert.equal(
            dispatch.dispatched_tasks[0].domain_lane,
            'transversal_runtime'
        );
        assert.equal(
            dispatch.dispatched_tasks[0].provider_mode,
            'openclaw_chatgpt'
        );
        assert.equal(
            dispatch.dispatched_tasks[0].runtime_surface,
            'leadops_worker'
        );
        assert.equal(
            dispatch.dispatched_tasks[0].runtime_transport,
            'hybrid_http_cli'
        );
    } finally {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    }
});

test('JSON contract dispatch omite runtime_surface degradada y reporta skipped_unhealthy_tasks', async () => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeJsonServer({
        healthPayload: {
            leadOpsMode: 'online',
            leadOpsWorkerDegraded: true,
            checks: {
                leadOps: {
                    configured: true,
                    mode: 'online',
                    degraded: true,
                },
            },
        },
    });
    try {
        writeFileSync(
            join(dir, 'AGENT_BOARD.yaml'),
            `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  updated_at: ${DATE}
tasks:
  - id: AG-001
    title: "Docs task"
    owner: ernesto
    executor: codex
    status: ready
    risk: medium
    scope: docs
    files: ["docs/a.md"]
    priority_score: 60
    sla_due_at: "${DATE}T12:00:00.000Z"
    acceptance: "Fixture"
    acceptance_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
  - id: AG-002
    title: "LeadOps runtime"
    owner: ernesto
    executor: codex
    status: ready
    risk: medium
    scope: openclaw_runtime
    codex_instance: codex_transversal
    domain_lane: transversal_runtime
    lane_lock: strict
    cross_domain: false
    provider_mode: openclaw_chatgpt
    runtime_surface: leadops_worker
    runtime_transport: hybrid_http_cli
    runtime_last_transport: ""
    files: ["bin/lead-ai-worker.js"]
    priority_score: 60
    sla_due_at: "${DATE}T12:00:00.000Z"
    last_attempt_at: ""
    attempts: 0
    blocked_reason: ""
    runtime_impact: high
    critical_zone: true
    acceptance: "Fixture"
    acceptance_ref: ""
    evidence_ref: ""
    depends_on: []
    prompt: "Fixture"
    created_at: ${DATE}
    updated_at: ${DATE}
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'AGENT_HANDOFFS.yaml'),
            `version: 1
handoffs: []
`,
            'utf8'
        );
        writeFileSync(
            join(dir, 'PLAN_MAESTRO_CODEX_2026.md'),
            `# Plan Maestro Codex 2026 (Fixture)

Relacion con Operativo 2026:
- Fixture.
`,
            'utf8'
        );

        const dispatch = await runJsonExpectStatusWithOptionsAsync(
            dir,
            ['dispatch', '--agent', 'codex'],
            0,
            {
                env: {
                    CODEX_DAILY_LIMIT: '1',
                    OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
                },
            }
        );
        assertVersionLike(dispatch.version);
        assert.equal(dispatch.command, 'dispatch');
        assert.equal(dispatch.ok, true);
        assert.deepEqual(dispatch.dispatched, ['AG-001']);
        assert.equal(Array.isArray(dispatch.skipped_unhealthy_tasks), true);
        assert.equal(dispatch.skipped_unhealthy_tasks.length, 1);
        assert.equal(dispatch.skipped_unhealthy_tasks[0].id, 'AG-002');
        assert.equal(
            dispatch.skipped_unhealthy_tasks[0].skip_reason,
            'runtime_surface_unhealthy'
        );
        assert.equal(
            dispatch.skipped_unhealthy_tasks[0].runtime_surface,
            'leadops_worker'
        );
        assert.equal(Array.isArray(dispatch.diagnostics), true);
        assert.equal(
            dispatch.diagnostics.some(
                (diag) =>
                    diag.code === 'warn.dispatch.runtime_surface_unhealthy'
            ),
            true
        );
    } finally {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para metrics baseline show/set/reset', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const seeded = runJson(dir, ['metrics', '--profile', 'ci']);
        assertVersionLike(seeded.version);

        const show = runJson(dir, ['metrics', 'baseline', 'show']);
        assertVersionLike(show.version);
        assert.equal(show.ok, true);
        assert.equal(show.action, 'show');
        assert.equal(typeof show.metrics_path, 'string');
        assert.equal(typeof show.baseline, 'object');
        assert.equal(typeof show.baseline_contribution, 'object');

        const set = runJson(dir, [
            'metrics',
            'baseline',
            'set',
            '--from',
            'current',
        ]);
        assertVersionLike(set.version);
        assert.equal(set.ok, true);
        assert.equal(set.action, 'set');
        assert.equal(set.source, 'current');
        assert.equal(typeof set.baseline, 'object');
        assert.equal(typeof set.baseline_meta, 'object');
        assert.equal(typeof set.delta, 'object');

        const reset = runJson(dir, [
            'metrics',
            'baseline',
            'reset',
            '--from',
            'current',
        ]);
        assertVersionLike(reset.version);
        assert.equal(reset.ok, true);
        assert.equal(reset.action, 'reset');
        assert.equal(reset.source, 'current');
        assert.equal(typeof reset.baseline, 'object');
        assert.equal(typeof reset.baseline_meta, 'object');
        assert.equal(typeof reset.delta, 'object');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('board doctor no emite metrics_baseline_missing cuando existe baseline explicito', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const seeded = runJson(dir, ['metrics', '--profile', 'ci']);
        assertVersionLike(seeded.version);

        const baselineSet = runJson(dir, [
            'metrics',
            'baseline',
            'set',
            '--from',
            'current',
        ]);
        assertVersionLike(baselineSet.version);
        assert.equal(baselineSet.ok, true);

        const boardDoctor = runJson(dir, ['board', 'doctor']);
        assertVersionLike(boardDoctor.version);
        assert.equal(
            boardDoctor.diagnostics.some(
                (diag) => diag.code === 'warn.metrics.baseline_missing'
            ),
            false
        );
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para task ls/create/claim/start/finish', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const listBefore = runJson(dir, ['task', 'ls']);
        assertVersionLike(listBefore.version);
        assert.equal(typeof listBefore.command, 'string');
        assert.equal(typeof listBefore.action, 'string');
        assert.equal(typeof listBefore.summary, 'object');
        assert.equal(Array.isArray(listBefore.tasks), true);

        const created = runJson(dir, [
            'task',
            'create',
            '--title',
            'Task contrato JSON',
            '--executor',
            'codex',
            '--files',
            'docs/contract-json.md',
            '--scope',
            'docs',
            '--risk',
            'low',
            '--status',
            'backlog',
        ]);
        assertVersionLike(created.version);
        assert.equal(created.action, 'create');
        assert.equal(typeof created.persisted, 'boolean');
        assert.equal(created.persisted, true);
        assertTaskJsonShape(created.task);
        assertTaskFullJsonShape(created.task_full);
        const taskId = created.task.id;
        assert.match(taskId, /^AG-\d+$/);

        const claimed = runJson(dir, [
            'task',
            'claim',
            taskId,
            '--owner',
            'ernesto',
        ]);
        assertVersionLike(claimed.version);
        assert.equal(claimed.action, 'claim');
        assertTaskJsonShape(claimed.task);
        assert.equal(claimed.task.id, taskId);

        const started = runJson(dir, [
            'task',
            'start',
            taskId,
            '--status',
            'in_progress',
        ]);
        assertVersionLike(started.version);
        assert.equal(started.action, 'start');
        assertTaskJsonShape(started.task);
        assert.equal(started.task.id, taskId);

        const evidenceDir = join(dir, 'verification', 'agent-runs');
        mkdirSync(evidenceDir, { recursive: true });
        const evidenceRel = `verification/agent-runs/${taskId}.md`;
        writeFileSync(join(dir, evidenceRel), `# ${taskId}\n`, 'utf8');

        const finished = runJson(dir, [
            'task',
            'finish',
            taskId,
            '--evidence',
            evidenceRel,
        ]);
        assertVersionLike(finished.version);
        assert.equal(finished.action, 'finish');
        assertTaskJsonShape(finished.task);
        assert.equal(typeof finished.evidence_path, 'string');
        assert.match(finished.evidence_path, new RegExp(`${taskId}\\.md$`));

        const listAfter = runJson(dir, ['task', 'ls', '--id', taskId]);
        assertVersionLike(listAfter.version);
        assert.equal(Array.isArray(listAfter.tasks), true);
        assert.equal(listAfter.tasks.length, 1);
        assertTaskJsonShape(listAfter.tasks[0]);
        assert.equal(listAfter.tasks[0].id, taskId);
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract task create con template runtime expone defaults OpenClaw transversales', () => {
    const dir = createFixtureDir();
    try {
        writeFixtureFiles(dir);

        const created = runJson(dir, [
            'task',
            'create',
            '--title',
            'Task runtime contrato JSON',
            '--template',
            'runtime',
            '--files',
            'bin/lead-ai-worker.js',
        ]);
        assertVersionLike(created.version);
        assert.equal(created.action, 'create');
        assert.equal(created.persisted, true);
        assertTaskJsonShape(created.task);
        assertTaskFullJsonShape(created.task_full);
        assert.match(created.task.id, /^AG-\d+$/);
        assert.equal(created.task_full.scope, 'openclaw_runtime');
        assert.equal(created.task_full.domain_lane, 'transversal_runtime');
        assert.equal(created.task_full.codex_instance, 'codex_transversal');
        assert.equal(created.task_full.provider_mode, 'openclaw_chatgpt');
        assert.equal(created.task_full.runtime_surface, 'leadops_worker');
        assert.equal(created.task_full.runtime_transport, 'hybrid_http_cli');
    } finally {
        cleanupFixtureDir(dir);
    }
});

test('JSON contract minimo estable para runtime verify/invoke', async () => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeJsonServer();

    try {
        writeRuntimeFixtureFiles(dir, {
            id: 'AG-900',
            title: 'Operator auth runtime',
            runtimeSurface: 'operator_auth',
            runtimeTransport: 'http_bridge',
            files: ['lib/auth.php'],
            prompt: 'Verifica operator auth',
            acceptance: 'Verificar operator auth',
            priorityScore: 50,
        });

        const verifyPayload = await runJsonExpectStatusWithOptionsAsync(
            dir,
            ['runtime', 'verify', 'openclaw_chatgpt'],
            0,
            {
                env: {
                    OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
                },
            }
        );
        assertVersionLike(verifyPayload.version);
        assert.equal(verifyPayload.command, 'runtime verify');
        assert.equal(verifyPayload.provider, 'openclaw_chatgpt');
        assert.equal(Array.isArray(verifyPayload.runtime.surfaces), true);
        assert.equal(verifyPayload.runtime.provider, 'openclaw_chatgpt');

        const invokePayload = await runJsonExpectStatusWithOptionsAsync(
            dir,
            ['runtime', 'invoke', 'AG-900', '--expect-rev', '0'],
            1,
            {
                env: {
                    OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
                },
            }
        );
        assertVersionLike(invokePayload.version);
        assert.equal(invokePayload.command, 'runtime invoke');
        assert.equal(invokePayload.ok, false);
        assert.equal(invokePayload.result.provider, 'openclaw_chatgpt');
        assert.equal(
            invokePayload.result.errorCode,
            'invoke_unsupported_surface'
        );
        assertTaskJsonShape(invokePayload.task);
    } finally {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    }
});

test('JSON contract runtime invoke preserva modo queued y provider upstream normalizado', async () => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeJsonServer({
        figoPostPayload: {
            ok: true,
            mode: 'queued',
            provider: 'openclaw_queue',
            jobId: 'job-runtime-queued',
            pollUrl: 'http://127.0.0.1/runtime/jobs/job-runtime-queued',
            pollAfterMs: 1500,
        },
    });

    try {
        writeRuntimeFixtureFiles(dir, {
            id: 'AG-901',
            title: 'Figo queue runtime',
            runtimeSurface: 'figo_queue',
            runtimeTransport: 'http_bridge',
            files: ['lib/figo_queue.php'],
            prompt: 'Despacha una respuesta via figo queue',
            acceptance: 'Encender figo queue',
            priorityScore: 80,
        });

        const invokePayload = await runJsonExpectStatusWithOptionsAsync(
            dir,
            ['runtime', 'invoke', 'AG-901', '--expect-rev', '0'],
            0,
            {
                env: {
                    OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
                },
            }
        );
        assertVersionLike(invokePayload.version);
        assert.equal(invokePayload.command, 'runtime invoke');
        assert.equal(invokePayload.ok, true);
        assert.equal(invokePayload.result.mode, 'queued');
        assert.equal(invokePayload.result.provider, 'openclaw_chatgpt');
        assert.equal(invokePayload.result.upstream_provider, 'openclaw_queue');
        assert.equal(invokePayload.result.runtime_surface, 'figo_queue');
        assert.equal(invokePayload.result.runtime_transport, 'http_bridge');
        assert.equal(invokePayload.result.jobId, 'job-runtime-queued');
        assert.equal(
            invokePayload.result.pollUrl,
            'http://127.0.0.1/runtime/jobs/job-runtime-queued'
        );
        assert.equal(invokePayload.result.pollAfterMs, 1500);
        assertTaskJsonShape(invokePayload.task);
        assert.equal(invokePayload.task.id, 'AG-901');
    } finally {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    }
});

test('JSON contract runtime invoke reporta fallback cli_helper en hybrid_http_cli', async () => {
    const dir = createFixtureDir();
    const runtimeServer = await startRuntimeJsonServer({
        figoPostPayload: {
            ok: false,
            mode: 'failed',
            provider: 'openclaw_queue',
            errorCode: 'bridge_failed',
            error: 'bridge failed',
        },
        gatewayPayload: {
            id: 'gateway-runtime-cli',
            object: 'chat.completion',
            created: 1,
            model: 'openclaw:main',
            choices: [
                {
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: 'runtime-cli-helper-ok',
                    },
                    finish_reason: 'stop',
                },
            ],
        },
    });

    try {
        installRuntimeHelperFixture(dir);
        writeRuntimeFixtureFiles(dir, {
            id: 'AG-902',
            title: 'Hybrid runtime fallback',
            runtimeSurface: 'figo_queue',
            runtimeTransport: 'hybrid_http_cli',
            files: ['lib/figo_queue.php'],
            prompt: 'Responde por runtime hibrido',
            acceptance: 'Caer a helper CLI',
            priorityScore: 75,
        });

        const invokePayload = await runJsonExpectStatusWithOptionsAsync(
            dir,
            ['runtime', 'invoke', 'AG-902', '--expect-rev', '0'],
            0,
            {
                env: {
                    OPENCLAW_RUNTIME_BASE_URL: runtimeServer.baseUrl,
                    OPENCLAW_GATEWAY_ENDPOINT: `${runtimeServer.baseUrl}/openclaw-gateway`,
                    OPENCLAW_GATEWAY_MODEL: 'openclaw:main',
                },
            }
        );
        assertVersionLike(invokePayload.version);
        assert.equal(invokePayload.command, 'runtime invoke');
        assert.equal(invokePayload.ok, true);
        assert.equal(invokePayload.result.mode, 'live');
        assert.equal(invokePayload.result.provider, 'openclaw_chatgpt');
        assert.equal(invokePayload.result.runtime_surface, 'figo_queue');
        assert.equal(invokePayload.result.runtime_transport, 'cli_helper');
        assert.equal(Array.isArray(invokePayload.result.diagnostics), true);
        assert.equal(invokePayload.result.diagnostics.length > 0, true);
        assert.equal(
            invokePayload.result.diagnostics.some(
                (diag) =>
                    diag.transport === 'http_bridge' &&
                    diag.error === 'bridge_failed'
            ),
            true
        );
        assert.equal(invokePayload.task.runtime_last_transport, 'cli_helper');
        assertTaskJsonShape(invokePayload.task);
        assert.equal(invokePayload.task.id, 'AG-902');
    } finally {
        await runtimeServer.close();
        cleanupFixtureDir(dir);
    }
});
