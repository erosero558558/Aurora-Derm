'use strict';

function parseExpectedRevisionFromFlags(
    flags = {},
    parseExpectedBoardRevisionFlag,
    options = {}
) {
    const { required = false, commandLabel = 'comando mutante' } = options;
    if (typeof parseExpectedBoardRevisionFlag !== 'function') return null;
    const parsed = parseExpectedBoardRevisionFlag(flags);
    if (parsed instanceof Error) throw parsed;
    if (required && (parsed === null || parsed === undefined)) {
        const error = new Error(
            `${commandLabel} requiere --expect-rev para evitar carreras de AGENT_BOARD.yaml`
        );
        error.code = 'expect_rev_required';
        error.error_code = 'expect_rev_required';
        throw error;
    }
    return parsed;
}

function parseCsvList(value) {
    return String(value || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function readFlag(flags = {}, ...keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(flags, key)) continue;
        return String(flags[key] || '').trim();
    }
    return '';
}

function normalizeArrayFlag(flags = {}, ...keys) {
    for (const key of keys) {
        if (!Object.prototype.hasOwnProperty.call(flags, key)) continue;
        return parseCsvList(flags[key]);
    }
    return [];
}

function strategyIsActive(board) {
    return (
        String(board?.strategy?.active?.status || '')
            .trim()
            .toLowerCase() === 'active'
    );
}

function hasActiveTasks(board) {
    return Array.isArray(board?.tasks)
        ? board.tasks.some((task) =>
              ['ready', 'in_progress', 'review', 'blocked'].includes(
                  String(task?.status || '')
                      .trim()
                      .toLowerCase()
              )
          )
        : false;
}

function strategyDeclaresFocusContract(board) {
    const strategy = board?.strategy?.active;
    if (!strategy || typeof strategy !== 'object') {
        return false;
    }

    const scalarKeys = [
        'focus_id',
        'focus_title',
        'focus_summary',
        'focus_status',
        'focus_proof',
        'focus_next_step',
        'focus_owner',
        'focus_review_due_at',
        'focus_evidence_ref',
        'focus_max_active_slices',
    ];
    const arrayKeys = [
        'focus_steps',
        'focus_required_checks',
        'focus_non_goals',
    ];

    return (
        scalarKeys.some((key) => String(strategy[key] || '').trim() !== '') ||
        arrayKeys.some(
            (key) => Array.isArray(strategy[key]) && strategy[key].length > 0
        )
    );
}

async function resolveLiveFocusSummary(ctx, board) {
    if (typeof ctx.buildLiveFocusSummary === 'function') {
        return ctx.buildLiveFocusSummary(board, { now: new Date() });
    }

    const decisionsData =
        typeof ctx.parseDecisions === 'function'
            ? ctx.parseDecisions()
            : { decisions: [] };
    const jobs =
        typeof ctx.loadJobsSnapshot === 'function'
            ? await ctx.loadJobsSnapshot()
            : [];
    const summary =
        typeof ctx.buildFocusSummary === 'function'
            ? ctx.buildFocusSummary(board, {
                  decisionsData,
                  jobsSnapshot: jobs,
                  now: new Date(),
              })
            : null;

    return {
        decisionsData,
        jobs,
        runtimeVerification: null,
        summary,
    };
}

function applyFocusOverrides(strategy, flags = {}) {
    if (!strategy || typeof strategy !== 'object') return strategy;
    const focusId = readFlag(flags, 'focus-id', 'focus_id');
    const focusTitle = readFlag(flags, 'focus-title', 'focus_title');
    const focusSummary = readFlag(flags, 'focus-summary', 'focus_summary');
    const focusStatus = readFlag(flags, 'focus-status', 'focus_status');
    const focusProof = readFlag(flags, 'focus-proof', 'focus_proof');
    const nextStep = readFlag(
        flags,
        'next-step',
        'focus-next-step',
        'focus_next_step'
    );
    const focusOwner = readFlag(flags, 'focus-owner', 'focus_owner', 'owner');
    const focusReviewDueAt = readFlag(
        flags,
        'review-due-at',
        'focus-review-due-at',
        'focus_review_due_at'
    );
    const focusEvidenceRef = readFlag(
        flags,
        'evidence',
        'focus-evidence-ref',
        'focus_evidence_ref'
    );
    const maxActiveSlices = readFlag(
        flags,
        'max-active-slices',
        'focus-max-active-slices',
        'focus_max_active_slices'
    );
    const steps = normalizeArrayFlag(flags, 'focus-steps', 'focus_steps');
    const requiredChecks = normalizeArrayFlag(
        flags,
        'required-checks',
        'focus-required-checks',
        'focus_required_checks'
    );
    const nonGoals = normalizeArrayFlag(
        flags,
        'non-goals',
        'focus-non-goals',
        'focus_non_goals'
    );

    if (focusId) strategy.focus_id = focusId;
    if (focusTitle) strategy.focus_title = focusTitle;
    if (focusSummary) strategy.focus_summary = focusSummary;
    if (focusStatus) strategy.focus_status = focusStatus;
    if (focusProof) strategy.focus_proof = focusProof;
    if (steps.length > 0) strategy.focus_steps = steps;
    if (nextStep) strategy.focus_next_step = nextStep;
    if (requiredChecks.length > 0) {
        strategy.focus_required_checks = requiredChecks;
    }
    if (nonGoals.length > 0) strategy.focus_non_goals = nonGoals;
    if (focusOwner) strategy.focus_owner = focusOwner;
    if (focusReviewDueAt) strategy.focus_review_due_at = focusReviewDueAt;
    if (focusEvidenceRef) strategy.focus_evidence_ref = focusEvidenceRef;
    if (maxActiveSlices) {
        strategy.focus_max_active_slices = maxActiveSlices;
    }
    return strategy;
}

function getStructuralFocusErrors(board, summary, options = {}) {
    const { enforceRequiredChecks = false } = options;
    const errors = Array.isArray(summary?.blocking_errors)
        ? [...summary.blocking_errors]
        : [];
    if (
        strategyIsActive(board) &&
        hasActiveTasks(board) &&
        !summary?.configured &&
        strategyDeclaresFocusContract(board)
    ) {
        errors.push('strategy_without_focus');
    }
    if (
        strategyIsActive(board) &&
        summary?.configured &&
        !String(summary.configured.next_step || '').trim()
    ) {
        errors.push('missing_next_step');
    }
    if (
        String(summary?.configured?.status || '')
            .trim()
            .toLowerCase() === 'closed'
    ) {
        if (!String(summary?.configured?.evidence_ref || '').trim()) {
            errors.push('closed_focus_without_evidence');
        }
        if (
            Array.isArray(summary?.required_checks) &&
            summary.required_checks.some((item) => item.ok !== true)
        ) {
            errors.push('closed_focus_without_required_checks');
        }
    }
    if (
        enforceRequiredChecks &&
        Array.isArray(summary?.required_checks) &&
        summary.required_checks.some((item) => item.ok !== true)
    ) {
        errors.push('required_check_unverified');
    }
    return Array.from(new Set(errors));
}

function printFocusStatusText(summary = {}) {
    if (!summary?.configured) {
        console.log('Sin foco configurado.');
        return;
    }
    console.log(
        `Focus: ${summary.configured.id || 'sin id'} (${summary.configured.title || 'sin titulo'})`
    );
    console.log(
        `- status=${summary.configured.status || 'n/a'} next_step=${summary.configured.next_step || 'n/a'} aligned=${summary.aligned_tasks || 0}/${summary.active_tasks_total || 0}`
    );
    console.log(
        `- slices=${Array.isArray(summary.active_slices) && summary.active_slices.length > 0 ? summary.active_slices.join(', ') : 'none'}`
    );
    console.log(
        `- decisions=open:${summary.decisions?.open ?? 0} overdue:${summary.decisions?.overdue ?? 0}`
    );
    console.log(
        `- required_checks=${Array.isArray(summary.required_checks) && summary.required_checks.length > 0 ? summary.required_checks.map((item) => `${item.id}:${item.state}`).join(', ') : 'none'}`
    );
}

async function handleFocusCommand(ctx) {
    const {
        args = [],
        parseFlags,
        parseBoard,
        buildFocusSummary,
        buildLiveFocusSummary,
        parseDecisions,
        loadJobsSnapshot,
        verifyOpenClawRuntime,
        buildFocusSeed,
        normalizeStrategyActive,
        validateStrategyConfiguration,
        currentDate,
        detectDefaultOwner,
        applyBoardSync,
        writeBoardAndSync,
        parseExpectedBoardRevisionFlag,
        printJson = (value) => console.log(JSON.stringify(value, null, 2)),
    } = ctx;
    const wantsJson = args.includes('--json');
    const subcommand = String(args[0] || 'status')
        .trim()
        .toLowerCase();
    const { flags } = parseFlags(args.slice(1));

    if (
        !['status', 'set-active', 'advance', 'close', 'check'].includes(
            subcommand
        )
    ) {
        throw new Error(
            'Uso: node agent-orchestrator.js focus <status|set-active|advance|close|check> [--expect-rev N] [--enforce-required-checks] [--json]'
        );
    }

    const board = parseBoard();
    const baseData = await resolveLiveFocusSummary(
        {
            buildLiveFocusSummary,
            buildFocusSummary,
            parseDecisions,
            loadJobsSnapshot,
            verifyOpenClawRuntime,
        },
        board
    );
    const summary = baseData.summary;

    if (subcommand === 'status') {
        const payload = {
            version: 1,
            ok: true,
            command: 'focus',
            action: 'status',
            focus: summary,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        printFocusStatusText(summary);
        return payload;
    }

    if (subcommand === 'check') {
        const enforceRequiredChecks = Boolean(
            flags['enforce-required-checks'] || flags.enforce_required_checks
        );
        const errors = getStructuralFocusErrors(board, summary, {
            enforceRequiredChecks,
        });
        const payload = {
            version: 1,
            ok: errors.length === 0,
            command: 'focus',
            action: 'check',
            focus: summary,
            enforce_required_checks: enforceRequiredChecks,
            structural_errors: errors,
            warnings: Array.isArray(summary?.warnings) ? summary.warnings : [],
        };
        if (wantsJson) {
            printJson(payload);
            if (!payload.ok) process.exitCode = 1;
            return payload;
        }
        printFocusStatusText(summary);
        if (!payload.ok) {
            throw new Error(
                `focus check fallo: ${payload.structural_errors.join(', ')}`
            );
        }
        return payload;
    }

    const strategy = board?.strategy?.active;
    if (!strategy || typeof strategy !== 'object' || !strategyIsActive(board)) {
        throw new Error(
            'focus command requiere strategy.active.status=active en AGENT_BOARD.yaml'
        );
    }

    if (subcommand === 'set-active') {
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'focus set-active' }
        );
        const owner =
            readFlag(flags, 'owner', 'focus-owner', 'focus_owner') ||
            detectDefaultOwner() ||
            String(strategy.owner || '').trim() ||
            'ernesto';
        const seedName = readFlag(flags, 'seed');
        const nextStrategy = normalizeStrategyActive({
            ...strategy,
            ...buildFocusSeed(
                {
                    ...strategy,
                    owner,
                },
                { owner, seed: seedName || '' }
            ),
        });
        applyFocusOverrides(nextStrategy, flags);
        board.strategy = { active: nextStrategy };
        const validationErrors = validateStrategyConfiguration(board, {});
        if (validationErrors.length > 0) {
            throw new Error(
                `focus set-active invalido: ${validationErrors.join(' | ')}`
            );
        }
        const syncResult =
            typeof applyBoardSync === 'function'
                ? applyBoardSync(board, {
                      nowIso: new Date().toISOString(),
                      currentDate,
                  })
                : null;
        if (syncResult?.write_blocked) {
            throw new Error(
                `focus set-active bloqueado por board sync: ${syncResult.write_blocking_findings
                    .map((item) => `${item.task_id}:${item.code}`)
                    .join(', ')}`
            );
        }
        const postSummary = (
            await resolveLiveFocusSummary(
                {
                    buildLiveFocusSummary,
                    buildFocusSummary,
                    parseDecisions,
                    loadJobsSnapshot,
                    verifyOpenClawRuntime,
                },
                board
            )
        ).summary;
        const structuralErrors = getStructuralFocusErrors(board, postSummary);
        if (structuralErrors.length > 0) {
            throw new Error(
                `focus set-active bloqueado: ${structuralErrors.join(', ')}`
            );
        }
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'focus set-active',
            actor: owner,
            expectRevision,
        });
        const payload = {
            version: 1,
            ok: true,
            command: 'focus',
            action: 'set-active',
            focus: postSummary,
            board_sync: syncResult
                ? {
                      applied_total: syncResult.applied_total,
                      applied_task_ids: syncResult.applied_task_ids,
                      blocking_findings: syncResult.blocking_findings,
                      warnings: syncResult.warnings,
                      check_ok_after_apply: syncResult.check_ok_after_apply,
                  }
                : null,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(
            `Focus set-active OK: ${postSummary?.configured?.id || 'sin id'}`
        );
        return payload;
    }

    if (subcommand === 'advance') {
        const expectRevision = parseExpectedRevisionFromFlags(
            flags,
            parseExpectedBoardRevisionFlag,
            { required: true, commandLabel: 'focus advance' }
        );
        const nextStep = readFlag(
            flags,
            'next-step',
            'focus-next-step',
            'focus_next_step'
        );
        if (!nextStep) {
            throw new Error('focus advance requiere --next-step');
        }
        const steps = Array.isArray(strategy.focus_steps)
            ? strategy.focus_steps
            : [];
        if (steps.length > 0 && !steps.includes(nextStep)) {
            throw new Error(
                `focus advance requiere next_step dentro de focus_steps (${nextStep})`
            );
        }
        board.strategy.active = normalizeStrategyActive({
            ...strategy,
            focus_next_step: nextStep,
            focus_status: 'active',
        });
        const validationErrors = validateStrategyConfiguration(board, {});
        if (validationErrors.length > 0) {
            throw new Error(
                `focus advance invalido: ${validationErrors.join(' | ')}`
            );
        }
        const syncResult =
            typeof applyBoardSync === 'function'
                ? applyBoardSync(board, {
                      nowIso: new Date().toISOString(),
                      currentDate,
                  })
                : null;
        if (syncResult?.write_blocked) {
            throw new Error(
                `focus advance bloqueado por board sync: ${syncResult.write_blocking_findings
                    .map((item) => `${item.task_id}:${item.code}`)
                    .join(', ')}`
            );
        }
        const postSummary = (
            await resolveLiveFocusSummary(
                {
                    buildLiveFocusSummary,
                    buildFocusSummary,
                    parseDecisions,
                    loadJobsSnapshot,
                    verifyOpenClawRuntime,
                },
                board
            )
        ).summary;
        const structuralErrors = getStructuralFocusErrors(board, postSummary);
        if (structuralErrors.length > 0) {
            throw new Error(
                `focus advance bloqueado: ${structuralErrors.join(', ')}`
            );
        }
        writeBoardAndSync(board, {
            silentSync: wantsJson,
            command: 'focus advance',
            actor:
                readFlag(flags, 'owner') ||
                String(strategy.focus_owner || strategy.owner || '').trim(),
            expectRevision,
        });
        const payload = {
            version: 1,
            ok: true,
            command: 'focus',
            action: 'advance',
            focus: postSummary,
            board_sync: syncResult
                ? {
                      applied_total: syncResult.applied_total,
                      applied_task_ids: syncResult.applied_task_ids,
                      blocking_findings: syncResult.blocking_findings,
                      warnings: syncResult.warnings,
                      check_ok_after_apply: syncResult.check_ok_after_apply,
                  }
                : null,
        };
        if (wantsJson) {
            printJson(payload);
            return payload;
        }
        console.log(`Focus advance OK: next_step=${nextStep}`);
        return payload;
    }

    const expectRevision = parseExpectedRevisionFromFlags(
        flags,
        parseExpectedBoardRevisionFlag,
        { required: true, commandLabel: 'focus close' }
    );
    const evidence = readFlag(flags, 'evidence', 'focus-evidence-ref');
    if (!evidence) {
        throw new Error('focus close requiere --evidence <path>');
    }
    const activeSummary = summary;
    if (!activeSummary?.configured) {
        throw new Error('focus close requiere foco configurado');
    }
    if (activeSummary.active_tasks_total > 0) {
        throw new Error(
            `focus close bloqueado: hay ${activeSummary.active_tasks_total} tarea(s) activa(s)`
        );
    }
    const requiredChecks = Array.isArray(activeSummary.required_checks)
        ? activeSummary.required_checks
        : [];
    if (
        requiredChecks.length === 0 ||
        requiredChecks.some((item) => !item.ok)
    ) {
        throw new Error('focus close requiere focus_required_checks en verde');
    }
    board.strategy.active = normalizeStrategyActive({
        ...strategy,
        focus_status: 'closed',
        focus_evidence_ref: evidence,
    });
    const postSummary = (
        await resolveLiveFocusSummary(
            {
                buildLiveFocusSummary,
                buildFocusSummary,
                parseDecisions,
                loadJobsSnapshot,
                verifyOpenClawRuntime,
            },
            board
        )
    ).summary;
    const structuralErrors = getStructuralFocusErrors(board, postSummary);
    if (structuralErrors.length > 0) {
        throw new Error(
            `focus close bloqueado: ${structuralErrors.join(', ')}`
        );
    }
    writeBoardAndSync(board, {
        silentSync: wantsJson,
        command: 'focus close',
        actor:
            readFlag(flags, 'owner') ||
            String(strategy.focus_owner || strategy.owner || '').trim(),
        expectRevision,
    });
    const payload = {
        version: 1,
        ok: true,
        command: 'focus',
        action: 'close',
        focus: postSummary,
        close_reason: readFlag(flags, 'reason', 'close-reason') || 'manual',
    };
    if (wantsJson) {
        printJson(payload);
        return payload;
    }
    console.log(
        `Focus close OK: ${postSummary?.configured?.id || 'sin id'} evidence=${evidence}`
    );
    return payload;
}

module.exports = {
    handleFocusCommand,
};
