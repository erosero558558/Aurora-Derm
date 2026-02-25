'use strict';

function handlePolicyCommand(ctx) {
    const {
        args = [],
        readGovernancePolicyStrict,
        validateGovernancePolicy,
        existsSync,
        governancePolicyPath,
        attachDiagnostics,
        buildWarnFirstDiagnostics,
    } = ctx;
    const subcommand = String(args[0] || '').trim() || 'lint';
    const wantsJson = args.includes('--json');

    if (subcommand !== 'lint') {
        throw new Error('Uso: node agent-orchestrator.js policy lint [--json]');
    }

    let report;
    try {
        const rawPolicy = readGovernancePolicyStrict();
        report = validateGovernancePolicy(rawPolicy);
    } catch (error) {
        report = {
            version: 1,
            ok: false,
            error_count: 1,
            warning_count: 0,
            errors: [String(error.message || error)],
            warnings: [],
            effective: null,
            source: {
                path: 'governance-policy.json',
                exists: existsSync(governancePolicyPath),
            },
        };
    }

    const reportWithDiagnostics = attachDiagnostics(
        report,
        buildWarnFirstDiagnostics({
            source: 'policy',
            policyReport: report,
        })
    );

    if (wantsJson) {
        console.log(JSON.stringify(reportWithDiagnostics, null, 2));
        if (!report.ok) process.exitCode = 1;
        return reportWithDiagnostics;
    }

    if (!report.ok) {
        throw new Error(
            `Governance policy invalida:\n- ${report.errors.join('\n- ')}`
        );
    }

    console.log('OK: governance-policy.json valido.');
    if (report.warning_count > 0) {
        for (const warning of report.warnings) {
            console.log(`WARN: ${warning}`);
        }
    }
    return report;
}

module.exports = {
    handlePolicyCommand,
};
