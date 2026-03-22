'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
    buildDoctorPayload,
    collectWorkspaceDoctor,
    DOCTOR_STATE_ATTENTION,
    DOCTOR_STATE_BLOCKED,
    DOCTOR_STATE_CLEAN,
    DOCTOR_STATE_ERROR,
    DOCTOR_STATE_FIXABLE,
    loadBoardForScope,
} = require('../../../bin/lib/workspace-hygiene.js');
const { serializeBoard } = require('../core/serializers');

const FUNCTIONAL_TASK_IGNORED_FIELDS = new Set([
    'created_at',
    'updated_at',
    'status_since_at',
    'last_attempt_at',
    'lease_id',
    'lease_owner',
    'lease_created_at',
    'heartbeat_at',
    'lease_expires_at',
    'lease_reason',
    'lease_cleared_at',
    'lease_cleared_reason',
]);

function normalizePathValue(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/');
}

function normalizeStrategySubfront(subfront = {}) {
    return {
        ...subfront,
        codex_instance: String(subfront.codex_instance || '')
            .trim()
            .toLowerCase(),
        subfront_id: String(subfront.subfront_id || '').trim(),
        title: String(subfront.title || '').trim(),
        allowed_scopes: Array.isArray(subfront.allowed_scopes)
            ? [...subfront.allowed_scopes].map((value) =>
                  String(value || '')
                      .trim()
                      .toLowerCase()
              )
            : [],
        support_only_scopes: Array.isArray(subfront.support_only_scopes)
            ? [...subfront.support_only_scopes].map((value) =>
                  String(value || '')
                      .trim()
                      .toLowerCase()
              )
            : [],
        blocked_scopes: Array.isArray(subfront.blocked_scopes)
            ? [...subfront.blocked_scopes].map((value) =>
                  String(value || '')
                      .trim()
                      .toLowerCase()
              )
            : [],
        wip_limit: String(subfront.wip_limit || '').trim(),
        default_acceptance_profile: String(
            subfront.default_acceptance_profile || ''
        ).trim(),
        exception_ttl_hours: String(subfront.exception_ttl_hours || '').trim(),
    };
}

function normalizeStrategyRecord(strategy = null, options = {}) {
    if (!strategy || typeof strategy !== 'object') {
        return null;
    }
    const functional = options.functional === true;
    const out = {
        id: String(strategy.id || '').trim(),
        title: String(strategy.title || '').trim(),
        objective: String(strategy.objective || '').trim(),
        owner: String(strategy.owner || '').trim(),
        owner_policy: String(strategy.owner_policy || '').trim(),
        status: String(strategy.status || '')
            .trim()
            .toLowerCase(),
        started_at: String(strategy.started_at || '').trim(),
        review_due_at: String(strategy.review_due_at || '').trim(),
        closed_at: String(strategy.closed_at || '').trim(),
        close_reason: String(strategy.close_reason || '').trim(),
        exit_criteria: Array.isArray(strategy.exit_criteria)
            ? [...strategy.exit_criteria].map((value) => String(value || '').trim())
            : [],
        success_signal: String(strategy.success_signal || '').trim(),
        focus_id: String(strategy.focus_id || '').trim(),
        focus_title: String(strategy.focus_title || '').trim(),
        focus_summary: String(strategy.focus_summary || '').trim(),
        focus_status: String(strategy.focus_status || '')
            .trim()
            .toLowerCase(),
        focus_proof: String(strategy.focus_proof || '').trim(),
        focus_steps: Array.isArray(strategy.focus_steps)
            ? [...strategy.focus_steps].map((value) => String(value || '').trim())
            : [],
        focus_next_step: String(strategy.focus_next_step || '').trim(),
        focus_required_checks: Array.isArray(strategy.focus_required_checks)
            ? [...strategy.focus_required_checks].map((value) =>
                  String(value || '')
                      .trim()
                      .toLowerCase()
              )
            : [],
        focus_non_goals: Array.isArray(strategy.focus_non_goals)
            ? [...strategy.focus_non_goals].map((value) => String(value || '').trim())
            : [],
        focus_owner: String(strategy.focus_owner || '').trim(),
        focus_review_due_at: String(strategy.focus_review_due_at || '').trim(),
        focus_evidence_ref: String(strategy.focus_evidence_ref || '').trim(),
        focus_max_active_slices: String(
            strategy.focus_max_active_slices || ''
        ).trim(),
        subfronts: Array.isArray(strategy.subfronts)
            ? strategy.subfronts
                  .map((subfront) => normalizeStrategySubfront(subfront))
                  .sort((left, right) =>
                      String(left.subfront_id || '').localeCompare(
                          String(right.subfront_id || '')
                      )
                  )
            : [],
    };
    if (!functional) {
        out.updated_at = String(strategy.updated_at || '').trim();
    }
    return out;
}

function normalizeTaskForFingerprint(task = {}, options = {}) {
    const functional = options.functional === true;
    const out = {};
    for (const [key, value] of Object.entries(task || {})) {
        if (functional && FUNCTIONAL_TASK_IGNORED_FIELDS.has(key)) {
            continue;
        }
        if (key === 'files' || key === 'depends_on') {
            out[key] = Array.isArray(value)
                ? [...value]
                      .map((entry) => String(entry || '').trim())
                      .filter(Boolean)
                      .sort()
                : [];
            continue;
        }
        out[key] = value;
    }
    return out;
}

function normalizeBoardForFingerprint(board = null, options = {}) {
    const functional = options.functional === true;
    const safeBoard =
        board && typeof board === 'object'
            ? board
            : { version: 1, policy: {}, strategy: {}, tasks: [] };
    return {
        version: Number(safeBoard.version || 1),
        policy: {
            canonical: String(safeBoard?.policy?.canonical || '').trim(),
            autonomy: String(safeBoard?.policy?.autonomy || '').trim(),
            kpi: String(safeBoard?.policy?.kpi || '').trim(),
            codex_partition_model: String(
                safeBoard?.policy?.codex_partition_model || ''
            ).trim(),
            codex_backend_instance: String(
                safeBoard?.policy?.codex_backend_instance || ''
            ).trim(),
            codex_frontend_instance: String(
                safeBoard?.policy?.codex_frontend_instance || ''
            ).trim(),
            codex_transversal_instance: String(
                safeBoard?.policy?.codex_transversal_instance || ''
            ).trim(),
            ...(functional
                ? {}
                : {
                      revision: Number(safeBoard?.policy?.revision || 0),
                      updated_at: String(
                          safeBoard?.policy?.updated_at || ''
                      ).trim(),
                  }),
        },
        strategy: {
            active: normalizeStrategyRecord(safeBoard?.strategy?.active, {
                functional,
            }),
            next: normalizeStrategyRecord(safeBoard?.strategy?.next, {
                functional,
            }),
            ...(functional
                ? {}
                : {
                      updated_at: String(
                          safeBoard?.strategy?.updated_at || ''
                      ).trim(),
                  }),
        },
        tasks: (Array.isArray(safeBoard?.tasks) ? safeBoard.tasks : [])
            .map((task) => normalizeTaskForFingerprint(task, { functional }))
            .sort((left, right) =>
                String(left.id || '').localeCompare(String(right.id || ''))
            ),
    };
}

function stableSortDeep(value) {
    if (Array.isArray(value)) {
        return value.map((entry) => stableSortDeep(entry));
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.keys(value)
                .sort((left, right) => left.localeCompare(right))
                .map((key) => [key, stableSortDeep(value[key])])
        );
    }
    return value;
}

function fingerprintOf(value) {
    return crypto
        .createHash('sha1')
        .update(JSON.stringify(stableSortDeep(value)))
        .digest('hex');
}

function getBoardRevision(board = null) {
    const parsed = Number(String(board?.policy?.revision || '').trim());
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function getActiveTaskIds(board = null) {
    return (Array.isArray(board?.tasks) ? board.tasks : [])
        .filter((task) =>
            ['ready', 'in_progress', 'review', 'blocked'].includes(
                String(task?.status || '')
                    .trim()
                    .toLowerCase()
            )
        )
        .map((task) => String(task?.id || '').trim())
        .filter(Boolean)
        .sort();
}

function buildBoardSnapshot(rootPath, row) {
    const boardInfo = loadBoardForScope(rootPath);
    const board = boardInfo.board;
    const safePath = normalizePathValue(rootPath);
    if (!board) {
        return {
            path: safePath,
            branch: String(row?.branch || '').trim(),
            overall_state: String(row?.overall_state || '').trim(),
            dirty_total: Number(row?.dirty_total || 0),
            board_available: false,
            board_error: String(boardInfo.error || '').trim() || null,
            board_path: normalizePathValue(boardInfo.boardPath || ''),
            board_revision: 0,
            active_task_ids: [],
            functional_fingerprint: '',
            full_fingerprint: '',
            board: null,
        };
    }
    const functionalPayload = normalizeBoardForFingerprint(board, {
        functional: true,
    });
    const fullPayload = normalizeBoardForFingerprint(board, {
        functional: false,
    });
    return {
        path: safePath,
        branch: String(row?.branch || '').trim(),
        overall_state: String(row?.overall_state || '').trim(),
        dirty_total: Number(row?.dirty_total || 0),
        board_available: true,
        board_error: null,
        board_path: normalizePathValue(boardInfo.boardPath || ''),
        board_revision: getBoardRevision(board),
        active_task_ids: getActiveTaskIds(board),
        functional_fingerprint: fingerprintOf(functionalPayload),
        full_fingerprint: fingerprintOf(fullPayload),
        board,
    };
}

function summarizeRowForTruth(row = {}) {
    return {
        path: normalizePathValue(row.path || ''),
        branch: String(row.branch || '').trim(),
        overall_state: String(row.overall_state || '').trim(),
        dirty_total: Number(row.dirty_total || 0),
        next_command: String(row.next_command || '').trim(),
        scope_context: row.scope_context || null,
        strategy_context: row.strategy_context || null,
        lane_context: row.lane_context || null,
        issue_counts: row.issue_counts || {},
        scope_counts: row.scope_counts || {},
        strategy_counts: row.strategy_counts || {},
        lane_counts: row.lane_counts || {},
        remediation_plan: Array.isArray(row.remediation_plan)
            ? row.remediation_plan
            : [],
    };
}

function selectCanonicalBoard(rows = [], cwd, explicitCanonicalRoot = '') {
    const normalizedCwd = normalizePathValue(cwd);
    const normalizedExplicit = normalizePathValue(explicitCanonicalRoot);
    const safeRows = [...rows];

    if (normalizedExplicit) {
        const explicitMatch = safeRows.find(
            (row) => row.path === normalizedExplicit && row.board_available
        );
        if (!explicitMatch) {
            const error = new Error(
                `workspace truth: --canonical-root invalido (${explicitCanonicalRoot})`
            );
            error.code = 'workspace_truth_invalid_canonical_root';
            error.error_code = 'workspace_truth_invalid_canonical_root';
            throw error;
        }
        return {
            row: explicitMatch,
            source: 'explicit',
            reason: `canonical_root forzado por --canonical-root (${explicitMatch.path})`,
        };
    }

    const cwdMain = safeRows.find(
        (row) =>
            row.path === normalizedCwd &&
            String(row.branch || '').trim() === 'main' &&
            row.board_available
    );
    if (cwdMain) {
        return {
            row: cwdMain,
            source: 'cwd_main',
            reason: 'cwd pertenece al worktree main; se toma como canon',
        };
    }

    const mainCandidates = safeRows
        .filter(
            (row) =>
                String(row.branch || '').trim() === 'main' && row.board_available
        )
        .sort((left, right) => {
            const byRevision =
                Number(right.board_revision || 0) -
                Number(left.board_revision || 0);
            if (byRevision !== 0) {
                return byRevision;
            }
            return String(left.path || '').localeCompare(String(right.path || ''));
        });
    if (mainCandidates.length > 0) {
        return {
            row: mainCandidates[0],
            source: 'main_highest_revision',
            reason: `se usa el worktree main con mayor revision (${mainCandidates[0].board_revision})`,
        };
    }

    const highestRevision = safeRows
        .filter((row) => row.board_available)
        .sort((left, right) => {
            const byRevision =
                Number(right.board_revision || 0) -
                Number(left.board_revision || 0);
            if (byRevision !== 0) {
                return byRevision;
            }
            return String(left.path || '').localeCompare(String(right.path || ''));
        })[0];
    if (highestRevision) {
        return {
            row: highestRevision,
            source: 'global_highest_revision',
            reason: `no existe worktree main elegible; se usa la mayor revision global (${highestRevision.board_revision})`,
        };
    }

    return {
        row: null,
        source: 'unavailable',
        reason: 'no se encontro AGENT_BOARD.yaml legible en ningun worktree',
    };
}

function diffBoardsByTask(canonicalBoard, candidateBoard) {
    const canonicalTasks = new Map(
        (Array.isArray(canonicalBoard?.tasks) ? canonicalBoard.tasks : []).map(
            (task) => [
                String(task?.id || '').trim(),
                normalizeTaskForFingerprint(task, { functional: true }),
            ]
        )
    );
    const candidateTasks = new Map(
        (Array.isArray(candidateBoard?.tasks) ? candidateBoard.tasks : []).map(
            (task) => [
                String(task?.id || '').trim(),
                normalizeTaskForFingerprint(task, { functional: true }),
            ]
        )
    );

    const missingTaskIds = [];
    const extraTaskIds = [];
    const divergentTaskIds = [];

    for (const taskId of canonicalTasks.keys()) {
        if (!candidateTasks.has(taskId)) {
            missingTaskIds.push(taskId);
            continue;
        }
        const canonicalTask = canonicalTasks.get(taskId);
        const candidateTask = candidateTasks.get(taskId);
        if (
            JSON.stringify(stableSortDeep(canonicalTask)) !==
            JSON.stringify(stableSortDeep(candidateTask))
        ) {
            divergentTaskIds.push(taskId);
        }
    }
    for (const taskId of candidateTasks.keys()) {
        if (!canonicalTasks.has(taskId)) {
            extraTaskIds.push(taskId);
        }
    }

    const isActiveTaskId = (board, taskId) => {
        const task = (Array.isArray(board?.tasks) ? board.tasks : []).find(
            (candidate) => String(candidate?.id || '').trim() === taskId
        );
        return ['ready', 'in_progress', 'review', 'blocked'].includes(
            String(task?.status || '')
                .trim()
                .toLowerCase()
        );
    };

    return {
        missing_task_ids: missingTaskIds.sort(),
        extra_task_ids: extraTaskIds.sort(),
        divergent_task_ids: divergentTaskIds.sort(),
        missing_active_task_ids: missingTaskIds
            .filter((taskId) => isActiveTaskId(canonicalBoard, taskId))
            .sort(),
        extra_active_task_ids: extraTaskIds
            .filter((taskId) => isActiveTaskId(candidateBoard, taskId))
            .sort(),
        divergent_active_task_ids: divergentTaskIds
            .filter(
                (taskId) =>
                    isActiveTaskId(canonicalBoard, taskId) ||
                    isActiveTaskId(candidateBoard, taskId)
            )
            .sort(),
    };
}

function compareBoardSnapshots(canonicalRow, row) {
    if (!canonicalRow || !canonicalRow.board_available) {
        return {
            path: row.path,
            branch: row.branch,
            board_available: row.board_available,
            relation: 'unavailable',
            functional_match: false,
            full_match: false,
            metadata_only_drift: false,
            blocking: !row.board_available,
            ...(!row.board_available
                ? { board_error: row.board_error }
                : { board_revision: row.board_revision }),
            missing_task_ids: [],
            extra_task_ids: [],
            divergent_task_ids: [],
            missing_active_task_ids: [],
            extra_active_task_ids: [],
            divergent_active_task_ids: [],
        };
    }

    if (!row.board_available) {
        return {
            path: row.path,
            branch: row.branch,
            board_available: false,
            board_error: row.board_error,
            relation: 'missing_board',
            functional_match: false,
            full_match: false,
            metadata_only_drift: false,
            blocking: true,
            missing_task_ids: [],
            extra_task_ids: [],
            divergent_task_ids: [],
            missing_active_task_ids: [],
            extra_active_task_ids: [],
            divergent_active_task_ids: [],
        };
    }

    const fullMatch = canonicalRow.full_fingerprint === row.full_fingerprint;
    const functionalMatch =
        canonicalRow.functional_fingerprint === row.functional_fingerprint;
    const diffs = diffBoardsByTask(canonicalRow.board, row.board);
    const metadataOnlyDrift = functionalMatch && !fullMatch;
    const relation =
        canonicalRow.path === row.path
            ? 'canonical'
            : fullMatch
              ? 'in_sync'
              : metadataOnlyDrift
                ? 'metadata_only_drift'
                : 'diverged';
    return {
        path: row.path,
        branch: row.branch,
        board_available: true,
        board_revision: row.board_revision,
        relation,
        functional_match: functionalMatch,
        full_match: fullMatch,
        metadata_only_drift: metadataOnlyDrift,
        blocking:
            relation === 'missing_board' ||
            relation === 'diverged' ||
            diffs.missing_task_ids.length > 0 ||
            diffs.extra_task_ids.length > 0 ||
            diffs.divergent_task_ids.length > 0,
        ...diffs,
    };
}

function buildBlockingRows(rows = []) {
    return rows
        .filter((row) =>
            [DOCTOR_STATE_BLOCKED, DOCTOR_STATE_ERROR].includes(
                String(row?.overall_state || '').trim()
            )
        )
        .map((row) => summarizeRowForTruth(row));
}

function buildMixedLaneRows(rows = []) {
    return rows
        .filter(
            (row) =>
                String(row?.lane_context?.resolution || '').trim() === 'mixed_lane'
        )
        .map((row) => summarizeRowForTruth(row));
}

function buildOutOfScopeRows(rows = []) {
    return rows
        .filter((row) => Number(row?.scope_counts?.out_of_scope || 0) > 0)
        .map((row) => summarizeRowForTruth(row));
}

function buildRemediationPlan(workspaceTruth, workspaceRows = []) {
    const seen = new Set();
    const plan = [];

    function pushStep(id, summary, command) {
        const key = `${id}\u0000${command}`;
        if (seen.has(key)) return;
        seen.add(key);
        plan.push({ id, summary, command });
    }

    if (workspaceTruth.board_forks_total > 0) {
        pushStep(
            'workspace_board_reconcile_preview',
            'Revisa el fork de AGENT_BOARD.yaml entre worktrees antes de seguir mutando o publicar.',
            'node agent-orchestrator.js board reconcile --json'
        );
    }
    if (workspaceTruth.metadata_only_drift_total > 0) {
        pushStep(
            'workspace_board_reconcile_apply_safe',
            'Alinea drift solo de metadata contra el board canonico.',
            'node agent-orchestrator.js board reconcile --apply-safe --json'
        );
    }

    for (const row of workspaceRows) {
        for (const step of Array.isArray(row?.remediation_plan)
            ? row.remediation_plan
            : []) {
            pushStep(step.id, step.summary, step.command);
        }
    }

    return plan;
}

function resolveWorkspaceTruthState(summary = {}, facts = {}) {
    if (facts.boardForksTotal > 0) {
        return DOCTOR_STATE_BLOCKED;
    }
    if (facts.blockingRowsTotal > 0) {
        return DOCTOR_STATE_BLOCKED;
    }
    if (Number(summary.error_worktrees || 0) > 0) {
        return DOCTOR_STATE_ERROR;
    }
    if (Number(summary.blocked_worktrees || 0) > 0) {
        return DOCTOR_STATE_BLOCKED;
    }
    if (Number(summary.attention_worktrees || 0) > 0) {
        return DOCTOR_STATE_ATTENTION;
    }
    if (Number(summary.fixable_worktrees || 0) > 0) {
        return DOCTOR_STATE_FIXABLE;
    }
    return DOCTOR_STATE_CLEAN;
}

function buildUnavailableWorkspaceTruth(rootPath, error, options = {}) {
    const scope = options.currentOnly ? 'current-only' : 'all-worktrees';
    const workspace_hygiene = {
        version: 1,
        command: 'workspace-hygiene doctor',
        scope,
        available: false,
        ok: true,
        summary: {
            total_worktrees: 0,
            dirty_worktrees: 0,
            blocked_worktrees: 0,
            attention_worktrees: 0,
            fixable_worktrees: 0,
            clean_worktrees: 0,
            error_worktrees: 0,
            issue_totals: {},
        },
        rows: [],
        error: String(error?.message || error || 'workspace_truth_unavailable'),
    };
    return {
        workspace_hygiene,
        workspace_truth: {
            version: 1,
            available: false,
            ok: true,
            scope,
            overall_state: 'unavailable',
            canonical_root: normalizePathValue(rootPath),
            canonical_branch: '',
            canonical_revision: 0,
            canonical_selection: {
                source: 'unavailable',
                reason: 'workspace truth no aplica fuera de un repo git/worktree legible',
            },
            board_forks_total: 0,
            metadata_only_drift_total: 0,
            blocking_rows_total: 0,
            blocking_rows: [],
            mixed_lane_rows_total: 0,
            mixed_lane_rows: [],
            out_of_scope_rows_total: 0,
            out_of_scope_rows: [],
            comparisons: [],
            board_forks: [],
            remediation_plan: [],
            blocking_reasons: [],
            warning_reasons: [],
            summary: workspace_hygiene.summary,
            error: String(error?.message || error || 'workspace_truth_unavailable'),
        },
    };
}

function collectWorkspaceTruth(rootPath, options = {}) {
    const scope = options.currentOnly ? 'current-only' : 'all-worktrees';
    let diagnosis;
    try {
        diagnosis = collectWorkspaceDoctor(rootPath, {
            allWorktrees: options.currentOnly ? false : options.allWorktrees !== false,
            currentOnly: options.currentOnly === true,
            sampleLimit: options.sampleLimit,
            includeEntries: options.includeEntries === true,
        });
    } catch (error) {
        return buildUnavailableWorkspaceTruth(rootPath, error, {
            currentOnly: options.currentOnly === true,
        });
    }

    const workspace_hygiene = {
        ...buildDoctorPayload(diagnosis, {
            command: 'workspace-hygiene doctor',
            includeEntries: options.includeEntries === true,
        }),
        scope,
        available: true,
    };
    const workspaceRows = Array.isArray(diagnosis?.rows) ? diagnosis.rows : [];
    const boardRows = workspaceRows.map((row) =>
        buildBoardSnapshot(row.path, row)
    );
    const canonicalSelection = selectCanonicalBoard(
        boardRows,
        rootPath,
        options.canonicalRoot
    );
    const canonicalRow = canonicalSelection.row;
    const comparisons = boardRows.map((row) =>
        compareBoardSnapshots(canonicalRow, row)
    );
    const boardForks = comparisons.filter(
        (row) =>
            row.relation !== 'canonical' &&
            row.relation !== 'in_sync' &&
            row.metadata_only_drift !== true
    );
    const metadataOnlyDriftRows = comparisons.filter(
        (row) => row.metadata_only_drift === true
    );
    const blockingRows = buildBlockingRows(workspaceRows);
    const mixedLaneRows = buildMixedLaneRows(workspaceRows);
    const outOfScopeRows = buildOutOfScopeRows(workspaceRows);
    const overallState = resolveWorkspaceTruthState(workspace_hygiene.summary, {
        boardForksTotal: boardForks.length,
        blockingRowsTotal: blockingRows.length,
    });
    const ok = ![DOCTOR_STATE_BLOCKED, DOCTOR_STATE_ERROR].includes(
        overallState
    );
    const warningReasons = [];
    const blockingReasons = [];

    if (boardForks.length > 0) {
        blockingReasons.push(`workspace_board_fork:${boardForks.length}`);
    }
    if (blockingRows.length > 0) {
        blockingReasons.push(`workspace_blocked_rows:${blockingRows.length}`);
    }
    if (mixedLaneRows.length > 0) {
        blockingReasons.push(
            `workspace_mixed_lane_authored:${mixedLaneRows.length}`
        );
    }
    if (outOfScopeRows.length > 0) {
        blockingReasons.push(
            `workspace_out_of_scope_authored:${outOfScopeRows.length}`
        );
    }
    if (metadataOnlyDriftRows.length > 0) {
        warningReasons.push(
            `workspace_metadata_only_drift:${metadataOnlyDriftRows.length}`
        );
    }

    const workspace_truth = {
        version: 1,
        available: true,
        ok,
        scope,
        overall_state: overallState,
        canonical_root: canonicalRow
            ? canonicalRow.path
            : normalizePathValue(rootPath),
        canonical_branch: String(canonicalRow?.branch || '').trim(),
        canonical_revision: Number(canonicalRow?.board_revision || 0),
        canonical_selection: {
            source: canonicalSelection.source,
            reason: canonicalSelection.reason,
        },
        summary: workspace_hygiene.summary,
        functional_fingerprint_groups: Array.from(
            new Set(
                boardRows
                    .filter((row) => row.board_available)
                    .map((row) => row.functional_fingerprint)
                    .filter(Boolean)
            )
        ).length,
        board_forks_total: boardForks.length,
        metadata_only_drift_total: metadataOnlyDriftRows.length,
        blocking_rows_total: blockingRows.length,
        blocking_rows: blockingRows,
        mixed_lane_rows_total: mixedLaneRows.length,
        mixed_lane_rows: mixedLaneRows,
        out_of_scope_rows_total: outOfScopeRows.length,
        out_of_scope_rows: outOfScopeRows,
        comparisons,
        board_forks: boardForks,
        remediation_plan: buildRemediationPlan(
            {
                board_forks_total: boardForks.length,
                metadata_only_drift_total: metadataOnlyDriftRows.length,
            },
            workspaceRows
        ),
        blocking_reasons: blockingReasons,
        warning_reasons: warningReasons,
    };

    return {
        workspace_hygiene,
        workspace_truth,
    };
}

function buildWorkspaceTruthDiagnostics(workspaceReport, options = {}) {
    const {
        makeDiagnostic = (value) => value,
        warnPolicyEnabled = () => false,
        warnPolicySeverity = () => 'warning',
        warnPolicyMap = {},
        source = 'status',
    } = options;
    const workspaceTruth =
        workspaceReport?.workspace_truth &&
        typeof workspaceReport.workspace_truth === 'object'
            ? workspaceReport.workspace_truth
            : null;
    if (!workspaceTruth || workspaceTruth.available !== true) {
        return [];
    }

    const diagnostics = [];
    if (
        warnPolicyEnabled(warnPolicyMap, 'workspace_board_fork') &&
        workspaceTruth.board_forks_total > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.workspace.board_fork',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'workspace_board_fork'
                ),
                source,
                message: `Hay ${workspaceTruth.board_forks_total} worktree(s) con fork de AGENT_BOARD.yaml frente al canon`,
                files: ['AGENT_BOARD.yaml'],
                meta: {
                    canonical_root: workspaceTruth.canonical_root,
                    board_forks: workspaceTruth.board_forks.slice(0, 10),
                },
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'workspace_mixed_lane_authored') &&
        workspaceTruth.mixed_lane_rows_total > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.workspace.mixed_lane_authored',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'workspace_mixed_lane_authored'
                ),
                source,
                message: `Hay ${workspaceTruth.mixed_lane_rows_total} worktree(s) con authored mixed-lane`,
                meta: {
                    rows: workspaceTruth.mixed_lane_rows.slice(0, 10),
                },
            })
        );
    }
    if (
        warnPolicyEnabled(warnPolicyMap, 'workspace_out_of_scope_authored') &&
        workspaceTruth.out_of_scope_rows_total > 0
    ) {
        diagnostics.push(
            makeDiagnostic({
                code: 'warn.workspace.out_of_scope_authored',
                severity: warnPolicySeverity(
                    warnPolicyMap,
                    'workspace_out_of_scope_authored'
                ),
                source,
                message: `Hay ${workspaceTruth.out_of_scope_rows_total} worktree(s) con authored fuera del scope activo`,
                meta: {
                    rows: workspaceTruth.out_of_scope_rows.slice(0, 10),
                },
            })
        );
    }
    return diagnostics;
}

function formatWorkspaceTruthBlocker(workspaceReport) {
    const workspaceTruth = workspaceReport?.workspace_truth;
    if (!workspaceTruth || workspaceTruth.available !== true || workspaceTruth.ok) {
        return '';
    }
    const parts = [];
    if (workspaceTruth.board_forks_total > 0) {
        parts.push(`board_fork=${workspaceTruth.board_forks_total}`);
    }
    if (workspaceTruth.blocking_rows_total > 0) {
        parts.push(`blocked_rows=${workspaceTruth.blocking_rows_total}`);
    }
    if (workspaceTruth.mixed_lane_rows_total > 0) {
        parts.push(`mixed_lane=${workspaceTruth.mixed_lane_rows_total}`);
    }
    if (workspaceTruth.out_of_scope_rows_total > 0) {
        parts.push(`out_of_scope=${workspaceTruth.out_of_scope_rows_total}`);
    }
    return parts.join(', ');
}

function createWorkspaceTruthBlockedError(workspaceReport, commandLabel) {
    const messageDetail =
        formatWorkspaceTruthBlocker(workspaceReport) || 'workspace_truth_blocked';
    const error = new Error(
        `${commandLabel} bloqueado por workspace truth: ${messageDetail}`
    );
    error.code = 'workspace_truth_blocked';
    error.error_code = 'workspace_truth_blocked';
    error.workspace_truth = workspaceReport?.workspace_truth || null;
    error.workspace_hygiene = workspaceReport?.workspace_hygiene || null;
    return error;
}

function assertWorkspaceTruthOk(workspaceReport, options = {}) {
    const commandLabel = String(options.commandLabel || 'comando').trim();
    const workspaceTruth = workspaceReport?.workspace_truth;
    if (!workspaceTruth || workspaceTruth.available !== true) {
        return workspaceReport;
    }
    if (workspaceTruth.ok) {
        return workspaceReport;
    }
    throw createWorkspaceTruthBlockedError(workspaceReport, commandLabel);
}

function buildBoardReconcileReport(rootPath, options = {}) {
    const workspaceReport = collectWorkspaceTruth(rootPath, {
        allWorktrees: true,
        currentOnly: false,
        canonicalRoot: options.canonicalRoot,
    });
    const workspaceTruth = workspaceReport.workspace_truth || {};
    const comparisons = Array.isArray(workspaceTruth.comparisons)
        ? workspaceTruth.comparisons
        : [];
    const metadataOnlyRows = comparisons.filter(
        (row) => row.metadata_only_drift === true
    );
    const blockingRows = comparisons.filter(
        (row) =>
            row.relation === 'missing_board' ||
            row.relation === 'diverged' ||
            row.blocking === true
    );
    return {
        version: 1,
        ok: blockingRows.length === 0,
        command: 'board reconcile',
        canonical_root:
            workspaceTruth.canonical_root || normalizePathValue(rootPath),
        canonical_revision: Number(workspaceTruth.canonical_revision || 0),
        canonical_selection: workspaceTruth.canonical_selection || null,
        workspace_hygiene: workspaceReport.workspace_hygiene || null,
        workspace_truth: workspaceTruth,
        rows: comparisons,
        metadata_only_candidates: metadataOnlyRows,
        blocking_candidates: blockingRows,
        summary: {
            total_worktrees: Number(
                workspaceTruth?.summary?.total_worktrees || 0
            ),
            metadata_only_candidates: metadataOnlyRows.length,
            blocking_candidates: blockingRows.length,
        },
    };
}

function applySafeBoardReconcile(rootPath, options = {}) {
    const report = buildBoardReconcileReport(rootPath, options);
    if (!report.ok) {
        return {
            ...report,
            ok: false,
            applied_total: 0,
            applied_paths: [],
        };
    }

    const canonicalRoot = normalizePathValue(report.canonical_root || rootPath);
    const canonicalBoardInfo = loadBoardForScope(canonicalRoot);
    if (!canonicalBoardInfo.board) {
        return {
            ...report,
            ok: false,
            applied_total: 0,
            applied_paths: [],
            error: `No se pudo leer board canonico en ${canonicalRoot}`,
        };
    }

    const serializedCanonicalBoard = serializeBoard(canonicalBoardInfo.board);
    const appliedPaths = [];
    for (const row of report.metadata_only_candidates) {
        const targetPath = path.resolve(row.path, 'AGENT_BOARD.yaml');
        fs.writeFileSync(targetPath, serializedCanonicalBoard, 'utf8');
        appliedPaths.push(normalizePathValue(targetPath));
    }

    return {
        ...report,
        ok: true,
        applied_total: appliedPaths.length,
        applied_paths: appliedPaths,
    };
}

module.exports = {
    applySafeBoardReconcile,
    assertWorkspaceTruthOk,
    buildBoardReconcileReport,
    buildWorkspaceTruthDiagnostics,
    collectWorkspaceTruth,
    compareBoardSnapshots,
    createWorkspaceTruthBlockedError,
    diffBoardsByTask,
    formatWorkspaceTruthBlocker,
    normalizeBoardForFingerprint,
    normalizeTaskForFingerprint,
};
