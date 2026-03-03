'use strict';

function createRuntimeIntakeCommands(ctx = {}) {
    const proc = ctx.processObj || process;
    const printJson =
        ctx.printJson ||
        ((value) => console.log(JSON.stringify(value, null, 2)));
    function isValidRepositorySlug(value) {
        return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(value || ''));
    }
    function printJsonError(command, message, extra = {}) {
        const payload = {
            version: 1,
            ok: false,
            command,
            error: String(message || 'unknown_error'),
            ...extra,
        };
        printJson(payload);
        proc.exitCode = 1;
        return payload;
    }

    function parseDailyLimitFromEnv(envValue, fallback) {
        const parsed = Number.parseInt(String(envValue || ''), 10);
        if (!Number.isFinite(parsed) || parsed < 0) return fallback;
        return parsed;
    }

    function buildBudgetSnapshot(board, today, procEnv) {
        const limits = {
            codex: parseDailyLimitFromEnv(procEnv.CODEX_DAILY_LIMIT, 999),
            ci: parseDailyLimitFromEnv(procEnv.CI_DAILY_LIMIT, 999),
        };
        const usage = { codex: 0, ci: 0 };
        for (const task of board.tasks) {
            const attemptAt = String(task.last_attempt_at || '');
            const executor = String(task.executor || '').toLowerCase();
            if (!attemptAt.startsWith(today)) continue;
            if (Object.prototype.hasOwnProperty.call(usage, executor)) {
                usage[executor] +=
                    Number.parseInt(String(task.attempts || '0'), 10) || 0;
            }
        }
        const remaining = {
            codex: limits.codex - usage.codex,
            ci: limits.ci - usage.ci,
        };
        return { limits, usage, remaining };
    }

    return {
        async intake(args = []) {
            const { flags } = ctx.parseFlags(args);
            const wantsJson = args.includes('--json');
            const strict = args.includes('--strict');
            const noWrite = ctx.isFlagEnabled(flags, 'no-write', 'dry-run');
            const nowIso = new Date().toISOString();
            const board = ctx.parseBoard();
            const existingSignals = ctx.parseSignals();
            let incomingSignals;
            let source = 'local_only';
            let repository = ctx.getGitHubRepository(flags);
            if (!isValidRepositorySlug(repository)) {
                if (wantsJson) {
                    return printJsonError(
                        'intake',
                        `repository invalido: ${repository}`,
                        {
                            error_code: 'invalid_repository',
                            repository,
                        }
                    );
                }
                throw new Error(`repository invalido: ${repository}`);
            }

            try {
                const githubSignals = await ctx.collectGitHubSignals(flags);
                incomingSignals = [
                    ...(githubSignals.issues || []),
                    ...(githubSignals.workflows || []),
                ];
                source = githubSignals.source || source;
                repository = githubSignals.repository || repository;
            } catch (error) {
                incomingSignals = [];
                source = 'github_api_error';
                if (strict) throw error;
            }

            const normalizedIncomingSignals = incomingSignals.map((i) =>
                ctx.domainIntake.normalizeSignal(i, { nowIso })
            );
            const mergedSignals = ctx.domainIntake.mergeSignals(
                existingSignals.signals || [],
                normalizedIncomingSignals,
                { nowIso }
            );
            ctx.applySignalStateTransitions(
                mergedSignals,
                normalizedIncomingSignals,
                nowIso
            );
            const intakeResult = ctx.upsertTasksFromSignals(
                board,
                mergedSignals,
                {
                    nowIso,
                    owner: ctx.detectDefaultOwner('orchestrator'),
                }
            );

            if (!noWrite) {
                ctx.writeSignals({
                    version: 1,
                    updated_at: nowIso,
                    signals: mergedSignals,
                });
                ctx.writeBoardAndSync(board, {
                    silentSync: wantsJson,
                    command: 'intake',
                    actor: 'orchestrator',
                });
            }

            const staleReport = ctx.buildStaleReport(board, mergedSignals);
            const report = {
                version: 1,
                ok: !strict || staleReport.ok,
                command: 'intake',
                source,
                repository,
                no_write: noWrite,
                intake: {
                    incoming_signals: incomingSignals.length,
                    incoming_signals_normalized:
                        normalizedIncomingSignals.length,
                    total_signals: mergedSignals.length,
                    created_tasks: intakeResult.created,
                    reopened_tasks: intakeResult.reopened,
                    refreshed_tasks: intakeResult.refreshed,
                },
                stale: staleReport,
            };
            if (wantsJson) {
                printJson(report);
                if (strict && !staleReport.ok) proc.exitCode = 1;
                return report;
            }
            console.log('== Agent Intake ==');
            console.log(`Source: ${source}`);
            console.log(`Repository: ${repository}`);
            console.log(`Incoming signals: ${incomingSignals.length}`);
            console.log(`Total signals: ${mergedSignals.length}`);
            console.log(
                `Tasks: created=${intakeResult.created}, reopened=${intakeResult.reopened}, refreshed=${intakeResult.refreshed}`
            );
            if (strict && !staleReport.ok) {
                throw new Error(
                    `Intake stale gate fallido: ${staleReport.invalid_reasons.join(', ')}`
                );
            }
            return report;
        },

        score(args = []) {
            const wantsJson = args.includes('--json');
            try {
                const { flags } = ctx.parseFlags(args);
                const noWrite = ctx.isFlagEnabled(flags, 'no-write', 'dry-run');
                const nowTs = Date.now();
                const nowDate = ctx.currentDate();
                const board = ctx.parseBoard();
                let changed = 0;
                let escalated = 0;
                let overdueBoosted = 0;

                for (const task of board.tasks) {
                    const before = JSON.stringify(ctx.toTaskJson(task));
                    const normalized = ctx.domainIntake.normalizeTaskForScoring(
                        task,
                        {
                            nowTs,
                        }
                    );
                    task.priority_score = normalized.priority_score;
                    task.sla_due_at = normalized.sla_due_at;
                    task.attempts = normalized.attempts;
                    task.runtime_impact = normalized.runtime_impact;
                    task.critical_zone = normalized.critical_zone;
                    task.blocked_reason = normalized.blocked_reason;
                    if (
                        ctx.findCriticalScopeKeyword(task.scope) &&
                        String(task.executor || '').toLowerCase() !== 'codex'
                    ) {
                        task.executor = 'codex';
                    }
                    if (
                        normalized.executor === 'codex' &&
                        String(task.executor || '').toLowerCase() !== 'codex'
                    ) {
                        task.executor = 'codex';
                        task.status = ctx.isTerminalTaskStatus(task.status)
                            ? 'ready'
                            : task.status;
                        escalated += 1;
                    }
                    const dueTs = Date.parse(String(task.sla_due_at || ''));
                    if (
                        Number.isFinite(dueTs) &&
                        dueTs < nowTs &&
                        !ctx.isTerminalTaskStatus(task.status) &&
                        Number(task.priority_score || 0) < 100
                    ) {
                        task.priority_score = 100;
                        overdueBoosted += 1;
                    }
                    task.updated_at = nowDate;
                    if (JSON.stringify(ctx.toTaskJson(task)) !== before)
                        changed += 1;
                }
                if (!noWrite && changed > 0) {
                    ctx.writeBoardAndSync(board, {
                        silentSync: wantsJson,
                        command: 'score',
                        actor: 'orchestrator',
                    });
                }
                const report = {
                    version: 1,
                    ok: true,
                    command: 'score',
                    no_write: noWrite,
                    changed_tasks: changed,
                    escalated_to_codex: escalated,
                    overdue_boosted: overdueBoosted,
                };
                if (wantsJson) {
                    printJson(report);
                    return report;
                }
                console.log('== Agent Score ==');
                console.log(`Tasks changed: ${changed}`);
                console.log(`Escalated to codex: ${escalated}`);
                console.log(`Overdue boosted: ${overdueBoosted}`);
                return report;
            } catch (error) {
                if (wantsJson) {
                    return printJsonError('score', error.message, {
                        error_code: 'score_failed',
                    });
                }
                throw error;
            }
        },

        stale(args = []) {
            const wantsJson = args.includes('--json');
            const strict = args.includes('--strict');
            const board = ctx.parseBoard();
            const signals = ctx.parseSignals();
            const report = ctx.buildStaleReport(board, signals.signals || []);
            const result = {
                version: 1,
                ok: report.ok,
                command: 'stale',
                ...report,
            };
            if (wantsJson) {
                printJson(result);
                if (strict && !report.ok) proc.exitCode = 1;
                return result;
            }
            console.log('== Agent Stale Check ==');
            console.log(
                `Signals activos: ${report.counts.active_signals} (critical=${report.counts.critical_active_signals})`
            );
            console.log(
                `Tasks ready/in_progress: ${report.counts.ready_or_in_progress_tasks}`
            );
            if (strict && !report.ok) {
                throw new Error(
                    `stale gate fallido: ${report.invalid_reasons.join(', ')}`
                );
            }
            return result;
        },

        budget(args = []) {
            const wantsJson = args.includes('--json');
            const { flags } = ctx.parseFlags(args);
            const strict = args.includes('--strict');
            const agentFilter = String(flags.agent || 'all')
                .trim()
                .toLowerCase();
            if (['jules', 'kimi', 'claude'].includes(agentFilter)) {
                if (wantsJson) {
                    return printJsonError(
                        'budget',
                        `budget bloqueado: executor retirado (${agentFilter})`,
                        { error_code: 'executor_retired' }
                    );
                }
                throw new Error(
                    `budget bloqueado: executor retirado (${agentFilter})`
                );
            }
            if (
                agentFilter !== 'all' &&
                !['codex', 'ci'].includes(agentFilter)
            ) {
                if (wantsJson) {
                    return printJsonError(
                        'budget',
                        `budget requiere --agent codex|ci|all`,
                        { error_code: 'invalid_agent' }
                    );
                }
                throw new Error('budget requiere --agent codex|ci|all');
            }
            const today = ctx.currentDate();
            const board = ctx.parseBoard();
            const { limits, usage, remaining } = buildBudgetSnapshot(
                board,
                today,
                proc.env
            );
            const agents = ['codex', 'ci'].filter(
                (a) => agentFilter === 'all' || a === agentFilter
            );
            const exceeded = agents.filter((a) => remaining[a] <= 0);
            const report = {
                version: 1,
                ok: exceeded.length === 0,
                command: 'budget',
                date: today,
                limits,
                usage,
                remaining,
                exceeded,
            };
            if (wantsJson) {
                printJson(report);
                if (strict && !report.ok) proc.exitCode = 1;
                return report;
            }
            console.log('== Agent Budget ==');
            for (const agent of agents) {
                console.log(
                    `- ${agent}: used=${usage[agent]} limit=${limits[agent]} remaining=${remaining[agent]}`
                );
            }
            if (strict && !report.ok) {
                throw new Error(`budget excedido: ${exceeded.join(', ')}`);
            }
            return report;
        },

        dispatch(args = []) {
            const wantsJson = args.includes('--json');
            const { flags } = ctx.parseFlags(args);
            const agent = String(flags.agent || '')
                .trim()
                .toLowerCase();
            if (['jules', 'kimi', 'claude'].includes(agent)) {
                if (wantsJson) {
                    return printJsonError(
                        'dispatch',
                        `dispatch bloqueado: executor retirado (${agent})`,
                        { error_code: 'executor_retired' }
                    );
                }
                throw new Error(
                    `dispatch bloqueado: executor retirado (${agent})`
                );
            }
            if (!['codex', 'ci'].includes(agent)) {
                if (wantsJson) {
                    return printJsonError(
                        'dispatch',
                        'dispatch requiere --agent codex|ci',
                        { error_code: 'invalid_agent' }
                    );
                }
                throw new Error('dispatch requiere --agent codex|ci');
            }
            const board = ctx.parseBoard();
            const nowIso = new Date().toISOString();
            const today = ctx.currentDate();
            const nowDate = ctx.currentDate();
            const defaultPerRun = 2;
            const envPerRun =
                agent === 'ci' ? proc.env.CI_MAX_DISPATCH_PER_RUN : null;
            const perRunLimit = Number.parseInt(
                String(envPerRun || defaultPerRun),
                10
            );
            const { limits, usage, remaining } = buildBudgetSnapshot(
                board,
                today,
                proc.env
            );
            const budgetRemaining = Number(remaining[agent] || 0);
            const effectivePerRunLimit = Math.max(
                0,
                Math.min(perRunLimit, budgetRemaining)
            );
            const runnable = board.tasks
                .filter(
                    (t) =>
                        String(t.executor || '').toLowerCase() === agent &&
                        String(t.status || '') === 'ready'
                )
                .sort(
                    (a, b) =>
                        Number(b.priority_score || 0) -
                        Number(a.priority_score || 0)
                )
                .slice(0, effectivePerRunLimit);
            const dispatched = [];
            for (const task of runnable) {
                task.status = 'in_progress';
                task.updated_at = nowDate;
                task.last_attempt_at = nowIso;
                task.attempts =
                    (Number.parseInt(String(task.attempts || '0'), 10) || 0) +
                    1;
                dispatched.push(task.id);
            }
            if (dispatched.length > 0) {
                ctx.writeBoardAndSync(board, {
                    silentSync: wantsJson,
                    command: 'dispatch',
                    actor: agent,
                });
            }
            const dispatchedTasks = board.tasks.filter((t) =>
                dispatched.includes(String(t.id || ''))
            );
            const wipDiagnostics =
                typeof ctx.buildBoardWipLimitDiagnostics === 'function'
                    ? ctx.buildBoardWipLimitDiagnostics(board, {
                          source: 'dispatch',
                          taskIds: dispatched,
                          executors: [agent],
                          scopes: dispatchedTasks.map((t) => t.scope),
                      })
                    : [];
            const report = {
                version: 1,
                ok: true,
                command: 'dispatch',
                agent,
                limit_per_run: perRunLimit,
                budget_limit_daily: limits[agent],
                budget_used_today: usage[agent],
                budget_remaining_before_dispatch: budgetRemaining,
                dispatched,
            };
            if (wantsJson) {
                const payload =
                    typeof ctx.attachDiagnostics === 'function'
                        ? ctx.attachDiagnostics(report, wipDiagnostics)
                        : report;
                printJson(payload);
                return payload;
            }
            console.log(`== Agent Dispatch (${agent}) ==`);
            console.log(`Dispatched: ${dispatched.join(', ') || 'none'}`);
            for (const diag of wipDiagnostics) {
                console.log(`WARN [${diag.code}] ${diag.message}`);
            }
            return report;
        },

        async reconcile(args = []) {
            const { flags } = ctx.parseFlags(args);
            const wantsJson = args.includes('--json');
            const strict = args.includes('--strict');
            const nowDate = ctx.currentDate();
            const board = ctx.parseBoard();
            let prEvidenceApplied = 0;
            let pulls = [];
            try {
                const token = ctx.getGitHubToken(flags);
                const repo = ctx.getGitHubRepository(flags);
                if (token) {
                    const prNumber = flags['pr-number']
                        ? Number(flags['pr-number'])
                        : null;
                    const runsPayload = await ctx.fetchGitHubJson(
                        `/repos/${repo}/pulls?state=closed&per_page=30`,
                        token
                    );
                    const merged = (
                        Array.isArray(runsPayload) ? runsPayload : []
                    ).filter(
                        (pr) =>
                            pr.merged_at &&
                            (!prNumber || pr.number === prNumber)
                    );
                    for (const pr of merged) {
                        const taskIds = [
                            ...String(pr.body || '').matchAll(
                                /\b(AG-\d{3})\b/g
                            ),
                        ].map((m) => m[1]);
                        if (taskIds.length > 0) {
                            pulls.push({
                                number: pr.number,
                                task_ids: taskIds,
                            });
                        }
                    }
                }
            } catch (error) {
                if (strict) throw error;
            }
            for (const pull of pulls) {
                for (const taskId of pull.task_ids) {
                    const task = board.tasks.find(
                        (t) => String(t.id || '') === String(taskId)
                    );
                    if (!task) continue;
                    task.status = 'done';
                    task.updated_at = nowDate;
                    task.evidence_ref = `pr#${pull.number}`;
                    if (!String(task.acceptance_ref || '').trim()) {
                        task.acceptance_ref = task.evidence_ref;
                    }
                    prEvidenceApplied += 1;
                }
            }
            const doneWithoutEvidence = board.tasks.filter(
                (t) =>
                    String(t.status || '') === 'done' &&
                    !String(t.evidence_ref || t.acceptance_ref || '').trim()
            );
            if (strict && doneWithoutEvidence.length > 0) {
                if (wantsJson) {
                    return printJsonError(
                        'reconcile',
                        `reconcile: tareas done sin evidencia_ref (${doneWithoutEvidence.map((t) => t.id).join(', ')})`,
                        {
                            pull_request_evidence_applied: prEvidenceApplied,
                            merged_pull_requests_scanned: pulls.length,
                            done_without_evidence: doneWithoutEvidence.map(
                                (t) => t.id
                            ),
                            error_code: 'done_without_evidence',
                        }
                    );
                }
                throw new Error(
                    `reconcile: tareas done sin evidencia_ref (${doneWithoutEvidence.map((t) => t.id).join(', ')})`
                );
            }
            ctx.writeBoardAndSync(board, {
                silentSync: wantsJson,
                command: 'reconcile',
                actor: 'orchestrator',
            });
            const report = {
                version: 1,
                ok: doneWithoutEvidence.length === 0,
                command: 'reconcile',
                pull_request_evidence_applied: prEvidenceApplied,
                merged_pull_requests_scanned: pulls.length,
                done_without_evidence: doneWithoutEvidence.map((t) => t.id),
            };
            if (wantsJson) {
                printJson(report);
                if (strict && !report.ok) proc.exitCode = 1;
                return report;
            }
            console.log('== Agent Reconcile ==');
            console.log(`PR evidence applied: ${prEvidenceApplied}`);
            if (!report.ok) {
                console.log(
                    `WARN: done sin evidencia -> ${report.done_without_evidence.join(', ')}`
                );
            }
            return report;
        },
    };
}

module.exports = {
    createRuntimeIntakeCommands,
};
