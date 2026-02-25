function shallowMerge(target, source) {
    const out = { ...(target || {}) };
    for (const [key, value] of Object.entries(source || {})) {
        const existing = out[key];
        if (
            value &&
            typeof value === 'object' &&
            !Array.isArray(value) &&
            existing &&
            typeof existing === 'object' &&
            !Array.isArray(existing)
        ) {
            out[key] = shallowMerge(existing, value);
        } else {
            out[key] = value;
        }
    }
    return out;
}

function getGovernancePolicy(options) {
    const { cacheRef, existsSync, readFileSync, policyPath, defaultPolicy } =
        options;
    if (cacheRef && cacheRef.current) return cacheRef.current;
    let loaded = null;
    if (existsSync(policyPath)) {
        try {
            loaded = JSON.parse(readFileSync(policyPath, 'utf8'));
        } catch {
            loaded = null;
        }
    }
    const merged = shallowMerge(defaultPolicy, loaded);
    if (cacheRef) cacheRef.current = merged;
    return merged;
}

function readGovernancePolicyStrict(options) {
    const { existsSync, readFileSync, policyPath } = options;
    if (!existsSync(policyPath)) {
        throw new Error(`No existe ${policyPath}`);
    }
    return JSON.parse(readFileSync(policyPath, 'utf8'));
}

function validateGovernancePolicy(rawPolicy, options = {}) {
    const {
        defaultPolicy,
        policyPath = 'governance-policy.json',
        policyExists = false,
    } = options;
    const errors = [];
    const warnings = [];
    const merged = shallowMerge(defaultPolicy || {}, rawPolicy || {});
    const sourcePolicy =
        rawPolicy && typeof rawPolicy === 'object' ? rawPolicy : {};

    function warnUnknownKeys(obj, allowedKeys, pathPrefix) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return;
        for (const key of Object.keys(obj)) {
            if (!allowedKeys.includes(key)) {
                warnings.push(`${pathPrefix}.${key} unknown key`);
            }
        }
    }

    const version = Number(merged?.version);
    if (!Number.isFinite(version) || version !== 1) {
        errors.push(
            `version invalida (${merged?.version ?? 'vacio'}), esperado 1`
        );
    }

    const priorityDomains = Array.isArray(
        merged?.domain_health?.priority_domains
    )
        ? merged.domain_health.priority_domains.map((v) => String(v).trim())
        : null;
    if (!priorityDomains || priorityDomains.length === 0) {
        errors.push('domain_health.priority_domains debe ser array no vacio');
    } else {
        const seen = new Set();
        for (const domain of priorityDomains) {
            if (!domain) {
                errors.push(
                    'domain_health.priority_domains contiene dominio vacio'
                );
                continue;
            }
            const key = domain.toLowerCase();
            if (seen.has(key)) {
                errors.push(
                    `domain_health.priority_domains duplicado (${domain})`
                );
            }
            seen.add(key);
        }
    }

    const domainWeights = merged?.domain_health?.domain_weights;
    if (
        !domainWeights ||
        typeof domainWeights !== 'object' ||
        Array.isArray(domainWeights)
    ) {
        errors.push('domain_health.domain_weights debe ser objeto');
    } else {
        const defaultWeight = Number(domainWeights.default);
        if (!Number.isFinite(defaultWeight) || defaultWeight <= 0) {
            errors.push(
                `domain_health.domain_weights.default invalido (${domainWeights.default ?? 'vacio'})`
            );
        }
        for (const [key, rawValue] of Object.entries(domainWeights)) {
            const weight = Number(rawValue);
            if (!Number.isFinite(weight) || weight <= 0) {
                errors.push(
                    `domain_health.domain_weights.${key} invalido (${rawValue})`
                );
            }
        }
        for (const domain of priorityDomains || []) {
            if (
                !Object.prototype.hasOwnProperty.call(
                    domainWeights,
                    String(domain)
                )
            ) {
                warnings.push(
                    `domain_health.domain_weights sin peso explicito para ${domain} (usa default)`
                );
            }
        }
    }

    const signalScores = merged?.domain_health?.signal_scores;
    if (
        !signalScores ||
        typeof signalScores !== 'object' ||
        Array.isArray(signalScores)
    ) {
        errors.push('domain_health.signal_scores debe ser objeto');
    } else {
        const green = Number(signalScores.GREEN);
        const yellow = Number(signalScores.YELLOW);
        const red = Number(signalScores.RED);
        for (const [name, value] of [
            ['GREEN', green],
            ['YELLOW', yellow],
            ['RED', red],
        ]) {
            if (!Number.isFinite(value)) {
                errors.push(
                    `domain_health.signal_scores.${name} invalido (${signalScores[name]})`
                );
            }
        }
        if (
            Number.isFinite(green) &&
            Number.isFinite(yellow) &&
            Number.isFinite(red) &&
            !(green >= yellow && yellow >= red)
        ) {
            errors.push(
                'domain_health.signal_scores debe cumplir GREEN >= YELLOW >= RED'
            );
        }
    }

    const threshold = Number(
        merged?.summary?.thresholds?.domain_score_priority_yellow_below
    );
    if (!Number.isFinite(threshold) || threshold < 0) {
        errors.push(
            `summary.thresholds.domain_score_priority_yellow_below invalido (${merged?.summary?.thresholds?.domain_score_priority_yellow_below ?? 'vacio'})`
        );
    }

    const enforcement = merged?.enforcement;
    if (enforcement !== undefined) {
        if (
            !enforcement ||
            typeof enforcement !== 'object' ||
            Array.isArray(enforcement)
        ) {
            errors.push('enforcement debe ser objeto');
        } else {
            const branchProfiles = enforcement.branch_profiles;
            const warningPolicies = enforcement.warning_policies;
            if (
                !branchProfiles ||
                typeof branchProfiles !== 'object' ||
                Array.isArray(branchProfiles)
            ) {
                errors.push('enforcement.branch_profiles debe ser objeto');
            } else {
                for (const [branchName, branchCfg] of Object.entries(
                    branchProfiles
                )) {
                    if (
                        !branchCfg ||
                        typeof branchCfg !== 'object' ||
                        Array.isArray(branchCfg)
                    ) {
                        errors.push(
                            `enforcement.branch_profiles.${branchName} debe ser objeto`
                        );
                        continue;
                    }
                    const failOnRed = String(
                        branchCfg.fail_on_red || ''
                    ).trim();
                    if (!['warn', 'error', 'ignore'].includes(failOnRed)) {
                        errors.push(
                            `enforcement.branch_profiles.${branchName}.fail_on_red invalido (${branchCfg.fail_on_red ?? 'vacio'})`
                        );
                    }
                    warnUnknownKeys(
                        sourcePolicy?.enforcement?.branch_profiles?.[
                            branchName
                        ],
                        ['fail_on_red'],
                        `enforcement.branch_profiles.${branchName}`
                    );
                }
            }
            if (
                !warningPolicies ||
                typeof warningPolicies !== 'object' ||
                Array.isArray(warningPolicies)
            ) {
                errors.push('enforcement.warning_policies debe ser objeto');
            } else {
                for (const [policyName, policyCfg] of Object.entries(
                    warningPolicies
                )) {
                    if (
                        !policyCfg ||
                        typeof policyCfg !== 'object' ||
                        Array.isArray(policyCfg)
                    ) {
                        errors.push(
                            `enforcement.warning_policies.${policyName} debe ser objeto`
                        );
                        continue;
                    }
                    if (typeof policyCfg.enabled !== 'boolean') {
                        errors.push(
                            `enforcement.warning_policies.${policyName}.enabled debe ser boolean`
                        );
                    }
                    const severity = String(policyCfg.severity || '').trim();
                    if (!['warning', 'error'].includes(severity)) {
                        errors.push(
                            `enforcement.warning_policies.${policyName}.severity invalido (${policyCfg.severity ?? 'vacio'})`
                        );
                    }
                    if (
                        Object.prototype.hasOwnProperty.call(
                            policyCfg,
                            'hours_threshold'
                        )
                    ) {
                        const hoursThreshold = Number(
                            policyCfg.hours_threshold
                        );
                        if (
                            !Number.isFinite(hoursThreshold) ||
                            hoursThreshold <= 0
                        ) {
                            errors.push(
                                `enforcement.warning_policies.${policyName}.hours_threshold invalido (${policyCfg.hours_threshold})`
                            );
                        }
                    }
                    warnUnknownKeys(
                        sourcePolicy?.enforcement?.warning_policies?.[
                            policyName
                        ],
                        ['enabled', 'severity', 'hours_threshold'],
                        `enforcement.warning_policies.${policyName}`
                    );
                }
            }
            warnUnknownKeys(
                sourcePolicy?.enforcement,
                ['branch_profiles', 'warning_policies'],
                'enforcement'
            );
        }
    }

    warnUnknownKeys(
        sourcePolicy,
        ['version', 'domain_health', 'summary', 'enforcement'],
        'root'
    );
    warnUnknownKeys(
        sourcePolicy?.domain_health,
        ['priority_domains', 'domain_weights', 'signal_scores'],
        'domain_health'
    );
    warnUnknownKeys(sourcePolicy?.summary, ['thresholds'], 'summary');
    warnUnknownKeys(
        sourcePolicy?.summary?.thresholds,
        ['domain_score_priority_yellow_below'],
        'summary.thresholds'
    );

    return {
        version: 1,
        ok: errors.length === 0,
        error_count: errors.length,
        warning_count: warnings.length,
        errors,
        warnings,
        effective: {
            version,
            domain_health: {
                priority_domains: Array.isArray(priorityDomains)
                    ? priorityDomains
                    : [],
                domain_weights:
                    domainWeights &&
                    typeof domainWeights === 'object' &&
                    !Array.isArray(domainWeights)
                        ? domainWeights
                        : {},
                signal_scores:
                    signalScores &&
                    typeof signalScores === 'object' &&
                    !Array.isArray(signalScores)
                        ? signalScores
                        : {},
            },
            summary: {
                thresholds: {
                    domain_score_priority_yellow_below: Number.isFinite(
                        threshold
                    )
                        ? threshold
                        : null,
                },
            },
            enforcement:
                enforcement &&
                typeof enforcement === 'object' &&
                !Array.isArray(enforcement)
                    ? {
                          branch_profiles:
                              enforcement.branch_profiles &&
                              typeof enforcement.branch_profiles === 'object' &&
                              !Array.isArray(enforcement.branch_profiles)
                                  ? enforcement.branch_profiles
                                  : {},
                          warning_policies:
                              enforcement.warning_policies &&
                              typeof enforcement.warning_policies ===
                                  'object' &&
                              !Array.isArray(enforcement.warning_policies)
                                  ? enforcement.warning_policies
                                  : {},
                      }
                    : { branch_profiles: {}, warning_policies: {} },
        },
        source: {
            path: 'governance-policy.json',
            exists: Boolean(policyExists),
        },
    };
}

module.exports = {
    shallowMerge,
    getGovernancePolicy,
    readGovernancePolicyStrict,
    validateGovernancePolicy,
};
