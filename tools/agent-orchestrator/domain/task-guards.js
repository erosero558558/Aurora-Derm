'use strict';

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
]);
const DEFAULT_ALLOWED_DOMAIN_LANES = new Set([
    'backend_ops',
    'frontend_content',
]);
const DEFAULT_ALLOWED_LANE_LOCKS = new Set(['strict', 'handoff_allowed']);
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
};

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
    const safePath = normalizePathToken(path);
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
        } else {
            backendCount += 1;
        }
    }
    const lane =
        frontendCount > 0 && backendCount === 0
            ? 'frontend_content'
            : 'backend_ops';
    const hasCrossDomainFiles = frontendCount > 0 && backendCount > 0;
    return {
        lane,
        hasCrossDomainFiles,
        counts: {
            backend_ops: backendCount,
            frontend_content: frontendCount,
        },
        details,
    };
}

function ensureTaskDualCodexDefaults(task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    const inferred = inferDomainLaneFromFiles(task.files, options);

    if (!String(task.domain_lane || '').trim()) {
        task.domain_lane = inferred.lane;
    } else {
        task.domain_lane = String(task.domain_lane).trim().toLowerCase();
    }

    if (!String(task.codex_instance || '').trim()) {
        task.codex_instance =
            task.domain_lane === 'frontend_content'
                ? 'codex_frontend'
                : 'codex_backend_ops';
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

    const allowedCodexInstances =
        options.allowedCodexInstances || DEFAULT_ALLOWED_CODEX_INSTANCES;
    const allowedDomainLanes =
        options.allowedDomainLanes || DEFAULT_ALLOWED_DOMAIN_LANES;
    const allowedLaneLocks =
        options.allowedLaneLocks || DEFAULT_ALLOWED_LANE_LOCKS;
    const criticalScopeKeywords = Array.isArray(options.criticalScopeKeywords)
        ? options.criticalScopeKeywords
        : DEFAULT_CRITICAL_SCOPE_KEYWORDS;
    const activeStatuses = options.activeStatuses || DEFAULT_ACTIVE_STATUSES;
    const handoffs = Array.isArray(options.handoffs) ? options.handoffs : [];

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

    const isCritical =
        Boolean(task?.critical_zone) ||
        runtimeImpact === 'high' ||
        Boolean(findCriticalScopeKeyword(scope, criticalScopeKeywords));
    if (isCritical && codexInstance !== 'codex_backend_ops') {
        throw new Error(
            `task ${taskId || '(sin id)'}: critical_zone/runtime scope critico requiere codex_instance=codex_backend_ops`
        );
    }

    const safeFiles = Array.isArray(task?.files) ? task.files : [];
    const laneViolations = [];
    for (const rawFile of safeFiles) {
        const classified = classifyPathLane(rawFile, options);
        if (crossDomain) continue;
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
    validateTaskExecutorScopeGuard(task, options);
    validateTaskDependsOn(board, task, options);
    validateTaskDualCodexGuard(board, task, options);
}

module.exports = {
    DEFAULT_DUAL_CODEX_OWNERSHIP,
    findCriticalScopeKeyword,
    classifyPathLane,
    inferDomainLaneFromFiles,
    ensureTaskDualCodexDefaults,
    validateTaskExecutorScopeGuard,
    validateTaskDependsOn,
    validateTaskDualCodexGuard,
    validateTaskGovernancePrechecks,
};
