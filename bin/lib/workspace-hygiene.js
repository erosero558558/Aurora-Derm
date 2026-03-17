'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
    parseBoardContent,
} = require('../../tools/agent-orchestrator/core/parsers.js');
const {
    inferDomainLaneFromFiles,
    mapLaneToCodexInstance,
} = require('../../tools/agent-orchestrator/domain/task-guards.js');
const {
    inferTaskDomain,
} = require('../../tools/agent-orchestrator/domain/metrics.js');
const {
    getActiveStrategy,
    getTaskSubfront,
    getSubfrontByCodexInstance,
} = require('../../tools/agent-orchestrator/domain/strategy.js');
const {
    GENERATED_SITE_ROOT_RELATIVE,
    LEGACY_GENERATED_ROOT_DIRECTORIES,
    LEGACY_GENERATED_ROOT_FILES,
    isGeneratedSiteRootPath,
    isLegacyGeneratedRootPath,
    normalizeRelativePath,
} = require('./generated-site-root.js');
const {
    LOCAL_ARTIFACT_TARGETS,
    cleanArtifacts,
    collectExistingArtifacts,
} = require('../clean-local-artifacts.js');

const DOCTOR_VERSION = 5;
const DEFAULT_PATH_SAMPLE_LIMIT = 10;
const BOARD_FILENAME = 'AGENT_BOARD.yaml';

const DERIVED_QUEUE_FILES = new Set(['jules_tasks.md', 'kimi_tasks.md']);
const DEPLOY_BUNDLE_RELATIVE = '_deploy_bundle';
const LOCAL_ARTIFACT_PATHS = LOCAL_ARTIFACT_TARGETS.map((target) =>
    normalizeRelativePath(target.path)
);
const LEGACY_GENERATED_ROOT_CONTRACT_PATHS = [
    ...LEGACY_GENERATED_ROOT_DIRECTORIES,
    ...LEGACY_GENERATED_ROOT_FILES,
].sort();

const GENERATED_STAGE_CATEGORY = 'generated_stage';
const DEPLOY_BUNDLE_CATEGORY = 'deploy_bundle';
const LOCAL_ARTIFACT_CATEGORY = 'local_artifact';
const DERIVED_QUEUE_CATEGORY = 'derived_queue';
const AUTHORED_CATEGORY = 'authored';
const LEGACY_GENERATED_ROOT_CATEGORY = 'legacy_generated_root';
const LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY =
    'legacy_generated_root_deindexed';

const SCOPE_RESOLUTION_MATCHED = 'matched';
const SCOPE_RESOLUTION_AMBIGUOUS = 'ambiguous';
const SCOPE_RESOLUTION_UNKNOWN = 'unknown';
const SCOPE_RESOLUTION_NONE = 'none';
const SCOPE_RESOLUTION_ORDER = [
    SCOPE_RESOLUTION_MATCHED,
    SCOPE_RESOLUTION_AMBIGUOUS,
    SCOPE_RESOLUTION_UNKNOWN,
    SCOPE_RESOLUTION_NONE,
];

const SCOPE_DISPOSITION_IN_SCOPE = 'in_scope';
const SCOPE_DISPOSITION_OUT_OF_SCOPE = 'out_of_scope';
const SCOPE_DISPOSITION_UNKNOWN = 'unknown_scope';
const SCOPE_DISPOSITION_NONE = 'none';
const SCOPE_DISPOSITION_ORDER = [
    SCOPE_DISPOSITION_OUT_OF_SCOPE,
    SCOPE_DISPOSITION_UNKNOWN,
    SCOPE_DISPOSITION_IN_SCOPE,
    SCOPE_DISPOSITION_NONE,
];
const SCOPE_DISPOSITION_PRIORITY = new Map(
    SCOPE_DISPOSITION_ORDER.map((value, index) => [value, index])
);

const STRATEGY_DISPOSITION_ALIGNED = 'aligned';
const STRATEGY_DISPOSITION_SUPPORT_ONLY = 'support_only';
const STRATEGY_DISPOSITION_BLOCKED_SCOPE = 'blocked_scope';
const STRATEGY_DISPOSITION_OUTSIDE_STRATEGY = 'outside_strategy';
const STRATEGY_DISPOSITION_UNKNOWN = 'unknown_strategy';
const STRATEGY_DISPOSITION_NONE = 'none';
const STRATEGY_DISPOSITION_MIXED = 'mixed_subfronts';
const STRATEGY_DISPOSITION_ORDER = [
    STRATEGY_DISPOSITION_MIXED,
    STRATEGY_DISPOSITION_BLOCKED_SCOPE,
    STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
    STRATEGY_DISPOSITION_UNKNOWN,
    STRATEGY_DISPOSITION_SUPPORT_ONLY,
    STRATEGY_DISPOSITION_ALIGNED,
    STRATEGY_DISPOSITION_NONE,
];
const STRATEGY_DISPOSITION_PRIORITY = new Map(
    STRATEGY_DISPOSITION_ORDER.map((value, index) => [value, index])
);

const LANE_DISPOSITION_MIXED = 'mixed_lane';
const LANE_DISPOSITION_UNKNOWN = 'unknown_lane';
const LANE_DISPOSITION_SINGLE = 'single_lane';
const LANE_DISPOSITION_NONE = 'none';
const LANE_DISPOSITION_ORDER = [
    LANE_DISPOSITION_MIXED,
    LANE_DISPOSITION_UNKNOWN,
    LANE_DISPOSITION_SINGLE,
    LANE_DISPOSITION_NONE,
];
const LANE_DISPOSITION_PRIORITY = new Map(
    LANE_DISPOSITION_ORDER.map((value, index) => [value, index])
);

const STRATEGY_CONTEXT_NONE = 'none';
const STRATEGY_CONTEXT_ALIGNED = STRATEGY_DISPOSITION_ALIGNED;
const STRATEGY_CONTEXT_SUPPORT_ONLY = STRATEGY_DISPOSITION_SUPPORT_ONLY;
const STRATEGY_CONTEXT_BLOCKED_SCOPE = STRATEGY_DISPOSITION_BLOCKED_SCOPE;
const STRATEGY_CONTEXT_OUTSIDE_STRATEGY = STRATEGY_DISPOSITION_OUTSIDE_STRATEGY;
const STRATEGY_CONTEXT_UNKNOWN = STRATEGY_DISPOSITION_UNKNOWN;
const STRATEGY_CONTEXT_MIXED = STRATEGY_DISPOSITION_MIXED;

const LANE_CONTEXT_NONE = 'none';
const LANE_CONTEXT_SINGLE = LANE_DISPOSITION_SINGLE;
const LANE_CONTEXT_MIXED = LANE_DISPOSITION_MIXED;
const LANE_CONTEXT_UNKNOWN = LANE_DISPOSITION_UNKNOWN;

const ISSUE_SEVERITY_ERROR = 'error';
const ISSUE_SEVERITY_BLOCKING = 'blocking';
const ISSUE_SEVERITY_WARN = 'warn';
const ISSUE_SEVERITY_FIXABLE = 'fixable';

const DOCTOR_STATE_ERROR = 'error';
const DOCTOR_STATE_BLOCKED = 'blocked';
const DOCTOR_STATE_ATTENTION = 'attention';
const DOCTOR_STATE_FIXABLE = 'fixable';
const DOCTOR_STATE_CLEAN = 'clean';
const DOCTOR_STATE_PENDING_COMMIT = DOCTOR_STATE_BLOCKED;
const WORKTREE_STATES = [
    DOCTOR_STATE_ERROR,
    DOCTOR_STATE_BLOCKED,
    DOCTOR_STATE_ATTENTION,
    DOCTOR_STATE_FIXABLE,
    DOCTOR_STATE_CLEAN,
];
const WORKTREE_STATE_PRIORITY = new Map(
    WORKTREE_STATES.map((state, index) => [state, index])
);

const ACTIVE_SCOPE_TASK_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);

const EPHEMERAL_DIRTY_CATEGORIES = new Set([
    GENERATED_STAGE_CATEGORY,
    DEPLOY_BUNDLE_CATEGORY,
    DERIVED_QUEUE_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
]);
const IGNORED_PUBLISH_DIRTY_CATEGORIES = new Set([
    GENERATED_STAGE_CATEGORY,
    DEPLOY_BUNDLE_CATEGORY,
    DERIVED_QUEUE_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
]);
const BLOCKING_DIRTY_CATEGORIES = new Set([
    AUTHORED_CATEGORY,
    LEGACY_GENERATED_ROOT_CATEGORY,
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
]);

const ISSUE_CATEGORY_ORDER = [
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
    LEGACY_GENERATED_ROOT_CATEGORY,
    AUTHORED_CATEGORY,
    GENERATED_STAGE_CATEGORY,
    DEPLOY_BUNDLE_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
    DERIVED_QUEUE_CATEGORY,
];
const ISSUE_CATEGORY_PRIORITY = new Map(
    ISSUE_CATEGORY_ORDER.map((category, index) => [category, index])
);
const ISSUE_SEVERITY_PRIORITY = new Map([
    [ISSUE_SEVERITY_ERROR, 0],
    [ISSUE_SEVERITY_BLOCKING, 1],
    [ISSUE_SEVERITY_WARN, 2],
    [ISSUE_SEVERITY_FIXABLE, 3],
]);

const REMEDIATION_STEP_DEFINITIONS = {
    apply_safe: {
        id: 'apply_safe',
        summary:
            'Limpia `.generated/site-root/`, `_deploy_bundle/`, artefactos locales y colas derivadas sin tocar source authored.',
        command: 'npm run workspace:hygiene:fix',
    },
    clarify_scope_context: {
        id: 'clarify_scope_context',
        summary:
            'Aclara que tarea activa debe gobernar estos cambios authored antes de sincronizar o publicar.',
        command: 'node agent-orchestrator.js task ls --active --json',
    },
    legacy_root_cleanup: {
        id: 'legacy_root_cleanup',
        summary:
            'Desindexa las copias legacy trackeadas del root sin borrar los archivos locales.',
        command: 'npm run legacy:generated-root:apply',
    },
    commit_or_stash_legacy_deindex: {
        id: 'commit_or_stash_legacy_deindex',
        summary:
            'Confirma o aparta las eliminaciones staged del deindexado legacy antes de publicar o sincronizar.',
        command:
            'git commit -m "chore(frontend): deindex legacy generated root outputs"',
    },
    review_out_of_scope_authored: {
        id: 'review_out_of_scope_authored',
        summary:
            'Revisa o mueve los cambios authored que quedaron fuera del scope activo.',
        command: 'git status --short',
    },
    split_mixed_lane_worktree: {
        id: 'split_mixed_lane_worktree',
        summary:
            'Separa el worktree por lane o subfrente antes de sincronizar o publicar.',
        command: 'git status --short',
    },
    review_strategy_drift: {
        id: 'review_strategy_drift',
        summary:
            'Revisa el drift contra strategy.active y realinea estos cambios a una tarea o corte valido.',
        command: 'node agent-orchestrator.js strategy status --json',
    },
    inspect_candidate_tasks: {
        id: 'inspect_candidate_tasks',
        summary:
            'Inspecciona las tareas candidatas sugeridas por el doctor o aclara el task_id explicito.',
        command:
            'npm run workspace:hygiene:doctor -- --current-only --show-candidates',
    },
    continue_in_scope_task: {
        id: 'continue_in_scope_task',
        summary:
            'Los cambios authored actuales coinciden con la tarea activa; continua validando o publica por el flujo correcto.',
        command: 'git status --short',
    },
    rerun_doctor: {
        id: 'rerun_doctor',
        summary:
            'Vuelve a correr el doctor para confirmar el estado final del workspace.',
        command: 'npm run workspace:hygiene:doctor',
    },
};

const ISSUE_CONFIG = {
    [GENERATED_STAGE_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} output(s) generados bajo \`.generated/site-root/\` listos para limpieza segura.`;
        },
    },
    [DEPLOY_BUNDLE_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} output(s) en \`_deploy_bundle/\` listos para limpieza segura.`;
        },
    },
    [LOCAL_ARTIFACT_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} artefacto(s) locales efimeros listos para limpieza segura.`;
        },
    },
    [DERIVED_QUEUE_CATEGORY]: {
        severity: ISSUE_SEVERITY_FIXABLE,
        blocksPublish: false,
        blocksSync: false,
        blocksCi: false,
        command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        summary(count) {
            return `Hay ${count} snapshot(s) derivados de colas de agentes listos para restaurar.`;
        },
    },
    [LEGACY_GENERATED_ROOT_CATEGORY]: {
        severity: ISSUE_SEVERITY_BLOCKING,
        blocksPublish: true,
        blocksSync: true,
        blocksCi: true,
        command: REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup.command,
        summary(count) {
            return `Hay ${count} path(s) legacy del repo root que siguen versionados o modificados fuera del contrato canonico.`;
        },
    },
    [LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY]: {
        severity: ISSUE_SEVERITY_BLOCKING,
        blocksPublish: true,
        blocksSync: true,
        blocksCi: true,
        command:
            REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex.command,
        summary(count) {
            return `Hay ${count} eliminacion(es) staged del deindexado legacy pendientes de commit o stash.`;
        },
    },
};

function parseGitStatusPorcelain(raw = '') {
    return String(raw || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/\r$/, ''))
        .filter((line) => line.trim() !== '')
        .map((line) => {
            const status = line.slice(0, 2);
            const rawPath = line.slice(3).trim();
            const normalizedPath = normalizeRelativePath(
                rawPath.includes(' -> ') ? rawPath.split(' -> ').pop() : rawPath
            );
            return {
                status,
                rawPath: rawPath.includes(' -> ')
                    ? rawPath.split(' -> ').pop()
                    : rawPath,
                path: normalizedPath,
            };
        })
        .filter((entry) => entry.path);
}

function parseNullSeparated(value = '') {
    return String(value || '')
        .split('\0')
        .map((entry) => normalizeRelativePath(entry))
        .filter(Boolean)
        .sort();
}

function normalizeMatchToken(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\.\//, '')
        .toLowerCase();
}

function wildcardToRegex(pattern) {
    const escaped = String(pattern || '')
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
}

function isPathAllowedByPatterns(pathValue, patterns = []) {
    const safePath = normalizeMatchToken(pathValue);
    return (Array.isArray(patterns) ? patterns : []).some((pattern) => {
        const safePattern = normalizeMatchToken(pattern);
        if (!safePattern) return false;
        if (safePattern === safePath) return true;
        if (safePath.startsWith(`${safePattern}/`)) return true;
        if (!safePattern.includes('*')) return false;
        return wildcardToRegex(safePattern).test(safePath);
    });
}

function isDeployBundlePath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    const prefix = `${DEPLOY_BUNDLE_RELATIVE}/`.toLowerCase();
    return (
        normalized === DEPLOY_BUNDLE_RELATIVE.toLowerCase() ||
        normalized.startsWith(prefix)
    );
}

function isLocalArtifactPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    return LOCAL_ARTIFACT_PATHS.some((targetPath) => {
        const target = targetPath.toLowerCase();
        return normalized === target || normalized.startsWith(`${target}/`);
    });
}

function classifyDirtyPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue);
    if (!normalized) {
        return AUTHORED_CATEGORY;
    }

    if (isGeneratedSiteRootPath(normalized)) {
        return GENERATED_STAGE_CATEGORY;
    }

    if (isDeployBundlePath(normalized)) {
        return DEPLOY_BUNDLE_CATEGORY;
    }

    if (isLegacyGeneratedRootPath(normalized)) {
        return LEGACY_GENERATED_ROOT_CATEGORY;
    }

    if (DERIVED_QUEUE_FILES.has(normalized.toLowerCase())) {
        return DERIVED_QUEUE_CATEGORY;
    }

    if (isLocalArtifactPath(normalized)) {
        return LOCAL_ARTIFACT_CATEGORY;
    }

    return AUTHORED_CATEGORY;
}

function classifyDirtyEntries(entries = []) {
    return entries.map((entry) => ({
        ...entry,
        category: classifyDirtyPath(entry.path),
    }));
}

function annotateLegacyDirtyEntries(entries = [], trackedPaths = []) {
    const trackedSet = new Set(
        (Array.isArray(trackedPaths) ? trackedPaths : []).map((entry) =>
            normalizeRelativePath(entry)
        )
    );

    return (Array.isArray(entries) ? entries : []).map((entry) => {
        if (entry.category !== LEGACY_GENERATED_ROOT_CATEGORY) {
            return entry;
        }

        const normalizedPath = normalizeRelativePath(entry.path);
        const isIndexDeletion =
            String(entry.status || '').startsWith('D') &&
            !trackedSet.has(normalizedPath);

        if (!isIndexDeletion) {
            return entry;
        }

        return {
            ...entry,
            category: LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
        };
    });
}

function summarizeDirtyEntries(entries = []) {
    const summary = {
        total: entries.length,
        byCategory: {},
    };

    for (const entry of entries) {
        const category = entry.category || classifyDirtyPath(entry.path);
        summary.byCategory[category] = (summary.byCategory[category] || 0) + 1;
    }

    return summary;
}

function isEphemeralDirtyCategory(category) {
    return EPHEMERAL_DIRTY_CATEGORIES.has(String(category || '').trim());
}

function isIgnoredPublishDirtyCategory(category) {
    return IGNORED_PUBLISH_DIRTY_CATEGORIES.has(String(category || '').trim());
}

function runGit(args, cwd, capture = true) {
    return spawnSync('git', args, {
        cwd,
        encoding: 'utf8',
        stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    });
}

function listTrackedLegacyGeneratedRootPaths(cwd) {
    const result = runGit(
        ['ls-files', '-z', '--', ...LEGACY_GENERATED_ROOT_CONTRACT_PATHS],
        cwd,
        true
    );
    if (result.status !== 0) {
        throw new Error(
            result.stderr ||
                result.stdout ||
                'git ls-files legacy generated root failed'
        );
    }
    return parseNullSeparated(result.stdout);
}

function readDirtyEntries(cwd, options = {}) {
    const trackedLegacyPaths = Array.isArray(options.trackedLegacyPaths)
        ? options.trackedLegacyPaths
        : listTrackedLegacyGeneratedRootPaths(cwd);
    const result = runGit(
        ['status', '--porcelain', '--untracked-files=all'],
        cwd,
        true
    );
    if (result.status !== 0) {
        throw new Error(result.stderr || result.stdout || 'git status failed');
    }
    const classifiedEntries = classifyDirtyEntries(
        parseGitStatusPorcelain(result.stdout)
    );
    return annotateLegacyDirtyEntries(classifiedEntries, trackedLegacyPaths);
}

function parseWorktreeList(raw) {
    const lines = String(raw || '').split(/\r?\n/);
    const worktrees = [];
    let current = null;

    for (const line of lines) {
        if (!line.trim()) {
            continue;
        }
        if (line.startsWith('worktree ')) {
            if (current) {
                worktrees.push(current);
            }
            current = {
                path: line.slice(9).trim(),
                branch: '',
                detached: false,
            };
            continue;
        }
        if (!current) continue;
        if (line.startsWith('branch ')) {
            current.branch = line
                .slice(7)
                .replace(/^refs\/heads\//, '')
                .trim();
            continue;
        }
        if (line === 'detached') {
            current.detached = true;
        }
    }

    if (current) {
        worktrees.push(current);
    }

    return worktrees;
}

function listWorktrees(cwd) {
    const result = runGit(['worktree', 'list', '--porcelain'], cwd, true);
    if (result.status !== 0) {
        throw new Error(
            result.stderr || result.stdout || 'git worktree list failed'
        );
    }
    return parseWorktreeList(result.stdout);
}

function readCurrentBranch(cwd) {
    const result = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, true);
    if (result.status !== 0) {
        return '(unknown)';
    }
    const branch = String(result.stdout || '').trim();
    return branch === 'HEAD' ? '(detached)' : branch || '(unknown)';
}

function normalizeIssuePaths(paths = []) {
    return Array.from(
        new Set(
            (Array.isArray(paths) ? paths : [])
                .map((entry) => normalizeRelativePath(entry))
                .filter(Boolean)
        )
    ).sort();
}

function loadBoardForScope(rootPath, options = {}) {
    if (options.board && typeof options.board === 'object') {
        return {
            board: options.board,
            boardPath: options.boardPath || BOARD_FILENAME,
            error: null,
        };
    }

    const boardPath = path.resolve(
        rootPath,
        options.boardPath || BOARD_FILENAME
    );
    if (!fs.existsSync(boardPath)) {
        return {
            board: null,
            boardPath,
            error: `No existe ${path.basename(boardPath)}`,
        };
    }

    try {
        return {
            board: parseBoardContent(fs.readFileSync(boardPath, 'utf8')),
            boardPath,
            error: null,
        };
    } catch (error) {
        return {
            board: null,
            boardPath,
            error: String(error && error.message ? error.message : error),
        };
    }
}

function normalizeTaskScopePatterns(task, extraPatterns = []) {
    return Array.from(
        new Set(
            [
                ...(Array.isArray(task?.files) ? task.files : []),
                ...(Array.isArray(extraPatterns) ? extraPatterns : []),
            ]
                .map((value) => normalizeRelativePath(value))
                .filter(Boolean)
        )
    );
}

function listActiveCodexTasks(board) {
    return (Array.isArray(board?.tasks) ? board.tasks : []).filter((task) => {
        const executor = String(task?.executor || '')
            .trim()
            .toLowerCase();
        const status = String(task?.status || '')
            .trim()
            .toLowerCase();
        return executor === 'codex' && ACTIVE_SCOPE_TASK_STATUSES.has(status);
    });
}

function buildScopeContext(resolution = SCOPE_RESOLUTION_NONE, options = {}) {
    const task = options.task || null;
    return {
        resolution: SCOPE_RESOLUTION_ORDER.includes(resolution)
            ? resolution
            : SCOPE_RESOLUTION_UNKNOWN,
        task_id: task ? String(task.id || '').trim() : '',
        codex_instance: task ? String(task.codex_instance || '').trim() : '',
        domain_lane: task ? String(task.domain_lane || '').trim() : '',
        scope: task ? String(task.scope || '').trim() : '',
        strategy_id: task ? String(task.strategy_id || '').trim() : '',
        strategy_role: task ? String(task.strategy_role || '').trim() : '',
        subfront_id: task ? String(task.subfront_id || '').trim() : '',
        match_reason: String(options.matchReason || '').trim(),
        matched_paths_sample: normalizeIssuePaths(
            options.matchedPaths || []
        ).slice(0, DEFAULT_PATH_SAMPLE_LIMIT),
    };
}

function resolveExplicitScopeContext(
    rootPath,
    authoredPaths = [],
    options = {}
) {
    const boardInfo = loadBoardForScope(rootPath, options);
    let task = options.scopeTask || null;
    if (!task && options.scopeTaskId && Array.isArray(boardInfo.board?.tasks)) {
        task = boardInfo.board.tasks.find(
            (candidate) =>
                String(candidate?.id || '').trim() ===
                String(options.scopeTaskId || '').trim()
        );
    }

    const patterns = Array.isArray(options.scopePatterns)
        ? normalizeIssuePaths(options.scopePatterns)
        : normalizeTaskScopePatterns(task, options.extraScopePatterns);

    if (!task && patterns.length === 0) {
        return {
            context: buildScopeContext(SCOPE_RESOLUTION_UNKNOWN, {
                matchReason:
                    'No se pudo resolver una tarea o patron explicito de scope para clasificar los cambios authored.',
            }),
            patterns: [],
        };
    }

    const safeAuthoredPaths = normalizeIssuePaths(authoredPaths);
    const matchedPaths = safeAuthoredPaths.filter((entry) =>
        isPathAllowedByPatterns(entry, patterns)
    );
    const label = task ? `tarea explicita ${task.id}` : 'patrones explicitos';
    return {
        context: buildScopeContext(SCOPE_RESOLUTION_MATCHED, {
            task,
            matchReason: `Usando ${label}; coinciden ${matchedPaths.length}/${safeAuthoredPaths.length} path(s) authored.`,
            matchedPaths,
        }),
        patterns,
    };
}

function resolveAutoScopeContext(rootPath, authoredPaths = [], options = {}) {
    const safeAuthoredPaths = normalizeIssuePaths(authoredPaths);
    const boardInfo = loadBoardForScope(rootPath, options);

    if (!boardInfo.board) {
        return {
            context: buildScopeContext(SCOPE_RESOLUTION_UNKNOWN, {
                matchReason:
                    boardInfo.error ||
                    `No se pudo leer ${path.basename(boardInfo.boardPath || BOARD_FILENAME)} para resolver el scope activo.`,
            }),
            patterns: [],
        };
    }

    const activeTasks = listActiveCodexTasks(boardInfo.board);
    if (activeTasks.length === 0) {
        return {
            context: buildScopeContext(SCOPE_RESOLUTION_UNKNOWN, {
                matchReason:
                    'No hay tareas Codex activas en AGENT_BOARD.yaml para clasificar los cambios authored.',
            }),
            patterns: [],
        };
    }

    const candidates = activeTasks.map((task) => {
        const patterns = normalizeTaskScopePatterns(task);
        const matchedPaths = safeAuthoredPaths.filter((entry) =>
            isPathAllowedByPatterns(entry, patterns)
        );
        return {
            task,
            patterns,
            matchedPaths,
            matchedCount: matchedPaths.length,
        };
    });

    const bestCount = Math.max(
        0,
        ...candidates.map((candidate) => candidate.matchedCount)
    );
    if (bestCount <= 0) {
        return {
            context: buildScopeContext(SCOPE_RESOLUTION_UNKNOWN, {
                matchReason:
                    'Ninguna tarea Codex activa coincide con los paths authored detectados.',
            }),
            patterns: [],
        };
    }

    const bestCandidates = candidates.filter(
        (candidate) => candidate.matchedCount === bestCount
    );
    if (bestCandidates.length > 1) {
        return {
            context: buildScopeContext(SCOPE_RESOLUTION_AMBIGUOUS, {
                matchReason: `Multiples tareas Codex activas empatan con ${bestCount} path(s) authored: ${bestCandidates
                    .map((candidate) => candidate.task.id)
                    .join(', ')}.`,
                matchedPaths: Array.from(
                    new Set(
                        bestCandidates.flatMap(
                            (candidate) => candidate.matchedPaths
                        )
                    )
                ),
            }),
            patterns: [],
        };
    }

    const winner = bestCandidates[0];
    return {
        context: buildScopeContext(SCOPE_RESOLUTION_MATCHED, {
            task: winner.task,
            matchReason: `La tarea activa ${winner.task.id} coincide con ${winner.matchedCount}/${safeAuthoredPaths.length} path(s) authored.`,
            matchedPaths: winner.matchedPaths,
        }),
        patterns: winner.patterns,
    };
}

function resolveScopeContext(rootPath, entries = [], options = {}) {
    const authoredPaths = normalizeIssuePaths(
        (Array.isArray(entries) ? entries : [])
            .filter((entry) => entry.category === AUTHORED_CATEGORY)
            .map((entry) => entry.path)
    );

    if (authoredPaths.length === 0) {
        return {
            context: buildScopeContext(SCOPE_RESOLUTION_NONE, {
                matchReason: 'No hay cambios authored en este worktree.',
            }),
            patterns: [],
        };
    }

    if (
        options.scopeTask ||
        options.scopeTaskId ||
        Array.isArray(options.scopePatterns)
    ) {
        return resolveExplicitScopeContext(rootPath, authoredPaths, options);
    }

    return resolveAutoScopeContext(rootPath, authoredPaths, options);
}

function getEntryScopeDisposition(entry) {
    if ((entry?.category || '') !== AUTHORED_CATEGORY) {
        return SCOPE_DISPOSITION_NONE;
    }

    const disposition = String(entry?.scope_disposition || '').trim();
    if (
        [
            SCOPE_DISPOSITION_IN_SCOPE,
            SCOPE_DISPOSITION_OUT_OF_SCOPE,
            SCOPE_DISPOSITION_UNKNOWN,
        ].includes(disposition)
    ) {
        return disposition;
    }

    return SCOPE_DISPOSITION_UNKNOWN;
}

function annotateAuthoredScopeEntries(entries = [], resolution = {}) {
    const scopeContext = resolution.context || buildScopeContext();
    const patterns = Array.isArray(resolution.patterns)
        ? resolution.patterns
        : [];
    return (Array.isArray(entries) ? entries : []).map((entry) => {
        if (entry.category !== AUTHORED_CATEGORY) {
            return entry;
        }

        if (scopeContext.resolution === SCOPE_RESOLUTION_MATCHED) {
            const inScope = isPathAllowedByPatterns(entry.path, patterns);
            return {
                ...entry,
                scope_disposition: inScope
                    ? SCOPE_DISPOSITION_IN_SCOPE
                    : SCOPE_DISPOSITION_OUT_OF_SCOPE,
                task_id: scopeContext.task_id || '',
            };
        }

        if (
            scopeContext.resolution === SCOPE_RESOLUTION_AMBIGUOUS ||
            scopeContext.resolution === SCOPE_RESOLUTION_UNKNOWN
        ) {
            return {
                ...entry,
                scope_disposition: SCOPE_DISPOSITION_UNKNOWN,
            };
        }

        return {
            ...entry,
            scope_disposition: SCOPE_DISPOSITION_NONE,
        };
    });
}

function listCodexTasks(board) {
    return (Array.isArray(board?.tasks) ? board.tasks : []).filter((task) => {
        const executor = String(task?.executor || '')
            .trim()
            .toLowerCase();
        return executor === 'codex';
    });
}

function buildLaneContext(resolution = LANE_CONTEXT_NONE, options = {}) {
    const counts = {
        backend_ops: Number(options.counts?.backend_ops || 0),
        frontend_content: Number(options.counts?.frontend_content || 0),
        transversal_runtime: Number(options.counts?.transversal_runtime || 0),
        support_docs: Number(options.counts?.support_docs || 0),
        unknown: Number(options.counts?.unknown || 0),
    };
    return {
        resolution: [
            LANE_CONTEXT_NONE,
            LANE_CONTEXT_SINGLE,
            LANE_CONTEXT_MIXED,
            LANE_CONTEXT_UNKNOWN,
        ].includes(resolution)
            ? resolution
            : LANE_CONTEXT_UNKNOWN,
        primary_lane: String(options.primaryLane || '').trim(),
        codex_instance: String(options.codexInstance || '').trim(),
        lanes: Array.from(
            new Set(
                (Array.isArray(options.lanes) ? options.lanes : [])
                    .map((lane) => String(lane || '').trim())
                    .filter(Boolean)
            )
        ),
        counts,
        match_reason: String(options.matchReason || '').trim(),
        matched_paths_sample: normalizeIssuePaths(
            options.matchedPaths || []
        ).slice(0, DEFAULT_PATH_SAMPLE_LIMIT),
    };
}

function buildStrategyContext(
    resolution = STRATEGY_CONTEXT_NONE,
    options = {}
) {
    const strategy = options.strategy || null;
    const primarySubfront = options.primarySubfront || null;
    return {
        resolution: [
            STRATEGY_CONTEXT_NONE,
            STRATEGY_CONTEXT_ALIGNED,
            STRATEGY_CONTEXT_SUPPORT_ONLY,
            STRATEGY_CONTEXT_BLOCKED_SCOPE,
            STRATEGY_CONTEXT_OUTSIDE_STRATEGY,
            STRATEGY_CONTEXT_UNKNOWN,
            STRATEGY_CONTEXT_MIXED,
        ].includes(resolution)
            ? resolution
            : STRATEGY_CONTEXT_UNKNOWN,
        strategy_id: String(strategy?.id || '').trim(),
        strategy_status: String(strategy?.status || '').trim(),
        primary_subfront_id: String(
            primarySubfront?.subfront_id || options.primarySubfrontId || ''
        ).trim(),
        primary_codex_instance: String(
            primarySubfront?.codex_instance ||
                options.primaryCodexInstance ||
                ''
        ).trim(),
        affected_subfront_ids: Array.from(
            new Set(
                (Array.isArray(options.affectedSubfrontIds)
                    ? options.affectedSubfrontIds
                    : []
                )
                    .map((value) => String(value || '').trim())
                    .filter(Boolean)
            )
        ),
        affected_scopes: Array.from(
            new Set(
                (Array.isArray(options.affectedScopes)
                    ? options.affectedScopes
                    : []
                )
                    .map((value) =>
                        String(value || '')
                            .trim()
                            .toLowerCase()
                    )
                    .filter(Boolean)
            )
        ),
        match_reason: String(options.matchReason || '').trim(),
        matched_paths_sample: normalizeIssuePaths(
            options.matchedPaths || []
        ).slice(0, DEFAULT_PATH_SAMPLE_LIMIT),
    };
}

function isSupportDocPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    return (
        normalized === 'readme.md' ||
        (normalized.startsWith('docs/') && normalized.endsWith('.md'))
    );
}

function isTestPath(pathValue) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    return (
        normalized.startsWith('tests/') || normalized.startsWith('tests-node/')
    );
}

function inferStrategyScopeFromPath(pathValue, laneInfo = {}) {
    const normalized = normalizeRelativePath(pathValue).toLowerCase();
    const domainGuess = String(
        inferTaskDomain(
            {
                scope: '',
                files: [normalized],
            },
            {
                normalizePathToken: normalizeMatchToken,
            }
        ) || ''
    )
        .trim()
        .toLowerCase();

    if (isSupportDocPath(normalized)) {
        return 'docs';
    }
    if (
        normalized === 'agent-orchestrator.js' ||
        normalized === 'agents.md' ||
        normalized === 'agent_board.yaml' ||
        normalized === 'agent_handoffs.yaml' ||
        normalized === 'agent_jobs.yaml' ||
        normalized === 'agent_signals.yaml' ||
        normalized === 'governance-policy.json' ||
        normalized === 'plan_maestro_codex_2026.md' ||
        normalized.startsWith('tools/agent-orchestrator/')
    ) {
        return 'codex-governance';
    }
    if (
        normalized.startsWith('bin/lib/workspace-hygiene') ||
        normalized.startsWith('bin/workspace-hygiene') ||
        normalized.startsWith('bin/sync-main-safe') ||
        normalized.startsWith('bin/legacy-generated-root-cleanup')
    ) {
        return 'tooling';
    }
    if (
        normalized.startsWith('content/') ||
        normalized.startsWith('src/apps/astro/')
    ) {
        return 'frontend-public';
    }
    if (
        normalized === 'admin.html' ||
        normalized.startsWith('src/apps/admin-v3/')
    ) {
        return 'frontend-admin';
    }
    if (
        normalized === 'operador-turnos.html' ||
        normalized === 'kiosco-turnos.html' ||
        normalized === 'sala-turnos.html' ||
        /^queue-[^/]+\.css$/i.test(normalized) ||
        normalized.startsWith('src/apps/queue-')
    ) {
        return 'queue';
    }
    if (
        normalized.startsWith('src/apps/turnero') ||
        normalized.includes('/turnero-')
    ) {
        return 'turnero';
    }
    if (normalized.startsWith('.github/workflows/')) {
        if (
            normalized.includes('deploy') ||
            normalized.includes('release') ||
            normalized.includes('staging')
        ) {
            return 'deploy';
        }
        return 'gates';
    }
    if (normalized.startsWith('scripts/ops/')) {
        if (normalized.includes('/monitor-')) return 'monitoring';
        if (normalized.includes('/deploy/')) return 'deploy';
        if (
            normalized.includes('/gate') ||
            normalized.includes('/verificar-') ||
            normalized.includes('/smoke-') ||
            normalized.includes('/rollout')
        ) {
            return 'gates';
        }
        return 'ops';
    }
    if (normalized.endsWith('.ps1')) {
        if (normalized.includes('monitor')) return 'monitoring';
        if (normalized.includes('deploy')) return 'deploy';
        if (
            normalized.includes('gate') ||
            normalized.includes('verify') ||
            normalized.includes('smoke') ||
            normalized.includes('rollout')
        ) {
            return 'gates';
        }
        return 'ops';
    }
    if (isTestPath(normalized)) {
        if (
            normalized.includes('workspace-hygiene') ||
            normalized.includes('sync-main-safe') ||
            normalized.includes('publish')
        ) {
            return 'tooling';
        }
        if (normalized.includes('queue') || normalized.includes('turnero')) {
            return 'queue';
        }
        return 'tests';
    }
    if (domainGuess === 'openclaw_runtime') {
        return 'openclaw_runtime';
    }
    if (domainGuess && domainGuess !== 'other') {
        return domainGuess;
    }
    if (laneInfo.lane === 'transversal_runtime') {
        return 'tooling';
    }
    if (laneInfo.lane === 'frontend_content') {
        return 'frontend-admin';
    }
    if (laneInfo.lane === 'backend_ops') {
        if (normalized.includes('auth')) return 'auth';
        if (normalized.includes('deploy')) return 'deploy';
        if (
            normalized.includes('gate') ||
            normalized.includes('verify') ||
            normalized.includes('rollout')
        ) {
            return 'gates';
        }
        if (normalized.includes('monitor')) return 'monitoring';
        return 'backend';
    }
    return '';
}

function findTaskById(board, taskId) {
    const safeTaskId = String(taskId || '').trim();
    if (!safeTaskId) return null;
    return (
        (Array.isArray(board?.tasks) ? board.tasks : []).find(
            (task) => String(task?.id || '').trim() === safeTaskId
        ) || null
    );
}

function getStrategyDispositionForScope(strategy, codexInstance, scopeHint) {
    const activeStrategy = strategy || null;
    const safeScope = String(scopeHint || '')
        .trim()
        .toLowerCase();
    const laneSubfront = activeStrategy
        ? getSubfrontByCodexInstance(activeStrategy, codexInstance)
        : null;

    if (!activeStrategy) {
        return {
            disposition: STRATEGY_DISPOSITION_NONE,
            subfront: null,
        };
    }

    if (!safeScope) {
        return {
            disposition: STRATEGY_DISPOSITION_UNKNOWN,
            subfront: laneSubfront,
        };
    }

    if (laneSubfront) {
        if (laneSubfront.blocked_scopes.includes(safeScope)) {
            return {
                disposition: STRATEGY_DISPOSITION_BLOCKED_SCOPE,
                subfront: laneSubfront,
            };
        }
        if (laneSubfront.allowed_scopes.includes(safeScope)) {
            return {
                disposition: STRATEGY_DISPOSITION_ALIGNED,
                subfront: laneSubfront,
            };
        }
        if (laneSubfront.support_only_scopes.includes(safeScope)) {
            return {
                disposition: STRATEGY_DISPOSITION_SUPPORT_ONLY,
                subfront: laneSubfront,
            };
        }
    }

    const otherSubfront = (
        Array.isArray(activeStrategy.subfronts) ? activeStrategy.subfronts : []
    ).find((subfront) => {
        return (
            subfront.allowed_scopes.includes(safeScope) ||
            subfront.support_only_scopes.includes(safeScope) ||
            subfront.blocked_scopes.includes(safeScope)
        );
    });
    if (otherSubfront) {
        return {
            disposition: STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
            subfront: otherSubfront,
        };
    }

    return {
        disposition: STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
        subfront: laneSubfront,
    };
}

function getTaskStrategyDisposition(strategy, task, scopeContext = null) {
    const activeStrategy = strategy || null;
    if (!activeStrategy || !task) {
        return {
            disposition: STRATEGY_DISPOSITION_NONE,
            subfront: null,
        };
    }

    const taskSubfront = getTaskSubfront(activeStrategy, task);
    if (!taskSubfront) {
        return {
            disposition: STRATEGY_DISPOSITION_UNKNOWN,
            subfront: null,
        };
    }

    const safeScope = String(task?.scope || scopeContext?.scope || '')
        .trim()
        .toLowerCase();
    if (!safeScope) {
        return {
            disposition: STRATEGY_DISPOSITION_UNKNOWN,
            subfront: taskSubfront,
        };
    }
    if (taskSubfront.blocked_scopes.includes(safeScope)) {
        return {
            disposition: STRATEGY_DISPOSITION_BLOCKED_SCOPE,
            subfront: taskSubfront,
        };
    }
    if (taskSubfront.support_only_scopes.includes(safeScope)) {
        return {
            disposition: STRATEGY_DISPOSITION_SUPPORT_ONLY,
            subfront: taskSubfront,
        };
    }
    if (taskSubfront.allowed_scopes.includes(safeScope)) {
        return {
            disposition: STRATEGY_DISPOSITION_ALIGNED,
            subfront: taskSubfront,
        };
    }
    return {
        disposition: STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
        subfront: taskSubfront,
    };
}

function buildCandidateTasks(board, authoredPaths = [], options = {}) {
    const safeBoard = board || null;
    if (!safeBoard) return [];

    const safePaths = normalizeIssuePaths(authoredPaths);
    const explicitTaskId = String(options.explicitTaskId || '').trim();
    return listCodexTasks(safeBoard)
        .map((task) => {
            const patterns = normalizeTaskScopePatterns(task);
            const matchedPaths = safePaths.filter((entry) =>
                isPathAllowedByPatterns(entry, patterns)
            );
            const status = String(task?.status || '')
                .trim()
                .toLowerCase();
            const isActive = ACTIVE_SCOPE_TASK_STATUSES.has(status);
            return {
                task,
                status,
                isActive,
                matchCount: matchedPaths.length,
                matchedPaths,
                explicit:
                    explicitTaskId &&
                    String(task?.id || '').trim() === explicitTaskId,
            };
        })
        .filter((candidate) => candidate.explicit || candidate.matchCount > 0)
        .sort((left, right) => {
            if (left.explicit !== right.explicit) {
                return left.explicit ? -1 : 1;
            }
            if (left.isActive !== right.isActive) {
                return left.isActive ? -1 : 1;
            }
            const matchDiff = right.matchCount - left.matchCount;
            if (matchDiff !== 0) {
                return matchDiff;
            }
            return String(left.task?.id || '').localeCompare(
                String(right.task?.id || '')
            );
        })
        .slice(0, 7)
        .map((candidate) => ({
            task_id: String(candidate.task?.id || '').trim(),
            title: String(candidate.task?.title || '').trim(),
            status: candidate.status,
            codex_instance: String(candidate.task?.codex_instance || '').trim(),
            subfront_id: String(candidate.task?.subfront_id || '').trim(),
            scope: String(candidate.task?.scope || '').trim(),
            source: candidate.explicit
                ? 'explicit'
                : candidate.isActive
                  ? 'active'
                  : 'historical',
            match_count: candidate.matchCount,
            matched_paths_sample: candidate.matchedPaths.slice(
                0,
                DEFAULT_PATH_SAMPLE_LIMIT
            ),
            remaining_count: Math.max(
                0,
                candidate.matchCount - DEFAULT_PATH_SAMPLE_LIMIT
            ),
            summary: `${candidate.task?.id || '(sin id)'} (${candidate.status || 'unknown'}) coincide con ${candidate.matchCount} path(s) authored.`,
        }));
}

function buildSplitPlan(
    annotatedEntries = [],
    laneContext = null,
    strategyContext = null,
    candidateTasks = []
) {
    const authoredEntries = (
        Array.isArray(annotatedEntries) ? annotatedEntries : []
    ).filter((entry) => entry.category === AUTHORED_CATEGORY);
    const mainEntries = authoredEntries.filter(
        (entry) => !entry.is_support_doc
    );
    const supportEntries = authoredEntries.filter(
        (entry) => entry.is_support_doc
    );
    const groups = new Map();

    for (const entry of mainEntries) {
        const groupKey = [
            entry.lane || 'unknown_lane',
            entry.strategy_subfront_id || 'no_subfront',
            entry.strategy_disposition || STRATEGY_DISPOSITION_NONE,
            entry.scope_hint || 'no_scope',
        ].join(':');
        if (!groups.has(groupKey)) {
            groups.set(groupKey, {
                lane: String(entry.lane || '').trim(),
                codex_instance: String(entry.codex_instance_hint || '').trim(),
                subfront_id: String(entry.strategy_subfront_id || '').trim(),
                strategy_disposition: String(
                    entry.strategy_disposition || STRATEGY_DISPOSITION_NONE
                ).trim(),
                scope_hint: String(entry.scope_hint || '').trim(),
                paths: [],
            });
        }
        groups.get(groupKey).paths.push(entry.path);
    }

    const sortedGroups = Array.from(groups.values()).sort((left, right) => {
        const countDiff = right.paths.length - left.paths.length;
        if (countDiff !== 0) {
            return countDiff;
        }
        return `${left.lane}:${left.subfront_id}:${left.scope_hint}`.localeCompare(
            `${right.lane}:${right.subfront_id}:${right.scope_hint}`
        );
    });

    if (supportEntries.length > 0 && sortedGroups.length > 0) {
        sortedGroups[0].paths.push(
            ...supportEntries.map((entry) => entry.path)
        );
    }

    const requiresSplit =
        sortedGroups.length > 1 ||
        laneContext?.resolution === LANE_CONTEXT_MIXED ||
        strategyContext?.resolution === STRATEGY_CONTEXT_MIXED;
    if (!requiresSplit) {
        return [];
    }

    return sortedGroups.map((group, index) => {
        const bestCandidate =
            (Array.isArray(candidateTasks) ? candidateTasks : []).find(
                (candidate) =>
                    candidate.codex_instance === group.codex_instance &&
                    candidate.matched_paths_sample.some((candidatePath) =>
                        group.paths.includes(candidatePath)
                    )
            ) || null;
        const labelParts = [
            group.lane || 'unknown_lane',
            group.subfront_id || '',
            group.scope_hint || '',
        ].filter(Boolean);
        const pathsSample = normalizeIssuePaths(group.paths).slice(
            0,
            DEFAULT_PATH_SAMPLE_LIMIT
        );
        return {
            id: `split_${index + 1}`,
            lane: group.lane,
            codex_instance: group.codex_instance,
            subfront_id: group.subfront_id,
            strategy_disposition: group.strategy_disposition,
            scope_hint: group.scope_hint,
            count: group.paths.length,
            paths_sample: pathsSample,
            remaining_count: Math.max(
                0,
                group.paths.length - pathsSample.length
            ),
            candidate_task_id: String(bestCandidate?.task_id || '').trim(),
            summary: `Separa ${group.paths.length} path(s) para ${labelParts.join(' | ') || 'grupo sin clasificar'} antes de publicar o sincronizar.`,
            suggested_command: 'git status --short',
        };
    });
}

function annotateAuthoredStrategyAndLane(
    rootPath,
    entries = [],
    scopeContext = null,
    options = {}
) {
    const dirtyEntries = Array.isArray(entries) ? entries : [];
    const authoredEntries = dirtyEntries.filter(
        (entry) => entry.category === AUTHORED_CATEGORY
    );
    if (authoredEntries.length === 0) {
        return {
            entries: dirtyEntries,
            laneContext: buildLaneContext(LANE_CONTEXT_NONE, {
                matchReason: 'No hay cambios authored en este worktree.',
            }),
            strategyContext: buildStrategyContext(STRATEGY_CONTEXT_NONE, {
                matchReason: 'No hay cambios authored en este worktree.',
            }),
            candidateTasks: [],
            splitPlan: [],
        };
    }

    const boardInfo = loadBoardForScope(rootPath, options);
    const board = boardInfo.board || null;
    const activeStrategy = board ? getActiveStrategy(board) : null;
    const explicitTask =
        options.scopeTask ||
        findTaskById(board, scopeContext?.task_id || options.scopeTaskId);

    const annotatedAuthored = authoredEntries.map((entry) => {
        const supportDoc = isSupportDocPath(entry.path);
        const laneInfo = supportDoc
            ? {
                  lane: '',
                  counts: {
                      backend_ops: 0,
                      frontend_content: 0,
                      transversal_runtime: 0,
                  },
                  details: [],
              }
            : inferDomainLaneFromFiles([entry.path]);
        const lane = String(laneInfo?.lane || '')
            .trim()
            .toLowerCase();
        const codexInstance = lane ? mapLaneToCodexInstance(lane) : '';
        const scopeHint = inferStrategyScopeFromPath(entry.path, laneInfo);
        const taskDisposition =
            explicitTask &&
            String(entry.task_id || scopeContext?.task_id || '').trim()
                ? getTaskStrategyDisposition(
                      activeStrategy,
                      explicitTask,
                      scopeContext
                  )
                : null;
        const strategyResolution =
            taskDisposition ||
            getStrategyDispositionForScope(
                activeStrategy,
                codexInstance,
                scopeHint
            );
        return {
            ...entry,
            is_support_doc: supportDoc,
            lane,
            codex_instance_hint: codexInstance,
            lane_reason: String(
                laneInfo?.details?.[0]?.reason || laneInfo?.reason || ''
            ).trim(),
            scope_hint: scopeHint,
            strategy_disposition: strategyResolution.disposition,
            strategy_subfront_id: String(
                strategyResolution.subfront?.subfront_id || ''
            ).trim(),
            lane_disposition: LANE_DISPOSITION_NONE,
        };
    });

    const laneCounts = {
        backend_ops: 0,
        frontend_content: 0,
        transversal_runtime: 0,
        support_docs: 0,
        unknown: 0,
    };
    const matchedPaths = [];
    const lanes = new Set();
    for (const entry of annotatedAuthored) {
        matchedPaths.push(entry.path);
        if (entry.is_support_doc) {
            laneCounts.support_docs += 1;
            continue;
        }
        if (
            entry.lane === 'backend_ops' ||
            entry.lane === 'frontend_content' ||
            entry.lane === 'transversal_runtime'
        ) {
            laneCounts[entry.lane] += 1;
            lanes.add(entry.lane);
            continue;
        }
        laneCounts.unknown += 1;
    }

    const primaryLane = [
        'backend_ops',
        'frontend_content',
        'transversal_runtime',
    ].sort((left, right) => laneCounts[right] - laneCounts[left])[0];
    const activeLaneCount = Array.from(lanes).length;
    let laneResolution = LANE_CONTEXT_UNKNOWN;
    let laneReason =
        'No se pudo inferir un lane estable para los cambios authored.';
    if (activeLaneCount === 0 && laneCounts.unknown === 0) {
        laneResolution = LANE_CONTEXT_NONE;
        laneReason =
            'Solo hay soporte documental o no hay authored relevantes.';
    } else if (activeLaneCount === 1 && laneCounts.unknown === 0) {
        laneResolution = LANE_CONTEXT_SINGLE;
        laneReason = `Todos los cambios authored caen en ${primaryLane}.`;
    } else if (activeLaneCount > 1) {
        laneResolution = LANE_CONTEXT_MIXED;
        laneReason = `Los cambios authored mezclan multiples lanes: ${Array.from(
            lanes
        ).join(', ')}.`;
    }
    const laneContext = buildLaneContext(laneResolution, {
        primaryLane,
        codexInstance: primaryLane ? mapLaneToCodexInstance(primaryLane) : '',
        lanes: Array.from(lanes),
        counts: laneCounts,
        matchReason: laneReason,
        matchedPaths,
    });

    const primarySubfront =
        activeStrategy && primaryLane
            ? getSubfrontByCodexInstance(
                  activeStrategy,
                  mapLaneToCodexInstance(primaryLane)
              )
            : null;
    const supportedDocsByPrimaryLane =
        primarySubfront &&
        primarySubfront.support_only_scopes.includes('docs') &&
        laneContext.resolution === LANE_CONTEXT_SINGLE;
    const docOwnerSubfront =
        primarySubfront ||
        (activeStrategy
            ? (Array.isArray(activeStrategy.subfronts)
                  ? activeStrategy.subfronts
                  : []
              ).find((subfront) =>
                  subfront.support_only_scopes.includes('docs')
              ) || null
            : null);

    const finalizedAuthored = annotatedAuthored.map((entry) => {
        if (!entry.is_support_doc) {
            return {
                ...entry,
                lane_disposition:
                    laneContext.resolution === LANE_CONTEXT_NONE
                        ? LANE_DISPOSITION_NONE
                        : laneContext.resolution,
            };
        }

        const docDisposition = supportedDocsByPrimaryLane
            ? STRATEGY_DISPOSITION_SUPPORT_ONLY
            : docOwnerSubfront
              ? STRATEGY_DISPOSITION_SUPPORT_ONLY
              : activeStrategy
                ? STRATEGY_DISPOSITION_UNKNOWN
                : STRATEGY_DISPOSITION_NONE;
        const docLane = supportedDocsByPrimaryLane ? primaryLane : '';
        const docCodexInstance = docLane ? mapLaneToCodexInstance(docLane) : '';
        return {
            ...entry,
            lane: docLane,
            codex_instance_hint: docCodexInstance,
            strategy_disposition: docDisposition,
            strategy_subfront_id: String(
                (supportedDocsByPrimaryLane
                    ? primarySubfront?.subfront_id
                    : docOwnerSubfront?.subfront_id) || ''
            ).trim(),
            lane_disposition:
                laneContext.resolution === LANE_CONTEXT_NONE
                    ? LANE_DISPOSITION_NONE
                    : laneContext.resolution,
        };
    });

    const authoredDispositions = finalizedAuthored.map(
        (entry) => entry.strategy_disposition
    );
    const blockingStrategyPaths = finalizedAuthored
        .filter((entry) =>
            [
                STRATEGY_DISPOSITION_BLOCKED_SCOPE,
                STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
            ].includes(entry.strategy_disposition)
        )
        .map((entry) => entry.path);
    const unknownStrategyPaths = finalizedAuthored
        .filter(
            (entry) =>
                entry.strategy_disposition === STRATEGY_DISPOSITION_UNKNOWN
        )
        .map((entry) => entry.path);
    const affectedSubfrontIds = Array.from(
        new Set(
            finalizedAuthored
                .map((entry) => entry.strategy_subfront_id)
                .filter(Boolean)
        )
    );
    const affectedScopes = Array.from(
        new Set(
            finalizedAuthored
                .map((entry) =>
                    String(entry.scope_hint || '')
                        .trim()
                        .toLowerCase()
                )
                .filter(Boolean)
        )
    );
    const [strategyResolution, strategyReason] = !activeStrategy
        ? [
              STRATEGY_CONTEXT_NONE,
              'No hay strategy.active para clasificar el drift actual.',
          ]
        : laneContext.resolution === LANE_CONTEXT_MIXED ||
            affectedSubfrontIds.length > 1
          ? [
                STRATEGY_CONTEXT_MIXED,
                'Los cambios authored mezclan lanes o subfrentes distintos dentro de strategy.active.',
            ]
          : authoredDispositions.includes(STRATEGY_DISPOSITION_BLOCKED_SCOPE)
            ? [
                  STRATEGY_CONTEXT_BLOCKED_SCOPE,
                  'Hay cambios authored que tocan scopes bloqueados por el subfrente activo.',
              ]
            : authoredDispositions.includes(
                    STRATEGY_DISPOSITION_OUTSIDE_STRATEGY
                )
              ? [
                    STRATEGY_CONTEXT_OUTSIDE_STRATEGY,
                    'Hay cambios authored fuera de los scopes permitidos por strategy.active.',
                ]
              : authoredDispositions.includes(STRATEGY_DISPOSITION_UNKNOWN)
                ? [
                      STRATEGY_CONTEXT_UNKNOWN,
                      'Hay cambios authored cuyo scope de estrategia no se pudo inferir con confianza.',
                  ]
                : authoredDispositions.length > 0 &&
                    authoredDispositions.every(
                        (value) => value === STRATEGY_DISPOSITION_SUPPORT_ONLY
                    )
                  ? [
                        STRATEGY_CONTEXT_SUPPORT_ONLY,
                        'Los cambios authored actuales son soporte permitido por strategy.active.',
                    ]
                  : [
                        STRATEGY_CONTEXT_ALIGNED,
                        'Los cambios authored actuales quedan alineados a strategy.active.',
                    ];
    const strategyContext = buildStrategyContext(strategyResolution, {
        strategy: activeStrategy,
        primarySubfront,
        affectedSubfrontIds,
        affectedScopes,
        matchReason:
            blockingStrategyPaths.length > 0
                ? `${strategyReason} Paths relevantes: ${blockingStrategyPaths
                      .slice(0, DEFAULT_PATH_SAMPLE_LIMIT)
                      .join(', ')}.`
                : unknownStrategyPaths.length > 0
                  ? `${strategyReason} Paths sin clasificar: ${unknownStrategyPaths
                        .slice(0, DEFAULT_PATH_SAMPLE_LIMIT)
                        .join(', ')}.`
                  : strategyReason,
        matchedPaths,
    });

    const candidateTasks = buildCandidateTasks(
        board,
        authoredEntries.map((entry) => entry.path),
        {
            explicitTaskId: String(
                scopeContext?.task_id || options.scopeTaskId || ''
            ).trim(),
        }
    );
    const splitPlan = buildSplitPlan(
        finalizedAuthored,
        laneContext,
        strategyContext,
        candidateTasks
    );

    let authoredIndex = 0;
    const mergedEntries = dirtyEntries.map((entry) => {
        if (entry.category !== AUTHORED_CATEGORY) {
            return entry;
        }
        const nextEntry = finalizedAuthored[authoredIndex];
        authoredIndex += 1;
        return nextEntry || entry;
    });

    return {
        entries: mergedEntries,
        laneContext,
        strategyContext,
        candidateTasks,
        splitPlan,
    };
}

function getAuthoredIssueConfig(disposition, options = {}) {
    const taskId = String(options.taskId || '').trim();
    const taskLabel = taskId ? ` de ${taskId}` : '';
    const matchReason = String(options.scopeContext?.match_reason || '').trim();
    const strategyDisposition = getEntryStrategyDisposition(options);
    const laneDisposition = getEntryLaneDisposition(options);
    const hasCandidates = Array.isArray(options.candidateTasks)
        ? options.candidateTasks.length > 0
        : Boolean(options.hasCandidates);

    if (laneDisposition === LANE_DISPOSITION_MIXED) {
        return {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command:
                REMEDIATION_STEP_DEFINITIONS.split_mixed_lane_worktree.command,
            summary(count) {
                return `Hay ${count} cambio(s) authored mezclando lanes o subfrentes; separa el corte antes de publicar o sincronizar.${taskLabel}`;
            },
        };
    }

    if (strategyDisposition === STRATEGY_DISPOSITION_MIXED) {
        return {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command: REMEDIATION_STEP_DEFINITIONS.review_strategy_drift.command,
            summary(count) {
                return `Hay ${count} cambio(s) authored mezclando subfrentes de strategy.active${taskLabel}.`;
            },
        };
    }

    if (strategyDisposition === STRATEGY_DISPOSITION_BLOCKED_SCOPE) {
        return {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command: REMEDIATION_STEP_DEFINITIONS.review_strategy_drift.command,
            summary(count) {
                return `Hay ${count} cambio(s) authored en scopes bloqueados por strategy.active${taskLabel}.`;
            },
        };
    }

    if (strategyDisposition === STRATEGY_DISPOSITION_OUTSIDE_STRATEGY) {
        return {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command: REMEDIATION_STEP_DEFINITIONS.review_strategy_drift.command,
            summary(count) {
                return `Hay ${count} cambio(s) authored fuera de strategy.active${taskLabel}.`;
            },
        };
    }

    if (disposition === SCOPE_DISPOSITION_IN_SCOPE) {
        return {
            severity: ISSUE_SEVERITY_WARN,
            blocksPublish: false,
            blocksSync: false,
            blocksCi: false,
            command:
                REMEDIATION_STEP_DEFINITIONS.continue_in_scope_task.command,
            summary(count) {
                if (strategyDisposition === STRATEGY_DISPOSITION_SUPPORT_ONLY) {
                    return `Hay ${count} cambio(s) authored de soporte alineados al scope activo${taskLabel}.`;
                }
                return `Hay ${count} cambio(s) authored alineados al scope activo${taskLabel}.`;
            },
        };
    }

    if (disposition === SCOPE_DISPOSITION_OUT_OF_SCOPE) {
        return {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command:
                REMEDIATION_STEP_DEFINITIONS.review_out_of_scope_authored
                    .command,
            summary(count) {
                return `Hay ${count} cambio(s) authored fuera del scope activo${taskLabel}.`;
            },
        };
    }

    return {
        severity: ISSUE_SEVERITY_WARN,
        blocksPublish: false,
        blocksSync: true,
        blocksCi: false,
        command: hasCandidates
            ? REMEDIATION_STEP_DEFINITIONS.inspect_candidate_tasks.command
            : REMEDIATION_STEP_DEFINITIONS.clarify_scope_context.command,
        summary(count) {
            const suffix = matchReason ? ` ${matchReason}` : '';
            const candidateSuffix = hasCandidates
                ? ' Hay tareas candidatas para inspeccionar.'
                : '';
            return `Hay ${count} cambio(s) authored con scope sin aclarar.${suffix}${candidateSuffix}`;
        },
    };
}

function getEntryStrategyDisposition(entry) {
    const category = String(entry?.category || AUTHORED_CATEGORY).trim();
    if (category !== AUTHORED_CATEGORY) {
        return STRATEGY_DISPOSITION_NONE;
    }

    const disposition = String(
        entry?.strategy_disposition || entry?.strategyDisposition || ''
    ).trim();
    if (
        [
            STRATEGY_DISPOSITION_ALIGNED,
            STRATEGY_DISPOSITION_SUPPORT_ONLY,
            STRATEGY_DISPOSITION_MIXED,
            STRATEGY_DISPOSITION_BLOCKED_SCOPE,
            STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
            STRATEGY_DISPOSITION_UNKNOWN,
            STRATEGY_DISPOSITION_NONE,
        ].includes(disposition)
    ) {
        return disposition;
    }

    return STRATEGY_DISPOSITION_UNKNOWN;
}

function getEntryLaneDisposition(entry) {
    const category = String(entry?.category || AUTHORED_CATEGORY).trim();
    if (category !== AUTHORED_CATEGORY) {
        return LANE_DISPOSITION_NONE;
    }

    const disposition = String(
        entry?.lane_disposition || entry?.laneDisposition || ''
    ).trim();
    if (
        [
            LANE_DISPOSITION_MIXED,
            LANE_DISPOSITION_UNKNOWN,
            LANE_DISPOSITION_SINGLE,
            LANE_DISPOSITION_NONE,
        ].includes(disposition)
    ) {
        return disposition;
    }

    return LANE_DISPOSITION_UNKNOWN;
}

function getIssueConfig(category, options = {}) {
    if (category === AUTHORED_CATEGORY) {
        return getAuthoredIssueConfig(
            options.scopeDisposition || SCOPE_DISPOSITION_UNKNOWN,
            options
        );
    }

    return (
        ISSUE_CONFIG[category] || {
            severity: ISSUE_SEVERITY_BLOCKING,
            blocksPublish: true,
            blocksSync: true,
            blocksCi: true,
            command:
                REMEDIATION_STEP_DEFINITIONS.review_out_of_scope_authored
                    .command,
            summary(count) {
                return `Hay ${count} cambio(s) en la categoria ${category}.`;
            },
        }
    );
}

function buildIssueFromPaths(category, paths = [], options = {}) {
    const normalizedPaths = normalizeIssuePaths(paths);
    const sampleLimit = Number.isFinite(options.sampleLimit)
        ? Math.max(1, Math.floor(options.sampleLimit))
        : DEFAULT_PATH_SAMPLE_LIMIT;
    const count = Number.isFinite(options.count)
        ? Number(options.count)
        : normalizedPaths.length;
    const pathsSample = normalizedPaths.slice(0, sampleLimit);
    const config = getIssueConfig(category, options);
    const issue = {
        category,
        severity: config.severity,
        count,
        paths_sample: pathsSample,
        remaining_count: Math.max(0, count - pathsSample.length),
        blocks_publish: Boolean(config.blocksPublish),
        blocks_sync: Boolean(config.blocksSync),
        blocks_ci: Boolean(config.blocksCi),
        suggested_command: config.command,
        summary: config.summary(count),
    };

    if (category === AUTHORED_CATEGORY) {
        issue.scope_disposition =
            options.scopeDisposition || SCOPE_DISPOSITION_UNKNOWN;
        issue.strategy_disposition =
            options.strategyDisposition || STRATEGY_DISPOSITION_UNKNOWN;
        issue.lane_disposition =
            options.laneDisposition || LANE_DISPOSITION_UNKNOWN;
        if (options.taskId) {
            issue.task_id = String(options.taskId).trim();
        }
    } else {
        issue.scope_disposition = SCOPE_DISPOSITION_NONE;
        issue.strategy_disposition = STRATEGY_DISPOSITION_NONE;
        issue.lane_disposition = LANE_DISPOSITION_NONE;
    }

    return issue;
}

function buildIssueFromEntries(category, entries = [], options = {}) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    return buildIssueFromPaths(
        category,
        safeEntries.map((entry) => entry.path),
        {
            ...options,
            count: safeEntries.length,
        }
    );
}

function sortIssues(issues = []) {
    return [...issues].sort((left, right) => {
        const severityDiff =
            (ISSUE_SEVERITY_PRIORITY.get(left.severity) ?? 999) -
            (ISSUE_SEVERITY_PRIORITY.get(right.severity) ?? 999);
        if (severityDiff !== 0) {
            return severityDiff;
        }

        const categoryDiff =
            (ISSUE_CATEGORY_PRIORITY.get(left.category) ?? 999) -
            (ISSUE_CATEGORY_PRIORITY.get(right.category) ?? 999);
        if (categoryDiff !== 0) {
            return categoryDiff;
        }

        const dispositionDiff =
            (SCOPE_DISPOSITION_PRIORITY.get(left.scope_disposition) ?? 999) -
            (SCOPE_DISPOSITION_PRIORITY.get(right.scope_disposition) ?? 999);
        if (dispositionDiff !== 0) {
            return dispositionDiff;
        }

        const strategyDiff =
            (STRATEGY_DISPOSITION_PRIORITY.get(left.strategy_disposition) ??
                999) -
            (STRATEGY_DISPOSITION_PRIORITY.get(right.strategy_disposition) ??
                999);
        if (strategyDiff !== 0) {
            return strategyDiff;
        }

        const laneDiff =
            (LANE_DISPOSITION_PRIORITY.get(left.lane_disposition) ?? 999) -
            (LANE_DISPOSITION_PRIORITY.get(right.lane_disposition) ?? 999);
        if (laneDiff !== 0) {
            return laneDiff;
        }

        const countDiff = Number(right.count || 0) - Number(left.count || 0);
        if (countDiff !== 0) {
            return countDiff;
        }

        return String(left.category || '').localeCompare(
            String(right.category || '')
        );
    });
}

function buildIssues(entries = [], options = {}) {
    const grouped = new Map();
    for (const entry of Array.isArray(entries) ? entries : []) {
        const category = entry.category || classifyDirtyPath(entry.path);
        const scopeDisposition = getEntryScopeDisposition(entry);
        const strategyDisposition = getEntryStrategyDisposition(entry);
        const laneDisposition = getEntryLaneDisposition(entry);
        const taskId =
            category === AUTHORED_CATEGORY
                ? String(
                      entry.task_id || options.scopeContext?.task_id || ''
                  ).trim()
                : '';
        const key =
            category === AUTHORED_CATEGORY
                ? `${category}:${scopeDisposition}:${strategyDisposition}:${laneDisposition}:${taskId}`
                : category;

        if (!grouped.has(key)) {
            grouped.set(key, {
                category,
                scopeDisposition,
                strategyDisposition,
                laneDisposition,
                taskId,
                entries: [],
            });
        }
        grouped.get(key).entries.push(entry);
    }

    const issues = Array.from(grouped.values()).map((group) =>
        buildIssueFromEntries(group.category, group.entries, {
            sampleLimit: options.sampleLimit,
            scopeDisposition: group.scopeDisposition,
            strategyDisposition: group.strategyDisposition,
            laneDisposition: group.laneDisposition,
            taskId: group.taskId,
            scopeContext: options.scopeContext,
            candidateTasks:
                group.category === AUTHORED_CATEGORY
                    ? options.candidateTasks
                    : [],
        })
    );

    return sortIssues(issues);
}

function buildIssueCounts(issues = []) {
    const counts = {};
    for (const issue of Array.isArray(issues) ? issues : []) {
        counts[issue.category] =
            (counts[issue.category] || 0) + Number(issue.count || 0);
    }
    return counts;
}

function buildScopeCounts(issues = []) {
    const counts = {};
    for (const issue of Array.isArray(issues) ? issues : []) {
        const disposition = String(issue.scope_disposition || '').trim();
        if (!disposition || disposition === SCOPE_DISPOSITION_NONE) {
            continue;
        }
        counts[disposition] =
            (counts[disposition] || 0) + Number(issue.count || 0);
    }
    return counts;
}

function buildStrategyCounts(issues = []) {
    const counts = {};
    for (const issue of Array.isArray(issues) ? issues : []) {
        const disposition = String(issue.strategy_disposition || '').trim();
        if (!disposition || disposition === STRATEGY_DISPOSITION_NONE) {
            continue;
        }
        counts[disposition] =
            (counts[disposition] || 0) + Number(issue.count || 0);
    }
    return counts;
}

function buildLaneCounts(issues = []) {
    const counts = {};
    for (const issue of Array.isArray(issues) ? issues : []) {
        const disposition = String(issue.lane_disposition || '').trim();
        if (!disposition || disposition === LANE_DISPOSITION_NONE) {
            continue;
        }
        counts[disposition] =
            (counts[disposition] || 0) + Number(issue.count || 0);
    }
    return counts;
}

function hasIssue(issues = [], predicate) {
    return (Array.isArray(issues) ? issues : []).some(predicate);
}

function hasIssueCategory(issues = [], category) {
    return hasIssue(issues, (issue) => issue.category === category);
}

function hasEphemeralIssue(issues = []) {
    return hasIssue(issues, (issue) =>
        EPHEMERAL_DIRTY_CATEGORIES.has(issue.category)
    );
}

function buildBlockingCategories(issues = []) {
    const categories = new Set();
    for (const issue of Array.isArray(issues) ? issues : []) {
        if (issue.blocks_publish || issue.blocks_sync || issue.blocks_ci) {
            categories.add(issue.category);
        }
    }
    return ISSUE_CATEGORY_ORDER.filter((category) => categories.has(category));
}

function buildSafeFixes(issues = []) {
    const fixes = [];

    if (hasEphemeralIssue(issues)) {
        fixes.push({
            id: 'apply_safe',
            description:
                'Limpia stage root, deploy bundle, artefactos locales y colas derivadas sin tocar source authored.',
            command: REMEDIATION_STEP_DEFINITIONS.apply_safe.command,
        });
    }

    if (hasIssueCategory(issues, LOCAL_ARTIFACT_CATEGORY)) {
        fixes.push({
            id: 'clean_local_artifacts',
            description: 'Limpia solo artefactos efimeros locales conocidos.',
            command: 'npm run clean:local:artifacts',
        });
    }

    return fixes;
}

function buildManualActions(
    issues = [],
    _scopeContext = null,
    strategyContext = null,
    laneContext = null,
    candidateTasks = []
) {
    const actions = [];

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_UNKNOWN
        )
    ) {
        actions.push({
            id:
                Array.isArray(candidateTasks) && candidateTasks.length > 0
                    ? REMEDIATION_STEP_DEFINITIONS.inspect_candidate_tasks.id
                    : REMEDIATION_STEP_DEFINITIONS.clarify_scope_context.id,
            description:
                Array.isArray(candidateTasks) && candidateTasks.length > 0
                    ? REMEDIATION_STEP_DEFINITIONS.inspect_candidate_tasks
                          .summary
                    : REMEDIATION_STEP_DEFINITIONS.clarify_scope_context
                          .summary,
            command:
                Array.isArray(candidateTasks) && candidateTasks.length > 0
                    ? REMEDIATION_STEP_DEFINITIONS.inspect_candidate_tasks
                          .command
                    : REMEDIATION_STEP_DEFINITIONS.clarify_scope_context
                          .command,
        });
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.lane_disposition === LANE_DISPOSITION_MIXED
        ) ||
        laneContext?.resolution === LANE_CONTEXT_MIXED
    ) {
        actions.push({
            id: REMEDIATION_STEP_DEFINITIONS.split_mixed_lane_worktree.id,
            description:
                REMEDIATION_STEP_DEFINITIONS.split_mixed_lane_worktree.summary,
            command:
                REMEDIATION_STEP_DEFINITIONS.split_mixed_lane_worktree.command,
        });
    }

    if (hasIssueCategory(issues, LEGACY_GENERATED_ROOT_CATEGORY)) {
        actions.push({
            id: REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup.id,
            description:
                REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup.summary,
            command: REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup.command,
        });
    }

    if (hasIssueCategory(issues, LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY)) {
        actions.push({
            id: REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex.id,
            description:
                REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex
                    .summary,
            command:
                REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex
                    .command,
        });
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                [
                    STRATEGY_DISPOSITION_MIXED,
                    STRATEGY_DISPOSITION_BLOCKED_SCOPE,
                    STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
                ].includes(issue.strategy_disposition)
        ) ||
        [
            STRATEGY_CONTEXT_BLOCKED_SCOPE,
            STRATEGY_CONTEXT_OUTSIDE_STRATEGY,
            STRATEGY_CONTEXT_MIXED,
        ].includes(strategyContext?.resolution)
    ) {
        actions.push({
            id: REMEDIATION_STEP_DEFINITIONS.review_strategy_drift.id,
            description:
                REMEDIATION_STEP_DEFINITIONS.review_strategy_drift.summary,
            command: REMEDIATION_STEP_DEFINITIONS.review_strategy_drift.command,
        });
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_OUT_OF_SCOPE
        )
    ) {
        actions.push({
            id: REMEDIATION_STEP_DEFINITIONS.review_out_of_scope_authored.id,
            description:
                REMEDIATION_STEP_DEFINITIONS.review_out_of_scope_authored
                    .summary,
            command:
                REMEDIATION_STEP_DEFINITIONS.review_out_of_scope_authored
                    .command,
        });
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_IN_SCOPE
        ) &&
        !hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_OUT_OF_SCOPE
        )
    ) {
        actions.push({
            id: REMEDIATION_STEP_DEFINITIONS.continue_in_scope_task.id,
            description:
                REMEDIATION_STEP_DEFINITIONS.continue_in_scope_task.summary,
            command:
                REMEDIATION_STEP_DEFINITIONS.continue_in_scope_task.command,
        });
    }

    return actions;
}

function pushRemediationStep(plan, stepDefinition) {
    if (!stepDefinition) return;
    if (plan.some((step) => step.id === stepDefinition.id)) {
        return;
    }
    plan.push({ ...stepDefinition });
}

function buildRemediationPlan(issues = [], _scopeContext = null, options = {}) {
    const plan = [];
    const candidateTasks = Array.isArray(options.candidateTasks)
        ? options.candidateTasks
        : [];

    if (hasEphemeralIssue(issues)) {
        pushRemediationStep(plan, REMEDIATION_STEP_DEFINITIONS.apply_safe);
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.lane_disposition === LANE_DISPOSITION_MIXED
        )
    ) {
        pushRemediationStep(
            plan,
            REMEDIATION_STEP_DEFINITIONS.split_mixed_lane_worktree
        );
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_UNKNOWN
        )
    ) {
        pushRemediationStep(
            plan,
            candidateTasks.length > 0
                ? REMEDIATION_STEP_DEFINITIONS.inspect_candidate_tasks
                : REMEDIATION_STEP_DEFINITIONS.clarify_scope_context
        );
    }

    if (hasIssueCategory(issues, LEGACY_GENERATED_ROOT_CATEGORY)) {
        pushRemediationStep(
            plan,
            REMEDIATION_STEP_DEFINITIONS.legacy_root_cleanup
        );
    }

    if (hasIssueCategory(issues, LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY)) {
        pushRemediationStep(
            plan,
            REMEDIATION_STEP_DEFINITIONS.commit_or_stash_legacy_deindex
        );
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                [
                    STRATEGY_DISPOSITION_MIXED,
                    STRATEGY_DISPOSITION_BLOCKED_SCOPE,
                    STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
                ].includes(issue.strategy_disposition)
        )
    ) {
        pushRemediationStep(
            plan,
            REMEDIATION_STEP_DEFINITIONS.review_strategy_drift
        );
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_OUT_OF_SCOPE
        )
    ) {
        pushRemediationStep(
            plan,
            REMEDIATION_STEP_DEFINITIONS.review_out_of_scope_authored
        );
    }

    if (
        hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition === SCOPE_DISPOSITION_IN_SCOPE
        ) &&
        !hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                [
                    SCOPE_DISPOSITION_OUT_OF_SCOPE,
                    SCOPE_DISPOSITION_UNKNOWN,
                ].includes(issue.scope_disposition)
        ) &&
        !hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                [
                    STRATEGY_DISPOSITION_MIXED,
                    STRATEGY_DISPOSITION_BLOCKED_SCOPE,
                    STRATEGY_DISPOSITION_OUTSIDE_STRATEGY,
                ].includes(issue.strategy_disposition)
        ) &&
        !hasIssue(
            issues,
            (issue) =>
                issue.category === AUTHORED_CATEGORY &&
                issue.lane_disposition === LANE_DISPOSITION_MIXED
        ) &&
        !hasIssueCategory(issues, LEGACY_GENERATED_ROOT_CATEGORY) &&
        !hasIssueCategory(issues, LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY)
    ) {
        pushRemediationStep(
            plan,
            REMEDIATION_STEP_DEFINITIONS.continue_in_scope_task
        );
    }

    if (issues.length > 0 || options.forceRerun || options.error) {
        pushRemediationStep(plan, REMEDIATION_STEP_DEFINITIONS.rerun_doctor);
    }

    return plan;
}

function resolveOverallState(issues = [], error = null) {
    if (error) {
        return DOCTOR_STATE_ERROR;
    }

    if (!Array.isArray(issues) || issues.length === 0) {
        return DOCTOR_STATE_CLEAN;
    }

    if (issues.some((issue) => issue.severity === ISSUE_SEVERITY_ERROR)) {
        return DOCTOR_STATE_ERROR;
    }

    if (issues.some((issue) => issue.severity === ISSUE_SEVERITY_BLOCKING)) {
        return DOCTOR_STATE_BLOCKED;
    }

    if (issues.some((issue) => issue.severity === ISSUE_SEVERITY_WARN)) {
        return DOCTOR_STATE_ATTENTION;
    }

    return DOCTOR_STATE_FIXABLE;
}

function buildNextCommand(overallState, remediationPlan = [], error = null) {
    if (overallState === DOCTOR_STATE_ERROR || error) {
        return 'git worktree list --porcelain';
    }
    return remediationPlan.length > 0 ? remediationPlan[0].command : '';
}

function sanitizeScopeContext(scopeContext, entries = []) {
    if (scopeContext && typeof scopeContext === 'object') {
        return buildScopeContext(scopeContext.resolution, {
            task: scopeContext.task_id
                ? {
                      id: scopeContext.task_id,
                      codex_instance: scopeContext.codex_instance,
                      domain_lane: scopeContext.domain_lane,
                      scope: scopeContext.scope,
                      subfront_id: scopeContext.subfront_id,
                      strategy_id: scopeContext.strategy_id,
                      strategy_role: scopeContext.strategy_role,
                  }
                : null,
            matchReason: scopeContext.match_reason,
            matchedPaths: scopeContext.matched_paths_sample,
        });
    }

    const hasAuthoredEntries = (Array.isArray(entries) ? entries : []).some(
        (entry) => entry.category === AUTHORED_CATEGORY
    );
    return buildScopeContext(
        hasAuthoredEntries ? SCOPE_RESOLUTION_UNKNOWN : SCOPE_RESOLUTION_NONE,
        {
            matchReason: hasAuthoredEntries
                ? 'No se pudo determinar el scope de los cambios authored.'
                : 'No hay cambios authored en este worktree.',
        }
    );
}

function buildIssueDiagnosis(entries = [], options = {}) {
    const dirtyEntries = Array.isArray(entries) ? entries : [];
    const scopeContext = sanitizeScopeContext(
        options.scopeContext,
        dirtyEntries
    );
    const hasAuthoredEntries = dirtyEntries.some(
        (entry) => entry.category === AUTHORED_CATEGORY
    );
    const laneContext =
        options.laneContext && typeof options.laneContext === 'object'
            ? buildLaneContext(options.laneContext.resolution, {
                  primaryLane: options.laneContext.primary_lane,
                  codexInstance: options.laneContext.codex_instance,
                  lanes: options.laneContext.lanes,
                  counts: options.laneContext.counts,
                  matchReason: options.laneContext.match_reason,
                  matchedPaths: options.laneContext.matched_paths_sample,
              })
            : buildLaneContext(
                  hasAuthoredEntries ? LANE_CONTEXT_UNKNOWN : LANE_CONTEXT_NONE,
                  {
                      matchReason: hasAuthoredEntries
                          ? 'No se pudo determinar el lane de los cambios authored.'
                          : 'No hay cambios authored en este worktree.',
                  }
              );
    const strategyContext =
        options.strategyContext && typeof options.strategyContext === 'object'
            ? buildStrategyContext(options.strategyContext.resolution, {
                  strategy: options.strategyContext.strategy_id
                      ? {
                            id: options.strategyContext.strategy_id,
                            status: options.strategyContext.strategy_status,
                        }
                      : null,
                  primarySubfrontId:
                      options.strategyContext.primary_subfront_id,
                  primaryCodexInstance:
                      options.strategyContext.primary_codex_instance,
                  affectedSubfrontIds:
                      options.strategyContext.affected_subfront_ids,
                  affectedScopes: options.strategyContext.affected_scopes,
                  matchReason: options.strategyContext.match_reason,
                  matchedPaths: options.strategyContext.matched_paths_sample,
              })
            : buildStrategyContext(
                  hasAuthoredEntries
                      ? STRATEGY_CONTEXT_UNKNOWN
                      : STRATEGY_CONTEXT_NONE,
                  {
                      matchReason: hasAuthoredEntries
                          ? 'No se pudo mapear strategy.active para estos cambios authored.'
                          : 'No hay cambios authored en este worktree.',
                  }
              );
    const candidateTasks = Array.isArray(options.candidateTasks)
        ? options.candidateTasks
        : [];
    const splitPlan = Array.isArray(options.splitPlan) ? options.splitPlan : [];
    const issues = sortIssues(
        Array.isArray(options.issues)
            ? options.issues
            : buildIssues(dirtyEntries, {
                  sampleLimit: options.sampleLimit,
                  scopeContext,
                  candidateTasks,
              })
    );
    const issueCounts = buildIssueCounts(issues);
    const scopeCounts = buildScopeCounts(issues);
    const strategyCounts = buildStrategyCounts(issues);
    const laneCounts = buildLaneCounts(issues);
    const summary = summarizeDirtyEntries(dirtyEntries);
    const overallState = resolveOverallState(issues, options.error);
    const remediationPlan = buildRemediationPlan(issues, scopeContext, {
        error: options.error,
        candidateTasks,
        forceRerun:
            overallState !== DOCTOR_STATE_CLEAN || Boolean(options.forceRerun),
    });
    return {
        overall_state: overallState,
        dirty_total: Number(summary.total || 0),
        issue_counts: issueCounts,
        scope_counts: scopeCounts,
        strategy_counts: strategyCounts,
        lane_counts: laneCounts,
        issues,
        remediation_plan: remediationPlan,
        next_command: buildNextCommand(
            overallState,
            remediationPlan,
            options.error
        ),
        summary,
        scope_context: scopeContext,
        strategy_context: strategyContext,
        lane_context: laneContext,
        candidate_tasks: candidateTasks,
        split_plan: splitPlan,
        blockingCategories: buildBlockingCategories(issues),
        safeFixes: buildSafeFixes(issues),
        manualActions: buildManualActions(
            issues,
            scopeContext,
            strategyContext,
            laneContext,
            candidateTasks
        ),
    };
}

function serializeDirtyEntry(entry) {
    const payload = {
        status: entry.status,
        path: entry.path,
        raw_path: entry.rawPath,
        category: entry.category,
    };
    if (entry.scope_disposition) {
        payload.scope_disposition = entry.scope_disposition;
    }
    if (entry.strategy_disposition) {
        payload.strategy_disposition = entry.strategy_disposition;
    }
    if (entry.lane_disposition) {
        payload.lane_disposition = entry.lane_disposition;
    }
    if (entry.scope_hint) {
        payload.scope_hint = entry.scope_hint;
    }
    if (entry.strategy_subfront_id) {
        payload.strategy_subfront_id = entry.strategy_subfront_id;
    }
    if (entry.codex_instance_hint) {
        payload.codex_instance_hint = entry.codex_instance_hint;
    }
    if (entry.task_id) {
        payload.task_id = entry.task_id;
    }
    return payload;
}

function toDoctorRowPayload(row, options = {}) {
    const payload = {
        path: row.path,
        branch: row.branch,
        overall_state: row.overall_state,
        dirty_total: row.dirty_total,
        issue_counts: row.issue_counts,
        scope_counts: row.scope_counts,
        strategy_counts: row.strategy_counts,
        lane_counts: row.lane_counts,
        scope_context: row.scope_context,
        strategy_context: row.strategy_context,
        lane_context: row.lane_context,
        candidate_tasks: row.candidate_tasks,
        split_plan: row.split_plan,
        issues: row.issues,
        remediation_plan: row.remediation_plan,
        next_command: row.next_command,
    };

    if (Array.isArray(row.removed) && row.removed.length > 0) {
        payload.removed = row.removed;
    }

    if (options.includeEntries) {
        payload.dirty_entries = Array.isArray(row.dirtyEntries)
            ? row.dirtyEntries.map(serializeDirtyEntry)
            : [];
    }

    if (row.error) {
        payload.error = row.error;
    }

    return payload;
}

function buildDoctorSummary(rows = []) {
    const issueTotals = {};
    const scopeTotals = {};
    const strategyTotals = {};
    const laneTotals = {};

    for (const row of rows) {
        for (const [category, count] of Object.entries(
            row.issue_counts || {}
        )) {
            issueTotals[category] =
                (issueTotals[category] || 0) + Number(count || 0);
        }
        for (const [disposition, count] of Object.entries(
            row.scope_counts || {}
        )) {
            scopeTotals[disposition] =
                (scopeTotals[disposition] || 0) + Number(count || 0);
        }
        for (const [disposition, count] of Object.entries(
            row.strategy_counts || {}
        )) {
            strategyTotals[disposition] =
                (strategyTotals[disposition] || 0) + Number(count || 0);
        }
        for (const [disposition, count] of Object.entries(
            row.lane_counts || {}
        )) {
            laneTotals[disposition] =
                (laneTotals[disposition] || 0) + Number(count || 0);
        }
    }

    return {
        total_worktrees: rows.length,
        dirty_worktrees: rows.filter((row) => Number(row.dirty_total || 0) > 0)
            .length,
        blocked_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_BLOCKED
        ).length,
        attention_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_ATTENTION
        ).length,
        fixable_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_FIXABLE
        ).length,
        clean_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_CLEAN
        ).length,
        error_worktrees: rows.filter(
            (row) => row.overall_state === DOCTOR_STATE_ERROR
        ).length,
        issue_totals: {
            byCategory: Object.fromEntries(
                ISSUE_CATEGORY_ORDER.filter(
                    (category) => issueTotals[category] > 0
                ).map((category) => [category, issueTotals[category]])
            ),
            byScopeDisposition: Object.fromEntries(
                SCOPE_DISPOSITION_ORDER.filter(
                    (disposition) =>
                        disposition !== SCOPE_DISPOSITION_NONE &&
                        scopeTotals[disposition] > 0
                ).map((disposition) => [disposition, scopeTotals[disposition]])
            ),
            byStrategyDisposition: Object.fromEntries(
                STRATEGY_DISPOSITION_ORDER.filter(
                    (disposition) =>
                        disposition !== STRATEGY_DISPOSITION_NONE &&
                        strategyTotals[disposition] > 0
                ).map((disposition) => [
                    disposition,
                    strategyTotals[disposition],
                ])
            ),
            byLaneDisposition: Object.fromEntries(
                LANE_DISPOSITION_ORDER.filter(
                    (disposition) =>
                        disposition !== LANE_DISPOSITION_NONE &&
                        laneTotals[disposition] > 0
                ).map((disposition) => [disposition, laneTotals[disposition]])
            ),
        },
    };
}

function buildDoctorPayload(diagnosis, options = {}) {
    const rows = Array.isArray(diagnosis?.rows)
        ? diagnosis.rows.map((row) => toDoctorRowPayload(row, options))
        : [];
    return {
        version: DOCTOR_VERSION,
        command: options.command || 'workspace-hygiene doctor',
        summary: diagnosis?.summary || buildDoctorSummary([]),
        rows,
        ok: rows.every((row) => row.overall_state === DOCTOR_STATE_CLEAN),
    };
}

function buildErrorRow(rootPath, branch, error) {
    const diagnosis = buildIssueDiagnosis([], {
        error,
        forceRerun: true,
    });
    return {
        path: rootPath,
        branch,
        dirtyEntries: [],
        ...diagnosis,
        error: String(error && error.message ? error.message : error),
    };
}

function diagnoseWorktree(rootPath, options = {}) {
    const trackedLegacyPaths = Array.isArray(options.trackedLegacyPaths)
        ? options.trackedLegacyPaths
        : listTrackedLegacyGeneratedRootPaths(rootPath);
    const rawDirtyEntries = Array.isArray(options.dirtyEntries)
        ? annotateLegacyDirtyEntries(options.dirtyEntries, trackedLegacyPaths)
        : readDirtyEntries(rootPath, { trackedLegacyPaths });
    const scopeResolution = resolveScopeContext(
        rootPath,
        rawDirtyEntries,
        options
    );
    const dirtyEntries = annotateAuthoredScopeEntries(
        rawDirtyEntries,
        scopeResolution
    );
    const authoredContext = annotateAuthoredStrategyAndLane(
        rootPath,
        dirtyEntries,
        scopeResolution.context,
        options
    );
    const branch = options.branch
        ? String(options.branch)
        : readCurrentBranch(rootPath);
    const diagnosis = buildIssueDiagnosis(authoredContext.entries, {
        sampleLimit: options.sampleLimit,
        scopeContext: scopeResolution.context,
        strategyContext: authoredContext.strategyContext,
        laneContext: authoredContext.laneContext,
        candidateTasks: authoredContext.candidateTasks,
        splitPlan: authoredContext.splitPlan,
    });

    return {
        path: rootPath,
        branch,
        dirtyEntries: authoredContext.entries,
        ...diagnosis,
    };
}

function topIssuePriority(row) {
    const firstIssue = Array.isArray(row.issues) ? row.issues[0] : null;
    if (!firstIssue) {
        return 999;
    }
    return ISSUE_CATEGORY_PRIORITY.get(firstIssue.category) ?? 999;
}

function sortDoctorRows(rows = []) {
    return [...rows].sort((left, right) => {
        const stateDiff =
            (WORKTREE_STATE_PRIORITY.get(left.overall_state) ?? 999) -
            (WORKTREE_STATE_PRIORITY.get(right.overall_state) ?? 999);
        if (stateDiff !== 0) {
            return stateDiff;
        }

        const issuePriorityDiff =
            topIssuePriority(left) - topIssuePriority(right);
        if (issuePriorityDiff !== 0) {
            return issuePriorityDiff;
        }

        const dirtyDiff =
            Number(right.dirty_total || 0) - Number(left.dirty_total || 0);
        if (dirtyDiff !== 0) {
            return dirtyDiff;
        }

        return String(left.path || '').localeCompare(String(right.path || ''));
    });
}

function collectDoctorTargets(cwd, options = {}) {
    const allWorktrees = options.currentOnly
        ? false
        : options.allWorktrees !== false;
    if (!allWorktrees) {
        return [
            {
                path: cwd,
                branch: readCurrentBranch(cwd),
                detached: false,
            },
        ];
    }

    const listedWorktrees = listWorktrees(cwd);
    if (listedWorktrees.length > 0) {
        return listedWorktrees;
    }

    return [
        {
            path: cwd,
            branch: readCurrentBranch(cwd),
            detached: false,
        },
    ];
}

function collectWorkspaceDoctor(cwd, options = {}) {
    const targets = collectDoctorTargets(cwd, options);
    const rows = [];

    for (const target of targets) {
        const branch = target.detached
            ? '(detached)'
            : target.branch || readCurrentBranch(target.path);
        try {
            if (options.applySafe) {
                rows.push(
                    fixWorkspace(target.path, {
                        includeDerivedQueue:
                            options.includeDerivedQueue !== false,
                        branch,
                        board: options.board,
                        boardPath: options.boardPath,
                        scopeTask: options.scopeTask,
                        scopeTaskId: options.scopeTaskId,
                        scopePatterns: options.scopePatterns,
                    })
                );
                continue;
            }

            rows.push(
                diagnoseWorktree(target.path, {
                    branch,
                    sampleLimit: options.sampleLimit,
                    board: options.board,
                    boardPath: options.boardPath,
                    scopeTask: options.scopeTask,
                    scopeTaskId: options.scopeTaskId,
                    scopePatterns: options.scopePatterns,
                })
            );
        } catch (error) {
            rows.push(buildErrorRow(target.path, branch, error));
        }
    }

    const sortedRows = sortDoctorRows(rows);
    return {
        rows: sortedRows,
        summary: buildDoctorSummary(sortedRows),
    };
}

function restoreDerivedQueueFiles(cwd) {
    const dirtyEntries = readDirtyEntries(cwd).filter((entry) =>
        DERIVED_QUEUE_FILES.has(entry.path.toLowerCase())
    );

    if (dirtyEntries.length === 0) {
        return [];
    }

    const files = dirtyEntries.map((entry) => entry.rawPath);
    const result = runGit(
        ['restore', '--worktree', '--source=HEAD', '--', ...files],
        cwd,
        true
    );
    if (result.status !== 0) {
        throw new Error(
            result.stderr || result.stdout || 'git restore derived queue failed'
        );
    }

    const refreshResult = runGit(
        ['update-index', '-q', '--refresh', '--', ...files],
        cwd,
        true
    );
    if (refreshResult.status !== 0) {
        throw new Error(
            refreshResult.stderr ||
                refreshResult.stdout ||
                'git update-index refresh derived queue failed'
        );
    }

    return files.map((file) => normalizeRelativePath(file));
}

function removeDirectoryIfPresent(rootPath, relativePath) {
    const absolutePath = path.resolve(rootPath, relativePath);
    if (!fs.existsSync(absolutePath)) {
        return false;
    }

    fs.rmSync(absolutePath, { recursive: true, force: true });
    return true;
}

function fixWorkspace(rootPath, options = {}) {
    const includeDerivedQueue = options.includeDerivedQueue !== false;
    const removed = [];

    if (removeDirectoryIfPresent(rootPath, GENERATED_SITE_ROOT_RELATIVE)) {
        removed.push(GENERATED_SITE_ROOT_RELATIVE);
    }

    if (removeDirectoryIfPresent(rootPath, DEPLOY_BUNDLE_RELATIVE)) {
        removed.push(DEPLOY_BUNDLE_RELATIVE);
    }

    const localArtifacts = collectExistingArtifacts(rootPath);
    const cleanedArtifacts = cleanArtifacts(localArtifacts, { dryRun: false });
    if (cleanedArtifacts.failures.length > 0) {
        throw new Error(
            cleanedArtifacts.failures
                .map(
                    (failure) =>
                        `${failure.artifact.relativePath}: ${failure.error.message}`
                )
                .join('\n')
        );
    }
    removed.push(
        ...cleanedArtifacts.removed.map((artifact) => artifact.relativePath)
    );

    if (includeDerivedQueue) {
        removed.push(...restoreDerivedQueueFiles(rootPath));
    }

    const diagnosis = diagnoseWorktree(rootPath, {
        branch: options.branch,
        board: options.board,
        boardPath: options.boardPath,
        scopeTask: options.scopeTask,
        scopeTaskId: options.scopeTaskId,
        scopePatterns: options.scopePatterns,
    });
    const authoredEntries = diagnosis.dirtyEntries.filter(
        (entry) => entry.category === AUTHORED_CATEGORY
    );
    const blockingEntries = diagnosis.dirtyEntries.filter((entry) =>
        BLOCKING_DIRTY_CATEGORIES.has(entry.category)
    );

    return {
        ...diagnosis,
        removed: Array.from(new Set(removed)).sort(),
        authoredEntries,
        blockingEntries,
        ok: diagnosis.overall_state === DOCTOR_STATE_CLEAN,
    };
}

function getBlockingIssues(diagnosis, mode = 'publish') {
    const key =
        mode === 'sync'
            ? 'blocks_sync'
            : mode === 'ci'
              ? 'blocks_ci'
              : 'blocks_publish';
    return sortIssues(
        (Array.isArray(diagnosis?.issues) ? diagnosis.issues : []).filter(
            (issue) => Boolean(issue[key])
        )
    );
}

function formatIssueSummary(issues = []) {
    return (Array.isArray(issues) ? issues : [])
        .map((issue) => {
            const disposition =
                issue.category === AUTHORED_CATEGORY &&
                issue.scope_disposition &&
                issue.scope_disposition !== SCOPE_DISPOSITION_NONE
                    ? `[${issue.scope_disposition}]`
                    : '';
            const strategyDisposition =
                issue.category === AUTHORED_CATEGORY &&
                issue.strategy_disposition &&
                issue.strategy_disposition !== STRATEGY_DISPOSITION_NONE
                    ? `{${issue.strategy_disposition}}`
                    : '';
            const laneDisposition =
                issue.category === AUTHORED_CATEGORY &&
                issue.lane_disposition &&
                issue.lane_disposition !== LANE_DISPOSITION_NONE
                    ? `<${issue.lane_disposition}>`
                    : '';
            return `${issue.category}${disposition}${strategyDisposition}${laneDisposition}=${issue.count}`;
        })
        .join(', ');
}

function getFirstRemediationStep(diagnosis) {
    return Array.isArray(diagnosis?.remediation_plan) &&
        diagnosis.remediation_plan.length > 0
        ? diagnosis.remediation_plan[0]
        : null;
}

module.exports = {
    AUTHORED_CATEGORY,
    BLOCKING_DIRTY_CATEGORIES,
    DEFAULT_PATH_SAMPLE_LIMIT,
    DEPLOY_BUNDLE_CATEGORY,
    DEPLOY_BUNDLE_RELATIVE,
    DERIVED_QUEUE_CATEGORY,
    DERIVED_QUEUE_FILES,
    DOCTOR_STATE_ATTENTION,
    DOCTOR_STATE_BLOCKED,
    DOCTOR_STATE_CLEAN,
    DOCTOR_STATE_ERROR,
    DOCTOR_STATE_FIXABLE,
    DOCTOR_STATE_PENDING_COMMIT,
    DOCTOR_VERSION,
    EPHEMERAL_DIRTY_CATEGORIES,
    GENERATED_STAGE_CATEGORY,
    IGNORED_PUBLISH_DIRTY_CATEGORIES,
    ISSUE_CATEGORY_ORDER,
    ISSUE_SEVERITY_BLOCKING,
    ISSUE_SEVERITY_ERROR,
    ISSUE_SEVERITY_FIXABLE,
    ISSUE_SEVERITY_WARN,
    LEGACY_GENERATED_ROOT_CATEGORY,
    LEGACY_GENERATED_ROOT_CONTRACT_PATHS,
    LEGACY_GENERATED_ROOT_DEINDEXED_CATEGORY,
    LOCAL_ARTIFACT_CATEGORY,
    LOCAL_ARTIFACT_PATHS,
    SCOPE_DISPOSITION_IN_SCOPE,
    SCOPE_DISPOSITION_NONE,
    SCOPE_DISPOSITION_OUT_OF_SCOPE,
    SCOPE_DISPOSITION_UNKNOWN,
    SCOPE_RESOLUTION_AMBIGUOUS,
    SCOPE_RESOLUTION_MATCHED,
    SCOPE_RESOLUTION_NONE,
    SCOPE_RESOLUTION_UNKNOWN,
    WORKTREE_STATES,
    annotateAuthoredScopeEntries,
    annotateLegacyDirtyEntries,
    buildBlockingCategories,
    buildDoctorPayload,
    buildDoctorSummary,
    buildIssueCounts,
    buildIssueDiagnosis,
    buildIssueFromEntries,
    buildIssueFromPaths,
    buildIssues,
    buildManualActions,
    buildNextCommand,
    buildRemediationPlan,
    buildSafeFixes,
    buildScopeContext,
    buildScopeCounts,
    classifyDirtyEntries,
    classifyDirtyPath,
    collectWorkspaceDoctor,
    diagnoseWorktree,
    fixWorkspace,
    formatIssueSummary,
    getBlockingIssues,
    getEntryScopeDisposition,
    getFirstRemediationStep,
    isDeployBundlePath,
    isEphemeralDirtyCategory,
    isIgnoredPublishDirtyCategory,
    isLocalArtifactPath,
    isPathAllowedByPatterns,
    listTrackedLegacyGeneratedRootPaths,
    listWorktrees,
    loadBoardForScope,
    normalizeMatchToken,
    parseGitStatusPorcelain,
    readDirtyEntries,
    resolveOverallState,
    resolveScopeContext,
    sortDoctorRows,
    sortIssues,
    summarizeDirtyEntries,
    toDoctorRowPayload,
    wildcardToRegex,
};
