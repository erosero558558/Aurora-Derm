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
