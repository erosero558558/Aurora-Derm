'use strict';

const { appendFileSync, mkdirSync } = require('fs');
const { dirname, resolve } = require('path');
const { spawnSync } = require('child_process');
const domainStrategy = require('../domain/strategy');
const { findJobSnapshot: findJobSnapshotFallback } = require('../domain/jobs');
const {
    diagnoseWorktree,
    formatIssueSummary,
    getBlockingIssues,
    getFirstRemediationStep,
    isPathAllowedByPatterns,
    isIgnoredPublishDirtyCategory,
} = require('../../../bin/lib/workspace-hygiene.js');

function normalizePathToken(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase();
}

function buildWorkspaceBlockingError(diagnosis) {
    if (!diagnosis) {
        return null;
    }

    if (diagnosis.overall_state === 'error') {
        const error = new Error(
            diagnosis.next_command
                ? `publish checkpoint bloqueado porque workspace hygiene no pudo inspeccionar el worktree. Ejecuta: ${diagnosis.next_command}`
                : 'publish checkpoint bloqueado porque workspace hygiene no pudo inspeccionar el worktree.'
        );
        error.code = 'publish_workspace_hygiene_blocked';
        error.error_code = 'publish_workspace_hygiene_blocked';
        return error;
    }

    const blockingIssues = getBlockingIssues(diagnosis, 'publish');
    if (blockingIssues.length === 0) {
        return null;
    }

    const firstStep = getFirstRemediationStep(diagnosis);
    const suffix = firstStep
        ? ` Primer paso: ${firstStep.id} (${firstStep.command}).`
        : '';
    const issueSummary = formatIssueSummary(blockingIssues);
    const details = blockingIssues.map((issue) => issue.summary).join(' ');
    const error = new Error(
        `publish checkpoint bloqueado por workspace hygiene: ${issueSummary}. ${details}${suffix}`
    );
    error.code = 'publish_workspace_hygiene_blocked';
    error.error_code = 'publish_workspace_hygiene_blocked';
    return error;
}

function classifyPublishSurface(files = []) {
    const normalizedFiles = Array.isArray(files)
        ? files.map((file) => normalizePathToken(file)).filter(Boolean)
        : [];
    const isOrchestrator = normalizedFiles.some((file) => {
        return (
            file === 'agent-orchestrator.js' ||
            file === 'agents.md' ||
            file === 'claude.md' ||
            file === 'governance-policy.json' ||
            file === 'agent_jobs.yaml' ||
            file.startsWith('tools/agent-orchestrator/') ||
            file.startsWith('.github/workflows/') ||
            file.startsWith('bin/validate-agent-governance') ||
            file.startsWith('bin/retire-executors-codex-only') ||
            file.startsWith('plan_maestro_codex_2026.md') ||
            file.startsWith('jules_tasks.md') ||
            file.startsWith('kimi_tasks.md')
        );
    });
    const isBackend = normalizedFiles.some((file) => {
        return (
            file.endsWith('.php') ||
            file === 'cron.php' ||
            file.startsWith('controllers/') ||
            file.startsWith('lib/') ||
            file.startsWith('bin/')
        );
    });
    const isFrontend = normalizedFiles.some((file) => {
        return (
            file.endsWith('.html') ||
            file.endsWith('.css') ||
            file.startsWith('src/apps/') ||
            file.startsWith('templates/') ||
            file.startsWith('content/') ||
            file.startsWith('js/')
        );
    });
    return {
        orchestrator: isOrchestrator,
        backend: isBackend,
        frontend: isFrontend,
    };
}

function buildGateCommands(surface = {}) {
    const commands = [];
    const add = (id, program, args) => {
        if (commands.some((item) => item.id === id)) return;
        commands.push({ id, program, args });
    };

    add('board-doctor', process.execPath, [
        'agent-orchestrator.js',
        'board',
        'doctor',
        '--json',
    ]);
    add('conflicts', process.execPath, [
        'agent-orchestrator.js',
        'conflicts',
        '--json',
    ]);
    add('codex-check', process.execPath, [
        'agent-orchestrator.js',
        'codex-check',
        '--json',
    ]);

    if (surface.orchestrator) {
        add('agent-test', process.execPath, [
            '--test',
            'tests-node/agent-orchestrator-cli.test.js',
            'tests-node/publish-checkpoint-command.test.js',
            'tests-node/orchestrator/task-guards.test.js',
            'tests-node/orchestrator/diagnostics.test.js',
        ]);
        add('agent-validate', 'php', ['bin/validate-agent-governance.php']);
    }
    if (surface.backend) {
        add('lint-php', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'lint:php',
        ]);
        add('test-php', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'test:php',
        ]);
    }
    if (surface.frontend) {
        add('lint-js', process.platform === 'win32' ? 'npm.cmd' : 'npm', [
            'run',
            'lint:js',
        ]);
        add(
            'public-v6-artifacts-check',
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['run', 'check:public:v6:artifacts']
        );
        add(
            'smoke-public-routing',
            process.platform === 'win32' ? 'npm.cmd' : 'npm',
            ['run', 'smoke:public:routing']
        );
    }

    return commands;
}

function runCommand(program, args, options = {}) {
    const result = spawnSync(program, args, {
        cwd: options.cwd || process.cwd(),
        encoding: 'utf8',
        stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
    return {
        ok: result.status === 0,
        code: result.status === null ? 1 : result.status,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        command: [program, ...args].join(' '),
    };
}

function appendPublishEvent(path, event) {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8');
}

function readLatestLanePublish(path, lane) {
    try {
        const { existsSync, readFileSync } = require('fs');
        if (!existsSync(path)) return null;
        const lines = String(readFileSync(path, 'utf8') || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .reverse();
        for (const line of lines) {
            const parsed = JSON.parse(line);
            if (String(parsed.codex_instance || '') === String(lane || '')) {
                return parsed;
            }
        }
    } catch {
        return null;
    }
    return null;
}

function isSupportedPublishTaskId(taskId) {
    return /^(AG|CDX)-\d+$/i.test(String(taskId || '').trim());
}

function getTaskFamily(taskId) {
    const match = String(taskId || '')
        .trim()
        .match(/^(AG|CDX)-\d+$/i);
    return match ? match[1].toLowerCase() : '';
}

function summaryHasReleasePublishMarker(summary) {
    const normalized = String(summary || '')
        .trim()
        .toLowerCase();
    return (
        normalized.includes('release-publish') ||
        normalized.includes('validated_release_promotion')
    );
}

async function detectLiveVerificationStatus(ctx, expectedCommit) {
    const { parseJobs, buildJobsSnapshot, findJobSnapshot } = ctx || {};
    if (
        typeof parseJobs !== 'function' ||
        typeof buildJobsSnapshot !== 'function'
    ) {
        return {
            live_status: 'pending',
            verification_pending: true,
            job: null,
        };
    }
    const jobs = await buildJobsSnapshot(parseJobs());
    const resolver =
        typeof findJobSnapshot === 'function'
            ? findJobSnapshot
            : findJobSnapshotFallback;
    const job =
        typeof resolver === 'function'
            ? resolver(jobs, 'public_main_sync')
            : Array.isArray(jobs)
              ? jobs.find(
                    (candidate) =>
                        String(candidate?.key || '').trim() ===
                        'public_main_sync'
                ) || null
              : null;
    const confirmed = Boolean(
        job &&
        job.healthy &&
        String(job.deployed_commit || '') === String(expectedCommit || '')
    );
    return {
        live_status: confirmed ? 'confirmed' : 'pending',
        verification_pending: !confirmed,
        job,
    };
}

function hasRuntimeRequiredCheck(summary = {}) {
    return Array.isArray(summary?.configured?.required_checks)
        ? summary.configured.required_checks.some((item) =>
              String(item || '')
                  .trim()
                  .toLowerCase()
                  .startsWith('runtime:')
          )
        : false;
}

function listPendingRequiredChecks(summary = {}) {
    return Array.isArray(summary?.required_checks)
        ? summary.required_checks.filter((item) => item?.ok !== true)
        : [];
}

function formatPendingRequiredChecks(summary = {}) {
    return listPendingRequiredChecks(summary)
        .map((item) => {
            const reason = String(item?.reason || '').trim();
            return reason
                ? `${item.id}=${item.state}(${reason})`
                : `${item.id}=${item.state}`;
        })
        .join(', ');
}

function assertReleaseRequiredChecks(summary = {}, actionLabel = 'release') {
    const pendingChecks = listPendingRequiredChecks(summary);
    if (pendingChecks.length === 0) {
        return;
    }
    const error = new Error(
        `${actionLabel} requiere required checks en verde: ${formatPendingRequiredChecks(summary)}`
    );
    error.code = 'required_check_unverified';
    error.error_code = 'required_check_unverified';
    error.required_checks = pendingChecks;
    throw error;
}

function buildAllowedPatterns(taskId, task = {}) {
    return [
        ...(Array.isArray(task.files) ? task.files : []),
        'agent_board.yaml',
        'agent_handoffs.yaml',
        'agent_decisions.yaml',
        'plan_maestro_codex_2026.md',
        `verification/agent-runs/${normalizePathToken(taskId)}.md`,
    ].map((value) => normalizePathToken(value));
}

function createNoChangesToPublishError() {
    const error = new Error(
        'publish checkpoint no encontro cambios para publicar'
    );
    error.code = 'no_changes_to_publish';
    error.error_code = 'no_changes_to_publish';
    return error;
}

function assertExpectedRevision(currentRevision, expectedRevision) {
    if (!Number.isFinite(expectedRevision)) {
        const error = new Error(
            'publish checkpoint requiere --expect-rev <revision_actual>'
        );
        error.code = 'expect_rev_required';
        error.error_code = 'expect_rev_required';
        throw error;
    }
    if (expectedRevision !== currentRevision) {
        const error = new Error(
            `publish checkpoint revision mismatch: expected ${expectedRevision}, actual ${currentRevision}`
        );
        error.code = 'board_revision_mismatch';
        error.error_code = 'board_revision_mismatch';
        error.expected_revision = expectedRevision;
        error.actual_revision = currentRevision;
        throw error;
    }
}

function assertCodexPublishTask(taskId, task, options = {}) {
    const { allowedStatuses = ['in_progress', 'review'] } = options;
    if (
        String(task.executor || '')
            .trim()
            .toLowerCase() !== 'codex'
    ) {
        const error = new Error(
            `publish checkpoint requiere executor=codex en ${taskId}`
        );
        error.code = 'invalid_executor';
        error.error_code = 'invalid_executor';
        throw error;
    }
    if (!Array.isArray(allowedStatuses) || allowedStatuses.length === 0) {
        return;
    }
    const status = String(task.status || '').trim();
    if (!allowedStatuses.includes(status)) {
        const error = new Error(
            `publish checkpoint requiere status ${allowedStatuses.join('|')} en ${taskId}`
        );
        error.code = 'invalid_status';
        error.error_code = 'invalid_status';
        throw error;
    }
}

function assertPublishCooldown(publishEventsPath, codexInstance, options = {}) {
    const { force = false } = options;
    const latestPublish = readLatestLanePublish(
        publishEventsPath,
        codexInstance
    );
    if (force || !latestPublish || !latestPublish.published_at) {
        return null;
    }
    const lastPublishedMs = Date.parse(
        String(latestPublish.published_at || '')
    );
    if (!Number.isFinite(lastPublishedMs)) {
        return latestPublish;
    }
    const deltaSeconds = Math.floor((Date.now() - lastPublishedMs) / 1000);
    if (deltaSeconds < 90) {
        const error = new Error(
            `publish checkpoint cooldown activo para ${codexInstance}: ${deltaSeconds}s`
        );
        error.code = 'publish_cooldown_active';
        error.error_code = 'publish_cooldown_active';
        throw error;
    }
    return latestPublish;
}

function diagnosePublishWorkspace(rootPath, board, task, allowedPatterns) {
    const workspaceDiagnosis = diagnoseWorktree(rootPath, {
        board,
        scopeTask: task,
        scopePatterns: allowedPatterns,
    });
    const blockingWorkspaceError =
        buildWorkspaceBlockingError(workspaceDiagnosis);
    const dirtyEntriesRaw = Array.isArray(workspaceDiagnosis?.dirtyEntries)
        ? workspaceDiagnosis.dirtyEntries
        : [];
    const ignoredDirtyEntries = dirtyEntriesRaw.filter((entry) =>
        isIgnoredPublishDirtyCategory(entry.category)
    );
    const dirtyEntries = dirtyEntriesRaw.filter(
        (entry) => !isIgnoredPublishDirtyCategory(entry.category)
    );
    const dirtyFiles = dirtyEntries.map((entry) => entry.rawPath || entry.path);
    return {
        workspaceDiagnosis,
        blockingWorkspaceError,
        ignoredDirtyEntries,
        dirtyEntries,
        dirtyFiles,
    };
}

function runPublishGates(rootPath, files = []) {
    const surface = classifyPublishSurface(files);
    const gateCommands = buildGateCommands(surface);
    for (const gate of gateCommands) {
        const gateResult = runCommand(gate.program, gate.args, {
            cwd: rootPath,
            capture: false,
        });
        if (!gateResult.ok) {
            const error = new Error(
                `publish checkpoint gate fallo: ${gate.id}`
            );
            error.code = 'publish_gate_failed';
            error.error_code = 'publish_gate_failed';
            throw error;
        }
    }
    return {
        surface,
        gateCommands,
    };
}

function runPublishPreflight(options = {}) {
    const {
        rootPath,
        board,
        task,
        allowedPatterns,
        publishEventsPath,
        force = false,
        allowNoChanges = false,
        extraSurfaceFiles = [],
        skipCooldown = false,
    } = options;
    const codexInstance = String(
        task?.codex_instance || 'codex_backend_ops'
    ).trim();
    if (!skipCooldown) {
        assertPublishCooldown(publishEventsPath, codexInstance, { force });
    }
    const diagnosis = diagnosePublishWorkspace(
        rootPath,
        board,
        task,
        allowedPatterns
    );
    if (diagnosis.blockingWorkspaceError) {
        throw diagnosis.blockingWorkspaceError;
    }
    const combinedSurfaceFiles = [
        ...diagnosis.dirtyFiles,
        ...(Array.isArray(extraSurfaceFiles) ? extraSurfaceFiles : []),
    ]
        .map((value) => normalizePathToken(value))
        .filter(Boolean);
    const gates = runPublishGates(rootPath, combinedSurfaceFiles);
    if (!allowNoChanges && diagnosis.dirtyEntries.length === 0) {
        throw createNoChangesToPublishError();
    }
    return {
        codexInstance,
        ...diagnosis,
        ...gates,
    };
}

function parseSyncMainSafePayload(syncResult = {}) {
    try {
        const payload = JSON.parse(String(syncResult.stdout || '').trim());
        return payload && typeof payload === 'object' ? payload : null;
    } catch {
        return null;
    }
}

function buildPublishCommitMessage(options = {}) {
    const {
        taskId,
        codexInstance,
        summary,
        command = 'publish checkpoint',
    } = options;
    if (command === 'close') {
        return `chore(codex-close): closeout ${taskId} [lane:${codexInstance}] - ${summary}`;
    }
    return `chore(codex-publish): checkpoint ${taskId} [lane:${codexInstance}] - ${summary}`;
}

function buildClosePublishSummary(taskId, task = {}) {
    const tokens = ['closeout', taskId];
    const focusId = String(task.focus_id || '').trim();
    const focusStep = String(task.focus_step || '').trim();
    if (focusId) {
        tokens.push(focusId);
    }
    if (focusStep) {
        tokens.push(focusStep);
    }
    return tokens.join(' ');
}

async function finalizePreparedPublish(ctx = {}, options = {}) {
    const {
        rootPath,
        publishEventsPath,
        parseJobs,
        buildJobsSnapshot,
        findJobSnapshot,
    } = ctx;
    const {
        board,
        task,
        taskId,
        taskFamily = getTaskFamily(taskId),
        summary,
        releaseException = false,
        allowedPatterns,
        gateCommands = [],
        ignoredDirtyEntries: ignoredDirtyEntriesPreflight = [],
        explicitDirtyFiles = null,
        command = 'publish checkpoint',
    } = options;
    const codexInstance = String(
        task?.codex_instance || 'codex_backend_ops'
    ).trim();

    const diagnosis = Array.isArray(explicitDirtyFiles)
        ? null
        : diagnosePublishWorkspace(rootPath, board, task, allowedPatterns);
    if (diagnosis?.blockingWorkspaceError) {
        throw diagnosis.blockingWorkspaceError;
    }
    if (diagnosis && diagnosis.dirtyEntries.length === 0) {
        throw createNoChangesToPublishError();
    }
    const filesToStage = Array.isArray(explicitDirtyFiles)
        ? explicitDirtyFiles.filter(Boolean)
        : diagnosis.dirtyFiles;

    const addResult = runCommand('git', ['add', '--', ...filesToStage], {
        cwd: rootPath,
        capture: true,
    });
    if (!addResult.ok) {
        throw new Error(
            addResult.stderr || addResult.stdout || 'git add fallo'
        );
    }

    const diffCachedResult = runCommand(
        'git',
        ['diff', '--cached', '--name-only'],
        {
            cwd: rootPath,
            capture: true,
        }
    );
    if (!diffCachedResult.ok) {
        throw new Error(
            diffCachedResult.stderr ||
                diffCachedResult.stdout ||
                'git diff --cached fallo'
        );
    }
    const stagedFiles = diffCachedResult.stdout
        .split(/\r?\n/)
        .map((line) => normalizePathToken(line))
        .filter(Boolean);
    if (stagedFiles.length === 0) {
        const error = new Error(
            'publish checkpoint no encontro cambios staged'
        );
        error.code = 'no_changes_to_publish';
        error.error_code = 'no_changes_to_publish';
        throw error;
    }

    const commitMessage = buildPublishCommitMessage({
        taskId,
        codexInstance,
        summary,
        command,
    });
    const commitResult = runCommand('git', ['commit', '-m', commitMessage], {
        cwd: rootPath,
        capture: true,
    });
    if (!commitResult.ok) {
        throw new Error(
            commitResult.stderr || commitResult.stdout || 'git commit fallo'
        );
    }

    const headResult = runCommand('git', ['rev-parse', 'HEAD'], {
        cwd: rootPath,
        capture: true,
    });
    if (!headResult.ok) {
        throw new Error(
            headResult.stderr || headResult.stdout || 'git rev-parse HEAD fallo'
        );
    }
    const headSha = String(headResult.stdout || '').trim();

    const syncResult = runCommand(
        process.execPath,
        [
            resolve(rootPath, 'bin', 'sync-main-safe.js'),
            '--remote',
            'origin',
            '--branch',
            'main',
            '--source-ref',
            'HEAD',
            '--max-sync-attempts',
            '3',
            '--json',
        ],
        { cwd: rootPath, capture: true }
    );
    if (!syncResult.ok) {
        throw new Error(
            syncResult.stderr || syncResult.stdout || 'sync-main-safe fallo'
        );
    }
    const syncPayload = parseSyncMainSafePayload(syncResult);
    const branchAlignment =
        syncPayload && typeof syncPayload === 'object'
            ? syncPayload.branch_alignment || null
            : null;
    if (branchAlignment && branchAlignment.aligned === false) {
        const error = new Error(
            `branch no alineada tras publish: ahead=${branchAlignment.ahead} behind=${branchAlignment.behind}`
        );
        error.code = 'publish_branch_not_aligned';
        error.error_code = 'publish_branch_not_aligned';
        error.branch_alignment = branchAlignment;
        throw error;
    }

    const liveVerificationState = await detectLiveVerificationStatus(
        {
            parseJobs,
            buildJobsSnapshot,
            findJobSnapshot,
        },
        headSha
    );
    const liveStatus = liveVerificationState.live_status;
    const verificationPending = liveVerificationState.verification_pending;
    const warningCode = verificationPending
        ? 'publish_live_verification_pending'
        : null;
    const ignoredDirtyEntries = [
        ...ignoredDirtyEntriesPreflight,
        ...(Array.isArray(diagnosis?.ignoredDirtyEntries)
            ? diagnosis.ignoredDirtyEntries
            : []),
    ].reduce((acc, entry) => {
        const key = `${String(entry?.path || '')}:${String(entry?.category || '')}`;
        if (!acc.some((item) => item.key === key)) {
            acc.push({
                key,
                path: entry?.path,
                category: entry?.category,
            });
        }
        return acc;
    }, []);
    appendPublishEvent(publishEventsPath, {
        version: 1,
        task_id: taskId,
        task_family: taskFamily,
        codex_instance: codexInstance,
        published_at: new Date().toISOString(),
        commit: headSha,
        summary,
        release_exception: releaseException,
        live_status: liveStatus,
        verification_pending: verificationPending,
        ...(warningCode ? { warning_code: warningCode } : {}),
        live_ok: true,
        deploy_verification: 'delegated_to_deploy',
        sync_transport: 'sync-main-safe',
        ...(branchAlignment ? { branch_alignment: branchAlignment } : {}),
        ignored_dirty_entries: ignoredDirtyEntries.map((entry) => ({
            path: entry.path,
            category: entry.category,
        })),
    });

    return {
        version: 1,
        ok: true,
        task_id: taskId,
        task_family: taskFamily,
        codex_instance: codexInstance,
        release_exception: releaseException,
        commit: headSha,
        published_commit: headSha,
        staged_files: stagedFiles,
        gates_run: gateCommands.map((item) => item.id),
        live_status: liveStatus,
        verification_pending: verificationPending,
        ...(warningCode ? { warning_code: warningCode } : {}),
        publish_transport: 'sync-main-safe',
        branch_alignment: branchAlignment,
        live_verification: {
            mode: 'delegated_to_deploy',
            transport: 'sync-main-safe',
            job_key: 'public_main_sync',
            status: liveStatus,
        },
        ignored_dirty_entries: ignoredDirtyEntries.map((entry) => ({
            path: entry.path,
            category: entry.category,
        })),
    };
}

async function handlePublishCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        ensureTask,
        buildFocusSummary,
        buildLiveFocusSummary,
        parseDecisions,
        parseJobs,
        buildJobsSnapshot,
        findJobSnapshot = findJobSnapshotFallback,
        verifyOpenClawRuntime,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
        rootPath,
        publishEventsPath,
        collectWorkspaceTruth,
        assertWorkspaceTruthOk,
    } = ctx;
    const subcommand = String(args[0] || '')
        .trim()
        .toLowerCase();
    const wantsJson = args.includes('--json');
    if (subcommand !== 'checkpoint') {
        throw new Error(
            'Uso: node agent-orchestrator.js publish checkpoint <AG-###|CDX-###> --summary "..." --expect-rev <n> [--force] [--json]'
        );
    }

    const { flags, positionals } = parseFlags(args.slice(1));
    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth({
                  allWorktrees: true,
                  currentOnly: false,
              })
            : null;
    if (typeof assertWorkspaceTruthOk === 'function') {
        assertWorkspaceTruthOk(workspaceReport, {
            commandLabel: 'publish checkpoint',
        });
    }
    const taskId = String(positionals[0] || flags.id || '').trim();
    if (!isSupportedPublishTaskId(taskId)) {
        const error = new Error(
            'publish checkpoint requiere task_id AG-### o CDX-###'
        );
        error.code = 'invalid_task_id';
        error.error_code = 'invalid_task_id';
        throw error;
    }
    const taskFamily = getTaskFamily(taskId);
    const summary = String(flags.summary || '').trim();
    if (!summary) {
        const error = new Error('publish checkpoint requiere --summary');
        error.code = 'missing_summary';
        error.error_code = 'missing_summary';
        throw error;
    }

    const board = parseBoard();
    const task = ensureTask(board, taskId);
    const isReleaseException =
        domainStrategy.isReleasePromotionExceptionTask(task);
    const currentRevision = Number.parseInt(
        String(board?.policy?.revision || '0'),
        10
    );
    const expectedRevision = Number.parseInt(
        String(flags['expect-rev'] ?? flags.expect_rev ?? ''),
        10
    );
    assertExpectedRevision(currentRevision, expectedRevision);
    assertCodexPublishTask(taskId, task, {
        allowedStatuses: ['in_progress', 'review'],
    });
    let focusSummary = null;
    if (typeof buildLiveFocusSummary === 'function') {
        focusSummary = (
            await buildLiveFocusSummary(board, { now: new Date() })
        )?.summary;
    } else if (typeof buildFocusSummary === 'function') {
        const decisionsData =
            typeof parseDecisions === 'function'
                ? parseDecisions()
                : { decisions: [] };
        const jobsSnapshot =
            typeof buildJobsSnapshot === 'function'
                ? await buildJobsSnapshot(parseJobs())
                : [];
        const initialFocusSummary = buildFocusSummary(board, {
            decisionsData,
            jobsSnapshot,
            now: new Date(),
        });
        const runtimeVerification =
            initialFocusSummary &&
            hasRuntimeRequiredCheck(initialFocusSummary) &&
            typeof verifyOpenClawRuntime === 'function'
                ? await verifyOpenClawRuntime()
                : null;
        focusSummary = buildFocusSummary(board, {
            decisionsData,
            jobsSnapshot,
            runtimeVerification,
            now: new Date(),
        });
    }
    if (focusSummary?.active) {
        const focusId = String(focusSummary.active.id || '').trim();
        const focusStep = String(focusSummary.active.next_step || '').trim();
        if (String(task.focus_id || '').trim() !== focusId) {
            const error = new Error(
                `publish checkpoint requiere task alineada al foco activo (${focusId})`
            );
            error.code = 'publish_checkpoint_outside_focus';
            error.error_code = 'publish_checkpoint_outside_focus';
            throw error;
        }
        if (String(task.focus_step || '').trim() !== focusStep) {
            const error = new Error(
                `publish checkpoint requiere focus_step=${focusStep || 'n/a'}`
            );
            error.code = 'publish_checkpoint_outside_focus';
            error.error_code = 'publish_checkpoint_outside_focus';
            throw error;
        }
        const normalizedSummary = summary.toLowerCase();
        if (
            !isReleaseException &&
            focusId &&
            focusStep &&
            !normalizedSummary.includes(focusId.toLowerCase()) &&
            !normalizedSummary.includes(focusStep.toLowerCase())
        ) {
            const error = new Error(
                'publish checkpoint requiere --summary alineado a focus_id o focus_next_step'
            );
            error.code = 'publish_checkpoint_outside_focus';
            error.error_code = 'publish_checkpoint_outside_focus';
            throw error;
        }
    }
    if (focusSummary) {
        assertReleaseRequiredChecks(focusSummary, 'publish checkpoint');
    }
    if (isReleaseException && !summaryHasReleasePublishMarker(summary)) {
        const error = new Error(
            'publish checkpoint release-publish requiere --summary con release-publish o validated_release_promotion'
        );
        error.code = 'invalid_summary';
        error.error_code = 'invalid_summary';
        throw error;
    }

    const allowedPatterns = buildAllowedPatterns(taskId, task);
    const preflight = runPublishPreflight({
        rootPath,
        board,
        task,
        allowedPatterns,
        publishEventsPath,
        force: Boolean(flags.force),
    });

    const publishResult = await finalizePreparedPublish(
        {
            rootPath,
            publishEventsPath,
            parseJobs,
            buildJobsSnapshot,
            findJobSnapshot,
        },
        {
            board,
            task,
            taskId,
            taskFamily,
            summary,
            releaseException: isReleaseException,
            allowedPatterns,
            gateCommands: preflight.gateCommands,
            ignoredDirtyEntries: preflight.ignoredDirtyEntries,
            command: 'publish checkpoint',
        }
    );

    const report = {
        ...publishResult,
        command: 'publish checkpoint',
        focus_id: String(task.focus_id || '').trim() || null,
        focus_step: String(task.focus_step || '').trim() || null,
        focus_summary: focusSummary,
    };

    if (wantsJson) {
        printJson(report);
        return report;
    }

    console.log(`Publish checkpoint OK: ${taskId} -> ${publishResult.commit}`);
    return report;
}

module.exports = {
    isPathAllowedByPatterns,
    classifyPublishSurface,
    buildGateCommands,
    buildAllowedPatterns,
    buildClosePublishSummary,
    diagnosePublishWorkspace,
    assertReleaseRequiredChecks,
    formatPendingRequiredChecks,
    finalizePreparedPublish,
    handlePublishCommand,
    runPublishPreflight,
};
