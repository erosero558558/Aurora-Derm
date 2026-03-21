#!/usr/bin/env node
'use strict';

const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, resolve } = require('path');
const { spawnSync } = require('child_process');

const coreFlags = require('../tools/agent-orchestrator/core/flags');
const coreParsers = require('../tools/agent-orchestrator/core/parsers');
const boardDoctorDomain = require('../tools/agent-orchestrator/domain/board-doctor');
const boardLeasesDomain = require('../tools/agent-orchestrator/domain/board-leases');

const { flags } = coreFlags.parseFlags(process.argv.slice(2));

const ROOT = resolve(flags.root || resolve(__dirname, '..'));
const ORCHESTRATOR = resolve(ROOT, 'agent-orchestrator.js');
const BOARD_PATH = resolve(ROOT, 'AGENT_BOARD.yaml');
const GOVERNANCE_POLICY_PATH = resolve(ROOT, 'governance-policy.json');
const DEFAULT_JSON_PATH = 'verification/daily-ops/latest.json';
const DEFAULT_MD_PATH = 'verification/daily-ops/latest.md';
const HISTORY_PATH = 'verification/agent-daily-pulse-history.json';
const HISTORY_RETENTION_DAYS = 365;
const ACTIVE_STATUSES = new Set(['ready', 'in_progress', 'review', 'blocked']);
const STATUS_CHANGE_BLOCKED_REASON =
    'auto:daily_pulse:stale_status_without_fresh_heartbeat';

function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function getNow() {
    const override = String(process.env.AGENT_DAILY_PULSE_NOW || '').trim();
    if (override) {
        const parsed = new Date(override);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

function isoDate(value) {
    return value.toISOString().slice(0, 10);
}

function ensureDirForFile(filePath) {
    mkdirSync(dirname(filePath), { recursive: true });
}

function writeText(relativePath, content) {
    const outputPath = resolve(ROOT, relativePath);
    ensureDirForFile(outputPath);
    writeFileSync(outputPath, content, 'utf8');
}

function writeJson(relativePath, value) {
    writeText(relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function loadJsonFile(filePath, fallback) {
    if (!existsSync(filePath)) return fallback;
    try {
        return JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
        return fallback;
    }
}

function loadGovernancePolicy() {
    return loadJsonFile(GOVERNANCE_POLICY_PATH, {});
}

function loadBoard() {
    if (!existsSync(BOARD_PATH)) {
        throw new Error(`No existe AGENT_BOARD.yaml en ${ROOT}`);
    }
    return coreParsers.parseBoardContent(readFileSync(BOARD_PATH, 'utf8'));
}

function buildCommandText(args) {
    return `node agent-orchestrator.js ${args
        .map((value) => {
            const text = String(value);
            return /\s/.test(text) ? JSON.stringify(text) : text;
        })
        .join(' ')}`;
}

function runOrchestratorJson(args, options = {}) {
    const env = options.env ? { ...process.env, ...options.env } : process.env;
    const result = spawnSync(process.execPath, [ORCHESTRATOR, ...args], {
        cwd: ROOT,
        encoding: 'utf8',
        env,
        maxBuffer: 2 * 1024 * 1024,
    });
    if (result.error) throw result.error;

    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    let parsed = null;
    let parseError = '';
    try {
        parsed = stdout ? JSON.parse(stdout) : null;
    } catch (error) {
        parseError = String(error && error.message ? error.message : error);
    }

    if (!parsed) {
        throw new Error(
            `No se pudo parsear JSON para ${buildCommandText(args)}: ${
                parseError || stderr || stdout || 'sin salida'
            }`
        );
    }

    return {
        args,
        command_text: buildCommandText(args),
        exit_code: typeof result.status === 'number' ? result.status : 1,
        ok: result.status === 0 && parsed.ok !== false,
        stdout,
        stderr,
        json: parsed,
    };
}

function runGitLines(args) {
    const result = spawnSync('git', args, {
        cwd: ROOT,
        encoding: 'utf8',
        maxBuffer: 2 * 1024 * 1024,
    });
    if (result.error) throw result.error;
    return {
        ok: result.status === 0,
        exit_code: typeof result.status === 'number' ? result.status : 1,
        stdout: String(result.stdout || ''),
        stderr: String(result.stderr || ''),
    };
}

function daysSinceMonthStart(now) {
    return Math.max(1, now.getUTCDate());
}

function hoursSince(value, now) {
    const ms = Date.parse(String(value || ''));
    if (!Number.isFinite(ms)) return null;
    return (now.getTime() - ms) / (1000 * 60 * 60);
}

function isHeartbeatFresh(lease, leasePolicy) {
    if (!lease || lease.has_lease !== true) return false;
    if (lease.expired === true) return false;
    const threshold = safeNumber(leasePolicy?.heartbeat_stale_minutes, 30);
    return (
        lease.heartbeat_age_minutes !== null &&
        Number(lease.heartbeat_age_minutes) <= threshold
    );
}

function categorizeCommit(message) {
    const text = String(message || '');
    const categories = [];
    if (
        /\b(add|feat|implement|create|launch|introduc|build|enable|ship|support|release|rollout|promote|expand|publish|connect|cover|relaunch|expose)\b/i.test(
            text
        )
    ) {
        categories.push('feature');
    }
    if (
        /\b(fix|restore|recover|repair|hotfix|resolve|stabiliz|correct|patch|fallback|rollback|guard|harden)\b/i.test(
            text
        )
    ) {
        categories.push('fix');
    }
    if (/\b(sync|merge|rebase|align|reconcile|remap)\b/i.test(text)) {
        categories.push('sync');
    }
    if (
        /\b(refactor|extract|split|modular|cleanup|rename|dedupe)\b/i.test(text)
    ) {
        categories.push('refactor');
    }
    if (
        /\b(test|qa|contract|lint|gate|smoke|verify|audit|diagnostic|telemetry|monitor|docs)\b/i.test(
            text
        )
    ) {
        categories.push('quality');
    }
    if (categories.length === 0) categories.push('other');
    return categories;
}

function buildGitActivity(now) {
    const monthStart = `${String(now.getUTCFullYear())}-${String(
        now.getUTCMonth() + 1
    ).padStart(2, '0')}-01`;
    const today = isoDate(now);
    const result = runGitLines([
        'log',
        `--since=${monthStart} 00:00`,
        `--until=${today} 23:59`,
        '--date=short',
        '--pretty=format:%ad%x09%s',
    ]);
    if (!result.ok) {
        const stderr = String(result.stderr || '').trim();
        if (/not a git repository/i.test(stderr)) {
            return {
                available: false,
                from_date: monthStart,
                to_date: today,
                reason: 'not_git_repo',
                error: stderr,
            };
        }
        return {
            available: false,
            from_date: monthStart,
            to_date: today,
            reason: 'git_log_failed',
            error: stderr || String(result.stdout || '').trim(),
        };
    }

    const totals = {
        commits: 0,
        feature: 0,
        fix: 0,
        sync: 0,
        refactor: 0,
        quality: 0,
        other: 0,
    };
    const byDay = new Map();
    for (const rawLine of result.stdout.split('\n')) {
        const line = rawLine.trim();
        if (!line) continue;
        const [date, message = ''] = line.split('\t');
        const entry = byDay.get(date) || {
            date,
            commits: 0,
            feature: 0,
            fix: 0,
            sync: 0,
            refactor: 0,
            quality: 0,
            other: 0,
        };
        entry.commits += 1;
        totals.commits += 1;
        for (const category of categorizeCommit(message)) {
            entry[category] += 1;
            totals[category] += 1;
        }
        byDay.set(date, entry);
    }

    const days = Array.from(byDay.values()).sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
    );
    const topDays = days
        .slice()
        .sort((a, b) => b.commits - a.commits || a.date.localeCompare(b.date))
        .slice(0, 5);

    return {
        available: true,
        from_date: monthStart,
        to_date: today,
        totals,
        days,
        top_days: topDays,
    };
}

function buildBoardEvents(now) {
    const days = String(daysSinceMonthStart(now));
    return runOrchestratorJson([
        'board',
        'events',
        'stats',
        '--days',
        days,
        '--json',
    ]).json;
}

function getTaskStatusThresholdHours(task, doctorPolicy) {
    const status = String(task.status || '')
        .trim()
        .toLowerCase();
    if (status === 'in_progress') {
        return safeNumber(
            doctorPolicy?.thresholds?.in_progress_stale_hours,
            24
        );
    }
    if (status === 'review') {
        return safeNumber(doctorPolicy?.thresholds?.review_stale_hours, 48);
    }
    if (status === 'blocked') {
        return safeNumber(doctorPolicy?.thresholds?.blocked_stale_hours, 24);
    }
    return null;
}

function buildActiveTasks(
    board,
    activePayload,
    leasesPayload,
    doctorPolicy,
    leasePolicy,
    now
) {
    const boardMap = new Map(
        (Array.isArray(board.tasks) ? board.tasks : []).map((task) => [
            String(task.id || ''),
            task,
        ])
    );
    const leaseMap = new Map(
        (Array.isArray(leasesPayload.leases) ? leasesPayload.leases : []).map(
            (row) => [String(row.task_id || ''), row]
        )
    );
    return (Array.isArray(activePayload.tasks) ? activePayload.tasks : []).map(
        (task) => {
            const taskId = String(task.id || '');
            const boardTask = boardMap.get(taskId) || {};
            const leaseRow = leaseMap.get(taskId) || null;
            const lease = leaseRow
                ? {
                      has_lease: Boolean(leaseRow.has_lease),
                      lease_id: String(leaseRow.lease_id || ''),
                      lease_owner: String(leaseRow.lease_owner || ''),
                      heartbeat_at: String(leaseRow.heartbeat_at || ''),
                      lease_expires_at: String(leaseRow.lease_expires_at || ''),
                      expired: Boolean(leaseRow.expired),
                      heartbeat_age_minutes:
                          leaseRow.heartbeat_age_minutes === null
                              ? null
                              : safeNumber(leaseRow.heartbeat_age_minutes),
                  }
                : {
                      has_lease: false,
                      lease_id: '',
                      lease_owner: '',
                      heartbeat_at: '',
                      lease_expires_at: '',
                      expired: false,
                      heartbeat_age_minutes: null,
                  };
            const statusSinceAt = String(
                boardTask.status_since_at ||
                    boardTask.updated_at ||
                    task.updated_at ||
                    ''
            ).trim();
            const statusAgeHours = hoursSince(statusSinceAt, now);
            const staleThresholdHours = getTaskStatusThresholdHours(
                { ...task, status: boardTask.status || task.status },
                doctorPolicy
            );

            return {
                ...task,
                blocked_reason: String(boardTask.blocked_reason || '').trim(),
                depends_on: Array.isArray(boardTask.depends_on)
                    ? boardTask.depends_on.slice()
                    : [],
                critical_zone: String(boardTask.critical_zone || '').trim(),
                acceptance: String(boardTask.acceptance || '').trim(),
                status_since_at: statusSinceAt,
                status_age_hours:
                    statusAgeHours === null
                        ? null
                        : Math.round(statusAgeHours * 10) / 10,
                stale_threshold_hours: staleThresholdHours,
                stale_by_threshold:
                    staleThresholdHours !== null &&
                    statusAgeHours !== null &&
                    statusAgeHours > staleThresholdHours,
                lease,
                heartbeat_fresh: isHeartbeatFresh(lease, leasePolicy),
            };
        }
    );
}

function buildTaskMarkers(task) {
    const fileText = (Array.isArray(task.files) ? task.files : [])
        .map((item) => String(item || '').toLowerCase())
        .join(' ');
    const summaryText = [
        task.title,
        task.scope,
        task.expected_outcome,
        task.blocked_reason,
    ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');
    const combined = `${summaryText} ${fileText}`;
    return {
        public_sync:
            /public[_ -]?sync|health[_ -]?public|health[_ -]?missing[_ -]?public[_ -]?sync|registry[_ -]?only/i.test(
                combined
            ) ||
            /controllers\/healthcontroller\.php|public_main_update_runbook|checklist-host-public-sync|verificar-despliegue/i.test(
                fileText
            ),
        operator_auth:
            /\bopenclaw\b|\boperator[_ -]?auth\b|\bweb broker\b|\bauth\b/i.test(
                combined
            ) ||
            /operatorauthcontroller|admin-auth\.php|lib\/auth\.php|openclaw-auth-preflight|operator-auth-live-smoke/i.test(
                fileText
            ),
    };
}

function getFocusCheck(focus, id) {
    return (
        Array.isArray(focus?.required_checks) ? focus.required_checks : []
    ).find(
        (item) =>
            String(item.id || '')
                .trim()
                .toLowerCase() ===
            String(id || '')
                .trim()
                .toLowerCase()
    );
}

function buildBlockers(
    statusPayload,
    boardDoctorPayload,
    jobsVerifyPayload,
    activeTasks
) {
    const blockers = [];
    for (const diag of Array.isArray(statusPayload.diagnostics)
        ? statusPayload.diagnostics
        : []) {
        blockers.push({
            code: String(diag.code || 'status_warning'),
            severity: String(diag.severity || 'warning'),
            source: 'status',
            message: String(diag.message || ''),
            task_ids: Array.isArray(diag.task_ids) ? diag.task_ids.slice() : [],
        });
    }
    for (const diag of Array.isArray(boardDoctorPayload.diagnostics)
        ? boardDoctorPayload.diagnostics
        : []) {
        blockers.push({
            code: String(diag.code || 'board_warning'),
            severity: String(diag.severity || 'warning'),
            source: 'board_doctor',
            message: String(diag.message || ''),
            task_ids: Array.isArray(diag.task_ids) ? diag.task_ids.slice() : [],
        });
    }
    if (jobsVerifyPayload?.job && jobsVerifyPayload.ok === false) {
        blockers.push({
            code: 'block.jobs.public_main_sync_failed',
            severity: 'error',
            source: 'jobs_verify',
            message: `public_main_sync no esta sano: ${String(
                jobsVerifyPayload.job.failure_reason ||
                    jobsVerifyPayload.job.last_error_message ||
                    jobsVerifyPayload.job.state ||
                    'unknown'
            )}`,
            task_ids: activeTasks
                .filter((task) => buildTaskMarkers(task).public_sync)
                .map((task) => task.id),
        });
    }

    const unique = new Map();
    for (const blocker of blockers) {
        const key = [
            blocker.code,
            blocker.source,
            blocker.message,
            blocker.task_ids.join(','),
        ].join('|');
        if (!unique.has(key)) unique.set(key, blocker);
    }
    return Array.from(unique.values());
}

function loadHistory() {
    const resolvedPath = resolve(ROOT, HISTORY_PATH);
    return loadJsonFile(resolvedPath, {
        version: 1,
        updated_at: '',
        retention_days: HISTORY_RETENTION_DAYS,
        snapshots: [],
    });
}

function upsertHistory(history, snapshot) {
    const current = history && typeof history === 'object' ? history : {};
    const snapshots = Array.isArray(current.snapshots)
        ? current.snapshots.slice()
        : [];
    const next = snapshots.filter(
        (item) => String(item.date || '') !== String(snapshot.date || '')
    );
    next.push(snapshot);
    next.sort((a, b) =>
        String(a.date || '').localeCompare(String(b.date || ''))
    );
    return {
        version: 1,
        updated_at: snapshot.generated_at,
        retention_days: HISTORY_RETENTION_DAYS,
        snapshots: next.slice(-HISTORY_RETENTION_DAYS),
    };
}

function computeCodeStreaks(snapshots, selector) {
    const ordered = (Array.isArray(snapshots) ? snapshots : [])
        .slice()
        .sort((a, b) =>
            String(a.date || '').localeCompare(String(b.date || ''))
        );
    const latest = ordered[ordered.length - 1];
    if (!latest) return {};
    const streaks = {};
    const trackedCodes = Array.from(new Set(selector(latest))).filter(Boolean);
    for (const code of trackedCodes) {
        let streak = 0;
        for (let index = ordered.length - 1; index >= 0; index -= 1) {
            const codes = new Set(selector(ordered[index]));
            if (!codes.has(code)) break;
            streak += 1;
        }
        streaks[code] = streak;
    }
    return streaks;
}

function buildHistoryTrends(history) {
    const snapshots = Array.isArray(history?.snapshots)
        ? history.snapshots
        : [];
    const blockerStreaks = computeCodeStreaks(snapshots, (item) =>
        Array.isArray(item.blocker_codes) ? item.blocker_codes : []
    );
    const failedCheckStreaks = computeCodeStreaks(snapshots, (item) =>
        (Array.isArray(item.required_checks) ? item.required_checks : [])
            .filter((check) => check && check.ok === false)
            .map((check) => String(check.id || ''))
            .filter(Boolean)
    );
    const latest = snapshots[snapshots.length - 1] || null;
    return {
        snapshots_total: snapshots.length,
        latest_date: latest ? String(latest.date || '') : '',
        blocker_streaks: blockerStreaks,
        failed_check_streaks: failedCheckStreaks,
    };
}

function buildSnapshotSummary(
    statusPayload,
    boardDoctorPayload,
    jobsVerifyPayload,
    activeTasks,
    blockers,
    gitActivity,
    autofix
) {
    const blockedTasks = activeTasks.filter(
        (task) =>
            String(task.status || '')
                .trim()
                .toLowerCase() === 'blocked'
    ).length;
    const expiredLeases = activeTasks.filter(
        (task) => task.lease && task.lease.expired === true
    ).length;
    const focusRequiredChecks = Array.isArray(
        statusPayload.focus?.required_checks
    )
        ? statusPayload.focus.required_checks
        : [];
    let globalSignal = 'GREEN';
    if (
        jobsVerifyPayload.ok === false ||
        focusRequiredChecks.some((check) => check.ok === false) ||
        activeTasks.some(
            (task) =>
                ['in_progress', 'review'].includes(
                    String(task.status || '')
                        .trim()
                        .toLowerCase()
                ) &&
                task.stale_by_threshold &&
                task.heartbeat_fresh !== true
        )
    ) {
        globalSignal = 'RED';
    } else if (blockers.length > 0 || blockedTasks > 0 || expiredLeases > 0) {
        globalSignal = 'YELLOW';
    }

    return {
        global_signal: globalSignal,
        board_revision: safeNumber(statusPayload.policy?.revision, 0),
        active_tasks_total: activeTasks.length,
        blocked_tasks_total: blockedTasks,
        blockers_total: blockers.length,
        expired_leases: expiredLeases,
        focus_required_checks_ok:
            statusPayload.focus?.required_checks_ok === true,
        public_main_sync_ok: jobsVerifyPayload.ok === true,
        month_git_commits: safeNumber(gitActivity?.totals?.commits, 0),
        autofix_planned_total: safeNumber(autofix?.planned_total, 0),
        autofix_applied_total: safeNumber(autofix?.applied_total, 0),
        autofix_failed_total: safeNumber(autofix?.failed_total, 0),
        board_doctor_findings: safeNumber(
            boardDoctorPayload.summary?.findings,
            0
        ),
    };
}

function buildChecks(
    statusPayload,
    boardDoctorPayload,
    jobsVerifyPayload,
    leasesPayload,
    metricsPayload
) {
    const focusRequiredChecks = Array.isArray(
        statusPayload.focus?.required_checks
    )
        ? statusPayload.focus.required_checks
        : [];
    return {
        public_main_sync: {
            ok: jobsVerifyPayload.ok === true,
            verified: Boolean(jobsVerifyPayload.job?.verified),
            healthy: Boolean(jobsVerifyPayload.job?.healthy),
            state: String(jobsVerifyPayload.job?.state || ''),
            verification_source: String(
                jobsVerifyPayload.job?.verification_source || ''
            ),
            failure_reason: String(jobsVerifyPayload.job?.failure_reason || ''),
            repo_hygiene_issue: Boolean(
                jobsVerifyPayload.job?.repo_hygiene_issue
            ),
            operationally_healthy: Boolean(
                jobsVerifyPayload.job?.operationally_healthy
            ),
            last_error_message: String(
                jobsVerifyPayload.job?.last_error_message || ''
            ),
        },
        focus_required_checks: focusRequiredChecks.map((item) => ({
            id: String(item.id || ''),
            type: String(item.type || ''),
            target: String(item.target || ''),
            state: String(item.state || ''),
            ok: item.ok === true,
            message: String(item.message || ''),
        })),
        board_doctor: {
            findings: safeNumber(boardDoctorPayload.summary?.findings, 0),
            warnings_count: safeNumber(boardDoctorPayload.warnings_count, 0),
            errors_count: safeNumber(boardDoctorPayload.errors_count, 0),
        },
        leases: {
            active_tracked: safeNumber(
                leasesPayload.summary?.active_tracked,
                0
            ),
            active_required_missing: safeNumber(
                leasesPayload.summary?.active_required_missing,
                0
            ),
            active_expired: safeNumber(
                leasesPayload.summary?.active_expired,
                0
            ),
        },
        metrics: {
            tasks_total: safeNumber(metricsPayload.current?.tasks_total, 0),
            tasks_done: safeNumber(metricsPayload.current?.tasks_done, 0),
            tasks_in_progress: safeNumber(
                metricsPayload.current?.tasks_in_progress,
                0
            ),
            traceability_pct: safeNumber(
                metricsPayload.current?.traceability_pct,
                0
            ),
        },
    };
}

function buildRecommendedActions(snapshot, historyTrends) {
    const actions = [];
    if (snapshot.checks.public_main_sync.ok !== true) {
        actions.push({
            code: 'review_public_main_sync',
            priority: 'high',
            message:
                'Revisar el contrato publico de health y el estado productivo de public_main_sync antes de seguir cerrando el corte.',
            suggested_command:
                'node agent-orchestrator.js jobs verify public_main_sync --json',
        });
    }
    if (
        snapshot.active_tasks.some(
            (task) =>
                ['in_progress', 'review'].includes(
                    String(task.status || '')
                        .trim()
                        .toLowerCase()
                ) &&
                task.stale_by_threshold &&
                task.heartbeat_fresh !== true
        )
    ) {
        actions.push({
            code: 'review_stale_active_tasks',
            priority: 'high',
            message:
                'Hay tareas activas sin heartbeat fresco y por encima del umbral; confirmar si deben seguir activas o quedar bloqueadas.',
            suggested_command: 'node agent-orchestrator.js board doctor --json',
        });
    }
    for (const [code, streak] of Object.entries(
        historyTrends.blocker_streaks || {}
    )) {
        if (safeNumber(streak, 0) < 3) continue;
        actions.push({
            code: `formalize_${code}`,
            priority: 'medium',
            message: `El bloqueo ${code} lleva ${streak} dias consecutivos; conviene formalizarlo en tarea o decision manual.`,
            suggested_command: 'node agent-orchestrator.js decision ls --json',
        });
    }
    if (snapshot.summary.expired_leases > 0) {
        actions.push({
            code: 'clear_remaining_expired_leases',
            priority: 'medium',
            message:
                'Aun quedan leases expirados despues del pulse; revisar si las tareas siguen activas o necesitan reconciliacion manual.',
            suggested_command:
                'node agent-orchestrator.js leases status --active --json',
        });
    }
    return actions;
}

function summarizeActionResult(result) {
    if (!result || typeof result !== 'object') return null;
    return {
        ok: result.ok === true,
        exit_code: safeNumber(result.exit_code, 1),
        error: String(result.json?.error || ''),
        error_code: String(result.json?.error_code || ''),
        lease_action: String(result.json?.lease_action || ''),
        task:
            result.json?.task && typeof result.json.task === 'object'
                ? {
                      id: String(result.json.task.id || ''),
                      status: String(result.json.task.status || ''),
                      updated_at: String(result.json.task.updated_at || ''),
                  }
                : null,
    };
}

function shouldSkipStatusMutation(task) {
    return String(task.id || '')
        .trim()
        .toUpperCase()
        .startsWith('CDX-');
}

function planAutofix(snapshot, doctorPolicy, leasePolicy) {
    const planned = [];
    const plannedTaskIds = new Set();
    const focus = snapshot.focus || {};

    for (const task of snapshot.active_tasks) {
        const status = String(task.status || '')
            .trim()
            .toLowerCase();
        if (!['in_progress', 'review'].includes(status)) continue;
        const threshold = getTaskStatusThresholdHours(task, doctorPolicy);
        if (threshold === null) continue;
        if (task.stale_by_threshold !== true) continue;
        if (task.heartbeat_fresh === true) continue;
        const action = {
            kind: 'task_status_change',
            task_id: task.id,
            owner: task.owner || 'unassigned',
            next_status: 'blocked',
            reason_code: 'stale_status_without_fresh_heartbeat',
            reason_text:
                'Task supera el umbral operativo y no tiene heartbeat fresco',
            blocked_reason: STATUS_CHANGE_BLOCKED_REASON,
        };
        if (shouldSkipStatusMutation(task)) {
            action.skipped = true;
            action.skip_reason = 'codex_task_requires_manual_reconcile';
        }
        planned.push(action);
        plannedTaskIds.add(task.id);
    }

    for (const task of snapshot.active_tasks) {
        const status = String(task.status || '')
            .trim()
            .toLowerCase();
        if (status !== 'blocked') continue;
        const markers = buildTaskMarkers(task);
        let readyReasonCode = '';
        let readyReasonText = '';
        const focusRuntimeCheck = getFocusCheck(focus, 'runtime:operator_auth');

        if (
            Array.isArray(task.depends_on) &&
            task.depends_on.length > 0 &&
            task.depends_on.every((id) => {
                const dependency = snapshot.board_task_map[String(id || '')];
                if (!dependency) return false;
                return ['done', 'failed'].includes(
                    String(dependency.status || '')
                        .trim()
                        .toLowerCase()
                );
            })
        ) {
            readyReasonCode = 'depends_on_terminal';
            readyReasonText =
                'Todas las dependencias del task ya estan terminales';
        } else if (
            markers.public_sync &&
            snapshot.checks.public_main_sync.ok === true
        ) {
            readyReasonCode = 'public_main_sync_green';
            readyReasonText =
                'public_main_sync ya volvio a verde para el soporte de deploy/readiness';
        } else if (
            markers.operator_auth &&
            focusRuntimeCheck &&
            focusRuntimeCheck.ok === true
        ) {
            readyReasonCode = 'runtime_operator_auth_green';
            readyReasonText =
                'runtime:operator_auth ya esta verde para el soporte auth/runtime';
        }

        if (!readyReasonCode) continue;

        const action = {
            kind: 'task_status_change',
            task_id: task.id,
            owner: task.owner || 'unassigned',
            next_status: 'ready',
            reason_code: readyReasonCode,
            reason_text: readyReasonText,
        };
        if (shouldSkipStatusMutation(task)) {
            action.skipped = true;
            action.skip_reason = 'codex_task_requires_manual_reconcile';
        }
        planned.push(action);
        plannedTaskIds.add(task.id);
    }

    for (const task of snapshot.active_tasks) {
        if (plannedTaskIds.has(task.id)) continue;
        if (!task.lease || task.lease.expired !== true) continue;
        const threshold = getTaskStatusThresholdHours(task, doctorPolicy);
        if (
            threshold !== null &&
            task.status_age_hours !== null &&
            task.status_age_hours > threshold
        ) {
            continue;
        }
        planned.push({
            kind: 'renew_lease',
            task_id: task.id,
            owner: task.owner || 'unassigned',
            ttl_hours: safeNumber(leasePolicy.ttl_hours_default, 4),
            reason_code: 'expired_lease_within_threshold',
            reason_text:
                'El lease expiro pero la tarea sigue dentro del umbral operativo',
        });
    }

    return {
        mode: snapshot.apply ? 'apply' : 'preview',
        guardrails: [
            'Solo usa comandos canonicos del orquestador para mutaciones.',
            'No edita YAML directo ni crea/cierra tareas o decisiones en v1.',
            'No ejecuta deploys ni remediaciones runtime productivas.',
            'Las tareas CDX requieren reconciliacion manual para cambios de estado.',
        ],
        planned,
    };
}

function readBoardRevision() {
    const board = loadBoard();
    return safeNumber(board.policy?.revision, 0);
}

function executeAutofixPlan(plan) {
    const actions = [];
    let expectedRevision = readBoardRevision();

    for (const item of plan.planned) {
        if (item.skipped) {
            actions.push({
                ...item,
                executed: false,
                ok: true,
                status: 'skipped',
            });
            continue;
        }

        let args = [];
        if (item.kind === 'renew_lease') {
            args = [
                'leases',
                'heartbeat',
                item.task_id,
                '--ttl-hours',
                String(item.ttl_hours || 4),
                '--expect-rev',
                String(expectedRevision),
                '--json',
            ];
        } else if (item.kind === 'task_status_change') {
            args = [
                'task',
                'claim',
                item.task_id,
                '--owner',
                item.owner || 'unassigned',
                '--status',
                item.next_status,
                '--expect-rev',
                String(expectedRevision),
                '--json',
            ];
            if (item.next_status === 'blocked' && item.blocked_reason) {
                args.push('--blocked-reason', item.blocked_reason);
            }
        } else {
            actions.push({
                ...item,
                executed: false,
                ok: false,
                status: 'failed',
                error: 'unsupported_action_kind',
            });
            continue;
        }

        let commandResult = runOrchestratorJson(args);
        if (
            commandResult.json?.error_code === 'board_revision_mismatch' ||
            commandResult.exit_code !== 0
        ) {
            expectedRevision = readBoardRevision();
            const retryArgs = args.slice();
            const expectIndex = retryArgs.indexOf('--expect-rev');
            if (expectIndex >= 0 && retryArgs[expectIndex + 1] !== undefined) {
                retryArgs[expectIndex + 1] = String(expectedRevision);
            }
            commandResult = runOrchestratorJson(retryArgs);
        }

        const ok = commandResult.ok === true;
        actions.push({
            ...item,
            executed: true,
            ok,
            status: ok ? 'applied' : 'failed',
            command: commandResult.command_text,
            result: summarizeActionResult(commandResult),
        });
        if (ok) {
            expectedRevision = readBoardRevision();
        }
    }

    return actions;
}

function collectSnapshot(options = {}) {
    const now = options.now instanceof Date ? options.now : getNow();
    const metricsProfile = String(options.profile || 'local')
        .trim()
        .toLowerCase();
    const apply = options.apply === true;
    const writeMetrics = options.writeMetrics === true;
    const policy = loadGovernancePolicy();
    const doctorPolicy = boardDoctorDomain.normalizeDoctorPolicy(policy);
    const leasePolicy = boardLeasesDomain.normalizeBoardLeasesPolicy(policy);
    const statusPayload = runOrchestratorJson(['status', '--json']).json;
    const boardDoctorPayload = runOrchestratorJson([
        'board',
        'doctor',
        '--json',
    ]).json;
    const activePayload = runOrchestratorJson([
        'task',
        'ls',
        '--active',
        '--json',
    ]).json;
    const leasesPayload = runOrchestratorJson([
        'leases',
        'status',
        '--active',
        '--json',
    ]).json;
    const jobsVerifyPayload = runOrchestratorJson([
        'jobs',
        'verify',
        'public_main_sync',
        '--json',
    ]).json;
    const metricsArgs = ['metrics', '--json', '--profile', metricsProfile];
    if (!writeMetrics && metricsProfile === 'ci') {
        metricsArgs.push('--dry-run');
    }
    const metricsPayload = runOrchestratorJson(metricsArgs).json;
    const boardEventsPayload = buildBoardEvents(now);
    const gitActivity = buildGitActivity(now);
    const board = loadBoard();
    const boardTaskMap = Object.fromEntries(
        (Array.isArray(board.tasks) ? board.tasks : []).map((task) => [
            String(task.id || ''),
            task,
        ])
    );
    const activeTasks = buildActiveTasks(
        board,
        activePayload,
        leasesPayload,
        doctorPolicy,
        leasePolicy,
        now
    );
    const blockers = buildBlockers(
        statusPayload,
        boardDoctorPayload,
        jobsVerifyPayload,
        activeTasks
    );
    const placeholderAutofix = {
        planned_total: 0,
        applied_total: 0,
        failed_total: 0,
    };
    return {
        generated_at: now.toISOString(),
        date: isoDate(now),
        apply,
        profile: metricsProfile,
        doctor_policy: doctorPolicy,
        lease_policy: leasePolicy,
        status: statusPayload,
        board_doctor: boardDoctorPayload,
        active_tasks_payload: activePayload,
        leases_payload: leasesPayload,
        jobs_verify: jobsVerifyPayload,
        metrics: metricsPayload,
        board_events: boardEventsPayload,
        git_activity: gitActivity,
        board_task_map: boardTaskMap,
        active_tasks: activeTasks,
        focus: {
            id: String(statusPayload.focus?.configured?.id || ''),
            title: String(statusPayload.focus?.configured?.title || ''),
            summary: String(statusPayload.focus?.configured?.summary || ''),
            proof: String(statusPayload.focus?.configured?.proof || ''),
            next_step: String(statusPayload.focus?.configured?.next_step || ''),
            owner: String(statusPayload.focus?.configured?.owner || ''),
            required_checks: Array.isArray(statusPayload.focus?.required_checks)
                ? statusPayload.focus.required_checks.map((item) => ({
                      id: String(item.id || ''),
                      type: String(item.type || ''),
                      target: String(item.target || ''),
                      state: String(item.state || ''),
                      ok: item.ok === true,
                      message: String(item.message || ''),
                  }))
                : [],
        },
        checks: buildChecks(
            statusPayload,
            boardDoctorPayload,
            jobsVerifyPayload,
            leasesPayload,
            metricsPayload
        ),
        blockers,
        summary: buildSnapshotSummary(
            statusPayload,
            boardDoctorPayload,
            jobsVerifyPayload,
            activeTasks,
            blockers,
            gitActivity,
            placeholderAutofix
        ),
    };
}

function buildHistorySnapshot(report) {
    return {
        date: report.generated_at.slice(0, 10),
        generated_at: report.generated_at,
        focus_id: report.focus.id,
        focus_step: report.focus.next_step,
        global_signal: report.summary.global_signal,
        blocker_codes: report.blockers.map((item) => item.code),
        required_checks: report.checks.focus_required_checks.map((item) => ({
            id: item.id,
            state: item.state,
            ok: item.ok,
        })),
        expired_leases: report.summary.expired_leases,
        auto_actions: report.autofix.actions.map((item) => ({
            task_id: item.task_id,
            kind: item.kind,
            status: item.status,
            reason_code: item.reason_code,
        })),
        active_task_ids: report.active_tasks.map((item) => item.id),
        git_activity: {
            available: report.trends.git_activity.available,
            totals: report.trends.git_activity.totals || {
                commits: 0,
            },
        },
        board_events: {
            total: safeNumber(report.trends.board_events.total, 0),
            by_event_type: report.trends.board_events.by_event_type || {},
        },
    };
}

function buildMarkdown(report) {
    const lines = [
        '# Daily Ops Pulse',
        '',
        `- Generated at: \`${report.generated_at}\``,
        `- Profile: \`${report.profile}\``,
        `- Mode: \`${report.autofix.mode}\``,
        `- Signal: \`${report.summary.global_signal}\``,
        '',
        '## Summary',
        '',
        `- Active tasks: \`${report.summary.active_tasks_total}\``,
        `- Blockers: \`${report.summary.blockers_total}\``,
        `- Expired leases: \`${report.summary.expired_leases}\``,
        `- Focus checks ok: \`${report.summary.focus_required_checks_ok}\``,
        `- public_main_sync ok: \`${report.summary.public_main_sync_ok}\``,
        `- Month commits: \`${report.summary.month_git_commits}\``,
        '',
        '## Focus',
        '',
        `- Focus: \`${report.focus.id || 'n/a'}\``,
        `- Step: \`${report.focus.next_step || 'n/a'}\``,
        `- Summary: ${report.focus.summary || 'n/a'}`,
        `- Proof: ${report.focus.proof || 'n/a'}`,
        '',
        '## Checks',
        '',
    ];

    for (const check of report.checks.focus_required_checks) {
        lines.push(
            `- \`${check.id}\`: \`${check.state}\` (${check.message || 'sin detalle'})`
        );
    }
    lines.push(
        `- \`public_main_sync\`: \`${report.checks.public_main_sync.state || 'unknown'}\` (${report.checks.public_main_sync.failure_reason || 'sin falla'})`
    );
    lines.push(
        `- \`board_doctor\`: findings=\`${report.checks.board_doctor.findings}\`, warnings=\`${report.checks.board_doctor.warnings_count}\`, errors=\`${report.checks.board_doctor.errors_count}\``
    );
    lines.push(
        `- \`leases\`: tracked=\`${report.checks.leases.active_tracked}\`, expired=\`${report.checks.leases.active_expired}\`, missing=\`${report.checks.leases.active_required_missing}\``
    );
    lines.push('');
    lines.push('## Blockers');
    lines.push('');
    if (report.blockers.length === 0) {
        lines.push('- Ningun blocker activo.');
    } else {
        for (const blocker of report.blockers) {
            const tasks =
                blocker.task_ids.length > 0
                    ? ` [tasks: ${blocker.task_ids.join(', ')}]`
                    : '';
            const streak =
                blocker.streak_days > 0
                    ? ` [streak: ${blocker.streak_days}d]`
                    : '';
            lines.push(
                `- \`${blocker.code}\` (${blocker.source}): ${blocker.message}${tasks}${streak}`
            );
        }
    }
    lines.push('');
    lines.push('## Active Tasks');
    lines.push('');
    if (report.active_tasks.length === 0) {
        lines.push('- No hay tareas activas.');
    } else {
        for (const task of report.active_tasks) {
            const leaseLabel = task.lease.has_lease
                ? task.lease.expired
                    ? 'expired'
                    : task.heartbeat_fresh
                      ? 'fresh'
                      : 'stale'
                : 'missing';
            const blockedReason = task.blocked_reason
                ? ` :: ${task.blocked_reason}`
                : '';
            lines.push(
                `- \`${task.id}\` [${task.status}] ${task.scope || 'general'} / owner=${task.owner || 'n/a'} / lease=${leaseLabel} / age=${task.status_age_hours ?? 'n/a'}h${blockedReason}`
            );
        }
    }
    lines.push('');
    lines.push('## Autofix');
    lines.push('');
    lines.push(`- Planned: \`${report.autofix.planned_total}\``);
    lines.push(`- Applied: \`${report.autofix.applied_total}\``);
    lines.push(`- Failed: \`${report.autofix.failed_total}\``);
    if (report.autofix.actions.length === 0) {
        lines.push('- Sin acciones de autoremediacion.');
    } else {
        for (const action of report.autofix.actions) {
            const command = action.command ? ` -> ${action.command}` : '';
            const detail = action.result?.error
                ? ` (${action.result.error})`
                : '';
            lines.push(
                `- \`${action.task_id}\` ${action.kind} => \`${action.status}\`${detail}${command}`
            );
        }
    }
    lines.push('');
    lines.push('## Trends');
    lines.push('');
    lines.push(
        `- Board events this month: \`${safeNumber(report.trends.board_events.total, 0)}\``
    );
    lines.push(
        `- Git activity available: \`${report.trends.git_activity.available}\``
    );
    if (report.trends.git_activity.available) {
        lines.push(
            `- Git totals: commits=\`${safeNumber(report.trends.git_activity.totals.commits, 0)}\`, feature=\`${safeNumber(report.trends.git_activity.totals.feature, 0)}\`, fix=\`${safeNumber(report.trends.git_activity.totals.fix, 0)}\`, refactor=\`${safeNumber(report.trends.git_activity.totals.refactor, 0)}\``
        );
    }
    const blockerStreaks = Object.entries(
        report.trends.history.blocker_streaks || {}
    )
        .filter(([, value]) => safeNumber(value, 0) > 0)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (blockerStreaks.length > 0) {
        for (const [code, value] of blockerStreaks.slice(0, 5)) {
            lines.push(`- Blocker streak \`${code}\`: \`${value}\`d`);
        }
    }
    lines.push('');
    lines.push('## Recommended Actions');
    lines.push('');
    if (report.recommended_actions.length === 0) {
        lines.push('- Ninguna accion recomendada adicional.');
    } else {
        for (const action of report.recommended_actions) {
            lines.push(
                `- \`${action.code}\` (${action.priority}): ${action.message} :: \`${action.suggested_command}\``
            );
        }
    }
    lines.push('');
    return `${lines.join('\n').trimEnd()}\n`;
}

function main() {
    const wantsJson = process.argv.slice(2).includes('--json');
    const apply = process.argv.slice(2).includes('--apply');
    const profile = String(flags.profile || 'local')
        .trim()
        .toLowerCase();
    if (!['local', 'ci'].includes(profile)) {
        throw new Error(`--profile invalido (${profile}). Use local|ci`);
    }

    const now = getNow();
    const initialSnapshot = collectSnapshot({
        now,
        profile,
        apply,
        writeMetrics: false,
    });
    const autofixPlan = planAutofix(
        initialSnapshot,
        initialSnapshot.doctor_policy,
        initialSnapshot.lease_policy
    );
    const actionResults = apply
        ? executeAutofixPlan(autofixPlan)
        : autofixPlan.planned.map((item) => ({
              ...item,
              executed: false,
              ok: item.skipped ? true : null,
              status: item.skipped ? 'skipped' : 'planned',
          }));
    const finalSnapshot = collectSnapshot({
        now,
        profile,
        apply,
        writeMetrics: profile === 'ci',
    });

    const autofix = {
        mode: apply ? 'apply' : 'preview',
        enabled: apply,
        guardrails: autofixPlan.guardrails,
        planned_total: autofixPlan.planned.length,
        applied_total: actionResults.filter((item) => item.status === 'applied')
            .length,
        failed_total: actionResults.filter((item) => item.status === 'failed')
            .length,
        skipped_total: actionResults.filter((item) => item.status === 'skipped')
            .length,
        actions: actionResults,
    };

    const summary = buildSnapshotSummary(
        finalSnapshot.status,
        finalSnapshot.board_doctor,
        finalSnapshot.jobs_verify,
        finalSnapshot.active_tasks,
        finalSnapshot.blockers,
        finalSnapshot.git_activity,
        autofix
    );

    const reportBase = {
        version: 1,
        generated_at: finalSnapshot.generated_at,
        profile,
        summary,
        focus: finalSnapshot.focus,
        blockers: finalSnapshot.blockers,
        active_tasks: finalSnapshot.active_tasks,
        checks: finalSnapshot.checks,
        autofix,
        trends: {
            git_activity: finalSnapshot.git_activity,
            board_events: finalSnapshot.board_events,
            metrics: {
                current: finalSnapshot.metrics.current || null,
                delta: finalSnapshot.metrics.delta || null,
                contribution_history:
                    finalSnapshot.metrics.contribution_history || null,
                domain_health_history:
                    finalSnapshot.metrics.domain_health_history || null,
            },
            history: {},
        },
        recommended_actions: [],
    };

    const nextHistory = upsertHistory(
        loadHistory(),
        buildHistorySnapshot(reportBase)
    );
    const historyTrends = buildHistoryTrends(nextHistory);
    const report = {
        ...reportBase,
        blockers: reportBase.blockers.map((item) => ({
            ...item,
            streak_days: safeNumber(
                historyTrends.blocker_streaks[item.code],
                0
            ),
        })),
        trends: {
            ...reportBase.trends,
            history: historyTrends,
        },
    };
    report.recommended_actions = buildRecommendedActions(report, historyTrends);

    writeJson(DEFAULT_JSON_PATH, report);
    writeText(DEFAULT_MD_PATH, buildMarkdown(report));
    writeJson(HISTORY_PATH, nextHistory);

    if (flags['write-json']) {
        writeJson(String(flags['write-json']), report);
    }
    if (flags['write-md']) {
        writeText(String(flags['write-md']), buildMarkdown(report));
    }

    if (wantsJson) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
    }
    process.stdout.write(buildMarkdown(report));
}

try {
    main();
} catch (error) {
    const wantsJson = process.argv.slice(2).includes('--json');
    if (wantsJson) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    version: 1,
                    ok: false,
                    command: 'agent-daily-pulse',
                    error: String(
                        error && error.message ? error.message : error
                    ),
                },
                null,
                2
            )}\n`
        );
        process.exitCode = 1;
    } else {
        process.stderr.write(
            `agent-daily-pulse failed: ${String(
                error && error.message ? error.message : error
            )}\n`
        );
        process.exitCode = 1;
    }
}
