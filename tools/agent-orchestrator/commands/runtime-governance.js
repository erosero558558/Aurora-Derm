'use strict';

function createRuntimeGovernanceCommands(ctx = {}) {
    const runner = {
        conflicts(args = []) {
            return ctx.conflictsCommandHandlers.handleConflictsCommand({
                args,
                parseBoard: ctx.parseBoard,
                parseHandoffs: ctx.parseHandoffs,
                loadMetricsSnapshot: ctx.loadMetricsSnapshot,
                loadJobsSnapshot: ctx.loadJobsSnapshot,
                analyzeConflicts: ctx.analyzeConflicts,
                toConflictJsonRecord: ctx.toConflictJsonRecord,
                attachDiagnostics: ctx.attachDiagnostics,
                buildWarnFirstDiagnostics: ctx.buildWarnFirstDiagnostics,
            });
        },

        policy(args = []) {
            return ctx.policyCommandHandlers.handlePolicyCommand({
                args,
                readGovernancePolicyStrict: ctx.readGovernancePolicyStrict,
                validateGovernancePolicy: ctx.validateGovernancePolicy,
                existsSync: ctx.existsSync,
                governancePolicyPath: ctx.governancePolicyPath,
                attachDiagnostics: ctx.attachDiagnostics,
                buildWarnFirstDiagnostics: ctx.buildWarnFirstDiagnostics,
            });
        },

        handoffs(args = []) {
            return ctx.handoffsCommandHandlers.handleHandoffsCommand({
                args,
                parseHandoffs: ctx.parseHandoffs,
                isExpired: ctx.isExpired,
                attachDiagnostics: ctx.attachDiagnostics,
                buildWarnFirstDiagnostics: ctx.buildWarnFirstDiagnostics,
                getHandoffLintErrors: ctx.getHandoffLintErrors,
                parseFlags: ctx.parseFlags,
                parseBoard: ctx.parseBoard,
                parseCsvList: ctx.parseCsvList,
                ensureTask: ctx.ensureTask,
                ACTIVE_STATUSES: ctx.ACTIVE_STATUSES,
                analyzeFileOverlap: ctx.analyzeFileOverlap,
                normalizePathToken: ctx.normalizePathToken,
                nextHandoffId: ctx.nextHandoffId,
                isoNow: ctx.isoNow,
                plusHoursIso: ctx.plusHoursIso,
                HANDOFFS_PATH: ctx.HANDOFFS_PATH,
                serializeHandoffs: ctx.serializeHandoffs,
                writeFileSync: ctx.writeFileSync,
                appendHandoffBoardEvent: ctx.appendHandoffBoardEvent,
                currentDate: ctx.currentDate,
                parseBoardForEvents: ctx.parseBoard,
                parseExpectedBoardRevisionFlag:
                    ctx.parseExpectedBoardRevisionFlag,
            });
        },

        codexCheck(args = []) {
            return ctx.codexCommandHandlers.handleCodexCheckCommand({
                args,
                buildCodexCheckReport: ctx.buildCodexCheckReport,
                attachDiagnostics: ctx.attachDiagnostics,
                buildWarnFirstDiagnostics: ctx.buildWarnFirstDiagnostics,
                parseBoard: ctx.parseBoard,
                parseHandoffs: ctx.parseHandoffs,
                loadMetricsSnapshot: ctx.loadMetricsSnapshot,
                loadJobsSnapshot: ctx.loadJobsSnapshot,
            });
        },

        codex(args = []) {
            return ctx.codexCommandHandlers.handleCodexCommand({
                args,
                parseFlags: ctx.parseFlags,
                ensureTask: ctx.ensureTask,
                parseBoard: ctx.parseBoard,
                ACTIVE_STATUSES: ctx.ACTIVE_STATUSES,
                ALLOWED_STATUSES: ctx.ALLOWED_STATUSES,
                parseCsvList: ctx.parseCsvList,
                currentDate: ctx.currentDate,
                writeBoard: ctx.writeBoard,
                writeCodexActiveBlock: ctx.writeCodexActiveBlock,
                parseCodexActiveBlocks: ctx.parseCodexActiveBlocks,
                parseExpectedBoardRevisionFlag:
                    ctx.parseExpectedBoardRevisionFlag,
                buildBoardWipLimitDiagnostics:
                    ctx.buildBoardWipLimitDiagnostics,
                runCodexCheck: () => runner.codexCheck([]),
            });
        },
    };

    return runner;
}

module.exports = {
    createRuntimeGovernanceCommands,
};
