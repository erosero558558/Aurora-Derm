'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const {
    diagnoseWorktree,
    fixWorkspace,
    listWorktrees,
} = require('../../../bin/lib/workspace-hygiene.js');

const DEFAULT_TTL_MINUTES = 3;
const DEFAULT_WATCHER_INTERVAL_SECONDS = 60;
const ACTIVE_TASK_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);
const ROOT_NON_BLOCKING_DIRTY_CATEGORIES = new Set([
    'generated_stage',
    'deploy_bundle',
    'local_artifact',
    'derived_queue',
    'prunable_worktree',
]);
const ROOT_MANAGED_DIRTY_PATHS = new Set([
    'AGENT_BOARD.yaml',
    'AGENT_HANDOFFS.yaml',
    'AGENT_JOBS.yaml',
    'AGENT_SIGNALS.yaml',
    'PLAN_MAESTRO_CODEX_2026.md',
]);
const ROOT_MANAGED_DIRTY_PREFIXES = ['verification/'];

function normalizePathValue(value) {
    return String(value || '').trim().replace(/\\/g, '/');
}

function normalizeWorkspaceSyncPolicy(policy = null) {
    const cfg = policy?.enforcement?.workspace_sync;
    return {
        enabled: cfg?.enabled !== false,
        ttl_minutes:
            Number.isFinite(Number(cfg?.ttl_minutes)) &&
            Number(cfg.ttl_minutes) > 0
                ? Number(cfg.ttl_minutes)
                : DEFAULT_TTL_MINUTES,
        watcher_interval_seconds:
            Number.isFinite(Number(cfg?.watcher_interval_seconds)) &&
            Number(cfg.watcher_interval_seconds) > 0
                ? Number(cfg.watcher_interval_seconds)
                : DEFAULT_WATCHER_INTERVAL_SECONDS,
        remote: String(cfg?.remote || 'origin').trim() || 'origin',
        root_branch: String(cfg?.root_branch || 'main').trim() || 'main',
        task_branch_prefix:
            String(cfg?.task_branch_prefix || 'codex/').trim() || 'codex/',
        local_dir: String(cfg?.local_dir || '.codex-local').trim() || '.codex-local',
        worktrees_dir:
            String(cfg?.worktrees_dir || '.codex-worktrees').trim() ||
            '.codex-worktrees',
        machine_id_filename:
            String(cfg?.machine_id_filename || 'machine-id').trim() ||
            'machine-id',
        sync_status_filename:
            String(cfg?.sync_status_filename || 'workspace-sync.json').trim() ||
            'workspace-sync.json',
        watcher_task_name:
            String(
                cfg?.watcher_task_name || 'PielArmonia Codex Workspace Sync'
            ).trim() || 'PielArmonia Codex Workspace Sync',
        watcher_script_path:
            String(
                cfg?.watcher_script_path ||
                    'scripts/ops/codex/RUN-CODEX-WORKSPACE-SYNC.ps1'
            ).trim() || 'scripts/ops/codex/RUN-CODEX-WORKSPACE-SYNC.ps1',
    };
}

function quoteArg(value) {
    const text = String(value || '');
    if (!text.includes(' ')) return text;
    return `"${text.replace(/"/g, '\\"')}"`;
}

function runCommand(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: options.cwd || process.cwd(),
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    return {
        ok: result.status === 0,
        status: result.status === null ? 1 : result.status,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
        command: [command, ...args].map((token) => quoteArg(token)).join(' '),
    };
}

function runGit(cwd, args, options = {}) {
    const result = runCommand('git', args, { cwd });
    if (!options.allowFailure && !result.ok) {
        const error = new Error(
            result.stderr || result.stdout || `git ${args.join(' ')} failed`
        );
        error.code = 'git_command_failed';
        error.error_code = 'git_command_failed';
        error.git = {
            cwd: normalizePathValue(cwd),
            args,
            stdout: result.stdout,
            stderr: result.stderr,
            command: result.command,
        };
        throw error;
    }
    return result;
}

function parseAheadBehindCounts(value) {
    const parts = String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (parts.length < 2) {
        return { ahead: 0, behind: 0 };
    }
    const ahead = Number.parseInt(parts[0], 10);
    const behind = Number.parseInt(parts[1], 10);
    return {
        ahead: Number.isFinite(ahead) ? ahead : 0,
        behind: Number.isFinite(behind) ? behind : 0,
    };
}

function ensureDirectory(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function resolveGitTopLevel(cwd) {
    const result = runGit(cwd, ['rev-parse', '--show-toplevel'], {
        allowFailure: true,
    });
    if (!result.ok) {
        return null;
    }
    const topLevel = String(result.stdout || '').trim();
    return topLevel ? path.resolve(topLevel) : null;
}

function readCurrentBranch(cwd) {
    const result = runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], {
        allowFailure: true,
    });
    if (!result.ok) return '';
    const branch = String(result.stdout || '').trim();
    return branch === 'HEAD' ? '(detached)' : branch;
}

function readHeadSha(cwd, ref = 'HEAD') {
    const result = runGit(cwd, ['rev-parse', ref], { allowFailure: true });
    if (!result.ok) return '';
    return String(result.stdout || '').trim();
}

function getAheadBehind(cwd, targetRef) {
    const result = runGit(
        cwd,
        ['rev-list', '--left-right', '--count', `HEAD...${targetRef}`],
        { allowFailure: true }
    );
    if (!result.ok) {
        return { ahead: 0, behind: 0 };
    }
    return parseAheadBehindCounts(result.stdout);
}

function isPathWithin(parentPath, candidatePath) {
    const parent = normalizePathValue(path.resolve(parentPath));
    const candidate = normalizePathValue(path.resolve(candidatePath));
    return candidate === parent || candidate.startsWith(`${parent}/`);
}

function resolveWorkspaceRoots(cwd, policy) {
    const topLevel = resolveGitTopLevel(cwd);
    if (!topLevel) {
        const error = new Error('workspace sync requiere un repo git legible');
        error.code = 'workspace_git_unavailable';
        error.error_code = 'workspace_git_unavailable';
        throw error;
    }
    const listed = listWorktrees(topLevel);
    const rootBranch = policy.root_branch;
    const mainWorktree =
        listed.find(
            (row) =>
                !row.prunable &&
                String(row.branch || '').trim() === String(rootBranch || '').trim()
        ) || { path: topLevel, branch: rootBranch, detached: false };
    const mainRoot = path.resolve(mainWorktree.path || topLevel);
    return {
        top_level: topLevel,
        main_root: mainRoot,
        current_root: path.resolve(cwd),
        local_dir: path.resolve(mainRoot, policy.local_dir),
        worktrees_dir: path.resolve(mainRoot, policy.worktrees_dir),
        worktree_rows: listed,
    };
}

function ensureMachineId(localDir, policy) {
    const filePath = path.resolve(localDir, policy.machine_id_filename);
    if (fs.existsSync(filePath)) {
        return String(fs.readFileSync(filePath, 'utf8') || '').trim();
    }
    const machineId =
        typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(filePath, `${machineId}\n`, 'utf8');
    return machineId;
}

function getWorkspaceStatusPath(localDir, policy) {
    return path.resolve(localDir, policy.sync_status_filename);
}

function readWorkspaceStatus(statusPath) {
    if (!fs.existsSync(statusPath)) return null;
    try {
        return JSON.parse(fs.readFileSync(statusPath, 'utf8'));
    } catch {
        return null;
    }
}

function writeWorkspaceStatus(statusPath, payload) {
    fs.writeFileSync(statusPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return payload;
}

function buildExpectedTaskBranch(taskId, policy) {
    return `${policy.task_branch_prefix}${String(taskId || '').trim()}`;
}

function inferTaskIdFromWorktree(row, policy) {
    const branch = String(row?.branch || '').trim();
    if (branch.startsWith(policy.task_branch_prefix)) {
        return branch.slice(policy.task_branch_prefix.length);
    }
    const baseName = path.basename(String(row?.path || '').trim());
    return String(baseName || '').trim();
}

function summarizeDiagnosis(diagnosis) {
    return {
        overall_state: String(diagnosis?.overall_state || '').trim(),
        dirty_total: Number(diagnosis?.dirty_total || 0),
        issue_counts: diagnosis?.issue_counts || {},
        scope_counts: diagnosis?.scope_counts || {},
        lane_resolution: String(diagnosis?.lane_context?.resolution || '').trim(),
        next_command: String(diagnosis?.next_command || '').trim(),
    };
}

function countAuthoredEntries(entries = []) {
    return (Array.isArray(entries) ? entries : []).filter(
        (entry) => String(entry?.category || '').trim() === 'authored'
    ).length;
}

function isManagedRootDirtyPath(pathValue) {
    const normalized = normalizePathValue(pathValue).replace(/^\.\//, '');
    if (!normalized) {
        return false;
    }
    if (ROOT_MANAGED_DIRTY_PATHS.has(normalized)) {
        return true;
    }
    return ROOT_MANAGED_DIRTY_PREFIXES.some(
        (prefix) =>
            normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)
    );
}

function isBlockingRootDirtyEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    const category = String(entry.category || '').trim();
    if (ROOT_NON_BLOCKING_DIRTY_CATEGORIES.has(category)) {
        return false;
    }
    if (category !== 'authored') {
        return true;
    }
    return !isManagedRootDirtyPath(entry.path);
}

function isBlockingTaskDirtyEntry(entry) {
    if (!entry || typeof entry !== 'object') {
        return false;
    }
    const category = String(entry.category || '').trim();
    if (ROOT_NON_BLOCKING_DIRTY_CATEGORIES.has(category)) {
        return false;
    }
    if (category !== 'authored') {
        return true;
    }
    return !isManagedRootDirtyPath(entry.path);
}

function hasBlockingTaskLaneDrift(entries = []) {
    return (Array.isArray(entries) ? entries : []).some((entry) => {
        if (String(entry?.category || '').trim() !== 'authored') {
            return true;
        }
        const scopeDisposition = String(
            entry?.scope_disposition || ''
        ).trim();
        const strategyDisposition = String(
            entry?.strategy_disposition || ''
        ).trim();
        const laneDisposition = String(entry?.lane_disposition || '').trim();
        return (
            scopeDisposition === 'out_of_scope' ||
            strategyDisposition === 'blocked_scope' ||
            strategyDisposition === 'outside_strategy' ||
            strategyDisposition === 'mixed_subfronts' ||
            laneDisposition === 'mixed_lane'
        );
    });
}

function hasMixedLaneDiagnosis(diagnosis) {
    const laneResolution = String(
        diagnosis?.lane_context?.resolution || ''
    ).trim();
    if (laneResolution === 'mixed_lane') {
        return true;
    }
    return Number(diagnosis?.scope_counts?.out_of_scope || 0) > 0;
}

function cleanupWorktreeIfFixable(worktreePath, diagnosis, taskId) {
    if (String(diagnosis?.overall_state || '').trim() !== 'fixable') {
        return diagnosis;
    }
    return fixWorkspace(worktreePath, {
        includeDerivedQueue: true,
        scopeTaskId: taskId || '',
    });
}

function alignMainRoot(mainRoot, policy) {
    const remoteRef = `${policy.remote}/${policy.root_branch}`;
    let diagnosis = diagnoseWorktree(mainRoot);
    diagnosis = cleanupWorktreeIfFixable(mainRoot, diagnosis, '');
    const branch = readCurrentBranch(mainRoot);
    const head = readHeadSha(mainRoot);
    const originHead = readHeadSha(mainRoot, `refs/remotes/${remoteRef}`);
    const dirtyEntries = Array.isArray(diagnosis?.dirtyEntries)
        ? diagnosis.dirtyEntries
        : [];
    const blockingDirtyEntries = dirtyEntries.filter(isBlockingRootDirtyEntry);
    const managedDirtyEntries = dirtyEntries.filter(
        (entry) => !isBlockingRootDirtyEntry(entry)
    );
    const authoredCount = countAuthoredEntries(blockingDirtyEntries);
    const aheadBehind = getAheadBehind(mainRoot, remoteRef);
    let state = 'ready';
    let resetApplied = false;

    if (branch !== policy.root_branch) {
        state = 'root_dirty';
    } else if (blockingDirtyEntries.length > 0) {
        state = 'root_dirty';
    } else if (managedDirtyEntries.length === 0) {
        runGit(mainRoot, ['reset', '--hard', remoteRef]);
        resetApplied = true;
    }

    return {
        kind: 'root',
        task_id: null,
        path: normalizePathValue(mainRoot),
        branch,
        head: readHeadSha(mainRoot),
        origin_main_head: originHead,
        sync_state: state,
        dirty_total: Number(diagnosis?.dirty_total || 0),
        authored_total: authoredCount,
        managed_dirty_total: managedDirtyEntries.length,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        reset_applied: resetApplied,
        diagnosis: summarizeDiagnosis(diagnosis),
    };
}

function maybeAbortRebase(worktreePath) {
    const result = runGit(worktreePath, ['rebase', '--abort'], {
        allowFailure: true,
    });
    return result.ok;
}

function alignTaskWorktree(worktreePath, taskId, branch, policy) {
    const expectedBranch = buildExpectedTaskBranch(taskId, policy);
    const remoteRef = `${policy.remote}/${policy.root_branch}`;
    let diagnosis = diagnoseWorktree(worktreePath, {
        scopeTaskId: taskId,
    });
    diagnosis = cleanupWorktreeIfFixable(worktreePath, diagnosis, taskId);
    const dirtyEntries = Array.isArray(diagnosis?.dirtyEntries)
        ? diagnosis.dirtyEntries
        : [];
    const blockingDirtyEntries = dirtyEntries.filter(isBlockingTaskDirtyEntry);
    const authoredCount = countAuthoredEntries(blockingDirtyEntries);
    const blockingNonAuthoredTotal = blockingDirtyEntries.filter(
        (entry) => String(entry?.category || '').trim() !== 'authored'
    ).length;
    const mixedLane = hasBlockingTaskLaneDrift(blockingDirtyEntries);
    let aheadBehind = getAheadBehind(worktreePath, remoteRef);
    let state = 'ready';
    let rebaseApplied = false;
    let rebaseFailed = false;

    if (branch !== expectedBranch) {
        state = 'branch_invalid';
    } else if (blockingNonAuthoredTotal > 0) {
        state = 'blocked_mixed_lane';
    } else if (mixedLane) {
        state = 'blocked_mixed_lane';
    } else if (authoredCount > 0 && aheadBehind.behind > 0) {
        state = 'rebase_required';
    } else if (authoredCount === 0 && aheadBehind.behind > 0) {
        const rebaseResult = runGit(
            worktreePath,
            ['rebase', remoteRef],
            { allowFailure: true }
        );
        if (rebaseResult.ok) {
            rebaseApplied = true;
            aheadBehind = getAheadBehind(worktreePath, remoteRef);
            state = aheadBehind.behind > 0 ? 'rebase_required' : 'ready';
        } else {
            maybeAbortRebase(worktreePath);
            rebaseFailed = true;
            state = 'rebase_required';
        }
    }

    return {
        kind: 'task',
        task_id: taskId,
        path: normalizePathValue(worktreePath),
        branch,
        expected_branch: expectedBranch,
        head: readHeadSha(worktreePath),
        origin_main_head: readHeadSha(worktreePath, `refs/remotes/${remoteRef}`),
        sync_state: state,
        dirty_total: Number(diagnosis?.dirty_total || 0),
        authored_total: authoredCount,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        rebase_applied: rebaseApplied,
        rebase_failed: rebaseFailed,
        mixed_lane: mixedLane,
        diagnosis: summarizeDiagnosis(diagnosis),
    };
}

function buildWorkspaceSnapshot(rootInfo, mainRow, taskRows, policy, machineId) {
    const checkedAt = new Date().toISOString();
    const blockingStates = new Set([
        'root_dirty',
        'branch_invalid',
        'blocked_mixed_lane',
        'rebase_required',
    ]);
    const blockingTaskRows = taskRows.filter((row) =>
        blockingStates.has(String(row.sync_state || '').trim())
    );
    return {
        version: 1,
        checked_at: checkedAt,
        machine_id: machineId,
        repo_root: normalizePathValue(rootInfo.main_root),
        current_root: normalizePathValue(rootInfo.current_root),
        policy: {
            ttl_minutes: policy.ttl_minutes,
            watcher_interval_seconds: policy.watcher_interval_seconds,
            remote: policy.remote,
            root_branch: policy.root_branch,
            task_branch_prefix: policy.task_branch_prefix,
        },
        root: mainRow,
        tasks: taskRows,
        summary: {
            task_worktrees_total: taskRows.length,
            blocking_task_worktrees: blockingTaskRows.length,
            ready_task_worktrees: taskRows.filter(
                (row) => String(row.sync_state || '').trim() === 'ready'
            ).length,
        },
        ok:
            String(mainRow?.sync_state || '').trim() === 'ready' &&
            blockingTaskRows.length === 0,
    };
}

function listManagedTaskWorktrees(rootInfo, policy) {
    return listWorktrees(rootInfo.main_root)
        .filter((row) => !row.prunable)
        .filter(
            (row) =>
                isPathWithin(rootInfo.worktrees_dir, row.path) ||
                String(row.branch || '').trim().startsWith(policy.task_branch_prefix)
        )
        .map((row) => path.resolve(row.path));
}

function runWorkspaceSync(options = {}) {
    const cwd = path.resolve(options.cwd || process.cwd());
    const governancePolicy = options.governancePolicy || null;
    const policy = normalizeWorkspaceSyncPolicy(governancePolicy);
    const rootInfo = resolveWorkspaceRoots(cwd, policy);
    ensureDirectory(rootInfo.local_dir);
    ensureDirectory(rootInfo.worktrees_dir);
    const machineId = ensureMachineId(rootInfo.local_dir, policy);

    runGit(rootInfo.main_root, ['fetch', policy.remote, '--prune']);
    runGit(rootInfo.main_root, ['worktree', 'prune'], { allowFailure: true });

    const mainRow = alignMainRoot(rootInfo.main_root, policy);
    const listedWorktrees = listWorktrees(rootInfo.main_root);
    const managedTaskRows = listedWorktrees
        .filter((row) => !row.prunable)
        .filter((row) => normalizePathValue(row.path) !== normalizePathValue(rootInfo.main_root))
        .filter(
            (row) =>
                isPathWithin(rootInfo.worktrees_dir, row.path) ||
                String(row.branch || '').trim().startsWith(policy.task_branch_prefix)
        )
        .map((row) => {
            const taskId = inferTaskIdFromWorktree(row, policy);
            return alignTaskWorktree(
                path.resolve(row.path),
                taskId,
                String(row.branch || '').trim(),
                policy
            );
        })
        .sort((left, right) =>
            String(left.task_id || '').localeCompare(String(right.task_id || ''))
        );

    const snapshot = buildWorkspaceSnapshot(
        rootInfo,
        mainRow,
        managedTaskRows,
        policy,
        machineId
    );
    writeWorkspaceStatus(
        getWorkspaceStatusPath(rootInfo.local_dir, policy),
        snapshot
    );
    return snapshot;
}

function mirrorBoardAcrossManagedWorktrees(options = {}) {
    const cwd = path.resolve(options.cwd || process.cwd());
    const sourceRoot = path.resolve(options.sourceRoot || cwd);
    const boardPath = String(options.boardPath || 'AGENT_BOARD.yaml').trim();
    const governancePolicy = options.governancePolicy || null;
    const policy = normalizeWorkspaceSyncPolicy(governancePolicy);
    const rootInfo = resolveWorkspaceRoots(cwd, policy);
    const sourceBoardPath = path.resolve(sourceRoot, boardPath);
    if (!fs.existsSync(sourceBoardPath)) {
        return {
            ok: false,
            mirrored_total: 0,
            mirrored_paths: [],
            source_board_path: normalizePathValue(sourceBoardPath),
        };
    }
    const boardContent = fs.readFileSync(sourceBoardPath, 'utf8');
    const targetRoots = [
        rootInfo.main_root,
        ...listManagedTaskWorktrees(rootInfo, policy),
    ];
    const mirroredPaths = [];
    for (const targetRoot of targetRoots) {
        if (
            normalizePathValue(path.resolve(targetRoot)) ===
            normalizePathValue(sourceRoot)
        ) {
            continue;
        }
        const targetBoardPath = path.resolve(targetRoot, boardPath);
        fs.writeFileSync(targetBoardPath, boardContent, 'utf8');
        mirroredPaths.push(normalizePathValue(targetBoardPath));
    }
    return {
        ok: true,
        mirrored_total: mirroredPaths.length,
        mirrored_paths: mirroredPaths,
        source_board_path: normalizePathValue(sourceBoardPath),
    };
}

function ensureTaskWorktree(taskId, options = {}) {
    const cwd = path.resolve(options.cwd || process.cwd());
    const policy = normalizeWorkspaceSyncPolicy(options.governancePolicy || null);
    const rootInfo = resolveWorkspaceRoots(cwd, policy);
    ensureDirectory(rootInfo.local_dir);
    ensureDirectory(rootInfo.worktrees_dir);
    const snapshotBefore = runWorkspaceSync({
        cwd,
        governancePolicy: options.governancePolicy,
    });
    if (String(snapshotBefore?.root?.sync_state || '').trim() !== 'ready') {
        const error = new Error(
            `workspace root no esta listo (${snapshotBefore?.root?.sync_state || 'unknown'})`
        );
        error.code = 'workspace_root_not_ready';
        error.error_code = 'workspace_root_not_ready';
        error.workspace_snapshot = snapshotBefore;
        throw error;
    }

    const expectedBranch = buildExpectedTaskBranch(taskId, policy);
    const worktreePath = path.resolve(rootInfo.worktrees_dir, taskId);
    const existingRow = snapshotBefore.tasks.find(
        (row) =>
            String(row.task_id || '').trim() === String(taskId || '').trim() ||
            normalizePathValue(row.path) === normalizePathValue(worktreePath)
    );

    if (!existingRow) {
        const branchExists = runGit(
            rootInfo.main_root,
            ['show-ref', '--verify', '--quiet', `refs/heads/${expectedBranch}`],
            { allowFailure: true }
        ).ok;
        if (fs.existsSync(worktreePath) && !fs.existsSync(path.join(worktreePath, '.git'))) {
            const error = new Error(
                `ya existe ${normalizePathValue(worktreePath)} y no es un git worktree reutilizable`
            );
            error.code = 'workspace_worktree_path_conflict';
            error.error_code = 'workspace_worktree_path_conflict';
            throw error;
        }
        const addArgs = branchExists
            ? ['worktree', 'add', worktreePath, expectedBranch]
            : [
                  'worktree',
                  'add',
                  '-b',
                  expectedBranch,
                  worktreePath,
                  `${policy.remote}/${policy.root_branch}`,
              ];
        runGit(rootInfo.main_root, addArgs);
    }

    const snapshotAfter = runWorkspaceSync({
        cwd,
        governancePolicy: options.governancePolicy,
    });
    const taskRow = snapshotAfter.tasks.find(
        (row) => String(row.task_id || '').trim() === String(taskId || '').trim()
    );
    if (!taskRow) {
        const error = new Error(`no se pudo preparar worktree para ${taskId}`);
        error.code = 'workspace_task_worktree_missing';
        error.error_code = 'workspace_task_worktree_missing';
        error.workspace_snapshot = snapshotAfter;
        throw error;
    }
    if (!['ready'].includes(String(taskRow.sync_state || '').trim())) {
        const error = new Error(
            `worktree de ${taskId} no quedo listo (${taskRow.sync_state})`
        );
        error.code = 'workspace_task_not_ready';
        error.error_code = 'workspace_task_not_ready';
        error.workspace_snapshot = snapshotAfter;
        throw error;
    }
    return {
        worktree_path: taskRow.path,
        task_row: taskRow,
        snapshot: snapshotAfter,
        machine_id: snapshotAfter.machine_id,
    };
}

function captureTaskWorkspace(taskId, options = {}) {
    const snapshot = runWorkspaceSync(options);
    const taskRow = (Array.isArray(snapshot?.tasks) ? snapshot.tasks : []).find(
        (row) => String(row.task_id || '').trim() === String(taskId || '').trim()
    );
    if (!taskRow) {
        const error = new Error(`no existe worktree activo para ${taskId}`);
        error.code = 'workspace_task_worktree_missing';
        error.error_code = 'workspace_task_worktree_missing';
        error.workspace_snapshot = snapshot;
        throw error;
    }
    return {
        machine_id: snapshot.machine_id,
        snapshot,
        task_row: taskRow,
    };
}

function applyWorkspaceTaskSnapshot(task, capture) {
    if (!task || typeof task !== 'object') return task;
    const taskRow = capture?.task_row || {};
    const snapshot = capture?.snapshot || {};
    task.workspace_machine_id = String(capture?.machine_id || snapshot.machine_id || '').trim();
    task.workspace_branch = String(taskRow.branch || '').trim();
    task.workspace_head = String(taskRow.head || '').trim();
    task.workspace_origin_main_head = String(
        taskRow.origin_main_head || snapshot?.root?.origin_main_head || ''
    ).trim();
    task.workspace_sync_state = String(taskRow.sync_state || '').trim();
    task.workspace_sync_checked_at = String(snapshot.checked_at || '').trim();
    return task;
}

function parseIsoMs(value) {
    const parsed = Date.parse(String(value || '').trim());
    return Number.isFinite(parsed) ? parsed : null;
}

function loadWorkspaceSnapshot(options = {}) {
    const cwd = path.resolve(options.cwd || process.cwd());
    const policy = normalizeWorkspaceSyncPolicy(options.governancePolicy || null);
    const rootInfo = resolveWorkspaceRoots(cwd, policy);
    const statusPath = getWorkspaceStatusPath(rootInfo.local_dir, policy);
    return {
        policy,
        root_info: rootInfo,
        status_path: statusPath,
        snapshot: readWorkspaceStatus(statusPath),
    };
}

function buildComplianceFinding(code, task, message, extra = {}) {
    return {
        code,
        task_id: String(task?.id || '').trim(),
        message,
        severity: 'error',
        ...extra,
    };
}

function collectWorkspaceComplianceFindings(tasks = [], options = {}) {
    const governancePolicy = options.governancePolicy || null;
    const policy = normalizeWorkspaceSyncPolicy(governancePolicy);
    if (!policy.enabled) {
        return [];
    }
    const nowMs = parseIsoMs(options.nowIso || new Date().toISOString()) || Date.now();
    const ttlMs = policy.ttl_minutes * 60 * 1000;
    let currentSnapshot = options.snapshot || null;
    if (!currentSnapshot) {
        try {
            currentSnapshot = loadWorkspaceSnapshot({
                cwd: options.cwd,
                governancePolicy,
            }).snapshot;
        } catch {
            currentSnapshot = null;
        }
    }
    const currentOriginHead = String(
        options.currentOriginMainHead ||
            currentSnapshot?.root?.origin_main_head ||
            ''
    ).trim();

    const findings = [];
    for (const task of Array.isArray(tasks) ? tasks : []) {
        if (
            String(task?.executor || '').trim().toLowerCase() !== 'codex' ||
            !ACTIVE_TASK_STATUSES.has(String(task?.status || '').trim())
        ) {
            continue;
        }
        const taskId = String(task?.id || '').trim();
        const hasWorkspaceSnapshotFields = Boolean(
            String(task?.workspace_machine_id || '').trim() ||
                String(task?.workspace_branch || '').trim() ||
                String(task?.workspace_head || '').trim() ||
                String(task?.workspace_origin_main_head || '').trim() ||
                String(task?.workspace_sync_state || '').trim() ||
                String(task?.workspace_sync_checked_at || '').trim()
        );
        if (!hasWorkspaceSnapshotFields) {
            continue;
        }
        const checkedAt = parseIsoMs(task?.workspace_sync_checked_at);
        if (checkedAt === null || nowMs - checkedAt > ttlMs) {
            findings.push(
                buildComplianceFinding(
                    'workspace_sync_stale',
                    task,
                    `${taskId}: snapshot local de workspace vencido o ausente`,
                    {
                        workspace_sync_checked_at: String(
                            task?.workspace_sync_checked_at || ''
                        ).trim(),
                    }
                )
            );
            continue;
        }

        const expectedBranch = buildExpectedTaskBranch(taskId, policy);
        const workspaceBranch = String(task?.workspace_branch || '').trim();
        if (workspaceBranch !== expectedBranch) {
            findings.push(
                buildComplianceFinding(
                    'workspace_branch_invalid',
                    task,
                    `${taskId}: branch de workspace invalido (${workspaceBranch || 'vacio'} != ${expectedBranch})`,
                    {
                        expected_branch: expectedBranch,
                        actual_branch: workspaceBranch,
                    }
                )
            );
        }

        const syncState = String(task?.workspace_sync_state || '').trim();
        if (syncState === 'root_dirty') {
            findings.push(
                buildComplianceFinding(
                    'workspace_root_dirty',
                    task,
                    `${taskId}: root espejo de main esta sucio o fuera de policy`
                )
            );
        }
        if (syncState === 'blocked_mixed_lane') {
            findings.push(
                buildComplianceFinding(
                    'workspace_task_mixed_lane',
                    task,
                    `${taskId}: worktree de tarea tiene authored mixed-lane u out-of-scope`
                )
            );
        }
        if (
            syncState === 'rebase_required' ||
            (currentOriginHead &&
                String(task?.workspace_origin_main_head || '').trim() &&
                String(task.workspace_origin_main_head).trim() !==
                    currentOriginHead)
        ) {
            findings.push(
                buildComplianceFinding(
                    'workspace_main_behind',
                    task,
                    `${taskId}: worktree quedo atras de ${policy.remote}/${policy.root_branch}`,
                    {
                        expected_origin_main_head: currentOriginHead,
                        task_origin_main_head: String(
                            task?.workspace_origin_main_head || ''
                        ).trim(),
                    }
                )
            );
        }
    }
    return findings;
}

function buildWorkspaceComplianceDiagnostics(tasks = [], options = {}) {
    const findings = collectWorkspaceComplianceFindings(tasks, options);
    const makeDiagnostic = options.makeDiagnostic || ((value) => value);
    return findings.map((finding) =>
        makeDiagnostic({
            code: `warn.workspace.${finding.code}`,
            severity: 'error',
            source: String(options.source || 'status').trim() || 'status',
            message: finding.message,
            task_ids: [finding.task_id],
            meta: finding,
        })
    );
}

function installWorkspaceWatcherTask(options = {}) {
    if (process.platform !== 'win32') {
        return {
            installed: false,
            skipped: true,
            reason: 'platform_not_supported',
        };
    }
    const rootPath = path.resolve(options.rootPath || process.cwd());
    const policy = normalizeWorkspaceSyncPolicy(options.governancePolicy || null);
    const scriptPath = path.resolve(rootPath, policy.watcher_script_path);
    const commandText = `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" -RepoRoot "${rootPath}"`;
    const result = runCommand('schtasks', [
        '/Create',
        '/F',
        '/SC',
        'MINUTE',
        '/MO',
        String(policy.watcher_interval_seconds >= 60 ? Math.round(policy.watcher_interval_seconds / 60) : 1),
        '/TN',
        policy.watcher_task_name,
        '/TR',
        commandText,
    ]);
    return {
        installed: result.ok,
        skipped: false,
        reason: result.ok ? '' : 'schtasks_failed',
        command: result.command,
        stdout: result.stdout,
        stderr: result.stderr,
    };
}

function buildBootstrapReport(options = {}) {
    const cwd = path.resolve(options.cwd || process.cwd());
    const governancePolicy = options.governancePolicy || null;
    const policy = normalizeWorkspaceSyncPolicy(governancePolicy);
    const roots = resolveWorkspaceRoots(cwd, policy);
    ensureDirectory(roots.local_dir);
    ensureDirectory(roots.worktrees_dir);
    const machineId = ensureMachineId(roots.local_dir, policy);
    const snapshot = runWorkspaceSync({ cwd, governancePolicy });
    return {
        version: 1,
        ok: Boolean(snapshot?.ok),
        command: 'workspace bootstrap',
        machine_id: machineId,
        repo_root: normalizePathValue(roots.main_root),
        local_dir: normalizePathValue(roots.local_dir),
        worktrees_dir: normalizePathValue(roots.worktrees_dir),
        snapshot,
    };
}

function repairWorkspace(options = {}) {
    const cwd = path.resolve(options.cwd || process.cwd());
    const governancePolicy = options.governancePolicy || null;
    const policy = normalizeWorkspaceSyncPolicy(governancePolicy);
    const taskId = String(options.taskId || '').trim();
    const snapshot = runWorkspaceSync({ cwd, governancePolicy });
    const targetPath =
        taskId &&
        Array.isArray(snapshot?.tasks) &&
        snapshot.tasks.find((row) => String(row.task_id || '').trim() === taskId)?.path
            ? snapshot.tasks.find((row) => String(row.task_id || '').trim() === taskId).path
            : cwd;
    let diagnosis = diagnoseWorktree(targetPath, {
        scopeTaskId: taskId || '',
    });
    if (String(diagnosis?.overall_state || '').trim() === 'fixable') {
        diagnosis = fixWorkspace(targetPath, {
            includeDerivedQueue: true,
            scopeTaskId: taskId || '',
        });
    }
    return {
        version: 1,
        ok: ['clean', 'attention'].includes(
            String(diagnosis?.overall_state || '').trim()
        ),
        command: 'workspace repair',
        task_id: taskId || null,
        path: normalizePathValue(targetPath),
        diagnosis,
        snapshot,
    };
}

module.exports = {
    ACTIVE_TASK_STATUSES,
    applyWorkspaceTaskSnapshot,
    buildBootstrapReport,
    buildExpectedTaskBranch,
    buildWorkspaceComplianceDiagnostics,
    captureTaskWorkspace,
    collectWorkspaceComplianceFindings,
    ensureTaskWorktree,
    getWorkspaceStatusPath,
    installWorkspaceWatcherTask,
    loadWorkspaceSnapshot,
    mirrorBoardAcrossManagedWorktrees,
    normalizeWorkspaceSyncPolicy,
    readWorkspaceStatus,
    repairWorkspace,
    resolveWorkspaceRoots,
    runWorkspaceSync,
    writeWorkspaceStatus,
};
