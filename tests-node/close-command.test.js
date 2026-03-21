#!/usr/bin/env node
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    mkdtempSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');
const { spawnSync } = require('child_process');

const {
    handleCloseCommand,
} = require('../tools/agent-orchestrator/commands/close');
const publishCommandHandlers = require('../tools/agent-orchestrator/commands/publish');

const DATE = '2026-03-17T00:00:00Z';

function createGitFixture(taskId, options = {}) {
    const root = mkdtempSync(join(tmpdir(), 'close-command-test-'));
    const taskPath =
        options.taskPath ||
        (/^CDX-/i.test(taskId) ? 'docs/codex-close.md' : 'docs/ag-close.md');
    const evidencePath = join(
        root,
        'verification',
        'agent-runs',
        `${taskId}.md`
    );
    const planPath = join(root, 'PLAN_MAESTRO_CODEX_2026.md');
    const boardPath = join(root, 'AGENT_BOARD.yaml');
    const publishEventsPath = join(
        root,
        'verification',
        'agent-publish-events.jsonl'
    );
    const syncScriptPath = join(root, 'bin', 'sync-main-safe.js');

    mkdirSync(join(root, 'docs'), { recursive: true });
    mkdirSync(join(root, 'verification', 'agent-runs'), { recursive: true });
    mkdirSync(join(root, 'bin'), { recursive: true });

    const task = {
        id: taskId,
        title: `${taskId} fixture`,
        owner: 'ernesto',
        executor: 'codex',
        status: options.status || 'in_progress',
        risk: 'low',
        scope: 'docs',
        codex_instance: options.codexInstance || 'codex_backend_ops',
        files: [taskPath.replace(/\\/g, '/')],
        acceptance: 'Fixture acceptance',
        acceptance_ref: '',
        evidence_ref: '',
        prompt: 'Fixture prompt',
        created_at: DATE,
        updated_at: DATE,
        focus_id: options.focusId || '',
        focus_step: options.focusStep || '',
    };
    const board = {
        version: 1,
        policy: {
            canonical: 'AGENTS.md',
            autonomy: 'semi_autonomous_guardrails',
            kpi: 'reduce_rework',
            revision: 0,
            updated_at: DATE,
        },
        tasks: [task],
    };

    let activeBlocks = /^CDX-/i.test(taskId)
        ? [
              {
                  codex_instance: task.codex_instance,
                  block: 'C1',
                  task_id: taskId,
                  status: task.status,
                  files: task.files,
                  updated_at: DATE,
              },
          ]
        : [];
    let lastWriteMeta = null;

    const serializeInlineArray = (values = []) =>
        `[${values.map((value) => `"${String(value).replace(/\\/g, '/')}"`).join(', ')}]`;
    const serializePlan = () => {
        const blocks = activeBlocks
            .map((block) => {
                return [
                    '<!-- CODEX_ACTIVE',
                    `codex_instance: ${block.codex_instance}`,
                    `block: ${block.block}`,
                    `task_id: ${block.task_id}`,
                    `status: ${block.status}`,
                    `files: ${serializeInlineArray(block.files || [])}`,
                    `updated_at: ${block.updated_at || DATE}`,
                    '-->',
                ].join('\n');
            })
            .join('\n\n');
        return `# Plan Maestro Codex 2026 (Fixture)\n\n${
            blocks ? `${blocks}\n\n` : ''
        }Relacion con Operativo 2026:\n- Fixture close command.\n`;
    };
    const serializeBoard = () => {
        const currentTask = board.tasks[0];
        return `version: 1
policy:
  canonical: AGENTS.md
  autonomy: semi_autonomous_guardrails
  kpi: reduce_rework
  revision: ${board.policy.revision}
  updated_at: ${board.policy.updated_at}
tasks:
  - id: ${currentTask.id}
    title: "${currentTask.title}"
    owner: ${currentTask.owner}
    executor: ${currentTask.executor}
    status: ${currentTask.status}
    risk: ${currentTask.risk}
    scope: ${currentTask.scope}
    codex_instance: ${currentTask.codex_instance}
    files: ${serializeInlineArray(currentTask.files)}
    acceptance: "${currentTask.acceptance}"
    acceptance_ref: "${currentTask.acceptance_ref || ''}"
    evidence_ref: "${currentTask.evidence_ref || ''}"
    depends_on: []
    prompt: "${currentTask.prompt}"
    created_at: ${currentTask.created_at}
    updated_at: ${currentTask.updated_at}
`;
    };

    writeFileSync(boardPath, serializeBoard(), 'utf8');
    writeFileSync(planPath, serializePlan(), 'utf8');
    writeFileSync(join(root, task.files[0]), '# baseline\n', 'utf8');
    writeFileSync(
        syncScriptPath,
        `#!/usr/bin/env node
'use strict';
console.log(JSON.stringify({
  version: 1,
  ok: true,
  message: 'fixture sync ok',
  branch_alignment: {
    remote: 'origin',
    branch: 'main',
    ahead: 0,
    behind: 0,
    aligned: true
  }
}));
`,
        'utf8'
    );

    runGit(root, ['init']);
    runGit(root, ['branch', '-M', 'main']);
    runGit(root, ['config', 'user.email', 'fixture@example.com']);
    runGit(root, ['config', 'user.name', 'Fixture']);
    runGit(root, ['add', '.']);
    runGit(root, ['commit', '-m', 'fixture init']);

    writeFileSync(join(root, task.files[0]), '# updated source\n', 'utf8');
    writeFileSync(evidencePath, `# ${taskId}\n`, 'utf8');

    const ctx = {
        args: [taskId, '--expect-rev', '0', '--json'],
        parseFlags(argv = []) {
            const positionals = [];
            const flags = {};
            for (let index = 0; index < argv.length; index += 1) {
                const token = String(argv[index] || '').trim();
                if (!token) continue;
                if (!token.startsWith('--')) {
                    positionals.push(token);
                    continue;
                }
                const key = token.slice(2);
                const nextToken = String(argv[index + 1] || '').trim();
                if (!nextToken || nextToken.startsWith('--')) {
                    flags[key] = true;
                    continue;
                }
                flags[key] = nextToken;
                index += 1;
            }
            return { positionals, flags };
        },
        resolveTaskEvidencePath() {
            return evidencePath;
        },
        existsSync(path) {
            return path === evidencePath;
        },
        parseBoard() {
            return board;
        },
        parseHandoffs() {
            return { handoffs: [] };
        },
        currentDate() {
            return DATE;
        },
        toRelativeRepoPath(path) {
            return String(path || '')
                .replace(/\\/g, '/')
                .replace(root.replace(/\\/g, '/'), '')
                .replace(/^\/+/, '');
        },
        BOARD_PATH: boardPath,
        serializeBoard,
        writeFileSync,
        syncDerivedQueues() {},
        writeBoard(nextBoard, writeOptions = {}) {
            const expectedRevision = Number(writeOptions.expectRevision);
            assert.equal(expectedRevision, 0);
            board.policy.revision = expectedRevision + 1;
            board.policy.updated_at = DATE;
            writeFileSync(boardPath, serializeBoard(nextBoard), 'utf8');
            lastWriteMeta = {
                lifecycle: {
                    task_results: [
                        {
                            task_id: taskId,
                            lease_action: 'cleared',
                            lease: null,
                            status_since_at: DATE,
                        },
                    ],
                },
            };
        },
        writeBoardAndSync() {
            throw new Error(
                'writeBoardAndSync should not be used for codex close'
            );
        },
        parseJobs: undefined,
        buildJobsSnapshot: undefined,
        findJobSnapshot: undefined,
        rootPath: root,
        publishEventsPath,
        writeCodexActiveBlock(block) {
            if (block === null) {
                activeBlocks = [];
            } else {
                activeBlocks = activeBlocks.filter(
                    (item) =>
                        String(item.task_id || '') !==
                        String(block.task_id || '')
                );
                activeBlocks.push(block);
            }
            writeFileSync(planPath, serializePlan(), 'utf8');
        },
        parseCodexActiveBlocks() {
            return [...activeBlocks];
        },
        getLastBoardWriteMeta() {
            return lastWriteMeta;
        },
        toTaskJson(value) {
            return value;
        },
        parseExpectedBoardRevisionFlag(flags = {}) {
            return Number(flags['expect-rev']);
        },
    };

    return {
        root,
        boardPath,
        planPath,
        evidencePath,
        publishEventsPath,
        ctx,
    };
}

function cleanupFixture(root) {
    rmSync(root, { recursive: true, force: true });
}

function runGit(root, args) {
    const result = spawnSync('git', args, {
        cwd: root,
        encoding: 'utf8',
    });
    assert.equal(
        result.status,
        0,
        `git ${args.join(' ')} failed\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
    );
    return result;
}

async function captureConsoleJson(fn) {
    const originalLog = console.log;
    const lines = [];
    console.log = (...args) => {
        lines.push(args.join(' '));
    };
    try {
        await fn();
    } finally {
        console.log = originalLog;
    }
    const parsedLines = lines
        .map((line) => {
            try {
                return JSON.parse(line);
            } catch {
                return null;
            }
        })
        .filter(Boolean);
    const closePayload =
        [...parsedLines]
            .reverse()
            .find((payload) => payload.command === 'close') ||
        [...parsedLines].reverse().find((payload) => payload.task) ||
        parsedLines[parsedLines.length - 1];
    if (!closePayload) {
        throw new Error(
            `No se pudo capturar JSON de close. logs=${JSON.stringify(lines)}`
        );
    }
    return closePayload;
}

test('close codex AG publica commit y devuelve metadata de publish', async (t) => {
    const fixture = createGitFixture('AG-010');
    t.after(() => cleanupFixture(fixture.root));

    const originalRunPublishPreflight =
        publishCommandHandlers.runPublishPreflight;
    publishCommandHandlers.runPublishPreflight = () => ({
        gateCommands: [{ id: 'board-doctor' }, { id: 'codex-check' }],
        ignoredDirtyEntries: [],
    });
    t.after(() => {
        publishCommandHandlers.runPublishPreflight =
            originalRunPublishPreflight;
    });

    const json = await captureConsoleJson(() =>
        handleCloseCommand(fixture.ctx)
    );

    assert.equal(json.command, 'close', JSON.stringify(json));
    assert.equal(json.action, 'close');
    assert.equal(json.ok, true);
    assert.equal(json.task.id, 'AG-010');
    assert.equal(json.task.status, 'done');
    assert.equal(json.evidence_path, 'verification/agent-runs/AG-010.md');
    assert.equal(typeof json.published_commit, 'string');
    assert.equal(json.publish_transport, 'sync-main-safe');
    assert.deepEqual(json.branch_alignment, {
        remote: 'origin',
        branch: 'main',
        ahead: 0,
        behind: 0,
        aligned: true,
    });
    assert.equal(json.live_status, 'pending');
    assert.equal(json.verification_pending, true);

    const headSubject = runGit(fixture.root, [
        'show',
        '--format=%s',
        '--no-patch',
        'HEAD',
    ]).stdout.trim();
    assert.match(headSubject, /^chore\(codex-close\): closeout AG-010/);

    const headFiles = runGit(fixture.root, [
        'show',
        '--format=',
        '--name-only',
        'HEAD',
    ]).stdout;
    assert.match(headFiles, /AGENT_BOARD\.yaml/);
    assert.match(headFiles, /docs\/ag-close\.md/);
    assert.match(headFiles, /verification\/agent-runs\/AG-010\.md/);
});

test('close codex CDX limpia CODEX_ACTIVE y commitea plan+board+evidence', async (t) => {
    const fixture = createGitFixture('CDX-001');
    t.after(() => cleanupFixture(fixture.root));

    const originalRunPublishPreflight =
        publishCommandHandlers.runPublishPreflight;
    publishCommandHandlers.runPublishPreflight = () => ({
        gateCommands: [{ id: 'board-doctor' }, { id: 'codex-check' }],
        ignoredDirtyEntries: [],
    });
    t.after(() => {
        publishCommandHandlers.runPublishPreflight =
            originalRunPublishPreflight;
    });

    const json = await captureConsoleJson(() =>
        handleCloseCommand(fixture.ctx)
    );

    assert.equal(json.task.id, 'CDX-001', JSON.stringify(json));
    assert.equal(json.task.status, 'done');
    assert.equal(json.published_commit.length > 0, true);
    assert.equal(json.publish_transport, 'sync-main-safe');
    assert.deepEqual(json.branch_alignment, {
        remote: 'origin',
        branch: 'main',
        ahead: 0,
        behind: 0,
        aligned: true,
    });

    const boardRaw = readFileSync(fixture.boardPath, 'utf8');
    assert.match(boardRaw, /status: done/);
    assert.match(
        boardRaw,
        /acceptance_ref: "verification\/agent-runs\/CDX-001\.md"/
    );
    assert.match(
        boardRaw,
        /evidence_ref: "verification\/agent-runs\/CDX-001\.md"/
    );

    const planRaw = readFileSync(fixture.planPath, 'utf8');
    assert.doesNotMatch(planRaw, /task_id: CDX-001/);

    const headFiles = runGit(fixture.root, [
        'show',
        '--format=',
        '--name-only',
        'HEAD',
    ]).stdout;
    assert.match(headFiles, /AGENT_BOARD\.yaml/);
    assert.match(headFiles, /PLAN_MAESTRO_CODEX_2026\.md/);
    assert.match(headFiles, /docs\/codex-close\.md/);
    assert.match(headFiles, /verification\/agent-runs\/CDX-001\.md/);

    const publishEvents = readFileSync(fixture.publishEventsPath, 'utf8');
    assert.match(publishEvents, /"task_id":"CDX-001"/);
    assert.match(publishEvents, /"sync_transport":"sync-main-safe"/);
});

test('close falla si required checks del foco no estan verdes', async (t) => {
    const fixture = createGitFixture('CDX-001');
    t.after(() => cleanupFixture(fixture.root));
    fixture.ctx.buildLiveFocusSummary = async () => ({
        summary: {
            required_checks: [
                {
                    id: 'runtime:operator_auth',
                    state: 'red',
                    ok: false,
                    reason: 'auth_mode_mismatch',
                },
            ],
        },
    });

    await assert.rejects(
        () => handleCloseCommand(fixture.ctx),
        (error) => {
            assert.equal(error.error_code, 'required_check_unverified');
            assert.match(error.message, /close requiere required checks en verde/i);
            assert.match(error.message, /runtime:operator_auth=red/i);
            return true;
        }
    );
});
