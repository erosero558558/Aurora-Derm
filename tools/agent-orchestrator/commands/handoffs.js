'use strict';

function parseBoardRevision(board) {
    const value = board?.policy?.revision;
    const n = Number(String(value ?? '').trim());
    return Number.isInteger(n) && n >= 0 ? n : 0;
}

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

function createBoardRevisionMismatchError(expectedRevision, actualRevision) {
    const error = new Error(
        `board revision mismatch: expected ${expectedRevision}, actual ${actualRevision}`
    );
    error.code = 'board_revision_mismatch';
    error.error_code = 'board_revision_mismatch';
    error.expected_revision = expectedRevision;
    error.actual_revision = actualRevision;
    return error;
}

function assertExpectedBoardRevision(board, expectedRevision) {
    if (expectedRevision === null || expectedRevision === undefined) return;
    const actual = parseBoardRevision(board);
    const expected = Number(expectedRevision);
    if (!Number.isInteger(expected) || expected < 0) {
        const error = new Error('--expect-rev debe ser entero >= 0');
        error.code = 'invalid_expect_rev';
        error.error_code = 'invalid_expect_rev';
        throw error;
    }
    if (expected !== actual) {
        throw createBoardRevisionMismatchError(expected, actual);
    }
}

function printHandoffsJsonError(error) {
    const payload = {
        version: 1,
        ok: false,
        command: 'handoffs',
        error: String(error?.message || error || 'handoffs_failed'),
        error_code: String(
            error?.error_code || error?.code || 'handoffs_failed'
        ),
    };
    if (payload.error_code === 'board_revision_mismatch') {
        payload.expected_revision = Number(error?.expected_revision);
        payload.actual_revision = Number(error?.actual_revision);
    }
    console.log(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return payload;
}

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
        appendHandoffBoardEvent,
        parseBoardForEvents,
        parseExpectedBoardRevisionFlag,
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
        const expired = handoffData.handoffs.filter(
            (item) => String(item.status) === 'expired'
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
                expired: expired.length,
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
        console.log(`Expired: ${expired.length}`);
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
        let board;
        let handoffs;
        try {
            board = parseBoard();
            handoffs = parseHandoffs();
            const expectRevision = parseExpectedRevisionFromFlags(
                flags,
                parseExpectedBoardRevisionFlag,
                { required: true, commandLabel: 'handoffs create' }
            );
            assertExpectedBoardRevision(board, expectRevision);

            const fromTaskId = String(
                flags.from || flags.from_task || ''
            ).trim();
            const toTaskId = String(flags.to || flags.to_task || '').trim();
            const reason = String(flags.reason || '').trim();
            const approvedBy = String(
                flags['approved-by'] || flags.approved_by || ''
            ).trim();
            const files = parseCsvList(flags.files || '');
            const ttlHours = Number(
                flags['ttl-hours'] || flags.ttl_hours || 24
            );

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
                throw new Error(
                    'handoffs create requiere --files con lista CSV'
                );
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
            try {
                if (typeof appendHandoffBoardEvent === 'function') {
                    appendHandoffBoardEvent('handoff_created', handoff, {
                        actor: approvedBy,
                        command: 'handoffs create',
                        reason,
                        board:
                            typeof parseBoardForEvents === 'function'
                                ? parseBoardForEvents()
                                : null,
                    });
                }
            } catch {
                // non-blocking event log
            }

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
        } catch (error) {
            if (wantsJson) {
                return printHandoffsJsonError(error);
            }
            throw error;
        }
    }

    if (subcommand === 'close') {
        const { positionals, flags } = parseFlags(args.slice(1));
        try {
            const handoffId = String(positionals[0] || flags.id || '').trim();
            const closeReason = String(flags.reason || 'closed_manual').trim();
            if (!handoffId) {
                throw new Error(
                    'Uso: node agent-orchestrator.js handoffs close <HO-001> [--reason motivo]'
                );
            }
            const board = parseBoard();
            const expectRevision = parseExpectedRevisionFromFlags(
                flags,
                parseExpectedBoardRevisionFlag,
                { required: true, commandLabel: 'handoffs close' }
            );
            assertExpectedBoardRevision(board, expectRevision);
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
            try {
                if (typeof appendHandoffBoardEvent === 'function') {
                    appendHandoffBoardEvent('handoff_closed', handoff, {
                        actor: handoff.approved_by || '',
                        command: 'handoffs close',
                        reason: closeReason,
                        board:
                            typeof parseBoardForEvents === 'function'
                                ? parseBoardForEvents()
                                : null,
                    });
                }
            } catch {
                // non-blocking event log
            }
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
        } catch (error) {
            if (wantsJson) {
                return printHandoffsJsonError(error);
            }
            throw error;
        }
    }

    throw new Error(
        'Uso: node agent-orchestrator.js handoffs <status|lint|create|close>'
    );
}

module.exports = {
    handleHandoffsCommand,
};
