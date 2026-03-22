'use strict';

async function handleConflictsCommand(ctx) {
    const {
        args,
        parseFlags,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        toConflictJsonRecord,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        buildLiveFocusSummary,
        loadMetricsSnapshot,
        loadJobsSnapshot,
        collectWorkspaceTruth,
        buildWorkspaceTruthDiagnostics,
    } = ctx;
    const strict = args.includes('--strict');
    const wantsJson = args.includes('--json');
    const { flags = {} } =
        typeof parseFlags === 'function' ? parseFlags(args) : { flags: {} };
    const workspaceOptions =
        args.includes('--current-only') || Boolean(flags['current-only']) || Boolean(flags.current_only)
            ? { currentOnly: true, allWorktrees: false }
            : { allWorktrees: true, currentOnly: false };
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const analysis = analyzeConflicts(board.tasks, handoffData.handoffs);
    const metricsSnapshot =
        typeof loadMetricsSnapshot === 'function'
            ? loadMetricsSnapshot()
            : null;
    const focusData =
        typeof buildLiveFocusSummary === 'function'
            ? await buildLiveFocusSummary(board, { now: new Date() })
            : null;
    const jobsSnapshot = Array.isArray(focusData?.jobs)
        ? focusData.jobs
        : typeof loadJobsSnapshot === 'function'
          ? await loadJobsSnapshot()
          : null;

    const report = {
        version: 1,
        ok: analysis.blocking.length === 0,
        strict,
        totals: {
            pairs: analysis.all.length,
            blocking: analysis.blocking.length,
            handoff: analysis.handoffCovered.length,
        },
        conflicts: analysis.all.map(toConflictJsonRecord),
        workspace_hygiene: null,
        workspace_truth: null,
    };
    const workspaceReport =
        typeof collectWorkspaceTruth === 'function'
            ? collectWorkspaceTruth(workspaceOptions)
            : null;
    report.workspace_hygiene = workspaceReport?.workspace_hygiene || null;
    report.workspace_truth = workspaceReport?.workspace_truth || null;
    const reportWithDiagnostics = attachDiagnostics(
        report,
        [
            ...buildWarnFirstDiagnostics({
                source: 'conflicts',
                board,
                handoffData,
                conflictAnalysis: analysis,
                focusSummary: focusData?.summary || null,
                metricsSnapshot,
                jobsSnapshot,
            }),
            ...(
                typeof buildWorkspaceTruthDiagnostics === 'function'
                    ? buildWorkspaceTruthDiagnostics(workspaceReport, {
                          source: 'conflicts',
                      })
                    : []
            ),
        ]
    );
    reportWithDiagnostics.ok =
        analysis.blocking.length === 0 &&
        reportWithDiagnostics.errors_count === 0 &&
        workspaceReport?.workspace_truth?.ok !== false;

    if (wantsJson) {
        console.log(JSON.stringify(reportWithDiagnostics, null, 2));
        if (strict && !reportWithDiagnostics.ok) {
            process.exitCode = 1;
        }
        return;
    }

    if (analysis.all.length === 0) {
        console.log('Sin conflictos de archivos entre tareas activas.');
        return;
    }

    console.log(`Conflictos detectados (total pares): ${analysis.all.length}`);
    console.log(`- Blocking: ${analysis.blocking.length}`);
    console.log(`- Eximidos por handoff: ${analysis.handoffCovered.length}`);

    for (const item of analysis.all) {
        const kind = item.exempted_by_handoff ? 'HANDOFF' : 'BLOCKING';
        const overlapFiles = item.overlap_files.length
            ? item.overlap_files.join(', ')
            : '(solo wildcard ambiguo)';
        console.log(
            `- [${kind}] ${item.left.id} (${item.left.executor}) <-> ${item.right.id} (${item.right.executor}) :: ${overlapFiles}`
        );
        if (item.handoff_ids.length > 0) {
            console.log(`  handoffs: ${item.handoff_ids.join(', ')}`);
        }
        if (item.ambiguous_wildcard_overlap) {
            console.log(
                '  note: wildcard overlap ambiguo, no eximible automaticamente'
            );
        }
    }

    if (strict && !reportWithDiagnostics.ok) {
        process.exitCode = 1;
    }
}

module.exports = {
    handleConflictsCommand,
};
