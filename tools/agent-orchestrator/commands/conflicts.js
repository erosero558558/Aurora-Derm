'use strict';

async function handleConflictsCommand(ctx) {
    const {
        args,
        parseBoard,
        parseHandoffs,
        analyzeConflicts,
        toConflictJsonRecord,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        loadMetricsSnapshot,
        loadJobsSnapshot,
    } = ctx;
    const strict = args.includes('--strict');
    const wantsJson = args.includes('--json');
    const board = parseBoard();
    const handoffData = parseHandoffs();
    const analysis = analyzeConflicts(board.tasks, handoffData.handoffs);
    const metricsSnapshot =
        typeof loadMetricsSnapshot === 'function'
            ? loadMetricsSnapshot()
            : null;
    const jobsSnapshot =
        typeof loadJobsSnapshot === 'function'
            ? await loadJobsSnapshot()
            : null;

    const report = {
        version: 1,
        strict,
        totals: {
            pairs: analysis.all.length,
            blocking: analysis.blocking.length,
            handoff: analysis.handoffCovered.length,
        },
        conflicts: analysis.all.map(toConflictJsonRecord),
    };
    const reportWithDiagnostics = attachDiagnostics(
        report,
        buildWarnFirstDiagnostics({
            source: 'conflicts',
            board,
            handoffData,
            conflictAnalysis: analysis,
            metricsSnapshot,
            jobsSnapshot,
        })
    );

    if (wantsJson) {
        console.log(JSON.stringify(reportWithDiagnostics, null, 2));
        if (strict && analysis.blocking.length > 0) {
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

    if (strict && analysis.blocking.length > 0) {
        process.exitCode = 1;
    }
}

module.exports = {
    handleConflictsCommand,
};
