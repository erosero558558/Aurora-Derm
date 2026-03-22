'use strict';

const domainStrategy = require('./strategy');
const domainFocus = require('./focus');

const DEFAULT_CRITICAL_SCOPE_KEYWORDS = [
    'payments',
    'auth',
    'calendar',
    'deploy',
    'env',
    'security',
];

const DEFAULT_ALLOWED_EXECUTORS = new Set(['codex']);
const DEFAULT_ALLOWED_CODEX_INSTANCES = new Set([
    'codex_backend_ops',
    'codex_frontend',
    'codex_transversal',
]);
const DEFAULT_ALLOWED_DOMAIN_LANES = new Set([
    'backend_ops',
    'frontend_content',
    'transversal_runtime',
]);
const DEFAULT_ALLOWED_LANE_LOCKS = new Set(['strict', 'handoff_allowed']);
const DEFAULT_ALLOWED_PROVIDER_MODES = new Set([
    'openclaw_chatgpt',
    'google_oauth',
]);
const DEFAULT_ALLOWED_RUNTIME_SURFACES = new Set([
    'figo_queue',
    'leadops_worker',
    'operator_auth',
]);
const DEFAULT_ALLOWED_RUNTIME_TRANSPORTS = new Set([
    'hybrid_http_cli',
    'http_bridge',
    'cli_helper',
]);
const DEFAULT_ACTIVE_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);

const DEFAULT_DUAL_CODEX_OWNERSHIP = {
    backend_ops: [
        'controllers/**',
        'lib/**',
        'api.php',
        'figo-*.php',
        '.github/workflows/**',
        'cron.php',
        'env*.php',
        'bin/**',
    ],
    frontend_content: [
        'src/apps/**',
        'js/**',
        'styles*.css',
        'templates/**',
        'content/**',
        '*.html',
    ],
    transversal_runtime: [
        'agent-orchestrator.js',
        'agents.md',
        'agent_board.yaml',
        'agent_handoffs.yaml',
        'agent_jobs.yaml',
        'agent_signals.yaml',
        'governance-policy.json',
        'docs/agent_orchestration_runbook.md',
        'docs/public_main_update_runbook.md',
        'docs/github_actions_deploy.md',
        'dual_codex_runbook.md',
        'tri_lane_runtime_runbook.md',
        'plan_maestro_codex_2026.md',
        'tests-node/agent-orchestrator-cli.test.js',
        'tests-node/orchestrator/**',
        'tests-node/publish-checkpoint-command.test.js',
        'tools/agent-orchestrator/**',
        'bin/validate-agent-governance.php',
        'figo-ai-bridge.php',
        'check-ai-response.php',
        'lib/figo_queue.php',
        'lib/figo_queue/**',
        'lib/auth.php',
        'lib/leadopsservice.php',
        'controllers/operatorauthcontroller.php',
        'controllers/leadaicontroller.php',
        'bin/lead-ai-worker.js',
        'bin/lib/lead-ai-worker.js',
    ],
};

const DEFAULT_TRANSVERSAL_PRIORITY_PATTERNS =
    DEFAULT_DUAL_CODEX_OWNERSHIP.transversal_runtime;
const FRONTEND_PUBLIC_RELEASE_SUPPORT_PATTERNS = [
    'tests-node/public-v6-*.test.js',
    'tests/booking.spec.js',
    'tests/chat-booking-calendar-errors.spec.js',
    'tests/checklist-production.spec.js',
    'tests/deferred-shell-static-fallback.spec.js',
    'tests/funnel-tracking.spec.js',
    'tests/public-v6-case-stories.spec.js',
    'tests/public-v6-news-strip.spec.js',
    'verification/public-v6-canonical/**',
    'package.json',
];

function normalizePathToken(value) {
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

function pathMatchesPattern(path, pattern) {
    const safePath = normalizePathToken(path);
    const safePattern = normalizePathToken(pattern);
    if (!safePath || !safePattern) return false;
    return wildcardToRegex(safePattern).test(safePath);
}

function normalizeOptionalToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const raw = String(value || '')
        .trim()
        .toLowerCase();
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'y', 'si', 's', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function mapLaneToCodexInstance(domainLane) {
    const lane = normalizeOptionalToken(domainLane);
    if (lane === 'frontend_content') return 'codex_frontend';
    if (lane === 'transversal_runtime') return 'codex_transversal';
    return 'codex_backend_ops';
}

function expectedProviderModeForSurface(runtimeSurface) {
    return normalizeOptionalToken(runtimeSurface) === 'operator_auth'
        ? 'google_oauth'
        : 'openclaw_chatgpt';
}

function isOpenClawRuntimeTask(task) {
    const providerMode = normalizeOptionalToken(task?.provider_mode);
    const runtimeSurface = normalizeOptionalToken(task?.runtime_surface);
    const runtimeTransport = normalizeOptionalToken(task?.runtime_transport);
    const runtimeLastTransport = normalizeOptionalToken(
        task?.runtime_last_transport
    );
    return Boolean(
        providerMode === 'openclaw_chatgpt' ||
        runtimeSurface ||
        runtimeTransport ||
        runtimeLastTransport
    );
}

function inferOpenClawRuntimeSurface(task) {
    const corpus = [
        String(task?.scope || ''),
        String(task?.title || ''),
        String(task?.acceptance || ''),
        String(task?.prompt || ''),
        String(task?.source_ref || ''),
        ...(Array.isArray(task?.files) ? task.files : []),
    ]
        .join(' ')
        .toLowerCase();

    if (
        corpus.includes('operator auth') ||
        corpus.includes('operator-auth') ||
        corpus.includes('operator_auth') ||
        corpus.includes('lib/auth.php') ||
        corpus.includes('controllers/operatorauthcontroller.php')
    ) {
        return 'operator_auth';
    }
    if (
        corpus.includes('leadops') ||
        corpus.includes('lead ops') ||
        corpus.includes('lead-ai-worker') ||
        corpus.includes('lead_ai_worker') ||
        corpus.includes('lead-ai-queue') ||
        corpus.includes('lead-ai-result') ||
        corpus.includes('lib/leadopsservice.php') ||
        corpus.includes('controllers/leadaicontroller.php')
    ) {
        return 'leadops_worker';
    }
    if (
        corpus.includes('figo queue') ||
        corpus.includes('figo-ai-bridge') ||
        corpus.includes('figo_queue') ||
        corpus.includes('lib/figo_queue.php') ||
        corpus.includes('check-ai-response') ||
        corpus.includes('openclaw')
    ) {
        return 'figo_queue';
    }
    return 'figo_queue';
}

function findCriticalScopeKeyword(
    scopeValue,
    criticalScopeKeywords = DEFAULT_CRITICAL_SCOPE_KEYWORDS
) {
    const scope = String(scopeValue || '')
        .trim()
        .toLowerCase();
    if (!scope) return null;
    for (const keyword of criticalScopeKeywords) {
        if (scope.includes(String(keyword || '').toLowerCase())) {
            return String(keyword || '').toLowerCase();
        }
    }
    return null;
}

function classifyPathLane(path, options = {}) {
    const ownershipMatrix =
        options.ownershipMatrix || DEFAULT_DUAL_CODEX_OWNERSHIP;
    const priorityLanePatterns = options.priorityLanePatterns || {
        transversal_runtime: DEFAULT_TRANSVERSAL_PRIORITY_PATTERNS,
    };
    const safePath = normalizePathToken(path);
    const priorityMatches = [];
    for (const [lane, patterns] of Object.entries(priorityLanePatterns)) {
        const safePatterns = Array.isArray(patterns) ? patterns : [];
        if (
            safePatterns.some((pattern) =>
                pathMatchesPattern(safePath, pattern)
            )
        ) {
            priorityMatches.push(
                String(lane || '')
                    .trim()
                    .toLowerCase()
            );
        }
    }
    if (priorityMatches.length > 0) {
        const lane = priorityMatches[0];
        return {
            lane,
            reason: 'priority_lane_match',
            matched_lanes: priorityMatches,
        };
    }
    const matchedLanes = [];
    for (const [lane, patterns] of Object.entries(ownershipMatrix)) {
        const safePatterns = Array.isArray(patterns) ? patterns : [];
        if (
            safePatterns.some((pattern) =>
                pathMatchesPattern(safePath, pattern)
            )
        ) {
            matchedLanes.push(
                String(lane || '')
                    .trim()
                    .toLowerCase()
            );
        }
    }
    const hasBackend = matchedLanes.includes('backend_ops');
    const hasFrontend = matchedLanes.includes('frontend_content');
    const hasTransversal = matchedLanes.includes('transversal_runtime');
    if (hasTransversal) {
        return {
            lane: 'transversal_runtime',
            reason: 'transversal_runtime_match',
            matched_lanes: matchedLanes,
        };
    }
    if (hasBackend && hasFrontend) {
        return {
            lane: 'backend_ops',
            reason: 'ambiguous_both_lanes_conservative_backend',
            matched_lanes: matchedLanes,
        };
    }
    if (hasBackend) {
        return {
            lane: 'backend_ops',
            reason: 'backend_pattern_match',
            matched_lanes: matchedLanes,
        };
    }
    if (hasFrontend) {
        return {
            lane: 'frontend_content',
            reason: 'frontend_pattern_match',
            matched_lanes: matchedLanes,
        };
    }
    return {
        lane: 'backend_ops',
        reason: 'no_match_conservative_backend',
        matched_lanes: [],
    };
}

function inferDomainLaneFromFiles(files, options = {}) {
    const safeFiles = Array.isArray(files) ? files : [];
    let backendCount = 0;
    let frontendCount = 0;
    let transversalCount = 0;
    const details = [];
    for (const rawFile of safeFiles) {
        const classified = classifyPathLane(rawFile, options);
        details.push({
            file: normalizePathToken(rawFile),
            lane: classified.lane,
            reason: classified.reason,
            matched_lanes: classified.matched_lanes,
        });
        if (classified.lane === 'frontend_content') {
            frontendCount += 1;
        } else if (classified.lane === 'transversal_runtime') {
            transversalCount += 1;
        } else {
            backendCount += 1;
        }
    }
    let lane = 'backend_ops';
    if (transversalCount > 0 && backendCount === 0 && frontendCount === 0) {
        lane = 'transversal_runtime';
    } else if (
        frontendCount > 0 &&
        backendCount === 0 &&
        transversalCount === 0
    ) {
        lane = 'frontend_content';
    }
    const nonZeroLanes = [backendCount, frontendCount, transversalCount].filter(
        (count) => count > 0
    ).length;
    const hasCrossDomainFiles = nonZeroLanes > 1;
    return {
        lane,
        hasCrossDomainFiles,
        counts: {
            backend_ops: backendCount,
            frontend_content: frontendCount,
            transversal_runtime: transversalCount,
        },
        details,
    };
}

function ensureTaskDualCodexDefaults(task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    const inferred = inferDomainLaneFromFiles(task.files, options);
    const runtimeScope =
        normalizeOptionalToken(task?.scope) === 'openclaw_runtime';

    if (!String(task.domain_lane || '').trim()) {
        task.domain_lane = inferred.lane;
    } else {
        task.domain_lane = String(task.domain_lane).trim().toLowerCase();
    }

    if (!String(task.codex_instance || '').trim()) {
        task.codex_instance = mapLaneToCodexInstance(task.domain_lane);
    } else {
        task.codex_instance = String(task.codex_instance).trim().toLowerCase();
    }

    if (!String(task.lane_lock || '').trim()) {
        task.lane_lock = toBoolean(task.cross_domain, false)
            ? 'handoff_allowed'
            : 'strict';
    } else {
        task.lane_lock = String(task.lane_lock).trim().toLowerCase();
    }

    task.cross_domain = toBoolean(task.cross_domain, false);
    task.provider_mode = normalizeOptionalToken(task.provider_mode);
    task.runtime_surface = normalizeOptionalToken(task.runtime_surface);
    task.runtime_transport = normalizeOptionalToken(task.runtime_transport);
    task.runtime_last_transport = normalizeOptionalToken(
        task.runtime_last_transport
    );
    const runtimeTask = runtimeScope || isOpenClawRuntimeTask(task);
    if (runtimeTask) {
        task.domain_lane = 'transversal_runtime';
        task.codex_instance = 'codex_transversal';
        if (!task.runtime_surface) {
            task.runtime_surface = inferOpenClawRuntimeSurface(task);
        }
        if (!task.provider_mode) {
            task.provider_mode = expectedProviderModeForSurface(
                task.runtime_surface
            );
        }
        if (!task.runtime_transport) {
            task.runtime_transport = 'hybrid_http_cli';
        }
    }
    return task;
}

function validateTaskExecutorScopeGuard(task, options = {}) {
    const criticalScopeKeywords = Array.isArray(options.criticalScopeKeywords)
        ? options.criticalScopeKeywords
        : DEFAULT_CRITICAL_SCOPE_KEYWORDS;
    const allowedExecutors =
        options.allowedExecutors || DEFAULT_ALLOWED_EXECUTORS;

    const scope = String(task?.scope || '');
    const executor = String(task?.executor || '')
        .trim()
        .toLowerCase();
    const matchedKeyword = findCriticalScopeKeyword(
        scope,
        criticalScopeKeywords
    );
    if (!matchedKeyword) return;
    if (allowedExecutors.has(executor)) return;

    const allowed = Array.from(allowedExecutors).join(', ');
    throw new Error(
        `task critica (${scope}) no puede asignarse a executor ${executor}; permitidos: ${allowed}`
    );
}

function validateTaskDependsOn(board, task, options = {}) {
    const { allowSelf = false } = options;
    const taskId = String(task?.id || '').trim();
    const deps = Array.isArray(task?.depends_on) ? task.depends_on : [];
    const seen = new Set();
    const idsInBoard = new Set(
        (board?.tasks || []).map((item) => String(item.id || ''))
    );

    for (const rawDep of deps) {
        const dep = String(rawDep || '').trim();
        if (!dep) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on contiene valor vacio`
            );
        }
        if (!/^(AG|CDX)-\d+$/.test(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on invalido (${dep}), esperado AG-### o CDX-###`
            );
        }
        if (seen.has(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on duplicado (${dep})`
            );
        }
        seen.add(dep);
        if (!allowSelf && dep === taskId) {
            throw new Error(
                `task ${taskId}: depends_on no puede referenciarse a si misma`
            );
        }
        if (!idsInBoard.has(dep)) {
            throw new Error(
                `task ${taskId || '(sin id)'}: depends_on no existe en board (${dep})`
            );
        }
    }
}

function isFrontendPublicReleaseSupportTask(task) {
    if (!task || typeof task !== 'object') return false;
    return Boolean(
        domainStrategy.isReleasePromotionExceptionTask(task) &&
        normalizeOptionalToken(task.scope) === 'frontend-public' &&
        normalizeOptionalToken(task.codex_instance) === 'codex_frontend' &&
        normalizeOptionalToken(task.domain_lane) === 'frontend_content'
    );
}

function isFrontendPublicReleaseSupportFile(path) {
    const safePath = normalizePathToken(path);
    if (!safePath) return false;
    return FRONTEND_PUBLIC_RELEASE_SUPPORT_PATTERNS.some((pattern) =>
        pathMatchesPattern(safePath, pattern)
    );
}

function isActiveHandoff(handoff, options = {}) {
    const isExpiredFn =
        typeof options.isExpired === 'function'
            ? options.isExpired
            : (value) => {
                  const parsed = Date.parse(String(value || ''));
                  if (!Number.isFinite(parsed)) return true;
                  return parsed <= Date.now();
              };
    return (
        String(handoff?.status || '').toLowerCase() === 'active' &&
        !isExpiredFn(handoff?.expires_at)
    );
}

function isActiveTaskStatus(task, activeStatuses = DEFAULT_ACTIVE_STATUSES) {
    return activeStatuses.has(
        String(task?.status || '')
            .trim()
            .toLowerCase()
    );
}

function isCodexMirrorTaskId(taskId) {
    return /^CDX-\d+$/i.test(String(taskId || '').trim());
}

function isAgentCodexTaskId(taskId) {
    return /^AG-\d+$/i.test(String(taskId || '').trim());
}

function isAlignedCodexMirrorTask(task, candidate) {
    if (!task || !candidate) return false;
    if (!isCodexMirrorTaskId(candidate.id)) return false;
    if (
        normalizeOptionalToken(candidate.executor) !== 'codex' ||
        normalizeOptionalToken(task.executor) !== 'codex'
    ) {
        return false;
    }

    const taskInstance = normalizeOptionalToken(task.codex_instance);
    const candidateInstance = normalizeOptionalToken(candidate.codex_instance);
    if (taskInstance && candidateInstance && taskInstance !== candidateInstance) {
        return false;
    }

    const taskLane = normalizeOptionalToken(task.domain_lane);
    const candidateLane = normalizeOptionalToken(candidate.domain_lane);
    if (taskLane && candidateLane && taskLane !== candidateLane) {
        return false;
    }

    const taskStrategyId = String(task.strategy_id || '').trim();
    const candidateStrategyId = String(candidate.strategy_id || '').trim();
    if (
        (taskStrategyId || candidateStrategyId) &&
        taskStrategyId !== candidateStrategyId
    ) {
        return false;
    }

    const taskSubfrontId = String(task.subfront_id || '').trim();
    const candidateSubfrontId = String(candidate.subfront_id || '').trim();
    if (
        (taskSubfrontId || candidateSubfrontId) &&
        taskSubfrontId !== candidateSubfrontId
    ) {
        return false;
    }

    return true;
}

function findAlignedActiveCodexMirrorTasks(board, task, options = {}) {
    const activeStatuses = options.activeStatuses || DEFAULT_ACTIVE_STATUSES;
    return (Array.isArray(board?.tasks) ? board.tasks : []).filter(
        (candidate) =>
            isActiveTaskStatus(candidate, activeStatuses) &&
            isAlignedCodexMirrorTask(task, candidate)
    );
}

function validateTaskCodexMirrorDependency(board, task, options = {}) {
    const activeStatuses = options.activeStatuses || DEFAULT_ACTIVE_STATUSES;
    const taskId = String(task?.id || '').trim();
    if (!isAgentCodexTaskId(taskId)) {
        return;
    }
    if (normalizeOptionalToken(task?.executor) !== 'codex') {
        return;
    }
    if (!isActiveTaskStatus(task, activeStatuses)) {
        return;
    }

    const shouldEnforce =
        Boolean(domainStrategy.getActiveStrategy(board)) ||
        Boolean(String(task?.strategy_id || '').trim()) ||
        Boolean(String(task?.subfront_id || '').trim());
    if (!shouldEnforce) {
        return;
    }

    const dependsOn = Array.isArray(task?.depends_on) ? task.depends_on : [];
    const declaredCdxIds = dependsOn
        .map((value) => String(value || '').trim())
        .filter((value) => isCodexMirrorTaskId(value));
    const alignedActiveMirrors = findAlignedActiveCodexMirrorTasks(
        board,
        task,
        {
            activeStatuses,
        }
    );
    const alignedMirrorIds = alignedActiveMirrors.map((candidate) =>
        String(candidate.id || '').trim()
    );
    const matchedMirrorIds = alignedMirrorIds.filter((candidateId) =>
        declaredCdxIds.includes(candidateId)
    );

    if (matchedMirrorIds.length > 0) {
        return;
    }

    const strategyRole = normalizeOptionalToken(task?.strategy_role);
    if (alignedMirrorIds.length === 0) {
        if (strategyRole === 'support') {
            throw new Error(
                `task ${taskId}: soporte Codex activo requiere al menos una CDX-* activa alineada por lane/subfront`
            );
        }
        throw new Error(
            `task ${taskId}: AG activa con executor=codex requiere CDX-* activa alineada por lane/subfront`
        );
    }

    if (declaredCdxIds.length === 0) {
        throw new Error(
            `task ${taskId}: AG activa con executor=codex requiere depends_on apuntando a CDX-* activa alineada (${alignedMirrorIds.join(', ')})`
        );
    }

    throw new Error(
        `task ${taskId}: depends_on debe apuntar a CDX-* activa alineada (${alignedMirrorIds.join(', ')})`
    );
}

function validateTaskDualCodexGuard(board, task, options = {}) {
    ensureTaskDualCodexDefaults(task, options);

    const taskId = String(task?.id || '').trim();
    const domainLane = String(task?.domain_lane || '')
        .trim()
        .toLowerCase();
    const codexInstance = String(task?.codex_instance || '')
        .trim()
        .toLowerCase();
    const laneLock = String(task?.lane_lock || '')
        .trim()
        .toLowerCase();
    const crossDomain = toBoolean(task?.cross_domain, false);
    const runtimeImpact = String(task?.runtime_impact || '')
        .trim()
        .toLowerCase();
    const scope = String(task?.scope || '');
    const deps = Array.isArray(task?.depends_on) ? task.depends_on : [];
    const providerMode = normalizeOptionalToken(task?.provider_mode);
    const runtimeSurface = normalizeOptionalToken(task?.runtime_surface);
    const runtimeTransport = normalizeOptionalToken(task?.runtime_transport);
    const runtimeLastTransport = normalizeOptionalToken(
        task?.runtime_last_transport
    );

    const allowedCodexInstances =
        options.allowedCodexInstances || DEFAULT_ALLOWED_CODEX_INSTANCES;
    const allowedDomainLanes =
        options.allowedDomainLanes || DEFAULT_ALLOWED_DOMAIN_LANES;
    const allowedLaneLocks =
        options.allowedLaneLocks || DEFAULT_ALLOWED_LANE_LOCKS;
    const allowedProviderModes =
        options.allowedProviderModes || DEFAULT_ALLOWED_PROVIDER_MODES;
    const allowedRuntimeSurfaces =
        options.allowedRuntimeSurfaces || DEFAULT_ALLOWED_RUNTIME_SURFACES;
    const allowedRuntimeTransports =
        options.allowedRuntimeTransports || DEFAULT_ALLOWED_RUNTIME_TRANSPORTS;
    const criticalScopeKeywords = Array.isArray(options.criticalScopeKeywords)
        ? options.criticalScopeKeywords
        : DEFAULT_CRITICAL_SCOPE_KEYWORDS;
    const activeStatuses = options.activeStatuses || DEFAULT_ACTIVE_STATUSES;
    const handoffs = Array.isArray(options.handoffs) ? options.handoffs : [];
    const allowFrontendReleaseSupport =
        isFrontendPublicReleaseSupportTask(task);

    if (!allowedDomainLanes.has(domainLane)) {
        throw new Error(
            `task ${taskId || '(sin id)'}: domain_lane invalido (${domainLane || 'vacio'})`
        );
    }
    if (!allowedCodexInstances.has(codexInstance)) {
        throw new Error(
            `task ${taskId || '(sin id)'}: codex_instance invalido (${codexInstance || 'vacio'})`
        );
    }
    if (!allowedLaneLocks.has(laneLock)) {
        throw new Error(
            `task ${taskId || '(sin id)'}: lane_lock invalido (${laneLock || 'vacio'})`
        );
    }
    if (providerMode && !allowedProviderModes.has(providerMode)) {
        throw new Error(
            `task ${taskId || '(sin id)'}: provider_mode invalido (${providerMode})`
        );
    }
    if (runtimeSurface && !allowedRuntimeSurfaces.has(runtimeSurface)) {
        throw new Error(
            `task ${taskId || '(sin id)'}: runtime_surface invalido (${runtimeSurface})`
        );
    }
    if (runtimeTransport && !allowedRuntimeTransports.has(runtimeTransport)) {
        throw new Error(
            `task ${taskId || '(sin id)'}: runtime_transport invalido (${runtimeTransport})`
        );
    }
    if (
        runtimeLastTransport &&
        !allowedRuntimeTransports.has(runtimeLastTransport)
    ) {
        throw new Error(
            `task ${taskId || '(sin id)'}: runtime_last_transport invalido (${runtimeLastTransport})`
        );
    }

    if (
        domainLane === 'frontend_content' &&
        codexInstance !== 'codex_frontend'
    ) {
        throw new Error(
            `task ${taskId || '(sin id)'}: domain_lane frontend_content requiere codex_instance=codex_frontend`
        );
    }
    if (domainLane === 'backend_ops' && codexInstance !== 'codex_backend_ops') {
        throw new Error(
            `task ${taskId || '(sin id)'}: domain_lane backend_ops requiere codex_instance=codex_backend_ops`
        );
    }
    if (
        domainLane === 'transversal_runtime' &&
        codexInstance !== 'codex_transversal'
    ) {
        throw new Error(
            `task ${taskId || '(sin id)'}: domain_lane transversal_runtime requiere codex_instance=codex_transversal`
        );
    }

    const runtimeTask = isOpenClawRuntimeTask(task);
    if (runtimeTask) {
        const expectedProviderMode = expectedProviderModeForSurface(
            runtimeSurface
        );
        if (providerMode !== expectedProviderMode) {
            throw new Error(
                `task ${taskId || '(sin id)'}: runtime ${runtimeSurface || 'surface'} requiere provider_mode=${expectedProviderMode}`
            );
        }
        if (domainLane !== 'transversal_runtime') {
            throw new Error(
                `task ${taskId || '(sin id)'}: runtime OpenClaw requiere domain_lane=transversal_runtime`
            );
        }
        if (codexInstance !== 'codex_transversal') {
            throw new Error(
                `task ${taskId || '(sin id)'}: runtime OpenClaw requiere codex_instance=codex_transversal`
            );
        }
        if (!runtimeSurface) {
            throw new Error(
                `task ${taskId || '(sin id)'}: provider_mode=openclaw_chatgpt requiere runtime_surface`
            );
        }
        if (!runtimeTransport) {
            throw new Error(
                `task ${taskId || '(sin id)'}: provider_mode=openclaw_chatgpt requiere runtime_transport`
            );
        }
    }

    const isCritical =
        Boolean(task?.critical_zone) ||
        runtimeImpact === 'high' ||
        Boolean(findCriticalScopeKeyword(scope, criticalScopeKeywords));
    if (isCritical && !runtimeTask && codexInstance !== 'codex_backend_ops') {
        throw new Error(
            `task ${taskId || '(sin id)'}: critical_zone/runtime scope critico requiere codex_instance=codex_backend_ops`
        );
    }

    const safeFiles = Array.isArray(task?.files) ? task.files : [];
    const laneViolations = [];
    for (const rawFile of safeFiles) {
        if (
            allowFrontendReleaseSupport &&
            isFrontendPublicReleaseSupportFile(rawFile)
        ) {
            continue;
        }
        const classified = classifyPathLane(rawFile, options);
        if (crossDomain) continue;
        if (
            !runtimeTask &&
            domainLane === 'backend_ops' &&
            classified.lane === 'transversal_runtime'
        ) {
            continue;
        }
        if (classified.lane !== domainLane) {
            laneViolations.push(
                `${normalizePathToken(rawFile)}=>${classified.lane}`
            );
        }
    }
    if (laneViolations.length > 0) {
        throw new Error(
            `task ${taskId || '(sin id)'}: archivos fuera de lane ${domainLane} (${laneViolations.join(', ')})`
        );
    }

    if (crossDomain && laneLock !== 'handoff_allowed') {
        throw new Error(
            `task ${taskId || '(sin id)'}: cross_domain=true requiere lane_lock=handoff_allowed`
        );
    }
    if (!crossDomain && laneLock !== 'strict') {
        throw new Error(
            `task ${taskId || '(sin id)'}: cross_domain=false requiere lane_lock=strict`
        );
    }
    if (crossDomain && deps.length === 0) {
        throw new Error(
            `task ${taskId || '(sin id)'}: cross_domain=true requiere depends_on no vacio`
        );
    }

    const status = String(task?.status || '').trim();
    if (!crossDomain || !activeStatuses.has(status) || !taskId) {
        return;
    }

    const normalizedTaskFiles = new Set(
        safeFiles.map((value) => normalizePathToken(value)).filter(Boolean)
    );
    const dependencySet = new Set(
        deps.map((value) => String(value || '').trim()).filter(Boolean)
    );
    const linkedActiveHandoffs = handoffs.filter(
        (handoff) =>
            isActiveHandoff(handoff, options) &&
            (String(handoff?.from_task || '') === taskId ||
                String(handoff?.to_task || '') === taskId)
    );

    if (linkedActiveHandoffs.length === 0) {
        throw new Error(
            `task ${taskId}: cross_domain activo requiere handoff activo vinculado`
        );
    }

    const hasDependencyLinkedHandoff = linkedActiveHandoffs.some((handoff) => {
        const fromTask = String(handoff?.from_task || '');
        const toTask = String(handoff?.to_task || '');
        const otherTask = fromTask === taskId ? toTask : fromTask;
        if (!dependencySet.has(otherTask)) return false;
        const handoffFiles = Array.isArray(handoff?.files) ? handoff.files : [];
        if (handoffFiles.length === 0) return false;
        return handoffFiles.some((value) =>
            normalizedTaskFiles.has(normalizePathToken(value))
        );
    });

    if (!hasDependencyLinkedHandoff) {
        throw new Error(
            `task ${taskId}: cross_domain activo requiere handoff activo que cubra files con una dependencia declarada`
        );
    }
}

function validateTaskGovernancePrechecks(board, task, options = {}) {
    const criticalScopeKeywords = Array.isArray(options.criticalScopeKeywords)
        ? options.criticalScopeKeywords
        : DEFAULT_CRITICAL_SCOPE_KEYWORDS;
    const activeStatuses = options.activeStatuses || DEFAULT_ACTIVE_STATUSES;
    ensureTaskDualCodexDefaults(task, options);
    if (typeof options.syncTaskModelRoutingState === 'function') {
        options.syncTaskModelRoutingState(task, options);
    }
    const activeStrategy = domainStrategy.getActiveStrategy(board);
    const taskStatus = String(task?.status || '').trim();
    if (activeStrategy && activeStatuses.has(taskStatus)) {
        const taskId = String(task?.id || '(sin id)').trim();
        const strategyId = String(task?.strategy_id || '').trim();
        const subfrontId = String(task?.subfront_id || '').trim();
        const strategyRole = normalizeOptionalToken(task?.strategy_role);
        const strategyReason = String(task?.strategy_reason || '').trim();
        if (!strategyId) {
            throw new Error(
                `task ${taskId}: estrategia activa requiere strategy_id=${activeStrategy.id}`
            );
        }
        if (!subfrontId) {
            throw new Error(
                `task ${taskId}: estrategia activa requiere subfront_id`
            );
        }
        if (!strategyRole) {
            throw new Error(
                `task ${taskId}: estrategia activa requiere strategy_role`
            );
        }
        if (strategyRole === 'exception' && !strategyReason) {
            throw new Error(
                `task ${taskId}: strategy_role=exception requiere strategy_reason`
            );
        }
    }
    domainStrategy.ensureTaskStrategyDefaults(board, task, {
        ...options,
        activeStatuses,
        findCriticalScopeKeyword: (scopeValue) =>
            findCriticalScopeKeyword(scopeValue, criticalScopeKeywords),
    });
    domainFocus.ensureTaskFocusDefaults(board, task, {
        activeStatuses,
    });
    validateTaskExecutorScopeGuard(task, options);
    validateTaskDependsOn(board, task, options);
    validateTaskDualCodexGuard(board, task, options);
    validateTaskCodexMirrorDependency(board, task, options);
    domainStrategy.validateTaskStrategyAlignment(board, task, {
        ...options,
        activeStatuses,
        findCriticalScopeKeyword: (scopeValue) =>
            findCriticalScopeKeyword(scopeValue, criticalScopeKeywords),
    });
    domainFocus.validateTaskFocusAlignment(board, task, {
        ...options,
        activeStatuses,
        decisionsData: options.decisionsData,
    });
    if (typeof options.collectTaskModelRoutingErrors === 'function') {
        const modelRoutingErrors = options.collectTaskModelRoutingErrors(task, {
            ...options,
            activeStatuses,
        });
        if (
            Array.isArray(modelRoutingErrors) &&
            modelRoutingErrors.length > 0
        ) {
            throw new Error(modelRoutingErrors[0]);
        }
    }
}

module.exports = {
    DEFAULT_DUAL_CODEX_OWNERSHIP,
    DEFAULT_TRANSVERSAL_PRIORITY_PATTERNS,
    DEFAULT_ALLOWED_PROVIDER_MODES,
    DEFAULT_ALLOWED_RUNTIME_SURFACES,
    DEFAULT_ALLOWED_RUNTIME_TRANSPORTS,
    FRONTEND_PUBLIC_RELEASE_SUPPORT_PATTERNS,
    findCriticalScopeKeyword,
    classifyPathLane,
    inferDomainLaneFromFiles,
    mapLaneToCodexInstance,
    isOpenClawRuntimeTask,
    inferOpenClawRuntimeSurface,
    isFrontendPublicReleaseSupportTask,
    isFrontendPublicReleaseSupportFile,
    isActiveTaskStatus,
    isCodexMirrorTaskId,
    isAgentCodexTaskId,
    isAlignedCodexMirrorTask,
    findAlignedActiveCodexMirrorTasks,
    ensureTaskDualCodexDefaults,
    validateTaskExecutorScopeGuard,
    validateTaskDependsOn,
    validateTaskDualCodexGuard,
    validateTaskCodexMirrorDependency,
    validateTaskGovernancePrechecks,
};
