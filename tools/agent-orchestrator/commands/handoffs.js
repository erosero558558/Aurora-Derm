'use strict';

function handleHandoffsCommand(ctx) {
    const {
        args,
        parseHandoffs,
        isExpired,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
        getHandoffLintErrors,
        parseFlags,
        parseBoard,
        parseCsvList,
        ensureTask,
        ACTIVE_STATUSES,
        analyzeFileOverlap,
        normalizePathToken,
        nextHandoffId,
        isoNow,
        plusHoursIso,
        HANDOFFS_PATH,
        serializeHandoffs,
        writeFileSync,
    } = ctx;
    const firstArg = String(args[0] || '');
    const subcommand =
        !firstArg || firstArg.startsWith('--') ? 'status' : firstArg;
    const wantsJson = args.includes('--json');
    const handoffData = parseHandoffs();

    if (subcommand === 'status') {
        const total = handoffData.handoffs.length;
        const active = handoffData.handoffs.filter(
            (item) => String(item.status) === 'active'
        );
        const closed = handoffData.handoffs.filter(
            (item) => String(item.status) === 'closed'
        );
        const expiredActive = active.filter((item) =>
            isExpired(item.expires_at)
        );
        const report = {
            version: 1,
            summary: {
                total,
                active: active.length,
                closed: closed.length,
                active_expired: expiredActive.length,
            },
            handoffs: handoffData.handoffs,
        };
        const reportWithDiagnostics = attachDiagnostics(
            report,
            buildWarnFirstDiagnostics({
                source: 'handoffs.status',
                handoffData,
            })
        );
        if (wantsJson) {
            console.log(JSON.stringify(reportWithDiagnostics, null, 2));
            return;
        }
        console.log('== Agent Handoffs ==');
        console.log(`Total: ${total}`);
        console.log(`Active: ${active.length}`);
        console.log(`Closed: ${closed.length}`);
        console.log(`Active expirados: ${expiredActive.length}`);
        return;
    }

    if (subcommand === 'lint') {
        const errors = getHandoffLintErrors();
        const report = {
            version: 1,
            ok: errors.length === 0,
            error_count: errors.length,
            errors,
        };
        const reportWithDiagnostics = attachDiagnostics(
            report,
            buildWarnFirstDiagnostics({
                source: 'handoffs.lint',
                handoffData,
            })
        );
        if (wantsJson) {
            console.log(JSON.stringify(reportWithDiagnostics, null, 2));
            if (errors.length > 0) {
                process.exitCode = 1;
            }
            return;
        }
        if (errors.length === 0) {
            console.log('OK: handoffs validos.');
            return;
        }
        console.log(`Errores de handoff: ${errors.length}`);
        for (const error of errors) console.log(`- ${error}`);
        process.exitCode = 1;
        return;
    }

    if (subcommand === 'create') {
        const { flags } = parseFlags(args.slice(1));
        const board = parseBoard();
        const handoffs = parseHandoffs();

        const fromTaskId = String(flags.from || flags.from_task || '').trim();
        const toTaskId = String(flags.to || flags.to_task || '').trim();
        const reason = String(flags.reason || '').trim();
        const approvedBy = String(
            flags['approved-by'] || flags.approved_by || ''
        ).trim();
        const files = parseCsvList(flags.files || '');
        const ttlHours = Number(flags['ttl-hours'] || flags.ttl_hours || 24);

        if (!fromTaskId || !toTaskId) {
            throw new Error(
                'Uso: node agent-orchestrator.js handoffs create --from AG-001 --to CDX-001 --files path1,path2 --reason motivo --approved-by ernesto [--ttl-hours 24]'
            );
        }
        if (!reason) {
            throw new Error('handoffs create requiere --reason');
        }
        if (!approvedBy) {
            throw new Error('handoffs create requiere --approved-by');
        }
        if (files.length === 0) {
            throw new Error('handoffs create requiere --files con lista CSV');
        }
        if (!Number.isFinite(ttlHours) || ttlHours <= 0 || ttlHours > 48) {
            throw new Error('--ttl-hours debe estar en rango 1..48');
        }

        const fromTask = ensureTask(board, fromTaskId);
        const toTask = ensureTask(board, toTaskId);
        if (
            !ACTIVE_STATUSES.has(fromTask.status) ||
            !ACTIVE_STATUSES.has(toTask.status)
        ) {
            throw new Error(
                `Ambas tareas deben estar activas (from=${fromTask.status}, to=${toTask.status})`
            );
        }

        const overlap = analyzeFileOverlap(fromTask.files, toTask.files);
        if (!overlap.anyOverlap) {
            throw new Error(
                `No hay solape de archivos entre ${fromTaskId} y ${toTaskId}`
            );
        }
        if (overlap.ambiguousWildcardOverlap) {
            throw new Error(
                'No se puede crear handoff automatico con overlap ambiguo por wildcards; usa files concretos'
            );
        }
        const overlapSet = new Set(overlap.overlapFiles);
        const normalizedFiles = files.map(normalizePathToken);
        for (let i = 0; i < normalizedFiles.length; i++) {
            if (!overlapSet.has(normalizedFiles[i])) {
                throw new Error(
                    `File fuera del solape real: ${files[i]} (solape: ${overlap.overlapFiles.join(', ') || 'ninguno'})`
                );
            }
        }

        const handoff = {
            id: nextHandoffId(handoffs.handoffs),
            status: 'active',
            from_task: fromTaskId,
            to_task: toTaskId,
            reason,
            files,
            approved_by: approvedBy,
            created_at: isoNow(),
            expires_at: plusHoursIso(ttlHours),
        };

        handoffs.handoffs.push(handoff);
        writeFileSync(HANDOFFS_PATH, serializeHandoffs(handoffs), 'utf8');

        const errors = getHandoffLintErrors();
        if (errors.length > 0) {
            throw new Error(
                `Handoff creado pero invalido:\n- ${errors.join('\n- ')}`
            );
        }

        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        action: 'create',
                        handoff,
                    },
                    null,
                    2
                )
            );
            return;
        }

        console.log(`Handoff creado: ${handoff.id}`);
        console.log(
            `${handoff.from_task} -> ${handoff.to_task} :: ${handoff.files.join(', ')} (expira ${handoff.expires_at})`
        );
        return;
    }

    if (subcommand === 'close') {
        const { positionals, flags } = parseFlags(args.slice(1));
        const handoffId = String(positionals[0] || flags.id || '').trim();
        const closeReason = String(flags.reason || 'closed_manual').trim();
        if (!handoffId) {
            throw new Error(
                'Uso: node agent-orchestrator.js handoffs close <HO-001> [--reason motivo]'
            );
        }
        const handoffs = parseHandoffs();
        const handoff = handoffs.handoffs.find(
            (item) => String(item.id) === handoffId
        );
        if (!handoff) {
            throw new Error(`No existe handoff ${handoffId}`);
        }
        handoff.status = 'closed';
        handoff.closed_at = isoNow();
        handoff.close_reason = closeReason;
        writeFileSync(HANDOFFS_PATH, serializeHandoffs(handoffs), 'utf8');
        if (wantsJson) {
            console.log(
                JSON.stringify(
                    {
                        version: 1,
                        ok: true,
                        action: 'close',
                        handoff,
                    },
                    null,
                    2
                )
            );
            return;
        }
        console.log(`Handoff cerrado: ${handoffId}`);
        return;
    }

    throw new Error(
        'Uso: node agent-orchestrator.js handoffs <status|lint|create|close>'
    );
}

module.exports = {
    handleHandoffsCommand,
};
