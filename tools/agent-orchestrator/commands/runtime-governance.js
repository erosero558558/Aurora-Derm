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
                buildLiveFocusSummary: ctx.buildLiveFocusSummary,
                parseFlags: ctx.parseFlags,
                collectWorkspaceTruth: ctx.collectWorkspaceTruth,
                buildWorkspaceTruthDiagnostics:
                    ctx.buildWorkspaceTruthDiagnostics,
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
                parseBoard: ctx.parseBoard,
                buildLiveFocusSummary: ctx.buildLiveFocusSummary,
                loadMetricsSnapshot: ctx.loadMetricsSnapshot,
            });
        },

        handoffs(args = []) {
            return ctx.handoffsCommandHandlers.handleHandoffsCommand({
                args,
                parseHandoffs: ctx.parseHandoffs,
                loadMetricsSnapshot: ctx.loadMetricsSnapshot,
                isExpired: ctx.isExpired,
                attachDiagnostics: ctx.attachDiagnostics,
                buildWarnFirstDiagnostics: ctx.buildWarnFirstDiagnostics,
                buildLiveFocusSummary: ctx.buildLiveFocusSummary,
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
                buildLiveFocusSummary: ctx.buildLiveFocusSummary,
                verifyOpenClawRuntime: ctx.verifyOpenClawRuntime,
                buildRuntimeBlockingErrors: ctx.buildRuntimeBlockingErrors,
                loadModelUsageLedger: ctx.loadModelUsageLedger,
                buildModelUsageSummary: ctx.buildModelUsageSummary,
                collectPremiumGateBlockers: ctx.collectPremiumGateBlockers,
                getGovernancePolicy: ctx.getGovernancePolicy,
                parseFlags: ctx.parseFlags,
                buildWorkspaceComplianceDiagnostics:
                    ctx.buildWorkspaceComplianceDiagnostics,
                collectWorkspaceTruth: ctx.collectWorkspaceTruth,
                buildWorkspaceTruthDiagnostics:
                    ctx.buildWorkspaceTruthDiagnostics,
            });
        },

        codex(args = []) {
            return ctx.codexCommandHandlers.handleCodexCommand({
                args,
                parseFlags: ctx.parseFlags,
                ensureTask: ctx.ensureTask,
                parseBoard: ctx.parseBoard,
                parseHandoffs: ctx.parseHandoffs,
                parseDecisions: ctx.parseDecisions,
                ACTIVE_STATUSES: ctx.ACTIVE_STATUSES,
                ALLOWED_STATUSES: ctx.ALLOWED_STATUSES,
                parseCsvList: ctx.parseCsvList,
                currentDate: ctx.currentDate,
                validateTaskGovernancePrechecks:
                    ctx.validateTaskGovernancePrechecks,
                writeBoard: ctx.writeBoard,
                writeCodexActiveBlock: ctx.writeCodexActiveBlock,
                parseCodexActiveBlocks: ctx.parseCodexActiveBlocks,
                parseExpectedBoardRevisionFlag:
                    ctx.parseExpectedBoardRevisionFlag,
                buildBoardWipLimitDiagnostics:
                    ctx.buildBoardWipLimitDiagnostics,
                runCodexCheck: () => runner.codexCheck([]),
                getGovernancePolicy: ctx.getGovernancePolicy,
                loadModelUsageLedger: ctx.loadModelUsageLedger,
                appendModelUsageLedgerEntries:
                    ctx.appendModelUsageLedgerEntries,
                syncTaskModelRoutingState: ctx.syncTaskModelRoutingState,
                buildTaskModelUsageSummary: ctx.buildTaskModelUsageSummary,
                validateDecisionPacketFile: ctx.validateDecisionPacketFile,
                printJson: ctx.printJson,
                toTaskJson: ctx.toTaskJson,
                collectWorkspaceTruth: ctx.collectWorkspaceTruth,
                assertWorkspaceTruthOk: ctx.assertWorkspaceTruthOk,
                ensureTaskWorktree: ctx.ensureTaskWorktree,
                applyWorkspaceTaskSnapshot: ctx.applyWorkspaceTaskSnapshot,
                mirrorWorkspaceBoard: ctx.mirrorWorkspaceBoard,
            });
        },
    };

    return runner;
}

module.exports = {
    createRuntimeGovernanceCommands,
};
