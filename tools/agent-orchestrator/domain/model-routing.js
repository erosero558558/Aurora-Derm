'use strict';

const path = require('path');

const DEFAULT_POLICY_VERSION = '2026-03-17-codex-model-routing-v2';
const DEFAULT_MODEL_TIER = 'gpt-5.4-mini';
const DEFAULT_PREMIUM_MODEL = 'gpt-5.4';
const DEFAULT_LEDGER_PATH = 'verification/codex-model-usage.jsonl';
const DEFAULT_DECISION_PACKETS_DIR = 'verification/codex-decisions';
const DEFAULT_ROOT_THREAD_MODEL_TIER = DEFAULT_MODEL_TIER;
const DEFAULT_PREMIUM_BUDGET_UNIT = 'premium_session';
const DEFAULT_ACTIVE_STATUSES = new Set([
    'ready',
    'in_progress',
    'review',
    'blocked',
]);
const DEFAULT_ALLOWED_GATE_STATES = [
    'closed',
    'approved',
    'consumed',
    'blocked',
];
const DEFAULT_PREMIUM_REASONS = [
    'critical_zone',
    'cross_lane_high_risk',
    'mini_failed_unblock',
    'critical_review',
];
const DEFAULT_ALLOWED_EXECUTION_MODES = ['subagent', 'main_thread_exception'];
const DEFAULT_PROHIBITED_PREMIUM_USES = [
    'repo_exploration',
    'context_summary',
    'boilerplate',
    'mechanical_refactor',
    'status_update',
    'first_test_pass',
    'docs_first_draft',
    'simple_single_lane_fix',
];
const DEFAULT_DECISION_PACKET_FIELDS = [
    'task_id',
    'execution_mode',
    'premium_reason',
    'problem',
    'why_mini_or_local_failed',
    'exact_decision_requested',
    'acceptable_output',
    'risk_if_wrong',
    'action_taken',
];

function normalizeToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase();
}

function normalizePath(value) {
    return String(value || '')
        .trim()
        .replace(/\\/g, '/');
}

function toPositiveInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function toPercent(part, total) {
    if (!Number.isFinite(total) || total <= 0) return 0;
    return Math.round((Number(part || 0) / total) * 1000) / 10;
}

function toBoolean(value, fallback = false) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    const raw = normalizeToken(value);
    if (!raw) return fallback;
    if (['true', '1', 'yes', 'y', 'si', 's', 'on'].includes(raw)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
    return fallback;
}

function hasModelRoutingFields(task) {
    return Boolean(
        String(task?.model_tier_default || '').trim() ||
        String(task?.premium_budget || '').trim() ||
        String(task?.premium_calls_used || '').trim() ||
        String(task?.premium_gate_state || '').trim() ||
        String(task?.decision_packet_ref || '').trim() ||
        String(task?.model_policy_version || '').trim()
    );
}

function isTrackedCodexTask(task) {
    return /^CDX-\d+$/i.test(String(task?.id || '').trim());
}

function isActiveTrackedCodexTask(
    task,
    activeStatuses = DEFAULT_ACTIVE_STATUSES
) {
    const safeStatuses =
        activeStatuses instanceof Set
            ? activeStatuses
            : new Set(activeStatuses || []);
    return (
        isTrackedCodexTask(task) &&
        safeStatuses.has(String(task?.status || '').trim())
    );
}

function getModelRoutingPolicy(governancePolicy = {}) {
    const maybeDirectPolicy =
        governancePolicy &&
        typeof governancePolicy === 'object' &&
        !Array.isArray(governancePolicy) &&
        (Object.prototype.hasOwnProperty.call(
            governancePolicy,
            'default_model_tier'
        ) ||
            Object.prototype.hasOwnProperty.call(
                governancePolicy,
                'premium_model_tier'
            ) ||
            Object.prototype.hasOwnProperty.call(
                governancePolicy,
                'decision_packets_dir'
            ) ||
            Object.prototype.hasOwnProperty.call(
                governancePolicy,
                'premium_reasons'
            ) ||
            Object.prototype.hasOwnProperty.call(
                governancePolicy,
                'allowed_execution_modes'
            ));
    const raw =
        governancePolicy && typeof governancePolicy === 'object'
            ? governancePolicy.codex_model_routing ||
              (maybeDirectPolicy ? governancePolicy : {})
            : {};
    const allowedGateStates = Array.isArray(raw.allowed_gate_states)
        ? raw.allowed_gate_states
              .map((value) => normalizeToken(value))
              .filter((value) => value)
        : DEFAULT_ALLOWED_GATE_STATES.slice();
    const premiumReasons = Array.isArray(raw.premium_reasons)
        ? raw.premium_reasons
              .map((value) => normalizeToken(value))
              .filter(Boolean)
        : DEFAULT_PREMIUM_REASONS.slice();
    const prohibitedPremiumUses = Array.isArray(raw.prohibited_premium_uses)
        ? raw.prohibited_premium_uses
              .map((value) => normalizeToken(value))
              .filter((value) => value)
        : DEFAULT_PROHIBITED_PREMIUM_USES.slice();
    const allowedExecutionModes = Array.isArray(raw.allowed_execution_modes)
        ? raw.allowed_execution_modes
              .map((value) => normalizeToken(value))
              .filter(Boolean)
        : DEFAULT_ALLOWED_EXECUTION_MODES.slice();
    const decisionPacketFields = Array.isArray(raw.decision_packet_fields)
        ? raw.decision_packet_fields
              .map((value) => String(value || '').trim())
              .filter(Boolean)
        : DEFAULT_DECISION_PACKET_FIELDS.slice();
    return {
        version: String(raw.version || DEFAULT_POLICY_VERSION).trim(),
        scope: normalizeToken(raw.scope) || 'codex_only',
        default_model_tier:
            String(raw.default_model_tier || DEFAULT_MODEL_TIER).trim() ||
            DEFAULT_MODEL_TIER,
        premium_model_tier:
            String(raw.premium_model_tier || DEFAULT_PREMIUM_MODEL).trim() ||
            DEFAULT_PREMIUM_MODEL,
        root_thread_model_tier:
            String(
                raw.root_thread_model_tier || DEFAULT_ROOT_THREAD_MODEL_TIER
            ).trim() || DEFAULT_ROOT_THREAD_MODEL_TIER,
        premium_budget_unit:
            String(
                raw.premium_budget_unit || DEFAULT_PREMIUM_BUDGET_UNIT
            ).trim() || DEFAULT_PREMIUM_BUDGET_UNIT,
        ledger_path: normalizePath(raw.ledger_path) || DEFAULT_LEDGER_PATH,
        decision_packets_dir:
            normalizePath(raw.decision_packets_dir) ||
            DEFAULT_DECISION_PACKETS_DIR,
        allowed_gate_states: allowedGateStates,
        allowed_gate_states_set: new Set(allowedGateStates),
        premium_reasons: premiumReasons,
        premium_reasons_set: new Set(premiumReasons),
        allowed_execution_modes: allowedExecutionModes,
        allowed_execution_modes_set: new Set(allowedExecutionModes),
        prohibited_premium_uses: prohibitedPremiumUses,
        prohibited_premium_uses_set: new Set(prohibitedPremiumUses),
        decision_packet_fields: decisionPacketFields,
        target_mix: {
            zero_premium_pct: toPositiveInt(
                raw?.target_mix?.zero_premium_pct,
                80
            ),
            one_premium_pct: toPositiveInt(
                raw?.target_mix?.one_premium_pct,
                15
            ),
            two_premium_pct: toPositiveInt(raw?.target_mix?.two_premium_pct, 5),
            throughput_drop_guardrail_pct: toPositiveInt(
                raw?.target_mix?.throughput_drop_guardrail_pct,
                10
            ),
        },
        fallback_order: Array.isArray(raw.fallback_order)
            ? raw.fallback_order
                  .map((value) => String(value || '').trim())
                  .filter(Boolean)
            : ['tools/local', DEFAULT_MODEL_TIER, DEFAULT_PREMIUM_MODEL],
        gate_open_conditions: Array.isArray(raw.gate_open_conditions)
            ? raw.gate_open_conditions
                  .map((value) => normalizeToken(value))
                  .filter(Boolean)
            : [
                  'critical_zone',
                  'cross_lane_high_risk',
                  'mini_failed_unblock',
                  'critical_review',
              ],
        notes: String(raw.notes || '').trim(),
    };
}

function derivePremiumBudget(task) {
    if (toBoolean(task?.critical_zone, false)) return 2;
    if (
        toBoolean(task?.cross_domain, false) ||
        normalizeToken(task?.risk) === 'high'
    ) {
        return 1;
    }
    return 0;
}

function normalizeGateState(value, policy) {
    const safePolicy = getModelRoutingPolicy(policy);
    const normalized = normalizeToken(value);
    if (safePolicy.allowed_gate_states_set.has(normalized)) {
        return normalized;
    }
    return 'closed';
}

function normalizeModelUsageEntry(entry, options = {}) {
    const policy = getModelRoutingPolicy(options.governancePolicy);
    return {
        timestamp: String(
            entry?.timestamp || entry?.used_at || entry?.created_at || ''
        ).trim(),
        task_id: String(entry?.task_id || entry?.taskId || '').trim(),
        codex_instance: normalizeToken(
            entry?.codex_instance || entry?.codexInstance || ''
        ),
        model_tier:
            String(entry?.model_tier || entry?.model || '').trim() ||
            policy.premium_model_tier,
        reason: normalizeToken(entry?.reason || ''),
        decision_packet_ref: normalizePath(
            entry?.decision_packet_ref || entry?.decisionPacketRef || ''
        ),
        execution_mode: normalizeToken(
            entry?.execution_mode || entry?.executionMode || ''
        ),
        budget_unit:
            String(entry?.budget_unit || entry?.budgetUnit || '').trim() || '',
        premium_session_id: String(
            entry?.premium_session_id || entry?.premiumSessionId || ''
        ).trim(),
        root_thread_model_tier:
            String(
                entry?.root_thread_model_tier ||
                    entry?.rootThreadModelTier ||
                    ''
            ).trim() || '',
        avoided_rework: toBoolean(entry?.avoided_rework, false),
        outcome: normalizeToken(entry?.outcome || ''),
        notes: String(entry?.notes || '').trim(),
    };
}

function readModelUsageLedger(options = {}) {
    const {
        governancePolicy = {},
        readJsonlFile = () => [],
        ledgerPath = null,
    } = options;
    const policy = getModelRoutingPolicy(governancePolicy);
    const safeLedgerPath = ledgerPath || policy.ledger_path;
    const rows = readJsonlFile(safeLedgerPath) || [];
    return Array.isArray(rows)
        ? rows.map((row) =>
              normalizeModelUsageEntry(row, { governancePolicy: policy })
          )
        : [];
}

function getTaskPremiumEntries(task, ledgerEntries = [], options = {}) {
    const policy = getModelRoutingPolicy(options.governancePolicy);
    const taskId = String(task?.id || '').trim();
    return (Array.isArray(ledgerEntries) ? ledgerEntries : []).filter(
        (entry) =>
            String(entry?.task_id || '').trim() === taskId &&
            String(entry?.model_tier || '').trim() === policy.premium_model_tier
    );
}

function countPremiumEntriesByExecutionMode(entries = []) {
    const summary = {
        subagent: 0,
        main_thread_exception: 0,
    };
    for (const entry of Array.isArray(entries) ? entries : []) {
        const executionMode = normalizeToken(entry?.execution_mode || '');
        if (!executionMode) continue;
        if (!Object.prototype.hasOwnProperty.call(summary, executionMode)) {
            summary[executionMode] = 0;
        }
        summary[executionMode] += 1;
    }
    return summary;
}

function countMiniRootCompliantEntries(entries = [], policy = {}) {
    const safePolicy = getModelRoutingPolicy(policy);
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
        const executionMode = normalizeToken(entry?.execution_mode || '');
        const rootThreadModelTier = String(
            entry?.root_thread_model_tier || ''
        ).trim();
        if (executionMode !== 'subagent') return false;
        return rootThreadModelTier === safePolicy.root_thread_model_tier;
    }).length;
}

function buildTaskModelUsageState(task, options = {}) {
    const policy = getModelRoutingPolicy(options.governancePolicy);
    const premiumEntries = getTaskPremiumEntries(
        task,
        options.ledgerEntries,
        options
    );
    const premiumCallsUsed = premiumEntries.length;
    const latestDecisionPacketFromLedger = premiumEntries
        .map((entry) => String(entry?.decision_packet_ref || '').trim())
        .filter(Boolean)
        .slice(-1)[0];
    const decisionPacketRef =
        normalizePath(task?.decision_packet_ref) ||
        normalizePath(latestDecisionPacketFromLedger);
    const premiumBudget = derivePremiumBudget(task);
    const premiumByExecutionMode =
        countPremiumEntriesByExecutionMode(premiumEntries);
    const compliantSessions = countMiniRootCompliantEntries(
        premiumEntries,
        policy
    );
    const miniRootCompliancePct =
        premiumCallsUsed === 0
            ? 100
            : toPercent(compliantSessions, premiumCallsUsed);
    let premiumGateState = 'closed';
    if (premiumCallsUsed > premiumBudget) {
        premiumGateState = 'blocked';
    } else if (premiumCallsUsed > 0) {
        premiumGateState = 'consumed';
    } else if (decisionPacketRef) {
        premiumGateState = 'approved';
    }
    return {
        task_id: String(task?.id || '').trim(),
        title: String(task?.title || '').trim(),
        status: String(task?.status || '').trim(),
        codex_instance: String(task?.codex_instance || '').trim(),
        domain_lane: String(task?.domain_lane || '').trim(),
        model_tier_default: policy.default_model_tier,
        premium_budget: premiumBudget,
        premium_calls_used: premiumCallsUsed,
        premium_budget_remaining: Math.max(0, premiumBudget - premiumCallsUsed),
        premium_gate_state: premiumGateState,
        decision_packet_ref: decisionPacketRef,
        model_policy_version: policy.version,
        premium_entries: premiumEntries,
        avoided_rework_calls: premiumEntries.filter((entry) =>
            toBoolean(entry?.avoided_rework, false)
        ).length,
        premium_subagent_sessions_total: Number(
            premiumByExecutionMode.subagent || 0
        ),
        premium_root_exceptions_total: Number(
            premiumByExecutionMode.main_thread_exception || 0
        ),
        premium_by_execution_mode: premiumByExecutionMode,
        premium_execution_modes: [
            ...new Set(
                premiumEntries
                    .map((entry) => normalizeToken(entry?.execution_mode || ''))
                    .filter(Boolean)
            ),
        ],
        mini_root_compliance_pct: miniRootCompliancePct,
        mini_root_compliant_sessions: compliantSessions,
    };
}

function syncTaskModelRoutingState(task, options = {}) {
    if (!task || typeof task !== 'object') return task;
    if (!isTrackedCodexTask(task) && !hasModelRoutingFields(task)) return task;
    const state = buildTaskModelUsageState(task, options);
    task.model_tier_default = state.model_tier_default;
    task.premium_budget = state.premium_budget;
    task.premium_calls_used = state.premium_calls_used;
    task.premium_gate_state = state.premium_gate_state;
    task.decision_packet_ref = state.decision_packet_ref;
    task.model_policy_version = state.model_policy_version;
    return task;
}

function resolveDecisionPacketPath(rootPath, ref) {
    if (!ref) return '';
    if (path.isAbsolute(ref)) return ref;
    return path.resolve(rootPath || process.cwd(), ref);
}

function validateDecisionPacketFile(ref, options = {}) {
    const {
        rootPath = process.cwd(),
        taskId = '',
        governancePolicy = {},
        existsSync = () => false,
        readFileSync = () => '',
    } = options;
    const policy = getModelRoutingPolicy(governancePolicy);
    const errors = [];
    const safeRef = normalizePath(ref);
    if (!safeRef) {
        errors.push('decision_packet_ref requerido');
        return {
            ok: false,
            errors,
            missing_fields: policy.decision_packet_fields.slice(),
            resolved_path: '',
            relative_path: '',
        };
    }
    const resolvedPath = resolveDecisionPacketPath(rootPath, safeRef);
    const decisionPacketsRoot = path.resolve(
        rootPath,
        policy.decision_packets_dir
    );
    const relativeToDecisionDir = normalizePath(
        path.relative(decisionPacketsRoot, resolvedPath)
    );
    if (
        relativeToDecisionDir.startsWith('..') ||
        path.isAbsolute(relativeToDecisionDir)
    ) {
        errors.push(
            `decision_packet_ref fuera de ${policy.decision_packets_dir}`
        );
    }
    if (
        taskId &&
        !path
            .basename(resolvedPath)
            .toLowerCase()
            .startsWith(`${String(taskId).toLowerCase()}-`)
    ) {
        errors.push(`decision_packet_ref debe iniciar con ${String(taskId)}-`);
    }
    if (!existsSync(resolvedPath)) {
        errors.push(`decision_packet_ref no existe (${safeRef})`);
        return {
            ok: false,
            errors,
            missing_fields: policy.decision_packet_fields.slice(),
            resolved_path: resolvedPath,
            relative_path: safeRef,
        };
    }
    const content = String(readFileSync(resolvedPath, 'utf8') || '');
    const missingFields = policy.decision_packet_fields.filter((field) => {
        const regex = new RegExp(`^\\s*${field}\\s*:\\s*\\S+`, 'im');
        return !regex.test(content);
    });
    if (missingFields.length > 0) {
        errors.push(`decision_packet incompleto (${missingFields.join(', ')})`);
    }
    return {
        ok: errors.length === 0,
        errors,
        missing_fields: missingFields,
        resolved_path: resolvedPath,
        relative_path: safeRef,
    };
}

function collectTaskModelRoutingErrors(task, options = {}) {
    const {
        activeStatuses = DEFAULT_ACTIVE_STATUSES,
        governancePolicy = {},
        ledgerEntries = [],
        rootPath = process.cwd(),
        existsSync = () => false,
        readFileSync = () => '',
    } = options;
    if (!isTrackedCodexTask(task)) return [];
    const policy = getModelRoutingPolicy(governancePolicy);
    const safeStatuses =
        activeStatuses instanceof Set
            ? activeStatuses
            : new Set(activeStatuses || []);
    const activeTask = isActiveTrackedCodexTask(task, safeStatuses);
    const state = buildTaskModelUsageState(task, {
        governancePolicy: policy,
        ledgerEntries,
    });
    const errors = [];

    if (activeTask) {
        if (
            String(task?.model_tier_default || '').trim() !==
            state.model_tier_default
        ) {
            errors.push(
                `${state.task_id}: model_tier_default debe ser ${state.model_tier_default}`
            );
        }
        if (toPositiveInt(task?.premium_budget, -1) !== state.premium_budget) {
            errors.push(
                `${state.task_id}: premium_budget debe ser ${state.premium_budget}`
            );
        }
        if (
            toPositiveInt(task?.premium_calls_used, -1) !==
            state.premium_calls_used
        ) {
            errors.push(
                `${state.task_id}: premium_calls_used desalineado board(${toPositiveInt(
                    task?.premium_calls_used,
                    0
                )}) != ledger(${state.premium_calls_used})`
            );
        }
        if (
            normalizeGateState(task?.premium_gate_state, policy) !==
            state.premium_gate_state
        ) {
            errors.push(
                `${state.task_id}: premium_gate_state debe ser ${state.premium_gate_state}`
            );
        }
        if (
            String(task?.model_policy_version || '').trim() !==
            state.model_policy_version
        ) {
            errors.push(
                `${state.task_id}: model_policy_version debe ser ${state.model_policy_version}`
            );
        }
    }

    if (
        state.decision_packet_ref &&
        normalizePath(task?.decision_packet_ref) !== state.decision_packet_ref
    ) {
        errors.push(
            `${state.task_id}: decision_packet_ref desalineado board(${
                normalizePath(task?.decision_packet_ref) || 'vacio'
            }) != ledger(${state.decision_packet_ref})`
        );
    }

    if (state.premium_calls_used > state.premium_budget) {
        errors.push(
            `${state.task_id}: premium_calls_used excede premium_budget (${state.premium_calls_used}/${state.premium_budget})`
        );
    }

    if (
        state.premium_calls_used > 0 ||
        state.premium_gate_state === 'approved'
    ) {
        const packetValidation = validateDecisionPacketFile(
            state.decision_packet_ref,
            {
                rootPath,
                taskId: state.task_id,
                governancePolicy: policy,
                existsSync,
                readFileSync,
            }
        );
        for (const error of packetValidation.errors) {
            errors.push(`${state.task_id}: ${error}`);
        }
    }

    for (const [index, entry] of state.premium_entries.entries()) {
        if (
            !policy.premium_reasons_set.has(String(entry.reason || '').trim())
        ) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] usa reason invalido (${entry.reason || 'vacio'})`
            );
        }
        if (!String(entry.decision_packet_ref || '').trim()) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] requiere decision_packet_ref`
            );
        }
        if (
            String(entry.model_tier || '').trim() !== policy.premium_model_tier
        ) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] debe usar model_tier=${policy.premium_model_tier}`
            );
        }
        if (!String(entry.execution_mode || '').trim()) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] requiere execution_mode`
            );
        } else if (
            !policy.allowed_execution_modes_set.has(
                normalizeToken(entry.execution_mode)
            )
        ) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] usa execution_mode invalido (${entry.execution_mode})`
            );
        }
        if (
            String(entry.budget_unit || '').trim() !==
            policy.premium_budget_unit
        ) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] debe usar budget_unit=${policy.premium_budget_unit}`
            );
        }
        if (!String(entry.premium_session_id || '').trim()) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] requiere premium_session_id`
            );
        }
        if (!String(entry.root_thread_model_tier || '').trim()) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] requiere root_thread_model_tier`
            );
        }
        if (
            normalizeToken(entry.execution_mode) === 'subagent' &&
            String(entry.root_thread_model_tier || '').trim() !==
                policy.root_thread_model_tier
        ) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] subagent requiere root_thread_model_tier=${policy.root_thread_model_tier}`
            );
        }
        if (
            normalizeToken(entry.execution_mode) === 'main_thread_exception' &&
            String(entry.root_thread_model_tier || '').trim() !==
                policy.premium_model_tier
        ) {
            errors.push(
                `${state.task_id}: ledger premium[${index}] main_thread_exception requiere root_thread_model_tier=${policy.premium_model_tier}`
            );
        }
    }

    return errors;
}

function collectPremiumGateBlockers(tasks, options = {}) {
    const {
        governancePolicy = {},
        ledgerEntries = [],
        activeStatuses = DEFAULT_ACTIVE_STATUSES,
    } = options;
    const policy = getModelRoutingPolicy(governancePolicy);
    const blockers = [];
    for (const task of Array.isArray(tasks) ? tasks : []) {
        if (!isActiveTrackedCodexTask(task, activeStatuses)) continue;
        const errors = collectTaskModelRoutingErrors(task, {
            ...options,
            governancePolicy: policy,
            ledgerEntries,
        });
        if (errors.length === 0) continue;
        const state = buildTaskModelUsageState(task, {
            governancePolicy: policy,
            ledgerEntries,
        });
        blockers.push({
            task_id: state.task_id,
            codex_instance: state.codex_instance,
            premium_budget: state.premium_budget,
            premium_calls_used: state.premium_calls_used,
            premium_gate_state: state.premium_gate_state,
            decision_packet_ref: state.decision_packet_ref,
            blockers: errors,
        });
    }
    return blockers;
}

function buildPremiumBudgetRemaining(taskStates = []) {
    const activeRows = taskStates.filter((row) =>
        DEFAULT_ACTIVE_STATUSES.has(String(row?.status || '').trim())
    );
    return {
        total_active: activeRows.length,
        premium_budget_total: activeRows.reduce(
            (acc, row) => acc + Number(row?.premium_budget || 0),
            0
        ),
        premium_budget_remaining: activeRows.reduce(
            (acc, row) => acc + Number(row?.premium_budget_remaining || 0),
            0
        ),
        by_task: activeRows.map((row) => ({
            task_id: row.task_id,
            codex_instance: row.codex_instance,
            premium_budget: row.premium_budget,
            premium_calls_used: row.premium_calls_used,
            premium_budget_remaining: row.premium_budget_remaining,
            premium_gate_state: row.premium_gate_state,
        })),
    };
}

function buildModelUsageSummary(tasks, options = {}) {
    const {
        governancePolicy = {},
        ledgerEntries = [],
        activeStatuses = DEFAULT_ACTIVE_STATUSES,
        blockers = null,
    } = options;
    const policy = getModelRoutingPolicy(governancePolicy);
    const trackedTasks = (Array.isArray(tasks) ? tasks : []).filter((task) =>
        isTrackedCodexTask(task)
    );
    const taskStates = trackedTasks.map((task) =>
        buildTaskModelUsageState(task, {
            governancePolicy: policy,
            ledgerEntries,
        })
    );
    const safeBlockers = Array.isArray(blockers)
        ? blockers
        : collectPremiumGateBlockers(trackedTasks, {
              governancePolicy: policy,
              ledgerEntries,
              activeStatuses,
              rootPath: options.rootPath,
              existsSync: options.existsSync,
              readFileSync: options.readFileSync,
          });
    const activeRows = taskStates.filter((row) =>
        (activeStatuses instanceof Set
            ? activeStatuses
            : new Set(activeStatuses || [])
        ).has(String(row.status || '').trim())
    );
    const budgetRemaining = buildPremiumBudgetRemaining(activeRows);
    const totalTasks = taskStates.length;
    const zeroPremiumTasks = taskStates.filter(
        (row) => Number(row.premium_calls_used || 0) === 0
    ).length;
    const onePremiumTasks = taskStates.filter(
        (row) => Number(row.premium_calls_used || 0) === 1
    ).length;
    const twoPremiumTasks = taskStates.filter(
        (row) => Number(row.premium_calls_used || 0) >= 2
    ).length;
    const byLaneMap = new Map();
    for (const row of taskStates) {
        const lane = String(row.codex_instance || 'unassigned').trim();
        if (!byLaneMap.has(lane)) {
            byLaneMap.set(lane, {
                codex_instance: lane,
                tasks_total: 0,
                active_tasks: 0,
                closed_tasks: 0,
                premium_calls_total: 0,
                premium_subagent_sessions_total: 0,
                premium_root_exceptions_total: 0,
                premium_budget_total: 0,
                premium_budget_remaining: 0,
                tasks_zero_premium: 0,
                avoided_rework_calls: 0,
                mini_root_compliant_sessions: 0,
            });
        }
        const laneRow = byLaneMap.get(lane);
        laneRow.tasks_total += 1;
        if (
            (activeStatuses instanceof Set
                ? activeStatuses
                : new Set(activeStatuses || [])
            ).has(String(row.status || '').trim())
        ) {
            laneRow.active_tasks += 1;
        }
        if (String(row.status || '').trim() === 'done') {
            laneRow.closed_tasks += 1;
        }
        laneRow.premium_calls_total += Number(row.premium_calls_used || 0);
        laneRow.premium_subagent_sessions_total += Number(
            row.premium_subagent_sessions_total || 0
        );
        laneRow.premium_root_exceptions_total += Number(
            row.premium_root_exceptions_total || 0
        );
        laneRow.premium_budget_total += Number(row.premium_budget || 0);
        laneRow.premium_budget_remaining += Number(
            row.premium_budget_remaining || 0
        );
        laneRow.avoided_rework_calls += Number(row.avoided_rework_calls || 0);
        laneRow.mini_root_compliant_sessions += Number(
            row.mini_root_compliant_sessions || 0
        );
        if (Number(row.premium_calls_used || 0) === 0) {
            laneRow.tasks_zero_premium += 1;
        }
    }
    const premiumByExecutionMode = taskStates.reduce(
        (acc, row) => {
            const rowModes = row.premium_by_execution_mode || {};
            acc.subagent += Number(rowModes.subagent || 0);
            acc.main_thread_exception += Number(
                rowModes.main_thread_exception || 0
            );
            return acc;
        },
        { subagent: 0, main_thread_exception: 0 }
    );
    const miniRootCompliantSessions = taskStates.reduce(
        (acc, row) => acc + Number(row.mini_root_compliant_sessions || 0),
        0
    );
    return {
        policy_version: policy.version,
        scope: policy.scope,
        default_model_tier: policy.default_model_tier,
        premium_model_tier: policy.premium_model_tier,
        root_thread_model_tier: policy.root_thread_model_tier,
        premium_budget_unit: policy.premium_budget_unit,
        ledger_path: policy.ledger_path,
        decision_packets_dir: policy.decision_packets_dir,
        codex_tasks_total: totalTasks,
        active_codex_tasks: activeRows.length,
        premium_calls_total: taskStates.reduce(
            (acc, row) => acc + Number(row.premium_calls_used || 0),
            0
        ),
        premium_subagent_sessions_total: premiumByExecutionMode.subagent,
        premium_root_exceptions_total:
            premiumByExecutionMode.main_thread_exception,
        premium_by_execution_mode: premiumByExecutionMode,
        premium_tasks_total: taskStates.filter(
            (row) => Number(row.premium_calls_used || 0) > 0
        ).length,
        mini_root_compliance_pct:
            taskStates.reduce(
                (acc, row) => acc + Number(row.premium_calls_used || 0),
                0
            ) === 0
                ? 100
                : toPercent(
                      miniRootCompliantSessions,
                      taskStates.reduce(
                          (acc, row) =>
                              acc + Number(row.premium_calls_used || 0),
                          0
                      )
                  ),
        tasks_zero_premium_pct: toPercent(zeroPremiumTasks, totalTasks),
        tasks_one_premium_pct: toPercent(onePremiumTasks, totalTasks),
        tasks_two_premium_pct: toPercent(twoPremiumTasks, totalTasks),
        premium_budget_total_active: budgetRemaining.premium_budget_total,
        premium_budget_remaining_active:
            budgetRemaining.premium_budget_remaining,
        tasks_with_blockers: safeBlockers.length,
        target_mix: policy.target_mix,
        by_lane: Array.from(byLaneMap.values())
            .map((row) => ({
                ...row,
                tasks_zero_premium_pct: toPercent(
                    row.tasks_zero_premium,
                    row.tasks_total
                ),
                mini_root_compliance_pct:
                    row.premium_calls_total === 0
                        ? 100
                        : toPercent(
                              row.mini_root_compliant_sessions,
                              row.premium_calls_total
                          ),
            }))
            .sort((left, right) =>
                String(left.codex_instance).localeCompare(
                    String(right.codex_instance)
                )
            ),
        active_rows: activeRows.map((row) => ({
            task_id: row.task_id,
            codex_instance: row.codex_instance,
            status: row.status,
            model_tier_default: row.model_tier_default,
            premium_budget: row.premium_budget,
            premium_calls_used: row.premium_calls_used,
            premium_budget_remaining: row.premium_budget_remaining,
            premium_gate_state: row.premium_gate_state,
            decision_packet_ref: row.decision_packet_ref,
            premium_subagent_sessions_total:
                row.premium_subagent_sessions_total,
            premium_root_exceptions_total: row.premium_root_exceptions_total,
            premium_by_execution_mode: row.premium_by_execution_mode,
            mini_root_compliance_pct: row.mini_root_compliance_pct,
        })),
    };
}

function buildPremiumRoi(tasks, options = {}) {
    const {
        governancePolicy = {},
        ledgerEntries = [],
        activeStatuses = DEFAULT_ACTIVE_STATUSES,
    } = options;
    const policy = getModelRoutingPolicy(governancePolicy);
    const trackedTasks = (Array.isArray(tasks) ? tasks : []).filter((task) =>
        isTrackedCodexTask(task)
    );
    const taskStates = trackedTasks.map((task) =>
        buildTaskModelUsageState(task, {
            governancePolicy: policy,
            ledgerEntries,
        })
    );
    const premiumCallsTotal = taskStates.reduce(
        (acc, row) => acc + Number(row.premium_calls_used || 0),
        0
    );
    const avoidedReworkCalls = taskStates.reduce(
        (acc, row) => acc + Number(row.avoided_rework_calls || 0),
        0
    );
    const safeStatuses =
        activeStatuses instanceof Set
            ? activeStatuses
            : new Set(activeStatuses || []);
    return {
        policy_version: policy.version,
        premium_calls_total: premiumCallsTotal,
        premium_subagent_sessions_total: taskStates.reduce(
            (acc, row) =>
                acc + Number(row.premium_subagent_sessions_total || 0),
            0
        ),
        premium_root_exceptions_total: taskStates.reduce(
            (acc, row) => acc + Number(row.premium_root_exceptions_total || 0),
            0
        ),
        premium_by_execution_mode: taskStates.reduce(
            (acc, row) => {
                acc.subagent += Number(
                    row?.premium_by_execution_mode?.subagent || 0
                );
                acc.main_thread_exception += Number(
                    row?.premium_by_execution_mode?.main_thread_exception || 0
                );
                return acc;
            },
            { subagent: 0, main_thread_exception: 0 }
        ),
        premium_tasks_total: taskStates.filter(
            (row) => Number(row.premium_calls_used || 0) > 0
        ).length,
        avoided_rework_calls: avoidedReworkCalls,
        avoided_rework_rate_pct: toPercent(
            avoidedReworkCalls,
            premiumCallsTotal
        ),
        mini_root_compliance_pct:
            premiumCallsTotal === 0
                ? 100
                : toPercent(
                      taskStates.reduce(
                          (acc, row) =>
                              acc +
                              Number(row.mini_root_compliant_sessions || 0),
                          0
                      ),
                      premiumCallsTotal
                  ),
        tasks_zero_premium_pct: toPercent(
            taskStates.filter(
                (row) => Number(row.premium_calls_used || 0) === 0
            ).length,
            taskStates.length
        ),
        tasks_one_premium_pct: toPercent(
            taskStates.filter(
                (row) => Number(row.premium_calls_used || 0) === 1
            ).length,
            taskStates.length
        ),
        tasks_two_premium_pct: toPercent(
            taskStates.filter((row) => Number(row.premium_calls_used || 0) >= 2)
                .length,
            taskStates.length
        ),
        premium_budget_total_active: taskStates
            .filter((row) => safeStatuses.has(String(row.status || '').trim()))
            .reduce((acc, row) => acc + Number(row.premium_budget || 0), 0),
        premium_budget_remaining_active: taskStates
            .filter((row) => safeStatuses.has(String(row.status || '').trim()))
            .reduce(
                (acc, row) => acc + Number(row.premium_budget_remaining || 0),
                0
            ),
        target_mix: policy.target_mix,
    };
}

function buildTaskModelUsageSummary(task, options = {}) {
    if (!task || typeof task !== 'object') return null;
    const policy = getModelRoutingPolicy(options.governancePolicy);
    const state = buildTaskModelUsageState(task, {
        governancePolicy: policy,
        ledgerEntries: options.ledgerEntries,
    });
    return {
        task_id: state.task_id,
        model_policy_version: state.model_policy_version,
        default_model_tier: state.model_tier_default,
        premium_model_tier: policy.premium_model_tier,
        premium_budget: state.premium_budget,
        premium_calls_used: state.premium_calls_used,
        premium_budget_remaining: state.premium_budget_remaining,
        premium_gate_state: state.premium_gate_state,
        decision_packet_ref: state.decision_packet_ref,
        avoided_rework_calls: state.avoided_rework_calls,
        premium_reasons: state.premium_entries.map((entry) => entry.reason),
        premium_subagent_sessions_total: state.premium_subagent_sessions_total,
        premium_root_exceptions_total: state.premium_root_exceptions_total,
        premium_by_execution_mode: state.premium_by_execution_mode,
        premium_execution_modes: state.premium_execution_modes,
        mini_root_compliance_pct: state.mini_root_compliance_pct,
    };
}

module.exports = {
    DEFAULT_POLICY_VERSION,
    DEFAULT_MODEL_TIER,
    DEFAULT_PREMIUM_MODEL,
    DEFAULT_LEDGER_PATH,
    DEFAULT_DECISION_PACKETS_DIR,
    DEFAULT_ROOT_THREAD_MODEL_TIER,
    DEFAULT_PREMIUM_BUDGET_UNIT,
    DEFAULT_ACTIVE_STATUSES,
    DEFAULT_ALLOWED_GATE_STATES,
    DEFAULT_PREMIUM_REASONS,
    DEFAULT_ALLOWED_EXECUTION_MODES,
    DEFAULT_PROHIBITED_PREMIUM_USES,
    DEFAULT_DECISION_PACKET_FIELDS,
    normalizeToken,
    normalizePath,
    toPositiveInt,
    toBoolean,
    hasModelRoutingFields,
    isTrackedCodexTask,
    isActiveTrackedCodexTask,
    getModelRoutingPolicy,
    derivePremiumBudget,
    normalizeGateState,
    normalizeModelUsageEntry,
    readModelUsageLedger,
    getTaskPremiumEntries,
    buildTaskModelUsageState,
    syncTaskModelRoutingState,
    validateDecisionPacketFile,
    collectTaskModelRoutingErrors,
    collectPremiumGateBlockers,
    buildPremiumBudgetRemaining,
    buildModelUsageSummary,
    buildPremiumRoi,
    buildTaskModelUsageSummary,
};
