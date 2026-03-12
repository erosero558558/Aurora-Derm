#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
    const options = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            throw new Error(`unexpected_argument:${token}`);
        }
        const key = token.slice(2);
        const next = argv[index + 1];
        if (next === undefined || next.startsWith('--')) {
            throw new Error(`missing_value:${token}`);
        }
        options[key] = next;
        index += 1;
    }
    return options;
}

function buildAdminRolloutPlaceholderReport(options = {}) {
    const reason = String(
        options.reason ?? 'deploy_hosting_precheck_not_executed'
    ).trim();
    if (!reason) {
        throw new Error('missing_reason');
    }

    return {
        status: 'skipped',
        skipped: true,
        reason,
        generated_at: new Date().toISOString(),
        domain: String(options.domain ?? process.env.PROD_URL ?? '').trim(),
        stage: String(
            options.stage ??
                process.env.ADMIN_ROLLOUT_STAGE_EFFECTIVE ??
                'unknown'
        ).trim(),
        preflight_outcome: String(
            options.preflightOutcome ??
                process.env.PREFLIGHT_OUTCOME ??
                'not_evaluated'
        ).trim(),
        resolve_postdeploy_outcome: String(
            options.resolvePostdeployOutcome ??
                process.env.RESOLVE_POSTDEPLOY_OUTCOME ??
                'not_evaluated'
        ).trim(),
        transport_preflight_reason: String(
            options.transportPreflightReason ??
                process.env.TRANSPORT_PREFLIGHT_REASON ??
                'not_evaluated'
        ).trim(),
        transport_preflight_target: String(
            options.transportPreflightTarget ??
                process.env.TRANSPORT_PREFLIGHT_TARGET ??
                'not_evaluated'
        ).trim(),
    };
}

function writeAdminRolloutPlaceholderReport(filePath, payload) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function main(argv) {
    const options = parseArgs(argv);
    const outputPath = String(options.out || '').trim();
    if (!outputPath) {
        throw new Error('missing_out');
    }

    const payload = buildAdminRolloutPlaceholderReport(options);
    writeAdminRolloutPlaceholderReport(outputPath, payload);
}

if (require.main === module) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        const message =
            error && error.message ? error.message : 'unknown_error';
        console.error(`[write-admin-rollout-placeholder-report] ${message}`);
        process.exit(1);
    }
}

module.exports = {
    buildAdminRolloutPlaceholderReport,
    parseArgs,
    writeAdminRolloutPlaceholderReport,
};
