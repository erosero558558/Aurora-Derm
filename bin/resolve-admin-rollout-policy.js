#!/usr/bin/env node
'use strict';

const VALID_STAGES = new Set([
    'stable',
    'internal',
    'canary',
    'general',
    'rollback',
]);

const STAGE_PROFILE_BY_STAGE = {
    stable: 'strict',
    internal: 'tolerant',
    canary: 'progressive',
    general: 'strict',
    rollback: 'rollback_strict',
};

const STAGE_OPENCLAW_REQUIREMENTS = {
    stable: true,
    internal: false,
    canary: true,
    general: true,
    rollback: false,
};

function parseBooleanLike(value, defaultValue) {
    if (value === undefined || value === null || value === '') {
        return Boolean(defaultValue);
    }

    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) {
        return true;
    }
    if (['0', 'false', 'no', 'off'].includes(normalized)) {
        return false;
    }
    return Boolean(defaultValue);
}

function normalizeStage(rawStage, fallbackStage) {
    const normalizedFallback = String(fallbackStage || 'general')
        .trim()
        .toLowerCase();
    const safeFallback = VALID_STAGES.has(normalizedFallback)
        ? normalizedFallback
        : 'general';
    const normalizedStage = String(rawStage || '')
        .trim()
        .toLowerCase();

    if (VALID_STAGES.has(normalizedStage)) {
        return {
            input: normalizedStage,
            effective: normalizedStage,
            usedFallback: false,
        };
    }

    return {
        input: normalizedStage,
        effective: safeFallback,
        usedFallback: true,
    };
}

function resolveAdminRolloutPolicy(options = {}) {
    const stageInfo = normalizeStage(options.stage, options.defaultStage);
    const stageRequiresOpenClaw =
        STAGE_OPENCLAW_REQUIREMENTS[stageInfo.effective] === true;
    const skipRuntimeSmoke = parseBooleanLike(
        options.skipRuntimeSmoke,
        options.defaultSkipRuntimeSmoke
    );
    const requireOpenClawAuth = parseBooleanLike(
        options.requireOpenClawAuth,
        options.defaultRequireOpenClawAuth ?? stageRequiresOpenClaw
    );
    const requireOpenClawLiveSmoke = parseBooleanLike(
        options.requireOpenClawLiveSmoke,
        options.defaultRequireOpenClawLiveSmoke ?? stageRequiresOpenClaw
    );
    let allowFeatureApiFailure = parseBooleanLike(
        options.allowFeatureApiFailure,
        options.defaultAllowFeatureApiFailure
    );
    let allowMissingFlag = parseBooleanLike(
        options.allowMissingFlag,
        options.defaultAllowMissingFlag
    );
    let policySource = 'input_or_var';

    if (stageInfo.usedFallback) {
        policySource = 'invalid_stage_fallback';
    }

    if (stageInfo.effective === 'internal') {
        let adjusted = false;
        if (!allowFeatureApiFailure) {
            allowFeatureApiFailure = true;
            adjusted = true;
        }
        if (!allowMissingFlag) {
            allowMissingFlag = true;
            adjusted = true;
        }
        if (adjusted) {
            policySource =
                policySource === 'input_or_var'
                    ? 'internal_stage_guardrail'
                    : `${policySource}+internal_stage_guardrail`;
        }
    }

    return {
        stage_input: stageInfo.input || '',
        stage_effective: stageInfo.effective,
        stage_profile:
            STAGE_PROFILE_BY_STAGE[stageInfo.effective] ||
            STAGE_PROFILE_BY_STAGE.general,
        skip_runtime_smoke_effective: skipRuntimeSmoke,
        require_openclaw_auth_effective: requireOpenClawAuth,
        require_openclaw_live_smoke_effective: requireOpenClawLiveSmoke,
        allow_feature_api_failure_effective: allowFeatureApiFailure,
        allow_missing_flag_effective: allowMissingFlag,
        policy_source: policySource,
    };
}

function parseArgs(argv) {
    const args = {
        defaultStage: 'general',
    };

    for (let i = 0; i < argv.length; i += 1) {
        const token = argv[i];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const next = argv[i + 1];
        const hasValue = next !== undefined && !next.startsWith('--');
        if (hasValue) {
            args[key] = next;
            i += 1;
        } else {
            args[key] = 'true';
        }
    }

    return {
        stage: args.stage,
        defaultStage: args['default-stage'] || args.defaultStage,
        skipRuntimeSmoke: args['skip-runtime-smoke'],
        defaultSkipRuntimeSmoke: args['default-skip-runtime-smoke'],
        requireOpenClawAuth: args['require-openclaw-auth'],
        defaultRequireOpenClawAuth: args['default-require-openclaw-auth'],
        requireOpenClawLiveSmoke: args['require-openclaw-live-smoke'],
        defaultRequireOpenClawLiveSmoke:
            args['default-require-openclaw-live-smoke'],
        allowFeatureApiFailure: args['allow-feature-api-failure'],
        defaultAllowFeatureApiFailure:
            args['default-allow-feature-api-failure'],
        allowMissingFlag: args['allow-missing-flag'],
        defaultAllowMissingFlag: args['default-allow-missing-flag'],
    };
}

if (require.main === module) {
    try {
        const options = parseArgs(process.argv.slice(2));
        const result = resolveAdminRolloutPolicy(options);
        process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : 'unexpected_error_resolving_policy';
        process.stderr.write(`${message}\n`);
        process.exit(1);
    }
}

module.exports = {
    parseBooleanLike,
    normalizeStage,
    resolveAdminRolloutPolicy,
};
